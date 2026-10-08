import { useState, useEffect, useRef, useMemo } from "react";
import { UserProfile, CognitiveLevel, AccountPath } from "../types";
import { auth, db, handleFirestoreError, OperationType } from "../lib/firebase";
import { sendPasswordResetEmail } from "firebase/auth";
import { collection, onSnapshot, deleteDoc, doc, updateDoc, query, limit, getDocs } from "firebase/firestore";
import { toast } from "./Toast";
import {
  FOUNDER_SUPERADMIN_EMAILS, ADMIN_EMAILS, norm,
  isFounderSuperAdmin, isSuperAdminUser, isPermanentAdmin, isPermanent, isAdminUser,
  canManageAdmins as canManageAdminsFor, canManageSuperAdmin, isSecurityAuditsOwner,
} from "../lib/roles";
import {
  Loader2, Users, Search, Activity, Menu, ShieldAlert, Trash2,
  Crown, UserMinus, Brain, Heart, GraduationCap,
  Accessibility, Eye, User as UserIcon, Copy, Download,
  Building2, X, Sliders, FileJson, BarChart2,
  ArrowLeft, Database, Terminal, Key, Check
} from "lucide-react";
import { sectionOf } from "../lib/access";
import { USER_SUBCOLLECTIONS } from "../types/privacySecurity";
import {
  DatabaseHealthReport,
} from "../lib/databaseHub";
import {
  subscribeHttpMetrics,
  HttpMetricsSnapshot,
} from "../lib/httpTracker";
import {
  listenToSecurityAudits,
  clearSecurityAudits,
  SecurityAuditRecord,
} from "../lib/securityTracker";

import BusinessTenancyView from "./BusinessTenancyView";
import DeveloperApiConsole from "./DeveloperApiConsole";
import SystemResilienceDashboard from "./SystemResilienceDashboard";

// Modular Admin subcomponents
import { getApiUrl } from "../config/api";
import AdminDatabaseHub from "./admin/AdminDatabaseHub";
import AdminSecurityTab from "./admin/AdminSecurityTab";
import AdminAccessibilityTab from "./admin/AdminAccessibilityTab";
import AdminAnalyticsTab from "./admin/AdminAnalyticsTab";
import AdminUserDetailModal from "./admin/AdminUserDetailModal";
import AdminPasswordResetModal from "./admin/AdminPasswordResetModal";

export {
  getUserPresenceStatus,
  isUserOnlineNow,
  type PresenceStatus,
  type UserPresenceInfo,
} from "../lib/presence";
import { getUserPresenceStatus } from "../lib/presence";

interface AdminDashboardProps {
  profile: UserProfile;
  onMenuClick: () => void;
  onNavigateBack?: () => void;
}

