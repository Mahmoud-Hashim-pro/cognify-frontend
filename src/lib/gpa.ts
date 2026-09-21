/**
 * GPA Calculator helpers.
 *
 * - Grade → quality points on a 4.0 scale.
 * - Weighted GPA (one semester) and CGPA (all courses).
 * - What-if projection (add a hypothetical course or change a grade).
 *
 * Courses are stored per user: users/{uid}/courses/{courseId}
 * (same subcollection pattern as goals/threads).
 */

import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, cleanDataForFirestore } from './firebase';
import { Course, ReverseGpaPlan, GradeRescueCourse } from '../types';

/** Letter grade → quality points (matches the university's official 4.0 scale). */
export const GRADE_POINTS: Record<string, number> = {
  'A+': 4.0, 'A': 3.7, 'A-': 3.4,
  'B+': 3.2, 'B': 3.0, 'B-': 2.8,
  'C+': 2.6, 'C': 2.4, 'C-': 2.2,
  'D+': 2.0, 'D': 1.5, 'D-': 1.0,
  'F': 0.0,
};

export const GRADE_OPTIONS = Object.keys(GRADE_POINTS);

/** Weighted GPA for a list of courses (credits × points / credits). */
export function calculateGPA(courses: Course[]): number {
  let totalCredits = 0;
  let totalPoints = 0;
  for (const c of courses) {
    const pts = GRADE_POINTS[c.grade];
    if (pts === undefined || !c.credits) continue;
    totalCredits += c.credits;
    totalPoints += pts * c.credits;
  }
  if (!totalCredits) return 0;
  return Math.round((totalPoints / totalCredits) * 100) / 100;
}

/** CGPA across every course (all semesters). */
export function calculateCGPA(courses: Course[]): number {
  return calculateGPA(courses);
}

/** Distinct semesters, most-recently-added first. */
export function semestersOf(courses: Course[]): string[] {
  const seen: string[] = [];
  for (const c of courses) {
    const s = c.semester || 'Unspecified';
    if (!seen.includes(s)) seen.push(s);
  }
  return seen;
}

/** Total credit hours counted toward the GPA. */
export function totalCredits(courses: Course[]): number {
  return courses.reduce((sum, c) => sum + (GRADE_POINTS[c.grade] !== undefined ? c.credits || 0 : 0), 0);
}

/**
 * What-if: projected CGPA if `courseId`'s grade became `newGrade`
 * (or, when courseId is null, if a hypothetical course were added).
 */
export function projectCGPA(
  courses: Course[],
  change: { courseId: string | null; grade: string; credits: number },
): number {
  if (change.courseId) {
    const next = courses.map((c) =>
      c.id === change.courseId ? { ...c, grade: change.grade } : c,
    );
    return calculateCGPA(next);
  }
  const hypothetical: Course = {
    id: '__whatif__',
    name: 'Hypothetical',
    credits: change.credits,
    grade: change.grade,
    semester: 'What-if',
    createdAt: new Date().toISOString(),
  };
  return calculateCGPA([...courses, hypothetical]);
}

// ─── Firestore CRUD ──────────────────────────────────────────────────────────

const coursesCol = (uid: string) => collection(db, `users/${uid}/courses`);
const courseDoc = (uid: string, id: string) => doc(db, `users/${uid}/courses/${id}`);

