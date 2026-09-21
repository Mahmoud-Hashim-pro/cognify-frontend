/**
 * Milestone 18: AI Output Quality & Hallucination Guard 2.0 Types
 * Semantic Grounding, Self-Healing Code & LaTeX Repair, Adversarial Injection Defense,
 * and Cognitive Overload Simplification.
 */

import type { CognitiveStage } from './studentState';

export type RepairType = 'latex' | 'code_block' | 'injection_scrub' | 'citation_fix' | 'markdown_table';

export interface RepairDetail {
  type: RepairType;
  description: string;
  originalSnippet: string;
  repairedSnippet: string;
}

export type AdversarialThreatLevel = 'none' | 'low' | 'medium' | 'critical';

export interface AdversarialThreatAssessment {
  threatLevel: AdversarialThreatLevel;
  attackSignaturesMatched: string[];
  sanitized: boolean;
  neutralizedText: string;
}

export interface ReadabilityMetric {
  wordCount: number;
  sentenceCount: number;
  charCount: number;
  avgWordsPerSentence: number;
  readabilityIndex: number; // 0 to 100 (higher = more complex)
  exceedsStageThreshold: boolean;
  recommendedMaxWordsPerSentence: number;
}

export interface GroundingAssessment {
  groundingScore: number;    // 0.0 to 1.0 (1.0 = fully grounded in curriculum)
  hallucinationRisk: number; // 0.0 to 1.0 (0.0 = zero hallucination risk)
  flaggedUncertainties: string[];
  isEpistemicallySafe: boolean;
}

export interface QualityGuardResult {
  isClean: boolean;
  originalText: string;
  repairedText: string;
  repairs: RepairDetail[];
  threatAssessment: AdversarialThreatAssessment;
  readability: ReadabilityMetric;
  grounding: GroundingAssessment;
  requiresSimplificationRetry: boolean;
  pedagogicalRecommendation?: string;
}
