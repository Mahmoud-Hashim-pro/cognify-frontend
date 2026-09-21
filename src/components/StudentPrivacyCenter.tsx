import React, { useState } from 'react';
import { Shield, Download, Trash2, CheckCircle2, AlertTriangle, Database, Info, FileText, UserX, Loader2 } from 'lucide-react';
import { UserProfile, StudentMemory } from '../types';
import { StudentState, getStudentStateManager } from '../lib/studentStateEngine';
import { localize, isArabicLocale } from '../lib/translations';
import { db, auth } from '../lib/firebase';
import { collection, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { deleteUser, signOut } from 'firebase/auth';
import { getLearningEventHistory } from '../lib/learningEvents';
import { getSpatialObjects } from '../lib/spatialMemoryEngine';

interface StudentPrivacyCenterProps {
  profile: UserProfile;
  memory?: StudentMemory | null;
  studentState?: StudentState | null;
  onClearMemory?: () => Promise<void>;
  onClose?: () => void;
}

export default function StudentPrivacyCenter({
  profile,
  memory,
  studentState,
  onClearMemory,
  onClose,
}: StudentPrivacyCenterProps) {
  const [isClearing, setIsClearing] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [clearedSuccess, setClearedSuccess] = useState(false);

  // Permanent Account Deletion states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null);

  // Data Export state
  const [isExporting, setIsExporting] = useState(false);

  const isAr = isArabicLocale(profile.language);
  const L = (en: string, ar: string) => localize(profile.language, en, ar);

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      // 1. Fetch complete learning events history
      const events = await getLearningEventHistory(profile.uid, 500).catch(() => []);

      // 2. Fetch spatial memory objects and movement history
      const spatial = getSpatialObjects(profile.uid);

      // 3. Fetch conversational threads
      const threads: any[] = [];
      try {
        const threadsSnap = await getDocs(collection(db, 'users', profile.uid, 'threads'));
        threadsSnap.forEach((d) => threads.push({ id: d.id, ...d.data() }));
      } catch {}

      // 4. Fetch academic goals
      const goals: any[] = [];
      try {
        const goalsSnap = await getDocs(collection(db, 'users', profile.uid, 'goals'));
        goalsSnap.forEach((d) => goals.push({ id: d.id, ...d.data() }));
      } catch {}

      const exportBundle = {
        exportVersion: '2.0.0',
        exportDate: new Date().toISOString(),
        specification: 'Cognify 2.0 Complete Machine-Readable Learning & Account Archive',
        complianceStandard: 'GDPR Article 20 (Data Portability), FERPA, Egyptian Data Protection Law No. 151 of 2020',
        studentProfile: {
          uid: profile.uid,
          name: profile.name,
          email: profile.email,
          academicLevel: profile.level,
          cognitiveLevel: profile.cognitiveLevel,
          field: profile.field,
          accessibilityMode: profile.accessibilityMode,
          language: profile.language,
          points: profile.points,
          onboardingComplete: profile.onboardingComplete,
          lastActiveDate: profile.lastActiveDate || null,
        },
        aiMemory: memory || null,
        studentState: (() => {
          const resolved = studentState || (profile.uid ? getStudentStateManager(profile.uid).getState() : null);
          return {
            cognitiveStage: resolved?.cognitiveStage || 'foundational',
            activePedagogy: resolved?.activePedagogy || 'scaffolded',
            pedagogyEffectiveness: resolved?.pedagogyEffectiveness || {},
            conceptMastery: resolved?.conceptMastery || {},
            retentionSchedules: resolved?.retentionSchedules || {},
            activeInterventions: resolved?.activeInterventions || {},
            learningStrain: resolved?.learningStrain || {},
            totalExercisesCompleted: resolved?.totalExercisesCompleted || 0,
          };
        })(),
        learningEvents: events,
        spatialMemory: spatial,
        conversationalThreads: threads,
        academicGoals: goals,
      };

      const blob = new Blob([JSON.stringify(exportBundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cognify_full_archive_${profile.uid.substring(0, 8)}_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export comprehensive data archive:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePermanentAccountDeletion = async () => {
    const required = profile.email ? profile.email.toLowerCase().trim() : 'delete';
    const input = deleteConfirmText.toLowerCase().trim();
    if (input !== required && input !== 'delete' && input !== 'حذف') {
      setDeleteAccountError(L('Confirmation text does not match.', 'النص المدخل غير مطابق لكلمة التأكيد.'));
      return;
    }

    setIsDeletingAccount(true);
    setDeleteAccountError(null);

    try {
      // 1. Cascade delete all subcollections
      const subcollections = ['learningEvents', 'threads', 'studentState', 'goals', 'courses', 'notes', 'attendance', 'planner'];
      for (const sub of subcollections) {
        try {
          const colRef = collection(db, 'users', profile.uid, sub);
          const snap = await getDocs(colRef);
          const deletes = snap.docs.map((d) => deleteDoc(d.ref));
          await Promise.all(deletes);
        } catch (e) {
          console.warn(`Could not clear subcollection ${sub}:`, e);
        }
      }

      // 2. Delete root user document in Firestore
      try {
        await deleteDoc(doc(db, 'users', profile.uid));
      } catch (e) {
        console.warn('Could not delete root user document:', e);
      }

      // 3. Purge all local storage keys
      try {
        if (typeof localStorage !== 'undefined') {
          const keysToRemove: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && (k.startsWith('cognify_') || k.startsWith('firebase:'))) {
              keysToRemove.push(k);
            }
          }
          keysToRemove.forEach((k) => localStorage.removeItem(k));
        }
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.clear();
        }
      } catch (e) {
        console.warn('Could not clear local storage:', e);
      }

      // 4. Delete Firebase Auth user
      const currentUser = auth.currentUser;
      if (currentUser) {
        try {
          await deleteUser(currentUser);
        } catch (authErr: any) {
          if (authErr?.code === 'auth/requires-recent-login') {
            await signOut(auth);
            window.location.reload();
            return;
          }
          console.warn('Firebase Auth deleteUser warning:', authErr);
        }
      }

      // 5. Sign out and reload
      try {
        await signOut(auth);
      } catch {}
      window.location.reload();
    } catch (err: any) {
      console.error('Account deletion error:', err);
      setDeleteAccountError(err?.message || L('Failed to permanently delete account.', 'فشل حذف الحساب نهائياً.'));
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleConfirmClear = async () => {
    if (!onClearMemory) return;
    setIsClearing(true);
    try {
      await onClearMemory();
      setClearedSuccess(true);
      setShowConfirmModal(false);
      setTimeout(() => setClearedSuccess(false), 4000);
    } catch (err) {
      console.error('Failed to clear memory:', err);
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6 text-start">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-teal-500/15 text-teal-400 border border-teal-500/30">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">
              {L('Student Privacy & Data Sovereignty', 'مركز خصوصية وسيادة بيانات الطالب')}
            </h1>
            <p className="text-xs text-slate-400">
              {L(
                'Full transparency, exportability, and control over your AI memory and learning telemetry.',
                'الشفافية الكاملة، تصدير البيانات، والتحكم التام في ذاكرة الذكاء الاصطناعي ومعلومات التعلم.'
              )}
            </p>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-bold transition-all"
          >
            {L('Back to App', 'العودة للتطبيق')}
          </button>
        )}
      </div>

      {clearedSuccess && (
        <div className="p-4 rounded-2xl bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{L('AI memory and interaction history have been securely wiped.', 'تم مسح ذاكرة الذكاء الاصطناعي وسجل التفاعل بأمان.')}</span>
        </div>
      )}

      {/* Grid: Export & Control Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Export Data Card */}
        <div className="p-5 rounded-2xl bg-[#121524] border border-slate-800 space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-cyan-400">
              <Download className="w-5 h-5" />
              <h2 className="text-sm font-black text-white">{L('Export Complete Archive', 'تصدير أرشيف التعلم الشامل')}</h2>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              {L(
                'Download a comprehensive machine-readable JSON archive of your profile, learning events history, concept masteries, private chat threads, and spatial memory records (GDPR Art. 20 & Egyptian Law 151 compliant).',
                'تحميل أرشيف شامل بصيغة JSON يحتوي على ملفك الشخصي، سجل الأحداث التعليمية، استيعاب المفاهيم، محادثات الذكاء الاصطناعي، والذاكرة المكانية.'
              )}
            </p>
          </div>
          <button
            onClick={handleExportData}
            disabled={isExporting}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 transition-all active:scale-95 disabled:opacity-50"
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin text-cyan-400" /> : <FileText className="w-4 h-4 text-cyan-400" />}
            <span>{isExporting ? L('Generating Archive...', 'جاري تحضير الأرشيف...') : L('Download Full Archive', 'تحميل الأرشيف الشامل')}</span>
          </button>
        </div>

        {/* Data Erasure Card */}
        <div className="p-5 rounded-2xl bg-[#121524] border border-slate-800 space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-amber-400">
              <Trash2 className="w-5 h-5" />
              <h2 className="text-sm font-black text-white">{L('Reset AI Memory & Calibration', 'مسح ذاكرة المساعد الذكي')}</h2>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              {L(
                'Permanently wipe inferred habits, confirmed preferences, and adaptive pedagogical scores. Your account stays active while tutor calibration resets to neutral.',
                'مسح العادات المستنتجة والتفضيلات ودرجات التكيف مع الحفاظ على الحساب وإعادة ضبط معايرة المعلم للوضع الافتراضي.'
              )}
            </p>
          </div>
          <button
            onClick={() => setShowConfirmModal(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/30 transition-all active:scale-95"
          >
            <Trash2 className="w-4 h-4" />
            <span>{L('Reset Memory Cache', 'إعادة ضبط الذاكرة')}</span>
          </button>
        </div>

        {/* Full Account Deletion Card */}
        <div className="p-5 rounded-2xl bg-[#121524] border border-rose-900/40 space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-rose-400">
              <UserX className="w-5 h-5" />
              <h2 className="text-sm font-black text-white">{L('Delete Account Permanently', 'حذف الحساب نهائياً')}</h2>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              {L(
                'Permanently erase your entire account, all learning events, chat threads, student states, and cloud credentials. This action is irreversible.',
                'حذف حسابك نهائياً مع كافة سجلات التعلم ومحادثات الشات واستيعاب المفاهيم والمصادقة. إجراء نهائي لا يمكن التراجع عنه.'
              )}
            </p>
          </div>
          <button
            onClick={() => {
              setDeleteConfirmText('');
              setDeleteAccountError(null);
              setShowDeleteModal(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs font-black border border-rose-500/40 transition-all active:scale-95"
          >
            <UserX className="w-4 h-4" />
            <span>{L('Delete My Account', 'حذف حسابي')}</span>
          </button>
        </div>
      </div>

      {/* Memory Provenance Explorer */}
      <div className="p-5 rounded-2xl bg-[#121524] border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white font-black text-sm">
            <Database className="w-4 h-4 text-teal-400" />
            <span>{L('Active Memory Items & Provenance', 'عناصر الذاكرة النشطة ومصدر البيانات')}</span>
          </div>
          <span className="text-[11px] text-slate-400 font-semibold">
            {L('Source Provenance: Explicit vs. Inferred', 'سجل المصدر: مدخل يدوي مقابل استنتاج')}
          </span>
        </div>

        {memory?.explicitConfirmedInfo && memory.explicitConfirmedInfo.length > 0 ? (
          <div className="space-y-2">
            {memory.explicitConfirmedInfo.map((fact, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2 text-slate-200 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                  <span>{fact}</span>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-teal-500/15 text-teal-300 border border-teal-500/30">
                  {L('User Confirmed', 'مؤكد من الطالب')}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 text-center text-slate-500 text-xs rounded-xl bg-slate-900/40 border border-slate-800/60">
            <Info className="w-4 h-4 mx-auto mb-1.5 opacity-60" />
            <span>{L('No personal memory facts recorded yet. Chat history is stored in your private thread archive.', 'لا توجد حقائق ذاكرة مسجلة حالياً. سجل المحادثات محفوظ في أرشيفك الخاص.')}</span>
          </div>
        )}
      </div>

      {/* Reset Memory Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="max-w-md w-full bg-[#16192b] border border-slate-700 rounded-3xl p-6 shadow-2xl space-y-4 text-start">
            <div className="flex items-center gap-2.5 text-amber-400">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-base font-black text-white">{L('Confirm Memory Reset', 'تأكيد إعادة ضبط الذاكرة')}</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {L(
                'Are you sure you want to delete all personal memory items and learned preferences? Your account will remain active, but adaptive AI preferences will be reset.',
                'هل أنت متأكد من رغبتك في حذف جميع عناصر الذاكرة والتفضيلات المستنتجة؟ سيبقى حسابك نشطاً مع إعادة التكيف للوضع الافتراضي.'
              )}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-bold transition-all"
              >
                {L('Cancel', 'إلغاء')}
              </button>
              <button
                onClick={handleConfirmClear}
                disabled={isClearing}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black transition-all flex items-center gap-1.5 shadow-lg shadow-amber-500/20"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isClearing ? L('Resetting...', 'جاري المسح...') : L('Yes, Reset Memory', 'نعم، أعد ضبط الذاكرة')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permanent Account Deletion Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="max-w-md w-full bg-[#141624] border border-rose-600/50 rounded-3xl p-6 shadow-2xl space-y-4 text-start">
            <div className="flex items-center gap-2.5 text-rose-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-black text-white">{L('Permanently Delete Account', 'تأكيد الحذف النهائي للحساب')}</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {L(
                'This will permanently delete your authentication record, profile, all learning events, AI chats, and student states from our cloud databases. This action CANNOT be undone.',
                'سيؤدي هذا الإجراء لحذف حسابك وكل سجلات التعلم والمحادثات وحالات الطالب من قواعد البيانات السحابية بشكل نهائي لا يمكن استرجاعه.'
              )}
            </p>

            <div className="space-y-1.5 pt-2">
              <label className="text-[11px] font-bold text-slate-400">
                {L(
                  `Type "${profile.email || 'DELETE'}" to confirm permanent erasure:`,
                  `اكتب "${profile.email || 'DELETE'}" لتأكيد الحذف النهائي:`
                )}
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={profile.email || 'DELETE'}
                className="w-full px-3.5 py-2.5 bg-[#0A0C14] border border-slate-700 rounded-xl text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-rose-500"
              />
            </div>

            {deleteAccountError && (
              <p className="text-xs text-rose-400 font-bold bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20">
                {deleteAccountError}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeletingAccount}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-bold transition-all"
              >
                {L('Cancel', 'إلغاء')}
              </button>
              <button
                onClick={handlePermanentAccountDeletion}
                disabled={isDeletingAccount || !deleteConfirmText.trim()}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black transition-all flex items-center gap-1.5 shadow-lg shadow-rose-600/30 disabled:opacity-40"
              >
                {isDeletingAccount ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserX className="w-3.5 h-3.5" />}
                <span>{isDeletingAccount ? L('Erasing Account...', 'جاري الحذف النهائي...') : L('Permanently Delete', 'تأكيد الحذف النهائي')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}