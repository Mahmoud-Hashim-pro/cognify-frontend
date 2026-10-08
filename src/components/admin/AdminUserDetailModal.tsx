import { useState, useEffect } from "react";
import { UserProfile, CognitiveLevel, LoginHistoryRecord } from "../../types";
import {
  User as UserIcon, Eye, Copy, X, Globe, MessageSquare, ListTodo, FileJson,
  Crown, Key, UserMinus, Mail, Cpu, Check, Clock, Loader2
} from "lucide-react";
import { getUserPresenceStatus } from "../../lib/presence";
import { formatCountryName, COMMON_COUNTRIES } from "../../lib/geo";
import { fetchUserLoginHistory } from "../../lib/loginHistory";
import { sectionOf } from "../../lib/access";
import { isSuperAdminUser } from "../../lib/roles";

function newestActiveIso(u?: UserProfile | null): string | undefined {
  if (!u) return undefined;
  const candidates = [u.lastActiveDate, u.lastQuizDate, ...(u.chatThreads || []).map((t) => t?.updatedAt)]
    .filter(Boolean) as string[];
  if (candidates.length === 0) return undefined;
  return candidates.reduce((a, b) => (new Date(b).getTime() > new Date(a).getTime() ? b : a));
}

const formatDate = (isoString?: string) => {
  if (!isoString) return "Never";
  const d = new Date(isoString);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export interface AdminUserDetailModalProps {
  user: UserProfile;
  callerProfile: UserProfile;
  onClose: () => void;
  onOpenPhotoLightbox: (url: string, user: UserProfile) => void;
  onOpenPasswordReset: (user: UserProfile) => void;
  canManageAdmins: boolean;
  canManageSuperAdmin: (caller: UserProfile, target: UserProfile) => boolean;
  busyUid: string | null;
  onToggleSuperAdmin: (u: UserProfile, makeSuper: boolean) => Promise<void>;
  onUpdatePoints: (u: UserProfile, delta: number) => Promise<void>;
  onUpdateCognitiveLevel: (u: UserProfile, level: CognitiveLevel) => Promise<void>;
  onUpdateCountry: (u: UserProfile, country: string) => Promise<void>;
  copyToClipboard: (text: string, label?: string) => Promise<void>;
}

export default function AdminUserDetailModal({
  user,
  callerProfile,
  onClose,
  onOpenPhotoLightbox,
  onOpenPasswordReset,
  canManageAdmins,
  canManageSuperAdmin,
  busyUid,
  onToggleSuperAdmin,
  onUpdatePoints,
  onUpdateCognitiveLevel,
  onUpdateCountry,
  copyToClipboard,
}: AdminUserDetailModalProps) {
  const [modalTab, setModalTab] = useState<'profile' | 'chats' | 'tasks' | 'logins' | 'raw'>('profile');
  const [userLoginHistory, setUserLoginHistory] = useState<LoginHistoryRecord[]>([]);
  const [loadingLogins, setLoadingLogins] = useState(false);

  useEffect(() => {
    if (!user.uid) {
      setUserLoginHistory([]);
      return;
    }
    let active = true;
    setLoadingLogins(true);
    fetchUserLoginHistory(user.uid)
      .then((history) => {
        if (active) {
          setUserLoginHistory(history);
          setLoadingLogins(false);
        }
      })
      .catch(() => {
        if (active) setLoadingLogins(false);
      });
    return () => {
      active = false;
    };
  }, [user.uid]);

  const modalPresence = getUserPresenceStatus(user);
  const isSuperAdmin = isSuperAdminUser(callerProfile);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#150917] border border-[#4A1224]/60 rounded-[32px] shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Modal Header */}
        <div className="p-6 border-b border-[#4A1224]/60 flex items-center justify-between bg-[#080409]/60">
          <div className="flex items-center gap-3.5 min-w-0">
            {/* User Avatar with Zoom Lightbox Trigger */}
            <div
              className="relative group cursor-pointer shrink-0"
              onClick={() => {
                if (user.photoURL) {
                  onOpenPhotoLightbox(user.photoURL, user);
                }
              }}
              title={user.photoURL ? "Click to view full-size profile photo" : undefined}
            >
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.name || 'User Avatar'}
                  className="w-14 h-14 rounded-2xl object-cover border-2 border-[#E5A93C]/40 shadow-lg group-hover:scale-105 transition-transform bg-slate-800"
                />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-[#4A1224]/60 text-[#E5A93C] font-black text-xl flex items-center justify-center border border-[#E5A93C]/40">
                  {(user.name || user.email || '?').charAt(0).toUpperCase()}
                </div>
              )}
              {user.photoURL && (
                <div className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                  <Eye className="w-5 h-5" />
                </div>
              )}
              <span
                className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-slate-900 ${modalPresence.dotCls}`}
                title={`Live Status: ${modalPresence.label}`}
              />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-black text-white truncate">
                {user.name || user.email?.split('@')[0] || 'User Profile'}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-medium text-slate-400 truncate">{user.email}</span>
                <button
                  onClick={() => copyToClipboard(user.uid, `Firebase UID copied: ${user.uid}`)}
                  className="inline-flex items-center gap-1 font-mono text-[10px] text-slate-400 hover:text-[#E5A93C] bg-slate-800/80 px-2 py-0.5 rounded transition-colors"
                  title="Copy Firebase UID"
                >
                  <span>UID: {user.uid.slice(0, 12)}…</span>
                  <Copy className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="flex border-b border-[#4A1224]/60 bg-[#0E0610]/95 px-6 gap-2">
          {[
            { id: 'profile', label: 'Overview & Details', icon: UserIcon },
            { id: 'logins', label: userLoginHistory.length > 0 ? `Logins (${userLoginHistory.length})` : 'Login History', icon: Globe },
            { id: 'chats', label: `Chats (${user.chatThreads?.length || 0})`, icon: MessageSquare },
            { id: 'tasks', label: `Tasks (${user.tasks?.length || 0})`, icon: ListTodo },
            { id: 'raw', label: 'Raw JSON', icon: FileJson },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setModalTab(id as any)}
              className={`flex items-center gap-1.5 py-3.5 px-3.5 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${
                modalTab === id ? 'border-[#E5A93C] text-[#E5A93C]' : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 custom-scrollbar">
          {modalTab === 'profile' && (
            <div className="space-y-6">
              {/* Live Presence Banner */}
              <div className={`p-4 rounded-2xl border flex items-center justify-between ${modalPresence.badgeCls}`}>
                <div className="flex items-center gap-3">
                  <span className="relative flex h-3 w-3">
                    {modalPresence.status === 'online' && (
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    )}
                    <span className={`relative inline-flex rounded-full h-3 w-3 ${modalPresence.dotCls}`} />
                  </span>
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider block">
                      Real-Time Presence: {modalPresence.label}
                    </span>
                    <span className="text-[11px] text-slate-300 font-normal">
                      {modalPresence.status === 'online'
                        ? 'User is actively on Cognify right now.'
                        : modalPresence.status === 'away'
                        ? `Last recorded interaction was ~${modalPresence.minutesAgo} minutes ago.`
                        : 'User is currently offline.'}
                    </span>
                  </div>
                </div>
                {user.photoURL && (
                  <button
                    onClick={() => onOpenPhotoLightbox(user.photoURL!, user)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0E0610]/90 hover:bg-slate-800 text-[#E5A93C] border border-[#E5A93C]/30 rounded-xl text-xs font-bold transition-all shrink-0"
                  >
                    <Eye className="w-3.5 h-3.5" /> View Photo
                  </button>
                )}
              </div>

              {/* Key Stats Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-[#080409] p-4 rounded-2xl border border-[#4A1224]/60">
                  <div className="text-xs font-bold text-slate-400 uppercase">Points</div>
                  <div className="text-xl font-black text-[#E5A93C] mt-1 font-mono">{user.points || 0}</div>
                </div>
                <div className="bg-[#080409] p-4 rounded-2xl border border-[#4A1224]/60">
                  <div className="text-xs font-bold text-slate-400 uppercase">Cognitive Score</div>
                  <div className="text-xl font-black text-white mt-1 font-mono">{user.iqScore || '--'}</div>
                </div>
                <div className="bg-[#080409] p-4 rounded-2xl border border-[#4A1224]/60">
                  <div className="text-xs font-bold text-slate-400 uppercase">Cognitive Level</div>
                  <div className="text-sm font-black text-white mt-1.5 uppercase">{user.level || 'Intermediate'}</div>
                </div>
                <div className="bg-[#080409] p-4 rounded-2xl border border-[#4A1224]/60">
                  <div className="text-xs font-bold text-slate-400 uppercase">Section</div>
                  <div className="text-sm font-black text-white mt-1.5">{sectionOf(user)}</div>
                </div>
              </div>

              {/* Academic & Bio Info */}
              <div className="bg-[#080409] p-5 rounded-2xl border border-[#4A1224]/60 space-y-3.5 text-xs font-medium">
                <h4 className="font-black uppercase tracking-wider text-slate-400 text-[11px]">Academic &amp; System Info</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div><span className="text-slate-400">University:</span> <span className="font-bold text-white">{user.university || 'N/A'}</span></div>
                  <div><span className="text-slate-400">Faculty:</span> <span className="font-bold text-white">{user.faculty || 'N/A'}</span></div>
                  <div><span className="text-slate-400">Department:</span> <span className="font-bold text-white">{user.department || 'N/A'}</span></div>
                  <div><span className="text-slate-400">Role:</span> <span className="font-bold text-white">{user.role || 'Student'}</span></div>
                  <div>
                    <span className="text-slate-400">System Role:</span>{' '}
                    {isSuperAdminUser(user) ? (
                      <span className="inline-flex items-center gap-1 font-bold text-amber-400">
                        <Crown className="w-3.5 h-3.5" /> Super Admin User
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-bold text-slate-300">
                        <UserIcon className="w-3.5 h-3.5 text-slate-400" /> Normal User
                      </span>
                    )}
                  </div>
                  <div><span className="text-slate-400">Language:</span> <span className="font-bold text-white">{user.language || 'English'}</span></div>
                  <div>
                    <span className="text-slate-400">Country:</span>{' '}
                    <span className="font-bold text-emerald-400">
                      {formatCountryName(user.country)}
                    </span>
                  </div>
                  {user.city && (
                    <div>
                      <span className="text-slate-400">City:</span>{' '}
                      <span className="font-bold text-white">{user.city}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-slate-400">Last Active:</span>{' '}
                    <span className="font-bold text-white">{formatDate(newestActiveIso(user))}</span>
                  </div>
                  {user.lastLoginDevice && (
                    <div>
                      <span className="text-slate-400">Device:</span>{' '}
                      <span className="font-bold text-slate-300">{user.lastLoginDevice}</span>
                    </div>
                  )}
                  {user.lastIp && (
                    <div>
                      <span className="text-slate-400">Last IP:</span>{' '}
                      <span className="font-mono text-[#E5A93C] font-bold text-[11px] bg-[#150917] px-2 py-0.5 rounded border border-[#4A1224]/60">
                        {user.lastIp}
                      </span>
                    </div>
                  )}
                  {user.passwordResetRequestedAt && (
                    <div>
                      <span className="text-slate-400">Last Pass Reset:</span>{' '}
                      <span className="font-bold text-amber-300 font-mono text-[11px]">
                        {formatDate(user.passwordResetRequestedAt)}
                      </span>
                    </div>
                  )}
                  {user.disabilityType && (
                    <div><span className="text-slate-400">Disability:</span> <span className="font-bold text-rose-400">{user.disabilityType}</span></div>
                  )}
                  {user.accessibilityMode && user.accessibilityMode !== 'None' && (
                    <div><span className="text-slate-400">Active Mode:</span> <span className="font-bold text-amber-400">{user.accessibilityMode}</span></div>
                  )}
                  {user.organization && (
                    <div><span className="text-slate-400">Organization:</span> <span className="font-bold text-[#E5A93C]">{user.organization}</span></div>
                  )}
                </div>
              </div>

              {/* Admin Actions */}
              <div className="bg-[#080409] p-5 rounded-2xl border border-[#4A1224]/60 space-y-3">
                <h4 className="font-black uppercase tracking-wider text-slate-400 text-[11px]">Admin Adjustments</h4>
                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Role Promotion / Demotion */}
                  {canManageSuperAdmin(callerProfile, user) && (
                    isSuperAdminUser(user) ? (
                      <button
                        onClick={() => onToggleSuperAdmin(user, false)}
                        disabled={busyUid === user.uid}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
                      >
                        <UserMinus className="w-3.5 h-3.5" /> Demote to Normal User
                      </button>
                    ) : (
                      <button
                        onClick={() => onToggleSuperAdmin(user, true)}
                        disabled={busyUid === user.uid}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
                      >
                        <Crown className="w-3.5 h-3.5" /> Promote to Super Admin User
                      </button>
                    )
                  )}

                  {/* Super Admin Password Reset */}
                  {isSuperAdmin && (
                    <button
                      onClick={() => onOpenPasswordReset(user)}
                      disabled={busyUid === user.uid}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
                    >
                      <Key className="w-3.5 h-3.5" /> Change / Reset Password
                    </button>
                  )}

                  {canManageAdmins && (
                    <>
                      <button
                        onClick={() => onUpdatePoints(user, 50)}
                        disabled={busyUid === user.uid}
                        className="px-3.5 py-1.5 bg-gradient-to-r from-amber-400 via-[#E5A93C] to-rose-600 text-slate-950 text-xs font-bold rounded-xl hover:bg-[#E5A93C] transition-colors disabled:opacity-50"
                      >
                        +50 Points
                      </button>
                      <button
                        onClick={() => onUpdatePoints(user, -50)}
                        disabled={busyUid === user.uid}
                        className="px-3.5 py-1.5 bg-[#150917] border border-[#4A1224]/50 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50"
                      >
                        -50 Points
                      </button>
                      <select
                        value={user.level || 'Intermediate'}
                        onChange={(e) => onUpdateCognitiveLevel(user, e.target.value as CognitiveLevel)}
                        disabled={busyUid === user.uid}
                        className="bg-[#150917] border border-[#4A1224]/50 text-white text-xs font-bold rounded-xl px-3 py-1.5 outline-none cursor-pointer"
                      >
                        <option value="Basic">Level: Basic</option>
                        <option value="Intermediate">Level: Intermediate</option>
                        <option value="Advanced">Level: Advanced</option>
                      </select>
                    </>
                  )}
                  <select
                    value={user.country && user.country !== 'Unknown' && user.country !== 'N/A' ? user.country : ''}
                    onChange={(e) => onUpdateCountry(user, e.target.value)}
                    disabled={busyUid === user.uid}
                    className="bg-[#150917] border border-[#4A1224]/50 text-white text-xs font-bold rounded-xl px-3 py-1.5 outline-none cursor-pointer"
                    title="Set or update user's country"
                  >
                    <option value="" disabled>Set Country...</option>
                    {COMMON_COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                  <a
                    href={`mailto:${user.email}?subject=Message from Cognify Admin`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 text-white text-xs font-bold rounded-xl hover:bg-slate-700 transition-colors border border-[#4A1224]/50"
                  >
                    <Mail className="w-3.5 h-3.5" /> Send Email
                  </a>
                </div>
              </div>
            </div>
          )}

          {modalTab === 'logins' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-black uppercase tracking-wider text-slate-400 text-[11px]">
                    Login &amp; Geolocation History
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Historical login sessions, detected countries, and device footprints.
                  </p>
                </div>
                {loadingLogins && (
                  <div className="flex items-center gap-2 text-xs text-[#E5A93C]">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Fetching logs…</span>
                  </div>
                )}
              </div>

              {userLoginHistory.length > 0 ? (
                <div className="space-y-2.5">
                  {userLoginHistory.map((record, index) => {
                    const isLatest = index === 0;
                    return (
                      <div
                        key={record.id || index}
                        className={`p-4 rounded-2xl border transition-all ${
                          isLatest
                            ? 'bg-emerald-950/20 border-emerald-500/30'
                            : 'bg-[#080409] border-[#4A1224]/60'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-white text-sm">
                              {formatCountryName(record.country)}
                            </span>
                            {record.city && (
                              <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded-md text-[11px]">
                                {record.city}{record.region ? `, ${record.region}` : ''}
                              </span>
                            )}
                            {isLatest && (
                              <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-md text-[10px] font-bold uppercase tracking-wider">
                                Latest Session
                              </span>
                            )}
                          </div>
                          <span className="font-mono text-[11px] text-slate-400">
                            {formatDate(record.timestamp)}
                          </span>
                        </div>

                        <div className="mt-2.5 pt-2.5 border-t border-slate-900 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                          <span className="flex items-center gap-1.5">
                            <Cpu className="w-3 h-3 text-slate-500" />
                            {record.device || 'Standard Web Client'}
                          </span>
                          {record.ip && (
                            <span className="font-mono text-slate-500 text-[10px]">
                              IP: {record.ip}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 bg-[#080409] border border-[#4A1224]/60 rounded-2xl space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-[#4A1224]/30 text-[#E5A93C] border border-[#E5A93C]/20">
                      <Globe className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-white font-bold text-xs">Primary Recorded Location</div>
                      <div className="text-[11px] text-slate-400">
                        Captured from user profile telemetry (available even when offline).
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-2 text-xs border-t border-slate-900">
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase">Last Known Country</span>
                      <span className="font-bold text-emerald-400">
                        {formatCountryName(user.country)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase">Last Active Timestamp</span>
                      <span className="font-mono text-slate-300 text-[11px]">
                        {formatDate(newestActiveIso(user))}
                      </span>
                    </div>
                    {user.city && (
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase">Last Known City</span>
                        <span className="font-bold text-white">{user.city}</span>
                      </div>
                    )}
                    {user.lastLoginDevice && (
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase">Last Device</span>
                        <span className="text-slate-300">{user.lastLoginDevice}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {modalTab === 'chats' && (
            <div className="space-y-3">
              <h4 className="font-black uppercase tracking-wider text-slate-400 text-[11px]">Saved Chat Sessions</h4>
              {user.chatThreads && user.chatThreads.length > 0 ? (
                <div className="space-y-2">
                  {user.chatThreads.map((thread) => (
                    <div key={thread.id} className="p-4 bg-[#080409] border border-[#4A1224]/60 rounded-2xl space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-white">{thread.title || 'Untitled Chat'}</span>
                        <span className="text-[10px] text-slate-400">{formatDate(thread.updatedAt)}</span>
                      </div>
                      {thread.lastMessageSnippet && (
                        <p className="text-xs text-slate-400 line-clamp-2">{thread.lastMessageSnippet}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500 text-xs">No saved chat sessions for this user.</div>
              )}
            </div>
          )}

          {modalTab === 'tasks' && (
            <div className="space-y-3">
              <h4 className="font-black uppercase tracking-wider text-slate-400 text-[11px]">Tasks &amp; Objectives</h4>
              {user.tasks && user.tasks.length > 0 ? (
                <div className="space-y-2">
                  {user.tasks.map((task) => (
                    <div key={task.id} className="flex items-center gap-3 p-3.5 bg-[#080409] border border-[#4A1224]/60 rounded-2xl text-xs">
                      <div className={`p-1.5 rounded-lg ${task.completed ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>
                        {task.completed ? <Check className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                      </div>
                      <div className="flex-1 font-medium text-white">{task.content}</div>
                      <span className={`text-[10px] font-black uppercase ${task.completed ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {task.completed ? 'Completed' : 'Pending'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500 text-xs">No tasks recorded for this user.</div>
              )}
            </div>
          )}

          {modalTab === 'raw' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-black uppercase tracking-wider text-slate-400 text-[11px]">Firestore Document JSON</h4>
                <button
                  onClick={() => copyToClipboard(JSON.stringify(user, null, 2), 'JSON copied to clipboard')}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white rounded-lg transition-colors border border-[#4A1224]/50"
                >
                  <Copy className="w-3 h-3" /> Copy JSON
                </button>
              </div>
              <pre className="p-4 bg-[#080409] text-emerald-400 font-mono text-xs rounded-2xl overflow-x-auto border border-[#4A1224]/60 max-h-96 custom-scrollbar">
                {JSON.stringify(user, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
