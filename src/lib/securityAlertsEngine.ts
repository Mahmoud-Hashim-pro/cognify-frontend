/**
 * Phase C - Requirement 24: Security Telemetry Anomaly Detector & Alerts Engine
 * Cognify 2.0 Production Observability & Tracing Engine
 *
 * Anomaly detector for security telemetry:
 * - Flags rapid rate-limit violations (> 5 in 1 min)
 * - Detects prompt and code injection attempts, alerting on repetitive attempts
 * - Detects unauthorized cross-tenant data access probes
 * - Emits structured security alerts with severity levels and event metadata.
 */

import crypto from 'crypto';

export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type SecurityAlertType =
  | 'RAPID_RATE_LIMIT_VIOLATION'
  | 'INJECTION_ATTEMPT'
  | 'REPETITIVE_INJECTION_ATTEMPT'
  | 'CROSS_TENANT_UNAUTHORIZED_PROBE'
  | 'SUSPICIOUS_AUTH_ANOMALY';

export interface SecurityAlert {
  id: string;
  alertType: SecurityAlertType;
  severity: AlertSeverity;
  timestamp: number;
  isoTimestamp: string;
  identifier: string; // IP address, User ID, or Client ID
  tenantId?: string;
  targetTenantId?: string;
  resourceId?: string;
  violationCount: number;
  message: string;
  details: Record<string, any>;
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
}

export type AlertListener = (alert: SecurityAlert) => void;

// In-memory sliding window trackers
const rateLimitViolations = new Map<string, number[]>(); // identifier -> timestamps
const injectionHistory = new Map<string, { timestamp: number; payload: string; type: string }[]>();
const alertsHistory: SecurityAlert[] = [];
const alertListeners = new Set<AlertListener>();

const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_ALERT_THRESHOLD = 5; // > 5 violations in 1 min trips alert
const INJECTION_WINDOW_MS = 300000; // 5 minutes

// Injection heuristics
const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(?:all\s+)?(?:previous|prior)\s+instructions/i,
  /disregard\s+(?:all\s+)?(?:previous|prior)\s+(?:prompts|rules)/i,
  /system\s+(?:prompt\s+)?override/i,
  /you\s+are\s+now\s+(?:DAN|jailbreak|unrestricted)/i,
  /bypass\s+(?:safety|content)\s+filters?/i,
  /developer\s+mode\s+enabled/i,
  /reveal\s+(?:your\s+)?system\s+instructions/i,
];

const CODE_SQL_INJECTION_PATTERNS = [
  /<\s*script\b[^>]*>/i,
  /javascript\s*:/i,
  /\bunion\s+select\b/i,
  /['"]\s*or\s*['"]\d+['"]\s*=\s*['"]\d+/i,
  /;\s*drop\s+table\b/i,
  /\beval\s*\(/i,
];

function sanitizeForLog(str: string): string {
  if (typeof str !== 'string') return '';
  return str.slice(0, 200).replace(/[\r\n\t]/g, ' ');
}

function emitAlert(alert: SecurityAlert): void {
  alertsHistory.push(alert);
  if (alertsHistory.length > 2000) {
    alertsHistory.shift();
  }
  for (const listener of alertListeners) {
    try {
      listener(alert);
    } catch {
      // Listener errors must not crash alerting
    }
  }
}

/**
 * Records a rate-limit violation and flags rapid bursts exceeding 5 in 1 minute.
 */
export function recordRateLimitViolation(
  identifier: string,
  tenantId?: string,
  now = Date.now()
): SecurityAlert | null {
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const existing = (rateLimitViolations.get(identifier) || []).filter((t) => t > windowStart);
  existing.push(now);
  rateLimitViolations.set(identifier, existing);

  // Requirement: rapid rate-limit violations (> 5 in 1 min)
  if (existing.length > RATE_LIMIT_ALERT_THRESHOLD) {
    const alert: SecurityAlert = {
      id: `alert_${crypto.randomUUID().slice(0, 12)}`,
      alertType: 'RAPID_RATE_LIMIT_VIOLATION',
      severity: 'HIGH',
      timestamp: now,
      isoTimestamp: new Date(now).toISOString(),
      identifier,
      tenantId,
      violationCount: existing.length,
      message: `Rapid rate-limit violations detected (${existing.length} violations in 1 minute, threshold > 5).`,
      details: {
        windowMs: RATE_LIMIT_WINDOW_MS,
        recentTimestamps: [...existing],
      },
      status: 'ACTIVE',
    };

    emitAlert(alert);
    return alert;
  }

  return null;
}

/**
 * Checks an input payload for prompt or code injection patterns.
 */
export function detectInjectionPattern(payload: string): { isInjection: boolean; type?: 'PROMPT_INJECTION' | 'CODE_SQL_INJECTION'; pattern?: string } {
  if (!payload || typeof payload !== 'string') {
    return { isInjection: false };
  }

  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(payload)) {
      return { isInjection: true, type: 'PROMPT_INJECTION', pattern: pattern.toString() };
    }
  }

  for (const pattern of CODE_SQL_INJECTION_PATTERNS) {
    if (pattern.test(payload)) {
      return { isInjection: true, type: 'CODE_SQL_INJECTION', pattern: pattern.toString() };
    }
  }

  return { isInjection: false };
}

