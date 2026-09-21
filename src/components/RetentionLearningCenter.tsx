import React, { useState, useEffect } from 'react';
import {
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Zap,
  Sparkles,
  ChevronRight,
  X,
  Layers,
  ArrowUpRight,
  TrendingUp,
} from 'lucide-react';
import type {
  RetentionDashboardData,
  RetentionItem,
  MicroReviewQuestion,
  MicroReviewResult,
} from '../types/retention';
import {
  categorizeRetentionState,
  generateMicroReview,
  evaluateMicroReviewSubmission,
  resolveConceptTitle,
} from '../lib/retentionProductEngine';
import type { RetentionSchedule } from '../lib/spacedRetention';

interface RetentionLearningCenterProps {
  schedules: Record<string, RetentionSchedule>;
  onScheduleUpdated?: (conceptId: string, result: MicroReviewResult) => void;
  lang?: 'en' | 'ar' | 'fr';
}

export const RetentionLearningCenter: React.FC<RetentionLearningCenterProps> = ({
  schedules,
  onScheduleUpdated,
  lang = 'ar',
}) => {
  const isAr = lang === 'ar';
  const [activeTab, setActiveTab] = useState<'due_today' | 'upcoming' | 'mastered' | 'at_risk'>('due_today');
  const [dashboardData, setDashboardData] = useState<RetentionDashboardData>({
    dueToday: [],
    upcoming: [],
    mastered: [],
    atRisk: [],
  });

  // Micro-review modal state
  const [activeReviewItem, setActiveReviewItem] = useState<RetentionItem | null>(null);
  const [activeQuestion, setActiveQuestion] = useState<MicroReviewQuestion | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [reviewResult, setReviewResult] = useState<MicroReviewResult | null>(null);
  const [startTime, setStartTime] = useState<number>(0);

  useEffect(() => {
    const data = categorizeRetentionState(schedules, undefined, Date.now());
    setDashboardData(data);

    // Auto-select first non-empty tab if current is empty
    if (data.dueToday.length === 0 && data.atRisk.length > 0 && activeTab === 'due_today') {
      setActiveTab('at_risk');
    }
  }, [schedules]);

  const handleStartReview = (item: RetentionItem) => {
    const q = generateMicroReview(item.conceptId, lang);
    setActiveReviewItem(item);
    setActiveQuestion(q);
    setSelectedOption(null);
    setReviewResult(null);
    setStartTime(Date.now());
  };

  const handleAnswer = (index: number) => {
    if (!activeReviewItem || !activeQuestion || selectedOption !== null) return;
    const elapsed = Date.now() - startTime;
    setSelectedOption(index);

    const currentSchedule: RetentionSchedule = schedules[activeReviewItem.conceptId] || {
      conceptId: activeReviewItem.conceptId,
      repetitions: activeReviewItem.repetitions,
      intervalDays: activeReviewItem.intervalDays,
      easeFactor: activeReviewItem.easeFactor,
      lastReviewDate: activeReviewItem.lastReviewDate,
      nextReviewDate: activeReviewItem.nextReviewDate,
      status: activeReviewItem.status,
    };

    const result = evaluateMicroReviewSubmission(
      {
        conceptId: activeReviewItem.conceptId,
        selectedIndex: index,
        responseTimeMs: elapsed,
      },
      currentSchedule
    );

    setReviewResult(result);
    if (onScheduleUpdated) {
      onScheduleUpdated(activeReviewItem.conceptId, result);
    }
  };

  const handleCloseModal = () => {
    setActiveReviewItem(null);
    setActiveQuestion(null);
    setSelectedOption(null);
    setReviewResult(null);
  };

  const currentList =
    activeTab === 'due_today'
      ? dashboardData.dueToday
      : activeTab === 'at_risk'
      ? dashboardData.atRisk
      : activeTab === 'mastered'
      ? dashboardData.mastered
      : dashboardData.upcoming;

  return (
    <div className="w-full rounded-3xl bg-[#0d101d]/90 border border-slate-800/80 p-6 backdrop-blur-xl shadow-2xl text-slate-100 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-slate-800/60">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <RotateCcw className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-white tracking-wide">
              {isAr ? 'مركز التكرار المتباعد والذاكرة الذكية' : 'Spaced Retention & Long-Term Memory Center'}
            </h2>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            {isAr
              ? 'مبني على منحنى النسيان لإبينغهاوس وخوارزمية SuperMemo-2 لتثبيت المفاهيم البرمجية في الذاكرة طويلة الأمد.'
              : 'Powered by the Ebbinghaus forgetting curve & SuperMemo-2 algorithm to permanently cement concepts in long-term memory.'}
          </p>
        </div>

        {/* Global Summary Badge */}
        <div className="flex items-center gap-3 bg-[#13172b] border border-slate-800 rounded-2xl p-2.5 px-4">
          <div className="text-right">
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
              {isAr ? 'مستحق المراجعة' : 'Reviews Ready'}
            </div>
            <div className="text-lg font-black text-cyan-400">
              {dashboardData.dueToday.length + dashboardData.atRisk.length}
            </div>
          </div>
          <div className="w-px h-8 bg-slate-800" />
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
              {isAr ? 'مفاهيم متقنة' : 'Mastered'}
            </div>
            <div className="text-lg font-black text-emerald-400">
              {dashboardData.mastered.length}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 my-6">
        {/* Tab: Due Today */}
        <button
          onClick={() => setActiveTab('due_today')}
          className={`relative flex items-center justify-between p-3.5 rounded-2xl border transition-all text-sm font-semibold ${
            activeTab === 'due_today'
              ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300 shadow-lg shadow-cyan-950/30'
              : 'bg-[#121526]/50 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span>{isAr ? 'مستحق اليوم' : 'Due Today'}</span>
          </div>
          <span className="px-2 py-0.5 rounded-full text-xs font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
            {dashboardData.dueToday.length}
          </span>
        </button>

        {/* Tab: At Risk */}
        <button
          onClick={() => setActiveTab('at_risk')}
          className={`relative flex items-center justify-between p-3.5 rounded-2xl border transition-all text-sm font-semibold ${
            activeTab === 'at_risk'
              ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-lg shadow-amber-950/30'
              : 'bg-[#121526]/50 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>{isAr ? 'معرض للنسيان' : 'At Risk'}</span>
          </div>
          <span className="px-2 py-0.5 rounded-full text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
            {dashboardData.atRisk.length}
          </span>
        </button>

        {/* Tab: Mastered */}
        <button
          onClick={() => setActiveTab('mastered')}
          className={`relative flex items-center justify-between p-3.5 rounded-2xl border transition-all text-sm font-semibold ${
            activeTab === 'mastered'
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-lg shadow-emerald-950/30'
              : 'bg-[#121526]/50 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{isAr ? 'متقن ومستقر' : 'Mastered'}</span>
          </div>
          <span className="px-2 py-0.5 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            {dashboardData.mastered.length}
          </span>
        </button>

        {/* Tab: Upcoming */}
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`relative flex items-center justify-between p-3.5 rounded-2xl border transition-all text-sm font-semibold ${
            activeTab === 'upcoming'
              ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300 shadow-lg shadow-indigo-950/30'
              : 'bg-[#121526]/50 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            <span>{isAr ? 'قادم لاحقاً' : 'Upcoming'}</span>
          </div>
          <span className="px-2 py-0.5 rounded-full text-xs font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            {dashboardData.upcoming.length}
          </span>
        </button>
      </div>

      {/* Concept Items List */}
      <div className="space-y-3 min-h-[220px]">
        {currentList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 rounded-2xl bg-[#121526]/30 border border-slate-800/50 text-center">
            <Sparkles className="w-8 h-8 text-slate-600 mb-2" />
            <div className="text-sm font-semibold text-slate-300">
              {isAr ? 'لا توجد عناصر في هذا القسم حالياً' : 'No items in this category currently'}
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              {activeTab === 'due_today'
                ? isAr
                  ? 'ذاكرتك في حالة ممتازة! لا توجد مفاهيم مستحقة المراجعة اليوم.'
                  : 'Your memory is in top shape! No concepts due for review today.'
                : isAr
                ? 'استمر في حل التمارين والمفاهيم لتسجيل جداول التكرار المتباعد.'
                : 'Keep practicing to populate your spaced repetition schedules.'}
            </p>
          </div>
        ) : (
          currentList.map((item) => {
            const riskPct = Math.round(item.retentionRiskScore * 100);
            return (
              <div
                key={item.conceptId}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-[#121526]/80 border border-slate-800/80 hover:border-slate-700 transition-all hover:bg-[#151930]"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h3 className="text-sm font-bold text-white">
                      {resolveConceptTitle(item.conceptId, lang)}
                    </h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-800 text-slate-400">
                      {item.repetitions} {isAr ? 'تكرارات' : 'reps'} • {item.intervalDays} {isAr ? 'يوم' : 'days'}
                    </span>
                    {item.daysOverdue > 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {isAr ? `متأخر ${item.daysOverdue} يوم` : `${item.daysOverdue}d overdue`}
                      </span>
                    )}
                  </div>

                  {/* Decay Risk Bar */}
                  <div className="flex items-center gap-3 max-w-xs">
                    <div className="text-[10px] text-slate-400 font-mono">
                      {isAr ? 'مخاطر النسيان:' : 'Decay Risk:'}
                    </div>
                    <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          riskPct > 60 ? 'bg-rose-500' : riskPct > 35 ? 'bg-amber-400' : 'bg-emerald-400'
                        }`}
                        style={{ width: `${riskPct}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-slate-300">{riskPct}%</span>
                  </div>
                </div>

                {/* Action button */}
                <div>
                  <button
                    onClick={() => handleStartReview(item)}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white shadow-md shadow-cyan-950/40 transition-all active:scale-95"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>{isAr ? 'مراجعة سريعة (60ث)' : 'Micro-Review (60s)'}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Interactive Micro-Review Modal */}
      {activeReviewItem && activeQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-lg rounded-3xl bg-[#101322] border border-slate-700/80 p-6 shadow-2xl text-slate-100 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <Zap className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {resolveConceptTitle(activeReviewItem.conceptId, lang)}
                  </h3>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {isAr ? 'مراجعة تثبيت الذاكرة المصغرة' : 'Cognitive Micro-Retention Drill'}
                  </div>
                </div>
              </div>

              <button
                onClick={handleCloseModal}
                className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Question prompt */}
            <div className="my-5 p-4 rounded-2xl bg-[#161a30] border border-slate-800">
              <p className="text-sm text-slate-100 font-medium leading-relaxed">
                {isAr ? activeQuestion.promptAr : activeQuestion.promptEn}
              </p>
            </div>

            {/* Options */}
            <div className="space-y-2.5 my-4">
              {activeQuestion.options.map((opt, idx) => {
                const isSelected = selectedOption === idx;
                const isCorrect = idx === activeQuestion.correctIndex;
                let btnStyle = 'bg-[#14182b] border-slate-800 text-slate-300 hover:border-slate-600 hover:bg-[#181d36]';

                if (selectedOption !== null) {
                  if (isCorrect) {
                    btnStyle = 'bg-emerald-500/20 border-emerald-500/60 text-emerald-200 shadow-sm shadow-emerald-900/30';
                  } else if (isSelected) {
                    btnStyle = 'bg-rose-500/20 border-rose-500/60 text-rose-200';
                  } else {
                    btnStyle = 'bg-[#121526]/40 border-slate-900 text-slate-600';
                  }
                }

                return (
                  <button
                    key={idx}
                    disabled={selectedOption !== null}
                    onClick={() => handleAnswer(idx)}
                    className={`w-full text-left p-3.5 rounded-xl border text-xs font-medium transition-all flex items-center justify-between gap-3 ${btnStyle}`}
                  >
                    <span>{isAr ? opt.textAr : opt.textEn}</span>
                    {selectedOption !== null && isCorrect && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Feedback & SM-2 Result Progression */}
            {reviewResult && (
              <div className="mt-5 p-4 rounded-2xl bg-[#121528] border border-slate-800 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {reviewResult.isCorrect ? (
                      <span className="p-1 rounded-full bg-emerald-500/20 text-emerald-400">
                        <CheckCircle2 className="w-4 h-4" />
                      </span>
                    ) : (
                      <span className="p-1 rounded-full bg-rose-500/20 text-rose-400">
                        <AlertTriangle className="w-4 h-4" />
                      </span>
                    )}
                    <span className="text-xs font-bold text-white">
                      {reviewResult.isCorrect
                        ? isAr
                          ? 'إجابة ممتازة وصحيحة!'
                          : 'Outstanding recall!'
                        : isAr
                        ? 'إجابة غير دقيقة'
                        : 'Review needed'}
                    </span>
                  </div>

                  {/* Interval progression pill */}
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-1 rounded-lg border ${
                      reviewResult.isCorrect
                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                        : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                    }`}
                  >
                    {isAr ? 'الفترة القادمة:' : 'Next Interval:'} {reviewResult.newIntervalDays} {isAr ? 'أيام' : 'days'}
                  </span>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  {isAr ? activeQuestion.explanationAr : activeQuestion.explanationEn}
                </p>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={handleCloseModal}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white transition-all"
                  >
                    {isAr ? 'إغلاق ومتابعة' : 'Done & Continue'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
