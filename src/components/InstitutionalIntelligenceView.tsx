import React, { useState, useMemo } from 'react';
import {
  Building2,
  ShieldCheck,
  AlertTriangle,
  FileCheck,
  TrendingUp,
  Download,
  Lock,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  Layers,
  Sparkles,
  Users,
} from 'lucide-react';
import type { StudentState } from '../types/studentState';
import type { InstitutionalDashboardData } from '../types/institution';
import { compileInstitutionalDashboard } from '../lib/institutionalIntelligence';

interface InstitutionalIntelligenceViewProps {
  institutionId?: string;
  institutionName?: string;
  studentCohortsByDept?: Record<string, StudentState[]>;
  lang?: 'en' | 'ar' | 'fr';
  onBack?: () => void;
}

export const InstitutionalIntelligenceView: React.FC<InstitutionalIntelligenceViewProps> = ({
  institutionId = 'uni_fci_01',
  institutionName = 'Faculty of Computer & Information Sciences',
  studentCohortsByDept,
  lang = 'ar',
  onBack,
}) => {
  const isAr = lang === 'ar';
  const [activeTab, setActiveTab] = useState<'departments' | 'bottlenecks' | 'radar' | 'accreditation'>('departments');

  // Provide realistic demo institutional cohort if not passed
  const cohorts: Record<string, StudentState[]> = useMemo(() => {
    if (studentCohortsByDept && Object.keys(studentCohortsByDept).length > 0) {
      return studentCohortsByDept;
    }

    // Default mock institutional cohorts
    const csStudents: StudentState[] = [];
    const isStudents: StudentState[] = [];

    // 3 critical students (triggers k-anonymity suppression)
    for (let i = 1; i <= 3; i++) {
      csStudents.push({
        uid: `cs_crit_${i}`,
        cognitiveStage: 'foundational',
        activePedagogy: 'worked_example',
        conceptMastery: {
          pointers: {
            conceptId: 'pointers',
            accuracy: 0.35,
            attempts: 9,
            correct: 3,
            confidence: 0.3,
            consecutiveCorrect: 0,
            consecutiveIncorrect: 3,
            lastTested: Date.now(),
            mistakeTypes: ['memory_leak'],
          },
          dynamic_memory: {
            conceptId: 'dynamic_memory',
            accuracy: 0.28,
            attempts: 7,
            correct: 2,
            confidence: 0.25,
            consecutiveCorrect: 0,
            consecutiveIncorrect: 3,
            lastTested: Date.now(),
            mistakeTypes: [],
          },
        },
        learningStrain: {
          possibleStruggle: 0.80,
          confidence: 0.85,
          signals: ['repeated_errors', 'high_response_latency'],
        },
        struggleSignal: 0.80,
        cognitiveLoadScore: 0.80,
        pedagogyEffectiveness: {
          worked_example: { score: 0.8, helpfulCount: 4, unhelpfulCount: 1 },
          socratic: { score: 0.2, helpfulCount: 1, unhelpfulCount: 4 },
          scaffolded: { score: 0.6, helpfulCount: 3, unhelpfulCount: 2 },
          analogies: { score: 0.5, helpfulCount: 2, unhelpfulCount: 2 },
          advanced_rigor: { score: 0.1, helpfulCount: 0, unhelpfulCount: 2 },
        },
        retentionSchedules: {},
        activeInterventions: {},
        totalExercisesCompleted: 10,
        lastActiveTimestamp: Date.now(),
      });
    }

    // 15 CS students (high / moderate / advanced)
    for (let i = 4; i <= 18; i++) {
      csStudents.push({
        uid: `cs_std_${i}`,
        cognitiveStage: i > 12 ? 'advanced' : 'developing',
        activePedagogy: i > 12 ? 'socratic' : 'scaffolded',
        conceptMastery: {
          pointers: {
            conceptId: 'pointers',
            accuracy: i > 12 ? 0.92 : 0.65,
            attempts: 7,
            correct: i > 12 ? 6 : 4,
            confidence: i > 12 ? 0.9 : 0.65,
            consecutiveCorrect: i > 12 ? 4 : 1,
            consecutiveIncorrect: i > 12 ? 0 : 1,
            lastTested: Date.now(),
            mistakeTypes: [],
          },
          dynamic_memory: {
            conceptId: 'dynamic_memory',
            accuracy: i > 12 ? 0.88 : 0.62,
            attempts: 6,
            correct: i > 12 ? 5 : 3,
            confidence: i > 12 ? 0.85 : 0.6,
            consecutiveCorrect: i > 12 ? 3 : 1,
            consecutiveIncorrect: i > 12 ? 0 : 1,
            lastTested: Date.now(),
            mistakeTypes: [],
          },
        },
        learningStrain: {
          possibleStruggle: i > 12 ? 0.18 : 0.45,
          confidence: 0.7,
          signals: [],
        },
        struggleSignal: i > 12 ? 0.18 : 0.45,
        cognitiveLoadScore: i > 12 ? 0.18 : 0.45,
        pedagogyEffectiveness: {
          worked_example: { score: 0.7, helpfulCount: 3, unhelpfulCount: 1 },
          socratic: { score: i > 12 ? 0.92 : 0.5, helpfulCount: i > 12 ? 6 : 2, unhelpfulCount: 1 },
          scaffolded: { score: 0.75, helpfulCount: 4, unhelpfulCount: 1 },
          analogies: { score: 0.65, helpfulCount: 2, unhelpfulCount: 1 },
          advanced_rigor: { score: i > 12 ? 0.88 : 0.4, helpfulCount: i > 12 ? 4 : 1, unhelpfulCount: 1 },
        },
        retentionSchedules: {},
        activeInterventions: {},
        totalExercisesCompleted: 22,
        lastActiveTimestamp: Date.now(),
      });
    }

    // 14 IS students
    for (let i = 1; i <= 14; i++) {
      isStudents.push({
        uid: `is_std_${i}`,
        cognitiveStage: 'developing',
        activePedagogy: 'scaffolded',
        conceptMastery: {
          databases: {
            conceptId: 'databases',
            accuracy: 0.85,
            attempts: 6,
            correct: 5,
            confidence: 0.85,
            consecutiveCorrect: 3,
            consecutiveIncorrect: 0,
            lastTested: Date.now(),
            mistakeTypes: [],
          },
        },
        learningStrain: {
          possibleStruggle: 0.25,
          confidence: 0.7,
          signals: [],
        },
        struggleSignal: 0.25,
        cognitiveLoadScore: 0.25,
        pedagogyEffectiveness: {
          worked_example: { score: 0.75, helpfulCount: 4, unhelpfulCount: 1 },
          socratic: { score: 0.65, helpfulCount: 3, unhelpfulCount: 2 },
          scaffolded: { score: 0.80, helpfulCount: 5, unhelpfulCount: 1 },
          analogies: { score: 0.70, helpfulCount: 3, unhelpfulCount: 1 },
          advanced_rigor: { score: 0.50, helpfulCount: 2, unhelpfulCount: 1 },
        },
        retentionSchedules: {},
        activeInterventions: {},
        totalExercisesCompleted: 20,
        lastActiveTimestamp: Date.now(),
      });
    }

    return { cs: csStudents, is: isStudents };
  }, [studentCohortsByDept]);

  const dashboardData: InstitutionalDashboardData = useMemo(() => {
    return compileInstitutionalDashboard(institutionId, institutionName, cohorts);
  }, [institutionId, institutionName, cohorts]);

  const isBenchmarkDataset = !studentCohortsByDept || Object.keys(studentCohortsByDept).length === 0;

  return (
    <div className="min-h-screen bg-[#0A0C14] text-slate-100 p-4 sm:p-8" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Ambient Glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-1/4 -right-20 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 -left-20 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto space-y-6">
        {/* Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#121524]/90 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-xl shadow-2xl">
          <div className="flex items-center gap-4">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2.5 rounded-2xl bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 transition"
                aria-label="Back"
              >
                <ArrowRight className={`w-5 h-5 ${isAr ? '' : 'rotate-180'}`} />
              </button>
            )}
            <div className="p-3.5 rounded-2xl bg-gradient-to-tr from-cyan-600 to-indigo-600 text-white shadow-lg shadow-cyan-500/20">
              <Building2 className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {institutionId}
                </span>
                <span className="text-xs font-medium text-slate-400">
                  {isAr ? 'مركز ذكاء الكلية والجامعة' : 'Institutional Intelligence'}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mt-1">
                {institutionName}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {isBenchmarkDataset ? (
              <span className="text-[11px] font-bold px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                {isAr ? 'عينة معيارية [Benchmark Baseline Dataset]' : '[Benchmark Baseline Dataset]'}
              </span>
            ) : (
              <span className="text-[11px] font-bold px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                {isAr ? 'بيانات حية متصلة [Live Connected Data]' : '[Live Connected Data]'}
              </span>
            )}
            <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-900/80 border border-slate-800">
              <Users className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-semibold text-white">
                {dashboardData.departments.reduce((acc, d) => acc + d.enrolledStudentsCount, 0)}
              </span>
              <span className="text-xs text-slate-400">{isAr ? 'طالباً مسجلاً' : 'Students'}</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-900/80 border border-slate-800">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-semibold text-emerald-300">k ≥ 5</span>
              <span className="text-xs text-slate-400">{isAr ? 'حماية الهوية' : 'Anonymized'}</span>
            </div>
          </div>
        </div>

        {/* k-Anonymity Audit Alert Banner */}
        <div className="bg-indigo-950/30 border border-indigo-500/30 rounded-3xl p-4 sm:p-5 flex items-start sm:items-center gap-3.5 backdrop-blur-md">
          <div className="p-2.5 rounded-2xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                {isAr ? 'درع عدم كشف الهوية (k-Anonymity Protection): مفعل' : 'Strict k-Anonymity (k >= 5) Protection Active'}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300">
                FERPA & GDPR Compliant
              </span>
            </div>
            <p className="text-xs sm:text-sm text-indigo-200/90 leading-relaxed">
              {isAr
                ? dashboardData.kAnonymityAudit.privacyPolicyNoticeAr
                : dashboardData.kAnonymityAudit.privacyPolicyNoticeEn}
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-[#121524] border border-slate-800/80 w-full sm:w-fit overflow-x-auto">
          <button
            onClick={() => setActiveTab('departments')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition ${
              activeTab === 'departments'
                ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>{isAr ? 'أقسام الكلية' : 'Departments'}</span>
            <span className="ml-1 text-xs px-1.5 py-0.5 rounded-md bg-white/20">
              {dashboardData.departments.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('bottlenecks')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition ${
              activeTab === 'bottlenecks'
                ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>{isAr ? 'سلاسل التعثر الأكاديمي' : 'Curricular Bottlenecks'}</span>
            <span className="ml-1 text-xs px-1.5 py-0.5 rounded-md bg-white/20">
              {dashboardData.bottlenecks.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('radar')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition ${
              activeTab === 'radar'
                ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>{isAr ? 'رادار الإنذار المبكر' : 'Early Warning Radar'}</span>
          </button>

          <button
            onClick={() => setActiveTab('accreditation')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition ${
              activeTab === 'accreditation'
                ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <FileCheck className="w-4 h-4" />
            <span>{isAr ? 'تقرير الاعتماد الأكاديمي (ABET)' : 'Accreditation (ABET)'}</span>
          </button>
        </div>

        {/* Tab 1: Departments */}
        {activeTab === 'departments' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {dashboardData.departments.map((dept) => (
              <div
                key={dept.departmentId}
                className="bg-[#121524]/90 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-xl shadow-xl space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs uppercase tracking-wider text-cyan-400 font-semibold">
                      {dept.departmentId.toUpperCase()}
                    </span>
                    <h3 className="text-xl font-bold text-white mt-1">
                      {isAr ? dept.departmentNameAr : dept.departmentNameEn}
                    </h3>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-xl bg-slate-800 text-slate-300">
                    {dept.enrolledStudentsCount} {isAr ? 'طالب' : 'Students'}
                  </span>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>{isAr ? 'متوسط الإتقان المفاهيمي' : 'Average Mastery'}</span>
                      <span className="font-bold text-emerald-400">{Math.round(dept.averageMasteryRate * 100)}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${Math.round(dept.averageMasteryRate * 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>{isAr ? 'معدل الإجهاد الذهني' : 'Learning Strain'}</span>
                      <span className="font-bold text-amber-400">{Math.round(dept.averageStrainRate * 100)}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full"
                        style={{ width: `${Math.round(dept.averageStrainRate * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <span>{isAr ? 'نسبة الاستبقاء والنجاح' : 'Retention Rate'}:</span>
                  <span className="font-bold text-white">{Math.round(dept.retentionRate * 100)}%</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab 2: Curricular Bottlenecks */}
        {activeTab === 'bottlenecks' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              <p className="text-sm text-amber-200">
                {isAr
                  ? 'رصد المفاهيم التأسيسية الحرجة التي تتسبب في تعثر متسلسل يمتد إلى المقررات اللاحقة في الخطة الدراسية.'
                  : 'Detecting critical foundational concepts that trigger downstream failure cascades across subsequent curriculum courses.'}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {dashboardData.bottlenecks.map((b) => {
                const isCritical = b.failureCascadeRisk === 'critical';

                return (
                  <div
                    key={b.conceptId}
                    className="bg-[#121524]/90 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-xl shadow-xl space-y-4 flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                            {b.courseId} • {b.conceptId}
                          </span>
                          <h3 className="text-xl font-bold text-white mt-1">
                            {isAr ? b.conceptNameAr : b.conceptNameEn}
                          </h3>
                        </div>
                        <span
                          className={`text-xs font-bold px-2.5 py-1 rounded-xl ${
                            isCritical
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {b.failureCascadeRisk.toUpperCase()} CASCADE RISK
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-slate-400">
                          <span>{isAr ? 'النسبة المتأثرة من الدفعة' : 'Cohort Struggle Rate'}</span>
                          <span className="font-bold text-rose-400">{b.affectedStudentPercentage}%</span>
                        </div>
                        <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${isCritical ? 'bg-rose-500' : 'bg-amber-500'}`}
                            style={{ width: `${b.affectedStudentPercentage}%` }}
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5 pt-2">
                        <span className="text-xs font-semibold text-slate-400">
                          {isAr ? 'المقررات اللاحقة المهددة بالتعثر:' : 'Downstream Impact Courses at Risk:'}
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {b.downstreamImpactCourses.map((crs) => (
                            <span
                              key={crs}
                              className="text-xs px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/60 text-slate-300"
                            >
                              {crs}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 3: Early Warning Radar */}
        {activeTab === 'radar' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {dashboardData.earlyWarningRadar.map((item) => {
                const isCritical = item.riskLevel === 'critical';
                const isHigh = item.riskLevel === 'high';

                return (
                  <div
                    key={item.riskCohortId}
                    className="bg-[#121524]/90 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-xl shadow-xl space-y-4 flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-xs font-bold px-2.5 py-1 rounded-xl ${
                            isCritical
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : isHigh
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                          }`}
                        >
                          {item.riskLevel.toUpperCase()}
                        </span>
                        {item.isSuppressed && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5" /> k &lt; 5
                          </span>
                        )}
                      </div>

                      <div className="text-2xl font-black text-white">
                        {item.studentCountDisplay}
                      </div>

                      <div className="space-y-1 text-xs text-slate-400">
                        <span className="font-semibold text-slate-300">
                          {isAr ? 'الإجراء المؤسسي الموصى به:' : 'Recommended Action:'}
                        </span>
                        <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                          {isAr ? item.recommendedInstitutionalActionAr : item.recommendedInstitutionalActionEn}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 4: Accreditation Report */}
        {activeTab === 'accreditation' && (
          <div className="space-y-6">
            <div className="bg-[#121524]/90 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-xl shadow-xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {dashboardData.accreditation.accreditationStandard}
                    </span>
                    <span className="text-xs text-slate-400">
                      {dashboardData.accreditation.evaluationPeriod}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-white mt-1">
                    {isAr ? 'تحقق مخرجات التعلم الأكاديمية (Student Outcomes)' : 'Student Outcomes Attainment'}
                  </h3>
                </div>

                <button
                  onClick={() => alert(isAr ? 'جاري تصدير التقرير الأكاديمي...' : 'Exporting Accreditation PDF...')}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 text-white text-sm font-semibold hover:opacity-90 transition w-fit"
                >
                  <Download className="w-4 h-4" />
                  <span>{isAr ? 'تصدير التقرير الأكاديمي' : 'Export ABET Dossier'}</span>
                </button>
              </div>

              {/* Outcomes List */}
              <div className="space-y-3">
                {dashboardData.accreditation.outcomesAttainment.map((so) => (
                  <div
                    key={so.outcomeId}
                    className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-cyan-400">{so.outcomeId}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            so.status === 'exceeds_standard'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : so.status === 'meets_standard'
                              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {so.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-300">
                        {isAr ? so.descriptionAr : so.descriptionEn}
                      </p>
                    </div>

                    <div className="flex items-center gap-4 shrink-0 text-xs">
                      <div className="text-right">
                        <span className="text-slate-400">{isAr ? 'المستهدف' : 'Target'}: </span>
                        <span className="font-semibold text-white">{so.targetBenchmark}%</span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-400">{isAr ? 'المتحقق' : 'Attained'}: </span>
                        <span className="font-bold text-emerald-400 text-sm">{so.actualAttainment}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Closing The Loop Banner */}
              <div className="p-5 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 space-y-3">
                <div className="flex items-center gap-2 text-indigo-300 font-bold text-sm">
                  <Sparkles className="w-4 h-4" />
                  <span>{isAr ? 'حلقة التحسين المستمر (Closing the Loop)' : 'Continuous Improvement Cycle'}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-300">
                  <div className="space-y-1">
                    <span className="font-bold text-amber-300">{isAr ? 'الفجوة المرصودة:' : 'Identified Gap:'}</span>
                    <p>{isAr ? dashboardData.accreditation.continuousImprovementLoop.identifiedGapAr : dashboardData.accreditation.continuousImprovementLoop.identifiedGapEn}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="font-bold text-cyan-300">{isAr ? 'التدخل التربوي المطبق:' : 'Implemented Change:'}</span>
                    <p>{isAr ? dashboardData.accreditation.continuousImprovementLoop.implementedPedagogicalChangeAr : dashboardData.accreditation.continuousImprovementLoop.implementedPedagogicalChangeEn}</p>
                  </div>
                </div>
                <div className="pt-2 border-t border-indigo-500/20 flex items-center justify-between text-xs">
                  <span className="text-indigo-300 font-semibold">{isAr ? 'الأثر الإيجابي المقاس:' : 'Measured Impact Gain:'}</span>
                  <span className="font-extrabold text-emerald-400">
                    +{dashboardData.accreditation.continuousImprovementLoop.measuredImpactGainPercentage}% {isAr ? 'تحسن في الإتقان' : 'gain'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InstitutionalIntelligenceView;
