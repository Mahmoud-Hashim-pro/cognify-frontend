import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bookmark, X, Copy, Trash2, ExternalLink, Sparkles } from 'lucide-react';
import { isArabicLocale, localize } from '../../lib/translations';
import { toast } from '../Toast';

export interface BookmarkedInsight {
  id: string;
  messageId: string;
  content: string;
  timestamp: string;
  pedagogyStyle?: string;
}

export interface ChatBookmarksDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  bookmarks: BookmarkedInsight[];
  onRemoveBookmark: (id: string) => void;
  onJumpToMessage?: (messageId: string) => void;
  language?: string;
}

export default function ChatBookmarksDrawer({
  isOpen,
  onClose,
  bookmarks,
  onRemoveBookmark,
  onJumpToMessage,
  language = 'Arabic',
}: ChatBookmarksDrawerProps) {
  const isAr = isArabicLocale(language);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(
      isAr ? 'تم نسخ الفكرة بنجاح' : 'Insight copied to clipboard',
      isAr ? 'تم النسخ' : 'Copied'
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: isAr ? -380 : 380, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: isAr ? -380 : 380, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 280 }}
            className={`fixed inset-y-0 ${isAr ? 'start-0' : 'end-0'} z-50 w-full max-w-sm bg-[#0E0610]/95 border-${isAr ? 'e' : 's'} border-[#4A1224]/70 shadow-2xl backdrop-blur-2xl flex flex-col ring-1 ring-[#E5A93C]/10`}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#4A1224]/50 bg-[#150917]/90">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#4A1224]/40 border border-[#E5A93C]/40 flex items-center justify-center text-[#E5A93C]">
                  <Bookmark className="w-4 h-4 fill-[#E5A93C]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {localize(language, 'Saved Insights & Notes', 'بنك الأفكار والإجابات المحفوظة')}
                  </h3>
                  <p className="text-[11px] text-[#E5A93C]/80">
                    {bookmarks.length} {localize(language, 'saved key points', 'نقاط محفوظة للمراجعة')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-[#E5A93C] hover:bg-[#4A1224]/30 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {bookmarks.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#150917] border border-[#4A1224]/50 flex items-center justify-center text-[#E5A93C]/60">
                    <Bookmark className="w-6 h-6" />
                  </div>
                  <p className="text-xs leading-relaxed font-medium">
                    {localize(
                      language,
                      'No saved insights yet. Click the bookmark icon on any AI explanation to pin it here for quick exam review.',
                      'لم تحفظ أي إجابات بعد. اضغط على أيقونة الحفظ (📌) أسفل أي شرح لتثبيته هنا والمراجعة السريعة ليلة الامتحان.'
                    )}
                  </p>
                </div>
              ) : (
                bookmarks.map((b) => (
                  <div
                    key={b.id}
                    className="p-3.5 rounded-2xl bg-[#150917] border border-[#4A1224]/50 hover:border-[#E5A93C]/50 transition-all space-y-2 group shadow-md"
                  >
                    <div className="flex items-center justify-between text-[10px] text-slate-400 border-b border-[#4A1224]/40 pb-1.5">
                      <span className="flex items-center gap-1 font-mono text-[#E5A93C]/80">
                        <Sparkles className="w-3 h-3 text-[#E5A93C]" />
                        {new Date(b.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {b.pedagogyStyle && (
                        <span className="px-1.5 py-0.5 rounded bg-[#2D0B16] text-[#E5A93C] border border-[#4A1224]/60 font-semibold text-[9px]">
                          {b.pedagogyStyle}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-200 line-clamp-4 leading-relaxed font-normal">
                      {b.content}
                    </p>
                    <div className="flex items-center justify-between pt-1 text-slate-400">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleCopy(b.content)}
                          className="p-1 rounded hover:text-[#E5A93C] hover:bg-[#4A1224]/30 transition-colors text-[11px] flex items-center gap-1"
                          title="Copy"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>{localize(language, 'Copy', 'نسخ')}</span>
                        </button>
                        {onJumpToMessage && (
                          <button
                            type="button"
                            onClick={() => {
                              onJumpToMessage(b.messageId);
                              onClose();
                            }}
                            className="p-1 rounded hover:text-[#E5A93C] hover:bg-[#4A1224]/30 transition-colors text-[11px] flex items-center gap-1"
                            title="Jump to message"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>{localize(language, 'Jump', 'انتقال')}</span>
                          </button>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemoveBookmark(b.id)}
                        className="p-1 rounded hover:text-rose-400 hover:bg-rose-500/10 transition-colors text-slate-500"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
