export type CognitiveLevel = 'Basic' | 'Intermediate' | 'Advanced';
export type UserRole = 'Student' | 'Professional';
export type EducationLevel = 'Primary' | 'Secondary' | 'University' | 'Professional';
export type Field = 'Medicine' | 'Engineering' | 'Business' | 'General' | 'Other';
import type { StudentState } from './types/studentState';
export type AccessibilityMode = 'None' | 'Speech' | 'Visual' | 'Vocal-Deaf' | 'Sign-Only' | 'Motor-Euphonia' | 'Neurodiversity';
export type LanguagePreference = 'English' | 'Arabic' | 'Egyptian Ammiya' | 'French' | 'Spanish' | 'German' | 'Italian' | 'Portuguese' | 'Russian' | 'Chinese' | 'Japanese';
export type AccountPath = 'Graduation Project' | 'Special Needs' | 'Normal';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string; // ISO string for better persistence
  reaction?: 'up' | 'down';
  attachments?: {
    name: string;
    type: string;
    data: string; // Base64
  }[];
  comparisons?: {
    modelName: string;
    content: string;
  }[];
  pedagogyStyle?: PedagogyStyle;
  adaptationReason?: string;
}

export interface ChatThread {
  id: string;
  title: string;
  updatedAt: string;
  lastMessageSnippet?: string; // For sidebar display without loading full history
}

export interface Task {
  id: string;
  threadId: string;
  content: string;
  completed: boolean;
  createdAt: string;
}

export interface StudentMemory {
  enabled: boolean; // Privacy-first default: false
  preferredLanguage: string;
  explanationStyle: string;
  learningGoals: string[];
  knownPreferences: string[];
  explicitConfirmedInfo: string[];
  updatedAt: string; // ISO 8601 string
}

export type PedagogyStyle = 'analogies' | 'technical' | 'scaffolded' | 'socratic';

export interface CognitiveDomainScores {
  fluidReasoning: number;      // 0–100 scaled
  quantitativeLogic: number;   // 0–100 scaled
  workingMemory: number;       // 0–100 scaled
  processingSpeed: number;     // 0–100 scaled
}

export interface IqAssessmentRecord {
  id: string;
  testIndex: number;          // 1, 2, 3...
  date: string;               // ISO date
  iqScore: number;            // Normalized (mean 100, SD 15)
  domainScores: CognitiveDomainScores;
  durationSeconds: number;
  recommendedPersona: 'Foundational' | 'Balanced' | 'Socratic';
}

export interface ConceptMastery {
  conceptId: string;
  conceptName: string;
  domain: string;
  confidenceScore: number;    // 0-100%
  status: 'developing' | 'mastered';
  evidenceCount: number;      // Count of confirming interactions
  lastPracticed: string;      // ISO date
}

export interface LearningIntelligenceProfile {
  masteredConcepts: ConceptMastery[];
  developingConcepts: ConceptMastery[];
  confidenceScore: number;    // Overall 0-100%
  cognitiveStrengths: string[];
  recommendedFocus: string[];
  updatedAt: string;
}

export interface EvaluationRecord {
  id: string;
  topic: string;
  date: string;
  preQuizScore: number;       // 0-100
  postQuizScore: number;      // 0-100
  normalizedGain: number;     // Hake's g: (Post - Pre) / (100 - Pre)
  durationMinutes: number;
}

