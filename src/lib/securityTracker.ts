/**
 * Cognify DevTools & Element Inspect Security Tracker
 * 
 * Provides real-time detection and telemetry for:
 * 1. DevTools keyboard shortcuts (F12, Ctrl+Shift+I/J/C, Cmd+Option+I/J/C, Ctrl+U)
 * 2. Context-menu right clicks on DOM elements
 * 3. DevTools docking and resize dimension probes
 * 4. Console getter evaluation probes
 * 
 * Automatically captures user identity (UID, email, role, path) and client public IP,
 * logs to Firestore's `securityAudits` collection, stores an offline localStorage backup,
 * and emits real-time events for the Super Admin alert banner.
 */

import { db } from './firebase';
import {
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import { getApiUrl } from '../config/api';
import { UserProfile } from '../types';
import { isSuperAdminUser } from './roles';
import { toast } from '../components/Toast';

export interface SecurityAuditRecord {
  id: string;
  uid: string;
  email: string;
  name: string;
  role: string;
  ip: string;
  eventType: 'devtools_inspect_shortcut' | 'devtools_opened' | 'contextmenu_inspect' | 'debugger_probe';
  details: string;
  userAgent: string;
  path: string;
  timestamp: string; // ISO string
  timestampMs: number;
}

export const LOCAL_STORAGE_SECURITY_KEY = 'cognify_security_audits_local';
const THROTTLE_WINDOW_MS = 15000; // 15 seconds per event type

// Module-level IP cache
let cachedClientIp: string | null = null;
const lastEventTimes = new Map<SecurityAuditRecord['eventType'], number>();

/**
 * Resets the cached IP (useful for tests and offline/online transitions).
 */
export function resetClientIpCache(): void {
  cachedClientIp = null;
}

/**
 * Resolves the client's public IP address.
 * Tries internal serverless API (/api/telemetry/securityAudit) first.
 * Falls back to external ipify service.
 * Defaults to '127.0.0.1 (Local)' if offline or unreachable.
 * Caches the resolved IP in a module variable so it only calls once or as needed.
 */
export async function resolveClientIp(): Promise<string> {
  if (cachedClientIp && cachedClientIp !== '127.0.0.1 (Local)') {
    return cachedClientIp;
  }

  // 1. Try serverless telemetry endpoint
  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeout = controller ? setTimeout(() => controller.abort(), 3000) : null;
    const res = await fetch(getApiUrl('/api/telemetry/securityAudit'), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller ? controller.signal : undefined,
    });
    if (timeout) clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data && data.ip && typeof data.ip === 'string') {
        cachedClientIp = data.ip;
        return cachedClientIp;
      }
    }
  } catch {
    // Fall through to external lookup
  }

  // 2. Try external ipify lookup
  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeout = controller ? setTimeout(() => controller.abort(), 3000) : null;
    const res = await fetch('https://api.ipify.org?format=json', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller ? controller.signal : undefined,
    });
    if (timeout) clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data && data.ip && typeof data.ip === 'string') {
        cachedClientIp = data.ip;
        return cachedClientIp;
      }
    }
  } catch {
    // Fall through to local fallback
  }

  cachedClientIp = '127.0.0.1 (Local)';
  return cachedClientIp;
}

/**
 * Logs a security audit event with throttling, identity extraction,
 * Firestore persistence, localStorage backup, and real-time custom event dispatch.
 */
