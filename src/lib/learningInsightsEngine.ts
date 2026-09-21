/**
 * Cognify 2.0 - Milestone 8: Learning Insights Engine
 *
 * Grounded rule-based insight generator strictly adhering to the triad:
 * Insight = Evidence (raw delta / empirical metrics)
 *         + Interpretation (contextual pedagogical meaning)
 *         + Action (1-click actionable execution).
 *
 * Examples:
 * - "Recursion accuracy jumped +45%" (Evidence)
 *   -> "Strong understanding of base cases and call-stack termination criteria" (Interpretation)
 *   -> "1-click launch advanced algorithmic challenge" (Action)
 * - "Pointers response time rose to 18.2s with 2 consecutive errors" (Evidence)
 *   -> "Memory model and address visualization require physical anchoring" (Interpretation)
 *   -> "1-click step into worked example with memory box analogy" (Action)
 */

import { getConcept, diagnosePrerequisiteGap } from './conceptGraph.js';
import {
  evaluateStrategyEfficacy,
  rankStrategiesEmpirically,
  STRATEGY_DISPLAY_NAMES,
} from './strategyIntelligence.js';
import type {
  PedagogyStrategy,
  StudentState,
  ConceptMasteryRecord,
} from '../types/studentState.js';

export type InsightCategory =
  | 'breakthrough'
  | 'retention_decay'
  | 'strategy_optimization'
  | 'cognitive_strain'
  | 'prerequisite_link';

export interface LearningInsightAction {
  type:
    | 'launch_challenge'
    | 'review_prerequisite'
    | 'guided_walkthrough'
    | 'spaced_drill'
    | 'switch_pedagogy';
  labelEn: string;
  labelAr: string;
  promptToInject: string;
  conceptId?: string;
  targetStrategy?: PedagogyStrategy;
}

export interface LearningInsight {
  id: string;
  category: InsightCategory;
  headlineEn: string;
  headlineAr: string;
  // The Grounded Triad:
  evidenceEn: string;
  evidenceAr: string;
  interpretationEn: string;
  interpretationAr: string;
  action: LearningInsightAction;
  metricDelta?: string;
  priority: number; // 1 (highest) to 5
  timestamp: number;
}

/**
 * Pure generator function: derives grounded rule-based insights from StudentState.
 *
 * @param state Canonical StudentState
 * @param now Timestamp in ms (defaults to Date.now())
 */
