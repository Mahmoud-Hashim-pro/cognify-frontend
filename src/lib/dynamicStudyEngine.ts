/**
 * Dynamic Study Engine
 * 
 * - Generates intelligent, balanced study schedules leading up to exams.
 * - Auto-rebalances workload when tasks or days are missed.
 * - Injects Spaced Repetition (Ebbinghaus curve) review slots.
 */

import { DynamicStudyPlan, DynamicStudySlot, DynamicStudyTopic } from '../types';

export function parseLocalDate(isoDate: string): Date {
  if (!isoDate) return new Date();
  const [y, m, d] = isoDate.split(/[-/T]/).map(Number);
  if (!y || !m || !d) return new Date(isoDate);
  return new Date(y, m - 1, d);
}

export function formatDateIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Get list of consecutive dates (inclusive) between start and end */
export function getAvailableDates(startDate: Date, endDate: Date): string[] {
  const dates: string[] = [];
  const curr = new Date(startDate);
  curr.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  while (curr <= end) {
    dates.push(formatDateIso(curr));
    curr.setDate(curr.getDate() + 1);
  }
  return dates;
}

/**
 * Generate a comprehensive, balanced dynamic study plan.
 */
export function createDynamicStudyPlan(
  examDate: string,
  topics: DynamicStudyTopic[],
  targetCourses: string[] = [],
  dailyHoursCap: number = 4
): DynamicStudyPlan {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetDate = parseLocalDate(examDate);
  targetDate.setHours(0, 0, 0, 0);

  const availableDates = getAvailableDates(today, targetDate);
  const slots: DynamicStudySlot[] = [];

  if (availableDates.length === 0 || topics.length === 0) {
    return {
      id: `plan-${Date.now()}`,
      examDate,
      targetCourses,
      topics,
      dailySlots: [],
      lastRebalancedAt: new Date().toISOString(),
    };
  }

  // Reserve the last 1-2 days for comprehensive Mock Exam & final review
  const studyDates = availableDates.length > 2 ? availableDates.slice(0, -2) : availableDates;
  const mockDates = availableDates.length > 2 ? availableDates.slice(-2) : [availableDates[availableDates.length - 1]];

  // Sort topics by difficulty descending (hardest first to master them early)
  const sortedTopics = [...topics].sort((a, b) => b.difficulty - a.difficulty);

  // Distribute new topic learning slots
  let dateIdx = 0;
  for (const topic of sortedTopics) {
    const assignedDate = studyDates[dateIdx % studyDates.length];
    const slotId = `slot-${topic.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    slots.push({
      id: slotId,
      date: assignedDate,
      course: topic.course,
      topicTitle: topic.title,
      hours: Math.min(dailyHoursCap, topic.estimatedHours || 2),
      slotType: 'new',
      completed: topic.completed || false,
    });

    // Add spaced repetition review (3 days later if within study period)
    const topicDate = parseLocalDate(assignedDate);
    const reviewDate = new Date(topicDate);
    reviewDate.setDate(reviewDate.getDate() + 3);
    const reviewDateStr = formatDateIso(reviewDate);

    if (availableDates.includes(reviewDateStr) && reviewDateStr < mockDates[0]) {
      slots.push({
        id: `sr-${slotId}`,
        date: reviewDateStr,
        course: topic.course,
        topicTitle: `مراجعة استرجاع نشط: ${topic.title}`,
        hours: 1,
        slotType: 'review',
        completed: false,
        spacedRepetitionInterval: 3,
      });
    }

    dateIdx++;
  }

  // Add final mock exam slots
  for (const mDate of mockDates) {
    slots.push({
      id: `mock-${Date.now()}-${mDate}`,
      date: mDate,
      course: targetCourses[0] || 'الامتحان النهائي',
      topicTitle: 'محاكاة امتحان شامل وتصحيح ذكي (Comprehensive Mock Exam)',
      hours: 2,
      slotType: 'mock-exam',
      completed: false,
    });
  }

  // Sort slots by date ascending
  slots.sort((a, b) => a.date.localeCompare(b.date));

  return {
    id: `plan-${Date.now()}`,
    examDate,
    targetCourses,
    topics,
    dailySlots: slots,
    lastRebalancedAt: new Date().toISOString(),
  };
}

/**
 * 1-Click Auto-Rebalance
 * 
 * Automatically shifts uncompleted overdue/past slots into the future
 * smoothly across the remaining days without overburdening any single day.
 */
export function rebalanceStudyPlan(
  plan: DynamicStudyPlan,
  todayStr: string = formatDateIso(new Date()),
  dailyHoursCap: number = 4
): DynamicStudyPlan {
  const today = parseLocalDate(todayStr);
  const examDate = parseLocalDate(plan.examDate);

  const futureDates = getAvailableDates(today, examDate);
  if (futureDates.length === 0) {
    return plan;
  }

  // Separate completed vs pending
  const completedSlots: DynamicStudySlot[] = [];
  const pendingSlotsToReschedule: DynamicStudySlot[] = [];

  for (const slot of plan.dailySlots) {
    if (slot.completed) {
      completedSlots.push(slot);
    } else {
      pendingSlotsToReschedule.push(slot);
    }
  }

  // Calculate current allocated hours per future date
  const hoursPerDate: Record<string, number> = {};
  for (const d of futureDates) {
    hoursPerDate[d] = 0;
  }

  // Keep completed slots in their place
  for (const slot of completedSlots) {
    if (hoursPerDate[slot.date] !== undefined) {
      hoursPerDate[slot.date] += slot.hours;
    }
  }

  // Re-distribute pending slots to the dates with lowest existing load
  const rescheduledSlots: DynamicStudySlot[] = [];
  for (const slot of pendingSlotsToReschedule) {
    // Find date with minimum hours
    let minDate = futureDates[0];
    let minHours = Infinity;

    for (const d of futureDates) {
      const h = hoursPerDate[d] || 0;
      if (h < minHours) {
        minHours = h;
        minDate = d;
      }
    }

    // Assign to minDate
    hoursPerDate[minDate] = (hoursPerDate[minDate] || 0) + slot.hours;
    rescheduledSlots.push({
      ...slot,
      date: minDate,
    });
  }

  const allSlots = [...completedSlots, ...rescheduledSlots].sort((a, b) => a.date.localeCompare(b.date));

  return {
    ...plan,
    dailySlots: allSlots,
    lastRebalancedAt: new Date().toISOString(),
  };
}

const STORAGE_KEY = 'cognify_dynamic_study_plan';

export function loadSavedPlan(): DynamicStudyPlan | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function persistPlan(plan: DynamicStudyPlan): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
  } catch (err) {
    console.error('Failed to persist study plan', err);
  }
}
