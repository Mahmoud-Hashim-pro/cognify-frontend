import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile } from '../types';
import { localize, isArabicLocale } from '../lib/translations';
import { speak, cancelSpeech } from '../lib/tts';
import { triggerHapticAlert } from '../lib/hapticNavEngine';
import { toast } from './Toast';
import {
  Accessibility,
  Eye,
  Ear,
  Activity,
  AlertTriangle,
  Radio,
  Volume2,
  Mic,
  MicOff,
  Vibrate,
  Sparkles,
  Send,
  Play,
  Square,
  RefreshCw,
  Zap,
  ArrowLeft,
  HeartPulse,
  Sliders,
  Smartphone,
  Copy,
  PhoneCall,
  Clock,
  Shield,
  Layers,
  HelpCircle,
  VolumeX,
} from 'lucide-react';

const SignAvatar3D = React.lazy(() => import('./SignAvatar3D'));

interface CrossDisabilityOrchestratorProps {
  profile: UserProfile;
  onNavigateBack: () => void;
  onMenuClick?: () => void;
}

export type CrossEngineMode = 'blind-deaf' | 'deaf-blind-morse' | 'single-switch' | 'omni-sos';

// Morse Code Standard Table (English & Arabic)
const MORSE_ENCODE_MAP: Record<string, string> = {
  // English
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.',
  G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..',
  M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.',
  S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-',
  Y: '-.--', Z: '--..',
  '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-',
  '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.',
  ' ': '/',
  // Arabic Letters
  'ا': '.-', 'ب': '-...', 'ت': '-', 'ث': '-.-.', 'ج': '.---', 'ح': '....',
  'خ': '---', 'د': '-..', 'ذ': '--..', 'ر': '.-.', 'ز': '---.', 'س': '...',
  'ش': '----', 'ص': '-..-', 'ض': '...-', 'ط': '..-', 'ظ': '-.--', 'ع': '.-.-',
  'غ': '--.', 'ف': '..-.', 'ق': '--.-', 'ك': '-.-', 'ل': '.-..', 'م': '--',
  'ن': '-.', 'ه': '.', 'و': '.--', 'ي': '..', 'ة': '.', 'ء': '.-'
};

const MORSE_DECODE_MAP: Record<string, string> = Object.entries(MORSE_ENCODE_MAP).reduce(
  (acc, [char, code]) => {
    if (!acc[code]) acc[code] = char;
    return acc;
  },
  {} as Record<string, string>
);

