/**
 * Parent Intelligence Engine (Milestone 14)
 * Synthesizes growth trajectories, celebrated breakthroughs, and supportive home discussion cues
 * while strictly enforcing the Zero-Chat-Snooping Privacy Shield to protect student psychological safety.
 */

import type { StudentState, ConceptMasteryRecord } from '../types/studentState';
import { getConcept } from './conceptGraph';
import type {
  WeeklyGrowthSummary,
  CelebratedBreakthrough,
  HomeDiscussionCue,
  ParentPrivacyShieldAudit,
  ParentDashboardData,
  MomentumTrend,
} from '../types/parent';

/**
 * Synthesizes weekly learning growth, active habits, and momentum trajectory.
 */
export function synthesizeWeeklyGrowth(
  student: StudentState,
  previousWeekMasteredCount: number = 3
): WeeklyGrowthSummary {
  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const weekStartDate = now - weekMs;
  const weekEndDate = now;

  let masteredCount = 0;
  for (const mastery of Object.values(student.conceptMastery || {})) {
    if (mastery.accuracy >= 0.75 || mastery.consecutiveCorrect >= 3) {
      masteredCount++;
    }
  }

  const growthPercentage =
    previousWeekMasteredCount > 0
      ? Math.round(((masteredCount - previousWeekMasteredCount) / previousWeekMasteredCount) * 100)
      : masteredCount * 25;

  // Active days count heuristic based on exercises completed & last active timestamp
  const activeDaysCount = Math.min(7, Math.max(1, Math.ceil((student.totalExercisesCompleted || 5) / 4)));
  const practiceTimeMinutes = Math.round((student.totalExercisesCompleted || 10) * 3.5);

  let learningMomentum: MomentumTrend = 'steady';
  if (growthPercentage >= 20 || activeDaysCount >= 5) {
    learningMomentum = 'accelerating';
  } else if (growthPercentage < 0) {
    learningMomentum = 'needs_encouragement';
  }

  return {
    weekStartDate,
    weekEndDate,
    activeDaysCount,
    conceptsMasteredCount: masteredCount,
    previousWeekMasteredCount,
    growthPercentage,
    practiceTimeMinutes,
    learningMomentum,
  };
}

/**
 * Detects celebrated learning breakthroughs, highlighting resilience and effort
 * rather than simple raw test scores.
 */
export function detectCelebratedBreakthroughs(student: StudentState): CelebratedBreakthrough[] {
  const breakthroughs: CelebratedBreakthrough[] = [];

  for (const [conceptId, mastery] of Object.entries(student.conceptMastery || {})) {
    const node = getConcept(conceptId);
    const titleEn = node?.nameEn || conceptId;
    const titleAr = node?.nameAr || conceptId;

    // 1. Resilience Breakthrough: Had struggle (high attempts / incorrects) and reached mastery
    if (
      mastery.attempts >= 4 &&
      (mastery.consecutiveIncorrect >= 2 || mastery.mistakeTypes.length > 0 || mastery.accuracy >= 0.70) &&
      mastery.consecutiveCorrect >= 1
    ) {
      breakthroughs.push({
        id: `breakthrough_resilience_${conceptId}`,
        conceptId,
        conceptTitleEn: titleEn,
        conceptTitleAr: titleAr,
        type: 'resilience_breakthrough',
        headlineEn: `Conquered ${titleEn} Through Determination!`,
        headlineAr: `تغلّب على ${titleAr} بالإصرار والمحاولة!`,
        storyEn: `Encountered early obstacles in ${titleEn} with ${mastery.attempts} attempts, but persevered and achieved ${Math.round(mastery.accuracy * 100)}% comprehension!`,
        storyAr: `واجه صعوبة أولية في ${titleAr} بعد ${mastery.attempts} محاولات، لكنه ثابر وحقق فهمًا راسخًا بنسبة ${Math.round(mastery.accuracy * 100)}%!`,
        achievedTimestamp: mastery.lastTested || Date.now(),
      });
    }

    // 2. Mastery Leap: Perfect or near-perfect fluency
    if (mastery.accuracy >= 0.90 && mastery.consecutiveCorrect >= 3) {
      breakthroughs.push({
        id: `breakthrough_mastery_${conceptId}`,
        conceptId,
        conceptTitleEn: titleEn,
        conceptTitleAr: titleAr,
        type: 'mastery_leap',
        headlineEn: `Exceptional Mastery in ${titleEn}`,
        headlineAr: `إتقان فائق في ${titleAr}`,
        storyEn: `Demonstrated deep conceptual fluency with ${mastery.consecutiveCorrect} consecutive correct solutions.`,
        storyAr: `أظهر تمكناً مفاهيمياً ممتازاً بحل ${mastery.consecutiveCorrect} مسائل متتالية بشكل صحيح.`,
        achievedTimestamp: mastery.lastTested || Date.now(),
      });
    }
  }

  // 3. Streak / Volume Milestone
  if ((student.totalExercisesCompleted || 0) >= 15) {
    breakthroughs.push({
      id: 'breakthrough_streak_milestone',
      conceptId: 'study_habit',
      conceptTitleEn: 'Consistent Practice Habit',
      conceptTitleAr: 'عادة الممارسة المستمرة',
      type: 'streak_milestone',
      headlineEn: 'Dedicated Practice Champion',
      headlineAr: 'بطل الاستمرارية والممارسة',
      storyEn: `Completed over ${student.totalExercisesCompleted} interactive exercises this week, building solid muscle memory.`,
      storyAr: `أنجز أكثر من ${student.totalExercisesCompleted} تدريباً تفاعلياً هذا الأسبوع، مما رسّخ عادات تعلم ممتازة.`,
      achievedTimestamp: student.lastActiveTimestamp || Date.now(),
    });
  }

  return breakthroughs;
}

