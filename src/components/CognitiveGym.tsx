import React, { useState, useEffect, useRef } from 'react';
import { UserProfile } from '../types';
import { localize, isArabicLocale } from '../lib/translations';
import { toast } from './Toast';
import { updateDoc, doc, increment } from 'firebase/firestore';
import { db, cleanDataForFirestore, handleFirestoreError, OperationType } from '../lib/firebase';
import { eventBus } from '../lib/learningEvents';
import { triggerHapticAlert } from '../lib/hapticNavEngine';
import {
  Brain,
  Zap,
  Flame,
  Clock,
  Sparkles,
  Trophy,
  CheckCircle2,
  RotateCcw,
  ShieldCheck,
  ChevronRight,
  Menu,
  ArrowLeft,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Layers,
  HelpCircle,
  Hash,
  Eye,
  Sliders,
  Check,
  AlertTriangle,
  Lightbulb,
  Headphones,
  Compass,
} from 'lucide-react';
import {
  generateGoNoGoSession,
  evaluateGoNoGoPerformance,
  GoNoGoTrial,
  GoNoGoResult,
  generateMemoryGridSequence,
  evaluateMemoryGridAnswer,
  MemoryGridRound,
  TARGET_REFERENCE_CARDS,
  generateRandomTestCard,
  checkSetShiftingMatch,
  pickNextShiftingRule,
  SetShiftingCard,
  SortRule,
  generateStroopTrial,
  StroopTrial,
  sliceTaskIntoMicroSteps,
  TaskSlicerDecomposition,
  ambientNoise,
  NoiseType,
  buildTenFrame,
  CUISENAIRE_RODS,
  generateConcreteMathProblem,
  VisualArithmeticProblem,
  evaluateCompassionateStreak,
} from '../lib/cognitiveEngine';

interface CognitiveGymProps {
  profile: UserProfile;
  onMenuClick?: () => void;
  onOpenIqModal?: () => void;
  onNavigateBack?: () => void;
}

type GymTab = 'drills' | 'adhd' | 'dyscalculia' | 'low-arousal';
type DrillType = 'gonogo' | 'memory_grid' | 'set_shifting' | 'stroop';

