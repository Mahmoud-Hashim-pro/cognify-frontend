import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Accessibility, 
  Radio, 
  Ear, 
  ArrowLeft, 
  SlidersHorizontal, 
  Bell, 
  Vibrate, 
  Type
} from 'lucide-react';
import { UserProfile } from '../types';
import { localize, isArabicLocale } from '../lib/translations';
import { triggerHapticAlert } from '../lib/hapticNavEngine';
import SignVideoStudio from './SignVideoStudio';
import AmbientSoundRadar from './AmbientSoundRadar';
import HumanCommunicationBridge from './HumanCommunicationBridge';
import type { DisabilityTab } from './DisabilityModeView';

export type DeafTool = 'video' | 'radar' | 'bridge';

interface DeafEcosystemViewProps {
  profile: UserProfile;
  initialTab?: DeafTool;
  onNavigateBack: () => void;
  onMenuClick: () => void;
  onTabChange?: (tab: DisabilityTab) => void;
}

export default function DeafEcosystemView({
  profile,
  initialTab = 'video',
  onNavigateBack,
  onMenuClick,
  onTabChange,
}: DeafEcosystemViewProps) {
  const [activeTool, setActiveTool] = useState<DeafTool>(initialTab);
  const [showAssistiveSettings, setShowAssistiveSettings] = useState(false);
  const [strobeAlertsEnabled, setStrobeAlertsEnabled] = useState(true);
  const [hapticEnabled, setHapticEnabled] = useState(true);
  const [largeCaptionScale, setLargeCaptionScale] = useState(false);
  const [persistentRadarTicker, setPersistentRadarTicker] = useState(true);

  const isAr = isArabicLocale(profile.language);

  // Synchronize initialTab if parent changes it
  useEffect(() => {
    if (initialTab && (initialTab === 'video' || initialTab === 'radar' || initialTab === 'bridge')) {
      setActiveTool(initialTab);
    }
  }, [initialTab]);

  // Notify parent of active tab for synchronization
  const handleSelectTool = useCallback((tool: DeafTool) => {
    setActiveTool(tool);
    if (hapticEnabled) {
      triggerHapticAlert('single-pulse');
    }
    onTabChange?.(tool);
  }, [hapticEnabled, onTabChange]);

  // Keyboard navigation shortcuts: 1, 2, 3 for direct toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when user is typing in an input or textarea
      if (
        e.target instanceof HTMLInputElement || 
        e.target instanceof HTMLTextAreaElement || 
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      if (e.key === '1') {
        e.preventDefault();
        handleSelectTool('video');
      } else if (e.key === '2') {
        e.preventDefault();
        handleSelectTool('radar');
      } else if (e.key === '3') {
        e.preventDefault();
        handleSelectTool('bridge');
      } else if (e.key === 'Escape') {
        onNavigateBack();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSelectTool, onNavigateBack]);

  const DEAF_TOOLS = [
    {
      id: 'video' as const,
      shortcut: '1',
      titleEn: '3D Sign Studio',
      titleAr: 'استوديو لغة الإشارة',
      subtitleEn: '3D Avatar, Reverse Sign-to-Speech & Lexicon',
      subtitleAr: 'أفاتار ثلاثي الأبعاد ونطق الإشارة لصوت مسموع',
      icon: Accessibility,
      color: 'text-indigo-400',
      activeBg: 'bg-indigo-500/20 text-indigo-200 border-indigo-400 shadow-indigo-500/20',
      gradient: 'from-indigo-500 via-purple-500 to-indigo-600',
    },
    {
      id: 'radar' as const,
      shortcut: '2',
      titleEn: 'Ambient Sound Radar',
      titleAr: 'رادار الأصوات والمخاطر',
      subtitleEn: 'Acoustic AI sirens, smoke alarms & car horns',
      subtitleAr: 'كشف مباشر لصفارات الإنذار، الحريق وكلاكس السيارات',
      icon: Radio,
      color: 'text-cyan-400',
      activeBg: 'bg-cyan-500/20 text-cyan-200 border-cyan-400 shadow-cyan-500/20',
      gradient: 'from-cyan-500 to-teal-500',
    },
    {
      id: 'bridge' as const,
      shortcut: '3',
      titleEn: 'Two-Way Live Bridge',
      titleAr: 'جسر التواصل المباشر',
      subtitleEn: 'Live speech subtitles & instant 2-way TTS',
      subtitleAr: 'تفريغ فوري للكلام ونصوص متباينة للتحدث مع الآخرين',
      icon: Ear,
      color: 'text-emerald-400',
      activeBg: 'bg-emerald-500/20 text-emerald-200 border-emerald-400 shadow-emerald-500/20',
      gradient: 'from-emerald-500 to-teal-600',
    },
  ];

  return (
    <div 
      dir={isAr ? 'rtl' : 'ltr'}
      className={`flex-1 flex flex-col h-full bg-[#090b14] text-slate-100 overflow-hidden select-none relative ${
        largeCaptionScale ? 'text-lg' : ''
      }`}
    >
      {/* ── UNIFIED HIGH-ACCESSIBILITY TOP NAVIGATION & TOGGLE BAR ── */}
      <header className="shrink-0 z-30 px-3 py-2.5 sm:px-6 sm:py-3.5 bg-[#101322]/95 backdrop-blur-xl border-b border-slate-800 shadow-xl flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-3">
          {/* Back to Main Hub & Title */}
          <div className="flex items-center gap-2.5 sm:gap-3.5">
            <button
              onClick={onNavigateBack}
              aria-label={localize(profile.language, 'Back to Hub', 'العودة للمركز')}
              className="p-2 sm:px-3.5 sm:py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-all flex items-center gap-1.5 active:scale-95 shrink-0"
            >
              <ArrowLeft className={`w-4 h-4 ${isAr ? 'rotate-180' : ''}`} />
              <span className="hidden md:inline text-xs font-black uppercase tracking-wider">
                {localize(profile.language, 'Hub', 'المركز')}
              </span>
            </button>

            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shadow-inner">
                <Accessibility className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-sm sm:text-base font-black text-white leading-tight flex items-center gap-2">
                  <span>{localize(profile.language, 'Deaf & Hard of Hearing Suite', 'منظومة الصم وضعاف السمع الشاملة')}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 hidden sm:inline">
                    {localize(profile.language, 'All-in-One', 'الكل في شاشة واحدة')}
                  </span>
                </h1>
                <p className="text-[11px] text-slate-400 hidden sm:block">
                  {localize(profile.language, 'All deaf assistive tools grouped in one screen with instant toggles', 'جميع أدوات التيسير السمعي مجتمعة في شاشة واحدة مع إمكانية التبديل الفوري')}
                </p>
              </div>
            </div>
          </div>

          {/* Deaf Assistive Quick Toggles Trigger */}
          <div className="flex items-center gap-2">
            {/* Ambient Safety Indicator */}
            {persistentRadarTicker && (
              <div 
                className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-300 text-xs font-bold"
                title={localize(profile.language, 'Acoustic Hazard Sentinel is actively guarding in the background', 'حارس المخاطر الصوتية يعمل في الخلفية')}
              >
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <span>{localize(profile.language, 'Sound Sentinel Active', 'المستشعر الصوتي متيقظ')}</span>
              </div>
            )}

            <button
              onClick={() => setShowAssistiveSettings(!showAssistiveSettings)}
              aria-label={localize(profile.language, 'Deaf Assistive Quick Toggles', 'تفضيلات وتيسيرات الصم')}
              className={`p-2.5 sm:px-3 sm:py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all ${
                showAssistiveSettings
                  ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-black shadow-lg shadow-cyan-500/20'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span className="hidden sm:inline">{localize(profile.language, 'Assistive Toggles', 'تيسيرات سريعة')}</span>
            </button>
          </div>
        </div>

        {/* ── INTERACTIVE ACCESSIBLE SEGMENTED TOGGLE BAR ── */}
        <div 
          role="tablist"
          aria-label={localize(profile.language, 'Deaf feature switcher', 'مبدل أدوات الصم')}
          className="grid grid-cols-3 gap-1.5 sm:gap-2 p-1 bg-slate-900/90 border border-slate-800/90 rounded-2xl shadow-inner"
        >
          {DEAF_TOOLS.map((tool) => {
            const isSelected = activeTool === tool.id;
            const Icon = tool.icon;

            return (
              <button
                key={tool.id}
                role="tab"
                aria-selected={isSelected}
                onClick={() => handleSelectTool(tool.id)}
                className={`min-h-[46px] sm:min-h-[52px] px-2 sm:px-4 py-2 rounded-xl text-start transition-all flex items-center justify-between gap-2 border relative active:scale-[0.98] ${
                  isSelected
                    ? `${tool.activeBg} border shadow-lg font-black`
                    : 'bg-transparent border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <div className={`p-1.5 sm:p-2 rounded-lg shrink-0 ${
                    isSelected ? 'bg-white/10 text-white' : 'bg-slate-800 text-slate-400'
                  }`}>
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-xs sm:text-sm font-black truncate leading-tight ${
                      isSelected ? 'text-white' : 'text-slate-300'
                    }`}>
                      {localize(profile.language, tool.titleEn, tool.titleAr)}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate hidden md:block">
                      {localize(profile.language, tool.subtitleEn, tool.subtitleAr)}
                    </p>
                  </div>
                </div>

                {/* Keyboard Shortcut Indicator */}
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md font-bold shrink-0 hidden sm:inline ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-500'
                }`}>
                  [{tool.shortcut}]
                </span>
              </button>
            );
          })}
        </div>

        {/* ── COLLAPSIBLE DEAF ASSISTIVE CONTROLS TRAY ── */}
        <AnimatePresence>
          {showAssistiveSettings && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t border-slate-800/80 pt-2.5 mt-1"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 text-start">
                {/* 1. Visual Strobe Toggle */}
                <button
                  onClick={() => setStrobeAlertsEnabled(!strobeAlertsEnabled)}
                  className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                    strobeAlertsEnabled
                      ? 'bg-red-500/15 border-red-500/40 text-red-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4" />
                    <span className="text-xs font-bold">
                      {localize(profile.language, 'Visual Hazard Strobe', 'الوميض البصري للمخاطر')}
                    </span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    strobeAlertsEnabled ? 'bg-red-500 text-white' : 'bg-slate-800 text-slate-500'
                  }`}>
                    {strobeAlertsEnabled ? 'ON' : 'OFF'}
                  </span>
                </button>

                {/* 2. Haptic Vibration Toggle */}
                <button
                  onClick={() => {
                    const next = !hapticEnabled;
                    setHapticEnabled(next);
                    if (next) triggerHapticAlert('single-pulse');
                  }}
                  className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                    hapticEnabled
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Vibrate className="w-4 h-4" />
                    <span className="text-xs font-bold">
                      {localize(profile.language, 'Tactile Vibration Alerts', 'الاهتزاز اللمسي للتنبيهات')}
                    </span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    hapticEnabled ? 'bg-amber-500 text-slate-950 font-black' : 'bg-slate-800 text-slate-500'
                  }`}>
                    {hapticEnabled ? 'ON' : 'OFF'}
                  </span>
                </button>

                {/* 3. Large Subtitles Scale */}
                <button
                  onClick={() => setLargeCaptionScale(!largeCaptionScale)}
                  className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                    largeCaptionScale
                      ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Type className="w-4 h-4" />
                    <span className="text-xs font-bold">
                      {localize(profile.language, 'Large High-Contrast Text', 'نصوص عريضة عالية التباين')}
                    </span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    largeCaptionScale ? 'bg-cyan-500 text-slate-950 font-black' : 'bg-slate-800 text-slate-500'
                  }`}>
                    {largeCaptionScale ? 'ON' : 'OFF'}
                  </span>
                </button>

                {/* 4. Background Hazard Sentinel */}
                <button
                  onClick={() => setPersistentRadarTicker(!persistentRadarTicker)}
                  className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                    persistentRadarTicker
                      ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Radio className="w-4 h-4" />
                    <span className="text-xs font-bold">
                      {localize(profile.language, 'Persistent Sound Sentinel', 'المستشعر الصوتي الدائم')}
                    </span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    persistentRadarTicker ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-500'
                  }`}>
                    {persistentRadarTicker ? 'ON' : 'OFF'}
                  </span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ── ACTIVE DEAF TOOL VIEW CONTAINER ── */}
      <main className="flex-1 min-h-0 relative overflow-hidden flex flex-col">
        <AnimatePresence mode="wait">
          {activeTool === 'video' && (
            <motion.div
              key="deaf-tool-video"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.15 }}
              className="w-full h-full min-h-0"
            >
              <SignVideoStudio
                profile={profile}
                onMenuClick={onMenuClick}
                isEmbedded={true}
                onNavigateBack={onNavigateBack}
              />
            </motion.div>
          )}

          {activeTool === 'radar' && (
            <motion.div
              key="deaf-tool-radar"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.15 }}
              className="w-full h-full min-h-0"
            >
              <AmbientSoundRadar
                profile={profile}
                onNavigateBack={onNavigateBack}
              />
            </motion.div>
          )}

          {activeTool === 'bridge' && (
            <motion.div
              key="deaf-tool-bridge"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.15 }}
              className="w-full h-full min-h-0"
            >
              <HumanCommunicationBridge
                profile={profile}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
