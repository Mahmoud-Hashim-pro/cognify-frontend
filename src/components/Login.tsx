import React, { useState, useEffect, useRef } from 'react';
import { RadioGroup, Radio } from 'react-aria-components';
import { AriaButton } from './ui/AriaButton';
import { signInWithGoogle, signInWithGoogleRedirect, loginWithEmail, registerWithEmail, auth, clearPreLoginState } from '../lib/firebase';
import { sendPasswordResetEmail, getRedirectResult } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Chrome, Mail, Lock, AlertCircle, Loader2, Eye, EyeOff, 
  ArrowLeft, ArrowRight, 
  Sparkles, Tag, ChevronDown, LockKeyhole, Globe,
  Brain, GraduationCap, Heart, Check, Ear, Activity, Zap, Compass
} from 'lucide-react';
import type { AccessibilityMode } from '../types';

type AccountPath = 'Normal' | 'Graduation Project' | 'Special Needs';
// Friendly picker labels shown to the user — NOT the same set as the app's real
// AccessibilityMode enum (which has 'Vocal-Deaf' / 'Sign-Only' / 'Motor-Euphonia' /
// 'Neurodiversity' instead of 'Hearing' / 'Motor' / 'Cognitive'). DISABILITY_MODE_MAP
// below is the single place that translates between the two — every option here
// MUST have an entry there, or that user silently ends up with accessibilityMode 'None'.
type DisabilityOption = 'Visual' | 'Hearing' | 'Motor' | 'Speech' | 'Cognitive';

// The one source of truth for turning a picker chip into the real, canonical
// AccessibilityMode value used everywhere else in the app (DisabilityModeView's
// direct-suite routing, access.ts, etc.). Stored as-is in localStorage so
// Onboarding.tsx / App.tsx no longer have to re-derive it by matching prose strings.
const DISABILITY_MODE_MAP: Record<DisabilityOption, AccessibilityMode> = {
  'Visual': 'Visual',
  'Hearing': 'Vocal-Deaf',
  'Motor': 'Motor-Euphonia',
  'Speech': 'Speech',
  'Cognitive': 'Neurodiversity',
};

// Human-readable label stored in profile.disabilityType for display + as a free-text
// fallback (DisabilityModeView's detectDirectDisabilityTab regex-matches this when
// accessibilityMode itself isn't set, e.g. for older accounts).
const DISABILITY_LABEL_MAP: Record<DisabilityOption, string> = {
  'Visual': 'Visual Impairment',
  'Hearing': 'Hearing Impairment',
  'Motor': 'Motor Impairment',
  'Speech': 'Speech Impairment',
  'Cognitive': 'Cognitive/Learning Disability',
};

// Each Special Needs accessibility feature, tagged with which disability chip(s) it's the primary match for.
// Selecting a chip brings its matching feature(s) to the top and marks them as the "FOCUS" for that mode,
// instead of the panel always defaulting to showing Vision Companion first regardless of selection.
// Kept in sync with the real modules in DisabilityModeView.tsx's MODULES array —
// titles/descriptions here must match what the user actually lands in, not a
// generic marketing paraphrase, or the onboarding preview misrepresents the app.
const SPECIAL_NEEDS_FEATURES: {
  key: string;
  Icon: typeof Sparkles;
  title: { en: string; ar: string };
  description: { en: string; ar: string };
  matches: DisabilityOption[];
}[] = [
  {
    key: 'vision',
    Icon: Eye,
    title: { en: 'Visual Companion (AI Eyes)', ar: 'الرفيق البصري الذكي' },
    description: { en: 'Audio companion that reads currency, matches clothing colors, and recognizes faces', ar: 'رفيق صوتي يقرأ العملات، وينسّق ألوان الملابس، ويتعرف على الوجوه' },
    matches: ['Visual'],
  },
  {
    key: 'sign-language',
    Icon: Heart,
    title: { en: 'Deaf & Hard of Hearing Suite (All-in-One)', ar: 'منظومة الصم وضعاف السمع الشاملة (الكل في واحد)' },
    description: { en: '3D sign language studio, sound & hazard radar, and a live two-way communication bridge', ar: 'استوديو لغة إشارة ثلاثي الأبعاد، رادار للأصوات والمخاطر، وجسر تواصل مباشر ثنائي الاتجاه' },
    matches: ['Hearing'],
  },
  {
    key: 'motor-voice',
    Icon: Check,
    title: { en: 'Motor & Euphonia Control', ar: 'التحكم الحركي وإيفونيا' },
    description: { en: 'Head-tracking pointer, eye-gaze keyboard, and hands-free vocal triggers', ar: 'مؤشر بحركة الرأس، لوحة مفاتيح بالعين، وأوامر صوتية بدون لمس' },
    matches: ['Motor', 'Speech'],
  },
  {
    key: 'cognitive-scaffolding',
    Icon: Brain,
    title: { en: 'Neurodiversity & Autism Hub', ar: 'واحة التوحد وصعوبات التعلم' },
    description: { en: 'Spoken PECS cards, visual daily routines, and calming sensory tools', ar: 'بطاقات PECS ناطقة، جدول روتين يومي بصري، وأدوات تهدئة حسية' },
    matches: ['Cognitive'],
  },
  {
    // These last three aren't tied to any single chip (matches: []) — available to
    // every Special Needs account regardless of which focus they pick, so they're
    // always listed but never get the "SELECTED" highlight. Together with the four
    // above, this is the full real set of 7 suites in DisabilityModeView's MODULES
    // (All Suites badge shows "7") — don't drop any of these three or the preview
    // undersells the app again.
    key: 'caregiver',
    Icon: Heart,
    title: { en: 'Caregiver & Specialist Hub', ar: 'لوحة المرافق والمختص الطبي' },
    description: { en: 'Family & clinical monitoring dashboard, live SOS test dispatch, and encrypted backup', ar: 'لوحة متابعة للأهل والمختصين، اختبار نداء استغاثة مباشر، ونسخ احتياطي مشفر' },
    matches: [],
  },
  {
    key: 'chat',
    Icon: Sparkles,
    title: { en: 'Adaptive Cognitive Tutor', ar: 'المساعد التعليمي الذكي المهيأ' },
    description: { en: 'Pedagogical tutoring assistant tailored to your pace, with step-by-step guidance and full screen-reader support', ar: 'مساعد تعليمي يتكيف مع وتيرتك، بشرح خطوة بخطوة ودعم كامل لقارئات الشاشة' },
    matches: [],
  },
  {
    key: 'settings',
    Icon: Globe,
    title: { en: 'Preferences & Dialects', ar: 'التفضيلات واللغات' },
    description: { en: '11 languages & dialects including Egyptian Ammiya, plus adjustable accessibility profiles and display settings', ar: '11 لغة ولهجة ومنها المصري، مع إمكانية ضبط ملفات الإتاحة وإعدادات العرض' },
    matches: [],
  },
];

