import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  signOut, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword 
} from 'firebase/auth';
import { 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  memoryLocalCache
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Helper functions to safely probe storage capabilities inside sandboxed/restricted iframe environments
const isIframeOrRestricted = (): boolean => {
  try {
    if (typeof window === 'undefined') return true;
    // 1. Sandboxed / cross-origin iframe detection
    if (window.self !== window.top) return true;
    // 2. Sandboxed null/opaque origin check
    if (window.location && window.location.origin === 'null') return true;
    return false;
  } catch {
    // Accessing window.top or window.location threw a SecurityError -> restricted environment
    return true;
  }
};

/**
 * Synchronous check for Firestore initialization.
 * Prevents false positives in restricted/sandboxed iframes by verifying environment boundaries
 * and cached failure state before attempting persistent cache.
 */
const isIndexedDBSupported = (): boolean => {
  try {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return false;
    }
    if (isIframeOrRestricted()) {
      return false;
    }
    // Fast-fail if previous run detected broken IndexedDB in this environment
    try {
      if (window.localStorage && window.localStorage.getItem('__cognify_idb_failed__') === '1') {
        return false;
      }
    } catch {}

    const idb = window.indexedDB;
    if (typeof idb.open !== 'function') {
      return false;
    }
    const req = idb.open('__firebase_probe__');
    req.onsuccess = () => {
      try {
        req.result?.close();
        idb.deleteDatabase('__firebase_probe__');
      } catch {}
    };
    req.onerror = (e) => {
      try {
        e.preventDefault();
        e.stopPropagation?.();
        window.localStorage?.setItem('__cognify_idb_failed__', '1');
      } catch {}
    };
    req.onblocked = (e) => {
      try {
        e.preventDefault();
        window.localStorage?.setItem('__cognify_idb_failed__', '1');
      } catch {}
    };
    return true;
  } catch {
    try {
      window.localStorage?.setItem('__cognify_idb_failed__', '1');
    } catch {}
    return false;
  }
};

/**
 * Asynchronous probe for explicit IndexedDB verification (e.g. diagnostics / health checks)
 */
export const probeIndexedDBAsync = (): Promise<boolean> =>
  new Promise((resolve) => {
    try {
      if (typeof window === 'undefined' || !window.indexedDB || isIframeOrRestricted()) {
        return resolve(false);
      }
      try {
        if (window.localStorage && window.localStorage.getItem('__cognify_idb_failed__') === '1') {
          return resolve(false);
        }
      } catch {}
      const req = window.indexedDB.open('__firebase_probe__');
      req.onsuccess = () => {
        try {
          req.result.close();
          window.indexedDB.deleteDatabase('__firebase_probe__');
        } catch {}
        resolve(true);
      };
      req.onerror = (e) => {
        e.preventDefault();
        try { window.localStorage?.setItem('__cognify_idb_failed__', '1'); } catch {}
        resolve(false);
      };
    } catch {
      resolve(false);
    }
  });

const isLocalStorageSupported = (): boolean => {
  try {
    if (typeof window === 'undefined' || !window.localStorage || isIframeOrRestricted()) {
      return false;
    }
    window.localStorage.setItem('__firebase_probe__', '1');
    window.localStorage.removeItem('__firebase_probe__');
    return true;
  } catch {
    return false;
  }
};

// Standard and robust initialization of Firebase Auth
export const auth = getAuth(app);
export const storage = getStorage(app);

// Determine active Firestore database ID.
const getEnvDatabaseId = (): string | undefined => {
  if (typeof process !== 'undefined' && process.env?.VITE_FIREBASE_DATABASE_ID) {
    return process.env.VITE_FIREBASE_DATABASE_ID;
  }
  try {
    const meta = (new Function('return import.meta'))();
    return meta?.env?.VITE_FIREBASE_DATABASE_ID;
  } catch {
    return undefined;
  }
};
const configuredDatabaseId = getEnvDatabaseId() || (firebaseConfig as any).firestoreDatabaseId || 'ai-studio-c1720b7c-bffb-4282-b9a9-7c611643d7c2';
const targetDatabaseId = configuredDatabaseId && configuredDatabaseId !== '(default)'
  ? configuredDatabaseId
  : undefined;

const initDb = (settings: any) => {
  return targetDatabaseId
    ? initializeFirestore(app, settings, targetDatabaseId)
    : initializeFirestore(app, settings);
};

const getFallbackDb = () => {
  return targetDatabaseId
    ? getFirestore(app, targetDatabaseId)
    : getFirestore(app);
};