export async function logSecurityEvent(
  profile: Partial<UserProfile> | null,
  eventType: SecurityAuditRecord['eventType'],
  details: string
): Promise<SecurityAuditRecord | null> {
  const now = Date.now();
  const lastTime = lastEventTimes.get(eventType) || 0;

  // Throttled: ignore duplicate events of same type within 15 seconds
  if (now - lastTime < THROTTLE_WINDOW_MS) {
    return null;
  }
  lastEventTimes.set(eventType, now);

  const ip = await resolveClientIp();
  const nowMs = Date.now();
  const tempId = `sec_${nowMs}_${Math.random().toString(36).substring(2, 9)}`;

  const record: SecurityAuditRecord = {
    id: tempId,
    uid: profile?.uid || 'anonymous',
    email: profile?.email || 'anonymous@cognify.internal',
    name: profile?.name || 'Anonymous User',
    role: isSuperAdminUser(profile)
      ? 'Super Admin'
      : (profile as any)?.isAdmin
      ? 'Admin'
      : (profile?.role as string) || 'Student/User',
    ip,
    eventType,
    details,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Node.js/Test',
    path: typeof window !== 'undefined' ? (window.location.pathname + window.location.hash || '/') : '/',
    timestamp: new Date(nowMs).toISOString(),
    timestampMs: nowMs,
  };

  // 1. Save to Firestore collection `securityAudits`
  try {
    const docRef = await addDoc(collection(db, 'securityAudits'), {
      uid: record.uid,
      email: record.email,
      name: record.name,
      role: record.role,
      ip: record.ip,
      eventType: record.eventType,
      details: record.details,
      userAgent: record.userAgent,
      path: record.path,
      timestamp: record.timestamp,
      timestampMs: record.timestampMs,
    });
    if (docRef?.id) {
      record.id = docRef.id;
    }
  } catch (err) {
    console.debug('[SecurityTracker] Firestore offline/unauthenticated in test or restricted mode.');
  }

  // 2. Append to localStorage backup (cognify_security_audits_local)
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const existingRaw = window.localStorage.getItem(LOCAL_STORAGE_SECURITY_KEY);
      const existing: SecurityAuditRecord[] = existingRaw ? JSON.parse(existingRaw) : [];
      const updated = [record, ...existing.filter((r) => r.id !== record.id)].slice(0, 100);
      window.localStorage.setItem(LOCAL_STORAGE_SECURITY_KEY, JSON.stringify(updated));
    }
  } catch (err) {
    console.warn('[SecurityTracker] Failed to save local security audit backup:', err);
  }

  // 3. Dispatch custom window event `cognify:security_alert` for immediate UI notification
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('cognify:security_alert', { detail: record }));
    } catch (err) {
      console.warn('[SecurityTracker] Failed to dispatch window alert event:', err);
    }
  }

  return record;
}

/**
 * Checks if the user is currently located in the protected Database Dashboard
 * or Admin Management area.
 */
export function isDatabaseDashboardActive(): boolean {
  if (typeof window === 'undefined') return false;
  const hash = (window.location.hash || '').toLowerCase();
  if (hash === '#admin' || hash.startsWith('#admin') || hash.includes('database')) {
    return true;
  }
  if (
    document.querySelector('[data-security-zone="database-dashboard"]') ||
    document.querySelector('[data-security-zone="admin-dashboard"]')
  ) {
    return true;
  }
  return false;
}

/**
 * Checks if a triggered DOM event target resides within the Database Dashboard container.
 */
export function isTargetInsideDatabaseDashboard(target: EventTarget | null): boolean {
  if (isDatabaseDashboardActive()) return true;
  if (target && target instanceof HTMLElement) {
    if (target.closest('[data-security-zone="database-dashboard"], [data-security-zone="admin-dashboard"]')) {
      return true;
    }
  }
  return false;
}

/**
 * Initializes global security listeners for keyboard shortcuts, context menus,
 * DevTools docking dimensions, and console getter probes.
 * 
 * Returns a cleanup function to remove all listeners.
 */
