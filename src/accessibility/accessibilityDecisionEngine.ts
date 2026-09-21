/**
 * Cognify Accessibility 2.0 - Decision Engine
 * src/accessibility/accessibilityDecisionEngine.ts
 *
 * Implements:
 * 1. Adaptive Multi-Modal Decision Synthesis from interaction evidence & signals.
 * 2. 100% Student Agency Guard: Manual locks strictly block auto-application.
 * 3. Respectful Speech Clarification Guardrail (Confidence < 0.70, no hallucinated guesses).
 * 4. Multilingual AI Tutor Directives Synthesis (EN, AR, FR).
 * 5. Telemetry Observation Adaptation Bridge.
 */

import type {
  AccessibilityState,
  A11ySignal,
  ModalityDecision,
  SpeechClarificationResult,
  A11yTelemetryObservation,
} from './accessibilityTypes.js';
import {
  isPreferenceLocked,
  setManualPreference,
} from './accessibilityStateEngine.js';
import {
  enforceNonDiagnosticInvariant,
} from '../lib/accessibilityIntelligenceEngine.js';

let decisionCounter = 0;

function createDecision(
  targetPath: string,
  suggestedValue: any,
  confidence: number,
  rationale: string,
  state: AccessibilityState
): ModalityDecision {
  decisionCounter++;
  const locked = isPreferenceLocked(state, targetPath);
  const autoApply = state.adaptation.autoAdaptationEnabled && !locked;

  return {
    id: `dec_${Date.now()}_${decisionCounter}`,
    targetPath,
    suggestedValue,
    confidence,
    rationale,
    autoApplied: autoApply,
    blockedByLock: locked,
    timestamp: Date.now(),
  };
}

/**
 * Evaluates interaction signals against active student accessibility state to produce modality decisions.
 * Guarantees student agency: locked preferences will NEVER be auto-applied.
 */
export function evaluateAccessibilitySignals(
  state: AccessibilityState,
  signals: A11ySignal[]
): ModalityDecision[] {
  enforceNonDiagnosticInvariant(state);

  const decisions: ModalityDecision[] = [];
  if (!signals || signals.length === 0) return decisions;

  // Aggregate signals by type
  const tremorSignals = signals.filter(s => s.type === 'tremor_detected');
  const dwellSignals = signals.filter(s => s.type === 'dwell_exceeded');
  const ttsPlayedSignals = signals.filter(s => s.type === 'tts_played_full');
  const ttsInterruptedSignals = signals.filter(s => s.type === 'tts_interrupted');
  const captionSignals = signals.filter(s => s.type === 'captions_activated');
  const avatarSignals = signals.filter(s => s.type === 'sign_avatar_viewed');
  const contrastSignals = signals.filter(s => s.type === 'contrast_adjusted');

  // 1. Motor: Tremor & Dwell Decisions
  if (tremorSignals.length >= 1 || dwellSignals.length >= 2) {
    if (!state.motor.largeTargetMode) {
      decisions.push(createDecision(
        'motor.largeTargetMode',
        true,
        0.90,
        'Detected tremors and extended interaction dwell. Expanding touch target hitboxes.',
        state
      ));
    }
    if (state.motor.tremorDebounceMs < 450) {
      decisions.push(createDecision(
        'motor.tremorDebounceMs',
        450,
        0.88,
        'Increasing click debounce window to filter accidental tremors.',
        state
      ));
    }
  }

  // 2. Sensory: Audio / TTS Decisions
  if (ttsPlayedSignals.length >= 2 && ttsInterruptedSignals.length === 0) {
    if (!state.vision.ttsAutoNarration) {
      decisions.push(createDecision(
        'vision.ttsAutoNarration',
        true,
        0.92,
        'Consistent full listening to audio explanations without interruption.',
        state
      ));
    }
    if (state.communication.primaryModality !== 'audio') {
      decisions.push(createDecision(
        'communication.primaryModality',
        'audio',
        0.85,
        'Auditory explanations demonstrate highest engagement.',
        state
      ));
    }
  }

  // 3. Sensory: Captions & Sign Avatar Decisions
  if (captionSignals.length >= 2) {
    if (!state.hearing.captionsEnabled) {
      decisions.push(createDecision(
        'hearing.captionsEnabled',
        true,
        0.95,
        'Frequent activation of live subtitles and visual reading cues.',
        state
      ));
    }
    if (state.communication.primaryModality !== 'visual') {
      decisions.push(createDecision(
        'communication.primaryModality',
        'visual',
        0.87,
        'Visual captions are preferred for clear information intake.',
        state
      ));
    }
  }

  if (avatarSignals.length >= 1 && !state.hearing.showSignAvatar) {
    decisions.push(createDecision(
      'hearing.showSignAvatar',
      true,
      0.90,
      'Active visual inspection of sign language avatar animations.',
      state
    ));
  }

  // 4. Vision: Contrast Decisions
  if (contrastSignals.length >= 1 && state.vision.contrast !== 'high_contrast') {
    decisions.push(createDecision(
      'vision.contrast',
      'high_contrast',
      0.90,
      'Visual contrast toggled for legibility.',
      state
    ));
  }

  return decisions;
}

