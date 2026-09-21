import { doc, setDoc, collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from './firebase';
import { getVisitorGeo, formatCountryName, getDeviceSummary } from './geo';
import { LoginHistoryRecord } from '../types';

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
