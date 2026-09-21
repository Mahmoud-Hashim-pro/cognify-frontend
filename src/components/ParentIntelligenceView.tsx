import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { UserProfile } from '../types';
import {
  Heart,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Award,
  MessageCircle,
  Calendar,
  Clock,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Lock,
  Compass,
  Link2,
  X,
} from 'lucide-react';
import type { StudentState } from '../types/studentState';
import type { ParentDashboardData } from '../types/parent';
import { compileParentDashboard, verifyParentChildRelationship } from '../lib/parentIntelligence';
import { sendCaregiverLinkRequest } from '../lib/caregiverLinking';
import { createInitialStudentState } from '../lib/studentStateEngine';
import { toast } from './Toast';

interface ParentIntelligenceViewProps {
  student?: StudentState;
  studentDisplayName?: string;
  lang?: 'en' | 'ar' | 'fr';
  profile?: UserProfile | null;
  onBack?: () => void;
}

export const ParentIntelligenceView: React.FC<ParentIntelligenceViewProps> = ({
  student,
  studentDisplayName = 'Alex',
  lang = 'ar',
  profile,
  onBack,
}) => {
  const isAr = lang === 'ar';
  const [activeTab, setActiveTab] = useState<'growth' | 'breakthroughs' | 'discussion_cues'>('growth');
  const [isLinkingModalOpen, setIsLinkingModalOpen] = useState(false);
  const [childIdInput, setChildIdInput] = useState('');
  const [linkedChildState, setLinkedChildState] = useState<StudentState | null>(null);
  const [linkedChildName, setLinkedChildName] = useState<string>('');
  const [isDemoMode, setIsDemoMode] = useState<boolean>(!student);

  // Hydrate linked child academic state from Firestore
  useEffect(() => {
    const childId = profile?.linkedChildUid || (typeof window !== 'undefined' ? localStorage.getItem('cognify_linked_child_uid') : null);
    if (!childId || student) return;

    let isMounted = true;
    const loadChild = async () => {
      try {
        if (typeof window !== 'undefined' && db) {
          const uDoc = await getDoc(doc(db, `users/${childId}`));
          if (uDoc.exists() && isMounted) {
            const u = uDoc.data();
            
            // Strictly verify that current authenticated user is an authorized parent/guardian
            const authResult = verifyParentChildRelationship(profile, u);
            if (!authResult.authorized) {
              console.warn(`[ParentIntelligenceView] Access denied: ${authResult.reason}`);
              setIsDemoMode(true);
              return;
            }

            setLinkedChildName(u.name || u.email?.split('@')[0] || 'Child');
            try {
              const sDoc = await getDoc(doc(db, `users/${childId}/studentState/current`));
              if (sDoc.exists() && isMounted) {
                setLinkedChildState(sDoc.data() as StudentState);
                setIsDemoMode(false);
                return;
              }
            } catch {}
            // Synthesize from profile
            if (isMounted) {
              const base = createInitialStudentState(childId, u.level);
              setLinkedChildState({
                ...base,
                conceptMastery: u.mastery || {},
                totalExercisesCompleted: u.questionHistory?.length || 0,
                lastActiveTimestamp: u.lastActiveDate ? new Date(u.lastActiveDate).getTime() : Date.now(),
              });
              setIsDemoMode(false);
            }
          }
        }
      } catch (err) {
        console.warn('[ParentIntelligenceView] Failed to load linked child state:', err);
      }
    };
    loadChild();
    return () => { isMounted = false; };
  }, [profile?.linkedChildUid, student]);

  // Provide realistic demo student if not passed from session
  const activeStudent: StudentState = useMemo(() => {
    if (student) return student;
    if (linkedChildState && !isDemoMode) return linkedChildState;

    return {
      uid: 'demo_child_01',
      cognitiveStage: 'developing',
      activePedagogy: 'worked_example',
      conceptMastery: {
        pointers: {
          conceptId: 'pointers',
          accuracy: 0.84,
          attempts: 6,
          correct: 5,
          confidence: 0.85,
          consecutiveCorrect: 3,
          consecutiveIncorrect: 2,
          lastTested: Date.now(),
          mistakeTypes: ['memory_leak'],
        },
        dynamic_memory: {
          conceptId: 'dynamic_memory',
          accuracy: 0.92,
          attempts: 5,
          correct: 5,
          confidence: 0.92,
          consecutiveCorrect: 4,
          consecutiveIncorrect: 0,
          lastTested: Date.now(),
          mistakeTypes: [],
        },
        data_structures: {
          conceptId: 'data_structures',
          accuracy: 0.80,
          attempts: 7,
          correct: 6,
          confidence: 0.80,
          consecutiveCorrect: 3,
          consecutiveIncorrect: 1,
          lastTested: Date.now(),
          mistakeTypes: [],
        },
      },
      learningStrain: {
        possibleStruggle: 0.28,
        confidence: 0.7,
        signals: [],
      },
      struggleSignal: 0.28,
      cognitiveLoadScore: 0.28,
      pedagogyEffectiveness: {
        worked_example: { score: 0.85, helpfulCount: 5, unhelpfulCount: 1 },
        socratic: { score: 0.65, helpfulCount: 3, unhelpfulCount: 2 },
        scaffolded: { score: 0.75, helpfulCount: 4, unhelpfulCount: 1 },
        analogies: { score: 0.70, helpfulCount: 3, unhelpfulCount: 1 },
        advanced_rigor: { score: 0.40, helpfulCount: 1, unhelpfulCount: 1 },
      },
      retentionSchedules: {},
      activeInterventions: {},
      totalExercisesCompleted: 24,
      lastActiveTimestamp: Date.now(),
    };
  }, [student, linkedChildState, isDemoMode]);

  const effectiveDisplayName = linkedChildName || studentDisplayName;

  const dashboardData: ParentDashboardData = useMemo(() => {
    return compileParentDashboard(activeStudent, effectiveDisplayName, 2);
  }, [activeStudent, effectiveDisplayName]);

  const handleLinkChild = async () => {
    if (!childIdInput.trim() || !profile?.uid) return;
    const cleanId = childIdInput.trim();
    if (typeof window !== 'undefined') {
      // Remembered locally so this screen knows which child to *display* once
      // approved — this alone never grants any data access.
      localStorage.setItem('cognify_linked_child_uid', cleanId);
    }
    if (db) {
      setDoc(doc(db, `users/${profile.uid}`), { linkedChildUid: cleanId }, { merge: true }).catch(() => {});
      try {
        await sendCaregiverLinkRequest(profile.uid, profile.name || profile.email || 'A caregiver', profile.email || '', cleanId);
        toast.success(
          isAr
            ? 'تم إرسال طلب الربط — في انتظار موافقة الطالب'
            : 'Link request sent — waiting for the student to approve'
        );
      } catch (err) {
        toast.error(
          isAr ? 'تعذّر إرسال طلب الربط' : 'Could not send the link request'
        );
      }
    }
    setIsLinkingModalOpen(false);
    setIsDemoMode(false);
  };

  return (
    <div className="min-h-screen bg-[#0A0C14] text-slate-100 p-4 sm:p-8" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Background Ambient Glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-1/4 -right-20 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 -left-20 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto space-y-6">
        {/* Top Header Card */}
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
            <div className="p-3.5 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-500 text-white shadow-lg shadow-purple-500/20">
              <Heart className="w-7 h-7 fill-white/20" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  {isAr ? 'بوابة ولي الأمر الذكية' : 'Parent Learning Intelligence'}
                </span>
                <span className="text-xs font-medium text-slate-400">
                  {isAr ? 'تطور الطالب ونموه' : 'Student Developmental View'}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mt-1">
                {isAr ? `رحلة تعلم: ${dashboardData.studentDisplayName}` : `${dashboardData.studentDisplayName}'s Learning Journey`}
              </h1>
            </div>
          </div>

          {/* Key Metrics & Child Linking Badges */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setIsLinkingModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-bold transition active:scale-95 shadow-lg"
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>{linkedChildName ? (isAr ? `مرتبط: ${linkedChildName}` : `Linked: ${linkedChildName}`) : (isAr ? 'ربط حساب الابن' : 'Link Child')}</span>
            </button>

            {isDemoMode ? (
              <span className="text-[11px] font-bold px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-300 border border-amber-500/20">
                {isAr ? '⚡ عينة معيارية [Benchmark Baseline Dataset]' : '⚡ [Benchmark Baseline Dataset]'}
              </span>
            ) : (
              <span className="text-[11px] font-bold px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                {isAr ? '🟢 بيانات حية متصلة [Live Connected Data]' : '🟢 [Live Connected Data]'}
              </span>
            )}

            <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-900/80 border border-slate-800">
              <Calendar className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-semibold text-white">
                {dashboardData.growthSummary.activeDaysCount} {isAr ? 'أيام' : 'Days'}
              </span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-900/80 border border-slate-800">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-semibold text-white">
                {dashboardData.growthSummary.practiceTimeMinutes} {isAr ? 'دقيقة' : 'Mins'}
              </span>
            </div>
          </div>
        </div>

        {/* Strict Zero-Chat-Snooping Privacy Shield Banner */}
        <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-3xl p-4 sm:p-5 flex items-start sm:items-center gap-3.5 backdrop-blur-md">
          <div className="p-2.5 rounded-2xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                {isAr ? 'درع الخصوصية والأمان النفسي مفعل 100%' : 'Zero-Chat-Snooping Privacy Shield Active'}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                {isAr ? 'حماية مشددة' : 'Strict Protection'}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-emerald-200/90 leading-relaxed">
              {isAr
                ? 'محادثات وأسئلة الطالب المباشرة مع المعلم الذكي تظل خاصة تماماً ومحمية لدعم حريته في السؤال والتعلم دون خوف أو حرج. نقدم لولي الأمر مؤشرات النمو المفاهيمي والأفكار التوجيهية فقط.'
                : 'Raw 1-on-1 AI tutor chat messages remain strictly confidential to safeguard student psychological safety and intellectual exploration. Only developmental milestones and home discussion cues are presented.'}
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-[#121524] border border-slate-800/80 w-full sm:w-fit overflow-x-auto">
          <button
            onClick={() => setActiveTab('growth')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition ${
              activeTab === 'growth'
                ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>{isAr ? 'مسار النمو الأسبوعي' : 'Weekly Growth'}</span>
          </button>

          <button
            onClick={() => setActiveTab('breakthroughs')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition ${
              activeTab === 'breakthroughs'
                ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>{isAr ? 'إنجازات تستحق الاحتفال' : 'Celebrated Breakthroughs'}</span>
            <span className="ml-1 text-xs px-1.5 py-0.5 rounded-md bg-white/20">
              {dashboardData.breakthroughs.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('discussion_cues')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition ${
              activeTab === 'discussion_cues'
                ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <MessageCircle className="w-4 h-4" />
            <span>{isAr ? 'أفكار للنقاش المنزلي' : 'Home Discussion Cues'}</span>
            <span className="ml-1 text-xs px-1.5 py-0.5 rounded-md bg-white/20">
              {dashboardData.homeDiscussionCues.length}
            </span>
          </button>
        </div>

        {/* Tab 1: Weekly Growth Summary */}
        {activeTab === 'growth' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {/* Card 1: Concepts Mastered */}
              <div className="bg-[#121524]/90 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-xl shadow-xl space-y-3">
                <span className="text-xs font-semibold text-slate-400">
                  {isAr ? 'المفاهيم المتقنة هذا الأسبوع' : 'Concepts Mastered This Week'}
                </span>
                <div className="flex items-baseline gap-3">
                  <div className="text-4xl font-black text-white">
                    {dashboardData.growthSummary.conceptsMasteredCount}
                  </div>
                  <span className="text-xs font-bold text-emerald-400">
                    +{dashboardData.growthSummary.growthPercentage}% {isAr ? 'عن الأسبوع الماضي' : 'vs last week'}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  {isAr ? 'مقارنة بـ' : 'Compared to'} {dashboardData.growthSummary.previousWeekMasteredCount} {isAr ? 'مفاهيم في الأسبوع السابق' : 'concepts last week'}.
                </p>
              </div>

              {/* Card 2: Practice Consistency */}
              <div className="bg-[#121524]/90 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-xl shadow-xl space-y-3">
                <span className="text-xs font-semibold text-slate-400">
                  {isAr ? 'الاستمرارية والنشاط' : 'Practice Consistency'}
                </span>
                <div className="flex items-baseline gap-2">
                  <div className="text-4xl font-black text-white">
                    {dashboardData.growthSummary.activeDaysCount}
                  </div>
                  <span className="text-slate-400 text-sm">/ 7 {isAr ? 'أيام' : 'days'}</span>
                </div>
                <p className="text-xs text-emerald-300 font-medium">
                  {isAr ? 'عادة تعلم ممتازة ومنتظمة' : 'Consistent and solid learning routine'}
                </p>
              </div>

              {/* Card 3: Momentum */}
              <div className="bg-[#121524]/90 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-xl shadow-xl space-y-3">
                <span className="text-xs font-semibold text-slate-400">
                  {isAr ? 'زخم التعلم' : 'Learning Momentum'}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-3 py-1 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase tracking-wider">
                    {dashboardData.growthSummary.learningMomentum.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  {isAr
                    ? 'يكتسب الطالب ثقة متزايدة وسرعة استيعاب أعلى في المفاهيم المتتالية.'
                    : 'The student is developing strong confidence and higher conceptual fluency.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Celebrated Breakthroughs */}
        {activeTab === 'breakthroughs' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-purple-400 shrink-0" />
              <p className="text-sm text-purple-200">
                {isAr
                  ? 'نحتفي بالصبر والإصرار وتجاوز الصعاب، فالمحاولة بعد الخطأ هي جوهر التميز الحقيقي.'
                  : 'We celebrate grit, resilience, and perseverance. Overcoming struggle is the true marker of deep mastery.'}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {dashboardData.breakthroughs.map((breakthrough) => {
                const isResilience = breakthrough.type === 'resilience_breakthrough';
                const isLeap = breakthrough.type === 'mastery_leap';

                return (
                  <div
                    key={breakthrough.id}
                    className="bg-[#121524]/90 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-xl shadow-xl space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`p-2.5 rounded-xl shrink-0 ${
                              isResilience
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : isLeap
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                            }`}
                          >
                            <Award className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              {breakthrough.type.replace('_', ' ')}
                            </span>
                            <h3 className="text-lg font-bold text-white">
                              {isAr ? breakthrough.headlineAr : breakthrough.headlineEn}
                            </h3>
                          </div>
                        </div>
                      </div>

                      <p className="text-sm text-slate-300 leading-relaxed">
                        {isAr ? breakthrough.storyAr : breakthrough.storyEn}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                      <span>{isAr ? 'المفهوم المكتمل' : 'Target Concept'}:</span>
                      <span className="font-semibold text-white">
                        {isAr ? breakthrough.conceptTitleAr : breakthrough.conceptTitleEn}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 3: Home Discussion Cues */}
        {activeTab === 'discussion_cues' && (
          <div className="space-y-5">
            <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center gap-3">
              <Compass className="w-5 h-5 text-cyan-400 shrink-0" />
              <p className="text-sm text-cyan-200">
                {isAr
                  ? 'أفكار لمحادثات عائلية ممتعة ودافئة حول طاولة الطعام أو خلال اليوم لتشجيع الطالب ودعم ثقته دون توتر.'
                  : 'Actionable home conversation starters to engage your student warmly without test stress or interrogation.'}
              </p>
            </div>

            <div className="space-y-4">
              {dashboardData.homeDiscussionCues.map((cue) => (
                <div
                  key={cue.id}
                  className="bg-[#121524]/90 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-xl shadow-xl space-y-4"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-2xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shrink-0">
                      <MessageCircle className="w-6 h-6" />
                    </div>
                    <div className="space-y-2 flex-1">
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300">
                        {isAr ? 'سؤال مقترح للنقاش' : 'Suggested Conversation Starter'}
                      </span>
                      <h4 className="text-base sm:text-lg font-bold text-white">
                        {isAr ? cue.conversationStarterAr : cue.conversationStarterEn}
                      </h4>
                      <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
                        <span className="text-xs font-bold text-amber-300">
                          {isAr ? '💡 نصيحة لدعم الطالب:' : '💡 Supportive Parenting Tip:'}
                        </span>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          {isAr ? cue.supportiveTipAr : cue.supportiveTipEn}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Child Account Linking Modal */}
        {isLinkingModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
            <div className="relative w-full max-w-md rounded-3xl bg-[#121524] border border-slate-800 text-slate-100 p-6 shadow-2xl space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-purple-500/20 border border-purple-500/30 text-purple-300">
                    <Link2 className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-white text-base">
                    {isAr ? 'ربط حساب الابن / الطالب' : 'Link Child / Student Account'}
                  </h3>
                </div>
                <button
                  onClick={() => setIsLinkingModalOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/60 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-slate-300">
                <p>
                  {isAr
                    ? 'أدخل المعرف التعريفي للطالب (Student UID) أو كود الطالب لجلب تقارير التعلم الفعلية ونسب الإتقان في المقررات الدراسية.'
                    : 'Enter the Student UID or enrollment code to sync live learning milestones, active pedagogy, and concept mastery.'}
                </p>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    {isAr ? 'معرف الطالب (Student UID / Code)' : 'Student UID / Code'}
                  </label>
                  <input
                    type="text"
                    value={childIdInput}
                    onChange={(e) => setChildIdInput(e.target.value)}
                    placeholder="e.g. std_usr_998124 or student email"
                    className="w-full px-4 py-3 rounded-2xl bg-[#0A0C14] border border-slate-800 text-white placeholder-slate-600 text-xs focus:outline-none focus:border-purple-500/50"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  onClick={() => setIsLinkingModalOpen(false)}
                  className="px-5 py-2.5 rounded-2xl border border-slate-800 bg-[#0A0C14] text-slate-300 text-xs font-bold hover:bg-slate-800/40 transition"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  onClick={handleLinkChild}
                  disabled={!childIdInput.trim()}
                  className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold disabled:opacity-40 transition shadow-lg shadow-purple-500/20 active:scale-95"
                >
                  {isAr ? 'ربط الحساب الآن' : 'Link Account'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ParentIntelligenceView;
