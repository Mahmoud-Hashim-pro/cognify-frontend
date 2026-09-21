/**
 * Cognify Accessibility 2.0 - Core Accessibility Types & Contracts
 * src/accessibility/accessibilityTypes.ts
 *
 * Models operational capabilities across all modalities (Vision, Hearing, Motor, Speech, Communication).
 * Strictly enforces non-diagnostic capability modeling with zero clinical labels.
 */

export type PrimaryModality = 'text' | 'audio' | 'visual' | 'sign' | 'haptic';
export type ResponseLength = 'concise' | 'balanced' | 'detailed';
export type InteractionPacing = 'rapid' | 'standard' | 'deliberate';
export type TextScalePreference = '100%' | '125%' | '150%' | '200%';
export type ContrastPreference = 'standard' | 'high_contrast' | 'dark_obsidian';
export type MotorInputMethod = 'standard_touch_mouse' | 'switch_access' | 'head_gaze' | 'voice_control';

export interface AccessibilityVisionPreferences {
  preferredTextScale: TextScalePreference;
  contrast: ContrastPreference;
  screenReaderOptimized: boolean;
  ttsAutoNarration: boolean;
  simplifyVisualNoise: boolean;
}

export interface AccessibilityHearingPreferences {
  captionsEnabled: boolean;
  captionStyle: 'standard' | 'high_contrast' | 'large';
  visualAlertsEnabled: boolean;
  audioIndependenceRequired: boolean;
  showSignAvatar: boolean;
}

export interface AccessibilityMotorPreferences {
  inputMethod: MotorInputMethod;
  dwellTimeMs: number;
  tremorDebounceMs: number;
  largeTargetMode: boolean;
  rowColumnScanIntervalMs: number;
}

export interface AccessibilitySpeechPreferences {
  inputMode: 'standard_speech' | 'dysarthria_supported' | 'text_only';
  clarificationConfidenceThreshold: number; // default: 0.70
  lastRecognitionConfidence: number;
}

export interface AccessibilityCommunicationPreferences {
  primaryModality: PrimaryModality;
  responseLength: ResponseLength;
  pacing: InteractionPacing;
}

export interface AccessibilityAdaptationControl {
  autoAdaptationEnabled: boolean;
  manualLocks: Record<string, boolean>; // Any key here is 100% immutable to AI adaptation
  lastAdaptedTimestamp: number;
}

export interface AccessibilityFeedbackMetrics {
  adaptationsSuggestedCount: number;
  adaptationsAcceptedCount: number;
  completionRateDelta: number;
}

export interface AccessibilityState {
  version: 2;
  userId: string;
  vision: AccessibilityVisionPreferences;
  hearing: AccessibilityHearingPreferences;
  motor: AccessibilityMotorPreferences;
  speech: AccessibilitySpeechPreferences;
  communication: AccessibilityCommunicationPreferences;
  adaptation: AccessibilityAdaptationControl;
  feedback: AccessibilityFeedbackMetrics;
}

export interface A11yTelemetryObservation {
  timestamp: number;
  dwellTimeMs?: number;
  captionUsageSeconds?: number;
  audioListenedSeconds?: number;
  tremorRetriesCount?: number;
  voiceInputConfidence?: number;
  interactionType?: 'quiz' | 'reading' | 'chat' | 'navigation';
}

export type A11ySignalType =
  // Vision Signals
  | 'visual_reader_requested'
  | 'contrast_adjusted'
  | 'zoom_requested'
  | 'visual_noise_reduced'
  // Audio / TTS Signals
  | 'tts_played_full'
  | 'tts_interrupted'
  | 'tts_repeated'
  | 'audio_rate_adjusted'
  // Speech Signals
  | 'speech_low_confidence'
  | 'speech_repetition_needed'
  | 'speech_clarified'
  | 'speech_high_confidence'
  // Caption Signals
  | 'captions_activated'
  | 'captions_dismissed'
  | 'caption_speed_adjusted'
  // Motor Signals
  | 'tremor_detected'
  | 'dwell_exceeded'
  | 'switch_activation'
  | 'large_target_demanded'
  // Avatar Signals
  | 'sign_avatar_viewed'
  | 'sign_speed_adjusted'
  | 'fingerspelling_used';

export interface A11ySignal {
  id: string;
  type: A11ySignalType;
  timestamp: number;
  confidence: number;
  modality: 'vision' | 'hearing' | 'motor' | 'speech' | 'communication';
  data?: Record<string, any>;
}

export interface ModalityDecision {
  id: string;
  targetPath: string;
  suggestedValue: any;
  confidence: number;
  rationale: string;
  autoApplied: boolean;
  blockedByLock: boolean;
  timestamp: number;
}

export interface SpeechClarificationRequest {
  recognizedText: string;
  confidence: number;
  alternatives?: string[];
  lang?: 'en' | 'ar' | 'fr';
}

export interface SpeechClarificationResult {
  prompt: string;
  options: string[];
  requiresClarification: boolean;
}

export interface A11yFeedbackRecord {
  decisionId: string;
  targetPath: string;
  accepted: boolean;
  completionDelta: number;
  timestamp: number;
}
