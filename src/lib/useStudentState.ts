/**
 * React hook for Cognify 2.0 Student State (Point 1 Integration)
 * Provides reactive access to the Unified Student State Engine.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  StudentState,
  StudentStateManager,
  getStudentStateManager,
  createInitialStudentState,
  isGuestUser,
} from './studentStateEngine';
import { InterventionDirective } from './interventionEngine';

export interface UseStudentStateResult {
  studentState: StudentState;
  manager: StudentStateManager | null;
  recordAnswer: (
    conceptId: string,
    isCorrect: boolean,
    responseTimeMs: number,
    mistakeType?: string
  ) => { state: StudentState; intervention?: InterventionDirective } | null;
  recordPedagogyFeedback: (
    pedagogy?: string,
    helpful?: boolean,
    conceptId?: string,
    reason?: string
  ) => StudentState | null;
  activeIntervention: InterventionDirective | null;
  activePedagogy: string;
  learningStrain: StudentState['learningStrain'];
  conceptMastery: StudentState['conceptMastery'];
  retentionSchedules: StudentState['retentionSchedules'];
  /**
   * True once the authoritative student state has resolved (instant for guests,
   * post-hydration for authenticated users). Prevents flashing 0-progress state.
   */
  isLoaded: boolean;
}

export function useStudentState(uid?: string, initialLevel?: string): UseStudentStateResult {
  const [state, setState] = useState<StudentState>(() => {
    if (!uid) return createInitialStudentState('guest', initialLevel);
    return getStudentStateManager(uid, initialLevel).getState();
  });

  const [isLoaded, setIsLoaded] = useState<boolean>(() => {
    if (!uid || isGuestUser(uid)) return true;
    return getStudentStateManager(uid, initialLevel).loaded;
  });

  useEffect(() => {
    if (!uid) {
      setIsLoaded(true);
      return;
    }
    const manager = getStudentStateManager(uid, initialLevel);
    setState(manager.getState());
    setIsLoaded(manager.loaded);

    const unsub = manager.subscribe((updated) => {
      setState(updated);
      setIsLoaded(manager.loaded);
    });

    return () => {
      unsub();
    };
  }, [uid, initialLevel]);

  const manager = uid ? getStudentStateManager(uid, initialLevel) : null;

  const recordAnswer = useCallback(
    (conceptId: string, isCorrect: boolean, responseTimeMs: number, mistakeType?: string) => {
      if (!manager) return null;
      return manager.recordAnswer(conceptId, isCorrect, responseTimeMs, mistakeType);
    },
    [manager]
  );

  const recordPedagogyFeedback = useCallback(
    (pedagogy?: string, helpful?: boolean, conceptId?: string, reason?: string) => {
      if (!manager) return null;
      return manager.recordPedagogyFeedback(pedagogy as any, helpful, conceptId, reason);
    },
    [manager]
  );

  const activeInterventions = state.activeInterventions || {};
  const interventionList = Object.values(activeInterventions);
  const activeIntervention = interventionList.length > 0 ? interventionList[0] : null;

  return {
    studentState: state,
    manager,
    recordAnswer,
    recordPedagogyFeedback,
    activeIntervention,
    activePedagogy: state.activePedagogy || 'scaffolded',
    learningStrain: state.learningStrain,
    conceptMastery: state.conceptMastery || {},
    retentionSchedules: state.retentionSchedules || {},
    isLoaded,
  };
}
