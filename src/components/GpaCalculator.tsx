import { localize, isArabicLocale } from '../lib/translations';
import { useEffect, useMemo, useState } from 'react';
import { UserProfile, Course } from '../types';
import { 
  Menu, Plus, Trash2, Calculator, Sparkles, GraduationCap, ArrowLeft,
  Target, AlertTriangle, CheckCircle2, ShieldAlert
} from 'lucide-react';
import { toast } from './Toast';
import {
  GRADE_OPTIONS, GRADE_POINTS, calculateGPA, calculateCGPA, semestersOf,
  totalCredits, projectCGPA, subscribeToCourses, saveCourse, deleteCourse,
  solveReverseGpaTarget, calculateGradeRescue, GRADE_THRESHOLDS
} from '../lib/gpa';

interface GpaCalculatorProps {
  profile: UserProfile;
  onMenuClick?: () => void;
  onNavigateBack?: () => void;
}

const gradeColor = (grade: string) => {
  const p = GRADE_POINTS[grade] ?? 0;
  if (p >= 3.7) return 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30';
  if (p >= 3.0) return 'text-cyan-400 bg-cyan-500/15 border-cyan-500/30';
  if (p >= 2.0) return 'text-amber-400 bg-amber-500/15 border-amber-500/30';
  return 'text-rose-400 bg-rose-500/15 border-rose-500/30';
};

