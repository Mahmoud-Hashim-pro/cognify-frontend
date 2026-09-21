/**
 * Client-side helper for reading the visitor's country.
 * Calls /api/geo/country (backed by Vercel's edge geo headers, see api/geo/country.ts)
 * with robust fallbacks (direct edge IP lookup, browser timezone, and locale heuristics)
 * so that country is reliably detected and never stranded as "Unknown" or "N/A".
 */

import { getApiUrl } from '../config/api';

export interface VisitorGeo {
  countryCode: string; // ISO 3166-1 alpha-2, e.g. "EG" — or "Unknown"
  region: string | null;
  city: string | null;
  ip?: string | null;
}

const CACHE_KEY = 'cognify_visitor_geo';

// Common countries list for dashboard selection and display
export const COMMON_COUNTRIES = [
  { code: 'EG', name: 'Egypt' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'KW', name: 'Kuwait' },
  { code: 'QA', name: 'Qatar' },
  { code: 'BH', name: 'Bahrain' },
  { code: 'OM', name: 'Oman' },
  { code: 'JO', name: 'Jordan' },
  { code: 'LB', name: 'Lebanon' },
  { code: 'SY', name: 'Syria' },
  { code: 'IQ', name: 'Iraq' },
  { code: 'PS', name: 'Palestine' },
  { code: 'MA', name: 'Morocco' },
  { code: 'DZ', name: 'Algeria' },
  { code: 'TN', name: 'Tunisia' },
  { code: 'LY', name: 'Libya' },
  { code: 'SD', name: 'Sudan' },
  { code: 'YE', name: 'Yemen' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'FR', name: 'France' },
  { code: 'DE', name: 'Germany' },
  { code: 'CA', name: 'Canada' },
  { code: 'IT', name: 'Italy' },
  { code: 'ES', name: 'Spain' },
  { code: 'TR', name: 'Turkey' },
] as const;

// Timezone-to-Country heuristic mapping
const TIMEZONE_TO_COUNTRY: Record<string, string> = {
  'Africa/Cairo': 'EG',
  'Africa/Tripoli': 'LY',
  'Africa/Tunis': 'TN',
  'Africa/Algiers': 'DZ',
  'Africa/Casablanca': 'MA',
  'Africa/Khartoum': 'SD',
  'Asia/Riyadh': 'SA',
  'Asia/Dubai': 'AE',
  'Asia/Kuwait': 'KW',
  'Asia/Qatar': 'QA',
  'Asia/Bahrain': 'BH',
  'Asia/Muscat': 'OM',
  'Asia/Amman': 'JO',
  'Asia/Beirut': 'LB',
  'Asia/Damascus': 'SY',
  'Asia/Baghdad': 'IQ',
  'Asia/Jerusalem': 'PS',
  'Asia/Gaza': 'PS',
  'Asia/Hebron': 'PS',
  'Asia/Aden': 'YE',
  'Europe/London': 'GB',
  'Europe/Paris': 'FR',
  'Europe/Berlin': 'DE',
  'Europe/Rome': 'IT',
  'Europe/Madrid': 'ES',
  'America/New_York': 'US',
  'America/Chicago': 'US',
  'America/Denver': 'US',
  'America/Los_Angeles': 'US',
  'America/Toronto': 'CA',
  'America/Vancouver': 'CA',
};

function inferCountryFromEnvironment(): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && TIMEZONE_TO_COUNTRY[tz]) {
      return TIMEZONE_TO_COUNTRY[tz];
    }
  } catch {}

  try {
    if (typeof navigator !== 'undefined' && navigator.language) {
      const parts = navigator.language.split('-');
      if (parts.length === 2 && parts[1].length === 2) {
        return parts[1].toUpperCase();
      }
    }
  } catch {}

  return null;
}

export async function getVisitorGeo(): Promise<VisitorGeo> {
  // Check sessionStorage cache (never accept "Unknown" or invalid entries)
  if (typeof window !== 'undefined') {
    const cached = window.sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as VisitorGeo;
        if (parsed.countryCode && parsed.countryCode.length === 2 && parsed.countryCode !== 'Unknown') {
          return parsed;
        }
      } catch {
        // re-fetch on parse error
      }
    }
  }

  // 1. Primary: Server endpoint (backed by Vercel edge geo headers)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(getApiUrl('/api/geo/country'), { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const data = (await res.json()) as VisitorGeo;
      if (data.countryCode && data.countryCode.length === 2 && data.countryCode !== 'Unknown') {
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
        }
        return data;
      }
    }
  } catch {
    // Fall through to external public IP lookup
  }

  // 2. Direct edge IP geolocation fallback (fast, HTTPS, free, no API key)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const res = await fetch('https://api.country.is', { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      if (data?.country && typeof data.country === 'string' && data.country.length === 2) {
        const result: VisitorGeo = {
          countryCode: data.country.toUpperCase(),
          region: null,
          city: null,
          ip: data.ip || null,
        };
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(CACHE_KEY, JSON.stringify(result));
        }
        return result;
      }
    }
  } catch {
    // Fall through to timezone/locale fallback
  }

  // 3. Timezone & locale heuristic
  const inferred = inferCountryFromEnvironment();
  if (inferred) {
    const result: VisitorGeo = {
      countryCode: inferred,
      region: null,
      city: null,
    };
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(CACHE_KEY, JSON.stringify(result));
    }
    return result;
  }

  return { countryCode: 'Unknown', region: null, city: null };
}

/** Convenience: just the ISO country code, e.g. "EG". */
export async function getVisitorCountryCode(): Promise<string> {
  const geo = await getVisitorGeo();
  return geo.countryCode;
}

/**
 * Human-readable country formatter (e.g. "EG" -> "Egypt (EG)")
 */
export function formatCountryName(codeOrName?: string | null): string {
  if (!codeOrName || codeOrName === 'Unknown' || codeOrName === 'N/A') {
    return 'N/A';
  }
  const clean = codeOrName.trim();
  if (clean.length === 2) {
    try {
      const displayNames = new Intl.DisplayNames(['en'], { type: 'region' });
      const fullName = displayNames.of(clean.toUpperCase());
      if (fullName) {
        return `${fullName} (${clean.toUpperCase()})`;
      }
    } catch {
      // fallback to code
    }
    return clean.toUpperCase();
  }
  return clean;
}

/**
 * Detect client OS and browser cleanly (e.g. "Windows • Chrome" or "iOS • Safari")
 */
export function getDeviceSummary(): string {
  if (typeof navigator === 'undefined') return 'Unknown Device';
  const ua = navigator.userAgent;

  let os = 'Unknown OS';
  if (ua.includes('Win')) os = 'Windows';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';

  let browser = 'Browser';
  if (ua.includes('Firefox/')) browser = 'Firefox';
  else if (ua.includes('Edg/')) browser = 'Edge';
  else if (ua.includes('Chrome/')) browser = 'Chrome';
  else if (ua.includes('Safari/')) browser = 'Safari';

  return `${os} • ${browser}`;
}

