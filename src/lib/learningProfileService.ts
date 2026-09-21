/**
 * Phase 2C - Sprint 1: Learning Profile Service
 *
 * Authoritative domain service that transforms StudentState and the
 * Personal Learning Model (PLM) into the canonical PersonalLearningProfile.
 *
 * Enforces the architectural rule:
 * The frontend NEVER queries raw event tables or computes intelligence statistics;
 * all calculations, prerequisite diagnostics, and sample-size guards happen here.
 */

import { getConcept, getPrerequisites } from './conceptGraph';
import { buildPersonalLearningModel } from './personalLearningModel';
import type {
  StudentState,
  PedagogyStrategy,
  PersonalLearningProfile,
  ConceptMasterySummary,
  StrategyEffectivenessSummary,
  CurrentLearningFocus,
  RecentProgressSummary,
  RetentionAlertItem,
} from '../types/studentState';

const PEDAGOGY_STRATEGY_META: Record<
  PedagogyStrategy,
  { nameEn: string; nameAr: string; nameFr: string }
> = {
  worked_example: {
    nameEn: 'Worked Examples',
    nameAr: 'المسائل النموذجية المحلولة',
    nameFr: 'Exemples résolus',
  },
  analogies: {
    nameEn: 'Visual Analogies',
    nameAr: 'التشبيهات البصرية والواقعية',
    nameFr: 'Analogies visuelles',
  },
  scaffolded: {
    nameEn: 'Step-by-Step Scaffolding',
    nameAr: 'التفكيك التدريجي المنظم',
    nameFr: 'Échafaudage pas à pas',
  },
  socratic: {
    nameEn: 'Socratic Inquiry',
    nameAr: 'الحوار الاستنتاجي السقراطي',
    nameFr: 'Questionnement socratique',
  },
  advanced_rigor: {
    nameEn: 'Deep Technical & Rigor',
    nameAr: 'العمق التقني والأكاديمي',
    nameFr: 'Rigueur technique avancée',
  },
};

/**
 * Authoritatively generates a PersonalLearningProfile from StudentState.
 */
