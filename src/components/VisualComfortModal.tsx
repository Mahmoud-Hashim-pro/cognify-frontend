import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BookOpen,
  Eye,
  X,
  Check,
  Palette,
  Sun,
  Sliders,
  Sparkles,
  Volume2
} from 'lucide-react';
import {
  loadVisualComfortSettings,
  saveVisualComfortSettings,
  VisualComfortSettings,
} from '../lib/neurodiversityEngine';
import { speak } from '../lib/tts';
import { isArabicLocale } from '../lib/translations';

interface VisualComfortModalProps {
  isOpen: boolean;
  onClose: () => void;
  language?: string;
}

export default function VisualComfortModal({ isOpen, onClose, language = 'Arabic' }: VisualComfortModalProps) {
  const isAr = isArabicLocale(language);
  const isFr = language === 'French';

  const [settings, setSettings] = useState<VisualComfortSettings>(loadVisualComfortSettings());

  const t = (en: string, ar: string, fr?: string) => {
    if (isAr) return ar;
    if (isFr && fr) return fr;
    return en;
  };

  useEffect(() => {
    if (isOpen) {
      setSettings(loadVisualComfortSettings());
    }
  }, [isOpen]);

  const updateSetting = (updates: Partial<VisualComfortSettings>) => {
    const updated = { ...settings, ...updates };
    setSettings(updated);
    saveVisualComfortSettings(updated);

    // Apply globally to body/document
    if (typeof document !== 'undefined') {
      if (updated.isDyslexiaFont) {
        document.body.classList.add('dyslexia-font-active');
      } else {
        document.body.classList.remove('dyslexia-font-active');
      }
    }
  };

  const speakSample = () => {
    const text = isAr
      ? 'القراءة الميسرة تجعل الكلمات أكثر وضوحاً وتمنح عينيك الراحة التامة.'
      : 'Visual comfort tools enhance readability and reduce cognitive strain.';
    speak(text, isAr ? 'Arabic' : 'English');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150"
        dir={isAr ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-sm sm:text-base text-white">
                {t('Visual Comfort & Dyslexia Suite', 'أدوات الراحة البصرية وتيسير القراءة (Dyslexia)', 'Confort Visuel')}
              </h3>
              <p className="text-[11px] text-slate-400">
                {t('Universal tools for dyslexia, visual fatigue & contrast', 'أدوات عامة لتخفيف الإجهاد البصري وتحسين القراءة لكافة المستخدمين')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-all"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toggles Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* High-Legibility Font Toggle */}
          <button
            onClick={() => updateSetting({ isDyslexiaFont: !settings.isDyslexiaFont })}
            className={`p-3.5 rounded-2xl border text-start flex items-center justify-between transition-all ${
              settings.isDyslexiaFont
                ? 'bg-indigo-600/30 border-indigo-400 text-indigo-200'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div>
              <div className="font-bold text-xs text-white">{t('Dyslexia-Friendly Font', 'خط عالي التباين وواسع (Dyslexia)')}</div>
              <div className="text-[10px] text-slate-400">{t('Increases letter and word spacing', 'يوسع المسافات بين الحروف لمنع تداخل الكلمات')}</div>
            </div>
            <span className="text-2xl">🔤</span>
          </button>

          {/* Reading Ruler Toggle */}
          <button
            onClick={() => updateSetting({ showReadingRuler: !settings.showReadingRuler })}
            className={`p-3.5 rounded-2xl border text-start flex items-center justify-between transition-all ${
              settings.showReadingRuler
                ? 'bg-amber-600/30 border-amber-400 text-amber-200'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div>
              <div className="font-bold text-xs text-white">{t('Guided Reading Ruler', 'مسطرة القراءة المضيئة')}</div>
              <div className="text-[10px] text-slate-400">{t('Focuses on one line at a time', 'تظليل السطر المقروء وتتبع حركة المؤشر')}</div>
            </div>
            <span className="text-2xl">📏</span>
          </button>
        </div>

        {/* Comfort Tint Selector */}
        <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
          <label className="text-xs text-slate-300 font-bold flex items-center gap-1.5">
            <Palette className="w-4 h-4 text-indigo-400" />
            <span>{t('Screen Tint (Reduces Glare & Irlen Strain):', 'لون خلفية هادئ ومريح للعين (يقلل الوهج البصري):')}</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { id: 'none', label: t('Default Dark', 'داكن عادي'), color: 'bg-slate-900 border-slate-700 text-white' },
              { id: 'cream', label: t('Warm Cream', 'كريمي دافئ'), color: 'bg-amber-950/60 border-amber-500/50 text-amber-200' },
              { id: 'mint', label: t('Soft Mint', 'أخضر نعناعي'), color: 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200' },
              { id: 'rose', label: t('Gentle Rose', 'وردي خفيف'), color: 'bg-rose-950/60 border-rose-500/50 text-rose-200' },
            ].map((tint) => (
              <button
                key={tint.id}
                onClick={() => updateSetting({ tintColor: tint.id as any })}
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all text-center ${tint.color} ${
                  settings.tintColor === tint.id ? 'ring-2 ring-indigo-400 shadow-lg scale-102' : 'opacity-70 hover:opacity-100'
                }`}
              >
                {tint.label}
              </button>
            ))}
          </div>
        </div>

        {/* Live Preview Box */}
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-bold">{t('Live Reading Preview:', 'معاينة القراءة الفورية:')}</span>
            <button
              onClick={speakSample}
              className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-bold"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>{t('Listen', 'استمع')}</span>
            </button>
          </div>
          <p
            className={`text-sm leading-relaxed text-slate-200 ${
              settings.isDyslexiaFont ? 'font-mono tracking-wider' : ''
            }`}
          >
            {isAr
              ? 'كل قارئ في كوجنيفاي يستحق تجربة مريحة تماماً. المسطرة المضيئة تمنع القفز بين السطور، والخط الواسع يمنح العقل تركيزاً سلساً.'
              : 'Every reader in Cognify deserves total visual ease. Guided rulers eliminate line-skipping, and spacious typography unlocks smooth focus.'}
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg transition-all"
          >
            {t('Done', 'حفظ وإغلاق')}
          </button>
        </div>
      </div>
    </div>
  );
}
