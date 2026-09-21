/**
 * Event-Driven Architecture & Persistent Event Store for Cognify 2.0 (Point 24)
 * Decouples learning modules, analytics, and adaptation engines through strongly typed events.
 * Persists all events to Cloud Firestore under users/{uid}/learningEvents/{eventId} with a 5-second
 * debounce window to protect Firebase Spark tier quotas.
 */

import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  orderBy,
  limit as firestoreLimit,
} from 'firebase/firestore';
import { db, cleanDataForFirestore } from './firebase';

export type LearningEventType =
  | 'EXERCISE_ANSWERED'
  | 'LESSON_STARTED'
  | 'LESSON_COMPLETED'
  | 'HINT_REQUESTED'
  | 'CONCEPT_MASTERED'
  | 'CONCEPT_REGRESSED'
  | 'INTERVENTION_TRIGGERED'
  | 'EVALUATION_COMPLETED'
  | 'FEEDBACK_RECORDED';

export interface LearningEvent<T = any> {
  id: string;
  type: LearningEventType;
  uid: string;
  timestamp: number;
  payload: T;
}

export interface ExerciseAnsweredPayload {
  subject: string;
  topic: string;
  conceptId?: string;
  isCorrect: boolean;
  responseTimeMs: number;
  difficulty: 'easy' | 'medium' | 'hard';
  mistakeType?: string;
}

export interface InterventionTriggeredPayload {
  conceptId: string;
  strategy: 'analogies' | 'scaffolded' | 'worked_example' | 'socratic' | 'advanced_rigor';
  reason: string;
}

export interface EvaluationCompletedPayload {
  conceptId: string;
  preScore: number;
  postScore: number;
  normalizedGain: number;
}

export interface FeedbackRecordedPayload {
  messageId: string;
  conceptId?: string;
  pedagogyUsed?: string;
  helpful: boolean;
  reason?: string;
}

export function isGuestUser(uid?: string | null): boolean {
  return !uid || uid === 'guest' || uid === 'anonymous' || uid === 'demo';
}

type EventListener = (event: LearningEvent) => void;

/**
 * Persistent Learning Event Store Manager
 * Buffers emitted events in-memory and in local storage, flushing to Firestore
 * after 5000ms debounce to strictly respect Firebase Spark tier daily write limits.
 */
class PersistentLearningEventStore {
  private pendingQueue: LearningEvent[] = [];
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private isFlushing: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.flushSync();
      });
    }
  }

  public recordEvent(event: LearningEvent): void {
    // 1. Always append to local device cache for fast replay & offline resilience
    this.appendLocalCache(event);

    // 2. Guest / Unauthenticated users bypass remote Firestore network writes
    if (isGuestUser(event.uid)) {
      return;
    }

    // 3. Queue for debounced batch persistence
    this.pendingQueue.push(event);

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.flushPendingEvents();
    }, 5000);
  }

  public async flushPendingEvents(): Promise<void> {
    if (this.isFlushing || this.pendingQueue.length === 0) return;
    this.isFlushing = true;

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    const eventsToSave = [...this.pendingQueue];
    this.pendingQueue = [];

    try {
      // Write events to users/{uid}/learningEvents/{eventId}
      for (const evt of eventsToSave) {
        if (!evt.uid || isGuestUser(evt.uid)) continue;
        const eventRef = doc(db, 'users', evt.uid, 'learningEvents', evt.id);
        const cleanPayload = cleanDataForFirestore(evt);
        await setDoc(eventRef, cleanPayload, { merge: true });
      }
    } catch (err) {
      console.warn('[EventStore] Error persisting learning events to Firestore:', err);
      // Re-queue failed items at front of queue for next attempt
      this.pendingQueue = [...eventsToSave, ...this.pendingQueue];
    } finally {
      this.isFlushing = false;
    }
  }

  private flushSync(): void {
    if (this.pendingQueue.length === 0) return;
    // Attempt best-effort flush before page closes
    this.flushPendingEvents().catch(() => {});
  }

  private appendLocalCache(event: LearningEvent): void {
    if (typeof window === 'undefined') return;
    try {
      const key = `cognify_events_${event.uid}`;
      const raw = localStorage.getItem(key);
      const list: LearningEvent[] = raw ? JSON.parse(raw) : [];
      list.push(event);
      // Keep last 150 events in local cache to prevent quota overflow
      const trimmed = list.slice(-150);
      localStorage.setItem(key, JSON.stringify(trimmed));
    } catch {
      // Safe fallback if localStorage is full or disabled
    }
  }

  public getLocalEvents(uid: string): LearningEvent[] {
    if (typeof window === 'undefined') return [];
    try {
      const key = `cognify_events_${uid}`;
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  public clearLocalEvents(uid: string): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(`cognify_events_${uid}`);
    } catch {}
  }
}

export const eventStore = new PersistentLearningEventStore();

class LearningEventBus {
  private listeners: Map<LearningEventType, Set<EventListener>> = new Map();

  public on(type: LearningEventType, callback: EventListener): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(callback);
    return () => {
      this.listeners.get(type)?.delete(callback);
    };
  }

  public emit<T>(type: LearningEventType, uid: string, payload: T): LearningEvent<T> {
    const event: LearningEvent<T> = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type,
      uid,
      timestamp: Date.now(),
      payload,
    };

    // 1. Dispatch synchronously to all in-memory listeners
    const handlers = this.listeners.get(type);
    if (handlers) {
      handlers.forEach((h) => {
        try {
          h(event);
        } catch (err) {
          console.error(`[EventBus] Error in handler for ${type}:`, err);
        }
      });
    }

    // 2. Persist to Event Store (local cache + Firestore subcollection with 5s debounce)
    eventStore.recordEvent(event);

    return event;
  }
}

export const eventBus = new LearningEventBus();

/**
 * Retrieves the historical stream of learning events for a student.
 * Reads from local cache first, augmented with remote Firestore events.
 */
export async function getLearningEventHistory(uid: string, limitCount = 50): Promise<LearningEvent[]> {
  const localEvents = eventStore.getLocalEvents(uid);

  if (isGuestUser(uid)) {
    return localEvents.slice(-limitCount);
  }

  try {
    const eventsCol = collection(db, 'users', uid, 'learningEvents');
    const q = query(eventsCol, orderBy('timestamp', 'desc'), firestoreLimit(limitCount));
    const snap = await getDocs(q);

    const remoteEvents: LearningEvent[] = [];
    snap.forEach((docSnap) => {
      remoteEvents.push(docSnap.data() as LearningEvent);
    });

    // Merge unique events by id
    const map = new Map<string, LearningEvent>();
    localEvents.forEach((e) => map.set(e.id, e));
    remoteEvents.forEach((e) => map.set(e.id, e));

    return Array.from(map.values())
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-limitCount);
  } catch (err) {
    console.warn('[EventStore] Failed to fetch remote learning events:', err);
    return localEvents.slice(-limitCount);
  }
}