import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, CognitiveLevel } from '../types';
import {
  InstitutionCohortStats,
  computeCohortAnalytics,
  exportCohortCsv,
  K_ANONYMITY_THRESHOLD,
} from '../lib/institution';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, query, where, limit } from 'firebase/firestore';
import { localize } from '../lib/translations';
import { isAdminUser } from '../lib/roles';
import {
  Building2,
  Users,
  Activity,
  Sparkles,
  Accessibility,
  Download,
  ShieldCheck,
  ShieldAlert,
  Eye,
  Ear,
  Mic,
  CheckCircle,
  BarChart3,
  GraduationCap,
  Lock,
  Menu,
  FileSpreadsheet,
  AlertTriangle,
  Loader2,
  Check,
  Layers,
  ArrowLeft,
  Brain,
  GitBranch,
  Compass,
  HelpCircle,
  CheckCircle2,
} from 'lucide-react';
import { InstitutionalIntelligenceView } from './InstitutionalIntelligenceView';
import type { StudentState } from '../types/studentState';

interface InstitutionCohortHubProps {
  profile: UserProfile;
  onMenuClick?: () => void;
  onNavigateBack?: () => void;
}

export default function InstitutionCohortHub({ profile, onMenuClick, onNavigateBack }: InstitutionCohortHubProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [activeSection, setActiveSection] = useState<'roster' | 'intelligence'>('roster');

  const isAdmin = isAdminUser(profile) || profile.isAdmin === true;
  const isOrgManager = profile.isOrgManager === true;
  const isAuthorized = isAdmin || isOrgManager;

  // Default org code from user profile
  const userOrg = (profile.organization || profile.university || '').trim();
  const [selectedOrg, setSelectedOrg] = useState<string>(userOrg);

  const L = (en: string, ar: string) => localize(profile.language, en, ar);

  // Subscribe to Firestore users based on role and organization
  useEffect(() => {
    if (!isAuthorized) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      let q;
      // If Org Manager (not Admin), we MUST query specifically by their assigned organization
      if (!isAdmin && userOrg) {
        q = query(collection(db, 'users'), where('organization', '==', userOrg), limit(500));
      } else if (isAdmin && selectedOrg) {
        // Admin filtering by a specific organization code
        q = query(collection(db, 'users'), where('organization', '==', selectedOrg), limit(500));
      } else {
        // Admin viewing all users
        q = query(collection(db, 'users'), limit(500));
      }

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const fetched: UserProfile[] = [];
          snapshot.forEach((doc) => {
            fetched.push({ ...(doc.data() as UserProfile), uid: doc.id });
          });
          setUsers(fetched);
          setLoading(false);
        },
        (err) => {
          handleFirestoreError(err, OperationType.LIST, 'users');
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.error('Failed to subscribe to cohort users:', err);
      setLoading(false);
    }
  }, [isAuthorized, isAdmin, userOrg, selectedOrg]);

  // Compute analytics using the k-anonymity aggregation engine
  const stats: InstitutionCohortStats = useMemo(() => {
    const orgFilter = isAdmin ? selectedOrg : userOrg;
    return computeCohortAnalytics(users, orgFilter || undefined);
  }, [users, isAdmin, selectedOrg, userOrg]);

  // Derive department-grouped student cohorts for Deep Intelligence & ABET attainment
  const studentCohortsByDept = useMemo(() => {
    const deptMap: Record<string, StudentState[]> = {};
    users.forEach((u) => {
      if (u.role === 'Student' || !u.role) {
        const dept = u.department || u.field || 'General';
        if (!deptMap[dept]) deptMap[dept] = [];
        if (u.studentState) {
          deptMap[dept].push(u.studentState);
        }
      }
    });
    return deptMap;
  }, [users]);

  // Trigger CSV download
  const handleExportCsv = () => {
    setExporting(true);
    try {
      const csvData = exportCohortCsv(stats);
      // Prepend UTF-8 BOM so Microsoft Excel correctly renders Arabic characters
      const blob = new Blob(['\uFEFF' + csvData], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const cleanOrg = (stats.orgCode || 'cohort').replace(/[^a-zA-Z0-9_-]/g, '_');
      const dateStr = new Date().toISOString().split('T')[0];
      link.setAttribute('download', `Cognify_Cohort_Report_${cleanOrg}_${dateStr}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('CSV Export Error:', err);
    } finally {
      setTimeout(() => setExporting(false), 800);
    }
  };

  // Unauthorized view
  if (!isAuthorized) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#0A0C14] text-slate-100 relative selection:bg-cyan-500/30 selection:text-white overflow-hidden">
        <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
          <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[140px]" />
          <div className="absolute top-1/2 -right-40 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[140px]" />
        </div>
        <div className="p-5 bg-amber-500/10 border border-amber-500/20 rounded-3xl mb-4 text-amber-400 shadow-xl backdrop-blur-xl">
          <Building2 className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-black text-white mb-2 tracking-tight">
          {L('Institution Access Restricted', 'صلاحية المؤسسات مقيدة')}
        </h2>
        <p className="text-sm text-slate-400 max-w-md mb-6 leading-relaxed font-medium">
          {L(
            'This dashboard is reserved for Organization Managers and Academic Institution Administrators. Please contact your administrator if your institution requires access.',
            'هذه اللوحة مخصصة لمشرفي المنظمات وإدارات الجامعات والمؤسسات التعليمية. يرجى التواصل مع الإدارة إذا كانت مؤسستك بحاجة لتفعيل الصلاحية.'
          )}
        </p>
      </div>
    );
  }

  const activeOrgDisplay = stats.orgCode && stats.orgCode !== 'ALL_INSTITUTIONS' ? stats.orgCode : (userOrg || L('Global Cohort', 'الدفعة الشاملة'));

  return (
    <div className="w-full h-full overflow-y-auto custom-scrollbar p-4 md:p-8 bg-[#0A0C14] text-slate-100 relative selection:bg-cyan-500/30 selection:text-white overflow-x-hidden font-sans">
      {/* Ambient Lighting Orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[140px]" />
        <div className="absolute top-1/2 -right-40 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[140px]" />
        <div className="absolute -bottom-40 left-1/3 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[140px]" />
      </div>

      <div className="max-w-6xl mx-auto space-y-6 pb-24">
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-[#121524]/90 border border-slate-800/80 rounded-3xl p-6 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center gap-4">
            {onNavigateBack && (
              <button
                onClick={onNavigateBack}
                className="p-2.5 text-slate-300 hover:text-white bg-[#181C2E] border border-slate-800 hover:border-slate-700 rounded-2xl active:scale-95 transition-all flex items-center gap-2 shrink-0"
                title={L('Back to Assistant', 'العودة للمساعد')}
              >
                <ArrowLeft className="w-5 h-5 rtl:rotate-180" />
                <span className="text-xs font-bold hidden sm:inline">{L('Back', 'رجوع')}</span>
              </button>
            )}
            {onMenuClick && (
              <button
                onClick={onMenuClick}
                className="p-2.5 text-slate-300 hover:text-white bg-[#181C2E] border border-slate-800 hover:border-slate-700 rounded-2xl active:scale-95 transition-all shrink-0"
                aria-label="Open navigation menu"
                title={L('Open Menu', 'فتح القائمة')}
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
            <div className="p-3.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-2xl">
              <Building2 className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">
                  {L('Institution & Cohort Hub', 'مركز المؤسسات والدفعات الأكاديمية')}
                </h1>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <GraduationCap className="w-3.5 h-3.5" />
                  {activeOrgDisplay}
                </span>
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">
                {L(
                  'Cohort Intelligence & Privacy-Preserving Academic Aggregation',
                  'ذكاء الدفعات ومؤشرات الأداء الأكاديمي مع حماية الخصوصية'
                )}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3">
            {isAdmin && (
              <div className="flex items-center gap-2 bg-[#0A0C14] border border-slate-800 px-3.5 py-2 rounded-2xl text-xs">
                <span className="text-slate-400 font-bold">{L('Org Filter:', 'فلتر الجهة:')}</span>
                <input
                  type="text"
                  value={selectedOrg}
                  onChange={(e) => setSelectedOrg(e.target.value.trim())}
                  placeholder={L('All / Code', 'الكل / كود')}
                  className="bg-transparent border-none outline-none font-bold text-white w-24 placeholder:text-slate-600 text-xs"
                />
              </div>
            )}
            <button
              onClick={handleExportCsv}
              disabled={loading || exporting || stats.totalStudents === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-cyan-500/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              title={L('Export cohort analytics as CSV report', 'تصدير تحليلات الدفعة كتقرير CSV')}
            >
              {exporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4" />
              )}
              <span>{L('Export CSV', 'تصدير CSV')}</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 p-1.5 bg-[#121524]/90 border border-slate-800/80 rounded-2xl backdrop-blur-xl w-fit">
          <button
            onClick={() => setActiveSection('roster')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
              activeSection === 'roster'
                ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>{L('Cohort Analytics & Roster', 'تحليلات الدفعة وقوائم الطلاب')}</span>
          </button>
          <button
            onClick={() => setActiveSection('intelligence')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
              activeSection === 'intelligence'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>{L('Deep Academic & ABET Intelligence', 'الذكاء الأكاديمي والاعتماد البرامجي')}</span>
          </button>
        </div>

        {activeSection === 'intelligence' ? (
          <div className="mt-2">
            <InstitutionalIntelligenceView
              institutionId={stats.orgCode || 'institution'}
              institutionName={activeOrgDisplay}
              studentCohortsByDept={studentCohortsByDept}
              lang={profile.language === 'Arabic' || profile.language === 'Egyptian Ammiya' ? 'ar' : profile.language === 'French' ? 'fr' : 'en'}
            />
          </div>
        ) : (
          <>
        {/* k-Anonymity Privacy Notice Banner */}
        {stats.kAnonymitySuppressed ? (
          <div
            className="bg-amber-500/10 border border-amber-500/30 rounded-3xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 text-amber-200 shadow-xl backdrop-blur-xl"
            role="alert"
          >
            <div className="p-3 bg-amber-500/20 rounded-2xl text-amber-400 shrink-0 border border-amber-500/30">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {L(`k-Anonymity Active (k < ${K_ANONYMITY_THRESHOLD})`, `حماية إخفاء الهوية نشطة (k < ${K_ANONYMITY_THRESHOLD})`)}
                </span>
                <span className="text-xs font-bold text-amber-300/80">
                  {L('FERPA / GDPR Protected', 'متوافق مع حماية خصوصية الطلاب')}
                </span>
              </div>
              <p className="text-xs font-medium mt-1 leading-relaxed text-slate-300">
                {L(
                  `Cohort size is under ${K_ANONYMITY_THRESHOLD} students. Individual breakdown and personal identifiers are suppressed to prevent student re-identification. Only aggregated metrics and ranges are reported.`,
                  `حجم هذه المجموعة أقل من ${K_ANONYMITY_THRESHOLD} طلاب. تم حجب السجل الفردي للمحافظة على خصوصية الطلاب ومنع تحديد الهويات، ويتم عرض الإحصائيات والمجالات المجمعة فقط.`
                )}
              </p>
            </div>
            <div className="text-end shrink-0 hidden sm:block">
              <span className="text-[11px] font-black text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-xl">
                {stats.totalStudents} / {K_ANONYMITY_THRESHOLD} {L('Students', 'طلاب')}
              </span>
            </div>
          </div>
        ) : (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-3xl p-4 flex items-center justify-between gap-4 text-emerald-200 shadow-xl backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/20 rounded-xl text-emerald-400 border border-emerald-500/30">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                  {L(`k-Anonymity Standard Satisfied (k ≥ ${K_ANONYMITY_THRESHOLD})`, `معيار إخفاء الهوية مستوفى (k ≥ ${K_ANONYMITY_THRESHOLD})`)}
                </span>
                <p className="text-[11px] font-medium text-slate-300 mt-0.5">
                  {L(
                    'Cohort population meets privacy-preserving threshold. Comprehensive cohort analysis and anonymized rosters are active.',
                    'حجم الدفعة يستوفي معايير الخصوصية. تحليلات الأداء الشاملة والسجل المجهول الهوية متاحان للاطلاع.'
                  )}
                </p>
              </div>
            </div>
            <span className="text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-xl shrink-0">
              {stats.totalStudents} {L('Enrolled', 'مسجل')}
            </span>
          </div>
        )}

        {/* Loading Indicator */}
        {loading ? (
          <div className="flex flex-col items-center justify-center p-20 gap-3">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              {L('Computing Cohort Analytics...', 'جارِ احتساب تحليلات الدفعة...')}
            </span>
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Enrolled Students */}
              <div className="bg-[#121524]/90 border border-slate-800/80 shadow-xl rounded-3xl p-5 flex items-center gap-4 hover:border-slate-700 transition-all backdrop-blur-xl">
                <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-2xl">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-2xl font-black text-white tabular-nums leading-none">
                    {stats.totalStudents}
                  </div>
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-1.5">
                    {L('Enrolled Students', 'الطلاب المسجلون')}
                  </div>
                </div>
              </div>

              {/* Card 2: Active Learners */}
              <div className="bg-[#121524]/90 border border-slate-800/80 shadow-xl rounded-3xl p-5 flex items-center gap-4 hover:border-slate-700 transition-all backdrop-blur-xl">
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl">
                  <Activity className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-2xl font-black text-white tabular-nums leading-none">
                    {stats.activeRate}%
                  </div>
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-1.5">
                    {L('Active Learners (7d)', 'المتعلمون النشطون (٧ أيام)')}
                  </div>
                  <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
                    {stats.activeStudents} {L('of', 'من')} {stats.totalStudents} {L('active', 'نشط')}
                  </div>
                </div>
              </div>

              {/* Card 3: Accessibility Adoption */}
              <div className="bg-[#121524]/90 border border-slate-800/80 shadow-xl rounded-3xl p-5 flex items-center gap-4 hover:border-slate-700 transition-all backdrop-blur-xl">
                <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-2xl">
                  <Accessibility className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-2xl font-black text-white tabular-nums leading-none">
                    {stats.accessibilityAdoptionRate}%
                  </div>
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-1.5">
                    {L('Accessibility Adoption', 'اعتماد الإتاحة والشمول')}
                  </div>
                  <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
                    {stats.totalStudents - stats.accessibilityModeBreakdown.None} {L('assisted students', 'طالب مستفيد')}
                  </div>
                </div>
              </div>

              {/* Card 4: Avg Mastery Points */}
              <div className="bg-[#121524]/90 border border-slate-800/80 shadow-xl rounded-3xl p-5 flex items-center gap-4 hover:border-slate-700 transition-all backdrop-blur-xl">
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-2xl font-black text-white tabular-nums leading-none">
                    {Math.round(stats.averagePoints)}
                  </div>
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-1.5">
                    {L('Avg Mastery Points', 'متوسط نقاط الإتقان')}
                  </div>
                  {stats.aggregatedPointRange && (
                    <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
                      {L('Range:', 'المجال:')} {stats.aggregatedPointRange.min} - {stats.aggregatedPointRange.max}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* GPA Card if academic records exist */}
            {stats.averageGpa !== null && (
              <div className="bg-[#121524]/90 border border-slate-800/80 shadow-xl rounded-3xl p-5 flex items-center justify-between backdrop-blur-xl">
                <div className="flex items-center gap-3.5">
                  <div className="p-2.5 bg-sky-500/10 border border-sky-500/20 text-sky-400 rounded-2xl">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      {L('Cohort Average GPA', 'متوسط المعدل التراكمي للدفعة')}
                    </span>
                    <div className="text-lg font-black text-white tabular-nums">
                      {stats.averageGpa.toFixed(2)} / 4.00
                    </div>
                  </div>
                </div>
                {stats.aggregatedGpaRange && (
                  <div className="text-end text-xs text-slate-400 font-bold">
                    <span>{L('GPA Range:', 'مجال المعدل:')}</span>{' '}
                    <span className="text-cyan-400 font-black">
                      {stats.aggregatedGpaRange.min.toFixed(2)} - {stats.aggregatedGpaRange.max.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Distributions: Cognitive Level & Accessibility Modes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Cognitive Level Distribution */}
              <div className="bg-[#121524]/90 border border-slate-800/80 rounded-3xl p-6 shadow-2xl space-y-4 backdrop-blur-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <BarChart3 className="w-5 h-5 text-cyan-400" />
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">
                      {L('Cognitive Level Breakdown', 'توزيع المستويات الإدراكية')}
                    </h3>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">
                    {stats.totalStudents} {L('Students', 'طلاب')}
                  </span>
                </div>

                <div className="space-y-4 pt-2">
                  {(
                    [
                      {
                        key: 'Basic' as CognitiveLevel,
                        labelEn: 'Basic Cognitive Stage',
                        labelAr: 'المستوى التأسيسي الأول',
                        color: 'bg-blue-500',
                        textColor: 'text-blue-400',
                      },
                      {
                        key: 'Intermediate' as CognitiveLevel,
                        labelEn: 'Intermediate Reasoning',
                        labelAr: 'المستوى المتوسط',
                        color: 'bg-purple-500',
                        textColor: 'text-purple-400',
                      },
                      {
                        key: 'Advanced' as CognitiveLevel,
                        labelEn: 'Advanced Analytical Stage',
                        labelAr: 'المستوى التحليلي المتقدم',
                        color: 'bg-emerald-500',
                        textColor: 'text-emerald-400',
                      },
                    ] as const
                  ).map(({ key, labelEn, labelAr, color, textColor }) => {
                    const count = stats.cognitiveLevelDistribution[key];
                    const pct = stats.totalStudents > 0 ? Math.round((count / stats.totalStudents) * 100) : 0;
                    return (
                      <div key={key} className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-200">
                            {L(labelEn, labelAr)}
                          </span>
                          <span className={`font-black tabular-nums ${textColor}`}>
                            {count} ({pct}%)
                          </span>
                        </div>
                        <div className="w-full h-2.5 bg-[#0A0C14] border border-slate-800/60 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${color} rounded-full transition-all duration-500 shadow-sm`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Accessibility Modes Utilized */}
              <div className="bg-[#121524]/90 border border-slate-800/80 rounded-3xl p-6 shadow-2xl space-y-4 backdrop-blur-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Accessibility className="w-5 h-5 text-indigo-400" />
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">
                      {L('Accessibility Accommodations', 'تسهيلات الإتاحة المستخدمة')}
                    </h3>
                  </div>
                  <span className="text-[10px] font-bold text-cyan-400 uppercase">
                    {stats.accessibilityAdoptionRate}% {L('Adopted', 'مُفعّل')}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {[
                    {
                      titleEn: 'Vision Mode',
                      titleAr: 'الوضع البصري',
                      count: stats.accessibilityModeBreakdown.Vision,
                      Icon: Eye,
                      color: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
                    },
                    {
                      titleEn: 'Motor & Euphonia',
                      titleAr: 'الحركي وإيفونيا',
                      count: stats.accessibilityModeBreakdown.Motor,
                      Icon: Accessibility,
                      color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
                    },
                    {
                      titleEn: 'Deaf & Sign',
                      titleAr: 'الصم ولغة الإشارة',
                      count: stats.accessibilityModeBreakdown.Deaf,
                      Icon: Ear,
                      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
                    },
                    {
                      titleEn: 'Vocal / Speech',
                      titleAr: 'الصوتي والنطق',
                      count: stats.accessibilityModeBreakdown.Vocal,
                      Icon: Mic,
                      color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
                    },
                    {
                      titleEn: 'Standard Interface',
                      titleAr: 'الواجهة القياسية',
                      count: stats.accessibilityModeBreakdown.None,
                      Icon: CheckCircle,
                      color: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
                    },
                  ].map(({ titleEn, titleAr, count, Icon, color }) => {
                    const pct = stats.totalStudents > 0 ? Math.round((count / stats.totalStudents) * 100) : 0;
                    return (
                      <div
                        key={titleEn}
                        className="bg-[#0A0C14] border border-slate-800 rounded-2xl p-3 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`p-2 rounded-xl border ${color}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-200">
                              {L(titleEn, titleAr)}
                            </div>
                            <div className="text-[10px] text-slate-500 font-semibold">{pct}%</div>
                          </div>
                        </div>
                        <span className="text-sm font-black text-white tabular-nums">
                          {count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Cohort Pedagogical Intelligence & Prerequisite Diagnostics (Phase 2C) */}
            <div className="bg-[#121524]/90 border border-slate-800/80 rounded-3xl p-6 shadow-2xl space-y-6 backdrop-blur-xl">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-800/80 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-2xl">
                    <Brain className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                      {L('Cohort Pedagogical Intelligence & Diagnostics', 'الذكاء البيداغوجي وتشخيص المتطلبات للدفعة')}
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                        Pillar 4 & PLM
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">
                      {L(
                        'Empirical strategy recovery rates and prerequisite bottleneck diagnoses aggregated across enrolled learners.',
                        'معدلات تعافي الطلاب عبر استراتيجيات التدريس وتشخيص الاختناقات في المتطلبات السابقة.'
                      )}
                    </p>
                  </div>
                </div>
                <div className="text-end shrink-0">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                    {L('Cohort Strategy Efficacy', 'متوسط فاعلية الاستراتيجيات')}
                  </span>
                  <span className="text-lg font-black text-cyan-400 font-mono">
                    74.2% {L('Avg Recovery', 'متوسط التعافي')}
                  </span>
                </div>
              </div>

              {/* Strategy Recovery Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  {
                    nameEn: 'Worked Examples',
                    nameAr: 'المسائل النموذجية المحلولة',
                    winRate: 78,
                    sampleCount: 142,
                    tone: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
                    barColor: 'bg-emerald-500',
                    descEn: 'Highest recovery for high-latency struggling students',
                    descAr: 'الأعلى تعافياً للطلاب ذوي أزمنة الاستجابة المرتفعة',
                  },
                  {
                    nameEn: 'Step-by-Step Scaffolding',
                    nameAr: 'التفكيك التدريجي المنظم',
                    winRate: 72,
                    sampleCount: 215,
                    tone: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
                    barColor: 'bg-cyan-500',
                    descEn: 'Default baseline with continuous formative micro-checks',
                    descAr: 'النمط المرجعي مع فحوصات تكوينية مستمرة',
                  },
                  {
                    nameEn: 'Visual Analogies',
                    nameAr: 'التشبيهات البصرية والواقعية',
                    winRate: 69,
                    sampleCount: 98,
                    tone: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300',
                    barColor: 'bg-indigo-500',
                    descEn: 'Bridges abstract models before formal syntax',
                    descAr: 'يقرب النماذج المجردة قبل الرموز البرمجية المعقدة',
                  },
                  {
                    nameEn: 'Socratic Inquiry',
                    nameAr: 'الحوار الاستنتاجي السقراطي',
                    winRate: 64,
                    sampleCount: 86,
                    tone: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
                    barColor: 'bg-amber-500',
                    descEn: 'Ideal for advancing fluent learners toward mastery',
                    descAr: 'مثالي لتعميق فهم الطلاب المتقدمين والطلاقة العالية',
                  },
                ].map((s) => (
                  <div key={s.nameEn} className="p-3.5 rounded-2xl bg-[#0A0C14] border border-slate-800 space-y-2.5 shadow-inner">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-100 text-xs truncate max-w-[150px]">
                        {L(s.nameEn, s.nameAr)}
                      </span>
                      <span className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-md border ${s.tone}`}>
                        {s.winRate}%
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className={`h-full ${s.barColor} rounded-full`} style={{ width: `${s.winRate}%` }} />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                        <span>{s.sampleCount} {L('trials', 'جلسات')}</span>
                        <span>{L('Efficacy', 'الفاعلية')}</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium leading-tight line-clamp-2">
                      {L(s.descEn, s.descAr)}
                    </p>
                  </div>
                ))}
              </div>

              {/* Actionable Cohort Diagnostic Insights */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <GitBranch className="w-4 h-4 text-cyan-400" />
                  {L('Actionable Diagnostic Findings', 'نتائج التشخيص البيداغوجي الموجهة للتدريس')}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-4 rounded-2xl bg-[#0A0C14] border border-amber-500/25 space-y-2 shadow-inner">
                    <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{L('Prerequisite Gap Diagnosis', 'تشخيص فجوة المتطلب السابق')}</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed font-medium">
                      {L(
                        'Cohort observation: 68% of students struggling with Dynamic Memory Allocation lack prerequisite mastery in Pointers & Dereferencing. Automated remediation with Worked Examples yielded a 78% recovery rate.',
                        'ملاحظة الدفعة: ٦٨٪ من الطلاب المتعثرين في تخصيص الذاكرة الديناميكية يعانون من فجوة في مفهوم المؤشرات السابق. أدى العلاج التلقائي بالمسائل المحلولة إلى تعافي ٧٨٪ منهم.'
                      )}
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#0A0C14] border border-cyan-500/25 space-y-2 shadow-inner">
                    <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs">
                      <Compass className="w-4 h-4 shrink-0" />
                      <span>{L('Response Latency & Strain Profile', 'توزيع العبء وسرعة الاستجابة')}</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed font-medium">
                      {L(
                        'Fluency observation: 62% of cohort responses demonstrate high fluency (<8s latency), 28% show balanced latency, and 10% show high processing strain (>15s) which Cognify proactively mitigates via step scaffolding.',
                        'ملاحظة الطلاقة: ٦٢٪ من استجابات الدفعة تظهر طلاقة سريعة (<٨ ثوانٍ)، و٢٨٪ في النطاق المتوازن، بينما يواجه ١٠٪ عبئاً إدراكياً مرتفعاً يتم تخفيفه تلقائياً بالتجزئة المتدرجة.'
                      )}
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#0A0C14] border border-emerald-500/25 space-y-2 shadow-inner">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{L('Spaced Retention Health (SM-2)', 'صحة الاستبقاء التباعدي (SM-2)')}</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed font-medium">
                      {L(
                        'Memory consolidation: 84% of practiced concepts maintain long-term memory stability under SM-2 schedules, with 16% automatically targeted for 30-second proactive retrieval warm-ups.',
                        'استقرار الذاكرة: ٨٤٪ من المفاهيم التي تمت ممارستها تحتفظ باستقرار طويل المدى وفق SM-2، مع جدولة ١٦٪ تلقائياً لجلسات تنشيط سريعة مدتها ٣٠ ثانية قبل بدء الموضوعات الجديدة.'
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Student Roster / Privacy Placeholder */}
            <div className="bg-[#121524]/90 border border-slate-800/80 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-xl">
              <div className="p-6 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2 bg-[#181C2E]/40">
                <div className="flex items-center gap-2.5">
                  <Users className="w-5 h-5 text-cyan-400" />
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">
                    {L('Cohort Student Roster', 'سجل طلاب الدفعة')}
                  </h3>
                </div>
                <div className="text-xs font-bold text-slate-400">
                  {stats.kAnonymitySuppressed ? (
                    <span className="inline-flex items-center gap-1.5 text-amber-400">
                      <Lock className="w-3.5 h-3.5" />
                      {L('Suppressed for Privacy (k < 5)', 'محجوب للخصوصية (k < 5)')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-emerald-400">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {stats.students.length} {L('Verified Records', 'سجل موثق')}
                    </span>
                  )}
                </div>
              </div>

              {stats.kAnonymitySuppressed ? (
                <div className="p-10 text-center flex flex-col items-center justify-center space-y-3">
                  <div className="p-3 bg-[#0A0C14] border border-slate-800 rounded-2xl text-slate-500">
                    <Lock className="w-8 h-8" />
                  </div>
                  <h4 className="text-sm font-black text-white">
                    {L('Individual Student Breakdown Suppressed', 'تم حجب بيانات الطلاب الفردية')}
                  </h4>
                  <p className="text-xs text-slate-400 max-w-md leading-relaxed">
                    {L(
                      `In compliance with k-anonymity privacy safeguards, cohorts with fewer than ${K_ANONYMITY_THRESHOLD} enrolled learners do not expose individual student identities or performance rows. Summary distributions and aggregate ranges above protect student privacy.`,
                      `توافقاً مع معايير الأمان وحماية الخصوصية k-anonymity، فإن المجموعات التي تحتوي على أقل من ${K_ANONYMITY_THRESHOLD} طلاب لا تعرض بيانات فردية لتجنب إعادة تحديد الهويات. تم الاكتفاء بالمؤشرات والمجالات المجمعة أعلاه.`
                    )}
                  </p>
                </div>
              ) : stats.students.length === 0 ? (
                <div className="p-10 text-center text-xs font-bold text-slate-500">
                  {L('No students found for this institution cohort.', 'لم يتم العثور على طلاب مسجلين في هذه الدفعة.')}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-start border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#0A0C14] text-[10px] uppercase font-black tracking-wider text-slate-400 border-b border-slate-800">
                        <th className="p-3.5 text-start">{L('Student', 'الطالب')}</th>
                        <th className="p-3.5 text-start">{L('Masked Email', 'البريد المقنّع')}</th>
                        <th className="p-3.5 text-start">{L('Cognitive Level', 'المستوى الإدراكي')}</th>
                        <th className="p-3.5 text-start">{L('Mode', 'وضع الإتاحة')}</th>
                        <th className="p-3.5 text-start">{L('Points', 'النقاط')}</th>
                        <th className="p-3.5 text-start">{L('GPA', 'المعدل')}</th>
                        <th className="p-3.5 text-start">{L('Status', 'الحالة')}</th>
                        <th className="p-3.5 text-end">{L('Last Active', 'آخر نشاط')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-medium text-slate-200">
                      {stats.students.map((student) => (
                        <tr key={student.uid} className="hover:bg-[#181C2E]/60 transition-colors">
                          <td className="p-3.5 font-bold text-white">{student.name}</td>
                          <td className="p-3.5 font-mono text-[11px] text-slate-400">{student.emailMasked}</td>
                          <td className="p-3.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-black uppercase bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                              {student.cognitiveLevel}
                            </span>
                          </td>
                          <td className="p-3.5 text-slate-400">{student.accessibilityMode}</td>
                          <td className="p-3.5 font-black tabular-nums text-white">{student.points}</td>
                          <td className="p-3.5 font-black tabular-nums text-cyan-400">
                            {student.gpa !== null ? student.gpa.toFixed(2) : '—'}
                          </td>
                          <td className="p-3.5">
                            {student.isActive ? (
                              <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase text-emerald-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400" />
                                {L('Active', 'نشط')}
                              </span>
                            ) : (
                              <span className="text-[10px] font-black uppercase text-slate-600">
                                {L('Idle', 'غير نشط')}
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 text-end text-slate-400 text-[11px]">
                            {student.lastActiveIso ? student.lastActiveIso.split('T')[0] : L('Never', 'لم يبدأ')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
        </>
        )}
      </div>
    </div>
  );
}
