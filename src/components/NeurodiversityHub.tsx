import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  Heart,
  Smile,
  Frown,
  Meh,
  AlertTriangle,
  Flame,
  Wind,
  CheckCircle2,
  Circle,
  Plus,
  Volume2,
  VolumeX,
  BookOpen,
  Eye,
  Settings,
  ArrowLeft,
  Calendar,
  Layers,
  Clock,
  Trash2,
  Palette,
  Sun,
  Shield,
  X,
  History,
  Send,
  MessageSquareWarning,
  Activity,
  PhoneCall
} from 'lucide-react';
import { UserProfile, PECSCard, SensoryEmotionLog } from '../types';
import { speak } from '../lib/tts';
import { triggerHapticAlert } from '../lib/hapticNavEngine';
import { isArabicLocale } from '../lib/translations';
import { toast } from './Toast';
import {
  loadPecsCards,
  savePecsCards,
  addCustomPecsCard,
  deletePecsCard,
  loadVisualSchedule,
  saveVisualSchedule,
  toggleScheduleItemDone,
  addScheduleItem,
  deleteScheduleItem,
  VisualScheduleItem,
  recordSensoryLog,
  getRecentSensoryLogs,
  dispatchMeltdownCaregiverAlert,
} from '../lib/neurodiversityEngine';
import VisualComfortModal from './VisualComfortModal';

interface NeurodiversityHubProps {
  profile: UserProfile;
  onNavigateBack?: () => void;
  onOpenLearningHub?: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  food: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300',
  feelings: 'bg-amber-500/20 border-amber-500/40 text-amber-300',
  routine: 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300',
  play: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300',
  medical: 'bg-rose-500/20 border-rose-500/40 text-rose-300',
  needs: 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300',
};

