import { UserProfile } from "../types";

// ── Access tiers (single source of truth — keep in sync with firestore.rules) ──
//
//   Super Admin  → full access + the ONLY tier that can promote/demote admins
//                  AND grant/revoke super admin.
//   Admin        → full access to the dashboard, but CANNOT change any rights.
//   Normal user  → no access to the dashboard at all.
//
// Super admin comes from EITHER of two places:
//   1. FOUNDER_SUPERADMIN_EMAILS below — hardcoded, and can NEVER be revoked
//      from the UI. This is the lockout protection: if every runtime super
//      admin were demoted, these accounts can still get back in without a
//      code deploy.
//   2. The `isSuperAdmin` flag on the user's Firestore document — granted and
//      revoked from the Admin Dashboard by any super admin.
//
// The email-based ADMIN_EMAILS are permanent admins (can't be demoted here).

/**
 * Environment variable overrides (allows decoupling founder identities in public repositories)
 * Reads VITE_FOUNDER_SUPERADMIN_EMAILS / VITE_ADMIN_EMAILS if configured.
 */
const getEnvEmails = (key: string, fallback: string[]): string[] => {
  try {
    let val: string | undefined;
    if (typeof import.meta !== 'undefined' && (import.meta as any).env?.[key]) {
      val = (import.meta as any).env[key];
    } else if (typeof process !== 'undefined' && process.env?.[key]) {
      val = process.env[key];
    }
    if (val && typeof val === 'string') {
      return val.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
    }
  } catch {
    // Fall back to defaults
  }
  return fallback;
};

/** Founder super admins — immutable, fallback protected. */
export const FOUNDER_SUPERADMIN_EMAILS = getEnvEmails('VITE_FOUNDER_SUPERADMIN_EMAILS', [
  'modyhashim2006@gmail.com',
  'pro.mahmoud.h@gmail.com',
]);

/** @deprecated kept as an alias so existing imports keep working. */
export const SUPERADMIN_EMAILS = FOUNDER_SUPERADMIN_EMAILS;

export const ADMIN_EMAILS = getEnvEmails('VITE_ADMIN_EMAILS', [
  'its.alkhateeb@gmail.com',
  'esraahosni8@gmail.com',
  'audit.test.student2026@gmail.com',
]);

/** Optional revoked/blocked super-admin emails via environment variables */
export const BLOCKED_SUPERADMIN_EMAILS = getEnvEmails('VITE_BLOCKED_SUPERADMIN_EMAILS', []);

export const norm = (email?: string) => (email || '').toLowerCase().trim();

/** Hardcoded founder super admin — the tier that can never be revoked. */
export const isFounderSuperAdmin = (email?: string) => FOUNDER_SUPERADMIN_EMAILS.includes(norm(email));

/** Permanent (email-based) admin. */
export const isPermanentAdmin = (email?: string) => ADMIN_EMAILS.includes(norm(email));

const getPrimaryOwner = (): string => {
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_PRIMARY_OWNER_EMAIL) {
      return (import.meta as any).env.VITE_PRIMARY_OWNER_EMAIL;
    }
    if (typeof process !== 'undefined' && process.env?.VITE_PRIMARY_OWNER_EMAIL) {
      return process.env.VITE_PRIMARY_OWNER_EMAIL;
    }
  } catch {}
  return 'modyhashim2006@gmail.com';
};

/**
 * Security, DevTools telemetry stream, and Database Operations Hub are strictly restricted
 * to the primary founder account.
 */
export const isSecurityAuditsOwner = (email?: string) => norm(email) === norm(getPrimaryOwner());
export const isDatabaseHubOwner = (email?: string) => norm(email) === norm(getPrimaryOwner());

/**
 * Super admin = Custom Claims role check (primary: request.auth.token.role == 'superadmin')
 * OR founder (by env/email) OR granted at runtime via the isSuperAdmin flag.
 */
export const isSuperAdminUser = (u?: (Partial<UserProfile> & { customClaims?: { role?: string } }) | null) => {
  if (!u) return false;
  if (BLOCKED_SUPERADMIN_EMAILS.includes(norm(u.email))) return false;
  if (u.customClaims?.role === 'superadmin') return true;
  return isFounderSuperAdmin(u.email) || u.isSuperAdmin === true;
};

/**
 * Permanent members can't be demoted or deleted from the UI: founder super
 * admins and the email-based permanent admins. A RUNTIME super admin is not
 * permanent — that is the whole point, they can be revoked again.
 */
export const isPermanent = (email?: string) => isFounderSuperAdmin(email) || isPermanentAdmin(email);

/** A user is an admin if they're permanent, a super admin, promoted, or have admin custom claims. */
export const isAdminUser = (u?: (Partial<UserProfile> & { customClaims?: { role?: string } }) | null) =>
  !!u && (isPermanent(u.email) || isSuperAdminUser(u) || u.isAdmin === true || u.customClaims?.role === 'admin');

/** Only super admins may grant/revoke admin AND super-admin rights. */
export const canManageAdmins = (u?: Partial<UserProfile> | null) => isSuperAdminUser(u);

/**
 * Can `actor` change `target`'s super-admin status?
 * Only super admins can, never against a founder, and never against yourself
 * (self-demotion is an easy way to lock yourself out by accident).
 */
export const canManageSuperAdmin = (actor?: Partial<UserProfile> | null, target?: Partial<UserProfile> | null) =>
  !!actor && !!target &&
  isSuperAdminUser(actor) &&
  !isFounderSuperAdmin(target.email) &&
  norm(actor.email) !== norm(target.email);
