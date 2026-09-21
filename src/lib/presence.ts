import { UserProfile } from '../types';

export type PresenceStatus = 'online' | 'away' | 'offline';

export interface UserPresenceInfo {
  status: PresenceStatus;
  label: string;
  badgeCls: string;
  dotCls: string;
  minutesAgo: number;
}

/**
 * Determines the real-time presence of a user based on their most recent activity signals.
 * Heartbeats are sent by App.tsx every 2.5 minutes while the tab is active.
 * - Online: Activity within the last 5 minutes.
 * - Away: Activity within the last 20 minutes.
 * - Offline: Older than 20 minutes or never active.
 */
export function getUserPresenceStatus(u?: UserProfile | null): UserPresenceInfo {
  if (!u) {
    return {
      status: 'offline',
      label: 'Offline',
      badgeCls: 'bg-slate-800/80 text-slate-400 border border-slate-700/60',
      dotCls: 'bg-slate-500',
      minutesAgo: Infinity,
    };
  }

  const chatThreadTimes = Array.isArray(u.chatThreads)
    ? u.chatThreads.map((t) => t?.updatedAt)
    : [];

  const candidates = [u.lastActiveDate, u.lastQuizDate, ...chatThreadTimes]
    .filter(Boolean)
    .map((d) => new Date(d as string).getTime())
    .filter((t) => !isNaN(t));

  if (candidates.length === 0) {
    return {
      status: 'offline',
      label: 'Never Active',
      badgeCls: 'bg-slate-800/80 text-slate-500 border border-slate-700/60',
      dotCls: 'bg-slate-600',
      minutesAgo: Infinity,
    };
  }

  const newestTime = Math.max(...candidates);
  const now = Date.now();
  const diffMs = now - newestTime;
  const minutesAgo = Math.max(0, Math.floor(diffMs / 60000));

  // If timestamp is unreasonably far in the future (> 1 minute clock skew), treat as offline
  if (diffMs < -60000) {
    return {
      status: 'offline',
      label: 'Offline',
      badgeCls: 'bg-slate-800/80 text-slate-400 border border-slate-700/60',
      dotCls: 'bg-slate-500',
      minutesAgo: 0,
    };
  }

  // Online if active within last 5 minutes (heartbeat every 2.5 min)
  if (diffMs <= 5 * 60 * 1000) {
    return {
      status: 'online',
      label: 'Active Now',
      badgeCls: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/40 shadow-sm shadow-emerald-500/10',
      dotCls: 'bg-emerald-400 animate-pulse ring-2 ring-emerald-400/30',
      minutesAgo,
    };
  }

  // Away if active within last 20 minutes
  if (diffMs <= 20 * 60 * 1000) {
    return {
      status: 'away',
      label: `${minutesAgo}m ago`,
      badgeCls: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
      dotCls: 'bg-amber-400 ring-2 ring-amber-400/20',
      minutesAgo,
    };
  }

  // Offline
  const hoursAgo = Math.floor(diffMs / 3600000);
  const daysAgo = Math.floor(diffMs / 86400000);
  const label = daysAgo > 0 ? `${daysAgo}d ago` : `${hoursAgo}h ago`;

  return {
    status: 'offline',
    label,
    badgeCls: 'bg-slate-800/80 text-slate-400 border border-slate-700/60',
    dotCls: 'bg-slate-500',
    minutesAgo,
  };
}

export function isUserOnlineNow(u?: UserProfile | null): boolean {
  return getUserPresenceStatus(u).status === 'online';
}
