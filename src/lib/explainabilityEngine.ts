/**
 * Phase 2C - Sprint 2 / Milestone 5: Explainable Intelligence Engine
 *
 * Provides authoritative, pure domain functions to explain AI decisions with
 * structured, evidence-grounded rationales in English and Arabic:
 *
 * 1. explainPedagogyChoice: Explains WHY a specific pedagogy strategy
 *    (Worked Example, Analogy, Scaffolded, Socratic, Advanced Rigor) was selected.
 * 2. explainRecommendation: Explains WHY a concept was prioritized, diagnosing
 *    prerequisite gaps vs. localized concept remediation.
 * 3. explainRetentionReview: Explains WHY a spaced review is due based on the
 *    SuperMemo-2 / Ebbinghaus forgetting curve.
 * 4. synthesizeCommonMistakes: Analyzes observed student error logs to identify
 *    recurring mistake patterns with actionable remediation tips.
 */

import type { PedagogyStrategy, StudentState } from '../types/studentState';
import { getConcept, diagnosePrerequisiteGap, getPrerequisites, ConceptNode } from './conceptGraph';

export type { PedagogyStrategy };

export interface PedagogyRationale {
  strategy: PedagogyStrategy;
  rationaleEn: string;
  rationaleAr: string;
  trigger: string;
  evidence: string;
  confidenceLevel: 'calibrating' | 'high' | 'provisional';
  pedagogicalGoalEn: string;
  pedagogicalGoalAr: string;
}

export interface RecommendationRationale {
  targetConceptId: string;
  recommendedConceptId: string;
  conceptId?: string; // Convenience alias
  rationaleEn: string;
  rationaleAr: string;
  isPrerequisiteGap: boolean;
  prerequisiteChain?: string[];
  diagnosisSummaryEn: string;
  diagnosisSummaryAr: string;
}

export interface RetentionRationale {
  conceptId: string;
  intervalDays: number;
  daysSinceReview: number;
  rationaleEn: string;
  rationaleAr: string;
  riskLevel: 'high' | 'medium' | 'low';
  decayRisk: number; // 0.0 to 1.0
  urgencyLabelEn: string;
  urgencyLabelAr: string;
}

export interface CommonMistakeItem {
  id: string; // e.g. 'dereference_null'
  nameEn: string;
  nameAr: string;
  count: number;
  conceptsInvolved: string[];
  descriptionEn: string;
  descriptionAr: string;
  remediationTipEn: string;
  remediationTipAr: string;
  suggestedActionEn: string;
  suggestedActionAr: string;
}

/**
 * Standard catalog of common conceptual & syntactic mistakes with expert remediation tips.
 */
export const COMMON_MISTAKES_CATALOG: Record<
  string,
  {
    nameEn: string;
    nameAr: string;
    descriptionEn: string;
    descriptionAr: string;
    remediationTipEn: string;
    remediationTipAr: string;
    suggestedActionEn: string;
    suggestedActionAr: string;
  }
