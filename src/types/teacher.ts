/**
 * Milestone 13: Teacher Intelligence Type Definitions
 * Classroom concept mastery aggregation, struggle clustering,
 * intervention effectiveness, and differentiated instruction.
 */

import { PedagogyStrategy } from '../types/studentState';

export interface StudentMasterySnippet {
  uid: string;
  name: string;
  accuracy: number;
  learningStrain: number;
  consecutiveIncorrect: number;
  preferredPedagogy?: PedagogyStrategy;
}

export interface ConceptStruggleCluster {
  conceptId: string;
  conceptTitleEn: string;
  conceptTitleAr: string;
  totalStudentsAssessed: number;
  strugglingStudentCount: number;
  struggleRatePercentage: number;
  averageAccuracy: number;
  diagnosedPrerequisiteGap?: {
    prerequisiteId: string;
    prerequisiteTitleEn: string;
    prerequisiteTitleAr: string;
    gapSeverity: 'low' | 'moderate' | 'critical';
  };
  commonErrorPatterns: string[];
}

export interface ClassInterventionEfficacy {
  strategy: PedagogyStrategy;
  attemptsCount: number;
  helpfulCount: number;
  unhelpfulCount: number;
  efficacyRate: number; // 0.0 to 1.0
  averageNormalizedGain: number; // Hake gain g
  isCalibrated: boolean; // sample size >= 3
}

export interface DifferentiatedInstructionGroup {
  id: string;
  groupNameEn: string;
  groupNameAr: string;
  targetConceptId: string;
  recommendedPedagogy: PedagogyStrategy;
  students: StudentMasterySnippet[];
  pedagogicalRationaleEn: string;
  pedagogicalRationaleAr: string;
}

export interface TeacherActionRecommendation {
  id: string;
  priority: 'urgent' | 'high' | 'routine';
  category: 'prerequisite_review' | 'strategy_pivot' | 'advanced_challenge';
  titleEn: string;
  titleAr: string;
  actionPromptEn: string;
  actionPromptAr: string;
  targetedConceptId?: string;
}

export interface HeatmapCell {
  studentUid: string;
  studentName?: string;
  conceptId: string;
  accuracy: number;
  confidence: number;
  colorTier: 'green' | 'yellow' | 'red';
}

export interface ConceptHeatmapSummary {
  conceptId: string;
  conceptTitleEn?: string;
  conceptTitleAr?: string;
  averageAccuracy: number;
  colorTier: 'green' | 'yellow' | 'red';
  strugglingCount: number;
}

export interface StudentHeatmapSummary {
  studentUid: string;
  studentName: string;
  averageAccuracy: number;
  colorTier: 'green' | 'yellow' | 'red';
  strugglingConceptsCount: number;
}

export interface CohortMasteryHeatmapData {
  concepts: string[];
  cells: HeatmapCell[];
  conceptSummaries: ConceptHeatmapSummary[];
  studentSummaries: StudentHeatmapSummary[];
}

export interface PrerequisiteAlertMessage {
  alertId: string;
  severity: 'urgent' | 'warning' | 'info';
  targetConceptId: string;
  rootPrerequisiteId: string;
  affectedStudentCount: number;
  recipientTeacherUid: string;
  dispatchedTimestamp: number;
  messageEn: string;
  messageAr: string;
  suggestedClassAction: string;
}

export interface CurriculumPacingRecommendation {
  classId: string;
  pacingDecision: 'decelerate_review' | 'maintain_pace' | 'accelerate_enrich';
  pacingRationaleEn: string;
  pacingRationaleAr: string;
  recommendedReviewHours: number;
  nextPlannedModule: string;
}

export interface TeacherDashboardData {
  classId: string;
  className: string;
  totalStudents: number;
  activeRatePercentage: number;
  classAverageMastery: number;
  struggleClusters: ConceptStruggleCluster[];
  interventionEfficacy: Record<string, ClassInterventionEfficacy>;
  differentiatedGroups: DifferentiatedInstructionGroup[];
  actionRecommendations: TeacherActionRecommendation[];
  curriculumPacing?: CurriculumPacingRecommendation;
  heatmap?: CohortMasteryHeatmapData;
}

