/**
 * Phase C - Requirement 23: Privacy-Safe Production Logging Engine
 * Cognify 2.0 Production Observability & Tracing Engine
 *
 * Privacy-first logging utility that redacts sensitive PII before console
 * or persistent sink logging: emails, full student names, passwords/credentials,
 * bearer tokens/JWTs, credit cards, and base64 camera/video frames.
 */

export const REDACTION_LABELS = {
  EMAIL: '[REDACTED_EMAIL]',
  STUDENT_NAME: '[REDACTED_STUDENT_NAME]',
  PASSWORD: '[REDACTED_PASSWORD]',
  BEARER_TOKEN: '[REDACTED_BEARER_TOKEN]',
  CREDIT_CARD: '[REDACTED_CREDIT_CARD]',
  CAMERA_FRAME: '[REDACTED_CAMERA_FRAME]',
  API_KEY: '[REDACTED_API_KEY]',
} as const;

// Dynamic student name registry to redact known student identities across logs
const registeredStudentNames = new Set<string>();

export function registerStudentNames(names: string[]): void {
  for (const name of names) {
    if (name && typeof name === 'string' && name.trim().length > 1) {
      registeredStudentNames.add(name.trim());
    }
  }
}

export function clearRegisteredStudentNames(): void {
  registeredStudentNames.clear();
}

// Regex patterns for sensitive PII
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

// Credit card patterns: 16 digits (or 15 for Amex) with optional spaces or dashes
const CREDIT_CARD_REGEX = /\b(?:\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}|\d{4}[ -]?\d{6}[ -]?\d{5})\b/g;

// Bearer token patterns
const BEARER_TOKEN_REGEX = /Bearer\s+([A-Za-z0-9\-._~+/]+=*)/gi;

// Raw JWT pattern (eyJ...)
const JWT_REGEX = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;

// Base64 camera / image frames (data:image/... or standalone long base64 chunks)
const DATA_URI_IMAGE_REGEX = /data:image\/[a-zA-Z+.-]+;base64,[A-Za-z0-9+/=]{20,}/gi;

// Password / secret parameter patterns in text
const PASSWORD_PATTERN_REGEX = /(?:password|passwd|pwd|passphrase|secret)\s*[:=]\s*["']?([^"',\s}]+)["']?/gi;

// Labeled student name pattern e.g. "Student: Jane Doe", "Learner: John Smith"
const LABELED_STUDENT_REGEX = /\b(?:student(?:_name|name)?|learner|pupil)\s*[:=]\s*["']?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)["']?/gi;

/**
 * Redacts PII from plain string text.
 */
export function redactText(input: string): string {
  if (!input || typeof input !== 'string') return input;

  let redacted = input;

  // 1. Redact base64 camera frames first (prevents huge strings from breaking regexes)
  redacted = redacted.replace(DATA_URI_IMAGE_REGEX, REDACTION_LABELS.CAMERA_FRAME);

  // If a string looks like raw base64 frame data (> 200 continuous base64 chars)
  if (/^[A-Za-z0-9+/=]{200,}$/.test(redacted)) {
    return REDACTION_LABELS.CAMERA_FRAME;
  }

  // 2. Redact passwords and secrets
  redacted = redacted.replace(PASSWORD_PATTERN_REGEX, (match, val) => {
    return match.replace(val, REDACTION_LABELS.PASSWORD);
  });

  // 3. Redact Bearer tokens & JWTs
  redacted = redacted.replace(BEARER_TOKEN_REGEX, `Bearer ${REDACTION_LABELS.BEARER_TOKEN}`);
  redacted = redacted.replace(JWT_REGEX, REDACTION_LABELS.BEARER_TOKEN);

  // 4. Redact Credit Card Numbers
  redacted = redacted.replace(CREDIT_CARD_REGEX, REDACTION_LABELS.CREDIT_CARD);

  // 5. Redact Emails
  redacted = redacted.replace(EMAIL_REGEX, REDACTION_LABELS.EMAIL);

  // 6. Redact Registered Student Names
  for (const name of registeredStudentNames) {
    if (name.length > 0) {
      // Escaped global replacement
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const nameRegex = new RegExp(`\\b${escaped}\\b`, 'g');
      redacted = redacted.replace(nameRegex, REDACTION_LABELS.STUDENT_NAME);
    }
  }

  // 7. Redact Labeled Student Names (e.g. Student: Alex Johnson)
  redacted = redacted.replace(LABELED_STUDENT_REGEX, (match, nameVal) => {
    return match.replace(nameVal, REDACTION_LABELS.STUDENT_NAME);
  });

  return redacted;
}

const SENSITIVE_KEYS = new Set([
  'password',
  'passwd',
  'pwd',
  'passphrase',
  'secret',
  'apikey',
  'api_key',
  'authorization',
  'auth',
  'token',
  'bearertoken',
  'bearer_token',
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
  'idtoken',
  'id_token',
  'sessiontoken',
  'session_token',
  'jwt',
  'creditcard',
  'credit_card',
  'cardnumber',
  'card_number',
  'cvv',
  'cameraframe',
  'camera_frame',
  'framedata',
  'frame_data',
  'videodata',
  'image_base64',
  'base64image',
]);

const STUDENT_NAME_KEYS = new Set([
  'studentname',
  'student_name',
  'fullname',
  'full_name',
  'displayname',
  'display_name',
]);

/**
 * Deeply traverses an object or array and redacts all sensitive fields and values.
 */
export function redactObject<T>(obj: T, seen = new WeakSet()): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return redactText(obj) as unknown as T;
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Error) {
    const errorCopy = new Error(redactText(obj.message));
    errorCopy.stack = obj.stack ? redactText(obj.stack) : undefined;
    return errorCopy as unknown as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => redactObject(item, seen)) as unknown as T;
  }

  // Handle circular references safely
  if (seen.has(obj as object)) {
    return '[CIRCULAR]' as unknown as T;
  }
  seen.add(obj as object);

  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();

    // Check key for sensitive credentials
    if (SENSITIVE_KEYS.has(lowerKey)) {
      if (lowerKey.includes('camera') || lowerKey.includes('frame') || lowerKey.includes('image')) {
        result[key] = REDACTION_LABELS.CAMERA_FRAME;
      } else if (lowerKey.includes('card') || lowerKey.includes('cvv')) {
        result[key] = REDACTION_LABELS.CREDIT_CARD;
      } else if (lowerKey.includes('token') || lowerKey.includes('auth')) {
        result[key] = REDACTION_LABELS.BEARER_TOKEN;
      } else {
        result[key] = REDACTION_LABELS.PASSWORD;
      }
      continue;
    }

    // Check key for student names
    if (STUDENT_NAME_KEYS.has(lowerKey)) {
      if (typeof value === 'string') {
        result[key] = REDACTION_LABELS.STUDENT_NAME;
        continue;
      }
    }

    // Check key for emails
    if (lowerKey === 'email' || lowerKey === 'student_email' || lowerKey === 'user_email') {
      result[key] = REDACTION_LABELS.EMAIL;
      continue;
    }

    // Recursive traversal for nested values
    result[key] = redactObject(value, seen);
  }

  return result as T;
}

