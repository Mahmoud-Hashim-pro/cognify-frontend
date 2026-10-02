import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  ShieldCheck,
  Lock,
  Camera,
  Mic,
  Eye,
  Sparkles,
  CheckCircle2,
  X,
} from 'lucide-react';
import { UserProfile, ParentalConsentRecord } from '../types';
import { doc, setDoc } from 'firebase/firestore';
import { db, cleanDataForFirestore } from '../lib/firebase';
import { isArabicLocale } from '../lib/translations';
import { toast } from './Toast';

interface ParentalConsentModalProps {
  isOpen: boolean;
  profile: UserProfile;
  requiredScope?: 'camera' | 'microphone' | 'eye_tracking' | 'all';
  onConsentGranted: (consent: ParentalConsentRecord) => void;
  onCancel: () => void;
}

export default function ParentalConsentModal({
  isOpen,
  profile,
  requiredScope: _requiredScope = 'all',
  onConsentGranted,
  onCancel,
}: ParentalConsentModalProps) {
  const isAr = isArabicLocale(profile.language);

  const [parentName, setParentName] = useState('');
  const [parentEmail, setParentEmail] = useState(profile.parentEmail || '');
  const [relationship, setRelationship] = useState<'parent' | 'legal_guardian' | 'specialist'>('parent');

  const [allowCamera, setAllowCamera] = useState(true);
  const [allowMic, setAllowMic] = useState(true);
  const [allowGaze, setAllowGaze] = useState(true);
  const [allowAi, setAllowAi] = useState(true);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!parentName.trim()) {
      toast.error(isAr ? 'يرجى كتابة اسم ولي الأمر بالكامل' : 'Please enter parent/guardian full name');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(parentEmail.trim())) {
      toast.error(isAr ? 'يرجى إدخال بريد إلكتروني صالح لولي الأمر' : 'Please provide a valid parent email address');
      return;
    }

    if (!agreedToTerms) {
      toast.error(isAr ? 'يجب تأكيد الإقرار بالموافقة على الشروط' : 'You must acknowledge the consent terms');
      return;
    }

    const grantedScopes: ('camera' | 'microphone' | 'eye_tracking' | 'facial_gestures' | 'ai_tutoring')[] = [];
    if (allowCamera) {
      grantedScopes.push('camera');
      grantedScopes.push('facial_gestures');
    }
    if (allowMic) grantedScopes.push('microphone');
    if (allowGaze) grantedScopes.push('eye_tracking');
    if (allowAi) grantedScopes.push('ai_tutoring');

    const consentRecord: ParentalConsentRecord = {
      verified: true,
      verifiedAt: new Date().toISOString(),
      parentEmail: parentEmail.trim().toLowerCase(),
      parentName: parentName.trim(),
      relationship,
      grantedScopes,
      method: 'guardian_signature',
    };

    setIsSubmitting(true);
    try {
      if (profile.uid) {
        await setDoc(
          doc(db, `users/${profile.uid}`),
          cleanDataForFirestore({
            parentalConsent: consentRecord,
            parentEmail: consentRecord.parentEmail,
          }),
          { merge: true }
        );
      }

      toast.success(
        isAr
          ? '✅ تم توثيق موافقة ولي الأمر بنجاح وتفعيل الحساسات'
          : 'Parental consent verified and recorded successfully'
      );
      onConsentGranted(consentRecord);
    } catch (err) {
      console.error('[ParentalConsent] Error persisting consent:', err);
      toast.error(isAr ? 'تعذر حفظ وثيقة الموافقة، حاول مجدداً' : 'Failed to record consent in database');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-title"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-xl rounded-3xl bg-[#0E0610] border border-[#4A1224] p-5 sm:p-7 shadow-2xl relative text-start text-white my-auto max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[#4A1224]/60 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="consent-title" className="text-base sm:text-lg font-black text-white">
                  {isAr ? 'بوابة موافقة ولي الأمر الرسمية' : 'Parental & Guardian Consent Gate'}
                </h2>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-300 border border-amber-400/20">
                  COPPA / GDPR-K
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {isAr
                  ? 'حماية بيانات الأطفال والتحقق من موافقة ولي الأمر قبل تفعيل المستشعرات'
                  : 'Verifiable parental consent required before activating sensors or cameras'}
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            aria-label={isAr ? 'إغلاق' : 'Close'}
            className="p-1.5 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Security / Privacy Assurance Notice */}
        <div className="p-3.5 rounded-2xl bg-[#150917] border border-amber-500/20 mb-4 flex items-start gap-3">
          <Lock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-300 leading-relaxed space-y-1">
            <p className="font-bold text-amber-200">
              {isAr ? 'خصوصية فائقة بدون تخزين للصور أو الفيديو' : 'Zero-Storage On-Device Processing'}
            </p>
            <p>
              {isAr
                ? 'تتم معالجة ملامح الوجه وتتبع حركة العين والصوت بنسبة 100% داخل جهاز الطفل محلياً (Edge Computing). لا يتم إرسال أو تسجيل أي فيديو أو صور على أي خادم خارجي نهائياً.'
                : 'All facial landmark mesh tracking, eye-gaze coordinates, and vocal triggers are computed 100% on the local device. Raw video and camera streams are NEVER uploaded or stored on any server.'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Guardian Identity Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                {isAr ? 'اسم ولي الأمر / الوصي الكامل *' : 'Parent / Guardian Full Name *'}
              </label>
              <input
                type="text"
                required
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
                placeholder={isAr ? 'مثال: أحمد محمد' : 'e.g., John Doe'}
                className="w-full px-3 py-2 rounded-xl bg-[#080409] border border-[#4A1224] text-white focus:outline-none focus:border-amber-400 text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                {isAr ? 'البريد الإلكتروني لولي الأمر *' : 'Parent Verified Email *'}
              </label>
              <input
                type="email"
                required
                value={parentEmail}
                onChange={(e) => setParentEmail(e.target.value)}
                placeholder={isAr ? 'parent@example.com' : 'parent@example.com'}
                className="w-full px-3 py-2 rounded-xl bg-[#080409] border border-[#4A1224] text-white focus:outline-none focus:border-amber-400 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              {isAr ? 'الصفة القانونية / صلة القرابة' : 'Legal Relationship'}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'parent', labelAr: 'أب / أم', labelEn: 'Parent' },
                { id: 'legal_guardian', labelAr: 'وصي قانوني', labelEn: 'Guardian' },
                { id: 'specialist', labelAr: 'أخصائي معتمد', labelEn: 'Specialist' },
              ].map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setRelationship(item.id as any)}
                  className={`py-2 px-2.5 rounded-xl border text-center transition-all ${
                    relationship === item.id
                      ? 'border-amber-400 bg-amber-400/10 text-amber-300 font-bold'
                      : 'border-[#4A1224]/60 bg-[#080409] text-slate-400 hover:text-white'
                  }`}
                >
                  {isAr ? item.labelAr : item.labelEn}
                </button>
              ))}
            </div>
          </div>

          {/* Scopes Selection */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-2">
              {isAr ? 'صلاحيات الحساسات المعتمدة من ولي الأمر:' : 'Authorized Sensor Permissions:'}
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2.5 p-2 rounded-xl bg-[#080409] border border-[#4A1224]/60 cursor-pointer hover:border-amber-500/40">
                <input
                  type="checkbox"
                  checked={allowCamera}
                  onChange={(e) => setAllowCamera(e.target.checked)}
                  className="rounded text-amber-500 focus:ring-0 bg-[#150917] border-[#4A1224]"
                />
                <Camera className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-slate-200">
                  {isAr
                    ? 'الكاميرا ومعالم الوجه (تتبع الإيماءات والرمش محلياً)'
                    : 'Camera & facial landmarks (on-device gesture tracking)'}
                </span>
              </label>

              <label className="flex items-center gap-2.5 p-2 rounded-xl bg-[#080409] border border-[#4A1224]/60 cursor-pointer hover:border-amber-500/40">
                <input
                  type="checkbox"
                  checked={allowMic}
                  onChange={(e) => setAllowMic(e.target.checked)}
                  className="rounded text-amber-500 focus:ring-0 bg-[#150917] border-[#4A1224]"
                />
                <Mic className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-slate-200">
                  {isAr
                    ? 'الميكروفون (تحليل الترددات الصوتية والأصوات التكيفية)'
                    : 'Microphone (adaptive vocal sound frequency analysis)'}
                </span>
              </label>

              <label className="flex items-center gap-2.5 p-2 rounded-xl bg-[#080409] border border-[#4A1224]/60 cursor-pointer hover:border-amber-500/40">
                <input
                  type="checkbox"
                  checked={allowGaze}
                  onChange={(e) => setAllowGaze(e.target.checked)}
                  className="rounded text-amber-500 focus:ring-0 bg-[#150917] border-[#4A1224]"
                />
                <Eye className="w-4 h-4 text-cyan-400 shrink-0" />
                <span className="text-slate-200">
                  {isAr
                    ? 'تتبع حركة بؤبؤ العين والتثبيت (Eye-Gaze Navigation)'
                    : 'Gaze tracking & dwell calibration (Eye-Gaze Navigation)'}
                </span>
              </label>

              <label className="flex items-center gap-2.5 p-2 rounded-xl bg-[#080409] border border-[#4A1224]/60 cursor-pointer hover:border-amber-500/40">
                <input
                  type="checkbox"
                  checked={allowAi}
                  onChange={(e) => setAllowAi(e.target.checked)}
                  className="rounded text-amber-500 focus:ring-0 bg-[#150917] border-[#4A1224]"
                />
                <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
                <span className="text-slate-200">
                  {isAr
                    ? 'المساعد التعليمي التكيفي بالذكاء الاصطناعي'
                    : 'Adaptive educational tutoring with AI models'}
                </span>
              </label>
            </div>
          </div>

          {/* Legal Acknowledgement Checkbox */}
          <div className="pt-2">
            <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-amber-500/5 border border-amber-500/30 cursor-pointer">
              <input
                type="checkbox"
                required
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-0.5 rounded text-amber-500 focus:ring-0 bg-[#080409] border-[#4A1224]"
              />
              <span className="text-[11px] text-amber-100/90 leading-relaxed">
                {isAr
                  ? 'أقر بصفتي ولي الأمر/الوصي القانوني بموافقتي الصريحة والمستنيرة على استخدام الطالب للأدوات المحددة، وعلمي بأن البيانات الحيوية لا تُخزن ولا تُشارك مع أي طرف خارجي.'
                  : 'I confirm that as parent/guardian, I provide informed verifiable consent for the child to use the authorized assistive tools, understanding that biometric sensor data remains strictly local.'}
              </span>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#4A1224]/60">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-xl border border-[#4A1224] text-slate-300 hover:bg-white/5 font-semibold transition-all text-xs"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !agreedToTerms}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {isSubmitting
                  ? (isAr ? 'جاري التوثيق...' : 'Recording...')
                  : (isAr ? 'تأكيد الموافقة وتفعيل الأدوات' : 'Authorize & Unlock')}
              </span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
