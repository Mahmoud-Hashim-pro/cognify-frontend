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
  Shield
} from 'lucide-react';
import { UserProfile, PECSCard, SensoryEmotionLog } from '../types';
import { speak, cancelSpeech } from '../lib/tts';
import { triggerHapticAlert } from '../lib/hapticNavEngine';
import { isArabicLocale } from '../lib/translations';
import { toast } from './Toast';

interface NeurodiversityHubProps {
  profile: UserProfile;
  onNavigateBack?: () => void;
}

const DEFAULT_PECS_CARDS: PECSCard[] = [
  // Food & Drink
  { id: 'pecs-1', labelAr: 'مية', labelEn: 'Water', labelFr: 'Eau', phraseAr: 'أنا عايز أشرب مية لو سمحت.', phraseEn: 'I want some water please.', phraseFr: "Je veux de l'eau s'il vous plaît.", category: 'food', icon: '💧', color: 'bg-blue-500/20 border-blue-500/40 text-blue-300' },
  { id: 'pecs-2', labelAr: 'أكل / جوعان', labelEn: 'Food / Hungry', labelFr: 'Nourriture', phraseAr: 'أنا جوعان وعايز آكل وجبة خفيفة.', phraseEn: 'I am hungry and want to eat.', phraseFr: "J'ai faim et je veux manger.", category: 'food', icon: '🍎', color: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' },
  { id: 'pecs-3', labelAr: 'حمام', labelEn: 'Bathroom', labelFr: 'Toilettes', phraseAr: 'عايز أروح الحمام لو سمحت.', phraseEn: 'I need to use the bathroom please.', phraseFr: "J'ai besoin d'aller aux toilettes.", category: 'routine', icon: '🚻', color: 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300' },
  
  // Feelings & Sensory
  { id: 'pecs-4', labelAr: 'فرحان / مبسوط', labelEn: 'Happy', labelFr: 'Heureux', phraseAr: 'أنا حاسس بفرح ومبسوط.', phraseEn: 'I am feeling happy.', phraseFr: 'Je me sens heureux.', category: 'feelings', icon: '😊', color: 'bg-amber-500/20 border-amber-500/40 text-amber-300' },
  { id: 'pecs-5', labelAr: 'زعلان / مضايق', labelEn: 'Sad / Upset', labelFr: 'Triste', phraseAr: 'أنا زعلان وحاسس بضيق.', phraseEn: 'I am feeling sad and upset.', phraseFr: 'Je me sens triste.', category: 'feelings', icon: '😢', color: 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300' },
  { id: 'pecs-6', labelAr: 'صوت عالي / إزعاج', labelEn: 'Too Loud', labelFr: 'Trop fort', phraseAr: 'الصوت عالي ومزعج، محتاج هدوء.', phraseEn: 'It is too loud here, I need quiet.', phraseFr: "C'est trop bruyant, j'ai besoin de calme.", category: 'feelings', icon: '🎧', color: 'bg-rose-500/20 border-rose-500/40 text-rose-300' },
  { id: 'pecs-7', labelAr: 'تعبان / عايز أنام', labelEn: 'Tired / Rest', labelFr: 'Fatigué', phraseAr: 'أنا تعبان ومحتاج أرتاح شوية.', phraseEn: 'I am tired and need to rest.', phraseFr: "Je suis fatigué et j'ai besoin de me reposer.", category: 'routine', icon: '🛏️', color: 'bg-purple-500/20 border-purple-500/40 text-purple-300' },
  
  // Play & Social
  { id: 'pecs-8', labelAr: 'عايز ألعب', labelEn: 'Play Game', labelFr: 'Jouer', phraseAr: 'عايز ألعب بلعبتي المفضلة.', phraseEn: 'I want to play a game.', phraseFr: 'Je veux jouer.', category: 'play', icon: '🧩', color: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300' },
  { id: 'pecs-9', labelAr: 'أنا محتاج حضن', labelEn: 'Need a Hug', labelFr: 'Câlin', phraseAr: 'محتاج حضن عشان أهدى.', phraseEn: 'I need a gentle hug.', phraseFr: "J'ai besoin d'un câlin.", category: 'feelings', icon: '🫂', color: 'bg-pink-500/20 border-pink-500/40 text-pink-300' },
  { id: 'pecs-10', labelAr: 'عايز مساعدة', labelEn: 'Help Me', labelFr: 'Aide-moi', phraseAr: 'ممكن تساعدني في دي لو سمحت؟', phraseEn: 'Can you please help me with this?', phraseFr: "Pouvez-vous m'aider s'il vous plaît ?", category: 'medical', icon: '🤝', color: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' },
  { id: 'pecs-11', labelAr: 'ألم / في حاجة بتوجعني', labelEn: 'In Pain', labelFr: 'Douleur', phraseAr: 'عندي ألم وفي حاجة بتوجعني.', phraseEn: 'I feel pain somewhere in my body.', phraseFr: "J'ai mal quelque part.", category: 'medical', icon: '🩹', color: 'bg-red-500/20 border-red-500/40 text-red-300' },
  { id: 'pecs-12', labelAr: 'عايز أتمشى', labelEn: 'Walk Outside', labelFr: 'Marcher', phraseAr: 'عايز أخرج أتمشى في الهواء.', phraseEn: 'I want to go for a short walk outside.', phraseFr: 'Je veux faire une promenade.', category: 'play', icon: '🌳', color: 'bg-teal-500/20 border-teal-500/40 text-teal-300' },
];

interface ScheduleItem {
  id: string;
  time: string;
  titleAr: string;
  titleEn: string;
  titleFr: string;
  icon: string;
  done: boolean;
}

const DEFAULT_SCHEDULE: ScheduleItem[] = [
  { id: 'sch-1', time: '08:00 AM', titleAr: 'الاستيقاظ وغسل الوجه والأسنان', titleEn: 'Wake up & brush teeth', titleFr: 'Réveil et brossage des dents', icon: '🪥', done: true },
  { id: 'sch-2', time: '08:30 AM', titleAr: 'وجبة الإفطار اللذيذة', titleEn: 'Healthy breakfast', titleFr: 'Petit-déjeuner', icon: '🥣', done: true },
  { id: 'sch-3', time: '10:00 AM', titleAr: 'جلسة التعلم والقراءة الممتعة', titleEn: 'Learning & reading session', titleFr: 'Session de lecture et étude', icon: '📚', done: false },
  { id: 'sch-4', time: '01:00 PM', titleAr: 'وقت الغداء والراحة', titleEn: 'Lunch time & break', titleFr: 'Déjeuner et pause', icon: '🍲', done: false },
  { id: 'sch-5', time: '04:00 PM', titleAr: 'تمارين التنفس واللعب الحركي', titleEn: 'Breathing exercise & play', titleFr: 'Exercices de respiration et jeu', icon: '🎨', done: false },
  { id: 'sch-6', time: '08:00 PM', titleAr: 'العشاء والاستعداد للنوم الهادئ', titleEn: 'Dinner & wind down for sleep', titleFr: 'Dîner et coucher calme', icon: '🌙', done: false },
];

export default function NeurodiversityHub({ profile, onNavigateBack }: NeurodiversityHubProps) {
  const lang = profile.language || 'Arabic';
  const isAr = isArabicLocale(lang);
  const isFr = lang === 'French';

  const [activeSubTab, setActiveSubTab] = useState<'pecs' | 'schedule' | 'emotions' | 'dyslexia'>('pecs');
  
  // PECS Cards State
  const [pecsCards, setPecsCards] = useState<PECSCard[]>(DEFAULT_PECS_CARDS);
  const [pecsFilter, setPecsFilter] = useState<string>('all');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  // Daily Schedule State
  const [schedule, setSchedule] = useState<ScheduleItem[]>(DEFAULT_SCHEDULE);

  // Emotion & Sensory Meter State
  const [currentEmotionLevel, setCurrentEmotionLevel] = useState<1 | 2 | 3 | 4 | 5>(2);
  const [isBreathingActive, setIsBreathingActive] = useState(false);
  const [breathingPhase, setBreathingPhase] = useState<'inhale' | 'hold' | 'exhale'>('inhale');
  const [breathingCount, setBreathingCount] = useState(4);

  // Dyslexia-Friendly Mode State
  const [isDyslexiaFont, setIsDyslexiaFont] = useState(false);
  const [showReadingRuler, setShowReadingRuler] = useState(false);
  const [rulerY, setRulerY] = useState(250);
  const [tintColor, setTintColor] = useState<'none' | 'cream' | 'mint' | 'rose'>('none');

  const breathingTimerRef = useRef<any>(null);

  const t = (en: string, ar: string, fr?: string) => {
    if (isAr) return ar;
    if (isFr && fr) return fr;
    return en;
  };

  // Speak PECS card
  const speakCard = (card: PECSCard) => {
    setSelectedCardId(card.id);
    const phrase = isAr ? card.phraseAr : isFr && card.phraseFr ? card.phraseFr : card.phraseEn;
    speak(phrase, isAr ? 'Arabic' : isFr ? 'French' : 'English');
    triggerHapticAlert('arrival');
    setTimeout(() => setSelectedCardId(null), 1200);
  };

  // Toggle Schedule Item Done
  const toggleScheduleItem = (id: string) => {
    setSchedule((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const next = !item.done;
          if (next) triggerHapticAlert('clear');
          return { ...item, done: next };
        }
        return item;
      })
    );
  };

  // Breathing Exercise Loop (4s Inhale, 4s Hold, 4s Exhale)
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

  // Reading Ruler Mouse / Touch Follower
  const handleMouseMove = (e: React.MouseEvent) => {
    if (showReadingRuler) {
      setRulerY(e.clientY);
    }
  };

  const filteredPecs = pecsFilter === 'all' ? pecsCards : pecsCards.filter((c) => c.category === pecsFilter);

  return (
    <div
      onMouseMove={handleMouseMove}
      className={`flex-1 flex flex-col h-full bg-slate-950 text-white overflow-hidden select-none relative ${
        isDyslexiaFont ? 'font-mono tracking-wide' : ''
      } ${
        tintColor === 'cream'
          ? 'bg-amber-950/20'
          : tintColor === 'mint'
          ? 'bg-emerald-950/20'
          : tintColor === 'rose'
          ? 'bg-rose-950/20'
          : ''
      }`}
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {/* Dyslexia Reading Ruler Overlay */}
      {showReadingRuler && (
        <div
          style={{ top: `${rulerY - 35}px` }}
          className="fixed left-0 right-0 h-20 bg-amber-400/15 border-y-2 border-amber-400/40 pointer-events-none z-50 transition-all duration-75 shadow-lg backdrop-blur-[0.5px]"
        />
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
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-950 border border-indigo-500/40 text-indigo-300 font-normal">
                  {t('Sensory-Safe', 'بيئة حسية آمنة', 'Sensoriel')}
                </span>
              </h1>
              <p className="text-[11px] text-slate-400">
                {t('Visual PECS cards, calm schedules, sensory meter & dyslexia tools', 'بطاقات بيكس للتواصل، جدول الروتين اليومي، مقياس المشاعر وفقاعة التنفس', 'PECS visuels, planning et régulation')}
              </p>
            </div>
          </div>
        </div>

        {/* Subtabs Selector */}
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-2xl border border-slate-800 text-xs font-bold">
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
            <span>{t('Daily Schedule', 'جدول اليوم', 'Planning')}</span>
          </button>
          <button
            onClick={() => setActiveSubTab('emotions')}
            className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
              activeSubTab === 'emotions' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>🧘</span>
            <span>{t('Calm & Emotions', 'الهدوء والمشاعر', 'Émotions')}</span>
          </button>
          <button
            onClick={() => setActiveSubTab('dyslexia')}
            className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
              activeSubTab === 'dyslexia' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>📖</span>
            <span>{t('Reading Tools', 'أدوات القراءة', 'Lecture')}</span>
          </button>
        </div>
      </header>

      {/* Main Tab Views */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 min-h-0">
        {/* ── 1. PECS CARDS ECOSYSTEM ── */}
        {activeSubTab === 'pecs' && (
          <div className="space-y-4 max-w-5xl mx-auto">
            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {[
                { id: 'all', label: t('All Cards', 'كل البطاقات', 'Toutes') },
                { id: 'food', label: t('Food & Drink 🍎', 'أكل وشرب 🍎', 'Nourriture 🍎') },
                { id: 'feelings', label: t('Feelings 💖', 'مشاعر وحواس 💖', 'Émotions 💖') },
                { id: 'routine', label: t('Daily Routine 🚻', 'روتين يومي 🚻', 'Routine 🚻') },
                { id: 'play', label: t('Play & Joy 🧩', 'لعب ومرح 🧩', 'Jeux 🧩') },
                { id: 'medical', label: t('Medical & Help 🤝', 'مساعدة وطوارئ 🤝', 'Santé 🤝') },
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

            {/* Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
              {filteredPecs.map((card) => {
                const isSelected = selectedCardId === card.id;
                return (
                  <button
                    key={card.id}
                    onClick={() => speakCard(card)}
                    className={`p-4 rounded-3xl border-2 transition-all flex flex-col items-center justify-between text-center gap-3 active:scale-95 shadow-xl ${
                      isSelected
                        ? 'bg-amber-400 border-amber-300 text-slate-950 scale-105 shadow-amber-400/40'
                        : `${card.color || 'bg-slate-900 border-slate-800'} hover:border-indigo-400/60`
                    }`}
                  >
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
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── 2. VISUAL DAILY SCHEDULE ── */}
        {activeSubTab === 'schedule' && (
          <div className="max-w-2xl mx-auto space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h2 className="font-black text-base flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-400" />
                <span>{t('Today\'s Visual Schedule', 'جدول المهام البصري لليوم', 'Planning du Jour')}</span>
              </h2>
              <span className="text-xs text-slate-400 font-mono">
                {schedule.filter((s) => s.done).length} / {schedule.length} {t('Completed', 'مكتمل', 'Terminés')}
              </span>
            </div>

            <div className="space-y-2.5">
              {schedule.map((item) => (
                <div
                  key={item.id}
                  onClick={() => toggleScheduleItem(item.id)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
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
              ))}
            </div>
          </div>
        )}

        {/* ── 3. EMOTION & SENSORY REGULATION + BREATHING BUBBLE ── */}
        {activeSubTab === 'emotions' && (
          <div className="max-w-xl mx-auto space-y-6 text-center">
            {/* 5-Point Emotion & Sensory Level Meter */}
            <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-3">
              <h3 className="font-bold text-sm text-slate-300">
                {t('How are you feeling right now?', 'أنت حاسس بإيه دلوقتي؟', 'Comment vous sentez-vous ?')}
              </h3>

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
                    onClick={() => {
                      setCurrentEmotionLevel(item.lvl as any);
                      if (item.lvl >= 4) {
                        setIsBreathingActive(true);
                        toast.info(t('Let\'s do a calming breathing exercise together.', 'يلا نعمل تمرين تنفس هادي مع بعض.', 'Faisons un exercice de respiration.'));
                      }
                    }}
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
            </div>

            {/* Breathing Bubble Exercise */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 flex flex-col items-center">
              <div className="flex items-center gap-2 text-indigo-400">
                <Wind className="w-5 h-5" />
                <h3 className="font-bold text-base">
                  {t('Calming Breathing Bubble', 'فقاعة التنفس الهادئ', 'Bulle de Respiration')}
                </h3>
              </div>

              {/* Expanding Bubble Circle */}
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

        {/* ── 4. DYSLEXIA & READING TOOLS ── */}
        {activeSubTab === 'dyslexia' && (
          <div className="max-w-2xl mx-auto space-y-5">
            <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
              <h3 className="font-black text-sm text-slate-200 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-400" />
                <span>{t('Dyslexia & Visual Comfort Controls', 'أدوات تسهيل القراءة لعسر القراءة (Dyslexia)', 'Confort Visuel')}</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Dyslexia High-Legibility Font Toggle */}
                <button
                  onClick={() => setIsDyslexiaFont((v) => !v)}
                  className={`p-3 rounded-2xl border text-start flex items-center justify-between transition-all ${
                    isDyslexiaFont ? 'bg-indigo-600/30 border-indigo-400 text-indigo-200 font-mono' : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <div>
                    <div className="font-bold text-xs text-white">{t('High-Legibility Font', 'خط عالي التباين وواسع', 'Police Lisible')}</div>
                    <div className="text-[10px] text-slate-400">{t('Increases letter and word spacing', 'يوسع المسافات بين الحروف والكلمات', 'Espacement accru')}</div>
                  </div>
                  <span className="text-xl">🔤</span>
                </button>

                {/* Reading Ruler Toggle */}
                <button
                  onClick={() => setShowReadingRuler((v) => !v)}
                  className={`p-3 rounded-2xl border text-start flex items-center justify-between transition-all ${
                    showReadingRuler ? 'bg-amber-600/30 border-amber-400 text-amber-200' : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <div>
                    <div className="font-bold text-xs text-white">{t('Reading Ruler Bar', 'مسطرة القراءة المضيئة', 'Règle de Lecture')}</div>
                    <div className="text-[10px] text-slate-400">{t('Highlights one reading line at a time', 'تظليل سطر القراءة الحالي مع حركة الماوس', 'Surligne la ligne')}</div>
                  </div>
                  <span className="text-xl">📏</span>
                </button>
              </div>

              {/* Tint Colors to Reduce Glare */}
              <div className="space-y-1.5 pt-2 border-t border-slate-800">
                <label className="text-xs text-slate-400 font-bold block">
                  {t('Comfort Tint (Reduces Screen Glare):', 'لون خلفية هادئ ومريح للعين (يقلل الوهج):', 'Teinte de Confort :')}
                </label>
                <div className="flex gap-2">
                  {[
                    { id: 'none', label: t('Default Dark', 'داكن عادي', 'Sombre') },
                    { id: 'cream', label: t('Warm Cream', 'كريمي دافئ', 'Crème') },
                    { id: 'mint', label: t('Soft Mint', 'أخضر نعناعي', 'Menthe') },
                    { id: 'rose', label: t('Gentle Rose', 'وردي خفيف', 'Rose') },
                  ].map((tint) => (
                    <button
                      key={tint.id}
                      onClick={() => setTintColor(tint.id as any)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                        tintColor === tint.id ? 'bg-indigo-600 border-indigo-400 text-white shadow' : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      {tint.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Reading Test Sample Box */}
            <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                {t('Sample Reading Experience:', 'معاينة القراءة والتجربة:', 'Aperçu de lecture :')}
              </h4>
              <p className="text-sm leading-loose text-slate-200">
                {isAr
                  ? 'كل عقل في كوجنيفاي فريد ومميز بطريقته الخاصة. مع مسطرة القراءة والخط الواسع، تصبح الكلمات أوضح والتركيز أسهل بكثير بدون أي إجهاد بصري.'
                  : 'Every mind in Cognify is wonderfully unique. With the reading ruler and spacious typography, comprehension flows smoothly with zero visual fatigue.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
