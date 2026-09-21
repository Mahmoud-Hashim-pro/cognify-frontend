import React, { useState, useMemo } from 'react';
import {
  Building2,
  Users,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Plus,
  Trash2,
  Coins,
  Crown,
  CreditCard,
  Sparkles
} from 'lucide-react';
import type {
  SubscriptionTier,
  TenantAccount,
  TenantMember,
  TenantMemberRole
} from '../types/businessTenancy';
import {
  TIER_ENTITLEMENT_MATRIX,
  createTenantAccount,
  checkFeatureEntitlement,
  assignSeat,
  revokeSeat,
  recordTokenConsumption
} from '../lib/businessTenancyEngine';

interface BusinessTenancyViewProps {
  isArabic?: boolean;
}

export const BusinessTenancyView: React.FC<BusinessTenancyViewProps> = ({
  isArabic = false
}) => {
  // Active Tenant in State
  const [tenant, setTenant] = useState<TenantAccount>(() => {
    const t = createTenantAccount('tenant_cairo_univ', 'Cairo University Faculty of Engineering', 'educator_classroom');
    t.activeSeats = 12;
    t.tokensConsumed = 3450000;
    return t;
  });

  // Members in State
  const [members, setMembers] = useState<TenantMember[]>([
    { memberUid: 'u_dr_tarek', tenantId: 'tenant_cairo_univ', email: 'tarek@eng.cu.edu.eg', role: 'owner', assignedAt: Date.now() - 1000000, status: 'active' },
    { memberUid: 'u_eng_sara', tenantId: 'tenant_cairo_univ', email: 'sara.ta@eng.cu.edu.eg', role: 'educator', assignedAt: Date.now() - 800000, status: 'active' },
    { memberUid: 'u_stu_omar', tenantId: 'tenant_cairo_univ', email: 'omar.khalid@eng.cu.edu.eg', role: 'student', assignedAt: Date.now() - 500000, status: 'active' },
    { memberUid: 'u_stu_salma', tenantId: 'tenant_cairo_univ', email: 'salma.ali@eng.cu.edu.eg', role: 'student', assignedAt: Date.now() - 300000, status: 'active' }
  ]);

  // New Member Form State
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<TenantMemberRole>('student');
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Upgrade Tier Action
  const handleUpgradeTier = (newTier: SubscriptionTier) => {
    const spec = TIER_ENTITLEMENT_MATRIX[newTier];
    setTenant(prev => ({
      ...prev,
      tier: newTier,
      seatLimit: spec.maxSeats,
      monthlyTokenQuota: spec.monthlyTokens
    }));
  };

  // Add Member Action
  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;

    const uid = 'u_stu_' + Math.random().toString(36).substring(2, 7);
    const { result, newMember } = assignSeat(tenant, uid, newEmail.trim(), newRole, members);

    if (!result.success) {
      setInviteError(result.message);
    } else {
      setTenant({ ...tenant });
      if (newMember) {
        setMembers(prev => [...prev, newMember]);
      }
      setNewEmail('');
      setInviteError(null);
    }
  };

  // Revoke Member Action
  const handleRevoke = (uid: string) => {
    const { success } = revokeSeat(tenant, uid, members);
    if (success) {
      setTenant({ ...tenant });
      setMembers([...members]);
    }
  };

  const currentEntitlements = TIER_ENTITLEMENT_MATRIX[tenant.tier];

  return (
    <div className="w-full min-h-screen bg-[#0A0C14] text-slate-100 p-4 sm:p-8 font-sans relative">
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-1/4 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-6xl mx-auto space-y-8 relative z-10">
        {/* Cockpit Header */}
        <div className="bg-[#121524]/90 border border-slate-800/80 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl text-indigo-400">
                  <Building2 className="w-7 h-7" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                    {isArabic ? 'إدارة المؤسسات والمشتركين المتعددين' : 'Business & Multi-Tenant Management'}
                  </h1>
                  <p className="text-sm text-slate-400 mt-1">
                    {tenant.name} &bull; <span className="font-mono text-cyan-400">ID: {tenant.tenantId}</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <ShieldCheck className="w-3.5 h-3.5" /> Tenant Isolated
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase font-mono">
                <Crown className="w-3.5 h-3.5" /> {tenant.tier.replace('_', ' ')}
              </span>
            </div>
          </div>
        </div>

        {/* Section 1: Subscription Tier Cards */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-indigo-400" />
            Subscription Tiers & Entitlements
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {(Object.keys(TIER_ENTITLEMENT_MATRIX) as SubscriptionTier[]).map(tKey => {
              const spec = TIER_ENTITLEMENT_MATRIX[tKey];
              const isCurrent = tenant.tier === tKey;

              return (
                <div
                  key={tKey}
                  className={`p-6 rounded-3xl backdrop-blur-xl border transition-all flex flex-col justify-between ${
                    isCurrent
                      ? 'bg-indigo-950/40 border-indigo-500/60 shadow-xl shadow-indigo-500/10'
                      : 'bg-[#121524]/90 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="space-y-4">
                    <div className="flex justify-between items-start">
                      <span className="text-sm font-bold text-white">{isArabic ? spec.displayNameAr : spec.displayNameEn}</span>
                      {isCurrent && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500 text-slate-950">
                          Active
                        </span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="text-2xl font-extrabold text-white font-mono">
                        {spec.maxSeats} {spec.maxSeats === 1 ? 'Seat' : 'Seats'}
                      </div>
                      <p className="text-xs text-slate-400">
                        {(spec.monthlyTokens / 1000000).toFixed(1)}M Tokens / month
                      </p>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-800/80 text-xs">
                      <div className="flex items-center gap-2 text-slate-300">
                        {spec.features.customApiKeys ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-slate-600" />}
                        <span>BYO API Keys</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-300">
                        {spec.features.classroomAnalytics ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-slate-600" />}
                        <span>Class Analytics</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-300">
                        {spec.features.institutionalRadar ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-slate-600" />}
                        <span>Deans Early Warning</span>
                      </div>
                    </div>
                  </div>

                  {!isCurrent && (
                    <button
                      onClick={() => handleUpgradeTier(tKey)}
                      className="mt-6 w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 rounded-xl transition"
                    >
                      Switch to Tier
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 2: Seats & Token Consumption Radar */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Seat Allocation Gauge */}
          <div className="bg-[#121524]/90 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-xl shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-400" />
                Seat Allocation ({tenant.activeSeats} / {tenant.seatLimit} Used)
              </h3>
              <span className="text-xs font-mono text-cyan-400">
                {tenant.seatLimit - tenant.activeSeats} Remaining
              </span>
            </div>

            <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan-500 transition-all duration-300"
                style={{ width: `${(tenant.activeSeats / tenant.seatLimit) * 100}%` }}
              />
            </div>

            {/* Invite Form */}
            <form onSubmit={handleAddMember} className="pt-3 border-t border-slate-800 space-y-3">
              <span className="text-xs font-semibold text-slate-300 block">Allocate New Seat</span>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="student@university.edu"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  className="flex-1 px-3 py-2 bg-[#0A0C14] border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:border-cyan-500/50 outline-none"
                />
                <select
                  value={newRole}
                  onChange={e => setNewRole(e.target.value as any)}
                  className="px-2.5 py-2 bg-[#0A0C14] border border-slate-800 rounded-xl text-xs text-cyan-400"
                >
                  <option value="student">Student</option>
                  <option value="educator">Educator</option>
                  <option value="admin">Admin</option>
                </select>
                <button
                  type="submit"
                  className="py-2 px-3 bg-cyan-500 text-slate-950 font-bold rounded-xl text-xs hover:bg-cyan-400 transition flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>

              {inviteError && (
                <p className="text-xs text-rose-400">{inviteError}</p>
              )}
            </form>
          </div>

          {/* Token Consumption Radar */}
          <div className="bg-[#121524]/90 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-xl shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Coins className="w-4 h-4 text-amber-400" />
                Monthly Token Quota Radar
              </h3>
              <span className="text-xs font-mono text-amber-400">
                {((tenant.tokensConsumed / tenant.monthlyTokenQuota) * 100).toFixed(1)}% Used
              </span>
            </div>

            <div className="space-y-2">
              <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 transition-all duration-300"
                  style={{ width: `${(tenant.tokensConsumed / tenant.monthlyTokenQuota) * 100}%` }}
                />
              </div>

              <div className="flex justify-between text-xs text-slate-400 font-mono">
                <span>{(tenant.tokensConsumed / 1000000).toFixed(2)}M consumed</span>
                <span>{(tenant.monthlyTokenQuota / 1000000).toFixed(1)}M limit</span>
              </div>
            </div>

            <div className="p-4 bg-[#0A0C14] border border-slate-800 rounded-2xl text-xs text-slate-300 space-y-1">
              <div className="flex justify-between">
                <span>Billing Cycle Closes:</span>
                <span className="font-mono text-white">In 22 days</span>
              </div>
              <div className="flex justify-between">
                <span>Overage Prevention:</span>
                <span className="text-emerald-400 font-bold">Enabled (Zero Unexpected Bills)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Member Roster Table */}
        <div className="bg-[#121524]/90 border border-slate-800/80 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-400" />
            Active Member Roster ({members.length} Members)
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500 uppercase text-[10px]">
                  <th className="pb-3 font-semibold">User Email</th>
                  <th className="pb-3 font-semibold">Role</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {members.map(m => (
                  <tr key={m.memberUid} className="hover:bg-slate-900/40 transition">
                    <td className="py-3 font-mono text-slate-200">{m.email}</td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                        m.role === 'owner'
                          ? 'bg-amber-500/20 text-amber-300'
                          : m.role === 'educator'
                          ? 'bg-indigo-500/20 text-indigo-300'
                          : 'bg-slate-800 text-slate-300'
                      }`}>
                        {m.role}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        m.status === 'active' ? 'text-emerald-400' : 'text-slate-500'
                      }`}>
                        {m.status}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      {m.role !== 'owner' && m.status === 'active' && (
                        <button
                          onClick={() => handleRevoke(m.memberUid)}
                          className="text-rose-400 hover:text-rose-300 font-semibold text-[11px]"
                        >
                          Revoke Seat
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BusinessTenancyView;
