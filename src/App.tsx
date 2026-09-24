/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, lazy, Suspense } from "react";
import Sidebar from "./components/Sidebar";
import ErrorBoundary from "./components/ErrorBoundary";
import AccessibilityOverlay from "./components/AccessibilityOverlay";
import LiveCaptions from "./components/LiveCaptions";
import ReadAloudSelection from "./components/ReadAloudSelection";
import { motion, AnimatePresence } from "motion/react";
import { Message, UserProfile, AccessibilityMode, CognitiveLevel } from "./types";
import { auth, db, handleFirestoreError, OperationType, cleanDataForFirestore, clearPreLoginState, logout } from "./lib/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { doc, setDoc, onSnapshot, getDocFromServer, deleteField } from "firebase/firestore";
import { Loader2, Settings, Layers, Menu, Moon, Sun, AlertCircle, RefreshCw, Mail, ArrowLeft, Globe, Check, Key, Shield } from "lucide-react";
import { toast, ToastContainer } from "./components/Toast";
import PwaInstallPrompt from "./components/PwaInstallPrompt";

import { isRTL, isArabicLocale, getTranslation, localize } from "./lib/translations";
import { canAccessSection } from "./lib/academics";
import { canAccessView, homeViewFor, isAccessibilityUser, AppView } from "./lib/access";
import { isAdminUser } from "./lib/roles";
import { subscribeToStudentMemory, clearStudentMemory } from "./lib/memory";
import { StudentMemory, LanguagePreference } from "./types";
import { initSecurityTracker } from "./lib/securityTracker";
import { getVisitorCountryCode } from "./lib/geo";
import { recordUserLoginSession } from "./lib/loginHistory";
import { secureLoadKeySync, secureSaveKey, secureRemoveKey, autoMigrateStorageKeys } from "./lib/cryptoShield";

function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (err: any) {
      const lastReload = Number(sessionStorage.getItem('cognify_lazy_reload') || '0');
      const now = Date.now();
      if (now - lastReload > 12000) {
        sessionStorage.setItem('cognify_lazy_reload', String(now));
        if (typeof caches !== 'undefined') {
          try {
            const keys = await caches.keys();
            await Promise.all(keys.map((k) => caches.delete(k)));
          } catch {
            /* ignore */
          }
        }
        window.location.reload();
        return new Promise<{ default: T }>(() => {});
      }
      throw err;
    }
  });
}

// Heavy, route-specific views are code-split so they don't bloat the initial
// bundle. They load on demand the first time a user opens that screen, which
// keeps the app fast to start (important on mobile / slow connections).
const VisionCompanionView = lazyWithRetry(() => import("./components/VisionCompanionView"));
const MotorEuphoniaView = lazyWithRetry(() => import("./components/MotorEuphoniaView"));
const DisabilityModeView = lazyWithRetry(() => import("./components/DisabilityModeView"));
import type { DisabilityTab } from "./components/DisabilityModeView";
const Login = lazyWithRetry(() => import("./components/Login"));
const Onboarding = lazyWithRetry(() => import("./components/Onboarding"));
const ProfilePage = lazyWithRetry(() => import("./components/ProfilePage"));
const SignVideoStudio = lazyWithRetry(() => import("./components/SignVideoStudio"));
const AdminDashboard = lazyWithRetry(() => import("./components/AdminDashboard"));
const SupportCenter = lazyWithRetry(() => import("./components/SupportCenter"));
const GoalTracker = lazyWithRetry(() => import("./components/Goaltracker"));
const GpaCalculator = lazyWithRetry(() => import("./components/GpaCalculator"));
const StudentAnalytics = lazyWithRetry(() => import("./components/StudentAnalytics"));
const AcademicPlanner = lazyWithRetry(() => import("./components/AcademicPlanner"));
const LearningHub = lazyWithRetry(() => import("./components/learning/LearningHub"));
const StudentMemoryPage = lazyWithRetry(() => import("./components/StudentMemoryPage"));
const StudentPrivacyCenter = lazyWithRetry(() => import("./components/StudentPrivacyCenter"));
const InstitutionCohortHub = lazyWithRetry(() => import("./components/InstitutionCohortHub"));
const CognitiveGym = lazyWithRetry(() => import("./components/CognitiveGym"));
const IqAssessmentModal = lazyWithRetry(() => import("./components/IqAssessmentModal"));
const FrenchTravelVoiceAssistant = lazyWithRetry(() => import("./components/FrenchTravelVoiceAssistant"));
const ChatInterface = lazyWithRetry(() => import("./components/ChatInterface"));

/** Every hash route the app answers to — the single source of truth for both the
 *  initial read on mount and the popstate handler, so they can't drift apart. */
const VALID_VIEWS = [
  'chat', 'learning', 'profile', 'settings', 'video', 'disability',
  'admin', 'goals', 'gpa', 'analytics', 'planner', 'support', 'memory',
  'institution', 'gym', 'iq', 'france', 'privacy', 'intelligence',
] as const;

