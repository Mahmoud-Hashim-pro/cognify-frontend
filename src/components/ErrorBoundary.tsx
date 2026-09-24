import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw, Sparkles } from 'lucide-react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

function isChunkError(error?: Error): boolean {
  if (!error) return false;
  const msg = error.message || '';
  const name = error.name || '';
  return (
    /Loading chunk|Failed to fetch dynamically imported module|dynamically imported module|Expected a JavaScript-or-Wasm module script|Strict MIME type checking|MIME type/i.test(msg) ||
    (name === 'TypeError' && /fetch|dynamically|import|module|script/i.test(msg))
  );
}

function isDOMNotFoundError(error?: Error): boolean {
  if (!error) return false;
  const msg = error.message || '';
  const name = error.name || '';
  return (
    name === 'NotFoundError' ||
    /removeChild|insertBefore|not a child of this node/i.test(msg)
  );
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);

    // Auto-heal chunk mismatches caused by fresh deployments
    if (isChunkError(error)) {
      const lastReload = Number(sessionStorage.getItem('cognify_eb_chunk_reload') || '0');
      const now = Date.now();
      if (now - lastReload > 12000) {
        sessionStorage.setItem('cognify_eb_chunk_reload', String(now));
        this.clearCachesAndReload();
        return;
      }
    }

    // Auto-heal DOM reconciliation collisions caused by Google Translate or accessibility extensions
    if (isDOMNotFoundError(error)) {
      const lastRecover = Number(sessionStorage.getItem('cognify_eb_dom_recover') || '0');
      const now = Date.now();
      if (now - lastRecover > 3000) {
        sessionStorage.setItem('cognify_eb_dom_recover', String(now));
        setTimeout(() => {
          this.setState({ hasError: false, error: undefined });
        }, 80);
        return;
      }
    }

    // Report to Sentry only if it's configured — lazy-loaded so it never bloats
    // the initial bundle. No-op when VITE_SENTRY_DSN isn't set.
    if ((import.meta as any).env?.VITE_SENTRY_DSN) {
      import('@sentry/react')
        .then((Sentry) =>
          Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } }),
        )
        .catch(() => { /* tracking optional */ });
    }
  }

  private clearCachesAndReload = () => {
    if (typeof caches !== 'undefined') {
      caches
        .keys()
        .then((names) => Promise.all(names.map((name) => caches.delete(name))))
        .catch(() => {})
        .finally(() => {
          window.location.reload();
        });
    } else {
      window.location.reload();
    }
  };

  private handleReset = () => {
    this.setState({ hasError: false });
    this.clearCachesAndReload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const isChunk = isChunkError(this.state.error);

      if (isChunk) {
        return (
          <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 font-sans">
            <div className="max-w-md w-full bg-slate-900 border border-cyan-500/30 rounded-2xl p-8 shadow-2xl shadow-cyan-500/10 text-center">
              <div className="w-16 h-16 bg-cyan-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Sparkles className="w-8 h-8 text-cyan-400" />
              </div>
              
              <h1 className="text-xl font-semibold text-white mb-2">New Version Available</h1>
              <p className="text-slate-300 text-sm mb-6 leading-relaxed">
                A fresh update was published. Click below to reload and apply the latest enhancements.
              </p>

              <button
                onClick={this.handleReset}
                className="w-full py-3 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20"
              >
                <RefreshCcw className="w-4 h-4" />
                Update & Reload
              </button>

              <p className="mt-6 text-[10px] text-slate-500 tracking-wide font-mono">
                Auto-update standby
              </p>
            </div>
          </div>
        );
      }

      // Always show a friendly, non-technical message to users.
      const errorMessage =
        "Something went wrong on our side. Please reload and try again.";

      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 font-sans" dir="rtl">
          <div className="max-w-md w-full bg-slate-900 border border-red-500/20 rounded-2xl p-8 shadow-2xl shadow-red-500/5 text-center">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            
            <h1 className="text-xl font-bold text-white mb-2">حدث خطأ غير متوقع</h1>
            <p className="text-slate-300 text-sm mb-6 leading-relaxed">
              يرجى إعادة تحميل الصفحة والمحاولة مرة أخرى. (إذا كنت تستخدم ترجمة جوجل التلقائية، يرجى إيقافها لأن الموقع يدعم العربية أصلاً).
            </p>

            <button
              onClick={this.handleReset}
              className="w-full py-3.5 px-4 bg-red-600 hover:bg-red-500 text-white rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95"
            >
              <RefreshCcw className="w-4 h-4" />
              إعادة تحميل الصفحة · Reload
            </button>

            <div className="mt-5 text-xs text-rose-300 tracking-wide font-mono bg-slate-950/80 p-3 rounded-xl border border-rose-500/20 text-left select-all" dir="ltr">
              <div className="font-bold text-rose-400">Ref: {this.state.error?.name || "APP_ERROR"}: {this.state.error?.message}</div>
              {this.state.error?.stack && (
                <div className="mt-2 text-[10px] text-slate-400 whitespace-pre-wrap max-h-24 overflow-y-auto">
                  {this.state.error.stack.split('\n').slice(0, 3).join('\n')}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
