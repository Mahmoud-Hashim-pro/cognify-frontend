import { localize } from '../lib/translations';
import { useState } from 'react';
import { motion } from 'motion/react';
import { Activity, TrendingUp, TrendingDown, Minus, Target, ShieldAlert, Sparkles, Info, ChevronDown } from 'lucide-react';
import {
  MetricsInput,
  academicHealthScore,
  successProbability,
  learningMomentum,
  predictedGPA,
  focusPriorities,
  academicStatus,
  MetricResult,
} from '../lib/studentMetrics';

const STATUS_STYLE: Record<string, { bg: string; text: string; ring: string }> = {
  'High Performance': { bg: 'bg-emerald-500/15', text: 'text-emerald-400', ring: 'ring-emerald-500/30' },
  'On Track': { bg: 'bg-cyan-500/15', text: 'text-cyan-400', ring: 'ring-cyan-500/30' },
  'Needs Attention': { bg: 'bg-amber-500/15', text: 'text-amber-400', ring: 'ring-amber-500/30' },
  'At Risk': { bg: 'bg-rose-500/15', text: 'text-rose-400', ring: 'ring-rose-500/30' },
};

const STATUS_AR: Record<string, string> = {
  'High Performance': 'أداء عالٍ',
  'On Track': 'على المسار',
  'Needs Attention': 'يحتاج انتباه',
  'At Risk': 'في خطر',
};

function MetricTile({ label, value, suffix, state, accent, icon }: {
  label: string; value: string; suffix?: string; state: string; accent: string; icon: React.ReactNode;
}) {
  return (
    <div className="bg-[#0A0C14] rounded-2xl p-4 border border-slate-800 shadow-inner">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
        <span className={accent}>{icon}</span> {label}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        {state === 'no-data' ? (
          <span className="text-sm font-bold text-slate-600">—</span>
        ) : (
          <>
            <span className="font-display text-2xl md:text-3xl font-black text-white leading-none font-mono">{value}</span>
            {suffix && <span className="text-xs font-semibold text-slate-500 font-mono">{suffix}</span>}
          </>
        )}
      </div>
      {state !== 'ok' && (
        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 mt-1.5 inline-block">
          {state === 'calibrating' ? 'Calibrating' : 'No data yet'}
        </span>
      )}
    </div>
  );
}

