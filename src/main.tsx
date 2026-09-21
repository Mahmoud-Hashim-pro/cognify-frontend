import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import {toast} from './components/Toast';
import SplashScreen from './components/SplashScreen';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import './index.css';

// Real error tracking — lazy-loaded so it never bloats the initial bundle, and
// only active if VITE_SENTRY_DSN is configured. The DSN is a public client key.
const SENTRY_DSN = (import.meta as any).env?.VITE_SENTRY_DSN as string | undefined;
if (SENTRY_DSN) {
  import('@sentry/react')
    .then((Sentry) => {
      Sentry.init({
        dsn: SENTRY_DSN,
        environment: (import.meta as any).env?.MODE || 'production',
        tracesSampleRate: 0.1,
        sendDefaultPii: false, // don't attach user PII to events
      });
    })
    .catch(() => { /* tracking optional */ });
}

// ── Global safety net ───────────────────────────────────────────────────────
// Catches any uncaught async error (failed fetches, rejected promises) that an
// individual try/catch might miss, and shows ONE friendly toast instead of
// letting a raw/technical error surface or fail silently.
let lastErrorToast = 0;
function notifyGenericError() {
  const now = Date.now();
  if (now - lastErrorToast < 5000) return; // throttle to avoid spam
  lastErrorToast = now;
  try {
    toast.error('Something went wrong. Please try again.', 'Error');
  } catch {
    /* ignore */
  }
}

const BENIGN = /AbortError|aborted|ResizeObserver|Load failed|NetworkError when attempting|cancell?ed|startTime|reportAllChanges|vercel\.live|Cross-Origin-Opener-Policy|window\.closed|optout|Blocked a frame/i;

// Auto-recover from dynamic chunk import failures / stale deployments
window.addEventListener('vite:preloadError', (event) => {
  console.warn('Vite chunk preload error detected, purging cache and reloading...', event);
  event.preventDefault();
  const lastReload = Number(sessionStorage.getItem('cognify_chunk_reload') || '0');
  const now = Date.now();
  if (now - lastReload > 10000) {
    sessionStorage.setItem('cognify_chunk_reload', String(now));
    if (typeof caches !== 'undefined') {
      caches.keys().then((names) => Promise.all(names.map((n) => caches.delete(n)))).catch(() => {}).finally(() => {
        window.location.reload();
      });
    } else {
      window.location.reload();
    }
  }
});

window.addEventListener('unhandledrejection', (e) => {
  const reason: any = e?.reason;
  const msg = String(reason?.message ?? reason ?? '');
  if (BENIGN.test(msg)) return; // ignore benign/expected rejections
  console.error('Unhandled promise rejection:', reason);
  notifyGenericError();
});

window.addEventListener('error', (e) => {
  const msg = String(e?.message ?? '');
  // React render errors are handled by ErrorBoundary; just hush benign noise.
  if (BENIGN.test(msg)) e.preventDefault?.();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
    <SplashScreen />
    <Analytics />
    <SpeedInsights />
  </StrictMode>,
);