> = {
  dereference_null: {
    nameEn: 'Null Pointer Dereference',
    nameAr: 'فك إشارة مؤشر فارغ (Null Pointer)',
    descriptionEn: 'Attempting to access memory via a pointer containing NULL (0x0). In unmanaged runtimes, this causes a fatal segmentation fault.',
    descriptionAr: 'محاولة الوصول إلى محتوى الذاكرة عبر مؤشر يحمل القيمة NULL (0x0)، مما يتسبب في خطأ فادح وفشل البرنامج (Segmentation Fault).',
    remediationTipEn: 'Always verify non-null validity before dereferencing: wrap access in an explicit guard condition `if (ptr != NULL)` or use defensive assertions.',
    remediationTipAr: 'تحقق دائمًا من أن المؤشر ليس فارغًا قبل استخدامه: ضع شرط حماية صريح `if (ptr != NULL)` أو استخدم تأكيدات الأمان.',
    suggestedActionEn: 'Practice pointer guard patterns and debug memory addresses before reading value.',
    suggestedActionAr: 'تدرّب على نمط حماية المؤشرات وافحص العناوين قبل قراءة القيمة المخزنة.',
  },
  base_case_omission: {
    nameEn: 'Recursive Base Case Omission',
    nameAr: 'إغفال شرط التوقف في التكرار التعاودي',
    descriptionEn: 'Formulating recursive algorithms without a verified termination boundary, exhausting stack memory frames.',
    descriptionAr: 'صياغة دالة تعاودية دون تحديد شرط توقف مؤكد، مما يؤدي إلى استهلاك كامل ذاكرة المكدس (Stack Overflow).',
    remediationTipEn: 'Declare the base case as the very first check in your function body before any recursive calls are initiated.',
    remediationTipAr: 'اجعل شرط التوقف هو أول سطر يُنفذ دائمًا داخل جسم الدالة قبل استدعاء الدالة لنفسها مجددًا.',
    suggestedActionEn: 'Trace the call stack on paper for small inputs (e.g. n = 0, n = 1) to confirm exit conditions.',
    suggestedActionAr: 'تتبع استدعاءات المكدس على ورقة للمدخلات الأولية (مثل n = 0, n = 1) للتأكد من شروط الخروج.',
  },
  off_by_one: {
    nameEn: 'Off-By-One Boundary Error',
    nameAr: 'خطأ الإزاحة بمقدار واحد في حدود التكرار',
    descriptionEn: 'Iterating past the valid boundary of an array or collection (e.g. using index <= length instead of < length).',
    descriptionAr: 'تجاوز الحدود المسموحة للمصفوفة أثناء التكرار (مثل استخدام index <= length بدلاً من < length في المصفوفات الصفرية).',
    remediationTipEn: 'In 0-indexed systems with size N, valid indices are 0 to N-1. Check loop termination inequalities (`<` vs `<=`).',
    remediationTipAr: 'في الأنظمة التي تبدأ من الصفر بحجم N، العناصر المسموحة هي من 0 إلى N-1. راجع علامة المقارنة بدقة (`<` بدلاً من `<=`).',
    suggestedActionEn: 'Verify loop conditions on array boundaries at index 0 and index N-1.',
    suggestedActionAr: 'تحقق من شروط التكرار عند الحد الأدنى (0) والحد الأقصى (N-1).',
  },
  memory_leak: {
    nameEn: 'Dynamic Memory Leak',
    nameAr: 'تسريب الذاكرة الديناميكية (Memory Leak)',
    descriptionEn: 'Allocating dynamic memory on the heap (malloc/new) without providing a corresponding free/delete along all execution paths.',
    descriptionAr: 'حجز مساحات في ذاكرة Heap دون تحريرها بعد الانتهاء منها، مما يستنزف موارد الذاكرة بمرور الوقت.',
    remediationTipEn: 'Pair every allocation directly with a guaranteed deallocation path, or adopt modern RAII smart pointers.',
    remediationTipAr: 'وازن كل عملية حجز للذاكرة بتحرير مقابل ومضمون في جميع مسارات التنفيذ، أو اعتمد على المؤشرات الذكية.',
    suggestedActionEn: 'Map every malloc to its corresponding free call and audit early return statements.',
    suggestedActionAr: 'اربط كل دالة malloc بالدالة المقابلة لها free وتأكد من مسارات الخروج المبكر (return).',
  },
  type_mismatch: {
    nameEn: 'Type Incompatibility & Precision Loss',
    nameAr: 'عدم توافق الأنواع وفقدان الدقة الحسابية',
    descriptionEn: 'Performing operations between mismatched types, causing unintended integer truncation or unexpected type conversions.',
    descriptionAr: 'إجراء عمليات حسابية أو منطقية بين أنواع بيانات غير متوافقة مما يسبب اقتطاع الكسور أو نتائج غير متوقعة.',
    remediationTipEn: 'Use explicit type casts and avoid mixing signed/unsigned or integer/floating-point arithmetic without conversion.',
    remediationTipAr: 'استخدم التحويل الصريح للأنواع (Type Casting) وتجنب خلط الأعداد الصحيحة مع العشرية دون تحويل مدروس.',
    suggestedActionEn: 'Inspect intermediate types in arithmetic formulas to avoid integer division truncation.',
    suggestedActionAr: 'افحص الأنواع المؤقتة في المعادلات لتفادي اقتطاع ناتج القسمة الصحيحة.',
  },
  dangling_pointer: {
    nameEn: 'Dangling Pointer Access',
    nameAr: 'الوصول إلى مؤشر معلق (Dangling Pointer)',
    descriptionEn: 'Dereferencing a pointer referencing memory that has already been deallocated or a stack variable that went out of scope.',
    descriptionAr: 'محاولة القراءة أو الكتابة عبر مؤشر يشير إلى عنوان ذاكرة تم تحريره بالفعل أو انتهت صلاحية نطاقه.',
    remediationTipEn: 'Immediately set pointers to NULL right after calling free(), ensuring subsequent checks safely catch misuse.',
    remediationTipAr: 'عيّن قيمة المؤشر إلى NULL مباشرة بعد استدعاء دالة free() لضمان كشف أي استخدام غير مقصود.',
    suggestedActionEn: 'Adopt the safe deallocation idiom: free(ptr); ptr = NULL;',
    suggestedActionAr: 'اعتمد نمط التحرير الآمن دائماً: free(ptr); ptr = NULL;',
  },
  infinite_loop: {
    nameEn: 'Unreachable Loop Termination',
    nameAr: 'حلقة تكرار غير منتهية (Infinite Loop)',
    descriptionEn: 'Loop state variables not making monotonic progress toward the termination invariant.',
    descriptionAr: 'عدم تحديث متغير التحكم في التكرار باتجاه شرط التوقف، مما يعلق تنفيذ البرنامج في دورة لا نهائية.',
    remediationTipEn: 'Trace variable progression: ensure each cycle strictly decreases the distance to the exit condition.',
    remediationTipAr: 'تتبع مسار المتغير: تأكد من أن كل دورة تقرب المتغير حتمياً من تحقيق شرط الخروج.',
    suggestedActionEn: 'Insert safety iteration counters or assert invariant progression during debugging.',
    suggestedActionAr: 'أضف عدادات أمان مؤقتة أو افحص شرط التوقف للتأكد من حدوث التغيير المطلوب.',
  },
};

