import { localize, isArabicLocale, getTranslation } from '../lib/translations';
import { useState } from "react";
import { UserProfile, CognitiveLevel, UserRole, ChatThread } from "../types";
import { User, Settings, GraduationCap, Accessibility, LifeBuoy, MessageSquare, BarChart3, AlertCircle, LogOut, Plus, ChevronRight, X, Moon, Sun, Mic, Target, Calculator, CalendarCheck, LayoutDashboard, CalendarDays, Sparkles, Brain, Building2, Flame } from "lucide-react";
import { logout, db, cleanDataForFirestore } from "../lib/firebase";
import { deleteDoc, doc, setDoc } from "firebase/firestore";
import { isAdminUser } from "../lib/roles";
import { visibleAcademicSections } from "../lib/academics";
import { isAccessibilityUser, AppView } from "../lib/access";

interface SidebarProps {
  profile: UserProfile;
  setProfile: (profile: UserProfile) => void;
  currentView: AppView;
  setCurrentView: (view: AppView) => void;
  isDarkMode: boolean;
  toggleTheme: () => void;
  openLiveCaptions: () => void;
}

// Cognify "constellation" logomark (from Cognify Redesign v2).
const Logo = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <circle cx="6.5" cy="7" r="2.1" fill="currentColor" />
    <circle cx="17" cy="6" r="2.1" fill="currentColor" opacity="0.85" />
    <circle cx="13" cy="17.5" r="2.1" fill="currentColor" opacity="0.7" />
    <path d="M8 8 12 16M8.4 6.7 15 6.1M15.4 7.6 13.4 15.6" stroke="currentColor" strokeWidth="1.25" opacity="0.5" />
  </svg>
);

