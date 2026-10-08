import { useState } from "react";
import { UserProfile, AccessibilityMode } from "../../types";
import { toast } from "../Toast";
import {
  Accessibility, Activity, Ear, CheckCircle2, AlertTriangle, Mail, Eye,
  Mic, User as UserIcon, Brain, Search, Copy, Download, Printer
} from "lucide-react";
import { sectionOf, isAccessibilityUser } from "../../lib/access";

// Visual identity for disability types (Accessibility Center)
const DISABILITY_META: Record<string, { label: string; Icon: typeof Eye; bar: string }> = {
  'Visual Impairment': { label: 'Visual', Icon: Eye, bar: 'bg-indigo-500' },
  'Hearing Impairment': { label: 'Hearing', Icon: Ear, bar: 'bg-rose-500' },
  'Speech Impairment': { label: 'Speech', Icon: Mic, bar: 'bg-emerald-500' },
  'Cognitive/Learning Disability': { label: 'Cognitive', Icon: Brain, bar: 'bg-purple-500' },
  'Other': { label: 'Other', Icon: UserIcon, bar: 'bg-slate-400' },
};

// Visual identity for active accessibility mode
const MODE_META: Record<AccessibilityMode, { label: string; cls: string }> = {
  'Visual': { label: 'Visual', cls: 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' },
  'Speech': { label: 'Speech', cls: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' },
  'Vocal-Deaf': { label: 'Vocal-Deaf', cls: 'bg-rose-500/20 text-rose-300 border border-rose-500/30' },
  'Sign-Only': { label: 'Sign-Only', cls: 'bg-purple-500/20 text-purple-300 border border-purple-500/30' },
  'None': { label: 'Standard', cls: 'bg-slate-800 text-slate-400 border border-[#4A1224]/50' },
};

function daysSinceActive(u?: UserProfile | null): number {
  if (!u) return Infinity;
  const candidates = [u.lastActiveDate, u.lastQuizDate, ...(u.chatThreads || []).map((t) => t?.updatedAt)]
    .filter(Boolean)
    .map((d) => new Date(d as string).getTime())
    .filter((t) => !isNaN(t));
  if (candidates.length === 0) return Infinity;
  return (Date.now() - Math.max(...candidates)) / 86400000;
}

function newestActiveIso(u?: UserProfile | null): string | undefined {
  if (!u) return undefined;
  const candidates = [u.lastActiveDate, u.lastQuizDate, ...(u.chatThreads || []).map((t) => t?.updatedAt)]
    .filter(Boolean) as string[];
  if (candidates.length === 0) return undefined;
  return candidates.reduce((a, b) => (new Date(b).getTime() > new Date(a).getTime() ? b : a));
}

const sanitizeCsvCell = (val: unknown): string => {
  let str = val === null || val === undefined ? '' : String(val);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }
  return `"${str.replace(/"/g, '""')}"`;
};

const formatDate = (isoString?: string) => {
  if (!isoString) return "Never";
  const d = new Date(isoString);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export interface AdminAccessibilityTabProps {
  users: UserProfile[];
  copyToClipboard: (text: string, label?: string) => Promise<void>;
}

export default function AdminAccessibilityTab({
  users,
  copyToClipboard,
}: AdminAccessibilityTabProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const a11yAll = users.filter(isAccessibilityUser);
  const a11yActive7 = a11yAll.filter(u => daysSinceActive(u) <= 7).length;
  const a11ySigners = a11yAll.filter(u => u.accessibilityMode === 'Sign-Only' || u.accessibilityMode === 'Vocal-Deaf').length;
  const a11yNew30 = a11yAll.filter(u => daysSinceActive(u) <= 30).length;

  const disabilityCounts = Object.keys(DISABILITY_META).map((key) => ({
    key,
    count: a11yAll.filter(u => {
      const raw = u.disabilityType || 'Other';
      const canonical = DISABILITY_META[raw] ? raw : 'Other';
      return canonical === key;
    }).length,
  }));
  const maxDisability = Math.max(1, ...disabilityCounts.map(d => d.count));

  const modeCounts = (Object.keys(MODE_META) as AccessibilityMode[]).map((m) => ({
    mode: m,
    count: a11yAll.filter(u => (u.accessibilityMode || 'None') === m).length,
  }));

  const copyA11yEmails = async () => {
    const emails = a11yAll.map(u => u.email).filter(Boolean).join(', ');
    await copyToClipboard(emails, `${a11yAll.length} email(s) copied to clipboard.`);
  };

  const idleUsers = a11yAll
    .filter(u => { const d = daysSinceActive(u); return d >= 14 && d !== Infinity; })
    .sort((a, b) => daysSinceActive(b) - daysSinceActive(a));

  const weeklyActivity = (() => {
    const buckets = Array.from({ length: 8 }, (_, i) => ({
      label: i === 7 ? 'This wk' : `-${7 - i}w`,
      count: 0,
    }));
    const now = Date.now();
    a11yAll.forEach((u) => {
      const events: (string | undefined)[] = [
        u.lastActiveDate, u.lastQuizDate,
        ...(u.chatThreads || []).map(t => t.updatedAt),
      ];
      events.forEach((iso) => {
        if (!iso) return;
        const weeksAgo = Math.floor((now - new Date(iso).getTime()) / (7 * 86400000));
        if (weeksAgo >= 0 && weeksAgo < 8) buckets[7 - weeksAgo].count++;
      });
    });
    return buckets;
  })();
  const maxWeekly = Math.max(1, ...weeklyActivity.map(w => w.count));

  const exportA11yCsv = () => {
    const rows = [
      ['Name', 'Email', 'Section', 'Disability Type', 'Active Mode', 'Last Active', 'Status'],
      ...a11yAll.map((u) => {
        const d = daysSinceActive(u);
        return [
          u.name || 'Unnamed', u.email || '', sectionOf(u), u.disabilityType || 'Other',
          u.accessibilityMode || 'None',
          formatDate(newestActiveIso(u)),
          d <= 7 ? 'Active' : d === Infinity ? 'Never' : `${Math.floor(d)}d idle`,
        ];
      }),
    ];
    const csv = '\uFEFF' + rows.map(r => r.map(c => sanitizeCsvCell(c)).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cognify-accessibility-users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success(`${a11yAll.length} user(s) exported.`, 'CSV downloaded');
  };

  const openMonthlyReport = () => {
    const win = window.open('', '_blank');
    if (!win) { toast.error('Popup blocked — allow popups to print the report.', 'Report'); return; }
    const esc = (s: string) => String(s || '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]!));
    const monthName = new Date().toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
    const kpi = (label: string, value: number | string) =>
      `<div class="kpi"><div class="v">${value}</div><div class="l">${label}</div></div>`;
    const disRows = disabilityCounts.map(({ key, count }) =>
      `<tr><td>${esc(DISABILITY_META[key].label)}</td><td class="c">${count}</td></tr>`).join('');
    const modeRows = modeCounts.map(({ mode, count }) =>
      `<tr><td>${esc(MODE_META[mode].label)}</td><td class="c">${count}</td></tr>`).join('');
    const weekCells = weeklyActivity.map(w =>
      `<td class="c"><div class="bar" style="height:${Math.round((w.count / maxWeekly) * 60) + 4}px"></div><div class="wl">${w.label}</div><div class="wc">${w.count}</div></td>`).join('');
    const idleRows = idleUsers.length
      ? idleUsers.map(u => `<tr><td>${esc(u.name || 'Unnamed')}</td><td>${esc(u.email || '')}</td><td class="c">${Math.floor(daysSinceActive(u))} يوم</td></tr>`).join('')
      : '<tr><td colspan="3" class="c">لا يوجد مستخدمون خاملون 🎉</td></tr>';
    const userRows = a11yAll.map(u => {
      const d = daysSinceActive(u);
      return `<tr><td>${esc(u.name || 'Unnamed')}</td><td>${esc(u.disabilityType || 'Other')}</td><td>${esc(u.accessibilityMode || 'None')}</td><td class="c">${d <= 7 ? 'نشط' : d === Infinity ? 'لم يبدأ' : Math.floor(d) + ' يوم خمول'}</td></tr>`;
    }).join('');
    win.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير كوجنيفاي الشهري — قسم ذوي الهمم</title><style>
      body{font-family:'Segoe UI',Tahoma,sans-serif;color:#141E38;margin:32px;line-height:1.6}
      h1{font-size:24px;margin:0 0 2px} .sub{color:#54617C;font-size:13px;margin:0 0 24px}
      h2{font-size:15px;margin:26px 0 8px;border-bottom:2px solid #2E42C9;padding-bottom:4px;color:#2E42C9}
      .kpis{display:flex;gap:12px} .kpi{flex:1;border:1px solid #E3E8F0;border-radius:10px;padding:12px;text-align:center}
      .kpi .v{font-size:26px;font-weight:800} .kpi .l{font-size:11px;color:#54617C;font-weight:700}
      table{width:100%;border-collapse:collapse;font-size:12.5px} td,th{border:1px solid #E3E8F0;padding:6px 10px;text-align:right}
      th{background:#F5F7FA;font-size:11px} .c{text-align:center}
      .chart td{border:0;vertical-align:bottom} .bar{width:26px;background:#2E42C9;border-radius:4px 4px 0 0;margin:0 auto}
      .wl{font-size:10px;color:#54617C;margin-top:4px}.wc{font-size:11px;font-weight:800}
      .foot{margin-top:28px;color:#8B96AB;font-size:11px;border-top:1px solid #E3E8F0;padding-top:10px}
      @media print{ .noprint{display:none} }
    </style></head><body>
      <button class="noprint" onclick="window.print()" style="padding:8px 18px;font-weight:700;margin-bottom:16px">🖨️ طباعة / حفظ PDF</button>
      <h1>تقرير كوجنيفاي الشهري — قسم ذوي الهمم</h1>
      <p class="sub">${monthName} · أُنشئ في ${new Date().toLocaleDateString('ar-EG')} · إعداد فريق كوجنيفاي</p>
      <div class="kpis">
        ${kpi('إجمالي المستخدمين', a11yAll.length)}
        ${kpi('نشطون آخر 7 أيام', a11yActive7)}
        ${kpi('مستخدمو لغة الإشارة', a11ySigners)}
        ${kpi('خاملون +14 يوم', idleUsers.length)}
      </div>
      <h2>النشاط الأسبوعي (آخر 8 أسابيع)</h2>
      <table class="chart"><tr>${weekCells}</tr></table>
      <h2>التوزيع حسب نوع الإعاقة</h2><table><tr><th>النوع</th><th class="c">العدد</th></tr>${disRows}</table>
      <h2>التوزيع حسب الوضع المفعّل</h2><table><tr><th>الوضع</th><th class="c">العدد</th></tr>${modeRows}</table>
      <h2>مستخدمون يحتاجون متابعة (خمول +14 يوم)</h2><table><tr><th>الاسم</th><th>البريد</th><th class="c">مدة الخمول</th></tr>${idleRows}</table>
      <h2>كل المستخدمين</h2><table><tr><th>الاسم</th><th>نوع الإعاقة</th><th>الوضع</th><th class="c">الحالة</th></tr>${userRows}</table>
      <p class="foot">كوجنيفاي — نسخة إمكانية الوصول · تقرير آلي من لوحة الإدارة</p>
    </body></html>`);
    win.document.close();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Special Needs Learners', value: a11yAll.length, Icon: Accessibility, cls: 'bg-rose-500/15 text-rose-400 border border-rose-500/30' },
          { label: 'Active in Last 7 Days', value: a11yActive7, Icon: Activity, cls: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' },
          { label: 'Sign Language Learners', value: a11ySigners, Icon: Ear, cls: 'bg-purple-500/15 text-purple-400 border border-purple-500/30' },
          { label: 'Active in Last 30 Days', value: a11yNew30, Icon: CheckCircle2, cls: 'bg-[#4A1224]/40 text-[#E5A93C] border border-[#E5A93C]/30' },
        ].map(({ label, value, Icon, cls }) => (
          <div key={label} className="backdrop-blur-xl bg-[#0E0610]/70 border border-[#4A1224]/60 shadow-2xl rounded-3xl p-5 flex items-center gap-4">
            <div className={`p-3 rounded-2xl ${cls}`}>
              <Icon className="w-6 h-6" />
            </div>
            <div>
              <div className="text-3xl font-black text-white leading-none">{value}</div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1.5">{label}</div>
            </div>
          </div>
        ))}
      </section>

      {idleUsers.length > 0 && (
        <section className="bg-amber-500/10 border border-amber-500/30 rounded-3xl p-6 backdrop-blur-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded-2xl">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-tight">Requires Follow-up</h3>
              <p className="text-xs font-medium text-slate-400">
                {idleUsers.length} user{idleUsers.length === 1 ? '' : 's'} inactive for 14+ days. Reach out to verify accessibility accommodations.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {idleUsers.slice(0, 8).map((u) => (
              <a
                key={u.uid}
                href={`mailto:${u.email}?subject=Cognify Accessibility Check-in`}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#0E0610]/95 border border-amber-500/40 rounded-xl text-xs font-bold text-slate-200 hover:border-amber-400 transition-colors"
              >
                <Mail className="w-3.5 h-3.5 text-amber-400" />
                {u.name || u.email?.split('@')[0]}
                <span className="text-[10px] font-black text-amber-400 font-mono">{Math.floor(daysSinceActive(u))}d</span>
              </a>
            ))}
            {idleUsers.length > 8 && (
              <span className="inline-flex items-center px-3 py-1.5 text-xs font-bold text-slate-400">
                +{idleUsers.length - 8} more…
              </span>
            )}
          </div>
        </section>
      )}

      {/* Weekly Activity & Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="backdrop-blur-xl bg-[#0E0610]/70 border border-[#4A1224]/60 shadow-2xl rounded-3xl p-6">
          <h3 className="text-sm font-black text-white uppercase tracking-tight mb-4">By Registered Disability</h3>
          <div className="space-y-3.5">
            {disabilityCounts.map(({ key, count }) => {
              const meta = DISABILITY_META[key];
              return (
                <div key={key} className="flex items-center gap-3">
                  <meta.Icon className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="w-28 text-xs font-bold text-slate-200 shrink-0">{meta.label}</span>
                  <div className="flex-1 h-2.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full ${meta.bar} rounded-full transition-all`} style={{ width: `${(count / maxDisability) * 100}%` }} />
                  </div>
                  <span className="w-8 text-right text-xs font-black text-white font-mono">{count}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="backdrop-blur-xl bg-[#0E0610]/70 border border-[#4A1224]/60 shadow-2xl rounded-3xl p-6">
          <h3 className="text-sm font-black text-white uppercase tracking-tight mb-4">By Active Operational Mode</h3>
          <div className="flex flex-wrap gap-2.5">
            {modeCounts.map(({ mode, count }) => (
              <span key={mode} className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-black ${MODE_META[mode].cls}`}>
                {MODE_META[mode].label}
                <span className="bg-[#080409]/60 px-2 py-0.5 rounded-lg font-mono text-white">{count}</span>
              </span>
            ))}
          </div>
          <p className="text-xs text-slate-400 font-medium mt-5 leading-relaxed">
            The active operational mode represents how the learner interacts with Cognify in real-time (e.g., Eye Gaze, Euphonia vocal triggers, or Sign avatar).
          </p>
        </section>
      </div>

      {/* Outreach Controls & Table */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search accessibility users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-[#0E0610]/90 border border-[#4A1224]/60 rounded-2xl text-sm font-medium text-white placeholder:text-slate-500 focus:ring-2 focus:ring-rose-500 outline-none"
          />
        </div>
        <button
          onClick={copyA11yEmails}
          className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-[#150917] hover:bg-slate-800 text-white text-xs font-black uppercase tracking-widest rounded-2xl border border-[#4A1224]/50 transition-colors shrink-0"
        >
          <Copy className="w-4 h-4" /> Copy All Emails
        </button>
        <button
          onClick={exportA11yCsv}
          className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-widest rounded-2xl transition-colors shrink-0"
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
        <button
          onClick={openMonthlyReport}
          className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-rose-600 hover:bg-rose-500 text-white text-xs font-black uppercase tracking-widest rounded-2xl transition-colors shrink-0"
        >
          <Printer className="w-4 h-4" /> Print Monthly Report
        </button>
      </div>
    </div>
  );
}
