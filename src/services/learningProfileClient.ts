/**
 * Learning Profile Client Service & React Hook
 * Phase 2C - Sprint 1 (Intelligence -> Product)
 *
 * Provides a resilient client interface for retrieving and reactively subscribing
 * to the canonical PersonalLearningProfile contract.
 *
 * Backend/Domain service is the single source of truth.
 * Includes graceful offline fallback to local StudentStateManager so the UI
 * is instantly responsive, zero-latency, and offline-resilient.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { PersonalLearningProfile, StudentState } from '../types/studentState';
import {
  getStudentStateManager,
  createInitialStudentState,
} from '../lib/studentStateEngine';
import { getApiUrl } from '../config/api';

export interface UseLearningProfileResult {
  profile: PersonalLearningProfile;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Fetches the canonical PersonalLearningProfile from the backend endpoint,
 * falling back to local StudentStateManager if offline or network unavailable.
 */
export async function fetchPersonalLearningProfile(
  uid?: string,
  displayName?: string,
  liveState?: StudentState
): Promise<PersonalLearningProfile> {
  const effectiveUid = uid || 'guest';
  const manager = getStudentStateManager(effectiveUid);

  try {
    const response = await fetch(getApiUrl('/api/student/learningProfile'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uid: effectiveUid,
        displayName,
        studentState: liveState || manager.getState(),
      }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success && data.profile) {
        return data.profile as PersonalLearningProfile;
      }
    }
  } catch (err) {
    // Network unavailable or offline - safely fallback to local domain manager
    console.warn('[learningProfileClient] Network fetch failed, using local domain manager:', err);
  }

  // Authoritative local fallback
  return manager.getPersonalLearningProfile(displayName);
}

/**
 * Reactive hook that provides the student's personal learning profile.
 * Automatically stays synchronized with exercise completions, feedback,
 * and adaptive interventions.
 */
export function useLearningProfile(
  uid?: string,
  displayName?: string,
  liveState?: StudentState
): UseLearningProfileResult {
  const effectiveUid = uid || 'guest';
  const manager = getStudentStateManager(effectiveUid);

  const [profile, setProfile] = useState<PersonalLearningProfile>(() => {
    return manager.getPersonalLearningProfile(displayName);
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const updated = await fetchPersonalLearningProfile(effectiveUid, displayName, liveState);
      if (isMountedRef.current) {
        setProfile(updated);
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        setError(err.message || 'Failed to refresh learning profile');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [effectiveUid, displayName, liveState]);

  useEffect(() => {
    isMountedRef.current = true;

    // Immediately render current state
    setProfile(manager.getPersonalLearningProfile(displayName));

    // Subscribe to real-time learning events and state changes
    const unsubscribe = manager.subscribe(() => {
      if (isMountedRef.current) {
        setProfile(manager.getPersonalLearningProfile(displayName));
      }
    });

    // Optionally re-sync from backend API in background
    refresh();

    return () => {
      isMountedRef.current = false;
      unsubscribe();
    };
  }, [effectiveUid, displayName, manager, refresh]);

  return {
    profile,
    loading,
    error,
    refresh,
  };
}