// Visual identity for each enrolment section
const SECTION_META: Record<AccountPath, { label: string; Icon: typeof Brain; cls: string }> = {
  'Normal': { label: 'Normal', Icon: Brain, cls: 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30' },
  'Special Needs': { label: 'Special Needs', Icon: Heart, cls: 'bg-rose-500/15 text-rose-400 border border-rose-500/30' },
  'Graduation Project': { label: 'Graduation', Icon: GraduationCap, cls: 'bg-amber-500/15 text-amber-400 border border-amber-500/30' },
};
const SECTION_ORDER: (AccountPath | 'all')[] = ['all', 'Normal', 'Special Needs', 'Graduation Project'];

/** ISO string of the user's MOST-RECENT activity signal */
function newestActiveIso(u?: UserProfile | null): string | undefined {
  if (!u) return undefined;
  const candidates = [u.lastActiveDate, u.lastQuizDate, ...(u.chatThreads || []).map((t) => t?.updatedAt)]
    .filter(Boolean) as string[];
  if (candidates.length === 0) return undefined;
  return candidates.reduce((a, b) => (new Date(b).getTime() > new Date(a).getTime() ? b : a));
}

const formatDate = (isoString?: string) => {
  if (!isoString) return "Never";
  const d = new Date(isoString);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const sanitizeCsvCell = (val: unknown): string => {
  let str = val === null || val === undefined ? '' : String(val);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }
  return `"${str.replace(/"/g, '""')}"`;
};

export default function AdminDashboard({ profile, onMenuClick, onNavigateBack }: AdminDashboardProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sectionFilter, setSectionFilter] = useState<AccountPath | 'all'>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | 'superadmin' | 'normal'>('all');
  const [onlyOnlineFilter, setOnlyOnlineFilter] = useState(false);
  const [passwordModalUser, setPasswordModalUser] = useState<UserProfile | null>(null);
  const [isSendingPasswordReset, setIsSendingPasswordReset] = useState(false);
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [adminView, setAdminView] = useState<'directory' | 'accessibility' | 'analytics' | 'database' | 'security' | 'tenancy' | 'api' | 'resilience'>('directory');
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [selectedUserForModal, setSelectedUserForModal] = useState<UserProfile | null>(null);

  // Lightbox
  const [photoLightboxUrl, setPhotoLightboxUrl] = useState<string | null>(null);
  const [photoLightboxUser, setPhotoLightboxUser] = useState<UserProfile | null>(null);
  const [failedAvatarUrls, setFailedAvatarUrls] = useState<Record<string, boolean>>({});
  const [, setPresenceTick] = useState(0);

  // Database Hub Shared State
  const [dbHealth, setDbHealth] = useState<DatabaseHealthReport | null>(null);

  const [httpMetrics, setHttpMetrics] = useState<HttpMetricsSnapshot>({
    sessionRequests: 0,
    todayRequests: 0,
    dateKey: '',
    byCategory: { gemini: 0, telemetry: 0, firebase: 0, internal: 0, external: 0 },
    lastRequest: null,
    avgDurationMs: 0,
  });

  // Security & Inspect Tracker States
  const [securityAudits, setSecurityAudits] = useState<SecurityAuditRecord[]>([]);
  const [activeSecurityAlert, setActiveSecurityAlert] = useState<SecurityAuditRecord | null>(null);
  const [isClearingAudits, setIsClearingAudits] = useState(false);
  const [auditLimit, setAuditLimit] = useState<number>(50);

  const isMountedRef = useRef(true);

  // Auto-refresh presence calculation every 30 seconds so online indicators stay real-time
  useEffect(() => {
    const timer = setInterval(() => {
      if (isMountedRef.current) setPresenceTick(t => t + 1);
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const closePhotoLightbox = () => {
    setPhotoLightboxUrl(null);
    setPhotoLightboxUser(null);
  };

  useEffect(() => {
    if (!photoLightboxUrl) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePhotoLightbox();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [photoLightboxUrl]);

  useEffect(() => {
    isMountedRef.current = true;
    const unsubHttp = subscribeHttpMetrics((metrics) => {
      if (isMountedRef.current) setHttpMetrics(metrics);
    });
    return () => {
      isMountedRef.current = false;
      unsubHttp();
    };
  }, []);

  const isAdmin = isAdminUser(profile);
  const isSuperAdmin = isSuperAdminUser(profile);
  const isInspectOwner = isSecurityAuditsOwner(profile?.email);
  const canManageAdmins = canManageAdminsFor(profile);

  // Auto-redirect if unauthorized user attempts to view security inspector or database hub
  useEffect(() => {
    if ((adminView === 'security' && !isInspectOwner) || (adminView === 'database' && !isAdmin)) {
      setAdminView('directory');
    }
  }, [adminView, isInspectOwner, isAdmin]);

  const copyToClipboard = async (text: string, label: string = 'Copied to clipboard') => {
    try {
      await navigator.clipboard.writeText(text);
      if (isMountedRef.current) setCopiedText(text);
      toast.success(label, 'Copied');
      setTimeout(() => { if (isMountedRef.current) setCopiedText(null); }, 2500);
    } catch {
      toast.error('Could not copy to clipboard.', 'Copy failed');
    }
  };

  // Real-time user directory listener
  useEffect(() => {
    if (!isAdmin) return;

    const usersRef = query(collection(db, "users"), limit(1000));
    const unsubscribe = onSnapshot(usersRef, (snapshot) => {
      const usersData: UserProfile[] = [];
      snapshot.forEach((docSnap) => {
        usersData.push({ ...docSnap.data(), uid: docSnap.id } as UserProfile);
      });

      const emailMap = new Map<string, UserProfile>();
      usersData.forEach((u) => {
        // Auto-heal: Ensure removed super admin has isSuperAdmin flag revoked in Firestore
        if (norm(u.email) === 'mariemsayedr33@gmail.com' && u.isSuperAdmin) {
          u.isSuperAdmin = false;
          updateDoc(doc(db, "users", u.uid), { isSuperAdmin: false }).catch(() => {});
        }

        const emailKey = (u.email || "").toLowerCase().trim();
        if (!emailKey) {
          emailMap.set(`no-email-${u.uid}`, u);
          return;
        }

        const existing = emailMap.get(emailKey);
        if (!existing) {
          emailMap.set(emailKey, u);
        } else {
          const dateA = u.lastActiveDate || u.lastQuizDate || "1970-01-01T00:00:00Z";
          const dateB = existing.lastActiveDate || existing.lastQuizDate || "1970-01-01T00:00:00Z";
          const timeA = new Date(dateA).getTime();
          const timeB = new Date(dateB).getTime();

          if (timeA > timeB) {
            emailMap.set(emailKey, u);
          } else if (timeA === timeB) {
            const scoreA = (u.points || 0) + (u.name ? 10 : 0) + (u.chatThreads?.length ? 20 : 0);
            const scoreB = (existing.points || 0) + (existing.name ? 10 : 0) + (existing.chatThreads?.length ? 20 : 0);
            if (scoreA > scoreB) {
              emailMap.set(emailKey, u);
            }
          }
        }
      });

      const getLatestTime = (u: UserProfile) => {
        const threadTimes = Array.isArray(u.chatThreads) ? u.chatThreads.map(t => t?.updatedAt) : [];
        const times = [u.lastActiveDate, u.lastQuizDate, ...threadTimes]
          .filter(Boolean)
          .map(d => new Date(d as string).getTime())
          .filter(t => !isNaN(t));
        return times.length ? Math.max(...times) : 0;
      };

      const uniqueUsersData = Array.from(emailMap.values());
      uniqueUsersData.sort((a, b) => getLatestTime(b) - getLatestTime(a));

      setUsers(uniqueUsersData);
      setLoading(false);
    }, (error) => {
      setLoading(false);
      try {
        handleFirestoreError(error, OperationType.LIST, "users");
      } catch (e) {
        console.error("Users list subscription error:", e);
      }
    });

    return () => unsubscribe();
  }, [isAdmin]);

  // Real-time DevTools Inspect Security Alert Listener (Primary Owner Only)
  useEffect(() => {
    if (!isInspectOwner) return;
    const handleSecurityAlertEvent = (event: Event) => {
      const customEv = event as CustomEvent<SecurityAuditRecord>;
      if (customEv.detail) {
        setActiveSecurityAlert(customEv.detail);
      }
    };

    window.addEventListener('cognify:security_alert', handleSecurityAlertEvent);
    return () => {
      window.removeEventListener('cognify:security_alert', handleSecurityAlertEvent);
    };
  }, [isInspectOwner]);

  // Real-time Security Audits Stream
  useEffect(() => {
    if (!isInspectOwner) return;
    const unsub = listenToSecurityAudits((audits) => {
      if (isMountedRef.current) {
        setSecurityAudits(audits);
        if (audits.length > 0 && !activeSecurityAlert) {
          const newest = audits[0];
          if (Date.now() - newest.timestampMs < 20000) {
            setActiveSecurityAlert(newest);
          }
        }
      }
    }, auditLimit);
    return () => unsub();
  }, [isInspectOwner, auditLimit, activeSecurityAlert]);

  const handleClearAllAudits = async () => {
    if (!window.confirm('Are you sure you want to clear all DevTools security audit records? This cannot be undone.')) {
      return;
    }
    setIsClearingAudits(true);
    try {
      await clearSecurityAudits();
      setSecurityAudits([]);
      setActiveSecurityAlert(null);
      toast.success('Security audit logs successfully cleared.', 'Logs Purged');
    } catch {
      toast.error('Failed to clear security audit logs.', 'Purge Failed');
    } finally {
      if (isMountedRef.current) setIsClearingAudits(false);
    }
  };

  // User Deletion and Roles
  const canDeleteUser = (u: UserProfile) =>
    canManageAdmins && !isPermanent(u.email) && norm(u.email) !== norm(profile.email);

  const handleDeleteUser = async (u: UserProfile) => {
    if (!canManageAdmins) {
      toast.error("Only a super admin can delete users.", "Not allowed");
      return;
    }
    if (isPermanent(u.email)) {
      toast.error("Super admins and permanent admins can never be deleted.", "Protected account");
      return;
    }
    if (norm(u.email) === norm(profile.email)) {
      toast.error("You can't delete your own account from here.", "Not allowed");
      return;
    }
    if (window.confirm(`Delete "${u.name || u.email}"? This action will permanently remove their profile document, chat threads, goals, learning records, and subcollections.`)) {
      setBusyUid(u.uid);
      try {
        await Promise.all(
          USER_SUBCOLLECTIONS.map(async (sub) => {
            try {
              const snap = await getDocs(collection(db, "users", u.uid, sub));
              await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
            } catch (err) {
              console.warn(`[handleDeleteUser] Cascade delete subcollection "${sub}" skipped:`, err);
            }
          })
        );

        await deleteDoc(doc(db, "users", u.uid));

        // Server-side Auth & Cascade purge via Cloud Admin endpoint
        try {
          const token = await auth.currentUser?.getIdToken();
          if (token) {
            await fetch(getApiUrl('/api/admin/deleteUser'), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({ targetUid: u.uid, targetEmail: u.email })
            });
          }
        } catch (serverErr) {
          console.warn('[handleDeleteUser] Server endpoint deletion notice:', serverErr);
        }

        toast.success(`User "${u.name || u.email}" and all associated data records were permanently deleted.`, "Account & Data Purged");
      } catch (error) {
        console.error("Delete user error:", error);
        toast.error("Failed to delete user.", "Delete failed");
      } finally {
        if (isMountedRef.current) setBusyUid(null);
      }
    }
  };

  const handleToggleSuperAdmin = async (u: UserProfile, makeSuper: boolean) => {
    if (!canManageSuperAdmin(profile, u)) return;
    const label = u.name || u.email;
    if (!window.confirm(makeSuper
      ? `Promote "${label}" to SUPER ADMIN USER?\n\nThey will receive full infrastructure, user administration, and audit permissions.`
      : `Demote "${label}" to NORMAL USER?\n\nTheir administrative and elevated privileges will be revoked.`)) return;
    setBusyUid(u.uid);
    try {
      await updateDoc(doc(db, "users", u.uid), {
        isSuperAdmin: makeSuper,
        isAdmin: makeSuper ? true : false,
      });
      toast.success(
        makeSuper ? `${label} is now a Super Admin User.` : `${label} is now a Normal User.`,
        "Role Updated"
      );
      if (selectedUserForModal && selectedUserForModal.uid === u.uid) {
        setSelectedUserForModal({
          ...selectedUserForModal,
          isSuperAdmin: makeSuper,
          isAdmin: makeSuper ? true : false,
        });
      }
    } catch (error) {
      console.error("Toggle super admin error:", error);
      toast.error("Failed to update user role.", "Update failed");
    } finally {
      if (isMountedRef.current) setBusyUid(null);
    }
  };

  const handleSendPasswordReset = async (targetUser?: UserProfile | null) => {
    const u = targetUser || passwordModalUser;
    if (!u || !u.email) {
      toast.error("User does not have a valid email address.", "Invalid Email");
      return;
    }
    if (!isSuperAdmin) {
      toast.error("Only Super Admins can reset user passwords.", "Permission Denied");
      return;
    }
    setIsSendingPasswordReset(true);
    try {
      await sendPasswordResetEmail(auth, u.email);
      try {
        const nowIso = new Date().toISOString();
        await updateDoc(doc(db, "users", u.uid), {
          passwordResetRequestedAt: nowIso
        });
        if (selectedUserForModal && selectedUserForModal.uid === u.uid) {
          setSelectedUserForModal({
            ...selectedUserForModal,
            passwordResetRequestedAt: nowIso
          });
        }
      } catch {
        // Silently continue if firestore write has non-fatal error
      }
      toast.success(
        `Password reset instructions and link sent to ${u.email}`,
        "Password Reset Dispatched"
      );
      setPasswordModalUser(null);
    } catch (error: any) {
      console.error("Password reset error:", error);
      const code = error?.code || '';
      let msg = "Failed to send password reset email.";
      if (code === 'auth/user-not-found') {
        msg = "No user found with this email in Firebase Authentication.";
      } else if (code === 'auth/invalid-email') {
        msg = "The email address is formatted incorrectly.";
      } else if (error?.message) {
        msg = error.message;
      }
      toast.error(msg, "Password Reset Failed");
    } finally {
      if (isMountedRef.current) setIsSendingPasswordReset(false);
    }
  };

  const handleUpdatePoints = async (u: UserProfile, delta: number) => {
    if (!canManageAdmins) {
      toast.error("Only super administrators are authorized to update student points.", "Unauthorized");
      return;
    }
    const newPoints = Math.max(0, (u.points || 0) + delta);
    setBusyUid(u.uid);
    try {
      await updateDoc(doc(db, "users", u.uid), { points: newPoints });
      toast.success(`Updated ${u.name || u.email}'s points to ${newPoints}`, 'Points adjusted');
      if (selectedUserForModal && selectedUserForModal.uid === u.uid) {
        setSelectedUserForModal({ ...selectedUserForModal, points: newPoints });
      }
    } catch (err) {
      console.error("Update points error:", err);
      toast.error("Failed to update points.", "Update error");
    } finally {
      if (isMountedRef.current) setBusyUid(null);
    }
  };

  const handleUpdateCognitiveLevel = async (u: UserProfile, newLevel: CognitiveLevel) => {
    if (!canManageAdmins) {
      toast.error("Only super administrators are authorized to change cognitive level.", "Unauthorized");
      return;
    }
    setBusyUid(u.uid);
    try {
      await updateDoc(doc(db, "users", u.uid), { level: newLevel });
      toast.success(`Level changed to ${newLevel}`, 'Profile updated');
      if (selectedUserForModal && selectedUserForModal.uid === u.uid) {
        setSelectedUserForModal({ ...selectedUserForModal, level: newLevel });
      }
    } catch (err) {
      console.error("Update cognitive level error:", err);
      toast.error("Failed to update cognitive level.", "Update error");
    } finally {
      if (isMountedRef.current) setBusyUid(null);
    }
  };

  const handleUpdateCountry = async (u: UserProfile, newCountry: string) => {
    setBusyUid(u.uid);
    try {
      await updateDoc(doc(db, "users", u.uid), { country: newCountry });
      toast.success(`Updated ${u.name || u.email}'s country`, 'Country updated');
      if (selectedUserForModal && selectedUserForModal.uid === u.uid) {
        setSelectedUserForModal({ ...selectedUserForModal, country: newCountry });
      }
    } catch (err) {
      console.error("Update country error:", err);
      toast.error("Failed to update country.", "Update error");
    } finally {
      if (isMountedRef.current) setBusyUid(null);
    }
  };

  const exportAllJson = () => {
    const blob = new Blob([JSON.stringify(users, null, 2)], { type: 'application/json;charset=utf-8' });
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = `cognify-all-users-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    toast.success(`Exported ${users.length} full user records as JSON.`, 'Backup Downloaded');
  };

  const exportAllCsv = () => {
    const rows = [
      ['UID', 'Name', 'Email', 'Section', 'Role', 'Level', 'Points', 'IQ Score', 'University', 'Faculty', 'Disability Type', 'Active Mode', 'Language', 'Last Active'],
      ...users.map((u) => [
        u.uid || '',
        u.name || 'Unnamed',
        u.email || '',
        sectionOf(u),
        u.role || 'Student',
        u.level || 'Intermediate',
        u.points || 0,
        u.iqScore || '',
        u.university || '',
        u.faculty || '',
        u.disabilityType || '',
        u.accessibilityMode || 'None',
        u.language || 'English',
        formatDate(newestActiveIso(u)),
      ]),
    ];
    const csv = '\uFEFF' + rows.map(r => r.map(c => sanitizeCsvCell(c)).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = `cognify-directory-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    toast.success(`Exported ${users.length} users to CSV.`, 'Excel file ready');
  };

  const copyAllDirectoryEmails = async () => {
    const emails = users.map(u => u.email).filter(Boolean).join(', ');
    await copyToClipboard(emails, `${users.length} user emails copied`);
  };

  const onlineUsersCount = useMemo(() => {
    return users.filter(u => getUserPresenceStatus(u).status === 'online').length;
  }, [users]);

  const superAdminCount = useMemo(() => users.filter(u => isSuperAdminUser(u)).length, [users]);
  const normalUserCount = useMemo(() => users.filter(u => !isSuperAdminUser(u)).length, [users]);

  // Enrolment Section Counts
  const sectionCounts: Record<AccountPath, number> = useMemo(() => {
    const counts: Record<AccountPath, number> = { 'Normal': 0, 'Special Needs': 0, 'Graduation Project': 0 };
    users.forEach(u => { counts[sectionOf(u)] = (counts[sectionOf(u)] || 0) + 1; });
    return counts;
  }, [users]);

  // Administrators list
  const adminUsers = users.filter(isAdminUser);
  const knownAdminEmails = new Set(adminUsers.map(u => norm(u.email)));
  const pending = (emails: string[], prefix: string) =>
    emails.filter(e => !knownAdminEmails.has(e)).map(e => ({ uid: `${prefix}-${e}`, email: e, name: '' } as UserProfile));

  const superAdmins = [
    ...adminUsers.filter(u => isSuperAdminUser(u)),
    ...pending(FOUNDER_SUPERADMIN_EMAILS, 'sa'),
  ];

  // Filtered Users
  const filteredUsers = users.filter(u => {
    const term = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !term ||
      (u.email || "").toLowerCase().includes(term) ||
      (u.name && u.name.toLowerCase().includes(term)) ||
      (u.uid && u.uid.toLowerCase().includes(term)) ||
      (u.university && u.university.toLowerCase().includes(term)) ||
      (u.faculty && u.faculty.toLowerCase().includes(term)) ||
      (u.disabilityType && u.disabilityType.toLowerCase().includes(term));
    const matchesSection = sectionFilter === 'all' || sectionOf(u) === sectionFilter;
    const matchesOnline = !onlyOnlineFilter || getUserPresenceStatus(u).status === 'online';
    const matchesRole =
      roleFilter === 'all' ||
      (roleFilter === 'superadmin' && isSuperAdminUser(u)) ||
      (roleFilter === 'normal' && !isSuperAdminUser(u));
    return matchesSearch && matchesSection && matchesOnline && matchesRole;
  });

  if (!isAdmin) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#080409] text-slate-100 p-6">
        <ShieldAlert className="w-16 h-16 text-rose-500 mb-4" />
        <h2 className="text-2xl font-black uppercase tracking-tighter">Access Denied</h2>
        <p className="text-slate-400 font-medium text-sm mt-2">You do not have administrative privileges.</p>
      </div>
    );
  }

  return (
    <div
      data-security-zone={adminView === 'database' ? 'database-dashboard' : 'admin-dashboard'}
      className="flex-1 flex flex-col bg-[#080409] text-slate-100 relative overflow-hidden custom-scrollbar font-sans selection:bg-emerald-500/30 selection:text-emerald-300 min-h-screen"
    >
      {/* Background Nagm Gradient Accents */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-1/3 left-10 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-rose-500/10 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* ── TOP REAL-TIME DEVTOOLS INSPECT SECURITY ALERT BANNER ────────────────── */}
      {activeSecurityAlert && isInspectOwner && (
        <div className="bg-rose-950/90 border-b border-rose-500/40 p-4 px-6 md:px-10 flex items-center justify-between gap-4 backdrop-blur-xl animate-in slide-in-from-top-4 duration-300 z-50 shadow-2xl">
          <div className="flex items-center gap-3 min-w-0">
            <span className="relative flex h-3.5 w-3.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-rose-500" />
            </span>
            <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
            <div className="text-xs md:text-sm text-slate-100 min-w-0 truncate">
              <span className="font-black text-rose-400 uppercase tracking-wider mr-2">🚨 DevTools Inspect Detected:</span>
              <span className="font-bold text-white mr-1.5">{activeSecurityAlert.name || activeSecurityAlert.email}</span>
              <span className="text-slate-300 mr-2">({activeSecurityAlert.email})</span>
              <span className="inline-flex items-center gap-1.5 font-mono text-xs font-black bg-rose-900/60 border border-rose-500/40 px-2 py-0.5 rounded text-rose-200">
                IP: {activeSecurityAlert.ip}
                <button
                  onClick={() => copyToClipboard(activeSecurityAlert.ip, `IP copied: ${activeSecurityAlert.ip}`)}
                  className="hover:text-white transition-colors"
                  title="Copy IP Address"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </span>
              <span className="text-slate-400 ml-2 hidden lg:inline">
                Trigger: <span className="text-rose-300 font-semibold">{activeSecurityAlert.eventType}</span> on <span className="font-mono text-slate-300">{activeSecurityAlert.path}</span>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => { setAdminView('security'); setActiveSecurityAlert(null); }}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg active:scale-95"
            >
              View Feed
            </button>
            <button
              onClick={() => setActiveSecurityAlert(null)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-rose-900/50 transition-colors"
              title="Dismiss Alert"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── HEADER ───────────────────────────────────────────────────────────── */}
      <header className="flex items-center gap-4 p-5 md:p-8 shrink-0 border-b border-[#4A1224]/60 bg-[#080409]/80 backdrop-blur-xl shadow-lg z-20">
        {onNavigateBack && (
          <button
            onClick={onNavigateBack}
            className="p-2.5 text-slate-400 hover:text-slate-100 bg-[#0E0610]/90 hover:bg-slate-800/90 border border-[#4A1224]/50/70 rounded-xl active:scale-95 transition-all flex items-center gap-1.5 shrink-0"
            title="Back to Assistant / العودة للمساعد"
          >
            <ArrowLeft className="w-5 h-5 rtl:rotate-180" />
            <span className="text-xs font-bold hidden sm:inline">Back</span>
          </button>
        )}
        <button
          onClick={onMenuClick}
          aria-label="Toggle menu"
          title="Open Menu"
          className="p-2.5 text-slate-400 hover:text-slate-100 bg-[#0E0610]/90 hover:bg-slate-800/90 border border-[#4A1224]/50/70 rounded-xl active:scale-95 shrink-0"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex-1 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-tr from-emerald-500/20 via-indigo-500/20 to-rose-600/20 border border-white/10 shadow-inner">
              {adminView === 'database' ? (
                <Database className="w-6 h-6 text-emerald-400" />
              ) : adminView === 'security' ? (
                <ShieldAlert className="w-6 h-6 text-rose-400" />
              ) : adminView === 'accessibility' ? (
                <Accessibility className="w-6 h-6 text-rose-400" />
              ) : adminView === 'analytics' ? (
                <BarChart2 className="w-6 h-6 text-indigo-400" />
              ) : adminView === 'tenancy' ? (
                <Building2 className="w-6 h-6 text-cyan-400" />
              ) : adminView === 'api' ? (
                <Terminal className="w-6 h-6 text-amber-400" />
              ) : adminView === 'resilience' ? (
                <Activity className="w-6 h-6 text-emerald-400" />
              ) : (
                <Users className="w-6 h-6 text-[#E5A93C]" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight leading-none">
                  Cognify Admin Hub
                </h2>
                {isSuperAdmin && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-500/15 text-amber-400 border border-amber-500/30">
                    <Crown className="w-3 h-3" /> Super Admin
                  </span>
                )}
              </div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                {adminView === 'database' ? 'Infrastructure & Database Operations (Frankfurt europe-west1)' :
                 adminView === 'security' ? 'Security & DevTools Inspect Telemetry Stream' :
                 adminView === 'accessibility' ? 'Accessibility Center · Special Needs Command' :
                 adminView === 'analytics' ? 'System Insights & Cognitive Diagnostics' :
                 adminView === 'tenancy' ? 'Multi-Tenant Business & Organization Management' :
                 adminView === 'api' ? 'Developer API Console, Webhooks & Token Quotas' :
                 adminView === 'resilience' ? 'System Resilience, Circuit Breakers & Failover Hub' :
                 'Global User Directory & Access Management'}
              </p>
            </div>
          </div>

          {/* Navigation Tabs Pill */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 p-1 bg-[#0E0610]/95 border border-[#4A1224]/60 rounded-2xl backdrop-blur-md overflow-x-auto custom-scrollbar">
              <button
                onClick={() => setAdminView('directory')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                  adminView === 'directory' ? 'bg-gradient-to-r from-amber-400 via-[#E5A93C] to-rose-600 text-slate-950 shadow-md font-extrabold' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Users className="w-3.5 h-3.5" /> Directory
              </button>
              <button
                onClick={() => setAdminView('accessibility')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                  adminView === 'accessibility' ? 'bg-rose-500 text-white shadow-md font-extrabold' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Accessibility className="w-3.5 h-3.5" /> Accessibility
              </button>
              <button
                onClick={() => setAdminView('analytics')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                  adminView === 'analytics' ? 'bg-indigo-600 text-white shadow-md font-extrabold' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <BarChart2 className="w-3.5 h-3.5" /> Insights
              </button>
              {isAdmin && (
                <button
                  onClick={() => setAdminView('database')}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                    adminView === 'database' ? 'bg-emerald-500 text-slate-950 shadow-md font-extrabold' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Database className="w-3.5 h-3.5" /> Database
                  {isSuperAdmin ? (
                    <Crown className="w-3 h-3 text-amber-300" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  )}
                </button>
              )}
              {isInspectOwner && (
                <button
                  onClick={() => setAdminView('security')}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all relative ${
                    adminView === 'security' ? 'bg-rose-600 text-white shadow-md font-extrabold' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5" /> Inspect Tracker
                  {securityAudits.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-rose-500/40 text-white border border-rose-400/50 font-mono">
                      {securityAudits.length}
                    </span>
                  )}
                </button>
              )}
              {isAdmin && (
                <>
                  <button
                    onClick={() => setAdminView('tenancy')}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                      adminView === 'tenancy' ? 'bg-cyan-600 text-white shadow-md font-extrabold' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" /> Tenancy
                  </button>
                  <button
                    onClick={() => setAdminView('api')}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                      adminView === 'api' ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    }`}
                  >
                    <Terminal className="w-3.5 h-3.5" /> API
                  </button>
                  <button
                    onClick={() => setAdminView('resilience')}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                      adminView === 'resilience' ? 'bg-emerald-600 text-white shadow-md font-extrabold' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    }`}
                  >
                    <Activity className="w-3.5 h-3.5" /> Resilience
                  </button>
                </>
              )}
            </div>

            {/* Cloud Firestore Status Pill */}
            {isAdmin && (
              <div className="hidden xl:flex items-center gap-2 px-3 py-2 bg-[#0E0610]/95 border border-[#4A1224]/60 rounded-xl text-xs font-bold text-slate-300 shadow-inner">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span>Frankfurt europe-west1</span>
                {dbHealth && (
                  <span className={`font-mono text-[11px] font-bold ${
                    dbHealth.latencyMs < 300
                      ? 'text-emerald-400'
                      : dbHealth.latencyMs < 600
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }`}>({dbHealth.latencyMs}ms)</span>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT CONTAINER ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6 md:p-10 z-10 custom-scrollbar">
        <div className="max-w-7xl mx-auto space-y-8">

          {/* ════ VIEW 1: DIRECTORY ════ */}
          {adminView === 'directory' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Super Admin Team Section */}
              <section className="backdrop-blur-xl bg-[#0E0610]/70 border border-[#4A1224]/60 shadow-2xl rounded-3xl p-6">
                <div className="flex items-center justify-between gap-3 mb-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded-2xl">
                      <Crown className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-white uppercase tracking-tight">Super Admin Team</h3>
                      <p className="text-xs font-medium text-slate-400 mt-0.5">
                        {superAdmins.length} verified Super Admin User{superAdmins.length === 1 ? '' : 's'}
                        {canManageAdmins ? ' · Super admin management active' : ' · Standard admin access'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {superAdmins.map((a) => {
                    const isMe = norm(a.email) === norm(profile.email);
                    const isFounder = isFounderSuperAdmin(a.email);
                    return (
                      <div
                        key={a.uid}
                        className="flex items-center gap-3 p-3.5 rounded-2xl border backdrop-blur-md transition-all bg-amber-500/10 border-amber-500/40 shadow-lg shadow-amber-500/5"
                      >
                        <div
                          className="relative cursor-pointer shrink-0"
                          onClick={() => {
                            if (a.photoURL) {
                              setPhotoLightboxUrl(a.photoURL);
                              setPhotoLightboxUser(a);
                            }
                          }}
                          title={a.photoURL ? 'Click to inspect photo' : undefined}
                        >
                          {a.photoURL && !failedAvatarUrls[a.photoURL] ? (
                            <img
                              src={a.photoURL}
                              alt={a.name || 'Super Admin Avatar'}
                              onError={() => setFailedAvatarUrls(prev => ({ ...prev, [a.photoURL!]: true }))}
                              className="w-10 h-10 rounded-2xl object-cover border border-amber-500/40 hover:border-[#E5A93C] transition-all shadow-md bg-slate-800"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 font-black text-sm bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              {(a.name || a.email || '?').charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-900 ${getUserPresenceStatus(a).dotCls}`}
                            title={`Status: ${getUserPresenceStatus(a).label}`}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-white text-sm truncate">{a.name || a.email?.split('@')[0]}</span>
                            {isMe && <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">(you)</span>}
                          </div>
                          <div className="text-xs text-slate-400 truncate" title={a.email}>{a.email}</div>
                        </div>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider shrink-0 bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          <Crown className="w-3 h-3" />
                          Super Admin
                        </span>
                        {isSuperAdmin && a.email && (
                          <button
                            onClick={() => setPasswordModalUser(a)}
                            disabled={busyUid === a.uid}
                            title={`Change / Reset Password for ${a.email}`}
                            className="p-1.5 rounded-xl text-amber-300 hover:bg-amber-500/20 transition-colors disabled:opacity-50 shrink-0"
                          >
                            <Key className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {!isFounder && !isMe && canManageSuperAdmin(profile, a) && (
                          <button
                            onClick={() => handleToggleSuperAdmin(a, false)}
                            disabled={busyUid === a.uid}
                            title="Demote to Normal User"
                            className="p-1.5 rounded-xl text-rose-400 hover:bg-rose-500/20 transition-colors disabled:opacity-50 shrink-0"
                          >
                            {busyUid === a.uid ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserMinus className="w-4 h-4" />}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Enrolment Sections Metric Cards */}
              <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <button
                  onClick={() => setSectionFilter('all')}
                  aria-pressed={sectionFilter === 'all'}
                  className={`flex items-center gap-4 p-5 rounded-3xl border text-left transition-all backdrop-blur-xl ${
                    sectionFilter === 'all'
                      ? 'bg-[#4A1224]/40 border-[#E5A93C]/50 ring-2 ring-[#E5A93C]/20 shadow-xl'
                      : 'bg-[#0E0610]/70 border-[#4A1224]/60 hover:border-[#4A1224]/50'
                  }`}
                >
                  <div className="p-3 rounded-2xl bg-[#4A1224]/60 text-[#E5A93C] border border-[#E5A93C]/30">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-2xl md:text-3xl font-black text-white leading-none">{users.length}</div>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1.5">Total Users</div>
                    <div className="text-[10px] text-slate-500 mt-1 font-mono">
                      {sectionCounts['Normal']} N · {sectionCounts['Special Needs']} SN · {sectionCounts['Graduation Project']} G
                    </div>
                  </div>
                </button>

                {(['Normal', 'Special Needs', 'Graduation Project'] as AccountPath[]).map((sec) => {
                  const meta = SECTION_META[sec];
                  const active = sectionFilter === sec;
                  return (
                    <button
                      key={sec}
                      onClick={() => setSectionFilter(active ? 'all' : sec)}
                      aria-pressed={active}
                      className={`flex items-center gap-4 p-5 rounded-3xl border text-left transition-all backdrop-blur-xl ${
                        active
                          ? 'bg-slate-800/80 border-slate-600 ring-2 ring-white/10 shadow-xl'
                          : 'bg-[#0E0610]/70 border-[#4A1224]/60 hover:border-[#4A1224]/50'
                      }`}
                    >
                      <div className={`p-3 rounded-2xl ${meta.cls}`}>
                        <meta.Icon className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="text-2xl md:text-3xl font-black text-white leading-none">{sectionCounts[sec]}</div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1.5">{meta.label}</div>
                      </div>
                    </button>
                  );
                })}
              </section>

              {/* Controls Bar */}
              <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center flex-1">
                  <div className="relative w-full max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Search by name, email, UID, faculty, disability..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-[#0E0610]/90 border border-[#4A1224]/60 rounded-2xl text-sm font-medium text-white placeholder:text-slate-500 focus:ring-2 focus:ring-[#E5A93C]/30 focus:border-[#E5A93C] outline-none transition-all"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 p-1 bg-[#0E0610]/95 border border-[#4A1224]/60 rounded-2xl overflow-x-auto custom-scrollbar">
                    <button
                      onClick={() => setRoleFilter('all')}
                      className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                        roleFilter === 'all' ? 'bg-slate-700 text-white font-bold' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                      }`}
                    >
                      All Roles
                    </button>
                    <button
                      onClick={() => setRoleFilter('superadmin')}
                      className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-1 ${
                        roleFilter === 'superadmin' ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20' : 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/10'
                      }`}
                    >
                      <Crown className="w-3 h-3" /> Super Admins ({superAdminCount})
                    </button>
                    <button
                      onClick={() => setRoleFilter('normal')}
                      className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-1 ${
                        roleFilter === 'normal' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                      }`}
                    >
                      <UserIcon className="w-3 h-3" /> Normal Users ({normalUserCount})
                    </button>

                    <div className="w-px h-5 bg-slate-800 my-auto mx-1" />

                    <button
                      onClick={() => setOnlyOnlineFilter(prev => !prev)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-1.5 ${
                        onlyOnlineFilter
                          ? 'bg-emerald-500 text-slate-950 font-black shadow-lg shadow-emerald-500/20'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                      }`}
                      title="Filter users who are active on Cognify right now"
                    >
                      <span className="relative flex h-2 w-2">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 ${onlyOnlineFilter ? 'inline-flex' : 'hidden'}`} />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                      </span>
                      Online Now ({onlineUsersCount})
                    </button>
                    {SECTION_ORDER.map((sec) => (
                      <button
                        key={sec}
                        onClick={() => setSectionFilter(sec)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                          sectionFilter === sec ? 'bg-gradient-to-r from-amber-400 via-[#E5A93C] to-rose-600 text-slate-950 font-bold' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                        }`}
                      >
                        {sec === 'all' ? 'All' : SECTION_META[sec].label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                  <button
                    onClick={copyAllDirectoryEmails}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#150917] hover:bg-slate-800 text-white text-xs font-black uppercase tracking-widest rounded-xl border border-[#4A1224]/50 transition-all shadow-md active:scale-95"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy Emails
                  </button>
                  <button
                    onClick={exportAllCsv}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95"
                  >
                    <Download className="w-3.5 h-3.5" /> CSV
                  </button>
                  <button
                    onClick={exportAllJson}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95"
                  >
                    <FileJson className="w-3.5 h-3.5" /> JSON Backup
                  </button>
                </div>
              </div>

              {/* User Directory Table */}
              {loading ? (
                <div className="flex flex-col items-center justify-center p-24">
                  <Loader2 className="w-10 h-10 text-[#E5A93C] animate-spin" />
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-4">Loading directory...</p>
                </div>
              ) : (
                <div className="backdrop-blur-xl bg-[#0E0610]/70 border border-[#4A1224]/60 shadow-2xl rounded-3xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#0E0610]/95 text-[10px] uppercase font-black tracking-widest text-slate-400 border-b border-[#4A1224]/60">
                          <th className="p-4">User &amp; Profile Photo</th>
                          <th className="p-4">Section &amp; Disability</th>
                          <th className="p-4">System Role</th>
                          <th className="p-4">Points</th>
                          <th className="p-4">Score</th>
                          <th className="p-4">Live Presence &amp; Active</th>
                          <th className="p-4">Email</th>
                          <th className="p-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm font-medium text-slate-200 divide-y divide-slate-800/60">
                        {filteredUsers.length > 0 ? filteredUsers.map((u) => {
                          const presence = getUserPresenceStatus(u);
                          return (
                          <tr
                            key={u.uid}
                            onClick={() => setSelectedUserForModal(u)}
                            className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                          >
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div
                                  className="relative group/avatar cursor-pointer shrink-0"
                                  onClick={(e) => {
                                    if (u.photoURL) {
                                      e.stopPropagation();
                                      setPhotoLightboxUrl(u.photoURL);
                                      setPhotoLightboxUser(u);
                                    }
                                  }}
                                  title={u.photoURL ? 'Click to inspect full-size photo' : undefined}
                                >
                                  {u.photoURL && !failedAvatarUrls[u.photoURL] ? (
                                    <img
                                      src={u.photoURL}
                                      alt={u.name || 'User Avatar'}
                                      onError={() => setFailedAvatarUrls(prev => ({ ...prev, [u.photoURL!]: true }))}
                                      className="w-10 h-10 rounded-2xl object-cover border border-[#4A1224]/60 group-hover/avatar:border-[#E5A93C] group-hover/avatar:scale-105 transition-all shadow-md bg-slate-800"
                                    />
                                  ) : (
                                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm bg-gradient-to-br from-slate-800 to-slate-900 border border-[#4A1224]/60 text-[#E5A93C] shadow-inner">
                                      {(u.name || u.email || '?').charAt(0).toUpperCase()}
                                    </div>
                                  )}
                                  <span
                                    className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-slate-900 ${presence.dotCls}`}
                                    title={`Status: ${presence.label}`}
                                  />
                                </div>

                                <div className="min-w-0">
                                  <div className="font-bold text-white group-hover:text-[#E5A93C] transition-colors flex items-center gap-1.5 truncate">
                                    <span className="truncate">{u.name || u.email?.split('@')[0] || 'Unnamed User'}</span>
                                    {presence.status === 'online' && (
                                      <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                        Live
                                      </span>
                                    )}
                                    <Sliders className="w-3.5 h-3.5 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="font-mono text-[10px] text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded border border-[#4A1224]/50/50" title={u.uid}>
                                      {u.uid.slice(0, 8)}…
                                    </span>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); copyToClipboard(u.uid, `UID copied: ${u.uid}`); }}
                                      className="text-slate-500 hover:text-[#E5A93C] p-0.5 transition-colors"
                                      title="Copy Firebase UID"
                                    >
                                      {copiedText === u.uid ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="p-4">
                              {(() => {
                                const meta = SECTION_META[sectionOf(u)] || SECTION_META['Normal'];
                                return (
                                  <div className="flex flex-col gap-1">
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider max-w-fit ${meta.cls}`}>
                                      <meta.Icon className="w-3 h-3" /> {meta.label}
                                    </span>
                                    {sectionOf(u) === 'Special Needs' && u.disabilityType && (
                                      <span className="text-[10px] font-bold text-rose-400">
                                        {u.disabilityType}
                                      </span>
                                    )}
                                  </div>
                                );
                              })()}
                            </td>
                            <td className="p-4">
                              <div className="flex flex-col gap-1.5 items-start">
                                {isSuperAdminUser(u) ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm shadow-amber-500/10">
                                    <Crown className="w-3 h-3 text-amber-400" /> Super Admin User
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider bg-slate-800/90 text-slate-300 border border-[#4A1224]/50/70">
                                    <UserIcon className="w-3 h-3 text-slate-400" /> Normal User
                                  </span>
                                )}
                                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                                  <span>{u.role || 'Student'}</span>
                                  <span>•</span>
                                  <span className="uppercase">{u.level || 'Intermediate'}</span>
                                  {u.country && u.country !== 'Unknown' && u.country !== 'N/A' && (
                                    <>
                                      <span>•</span>
                                      <span className="text-emerald-400 font-bold">{u.country}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="p-4 font-black text-white">{u.points || 0}</td>
                            <td className="p-4 font-black text-slate-300">{u.iqScore || '--'}</td>
                            <td className="p-4">
                              <div className="flex flex-col gap-1 items-start">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${presence.badgeCls}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${presence.dotCls}`} />
                                  {presence.label}
                                </span>
                                <span className="text-[10px] text-slate-500 font-mono">
                                  {formatDate(newestActiveIso(u))}
                                </span>
                              </div>
                            </td>
                            <td className="p-4 text-xs text-slate-300 truncate max-w-[180px]" title={u.email}>{u.email}</td>
                            <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                <button
                                  onClick={() => setSelectedUserForModal(u)}
                                  title="Inspect full profile &amp; details"
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-bold uppercase tracking-widest rounded-lg border border-[#4A1224]/50 transition-colors"
                                >
                                  <Sliders className="w-3 h-3" /> Details
                                </button>

                                {isSuperAdmin && (
                                  <button
                                    onClick={() => setPasswordModalUser(u)}
                                    disabled={busyUid === u.uid}
                                    title={`Change / Reset Password for ${u.name || u.email}`}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-colors disabled:opacity-50"
                                  >
                                    <Key className="w-3 h-3" /> Reset Pass
                                  </button>
                                )}

                                {isSuperAdminUser(u) ? (
                                  isFounderSuperAdmin(u.email) ? (
                                    <span
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/25 text-[10px] font-black uppercase tracking-widest rounded-lg"
                                      title="Founder Super Admin (Permanent)"
                                    >
                                      <Crown className="w-3 h-3 text-amber-400" /> Founder
                                    </span>
                                  ) : norm(profile.email) === norm(u.email) ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 text-slate-400 border border-[#4A1224]/50 text-[10px] font-bold uppercase tracking-widest rounded-lg">
                                      (You)
                                    </span>
                                  ) : canManageSuperAdmin(profile, u) ? (
                                    <button
                                      onClick={() => handleToggleSuperAdmin(u, false)}
                                      disabled={busyUid === u.uid}
                                      title="Demote to Normal User"
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-colors disabled:opacity-50"
                                    >
                                      {busyUid === u.uid ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserMinus className="w-3 h-3" />} Make Normal
                                    </button>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold uppercase tracking-widest rounded-lg">
                                      <Crown className="w-3 h-3" /> Super Admin
                                    </span>
                                  )
                                ) : canManageSuperAdmin(profile, u) ? (
                                  <button
                                    onClick={() => handleToggleSuperAdmin(u, true)}
                                    disabled={busyUid === u.uid}
                                    title="Promote to Super Admin User"
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-colors disabled:opacity-50"
                                  >
                                    {busyUid === u.uid ? <Loader2 className="w-3 h-3 animate-spin" /> : <Crown className="w-3 h-3" />} Make Super Admin
                                  </button>
                                ) : null}

                                {canDeleteUser(u) && (
                                  <button
                                    onClick={() => handleDeleteUser(u)}
                                    className="inline-flex items-center p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg transition-colors"
                                    title="Delete User"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                          );
                        }) : (
                          <tr>
                            <td colSpan={8} className="p-12 text-center text-slate-500 font-medium">
                              No users found matching &quot;{searchTerm}&quot;
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════ VIEW 2: ACCESSIBILITY CENTER ════ */}
          {adminView === 'accessibility' && (
            <AdminAccessibilityTab
              users={users}
              copyToClipboard={copyToClipboard}
            />
          )}

          {/* ════ VIEW 3: SYSTEM INSIGHTS & ANALYTICS ════ */}
          {adminView === 'analytics' && (
            <AdminAnalyticsTab
              users={users}
            />
          )}

          {/* ════ VIEW 4: SUPER ADMIN DATABASE OPERATIONS HUB ════ */}
          {adminView === 'database' && (
            <AdminDatabaseHub
              users={users}
              securityAudits={securityAudits}
              isAdmin={isAdmin}
              isSuperAdmin={isSuperAdmin}
              canManageAdmins={canManageAdmins}
              onlineUsersCount={onlineUsersCount}
              httpMetrics={httpMetrics}
              dbHealth={dbHealth}
              onDbHealthChange={setDbHealth}
              copyToClipboard={copyToClipboard}
              exportAllCsv={exportAllCsv}
            />
          )}

          {/* ════ VIEW 5: DEVTOOLS INSPECT SECURITY TRACKER ════ */}
          {adminView === 'security' && (
            <AdminSecurityTab
              securityAudits={securityAudits}
              isInspectOwner={isInspectOwner}
              auditLimit={auditLimit}
              setAuditLimit={setAuditLimit}
              onClearAllAudits={handleClearAllAudits}
              isClearingAudits={isClearingAudits}
              copyToClipboard={copyToClipboard}
            />
          )}

          {/* ════ VIEW 6: BUSINESS TENANCY ════ */}
          {adminView === 'tenancy' && (
            <div className="space-y-6">
              <BusinessTenancyView isArabic={profile.language === 'Arabic' || profile.language === 'Egyptian Ammiya'} />
            </div>
          )}

          {/* ════ VIEW 7: DEVELOPER API CONSOLE ════ */}
          {adminView === 'api' && (
            <div className="space-y-6">
              <DeveloperApiConsole isArabic={profile.language === 'Arabic' || profile.language === 'Egyptian Ammiya'} />
            </div>
          )}

          {/* ════ VIEW 8: SYSTEM RESILIENCE ════ */}
          {adminView === 'resilience' && (
            <div className="space-y-6">
              <SystemResilienceDashboard isArabic={profile.language === 'Arabic' || profile.language === 'Egyptian Ammiya'} />
            </div>
          )}

        </div>
      </div>

      {/* ── PHOTO LIGHTBOX INSPECTION MODAL ──────────────────────────────── */}
      {photoLightboxUrl && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={closePhotoLightbox}
        >
          <div
            className="relative max-w-lg w-full bg-[#150917] border border-[#4A1224]/60 rounded-3xl overflow-hidden shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-[#4A1224]/40 text-[#E5A93C] border border-[#E5A93C]/30">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-white">
                    {photoLightboxUser?.name || photoLightboxUser?.email || 'User Profile Photo'}
                  </h4>
                  <p className="text-xs text-slate-400">{photoLightboxUser?.email}</p>
                </div>
              </div>
              <button
                onClick={closePhotoLightbox}
                className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-full transition-colors"
                title="Close photo viewer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative rounded-2xl overflow-hidden bg-[#080409] border border-[#4A1224]/60 flex items-center justify-center p-2 min-h-[280px]">
              {photoLightboxUrl && !failedAvatarUrls[photoLightboxUrl] ? (
                <img
                  src={photoLightboxUrl}
                  alt={photoLightboxUser?.name || 'High resolution profile avatar'}
                  onError={() => setFailedAvatarUrls(prev => ({ ...prev, [photoLightboxUrl!]: true }))}
                  className="max-h-[60vh] max-w-full rounded-xl object-contain shadow-2xl"
                />
              ) : (
                <div className="w-24 h-24 rounded-3xl flex items-center justify-center font-black text-3xl bg-slate-800 border border-[#4A1224]/50 text-[#E5A93C]">
                  {(photoLightboxUser?.name || photoLightboxUser?.email || '?').charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="text-xs text-slate-400">
                {photoLightboxUser && (() => {
                  const p = getUserPresenceStatus(photoLightboxUser);
                  return (
                    <span className="inline-flex items-center gap-1.5 font-semibold">
                      <span className={`w-2 h-2 rounded-full ${p.dotCls}`} />
                      {p.label}
                    </span>
                  );
                })()}
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={photoLightboxUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors border border-[#4A1224]/50"
                >
                  Open Original
                </a>
                <button
                  onClick={() => copyToClipboard(photoLightboxUrl, 'Photo URL copied')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-amber-400 via-[#E5A93C] to-rose-600 hover:bg-[#E5A93C] text-slate-950 rounded-xl text-xs font-black transition-colors"
                >
                  <Copy className="w-3 h-3" /> Copy URL
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── USER DETAILS & PROFILE MODAL ─────────────────────────────────────── */}
      {selectedUserForModal && (
        <AdminUserDetailModal
          user={selectedUserForModal}
          callerProfile={profile}
          onClose={() => setSelectedUserForModal(null)}
          onOpenPhotoLightbox={(url, u) => {
            setPhotoLightboxUrl(url);
            setPhotoLightboxUser(u);
          }}
          onOpenPasswordReset={(u) => setPasswordModalUser(u)}
          canManageAdmins={canManageAdmins}
          canManageSuperAdmin={canManageSuperAdmin}
          busyUid={busyUid}
          onToggleSuperAdmin={handleToggleSuperAdmin}
          onUpdatePoints={handleUpdatePoints}
          onUpdateCognitiveLevel={handleUpdateCognitiveLevel}
          onUpdateCountry={handleUpdateCountry}
          copyToClipboard={copyToClipboard}
        />
      )}

      {/* ── PASSWORD RESET MODAL ───────────────────────────────────────────── */}
      {passwordModalUser && (
        <AdminPasswordResetModal
          user={passwordModalUser}
          isSending={isSendingPasswordReset}
          onClose={() => setPasswordModalUser(null)}
          onSendReset={handleSendPasswordReset}
        />
      )}

    </div>
  );
}
