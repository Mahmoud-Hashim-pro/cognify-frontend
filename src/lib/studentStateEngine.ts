/**
 * Unified Student State Engine (Point 1)
 * The Single Source of Truth for student state in Cognify 2.0.
 * Coordinates cognitive stage, concept mastery, prerequisite diagnosis,
 * active interventions, and spaced retention schedules.
 */

import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db, cleanDataForFirestore } from './firebase';
import { CognitiveStage, resolveCognitiveStage } from './studentStateScaffolding';
import { diagnosePrerequisiteGap, PrerequisiteDiagnosis } from './conceptGraph';
import { decideIntervention, InterventionDirective } from './interventionEngine';
import {
  RetentionSchedule,
  createInitialRetentionSchedule,
  calculateNextReview,
} from './spacedRetention';
import {
  eventBus,
  LearningEvent,
  ExerciseAnsweredPayload,
  FeedbackRecordedPayload,
  isGuestUser,
  getLearningEventHistory,
} from './learningEvents';
import { buildPersonalLearningModel } from './personalLearningModel';
import { generatePersonalLearningProfile } from './learningProfileService';
import { createDefaultAccessibilityState } from './accessibilityStateEngine';
import type {
  PedagogyStrategy,
  StrategyOutcomeMetrics,
  InterventionOutcomeRecord,
  ConceptMasteryRecord,
  StruggleSignalType,
  LearningStrain,
  PedagogyMetrics,
  ResponseLatencyProfile,
  RetentionRiskLevel,
  ConceptLearningProfile,
  PersonalLearningModel,
  PersonalLearningProfile,
  StudentState,
} from '../types/studentState';

export { isGuestUser };
export type {
  RetentionSchedule,
  PersonalLearningModel,
  PersonalLearningProfile,
  ConceptLearningProfile,
  ResponseLatencyProfile,
  RetentionRiskLevel,
  PedagogyStrategy,
  StrategyOutcomeMetrics,
  InterventionOutcomeRecord,
  ConceptMasteryRecord,
  StruggleSignalType,
  LearningStrain,
  PedagogyMetrics,
  StudentState,
};

/**
 * Canonical Firestore document path for student state.
 * Structured under users/{uid}/studentState/current subcollection.
 */
export const studentStateDoc = (uid: string) => doc(db, 'users', uid, 'studentState', 'current');

/**
 * Pure helper function to compute concept mastery update and intervention outcome record.
 * Consolidates the single source of truth for answer outcomes across both live sessions
 * and event-sourced historical replays (DRY).
 */
