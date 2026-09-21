/**
 * Cognify 2.0 - Milestone 6: Proactive Learning Assistant Engine
 *
 * Detects timely pedagogical intervention and growth opportunities from
 * StudentState, concept mastery records, spaced retention schedules, and the PLM.
 *
 * Fully respects Student Agency:
 * - Accept: Launch actionable learning activity directly.
 * - Not Now (Snooze): Silence for 30 minutes without losing context.
 * - Dismiss: Dismiss for this session, concept, or specific opportunity.
 * - Disable Toggle: Student can completely turn off proactive prompts anytime.
 */

import { getConcept, diagnosePrerequisiteGap } from './conceptGraph.js';
import type { PedagogyStrategy, StudentState, ConceptMasteryRecord } from '../types/studentState.js';

export type ProactiveOpportunityType = 'retention_due' | 'repeated_struggle' | 'growth_challenge';

export interface ProactiveOpportunity {
  id: string;
  type: ProactiveOpportunityType;
  titleEn: string;
  titleAr: string;
  messageEn: string;
  messageAr: string;
  conceptId: string;
  conceptNameEn: string;
  conceptNameAr: string;
  recommendedAction: string;
  actionType: 'start_spaced_review' | 'revisit_prerequisite' | 'guided_walkthrough' | 'start_growth_challenge';
  priority: number; // 1 (highest urgency) to 10
  prerequisiteId?: string;
  prerequisiteNameEn?: string;
  prerequisiteNameAr?: string;
  suggestedStrategy?: PedagogyStrategy;
  metadata?: {
    daysOverdue?: number;
    consecutiveErrors?: number;
    consecutiveCorrect?: number;
    strainScore?: number;
    promptToInject?: string;
  };
  createdAt: number;
}

// In-Memory & LocalStorage Agency State
const STORAGE_DISMISSED_KEY = 'cognify_proactive_dismissed';
const STORAGE_SNOOZED_KEY = 'cognify_proactive_snoozed';
const STORAGE_ENABLED_KEY = 'cognify_proactive_enabled';

let memoryDismissed = new Set<string>();
let memorySnoozed = new Map<string, number>(); // id -> un-snooze timestamp
let memoryEnabled: boolean = true;

// Safe localStorage accessors that work in both Node.js (tests) and browser
function getLocalStorageItem(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
  } catch {
    // Ignore storage errors
  }
  return null;
}

function setLocalStorageItem(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
  } catch {
    // Ignore storage errors
  }
}

/**
 * Initializes and syncs agency state from storage if available.
 */
function syncStorageToMemory(): void {
  try {
    const enabledRaw = getLocalStorageItem(STORAGE_ENABLED_KEY);
    if (enabledRaw !== null) {
      memoryEnabled = enabledRaw === 'true';
    }

    const dismissedRaw = getLocalStorageItem(STORAGE_DISMISSED_KEY);
    if (dismissedRaw) {
      const parsed = JSON.parse(dismissedRaw);
      if (Array.isArray(parsed)) {
        memoryDismissed = new Set(parsed);
      }
    }

    const snoozedRaw = getLocalStorageItem(STORAGE_SNOOZED_KEY);
    if (snoozedRaw) {
      const parsed = JSON.parse(snoozedRaw);
      if (typeof parsed === 'object' && parsed !== null) {
        memorySnoozed = new Map(Object.entries(parsed));
      }
    }
  } catch {
    // Fall back to memory defaults
  }
}

// Sync on load
syncStorageToMemory();

/**
 * Checks if proactive suggestions are globally enabled.
 */
export function isProactiveEnabled(): boolean {
  return memoryEnabled;
}

/**
 * Toggles global proactive suggestions on or off.
 */
export function toggleProactiveSuggestions(enabled: boolean): void {
  memoryEnabled = enabled;
  setLocalStorageItem(STORAGE_ENABLED_KEY, String(enabled));
}

/**
 * Dismisses a proactive opportunity so it won't be shown again.
 *
 * @param id The opportunity ID or concept key
 * @param scope 'opportunity' (default) | 'concept' | 'session'
 */
export function dismissOpportunity(
  id: string,
  scope: 'opportunity' | 'concept' | 'session' = 'opportunity'
): void {
  const dismissKey = scope === 'concept' ? `concept_${id}` : id;
  memoryDismissed.add(dismissKey);
  try {
    setLocalStorageItem(STORAGE_DISMISSED_KEY, JSON.stringify(Array.from(memoryDismissed)));
  } catch {
    // Memory fallback
  }
}

/**
 * Snoozes an opportunity for a specified number of minutes (defaults to 30 mins).
 */
export function snoozeOpportunity(id: string, minutes: number = 30): void {
  const unSnoozeAt = Date.now() + minutes * 60 * 1000;
  memorySnoozed.set(id, unSnoozeAt);
  try {
    const obj: Record<string, number> = {};
    memorySnoozed.forEach((val, key) => {
      obj[key] = val;
    });
    setLocalStorageItem(STORAGE_SNOOZED_KEY, JSON.stringify(obj));
  } catch {
    // Memory fallback
  }
}

