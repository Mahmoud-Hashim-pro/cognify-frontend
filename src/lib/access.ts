import { UserProfile, AccountPath } from '../types';

// The top-level "sections" a user is enrolled into at sign-up (the Login path
// selector). Access is scoped by this so nobody wanders into another section's
// experience without belonging to it.
export type AppView =
  | 'chat' | 'learning' | 'profile' | 'settings' | 'video' | 'disability'
  | 'admin' | 'goals' | 'gpa' | 'analytics' | 'planner' | 'support' | 'memory'
  | 'gym' | 'iq' | 'institution' | 'france' | 'privacy' | 'intelligence'
  | 'teacher' | 'parent' | 'privacy_security' | 'evaluation' | 'ai_quality'
  | 'resilience' | 'tenancy' | 'developer_api' | 'retention';

/** A user counts as an accessibility user if they picked the Special Needs path
 *  OR have a real accessibility mode enabled. */
export function isAccessibilityUser(profile: UserProfile | null | undefined): boolean {
  if (!profile) return false;
  return profile.accountPath === 'Special Needs'
    || (!!profile.accessibilityMode && profile.accessibilityMode !== 'None');
}

/** The section label for a user (used by the admin directory). */
export function sectionOf(profile: Pick<UserProfile, 'accountPath'>): AccountPath {
  return profile.accountPath || 'Normal';
}

/**
 * Can this profile open the given view?
 * - Admins bypass section scoping and can open all views.
 * - The institution hub requires admin privileges or organization manager role.
 * - Specialized enterprise/developer views require admin privileges.
 * - Standard learning, communication, and accessibility views are inclusive
 *   and adapt dynamically to the user's educational stage and accessibility profile.
 */
export function canAccessView(
  profile: UserProfile | null | undefined,
  view: AppView,
  isAdmin: boolean,
): boolean {
  if (!profile) return false;
  if (view === 'admin') return isAdmin;
  if (view === 'institution') return isAdmin || profile.isOrgManager === true;
  if (['resilience', 'tenancy', 'developer_api', 'ai_quality'].includes(view)) return isAdmin;
  if (isAdmin) return true;

  return true;
}

/** Where to send a user who hit a view they can't access. */
export function homeViewFor(profile: UserProfile | null | undefined): AppView {
  return isAccessibilityUser(profile) ? 'disability' : 'chat';
}