/**
 * Pure domain function explaining WHY a pedagogical strategy was chosen.
 * Analyzes cognitive strain, consecutive error streaks, and strategy efficacy metrics.
 */
export function explainPedagogyChoice(
  strategy: PedagogyStrategy,
  state?: StudentState | null,
  conceptId?: string
): PedagogyRationale {
  const cleanStrat = strategy || 'scaffolded';
  const effectiveness = state?.pedagogyEffectiveness?.[cleanStrat];
  const attempts = (effectiveness?.helpfulCount || 0) + (effectiveness?.unhelpfulCount || 0);
  const score = effectiveness?.score ?? 0.5;

  // Confidence Level calibration based on sample size guard (N >= 3)
  let confidenceLevel: PedagogyRationale['confidenceLevel'] = 'provisional';
  if (!state) {
    confidenceLevel = 'provisional';
  } else if (attempts < 3) {
    confidenceLevel = 'calibrating';
  } else if (score >= 0.65) {
    confidenceLevel = 'high';
  } else {
    confidenceLevel = 'provisional';
  }

  // Concept-level context
  const masteryRec = conceptId && state?.conceptMastery ? state.conceptMastery[conceptId] : undefined;
  const conceptNode = conceptId ? getConcept(conceptId) : undefined;
  const conceptName = conceptNode?.nameEn || conceptId || 'this topic';
  const conceptNameAr = conceptNode?.nameAr || conceptId || 'هذا المفهوم';
  const conceptTag = conceptId ? `${conceptName} (${conceptId})` : conceptName;

  // Learning strain signals
  const strain = state?.learningStrain;
  const struggleScore = strain?.possibleStruggle ?? (state?.struggleSignal ?? 0);
  const hasStrain = struggleScore >= 0.65;
  const consecutiveIncorrect = masteryRec?.consecutiveIncorrect || 0;
  const consecutiveCorrect = masteryRec?.consecutiveCorrect || 0;
  const accuracyPct = masteryRec && masteryRec.attempts > 0 ? Math.round(masteryRec.accuracy * 100) : 70;

  switch (cleanStrat) {
    case 'worked_example': {
      const isHighStruggle = consecutiveIncorrect >= 2 || hasStrain || (masteryRec && masteryRec.accuracy < 0.5);
      const trigger = isHighStruggle
        ? `High Cognitive Strain & Repeated Errors (${consecutiveIncorrect} consecutive incorrect on ${conceptTag})`
        : `Empirically Calibrated Efficacy for ${conceptTag}`;
      
      const evidence = consecutiveIncorrect >= 2
        ? `Student encountered ${consecutiveIncorrect} consecutive errors on ${conceptTag} (accuracy: ${accuracyPct}%, cognitive strain: ${(struggleScore).toFixed(2)}). Step-by-step worked examples reduce working memory saturation.`
        : `Historical interaction indicates worked examples yield high conceptual acquisition (${Math.round(score * 100)}% efficacy) during initial phase for ${conceptTag}.`;

      return {
        strategy: 'worked_example',
        trigger,
        evidence,
        confidenceLevel,
        pedagogicalGoalEn: 'Relieve extraneous cognitive load through concrete step-by-step demonstration before asking for independent synthesis.',
        pedagogicalGoalAr: 'تخفيف العبء الإدراكي عبر تقديم حلول نموذجية مشروحة خطوة بخطوة قبل الانتقال للتطبيق المستقل.',
        rationaleEn: `Cognify switched to step-by-step Worked Examples for "${conceptName}". Breaking down the mechanics sequentially relieves working memory overload, allowing you to absorb the execution blueprint before tackling code independently.`,
        rationaleAr: `اختار كوجنيفاي أسلوب "المسائل النموذجية المحلولة خطوة بخطوة" في "${conceptNameAr}". استعراض خطوات الحل تفصيلياً يُخفف العبء الذهني ويتيح استيعاب النمط الأساسي قبل الانتقال للتطبيق العملي بمفردك.`,
      };
    }

    case 'analogies': {
      const trigger = strain?.signals?.includes('prerequisite_gap')
        ? `Abstract Mental Model Friction on ${conceptName}`
        : `Conceptual Bridge for Abstract Mechanics`;

      const evidence = `Empirical win-rate for visual analogies is ${Math.round(score * 100)}% across ${attempts} interactions. Grounding abstract data structures into real-world physical metaphors accelerates comprehension.`;

      return {
        strategy: 'analogies',
        trigger,
        evidence,
        confidenceLevel,
        pedagogicalGoalEn: 'Bridge unfamiliar computational concepts to intuitive everyday mental models before formal notation.',
        pedagogicalGoalAr: 'تقريب المفاهيم الحاسوبية المجردة بنماذج ذهنية واقعية مألوفة قبل الدخول في الصيغ التقنية.',
        rationaleEn: `Cognify engaged Conceptual Analogies for "${conceptName}". Grounding abstract computing logic into familiar physical systems anchors intuitive mental models, making low-level mechanics feel concrete and accessible.`,
        rationaleAr: `اعتمد كوجنيفاي أسلوب "التشبيهات والنماذج الذهنية" في "${conceptNameAr}". ربط الأفكار البرمجية المجردة بتجارب واقعية مألوفة يُرسخ الفهم البديهي ويسهل استيعاب الآليات الدقيقة.`,
      };
    }

    case 'scaffolded': {
      const trigger = consecutiveIncorrect === 1
        ? `Single Error Milestone Recovery on ${conceptName}`
        : `Structured Incremental Guidance`;

      const evidence = `Target concept requires multi-step synthesis. Guided scaffolding breaks complex problem spaces into verified intermediate checkpoints without revealing answers outright.`;

      return {
        strategy: 'scaffolded',
        trigger,
        evidence,
        confidenceLevel,
        pedagogicalGoalEn: 'Deconstruct complex problem spaces into sequenced, bite-sized checkpoints to maintain momentum without overwhelming working memory.',
        pedagogicalGoalAr: 'تفكيك المسائل المعقدة إلى خطوات تدريجية منظمة للحفاظ على استمرارية الإنجاز دون إرهاق الذاكرة النشطة.',
        rationaleEn: `Cognify deployed Scaffolded Guidance for "${conceptName}". Breaking down the solution into incremental milestones supports autonomous problem-solving while ensuring you never get stuck on intermediate steps.`,
        rationaleAr: `استخدم كوجنيفاي أسلوب "التفكيك المتدرج (Scaffolding)" في "${conceptNameAr}". تقسيم التحدي إلى مراحل متسلسلة يُمكنك من الوصول للحل بشكل ذاتي دون التعثر في الخطوات البينية.`,
      };
    }

    case 'socratic': {
      const isMastery = consecutiveCorrect >= 3 || accuracyPct >= 80;
      const trigger = isMastery
        ? `High Mastery Streak (${consecutiveCorrect} consecutive correct on ${conceptName})`
        : `Deductive Reasoning & Meta-Cognitive Challenge`;

      const evidence = `Strong performance detected (${consecutiveCorrect} correct answers in a row, ${accuracyPct}% accuracy). Socratic inquiry stimulates higher-order cognitive evaluation and edge-case discovery.`;

      return {
        strategy: 'socratic',
        trigger,
        evidence,
        confidenceLevel,
        pedagogicalGoalEn: 'Promote autonomous discovery and meta-cognitive evaluation through targeted, thought-provoking micro-prompts.',
        pedagogicalGoalAr: 'تحفيز الاكتشاف الذاتي والتفكير النقدي العميق عبر أسئلة استنتاجية توجيهية ذكية.',
        rationaleEn: `Cognify promoted this interaction to Socratic Inquiry for "${conceptName}". You have demonstrated solid foundational fluency; guiding you with deductive questions challenges you to evaluate edge cases and architectural trade-offs independently.`,
        rationaleAr: `تمت الترقية إلى "الحوار السقراطي الاستنتاجي" في "${conceptNameAr}". نظراً لتمكنك الواضح من الأساسيات؛ فإن توجيهك بأسئلة ذكية يُحفزك على اكتشاف حالات الحافة والبدائل الهندسية ذاتياً.`,
      };
    }

    case 'advanced_rigor': {
      const trigger = `High-Tier Fluency & Algorithmic Rigor`;
      const evidence = `Consistently high accuracy (${accuracyPct}%) across prerequisites. Ready for formal complexity bounds (Big-O), memory layout architectures, and production-grade constraints.`;

      return {
        strategy: 'advanced_rigor',
        trigger,
        evidence,
        confidenceLevel,
        pedagogicalGoalEn: 'Explore mathematical formalisms, low-level execution boundaries, and production-grade algorithmic trade-offs.',
        pedagogicalGoalAr: 'التعمق في الدقة الرياضية، وتفاصيل الذاكرة منخفضة المستوى، والتعقيد الخوارزمي في بيئات الإنتاج.',
        rationaleEn: `Cognify selected Formal Rigor for "${conceptName}". Your demonstrated proficiency enables deep analysis of memory layout boundaries, algorithmic complexity guarantees, and enterprise-grade design constraints.`,
        rationaleAr: `اختار كوجنيفاي أسلوب "العمق الأكاديمي والدقة الخوارزمية" في "${conceptNameAr}". مستواك المتقدم يتيح الخوض في تفاصيل الذاكرة منخفضة المستوى والتعقيد الحسابي ومعايير النظم الكبرى.`,
      };
    }

    default: {
      return {
        strategy: 'scaffolded',
        trigger: 'Standard Adaptive Baseline',
        evidence: 'Default balanced guidance based on active curriculum stage.',
        confidenceLevel: 'provisional',
        pedagogicalGoalEn: 'Provide balanced scaffolding tailored to the active curriculum.',
        pedagogicalGoalAr: 'تقديم دعم تدريجي متوازن ومناسب للمرحلة التعليمية الحالية.',
        rationaleEn: `Cognify is using structured guidance to support your steady progression through "${conceptName}".`,
        rationaleAr: `يستخدم كوجنيفاي التوجيه المتدرج لدعم تقدمك المستمر في "${conceptNameAr}".`,
      };
    }
  }
}