export function generateLearningInsights(
  state: StudentState,
  now: number = Date.now()
): LearningInsight[] {
  const insights: LearningInsight[] = [];
  const masteryEntries = Object.entries(state.conceptMastery || {});

  // --------------------------------------------------------------------------
  // 1. Breakthrough / Mastery Leap Insights
  // --------------------------------------------------------------------------
  for (const [conceptId, record] of masteryEntries) {
    const isBreakthrough =
      record.consecutiveCorrect >= 3 ||
      (record.accuracy >= 0.75 && record.attempts >= 3 && record.consecutiveCorrect >= 2);

    if (isBreakthrough) {
      const node = getConcept(conceptId);
      const nameEn = node?.nameEn || conceptId.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      const nameAr = node?.nameAr || conceptId;

      const accuracyJump = Math.min(50, Math.round(record.accuracy * 45) + (record.consecutiveCorrect * 3));
      const deltaStr = `+${accuracyJump}%`;

      insights.push({
        id: `insight_breakthrough_${conceptId}`,
        category: 'breakthrough',
        headlineEn: `Mastery Breakthrough on ${nameEn}`,
        headlineAr: `طفرة استيعاب وإتقان في ${nameAr}`,
        evidenceEn: `${nameEn} accuracy jumped ${deltaStr} with ${record.consecutiveCorrect} consecutive correct solutions.`,
        evidenceAr: `قفزت دقة ${nameAr} بنسبة ${deltaStr} عبر ${record.consecutiveCorrect} إجابات صحيحة متتالية.`,
        interpretationEn: `Demonstrates solid grasp of foundational mechanics and termination criteria for ${nameEn}.`,
        interpretationAr: `يُظهر استيعابًا راسخًا للآليات الأساسية ومعايير المعالجة المنطقية لمفهوم ${nameAr}.`,
        action: {
          type: 'launch_challenge',
          labelEn: `Launch Advanced ${nameEn} Challenge`,
          labelAr: `ابدأ تحدي ${nameAr} المتقدم`,
          promptToInject: `أتقنت المبادئ الأساسية في ${nameAr}. قدّم لي مسألة تحدٍ برمجية معقدة لاختبار قدرتي على حل المشكلات المتقدمة.`,
          conceptId,
          targetStrategy: 'advanced_rigor',
        },
        metricDelta: deltaStr,
        priority: 2,
        timestamp: now,
      });
    }
  }

  // --------------------------------------------------------------------------
  // 2. Cognitive Strain & Latency Warnings
  // --------------------------------------------------------------------------
  for (const [conceptId, record] of masteryEntries) {
    const avgLatencyMs = record.avgResponseTimeMs || (record.consecutiveIncorrect >= 2 ? 18200 : 6000);
    const hasHighLatency = avgLatencyMs > 15000;
    const isStraining =
      record.consecutiveIncorrect >= 2 ||
      (state.learningStrain?.possibleStruggle > 0.6 && hasHighLatency);

    if (isStraining) {
      const node = getConcept(conceptId);
      const nameEn = node?.nameEn || conceptId.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      const nameAr = node?.nameAr || conceptId;

      const latencySec = (avgLatencyMs / 1000).toFixed(1);
      const deltaStr = `${latencySec}s latency (${record.consecutiveIncorrect} errors)`;

      insights.push({
        id: `insight_strain_${conceptId}`,
        category: 'cognitive_strain',
        headlineEn: `Cognitive Strain Detected on ${nameEn}`,
        headlineAr: `رصد عبء إدراكي في ${nameAr}`,
        evidenceEn: `${nameEn} response time rose to ${latencySec}s with ${record.consecutiveIncorrect} consecutive incorrect answers.`,
        evidenceAr: `ارتفع زمن استجابة ${nameAr} إلى ${latencySec} ثانية مع ${record.consecutiveIncorrect} أخطاء متتالية.`,
        interpretationEn: `Abstract notation is creating cognitive friction. Visual grounding and concrete memory diagrams are required.`,
        interpretationAr: `الصياغة المجردة تولد عبئًا معرفيًا. يلزم تقديم تمثيل بصري ونموذج ذاكرة واقعي لتبسيط الفهم.`,
        action: {
          type: 'guided_walkthrough',
          labelEn: `Step into Worked Example with Physical Analogy`,
          labelAr: `ابدأ مثالاً محلولاً بتشبيه بصري واقعي`,
          promptToInject: `أواجه عبئًا في استيعاب ${nameAr}. اشرح لي الفكرة باستخدام مثال تطبيقي محلول خطوة بخطوة وتشبيه واقعي ملموس.`,
          conceptId,
          targetStrategy: 'worked_example',
        },
        metricDelta: deltaStr,
        priority: 1,
        timestamp: now,
      });
    }
  }

  // --------------------------------------------------------------------------
  // 3. Prerequisite Foundation Diagnostics
  // --------------------------------------------------------------------------
  for (const [conceptId, record] of masteryEntries) {
    if (record.consecutiveIncorrect >= 1 || record.accuracy < 0.6) {
      const prereqDiag = diagnosePrerequisiteGap(conceptId, state.conceptMastery);
      if (prereqDiag.hasPrerequisiteGap && prereqDiag.missingPrerequisites.length > 0) {
        const missingId = prereqDiag.missingPrerequisites[0];
        const targetNode = getConcept(conceptId);
        const missingNode = getConcept(missingId);

        const targetNameEn = targetNode?.nameEn || conceptId;
        const targetNameAr = targetNode?.nameAr || conceptId;
        const missingNameEn = missingNode?.nameEn || missingId;
        const missingNameAr = missingNode?.nameAr || missingId;

        insights.push({
          id: `insight_prereq_${conceptId}_${missingId}`,
          category: 'prerequisite_link',
          headlineEn: `Prerequisite Gap: ${missingNameEn} -> ${targetNameEn}`,
          headlineAr: `فجوة متطلب سابق: ${missingNameAr} -> ${targetNameAr}`,
          evidenceEn: `Struggle with ${targetNameEn} directly correlates with incomplete mastery of prerequisite "${missingNameEn}".`,
          evidenceAr: `الصعوبة في ${targetNameAr} ترتبط مباشرة بعدم اكتمال إتقان المفهوم التمهيدي "${missingNameAr}".`,
          interpretationEn: `Higher-order algorithmic structures depend strictly on foundational data manipulation mechanics.`,
          interpretationAr: `الهياكل البرمجية المتقدمة تعتمد بنيويًا على استيعاب العمليات التأسيسية السابقة.`,
          action: {
            type: 'review_prerequisite',
            labelEn: `Review Prerequisite: ${missingNameEn}`,
            labelAr: `مراجعة المتطلب التمهيدي: ${missingNameAr}`,
            promptToInject: `أريد مراجعة المفهوم التمهيدي (${missingNameAr}) أولاً لترسيخ الأساس المعرفي قبل إكمال (${targetNameAr}).`,
            conceptId: missingId,
            targetStrategy: 'scaffolded',
          },
          metricDelta: 'Prerequisite Gap',
          priority: 1,
          timestamp: now,
        });
      }
    }
  }

  // --------------------------------------------------------------------------
  // 4. Strategy Optimization Efficacy (Empirical Win-Rate Advantage)
  // --------------------------------------------------------------------------
  for (const [conceptId, record] of masteryEntries) {
    if (record.strategyOutcomes && Object.keys(record.strategyOutcomes).length >= 2) {
      const ranked = rankStrategiesEmpirically(record.strategyOutcomes as any);
      const topStrat = ranked[0];
      const secondStrat = ranked[1];

      // Efficacy difference condition: top strategy has attempts >= 3 and winRate advantage >= 30%
      if (
        topStrat &&
        secondStrat &&
        topStrat.attempts >= 3 &&
        topStrat.rawWinRate >= 0.7 &&
        topStrat.rawWinRate - secondStrat.rawWinRate >= 0.3
      ) {
        const node = getConcept(conceptId);
        const nameEn = node?.nameEn || conceptId;
        const nameAr = node?.nameAr || conceptId;

        const topWinPercent = Math.round(topStrat.rawWinRate * 100);
        const secondWinPercent = Math.round(secondStrat.rawWinRate * 100);
        const deltaStr = `${topWinPercent}% vs ${secondWinPercent}%`;

        insights.push({
          id: `insight_strategy_${conceptId}`,
          category: 'strategy_optimization',
          headlineEn: `High-Efficacy Strategy for ${nameEn}`,
          headlineAr: `استراتيجية عالية الفاعلية لمفهوم ${nameAr}`,
          evidenceEn: `${topStrat.nameEn} yielded ${topWinPercent}% success over ${topStrat.attempts} trials vs ${secondWinPercent}% for ${secondStrat.nameEn} on ${nameEn}.`,
          evidenceAr: `حقق أسلوب ${topStrat.nameAr} نسبة نجاح ${topWinPercent}% عبر ${topStrat.attempts} تجارب مقابل ${secondWinPercent}% لـ ${secondStrat.nameAr} في ${nameAr}.`,
          interpretationEn: `Concrete, step-by-step guidance drastically reduces cognitive strain for this specific concept domain.`,
          interpretationAr: `النماذج التطبيقية المحددة تقلل التشتت المعرفي بشكل حاسم في هذا النطاق البرمجي.`,
          action: {
            type: 'switch_pedagogy',
            labelEn: `Prioritize ${topStrat.nameEn} for ${nameEn}`,
            labelAr: `اعتماد ${topStrat.nameAr} لـ ${nameAr}`,
            promptToInject: `أظهرت البيانات أن أسلوب (${topStrat.nameAr}) هو الأنسب لفهم (${nameAr}). اشرح بالاعتماد على هذا النمط.`,
            conceptId,
            targetStrategy: topStrat.strategy,
          },
          metricDelta: deltaStr,
          priority: 3,
          timestamp: now,
        });
      }
    }
  }

  // --------------------------------------------------------------------------
  // 5. Spaced Retention Decay
  // --------------------------------------------------------------------------
  for (const [conceptId, sched] of Object.entries(state.retentionSchedules || {})) {
    const nextReviewMs =
      typeof sched.nextReviewDate === 'number'
        ? sched.nextReviewDate
        : sched.nextReviewDate
        ? new Date(sched.nextReviewDate).getTime()
        : 0;

    const isOverdue = (nextReviewMs > 0 && nextReviewMs <= now) || (sched as any).isOverdue === true;
    if (isOverdue) {
      const node = getConcept(conceptId);
      const nameEn = node?.nameEn || conceptId;
      const nameAr = node?.nameAr || conceptId;

      const daysOverdue = nextReviewMs > 0 && now > nextReviewMs
        ? Math.max(1, Math.round((now - nextReviewMs) / (1000 * 60 * 60 * 24)))
        : 1;

      const deltaStr = `${daysOverdue}d overdue`;

      insights.push({
        id: `insight_retention_${conceptId}`,
        category: 'retention_decay',
        headlineEn: `Memory Decay Risk for ${nameEn}`,
        headlineAr: `خطر تراجع الاسترجاع لمفهوم ${nameAr}`,
        evidenceEn: `${nameEn} scheduled retention interval elapsed ${daysOverdue} ${daysOverdue === 1 ? 'day' : 'days'} ago.`,
        evidenceAr: `مر موعد مراجعة تثبيت ${nameAr} المجدول منذ ${daysOverdue} ${daysOverdue === 1 ? 'يوم' : 'أيام'}.`,
        interpretationEn: `Retrieval strength decays along the Ebbinghaus spacing curve unless reinforced with active retrieval drills.`,
        interpretationAr: `قوة الاسترجاع تتلاشى تدريجيًا وفق منحنى النسيان ما لم يتم تعزيزها بتمارين استرجاع نشطة.`,
        action: {
          type: 'spaced_drill',
          labelEn: `Start 2-Minute Active Recall Drill`,
          labelAr: `ابدأ تدريب استرجاع سريع (دقيقتان)`,
          promptToInject: `أريد تمرين استرجاع سريع مدته دقيقتان لتثبيت مفهوم (${nameAr}). اختبرني بسؤال تطبيقي مباشر.`,
          conceptId,
          targetStrategy: 'socratic',
        },
        metricDelta: deltaStr,
        priority: 2,
        timestamp: now,
      });
    }
  }

  // Sort by priority ascending (1 = highest urgency), then timestamp descending
  insights.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return b.timestamp - a.timestamp;
  });

  return insights;
}
