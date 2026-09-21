/**
 * Parent Intelligence Types (Milestone 14)
 * Provides holistic developmental views for parents while guaranteeing
 * the Strict Zero-Chat-Snooping Privacy Shield to preserve student psychological safety.
 */

export type MomentumTrend = 'accelerating' | 'steady' | 'needs_encouragement';

export interface WeeklyGrowthSummary {
  weekStartDate: number;
  weekEndDate: number;
  activeDaysCount: number;
  conceptsMasteredCount: number;
  previousWeekMasteredCount: number;
  growthPercentage: number; // e.g. +25%
  practiceTimeMinutes: number;
  learningMomentum: MomentumTrend;
}

export type BreakthroughType = 'resilience_breakthrough' | 'streak_milestone' | 'mastery_leap';

export interface CelebratedBreakthrough {
  id: string;
  conceptId: string;
  conceptTitleEn: string;
  conceptTitleAr: string;
  type: BreakthroughType;
  headlineEn: string;
  headlineAr: string;
  storyEn: string;
  storyAr: string;
  achievedTimestamp: number;
}

export interface HomeDiscussionCue {
  id: string;
  targetedConceptId: string;
  conversationStarterEn: string;
  conversationStarterAr: string;
  supportiveTipEn: string;
  supportiveTipAr: string;
  contextEn: string;
  contextAr: string;
}

export interface ParentPrivacyShieldAudit {
  isZeroChatSnoopingEnforced: boolean;
  rawMessagesExposed: 0;
  chatTranscriptsBlocked: true;
  studentPsychologicalSafetyGuaranteed: boolean;
}

export interface ParentDashboardData {
  studentUid: string;
  studentDisplayName: string;
  growthSummary: WeeklyGrowthSummary;
  breakthroughs: CelebratedBreakthrough[];
  homeDiscussionCues: HomeDiscussionCue[];
  privacyShield: ParentPrivacyShieldAudit;
}