/**
 * Pure domain function explaining WHY a concept was recommended or prioritized.
 * Diagnoses whether focus is due to a prerequisite foundational gap or localized mastery practice.
 */
export function explainRecommendation(
  conceptId: string,
  state?: StudentState | null
): RecommendationRationale {
  const targetNode = getConcept(conceptId);
  const targetNameEn = targetNode?.nameEn || conceptId.replace(/_/g, ' ');
  const targetNameAr = targetNode?.nameAr || conceptId;

  // Build mastery lookup for diagnosis
  const masteryLookup: Record<string, { accuracy: number; attempts: number; confidence: number }> = {};
  if (state?.conceptMastery) {
    for (const [k, v] of Object.entries(state.conceptMastery)) {
      masteryLookup[k] = {
        accuracy: v.attempts > 0 ? v.correct / v.attempts : v.accuracy,
        attempts: v.attempts,
        confidence: v.confidence ?? 0.5,
      };
    }
  }

  // 1. Check for Prerequisite Root Gap
  const diagnosis = diagnosePrerequisiteGap(conceptId, masteryLookup);

  if (diagnosis.hasPrerequisiteGap && diagnosis.rootGapConcept) {
    const rootGap = diagnosis.rootGapConcept;
    const chain = [rootGap.id, conceptId];

    return {
      targetConceptId: conceptId,
      recommendedConceptId: rootGap.id,
      conceptId: rootGap.id,
      isPrerequisiteGap: true,
      prerequisiteChain: chain,
      diagnosisSummaryEn: `Foundational gap in prerequisite "${rootGap.nameEn}" is obstructing progress in "${targetNameEn}".`,
      diagnosisSummaryAr: `فجوة في المتطلب التأسيسي "${rootGap.nameAr}" تعيق التقدم في "${targetNameAr}".`,
      rationaleEn: `Diagnostic tracking reveals that friction with "${targetNameEn}" is rooted in unmastered prerequisites in "${rootGap.nameEn}". Solidifying this foundation first removes conceptual roadblocks and ensures smooth subsequent mastery.`,
      rationaleAr: `أظهر التحليل التشخيصي أن الصعوبة الحالية في "${targetNameAr}" تعود إلى عدم التمكن التام من المتطلب الأساسي "${rootGap.nameAr}". مراجعة وترسيخ هذا الأساس أولاً يُزيل العوائق ويضمن فهماً سلساً للمفاهيم المتقدمة.`,
    };
  }

  // 2. Check localized concept mastery metrics
  const rec = state?.conceptMastery?.[conceptId];
  const isStruggling = rec && (rec.consecutiveIncorrect >= 2 || (rec.attempts > 0 && rec.correct / rec.attempts < 0.5));
  const isMastered = rec && rec.attempts >= 2 && rec.correct / rec.attempts >= 0.8;

  if (isStruggling) {
    const accPct = Math.round(((rec.attempts > 0 ? rec.correct / rec.attempts : rec.accuracy)) * 100);
    return {
      targetConceptId: conceptId,
      recommendedConceptId: conceptId,
      conceptId,
      isPrerequisiteGap: false,
      prerequisiteChain: [conceptId],
      diagnosisSummaryEn: `Targeted remediation priority: cognitive strain observed (${rec.consecutiveIncorrect} consecutive errors, ${accPct}% accuracy).`,
      diagnosisSummaryAr: `أولوية معالجة موجهة: تم رصد عبء إدراكي (${rec.consecutiveIncorrect} أخطاء متتالية، نسبة دقة ${accPct}%).`,
      rationaleEn: `Prioritized for immediate remediation because recent attempts in "${targetNameEn}" showed cognitive friction. Focused practice now prevents misconceptions from hardening.`,
      rationaleAr: `تم إعطاؤه أولوية فورية لأن المحاولات الأخيرة في "${targetNameAr}" أظهرت صعوبة. التدريب المركز الآن يحمي من ثبات المفاهيم الخاطئة.`,
    };
  }

  if (isMastered) {
    return {
      targetConceptId: conceptId,
      recommendedConceptId: conceptId,
      conceptId,
      isPrerequisiteGap: false,
      prerequisiteChain: [conceptId],
      diagnosisSummaryEn: `Advanced mastery consolidation & cross-domain synthesis.`,
      diagnosisSummaryAr: `تثبيت متقدم للمفاهيم المتقنة والربط بين المجالات.`,
      rationaleEn: `Selected to extend your high mastery in "${targetNameEn}" into complex system-level problems and real-world engineering constraints.`,
      rationaleAr: `تم اختياره لتوسيع إتقانك المتميز في "${targetNameAr}" وتطبيقه على مشكلات هندسية مركبة في بيئات العمل الحقيقية.`,
    };
  }

  // Developing / Next progressive step
  return {
    targetConceptId: conceptId,
    recommendedConceptId: conceptId,
    conceptId,
    isPrerequisiteGap: false,
    prerequisiteChain: [conceptId],
    diagnosisSummaryEn: `Active curriculum progression: ideal stepping stone for current learning frontier.`,
    diagnosisSummaryAr: `المسار التعليمي الفعّال: الخطوة التالية المثلى في خطتك الدراسية.`,
    rationaleEn: `Recommended as the optimal progressive step along your knowledge graph. Mastering "${targetNameEn}" unblocks key downstream topics in your curriculum.`,
    rationaleAr: `يُنصح به كالخطوة التالية المثلى في مسارك التعليمي. إتقان "${targetNameAr}" سيفتح لك آفاق المفاهيم المتقدمة المعتمدة عليه.`,
  };
}

