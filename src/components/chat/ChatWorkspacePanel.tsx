import React, { useState, useEffect } from 'react';
import { 
  FolderGit2, Plus, Brain, Cpu, Sigma, BookOpen, 
  Sparkles, Clock, X, ChevronLeft, Trash2
} from 'lucide-react';
import { UserProfile } from '../../types';
import { StudentState } from '../../lib/studentStateEngine';
import { localize } from '../../lib/translations';

export interface StudySubject {
  id: string;
  name: string;
  icon: 'brain' | 'math' | 'cpu' | 'book' | 'sparkles';
  progress: number; // 0 - 100
  color: string;
}

interface ChatWorkspacePanelProps {
  profile: UserProfile;
  studentState?: StudentState;
  isOpen: boolean;
  onClose?: () => void;
  activeSubjectId: string;
  onSelectSubject: (subject: StudySubject) => void;
  studyMinutes: number;
  messageCount?: number;
}

const DEFAULT_SUBJECTS_BY_FIELD: Record<string, StudySubject[]> = {
  Engineering: [
    { id: 'sub-1', name: 'Neural Networks & Deep Learning', icon: 'brain', progress: 0, color: 'from-cyan-500 to-indigo-600' },
    { id: 'sub-2', name: 'Linear Algebra & Matrices', icon: 'math', progress: 0, color: 'from-blue-500 to-cyan-500' },
    { id: 'sub-3', name: 'Operating Systems & Concurrency', icon: 'cpu', progress: 0, color: 'from-indigo-500 to-purple-600' },
  ],
  Medicine: [
    { id: 'sub-1', name: 'Clinical Neuroanatomy', icon: 'brain', progress: 0, color: 'from-cyan-500 to-blue-600' },
    { id: 'sub-2', name: 'Cardiovascular Physiology', icon: 'sparkles', progress: 0, color: 'from-rose-500 to-amber-500' },
    { id: 'sub-3', name: 'Pharmacokinetics & Dosage', icon: 'book', progress: 0, color: 'from-emerald-500 to-cyan-500' },
  ],
  Business: [
    { id: 'sub-1', name: 'Corporate Financial Modeling', icon: 'math', progress: 0, color: 'from-emerald-500 to-cyan-600' },
    { id: 'sub-2', name: 'Strategic Market Analytics', icon: 'sparkles', progress: 0, color: 'from-indigo-500 to-cyan-500' },
    { id: 'sub-3', name: 'Microeconomic Principles', icon: 'book', progress: 0, color: 'from-blue-500 to-indigo-600' },
  ],
  General: [
    { id: 'sub-1', name: 'Neural Networks & AI Basics', icon: 'brain', progress: 0, color: 'from-cyan-500 to-indigo-600' },
    { id: 'sub-2', name: 'Linear Algebra & Calculus', icon: 'math', progress: 0, color: 'from-blue-500 to-cyan-500' },
    { id: 'sub-3', name: 'Algorithms & Problem Solving', icon: 'cpu', progress: 0, color: 'from-indigo-500 to-purple-600' },
  ],
};