/**
 * Records an injection attempt and flags repetitive injection behavior.
 */
export function recordInjectionAttempt(
  identifier: string,
  payload: string,
  tenantId?: string,
  now = Date.now()
): SecurityAlert | null {
  const detection = detectInjectionPattern(payload);
  if (!detection.isInjection) {
    return null;
  }

  const windowStart = now - INJECTION_WINDOW_MS;
  const history = (injectionHistory.get(identifier) || []).filter((item) => item.timestamp > windowStart);

  history.push({
    timestamp: now,
    payload: sanitizeForLog(payload),
    type: detection.type || 'UNKNOWN',
  });
  injectionHistory.set(identifier, history);

  const isRepetitive = history.length >= 2;
  const alertType: SecurityAlertType = isRepetitive
    ? 'REPETITIVE_INJECTION_ATTEMPT'
    : 'INJECTION_ATTEMPT';
  const severity: AlertSeverity = isRepetitive ? 'CRITICAL' : 'HIGH';

  const alert: SecurityAlert = {
    id: `alert_${crypto.randomUUID().slice(0, 12)}`,
    alertType,
    severity,
    timestamp: now,
    isoTimestamp: new Date(now).toISOString(),
    identifier,
    tenantId,
    violationCount: history.length,
    message: isRepetitive
      ? `Repetitive ${detection.type} attempts detected (${history.length} attempts within 5 minutes).`
      : `${detection.type} attempt detected.`,
    details: {
      matchedPattern: detection.pattern,
      attemptCount: history.length,
      sampleSnippet: sanitizeForLog(payload),
    },
    status: 'ACTIVE',
  };

  emitAlert(alert);
  return alert;
}

/**
 * Detects and alerts on unauthorized cross-tenant resource access probes.
 */
export function recordCrossTenantProbe(
  actorId: string,
  requestingTenantId: string,
  targetTenantId: string,
  resourceId?: string,
  now = Date.now()
): SecurityAlert {
  const isCrossTenant = requestingTenantId !== targetTenantId;

  const alert: SecurityAlert = {
    id: `alert_${crypto.randomUUID().slice(0, 12)}`,
    alertType: 'CROSS_TENANT_UNAUTHORIZED_PROBE',
    severity: 'CRITICAL',
    timestamp: now,
    isoTimestamp: new Date(now).toISOString(),
    identifier: actorId,
    tenantId: requestingTenantId,
    targetTenantId,
    resourceId,
    violationCount: 1,
    message: `Unauthorized cross-tenant probe: actor ${actorId} from tenant "${requestingTenantId}" attempted accessing tenant "${targetTenantId}" resource.`,
    details: {
      requestingTenantId,
      targetTenantId,
      resourceId: resourceId || 'unspecified',
    },
    status: 'ACTIVE',
  };

  emitAlert(alert);
  return alert;
}

/**
 * Subscribes to real-time security alerts.
 */
export function subscribeToAlerts(listener: AlertListener): () => void {
  alertListeners.add(listener);
  return () => {
    alertListeners.delete(listener);
  };
}

/**
 * Queries generated security alerts with optional filters.
 */
export function getAlerts(filter?: {
  tenantId?: string;
  alertType?: SecurityAlertType;
  severity?: AlertSeverity;
  status?: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
}): SecurityAlert[] {
  if (!filter) return [...alertsHistory];

  return alertsHistory.filter((alert) => {
    if (filter.tenantId && alert.tenantId !== filter.tenantId) return false;
    if (filter.alertType && alert.alertType !== filter.alertType) return false;
    if (filter.severity && alert.severity !== filter.severity) return false;
    if (filter.status && alert.status !== filter.status) return false;
    return true;
  });
}

/**
 * Clears all state and alerts (for testing).
 */
export function clearSecurityAlerts(): void {
  rateLimitViolations.clear();
  injectionHistory.clear();
  alertsHistory.length = 0;
  alertListeners.clear();
}
