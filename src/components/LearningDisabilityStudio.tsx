/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Dyslexia & Learning Disabilities Accommodation Studio (جناح تيسير التعلم والقراءة والكتابة)
 * Clinical & academic accommodations for Specific Learning Disabilities (SLD):
 * 1. Bionic Eye-Fixation & Focus Reading Ruler (عسر القراءة)
 * 2. Phonetic Syllable Chunking & Karaoke Dual-Coding (تفكيك المقاطع والتزامن الصوتي)
 * 3. Voice-to-Essay Academic Scaffolding (عسر الكتابة والتعبير - Dysgraphia)
 * 4. Cognitive Academic Text Simplifier & Jargon Glossary (مبسّط النصوص الأكاديمية)
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BookOpen,
  Eye,
  Sparkles,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Copy,
  Check,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  Sliders,
  Type,
  FileText,
  CheckCircle2,
  HelpCircle,
  Play,
  Pause,
  Layers,
  ChevronDown,
  Info,
  Flame,
  Brain,
  Hash,
} from 'lucide-react';
import { UserProfile } from '../types';
import { isArabicLocale, localize } from '../lib/translations';
import { toast } from './Toast';
import {
  bionicizeText,
  chunkTextPhonetically,
  structureSpokenThoughtsIntoEssay,
  simplifyAcademicText,
  ACADEMIC_SAMPLES,
  GeneratedEssayScaffold,
  SimplifiedTextResult,
  BionicParagraph,
  SyllableChunk,
} from '../lib/learningDisabilityEngine';
import { speak, cancelSpeech } from '../lib/tts';

interface LearningDisabilityStudioProps {
  profile: UserProfile;
  onNavigateBack?: () => void;
  onMenuClick?: () => void;
  onOpenCognitiveGym?: () => void;
}

type StudioTab = 'bionic-reader' | 'essay-scaffold' | 'text-simplifier';

