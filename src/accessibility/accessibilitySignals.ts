/**
 * Cognify Accessibility 2.0 - Signal Extraction & Buffer Engine
 * src/accessibility/accessibilitySignals.ts
 *
 * Extracts and temporal-buffers interaction signals across all modalities:
 * - Vision (screen reader, contrast, zoom, visual noise)
 * - Audio / Voice / TTS (playback completion, interrupt, repetition)
 * - Speech Recognition (confidence scores, acoustic alternatives, background noise)
 * - Captions (reading duration, speed toggles, live transcript engagement)
 * - Motor & Switch Access (dwell latency, tremor retries, single-switch pulses)
 * - Sign Avatar (3D avatar viewing duration, signing speed, fingerspelling)
 */

import type { A11ySignal, A11ySignalType } from './accessibilityTypes.js';

let signalCounter = 0;

/**
 * Creates a structured accessibility interaction signal.
 */
export function createAccessibilitySignal(
  type: A11ySignalType,
  confidence: number = 1.0,
  modality: 'vision' | 'hearing' | 'motor' | 'speech' | 'communication' = 'communication',
  data?: Record<string, any>
): A11ySignal {
  signalCounter++;
  return {
    id: `sig_${Date.now()}_${signalCounter}`,
    type,
    timestamp: Date.now(),
    confidence: Math.max(0.0, Math.min(1.0, confidence)),
    modality,
    data,
  };
}

/**
 * Extracts signals from Vision Companion and visual rendering interactions.
 */
export function extractVisionSignals(events: {
  zoomUsed?: boolean;
  contrastToggled?: boolean;
  screenReaderRequested?: boolean;
  visualNoiseReduced?: boolean;
}): A11ySignal[] {
  const signals: A11ySignal[] = [];

  if (events.screenReaderRequested) {
    signals.push(createAccessibilitySignal('visual_reader_requested', 1.0, 'vision'));
  }
  if (events.contrastToggled) {
    signals.push(createAccessibilitySignal('contrast_adjusted', 1.0, 'vision'));
  }
  if (events.zoomUsed) {
    signals.push(createAccessibilitySignal('zoom_requested', 0.9, 'vision'));
  }
  if (events.visualNoiseReduced) {
    signals.push(createAccessibilitySignal('visual_noise_reduced', 0.85, 'vision'));
  }

  return signals;
}

/**
 * Extracts signals from Voice / TTS audio playback lifecycle.
 */
export function extractTtsSignals(
  playedSeconds: number,
  durationSeconds: number,
  interrupted: boolean = false
): A11ySignal[] {
  const signals: A11ySignal[] = [];
  const ratio = durationSeconds > 0 ? playedSeconds / durationSeconds : 1.0;

  if (interrupted && ratio < 0.3) {
    signals.push(createAccessibilitySignal('tts_interrupted', 0.85, 'vision', { playedSeconds, ratio }));
  } else if (playedSeconds >= 15 || ratio >= 0.8) {
    signals.push(createAccessibilitySignal('tts_played_full', 0.95, 'vision', { playedSeconds, ratio }));
  }

  return signals;
}

/**
 * Extracts signals from Speech Recognition (STT) input.
 */
export function extractSpeechSignals(
  confidence: number,
  transcript?: string,
  noiseLevel?: number
): A11ySignal[] {
  const signals: A11ySignal[] = [];

  if (confidence < 0.70) {
    signals.push(createAccessibilitySignal(
      'speech_low_confidence',
      1.0 - confidence,
      'speech',
      { confidence, transcript: transcript?.slice(0, 50), noiseLevel }
    ));
  } else {
    signals.push(createAccessibilitySignal(
      'speech_high_confidence',
      confidence,
      'speech',
      { confidence, transcriptLength: transcript?.length }
    ));
  }

  return signals;
}

/**
 * Extracts signals from Live Captions interactions.
 */
export function extractCaptionSignals(
  readingDurationMs: number,
  characterCount: number,
  activated: boolean = true
): A11ySignal[] {
  const signals: A11ySignal[] = [];

  if (activated) {
    signals.push(createAccessibilitySignal('captions_activated', 1.0, 'hearing', {
      readingDurationMs,
      characterCount,
    }));
  } else {
    signals.push(createAccessibilitySignal('captions_dismissed', 0.9, 'hearing'));
  }

  return signals;
}

/**
 * Extracts signals from Motor / Switch access interactions (dwell times, tremors, switch hits).
 */
export function extractMotorSignals(
  dwellTimesMs: number[],
  tremorRetries: number,
  switchHits?: number
): A11ySignal[] {
  const signals: A11ySignal[] = [];
  const avgDwell = dwellTimesMs.length > 0
    ? dwellTimesMs.reduce((a, b) => a + b, 0) / dwellTimesMs.length
    : 0;

  if (tremorRetries >= 2) {
    signals.push(createAccessibilitySignal(
      'tremor_detected',
      Math.min(1.0, 0.5 + tremorRetries * 0.15),
      'motor',
      { tremorRetries }
    ));
  }

  if (avgDwell > 3000) {
    signals.push(createAccessibilitySignal(
      'dwell_exceeded',
      0.85,
      'motor',
      { avgDwellMs: avgDwell }
    ));
  }

  if (switchHits && switchHits > 0) {
    signals.push(createAccessibilitySignal(
      'switch_activation',
      1.0,
      'motor',
      { switchHits }
    ));
  }

  return signals;
}

/**
 * Extracts signals from Sign Avatar 3D engagement.
 */
export function extractAvatarSignals(
  viewDurationSeconds: number,
  speedAdjusted: boolean = false,
  fingerspellingUsed: boolean = false
): A11ySignal[] {
  const signals: A11ySignal[] = [];

  if (viewDurationSeconds >= 5) {
    signals.push(createAccessibilitySignal('sign_avatar_viewed', 0.95, 'hearing', { viewDurationSeconds }));
  }
  if (fingerspellingUsed) {
    signals.push(createAccessibilitySignal('fingerspelling_used', 1.0, 'hearing'));
  }
  if (speedAdjusted) {
    signals.push(createAccessibilitySignal('sign_speed_adjusted', 0.8, 'hearing'));
  }

  return signals;
}

/**
 * Temporal sliding-window buffer for aggregating real-time accessibility interaction signals.
 */
export class AccessibilitySignalBuffer {
  private signals: A11ySignal[] = [];
  private readonly maxWindowMs: number;
  private readonly maxSignals: number;

  constructor(maxWindowMs: number = 300000, maxSignals: number = 100) {
    this.maxWindowMs = maxWindowMs; // Default 5 minutes window
    this.maxSignals = maxSignals;
  }

  public push(signal: A11ySignal): void {
    this.signals.push(signal);
    this.prune();
  }

  public pushMany(signals: A11ySignal[]): void {
    for (const s of signals) {
      this.signals.push(s);
    }
    this.prune();
  }

  public getSignals(): A11ySignal[] {
    this.prune();
    return [...this.signals];
  }

  public getSignalsByModality(modality: 'vision' | 'hearing' | 'motor' | 'speech' | 'communication'): A11ySignal[] {
    this.prune();
    return this.signals.filter(s => s.modality === modality);
  }

  public clear(): void {
    this.signals = [];
  }

  public count(): number {
    this.prune();
    return this.signals.length;
  }

  private prune(): void {
    const cutoff = Date.now() - this.maxWindowMs;
    this.signals = this.signals.filter(s => s.timestamp >= cutoff);
    if (this.signals.length > this.maxSignals) {
      this.signals = this.signals.slice(-this.maxSignals);
    }
  }
}
