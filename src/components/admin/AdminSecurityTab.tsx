import { useState, useMemo } from "react";
import { toast } from "../Toast";
import {
  Loader2, Search, Trash2, Copy, Filter, Layers, Globe, Terminal,
  Sliders, ShieldAlert, ShieldCheck, Lock, X, Users
} from "lucide-react";
import { SecurityAuditRecord } from "../../lib/securityTracker";

export interface AdminSecurityTabProps {
  securityAudits: SecurityAuditRecord[];
  isInspectOwner: boolean;
  auditLimit: number;
  setAuditLimit: (limit: number) => void;
  onClearAllAudits: () => Promise<void>;
  isClearingAudits: boolean;
  copyToClipboard: (text: string, label?: string) => Promise<void>;
}

export default function AdminSecurityTab({
  securityAudits,
  isInspectOwner,
  auditLimit,
  setAuditLimit,
  onClearAllAudits,
  isClearingAudits,
  copyToClipboard,
}: AdminSecurityTabProps) {
  const [securitySearchTerm, setSecuritySearchTerm] = useState<string>("");
  const [securityUserFilter, setSecurityUserFilter] = useState<string>("all");
  const [securityTriggerFilter, setSecurityTriggerFilter] = useState<string>("all");

  const formatDate = (isoString?: string) => {
    if (!isoString) return "Never";
    const d = new Date(isoString);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Unique users with security audits
  const uniqueAuditUsers = useMemo(() => {
    const map = new Map<string, { key: string; name: string; email: string; uid: string; count: number }>();
    securityAudits.forEach((a) => {
      const key = a.uid || a.email || 'anonymous';
      const existing = map.get(key);
      if (existing) {
        existing.count++;
      } else {
        map.set(key, {
          key,
          name: a.name || a.email || 'Anonymous User',
          email: a.email || '',
          uid: a.uid || '',
          count: 1,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [securityAudits]);

  // Filtered security audits
  const filteredAudits = useMemo(() => {
    return securityAudits.filter((record) => {
      // 1. User Filter
      if (securityUserFilter !== 'all') {
        const key = record.uid || record.email || 'anonymous';
        if (key !== securityUserFilter && record.email !== securityUserFilter && record.uid !== securityUserFilter) {
          return false;
        }
      }

      // 2. Trigger Filter
      if (securityTriggerFilter !== 'all') {
        if (record.eventType !== securityTriggerFilter) {
          return false;
        }
      }

      // 3. Search Term
      if (securitySearchTerm.trim()) {
        const q = securitySearchTerm.toLowerCase().trim();
        const matchName = (record.name || '').toLowerCase().includes(q);
        const matchEmail = (record.email || '').toLowerCase().includes(q);
        const matchUid = (record.uid || '').toLowerCase().includes(q);
        const matchIp = (record.ip || '').toLowerCase().includes(q);
        const matchPath = (record.path || '').toLowerCase().includes(q);
        const matchDetails = (record.details || '').toLowerCase().includes(q);
        const matchRole = (record.role || '').toLowerCase().includes(q);
        return matchName || matchEmail || matchUid || matchIp || matchPath || matchDetails || matchRole;
      }

      return true;
    });
  }, [securityAudits, securityUserFilter, securityTriggerFilter, securitySearchTerm]);

  const handleShowAllActivities = () => {
    setSecuritySearchTerm("");
    setSecurityUserFilter("all");
    setSecurityTriggerFilter("all");
    setAuditLimit(500);
    toast.success('Showing all recorded activities (500 limit)', 'All Activities Loaded');
  };

  const handleResetSecurityFilters = () => {
    setSecuritySearchTerm("");
    setSecurityUserFilter("all");
    setSecurityTriggerFilter("all");
  };

  if (!isInspectOwner) {
    return (
      <div className="backdrop-blur-xl bg-[#0E0610]/70 border border-rose-500/30 rounded-3xl p-12 text-center max-w-xl mx-auto space-y-4">
        <div className="w-16 h-16 rounded-3xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
          <Lock className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-black text-white uppercase tracking-tight">Security Tracker Restricted Access</h3>
        <p className="text-sm text-slate-400 leading-relaxed">
          The DevTools Inspect Telemetry &amp; Security Audit stream is strictly restricted to modyhashim2006@gmail.com.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Security Metrics Cards */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="backdrop-blur-xl bg-[#0E0610]/70 border border-rose-500/30 shadow-2xl rounded-3xl p-5 flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="text-3xl font-black text-white leading-none font-mono">
              {filteredAudits.length !== securityAudits.length ? `${filteredAudits.length} / ${securityAudits.length}` : securityAudits.length}
            </div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1.5">
              {filteredAudits.length !== securityAudits.length ? 'Filtered / Total' : 'Inspects Logged'}
            </div>
          </div>
        </div>

        <div className="backdrop-blur-xl bg-[#0E0610]/70 border border-[#4A1224]/60 shadow-2xl rounded-3xl p-5 flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-[#4A1224]/40 text-[#E5A93C] border border-[#E5A93C]/30">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <div className="text-3xl font-black text-white leading-none font-mono">
              {new Set(securityAudits.map(s => s.ip)).size}
            </div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1.5">Unique IP Addresses</div>
          </div>
        </div>

        <div className="backdrop-blur-xl bg-[#0E0610]/70 border border-[#4A1224]/60 shadow-2xl rounded-3xl p-5 flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <Terminal className="w-6 h-6" />
          </div>
          <div>
            <div className="text-3xl font-black text-white leading-none font-mono">
              {securityAudits.filter(s => s.eventType === 'devtools_inspect_shortcut').length}
            </div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1.5">Shortcut Probes (F12)</div>
          </div>
        </div>

        <div className="backdrop-blur-xl bg-[#0E0610]/70 border border-[#4A1224]/60 shadow-2xl rounded-3xl p-5 flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-purple-500/15 text-purple-400 border border-purple-500/30">
            <Sliders className="w-6 h-6" />
          </div>
          <div>
            <div className="text-3xl font-black text-white leading-none font-mono">
              {securityAudits.filter(s => s.eventType === 'contextmenu_inspect').length}
            </div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1.5">Right-Click Inspects</div>
          </div>
        </div>
      </section>

      {/* Stream Controls: Live Beacon + Action Buttons */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
            </span>
            <span className="text-xs font-black uppercase tracking-widest text-slate-300">
              Live Telemetry Stream (Active Detection)
            </span>
          </div>

          <span className="px-2.5 py-1 rounded-xl text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-[#4A1224]/50">
            {filteredAudits.length} {filteredAudits.length === securityAudits.length ? 'activities' : `of ${securityAudits.length} activities`}
          </span>

          {auditLimit > 50 && (
            <span className="px-2.5 py-1 rounded-xl text-[10px] font-mono font-bold bg-[#4A1224]/60 text-[#E5A93C] border border-[#E5A93C]/40">
              All Records Loaded (500 max)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleShowAllActivities}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95 ${
              auditLimit > 50 && !securitySearchTerm && securityUserFilter === 'all' && securityTriggerFilter === 'all'
                ? 'bg-gradient-to-r from-amber-400 via-[#E5A93C] to-rose-600 text-slate-950 shadow-[#E5A93C]/20 ring-2 ring-[#E5A93C] font-extrabold'
                : 'bg-slate-800 hover:bg-slate-700 text-[#E5A93C] border border-[#E5A93C]/30'
            }`}
            title="Reset all filters and load all activities from database"
          >
            <Layers className="w-3.5 h-3.5" />
            Show All Activities
          </button>

          <button
            onClick={onClearAllAudits}
            disabled={isClearingAudits || securityAudits.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50"
          >
            {isClearingAudits ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            Clear Security Logs
          </button>
        </div>
      </div>

      {/* Filter and Search Bar for Users and Activities */}
      <div className="backdrop-blur-xl bg-[#150917]/70 border border-[#4A1224]/70 shadow-xl rounded-2xl p-3 sm:p-4 flex flex-col md:flex-row items-stretch md:items-center gap-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search users, emails, UIDs, IPs, routes, or details..."
            value={securitySearchTerm}
            onChange={(e) => setSecuritySearchTerm(e.target.value)}
            className="w-full pl-10 pr-9 py-2.5 bg-[#080409] border border-[#4A1224]/60 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#E5A93C] focus:ring-1 focus:ring-[#E5A93C]/30 transition-all font-mono"
          />
          {securitySearchTerm && (
            <button
              onClick={() => setSecuritySearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white p-0.5 rounded-full"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter by User Dropdown */}
        <div className="flex items-center gap-2 min-w-[200px]">
          <Users className="w-4 h-4 text-slate-500 shrink-0" />
          <select
            value={securityUserFilter}
            onChange={(e) => setSecurityUserFilter(e.target.value)}
            className="w-full px-3 py-2.5 bg-[#080409] border border-[#4A1224]/60 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-[#E5A93C] focus:ring-1 focus:ring-[#E5A93C]/30 transition-all cursor-pointer font-bold"
          >
            <option value="all">All Users ({uniqueAuditUsers.length})</option>
            {uniqueAuditUsers.map((u) => (
              <option key={u.key} value={u.key}>
                {u.name} ({u.count} {u.count === 1 ? 'event' : 'events'})
              </option>
            ))}
          </select>
        </div>

        {/* Filter by Trigger Dropdown */}
        <div className="flex items-center gap-2 min-w-[180px]">
          <Filter className="w-4 h-4 text-slate-500 shrink-0" />
          <select
            value={securityTriggerFilter}
            onChange={(e) => setSecurityTriggerFilter(e.target.value)}
            className="w-full px-3 py-2.5 bg-[#080409] border border-[#4A1224]/60 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-[#E5A93C] focus:ring-1 focus:ring-[#E5A93C]/30 transition-all cursor-pointer font-bold"
          >
            <option value="all">All Triggers ({securityAudits.length})</option>
            <option value="devtools_inspect_shortcut">
              F12 / Shortcut ({securityAudits.filter(s => s.eventType === 'devtools_inspect_shortcut').length})
            </option>
            <option value="contextmenu_inspect">
              Right-Click Inspect ({securityAudits.filter(s => s.eventType === 'contextmenu_inspect').length})
            </option>
            <option value="devtools_opened">
              DevTools Opened ({securityAudits.filter(s => s.eventType === 'devtools_opened').length})
            </option>
            <option value="debugger_probe">
              Debugger Probe ({securityAudits.filter(s => s.eventType === 'debugger_probe').length})
            </option>
          </select>
        </div>

        {/* Reset Filters button if any active */}
        {(securitySearchTerm || securityUserFilter !== 'all' || securityTriggerFilter !== 'all') && (
          <button
            onClick={handleResetSecurityFilters}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-bold transition-all shrink-0"
            title="Reset all active filters"
          >
            <X className="w-3.5 h-3.5" />
            Reset Filters
          </button>
        )}
      </div>

      {/* Inspect Audit Incidents Table */}
      <div className="backdrop-blur-xl bg-[#0E0610]/70 border border-[#4A1224]/60 shadow-2xl rounded-3xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0E0610]/95 text-[10px] uppercase font-black tracking-widest text-slate-400 border-b border-[#4A1224]/60">
                <th className="p-4">User / Perpetrator</th>
                <th className="p-4">Client Public IP</th>
                <th className="p-4">Inspect Trigger</th>
                <th className="p-4">Route Path</th>
                <th className="p-4">Timestamp</th>
                <th className="p-4">Details</th>
              </tr>
            </thead>
            <tbody className="text-sm font-medium text-slate-200 divide-y divide-slate-800/60">
              {filteredAudits.length > 0 ? filteredAudits.map((record) => {
                const badgeColor =
                  record.eventType === 'devtools_inspect_shortcut'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    : record.eventType === 'contextmenu_inspect'
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                    : record.eventType === 'devtools_opened'
                    ? 'bg-[#4A1224]/60 text-[#E5A93C] border-[#E5A93C]/40'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40';

                return (
                  <tr key={record.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-white flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-300 font-black text-xs flex items-center justify-center">
                          {(record.name || record.email || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div>{record.name || 'Unnamed User'}</div>
                          <div className="text-xs text-slate-400">{record.email}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-mono text-[10px] text-slate-500">UID: {record.uid}</span>
                        <button
                          onClick={() => setSecurityUserFilter(record.uid || record.email || 'anonymous')}
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-[#E5A93C] hover:text-[#E5A93C] transition-colors"
                          title={`Filter all activities for ${record.name || record.email}`}
                        >
                          <Filter className="w-2.5 h-2.5" /> Filter User
                        </button>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center gap-1.5 font-mono text-xs font-black bg-[#080409] border border-[#4A1224]/60 px-2.5 py-1 rounded-lg text-emerald-400">
                        {record.ip}
                        <button
                          onClick={() => copyToClipboard(record.ip, `IP ${record.ip} copied`)}
                          className="text-slate-500 hover:text-white transition-colors"
                          title="Copy IP"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => setSecuritySearchTerm(record.ip)}
                          className="text-slate-500 hover:text-[#E5A93C] transition-colors"
                          title="Filter by this IP address"
                        >
                          <Search className="w-3 h-3" />
                        </button>
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider border ${badgeColor}`}>
                        {record.eventType === 'devtools_inspect_shortcut' ? 'F12 / Shortcut' :
                         record.eventType === 'contextmenu_inspect' ? 'Right Click Inspect' :
                         record.eventType === 'devtools_opened' ? 'DevTools Docked' :
                         record.eventType}
                      </span>
                    </td>
                    <td className="p-4 font-mono text-xs text-slate-300">{record.path}</td>
                    <td className="p-4 text-xs text-slate-400 whitespace-nowrap">
                      <div>{formatDate(record.timestamp)}</div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {Math.round((Date.now() - record.timestampMs) / 1000)}s ago
                      </div>
                    </td>
                    <td className="p-4 text-xs text-slate-400 max-w-xs truncate" title={record.details || record.userAgent}>
                      {record.details || record.userAgent}
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={6} className="p-16 text-center text-slate-500 font-medium">
                    {securityAudits.length > 0 ? (
                      <div className="space-y-3">
                        <Filter className="w-10 h-10 text-amber-400/50 mx-auto" />
                        <p className="text-white font-bold text-sm">No security activities match your filter.</p>
                        <p className="text-xs text-slate-400">Try adjusting your search query, selected user, or trigger type.</p>
                        <button
                          onClick={handleShowAllActivities}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-400 via-[#E5A93C] to-rose-600 text-slate-950 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95"
                        >
                          <Layers className="w-3.5 h-3.5" />
                          Show All Activities
                        </button>
                      </div>
                    ) : (
                      <div>
                        <ShieldCheck className="w-10 h-10 text-emerald-400/50 mx-auto mb-2" />
                        No element inspect attempts logged yet. Real-time telemetry is actively listening.
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