function getSpecialNeedsFeatures(
  selected: DisabilityOption,
  t: (en: string, ar: string) => string
) {
  return SPECIAL_NEEDS_FEATURES
    .map((f) => ({
      key: f.key,
      Icon: f.Icon,
      title: t(f.title.en, f.title.ar),
      description: t(f.description.en, f.description.ar),
      isPrimary: f.matches.includes(selected),
    }))
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
}

export default function Login() {
  const [lang, setLang] = useState<'en' | 'ar'>(() => {
    if (typeof navigator !== 'undefined' && /^ar/i.test(navigator.language || '')) {
      return 'ar';
    }
    return 'en';
  });

  const [mode, setMode] = useState<'path-selection' | 'email-login' | 'email-register' | 'reset-password'>('path-selection');
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [showRedirectOption, setShowRedirectOption] = useState(false);

  const [accountPath, setAccountPath] = useState<AccountPath>('Normal');
  const [hoveredPath, setHoveredPath] = useState<AccountPath | null>(null);
  const activePreviewPath = hoveredPath || accountPath;
  const [universityEmail, setUniversityEmail] = useState("");
  const [faculty, setFaculty] = useState("");
  const [department, setDepartment] = useState("");
  const [selectedDisability, setSelectedDisability] = useState<DisabilityOption>('Visual');

  const [showHelp, setShowHelp] = useState(false);
  const [isInIframe] = useState(() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  });

  const isRtl = lang === 'ar';
  const t = (en: string, ar: string) => (lang === 'ar' ? ar : en);

  const isMountedRef = useRef(true);
  const authTimeoutRef = useRef<any>(null);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
  }, [lang, isRtl]);

  useEffect(() => {
    isMountedRef.current = true;
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as any });

    // Catch any redirect result or domain error when returning from signInWithRedirect
    getRedirectResult(auth).catch((err: any) => {
      console.warn("Google Redirect Result:", err);
      if (isMountedRef.current && err) {
        if (err.code === 'auth/unauthorized-domain') {
          setError(t("Google Login requires an authorized domain. Please use Email & Password below.", "تسجيل جوجل يتطلب نطاقاً مصرحاً. يرجى استخدام الإيميل وكلمة المرور بالأسفل."));
        } else if (err.code !== 'auth/credential-already-in-use') {
          setError(err?.message?.replace("Firebase: ", "") || t("Google Sign-In failed. Please try again or use Email.", "تعذر تسجيل الدخول عبر جوجل. يرجى المحاولة مرة أخرى أو استخدام البريد."));
        }
      }
    });

    return () => {
      isMountedRef.current = false;
      if (authTimeoutRef.current) clearTimeout(authTimeoutRef.current);
    };
  }, []);

  const handleContinuePath = () => {
    if (accountPath === 'Graduation Project') {
      return;
    }
    clearPreLoginState();
    try {
      localStorage.setItem('preLoginAccountPath', accountPath);
      if (accountPath === 'Special Needs') {
        localStorage.setItem('preLoginDisability', DISABILITY_LABEL_MAP[selectedDisability] || 'Visual Impairment');
        // The real enum value, stored directly — Onboarding.tsx / App.tsx should
        // read this first instead of re-parsing the prose label above.
        localStorage.setItem('preLoginAccessibilityMode', DISABILITY_MODE_MAP[selectedDisability] || 'Visual');
      } else {
        localStorage.setItem('preLoginAccessibilityMode', 'None');
        localStorage.removeItem('preLoginDisability');
        localStorage.removeItem('cognify_default_disability_tab');
      }
    } catch (err) {
      console.warn("LocalStorage unavailable in current context:", err);
    }
    setMode('email-login');
  };

  const validateUniversityEmail = (e: string) => {
    return !!e && /^[^\s@]+@[^\s@]+\.edu(\.[^\s@]+)?$/i.test(e.trim());
  };

  const handleGoogleRedirectAuth = async () => {
    if (loading) return;
    setError(null);
    setLoading(true);
    setShowHelp(false);
    try {
      await signInWithGoogleRedirect();
    } catch (err: any) {
      if (!isMountedRef.current) return;
      if (err.code === 'auth/unauthorized-domain') {
        setError(t("Google Login requires an authorized domain. Please use Email & Password below.", "تسجيل جوجل يتطلب نطاقاً مصرحاً. يرجى استخدام الإيميل وكلمة المرور بالأسفل."));
      } else {
        setError(err?.message?.replace("Firebase: ", "") || t("Google Sign-In failed. Please use Email & Password.", "تعذر تسجيل الدخول عبر جوجل. يرجى استخدام البريد وكلمة المرور."));
      }
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    if (loading) return;
    setError(null);
    setLoading(true);
    setShowHelp(false);

    // Strict 10s watchdog so Google popup never hangs the UI if blocked by browser or network
    if (authTimeoutRef.current) clearTimeout(authTimeoutRef.current);
    authTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        setLoading(false);
        setShowRedirectOption(true);
        setError(t("Google Sign-In timed out or was blocked by browser. Click Direct Google Sign-In below or use Email.", "استغرق تسجيل جوجل وقتاً طويلاً أو تم حظره بواسطة المتصفح. اضغط على تسجيل جوجل المباشر بالأسفل أو استخدم البريد."));
      }
    }, 10000);

    try {
      await signInWithGoogle();
      if (authTimeoutRef.current) clearTimeout(authTimeoutRef.current);
    } catch (err: any) {
      if (authTimeoutRef.current) clearTimeout(authTimeoutRef.current);
      if (!isMountedRef.current) return;
      if (err.code === 'auth/cancelled-popup-request') {
        /* another popup open */
      } else if (err.code === 'auth/popup-closed-by-user') {
        setShowRedirectOption(true);
        setError(t(
          "Authorization window was closed or blocked by browser policy (COOP). Click Direct Google Sign-In below without popups.",
          "تم إغلاق نافذة المصادقة أو حظرها بواسطة سياسة المتصفح (COOP). يمكنك الضغط على تسجيل جوجل المباشر بالأسفل بدون نوافذ منبثقة."
        ));
      } else if (err.code === 'auth/popup-blocked') {
        // Popups are blocked by the browser. Seamlessly fallback to redirect flow!
        try {
          await signInWithGoogleRedirect();
          return;
        } catch (redirErr: any) {
          setShowRedirectOption(true);
          setError(
            t(
              "Pop-up was blocked by your browser. Please click Direct Google Sign-In below or use Email & Password.",
              "قام المتصفح بحظر النافذة المنبثقة (Pop-up Blocked). يرجى الضغط على تسجيل جوجل المباشر بالأسفل أو استخدام البريد وكلمة المرور."
            )
          );
        }
      } else if (err.code === 'auth/unauthorized-domain') {
        setError(t("Google Login requires an authorized domain. Please use Email & Password below.", "تسجيل جوجل يتطلب نطاقاً مصرحاً. يرجى استخدام الإيميل وكلمة المرور بالأسفل."));
      } else {
        setShowRedirectOption(true);
        setError(err?.message?.replace("Firebase: ", "") || t("Google Sign-In failed. Please use Direct Google Sign-In or Email below.", "تعذر تسجيل الدخول عبر جوجل. يرجى استخدام تسجيل جوجل المباشر أو البريد أدناه."));
      }
    } finally {
      if (authTimeoutRef.current) clearTimeout(authTimeoutRef.current);
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  const handleManualAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'email-login') {
        await loginWithEmail(email, password);
      } else {
        if (password.length < 8) {
          if (isMountedRef.current) {
            setError(t("Password must be at least 8 characters.", "كلمة المرور يجب أن تكون 8 أحرف على الأقل."));
            setLoading(false);
          }
          return;
        }
        if (password !== confirmPassword) {
          if (isMountedRef.current) {
            setError(t("Passwords don't match. Please re-enter them.", "كلمتا المرور غير متطابقتين."));
            setLoading(false);
          }
          return;
        }
        await registerWithEmail(email, password);
      }
    } catch (err: any) {
      if (!isMountedRef.current) return;
      const code = err?.code || '';
      const msg = code === 'auth/network-request-failed'
        ? t("Network error — check your connection and try again.", "خطأ في الشبكة — تحقق من الاتصال وحاول مجدداً.")
        : code === 'auth/email-already-in-use'
          ? t("This email is already registered. Try signing in instead.", "هذا البريد مسجل بالفعل. حاول تسجيل الدخول بدلاً من ذلك.")
          : code === 'auth/weak-password'
            ? t("Password is too weak — use at least 8 characters.", "كلمة المرور ضعيفة — استخدم 8 خانات على الأقل.")
            : (err.message || '').replace("Firebase: ", "");
      setError(msg);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError(t("Please enter your email address.", "يرجى كتابة البريد الإلكتروني."));
      return;
    }
    setError(null);
    setLoading(true);
    setResetSuccess(false);

    try {
      await sendPasswordResetEmail(auth, email);
      if (isMountedRef.current) setResetSuccess(true);
    } catch (err: any) {
      if (isMountedRef.current) {
        setError((err?.message || String(err) || '').replace("Firebase: ", ""));
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0C14] text-slate-100 flex flex-col items-center justify-start p-4 sm:p-6 lg:p-8 font-sans relative overflow-x-hidden selection:bg-rose-500/30 selection:text-white" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Background ambient lighting */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-rose-500/10 rounded-full blur-[140px]" />
        <div className="absolute top-1/2 -right-40 w-[600px] h-[600px] bg-teal-500/10 rounded-full blur-[140px]" />
        <div className="absolute -bottom-40 left-1/3 w-[600px] h-[600px] bg-amber-500/10 rounded-full blur-[140px]" />
      </div>

      {/* Top Navbar */}
      <header className="max-w-5xl mx-auto w-full flex items-center justify-between z-10 py-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-purple-600 p-0.5 shadow-xl shadow-cyan-500/20 flex items-center justify-center">
            <div className="w-full h-full bg-[#0B0F1F] rounded-[14px] flex items-center justify-center">
              <Brain className="w-5 h-5 text-cyan-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black text-white tracking-tight">Cognify</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                2.0
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-medium">
              {t("Adaptive AI Study Mentor", "مدرّسك الذكي التكيّفي")}
            </span>
          </div>
        </div>

        {/* Language Switcher */}
        <div className="flex items-center gap-1 p-1 bg-slate-900/90 border border-slate-800 rounded-full shadow-inner">
          <button
            onClick={() => setLang('en')}
            className={`px-3 py-1 rounded-full text-xs font-black transition-all ${lang === 'en' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm' : 'text-slate-400 hover:text-white'}`}
          >
            EN
          </button>
          <button
            onClick={() => setLang('ar')}
            className={`px-3 py-1 rounded-full text-xs font-black transition-all ${lang === 'ar' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm' : 'text-slate-400 hover:text-white'}`}
          >
            AR
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-5xl mx-auto w-full z-10 space-y-6">
        <AnimatePresence mode="wait">
          {mode === 'path-selection' ? (
            <motion.div
              key="path-selection"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="space-y-6"
            >
              {/* Hero Title Header */}
              <div className="space-y-2.5 max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-amber-500/15 via-rose-500/10 to-teal-500/15 border border-amber-500/30 text-amber-300 shadow-sm">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>{t("Personalized Calibration · One Platform, Three Experiences", "معايرة تكيّفية مخصصة · منصة واحدة، ثلاث تجارب")}</span>
                </div>

                <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-[1.15]">
                  {isRtl ? (
                    <>سؤال واحد. <span className="text-amber-400">ثلاثة</span> <span className="text-rose-400">طرق</span> <span className="text-cyan-400">لسماع</span> الإجابة.</>
                  ) : (
                    <>One question. <span className="text-amber-400">Three</span> <span className="text-rose-400">ways</span> <span className="text-cyan-400">to</span> hear the answer.</>
                  )}
                </h1>

                <p className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed">
                  {t(
                    "Cognify doesn't just change its tone — it transforms its entire capabilities. Select a path below to see live capabilities and continue.",
                    "كوجنيفاي لا يغير نبرته فقط — بل يغير إمكانياته ومميزاته بالكامل. اختر مساراً لمشاهدة قدراته المباشرة والمتابعة فوراً."
                  )}
                </p>
              </div>

              {/* Main Interactive Comparison Card - Split View */}
              <div className="bg-[#0D1122]/95 border border-slate-700/70 rounded-[32px] overflow-hidden shadow-2xl backdrop-blur-2xl ring-1 ring-white/5">
                {/* Top Tri-Color Strip */}
                <div className="grid grid-cols-3 h-1.5 w-full">
                  <div className="bg-gradient-to-r from-amber-400 to-amber-500" />
                  <div className="bg-gradient-to-r from-teal-400 to-emerald-500" />
                  <div className="bg-gradient-to-r from-rose-500 to-pink-500" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 p-5 sm:p-7 md:p-8">
                  {/* Left Column: LIVE MODE OVERVIEW / معاينة إمكانيات ومميزات الوضع */}
                  <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full animate-pulse bg-cyan-400" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            {t("LIVE MODE OVERVIEW", "ملخص إمكانيات الوضع")}
                          </span>
                        </div>
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                          activePreviewPath === 'Normal'
                            ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                            : activePreviewPath === 'Graduation Project'
                            ? 'bg-teal-500/10 text-teal-300 border-teal-500/30'
                            : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                        }`}>
                          {activePreviewPath === 'Normal' && t('Standard Path', 'المسار القياسي')}
                          {activePreviewPath === 'Graduation Project' && t('Academic Path · Coming Soon', 'المسار الأكاديمي · قريباً')}
                          {activePreviewPath === 'Special Needs' && t('Accessible Path', 'مسار الإتاحة')}
                        </span>
                      </div>

                      {/* Dynamic Summary Card */}
                      <div className="bg-[#181C2E]/95 border border-slate-700/50 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl backdrop-blur-md">
                        <AnimatePresence mode="wait">
                          <motion.div
                            key={activePreviewPath}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.2 }}
                            className="space-y-4"
                          >
                            {/* Mode Title & Header Badge */}
                            <div className="flex items-start gap-3">
                              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 transition-all shadow-md ${
                                activePreviewPath === 'Normal'
                                  ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 shadow-amber-500/20'
                                  : activePreviewPath === 'Graduation Project'
                                  ? 'bg-gradient-to-br from-teal-400 to-emerald-600 text-slate-950 shadow-teal-500/20'
                                  : 'bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-rose-500/25'
                              }`}>
                                {activePreviewPath === 'Normal' && <Brain className="w-5 h-5" />}
                                {activePreviewPath === 'Graduation Project' && <GraduationCap className="w-5 h-5" />}
                                {activePreviewPath === 'Special Needs' && <Heart className="w-5 h-5" />}
                              </div>

                              <div className="flex-1">
                                <h3 className="text-sm sm:text-base font-black text-white tracking-tight leading-snug">
                                  {activePreviewPath === 'Normal' && t("Personalized AI Cognitive Mentor", "المساعد المعرفي الذكي المخصص")}
                                  {activePreviewPath === 'Graduation Project' && (
                                    <span className="flex items-center gap-2 flex-wrap">
                                      <span>{t("Faculty & Graduation Research Companion", "رفيق مشروع التخرج والأبحاث الأكاديمية")}</span>
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                                        {t("Coming Soon", "قريباً")}
                                      </span>
                                    </span>
                                  )}
                                  {activePreviewPath === 'Special Needs' && (
                                    <span className="flex items-center gap-2 flex-wrap">
                                      <span>{t("All-in-One Multi-Modal Accessibility Hub", "مركز الإتاحة الشامل ومتعدد الوسائط")}</span>
                                      {/* Matches the real "All Suites" count inside the app (DisabilityModeView's
                                          MODULES minus the admin-only Org Hub) — keep this number in sync if a
                                          suite is ever added/removed there. */}
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider bg-rose-500/15 text-rose-300 border border-rose-500/30 shrink-0">
                                        {t(`${SPECIAL_NEEDS_FEATURES.length} Suites`, `${SPECIAL_NEEDS_FEATURES.length} أدوات`)}
                                      </span>
                                    </span>
                                  )}
                                </h3>
                                <p className="text-[11px] sm:text-xs text-slate-300 font-medium mt-1 leading-relaxed">
                                  {activePreviewPath === 'Normal' && t(
                                    "Calibrated dynamically to your cognitive pace. Explains concepts with 4 teaching styles, tracks goals, and calculates your GPA in real time.",
                                    "معاير بدقة لسرعة استيعابك. يشرح بـ 4 أساليب تدريس، يتابع أهدافك، ويحسب معدلك التراكمي لحظة بلحظة."
                                  )}
                                  {activePreviewPath === 'Graduation Project' && t(
                                    "Curriculum-aware AI deeply linked to your faculty, department, and courses. Assists with thesis formulation, methodology, and citation standards.",
                                    "ذكاء اصطناعي يفهم مقررات كليتك وتخصصك بدقة. يدعم صياغة الرسالة، توثيق المراجع، ومتابعة تسليمات مشروعك."
                                  )}
                                  {activePreviewPath === 'Special Needs' && t(
                                    "Assistive multi-modal suite for visual, hearing, motor, and cognitive needs with 3D sign avatar, live camera OCR reader, and vocal controls.",
                                    "منظومة إتاحة شاملة للإعاقات البصرية والسمعية والحركية والإدراكية مع أفاتار لغة إشارة 3D، كاميرا ذكية، وأوامر صوتية."
                                  )}
                                </p>
                              </div>
                            </div>

                            <div className="h-px bg-slate-700/50 w-full" />

                            {/* Eye-catching Feature Highlights */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              {activePreviewPath === 'Normal' && (
                                <>
                                  <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-700/70 hover:border-amber-500/50 flex items-start gap-3 shadow-md transition-all">
                                    <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0 mt-0.5">
                                      <Sparkles className="w-4 h-4 text-amber-400" />
                                    </div>
                                    <div className="min-w-0">
                                      <div className="text-xs font-bold text-white leading-snug">{t("4 Adaptive Pedagogy Styles", "4 أساليب شرح تكيّفية")}</div>
                                      <div className="text-[11px] text-slate-300 leading-tight mt-1">{t("Step-by-Step, Socratic, Visual & Technical", "خطوة بخطوة، سقراطي، تشبيهات وتقني")}</div>
                                    </div>
                                  </div>

                                  <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-700/70 hover:border-amber-500/50 flex items-start gap-3 shadow-md transition-all">
                                    <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0 mt-0.5">
                                      <Check className="w-4 h-4 text-amber-400" />
                                    </div>
                                    <div className="min-w-0">
                                      <div className="text-xs font-bold text-white leading-snug">{t("Dynamic GPA & Goal Tracker", "حاسبة GPA وتتبع الأهداف")}</div>
                                      <div className="text-[11px] text-slate-300 leading-tight mt-1">{t("Live grade forecasting & study countdowns", "توقعات فورية للمعدل وعد تنازلي للمهام")}</div>
                                    </div>
                                  </div>

                                  <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-700/70 hover:border-amber-500/50 flex items-start gap-3 shadow-md transition-all">
                                    <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0 mt-0.5">
                                      <Brain className="w-4 h-4 text-amber-400" />
                                    </div>
                                    <div className="min-w-0">
                                      <div className="text-xs font-bold text-white leading-snug">{t("Cognitive Gym & IQ Assessment", "الجيم المعرفي واختبارات الذكاء")}</div>
                                      <div className="text-[11px] text-slate-300 leading-tight mt-1">{t("Daily brain workouts and cognitive metrics", "تمارين ذهنية يومية لقياس سرعة التفكير")}</div>
                                    </div>
                                  </div>

                                  <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-700/70 hover:border-amber-500/50 flex items-start gap-3 shadow-md transition-all">
                                    <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0 mt-0.5">
                                      <Tag className="w-4 h-4 text-amber-400" />
                                    </div>
                                    <div className="min-w-0">
                                      <div className="text-xs font-bold text-white leading-snug">{t("Spaced Retention Flashcards", "تكرار متباعد ذكي")}</div>
                                      <div className="text-[11px] text-slate-300 leading-tight mt-1">{t("Active recall cards against forgetting", "بطاقات استذكار لمحاربة النسيان")}</div>
                                    </div>
                                  </div>
                                </>
                              )}

                              {activePreviewPath === 'Graduation Project' && (
                                <>
                                  <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-700/70 hover:border-teal-500/50 flex items-start gap-3 shadow-md transition-all">
                                    <div className="w-8 h-8 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center shrink-0 mt-0.5">
                                      <GraduationCap className="w-4 h-4 text-teal-400" />
                                    </div>
                                    <div className="min-w-0">
                                      <div className="text-xs font-bold text-white leading-snug">{t("Faculty Curriculum Alignment", "ربط مباشر بمقررات كليتك")}</div>
                                      <div className="text-[11px] text-slate-300 leading-tight mt-1">{t("AI knows your specific college & department", "فهم كامل لمقررات وتخصص كليتك")}</div>
                                    </div>
                                  </div>

                                  <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-700/70 hover:border-teal-500/50 flex items-start gap-3 shadow-md transition-all">
                                    <div className="w-8 h-8 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center shrink-0 mt-0.5">
                                      <Sparkles className="w-4 h-4 text-teal-400" />
                                    </div>
                                    <div className="min-w-0">
                                      <div className="text-xs font-bold text-white leading-snug">{t("Thesis & Literature Reviews", "صياغة الرسالة ومراجعة المراجع")}</div>
                                      <div className="text-[11px] text-slate-300 leading-tight mt-1">{t("Academic methodology and research synthesis", "منهجيات بحث أكاديمية وصياغة علمية")}</div>
                                    </div>
                                  </div>

                                  <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-700/70 hover:border-teal-500/50 flex items-start gap-3 shadow-md transition-all">
                                    <div className="w-8 h-8 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center shrink-0 mt-0.5">
                                      <Check className="w-4 h-4 text-teal-400" />
                                    </div>
                                    <div className="min-w-0">
                                      <div className="text-xs font-bold text-white leading-snug">{t("Automated Citation Engine", "محرك التوثيق الأكاديمي")}</div>
                                      <div className="text-[11px] text-slate-300 leading-tight mt-1">{t("IEEE, APA, Harvard format in a single click", "تنسيق مراجع معتمد بنقرة واحدة")}</div>
                                    </div>
                                  </div>

                                  <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-700/70 hover:border-teal-500/50 flex items-start gap-3 shadow-md transition-all">
                                    <div className="w-8 h-8 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center shrink-0 mt-0.5">
                                      <Brain className="w-4 h-4 text-teal-400" />
                                    </div>
                                    <div className="min-w-0">
                                      <div className="text-xs font-bold text-white leading-snug">{t("Sprint & Milestone Deliverables", "تتبع مراحل وتسليمات المشروع")}</div>
                                      <div className="text-[11px] text-slate-300 leading-tight mt-1">{t("Track supervisor notes and project deadlines", "تتبع ملاحظات المشرف ومواعيد المناقشة")}</div>
                                    </div>
                                  </div>
                                </>
                              )}

                              {activePreviewPath === 'Special Needs' && (
                                <>
                                  {getSpecialNeedsFeatures(selectedDisability, t).map((feature) => (
                                    <div
                                      key={feature.key}
                                      className={`p-3 rounded-2xl border flex items-start gap-3 transition-all shadow-md ${
                                        feature.isPrimary
                                          ? 'bg-rose-500/15 border-rose-500/50 ring-1 ring-rose-500/30'
                                          : 'bg-slate-900/80 border-slate-700/70 hover:border-slate-600'
                                      }`}
                                    >
                                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                                        feature.isPrimary ? 'bg-rose-500/25 border border-rose-400/50' : 'bg-slate-800 border border-slate-700'
                                      }`}>
                                        <feature.Icon className={`w-4 h-4 ${feature.isPrimary ? 'text-rose-300' : 'text-rose-400'}`} />
                                      </div>
                                      <div className="min-w-0">
                                        <div className="text-xs font-bold text-white flex items-center gap-1.5 leading-snug">
                                          <span className="truncate">{feature.title}</span>
                                          {feature.isPrimary && (
                                            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black tracking-wider bg-rose-500/30 text-rose-200 border border-rose-400/50 shrink-0">
                                              {t('FOCUS', 'محدد')}
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-[11px] text-slate-300 leading-tight mt-1">{feature.description}</div>
                                      </div>
                                    </div>
                                  ))}
                                </>
                              )}
                            </div>
                          </motion.div>
                        </AnimatePresence>
                      </div>
                    </div>

                    {/* Bottom Feature Pill Indicator */}
                    <div className="space-y-2 pt-0.5">
                      <div className="flex items-center gap-2 text-xs font-bold">
                        <span className={`inline-flex items-center gap-1.5 ${
                          activePreviewPath === 'Normal' ? 'text-amber-400' : activePreviewPath === 'Graduation Project' ? 'text-teal-400' : 'text-rose-400'
                        }`}>
                          <Check className="w-4 h-4" /> {t("Mode Unlocks:", "المميزات المفتوحة:")}
                        </span>
                        <span className="text-slate-300 font-semibold text-xs">
                          {activePreviewPath === 'Normal' && t("Adaptive AI Chat · GPA Engine · Spaced Retention · Cognitive Tests", "دردشة تكيّفية · حاسبة GPA · تكرار متباعد · اختبارات ذهنية")}
                          {activePreviewPath === 'Graduation Project' && t("All Normal Features + Faculty Context + Thesis AI + Citations", "كل مميزات العادي + ربط الكلية + إرشاد الرسالة + توثيق المراجع")}
                          {activePreviewPath === 'Special Needs' && t("All Normal Features + Vision AI + 3D Sign Language + Hearing Bridge + Motor Mode", "كل مميزات العادي + كاميرا الرؤية + لغة إشارة 3D + جسر السمع + تحكم صوتي")}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: CHOOSE YOUR PATH */}
                  <div className="lg:col-span-5 flex flex-col justify-between space-y-5 lg:border-s lg:border-slate-800/80 lg:ps-7">
                    <div className="space-y-3.5">
                      <div>
                        <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                          {t("Choose your path", "اختر مسارك")}
                        </h2>
                        <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                          {t("You can change this later in settings.", "يمكنك تغيير هذا المسار لاحقاً من الإعدادات.")}
                        </p>
                      </div>

                      {/* Vertical Path Selector Timeline */}
                      <RadioGroup
                        value={accountPath}
                        onChange={(val) => setAccountPath(val as AccountPath)}
                        aria-label={t("Choose your path", "اختر مسارك")}
                        className="space-y-3 relative outline-none"
                      >
                        {/* 1. Normal Path */}
                        <Radio
                          value="Normal"
                          onMouseEnter={() => setHoveredPath('Normal')}
                          onMouseLeave={() => setHoveredPath(null)}
                          className={({ isSelected, isFocusVisible }) =>
                            `relative z-10 w-full flex items-start gap-3.5 p-4 rounded-2xl cursor-pointer border transition-all duration-200 outline-none ${
                              isSelected
                                ? 'bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-slate-900/90 border-amber-500 shadow-xl shadow-amber-500/15 ring-1 ring-amber-400/40 scale-[1.01]'
                                : 'bg-slate-900/60 border-slate-800/90 hover:bg-slate-800/70 hover:border-slate-700 shadow-sm'
                            } ${isFocusVisible ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-950' : ''}`
                          }
                        >
                          {({ isSelected }) => (
                            <>
                              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-all ${
                                isSelected
                                  ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 shadow-md shadow-amber-500/30'
                                  : 'bg-slate-800/90 text-slate-400 border border-slate-700/80'
                              }`}>
                                <Brain className="w-5 h-5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <span className={`text-sm sm:text-base font-black transition-colors ${isSelected ? 'text-amber-300' : 'text-white'}`}>
                                    {t("Normal Path", "المسار القياسي (عام)")}
                                  </span>
                                  <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0 ${
                                    isSelected
                                      ? 'bg-amber-400/20 text-amber-300 border-amber-400/40'
                                      : 'bg-slate-800 text-slate-400 border-slate-700'
                                  }`}>
                                    {t("Active · Ready", "جاهز للبدء")}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-300 font-medium mt-1 leading-relaxed">
                                  {t("Adaptive AI mentor, Socratic explanations, GPA forecasting & spaced retention flashcards.", "مساعد معرفي ذكي يتكيف مع استيعابك، حاسبة GPA، وتكرار متباعد لحفظ المعلومات.")}
                                </p>
                              </div>
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                                isSelected
                                  ? 'bg-amber-400 text-slate-950 shadow-sm ring-4 ring-amber-400/20'
                                  : 'border border-slate-700 bg-slate-800/50'
                              }`}>
                                {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                            </>
                          )}
                        </Radio>

                        {/* 2. Graduation Project */}
                        <div className="relative z-10 space-y-2">
                          <Radio
                            value="Graduation Project"
                            onMouseEnter={() => setHoveredPath('Graduation Project')}
                            onMouseLeave={() => setHoveredPath(null)}
                            className={({ isSelected, isFocusVisible }) =>
                              `w-full flex items-start gap-3.5 p-4 rounded-2xl cursor-pointer border transition-all duration-200 outline-none ${
                                isSelected
                                  ? 'bg-gradient-to-r from-teal-500/20 via-teal-500/10 to-slate-900/90 border-teal-500 shadow-xl shadow-teal-500/15 ring-1 ring-teal-400/40 scale-[1.01]'
                                  : 'bg-slate-900/60 border-slate-800/90 hover:bg-slate-800/70 hover:border-slate-700 shadow-sm'
                              } ${isFocusVisible ? 'ring-2 ring-teal-400 ring-offset-2 ring-offset-slate-950' : ''}`
                            }
                          >
                            {({ isSelected }) => (
                              <>
                                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-all ${
                                  isSelected
                                    ? 'bg-gradient-to-br from-teal-400 to-emerald-600 text-slate-950 shadow-md shadow-teal-500/30'
                                    : 'bg-slate-800/90 text-slate-400 border border-slate-700/80'
                                }`}>
                                  <GraduationCap className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className={`text-sm sm:text-base font-black transition-colors ${isSelected ? 'text-teal-300' : 'text-white'}`}>
                                      {t("Graduation Project", "مشروع التخرج")}
                                    </span>
                                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0 animate-pulse">
                                      {t("Coming Soon", "قريباً")}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-300 font-medium mt-1 leading-relaxed">
                                    {t("Anchored to your faculty, department, courses & thesis formatting standards.", "مرتبط بكليتك وتخصصك ومقرراتك الأكاديمية وصياغة الرسائل العلمية.")}
                                  </p>
                                </div>
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                                  isSelected
                                    ? 'bg-teal-400 text-slate-950 shadow-sm ring-4 ring-teal-400/20'
                                    : 'border border-slate-700 bg-slate-800/50'
                                }`}>
                                  {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                </div>
                              </>
                            )}
                          </Radio>

                          {/* Graduation Coming Soon Note */}
                          {accountPath === 'Graduation Project' && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs font-semibold leading-relaxed space-y-1.5 ms-4"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex items-center gap-1.5 font-black text-amber-300">
                                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                                <span>{t("Feature Coming Soon", "الميزة قادمة قريباً")}</span>
                              </div>
                              <p className="text-[11px] text-amber-200/90 font-medium">
                                {t(
                                  "The Graduation Project pathway is under active development. Please select 'Normal' or 'Special Needs' to continue and unlock all active tools today.",
                                  "مسار مشروع التخرج قيد التجهيز وسيتم إطلاقه قريباً. يرجى اختيار المسار 'العادي' أو 'ذوي الهمم' للمتابعة الآن."
                                )}
                              </p>
                            </motion.div>
                          )}
                        </div>

                        {/* 3. Special Needs */}
                        <div className="relative z-10 space-y-2">
                          <Radio
                            value="Special Needs"
                            onMouseEnter={() => setHoveredPath('Special Needs')}
                            onMouseLeave={() => setHoveredPath(null)}
                            className={({ isSelected, isFocusVisible }) =>
                              `w-full flex items-start gap-3.5 p-4 rounded-2xl cursor-pointer border transition-all duration-200 outline-none ${
                                isSelected
                                  ? 'bg-gradient-to-r from-rose-500/20 via-pink-500/10 to-slate-900/90 border-rose-500 shadow-xl shadow-rose-500/15 ring-1 ring-rose-400/40 scale-[1.01]'
                                  : 'bg-slate-900/60 border-slate-800/90 hover:bg-slate-800/70 hover:border-slate-700 shadow-sm'
                              } ${isFocusVisible ? 'ring-2 ring-rose-400 ring-offset-2 ring-offset-slate-950' : ''}`
                            }
                          >
                            {({ isSelected }) => (
                              <>
                                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-all ${
                                  isSelected
                                    ? 'bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-md shadow-rose-500/30'
                                    : 'bg-slate-800/90 text-slate-400 border border-slate-700/80'
                                }`}>
                                  <Heart className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className={`text-sm sm:text-base font-black transition-colors ${isSelected ? 'text-rose-300' : 'text-white'}`}>
                                      {t("Special Needs (Accessibility)", "مسار ذوي الهمم والإتاحة")}
                                    </span>
                                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 shrink-0">
                                      {t("4 Modalities", "4 أنظمة")}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-300 font-medium mt-1 leading-relaxed">
                                    {t("Assistive multi-modal hub: 3D sign avatar, audio camera eyes, motor & neuro tools.", "منظومة إتاحة شاملة: لغة إشارة 3D، رفيق بصري ذكي، تحكم حركي، وأدوات توحد.")}
                                  </p>
                                </div>
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                                  isSelected
                                    ? 'bg-rose-500 text-white shadow-sm ring-4 ring-rose-500/20'
                                    : 'border border-slate-700 bg-slate-800/50'
                                }`}>
                                  {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                </div>
                              </>
                            )}
                          </Radio>

                          {/* Focus Chips: independent React Aria RadioGroup */}
                          {accountPath === 'Special Needs' && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              className="pt-2 ps-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <RadioGroup
                                value={selectedDisability}
                                onChange={(val) => setSelectedDisability(val as DisabilityOption)}
                                aria-label={t("Accessibility focus", "نوع الإتاحة المطلوب")}
                                orientation="horizontal"
                                className="space-y-2.5 outline-none p-3.5 rounded-2xl bg-[#090C16]/95 border border-rose-500/30 shadow-inner"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-black uppercase tracking-wider text-rose-300 flex items-center gap-1.5">
                                    <Sparkles className="w-3.5 h-3.5 text-rose-400" />
                                    {t("Select Primary Focus Suite:", "اختر نظام التركيز الأساسي:")}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-medium">
                                    {t("All tools remain unlocked", "جميع الأدوات تظل متاحة")}
                                  </span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {[
                                    { id: 'Visual' as const, icon: Eye, labelEn: 'Visual (AI Eyes)', labelAr: 'الرفيق البصري (كاميرا)' },
                                    { id: 'Hearing' as const, icon: Ear, labelEn: 'Deaf & Hearing (3D)', labelAr: 'الصم وضعاف السمع (إشارة)' },
                                    { id: 'Motor' as const, icon: Activity, labelEn: 'Motor & Voice Control', labelAr: 'التحكم الحركي وإيفونيا' },
                                    { id: 'Cognitive' as const, icon: Brain, labelEn: 'Neurodiversity & Autism', labelAr: 'التوحد وصعوبات التعلم' },
                                  ].map((item) => (
                                    <Radio
                                      key={item.id}
                                      value={item.id}
                                      className={({ isSelected, isFocusVisible }) =>
                                        `flex items-center gap-2.5 p-2.5 rounded-xl cursor-pointer transition-all outline-none border ${
                                          isSelected
                                            ? 'bg-rose-500/25 border-rose-400 text-white shadow-md shadow-rose-500/20 font-black'
                                            : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:border-slate-600 hover:bg-slate-800/60 font-semibold'
                                        } ${isFocusVisible ? 'ring-2 ring-rose-400 ring-offset-1 ring-offset-slate-900' : ''}`
                                      }
                                    >
                                      <item.icon className="w-4 h-4 shrink-0 text-rose-400" />
                                      <span className="text-xs truncate">{t(item.labelEn, item.labelAr)}</span>
                                    </Radio>
                                  ))}
                                </div>
                              </RadioGroup>
                            </motion.div>
                          )}
                        </div>
                      </RadioGroup>
                    </div>

                    {/* Continue Button */}
                    <AriaButton
                      onPress={handleContinuePath}
                      isDisabled={accountPath === 'Graduation Project'}
                      className={`w-full py-4 px-6 rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2.5 shadow-2xl transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
                        accountPath === 'Normal'
                          ? 'bg-gradient-to-r from-amber-400 via-amber-500 to-rose-500 text-slate-950 hover:brightness-110 shadow-amber-500/25 ring-1 ring-amber-300/30'
                          : accountPath === 'Graduation Project'
                          ? 'bg-slate-800 text-slate-400 border border-slate-700/80 shadow-none'
                          : 'bg-gradient-to-r from-rose-500 via-pink-500 to-purple-600 text-white hover:brightness-110 shadow-rose-500/30 ring-1 ring-rose-300/30'
                      }`}
                    >
                      <span className="text-xs sm:text-sm font-black">
                        {accountPath === 'Graduation Project'
                          ? t("Choose Another Path to Continue", "يرجى اختيار مسار آخر للمتابعة")
                          : accountPath === 'Normal'
                          ? t("Continue with Normal Path", "المتابعة بالمسار القياسي")
                          : (() => {
                              const primaryFeature = getSpecialNeedsFeatures(selectedDisability, t).find((f) => f.isPrimary);
                              return primaryFeature
                                ? t(`Continue to ${primaryFeature.title}`, `المتابعة إلى ${primaryFeature.title}`)
                                : t("Continue with Special Needs Path", "المتابعة بمسار ذوي الهمم");
                            })()}
                      </span>
                      {accountPath !== 'Graduation Project' && (
                        <ArrowRight className={`w-4 h-4 shrink-0 transition-transform ${isRtl ? 'rotate-180' : ''}`} />
                      )}
                    </AriaButton>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            /* Unified Direct Auth Screen */
            <motion.div
              key="auth-flow"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="max-w-md mx-auto w-full bg-[#121524]/95 border border-slate-800 rounded-[28px] p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-5"
            >
              {/* Header with Selected Path & Back Button */}
              <div className="flex items-center justify-between pb-1">
                <button
                  onClick={() => { setMode('path-selection'); setError(null); }}
                  className="inline-flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-white transition-colors"
                >
                  <ArrowLeft className={`w-3.5 h-3.5 ${isRtl ? 'rotate-180' : ''}`} />
                  <span>{t("Back", "رجوع")}</span>
                </button>

                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-slate-800/80 border border-slate-700 text-slate-300">
                  <span>{t("Path:", "المسار:")}</span>
                  <strong className={
                    accountPath === 'Normal' ? 'text-amber-400' : accountPath === 'Graduation Project' ? 'text-teal-400' : 'text-rose-400'
                  }>
                    {accountPath === 'Normal' && t('Normal', 'عادي')}
                    {accountPath === 'Graduation Project' && t('Graduation Project', 'مشروع تخرج')}
                    {accountPath === 'Special Needs' && `${t('Special Needs', 'احتياجات خاصة')} (${selectedDisability})`}
                  </strong>
                </div>
              </div>

              {mode === 'reset-password' ? (
                /* Reset Password View */
                <div className="space-y-4 text-start">
                  <div className="space-y-1">
                    <h2 className="text-xl font-black text-white tracking-tight">{t("Reset Password", "إعادة تعيين كلمة المرور")}</h2>
                    <p className="text-xs text-slate-400">{t("Enter your email to receive recovery instructions.", "أدخل بريدك الإلكتروني لإرسال رابط الاستعادة.")}</p>
                  </div>

                  {resetSuccess ? (
                    <div className="p-4 bg-teal-500/10 border border-teal-500/30 rounded-2xl text-teal-300 text-xs font-bold space-y-2">
                      <p>{t("Reset link sent! Please check your inbox.", "تم إرسال رابط إعادة التعيين! يرجى التحقق من بريدك.")}</p>
                      <button
                        onClick={() => { setMode('email-login'); setResetSuccess(false); setError(null); }}
                        className="block text-teal-400 hover:underline pt-2 font-black"
                      >
                        {t("Return to Sign In", "العودة لتسجيل الدخول")}
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleResetPassword} className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">{t("Email Address", "البريد الإلكتروني")}</label>
                        <input
                          type="email"
                          required
                          placeholder="name@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full bg-[#181C2E] border border-slate-700 text-white placeholder-slate-500 text-xs rounded-xl py-3 px-4 outline-none focus:border-rose-400"
                        />
                      </div>

                      {error && (
                        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-xs font-bold flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>{error}</span>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3.5 bg-gradient-to-r from-rose-500 to-pink-500 text-white font-black text-xs uppercase tracking-wider rounded-xl hover:opacity-95 transition-all shadow-lg shadow-rose-500/20 disabled:opacity-50"
                      >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : t("Send Reset Link", "إرسال رابط الاستعادة")}
                      </button>
                    </form>
                  )}
                </div>
              ) : (
                /* Unified Tabs (Sign In / Create Account) */
                <div className="space-y-4 text-start">
                  <div className="space-y-1 text-center">
                    <h2 className="text-xl font-black text-white tracking-tight">
                      {mode === 'email-login' ? t("Welcome Back", "أهلاً بك مجدداً") : t("Create Your Profile", "إنشاء حسابك الجديد")}
                    </h2>
                    <p className="text-xs text-slate-400">
                      {mode === 'email-login'
                        ? t("Sign in to access your personalized mentor.", "سجّل دخولك للوصول إلى مساعدك الدراسي المخصص.")
                        : t("Get started with your tailored learning calibration.", "ابدأ رحلتك التعليمية المخصصة لمعايرتك.")}
                    </p>
                  </div>

                  {/* Tab Selector */}
                  <div className="grid grid-cols-2 gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl">
                    <button
                      type="button"
                      onClick={() => { setMode('email-login'); setError(null); }}
                      className={`py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all ${
                        mode === 'email-login'
                          ? 'bg-slate-800 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {t("Sign In", "تسجيل الدخول")}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setMode('email-register'); setError(null); }}
                      className={`py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all ${
                        mode === 'email-register'
                          ? 'bg-slate-800 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {t("Create Account", "إنشاء حساب")}
                    </button>
                  </div>

                  {/* Form */}
                  <form onSubmit={handleManualAuth} className="space-y-3.5">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">{t("Email Address", "البريد الإلكتروني")}</label>
                      <div className="relative">
                        <Mail className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 ${isRtl ? 'right-3' : 'left-3'}`} />
                        <input
                          type="email"
                          required
                          placeholder="name@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className={`w-full bg-[#181C2E] border border-slate-700 text-white placeholder-slate-500 text-xs rounded-xl py-2.5 outline-none focus:border-rose-400 ${isRtl ? 'pr-9 pl-3' : 'pl-9 pr-3'}`}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">{t("Password", "كلمة المرور")}</label>
                      <div className="relative">
                        <Lock className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 ${isRtl ? 'right-3' : 'left-3'}`} />
                        <input
                          type={showPassword ? "text" : "password"}
                          required
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className={`w-full bg-[#181C2E] border border-slate-700 text-white placeholder-slate-500 text-xs rounded-xl py-2.5 outline-none focus:border-rose-400 ${isRtl ? 'pr-9 pl-9' : 'pl-9 pr-9'}`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className={`absolute top-1/2 -translate-y-1/2 text-slate-400 hover:text-white ${isRtl ? 'left-3' : 'right-3'}`}
                        >
                          {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {mode === 'email-register' && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="space-y-1"
                      >
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">{t("Confirm Password", "تأكيد كلمة المرور")}</label>
                        <div className="relative">
                          <Lock className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 ${isRtl ? 'right-3' : 'left-3'}`} />
                          <input
                            type="password"
                            required
                            placeholder="••••••••"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className={`w-full bg-[#181C2E] border border-slate-700 text-white placeholder-slate-500 text-xs rounded-xl py-2.5 outline-none focus:border-rose-400 ${isRtl ? 'pr-9 pl-3' : 'pl-9 pr-3'}`}
                          />
                        </div>
                      </motion.div>
                    )}

                    {mode === 'email-login' && (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => { setMode('reset-password'); setError(null); }}
                          className="text-[11px] font-bold text-rose-400 hover:underline"
                        >
                          {t("Forgot Password?", "نسيت كلمة المرور؟")}
                        </button>
                      </div>
                    )}

                    {error && (
                      <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs font-bold space-y-2">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>{error}</span>
                        </div>
                        {showRedirectOption && (
                          <button
                            type="button"
                            onClick={handleGoogleRedirectAuth}
                            disabled={loading}
                            className="w-full py-2 px-3 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98]"
                          >
                            <Globe className="w-3.5 h-3.5" />
                            <span>{t("Click Here for Direct Google Sign-In", "اضغط هنا لتسجيل الدخول المباشر")}</span>
                          </button>
                        )}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3.5 bg-gradient-to-r from-rose-500 via-pink-500 to-amber-500 text-white font-black text-xs uppercase tracking-wider rounded-xl hover:opacity-95 transition-all shadow-lg shadow-rose-500/20 disabled:opacity-50"
                    >
                      {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                      ) : mode === 'email-login' ? (
                        t("Sign In", "تسجيل الدخول")
                      ) : (
                        t("Create Profile", "إنشاء الحساب")
                      )}
                    </button>
                  </form>

                  {/* Or Continue With Google */}
                  <div className="flex items-center gap-3 pt-1">
                    <div className="h-px bg-slate-800 flex-1" />
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t("Or", "أو")}</span>
                    <div className="h-px bg-slate-800 flex-1" />
                  </div>

                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={handleGoogleAuth}
                      disabled={loading}
                      className="w-full h-11 flex items-center justify-center gap-2 bg-white text-slate-950 rounded-xl hover:bg-slate-100 transition-all font-black uppercase tracking-wider text-xs shadow-md disabled:opacity-50 active:scale-[0.98]"
                    >
                      {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                      ) : (
                        <Chrome className="w-4 h-4 text-slate-950" />
                      )}
                      <span>{t("Continue with Google", "المتابعة عبر جوجل")}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleGoogleRedirectAuth}
                      disabled={loading}
                      className={`w-full py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                        showRedirectOption
                          ? 'bg-rose-500/15 border-rose-500/40 text-rose-300 hover:bg-rose-500/25 shadow-sm'
                          : 'bg-slate-800/50 border-slate-700/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      <Globe className="w-3.5 h-3.5 shrink-0" />
                      <span>{t("Direct Google Sign-In (No Popups)", "تسجيل جوجل المباشر (بدون نوافذ منبثقة)")}</span>
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto w-full text-center py-4 z-10">
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500">
          <LockKeyhole className="w-3.5 h-3.5 text-slate-600" />
          <span>{t("Secure access · Firebase Auth", "تسجيل دخول آمن ومشفّر · Firebase Auth")}</span>
        </div>
      </footer>
    </div>
  );
}
