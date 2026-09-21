import { localize, isArabicLocale } from '../lib/translations';
import { useState, useEffect } from 'react';
import { AnimatePresence } from 'motion/react';
import { UserProfile, Goal } from '../types';
import { subscribeToGoals, saveGoal, updateGoal, deleteGoal } from '../lib/goals';
import GoalStats from './goals/GoalStats';
import GoalCard from './goals/GoalCard';
import AddGoalModal from './goals/AddGoalModal';
import EditGoalModal from './goals/EditGoalModal';
import { Plus, Target, Loader2, Menu, ArrowLeft } from 'lucide-react';
import { toast } from './Toast';

interface GoalTrackerProps {
  profile: UserProfile;
  onMenuClick?: () => void;
  onNavigateBack?: () => void;
}

export default function GoalTracker({ profile, onMenuClick, onNavigateBack }: GoalTrackerProps) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

  const isArabic = isArabicLocale(profile.language);

  // Real-time subscription to goals
  useEffect(() => {
    if (!profile.uid) return;
    setLoading(true);

    const unsubscribe = subscribeToGoals(
      profile.uid,
      (updatedGoals) => {
        setGoals(updatedGoals);
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => unsubscribe();
  }, [profile.uid]);

  // ── CRUD handlers ──────────────────────────────────────────────────────────

  const handleAddGoal = async (goal: Goal) => {
    await saveGoal(profile.uid, goal);
    // Firestore subscription will update local state automatically
  };

  const handleUpdateGoal = async (goalId: string, updates: Partial<Goal>) => {
    await updateGoal(profile.uid, goalId, updates);
  };

  const handleDeleteGoal = async (goalId: string) => {
    const confirmed = window.confirm(
      localize(profile.language, 'Are you sure you want to delete this goal?', 'هل أنت متأكد من حذف هذا الهدف؟')
    );
    if (!confirmed) return;
    await deleteGoal(profile.uid, goalId);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 h-screen overflow-y-auto bg-[#0A0C14] text-slate-100 relative selection:bg-cyan-500/30 selection:text-white overflow-x-hidden font-sans flex flex-col custom-scrollbar">
      {/* Ambient Lighting Orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[140px]" />
        <div className="absolute top-1/2 -right-40 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[140px]" />
        <div className="absolute -bottom-40 left-1/3 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[140px]" />
      </div>

      {/* Header */}
      <header className="p-6 md:p-10 pb-0 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            {onNavigateBack && (
              <button
                onClick={onNavigateBack}
                className="p-2.5 mt-1 text-slate-400 hover:text-white bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800 rounded-xl active:scale-95 transition-all flex items-center gap-1.5 shrink-0 shadow-md"
                title={localize(profile.language, 'Back to Assistant', 'العودة للمساعد')}
              >
                <ArrowLeft className="w-5 h-5 rtl:rotate-180" />
                <span className="text-xs font-bold hidden sm:inline">{localize(profile.language, 'Back', 'رجوع')}</span>
              </button>
            )}
            {onMenuClick && (
              <button
                onClick={onMenuClick}
                className="p-2.5 mt-1 text-slate-400 hover:text-white bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800 rounded-xl active:scale-95 transition-all shrink-0 shadow-md"
                aria-label={localize(profile.language, 'Toggle menu', 'القائمة')}
                title={localize(profile.language, 'Open Menu', 'فتح القائمة')}
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
            <div>
              <h1 className="text-2xl md:text-4xl font-black text-white tracking-tight uppercase flex items-center gap-3">
                <span className="p-2 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <Target className="w-7 h-7" />
                </span>
                {localize(profile.language, 'Goal Tracker', 'متتبع الأهداف')}
              </h1>
              <p className="text-xs md:text-sm text-slate-400 font-medium mt-1.5">
                {localize(profile.language, 'Track your academic and personal goals with clear milestones', 'تابع أهدافك الدراسية والشخصية وحقق تقدمًا ملموسًا')}
              </p>
            </div>
          </div>

          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-cyan-500/20 active:scale-95 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            {localize(profile.language, 'New Goal', 'هدف جديد')}
          </button>
        </div>
      </header>

      <div className="flex-1 p-6 md:p-10 space-y-8 pb-20">
        {/* Statistics */}
        <GoalStats goals={goals} language={profile.language} />

        {/* Goals list */}
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-slate-400 font-bold text-xs uppercase tracking-widest">
            <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
            <span>{localize(profile.language, 'Loading goals...', 'جاري تحميل الأهداف...')}</span>
          </div>
        ) : goals.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-24 gap-6 border-2 border-dashed border-slate-800 rounded-[36px] bg-[#121524]/40">
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-[28px] text-cyan-400">
              <Target className="w-10 h-10" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-black text-white uppercase tracking-tight">
                {localize(profile.language, 'No goals yet', 'لا توجد أهداف بعد')}
              </h3>
              <p className="text-sm text-slate-400 font-medium max-w-xs">
                {localize(profile.language, 'Start by adding your first goal and breaking it into clear milestones', 'ابدأ بإضافة هدفك الأول وتقسيمه إلى خطوات واضحة')}
              </p>
            </div>
            <button
              onClick={() => setAddOpen(true)}
              className="flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-cyan-500/20 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              {localize(profile.language, 'Add Your First Goal', 'أضف هدفك الأول')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <AnimatePresence>
              {goals.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  uid={profile.uid}
                  onEdit={setEditingGoal}
                  onDelete={handleDeleteGoal}
                  language={profile.language}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Modals */}
      <AddGoalModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSave={handleAddGoal}
        language={profile.language}
      />

      <EditGoalModal
        goal={editingGoal}
        onClose={() => setEditingGoal(null)}
        onSave={handleUpdateGoal}
        language={profile.language}
      />
    </div>
  );
}