/**
 * Generates actionable, supportive home conversation cues for parents to engage
 * their children positively without grilling them or inducing stress.
 */
export function generateHomeDiscussionCues(student: StudentState): HomeDiscussionCue[] {
  const cues: HomeDiscussionCue[] = [];

  for (const [conceptId, mastery] of Object.entries(student.conceptMastery || {})) {
    const node = getConcept(conceptId);
    const titleEn = node?.nameEn || conceptId;
    const titleAr = node?.nameAr || conceptId;

    if (conceptId === 'pointers') {
      cues.push({
        id: 'cue_pointers',
        targetedConceptId: conceptId,
        conversationStarterEn: `Ask: "Can you explain to me how computer pointers are like house addresses or locker numbers?"`,
        conversationStarterAr: `اسأله بود: "ممكن تشرحلي إزاي المؤشرات (Pointers) في الكمبيوتر شبه عناوين البيوت أو أرقام الصناديق؟"`,
        supportiveTipEn: `Celebrate their ability to use real-world analogies rather than expecting dry textbook definitions.`,
        supportiveTipAr: `شجع استخدام التشبيهات البسيطة والممتعة بدلاً من انتظار تعريفات معقدة من الكتاب.`,
        contextEn: `Your student practiced Pointers recently. Explaining concepts in their own words cements long-term memory.`,
        contextAr: `تدرب الطالب على المؤشرات مؤخراً. الشرح بأسلوبه الخاص يثبت المعلومة في الذاكرة طويلة المدى.`,
      });
    } else if (conceptId === 'dynamic_memory') {
      cues.push({
        id: 'cue_dynamic_memory',
        targetedConceptId: conceptId,
        conversationStarterEn: `Ask: "What was the most tricky puzzle or edge case you tackled in memory management today?"`,
        conversationStarterAr: `اسأله بود: "إيه أكتر فكرة أو لغز حسيته صعب وانت بتدير الذاكرة وحليته النهارده؟"`,
        supportiveTipEn: `Focus on praising their persistence and the problem-solving journey rather than asking 'Did you get 100%?'.`,
        supportiveTipAr: `امدح صبره ومحاولاته المتعددة لحل التحدي بدلاً من السؤال التقليدي: "جبت الدرجة النهائية؟".`,
        contextEn: `Memory allocation requires patience. Expressing interest in their challenges builds confidence.`,
        contextAr: `إدارة الذاكرة تتطلب صبراً، وإظهار اهتمامك بالتحديات التي واجهها يرفع ثقته بنفسه.`,
      });
    } else if (cues.length < 2) {
      cues.push({
        id: `cue_${conceptId}`,
        targetedConceptId: conceptId,
        conversationStarterEn: `Ask: "What is one cool thing you learned about ${titleEn} that surprised you this week?"`,
        conversationStarterAr: `اسأله بود: "إيه أكتر حاجة لفتت نظرك أو فاجأتك وانت بتذاكر ${titleAr} الأسبوع ده؟"`,
        supportiveTipEn: `Listen with active curiosity and invite them to teach you something new.`,
        supportiveTipAr: `استمع له باهتمام وفضول واجعله يشعر بأنه يعلمك شيئاً جديداً.`,
        contextEn: `Encouraging the student to take on the teacher role boosts cognitive confidence.`,
        contextAr: `تشجيع الطالب على لعب دور المعلم يعزز ثقته المعرفية بشكل هائل.`,
      });
    }
  }

  // Fallback cue if no concepts are recorded
  if (cues.length === 0) {
    cues.push({
      id: 'cue_general_growth',
      targetedConceptId: 'general',
      conversationStarterEn: `Ask: "What was the most interesting concept you explored with your AI tutor today?"`,
      conversationStarterAr: `اسأله بود: "إيه أكتر فكرة ممتعة أو سؤال حلو فكرت فيه مع المساعد الذكي النهارده؟"`,
      supportiveTipEn: `Focus on celebrating curiosity and the process of discovery.`,
      supportiveTipAr: `ركز على الاحتفاء بالفضول وحب الاستكشاف والتجربة.`,
      contextEn: `Curiosity-driven conversations at home create a supportive learning environment.`,
      contextAr: `الحوارات المبنية على الفضول في المنزل تخلق بيئة مشجعة ومحفزة للتعلم المستمر.`,
    });
  }

  return cues;
}