/**
 * Applies a set of modality decisions to an AccessibilityState, skipping any decision blocked by locks.
 */
export function applyModalityDecisions(
  state: AccessibilityState,
  decisions: ModalityDecision[]
): AccessibilityState {
  let next = JSON.parse(JSON.stringify(state)) as AccessibilityState;

  for (const decision of decisions) {
    if (decision.autoApplied && !decision.blockedByLock) {
      next = setManualPreference(next, decision.targetPath, decision.suggestedValue, false);
    }
  }

  next.adaptation.lastAdaptedTimestamp = Date.now();
  enforceNonDiagnosticInvariant(next);
  return next;
}

/**
 * Derives adaptive accessibility preferences based on empirical telemetry observations.
 * Strict Invariants:
 * 1. If autoAdaptationEnabled is false => zero mutations.
 * 2. Every key in manualLocks is 100% immutable against AI adaptation.
 * 3. Enforces Non-Diagnostic Invariant: only operational capabilities are adapted.
 */
export function deriveAdaptiveAccessibilityState(
  currentState: AccessibilityState,
  observations: A11yTelemetryObservation[]
): AccessibilityState {
  enforceNonDiagnosticInvariant(currentState);

  if (!currentState.adaptation.autoAdaptationEnabled || !observations || observations.length === 0) {
    return currentState;
  }

  const locks = currentState.adaptation.manualLocks || {};
  const next = JSON.parse(JSON.stringify(currentState)) as AccessibilityState;

  const totalDwell = observations.reduce((acc, o) => acc + (o.dwellTimeMs || 0), 0);
  const avgDwell = totalDwell / observations.length;

  const totalTremors = observations.reduce((acc, o) => acc + (o.tremorRetriesCount || 0), 0);
  const avgTremors = totalTremors / observations.length;

  const totalCaptions = observations.reduce((acc, o) => acc + (o.captionUsageSeconds || 0), 0);
  const totalAudio = observations.reduce((acc, o) => acc + (o.audioListenedSeconds || 0), 0);

  // 1. Motor & Input Adaptation
  if (!locks['motor.largeTargetMode'] && (avgTremors >= 1.5 || avgDwell > 3000)) {
    next.motor.largeTargetMode = true;
  }
  if (!locks['motor.tremorDebounceMs'] && avgTremors >= 2.0) {
    next.motor.tremorDebounceMs = 450;
  }

  // 2. Communication Pacing Adaptation
  if (!locks['communication.pacing']) {
    if (avgDwell < 1500) {
      next.communication.pacing = 'rapid';
    } else if (avgDwell > 4000) {
      next.communication.pacing = 'deliberate';
    } else {
      next.communication.pacing = 'standard';
    }
  }

  // 3. Sensory Modality Adaptation
  if (!locks['hearing.captionsEnabled'] && totalCaptions >= 20 && totalAudio < 5) {
    next.hearing.captionsEnabled = true;
    if (!locks['communication.primaryModality']) {
      next.communication.primaryModality = 'visual';
    }
  } else if (!locks['vision.ttsAutoNarration'] && totalAudio >= 20) {
    next.vision.ttsAutoNarration = true;
    if (!locks['communication.primaryModality']) {
      next.communication.primaryModality = 'audio';
    }
  }

  // Re-assert locks strictly
  if (locks['motor.largeTargetMode']) next.motor.largeTargetMode = currentState.motor.largeTargetMode;
  if (locks['motor.tremorDebounceMs']) next.motor.tremorDebounceMs = currentState.motor.tremorDebounceMs;
  if (locks['communication.pacing']) next.communication.pacing = currentState.communication.pacing;
  if (locks['hearing.captionsEnabled']) next.hearing.captionsEnabled = currentState.hearing.captionsEnabled;
  if (locks['vision.ttsAutoNarration']) next.vision.ttsAutoNarration = currentState.vision.ttsAutoNarration;
  if (locks['communication.primaryModality']) next.communication.primaryModality = currentState.communication.primaryModality;

  next.adaptation.lastAdaptedTimestamp = Date.now();
  enforceNonDiagnosticInvariant(next);
  return next;
}