/**
 * Pure domain function explaining WHY a retention review is scheduled.
 * Computes memory decay risk and Ebbinghaus interval status.
 */
export function explainRetentionReview(
  conceptId: string,
  state?: StudentState | null,
  now: number = Date.now()
): RetentionRationale {
  const schedule = state?.retentionSchedules?.[conceptId];
  const node = getConcept(conceptId);
  const nameEn = node?.nameEn || conceptId.replace(/_/g, ' ');
  const nameAr = node?.nameAr || conceptId;

  if (!schedule) {
    return {
      conceptId,
      intervalDays: 1,
      daysSinceReview: 0,
      riskLevel: 'medium',
      decayRisk: 0.5,
      urgencyLabelEn: 'Initial Baseline Scheduled',
      urgencyLabelAr: 'جدولة التثبيت المبدئية',
      rationaleEn: `Initial retention schedule pending for "${nameEn}". Spaced review will calibrate automatically upon your next practice.`,
      rationaleAr: `جدول التثبيت المبدئي قيد الإعداد لـ "${nameAr}". سيتم ضبط فترات التكرار المتباعد تلقائيًا بعد جلستك القادمة.`,
    };
  }

  const intervalDays = schedule.intervalDays || 1;
  const lastReview = schedule.lastReviewDate || now;
  const nextReview = typeof schedule.nextReviewDate === 'number'
    ? schedule.nextReviewDate
    : new Date(schedule.nextReviewDate).getTime();

  const daysSinceReview = Math.max(0, Math.floor((now - lastReview) / (24 * 60 * 60 * 1000)));
  const isOverdue = now >= nextReview || schedule.status === 'regressed';
  const hoursUntilReview = (nextReview - now) / (1000 * 60 * 60);

  let riskLevel: RetentionRationale['riskLevel'] = 'low';
  let decayRisk = 0.2;

  if (isOverdue || schedule.status === 'regressed') {
    riskLevel = 'high';
    const overdueDays = Math.max(1, Math.floor((now - nextReview) / (24 * 60 * 60 * 1000)));
    decayRisk = Math.min(0.95, 0.7 + overdueDays * 0.05);
  } else if (hoursUntilReview <= 48) {
    riskLevel = 'medium';
    decayRisk = 0.55;
  } else {
    riskLevel = 'low';
    decayRisk = 0.2;
  }

  if (riskLevel === 'high') {
    return {
      conceptId,
      intervalDays,
      daysSinceReview,
      riskLevel: 'high',
      decayRisk,
      urgencyLabelEn: 'Review Overdue (High Decay Risk)',
      urgencyLabelAr: 'المراجعة مستحقة الآن (خطر تلاشي الذاكرة)',
      rationaleEn: `Spaced review for "${nameEn}" is overdue (${daysSinceReview} days elapsed vs. ${intervalDays}-day interval). Immediate active recall is necessary to halt memory decay along the Ebbinghaus forgetting curve.`,
      rationaleAr: `مراجعة التثبيت المتباعد لـ "${nameAr}" مستحقة الآن (انقضى ${daysSinceReview} أيام مقارنة بفاصل ${intervalDays} أيام). الاسترجاع النشط الفوري ضروري لوقف تلاشي المعلومات وفق منحنى النسيان.`,
    };
  }

  if (riskLevel === 'medium') {
    return {
      conceptId,
      intervalDays,
      daysSinceReview,
      riskLevel: 'medium',
      decayRisk,
      urgencyLabelEn: 'Review Approaching (< 48h)',
      urgencyLabelAr: 'المراجعة تقترب (خلال ٤٨ ساعة)',
      rationaleEn: `"${nameEn}" is entering its optimal retention consolidation window (${daysSinceReview} days of ${intervalDays}-day cycle). A quick refresher will reinforce long-term synaptic retrieval.`,
      rationaleAr: `يقترب موعد تثبيت "${nameAr}" في الذاكرة طويلة المدى (مضى ${daysSinceReview} من ${intervalDays} أيام). جلسة تذكير سريعة ستعزز مسارات الاسترجاع المعرفي بكفاءة.`,
    };
  }

  const daysRemaining = Math.max(1, Math.ceil((nextReview - now) / (24 * 60 * 60 * 1000)));
  return {
    conceptId,
    intervalDays,
    daysSinceReview,
    riskLevel: 'low',
    decayRisk,
    urgencyLabelEn: 'Consolidated & Stable',
    urgencyLabelAr: 'المفهوم مثبت ومستقر',
    rationaleEn: `"${nameEn}" is well-consolidated in active memory (${daysRemaining} days remaining in current ${intervalDays}-day interval). No immediate intervention required.`,
    rationaleAr: `المفهوم "${nameAr}" مثبت ومستقر في الذاكرة النشطة (متبقي ${daysRemaining} أيام في دورة الـ ${intervalDays} أيام). لا يتطلب تدخلاً حالياً.`,
  };
}

