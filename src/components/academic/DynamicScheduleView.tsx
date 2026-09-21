import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar, Clock, CheckCircle2, Circle, Sparkles, 
  RotateCcw, Plus, Trash2, AlertTriangle, BookOpen, 
  Layers, ChevronRight, Zap, Target, ArrowRight
} from 'lucide-react';
import { UserProfile, DynamicStudyPlan, DynamicStudySlot, DynamicStudyTopic } from '../../types';
import { 
  createDynamicStudyPlan, rebalanceStudyPlan, loadSavedPlan, 
  persistPlan, formatDateIso, parseLocalDate, getAvailableDates 
} from '../../lib/dynamicStudyEngine';
import { toast } from '../Toast';

interface DynamicScheduleViewProps {
  profile: UserProfile;
  isAr: boolean;
}

export default function DynamicScheduleView({ profile, isAr }: DynamicScheduleViewProps) {
  const [plan, setPlan] = useState<DynamicStudyPlan | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Creation form state
  const [examDate, setExamDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14); // default 2 weeks out
    return formatDateIso(d);
  });
  const [targetCourse, setTargetCourse] = useState('');
  const [topics, setTopics] = useState<DynamicStudyTopic[]>([
    { id: 't1', course: '', title: 'Chapter 1: Foundations & Core Theorems', difficulty: 2, estimatedHours: 2, completed: false },
    { id: 't2', course: '', title: 'Chapter 2: Intermediate Algorithms & Data Models', difficulty: 3, estimatedHours: 3, completed: false },
    { id: 't3', course: '', title: 'Chapter 3: Advanced Architectures & Systems', difficulty: 5, estimatedHours: 4, completed: false },
  ]);
  const [newTopicTitle, setNewTopicTitle] = useState('');
  const [newDifficulty, setNewDifficulty] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [newHours, setNewHours] = useState(2);

  useEffect(() => {
    const saved = loadSavedPlan();
    if (saved) {
      setPlan(saved);
    }
  }, []);

  const handleAddTopic = () => {
    if (!newTopicTitle.trim()) return;
    const t: DynamicStudyTopic = {
      id: `top-${Date.now()}`,
      course: targetCourse.trim() || (isAr ? 'مادة أساسية' : 'Core Course'),
      title: newTopicTitle.trim(),
      difficulty: newDifficulty,
      estimatedHours: newHours,
      completed: false,
    };
    setTopics([...topics, t]);
    setNewTopicTitle('');
  };

  const handleRemoveTopic = (id: string) => {
    setTopics(topics.filter((x) => x.id !== id));
  };

  const handleBuildPlan = () => {
    if (topics.length === 0) {
      toast.error(isAr ? 'من فضلك أضف شابتر أو موضوعاً واحداً على الأقل' : 'Please add at least one topic or chapter');
      return;
    }
    const finalTopics = topics.map((t) => ({ ...t, course: t.course || targetCourse || 'General' }));
    const newPlan = createDynamicStudyPlan(examDate, finalTopics, [targetCourse || 'General'], 4);
    setPlan(newPlan);
    persistPlan(newPlan);
    setIsCreating(false);
    toast.success(isAr ? 'تم بناء جدول المذاكرة الديناميكي وتوزيع الشباتر بنجاح!' : 'Dynamic study schedule generated successfully!');
  };

  const handleToggleSlot = (slotId: string) => {
    if (!plan) return;
    const nextSlots = plan.dailySlots.map((s) => (s.id === slotId ? { ...s, completed: !s.completed } : s));
    const nextPlan = { ...plan, dailySlots: nextSlots };
    setPlan(nextPlan);
    persistPlan(nextPlan);
  };

  const handleAutoRebalance = () => {
    if (!plan) return;
    const rebalanced = rebalanceStudyPlan(plan, formatDateIso(new Date()), 4);
    setPlan(rebalanced);
    persistPlan(rebalanced);
    toast.success(
      isAr 
        ? 'تمت إعادة موازنة الجدول تلقائياً وتوزيع المهام الفائتة بسلاسة!' 
        : 'Schedule automatically rebalanced without overwhelming any single day!'
    );
  };

  // Group slots by date
  const groupedSlots = useMemo(() => {
    if (!plan?.dailySlots) return {};
    const groups: Record<string, DynamicStudySlot[]> = {};
    for (const slot of plan.dailySlots) {
      if (!groups[slot.date]) groups[slot.date] = [];
      groups[slot.date].push(slot);
    }
    return groups;
  }, [plan]);

  const todayStr = formatDateIso(new Date());

  // Count missed overdue slots
  const overdueCount = useMemo(() => {
    if (!plan?.dailySlots) return 0;
    return plan.dailySlots.filter((s) => !s.completed && s.date < todayStr).length;
  }, [plan, todayStr]);

  const completedCount = useMemo(() => {
    if (!plan?.dailySlots) return 0;
    return plan.dailySlots.filter((s) => s.completed).length;
  }, [plan]);

  const totalSlotsCount = plan?.dailySlots?.length || 0;
  const progressPercent = totalSlotsCount > 0 ? Math.round((completedCount / totalSlotsCount) * 100) : 0;

  // VIEW 1: CREATION MODAL / PANEL
  if (isCreating || !plan) {
    return (
      <div className="bg-[#121524]/90 border border-slate-800 rounded-3xl p-6 md:p-8 backdrop-blur-xl shadow-2xl space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">
                {isAr ? 'إنشاء جدول المذاكرة الذكي والديناميكي' : 'Create Dynamic Smart Study Plan'}
              </h2>
              <p className="text-xs text-slate-400">
                {isAr ? 'توزيع ذكي للشباتر حسب الصعوبة مع ميزة إعادة الموازنة الآلية والتكرار المتباعد' : 'Auto-balances topic workloads, Ebbinghaus spaced reviews, and 1-click auto-rebalance'}
              </p>
            </div>
          </div>
          {plan && (
            <button
              onClick={() => setIsCreating(false)}
              className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
          )}
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">
                {isAr ? 'المادة الدراسية (Course Name)' : 'Course Name'}
              </label>
              <input
                type="text"
                value={targetCourse}
                onChange={(e) => setTargetCourse(e.target.value)}
                placeholder={isAr ? 'مثال: فيزياء كهربية، مبادئ الإدارة...' : 'e.g. Physics II, Microeconomics...'}
                className="w-full bg-[#0A0C14] border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 transition-all"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">
                {isAr ? 'موعد الامتحان النهائي أو الفاينال (Exam Date) *' : 'Target Exam Date *'}
              </label>
              <input
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                className="w-full bg-[#0A0C14] border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 transition-all font-mono"
              />
            </div>
          </div>

          {/* Topics List Builder */}
          <div className="bg-[#0A0C14] border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="text-xs font-black text-slate-300 uppercase tracking-wider">
              {isAr ? 'شباتر ومواضيع المنهج المقررة:' : 'Chapters & Topics to Cover:'}
            </div>

            <div className="space-y-2">
              {topics.map((t, idx) => (
                <div key={t.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#121524] border border-slate-800 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-slate-800 text-slate-400 font-mono font-bold flex items-center justify-center text-[10px]">
                      {idx + 1}
                    </span>
                    <span className="font-bold text-slate-200">{t.title}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      {isAr ? `صعوبة ${t.difficulty}/5` : `Diff: ${t.difficulty}/5`}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">
                      {t.estimatedHours} {isAr ? 'ساعات' : 'hrs'}
                    </span>
                    <button
                      onClick={() => handleRemoveTopic(t.id)}
                      className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add Topic Row */}
            <div className="pt-2 flex flex-col md:flex-row gap-2">
              <input
                type="text"
                value={newTopicTitle}
                onChange={(e) => setNewTopicTitle(e.target.value)}
                placeholder={isAr ? 'اسم الشابتر أو الموضوع الجديد...' : 'New chapter or topic title...'}
                className="flex-1 bg-[#121524] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
              <div className="flex gap-2 items-center">
                <select
                  value={newDifficulty}
                  onChange={(e) => setNewDifficulty(Number(e.target.value) as any)}
                  className="bg-[#121524] border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-300 focus:outline-none"
                >
                  <option value={1}>{isAr ? 'صعوبة 1 (سهل)' : 'Diff 1 (Easy)'}</option>
                  <option value={2}>{isAr ? 'صعوبة 2' : 'Diff 2'}</option>
                  <option value={3}>{isAr ? 'صعوبة 3 (متوسط)' : 'Diff 3 (Medium)'}</option>
                  <option value={4}>{isAr ? 'صعوبة 4' : 'Diff 4'}</option>
                  <option value={5}>{isAr ? 'صعوبة 5 (شاق)' : 'Diff 5 (Hard)'}</option>
                </select>
                <select
                  value={newHours}
                  onChange={(e) => setNewHours(Number(e.target.value))}
                  className="bg-[#121524] border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-300 focus:outline-none"
                >
                  <option value={1}>1 {isAr ? 'ساعة' : 'hr'}</option>
                  <option value={2}>2 {isAr ? 'ساعتان' : 'hrs'}</option>
                  <option value={3}>3 {isAr ? 'ساعات' : 'hrs'}</option>
                  <option value={4}>4 {isAr ? 'ساعات' : 'hrs'}</option>
                </select>
                <button
                  type="button"
                  onClick={handleAddTopic}
                  className="flex items-center gap-1 px-4 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-bold transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {isAr ? 'إضافة' : 'Add'}
                </button>
              </div>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              onClick={handleBuildPlan}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black text-sm shadow-lg shadow-cyan-500/20 transition-all active:scale-95"
            >
              <Sparkles className="w-4 h-4" />
              {isAr ? 'بناء وتوزيع الجدول آلياً' : 'Generate Dynamic Schedule'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // VIEW 2: ACTIVE DYNAMIC TIMELINE VIEW
  return (
    <div className="space-y-6">
      {/* Overview & Rebalance Banner */}
      <div className="bg-[#121524]/90 border border-slate-800 rounded-3xl p-6 md:p-8 backdrop-blur-xl shadow-2xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 px-3 py-1 rounded-xl">
                {isAr ? 'جدول المذاكرة التفاعلي الذكي' : 'Dynamic AI Study Schedule'}
              </span>
              <span className="text-xs text-slate-400 font-bold">
                {isAr ? `موعد الامتحان: ${plan.examDate}` : `Target Exam: ${plan.examDate}`}
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-white pt-1">
              {plan.targetCourses[0] || (isAr ? 'الخطة الأكاديمية' : 'Academic Master Plan')}
            </h2>
            <div className="flex items-center gap-4 text-xs text-slate-400 pt-1">
              <span>{isAr ? `تم إنجاز ${completedCount} من ${totalSlotsCount} مهمة` : `${completedCount} of ${totalSlotsCount} slots completed`}</span>
              <span>•</span>
              <span className="text-emerald-400 font-bold">{progressPercent}% {isAr ? 'مكتمل' : 'Completed'}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* 1-Click Auto-Rebalance Button */}
            <button
              onClick={handleAutoRebalance}
              className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-5 py-3 rounded-2xl font-black text-xs shadow-lg transition-all active:scale-95 border ${
                overdueCount > 0
                  ? 'bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-white border-amber-500/50 shadow-amber-500/20 animate-pulse'
                  : 'bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border-indigo-500/40 shadow-indigo-500/10'
              }`}
            >
              <RotateCcw className="w-4 h-4" />
              {isAr ? 'إعادة الموازنة التلقائية (Auto-Rebalance)' : '1-Click Auto-Rebalance'}
            </button>

            <button
              onClick={() => setIsCreating(true)}
              className="px-4 py-3 rounded-2xl bg-[#0A0C14] hover:bg-slate-900 text-slate-300 border border-slate-800 text-xs font-bold transition-all"
            >
              {isAr ? 'تعديل الخطة' : 'Edit Plan'}
            </button>
          </div>
        </div>

        {/* Overdue alert if missed days exist */}
        {overdueCount > 0 && (
          <div className="mt-4 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3 text-xs text-amber-300">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
              <span>
                {isAr 
                  ? `لديك (${overdueCount}) مهام دراسية فائتة من أيام سابقة. اضغط "إعادة الموازنة التلقائية" لتوزيعها فوراً على الأيام القادمة دون إرهاق.`
                  : `You have (${overdueCount}) past uncompleted slots. Tap Auto-Rebalance to smoothly distribute them across upcoming days.`}
              </span>
            </div>
          </div>
        )}

        {/* Progress Bar */}
        <div className="mt-6 w-full h-2 bg-slate-800/80 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Date Timeline Cards */}
      <div className="space-y-4">
        {Object.entries(groupedSlots).map(([dateStr, slots]) => {
          const isToday = dateStr === todayStr;
          const isPast = dateStr < todayStr;
          const dateObj = parseLocalDate(dateStr);
          const formattedTitle = dateObj.toLocaleDateString(isAr ? 'ar-EG' : 'en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
          });

          return (
            <div
              key={dateStr}
              className={`rounded-3xl p-5 border transition-all backdrop-blur-xl ${
                isToday
                  ? 'bg-gradient-to-b from-[#161b30] to-[#121524] border-cyan-500/40 shadow-xl shadow-cyan-500/5 ring-1 ring-cyan-500/20'
                  : isPast
                  ? 'bg-[#0E111D]/80 border-slate-800/60 opacity-90'
                  : 'bg-[#121524]/90 border-slate-800/80 shadow-lg'
              }`}
            >
              {/* Date Header */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800/60">
                <div className="flex items-center gap-2.5">
                  <span className={`text-xs font-black px-2.5 py-1 rounded-xl border ${
                    isToday
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                      : isPast
                      ? 'bg-slate-800 text-slate-400 border-slate-700'
                      : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                  }`}>
                    {isToday ? (isAr ? 'اليوم' : 'Today') : formattedTitle}
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">{dateStr}</span>
                </div>

                <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>
                    {slots.reduce((s, x) => s + x.hours, 0)} {isAr ? 'ساعات مذاكرة' : 'study hrs'}
                  </span>
                </div>
              </div>

              {/* Slot Items */}
              <div className="space-y-2.5">
                {slots.map((slot) => {
                  const isMock = slot.slotType === 'mock-exam';
                  const isReview = slot.slotType === 'review';

                  return (
                    <div
                      key={slot.id}
                      className={`flex items-center justify-between gap-3 p-3.5 rounded-2xl border transition-all ${
                        slot.completed
                          ? 'bg-emerald-500/5 border-emerald-500/20 text-slate-400'
                          : isMock
                          ? 'bg-rose-500/10 border-rose-500/30 text-white'
                          : isReview
                          ? 'bg-indigo-500/10 border-indigo-500/30 text-white'
                          : 'bg-[#0A0C14] border-slate-800 hover:border-slate-700 text-white'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleToggleSlot(slot.id)}
                        className="shrink-0 text-slate-500 hover:text-emerald-400 transition-colors"
                      >
                        {slot.completed ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        ) : (
                          <Circle className="w-5 h-5" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className={`text-xs md:text-sm font-bold truncate ${slot.completed ? 'line-through text-slate-500' : 'text-slate-100'}`}>
                          {slot.topicTitle}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-slate-400 font-medium">{slot.course}</span>
                          {isReview && (
                            <span className="text-[9px] font-black uppercase tracking-wider text-indigo-300 bg-indigo-500/20 px-1.5 py-0.5 rounded border border-indigo-500/30">
                              {isAr ? 'تكرار متباعد (Spaced Rep)' : 'Spaced Rep'}
                            </span>
                          )}
                          {isMock && (
                            <span className="text-[9px] font-black uppercase tracking-wider text-rose-300 bg-rose-500/20 px-1.5 py-0.5 rounded border border-rose-500/30">
                              {isAr ? 'محاكاة امتحان' : 'Mock Exam'}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 text-end">
                        <span className="text-[11px] font-mono font-bold text-slate-400 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800">
                          {slot.hours} {isAr ? 'س' : 'h'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