export interface UserProfile {
  uid: string;
  email: string;
  accountPath?: AccountPath;
  universityEmail?: string;
  disabilityType?: string;
  /** Organization/charity code this user belongs to (e.g. "RESALA"). */
  organization?: string;
  /** Org staff: can view THEIR organization's users inside the disability hub. */
  isOrgManager?: boolean;
  name?: string;
  religion?: string;
  bio?: string;
  level: CognitiveLevel;
  role: UserRole;
  educationLevel: EducationLevel;
  sustainabilityGoal?: string;
  field: Field;
  language?: LanguagePreference;
  accessibilityMode: AccessibilityMode;
  questionScore: number;
  university?: string;
  faculty?: string;
  department?: string;
  work?: string;
  jobTitle?: string;
  iqScore?: number;
  lastQuizDate?: string;
  points: number;
  quizDuration?: number; // in seconds
  onboardingComplete: boolean;
  photoURL?: string;
  questionHistory: { score: number; date: string }[];
  /** @deprecated chatHistory has been migrated to users/{uid}/threads subcollection. Kept as optional for legacy read-path migration only. */
  chatHistory?: Message[];
  chatThreads?: ChatThread[];
  activeThreadId?: string;
  tasks?: Task[];
  lastActiveDate?: string;
  /** ISO 3166-1 alpha-2 country code, stamped from edge geo header or fallback. */
  country?: string;
  /** UID of a parent/guardian this student has explicitly approved — grants that
   *  parent read access under Firestore rules (isVerifiedParent). Set ONLY by the
   *  student themself, only after they approve a pending link request. */
  linkedParentUid?: string;
  /** Alternative to linkedParentUid: any UID in this list also passes isVerifiedParent. */
  authorizedParentUids?: string[];
  /** Display info for every approved caregiver (parent/specialist), kept in sync with
   *  authorizedParentUids so CaregiverHub can list & individually revoke each one
   *  without an extra lookup. linkedParentUid holds the first ("primary") uid for
   *  back-compat with any code that still reads only that single field. */
  linkedCaregivers?: { uid: string; name: string; email: string; linkedAt: number }[];
  /** Alternative: a parent whose verified auth email matches this also passes isVerifiedParent. */
  parentEmail?: string;
  /** Canonical learning/cognitive state snapshot, used by institution & parent dashboards. */
  studentState?: StudentState;
  /** UID of the student this parent/guardian account is linked to. */
  linkedChildUid?: string;
  city?: string | null;
  region?: string | null;
  lastLoginAt?: string;
  lastLoginCountry?: string;
  lastLoginCity?: string | null;
  lastLoginDevice?: string;
  lastIp?: string | null;
  /**
   * Phase 2: Cognify Memory (Transparent Student Memory).
   * Stored under users/{userId}/memory/config in Firestore.
   */
  memory?: StudentMemory;
  /**
   * Phase 3: Adaptive Pedagogy Style Preference
   */
  preferredPedagogyStyle?: PedagogyStyle;
  /**
   * Phase 4: Cognitive Architecture & Scientific IQ Assessment
   */
  cognitiveLevel?: CognitiveLevel;
  cognitiveDomains?: CognitiveDomainScores;
  iqAssessmentHistory?: IqAssessmentRecord[];
  lastIqTestDate?: string;
  nextEligibleIqDate?: string;
  dailyGymStreak?: number;
  lastGymDate?: string;
  gymPoints?: number;
  learningIntelligence?: LearningIntelligenceProfile;
  /**
   * Phase 5: Empirical Evaluation Engine
   */
  evaluationRecords?: EvaluationRecord[];
  /**
   * Eye-tracking / auto-scan tuning, synced so it follows the student.
   *
   * This used to live only in localStorage, which meant a student who had their
   * sensitivity, dwell time and scan speed tuned on one tablet got the raw
   * defaults on any other device — and lost the tuning entirely if the browser
   * data was cleared. For someone who needs the settings calibrated to their own
   * motor range, re-tuning from scratch is not a minor inconvenience.
   */
  headTrackingConfig?: HeadTrackingConfig;
  /**
   * Vocal sound triggers, tuned to this student's own voice.
   *
   * The pitch a student can actually produce is personal — a breathy 140Hz hum
   * never matches a target fixed at 220Hz, and for a student who cannot blink
   * reliably these triggers are their click. Synced for the same reason as the
   * head config: the calibration has to follow them between devices.
   */
  vocalTriggers?: VocalSoundTriggerConfig[];
  // Granted via the Admin Dashboard. Permanent "owner" admins are defined by
  // email in the code; this flag is for admins promoted at runtime.
  isAdmin?: boolean;
  // Super admin granted at runtime from the Admin Dashboard. Founder super
  // admins are still defined by email in roles.ts and can never be revoked —
  // that's the lockout protection. Only a super admin may write this field
  // (enforced in firestore.rules, not just the UI).
  isSuperAdmin?: boolean;
  /** Timestamp when a Super Admin requested/sent a password reset email for this user. */
  passwordResetRequestedAt?: string;
  /**
   * Labeled snapshot descriptions saved from the Visual Companion (blind
   * users: "remember this as..."). Kept short and text-only — no images are
   * stored, just what the person asked us to remember about it.
   */
  visionMemories?: VisionMemory[];
  /**
   * Dedicated spatial memory records tracking physical object locations,
   * surfaces, rooms, and historical transitions.
   */
  spatialMemories?: SpatialObjectRecord[];
  /**
   * Universal Accessibility Passport: unified user settings across all disability modules.
   */
  accessibilityPassport?: AccessibilityPassport;
}

