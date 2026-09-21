/**
 * Cognify Accessibility 2.0 - State Engine
 * src/accessibility/accessibilityStateEngine.ts
 *
 * Implements:
 * 1. Default State Creation & State Normalization.
 * 2. 100% Student Agency & Manual Lock Protection (Immutable against AI override).
 * 3. Non-Diagnostic Invariant Validation (Strict capability modeling, 0 clinical labels).
 * 4. Local Storage & In-Memory State Caching.
 */

import type {
  AccessibilityState,
  AccessibilityVisionPreferences,
  AccessibilityHearingPreferences,
  AccessibilityMotorPreferences,
  AccessibilitySpeechPreferences,
  AccessibilityCommunicationPreferences,
  AccessibilityAdaptationControl,
  AccessibilityFeedbackMetrics,
} from './accessibilityTypes.js';
import {
  enforceNonDiagnosticInvariant,
  validateNonDiagnosticInvariant,
} from '../lib/accessibilityIntelligenceEngine.js';

export const DEFAULT_VISION_PREFERENCES: AccessibilityVisionPreferences = {
  preferredTextScale: '100%',
  contrast: 'standard',
  screenReaderOptimized: false,
  ttsAutoNarration: false,
  simplifyVisualNoise: false,
};

export const DEFAULT_HEARING_PREFERENCES: AccessibilityHearingPreferences = {
  captionsEnabled: false,
  captionStyle: 'standard',
  visualAlertsEnabled: true,
  audioIndependenceRequired: false,
  showSignAvatar: false,
};

export const DEFAULT_MOTOR_PREFERENCES: AccessibilityMotorPreferences = {
  inputMethod: 'standard_touch_mouse',
  dwellTimeMs: 1200,
  tremorDebounceMs: 250,
  largeTargetMode: false,
  rowColumnScanIntervalMs: 1000,
};

export const DEFAULT_SPEECH_PREFERENCES: AccessibilitySpeechPreferences = {
  inputMode: 'standard_speech',
  clarificationConfidenceThreshold: 0.70,
  lastRecognitionConfidence: 1.0,
};

export const DEFAULT_COMMUNICATION_PREFERENCES: AccessibilityCommunicationPreferences = {
  primaryModality: 'text',
  responseLength: 'balanced',
  pacing: 'standard',
};

export const DEFAULT_ADAPTATION_CONTROL: AccessibilityAdaptationControl = {
  autoAdaptationEnabled: true,
  manualLocks: {},
  lastAdaptedTimestamp: Date.now(),
};

export const DEFAULT_FEEDBACK_METRICS: AccessibilityFeedbackMetrics = {
  adaptationsSuggestedCount: 0,
  adaptationsAcceptedCount: 0,
  completionRateDelta: 0.0,
};

/**
 * Creates default initial Accessibility State for a student.
 */
export function createDefaultAccessibilityState(userId: string): AccessibilityState {
  return {
    version: 2,
    userId: userId || 'anonymous_student',
    vision: { ...DEFAULT_VISION_PREFERENCES },
    hearing: { ...DEFAULT_HEARING_PREFERENCES },
    motor: { ...DEFAULT_MOTOR_PREFERENCES },
    speech: { ...DEFAULT_SPEECH_PREFERENCES },
    communication: { ...DEFAULT_COMMUNICATION_PREFERENCES },
    adaptation: { ...DEFAULT_ADAPTATION_CONTROL, manualLocks: {} },
    feedback: { ...DEFAULT_FEEDBACK_METRICS },
  };
}

/**
 * Normalizes partial or legacy accessibility state into a fully compliant AccessibilityState v2.
 */
export function normalizeAccessibilityState(
  partial: Partial<AccessibilityState> | undefined | null,
  userId: string
): AccessibilityState {
  const base = createDefaultAccessibilityState(userId);
  if (!partial) return base;

  enforceNonDiagnosticInvariant(partial);

  return {
    version: 2,
    userId: partial.userId || userId || base.userId,
    vision: { ...base.vision, ...(partial.vision || {}) },
    hearing: { ...base.hearing, ...(partial.hearing || {}) },
    motor: { ...base.motor, ...(partial.motor || {}) },
    speech: { ...base.speech, ...(partial.speech || {}) },
    communication: { ...base.communication, ...(partial.communication || {}) },
    adaptation: {
      ...base.adaptation,
      ...(partial.adaptation || {}),
      manualLocks: { ...(partial.adaptation?.manualLocks || {}) },
    },
    feedback: { ...base.feedback, ...(partial.feedback || {}) },
  };
}

/**
 * Checks whether a specific preference path is manually locked by the student.
 * If locked, the AI decision engine is strictly forbidden from auto-altering it.
 */
export function isPreferenceLocked(state: AccessibilityState, path: string): boolean {
  return Boolean(state.adaptation.manualLocks?.[path]);
}

/**
 * Sets a manual user preference and optionally locks it against automatic AI adaptation.
 * Guarantees 100% Student Agency.
 */
export function setManualPreference(
  state: AccessibilityState,
  path: string,
  value: any,
  lock: boolean = true
): AccessibilityState {
  const check = validateNonDiagnosticInvariant({ [path]: value });
  if (!check.valid) {
    throw new Error(`[Accessibility Invariant Violation]: ${check.violations.join('; ')}`);
  }

  const next = JSON.parse(JSON.stringify(state)) as AccessibilityState;
  const parts = path.split('.');

  let curr: any = next;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!curr[parts[i]]) curr[parts[i]] = {};
    curr = curr[parts[i]];
  }
  curr[parts[parts.length - 1]] = value;

  if (lock) {
    next.adaptation.manualLocks[path] = true;
  } else {
    delete next.adaptation.manualLocks[path];
  }

  next.adaptation.lastAdaptedTimestamp = Date.now();
  return next;
}

/**
 * Removes a manual lock from a preference path, restoring AI adaptation freedom.
 */
export function unlockPreference(state: AccessibilityState, path: string): AccessibilityState {
  return setManualPreference(state, path, getPreferenceByPath(state, path), false);
}

/**
 * Helper to retrieve a nested property value by dot-notation path.
 */
export function getPreferenceByPath(state: AccessibilityState, path: string): any {
  const parts = path.split('.');
  let curr: any = state;
  for (const part of parts) {
    if (curr === undefined || curr === null) return undefined;
    curr = curr[part];
  }
  return curr;
}

/**
 * Backward compatibility alias for setManualPreference.
 */
export const setManualAccessibilityPreference = setManualPreference;

/**
 * Loads stored accessibility state from device storage, falling back to defaults.
 */
export function loadStoredAccessibilityState(userId: string): AccessibilityState {
  const key = `cognify_a11y_state_v2_${userId || 'anonymous'}`;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        return normalizeAccessibilityState(parsed, userId);
      }
    }
  } catch {
    // Non-fatal, fallback to default
  }
  return createDefaultAccessibilityState(userId);
}

/**
 * Persists accessibility state to device storage.
 */
export function persistAccessibilityState(state: AccessibilityState): void {
  const key = `cognify_a11y_state_v2_${state.userId || 'anonymous'}`;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, JSON.stringify(state));
    }
  } catch {
    // Non-fatal
  }
}