/**
 * Resets all user agency preferences (useful for tests or user preference resets).
 */
export function resetProactiveAgencyPreferences(): void {
  memoryDismissed.clear();
  memorySnoozed.clear();
  memoryEnabled = true;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_DISMISSED_KEY);
      localStorage.removeItem(STORAGE_SNOOZED_KEY);
      localStorage.removeItem(STORAGE_ENABLED_KEY);
    }
  } catch {
    // Ignore
  }
}

/**
 * Gets a copy of all currently dismissed opportunity IDs.
 */
export function getDismissedOpportunities(): Set<string> {
  return new Set(memoryDismissed);
}

/**
 * Gets a copy of all currently snoozed opportunity IDs with timestamps.
 */
export function getSnoozedOpportunities(): Map<string, number> {
  return new Map(memorySnoozed);
}

/**
 * Detects proactive learning opportunities from StudentState and PLM.
 *
 * @param state The canonical StudentState
 * @param now Current timestamp in milliseconds (defaults to Date.now())
 * @param options Configuration options (e.g. maxOpportunities)
 */
export function detectProactiveOpportunities(
  state: StudentState,
  now: number = Date.now(),
  options: { maxOpportunities?: number } = {}
): ProactiveOpportunity[] {
  if (!isProactiveEnabled()) {
    return [];
  }

  const maxOpportunities = options.maxOpportunities ?? 3;
  const opportunities: ProactiveOpportunity[] = [];

  // Clean expired snoozes
  for (const [id, expireTime] of memorySnoozed.entries()) {
    if (expireTime <= now) {
      memorySnoozed.delete(id);
    }
  }

  const isOpportunityActive = (id: string, conceptId: string): boolean => {
    if (memoryDismissed.has(id) || memoryDismissed.has(`concept_${conceptId}`)) {
      return false;
    }
    const snoozedUntil = memorySnoozed.get(id);
    if (snoozedUntil && snoozedUntil > now) {
      return false;
    }
    return true;
  };

  // --------------------------------------------------------------------------
  // TRIGGER 1: Repeated Struggle (Priority 1)
  // Consecutive errors >= 2 or strain > 0.6
  // --------------------------------------------------------------------------
  for (const [conceptId, record] of Object.entries(state.conceptMastery || {})) {
    const isStruggling =
      record.consecutiveIncorrect >= 2 ||
      (state.learningStrain?.possibleStruggle > 0.6 && record.accuracy < 0.6);

    if (isStruggling) {
      const oppId = `struggle_${conceptId}`;
      if (isOpportunityActive(oppId, conceptId)) {
        const node = getConcept(conceptId);
        const nameEn = node?.nameEn || conceptId.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        const nameAr = node?.nameAr || conceptId;

        // Check for prerequisite gap
        const prereqCheck = diagnosePrerequisiteGap(conceptId, state.conceptMastery);
        const hasGap = prereqCheck.hasPrerequisiteGap && prereqCheck.missingPrerequisites.length > 0;
        const missingNode = hasGap ? getConcept(prereqCheck.missingPrerequisites[0]) : undefined;

        if (hasGap && missingNode) {
          opportunities.push({
            id: oppId,
            type: 'repeated_struggle',
            titleEn: 'Targeted Concept Assistance',
            titleAr: 'مساعدة مستهدفة لتثبيت المفهوم',
            messageEn: `Having difficulty with ${nameEn}. Revisit prerequisite concept "${missingNode.nameEn}"?`,
            messageAr: `تواجه صعوبة في ${nameAr}. هل نراجع المفهوم التمهيدي "${missingNode.nameAr}" أولاً؟`,
            conceptId,
            conceptNameEn: nameEn,
            conceptNameAr: nameAr,
            recommendedAction: `Review ${missingNode.nameEn}`,
            actionType: 'revisit_prerequisite',
            priority: 1,
            prerequisiteId: missingNode.id,
            prerequisiteNameEn: missingNode.nameEn,
            prerequisiteNameAr: missingNode.nameAr,
            suggestedStrategy: 'scaffolded',
            metadata: {
              consecutiveErrors: record.consecutiveIncorrect,
              strainScore: state.learningStrain?.possibleStruggle,
              promptToInject: `أواجه صعوبة في ${nameAr}. أريد مراجعة المفهوم التمهيدي (${missingNode.nameAr}) بخطوات مبسطة.`,
            },
            createdAt: now,
          });
        } else {
          opportunities.push({
            id: oppId,
            type: 'repeated_struggle',
            titleEn: 'Targeted Concept Assistance',
            titleAr: 'مساعدة مستهدفة لتثبيت المفهوم',
            messageEn: `Having difficulty with ${nameEn}. Walk through a step-by-step worked example?`,
            messageAr: `تواجه صعوبة في ${nameAr}. هل ننتقل لمسألة نموذجية محلولة خطوة بخطوة؟`,
            conceptId,
            conceptNameEn: nameEn,
            conceptNameAr: nameAr,
            recommendedAction: `Start Worked Example`,
            actionType: 'guided_walkthrough',
            priority: 1,
            suggestedStrategy: 'worked_example',
            metadata: {
              consecutiveErrors: record.consecutiveIncorrect,
              strainScore: state.learningStrain?.possibleStruggle,
              promptToInject: `أحتاج إلى مثال تطبيقي محلول خطوة بخطوة لمفهوم (${nameAr}) لتوضيح طريقة الحل.`,
            },
            createdAt: now,
          });
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // TRIGGER 2: Retention Due (Priority 2)
  // Overdue spaced review based on SM-2 schedules
  // --------------------------------------------------------------------------
  for (const [conceptId, sched] of Object.entries(state.retentionSchedules || {})) {
    const nextReviewMs =
      typeof sched.nextReviewDate === 'number'
        ? sched.nextReviewDate
        : sched.nextReviewDate
        ? new Date(sched.nextReviewDate).getTime()
        : 0;

    const isOverdue = (nextReviewMs > 0 && nextReviewMs <= now) || (sched as any).isOverdue === true;
    const daysOverdue = nextReviewMs > 0 && now > nextReviewMs
      ? Math.max(1, Math.round((now - nextReviewMs) / (1000 * 60 * 60 * 24)))
      : (sched.intervalDays || 1);

    if (isOverdue) {
      const oppId = `retention_${conceptId}`;
      if (isOpportunityActive(oppId, conceptId)) {
        const node = getConcept(conceptId);
        const nameEn = node?.nameEn || conceptId.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        const nameAr = node?.nameAr || conceptId;

        opportunities.push({
          id: oppId,
          type: 'retention_due',
          titleEn: 'Retention Review Due',
          titleAr: 'مراجعة التثبيت مستحقة',
          messageEn: `You haven't reviewed ${nameEn} in ${daysOverdue} ${daysOverdue === 1 ? 'day' : 'days'}. Ready for a 2-minute review?`,
          messageAr: `لم تراجع ${nameAr} منذ ${daysOverdue} ${daysOverdue === 1 ? 'يوم' : 'أيام'}. هل أنت مستعد لمراجعة سريعة لمدة دقيقتين؟`,
          conceptId,
          conceptNameEn: nameEn,
          conceptNameAr: nameAr,
          recommendedAction: `Start 2-Minute Review`,
          actionType: 'start_spaced_review',
          priority: 2,
          suggestedStrategy: 'socratic',
          metadata: {
            daysOverdue,
            promptToInject: `أريد مراجعة استرجاع سريعة مدتها دقيقتان لتثبيت مفهوم (${nameAr}). اطرح عليّ سؤالاً مباشراً.`,
          },
          createdAt: now,
        });
      }
    }
  }

  // --------------------------------------------------------------------------
  // TRIGGER 3: Growth Challenge (Priority 3)
  // Mastered concept with 3+ consecutive correct solutions
  // --------------------------------------------------------------------------
  for (const [conceptId, record] of Object.entries(state.conceptMastery || {})) {
    const isMasteredStreak =
      record.consecutiveCorrect >= 3 || (record.accuracy >= 0.8 && record.attempts >= 3 && record.consecutiveCorrect >= 2);

    if (isMasteredStreak) {
      const oppId = `growth_${conceptId}`;
      if (isOpportunityActive(oppId, conceptId)) {
        const node = getConcept(conceptId);
        const nameEn = node?.nameEn || conceptId.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        const nameAr = node?.nameAr || conceptId;

        opportunities.push({
          id: oppId,
          type: 'growth_challenge',
          titleEn: 'Growth Challenge Opportunity',
          titleAr: 'فرصة لتحدٍ معرفي متقدم',
          messageEn: `Mastered ${nameEn} with ${record.consecutiveCorrect} consecutive correct solutions. Ready for a harder exercise?`,
          messageAr: `أتقنت ${nameAr} بـ ${record.consecutiveCorrect} إجابات صحيحة متتالية. هل أنت مستعد لتحدٍ أصعب؟`,
          conceptId,
          conceptNameEn: nameEn,
          conceptNameAr: nameAr,
          recommendedAction: `Launch Advanced Challenge`,
          actionType: 'start_growth_challenge',
          priority: 3,
          suggestedStrategy: 'advanced_rigor',
          metadata: {
            consecutiveCorrect: record.consecutiveCorrect,
            promptToInject: `أتقنت الأساسيات في ${nameAr}. قدّم لي مسألة تحدٍ متقدمة ذات مستوى صعوبة أعلى لاختبار حدود فهمي.`,
          },
          createdAt: now,
        });
      }
    }
  }

  // Sort by priority ascending (1 is highest urgency), then by creation timestamp
  opportunities.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return b.createdAt - a.createdAt;
  });

  return opportunities.slice(0, maxOpportunities);
}
