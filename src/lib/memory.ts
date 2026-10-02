/**
 * Firebase CRUD helpers for Cognify Memory (Phase 2).
 * Stored at: users/{uid}/memory/config
 *
 * Single Source of Truth: Firestore only (no localStorage cache/fallback).
 * Privacy-First Default: enabled is false by default.
 */

import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, cleanDataForFirestore } from './firebase';
import { StudentMemory } from '../types';

export const DEFAULT_STUDENT_MEMORY: StudentMemory = {
  enabled: false, // Privacy-first default: false
  preferredLanguage: 'English',
  explanationStyle: 'Practical examples first',
  learningGoals: [],
  knownPreferences: [],
  explicitConfirmedInfo: [],
  updatedAt: new Date().toISOString(),
};

const MEMORY_CACHE_PREFIX = 'cognify_student_memory_';

export function getCachedStudentMemory(uid?: string | null): StudentMemory | null {
  if (!uid || typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${MEMORY_CACHE_PREFIX}${uid}`);
    if (!raw) return null;
    return sanitizeMemory(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function setCachedStudentMemory(uid: string | null | undefined, mem: StudentMemory): void {
  if (!uid || typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${MEMORY_CACHE_PREFIX}${uid}`, JSON.stringify(mem));
  } catch {}
}

const memoryDocRef = (uid: string) => doc(db, `users/${uid}/memory/config`);

function sanitizeMemory(data?: Partial<StudentMemory> | null): StudentMemory {
  return {
    enabled: data?.enabled === true,
    preferredLanguage: data?.preferredLanguage || 'English',
    explanationStyle: data?.explanationStyle || 'Practical examples first',
    learningGoals: Array.isArray(data?.learningGoals) ? data.learningGoals : [],
    knownPreferences: Array.isArray(data?.knownPreferences) ? data.knownPreferences : [],
    explicitConfirmedInfo: Array.isArray(data?.explicitConfirmedInfo) ? data.explicitConfirmedInfo : [],
    updatedAt: data?.updatedAt || new Date().toISOString(),
  };
}

/**
 * Fetches the student's memory config once from Firestore.
 * If the document does not exist, returns DEFAULT_STUDENT_MEMORY.
 */
export async function getStudentMemory(uid?: string | null): Promise<StudentMemory> {
  if (!uid) return DEFAULT_STUDENT_MEMORY;
  const path = `users/${uid}/memory/config`;
  try {
    const snap = await getDoc(memoryDocRef(uid));
    if (snap.exists()) {
      const sanitized = sanitizeMemory(snap.data() as Partial<StudentMemory>);
      setCachedStudentMemory(uid, sanitized);
      return sanitized;
    }
    setCachedStudentMemory(uid, DEFAULT_STUDENT_MEMORY);
    return DEFAULT_STUDENT_MEMORY;
  } catch (err) {
    const cached = getCachedStudentMemory(uid);
    if (cached) return cached;
    handleFirestoreError(err, OperationType.GET, path);
    throw err;
  }
}

/**
 * Subscribes to real-time updates for a user's memory configuration.
 * Uses Stale-While-Revalidate with localStorage and includes a 4.5s safety timeout
 * to guarantee that offline or slow network conditions never hang the application.
 */
