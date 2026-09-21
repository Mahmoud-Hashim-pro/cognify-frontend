import React from 'react';
import { motion } from 'motion/react';
import { Sparkles, Lightbulb, ListChecks, HelpCircle, Zap, AlertTriangle } from 'lucide-react';
import { isArabicLocale } from '../../lib/translations';

export interface SmartFollowUpChipsProps {
  lastMessageContent: string;
  language?: string;
  onSelectChip: (prompt: string) => void;
  isLoading?: boolean;
}

export default function SmartFollowUpChips({
  lastMessageContent,
  language = 'Arabic',
  onSelectChip,
  isLoading = false,
}: SmartFollowUpChipsProps) {
  if (isLoading || !lastMessageContent || lastMessageContent.trim().length < 15) {
    return null;
  }

  const isAr = isArabicLocale(language);
  const isFr = language === 'French';

  const chips = React.useMemo(() => {
    if (isAr) {
      return [
        {
          id: 'example',
          label: 'اشرح بمثال عملي من الواقع',
          icon: Lightbulb,
          color: 'text-amber-300 border-amber-500/30 hover:bg-amber-500/10 hover:border-amber-400',
          prompt: 'اشرح المفهوم المشروح في الرد السابق بمثال عملي وتطبيقي ملموس من الواقع اليومي.',
        },
        {
          id: 'summary',
          label: 'لخص في 3 نقاط محددة',
          icon: ListChecks,
          color: 'text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/10 hover:border-cyan-400',
          prompt: 'لخص أهم ما ورد في الرد السابق في 3 نقاط مركزة ومحددة بدون أي حشو (الزبدة).',
        },
        {
          id: 'quiz',
          label: 'اختبرني بسؤال مباشر الآن',
          icon: HelpCircle,
          color: 'text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/10 hover:border-emerald-400',
          prompt: 'اطرح علي سؤال اختبار تفاعلي سريع ومباشر في المفهوم المشروح سابقاً لأتأكد من فهمي.',
        },
        {
          id: 'eli5',
          label: 'بسّطها كأني مبتدئ (ELI5)',
          icon: Zap,
          color: 'text-purple-300 border-purple-500/30 hover:bg-purple-500/10 hover:border-purple-400',
          prompt: 'اشرح النقطة السابقة بأسلوب مبسط جداً وخالٍ من المصطلحات المعقدة كأنك تشرحها لشخص مبتدئ.',
        },
        {
          id: 'pitfalls',
          label: 'ما هي الأخطاء الشائعة هنا؟',
          icon: AlertTriangle,
          color: 'text-rose-300 border-rose-500/30 hover:bg-rose-500/10 hover:border-rose-400',
          prompt: 'ما هي أبرز الأخطاء والمغالطات الشائعة التي يقع فيها الطلاب عند دراسة هذا المفهوم في الامتحانات؟',
        },
      ];
    }

    if (isFr) {
      return [
        {
          id: 'example',
          label: 'Explique avec un exemple concret',
          icon: Lightbulb,
          color: 'text-amber-300 border-amber-500/30 hover:bg-amber-500/10 hover:border-amber-400',
          prompt: 'Explique le concept précédent avec un exemple concret et réel de la vie quotidienne.',
        },
        {
          id: 'summary',
          label: 'Résume en 3 points clés',
          icon: ListChecks,
          color: 'text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/10 hover:border-cyan-400',
          prompt: 'Résume les points essentiels de la réponse précédente en 3 puces très concises.',
        },
        {
          id: 'quiz',
          label: 'Teste-moi avec une question',
          icon: HelpCircle,
          color: 'text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/10 hover:border-emerald-400',
          prompt: 'Pose-moi une question rapide pour vérifier ma compréhension de ce concept.',
        },
        {
          id: 'eli5',
          label: 'Simplifie pour un débutant (ELI5)',
          icon: Zap,
          color: 'text-purple-300 border-purple-500/30 hover:bg-purple-500/10 hover:border-purple-400',
          prompt: 'Réexplique ceci de manière très simple sans jargon complexe.',
        },
      ];
    }

    return [
      {
        id: 'example',
        label: 'Explain with a real example',
        icon: Lightbulb,
        color: 'text-amber-300 border-amber-500/30 hover:bg-amber-500/10 hover:border-amber-400',
        prompt: 'Explain the concept from your previous response using an intuitive real-world example.',
      },
      {
        id: 'summary',
        label: 'Summarize in 3 bullet points',
        icon: ListChecks,
        color: 'text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/10 hover:border-cyan-400',
        prompt: 'Summarize the core takeaways of your previous response into 3 punchy bullet points.',
      },
      {
        id: 'quiz',
        label: 'Quick check: Quiz me',
        icon: HelpCircle,
        color: 'text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/10 hover:border-emerald-400',
        prompt: 'Give me a quick 1-question check to test my understanding of what you just explained.',
      },
      {
        id: 'eli5',
        label: 'Explain simply (ELI5)',
        icon: Zap,
        color: 'text-purple-300 border-purple-500/30 hover:bg-purple-500/10 hover:border-purple-400',
        prompt: 'Explain this in plain, beginner-friendly terms with zero complex jargon.',
      },
      {
        id: 'pitfalls',
        label: 'Common exam pitfalls?',
        icon: AlertTriangle,
        color: 'text-rose-300 border-rose-500/30 hover:bg-rose-500/10 hover:border-rose-400',
        prompt: 'What are the most common misconceptions or exam pitfalls related to this concept?',
      },
    ];
  }, [isAr, isFr]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="w-full pt-3 pb-1"
    >
      <div className="flex items-center gap-1.5 mb-2.5">
        <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
        <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
          {isAr ? 'متابعة سريعة بنقرة واحدة:' : isFr ? 'Poursuivre en 1 clic :' : '1-Click Smart Follow-ups:'}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {chips.map((chip) => {
          const IconComponent = chip.icon;
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => onSelectChip(chip.prompt)}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border bg-[#101426]/90 text-xs font-semibold backdrop-blur-md shadow-md transition-all active:scale-95 cursor-pointer ${chip.color}`}
            >
              <IconComponent className="w-3.5 h-3.5 shrink-0" />
              <span>{chip.label}</span>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
