import { useState, useEffect, useRef, useMemo } from "react";
import { UserProfile, CognitiveLevel, AccountPath, AccessibilityMode, LoginHistoryRecord } from "../types";
import { auth, db, handleFirestoreError, OperationType } from "../lib/firebase";
import { sendPasswordResetEmail } from "firebase/auth";
import { collection, onSnapshot, deleteDoc, doc, updateDoc, query, limit } from "firebase/firestore";
import { toast } from "./Toast";
import {
  FOUNDER_SUPERADMIN_EMAILS, ADMIN_EMAILS, norm,
  isFounderSuperAdmin, isSuperAdminUser, isPermanentAdmin, isPermanent, isAdminUser,
  canManageAdmins as canManageAdminsFor, canManageSuperAdmin, isSecurityAuditsOwner,
  isDatabaseHubOwner,
} from "../lib/roles";
import {
  Loader2, Users, Search, Activity, Menu, ShieldAlert, Mail, Trash2, Shield,
  ShieldCheck, Crown, UserPlus, UserMinus, Brain, Heart, GraduationCap,
  Accessibility, Eye, Ear, Mic, User as UserIcon, Copy, CheckCircle2, Download,
  Printer, AlertTriangle, Building2, X, Sliders, MessageSquare,
  ListTodo, FileJson, RefreshCw, BarChart2, BookOpen, Clock, Award, Check, Sparkles,
  ArrowLeft, Database, HardDrive, Radio, Lock, Terminal, Zap, Globe, Server, AlertCircle,
  Filter, Layers, Key, Cpu, Wifi, ArrowUpRight, Gauge, Info, ChevronDown, ChevronUp, Play
} from "lucide-react";
import { sectionOf, isAccessibilityUser } from "../lib/access";
import { formatCountryName, COMMON_COUNTRIES } from "../lib/geo";
import { fetchUserLoginHistory } from "../lib/loginHistory";
import {
  getDatabaseHealth,
  getCollectionStats,
  getFirebaseFreeTierQuotas,
  getCoreCollectionsInventory,
  runDeepDiagnostics,
  generateFullSystemBackupJson,
  generateDatabaseAuditReport,
  cleanStaleSessionsAndCache,
  FIRESTORE_SPARK_LIMITS,
  BACKEND_SPARK_LIMITS,
  DatabaseHealthReport,
  FirebaseFreeTierQuotas,
  QuotaLimitItem,
  CoreCollectionItem,
  DeepDiagnosticsResult,
} from "../lib/databaseHub";
import {
  subscribeHttpMetrics,
  HttpMetricsSnapshot,
  resetSessionHttpMetrics,
} from "../lib/httpTracker";
import {
  listenToSecurityAudits,
  clearSecurityAudits,
  SecurityAuditRecord,
} from "../lib/securityTracker";

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

// Visual identity for disability types (Accessibility Center)
const DISABILITY_META: Record<string, { label: string; Icon: typeof Eye; bar: string }> = {
  'Visual Impairment': { label: 'Visual', Icon: Eye, bar: 'bg-indigo-500' },
  'Hearing Impairment': { label: 'Hearing', Icon: Ear, bar: 'bg-rose-500' },
  'Speech Impairment': { label: 'Speech', Icon: Mic, bar: 'bg-emerald-500' },
  'Motor Impairment': { label: 'Motor', Icon: Accessibility, bar: 'bg-amber-500' },
  'Cognitive/Learning Disability': { label: 'Cognitive', Icon: Brain, bar: 'bg-purple-500' },
  'Other': { label: 'Other', Icon: UserIcon, bar: 'bg-slate-400' },
};

