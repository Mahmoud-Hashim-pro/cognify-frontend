import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shield,
  X,
  Check,
  Eye,
  Ear,
  Activity,
  Brain,
  Sparkles,
  Volume2,
  Radio,
  BookOpen,
  Compass,
  AlertCircle
} from 'lucide-react';
import { UserProfile, AccessibilityPassport, AccessibilityMode } from '../types';
import { doc, setDoc } from 'firebase/firestore';
import { db, cleanDataForFirestore } from '../lib/firebase';
import { isArabicLocale } from '../lib/translations';
import { toast } from './Toast';

interface AccessibilityPassportModalProps {
  profile: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  setProfile?: (profile: UserProfile) => void;
}

export default function AccessibilityPassportModal({
  profile,
  isOpen,
  onClose,
  setProfile,
}: AccessibilityPassportModalProps) {
  const lang = profile.language || 'Arabic';
  const isAr = isArabicLocale(lang);
  const isFr = lang === 'French';

  const initialPassport: AccessibilityPassport = profile.accessibilityPassport || {
    primaryMode: profile.accessibilityMode || 'None',
    primaryCategory: profile.accessibilityMode || 'Multiple',
    highContrast: false,
    dyslexiaFont: false,
    hapticFeedback: true,
    autoSpeak: true,
    audioSpeed: 1,
    allowCameraTriggers: true,
    visualSupport: {
      highContrast: false,
      autoSpeechReadout: true,
      hapticAssistance: true,
    },
    hearingSupport: {
      visualAcousticRadar: true,
      reverseSignToSpeech: true,
      flashingAlerts: true,
    },
    motorSupport: {
      trackingMode: profile.headTrackingConfig?.trackingMode || 'iris',
      dwellDurationMs: profile.headTrackingConfig?.dwellTimeMs || 1200,
      emergencySosEnabled: true,
    },
    neurodiversitySupport: {
      dyslexiaFont: false,
      readingRuler: false,
      sensoryRegulation: true,
    },
  };

  const [passport, setPassport] = useState<AccessibilityPassport>(initialPassport);
  const [isSaving, setIsSaving] = useState(false);

  // Reset form to the latest saved profile data every time the modal opens.
  // Without this, if the user opens, closes, changes their mode externally, and
  // opens again, the stale initialPassport (captured at first mount) is shown.
  useEffect(() => {
    if (isOpen) {
      setPassport(
        profile.accessibilityPassport || {
          primaryMode: profile.accessibilityMode || 'None',
          primaryCategory: profile.accessibilityMode || 'Multiple',
          highContrast: false,
          dyslexiaFont: false,
          hapticFeedback: true,
          autoSpeak: true,
          audioSpeed: 1,
          allowCameraTriggers: true,
          visualSupport: { highContrast: false, autoSpeechReadout: true, hapticAssistance: true },
          hearingSupport: { visualAcousticRadar: true, reverseSignToSpeech: true, flashingAlerts: true },
          motorSupport: {
            trackingMode: profile.headTrackingConfig?.trackingMode || 'iris',
            dwellDurationMs: profile.headTrackingConfig?.dwellTimeMs || 1200,
            emergencySosEnabled: true,
          },
          neurodiversitySupport: { dyslexiaFont: false, readingRuler: false, sensoryRegulation: true },
        }
      );
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const t = (en: string, ar: string, fr?: string) => {
    if (isAr) return ar;
    if (isFr && fr) return fr;
    return en;
  };

  const handleSave = async () => {
    setIsSaving(true);
    const resolvedMode: AccessibilityMode =
      passport.primaryMode ||
      (passport.primaryCategory !== 'Multiple' ? passport.primaryCategory : undefined) ||
      profile.accessibilityMode;
    const updatedProfile: UserProfile = {
      ...profile,
      accessibilityPassport: passport,
      accessibilityMode: resolvedMode,
    };

    if (setProfile) setProfile(updatedProfile);

    if (profile.uid) {
      try {
        await setDoc(
          doc(db, `users/${profile.uid}`),
          cleanDataForFirestore({
            accessibilityPassport: passport,
            accessibilityMode: resolvedMode,
          }),
          { merge: true }
        );
      } catch (err) {
        console.warn('Failed to sync passport to firestore:', err);
      }
    }

    setIsSaving(false);
    toast.success(t('Accessibility Passport saved successfully', 'تم حفظ وتفعيل جواز السفر الميسر بنجاح'));
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md" dir={isAr ? 'rtl' : 'ltr'}>
      <motion.div
        role="dialog"
        aria-modal="true"
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        className="w-full max-w-2xl bg-slate-900 border-2 border-indigo-500/50 rounded-3xl p-5 sm:p-6 shadow-2xl text-white space-y-5 max-h-[90vh] flex flex-col"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-400 shadow-lg">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-black text-base sm:text-lg flex items-center gap-2">
                <span>{t('Universal Accessibility Passport', 'جواز السفر الميسر الشامل', 'Passeport Universel d\'Accessibilité')}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-950 border border-indigo-500/40 text-indigo-300 font-bold">
                  v2.0
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                {t('Your cross-platform profile adapting all features automatically to your needs', 'ملفك الشخصي الموحد لضبط وتكييف كل خصائص المنظومة تلقائياً')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t('Close', 'إغلاق', 'Fermer')}
            className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto space-y-5 pr-1 text-sm">
          {/* 1. Primary Category */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              {t('1. Primary Accessibility Focus:', '1. النمط الأساسي للاحتياج والوصول:', '1. Profil Principal :')}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { id: 'Visual', icon: '👁️', label: t('Visual Ecosystem', 'بصري (كفيف/ضعف بصر)', 'Visuel') },
                { id: 'Deaf', icon: '🧏', label: t('Deaf & Hearing', 'سمعي (أصم/ضعف سمع)', 'Auditif') },
                { id: 'Motor', icon: '♿', label: t('Motor & ALS', 'حركي / ALS / شلل', 'Moteur') },
                { id: 'Neurodiversity', icon: '🧩', label: t('Neurodiversity', 'توحد / عسر قراءة', 'Neurodiversité') },
                { id: 'Multiple', icon: '⚡', label: t('Multiple Needs', 'متعدد الاحتياجات', 'Multiple') },
                { id: 'None', icon: '🌐', label: t('Standard', 'عام / قياسي', 'Standard') },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setPassport({ ...passport, primaryCategory: item.id as AccessibilityMode })}
                  className={`p-3 rounded-2xl border transition-all text-start flex items-center gap-2.5 ${
                    passport.primaryCategory === item.id
                      ? 'bg-indigo-600 border-indigo-400 text-white font-black shadow-lg'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <span className="text-xl">{item.icon}</span>
                  <span className="text-xs leading-tight">{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 2. Visual Accommodations */}
          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5">
            <div className="flex items-center gap-2 font-bold text-xs text-emerald-400">
              <Eye className="w-4 h-4" />
              <span>{t('Visual Accommodations', 'تسهيلات الرؤية والصوت')}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={passport.visualSupport?.autoSpeechReadout ?? true}
                  onChange={(e) =>
                    setPassport({
                      ...passport,
                      visualSupport: { ...passport.visualSupport, autoSpeechReadout: e.target.checked },
                    })
                  }
                  className="rounded text-indigo-600 w-4 h-4"
                />
                <span>{t('Auto-Repeat Aloud (TTS)', 'نطق فوري تلقائي بالصوت')}</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={passport.visualSupport?.hapticAssistance ?? true}
                  onChange={(e) =>
                    setPassport({
                      ...passport,
                      visualSupport: { ...passport.visualSupport, hapticAssistance: e.target.checked },
                    })
                  }
                  className="rounded text-indigo-600 w-4 h-4"
                />
                <span>{t('Tactile Haptic Vibrations', 'تنبيهات اهتزازية لمسية')}</span>
              </label>
            </div>
          </div>

          {/* 3. Hearing Accommodations */}
          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5">
            <div className="flex items-center gap-2 font-bold text-xs text-cyan-400">
              <Ear className="w-4 h-4" />
              <span>{t('Deaf & Hearing Accommodations', 'تسهيلات الصم وضعاف السمع')}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={passport.hearingSupport?.visualAcousticRadar ?? true}
                  onChange={(e) =>
                    setPassport({
                      ...passport,
                      hearingSupport: { ...passport.hearingSupport, visualAcousticRadar: e.target.checked },
                    })
                  }
                  className="rounded text-indigo-600 w-4 h-4"
                />
                <span>{t('Visual Sound Radar', 'رادار الأصوات والمخاطر البصري')}</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={passport.hearingSupport?.reverseSignToSpeech ?? true}
                  onChange={(e) =>
                    setPassport({
                      ...passport,
                      hearingSupport: { ...passport.hearingSupport, reverseSignToSpeech: e.target.checked },
                    })
                  }
                  className="rounded text-indigo-600 w-4 h-4"
                />
                <span>{t('Reverse Sign-to-Speech', 'تحدث صوتي فوري للغة الإشارة')}</span>
              </label>
            </div>
          </div>

          {/* 4. Motor Accommodations */}
          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5">
            <div className="flex items-center gap-2 font-bold text-xs text-amber-400">
              <Activity className="w-4 h-4" />
              <span>{t('Motor & Eye-Gaze Accommodations', 'تسهيلات الحركة وتتبع العين')}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={passport.motorSupport?.emergencySosEnabled ?? true}
                  onChange={(e) =>
                    setPassport({
                      ...passport,
                      motorSupport: { ...passport.motorSupport, emergencySosEnabled: e.target.checked },
                    })
                  }
                  className="rounded text-indigo-600 w-4 h-4"
                />
                <span>{t('4s Eye-Closure Emergency SOS', 'استغاثة الطوارئ بغمض العين 4 ثوانٍ')}</span>
              </label>
            </div>
          </div>

          {/* 5. Neurodiversity Accommodations */}
          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5">
            <div className="flex items-center gap-2 font-bold text-xs text-indigo-400">
              <Brain className="w-4 h-4" />
              <span>{t('Neurodiversity & Sensory Accommodations', 'تسهيلات التوحد وعسر القراءة')}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={passport.neurodiversitySupport?.dyslexiaFont ?? false}
                  onChange={(e) =>
                    setPassport({
                      ...passport,
                      neurodiversitySupport: { ...passport.neurodiversitySupport, dyslexiaFont: e.target.checked },
                    })
                  }
                  className="rounded text-indigo-600 w-4 h-4"
                />
                <span>{t('High-Legibility Dyslexia Font', 'خط عريض وواضح لعسر القراءة')}</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={passport.neurodiversitySupport?.readingRuler ?? false}
                  onChange={(e) =>
                    setPassport({
                      ...passport,
                      neurodiversitySupport: { ...passport.neurodiversitySupport, readingRuler: e.target.checked },
                    })
                  }
                  className="rounded text-indigo-600 w-4 h-4"
                />
                <span>{t('Reading Ruler Bar', 'مسطرة القراءة المضيئة')}</span>
              </label>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-all"
          >
            {t('Cancel', 'إلغاء', 'Annuler')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs flex items-center gap-2 shadow-lg active:scale-95 transition-all disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            <span>{isSaving ? t('Saving...', 'جاري الحفظ...') : t('Save & Activate Passport', 'حفظ وتفعيل الجواز')}</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
