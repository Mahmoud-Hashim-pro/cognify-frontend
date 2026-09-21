/**
 * Proactive Suggestion & Grounded Insight Card (Cognify 2.0)
 * Milestones 6, 7 & 8: Obsidian glassmorphic banner for proactive opportunities and insights.
 *
 * Adheres to:
 * - Obsidian glassmorphic palette (#0A0C14 canvas, #121524 card, slate borders, luminous ambient glow).
 * - Full Student Agency: [Start Action], [Not Now (Snooze)], [Dismiss], and [Settings Toggle].
 * - Bilingual RTL/LTR support (Arabic & English).
 * - Grounded Triad display for Learning Insights: Evidence + Interpretation + Action.
 */

import React, { useState } from 'react';
import {
  Sparkles,
  RotateCcw,
  AlertTriangle,
  TrendingUp,
  Brain,
  Zap,
  Clock,
  CheckCircle2,
  X,
  BellOff,
  Settings,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  ArrowLeft,
  SlidersHorizontal,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { localize, isArabicLocale } from '../lib/translations';
import type { ProactiveOpportunity } from '../lib/proactiveAssistantEngine';
import type { LearningInsight } from '../lib/learningInsightsEngine';
import {
  dismissOpportunity,
  snoozeOpportunity,
  toggleProactiveSuggestions,
  isProactiveEnabled,
} from '../lib/proactiveAssistantEngine';

export interface ProactiveSuggestionCardProps {
  opportunity?: ProactiveOpportunity;
  insight?: LearningInsight;
  language?: string;
  onAccept: (promptToInject: string, targetConceptId?: string) => void;
  onDismiss?: (id: string) => void;
  onSnooze?: (id: string) => void;
  onSettingsToggle?: (enabled: boolean) => void;
  className?: string;
}

export default function ProactiveSuggestionCard({
  opportunity,
  insight,
  language = 'English',
  onAccept,
  onDismiss,
  onSnooze,
  onSettingsToggle,
  className = '',
}: ProactiveSuggestionCardProps) {
  const isAr = isArabicLocale(language);
  const [showSettings, setShowSettings] = useState(false);
  const [proactiveEnabled, setProactiveEnabled] = useState(isProactiveEnabled());
  const [isDismissedLocally, setIsDismissedLocally] = useState(false);

  if (isDismissedLocally || (!opportunity && !insight)) {
    return null;
  }

  const itemId = opportunity?.id || insight?.id || '';

  // Handle Accept
  const handleAcceptClick = () => {
    if (opportunity) {
      const prompt =
        opportunity.metadata?.promptToInject ||
        (isAr
          ? `أريد البدء في ${opportunity.recommendedAction} لمفهوم (${opportunity.conceptNameAr}).`
          : `I want to start ${opportunity.recommendedAction} for ${opportunity.conceptNameEn}.`);
      onAccept(prompt, opportunity.conceptId);
    } else if (insight) {
      onAccept(insight.action.promptToInject, insight.action.conceptId);
    }
  };

  // Handle Snooze (30 min)
  const handleSnoozeClick = () => {
    snoozeOpportunity(itemId, 30);
    setIsDismissedLocally(true);
    if (onSnooze) onSnooze(itemId);
  };

  // Handle Dismiss
  const handleDismissClick = () => {
    dismissOpportunity(itemId, 'opportunity');
    setIsDismissedLocally(true);
    if (onDismiss) onDismiss(itemId);
  };

  // Handle Global Toggle
  const handleToggleGlobal = () => {
    const nextState = !proactiveEnabled;
    toggleProactiveSuggestions(nextState);
    setProactiveEnabled(nextState);
    if (onSettingsToggle) onSettingsToggle(nextState);
    if (!nextState) {
      setIsDismissedLocally(true);
    }
  };

  // Visual Theme mapping based on category/type
  const typeKey = opportunity?.type || insight?.category;

  let themeStyles = {
    cardBg: 'from-amber-500/10 via-[#121524]/95 to-indigo-950/20',
    border: 'border-amber-500/30 hover:border-amber-500/50',
    glow: 'bg-amber-500/10',
    badgeBg: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
    badgeText: isAr ? 'مراجعة تثبيت' : 'Retention Review',
    icon: RotateCcw,
    iconColor: 'text-amber-400',
    actionBtn: 'from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-amber-500/20',
  };

  if (typeKey === 'repeated_struggle' || typeKey === 'cognitive_strain' || typeKey === 'prerequisite_link') {
    themeStyles = {
      cardBg: 'from-rose-500/10 via-[#121524]/95 to-purple-950/20',
      border: 'border-rose-500/30 hover:border-rose-500/50',
      glow: 'bg-rose-500/10',
      badgeBg: 'bg-rose-500/15 border-rose-500/30 text-rose-300',
      badgeText: isAr ? 'مساعدة مستهدفة' : 'Targeted Support',
      icon: AlertTriangle,
      iconColor: 'text-rose-400',
      actionBtn: 'from-rose-500 to-rose-600 hover:from-rose-400 hover:to-rose-500 text-white shadow-rose-500/20',
    };
  } else if (typeKey === 'growth_challenge' || typeKey === 'breakthrough') {
    themeStyles = {
      cardBg: 'from-emerald-500/10 via-[#121524]/95 to-cyan-950/20',
      border: 'border-emerald-500/30 hover:border-emerald-500/50',
      glow: 'bg-emerald-500/10',
      badgeBg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
      badgeText: isAr ? 'تحدٍ معرفي متقدم' : 'Growth Challenge',
      icon: Sparkles,
      iconColor: 'text-emerald-400',
      actionBtn: 'from-emerald-500 to-cyan-600 hover:from-emerald-400 hover:to-cyan-500 text-slate-950 shadow-emerald-500/20',
    };
  } else if (typeKey === 'strategy_optimization') {
    themeStyles = {
      cardBg: 'from-cyan-500/10 via-[#121524]/95 to-indigo-950/20',
      border: 'border-cyan-500/30 hover:border-cyan-500/50',
      glow: 'bg-cyan-500/10',
      badgeBg: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300',
      badgeText: isAr ? 'استراتيجية عالية الفاعلية' : 'Optimal Strategy',
      icon: Zap,
      iconColor: 'text-cyan-400',
      actionBtn: 'from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white shadow-cyan-500/20',
    };
  }

  const IconComponent = themeStyles.icon;
  const ArrowIcon = isAr ? ArrowLeft : ArrowRight;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={`relative overflow-hidden rounded-3xl bg-gradient-to-r ${themeStyles.cardBg} border ${themeStyles.border} backdrop-blur-2xl shadow-2xl p-5 sm:p-6 transition-all group ${className}`}
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {/* Luminous Ambient Background Glow */}
      <div className={`absolute -right-16 -top-16 w-56 h-56 ${themeStyles.glow} rounded-full blur-3xl pointer-events-none`} />

      {/* Top Header Row */}
      <div className="flex items-center justify-between gap-3 mb-3.5 relative z-10">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="w-8 h-8 rounded-xl bg-slate-900/80 border border-slate-700/60 flex items-center justify-center shrink-0">
            <IconComponent className={`w-4 h-4 ${themeStyles.iconColor}`} />
          </div>
          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${themeStyles.badgeBg}`}>
            {themeStyles.badgeText}
          </span>
          {(opportunity?.metadata?.daysOverdue || insight?.metricDelta) && (
            <span className="text-[11px] font-medium text-slate-400 bg-slate-900/60 px-2 py-0.5 rounded-lg border border-slate-800">
              {insight?.metricDelta || `${opportunity?.metadata?.daysOverdue}d overdue`}
            </span>
          )}
        </div>

        {/* Agency Controls Menu */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setShowSettings(!showSettings)}
            aria-label={localize(language, 'Proactive Settings', 'إعدادات الاقتراحات')}
            title={localize(language, 'Proactive Settings', 'إعدادات الاقتراحات')}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800/60 transition-colors"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleDismissClick}
            aria-label={localize(language, 'Dismiss', 'تجاهل')}
            title={localize(language, 'Dismiss', 'تجاهل')}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800/60 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Settings Flyout Bar */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 p-3 rounded-2xl bg-[#0A0C14]/90 border border-slate-800 text-xs flex items-center justify-between gap-3 overflow-hidden"
          >
            <div className="flex items-center gap-2 text-slate-300">
              <BellOff className="w-4 h-4 text-slate-400" />
              <span>{localize(language, 'Proactive Learning Assistant Suggestions', 'اقتراحات المساعد التعليمي الاستباقي')}</span>
            </div>
            <button
              onClick={handleToggleGlobal}
              className={`px-3 py-1 rounded-xl font-semibold text-[11px] transition-all border ${
                proactiveEnabled
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30'
              }`}
            >
              {proactiveEnabled
                ? localize(language, 'Enabled (Click to pause)', 'مفعل (اضغط للتعطيل)')
                : localize(language, 'Paused (Click to resume)', 'معطل (اضغط للتفعيل)')}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content Area */}
      <div className="space-y-3 relative z-10">
        {/* If rendering a ProactiveOpportunity */}
        {opportunity && (
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
              {isAr ? opportunity.titleAr : opportunity.titleEn}
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">
              {isAr ? opportunity.messageAr : opportunity.messageEn}
            </p>
          </div>
        )}

        {/* If rendering a LearningInsight (Grounded Triad: Evidence + Interpretation + Action) */}
        {insight && (
          <div className="space-y-3">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                {isAr ? insight.headlineAr : insight.headlineEn}
              </h3>
            </div>

            {/* Triad Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              {/* Pillar 1: Evidence */}
              <div className="p-3 rounded-2xl bg-slate-900/70 border border-slate-800/80 space-y-1">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  {localize(language, '1. Empirical Evidence', '١. الدليل التجريبي')}
                </div>
                <p className="text-xs text-slate-200 leading-relaxed font-medium">
                  {isAr ? insight.evidenceAr : insight.evidenceEn}
                </p>
              </div>

              {/* Pillar 2: Interpretation */}
              <div className="p-3 rounded-2xl bg-slate-900/70 border border-slate-800/80 space-y-1">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                  {localize(language, '2. Pedagogical Meaning', '٢. التفسير التربوي')}
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {isAr ? insight.interpretationAr : insight.interpretationEn}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action Agency Bar (Accept / Snooze / Dismiss) */}
      <div className="mt-5 pt-3.5 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-3 relative z-10">
        <div className="flex items-center gap-2">
          {/* Primary Action Button */}
          <button
            onClick={handleAcceptClick}
            className={`flex items-center gap-2 px-4 py-2 rounded-2xl bg-gradient-to-r ${themeStyles.actionBtn} text-xs font-bold shadow-lg transition-all active:scale-95 cursor-pointer`}
          >
            <span>
              {opportunity
                ? opportunity.recommendedAction
                : isAr
                ? insight?.action.labelAr
                : insight?.action.labelEn}
            </span>
            <ArrowIcon className="w-3.5 h-3.5" />
          </button>

          {/* Secondary "Not Now" Snooze Button */}
          <button
            onClick={handleSnoozeClick}
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 text-xs font-semibold transition-all active:scale-95 cursor-pointer"
          >
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{localize(language, 'Not Now', 'ليس الآن')}</span>
          </button>
        </div>

        {/* Tertiary "Dismiss" Button */}
        <button
          onClick={handleDismissClick}
          className="text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors px-2 py-1 cursor-pointer"
        >
          {localize(language, 'Dismiss', 'تجاهل')}
        </button>
      </div>
    </motion.div>
  );
}