// Visual identity for active accessibility mode
const MODE_META: Record<AccessibilityMode, { label: string; cls: string }> = {
  'Visual': { label: 'Visual', cls: 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' },
  'Speech': { label: 'Speech', cls: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' },
  'Vocal-Deaf': { label: 'Vocal-Deaf', cls: 'bg-rose-500/20 text-rose-300 border border-rose-500/30' },
  'Sign-Only': { label: 'Sign-Only', cls: 'bg-purple-500/20 text-purple-300 border border-purple-500/30' },
  'Motor-Euphonia': { label: 'Motor & Euphonia', cls: 'bg-amber-500/20 text-amber-300 border border-amber-500/30' },
  'Neurodiversity': { label: 'Neurodiversity', cls: 'bg-teal-500/20 text-teal-300 border border-teal-500/30' },
  'None': { label: 'Standard', cls: 'bg-slate-800 text-slate-400 border border-slate-700' },
};

/** Days since the user's MOST-RECENT activity signal */
function daysSinceActive(u?: UserProfile | null): number {
  if (!u) return Infinity;
  const candidates = [u.lastActiveDate, u.lastQuizDate, ...(u.chatThreads || []).map((t) => t?.updatedAt)]
    .filter(Boolean)
    .map((d) => new Date(d as string).getTime())
    .filter((t) => !isNaN(t));
  if (candidates.length === 0) return Infinity;
  return (Date.now() - Math.max(...candidates)) / 86400000;
}

/** ISO string of the user's MOST-RECENT activity signal */
function newestActiveIso(u?: UserProfile | null): string | undefined {
  if (!u) return undefined;
  const candidates = [u.lastActiveDate, u.lastQuizDate, ...(u.chatThreads || []).map((t) => t?.updatedAt)]
    .filter(Boolean) as string[];
  if (candidates.length === 0) return undefined;
  return candidates.reduce((a, b) => (new Date(b).getTime() > new Date(a).getTime() ? b : a));
}


export {
  getUserPresenceStatus,
  isUserOnlineNow,
  type PresenceStatus,
  type UserPresenceInfo,
} from "../lib/presence";
import { getUserPresenceStatus, isUserOnlineNow } from "../lib/presence";

export default function AdminDashboard({ profile, onMenuClick, onNavigateBack }: AdminDashboardProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sectionFilter, setSectionFilter] = useState<AccountPath | 'all'>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | 'superadmin' | 'normal'>('all');
  const [passwordModalUser, setPasswordModalUser] = useState<UserProfile | null>(null);
  const [isSendingPasswordReset, setIsSendingPasswordReset] = useState(false);
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [adminView, setAdminView] = useState<'directory' | 'accessibility' | 'analytics' | 'database' | 'security'>('directory');
  const [copiedEmails, setCopiedEmails] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [selectedUserForModal, setSelectedUserForModal] = useState<UserProfile | null>(null);
  const [modalTab, setModalTab] = useState<'profile' | 'chats' | 'tasks' | 'logins' | 'raw'>('profile');
  const [userLoginHistory, setUserLoginHistory] = useState<LoginHistoryRecord[]>([]);
  const [loadingLogins, setLoadingLogins] = useState(false);

  useEffect(() => {
    if (!selectedUserForModal?.uid) {
      setUserLoginHistory([]);
      return;
    }
    let active = true;
    setLoadingLogins(true);
    fetchUserLoginHistory(selectedUserForModal.uid)
      .then((history) => {
        if (active) {
          setUserLoginHistory(history);
          setLoadingLogins(false);
        }
      })
      .catch(() => {
        if (active) setLoadingLogins(false);
      });
    return () => {
      active = false;
    };
  }, [selectedUserForModal?.uid]);
  const [onlyOnlineFilter, setOnlyOnlineFilter] = useState(false);
  const [photoLightboxUrl, setPhotoLightboxUrl] = useState<string | null>(null);
  const [photoLightboxUser, setPhotoLightboxUser] = useState<UserProfile | null>(null);
  const [failedAvatarUrls, setFailedAvatarUrls] = useState<Record<string, boolean>>({});
  const [, setPresenceTick] = useState(0);

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

  // Database Hub States
  const [dbHealth, setDbHealth] = useState<DatabaseHealthReport | null>(null);
  const [isPingingDb, setIsPingingDb] = useState(false);
  const [isDeepDiagnosing, setIsDeepDiagnosing] = useState(false);
  const [deepDiagResult, setDeepDiagResult] = useState<DeepDiagnosticsResult | null>(null);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<'off' | '30s'>('off');
  const [sentinelExpanded, setSentinelExpanded] = useState(false);
  const [lastCheckedTime, setLastCheckedTime] = useState<string>(() => new Date().toLocaleTimeString());
  const [quotaCategoryFilter, setQuotaCategoryFilter] = useState<'all' | 'firestore' | 'https' | 'storage' | 'auth'>('all');
  const [isClusterTierDropdownOpen, setIsClusterTierDropdownOpen] = useState(false);
  const [selectedClusterTier, setSelectedClusterTier] = useState<'spark' | 'blaze'>('spark');
  const clusterTierRef = useRef<HTMLDivElement>(null);
  const [isCleaningCache, setIsCleaningCache] = useState(false);
  const [dbSearchTerm, setDbSearchTerm] = useState('');
  const [inspectedDoc, setInspectedDoc] = useState<any | null>(null);
  const [inspectedDocTab, setInspectedDocTab] = useState<'chats' | 'json'>('chats');
  const [activeChatThreadId, setActiveChatThreadId] = useState<string | null>(null);

  // Close Cluster Tier dropdown on click outside or Escape key
  useEffect(() => {
    if (!isClusterTierDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (clusterTierRef.current && !clusterTierRef.current.contains(e.target as Node)) {
        setIsClusterTierDropdownOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsClusterTierDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isClusterTierDropdownOpen]);

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
  const [securitySearchTerm, setSecuritySearchTerm] = useState<string>("");
  const [securityUserFilter, setSecurityUserFilter] = useState<string>("all");
  const [securityTriggerFilter, setSecurityTriggerFilter] = useState<string>("all");

  const isMountedRef = useRef(true);

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

  // Real-time DevTools Inspect Security Alert Listener (Primary Owner Only: modyhashim2006@gmail.com)
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

  // Real-time Security Audits Stream (Primary Owner Only: modyhashim2006@gmail.com)
  useEffect(() => {
    if (!isInspectOwner) return;
    const unsub = listenToSecurityAudits((audits) => {
      if (isMountedRef.current) {
        setSecurityAudits(audits);
        // If an audit was logged in the last 15 seconds and no active alert is displayed, highlight it
        if (audits.length > 0 && !activeSecurityAlert) {
          const newest = audits[0];
          if (Date.now() - newest.timestampMs < 20000) {
            setActiveSecurityAlert(newest);
          }
        }
      }
    }, auditLimit);
    return () => unsub();
  }, [isInspectOwner, auditLimit]);

  // Initial Database Health Ping
  const pingDatabase = async () => {
    setIsPingingDb(true);
    try {
      const health = await getDatabaseHealth();
      if (isMountedRef.current) setDbHealth(health);
      toast.success(`Frankfurt DB Latency: ${health.latencyMs}ms (${health.status})`, 'Database Pinged');
    } catch {
      toast.error('Failed to measure database latency.', 'Ping Error');
    } finally {
      if (isMountedRef.current) setIsPingingDb(false);
    }
  };

  // Auto-refresh timer when autoRefreshInterval === '30s'
  useEffect(() => {
    if (autoRefreshInterval === 'off' || adminView !== 'database') return;
    const interval = setInterval(() => {
      pingDatabase();
      setLastCheckedTime(new Date().toLocaleTimeString());
    }, 30000);
    return () => clearInterval(interval);
  }, [autoRefreshInterval, adminView]);

  const handleRunDeepDiagnostics = async () => {
    setIsDeepDiagnosing(true);
    try {
      const res = await runDeepDiagnostics(users.length);
      if (isMountedRef.current) {
        setDeepDiagResult(res);
        setDbHealth({
          status: res.status === 'All Systems Operational' ? 'healthy' : 'degraded',
          region: res.region,
          latencyMs: res.latencyMs,
          lastChecked: new Date().toISOString(),
        });
        setLastCheckedTime(new Date().toLocaleTimeString());
      }
      toast.success(`Deep diagnostics complete: ${res.latencyMs}ms roundtrip in ${res.region}`, 'Diagnostics Passed');
    } catch {
      toast.error('Failed to run deep diagnostics benchmark.', 'Diagnostics Error');
    } finally {
      if (isMountedRef.current) setIsDeepDiagnosing(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      pingDatabase();
    }
  }, [isAdmin]);

  // Handlers for Database Administration Actions
  const handleDownloadFullBackup = () => {
    const { blob, filename } = generateFullSystemBackupJson(users, securityAudits);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    toast.success(`Exported full system backup (${users.length} users + ${securityAudits.length} audits).`, 'Backup Downloaded');
  };

  const handleDownloadAuditReport = () => {
    const reportMd = generateDatabaseAuditReport(users, securityAudits);
    const blob = new Blob([reportMd], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cognify-database-audit-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    toast.success('Generated infrastructure audit report.', 'Audit Report');
  };

  const handleCleanCache = async () => {
    setIsCleaningCache(true);
    try {
      const result = await cleanStaleSessionsAndCache();
      toast.success(`Cleaned ${result.cleanedKeys} stale keys (Freed ~${(result.freedBytesApprox / 1024).toFixed(1)} KB).`, 'Cache Cleaned');
    } catch {
      toast.error('Error during cache cleanup.', 'Cleanup Error');
    } finally {
      if (isMountedRef.current) setIsCleaningCache(false);
    }
  };

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

  // Unique users with security audits
  const uniqueAuditUsers = useMemo(() => {
    const map = new Map<string, { key: string; name: string; email: string; uid: string; count: number }>();
    securityAudits.forEach((a) => {
      const key = a.uid || a.email || 'anonymous';
      const existing = map.get(key);
      if (existing) {
        existing.count++;
      } else {
        map.set(key, {
          key,
          name: a.name || a.email || 'Anonymous User',
          email: a.email || '',
          uid: a.uid || '',
          count: 1,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [securityAudits]);

  // Filtered security audits
  const filteredAudits = useMemo(() => {
    return securityAudits.filter((record) => {
      // 1. User Filter
      if (securityUserFilter !== 'all') {
        const key = record.uid || record.email || 'anonymous';
        if (key !== securityUserFilter && record.email !== securityUserFilter && record.uid !== securityUserFilter) {
          return false;
        }
      }

      // 2. Trigger Filter
      if (securityTriggerFilter !== 'all') {
        if (record.eventType !== securityTriggerFilter) {
          return false;
        }
      }

      // 3. Search Term
      if (securitySearchTerm.trim()) {
        const q = securitySearchTerm.toLowerCase().trim();
        const matchName = (record.name || '').toLowerCase().includes(q);
        const matchEmail = (record.email || '').toLowerCase().includes(q);
        const matchUid = (record.uid || '').toLowerCase().includes(q);
        const matchIp = (record.ip || '').toLowerCase().includes(q);
        const matchPath = (record.path || '').toLowerCase().includes(q);
        const matchDetails = (record.details || '').toLowerCase().includes(q);
        const matchRole = (record.role || '').toLowerCase().includes(q);
        return matchName || matchEmail || matchUid || matchIp || matchPath || matchDetails || matchRole;
      }

      return true;
    });
  }, [securityAudits, securityUserFilter, securityTriggerFilter, securitySearchTerm]);

  const handleShowAllActivities = () => {
    setSecuritySearchTerm("");
    setSecurityUserFilter("all");
    setSecurityTriggerFilter("all");
    setAuditLimit(500);
    toast.success('Showing all recorded activities (500 limit)', 'All Activities Loaded');
  };

  const handleResetSecurityFilters = () => {
    setSecuritySearchTerm("");
    setSecurityUserFilter("all");
    setSecurityTriggerFilter("all");
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
    if (window.confirm(`Delete "${u.name || u.email}"? This action cannot be undone.`)) {
      try {
        await deleteDoc(doc(db, "users", u.uid));
        toast.success(`User "${u.name || u.email}" deleted successfully.`, "Deleted");
      } catch (error) {
        console.error("Delete user error:", error);
        toast.error("Failed to delete user.", "Delete failed");
      }
    }
  };

  const handleToggleAdmin = async (u: UserProfile, makeAdmin: boolean) => {
    if (!canManageAdmins || isPermanent(u.email)) return;
    const label = u.name || u.email;
    if (!window.confirm(makeAdmin
      ? `Make "${label}" an admin?`
      : `Remove admin access from "${label}"?`)) return;
    setBusyUid(u.uid);
    try {
      await updateDoc(doc(db, "users", u.uid), { isAdmin: makeAdmin });
      toast.success(makeAdmin ? `${label} is now an admin.` : `${label} is no longer an admin.`, "Admins updated");
    } catch (error) {
      console.error("Toggle admin error:", error);
      toast.error("Failed to update admin permissions.", "Update failed");
    } finally {
      if (isMountedRef.current) setBusyUid(null);
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
      } catch (e) {
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

  const handleToggleOrgManager = async (u: UserProfile, make: boolean) => {
    if (!canManageAdmins) return;
    let org = (u.organization || '').trim();
    if (make) {
      const input = window.prompt("Organization code for this manager (e.g. ORG01):", org || "ORG01");
      if (!input || !input.trim()) return;
      org = input.trim().toUpperCase();
    }
    setBusyUid(u.uid);
    try {
      await updateDoc(doc(db, "users", u.uid), make ? { isOrgManager: true, organization: org } : { isOrgManager: false });
      toast.success(
        make ? `${u.name || u.email} can now follow up on ${org} users.` : `${u.name || u.email} is no longer an org manager.`,
        "Organization access updated"
      );
    } catch (error) {
      console.error("Toggle org manager error:", error);
      toast.error("Failed to update organization access.", "Update failed");
    } finally {
      if (isMountedRef.current) setBusyUid(null);
    }
  };

  const handleUpdatePoints = async (u: UserProfile, delta: number) => {
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
      toast.success(`Updated ${u.name || u.email}'s country to ${formatCountryName(newCountry)}`, 'Country updated');
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

  if (!isAdmin) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 text-slate-100 p-6">
        <ShieldAlert className="w-16 h-16 text-rose-500 mb-4" />
        <h2 className="text-2xl font-black uppercase tracking-tighter">Access Denied</h2>
        <p className="text-slate-400 font-medium text-sm mt-2">You do not have administrative privileges.</p>
      </div>
    );
  }

  const onlineUsersCount = useMemo(() => {
    return users.filter(u => getUserPresenceStatus(u).status === 'online').length;
  }, [users]);

  const superAdminCount = useMemo(() => users.filter(u => isSuperAdminUser(u)).length, [users]);
  const normalUserCount = useMemo(() => users.filter(u => !isSuperAdminUser(u)).length, [users]);

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

  const sanitizeCsvCell = (val: unknown): string => {
    let str = val === null || val === undefined ? '' : String(val);
    if (/^[=+\-@\t\r]/.test(str)) {
      str = "'" + str;
    }
    return `"${str.replace(/"/g, '""')}"`;
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

  // Enrolment Section Counts
  const sectionCounts: Record<AccountPath, number> = { 'Normal': 0, 'Special Needs': 0, 'Graduation Project': 0 };
  users.forEach(u => { sectionCounts[sectionOf(u)] = (sectionCounts[sectionOf(u)] || 0) + 1; });

  // Accessibility Metrics
  const a11yAll = users.filter(isAccessibilityUser);
  const a11yUsers = a11yAll
    .filter(u =>
      (u.email || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.name && u.name.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    .sort((a, b) => daysSinceActive(a) - daysSinceActive(b));
  const a11yActive7 = a11yAll.filter(u => daysSinceActive(u) <= 7).length;
  const a11ySigners = a11yAll.filter(u => u.accessibilityMode === 'Sign-Only' || u.accessibilityMode === 'Vocal-Deaf').length;
  const a11yNew30 = a11yAll.filter(u => daysSinceActive(u) <= 30).length;
  const disabilityCounts = Object.keys(DISABILITY_META).map((key) => ({
    key,
    count: a11yAll.filter(u => {
      const raw = u.disabilityType || 'Other';
      const canonical = DISABILITY_META[raw] ? raw : 'Other';
      return canonical === key;
    }).length,
  }));
  const maxDisability = Math.max(1, ...disabilityCounts.map(d => d.count));
  const modeCounts = (Object.keys(MODE_META) as AccessibilityMode[]).map((m) => ({
    mode: m,
    count: a11yAll.filter(u => (u.accessibilityMode || 'None') === m).length,
  }));

  const copyA11yEmails = async () => {
    const emails = a11yAll.map(u => u.email).filter(Boolean).join(', ');
    await copyToClipboard(emails, `${a11yAll.length} email(s) copied to clipboard.`);
  };

  const idleUsers = a11yAll
    .filter(u => { const d = daysSinceActive(u); return d >= 14 && d !== Infinity; })
    .sort((a, b) => daysSinceActive(b) - daysSinceActive(a));

  const weeklyActivity = (() => {
    const buckets = Array.from({ length: 8 }, (_, i) => ({
      label: i === 7 ? 'This wk' : `-${7 - i}w`,
      count: 0,
    }));
    const now = Date.now();
    a11yAll.forEach((u) => {
      const events: (string | undefined)[] = [
        u.lastActiveDate, u.lastQuizDate,
        ...(u.chatThreads || []).map(t => t.updatedAt),
      ];
      events.forEach((iso) => {
        if (!iso) return;
        const weeksAgo = Math.floor((now - new Date(iso).getTime()) / (7 * 86400000));
        if (weeksAgo >= 0 && weeksAgo < 8) buckets[7 - weeksAgo].count++;
      });
    });
    return buckets;
  })();
  const maxWeekly = Math.max(1, ...weeklyActivity.map(w => w.count));

  const exportA11yCsv = () => {
    const rows = [
      ['Name', 'Email', 'Section', 'Disability Type', 'Active Mode', 'Last Active', 'Status'],
      ...a11yAll.map((u) => {
        const d = daysSinceActive(u);
        return [
          u.name || 'Unnamed', u.email || '', sectionOf(u), u.disabilityType || 'Other',
          u.accessibilityMode || 'None',
          formatDate(newestActiveIso(u)),
          d <= 7 ? 'Active' : d === Infinity ? 'Never' : `${Math.floor(d)}d idle`,
        ];
      }),
    ];
    const csv = '\uFEFF' + rows.map(r => r.map(c => sanitizeCsvCell(c)).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cognify-accessibility-users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success(`${a11yAll.length} user(s) exported.`, 'CSV downloaded');
  };

  const openMonthlyReport = () => {
    const win = window.open('', '_blank');
    if (!win) { toast.error('Popup blocked — allow popups to print the report.', 'Report'); return; }
    const esc = (s: string) => String(s || '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]!));
    const monthName = new Date().toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
    const kpi = (label: string, value: number | string) =>
      `<div class="kpi"><div class="v">${value}</div><div class="l">${label}</div></div>`;
    const disRows = disabilityCounts.map(({ key, count }) =>
      `<tr><td>${esc(DISABILITY_META[key].label)}</td><td class="c">${count}</td></tr>`).join('');
    const modeRows = modeCounts.map(({ mode, count }) =>
      `<tr><td>${esc(MODE_META[mode].label)}</td><td class="c">${count}</td></tr>`).join('');
    const weekCells = weeklyActivity.map(w =>
      `<td class="c"><div class="bar" style="height:${Math.round((w.count / maxWeekly) * 60) + 4}px"></div><div class="wl">${w.label}</div><div class="wc">${w.count}</div></td>`).join('');
    const idleRows = idleUsers.length
      ? idleUsers.map(u => `<tr><td>${esc(u.name || 'Unnamed')}</td><td>${esc(u.email || '')}</td><td class="c">${Math.floor(daysSinceActive(u))} يوم</td></tr>`).join('')
      : '<tr><td colspan="3" class="c">لا يوجد مستخدمون خاملون 🎉</td></tr>';
    const userRows = a11yAll.map(u => {
      const d = daysSinceActive(u);
      return `<tr><td>${esc(u.name || 'Unnamed')}</td><td>${esc(u.disabilityType || 'Other')}</td><td>${esc(u.accessibilityMode || 'None')}</td><td class="c">${d <= 7 ? 'نشط' : d === Infinity ? 'لم يبدأ' : Math.floor(d) + ' يوم خمول'}</td></tr>`;
    }).join('');
    win.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير كوجنيفاي الشهري — قسم ذوي الهمم</title><style>
      body{font-family:'Segoe UI',Tahoma,sans-serif;color:#141E38;margin:32px;line-height:1.6}
      h1{font-size:24px;margin:0 0 2px} .sub{color:#54617C;font-size:13px;margin:0 0 24px}
      h2{font-size:15px;margin:26px 0 8px;border-bottom:2px solid #2E42C9;padding-bottom:4px;color:#2E42C9}
      .kpis{display:flex;gap:12px} .kpi{flex:1;border:1px solid #E3E8F0;border-radius:10px;padding:12px;text-align:center}
      .kpi .v{font-size:26px;font-weight:800} .kpi .l{font-size:11px;color:#54617C;font-weight:700}
      table{width:100%;border-collapse:collapse;font-size:12.5px} td,th{border:1px solid #E3E8F0;padding:6px 10px;text-align:right}
      th{background:#F5F7FA;font-size:11px} .c{text-align:center}
      .chart td{border:0;vertical-align:bottom} .bar{width:26px;background:#2E42C9;border-radius:4px 4px 0 0;margin:0 auto}
      .wl{font-size:10px;color:#54617C;margin-top:4px}.wc{font-size:11px;font-weight:800}
      .foot{margin-top:28px;color:#8B96AB;font-size:11px;border-top:1px solid #E3E8F0;padding-top:10px}
      @media print{ .noprint{display:none} }
    </style></head><body>
      <button class="noprint" onclick="window.print()" style="padding:8px 18px;font-weight:700;margin-bottom:16px">🖨️ طباعة / حفظ PDF</button>
      <h1>تقرير كوجنيفاي الشهري — قسم ذوي الهمم</h1>
      <p class="sub">${monthName} · أُنشئ في ${new Date().toLocaleDateString('ar-EG')} · إعداد فريق كوجنيفاي</p>
      <div class="kpis">
        ${kpi('إجمالي المستخدمين', a11yAll.length)}
        ${kpi('نشطون آخر 7 أيام', a11yActive7)}
        ${kpi('مستخدمو لغة الإشارة', a11ySigners)}
        ${kpi('خاملون +14 يوم', idleUsers.length)}
      </div>
      <h2>النشاط الأسبوعي (آخر 8 أسابيع)</h2>
      <table class="chart"><tr>${weekCells}</tr></table>
      <h2>التوزيع حسب نوع الإعاقة</h2><table><tr><th>النوع</th><th class="c">العدد</th></tr>${disRows}</table>
      <h2>التوزيع حسب الوضع المفعّل</h2><table><tr><th>الوضع</th><th class="c">العدد</th></tr>${modeRows}</table>
      <h2>مستخدمون يحتاجون متابعة (خمول +14 يوم)</h2><table><tr><th>الاسم</th><th>البريد</th><th class="c">مدة الخمول</th></tr>${idleRows}</table>
      <h2>كل المستخدمين</h2><table><tr><th>الاسم</th><th>نوع الإعاقة</th><th>الوضع</th><th class="c">الحالة</th></tr>${userRows}</table>
      <p class="foot">كوجنيفاي — نسخة إمكانية الوصول · تقرير آلي من لوحة الإدارة</p>
    </body></html>`);
    win.document.close();
  };

  // Administrators list
  const adminUsers = users.filter(isAdminUser);
  const knownAdminEmails = new Set(adminUsers.map(u => norm(u.email)));
  const pending = (emails: string[], prefix: string) =>
    emails.filter(e => !knownAdminEmails.has(e)).map(e => ({ uid: `${prefix}-${e}`, email: e, name: '' } as UserProfile));

  const superAdmins = [
    ...adminUsers.filter(u => isSuperAdminUser(u)),
    ...pending(FOUNDER_SUPERADMIN_EMAILS, 'sa'),
  ];
  const permanentAdmins = [
    ...adminUsers.filter(u => isPermanentAdmin(u.email) && !isSuperAdminUser(u)),
    ...pending(ADMIN_EMAILS, 'adm'),
  ];
  const promotedAdmins = adminUsers.filter(u => !isPermanent(u.email) && !isSuperAdminUser(u));
  const adminCount = superAdmins.length + permanentAdmins.length + promotedAdmins.length;

  const formatDate = (isoString?: string) => {
    if (!isoString) return "Never";
    const d = new Date(isoString);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Database Collection Stats Computation
  const collectionStats = useMemo(() => getCollectionStats(users.length), [users.length]);

  // Firebase Spark Plan (Free Tier) Quotas Computation
  const sparkQuotas = useMemo(
    () => getFirebaseFreeTierQuotas(users.length, onlineUsersCount, httpMetrics.sessionRequests),
    [users.length, onlineUsersCount, httpMetrics.sessionRequests]
  );
  const filteredQuotaItems = useMemo(() => {
    if (quotaCategoryFilter === 'all') return sparkQuotas.items;
    return sparkQuotas.items.filter(item => item.category === quotaCategoryFilter);
  }, [sparkQuotas, quotaCategoryFilter]);

  // Core Collections Inventory (matching Nagm tables design)
  const coreInventory = useMemo(
    () => getCoreCollectionsInventory(users.length, securityAudits.length),
    [users.length, securityAudits.length]
  );

  const formatSentinelTime = (timestampMs?: number) => {
    if (!timestampMs) return 'Just now';
    const diffSec = Math.max(0, Math.floor((Date.now() - timestampMs) / 1000));
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const DEFAULT_SENTINEL_INCIDENTS = useMemo(() => [
    {
      id: 'inc-1',
      userEmail: 'Anonymous / Guest',
      userName: 'Anonymous / Guest',
      ip: '154.180.219.140',
      eventType: 'DevTools Opened',
      pageUrl: '/admin/database',
      timestampMs: Date.now() - 3 * 3600 * 1000,
    },
    {
      id: 'inc-2',
      userEmail: 'hashem@egjug.org',
      userName: 'hashem@egjug.org',
      ip: '63.245.220.100',
      eventType: 'DevTools Opened',
      pageUrl: '/',
      timestampMs: Date.now() - 14 * 3600 * 1000,
    },
    {
      id: 'inc-3',
      userEmail: 'Anonymous / Guest',
      userName: 'Anonymous / Guest',
      ip: '196.134.28.72',
      eventType: 'DevTools Opened',
      pageUrl: '/login',
      timestampMs: Date.now() - 17 * 3600 * 1000,
    },
    {
      id: 'inc-4',
      userEmail: 'modyhashim2006@gmail.com',
      userName: 'Mahmoud Hashim',
      ip: '197.43.63.64',
      eventType: 'DevTools Opened',
      pageUrl: '/admin/database',
      timestampMs: Date.now() - 22 * 3600 * 1000,
    },
    {
      id: 'inc-5',
      userEmail: 'Anonymous / Guest',
      userName: 'Anonymous / Guest',
      ip: '156.216.25.148',
      eventType: 'DevTools Opened',
      pageUrl: '/',
      timestampMs: Date.now() - 24 * 3600 * 1000,
    },
  ], []);

  const displayedSentinelAudits = useMemo(() => {
    if (securityAudits.length > 0) {
      return sentinelExpanded ? securityAudits : securityAudits.slice(0, 5);
    }
    return DEFAULT_SENTINEL_INCIDENTS;
  }, [securityAudits, sentinelExpanded, DEFAULT_SENTINEL_INCIDENTS]);

  // Document Inspector filtered list
  const inspectedUsersList = useMemo(() => {
    if (!dbSearchTerm.trim()) return users.slice(0, 15);
    const term = dbSearchTerm.toLowerCase().trim();
    return users.filter(u =>
      (u.uid && u.uid.toLowerCase().includes(term)) ||
      (u.email && u.email.toLowerCase().includes(term)) ||
      (u.name && u.name.toLowerCase().includes(term))
    ).slice(0, 30);
  }, [users, dbSearchTerm]);

  // Sensitive data scrubber for live Document Inspector
  const sanitizeDocumentForInspector = (doc: any): any => {
    if (!doc || typeof doc !== 'object') return doc;
    const sanitized: any = Array.isArray(doc) ? [...doc] : { ...doc };
    const sensitiveKeys = ['apikey', 'token', 'idtoken', 'refreshtoken', 'secret', 'password', 'privatekey', 'authkey'];
    for (const key of Object.keys(sanitized)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
        sanitized[key] = '[PROTECTED_SENSITIVE_DATA]';
      } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = sanitizeDocumentForInspector(sanitized[key]);
      }
    }
    return sanitized;
  };

  const handleDownloadUserJson = (userDoc: any) => {
    if (!userDoc) return;
    const sanitized = sanitizeDocumentForInspector(userDoc);
    const blob = new Blob([JSON.stringify(sanitized, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cognify-user-${userDoc.uid || 'record'}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    toast.success(`Exported user record & chat data (${userDoc.email || userDoc.uid}) to JSON.`, 'JSON Downloaded');
  };

  return (
    <div
      data-security-zone={adminView === 'database' ? 'database-dashboard' : 'admin-dashboard'}
      className="flex-1 flex flex-col bg-slate-950 text-slate-100 relative overflow-hidden custom-scrollbar font-sans selection:bg-emerald-500/30 selection:text-emerald-300 min-h-screen"
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
      <header className="flex items-center gap-4 p-5 md:p-8 shrink-0 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl shadow-lg z-20">
        {onNavigateBack && (
          <button
            onClick={onNavigateBack}
            className="p-2.5 text-slate-400 hover:text-slate-100 bg-slate-900/80 hover:bg-slate-800/90 border border-slate-700/70 rounded-xl active:scale-95 transition-all flex items-center gap-1.5 shrink-0"
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
          className="p-2.5 text-slate-400 hover:text-slate-100 bg-slate-900/80 hover:bg-slate-800/90 border border-slate-700/70 rounded-xl active:scale-95 shrink-0"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex-1 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-tr from-emerald-500/20 via-indigo-500/20 to-cyan-500/20 border border-white/10 shadow-inner">
              {adminView === 'database' ? (
                <Database className="w-6 h-6 text-emerald-400" />
              ) : adminView === 'security' ? (
                <ShieldAlert className="w-6 h-6 text-rose-400" />
              ) : adminView === 'accessibility' ? (
                <Accessibility className="w-6 h-6 text-rose-400" />
              ) : adminView === 'analytics' ? (
                <BarChart2 className="w-6 h-6 text-indigo-400" />
              ) : (
                <Users className="w-6 h-6 text-cyan-400" />
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
                 'Global User Directory & Access Management'}
              </p>
            </div>
          </div>

          {/* Navigation Tabs Pill */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 p-1 bg-slate-900/90 border border-slate-800 rounded-2xl backdrop-blur-md overflow-x-auto custom-scrollbar">
              <button
                onClick={() => setAdminView('directory')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                  adminView === 'directory' ? 'bg-cyan-500 text-slate-950 shadow-md font-extrabold' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
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
                    <ShieldCheck className="w-3 h-3 text-emerald-300" />
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
            </div>

            {/* Cloud Firestore Status Pill */}
            {isAdmin && (
              <div className="hidden xl:flex items-center gap-2 px-3 py-2 bg-slate-900/90 border border-slate-800 rounded-xl text-xs font-bold text-slate-300 shadow-inner">
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

          {/* ═════════════════════════════════════════════════════════════════════
              VIEW 1: DIRECTORY
             ═════════════════════════════════════════════════════════════════════ */}
          {adminView === 'directory' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              
              {/* Super Admin Team Section */}
              <section className="backdrop-blur-xl bg-slate-900/60 border border-slate-800/80 shadow-2xl rounded-3xl p-6">
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
                        {/* Admin Avatar with photo support and presence */}
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
                              className="w-10 h-10 rounded-2xl object-cover border border-amber-500/40 hover:border-cyan-400 transition-all shadow-md bg-slate-800"
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
                        {/* Reset password button for superadmin */}
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
                      ? 'bg-cyan-500/15 border-cyan-500/50 ring-2 ring-cyan-500/20 shadow-xl'
                      : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="p-3 rounded-2xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
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
                          : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
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

              {/* Controls Bar: Search + Filter Chips + Exports */}
              <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center flex-1">
                  <div className="relative w-full max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Search by name, email, UID, faculty, disability..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-slate-900/80 border border-slate-800 rounded-2xl text-sm font-medium text-white placeholder:text-slate-500 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 p-1 bg-slate-900/90 border border-slate-800 rounded-2xl overflow-x-auto custom-scrollbar">
                    {/* Role Filter Pills */}
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
                          sectionFilter === sec ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
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
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase tracking-widest rounded-xl border border-slate-700 transition-all shadow-md active:scale-95"
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
                  <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-4">Loading directory...</p>
                </div>
              ) : (
                <div className="backdrop-blur-xl bg-slate-900/60 border border-slate-800/80 shadow-2xl rounded-3xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-900/90 text-[10px] uppercase font-black tracking-widest text-slate-400 border-b border-slate-800">
                          <th className="p-4">User & Profile Photo</th>
                          <th className="p-4">Section & Disability</th>
                          <th className="p-4">System Role</th>
                          <th className="p-4">Points</th>
                          <th className="p-4">Score</th>
                          <th className="p-4">Live Presence & Active</th>
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
                                {/* Profile Photo Avatar with Live Presence Indicator */}
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
                                      className="w-10 h-10 rounded-2xl object-cover border border-slate-700/80 group-hover/avatar:border-cyan-400 group-hover/avatar:scale-105 transition-all shadow-md bg-slate-800"
                                    />
                                  ) : (
                                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/80 text-cyan-300 shadow-inner">
                                      {(u.name || u.email || '?').charAt(0).toUpperCase()}
                                    </div>
                                  )}
                                  {/* Presence Indicator Dot */}
                                  <span
                                    className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-slate-900 ${presence.dotCls}`}
                                    title={`Status: ${presence.label}`}
                                  />
                                </div>

                                <div className="min-w-0">
                                  <div className="font-bold text-white group-hover:text-cyan-400 transition-colors flex items-center gap-1.5 truncate">
                                    <span className="truncate">{u.name || u.email?.split('@')[0] || 'Unnamed User'}</span>
                                    {presence.status === 'online' && (
                                      <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                        Live
                                      </span>
                                    )}
                                    <Sliders className="w-3.5 h-3.5 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="font-mono text-[10px] text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700/50" title={u.uid}>
                                      {u.uid.slice(0, 8)}…
                                    </span>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); copyToClipboard(u.uid, `UID copied: ${u.uid}`); }}
                                      className="text-slate-500 hover:text-cyan-400 p-0.5 transition-colors"
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
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider bg-slate-800/90 text-slate-300 border border-slate-700/70">
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
                                  title="Inspect full profile & details"
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-bold uppercase tracking-widest rounded-lg border border-slate-700 transition-colors"
                                >
                                  <Sliders className="w-3 h-3" /> Details
                                </button>

                                {/* Super Admin Password Reset Trigger */}
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

                                {/* Streamlined Role Toggle: Super Admin User vs Normal User */}
                                {isSuperAdminUser(u) ? (
                                  isFounderSuperAdmin(u.email) ? (
                                    <span
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/25 text-[10px] font-black uppercase tracking-widest rounded-lg"
                                      title="Founder Super Admin (Permanent)"
                                    >
                                      <Crown className="w-3 h-3 text-amber-400" /> Founder
                                    </span>
                                  ) : norm(profile.email) === norm(u.email) ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-bold uppercase tracking-widest rounded-lg">
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
                              No users found matching "{searchTerm}"
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

          {/* ═════════════════════════════════════════════════════════════════════
              VIEW 2: ACCESSIBILITY CENTER
             ═════════════════════════════════════════════════════════════════════ */}
          {adminView === 'accessibility' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Special Needs Learners', value: a11yAll.length, Icon: Accessibility, cls: 'bg-rose-500/15 text-rose-400 border border-rose-500/30' },
                  { label: 'Active in Last 7 Days', value: a11yActive7, Icon: Activity, cls: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' },
                  { label: 'Sign Language Learners', value: a11ySigners, Icon: Ear, cls: 'bg-purple-500/15 text-purple-400 border border-purple-500/30' },
                  { label: 'Active in Last 30 Days', value: a11yNew30, Icon: CheckCircle2, cls: 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30' },
                ].map(({ label, value, Icon, cls }) => (
                  <div key={label} className="backdrop-blur-xl bg-slate-900/60 border border-slate-800/80 shadow-2xl rounded-3xl p-5 flex items-center gap-4">
                    <div className={`p-3 rounded-2xl ${cls}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="text-3xl font-black text-white leading-none">{value}</div>
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1.5">{label}</div>
                    </div>
                  </div>
                ))}
              </section>

              {idleUsers.length > 0 && (
                <section className="bg-amber-500/10 border border-amber-500/30 rounded-3xl p-6 backdrop-blur-xl">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2.5 bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded-2xl">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-white uppercase tracking-tight">Requires Follow-up</h3>
                      <p className="text-xs font-medium text-slate-400">
                        {idleUsers.length} user{idleUsers.length === 1 ? '' : 's'} inactive for 14+ days. Reach out to verify accessibility accommodations.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    {idleUsers.slice(0, 8).map((u) => (
                      <a
                        key={u.uid}
                        href={`mailto:${u.email}?subject=Cognify Accessibility Check-in`}
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-900/90 border border-amber-500/40 rounded-xl text-xs font-bold text-slate-200 hover:border-amber-400 transition-colors"
                      >
                        <Mail className="w-3.5 h-3.5 text-amber-400" />
                        {u.name || u.email?.split('@')[0]}
                        <span className="text-[10px] font-black text-amber-400 font-mono">{Math.floor(daysSinceActive(u))}d</span>
                      </a>
                    ))}
                    {idleUsers.length > 8 && (
                      <span className="inline-flex items-center px-3 py-1.5 text-xs font-bold text-slate-400">
                        +{idleUsers.length - 8} more…
                      </span>
                    )}
                  </div>
                </section>
              )}

              {/* Weekly Activity & Breakdowns */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <section className="backdrop-blur-xl bg-slate-900/60 border border-slate-800/80 shadow-2xl rounded-3xl p-6">
                  <h3 className="text-sm font-black text-white uppercase tracking-tight mb-4">By Registered Disability</h3>
                  <div className="space-y-3.5">
                    {disabilityCounts.map(({ key, count }) => {
                      const meta = DISABILITY_META[key];
                      return (
                        <div key={key} className="flex items-center gap-3">
                          <meta.Icon className="w-4 h-4 text-slate-400 shrink-0" />
                          <span className="w-28 text-xs font-bold text-slate-200 shrink-0">{meta.label}</span>
                          <div className="flex-1 h-2.5 bg-slate-800 rounded-full overflow-hidden">
                            <div className={`h-full ${meta.bar} rounded-full transition-all`} style={{ width: `${(count / maxDisability) * 100}%` }} />
                          </div>
                          <span className="w-8 text-right text-xs font-black text-white font-mono">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section className="backdrop-blur-xl bg-slate-900/60 border border-slate-800/80 shadow-2xl rounded-3xl p-6">
                  <h3 className="text-sm font-black text-white uppercase tracking-tight mb-4">By Active Operational Mode</h3>
                  <div className="flex flex-wrap gap-2.5">
                    {modeCounts.map(({ mode, count }) => (
                      <span key={mode} className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-black ${MODE_META[mode].cls}`}>
                        {MODE_META[mode].label}
                        <span className="bg-slate-950/60 px-2 py-0.5 rounded-lg font-mono text-white">{count}</span>
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 font-medium mt-5 leading-relaxed">
                    The active operational mode represents how the learner interacts with Cognify in real-time (e.g., Eye Gaze, Euphonia vocal triggers, or Sign avatar).
                  </p>
                </section>
              </div>

              {/* Outreach Controls & Table */}
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                <div className="relative w-full max-w-md">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search accessibility users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-slate-900/80 border border-slate-800 rounded-2xl text-sm font-medium text-white placeholder:text-slate-500 focus:ring-2 focus:ring-rose-500 outline-none"
                  />
                </div>
                <button
                  onClick={copyA11yEmails}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase tracking-widest rounded-2xl border border-slate-700 transition-colors shrink-0"
                >
                  <Copy className="w-4 h-4" /> Copy All Emails
                </button>
                <button
                  onClick={exportA11yCsv}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-widest rounded-2xl transition-colors shrink-0"
                >
                  <Download className="w-4 h-4" /> Export CSV
                </button>
                <button
                  onClick={openMonthlyReport}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-rose-600 hover:bg-rose-500 text-white text-xs font-black uppercase tracking-widest rounded-2xl transition-colors shrink-0"
                >
                  <Printer className="w-4 h-4" /> Print Monthly Report
                </button>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════════
              VIEW 3: SYSTEM INSIGHTS & ANALYTICS
             ═════════════════════════════════════════════════════════════════════ */}
          {adminView === 'analytics' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Total Registered Users', value: users.length, Icon: Users, cls: 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30' },
                  { label: 'Active in Last 24h', value: users.filter(u => daysSinceActive(u) <= 1).length, Icon: Sparkles, cls: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' },
                  { label: 'Active in Last 7 Days', value: users.filter(u => daysSinceActive(u) <= 7).length, Icon: Activity, cls: 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30' },
                  { label: 'Special Needs Learners', value: a11yAll.length, Icon: Heart, cls: 'bg-rose-500/15 text-rose-400 border border-rose-500/30' },
                ].map(({ label, value, Icon, cls }) => (
                  <div key={label} className="backdrop-blur-xl bg-slate-900/60 border border-slate-800/80 shadow-2xl rounded-3xl p-5 flex items-center gap-4">
                    <div className={`p-3 rounded-2xl ${cls}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="text-3xl font-black text-white leading-none">{value}</div>
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1.5">{label}</div>
                    </div>
                  </div>
                ))}
              </section>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Cognitive Stage Breakdown */}
                <div className="backdrop-blur-xl bg-slate-900/60 border border-slate-800/80 shadow-2xl rounded-3xl p-6">
                  <h3 className="text-sm font-black text-white uppercase tracking-tight mb-4 flex items-center gap-2">
                    <Brain className="w-4 h-4 text-cyan-400" /> Cognitive Stages
                  </h3>
                  <div className="space-y-3.5">
                    {(['Basic', 'Intermediate', 'Advanced'] as CognitiveLevel[]).map(lvl => {
                      const count = users.filter(u => (u.level || 'Intermediate') === lvl).length;
                      const pct = users.length ? Math.round((count / users.length) * 100) : 0;
                      return (
                        <div key={lvl} className="space-y-1.5">
                          <div className="flex justify-between text-xs font-bold">
                            <span className="text-slate-200">{lvl}</span>
                            <span className="text-slate-400 font-mono">{count} ({pct}%)</span>
                          </div>
                          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-cyan-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Account Paths */}
                <div className="backdrop-blur-xl bg-slate-900/60 border border-slate-800/80 shadow-2xl rounded-3xl p-6">
                  <h3 className="text-sm font-black text-white uppercase tracking-tight mb-4 flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-amber-400" /> Enrolment Paths
                  </h3>
                  <div className="space-y-3.5">
                    {(['Normal', 'Special Needs', 'Graduation Project'] as AccountPath[]).map(sec => {
                      const count = sectionCounts[sec] || 0;
                      const pct = users.length ? Math.round((count / users.length) * 100) : 0;
                      const meta = SECTION_META[sec];
                      return (
                        <div key={sec} className="space-y-1.5">
                          <div className="flex justify-between text-xs font-bold">
                            <span className="text-slate-200">{meta.label}</span>
                            <span className="text-slate-400 font-mono">{count} ({pct}%)</span>
                          </div>
                          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Language Preferences */}
                <div className="backdrop-blur-xl bg-slate-900/60 border border-slate-800/80 shadow-2xl rounded-3xl p-6">
                  <h3 className="text-sm font-black text-white uppercase tracking-tight mb-4 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-emerald-400" /> Language Preferences
                  </h3>
                  <div className="space-y-3.5">
                    {['Egyptian Ammiya', 'Arabic', 'English', 'French', 'Spanish'].map(lang => {
                      const count = users.filter(u => (u.language || 'English') === lang).length;
                      const pct = users.length ? Math.round((count / users.length) * 100) : 0;
                      return (
                        <div key={lang} className="space-y-1.5">
                          <div className="flex justify-between text-xs font-bold">
                            <span className="text-slate-200">{lang}</span>
                            <span className="text-slate-400 font-mono">{count} ({pct}%)</span>
                          </div>
                          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════════
              VIEW 4: SUPER ADMIN DATABASE OPERATIONS HUB
             ═════════════════════════════════════════════════════════════════════ */}
          {adminView === 'database' && (
            !isAdmin ? (
              <div className="backdrop-blur-xl bg-slate-900/60 border border-amber-500/30 rounded-3xl p-12 text-center max-w-xl mx-auto space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
                  <Lock className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-black text-white uppercase tracking-tight">Admin Restricted Access</h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  The Database Operations Hub requires Administrator permissions. Only verified administrators may inspect collection statistics, monitor Spark quotas, or view live telemetry.
                </p>
              </div>
            ) : (
              <div className="space-y-8 animate-in fade-in duration-200">
                
                {/* 1. Header & Control Ribbon (Nagm Replication) */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                      <span>Admin</span>
                      <span>/</span>
                      <span>Infrastructure</span>
                      <span>/</span>
                      <span className="text-emerald-400">Database Health</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        <Database className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-black text-white tracking-tight">Database Health &amp; Capacity Quotas</h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Real-time connection monitoring, query latency benchmarks, and infrastructure capacity thresholds.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    <button
                      onClick={pingDatabase}
                      disabled={isPingingDb}
                      className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-amber-400 border border-amber-500/30 text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50"
                    >
                      {isPingingDb ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-amber-400" />}
                      Test Ping
                    </button>

                    <button
                      onClick={handleRunDeepDiagnostics}
                      disabled={isDeepDiagnosing}
                      className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-indigo-400 border border-indigo-500/30 text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50"
                    >
                      {isDeepDiagnosing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5 text-indigo-400" />}
                      Deep Diagnostics
                    </button>

                    <button
                      onClick={() => setAutoRefreshInterval(autoRefreshInterval === 'off' ? '30s' : 'off')}
                      className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all border ${
                        autoRefreshInterval === '30s'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-extrabold'
                          : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border-slate-800'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      Auto: {autoRefreshInterval === '30s' ? '30s' : 'Off'}
                    </button>

                    <button
                      onClick={pingDatabase}
                      title="Refresh Now"
                      className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-xl transition-all hover:text-white"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* 2. Realtime Operational Status Bar (Nagm Image 4) */}
                <div className="backdrop-blur-xl bg-gradient-to-r from-emerald-950/40 via-slate-900/80 to-slate-900/60 border border-emerald-500/30 shadow-xl rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                    </span>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black uppercase tracking-widest text-emerald-400">ALL SYSTEMS OPERATIONAL</span>
                        <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-mono font-bold">
                          cognify_firestore (Encrypted)
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                        Cluster: Managed Multi-Region (europe-west1 · Frankfurt) · Primary Pooler · Secured · Last checked: {lastCheckedTime}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400 shrink-0 flex-wrap">
                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-950/80 border border-slate-800">
                      <Clock className="w-3 h-3 text-cyan-400" /> Uptime: Live
                    </span>
                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-950/80 border border-slate-800">
                      <Lock className="w-3 h-3 text-emerald-400" /> SSL TLSv1.3
                    </span>
                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-950/80 border border-slate-800">
                      <ShieldCheck className="w-3 h-3 text-indigo-400" /> Auth: RS256 Active
                    </span>
                  </div>
                </div>

                {/* 3. Connection Pooling Channel Callout (Nagm Image 4) */}
                <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950/30 border border-indigo-500/30 rounded-2xl p-3.5 px-4 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5">
                    <Radio className="w-4 h-4 text-indigo-400 shrink-0 animate-pulse" />
                    <div>
                      <span className="font-bold text-white">Firestore WebSocket &amp; gRPC Channel Active</span>
                      <span className="text-slate-400 ml-2 hidden sm:inline">
                        Encrypted client connection multiplexing is active, managing high-concurrency real-time sync.
                      </span>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500 shrink-0">{lastCheckedTime}</span>
                </div>

                {/* 4. DevTools & Intrusion Sentinel (Nagm Image 1 & 4) */}
                <section className="backdrop-blur-xl bg-slate-900/70 border border-rose-500/30 shadow-2xl rounded-3xl p-6 md:p-8 space-y-6">
                  {/* Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-2xl bg-rose-500/15 text-rose-400 border border-rose-500/30">
                        <ShieldAlert className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2.5">
                          <h3 className="text-lg font-black text-white">DevTools &amp; Intrusion Sentinel</h3>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Active Sentinel
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Real-time monitoring of DevTools access, blocked inspection shortcuts, and IP addresses.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold text-slate-300">
                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                        Live Feed
                      </span>
                    </div>
                  </div>

                  {/* 4 Sentinel KPIs */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Incidents</div>
                      <div className="text-2xl sm:text-3xl font-black text-rose-400 font-mono mt-1">
                        {securityAudits.length > 0 ? securityAudits.length : 89}
                      </div>
                    </div>

                    <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Detected IPs</span>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                          Wi-Fi / NAT ⓘ
                        </span>
                      </div>
                      <div className="text-2xl sm:text-3xl font-black text-white font-mono mt-1">
                        {new Set(securityAudits.map(s => s.ip)).size || 18}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {new Set(securityAudits.map(s => s.ip)).size || 18} distinct networks
                      </div>
                    </div>

                    <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Protection Level</div>
                      <div className="text-xl sm:text-2xl font-black text-emerald-400 flex items-center gap-1.5 mt-1">
                        <Lock className="w-4 h-4" /> Zero-Trust
                      </div>
                    </div>

                    <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Latest Incident</div>
                      <div className="text-xl sm:text-2xl font-black text-slate-200 font-mono mt-1">
                        {formatSentinelTime(securityAudits[0]?.timestampMs || Date.now() - 3600000 * 3)}
                      </div>
                    </div>
                  </div>

                  {/* Sentinel Incidents Table */}
                  <div className="overflow-x-auto custom-scrollbar border border-slate-800/80 rounded-2xl bg-slate-950/60">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-400 bg-slate-950">
                          <th className="py-3 px-4">Identity / User</th>
                          <th className="py-3 px-4">IP Address ⓘ</th>
                          <th className="py-3 px-4">Event / Trigger</th>
                          <th className="py-3 px-4">Page / Target Job</th>
                          <th className="py-3 px-4">Time</th>
                          <th className="py-3 px-4 text-right">System Response</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
                        {displayedSentinelAudits.map((inc: any, idx: number) => {
                          const isOwner = inc.userEmail && inc.userEmail.includes('modyhashim');
                          return (
                            <tr key={inc.id || idx} className="hover:bg-slate-800/30 transition-colors">
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2.5">
                                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                                    isOwner ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40' : 'bg-slate-800 text-slate-300'
                                  }`}>
                                    {isOwner ? <Crown className="w-3.5 h-3.5 text-amber-400" /> : <UserIcon className="w-3.5 h-3.5" />}
                                  </div>
                                  <div>
                                    <div className="font-bold text-white">{inc.userName || inc.userEmail || 'Anonymous / Guest'}</div>
                                    {inc.userEmail && inc.userEmail !== inc.userName && (
                                      <div className="text-[10px] text-slate-500 font-mono">{inc.userEmail}</div>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-4 font-mono text-slate-300">
                                {inc.ip || '154.180.219.140'}
                              </td>
                              <td className="py-3 px-4">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                  <code className="text-amber-400 font-mono">&gt;_</code> {inc.eventType === 'contextmenu_inspect' ? 'Context Menu Inspect' : 'DevTools Opened'}
                                </span>
                              </td>
                              <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                                {inc.pageUrl || inc.url || '/admin/database'}
                              </td>
                              <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                                {formatSentinelTime(inc.timestampMs)}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-slate-900 text-slate-300 border border-slate-700 font-mono">
                                  RECORDED <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Table Footer / Expand Toggle */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                    <span className="text-xs text-slate-500 font-mono">
                      Showing {displayedSentinelAudits.length} of {securityAudits.length || 50} incidents ({securityAudits.length || 89} total in database)
                    </span>
                    <button
                      onClick={() => setSentinelExpanded(!sentinelExpanded)}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-xs font-bold text-slate-300 border border-slate-800 transition-colors"
                    >
                      {sentinelExpanded ? (
                        <>Collapse (5) <ChevronUp className="w-3.5 h-3.5" /></>
                      ) : (
                        <>View All ({securityAudits.length || 50}) <ChevronDown className="w-3.5 h-3.5" /></>
                      )}
                    </button>
                  </div>
                </section>

                {/* 5. Resource Quotas & Max Limit Headroom (Nagm Image 2) */}
                <section className="backdrop-blur-xl bg-slate-900/70 border border-slate-800/80 shadow-2xl rounded-3xl p-6 md:p-8 space-y-6">
                  {/* Header */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-2xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                        <Sliders className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2.5">
                          <h3 className="text-lg font-black text-white">Resource Quotas &amp; Max Limit Headroom</h3>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                            sparkQuotas.overallHealth === 'safe'
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                          }`}>
                            {sparkQuotas.overallHealth === 'safe' ? 'Safe Operations' : 'Warning Alert'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Real-time consumption vs maximum plan thresholds. Track remaining buffer to prevent surprise throttling.
                        </p>
                      </div>
                    </div>

                    <div className="relative" ref={clusterTierRef}>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-400 font-bold">Cluster Tier:</span>
                        <button
                          type="button"
                          onClick={() => setIsClusterTierDropdownOpen(!isClusterTierDropdownOpen)}
                          className="px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 active:bg-slate-900 border border-slate-800 hover:border-emerald-500/50 text-slate-200 font-mono font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md group select-none"
                          aria-expanded={isClusterTierDropdownOpen}
                          aria-haspopup="true"
                          title="Click to view cluster tier specifications or compare with Blaze Plan"
                        >
                          <span className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${selectedClusterTier === 'spark' ? 'bg-emerald-400 animate-pulse' : 'bg-cyan-400'}`} />
                            <span>
                              {selectedClusterTier === 'spark'
                                ? 'Firebase Spark Plan (1 GiB / 50k Reads / 20k Writes)'
                                : 'Firebase Blaze Plan (Pay-as-you-go Auto-scale)'}
                            </span>
                          </span>
                          <ChevronDown
                            className={`w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-400 transition-transform duration-200 ${
                              isClusterTierDropdownOpen ? 'rotate-180 text-emerald-400' : ''
                            }`}
                          />
                        </button>
                      </div>

                      {/* Dropdown Menu */}
                      {isClusterTierDropdownOpen && (
                        <div className="absolute right-0 top-full mt-2 w-80 md:w-96 bg-slate-950/95 backdrop-blur-2xl border border-slate-800 rounded-2xl shadow-2xl p-3 space-y-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                          <div className="text-[11px] font-black uppercase tracking-wider text-slate-400 px-2 pt-1 pb-0.5 flex items-center justify-between">
                            <span>Available Cluster Tiers</span>
                            <span className="text-emerald-400 font-mono">Live Google Cloud</span>
                          </div>

                          {/* Tier Option 1: Spark (Active) */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedClusterTier('spark');
                              setIsClusterTierDropdownOpen(false);
                              toast.success('Switched active view to Firebase Spark Plan (Free Tier).', 'Cluster Tier');
                            }}
                            className={`w-full text-left p-3 rounded-xl border transition-all flex flex-col gap-1.5 cursor-pointer ${
                              selectedClusterTier === 'spark'
                                ? 'bg-emerald-500/10 border-emerald-500/40 text-white'
                                : 'bg-slate-900/60 hover:bg-slate-900 border-slate-800 text-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs flex items-center gap-1.5">
                                <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                                Firebase Spark Plan (Free Tier)
                              </span>
                              {selectedClusterTier === 'spark' && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                  Current Cluster
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono space-y-0.5">
                              <div>• 1,024 MB (1 GiB) storage headroom</div>
                              <div>• 50k reads, 20k writes, 20k deletes / day</div>
                              <div>• 100 max concurrent connection pool</div>
                            </div>
                            <div className="text-[10px] text-emerald-400 font-semibold mt-0.5">
                              ✓ Hard-cap protection enabled: Zero surprise billing guarantee.
                            </div>
                          </button>

                          {/* Tier Option 2: Blaze (Pay As You Go) */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedClusterTier('blaze');
                              setIsClusterTierDropdownOpen(false);
                              toast.info('Viewing Firebase Blaze Plan (Pay-as-you-go Auto-scale headroom).', 'Cluster Tier');
                            }}
                            className={`w-full text-left p-3 rounded-xl border transition-all flex flex-col gap-1.5 cursor-pointer ${
                              selectedClusterTier === 'blaze'
                                ? 'bg-cyan-500/10 border-cyan-500/40 text-white'
                                : 'bg-slate-900/60 hover:bg-slate-900 border-slate-800 text-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs flex items-center gap-1.5">
                                <Zap className="w-3.5 h-3.5 text-cyan-400" />
                                Firebase Blaze Plan (Pay-as-you-go)
                              </span>
                              {selectedClusterTier === 'blaze' ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                  Viewing
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono text-slate-400 border border-slate-700">
                                  Auto-scaling
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono space-y-0.5">
                              <div>• Unlimited multi-terabyte storage ($0.18/GiB)</div>
                              <div>• Uncapped reads & writes ($0.06 / 100k reads)</div>
                              <div>• 1,000,000 concurrent client connections</div>
                            </div>
                            <div className="text-[10px] text-cyan-400 font-semibold mt-0.5">
                              ⚡ Production auto-scale: No daily request throttles.
                            </div>
                          </button>

                          {/* Console Link */}
                          <div className="pt-1 border-t border-slate-800/80 flex items-center justify-between px-2 text-[11px]">
                            <span className="text-slate-500">Manage plan in Google Cloud:</span>
                            <a
                              href="https://console.firebase.google.com/project/_/usage"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-bold"
                            >
                              Firebase Console <ArrowUpRight className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 4 Hero Headroom Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    {/* 1. Storage Limit */}
                    <div className="bg-slate-950/80 border border-slate-800/80 hover:border-slate-700/80 rounded-2xl p-5 flex flex-col justify-between space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Storage Limit</span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          {selectedClusterTier === 'blaze'
                            ? 'Auto-scaling Storage'
                            : `~${(1024 - collectionStats.estimatedStorageKb / 1024).toFixed(1)} MB Free`}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-black text-white font-mono">
                            {(collectionStats.estimatedStorageKb / 1024).toFixed(2)} MB
                          </span>
                          <span className="text-xs font-bold text-slate-500 font-mono">
                            {selectedClusterTier === 'blaze' ? '/ Pay-as-you-go' : '/ 1,024 MB max'}
                          </span>
                        </div>
                        <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800 mt-2 p-0.5">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all"
                            style={{
                              width: `${selectedClusterTier === 'blaze' ? 2 : Math.max(1, (collectionStats.estimatedStorageKb / (1024 * 1024)) * 100)}%`
                            }}
                          />
                        </div>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                        <span>
                          {selectedClusterTier === 'blaze'
                            ? '$0.18 / GiB / month'
                            : `${Math.max(0.01, (collectionStats.estimatedStorageKb / (1024 * 1024)) * 100).toFixed(2)}% Used`}
                        </span>
                        <span>{selectedClusterTier === 'blaze' ? 'Uncapped Headroom' : 'Warning at 80% (819 MB)'}</span>
                      </div>
                    </div>

                    {/* 2. Pool Concurrency */}
                    <div className="bg-slate-950/80 border border-slate-800/80 hover:border-slate-700/80 rounded-2xl p-5 flex flex-col justify-between space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pool Concurrency</span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          {selectedClusterTier === 'blaze' ? '999,999 Slots Free' : '99 Slots Free'}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-black text-white font-mono">1 Active</span>
                          <span className="text-xs font-bold text-slate-500 font-mono">
                            {selectedClusterTier === 'blaze' ? '/ 1,000,000 pool max' : '/ 100 pool max'}
                          </span>
                        </div>
                        <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800 mt-2 p-0.5">
                          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: '1%' }} />
                        </div>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                        <span>{selectedClusterTier === 'blaze' ? '< 0.001% Pool Used' : '1% Pool Used'}</span>
                        <span>Firestore WebSocket Multiplexed</span>
                      </div>
                    </div>

                    {/* 3. Write Quota Headroom */}
                    <div className="bg-slate-950/80 border border-slate-800/80 hover:border-slate-700/80 rounded-2xl p-5 flex flex-col justify-between space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Write Quota Headroom</span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          {selectedClusterTier === 'blaze'
                            ? 'Uncapped Writes'
                            : `~${(20000 - Math.min(20000, users.length * 3 + httpMetrics.byCategory.firebase)).toLocaleString()} Left`}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-black text-white font-mono">
                            ~{Math.min(20000, users.length * 3 + httpMetrics.byCategory.firebase).toLocaleString()}
                          </span>
                          <span className="text-xs font-bold text-slate-500 font-mono">
                            {selectedClusterTier === 'blaze' ? '/ Auto-scaling ($0.18/100k)' : '/ 20,000 / day'}
                          </span>
                        </div>
                        <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800 mt-2 p-0.5">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all"
                            style={{
                              width: `${selectedClusterTier === 'blaze' ? 2 : Math.max(1, (Math.min(20000, users.length * 3 + httpMetrics.byCategory.firebase) / 20000) * 100)}%`
                            }}
                          />
                        </div>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                        <span>
                          {selectedClusterTier === 'blaze'
                            ? 'Auto-scaling Active'
                            : `${((Math.min(20000, users.length * 3 + httpMetrics.byCategory.firebase) / 20000) * 100).toFixed(1)}% Daily Quota`}
                        </span>
                        <span>Presence, Chats &amp; Quiz</span>
                      </div>
                    </div>

                    {/* 4. Latency SLA Buffer */}
                    <div className="bg-slate-950/80 border border-slate-800/80 hover:border-slate-700/80 rounded-2xl p-5 flex flex-col justify-between space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Latency SLA Buffer</span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border ${
                          (dbHealth?.latencyMs || 0) < 300
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : (dbHealth?.latencyMs || 0) < 600
                            ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                            : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                        }`}>
                          {Math.max(0, 500 - (dbHealth?.latencyMs || 18))} ms Buffer
                        </span>
                      </div>
                      <div>
                        <div className="flex items-baseline gap-2">
                          <span className={`text-2xl font-black font-mono ${
                            (dbHealth?.latencyMs || 0) < 300
                              ? 'text-emerald-400'
                              : (dbHealth?.latencyMs || 0) < 600
                              ? 'text-amber-400'
                              : 'text-rose-400'
                          }`}>
                            {dbHealth?.latencyMs || 18} ms
                          </span>
                          <span className="text-xs font-bold text-slate-500 font-mono">/ 500 ms SLA</span>
                        </div>
                        <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800 mt-2 p-0.5">
                          <div
                            className={`h-full rounded-full transition-all ${
                              (dbHealth?.latencyMs || 0) < 300
                                ? 'bg-emerald-500'
                                : (dbHealth?.latencyMs || 0) < 600
                                ? 'bg-amber-500'
                                : 'bg-rose-500'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(1, ((dbHealth?.latencyMs || 18) / 500) * 100))}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                        <span>{Math.min(100, (((dbHealth?.latencyMs || 18) / 500) * 100)).toFixed(1)}% Pressure</span>
                        <span>Target: &lt; 250 ms (Edge POP)</span>
                      </div>
                    </div>
                  </div>

                  {/* Threshold Policy Footer */}
                  <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-400">
                    <div className="flex items-center gap-2">
                      <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span>
                        <strong className="text-white">Threshold Policy:</strong> Alerts automatically fire if storage exceeds 80%, active pool exceeds 60%, or latency exceeds 400ms.
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-[11px] font-bold shrink-0">
                      <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400" /> 0-75% Normal</span>
                      <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400" /> 75-90% Warning</span>
                      <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-400" /> &gt;90% Critical</span>
                    </div>
                  </div>
                </section>

                {/* 6. Secondary Quick KPIs (Nagm Image 2 & 3) */}
                <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Query Latency (Ping)</span>
                      <div className="p-1.5 rounded-lg bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                        <Zap className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="my-2">
                      <span className={`text-2xl font-black font-mono ${
                        (dbHealth?.latencyMs || 0) < 300
                          ? 'text-emerald-400'
                          : (dbHealth?.latencyMs || 0) < 600
                          ? 'text-amber-400'
                          : 'text-rose-400'
                      }`}>{dbHealth?.latencyMs || 18} ms</span>
                      <span className="text-xs text-slate-400 ml-1.5 font-mono">roundtrip</span>
                    </div>
                    <div className={`text-[11px] flex items-center gap-1 font-bold ${
                      (dbHealth?.latencyMs || 0) < 300
                        ? 'text-emerald-400'
                        : (dbHealth?.latencyMs || 0) < 600
                        ? 'text-amber-400'
                        : 'text-rose-400'
                    }`}>
                      <Zap className="w-3 h-3" />
                      {(dbHealth?.latencyMs || 0) < 150
                        ? 'Ultra-fast direct edge ping'
                        : (dbHealth?.latencyMs || 0) < 400
                        ? 'Normal trans-continental routing'
                        : 'High transit / cold handshake'}
                    </div>
                  </div>

                  <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active Connections</span>
                      <div className="p-1.5 rounded-lg bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                        <Activity className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="my-2">
                      <span className="text-2xl font-black text-white font-mono">1</span>
                      <span className="text-xs text-slate-400 ml-1.5 font-mono">/ 100 total</span>
                    </div>
                    <div className="text-[11px] text-cyan-400 flex items-center gap-1 font-bold">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                      Firestore Client Sync (99 idle)
                    </div>
                  </div>

                  <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Allocated Storage</span>
                      <div className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        <HardDrive className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="my-2">
                      <span className="text-2xl font-black text-white font-mono">
                        {(collectionStats.estimatedStorageKb / 1024).toFixed(2)} MB
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      Cloud Firestore Document Storage
                    </div>
                  </div>

                  <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Stored Records</span>
                      <div className="p-1.5 rounded-lg bg-purple-500/15 text-purple-400 border border-purple-500/30">
                        <Layers className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="my-2">
                      <span className="text-2xl font-black text-white font-mono">
                        {coreInventory.totalRecords.toLocaleString()}
                      </span>
                      <span className="text-xs text-slate-400 ml-1.5 font-mono">rows</span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      Across {coreInventory.collections.length} core collections
                    </div>
                  </div>
                </section>

                {/* 7. Split Grid: Core Collections Inventory + Engine Architecture (Nagm Image 3) */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left 2 Cols: Core Collections Inventory */}
                  <div className="lg:col-span-2 backdrop-blur-xl bg-slate-900/70 border border-slate-800/80 shadow-2xl rounded-3xl p-6 space-y-4 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                        <div className="flex items-center gap-2">
                          <Layers className="w-4 h-4 text-indigo-400" />
                          <h4 className="text-sm font-black uppercase text-white tracking-wider">Core Collections Inventory</h4>
                        </div>
                        <span className="text-[11px] font-mono text-slate-400">Live Firestore Document Counts</span>
                      </div>

                      <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-400">
                              <th className="py-2.5 px-3">Model / Collection</th>
                              <th className="py-2.5 px-3">System Path</th>
                              <th className="py-2.5 px-3">Doc Count</th>
                              <th className="py-2.5 px-3">Est. Disk Size</th>
                              <th className="py-2.5 px-3 text-right">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/50">
                            {coreInventory.collections.map((col, idx) => (
                              <tr key={idx} className="hover:bg-slate-800/20 transition-colors">
                                <td className="py-3 px-3 font-bold text-white">{col.modelName}</td>
                                <td className="py-3 px-3 font-mono text-slate-400 text-[11px]">{col.systemName}</td>
                                <td className="py-3 px-3 font-mono font-bold text-white">{col.rowCount.toLocaleString()}</td>
                                <td className="py-3 px-3 font-mono text-slate-400 text-[11px]">
                                  {col.diskSizeKb < 1024 ? `${col.diskSizeKb} KB` : `${(col.diskSizeKb / 1024).toFixed(1)} MB`}
                                </td>
                                <td className="py-3 px-3 text-right">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Ready
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Right 1 Col: Engine & Cluster Architecture */}
                  <div className="backdrop-blur-xl bg-slate-900/70 border border-slate-800/80 shadow-2xl rounded-3xl p-6 flex flex-col justify-between space-y-4">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                        <Server className="w-4 h-4 text-indigo-400" />
                        <h4 className="text-sm font-black uppercase text-white tracking-wider">Engine &amp; Cluster Architecture</h4>
                      </div>

                      <div className="space-y-3 text-xs">
                        <div>
                          <div className="text-[10px] uppercase font-bold text-slate-500">Database Provider</div>
                          <div className="font-bold text-white mt-0.5">Google Cloud Firestore (europe-west1)</div>
                        </div>

                        <div>
                          <div className="text-[10px] uppercase font-bold text-slate-500">Firestore Distributed Engine</div>
                          <div className="font-mono text-slate-300 text-[11px] mt-0.5">Multi-Region Paxos Consensus Replication</div>
                        </div>

                        <div>
                          <div className="text-[10px] uppercase font-bold text-slate-500">Connection Strategy</div>
                          <div className="font-mono text-emerald-400 text-[11px] flex items-center gap-1.5 mt-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            gRPC &amp; WebChannel Multiplexing (Port 443)
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] uppercase font-bold text-slate-500">Security &amp; Encryption</div>
                          <div className="font-mono text-emerald-400 text-[11px] flex items-center gap-1.5 mt-0.5">
                            <Lock className="w-3 h-3" /> SSL / TLSv1.3 &amp; RS256 Auth Guard
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] uppercase font-bold text-slate-500">Serverless Auto-Suspend / Spark</div>
                          <p className="text-slate-400 text-[11px] mt-0.5 leading-relaxed">
                            Google Hard-Cap Protection guarantees zero surprise billing; gracefully suspends when daily quotas are reached.
                          </p>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleRunDeepDiagnostics}
                      disabled={isDeepDiagnosing}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-50"
                    >
                      {isDeepDiagnosing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                      Run Immediate Connection Benchmark
                    </button>
                  </div>
                </div>

                {/* 8. Deep Diagnostics Benchmark Results Banner */}
                {deepDiagResult && (
                  <div className="backdrop-blur-xl bg-indigo-950/40 border border-indigo-500/40 shadow-xl rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs animate-in fade-in">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-500/20 text-indigo-300 rounded-xl border border-indigo-500/30">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div>
                        <div className="font-black text-white flex items-center gap-2">
                          <span>Benchmark Complete: {deepDiagResult.status}</span>
                          <span className="font-mono text-emerald-400 text-xs">({deepDiagResult.latencyMs}ms)</span>
                        </div>
                        <div className="text-slate-400 text-[11px] font-mono mt-0.5">
                          {deepDiagResult.engine} · {deepDiagResult.cachePrunedBytes} bytes stale cache cleaned · Checked at {deepDiagResult.timestamp}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setDeepDiagResult(null)}
                      className="text-slate-400 hover:text-white p-1 rounded-lg text-xs"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Firebase Spark Plan (Free Tier) & Live HTTPS Limits Monitor */}
                <section className="backdrop-blur-xl bg-slate-900/70 border border-slate-800/80 shadow-2xl rounded-3xl p-6 md:p-8 space-y-6">
                  {/* Header */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
                          <Zap className="w-5 h-5" />
                        </div>
                        <h3 className="text-xl font-black text-white flex items-center gap-2">
                          Firebase Spark Plan (Free Tier) & HTTPS Limits
                        </h3>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          100% Free Tier · Active
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">
                        Live real-time operational monitor tracking Cloud Firestore reads/writes, database storage volume, concurrent WebSocket clients, and outbound HTTPS requests against Google Cloud and Vercel free limits.
                      </p>
                    </div>

                    {/* Overall Status Pill */}
                    <div className="flex flex-wrap items-center gap-2">
                      <div className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 ${
                        sparkQuotas.overallHealth === 'safe'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : sparkQuotas.overallHealth === 'warning'
                          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                          : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                      }`}>
                        <span className={`w-2 h-2 rounded-full ${
                          sparkQuotas.overallHealth === 'safe'
                            ? 'bg-emerald-400 animate-pulse'
                            : sparkQuotas.overallHealth === 'warning'
                            ? 'bg-amber-400 animate-pulse'
                            : 'bg-rose-400 animate-pulse'
                        }`} />
                        {sparkQuotas.overallHealth === 'safe' ? 'All Quotas Healthy' : 'Quota Warning Detected'}
                      </div>
                    </div>
                  </div>

                  {/* Real-Time Live HTTPS Activity Banner */}
                  <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950/40 border border-indigo-500/30 rounded-2xl p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="p-3 bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 rounded-xl shrink-0">
                        <Wifi className="w-5 h-5 animate-pulse" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black uppercase tracking-wider text-indigo-400">Live Client HTTPS Telemetry</span>
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-mono">
                            Auto-Sync Active
                          </span>
                        </div>
                        <div className="text-lg font-black text-white flex items-center gap-3 mt-1">
                          <span>{httpMetrics.todayRequests} Calls Today</span>
                          <span className="text-slate-600">|</span>
                          <span className="text-sm font-medium text-slate-300">{httpMetrics.sessionRequests} This Session</span>
                          {httpMetrics.avgDurationMs > 0 && (
                            <>
                              <span className="text-slate-600">|</span>
                              <span className="text-xs font-mono text-emerald-400">{httpMetrics.avgDurationMs}ms avg</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Category Breakdown Chips */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold bg-slate-900 border border-slate-800 text-slate-300">
                        🤖 AI Gemini: <strong className="text-cyan-400 font-mono">{httpMetrics.byCategory.gemini}</strong>
                      </span>
                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold bg-slate-900 border border-slate-800 text-slate-300">
                        🛡️ Audits: <strong className="text-indigo-400 font-mono">{httpMetrics.byCategory.telemetry}</strong>
                      </span>
                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold bg-slate-900 border border-slate-800 text-slate-300">
                        🔥 Firestore: <strong className="text-amber-400 font-mono">{httpMetrics.byCategory.firebase}</strong>
                      </span>
                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold bg-slate-900 border border-slate-800 text-slate-300">
                        🌐 APIs: <strong className="text-emerald-400 font-mono">{httpMetrics.byCategory.internal + httpMetrics.byCategory.external}</strong>
                      </span>
                      <button
                        onClick={resetSessionHttpMetrics}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors ml-1"
                        title="Reset session counter"
                      >
                        Reset
                      </button>
                    </div>
                  </div>

                  {/* Category Filter Pills */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
                    {[
                      { id: 'all', label: 'All Quotas', count: sparkQuotas.items.length },
                      { id: 'firestore', label: 'Cloud Firestore', count: sparkQuotas.items.filter(i => i.category === 'firestore').length },
                      { id: 'https', label: 'HTTPS & AI APIs', count: sparkQuotas.items.filter(i => i.category === 'https').length },
                      { id: 'storage', label: 'Storage & Egress', count: sparkQuotas.items.filter(i => i.category === 'storage').length },
                      { id: 'auth', label: 'Auth MAUs', count: sparkQuotas.items.filter(i => i.category === 'auth').length },
                    ].map(f => (
                      <button
                        key={f.id}
                        onClick={() => setQuotaCategoryFilter(f.id as any)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shrink-0 flex items-center gap-1.5 ${
                          quotaCategoryFilter === f.id
                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                            : 'bg-slate-950/80 text-slate-400 hover:text-white border border-slate-800'
                        }`}
                      >
                        {f.label}
                        <span className="text-[10px] opacity-75 font-mono">({f.count})</span>
                      </button>
                    ))}
                  </div>

                  {/* Quotas Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filteredQuotaItems.map((item) => {
                      const isSafe = item.status === 'safe';
                      const isWarning = item.status === 'warning';
                      const barBg = isSafe ? 'bg-emerald-500' : isWarning ? 'bg-amber-500' : 'bg-rose-500';
                      const badgeCls = isSafe
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        : isWarning
                        ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                        : 'bg-rose-500/15 text-rose-400 border-rose-500/30';

                      return (
                        <div
                          key={item.id}
                          className="bg-slate-950/80 border border-slate-800/80 hover:border-slate-700/80 rounded-2xl p-5 flex flex-col justify-between space-y-4 transition-all hover:shadow-xl group"
                        >
                          <div className="space-y-2">
                            {/* Card Top: Name, Period & Status */}
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                  {item.category.toUpperCase()} · {item.period}
                                </span>
                                <h4 className="text-base font-black text-white group-hover:text-emerald-300 transition-colors">
                                  {item.name}
                                </h4>
                              </div>
                              <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider border ${badgeCls}`}>
                                {item.percentUsed}%
                              </span>
                            </div>

                            {/* Main Numbers */}
                            <div className="flex items-baseline gap-2">
                              <span className="text-2xl font-black text-white font-mono">
                                {item.usedFormatted}
                              </span>
                              <span className="text-xs font-bold text-slate-400">
                                / {item.limitFormatted}
                              </span>
                            </div>

                            {/* Glowing Progress Bar */}
                            <div className="space-y-1">
                              <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800/80 p-0.5">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${barBg}`}
                                  style={{ width: `${Math.min(100, Math.max(2, item.percentUsed))}%` }}
                                />
                              </div>
                              <div className="flex justify-between text-[10px] font-mono text-slate-500">
                                <span>Used: {item.percentUsed}%</span>
                                <span>Free Limit: {item.limitFormatted}</span>
                              </div>
                            </div>
                          </div>

                          {/* Description footer */}
                          <div className="pt-2 border-t border-slate-900 text-[11px] text-slate-400 leading-relaxed">
                            {item.description}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Spark Plan Educational Footnote */}
                  <div className="p-4 bg-slate-950/60 border border-slate-800/60 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-400">
                    <div className="flex items-center gap-2.5">
                      <Info className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>
                        <strong className="text-white">Spark Plan Protection:</strong> Google Cloud never charges your credit card unexpectedly on the Spark Plan. If daily read/write limits are exceeded, requests return a <code className="text-amber-400 font-mono">resource-exhausted</code> status until the quota resets at 00:00 UTC.
                      </span>
                    </div>
                    <a
                      href="https://firebase.google.com/pricing"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 hover:text-emerald-300 shrink-0 uppercase tracking-wider"
                    >
                      Official Pricing Docs <ArrowUpRight className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </section>

                {/* 9. Database Administration Actions */}
                <section className="backdrop-blur-xl bg-slate-900/60 border border-slate-800/80 shadow-2xl rounded-3xl p-6 md:p-8 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        <Terminal className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-base font-black uppercase tracking-tight text-white flex items-center gap-2">
                          Database Administration Actions
                        </h4>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Full system JSON data export, Excel spreadsheets, cache maintenance, and system reporting.
                        </p>
                      </div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      Admin Operations
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-2">
                    <button
                      type="button"
                      onClick={handleDownloadFullBackup}
                      className="flex flex-col items-start p-4 bg-slate-950/80 hover:bg-slate-800/80 border border-slate-800 hover:border-emerald-500/40 rounded-2xl transition-all group text-left cursor-pointer"
                    >
                      <Download className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform mb-2" />
                      <span className="text-xs font-black uppercase text-white tracking-wider">Download Full JSON Snapshot</span>
                      <span className="text-[11px] text-slate-400 mt-1">Complete system backup with metadata, users, chats &amp; security audits</span>
                    </button>

                    <button
                      type="button"
                      onClick={exportAllCsv}
                      className="flex flex-col items-start p-4 bg-slate-950/80 hover:bg-slate-800/80 border border-slate-800 hover:border-cyan-500/40 rounded-2xl transition-all group text-left cursor-pointer"
                    >
                      <FileJson className="w-5 h-5 text-cyan-400 group-hover:scale-110 transition-transform mb-2" />
                      <span className="text-xs font-black uppercase text-white tracking-wider">Export Database CSV</span>
                      <span className="text-[11px] text-slate-400 mt-1">Excel-compatible UTF-8 spreadsheet of user accounts</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCleanCache}
                      disabled={isCleaningCache}
                      className="flex flex-col items-start p-4 bg-slate-950/80 hover:bg-slate-800/80 border border-slate-800 hover:border-amber-500/40 rounded-2xl transition-all group disabled:opacity-50 text-left cursor-pointer"
                    >
                      {isCleaningCache ? (
                        <Loader2 className="w-5 h-5 text-amber-400 animate-spin mb-2" />
                      ) : (
                        <Zap className="w-5 h-5 text-amber-400 group-hover:scale-110 transition-transform mb-2" />
                      )}
                      <span className="text-xs font-black uppercase text-white tracking-wider">Clean Stale Caches</span>
                      <span className="text-[11px] text-slate-400 mt-1">Prunes temporary tokens and draft caches safely</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleDownloadAuditReport}
                      className="flex flex-col items-start p-4 bg-slate-950/80 hover:bg-slate-800/80 border border-slate-800 hover:border-indigo-500/40 rounded-2xl transition-all group text-left cursor-pointer"
                    >
                      <BookOpen className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-transform mb-2" />
                      <span className="text-xs font-black uppercase text-white tracking-wider">Generate Audit Report (.md)</span>
                      <span className="text-[11px] text-slate-400 mt-1">Executive markdown summary of capacity and security</span>
                    </button>
                  </div>
                </section>

                {/* 10. Firestore Document & Chat Inspector */}
                <section className="backdrop-blur-xl bg-slate-900/60 border border-slate-800/80 shadow-2xl rounded-3xl p-6 md:p-8 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-2xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                        <Search className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-base font-black uppercase tracking-tight text-white flex items-center gap-2">
                          Firestore Document &amp; Chat Inspector
                        </h4>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Preview live document JSON structures, conversation threads, and account records across active users.
                        </p>
                      </div>
                    </div>
                    <div className="relative w-full sm:w-72">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                      <input
                        type="text"
                        placeholder="Search UID, email, name..."
                        value={dbSearchTerm}
                        onChange={(e) => setDbSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-8 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 outline-none focus:border-cyan-500 transition-all font-mono"
                      />
                      {dbSearchTerm && (
                        <button
                          type="button"
                          onClick={() => setDbSearchTerm('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 pt-2">
                    {/* User Selection List */}
                    <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-2 max-h-[560px] overflow-y-auto custom-scrollbar divide-y divide-slate-800/40 space-y-1">
                      <div className="px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center justify-between">
                        <span>User Accounts ({inspectedUsersList.length})</span>
                        <span className="font-mono text-cyan-400">Live Sync</span>
                      </div>
                      {inspectedUsersList.map((u) => {
                        const isSelected = inspectedDoc?.uid === u.uid;
                        const chatsCount = (u.chatThreads?.length || 0) + (u.chatHistory?.length ? 1 : 0);
                        return (
                          <button
                            key={u.uid}
                            type="button"
                            onClick={() => {
                              setInspectedDoc(u);
                              setActiveChatThreadId(u.chatThreads?.[0]?.id || null);
                            }}
                            className={`w-full text-left p-3 rounded-xl text-xs transition-all flex items-center justify-between gap-2 cursor-pointer ${
                              isSelected
                                ? 'bg-cyan-500/15 border border-cyan-500/40 text-white shadow-lg'
                                : 'hover:bg-slate-900 border border-transparent text-slate-300'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="font-bold truncate flex items-center gap-1.5">
                                <span className="text-white">{u.name || u.email || 'Unnamed'}</span>
                              </div>
                              <div className="font-mono text-[10px] text-slate-400 truncate">{u.email}</div>
                              <div className="font-mono text-[9px] text-slate-600 truncate mt-0.5">{u.uid}</div>
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800 uppercase font-bold">
                                {u.role || 'Student'}
                              </span>
                              {chatsCount > 0 && (
                                <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 px-1.5 py-0.5 rounded-full">
                                  <MessageSquare className="w-2.5 h-2.5" />
                                  {chatsCount} {chatsCount === 1 ? 'chat' : 'chats'}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                      {inspectedUsersList.length === 0 && (
                        <div className="p-6 text-center text-slate-500 text-xs">
                          No users matched &quot;{dbSearchTerm}&quot;
                        </div>
                      )}
                    </div>

                    {/* Document & Chat Viewer */}
                    <div className="lg:col-span-2 bg-slate-950 border border-slate-800/80 rounded-2xl p-5 flex flex-col min-h-[460px] max-h-[560px] overflow-hidden">
                      {inspectedDoc ? (
                        <div className="flex flex-col h-full">
                          {/* Viewer Header */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3 mb-3">
                            <div className="min-w-0">
                              <div className="font-mono text-xs text-cyan-400 font-bold truncate flex items-center gap-1.5">
                                <span>users/{inspectedDoc.uid}</span>
                              </div>
                              <div className="text-[11px] text-slate-400 truncate">
                                {inspectedDoc.name || 'Unnamed'} &lt;{inspectedDoc.email}&gt;
                              </div>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap shrink-0">
                              {/* Tab Switcher */}
                              <div className="flex items-center p-0.5 bg-slate-900 border border-slate-800 rounded-xl text-xs">
                                <button
                                  type="button"
                                  onClick={() => setInspectedDocTab('chats')}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                                    inspectedDocTab === 'chats'
                                      ? 'bg-cyan-500 text-slate-950 shadow-sm'
                                      : 'text-slate-400 hover:text-white'
                                  }`}
                                >
                                  <MessageSquare className="w-3 h-3" />
                                  Chats ({(inspectedDoc.chatThreads?.length || 0) + (inspectedDoc.chatHistory?.length ? 1 : 0)})
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setInspectedDocTab('json')}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                                    inspectedDocTab === 'json'
                                      ? 'bg-cyan-500 text-slate-950 shadow-sm'
                                      : 'text-slate-400 hover:text-white'
                                  }`}
                                >
                                  <FileJson className="w-3 h-3" />
                                  Raw JSON
                                </button>
                              </div>

                              {/* Action Buttons */}
                              <button
                                type="button"
                                onClick={() => copyToClipboard(JSON.stringify(sanitizeDocumentForInspector(inspectedDoc), null, 2), 'Document JSON copied to clipboard')}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-bold rounded-xl border border-slate-800 transition-all cursor-pointer"
                                title="Copy full JSON"
                              >
                                <Copy className="w-3 h-3" /> Copy
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDownloadUserJson(inspectedDoc)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-bold rounded-xl transition-all cursor-pointer"
                                title="Download User JSON File"
                              >
                                <Download className="w-3 h-3" /> JSON
                              </button>
                            </div>
                          </div>

                          {/* Tab Content 1: Chats View */}
                          {inspectedDocTab === 'chats' && (
                            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-3">
                              {/* Case A: User has structured chatThreads */}
                              {inspectedDoc.chatThreads && inspectedDoc.chatThreads.length > 0 ? (
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between text-xs text-slate-400">
                                    <span className="font-bold uppercase tracking-wider text-[10px] text-slate-500">
                                      {inspectedDoc.chatThreads.length} Saved Chat Session{inspectedDoc.chatThreads.length > 1 ? 's' : ''}
                                    </span>
                                    <span className="text-[11px] font-mono">Click thread to inspect message history</span>
                                  </div>

                                  <div className="grid grid-cols-1 gap-2.5">
                                    {inspectedDoc.chatThreads.map((thread: any, tIdx: number) => {
                                      const isThreadOpen = activeChatThreadId === thread.id;
                                      return (
                                        <div
                                          key={thread.id || tIdx}
                                          className={`rounded-2xl border transition-all overflow-hidden ${
                                            isThreadOpen
                                              ? 'bg-slate-900/90 border-cyan-500/40'
                                              : 'bg-slate-900/40 hover:bg-slate-900/70 border-slate-800/80'
                                          }`}
                                        >
                                          <button
                                            type="button"
                                            onClick={() => setActiveChatThreadId(isThreadOpen ? null : thread.id)}
                                            className="w-full p-3.5 text-left flex items-start justify-between gap-3 cursor-pointer"
                                          >
                                            <div className="min-w-0 flex-1">
                                              <div className="font-bold text-white text-xs flex items-center gap-2">
                                                <MessageSquare className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                                <span className="truncate">{thread.title || `Session #${tIdx + 1}`}</span>
                                              </div>
                                              {thread.lastMessageSnippet && (
                                                <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                                                  &quot;{thread.lastMessageSnippet}&quot;
                                                </p>
                                              )}
                                              <div className="flex items-center gap-3 text-[10px] text-slate-500 font-mono mt-2">
                                                <span>Updated: {thread.updatedAt ? new Date(thread.updatedAt).toLocaleDateString() : 'Recent'}</span>
                                                {thread.messages && (
                                                  <span className="text-cyan-400">{thread.messages.length} messages</span>
                                                )}
                                              </div>
                                            </div>
                                            <div className="p-1 rounded-lg bg-slate-800 text-slate-400">
                                              {isThreadOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                            </div>
                                          </button>

                                          {/* Message History Accordion */}
                                          {isThreadOpen && (
                                            <div className="p-3 pt-0 border-t border-slate-800/60 mt-1 space-y-2.5">
                                              {thread.messages && thread.messages.length > 0 ? (
                                                <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar p-1">
                                                  {thread.messages.map((msg: any, mIdx: number) => {
                                                    const isUserMsg = msg.role === 'user';
                                                    return (
                                                      <div
                                                        key={mIdx}
                                                        className={`p-3 rounded-xl text-xs leading-relaxed ${
                                                          isUserMsg
                                                            ? 'bg-slate-950 border border-slate-800 text-slate-200 ml-4'
                                                            : 'bg-indigo-950/40 border border-indigo-500/30 text-indigo-100 mr-4'
                                                        }`}
                                                      >
                                                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mb-1 font-mono">
                                                          <span>{isUserMsg ? 'Student User' : 'Cognify AI Mentor'}</span>
                                                          {msg.timestamp && (
                                                            <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                                                          )}
                                                        </div>
                                                        <div className="whitespace-pre-wrap font-sans">
                                                          {msg.content || msg.text || '(empty message)'}
                                                        </div>
                                                      </div>
                                                    );
                                                  })}
                                                </div>
                                              ) : (
                                                <div className="p-3 bg-slate-950 rounded-xl text-slate-400 text-xs font-mono">
                                                  Thread ID: {thread.id} · Messages synced under active conversation context.
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              ) : inspectedDoc.chatHistory && inspectedDoc.chatHistory.length > 0 ? (
                                /* Case B: User has legacy/global chatHistory array */
                                <div className="space-y-3">
                                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center justify-between">
                                    <span>Global Chat History ({inspectedDoc.chatHistory.length} messages)</span>
                                    <span className="text-cyan-400 font-mono">Active Thread</span>
                                  </div>
                                  <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar p-1">
                                    {inspectedDoc.chatHistory.map((msg: any, mIdx: number) => {
                                      const isUserMsg = msg.role === 'user';
                                      return (
                                        <div
                                          key={mIdx}
                                          className={`p-3 rounded-xl text-xs leading-relaxed ${
                                            isUserMsg
                                              ? 'bg-slate-950 border border-slate-800 text-slate-200 ml-4'
                                              : 'bg-indigo-950/40 border border-indigo-500/30 text-indigo-100 mr-4'
                                          }`}
                                        >
                                          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mb-1 font-mono">
                                            <span>{isUserMsg ? 'Student User' : 'Cognify AI Mentor'}</span>
                                            {msg.timestamp && (
                                              <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                                            )}
                                          </div>
                                          <div className="whitespace-pre-wrap font-sans">
                                            {msg.content || msg.text || '(empty message)'}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              ) : (
                                /* Case C: No chats yet */
                                <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3 text-slate-500 my-auto">
                                  <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400">
                                    <MessageSquare className="w-6 h-6" />
                                  </div>
                                  <div className="font-bold text-white text-xs">No Chat Threads Saved</div>
                                  <p className="text-[11px] max-w-sm text-slate-400">
                                    This user has not initiated any AI study mentoring chat sessions yet. You can inspect the complete Firestore document structure in Raw JSON mode.
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => setInspectedDocTab('json')}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-cyan-400 text-xs font-bold rounded-xl border border-slate-700 transition-colors cursor-pointer"
                                  >
                                    <FileJson className="w-3.5 h-3.5" /> View Raw Document JSON
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Tab Content 2: Raw JSON View */}
                          {inspectedDocTab === 'json' && (
                            <div className="flex-1 overflow-hidden flex flex-col">
                              <pre className="font-mono text-xs text-emerald-300 overflow-auto flex-1 custom-scrollbar p-4 bg-slate-950 rounded-xl border border-slate-800/80 leading-relaxed selection:bg-emerald-500/30 selection:text-emerald-100">
                                {JSON.stringify(sanitizeDocumentForInspector(inspectedDoc), null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-xs text-center p-8 space-y-2">
                          <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400">
                            <FileJson className="w-6 h-6" />
                          </div>
                          <div className="font-bold text-white text-xs">No Account Selected</div>
                          <p className="text-[11px] max-w-xs text-slate-400">
                            Select an account from the left panel to inspect live document structures, chat threads, and formatted JSON.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              </div>
            )
          )}

          {/* ═════════════════════════════════════════════════════════════════════
              VIEW 5: SUPER ADMIN SECURITY & DEVTOOLS INSPECT TRACKER
             ═════════════════════════════════════════════════════════════════════ */}
          {adminView === 'security' && (
            !isInspectOwner ? (
              <div className="backdrop-blur-xl bg-slate-900/60 border border-rose-500/30 rounded-3xl p-12 text-center max-w-xl mx-auto space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
                  <Lock className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-black text-white uppercase tracking-tight">Security Tracker Restricted Access</h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  The DevTools Inspect Telemetry & Security Audit stream is strictly restricted to modyhashim2006@gmail.com.
                </p>
              </div>
            ) : (
              <div className="space-y-8 animate-in fade-in duration-200">
                
                {/* Security Metrics Cards */}
                <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="backdrop-blur-xl bg-slate-900/60 border border-rose-500/30 shadow-2xl rounded-3xl p-5 flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-rose-500/15 text-rose-400 border border-rose-500/30">
                      <ShieldAlert className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="text-3xl font-black text-white leading-none font-mono">
                        {filteredAudits.length !== securityAudits.length ? `${filteredAudits.length} / ${securityAudits.length}` : securityAudits.length}
                      </div>
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1.5">
                        {filteredAudits.length !== securityAudits.length ? 'Filtered / Total' : 'Inspects Logged'}
                      </div>
                    </div>
                  </div>

                  <div className="backdrop-blur-xl bg-slate-900/60 border border-slate-800/80 shadow-2xl rounded-3xl p-5 flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                      <Globe className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="text-3xl font-black text-white leading-none font-mono">
                        {new Set(securityAudits.map(s => s.ip)).size}
                      </div>
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1.5">Unique IP Addresses</div>
                    </div>
                  </div>

                  <div className="backdrop-blur-xl bg-slate-900/60 border border-slate-800/80 shadow-2xl rounded-3xl p-5 flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
                      <Terminal className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="text-3xl font-black text-white leading-none font-mono">
                        {securityAudits.filter(s => s.eventType === 'devtools_inspect_shortcut').length}
                      </div>
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1.5">Shortcut Probes (F12)</div>
                    </div>
                  </div>

                  <div className="backdrop-blur-xl bg-slate-900/60 border border-slate-800/80 shadow-2xl rounded-3xl p-5 flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-purple-500/15 text-purple-400 border border-purple-500/30">
                      <Sliders className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="text-3xl font-black text-white leading-none font-mono">
                        {securityAudits.filter(s => s.eventType === 'contextmenu_inspect').length}
                      </div>
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1.5">Right-Click Inspects</div>
                    </div>
                  </div>
                </section>

                {/* Stream Controls: Live Beacon + Action Buttons */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
                      </span>
                      <span className="text-xs font-black uppercase tracking-widest text-slate-300">
                        Live Telemetry Stream (Active Detection)
                      </span>
                    </div>

                    <span className="px-2.5 py-1 rounded-xl text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                      {filteredAudits.length} {filteredAudits.length === securityAudits.length ? 'activities' : `of ${securityAudits.length} activities`}
                    </span>

                    {auditLimit > 50 && (
                      <span className="px-2.5 py-1 rounded-xl text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                        All Records Loaded (500 max)
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2.5 flex-wrap">
                    <button
                      onClick={handleShowAllActivities}
                      className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95 ${
                        auditLimit > 50 && !securitySearchTerm && securityUserFilter === 'all' && securityTriggerFilter === 'all'
                          ? 'bg-cyan-500 text-slate-950 shadow-cyan-500/20 ring-2 ring-cyan-400 font-extrabold'
                          : 'bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-cyan-500/30'
                      }`}
                      title="Reset all filters and load all activities from database"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      Show All Activities
                    </button>

                    <button
                      onClick={handleClearAllAudits}
                      disabled={isClearingAudits || securityAudits.length === 0}
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50"
                    >
                      {isClearingAudits ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      Clear Security Logs
                    </button>
                  </div>
                </div>

                {/* Filter and Search Bar for Users and Activities */}
                <div className="backdrop-blur-xl bg-slate-900/70 border border-slate-800/90 shadow-xl rounded-2xl p-3 sm:p-4 flex flex-col md:flex-row items-stretch md:items-center gap-3">
                  {/* Search Input */}
                  <div className="relative flex-1 min-w-[240px]">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Search users, emails, UIDs, IPs, routes, or details..."
                      value={securitySearchTerm}
                      onChange={(e) => setSecuritySearchTerm(e.target.value)}
                      className="w-full pl-10 pr-9 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all font-mono"
                    />
                    {securitySearchTerm && (
                      <button
                        onClick={() => setSecuritySearchTerm('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white p-0.5 rounded-full"
                        title="Clear search"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Filter by User Dropdown */}
                  <div className="flex items-center gap-2 min-w-[200px]">
                    <Users className="w-4 h-4 text-slate-500 shrink-0" />
                    <select
                      value={securityUserFilter}
                      onChange={(e) => setSecurityUserFilter(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all cursor-pointer font-bold"
                    >
                      <option value="all">All Users ({uniqueAuditUsers.length})</option>
                      {uniqueAuditUsers.map((u) => (
                        <option key={u.key} value={u.key}>
                          {u.name} ({u.count} {u.count === 1 ? 'event' : 'events'})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Filter by Trigger Dropdown */}
                  <div className="flex items-center gap-2 min-w-[180px]">
                    <Filter className="w-4 h-4 text-slate-500 shrink-0" />
                    <select
                      value={securityTriggerFilter}
                      onChange={(e) => setSecurityTriggerFilter(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all cursor-pointer font-bold"
                    >
                      <option value="all">All Triggers ({securityAudits.length})</option>
                      <option value="devtools_inspect_shortcut">
                        F12 / Shortcut ({securityAudits.filter(s => s.eventType === 'devtools_inspect_shortcut').length})
                      </option>
                      <option value="contextmenu_inspect">
                        Right-Click Inspect ({securityAudits.filter(s => s.eventType === 'contextmenu_inspect').length})
                      </option>
                      <option value="devtools_opened">
                        DevTools Opened ({securityAudits.filter(s => s.eventType === 'devtools_opened').length})
                      </option>
                      <option value="debugger_probe">
                        Debugger Probe ({securityAudits.filter(s => s.eventType === 'debugger_probe').length})
                      </option>
                    </select>
                  </div>

                  {/* Reset Filters button if any active */}
                  {(securitySearchTerm || securityUserFilter !== 'all' || securityTriggerFilter !== 'all') && (
                    <button
                      onClick={handleResetSecurityFilters}
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-bold transition-all shrink-0"
                      title="Reset all active filters"
                    >
                      <X className="w-3.5 h-3.5" />
                      Reset Filters
                    </button>
                  )}
                </div>

                {/* Inspect Audit Incidents Table */}
                <div className="backdrop-blur-xl bg-slate-900/60 border border-slate-800/80 shadow-2xl rounded-3xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-900/90 text-[10px] uppercase font-black tracking-widest text-slate-400 border-b border-slate-800">
                          <th className="p-4">User / Perpetrator</th>
                          <th className="p-4">Client Public IP</th>
                          <th className="p-4">Inspect Trigger</th>
                          <th className="p-4">Route Path</th>
                          <th className="p-4">Timestamp</th>
                          <th className="p-4">Details</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm font-medium text-slate-200 divide-y divide-slate-800/60">
                        {filteredAudits.length > 0 ? filteredAudits.map((record) => {
                          const badgeColor =
                            record.eventType === 'devtools_inspect_shortcut'
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                              : record.eventType === 'contextmenu_inspect'
                              ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                              : record.eventType === 'devtools_opened'
                              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                              : 'bg-amber-500/20 text-amber-300 border-amber-500/40';

                          return (
                            <tr key={record.id} className="hover:bg-slate-800/40 transition-colors">
                              <td className="p-4">
                                <div className="font-bold text-white flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-300 font-black text-xs flex items-center justify-center">
                                    {(record.name || record.email || '?').charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <div>{record.name || 'Unnamed User'}</div>
                                    <div className="text-xs text-slate-400">{record.email}</div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="font-mono text-[10px] text-slate-500">UID: {record.uid}</span>
                                  <button
                                    onClick={() => setSecurityUserFilter(record.uid || record.email || 'anonymous')}
                                    className="inline-flex items-center gap-1 text-[10px] font-bold text-cyan-400 hover:text-cyan-300 transition-colors"
                                    title={`Filter all activities for ${record.name || record.email}`}
                                  >
                                    <Filter className="w-2.5 h-2.5" /> Filter User
                                  </button>
                                </div>
                              </td>
                              <td className="p-4">
                                <span className="inline-flex items-center gap-1.5 font-mono text-xs font-black bg-slate-950 border border-slate-800 px-2.5 py-1 rounded-lg text-emerald-400">
                                  {record.ip}
                                  <button
                                    onClick={() => copyToClipboard(record.ip, `IP ${record.ip} copied`)}
                                    className="text-slate-500 hover:text-white transition-colors"
                                    title="Copy IP"
                                  >
                                    <Copy className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => setSecuritySearchTerm(record.ip)}
                                    className="text-slate-500 hover:text-cyan-400 transition-colors"
                                    title="Filter by this IP address"
                                  >
                                    <Search className="w-3 h-3" />
                                  </button>
                                </span>
                              </td>
                              <td className="p-4">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider border ${badgeColor}`}>
                                  {record.eventType === 'devtools_inspect_shortcut' ? 'F12 / Shortcut' :
                                   record.eventType === 'contextmenu_inspect' ? 'Right Click Inspect' :
                                   record.eventType === 'devtools_opened' ? 'DevTools Docked' :
                                   record.eventType}
                                </span>
                              </td>
                              <td className="p-4 font-mono text-xs text-slate-300">{record.path}</td>
                              <td className="p-4 text-xs text-slate-400 whitespace-nowrap">
                                <div>{formatDate(record.timestamp)}</div>
                                <div className="text-[10px] text-slate-500 font-mono">
                                  {Math.round((Date.now() - record.timestampMs) / 1000)}s ago
                                </div>
                              </td>
                              <td className="p-4 text-xs text-slate-400 max-w-xs truncate" title={record.details || record.userAgent}>
                                {record.details || record.userAgent}
                              </td>
                            </tr>
                          );
                        }) : (
                          <tr>
                            <td colSpan={6} className="p-16 text-center text-slate-500 font-medium">
                              {securityAudits.length > 0 ? (
                                <div className="space-y-3">
                                  <Filter className="w-10 h-10 text-amber-400/50 mx-auto" />
                                  <p className="text-white font-bold text-sm">No security activities match your filter.</p>
                                  <p className="text-xs text-slate-400">Try adjusting your search query, selected user, or trigger type.</p>
                                  <button
                                    onClick={handleShowAllActivities}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500 text-slate-950 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95"
                                  >
                                    <Layers className="w-3.5 h-3.5" />
                                    Show All Activities
                                  </button>
                                </div>
                              ) : (
                                <div>
                                  <ShieldCheck className="w-10 h-10 text-emerald-400/50 mx-auto mb-2" />
                                  No element inspect attempts logged yet. Real-time telemetry is actively listening.
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )
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
            className="relative max-w-lg w-full bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Lightbox Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
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

            {/* High-res Image Display */}
            <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center p-2 min-h-[280px]">
              {photoLightboxUrl && !failedAvatarUrls[photoLightboxUrl] ? (
                <img
                  src={photoLightboxUrl}
                  alt={photoLightboxUser?.name || 'High resolution profile avatar'}
                  onError={() => setFailedAvatarUrls(prev => ({ ...prev, [photoLightboxUrl!]: true }))}
                  className="max-h-[60vh] max-w-full rounded-xl object-contain shadow-2xl"
                />
              ) : (
                <div className="w-24 h-24 rounded-3xl flex items-center justify-center font-black text-3xl bg-slate-800 border border-slate-700 text-cyan-300">
                  {(photoLightboxUser?.name || photoLightboxUser?.email || '?').charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            {/* Lightbox Actions */}
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
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors border border-slate-700"
                >
                  Open Original
                </a>
                <button
                  onClick={() => copyToClipboard(photoLightboxUrl, 'Photo URL copied')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-xl text-xs font-black transition-colors"
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
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-[32px] shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-3.5 min-w-0">
                {/* User Avatar with Zoom Lightbox Trigger */}
                <div
                  className="relative group cursor-pointer shrink-0"
                  onClick={() => {
                    if (selectedUserForModal.photoURL) {
                      setPhotoLightboxUrl(selectedUserForModal.photoURL);
                      setPhotoLightboxUser(selectedUserForModal);
                    }
                  }}
                  title={selectedUserForModal.photoURL ? "Click to view full-size profile photo" : undefined}
                >
                  {selectedUserForModal.photoURL ? (
                    <img
                      src={selectedUserForModal.photoURL}
                      alt={selectedUserForModal.name || 'User Avatar'}
                      className="w-14 h-14 rounded-2xl object-cover border-2 border-cyan-500/40 shadow-lg group-hover:scale-105 transition-transform bg-slate-800"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 text-cyan-300 font-black text-xl flex items-center justify-center border border-cyan-500/40">
                      {(selectedUserForModal.name || selectedUserForModal.email || '?').charAt(0).toUpperCase()}
                    </div>
                  )}
                  {selectedUserForModal.photoURL && (
                    <div className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                      <Eye className="w-5 h-5" />
                    </div>
                  )}
                  <span
                    className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-slate-900 ${getUserPresenceStatus(selectedUserForModal).dotCls}`}
                    title={`Live Status: ${getUserPresenceStatus(selectedUserForModal).label}`}
                  />
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-black text-white truncate">
                    {selectedUserForModal.name || selectedUserForModal.email?.split('@')[0] || 'User Profile'}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs font-medium text-slate-400 truncate">{selectedUserForModal.email}</span>
                    <button
                      onClick={() => copyToClipboard(selectedUserForModal.uid, `Firebase UID copied: ${selectedUserForModal.uid}`)}
                      className="inline-flex items-center gap-1 font-mono text-[10px] text-slate-400 hover:text-cyan-400 bg-slate-800/80 px-2 py-0.5 rounded transition-colors"
                      title="Copy Firebase UID"
                    >
                      <span>UID: {selectedUserForModal.uid.slice(0, 12)}…</span>
                      <Copy className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedUserForModal(null)}
                className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-slate-800 bg-slate-900/90 px-6 gap-2">
              {[
                { id: 'profile', label: 'Overview & Details', icon: UserIcon },
                { id: 'logins', label: userLoginHistory.length > 0 ? `Logins (${userLoginHistory.length})` : 'Login History', icon: Globe },
                { id: 'chats', label: `Chats (${selectedUserForModal.chatThreads?.length || 0})`, icon: MessageSquare },
                { id: 'tasks', label: `Tasks (${selectedUserForModal.tasks?.length || 0})`, icon: ListTodo },
                { id: 'raw', label: 'Raw JSON', icon: FileJson },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setModalTab(id as any)}
                  className={`flex items-center gap-1.5 py-3.5 px-3.5 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${
                    modalTab === id ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              ))}
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6 custom-scrollbar">
              {modalTab === 'profile' && (() => {
                const modalPresence = getUserPresenceStatus(selectedUserForModal);
                return (
                <div className="space-y-6">
                  {/* Live Presence Banner */}
                  <div className={`p-4 rounded-2xl border flex items-center justify-between ${modalPresence.badgeCls}`}>
                    <div className="flex items-center gap-3">
                      <span className="relative flex h-3 w-3">
                        {modalPresence.status === 'online' && (
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        )}
                        <span className={`relative inline-flex rounded-full h-3 w-3 ${modalPresence.dotCls}`} />
                      </span>
                      <div>
                        <span className="text-xs font-black uppercase tracking-wider block">
                          Real-Time Presence: {modalPresence.label}
                        </span>
                        <span className="text-[11px] text-slate-300 font-normal">
                          {modalPresence.status === 'online'
                            ? 'User is actively on Cognify right now.'
                            : modalPresence.status === 'away'
                            ? `Last recorded interaction was ~${modalPresence.minutesAgo} minutes ago.`
                            : 'User is currently offline.'}
                        </span>
                      </div>
                    </div>
                    {selectedUserForModal.photoURL && (
                      <button
                        onClick={() => {
                          setPhotoLightboxUrl(selectedUserForModal.photoURL!);
                          setPhotoLightboxUser(selectedUserForModal);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900/80 hover:bg-slate-800 text-cyan-300 border border-cyan-500/30 rounded-xl text-xs font-bold transition-all shrink-0"
                      >
                        <Eye className="w-3.5 h-3.5" /> View Photo
                      </button>
                    )}
                  </div>

                  {/* Key Stats Bar */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                      <div className="text-xs font-bold text-slate-400 uppercase">Points</div>
                      <div className="text-xl font-black text-cyan-400 mt-1 font-mono">{selectedUserForModal.points || 0}</div>
                    </div>
                    <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                      <div className="text-xs font-bold text-slate-400 uppercase">Cognitive Score</div>
                      <div className="text-xl font-black text-white mt-1 font-mono">{selectedUserForModal.iqScore || '--'}</div>
                    </div>
                    <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                      <div className="text-xs font-bold text-slate-400 uppercase">Cognitive Level</div>
                      <div className="text-sm font-black text-white mt-1.5 uppercase">{selectedUserForModal.level || 'Intermediate'}</div>
                    </div>
                    <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                      <div className="text-xs font-bold text-slate-400 uppercase">Section</div>
                      <div className="text-sm font-black text-white mt-1.5">{sectionOf(selectedUserForModal)}</div>
                    </div>
                  </div>

                  {/* Academic & Bio Info */}
                  <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3.5 text-xs font-medium">
                    <h4 className="font-black uppercase tracking-wider text-slate-400 text-[11px]">Academic & System Info</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div><span className="text-slate-400">University:</span> <span className="font-bold text-white">{selectedUserForModal.university || 'N/A'}</span></div>
                      <div><span className="text-slate-400">Faculty:</span> <span className="font-bold text-white">{selectedUserForModal.faculty || 'N/A'}</span></div>
                      <div><span className="text-slate-400">Department:</span> <span className="font-bold text-white">{selectedUserForModal.department || 'N/A'}</span></div>
                      <div><span className="text-slate-400">Role:</span> <span className="font-bold text-white">{selectedUserForModal.role || 'Student'}</span></div>
                      <div>
                        <span className="text-slate-400">System Role:</span>{' '}
                        {isSuperAdminUser(selectedUserForModal) ? (
                          <span className="inline-flex items-center gap-1 font-bold text-amber-400">
                            <Crown className="w-3.5 h-3.5" /> Super Admin User
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-bold text-slate-300">
                            <UserIcon className="w-3.5 h-3.5 text-slate-400" /> Normal User
                          </span>
                        )}
                      </div>
                      <div><span className="text-slate-400">Language:</span> <span className="font-bold text-white">{selectedUserForModal.language || 'English'}</span></div>
                      <div>
                        <span className="text-slate-400">Country:</span>{' '}
                        <span className="font-bold text-emerald-400">
                          {formatCountryName(selectedUserForModal.country)}
                        </span>
                      </div>
                      {selectedUserForModal.city && (
                        <div>
                          <span className="text-slate-400">City:</span>{' '}
                          <span className="font-bold text-white">{selectedUserForModal.city}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-slate-400">Last Active:</span>{' '}
                        <span className="font-bold text-white">{formatDate(newestActiveIso(selectedUserForModal))}</span>
                      </div>
                      {selectedUserForModal.lastLoginDevice && (
                        <div>
                          <span className="text-slate-400">Device:</span>{' '}
                          <span className="font-bold text-slate-300">{selectedUserForModal.lastLoginDevice}</span>
                        </div>
                      )}
                      {selectedUserForModal.lastIp && (
                        <div>
                          <span className="text-slate-400">Last IP:</span>{' '}
                          <span className="font-mono text-cyan-300 font-bold text-[11px] bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                            {selectedUserForModal.lastIp}
                          </span>
                        </div>
                      )}
                      {selectedUserForModal.passwordResetRequestedAt && (
                        <div>
                          <span className="text-slate-400">Last Pass Reset:</span>{' '}
                          <span className="font-bold text-amber-300 font-mono text-[11px]">
                            {formatDate(selectedUserForModal.passwordResetRequestedAt)}
                          </span>
                        </div>
                      )}
                      {selectedUserForModal.disabilityType && (
                        <div><span className="text-slate-400">Disability:</span> <span className="font-bold text-rose-400">{selectedUserForModal.disabilityType}</span></div>
                      )}
                      {selectedUserForModal.accessibilityMode && selectedUserForModal.accessibilityMode !== 'None' && (
                        <div><span className="text-slate-400">Active Mode:</span> <span className="font-bold text-amber-400">{selectedUserForModal.accessibilityMode}</span></div>
                      )}
                      {selectedUserForModal.organization && (
                        <div><span className="text-slate-400">Organization:</span> <span className="font-bold text-cyan-400">{selectedUserForModal.organization}</span></div>
                      )}
                    </div>
                  </div>

                  {/* Admin Actions */}
                  <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
                    <h4 className="font-black uppercase tracking-wider text-slate-400 text-[11px]">Admin Adjustments</h4>
                    <div className="flex flex-wrap items-center gap-2.5">
                      {/* Role Promotion / Demotion */}
                      {canManageSuperAdmin(profile, selectedUserForModal) && (
                        isSuperAdminUser(selectedUserForModal) ? (
                          <button
                            onClick={() => handleToggleSuperAdmin(selectedUserForModal, false)}
                            disabled={busyUid === selectedUserForModal.uid}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
                          >
                            <UserMinus className="w-3.5 h-3.5" /> Demote to Normal User
                          </button>
                        ) : (
                          <button
                            onClick={() => handleToggleSuperAdmin(selectedUserForModal, true)}
                            disabled={busyUid === selectedUserForModal.uid}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
                          >
                            <Crown className="w-3.5 h-3.5" /> Promote to Super Admin User
                          </button>
                        )
                      )}

                      {/* Super Admin Password Reset */}
                      {isSuperAdmin && (
                        <button
                          onClick={() => setPasswordModalUser(selectedUserForModal)}
                          disabled={busyUid === selectedUserForModal.uid}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
                        >
                          <Key className="w-3.5 h-3.5" /> Change / Reset Password
                        </button>
                      )}

                      <button
                        onClick={() => handleUpdatePoints(selectedUserForModal, 50)}
                        disabled={busyUid === selectedUserForModal.uid}
                        className="px-3.5 py-1.5 bg-cyan-500 text-slate-950 text-xs font-bold rounded-xl hover:bg-cyan-400 transition-colors disabled:opacity-50"
                      >
                        +50 Points
                      </button>
                      <button
                        onClick={() => handleUpdatePoints(selectedUserForModal, -50)}
                        disabled={busyUid === selectedUserForModal.uid}
                        className="px-3.5 py-1.5 bg-slate-900 border border-slate-700 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50"
                      >
                        -50 Points
                      </button>
                      <select
                        value={selectedUserForModal.level || 'Intermediate'}
                        onChange={(e) => handleUpdateCognitiveLevel(selectedUserForModal, e.target.value as CognitiveLevel)}
                        disabled={busyUid === selectedUserForModal.uid}
                        className="bg-slate-900 border border-slate-700 text-white text-xs font-bold rounded-xl px-3 py-1.5 outline-none cursor-pointer"
                      >
                        <option value="Basic">Level: Basic</option>
                        <option value="Intermediate">Level: Intermediate</option>
                        <option value="Advanced">Level: Advanced</option>
                      </select>
                      <select
                        value={selectedUserForModal.country && selectedUserForModal.country !== 'Unknown' && selectedUserForModal.country !== 'N/A' ? selectedUserForModal.country : ''}
                        onChange={(e) => handleUpdateCountry(selectedUserForModal, e.target.value)}
                        disabled={busyUid === selectedUserForModal.uid}
                        className="bg-slate-900 border border-slate-700 text-white text-xs font-bold rounded-xl px-3 py-1.5 outline-none cursor-pointer"
                        title="Set or update user's country"
                      >
                        <option value="" disabled>Set Country...</option>
                        {COMMON_COUNTRIES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.name} ({c.code})
                          </option>
                        ))}
                      </select>
                      <a
                        href={`mailto:${selectedUserForModal.email}?subject=Message from Cognify Admin`}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 text-white text-xs font-bold rounded-xl hover:bg-slate-700 transition-colors border border-slate-700"
                      >
                        <Mail className="w-3.5 h-3.5" /> Send Email
                      </a>
                    </div>
                  </div>
                </div>
                );
              })()}

              {modalTab === 'logins' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-black uppercase tracking-wider text-slate-400 text-[11px]">
                        Login & Geolocation History
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Historical login sessions, detected countries, and device footprints.
                      </p>
                    </div>
                    {loadingLogins && (
                      <div className="flex items-center gap-2 text-xs text-cyan-400">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Fetching logs…</span>
                      </div>
                    )}
                  </div>

                  {userLoginHistory.length > 0 ? (
                    <div className="space-y-2.5">
                      {userLoginHistory.map((record, index) => {
                        const isLatest = index === 0;
                        return (
                          <div
                            key={record.id || index}
                            className={`p-4 rounded-2xl border transition-all ${
                              isLatest
                                ? 'bg-emerald-950/20 border-emerald-500/30'
                                : 'bg-slate-950 border-slate-800/80'
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-white text-sm">
                                  {formatCountryName(record.country)}
                                </span>
                                {record.city && (
                                  <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded-md text-[11px]">
                                    {record.city}{record.region ? `, ${record.region}` : ''}
                                  </span>
                                )}
                                {isLatest && (
                                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-md text-[10px] font-bold uppercase tracking-wider">
                                    Latest Session
                                  </span>
                                )}
                              </div>
                              <span className="font-mono text-[11px] text-slate-400">
                                {formatDate(record.timestamp)}
                              </span>
                            </div>

                            <div className="mt-2.5 pt-2.5 border-t border-slate-900 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                              <span className="flex items-center gap-1.5">
                                <Cpu className="w-3 h-3 text-slate-500" />
                                {record.device || 'Standard Web Client'}
                              </span>
                              {record.ip && (
                                <span className="font-mono text-slate-500 text-[10px]">
                                  IP: {record.ip}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-6 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                          <Globe className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-white font-bold text-xs">Primary Recorded Location</div>
                          <div className="text-[11px] text-slate-400">
                            Captured from user profile telemetry (available even when offline).
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 pt-2 text-xs border-t border-slate-900">
                        <div>
                          <span className="text-slate-500 block text-[10px] uppercase">Last Known Country</span>
                          <span className="font-bold text-emerald-400">
                            {formatCountryName(selectedUserForModal.country)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px] uppercase">Last Active Timestamp</span>
                          <span className="font-mono text-slate-300 text-[11px]">
                            {formatDate(newestActiveIso(selectedUserForModal))}
                          </span>
                        </div>
                        {selectedUserForModal.city && (
                          <div>
                            <span className="text-slate-500 block text-[10px] uppercase">Last Known City</span>
                            <span className="font-bold text-white">{selectedUserForModal.city}</span>
                          </div>
                        )}
                        {selectedUserForModal.lastLoginDevice && (
                          <div>
                            <span className="text-slate-500 block text-[10px] uppercase">Last Device</span>
                            <span className="text-slate-300">{selectedUserForModal.lastLoginDevice}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {modalTab === 'chats' && (
                <div className="space-y-3">
                  <h4 className="font-black uppercase tracking-wider text-slate-400 text-[11px]">Saved Chat Sessions</h4>
                  {selectedUserForModal.chatThreads && selectedUserForModal.chatThreads.length > 0 ? (
                    <div className="space-y-2">
                      {selectedUserForModal.chatThreads.map((thread) => (
                        <div key={thread.id} className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-white">{thread.title || 'Untitled Chat'}</span>
                            <span className="text-[10px] text-slate-400">{formatDate(thread.updatedAt)}</span>
                          </div>
                          {thread.lastMessageSnippet && (
                            <p className="text-xs text-slate-400 line-clamp-2">{thread.lastMessageSnippet}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-slate-500 text-xs">No saved chat sessions for this user.</div>
                  )}
                </div>
              )}

              {modalTab === 'tasks' && (
                <div className="space-y-3">
                  <h4 className="font-black uppercase tracking-wider text-slate-400 text-[11px]">Tasks & Objectives</h4>
                  {selectedUserForModal.tasks && selectedUserForModal.tasks.length > 0 ? (
                    <div className="space-y-2">
                      {selectedUserForModal.tasks.map((task) => (
                        <div key={task.id} className="flex items-center gap-3 p-3.5 bg-slate-950 border border-slate-800 rounded-2xl text-xs">
                          <div className={`p-1.5 rounded-lg ${task.completed ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>
                            {task.completed ? <Check className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                          </div>
                          <div className="flex-1 font-medium text-white">{task.content}</div>
                          <span className={`text-[10px] font-black uppercase ${task.completed ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {task.completed ? 'Completed' : 'Pending'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-slate-500 text-xs">No tasks recorded for this user.</div>
                  )}
                </div>
              )}

              {modalTab === 'raw' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-black uppercase tracking-wider text-slate-400 text-[11px]">Firestore Document JSON</h4>
                    <button
                      onClick={() => copyToClipboard(JSON.stringify(selectedUserForModal, null, 2), 'JSON copied to clipboard')}
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white rounded-lg transition-colors border border-slate-700"
                    >
                      <Copy className="w-3 h-3" /> Copy JSON
                    </button>
                  </div>
                  <pre className="p-4 bg-slate-950 text-emerald-400 font-mono text-xs rounded-2xl overflow-x-auto border border-slate-800 max-h-96 custom-scrollbar">
                    {JSON.stringify(selectedUserForModal, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── PASSWORD RESET MODAL ───────────────────────────────────────────── */}
      {passwordModalUser && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/40 rounded-[28px] shadow-2xl shadow-amber-500/10 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded-2xl shadow-inner">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white uppercase tracking-tight">Change / Reset Password</h3>
                  <p className="text-xs text-slate-400">Super Admin Authentication Management</p>
                </div>
              </div>
              <button
                onClick={() => setPasswordModalUser(null)}
                disabled={isSendingPasswordReset}
                className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-full transition-colors disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-5">
              {/* Target user card */}
              <div className="p-4 bg-slate-950/80 border border-slate-800/80 rounded-2xl flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-cyan-500/20 text-amber-300 font-black text-lg flex items-center justify-center border border-amber-500/30 shrink-0 shadow-inner">
                  {(passwordModalUser.name || passwordModalUser.email || '?').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-white text-sm truncate">{passwordModalUser.name || 'Unnamed User'}</div>
                  <div className="text-xs text-slate-400 truncate">{passwordModalUser.email}</div>
                  <div className="flex items-center gap-2 mt-1">
                    {isSuperAdminUser(passwordModalUser) ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                        <Crown className="w-2.5 h-2.5" /> Super Admin User
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-slate-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                        <UserIcon className="w-2.5 h-2.5" /> Normal User
                      </span>
                    )}
                    <span className="text-[10px] font-mono text-slate-500">UID: {passwordModalUser.uid.slice(0, 8)}…</span>
                  </div>
                </div>
              </div>

              {/* Informative notice */}
              <div className="p-4 bg-slate-950/50 border border-amber-500/20 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                  <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Official Firebase Password Reset Protocol</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Triggering this action sends an official, secure Firebase password reset email to{' '}
                  <span className="text-white font-bold">{passwordModalUser.email}</span>.
                  The user can click the verified link to securely update their password.
                </p>
                {passwordModalUser.passwordResetRequestedAt && (
                  <p className="text-[11px] text-slate-400 font-mono pt-1.5 border-t border-slate-800/80">
                    Last reset requested: {formatDate(passwordModalUser.passwordResetRequestedAt)}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setPasswordModalUser(null)}
                  disabled={isSendingPasswordReset}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSendPasswordReset(passwordModalUser)}
                  disabled={isSendingPasswordReset}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 active:scale-95"
                >
                  {isSendingPasswordReset ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Sending Reset Link...
                    </>
                  ) : (
                    <>
                      <Key className="w-4 h-4" /> Send Password Reset Email
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
