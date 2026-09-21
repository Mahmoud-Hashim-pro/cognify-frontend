/**
 * Phase 2C - Milestone 12: Accessibility Intelligence & Adaptive Communication Contract
 *
 * Defines the core types for functional communication adaptation, observation aggregation,
 * full user agency manual locks, and the ethical non-diagnostic privacy architecture.
 */

export type ResponseLengthPreference = 'concise' | 'balanced' | 'detailed';
export type ModalityPreference = 'text' | 'audio' | 'visual' | 'hybrid';
export type VisualDensityPreference = 'spacious' | 'standard' | 'compact';
export type InteractionSpeedPreference = 'deliberate' | 'standard' | 'rapid';

export interface CommunicationPreferences {
  /** Desired length and elaboration level of AI responses */
  preferredResponseLength: ResponseLengthPreference;

  /** Primary sensory or interaction modality */
  preferredModality: ModalityPreference;

  /** UI layout density and spacing */
  visualDensity: VisualDensityPreference;

  /** User's operational pace and interaction pacing */
  interactionSpeed: InteractionSpeedPreference;

  /** Whether audio / TTS should narrate responses automatically */
  ttsAutoPlay: boolean;

  /** Whether high contrast mode is requested */
  highContrastMode: boolean;

  /** User locked preferences that must NOT auto-adapt (100% Student Agency) */
  manualLocks: Record<string, boolean>;
}

export interface A11yInteractionObservation {
  /** Timestamp in milliseconds */
  timestamp: number;

  /** Prompt length in approximate words */
  promptLength: number;

  /** Whether voice / mic input was used for this turn */
  usedVoiceInput: boolean;

  /** Whether the user listened to audio / TTS for this turn */
  listenedToAudio: boolean;

  /** Dwell time or interaction latency in milliseconds */
  dwellTimeMs: number;

  /** Optional semantic action type (e.g. 'query', 're-read', 'speed_change') */
  userActionType?: string;
}

export interface A11yCommunicationProfile {
  /** Unique user identifier */
  userId: string;

  /** Current active communication preferences */
  preferences: CommunicationPreferences;

  /** Total number of interaction signals observed */
  totalObservations: number;

  /** Timestamp of last automatic adaptation */
  lastAdapted: number;

  /** Whether background auto-adaptation is enabled by user */
  autoAdaptationEnabled: boolean;

  /** Rolling window of recent interaction observations for statistical derivation */
  recentObservations?: A11yInteractionObservation[];
}

export interface NonDiagnosticValidationResult {
  valid: boolean;
  violations: string[];
}