/**
 * Generates respectful speech clarification options when voice recognition confidence drops below 0.70.
 * The AI tutor will NEVER pretend to understand ambiguous audio or invent wild hallucinations.
 */
export function generateSpeechClarificationPrompt(
  recognizedText: string,
  confidence: number,
  alternatives: string[] = [],
  lang: 'en' | 'ar' | 'fr' = 'en'
): SpeechClarificationResult {
  if (confidence >= 0.70 && recognizedText.trim().length > 0) {
    return {
      prompt: recognizedText,
      options: [],
      requiresClarification: false,
    };
  }

  if (lang === 'ar') {
    const options = alternatives.length > 0
      ? alternatives.slice(0, 3)
      : ['شرح المفهوم خطوة بخطوة', 'حل تمرين تطبيقي', 'إعادة صياغة السؤال كتابةً'];
    return {
      prompt: 'أود التأكد من أنني سمعتك بدقة. هل تقصد أحد الخيارات التالية؟',
      options,
      requiresClarification: true,
    };
  }

  if (lang === 'fr') {
    const options = alternatives.length > 0
      ? alternatives.slice(0, 3)
      : ['Expliquer le concept étape par étape', 'Pratiquer un exercice', 'Saisir la question par écrit'];
    return {
      prompt: 'Je souhaite m’assurer de vous avoir bien compris. Vouliez-vous dire :',
      options,
      requiresClarification: true,
    };
  }

  const options = alternatives.length > 0
    ? alternatives.slice(0, 3)
    : ['Explain the concept step-by-step', 'Practice an exercise', 'Type the question instead'];
  return {
    prompt: 'I want to make sure I understood you correctly. Did you mean:',
    options,
    requiresClarification: true,
  };
}

/**
 * Synthesizes dynamic AI system prompt directives from the student's active Accessibility State.
 * Decoupled from medical terms: provides operational instructions for modality, cadence, and visual anchors.
 */
export function synthesizeAccessibilityDirectives(
  state: AccessibilityState,
  lang: 'en' | 'ar' | 'fr' = 'en'
): string {
  enforceNonDiagnosticInvariant(state);

  const directives: string[] = [];

  // Modality & Phrasing
  if (state.communication.primaryModality === 'audio' || state.vision.ttsAutoNarration) {
    if (lang === 'ar') {
      directives.push('نسّق الإجابة للإلقاء الصوتي الطبيعي بجمل قصيرة وواضحة خالية من رموز ماركداون الزائدة.');
    } else if (lang === 'fr') {
      directives.push('Optimisez la formulation pour une narration audio fluide, avec des phrases courtes et sans symboles markdown superflus.');
    } else {
      directives.push('Format the response for natural spoken audio narration with clean, rhythmic sentences and no markdown clutter.');
    }
  } else if (state.communication.primaryModality === 'visual' || state.hearing.captionsEnabled) {
    if (lang === 'ar') {
      directives.push('نظّم الشرح في نقاط بصرية بارزة مع إبراز المفاهيم الأساسية بخط عريض.');
    } else if (lang === 'fr') {
      directives.push('Structurez l’explication avec des puces visuelles nettes et mettez en évidence les termes clés en gras.');
    } else {
      directives.push('Structure the explanation with prominent visual bullet points and highlight key concepts in bold.');
    }
  }

  // Response Length
  if (state.communication.responseLength === 'concise') {
    if (lang === 'ar') {
      directives.push('قدّم إجابات موجزة للغاية مع التركيز على جوهر المسألة دون استطراد.');
    } else if (lang === 'fr') {
      directives.push('Fournissez des réponses très concises, centrées sur l’essentiel sans digression.');
    } else {
      directives.push('Provide extremely concise answers, focusing strictly on core points without filler.');
    }
  }

  // Interaction Simplicity & Motor
  if (state.motor.largeTargetMode || state.motor.inputMethod === 'switch_access') {
    if (lang === 'ar') {
      directives.push('قسّم المسائل المعقدة إلى خطوات منفصلة واضحة مع إتاحة خيارات تفاعلية محددة.');
    } else if (lang === 'fr') {
      directives.push('Décomposez les problèmes complexes en étapes distinctes et numérotées avec des choix clairs.');
    } else {
      directives.push('Break complex problems into numbered, single-action sub-steps with clearly delineated choices.');
    }
  }

  return directives.join(' ');
}
