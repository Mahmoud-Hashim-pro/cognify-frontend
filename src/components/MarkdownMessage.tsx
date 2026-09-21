import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Sparkles, ExternalLink, RefreshCw } from 'lucide-react';
import MicroCheckWidget, { MicroCheckData } from './chat/MicroCheckWidget';
import { getApiUrl } from '../config/api';

const SIGNS_RE = /^\[Signs:\s*.*\]$/i;
const MICRO_CHECK_RE = /:::micro-check\s*([\s\S]*?):::/g;

function MarkdownImage({ src, alt, ...props }: { src?: string; alt?: string; [key: string]: any }) {
  const [loaded, setLoaded] = React.useState(false);
  const [error, setError] = React.useState(false);
  const [currentSrc, setCurrentSrc] = React.useState(src || '');
  const [attemptedProxy, setAttemptedProxy] = React.useState(false);

  React.useEffect(() => {
    setCurrentSrc(src || '');
    setLoaded(false);
    setError(false);
    setAttemptedProxy(false);
  }, [src]);

  if (!src) return null;

  const handleImageError = () => {
    // 1st fallback: if direct image failed (e.g. ad-blocker or referer block), try same-origin proxy
    if (!attemptedProxy && src) {
      setAttemptedProxy(true);
      const proxyUrl = getApiUrl(`/api/proxy-image?url=${encodeURIComponent(src)}`);
      setCurrentSrc(proxyUrl);
    } else {
      // Both direct and proxy failed
      setError(true);
    }
  };

  const handleManualRetry = () => {
    setError(false);
    setLoaded(false);
    setAttemptedProxy(false);
    const separator = src.includes('?') ? '&' : '?';
    setCurrentSrc(`${src}${separator}seed=${Date.now()}`);
  };

  return (
    <div className="my-5 max-w-2xl rounded-3xl overflow-hidden border border-slate-800/80 bg-[#0A0C14] shadow-2xl backdrop-blur-xl group transition-all hover:border-cyan-500/40">
      <div className="relative min-h-[220px] flex items-center justify-center bg-[#07090F] overflow-hidden">
        {!loaded && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-cyan-400 bg-[#0A0C14]/90 backdrop-blur-md">
            <Sparkles className="w-6 h-6 animate-spin text-cyan-400" />
            <span className="text-xs font-black uppercase tracking-wider text-slate-300">
              Generating & Rendering Visual…
            </span>
          </div>
        )}
        {error ? (
          <div className="p-8 text-center text-xs text-rose-400 flex flex-col items-center gap-3">
            <span>Unable to render image preview directly.</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleManualRetry}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-xl font-bold text-xs transition-all cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Retry Generation</span>
              </button>
              <a
                href={src}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400 underline hover:text-cyan-300 font-bold text-xs"
              >
                Open direct image link ↗
              </a>
            </div>
          </div>
        ) : (
          <img
            src={currentSrc}
            alt={alt || 'Visual'}
            loading="lazy"
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
            onLoad={() => setLoaded(true)}
            onError={handleImageError}
            className={`w-full h-auto max-h-[520px] object-cover rounded-3xl transition-all duration-300 group-hover:scale-[1.01] ${loaded ? 'opacity-100' : 'opacity-0'}`}
            {...props}
          />
        )}
      </div>
      {alt && (
        <div className="px-4 py-2.5 bg-[#121524]/90 border-t border-slate-800/80 flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-200 truncate pr-2">{alt}</span>
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-bold text-cyan-400 hover:text-cyan-300 hover:underline shrink-0"
          >
            <span>Full Size</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
  );
}

/**
 * Renders an AI message as proper Markdown (GitHub-flavored: bold, lists,
 * tables, code, links), and transforms embedded formative :::micro-check blocks
 * into interactive 1-click comprehension widgets.
 */
export default function MarkdownMessage({
  content,
  language = 'English',
  uid,
  onPrerequisiteClick,
  fontScale = 'base',
  className = '',
}: {
  content: string;
  language?: string;
  uid?: string;
  onPrerequisiteClick?: (conceptId: string, conceptName: string) => void;
  fontScale?: 'sm' | 'base' | 'lg' | 'xl';
  className?: string;
}) {
  const cleanContent = content
    .split('\n')
    .filter((line) => !SIGNS_RE.test(line.trim()))
    .join('\n');

  // Parse micro-check blocks
  const parts: { type: 'text' | 'micro-check'; content: string; data?: MicroCheckData }[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  const regex = new RegExp(MICRO_CHECK_RE);

  while ((match = regex.exec(cleanContent)) !== null) {
    if (match.index > lastIdx) {
      parts.push({ type: 'text', content: cleanContent.slice(lastIdx, match.index) });
    }
    try {
      const parsed = JSON.parse(match[1].trim());
      if (parsed.question && Array.isArray(parsed.options) && typeof parsed.correctIndex === 'number') {
        parts.push({ type: 'micro-check', content: match[0], data: parsed });
      } else {
        parts.push({ type: 'text', content: match[0] });
      }
    } catch {
      parts.push({ type: 'text', content: match[0] });
    }
    lastIdx = regex.lastIndex;
  }

  if (lastIdx < cleanContent.length) {
    parts.push({ type: 'text', content: cleanContent.slice(lastIdx) });
  }

  const fontScaleClasses = {
    sm: 'text-[13px] leading-normal',
    base: 'text-[15px] leading-relaxed',
    lg: 'text-[17px] leading-relaxed',
    xl: 'text-[19px] leading-loose',
  }[fontScale] || 'text-[15px] leading-relaxed';

  return (
    <div className={`adaptive-response text-slate-100 ${fontScaleClasses} ${className}`}>
      {parts.map((part, i) => {
        if (part.type === 'micro-check' && part.data) {
          return (
            <MicroCheckWidget
              key={i}
              data={part.data}
              language={language}
              uid={uid}
              onPrerequisiteClick={onPrerequisiteClick}
            />
          );
        }
        return (
          <ReactMarkdown
            key={i}
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ node, ...p }: any) => <h2 className="text-xl font-black text-cyan-400 border-b border-slate-800/80 pb-2 mb-3 pt-4 tracking-tight" {...p} />,
              h2: ({ node, ...p }: any) => <h2 className="text-xl font-black text-cyan-400 border-b border-slate-800/80 pb-2 mb-3 pt-4 tracking-tight" {...p} />,
              h3: ({ node, ...p }: any) => <h3 className="text-lg font-bold text-white mb-2 pt-3" {...p} />,
              p: ({ node, ...p }: any) => <p className="mb-4 leading-relaxed text-slate-200" {...p} />,
              ul: ({ node, ...p }: any) => <ul className="list-disc ms-6 mb-4 space-y-1.5 marker:text-cyan-400 text-slate-200" {...p} />,
              ol: ({ node, ...p }: any) => <ol className="list-decimal ms-6 mb-4 space-y-1.5 marker:text-cyan-400 text-slate-200" {...p} />,
              li: ({ node, ...p }: any) => <li className="leading-relaxed" {...p} />,
              a: ({ node, href, ...p }: any) => {
                const isSafe = href && !href.trim().toLowerCase().startsWith('javascript:') && !href.trim().toLowerCase().startsWith('data:');
                return (
                  <a
                    className="text-cyan-400 underline underline-offset-4 decoration-cyan-500/40 hover:text-cyan-300 transition-colors font-semibold"
                    target="_blank"
                    rel="noopener noreferrer"
                    href={isSafe ? href : '#'}
                    {...p}
                  />
                );
              },
              strong: ({ node, ...p }: any) => <strong className="font-black text-white" {...p} />,
              em: ({ node, ...p }: any) => <em className="italic text-slate-300" {...p} />,
              hr: ({ node, ...p }: any) => <hr className="my-5 border-slate-800" {...p} />,
              blockquote: ({ node, ...p }: any) => <blockquote className="border-s-4 border-cyan-500/60 bg-[#0A0C14]/80 px-4 py-3 rounded-e-2xl italic text-slate-300 my-4 shadow-inner" {...p} />,
              pre: ({ node, ...p }: any) => <pre className="bg-[#0B0E17] text-cyan-300 border border-slate-800/90 rounded-2xl p-4 overflow-x-auto text-xs my-4 shadow-2xl custom-scrollbar" {...p} />,
              code: ({ node, className, children, ...p }: any) => {
                const isBlock = (className && className.includes('language-')) || String(children).includes('\n');
                return isBlock ? (
                  <code className={`font-mono text-cyan-300 ${className || ''}`} {...p}>{children}</code>
                ) : (
                  <code className="px-2 py-0.5 rounded-lg bg-[#0A0C14] border border-slate-800 text-cyan-300 text-[0.85em] font-mono shadow-inner" {...p}>{children}</code>
                );
              },
              table: ({ node, ...p }: any) => <div className="overflow-x-auto my-5 rounded-2xl border border-slate-800 bg-[#0A0C14]/60"><table className="w-full text-xs text-slate-200 border-collapse" {...p} /></div>,
              th: ({ node, ...p }: any) => <th className="border-b border-slate-800 bg-[#0E111D] px-4 py-3 text-start font-black text-cyan-300 uppercase tracking-wider" {...p} />,
              td: ({ node, ...p }: any) => <td className="border-b border-slate-800/50 px-4 py-2.5" {...p} />,
              img: ({ node, ...p }: any) => <MarkdownImage {...p} />,
            }}
          >
            {part.content}
          </ReactMarkdown>
        );
      })}
    </div>
  );
}