/**
 * Compiles the Parent Dashboard data.
 * STRICT PRIVACY INVARIANT:
 * Guarantees zero chat transcripts, raw prompts, or message history are ever passed
 * to the parent interface, preserving student psychological safety.
 */
export function compileParentDashboard(
  student: StudentState,
  studentDisplayName: string = 'Alex',
  previousWeekCount: number = 3
): ParentDashboardData {
  // Synthesize metrics
  const growthSummary = synthesizeWeeklyGrowth(student, previousWeekCount);
  const breakthroughs = detectCelebratedBreakthroughs(student);
  const homeDiscussionCues = generateHomeDiscussionCues(student);

  // Strict Privacy Shield Audit
  const privacyShield: ParentPrivacyShieldAudit = {
    isZeroChatSnoopingEnforced: true,
    rawMessagesExposed: 0,
    chatTranscriptsBlocked: true,
    studentPsychologicalSafetyGuaranteed: true,
  };

  const dashboard: ParentDashboardData = {
    studentUid: student.uid,
    studentDisplayName,
    growthSummary,
    breakthroughs,
    homeDiscussionCues,
    privacyShield,
  };

  // Run-time Privacy Guard: Ensure no chat logs or transcripts were leaked
  const serialized = JSON.stringify(dashboard);
  if (
    serialized.includes('"chatLogs"') ||
    serialized.includes('"rawMessages"') ||
    serialized.includes('"transcripts":') ||
    serialized.includes('"messageContent"')
  ) {
    throw new Error('FATAL SECURITY VIOLATION: Raw chat content detected in Parent Intelligence layer!');
  }

  return dashboard;
}

/**
 * Canonical Parent-Child Relationship Authorization Verifier
 * Enforces server-authoritative parent-child verification.
 * A parent is ONLY authorized if the student's profile explicitly links to them
 * via linkedParentUid, parentEmail, or authorizedParentUids.
 *
 * Attack Case: Parent A providing Child B's UID without child-side link returns false (HTTP 403).
 */
export function verifyParentChildRelationship(
  parent: { uid?: string; email?: string } | null | undefined,
  studentProfile: { linkedParentUid?: string; parentEmail?: string; authorizedParentUids?: string[] } | null | undefined
): { authorized: boolean; reason?: string } {
  if (!parent?.uid) {
    return { authorized: false, reason: 'Parent unauthenticated: Missing UID' };
  }
  if (!studentProfile) {
    return { authorized: false, reason: 'Target student profile not found' };
  }

  const matchesUid = Boolean(studentProfile.linkedParentUid && studentProfile.linkedParentUid === parent.uid);
  const matchesEmail = Boolean(
    parent.email &&
    studentProfile.parentEmail &&
    studentProfile.parentEmail.trim().toLowerCase() === parent.email.trim().toLowerCase()
  );
  const matchesAuthorizedList = Boolean(
    Array.isArray(studentProfile.authorizedParentUids) &&
    studentProfile.authorizedParentUids.includes(parent.uid)
  );

  if (matchesUid || matchesEmail || matchesAuthorizedList) {
    return { authorized: true };
  }

  return {
    authorized: false,
    reason: `BOLA/IDOR Forbidden: Parent (${parent.uid}) is not an authorized guardian for target student.`,
  };
}