export function computeConceptAnswerUpdate(
  existingRecord: ConceptMasteryRecord | undefined,
  cleanConcept: string,
  isCorrect: boolean,
  timestamp: number,
  responseTimeMs: number,
  mistakeType?: string,
  activeInt?: InterventionDirective
): {
  updatedRecord: ConceptMasteryRecord;
  outcomeRecord?: InterventionOutcomeRecord;
} {
  const record: ConceptMasteryRecord = existingRecord ? { ...existingRecord } : {
    conceptId: cleanConcept,
    attempts: 0,
    correct: 0,
    accuracy: 0,
    confidence: 0.5,
    consecutiveCorrect: 0,
    consecutiveIncorrect: 0,
    lastTested: timestamp,
    mistakeTypes: [],
    strategyOutcomes: {},
  };

  const previousAccuracy = record.attempts > 0 ? record.accuracy : 0;
  record.attempts += 1;
  record.lastTested = timestamp;

  if (isCorrect) {
    record.correct += 1;
    record.consecutiveCorrect += 1;
    record.consecutiveIncorrect = 0;
    const streakBonus = Math.min(0.15, record.consecutiveCorrect * 0.05);
    record.confidence = Math.min(1.0, Math.round((record.confidence + 0.12 + streakBonus) * 100) / 100);
  } else {
    record.consecutiveIncorrect += 1;
    record.consecutiveCorrect = 0;
    record.confidence = Math.max(0.1, Math.round((record.confidence - 0.15) * 100) / 100);
    record.mistakeTypes = record.mistakeTypes ? [...record.mistakeTypes] : [];
    if (mistakeType && !record.mistakeTypes.includes(mistakeType)) {
      record.mistakeTypes.push(mistakeType);
    }
  }

  record.accuracy = Math.round((record.correct / record.attempts) * 100) / 100;

  if (typeof responseTimeMs === 'number' && responseTimeMs > 0) {
    const prevTotal = (record.avgResponseTimeMs || responseTimeMs) * (record.attempts - 1);
    record.avgResponseTimeMs = Math.round((prevTotal + responseTimeMs) / record.attempts);
  }

  let outcomeRecord: InterventionOutcomeRecord | undefined;

  // Outcome tracking: evaluate effectiveness of any active intervention on this concept
  if (activeInt && activeInt.strategy) {
    const strat = activeInt.strategy as PedagogyStrategy;
    record.strategyOutcomes = record.strategyOutcomes ? { ...record.strategyOutcomes } : {};
    const currentMetric: StrategyOutcomeMetrics = record.strategyOutcomes[strat]
      ? { ...record.strategyOutcomes[strat]! }
      : {
          attempts: 0,
          successes: 0,
          rate: 0,
          lastUsed: timestamp,
        };

    currentMetric.attempts += 1;
    if (isCorrect) {
      currentMetric.successes += 1;
    }
    currentMetric.rate = Math.round((currentMetric.successes / currentMetric.attempts) * 100) / 100;
    currentMetric.lastUsed = timestamp;
    record.strategyOutcomes[strat] = currentMetric;

    // Update best observed strategy if success rate is solid (>= 0.6 with at least 1 attempt)
    if (currentMetric.attempts >= 1 && currentMetric.rate >= 0.6) {
      record.bestObservedStrategy = strat;
    }

    outcomeRecord = {
      id: `out_${timestamp}_${Math.random().toString(36).substring(2, 6)}`,
      interventionId: activeInt.id,
      conceptId: cleanConcept,
      strategy: strat,
      outcome: isCorrect ? 'success' : 'struggle',
      preInterventionAccuracy: previousAccuracy,
      postInterventionAccuracy: record.accuracy,
      attemptsUnderIntervention: currentMetric.attempts,
      triggeredTimestamp: activeInt.id.startsWith('int_')
        ? parseInt(activeInt.id.split('_')[1], 10) || timestamp
        : timestamp,
      resolvedTimestamp: isCorrect ? timestamp : undefined,
    };
  }

  return { updatedRecord: record, outcomeRecord };
}

const STORAGE_PREFIX = 'cognify_student_state_';

export function createInitialStudentState(uid: string, level?: string): StudentState {
  const initial: StudentState = {
    uid,
    cognitiveStage: resolveCognitiveStage(level),
    activePedagogy: 'scaffolded',
    pedagogyEffectiveness: {
      scaffolded: { helpfulCount: 0, unhelpfulCount: 0, score: 0.8 },
      worked_example: { helpfulCount: 0, unhelpfulCount: 0, score: 0.75 },
      analogies: { helpfulCount: 0, unhelpfulCount: 0, score: 0.7 },
      socratic: { helpfulCount: 0, unhelpfulCount: 0, score: 0.65 },
      advanced_rigor: { helpfulCount: 0, unhelpfulCount: 0, score: 0.6 },
    },
    learningStrain: {
      possibleStruggle: 0.2,
      confidence: 0.5,
      signals: [],
    },
    struggleSignal: 0.2,
    cognitiveLoadScore: 0.2,
    conceptMastery: {},
    retentionSchedules: {},
    activeInterventions: {},
    interventionHistory: [],
    totalExercisesCompleted: 0,
    accessibilityState: createDefaultAccessibilityState(uid),
    lastActiveTimestamp: Date.now(),
  };
  initial.personalLearningModel = buildPersonalLearningModel(initial);
  return initial;
}

export class StudentStateManager {
  private state: StudentState;
  private changeListeners: Set<(state: StudentState) => void> = new Set();
  private unsubscribeEventBus?: () => void;
  private isLoaded: boolean = false;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingConcepts: Set<string> = new Set();
  private hasPendingWrites: boolean = false;
  private beforeUnloadHandler?: () => void;