export interface VisionMemory {
  id: string;
  label: string;        // what the user called it, e.g. "أحمد" or "دوا الضغط"
  description: string;  // the AI's description at the moment it was saved
  createdAt: string;    // ISO date string
  memoryType?: 'object' | 'person' | 'document' | 'currency' | 'place';
  imageUrl?: string;
}

export interface PECSCard {
  id: string;
  labelEn: string;
  labelAr: string;
  labelFr?: string;
  category: 'needs' | 'emotions' | 'food' | 'activities' | 'places' | 'routine' | 'feelings' | 'play' | 'medical';
  iconName?: string;
  icon?: string;
  audioPhraseAr?: string;
  audioPhraseEn?: string;
  phraseAr?: string;
  phraseEn?: string;
  phraseFr?: string;
  color: string;
}

export interface SensoryEmotionLog {
  id: string;
  timestamp: string;
  level: 'calm' | 'happy' | 'overwhelmed' | 'anxious' | 'tired' | 'frustrated';
  intensity: number; // 1-5
  sensoryTrigger?: string;
  comfortActivityUsed?: string;
}

export interface AccessibilityPassport {
  primaryMode: AccessibilityMode;
  /** Display alias for primaryMode, used by CaregiverHub's summary card. */
  primaryCategory?: AccessibilityMode | 'Multiple';
  highContrast: boolean;
  dyslexiaFont: boolean;
  hapticFeedback: boolean;
  autoSpeak: boolean;
  audioSpeed: number; // 0.75 - 1.5
  emergencyPhone?: string;
  emergencyName?: string;
  allowCameraTriggers: boolean;
  visualSupport?: {
    highContrast?: boolean;
    autoSpeechReadout?: boolean;
    hapticAssistance?: boolean;
  };
  hearingSupport?: {
    visualAcousticRadar?: boolean;
    reverseSignToSpeech?: boolean;
    flashingAlerts?: boolean;
  };
  motorSupport?: {
    trackingMode?: string;
    dwellDurationMs?: number;
    emergencySosEnabled?: boolean;
  };
  neurodiversitySupport?: {
    dyslexiaFont?: boolean;
    readingRuler?: boolean;
    sensoryRegulation?: boolean;
  };
}

export interface SpatialObjectRecord {
  id: string;
  uid: string;
  objectName: string;
  category: 'remote' | 'keys' | 'glasses' | 'medication' | 'phone' | 'cup' | 'bag' | 'document' | 'other';
  room?: string;
  surface?: string;
  relativePosition?: {
    direction?: 'left' | 'right' | 'center' | 'top' | 'bottom';
    clockPosition?: string;
    distance?: 'near' | 'medium' | 'far';
  };
  lastSeenTimestamp: number;
  lastSeenIso: string;
  confidence: number;
  source: 'camera_auto' | 'user_confirmed';
  descriptionSnippet?: string;
  history?: {
    timestamp: number;
    room?: string;
    surface?: string;
    direction?: string;
  }[];
}

