import { localize, isArabicLocale } from '../lib/translations';
import { useEffect, useMemo, useState } from 'react';
import { UserProfile, PlannerTask, PlannerTaskType } from '../types';
import { 
  Menu, Plus, Trash2, CalendarDays, CheckCircle2, Circle, ArrowLeft,
  RotateCcw, Award, Layers, Mic, BookMarked
} from 'lucide-react';
import { daysUntilDue, isOverdue, subscribeToTasks, saveTask, deleteTask, parseLocalDate } from '../lib/planner';
import MockExamSimulator from './academic/MockExamSimulator';
import DynamicScheduleView from './academic/DynamicScheduleView';
import LectureDigester from './academic/LectureDigester';
import SocraticStudyBuddy from './academic/SocraticStudyBuddy';
import ResearchCitationCopilot from './academic/ResearchCitationCopilot';

interface AcademicPlannerProps {
  profile: UserProfile;
  onMenuClick?: () => void;
  onNavigateBack?: () => void;
}

const TYPE_META: Record<PlannerTaskType, { en: string; ar: string; color: string }> = {
  assignment: { en: 'Assignment', ar: 'تكليف', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  quiz: { en: 'Quiz', ar: 'كويز', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  midterm: { en: 'Midterm', ar: 'ميدتيرم', color: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
  final: { en: 'Final', ar: 'فاينال', color: 'bg-rose-500/15 text-rose-400 border-rose-500/30' },
  project: { en: 'Project', ar: 'مشروع', color: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30' },
  other: { en: 'Other', ar: 'أخرى', color: 'bg-slate-800 text-slate-300 border-slate-700' },
};

// Safe lookup — legacy/unknown task types fall back to 'other' instead of
// crashing the planner with `undefined.color`.
const metaOf = (type?: string) => TYPE_META[(type as PlannerTaskType)] || TYPE_META.other;

export type AcademicTab = 'tasks' | 'schedule' | 'mock-exam' | 'digester' | 'socratic' | 'research';

const ACADEMIC_TABS: { id: AcademicTab; en: string; ar: string; icon: any }[] = [
  { id: 'tasks', en: 'Tasks & Deadlines', ar: 'المهام والمواعيد', icon: CalendarDays },
  { id: 'schedule', en: 'Smart Schedule & Rebalance', ar: 'جدول المذاكرة وإعادة الموازنة', icon: RotateCcw },
  { id: 'mock-exam', en: 'AI Mock Exams', ar: 'محاكي الامتحانات وتصحيح المقالي', icon: Award },
  { id: 'digester', en: 'Lecture Digester', ar: 'كبسولة ومحلل المحاضرات', icon: Layers },
  { id: 'socratic', en: 'Socratic Oral Buddy', ar: 'رفيق "سمّعلي" الصوتي', icon: Mic },
  { id: 'research', en: 'Research & Citations', ar: 'مساعد الأبحاث والمراجع', icon: BookMarked },
];

export default function AcademicPlanner({ profile, onMenuClick, onNavigateBack }: AcademicPlannerProps) {
  const isAr = isArabicLocale(profile.language);
  const t = (en: string, ar: string) => localize(profile.language, en, ar);
  const [activeTab, setActiveTab] = useState<AcademicTab>('tasks');
  const [tasks, setTasks] = useState<PlannerTask[]>([]);

  const [title, setTitle] = useState('');
  const [type, setType] = useState<PlannerTaskType>('assignment');
  const [course, setCourse] = useState('');
  const [dueDate, setDueDate] = useState('');

  useEffect(() => {
    if (!profile.uid) return;
    const unsub = subscribeToTasks(profile.uid, setTasks);
    return () => unsub();
  }, [profile.uid]);

  const addTask = async () => {
    if (!title.trim() || !dueDate || !profile.uid) return;
    const task: PlannerTask = {
      id: `p-${Date.now()}`,
      title: title.trim(),
      type,
      course: course.trim(),
      dueDate,
      completed: false,
      createdAt: new Date().toISOString(),
    };
    await saveTask(profile.uid, task);
    setTitle(''); setCourse('');
  };

  const toggle = (task: PlannerTask) => {
    if (!profile.uid) return;
    const next = { ...task, completed: !task.completed };
    setTasks((prev) => prev.map((x) => (x.id === task.id ? next : x)));
    saveTask(profile.uid, next);
  };

  const { upcoming, overdue, done } = useMemo(() => {
    const upcoming: PlannerTask[] = [], overdue: PlannerTask[] = [], done: PlannerTask[] = [];
    for (const task of tasks) {
      if (task.completed) done.push(task);
      else if (isOverdue(task)) overdue.push(task);
      else upcoming.push(task);
    }
    return { upcoming, overdue, done };
  }, [tasks]);

  const countdown = (task: PlannerTask) => {
    const d = daysUntilDue(task);
    if (d < 0) return { label: t('overdue', 'متأخر'), color: 'bg-rose-500/20 text-rose-300 border border-rose-500/30' };
    if (d === 0) return { label: t('today', 'النهاردة'), color: 'bg-rose-500/20 text-rose-300 border border-rose-500/30' };
    if (d === 1) return { label: t('tomorrow', 'بكرة'), color: 'bg-amber-500/20 text-amber-300 border border-amber-500/30' };
    if (d <= 3) return { label: `${d} ${t('days', 'أيام')}`, color: 'bg-amber-500/10 text-amber-300 border border-amber-500/20' };
    return { label: `${d} ${t('days', 'يوم')}`, color: 'bg-slate-800/80 text-slate-300 border border-slate-700/60' };
  };

  const TaskRow = ({ task }: { task: PlannerTask }) => {
    const meta = metaOf(task.type);
    const cd = countdown(task);
    return (
      <div className="flex items-center gap-3 px-5 py-4 bg-[#121524]/90 border border-slate-800/80 hover:border-slate-700/80 rounded-2xl transition-all backdrop-blur-md shadow-lg group">
        <button onClick={() => toggle(task)} className="text-slate-500 hover:text-emerald-400 shrink-0 transition-colors">
          {task.completed ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <Circle className="w-5 h-5" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className={`font-bold text-sm truncate ${task.completed ? 'line-through text-slate-500' : 'text-slate-100'}`}>{task.title}</div>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md border ${meta.color}`}>{t(meta.en, meta.ar)}</span>
            {task.course && <span className="text-[10px] text-slate-400 font-medium">{task.course}</span>}
            <span className="text-[10px] text-slate-500">{parseLocalDate(task.dueDate).toLocaleDateString()}</span>
          </div>
        </div>
        {!task.completed && <span className={`text-[10px] font-black px-2.5 py-1 rounded-xl shrink-0 ${cd.color}`}>{cd.label}</span>}
        <button onClick={() => profile.uid && deleteTask(profile.uid, task.id)} className="p-1.5 text-slate-500 hover:text-rose-400 opacity-80 hover:opacity-100 shrink-0 transition-all" title={t('Delete', 'حذف')}>
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    );
  };

  const Section = ({ title, items }: { title: string; items: PlannerTask[] }) =>
    items.length ? (
      <div className="space-y-2.5">
        <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-2">
          <span>{title}</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800/90 text-slate-300 font-mono">{items.length}</span>
        </h3>
        {items.map((task) => <TaskRow key={task.id} task={task} />)}
      </div>
    ) : null;

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="flex-1 h-screen overflow-y-auto bg-[#0A0C14] text-slate-100 relative selection:bg-cyan-500/30 selection:text-white overflow-x-hidden font-sans flex flex-col custom-scrollbar p-6 md:p-10 gap-6">
      {/* Ambient Lighting Orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[140px]" />
        <div className="absolute top-1/2 -right-40 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[140px]" />
        <div className="absolute -bottom-40 left-1/3 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[140px]" />
      </div>

      <header className="flex items-start gap-4">
        {onNavigateBack && (
          <button
            onClick={onNavigateBack}
            className="p-2.5 mt-1 text-slate-400 hover:text-white bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800 rounded-xl active:scale-95 transition-all flex items-center gap-1.5 shrink-0 shadow-md"
            title={t('Back to Assistant', 'العودة للمساعد')}
          >
            <ArrowLeft className="w-5 h-5 rtl:rotate-180" />
            <span className="text-xs font-bold hidden sm:inline">{t('Back', 'رجوع')}</span>
          </button>
        )}
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="p-2.5 mt-1 text-slate-400 hover:text-white bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800 rounded-xl active:scale-95 transition-all shrink-0 shadow-md"
            aria-label={t('Toggle menu', 'القائمة')}
            title={t('Open Menu', 'فتح القائمة')}
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <div>
          <h1 className="text-2xl md:text-4xl font-black text-white tracking-tight uppercase flex items-center gap-3">
            <span className="p-2 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <CalendarDays className="w-7 h-7" />
            </span>
            {t('Academic Planner & OS', 'المخطّط ومنظومة التعلّم الأكاديمية')}
          </h1>
          <p className="text-xs md:text-sm text-slate-400 font-medium italic mt-1.5">
            {t('Smart schedules, AI mock exams, lecture capsules, Feynman voice coach & citations.', 'جداول ذكية، محاكي امتحانات، كبسولة المحاضرات، رفيق المذاكرة الصوتي وتوثيق المراجع.')}
          </p>
        </div>
      </header>

      {/* Next-Gen Academic Tabs Bar */}
      <div className="flex flex-wrap gap-2 p-1.5 rounded-2xl bg-[#121524]/90 border border-slate-800/80 backdrop-blur-xl max-w-5xl w-full shadow-lg">
        {ACADEMIC_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
              <span>{isAr ? tab.ar : tab.en}</span>
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT: TASKS & DEADLINES */}
      {activeTab === 'tasks' && (
        <>
          {/* Add task */}
          <div className="bg-[#121524]/90 border border-slate-800/80 rounded-3xl p-6 md:p-7 backdrop-blur-xl shadow-2xl max-w-4xl w-full">
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-300 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              {t('Add a task', 'إضافة مهمة')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('Title (e.g. ML Assignment 2)', 'العنوان (مثلاً تكليف ML 2)')}
                onKeyDown={(e) => e.key === 'Enter' && addTask()}
                className="bg-[#0A0C14] border border-slate-800 text-white placeholder-slate-500 text-xs font-semibold rounded-2xl px-4 py-3 outline-none focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/10 transition-all"
              />
              <input
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                placeholder={t('Course (optional)', 'المادة (اختياري)')}
                className="bg-[#0A0C14] border border-slate-800 text-white placeholder-slate-500 text-xs font-semibold rounded-2xl px-4 py-3 outline-none focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/10 transition-all"
              />
              <select
                value={type}
                onChange={(e) => setType(e.target.value as PlannerTaskType)}
                className="bg-[#0A0C14] border border-slate-800 text-white text-xs font-semibold rounded-2xl px-4 py-3 outline-none focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/10 transition-all cursor-pointer"
              >
                {(Object.keys(TYPE_META) as PlannerTaskType[]).map((k) => (
                  <option key={k} value={k} className="bg-slate-900 text-white">
                    {t(TYPE_META[k].en, TYPE_META[k].ar)}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="bg-[#0A0C14] border border-slate-800 text-white text-xs font-semibold rounded-2xl px-4 py-3 outline-none focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/10 transition-all [color-scheme:dark]"
              />
            </div>
            <button
              onClick={addTask}
              disabled={!title.trim() || !dueDate}
              className="mt-4 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/20 active:scale-95 disabled:opacity-40 transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> {t('Add task', 'إضافة')}
            </button>
          </div>

          {/* Lists */}
          <div className="max-w-4xl w-full space-y-6 pb-12">
            {tasks.length === 0 && (
              <div className="text-center text-slate-500 py-16 flex flex-col items-center gap-3 bg-[#121524]/40 border border-slate-800/40 rounded-3xl">
                <CalendarDays className="w-12 h-12 text-slate-600" />
                <p className="font-medium text-sm text-slate-400">{t('No tasks yet — add your first deadline above.', 'لسه مفيش مهام — ضيف أول موعد من فوق.')}</p>
              </div>
            )}
            <Section title={t('Overdue', 'متأخرة')} items={overdue} />
            <Section title={t('Upcoming', 'قادمة')} items={upcoming} />
            <Section title={t('Completed', 'مكتملة')} items={done} />
          </div>
        </>
      )}

      {/* TAB CONTENT: DYNAMIC STUDY SCHEDULE & AUTO-REBALANCE */}
      {activeTab === 'schedule' && (
        <div className="max-w-5xl w-full">
          <DynamicScheduleView profile={profile} isAr={isAr} />
        </div>
      )}

      {/* TAB CONTENT: AI MOCK EXAM & ESSAY GRADER */}
      {activeTab === 'mock-exam' && (
        <div className="max-w-5xl w-full">
          <MockExamSimulator profile={profile} isAr={isAr} />
        </div>
      )}

      {/* TAB CONTENT: LECTURE & SLIDE DIGESTER */}
      {activeTab === 'digester' && (
        <div className="max-w-5xl w-full">
          <LectureDigester 
            profile={profile} 
            isAr={isAr} 
            onSendToExam={() => setActiveTab('mock-exam')} 
          />
        </div>
      )}

      {/* TAB CONTENT: SOCRATIC VOICE BUDDY (FEYNMAN) */}
      {activeTab === 'socratic' && (
        <div className="max-w-5xl w-full">
          <SocraticStudyBuddy profile={profile} isAr={isAr} />
        </div>
      )}

      {/* TAB CONTENT: RESEARCH & CITATION COPILOT */}
      {activeTab === 'research' && (
        <div className="max-w-5xl w-full">
          <ResearchCitationCopilot profile={profile} isAr={isAr} />
        </div>
      )}
    </div>
  );
}
