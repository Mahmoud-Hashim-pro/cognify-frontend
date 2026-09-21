import { useState } from 'react';
import { Milestone } from '../../types';
import { isArabicLocale } from '../../lib/translations';
import { Plus, Trash2, CheckCircle2, Circle } from 'lucide-react';

interface MilestoneListProps {
  milestones: Milestone[];
  onChange: (milestones: Milestone[]) => void;
  /** When true, milestones are read-only checkboxes (used in GoalCard). */
  readOnly?: boolean;
  language?: string;
}

export default function MilestoneList({
  milestones,
  onChange,
  readOnly = false,
  language,
}: MilestoneListProps) {
  const [newTitle, setNewTitle] = useState('');
  const isArabic = isArabicLocale(language);

  const toggleMilestone = (id: string) => {
    onChange(
      milestones.map((m) =>
        m.id === id ? { ...m, completed: !m.completed } : m
      )
    );
  };

  const addMilestone = () => {
    const title = newTitle.trim();
    if (!title) return;
    const milestone: Milestone = {
      id: Date.now().toString(),
      title,
      completed: false,
    };
    onChange([...milestones, milestone]);
    setNewTitle('');
  };

  const removeMilestone = (id: string) => {
    onChange(milestones.filter((m) => m.id !== id));
  };

  return (
    <div className="space-y-2.5">
      {milestones.map((m) => (
        <div
          key={m.id}
          className="flex items-center gap-3 group py-1"
        >
          <button
            type="button"
            onClick={() => toggleMilestone(m.id)}
            className="flex-shrink-0 transition-transform active:scale-90"
          >
            {m.completed ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            ) : (
              <Circle className="w-5 h-5 text-slate-600" />
            )}
          </button>

          <span
            className={`flex-1 text-xs font-semibold transition-colors ${
              m.completed ? 'line-through text-slate-500' : 'text-slate-200'
            }`}
          >
            {m.title}
          </span>

          {!readOnly && (
            <button
              type="button"
              onClick={() => removeMilestone(m.id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-rose-500/20 rounded-xl text-slate-500 hover:text-rose-400"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ))}

      {!readOnly && (
        <div className="flex items-center gap-2 pt-2">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addMilestone())}
            placeholder={isArabic ? 'أضف خطوة جديدة...' : 'Add a milestone...'}
            className="flex-1 text-xs bg-[#0A0C14] border border-slate-800 rounded-2xl px-4 py-2.5 outline-none focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/10 text-white placeholder:text-slate-500 font-medium"
          />
          <button
            type="button"
            onClick={addMilestone}
            className="p-2.5 bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 rounded-2xl hover:bg-cyan-500/25 transition-colors active:scale-95"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}