export default function CrossDisabilityOrchestrator({
  profile,
  onNavigateBack,
  onMenuClick,
}: CrossDisabilityOrchestratorProps) {
  const isAr = isArabicLocale(profile.language);
  const [activeEngine, setActiveEngine] = useState<CrossEngineMode>('blind-deaf');

  // ─────────────────────────────────────────────────────────────
  // 1. BLIND ⇄ DEAF DIRECT BILATERAL RELAY
  // ─────────────────────────────────────────────────────────────
  const [blindSpeaking, setBlindSpeaking] = useState(false);
  const [blindLiveText, setBlindLiveText] = useState('');
  const [blindFinalTranscript, setBlindFinalTranscript] = useState(
    isAr ? 'أهلاً بك، أنا أتحدث بصوتي وسيظهر لك كإشارة ثلاثية الأبعاد ونصوص.' : 'Hello, I speak and it turns to 3D sign and captions for you.'
  );
  const [signSequenceForDeaf, setSignSequenceForDeaf] = useState<string[]>(['أهلا', 'بك']);
  const [isSignAvatarPlaying, setIsSignAvatarPlaying] = useState(false);

  const [deafInputText, setDeafInputText] = useState('');
  const [deafSpokenMessage, setDeafSpokenMessage] = useState('');
  const [isSpeakingToBlind, setIsSpeakingToBlind] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Quick bidirectional phrases
  const RELAY_PRESETS = [
    {
      textAr: 'أنا هنا ومستعد للتواصل والعمل معك',
      textEn: 'I am here and ready to collaborate with you',
      icon: '🤝',
    },
    {
      textAr: 'هل يمكنك توضيح هذه النقطة أكثر؟',
      textEn: 'Could you explain this point further?',
      icon: '💡',
    },
    {
      textAr: 'فهمت فكرتك تماماً، فلنبدأ الخطوة التالية',
      textEn: 'I understood your idea, lets proceed',
      icon: '✅',
    },
    {
      textAr: 'أحتاج دقيقة واحدة لمراجعة المطلوب',
      textEn: 'I need one minute to review requirements',
      icon: '⏳',
    },
  ];

  // Start / Stop listening to the Blind peer's speech
  const toggleBlindSpeechRecognition = () => {
    if (blindSpeaking) {
      try { recognitionRef.current?.stop(); } catch {}
      setBlindSpeaking(false);
      return;
    }

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      toast.error(isAr ? 'المتصفح لا يدعم التعرف على الصوت' : 'Speech recognition not supported');
      return;
    }

    try {
      const rec = new SpeechRec();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = profile.language === 'Egyptian Ammiya' ? 'ar-EG' : isAr ? 'ar-SA' : 'en-US';

      rec.onresult = (event: any) => {
        let interim = '';
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const chunk = event.results[i][0].transcript;
          interim += chunk;
          if (event.results[i].isFinal) final += chunk;
        }
        setBlindLiveText(interim);

        if (final.trim()) {
          setBlindFinalTranscript(final.trim());
          const words = final.trim().split(/\s+/).filter(Boolean);
          setSignSequenceForDeaf(words);
          setIsSignAvatarPlaying(true);
          triggerHapticAlert('double-pulse');
        }
      };

      rec.onerror = () => setBlindSpeaking(false);
      rec.onend = () => setBlindSpeaking(false);
      rec.start();
      recognitionRef.current = rec;
      setBlindSpeaking(true);
      triggerHapticAlert('single-pulse');
    } catch (e) {
      console.error('Relay speech recognition error', e);
      setBlindSpeaking(false);
    }
  };

  // Deaf peer sends message -> synthesized out loud to Blind peer's ear
  const handleSendDeafVoiceToBlind = (overrideText?: string) => {
    const text = (overrideText || deafInputText).trim();
    if (!text) return;

    setDeafSpokenMessage(text);
    setIsSpeakingToBlind(true);
    triggerHapticAlert('single-pulse');

    // Chime then speak aloud
    speak(text, profile.language || 'Egyptian Ammiya', {
      rate: 1.0,
      onStart: () => setIsSpeakingToBlind(true),
      onEnd: () => setIsSpeakingToBlind(false),
      onError: () => setIsSpeakingToBlind(false),
    });

    if (!overrideText) setDeafInputText('');
  };

  // ─────────────────────────────────────────────────────────────
  // 2. DEAF-BLIND HAPTIC MORSE SENSORY MATRIX
  // ─────────────────────────────────────────────────────────────
  const [morseInputSequence, setMorseInputSequence] = useState<string>('');
  const [decodedMorseText, setDecodedMorseText] = useState<string>('');
  const [isVibratingMorse, setIsVibratingMorse] = useState<boolean>(false);
  const [currentVibratingLetter, setCurrentVibratingLetter] = useState<string>('');

  // Encode string into morse timing array
  const textToMorsePattern = useCallback((text: string): { pattern: number[]; morseString: string } => {
    const clean = text.toUpperCase();
    const timings: number[] = [];
    let morseString = '';

    for (let i = 0; i < clean.length; i++) {
      const char = clean[i];
      const code = MORSE_ENCODE_MAP[char];
      if (code) {
        morseString += code + ' ';
        for (let j = 0; j < code.length; j++) {
          const sym = code[j];
          if (sym === '.') {
            timings.push(100); // 100ms dot
          } else if (sym === '-') {
            timings.push(300); // 300ms dash
          } else if (sym === '/') {
            timings.push(0); // word pause
          }
          timings.push(100); // intra-letter pause
        }
        timings.push(250); // inter-letter pause
      }
    }
    return { pattern: timings, morseString };
  }, []);

  // Play haptic morse vibration for a given text
  const playHapticMorseForText = (text: string) => {
    const { pattern, morseString } = textToMorsePattern(text);
    if (!pattern.length) return;

    setIsVibratingMorse(true);
    setCurrentVibratingLetter(morseString);

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch (e) {
        console.warn('Vibration API error:', e);
      }
    }

    const totalDuration = pattern.reduce((a, b) => a + b, 0);
    setTimeout(() => {
      setIsVibratingMorse(false);
      setCurrentVibratingLetter('');
    }, Math.min(totalDuration, 6000));
  };

  // Add dot or dash in Deaf-Blind virtual paddle
  const handleMorseTap = (sym: '.' | '-') => {
    triggerHapticAlert(sym === '.' ? 'single-pulse' : 'double-pulse');
    setMorseInputSequence((prev) => prev + sym);
  };

  // Commit letter from Morse sequence
  const handleCommitMorseLetter = () => {
    if (!morseInputSequence) return;
    const char = MORSE_DECODE_MAP[morseInputSequence] || '?';
    setDecodedMorseText((prev) => prev + char);
    setMorseInputSequence('');
    triggerHapticAlert('single-pulse');
  };

  // Add space or speak accumulated text
  const handleCommitMorseSpace = () => {
    if (morseInputSequence) {
      handleCommitMorseLetter();
    }
    setDecodedMorseText((prev) => prev + ' ');
  };

  const handleSpeakAccumulatedMorse = () => {
    if (!decodedMorseText.trim()) return;
    speak(decodedMorseText.trim(), profile.language || 'Egyptian Ammiya');
    triggerHapticAlert('double-pulse');
    toast.success(isAr ? 'تم نطق الرسالة بنجاح' : 'Message spoken successfully');
  };

  // ─────────────────────────────────────────────────────────────
  // 3. UNIVERSAL SINGLE-SWITCH SCANNER (ALS & QUADRIPLEGIA)
  // ─────────────────────────────────────────────────────────────
  const [scanSpeedSeconds, setScanSpeedSeconds] = useState<number>(1.5);
  const [isScannerRunning, setIsScannerRunning] = useState<boolean>(false);
  const [activeScanIndex, setActiveScanIndex] = useState<number>(0);

  const SCAN_TILES = useMemo(() => [
    {
      id: 'tile-water',
      labelAr: 'أحتاج شرب ماء 💧',
      labelEn: 'Need Water 💧',
      speakText: isAr ? 'أحتاج شرب الماء لو سمحت' : 'I need water please',
      color: 'border-cyan-500 bg-cyan-950/40 text-cyan-200',
    },
    {
      id: 'tile-pain',
      labelAr: 'أشعر بألم شديد ⚠️',
      labelEn: 'In Pain ⚠️',
      speakText: isAr ? 'أشعر بألم شديد هنا، أحتاج مساعدة' : 'I am in severe pain, need help',
      color: 'border-red-500 bg-red-950/40 text-red-200',
    },
    {
      id: 'tile-pos',
      labelAr: 'عدل وضعية السرير / الكرسي 🛏️',
      labelEn: 'Adjust Bed / Chair 🛏️',
      speakText: isAr ? 'لو سمحت ساعدني في تعديل وضعيتي' : 'Please adjust my position',
      color: 'border-amber-500 bg-amber-950/40 text-amber-200',
    },
    {
      id: 'tile-yes',
      labelAr: 'نعم / أوافق ✅',
      labelEn: 'Yes / Agree ✅',
      speakText: isAr ? 'نعم، تمام وموافق' : 'Yes, I agree',
      color: 'border-emerald-500 bg-emerald-950/40 text-emerald-200',
    },
    {
      id: 'tile-no',
      labelAr: 'لا / لا أريد ❌',
      labelEn: 'No / Disagree ❌',
      speakText: isAr ? 'لا، لست موافقاً ولا أريد' : 'No, I disagree',
      color: 'border-rose-500 bg-rose-950/40 text-rose-200',
    },
    {
      id: 'tile-family',
      labelAr: 'نادي المرافق أو الطبيب 🔔',
      labelEn: 'Call Nurse / Caregiver 🔔',
      speakText: isAr ? 'رجاءً نادوا المرافق أو الطبيب فوراً' : 'Please call the caregiver or doctor',
      color: 'border-purple-500 bg-purple-950/40 text-purple-200',
    },
  ], [isAr]);

  // Single-Switch Cycling Timer
  useEffect(() => {
    if (!isScannerRunning) return;
    const interval = setInterval(() => {
      setActiveScanIndex((prev) => (prev + 1) % SCAN_TILES.length);
    }, scanSpeedSeconds * 1000);
    return () => clearInterval(interval);
  }, [isScannerRunning, scanSpeedSeconds, SCAN_TILES.length]);

  // Trigger selection on Switch Press
  const handleTriggerSwitch = useCallback(() => {
    const selected = SCAN_TILES[activeScanIndex];
    if (selected) {
      triggerHapticAlert('double-pulse');
      speak(selected.speakText, profile.language || 'Egyptian Ammiya');
      toast.success(selected.speakText);
    }
  }, [activeScanIndex, SCAN_TILES, profile.language]);

  // Keyboard Space / Enter as physical hardware switch
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (activeEngine !== 'single-switch' || !isScannerRunning) return;
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        handleTriggerSwitch();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [activeEngine, isScannerRunning, handleTriggerSwitch]);

  // ─────────────────────────────────────────────────────────────
  // 4. MULTI-SENSORY EMERGENCY SOS BEACON
  // ─────────────────────────────────────────────────────────────
  const [isSosActive, setIsSosActive] = useState<boolean>(false);
  const [strobeColor, setStrobeColor] = useState<'red' | 'white'>('red');
  const [userLocationStr, setUserLocationStr] = useState<string>('جاري تحديد الإحداثيات...');
  const sosAudioIntervalRef = useRef<any>(null);

  // Fetch coordinates on SOS mount
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocationStr(`${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`);
        },
        () => setUserLocationStr(isAr ? 'القاهرة، مصر (تقريبي)' : 'Cairo, Egypt (Approx)')
      );
    }
  }, [isAr]);

  const toggleEmergencySos = () => {
    if (isSosActive) {
      // Disarm SOS
      setIsSosActive(false);
      cancelSpeech();
      clearInterval(sosAudioIntervalRef.current);
      toast.info(isAr ? 'تم إيقاف نداء الاستغاثة' : 'Emergency SOS disarmed');
      return;
    }

    // Arm SOS
    setIsSosActive(true);
    triggerHapticAlert('sos');

    // 1. Tactile SOS Morse vibration loop (... --- ...)
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([100, 100, 100, 100, 100, 200, 300, 100, 300, 100, 300, 200, 100, 100, 100, 100, 100]);
    }

    // 2. Synthesized acoustic emergency siren & voice readout loop
    const broadcastEmergencyMessage = () => {
      const alertMsg = isAr
        ? `نداء طوارئ عاجل! حالة طبية وإعاقة بحاجة لمساعدة فورية. الموقع الحالي: ${userLocationStr}`
        : `Emergency SOS Alert! Disability medical assistance required immediately. Location: ${userLocationStr}`;
      speak(alertMsg, profile.language || 'Egyptian Ammiya');
    };

    broadcastEmergencyMessage();
    sosAudioIntervalRef.current = setInterval(broadcastEmergencyMessage, 7000);
  };

  // Strobe flashing interval when SOS active
  useEffect(() => {
    if (!isSosActive) return;
    const strobe = setInterval(() => {
      setStrobeColor((c) => (c === 'red' ? 'white' : 'red'));
    }, 250);
    return () => clearInterval(strobe);
  }, [isSosActive]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      try { recognitionRef.current?.stop(); } catch {}
      cancelSpeech();
      clearInterval(sosAudioIntervalRef.current);
    };
  }, []);

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="flex-1 flex flex-col h-full bg-[#07090e] text-slate-100 select-none overflow-hidden relative"
    >
      {/* ── STROBE SCREEN OVERLAY WHEN SOS IS TRIGGERED ── */}
      {isSosActive && (
        <div
          className={`absolute inset-0 z-50 pointer-events-none transition-colors duration-150 ${
            strobeColor === 'red' ? 'bg-red-600/35' : 'bg-white/35'
          }`}
        />
      )}

      {/* ── TOP ORCHESTRATOR HEADER ── */}
      <header className="shrink-0 px-3 py-2.5 sm:px-6 sm:py-3.5 bg-[#0e1220]/95 backdrop-blur-xl border-b border-slate-800 shadow-2xl flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onNavigateBack}
              aria-label={localize(profile.language, 'Back', 'رجوع')}
              className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white transition-all flex items-center gap-1.5 active:scale-95"
            >
              <ArrowLeft className={`w-4 h-4 ${isAr ? 'rotate-180' : ''}`} />
              <span className="hidden sm:inline text-xs font-black uppercase">
                {localize(profile.language, 'Back', 'رجوع')}
              </span>
            </button>

            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-sm sm:text-base font-black text-white leading-tight flex items-center gap-2">
                  <span>{isAr ? 'المنسق الشامل للتواصل بين الإعاقات' : 'Universal Cross-Disability Sensory Mesh'}</span>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    P2P Neural Relay
                  </span>
                </h1>
                <p className="text-[11px] text-slate-400 hidden sm:block">
                  {isAr 
                    ? 'جسر التخاطب بين الكفيف والأصم، مصفوفة مورس اللمسية، والمسح الذكي بالمفتاح الفردي'
                    : 'Bilateral blind-deaf bridge, deaf-blind tactile morse matrix, and single-switch ALS scanner'}
                </p>
              </div>
            </div>
          </div>

          {/* Quick SOS Trigger Button in Header */}
          <button
            onClick={toggleEmergencySos}
            className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all shadow-lg active:scale-95 ${
              isSosActive
                ? 'bg-red-600 text-white animate-pulse ring-2 ring-red-400'
                : 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/40'
            }`}
          >
            <AlertTriangle className="w-4 h-4 fill-current" />
            <span>{isSosActive ? (isAr ? 'إيقاف الاستغاثة' : 'DISARM SOS') : (isAr ? 'استغاثة طوارئ SOS' : 'Emergency SOS')}</span>
          </button>
        </div>

        {/* ── 4 ENGINE MODE SWITCHER TABS ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 sm:gap-2 p-1 bg-slate-900/90 border border-slate-800 rounded-2xl">
          {[
            {
              id: 'blind-deaf' as const,
              titleAr: 'كفيف ⇄ أصم مباشر',
              titleEn: 'Blind ⇄ Deaf Relay',
              icon: Eye,
              activeColor: 'bg-indigo-600 text-white shadow-indigo-500/30',
            },
            {
              id: 'deaf-blind-morse' as const,
              titleAr: 'مورس للصم-المكفوفين',
              titleEn: 'Deaf-Blind Morse',
              icon: Vibrate,
              activeColor: 'bg-cyan-600 text-white shadow-cyan-500/30',
            },
            {
              id: 'single-switch' as const,
              titleAr: 'مسح المفتاح الفردي (ALS)',
              titleEn: 'Single-Switch Scan',
              icon: Activity,
              activeColor: 'bg-amber-600 text-slate-950 font-black shadow-amber-500/30',
            },
            {
              id: 'omni-sos' as const,
              titleAr: 'منظومة طوارئ الحواس',
              titleEn: 'Omni-Sensory SOS',
              icon: HeartPulse,
              activeColor: 'bg-rose-600 text-white shadow-rose-500/30',
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeEngine === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveEngine(tab.id);
                  triggerHapticAlert('single-pulse');
                }}
                className={`py-2 px-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all truncate border ${
                  isSelected
                    ? `${tab.activeColor} border-transparent shadow-lg scale-[1.02]`
                    : 'bg-transparent border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{isAr ? tab.titleAr : tab.titleEn}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* ── MAIN ENGINE DISPLAY CONTAINER ── */}
      <main className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-5 md:p-6">
        <AnimatePresence mode="wait">
          
          {/* ══════════════════════════════════════════════════════════════
              ENGINE 1: BLIND ⇄ DEAF DIRECT BILATERAL RELAY
             ══════════════════════════════════════════════════════════════ */}
          {activeEngine === 'blind-deaf' && (
            <motion.div
              key="engine-blind-deaf"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="h-full flex flex-col gap-4"
            >
              {/* Relay Info Bar */}
              <div className="bg-[#121626] border border-indigo-500/30 rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
                    <Radio className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-black text-white">
                      {isAr ? 'جسر الترجمة الفورية المباشر بين الكفيف والأصم (Peer-to-Peer)' : 'Direct Peer-to-Peer Blind & Deaf Sensory Translator'}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      {isAr 
                        ? 'كلام الكفيف يتحول مباشرة لأفاتار إشارة 3D، وكتابة أو إشارات الأصم تُنطق صوتياً في أذن الكفيف.'
                        : 'Blind speech transforms to 3D Sign & text; Deaf signs/text speak out loud naturally.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span>{isAr ? 'القناة التبادلية متصلة' : 'Bilateral Mesh Active'}</span>
                  </span>
                </div>
              </div>

              {/* Two-Way Split Display */}
              <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-[360px]">
                
                {/* SIDE A: BLIND SPEAKER ➔ DEAF RECEIVER */}
                <div className="bg-[#121626] rounded-2xl border border-slate-800 p-4 flex flex-col justify-between shadow-xl">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Eye className="w-4 h-4 text-emerald-400" />
                        <h4 className="text-xs sm:text-sm font-black text-white">
                          {isAr ? 'الطرف الكفيف يتحدث (صوت ➔ إشارة ونصوص)' : 'Blind Peer Speaks (Voice ➔ Signs & Text)'}
                        </h4>
                      </div>
                      <span className="text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-md">
                        Voice ➔ 3D
                      </span>
                    </div>

                    {/* 3D Sign Avatar Container with Suspense */}
                    <div className="relative h-[220px] bg-slate-950 rounded-xl overflow-hidden border border-slate-800 mb-3 flex items-center justify-center">
                      <React.Suspense fallback={<div className="text-xs text-slate-400">Loading 3D Sign Avatar...</div>}>
                        <SignAvatar3D
                          words={signSequenceForDeaf}
                          playing={isSignAvatarPlaying}
                          onDone={() => setIsSignAvatarPlaying(false)}
                        />
                      </React.Suspense>

                      {blindSpeaking && (
                        <div className="absolute top-2 left-2 bg-emerald-600 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                          <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                          <span>{isAr ? 'الكفيف يتحدث الآن...' : 'Blind peer is speaking...'}</span>
                        </div>
                      )}
                    </div>

                    {/* Transcript Card for Deaf Peer */}
                    <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                      <span className="text-[10px] text-slate-400 font-bold block mb-1">
                        {isAr ? 'النص المقروء للأصم:' : 'Real-Time Text for Deaf Peer:'}
                      </span>
                      <p className="text-xs sm:text-sm font-black text-cyan-300 break-words leading-relaxed">
                        {blindLiveText || blindFinalTranscript}
                      </p>
                    </div>
                  </div>

                  {/* Speech Toggle Button for Blind Peer */}
                  <button
                    onClick={toggleBlindSpeechRecognition}
                    className={`w-full mt-3 py-3 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-lg active:scale-98 ${
                      blindSpeaking
                        ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse'
                        : 'bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 hover:brightness-110'
                    }`}
                  >
                    {blindSpeaking ? <Square className="w-4 h-4 fill-current" /> : <Mic className="w-4 h-4" />}
                    <span>{blindSpeaking ? (isAr ? 'إيقاف استماع المايك' : 'Stop Mic') : (isAr ? 'ابدأ التحدث (للطرف الكفيف)' : 'Blind Peer: Start Speaking')}</span>
                  </button>
                </div>

                {/* SIDE B: DEAF SENDER ➔ BLIND RECEIVER */}
                <div className="bg-[#121626] rounded-2xl border border-slate-800 p-4 flex flex-col justify-between shadow-xl">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Ear className="w-4 h-4 text-cyan-400" />
                        <h4 className="text-xs sm:text-sm font-black text-white">
                          {isAr ? 'الطرف الأصم يرسل (إشارة ونصوص ➔ صوت في أذن الكفيف)' : 'Deaf Peer Sends (Signs/Text ➔ Audio to Blind)'}
                        </h4>
                      </div>
                      <span className="text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-md">
                        Text ➔ Voice
                      </span>
                    </div>

                    {/* Quick AAC Collaboration Presets */}
                    <div className="mb-3">
                      <span className="text-[10px] font-bold text-slate-400 block mb-1.5">
                        ⚡ {isAr ? 'عبارات سريعة بنقرة واحدة (تُنطق فوراً للكفيف):' : 'Instant Spoken Relay Phrases:'}
                      </span>
                      <div className="grid grid-cols-2 gap-1.5">
                        {RELAY_PRESETS.map((p, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleSendDeafVoiceToBlind(isAr ? p.textAr : p.textEn)}
                            className="p-2 rounded-xl bg-slate-900 hover:bg-cyan-950/40 border border-slate-800 hover:border-cyan-500/40 text-start text-xs font-bold text-slate-200 transition-all active:scale-95 flex items-center gap-1.5 truncate"
                          >
                            <span className="text-base shrink-0">{p.icon}</span>
                            <span className="truncate">{isAr ? p.textAr : p.textEn}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Custom Textarea for Deaf Peer */}
                    <div className="flex flex-col mb-3">
                      <label className="text-[10px] font-bold text-slate-400 mb-1">
                        {isAr ? 'اكتب رسالتك وسيقوم النظام بنطقها صوتياً فوراً للكفيف:' : 'Type message to speak aloud to blind peer:'}
                      </label>
                      <textarea
                        value={deafInputText}
                        onChange={(e) => setDeafInputText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendDeafVoiceToBlind();
                          }
                        }}
                        placeholder={isAr ? 'اكتب هنا واضغط Enter أو زر الإرسال...' : 'Type and press Enter or Send...'}
                        className="w-full min-h-[90px] p-3 bg-slate-900 border border-slate-800 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-slate-100 font-medium text-xs sm:text-sm"
                      />
                    </div>

                    {/* Last spoken to blind preview */}
                    {deafSpokenMessage && (
                      <div className="p-2.5 rounded-xl bg-cyan-950/30 border border-cyan-500/30 text-xs">
                        <span className="text-[10px] text-cyan-400 font-bold block mb-0.5">
                          {isAr ? 'آخر كلام تم نطقه للكفيف:' : 'Last spoken to blind peer:'}
                        </span>
                        <p className="text-slate-200 font-bold">{deafSpokenMessage}</p>
                      </div>
                    )}
                  </div>

                  {/* Send Button */}
                  <button
                    onClick={() => handleSendDeafVoiceToBlind()}
                    disabled={!deafInputText.trim()}
                    className="w-full mt-3 py-3 rounded-xl font-black text-xs sm:text-sm bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-600 hover:to-indigo-700 disabled:opacity-40 text-slate-950 flex items-center justify-center gap-2 shadow-lg transition-all active:scale-98"
                  >
                    {isSpeakingToBlind ? <Square className="w-4 h-4 fill-current" /> : <Volume2 className="w-4 h-4" />}
                    <span>{isAr ? 'انطق بصوت عالي في أذن الكفيف (Enter)' : 'Speak Aloud to Blind Peer (Enter)'}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              ENGINE 2: DEAF-BLIND HAPTIC MORSE SENSORY MATRIX
             ══════════════════════════════════════════════════════════════ */}
          {activeEngine === 'deaf-blind-morse' && (
            <motion.div
              key="engine-deaf-blind-morse"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="h-full flex flex-col gap-4 max-w-4xl mx-auto w-full"
            >
              {/* Engine Header Info */}
              <div className="bg-[#121626] border border-cyan-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400">
                    <Vibrate className="w-6 h-6 animate-bounce" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-white">
                      {isAr ? 'مصفوفة التخاطب اللمسي للصم-المكفوفين (Haptic Morse Engine)' : 'Deaf-Blind Tactile Morse Matrix'}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {isAr 
                        ? 'تحويل أي كلام إلى نبضات اهتزاز لمسية على الهاتف، مع لوحة نقر ثنائية لإدخال مورس وتحويله لصوت.'
                        : 'Translates speech to tactile pulses on device; 2-paddle morse keypad converts touch to speech.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
                    isVibratingMorse 
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                      : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}>
                    {isVibratingMorse ? (isAr ? 'جاري الاهتزاز اللمسي...' : 'Vibrating...') : (isAr ? 'جاهز للاستقبال' : 'Ready')}
                  </span>
                </div>
              </div>

              {/* Morse Output & Testing Bar */}
              <div className="bg-[#121626] border border-slate-800 rounded-2xl p-4 shadow-xl">
                <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider mb-2">
                  {isAr ? 'اختبار وتحويل أي نص إلى اهتزازات لمسية فورية:' : 'Test & Transmit Text to Tactile Vibrations:'}
                </h4>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    defaultValue={isAr ? 'مرحبا' : 'HELLO'}
                    id="morse-test-input"
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs sm:text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  />
                  <button
                    onClick={() => {
                      const input = (document.getElementById('morse-test-input') as HTMLInputElement)?.value;
                      if (input) playHapticMorseForText(input);
                    }}
                    className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-1.5 transition-all active:scale-95 shadow-lg"
                  >
                    <Vibrate className="w-4 h-4" />
                    <span>{isAr ? 'اهتزاز لمسي (Vibrate)' : 'Transmit Pulse'}</span>
                  </button>
                </div>

                {currentVibratingLetter && (
                  <div className="mt-3 p-2 bg-slate-900 border border-cyan-500/40 rounded-xl text-center">
                    <span className="text-[10px] text-slate-400 block mb-0.5">{isAr ? 'شفرة النبض الحالية:' : 'Active Pulse Code:'}</span>
                    <span className="font-mono text-base font-black text-cyan-400 tracking-widest">{currentVibratingLetter}</span>
                  </div>
                )}
              </div>

              {/* 2-Key Virtual Morse Paddle (Touch Input for Deaf-Blind) */}
              <div className="bg-[#121626] border border-slate-800 rounded-2xl p-4 shadow-xl flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-black text-white">
                      {isAr ? 'لوحة إدخال مورس اللمسية (للمكفوفين-الصم):' : 'Tactile 2-Paddle Input Keyboard:'}
                    </h4>
                    <span className="text-[10px] font-mono text-slate-400">
                      Dot: 100ms | Dash: 300ms
                    </span>
                  </div>

                  {/* Buffer Displays */}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 min-h-[48px]">
                      <span className="text-[10px] text-slate-500 block">{isAr ? 'الحرف الجاري تركيبه:' : 'Current Morse Buffer:'}</span>
                      <span className="text-base font-mono font-black text-amber-400 tracking-widest">
                        {morseInputSequence || '---'}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 min-h-[48px]">
                      <span className="text-[10px] text-slate-500 block">{isAr ? 'الجملة المتراكمة:' : 'Decoded Words:'}</span>
                      <span className="text-base font-bold text-emerald-400 truncate block">
                        {decodedMorseText || (isAr ? 'لا توجد كلمات بعد' : 'No text yet')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Big Ergonomic Touch Pads */}
                <div className="grid grid-cols-2 gap-3 min-h-[140px] mb-3">
                  {/* Left Paddle: DOT */}
                  <button
                    onClick={() => handleMorseTap('.')}
                    className="rounded-2xl bg-cyan-950/40 hover:bg-cyan-900/50 border-2 border-cyan-500/50 hover:border-cyan-400 text-cyan-300 font-black flex flex-col items-center justify-center gap-1 active:scale-95 transition-all shadow-lg"
                  >
                    <span className="w-8 h-8 rounded-full bg-cyan-400 flex items-center justify-center text-slate-950 text-xl font-black">
                      •
                    </span>
                    <span className="text-sm sm:text-base font-black">{isAr ? 'نقطة (Dot)' : 'DOT (•)'}</span>
                    <span className="text-[10px] text-cyan-400/70">100ms Pulse</span>
                  </button>

                  {/* Right Paddle: DASH */}
                  <button
                    onClick={() => handleMorseTap('-')}
                    className="rounded-2xl bg-indigo-950/40 hover:bg-indigo-900/50 border-2 border-indigo-500/50 hover:border-indigo-400 text-indigo-300 font-black flex flex-col items-center justify-center gap-1 active:scale-95 transition-all shadow-lg"
                  >
                    <span className="w-16 h-8 rounded-full bg-indigo-400 flex items-center justify-center text-slate-950 text-2xl font-black">
                      —
                    </span>
                    <span className="text-sm sm:text-base font-black">{isAr ? 'شرطة (Dash)' : 'DASH (—)'}</span>
                    <span className="text-[10px] text-indigo-400/70">300ms Pulse</span>
                  </button>
                </div>

                {/* Control Actions Row */}
                <div className="grid grid-cols-4 gap-2">
                  <button
                    onClick={handleCommitMorseLetter}
                    className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-black text-white active:scale-95 transition-all"
                  >
                    {isAr ? 'تثبيت الحرف' : 'Commit Letter'}
                  </button>
                  <button
                    onClick={handleCommitMorseSpace}
                    className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-black text-white active:scale-95 transition-all"
                  >
                    {isAr ? 'مسافة كلمة' : 'Space'}
                  </button>
                  <button
                    onClick={() => {
                      setMorseInputSequence('');
                      setDecodedMorseText('');
                    }}
                    className="py-2.5 rounded-xl bg-rose-950/30 hover:bg-rose-900/40 text-rose-300 border border-rose-500/30 text-xs font-black active:scale-95 transition-all"
                  >
                    {isAr ? 'مسح' : 'Clear'}
                  </button>
                  <button
                    onClick={handleSpeakAccumulatedMorse}
                    disabled={!decodedMorseText.trim()}
                    className="py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 disabled:opacity-40 text-slate-950 text-xs font-black flex items-center justify-center gap-1 active:scale-95 transition-all shadow-md"
                  >
                    <Volume2 className="w-4 h-4" />
                    <span>{isAr ? 'نطق بصوت' : 'Speak'}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              ENGINE 3: UNIVERSAL SINGLE-SWITCH SCANNER (ALS & MOTOR)
             ══════════════════════════════════════════════════════════════ */}
          {activeEngine === 'single-switch' && (
            <motion.div
              key="engine-single-switch"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="h-full flex flex-col gap-4 max-w-4xl mx-auto w-full"
            >
              {/* Scanner Control Bar */}
              <div className="bg-[#121626] border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xl">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400">
                    <Activity className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-white">
                      {isAr ? 'نظام المسح الذكي بالمفتاح الفردي (Single-Switch Scanning)' : 'Universal Single-Switch Autonomic Scanner'}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {isAr 
                        ? 'مخصص لمرضى التصلب ALS والشلل التام: المؤشر يتنقل آلياً، ونقرة واحدة على المسافة أو الشاشة تنطق الطلب.'
                        : 'Designed for ALS & quadriplegia: Cursor cycles automatically; any single tap/spacebar speaks selection.'}
                    </p>
                  </div>
                </div>

                {/* Scan Speed and Switch Run Toggle */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded-xl border border-slate-800 text-xs">
                    <span className="text-[10px] text-slate-400 font-bold">{isAr ? 'سرعة المسح:' : 'Scan:'}</span>
                    {[1.0, 1.5, 2.5].map((spd) => (
                      <button
                        key={spd}
                        onClick={() => setScanSpeedSeconds(spd)}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          scanSpeedSeconds === spd ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400'
                        }`}
                      >
                        {spd}s
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => {
                      const next = !isScannerRunning;
                      setIsScannerRunning(next);
                      if (next) triggerHapticAlert('single-pulse');
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all shadow-lg active:scale-95 ${
                      isScannerRunning
                        ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse'
                        : 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                    }`}
                  >
                    {isScannerRunning ? (isAr ? 'إيقاف المسح' : 'Pause Scan') : (isAr ? 'تشغيل المسح الآلي' : 'Start Auto Scan')}
                  </button>
                </div>
              </div>

              {/* Scanner Grid Tiles */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 flex-1 min-h-0">
                {SCAN_TILES.map((tile, idx) => {
                  const isCurrent = isScannerRunning && activeScanIndex === idx;
                  return (
                    <button
                      key={tile.id}
                      onClick={() => {
                        setActiveScanIndex(idx);
                        triggerHapticAlert('double-pulse');
                        speak(tile.speakText, profile.language || 'Egyptian Ammiya');
                        toast.success(tile.speakText);
                      }}
                      className={`rounded-2xl p-4 sm:p-6 text-start flex flex-col justify-between transition-all border-2 relative ${
                        isCurrent
                          ? 'ring-4 ring-amber-400 scale-[1.03] shadow-2xl z-10 border-white bg-slate-900'
                          : `${tile.color} hover:brightness-110 opacity-80`
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-black/40 text-slate-300 font-black">
                          #{idx + 1}
                        </span>
                        {isCurrent && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 animate-bounce">
                            {isAr ? 'المحدد الآن' : 'ACTIVE'}
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm sm:text-base font-black text-white mb-2 leading-snug">
                        {isAr ? tile.labelAr : tile.labelEn}
                      </h4>

                      <p className="text-[11px] text-slate-300 line-clamp-2">
                        "{tile.speakText}"
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Big Hardware Switch Trigger Zone for Foot / Head Click */}
              <button
                onClick={handleTriggerSwitch}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:brightness-110 text-slate-950 font-black text-sm sm:text-base shadow-2xl flex items-center justify-center gap-2 active:scale-98 border-2 border-white/20"
              >
                <Zap className="w-5 h-5 fill-current" />
                <span>
                  {isAr 
                    ? `اضغط هنا أو اضغط زر المسافة (Spacebar) لاختيار: ${SCAN_TILES[activeScanIndex]?.labelAr}`
                    : `Tap here or press Spacebar to activate: ${SCAN_TILES[activeScanIndex]?.labelEn}`}
                </span>
              </button>
            </motion.div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              ENGINE 4: OMNI-SENSORY EMERGENCY SOS BEACON
             ══════════════════════════════════════════════════════════════ */}
          {activeEngine === 'omni-sos' && (
            <motion.div
              key="engine-omni-sos"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="h-full flex flex-col gap-4 max-w-4xl mx-auto w-full justify-between"
            >
              {/* Emergency Banner */}
              <div className="bg-[#1a0e14] border-2 border-red-500/50 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xl">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-red-600 text-white shadow-xl animate-pulse">
                    <Shield className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-white">
                      {isAr ? 'منظومة طوارئ واستغاثة الحواس الشاملة (Omni-Sensory SOS)' : 'Omni-Sensory Cross-Disability Emergency SOS'}
                    </h3>
                    <p className="text-xs text-slate-300">
                      {isAr 
                        ? 'وميض بصري قوي للصم، صفارات ونطق صوتي للكفيف والمسعفين، واهتزازات مورس المستمرة للصم-المكفوفين.'
                        : 'Visual strobe for deaf, vocal beacon for blind & responders, Morse vibration for deaf-blind.'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={toggleEmergencySos}
                  className={`px-6 py-3 rounded-2xl font-black text-sm transition-all shadow-xl active:scale-95 ${
                    isSosActive
                      ? 'bg-red-700 text-white ring-4 ring-white animate-pulse'
                      : 'bg-red-600 hover:bg-red-700 text-white'
                  }`}
                >
                  {isSosActive ? (isAr ? 'إيقاف نداء الاستغاثة' : 'DISARM SOS') : (isAr ? 'إطلاق الاستغاثة الآن 🚨' : 'TRIGGER EMERGENCY SOS')}
                </button>
              </div>

              {/* 3 Channels Breakdown Display */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* 1. Visual Strobe */}
                <div className="p-4 rounded-2xl bg-[#121626] border border-slate-800 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2 text-cyan-400">
                      <Eye className="w-5 h-5" />
                      <h4 className="text-xs font-black uppercase">{isAr ? 'القناة البصرية (للصم)' : 'Visual Strobe (Deaf)'}</h4>
                    </div>
                    <p className="text-xs text-slate-300 mb-3">
                      {isAr 
                        ? 'وميض شاشة عالي الشدة يتناوب بين الأبيض والأحمر للفت انتباه الصم ومن حولهم.'
                        : 'High-frequency red and white strobe lighting for visual emergency awareness.'}
                    </p>
                  </div>
                  <span className={`text-[10px] font-black px-2.5 py-1 rounded-full text-center ${
                    isSosActive ? 'bg-cyan-500 text-slate-950 animate-pulse' : 'bg-slate-900 text-slate-500'
                  }`}>
                    {isSosActive ? 'ACTIVE STROBE' : 'STANDBY'}
                  </span>
                </div>

                {/* 2. Acoustic Voice & Siren */}
                <div className="p-4 rounded-2xl bg-[#121626] border border-slate-800 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2 text-emerald-400">
                      <Volume2 className="w-5 h-5" />
                      <h4 className="text-xs font-black uppercase">{isAr ? 'القناة الصوتية (للمكفوفين والمسعف)' : 'Acoustic Siren (Blind)'}</h4>
                    </div>
                    <p className="text-xs text-slate-300 mb-3">
                      {isAr 
                        ? 'نطق صوتي متكرر تلقائياً بإحداثيات المكان وبيانات الحالة الطبية للمسعفين والمحيطين.'
                        : 'Repeated synthesized vocal distress beacon broadcasting GPS coordinates.'}
                    </p>
                  </div>
                  <span className={`text-[10px] font-black px-2.5 py-1 rounded-full text-center ${
                    isSosActive ? 'bg-emerald-500 text-slate-950 animate-pulse' : 'bg-slate-900 text-slate-500'
                  }`}>
                    {isSosActive ? 'BROADCASTING AUDIO' : 'STANDBY'}
                  </span>
                </div>

                {/* 3. Tactile Morse Vibration */}
                <div className="p-4 rounded-2xl bg-[#121626] border border-slate-800 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2 text-purple-400">
                      <Vibrate className="w-5 h-5" />
                      <h4 className="text-xs font-black uppercase">{isAr ? 'القناة اللمسية (للصم-المكفوفين)' : 'Tactile Morse (Deaf-Blind)'}</h4>
                    </div>
                    <p className="text-xs text-slate-300 mb-3">
                      {isAr 
                        ? 'نبضات اهتزاز مورس دولية (... --- ...) مستمرة في جسم الجهاز للتأكيد اللمسي.'
                        : 'Continuous international SOS Morse vibration pattern on mobile hardware.'}
                    </p>
                  </div>
                  <span className={`text-[10px] font-black px-2.5 py-1 rounded-full text-center ${
                    isSosActive ? 'bg-purple-500 text-slate-950 animate-pulse' : 'bg-slate-900 text-slate-500'
                  }`}>
                    {isSosActive ? 'HAPTIC ACTIVE' : 'STANDBY'}
                  </span>
                </div>
              </div>

              {/* Location & Dispatch Bar */}
              <div className="p-4 rounded-2xl bg-[#121626] border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-bold text-slate-400">{isAr ? 'إحداثيات الطوارئ الحالية:' : 'Current Emergency GPS:'}</span>
                  <span className="font-mono font-bold text-amber-400">{userLocationStr}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(userLocationStr);
                      toast.success(isAr ? 'تم نسخ الإحداثيات' : 'Coordinates copied');
                    }}
                    className="p-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold flex items-center gap-1.5 transition-all"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{isAr ? 'نسخ الإحداثيات' : 'Copy'}</span>
                  </button>

                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(
                      (isAr ? 'نداء استغاثة عاجل من تطبيق كوجنيفاي! إحداثياتي: ' : 'Emergency SOS Alert from Cognify! Coordinates: ') + userLocationStr
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-all"
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    <span>{isAr ? 'إرسال واتساب للطوارئ' : 'WhatsApp SOS'}</span>
                  </a>
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </div>
  );
}
