import React from 'react';
import { UserProfile, LearningIntelligenceProfile } from '../types';
import { localize, isArabicLocale } from '../lib/translations';
import {
  Brain,
  CheckCircle2,
  TrendingUp,
  Sparkles,
  ShieldCheck,
  Award,
  AlertCircle,
  Sliders,
  Calendar,
  Clock,
  Zap,
  Layers,
  HelpCircle,
  Cpu,
  FileText,
  Lightbulb,
  Compass,
  Gauge,
  Info,
} from 'lucide-react';

import { useStudentState } from '../lib/useStudentState';
import { getConcept } from '../lib/conceptGraph';
import { PedagogyStrategy } from '../lib/studentStateEngine';
import type { PersonalLearningModel, ConceptLearningProfile } from '../types/studentState';

interface LearningIntelligenceCardProps {
  profile: UserProfile;
}

export default function LearningIntelligenceCard({ profile }: LearningIntelligenceCardProps) {
  const { studentState, isLoaded } = useStudentState(profile.uid, profile.level);
  const isAr = isArabicLocale(profile.language);
  const isFr = profile.language === 'French' || (profile.language as any) === 'fr';

  // Wait for authoritative state to load for authenticated users so they don't see a momentary flash of "0 progress"
  if (!isLoaded && profile.uid && profile.uid !== 'guest') {
    return (
      <div
        className="p-6 md:p-7 rounded-3xl bg-[#121524]/90 border border-slate-800/80 shadow-2xl backdrop-blur-xl space-y-5 animate-pulse"
        aria-busy="true"
        aria-label={localize(profile.language, 'Loading learning intelligence profile', 'جاري تحميل الملف المعرفي الذكي')}
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-slate-800/80" />
          <div className="space-y-2 flex-1">
            <div className="h-4 w-1/3 rounded-lg bg-slate-800/80" />
            <div className="h-3 w-1/4 rounded-lg bg-slate-800/50" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="h-16 rounded-2xl bg-slate-800/50" />
          <div className="h-16 rounded-2xl bg-slate-800/50" />
          <div className="h-16 rounded-2xl bg-slate-800/50" />
          <div className="h-16 rounded-2xl bg-slate-800/50" />
        </div>
        <div className="h-20 w-full rounded-2xl bg-slate-800/40" />
      </div>
    );
  }

  const masteryEntries = Object.entries(studentState?.conceptMastery || {});
  const hasLiveMastery = masteryEntries.length > 0;

  const liveMasteredConcepts = masteryEntries
    .filter(([_, rec]) => rec.accuracy >= 0.75 && rec.attempts >= 2)
    .map(([cid, rec]) => {
      const node = getConcept(cid);
      return {
        conceptId: cid,
        conceptName: node ? (isAr ? node.nameAr : node.nameEn) : cid.replace(/_/g, ' '),
        domain: node?.domain || 'General',
        confidenceScore: Math.round(rec.confidence * 100),
        status: 'mastered' as const,
        evidenceCount: rec.attempts,
        lastPracticed: new Date(rec.lastTested).toISOString(),
      };
    });

  const liveDevelopingConcepts = masteryEntries
    .filter(([_, rec]) => rec.accuracy < 0.75 || rec.attempts < 2)
    .map(([cid, rec]) => {
      const node = getConcept(cid);
      return {
        conceptId: cid,
        conceptName: node ? (isAr ? node.nameAr : node.nameEn) : cid.replace(/_/g, ' '),
        domain: node?.domain || 'General',
        confidenceScore: Math.round(rec.confidence * 100),
        status: 'developing' as const,
        evidenceCount: rec.attempts,
        lastPracticed: new Date(rec.lastTested).toISOString(),
      };
    });

  const avgConfidence = hasLiveMastery
    ? Math.round(
        (masteryEntries.reduce((acc, [_, r]) => acc + r.confidence, 0) / masteryEntries.length) * 100
      )
    : 75;

  const intel = {
    confidenceScore: avgConfidence,
    cognitiveStrengths: hasLiveMastery
      ? liveMasteredConcepts.slice(0, 3).map((c) => c.conceptName)
      : [
          isAr ? 'التعرف على الأنماط المنطقية' : 'Visual Matrix Pattern Completion',
          isAr ? 'الاستنتاج التحليلي' : 'Deductive Syllogistic Inferences',
          isAr ? 'التفكيك التدريجي للمسائل' : 'Step-by-step Structural Breakdown',
        ],
    masteredConcepts: hasLiveMastery ? liveMasteredConcepts : [],
    developingConcepts: hasLiveMastery ? liveDevelopingConcepts : [],
  };

  // Pedagogical Strategy Efficacy Analysis
  const effectiveness = studentState?.pedagogyEffectiveness || {
    scaffolded: { helpfulCount: 0, unhelpfulCount: 0, score: 0.8 },
    worked_example: { helpfulCount: 0, unhelpfulCount: 0, score: 0.75 },
    analogies: { helpfulCount: 0, unhelpfulCount: 0, score: 0.7 },
    socratic: { helpfulCount: 0, unhelpfulCount: 0, score: 0.65 },
    advanced_rigor: { helpfulCount: 0, unhelpfulCount: 0, score: 0.6 },
  };

  const pedagogyMetaList: {
    key: PedagogyStrategy;
    nameEn: string;
    nameAr: string;
    nameFr: string;
    icon: any;
    descEn: string;
    descAr: string;
  }[] = [
    {
      key: 'scaffolded',
      nameEn: 'Step-by-Step Scaffolding',
      nameAr: 'التفكيك التدريجي المنظم',
      nameFr: 'Échafaudage pas à pas',
      icon: Layers,
      descEn: 'Sequential micro-milestones with continuous checks',
      descAr: 'تفكيك المسائل لخطوات صغيرة متدرجة',
    },
    {
      key: 'analogies',
      nameEn: 'Visual Analogies & Metaphors',
      nameAr: 'التشبيهات البصرية والواقعية',
      nameFr: 'Analogies visuelles & métaphores',
      icon: Lightbulb,
      descEn: 'Anchors concepts in real-world mental models',
      descAr: 'تقريب المفاهيم بأمثلة حياتية ونماذج ملموسة',
    },
    {
      key: 'worked_example',
      nameEn: 'Worked Examples',
      nameAr: 'المسائل النموذجية المحلولة',
      nameFr: 'Exemples entièrement résolus',
      icon: FileText,
      descEn: 'End-to-end transparent solved problems',
      descAr: 'أمثلة عملية محلولة بالتفصيل مع تفسير الخطوات',
    },
    {
      key: 'socratic',
      nameEn: 'Socratic Inquiry',
      nameAr: 'الحوار الاستنتاجي السقراطي',
      nameFr: 'Questionnement socratique',
      icon: HelpCircle,
      descEn: 'Probing questions guiding self-discovery',
      descAr: 'أسئلة موجهة تدفعك لاستنتاج الحل بنفسك',
    },
    {
      key: 'advanced_rigor',
      nameEn: 'Deep Technical & Rigor',
      nameAr: 'العمق التقني والأكاديمي',
      nameFr: 'Rigueur technique avancée',
      icon: Cpu,
      descEn: 'Big-O complexity, formal specs, and system trade-offs',
      descAr: 'مواصفات دقيقة وحساب تعقيد الخوارزميات وتصميم النظم',
    },
  ];

  // Find optimal strategy with sample-size guard (Phase 2C)
  const plm = studentState?.personalLearningModel;
  const conceptProfiles = plm?.conceptProfiles || {};

  let bestStrategyKey: PedagogyStrategy = plm?.primaryPreferredStrategy || 'scaffolded';
  let bestScore = -1;
  let hasSufficientEvidence = false;

  for (const [strat, data] of Object.entries(effectiveness)) {
    const trials = (data.helpfulCount || 0) + (data.unhelpfulCount || 0);
    if (trials >= 3 && data.score > bestScore) {
      bestScore = data.score;
      bestStrategyKey = strat as PedagogyStrategy;
      hasSufficientEvidence = true;
    }
  }

  // Fallback to PLM primary strategy if calibrated from longitudinal events
  if (!hasSufficientEvidence && plm?.primaryPreferredStrategy) {
    bestStrategyKey = plm.primaryPreferredStrategy;
  }

  const primaryStrategyMeta = pedagogyMetaList.find((p) => p.key === bestStrategyKey) || pedagogyMetaList[0];
  const secondaryStrategyMeta = plm?.secondaryPreferredStrategy
    ? pedagogyMetaList.find((p) => p.key === plm.secondaryPreferredStrategy)
    : undefined;

  // Spaced Retention Schedules
  const retentionList = Object.entries(studentState?.retentionSchedules || {}).map(([cid, sched]) => {
    const node = getConcept(cid);
    const name = node ? (isAr ? node.nameAr : node.nameEn) : cid.replace(/_/g, ' ');
    const isDue = sched.nextReviewDate <= Date.now();
    return {
      conceptId: cid,
      conceptName: name,
      intervalDays: sched.intervalDays,
      status: sched.status,
      isDue,
      nextReviewDate: sched.nextReviewDate,
    };
  });

  const dueRetentionCount = retentionList.filter((r) => r.isDue).length;

  return (
    <div className="p-6 md:p-7 rounded-3xl bg-[#121524]/90 border border-slate-800/80 shadow-2xl backdrop-blur-xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-white text-base flex items-center gap-2">
              {localize(profile.language, 'Explainable Learning Profile', 'الملف المعرفي الشفاف')}
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                Cognify 2.0
              </span>
            </h3>
            <p className="text-xs text-slate-400 font-medium">
              {localize(
                profile.language,
                'Dynamic pedagogical adaptation backed by empirical interaction evidence.',
                'تكييف تعليمي مستمر مبني على أدلة تفاعلية حقيقية عبر الجلسات.'
              )}
            </p>
          </div>
        </div>

        {/* Confidence Badge */}
        <div className="text-end">
          <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">
            {localize(profile.language, 'Mastery Confidence', 'نسبة الثقة في الإتقان')}
          </span>
          <span className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400 font-mono">
            {intel.confidenceScore}%
          </span>
        </div>
      </div>

      {/* Verified Strengths */}
      <div className="space-y-2.5">
        <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
          <Award className="w-4 h-4 text-amber-400" />
          {localize(profile.language, 'Verified Cognitive Strengths', 'نقاط القوة المعرفية المثبتة')}
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {intel.cognitiveStrengths.map((str, idx) => (
            <div
              key={idx}
              className="p-3 rounded-2xl bg-[#0A0C14] border border-slate-800 text-xs font-semibold text-slate-200 flex items-center gap-2.5 shadow-inner"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{str}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Dominant Empirical Learning Modality (PLM Longitudinal Intelligence) */}
      <div className="p-4.5 rounded-3xl bg-gradient-to-r from-indigo-950/40 via-[#121528] to-cyan-950/30 border border-indigo-500/30 shadow-xl space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-300 block">
                {localize(profile.language, 'Longitudinal Learning Modality (PLM)', 'النمط التعليمي الطولي المفضل (PLM)')}
              </span>
              <div className="text-sm font-black text-white flex items-center gap-2">
                <span>{isAr ? primaryStrategyMeta.nameAr : isFr ? primaryStrategyMeta.nameFr : primaryStrategyMeta.nameEn}</span>
                {secondaryStrategyMeta && (
                  <span className="text-[11px] font-semibold text-slate-400">
                    + {isAr ? secondaryStrategyMeta.nameAr : isFr ? secondaryStrategyMeta.nameFr : secondaryStrategyMeta.nameEn}
                  </span>
                )}
              </div>
            </div>
          </div>
          <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
            {hasSufficientEvidence
              ? `${localize(profile.language, 'Calibrated', 'معايرة مكتملة')} (${Math.round(bestScore * 100)}% ${localize(profile.language, 'win rate', 'نسبة نجاح')})`
              : localize(profile.language, 'Initial Baseline Calibration', 'معايرة النمط الأولي')}
          </span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed font-medium">
          {isAr
            ? `بناءً على التفاعل التجريبي المستمر، أظهر الطالب أعلى كفاءة حل للمسائل واستبقاء للمفاهيم عبر "${primaryStrategyMeta.nameAr}". يبدأ كوجنيفاي شروحاته استباقياً بهذه الاستراتيجية.`
            : isFr
            ? `D'après les interactions enregistrées, l'élève démontre la meilleure rétention via "${primaryStrategyMeta.nameFr}". Cognify ouvre ses explications de façon proactive avec ce style.`
            : `Based on longitudinal practice evidence, the learner demonstrates highest retention and problem-solving velocity when instruction begins with "${primaryStrategyMeta.nameEn}". Cognify proactively opens explanations with this modality.`}
        </p>
      </div>

      {/* Pedagogical Strategy Efficacy Matrix (Pillar 4) */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-black uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
            <Sliders className="w-4 h-4 text-indigo-400" />
            {localize(profile.language, 'Pedagogical Strategy Efficacy Matrix', 'مصفوفة فاعلية استراتيجيات التعلم')}
          </h4>
          <span className="text-[10px] font-bold text-slate-400">
            {localize(profile.language, 'Active: ', 'الأسلوب الحالي: ')}
            <span className="text-cyan-400 uppercase font-mono font-black">{studentState?.activePedagogy || 'scaffolded'}</span>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {pedagogyMetaList.map((item) => {
            const data = effectiveness[item.key] || { helpfulCount: 0, unhelpfulCount: 0, score: 0.5 };
            const totalTrials = (data.helpfulCount || 0) + (data.unhelpfulCount || 0);
            const isCalibrating = totalTrials < 3;
            const isOptimal = !isCalibrating && item.key === bestStrategyKey;
            const scorePct = Math.round((data.score || 0.5) * 100);
            const IconComp = item.icon;
            const title = isAr ? item.nameAr : isFr ? item.nameFr : item.nameEn;

            return (
              <div
                key={item.key}
                className={`p-3.5 rounded-2xl border transition-all text-xs space-y-2 relative overflow-hidden ${
                  isOptimal
                    ? 'bg-gradient-to-br from-indigo-950/40 via-[#121524] to-[#0A0C14] border-indigo-500/40 shadow-lg shadow-indigo-950/40'
                    : 'bg-[#0A0C14] border-slate-800 text-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-7 h-7 rounded-xl flex items-center justify-center ${
                        isOptimal ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      <IconComp className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-100 flex items-center gap-1.5">
                        <span>{title}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {isCalibrating
                          ? `${totalTrials}/3 ${localize(profile.language, 'trials', 'تجارب')}`
                          : `${totalTrials} ${localize(profile.language, 'trials', 'تجارب')}`}
                      </div>
                    </div>
                  </div>

                  {isOptimal && (
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 tracking-wider">
                      {isAr ? 'الأمثل' : isFr ? 'Optimal' : 'Optimal'}
                    </span>
                  )}
                  {isCalibrating && (
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700 tracking-wider">
                      {isAr ? 'قيد المعايرة' : isFr ? 'Calibrage' : 'Calibrating'}
                    </span>
                  )}
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-slate-400">{localize(profile.language, 'Efficacy', 'الفاعلية')}</span>
                    <span className={isOptimal ? 'text-indigo-400 font-black' : isCalibrating ? 'text-slate-500' : 'text-slate-300'}>
                      {isCalibrating
                        ? `${localize(profile.language, 'Calibrating', 'قيد المعايرة')} (${3 - totalTrials} ${localize(profile.language, 'left', 'متبقي')})`
                        : `${scorePct}%`}
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isOptimal
                          ? 'bg-gradient-to-r from-indigo-500 to-cyan-400'
                          : isCalibrating
                          ? 'bg-slate-700/60 animate-pulse'
                          : 'bg-slate-600'
                      }`}
                      style={{ width: `${isCalibrating ? Math.max(20, (totalTrials / 3) * 100) : Math.min(100, Math.max(10, scorePct))}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Spaced Micro-Retrieval Schedule Overview (Pillar 3) */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-cyan-400" />
            {localize(profile.language, 'Spaced Micro-Retrieval Schedule (SM-2)', 'جدول التكرار المتباعد الذكي (SM-2)')}
          </h4>
          {dueRetentionCount > 0 ? (
            <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 animate-pulse">
              {dueRetentionCount} {localize(profile.language, 'Due for Review', 'مستحق للمراجعة')}
            </span>
          ) : (
            <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              {localize(profile.language, 'Retention Consolidated', 'الذاكرة مستقرة')}
            </span>
          )}
        </div>

        {retentionList.length === 0 ? (
          <div className="p-4 rounded-2xl bg-[#0A0C14] border border-slate-800/80 text-xs text-slate-400 text-center">
            {localize(
              profile.language,
              'Interactive retention schedules are generated automatically as you practice concepts and answer formative checks.',
              'يتم إنشاء جداول التكرار الذكية تلقائياً فور الإجابة على الأسئلة التكوينية وممارسة المفاهيم.'
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {retentionList.slice(0, 6).map((item) => (
              <div
                key={item.conceptId}
                className={`p-3 rounded-2xl border text-xs space-y-1.5 ${
                  item.isDue
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                    : 'bg-[#0A0C14] border-slate-800 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold truncate max-w-[140px]">{item.conceptName}</span>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md ${
                    item.isDue ? 'bg-amber-500/20 text-amber-300 font-bold' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {item.intervalDays}d {localize(profile.language, 'interval', 'فاصل')}
                  </span>
                </div>
                <div className="text-[10px] flex justify-between items-center text-slate-400">
                  <span className="capitalize">{item.status}</span>
                  <span>{item.isDue ? (isAr ? 'مستحق الآن' : 'Due now') : (isAr ? 'مجدول' : 'Consolidated')}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Concept Mastery Lists */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
        {/* Mastered */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-emerald-400">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              {localize(profile.language, 'Mastered Concepts', 'المفاهيم المتقنة')}
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">{intel.masteredConcepts.length}</span>
          </div>
          <div className="space-y-2">
            {intel.masteredConcepts.length === 0 ? (
              <div className="p-3.5 rounded-2xl bg-[#0A0C14] border border-slate-800 text-xs text-slate-500 text-center">
                {localize(profile.language, 'Practice concepts to solidify mastery', 'مارس المفاهيم لتوثيق إتقانها')}
              </div>
            ) : (
              intel.masteredConcepts.map((c) => {
                const cProf = conceptProfiles[c.conceptId];
                return (
                  <div
                    key={c.conceptId}
                    className="p-3.5 rounded-2xl bg-[#0A0C14] border border-emerald-500/25 text-xs space-y-2 shadow-inner"
                  >
                    <div className="flex justify-between font-bold text-slate-100">
                      <span>{c.conceptName}</span>
                      <span className="text-emerald-400 font-mono font-black">{c.confidenceScore}%</span>
                    </div>
                    <div className="text-[10px] text-slate-400 flex justify-between font-medium">
                      <span>{c.domain}</span>
                      <span>{c.evidenceCount} {localize(profile.language, 'proof sessions', 'جلسات تأكيد')}</span>
                    </div>
                    {cProf && (
                      <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-800/60 text-[9px] font-mono">
                        <span className="px-2 py-0.5 rounded-md bg-slate-800/80 text-slate-300">
                          {cProf.latencyProfile === 'low'
                            ? (isAr ? '⚡ طلاقة عالية' : '⚡ Fluent (<8s)')
                            : cProf.latencyProfile === 'medium'
                            ? (isAr ? '⏱️ استجابة متوازنة' : '⏱️ Latency: 8-15s')
                            : (isAr ? '⏱️ دعم تدريجي' : '⏱️ Scaffolding Active')}
                        </span>
                        {cProf.retentionRisk === 'high' ? (
                          <span className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold">
                            {isAr ? 'مستحق للمراجعة' : 'Review due'}
                          </span>
                        ) : cProf.retentionRisk === 'medium' ? (
                          <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            {isAr ? 'مراجعة قريبة (٤٨ س)' : 'Review soon'}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                            {isAr ? 'مستقر' : 'Consolidated'}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Developing */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-amber-400">
            <span className="flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4" />
              {localize(profile.language, 'Concepts Developing', 'مفاهيم قيد التثبيت')}
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">{intel.developingConcepts.length}</span>
          </div>
          <div className="space-y-2">
            {intel.developingConcepts.length === 0 ? (
              <div className="p-3.5 rounded-2xl bg-[#0A0C14] border border-slate-800 text-xs text-slate-500 text-center">
                {localize(profile.language, 'No active stumbling blocks diagnosed', 'لا توجد صعوبات تعلّم حالية')}
              </div>
            ) : (
              intel.developingConcepts.map((c) => {
                const cProf = conceptProfiles[c.conceptId];
                return (
                  <div
                    key={c.conceptId}
                    className="p-3.5 rounded-2xl bg-[#0A0C14] border border-amber-500/25 text-xs space-y-2 shadow-inner"
                  >
                    <div className="flex justify-between font-bold text-slate-100">
                      <span>{c.conceptName}</span>
                      <span className="text-amber-400 font-mono font-black">{c.confidenceScore}%</span>
                    </div>
                    <div className="text-[10px] text-slate-400 flex justify-between font-medium">
                      <span>{c.domain}</span>
                      <span>{c.evidenceCount} {localize(profile.language, 'sessions', 'جلسات')}</span>
                    </div>
                    {cProf?.commonError && (
                      <div className="text-[10px] text-amber-300/90 font-mono bg-amber-500/10 px-2 py-1 rounded-xl border border-amber-500/20 truncate">
                        ⚠️ {isAr ? 'نقطة التعثر:' : 'Stumbling block:'} "{cProf.commonError.replace(/_/g, ' ')}"
                      </div>
                    )}
                    {cProf && (
                      <div className="flex items-center gap-1.5 flex-wrap text-[9px] font-mono">
                        <span className="px-2 py-0.5 rounded-md bg-slate-800/80 text-slate-300">
                          {cProf.latencyProfile === 'high'
                            ? (isAr ? 'عبء إدراكي مرتفع (>15ث)' : 'High latency (>15s)')
                            : cProf.latencyProfile === 'medium'
                            ? (isAr ? 'استجابة متوازنة' : 'Balanced latency')
                            : (isAr ? 'استجابة سريعة' : 'Fluent (<8s)')}
                        </span>
                        {cProf.bestStrategy && (
                          <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            {isAr ? 'الأنسب:' : 'Best:'} {cProf.bestStrategy}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Ethical Non-IQ & Interaction-Derived Disclaimer Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900/90 via-[#121524] to-slate-900/90 border border-slate-800 text-xs text-slate-400 flex items-start gap-3 shadow-inner">
        <ShieldCheck className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-bold text-slate-200 flex items-center gap-2">
            <span>{localize(profile.language, 'Observed Learning Profile (Ethical Non-IQ Standard)', 'الملف المعرفي الملاحظ (المعيار الأخلاقي غير المرتبط بـ IQ)')}</span>
            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              {localize(profile.language, 'Empirical Evidence', 'أدلة تفاعلية')}
            </span>
          </div>
          <p className="leading-relaxed text-[11px] text-slate-400">
            {localize(
              profile.language,
              'This profile reflects longitudinal interaction history, response latencies, and pedagogical strategy efficacy across exercises. It does NOT measure native intellectual capacity, fixed IQ, or assign deficit labels. Your profile dynamically evolves as you practice.',
              'يعكس هذا الملف سجل التفاعل الفعلي وأزمنة الاستجابة ومدى فاعلية الاستراتيجيات التعليمية عبر التمارين. هذا ليس مقياساً للقدرة الفطرية أو حاصل الذكاء الثابت (IQ)، ولا يصدر أحكاماً سلبية أو تصنيفات عجز. يتطور ملفك بمرونة مستمرة مع ممارستك.'
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