/** S1 + S27: the Executive Command Center with an Explainable-AI panel. */
export default function AcademicCommandCenter({ input, isAr, language }: { input: MetricsInput; isAr: boolean; language?: string }) {
  const [showWhy, setShowWhy] = useState(false);
  const t = (en: string, ar: string) => localize(language, en, ar);

  const health = academicHealthScore(input);
  const success = successProbability(input);
  const momentum = learningMomentum(input);
  const pgpa = predictedGPA(input);
  const focus = focusPriorities(input);

  // Empty state — honest, with a clear CTA (acceptance criterion #1).
  if (health.state === 'no-data') {
    return (
      <div className="bg-[#121524]/90 rounded-3xl p-8 border border-slate-800/80 shadow-2xl backdrop-blur-xl text-center">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-4">
          <Activity className="w-7 h-7 text-cyan-400" />
        </div>
        <h2 className="text-xl font-black text-white">{t('Your Academic Operating System', 'نظام تشغيلك الأكاديمي')}</h2>
        <p className="text-sm text-slate-400 mt-1.5 max-w-md mx-auto">
          {t('Add your courses, attendance, and a goal to unlock your live health score, GPA forecast, and a personalised next action.',
            'أضف موادك وحضورك وهدفًا لتفعيل درجة صحتك الأكاديمية وتوقّع المعدل وخطوتك التالية المخصّصة.')}
        </p>
      </div>
    );
  }

  const status = academicStatus(health.value, success.value);
  const s = STATUS_STYLE[status];
  const strength = health.topFactors.find((f) => f.effect === '+');
  const weakness = health.topFactors.find((f) => f.effect === '-');
  const nextAction = focus[0];
  const momentumIcon = momentum.value > 55 ? <TrendingUp className="w-4 h-4 text-emerald-400" /> : momentum.value < 45 ? <TrendingDown className="w-4 h-4 text-rose-400" /> : <Minus className="w-4 h-4 text-slate-400" />;

  const whyRows: { title: string; m: MetricResult }[] = [
    { title: t('Academic Health', 'الصحة الأكاديمية'), m: health },
    { title: t('Success Probability', 'احتمالية النجاح'), m: success },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="bg-[#121524]/90 rounded-3xl p-6 md:p-7 border border-slate-800/80 shadow-2xl backdrop-blur-xl"
    >
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shadow-inner">
            <Activity className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h2 className="font-display text-lg font-black text-white tracking-tight leading-none">
              {t('Academic Operating System', 'نظام التشغيل الأكاديمي')}
            </h2>
            <p className="text-xs text-slate-400 font-medium mt-1">{t('What to do next to improve', 'ماذا تفعل بعد ذلك للتحسّن')}</p>
          </div>
        </div>
        <span className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider ring-1 ${s.bg} ${s.text} ${s.ring}`}>
          {status === 'At Risk' ? <ShieldAlert className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
          {isAr ? STATUS_AR[status] : status}
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricTile label={t('Health Score', 'درجة الصحة')} value={String(health.value)} suffix="/100" state={health.state} accent="text-cyan-400" icon={<Activity className="w-3.5 h-3.5" />} />
        <MetricTile label={t('Success', 'النجاح')} value={String(success.value)} suffix="%" state={success.state} accent="text-cyan-400" icon={<Target className="w-3.5 h-3.5" />} />
        <MetricTile label={t('Momentum', 'الزخم')} value={String(momentum.value)} suffix="/100" state={momentum.state} accent={momentum.value >= 50 ? 'text-emerald-400' : 'text-rose-400'} icon={momentumIcon} />
        <MetricTile label={t('Predicted GPA', 'المعدل المتوقّع')} value={pgpa.state === 'no-data' ? '—' : pgpa.value.toFixed(2)} state={pgpa.state} accent="text-amber-400" icon={<TrendingUp className="w-3.5 h-3.5" />} />
      </div>

      <div className="grid md:grid-cols-3 gap-3 mt-3.5">
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4">
          <div className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-1">{t('Biggest Strength', 'أكبر نقطة قوة')}</div>
          <div className="text-sm font-bold text-slate-100">{strength?.label ?? t('Keep building', 'استمر')}</div>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4">
          <div className="text-[10px] font-black uppercase tracking-widest text-amber-400 mb-1">{t('Focus Area', 'مجال التركيز')}</div>
          <div className="text-sm font-bold text-slate-100">{weakness?.label ?? t('Balanced', 'متوازن')}</div>
        </div>
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4">
          <div className="text-[10px] font-black uppercase tracking-widest text-cyan-400 mb-1">{t('Next Critical Action', 'الخطوة التالية')}</div>
          <div className="text-sm font-bold text-slate-100">
            {nextAction ? `${t('Study', 'ذاكر')} ${nextAction.label}` : (health.improvementActions[0] ?? t('Keep going', 'استمر'))}
          </div>
        </div>
      </div>

      <button
        onClick={() => setShowWhy((v) => !v)}
        aria-expanded={showWhy}
        className="mt-4 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-400 hover:text-cyan-400 transition-colors"
      >
        <Info className="w-3.5 h-3.5 text-cyan-400" /> {t('Why these scores?', 'لماذا هذه الدرجات؟')}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showWhy ? 'rotate-180' : ''}`} />
      </button>

      {showWhy && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-3.5 grid md:grid-cols-2 gap-3">
          {whyRows.map(({ title, m }) => (
            <div key={title} className="bg-[#0A0C14] border border-slate-800 rounded-2xl p-4 shadow-inner">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black uppercase tracking-widest text-slate-200">{title}</span>
                <span className="text-[10px] font-mono font-bold text-cyan-400">{t('confidence', 'الثقة')} {Math.round(m.confidence * 100)}%</span>
              </div>
              <ul className="space-y-1.5 mb-2.5">
                {m.topFactors.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs text-slate-300">
                    <span className={`font-mono font-black ${f.effect === '+' ? 'text-emerald-400' : f.effect === '-' ? 'text-rose-400' : 'text-slate-500'}`}>{f.effect}</span>
                    {f.label}
                  </li>
                ))}
              </ul>
              {m.improvementActions[0] && (
                <p className="text-xs text-cyan-400 font-medium border-t border-slate-800 pt-2">→ {m.improvementActions[0]}</p>
              )}
            </div>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}
