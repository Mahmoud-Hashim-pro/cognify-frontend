import { doc, setDoc, collection, getDocs, query, orderBy, limit, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import { getVisitorGeo, formatCountryName, getDeviceSummary } from './geo';
import { LoginHistoryRecord } from '../types';

/**
 * Enforces privacy data minimization (GDPR Article 5(1)(e)):
 * Retains a maximum of 50 login history records, and purges entries older than 90 days
 * (while guaranteeing at least the most recent 10 sessions are preserved for security auditing).
 */
export async function pruneOldLoginHistory(uid: string): Promise<void> {
  if (!uid) return;
  try {
    const q = query(
      collection(db, 'users', uid, 'loginHistory'),
      orderBy('timestamp', 'desc')
    );
    const snap = await getDocs(q);
    if (snap.empty || snap.docs.length <= 10) return;

    const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const docsToDelete = snap.docs.filter((docSnap, index) => {
      // Keep first 10 unconditionally for audit trail continuity
      if (index < 10) return false;
      // Cap at 50 records total
      if (index >= 50) return true;
      // Prune records older than 90 days
      const data = docSnap.data();
      const time = data.timestamp ? new Date(data.timestamp).getTime() : 0;
      return time > 0 && time < ninetyDaysAgo;
    });

    for (const d of docsToDelete) {
      await deleteDoc(d.ref).catch(() => {});
    }
  } catch (err) {
    console.warn('[LoginHistory] Failed to prune stale login records:', err);
  }
}

export async function recordUserLoginSession(uid: string): Promise<void> {
  if (!uid || typeof window === 'undefined') return;

  const sessionKey = `cognify_session_${uid}_recorded`;
  if (window.sessionStorage.getItem(sessionKey)) {
    return; // Already recorded in this browser session
  }

  try {
    const geo = await getVisitorGeo();
    const nowIso = new Date().toISOString();
    const device = getDeviceSummary();
    const sessionId = `sess_${Date.now()}`;

    const validCountry = geo.countryCode && geo.countryCode !== 'Unknown' ? geo.countryCode : undefined;

    const historyRecord: LoginHistoryRecord = {
      id: sessionId,
      timestamp: nowIso,
      country: validCountry || 'Unknown',
      countryName: formatCountryName(validCountry),
      region: geo.region || null,
      city: geo.city || null,
      ip: geo.ip || null,
      device,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    };

    // 1. Record into loginHistory subcollection
    const historyDocRef = doc(db, 'users', uid, 'loginHistory', sessionId);
    await setDoc(historyDocRef, historyRecord, { merge: true });

    // 2. Stamp primary profile with latest login telemetry
    const profileUpdate: Record<string, any> = {
      lastLoginAt: nowIso,
      lastLoginDevice: device,
    };
    if (validCountry) {
      profileUpdate.country = validCountry;
      profileUpdate.lastLoginCountry = validCountry;
    }
    if (geo.city) {
      profileUpdate.city = geo.city;
      profileUpdate.lastLoginCity = geo.city;
    }
    if (geo.region) {
      profileUpdate.region = geo.region;
    }
    if (geo.ip) {
      profileUpdate.lastIp = geo.ip;
    }

    await setDoc(doc(db, 'users', uid), profileUpdate, { merge: true });

    // Mark as recorded for this session tab
    window.sessionStorage.setItem(sessionKey, 'true');

    // Asynchronously prune stale login records beyond retention boundary
    pruneOldLoginHistory(uid).catch(() => {});
  } catch (err) {
    console.warn('[LoginHistory] Failed to record login session:', err);
  }
}

export async function fetchUserLoginHistory(uid: string): Promise<LoginHistoryRecord[]> {
  if (!uid) return [];
  try {
    const q = query(
      collection(db, 'users', uid, 'loginHistory'),
      orderBy('timestamp', 'desc'),
      limit(50)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as LoginHistoryRecord);
  } catch (err) {
    console.warn('[LoginHistory] Failed to fetch login history:', err);
    return [];
  }
}