export default function App() {
  const [user, loading, authError] = useAuthState(auth);
  const chatRef = useRef<any>(null);
  
  // Seed from the URL hash so deep links and F5 land on the right screen.
  const [currentView, setCurrentView] = useState<AppView>(() => {
    const h = typeof window !== 'undefined' ? window.location.hash.replace('#', '') : '';
    if (!h || h === 'video' || h === 'disability') return 'chat';
    if (h === 'intelligence') return 'profile';
    return (VALID_VIEWS as readonly string[]).includes(h) ? (h as any) : 'chat';
  });
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  // True once a profile snapshot has actually been applied for the current user.
  // Guards the "ignore our own pending writes" rule so it can only skip AFTER we
  // have real data — otherwise the very first snapshot can be skipped and the
  // loading gate never releases ("SYNCING PROFILE…" forever).
  const profileAppliedRef = useRef(false);
  const initialRouteAppliedRef = useRef(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  // True when the profile sync failed or timed out (as opposed to "this user
  // genuinely has no profile yet"). Without this the app can't tell the two
  // apart and falls through to Onboarding — which auto-submits for Special
  // Needs and would overwrite a real profile. See the render guard below.
  const [profileSyncFailed, setProfileSyncFailed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [externalMessage, setExternalMessage] = useState("");
  const [currentAIResponse, setCurrentAIResponse] = useState("");
  const [isSTTActive, setIsSTTActive] = useState(false);
  const [disabilityTab, setDisabilityTab] = useState<DisabilityTab>('hub');
  const [isLiveCaptionsOpen, setIsLiveCaptionsOpen] = useState(false);
  const [isIqModalOpen, setIsIqModalOpen] = useState(false);

  // Cognify Memory (Phase 2) state
  const [memoryState, setMemoryState] = useState<StudentMemory | null>(null);
  const [memoryLoading, setMemoryLoading] = useState<boolean>(true);
  const [memoryError, setMemoryError] = useState<string | null>(null);
  const [memoryRetryCount, setMemoryRetryCount] = useState<number>(0);

  // DevTools & Element Inspect Security Tracker
  const profileRef = useRef(profile);
  profileRef.current = profile;

  useEffect(() => {
    autoMigrateStorageKeys();
    return initSecurityTracker(() => profileRef.current);
  }, []);

  // Subscribe to Cognify Memory snapshot from Firestore (Single Source of Truth)
  useEffect(() => {
    if (!user?.uid) {
      setMemoryState(null);
      setMemoryLoading(false);
      setMemoryError(null);
      return;
    }

    setMemoryLoading(true);
    setMemoryError(null);

    const unsubscribe = subscribeToStudentMemory(
      user.uid,
      (mem) => {
        setMemoryState(mem);
        setMemoryLoading(false);
        setMemoryError(null);
      },
      (err) => {
        console.error('Firestore memory subscription error:', err);
        setMemoryError('Failed to load Cognify Memory from Firestore.');
        setMemoryLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid, memoryRetryCount]);

  // Merge memory snapshot with user profile
  const fullProfile: UserProfile | null = profile
    ? { ...profile, memory: memoryState || undefined }
    : null;

  const direction = isRTL(profile?.language) ? 'rtl' : 'ltr';

  // Keep the document root's dir/lang in sync so screen readers pronounce correctly
  // and portalled/native UI (dialogs, popovers) inherits proper RTL/LTR and language semantics.
  useEffect(() => {
    document.documentElement.dir = direction;
    const langMap: Record<string, string> = {
      'French': 'fr',
      'Arabic': 'ar',
      'Egyptian Ammiya': 'ar',
      'Spanish': 'es',
      'German': 'de',
      'Italian': 'it',
      'Portuguese': 'pt',
      'Russian': 'ru',
      'Chinese': 'zh',
      'Japanese': 'ja',
      'English': 'en',
    };
    document.documentElement.lang = (profile?.language && langMap[profile.language]) || (direction === 'rtl' ? 'ar' : 'en');
  }, [direction, profile?.language]);

  // Theme management: Default to system, but respect manual override if present
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      const saved = localStorage.getItem('theme');
      if (saved) return saved === 'dark';
      return typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)').matches : true;
    } catch {
      return true;
    }
  });

  // Sync theme with machine/system changes
  useEffect(() => {
    const mediaQuery = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    
    // Function to apply theme based on system or manual selection
    const applyTheme = (e?: MediaQueryListEvent | MediaQueryList) => {
      let saved: string | null = null;
      try {
        saved = localStorage.getItem('theme');
      } catch {}

      // If user has a manual preference, prioritize it
      if (saved) {
        const shouldBeDark = saved === 'dark';
        setIsDarkMode(shouldBeDark);
        if (shouldBeDark) document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
        return;
      }

      // Otherwise follow the system
      const systemIsDark = e ? (e as MediaQueryList).matches : (mediaQuery ? mediaQuery.matches : true);
      setIsDarkMode(systemIsDark);
      if (systemIsDark) document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
    };

    // Initial check
    applyTheme(mediaQuery);

    // Listen for system preference changes
    const handler = (e: MediaQueryListEvent) => applyTheme(e);
    mediaQuery.addEventListener('change', handler);

    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Sync manual state change (when user clicks toggle)
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Handle manual theme toggle
  const toggleTheme = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    try {
      localStorage.setItem('theme', newMode ? 'dark' : 'light');
    } catch {}
  };

  // Sync navigation with browser history
  useEffect(() => {
    // If there's no hash on load, set it to the default #chat explicitly without a reload
    if (!window.location.hash) {
      window.history.replaceState(null, '', '#chat');
    }

    const handlePopState = () => {
      let hash = window.location.hash.replace('#', '');
      if (hash === 'intelligence') hash = 'profile';
      if ((VALID_VIEWS as readonly string[]).includes(hash)) {
        setCurrentView(hash as any);
      } else {
        setCurrentView('chat');
        window.history.replaceState(null, '', '#chat');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Custom navigation function that updates URL and state
 const navigateTo = (
  view: AppView
) => {
  window.history.pushState(null, '', `#${view}`);
  setCurrentView(view);
  setIsMobileMenuOpen(false);
};

  // Section access guard: nobody can open a section outside their enrolled path
  // (e.g. a Normal user opening #disability, or a Special-Needs user wandering
  // into the full academic experience). Admins bypass. Redirect + notify.
  useEffect(() => {
    if (!profile) return;
    if (!canAccessView(profile, currentView as any, isAdminUser(profile))) {
      // Redirect SILENTLY to the user's home section. No scary red toast — this
      // also fires on deep-links and on the user's own mode change, where an
      // error would be alarming and confusing. The redirect itself is feedback.
      const home = homeViewFor(profile);
      window.history.replaceState(null, '', `#${home}`);
      setCurrentView(home);
    }
  }, [profile, currentView]);

  // When the off-canvas menu opens, move focus into it and allow Escape to close.
  // Without this a keyboard/screen-reader user gets no signal that it opened and
  // has no way to dismiss it (the backdrop is a non-focusable div).
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    sidebarRef.current?.querySelector<HTMLElement>('button, a, [tabindex]:not([tabindex="-1"])')?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsMobileMenuOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isMobileMenuOpen]);

  // Sync profile from Firestore
  useEffect(() => {
    if (!user) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    // Re-show the loading gate on every logged-out -> authenticated transition.
    // Without this, a returning user briefly renders with profile=null and
    // profileLoading=false, flashing <Onboarding/> — which for a Special-Needs
    // account fires its onComplete and overwrites the existing profile (points/level).
    setProfileLoading(true);
    profileAppliedRef.current = false;
    initialRouteAppliedRef.current = false;
    setProfileSyncFailed(false);
    let cancelled = false; // set on cleanup; guards the async auto-create continuation

    // Watchdog: never let the app hang on "SYNCING PROFILE…". If Firestore is
    // unreachable (captive-portal / conference Wi-Fi / offline) onSnapshot can
    // fire NEITHER the success nor the error callback, leaving the gate stuck
    // forever. Release it after 10s so the user reaches a usable screen.
    const watchdog = setTimeout(() => {
      console.warn('[Cognify] Profile sync timed out — releasing the loading gate.');
      // Mark it as a FAILURE, not "no profile". Releasing the gate with
      // profile===null would otherwise render Onboarding, whose Special-Needs
      // branch auto-submits and would overwrite the real profile (points/level/
      // history) — the exact hazard on the flaky networks this watchdog exists for.
      setProfileSyncFailed(true);
      setProfileLoading(false);
    }, 10000);

    const path = `users/${user.uid}`;
    const unsubscribe = onSnapshot(doc(db, path), async (snapshot) => {
      // Ignore our own un-acknowledged local writes — applying them would replace
      // the whole profile mid-action and reset activeThreadId (the "new chat
      // refreshes / doesn't save" bug). The server-confirmed snapshot still applies.
      // BUT only skip once we already hold real data: skipping the FIRST snapshot
      // would return before setProfileLoading(false) below and hang the app on
      // "SYNCING PROFILE…" (reported in the field, "fixed" by localStorage.clear()
      // only because that wipes the auth session and forces a fresh login).
      if (snapshot.metadata.hasPendingWrites && profileAppliedRef.current) return;
      if (snapshot.exists()) {
        const rawData = snapshot.data() as UserProfile & { chatHistory?: any };

        // Purge legacy chatHistory from Firestore if it still exists on the doc.
        // chatHistory was migrated to users/{uid}/threads subcollection — any
        // residual top-level array wastes Firestore quota and leaks message data.
        if (rawData.chatHistory !== undefined) {
          delete rawData.chatHistory;
          setDoc(doc(db, path), { chatHistory: deleteField() }, { merge: true }).catch(() => {});
        }

        const data = rawData as UserProfile;

        // Honor user's login-time path selection
        let preLoginPath: string | null = null;
        let preLoginMode: string | null = null;
        let preLoginDis: string | null = null;
        try {
          preLoginPath = localStorage.getItem('preLoginAccountPath');
          preLoginMode = localStorage.getItem('preLoginAccessibilityMode');
          preLoginDis = localStorage.getItem('preLoginDisability');
        } catch {}

        if (preLoginPath === 'Normal') {
          data.accountPath = 'Normal';
          data.accessibilityMode = 'None';
          data.disabilityType = '';
          try {
            localStorage.removeItem('cognify_default_disability_tab');
            localStorage.removeItem('preLoginAccessibilityMode');
            localStorage.removeItem('preLoginDisability');
          } catch {}
          setDoc(doc(db, path), { accountPath: 'Normal', accessibilityMode: 'None', disabilityType: '' }, { merge: true }).catch(() => {});
        } else if (preLoginPath === 'Special Needs' && preLoginMode && preLoginMode !== 'None') {
          data.accountPath = 'Special Needs';
          data.accessibilityMode = preLoginMode as AccessibilityMode;
          if (preLoginDis) data.disabilityType = preLoginDis;
          try {
            const mappedTab = preLoginMode === 'Motor-Euphonia' ? 'motor' :
                              preLoginMode === 'Neurodiversity' ? 'neurodiversity' :
                              preLoginMode === 'Vocal-Deaf' ? 'deaf' : 'vision';
            localStorage.setItem('cognify_default_disability_tab', mappedTab);
          } catch {}
          setDoc(doc(db, path), cleanDataForFirestore({ 
            accountPath: 'Special Needs', 
            accessibilityMode: preLoginMode, 
            disabilityType: preLoginDis || data.disabilityType 
          }), { merge: true }).catch(() => {});
        }

        setProfile(data);
        clearPreLoginState();

        // Smart Entry Routing:
        // Execute ONLY ONCE on initial entry/mount so subsequent background snapshots
        // (like country lookup completing 2s later, or task progress writes)
        // NEVER override the user's active view or bounce them between screens!
        if (!initialRouteAppliedRef.current) {
          initialRouteAppliedRef.current = true;
          const hash = window.location.hash.replace('#', '');
          const isA11y = preLoginPath === 'Normal' ? false : isAccessibilityUser(data);
          if (isA11y) {
            // For accessibility users: if no hash or default empty/chat on first load, land on disability
            if (!hash || hash === 'chat' || hash === '') {
              setCurrentView('disability');
              window.history.replaceState(null, '', '#disability');
            } else if ((VALID_VIEWS as readonly string[]).includes(hash)) {
              setCurrentView(hash as any);
            }
          } else {
            // For normal users: if no hash, land on chat. If deep-linked or user navigated to another valid view, PRESERVE it!
            if (!hash || hash === 'disability' || hash === 'video') {
              setCurrentView('chat');
              window.history.replaceState(null, '', '#chat');
            } else if ((VALID_VIEWS as readonly string[]).includes(hash)) {
              setCurrentView(hash as any);
            }
          }
        }

        // Record login telemetry (session history, device, country, city)
        recordUserLoginSession(user.uid);
        
        // Update lastActiveDate and country:
        // Self-heal immediately if country is missing or Unknown, or if lastActiveDate is > 1 hr old
        const now = new Date().toISOString();
        const hasNoCountry = !data.country || data.country === 'Unknown' || data.country === 'N/A';
        const isStaleActive = !data.lastActiveDate || (new Date(now).getTime() - new Date(data.lastActiveDate).getTime() > 3600000);

        if (hasNoCountry || isStaleActive) {
           getVisitorCountryCode()
             .then((country) => {
               const updatePayload: Record<string, any> = {};
               if (isStaleActive) updatePayload.lastActiveDate = now;
               if (hasNoCountry && country && country !== 'Unknown') {
                 updatePayload.country = country;
               }
               if (Object.keys(updatePayload).length > 0) {
                 setDoc(doc(db, path), updatePayload, { merge: true });
               }
             })
             .catch((err) => {
               console.error("Failed to update last active date / country:", err);
             });
        }
      } else {
        // If the user selected 'Special Needs' at login but has no profile, auto-create it immediately to bypass onboarding!
        let preLoginPath: string | null = null;
        let preLoginDisability: string | null = null;
        let preLoginMode: string | null = null;
        let preLoginOrgCode: string | null = null;
        try {
          preLoginPath = localStorage.getItem('preLoginAccountPath');
          preLoginDisability = localStorage.getItem('preLoginDisability');
          preLoginMode = localStorage.getItem('preLoginAccessibilityMode');
          preLoginOrgCode = localStorage.getItem('preLoginOrgCode');
        } catch {}

        if (preLoginPath === 'Special Needs') {
          const disabilityType = preLoginDisability || 'Other';

          let accessibilityMode: AccessibilityMode = (preLoginMode as AccessibilityMode) || 'None';
          if (accessibilityMode === 'None') {
            if (disabilityType === 'Visual Impairment') {
              accessibilityMode = 'Visual';
            } else if (disabilityType === 'Hearing Impairment') {
              accessibilityMode = 'Vocal-Deaf';
            } else if (disabilityType === 'Speech Impairment') {
              accessibilityMode = 'Speech';
            } else if (disabilityType === 'Motor Impairment') {
              accessibilityMode = 'Motor-Euphonia';
            } else if (disabilityType === 'Cognitive/Learning Disability') {
              accessibilityMode = 'Neurodiversity';
            }
          }

          try {
            const mappedTab = accessibilityMode === 'Motor-Euphonia' ? 'motor' :
                              accessibilityMode === 'Neurodiversity' ? 'neurodiversity' :
                              accessibilityMode === 'Vocal-Deaf' ? 'deaf' : 'vision';
            localStorage.setItem('cognify_default_disability_tab', mappedTab);
          } catch {}

          let visitorCountry: string | undefined;
          try {
            const c = await getVisitorCountryCode();
            if (c && c !== 'Unknown') visitorCountry = c;
          } catch {}

          const defaultProfile: UserProfile = {
            uid: user.uid,
            email: user.email || "",
            name: user.displayName || user.email?.split('@')[0] || "User",
            points: 100,
            questionHistory: [],
            level: 'Basic',
            role: 'Student',
            educationLevel: 'University',
            field: 'General',
            accountPath: 'Special Needs',
            disabilityType: disabilityType,
            accessibilityMode: accessibilityMode,
            // Organization is no longer collected at sign-up (nobody should be
            // able to self-claim a charity's roster), so this resolves to '' —
            // an admin assigns it instead. The read is kept so re-introducing a
            // sign-up field would work without touching this again.
            organization: preLoginOrgCode || '',
            questionScore: 0,
            onboardingComplete: true,
            lastActiveDate: new Date().toISOString(),
            country: visitorCountry,
          };

          try {
            await setDoc(doc(db, path), defaultProfile);
            // The awaited write can settle long after this subscription was torn
            // down (it never resolves while offline). Without this guard the
            // continuation would apply THIS user's profile into whatever session
            // is current now — e.g. after a sign-out and sign-in as someone else.
            if (cancelled) return;
            setProfile(defaultProfile);
            clearPreLoginState(); // consumed — must not apply to a future account
            setCurrentView('disability');
            window.history.replaceState(null, '', '#disability');
          } catch (err) {
            console.error("Failed to auto-create special needs profile:", err);
            setProfile(null);
          }
        } else {
          // If the student already completed onboarding on this device (or cached in localStorage),
          // preserve the local profile state instead of clobbering to null and looping back to step 1!
          const cachedProfileJson = typeof window !== 'undefined' ? localStorage.getItem(`cognify_profile_${user.uid}`) : null;
          if (cachedProfileJson) {
            try {
              const cached = JSON.parse(cachedProfileJson);
              if (cached && cached.onboardingComplete) {
                setProfile(cached);
                setDoc(doc(db, path), cleanDataForFirestore(cached), { merge: true }).catch(() => {});
                return;
              }
            } catch {}
          }
          setProfile(null);
        }
      }
      // Reached on EVERY delivered snapshot (existing profile, auto-created
      // Special-Needs profile, or no-profile-yet) — so the gate always releases.
      if (cancelled) return;
      profileAppliedRef.current = true;
      clearTimeout(watchdog);
      setProfileLoading(false);
    }, (err) => {
      // Release the gate FIRST: handleFirestoreError throws by design, which
      // would otherwise skip these lines and strand the user on the spinner
      // (e.g. a permission-denied on a stale/mismatched session).
      clearTimeout(watchdog);
      setProfileSyncFailed(true); // sync FAILED — don't fall through to Onboarding
      setProfileLoading(false);
      handleFirestoreError(err, OperationType.LIST, path);
    });

    return () => {
      cancelled = true;
      clearTimeout(watchdog);
      unsubscribe();
    };
  }, [user]);

  // Active Presence Heartbeat: Keeps lastActiveDate fresh every 2.5 minutes while user is active
  useEffect(() => {
    if (!user?.uid) return;
    const path = `users/${user.uid}`;
    let lastPing = 0;

    const updatePresence = async () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      const nowMs = Date.now();
      // Throttle: don't ping more than once every 90 seconds
      if (nowMs - lastPing < 90000) return;
      lastPing = nowMs;
      const nowIso = new Date(nowMs).toISOString();
      const payload: Record<string, any> = { lastActiveDate: nowIso };

      if (!profile?.country || profile.country === 'Unknown' || profile.country === 'N/A') {
        try {
          const country = await getVisitorCountryCode();
          if (country && country !== 'Unknown') {
            payload.country = country;
          }
        } catch {}
      }

      setDoc(doc(db, path), payload, { merge: true }).catch(() => {});
    };

    // Immediate initial presence ping on sign-in
    updatePresence();

    // Heartbeat every 2.5 minutes
    const interval = setInterval(updatePresence, 150000);

    // Update on window focus / visibility change
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updatePresence();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onVisibilityChange);
    };
  }, [user?.uid, profile?.country]);

  const handleOnboardingComplete = async (data: Partial<UserProfile>) => {
    if (!user) return;
    const path = `users/${user.uid}`;
    
    let userCountry = data.country || profile?.country;
    if (!userCountry || userCountry === 'Unknown' || userCountry === 'N/A') {
      try {
        const c = await getVisitorCountryCode();
        if (c && c !== 'Unknown') userCountry = c;
      } catch {}
    }

    const newProfile: UserProfile = {
      points: 100,
      questionHistory: [],
      level: 'Intermediate',
      role: 'Student',
      educationLevel: 'University',
      field: 'General',
      accessibilityMode: 'None',
      questionScore: 0,
      name: user.displayName || user.email?.split('@')[0] || "User",
      country: userCountry && userCountry !== 'Unknown' ? userCountry : undefined,
      ...data,
      // Critical: Immutable identity and completion fields MUST come after ...data
      // so they can never be overwritten by empty/stale formData from onboarding steps!
      uid: user.uid,
      email: (user.email || data.email || "").trim(),
      onboardingComplete: true,
    };

    // Cache locally immediately to eliminate any race condition or snapshot reset loop
    try {
      localStorage.setItem(`cognify_profile_${user.uid}`, JSON.stringify(newProfile));
      localStorage.setItem(`cognify_onboarded_${user.uid}`, 'true');
    } catch {}

    const cleanedProfile = cleanDataForFirestore(newProfile);
    setProfile(cleanedProfile);

    const targetView: AppView = isAccessibilityUser(cleanedProfile) ? 'disability' : 'chat';
    setCurrentView(targetView);
    window.history.replaceState(null, '', `#${targetView}`);

    try {
      await setDoc(doc(db, path), cleanedProfile, { merge: true });
    } catch (err) {
      console.error("Failed to save onboarding profile to Firestore:", err);
      // Even if Firestore write fails, local state and localStorage keep the user in the app!
    }
  };

  const updateQuestionHistory = async (score: number, lastMessageSnippet?: string) => {
    if (!user || !profile) return;
    const path = `users/${user.uid}`;

    // Build from the LATEST profile state (functional update). Writing back the
    // whole (possibly stale) profile used to clobber `tasks` and thread titles
    // that other paths had just saved. We now persist ONLY the fields we change.
    setProfile((prev) => {
      if (!prev) return prev;
      let updatedThreads = prev.chatThreads || [];
      if (prev.activeThreadId && lastMessageSnippet) {
        updatedThreads = updatedThreads.map((t) =>
          t.id === prev.activeThreadId
            ? { ...t, lastMessageSnippet, updatedAt: new Date().toISOString() }
            : t,
        );
      }
      const nextPoints = prev.points + score * 5;
      // Cap history at 200 so the profile doc never grows unbounded (1 MiB cap).
      const nextHistory = [...(prev.questionHistory || []), { score, date: new Date().toISOString() }].slice(-200);
      const threadMeta = updatedThreads.map((t) => ({
        id: t.id, title: t.title, updatedAt: t.updatedAt, lastMessageSnippet: t.lastMessageSnippet,
      }));
      setDoc(
        doc(db, path),
        cleanDataForFirestore({ points: nextPoints, questionHistory: nextHistory, chatThreads: threadMeta }),
        { merge: true },
      ).catch((err) => handleFirestoreError(err, OperationType.UPDATE, path));
      return { ...prev, points: nextPoints, questionHistory: nextHistory, chatThreads: updatedThreads };
    });
  };

  const syncActiveThread = async (updatedHistory: Message[]) => {
    // This is now handled internally by ChatInterface for efficiency
    // But we keep the function signature for compatibility if needed elsewhere
    if (!user || !profile || !profile.activeThreadId) return;
    
    const threadPath = `users/${user.uid}/threads/${profile.activeThreadId}`;
    try {
      const cleanHistory = updatedHistory.map(m => {
        const item: any = {
          id: m.id,
          role: m.role,
          content: m.content || "",
          timestamp: m.timestamp
        };
        if (m.attachments !== undefined && m.attachments !== null) {
          item.attachments = m.attachments.map((a: any) => {
            const att: any = { name: a.name || "", type: a.type || "" };
            if (a.url) att.url = a.url;
            // Never persist large base64 — Firestore caps a doc at 1 MiB.
            if (a.data && !a.url && a.data.length <= 400000) att.data = a.data;
            return att;
          });
        }
        if (m.comparisons !== undefined && m.comparisons !== null) {
          item.comparisons = m.comparisons.map((c: any) => ({
            modelName: c.modelName || "",
            content: c.content || ""
          }));
        }
        return item;
      });
      await setDoc(doc(db, threadPath), { messages: cleanHistory }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, threadPath);
    }
  };

  const updateLanguage = async (language: UserProfile['language']) => {
    if (!user || !profile) return;
    const path = `users/${user.uid}`;
    try {
      await setDoc(doc(db, path), cleanDataForFirestore({ language }), { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  if (loading || profileLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
            <p className="text-slate-400 font-mono text-xs uppercase tracking-[0.3em] animate-pulse">
              {loading ? "Authenticating..." : "Syncing Profile..."}
            </p>
          </div>
        </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  // Sync failed/timed out (not "no profile yet"). NEVER fall through to
  // Onboarding here: its Special-Needs branch auto-submits on mount and would
  // overwrite a real profile's points/level/history with defaults. Offer a
  // retry (and a way out) instead — the data is safe on the server.
  if (profileSyncFailed && !profile) {
    // The profile never loaded, so we don't know the user's language — show both.
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <AlertCircle className="w-10 h-10 text-amber-400" />
          <p className="text-slate-300 text-sm leading-relaxed">
            Couldn't reach your profile. Check your connection and try again — your data is safe.
            <span className="block mt-2 text-slate-500" dir="rtl">تعذّر الوصول لملفك. راجع الاتصال وحاول تاني — بياناتك في أمان.</span>
          </p>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-5 py-3 bg-white text-slate-900 rounded-2xl text-xs font-black uppercase tracking-widest active:scale-95"
          >
            <RefreshCw className="w-4 h-4" /> Retry · إعادة المحاولة
          </button>
          <button onClick={() => logout()} className="text-[11px] text-slate-500 underline">
            Sign out · تسجيل الخروج
          </button>
        </div>
      </div>
    );
  }

  // If user exists but no profile, show Onboarding
  if (!profile || !profile.onboardingComplete) {
    return <Onboarding user={user} onComplete={handleOnboardingComplete} />;
  }

  const renderView = () => {
    const activeProfile = fullProfile || profile;
    if (!activeProfile) return null;
    // Guard academic sections that aren't available for this education level
    if (
      (['gpa', 'analytics', 'goals', 'planner'] as const).includes(currentView as any) &&
      !canAccessSection(activeProfile.educationLevel, currentView as any)
    ) {
      return (
        <ChatInterface
          ref={chatRef}
          profile={activeProfile}
          onQuestionEvaluated={updateQuestionHistory}
          syncMessages={syncActiveThread}
          onMenuClick={() => setIsMobileMenuOpen(true)}
          externalMessage={externalMessage}
          onStreamingUpdate={(text) => setCurrentAIResponse(text)}
          onSTTStateChange={setIsSTTActive}
          setProfile={setProfile}
        />
      );
    }
    switch (currentView) {
      case 'chat':
        return (
          <>
            <ChatInterface 
              ref={chatRef}
              profile={activeProfile}
              onQuestionEvaluated={updateQuestionHistory} 
              syncMessages={syncActiveThread} 
              onMenuClick={() => setIsMobileMenuOpen(true)} 
              externalMessage={externalMessage}
              onStreamingUpdate={(text) => setCurrentAIResponse(text)}
              onSTTStateChange={setIsSTTActive}
              setProfile={setProfile}
            />
          </>
        );
      case 'learning':
        return <LearningHub profile={activeProfile} onMenuClick={() => setIsMobileMenuOpen(true)} onNavigateBack={() => navigateTo(homeViewFor(profile))} />;
      case 'video':
        return <SignVideoStudio profile={activeProfile} onMenuClick={() => setIsMobileMenuOpen(true)} onNavigateBack={() => navigateTo(homeViewFor(profile))} />;
      case 'disability':
        return <DisabilityModeView
          ref={chatRef}
          profile={activeProfile}
          onMenuClick={() => setIsMobileMenuOpen(true)}
          onNavigate={navigateTo}
          onQuestionEvaluated={updateQuestionHistory}
          syncMessages={syncActiveThread}
          externalMessage={externalMessage}
          onStreamingUpdate={(text) => setCurrentAIResponse(text)}
          onSTTStateChange={setIsSTTActive}
          onTabChange={setDisabilityTab}
          setProfile={setProfile}
        />;
      case 'memory':
        return (
          <StudentMemoryPage
            profile={activeProfile}
            memory={memoryState}
            loading={memoryLoading}
            error={memoryError}
            onMenuClick={() => setIsMobileMenuOpen(true)}
            onNavigateBack={() => navigateTo(homeViewFor(profile))}
            onRetry={() => {
              if (user?.uid) {
                setMemoryLoading(true);
                setMemoryError(null);
                setMemoryRetryCount((c) => c + 1);
              }
            }}
          />
        );
      case 'privacy':
        return (
          <StudentPrivacyCenter
            profile={activeProfile}
            memory={memoryState}
            onClearMemory={async () => {
              if (profile?.uid) {
                await clearStudentMemory(profile.uid);
                setMemoryState(null);
              }
            }}
            onClose={() => navigateTo(homeViewFor(profile))}
          />
        );
      case 'profile':
      case 'intelligence':
        return (
          <ProfilePage
            profile={activeProfile}
            onMenuClick={() => setIsMobileMenuOpen(true)}
            onNavigateBack={() => navigateTo(homeViewFor(profile))}
            setProfile={setProfile}
          />
        );
      case 'admin':
        return <AdminDashboard profile={activeProfile} onMenuClick={() => setIsMobileMenuOpen(true)} onNavigateBack={() => navigateTo(homeViewFor(profile))} />;
      case 'support':
        return <SupportCenter profile={activeProfile} onMenuClick={() => setIsMobileMenuOpen(true)} onNavigateBack={() => navigateTo(homeViewFor(profile))} />;

      case 'goals':
        return (
          <GoalTracker
            profile={activeProfile}
            onMenuClick={() => setIsMobileMenuOpen(true)}
            onNavigateBack={() => navigateTo(homeViewFor(profile))}
          />
        );
      case 'gpa':
        return <GpaCalculator profile={activeProfile} onMenuClick={() => setIsMobileMenuOpen(true)} onNavigateBack={() => navigateTo(homeViewFor(profile))} />;
      case 'analytics':
        return <StudentAnalytics profile={activeProfile} onMenuClick={() => setIsMobileMenuOpen(true)} onNavigateBack={() => navigateTo(homeViewFor(profile))} />;
      case 'planner':
        return <AcademicPlanner profile={activeProfile} onMenuClick={() => setIsMobileMenuOpen(true)} onNavigateBack={() => navigateTo(homeViewFor(profile))} />;
      case 'institution':
        return <InstitutionCohortHub profile={activeProfile} onMenuClick={() => setIsMobileMenuOpen(true)} onNavigateBack={() => navigateTo(homeViewFor(profile))} />;

      case 'gym':
      case 'iq':
        return (
          <CognitiveGym
            profile={activeProfile}
            onMenuClick={() => setIsMobileMenuOpen(true)}
            onOpenIqModal={() => setIsIqModalOpen(true)}
            onNavigateBack={() => navigateTo(homeViewFor(profile))}
          />
        );

      case 'france':
        return (
          <FrenchTravelVoiceAssistant
            profile={activeProfile}
            onMenuClick={() => setIsMobileMenuOpen(true)}
            onNavigateBack={() => navigateTo(homeViewFor(profile))}
          />
        );

      case 'settings': {
        const ALL_SUPPORTED_LANGUAGES: { id: LanguagePreference; label: string; flag: string; nativeName: string }[] = [
          { id: 'French', label: 'French', flag: '🇫🇷', nativeName: 'Français' },
          { id: 'English', label: 'English', flag: '🇬🇧', nativeName: 'English' },
          { id: 'Arabic', label: 'Arabic', flag: '🇸🇦', nativeName: 'العربية' },
          { id: 'Egyptian Ammiya', label: 'Egyptian Ammiya', flag: '🇪🇬', nativeName: 'مصري' },
          { id: 'Spanish', label: 'Spanish', flag: '🇪🇸', nativeName: 'Español' },
          { id: 'German', label: 'German', flag: '🇩🇪', nativeName: 'Deutsch' },
          { id: 'Italian', label: 'Italian', flag: '🇮🇹', nativeName: 'Italiano' },
          { id: 'Portuguese', label: 'Portuguese', flag: '🇵🇹', nativeName: 'Português' },
          { id: 'Russian', label: 'Russian', flag: '🇷🇺', nativeName: 'Русский' },
          { id: 'Chinese', label: 'Chinese', flag: '🇨🇳', nativeName: '中文' },
          { id: 'Japanese', label: 'Japanese', flag: '🇯🇵', nativeName: '日本語' },
        ];

        const handleLanguageChange = async (newLang: LanguagePreference) => {
          if (!profile?.uid) return;
          const previousLang = profile.language;
          setProfile({ ...profile, language: newLang });
          const path = `users/${profile.uid}`;
          try {
            await setDoc(doc(db, path), cleanDataForFirestore({ language: newLang }), { merge: true });
            toast.success(
              localize(newLang, 'Language updated successfully', 'تم تحديث اللغة بنجاح'),
              localize(newLang, 'Language Selection', 'اختيار اللغة')
            );
          } catch (err) {
            console.error('Failed to update language in settings:', err);
            setProfile({ ...profile, language: previousLang });
            toast.error(
              localize(previousLang, 'Failed to update language. Please check your connection.', 'فشل تحديث اللغة. تحقق من اتصالك.'),
              localize(previousLang, 'Update Error', 'خطأ في التحديث')
            );
          }
        };

        return (
          <div className="flex-1 flex flex-col bg-[#0A0C14] text-slate-100 relative overflow-hidden font-sans custom-scrollbar">
            {/* Ambient Lighting Orbs */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
              <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[140px]" />
              <div className="absolute top-1/2 -right-40 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[140px]" />
              <div className="absolute -bottom-40 left-1/3 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[140px]" />
            </div>

            <header className="p-6 md:p-10 shrink-0 flex items-center gap-3">
              <button
                onClick={() => navigateTo(homeViewFor(profile))}
                className="p-2.5 text-slate-300 hover:text-white bg-[#121524] hover:bg-[#181C2E] shadow-md border border-slate-800/80 hover:border-slate-700 rounded-2xl active:scale-95 transition-all flex items-center gap-1.5 shrink-0"
                title={localize(profile.language, 'Back to Assistant', 'العودة للمساعد')}
              >
                <ArrowLeft className="w-5 h-5 rtl:rotate-180" />
                <span className="text-xs font-bold hidden sm:inline">{localize(profile.language, 'Back', 'رجوع')}</span>
              </button>
              <button 
                onClick={() => setIsMobileMenuOpen(true)}
                className="p-2.5 text-slate-300 hover:text-white bg-[#121524] hover:bg-[#181C2E] shadow-md border border-slate-800/80 hover:border-slate-700 rounded-2xl active:scale-95 shrink-0"
                aria-label="Toggle menu"
                title="Open Menu"
              >
                <Menu className="w-6 h-6" />
              </button>
            </header>
            <div className="flex-1 flex items-center justify-center p-4 sm:p-6 overflow-y-auto custom-scrollbar">
              <div className="bg-[#121524]/90 rounded-[32px] sm:rounded-[40px] border border-slate-800/80 backdrop-blur-xl shadow-2xl max-w-2xl w-full p-6 sm:p-8 md:p-12 space-y-8 my-auto">
                <div className="text-center space-y-2">
                  <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight">{getTranslation(profile.language, 'settings')}</h2>
                  <div className="h-1.5 w-20 bg-gradient-to-r from-cyan-500 to-blue-600 mx-auto rounded-full shadow-lg shadow-cyan-500/30" />
                </div>

                {/* Language Selection Card */}
                <div className="p-5 sm:p-6 bg-[#0A0C14]/80 rounded-3xl border border-slate-800/80 space-y-4">
                  <div className="flex items-center gap-2 text-cyan-400">
                    <Globe className="w-5 h-5" />
                    <h3 className="text-sm font-black uppercase tracking-widest">
                      {localize(profile.language, 'Language Selection', 'اختيار اللغة')}
                    </h3>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                    {localize(
                      profile.language,
                      'Choose your preferred system & AI communication language',
                      'اختر لغة واجهة النظام والتواصل والتوجيه مع المساعد الذكي'
                    )}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                    {ALL_SUPPORTED_LANGUAGES.map((lang) => {
                      const isSelected = profile.language === lang.id;
                      return (
                        <button
                          key={lang.id}
                          onClick={() => handleLanguageChange(lang.id)}
                          className={`p-3 rounded-2xl border flex items-center justify-between transition-all active:scale-95 text-start ${
                            isSelected
                              ? 'border-cyan-500/80 bg-cyan-500/15 shadow-md shadow-cyan-500/10 text-cyan-300 font-bold'
                              : 'border-slate-800 bg-[#121524] hover:border-slate-700 text-slate-300 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-lg shrink-0">{lang.flag}</span>
                            <div className="truncate">
                              <p className="text-xs font-bold leading-none">{lang.nativeName}</p>
                              <p className="text-[10px] text-slate-500 mt-0.5 truncate">{lang.label}</p>
                            </div>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-cyan-400 shrink-0 ml-1" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom API Key Card */}
                <div className="p-5 sm:p-6 bg-[#0A0C14]/80 rounded-3xl border border-slate-800/80 space-y-4">
                  <div className="flex items-center gap-2 text-cyan-400">
                    <Key className="w-5 h-5" />
                    <h3 className="text-sm font-black uppercase tracking-widest">
                      {localize(profile.language, 'AI Provider & Custom Key', 'مفتاح الذكاء الاصطناعي الخاص')}
                    </h3>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                    {localize(
                      profile.language,
                      'If hosting on static platforms (such as Vercel), you can paste your own Google Gemini or Groq API key here. It is stored securely on your local device and enables direct browser AI responses.',
                      'إذا كنت تتصفح عبر استضافة ساكنة (مثل Vercel)، يمكنك وضع مفتاح Google Gemini أو Groq الخاص بك هنا. يُحفظ المفتاح بأمان محلياً على جهازك لتشغيل الذكاء الاصطناعي مباشرة.'
                    )}
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="password"
                      defaultValue={secureLoadKeySync('gemini')}
                      id="cognify-custom-gemini-key-input"
                      placeholder="AIzaSy... (Gemini API Key)"
                      className="flex-1 px-4 py-3 bg-[#121524] border border-slate-800 rounded-2xl text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/10"
                    />
                    <button
                      onClick={async () => {
                        const input = document.getElementById('cognify-custom-gemini-key-input') as HTMLInputElement | null;
                        if (input) {
                          const val = input.value.trim();
                          try {
                            if (val) {
                              await secureSaveKey('gemini', val);
                              toast.success(
                                localize(profile.language, 'Gemini API Key encrypted & saved locally!', 'تم تشفير وحفظ مفتاح Gemini API بنجاح!'),
                                localize(profile.language, 'Key Encrypted & Saved', 'تم التشفير والحفظ')
                              );
                            } else {
                              secureRemoveKey('gemini');
                              toast.info(
                                localize(profile.language, 'Custom key removed. Using server default.', 'تم حذف المفتاح الخاص والعودة لافتراضي السيرفر.'),
                                localize(profile.language, 'Key Removed', 'تم الحذف')
                              );
                            }
                          } catch {
                            toast.error(
                              localize(profile.language, 'Could not save key (storage restricted).', 'تعذر حفظ المفتاح (التخزين المحلي معطل).'),
                              localize(profile.language, 'Error', 'خطأ')
                            );
                          }
                        }
                      }}
                      className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black rounded-2xl text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/20 active:scale-95 transition-all shrink-0"
                    >
                      {localize(profile.language, 'Save Key', 'حفظ المفتاح')}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="p-6 bg-[#0A0C14]/80 rounded-3xl border border-slate-800/80 space-y-3">
                     <div className="flex items-center gap-2 text-cyan-400">
                       <Settings className="w-5 h-5" />
                       <h3 className="text-sm font-black uppercase tracking-widest">{localize(profile.language, 'Core Parameters', 'المعايير الأساسية')}</h3>
                     </div>
                     <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                       {localize(
                         profile.language,
                         'Fundamental configuration (IQ, Level, Role). These are recalibrated automatically based on your performance and institutional metadata.',
                         'التكوين الأساسي (المستوى المعرفي، الدرجة، التخصص). تتم معايرتها تلقائياً وفق أدائك.'
                       )}
                     </p>
                   </div>

                   <div className="p-6 bg-[#0A0C14]/80 rounded-3xl border border-slate-800/80 space-y-4">
                     <div className="flex items-center gap-2 text-cyan-400">
                       {isDarkMode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                       <h3 className="text-sm font-black uppercase tracking-widest">{localize(profile.language, 'Interface Theme', 'مظهر الواجهة')}</h3>
                     </div>
                     <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                       {localize(
                         profile.language,
                         'Switch between light and dark visual themes to reduce eye strain in low-light environments.',
                         'التبديل بين الوضع الليلي والنهاري لتقليل إجهاد العين في الإضاءة الخافتة.'
                       )}
                     </p>
                     <button
                       onClick={toggleTheme}
                       className={`w-full py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${
                         isDarkMode 
                           ? 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/25' 
                           : 'bg-slate-800 border border-slate-700 text-slate-300 hover:text-white'
                       }`}
                     >
                       {isDarkMode 
                         ? localize(profile.language, '🌙 Dark Mode Active', '🌙 الوضع الليلي مفعل') 
                         : localize(profile.language, '☀️ Light Mode Active', '☀️ الوضع النهاري مفعل')}
                     </button>
                   </div>

                   {/* Privacy & Data Sovereignty Card */}
                   <div className="p-6 bg-[#0A0C14]/80 rounded-3xl border border-slate-800/80 space-y-4 md:col-span-2">
                     <div className="flex items-center gap-2 text-rose-400">
                       <Shield className="w-5 h-5" />
                       <h3 className="text-sm font-black uppercase tracking-widest">{localize(profile.language, 'Privacy & Data Sovereignty (GDPR / FERPA)', 'الخصوصية وسيادة البيانات')}</h3>
                     </div>
                     <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                       {localize(
                         profile.language,
                         'Export your complete machine-readable learning archive, inspect provenance of stored facts, reset adaptive AI preferences, or permanently delete your account and all cloud data.',
                         'تصدير أرشيفك التعليمي الشامل، فحص مصادر الحقائق المحفوظة، إعادة ضبط تفضيلات الذكاء الاصطناعي، أو حذف حسابك وكافة بياناتك السحابية نهائياً.'
                       )}
                     </p>
                     <button
                       onClick={() => navigateTo('privacy')}
                       className="py-3 px-5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all bg-rose-500/15 border border-rose-500/30 text-rose-300 hover:bg-rose-500/25 flex items-center justify-center gap-2 shadow-lg shadow-rose-500/10 active:scale-95"
                     >
                       <Shield className="w-4 h-4" />
                       <span>{localize(profile.language, 'Manage Privacy, Export & Erasure', 'إدارة الخصوصية والتصدير والحذف')}</span>
                     </button>
                   </div>
                </div>

                <button 
                  onClick={() => navigateTo(homeViewFor(profile))}
                  className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg shadow-cyan-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  {isAccessibilityUser(profile)
                    ? (isRTL(profile.language) ? 'العودة لمركز إمكانية الوصول' : localize(profile.language, 'Return to Accessibility Hub', 'العودة لمركز إمكانية الوصول'))
                    : getTranslation(profile.language, 'returnToChat')}
                </button>
              </div>
            </div>
          </div>
        );
      }
      default:
        return (
          <>
            <ChatInterface 
              ref={chatRef}
              profile={activeProfile} 
              onQuestionEvaluated={updateQuestionHistory} 
              syncMessages={syncActiveThread} 
              onMenuClick={() => setIsMobileMenuOpen(true)}
              onStreamingUpdate={setCurrentAIResponse}
              externalMessage={externalMessage}
              onSTTStateChange={setIsSTTActive}
              setProfile={setProfile}
            />
          </>
        );
    }
  };

  return (
    <ErrorBoundary>

      <div
        className={`flex w-full h-[100dvh] bg-bg-main font-sans overflow-hidden selection:bg-primary/30 transition-all duration-500 ${
          profile?.accessibilityMode === 'Visual' ? 'text-lg contrast-125' : ''
        }`}
        dir={direction}
      >
        <ToastContainer rtl={direction === 'rtl'} />
        <PwaInstallPrompt language={profile?.language} />
        <ReadAloudSelection language={profile?.language} />

        {/* Mobile menu backdrop */}
        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar — an off-canvas drawer at EVERY width, opened by the hamburger.
            It is mounted on every view (including 'disability'): it is the only
            <Sidebar> in the app and the only route to account/settings/Sign Out,
            and the access guard bounces accessibility users back from every other
            view, so skipping it here would trap them.
            `invisible` while closed removes it from the tab order and the
            accessibility tree — a pure transform leaves it focusable, so
            keyboard/screen-reader users would hit a phantom menu (and could
            trigger Sign Out blind) before reaching the visible page. */}
        <div
            ref={sidebarRef}
            role="dialog"
            aria-modal="true"
            aria-label={localize(profile?.language, 'Main menu', 'القائمة الرئيسية')}
            className={`fixed inset-y-0 start-0 z-50 transform ${isMobileMenuOpen ? 'translate-x-0' : (direction === 'rtl' ? 'translate-x-full invisible' : '-translate-x-full invisible')} transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] shadow-2xl`}>
            <Sidebar 
              profile={fullProfile || profile}
              setProfile={async (p) => {
                // Update local state instantly so UI is highly reactive
                setProfile(p);
                
                if (!user) return;
                const path = `users/${user.uid}`;
                try {
                  const cleanProfile = JSON.parse(JSON.stringify(p));
                  
                  // Ensure activeThreadId is explicitly preserved as null if not present/undefined, so Firestore overwrites it and doesn't get merged out
                  cleanProfile.activeThreadId = p.activeThreadId !== undefined ? p.activeThreadId : null;
                  
                  // Prune large arrays to stay under 1MB
                  if (cleanProfile.chatThreads) {
                    cleanProfile.chatThreads = cleanProfile.chatThreads.map((t: any) => ({
                      id: t.id || "",
                      title: t.title || "New Chat",
                      updatedAt: t.updatedAt || new Date().toISOString(),
                      lastMessageSnippet: t.lastMessageSnippet || ""
                    }));
                  }
                  delete cleanProfile.chatHistory;

                  const finalProfileToSave = cleanDataForFirestore(cleanProfile);
                  await setDoc(doc(db, path), finalProfileToSave, { merge: true });
                } catch (err) {
                  handleFirestoreError(err, OperationType.UPDATE, path);
                }
              }} 
              currentView={currentView}
              setCurrentView={navigateTo}
              isDarkMode={isDarkMode}
              toggleTheme={toggleTheme}
              openLiveCaptions={() => setIsLiveCaptionsOpen(true)}
            />
        </div>


        <main className="flex-1 relative overflow-hidden flex flex-col md:flex-row">
          <Suspense
            fallback={
              <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-slate-950">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
            }
          >
            {renderView()}
          </Suspense>
        </main>

        {/* The floating accessibility overlay (sign avatar / mic / vision) is ONLY for
            users who actually need it — a real accessibility mode or the Special Needs
            path. Sighted staff who can also open the disability hub (admins, org/charity
            managers viewing their OrgDashboard) must NOT get a camera/mic overlay, so we
            gate on isAccessibilityUser rather than on the current view. */}
        {profile && isAccessibilityUser(profile)
          // Hide completely while inside the dedicated Disability Hub or Sign Studio —
          // all disability tools operate within their dedicated full-screen views
          // without needing the floating accessibility eye button overlay.
          && currentView !== 'disability'
          && currentView !== 'video' && (
          <AccessibilityOverlay
            mode={!profile.accessibilityMode || profile.accessibilityMode === 'None' ? 'Vocal-Deaf' : profile.accessibilityMode}
            profile={profile}
            aiResponse={currentAIResponse}
            isListening={isSTTActive}
            onTranscription={(text) => {
              setExternalMessage(text);
              // Reset so it doesn't keep triggering if ChatInterface clears it
              setTimeout(() => setExternalMessage(""), 500);
            }} 
            onToggleListening={() => {
              if (chatRef.current) {
                chatRef.current.toggleSTT();
              }
            }}
          />
        )}

        <AnimatePresence>
          {isLiveCaptionsOpen && (
            <LiveCaptions
              language={isArabicLocale(profile?.language) ? 'ar-EG' : 'en-US'}
              onClose={() => setIsLiveCaptionsOpen(false)} 
            />
          )}
        </AnimatePresence>

        <Suspense fallback={null}>
          {isIqModalOpen && (fullProfile || profile) && (
            <IqAssessmentModal
              isOpen={isIqModalOpen}
              onClose={() => setIsIqModalOpen(false)}
              profile={fullProfile || profile}
              onIqUpdated={(newScore, domainScores) => {
                if (profile) {
                  setProfile({
                    ...profile,
                    iqScore: newScore,
                    cognitiveDomains: domainScores,
                    lastIqTestDate: new Date().toISOString(),
                    // Decoupled: Academic level and pedagogical stage are governed by
                    // StudentStateManager concept mastery, not static IQ scores.
                  });
                }
              }}
            />
          )}
        </Suspense>
      </div>
    </ErrorBoundary>
  );
}