  constructor(uid: string, level?: string) {
    // 1) Fast paint from local device cache
    this.state = this.loadFromLocalCache(uid) || createInitialStudentState(uid, level);
    this.initEventListeners();

    // 2) Unauthenticated or guest sessions skip remote Firestore hydration entirely
    if (isGuestUser(uid)) {
      this.isLoaded = true;
    } else {
      this.hydrateFromFirestore(uid, level);
    }

    // 3) Bind browser window beforeunload to flush any pending debounced writes
    if (typeof window !== 'undefined') {
      this.beforeUnloadHandler = () => {
        this.flushPendingWrites();
      };
      window.addEventListener('beforeunload', this.beforeUnloadHandler);
    }
  }

  public getState(): StudentState {
    return { ...this.state };
  }

  public getPersonalLearningModel(): PersonalLearningModel {
    if (!this.state.personalLearningModel) {
      this.state.personalLearningModel = buildPersonalLearningModel(this.state);
    }
    return { ...this.state.personalLearningModel };
  }

  /**
   * Phase 2C - Sprint 1: Generates the canonical PersonalLearningProfile contract.
   */
  public getPersonalLearningProfile(displayName?: string): PersonalLearningProfile {
    return generatePersonalLearningProfile(this.state, displayName);
  }

  /** True once authoritative state has loaded (instant for guests, post-hydration for auth users) */
  public get loaded(): boolean {
    return this.isLoaded;
  }

  public get isHydrated(): boolean {
    return this.isLoaded;
  }

  public subscribe(listener: (state: StudentState) => void): () => void {
    this.changeListeners.add(listener);
    return () => {
      this.changeListeners.delete(listener);
    };
  }

  private notify() {
    const snap = { ...this.state };
    this.changeListeners.forEach((fn) => {
      try {
        fn(snap);
      } catch (err) {
        console.error('[StudentStateManager] Error in subscriber callback:', err);
      }
    });
  }

