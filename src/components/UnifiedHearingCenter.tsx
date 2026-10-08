import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Ear,
  Camera,
  CameraOff,
  Volume2,
  Play,
  Square,
  RotateCcw,
  Sparkles,
  ArrowRight,
  Send,
  Trash2,
  Bot,
  Hand,
  Mic,
  MicOff
} from 'lucide-react';
import { UserProfile } from '../types';
import { localize, isArabicLocale } from '../lib/translations';
import { speak, cancelSpeech } from '../lib/tts';
import { triggerHapticAlert } from '../lib/hapticNavEngine';
import { generateAdaptiveResponse } from '../services/gemini';
import { Hands, Results } from '@mediapipe/hands';
import { Camera as MediaPipeCamera } from '@mediapipe/camera_utils';
import { toast } from './Toast';
import ParentalConsentModal from './ParentalConsentModal';

const SignAvatar3D = React.lazy(() => import('./SignAvatar3D'));

interface UnifiedHearingCenterProps {
  profile: UserProfile;
  onNavigateBack?: () => void;
  onMenuClick?: () => void;
}

type Dialect = 'Egyptian Ammiya' | 'Arabic' | 'English';

export default function UnifiedHearingCenter({
  profile,
  onNavigateBack,
}: UnifiedHearingCenterProps) {
  // Dialect / Language
  const [dialect, setDialect] = useState<Dialect>(() => {
    if (profile.language === 'English') return 'English';
    if (profile.language === 'Arabic') return 'Arabic';
    return 'Egyptian Ammiya';
  });

  const isAr = isArabicLocale(dialect);
  const isEgyptian = dialect === 'Egyptian Ammiya';

  // Minor student parental consent gate
  const isMinorStudent = Boolean((profile.age && profile.age < 18) || (profile as any).isMinor);
  const [showConsentModal, setShowConsentModal] = useState<boolean>(false);

  // Helper for 100% dialect-responsive localization
  const loc = useCallback(
    (en: string, ar: string) => (dialect === 'English' ? en : ar),
    [dialect]
  );

  // ───────────────────────────────────────────────────────────────────────────
  // HALF 1: 3D SIGN AVATAR & AI TUTOR STATE
  // ───────────────────────────────────────────────────────────────────────────
  const [avatarWords, setAvatarWords] = useState<string[]>(['أهلا', 'بك']);
  const [isAvatarPlaying, setIsAvatarPlaying] = useState<boolean>(true);
  const [currentSigningWord, setCurrentSigningWord] = useState<string>('أهلا');
  const [aiQuestion, setAiQuestion] = useState<string>('');
  const [aiAnswer, setAiAnswer] = useState<string>(
    isEgyptian
      ? 'أهلاً بك! اسألني أي سؤال دراسي أو عام وسأشرحه لك فوراً بلغة الإشارة 3D والنص.'
      : isAr
      ? 'مرحباً بك! اسألني أي سؤال دراسي أو عام وسأشرحه لك فوراً بلغة الإشارة 3D والنص.'
      : 'Welcome! Ask me any question and I will explain it in 3D Sign Language and text.'
  );
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [isQuestionVoiceActive, setIsQuestionVoiceActive] = useState<boolean>(false);

  const triggerAvatarSign = useCallback((text: string) => {
    if (!text.trim()) return;
    const words = text
      .replace(/[^\w\u0600-\u06FF\s]/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (words.length > 0) {
      setAvatarWords(words);
      setCurrentSigningWord(words[0]);
      setIsAvatarPlaying(true);
    }
  }, []);

  const handleReplayAvatar = () => {
    setIsAvatarPlaying(false);
    setTimeout(() => {
      setIsAvatarPlaying(true);
      if (avatarWords.length > 0) {
        setCurrentSigningWord(avatarWords[0]);
      }
    }, 80);
  };

  const handleAskAi = async (overridePrompt?: string) => {
    const q = (overridePrompt || aiQuestion).trim();
    if (!q || isAiLoading) return;

    cancelSpeech();
    setIsAiLoading(true);
    triggerHapticAlert('single-pulse');

    const prompt = `You are Cognify's specialized Deaf & Hard of Hearing AI Sign Companion.
Explain this concept or answer this question clearly, visually, and concisely in 1 to 2 short sentences in the requested language/dialect: "${dialect}".
CRITICAL: Do NOT use any English placeholders or system terms like "Other", "N/A", or "esraahosni". If the dialect is Arabic or Egyptian Ammiya, answer purely in Arabic.
Keep it simple, clear, and direct so it can be signed by a 3D Sign Avatar and read easily by a deaf student:
Question: "${q}"`;

    try {
      const response = await generateAdaptiveResponse(prompt, profile, []);
      let cleanAnswer = response
        .replace(/\bOther\b/gi, '')
        .replace(/\besraahosni\b/gi, '')
        .replace(/\bN\/A\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (!cleanAnswer) {
        cleanAnswer = isEgyptian
          ? 'تمام، فهمت سؤالك وسأشرحه لك بلغة الإشارة.'
          : isAr
          ? 'حسناً، فهمت سؤالك وسأشرحه لك بلغة الإشارة.'
          : 'Understood, I will explain this in sign language.';
      }
      setAiAnswer(cleanAnswer);

      // Animate 3D Sign Avatar
      triggerAvatarSign(cleanAnswer);
      toast.success(
        loc('Answer generated & signed in 3D', 'تمت الإجابة والترجمة للغة الإشارة 3D')
      );
    } catch (e) {
      console.error('[AI Tutor] Request failed:', e);
      toast.error(loc('Failed to get AI answer', 'تعذر استحضار الإجابة، يرجى المحاولة ثانية'));
    } finally {
      setIsAiLoading(false);
      if (!overridePrompt) setAiQuestion('');
    }
  };

  // Mic voice input for asking AI question
  const toggleQuestionVoice = () => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      toast.error(loc('Speech recognition not supported', 'التعرف الصوتي غير مدعوم في هذا المتصفح'));
      return;
    }

    if (isQuestionVoiceActive) {
      setIsQuestionVoiceActive(false);
      return;
    }

    try {
      const rec = new SpeechRec();
      rec.lang = isEgyptian ? 'ar-EG' : isAr ? 'ar-SA' : 'en-US';
      rec.continuous = false;
      rec.interimResults = false;

      rec.onstart = () => setIsQuestionVoiceActive(true);
      rec.onresult = (e: any) => {
        const transcript = e.results[0][0].transcript;
        if (transcript) {
          setAiQuestion(transcript);
          handleAskAi(transcript);
        }
      };
      rec.onerror = () => setIsQuestionVoiceActive(false);
      rec.onend = () => setIsQuestionVoiceActive(false);
      rec.start();
    } catch {
      setIsQuestionVoiceActive(false);
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // HALF 2: CAMERA SIGN RECOGNITION (IN PLACE OF THE MICROPHONE) TO TEXT & SPEECH
  // ───────────────────────────────────────────────────────────────────────────
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraStatus, setCameraStatus] = useState<string>('');
  const [detectedSign, setDetectedSign] = useState<string>('');
  const [accumulatedText, setAccumulatedText] = useState<string>('');
  const [isSpeakingCameraText, setIsSpeakingCameraText] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const handsRef = useRef<Hands | null>(null);
  const cameraRef = useRef<MediaPipeCamera | null>(null);
  const lastDetectedSignRef = useRef<string>('');
  const lastSignTimeRef = useRef<number>(0);

  // Gesture heuristic analyzer based on 21 MediaPipe hand landmarks
  const analyzeLandmarksGesture = useCallback((landmarks: Array<{ x: number; y: number; z: number }>): string | null => {
    if (!landmarks || landmarks.length < 21) return null;

    const thumbTip = landmarks[4];
    const thumbBase = landmarks[2];
    const indexTip = landmarks[8];
    const indexPip = landmarks[6];
    const middleTip = landmarks[12];
    const middlePip = landmarks[10];
    const ringTip = landmarks[16];
    const ringPip = landmarks[14];
    const pinkyTip = landmarks[20];
    const pinkyPip = landmarks[18];

    const isIndexExtended = indexTip.y < indexPip.y;
    const isMiddleExtended = middleTip.y < middlePip.y;
    const isRingExtended = ringTip.y < ringPip.y;
    const isPinkyExtended = pinkyTip.y < pinkyPip.y;
    const isThumbUp = thumbTip.y < thumbBase.y && thumbTip.y < indexPip.y;

    // 1. I Love You / Deaf Symbol (🤟): Thumb, Index, Pinky extended; Middle and Ring curled
    if (isThumbUp && isIndexExtended && !isMiddleExtended && !isRingExtended && isPinkyExtended) {
      return isEgyptian ? 'أنا أصم' : isAr ? 'أنا أصم' : 'I am deaf';
    }

    // 2. Thumbs Up (👍): Thumb extended up, all 4 other fingers curled
    if (isThumbUp && !isIndexExtended && !isMiddleExtended && !isRingExtended && !isPinkyExtended) {
      return isEgyptian ? 'تمام وموافق' : isAr ? 'نعم أوافق' : 'Yes, OK';
    }

    // 3. Open Hand / Greeting (👋): All 5 fingers extended
    if (isIndexExtended && isMiddleExtended && isRingExtended && isPinkyExtended) {
      return isEgyptian ? 'أهلاً وسهلاً' : isAr ? 'السلام عليكم' : 'Hello';
    }

    // 4. Index Point / "I / Need" (☝️): Only Index extended
    if (isIndexExtended && !isMiddleExtended && !isRingExtended && !isPinkyExtended) {
      return isEgyptian ? 'أنا محتاج مساعدة' : isAr ? 'أحتاج مساعدة' : 'I need help';
    }

    // 5. Peace / Two (✌️): Index & Middle extended, others curled
    if (isIndexExtended && isMiddleExtended && !isRingExtended && !isPinkyExtended) {
      return isEgyptian ? 'لحظة واحدة' : isAr ? 'لحظة واحدة' : 'One moment';
    }

    // 6. Fist (✊): All fingers curled
    if (!isIndexExtended && !isMiddleExtended && !isRingExtended && !isPinkyExtended && !isThumbUp) {
      return isEgyptian ? 'لا شكراً' : isAr ? 'لا شكراً' : 'No thank you';
    }

    return null;
  }, [isAr, isEgyptian]);

  // Handle MediaPipe hands results
  const onHandsResults = useCallback((results: Results) => {
    if (!canvasRef.current || !videoRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const landmarks = results.multiHandLandmarks[0];

      // Draw skeleton connecting points
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3;
      ctx.fillStyle = '#f59e0b';

      for (let i = 0; i < landmarks.length; i++) {
        const x = landmarks[i].x * canvas.width;
        const y = landmarks[i].y * canvas.height;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, 2 * Math.PI);
        ctx.fill();
      }

      // Analyze gesture
      const recognized = analyzeLandmarksGesture(landmarks as any);
      if (recognized) {
        setDetectedSign(recognized);

        const now = Date.now();
        // Debounce repeated emissions: 1.8 seconds cooldown for same sign
        if (now - lastSignTimeRef.current > 1800 || lastDetectedSignRef.current !== recognized) {
          lastSignTimeRef.current = now;
          lastDetectedSignRef.current = recognized;
          triggerHapticAlert('single-pulse');

          // Append to recognized text
          setAccumulatedText((prev) => {
            const separator = prev.trim() ? ' ' : '';
            return prev + separator + recognized;
          });
        }
      }
    } else {
      setDetectedSign('');
    }
  }, [analyzeLandmarksGesture]);

  // Start Camera handler
  const handleStartCamera = async () => {
    if (isMinorStudent && !profile.parentalConsent?.verified) {
      setShowConsentModal(true);
      toast.error(loc('Parental consent is legally required before camera activation for minors.', 'موافقة ولي الأمر مطلوبة قانونياً قبل تشغيل الكاميرا للطلاب القاصرين.'));
      return;
    }

    try {
      setCameraStatus(loc('Opening camera…', 'جاري تشغيل الكاميرا…'));

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Initialize MediaPipe Hands
      const hands = new Hands({
        locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${f}`,
      });
      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.65,
        minTrackingConfidence: 0.6,
      });
      hands.onResults(onHandsResults);
      handsRef.current = hands;

      if (videoRef.current) {
        const camera = new MediaPipeCamera(videoRef.current, {
          onFrame: async () => {
            if (handsRef.current && videoRef.current) {
              await handsRef.current.send({ image: videoRef.current });
            }
          },
          width: 640,
          height: 480,
        });
        camera.start();
        cameraRef.current = camera;
      }

      setIsCameraActive(true);
      setCameraStatus(loc('Live Camera Tracking', 'الكاميرا متصلة وترصد الإشارات'));
      triggerHapticAlert('single-pulse');
    } catch (err) {
      console.error('[SignCamera] Failed to open camera:', err);
      toast.error(loc('Camera access denied or unavailable', 'تعذر فتح الكاميرا، يرجى السماح بالإذن'));
      setCameraStatus('');
      setIsCameraActive(false);
    }
  };

  const handleStopCamera = () => {
    try {
      cameraRef.current?.stop();
    } catch {
      // ignore
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setCameraStatus('');
    setDetectedSign('');
  };

  // Clean up camera on unmount
  useEffect(() => {
    return () => {
      handleStopCamera();
      cancelSpeech();
    };
  }, []);

  // Speak accumulated camera text aloud in Live Audio
  const handleSpeakAccumulatedText = () => {
    if (!accumulatedText.trim()) return;
    setIsSpeakingCameraText(true);
    triggerHapticAlert('single-pulse');

    speak(accumulatedText.trim(), dialect, {
      rate: 1.0,
      onStart: () => setIsSpeakingCameraText(true),
      onEnd: () => setIsSpeakingCameraText(false),
      onError: () => setIsSpeakingCameraText(false),
    });
  };

  // Send accumulated camera text to the AI half
  const handleSendToAiTutor = () => {
    if (!accumulatedText.trim()) return;
    setAiQuestion(accumulatedText.trim());
    handleAskAi(accumulatedText.trim());
    toast.success(loc('Sent to AI Avatar Tutor', 'تم إرسال السؤال للأفاتار 3D'));
  };

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="flex-1 flex flex-col h-full overflow-hidden select-none bg-[#080409] text-slate-100"
    >
      {/* ── TOP HEADER ── */}
      <header className="px-4 py-2.5 border-b border-[#4A1224]/60 bg-[#0E0610]/95 backdrop-blur-xl flex items-center justify-between gap-3 shrink-0 z-10">
        <div className="flex items-center gap-2.5">
          {onNavigateBack && (
            <button
              onClick={onNavigateBack}
              className="p-1.5 rounded-xl bg-[#150917] border border-[#4A1224]/60 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title={loc('Back to Hub', 'رجوع للرئيسية')}
            >
              <ArrowRight className={`w-4 h-4 ${isAr ? '' : 'rotate-180'}`} />
            </button>
          )}
          <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-[#E5A93C]/30 flex items-center justify-center text-[#E5A93C]">
            <Ear className="w-4 h-4" />
          </div>
          <div>
            <h1 className="font-black text-sm text-white leading-tight flex items-center gap-2">
              <span>{loc('Bilateral Sign Language Station', 'محطة لغة الإشارة التبادلية')}</span>
            </h1>
            <p className="text-[10px] text-slate-400">
              {loc(
                'AI Avatar explains in 3D Sign | Camera translates your signs into voice & text',
                'الأفاتار يشرح بالذكاء الاصطناعي والإشارة 3D | الكاميرا تقرأ إشاراتك وتحولها لصوت أو نص'
              )}
            </p>
          </div>
        </div>

        {/* Dialect Switcher */}
        <div className="flex items-center gap-1 bg-[#150917] border border-[#4A1224]/60 p-1 rounded-xl text-xs">
          {(['Egyptian Ammiya', 'Arabic', 'English'] as Dialect[]).map((d) => (
            <button
              key={d}
              onClick={() => setDialect(d)}
              className={`px-2 py-1 rounded-lg font-bold transition-all text-[11px] cursor-pointer ${
                dialect === d
                  ? 'bg-amber-400 text-slate-950 font-black shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {d === 'Egyptian Ammiya' ? '🇪🇬 مصري' : d === 'Arabic' ? '🇸🇦 فصحى' : '🇺🇸 EN'}
            </button>
          ))}
        </div>
      </header>

      {/* ── BILATERAL SIGN LANGUAGE STATION: TWO CARDS ── */}
      <main className="flex-1 min-h-0 p-3 sm:p-4 grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 overflow-y-auto custom-scrollbar">

        {/* ══════════════════════════════════════════════════════════════════════
            CARD 1: THE 3D AVATAR & AI TUTOR (اسأل الذكاء الاصطناعي ويرد بالإشارة)
           ══════════════════════════════════════════════════════════════════════ */}
        <div className="bg-[#120614]/90 border border-[#4A1224]/60 rounded-2xl p-3.5 flex flex-col justify-between shadow-xl relative overflow-hidden group">
          <div className="flex flex-col h-full justify-between">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-[#4A1224]/40 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-xs sm:text-sm font-black text-white flex items-center gap-1.5 flex-wrap">
                    <span>{loc('3D Sign Avatar & AI Tutor', 'أفاتار الذكاء الاصطناعي بلغة الإشارة 3D')}</span>
                  </h2>
                  <p className="text-[10px] text-slate-400">
                    {loc('Ask any question -> AI explains it in 3D Sign Language', 'اسأله أي سؤال ويشرحه لك بلغة الإشارة 3D')}
                  </p>
                </div>
              </div>

              {/* Avatar Controls */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsAvatarPlaying(!isAvatarPlaying)}
                  className="p-1.5 rounded-lg bg-[#150917] border border-[#4A1224]/60 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title={isAvatarPlaying ? loc('Pause', 'إيقاف مؤقت') : loc('Play', 'تشغيل')}
                >
                  {isAvatarPlaying ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={handleReplayAvatar}
                  className="p-1.5 rounded-lg bg-[#150917] border border-[#4A1224]/60 text-slate-300 hover:text-amber-400 transition-colors cursor-pointer"
                  title={loc('Replay Sign Sequence', 'إعادة الحركة الإشارية')}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 3D Avatar Canvas */}
            <div className="w-full flex-1 min-h-[240px] max-h-[300px] my-2 rounded-xl bg-gradient-to-b from-[#09030B] to-[#140616] border border-[#4A1224]/50 relative overflow-hidden flex items-center justify-center">
              <React.Suspense
                fallback={
                  <div className="flex flex-col items-center justify-center text-slate-500 gap-2">
                    <div className="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs font-bold">{loc('Loading 3D Avatar…', 'جاري تشغيل الأفاتار 3D...')}</span>
                  </div>
                }
              >
                <SignAvatar3D
                  words={avatarWords}
                  playing={isAvatarPlaying}
                  onProgress={(idx) => setCurrentSigningWord(avatarWords[idx] || '')}
                  onDone={() => setIsAvatarPlaying(false)}
                  className="w-full h-full"
                />
              </React.Suspense>

              {/* Active Sign Ticker */}
              <div className="absolute bottom-2 inset-x-2 flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#0E0610]/85 backdrop-blur-md border border-[#4A1224]/60 text-xs">
                <span className="text-[10px] text-slate-400 font-bold">
                  {loc('Signing Word:', 'الكلمة المشارة:')}
                </span>
                <span className="font-black text-amber-400 text-xs tracking-wide">
                  {currentSigningWord || avatarWords[0] || '---'}
                </span>
              </div>
            </div>

            {/* AI Subtitles / Explanation Box */}
            <div className="p-2.5 rounded-xl bg-[#09030B] border border-[#4A1224]/40 mb-2 min-h-[75px] max-h-[110px] overflow-y-auto custom-scrollbar flex flex-col justify-between">
              <p className="text-xs text-slate-200 leading-relaxed font-medium">
                {isAiLoading ? (
                  <span className="text-amber-400 flex items-center gap-1.5 animate-pulse">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{loc('Generating answer & translating to 3D Sign...', 'جاري توليد الإجابة وترجمتها للإشارة 3D...')}</span>
                  </span>
                ) : (
                  aiAnswer
                )}
              </p>
              {!isAiLoading && (
                <div className="flex items-center justify-between pt-1 text-[10px] text-slate-500 border-t border-slate-900 mt-1">
                  <span>{loc('✅ Ready', '✅ جاهز')}</span>
                </div>
              )}
            </div>

            {/* Question Input Form */}
            <div className="flex flex-col gap-1.5 pt-1">
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={aiQuestion}
                  onChange={(e) => setAiQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAskAi()}
                  placeholder={loc(
                    'Ask AI any academic, scientific, or general question…',
                    'اسأل الذكاء الاصطناعي أي سؤال ليشرحه بلغة الإشارة...'
                  )}
                  className="flex-1 p-2.5 rounded-xl bg-[#09030B] border border-[#4A1224]/50 text-slate-100 placeholder:text-slate-500 text-xs focus:outline-none focus:border-indigo-400/80 transition-all"
                />

                {/* Voice button */}
                <button
                  onClick={toggleQuestionVoice}
                  className={`p-2.5 rounded-xl border text-xs transition-colors cursor-pointer ${
                    isQuestionVoiceActive
                      ? 'bg-rose-500 text-white border-rose-400 animate-pulse'
                      : 'bg-[#150917] border-[#4A1224]/60 text-slate-300 hover:text-white'
                  }`}
                  title={loc('Ask by Voice', 'اسأل بالصوت')}
                >
                  {isQuestionVoiceActive ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>

                {/* Send Button */}
                <button
                  onClick={() => handleAskAi()}
                  disabled={!aiQuestion.trim() || isAiLoading}
                  className="p-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 disabled:opacity-40 text-white font-black text-xs flex items-center gap-1.5 transition-all shadow-md shadow-indigo-500/20 active:scale-[0.98] cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{loc('Ask & Sign', 'اسأل واشرح')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            HALF 2 (50%): THE CAMERA (مكان الميكرفون) TO CONVERT SIGNS TO VOICE & TEXT
           ══════════════════════════════════════════════════════════════════════ */}
        <div className="bg-[#120614]/90 border border-[#4A1224]/60 rounded-2xl p-3.5 flex flex-col justify-between shadow-xl relative overflow-hidden group">
          <div className="flex flex-col h-full justify-between">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-[#4A1224]/40 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center">
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-xs sm:text-sm font-black text-white flex items-center gap-1.5">
                    <span>{loc('Live Camera Sign Recognition', 'كاميرا قراءة لغة الإشارة الذكية')}</span>
                    {isCameraActive && (
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    )}
                  </h2>
                  <p className="text-[10px] text-slate-400">
                    {loc('Open camera & sign with hands -> converts to text for AI', 'افتح الكاميرا وتكلم بلغة الإشارة -> تتحول فوراً لنص يُرسل للذكاء الاصطناعي')}
                  </p>
                </div>
              </div>

              {/* Start / Stop Camera Button */}
              <button
                onClick={isCameraActive ? handleStopCamera : handleStartCamera}
                className={`py-1.5 px-3.5 rounded-xl font-black text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-[0.98] cursor-pointer ${
                  isCameraActive
                    ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/20'
                    : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-amber-500/20'
                }`}
              >
                {isCameraActive ? (
                  <>
                    <CameraOff className="w-3.5 h-3.5" />
                    <span>{loc('Stop Camera', 'إيقاف الكاميرا')}</span>
                  </>
                ) : (
                  <>
                    <Camera className="w-3.5 h-3.5" />
                    <span>{loc('Start Camera', 'تشغيل الكاميرا')}</span>
                  </>
                )}
              </button>
            </div>

            {/* Video Viewfinder Container */}
            <div className="w-full flex-1 min-h-[240px] max-h-[300px] my-2 rounded-xl bg-[#09030B] border border-[#4A1224]/50 relative overflow-hidden flex items-center justify-center">
              {/* Actual Video Element */}
              <video
                ref={videoRef}
                playsInline
                muted
                className={`w-full h-full object-cover transform -scale-x-100 ${isCameraActive ? 'block' : 'hidden'}`}
              />

              {/* Canvas Overlay for hand tracking landmarks */}
              <canvas
                ref={canvasRef}
                className={`absolute inset-0 w-full h-full pointer-events-none transform -scale-x-100 ${isCameraActive ? 'block' : 'hidden'}`}
              />

              {/* Placeholder when camera is off */}
              {!isCameraActive && (
                <div className="flex flex-col items-center justify-center text-center p-4 text-slate-500 gap-2">
                  <div className="w-14 h-14 rounded-2xl bg-[#150917] border border-[#4A1224]/60 flex items-center justify-center text-slate-400">
                    <Hand className="w-7 h-7 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-200">
                      {loc('Camera is ready', 'الكاميرا جاهزة للتشغيل')}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1 max-w-[280px]">
                      {loc(
                        'Click "Start Camera" above and sign with your hands to convert into text for AI.',
                        'اضغط على زر "تشغيل الكاميرا" أعلاه وتكلم بإشارات يدك لتتحول مباشرةً لنص وتُرسل للذكاء الاصطناعي.'
                      )}
                    </p>
                  </div>
                </div>
              )}

              {/* Live Detected Sign Banner */}
              {isCameraActive && (
                <div className="absolute bottom-2 inset-x-2 flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#0E0610]/85 backdrop-blur-md border border-[#4A1224]/60 text-xs">
                  <span className="text-[10px] text-slate-400 font-bold">
                    {cameraStatus || loc('Tracking Hands…', 'جاري رصد حركة اليدين…')}
                  </span>
                  <span className="font-black text-emerald-400 text-xs tracking-wide">
                    {detectedSign ? (isAr ? `🤟 رُصدت: ${detectedSign}` : `🤟 Detected: ${detectedSign}`) : loc('Wave hand in front of camera', 'لوح بيدك أمام الكاميرا')}
                  </span>
                </div>
              )}
            </div>

            {/* ── CONVERTED TEXT & AUDIO OUTPUT (تحتها يتحول الكلام لصوت أو نص) ── */}
            <div className="flex flex-col gap-2">
              {/* Text Box */}
              <div className="p-2.5 rounded-xl bg-[#09030B] border border-[#4A1224]/40 min-h-[65px] max-h-[90px] overflow-y-auto custom-scrollbar flex flex-col justify-between">
                <p className="text-xs sm:text-sm font-black text-amber-300 leading-relaxed">
                  {accumulatedText.trim() ? (
                    accumulatedText
                  ) : (
                    <span className="text-slate-500 font-normal text-xs">
                      {loc(
                        'Recognized words from your camera signs will appear here…',
                        'الكلام المترجم من إشارات يدك سيظهر هنا في الوقت الفعلي…'
                      )}
                    </span>
                  )}
                </p>

                {accumulatedText.trim() && (
                  <div className="flex items-center justify-end pt-1 border-t border-slate-900 text-[10px] text-slate-400">
                    <button
                      onClick={() => setAccumulatedText('')}
                      className="text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>{loc('Clear', 'مسح')}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Action Buttons: Live Audio + Send Question to AI */}
              <div className="grid grid-cols-2 gap-2">
                {/* 1. Live Audio Output */}
                <button
                  onClick={handleSpeakAccumulatedText}
                  disabled={!accumulatedText.trim()}
                  className={`py-2.5 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-[0.98] cursor-pointer ${
                    isSpeakingCameraText
                      ? 'bg-emerald-400 text-slate-950 animate-pulse shadow-emerald-400/40 ring-2 ring-emerald-300'
                      : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-40 text-slate-950 shadow-emerald-500/20'
                  }`}
                  title={loc('Live audio playback of recognized signs', 'نطق الكلمات المترجمة بصوت حي مباشر')}
                >
                  <Volume2 className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {isSpeakingCameraText
                      ? loc('Speaking… 🔊', 'جاري النطق… 🔊')
                      : loc('Live Audio 🔊', 'صوت مباشر 🔊')}
                  </span>
                </button>

                {/* 2. Send Question to AI Avatar */}
                <button
                  onClick={handleSendToAiTutor}
                  disabled={!accumulatedText.trim() || isAiLoading}
                  className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 disabled:opacity-40 text-white font-black text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-indigo-500/20 active:scale-[0.98] cursor-pointer"
                >
                  <Bot className="w-3.5 h-3.5 shrink-0" />
                  <span>{loc('Ask AI this Sign 🤖', 'اسأل الـ AI هذا السؤال 🤖')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

      </main>

      {/* Minor Student Parental Consent Gate Modal */}
      <ParentalConsentModal
        isOpen={showConsentModal}
        profile={profile}
        requiredScope="camera"
        onConsentGranted={(consent) => {
          setShowConsentModal(false);
          if (profile) {
            profile.parentalConsent = consent;
          }
          handleStartCamera();
        }}
        onCancel={() => setShowConsentModal(false)}
      />
    </div>
  );
}