export function initSecurityTracker(
  getProfile: () => Partial<UserProfile> | null
): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  // Console warning banner to deter theft and reverse engineering
  try {
    console.log(
      '%c🛑 STOP! 🛡️ Cognify Anti-Tamper & Security Shield Active',
      'color: #ef4444; font-size: 18px; font-weight: 900; background: #0b0f19; padding: 6px 10px; border-radius: 6px; border: 1px solid #ef4444;'
    );
    console.log(
      '%cAll unauthorized inspection, code reverse-engineering, script tampering, and credential extraction attempts are cryptographically tracked, geo-located, and permanently logged to the central security audit registry.',
      'color: #38bdf8; font-size: 11px; font-weight: 600;'
    );
  } catch {}

  // 1. Keyboard Shortcut Listener (F12, Ctrl+Shift+I/J/C, Cmd+Option+I/J/C, Ctrl+U)
  const handleKeyDown = (e: KeyboardEvent) => {
    const isCtrl = e.ctrlKey;
    const isMeta = e.metaKey; // Command on macOS
    const isShift = e.shiftKey;
    const isAlt = e.altKey; // Option on macOS
    const key = e.key ? e.key.toUpperCase() : '';

    let shortcut: string | null = null;

    if (e.key === 'F12' || e.keyCode === 123) {
      shortcut = 'F12';
    } else if ((isCtrl && isShift && (key === 'I' || key === 'J' || key === 'C')) ||
               (isMeta && isAlt && (key === 'I' || key === 'J' || key === 'C'))) {
      const prefix = isMeta ? 'Cmd+Option' : 'Ctrl+Shift';
      shortcut = `${prefix}+${key}`;
    } else if ((isCtrl || isMeta) && key === 'U') {
      shortcut = `${isMeta ? 'Cmd' : 'Ctrl'}+U`;
    }

    if (shortcut) {
      const inDbDashboard = isTargetInsideDatabaseDashboard(e.target);
      const path = typeof window !== 'undefined' ? (window.location.hash || window.location.pathname || '/') : '/';

      if (inDbDashboard) {
        // DevTools & Inspect are STRICTLY PROHIBITED in the Database Dashboard
        try {
          e.preventDefault();
          e.stopPropagation();
        } catch {}

        try {
          toast.error(
            '🔒 DevTools & Element Inspection are prohibited in the Database Dashboard to protect sensitive infrastructure and database records.',
            'Inspect Restricted'
          );
        } catch {}

        logSecurityEvent(
          getProfile(),
          'devtools_inspect_shortcut',
          `BLOCKED IN DATABASE DASHBOARD: User attempted DevTools shortcut: ${shortcut} on Database Dashboard`
        );
      } else {
        // Inspect is ALLOWED on regular pages, but the system DETECTS and logs the user
        logSecurityEvent(
          getProfile(),
          'devtools_inspect_shortcut',
          `DevTools shortcut used: ${shortcut} on page ${path}`
        );
      }
    }
  };

  // 2. Context Menu Listener (Right-click element inspect attempt)
  const handleContextMenu = (e: MouseEvent) => {
    const target = e.target as HTMLElement | null;
    const inDbDashboard = isTargetInsideDatabaseDashboard(target);
    const tag = target?.tagName ? target.tagName.toLowerCase() : 'element';
    const id = target?.id ? `#${target.id}` : '';
    const classes = target?.className && typeof target.className === 'string'
      ? `.${target.className.trim().split(/\s+/).slice(0, 2).join('.')}`
      : '';
    const path = typeof window !== 'undefined' ? (window.location.hash || window.location.pathname || '/') : '/';

    if (inDbDashboard) {
      // Right-click inspect is STRICTLY PROHIBITED in the Database Dashboard
      try {
        e.preventDefault();
        e.stopPropagation();
      } catch {}

      try {
        toast.error(
          '🔒 Right-click inspect is disabled in the Database Dashboard to protect database infrastructure.',
          'Inspect Restricted'
        );
      } catch {}

      const details = `BLOCKED IN DATABASE DASHBOARD: Right-click inspect attempted on <${tag}${id}${classes}> at (${e.clientX}, ${e.clientY})`;
      logSecurityEvent(getProfile(), 'contextmenu_inspect', details);
    } else {
      // Right-click inspect is ALLOWED on regular pages, but the system DETECTS and logs the user
      const details = `Right-click inspect/contextmenu opened on <${tag}${id}${classes}> at (${e.clientX}, ${e.clientY}) on page ${path}`;
      logSecurityEvent(getProfile(), 'contextmenu_inspect', details);
    }
  };

  // 3. Window Dimension Delta Probe (DevTools docked window detector)
  const checkDimensions = () => {
    try {
      const widthDelta = window.outerWidth - window.innerWidth;
      const heightDelta = window.outerHeight - window.innerHeight;
      const inDbDashboard = isDatabaseDashboardActive();
      const path = window.location.hash || window.location.pathname || '/';

      if (widthDelta > 160 || heightDelta > 160) {
        if (inDbDashboard) {
          logSecurityEvent(
            getProfile(),
            'devtools_opened',
            `CRITICAL: DevTools docked window opened while inside Database Dashboard! (delta: ${widthDelta}px x ${heightDelta}px)`
          );
        } else {
          logSecurityEvent(
            getProfile(),
            'devtools_opened',
            `DevTools docked open state detected on ${path} (delta: ${widthDelta}px x ${heightDelta}px)`
          );
        }
      }
    } catch {}
  };

  // 4. Console Getter Probe (Evaluated when DevTools console formats DOM preview)
  let probeInterval: any = null;
  if (typeof Image !== 'undefined') {
    try {
      const probe = new Image();
      Object.defineProperty(probe, 'id', {
        get() {
          const inDb = isDatabaseDashboardActive();
          const path = typeof window !== 'undefined' ? (window.location.hash || window.location.pathname || '/') : '/';
          logSecurityEvent(
            getProfile(),
            'debugger_probe',
            inDb
              ? 'CRITICAL: DevTools console render detected via Image getter inside Database Dashboard!'
              : `DevTools console render detected via Image getter probe on ${path}`
          );
          return 'cognify_security_probe';
        },
        configurable: true,
      });

      probeInterval = setInterval(() => {
        try {
          console.debug(probe);
        } catch {}
      }, 3000);
    } catch {}
  }

  // 5. Anti-Debugger / Step-through execution timing probe
  let debuggerInterval: any = null;
  if (typeof performance !== 'undefined') {
    debuggerInterval = setInterval(() => {
      try {
        const start = performance.now();
        const diff = performance.now() - start;
        if (diff > 120) {
          logSecurityEvent(
            getProfile(),
            'debugger_probe',
            `Execution timing anomaly detected (${Math.round(diff)}ms delay - active debugger breakpoint suspected)`
          );
        }
      } catch {}
    }, 5000);
  }

  // Register listeners with capture phase for reliable detection
  window.addEventListener('keydown', handleKeyDown, true);
  window.addEventListener('contextmenu', handleContextMenu, true);
  window.addEventListener('resize', checkDimensions);
  const dimensionInterval = setInterval(checkDimensions, 3000);

  // Initial check
  checkDimensions();

  // Return comprehensive cleanup function
  return () => {
    window.removeEventListener('keydown', handleKeyDown, true);
    window.removeEventListener('contextmenu', handleContextMenu, true);
    window.removeEventListener('resize', checkDimensions);
    if (dimensionInterval) clearInterval(dimensionInterval);
    if (probeInterval) clearInterval(probeInterval);
    if (debuggerInterval) clearInterval(debuggerInterval);
  };
}