// ─── PATCH: Add these types to src/types.ts ───────────────────────────────────
// Place AFTER the existing UserProfile interface

export type GoalPriority = 'low' | 'medium' | 'high';
export type GoalStatus = 'not-started' | 'in-progress' | 'completed';

export interface Milestone {
  id: string;
  title: string;
  completed: boolean;
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  priority: GoalPriority;
  status: GoalStatus;
  progress: number;        // 0–100, auto-calculated from milestones
  deadline: string;        // ISO date string (YYYY-MM-DD)
  createdAt: string;       // ISO date string
  milestones: Milestone[];
}

// ─── GPA Calculator ──────────────────────────────────────────────────────────
export interface Course {
  id: string;
  name: string;
  credits: number;         // credit hours
  grade: string;           // letter grade key (A, A-, B+, ... F)
  semester: string;        // e.g. "Fall 2026" — groups courses for GPA vs CGPA
  createdAt: string;       // ISO date string
}

// ─── Attendance Tracker ──────────────────────────────────────────────────────
export interface AttendanceSubject {
  id: string;
  name: string;
  attended: number;        // sessions attended
  absent: number;          // sessions missed
  totalPlanned: number;    // total scheduled sessions for the course (0 = unknown)
  threshold: number;       // required attendance % (e.g. 75)
  createdAt: string;
}

// ─── Calendar ────────────────────────────────────────────────────────────────
export type CalendarEventType = 'event' | 'class' | 'exam' | 'task' | 'reminder' | 'personal';
export interface CalendarEvent {
  id: string;
  title: string;
  date: string;            // ISO date (YYYY-MM-DD)
  time?: string;           // optional HH:MM
  type: CalendarEventType;
  note?: string;
  createdAt: string;
}

// ─── Academic Planner ────────────────────────────────────────────────────────
export type PlannerTaskType = 'assignment' | 'quiz' | 'midterm' | 'final' | 'project' | 'other';
export interface PlannerTask {
  id: string;
  title: string;
  type: PlannerTaskType;
  course: string;          // optional course/subject name ('' if none)
  dueDate: string;         // ISO date string (YYYY-MM-DD)
  completed: boolean;
  createdAt: string;
}

// ─── Motor & Euphonia (Quadriplegia Assistive System) ─────────────────────────
export type VocalTriggerAction =
  | 'select'
  | 'next'
  | 'previous'
  | 'back'
  | 'ask-ai'
  | 'speak-aloud'
  | 'emergency'
  | 'clear';

export interface VocalSoundTriggerConfig {
  id: string;
  name: string;
  nameAr: string;
  targetFrequencyHz: number; // Center frequency (e.g. 250Hz for low hum, 1200Hz for high tone)
  minEnergyThreshold: number; // Volume threshold 0-1
  action: VocalTriggerAction;
  enabled: boolean;
}

export interface HeadTrackingConfig {
  sensitivity: number; // 0.5 to 3.0
  dwellTimeMs: number; // 800ms to 3000ms
  smoothing: number; // 0.1 to 0.9
  trackingMode?: 'iris' | 'nose' | 'hybrid'; // Eye Iris Gaze vs Head Nose vs Hybrid
  facialTriggersEnabled: boolean; // Smile / mouth open triggers click
  smileThreshold: number; // 0.3 to 0.9
  mouthOpenThreshold: number; // 0.3 to 0.9
  // Single-switch auto scanning: the app walks the selectable targets itself
  // and the student makes ONE action to choose. The fallback for users who
  // cannot drive the gaze pointer at all.
  autoScanEnabled: boolean;
  autoScanIntervalMs: number; // 600ms to 5000ms
  /** row-column asks for a row first, then an item in it: two choices instead
   *  of walking all ~40 keys. linear walks every target in order. */
  autoScanMode?: 'linear' | 'row-column';
}

export interface AACCardItem {
  id: string;
  category: 'quick' | 'study' | 'needs' | 'ai' | 'navigation' | 'contacts';
  labelEn: string;
  labelAr: string;
  icon: string;
  phraseEn: string;
  phraseAr: string;
  actionPayload?: string;
  isAiAction?: boolean;
}