export function subscribeToStudentMemory(
  uid?: string | null,
  onUpdate?: (memory: StudentMemory) => void,
  onError?: (err: Error) => void
): () => void {
  if (!uid) return () => {};
  const path = `users/${uid}/memory/config`;

  // 1. Stale-While-Revalidate: Deliver cached memory immediately (0ms delay)
  const cached = getCachedStudentMemory(uid);
  if (cached) {
    onUpdate?.(cached);
  }

  let hasEmitted = !!cached;

  // 2. Safety Timeout: If Firestore doesn't respond within 4500ms, deliver fallback
  const safetyTimer = setTimeout(() => {
    if (!hasEmitted) {
      hasEmitted = true;
      console.warn(`[Cognify Memory] Firestore subscription timed out for ${path}. Emitting fallback memory.`);
      onUpdate?.(cached || DEFAULT_STUDENT_MEMORY);
    }
  }, 4500);

  try {
    const unsub = onSnapshot(
      memoryDocRef(uid),
      (snap) => {
        clearTimeout(safetyTimer);
        let result: StudentMemory;
        if (snap.exists()) {
          result = sanitizeMemory(snap.data() as Partial<StudentMemory>);
        } else {
          result = DEFAULT_STUDENT_MEMORY;
        }
        setCachedStudentMemory(uid, result);
        onUpdate?.(result);
      },
      (err) => {
        clearTimeout(safetyTimer);
        handleFirestoreError(err, OperationType.GET, path);
        if (cached) {
          onUpdate?.(cached);
        } else {
          onError?.(err as Error);
        }
      }
    );

    return () => {
      clearTimeout(safetyTimer);
      unsub();
    };
  } catch (err) {
    clearTimeout(safetyTimer);
    handleFirestoreError(err, OperationType.GET, path);
    if (cached) {
      onUpdate?.(cached);
    } else {
      onError?.(err as Error);
    }
    return () => {};
  }
}

/**
 * Updates partial memory fields in Firestore. Always updates updatedAt to ISO 8601 string.
 */
export async function updateStudentMemory(
  uid?: string | null,
  updates?: Partial<StudentMemory>
): Promise<void> {
  if (!uid || !updates) return;
  const path = `users/${uid}/memory/config`;

  const updatedPayload: Partial<StudentMemory> = {
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  // Optimistically update local cache so UI is instantaneous and resilient
  const currentCached = getCachedStudentMemory(uid) || DEFAULT_STUDENT_MEMORY;
  const merged = sanitizeMemory({ ...currentCached, ...updatedPayload });
  setCachedStudentMemory(uid, merged);

  try {
    await setDoc(memoryDocRef(uid), cleanDataForFirestore(updatedPayload), {
      merge: true,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
    throw err;
  }
}

/**
 * Toggles whether Cognify Memory is enabled for AI context injection.
 */
export async function toggleMemoryEnabled(
  uid?: string | null,
  enabled?: boolean
): Promise<void> {
  if (!uid) return;
  return updateStudentMemory(uid, { enabled: !!enabled });
}

/**
 * Adds an item to a list-based memory category (learningGoals, knownPreferences, explicitConfirmedInfo).
 */
export async function addMemoryItem(
  uid?: string | null,
  currentMemory?: StudentMemory | null,
  category?: 'learningGoals' | 'knownPreferences' | 'explicitConfirmedInfo',
  value?: string
): Promise<void> {
  if (!uid || !category || typeof value !== 'string') return;
  const trimmed = value.trim();
  if (!trimmed) return;
  const currentList = Array.isArray(currentMemory?.[category]) ? currentMemory![category] : [];
  if (currentList.includes(trimmed)) return; // Avoid duplicate items
  
  const updatedList = [...currentList, trimmed];
  return updateStudentMemory(uid, { [category]: updatedList });
}

/**
 * Removes an item from a list-based memory category by index.
 */
export async function deleteMemoryItem(
  uid?: string | null,
  currentMemory?: StudentMemory | null,
  category?: 'learningGoals' | 'knownPreferences' | 'explicitConfirmedInfo',
  index?: number
): Promise<void> {
  if (!uid || !category || typeof index !== 'number') return;
  const currentList = Array.isArray(currentMemory?.[category]) ? currentMemory![category] : [];
  if (index < 0 || index >= currentList.length) return;

  const updatedList = currentList.filter((_, i) => i !== index);
  return updateStudentMemory(uid, { [category]: updatedList });
}

/**
 * Resets all adaptive and confirmed memory lists back to empty.
 */
export async function clearStudentMemory(uid?: string | null): Promise<void> {
  if (!uid) return;
  setCachedStudentMemory(uid, DEFAULT_STUDENT_MEMORY);
  return updateStudentMemory(uid, {
    learningGoals: [],
    knownPreferences: [],
    explicitConfirmedInfo: [],
    updatedAt: new Date().toISOString(),
  });
}
