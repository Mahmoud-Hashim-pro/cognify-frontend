import React, { useState, useRef, useEffect } from 'react';
import { UserProfile, StudentMemory } from '../types';
import { localize, isArabicLocale } from '../lib/translations';
import { toast } from './Toast';
import {
  updateStudentMemory,
  addMemoryItem,
  deleteMemoryItem,
  toggleMemoryEnabled,
  DEFAULT_STUDENT_MEMORY,
} from '../lib/memory';
import {
  Brain,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Plus,
  Trash2,
  Lock,
  Eye,
  EyeOff,
  RefreshCw,
  AlertCircle,
  Clock,
  BookOpen,
  Heart,
  Compass,
  Zap,
  ChevronDown,
  ChevronUp,
  Info,
  Menu,
  ArrowLeft,
  Globe,
  Sliders,
  Target,
  UserCheck,
  CheckCircle2,
} from 'lucide-react';

interface StudentMemoryPageProps {
  profile: UserProfile;
  memory: StudentMemory | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onMenuClick?: () => void;
  onNavigateBack?: () => void;
  onUseFallbackMemory?: () => void;
}

export default function StudentMemoryPage({
  profile,
  memory,
  loading,
  error,
  onRetry,
  onMenuClick,
  onNavigateBack,
  onUseFallbackMemory,
}: StudentMemoryPageProps) {
  const isAr = isArabicLocale(profile.language);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // Input states for adding items to the 3 list categories
  const [newGoal, setNewGoal] = useState('');
  const [newPreference, setNewPreference] = useState('');
  const [newConfirmedInfo, setNewConfirmedInfo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Preferred Language & Explanation Style dropdown / select options
  const languageOptions = [
    'English',
    'Arabic',
    'Egyptian Arabic',
    'French',
    'Spanish',
    'German',
  ];

  const styleOptions = [
    'Practical examples first',
    'Deep academic explanation',
    'Short and direct sentences',
    'Step-by-step visual breakdown',
    'Socratic question-guided learning',
  ];

  // If loading and completely without memory, render within the full accessible page shell
  if (loading && !memory) {
    return (
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-10 max-w-5xl mx-auto space-y-6 bg-[#080409] text-slate-100 relative selection:bg-[#E5A93C]/30 selection:text-[#E5A93C] min-h-screen font-sans">
        {/* Ambient Lighting Orbs */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
          <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[140px]" />
          <div className="absolute top-1/2 -right-40 w-[600px] h-[600px] bg-[#4A1224]/30 rounded-full blur-[140px]" />
          <div className="absolute -bottom-40 left-1/3 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[140px]" />
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#4A1224]/60 pb-5">
          <div className="flex items-center gap-3.5">
            {onNavigateBack && (
              <button
                onClick={onNavigateBack}
                className="p-2.5 text-slate-400 hover:text-white bg-[#0E0610]/90 hover:bg-[#150917]/90 border border-[#4A1224]/60 rounded-xl active:scale-95 transition-all flex items-center gap-1.5 shrink-0 shadow-md"
                title={localize(profile.language, 'Back to Assistant', 'العودة للمساعد')}
              >
                <ArrowLeft className="w-5 h-5 rtl:rotate-180" />
                <span className="text-xs font-bold hidden sm:inline">{localize(profile.language, 'Back', 'رجوع')}</span>
              </button>
            )}
            {onMenuClick && (
              <button
                onClick={onMenuClick}
                className="p-2.5 text-slate-400 hover:text-white bg-[#0E0610]/90 hover:bg-[#150917]/90 border border-[#4A1224]/60 rounded-xl active:scale-95 transition-all shrink-0 shadow-md"
                aria-label={localize(profile.language, 'Toggle menu', 'القائمة')}
                title={localize(profile.language, 'Open Menu', 'فتح القائمة')}
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
            <div className="w-12 h-12 rounded-2xl bg-[#4A1224]/30 border border-[#E5A93C]/20 text-[#E5A93C] flex items-center justify-center shrink-0 shadow-inner">
              <Brain className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white flex items-center gap-2 tracking-tight">
                {localize(profile.language, 'Cognify Memory', 'ذاكرة كوجنيفي')}
                <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#4A1224]/40 text-[#E5A93C] border border-[#E5A93C]/30">
                  Phase 2
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                {localize(
                  profile.language,
                  'Transparent, privacy-first memory profile stored securely in Firestore.',
                  'ذاكرة شفافة وخصوصية أولاً مخزنة بأمان في فايراستور.'
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Loading Card with actions */}
        <div className="flex flex-col items-center justify-center p-12 text-center my-12 bg-[#0E0610]/95 border border-[#4A1224]/60 rounded-3xl shadow-2xl max-w-lg mx-auto space-y-4">
          <div className="w-12 h-12 rounded-full border-4 border-[#E5A93C]/20 border-t-[#E5A93C] animate-spin mb-2" />
          <h3 className="text-base font-bold text-white">
            {localize(profile.language, 'Loading your memory profile from Firestore...', 'جاري تحميل ملف الذاكرة من فايراستور...')}
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
            {localize(
              profile.language,
              'Connecting securely to sync your goals, preferences, and personalized learning style.',
              'جاري الاتصال السحابي الآمن لمزامنة أهدافك وتفضيلاتك وأسلوب التعلم المخصص.'
            )}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
            {onUseFallbackMemory && (
              <button
                onClick={onUseFallbackMemory}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#4A1224] to-[#831843] hover:from-[#60172F] hover:to-[#9D174D] border border-[#E5A93C]/40 text-[#E5A93C] hover:text-white text-xs font-bold transition-all shadow-md active:scale-95"
              >
                {localize(profile.language, 'Continue with Offline Memory', 'متابعة بالذاكرة المحلية')}
              </button>
            )}
            {onNavigateBack && (
              <button
                onClick={onNavigateBack}
                className="px-4 py-2.5 rounded-xl bg-[#150917] border border-[#4A1224]/60 text-slate-300 hover:text-white text-xs font-bold transition-all active:scale-95"
              >
                {localize(profile.language, 'Back to Assistant', 'العودة للمساعد')}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // If error and completely without memory, render friendly error with retry and offline buttons
  if (error && !memory) {
    return (
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-10 max-w-5xl mx-auto space-y-6 bg-[#080409] text-slate-100 relative selection:bg-[#E5A93C]/30 selection:text-[#E5A93C] min-h-screen font-sans">
        {/* Ambient Lighting Orbs */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
          <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[140px]" />
          <div className="absolute top-1/2 -right-40 w-[600px] h-[600px] bg-[#4A1224]/30 rounded-full blur-[140px]" />
          <div className="absolute -bottom-40 left-1/3 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[140px]" />
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#4A1224]/60 pb-5">
          <div className="flex items-center gap-3.5">
            {onNavigateBack && (
              <button
                onClick={onNavigateBack}
                className="p-2.5 text-slate-400 hover:text-white bg-[#0E0610]/90 hover:bg-[#150917]/90 border border-[#4A1224]/60 rounded-xl active:scale-95 transition-all flex items-center gap-1.5 shrink-0 shadow-md"
                title={localize(profile.language, 'Back to Assistant', 'العودة للمساعد')}
              >
                <ArrowLeft className="w-5 h-5 rtl:rotate-180" />
                <span className="text-xs font-bold hidden sm:inline">{localize(profile.language, 'Back', 'رجوع')}</span>
              </button>
            )}
            {onMenuClick && (
              <button
                onClick={onMenuClick}
                className="p-2.5 text-slate-400 hover:text-white bg-[#0E0610]/90 hover:bg-[#150917]/90 border border-[#4A1224]/60 rounded-xl active:scale-95 transition-all shrink-0 shadow-md"
                aria-label={localize(profile.language, 'Toggle menu', 'القائمة')}
                title={localize(profile.language, 'Open Menu', 'فتح القائمة')}
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
            <div className="w-12 h-12 rounded-2xl bg-[#4A1224]/30 border border-[#E5A93C]/20 text-[#E5A93C] flex items-center justify-center shrink-0 shadow-inner">
              <Brain className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white flex items-center gap-2 tracking-tight">
                {localize(profile.language, 'Cognify Memory', 'ذاكرة كوجنيفي')}
                <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#4A1224]/40 text-[#E5A93C] border border-[#E5A93C]/30">
                  Phase 2
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                {localize(
                  profile.language,
                  'Transparent, privacy-first memory profile stored securely in Firestore.',
                  'ذاكرة شفافة وخصوصية أولاً مخزنة بأمان في فايراستور.'
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Error Card */}
        <div className="flex flex-col items-center justify-center p-10 max-w-lg mx-auto text-center my-12 bg-[#0E0610]/95 border border-[#4A1224]/60 rounded-3xl shadow-2xl space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mb-1">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-white">
            {localize(profile.language, 'Unable to Load Cognify Memory', 'تعذر تحميل ذاكرة كوجنيفي')}
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
            {error || localize(profile.language, 'Firestore connection is offline or unavailable. You can retry connection or use local memory.', 'الاتصال بفايراستور غير متاح حالياً. يمكنك إعادة المحاولة أو استخدام الذاكرة المحلية.')}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
            <button
              onClick={onRetry}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-bold hover:brightness-110 transition-all shadow-md active:scale-95"
            >
              <RefreshCw className="w-4 h-4" />
              <span>{localize(profile.language, 'Retry Connection', 'إعادة المحاولة')}</span>
            </button>
            {onUseFallbackMemory && (
              <button
                onClick={onUseFallbackMemory}
                className="px-4 py-2.5 bg-[#4A1224]/40 hover:bg-[#4A1224]/70 border border-[#E5A93C]/40 text-[#E5A93C] rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"
              >
                {localize(profile.language, 'Use Offline Memory', 'استخدام الذاكرة المحلية')}
              </button>
            )}
            {onNavigateBack && (
              <button
                onClick={onNavigateBack}
                className="px-4 py-2.5 bg-[#150917] border border-[#4A1224]/60 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all active:scale-95"
              >
                {localize(profile.language, 'Back', 'رجوع')}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Fallback to default memory if memory is null so page renders properly
  const safeMemory = memory || {
    enabled: false,
    preferredLanguage: 'English',
    explanationStyle: 'Practical examples first',
    learningGoals: [],
    knownPreferences: [],
    explicitConfirmedInfo: [],
    updatedAt: new Date().toISOString(),
  };

  const handleToggle = async () => {
    if (!profile?.uid) return;
    try {
      setIsSubmitting(true);
      await toggleMemoryEnabled(profile.uid, !safeMemory.enabled);
      toast.success(
        !safeMemory.enabled
          ? localize(profile.language, 'Cognify Memory enabled.', 'تم تفعيل ذاكرة كوجنيفي.')
          : localize(profile.language, 'Cognify Memory disabled.', 'تم تعطيل ذاكرة كوجنيفي.'),
        localize(profile.language, 'Memory Updated', 'تم تحديث الذاكرة')
      );
    } catch (err) {
      console.error('Failed to toggle memory:', err);
      toast.error(
        localize(profile.language, 'Failed to update memory setting.', 'فشل تحديث إعداد الذاكرة.'),
        localize(profile.language, 'Error', 'خطأ')
      );
    } finally {
      if (isMountedRef.current) setIsSubmitting(false);
    }
  };

  const handleLanguageChange = async (newLang: string) => {
    if (!profile?.uid) return;
    try {
      await updateStudentMemory(profile.uid, { preferredLanguage: newLang });
      toast.success(
        localize(profile.language, 'Language preference saved.', 'تم حفظ لغة الشرح المفضلة.'),
        localize(profile.language, 'Saved', 'تم الحفظ')
      );
    } catch (err) {
      console.error('Failed to update language preference:', err);
      toast.error(
        localize(profile.language, 'Failed to save language preference.', 'فشل حفظ لغة الشرح المفضلة.'),
        localize(profile.language, 'Error', 'خطأ')
      );
    }
  };

  const handleStyleChange = async (newStyle: string) => {
    if (!profile?.uid) return;
    try {
      await updateStudentMemory(profile.uid, { explanationStyle: newStyle });
      toast.success(
        localize(profile.language, 'Style preference saved.', 'تم حفظ أسلوب الشرح المفضل.'),
        localize(profile.language, 'Saved', 'تم الحفظ')
      );
    } catch (err) {
      console.error('Failed to update explanation style:', err);
      toast.error(
        localize(profile.language, 'Failed to save style preference.', 'فشل حفظ أسلوب الشرح.'),
        localize(profile.language, 'Error', 'خطأ')
      );
    }
  };

  const handleAddItem = async (
    category: 'learningGoals' | 'knownPreferences' | 'explicitConfirmedInfo',
    value: string,
    resetFn: () => void
  ) => {
    if (!profile?.uid || !value.trim()) return;
    try {
      setIsSubmitting(true);
      await addMemoryItem(profile.uid, safeMemory, category, value);
      resetFn();
      toast.success(
        localize(profile.language, 'Item added to memory.', 'تمت إضافة العنصر إلى الذاكرة.'),
        localize(profile.language, 'Added', 'تمت الإضافة')
      );
    } catch (err) {
      console.error(`Failed to add item to ${category}:`, err);
      toast.error(
        localize(profile.language, 'Failed to add item. Check connection.', 'فشل حفظ العنصر. تحقق من الاتصال.'),
        localize(profile.language, 'Error', 'خطأ')
      );
    } finally {
      if (isMountedRef.current) setIsSubmitting(false);
    }
  };

  const handleDeleteItem = async (
    category: 'learningGoals' | 'knownPreferences' | 'explicitConfirmedInfo',
    index: number
  ) => {
    if (!profile?.uid) return;
    try {
      await deleteMemoryItem(profile.uid, safeMemory, category, index);
      toast.success(
        localize(profile.language, 'Item forgotten.', 'تم نسيان العنصر.'),
        localize(profile.language, 'Deleted', 'تم الحذف')
      );
    } catch (err) {
      console.error(`Failed to delete item from ${category}:`, err);
      toast.error(
        localize(profile.language, 'Failed to delete item.', 'فشل حذف العنصر.'),
        localize(profile.language, 'Error', 'خطأ')
      );
    }
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-10 max-w-5xl mx-auto space-y-6 bg-[#080409] text-slate-100 relative selection:bg-[#E5A93C]/30 selection:text-[#E5A93C] min-h-screen font-sans">
      {/* Ambient Lighting Orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[140px]" />
        <div className="absolute top-1/2 -right-40 w-[600px] h-[600px] bg-[#4A1224]/30 rounded-full blur-[140px]" />
        <div className="absolute -bottom-40 left-1/3 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[140px]" />
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#4A1224]/60 pb-5">
        <div className="flex items-center gap-3.5">
          {onNavigateBack && (
            <button
              onClick={onNavigateBack}
              className="p-2.5 text-slate-400 hover:text-white bg-[#0E0610]/90 hover:bg-[#150917]/90 border border-[#4A1224]/60 rounded-xl active:scale-95 transition-all flex items-center gap-1.5 shrink-0 shadow-md"
              title={localize(profile.language, 'Back to Assistant', 'العودة للمساعد')}
            >
              <ArrowLeft className="w-5 h-5 rtl:rotate-180" />
              <span className="text-xs font-bold hidden sm:inline">{localize(profile.language, 'Back', 'رجوع')}</span>
            </button>
          )}
          {onMenuClick && (
            <button
              onClick={onMenuClick}
              className="p-2.5 text-slate-400 hover:text-white bg-[#0E0610]/90 hover:bg-[#150917]/90 border border-[#4A1224]/60 rounded-xl active:scale-95 transition-all shrink-0 shadow-md"
              aria-label={localize(profile.language, 'Toggle menu', 'القائمة')}
              title={localize(profile.language, 'Open Menu', 'فتح القائمة')}
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          <div className="w-12 h-12 rounded-2xl bg-[#4A1224]/30 border border-[#E5A93C]/20 text-[#E5A93C] flex items-center justify-center shrink-0 shadow-inner">
            <Brain className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2 tracking-tight">
              {localize(profile.language, 'Cognify Memory', 'ذاكرة كوجنيفي')}
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#4A1224]/40 text-[#E5A93C] border border-[#E5A93C]/30">
                Phase 2
              </span>
              {loading && (
                <span className="text-[11px] font-bold text-[#E5A93C] flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#4A1224]/50 border border-[#E5A93C]/40 animate-pulse">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  {localize(profile.language, 'Syncing...', 'مزامنة...')}
                </span>
              )}
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              {localize(
                profile.language,
                'Transparent, privacy-first memory profile stored securely in Firestore.',
                'ذاكرة شفافة وخصوصية أولاً مخزنة بأمان في فايراستور.'
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Master Privacy Switch Card */}
      <div className="p-6 rounded-3xl bg-[#0E0610]/95 border border-[#4A1224]/60 shadow-2xl backdrop-blur-xl space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className={`p-3 rounded-2xl shrink-0 ${
                safeMemory.enabled
                  ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                  : 'bg-slate-800 border border-[#4A1224]/50 text-slate-400'
              }`}
            >
              {safeMemory.enabled ? <ShieldCheck className="w-6 h-6" /> : <Shield className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-white text-base">
                  {localize(profile.language, 'Memory Personalization Status', 'حالة تخصيص الذاكرة')}
                </h3>
                <span
                  className={`text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                    safeMemory.enabled
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400 border border-[#4A1224]/50'
                  }`}
                >
                  {safeMemory.enabled
                    ? localize(profile.language, 'Active (Opted In)', 'مفعّل (بموافقتك)')
                    : localize(profile.language, 'Disabled (Privacy Default)', 'معطّل (الافتراضي للخصوصية)')}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed max-w-2xl font-medium">
                {localize(
                  profile.language,
                  'When enabled, Cognify passes your stored preferences and goals to the AI during study sessions. When disabled, AI operates without any memory context. Default is privacy-first (Disabled).',
                  'عند التفعيل، يرسل كوجنيفي تفضيلاتك وأهدافك المخزنة للمساعد الذكي أثناء الجلسة. عند التعطيل، يعمل المساعد بدون ذاكرة.'
                )}
              </p>
            </div>
          </div>

          <button
            onClick={handleToggle}
            disabled={isSubmitting}
            className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              safeMemory.enabled ? 'bg-gradient-to-r from-amber-400 via-[#E5A93C] to-rose-600' : 'bg-slate-800'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                safeMemory.enabled ? (isAr ? '-translate-x-5' : 'translate-x-5') : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Language & Explanation Style Preferences */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Preferred Language */}
        <div className="p-6 rounded-3xl bg-[#0E0610]/95 border border-[#4A1224]/60 shadow-2xl backdrop-blur-xl space-y-3">
          <div className="flex items-center gap-2.5 text-slate-200 font-bold text-xs uppercase tracking-wider">
            <Globe className="w-4 h-4 text-[#E5A93C]" />
            {localize(profile.language, 'Preferred Explanation Language', 'لغة الشرح المفضلة')}
          </div>
          <select
            value={safeMemory.preferredLanguage || 'English'}
            onChange={(e) => handleLanguageChange(e.target.value)}
            disabled={!safeMemory.enabled}
            className="w-full px-4 py-3 rounded-2xl bg-[#080409] border border-[#4A1224]/60 text-white text-xs font-semibold focus:border-[#E5A93C]/60 focus:ring-2 focus:ring-[#E5A93C]/30 outline-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {languageOptions.map((lang) => (
              <option key={lang} value={lang} className="bg-[#150917] text-white">
                {lang}
              </option>
            ))}
          </select>
        </div>

        {/* Explanation Style */}
        <div className="p-6 rounded-3xl bg-[#0E0610]/95 border border-[#4A1224]/60 shadow-2xl backdrop-blur-xl space-y-3">
          <div className="flex items-center gap-2.5 text-slate-200 font-bold text-xs uppercase tracking-wider">
            <Sliders className="w-4 h-4 text-[#E5A93C]" />
            {localize(profile.language, 'Explanation Style Preference', 'أسلوب الشرح المفضل')}
          </div>
          <select
            value={safeMemory.explanationStyle || 'Practical examples first'}
            onChange={(e) => handleStyleChange(e.target.value)}
            disabled={!safeMemory.enabled}
            className="w-full px-4 py-3 rounded-2xl bg-[#080409] border border-[#4A1224]/60 text-white text-xs font-semibold focus:border-[#E5A93C]/60 focus:ring-2 focus:ring-[#E5A93C]/30 outline-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {styleOptions.map((style) => (
              <option key={style} value={style} className="bg-[#150917] text-white">
                {style}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Memory Category 1: Current Learning Goals */}
      <div className="p-6 rounded-3xl bg-[#0E0610]/95 border border-[#4A1224]/60 shadow-2xl backdrop-blur-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Target className="w-5 h-5 text-[#E5A93C]" />
            <h3 className="font-black text-white text-base">
              {localize(profile.language, 'Current Learning Goals', 'أهداف التعلم الحالية')}
            </h3>
          </div>
          <span className="text-xs font-mono font-bold text-[#E5A93C] px-2.5 py-0.5 rounded-full bg-[#4A1224]/30 border border-[#E5A93C]/20">
            {safeMemory.learningGoals?.length || 0} {localize(profile.language, 'goals', 'أهداف')}
          </span>
        </div>

        {/* List of goals */}
        <div className="space-y-2">
          {(!safeMemory.learningGoals || safeMemory.learningGoals.length === 0) ? (
            <p className="text-xs text-slate-500 italic py-2">
              {localize(profile.language, 'No learning goals specified yet.', 'لم يتم تحديد أهداف تعلم بعد.')}
            </p>
          ) : (
            safeMemory.learningGoals.map((goal, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-[#080409] border border-[#4A1224]/60 text-xs font-semibold text-slate-200 shadow-inner group"
              >
                <span>{goal}</span>
                <button
                  onClick={() => handleDeleteItem('learningGoals', idx)}
                  className="p-1.5 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/20 transition-colors"
                  title={localize(profile.language, 'Forget this goal', 'احذف هذا الهدف')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Add goal form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAddItem('learningGoals', newGoal, () => setNewGoal(''));
          }}
          className="flex items-center gap-2 pt-2 border-t border-[#4A1224]/60"
        >
          <input
            type="text"
            value={newGoal}
            onChange={(e) => setNewGoal(e.target.value)}
            placeholder={localize(
              profile.language,
              'Add a learning goal (e.g. Master Calculus Integration)...',
              'أضف هدف تعلم (مثال: إتقان التفاضل والتكامل)...'
            )}
            className="flex-1 px-4 py-3 rounded-2xl bg-[#080409] border border-[#4A1224]/60 text-xs text-white placeholder-slate-500 font-semibold focus:border-[#E5A93C]/60 focus:ring-2 focus:ring-[#E5A93C]/30 outline-none"
          />
          <button
            type="submit"
            disabled={!newGoal.trim() || isSubmitting}
            className="px-4 py-3 rounded-2xl bg-gradient-to-r from-amber-400 via-[#E5A93C] to-rose-600 hover:from-amber-400 hover:to-blue-500 text-white text-xs font-black uppercase tracking-wider transition-all disabled:opacity-40 flex items-center gap-1.5 shrink-0 shadow-lg shadow-[#E5A93C]/20 active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            {localize(profile.language, 'Add Goal', 'إضافة')}
          </button>
        </form>
      </div>

      {/* Memory Category 2: Known Preferences */}
      <div className="p-6 rounded-3xl bg-[#0E0610]/95 border border-[#4A1224]/60 shadow-2xl backdrop-blur-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-[#E5A93C]" />
            <h3 className="font-black text-white text-base">
              {localize(profile.language, 'Known Preferences', 'التفضيلات المعروفة')}
            </h3>
          </div>
          <span className="text-xs font-mono font-bold text-[#E5A93C] px-2.5 py-0.5 rounded-full bg-[#4A1224]/30 border border-[#E5A93C]/20">
            {safeMemory.knownPreferences?.length || 0} {localize(profile.language, 'items', 'عناصر')}
          </span>
        </div>

        {/* List of preferences */}
        <div className="space-y-2">
          {(!safeMemory.knownPreferences || safeMemory.knownPreferences.length === 0) ? (
            <p className="text-xs text-slate-500 italic py-2">
              {localize(profile.language, 'No study preferences added yet.', 'لم يتم إضافة تفضيلات دراسية بعد.')}
            </p>
          ) : (
            safeMemory.knownPreferences.map((pref, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-[#080409] border border-[#4A1224]/60 text-xs font-semibold text-slate-200 shadow-inner group"
              >
                <span>{pref}</span>
                <button
                  onClick={() => handleDeleteItem('knownPreferences', idx)}
                  className="p-1.5 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/20 transition-colors"
                  title={localize(profile.language, 'Forget this preference', 'احذف هذا التفضيل')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Add preference form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAddItem('knownPreferences', newPreference, () => setNewPreference(''));
          }}
          className="flex items-center gap-2 pt-2 border-t border-[#4A1224]/60"
        >
          <input
            type="text"
            value={newPreference}
            onChange={(e) => setNewPreference(e.target.value)}
            placeholder={localize(
              profile.language,
              'Add a preference (e.g. Prefers bulleted summary at the end)...',
              'أضف تفضيل (مثال: يفضل ملخص نقاط في النهاية)...'
            )}
            className="flex-1 px-4 py-3 rounded-2xl bg-[#080409] border border-[#4A1224]/60 text-xs text-white placeholder-slate-500 font-semibold focus:border-[#E5A93C]/60 focus:ring-2 focus:ring-[#E5A93C]/30 outline-none"
          />
          <button
            type="submit"
            disabled={!newPreference.trim() || isSubmitting}
            className="px-4 py-3 rounded-2xl bg-gradient-to-r from-amber-400 via-[#E5A93C] to-rose-600 hover:from-amber-400 hover:to-blue-500 text-white text-xs font-black uppercase tracking-wider transition-all disabled:opacity-40 flex items-center gap-1.5 shrink-0 shadow-lg shadow-[#E5A93C]/20 active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            {localize(profile.language, 'Add Preference', 'إضافة')}
          </button>
        </form>
      </div>

      {/* Memory Category 3: Explicitly Confirmed Information */}
      <div className="p-6 rounded-3xl bg-[#0E0610]/95 border border-[#4A1224]/60 shadow-2xl backdrop-blur-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <UserCheck className="w-5 h-5 text-emerald-400" />
            <h3 className="font-black text-white text-base flex items-center gap-2">
              {localize(profile.language, 'Explicitly Confirmed Information', 'المعلومات المؤكدة صراحة')}
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                {localize(profile.language, 'Confirmed by You', 'مؤكدة من قبلك')}
              </span>
            </h3>
          </div>
          <span className="text-xs font-mono font-bold text-emerald-400 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            {safeMemory.explicitConfirmedInfo?.length || 0} {localize(profile.language, 'facts', 'حقائق')}
          </span>
        </div>

        {/* List of confirmed info */}
        <div className="space-y-2">
          {(!safeMemory.explicitConfirmedInfo || safeMemory.explicitConfirmedInfo.length === 0) ? (
            <p className="text-xs text-slate-500 italic py-2">
              {localize(profile.language, 'No confirmed student facts added yet.', 'لم يتم إضافة معلومات مؤكدة بعد.')}
            </p>
          ) : (
            safeMemory.explicitConfirmedInfo.map((info, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-[#080409] border border-[#4A1224]/60 text-xs font-semibold text-slate-200 shadow-inner group"
              >
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{info}</span>
                </div>
                <button
                  onClick={() => handleDeleteItem('explicitConfirmedInfo', idx)}
                  className="p-1.5 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/20 transition-colors"
                  title={localize(profile.language, 'Forget this item', 'احذف هذه المعلومة')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Add confirmed info form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAddItem('explicitConfirmedInfo', newConfirmedInfo, () => setNewConfirmedInfo(''));
          }}
          className="flex items-center gap-2 pt-2 border-t border-[#4A1224]/60"
        >
          <input
            type="text"
            value={newConfirmedInfo}
            onChange={(e) => setNewConfirmedInfo(e.target.value)}
            placeholder={localize(
              profile.language,
              'Add confirmed fact (e.g. Preparing for Senior Physics Final)...',
              'أضف حقيقة مؤكدة (مثال: يستعد للامتحان النهائي في الفيزياء)...'
            )}
            className="flex-1 px-4 py-3 rounded-2xl bg-[#080409] border border-[#4A1224]/60 text-xs text-white placeholder-slate-500 font-semibold focus:border-[#E5A93C]/60 focus:ring-2 focus:ring-[#E5A93C]/30 outline-none"
          />
          <button
            type="submit"
            disabled={!newConfirmedInfo.trim() || isSubmitting}
            className="px-4 py-3 rounded-2xl bg-gradient-to-r from-amber-400 via-[#E5A93C] to-rose-600 hover:from-amber-400 hover:to-blue-500 text-white text-xs font-black uppercase tracking-wider transition-all disabled:opacity-40 flex items-center gap-1.5 shrink-0 shadow-lg shadow-[#E5A93C]/20 active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            {localize(profile.language, 'Add Fact', 'إضافة')}
          </button>
        </form>
      </div>

      {/* Footer Timestamp Notice */}
      <div className="text-center text-xs text-slate-500 pt-2 pb-6">
        {localize(profile.language, 'Last updated in Firestore:', 'آخر تحديث في فايراستور:')}{' '}
        <span className="font-mono text-[#E5A93C]">{safeMemory.updatedAt ? new Date(safeMemory.updatedAt).toLocaleString() : 'N/A'}</span>
      </div>
    </div>
  );
}