export function subscribeToCourses(
  uid: string,
  onUpdate: (courses: Course[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const path = `users/${uid}/courses`;
  try {
    const q = query(coursesCol(uid), orderBy('createdAt', 'desc'));
    return onSnapshot(
      q,
      (snap) => onUpdate(snap.docs.map((d) => d.data() as Course)),
      (err) => {
        handleFirestoreError(err, OperationType.LIST, path);
        onError?.(err);
      },
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
    return () => {};
  }
}

export async function saveCourse(uid: string, course: Course): Promise<void> {
  const path = `users/${uid}/courses/${course.id}`;
  try {
    await setDoc(courseDoc(uid, course.id), cleanDataForFirestore(course));
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function deleteCourse(uid: string, id: string): Promise<void> {
  const path = `users/${uid}/courses/${id}`;
  try {
    await deleteDoc(courseDoc(uid, id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

// ─── Reverse GPA Target Solver & Grade Rescue ────────────────────────────────

export function solveReverseGpaTarget(
  currentCgpa: number,
  completedCredits: number,
  targetCgpa: number,
  plannedCredits: number = 15
): ReverseGpaPlan {
  const safeCredits = Math.max(1, plannedCredits);
  const currentPoints = (completedCredits || 0) * (currentCgpa || 0);
  const totalFutureCredits = (completedCredits || 0) + safeCredits;
  const targetTotalPoints = totalFutureCredits * targetCgpa;
  const neededPoints = targetTotalPoints - currentPoints;
  const neededSemesterGpa = Math.round((neededPoints / safeCredits) * 100) / 100;

  const maxAchievablePoints = currentPoints + (safeCredits * 4.0);
  const maxAchievableCgpa = Math.round((maxAchievablePoints / totalFutureCredits) * 100) / 100;
  const isPossible = neededSemesterGpa <= 4.0;

  // Compute recommended grade distribution (assuming 3-credit courses)
  const numCourses = Math.max(1, Math.round(safeCredits / 3));
  const distributions: { grade: string; credits: number; courseCount: number; description: string }[] = [];

  if (isPossible) {
    if (neededSemesterGpa >= 3.7) {
      distributions.push({
        grade: 'A / A+',
        credits: safeCredits,
        courseCount: numCourses,
        description: 'تحقيق امتياز (A) في جميع مواد الفصل القادم بدون أي تعثر.',
      });
    } else if (neededSemesterGpa >= 3.3) {
      const highCount = Math.ceil(numCourses * 0.65);
      const midCount = numCourses - highCount;
      distributions.push({
        grade: 'A',
        credits: highCount * 3,
        courseCount: highCount,
        description: `${highCount} مواد بتقدير A (ممتاز)`,
      });
      distributions.push({
        grade: 'B+',
        credits: midCount * 3,
        courseCount: midCount,
        description: `${midCount} مواد بتقدير B+ (جيد جداً مرتفع)`,
      });
    } else if (neededSemesterGpa >= 3.0) {
      const bPlusCount = Math.ceil(numCourses * 0.5);
      const bCount = numCourses - bPlusCount;
      distributions.push({
        grade: 'B+',
        credits: bPlusCount * 3,
        courseCount: bPlusCount,
        description: `${bPlusCount} مواد بتقدير B+`,
      });
      distributions.push({
        grade: 'B',
        credits: bCount * 3,
        courseCount: bCount,
        description: `${bCount} مواد بتقدير B`,
      });
    } else {
      distributions.push({
        grade: 'B / C+',
        credits: safeCredits,
        courseCount: numCourses,
        description: 'الحفاظ على تقدير جيد (B أو C+) في جميع المواد كافٍ تماماً لتحقيق هدفك.',
      });
    }
  }

  let strategicAdvice = '';
  if (!isPossible) {
    strategicAdvice = `المعدل المستهدف (${targetCgpa.toFixed(2)}) يتجاوز الحد الأقصى الرياضي الممكن خلال (${safeCredits}) ساعة فقط. أقصى معدل يمكنك الوصول إليه هذا الفصل هو (${maxAchievableCgpa.toFixed(2)}). يمكنك تجزئة الهدف على فصلين إضافيين لتسهيل الوصول إليه!`;
  } else if (neededSemesterGpa >= 3.7) {
    strategicAdvice = `للوصول لهدفك تحتاج معدل فصلي مرتفع جداً (${neededSemesterGpa.toFixed(2)}). ننصحك بالتركيز الشديد في أعمال السنة والكويزات من الأسبوع الأول وتجنب أي تسويف.`;
  } else if (neededSemesterGpa >= 3.0) {
    strategicAdvice = `هدفك واقعي وقابل للتحقيق بدرجة عالية بمعدل فصلي مطلوب (${neededSemesterGpa.toFixed(2)}). توزيع الجهد بين المواد ومتابعة محاكي الامتحانات يضمن لك الوصول بأمان.`;
  } else {
    strategicAdvice = `أنت في وضع ممتاز! تحتاج فقط إلى الحفاظ على وتيرة دراسية منتظمة بمعدل فصلي (${neededSemesterGpa.toFixed(2)}) لتحقيق هدفك وتجاوزه.`;
  }

  return {
    targetCgpa,
    neededSemesterGpa: Math.max(0, neededSemesterGpa),
    plannedCredits: safeCredits,
    isPossible,
    maxAchievableCgpa,
    recommendedGradeDistribution: distributions,
    strategicAdvice,
  };
}

export const GRADE_THRESHOLDS: Record<string, number> = {
  'A+': 95,
  'A': 90,
  'B+': 85,
  'B': 80,
  'C+': 75,
  'C': 70,
  'D': 60,
};

export function calculateGradeRescue(
  courseName: string,
  currentWorkGrade: number,
  maxWorkGrade: number,
  finalExamMax: number,
  targetLetter: string = 'A'
): GradeRescueCourse {
  const targetThreshold = GRADE_THRESHOLDS[targetLetter] || 90;
  // Total maximum scale usually 100
  const totalCourseMax = maxWorkGrade + finalExamMax;
  const scaledTargetPoints = (targetThreshold / 100) * totalCourseMax;

  const pointsNeededInFinal = Math.max(0, scaledTargetPoints - currentWorkGrade);
  const roundedNeeded = Math.round(pointsNeededInFinal * 10) / 10;
  const isAchievable = roundedNeeded <= finalExamMax;

  const ratio = roundedNeeded / (finalExamMax || 1);
  let status: 'safe' | 'warning' | 'critical' = 'safe';
  if (!isAchievable || ratio > 0.85) {
    status = 'critical';
  } else if (ratio > 0.70) {
    status = 'warning';
  }

  return {
    courseName,
    currentWorkGrade,
    maxWorkGrade,
    finalExamMax,
    targetLetter,
    minFinalScoreRequired: roundedNeeded,
    isAchievable,
    status,
  };
}

