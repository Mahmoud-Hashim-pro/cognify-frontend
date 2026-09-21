/**
 * Student Intelligence Profile View
 * Phase 2C - Sprint 1 (Intelligence -> Product)
 *
 * Visualizes the canonical PersonalLearningProfile contract:
 * - Concept Mastery progress bars (percentages)
 * - Current Focus & Prerequisite Diagnosis
 * - Effective Strategies with Sample Size Guard (N >= 3)
 * - Retention Health & Spaced Review Recommendations
 * - Recent Progress & Mastery Deltas
 * - Ethical Non-IQ Guardrail Callout
 *
 * Aesthetic: Deep obsidian canvas (#0A0C14), glassmorphic slate cards (#121524),
 * ambient glow, responsive RTL/LTR bilingual support.
 */

import React from 'react';
import { UserProfile } from '../types';
import { localize, isArabicLocale } from '../lib/translations';
import { useLearningProfile } from '../services/learningProfileClient';
import {
  Brain,
  Sparkles,
  Target,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  TrendingUp,
  ShieldCheck,
  Clock,
  Layers,
  Award,
  BookOpen,
  HelpCircle,
  Menu,
  ArrowLeft,
  ArrowRight,
  Zap,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';
import type { PedagogyStrategy } from '../types/studentState';
import ProactiveSuggestionCard from './ProactiveSuggestionCard';
import { useStudentState } from '../lib/useStudentState';
import { detectProactiveOpportunities } from '../lib/proactiveAssistantEngine';
import { generateLearningInsights } from '../lib/learningInsightsEngine';
import {
  explainRecommendation,
  synthesizeCommonMistakes,
} from '../lib/explainabilityEngine';
import {
  rankStrategiesEmpirically,
  ANTI_OVERCLAIMING_DISCLAIMER_EN,
  ANTI_OVERCLAIMING_DISCLAIMER_AR,
} from '../lib/strategyIntelligence';

interface StudentIntelligenceProfileViewProps {
  profile: UserProfile;
  onMenuClick?: () => void;
  onNavigateBack?: () => void;
}

const STRATEGY_METADATA: Record<
  PedagogyStrategy,
  { nameEn: string; nameAr: string; descEn: string; descAr: string; icon: any }
> = {
  worked_example: {
    nameEn: 'Worked Examples',
    nameAr: 'أمثلة عملية محلولة خطوة بخطوة',
    descEn: 'Concrete step-by-step code demonstrations before abstract concepts.',
    descAr: 'تطبيق برمجي عملي موضح خطوة بخطوة قبل الخوض في النظريات.',
    icon: BookOpen,
  },
  analogies: {
    nameEn: 'Conceptual Analogies',
    nameAr: 'التشبيهات والأمثلة الواقعية',
    descEn: 'Real-world physical metaphors to bridge abstract computing ideas.',
    descAr: 'تقريب المفاهيم البرمجية المجردة بتشبيهات ملموسة من الحياة اليومية.',
    icon: Sparkles,
  },
  scaffolded: {
    nameEn: 'Scaffolded Breakdown',
    nameAr: 'التفكيك المتدرج (Scaffolding)',
    descEn: 'Breaking complex architectures into bite-sized, digestible milestones.',
    descAr: 'تقسيم المشكلات الهندسية المركبة إلى خطوات تدريجية مبسطة.',
    icon: Layers,
  },
  socratic: {
    nameEn: 'Socratic Inquiry',
    nameAr: 'الأسئلة السقراطية التوجيهية',
    descEn: 'Guiding self-discovery through thought-provoking micro-questions.',
    descAr: 'تحفيز التفكير النقدي والاكتشاف الذاتي عبر أسئلة توجيهية ذكية.',
    icon: HelpCircle,
  },
  advanced_rigor: {
    nameEn: 'Formal & Mathematical Rigor',
    nameAr: 'الدقة النظرية والرياضية العميقة',
    descEn: 'In-depth algorithmic analysis, formal notation, and low-level mechanics.',
    descAr: 'تحليل خوارزمي عميق ورياضي مع التركيز على دقة المعايير المتقدمة.',
    icon: Award,
  },
};

export default function StudentIntelligenceProfileView({
  profile,
  onMenuClick,
  onNavigateBack,
}: StudentIntelligenceProfileViewProps) {
  const isAr = isArabicLocale(profile.language);
  const { profile: learningProfile, loading, refresh } = useLearningProfile(
    profile.uid,
    profile.name
  );
  const { studentState } = useStudentState(profile.uid, profile.level);

  const proactiveOpportunities = React.useMemo(() => {
    if (!studentState) return [];
    return detectProactiveOpportunities(studentState, Date.now(), { maxOpportunities: 2 });
  }, [studentState]);

  const learningInsights = React.useMemo(() => {
    if (!studentState) return [];
    return generateLearningInsights(studentState, Date.now()).slice(0, 2);
  }, [studentState]);

  const calibratedStrategiesMap = React.useMemo(() => {
    if (!studentState) return {};
    const map: Partial<Record<PedagogyStrategy, { attempts: number; successes: number }>> = {};
    if (studentState.pedagogyEffectiveness) {
      for (const [k, v] of Object.entries(studentState.pedagogyEffectiveness)) {
        map[k as PedagogyStrategy] = {
          attempts: (v.helpfulCount || 0) + (v.unhelpfulCount || 0),
          successes: v.helpfulCount || 0,
        };
      }
    }
    const ranked = rankStrategiesEmpirically(map);
    const lookup: Record<string, (typeof ranked)[0]> = {};
    for (const r of ranked) {
      lookup[r.strategy] = r;
    }
    return lookup;
  }, [studentState]);

  const ArrowIcon = isAr ? ArrowRight : ArrowLeft;
  const allConceptSummaries = Object.values(learningProfile.conceptProfiles || {});
  const dueRetentionCount = (learningProfile.retentionAlerts || []).filter((a) => a.isDue).length;

  const [showFocusExplain, setShowFocusExplain] = React.useState(false);

  const focusRationale = React.useMemo(() => {
    if (!learningProfile.currentFocus) return null;
    return explainRecommendation(learningProfile.currentFocus.conceptId, studentState);
  }, [learningProfile.currentFocus, studentState]);

  const commonMistakes = React.useMemo(() => {
    return synthesizeCommonMistakes(studentState);
  }, [studentState]);

  return (
    <div
      className="flex-1 flex flex-col bg-[#0A0C14] text-slate-100 relative overflow-y-auto font-sans custom-scrollbar min-h-screen"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {/* Ambient Glow Lighting Orbs */}
      <div className="absolute top-0 left-1/4 w-[420px] h-[420px] bg-cyan-500/10 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 left-1/3 w-[360px] h-[360px] bg-violet-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Top Header Bar */}
      <header className="sticky top-0 z-20 bg-[#0A0C14]/80 backdrop-blur-xl border-b border-slate-800/80 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {onMenuClick && (
            <button
              onClick={onMenuClick}
              className="lg:hidden p-2 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-400 hover:text-white"
              aria-label="Toggle menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          {onNavigateBack && (
            <button
              onClick={onNavigateBack}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 text-xs font-medium transition-all"
            >
              <ArrowIcon className="w-4 h-4" />
              <span>{localize(profile.language, 'Back', 'رجوع')}</span>
            </button>
          )}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  {localize(
                    profile.language,
                    'My Learning Intelligence',
                    'الملف المعرفي الذكي'
                  )}
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                  {learningProfile.overallMasteryPercentage}% {localize(profile.language, 'Mastery', 'إتقان')}
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                {localize(
                  profile.language,
                  'Personalized cognitive calibration and adaptive strategy mapping',
                  'المخطط الإدراكي التكيفي ونموذج استيعاب المفاهيم'
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refresh()}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 text-xs text-slate-300 hover:text-white transition-all active:scale-95 disabled:opacity-50"
            title={localize(profile.language, 'Refresh Profile', 'تحديث البيانات')}
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            <span className="hidden sm:inline">
              {localize(profile.language, 'Sync', 'مزامنة')}
            </span>
          </button>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 relative z-10">
        {/* Quick Stats Overview Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-[#121524]/90 border border-slate-800/80 backdrop-blur-xl shadow-xl">
            <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1">
              {localize(profile.language, 'Mastered Concepts', 'المفاهيم المتقنة')}
            </div>
            <div className="text-2xl font-bold text-emerald-400">
              {learningProfile.masteredConcepts?.length || 0}
              <span className="text-xs font-normal text-slate-400 ms-1.5">
                / {allConceptSummaries.length}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#121524]/90 border border-slate-800/80 backdrop-blur-xl shadow-xl">
            <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1">
              {localize(profile.language, 'Under Practice', 'قيد التدريب')}
            </div>
            <div className="text-2xl font-bold text-cyan-400">
              {learningProfile.developingConcepts?.length || 0}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#121524]/90 border border-slate-800/80 backdrop-blur-xl shadow-xl">
            <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1">
              {localize(profile.language, 'Retention Reviews Due', 'مراجعات التثبيت المستحقة')}
            </div>
            <div className="text-2xl font-bold text-amber-400">
              {dueRetentionCount}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#121524]/90 border border-slate-800/80 backdrop-blur-xl shadow-xl">
            <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1">
              {localize(profile.language, 'Overall Confidence', 'معدل الثقة العام')}
            </div>
            <div className="text-2xl font-bold text-indigo-400">
              {learningProfile.overallConfidencePercentage}%
            </div>
          </div>
        </div>

        {/* Proactive Assistant Opportunities & Grounded Insights Section */}
        {(proactiveOpportunities.length > 0 || learningInsights.length > 0) && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <h2 className="text-lg font-bold text-white">
                  {localize(
                    profile.language,
                    'Proactive Learning Opportunities & Insights',
                    'فرص التعلم الاستباقية والرؤى الإدراكية'
                  )}
                </h2>
              </div>
              <span className="text-xs text-slate-400">
                {proactiveOpportunities.length + learningInsights.length}{' '}
                {localize(profile.language, 'signals active', 'إشارات نشطة')}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {proactiveOpportunities.map((opp) => (
                <ProactiveSuggestionCard
                  key={opp.id}
                  opportunity={opp}
                  language={profile.language}
                  onAccept={() => {
                    if (onNavigateBack) onNavigateBack();
                  }}
                />
              ))}
              {learningInsights.map((insight) => (
                <ProactiveSuggestionCard
                  key={insight.id}
                  insight={insight}
                  language={profile.language}
                  onAccept={() => {
                    if (onNavigateBack) onNavigateBack();
                  }}
                />
              ))}
            </div>
          </section>
        )}

        {/* Section 1: Current Focus & Prerequisite Diagnosis */}
        {learningProfile.currentFocus && (
          <section className="p-6 rounded-3xl bg-gradient-to-br from-[#13192f]/95 to-[#121524]/90 border border-slate-800/90 backdrop-blur-xl shadow-2xl relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-2 max-w-2xl">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">
                    <Target className="w-3.5 h-3.5" />
                    <span>{localize(profile.language, 'Current Focus', 'محور التركيز الحالي')}</span>
                  </div>

                  {focusRationale && (
                    <button
                      type="button"
                      onClick={() => setShowFocusExplain(!showFocusExplain)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all active:scale-95 border ${
                        showFocusExplain
                          ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200 shadow-sm shadow-cyan-500/20'
                          : 'bg-slate-900/80 hover:bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                      }`}
                      title={localize(profile.language, 'Pedagogical reasoning behind this recommendation', 'التعليل التربوي لاختيار هذا المفهوم')}
                    >
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      <span>{localize(profile.language, 'Why this focus?', 'لماذا هذا التركيز؟')}</span>
                      <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${showFocusExplain ? 'rotate-180 text-cyan-300' : 'text-slate-400'}`} />
                    </button>
                  )}
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-white">
                  {isAr
                    ? learningProfile.currentFocus.conceptNameAr
                    : learningProfile.currentFocus.conceptNameEn}
                </h2>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {isAr
                    ? learningProfile.currentFocus.reasonAr
                    : learningProfile.currentFocus.reasonEn}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0">
                <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">
                    {localize(profile.language, 'Adaptive Strategy', 'الاستراتيجية الموجهة')}
                  </div>
                  <div className="text-xs font-semibold text-cyan-300 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    {isAr
                      ? STRATEGY_METADATA[learningProfile.currentFocus.recommendedStrategy]?.nameAr ||
                        learningProfile.currentFocus.recommendedStrategy
                      : STRATEGY_METADATA[learningProfile.currentFocus.recommendedStrategy]?.nameEn ||
                        learningProfile.currentFocus.recommendedStrategy}
                  </div>
                </div>
              </div>
            </div>

            {/* Explainable Intelligence Rationale Panel */}
            {showFocusExplain && focusRationale && (
              <div className="mt-4 p-5 rounded-2xl bg-[#0d111f]/95 border border-cyan-500/40 backdrop-blur-xl shadow-xl space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider">
                      {localize(profile.language, 'Explainable Intelligence Rationale', 'التعليل التربوي لاختيار هذا التركيز')}
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                    focusRationale.isPrerequisiteGap
                      ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                      : 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300'
                  }`}>
                    {focusRationale.isPrerequisiteGap
                      ? localize(profile.language, 'Prerequisite Root Gap', 'فجوة متطلب تأسيسي')
                      : localize(profile.language, 'Direct Concept Mastery', 'تثبيت مباشر للمفهوم')}
                  </span>
                </div>

                {/* Prerequisite Chain visualization if gap exists */}
                {focusRationale.isPrerequisiteGap && focusRationale.prerequisiteChain && (
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-2 text-xs flex-wrap">
                    <span className="text-slate-400 font-medium">
                      {localize(profile.language, 'Dependency Chain:', 'مسار التبعية:')}
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {focusRationale.prerequisiteChain.map((cid, cidx) => {
                        const isLast = cidx === focusRationale.prerequisiteChain!.length - 1;
                        const isRoot = cidx === 0;
                        return (
                          <React.Fragment key={cid}>
                            <span className={`px-2 py-0.5 rounded-lg text-[11px] font-bold border ${
                              isRoot
                                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                                : isLast
                                ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                                : 'bg-slate-800 border-slate-700 text-slate-300'
                            }`}>
                              {cid}
                            </span>
                            {!isLast && <span className="text-slate-500 text-xs">➔</span>}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                )}

                <p className="text-xs text-slate-200 leading-relaxed font-medium">
                  {isAr ? focusRationale.rationaleAr : focusRationale.rationaleEn}
                </p>

                <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-1 border-t border-slate-800/60">
                  <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>
                    {isAr ? focusRationale.diagnosisSummaryAr : focusRationale.diagnosisSummaryEn}
                  </span>
                </div>
              </div>
            )}

            {/* Prerequisite Alert Callout */}
            {learningProfile.currentFocus.prerequisiteToReview && (
              <div className="mt-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-amber-300">
                    {localize(
                      profile.language,
                      'Foundational Prerequisite Gap Diagnosed',
                      'تم تشخيص فجوة في المتطلب التأسيسي'
                    )}
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    {localize(
                      profile.language,
                      `We recommend reviewing "${learningProfile.currentFocus.prerequisiteToReview.conceptNameEn}" first to solidify your foundation.`,
                      `يُنصح بمراجعة "${learningProfile.currentFocus.prerequisiteToReview.conceptNameAr}" أولاً لترسيخ الأساس المعرفي قبل المتابعة.`
                    )}
                  </p>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Section: Strengths (مكامن القوة) & Current Difficulties (الصعوبات الحالية) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card A: Strengths (مكامن القوة ونقاط التميز) */}
          <section className="p-6 rounded-3xl bg-[#121524]/90 border border-slate-800/80 backdrop-blur-xl shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/70 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Award className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">
                    {localize(profile.language, 'Strengths & Mastered Concepts', 'مكامن القوة والمفاهيم المتقنة')}
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    {localize(profile.language, 'High accuracy, fluent velocity, and low cognitive strain', 'دقة عالية، سرعة استجابة وعبء إدراكي منخفض')}
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                {learningProfile.masteredConcepts?.length || 0} {localize(profile.language, 'mastered', 'متقن')}
              </span>
            </div>

            {(learningProfile.masteredConcepts || []).length === 0 ? (
              <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/60 text-center space-y-2">
                <Brain className="w-8 h-8 text-slate-600 mx-auto" />
                <div className="text-xs font-semibold text-slate-300">
                  {localize(profile.language, 'Calibrating Strengths', 'جاري تحديد مكامن القوة')}
                </div>
                <p className="text-[11px] text-slate-400">
                  {localize(
                    profile.language,
                    'Concepts with >= 75% accuracy and consistent streaks will appear here as your verified strengths.',
                    'المفاهيم التي تحقق فيها دقة ٧٥٪ فأعلى مع إجابات متتالية صحيحة ستظهر هنا كنقاط قوة مثبتة.'
                  )}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {learningProfile.masteredConcepts.map((item) => (
                  <div
                    key={item.conceptId}
                    className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-emerald-500/30 transition-all space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold text-white">
                          {isAr ? item.conceptNameAr : item.conceptNameEn}
                        </div>
                        <div className="text-[10px] text-slate-400 capitalize">
                          {item.conceptId}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                          <ShieldCheck className="w-3 h-3 text-emerald-400" />
                          <span>{localize(profile.language, 'Low Strain', 'استيعاب سلس')}</span>
                        </span>
                        <span className="text-xs font-bold text-emerald-400">
                          {item.masteryPercentage}%
                        </span>
                      </div>
                    </div>

                    {/* Mini Progress Bar */}
                    <div className="w-full h-1.5 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
                        style={{ width: `${item.masteryPercentage}%` }}
                      />
                    </div>

                    <div className="pt-1 flex items-center justify-between text-[10px] text-slate-400">
                      <span>
                        {localize(profile.language, 'Confidence', 'مستوى الثقة')}: <strong className="text-slate-200">{item.confidencePercentage}%</strong>
                      </span>
                      <span>
                        {item.attemptsCount} {localize(profile.language, 'attempts logged', 'محاولات مرصودة')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Card B: Current Difficulties (الصعوبات الحالية ومؤشرات الإجهاد) */}
          <section className="p-6 rounded-3xl bg-[#121524]/90 border border-slate-800/80 backdrop-blur-xl shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/70 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">
                    {localize(profile.language, 'Current Difficulties & Focus Areas', 'الصعوبات الحالية وإشارات الإجهاد')}
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    {localize(profile.language, 'Active struggle signals, latency strain, and remediation targets', 'مؤشرات العبء المعرفي والتعثر وأهداف التدخل التكيفي')}
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-500/10 border border-amber-500/30 text-amber-400">
                {learningProfile.strugglingConcepts?.length || 0} {localize(profile.language, 'focus areas', 'محاور تركيز')}
              </span>
            </div>

            {(learningProfile.strugglingConcepts || []).length === 0 ? (
              <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/60 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <div className="text-xs font-semibold text-slate-200">
                  {localize(profile.language, 'No Active Struggle Detected', 'لا توجد صعوبات معرفية نشطة')}
                </div>
                <p className="text-[11px] text-slate-400">
                  {localize(
                    profile.language,
                    'All actively practiced concepts have satisfied fluency thresholds. Great momentum!',
                    'جميع المفاهيم قيد الممارسة مستقرة وضمن معدلات الاستيعاب السلسة. أداء ممتاز!'
                  )}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {learningProfile.strugglingConcepts.map((item) => (
                  <div
                    key={item.conceptId}
                    className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-amber-500/30 transition-all space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold text-white">
                          {isAr ? item.conceptNameAr : item.conceptNameEn}
                        </div>
                        <div className="text-[10px] text-slate-400 capitalize">
                          {item.conceptId}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {item.commonError && (
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-rose-500/15 border border-rose-500/30 text-rose-300 font-mono">
                            {item.commonError}
                          </span>
                        )}
                        <span className="text-xs font-bold text-amber-400">
                          {item.masteryPercentage}%
                        </span>
                      </div>
                    </div>

                    {/* Mini Progress Bar */}
                    <div className="w-full h-1.5 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-500 to-rose-500"
                        style={{ width: `${Math.max(10, item.masteryPercentage)}%` }}
                      />
                    </div>

                    <div className="pt-1 flex items-center justify-between text-[10px] text-slate-400">
                      <span className="flex items-center gap-1 text-amber-300/90">
                        <AlertTriangle className="w-3 h-3 text-amber-400" />
                        {localize(
                          profile.language,
                          `Latency: ${item.latencyProfile}`,
                          `زمن الاستجابة: ${item.latencyProfile === 'high' ? 'مرتفع (>15ث)' : 'متوسط'}`
                        )}
                      </span>
                      {item.bestStrategy && (
                        <span className="text-cyan-300 font-medium">
                          {localize(profile.language, 'Remedy:', 'العلاج:')} {STRATEGY_METADATA[item.bestStrategy]?.nameEn || item.bestStrategy}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Section: Common Mistakes & Actionable Remediation Tips (الأخطاء الشائعة المتكررة) */}
        <section className="p-6 rounded-3xl bg-[#121524]/90 border border-slate-800/80 backdrop-blur-xl shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/70 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Lightbulb className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">
                  {localize(
                    profile.language,
                    'Synthesized Common Mistakes & Remediation Tips',
                    'الأخطاء الشائعة المتكررة وطرق علاجها'
                  )}
                </h2>
                <p className="text-[11px] text-slate-400">
                  {localize(
                    profile.language,
                    'Observed cognitive error patterns with actionable guidance to prevent recurring friction',
                    'أنماط الأخطاء المتكررة المرصودة في جلساتك مع إرشادات دقيقة لتفاديها'
                  )}
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-indigo-500/10 border border-indigo-500/30 text-indigo-300">
              {commonMistakes.length} {localize(profile.language, 'patterns diagnosed', 'أنماط مشخصة')}
            </span>
          </div>

          {commonMistakes.length === 0 ? (
            <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/60 text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
              <div className="text-xs font-semibold text-slate-200">
                {localize(profile.language, 'Clean Execution History', 'سجل أخطاء نظيف ومثالي')}
              </div>
              <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                {localize(
                  profile.language,
                  'No recurring mistake patterns (like null dereferencing or boundary errors) have been recorded yet. As you solve exercises, Cognify will automatically synthesize patterns here.',
                  'لم يتم رصد أي أنماط أخطاء متكررة (مثل فك إشارة مؤشر فارغ أو أخطاء حدود التكرار) حتى الآن. مع حل التمارين سيقوم كوجنيفاي بتحليل الأخطاء تلقائيًا.'
                )}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {commonMistakes.map((mistake) => (
                <div
                  key={mistake.id}
                  className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition-all space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-bold text-white">
                          {isAr ? mistake.nameAr : mistake.nameEn}
                        </div>
                        <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-rose-500/10 border border-rose-500/30 text-rose-300">
                          {mistake.id}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 border border-amber-500/30 text-amber-300 shrink-0">
                        {mistake.count} {localize(profile.language, 'times', 'مرات')}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">
                      {isAr ? mistake.descriptionAr : mistake.descriptionEn}
                    </p>

                    {mistake.conceptsInvolved.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap pt-1">
                        <span className="text-[10px] text-slate-400 font-medium">
                          {localize(profile.language, 'Seen in:', 'ظهر في:')}
                        </span>
                        {mistake.conceptsInvolved.map((cid) => (
                          <span
                            key={cid}
                            className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300"
                          >
                            {cid}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actionable Remediation Tip Callout */}
                  <div className="p-3.5 rounded-xl bg-gradient-to-r from-cyan-950/40 via-indigo-950/30 to-slate-900/60 border border-cyan-500/30 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-cyan-300">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>{localize(profile.language, 'Actionable Remediation Tip', 'نصيحة العلاج والوقاية')}</span>
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed font-mono text-[11px]">
                      {isAr ? mistake.remediationTipAr : mistake.remediationTipEn}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Section 2: Concept Mastery Progress */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-bold text-white">
                {localize(profile.language, 'Concept Mastery Map', 'خريطة إتقان المفاهيم')}
              </h2>
            </div>
            <span className="text-xs text-slate-400">
              {allConceptSummaries.length}{' '}
              {localize(profile.language, 'concepts tracked', 'مفاهيم مرصودة')}
            </span>
          </div>

          {allConceptSummaries.length === 0 ? (
            <div className="p-8 rounded-3xl bg-[#121524]/90 border border-slate-800/80 text-center space-y-3">
              <Brain className="w-12 h-12 text-slate-600 mx-auto" />
              <div className="text-sm font-semibold text-slate-300">
                {localize(
                  profile.language,
                  'No Concept Mastery Data Yet',
                  'لا توجد بيانات إتقان بعد'
                )}
              </div>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                {localize(
                  profile.language,
                  'Start solving interactive questions in the Chat or Learning Hub. Cognify will track your mastery and confidence automatically.',
                  'ابدأ بحل تمارين تفاعلية في المحادثة أو مركز التعلم. سيرصد كوجنيفاي مستوى إتقانك وثقتك تلقائيًا.'
                )}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {allConceptSummaries.map((item) => {
                const isMastered = item.status === 'mastered';
                const isPracticing = item.status === 'developing';

                const barColor = isMastered
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                  : isPracticing
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-500'
                  : 'bg-gradient-to-r from-amber-500 to-orange-500';

                const statusBadgeColor = isMastered
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : isPracticing
                  ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-400';

                return (
                  <div
                    key={item.conceptId}
                    className="p-5 rounded-2xl bg-[#121524]/90 border border-slate-800/80 backdrop-blur-xl hover:border-slate-700/80 transition-all space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-bold text-white">
                          {isAr ? item.conceptNameAr : item.conceptNameEn}
                        </div>
                        <div className="text-[11px] text-slate-400 capitalize">
                          {item.conceptId}
                        </div>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${statusBadgeColor}`}
                      >
                        {isMastered
                          ? localize(profile.language, 'Mastered', 'متقن')
                          : isPracticing
                          ? localize(profile.language, 'Practicing', 'قيد التدريب')
                          : localize(profile.language, 'Needs Review', 'يحتاج تعزيز')}
                      </span>
                    </div>

                    {/* Progress Bar with Percentage */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-slate-300">
                          {localize(profile.language, 'Mastery', 'نسبة الإتقان')}
                        </span>
                        <span className="text-white">{item.masteryPercentage}%</span>
                      </div>
                      <div className="w-full h-2.5 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                          style={{ width: `${Math.min(100, Math.max(0, item.masteryPercentage))}%` }}
                        />
                      </div>
                    </div>

                    {/* Secondary Metrics */}
                    <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
                      <span>
                        {localize(profile.language, 'Confidence', 'الثقة')}:{' '}
                        <strong className="text-slate-200">{item.confidencePercentage}%</strong>
                      </span>
                      <span>
                        {item.attemptsCount} {localize(profile.language, 'attempts', 'محاولة')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Section 3: Effective Learning Strategies */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-indigo-400" />
              <h2 className="text-lg font-bold text-white">
                {localize(
                  profile.language,
                  'How You Learn Best',
                  'استراتيجيات التعلم الأكثر فاعلية معك'
                )}
              </h2>
            </div>
            <span className="text-xs text-slate-400">
              {localize(
                profile.language,
                'Empirically calibrated per session',
                'معايرة واقعية حسب تفاعلك'
              )}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(learningProfile.effectiveStrategies || []).map((item, idx) => {
              const meta = STRATEGY_METADATA[item.strategy];
              const IconComponent = meta?.icon || BookOpen;

              return (
                <div
                  key={item.strategy}
                  className="p-5 rounded-2xl bg-[#121524]/90 border border-slate-800/80 backdrop-blur-xl hover:border-slate-700/80 transition-all flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                        <IconComponent className="w-4 h-4" />
                      </div>

                      {item.isCalibrating ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800/80 border border-slate-700 text-slate-400">
                          {localize(
                            profile.language,
                            `Calibrating (${item.attemptsCount}/3)`,
                            `جاري المعايرة (${item.attemptsCount}/3)`
                          )}
                        </span>
                      ) : item.isOptimal ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                          {localize(profile.language, 'Optimal Strategy', 'الاستراتيجية المثلى')}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 border border-indigo-500/30 text-indigo-300">
                          #{idx + 1}
                        </span>
                      )}
                    </div>

                    <div className="text-sm font-bold text-white">
                      {isAr ? item.nameAr : item.nameEn}
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                      {isAr ? meta?.descAr : meta?.descEn}
                    </p>
                  </div>

                  {/* Score Progress */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-800/60">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-400 text-[11px]">
                        {localize(profile.language, 'Strategy Efficacy', 'فاعلية الاستراتيجية')}
                      </span>
                      <span className="text-slate-200">{item.scorePercentage}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
                      <div
                        className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(0, item.scorePercentage))}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1 flex justify-between items-center">
                      <span>{isAr ? item.sampleSizeNoteAr : item.sampleSizeNoteEn}</span>
                      {calibratedStrategiesMap[item.strategy]?.calibrationStage === 'calibrated' && (
                        <span className="text-cyan-400 font-medium text-[10px]">
                          Wilson: {Math.round((calibratedStrategiesMap[item.strategy]?.wilsonLowerBound || 0) * 100)}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Anti-Overclaiming Situational Efficacy Disclaimer */}
          <div className="p-4 rounded-2xl bg-[#0e1222] border border-cyan-500/20 text-xs text-slate-300 flex items-start gap-3">
            <Brain className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold text-cyan-300 text-xs">
                {localize(
                  profile.language,
                  'Scientific Anti-Overclaiming Principle (Situational Strategy Efficacy)',
                  'مبدأ الموضوعية العلمية (فاعلية الأساليب السياقية)'
                )}
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {isAr ? ANTI_OVERCLAIMING_DISCLAIMER_AR : ANTI_OVERCLAIMING_DISCLAIMER_EN}
              </p>
            </div>
          </div>
        </section>

        {/* Section 4: Retention Health & Recent Improvement */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Spaced Retention Alerts */}
          <section className="p-6 rounded-3xl bg-[#121524]/90 border border-slate-800/80 backdrop-blur-xl shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-400" />
                <h2 className="text-base font-bold text-white">
                  {localize(
                    profile.language,
                    'Memory & Spaced Retention Health',
                    'صحة التثبيت والذاكرة طويلة المدى'
                  )}
                </h2>
              </div>
              <span className="text-xs font-semibold text-amber-400">
                {dueRetentionCount} {localize(profile.language, 'due', 'مستحق')}
              </span>
            </div>

            {(learningProfile.retentionAlerts || []).length === 0 ? (
              <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/60 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <div className="text-xs font-semibold text-slate-200">
                  {localize(
                    profile.language,
                    'All Concepts Consolidated',
                    'جميع المفاهيم مثبتة ومستقرة'
                  )}
                </div>
                <p className="text-[11px] text-slate-400">
                  {localize(
                    profile.language,
                    'No spaced reviews are overdue today. Great consistency!',
                    'لا توجد مراجعات متأخرة اليوم. تقدمك مستمر ومستقر!'
                  )}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {learningProfile.retentionAlerts.map((alert) => (
                  <div
                    key={alert.conceptId}
                    className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-200">
                        {isAr ? alert.conceptNameAr : alert.conceptNameEn}
                      </div>
                      <div className="text-[10px] text-amber-400">
                        {isAr ? alert.messageAr : alert.messageEn}
                      </div>
                    </div>
                    <span className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-amber-500/10 border border-amber-500/30 text-amber-300">
                      {alert.riskLevel.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Recent Mastery Gains */}
          <section className="p-6 rounded-3xl bg-[#121524]/90 border border-slate-800/80 backdrop-blur-xl shadow-xl space-y-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base font-bold text-white">
                {localize(
                  profile.language,
                  'Recent Progress & Mastery Momentum',
                  'التطور الأخير وقوة التقدم'
                )}
              </h2>
            </div>

            {(learningProfile.recentProgress || []).length === 0 ? (
              <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/60 text-center space-y-2">
                <Brain className="w-8 h-8 text-slate-600 mx-auto" />
                <div className="text-xs font-semibold text-slate-300">
                  {localize(
                    profile.language,
                    'Gains Calibrating',
                    'جاري تسجيل التطور الأخير'
                  )}
                </div>
                <p className="text-[11px] text-slate-400">
                  {localize(
                    profile.language,
                    'As you complete practice questions, recent improvement deltas will appear here.',
                    'عند إتمام التمارين القادمة، ستظهر هنا نسب التطور الحديثة للمفاهيم.'
                  )}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {learningProfile.recentProgress.map((gain) => (
                  <div
                    key={gain.conceptId}
                    className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-200">
                        {isAr ? gain.conceptNameAr : gain.conceptNameEn}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {isAr ? gain.headlineAr : gain.headlineEn}
                      </div>
                    </div>
                    <div className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                      <span>↑ +{gain.deltaPercentage}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Section 5: Ethical Non-IQ Guardrail Callout */}
        <section className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl flex items-start gap-3 text-slate-400 text-xs leading-relaxed">
          <ShieldCheck className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-slate-300 mb-1">
              {localize(
                profile.language,
                'Ethical Adaptive Model & Privacy Principle',
                'المبدأ الأخلاقي والخصوصية في التعلم التكيفي'
              )}
            </div>
            <p>
              {isAr
                ? learningProfile.ethicalDisclaimerAr ||
                  'يرصد نظام كوجنيفاي نمط استيعابك للمفاهيم وتفضيلك لطرق الشرح بهدف التكيّف معك وتخصيص تجربتك، ولا يمثل مقياسًا لنسبة الذكاء IQ أو حكمًا ثابتًا على قدراتك الإدراكية.'
                : learningProfile.ethicalDisclaimerEn ||
                  'Cognify models dynamic learning behavior, strategy affinity, and conceptual retention to optimize your daily explanations. This is not an IQ score, clinical test, or static measurement of intelligence.'}
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
