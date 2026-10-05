/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Unified Cognitive & Neurodiversity Center (المركز المعرفي الموحد والمختصر)
 * A single, uncluttered, evidence-based screen designed for low cognitive load:
 * 1. ⚡ ADHD Focus & Task Slicer (تفكيك المهام الفوري + الضوضاء البنية)
 * 2. 📖 Dyslexia Focus Reader (قارئ القراءة التوجيهية Bionic ومسطرة التركيز)
 * 3. 🧘 Autism Calm & Sensory Regulation (فقاعة التنفس 4-4-4 + بطاقات النطق السريع)
 * 4. 🎮 Executive Impulse Drill (تمرين التركيز وضبط الاندفاع السريع 30 ثانية)
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Brain,
  Sparkles,
  Flame,
  BookOpen,
  Volume2,
  VolumeX,
  Play,
  Pause,
  CheckCircle2,
  Circle,
  Eye,
  Sliders,
  Heart,
  Droplets,
  Apple,
  DoorClosed,
  AlertTriangle,
  RotateCcw,
  Zap,
  Moon,
  Sun,
  Shield,
  ArrowRight,
  Layers,
  Check,
} from 'lucide-react';
import { UserProfile } from '../types';
import { isArabicLocale, localize } from '../lib/translations';
import { toast } from './Toast';
import { ambientNoise, sliceTaskIntoMicroSteps } from '../lib/cognitiveEngine';
import { bionicizeText, BionicParagraph } from '../lib/learningDisabilityEngine';
import { speak, cancelSpeech } from '../lib/tts';

interface UnifiedCognitiveCenterProps {
  profile: UserProfile;
  onNavigateBack?: () => void;
  onMenuClick?: () => void;
  onOpenAdvancedGym?: () => void;
  onOpenAdvancedStudio?: () => void;
}