  public destroy() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.beforeUnloadHandler && typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', this.beforeUnloadHandler);
    }
    this.flushPendingWrites();
    if (this.unsubscribeEventBus) {
      this.unsubscribeEventBus();
    }
    this.changeListeners.clear();
  }

  private initEventListeners() {
    const unsubExercise = eventBus.on('EXERCISE_ANSWERED', (event: LearningEvent<ExerciseAnsweredPayload>) => {
      if (event.uid === this.state.uid && event.payload) {
        this.recordAnswer(
          event.payload.conceptId || event.payload.topic,
          event.payload.isCorrect,
          event.payload.responseTimeMs,
          event.payload.mistakeType
        );
      }
    });

    const unsubFeedback = eventBus.on('FEEDBACK_RECORDED', (event: LearningEvent<FeedbackRecordedPayload>) => {
      if (event.uid === this.state.uid && event.payload) {
        this.recordPedagogyFeedback(
          event.payload.pedagogyUsed as any,
          event.payload.helpful,
          event.payload.conceptId,
          event.payload.reason
        );
      }
    });

    this.unsubscribeEventBus = () => {
      unsubExercise();
      unsubFeedback();
    };
  }

  /**
   * Hydrates state from Firestore with deterministic event-sourced canonical projection.
   * Prioritizes projecting from immutable LearningEvents to guarantee cross-device consistency.
   */
  private async hydrateFromFirestore(uid: string, level?: string) {
    try {
      // 1. Attempt canonical event projection if events exist in event store
      try {
        const events = await getLearningEventHistory(uid, 200);
        if (events && events.length > 0) {
          const canonical = projectEventsToState(events, uid, level);
          this.state = {
            ...this.state,
            ...canonical,
            activePedagogy: this.state.activePedagogy || canonical.activePedagogy,
            pedagogyEffectiveness: {
              ...canonical.pedagogyEffectiveness,
              ...this.state.pedagogyEffectiveness,
            },
          };
          this.saveToLocalCache();
          this.isLoaded = true;
          this.notify();
          return;
        }
      } catch (e) {
        console.warn('[StudentStateManager] Event projection fallback to snapshot doc:', e);
      }

      // 2. Fall back to document snapshot
      const snap = await getDoc(studentStateDoc(uid));
      if (snap.exists()) {
        const remote = snap.data() as Partial<StudentState>;

        // Deep merge pedagogyEffectiveness
        if (remote.pedagogyEffectiveness) {
          this.state.pedagogyEffectiveness = {
            ...this.state.pedagogyEffectiveness,
            ...remote.pedagogyEffectiveness,
          };
        }

        // Deep merge conceptMastery (prioritize higher attempts & latest tested timestamp)
        const mergedMastery: Record<string, ConceptMasteryRecord> = { ...this.state.conceptMastery };
        if (remote.conceptMastery) {
          for (const [cid, remoteRec] of Object.entries(remote.conceptMastery)) {
            const localRec = mergedMastery[cid];
            if (!localRec) {
              mergedMastery[cid] = remoteRec;
            } else {
              mergedMastery[cid] = {
                ...localRec,
                attempts: Math.max(localRec.attempts, remoteRec.attempts),
                correct: Math.max(localRec.correct, remoteRec.correct),
                accuracy: remoteRec.attempts >= localRec.attempts ? remoteRec.accuracy : localRec.accuracy,
                confidence: Math.max(localRec.confidence, remoteRec.confidence),
                consecutiveCorrect: Math.max(localRec.consecutiveCorrect, remoteRec.consecutiveCorrect),
                consecutiveIncorrect: Math.min(localRec.consecutiveIncorrect, remoteRec.consecutiveIncorrect),
                lastTested: Math.max(localRec.lastTested || 0, remoteRec.lastTested || 0),
                mistakeTypes: Array.from(new Set([...(localRec.mistakeTypes || []), ...(remoteRec.mistakeTypes || [])])),
              };
            }
          }
        }

        // Deep merge retention schedules
        const mergedSchedules: Record<string, RetentionSchedule> = { ...this.state.retentionSchedules };
        if (remote.retentionSchedules) {
          for (const [cid, remoteSch] of Object.entries(remote.retentionSchedules)) {
            const localSch = mergedSchedules[cid];
            if (!localSch || (remoteSch.repetitions || 0) >= (localSch.repetitions || 0)) {
              mergedSchedules[cid] = remoteSch;
            }
          }
        }

        // Deep merge active interventions
        const mergedInterventions: Record<string, InterventionDirective> = {
          ...remote.activeInterventions,
          ...this.state.activeInterventions,
        };

        this.state = {
          ...createInitialStudentState(uid, level),
          ...remote,
          uid,
          conceptMastery: mergedMastery,
          retentionSchedules: mergedSchedules,
          activeInterventions: mergedInterventions,
          totalExercisesCompleted: Math.max(this.state.totalExercisesCompleted, remote.totalExercisesCompleted || 0),
          lastActiveTimestamp: Math.max(this.state.lastActiveTimestamp, remote.lastActiveTimestamp || 0),
        };

        this.saveToLocalCache();
      }
    } catch (err) {
      console.warn('[StudentStateManager] Firestore hydration failed, using local cache fallback:', err);
    } finally {
      this.isLoaded = true;
      this.notify();
    }
  }

  /**
   * Process an answered exercise and update student state in closed-loop fashion.
   * Debounces Firestore network writes by 5 seconds to conserve quota.
   */
  public recordAnswer(
    conceptId: string,
    isCorrect: boolean,
    responseTimeMs: number,
    mistakeType?: string
  ): { state: StudentState; intervention?: InterventionDirective } {
    const now = Date.now();
    const cleanConcept = conceptId.toLowerCase().trim().replace(/[\s-]+/g, '_');

    const activeInt = this.state.activeInterventions[cleanConcept];
    const { updatedRecord, outcomeRecord } = computeConceptAnswerUpdate(
      this.state.conceptMastery[cleanConcept],
      cleanConcept,
      isCorrect,
      now,
      responseTimeMs,
      mistakeType,
      activeInt
    );
    const record = updatedRecord;
    if (outcomeRecord) {
      this.state.interventionHistory = this.state.interventionHistory || [];
      this.state.interventionHistory.push(outcomeRecord);
    }

    this.state.conceptMastery[cleanConcept] = record;
    this.state.totalExercisesCompleted += 1;
    this.state.lastActiveTimestamp = now;

    // Diagnose prerequisite gaps using concept graph
    const prereqDiagnosis: PrerequisiteDiagnosis = diagnosePrerequisiteGap(
      cleanConcept,
      this.state.conceptMastery
    );

    // Calculate empirical learning strain signals
    const detectedSignals: StruggleSignalType[] = [];
    if (responseTimeMs > 15000) {
      detectedSignals.push('high_response_latency');
    }
    if (record.consecutiveIncorrect >= 2) {
      detectedSignals.push('repeated_errors');
    }
    if (prereqDiagnosis.hasPrerequisiteGap) {
      detectedSignals.push('prerequisite_gap');
    }

    const latencyWeight = Math.min(0.5, responseTimeMs / 30000);
    const errorWeight = Math.min(0.5, record.consecutiveIncorrect * 0.25);
    const possibleStruggle = Math.min(1.0, Math.round((latencyWeight + errorWeight) * 100) / 100);
    const confidence = Math.min(1.0, Math.round((0.5 + Math.min(0.5, record.attempts * 0.1)) * 100) / 100);

    this.state.learningStrain = {
      possibleStruggle,
      confidence,
      signals: detectedSignals,
    };
    this.state.struggleSignal = possibleStruggle;
    this.state.cognitiveLoadScore = possibleStruggle;

    // Decide whether a pedagogical intervention is warranted
    const intervention = decideIntervention({
      conceptId: cleanConcept,
      consecutiveIncorrect: record.consecutiveIncorrect,
      consecutiveCorrect: record.consecutiveCorrect,
      accuracyRate: record.accuracy,
      avgResponseTimeMs: responseTimeMs,
      prerequisiteDiagnosis: prereqDiagnosis,
      repeatedMistakeType: mistakeType,
      bestObservedStrategy: record.bestObservedStrategy,
    });

    this.state.activeInterventions[cleanConcept] = intervention;
    this.state.activePedagogy = intervention.strategy;

    // Update spaced retention schedule
    let schedule = this.state.retentionSchedules[cleanConcept];
    if (!schedule) {
      schedule = createInitialRetentionSchedule(cleanConcept);
    }
    const qualityScore = isCorrect ? (responseTimeMs < 8000 ? 5 : 4) : 2;
    this.state.retentionSchedules[cleanConcept] = calculateNextReview(schedule, qualityScore);

    // Track touched concepts and mark pending writes
    this.pendingConcepts.add(cleanConcept);
    this.hasPendingWrites = true;

    // Consolidate longitudinal Personal Learning Model
    this.state.personalLearningModel = buildPersonalLearningModel(this.state, now);

    // Instant local cache save
    this.saveToLocalCache();

    // Schedule debounced Firestore write (5 seconds) for non-guest users
    if (!isGuestUser(this.state.uid)) {
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }
      this.debounceTimer = setTimeout(() => {
        this.flushPendingWrites();
      }, 5000);
    }

    // Notify all active subscribers of the state transition
    this.notify();

    return { state: { ...this.state }, intervention };
  }

  /**
   * Records student feedback (helpful/unhelpful) on a pedagogical strategy.
   * Dynamically adjusts strategy effectiveness scores and triggers auto-adaptation.
   */
  public recordPedagogyFeedback(
    pedagogy?: PedagogyStrategy | string,
    helpful?: boolean,
    conceptId?: string,
    reason?: string
  ): StudentState {
    const validStrategies: PedagogyStrategy[] = [
      'analogies',
      'scaffolded',
      'worked_example',
      'socratic',
      'advanced_rigor',
    ];

    const targetStrategy: PedagogyStrategy = validStrategies.includes(pedagogy as PedagogyStrategy)
      ? (pedagogy as PedagogyStrategy)
      : this.state.activePedagogy;

    const metrics = this.state.pedagogyEffectiveness[targetStrategy] || {
      helpfulCount: 0,
      unhelpfulCount: 0,
      score: 0.7,
    };

    if (helpful) {
      metrics.helpfulCount += 1;
      metrics.score = Math.min(1.0, Math.round((metrics.score + 0.05) * 100) / 100);
    } else {
      metrics.unhelpfulCount += 1;
      metrics.score = Math.max(0.1, Math.round((metrics.score - 0.1) * 100) / 100);

      // Auto-adapt: If current active pedagogy was rated unhelpful, switch to highest scoring alternative
      if (this.state.activePedagogy === targetStrategy) {
        let bestScore = -1;
        let bestStrategy: PedagogyStrategy = 'scaffolded';
        for (const strat of validStrategies) {
          if (strat !== targetStrategy) {
            const sMetrics = this.state.pedagogyEffectiveness[strat];
            if (sMetrics && sMetrics.score > bestScore) {
              bestScore = sMetrics.score;
              bestStrategy = strat;
            }
          }
        }
        this.state.activePedagogy = bestStrategy;
      }
    }

    this.state.pedagogyEffectiveness[targetStrategy] = metrics;
    this.state.lastActiveTimestamp = Date.now();
    this.hasPendingWrites = true;

    this.saveToLocalCache();

    if (!isGuestUser(this.state.uid)) {
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }
      this.debounceTimer = setTimeout(() => {
        this.flushPendingWrites();
      }, 5000);
    }

    this.notify();
    return { ...this.state };
  }

  /**
   * Flushes any pending local mutations to Firestore using targeted dot-path keys.
   */
  public async flushPendingWrites(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (isGuestUser(this.state.uid) || !this.hasPendingWrites) {
      return;
    }

    const touched = Array.from(this.pendingConcepts);
    this.pendingConcepts.clear();
    this.hasPendingWrites = false;

    try {
      const s = this.state;
      const patch: Record<string, unknown> = {
        cognitiveStage: s.cognitiveStage,
        activePedagogy: s.activePedagogy,
        pedagogyEffectiveness: s.pedagogyEffectiveness,
        learningStrain: s.learningStrain,
        struggleSignal: s.struggleSignal,
        cognitiveLoadScore: s.cognitiveLoadScore,
        totalExercisesCompleted: s.totalExercisesCompleted,
        lastActiveTimestamp: s.lastActiveTimestamp,
        interventionHistory: s.interventionHistory || [],
        personalLearningModel: s.personalLearningModel,
      };

      for (const cid of touched) {
        if (s.conceptMastery[cid]) {
          patch[`conceptMastery.${cid}`] = s.conceptMastery[cid];
        }
        if (s.retentionSchedules[cid]) {
          patch[`retentionSchedules.${cid}`] = s.retentionSchedules[cid];
        }
        if (s.activeInterventions[cid]) {
          patch[`activeInterventions.${cid}`] = s.activeInterventions[cid];
        }
      }

      const ref = studentStateDoc(s.uid);
      const cleanPatch = cleanDataForFirestore(patch);

      try {
        await updateDoc(ref, cleanPatch as Record<string, any>);
      } catch (err: any) {
        if (err?.code === 'not-found' || err?.message?.includes('No document to update')) {
          await setDoc(ref, cleanDataForFirestore(s), { merge: true });
        } else {
          console.warn('[StudentStateManager] Firestore dot-path update warning:', err);
        }
      }
    } catch (writeErr) {
      console.error('[StudentStateManager] Failed to flush writes to Firestore:', writeErr);
    }
  }

  /**
   * Reads from local localStorage cache for instant sub-millisecond cold start.
   */
  private loadFromLocalCache(uid: string): StudentState | null {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    try {
      const raw = localStorage.getItem(`cognify_student_state_${uid}`);
      if (!raw) return null;
      return JSON.parse(raw) as StudentState;
    } catch {
      return null;
    }
  }

  /**
   * Writes authoritative state to synchronous device localStorage.
   */
  private saveToLocalCache() {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      localStorage.setItem(`cognify_student_state_${this.state.uid}`, JSON.stringify(this.state));
    } catch (e) {
      console.warn('[StudentStateManager] Local cache save failed:', e);
    }
  }
}