export default function Sidebar({ profile, setProfile, currentView, setCurrentView, isDarkMode, toggleTheme, openLiveCaptions }: SidebarProps) {
  const handleChange = (key: keyof UserProfile, value: string) => {
    const updated = { ...profile, [key]: value };
    setProfile(updated);
    // Local-first UI update above; persist so a refresh (or another device)
    // doesn't silently revert the language/level/role change. App.tsx already
    // syncs document.documentElement.lang/dir globally whenever profile.language
    // changes, so that part needs no duplicate handling here.
    if (profile.uid && db) {
      setDoc(doc(db, `users/${profile.uid}`), cleanDataForFirestore({ [key]: value }), { merge: true }).catch(() => {
        /* non-fatal: local state already updated, will retry on next change */
      });
    }
  };
  const isAr = isArabicLocale(profile.language);

  const startNewChat = () => {
    const existingNewChat = profile.chatThreads?.find((t) => t.title === 'New Chat' && !t.lastMessageSnippet);
    if (existingNewChat) {
      setProfile({ ...profile, activeThreadId: existingNewChat.id });
      setCurrentView('chat');
      return;
    }
    const newThread: ChatThread = { id: Date.now().toString(), title: 'New Chat', updatedAt: new Date().toISOString() };
    setProfile({ ...profile, chatThreads: [...(profile.chatThreads || []), newThread], activeThreadId: newThread.id });
    setCurrentView('chat');
  };

  const switchThread = (threadId: string) => {
    setProfile({ ...profile, activeThreadId: threadId });
    setCurrentView('chat');
  };

  const primaryItems = [
    { id: 'chat', label: getTranslation(profile.language, 'chatSession'), icon: MessageSquare },
    { id: 'profile', label: localize(profile.language, 'Learning Profile', 'الملف المعرفي الذكي'), icon: Brain },
    { id: 'learning', label: localize(profile.language, 'Learning Hub', 'مركز التعلّم الذكي'), icon: Sparkles },
  ] as const;

  // Academic sections shown depend on the user's education level (University
  // gets the full set; school & professional get a lighter, relevant set).
  const allAcademicItems = [
    { id: 'goals', label: localize(profile.language, 'Goals', 'الأهداف'), icon: Target },
    { id: 'gpa', label: localize(profile.language, 'GPA', 'حاسبة GPA'), icon: Calculator },
    { id: 'analytics', label: localize(profile.language, 'Analytics', 'تحليلاتي'), icon: LayoutDashboard },
    { id: 'planner', label: localize(profile.language, 'Planner', 'المخطّط'), icon: CalendarDays },
  ] as const;
  const visibleSections = visibleAcademicSections(profile.educationLevel);
  const academicItems = allAcademicItems.filter((i) => visibleSections.includes(i.id as any));

  // Admins (incl. runtime-promoted) and super admins see the dashboard link;
  // normal users never do.
  const isAdmin = isAdminUser(profile);

  // Accessibility (Special Needs) users live in their own isolated world: they
  // must not even SEE the normal experience's navigation (chat, dashboard,
  // academics, new-chat). Admins bypass so they can inspect everything.
  const a11yOnly = isAccessibilityUser(profile) && !isAdmin;

  const academicIds = academicItems.map((i) => i.id) as readonly string[];
  const [academicsOpen, setAcademicsOpen] = useState(academicIds.includes(currentView));

  // navbtn: obsidian glass styling; active = cyan-to-blue gradient pill with cyan text/icon.
  const navBtn = (active: boolean) =>
    `flex items-center gap-3 w-full px-3 h-[38px] rounded-xl text-[13px] font-medium text-start transition-all ${
      active
        ? 'bg-gradient-to-r from-cyan-500/15 to-blue-500/15 border border-cyan-500/30 text-cyan-400 font-semibold shadow-sm'
        : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100 border border-transparent'
    }`;
  const navIcon = (_active: boolean) => `w-[18px] h-[18px] shrink-0`;

  const userInitial = (profile.name || profile.email || 'U').trim().charAt(0).toUpperCase();

  return (
    <div className="w-[284px] h-full shrink-0 bg-[#0E111D]/95 text-slate-200 border-e border-slate-800/80 backdrop-blur-2xl flex flex-col px-[18px] py-[22px]">
      {/* Brand */}
      <div className="flex items-center gap-3 px-1.5 pb-1">
        <div className="w-[34px] h-[34px] rounded-xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-cyan-500/25" style={{ background: 'linear-gradient(135deg,#06b6d4,#6366f1)' }}>
          <Logo className="w-[19px] h-[19px]" />
        </div>
        <div className="leading-none">
          <div className="font-serif text-[23px] font-bold text-white tracking-tight">Cognify</div>
          <div className="text-[11px] text-slate-400 font-medium mt-0.5">{localize(profile.language, 'AI study mentor', 'مدرّسك الذكي')}</div>
        </div>
      </div>

      {/* New chat — hidden for accessibility-only users (their chat lives inside the Accessibility Center) */}
      {!a11yOnly && (
        <button
          onClick={startNewChat}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/20 active:scale-[0.98] transition-all"
        >
          <Plus className="w-[17px] h-[17px]" /> {getTranslation(profile.language, 'newThread')}
        </button>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto custom-scrollbar -mx-1 my-[18px] px-1 flex flex-col gap-[3px]">
        <div className="text-[10px] font-extrabold text-slate-500 tracking-wider px-3 pt-1.5 pb-1 uppercase">{getTranslation(profile.language, 'mainNavigation')}</div>

        {/* Normal-experience navigation — completely hidden from accessibility-only
            users so their world is ONLY the Accessibility Center + account pages. */}
        {!a11yOnly && primaryItems.map((item) => {
          const active = currentView === item.id;
          return (
            <button key={item.id} onClick={() => setCurrentView(item.id as any)} className={navBtn(active)}>
              <item.icon className={navIcon(active)} /> {item.label}
            </button>
          );
        })}

        {/* Academics group */}
        {!a11yOnly && (
          <>
            <button
              onClick={() => setAcademicsOpen((v) => !v)}
              className={navBtn(academicIds.includes(currentView) && !academicsOpen) + ' justify-between'}
            >
              <span className="flex items-center gap-3"><GraduationCap className={navIcon(false)} /> {localize(profile.language, 'Academics', 'الأكاديميات')}</span>
              <ChevronRight className={`w-4 h-4 transition-transform ${academicsOpen ? 'rotate-90' : (localize(profile.language, '', 'rotate-180'))}`} />
            </button>
            {academicsOpen && (
              <div className="flex flex-col gap-[3px] ms-3 ps-2 border-s border-slate-800/80">
                {academicItems.map((item) => {
                  const active = currentView === item.id;
                  return (
                    <button key={item.id} onClick={() => setCurrentView(item.id as any)} className={navBtn(active)}>
                      <item.icon className={navIcon(active)} /> {item.label}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Cognify Memory */}
        <button onClick={() => setCurrentView('memory')} className={navBtn(currentView === 'memory')}>
          <Brain className={navIcon(currentView === 'memory')} />
          {localize(profile.language, 'Cognify Memory', 'ذاكرة كوجنيفي')}
        </button>

        {/* Phase 4: Cognitive Gym */}
        <button onClick={() => setCurrentView('gym')} className={navBtn(currentView === 'gym')}>
          <Flame className={navIcon(currentView === 'gym')} />
          {localize(profile.language, 'Cognitive Gym', 'الجيم المعرفي')}
        </button>

        {/* France Travel & Voice Assistant */}
        <button onClick={() => setCurrentView('france')} className={navBtn(currentView === 'france') + ' relative'}>
          <span className="w-[18px] h-[18px] shrink-0 flex items-center justify-center text-sm leading-none">🇫🇷</span>
          {localize(profile.language, 'France Travel Voice', 'مساعد السفر لفرنسا')}
          <span className="ms-auto text-[10px] font-bold text-amber-400 bg-amber-500/15 border border-amber-500/30 px-[7px] py-[2px] rounded-full">FR</span>
        </button>

        {/* Phase 7: Institution Cohorts Hub */}
        {(isAdmin || profile.isOrgManager === true) && (
          <button onClick={() => setCurrentView('institution')} className={navBtn(currentView === 'institution')}>
            <Building2 className={navIcon(currentView === 'institution')} />
            {localize(profile.language, 'Institution Cohorts', 'شؤون المؤسسة')}
          </button>
        )}

        {/* Accessibility — for accessibility users, admins, and org managers */}
        {(isAccessibilityUser(profile) || isAdmin || profile.isOrgManager === true) && (
          <button onClick={() => setCurrentView('disability')} className={navBtn(currentView === 'disability') + ' relative'}>
            <Accessibility className={navIcon(currentView === 'disability')} />
            {localize(profile.language, 'Accessibility', 'الإتاحة')}
            <span className="ms-auto text-[10px] font-bold text-cyan-400 bg-cyan-500/15 border border-cyan-500/30 px-[7px] py-[2px] rounded-full">{localize(profile.language, 'Live', 'مباشر')}</span>
          </button>
        )}

        {/* Support */}
        <button onClick={() => setCurrentView('support')} className={navBtn(currentView === 'support')}>
          <LifeBuoy className={navIcon(currentView === 'support')} />
          {localize(profile.language, 'Support', 'الدعم')}
        </button>

        {/* Admin */}
        {isAdmin && (
          <button onClick={() => setCurrentView('admin')} className={navBtn(currentView === 'admin') + ' relative'}>
            <AlertCircle className={navIcon(currentView === 'admin')} />
            {localize(profile.language, 'Admin', 'الأدمن')}
            <span className="ms-auto text-[10px] font-bold text-slate-400 bg-[#121524] border border-slate-800 px-[7px] py-[2px] rounded-full">{localize(profile.language, 'Staff', 'مقيّد')}</span>
          </button>
        )}


        {/* Recent threads */}
        {!a11yOnly && (profile.chatThreads?.length || 0) > 0 && (
          <>
            <div className="flex items-center justify-between px-3 pt-4 pb-1">
              <span className="text-[10px] font-extrabold text-slate-500 tracking-wider uppercase">{getTranslation(profile.language, 'chatHistory')}</span>
              <button
                onClick={() => {
                  const threadsToDelete = profile.chatThreads || [];
                  setProfile({ ...profile, chatThreads: [], activeThreadId: undefined });
                  if (profile.uid) threadsToDelete.forEach((thread) => deleteDoc(doc(db, `users/${profile.uid}/threads/${thread.id}`)).catch((e) => console.error(e)));
                }}
                className="text-[10px] font-bold text-rose-400/80 hover:text-rose-300 transition-colors"
                title="Clear all chats"
              >
                {getTranslation(profile.language, 'clearAll')}
              </button>
            </div>
            {profile.chatThreads?.slice().reverse().map((t) => {
              const active = profile.activeThreadId === t.id;
              return (
                <div key={t.id} className={`group flex items-center gap-1 rounded-xl transition-all ${active ? 'bg-[#181C2E] border border-slate-700/80' : 'hover:bg-slate-800/40 border border-transparent'}`}>
                  <button onClick={() => switchThread(t.id)} className="flex flex-col flex-1 items-start gap-0.5 px-3 py-[9px] text-start overflow-hidden min-w-0">
                    <span className="text-[13px] font-semibold text-slate-200 truncate w-full max-w-[200px]">{t.title}</span>
                    <span className="text-[11px] text-slate-500 truncate w-full max-w-[200px]">{t.lastMessageSnippet || (localize(profile.language, 'No messages yet', 'لا رسائل بعد'))}</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const updated = profile.chatThreads?.filter((th) => th.id !== t.id) || [];
                      const nextActive = t.id === profile.activeThreadId
                        ? (updated.length ? updated[updated.length - 1].id : undefined)
                        : profile.activeThreadId;
                      setProfile({ ...profile, chatThreads: updated, activeThreadId: nextActive });
                      if (profile.uid) deleteDoc(doc(db, `users/${profile.uid}/threads/${t.id}`)).catch((er) => console.error(er));
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 me-1 text-slate-500 hover:text-rose-400 rounded-md transition-all"
                    title={localize(profile.language, 'Delete chat', 'حذف المحادثة')}
                    aria-label={localize(profile.language, 'Delete chat', 'حذف المحادثة')}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </>
        )}
      </nav>

      {/* Admin-only level/role override (kept for staff accounts) */}
      {isAdmin && (
        <div className="flex flex-col gap-2 pb-3 border-t border-slate-800/80 pt-3">
          <div className="flex gap-1.5">
            {(['Basic', 'Intermediate', 'Advanced'] as CognitiveLevel[]).map((l) => (
              <button key={l} onClick={() => handleChange('level', l)} className={`flex-1 px-2 py-1.5 rounded-xl text-[11px] font-semibold border transition-all ${profile.level === l ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 font-bold' : 'bg-[#121524] border-slate-800 text-slate-400 hover:border-slate-700'}`}>{l[0]}</button>
            ))}
            {(['Student', 'Professional'] as UserRole[]).map((r) => (
              <button key={r} onClick={() => handleChange('role', r)} className={`flex-1 px-2 py-1.5 rounded-xl text-[11px] font-semibold border transition-all ${profile.role === r ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 font-bold' : 'bg-[#121524] border-slate-800 text-slate-400 hover:border-slate-700'}`}>{r[0]}</button>
            ))}
          </div>
        </div>
      )}

      {/* Footer: theme + language, profile chip, captions + logout */}
      <div className="border-t border-slate-800/80 pt-3 flex flex-col gap-2">
        <div className="flex gap-[7px]">
          <button onClick={toggleTheme} className="flex-1 flex items-center justify-center gap-[7px] py-2 rounded-xl border border-slate-800 bg-[#121524] text-slate-300 hover:text-white hover:bg-slate-800/60 text-xs font-semibold transition-all">
            {isDarkMode ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-slate-400" />}
            {isDarkMode ? (localize(profile.language, 'Light', 'فاتح')) : (localize(profile.language, 'Dark', 'داكن'))}
          </button>
          <div className="flex-1 relative">
            <select
              value={profile.language || 'English'}
              onChange={(e) => handleChange('language', e.target.value)}
              className="w-full h-full appearance-none cursor-pointer text-center py-2 rounded-xl border border-slate-800 bg-[#121524] text-slate-200 text-xs font-semibold hover:border-slate-700 transition-all outline-none focus:border-cyan-500 [color-scheme:dark]"
            >
              {['English', 'Arabic', 'Egyptian Ammiya', 'French', 'Spanish'].map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
        </div>

        <div className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-2xl border bg-[#121524] transition-all ${currentView === 'profile' || currentView === 'settings' ? 'border-cyan-500/60 shadow-sm shadow-cyan-500/10' : 'border-slate-800'}`}>
          <button onClick={() => setCurrentView('profile')} className="flex items-center gap-2.5 flex-1 min-w-0 text-start group" title={localize(profile.language, 'View Profile', 'الملف الشخصي')}>
            <div className="w-[34px] h-[34px] rounded-xl flex items-center justify-center text-white font-black text-sm shrink-0 overflow-hidden shadow-md group-hover:scale-105 transition-transform" style={{ background: 'linear-gradient(135deg, #06b6d4, #6366f1)' }}>
              {profile.photoURL ? <img src={profile.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : userInitial}
            </div>
            <div className="leading-tight overflow-hidden flex-1">
              <div className="text-[13px] font-bold text-slate-100 truncate group-hover:text-cyan-300 transition-colors">{profile.name || profile.email?.split('@')[0] || 'User'}</div>
              <div className="text-[11px] text-slate-400 truncate">{profile.role === 'Student' ? (profile.university || 'Student') : (profile.work || 'Professional')}</div>
            </div>
          </button>
          <button
            onClick={() => setCurrentView('settings')}
            className={`p-2 rounded-xl transition-all shrink-0 ${currentView === 'settings' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-cyan-400 hover:bg-slate-800/60'}`}
            title={localize(profile.language, 'Settings', 'الإعدادات')}
            aria-label={localize(profile.language, 'Settings', 'الإعدادات')}
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-[7px]">
          <button onClick={openLiveCaptions} className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border border-slate-800 bg-[#121524] text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-500/40 text-xs font-semibold transition-all">
            <Mic className="w-3.5 h-3.5" /> {localize(profile.language, 'Captions', 'الكابشن')}
          </button>
          <button onClick={() => logout()} className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-slate-800 bg-[#121524] text-rose-400 hover:bg-rose-950/30 hover:border-rose-800/60 text-xs font-semibold transition-all" title={getTranslation(profile.language, 'logout')} aria-label={getTranslation(profile.language, 'logout')}>
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
