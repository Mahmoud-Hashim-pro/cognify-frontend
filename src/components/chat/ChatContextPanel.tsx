import React from 'react';
import { 
  Compass, Globe, Github, FileText, FolderGit2, ExternalLink, 
  Sparkles, CheckCircle2, ChevronRight, X, ArrowUpRight, BookOpen
} from 'lucide-react';
import { UserProfile } from '../../types';
import { StudentState } from '../../lib/studentStateEngine';
import { localize } from '../../lib/translations';

export interface ContextSource {
  id: string;
  name: string;
  type: 'google' | 'github' | 'arxiv' | 'course';
  description: string;
  tag: string;
}

interface ChatContextPanelProps {
  profile: UserProfile;
  studentState?: StudentState;
  isOpen: boolean;
  onClose?: () => void;
  onCiteSource: (source: ContextSource) => void;
  messageCount?: number;
}

const CITATION_SOURCES: ContextSource[] = [
  {
    id: 'src-google',
    name: 'Google AI Research Blog',
    type: 'google',
    description: 'Frontier foundation models, Gemini architecture papers, multimodal reasoning & benchmark evaluations.',
    tag: 'Research',
  },
  {
    id: 'src-github',
    name: 'OpenSource Repositories',
    type: 'github',
    description: 'Verified PyTorch, TensorFlow, and HuggingFace algorithmic implementations, benchmarks & code repositories.',
    tag: 'GitHub',
  },
  {
    id: 'src-arxiv',
    name: 'Academic Papers & ArXiv',
    type: 'arxiv',
    description: 'Peer-reviewed scientific literature, arXiv preprints, mathematical proofs & formal specifications.',
    tag: 'Academic',
  },
  {
    id: 'src-course',
    name: 'Course Notes & Syllabi',
    type: 'course',
    description: 'Undergraduate and graduate course syllabi, prerequisite concept maps & lecture problem sets.',
    tag: 'Curriculum',
  },
];

export default function ChatContextPanel({
  profile,
  studentState,
  isOpen,
  onClose,
  onCiteSource,
  messageCount = 0,
}: ChatContextPanelProps) {
  if (!isOpen) return null;

  // Real Dynamic Knowledge Map metrics
  const totalConcepts = Object.keys(studentState?.conceptMastery || {}).length;
  const masteredConcepts = Object.values(studentState?.conceptMastery || {}).filter(
    c => (c.accuracy ?? 0) >= 0.7 || (c.confidence ?? 0) >= 0.7
  ).length;

  const curriculumMastery = totalConcepts > 0 
    ? Math.round((masteredConcepts / totalConcepts) * 100)
    : (profile.questionScore ? Math.round(profile.questionScore * 10) : 0);

  const schedules = Object.values(studentState?.retentionSchedules || {});
  const retentionRate = schedules.length > 0
    ? Math.round((schedules.filter(s => s.repetitions > 0 || s.status === 'retained').length / schedules.length) * 100)
    : (masteredConcepts > 0 ? 100 : 0);

  const getSourceIcon = (type: ContextSource['type']) => {
    switch (type) {
      case 'google':
        return (
          <div className="w-5 h-5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-black text-xs">
            G
          </div>
        );
      case 'github':
        return (
          <div className="w-5 h-5 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Github className="w-3 h-3" />
          </div>
        );
      case 'arxiv':
        return (
          <div className="w-5 h-5 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <FileText className="w-3 h-3" />
          </div>
        );
      case 'course':
        return (
          <div className="w-5 h-5 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <FolderGit2 className="w-3 h-3" />
          </div>
        );
    }
  };

  return (
    <aside 
      aria-label="Context & Research Citations"
      className="w-72 lg:w-80 shrink-0 h-full bg-[#0A0C14]/95 border-l border-slate-800/80 backdrop-blur-2xl flex flex-col justify-between p-4 z-20 transition-all select-none overflow-y-auto custom-scrollbar relative"
    >
      {/* Collapsible Edge Arrow Button Pinned to Border */}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Collapse Context"
          title={localize(profile.language, 'Collapse Context Panel', 'طي لوحة المصادر')}
          className="hidden xl:flex absolute -start-3.5 top-1/2 -translate-y-1/2 z-30 w-7 h-12 bg-[#121524] border border-slate-700/80 hover:border-indigo-500/50 rounded-s-xl items-center justify-center text-slate-400 hover:text-indigo-300 shadow-xl transition-all active:scale-95 group cursor-pointer"
        >
          <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </button>
      )}

      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 shadow-sm">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-100 flex items-center gap-1.5">
                {localize(profile.language, 'Context & Citations', 'السياق والمصادر')}
              </h3>
              <p className="text-[10px] text-slate-500 font-semibold">
                {localize(profile.language, 'Live Grounding Sources', 'مصادر التوثيق الحية')}
              </p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Close Context"
              title={localize(profile.language, 'Collapse Context Panel', 'طي لوحة المصادر')}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-lg transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Citation Source Cards */}
        <div className="space-y-2">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-1">
            {localize(profile.language, 'Grounding & Evidence', 'المراجع والأدلة')}
          </div>

          {CITATION_SOURCES.map((source) => (
            <div
              key={source.id}
              onClick={() => onCiteSource(source)}
              title={localize(profile.language, 'Click to ground explanation with this source', 'اضغط لتوثيق الشرح من هذا المصدر')}
              className="p-3 rounded-2xl bg-[#121524]/80 border border-slate-800/80 hover:border-indigo-500/50 hover:bg-[#15192c] transition-all cursor-pointer group shadow-sm"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  {getSourceIcon(source.type)}
                  <span className="text-xs font-bold text-slate-200 group-hover:text-indigo-300 transition-colors">
                    {source.name}
                  </span>
                </div>
                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400 shrink-0">
                  {source.tag}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-snug line-clamp-2 ps-7">
                {source.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Knowledge Map Progress Card */}
      <div className="mt-4 pt-4 border-t border-slate-800/80">
        <div className="bg-[#121524]/90 border border-slate-800/90 rounded-2xl p-3.5 shadow-xl backdrop-blur-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
              {localize(profile.language, 'Knowledge Map Progress', 'تقدم خارطة المعرفة')}
            </span>
            <span className="text-[10px] font-mono font-black text-emerald-400">
              {masteredConcepts > 0 ? `+${masteredConcepts} Mastered` : 'Live Grounding'}
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400">
              <span>{localize(profile.language, 'Curriculum Mastery', 'إتقان المنهج')}</span>
              <span className="font-mono text-cyan-400 font-bold">{curriculumMastery}%</span>
            </div>
            <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800/80">
              <div 
                className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 rounded-full transition-all duration-500"
                style={{ width: `${Math.max(curriculumMastery, 2)}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="flex items-center gap-2 p-2 bg-[#0A0C14] border border-slate-800 rounded-xl">
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <div className="text-[10px] text-slate-300 font-semibold truncate">
                {totalConcepts > 0 ? `${masteredConcepts}/${totalConcepts} Mastered` : `${masteredConcepts} Mastered`}
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 bg-[#0A0C14] border border-slate-800 rounded-xl">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <div className="text-[10px] text-slate-300 font-semibold truncate">
                {retentionRate > 0 ? `${retentionRate}% Retention` : '4 Verified Sources'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
