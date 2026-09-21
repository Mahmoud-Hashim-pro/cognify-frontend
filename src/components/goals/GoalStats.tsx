import { Goal } from '../../types';
import { isGoalOverdue } from '../../lib/goals';
import { isArabicLocale } from '../../lib/translations';
import { Target, CheckCircle2, Loader2 as InProgress, Circle, AlertTriangle } from 'lucide-react';

interface GoalStatsProps {
  goals: Goal[];
  language?: string;
}

export default function GoalStats({ goals, language }: GoalStatsProps) {
  const isArabic = isArabicLocale(language);

  const total     = goals.length;
  const completed = goals.filter((g) => g.status === 'completed').length;
  const inProg    = goals.filter((g) => g.status === 'in-progress').length;
  const notStart  = goals.filter((g) => g.status === 'not-started').length;
  const overdue   = goals.filter(isGoalOverdue).length;

  const cards = [
    {
      label: isArabic ? 'إجمالي الأهداف' : 'Total Goals',
      value: total,
      icon: Target,
      color: 'text-white',
      border: 'border-slate-800/80',
      iconBg: 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-400',
    },
    {
      label: isArabic ? 'مكتملة' : 'Completed',
      value: completed,
      icon: CheckCircle2,
      color: 'text-emerald-400',
      border: 'border-emerald-500/30',
      iconBg: 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400',
    },
    {
      label: isArabic ? 'قيد التنفيذ' : 'In Progress',
      value: inProg,
      icon: InProgress,
      color: 'text-cyan-400',
      border: 'border-cyan-500/30',
      iconBg: 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-400',
    },
    {
      label: isArabic ? 'لم تبدأ' : 'Not Started',
      value: notStart,
      icon: Circle,
      color: 'text-slate-300',
      border: 'border-slate-800/80',
      iconBg: 'bg-slate-800 border border-slate-700 text-slate-400',
    },
    {
      label: isArabic ? 'متأخرة' : 'Overdue',
      value: overdue,
      icon: AlertTriangle,
      color: 'text-rose-400',
      border: 'border-rose-500/30',
      iconBg: 'bg-rose-500/15 border border-rose-500/30 text-rose-400',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`bg-[#121524]/90 ${card.border} border rounded-3xl p-5 flex flex-col gap-3 shadow-xl backdrop-blur-xl hover:border-slate-700/80 transition-all`}
        >
          <div className={`${card.iconBg} w-10 h-10 rounded-2xl flex items-center justify-center shrink-0`}>
            <card.icon className="w-5 h-5" />
          </div>
          <div>
            <div className={`text-3xl font-black font-mono tracking-tight ${card.color}`}>{card.value}</div>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">
              {card.label}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}