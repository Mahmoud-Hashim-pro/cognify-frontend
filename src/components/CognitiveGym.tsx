import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, CognitiveDomainScores } from '../types';
import { localize, isArabicLocale } from '../lib/translations';
import { toast } from './Toast';
import { getDailyGymWorkout, checkIqCooldownEligibility, GymChallenge } from '../lib/iqAssessment';
import { updateDoc, doc, increment } from 'firebase/firestore';
import { db, cleanDataForFirestore, handleFirestoreError, OperationType } from '../lib/firebase';
import { eventBus } from '../lib/learningEvents';
import {
  Brain,
  Zap,
  Flame,
  Clock,
  Sparkles,
  Trophy,
  CheckCircle,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  ArrowRight,
  ShieldCheck,
  Award,
  ChevronRight,
  Calendar,
  Menu,
  ArrowLeft,
  Target,
} from 'lucide-react';

interface CognitiveGymProps {
  profile: UserProfile;
  onMenuClick?: () => void;
  onOpenIqModal?: () => void;
  onNavigateBack?: () => void;
}

export default function CognitiveGym({
  profile,
  onMenuClick,
  onOpenIqModal,
  onNavigateBack,
}: CognitiveGymProps) {
  const isAr = isArabicLocale(profile.language);
  const historyCount = profile.iqAssessmentHistory?.length || 0;
  const cooldownInfo = checkIqCooldownEligibility(historyCount, profile.lastIqTestDate);

  const todayIso = new Date().toISOString().split('T')[0];
  const isAlreadyCompletedToday = profile.lastGymDate === todayIso;

  const challenge: GymChallenge = getDailyGymWorkout(todayIso);

  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(isAlreadyCompletedToday);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const handleSubmitAnswer = async () => {
    if (selectedIdx === null || isAnswerSubmitted || !profile.uid) return;

    const correct = selectedIdx === challenge.correctIndex;
    setIsCorrect(correct);
    setIsAnswerSubmitted(true);

    try {
      eventBus.emit('EXERCISE_ANSWERED', profile.uid, {
        subject: 'cognitive_gym',
        topic: challenge.type || 'logic',
        conceptId: challenge.type || 'logic',
        isCorrect: correct,
        responseTimeMs: 8000,
        difficulty: 'medium',
      });
    } catch (evtErr) {
      console.warn('[CognitiveGym] Event emit failed:', evtErr);
    }

    try {
      setIsSubmitting(true);
      const newStreak = (profile.dailyGymStreak || 0) + 1;
      const pointsToAdd = correct ? challenge.pointsReward : 10;

      const updates: any = {
        lastGymDate: todayIso,
        dailyGymStreak: newStreak,
        gymPoints: increment(pointsToAdd),
        points: increment(pointsToAdd),
      };

      await updateDoc(doc(db, 'users', profile.uid), cleanDataForFirestore(updates));

      if (correct) {
        toast.success(
          localize(profile.language, `Spot on! +${pointsToAdd} Cognify points earned.`, `إجابة صحيحة! حصلت على +${pointsToAdd} نقطة كوجنيفي.`),
          localize(profile.language, 'Workout Complete', 'اكتمل التمرين')
        );
      } else {
        toast.info(
          localize(profile.language, `Good try! +10 participation points awarded.`, `محاولة جيدة! حصلت على +10 نقاط للمشاركة.`),
          localize(profile.language, 'Workout Recorded', 'تم تسجيل التمرين')
        );
      }
    } catch (err) {
      console.error('Failed to update gym record:', err);
      handleFirestoreError(err, OperationType.UPDATE, `users/${profile.uid}`);
    } finally {
      if (isMountedRef.current) setIsSubmitting(false);
    }
  };

  const domains = profile.cognitiveDomains || {
    fluidReasoning: 65,
    quantitativeLogic: 70,
    workingMemory: 60,
    processingSpeed: 75,
  };

  return (
    <div className="flex-1 h-screen overflow-y-auto bg-[#0A0C14] text-slate-100 relative selection:bg-cyan-500/30 selection:text-white overflow-x-hidden font-sans custom-scrollbar p-6 md:p-10">
      {/* Ambient Lighting Orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[140px]" />
        <div className="absolute top-1/2 -right-40 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[140px]" />
        <div className="absolute -bottom-40 left-1/3 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[140px]" />
      </div>

      <div className="max-w-5xl mx-auto space-y-6 pb-20">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div className="flex items-center gap-3.5">
            {onNavigateBack && (
              <button
                onClick={onNavigateBack}
                className="p-2.5 text-slate-300 hover:text-white bg-[#121524]/90 shadow-md border border-slate-800 hover:border-slate-700 hover:bg-[#181C2E] rounded-2xl active:scale-95 transition-all flex items-center gap-2 shrink-0"
                title={localize(profile.language, 'Back to Assistant', 'العودة للمساعد')}
              >
                <ArrowLeft className="w-5 h-5 rtl:rotate-180" />
                <span className="text-xs font-bold hidden sm:inline">{localize(profile.language, 'Back', 'رجوع')}</span>
              </button>
            )}
            {onMenuClick && (
              <button
                onClick={onMenuClick}
                className="p-2.5 text-slate-300 hover:text-white bg-[#121524]/90 shadow-md border border-slate-800 hover:border-slate-700 hover:bg-[#181C2E] rounded-2xl active:scale-95 shrink-0 transition-all"
                aria-label={localize(profile.language, 'Toggle menu', 'القائمة')}
                title={localize(profile.language, 'Open Menu', 'فتح القائمة')}
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/5">
              <Flame className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white flex items-center gap-2.5 tracking-tight">
                {localize(profile.language, 'Cognitive Gym', 'الجيم المعرفي اليومي')}
                <span className="text-xs font-black px-2.5 py-0.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Phase 4
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-1 font-medium">
                {localize(
                  profile.language,
                  'Daily 3-minute mental workouts to maintain sharpness between assessment cycles.',
                  'تمارين ذهنية يومية سريعة للحفاظ على التركيز بين فترات تبريد التقييم.'
                )}
              </p>
            </div>
          </div>

          {/* Action button to open full IQ test modal */}
          <button
            onClick={onOpenIqModal}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-cyan-500/20 active:scale-95 transition-all shrink-0"
          >
            <Brain className="w-4 h-4" />
            {localize(profile.language, 'Scientific IQ Test', 'اختبار الذكاء المعياري')}
          </button>
        </div>

        {/* KPI Stats Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Streak */}
          <div className="p-6 rounded-3xl bg-[#121524]/90 border border-slate-800/80 shadow-xl backdrop-blur-xl flex items-center justify-between hover:border-slate-700 transition-all">
            <div className="space-y-1">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                {localize(profile.language, 'Daily Streak', 'سلسلة الأيام')}
              </span>
              <div className="text-3xl font-black text-white font-mono tracking-tight">
                {profile.dailyGymStreak || 0} {localize(profile.language, 'Days', 'أيام')}
              </div>
            </div>
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Flame className="w-6 h-6" />
            </div>
          </div>

          {/* Gym Points */}
          <div className="p-6 rounded-3xl bg-[#121524]/90 border border-slate-800/80 shadow-xl backdrop-blur-xl flex items-center justify-between hover:border-slate-700 transition-all">
            <div className="space-y-1">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                {localize(profile.language, 'Gym Points', 'نقاط الجيم')}
              </span>
              <div className="text-3xl font-black text-cyan-400 font-mono tracking-tight">
                {profile.gymPoints || 0} PTS
              </div>
            </div>
            <div className="p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Sparkles className="w-6 h-6" />
            </div>
          </div>

          {/* IQ Calibration Status */}
          <div className="p-6 rounded-3xl bg-[#121524]/90 border border-slate-800/80 shadow-xl backdrop-blur-xl flex items-center justify-between hover:border-slate-700 transition-all">
            <div className="space-y-1">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                {localize(profile.language, 'Standardized Score', 'الدرجة المعيارية')}
              </span>
              <div className="text-3xl font-black text-indigo-400 font-mono tracking-tight">
                {profile.iqScore ? profile.iqScore : '—'}
              </div>
            </div>
            <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Brain className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Today's Daily 3-Minute Challenge Card */}
        <div className="p-6 md:p-8 rounded-3xl bg-[#121524]/90 border border-slate-800/80 shadow-2xl backdrop-blur-xl space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-black text-cyan-400 tracking-wider uppercase">
                  {localize(profile.language, 'Daily Workout', 'تمرين اليوم')} • +{challenge.pointsReward} PTS
                </span>
                <h3 className="text-lg font-black text-white tracking-tight">
                  {localize(profile.language, challenge.titleEn, challenge.titleAr)}
                </h3>
              </div>
            </div>

            {isAlreadyCompletedToday && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <CheckCircle className="w-3.5 h-3.5" />
                {localize(profile.language, 'Completed Today', 'مكتمل اليوم')}
              </span>
            )}
          </div>

          {/* Challenge Prompt */}
          <div className="p-5 rounded-2xl bg-[#0A0C14] border border-slate-800 text-sm font-semibold text-slate-200 leading-relaxed shadow-inner">
            {challenge.question}
          </div>

          {/* Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {challenge.options.map((opt, idx) => {
              const isSelected = selectedIdx === idx;
              const isCorrectOption = idx === challenge.correctIndex;
              let btnClasses = 'border-slate-800 bg-[#0A0C14] text-slate-300 hover:border-slate-700 hover:bg-[#181C2E]/60';

              if (isAnswerSubmitted) {
                if (isCorrectOption) {
                  btnClasses = 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300 font-bold';
                } else if (isSelected) {
                  btnClasses = 'border-rose-500/60 bg-rose-500/15 text-rose-300 font-bold';
                }
              } else if (isSelected) {
                btnClasses = 'border-cyan-500/60 bg-cyan-500/10 text-cyan-400 ring-2 ring-cyan-500/20 shadow-sm';
              }

              return (
                <button
                  key={idx}
                  disabled={isAnswerSubmitted || isSubmitting}
                  onClick={() => setSelectedIdx(idx)}
                  className={`p-4 rounded-2xl border text-start text-xs font-semibold transition-all active:scale-[0.99] ${btnClasses}`}
                >
                  {opt}
                </button>
              );
            })}
          </div>

          {/* Explanation upon completion */}
          {isAnswerSubmitted && (
            <div className="p-5 rounded-2xl bg-[#0A0C14] border border-slate-800 text-xs text-slate-400 space-y-1.5 shadow-inner">
              <span className="font-bold text-white">
                {localize(profile.language, 'Explanation:', 'التوضيح:')}
              </span>
              <p className="leading-relaxed">{challenge.explanation}</p>
            </div>
          )}

          {/* Submit button */}
          {!isAnswerSubmitted && (
            <div className="flex justify-end pt-2">
              <button
                onClick={handleSubmitAnswer}
                disabled={selectedIdx === null || isSubmitting}
                className="px-8 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-black uppercase tracking-wider hover:bg-primary-press disabled:opacity-40 shadow-xl shadow-cyan-500/20 active:scale-95 transition-all"
              >
                {localize(profile.language, 'Submit Workout', 'إرسال الإجابة')}
              </button>
            </div>
          )}
        </div>

        {/* 4 Cognitive Sub-Domains Radar / Progress */}
        <div className="p-6 md:p-8 rounded-3xl bg-[#121524]/90 border border-slate-800/80 shadow-2xl backdrop-blur-xl space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-base font-black text-white flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                <Target className="w-5 h-5" />
              </span>
              {localize(profile.language, 'Cognitive Domain Metrics', 'مقاييس القدرات المعرفية')}
            </h3>
            <span className="text-xs text-slate-400 font-medium">
              {profile.lastIqTestDate
                ? `${localize(profile.language, 'Last tested:', 'آخر تقييم:')} ${new Date(profile.lastIqTestDate).toLocaleDateString()}`
                : localize(profile.language, 'No formal test taken yet', 'لم يتم إجراء تقييم بعد')}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-[#0A0C14] border border-slate-800 space-y-2.5 shadow-inner">
              <div className="flex justify-between text-xs font-bold text-white">
                <span>{localize(profile.language, 'Fluid Reasoning (Gf)', 'الاستدلال المرن')}</span>
                <span className="font-mono text-cyan-400">{domains.fluidReasoning}%</span>
              </div>
              <div className="w-full h-2 bg-[#121524] border border-slate-800/60 rounded-full overflow-hidden">
                <div className="h-full bg-cyan-400 rounded-full shadow-sm" style={{ width: `${domains.fluidReasoning}%` }} />
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-[#0A0C14] border border-slate-800 space-y-2.5 shadow-inner">
              <div className="flex justify-between text-xs font-bold text-white">
                <span>{localize(profile.language, 'Quantitative Logic (Gq)', 'المنطق الكمي')}</span>
                <span className="font-mono text-indigo-400">{domains.quantitativeLogic}%</span>
              </div>
              <div className="w-full h-2 bg-[#121524] border border-slate-800/60 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full shadow-sm" style={{ width: `${domains.quantitativeLogic}%` }} />
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-[#0A0C14] border border-slate-800 space-y-2.5 shadow-inner">
              <div className="flex justify-between text-xs font-bold text-white">
                <span>{localize(profile.language, 'Working Memory (Gwm)', 'الذاكرة العاملة')}</span>
                <span className="font-mono text-violet-400">{domains.workingMemory}%</span>
              </div>
              <div className="w-full h-2 bg-[#121524] border border-slate-800/60 rounded-full overflow-hidden">
                <div className="h-full bg-violet-500 rounded-full shadow-sm" style={{ width: `${domains.workingMemory}%` }} />
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-[#0A0C14] border border-slate-800 space-y-2.5 shadow-inner">
              <div className="flex justify-between text-xs font-bold text-white">
                <span>{localize(profile.language, 'Processing Speed (Gs)', 'سرعة المعالجة')}</span>
                <span className="font-mono text-amber-400">{domains.processingSpeed}%</span>
              </div>
              <div className="w-full h-2 bg-[#121524] border border-slate-800/60 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full shadow-sm" style={{ width: `${domains.processingSpeed}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
