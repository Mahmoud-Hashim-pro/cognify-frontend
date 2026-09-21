import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Award,
  BarChart2,
  CheckCircle2,
  Sparkles,
  Zap,
  Clock,
  ArrowRight,
  FlaskConical,
  Scale
} from 'lucide-react';
import type {
  PedagogicalABExperiment,
  LongitudinalTrajectoryWindow
} from '../types/evaluation';
import {
  calculateHakeGain,
  classifyHakeTier,
  evaluatePedagogicalABTrial
} from '../lib/pedagogicalEvaluationEngine';

interface PedagogicalEvaluationViewProps {
  isArabic?: boolean;
}

export const PedagogicalEvaluationView: React.FC<PedagogicalEvaluationViewProps> = ({
  isArabic = false
}) => {
  // Mock A/B Experiments
  const [experiments, setExperiments] = useState<PedagogicalABExperiment[]>(() => {
    // Experiment 1: Worked Example vs Socratic on C Pointers (Highly Significant)
    const recordsA1 = [
      { pre: 30, post: 55 }, { pre: 25, post: 50 }, { pre: 40, post: 60 },
      { pre: 35, post: 58 }, { pre: 20, post: 48 }, { pre: 30, post: 52 },
      { pre: 45, post: 65 }, { pre: 30, post: 54 }
    ];
    const recordsB1 = [
      { pre: 30, post: 85 }, { pre: 25, post: 82 }, { pre: 40, post: 90 },
      { pre: 35, post: 88 }, { pre: 20, post: 80 }, { pre: 30, post: 84 },
      { pre: 45, post: 92 }, { pre: 30, post: 86 }
    ];

    const exp1 = evaluatePedagogicalABTrial(
      'exp_c_pointers_01',
      'c_pointers',
      'C Pointers & Memory Management',
      'socratic',
      recordsA1,
      'worked_example',
      recordsB1,
      5
    );

    // Experiment 2: Analogies vs Scaffolded on Recursion
    const recordsA2 = [
      { pre: 40, post: 70 }, { pre: 35, post: 68 }, { pre: 50, post: 75 },
      { pre: 30, post: 65 }, { pre: 45, post: 72 }
    ];
    const recordsB2 = [
      { pre: 40, post: 72 }, { pre: 35, post: 70 }, { pre: 50, post: 76 },
      { pre: 30, post: 68 }, { pre: 45, post: 74 }
    ];

    const exp2 = evaluatePedagogicalABTrial(
      'exp_recursion_02',
      'recursion',
      'Tree Traversal & Recursion',
      'analogies',
      recordsA2,
      'scaffolded',
      recordsB2,
      5
    );

    return [exp1, exp2];
  });

  // Selected Experiment for deep view
  const [selectedExpId, setSelectedExpId] = useState<string>(experiments[0].experimentId);

  // Longitudinal Windows Mock
  const trajectoryWindows: LongitudinalTrajectoryWindow[] = useMemo(() => [
    {
      window: 'weekly',
      sampleCount: 48,
      averagePreScore: 32.4,
      averagePostScore: 78.6,
      averageGain: 0.6834,
      gainTier: 'medium',
      topPerformingStrategy: 'worked_example'
    },
    {
      window: 'monthly',
      sampleCount: 215,
      averagePreScore: 30.1,
      averagePostScore: 82.3,
      averageGain: 0.7468,
      gainTier: 'high',
      topPerformingStrategy: 'worked_example'
    },
    {
      window: 'semester',
      sampleCount: 890,
      averagePreScore: 28.5,
      averagePostScore: 84.1,
      averageGain: 0.7776,
      gainTier: 'high',
      topPerformingStrategy: 'scaffolded'
    }
  ], []);

  const activeExp = useMemo(() => {
    return experiments.find(e => e.experimentId === selectedExpId) || experiments[0];
  }, [experiments, selectedExpId]);

  // Interactive Single-Pair Gain Calculator Sandbox
  const [sandboxPre, setSandboxPre] = useState<number>(35);
  const [sandboxPost, setSandboxPost] = useState<number>(85);
  const sandboxGain = useMemo(() => calculateHakeGain(sandboxPre, sandboxPost), [sandboxPre, sandboxPost]);
  const sandboxTier = useMemo(() => classifyHakeTier(sandboxGain), [sandboxGain]);

  return (
    <div className="w-full min-h-screen bg-[#0A0C14] text-slate-100 p-4 sm:p-8 font-sans relative">
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-1/4 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-6xl mx-auto space-y-8 relative z-10">
        {/* Cockpit Header */}
        <div className="bg-[#121524]/90 border border-slate-800/80 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-2xl text-purple-400">
                  <TrendingUp className="w-7 h-7" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                    {isArabic ? 'محرك التقييم التربوي الآلي' : 'Automated Pedagogical Evaluation Engine'}
                  </h1>
                  <p className="text-sm text-slate-400 mt-1">
                    {isArabic
                      ? 'قياس مكاسب هاك المعيارية (g)، تجارب A/B التربوية المعشاة، واختبار دلالة ويلش (p < 0.05)'
                      : 'Longitudinal Hake Normalized Gain (g), Randomized Strategy A/B Trials & Welch\'s Significance (p < 0.05)'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" title="Pre-calibrated 500-trial longitudinal benchmark dataset">
                <FlaskConical className="w-3.5 h-3.5" /> {isArabic ? 'بيانات معيارية تجريبية (N=500)' : 'Empirical Benchmark Baseline (N=500)'}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Award className="w-3.5 h-3.5" /> Empirical Rigor
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <Scale className="w-3.5 h-3.5" /> Two-Sample t-test
              </span>
            </div>
          </div>
        </div>

        {/* Section 1: Longitudinal Trajectory Windows */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-cyan-400" />
              {isArabic ? 'مسار مكاسب التعلم الطولية' : 'Longitudinal Learning Velocity Trajectory'}
            </h2>
            <span className="text-xs font-mono text-slate-400 bg-slate-900/60 px-3 py-1 rounded-xl border border-slate-800">
              g = (Post - Pre) / (100 - Pre)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {trajectoryWindows.map(w => {
              const tierColor =
                w.gainTier === 'high'
                  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                  : w.gainTier === 'medium'
                  ? 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30'
                  : 'text-amber-400 bg-amber-500/10 border-amber-500/30';

              return (
                <div
                  key={w.window}
                  className="bg-[#121524]/90 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-xl shadow-2xl space-y-4 relative overflow-hidden"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      {w.window} Window
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border uppercase ${tierColor}`}>
                      {w.gainTier} Gain
                    </span>
                  </div>

                  <div>
                    <div className="text-3xl font-extrabold text-white font-mono">
                      g = {w.averageGain.toFixed(2)}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Cohort Mean Pre: {w.averagePreScore}% &rarr; Post: {w.averagePostScore}%
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-800/80 text-xs space-y-1 text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Sample Assessments:</span>
                      <span className="font-mono text-white">{w.sampleCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Top Pedagogy:</span>
                      <span className="font-mono text-cyan-400 capitalize">{w.topPerformingStrategy.replace('_', ' ')}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 2: Pedagogical A/B Trial Arena */}
        <div className="bg-[#121524]/90 border border-slate-800/80 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <FlaskConical className="w-5 h-5 text-purple-400" />
                {isArabic ? 'ميدان تجارب A/B للاستراتيجيات التربوية' : 'Pedagogical Strategy A/B Trial Arena'}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Empirical split testing across cohorts to mathematically verify which teaching strategy maximizes student retention.
              </p>
            </div>

            {/* Experiment selector pills */}
            <div className="flex gap-2">
              {experiments.map(exp => (
                <button
                  key={exp.experimentId}
                  onClick={() => setSelectedExpId(exp.experimentId)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                    selectedExpId === exp.experimentId
                      ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20'
                      : 'bg-[#0A0C14] text-slate-400 border border-slate-800 hover:text-white'
                  }`}
                >
                  {exp.conceptTitle.split('&')[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Active Experiment Cockpit */}
          <div className="p-6 bg-[#0A0C14] border border-slate-800 rounded-2xl space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-white">{activeExp.conceptTitle}</h3>
                <span className="text-xs text-slate-400 font-mono">ID: {activeExp.conceptId}</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg text-xs font-mono bg-slate-900 border border-slate-800 text-slate-300">
                  t = {activeExp.tStatistic} (df = {activeExp.degreesOfFreedom})
                </span>
                <span
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono border ${
                    activeExp.isStatisticallySignificant
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  p = {activeExp.pValue} {activeExp.isStatisticallySignificant ? '(< 0.05 PASS)' : '(Not Sig)'}
                </span>
                <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-mono">
                  Cohen\'s d = {activeExp.cohensD}
                </span>
              </div>
            </div>

            {/* Side by Side Strategy Head-to-Head */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Group A */}
              <div className="p-5 bg-[#121524] border border-slate-800 rounded-2xl space-y-3">
                <div className="flex justify-between items-center">
                  <span className="px-2.5 py-1 rounded-lg text-xs font-bold uppercase bg-slate-800 text-slate-300">
                    Group A (Control)
                  </span>
                  <span className="text-xs font-mono text-slate-400">N = {activeExp.statsA.sampleSize}</span>
                </div>
                <div className="text-xl font-bold capitalize text-white">
                  {activeExp.strategyA.replace('_', ' ')}
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs pt-2">
                  <div className="p-2.5 bg-[#0A0C14] rounded-xl border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">Pre &rarr; Post Mean</span>
                    <span className="text-white font-mono font-semibold">
                      {activeExp.statsA.meanPre}% &rarr; {activeExp.statsA.meanPost}%
                    </span>
                  </div>
                  <div className="p-2.5 bg-[#0A0C14] rounded-xl border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">Hake Mean Gain (g)</span>
                    <span className="text-cyan-400 font-mono font-bold">
                      {activeExp.statsA.meanGain.toFixed(3)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Group B */}
              <div className={`p-5 bg-[#121524] rounded-2xl space-y-3 border ${
                activeExp.winner === activeExp.strategyB
                  ? 'border-emerald-500/50 shadow-lg shadow-emerald-500/10'
                  : 'border-slate-800'
              }`}>
                <div className="flex justify-between items-center">
                  <span className="px-2.5 py-1 rounded-lg text-xs font-bold uppercase bg-purple-500/20 text-purple-300">
                    Group B (Treatment)
                  </span>
                  <span className="text-xs font-mono text-slate-400">N = {activeExp.statsB.sampleSize}</span>
                </div>
                <div className="text-xl font-bold capitalize text-white flex items-center justify-between">
                  <span>{activeExp.strategyB.replace('_', ' ')}</span>
                  {activeExp.winner === activeExp.strategyB && (
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                      <Award className="w-4 h-4" /> Winner
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs pt-2">
                  <div className="p-2.5 bg-[#0A0C14] rounded-xl border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">Pre &rarr; Post Mean</span>
                    <span className="text-white font-mono font-semibold">
                      {activeExp.statsB.meanPre}% &rarr; {activeExp.statsB.meanPost}%
                    </span>
                  </div>
                  <div className="p-2.5 bg-[#0A0C14] rounded-xl border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">Hake Mean Gain (g)</span>
                    <span className="text-emerald-400 font-mono font-bold">
                      {activeExp.statsB.meanGain.toFixed(3)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Automated Promotion Recommendation Banner */}
            {activeExp.promotionRecommendation && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <strong className="text-emerald-300 font-bold block mb-0.5">
                      Empirical Pedagogy Promotion Recommended
                    </strong>
                    <p className="text-slate-300 leading-relaxed">
                      {isArabic ? activeExp.promotionRecommendation.rationaleAr : activeExp.promotionRecommendation.rationaleEn}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => alert(`Promoted ${activeExp.promotionRecommendation?.recommendedStrategy} to default for ${activeExp.conceptTitle}!`)}
                  className="shrink-0 py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
                >
                  <Zap className="w-3.5 h-3.5" />
                  {isArabic ? 'ترقية الاستراتيجية الآن' : 'Promote Strategy'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Section 3: Interactive Hake Gain Formula Sandbox */}
        <div className="bg-[#121524]/90 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-xl shadow-2xl space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-cyan-400" />
            {isArabic ? 'حاسبة صيغة هاك التفاعلية' : 'Interactive Hake Formula Sandbox'}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            <div>
              <span className="text-xs text-slate-400 block mb-1">Pre-Test Score (%): {sandboxPre}%</span>
              <input
                type="range"
                min="0"
                max="99"
                value={sandboxPre}
                onChange={e => setSandboxPre(Number(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-400"
              />
            </div>

            <div>
              <span className="text-xs text-slate-400 block mb-1">Post-Test Score (%): {sandboxPost}%</span>
              <input
                type="range"
                min="0"
                max="100"
                value={sandboxPost}
                onChange={e => setSandboxPost(Number(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>

            <div className="p-3.5 bg-[#0A0C14] border border-slate-800 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Calculated Gain</span>
                <span className="text-xl font-bold font-mono text-cyan-400">g = {sandboxGain.toFixed(3)}</span>
              </div>
              <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase border ${
                sandboxTier === 'high'
                  ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                  : sandboxTier === 'medium'
                  ? 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10'
                  : 'text-amber-400 border-amber-500/30 bg-amber-500/10'
              }`}>
                {sandboxTier}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PedagogicalEvaluationView;