const managerCache: Map<string, StudentStateManager> = new Map();

/**
 * Returns or creates the singleton StudentStateManager for a given user ID.
 * Ensures consistent reactive state across all UI components and background handlers.
 */
export function getStudentStateManager(uid: string, level?: string): StudentStateManager {
  if (!managerCache.has(uid)) {
    managerCache.set(uid, new StudentStateManager(uid, level));
  }
  return managerCache.get(uid)!;
}

/**
 * Event-sourced pure state projector.
 * Derives authoritative canonical state by sequentially folding learning events.
 */
export function projectEventsToState(
  events: LearningEvent[],
  uid: string,
  level?: string
): StudentState {
  const state = createInitialStudentState(uid, level);
  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);

  for (const event of sorted) {
    if (event.type === 'EXERCISE_ANSWERED' && event.payload) {
      const {
        conceptId,
        topic,
        isCorrect,
        responseTimeMs = 5000,
        mistakeType,
      } = event.payload as ExerciseAnsweredPayload;

      const cleanConcept = (conceptId || topic || 'general')
        .toLowerCase()
        .trim()
        .replace(/[\s-]+/g, '_');

      const activeInt = state.activeInterventions[cleanConcept];
      const { updatedRecord, outcomeRecord } = computeConceptAnswerUpdate(
        state.conceptMastery[cleanConcept],
        cleanConcept,
        isCorrect,
        event.timestamp,
        responseTimeMs,
        mistakeType,
        activeInt
      );
      const record = updatedRecord;
      if (outcomeRecord) {
        state.interventionHistory = state.interventionHistory || [];
        state.interventionHistory.push(outcomeRecord);
      }

      state.conceptMastery[cleanConcept] = record;
      state.totalExercisesCompleted += 1;
      state.lastActiveTimestamp = event.timestamp;

      // Prerequisite diagnosis
      const prereqDiagnosis = diagnosePrerequisiteGap(cleanConcept, state.conceptMastery);

      // Strain detection
      const detectedSignals: StruggleSignalType[] = [];
      if (responseTimeMs > 15000) detectedSignals.push('high_response_latency');
      if (record.consecutiveIncorrect >= 2) detectedSignals.push('repeated_errors');
      if (prereqDiagnosis.hasPrerequisiteGap) detectedSignals.push('prerequisite_gap');

      const latencyWeight = Math.min(0.5, responseTimeMs / 30000);
      const errorWeight = Math.min(0.5, record.consecutiveIncorrect * 0.25);
      const possibleStruggle = Math.min(1.0, Math.round((latencyWeight + errorWeight) * 100) / 100);
      const confidence = Math.min(1.0, Math.round((0.5 + Math.min(0.5, record.attempts * 0.1)) * 100) / 100);

      state.learningStrain = {
        possibleStruggle,
        confidence,
        signals: detectedSignals,
      };
      state.struggleSignal = possibleStruggle;
      state.cognitiveLoadScore = possibleStruggle;

      const intervention = decideIntervention({
        conceptId: cleanConcept,
        consecutiveIncorrect: record.consecutiveIncorrect,
        consecutiveCorrect: record.consecutiveCorrect,
        accuracyRate: record.accuracy,
        avgResponseTimeMs: responseTimeMs,
        prerequisiteDiagnosis: prereqDiagnosis,
        repeatedMistakeType: mistakeType,
        bestObservedStrategy: record.bestObservedStrategy,
      });

      state.activeInterventions[cleanConcept] = intervention;
      state.activePedagogy = intervention.strategy;

      let schedule = state.retentionSchedules[cleanConcept];
      if (!schedule) schedule = createInitialRetentionSchedule(cleanConcept);
      const qualityScore = isCorrect ? (responseTimeMs < 8000 ? 5 : 4) : 2;
      state.retentionSchedules[cleanConcept] = calculateNextReview(schedule, qualityScore);
    } else if (event.type === 'FEEDBACK_RECORDED' && event.payload) {
      const payload = event.payload as FeedbackRecordedPayload;
      const validStrategies: PedagogyStrategy[] = [
        'analogies',
        'scaffolded',
        'worked_example',
        'socratic',
        'advanced_rigor',
      ];
      const target = validStrategies.includes(payload.pedagogyUsed as PedagogyStrategy)
        ? (payload.pedagogyUsed as PedagogyStrategy)
        : state.activePedagogy;

      const m = state.pedagogyEffectiveness[target] || {
        helpfulCount: 0,
        unhelpfulCount: 0,
        score: 0.7,
      };

      if (payload.helpful) {
        m.helpfulCount += 1;
        m.score = Math.min(1.0, Math.round((m.score + 0.05) * 100) / 100);
      } else {
        m.unhelpfulCount += 1;
        m.score = Math.max(0.1, Math.round((m.score - 0.1) * 100) / 100);

        if (state.activePedagogy === target) {
          let bestScore = -1;
          let bestStrat: PedagogyStrategy = 'scaffolded';
          for (const s of validStrategies) {
            if (s !== target && state.pedagogyEffectiveness[s]?.score > bestScore) {
              bestScore = state.pedagogyEffectiveness[s].score;
              bestStrat = s;
            }
          }
          state.activePedagogy = bestStrat;
        }
      }
      state.pedagogyEffectiveness[target] = m;
      state.lastActiveTimestamp = event.timestamp;
    }
  }

  state.personalLearningModel = buildPersonalLearningModel(state);
  return state;
}