export default function CognitiveGym({
  profile,
  onMenuClick,
  onOpenIqModal,
  onNavigateBack,
}: CognitiveGymProps) {
  const isAr = isArabicLocale(profile.language);
  const todayIso = new Date().toISOString().split('T')[0];

  // Compassionate Streak State
  const streakInfo = evaluateCompassionateStreak(
    profile.lastGymDate,
    profile.dailyGymStreak || 0,
    todayIso
  );

  const [activeTab, setActiveTab] = useState<GymTab>('drills');
  const [selectedDrill, setSelectedDrill] = useState<DrillType>('gonogo');
  const [isLowArousalMode, setIsLowArousalMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('cognify_gym_low_arousal') === 'true';
    } catch {
      return false;
    }
  });

  const toggleLowArousal = () => {
    const next = !isLowArousalMode;
    setIsLowArousalMode(next);
    try {
      localStorage.setItem('cognify_gym_low_arousal', String(next));
    } catch {}
  };

  // ──────────────────────────────────────────────────────────────────────────
  // 1. GO / NO-GO STATE MACHINE
  // ──────────────────────────────────────────────────────────────────────────
  const [gngState, setGngState] = useState<'idle' | 'running' | 'completed'>('idle');
  const [gngTrials, setGngTrials] = useState<GoNoGoTrial[]>([]);
  const [gngCurrentIdx, setGngCurrentIdx] = useState<number>(0);
  const [gngResponses, setGngResponses] = useState<{ trialId: string; userClicked: boolean; reactionTimeMs: number }[]>([]);
  const [gngResult, setGngResult] = useState<GoNoGoResult | null>(null);
  const trialStartTimeRef = useRef<number>(0);
  const gngTimerRef = useRef<any>(null);

  const startGoNoGo = () => {
    const session = generateGoNoGoSession(15, 'medium');
    setGngTrials(session);
    setGngCurrentIdx(0);
    setGngResponses([]);
    setGngResult(null);
    setGngState('running');
  };

  useEffect(() => {
    if (gngState !== 'running' || gngTrials.length === 0) return;

    if (gngCurrentIdx >= gngTrials.length) {
      // Completed session
      const evaluation = evaluateGoNoGoPerformance(gngTrials, gngResponses);
      setGngResult(evaluation);
      setGngState('completed');
      awardPoints(evaluation.score > 70 ? 30 : 15, 'gonogo_inhibitory_control');
      return;
    }

    const currentTrial = gngTrials[gngCurrentIdx];
    trialStartTimeRef.current = Date.now();

    // Auto-advance after trial duration if user did not click
    gngTimerRef.current = setTimeout(() => {
      setGngResponses(prev => [
        ...prev,
        { trialId: currentTrial.id, userClicked: false, reactionTimeMs: 0 },
      ]);
      setGngCurrentIdx(idx => idx + 1);
    }, currentTrial.durationMs);

    return () => {
      if (gngTimerRef.current) clearTimeout(gngTimerRef.current);
    };
  }, [gngState, gngCurrentIdx, gngTrials]);

  const handleGoNoGoClick = () => {
    if (gngState !== 'running' || gngCurrentIdx >= gngTrials.length) return;
    if (gngTimerRef.current) clearTimeout(gngTimerRef.current);

    const reactionTime = Date.now() - trialStartTimeRef.current;
    const currentTrial = gngTrials[gngCurrentIdx];

    setGngResponses(prev => [
      ...prev,
      { trialId: currentTrial.id, userClicked: true, reactionTimeMs: reactionTime },
    ]);
    triggerHapticAlert('single-pulse');
    setGngCurrentIdx(idx => idx + 1);
  };

  // Keyboard Spacebar listener for Go/No-Go accessibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && activeTab === 'drills' && selectedDrill === 'gonogo' && gngState === 'running') {
        e.preventDefault();
        handleGoNoGoClick();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, selectedDrill, gngState, gngCurrentIdx, gngTrials]);

  // ──────────────────────────────────────────────────────────────────────────
  // 2. WORKING MEMORY GRID STATE MACHINE
  // ──────────────────────────────────────────────────────────────────────────
  const [wmRound, setWmRound] = useState<MemoryGridRound>(() => generateMemoryGridSequence(3, 3, false));
  const [wmState, setWmState] = useState<'idle' | 'showing' | 'input' | 'success' | 'failure'>('idle');
  const [wmActiveIndex, setWmActiveIndex] = useState<number | null>(null);
  const [wmUserSequence, setWmUserSequence] = useState<number[]>([]);
  const [wmLevel, setWmLevel] = useState<number>(3);
  const [wmIsReverse, setWmIsReverse] = useState<boolean>(false);

  const startMemoryGrid = () => {
    const round = generateMemoryGridSequence(wmLevel, 3, wmIsReverse);
    setWmRound(round);
    setWmUserSequence([]);
    setWmState('showing');
    playMemorySequence(round.sequence);
  };

  const playMemorySequence = (seq: number[]) => {
    let step = 0;
    const interval = setInterval(() => {
      if (step < seq.length) {
        setWmActiveIndex(seq[step]);
        triggerHapticAlert('single-pulse');
        step++;
        setTimeout(() => {
          setWmActiveIndex(null);
        }, 400);
      } else {
        clearInterval(interval);
        setWmActiveIndex(null);
        setWmState('input');
      }
    }, 800);
  };

  const handleCellClick = (idx: number) => {
    if (wmState !== 'input') return;
    const nextSeq = [...wmUserSequence, idx];
    setWmUserSequence(nextSeq);
    triggerHapticAlert('single-pulse');

    const evalResult = evaluateMemoryGridAnswer(wmRound, nextSeq);
    const target = wmRound.isReverse ? [...wmRound.sequence].reverse() : wmRound.sequence;

    if (nextSeq.length === target.length) {
      if (evalResult.isCorrect) {
        setWmState('success');
        awardPoints(25, 'working_memory_grid');
        setTimeout(() => {
          setWmLevel(l => Math.min(7, l + 1));
          setWmState('idle');
        }, 1500);
      } else {
        setWmState('failure');
        setTimeout(() => {
          setWmState('idle');
        }, 1500);
      }
    } else {
      // Check partial mismatch early
      for (let i = 0; i < nextSeq.length; i++) {
        if (nextSeq[i] !== target[i]) {
          setWmState('failure');
          setTimeout(() => {
            setWmState('idle');
          }, 1500);
          return;
        }
      }
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // 3. COGNITIVE SET-SHIFTING (WISCONSIN STYLE)
  // ──────────────────────────────────────────────────────────────────────────
  const [activeRule, setActiveRule] = useState<SortRule>('color');
  const [testCard, setTestCard] = useState<SetShiftingCard>(() => generateRandomTestCard());
  const [consecutiveSortCorrect, setConsecutiveSortCorrect] = useState<number>(0);
  const [lastSortFeedback, setLastSortFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [totalShiftsAchieved, setTotalShiftsAchieved] = useState<number>(0);

  const handleSortSelection = (refCard: SetShiftingCard) => {
    const isMatch = checkSetShiftingMatch(testCard, refCard, activeRule);
    if (isMatch) {
      setLastSortFeedback('correct');
      const nextConsecutive = consecutiveSortCorrect + 1;
      setConsecutiveSortCorrect(nextConsecutive);

      // Rule shifts silently after 4 correct sorts
      if (nextConsecutive >= 4) {
        const nextRule = pickNextShiftingRule(activeRule);
        setActiveRule(nextRule);
        setConsecutiveSortCorrect(0);
        setTotalShiftsAchieved(s => s + 1);
        awardPoints(20, 'cognitive_flexibility_shift');
        toast.info(
          localize(
            profile.language,
            '🔄 Rule shifted! Observe the feedback to deduce the new sorting rule.',
            '🔄 القاعدة تغيرت تلقائياً! راقب النتيجة واستنتج قاعدة الفرز الجديدة.'
          )
        );
      }
    } else {
      setLastSortFeedback('wrong');
      setConsecutiveSortCorrect(0);
    }

    setTestCard(generateRandomTestCard(`card_${Date.now()}`));
  };

  // ──────────────────────────────────────────────────────────────────────────
  // 4. STROOP FOCUS TEST
  // ──────────────────────────────────────────────────────────────────────────
  const [stroopTrial, setStroopTrial] = useState<StroopTrial>(() => generateStroopTrial());
  const [stroopScore, setStroopScore] = useState<number>(0);
  const [stroopStreak, setStroopStreak] = useState<number>(0);

  const handleStroopAnswer = (chosenColor: 'red' | 'blue' | 'green' | 'yellow') => {
    const correct = chosenColor === stroopTrial.colorName;
    if (correct) {
      setStroopScore(s => s + 10);
      setStroopStreak(s => s + 1);
      triggerHapticAlert('single-pulse');
    } else {
      setStroopStreak(0);
      triggerHapticAlert('warning');
    }
    setStroopTrial(generateStroopTrial());
  };

  // ──────────────────────────────────────────────────────────────────────────
  // 5. ADHD TASK SLICER (EXECUTIVE UNBLOCKER)
  // ──────────────────────────────────────────────────────────────────────────
  const [taskInput, setTaskInput] = useState<string>('');
  const [slicedTask, setSlicedTask] = useState<TaskSlicerDecomposition | null>(null);

  const handleSliceTask = () => {
    if (!taskInput.trim()) return;
    const result = sliceTaskIntoMicroSteps(taskInput);
    setSlicedTask(result);
  };

  const handleToggleStep = (stepId: string) => {
    if (!slicedTask) return;
    const updated = {
      ...slicedTask,
      steps: slicedTask.steps.map(s => {
        if (s.id === stepId) {
          const next = !s.completed;
          if (next) {
            awardPoints(s.dopamineBonus, 'micro_task_completed');
            triggerHapticAlert('arrival');
          }
          return { ...s, completed: next };
        }
        return s;
      }),
    };
    setSlicedTask(updated);

    const allDone = updated.steps.every(s => s.completed);
    if (allDone) {
      toast.success(
        localize(
          profile.language,
          '🎉 Incredible executive momentum! Entire task completed micro-step by micro-step.',
          '🎉 إنجاز مذهل! تغلبت على الشلل التنفيذي وأنهيت المهمة خطوة بخطوة.'
        )
      );
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // 6. ADHD MICRO-SPRINT TIMER & AMBIENT NOISE
  // ──────────────────────────────────────────────────────────────────────────
  const [sprintDurationMinutes, setSprintDurationMinutes] = useState<number>(10);
  const [sprintSecondsRemaining, setSprintSecondsRemaining] = useState<number>(10 * 60);
  const [isSprintRunning, setIsSprintRunning] = useState<boolean>(false);
  const [activeNoiseType, setActiveNoiseType] = useState<NoiseType | null>(null);
  const [noiseVolume, setNoiseVolume] = useState<number>(0.25);

  useEffect(() => {
    let interval: any = null;
    if (isSprintRunning && sprintSecondsRemaining > 0) {
      interval = setInterval(() => {
        setSprintSecondsRemaining(s => s - 1);
      }, 1000);
    } else if (isSprintRunning && sprintSecondsRemaining === 0) {
      setIsSprintRunning(false);
      triggerHapticAlert('arrival');
      toast.success(
        localize(
          profile.language,
          '⏰ Sprint Complete! Stand up, stretch, and claim your focus dopamine reward.',
          '⏰ انتهت جلسة التركيز! تحرك واشرب ماء واحتفل بتركيزك العالي.'
        )
      );
      awardPoints(35, 'adhd_micro_sprint_complete');
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isSprintRunning, sprintSecondsRemaining]);

  const handleToggleNoise = (type: NoiseType) => {
    if (activeNoiseType === type) {
      ambientNoise.stop();
      setActiveNoiseType(null);
    } else {
      ambientNoise.play(type, noiseVolume);
      setActiveNoiseType(type);
    }
  };

  const handleVolumeChange = (vol: number) => {
    setNoiseVolume(vol);
    ambientNoise.setVolume(vol);
  };

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      ambientNoise.stop();
    };
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // 7. DYSCALCULIA CONCRETE MODELER
  // ──────────────────────────────────────────────────────────────────────────
  const [tenFrameInput, setTenFrameInput] = useState<number>(8);
  const [mathProblem, setMathProblem] = useState<VisualArithmeticProblem>(() => generateConcreteMathProblem());
  const tenFrame = buildTenFrame(tenFrameInput);

  // ──────────────────────────────────────────────────────────────────────────
  // 8. DATABASE & POINTS REWARD
  // ──────────────────────────────────────────────────────────────────────────
  const awardPoints = async (points: number, conceptId: string) => {
    if (!profile.uid) return;
    try {
      eventBus.emit('EXERCISE_ANSWERED', profile.uid, {
        subject: 'cognitive_gym_2',
        topic: conceptId,
        conceptId,
        isCorrect: true,
        responseTimeMs: 3000,
        difficulty: 'medium',
      });

      const updates: any = {
        lastGymDate: todayIso,
        dailyGymStreak: streakInfo.currentStreak,
        gymPoints: increment(points),
        points: increment(points),
      };
      await updateDoc(doc(db, 'users', profile.uid), cleanDataForFirestore(updates));
    } catch (err) {
      console.warn('[CognitiveGym] Point award update failed:', err);
    }
  };

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${
        isLowArousalMode
          ? 'bg-slate-900 text-slate-200'
          : 'bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-slate-100'
      } pb-24`}
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onNavigateBack && (
            <button
              onClick={onNavigateBack}
              className="p-2 rounded-xl bg-slate-800/70 hover:bg-slate-700/80 text-slate-300 transition-colors"
              aria-label={localize(profile.language, 'Back', 'رجوع')}
            >
              <ArrowLeft className={`w-5 h-5 ${isAr ? 'rotate-180' : ''}`} />
            </button>
          )}
          {onMenuClick && (
            <button
              onClick={onMenuClick}
              className="p-2 rounded-xl bg-slate-800/70 hover:bg-slate-700/80 text-slate-300 transition-colors md:hidden"
              aria-label="Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white flex items-center gap-2">
                {localize(profile.language, 'Cognitive & Executive Hub', 'مركز الوظائف التنفيذية والإدراك')}
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  v2.0
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                {localize(
                  profile.language,
                  'Evidence-based executive function & ADHD scaffolds',
                  'تدريب مثبت علمياً للوظائف التنفيذية وأدوات ADHD'
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Compassionate Streak Badge */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleLowArousal}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
              isLowArousalMode
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
            title={localize(profile.language, 'Toggle Low-Arousal Sensory Mode', 'تبديل وضع الهدوء الحسي')}
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {isLowArousalMode
                ? localize(profile.language, 'Low Sensory: ON', 'وضع الهدوء: مفعّل')
                : localize(profile.language, 'Low Sensory Mode', 'وضع الهدوء الحسي')}
            </span>
          </button>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold">
            <Flame className="w-4 h-4 fill-amber-500" />
            <span>{streakInfo.currentStreak} {localize(profile.language, 'Days', 'أيام')}</span>
            {streakInfo.shieldActive && (
              <span title={streakInfo.messageAr}>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Tab Navigation */}
      <div className="max-w-5xl mx-auto px-4 pt-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-1.5 bg-slate-900/90 border border-slate-800 rounded-2xl">
          <button
            onClick={() => setActiveTab('drills')}
            className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'drills'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Zap className="w-4 h-4" />
            {localize(profile.language, 'Executive Drills', 'تمارين الوظائف')}
          </button>

          <button
            onClick={() => setActiveTab('adhd')}
            className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'adhd'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Clock className="w-4 h-4" />
            {localize(profile.language, 'ADHD Toolkit', 'أدوات التركيز و ADHD')}
          </button>

          <button
            onClick={() => setActiveTab('dyscalculia')}
            className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'dyscalculia'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Hash className="w-4 h-4" />
            {localize(profile.language, 'Dyscalculia Math', 'معمل الحساب البصري')}
          </button>

          <button
            onClick={() => setActiveTab('low-arousal')}
            className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'low-arousal'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Compass className="w-4 h-4" />
            {localize(profile.language, 'Autism Low-Sensory', 'الهدوء والتوقع')}
          </button>
        </div>
      </div>

      {/* Main Tab Content Container */}
      <main className="max-w-5xl mx-auto px-4 pt-6">
        {/* ════════════════════════════════════════════════════════════════════
            TAB 1: EXECUTIVE FUNCTION DRILLS
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'drills' && (
          <div className="space-y-6">
            {/* Sub-selector for Drills */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedDrill('gonogo')}
                className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${
                  selectedDrill === 'gonogo'
                    ? 'bg-red-500/20 text-red-300 border-red-500/40'
                    : 'bg-slate-800/60 text-slate-400 border-slate-700/60 hover:bg-slate-800'
                }`}
              >
                🛑 {localize(profile.language, 'Go / No-Go (Impulse Control)', 'كبح الاندفاعية (Go / No-Go)')}
              </button>
              <button
                onClick={() => setSelectedDrill('memory_grid')}
                className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${
                  selectedDrill === 'memory_grid'
                    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                    : 'bg-slate-800/60 text-slate-400 border-slate-700/60 hover:bg-slate-800'
                }`}
              >
                🧩 {localize(profile.language, 'Working Memory Grid', 'شبكة الذاكرة العاملة')}
              </button>
              <button
                onClick={() => setSelectedDrill('set_shifting')}
                className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${
                  selectedDrill === 'set_shifting'
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                    : 'bg-slate-800/60 text-slate-400 border-slate-700/60 hover:bg-slate-800'
                }`}
              >
                🔄 {localize(profile.language, 'Rule-Switching (Flexibility)', 'مرونة تغيير القواعد (Autism)')}
              </button>
              <button
                onClick={() => setSelectedDrill('stroop')}
                className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${
                  selectedDrill === 'stroop'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-slate-800/60 text-slate-400 border-slate-700/60 hover:bg-slate-800'
                }`}
              >
                🎨 {localize(profile.language, 'Stroop Attention Filter', 'فلتر الانتباه (Stroop)')}
              </button>
            </div>

            {/* 1.A: GO / NO-GO DRILL */}
            {selectedDrill === 'gonogo' && (
              <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 text-center space-y-6">
                <div className="max-w-xl mx-auto space-y-2">
                  <h3 className="text-xl font-bold text-white">
                    {localize(profile.language, 'Inhibitory Control & Impulse Resistance', 'تمرين كبح الاندفاعية ومقاومة الفخاخ')}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {localize(
                      profile.language,
                      'Tap screen or press [Spacebar] on Green symbols only. Stop completely on Red / Bomb traps.',
                      'اضغط على الشاشة أو زر [المسطرة Space] عند ظهور الرموز الخضراء فقط. توقف تماماً عند القنابل والفخاخ.'
                    )}
                  </p>
                </div>

                {gngState === 'idle' && (
                  <div className="py-12 space-y-4">
                    <div className="flex justify-center gap-4 text-4xl">
                      <span>🍏</span>
                      <span>⭐</span>
                      <span className="opacity-30">💣</span>
                      <span className="opacity-30">🛑</span>
                    </div>
                    <button
                      onClick={startGoNoGo}
                      className="px-8 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-lg shadow-indigo-600/30 transition-all text-sm"
                    >
                      {localize(profile.language, 'Start 15-Trial Challenge', 'ابدأ تدريب الـ 15 جولة')}
                    </button>
                  </div>
                )}

                {gngState === 'running' && gngTrials[gngCurrentIdx] && (
                  <div className="py-8 space-y-6">
                    <div className="text-xs text-slate-400 font-mono">
                      {localize(profile.language, 'Trial', 'الجولة')} {gngCurrentIdx + 1} / {gngTrials.length}
                    </div>

                    <div
                      onClick={handleGoNoGoClick}
                      className="cursor-pointer select-none max-w-xs mx-auto py-16 px-8 rounded-3xl bg-slate-950 border-2 border-slate-700 hover:border-indigo-500 transition-all shadow-2xl flex flex-col items-center justify-center gap-3 active:scale-95"
                    >
                      <span className="text-7xl animate-pulse">
                        {gngTrials[gngCurrentIdx].symbol}
                      </span>
                      <span className="text-sm font-semibold text-slate-300">
                        {isAr ? gngTrials[gngCurrentIdx].labelAr : gngTrials[gngCurrentIdx].labelEn}
                      </span>
                    </div>

                    <button
                      onClick={handleGoNoGoClick}
                      className="w-full max-w-sm py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-lg shadow-xl shadow-emerald-600/30 transition-all"
                    >
                      {localize(profile.language, 'TAP / CLICK NOW (SPACE)', 'اضغط الآن! (أو مسطرة)')}
                    </button>
                  </div>
                )}

                {gngState === 'completed' && gngResult && (
                  <div className="py-6 space-y-5 text-start max-w-lg mx-auto bg-slate-950/70 p-6 rounded-2xl border border-slate-800">
                    <h4 className="text-lg font-bold text-white text-center">
                      {localize(profile.language, 'Evaluation Report', 'تقرير كبح الاندفاعية')}
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-center">
                      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                        <div className="text-2xl font-black text-emerald-400">{gngResult.noGoAccuracy}%</div>
                        <div className="text-xs text-slate-400">{localize(profile.language, 'Trap Resistance', 'مقاومة الفخاخ')}</div>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                        <div className="text-2xl font-black text-indigo-400">{gngResult.meanReactionTimeMs}ms</div>
                        <div className="text-xs text-slate-400">{localize(profile.language, 'Mean Reaction Time', 'متوسط زمن رد الفعل')}</div>
                      </div>
                    </div>
                    <p className="text-xs text-slate-300 bg-slate-900/90 p-3.5 rounded-xl border border-slate-800">
                      💡 {isAr ? gngResult.feedbackAr : gngResult.feedbackEn}
                    </p>
                    <button
                      onClick={startGoNoGo}
                      className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors"
                    >
                      {localize(profile.language, 'Retry Workout', 'إعادة التدريب')}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 1.B: WORKING MEMORY GRID DRILL */}
            {selectedDrill === 'memory_grid' && (
              <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 text-center space-y-6">
                <div className="max-w-xl mx-auto space-y-2">
                  <h3 className="text-xl font-bold text-white">
                    {localize(profile.language, 'Spatial Working Memory Grid', 'شبكة الذاكرة العاملة المكانية')}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {localize(
                      profile.language,
                      'Watch the sequence light up, then repeat the exact order.',
                      'راقب تسلسل إضاءة المربعات، ثم اضغط عليها بنفس الترتيب.'
                    )}
                  </p>
                </div>

                <div className="flex justify-center items-center gap-4 text-xs font-semibold text-slate-400">
                  <span>{localize(profile.language, 'Span Length:', 'طول التسلسل:')} <strong className="text-indigo-400 font-bold">{wmLevel}</strong></span>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={wmIsReverse}
                      onChange={e => setWmIsReverse(e.target.checked)}
                      className="rounded bg-slate-800 border-slate-700 text-indigo-600"
                    />
                    <span>{localize(profile.language, 'Reverse Span (Harder)', 'الترتيب العكسي (تحدي أعلى)')}</span>
                  </label>
                </div>

                {wmState === 'idle' && (
                  <button
                    onClick={startMemoryGrid}
                    className="px-8 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-lg shadow-indigo-600/30 text-sm transition-all"
                  >
                    {localize(profile.language, 'Memorize Sequence', 'ابدأ التسلسل البصري')}
                  </button>
                )}

                <div className="grid grid-cols-3 gap-3 max-w-[280px] mx-auto py-4">
                  {Array.from({ length: 9 }).map((_, idx) => {
                    const isActive = wmActiveIndex === idx;
                    const isSelected = wmUserSequence.includes(idx);
                    return (
                      <button
                        key={idx}
                        disabled={wmState !== 'input'}
                        onClick={() => handleCellClick(idx)}
                        className={`w-20 h-20 rounded-2xl border-2 transition-all flex items-center justify-center font-bold text-lg ${
                          isActive
                            ? 'bg-amber-400 border-amber-300 scale-105 shadow-xl shadow-amber-400/50'
                            : isSelected
                            ? 'bg-indigo-600/70 border-indigo-400 text-white'
                            : 'bg-slate-950/80 border-slate-800 hover:border-slate-600'
                        }`}
                      >
                        {isSelected && wmUserSequence.indexOf(idx) + 1}
                      </button>
                    );
                  })}
                </div>

                {wmState === 'showing' && (
                  <p className="text-xs text-amber-400 font-semibold animate-pulse">
                    👀 {localize(profile.language, 'Memorize the pattern...', 'احفظ النمط الآن...')}
                  </p>
                )}

                {wmState === 'input' && (
                  <p className="text-xs text-indigo-400 font-semibold">
                    👇 {localize(profile.language, 'Repeat the sequence by tapping cells', 'كرر النمط بالضغط على المربعات')}
                  </p>
                )}

                {wmState === 'success' && (
                  <p className="text-sm font-bold text-emerald-400 animate-bounce">
                    🎉 {localize(profile.language, 'Perfect Recall! Advancing difficulty.', 'ذاكرة حديدية ممتازة! تم زيادة الصعوبة.')}
                  </p>
                )}

                {wmState === 'failure' && (
                  <p className="text-sm font-bold text-rose-400">
                    ❌ {localize(profile.language, 'Sequence missed. Try again!', 'تسلسل غير متطابق. حاول مرة أخرى!')}
                  </p>
                )}
              </div>
            )}

            {/* 1.C: COGNITIVE SET-SHIFTING (WISCONSIN STYLE) */}
            {selectedDrill === 'set_shifting' && (
              <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-6">
                <div className="max-w-xl mx-auto text-center space-y-2">
                  <h3 className="text-xl font-bold text-white">
                    {localize(profile.language, 'Cognitive Set-Shifting (Rule Adaptation)', 'تمرين المرونة الإدراكية والتنقل بين القواعد')}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {localize(
                      profile.language,
                      'Match the test card to one of the 4 reference cards. The sorting rule shifts automatically!',
                      'طابق البطاقة السفلية مع إحدى البطاقات الأربع. قاعدة الفرز تتغير تلقائياً ويجب عليك استنتاجها.'
                    )}
                  </p>
                  <div className="inline-block px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-bold">
                    {localize(profile.language, 'Shifts Mastered:', 'تغييرات القواعد المنجزة:')} {totalShiftsAchieved}
                  </div>
                </div>

                {/* 4 Reference Target Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto">
                  {TARGET_REFERENCE_CARDS.map(refCard => (
                    <button
                      key={refCard.id}
                      onClick={() => handleSortSelection(refCard)}
                      className="p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-cyan-500 transition-all flex flex-col items-center gap-2 group hover:scale-105 active:scale-95"
                    >
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold border"
                        style={{
                          backgroundColor:
                            refCard.color === 'red' ? '#ef444420' :
                            refCard.color === 'blue' ? '#3b82f620' :
                            refCard.color === 'green' ? '#10b98120' : '#f59e0b20',
                          borderColor:
                            refCard.color === 'red' ? '#ef4444' :
                            refCard.color === 'blue' ? '#3b82f6' :
                            refCard.color === 'green' ? '#10b981' : '#f59e0b',
                          color:
                            refCard.color === 'red' ? '#ef4444' :
                            refCard.color === 'blue' ? '#3b82f6' :
                            refCard.color === 'green' ? '#10b981' : '#f59e0b',
                        }}
                      >
                        {refCard.shape === 'circle' && '●'}
                        {refCard.shape === 'square' && '■'}
                        {refCard.shape === 'triangle' && '▲'}
                        {refCard.shape === 'star' && '★'}
                      </div>
                      <span className="text-xs text-slate-400 font-mono">
                        Count: {refCard.count}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Active Test Card to Sort */}
                <div className="text-center pt-4">
                  <div className="text-xs text-slate-400 mb-2">
                    {localize(profile.language, 'Current Test Card (Choose target above to sort):', 'البطاقة الحالية (اختر البطاقة المناسبة أعلاه للفرز):')}
                  </div>
                  <div
                    className="inline-flex flex-col items-center justify-center p-6 rounded-3xl bg-slate-950 border-2 border-cyan-500 shadow-2xl min-w-[160px]"
                  >
                    <div
                      className="text-4xl"
                      style={{
                        color:
                          testCard.color === 'red' ? '#ef4444' :
                          testCard.color === 'blue' ? '#3b82f6' :
                          testCard.color === 'green' ? '#10b981' : '#f59e0b',
                      }}
                    >
                      {testCard.shape === 'circle' && '● '.repeat(testCard.count)}
                      {testCard.shape === 'square' && '■ '.repeat(testCard.count)}
                      {testCard.shape === 'triangle' && '▲ '.repeat(testCard.count)}
                      {testCard.shape === 'star' && '★ '.repeat(testCard.count)}
                    </div>
                    <span className="text-xs text-slate-400 mt-2 font-mono">
                      {testCard.color} · {testCard.shape} · {testCard.count}
                    </span>
                  </div>

                  {lastSortFeedback && (
                    <div className="mt-3">
                      {lastSortFeedback === 'correct' ? (
                        <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/30">
                          ✓ {localize(profile.language, 'Correct! Maintain this hypothesis.', 'صحيح! استمر على نفس فرضيتك.')}
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-rose-400 bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/30">
                          ✗ {localize(profile.language, 'Incorrect. Shift to another dimension.', 'خطأ. انتقل لتجربة بعد آخر.')}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 1.D: STROOP FOCUS TEST */}
            {selectedDrill === 'stroop' && (
              <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 text-center space-y-6">
                <div className="max-w-xl mx-auto space-y-2">
                  <h3 className="text-xl font-bold text-white">
                    {localize(profile.language, 'Stroop Attention Filter', 'فلتر الانتباه والانتقاء البصري (Stroop)')}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {localize(
                      profile.language,
                      'Select the INK COLOR of the word, ignore the literal meaning of the text!',
                      'اختر لون الحبر الفعلي للكلمة، وتجاهل المعنى الحرفي المكتوب!'
                    )}
                  </p>
                  <div className="text-xs font-bold text-indigo-400">
                    {localize(profile.language, 'Score:', 'النقاط:')} {stroopScore} · {localize(profile.language, 'Streak:', 'التتابع:')} {stroopStreak} 🔥
                  </div>
                </div>

                <div className="py-8">
                  <div
                    className="text-6xl font-black py-8 px-12 rounded-3xl bg-slate-950 border border-slate-800 inline-block shadow-2xl tracking-wider select-none"
                    style={{ color: stroopTrial.inkColorHex }}
                  >
                    {stroopTrial.wordText}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-md mx-auto">
                  <button
                    onClick={() => handleStroopAnswer('red')}
                    className="py-3 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/40 font-bold text-sm"
                  >
                    {localize(profile.language, 'Red', 'أحمر')}
                  </button>
                  <button
                    onClick={() => handleStroopAnswer('blue')}
                    className="py-3 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 font-bold text-sm"
                  >
                    {localize(profile.language, 'Blue', 'أزرق')}
                  </button>
                  <button
                    onClick={() => handleStroopAnswer('green')}
                    className="py-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 font-bold text-sm"
                  >
                    {localize(profile.language, 'Green', 'أخضر')}
                  </button>
                  <button
                    onClick={() => handleStroopAnswer('yellow')}
                    className="py-3 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 font-bold text-sm"
                  >
                    {localize(profile.language, 'Yellow', 'أصفر')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            TAB 2: ADHD TOOLKIT (TASK SLICER & NOISE SPRINT)
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'adhd' && (
          <div className="space-y-6">
            {/* 2.A: EXECUTIVE TASK SLICER */}
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {localize(profile.language, 'Executive Task Slicer (Anti-Paralysis)', 'مفكك المهام الذكي ومكافحة الشلل التنفيذي')}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {localize(
                      profile.language,
                      'Paralyzed by an intimidating task? Slice it into 2-minute micro-actions.',
                      'حاسس بعجز ومش قادر تبدأ مذاكرة؟ اكتب المهمة وهنقسمها لخطوات سهلة جداً مدتها دقيقتين.'
                    )}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={taskInput}
                  onChange={e => setTaskInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSliceTask()}
                  placeholder={localize(
                    profile.language,
                    'e.g. Write essay intro, solve physics sheet, study chapter 3...',
                    'مثال: كتابة مقدمة البحث، حل شيت الفيزيا، مذاكرة شابتر 3...'
                  )}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                />
                <button
                  onClick={handleSliceTask}
                  className="px-6 py-3 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-amber-600/30 transition-all flex items-center gap-1.5 shrink-0"
                >
                  <Sparkles className="w-4 h-4" />
                  {localize(profile.language, 'Slice Task', 'فكك المهمة')}
                </button>
              </div>

              {slicedTask && (
                <div className="pt-4 space-y-3">
                  <div className="text-xs font-semibold text-slate-400 flex items-center justify-between">
                    <span>{slicedTask.originalTask}</span>
                    <span className="text-amber-400">⏱️ ~{slicedTask.totalEstMinutes} {localize(profile.language, 'mins total', 'دقائق إجمالاً')}</span>
                  </div>

                  <div className="space-y-2">
                    {slicedTask.steps.map((step, idx) => (
                      <div
                        key={step.id}
                        onClick={() => handleToggleStep(step.id)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          step.completed
                            ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200 line-through'
                            : 'bg-slate-950 border-slate-800 hover:border-amber-500/60 text-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-6 h-6 rounded-lg border flex items-center justify-center text-xs ${
                              step.completed
                                ? 'bg-emerald-500 border-emerald-400 text-slate-950 font-bold'
                                : 'border-slate-700 bg-slate-900'
                            }`}
                          >
                            {step.completed ? '✓' : idx + 1}
                          </div>
                          <span className="text-xs sm:text-sm font-medium">
                            {isAr ? step.titleAr : step.titleEn}
                          </span>
                        </div>
                        <span className="text-xs font-mono text-slate-400 shrink-0">
                          +{step.dopamineBonus} pts
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 2.B: MICRO-SPRINT TIMER & AMBIENT BROWN NOISE */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Sprint Timer */}
              <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 text-center space-y-5">
                <div className="flex items-center justify-center gap-2 text-amber-400 font-bold text-sm">
                  <Clock className="w-4 h-4" />
                  {localize(profile.language, 'ADHD Micro-Sprint Timer', 'مؤقت التركيز الخاطف لـ ADHD')}
                </div>

                <div className="text-5xl font-black font-mono text-white tracking-widest">
                  {String(Math.floor(sprintSecondsRemaining / 60)).padStart(2, '0')}:
                  {String(sprintSecondsRemaining % 60).padStart(2, '0')}
                </div>

                <div className="flex justify-center gap-2">
                  {[5, 10, 15].map(min => (
                    <button
                      key={min}
                      disabled={isSprintRunning}
                      onClick={() => {
                        setSprintDurationMinutes(min);
                        setSprintSecondsRemaining(min * 60);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                        sprintDurationMinutes === min
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:bg-slate-800'
                      }`}
                    >
                      {min} {localize(profile.language, 'mins', 'دقائق')}
                    </button>
                  ))}
                </div>

                <div className="flex justify-center gap-3 pt-2">
                  <button
                    onClick={() => setIsSprintRunning(!isSprintRunning)}
                    className={`px-6 py-3 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all ${
                      isSprintRunning
                        ? 'bg-rose-600 hover:bg-rose-500 text-white'
                        : 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/30'
                    }`}
                  >
                    {isSprintRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    {isSprintRunning ? localize(profile.language, 'Pause', 'إيقاف مؤقت') : localize(profile.language, 'Start Sprint', 'ابدأ الجلسة')}
                  </button>

                  <button
                    onClick={() => {
                      setIsSprintRunning(false);
                      setSprintSecondsRemaining(sprintDurationMinutes * 60);
                    }}
                    className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
                    title={localize(profile.language, 'Reset', 'إعادة ضبط')}
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Ambient Noise Synthesizer */}
              <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-5">
                <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
                  <Headphones className="w-4 h-4" />
                  {localize(profile.language, 'Stochastic Resonance Audio', 'مولد أصوات عزل المشتتات (Brown Noise)')}
                </div>
                <p className="text-xs text-slate-400">
                  {localize(
                    profile.language,
                    'Brown & Pink noise soothe ADHD brain restlessness and stop mental wandering.',
                    'الترددات البنية والوردية تهدئ الضوضاء العصبية الداخلية وتساعد مريض الـ ADHD على الاستغراق في المذاكرة.'
                  )}
                </p>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleToggleNoise('brown')}
                    className={`py-3 px-2 rounded-2xl text-xs font-bold border transition-all flex flex-col items-center gap-1 ${
                      activeNoiseType === 'brown'
                        ? 'bg-amber-700/40 text-amber-200 border-amber-500 shadow-lg shadow-amber-700/30'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <span className="text-base">☕</span>
                    <span>Brown Noise</span>
                  </button>

                  <button
                    onClick={() => handleToggleNoise('pink')}
                    className={`py-3 px-2 rounded-2xl text-xs font-bold border transition-all flex flex-col items-center gap-1 ${
                      activeNoiseType === 'pink'
                        ? 'bg-rose-700/40 text-rose-200 border-rose-500 shadow-lg shadow-rose-700/30'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <span className="text-base">🌸</span>
                    <span>Pink Noise</span>
                  </button>

                  <button
                    onClick={() => handleToggleNoise('white')}
                    className={`py-3 px-2 rounded-2xl text-xs font-bold border transition-all flex flex-col items-center gap-1 ${
                      activeNoiseType === 'white'
                        ? 'bg-slate-700/40 text-slate-200 border-slate-400 shadow-lg'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <span className="text-base">💨</span>
                    <span>White Noise</span>
                  </button>
                </div>

                {activeNoiseType && (
                  <div className="space-y-2 pt-2">
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>{localize(profile.language, 'Volume', 'مستوى الصوت')}</span>
                      <span>{Math.round(noiseVolume * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={noiseVolume}
                      onChange={e => handleVolumeChange(parseFloat(e.target.value))}
                      className="w-full accent-indigo-500 bg-slate-800 rounded-lg h-2"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            TAB 3: DYSCALCULIA CONCRETE MODELER
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'dyscalculia' && (
          <div className="space-y-6">
            {/* 3.A: TEN-FRAME VISUALIZER */}
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <span>🧮</span>
                    {localize(profile.language, 'Concrete Ten-Frame Modeler', 'نمذجة الأعداد البصرية (إطار العشرة)')}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {localize(
                      profile.language,
                      'Helps students with dyscalculia visualize quantities as tangible blocks rather than abstract digits.',
                      'يساعد طلاب عسر الحساب على رؤية الكميات ككتل ونقاط محسوسة بدلاً من الأرقام المجردة.'
                    )}
                  </p>
                </div>
                <div className="text-2xl font-black text-emerald-400 font-mono">
                  {tenFrame.value}
                </div>
              </div>

              {/* Slider Controller */}
              <div className="space-y-2">
                <input
                  type="range"
                  min="0"
                  max="20"
                  value={tenFrameInput}
                  onChange={e => setTenFrameInput(parseInt(e.target.value, 10))}
                  className="w-full accent-emerald-500 bg-slate-800 rounded-lg h-2"
                />
                <div className="flex justify-between text-xs text-slate-500 font-mono">
                  <span>0</span>
                  <span>5</span>
                  <span>10 (Full Frame)</span>
                  <span>15</span>
                  <span>20</span>
                </div>
              </div>

              {/* The Two 10-Frames Grids */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {/* Frame 1 (1 to 10) */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="text-xs font-semibold text-slate-400">
                    {localize(profile.language, 'First Ten-Frame', 'إطار العشرة الأول (1-10)')}
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {tenFrame.firstFrame.map((filled, i) => (
                      <div
                        key={i}
                        className={`h-12 rounded-xl border flex items-center justify-center transition-all ${
                          filled
                            ? 'bg-emerald-500 border-emerald-400 text-slate-950 shadow-md shadow-emerald-500/40'
                            : 'bg-slate-900/60 border-slate-800'
                        }`}
                      >
                        {filled && <span className="text-xl">●</span>}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Frame 2 (11 to 20) */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="text-xs font-semibold text-slate-400">
                    {localize(profile.language, 'Second Ten-Frame', 'إطار العشرة الثاني (11-20)')}
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {tenFrame.secondFrame.map((filled, i) => (
                      <div
                        key={i}
                        className={`h-12 rounded-xl border flex items-center justify-center transition-all ${
                          filled
                            ? 'bg-indigo-500 border-indigo-400 text-slate-950 shadow-md shadow-indigo-500/40'
                            : 'bg-slate-900/60 border-slate-800'
                        }`}
                      >
                        {filled && <span className="text-xl">●</span>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 3.B: CUISENAIRE RODS VISUALIZER */}
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>📏</span>
                {localize(profile.language, 'Cuisenaire Visual Rods (Proportional Lengths)', 'قضبان الأعداد المتناسبة (Cuisenaire Rods)')}
              </h3>
              <p className="text-xs text-slate-400">
                {localize(
                  profile.language,
                  'Lengths visually demonstrate quantity and magnitude relationships.',
                  'توضح الأطوال النسبية معنى المقادير الرياضية للمقارنة بين الأعداد بصرياً.'
                )}
              </p>

              <div className="space-y-2 pt-2">
                {Object.values(CUISENAIRE_RODS).map(rod => (
                  <div key={rod.value} className="flex items-center gap-3">
                    <span className="w-16 text-xs text-slate-400 font-mono text-end">
                      {isAr ? rod.nameAr : rod.nameEn}
                    </span>
                    <div className="flex-1 bg-slate-950 rounded-xl p-1 border border-slate-800">
                      <div
                        className="h-6 rounded-lg flex items-center px-2 text-xs font-black shadow-inner"
                        style={{
                          width: `${rod.widthPercent}%`,
                          backgroundColor: rod.colorHex,
                          color: rod.value === 1 || rod.value === 5 ? '#0f172a' : '#ffffff',
                        }}
                      >
                        {rod.value}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3.C: VISUAL ARITHMETIC DECOMPOSITION */}
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4 text-center">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-bold text-white">
                  {localize(profile.language, 'Step-by-Step Friendly Decomposition', 'التفكيك العشري البسيط للمسائل')}
                </h3>
                <button
                  onClick={() => setMathProblem(generateConcreteMathProblem())}
                  className="px-4 py-2 rounded-xl bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold hover:bg-emerald-600/30 transition-colors"
                >
                  {localize(profile.language, 'New Problem', 'مسألة جديدة')}
                </button>
              </div>

              <div className="text-4xl font-black text-white font-mono py-4">
                {mathProblem.a} {mathProblem.operator} {mathProblem.b} = <span className="text-emerald-400">{mathProblem.result}</span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-300 text-start leading-relaxed">
                💡 <strong className="text-emerald-400">{localize(profile.language, 'Decomposition Logic: ', 'طريقة التفكير المحسوسة: ')}</strong>
                {isAr ? mathProblem.friendlyDecompositionAr : mathProblem.friendlyDecompositionEn}
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            TAB 4: LOW-AROUSAL & PREDICTABILITY (AUTISM)
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'low-arousal' && (
          <div className="space-y-6">
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Compass className="w-5 h-5 text-purple-400" />
                    {localize(profile.language, 'Sensory Low-Arousal Mode', 'وضع الهدوء وتقليل الحمل الحسي')}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {localize(
                      profile.language,
                      'Removes visual distractions, animations, and high-contrast flashes for autistic comfort.',
                      'يخفف الإثارة البصرية، ويلغي الرسوم المتحركة البراقة لمنع الإرهاق الحسي للطلاب على طيف التوحد.'
                    )}
                  </p>
                </div>
                <button
                  onClick={toggleLowArousal}
                  className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all border ${
                    isLowArousalMode
                      ? 'bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-600/30'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  {isLowArousalMode ? localize(profile.language, 'ACTIVE', 'مفعّل') : localize(profile.language, 'ACTIVATE', 'تفعيل')}
                </button>
              </div>

              {/* Predictability Session Preview */}
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  {localize(profile.language, 'Visual Predictability Timeline (Zero Unknowns)', 'شريط التوقع البصري (منع قلق المجهول)')}
                </h4>
                <p className="text-xs text-slate-400">
                  {localize(
                    profile.language,
                    'Here is exactly what happens during today\'s cognitive gym session step-by-step:',
                    'إليك تفاصيل ما سيحدث بالضبط في الجلسة خطوة بخطوة وبدون أي مفاجآت:'
                  )}
                </p>

                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-3 text-xs text-slate-300">
                    <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold">1</div>
                    <span>{localize(profile.language, 'Step 1: Choose 1 drill (15 quick interactive trials).', 'الخطوة 1: اختيار تمرين واحد (15 جولة سريعة).')}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-300">
                    <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold">2</div>
                    <span>{localize(profile.language, 'Step 2: No penalty for errors; feedback is calm and educational.', 'الخطوة 2: لا يوجد أي عقاب عند الخطأ؛ النتيجة توضيحية وهادئة.')}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-300">
                    <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold">3</div>
                    <span>{localize(profile.language, 'Step 3: Session ends immediately and saves points to your streak.', 'الخطوة 3: انتهاء الجلسة فوراً وإضافة النقاط للتتابع اليومي.')}</span>
                  </div>
                </div>
              </div>

              {/* Preserve IQ Assessment Modal link */}
              {onOpenIqModal && (
                <div className="pt-4 flex items-center justify-between border-t border-slate-800">
                  <div>
                    <h5 className="text-xs font-bold text-slate-300">
                      {localize(profile.language, 'Exploratory Cognitive Style Preview', 'الاستكشاف الإدراكي لنمط التفكير')}
                    </h5>
                    <p className="text-[11px] text-slate-500">
                      {localize(profile.language, 'Informal educational quiz to calibrate AI tutoring style.', 'نشاط استكشافي غير إكلينيكي لتخصيص أسلوب الشرح.')}
                    </p>
                  </div>
                  <button
                    onClick={onOpenIqModal}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                  >
                    {localize(profile.language, 'Open Preview', 'فتح الاستكشاف')}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
