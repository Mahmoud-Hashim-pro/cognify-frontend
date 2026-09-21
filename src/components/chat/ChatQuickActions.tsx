import React from 'react';
import { 
  FileText, Sparkles, HelpCircle, RotateCcw, Lightbulb, 
  Layers, CheckSquare, BrainCircuit
} from 'lucide-react';
import { UserProfile } from '../../types';
import { localize, isArabicLocale } from '../../lib/translations';

interface ChatQuickActionsProps {
  profile: UserProfile;
  onUploadDocument: () => void;
  onQuickPrompt: (promptText: string) => void;
  disabled?: boolean;
}

export default function ChatQuickActions({
  profile,
  onUploadDocument,
  onQuickPrompt,
  disabled = false,
}: ChatQuickActionsProps) {
  const isArabic = isArabicLocale(profile.language);

  const actions = [
    {
      id: 'doc',
      icon: <FileText className="w-3.5 h-3.5 text-cyan-400" />,
      label: localize(profile.language, 'Analyze Document', 'تحليل مستند / PDF'),
      onClick: onUploadDocument,
    },
    {
      id: 'flashcards',
      icon: <Layers className="w-3.5 h-3.5 text-purple-400" />,
      label: localize(profile.language, 'Generate Flashcards', 'إنشاء بطاقات استذكار'),
      onClick: () => {
        const prompt = isArabic
          ? 'أنشئ بطاقات استذكار تفاعلية (Flashcards) مع أسئلة وإجابات مركزة تلخص أهم المفاهيم التي شرحتها لي الآن.'
          : 'Generate active recall flashcards with clear questions and answers summarizing the key concepts we just discussed.';
        onQuickPrompt(prompt);
      },
    },
    {
      id: 'problems',
      icon: <BrainCircuit className="w-3.5 h-3.5 text-emerald-400" />,
      label: localize(profile.language, 'Practice Problems', 'مسائل تدريبية'),
      onClick: () => {
        const prompt = isArabic
          ? 'أعطني 3 مسائل تدريبية متدرجة الصعوبة لاختبار فهمي لما تعلمته للتو، مع تلميحات توجيهية لحل كل مسألة.'
          : 'Give me 3 progressive practice exercises/problems based on this topic, with guided hints for solving each one.';
        onQuickPrompt(prompt);
      },
    },
    {
      id: 're-explain',
      icon: <RotateCcw className="w-3.5 h-3.5 text-amber-400" />,
      label: localize(profile.language, 'Re-explain', 'إعادة الشرح بأسلوب آخر'),
      onClick: () => {
        const prompt = isArabic
          ? 'أعد شرح الفكرة الأخيرة بأسلوب مبسط جداً ومن زاوية مختلفة، واستخدم تشبيهاً واقعياً من الحياة اليومية.'
          : 'Please re-explain the last concept using a fresh perspective and an intuitive, real-world analogy.';
        onQuickPrompt(prompt);
      },
    },
    {
      id: 'takeaways',
      icon: <Lightbulb className="w-3.5 h-3.5 text-cyan-300" />,
      label: localize(profile.language, 'Key Takeaways', 'الخلاصة وأهم النقاط'),
      onClick: () => {
        const prompt = isArabic
          ? 'لخص لي هذا الموضوع في 3 نقاط جوهرية مركزة وواضحة جداً (Key Takeaways).'
          : 'Summarize the core takeaways of this topic into 3 crisp, essential bullet points.';
        onQuickPrompt(prompt);
      },
    },
  ];

  return (
    <div className="w-full flex items-center justify-center pb-2">
      <div className="flex items-center gap-1.5 p-1 bg-[#121524]/90 border border-slate-800/90 rounded-2xl shadow-xl backdrop-blur-2xl overflow-x-auto no-scrollbar scrollbar-none max-w-full">
        {actions.map((act) => (
          <button
            key={act.id}
            type="button"
            disabled={disabled}
            onClick={act.onClick}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0A0C14] hover:bg-[#181d33] border border-slate-800/80 hover:border-slate-700 text-slate-300 hover:text-white text-[11px] font-bold tracking-wide transition-all shrink-0 active:scale-95 disabled:opacity-50"
          >
            {act.icon}
            <span>{act.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
