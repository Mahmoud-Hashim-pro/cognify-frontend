import { useState } from 'react';
import { UserProfile } from '../types';
import { Menu, LifeBuoy, ChevronDown, Mail, MessageSquare, Accessibility, Globe, Activity, ShieldCheck, ArrowLeft } from 'lucide-react';
import { localize, isArabicLocale } from '../lib/translations';

interface SupportCenterProps {
  profile: UserProfile;
  onMenuClick?: () => void;
  onNavigateBack?: () => void;
}

// Support goes to the core team.
const SUPPORT_EMAILS = [
  'pro.mahmoud.h@gmail.com',
  'its.alkhateeb@gmail.com',
  'esraahosni8@gmail.com',
];
const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAILS.join(',')}`;

export default function SupportCenter({ profile, onMenuClick, onNavigateBack }: SupportCenterProps) {
  const isAr = isArabicLocale(profile.language);
  const t = (en: string, ar: string) => localize(profile.language, en, ar);
  const [open, setOpen] = useState<number | null>(0);

  const faqs: { icon: any; q: string; a: string }[] = [
    {
      icon: Activity,
      q: t('What is the Health Score / Academic Operating System?', 'إيه درجة الصحة / نظام التشغيل الأكاديمي؟'),
      a: t('A 0–100 score built from your grades, attendance, task completion, consistency, and engagement. It is calculated by formulas (not the AI) and is explainable — tap "Why these scores?" to see the factors. With little data it shows "Calibrating" instead of a fake number.',
           'درجة من 100 بتتحسب من درجاتك وحضورك وإنجاز المهام والانتظام والتفاعل. بتتحسب بمعادلات (مش الـ AI) وقابلة للشرح — دوس "ليه الدرجات دي؟" تشوف العوامل. لو الداتا قليلة بتعرض "Calibrating" بدل رقم مزيّف.'),
    },
    {
      icon: Globe,
      q: t('How do I change the language?', 'أغيّر اللغة إزاي؟'),
      a: t('Use the language dropdown in the sidebar footer (or in your Profile). Your choice is saved to your account. The AI chat also replies in whatever language you type.',
           'من قائمة اللغة في أسفل الشريط الجانبي (أو في صفحة البروفايل). اختيارك بيتحفظ في حسابك. والشات بيرد بأي لغة بتكتب بيها.'),
    },
    {
      icon: Accessibility,
      q: t('What are the accessibility modes?', 'إيه أوضاع الإتاحة؟'),
      a: t('Open "Accessibility" from the sidebar. Choose a profile — Speech (voice + read-aloud), Visual (for blind users), Vocal-Deaf or Sign-Only (live captions + a 3D sign-language avatar). The interface adapts automatically.',
           'افتح "الإتاحة" من الشريط الجانبي واختار وضع — Speech (صوت + قراءة)، Visual (للمكفوفين)، Vocal-Deaf أو Sign-Only (كابشن مباشر + أفاتار لغة إشارة ثلاثي الأبعاد). الواجهة بتتأقلم تلقائيًا.'),
    },
    {
      icon: MessageSquare,
      q: t('The AI said it is busy or overloaded — what do I do?', 'الـ AI قال إنه مشغول/زحمة — أعمل إيه؟'),
      a: t('Just try again in a moment. Cognify automatically falls back across multiple AI providers, so it keeps working even when one is rate-limited.',
           'جرّب تاني بعد لحظات. كوجنيفاي بيبدّل تلقائيًا بين أكتر من مزوّد ذكاء اصطناعي، فبيفضل شغّال حتى لو واحد زحمة.'),
    },
    {
      icon: ShieldCheck,
      q: t('Is my data private?', 'بياناتي خاصة؟'),
      a: t('Yes. Your data is tied to your own account. You stay in control of your profile, chats, and academic data.',
           'أيوه. بياناتك مربوطة بحسابك إنت. إنت المتحكّم في بروفايلك ومحادثاتك وبياناتك الأكاديمية.'),
    },
  ];

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="flex-1 h-screen overflow-y-auto bg-[#0A0C14] text-slate-100 relative selection:bg-cyan-500/30 selection:text-white overflow-x-hidden font-sans flex flex-col custom-scrollbar p-6 md:p-10 gap-6">
      {/* Ambient Lighting Orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[140px]" />
        <div className="absolute top-1/2 -right-40 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[140px]" />
        <div className="absolute -bottom-40 left-1/3 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[140px]" />
      </div>

      <header className="flex items-start gap-4">
        {onNavigateBack && (
          <button
            onClick={onNavigateBack}
            className="p-2.5 mt-1 text-slate-300 hover:text-white bg-[#121524]/90 shadow-md border border-slate-800 hover:border-slate-700 hover:bg-[#181C2E] rounded-2xl active:scale-95 transition-all flex items-center gap-2 shrink-0"
            title={t('Back to Assistant', 'العودة للمساعد')}
          >
            <ArrowLeft className="w-5 h-5 rtl:rotate-180" />
            <span className="text-xs font-bold hidden sm:inline">{t('Back', 'رجوع')}</span>
          </button>
        )}
        {onMenuClick && (
          <button onClick={onMenuClick} aria-label={t('Open menu', 'افتح القائمة')} title={t('Open Menu', 'فتح القائمة')} className="p-2.5 mt-1 text-slate-300 hover:text-white bg-[#121524]/90 shadow-md border border-slate-800 hover:border-slate-700 hover:bg-[#181C2E] rounded-2xl active:scale-95 shrink-0 transition-all">
            <Menu className="w-5 h-5" />
          </button>
        )}
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <span className="p-2 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <LifeBuoy className="w-6 h-6" />
            </span>
            {t('Support Center', 'مركز الدعم')}
          </h1>
          <p className="text-sm text-slate-400 mt-1 font-medium">{t('Answers to common questions, and how to reach us.', 'إجابات للأسئلة الشائعة، وإزاي توصلنا.')}</p>
        </div>
      </header>

      <div className="max-w-3xl w-full space-y-6 pb-10">
        {/* Contact card */}
        <div className="relative overflow-hidden bg-gradient-to-r from-cyan-600/90 via-blue-600/90 to-indigo-600/90 border border-cyan-500/30 text-white rounded-[28px] p-6 md:p-8 shadow-2xl shadow-cyan-500/10 flex flex-col md:flex-row md:items-center gap-5">
          <div className="flex-1">
            <h2 className="font-display text-xl font-bold tracking-tight">{t('Need a hand?', 'محتاج مساعدة؟')}</h2>
            <p className="text-sm text-cyan-100/90 mt-1 font-medium">{t('Email our team and we’ll get back to you.', 'ابعتلنا إيميل وهنرد عليك في أقرب وقت.')}</p>
          </div>
          <a
            href={SUPPORT_MAILTO}
            className="inline-flex items-center justify-center gap-2 bg-white text-slate-900 font-bold text-xs uppercase tracking-wider px-6 py-3.5 rounded-2xl hover:bg-slate-100 shadow-xl shadow-black/20 active:scale-95 transition-all shrink-0"
          >
            <Mail className="w-4 h-4 text-cyan-600" /> {t('Email our team', 'ابعتلنا إيميل')}
          </a>
        </div>

        {/* FAQ */}
        <div className="bg-[#121524]/90 border border-slate-800/80 rounded-[28px] overflow-hidden backdrop-blur-xl shadow-2xl">
          <div className="px-6 py-4 border-b border-slate-800/80 bg-[#181C2E]/40">
            <h2 className="font-display text-sm font-bold uppercase tracking-wider text-slate-300">{t('Frequently asked', 'الأسئلة الشائعة')}</h2>
          </div>
          {faqs.map((f, i) => {
            const isOpen = open === i;
            return (
              <div key={i} className="border-b border-slate-800/60 last:border-b-0 transition-colors">
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center gap-3.5 px-6 py-4.5 text-start hover:bg-slate-800/30 transition-all"
                >
                  <span className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
                    <f.icon className="w-4 h-4" />
                  </span>
                  <span className="flex-1 text-sm font-semibold text-slate-200">{f.q}</span>
                  <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180 text-cyan-400' : ''}`} />
                </button>
                {isOpen && (
                  <div className="px-6 pb-5 ps-16 pt-1 text-[13.5px] leading-relaxed text-slate-400 animate-in fade-in duration-200">
                    {f.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-center text-xs text-slate-500 font-medium">
          {t('Still stuck?', 'لسه محتاج مساعدة؟')} <a href={SUPPORT_MAILTO} className="text-cyan-400 hover:text-cyan-300 font-semibold underline underline-offset-4 transition-colors">{t('Email the admin team', 'ابعت لفريق الأدمن')}</a>
        </p>
      </div>
    </div>
  );
}
