/**
 * Canonical Multimodal Intelligence Types
 * Unifies Text, Voice, Vision, and Accessibility into a single pipeline.
 */

export type InputModality = 'text' | 'speech' | 'vision' | 'a11y';
export type A11yModality = 'switch' | 'eye_gaze' | 'voice_command' | 'touch';
export type VisualCardType = 'diagram' | 'code' | 'image' | 'step_flow';
export type HapticPattern = 'light' | 'confirm' | 'warning';

export interface VisionFrame {
  description?: string;
  detectedObjects?: string[];
  dominantColor?: string;
  ocrText?: string;
}

export interface A11yInput {
  modality: A11yModality;
  targetElement?: string;
  dwellTimeMs?: number;
}

export interface MultimodalContext {
  currentView: string;
  activeConceptId?: string;
  language: 'en' | 'ar' | 'fr';
  cognitiveStage?: string;
  pedagogy?: string;
}

export interface MultimodalInput {
  uid: string;
  text?: string;
  speechTranscript?: string;
  visionFrame?: {
    description?: string;
    detectedObjects?: string[];
    dominantColor?: string;
    ocrText?: string;
  };
  a11yInput?: {
    modality: 'switch' | 'eye_gaze' | 'voice_command' | 'touch';
    targetElement?: string;
    dwellTimeMs?: number;
  };
  context: {
    currentView: string;
    activeConceptId?: string;
    language: 'en' | 'ar' | 'fr';
    cognitiveStage?: string;
    pedagogy?: string;
  };
}

export interface FusedMultimodalIntent {
  primaryIntent: string;
  fusedDescriptionEn: string;
  fusedDescriptionAr: string;
  fusedDescriptionFr: string;
  inputModalities: ('text' | 'speech' | 'vision' | 'a11y')[];
  confidence: number;
  requiresVisualAid: boolean;
  requiresAudioNarration: boolean;
  suggestedPedagogy?: string;
}

export interface VisualCard {
  type: 'diagram' | 'code' | 'image' | 'step_flow';
  content: string;
  title: string;
}

export interface SensoryCues {
  hapticPattern?: 'light' | 'confirm' | 'warning';
  highContrastBadge?: string;
}

export interface ModalityAwareResponse {
  textResponse: string;
  speechNarration?: string;
  visualCards?: {
    type: 'diagram' | 'code' | 'image' | 'step_flow';
    content: string;
    title: string;
  }[];
  sensoryCues?: {
    hapticPattern?: 'light' | 'confirm' | 'warning';
    highContrastBadge?: string;
  };
}

export interface SensorAvailability {
  camera: boolean;
  mic: boolean;
}

export interface DegradationResult {
  fallbackModality: string;
  message: string;
  degraded: boolean;
}
