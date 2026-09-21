/**
 * Institutional Intelligence Types (Milestone 15)
 * University and School analytics with Curricular Gap Heatmaps, Early-Warning Dropout Radar,
 * Accreditation Export (ABET/NCAAA), and strict k-Anonymity (k >= 5) suppression.
 */

export interface DepartmentMetrics {
  departmentId: string;
  departmentNameEn: string;
  departmentNameAr: string;
  enrolledStudentsCount: number;
  averageMasteryRate: number; // 0.0 - 1.0
  averageStrainRate: number;  // 0.0 - 1.0
  retentionRate: number;      // 0.0 - 1.0
}

export interface CurricularBottleneck {
  conceptId: string;
  conceptNameEn: string;
  conceptNameAr: string;
  courseId: string;
  failureCascadeRisk: 'critical' | 'high' | 'moderate' | 'low';
  affectedStudentPercentage: number;
  downstreamImpactCourses: string[];
}

export interface KAnonymityAudit {
  minimumCohortSize: number; // 5
  suppressionApplied: boolean;
  suppressedCohortsCount: number;
  reidentificationRisk: 'zero' | 'low';
  privacyPolicyNoticeEn: string;
  privacyPolicyNoticeAr: string;
}

export type RiskLevel = 'low' | 'moderate' | 'high' | 'critical';

export interface EarlyWarningStudentRadar {
  riskCohortId: string;
  riskLevel: RiskLevel;
  studentCountDisplay: string; // e.g. "18 students" or "<5 (Suppressed for Privacy)"
  actualStudentCount?: number;  // Only populated if >= k-threshold (5)
  isSuppressed: boolean;
  primarySignals: string[];
  recommendedInstitutionalActionEn: string;
  recommendedInstitutionalActionAr: string;
}

export interface LearningOutcomeAttainment {
  outcomeId: string;
  descriptionEn: string;
  descriptionAr: string;
  targetBenchmark: number; // e.g. 75%
  actualAttainment: number; // e.g. 84%
  status: 'meets_standard' | 'exceeds_standard' | 'requires_action';
}

export interface AccreditationReportData {
  institutionName: string;
  accreditationStandard: 'ABET_CAC' | 'NCAAA' | 'GENERAL_QA';
  evaluationPeriod: string;
  outcomesAttainment: LearningOutcomeAttainment[];
  continuousImprovementLoop: {
    identifiedGapEn: string;
    identifiedGapAr: string;
    implementedPedagogicalChangeEn: string;
    implementedPedagogicalChangeAr: string;
    measuredImpactGainPercentage: number; // e.g. +14%
  };
}

export interface InstitutionalDashboardData {
  institutionId: string;
  institutionName: string;
  departments: DepartmentMetrics[];
  bottlenecks: CurricularBottleneck[];
  earlyWarningRadar: EarlyWarningStudentRadar[];
  accreditation: AccreditationReportData;
  kAnonymityAudit: KAnonymityAudit;
}