export default function UnifiedCognitiveCenter({
  profile,
  onNavigateBack,
  onMenuClick,
  onOpenAdvancedGym,
  onOpenAdvancedStudio,
}: UnifiedCognitiveCenterProps) {
  const isAr = isArabicLocale(profile.language);
  const lang = isAr ? 'Arabic' : 'English';

  // Sensory Low-Arousal Toggle (Calm Mode)
  const [isLowArousal, setIsLowArousal] = useState(false);

  // ───────────────────────────────────────────────────────────────────────────
  // 1. ADHD FOCUS & TASK SLICER STATE
  // ───────────────────────────────────────────────────────────────────────────
  const [taskInput, setTaskInput] = useState('');
  const [slicedSteps, setSlicedSteps] = useState<Array<{ text: string; done: boolean; minutes: number }>>([
    { text: isAr ? 'افتح الملف أو الكتاب واقرأ أول سطر فقط' : 'Open document and read the first sentence only', done: true, minutes: 2 },
    { text: isAr ? 'اكتب نقطتين رئيسيتين تعبران عن الفكرة' : 'Draft two rough bullet points of the main idea', done: false, minutes: 3 },
    { text: isAr ? 'حدد خطوة العمل التالية وضع علامة إنجاز' : 'Mark completion and determine the next mini-step', done: false, minutes: 2 },
  ]);
  const [isNoisePlaying, setIsNoisePlaying] = useState(false);
  const [noiseType, setNoiseType] = useState<'brown' | 'pink'>('brown');

  // Toggle Brown/Pink Noise for ADHD focus
  const handleToggleNoise = () => {
    if (isNoisePlaying) {
      ambientNoise.stop();
      setIsNoisePlaying(false);
    } else {
      ambientNoise.play(noiseType, 0.4);
      setIsNoisePlaying(true);
      toast.success(localize(profile.language, 'Brown noise started to soothe ADHD restlessness', 'تم تشغيل الضوضاء البنية لتحسين التركيز وتهدئة التشتت'));
    }
  };

  const handleSliceTask = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!taskInput.trim()) {
      toast.error(localize(profile.language, 'Please enter a task to slice', 'يرجى كتابة مهمة لتفكيكها'));
      return;
    }
    const decomp = sliceTaskIntoMicroSteps(taskInput);
    setSlicedSteps(decomp.steps.map((s) => ({ text: isAr ? s.titleAr : s.titleEn, done: false, minutes: s.estMinutes })));
    setTaskInput('');
    toast.success(localize(profile.language, 'Task broken into <=3 minute micro-steps!', 'تم تفكيك المهمة إلى خطوات مجهرية ≤ 3 دقائق!'));
  };

  const toggleStepDone = (index: number) => {
    setSlicedSteps((prev) =>
      prev.map((step, i) => (i === index ? { ...step, done: !step.done } : step))
    );
  };

  // ───────────────────────────────────────────────────────────────────────────
  // 2. DYSLEXIA FOCUS READER STATE
  // ───────────────────────────────────────────────────────────────────────────
  const [readerInput, setReaderInput] = useState<string>(
    isAr
      ? 'تعتمد القراءة الميسرة على توجيه حركة العين نحو بدايات الكلمات لتقليل التشتت والإجهاد البصري لدى طلاب عسر القراءة.'
      : 'Bionic reading guides saccadic eye fixations on initial letter stems, dramatically reducing visual crowding for dyslexic learners.'
  );
  const [isBionicOn, setIsBionicOn] = useState(true);
  const [isRulerOn, setIsRulerOn] = useState(false);
  const [isTtsPlaying, setIsTtsPlaying] = useState(false);

  const bionicParagraphs: BionicParagraph[] = React.useMemo(() => {
    return bionicizeText(readerInput, 2);
  }, [readerInput]);

  const handleToggleTTS = () => {
    if (isTtsPlaying) {
      cancelSpeech();
      setIsTtsPlaying(false);
    } else {
      speak(readerInput, lang);
      setIsTtsPlaying(true);
      setTimeout(() => setIsTtsPlaying(false), 5000);
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // 3. AUTISM CALM & SENSORY REGULATION STATE
  // ───────────────────────────────────────────────────────────────────────────
  const [isBreathing, setIsBreathing] = useState(false);
  const [breathPhase, setBreathPhase] = useState<'شهيق' | 'حبس' | 'زفير'>('شهيق');
  const [breathCount, setBreathCount] = useState(4);
  const breathTimerRef = useRef<any>(null);

  useEffect(() => {
    if (!isBreathing) {
      if (breathTimerRef.current) clearInterval(breathTimerRef.current);
      return;
    }

    let count = 4;
    let phase: 'شهيق' | 'حبس' | 'زفير' = 'شهيق';
    setBreathPhase('شهيق');
    setBreathCount(4);

    breathTimerRef.current = setInterval(() => {
      count--;
      if (count <= 0) {
        if (phase === 'شهيق') {
          phase = 'حبس';
          count = 4;
        } else if (phase === 'حبس') {
          phase = 'زفير';
          count = 4;
        } else {
          phase = 'شهيق';
          count = 4;
        }
        setBreathPhase(phase);
      }
      setBreathCount(count);
    }, 1000);

    return () => {
      if (breathTimerRef.current) clearInterval(breathTimerRef.current);
    };
  }, [isBreathing]);

  const QUICK_PECS = [
    { labelAr: 'مية / عطشان', labelEn: 'Water', phraseAr: 'عايز أشرب مية لو سمحت', icon: Droplets, color: 'border-blue-500/40 bg-blue-500/10 text-blue-300' },
    { labelAr: 'أكل / جوعان', labelEn: 'Food', phraseAr: 'أنا جوعان وعايز آكل', icon: Apple, color: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' },
    { labelAr: 'حمام', labelEn: 'Restroom', phraseAr: 'عايز أروح الحمام لو سمحت', icon: DoorClosed, color: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300' },
    { labelAr: 'صوت عالي / إزعاج', labelEn: 'Too Loud', phraseAr: 'الصوت عالي ومزعج، محتاج هدوء', icon: AlertTriangle, color: 'border-rose-500/40 bg-rose-500/10 text-rose-300' },
  ];

  const handleSpeakPecs = (phraseAr: string, labelEn: string) => {
    const textToSpeak = isAr ? phraseAr : labelEn;
    speak(textToSpeak, lang);
    toast.success(isAr ? `🔊 تم النطق: "${phraseAr}"` : `🔊 Spoken: "${labelEn}"`);
  };

  // ───────────────────────────────────────────────────────────────────────────
  // 4. EXECUTIVE IMPULSE DRILL STATE (30 SECONDS GO / NO-GO)
  // ───────────────────────────────────────────────────────────────────────────
  const [drillActive, setDrillActive] = useState(false);
  const [drillScore, setDrillScore] = useState<number | null>(null);
  const [drillShape, setDrillShape] = useState<'go' | 'nogo'>('go');
  const [drillTrial, setDrillTrial] = useState(0);
  const drillTimerRef = useRef<any>(null);

  const startDrill = () => {
    setDrillActive(true);
    setDrillScore(0);
    setDrillTrial(0);
    nextDrillTrial(0, 0);
  };

  const nextDrillTrial = (currentTrial: number, currentPoints: number) => {
    if (currentTrial >= 10) {
      setDrillActive(false);
      setDrillScore(currentPoints);
      toast.success(localize(profile.language, `Drill Complete! Score: ${currentPoints}/10`, `اكتمل التمرين! نتيجتك: ${currentPoints}/10`));
      return;
    }
    const isTarget = Math.random() > 0.3; // 70% Go, 30% No-Go
    setDrillShape(isTarget ? 'go' : 'nogo');
    setDrillTrial(currentTrial + 1);

    drillTimerRef.current = setTimeout(() => {
      // If was Go and missed, no points. If was No-Go and resisted, award point.
      nextDrillTrial(currentTrial + 1, currentPoints + (isTarget ? 0 : 1));
    }, 1100);
  };

  const handleDrillTap = () => {
    if (!drillActive) return;
    if (drillTimerRef.current) clearTimeout(drillTimerRef.current);

    if (drillShape === 'go') {
      // Correct tap on Green target
      nextDrillTrial(drillTrial, (drillScore || 0) + 1);
    } else {
      // Impulsive commission error on Red trap
      toast.error(localize(profile.language, 'Impulse Trap! Avoid red!', 'فخ اندفاعي! تجنب الضغط على اللون الأحمر!'));
      nextDrillTrial(drillTrial, drillScore || 0);
    }
  };

  // Clean audio/timers on unmount
  useEffect(() => {
    return () => {
      ambientNoise.stop();
      cancelSpeech();
      if (drillTimerRef.current) clearTimeout(drillTimerRef.current);
      if (breathTimerRef.current) clearInterval(breathTimerRef.current);
    };
  }, []);

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className={`flex-1 flex flex-col h-full overflow-hidden select-none transition-colors duration-500 ${
        isLowArousal ? 'bg-[#0f0f12] text-slate-300' : 'bg-[#080409] text-slate-100'
      }`}
    >
      {/* ── TOP COMPACT HEADER ── */}
      <header className="px-4 py-2.5 border-b border-[#4A1224]/60 bg-[#0E0610]/95 backdrop-blur-xl flex items-center justify-between gap-3 shrink-0 z-10 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Brain className="w-4 h-4" />
          </div>
          <div>
            <h1 className="font-black text-sm text-white leading-tight flex items-center gap-2">
              <span>{localize(profile.language, 'Cognitive & Neurodiversity Hub', 'المركز المعرفي والذهني الموحد')}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold">
                {localize(profile.language, 'Unified', 'موجز وهادئ')}
              </span>
            </h1>
            <p className="text-[10px] text-slate-400">
              {localize(
                profile.language,
                'ADHD focus, dyslexia reading, autism calm & executive control in one calm space',
                'تركيز الـ ADHD، تيسير القراءة، تنظيم التوحد الحسي، والتدريب الذهني في شاشة واحدة مريحة'
              )}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Low Arousal Sensory Switch */}
          <button
            onClick={() => setIsLowArousal(!isLowArousal)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
              isLowArousal
                ? 'bg-slate-700 text-slate-100 border-slate-500'
                : 'bg-[#150917] text-slate-300 border-[#4A1224]/60 hover:text-white'
            }`}
            title={localize(profile.language, 'Toggle Sensory Calming Mode (Low-Arousal)', 'تفعيل وضع التهدئة الحسية الخافت')}
          >
            <Moon className="w-3.5 h-3.5 text-amber-400" />
            <span>{localize(profile.language, 'Calm UI', 'الوضع الهادئ')}</span>
          </button>

          {/* Quick link to advanced tools if needed */}
          {onOpenAdvancedGym && (
            <button
              onClick={onOpenAdvancedGym}
              className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-amber-400 hover:text-white bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-all cursor-pointer hidden md:flex items-center gap-1"
            >
              <Flame className="w-3.5 h-3.5" />
              <span>{localize(profile.language, 'Detailed Drills', 'التمارين التفصيلية')}</span>
            </button>
          )}

          {onOpenAdvancedStudio && (
            <button
              onClick={onOpenAdvancedStudio}
              className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-purple-400 hover:text-white bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 transition-all cursor-pointer hidden md:flex items-center gap-1"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>{localize(profile.language, 'Essay Studio', 'استوديو المقالات')}</span>
            </button>
          )}
        </div>
      </header>

      {/* ── 4 COMPACT FUNCTIONAL WIDGETS GRID ── */}
      <main className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-5">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* ═══════════════════════════════════════════════════════════════════
              CARD 1: ⚡ ADHD FOCUS & TASK SLICER
             ═══════════════════════════════════════════════════════════════════ */}
          <section className="p-4 sm:p-5 rounded-2xl bg-[#130815] border border-[#4A1224]/70 shadow-lg flex flex-col justify-between space-y-3.5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                    <Zap className="w-4 h-4" />
                  </span>
                  <div>
                    <h2 className="text-xs sm:text-sm font-black text-amber-300">
                      {localize(profile.language, 'ADHD Focus & Task Slicer', 'تركيز ADHD وتفكيك المهام الفوري')}
                    </h2>
                    <p className="text-[10px] text-slate-400">
                      {localize(profile.language, 'Breaks task paralysis into <= 3 minute dopamine steps', 'يكسر المماطلة ويحول المهام لخطوات صغيرة $\\le$ 3 دقائق')}
                    </p>
                  </div>
                </div>

                {/* Brown Noise Button */}
                <button
                  onClick={handleToggleNoise}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm ${
                    isNoisePlaying
                      ? 'bg-amber-400 text-slate-950 font-black animate-pulse'
                      : 'bg-slate-900 border border-amber-500/40 text-amber-300 hover:bg-amber-500/20'
                  }`}
                  title="الضوضاء البنية لتهدئة فرط الحركة وتشتت الانتباه"
                >
                  {isNoisePlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{isNoisePlaying ? localize(profile.language, 'Stop Noise', 'إيقاف الصوت') : localize(profile.language, 'Brown Noise', 'ضوضاء بنية')}</span>
                </button>
              </div>

              {/* Task Slicer Input */}
              <form onSubmit={handleSliceTask} className="flex gap-1.5">
                <input
                  type="text"
                  value={taskInput}
                  onChange={(e) => setTaskInput(e.target.value)}
                  placeholder={localize(
                    profile.language,
                    'Type intimidating task (e.g. Write essay, solve physics)...',
                    'اكتب المهمة المؤجلة (مثال: كتابة تقرير، حل مسألة فيزياء)...'
                  )}
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-[#4A1224]/60 text-xs text-slate-200 outline-none focus:border-amber-400"
                />
                <button
                  type="submit"
                  className="px-3 py-2 rounded-xl bg-amber-400 text-slate-950 font-black text-xs hover:bg-amber-300 cursor-pointer transition-all shrink-0"
                >
                  {localize(profile.language, 'Slice', 'تفكيك')}
                </button>
              </form>
            </div>

            {/* Sliced Micro-Steps Checklist */}
            <div className="space-y-1.5 bg-slate-950/60 p-2.5 rounded-xl border border-[#4A1224]/40 text-xs">
              <span className="text-[10px] text-amber-400/90 font-bold block mb-1">
                {localize(profile.language, 'Actionable Micro-Steps:', 'الخطوات المجهرية الفورية:')}
              </span>
              {slicedSteps.map((step, idx) => (
                <button
                  key={idx}
                  onClick={() => toggleStepDone(idx)}
                  className={`w-full text-start p-2 rounded-lg flex items-center justify-between gap-2 transition-all cursor-pointer ${
                    step.done
                      ? 'bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 line-through opacity-70'
                      : 'bg-slate-900/80 border border-[#4A1224]/40 text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {step.done ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <Circle className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
                    <span className="truncate">{step.text}</span>
                  </div>
                  <span className="text-[10px] font-bold text-amber-400/80 shrink-0">~{step.minutes} د</span>
                </button>
              ))}
            </div>
          </section>

          {/* ═══════════════════════════════════════════════════════════════════
              CARD 2: 📖 DYSLEXIA FOCUS READER
             ═══════════════════════════════════════════════════════════════════ */}
          <section className="p-4 sm:p-5 rounded-2xl bg-[#130815] border border-[#4A1224]/70 shadow-lg flex flex-col justify-between space-y-3.5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                    <BookOpen className="w-4 h-4" />
                  </span>
                  <div>
                    <h2 className="text-xs sm:text-sm font-black text-purple-300">
                      {localize(profile.language, 'Dyslexia Focus Reader', 'قارئ القراءة التوجيهية (عسر القراءة)')}
                    </h2>
                    <p className="text-[10px] text-slate-400">
                      {localize(profile.language, 'Bionic eye-fixation & focus ruler to stop line jumping', 'تظليل بدايات الكلمات لتوجيه العين ومنع القفز بين السطور')}
                    </p>
                  </div>
                </div>

                {/* Read Aloud Button */}
                <button
                  onClick={handleToggleTTS}
                  className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-slate-900 border border-purple-500/40 text-purple-300 hover:bg-purple-500/20 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  {isTtsPlaying ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5 text-purple-400" />}
                  <span>{isTtsPlaying ? localize(profile.language, 'Stop', 'إيقاف') : localize(profile.language, 'Listen', 'استماع')}</span>
                </button>
              </div>

              {/* Controls bar */}
              <div className="flex items-center gap-2 text-xs mb-2">
                <button
                  onClick={() => setIsBionicOn(!isBionicOn)}
                  className={`px-2.5 py-1 rounded-lg border font-bold transition-all cursor-pointer ${
                    isBionicOn ? 'bg-purple-600 text-white border-purple-400' : 'bg-slate-900 border-[#4A1224]/60 text-slate-400'
                  }`}
                >
                  Bionic: {isBionicOn ? 'ON' : 'OFF'}
                </button>
                <button
                  onClick={() => setIsRulerOn(!isRulerOn)}
                  className={`px-2.5 py-1 rounded-lg border font-bold transition-all cursor-pointer ${
                    isRulerOn ? 'bg-amber-400 text-slate-950 border-amber-300' : 'bg-slate-900 border-[#4A1224]/60 text-slate-400'
                  }`}
                >
                  {localize(profile.language, 'Focus Mask', 'تظليل الأسطر')}
                </button>
              </div>
            </div>

            {/* Bionic Text Display */}
            <div
              className={`p-3.5 rounded-xl bg-slate-950 border border-[#4A1224]/60 text-sm leading-relaxed ${
                isRulerOn ? 'ring-2 ring-purple-400/50 bg-purple-950/20' : ''
              }`}
            >
              {bionicParagraphs.map((para, pIdx) => (
                <p key={pIdx} className="text-slate-200">
                  {para.tokens.map((token, tIdx) => {
                    if (!token.isWord) return <span key={tIdx}>{token.suffix} </span>;
                    return (
                      <span key={tIdx} className="inline-block me-1">
                        {isBionicOn ? (
                          <>
                            <strong className="text-purple-300 font-black">{token.prefix}</strong>
                            <span>{token.suffix}</span>
                          </>
                        ) : (
                          <span>{token.prefix}{token.suffix}</span>
                        )}
                        {token.trailingSpace}
                      </span>
                    );
                  })}
                </p>
              ))}
            </div>
          </section>

          {/* ═══════════════════════════════════════════════════════════════════
              CARD 3: 🧘 AUTISM CALM & SENSORY REGULATION
             ═══════════════════════════════════════════════════════════════════ */}
          <section className="p-4 sm:p-5 rounded-2xl bg-[#130815] border border-[#4A1224]/70 shadow-lg flex flex-col justify-between space-y-3.5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <Heart className="w-4 h-4" />
                  </span>
                  <div>
                    <h2 className="text-xs sm:text-sm font-black text-emerald-300">
                      {localize(profile.language, 'Autism Calm & Regulation', 'الضبط الحسي والتهدئة (طيف التوحد)')}
                    </h2>
                    <p className="text-[10px] text-slate-400">
                      {localize(profile.language, '4-4-4 Calming breath bubble & spoken quick-needs cards', 'فقاعة التنفس 4-4-4 لتنظيم المشاعر وبطاقات التعبير السريع')}
                    </p>
                  </div>
                </div>

                {/* Breathing Bubble Toggle */}
                <button
                  onClick={() => setIsBreathing(!isBreathing)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    isBreathing
                      ? 'bg-emerald-400 text-slate-950 font-black'
                      : 'bg-slate-900 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20'
                  }`}
                >
                  <span>{isBreathing ? localize(profile.language, 'Stop Breath', 'إيقاف التنفس') : localize(profile.language, 'Calm Breath', 'تنفس مهدئ')}</span>
                </button>
              </div>

              {/* Dynamic Breathing Visualizer */}
              {isBreathing && (
                <div className="p-3 my-2 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-center gap-4 animate-pulse">
                  <span className="text-xs font-black text-emerald-300 uppercase tracking-widest">{breathPhase}</span>
                  <span className="text-xl font-black text-white">{breathCount}</span>
                </div>
              )}
            </div>

            {/* 4 Instant Spoken PECS Cards */}
            <div>
              <span className="text-[10px] text-slate-400 font-bold block mb-1.5">
                {localize(profile.language, 'Instant Spoken Communication (Tap to Speak):', 'بطاقات التعبير المنطوق الفوري (اضغط للنطق):')}
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {QUICK_PECS.map((c, i) => (
                  <button
                    key={i}
                    onClick={() => handleSpeakPecs(c.phraseAr, c.labelEn)}
                    className={`p-2.5 rounded-xl border flex items-center gap-2 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer text-start ${c.color}`}
                  >
                    <c.icon className="w-4 h-4 shrink-0" />
                    <span className="font-bold truncate">{isAr ? c.labelAr : c.labelEn}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════════════════════════
              CARD 4: 🎮 EXECUTIVE IMPULSE CONTROL (30s GO / NO-GO)
             ═══════════════════════════════════════════════════════════════════ */}
          <section className="p-4 sm:p-5 rounded-2xl bg-[#130815] border border-[#4A1224]/70 shadow-lg flex flex-col justify-between space-y-3.5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
                    <Flame className="w-4 h-4" />
                  </span>
                  <div>
                    <h2 className="text-xs sm:text-sm font-black text-rose-300">
                      {localize(profile.language, 'Executive Impulse Drill', 'تمرين التحكم بالاندفاع والانتباه (30 ثانية)')}
                    </h2>
                    <p className="text-[10px] text-slate-400">
                      {localize(profile.language, 'Tap green targets instantly, resist red traps', 'اضغط على الدائرة الخضراء وتجنب الفخ الأحمر')}
                    </p>
                  </div>
                </div>

                {/* Start Drill Button */}
                {!drillActive ? (
                  <button
                    onClick={startDrill}
                    className="px-3 py-1.5 rounded-xl text-xs font-black bg-gradient-to-r from-rose-500 to-pink-600 text-white cursor-pointer shadow-md hover:opacity-95"
                  >
                    {localize(profile.language, 'Start (30s)', 'ابدأ (30 ث)')}
                  </button>
                ) : (
                  <span className="text-xs font-bold text-amber-300">
                    {drillTrial}/10
                  </span>
                )}
              </div>
            </div>

            {/* Interactive Drill Tap Target Area */}
            <div className="flex flex-col items-center justify-center min-h-[120px] rounded-xl bg-slate-950 border border-[#4A1224]/60 p-4">
              {drillActive ? (
                <button
                  onClick={handleDrillTap}
                  className={`w-24 h-24 rounded-full flex flex-col items-center justify-center text-white font-black text-sm shadow-2xl transition-all cursor-pointer active:scale-90 ${
                    drillShape === 'go'
                      ? 'bg-emerald-500 ring-8 ring-emerald-500/30'
                      : 'bg-rose-600 ring-8 ring-rose-600/30'
                  }`}
                >
                  <span>{drillShape === 'go' ? (isAr ? 'اضغط!' : 'TAP!') : (isAr ? 'لا تضغط!' : 'STOP!')}</span>
                </button>
              ) : (
                <div className="text-center space-y-1">
                  <p className="text-xs text-slate-400">
                    {drillScore !== null
                      ? localize(profile.language, `Last Score: ${drillScore}/10`, `آخر نتيجة: ${drillScore}/10 نقاط`)
                      : localize(profile.language, 'Measure your reaction latency & inhibitory control', 'قِس سرعة استجابتك ومقاومة التشتت')}
                  </p>
                  <p className="text-[11px] text-amber-400 font-bold">
                    {localize(profile.language, 'Press Start to test in 30 seconds', 'اضغط "ابدأ" لاختبار التركيز السريع')}
                  </p>
                </div>
              )}
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}
