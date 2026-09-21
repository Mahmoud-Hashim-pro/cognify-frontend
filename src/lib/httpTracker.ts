/**
 * Cognify Client-Side HTTPS & API Request Telemetry Tracker
 * 
 * Intercepts and monitors outgoing HTTP/HTTPS fetch calls to provide real-time
 * metrics on backend invocations, Firestore API traffic, Gemini AI calls, and
 * external assets for the Super Admin Database Hub.
 */

export type RequestCategory = 'gemini' | 'telemetry' | 'firebase' | 'internal' | 'external';

export interface HttpRequestRecord {
  url: string;
  method: string;
  category: RequestCategory;
  status: number;
  durationMs: number;
  timestamp: string;
}

export interface HttpMetricsSnapshot {
  sessionRequests: number;
  todayRequests: number;
  dateKey: string;
  byCategory: Record<RequestCategory, number>;
  lastRequest: HttpRequestRecord | null;
  avgDurationMs: number;
}

type MetricsListener = (snapshot: HttpMetricsSnapshot) => void;

const STORAGE_KEY = 'cognify_http_tracker_v1';

function getTodayKey(): string {
  try {
    return new Date().toISOString().split('T')[0];
  } catch {
    return '2026-09-09';
  }
}

// In-memory runtime state
let sessionCount = 0;
let todayCount = 0;
let currentDateKey = getTodayKey();
const categoryCounts: Record<RequestCategory, number> = {
  gemini: 0,
  telemetry: 0,
  firebase: 0,
  internal: 0,
  external: 0,
};
let totalDurationSum = 0;
let lastRecordedRequest: HttpRequestRecord | null = null;
const listeners = new Set<MetricsListener>();

// Categorize URL into actionable groups
export function categorizeUrl(url: string): RequestCategory {
  const u = String(url || '').toLowerCase();
  if (u.includes('/api/gemini') || u.includes('generativelanguage.googleapis.com')) {
    return 'gemini';
  }
  if (u.includes('/api/telemetry') || u.includes('securityaudit') || u.includes('apiify')) {
    return 'telemetry';
  }
  if (
    u.includes('firestore.googleapis.com') ||
    u.includes('identitytoolkit.googleapis.com') ||
    u.includes('firebase') ||
    u.includes('cloudfunctions.net')
  ) {
    return 'firebase';
  }
  if (u.startsWith('/') || (typeof window !== 'undefined' && u.startsWith(window.location.origin))) {
    return 'internal';
  }
  return 'external';
}

// Load daily rolling stats from storage
function loadStoredMetrics(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    const today = getTodayKey();
    if (parsed.dateKey === today && typeof parsed.todayRequests === 'number') {
      todayCount = parsed.todayRequests;
      if (parsed.byCategory) {
        Object.assign(categoryCounts, parsed.byCategory);
      }
    } else {
      // Day has rolled over, reset today's counters
      todayCount = 0;
      currentDateKey = today;
      persistMetrics();
    }
  } catch {
    // Ignore storage read errors
  }
}

// Persist rolling stats
function persistMetrics(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const payload = {
      dateKey: currentDateKey,
      todayRequests: todayCount,
      byCategory: categoryCounts,
      lastSaved: new Date().toISOString(),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage write errors
  }
}

function notifyListeners(): void {
  const snapshot = getHttpMetrics();
  listeners.forEach((fn) => {
    try {
      fn(snapshot);
    } catch {
      // Ignore listener error
    }
  });
}

/**
 * Record an HTTP request into telemetry.
 */
export function recordHttpRequest(
  url: string,
  method: string = 'GET',
  status: number = 200,
  durationMs: number = 0
): void {
  const today = getTodayKey();
  if (today !== currentDateKey) {
    todayCount = 0;
    currentDateKey = today;
    categoryCounts.gemini = 0;
    categoryCounts.telemetry = 0;
    categoryCounts.firebase = 0;
    categoryCounts.internal = 0;
    categoryCounts.external = 0;
  }

  const category = categorizeUrl(url);
  sessionCount++;
  todayCount++;
  categoryCounts[category] = (categoryCounts[category] || 0) + 1;
  totalDurationSum += Math.max(0, durationMs);

  lastRecordedRequest = {
    url: String(url || '').slice(0, 150),
    method: String(method || 'GET').toUpperCase(),
    category,
    status: Number(status) || 200,
    durationMs: Math.round(durationMs),
    timestamp: new Date().toISOString(),
  };

  persistMetrics();
  notifyListeners();
}

/**
 * Returns current snapshot of HTTP traffic.
 */
export function getHttpMetrics(): HttpMetricsSnapshot {
  const total = sessionCount > 0 ? sessionCount : todayCount;
  const avgDurationMs = total > 0 ? Math.round(totalDurationSum / Math.max(1, sessionCount)) : 0;

  return {
    sessionRequests: sessionCount,
    todayRequests: todayCount,
    dateKey: currentDateKey,
    byCategory: { ...categoryCounts },
    lastRequest: lastRecordedRequest ? { ...lastRecordedRequest } : null,
    avgDurationMs,
  };
}

/**
 * Subscribe to HTTP telemetry updates. Returns an unsubscribe callback.
 */
export function subscribeHttpMetrics(listener: MetricsListener): () => void {
  listeners.add(listener);
  // Emit current snapshot immediately upon subscription
  try {
    listener(getHttpMetrics());
  } catch {}
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Reset local session counters.
 */
export function resetSessionHttpMetrics(): void {
  sessionCount = 0;
  totalDurationSum = 0;
  notifyListeners();
}

// Global fetch interceptor installation (browser only, idempotent)
let isInterceptorInstalled = false;

export function initHttpTracker(): void {
  if (isInterceptorInstalled || typeof window === 'undefined' || !window.fetch) return;
  loadStoredMetrics();

  const originalFetch = window.fetch;
  window.fetch = async function (...args: Parameters<typeof fetch>): Promise<Response> {
    const start = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
    const reqInfo = args[0];
    const reqInit = args[1];

    const url = typeof reqInfo === 'string' ? reqInfo : reqInfo instanceof Request ? reqInfo.url : String(reqInfo);
    const method = reqInit?.method || (reqInfo instanceof Request ? reqInfo.method : 'GET');

    try {
      const response = await originalFetch.apply(this, args);
      const end = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
      recordHttpRequest(url, method, response.status, end - start);
      return response;
    } catch (err: any) {
      const end = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
      recordHttpRequest(url, method, 0, end - start);
      throw err;
    }
  };

  isInterceptorInstalled = true;
}

// Auto-initialize when loaded in a browser context
if (typeof window !== 'undefined') {
  initHttpTracker();
}