export default function NeurodiversityHub({ profile, onNavigateBack, onOpenLearningHub }: NeurodiversityHubProps) {
  const lang = profile.language || 'Arabic';
  const isAr = isArabicLocale(lang);
  const isFr = lang === 'French';

  const [activeSubTab, setActiveSubTab] = useState<'pecs' | 'schedule' | 'emotions'>('pecs');
  const [showVisualComfortModal, setShowVisualComfortModal] = useState(false);
  
  // ── 1. PERSISTENT PECS CARDS ──
  const [pecsCards, setPecsCards] = useState<PECSCard[]>([]);
  const [pecsFilter, setPecsFilter] = useState<string>('all');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [showAddCardModal, setShowAddCardModal] = useState(false);
  
  // New Card Form State
  const [newCardLabelAr, setNewCardLabelAr] = useState('');
  const [newCardLabelEn, setNewCardLabelEn] = useState('');
  const [newCardPhraseAr, setNewCardPhraseAr] = useState('');
  const [newCardPhraseEn, setNewCardPhraseEn] = useState('');
  const [newCardIcon, setNewCardIcon] = useState('⭐');
  const [newCardCategory, setNewCardCategory] = useState<'food' | 'feelings' | 'routine' | 'play' | 'medical' | 'needs'>('needs');

  // ── 2. PERSISTENT VISUAL SCHEDULE ──
  const [schedule, setSchedule] = useState<VisualScheduleItem[]>([]);
  const [showAddScheduleModal, setShowAddScheduleModal] = useState(false);
  const [newSchTime, setNewSchTime] = useState('11:00 AM');
  const [newSchTitleAr, setNewSchTitleAr] = useState('');
  const [newSchTitleEn, setNewSchTitleEn] = useState('');
  const [newSchIcon, setNewSchIcon] = useState('⭐');

  // ── 3. SENSORY & EMOTION REGULATION ──
  const [currentEmotionLevel, setCurrentEmotionLevel] = useState<1 | 2 | 3 | 4 | 5>(2);
  const [isBreathingActive, setIsBreathingActive] = useState(false);
  const [breathingPhase, setBreathingPhase] = useState<'inhale' | 'hold' | 'exhale'>('inhale');
  const [breathingCount, setBreathingCount] = useState(4);
  const [recentLogs, setRecentLogs] = useState<SensoryEmotionLog[]>([]);
  const [showLogsDrawer, setShowLogsDrawer] = useState(false);
  const [dispatchStatus, setDispatchStatus] = useState<{
    state: 'idle' | 'dispatching' | 'delivered' | 'fallback';
    message?: string;
    channels?: string[];
    dispatchedAt?: string;
    fallbackDirectCall?: boolean;
    caregiverPhone?: string;
  }>({ state: 'idle' });
  const [showCaregiverBeacon, setShowCaregiverBeacon] = useState(false);

  const breathingTimerRef = useRef<any>(null);

  const t = (en: string, ar: string, fr?: string) => {
    if (isAr) return ar;
    if (isFr && fr) return fr;
    return en;
  };

  // Initial Load from Persistent Store
  useEffect(() => {
    loadPecsCards(profile.uid).then(setPecsCards);
    loadVisualSchedule(profile.uid).then(setSchedule);
    getRecentSensoryLogs(profile.uid, 15).then(setRecentLogs);
  }, [profile.uid]);

  // Speak PECS card
  const speakCard = (card: PECSCard) => {
    setSelectedCardId(card.id);
    const phrase = isAr ? card.phraseAr : isFr && card.phraseFr ? card.phraseFr : card.phraseEn;
    speak(phrase, isAr ? 'Arabic' : isFr ? 'French' : 'English');
    triggerHapticAlert('arrival');
    setTimeout(() => setSelectedCardId(null), 1200);
  };

  // Add Custom PECS Card
  const handleCreateCustomCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCardLabelAr.trim() && !newCardLabelEn.trim()) {
      toast.error(t('Please enter card label', 'يرجى كتابة عنوان البطاقة'));
      return;
    }

    const newCard: PECSCard = {
      id: `pecs-custom-${Date.now()}`,
      labelAr: newCardLabelAr.trim() || newCardLabelEn.trim(),
      labelEn: newCardLabelEn.trim() || newCardLabelAr.trim(),
      phraseAr: newCardPhraseAr.trim() || newCardLabelAr.trim(),
      phraseEn: newCardPhraseEn.trim() || newCardLabelEn.trim(),
      category: newCardCategory,
      icon: newCardIcon || '⭐',
      color: CATEGORY_COLORS[newCardCategory] || 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300',
    };

    const updated = await addCustomPecsCard(profile.uid, newCard);
    setPecsCards(updated);
    setShowAddCardModal(false);
    setNewCardLabelAr('');
    setNewCardLabelEn('');
    setNewCardPhraseAr('');
    setNewCardPhraseEn('');
    toast.success(t('New PECS card added and saved!', 'تمت إضافة بطاقة PECS وحفظها بنجاح!'));
  };

  // Delete PECS Card
  const handleDeleteCard = async (e: React.MouseEvent, cardId: string) => {
    e.stopPropagation();
    const updated = await deletePecsCard(profile.uid, cardId);
    setPecsCards(updated);
    toast.info(t('Card removed', 'تم حذف البطاقة'));
  };

  // Toggle Schedule Item Done
  const handleToggleSchedule = async (id: string) => {
    const updated = await toggleScheduleItemDone(profile.uid, id);
    setSchedule(updated);
  };

  // Add Schedule Item
  const handleAddSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSchTitleAr.trim() && !newSchTitleEn.trim()) return;

    const newItem: VisualScheduleItem = {
      id: `sch-${Date.now()}`,
      time: newSchTime,
      titleAr: newSchTitleAr.trim() || newSchTitleEn.trim(),
      titleEn: newSchTitleEn.trim() || newSchTitleAr.trim(),
      titleFr: newSchTitleEn.trim() || newSchTitleAr.trim(),
      icon: newSchIcon || '⭐',
      done: false,
    };

    const updated = await addScheduleItem(profile.uid, newItem);
    setSchedule(updated);
    setShowAddScheduleModal(false);
    setNewSchTitleAr('');
    setNewSchTitleEn('');
    toast.success(t('Schedule task saved', 'تمت إضافة المهمة للجدول وحفظها'));
  };

  // Delete Schedule Item
  const handleDeleteScheduleItem = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = await deleteScheduleItem(profile.uid, id);
    setSchedule(updated);
    toast.info(t('Task removed', 'تم حذف المهمة'));
  };

  // Emotion Level Change & Persistent Logging + Server-Side Meltdown Dispatch
  const handleSelectEmotionLevel = async (lvl: 1 | 2 | 3 | 4 | 5) => {
    setCurrentEmotionLevel(lvl);

    const levelMap: Record<number, SensoryEmotionLog['level']> = {
      1: 'calm',
      2: 'happy',
      3: 'tired',
      4: 'anxious',
      5: 'overwhelmed',
    };

    const triggerLabels: Record<number, string> = {
      1: 'بيئة هادئة ومستقرة',
      2: 'مزاج ممتاز وتفاعل إيجابي',
      3: 'شعور بالإرهاق أو الملل',
      4: 'ضغط حسي وضوضاء محيطة',
      5: 'انفجار حسي وإجهاد مفرط (Sensory Meltdown)',
    };

    const log = await recordSensoryLog(
      profile.uid,
      {
        level: levelMap[lvl] || 'calm',
        intensity: lvl,
        sensoryTrigger: triggerLabels[lvl],
        comfortActivityUsed: lvl >= 4 ? 'فقاعة التنفس الهادئ (Breathing Bubble)' : undefined,
      },
      profile.name
    );

    setRecentLogs((prev) => [log, ...prev]);

    if (lvl === 5) {
      setIsBreathingActive(true);
      setShowCaregiverBeacon(true);
      setTimeout(() => setShowCaregiverBeacon(false), 10000);

      const res = log.dispatchResult;
      const timeNow = new Date().toLocaleTimeString(isAr ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      if (res?.success && !res?.fallbackDirectCall) {
        setDispatchStatus({
          state: 'delivered',
          message: res.message,
          channels: res.channels,
          dispatchedAt: timeNow,
        });
        toast.success(
          t(
            `Meltdown alert delivered via: ${res.channels?.join(', ')}`,
            `تم تسليم إشعار الأزمة للمرافق بنجاح عبر: ${res.channels?.join('، ')}`
          )
        );
      } else {
        setDispatchStatus({
          state: 'fallback',
          message: res?.message || t('Server channels unavailable. Direct call fallback activated.', 'تعذر الإرسال عبر قنوات الخادم. تم تفعيل الاتصال المباشر.'),
          fallbackDirectCall: true,
          caregiverPhone: res?.details?.caregiverPhone,
          dispatchedAt: timeNow,
        });
        toast.warning(
          t(
            'Server channels unavailable. Direct call fallback activated.',
            'قنوات الخادم غير متاحة. تم تفعيل الاتصال المباشر بالمرافق.'
          )
        );
      }
    } else if (lvl === 4) {
      setIsBreathingActive(true);
      toast.info(t('High sensory load detected. Let\'s breathe calmly.', 'رصدنا ضغطاً حسياً مرتفعاً. يلا نتنفس بهدوء معاً.'));
    } else {
      toast.success(t('Feeling logged successfully', 'تم تسجيل حالتك في سجلك الحسي'));
    }
  };

  // Breathing Exercise Loop
  useEffect(() => {
    if (!isBreathingActive) {
      if (breathingTimerRef.current) clearInterval(breathingTimerRef.current);
      return;
    }

    let phase: 'inhale' | 'hold' | 'exhale' = 'inhale';
    let count = 4;
    setBreathingPhase(phase);
    setBreathingCount(count);

    breathingTimerRef.current = setInterval(() => {
      count--;
      if (count <= 0) {
        if (phase === 'inhale') {
          phase = 'hold';
          count = 4;
        } else if (phase === 'hold') {
          phase = 'exhale';
          count = 4;
        } else {
          phase = 'inhale';
          count = 4;
        }
        setBreathingPhase(phase);
      }
      setBreathingCount(count);
    }, 1000);

    return () => {
      if (breathingTimerRef.current) clearInterval(breathingTimerRef.current);
    };
  }, [isBreathingActive]);

  const filteredPecs = pecsFilter === 'all' ? pecsCards : pecsCards.filter((c) => c.category === pecsFilter);

  return (
    <div
      className={`flex-1 flex flex-col h-full bg-slate-950 text-white overflow-hidden select-none relative transition-all duration-700 ${
        showCaregiverBeacon ? 'ring-4 ring-amber-400/60 shadow-[0_0_80px_rgba(251,191,36,0.3)]' : ''
      }`}
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {/* Universal Visual Comfort Modal */}
      <VisualComfortModal
        isOpen={showVisualComfortModal}
        onClose={() => setShowVisualComfortModal(false)}
        language={lang}
      />

      {/* Visual Ambient Beacon Notification for Nearby Caregiver */}
      {showCaregiverBeacon && (
        <div className="bg-amber-500/20 border-b border-amber-500/40 text-amber-200 text-xs px-4 py-2 flex items-center justify-between animate-pulse z-30">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
            <span className="font-bold">
              {t(
                'Ambient Room Beacon Active: Calming visual cue for nearby caregiver (no auditory distress)',
                'منارة الغرفة البصرية نشطة: وميض هادئ لتنبيه المرافق القريب دون إزعاج سمعي للطفل'
              )}
            </span>
          </div>
          <button
            onClick={() => setShowCaregiverBeacon(false)}
            className="text-amber-300 hover:text-white text-[11px] underline px-2 py-0.5"
          >
            {t('Dismiss Beacon', 'إلغاء المنارة')}
          </button>
        </div>
      )}

      {/* Header Bar */}
      <header className="p-3 sm:p-4 border-b border-slate-800 flex items-center justify-between gap-3 bg-slate-900/90 backdrop-blur-xl z-20 flex-wrap">
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
            <div className="w-9 h-9 rounded-2xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-400 shadow-lg shadow-indigo-950/50">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-black text-sm sm:text-base leading-tight flex items-center gap-2">
                <span>{t('Neurodiversity & Autism Hub', 'واحة التوحد والاضطرابات النمائية', 'Pôle Neurodiversité & Autisme')}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-500/40 text-emerald-300 font-normal">
                  {t('Server Dispatched & Persistent', 'محفوظ سحابياً ومربوط بمركز الرعاية', 'Persistant')}
                </span>
              </h1>
              <p className="text-[11px] text-slate-400">
                {t('Customizable PECS communication cards, visual routine schedules & server-side meltdown early alerts', 'بطاقات PECS قابلة للتخصيص، روتين بصري منظم، والإنذار المبكر للأزمات عبر الخادم')}
              </p>
            </div>
          </div>
        </div>

        {/* Subtabs Selector */}
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-2xl border border-slate-800 text-xs font-bold flex-wrap">
          <button
            onClick={() => setActiveSubTab('pecs')}
            className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
              activeSubTab === 'pecs' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>🧩</span>
            <span>{t('PECS Cards', 'بطاقات بيكس', 'PECS')}</span>
          </button>
          <button
            onClick={() => setActiveSubTab('schedule')}
            className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
              activeSubTab === 'schedule' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>📅</span>
            <span>{t('Visual Routine', 'جدول الروتين', 'Planning')}</span>
          </button>
          <button
            onClick={() => setActiveSubTab('emotions')}
            className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
              activeSubTab === 'emotions' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>🧘</span>
            <span>{t('Sensory & Early Alerts', 'المشاعر والإنذار المبكر', 'Émotions')}</span>
          </button>
          
          {/* Universal Visual Comfort Tool Button */}
          <button
            onClick={() => setShowVisualComfortModal(true)}
            className="px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500"
            title={t('Open Visual Comfort & Dyslexia Settings', 'فتح أدوات الراحة البصرية وتيسير القراءة')}
          >
            <span>📖</span>
            <span>{t('Visual Comfort', 'أدوات القراءة والراحة البصرية')}</span>
          </button>

          {onOpenLearningHub && (
            <button
              onClick={onOpenLearningHub}
              className="px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-300 border border-amber-500/40 hover:border-amber-400 hover:text-white"
            >
              <span>🎓</span>
              <span>{t('Learning Hub', 'المناهج الميسرة', 'Curriculum')}</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Tab Views */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 min-h-0">
        {/* Clinical Governance & AAC Notice Banner */}
        <div className="mb-4 max-w-5xl mx-auto p-3 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 flex items-center gap-3 text-xs text-indigo-200">
          <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-300 shrink-0">
            <Shield className="w-4 h-4" />
          </div>
          <div className="flex-1 leading-relaxed">
            <span className="font-bold text-indigo-100">
              {t('Clinical Note (ABA / SLP):', 'ملاحظة سريرية (ABA / SLP):')}
            </span>{' '}
            <span>
              {t(
                'PECS communication vocabulary and daily routines are continuously aligned with Speech-Language Pathologists and Applied Behavior Analysis protocols for AAC compliance.',
                'معجم بطاقات PECS والروتين اليومي يخضع للمراجعة المستمرة مع أخصائيي التخاطب والتحليل السلوكي (ABA) لضمان مطابقة معايير التواصل البديل والمعزز (AAC).'
              )}
            </span>
          </div>
        </div>

        {/* ── 1. CUSTOMIZABLE PECS CARDS ── */}
        {activeSubTab === 'pecs' && (
          <div className="space-y-4 max-w-5xl mx-auto">
            {/* Top Action & Category Filters */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {[
                  { id: 'all', label: t('All Cards', 'كل البطاقات', 'Toutes') },
                  { id: 'food', label: t('Food 🍎', 'أكل وشرب 🍎', 'Nourriture 🍎') },
                  { id: 'feelings', label: t('Feelings 💖', 'مشاعر 💖', 'Émotions 💖') },
                  { id: 'routine', label: t('Routine 🚻', 'روتين 🚻', 'Routine 🚻') },
                  { id: 'play', label: t('Play 🧩', 'لعب 🧩', 'Jeux 🧩') },
                  { id: 'medical', label: t('Help 🤝', 'مساعدة 🤝', 'Santé 🤝') },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setPecsFilter(cat.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all border ${
                      pecsFilter === cat.id
                        ? 'bg-indigo-600 border-indigo-400 text-white shadow-md'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setShowAddCardModal(true)}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg active:scale-95 transition-all shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>{t('Add Custom Card', 'إضافة بطاقة مخصصة', 'Ajouter PECS')}</span>
              </button>
            </div>

            {/* Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
              {filteredPecs.map((card) => {
                const isSelected = selectedCardId === card.id;
                const isCustom = card.id.includes('custom');
                return (
                  <div
                    key={card.id}
                    onClick={() => speakCard(card)}
                    className={`p-4 rounded-3xl border-2 transition-all flex flex-col items-center justify-between text-center gap-3 active:scale-95 shadow-xl relative cursor-pointer group ${
                      isSelected
                        ? 'bg-amber-400 border-amber-300 text-slate-950 scale-105 shadow-amber-400/40'
                        : `${card.color || 'bg-slate-900 border-slate-800'} hover:border-indigo-400/60`
                    }`}
                  >
                    {isCustom && (
                      <button
                        onClick={(e) => handleDeleteCard(e, card.id)}
                        className="absolute top-2.5 right-2.5 p-1 rounded-full bg-slate-950/60 hover:bg-red-600 text-slate-400 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                        title={t('Delete custom card', 'حذف البطاقة')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <span className="text-4xl sm:text-5xl mt-1">{card.icon}</span>
                    <div>
                      <h3 className="font-black text-sm sm:text-base leading-tight">
                        {isAr ? card.labelAr : isFr && card.labelFr ? card.labelFr : card.labelEn}
                      </h3>
                      <p className="text-[11px] opacity-80 mt-1 line-clamp-2 leading-tight">
                        {isAr ? card.phraseAr : isFr && card.phraseFr ? card.phraseFr : card.phraseEn}
                      </p>
                    </div>
                    <div className="w-full pt-2 border-t border-white/10 flex items-center justify-center gap-1 text-[11px] font-bold">
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>{t('Tap to Speak', 'اضغط للنطق', 'Écouter')}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── 2. VISUAL DAILY SCHEDULE ── */}
        {activeSubTab === 'schedule' && (
          <div className="max-w-2xl mx-auto space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div>
                <h2 className="font-black text-base flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-indigo-400" />
                  <span>{t('Visual Predictability Schedule', 'جدول المهام والروتين البصري', 'Planning du Jour')}</span>
                </h2>
                <p className="text-[11px] text-slate-400">
                  {t('Schedules reduce anxiety through visual routine predictability', 'الروتين البصري يقلل القلق ويوفر بيئة آمنة ومتوقعة للطفل')}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-mono">
                  {schedule.filter((s) => s.done).length} / {schedule.length} {t('Completed', 'مكتمل')}
                </span>
                <button
                  onClick={() => setShowAddScheduleModal(true)}
                  className="p-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-2.5">
              {schedule.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleToggleSchedule(item.id)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 group ${
                    item.done
                      ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200 opacity-75'
                      : 'bg-slate-900 border-slate-800 text-white hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{item.icon}</span>
                    <div>
                      <div className="text-[10px] font-mono font-bold text-indigo-400">{item.time}</div>
                      <div className={`font-bold text-sm ${item.done ? 'line-through text-slate-400' : 'text-white'}`}>
                        {isAr ? item.titleAr : isFr ? item.titleFr : item.titleEn}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => handleDeleteScheduleItem(e, item.id)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Toggle done"
                      className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all ${
                        item.done ? 'bg-emerald-500 text-slate-950' : 'border-2 border-slate-700 text-transparent'
                      }`}
                    >
                      <CheckCircle2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 3. SENSORY & EMOTIONS + SERVER-SIDE MELTDOWN DISPATCH + BREATHING BUBBLE ── */}
        {activeSubTab === 'emotions' && (
          <div className="max-w-xl mx-auto space-y-6 text-center">
            {/* 5-Point Emotion & Sensory Level Meter */}
            <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-rose-400" />
                  <span>{t('Sensory & Emotion State Check-in', 'مقياس المشاعر والضغط الحسي')}</span>
                </h3>
                <button
                  onClick={() => setShowLogsDrawer((v) => !v)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1"
                >
                  <History className="w-3.5 h-3.5" />
                  <span>{t('History', 'السجل الحسي')} ({recentLogs.length})</span>
                </button>
              </div>

              <div className="grid grid-cols-5 gap-2">
                {[
                  { lvl: 1, icon: '😊', label: t('Calm', 'هادئ', 'Calme'), color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' },
                  { lvl: 2, icon: '🙂', label: t('Good', 'تمام', 'Bien'), color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50' },
                  { lvl: 3, icon: '😐', label: t('Uncertain', 'مش مرتاح', 'Moyen'), color: 'bg-amber-500/20 text-amber-400 border-amber-500/50' },
                  { lvl: 4, icon: '😟', label: t('Overloaded', 'مضغوط', 'Surchargé'), color: 'bg-orange-500/20 text-orange-400 border-orange-500/50' },
                  { lvl: 5, icon: '😫', label: t('Meltdown', 'انفجار حسي', 'Crise'), color: 'bg-red-500/20 text-red-400 border-red-500/50' },
                ].map((item) => (
                  <button
                    key={item.lvl}
                    onClick={() => handleSelectEmotionLevel(item.lvl as any)}
                    className={`p-2.5 rounded-2xl border-2 transition-all flex flex-col items-center gap-1 active:scale-95 ${
                      currentEmotionLevel === item.lvl
                        ? `${item.color} scale-105 shadow-xl font-black`
                        : 'bg-slate-950 border-slate-800 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <span className="text-2xl sm:text-3xl">{item.icon}</span>
                    <span className="text-[10px] truncate">{item.label}</span>
                  </button>
                ))}
              </div>

              <div className="text-[11px] text-slate-400 bg-slate-950/60 p-2.5 rounded-2xl border border-slate-800 flex items-center justify-center gap-2">
                <Shield className="w-3.5 h-3.5 text-indigo-400" />
                <span>
                  {t(
                    'Level 5 automatically dispatches a secure server alert to the primary caregiver for immediate sensory de-escalation.',
                    'المستوى 5 (انفجار حسي) يرسل تلقائياً إشعار استغاثة آمن عبر الخادم للمرافق المعتمد لتقديم الدعم الحسي فوراً.'
                  )}
                </span>
              </div>
            </div>

            {/* Dynamic Meltdown Alert Status Confirmation */}
            {dispatchStatus.state !== 'idle' && (
              <div
                className={`p-4 rounded-3xl border text-xs text-start transition-all flex items-start gap-3 shadow-lg ${
                  dispatchStatus.state === 'dispatching'
                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                    : dispatchStatus.state === 'delivered'
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200'
                    : 'bg-rose-500/10 border-rose-500/40 text-rose-200'
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {dispatchStatus.state === 'dispatching' && <Activity className="w-5 h-5 animate-spin text-amber-400" />}
                  {dispatchStatus.state === 'delivered' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                  {dispatchStatus.state === 'fallback' && <AlertTriangle className="w-5 h-5 text-rose-400" />}
                </div>

                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm">
                      {dispatchStatus.state === 'dispatching' && t('Dispatching Alert to Caregiver...', 'جارٍ إرسال الإشعار لخادم المرافق...')}
                      {dispatchStatus.state === 'delivered' && t('Caregiver Alert Confirmed Delivered', 'تم تأكيد وصول الإشعار للمرافق بنجاح')}
                      {dispatchStatus.state === 'fallback' && t('Caregiver Fallback Direct Alert', 'تنبيه مباشر بديل للمرافق')}
                    </span>
                    {dispatchStatus.dispatchedAt && (
                      <span className="font-mono text-[10px] opacity-75">{dispatchStatus.dispatchedAt}</span>
                    )}
                  </div>
                  <p className="text-xs opacity-90 leading-relaxed">{dispatchStatus.message}</p>
                  {dispatchStatus.channels && dispatchStatus.channels.length > 0 && (
                    <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                      <span className="text-[10px] text-slate-400">{t('Channels:', 'القنوات:')}</span>
                      {dispatchStatus.channels.map((ch) => (
                        <span key={ch} className="px-2 py-0.5 rounded-lg bg-slate-900 text-[10px] font-mono text-emerald-300 border border-emerald-500/30">
                          {ch}
                        </span>
                      ))}
                    </div>
                  )}
                  {dispatchStatus.fallbackDirectCall && dispatchStatus.caregiverPhone && (
                    <div className="pt-2">
                      <a
                        href={`tel:${dispatchStatus.caregiverPhone}`}
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md"
                      >
                        <PhoneCall className="w-4 h-4" />
                        <span>{t('Call Caregiver Now', 'اتصل بالمرافق هاتفياً الآن')} ({dispatchStatus.caregiverPhone})</span>
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Sensory Logs History Drawer */}
            {showLogsDrawer && recentLogs.length > 0 && (
              <div className="p-4 rounded-3xl bg-slate-900/90 border border-indigo-500/30 text-start space-y-2.5">
                <h4 className="font-bold text-xs text-indigo-300 flex items-center gap-1.5">
                  <History className="w-4 h-4" />
                  <span>{t('Recent Sensory Check-ins (Saved to Cloud & Caregiver Hub):', 'سجل الضغط والمشاعر الأخير (محفوظ للمرافق):')}</span>
                </h4>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {recentLogs.map((log) => (
                    <div key={log.id} className="p-2 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold px-2 py-0.5 rounded-md text-[10px] bg-slate-800">
                          {log.intensity}/5
                        </span>
                        <span className="text-slate-300">{log.sensoryTrigger || log.level}</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Breathing Bubble Exercise */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 flex flex-col items-center">
              <div className="flex items-center gap-2 text-indigo-400">
                <Wind className="w-5 h-5" />
                <h3 className="font-bold text-base">
                  {t('Calming Breathing Bubble', 'فقاعة التنفس الهادئ', 'Bulle de Respiration')}
                </h3>
              </div>

              <div className="w-52 h-52 sm:w-60 sm:h-60 rounded-full border-4 border-indigo-500/30 flex items-center justify-center relative my-4">
                <motion.div
                  animate={
                    isBreathingActive
                      ? breathingPhase === 'inhale'
                        ? { scale: [1, 1.45], transition: { duration: 4, ease: 'easeInOut' } }
                        : breathingPhase === 'hold'
                        ? { scale: 1.45 }
                        : { scale: [1.45, 1], transition: { duration: 4, ease: 'easeInOut' } }
                      : { scale: 1 }
                  }
                  className="w-36 h-36 rounded-full bg-gradient-to-tr from-indigo-600/70 via-purple-600/60 to-cyan-500/70 shadow-2xl flex flex-col items-center justify-center text-white"
                >
                  <span className="font-mono font-black text-3xl">{breathingCount}</span>
                  <span className="text-xs font-bold uppercase tracking-wider mt-1">
                    {breathingPhase === 'inhale'
                      ? t('Inhale', 'شهيق عميق', 'Inspirez')
                      : breathingPhase === 'hold'
                      ? t('Hold', 'احبس النفس', 'Bloquez')
                      : t('Exhale', 'زفير هادي', 'Expirez')}
                  </span>
                </motion.div>
              </div>

              <button
                onClick={() => setIsBreathingActive((v) => !v)}
                className={`px-6 py-2.5 rounded-2xl font-bold text-xs shadow-lg active:scale-95 transition-all ${
                  isBreathingActive
                    ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-950/60'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-950/60'
                }`}
              >
                {isBreathingActive ? t('Stop Breathing', 'إيقاف التمرين', 'Arrêter') : t('Start Breathing Bubble', 'ابدأ فقاعة التنفس', 'Démarrer')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── MODAL: ADD CUSTOM PECS CARD ── */}
      {showAddCardModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-black text-sm text-white flex items-center gap-2">
                <span>🧩</span>
                <span>{t('Add New Custom PECS Card', 'إنشاء بطاقة بيكس مخصصة')}</span>
              </h3>
              <button
                onClick={() => setShowAddCardModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomCard} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 font-bold block mb-1">{t('Card Title (Arabic):', 'عنوان البطاقة (بالعربي):')}</label>
                <input
                  type="text"
                  required
                  value={newCardLabelAr}
                  onChange={(e) => setNewCardLabelAr(e.target.value)}
                  placeholder="مثال: عصير تفاح، لعبة المكعبات..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-400 font-bold block mb-1">{t('Full Spoken Phrase (Arabic):', 'الجملة المنطوقة كاملة (بالعربي):')}</label>
                <input
                  type="text"
                  value={newCardPhraseAr}
                  onChange={(e) => setNewCardPhraseAr(e.target.value)}
                  placeholder="مثال: أنا عايز عصير تفاح مثلج لو سمحت."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 font-bold block mb-1">{t('Icon Emoji:', 'الأيقونة (Emoji):')}</label>
                  <input
                    type="text"
                    value={newCardIcon}
                    onChange={(e) => setNewCardIcon(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-center text-lg"
                  />
                </div>

                <div>
                  <label className="text-slate-400 font-bold block mb-1">{t('Category:', 'القسم:')}</label>
                  <select
                    value={newCardCategory}
                    onChange={(e) => setNewCardCategory(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none"
                  >
                    <option value="needs">احتياجات (Needs)</option>
                    <option value="food">طعام وشراب (Food)</option>
                    <option value="feelings">مشاعر (Feelings)</option>
                    <option value="routine">روتين (Routine)</option>
                    <option value="play">لعب ومرح (Play)</option>
                    <option value="medical">مساعدة وطوارئ (Help)</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddCardModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  {t('Cancel', 'إلغاء')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                >
                  {t('Save Card', 'حفظ البطاقة')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: ADD SCHEDULE TASK ── */}
      {showAddScheduleModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-black text-sm text-white flex items-center gap-2">
                <span>📅</span>
                <span>{t('Add Visual Routine Task', 'إضافة مهمة للجدول البصري')}</span>
              </h3>
              <button
                onClick={() => setShowAddScheduleModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSchedule} className="space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <label className="text-slate-400 font-bold block mb-1">{t('Time:', 'الوقت:')}</label>
                  <input
                    type="text"
                    value={newSchTime}
                    onChange={(e) => setNewSchTime(e.target.value)}
                    placeholder="09:00 AM"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-white font-mono text-center"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-slate-400 font-bold block mb-1">{t('Icon Emoji:', 'الأيقونة:')}</label>
                  <input
                    type="text"
                    value={newSchIcon}
                    onChange={(e) => setNewSchIcon(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-center text-lg"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 font-bold block mb-1">{t('Task Title (Arabic):', 'عنوان المهمة (بالعربي):')}</label>
                <input
                  type="text"
                  required
                  value={newSchTitleAr}
                  onChange={(e) => setNewSchTitleAr(e.target.value)}
                  placeholder="مثال: جلسة التخاطب، ترتيب الغرفة..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddScheduleModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300"
                >
                  {t('Cancel', 'إلغاء')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
                >
                  {t('Add to Schedule', 'إضافة للجدول')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