export interface LoginHistoryRecord {
  id: string;
  timestamp: string;
  country: string;
  countryName?: string;
  region?: string | null;
  city?: string | null;
  ip?: string | null;
  device?: string;
  userAgent?: string;
}

// ─── Next-Gen Academic OS: Mock Exams, Dynamic Scheduling, Citations ──────────

export interface MockExamQuestion {
  id: string;
  type: 'mcq' | 'short' | 'essay';
  question: string;
  options?: string[]; // for mcq
  correctAnswer?: string;
  rubricCriteria: string[]; // key grading points for essays/short answers
  points: number;
}

export interface QuestionGradingResult {
  questionId: string;
  studentAnswer: string;
  scoreAwarded: number;
  maxScore: number;
  modelAnswer: string;
  strengths: string[];
  missedKeywords: string[];
  rubricFeedback: string;
}

export interface MockExamSubmission {
  id: string;
  examTitle: string;
  course: string;
  topic: string;
  totalScore: number;
  maxPossibleScore: number;
  percentage: number;
  gpaEquivalent: string;
  timeSpentSeconds: number;
  createdAt: string;
  results: QuestionGradingResult[];
}

export interface DynamicStudyTopic {
  id: string;
  course: string;
  title: string;
  difficulty: 1 | 2 | 3 | 4 | 5; // 1 = easiest, 5 = hardest
  estimatedHours: number;
  completed: boolean;
}

export interface DynamicStudySlot {
  id: string;
  date: string; // YYYY-MM-DD
  course: string;
  topicTitle: string;
  hours: number;
  slotType: 'new' | 'review' | 'mock-exam';
  completed: boolean;
  spacedRepetitionInterval?: number; // Day 1, 3, 7, 14
}

export interface DynamicStudyPlan {
  id: string;
  examDate: string;
  targetCourses: string[];
  topics: DynamicStudyTopic[];
  dailySlots: DynamicStudySlot[];
  lastRebalancedAt?: string;
}

export interface LectureDigestResult {
  id: string;
  title: string;
  course?: string;
  capsuleSummary: string; // The distilled bottom line in 1-2 sharp sentences
  keyFormulasOrDefinitions: string[];
  actionableInsights: string[];
  predictedQuestions: {
    question: string;
    type: 'mcq' | 'essay';
    expectedAnswer: string;
    examSignificance: 'high' | 'medium' | 'frequent';
  }[];
  conceptGraph: {
    id: string;
    label: string;
    category: string;
    connections: string[];
  }[];
  createdAt: string;
}

export interface SocraticDialogTurn {
  id: string;
  speaker: 'ai' | 'student';
  text: string;
  timestamp: string;
  feynmanEvaluation?: {
    clarityScore: number; // 1-10
    simplifiedTerms: string[];
    missingConcepts: string[];
    followUpPrompt: string;
  };
}

export interface CitationItem {
  id: string;
  sourceType: 'book' | 'article' | 'website' | 'paper';
  title: string;
  authors: string[];
  year: string;
  publisherOrJournal?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  url?: string;
  doi?: string;
  formattedApa?: string;
  formattedIeee?: string;
  formattedHarvard?: string;
  formattedMla?: string;
}

export interface ReverseGpaPlan {
  targetCgpa: number;
  neededSemesterGpa: number;
  plannedCredits: number;
  isPossible: boolean;
  maxAchievableCgpa: number;
  recommendedGradeDistribution: {
    grade: string;
    credits: number;
    courseCount: number;
    description: string;
  }[];
  strategicAdvice: string;
}

export interface GradeRescueCourse {
  courseName: string;
  currentWorkGrade: number; // e.g. 38
  maxWorkGrade: number;     // e.g. 50
  finalExamMax: number;     // e.g. 50
  targetLetter: string;     // e.g. 'A'
  minFinalScoreRequired: number;
  isAchievable: boolean;
  status: 'safe' | 'warning' | 'critical';
}
