import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shield,
  Heart,
  Users,
  Download,
  Upload,
  AlertCircle,
  CheckCircle2,
  Phone,
  MessageCircle,
  ArrowLeft,
  Settings,
  Activity,
  Eye,
  Mic,
  Brain,
  FileJson,
  Check
} from 'lucide-react';
import { UserProfile } from '../types';
import { EmergencyContact } from '../lib/contacts';
import { loadContacts, restoreContactsFromCloud, sendWhatsAppMessage, isValidContactPhone } from '../lib/contacts';
import { triggerHapticAlert } from '../lib/hapticNavEngine';
import {
  listenPendingCaregiverRequests,
  approveCaregiverLinkRequest,
  rejectCaregiverLinkRequest,
  revokeSpecificCaregiverAccess,
  CaregiverLinkRequest,
} from '../lib/caregiverLinking';
import { isArabicLocale } from '../lib/translations';
import { toast } from './Toast';

interface CaregiverHubProps {
  profile: UserProfile;
  onNavigateBack?: () => void;
  setProfile?: (profile: UserProfile) => void;
  onOpenPassport?: () => void;
}

export default function CaregiverHub({ profile, onNavigateBack, setProfile, onOpenPassport }: CaregiverHubProps) {
  const lang = profile.language || 'Arabic';
  const isAr = isArabicLocale(lang);
  const isFr = lang === 'French';

  const [contacts, setContacts] = useState<EmergencyContact[]>(loadContacts);
  useEffect(() => {
    if (!profile.uid) return;
    restoreContactsFromCloud(profile.uid).then(setContacts);
  }, [profile.uid]);

  // Pending "someone wants to link as your parent/caregiver" requests —
  // the ONLY thing that can ever grant a parent real access is the student
  // approving one of these, which writes linkedParentUid on their own profile.
  const [pendingLinkRequests, setPendingLinkRequests] = useState<CaregiverLinkRequest[]>([]);
  useEffect(() => {
    if (!profile.uid) return;
    const unsubscribe = listenPendingCaregiverRequests(profile.uid, setPendingLinkRequests);
    return unsubscribe;
  }, [profile.uid]);

  // A student can have more than one approved caregiver (a parent AND a
  // specialist, for example) — approve/revoke must add or remove one entry
  // without disturbing whoever else is already linked.
  const linkedCaregivers = profile.linkedCaregivers || [];

  const handleApproveLink = async (req: CaregiverLinkRequest) => {
    if (!profile.uid) return;
    try {
      await approveCaregiverLinkRequest(profile.uid, req.parentUid, req.parentName, req.parentEmail);
      if (setProfile) {
        const already = linkedCaregivers.some((c) => c.uid === req.parentUid);
        setProfile({
          ...profile,
          linkedParentUid: profile.linkedParentUid || req.parentUid,
          authorizedParentUids: [...(profile.authorizedParentUids || []), req.parentUid],
          linkedCaregivers: already
            ? linkedCaregivers
            : [...linkedCaregivers, { uid: req.parentUid, name: req.parentName, email: req.parentEmail, linkedAt: Date.now() }],
        });
      }
      toast.success(isAr ? 'تم قبول الطلب' : isFr ? 'Demande approuvée' : 'Request approved');
    } catch {
      toast.error(isAr ? 'حصل خطأ، حاول تاني' : isFr ? 'Une erreur est survenue' : 'Something went wrong');
    }
  };

  const handleRejectLink = async (parentUid: string) => {
    if (!profile.uid) return;
    try {
      await rejectCaregiverLinkRequest(profile.uid, parentUid);
    } catch {
      toast.error(isAr ? 'حصل خطأ، حاول تاني' : isFr ? 'Une erreur est survenue' : 'Something went wrong');
    }
  };

  const handleRevokeCaregiver = async (caregiverUid: string) => {
    if (!profile.uid) return;
    try {
      await revokeSpecificCaregiverAccess(profile.uid, caregiverUid, linkedCaregivers);
      if (setProfile) {
        const remaining = linkedCaregivers.filter((c) => c.uid !== caregiverUid);
        setProfile({
          ...profile,
          linkedParentUid: profile.linkedParentUid === caregiverUid ? (remaining[0]?.uid || '') : profile.linkedParentUid,
          authorizedParentUids: (profile.authorizedParentUids || []).filter((u) => u !== caregiverUid),
          linkedCaregivers: remaining,
        });
      }
      toast.success(isAr ? 'تم إلغاء الربط' : isFr ? 'Accès révoqué' : 'Access revoked');
    } catch {
      toast.error(isAr ? 'حصل خطأ، حاول تاني' : isFr ? 'Une erreur est survenue' : 'Something went wrong');
    }
  };
  const [testSent, setTestSent] = useState(false);

  const t = (en: string, ar: string, fr?: string) => {
    if (isAr) return ar;
    if (isFr && fr) return fr;
    return en;
  };

  // Export Accessibility Profile JSON
  const handleExportConfig = () => {
    const backup = {
      uid: profile.uid,
      name: profile.name,
      language: profile.language,
      accessibilityMode: profile.accessibilityMode,
      accessibilityPassport: profile.accessibilityPassport,
      visionMemories: profile.visionMemories,
      headTrackingConfig: profile.headTrackingConfig,
      vocalTriggers: profile.vocalTriggers,
      contacts: loadContacts(),
      exportedAt: new Date().toISOString(),
      version: 'Cognify-Access-2.0',
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cognify-access-profile-${profile.name || 'user'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('Profile exported successfully', 'تم تصدير ملف الإعدادات بنجاح'));
  };

  // Test Emergency SOS Dispatch
  const handleTestSOS = () => {
    triggerHapticAlert('warning');
    const primary = contacts.find((c) => c.isPrimaryEmergency) || contacts[0];
    if (primary && isValidContactPhone(primary.phone)) {
      const testMsg = isAr
        ? '🔔 تجربة نظام الطوارئ من Cognify: نداء الاستغاثة يعمل بنجاح!'
        : '🔔 Cognify Emergency SOS Test: Alert system is functioning correctly!';
      sendWhatsAppMessage(primary.phone, testMsg);
      setTestSent(true);
      toast.success(t('Test message opened for primary contact', 'تم تجهيز رسالة التجربة للمرافق'));
      setTimeout(() => setTestSent(false), 3000);
    } else {
      toast.info(t('Please add an emergency contact first', 'سجل رقم المرافق أولاً لإجراء التجربة'));
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-white overflow-y-auto p-4 sm:p-6" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="pb-4 border-b border-slate-800 flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2.5">
          {onNavigateBack && (
            <button
              onClick={onNavigateBack}
              aria-label={t('Back', 'رجوع', 'Retour')}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all"
            >
              <ArrowLeft className={`w-5 h-5 ${isAr ? 'rotate-180' : ''}`} />
            </button>
          )}
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-rose-500/20 border border-rose-400/40 flex items-center justify-center text-rose-400 shadow-lg shadow-rose-950/50">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-black text-sm sm:text-base leading-tight">
                {t('Caregiver & Specialist Command Hub', 'لوحة تحكم المرافق والمختص الطبي', 'Centre Accompagnant & Spécialiste')}
              </h1>
              <p className="text-[11px] text-slate-400">
                {t('Telemetry, safety controls, backup and assistive passport configuration', 'متابعة المؤشرات الحيوية، تجربة الطوارئ، النسخ الاحتياطي وجواز الوصول الميسر')}
              </p>
            </div>
          </div>
        </div>

        {onOpenPassport && (
          <button
            onClick={onOpenPassport}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg active:scale-95 transition-all"
          >
            <span>🛂</span>
            <span>{t('Accessibility Passport', 'جواز السفر الميسر', 'Passeport Accessibilité')}</span>
          </button>
        )}
      </header>

      {/* Main Grid Content */}
      <div className="max-w-5xl mx-auto w-full space-y-6">
        {/* Pending Caregiver Link Requests — the only place a parent's access can be granted */}
        {pendingLinkRequests.length > 0 && (
          <div className="p-4 rounded-3xl bg-amber-500/10 border border-amber-500/30 shadow-lg space-y-3">
            <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
              <Shield className="w-5 h-5" />
              <span>
                {t('Caregiver access requests', 'طلبات ربط مرافق/ولي أمر', "Demandes de liaison d'accompagnant")}
              </span>
            </div>
            {pendingLinkRequests.map((req) => (
              <div
                key={req.parentUid}
                className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="font-bold text-sm text-white truncate">{req.parentName}</div>
                  <div className="text-[11px] text-slate-400 truncate">
                    {t(
                      'wants to view your progress and accessibility settings',
                      'عايز يشوف تقدمك وإعدادات الوصول الميسر بتاعتك',
                      'souhaite voir vos progrès et vos réglages d\'accessibilité'
                    )}
                    {req.parentEmail ? ` · ${req.parentEmail}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleRejectLink(req.parentUid)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-red-500/20 text-slate-300 hover:text-red-300 text-xs font-bold transition-colors"
                  >
                    {t('Decline', 'رفض', 'Refuser')}
                  </button>
                  <button
                    onClick={() => handleApproveLink(req)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors"
                  >
                    {t('Approve', 'موافقة', 'Approuver')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Currently-linked caregivers — a student can have more than one
            (e.g. a parent AND a therapist) approved at the same time, each
            individually revocable without affecting the others. */}
        {linkedCaregivers.length > 0 && (
          <div className="p-4 rounded-3xl bg-slate-900/60 border border-slate-800 shadow-lg space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-slate-200 font-bold text-sm">
                <Users className="w-5 h-5 text-cyan-400" />
                <span>
                  {t('Linked caregivers & specialists', 'المرافقين والمختصين المرتبطين', 'Accompagnants et spécialistes liés')}
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                {linkedCaregivers.length}
              </span>
            </div>
            {linkedCaregivers.map((c) => (
              <div
                key={c.uid}
                className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="font-bold text-sm text-white truncate">{c.name}</div>
                  <div className="text-[11px] text-slate-400 truncate">
                    {c.email}
                    {c.uid === profile.linkedParentUid ? ` · ${t('Primary', 'أساسي', 'Principal')}` : ''}
                  </div>
                </div>
                <button
                  onClick={() => handleRevokeCaregiver(c.uid)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-red-500/20 text-slate-300 hover:text-red-300 text-xs font-bold transition-colors shrink-0"
                >
                  {t('Remove access', 'إلغاء الوصول', 'Retirer')}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Status Telemetry Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
          {/* Vision Telemetry */}
          <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 flex items-center gap-3.5 shadow-lg">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Eye className="w-6 h-6" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400 font-bold uppercase">{t('Visual Memories', 'ذاكرة الأشخاص والأشياء')}</div>
              <div className="text-xl font-black text-white">{profile.visionMemories?.length || 0} {t('Items', 'عنصر')}</div>
            </div>
          </div>

          {/* Euphonia Telemetry */}
          <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 flex items-center gap-3.5 shadow-lg">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Mic className="w-6 h-6" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400 font-bold uppercase">{t('Vocal Triggers', 'محفزات النطق (إيفونيا)')}</div>
              <div className="text-xl font-black text-white">{profile.vocalTriggers?.length || 3} {t('Tuned', 'مضبوط')}</div>
            </div>
          </div>

          {/* Contacts Telemetry */}
          <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 flex items-center gap-3.5 shadow-lg">
            <div className="w-11 h-11 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
              <Phone className="w-6 h-6" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400 font-bold uppercase">{t('Emergency Contacts', 'أرقام الطوارئ')}</div>
              <div className="text-xl font-black text-white">{contacts.length} {t('Saved', 'مسجل')}</div>
            </div>
          </div>

          {/* Passport Telemetry */}
          <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 flex items-center gap-3.5 shadow-lg">
            <div className="w-11 h-11 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400 font-bold uppercase">{t('Passport Mode', 'نمط الجواز الميسر')}</div>
              <div className="text-sm font-black text-indigo-300 truncate">
                {profile.accessibilityPassport?.primaryCategory || profile.accessibilityMode || t('Standard', 'قياسي')}
              </div>
            </div>
          </div>
        </div>

        {/* Safety & SOS Testing Section */}
        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="font-black text-base flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-400" />
                <span>{t('Safety & Emergency SOS Verification', 'فحص واختبار أمان نداء الاستغاثة والطوارئ')}</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {t('Test the emergency dispatch pipeline to ensure caregiver notification works reliably.', 'تأكد من وصول رسائل الطوارئ لجهات الاتصال المسجلة بدون مشاكل.')}
              </p>
            </div>

            <button
              onClick={handleTestSOS}
              className={`px-4 py-2.5 rounded-2xl font-bold text-xs flex items-center gap-2 shadow-lg active:scale-95 transition-all ${
                testSent ? 'bg-emerald-600 text-white' : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/50'
              }`}
            >
              {testSent ? <Check className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
              <span>{testSent ? t('Test Sent!', 'تم الإرسال!') : t('Send Test SOS', 'إرسال نداء تجريبي')}</span>
            </button>
          </div>

          {/* Registered Emergency Contacts List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-2">
            {contacts.map((c) => (
              <div key={c.id} className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-bold text-xs text-white flex items-center gap-1.5">
                    <span>{isAr ? (c.nameAr || c.nameEn) : c.nameEn}</span>
                    {c.isPrimaryEmergency && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-rose-900 text-rose-300 font-bold">{t('Primary', 'أساسي')}</span>}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">{c.phone || t('No number', 'بدون رقم')}</div>
                </div>
                {c.phone && (
                  <button
                    onClick={() => sendWhatsAppMessage(c.phone, t('Test message from Cognify Caregiver Hub', 'رسالة تجربة من لوحة مرافق Cognify'))}
                    className="p-2 rounded-xl bg-emerald-600/30 text-emerald-300 hover:bg-emerald-600/50 transition-all"
                    title="WhatsApp"
                  >
                    <MessageCircle className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Configuration Backup & Migration */}
        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
          <div>
            <h3 className="font-black text-base flex items-center gap-2">
              <FileJson className="w-5 h-5 text-indigo-400" />
              <span>{t('Configuration Backup & Clinical Export', 'النسخ الاحتياطي وتصدير التقرير للمختص')}</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {t('Save all user tunings, eye calibrations, and phrase banks as a portable JSON file.', 'احفظ كل الإعدادات ومعايرة تتبع العين والكلمات كملف يمكن نقله أو استرجاعه في أي وقت.')}
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={handleExportConfig}
              className="px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg active:scale-95 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>{t('Download JSON Backup', 'تحميل نسخة احتياطية (JSON)')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
