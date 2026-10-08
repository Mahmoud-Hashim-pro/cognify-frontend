import { UserProfile } from "../../types";
import { Key, X, Crown, User as UserIcon, Lock, Loader2 } from "lucide-react";
import { isSuperAdminUser } from "../../lib/roles";

const formatDate = (isoString?: string) => {
  if (!isoString) return "Never";
  const d = new Date(isoString);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export interface AdminPasswordResetModalProps {
  user: UserProfile;
  isSending: boolean;
  onClose: () => void;
  onSendReset: (user: UserProfile) => Promise<void>;
}

export default function AdminPasswordResetModal({
  user,
  isSending,
  onClose,
  onSendReset,
}: AdminPasswordResetModalProps) {
  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#150917] border border-amber-500/40 rounded-[28px] shadow-2xl shadow-amber-500/10 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="p-6 border-b border-[#4A1224]/60 flex items-center justify-between bg-[#080409]/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded-2xl shadow-inner">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white uppercase tracking-tight">Change / Reset Password</h3>
              <p className="text-xs text-slate-400">Super Admin Authentication Management</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSending}
            className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-full transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Target user card */}
          <div className="p-4 bg-[#080409]/80 border border-[#4A1224]/60 rounded-2xl flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-rose-600/20 text-amber-300 font-black text-lg flex items-center justify-center border border-amber-500/30 shrink-0 shadow-inner">
              {(user.name || user.email || '?').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-bold text-white text-sm truncate">{user.name || 'Unnamed User'}</div>
              <div className="text-xs text-slate-400 truncate">{user.email}</div>
              <div className="flex items-center gap-2 mt-1">
                {isSuperAdminUser(user) ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    <Crown className="w-2.5 h-2.5" /> Super Admin User
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-slate-300 bg-slate-800 px-2 py-0.5 rounded border border-[#4A1224]/50">
                    <UserIcon className="w-2.5 h-2.5" /> Normal User
                  </span>
                )}
                <span className="text-[10px] font-mono text-slate-500">UID: {user.uid.slice(0, 8)}…</span>
              </div>
            </div>
          </div>

          {/* Informative notice */}
          <div className="p-4 bg-[#080409]/50 border border-amber-500/20 rounded-2xl space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
              <Lock className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Official Firebase Password Reset Protocol</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Triggering this action sends an official, secure Firebase password reset email to{' '}
              <span className="text-white font-bold">{user.email}</span>.
              The user can click the verified link to securely update their password.
            </p>
            {user.passwordResetRequestedAt && (
              <p className="text-[11px] text-slate-400 font-mono pt-1.5 border-t border-[#4A1224]/60">
                Last reset requested: {formatDate(user.passwordResetRequestedAt)}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={onClose}
              disabled={isSending}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={() => onSendReset(user)}
              disabled={isSending}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 active:scale-95"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Sending Reset Link...
                </>
              ) : (
                <>
                  <Key className="w-4 h-4" /> Send Password Reset Email
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
