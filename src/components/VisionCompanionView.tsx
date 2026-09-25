/**
 * Visual Companion (الرفيق البصري) — Life-assistant full-screen camera tool
 * for blind and visually impaired users.
 *
 * Capabilities:
 * 1. Full-screen camera viewport with floating ergonomic accessible HUD.
 * 2. Two distinct language choices: Arabic (عربي) and English.
 * 3. Automatic "Repeat Aloud" audio readout (TTS) immediately upon generation.
 * 4. "Remember this as..." feature for persistent object & face recognition.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Camera,
  Volume2,
  VolumeX,
  BookmarkPlus,
  Loader2,
  AlertTriangle,
  X,
  Trash2,
  Maximize2,
  Minimize2,
  Sparkles,
  Globe,
  MapPin,
  Search,
  BookOpen,
  ShoppingBag,
  GraduationCap,
  Banknote,
  Users,
  Palette,
  Compass,
  FileText,
} from 'lucide-react';
import { triggerHapticAlert, parseNavGuidance } from '../lib/hapticNavEngine';
import { doc, setDoc } from 'firebase/firestore';
import { db, cleanDataForFirestore } from '../lib/firebase';
import { UserProfile, VisionMemory, SpatialObjectRecord } from '../types';
import { localize, isArabicLocale } from '../lib/translations';
import { generateAdaptiveResponse } from '../services/gemini';
import { speak, cancelSpeech, unlockSpeechSynthesis } from '../lib/tts';
import { toast } from './Toast';
import DocumentReaderModal from './DocumentReaderModal';
import {
  extractSpatialObjectsFromVision,
  recordObservedSpatialObjects,
  getSpatialObjects,
  querySpatialMemory,
  loadSpatialObjectsFromFirestore,
} from '../lib/spatialMemoryEngine';

interface VisionCompanionViewProps {
  profile: UserProfile;
  setProfile?: (profile: UserProfile) => void;
}

type Status = 'idle' | 'starting-camera' | 'ready' | 'analyzing' | 'camera-denied' | 'unsupported';

const isArabicLang = (lang?: string) => isArabicLocale(lang);

// Remembers the user's chosen Visual Companion language across visits,
// so it's only asked once instead of defaulting to English every time.
const COMPANION_LANG_STORAGE_KEY = 'cognify_vision_companion_lang';

/**
 * Sanitizes visual descriptions for both on-screen display and spoken output:
 * - Strips robotic labels like "**Hazards:** None", "**Visible Text:** None", "**Scene Description:**"
 * - Converts "Hazards: None" to "No hazards around you." / "مفيش أخطار حواليك."
 * - Strips all markdown formatting (asterisks, bullet dashes, backticks)
 * - Removes spoken symbol words (asterisk, star, استريك, نجمة)
 */
