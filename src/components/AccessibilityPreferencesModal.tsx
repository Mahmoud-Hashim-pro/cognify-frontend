import React, { useState } from 'react';
import {
  Sliders,
  Lock,
  Unlock,
  Volume2,
  FileText,
  Eye,
  Layers,
  Zap,
  Sparkles,
  ShieldCheck,
  RotateCcw,
  X,
  CheckCircle2,
} from 'lucide-react';
import type {
  CommunicationPreferences,
  A11yCommunicationProfile,
  ResponseLengthPreference,
  ModalityPreference,
  VisualDensityPreference,
  InteractionSpeedPreference,
} from '../types/accessibilityIntelligence';
import {
  setUserManualPreference,
  createDefaultCommunicationPreferences,
} from '../lib/accessibilityIntelligenceEngine';

interface AccessibilityPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: A11yCommunicationProfile;
  onProfileUpdated: (updated: A11yCommunicationProfile) => void;
  lang?: 'en' | 'ar' | 'fr';
}

export const AccessibilityPreferencesModal: React.FC<AccessibilityPreferencesModalProps> = ({
  isOpen,
  onClose,
  profile,
  onProfileUpdated,
  lang = 'ar',
}) => {
  if (!isOpen) return null;

  const isAr = lang === 'ar';
  const prefs = profile.preferences || createDefaultCommunicationPreferences();
  const locks = prefs.manualLocks || {};

  const handleUpdate = (
    key: keyof CommunicationPreferences,
    value: any,
    lock = true
  ) => {
    const updated = setUserManualPreference(profile, key, value, lock);
    onProfileUpdated(updated);
  };

  const handleToggleLock = (key: string) => {
    const isCurrentlyLocked = Boolean(locks[key]);
    const updatedLocks = { ...locks, [key]: !isCurrentlyLocked };
    const updatedProfile: A11yCommunicationProfile = {
      ...profile,
      preferences: {
        ...prefs,
        manualLocks: updatedLocks,
      },
    };
    onProfileUpdated(updatedProfile);
  };

  const handleToggleAutoAdaptation = () => {
    const updatedProfile: A11yCommunicationProfile = {
      ...profile,
      autoAdaptationEnabled: !profile.autoAdaptationEnabled,
    };
    onProfileUpdated(updatedProfile);
  };

  const handleResetDefaults = () => {
    const updatedProfile: A11yCommunicationProfile = {
      ...profile,
      preferences: createDefaultCommunicationPreferences(),
      autoAdaptationEnabled: true,
    };
    onProfileUpdated(updatedProfile);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md font-sans animate-in fade-in">
      <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl bg-[#0d101d] border border-slate-800 p-6 shadow-2xl text-slate-100 space-y-6">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Sliders className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-white">
                {isAr ? 'تفضيلات إمكانية الوصول والتواصل التكيفي' : 'Accessibility & Adaptive Communication'}
              </h2>
              <p className="text-xs text-slate-400">
                {isAr
                  ? 'التحكم الكامل في أسلوب الحوار، طول الإجابات، والوسائط المفضلة مع الحفاظ على خصوصيتك.'
                  : 'Full control over dialogue style, response length, and interaction modalities.'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Ethical Non-Diagnosis Guarantee Banner */}
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <div className="text-xs font-bold text-emerald-300">
              {isAr ? 'حاجز الخصوصية والكرامة الإنسانية (Non-Diagnosis Guard)' : 'Privacy & Dignity Guarantee'}
            </div>
            <p className="text-[11px] text-emerald-200/80 leading-relaxed">
              {isAr
                ? 'يتعلم كوجنيفاي أسلوب التواصل والتفاعل الوظيفي فقط (مثل طول الرد وسرعة التصفح)، ولا يقوم أبدًا بتشخيص أو تصنيف أو تخزين أي حالات أو مسميات طبية.'
                : 'Cognify adapts strictly to observable communication habits (response length, listening preferences) and never infers, assigns, or stores medical diagnostic labels.'}
            </p>
          </div>
        </div>

        {/* Auto-Adaptation Toggle */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-[#121526] border border-slate-800">
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span>{isAr ? 'التكيّف التلقائي الذكي' : 'Smart Auto-Adaptation'}</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {isAr
                ? 'السماح للنظام بضبط أسلوب التواصل تلقائياً بناءً على سرعة القراءة والاستماع.'
                : 'Allow Cognify to adjust communication style based on your pace and reading habits.'}
            </p>
          </div>

          <button
            onClick={handleToggleAutoAdaptation}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
              profile.autoAdaptationEnabled
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            {profile.autoAdaptationEnabled
              ? isAr
                ? 'مفعل ✅'
                : 'Enabled ✅'
              : isAr
              ? 'معطل ❌'
              : 'Disabled ❌'}
          </button>
        </div>

        {/* 1. Response Length Selector */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-300">
              {isAr ? 'طول الشرح والتفصيل المفضل:' : 'Preferred Response Length:'}
            </label>
            <button
              onClick={() => handleToggleLock('preferredResponseLength')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono transition-all border ${
                locks.preferredResponseLength
                  ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                  : 'bg-slate-800 text-slate-500 border-slate-700'
              }`}
            >
              {locks.preferredResponseLength ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
              <span>{locks.preferredResponseLength ? (isAr ? 'مثبت يدوياً' : 'Locked') : (isAr ? 'تلقائي' : 'Auto')}</span>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {[
              { id: 'concise', labelEn: 'Concise', labelAr: 'موجز وسريع' },
              { id: 'balanced', labelEn: 'Balanced', labelAr: 'متوازن' },
              { id: 'detailed', labelEn: 'Detailed', labelAr: 'شامل وتفصيلي' },
            ].map((opt) => {
              const isSelected = prefs.preferredResponseLength === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => handleUpdate('preferredResponseLength', opt.id as ResponseLengthPreference)}
                  className={`p-3 rounded-2xl border text-xs font-semibold transition-all ${
                    isSelected
                      ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 shadow-md shadow-cyan-950/40'
                      : 'bg-[#121526] border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  {isAr ? opt.labelAr : opt.labelEn}
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Modality Preference Selector */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-300">
              {isAr ? 'الوسيط الحسي المفضل للتواصل:' : 'Preferred Communication Modality:'}
            </label>
            <button
              onClick={() => handleToggleLock('preferredModality')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono transition-all border ${
                locks.preferredModality
                  ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                  : 'bg-slate-800 text-slate-500 border-slate-700'
              }`}
            >
              {locks.preferredModality ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
              <span>{locks.preferredModality ? (isAr ? 'مثبت يدوياً' : 'Locked') : (isAr ? 'تلقائي' : 'Auto')}</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              { id: 'text', icon: FileText, labelEn: 'Text First', labelAr: 'نصوص أولاً' },
              { id: 'audio', icon: Volume2, labelEn: 'Audio First', labelAr: 'صوتي أولاً' },
              { id: 'visual', icon: Eye, labelEn: 'Visual First', labelAr: 'بصري أولاً' },
              { id: 'hybrid', icon: Zap, labelEn: 'Hybrid', labelAr: 'مدمج (صوت + نص)' },
            ].map((opt) => {
              const isSelected = prefs.preferredModality === opt.id;
              const Icon = opt.icon;
              return (
                <button
                  key={opt.id}
                  onClick={() => handleUpdate('preferredModality', opt.id as ModalityPreference)}
                  className={`p-3 rounded-2xl border text-xs font-semibold transition-all flex flex-col items-center gap-2 ${
                    isSelected
                      ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300 shadow-md shadow-indigo-950/40'
                      : 'bg-[#121526] border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{isAr ? opt.labelAr : opt.labelEn}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Visual Density */}
        <div className="space-y-3">
          <label className="text-xs font-bold text-slate-300">
            {isAr ? 'الكثافة البصرية للشاشة:' : 'Visual Density & Spacing:'}
          </label>
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { id: 'compact', labelEn: 'Compact', labelAr: 'مضغوط ومقتضب' },
              { id: 'standard', labelEn: 'Standard', labelAr: 'افتراضي مريح' },
              { id: 'spacious', labelEn: 'Spacious', labelAr: 'متباعد وعريض' },
            ].map((opt) => {
              const isSelected = prefs.visualDensity === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => handleUpdate('visualDensity', opt.id as VisualDensityPreference, false)}
                  className={`p-3 rounded-2xl border text-xs font-semibold transition-all ${
                    isSelected
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                      : 'bg-[#121526] border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  {isAr ? opt.labelAr : opt.labelEn}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
          <button
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{isAr ? 'استعادة الافتراضيات' : 'Reset Defaults'}</span>
          </button>

          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white shadow-lg shadow-cyan-950/40 transition-all active:scale-95"
          >
            {isAr ? 'تم وحفظ التفضيلات' : 'Save & Done'}
          </button>
        </div>
      </div>
    </div>
  );
};
