import { useMemo } from "react";
import { UserProfile, CognitiveLevel, AccountPath } from "../../types";
import { Users, Sparkles, Activity, Heart, Brain, GraduationCap, BookOpen } from "lucide-react";
import { sectionOf, isAccessibilityUser } from "../../lib/access";

function daysSinceActive(u?: UserProfile | null): number {
  if (!u) return Infinity;
  const candidates = [u.lastActiveDate, u.lastQuizDate, ...(u.chatThreads || []).map((t) => t?.updatedAt)]
    .filter(Boolean)
    .map((d) => new Date(d as string).getTime())
    .filter((t) => !isNaN(t));
  if (candidates.length === 0) return Infinity;
  return (Date.now() - Math.max(...candidates)) / 86400000;
}

const SECTION_META: Record<AccountPath, { label: string; Icon: typeof Brain; cls: string }> = {
  'Normal': { label: 'Normal', Icon: Brain, cls: 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30' },
  'Special Needs': { label: 'Special Needs', Icon: Heart, cls: 'bg-rose-500/15 text-rose-400 border border-rose-500/30' },
  'Graduation Project': { label: 'Graduation', Icon: GraduationCap, cls: 'bg-amber-500/15 text-amber-400 border border-amber-500/30' },
};

export interface AdminAnalyticsTabProps {
  users: UserProfile[];
}

export default function AdminAnalyticsTab({ users }: AdminAnalyticsTabProps) {
  const a11yCount = useMemo(() => users.filter(isAccessibilityUser).length, [users]);

  const sectionCounts = useMemo(() => {
    const counts: Record<AccountPath, number> = { 'Normal': 0, 'Special Needs': 0, 'Graduation Project': 0 };
    users.forEach(u => {
      const sec = sectionOf(u);
      counts[sec] = (counts[sec] || 0) + 1;
    });
    return counts;
  }, [users]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Registered Users', value: users.length, Icon: Users, cls: 'bg-[#4A1224]/40 text-[#E5A93C] border border-[#E5A93C]/30' },
          { label: 'Active in Last 24h', value: users.filter(u => daysSinceActive(u) <= 1).length, Icon: Sparkles, cls: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' },
          { label: 'Active in Last 7 Days', value: users.filter(u => daysSinceActive(u) <= 7).length, Icon: Activity, cls: 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30' },
          { label: 'Special Needs Learners', value: a11yCount, Icon: Heart, cls: 'bg-rose-500/15 text-rose-400 border border-rose-500/30' },
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Cognitive Stage Breakdown */}
        <div className="backdrop-blur-xl bg-[#0E0610]/70 border border-[#4A1224]/60 shadow-2xl rounded-3xl p-6">
          <h3 className="text-sm font-black text-white uppercase tracking-tight mb-4 flex items-center gap-2">
            <Brain className="w-4 h-4 text-[#E5A93C]" /> Cognitive Stages
          </h3>
          <div className="space-y-3.5">
            {(['Basic', 'Intermediate', 'Advanced'] as CognitiveLevel[]).map(lvl => {
              const count = users.filter(u => (u.level || 'Intermediate') === lvl).length;
              const pct = users.length ? Math.round((count / users.length) * 100) : 0;
              return (
                <div key={lvl} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-200">{lvl}</span>
                    <span className="text-slate-400 font-mono">{count} ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-amber-400 via-[#E5A93C] to-rose-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Account Paths */}
        <div className="backdrop-blur-xl bg-[#0E0610]/70 border border-[#4A1224]/60 shadow-2xl rounded-3xl p-6">
          <h3 className="text-sm font-black text-white uppercase tracking-tight mb-4 flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-amber-400" /> Enrolment Paths
          </h3>
          <div className="space-y-3.5">
            {(['Normal', 'Special Needs', 'Graduation Project'] as AccountPath[]).map(sec => {
              const count = sectionCounts[sec] || 0;
              const pct = users.length ? Math.round((count / users.length) * 100) : 0;
              const meta = SECTION_META[sec];
              return (
                <div key={sec} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-200">{meta.label}</span>
                    <span className="text-slate-400 font-mono">{count} ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Language Preferences */}
        <div className="backdrop-blur-xl bg-[#0E0610]/70 border border-[#4A1224]/60 shadow-2xl rounded-3xl p-6">
          <h3 className="text-sm font-black text-white uppercase tracking-tight mb-4 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-emerald-400" /> Language Preferences
          </h3>
          <div className="space-y-3.5">
            {['Egyptian Ammiya', 'Arabic', 'English', 'French', 'Spanish'].map(lang => {
              const count = users.filter(u => (u.language || 'English') === lang).length;
              const pct = users.length ? Math.round((count / users.length) * 100) : 0;
              return (
                <div key={lang} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-200">{lang}</span>
                    <span className="text-slate-400 font-mono">{count} ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