export default function GpaCalculator({ profile, onMenuClick, onNavigateBack }: GpaCalculatorProps) {
  const isAr = isArabicLocale(profile.language);
  const [courses, setCourses] = useState<Course[]>([]);

  // Add-course form
  const [name, setName] = useState('');
  const [credits, setCredits] = useState('3');
  const [grade, setGrade] = useState('A');
  const [semester, setSemester] = useState(`Semester 1`);

  // What-if
  const [whatIfCourse, setWhatIfCourse] = useState<string>('');
  const [whatIfGrade, setWhatIfGrade] = useState('A');
  const [whatIfCredits, setWhatIfCredits] = useState('3');

  useEffect(() => {
    if (!profile?.uid) return;
    const unsub = subscribeToCourses(profile.uid, setCourses);
    return () => unsub();
  }, [profile?.uid]);

  const cgpa = useMemo(() => calculateCGPA(courses), [courses]);
  const semesters = useMemo(() => semestersOf(courses), [courses]);
  const creditsTotal = useMemo(() => totalCredits(courses), [courses]);

  const projected = useMemo(() => {
    if (!courses.length && whatIfCourse) return null;
    if (whatIfCourse) {
      return projectCGPA(courses, { courseId: whatIfCourse, grade: whatIfGrade, credits: 0 });
    }
    const numCredits = Number(whatIfCredits);
    const safeCredits = Number.isFinite(numCredits) && numCredits >= 0 ? numCredits : 3;
    return projectCGPA(courses, { courseId: null, grade: whatIfGrade, credits: safeCredits });
  }, [courses, whatIfCourse, whatIfGrade, whatIfCredits]);

  // Tab state
  const [calcTab, setCalcTab] = useState<'current' | 'reverse' | 'rescue'>('current');

  // Reverse GPA target solver state
  const [targetGpaInput, setTargetGpaInput] = useState('3.4');
  const [plannedCreditsInput, setPlannedCreditsInput] = useState('15');

  // Grade rescue state
  const [rescueCourseName, setRescueCourseName] = useState('');
  const [rescueWorkScore, setRescueWorkScore] = useState('35');
  const [rescueWorkMax, setRescueWorkMax] = useState('50');
  const [rescueFinalMax, setRescueFinalMax] = useState('50');
  const [rescueTargetLetter, setRescueTargetLetter] = useState('A');

  const reverseGpaPlan = useMemo(() => {
    const tGpa = Math.max(0, Math.min(4.0, Number(targetGpaInput) || 3.0));
    const pCredits = Math.max(1, Number(plannedCreditsInput) || 15);
    return solveReverseGpaTarget(cgpa, creditsTotal, tGpa, pCredits);
  }, [cgpa, creditsTotal, targetGpaInput, plannedCreditsInput]);

  const gradeRescueResult = useMemo(() => {
    const wScore = Math.max(0, Number(rescueWorkScore) || 0);
    const wMax = Math.max(1, Number(rescueWorkMax) || 50);
    const fMax = Math.max(1, Number(rescueFinalMax) || 50);
    return calculateGradeRescue(
      rescueCourseName || (isAr ? 'مادة الفحص' : 'Current Course'),
      wScore,
      wMax,
      fMax,
      rescueTargetLetter
    );
  }, [rescueCourseName, rescueWorkScore, rescueWorkMax, rescueFinalMax, rescueTargetLetter, isAr]);

  const t = (en: string, ar: string) => localize(profile?.language, en, ar);

  const addCourse = async () => {
    if (!name.trim() || !profile?.uid) return;
    const course: Course = {
      id: `c-${Date.now()}`,
      name: name.trim(),
      credits: Math.max(0, Number(credits) || 0),
      grade,
      semester: semester.trim() || 'Semester 1',
      createdAt: new Date().toISOString(),
    };
    try {
      await saveCourse(profile.uid, course);
      setName('');
      toast.success(t('Course added.', 'تمت إضافة المادة.'), t('Saved', 'تم الحفظ'));
    } catch (err) {
      console.error('Failed to add course:', err);
      toast.error(t('Failed to add course.', 'فشل إضافة المادة.'), t('Error', 'خطأ'));
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    if (!profile?.uid) return;
    try {
      await deleteCourse(profile.uid, courseId);
      toast.success(t('Course removed.', 'تم حذف المادة.'), t('Deleted', 'تم الحذف'));
    } catch (err) {
      console.error('Failed to delete course:', err);
      toast.error(t('Failed to delete course.', 'فشل حذف المادة.'), t('Error', 'خطأ'));
    }
  };

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
              <Calculator className="w-7 h-7" />
            </span>
            {t('GPA Calculator', 'حاسبة الـ GPA')}
          </h1>
          <p className="text-xs md:text-sm text-slate-400 font-medium italic mt-1.5">
            {t('Track your grades, CGPA, and run what-if scenarios.', 'تابع درجاتك والـ CGPA وجرّب سيناريوهات "لو".')}
          </p>
        </div>
      </header>

      {/* GPA Navigation Tabs */}
      <div className="flex flex-wrap gap-2 p-1.5 rounded-2xl bg-[#121524]/90 border border-slate-800/80 backdrop-blur-xl max-w-2xl w-full shadow-lg">
        <button
          type="button"
          onClick={() => setCalcTab('current')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
            calcTab === 'current'
              ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          {isAr ? 'حاسبة الـ GPA وسيناريوهات لو' : 'CGPA & What-if'}
        </button>

        <button
          type="button"
          onClick={() => setCalcTab('reverse')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
            calcTab === 'reverse'
              ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          {isAr ? 'حاسبة الهدف العكسية' : 'Reverse Target Solver'}
        </button>

        <button
          type="button"
          onClick={() => setCalcTab('rescue')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
            calcTab === 'rescue'
              ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          {isAr ? 'رادار إنقاذ المواد وخطر الفاينال' : 'Grade Rescue Radar'}
        </button>
      </div>

      {/* TAB 1: CURRENT CGPA & WHAT-IF */}
      {calcTab === 'current' && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl w-full">
            {/* CGPA summary */}
            <div className="bg-[#121524]/90 border border-slate-800/80 text-white rounded-3xl p-6 flex flex-col justify-center items-center shadow-2xl backdrop-blur-xl relative overflow-hidden group">
              <div className="absolute -top-16 -right-16 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl group-hover:scale-150 transition-transform" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{t('Cumulative GPA', 'المعدل التراكمي')}</span>
              <span className="text-6xl font-black mt-3 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 drop-shadow-sm font-mono">{cgpa.toFixed(2)}</span>
              <span className="text-xs text-slate-400 mt-2 font-medium">{creditsTotal} {t('credit hours', 'ساعة معتمدة')} · {courses.length} {t('courses', 'مادة')}</span>
            </div>

            {/* What-if */}
            <div className="lg:col-span-2 bg-[#121524]/90 rounded-3xl p-6 border border-slate-800/80 shadow-2xl backdrop-blur-xl">
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-300 flex items-center gap-2 mb-4">
                <Sparkles className="w-4 h-4 text-cyan-400" /> {t('What-if Analysis', 'تحليل "ماذا لو"')}
              </h2>
              <div className="flex flex-wrap items-end gap-3.5">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold uppercase text-slate-400">{t('Course', 'المادة')}</span>
                  <select
                    value={whatIfCourse}
                    onChange={(e) => setWhatIfCourse(e.target.value)}
                    className="bg-[#0A0C14] border border-slate-800 text-white text-xs font-semibold rounded-2xl px-4 py-3 outline-none focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/10 transition-all cursor-pointer"
                  >
                    <option value="" className="bg-slate-900 text-white">{t('New hypothetical course', 'مادة افتراضية جديدة')}</option>
                    {courses.map((c) => <option key={c.id} value={c.id} className="bg-slate-900 text-white">{c.name}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold uppercase text-slate-400">{t('Grade', 'الدرجة')}</span>
                  <select
                    dir="ltr"
                    value={whatIfGrade}
                    onChange={(e) => setWhatIfGrade(e.target.value)}
                    className="bg-[#0A0C14] border border-slate-800 text-white text-xs font-semibold rounded-2xl px-4 py-3 outline-none focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/10 transition-all cursor-pointer font-mono"
                  >
                    {GRADE_OPTIONS.map((g) => <option key={g} value={g} className="bg-slate-900 text-white">{g}</option>)}
                  </select>
                </label>
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold uppercase text-slate-400">{t('Projected CGPA', 'المعدل المتوقّع')}</span>
                  <div className="px-5 py-2.5 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 font-black text-lg min-w-[90px] text-center font-mono shadow-sm">
                    {projected !== null ? projected.toFixed(2) : '—'}
                  </div>
                </div>
                {projected !== null && (
                  <span className={`text-xs font-black px-3 py-1.5 rounded-xl border ${projected >= cgpa ? 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30' : 'text-rose-400 bg-rose-500/15 border-rose-500/30'}`}>
                    {projected >= cgpa ? '▲' : '▼'} {Math.abs(projected - cgpa).toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Add course */}
          <div className="bg-[#121524]/90 rounded-3xl p-6 border border-slate-800/80 shadow-2xl backdrop-blur-xl max-w-6xl w-full">
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-300 mb-4 flex items-center gap-2">
              <Plus className="w-4 h-4 text-cyan-400" /> {t('Add Completed / Current Course', 'إضافة مادة منجزة أو مسجلة')}
            </h2>
            <div className="flex flex-wrap gap-3.5 items-center">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('Course name (e.g. CS101)', 'اسم المادة (مثلاً خوارزميات)')}
                className="flex-1 min-w-[180px] bg-[#0A0C14] border border-slate-800 text-white placeholder-slate-500 text-xs font-semibold rounded-2xl px-4 py-3 outline-none focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/10 transition-all"
              />
              <input
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                placeholder={t('Semester', 'الترم')}
                className="w-36 bg-[#0A0C14] border border-slate-800 text-white placeholder-slate-500 text-xs font-semibold rounded-2xl px-4 py-3 outline-none focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/10 transition-all"
              />
              <input
                type="number"
                min={0}
                max={12}
                value={credits}
                onChange={(e) => setCredits(e.target.value)}
                className="w-24 bg-[#0A0C14] border border-slate-800 text-white text-xs font-semibold rounded-2xl px-4 py-3 outline-none focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/10 transition-all font-mono"
                title={t('Credits', 'الساعات')}
              />
              <select
                dir="ltr"
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="w-24 bg-[#0A0C14] border border-slate-800 text-white text-xs font-semibold rounded-2xl px-4 py-3 outline-none focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/10 transition-all cursor-pointer font-mono"
              >
                {GRADE_OPTIONS.map((g) => <option key={g} value={g} className="bg-slate-900 text-white">{g}</option>)}
              </select>
              <button
                onClick={addCourse}
                disabled={!name.trim()}
                className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/20 active:scale-95 disabled:opacity-40 transition-all flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> {t('Add', 'إضافة')}
              </button>
            </div>
          </div>

          {/* Courses by semester */}
          <div className="max-w-6xl w-full space-y-6 pb-12">
            {courses.length === 0 && (
              <div className="text-center text-slate-500 py-16 flex flex-col items-center gap-3 bg-[#121524]/40 border border-slate-800/40 rounded-3xl">
                <GraduationCap className="w-12 h-12 text-slate-600" />
                <p className="font-medium text-sm text-slate-400">{t('No courses yet — add your first course above.', 'لسه مفيش مواد — ضيف أول مادة من فوق.')}</p>
              </div>
            )}
            {semesters.map((sem) => {
              const semCourses = courses.filter((c) => (c.semester || 'Unspecified') === sem);
              return (
                <div key={sem} className="bg-[#121524]/90 rounded-3xl border border-slate-800/80 shadow-xl overflow-hidden backdrop-blur-xl">
                  <div className="flex items-center justify-between px-6 py-4 bg-slate-900/90 border-b border-slate-800">
                    <h3 className="font-black text-white text-xs uppercase tracking-widest">{sem}</h3>
                    <span className="text-xs font-bold text-slate-400">GPA: <span className="text-cyan-400 font-mono font-black">{calculateGPA(semCourses).toFixed(2)}</span></span>
                  </div>
                  <div className="divide-y divide-slate-800/60">
                    {semCourses.map((c) => (
                      <div key={c.id} className="flex items-center gap-3 px-6 py-3.5 hover:bg-slate-900/40 transition-colors">
                        <span className="flex-1 font-bold text-slate-100 text-sm">{c.name}</span>
                        <span className="text-xs text-slate-400 font-mono">{c.credits} {t('cr', 'س')}</span>
                        <span dir="ltr" className={`text-xs font-black px-2.5 py-1 rounded-lg border font-mono ${gradeColor(c.grade)}`}>{c.grade}</span>
                        <button
                          onClick={() => handleDeleteCourse(c.id)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors"
                          title={t('Delete', 'حذف')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* TAB 2: REVERSE GPA TARGET SOLVER */}
      {calcTab === 'reverse' && (
        <div className="bg-[#121524]/90 border border-slate-800 rounded-3xl p-6 md:p-8 backdrop-blur-xl shadow-2xl space-y-6 max-w-5xl w-full">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Target className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">
                {isAr ? 'حاسبة الهدف العكسية (Reverse GPA Solver)' : 'Reverse GPA Target Solver'}
              </h2>
              <p className="text-xs text-slate-400">
                {isAr ? 'حدد المعدل التراكمي الذي تحلم به، وسيحسب لك النظام بالضبط التقديرات المطلوبة في كل مادة' : 'Calculate the exact semester GPA and grade mix required to hit your dream cumulative target'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-5 rounded-2xl bg-[#0A0C14] border border-slate-800">
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                {isAr ? 'المعدل الحالي (CGPA)' : 'Current CGPA'}
              </span>
              <div className="font-mono text-2xl font-black text-white">{cgpa.toFixed(2)}</div>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                {isAr ? 'الساعات المنجزة' : 'Completed Credits'}
              </span>
              <div className="font-mono text-2xl font-black text-slate-300">{creditsTotal} {isAr ? 'ساعة' : 'hrs'}</div>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-cyan-400 block mb-1">
                {isAr ? 'المعدل المستهدف *' : 'Target CGPA *'}
              </label>
              <input
                type="number"
                step="0.05"
                min="0"
                max="4.0"
                value={targetGpaInput}
                onChange={(e) => setTargetGpaInput(e.target.value)}
                className="w-full bg-[#121524] border border-cyan-500/40 rounded-xl px-3 py-1.5 text-sm font-mono text-cyan-300 font-bold focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                {isAr ? 'ساعات الفصل القادم' : 'Planned Credits'}
              </label>
              <input
                type="number"
                min="3"
                max="24"
                value={plannedCreditsInput}
                onChange={(e) => setPlannedCreditsInput(e.target.value)}
                className="w-full bg-[#121524] border border-slate-800 rounded-xl px-3 py-1.5 text-sm font-mono text-white font-bold focus:outline-none"
              />
            </div>
          </div>

          {/* Results Display */}
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-transparent border border-cyan-500/30">
              <div>
                <span className="text-xs text-slate-400 font-bold block">
                  {isAr ? 'المعدل الفصلي المطلوب تحقيقه هذا الفصل:' : 'Required Semester GPA Target:'}
                </span>
                <span className={`font-mono text-4xl font-black ${
                  reverseGpaPlan.isPossible ? 'text-cyan-300' : 'text-rose-400'
                }`}>
                  {reverseGpaPlan.neededSemesterGpa.toFixed(2)}
                  <span className="text-sm text-slate-500"> / 4.00</span>
                </span>
              </div>

              <div className="text-end">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black border ${
                  reverseGpaPlan.isPossible
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                }`}>
                  {reverseGpaPlan.isPossible ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  {reverseGpaPlan.isPossible 
                    ? (isAr ? 'هدف قابل للتحقيق بنجاح' : 'Target Achievable') 
                    : (isAr ? `يتجاوز الحد الأقصى (أقصى معدل: ${reverseGpaPlan.maxAchievableCgpa.toFixed(2)})` : `Exceeds max (${reverseGpaPlan.maxAchievableCgpa.toFixed(2)})`)}
                </span>
              </div>
            </div>

            {/* Recommended distribution */}
            {reverseGpaPlan.isPossible && reverseGpaPlan.recommendedGradeDistribution.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-black uppercase text-slate-400 block">
                  {isAr ? 'توليفة التقديرات الموصى بها في المواد:' : 'Recommended Course Grade Combination:'}
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {reverseGpaPlan.recommendedGradeDistribution.map((dist, idx) => (
                    <div key={idx} className="p-4 rounded-2xl bg-[#0A0C14] border border-slate-800 flex items-center justify-between gap-3">
                      <div>
                        <span className="text-sm font-black text-white block">{dist.description}</span>
                        <span className="text-[11px] text-slate-400">{dist.credits} {isAr ? 'ساعات معتمدة' : 'credit hours'}</span>
                      </div>
                      <span className="font-mono text-lg font-black text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-xl border border-emerald-500/20">
                        {dist.grade}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Strategic Advice */}
            <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-slate-200 leading-relaxed">
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400 block mb-1">
                {isAr ? 'النصيحة الأكاديمية الاستراتيجية:' : 'Strategic Academic Guidance:'}
              </span>
              {reverseGpaPlan.strategicAdvice}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: GRADE RESCUE RADAR */}
      {calcTab === 'rescue' && (
        <div className="bg-[#121524]/90 border border-slate-800 rounded-3xl p-6 md:p-8 backdrop-blur-xl shadow-2xl space-y-6 max-w-5xl w-full">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">
                {isAr ? 'رادار إنقاذ المواد وخطر الفاينال (Grade Rescue Radar)' : 'Grade Rescue Radar'}
              </h2>
              <p className="text-xs text-slate-400">
                {isAr ? 'احسب كم درجة تحتاج بالضبط في امتحان الفاينال لتأمين تقدير A أو B وتجنب الرسوب' : 'Calculate the minimum final exam score needed to secure your target grade or safe pass'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 p-5 rounded-2xl bg-[#0A0C14] border border-slate-800">
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                {isAr ? 'اسم المادة' : 'Course Name'}
              </label>
              <input
                type="text"
                value={rescueCourseName}
                onChange={(e) => setRescueCourseName(e.target.value)}
                placeholder={isAr ? 'مثال: فيزياء 2' : 'e.g. Physics II'}
                className="w-full bg-[#121524] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                {isAr ? 'درجة أعمال السنة المحصلة' : 'Work Score Earned'}
              </label>
              <input
                type="number"
                value={rescueWorkScore}
                onChange={(e) => setRescueWorkScore(e.target.value)}
                className="w-full bg-[#121524] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                {isAr ? 'أقصى درجة لأعمال السنة' : 'Max Work Score'}
              </label>
              <input
                type="number"
                value={rescueWorkMax}
                onChange={(e) => setRescueWorkMax(e.target.value)}
                className="w-full bg-[#121524] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                {isAr ? 'درجة الفاينال الكلية' : 'Final Exam Max'}
              </label>
              <input
                type="number"
                value={rescueFinalMax}
                onChange={(e) => setRescueFinalMax(e.target.value)}
                className="w-full bg-[#121524] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-rose-400 block mb-1">
                {isAr ? 'التقدير المطلوب' : 'Target Letter'}
              </label>
              <select
                value={rescueTargetLetter}
                onChange={(e) => setRescueTargetLetter(e.target.value)}
                className="w-full bg-[#121524] border border-rose-500/40 rounded-xl px-3 py-2 text-xs text-rose-300 font-bold focus:outline-none"
              >
                {['A+', 'A', 'B+', 'B', 'C+', 'C', 'D'].map((g) => (
                  <option key={g} value={g}>{g} ({GRADE_THRESHOLDS[g]}%)</option>
                ))}
              </select>
            </div>
          </div>

          {/* Rescue Calculation Result Card */}
          <div className={`p-6 rounded-3xl border transition-all ${
            gradeRescueResult.status === 'safe'
              ? 'bg-emerald-500/10 border-emerald-500/30'
              : gradeRescueResult.status === 'warning'
              ? 'bg-amber-500/10 border-amber-500/30'
              : 'bg-rose-500/10 border-rose-500/30'
          }`}>
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <span className={`text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-xl border ${
                  gradeRescueResult.status === 'safe'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : gradeRescueResult.status === 'warning'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                }`}>
                  {gradeRescueResult.status === 'safe' 
                    ? (isAr ? 'وضع آمن ومستقر' : 'Safe Trajectory') 
                    : gradeRescueResult.status === 'warning'
                    ? (isAr ? 'منطقة تحذير وانتباه' : 'Warning Zone')
                    : (isAr ? 'منطقة خطر شديد' : 'Critical Risk')}
                </span>

                <h3 className="text-xl font-black text-white pt-2">
                  {gradeRescueResult.courseName}
                </h3>
              </div>

              <div className="text-start md:text-end">
                <span className="text-xs text-slate-400 font-bold block">
                  {isAr ? 'الحد الأدنى المطلوب في امتحان الفاينال:' : 'Minimum Score Required in Final:'}
                </span>
                <span className={`font-mono text-3xl font-black ${
                  gradeRescueResult.isAchievable ? 'text-white' : 'text-rose-400'
                }`}>
                  {gradeRescueResult.isAchievable ? gradeRescueResult.minFinalScoreRequired : 'غير متاح'}
                  <span className="text-sm text-slate-500"> / {gradeRescueResult.finalExamMax}</span>
                </span>
                <div className="text-xs text-slate-400 mt-0.5">
                  {gradeRescueResult.isAchievable && (
                    <span>
                      ({Math.round((gradeRescueResult.minFinalScoreRequired / (gradeRescueResult.finalExamMax || 1)) * 100)}% {isAr ? 'من ورقة الفاينال' : 'of final paper'})
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-800/80 text-xs text-slate-300 leading-relaxed">
              {gradeRescueResult.isAchievable ? (
                <span>
                  {isAr 
                    ? `للحصول على تقدير (${gradeRescueResult.targetLetter}) تحتاج لتحصيل ${gradeRescueResult.minFinalScoreRequired} من أصل ${gradeRescueResult.finalExamMax} في الامتحان النهائي. نوصيك بحل امتحانات تجريبية عبر محاكي الامتحانات لتأمين هذه النسبة!`
                    : `To secure (${gradeRescueResult.targetLetter}), you need ${gradeRescueResult.minFinalScoreRequired} out of ${gradeRescueResult.finalExamMax} on your final exam. Practice with our Mock Exam Simulator to lock this in!`}
                </span>
              ) : (
                <span className="text-rose-300 font-bold">
                  {isAr 
                    ? `حتى لو حصلت على الدرجة النهائية في الفاينال (${gradeRescueResult.finalExamMax}/${gradeRescueResult.finalExamMax})، لن تتمكن من الوصول لتقدير (${gradeRescueResult.targetLetter}) بسبب نقص أعمال السنة. جرب خفض الهدف إلى التقدير التالي فوراً!`
                    : `Even with a perfect score on the final exam, (${gradeRescueResult.targetLetter}) is mathematically out of reach due to prior coursework marks. Adjust your target letter to preserve your GPA.`}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