/**
 * Universal redact method handling strings, objects, arrays, and errors.
 */
export function redact(data: any): any {
  if (typeof data === 'string') {
    return redactText(data);
  }
  if (typeof data === 'object' && data !== null) {
    return redactObject(data);
  }
  return data;
}

export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  timestamp: string;
  message: string;
  meta?: any[];
}

// In-memory test sink for observing and asserting redacted log output
const capturedLogs: LogEntry[] = [];
let silent = true; // Default silent during tests to avoid console pollution
let captureEnabled = true;

export const privacyLogger = {
  debug(message: string, ...meta: any[]): void {
    const cleanMsg = redactText(message);
    const cleanMeta = meta.map((m) => redact(m));
    if (captureEnabled) {
      capturedLogs.push({ level: 'debug', timestamp: new Date().toISOString(), message: cleanMsg, meta: cleanMeta });
    }
    if (!silent) {
      console.debug(cleanMsg, ...cleanMeta);
    }
  },

  info(message: string, ...meta: any[]): void {
    const cleanMsg = redactText(message);
    const cleanMeta = meta.map((m) => redact(m));
    if (captureEnabled) {
      capturedLogs.push({ level: 'info', timestamp: new Date().toISOString(), message: cleanMsg, meta: cleanMeta });
    }
    if (!silent) {
      console.info(cleanMsg, ...cleanMeta);
    }
  },

  warn(message: string, ...meta: any[]): void {
    const cleanMsg = redactText(message);
    const cleanMeta = meta.map((m) => redact(m));
    if (captureEnabled) {
      capturedLogs.push({ level: 'warn', timestamp: new Date().toISOString(), message: cleanMsg, meta: cleanMeta });
    }
    if (!silent) {
      console.warn(cleanMsg, ...cleanMeta);
    }
  },

  error(message: string, ...meta: any[]): void {
    const cleanMsg = redactText(message);
    const cleanMeta = meta.map((m) => redact(m));
    if (captureEnabled) {
      capturedLogs.push({ level: 'error', timestamp: new Date().toISOString(), message: cleanMsg, meta: cleanMeta });
    }
    if (!silent) {
      console.error(cleanMsg, ...cleanMeta);
    }
  },

  getCapturedLogs(): LogEntry[] {
    return [...capturedLogs];
  },

  clearLogs(): void {
    capturedLogs.length = 0;
  },

  setSilent(isSilent: boolean): void {
    silent = isSilent;
  },

  setCaptureEnabled(enabled: boolean): void {
    captureEnabled = enabled;
  },
};
