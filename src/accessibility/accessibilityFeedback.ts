/**
 * Cognify Accessibility 2.0 - Feedback & Efficacy Metrics Engine
 * src/accessibility/accessibilityFeedback.ts
 *
 * Implements:
 * 1. Accessibility Feedback Collection & Acceptance Rate Tracking.
 * 2. Measurable Learning Completion Rate Delta Calculations.
 * 3. Efficacy Scoring & Pedagogical Telemetry Reporting.
 */

import type {
  AccessibilityState,
  A11yFeedbackRecord,
} from './accessibilityTypes.js';

/**
 * Records student feedback on an accessibility adaptation (e.g. accepted audio explanation).
 * Calculates empirical completion gain delta.
 */
export function recordAccessibilityFeedback(
  state: AccessibilityState,
  adaptationKey: string,
  accepted: boolean,
  completionDelta: number = 0.0
): AccessibilityState {
  const next = JSON.parse(JSON.stringify(state)) as AccessibilityState;

  next.feedback.adaptationsSuggestedCount = (next.feedback.adaptationsSuggestedCount || 0) + 1;
  if (accepted) {
    next.feedback.adaptationsAcceptedCount = (next.feedback.adaptationsAcceptedCount || 0) + 1;
  }

  if (completionDelta !== 0) {
    const prevDelta = next.feedback.completionRateDelta || 0.0;
    next.feedback.completionRateDelta = parseFloat(((prevDelta + completionDelta) / 2).toFixed(3));
  }

  return next;
}

/**
 * Creates a structured feedback record for persistence or telemetry logging.
 */
export function createFeedbackRecord(
  decisionId: string,
  targetPath: string,
  accepted: boolean,
  completionDelta: number = 0.0
): A11yFeedbackRecord {
  return {
    decisionId,
    targetPath,
    accepted,
    completionDelta,
    timestamp: Date.now(),
  };
}

/**
 * Computes high-level efficacy metrics from the student's accessibility feedback state.
 */
export function computeEfficacyMetrics(state: AccessibilityState): {
  acceptanceRate: number;
  completionRateDelta: number;
  totalSuggested: number;
  totalAccepted: number;
  efficacyScore: number;
} {
  const suggested = state.feedback?.adaptationsSuggestedCount || 0;
  const accepted = state.feedback?.adaptationsAcceptedCount || 0;
  const delta = state.feedback?.completionRateDelta || 0.0;

  const acceptanceRate = suggested > 0 ? accepted / suggested : 1.0;
  // Efficacy score is weighted blend of acceptance (60%) and positive task completion delta (40%)
  const normalizedDelta = Math.max(0.0, Math.min(1.0, 0.5 + delta));
  const efficacyScore = parseFloat((acceptanceRate * 0.6 + normalizedDelta * 0.4).toFixed(3));

  return {
    acceptanceRate: parseFloat(acceptanceRate.toFixed(3)),
    completionRateDelta: delta,
    totalSuggested: suggested,
    totalAccepted: accepted,
    efficacyScore,
  };
}
