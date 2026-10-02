import { EducationLevel } from '../types';

export type AcademicSection = 'goals' | 'gpa' | 'analytics' | 'planner' | 'retention' | 'evaluation';

/**
 * Which academic sections each education level sees:
 *  - University → full set (GPA/CGPA, learning analytics, planner, goals, retention flashcards, pedagogical evaluation).
 *  - Secondary / Professional → goals, planner, retention, evaluation.
 *  - Primary → goals, planner, retention.
 */
export function visibleAcademicSections(level?: EducationLevel): AcademicSection[] {
  switch (level) {
    case 'University':
      return ['goals', 'gpa', 'planner'];
    case 'Professional':
    case 'Secondary':
    case 'Primary':
    default:
      return ['goals', 'planner'];
  }
}

/** True if this education level may access the given academic section. */
export function canAccessSection(level: EducationLevel | undefined, section: AcademicSection): boolean {
  return visibleAcademicSections(level).includes(section);
}
