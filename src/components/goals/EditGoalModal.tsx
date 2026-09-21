import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Loader2, Edit3 } from 'lucide-react';
import { Goal, GoalPriority, Milestone } from '../../types';
import { deriveGoalMeta } from '../../lib/goals';
import { isArabicLocale } from '../../lib/translations';
import MilestoneList from './MilestoneList';

interface EditGoalModalProps {
  goal: Goal | null;
  onClose: () => void;
  onSave: (goalId: string, updates: Partial<Goal>) => Promise<void>;
  language?: string;
}

export default function EditGoalModal({ goal, onClose, onSave, language }: EditGoalModalProps) {
  const [form, setForm] = useState<{
    title: string;
    description: string;
    priority: GoalPriority;
    deadline: string;
    milestones: Milestone[];
  }>({ title: '', description: '', priority: 'medium', deadline: '', milestones: [] });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const isArabic = isArabicLocale(language);

  // Sync form when a goal is passed in
  useEffect(() => {
    if (goal) {
      setForm({
        title: goal.title,
        description: goal.description,
        priority: goal.priority,
        deadline: goal.deadline,
        milestones: goal.milestones,
      });
      setError('');
    }
  }, [goal]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setError(isArabic ? 'اسم الهدف مطلوب' : 'Goal title is required');
      return;
    }
    if (!form.deadline) {
      setError(isArabic ? 'الموعد النهائي مطلوب' : 'Deadline is required');
      return;
    }
    if (!goal) return;

    setSaving(true);
    setError('');

    const { progress, status } = deriveGoalMeta(form.milestones, form.deadline);

    try {
      await onSave(goal.id, {
        title: form.title.trim(),
        description: form.description.trim(),
        priority: form.priority,
        deadline: form.deadline,
        milestones: form.milestones,
        progress,
        status,
      });
      onClose();
    } catch {
      setError(isArabic ? 'حدث خطأ، حاول مرة أخرى' : 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const priorityOptions: { value: GoalPriority; label: string; color: string }[] = [
    { value: 'low',    label: isArabic ? 'منخفض' : 'Low',    color: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-400' },
    { value: 'medium', label: isArabic ? 'متوسط' : 'Medium', color: 'border-amber-500/30 bg-amber-500/15 text-amber-400' },
    { value: 'high',   label: isArabic ? 'عالي' : 'High',   color: 'border-rose-500/30 bg-rose-500/15 text-rose-400' },
  ];

  return (
    <AnimatePresence>
      {goal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.97 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative bg-[#121524] border border-slate-800 text-slate-100 rounded-[32px] w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between p-8 pb-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-500/15 border border-amber-500/30 rounded-2xl">
                  <Edit3 className="w-5 h-5 text-amber-400" />
                </div>
                <h2 className="text-lg font-black text-white uppercase tracking-tight">
                  {isArabic ? 'تعديل الهدف' : 'Edit Goal'}
                </h2>
              </div>
              <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-800 transition-colors text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              {/* Title */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {isArabic ? 'اسم الهدف' : 'Goal Title'} *
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full bg-[#0A0C14] border border-slate-800 rounded-2xl px-4 py-3 text-xs font-semibold text-white outline-none focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/10"
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {isArabic ? 'الوصف' : 'Description'}
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full bg-[#0A0C14] border border-slate-800 rounded-2xl px-4 py-3 text-xs font-semibold text-white outline-none focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/10 resize-none"
                />
              </div>

              {/* Priority + Deadline */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {isArabic ? 'الأولوية' : 'Priority'}
                  </label>
                  <div className="flex flex-col gap-1.5">
                    {priorityOptions.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setForm({ ...form, priority: opt.value })}
                        className={`px-3 py-2 rounded-xl border text-xs font-bold transition-all ${
                          form.priority === opt.value
                            ? opt.color
                            : 'border-slate-800 bg-[#0A0C14] text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {isArabic ? 'الموعد النهائي' : 'Deadline'} *
                  </label>
                  <input
                    type="date"
                    value={form.deadline}
                    onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                    className="w-full bg-[#0A0C14] border border-slate-800 rounded-2xl px-3 py-3 text-xs font-semibold text-white outline-none focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/10 [color-scheme:dark]"
                  />
                </div>
              </div>

              {/* Milestones */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {isArabic ? 'الخطوات (Milestones)' : 'Milestones'}
                </label>
                <div className="bg-[#0A0C14] border border-slate-800 rounded-2xl p-4">
                  <MilestoneList
                    milestones={form.milestones}
                    onChange={(ms) => setForm({ ...form, milestones: ms })}
                    language={language}
                  />
                </div>
              </div>

              {error && <p className="text-xs text-rose-400 font-bold px-1">{error}</p>}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-400 bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:text-white transition-all active:scale-95"
                >
                  {isArabic ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest text-white bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 transition-all shadow-xl shadow-amber-500/20 disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95"
                >
                  {saving ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> {isArabic ? 'جاري الحفظ...' : 'Saving...'}</>
                  ) : (
                    isArabic ? 'حفظ التعديلات' : 'Save Changes'
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}