// Initialize Firestore safely with IndexedDB support checks
let safeDb;
try {
  if (isIndexedDBSupported() && isLocalStorageSupported()) {
    safeDb = initDb({
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      experimentalAutoDetectLongPolling: true,
    });
  } else {
    safeDb = initDb({
      localCache: memoryLocalCache(),
      experimentalAutoDetectLongPolling: true,
    });
  }
} catch (error) {
  console.warn("Firestore custom initialization failed, falling back to memory cache", error);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('__cognify_idb_failed__', '1');
    }
  } catch {}
  try {
    safeDb = initDb({
      localCache: memoryLocalCache(),
      experimentalAutoDetectLongPolling: true,
    });
  } catch {
    safeDb = getFallbackDb();
  }
}

export const db = safeDb;
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  // Developer log only (console). Avoid leaking PII (email/uid) into thrown errors/UI.
  console.error('Firestore Error:', {
    operationType,
    path,
    message: error instanceof Error ? error.message : String(error),
    uid: auth.currentUser?.uid,
  });
  // Throw a clean, user-safe error — no internal details, no PII.
  throw new Error('A data sync error occurred. Please try again.');
}

export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);
export const signInWithGoogleRedirect = () => signInWithRedirect(auth, googleProvider);
export const registerWithEmail = (email: string, pass: string) => createUserWithEmailAndPassword(auth, email, pass);
export const loginWithEmail = (email: string, pass: string) => signInWithEmailAndPassword(auth, email, pass);

// Session-scoped choices made on the login screen (account path / disability /
// org code). These MUST be cleared on logout — they are per-sign-in, not
// per-device. If they survive, the next person to sign in on this device
// inherits them: a brand-new account with no Firestore profile gets
// auto-provisioned using the PREVIOUS user's path (e.g. a Normal user silently
// created as a Special-Needs/Visual profile), and Onboarding pre-fills with
// someone else's answers.
// NOTE: must list EVERY key Login.tsx writes. The Graduation-Project trio was
// missing, so a previous user's university email / faculty / department survived
// a logout and got written into the next person's profile via Onboarding.
export const PRE_LOGIN_KEYS = [
  'preLoginAccountPath', 'preLoginDisability', 'preLoginAccessibilityMode', 'preLoginOrgCode',
  'preLoginUniEmail', 'preLoginFaculty', 'preLoginDepartment', 'preLoginLanguage',
];

// Per-USER accessibility data. Cleared on logout ONLY (not by
// clearPreLoginState, which runs on every profile load). These hold the previous
// user's spoken phrases, personal dictionaries and speech calibration — on a
// shared device the next person would otherwise inherit (and hear) them.
const PER_USER_LOCAL_KEYS = [
  'cognify_speech_history', 'cognify_speech_presets', 'cognify_euphonia_patterns',
  'cognify_pron_dict', 'cognify_speech_profile', 'cognify_pause_threshold',
  'cognify_speech_rate', 'cognify_speech_pitch', 'cognify_a11y_hidden',
];

export function clearPreLoginState() {
  try {
    PRE_LOGIN_KEYS.forEach((k) => localStorage.removeItem(k));
  } catch { /* storage unavailable (private mode) — nothing to clear */ }
}

export const logout = async () => {
  clearPreLoginState();
  try {
    PER_USER_LOCAL_KEYS.forEach((k) => localStorage.removeItem(k));
    sessionStorage.clear();
  } catch { /* storage unavailable */ }
  await signOut(auth);
};

export function cleanDataForFirestore(data: any): any {
  if (data === undefined) {
    return null;
  }
  if (data === null) {
    return null;
  }
  if (Array.isArray(data)) {
    return data.map(item => cleanDataForFirestore(item));
  }
  if (typeof data === 'object') {
    if (data instanceof Date) {
      return data.toISOString();
    }
    // Preserve Firestore FieldValue sentinels (serverTimestamp, arrayUnion, deleteField, etc.) and Timestamps
    if (
      (data.constructor && data.constructor.name !== 'Object' && data.constructor.name !== 'Array') ||
      '_methodName' in data ||
      typeof (data as any).toMillis === 'function'
    ) {
      return data;
    }
    const cleaned: any = {};
    for (const key of Object.keys(data)) {
      if (data[key] !== undefined) {
        cleaned[key] = cleanDataForFirestore(data[key]);
      }
    }
    return cleaned;
  }
  return data;
}