export default function ChatWorkspacePanel({
  profile,
  studentState,
  isOpen,
  onClose,
  activeSubjectId,
  onSelectSubject,
  studyMinutes,
  messageCount = 0,
}: ChatWorkspacePanelProps) {
  const storageKey = `cognify_workspace_subjects_${profile.uid || 'guest'}`;

  const [subjects, setSubjects] = useState<StudySubject[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}

    const fieldDefaults = DEFAULT_SUBJECTS_BY_FIELD[profile.field || 'General'] || DEFAULT_SUBJECTS_BY_FIELD.General;
    return fieldDefaults.map(s => ({ ...s, progress: 0 }));
  });

  const [isAdding, setIsAdding] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');

  // Save changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(subjects));
    } catch {}
  }, [subjects, storageKey]);

  // Dynamically compute progress for each subject from real tasks or concept mastery records
  const getDynamicSubjectProgress = (sub: StudySubject): number => {
    // 1. Calculate from matching tasks in profile
    const matchingTasks = (profile.tasks || []).filter(t => 
      t.content.toLowerCase().includes(sub.name.toLowerCase()) ||
      sub.name.toLowerCase().includes(t.content.toLowerCase())
    );
    if (matchingTasks.length > 0) {
      const completed = matchingTasks.filter(t => t.completed).length;
      return Math.round((completed / matchingTasks.length) * 100);
    }

    // 2. Calculate from concept mastery entries matching subject name
    const subWords = sub.name.toLowerCase().split(/[\s,&-]+/).filter(w => w.length > 3);
    const masteryEntries = Object.values(studentState?.conceptMastery || {});
    const matched = masteryEntries.filter(m => 
      subWords.some(w => m.conceptId.toLowerCase().includes(w))
    );
    if (matched.length > 0) {
      const avgAccuracy = matched.reduce((acc, m) => acc + (m.accuracy || 0), 0) / matched.length;
      return Math.round(avgAccuracy * 100);
    }

    return sub.progress || 0;
  };

  const handleAddSubject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjectName.trim()) return;
    const newSub: StudySubject = {
      id: `sub-${Date.now()}`,
      name: newSubjectName.trim(),
      icon: 'sparkles',
      progress: 0,
      color: 'from-cyan-500 to-blue-600',
    };
    const updated = [...subjects, newSub];
    setSubjects(updated);
    onSelectSubject(newSub);
    setNewSubjectName('');
    setIsAdding(false);
  };

  const handleDeleteSubject = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = subjects.filter(s => s.id !== id);
    setSubjects(updated);
  };

  const getSubjectIcon = (icon: StudySubject['icon']) => {
    switch (icon) {
      case 'brain': return <Brain className="w-4 h-4 text-cyan-400" />;
      case 'math': return <Sigma className="w-4 h-4 text-blue-400" />;
      case 'cpu': return <Cpu className="w-4 h-4 text-indigo-400" />;
      case 'book': return <BookOpen className="w-4 h-4 text-emerald-400" />;
      case 'sparkles': return <Sparkles className="w-4 h-4 text-amber-400" />;
      default: return <Brain className="w-4 h-4 text-cyan-400" />;
    }
  };

  // Real Dynamic Metrics from Student State Engine
  const possibleStruggle = studentState?.learningStrain?.possibleStruggle ?? 0;
  const struggleSignal = studentState?.struggleSignal ?? 0;
  const realFocus = Math.max(10, Math.min(100, Math.round(100 - (possibleStruggle * 40) - (struggleSignal * 30))));

  const realPace = studyMinutes > 0 
    ? ((messageCount || 0) / studyMinutes).toFixed(1) + 'x'
    : (messageCount > 0 ? `${messageCount}.0x` : '1.0x');

  const masteryRecords = Object.values(studentState?.conceptMastery || {});
  const realMastery = masteryRecords.length > 0
    ? Math.round((masteryRecords.reduce((acc, r) => acc + (r.accuracy || 0), 0) / masteryRecords.length) * 100)
    : (profile.questionScore ? Math.round(profile.questionScore * 10) : 0);

  if (!isOpen) return null;

  return (
    <aside 
      aria-label="Workspace & Study Intelligence"
      className="w-72 lg:w-80 shrink-0 h-full bg-[#0A0C14]/95 border-r border-slate-800/80 backdrop-blur-2xl flex flex-col justify-between p-4 z-20 transition-all select-none overflow-y-auto custom-scrollbar relative"
    >
      {/* Collapsible Edge Arrow Button Pinned to Border */}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Collapse Workspace"
          title={localize(profile.language, 'Collapse Workspace', 'طي مساحة العمل')}
          className="hidden xl:flex absolute -end-3.5 top-1/2 -translate-y-1/2 z-30 w-7 h-12 bg-[#121524] border border-slate-700/80 hover:border-cyan-500/50 rounded-e-xl items-center justify-center text-slate-400 hover:text-cyan-300 shadow-xl transition-all active:scale-95 group cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        </button>
      )}

      <div className="space-y-4">
        {/* Workspace Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shadow-sm">
              <FolderGit2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-100 flex items-center gap-1.5">
                {localize(profile.language, 'Workspace', 'مساحة العمل')}
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              </h3>
              <p className="text-[10px] text-slate-500 font-semibold truncate max-w-[120px]">
                {profile.faculty || profile.field || 'Curriculum'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsAdding(!isAdding)}
              title={localize(profile.language, 'Add study subject', 'إضافة مادة دراسية')}
              className="p-1.5 text-slate-400 hover:text-cyan-300 hover:bg-slate-800/60 rounded-lg transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            {onClose && (
              <button
                onClick={onClose}
                aria-label="Collapse Workspace"
                title={localize(profile.language, 'Collapse Workspace', 'طي مساحة العمل')}
                className="p-1.5 text-slate-400 hover:text-cyan-300 hover:bg-slate-800/60 rounded-lg transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* New Subject Input Form */}
        {isAdding && (
          <form onSubmit={handleAddSubject} className="p-2.5 bg-[#121524] border border-cyan-500/40 rounded-2xl space-y-2 animate-in fade-in duration-150">
            <input
              type="text"
              value={newSubjectName}
              onChange={(e) => setNewSubjectName(e.target.value)}
              placeholder={localize(profile.language, 'Subject name (e.g. Algorithms)', 'اسم المادة (مثل الخوارزميات)')}
              className="w-full bg-[#0A0C14] border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-500"
              autoFocus
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-2.5 py-1 text-[11px] text-slate-400 hover:text-white"
              >
                {localize(profile.language, 'Cancel', 'إلغاء')}
              </button>
              <button
                type="submit"
                disabled={!newSubjectName.trim()}
                className="px-3 py-1 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-lg text-[11px] font-bold disabled:opacity-40 transition-all shadow-md shadow-cyan-500/20"
              >
                {localize(profile.language, 'Add', 'إضافة')}
              </button>
            </div>
          </form>
        )}

        {/* Active Focus Modules Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-400 px-1">
            <span>{localize(profile.language, 'Active Focus Modules', 'الوحدات الدراسية')}</span>
            <span className="font-mono text-cyan-400">{subjects.length}</span>
          </div>

          {subjects.map((sub) => {
            const isActive = activeSubjectId === sub.id;
            const progress = getDynamicSubjectProgress(sub);
            return (
              <div
                key={sub.id}
                onClick={() => onSelectSubject(sub)}
                className={`w-full text-start p-3 rounded-2xl border transition-all cursor-pointer group relative ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-950/40 via-[#121524] to-[#121524] border-cyan-500/50 shadow-lg shadow-cyan-500/10'
                    : 'bg-[#121524]/80 border-slate-800/80 hover:border-slate-700 hover:bg-[#15192c]'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 shrink-0">
                      {getSubjectIcon(sub.icon)}
                    </div>
                    <span className="text-xs font-bold text-slate-200 group-hover:text-white truncate">
                      {sub.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[11px] font-mono font-bold text-cyan-400">
                      {progress}%
                    </span>
                    {subjects.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => handleDeleteSubject(sub.id, e)}
                        title="Remove subject"
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 transition-opacity"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden border border-slate-800/80">
                  <div 
                    className={`h-full bg-gradient-to-r ${sub.color} rounded-full transition-all duration-500`}
                    style={{ width: `${Math.max(progress, 2)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Study Session Intelligence Card */}
      <div className="mt-4 pt-4 border-t border-slate-800/80">
        <div className="bg-[#121524]/90 border border-slate-800/90 rounded-2xl p-3.5 shadow-xl backdrop-blur-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              {localize(profile.language, 'Current Study Session', 'جلسة المذاكرة الحالية')}
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-black bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
              {studyMinutes}m
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-1 text-center">
            <div className="bg-[#0A0C14] border border-slate-800/80 rounded-xl p-2">
              <div className="text-[9px] font-bold text-slate-400 uppercase">
                {localize(profile.language, 'Focus', 'التركيز')}
              </div>
              <div className="text-xs font-black text-emerald-400 font-mono mt-0.5">
                {realFocus}%
              </div>
            </div>

            <div className="bg-[#0A0C14] border border-slate-800/80 rounded-xl p-2">
              <div className="text-[9px] font-bold text-slate-400 uppercase">
                {localize(profile.language, 'Pace', 'السرعة')}
              </div>
              <div className="text-xs font-black text-cyan-400 font-mono mt-0.5">
                {realPace}
              </div>
            </div>

            <div className="bg-[#0A0C14] border border-slate-800/80 rounded-xl p-2">
              <div className="text-[9px] font-bold text-slate-400 uppercase">
                {localize(profile.language, 'Mastery', 'الإتقان')}
              </div>
              <div className="text-xs font-black text-indigo-400 font-mono mt-0.5">
                {realMastery}%
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
