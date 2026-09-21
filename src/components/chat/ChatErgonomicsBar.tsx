import React from 'react';
import { ZoomIn, ZoomOut, SunMedium, Moon, Search, Bookmark, Eye } from 'lucide-react';
import { isArabicLocale, localize } from '../../lib/translations';

export type FontScale = 'sm' | 'base' | 'lg' | 'xl';

export interface ChatErgonomicsBarProps {
  fontScale: FontScale;
  onChangeFontScale: (scale: FontScale) => void;
  isEyeComfort: boolean;
  onToggleEyeComfort: () => void;
  onOpenSearch: () => void;
  bookmarksCount: number;
  onOpenBookmarks: () => void;
  language?: string;
}

const SCALE_ORDER: FontScale[] = ['sm', 'base', 'lg', 'xl'];

export default function ChatErgonomicsBar({
  fontScale,
  onChangeFontScale,
  isEyeComfort,
  onToggleEyeComfort,
  onOpenSearch,
  bookmarksCount,
  onOpenBookmarks,
  language = 'Arabic',
}: ChatErgonomicsBarProps) {
  const isAr = isArabicLocale(language);

  const currentIndex = SCALE_ORDER.indexOf(fontScale);

  const handleDecreaseFont = () => {
    if (currentIndex > 0) {
      onChangeFontScale(SCALE_ORDER[currentIndex - 1]);
    }
  };

  const handleIncreaseFont = () => {
    if (currentIndex < SCALE_ORDER.length - 1) {
      onChangeFontScale(SCALE_ORDER[currentIndex + 1]);
    }
  };

  const scaleLabels: Record<FontScale, { en: string; ar: string }> = {
    sm: { en: 'Small (14px)', ar: 'صغير (14px)' },
    base: { en: 'Normal (16px)', ar: 'عادي (16px)' },
    lg: { en: 'Comfort (18px)', ar: 'مريح (18px)' },
    xl: { en: 'Large (20px)', ar: 'كبير (20px)' },
  };

  return (
    <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-[#0F1322]/80 border border-slate-800/80 shadow-md backdrop-blur-md">
      {/* Font Scaler Controls */}
      <div className="flex items-center bg-[#131728] border border-slate-800 rounded-xl p-0.5">
        <button
          type="button"
          onClick={handleDecreaseFont}
          disabled={currentIndex === 0}
          className="p-1 rounded-lg text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
          title={localize(language, 'Decrease font size (A-)', 'تصغير حجم الخط (A-)')}
          aria-label="Decrease font size"
        >
          <span className="text-[11px] font-black leading-none px-1">A-</span>
        </button>

        <span
          className="px-1.5 text-[10px] font-bold text-cyan-300 font-mono select-none"
          title={localize(language, scaleLabels[fontScale].en, scaleLabels[fontScale].ar)}
        >
          {fontScale === 'sm' ? '85%' : fontScale === 'base' ? '100%' : fontScale === 'lg' ? '115%' : '130%'}
        </span>

        <button
          type="button"
          onClick={handleIncreaseFont}
          disabled={currentIndex === SCALE_ORDER.length - 1}
          className="p-1 rounded-lg text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
          title={localize(language, 'Increase font size (A+)', 'تكبير حجم الخط (A+)')}
          aria-label="Increase font size"
        >
          <span className="text-[11px] font-black leading-none px-1">A+</span>
        </button>
      </div>

      {/* Eye-Comfort Warm Sepia Mode Toggle */}
      <button
        type="button"
        onClick={onToggleEyeComfort}
        className={`flex items-center gap-1 px-2 py-1 rounded-xl text-xs font-bold transition-all border ${
          isEyeComfort
            ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-md shadow-amber-500/10'
            : 'bg-[#131728] border-slate-800 text-slate-400 hover:text-amber-300 hover:border-amber-500/30'
        }`}
        title={localize(
          language,
          isEyeComfort ? 'Disable Warm Reading Mode' : 'Enable Eye-Comfort Warm Reading Mode (Anti-Blue Light)',
          isEyeComfort ? 'تعطيل وضع القراءة الدافئ' : 'تفعيل وضع القراءة الدافئ المريح للعين (تقليل الضوء الأزرق)'
        )}
      >
        <Eye className={`w-3.5 h-3.5 ${isEyeComfort ? 'text-amber-400 fill-amber-400/20' : 'text-slate-400'}`} />
        <span className="hidden md:inline text-[10px]">
          {isEyeComfort
            ? localize(language, 'Warm Hue', 'قراءة دافئة')
            : localize(language, 'Comfort', 'راحة العين')}
        </span>
      </button>

      {/* In-Session Quick Search */}
      <button
        type="button"
        onClick={onOpenSearch}
        className="p-1.5 rounded-xl bg-[#131728] border border-slate-800 text-slate-400 hover:text-cyan-300 hover:border-cyan-500/40 transition-colors"
        title={localize(language, 'Search within this chat session', 'بحث داخل هذه المحادثة')}
        aria-label="Search within chat"
      >
        <Search className="w-3.5 h-3.5" />
      </button>

      {/* Bookmarks Drawer Trigger */}
      <button
        type="button"
        onClick={onOpenBookmarks}
        className={`flex items-center gap-1 px-2 py-1 rounded-xl text-xs font-bold transition-all border ${
          bookmarksCount > 0
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
            : 'bg-[#131728] border-slate-800 text-slate-400 hover:text-slate-200'
        }`}
        title={localize(language, 'Open saved key takeaways', 'فتح بنك الأفكار والإجابات المحفوظة')}
      >
        <Bookmark className={`w-3.5 h-3.5 ${bookmarksCount > 0 ? 'fill-amber-400 text-amber-400' : 'text-slate-400'}`} />
        {bookmarksCount > 0 && (
          <span className="text-[10px] font-mono px-1 py-0.2 rounded-full bg-amber-500/20 text-amber-300">
            {bookmarksCount}
          </span>
        )}
      </button>
    </div>
  );
}