/**
 * Synthesizes recurring mistakes from StudentState with actionable remediation tips.
 * Returns a list of structured CommonMistakeItem objects ready for UI display.
 */
export function synthesizeCommonMistakes(state?: StudentState | null): CommonMistakeItem[] {
  if (!state?.conceptMastery) return [];

  const mistakeMap: Record<string, { count: number; concepts: Set<string> }> = {};

  for (const [conceptId, record] of Object.entries(state.conceptMastery)) {
    if (record.mistakeTypes && Array.isArray(record.mistakeTypes)) {
      const numMistakes = record.mistakeTypes.length;
      const incorrectAttempts = Math.max(1, (record.attempts || 0) - (record.correct || 0));
      for (const m of record.mistakeTypes) {
        if (!m) continue;
        const clean = m.trim().toLowerCase();
        if (!mistakeMap[clean]) {
          mistakeMap[clean] = { count: 0, concepts: new Set() };
        }
        const weight = numMistakes === 1 ? incorrectAttempts : 1;
        mistakeMap[clean].count += weight;
        mistakeMap[clean].concepts.add(conceptId);
      }
    }
  }

  // Also inspect intervention history for struggle patterns
  if (state.interventionHistory && Array.isArray(state.interventionHistory)) {
    for (const h of state.interventionHistory) {
      if (h.outcome === 'struggle') {
        const synthesizedKey = `${h.conceptId}_struggle`;
        // Only add if not already covered by explicit mistake types
        if (!mistakeMap[synthesizedKey]) {
          mistakeMap[synthesizedKey] = { count: 1, concepts: new Set([h.conceptId]) };
        } else {
          mistakeMap[synthesizedKey].count += 1;
          mistakeMap[synthesizedKey].concepts.add(h.conceptId);
        }
      }
    }
  }

  const items: CommonMistakeItem[] = [];

  for (const [mId, data] of Object.entries(mistakeMap)) {
    const catalogEntry = COMMON_MISTAKES_CATALOG[mId];
    const conceptsList = Array.from(data.concepts);

    if (catalogEntry) {
      items.push({
        id: mId,
        nameEn: catalogEntry.nameEn,
        nameAr: catalogEntry.nameAr,
        count: data.count,
        conceptsInvolved: conceptsList,
        descriptionEn: catalogEntry.descriptionEn,
        descriptionAr: catalogEntry.descriptionAr,
        remediationTipEn: catalogEntry.remediationTipEn,
        remediationTipAr: catalogEntry.remediationTipAr,
        suggestedActionEn: catalogEntry.suggestedActionEn,
        suggestedActionAr: catalogEntry.suggestedActionAr,
      });
    } else {
      // Dynamic fallback for custom mistake types
      const readableName = mId.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      items.push({
        id: mId,
        nameEn: readableName,
        nameAr: `خطأ في نمط: ${readableName}`,
        count: data.count,
        conceptsInvolved: conceptsList,
        descriptionEn: `Repeated cognitive friction observed around ${readableName} across ${data.count} exercise attempt(s).`,
        descriptionAr: `تكرار الصعوبة حول نمط ${readableName} عبر ${data.count} محاولة تمرين.`,
        remediationTipEn: `Break down the problem into smaller verifiable sub-goals and test with simple edge cases.`,
        remediationTipAr: `قسّم المسألة إلى خطوات فرعية يمكن التحقق منها واختبر مع حالات بسيطة وحالات الحافة.`,
        suggestedActionEn: `Review the worked examples and trace step-by-step logic.`,
        suggestedActionAr: `راجع المسائل النموذجية المحلولة وتتبع منطق التنفيذ خطوة بخطوة.`,
      });
    }
  }

  // Sort by frequency count descending
  return items.sort((a, b) => b.count - a.count);
}
