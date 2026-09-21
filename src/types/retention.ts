/**
 * Canonical Retention & Spaced Learning Types
 * Milestone 9: Retention & Spaced Learning Product Engine
 */

export interface RetentionItem {
  conceptId: string;
  conceptTitle: string;
  repetitions: number;
  intervalDays: number;
  easeFactor: number;
  lastReviewDate: number;
  nextReviewDate: number;
  status: 'new' | 'learning' | 'retained' | 'regressed';
  retentionRiskScore: number; // 0.0 to 1.0
  daysOverdue: number;
}

export type RetentionCategory = 'due_today' | 'upcoming' | 'mastered' | 'at_risk';

export interface RetentionDashboardData {
  dueToday: RetentionItem[];
  upcoming: RetentionItem[];
  mastered: RetentionItem[];
  atRisk: RetentionItem[];
}

export interface MicroReviewOption {
  textEn: string;
  textAr: string;
  textFr: string;
}

export interface MicroReviewQuestion {
  conceptId: string;
  conceptTitle: string;
  promptEn: string;
  promptAr: string;
  promptFr: string;
  questionType: string;
  options: MicroReviewOption[];
  correctIndex: number;
  explanationEn: string;
  explanationAr: string;
  explanationFr: string;
}

export interface MicroReviewSubmission {
  conceptId: string;
  selectedIndex: number;
  responseTimeMs: number;
}

export interface MicroReviewResult {
  conceptId: string;
  isCorrect: boolean;
  qualityScore: number; // 0 to 5
  previousIntervalDays: number;
  newIntervalDays: number;
  nextReviewDate: number;
  updatedEaseFactor: number;
  status: string;
}
