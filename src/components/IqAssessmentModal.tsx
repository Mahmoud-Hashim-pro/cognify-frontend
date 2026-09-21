import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, CognitiveDomainScores, IqAssessmentRecord, CognitiveLevel } from '../types';
import { localize, isArabicLocale } from '../lib/translations';
import { toast } from './Toast';
import { eventBus } from '../lib/learningEvents';
import {
  IQ_QUESTION_BATTERY,
  calculateStandardizedIq,
  checkIqCooldownEligibility,
  IqQuestion,
} from '../lib/iqAssessment';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db, cleanDataForFirestore, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  Brain,
  Timer,
  CheckCircle,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  RotateCcw,
  X,
  Lock,
  ChevronRight,
  Award,
  Zap,
  ShieldAlert,
  Clock,
  Layers,
  BarChart3,
} from 'lucide-react';

interface IqAssessmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  onIqUpdated?: (newScore: number, domainScores: CognitiveDomainScores, newLevel?: CognitiveLevel) => void;
}

export default function IqAssessmentModal({
  isOpen,
  onClose,
  profile,
  onIqUpdated,
}: IqAssessmentModalProps) {
  const isAr = isArabicLocale(profile.language);
  const historyCount = profile.iqAssessmentHistory?.length || 0;
  const cooldownInfo = checkIqCooldownEligibility(historyCount, profile.lastIqTestDate);

  // Flow states: 'intro' | 'active' | 'results'
  const [step, setStep] = useState<'intro' | 'active' | 'results'>('intro');
  const [currentIdx, setCurrentIdx] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [secondsLeft, setSecondsLeft] = useState(45);
  const [elapsedTotal, setElapsedTotal] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [assessmentResult, setAssessmentResult] = useState<IqAssessmentRecord | null>(null);

  const isMountedRef = useRef(true);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Timer watchdog during active testing
  useEffect(() => {
    if (step !== 'active') return;

    const currentQ = IQ_QUESTION_BATTERY[currentIdx];
    if (!currentQ) return;

    setSecondsLeft(currentQ.timeLimitSeconds);

    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setElapsedTotal((prev) => prev + 1);
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          // Time expired on this question -> auto advance
          handleNextQuestion();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [step, currentIdx]);

  if (!isOpen) return null;

  const currentQ: IqQuestion | undefined = IQ_QUESTION_BATTERY[currentIdx];

  // Dynamically shuffle options for the current question so option positions are random each time
  const shuffledOptions = React.useMemo(() => {
    if (!currentQ) return [];
    const opts = [...currentQ.options];
    for (let i = opts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [opts[i], opts[j]] = [opts[j], opts[i]];
    }
    return opts;
  }, [currentQ?.id]);

  const handleSelectOption = (optionId: string) => {
    if (!currentQ) return;
    setUserAnswers((prev) => ({ ...prev, [currentQ.id]: optionId }));
  };

  const handleNextQuestion = () => {
    if (currentIdx + 1 < IQ_QUESTION_BATTERY.length) {
      setCurrentIdx((prev) => prev + 1);
    } else {
      finishAssessment();
    }
  };

  const finishAssessment = async () => {
    if (timerRef.current) clearInterval(timerRef.current);

    const { iqScore, domainScores, recommendedPersona } = calculateStandardizedIq(
      userAnswers,
      elapsedTotal
    );

    const newRecord: IqAssessmentRecord = {
      id: `iq_${Date.now()}`,
      testIndex: historyCount + 1,
      date: new Date().toISOString(),
      iqScore,
      domainScores,
      durationSeconds: elapsedTotal,
      recommendedPersona,
    };

    setAssessmentResult(newRecord);
    setStep('results');

    try {
      eventBus.emit('EVALUATION_COMPLETED', profile.uid || 'guest', {
        conceptId: 'standardized_iq_assessment',
        preScore: 0,
        postScore: iqScore,
        normalizedGain: Math.min(1.0, iqScore / 100),
      });
    } catch (e) {
      console.warn('[IqAssessmentModal] EventBus emit error:', e);
    }

    // Save to Firestore if uid exists
    if (profile.uid) {
      try {
        setIsSubmitting(true);
        const nextDate = new Date();
        const exponent = Math.min(4, Math.max(0, historyCount));
        const cooldownDays = 7 * Math.pow(2, exponent);
        nextDate.setTime(nextDate.getTime() + cooldownDays * 24 * 60 * 60 * 1000);

        const computedLevel: CognitiveLevel =
          recommendedPersona === 'Socratic' ? 'Advanced' : (recommendedPersona === 'Foundational' ? 'Basic' : 'Intermediate');

        // Decoupled: Academic level is governed exclusively by curriculum progress and
        // StudentStateManager concept mastery, NOT by optional cognitive assessments.
        // cognitiveLevel calibrates AI persona explanation tone without mutating academic level.
        const updates = {
          iqScore,
          cognitiveDomains: domainScores,
          lastIqTestDate: newRecord.date,
          nextEligibleIqDate: nextDate.toISOString(),
          iqAssessmentHistory: arrayUnion(cleanDataForFirestore(newRecord)),
          cognitiveLevel: computedLevel,
        };

        await updateDoc(doc(db, 'users', profile.uid), cleanDataForFirestore(updates));
        onIqUpdated(iqScore, domainScores, computedLevel);

        toast.success(
          localize(
            profile.language,
            `Cognitive calibration complete! Standardized score: ${iqScore}`,
            `تم اكتمال المعايرة المعرفية! الدرجة المعيارية: ${iqScore}`
          ),
          localize(profile.language, 'Assessment Recorded', 'تم حفظ التقييم')
        );
      } catch (err) {
        console.error('Failed to save IQ record:', err);
        handleFirestoreError(err, OperationType.UPDATE, `users/${profile.uid}`);
      } finally {
        if (isMountedRef.current) setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div
        className="relative w-full max-w-2xl rounded-[32px] bg-[#121524] border border-slate-800 text-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        dir={isAr ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800/80 bg-[#181C2E]/60">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold shadow-md shadow-cyan-500/5">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-black text-white text-base flex items-center gap-2.5 tracking-tight">
                {localize(profile.language, 'Scientific Cognitive Assessment', 'التقييم المعرفي العلمي')}
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  CHC Framework
                </span>
              </h2>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                {localize(
                  profile.language,
                  'Culture-fair non-verbal reasoning, quantitative logic, memory, and speed.',
                  'استدلال مصفوفات غير لفظي، منطق كمي، ذاكرة عاملة، وسرعة بديهة.'
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 rounded-2xl text-slate-400 hover:text-white hover:bg-[#181C2E] border border-transparent hover:border-slate-800 transition-all active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
          {/* ─── INTRO STEP ──────────────────────────────────────────────── */}
          {step === 'intro' && (
            <div className="space-y-6">
              {/* Cooldown Lock Warning if not eligible */}
              {!cooldownInfo.isEligible ? (
                <div className="p-5 rounded-3xl bg-amber-500/10 border border-amber-500/30 space-y-3 text-amber-200">
                  <div className="flex items-center gap-3 text-amber-400">
                    <Lock className="w-6 h-6 shrink-0" />
                    <h3 className="font-black text-sm tracking-tight">
                      {localize(profile.language, 'Exponential Cooldown Active', 'فترة التبريد الزمني الأسي نشطة')}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed font-medium">
                    {localize(
                      profile.language,
                      `To preserve psychometric test-retest validity and eliminate practice bias, tests unlock after an exponential cooldown period (7 x 2^(n-1) days). You have completed ${historyCount} assessment(s).`,
                      `للحفاظ على الدقة القياسية ومنع حفظ الإجابات، تفتح الاختبارات بفترات تبريد أسي (7 × 2^(n-1) يوماً). لقد أكملت ${historyCount} اختبار(ات).`
                    )}
                  </p>
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-400 pt-1">
                    <Clock className="w-4 h-4" />
                    {localize(
                      profile.language,
                      `Eligible in: ${cooldownInfo.daysRemaining} days (${cooldownInfo.nextEligibleDate.toLocaleDateString()})`,
                      `يمكنك الإعادة بعد: ${cooldownInfo.daysRemaining} يوماً (${cooldownInfo.nextEligibleDate.toLocaleDateString()})`
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3 text-emerald-400 text-xs font-bold">
                  <CheckCircle className="w-5 h-5 shrink-0" />
                  {localize(
                    profile.language,
                    'You are eligible to take the cognitive assessment now.',
                    'أنت مؤهل لإجراء التقييم المعرفي الآن.'
                  )}
                </div>
              )}

              {/* Cognitive Domains Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="p-4 rounded-2xl bg-[#0A0C14] border border-slate-800 space-y-1.5 shadow-inner">
                  <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs">
                    <Layers className="w-4 h-4" />
                    {localize(profile.language, 'Fluid Reasoning (Gf)', 'الاستدلال المرن (Gf)')}
                  </div>
                  <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                    {localize(
                      profile.language,
                      'Abstract pattern completions and matrix transformations without language bias.',
                      'إكمال مصفوفات الأنماط المجردة دون انحياز لغوي أو ثقافي.'
                    )}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#0A0C14] border border-slate-800 space-y-1.5 shadow-inner">
                  <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs">
                    <BarChart3 className="w-4 h-4" />
                    {localize(profile.language, 'Quantitative Logic (Gq)', 'المنطق الرياضي (Gq)')}
                  </div>
                  <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                    {localize(
                      profile.language,
                      'Syllogisms, transitive orderings, and relational deductive logic.',
                      'الاستنتاج المنطقي الشرطي وعلاقات الترتيب المتسلسلة.'
                    )}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#0A0C14] border border-slate-800 space-y-1.5 shadow-inner">
                  <div className="flex items-center gap-2 text-violet-400 font-bold text-xs">
                    <Brain className="w-4 h-4" />
                    {localize(profile.language, 'Working Memory (Gwm)', 'الذاكرة العاملة (Gwm)')}
                  </div>
                  <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                    {localize(
                      profile.language,
                      'Holding and manipulating spatial coordinates and reverse sequences.',
                      'استبقاء الإحداثيات المكانية والمعكوسات التسلسلية في الذاكرة.'
                    )}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#0A0C14] border border-slate-800 space-y-1.5 shadow-inner">
                  <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                    <Zap className="w-4 h-4" />
                    {localize(profile.language, 'Processing Speed (Gs)', 'سرعة المعالجة (Gs)')}
                  </div>
                  <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                    {localize(
                      profile.language,
                      'Perceptual comparison and rapid odd-one-out discrimination under time limits.',
                      'المقارنة البصرية السريعة والتمييز الدقيق تحت مؤقت زمني صارم.'
                    )}
                  </p>
                </div>
              </div>

              {/* Instructions */}
              <div className="text-xs text-slate-400 space-y-1.5 bg-[#0A0C14] p-5 rounded-2xl border border-slate-800 shadow-inner font-medium">
                <p className="font-bold text-white mb-1">
                  {localize(profile.language, 'Assessment Guidelines:', 'إرشادات الاختبار:')}
                </p>
                <p>• {localize(profile.language, '12 standardized items (takes ~6-8 minutes).', '12 عنصراً معيارياً (يستغرق ~6-8 دقائق).')}</p>
                <p>• {localize(profile.language, 'Each question has an individual countdown timer.', 'لكل سؤال مؤقت زمني مخصص ينقل للسؤال التالي تلقائياً.')}</p>
                <p>• {localize(profile.language, 'Your AI persona will automatically calibrate to your result.', 'سيتكيف أسلوب المساعد الذكي تلقائياً مع نتيجتك.')}</p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={onClose}
                  className="px-6 py-3 rounded-2xl border border-slate-800 hover:border-slate-700 bg-[#0A0C14] text-slate-300 hover:text-white text-xs font-bold transition-all active:scale-95"
                >
                  {localize(profile.language, 'Cancel', 'إلغاء')}
                </button>
                <button
                  onClick={() => {
                    setCurrentIdx(0);
                    setUserAnswers({});
                    setElapsedTotal(0);
                    setStep('active');
                  }}
                  disabled={!cooldownInfo.isEligible}
                  className="px-8 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-black uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed shadow-xl shadow-cyan-500/20 active:scale-95 transition-all flex items-center gap-2"
                >
                  {localize(profile.language, 'Start Assessment', 'ابدأ التقييم')}
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ─── ACTIVE TESTING STEP ─────────────────────────────────────── */}
          {step === 'active' && currentQ && (
            <div className="space-y-5">
              {/* Progress and Timer Bar */}
              <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800/80">
                <div className="flex items-center gap-2.5">
                  <span className="font-bold text-white">
                    {localize(profile.language, `Question ${currentIdx + 1} of ${IQ_QUESTION_BATTERY.length}`, `السؤال ${currentIdx + 1} من ${IQ_QUESTION_BATTERY.length}`)}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-bold text-[10px]">
                    {currentQ.domain}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 font-mono text-xs font-black text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-xl">
                  <Clock className="w-4 h-4 animate-pulse" />
                  <span>{secondsLeft}s</span>
                </div>
              </div>

              {/* Progress Line */}
              <div className="w-full h-1.5 bg-[#0A0C14] border border-slate-800/60 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 transition-all duration-300"
                  style={{ width: `${((currentIdx + 1) / IQ_QUESTION_BATTERY.length) * 100}%` }}
                />
              </div>

              {/* Question Prompt */}
              <div className="p-5 rounded-2xl bg-[#0A0C14] border border-slate-800 space-y-4 shadow-inner">
                <h3 className="font-bold text-white text-sm leading-relaxed">
                  {localize(profile.language, currentQ.promptEn, currentQ.promptAr)}
                </h3>

                {/* 3x3 Matrix rendering if exists */}
                {currentQ.matrixData && (
                  <div className="inline-block p-5 rounded-3xl bg-[#121524] border-2 border-cyan-500/30 shadow-2xl mx-auto">
                    <div className="grid grid-cols-3 gap-2.5 text-center text-xl font-mono">
                      {currentQ.matrixData.grid.map((row, rIdx) =>
                        row.map((cell, cIdx) => {
                          const isMissing =
                            rIdx === currentQ.matrixData!.missingCell[0] &&
                            cIdx === currentQ.matrixData!.missingCell[1];
                          return (
                            <div
                              key={`${rIdx}-${cIdx}`}
                              className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black border transition-all ${
                                isMissing
                                  ? 'bg-amber-500/20 border-amber-500 text-amber-300 animate-pulse shadow-lg shadow-amber-500/10'
                                  : 'bg-[#0A0C14] border-slate-800 text-slate-200'
                              }`}
                            >
                              {cell}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Options Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {shuffledOptions.map((opt) => {
                  const isSelected = userAnswers[currentQ.id] === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => handleSelectOption(opt.id)}
                      className={`p-4 rounded-2xl border text-start transition-all text-xs font-semibold flex items-center gap-3 active:scale-[0.99] ${
                        isSelected
                          ? 'border-cyan-500/60 bg-cyan-500/10 text-cyan-300 ring-2 ring-cyan-500/20 shadow-md'
                          : 'border-slate-800 bg-[#0A0C14] text-slate-300 hover:border-slate-700 hover:bg-[#181C2E]/60'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-bold shrink-0 ${
                          isSelected ? 'border-cyan-400 bg-cyan-500 text-slate-900' : 'border-slate-700 bg-slate-800/40 text-transparent'
                        }`}
                      >
                        ✓
                      </div>
                      <span className="flex-1">
                        {localize(profile.language, opt.labelEn, opt.labelAr)}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Action Button */}
              <div className="flex justify-end pt-3">
                <button
                  onClick={handleNextQuestion}
                  disabled={!userAnswers[currentQ.id]}
                  className="px-8 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-black uppercase tracking-wider disabled:opacity-40 shadow-xl shadow-cyan-500/20 active:scale-95 transition-all flex items-center gap-2"
                >
                  {currentIdx + 1 === IQ_QUESTION_BATTERY.length
                    ? localize(profile.language, 'Finish & Calculate', 'إنهاء وحساب النتيجة')
                    : localize(profile.language, 'Next Question', 'السؤال التالي')}
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ─── RESULTS STEP ────────────────────────────────────────────── */}
          {step === 'results' && assessmentResult && (
            <div className="space-y-6 text-center animate-fadeIn">
              <div className="w-16 h-16 rounded-3xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto shadow-xl shadow-cyan-500/10">
                <Award className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-2xl font-black text-white tracking-tight">
                  {localize(profile.language, 'Assessment Complete', 'اكتمل التقييم المعرفي')}
                </h3>
                <p className="text-xs text-slate-400 mt-1 font-medium">
                  {localize(profile.language, 'Standardized against normative cognitive benchmarks (Mean: 100, SD: 15).', 'معاير وفقاً للمقاييس المعرفية القياسية (المتوسط: 100، الانحراف: 15).')}
                </p>
              </div>

              {/* Main Score Card */}
              <div className="p-8 rounded-3xl bg-[#0A0C14] border border-slate-800 shadow-2xl max-w-sm mx-auto">
                <div className="text-xs text-slate-400 font-black tracking-wider uppercase mb-2">
                  {localize(profile.language, 'Composite Cognitive Score', 'معدل الذكاء المعياري المركب')}
                </div>
                <div className="text-6xl font-black text-cyan-400 font-mono tracking-tight">
                  {assessmentResult.iqScore}
                </div>
                <div className="mt-4 inline-block px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-bold">
                  {assessmentResult.recommendedPersona}{' '}
                  {localize(profile.language, 'Persona Calibrated', 'نمط معاير')}
                </div>
              </div>

              {/* 4 Domain Sub-Scores */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-start">
                <div className="p-4 rounded-2xl bg-[#0A0C14] border border-slate-800">
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Gf Fluid</div>
                  <div className="text-xl font-black text-white font-mono mt-1">
                    {assessmentResult.domainScores.fluidReasoning}%
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#0A0C14] border border-slate-800">
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Gq Logic</div>
                  <div className="text-xl font-black text-indigo-400 font-mono mt-1">
                    {assessmentResult.domainScores.quantitativeLogic}%
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#0A0C14] border border-slate-800">
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Gwm Memory</div>
                  <div className="text-xl font-black text-violet-400 font-mono mt-1">
                    {assessmentResult.domainScores.workingMemory}%
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#0A0C14] border border-slate-800">
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Gs Speed</div>
                  <div className="text-xl font-black text-amber-400 font-mono mt-1">
                    {assessmentResult.domainScores.processingSpeed}%
                  </div>
                </div>
              </div>

              {/* Retest Lock Info */}
              <div className="p-5 rounded-2xl bg-[#0A0C14] border border-slate-800 text-xs text-slate-400 text-start space-y-1.5">
                <div className="font-bold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  {localize(profile.language, 'Exponential Cooldown Scheduled', 'فترة التبريد الزمني القادمة')}
                </div>
                <p className="leading-relaxed">
                  {localize(
                    profile.language,
                    `Next eligible retest in ${7 * Math.pow(2, Math.min(4, historyCount))} days. Practice daily in the Cognitive Gym to maintain sharpness!`,
                    `إعادة الاختبار القادمة متاحة بعد ${7 * Math.pow(2, Math.min(4, historyCount))} يوماً. مارس التمارين اليومية في الجيم المعرفي للحفاظ على تركيزك!`
                  )}
                </p>
              </div>

              <div className="flex justify-center pt-2">
                <button
                  onClick={onClose}
                  className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-black uppercase tracking-wider shadow-xl shadow-cyan-500/20 active:scale-95 transition-all"
                >
                  {localize(profile.language, 'Done & Return to Workspace', 'تم والعودة لمساحة العمل')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