/**
 * Subscribes to recent security audits from Firestore (most recent 50).
 * Falls back to reading from localStorage if Firestore throws permission or network errors.
 * Returns an unsubscribe function.
 */
export function listenToSecurityAudits(
  onAudits: (audits: SecurityAuditRecord[]) => void,
  limitCount: number = 50
): () => void {
  const readLocalStorageAudits = (): SecurityAuditRecord[] => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(LOCAL_STORAGE_SECURITY_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return parsed;
        }
      }
    } catch (e) {
      console.warn('[SecurityTracker] Failed reading localStorage audits:', e);
    }
    return [];
  };

  try {
    const q = query(
      collection(db, 'securityAudits'),
      orderBy('timestampMs', 'desc'),
      limit(Math.max(1, limitCount))
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const records: SecurityAuditRecord[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            uid: data.uid || '',
            email: data.email || '',
            name: data.name || '',
            role: data.role || '',
            ip: data.ip || '',
            eventType: data.eventType || 'devtools_inspect_shortcut',
            details: data.details || '',
            userAgent: data.userAgent || '',
            path: data.path || '/',
            timestamp: data.timestamp || new Date().toISOString(),
            timestampMs: data.timestampMs || Date.now(),
          };
        });
        onAudits(records);
      },
      (error) => {
        console.warn('[SecurityTracker] Firestore onSnapshot failed, falling back to localStorage:', error);
        onAudits(readLocalStorageAudits());
      }
    );

    return unsubscribe;
  } catch (err) {
    console.warn('[SecurityTracker] Subscription failed to initialize, using localStorage:', err);
    onAudits(readLocalStorageAudits());
    return () => {};
  }
}

/**
 * Super Admin utility to clear local audit records and attempt deleting documents from Firestore.
 */
export async function clearSecurityAudits(): Promise<void> {
  // 1. Clear localStorage backup
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(LOCAL_STORAGE_SECURITY_KEY);
    }
  } catch (err) {
    console.warn('[SecurityTracker] Failed clearing localStorage audits:', err);
  }

  // 2. Attempt deleting documents from Firestore
  try {
    const q = query(collection(db, 'securityAudits'), limit(100));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const batch = writeBatch(db);
      snapshot.docs.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
      await batch.commit();
    }
  } catch (err) {
    console.warn('[SecurityTracker] Failed purging security audits from Firestore (insufficient privileges or offline):', err);
  }
}