export default function LearningDisabilityStudio({
  profile,
  onNavigateBack,
  onMenuClick,
  onOpenCognitiveGym,
}: LearningDisabilityStudioProps) {
  const isAr = isArabicLocale(profile.language);
  const lang = isAr ? 'Arabic' : 'English';

  const [activeTab, setActiveTab] = useState<StudioTab>('bionic-reader');

  // ───────────────────────────────────────────────────────────────────────────
  // TAB 1: BIONIC & FOCUS READER STATE
  // ───────────────────────────────────────────────────────────────────────────
  const [selectedSampleId, setSelectedSampleId] = useState<string>('neuro_reading');
  const [readerText, setReaderText] = useState<string>(
    ACADEMIC_SAMPLES[0] ? (isAr ? ACADEMIC_SAMPLES[0].contentAr : ACADEMIC_SAMPLES[0].contentEn) : ''
  );
  const [isBionicActive, setIsBionicActive] = useState<boolean>(true);
  const [fixationIntensity, setFixationIntensity] = useState<1 | 2 | 3>(2);
  const [isReadingRulerActive, setIsReadingRulerActive] = useState<boolean>(false);
  const [rulerLineIndex, setRulerLineIndex] = useState<number>(0);
  const [isSyllablesActive, setIsSyllablesActive] = useState<boolean>(false);
  const [fontPreference, setFontPreference] = useState<'dyslexic' | 'cairo' | 'system'>('dyslexic');
  const [lineHeight, setLineHeight] = useState<'normal' | 'relaxed' | 'loose'>('relaxed');
  const [letterSpacing, setLetterSpacing] = useState<'normal' | 'wide' | 'extra'>('wide');

  // Karaoke Dual-Coding State
  const [isKaraokePlaying, setIsKaraokePlaying] = useState<boolean>(false);
  const [currentSpokenWordIndex, setCurrentSpokenWordIndex] = useState<number>(-1);
  const karaokeTimerRef = useRef<any>(null);

  // Computed Bionic & Syllable representations
  const bionicParagraphs: BionicParagraph[] = React.useMemo(() => {
    return bionicizeText(readerText, fixationIntensity);
  }, [readerText, fixationIntensity]);

  const syllableWords: SyllableChunk[] = React.useMemo(() => {
    return isSyllablesActive ? chunkTextPhonetically(readerText, isAr ? 'Arabic' : 'English') : [];
  }, [readerText, isSyllablesActive, isAr]);

  // Load sample article
  const handleSelectSample = (sampleId: string) => {
    setSelectedSampleId(sampleId);
    stopKaraoke();
    const sample = ACADEMIC_SAMPLES.find((s) => s.id === sampleId);
    if (sample) {
      setReaderText(isAr ? sample.contentAr : sample.contentEn);
    }
  };

  // Dual-Coding Karaoke playback
  const startKaraoke = () => {
    stopKaraoke();
    setIsKaraokePlaying(true);
    const words = readerText.split(/\s+/).filter(Boolean);
    if (words.length === 0) return;

    // Use TTS engine
    speak(readerText, lang);

    // Approximate synchronized word highlighting (~160 wpm = ~375ms per word)
    let wordIdx = 0;
    setCurrentSpokenWordIndex(0);
    karaokeTimerRef.current = setInterval(() => {
      wordIdx++;
      if (wordIdx >= words.length) {
        stopKaraoke();
      } else {
        setCurrentSpokenWordIndex(wordIdx);
      }
    }, 380);
  };

  const stopKaraoke = () => {
    setIsKaraokePlaying(false);
    setCurrentSpokenWordIndex(-1);
    cancelSpeech();
    if (karaokeTimerRef.current) {
      clearInterval(karaokeTimerRef.current);
      karaokeTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopKaraoke();
    };
  }, []);

  // ───────────────────────────────────────────────────────────────────────────
  // TAB 2: VOICE-TO-ESSAY SCAFFOLD STATE (DYSGRAPHIA)
  // ───────────────────────────────────────────────────────────────────────────
  const [spokenThoughts, setSpokenThoughts] = useState<string>(
    isAr
      ? 'أريد أن أكتب عن أهمية الذكاء الاصطناعي في التعليم الجامعي للطلاب ذوي الإعاقة. أولاً توفير قارئات شاشة متطورة وترجمة إشارة. ثانياً تدريب أعضاء هيئة التدريس على تقبل الطلاب. ثالثاً تخفيف شروط الاختبارات المكتوبة. المعارضون يقولون إن هذا يقلل معايير الدقة العلمية لكن الدراسات تثبت العكس. في النهاية يجب أن تكون الجامعة مكاناً شاملاً للجميع.'
      : 'I want to write about how artificial intelligence transforms higher education for disabled students. First, providing advanced screen readers and live sign translation. Second, faculty training on neurodiversity accommodations. Third, offering flexible test formats. Critics argue this dilutes academic rigor however empirical evidence proves universal design boosts all outcomes. In conclusion universities must be inclusive.'
  );
  const [essayType, setEssayType] = useState<'argumentative' | 'expository' | 'cause_effect' | 'reflective'>('argumentative');
  const [isRecordingThoughts, setIsRecordingThoughts] = useState<boolean>(false);
  const [generatedScaffold, setGeneratedScaffold] = useState<GeneratedEssayScaffold | null>(() => {
    return structureSpokenThoughtsIntoEssay(spokenThoughts, 'argumentative', isAr ? 'Arabic' : 'English');
  });

  const speechRecognitionRef = useRef<any>(null);

  // Toggle Web Speech STT for hands-free dictation
  const toggleSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error(
        localize(
          profile.language,
          'Microphone dictation is not supported in this browser. Please type or paste your thoughts.',
          'التعرف الصوتي غير مدعوم في هذا المتصفح. يمكنك كتابة أو لصق أفكارك مباشرة.'
        )
      );
      return;
    }

    if (isRecordingThoughts) {
      speechRecognitionRef.current?.stop();
      setIsRecordingThoughts(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = isAr ? 'ar-SA' : 'en-US';
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsRecordingThoughts(true);
        toast.success(localize(profile.language, 'Listening... Speak your ideas freely!', 'الميكروفون نشط... تحدث بأفكارك بحرية!'));
      };

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          currentTranscript += event.results[i][0].transcript;
        }
        if (currentTranscript.trim()) {
          setSpokenThoughts((prev) => `${prev ? prev + ' ' : ''}${currentTranscript}`);
        }
      };

      recognition.onerror = () => {
        setIsRecordingThoughts(false);
      };

      recognition.onend = () => {
        setIsRecordingThoughts(false);
      };

      speechRecognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsRecordingThoughts(false);
    }
  };

  const handleGenerateScaffold = () => {
    if (!spokenThoughts.trim()) {
      toast.error(localize(profile.language, 'Please enter or dictate thoughts first', 'يرجى إدخال أو نطق الأفكار أولاً'));
      return;
    }
    const result = structureSpokenThoughtsIntoEssay(spokenThoughts, essayType, isAr ? 'Arabic' : 'English');
    setGeneratedScaffold(result);
    toast.success(localize(profile.language, 'Essay scaffold structured into 7 academic sections!', 'تم تنظيم المقال في 7 أقسام أكاديمية متماسكة!'));
  };

  const handleCopyFullEssay = () => {
    if (!generatedScaffold) return;
    const fullText = generatedScaffold.sections.map((s) => `${s.titleAr}\n${s.content}`).join('\n\n');
    navigator.clipboard.writeText(fullText);
    toast.success(localize(profile.language, 'Full essay copied to clipboard!', 'تم نسخ مسودة المقال بالكامل إلى الحافظة!'));
  };

  const handleInsertTransition = (sectionIdx: number, transitionPhrase: string) => {
    if (!generatedScaffold) return;
    const updated = { ...generatedScaffold };
    const current = updated.sections[sectionIdx].content;
    updated.sections[sectionIdx].content = `${transitionPhrase} ${current}`;
    setGeneratedScaffold(updated);
    toast.success(localize(profile.language, 'Transition inserted!', 'تم إدراج أداة الربط!'));
  };

  // ───────────────────────────────────────────────────────────────────────────
  // TAB 3: COGNITIVE TEXT SIMPLIFIER STATE
  // ───────────────────────────────────────────────────────────────────────────
  const [simplifierInput, setSimplifierInput] = useState<string>(
    isAr
      ? `تعتمد المرونة العصبية والوظائف التنفيذية على كفاءة الذاكرة العاملة في معالجة المدخلات الحسية المتزامنة دون إجهاد معرفي زائد. يؤدي التشبع المعرفي أثناء القراءة إلى إعاقة الفهم القرائي وتراجع القدرة على استرجاع المفاهيم المحورية، مما يتطلب تمايزاً معرفياً في تقديم المحتوى الأكاديمي عبر الترميز المزدوج.`
      : `Synaptic neuroplasticity and executive functions depend fundamentally on working memory capacity to process concurrent sensory inputs without extraneous cognitive load. Information saturation during reading impedes semantic comprehension, necessitating cognitive differentiation and multi-sensory dual-coding strategies.`
  );
  const [simplifierResult, setSimplifierResult] = useState<SimplifiedTextResult | null>(() => {
    return simplifyAcademicText(simplifierInput, isAr ? 'Arabic' : 'English');
  });

  const handleAnalyzeText = () => {
    if (!simplifierInput.trim()) {
      toast.error(localize(profile.language, 'Please enter text to simplify', 'يرجى كتابة نص لتفكيكه وتبسيطه'));
      return;
    }
    const res = simplifyAcademicText(simplifierInput, isAr ? 'Arabic' : 'English');
    setSimplifierResult(res);
    toast.success(localize(profile.language, 'Text decomposed into plain points and glossary!', 'تم تفكيك النص واستخراج النقاط والمصطلحات بنجاح!'));
  };

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="flex-1 flex flex-col h-full bg-[#080409] text-slate-100 overflow-hidden select-none"
    >
      {/* ── HEADER NAVIGATION BAR ── */}
      <header className="px-4 py-3 border-b border-[#4A1224]/60 bg-[#0E0610]/95 backdrop-blur-xl flex items-center justify-between gap-3 shrink-0 z-20 flex-wrap">
        <div className="flex items-center gap-2.5">
          {onNavigateBack && (
            <button
              onClick={onNavigateBack}
              aria-label={localize(profile.language, 'Back', 'رجوع')}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
            >
              <ArrowLeft className={`w-4 h-4 ${isAr ? 'rotate-180' : ''}`} />
            </button>
          )}
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-md">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-black text-sm sm:text-base text-white leading-tight">
                  {localize(
                    profile.language,
                    'Dyslexia & Learning Disabilities Studio',
                    'استوديو تيسير التعلم والقراءة والكتابة'
                  )}
                </h1>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold hidden sm:inline">
                  {localize(profile.language, 'SLD Accommodations', 'تسهيلات عسر القراءة والكتابة')}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {localize(
                  profile.language,
                  'Bionic eye fixation, focus ruler, voice-to-essay scaffold & cognitive simplifier',
                  'قارئ القراءة التوجيهية، مسطرة التركيز، هيكل المقالات الصوتي، ومبسّط النصوص الأكاديمية'
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Studio Subtabs */}
        <div className="flex items-center gap-1 bg-[#150917] p-1 rounded-2xl border border-[#4A1224]/60 text-xs font-bold flex-wrap">
          <button
            onClick={() => {
              setActiveTab('bionic-reader');
              stopKaraoke();
            }}
            className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'bionic-reader'
                ? 'bg-amber-400 text-slate-950 font-black shadow-md'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{localize(profile.language, 'Focus Reader', 'قارئ القراءة ومسطرة التركيز')}</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('essay-scaffold');
              stopKaraoke();
            }}
            className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'essay-scaffold'
                ? 'bg-amber-400 text-slate-950 font-black shadow-md'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{localize(profile.language, 'Essay Scaffold', 'هيكل المقالات (عسر الكتابة)')}</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('text-simplifier');
              stopKaraoke();
            }}
            className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'text-simplifier'
                ? 'bg-amber-400 text-slate-950 font-black shadow-md'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{localize(profile.language, 'Text Simplifier', 'مبسّط النصوص الأكاديمية')}</span>
          </button>

          {onOpenCognitiveGym && (
            <button
              onClick={onOpenCognitiveGym}
              className="px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 text-amber-300 hover:text-white border border-amber-500/30 hover:bg-amber-500/10 cursor-pointer"
              title={localize(profile.language, 'Open Cognitive Gym', 'فتح الجيم المعرفي')}
            >
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>{localize(profile.language, 'Cognitive Gym', 'الجيم المعرفي')}</span>
            </button>
          )}
        </div>
      </header>

      {/* ── MAIN TAB CONTAINER ── */}
      <main className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 min-h-0">
        <AnimatePresence mode="wait">
          {/* ═══════════════════════════════════════════════════════════════════
              TAB 1: BIONIC EYE-FIXATION & FOCUS READING RULER (DYSLEXIA)
             ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'bionic-reader' && (
            <motion.div
              key="tab-bionic-reader"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="max-w-5xl mx-auto space-y-4"
            >
              {/* Toolbar Controls */}
              <div className="p-4 rounded-2xl bg-[#150917] border border-[#4A1224]/60 shadow-lg space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                      <Sliders className="w-4 h-4 text-amber-400" />
                      {localize(profile.language, 'Visual Accommodations Panel', 'لوحة ضبط تيسير القراءة')}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {localize(profile.language, '(Prevents visual crowding & letter dancing)', '(يمنع تراقص الحروف وازدحام السطور)')}
                    </span>
                  </div>

                  {/* Sample selector */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-slate-400">{localize(profile.language, 'Sample:', 'مقال تجريبي:')}</span>
                    {ACADEMIC_SAMPLES.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => handleSelectSample(s.id)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          selectedSampleId === s.id
                            ? 'bg-amber-400 text-slate-950 font-black'
                            : 'bg-slate-800 text-slate-300 hover:text-white'
                        }`}
                      >
                        {isAr ? s.titleAr.slice(0, 18) + '...' : s.titleEn.slice(0, 18) + '...'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Toggles Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 text-xs pt-1">
                  {/* Bionic Toggle */}
                  <button
                    onClick={() => setIsBionicActive(!isBionicActive)}
                    className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                      isBionicActive
                        ? 'bg-amber-400/20 border-amber-400 text-amber-300 font-bold'
                        : 'bg-slate-900 border-[#4A1224]/60 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Eye className="w-4 h-4" />
                    <span>{localize(profile.language, 'Bionic Fixation', 'توجيه البصر')}</span>
                    <span className="text-[10px] opacity-75">{isBionicActive ? 'ON' : 'OFF'}</span>
                  </button>

                  {/* Focus Reading Ruler Toggle */}
                  <button
                    onClick={() => setIsReadingRulerActive(!isReadingRulerActive)}
                    className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                      isReadingRulerActive
                        ? 'bg-indigo-500/20 border-indigo-400 text-indigo-300 font-bold'
                        : 'bg-slate-900 border-[#4A1224]/60 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Layers className="w-4 h-4" />
                    <span>{localize(profile.language, 'Focus Ruler', 'مسطرة التركيز')}</span>
                    <span className="text-[10px] opacity-75">{isReadingRulerActive ? 'ON' : 'OFF'}</span>
                  </button>

                  {/* Syllable Chunking Toggle */}
                  <button
                    onClick={() => setIsSyllablesActive(!isSyllablesActive)}
                    className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                      isSyllablesActive
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 font-bold'
                        : 'bg-slate-900 border-[#4A1224]/60 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Type className="w-4 h-4" />
                    <span>{localize(profile.language, 'Syllable Chunks', 'تفكيك المقاطع')}</span>
                    <span className="text-[10px] opacity-75">{isSyllablesActive ? 'ON' : 'OFF'}</span>
                  </button>

                  {/* Line Height Toggle */}
                  <button
                    onClick={() => {
                      const next = lineHeight === 'normal' ? 'relaxed' : lineHeight === 'relaxed' ? 'loose' : 'normal';
                      setLineHeight(next);
                    }}
                    className="p-2 rounded-xl border bg-slate-900 border-[#4A1224]/60 text-slate-300 hover:text-white flex flex-col items-center justify-center gap-1 cursor-pointer"
                  >
                    <Sliders className="w-4 h-4 text-amber-400" />
                    <span>{localize(profile.language, 'Line Spacing', 'تباعد الأسطر')}</span>
                    <span className="text-[10px] text-amber-300 font-bold">
                      {lineHeight === 'normal' ? '1.6x' : lineHeight === 'relaxed' ? '2.0x' : '2.4x'}
                    </span>
                  </button>

                  {/* Letter Spacing Toggle */}
                  <button
                    onClick={() => {
                      const next = letterSpacing === 'normal' ? 'wide' : letterSpacing === 'wide' ? 'extra' : 'normal';
                      setLetterSpacing(next);
                    }}
                    className="p-2 rounded-xl border bg-slate-900 border-[#4A1224]/60 text-slate-300 hover:text-white flex flex-col items-center justify-center gap-1 cursor-pointer"
                  >
                    <Type className="w-4 h-4 text-purple-400" />
                    <span>{localize(profile.language, 'Letter Gap', 'تباعد الحروف')}</span>
                    <span className="text-[10px] text-purple-300 font-bold">{letterSpacing}</span>
                  </button>

                  {/* Dual-Coding Karaoke Button */}
                  <button
                    onClick={isKaraokePlaying ? stopKaraoke : startKaraoke}
                    className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                      isKaraokePlaying
                        ? 'bg-rose-500/20 border-rose-500 text-rose-300 font-bold animate-pulse'
                        : 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black shadow-md'
                    }`}
                  >
                    {isKaraokePlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    <span>{isKaraokePlaying ? localize(profile.language, 'Stop Read', 'إيقاف') : localize(profile.language, 'Dual Read', 'قراءة كاريوكي')}</span>
                    <span className="text-[10px] opacity-90">{isKaraokePlaying ? 'Playing' : 'Sync TTS'}</span>
                  </button>
                </div>
              </div>

              {/* Dynamic Reading Board */}
              <div
                className={`relative p-6 sm:p-8 rounded-3xl bg-[#100713] border border-[#4A1224]/80 shadow-2xl transition-all duration-300 ${
                  fontPreference === 'dyslexic' ? 'font-sans' : ''
                } ${
                  lineHeight === 'loose' ? 'leading-[2.4]' : lineHeight === 'relaxed' ? 'leading-[2.0]' : 'leading-[1.6]'
                } ${
                  letterSpacing === 'extra' ? 'tracking-widest' : letterSpacing === 'wide' ? 'tracking-wider' : 'tracking-normal'
                }`}
                style={{ fontSize: '18px' }}
              >
                {/* Visual Reading Ruler Focus Window */}
                {isReadingRulerActive && (
                  <div className="mb-4 p-2.5 rounded-xl bg-indigo-950/60 border border-indigo-500/40 text-xs text-indigo-200 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-bold">
                      <Layers className="w-4 h-4 text-indigo-400" />
                      {localize(profile.language, 'Reading Ruler Active: Click on any paragraph to anchor focus', 'مسطرة التركيز نشطة: اضغط على أي فقرة لتثبيت بؤرة القراءة')}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setRulerLineIndex((p) => Math.max(0, p - 1))}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => setRulerLineIndex((p) => Math.min(bionicParagraphs.length - 1, p + 1))}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                      >
                        ▼
                      </button>
                    </div>
                  </div>
                )}

                {/* Paragraphs Stream */}
                <div className="space-y-6">
                  {bionicParagraphs.map((para, pIdx) => {
                    const isRulerFocused = !isReadingRulerActive || rulerLineIndex === pIdx;
                    return (
                      <div
                        key={pIdx}
                        onClick={() => isReadingRulerActive && setRulerLineIndex(pIdx)}
                        className={`transition-all duration-300 p-3 rounded-2xl ${
                          isReadingRulerActive
                            ? isRulerFocused
                              ? 'bg-amber-500/10 border border-amber-500/40 ring-2 ring-amber-400/30 opacity-100'
                              : 'opacity-25 blur-[0.5px]'
                            : ''
                        }`}
                      >
                        {isSyllablesActive ? (
                          /* Syllables View */
                          <div className="flex flex-wrap gap-1.5">
                            {chunkTextPhonetically(para.rawText, isAr ? 'Arabic' : 'English').map((w, wIdx) => (
                              <span
                                key={wIdx}
                                className="inline-flex items-center px-1.5 py-0.5 rounded-lg bg-slate-800/80 border border-[#4A1224]/50 text-sm"
                              >
                                {w.syllables.map((syl, sIdx) => (
                                  <span
                                    key={sIdx}
                                    className={`${
                                      sIdx % 2 === 0 ? 'text-amber-300 font-black' : 'text-purple-300 font-bold'
                                    }`}
                                  >
                                    {syl}
                                    {sIdx < w.syllables.length - 1 ? <span className="text-slate-600 px-0.5">•</span> : ''}
                                  </span>
                                ))}
                              </span>
                            ))}
                          </div>
                        ) : (
                          /* Bionic / Karaoke View */
                          <p className="text-slate-200">
                            {para.tokens.map((token, tIdx) => {
                              const globalWordIndex = pIdx * 50 + tIdx;
                              const isSpokenNow = isKaraokePlaying && currentSpokenWordIndex === globalWordIndex;

                              if (!token.isWord) {
                                return <span key={tIdx}>{token.suffix} </span>;
                              }

                              return (
                                <span
                                  key={tIdx}
                                  className={`inline-block me-1.5 transition-all ${
                                    isSpokenNow
                                      ? 'bg-amber-400 text-slate-950 px-1 rounded-md font-black shadow-lg scale-105'
                                      : ''
                                  }`}
                                >
                                  {isBionicActive ? (
                                    <>
                                      <strong className="text-amber-300 font-black tracking-normal">
                                        {token.prefix}
                                      </strong>
                                      <span className="opacity-90">{token.suffix}</span>
                                    </>
                                  ) : (
                                    <span>
                                      {token.prefix}
                                      {token.suffix}
                                    </span>
                                  )}
                                  {token.trailingSpace}
                                </span>
                              );
                            })}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Edit Text Toggle Accordion */}
                <div className="mt-8 pt-4 border-t border-[#4A1224]/50 text-xs">
                  <details className="group">
                    <summary className="cursor-pointer text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1">
                      <ChevronDown className="w-3.5 h-3.5 group-open:rotate-180 transition-transform" />
                      <span>{localize(profile.language, 'Type or Paste Custom Academic Text', 'لصق أو كتابة نص أكاديمي مخصص للقراءة')}</span>
                    </summary>
                    <div className="mt-3 space-y-2">
                      <textarea
                        value={readerText}
                        onChange={(e) => {
                          setReaderText(e.target.value);
                          stopKaraoke();
                        }}
                        rows={5}
                        className="w-full p-3 rounded-xl bg-slate-950 border border-[#4A1224]/70 text-slate-200 text-sm focus:border-amber-400 outline-none"
                        placeholder={localize(profile.language, 'Paste your essay, lecture notes or PDF text here...', 'الصق نص المحاضرة أو المقال هنا...')}
                      />
                    </div>
                  </details>
                </div>
              </div>
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              TAB 2: VOICE-TO-ESSAY SCAFFOLD (DYSGRAPHIA)
             ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'essay-scaffold' && (
            <motion.div
              key="tab-essay-scaffold"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="max-w-5xl mx-auto space-y-5"
            >
              {/* Ideation Input Panel */}
              <div className="p-5 rounded-3xl bg-[#150917] border border-[#4A1224]/70 shadow-xl space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center justify-center">
                      <FileText className="w-4 h-4" />
                    </span>
                    <div>
                      <h2 className="text-sm font-black text-white">
                        {localize(
                          profile.language,
                          'Voice & Spoken Ideation to Essay Structure',
                          'تحويل الأفكار الصوتية إلى هيكل مقال أكاديمي'
                        )}
                      </h2>
                      <p className="text-[11px] text-slate-400">
                        {localize(
                          profile.language,
                          'Speak your unorganized ideas naturally; our scaffold organizes them into thesis, arguments & transitions',
                          'تحدث بأفكارك الأولية بعفوية؛ يتولى المحرك تنظيمها في أطروحة، حجج، أدلة، وأدوات ربط منطقي'
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Essay Type Selector */}
                  <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-[#4A1224]/50 text-xs">
                    {(
                      [
                        { id: 'argumentative', ar: 'جدلي/نقاشي', en: 'Argumentative' },
                        { id: 'expository', ar: 'توضيحي', en: 'Expository' },
                        { id: 'cause_effect', ar: 'سبب ونتيجة', en: 'Cause & Effect' },
                      ] as const
                    ).map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setEssayType(t.id)}
                        className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                          essayType === t.id ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {isAr ? t.ar : t.en}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Textarea for spoken/pasted stream */}
                <div className="relative">
                  <textarea
                    value={spokenThoughts}
                    onChange={(e) => setSpokenThoughts(e.target.value)}
                    rows={4}
                    className="w-full p-4 rounded-2xl bg-slate-950 border border-[#4A1224]/80 text-slate-200 text-sm focus:border-purple-400 outline-none leading-relaxed"
                    placeholder={localize(
                      profile.language,
                      'Dictate or type your unedited thoughts here...',
                      'تحدث عبر المايك أو اكتب أفكارك دون تردد هنا...'
                    )}
                  />
                  <div className="absolute bottom-3 end-3 flex items-center gap-2">
                    <button
                      onClick={toggleSpeechRecognition}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md ${
                        isRecordingThoughts
                          ? 'bg-rose-600 text-white animate-pulse'
                          : 'bg-purple-600/30 border border-purple-500/50 text-purple-200 hover:bg-purple-600 hover:text-white'
                      }`}
                    >
                      {isRecordingThoughts ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                      <span>{isRecordingThoughts ? localize(profile.language, 'Listening...', 'جاري التسجيل...') : localize(profile.language, 'Dictate Voice', 'تحدث بالصوت')}</span>
                    </button>
                    <button
                      onClick={handleGenerateScaffold}
                      className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-purple-600 text-slate-950 font-black text-xs shadow-md active:scale-95 cursor-pointer hover:opacity-95"
                    >
                      {localize(profile.language, 'Structure Essay Scaffold', 'هيكلة الأفكار لمقال')}
                    </button>
                  </div>
                </div>
              </div>

              {/* Structured Essay Output */}
              {generatedScaffold && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-[#100713] border border-purple-500/30 flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h3 className="text-sm font-black text-amber-300">{generatedScaffold.title}</h3>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                        <span>{localize(profile.language, `Total Words: ${generatedScaffold.totalWordCount}`, `عدد الكلمات: ${generatedScaffold.totalWordCount}`)}</span>
                        <span>•</span>
                        <span className="text-emerald-400">{generatedScaffold.readabilityLevel}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleCopyFullEssay}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border border-[#4A1224]/60"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>{localize(profile.language, 'Copy Full Draft', 'نسخ المقال بالكامل')}</span>
                      </button>
                    </div>
                  </div>

                  {/* 7 Academic Pillar Cards */}
                  <div className="space-y-3">
                    {generatedScaffold.sections.map((section, idx) => (
                      <div
                        key={section.id}
                        className="p-4 sm:p-5 rounded-2xl bg-[#150917] border border-[#4A1224]/70 hover:border-purple-500/40 transition-all space-y-2.5"
                      >
                        <div className="flex items-center justify-between flex-wrap gap-1">
                          <span className="text-xs font-black text-purple-300 flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-lg bg-purple-500/20 text-purple-300 flex items-center justify-center text-[10px]">
                              {idx + 1}
                            </span>
                            {isAr ? section.titleAr : section.titleEn}
                          </span>
                          <span className="text-[11px] text-slate-400 italic">
                            {isAr ? section.purposeAr : section.purposeEn}
                          </span>
                        </div>

                        {/* Editable Content */}
                        <textarea
                          value={section.content}
                          onChange={(e) => {
                            const updated = { ...generatedScaffold };
                            updated.sections[idx].content = e.target.value;
                            setGeneratedScaffold(updated);
                          }}
                          rows={2}
                          className="w-full p-3 rounded-xl bg-slate-950 border border-[#4A1224]/50 text-slate-200 text-xs sm:text-sm focus:border-amber-400 outline-none leading-relaxed"
                        />

                        {/* Suggested Transitions Chips */}
                        <div className="flex items-center gap-1.5 flex-wrap pt-1">
                          <span className="text-[10px] text-amber-400 font-bold">
                            {localize(profile.language, 'Add Transition:', 'أدوات ربط مقترحة:')}
                          </span>
                          {(isAr ? section.suggestedTransitionsAr : section.suggestedTransitionsEn).map((trans, tIdx) => (
                            <button
                              key={tIdx}
                              onClick={() => handleInsertTransition(idx, trans)}
                              className="px-2 py-0.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold cursor-pointer transition-colors"
                            >
                              + {trans}
                            </button>
                          ))}
                        </div>

                        {/* Guiding Questions for Executive Extension */}
                        <div className="text-[11px] text-slate-400 bg-slate-900/60 p-2.5 rounded-xl border border-[#4A1224]/30 flex items-start gap-1.5">
                          <HelpCircle className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                          <span>
                            {localize(profile.language, 'Prompt to expand:', 'فكرة للتوسيع:')}{' '}
                            {(isAr ? section.guidingQuestionsAr : section.guidingQuestionsEn)[0]}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Executive Functioning Tips */}
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 space-y-1">
                    <span className="font-bold flex items-center gap-1.5 text-amber-300">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      {localize(profile.language, 'Executive Writing Strategy (Dysgraphia):', 'استراتيجية الكتابة الميسرة (لعسر الكتابة):')}
                    </span>
                    <ul className="list-disc list-inside space-y-0.5 text-slate-300">
                      {(isAr ? generatedScaffold.executiveTipsAr : generatedScaffold.executiveTipsEn).map((tip, i) => (
                        <li key={i}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              TAB 3: COGNITIVE TEXT SIMPLIFIER & JARGON GLOSSARY
             ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'text-simplifier' && (
            <motion.div
              key="tab-text-simplifier"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="max-w-5xl mx-auto space-y-5"
            >
              {/* Input Panel */}
              <div className="p-5 rounded-3xl bg-[#150917] border border-[#4A1224]/70 shadow-xl space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center justify-center">
                      <Sparkles className="w-4 h-4" />
                    </span>
                    <div>
                      <h2 className="text-sm font-black text-white">
                        {localize(
                          profile.language,
                          'Cognitive Academic Text Simplifier',
                          'مبسّط النصوص والمصطلحات الأكاديمية'
                        )}
                      </h2>
                      <p className="text-[11px] text-slate-400">
                        {localize(
                          profile.language,
                          'Transforms dense university abstracts into plain takeaways & extracts difficult vocabulary',
                          'يحول الفقرات والبحوث المعقدة إلى نقاط ميسرة ويستخرج قاموساً للمصطلحات الصعبة'
                        )}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleAnalyzeText}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-black text-xs shadow-md active:scale-95 cursor-pointer hover:opacity-95"
                  >
                    {localize(profile.language, 'Decompose Text', 'تفكيك وتبسيط الفقرة')}
                  </button>
                </div>

                <textarea
                  value={simplifierInput}
                  onChange={(e) => setSimplifierInput(e.target.value)}
                  rows={4}
                  className="w-full p-4 rounded-2xl bg-slate-950 border border-[#4A1224]/80 text-slate-200 text-sm focus:border-emerald-400 outline-none leading-relaxed"
                  placeholder={localize(
                    profile.language,
                    'Paste dense academic text or lecture abstract here...',
                    'الصق النص الأكاديمي أو ملخص البحث المعقد هنا...'
                  )}
                />
              </div>

              {/* Simplification Results */}
              {simplifierResult && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Left Column: Key Points & Plain Explanation (2 cols) */}
                  <div className="md:col-span-2 space-y-4">
                    {/* Readability Score Banner */}
                    <div className="p-4 rounded-2xl bg-[#150917] border border-[#4A1224]/70 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center justify-center font-black text-sm">
                          {simplifierResult.readingEaseScore}
                        </div>
                        <div>
                          <p className="text-xs font-black text-white">
                            {localize(profile.language, 'Readability Ease Score', 'مؤشر سهولة القراءة والاستيعاب')}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {simplifierResult.readingEaseScore > 60
                              ? localize(profile.language, 'Clear & Accessible language', 'لغة ميسرة وسلسة الاستيعاب')
                              : localize(profile.language, 'Dense academic vocabulary detected', 'نص أكاديمي كثيف يحتاج تفكيك')}
                          </p>
                        </div>
                      </div>
                      <div className="text-end text-xs text-amber-300 font-bold">
                        ⏱️ ~{simplifierResult.estimatedReadingTimeSeconds}s
                      </div>
                    </div>

                    {/* Key Bullet Takeaways */}
                    <div className="p-5 rounded-2xl bg-[#150917] border border-[#4A1224]/70 space-y-3">
                      <h3 className="text-xs font-black uppercase text-emerald-400 tracking-wider flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{localize(profile.language, 'Core Key Takeaways', 'النقاط الجوهرية المستخلصة')}</span>
                      </h3>
                      <div className="space-y-2 text-sm text-slate-200 leading-relaxed">
                        {simplifierResult.keyPoints.map((pt, i) => (
                          <div key={i} className="p-3 rounded-xl bg-slate-950 border border-[#4A1224]/40">
                            {pt}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Plain Language Narrative */}
                    <div className="p-5 rounded-2xl bg-[#150917] border border-[#4A1224]/70 space-y-2">
                      <h3 className="text-xs font-black uppercase text-amber-400 tracking-wider flex items-center gap-2">
                        <Sparkles className="w-4 h-4" />
                        <span>{localize(profile.language, 'Plain-Language Narrative', 'الشرح بلغة ميسرة ومباشرة')}</span>
                      </h3>
                      <p className="text-sm text-slate-300 leading-relaxed bg-slate-950 p-4 rounded-xl border border-[#4A1224]/40">
                        {simplifierResult.plainExplanation}
                      </p>
                    </div>
                  </div>

                  {/* Right Column: Jargon Glossary Cards */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-black uppercase text-purple-400 tracking-wider flex items-center gap-2">
                      <Brain className="w-4 h-4" />
                      <span>{localize(profile.language, 'Academic Jargon Glossary', 'قاموس المصطلحات والمفاهيم')}</span>
                    </h3>

                    {simplifierResult.difficultGlossary.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-2xl bg-[#150917] border border-purple-500/30 space-y-1.5 shadow-md"
                      >
                        <span className="text-xs font-black text-amber-300 block">{item.term}</span>
                        <p className="text-xs text-slate-300 leading-relaxed">{item.definition}</p>
                        <p className="text-[11px] text-purple-300 bg-purple-500/10 p-2 rounded-lg border border-purple-500/20 italic">
                          💡 {item.example}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