export function generatePersonalLearningProfile(
  state: StudentState,
  displayName?: string,
  now: number = Date.now()
): PersonalLearningProfile {
  // 1. Ensure authoritative PLM is present
  const plm = state.personalLearningModel || buildPersonalLearningModel(state, now);
  const masteryEntries = Object.entries(state.conceptMastery || {});

  // 2. Map Concept Mastery Summaries
  const conceptProfiles: Record<string, ConceptMasterySummary> = {};
  const masteredConcepts: ConceptMasterySummary[] = [];
  const developingConcepts: ConceptMasterySummary[] = [];
  const strugglingConcepts: ConceptMasterySummary[] = [];
  const recentProgress: RecentProgressSummary[] = [];

  for (const [cid, rec] of masteryEntries) {
    const node = getConcept(cid);
    const conceptNameEn = node?.nameEn || cid.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const conceptNameAr = node?.nameAr || cid;

    const plmProfile = plm.conceptProfiles?.[cid];
    const rawAccuracy = rec.attempts > 0 ? rec.correct / rec.attempts : 0;
    const masteryPercentage = Math.round(
      Math.min(100, Math.max(0, (plmProfile?.mastery ?? rawAccuracy) * 100))
    );
    const confidencePercentage = Math.round(
      Math.min(100, Math.max(0, (rec.confidence ?? 0.5) * 100))
    );

    // Determine status
    let status: 'mastered' | 'developing' | 'struggling' = 'developing';
    if (rec.consecutiveIncorrect >= 2 || rawAccuracy < 0.5) {
      status = 'struggling';
    } else if (rawAccuracy >= 0.75 && rec.attempts >= 2) {
      status = 'mastered';
    }

    // Determine recent improvement delta
    let recentImprovementPercentage: number | undefined = undefined;
    if (rec.consecutiveCorrect >= 1) {
      recentImprovementPercentage = Math.min(30, Math.round(rec.consecutiveCorrect * 9));
    }

    const summary: ConceptMasterySummary = {
      conceptId: cid,
      conceptNameEn,
      conceptNameAr,
      masteryPercentage,
      confidencePercentage,
      status,
      attemptsCount: rec.attempts,
      commonError: plmProfile?.commonError,
      latencyProfile: plmProfile?.latencyProfile || 'medium',
      retentionRisk: plmProfile?.retentionRisk || 'low',
      bestStrategy: plmProfile?.bestStrategy,
      recentImprovementPercentage,
      lastPracticedIso: new Date(rec.lastTested || now).toISOString(),
    };

    conceptProfiles[cid] = summary;

    if (status === 'mastered') {
      masteredConcepts.push(summary);
    } else if (status === 'struggling') {
      strugglingConcepts.push(summary);
    } else {
      developingConcepts.push(summary);
    }

    // Build RecentProgress item if significant improvement exists
    if (recentImprovementPercentage && recentImprovementPercentage > 0) {
      recentProgress.push({
        conceptId: cid,
        conceptNameEn,
        conceptNameAr,
        deltaPercentage: recentImprovementPercentage,
        trend: 'improving',
        headlineEn: `↑ ${conceptNameEn} +${recentImprovementPercentage}% (Steady mastery progression)`,
        headlineAr: `↑ ${conceptNameAr} +${recentImprovementPercentage}% (تقدم مستمر نحو الإتقان)`,
      });
    }
  }

  // 3. Current Focus Diagnostics
  let currentFocus: CurrentLearningFocus | undefined = undefined;
  const activeIntervention = Object.values(state.activeInterventions || {})[0];

  if (activeIntervention) {
    const node = getConcept(activeIntervention.conceptId);
    const conceptNameEn = node?.nameEn || activeIntervention.conceptId;
    const conceptNameAr = node?.nameAr || activeIntervention.conceptId;

    let prerequisiteToReview: CurrentLearningFocus['prerequisiteToReview'] = undefined;
    const prereqs = getPrerequisites(activeIntervention.conceptId);
    if (prereqs.length > 0) {
      const pNode = prereqs[0];
      prerequisiteToReview = {
        conceptId: pNode.id,
        conceptNameEn: pNode.nameEn,
        conceptNameAr: pNode.nameAr,
      };
    }

    currentFocus = {
      conceptId: activeIntervention.conceptId,
      conceptNameEn,
      conceptNameAr,
      reasonEn: (activeIntervention as any).explanationEn || (activeIntervention as any).reason || 'Targeted remediation active to consolidate conceptual foundation.',
      reasonAr: (activeIntervention as any).explanationAr || 'تدخل تدريجي نشط لتثبيت الأساس المعرفي وتفادي الصعوبات المتكررة.',
      recommendedStrategy: activeIntervention.strategy || 'worked_example',
      prerequisiteToReview,
    };
  } else if (strugglingConcepts.length > 0) {
    const prime = strugglingConcepts[0];
    const prereqs = getPrerequisites(prime.conceptId);
    currentFocus = {
      conceptId: prime.conceptId,
      conceptNameEn: prime.conceptNameEn,
      conceptNameAr: prime.conceptNameAr,
      reasonEn: `Cognitive strain observed on ${prime.conceptNameEn}. Guided remediation recommended.`,
      reasonAr: `تمت ملاحظة عبء إدراكي في ${prime.conceptNameAr}. يُوصى بالتطبيق الموجه.`,
      recommendedStrategy: prime.bestStrategy || 'worked_example',
      prerequisiteToReview: prereqs.length > 0 ? {
        conceptId: prereqs[0].id,
        conceptNameEn: prereqs[0].nameEn,
        conceptNameAr: prereqs[0].nameAr,
      } : undefined,
    };
  } else if (developingConcepts.length > 0) {
    const prime = developingConcepts[0];
    currentFocus = {
      conceptId: prime.conceptId,
      conceptNameEn: prime.conceptNameEn,
      conceptNameAr: prime.conceptNameAr,
      reasonEn: `Active developing concept. Practice exercises will lock in long-term mastery.`,
      reasonAr: `مفهوم قيد التثبيت. الممارسة المنتظمة ستضمن الوصول لمرحلة الإتقان.`,
      recommendedStrategy: prime.bestStrategy || 'scaffolded',
    };
  }

  // 4. Effective Strategies with Sample-Size Guard (N >= 3)
  const effectiveness = state.pedagogyEffectiveness || ({} as StudentState['pedagogyEffectiveness']);
  const strategiesList: PedagogyStrategy[] = [
    'worked_example',
    'analogies',
    'scaffolded',
    'socratic',
    'advanced_rigor',
  ];

  let bestStrategyKey: PedagogyStrategy = plm.primaryPreferredStrategy || 'worked_example';
  let bestScore = -1;
  let hasCalibratedStrategy = false;

  const effectiveStrategies: StrategyEffectivenessSummary[] = strategiesList.map((strat) => {
    const data = effectiveness[strat] || { helpfulCount: 0, unhelpfulCount: 0, score: 0.5 };
    const attemptsCount = (data.helpfulCount || 0) + (data.unhelpfulCount || 0);
    const successesCount = data.helpfulCount || 0;
    const isCalibrating = attemptsCount < 3;
    const scorePercentage = Math.round((data.score || 0.5) * 100);

    if (!isCalibrating && data.score > bestScore) {
      bestScore = data.score;
      bestStrategyKey = strat;
      hasCalibratedStrategy = true;
    }

    const meta = PEDAGOGY_STRATEGY_META[strat];
    return {
      strategy: strat,
      nameEn: meta.nameEn,
      nameAr: meta.nameAr,
      nameFr: meta.nameFr,
      scorePercentage,
      attemptsCount,
      successesCount,
      isOptimal: false, // will assign below
      isCalibrating,
      sampleSizeNoteEn: isCalibrating
        ? `Calibrating (${attemptsCount}/3 exercises completed)`
        : `Based on ${attemptsCount} attempts (${successesCount} successful)`,
      sampleSizeNoteAr: isCalibrating
        ? `جاري المعايرة (${attemptsCount}/3 تمارين مكتملة)`
        : `بناءً على ${attemptsCount} محاولات (${successesCount} ناجحة)`,
    };
  });

  // Assign isOptimal flag to the best calibrated strategy
  for (const s of effectiveStrategies) {
    if (hasCalibratedStrategy && s.strategy === bestStrategyKey && !s.isCalibrating) {
      s.isOptimal = true;
    }
  }

  // 5. Spaced Retention Alerts
  const retentionAlerts: RetentionAlertItem[] = [];
  for (const [cid, sched] of Object.entries(state.retentionSchedules || {})) {
    const nextDateMs = typeof sched.nextReviewDate === 'number'
      ? sched.nextReviewDate
      : sched.nextReviewDate
      ? new Date(sched.nextReviewDate).getTime()
      : 0;
    const isDue = (nextDateMs > 0 && nextDateMs <= now) || (sched as any).isOverdue === true;
    const plmProf = plm.conceptProfiles?.[cid];
    const riskLevel = plmProf?.retentionRisk || (isDue ? 'high' : 'low');

    if (isDue || riskLevel === 'high' || riskLevel === 'medium') {
      const node = getConcept(cid);
      const nameEn = node?.nameEn || cid;
      const nameAr = node?.nameAr || cid;

      retentionAlerts.push({
        conceptId: cid,
        conceptNameEn: nameEn,
        conceptNameAr: nameAr,
        intervalDays: sched.intervalDays || 1,
        riskLevel,
        isDue,
        messageEn: isDue
          ? `Review overdue. Reinforce "${nameEn}" before memory decay.`
          : `Review recommended within 48 hours to consolidate memory.`,
        messageAr: isDue
          ? `المراجعة مستحقة الآن. ثبّت مفهوم "${nameAr}" لتجنب تلاشي الذاكرة.`
          : `يُوصى بالمراجعة خلال ٤٨ ساعة لتعزيز الاستقرار المعرفي.`,
      });
    }
  }

  // Sort retention alerts by risk level
  retentionAlerts.sort((a, b) => (a.riskLevel === 'high' ? -1 : 1));

  // 6. Overall Metrics
  const totalMasterySum = Object.values(conceptProfiles).reduce((acc, c) => acc + c.masteryPercentage, 0);
  const totalConfidenceSum = Object.values(conceptProfiles).reduce((acc, c) => acc + c.confidencePercentage, 0);
  const totalConcepts = Object.keys(conceptProfiles).length;

  const overallMasteryPercentage = totalConcepts > 0 ? Math.round(totalMasterySum / totalConcepts) : 70;
  const overallConfidencePercentage = totalConcepts > 0 ? Math.round(totalConfidenceSum / totalConcepts) : 75;

  return {
    uid: state.uid,
    displayName: displayName || 'Student',
    generatedAt: now,
    overallMasteryPercentage,
    overallConfidencePercentage,
    primaryPreferredStrategy: plm.primaryPreferredStrategy || bestStrategyKey,
    secondaryPreferredStrategy: plm.secondaryPreferredStrategy,
    conceptProfiles,
    masteredConcepts,
    developingConcepts,
    strugglingConcepts,
    currentFocus,
    effectiveStrategies,
    retentionAlerts,
    recentProgress,
    proactiveRemediationDirectives: plm.proactiveRemediationDirectives || [],
    ethicalDisclaimerEn:
      'Personal Learning Profile: Measures empirical interaction history, response latencies, and pedagogical strategy efficacy across exercises. It is not an IQ score, clinical test, or static measurement of intelligence, and assigns no deficit labels.',
    ethicalDisclaimerAr:
      'الملف المعرفي الشخصي: يرصد سجل التفاعل التجريبي وأزمنة الاستجابة ومدى فاعلية الأساليب التعليمية عبر التمارين، ولا يمثل مقياسًا لنسبة الذكاء (IQ) أو تقييمًا ثابتًا للقدرات الإدراكية، ولا يصدر أي أحكام سلبية.',
  };
}