export function cleanVisionDescription(raw: string, lang: 'ar' | 'en' | 'fr' = 'en'): string {
  if (!raw) return '';
  return raw
    .replace(/\[Signs:.*?\]/g, '')
    // English robotic boilerplate
    .replace(/\*\*Hazards:\*\*\s*(None detected[^\n.]*|None[^\n.]*)[.]?/gi, 'No hazards around you.')
    .replace(/Hazards:\s*(None detected[^\n.]*|None[^\n.]*)[.]?/gi, 'No hazards around you.')
    .replace(/\*\*Visible Text:\*\*\s*(None[^\n.]*|N\/A[^\n.]*)[.]?/gi, '')
    .replace(/Visible Text:\s*(None[^\n.]*|N\/A[^\n.]*)[.]?/gi, '')
    .replace(/\*\*(Scene Description|Description):\*\*/gi, '')
    .replace(/(Scene Description|Description):/gi, '')
    .replace(/\*\*(Lecture Summary|Summary|Key Points):\*\*/gi, '')
    .replace(/(Lecture Summary|Summary|Key Points):/gi, '')
    // Arabic robotic boilerplate
    .replace(/\*\*المخاطر:\*\*\s*(لا توجد[^\n.]*|لا يوجد[^\n.]*)[.]?/gi, 'مفيش أخطار حواليك.')
    .replace(/المخاطر:\s*(لا توجد[^\n.]*|لا يوجد[^\n.]*)[.]?/gi, 'مفيش أخطار حواليك.')
    .replace(/\*\*النصوص( المكتوبة)?:\*\*\s*(لا توجد[^\n.]*|لا يوجد[^\n.]*)[.]?/gi, '')
    .replace(/النصوص( المكتوبة)?:\s*(لا توجد[^\n.]*|لا يوجد[^\n.]*)[.]?/gi, '')
    .replace(/\*\*(وصف المشهد|الوصف):\*\*/gi, '')
    .replace(/(وصف المشهد|الوصف):/gi, '')
    .replace(/\*\*(ملخص المحاضرة|الملخص|النقاط الرئيسية):\*\*/gi, '')
    .replace(/(ملخص المحاضرة|الملخص|النقاط الرئيسية):/gi, '')
    // French robotic boilerplate
    .replace(/\*\*Dangers?:\*\*\s*(Aucun[^\n.]*)[.]?/gi, 'Aucun danger autour de vous.')
    .replace(/Dangers?:\s*(Aucun[^\n.]*)[.]?/gi, 'Aucun danger autour de vous.')
    .replace(/\*\*Textes?( visibles?)?:\*\*\s*(Aucun[^\n.]*)[.]?/gi, '')
    .replace(/Textes?( visibles?)?:\s*(Aucun[^\n.]*)[.]?/gi, '')
    .replace(/\*\*(Description de la scène|Description):\*\*/gi, '')
    .replace(/(Description de la scène|Description):/gi, '')
    .replace(/\*\*(Résumé du cours|Résumé|Points clés):\*\*/gi, '')
    .replace(/(Résumé du cours|Résumé|Points clés):/gi, '')
    // Spoken symbol artifacts
    .replace(/(?:^|\s+)(asterisk|استريك|نجمة|بوليت)(?=\s+|$)/giu, ' ')
    // Markdown formatting (*, #, _, `, ~, [], (), <>)
    .replace(/[*+#_`~\[\]()<>]/g, '')
    // Bullet dashes
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/\s+-\s+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export default function VisionCompanionView({ profile, setProfile }: VisionCompanionViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isMountedRef = useRef<boolean>(true);

  const [status, setStatus] = useState<Status>('starting-camera');
  const [lastDescription, setLastDescription] = useState<string>('');
  const [lastSnapshot, setLastSnapshot] = useState<string | null>(null);
  const [announce, setAnnounce] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [labelInput, setLabelInput] = useState('');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Read Mode: focuses the AI on reading visible text or summarizing lectures/documents.
  const [readMode, setReadMode] = useState(false);
  // Read Action: 'summarize' for lecture & document summaries, 'read' for verbatim word-for-word reading.
  const [readAction, setReadAction] = useState<'summarize' | 'read'>('summarize');

  // Shopping Assistant Mode
  const [shoppingMode, setShoppingMode] = useState(false);
  // Instant Currency Reader Mode (قارئ العملات والنقود)
  const [currencyMode, setCurrencyMode] = useState(false);
  // Face & Familiar Person Recognition Mode (التعرف على الوجوه والمقربين)
  const [faceMode, setFaceMode] = useState(false);
  // Color & Outfit Matcher Mode (مساعد تناسق الملابس والألوان)
  const [outfitMode, setOutfitMode] = useState(false);
  // Virtual White Cane & Indoor Haptic Navigation Mode (العصا والملاحة الاهتزازية)
  const [navGuideMode, setNavGuideMode] = useState(false);

  // Saving memory as person vs object
  const [isSavingPerson, setIsSavingPerson] = useState(false);

  // Supported languages: Arabic, English, French
  const [companionLang, setCompanionLang] = useState<'ar' | 'en' | 'fr'>(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem(COMPANION_LANG_STORAGE_KEY);
      if (saved === 'ar' || saved === 'en' || saved === 'fr') return saved;
    }
    if (isArabicLang(profile?.language)) return 'ar';
    if (profile?.language === 'French' || (profile?.language as unknown as string) === 'fr') return 'fr';
    return 'ar'; // neutral placeholder while the first-launch picker is shown
  });

  const announceFeature = useCallback((titleAr: string, titleEn: string, titleFr: string, isActive: boolean) => {
    const text = companionLang === 'ar'
      ? (isActive ? `تم تفعيل ${titleAr}` : `تم إيقاف ${titleAr}`)
      : companionLang === 'fr'
      ? (isActive ? `Mode ${titleFr} activé` : `Mode ${titleFr} désactivé`)
      : (isActive ? `${titleEn} mode activated` : `${titleEn} mode deactivated`);

    const voiceLang = companionLang === 'ar' ? 'Arabic' : companionLang === 'fr' ? 'French' : 'English';
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();
    }
    speak(text, voiceLang as any);
  }, [companionLang]);

  const resetAllModes = useCallback(() => {
    setReadMode(false);
    setShoppingMode(false);
    setCurrencyMode(false);
    setFaceMode(false);
    setOutfitMode(false);
    setNavGuideMode(false);
  }, []);

  const toggleReadMode = useCallback(() => {
    setReadMode((prev) => {
      const next = !prev;
      if (next) {
        setShoppingMode(false);
        setCurrencyMode(false);
        setFaceMode(false);
        setOutfitMode(false);
        setNavGuideMode(false);
      }
      announceFeature('قارئ النصوص والكتب والروشتات', 'Document and Text Reader', 'Lecture de Documents', next);
      return next;
    });
  }, [announceFeature]);

  const toggleShoppingMode = useCallback(() => {
    setShoppingMode((prev) => {
      const next = !prev;
      if (next) {
        setReadMode(false);
        setCurrencyMode(false);
        setFaceMode(false);
        setOutfitMode(false);
        setNavGuideMode(false);
      }
      announceFeature('مساعد فحص المنتجات والتسوق', 'Shopping and Product Scanner', 'Assistant Shopping', next);
      return next;
    });
  }, [announceFeature]);

  const toggleCurrencyMode = useCallback(() => {
    setCurrencyMode((prev) => {
      const next = !prev;
      if (next) {
        setReadMode(false);
        setShoppingMode(false);
        setFaceMode(false);
        setOutfitMode(false);
        setNavGuideMode(false);
      }
      announceFeature('قارئ العملات والنقود المصرية', 'Egyptian Currency Reader', 'Lecteur de Monnaie', next);
      return next;
    });
  }, [announceFeature]);

  const toggleFaceMode = useCallback(() => {
    setFaceMode((prev) => {
      const next = !prev;
      if (next) {
        setReadMode(false);
        setShoppingMode(false);
        setCurrencyMode(false);
        setOutfitMode(false);
        setNavGuideMode(false);
      }
      announceFeature('التعرف على الوجوه والمقربين', 'Face Recognition and Familiar People', 'Reconnaissance Faciale', next);
      return next;
    });
  }, [announceFeature]);

  const toggleOutfitMode = useCallback(() => {
    setOutfitMode((prev) => {
      const next = !prev;
      if (next) {
        setReadMode(false);
        setShoppingMode(false);
        setCurrencyMode(false);
        setFaceMode(false);
        setNavGuideMode(false);
      }
      announceFeature('فحص وتنسيق ألوان الملابس', 'Color and Outfit Matcher', 'Style et Couleurs', next);
      return next;
    });
  }, [announceFeature]);

  const toggleNavGuideMode = useCallback(() => {
    setNavGuideMode((prev) => {
      const next = !prev;
      if (next) {
        setReadMode(false);
        setShoppingMode(false);
        setCurrencyMode(false);
        setFaceMode(false);
        setOutfitMode(false);
      }
      announceFeature('العصا الذكية وتنبيهات المسافات', 'Smart White Cane Navigation', 'Canne Virtuelle', next);
      return next;
    });
  }, [announceFeature]);

  // Tracks whether the description is currently being spoken aloud, so the
  // same button can toggle between "play" and "stop" the voice.
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Has the user ever picked a language before (this device)? If not, show
  // the first-launch language picker instead of silently defaulting to English.
  const [langChosen, setLangChosen] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.localStorage.getItem(COMPANION_LANG_STORAGE_KEY)) {
      return true;
    }
    if (isArabicLang(profile?.language) || profile?.language === 'French') return true;
    return false;
  });

  const chooseLang = useCallback((lang: 'ar' | 'en' | 'fr') => {
    setCompanionLang(lang);
    setLangChosen(true);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(COMPANION_LANG_STORAGE_KEY, lang);
    }
  }, []);

  // Spatial memory drawer state
  const [showSpatialMemory, setShowSpatialMemory] = useState(false);
  const [showDocumentReader, setShowDocumentReader] = useState(false);
  const [spatialRecords, setSpatialRecords] = useState<SpatialObjectRecord[]>(() =>
    profile?.uid ? getSpatialObjects(profile.uid) : []
  );
  const [spatialQueryInput, setSpatialQueryInput] = useState('');
  const [spatialQueryResult, setSpatialQueryResult] = useState<string | null>(null);

  // Hydrate spatial objects from owner-only encrypted Firestore subcollection
  useEffect(() => {
    if (profile?.uid) {
      loadSpatialObjectsFromFirestore(profile.uid).then((records) => {
        if (isMountedRef.current && records && records.length > 0) {
          setSpatialRecords(records);
        }
      });
    }
  }, [profile?.uid]);

  const memories = profile?.visionMemories || [];

  const t = useCallback(
    (en: string, ar: string, fr?: string) => {
      if (companionLang === 'ar') return ar;
      if (companionLang === 'fr') return fr || en;
      return en;
    },
    [companionLang]
  );

  const startCamera = useCallback(
    async (mode: 'environment' | 'user' = facingMode) => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('unsupported');
        return;
      }
      setStatus('starting-camera');
      try {
        streamRef.current?.getTracks().forEach((tr) => tr.stop());
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: mode,
              width: { min: 960, ideal: 1920, max: 1920 },
              height: { min: 540, ideal: 1080, max: 1080 },
            },
            audio: false,
          });
        } catch {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 720 } },
              audio: false,
            });
          } catch {
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          }
        }

        if (!isMountedRef.current) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setStatus('ready');
        setAnnounce(
          companionLang === 'ar'
            ? 'الكاميرا جاهزة بملء الشاشة. اضغط الزرار لسماع وصف ما أمامك.'
            : 'Full-screen camera ready. Tap either button to describe what is in front of you.'
        );
      } catch {
        if (isMountedRef.current) setStatus('camera-denied');
      }
    },
    [facingMode, companionLang]
  );

  useEffect(() => {
    isMountedRef.current = true;
    unlockSpeechSynthesis();
    startCamera();
    return () => {
      isMountedRef.current = false;
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      cancelSpeech();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard Escape listener for the save modal
  useEffect(() => {
    if (!showSaveDialog) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowSaveDialog(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSaveDialog]);

  // isFullscreen used to be set synchronously and optimistically right when
  // the button was pressed — before requestFullscreen()'s promise even
  // resolved. If the browser denied the request, or the user exited via the
  // OS/Escape key (not our own button), that left the state permanently
  // wrong: stuck showing "exit fullscreen" while the app wasn't actually
  // fullscreen (or vice versa), with a mismatched layout class applied.
  // Tracking the real browser event is the only way this can't drift.
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      // Optimistic UI update; if the real Fullscreen API is unavailable or
      // denied, this doubles as the CSS-simulated fullscreen fallback. If it
      // succeeds, the fullscreenchange listener above just confirms the same
      // value again — if it's denied, we stay on the CSS fallback rather
      // than silently doing nothing.
      setIsFullscreen(true);
      containerRef.current?.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const flipCamera = () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    startCamera(next);
  };

  const captureFrame = (): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return null;

    const maxDim = 1280;
    let w = video.videoWidth;
    let h = video.videoHeight;
    if (w > maxDim || h > maxDim) {
      if (w > h) {
        h = Math.round((h * maxDim) / w);
        w = maxDim;
      } else {
        w = Math.round((w * maxDim) / h);
        h = maxDim;
      }
    }

    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', 0.85);
  };

  const describeScene = async (
    choiceLang?: 'ar' | 'en' | 'fr',
    forcedFrame?: string,
    forcedAction?: 'summarize' | 'read'
  ) => {
    const targetLang = choiceLang || companionLang;
    setCompanionLang(targetLang);
    const activeReadAction = forcedAction || readAction;
    if (forcedAction) setReadAction(forcedAction);

    // 1. PRIME SPEECH SYNTHESIS IMMEDIATELY ON REAL USER CLICK
    unlockSpeechSynthesis();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.resume();
        const primeUtterance = new SpeechSynthesisUtterance('');
        primeUtterance.volume = 0;
        window.speechSynthesis.speak(primeUtterance);
      } catch {
        /* ignore */
      }
    }

    if (!forcedFrame && status !== 'ready' && status !== 'analyzing') {
      const errNoCam =
        targetLang === 'ar'
          ? 'الكاميرا غير متاحة حالياً، يرجى السماح بالوصول للكاميرا.'
          : targetLang === 'fr'
          ? "La caméra n'est pas disponible. Veuillez autoriser l'accès à la caméra."
          : 'Camera is not available. Please allow camera access.';
      speak(errNoCam, targetLang === 'ar' ? 'Arabic' : targetLang === 'fr' ? 'French' : 'English');
      return;
    }

    const frame = forcedFrame || captureFrame();
    if (!frame) {
      const errNoFrame =
        targetLang === 'ar'
          ? 'تعذر التقاط صورة الكاميرا، يرجى المحاولة ثانية.'
          : targetLang === 'fr'
          ? "Impossible de capturer l'image de la caméra, veuillez réessayer."
          : 'Could not capture the camera frame, please try again.';
      speak(errNoFrame, targetLang === 'ar' ? 'Arabic' : targetLang === 'fr' ? 'French' : 'English');
      return;
    }

    setLastSnapshot(frame);
    setStatus('analyzing');
    const waitingMsg = currencyMode
      ? targetLang === 'ar'
        ? 'بفحص العملة والنقود فوراً...'
        : targetLang === 'fr'
        ? 'Identification du billet et de la devise...'
        : 'Identifying banknote and currency value...'
      : faceMode
      ? targetLang === 'ar'
        ? 'بتعرف على الأشخاص والوجوه قدامك...'
        : targetLang === 'fr'
        ? 'Reconnaissance des visages et des personnes...'
        : 'Recognizing faces and people in front of you...'
      : outfitMode
      ? targetLang === 'ar'
        ? 'بفحص ألوان الملابس وتناسقها...'
        : targetLang === 'fr'
        ? 'Analyse des couleurs et de l\'harmonie vestimentaire...'
        : 'Analyzing clothes, colors, and outfit harmony...'
      : navGuideMode
      ? targetLang === 'ar'
        ? 'بفحص المسار والممر لكشف العوائق...'
        : targetLang === 'fr'
        ? 'Balayage du chemin et détection des obstacles...'
        : 'Scanning pathway and detecting obstacles...'
      : shoppingMode
      ? targetLang === 'ar'
        ? 'بتعرف على المنتج والأسعار قدامك...'
        : targetLang === 'fr'
        ? 'Identification du produit et des prix...'
        : 'Identifying product and pricing in front of you...'
      : readMode
      ? activeReadAction === 'summarize'
        ? targetLang === 'ar'
          ? 'بستخرج المفيد وخلاصة الكلام...'
          : targetLang === 'fr'
          ? 'Extraction de l\'essentiel et de la conclusion...'
          : 'Extracting key takeaways and bottom line...'
        : targetLang === 'ar'
        ? 'بقرا النص اللي قدامك...'
        : targetLang === 'fr'
        ? 'Je lis le texte devant vous...'
        : 'Reading the text in front of you...'
      : targetLang === 'ar'
      ? 'بحلل اللي قدامك في الكاميرا...'
      : targetLang === 'fr'
      ? "J'analyse ce qui se trouve devant vous..."
      : "Analyzing what's in front of you...";
    setAnnounce(waitingMsg);

    const knownPeople = memories.filter((m) => m.memoryType === 'person');
    const knownPeopleContext = knownPeople.length
      ? `\n\nFamily & Friends saved by user (announce if person matches):\n${knownPeople
          .slice(-15)
          .map((m) => `- "${m.label}": ${m.description}`)
          .join('\n')}`
      : '';

    const knownContext = memories.length
      ? `\n\nContext — objects/people previously saved by the user (mention only if photo matches):\n${memories
          .slice(-15)
          .map((m) => `- "${m.label}": ${m.description}`)
          .join('\n')}`
      : '';

    let prompt = '';
    if (currencyMode) {
      // Instant Currency & Banknote Reader
      if (targetLang === 'ar') {
        prompt = `أنت خبير فوري وقارئ نقود ذكي يتحدث بصوته لشخص كفيف يمسك ورقة نقدية أو نقوداً أمام الكاميرا.
انظر فوراً إلى الورقة النقدية وقل قيمتها مباشرة في أجزاء من الثانية:
1. القيمة والعملة فوراً وبدون أي مقدمات: مثلاً "عشرين جنيه مصري جديدة بلاستيك"، "مائة جنيه مصري"، "خمسون جنيهاً"، "مائتي جنيه"، "عشرة جنيهات"، "خمسة جنيهات"، أو العملات الأخرى (دولار، يورو، ريال سعودي، درهم).
2. حالة الورقة: لو الورقة مقطوعة من الطرف أو ملصوقة بسولوتيب أو باهتة جداً، نبهه فوراً: "الورقة مقطوعة من الطرف" أو "الورقة سليمة".
3. لو الصورة غير واضحة أو العملة مقلوبة، قل باختصار: "اقلب الورقة أو قربها شوية من الكاميرا".
تحدث فوراً برقم الفئة والعملة مباشرة دون أي عناوين أو نجوم ماركداون.${knownContext}`;
      } else if (targetLang === 'fr') {
        prompt = `Vous êtes un lecteur vocal instantané de billets de banque pour une personne aveugle.
Identifiez immédiatement le billet devant la caméra :
1. Dénomination et devise en premier : ex. "Vingt Livres Égyptiennes en polymère", "Cent Livres Égyptiennes", "Cinquante Euros", "Vingt Dollars", "Cent Riyals Saoudiens".
2. État du billet : précisez s'il est déchiré ou abîmé.
3. Si c'est flou, dites "Rapprochez le billet ou retournez-le".
Parlez directement sans astérisques markdown ni préambule.${knownContext}`;
      } else {
        prompt = `You are a fast voice currency reader for a blind person holding banknotes in front of the camera.
Instantly identify the bill and announce its exact value in fractions of a second:
1. Denomination & Currency First: e.g. "Twenty Egyptian Pounds (Polymer)", "One Hundred Egyptian Pounds", "Fifty US Dollars", "Twenty Euros", "One Hundred Saudi Riyals".
2. Physical condition: note if the bill is torn, heavily taped, or damaged.
3. If blurry or only partially visible, say "Bring the bill closer or flip it over."
Speak the denomination directly without preamble, headings, or markdown asterisks.${knownContext}`;
      }
    } else if (faceMode) {
      // Familiar Face & Person Recognition
      if (targetLang === 'ar') {
        prompt = `أنت رفيق بشري يتحدث بصوته لشخص كفيف ليتعرف على الأشخاص والوجوه أمامه.
انظر إلى الشخص أو الأشخاص أمام الكاميرا:
1. إذا كان الشخص يطابق أحد الأشخاص المحفوظين مسبقاً في الذاكرة أدناه، اذكر اسمه فوراً بحرارة وبشرى (مثلاً: "أحمد يقف أمامك ويبتسم"، "والدتك مقبلة نحوك").
2. إذا لم يكن محفوظاً، صفه بسرعة وبشكل ودود ومفيد: ملامحه التقريبية (رجل/سيدة/طفل، في العشرينات/الأربعينات، يرتدي نظارة، يبتسم، ينظر إليك أو بعيداً، ملابسه).
3. لو مفيش حد قدامك، قول له بلطف "مفيش حد قدام الكاميرا دلوقتي".
تحدث بشكل طبيعي ومباشر كصديق يهمس في أذنه بدون أي نجوم ماركداون أو عناوين روبوتية.${knownPeopleContext || knownContext}`;
      } else if (targetLang === 'fr') {
        prompt = `Vous êtes un compagnon vocal bienveillant qui aide une personne aveugle à reconnaître les visages et personnes devant elle.
Regardez la personne devant la caméra :
1. Si la personne correspond à un proche mémorisé ci-dessous, annoncez chaleureusement son nom (ex. "Ahmed est devant vous et sourit", "Votre mère s'approche").
2. Sinon, décrivez-la gentiment : âge approximatif, expression (souriant, neutre), lunettes, vêtements.
3. S'il n'y a personne, dites poliment "Aucune personne détectée devant la caméra."
Parlez directement sans astérisques markdown.${knownPeopleContext || knownContext}`;
      } else {
        prompt = `You are a voice companion helping a visually impaired person recognize people and familiar faces.
Look at the person or people in front of the camera:
1. If the person matches a previously remembered friend/family member from the context below, announce their name warmly (e.g. "Ahmed is standing right in front of you, smiling", "Your mother is approaching").
2. If unknown, describe them kindly and helpfully: approximate age, gender, facial expression (smiling, focused), glasses/hair, clothing, and whether they are looking at the camera.
3. If no one is there, gently say "No one is in front of the camera right now."
Speak naturally like a friend whispering in their ear, without headings or markdown asterisks.${knownPeopleContext || knownContext}`;
      }
    } else if (outfitMode) {
      // Clothes & Color Matching Assistant
      if (targetLang === 'ar') {
        prompt = `أنت مستشار أناقة ومساعد ألوان ذكي يتحدث بصوته لشخص كفيف لفحص ملابسه وألوانها وتناسقها.
انظر فوراً إلى الملابس أو القطع المعروضة أمام الكاميرا:
1. اذكر الألوان والأنماط بدقة: مثلاً "قميص أزرق كحلي سادة"، "بنطلون جينز رمادي غامق"، "فستان نبيتي مشجر".
2. احكم على التناسق والانسجام: هل الألوان متناسقة مع بعضها؟ هل الطقم ملائم لمقابلة عمل، خروج رسمي، أم كاجوال؟ (مثلاً: "الطقم متناسق وشيك جداً"، أو "الكحلي مش راكب قوي مع البني، الأفضل قميص أبيض أو رمادي").
3. لو فيه أي بقع أو تجاعيد واضحة، نبهه بلطف: "فيه بقعة صغيرة على الجيب اليمين".
تحدث بأسلوب صوتي مباشر وودود بدون أي نجوم ماركداون أو عناوين روبوتية.${knownContext}`;
      } else if (targetLang === 'fr') {
        prompt = `Vous êtes un conseiller en style et couleurs vocal pour une personne aveugle qui vérifie sa tenue vestimentaire.
Examinez les vêtements devant la caméra :
1. Couleurs et motifs précis : ex. "Chemise bleu marine unie", "Pantalon gris anthracite", "Robe bordeaux".
2. Harmonisation et style : dites si l'ensemble est assorti et pour quelle occasion (formel, travail, détente).
3. État : signalez gentiment d'éventuelles taches ou plis visibles.
Parlez directement sans astérisques markdown ni titres.${knownContext}`;
      } else {
        prompt = `You are a fashion and color matching assistant speaking aloud to a blind person checking their clothes.
Look at the clothing item or outfit in front of the camera:
1. Exact colors and patterns: e.g. "Solid navy blue button-down shirt", "Charcoal gray trousers", "Patterned scarf".
2. Outfit harmony & style: evaluate whether the pieces match well and what setting they suit (e.g. "These colors match wonderfully for work or formal occasions", or "A white shirt would pair better with these trousers").
3. Condition check: gently mention if any visible stains, wrinkles, or lint are noticed.
Speak warmly and directly without any markdown asterisks or headings.${knownContext}`;
      }
    } else if (navGuideMode) {
      // Virtual White Cane & Indoor Navigation Assistant
      if (targetLang === 'ar') {
        prompt = `أنت عصا ذكية ومساعد ملاحة داخلي صوتي لشخص كفيف يتحرك في المكان.
انظر فوراً إلى المسار المباشر والأرضية والممر أمامه:
1. هل المسار مفتوح وآمن؟ ابدأ بـ "المسار مفتوح قدامك تقدر تمشي خطوتين تلاتة" أو اذكر المسافة التقريبية.
2. العوائق والسلالم والأسلاك: اذكر فوراً أي عائق وموقعه الدقيق بالساعة أو الاتجاه (مثلاً: "خد بالك، فيه كرسي على شمالك"، "احذر سلك ممدود على الأرض قدامك"، "قدامك درجتين سلم نازل على بعد متر"، "الباب مفتوح على يمينك").
3. توجيه واضح وبسيط ومباشر بدون أي نجوم ماركداون أو كلام إنشائي، لأن سلامة حركته تعتمد على وضوح كلامك.${knownContext}`;
      } else if (targetLang === 'fr') {
        prompt = `Vous êtes une canne blanche virtuelle et guide de navigation intérieure pour une personne aveugle.
Examinez immédiatement le chemin, le sol et la zone devant la caméra :
1. État du passage : dites si le chemin est dégagé (ex. "Chemin dégagé pour avancer de 3 pas").
2. Obstacles, marches et dangers : signalez immédiatement tout objet avec sa position (ex. "Attention, chaise sur votre gauche", "Attention câble au sol devant vous", "Deux marches qui descendent à 1 mètre", "Porte ouverte à 2 heures").
3. Instructions directes et claires sans astérisques markdown.${knownContext}`;
      } else {
        prompt = `You are an indoor navigation assistant and virtual white cane for a blind person walking forward.
Instantly look at the pathway, floor, and immediate area in front of the camera:
1. Pathway status: state if the path is clear to step forward (e.g. "Clear pathway ahead for about 3 steps").
2. Obstacles, steps, and hazards: identify objects and their precise clock direction or distance (e.g. "Caution, chair on your left", "Watch out for a cable on the floor right ahead", "Two steps going down 1 meter ahead", "Doorway is open at 2 o'clock").
3. Deliver crisp, clear, immediate spatial instructions without any fluff or markdown asterisks.${knownContext}`;
      }
    } else if (shoppingMode) {
      // Shopping Assistant Mode: identifies product name, brand, price tags, currency, weight/size/flavor, expiry date
      if (targetLang === 'ar') {
        prompt = `أنت مساعد تسوق ذكي يتحدث بصوته لشخص كفيف في سوبر ماركت أو محل تسوق. انظر فوراً إلى ما هو أمام الكاميرا وتعرف على:
1. اسم المنتج وماركته ونوعه بالتحديد (مثلاً: لبن جهينة كامل الدسم، مكرونة روجينا قلم، شيبسي بطعم الجبنة المتبلة، مسحوق غسيل، عصير، علبة بنادول، أو ورقة نقدية فئة خمسين جنيه).
2. السعر إذا كان هناك ملصق سعر أو باركود واضح، واذكر العملة بوضوح (جنيه، ريال، دولار، إلخ).
3. الحجم أو الوزن أو الطعم، وتاريخ الصلاحية أو الإنتاج إذا كان ظاهراً ومقروءاً على العبوة.
تحدث فوراً باختصار شديد وبطريقة مباشرة ومفيدة كأنك صديق بجانبه بدون أي مقدمات أو عناوين أو ماركداون. لو الشيء غير واضح أو الكاميرا بعيدة، قول له باختصار "قرب الكاميرا شوية من المنتج عشان أقرالك تفاصيله". لا تستخدم أي نجوم ماركداون نهائياً.${knownContext}`;
      } else if (targetLang === 'fr') {
        prompt = `Vous êtes un assistant d'achat vocal intelligent pour une personne malvoyante dans un magasin ou supermarché. Identifiez immédiatement le produit devant la caméra :
1. Le nom exact du produit, la marque et sa variété (ex. Lait entier Candia, paquet de biscuits, bouteille de jus, billet de 20 euros, etc.).
2. Le prix ou l'étiquette de prix si visible, en précisant la devise.
3. Le poids, volume, saveur et la date de péremption si lisible sur l'emballage.
Parlez de façon directe, concise et naturelle sans titres de section ni astérisques markdown. Si le produit est flou ou trop loin, dites gentiment d'approcher la caméra.${knownContext}`;
      } else {
        prompt = `You are a smart voice shopping assistant for a visually impaired person in a store or supermarket. Instantly identify the item or product in front of the camera:
1. Exact product name, brand, and variety (e.g. Tropicana Orange Juice No Pulp, Heinz Tomato Ketchup 500g, a $20 banknote, cereal box, etc.).
2. Price tag or cost if visible, stating the currency clearly.
3. Weight, volume, flavor, and expiration/best-by date if legible on the packaging.
Speak directly, concisely, and naturally without any headings, robotic labels, or markdown asterisks. If the item is blurry or far, advise them to bring the camera closer.${knownContext}`;
      }
    } else if (readMode) {
      if (activeReadAction === 'summarize') {
        // Summarize Mode: focus 100% on the core takeaway, bottom line, and vital substance (المفيد والزبدة الصافية)
        if (targetLang === 'ar') {
          prompt = `أنت مساعد ومعلم ذكي يتحدث بصوته لشخص كفيف ليعطيه "المفيد والزبدة الصافية" من أي نص أو محاضرة أو شريحة أو ورقة أمامه بالكاميرا.
قاعدتك الذهبية: ادخل في المفيد فوراً بدون مقدمات ولا لف ودوران:
1. المفيد أولاً: استخرج الفكرة الجوهرية والزبدة الصافية في جملة أو جملتين مباشرتين ومركزتين (إيه أهم حاجة لازم يعرفها من هذا الكلام؟).
2. التفاصيل والنتائج المهمة فقط: لو فيه قانون، تعريف أساسي، نتيجة حاسمة، تاريخ أو مبلغ مهم، أو خطوات عملية مطلوبة، قلها بوضوح واختصار.
3. ممنوع الحشو أو الكلام الإنشائي: لا تضيع وقته في جمل مثل "هذا النص يتحدث عن..." أو قراءة التفاصيل الثانوية، بل ابدأ بالمعلومة المفيدة نفسها فوراً.
4. تحدث بأسلوب صوتي ودود ومريح ومباشر بدون أي نجوم ماركداون (**) أو شرطات أو عناوين روبوتية لكي يُنطق الصوت بسلاسة وسرعة. لو مفيش نص واضح، قول له باختصار "قرب الكاميرا شوية من الورقة أو الشاشة".${knownContext}`;
        } else if (targetLang === 'fr') {
          prompt = `Vous êtes un compagnon vocal intelligent qui donne à une personne malvoyante "l'essentiel et la conclusion utile" de tout cours, diapositive ou document devant sa caméra.
Règle d'or : Allez directement à l'essentiel sans préambule ni verbiage :
1. L'essentiel d'abord : Donnez l'idée maîtresse et la conclusion clé en 1 ou 2 phrases percutantes et claires.
2. Résultats et points cruciaux uniquement : S'il y a une formule, une définition importante, une décision ou une action concrète, énoncez-la directement.
3. Zéro superflu : Ne commencez jamais par "Ce document parle de...", commencez immédiatement par l'information utile.
4. Parlez de façon fluide et naturelle sans astérisques markdown ni titres pour une lecture vocale optimale. Si c'est flou, dites simplement d'approcher la caméra.${knownContext}`;
        } else {
          prompt = `You are a smart voice tutor giving a visually impaired user the distilled bottom line and core takeaways of any lecture, slide, book, or document in front of the camera.
Golden rule: Cut straight to the bottom line and essential takeaways with zero filler:
1. The Core Takeaway First: Deliver the distilled essence and primary message in 1-2 sharp, clear, conversational sentences (what is the single most important thing they need to know?).
2. Vital Results and Key Facts: If there is a crucial formula, definition, bottom-line total, decision, or actionable step, state it directly and concisely.
3. Zero Fluff: Never waste words on preamble like "This slide is about..." or minor background details. Start right with the useful takeaway itself.
4. Speak in natural conversational prose without any markdown asterisks (**), bullet dashes, or robotic headings so speech is smooth and human. If unreadable, say "Bring the camera a bit closer to the text or screen."${knownContext}`;
        }
      } else {
        // Read Mode (Verbatim): read out all visible text word for word
        if (targetLang === 'ar') {
          prompt = `أنت تساعد شخص كفيف بقراءة نص مكتوب أمامه بالكاميرا (ممكن يكون روشتة، فاتورة كهربا أو غاز، ملصق منتج، سعر، إيصال، أو أي ورقة). اقرأ كل النص المكتوب في الصورة بالترتيب وبوضوح، كلمة بكلمة كما هو، من غير أي وصف للمشهد أو الأشياء حواليه. لو النص فيه أرقام أو تواريخ أو مبالغ، اقرأها بوضوح وبالترتيب الصحيح. لو مفيش نص واضح في الصورة، قول له بلطف "مفيش نص واضح قدامك دلوقتي، حاول تقرب الكاميرا أكتر." لا تستخدم أي عناوين أو ماركداون أو كلمة "النص المكتوب:" كعنوان.${knownContext}`;
        } else if (targetLang === 'fr') {
          prompt = `Vous aidez une personne aveugle à lire un texte visible par sa caméra (ordonnance, facture, étiquette, prix, reçu, ou tout document). Lisez tout le texte visible dans l'image, dans l'ordre, mot pour mot, sans décrire la scène ni les objets environnants. Lisez clairement les chiffres, dates et montants dans leur ordre exact. S'il n'y a pas de texte clair, dites poliment "Aucun texte clair détecté, essayez de rapprocher la caméra." N'utilisez aucun titre, markdown, ou libellé robotique.${knownContext}`;
        } else {
          prompt = `You are helping a blind person read text visible through their camera (a prescription, a utility bill, a product label, a price tag, a receipt, or any document). Read out ALL the visible text in the image, in order, word for word, without describing the scene or surrounding objects. Read any numbers, dates, or amounts clearly and in their correct order. If there is no clear text visible, gently say "No clear text detected right now, try moving the camera closer." Do NOT use any headings, markdown, or robotic labels like "Text:".${knownContext}`;
        }
      }
    } else if (targetLang === 'ar') {
      prompt = `أنت رفيق بشري يتحدث بصوته لشخص كفيف عبر الكاميرا. تحدث فوراً بلغة عربية عامية سهلة ومباشرة كأنك صديق يقف بجانبه وينظر أمامه: ادخل في الموضوع فوراً بدون أي مقدمات أو عناوين أو ماركداون. ابدأ مباشرة بجملة تطمينية سلسة إذا لم تكن هناك مخاطر، مثلاً: "مفيش أخطار حواليك، قدامك..." ثم صف الأشخاص والأشياء والأسطح والنصوص المكتوبة بشكل طبيعي وتلقائي جداً. لا تذكر كلمات مثل "المخاطر" أو "النصوص المكتوبة" أو "وصف المشهد" كعناوين، ولا تستخدم نجوم الماركداون أو الشرطات نهائياً.${knownContext}`;
    } else if (targetLang === 'fr') {
      prompt = `Vous êtes un compagnon humain chaleureux qui parle directement à voix haute à une personne aveugle à travers sa caméra. Parlez immédiatement dans un langage oral fluide, naturel et bienveillant, comme un ami à ses côtés : allez droit au but sans titres de section ni balises markdown. S'il n'y a aucun danger, commencez directement par rassurer la personne (ex. "Aucun danger autour de vous, devant vous se trouve..."). Décrivez les personnes, objets, surfaces et textes visibles de façon fluide et naturelle. N'utilisez AUCUN astérisque (**), tiret ou en-tête robotique.${knownContext}`;
    } else {
      prompt = `You are a warm, helpful human companion speaking directly aloud to a blind person through their camera. Speak immediately in fluent, natural conversational prose as if you are a friend standing right beside them: Go straight to the point without any section titles, headings, or robotic boilerplate. If there are no hazards, start directly with reassuring words (e.g. "No hazards around you. Directly in front of you is..."). Describe people, objects, surfaces, and any visible text smoothly and naturally. Do NOT use markdown asterisks (**), bullet dashes, or labels like "Hazards:", "Visible Text:", or "Scene Description:".${knownContext}`;
    }

    try {
      const cleanData = frame.replace(/^data:[^;]+;base64,/, '');
      const result = await generateAdaptiveResponse(
        prompt,
        {
          ...profile,
          language: targetLang === 'ar' ? 'Egyptian Ammiya' : targetLang === 'fr' ? 'French' : 'English',
        },
        [],
        [{ name: 'scene.jpg', type: 'image/jpeg', data: cleanData }]
      );

      if (!isMountedRef.current) return;
      const cleaned = cleanVisionDescription(result, targetLang);
      setLastDescription(cleaned);
      setStatus('ready');
      setAnnounce(cleaned);

      // Automatically extract and record spatial physical objects for this user
      if (profile?.uid) {
        const extracted = extractSpatialObjectsFromVision(cleaned, profile.uid, targetLang);
        if (extracted.length > 0) {
          recordObservedSpatialObjects(profile.uid, extracted).then(() => {
            if (isMountedRef.current && profile.uid) {
              setSpatialRecords(getSpatialObjects(profile.uid));
            }
          });
        }
      }

      // Tactile Haptic Vibration Feedback for Indoor Navigation
      if (navGuideMode) {
        const nav = parseNavGuidance(cleaned, targetLang);
        triggerHapticAlert(nav.hapticPattern);
      }

      // AUTOMATICALLY REPEAT ALOUD FROM THE VERY FIRST TIME WITHOUT USER HAVING TO ASK!
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        window.speechSynthesis.resume();
      }

      const voiceLang = targetLang === 'ar' ? 'Arabic' : targetLang === 'fr' ? 'French' : 'English';
      setTimeout(() => {
        speak(cleaned, voiceLang, {
          onStart: () => setIsSpeaking(true),
          onEnd: () => setIsSpeaking(false),
          onError: () => {
            setIsSpeaking(false);
            // Chrome speech resume recovery
            if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
              window.speechSynthesis.resume();
              setTimeout(() => speak(cleaned, voiceLang, {
                onStart: () => setIsSpeaking(true),
                onEnd: () => setIsSpeaking(false),
              }), 120);
            }
          },
        });
      }, 60);
    } catch {
      if (!isMountedRef.current) return;
      setStatus('ready');
      const err =
        targetLang === 'ar'
          ? 'حصلت مشكلة في تحليل الصورة، من فضلك جرب تاني.'
          : targetLang === 'fr'
          ? "Un problème est survenu lors de l'analyse de l'image. Veuillez réessayer."
          : 'Something went wrong analyzing the image. Please try again.';
      setLastDescription(err);
      speak(err, targetLang === 'ar' ? 'Arabic' : targetLang === 'fr' ? 'French' : 'English');
    }
  };

  const handleSearchSpatial = () => {
    if (!profile?.uid || !spatialQueryInput.trim()) return;
    const res = querySpatialMemory(profile.uid, spatialQueryInput, companionLang);
    setSpatialQueryResult(res.message);
    speak(res.message, companionLang === 'ar' ? 'Arabic' : companionLang === 'fr' ? 'French' : 'English');
  };

  const openSaveDialog = () => {
    if (!lastDescription) return;
    cancelSpeech();
    setLabelInput('');
    setShowSaveDialog(true);
  };

  const saveMemory = async () => {
    if (!labelInput.trim()) { setShowSaveDialog(false); return; }
    if (!profile?.uid) {
      // Previously this just closed the dialog with zero feedback — the
      // person types a label, hits Save, and it silently vanishes with no
      // indication it was never actually saved (not logged in). For someone
      // relying entirely on the spoken announcement, that's indistinguishable
      // from a successful save until they ask for it again and it's gone.
      setShowSaveDialog(false);
      const msg = companionLang === 'ar'
        ? 'مينفعش نحفظ من غير تسجيل دخول.'
        : "Can't save without being signed in.";
      setAnnounce(msg);
      speak(msg, companionLang === 'ar' ? 'Arabic' : 'English');
      return;
    }
    const memory: VisionMemory = {
      id: `vm_${Date.now()}`,
      label: labelInput.trim(),
      description: lastDescription,
      createdAt: new Date().toISOString(),
      memoryType: isSavingPerson ? 'person' : 'object',
      imageUrl: lastSnapshot || undefined,
    };
    const prevMemories = memories;
    const updated = [...memories, memory];
    if (setProfile) setProfile({ ...profile, visionMemories: updated });
    setShowSaveDialog(false);
    const msg = companionLang === 'ar' ? `تم الحفظ باسم "${memory.label}".` : `Saved as "${memory.label}".`;
    setAnnounce(msg);
    speak(msg, companionLang === 'ar' ? 'Arabic' : 'English');
    try {
      await setDoc(
        doc(db, `users/${profile.uid}`),
        { visionMemories: cleanDataForFirestore(updated) },
        { merge: true }
      );
    } catch (err) {
      console.warn('Failed to sync vision memory:', err);
      if (!isMountedRef.current) return;
      if (setProfile) setProfile({ ...profile, visionMemories: prevMemories });
      const errMsg =
        companionLang === 'ar'
          ? 'فشل الحفظ في السحابة. تحقق من اتصالك.'
          : 'Failed to save to cloud. Check your connection.';
      setAnnounce(errMsg);
      speak(errMsg, companionLang === 'ar' ? 'Arabic' : 'English');
    }
  };

  const deleteMemory = async (id: string) => {
    if (!profile?.uid) return;
    const prevMemories = memories;
    const updated = memories.filter((m) => m.id !== id);
    if (setProfile) setProfile({ ...profile, visionMemories: updated });
    try {
      await setDoc(
        doc(db, `users/${profile.uid}`),
        { visionMemories: cleanDataForFirestore(updated) },
        { merge: true }
      );
    } catch (err) {
      console.warn('Failed to delete vision memory:', err);
      if (isMountedRef.current && setProfile) setProfile({ ...profile, visionMemories: prevMemories });
    }
  };

  const replaySpeech = () => {
    if (!lastDescription) return;
    cancelSpeech();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.resume();
    }
    const voiceLang = companionLang === 'ar' ? 'Arabic' : companionLang === 'fr' ? 'French' : 'English';
    const cleaned = cleanVisionDescription(lastDescription, companionLang);
    setTimeout(() => {
      speak(cleaned, voiceLang, {
        onStart: () => setIsSpeaking(true),
        onEnd: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
      });
    }, 60);
  };

  // Same button toggles play/stop: if currently speaking, stop it; otherwise play it.
  const toggleSpeech = () => {
    if (isSpeaking) {
      cancelSpeech();
      setIsSpeaking(false);
    } else {
      replaySpeech();
    }
  };

  // Dismisses the current description card (and stops any speech) so the
  // user can immediately take a fresh description without it lingering.
  const closeDescription = () => {
    cancelSpeech();
    setIsSpeaking(false);
    setLastDescription('');
    setLastSnapshot(null);
  };

  return (
    <div
      ref={containerRef}
      className={`flex-1 flex flex-col h-full min-h-0 bg-black overflow-hidden relative select-none ${
        isFullscreen ? 'fixed inset-0 z-[99999]' : ''
      }`}
      dir={companionLang === 'ar' ? 'rtl' : 'ltr'}
    >
      {/* Screen-reader live region */}
      <div className="sr-only" role="status" aria-live="assertive" aria-atomic="true">
        {announce}
      </div>

      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

      {/* ── 1. FULL-SCREEN LIVE CAMERA VIEWPORT ── */}
      <div className="absolute inset-0 w-full h-full bg-black overflow-hidden flex items-center justify-center">
        {status === 'camera-denied' ? (
          <div className="text-center p-8 max-w-sm z-20">
            <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
            <p className="text-white font-bold mb-2 text-sm sm:text-base">
              {t('Camera access is needed for the Visual Companion to work.', 'محتاجين إذن الكاميرا عشان الرفيق البصري يشتغل.')}
            </p>
            <button
              onClick={() => startCamera()}
              className="mt-3 px-6 py-3 rounded-2xl bg-primary text-white font-bold text-sm shadow-xl"
            >
              {t('Try again', 'حاول تاني')}
            </button>
          </div>
        ) : status === 'unsupported' ? (
          <div className="text-center p-8 max-w-sm text-white z-20">
            <p className="text-sm font-semibold">
              {t('This device/browser does not support camera access.', 'الجهاز أو المتصفح ده مش بيدعم الوصول للكاميرا.')}
            </p>
          </div>
        ) : (
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        )}

        {status === 'starting-camera' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
          </div>
        )}
      </div>

      {/* ── 2. ACCESSIBLE FLOATING HUD OVERLAY ── */}
      <div className="relative z-20 flex flex-col justify-between h-full p-3 sm:p-5 md:p-6 pointer-events-none">
        {/* Floating Top Command Bar */}
        <div className="pointer-events-auto flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
          {/* Three Language Choices: Arabic, English, French */}
          <div className="flex items-center bg-black/75 backdrop-blur-xl border border-white/20 p-1 rounded-2xl shadow-2xl">
            <button
              onClick={() => {
                chooseLang('ar');
                toast.success('تم اختيار اللغة العربية 🇪🇬');
              }}
              className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs sm:text-sm font-black flex items-center gap-1 transition-all ${
                companionLang === 'ar'
                  ? 'bg-emerald-600 text-white shadow-lg'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <span>🇪🇬</span>
              <span>عربي</span>
            </button>
            <button
              onClick={() => {
                chooseLang('en');
                toast.success('English language selected 🇬🇧');
              }}
              className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs sm:text-sm font-black flex items-center gap-1 transition-all ${
                companionLang === 'en'
                  ? 'bg-primary text-white shadow-lg'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <span>🇬🇧</span>
              <span>English</span>
            </button>
            <button
              onClick={() => {
                chooseLang('fr');
                toast.success('Langue française sélectionnée 🇫🇷');
              }}
              className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs sm:text-sm font-black flex items-center gap-1 transition-all ${
                companionLang === 'fr'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <span>🇫🇷</span>
              <span>Français</span>
            </button>
          </div>

          {/* Right Utilities: Modes + Spatial Memory + Flip Camera + Fullscreen */}
          <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap justify-end">
            <button
              onClick={toggleCurrencyMode}
              aria-pressed={currencyMode}
              aria-label={t('Currency Reader', 'قارئ العملات', 'Lecteur de monnaie')}
              className={`px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-2xl backdrop-blur-xl border shadow-lg active:scale-95 transition-all flex items-center gap-1.5 text-xs font-bold ${
                currencyMode
                  ? 'bg-emerald-500/90 border-emerald-300 text-black shadow-emerald-950/50'
                  : 'bg-black/75 border-emerald-500/40 text-white hover:bg-black/90'
              }`}
              title={t(
                'Currency Reader: detect banknotes and cash instantly',
                'قارئ العملات: قراءة الفلوس والنقود فوراً بالصوت',
                'Lecteur de monnaie : reconnaître les billets'
              )}
            >
              <Banknote className={`w-4 h-4 shrink-0 ${currencyMode ? 'text-black' : 'text-emerald-400'}`} />
              <span className="hidden xl:inline">{t('Cash', 'فلوس', 'Monnaie')}</span>
            </button>

            <button
              onClick={toggleFaceMode}
              aria-pressed={faceMode}
              aria-label={t('Face Recognition', 'من أمامي؟', 'Qui est là ?')}
              className={`px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-2xl backdrop-blur-xl border shadow-lg active:scale-95 transition-all flex items-center gap-1.5 text-xs font-bold ${
                faceMode
                  ? 'bg-blue-600/90 border-blue-300 text-white shadow-blue-950/50'
                  : 'bg-black/75 border-blue-500/40 text-white hover:bg-black/90'
              }`}
              title={t(
                'Face Recognition: identify familiar people and faces',
                'من أمامي: التعرف على الوجوه والمقربين والأشخاص',
                'Reconnaissance faciale : identifier les proches'
              )}
            >
              <Users className={`w-4 h-4 shrink-0 ${faceMode ? 'text-white' : 'text-blue-400'}`} />
              <span className="hidden xl:inline">{t('People', 'وجوه', 'Visages')}</span>
            </button>

            <button
              onClick={toggleOutfitMode}
              aria-pressed={outfitMode}
              aria-label={t('Color & Outfit Matcher', 'تنسيق الملابس والألوان', 'Style & Couleurs')}
              className={`px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-2xl backdrop-blur-xl border shadow-lg active:scale-95 transition-all flex items-center gap-1.5 text-xs font-bold ${
                outfitMode
                  ? 'bg-pink-600/90 border-pink-300 text-white shadow-pink-950/50'
                  : 'bg-black/75 border-pink-500/40 text-white hover:bg-black/90'
              }`}
              title={t(
                'Color & Outfit Matcher: match clothing colors and check style',
                'تنسيق الملابس: فحص ألوان الملابس وتناسق الطقم',
                'Harmonie des vêtements : vérifier les couleurs et le style'
              )}
            >
              <Palette className={`w-4 h-4 shrink-0 ${outfitMode ? 'text-white' : 'text-pink-400'}`} />
              <span className="hidden xl:inline">{t('Outfit', 'ملابس', 'Tenue')}</span>
            </button>

            <button
              onClick={toggleNavGuideMode}
              aria-pressed={navGuideMode}
              aria-label={t('Indoor Cane & Nav', 'عصا الملاحة', 'Canne virtuelle')}
              className={`px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-2xl backdrop-blur-xl border shadow-lg active:scale-95 transition-all flex items-center gap-1.5 text-xs font-bold ${
                navGuideMode
                  ? 'bg-cyan-500/90 border-cyan-300 text-black shadow-cyan-950/50 animate-pulse'
                  : 'bg-black/75 border-cyan-500/40 text-white hover:bg-black/90'
              }`}
              title={t(
                'Indoor Cane: detect pathway, obstacles, and steps with haptic vibration',
                'العصا الذكية: كشف العوائق والممرات مع تنبيهات اهتزازية',
                'Canne virtuelle : obstacles et marches avec vibrations haptiques'
              )}
            >
              <Compass className={`w-4 h-4 shrink-0 ${navGuideMode ? 'text-black' : 'text-cyan-400'}`} />
              <span className="hidden xl:inline">{t('Cane', 'عصا', 'Canne')}</span>
            </button>

            <button
              onClick={toggleReadMode}
              aria-pressed={readMode}
              aria-label={t('Read Mode', 'وضع القراءة', 'Mode lecture')}
              className={`px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-2xl backdrop-blur-xl border shadow-lg active:scale-95 transition-all flex items-center gap-1.5 text-xs font-bold ${
                readMode
                  ? 'bg-amber-500/90 border-amber-300 text-black'
                  : 'bg-black/75 border-amber-500/40 text-white hover:bg-black/90'
              }`}
              title={t(
                'Read Mode: read prescriptions, bills, labels aloud',
                'وضع القراءة: اقرأ الروشتة، الفاتورة، الملصقات بصوت عالي',
                'Mode lecture : lire les ordonnances, factures, étiquettes'
              )}
            >
              <BookOpen className={`w-4 h-4 shrink-0 ${readMode ? 'text-black' : 'text-amber-400'}`} />
              <span className="hidden xl:inline">{t('Read Mode', 'اقرأ لي', 'Lecture')}</span>
            </button>

            <button
              onClick={toggleShoppingMode}
              aria-pressed={shoppingMode}
              aria-label={t('Shopping Assistant', 'مساعد التسوق', 'Assistant Achat')}
              className={`px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-2xl backdrop-blur-xl border shadow-lg active:scale-95 transition-all flex items-center gap-1.5 text-xs font-bold ${
                shoppingMode
                  ? 'bg-purple-600/90 border-purple-300 text-white shadow-purple-950/50'
                  : 'bg-black/75 border-purple-500/40 text-white hover:bg-black/90'
              }`}
              title={t(
                'Shopping Assistant: identify products, prices, and expiry dates',
                'مساعد التسوق: فحص المنتجات والأسعار وتواريخ الصلاحية',
                'Assistant achat : identifier produits, prix et dates de péremption'
              )}
            >
              <ShoppingBag className={`w-4 h-4 shrink-0 ${shoppingMode ? 'text-white' : 'text-purple-400'}`} />
              <span className="hidden xl:inline">{t('Shopping', 'تسوق', 'Achats')}</span>
            </button>

            <button
              onClick={() => {
                setShowSpatialMemory(true);
                if (profile?.uid) setSpatialRecords(getSpatialObjects(profile.uid));
                announceFeature('الذاكرة المكانية وحاجتي فين', 'Spatial Memory Object Locator', 'Localisation des Objets', true);
              }}
              aria-label={t('Spatial Memory', 'الذاكرة المكانية', 'Mémoire spatiale')}
              className="px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-2xl bg-black/75 text-white backdrop-blur-xl border border-emerald-500/40 hover:bg-black/90 shadow-lg active:scale-95 transition-all flex items-center gap-1.5 text-xs font-bold"
              title={t('Spatial Memory: Where are my things?', 'الذاكرة المكانية: حاجتي فين؟', 'Mémoire spatiale : Où sont mes affaires ?')}
            >
              <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="hidden xl:inline">{t('Where is my stuff?', 'حاجتي فين؟', 'Où est mon objet ?')}</span>
              {spatialRecords.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </button>

            <button
              onClick={() => setShowDocumentReader(true)}
              aria-label={t('Documents', 'مستندات', 'Documents')}
              className="px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-2xl bg-black/75 text-white backdrop-blur-xl border border-cyan-500/40 hover:bg-black/90 shadow-lg active:scale-95 transition-all flex items-center gap-1.5 text-xs font-bold"
              title={t(
                'Documents: read/summarize a PDF and convert it to Word, plus speech-to-text',
                'مستندات: اقرأ أو لخّص ملف PDF وحوّليه لوورد، وحوّلي الصوت لنص',
                'Documents : lire/résumer un PDF et le convertir en Word, plus la reconnaissance vocale'
              )}
            >
              <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
              <span className="hidden xl:inline">{t('Documents', 'مستندات', 'Documents')}</span>
            </button>

            {(status === 'ready' || status === 'analyzing') && (
              <button
                onClick={flipCamera}
                aria-label={t('Switch camera', 'بدّل الكاميرا', 'Changer de caméra')}
                className="p-2 sm:p-2.5 rounded-2xl bg-black/65 text-white backdrop-blur-xl border border-white/20 hover:bg-black/85 shadow-lg active:scale-95 transition-all"
                title={t('Switch Camera', 'تبديل الكاميرا أمامي/خلفي', 'Changer de caméra')}
              >
                <Camera className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            )}

            <button
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              className="p-2 sm:p-2.5 rounded-2xl bg-black/65 text-white backdrop-blur-xl border border-white/20 hover:bg-black/85 shadow-lg active:scale-95 transition-all"
              title={isFullscreen ? 'خروج من ملء الشاشة' : 'تكبير ملء الشاشة'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4 sm:w-5 sm:h-5" /> : <Maximize2 className="w-4 h-4 sm:w-5 sm:h-5" />}
            </button>
          </div>
        </div>

        {/* Sub-selector for Read Mode: Lecture/Text Summary vs Full Reading */}
        <AnimatePresence>
          {readMode && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              className="pointer-events-auto flex items-center justify-center gap-1.5 mt-2 bg-black/85 backdrop-blur-2xl border border-amber-500/50 p-1 rounded-2xl w-fit mx-auto shadow-2xl z-30"
            >
              <button
                onClick={() => setReadAction('summarize')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  readAction === 'summarize'
                    ? 'bg-amber-500 text-black shadow-md'
                    : 'text-amber-200/80 hover:text-white'
                }`}
                title={t(
                  'Summarize the core takeaways and bottom line',
                  'المفيد وخلاصة الكلام من المحاضرة أو النص',
                  'L\'essentiel et conclusion clé'
                )}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>{t('Core Takeaway', 'المفيد والخلاصة', 'L\'essentiel')}</span>
              </button>
              <button
                onClick={() => setReadAction('read')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  readAction === 'read'
                    ? 'bg-amber-500 text-black shadow-md'
                    : 'text-amber-200/80 hover:text-white'
                }`}
                title={t(
                  'Read full text word for word',
                  'قراءة النص كاملاً كلمة بكلمة',
                  'Lire le texte intégral mot à mot'
                )}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>{t('Full Reading', 'قراءة كاملة', 'Lecture intégrale')}</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Center Region: Analysis Indicator or Live Description Card */}
        <div className="my-auto flex flex-col items-center justify-center px-2 py-3 w-full">
          {status === 'analyzing' && (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-black/85 backdrop-blur-2xl border border-primary/50 text-white px-6 py-4 rounded-3xl flex items-center gap-3.5 shadow-2xl pointer-events-auto"
            >
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
              <span className="text-sm sm:text-base font-bold">
                {companionLang === 'ar' ? 'بحلل اللي قدامك في الكاميرا...' : "Analyzing what's in front of you..."}
              </span>
            </motion.div>
          )}

          {lastDescription && status !== 'analyzing' && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="relative w-full max-w-2xl pointer-events-auto"
            >
              <button
                onClick={closeDescription}
                aria-label={t('Close', 'إغلاق', 'Fermer')}
                title={companionLang === 'ar' ? 'إغلاق ووصف جديد' : companionLang === 'fr' ? 'Fermer et faire une nouvelle description' : 'Close and take a new description'}
                className="absolute -top-3 -right-3 w-9 h-9 rounded-full bg-red-500 hover:bg-red-400 border-2 border-white text-white flex items-center justify-center shadow-xl transition-colors z-20"
              >
                <X className="w-5 h-5" strokeWidth={3} />
              </button>

              <div className="bg-black/80 backdrop-blur-2xl border border-white/20 text-white rounded-3xl p-4 sm:p-5 shadow-2xl pointer-events-auto space-y-2.5 max-h-56 overflow-y-auto custom-scrollbar">
                <div className="flex items-center justify-between text-xs text-slate-300 border-b border-white/10 pb-2 pr-2 gap-2 flex-wrap">
                  <span className="font-bold flex items-center gap-1.5 text-primary">
                    <Sparkles className="w-4 h-4" />
                    {readMode && readAction === 'summarize'
                      ? (companionLang === 'ar' ? 'المفيد وخلاصة الكلام' : companionLang === 'fr' ? 'L\'essentiel et conclusion' : 'Core Takeaways & Bottom Line')
                      : (companionLang === 'ar' ? 'الوصف الصوتي التلقائي' : 'Spoken Audio Description')}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {readMode && lastSnapshot && (
                      <button
                        onClick={() => {
                          const nextAction = readAction === 'read' ? 'summarize' : 'read';
                          describeScene(companionLang, lastSnapshot, nextAction);
                        }}
                        className="flex items-center gap-1.5 font-bold text-xs px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 transition-colors"
                        title={
                          readAction === 'read'
                            ? t('Get core takeaways and bottom line', 'المفيد وخلاصة هذا الكلام', 'L\'essentiel de ce texte')
                            : t('Read full text word for word', 'قراءة النص كاملاً كلمة بكلمة', 'Lire le texte intégral')
                        }
                      >
                        {readAction === 'read' ? (
                          <>
                            <GraduationCap className="w-3.5 h-3.5" />
                            <span>{t('Core Takeaways', 'هات المفيد', 'L\'essentiel')}</span>
                          </>
                        ) : (
                          <>
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>{t('Full Text', 'قراءة كاملة', 'Texte complet')}</span>
                          </>
                        )}
                      </button>
                    )}
                    <button
                      onClick={toggleSpeech}
                      className={`flex items-center gap-1.5 font-bold text-xs px-3 py-1.5 rounded-xl transition-colors ${
                        isSpeaking
                          ? 'bg-red-500/20 hover:bg-red-500/30 text-red-300'
                          : 'bg-white/10 hover:bg-white/20 text-white hover:text-emerald-400'
                      }`}
                    >
                      {isSpeaking ? (
                        <VolumeX className="w-4 h-4 text-red-400" />
                      ) : (
                        <Volume2 className="w-4 h-4 text-emerald-400" />
                      )}
                      {isSpeaking
                        ? (companionLang === 'ar' ? 'وقف الصوت' : companionLang === 'fr' ? 'Muet' : 'Stop')
                        : (companionLang === 'ar' ? 'إعادة النطق الصوتي' : companionLang === 'fr' ? 'Répéter' : 'Repeat Aloud')}
                    </button>
                  </div>
                </div>
                <p className="text-sm sm:text-base text-slate-100 leading-relaxed font-medium">
                  {lastDescription}
                </p>
              </div>
            </motion.div>
          )}

        </div>


        {/* Floating Bottom Action Dock */}
        <div className="pointer-events-auto space-y-2.5 max-w-2xl mx-auto w-full">
          {/* Primary Action: only the button matching the currently selected language shows */}
          <div className="grid grid-cols-1 gap-2 sm:gap-2.5">
            {companionLang === 'ar' && (() => {
              const getCfg = () => {
                if (currencyMode) return {
                  icon: <Banknote className="w-5 h-5 shrink-0" />,
                  gradient: 'bg-gradient-to-r from-emerald-600 to-green-700 hover:from-emerald-500 hover:to-green-600 border border-emerald-400/40 shadow-emerald-950/60',
                  title: '🇪🇬 فحص وقراءة النقود',
                  subtitle: 'كشف فئات الجنيه والعملات بالصوت',
                };
                if (faceMode) return {
                  icon: <Users className="w-5 h-5 shrink-0" />,
                  gradient: 'bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 border border-blue-400/40 shadow-blue-950/60',
                  title: '🇪🇬 من يقف أمامي؟',
                  subtitle: 'التعرف على الأشخاص والوجوه بالصوت',
                };
                if (outfitMode) return {
                  icon: <Palette className="w-5 h-5 shrink-0" />,
                  gradient: 'bg-gradient-to-r from-pink-600 to-rose-700 hover:from-pink-500 hover:to-rose-600 border border-pink-400/40 shadow-pink-950/60',
                  title: '🇪🇬 فحص ألوان الملابس',
                  subtitle: 'تناسق الطقم والألوان بالصوت',
                };
                if (navGuideMode) return {
                  icon: <Compass className="w-5 h-5 shrink-0" />,
                  gradient: 'bg-gradient-to-r from-cyan-600 to-teal-700 hover:from-cyan-500 hover:to-teal-600 border border-cyan-400/40 shadow-cyan-950/60 animate-pulse',
                  title: '🇪🇬 فحص المسار والعوائق',
                  subtitle: 'العصا الافتراضية مع تنبيه اهتزازي',
                };
                if (shoppingMode) return {
                  icon: <ShoppingBag className="w-5 h-5 shrink-0" />,
                  gradient: 'bg-gradient-to-r from-purple-600 to-indigo-700 hover:from-purple-500 hover:to-indigo-600 border border-purple-400/40 shadow-purple-950/60',
                  title: '🇪🇬 فحص المنتج والتسوق',
                  subtitle: 'مساعد التسوق والأسعار',
                };
                if (readMode) return {
                  icon: readAction === 'summarize' ? <GraduationCap className="w-5 h-5 shrink-0" /> : <BookOpen className="w-5 h-5 shrink-0" />,
                  gradient: 'bg-gradient-to-r from-amber-600 to-orange-700 hover:from-amber-500 hover:to-orange-600 border border-amber-400/40 shadow-amber-950/60',
                  title: readAction === 'summarize' ? '🇪🇬 المفيد وخلاصة الكلام' : '🇪🇬 اقرأ اللي قدامي',
                  subtitle: readAction === 'summarize' ? 'الزبدة وأهم نقطة بالصوت' : 'قراءة نص بالصوت كلمة بكلمة',
                };
                return {
                  icon: <Camera className="w-5 h-5 shrink-0" />,
                  gradient: 'bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 border border-emerald-400/40 shadow-emerald-950/60',
                  title: '🇪🇬 ماذا أمامي؟',
                  subtitle: 'وصف فوري بالصوت',
                };
              };
              const cfg = getCfg();
              return (
                <button
                  onClick={() => describeScene('ar')}
                  disabled={status === 'analyzing' || status === 'starting-camera'}
                  className={`w-full min-h-[58px] sm:min-h-[66px] rounded-2xl text-white font-black text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-2xl active:scale-[0.98] transition-all disabled:opacity-50 ${cfg.gradient}`}
                >
                  {cfg.icon}
                  <div className="flex flex-col items-start sm:items-center text-start sm:text-center leading-tight">
                    <span>{cfg.title}</span>
                    <span className="text-[10px] font-normal opacity-90">{cfg.subtitle}</span>
                  </div>
                </button>
              );
            })()}

            {companionLang === 'en' && (() => {
              const getCfg = () => {
                if (currencyMode) return {
                  icon: <Banknote className="w-5 h-5 shrink-0" />,
                  gradient: 'bg-gradient-to-r from-emerald-600 to-green-700 hover:from-emerald-500 hover:to-green-600 border border-emerald-400/40 shadow-emerald-950/60',
                  title: '🇬🇧 Scan Cash & Currency',
                  subtitle: 'Instant denomination audio reader',
                };
                if (faceMode) return {
                  icon: <Users className="w-5 h-5 shrink-0" />,
                  gradient: 'bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 border border-blue-400/40 shadow-blue-950/60',
                  title: '🇬🇧 Who is in front of me?',
                  subtitle: 'Face & familiar person recognition',
                };
                if (outfitMode) return {
                  icon: <Palette className="w-5 h-5 shrink-0" />,
                  gradient: 'bg-gradient-to-r from-pink-600 to-rose-700 hover:from-pink-500 hover:to-rose-600 border border-pink-400/40 shadow-pink-950/60',
                  title: '🇬🇧 Check Outfit & Colors',
                  subtitle: 'Color matching & style harmony',
                };
                if (navGuideMode) return {
                  icon: <Compass className="w-5 h-5 shrink-0" />,
                  gradient: 'bg-gradient-to-r from-cyan-600 to-teal-700 hover:from-cyan-500 hover:to-teal-600 border border-cyan-400/40 shadow-cyan-950/60 animate-pulse',
                  title: '🇬🇧 Scan Pathway & Obstacles',
                  subtitle: 'Virtual cane with haptic feedback',
                };
                if (shoppingMode) return {
                  icon: <ShoppingBag className="w-5 h-5 shrink-0" />,
                  gradient: 'bg-gradient-to-r from-purple-600 to-indigo-700 hover:from-purple-500 hover:to-indigo-600 border border-purple-400/40 shadow-purple-950/60',
                  title: '🇬🇧 Scan product & price',
                  subtitle: 'Shopping assistant',
                };
                if (readMode) return {
                  icon: readAction === 'summarize' ? <GraduationCap className="w-5 h-5 shrink-0" /> : <BookOpen className="w-5 h-5 shrink-0" />,
                  gradient: 'bg-gradient-to-r from-amber-600 to-orange-700 hover:from-amber-500 hover:to-orange-600 border border-amber-400/40 shadow-amber-950/60',
                  title: readAction === 'summarize' ? '🇬🇧 Core takeaways & bottom line' : '🇬🇧 Read this for me',
                  subtitle: readAction === 'summarize' ? 'Distilled essence & spoken facts' : 'Spoken text reading',
                };
                return {
                  icon: <Camera className="w-5 h-5 shrink-0" />,
                  gradient: 'bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/90 hover:to-indigo-500 border border-primary/40 shadow-indigo-950/60',
                  title: '🇬🇧 What is here?',
                  subtitle: 'Spoken English',
                };
              };
              const cfg = getCfg();
              return (
                <button
                  onClick={() => describeScene('en')}
                  disabled={status === 'analyzing' || status === 'starting-camera'}
                  className={`w-full min-h-[58px] sm:min-h-[66px] rounded-2xl text-white font-black text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-2xl active:scale-[0.98] transition-all disabled:opacity-50 ${cfg.gradient}`}
                >
                  {cfg.icon}
                  <div className="flex flex-col items-start sm:items-center text-start sm:text-center leading-tight">
                    <span>{cfg.title}</span>
                    <span className="text-[10px] font-normal opacity-90">{cfg.subtitle}</span>
                  </div>
                </button>
              );
            })()}

            {companionLang === 'fr' && (() => {
              const getCfg = () => {
                if (currencyMode) return {
                  icon: <Banknote className="w-5 h-5 shrink-0" />,
                  gradient: 'bg-gradient-to-r from-emerald-600 to-green-700 hover:from-emerald-500 hover:to-green-600 border border-emerald-400/40 shadow-emerald-950/60',
                  title: '🇫🇷 Scanner Billets & Devises',
                  subtitle: 'Lecture audio de la monnaie',
                };
                if (faceMode) return {
                  icon: <Users className="w-5 h-5 shrink-0" />,
                  gradient: 'bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 border border-blue-400/40 shadow-blue-950/60',
                  title: '🇫🇷 Qui est devant moi ?',
                  subtitle: 'Reconnaissance faciale et proches',
                };
                if (outfitMode) return {
                  icon: <Palette className="w-5 h-5 shrink-0" />,
                  gradient: 'bg-gradient-to-r from-pink-600 to-rose-700 hover:from-pink-500 hover:to-rose-600 border border-pink-400/40 shadow-pink-950/60',
                  title: '🇫🇷 Harmonie des Vêtements',
                  subtitle: 'Accord des couleurs et tenue',
                };
                if (navGuideMode) return {
                  icon: <Compass className="w-5 h-5 shrink-0" />,
                  gradient: 'bg-gradient-to-r from-cyan-600 to-teal-700 hover:from-cyan-500 hover:to-teal-600 border border-cyan-400/40 shadow-cyan-950/60 animate-pulse',
                  title: '🇫🇷 Scanner Chemin & Obstacles',
                  subtitle: 'Canne virtuelle avec retour haptique',
                };
                if (shoppingMode) return {
                  icon: <ShoppingBag className="w-5 h-5 shrink-0" />,
                  gradient: 'bg-gradient-to-r from-purple-600 to-indigo-700 hover:from-purple-500 hover:to-indigo-600 border border-purple-400/40 shadow-purple-950/60',
                  title: '🇫🇷 Scanner produit & prix',
                  subtitle: 'Assistant achat',
                };
                if (readMode) return {
                  icon: readAction === 'summarize' ? <GraduationCap className="w-5 h-5 shrink-0" /> : <BookOpen className="w-5 h-5 shrink-0" />,
                  gradient: 'bg-gradient-to-r from-amber-600 to-orange-700 hover:from-amber-500 hover:to-orange-600 border border-amber-400/40 shadow-amber-950/60',
                  title: readAction === 'summarize' ? "🇫🇷 L'essentiel & conclusion" : '🇫🇷 Lisez ceci',
                  subtitle: readAction === 'summarize' ? 'Synthèse utile & conclusion vocale' : 'Lecture du texte',
                };
                return {
                  icon: <Camera className="w-5 h-5 shrink-0" />,
                  gradient: 'bg-gradient-to-r from-blue-600 to-cyan-700 hover:from-blue-500 hover:to-cyan-600 border border-blue-400/40 shadow-blue-950/60',
                  title: '🇫🇷 Que vois-je ?',
                  subtitle: 'Vocal en français',
                };
              };
              const cfg = getCfg();
              return (
                <button
                  onClick={() => describeScene('fr')}
                  disabled={status === 'analyzing' || status === 'starting-camera'}
                  className={`w-full min-h-[58px] sm:min-h-[66px] rounded-2xl text-white font-black text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-2xl active:scale-[0.98] transition-all disabled:opacity-50 ${cfg.gradient}`}
                >
                  {cfg.icon}
                  <div className="flex flex-col items-start sm:items-center text-start sm:text-center leading-tight">
                    <span>{cfg.title}</span>
                    <span className="text-[10px] font-normal opacity-90">{cfg.subtitle}</span>
                  </div>
                </button>
              );
            })()}
          </div>

          {/* Secondary Controls Bar */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={toggleSpeech}
              disabled={!lastDescription}
              className={`flex-1 min-h-[46px] rounded-xl backdrop-blur-xl border text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40 shadow-lg active:scale-95 ${
                isSpeaking
                  ? 'bg-red-500/30 hover:bg-red-500/40 border-red-400/40'
                  : 'bg-black/70 hover:bg-black/90 border-white/20'
              }`}
            >
              {isSpeaking ? (
                <VolumeX className="w-4 h-4 text-red-300" />
              ) : (
                <Volume2 className="w-4 h-4 text-emerald-400" />
              )}
              <span>
                {isSpeaking
                  ? (companionLang === 'ar' ? 'وقف الصوت' : companionLang === 'fr' ? 'Muet' : 'Stop voice')
                  : (companionLang === 'ar' ? 'كرر بالصوت' : companionLang === 'fr' ? 'Répéter' : 'Repeat aloud')}
              </span>
            </button>

            <button
              onClick={openSaveDialog}
              disabled={!lastDescription}
              className="flex-1 min-h-[46px] rounded-xl bg-black/70 hover:bg-black/90 backdrop-blur-xl border border-white/20 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40 shadow-lg active:scale-95"
            >
              <BookmarkPlus className="w-4 h-4 text-amber-400" />
              <span>{companionLang === 'ar' ? 'احفظ ده' : companionLang === 'fr' ? 'Mémoriser' : 'Remember this'}</span>
            </button>

            <button
              onClick={() => {
                setShowSpatialMemory(true);
                if (profile?.uid) setSpatialRecords(getSpatialObjects(profile.uid));
              }}
              className="px-3 min-h-[46px] rounded-xl bg-black/70 hover:bg-black/90 backdrop-blur-xl border border-emerald-500/40 text-emerald-400 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all shadow-lg active:scale-95"
              title={companionLang === 'ar' ? 'الذاكرة المكانية' : companionLang === 'fr' ? 'Mémoire spatiale' : 'Spatial Memory'}
            >
              <MapPin className="w-4 h-4" />
              <span>📍 {spatialRecords.length}</span>
            </button>
          </div>
        </div>
      </div>

      {/* First-Launch Language Picker — shown once until a language is chosen */}
      <AnimatePresence>
        {!langChosen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="lang-picker-title"
              initial={{ y: 30, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 30, opacity: 0 }}
              className="w-full max-w-sm bg-slate-900 rounded-3xl p-6 space-y-5 border border-slate-800 shadow-2xl text-white text-center"
            >
              <div className="space-y-1.5">
                <h3 id="lang-picker-title" className="font-black text-lg">
                  اختر لغتك / Choose your language / Choisissez votre langue
                </h3>
                <p className="text-xs text-slate-400">
                  هتقدر تغيرها في أي وقت من فوق · You can change it anytime · Vous pouvez la changer à tout moment
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                <button
                  onClick={() => {
                    chooseLang('ar');
                    toast.success('تم اختيار اللغة العربية 🇪🇬');
                  }}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-black text-base flex items-center justify-center gap-2 shadow-xl active:scale-[0.98] transition-all"
                >
                  <span>🇪🇬</span>
                  <span>العربية</span>
                </button>
                <button
                  onClick={() => {
                    chooseLang('en');
                    toast.success('English language selected 🇬🇧');
                  }}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/90 hover:to-indigo-500 text-white font-black text-base flex items-center justify-center gap-2 shadow-xl active:scale-[0.98] transition-all"
                >
                  <span>🇬🇧</span>
                  <span>English</span>
                </button>
                <button
                  onClick={() => {
                    chooseLang('fr');
                    toast.success('Langue française sélectionnée 🇫🇷');
                  }}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-700 hover:from-blue-500 hover:to-cyan-600 text-white font-black text-base flex items-center justify-center gap-2 shadow-xl active:scale-[0.98] transition-all"
                >
                  <span>🇫🇷</span>
                  <span>Français</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* "Remember this as..." Dialog Modal */}
      <AnimatePresence>
        {showSaveDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-4"
            onClick={() => setShowSaveDialog(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="save-dialog-title"
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-md bg-slate-900 rounded-3xl p-5 sm:p-6 space-y-4 border border-slate-800 shadow-2xl text-white"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 id="save-dialog-title" className="font-bold text-base text-white flex items-center gap-2">
                  <BookmarkPlus className="w-5 h-5 text-amber-400" />
                  {companionLang === 'ar' ? 'احفظ العنصر أو الشخص باسم...' : companionLang === 'fr' ? 'Enregistrer cet élément comme...' : 'Remember this as...'}
                </h3>
                <button
                  onClick={() => setShowSaveDialog(false)}
                  aria-label={t('Close', 'إغلاق', 'Fermer')}
                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Type Switcher: Object vs Person */}
              <div className="flex gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsSavingPerson(false)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    !isSavingPerson ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {companionLang === 'ar' ? '📦 شيء أو غرض' : companionLang === 'fr' ? '📦 Objet' : '📦 Object / Item'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsSavingPerson(true)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    isSavingPerson ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {companionLang === 'ar' ? '👤 شخص أو صديق' : companionLang === 'fr' ? '👤 Personne' : '👤 Person / Friend'}
                </button>
              </div>

              <input
                autoFocus
                type="text"
                aria-label={t('Memory label', 'اسم العنصر', "Nom de l'élément")}
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveMemory();
                }}
                placeholder={
                  isSavingPerson
                    ? (companionLang === 'ar' ? 'اسم الشخص (مثلاً: "ماما"، "أحمد"، "دكتور طارق")' : companionLang === 'fr' ? 'Nom de la personne (ex. "Maman", "Ahmed")' : 'Person name (e.g. "Mom", "Ahmed")')
                    : (companionLang === 'ar' ? 'مثلاً: "دوا الضغط" أو "مفاتيحي"' : companionLang === 'fr' ? 'ex. "Mes clés", "Médicament"' : 'e.g. "My Keys", "Coffee Mug"')
                }
                className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-950 text-white placeholder-slate-500 focus:ring-2 focus:ring-primary outline-none text-sm"
              />

              <div className="flex gap-2.5">
                <button
                  onClick={() => setShowSaveDialog(false)}
                  className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
                >
                  {companionLang === 'ar' ? 'إلغاء' : companionLang === 'fr' ? 'Annuler' : 'Cancel'}
                </button>
                <button
                  onClick={saveMemory}
                  disabled={!labelInput.trim()}
                  className="flex-1 py-3 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-xs disabled:opacity-50"
                >
                  {companionLang === 'ar' ? 'حفظ وتثبيت' : companionLang === 'fr' ? 'Enregistrer' : 'Save Memory'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spatial Memory Query & List Modal */}
      <AnimatePresence>
        {showSpatialMemory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-3 sm:p-4"
            onClick={() => setShowSpatialMemory(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="spatial-dialog-title"
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-lg bg-slate-900 rounded-3xl p-5 sm:p-6 space-y-4 border border-slate-800 shadow-2xl text-white max-h-[85vh] flex flex-col"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-emerald-400" />
                  <h3 id="spatial-dialog-title" className="font-bold text-base text-white">
                    {companionLang === 'ar' ? 'الذاكرة المكانية للأشياء' : companionLang === 'fr' ? 'Mémoire Spatiale des Objets' : 'Spatial Memory of Objects'}
                  </h3>
                </div>
                <button
                  onClick={() => setShowSpatialMemory(false)}
                  aria-label={t('Close', 'إغلاق', 'Fermer')}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Query Input */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-semibold">
                  {companionLang === 'ar'
                    ? 'اسأل عن مكان أي شيء (مثلاً: "فين الريموت؟" أو "فين المفاتيح؟"):'
                    : companionLang === 'fr'
                    ? "Demandez où se trouve un objet (ex. 'Où est la télécommande ?') :"
                    : "Ask where an item is located (e.g. 'Where is the remote?'):"}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={spatialQueryInput}
                    onChange={(e) => setSpatialQueryInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSearchSpatial();
                    }}
                    placeholder={
                      companionLang === 'ar'
                        ? 'فين ريموت التلفزيون؟'
                        : companionLang === 'fr'
                        ? 'Où est la télécommande ?'
                        : 'Where is the TV remote?'
                    }
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-white placeholder-slate-500 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    onClick={handleSearchSpatial}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm flex items-center gap-1.5 shadow-lg active:scale-95 transition-all"
                  >
                    <Search className="w-4 h-4" />
                    <span>{companionLang === 'ar' ? 'بحث' : companionLang === 'fr' ? 'Chercher' : 'Search'}</span>
                  </button>
                </div>
              </div>

              {spatialQueryResult && (
                <div className="p-3.5 rounded-2xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-200 text-sm leading-relaxed flex items-start gap-2.5">
                  <Volume2 className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold">{spatialQueryResult}</p>
                    <button
                      onClick={() => speak(spatialQueryResult, companionLang === 'ar' ? 'Arabic' : companionLang === 'fr' ? 'French' : 'English')}
                      className="mt-2 text-xs font-bold text-emerald-300 hover:text-emerald-100 underline flex items-center gap-1"
                    >
                      <span>{companionLang === 'ar' ? 'استمع مرة أخرى' : companionLang === 'fr' ? 'Réécouter' : 'Listen again'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* List of remembered items */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[140px]">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span>{companionLang === 'ar' ? 'الأشياء المرصودة مؤخراً' : companionLang === 'fr' ? 'Objets récemment observés' : 'Recently Observed Items'}</span>
                  <span className="text-[11px] font-mono text-emerald-400">{spatialRecords.length} items</span>
                </div>

                {spatialRecords.length === 0 ? (
                  <div className="text-center py-6 text-slate-500 text-xs">
                    {companionLang === 'ar'
                      ? 'لم يتم رصد أي أشياء بعد. وجّه الكاميرا إلى الغرفة واضغط على زر الفحص لتسجيل الأماكن تلقائياً.'
                      : companionLang === 'fr'
                      ? 'Aucun objet observé pour le moment. Pointez la caméra et appuyez sur "Que vois-je ?" pour mémoriser les emplacements.'
                      : 'No objects observed yet. Point the camera and tap any scan button to record locations automatically.'}
                  </div>
                ) : (
                  spatialRecords.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        const query = querySpatialMemory(profile?.uid || '', item.objectName, companionLang);
                        setSpatialQueryResult(query.message);
                        speak(query.message, companionLang === 'ar' ? 'Arabic' : companionLang === 'fr' ? 'French' : 'English');
                      }}
                      className="w-full text-start p-3 rounded-2xl bg-slate-800/70 hover:bg-slate-800 border border-slate-700/60 flex items-center justify-between gap-3 group transition-all"
                    >
                      <div className="space-y-0.5">
                        <div className="font-bold text-sm text-white group-hover:text-emerald-400 flex items-center gap-2">
                          <span>{item.objectName}</span>
                          {item.relativePosition?.direction && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 font-normal">
                              {item.relativePosition.direction}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400">
                          <span>{item.surface || 'Table'}</span>
                          {item.room && <span> • {item.room}</span>}
                        </div>
                      </div>
                      <div className="text-end shrink-0">
                        <span className="text-[10px] text-slate-500 block">
                          {new Date(item.lastSeenTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="text-xs text-emerald-400 font-semibold group-hover:underline flex items-center justify-end gap-1">
                          <Volume2 className="w-3.5 h-3.5" />
                          {companionLang === 'ar' ? 'اسمع المكان' : companionLang === 'fr' ? 'Écouter' : 'Hear'}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Document Reader & Speech ⇄ Text — separate full-screen modal */}
      <AnimatePresence>
        {showDocumentReader && (
          <DocumentReaderModal
            profile={profile}
            companionLang={companionLang}
            onClose={() => setShowDocumentReader(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
