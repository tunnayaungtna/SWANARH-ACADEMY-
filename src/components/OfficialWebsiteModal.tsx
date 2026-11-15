import React, { useState, useEffect, useCallback } from 'react';
import { AcademyLogo } from './AcademyLogo';
import { Globe, ExternalLink, RotateCw, Copy, Check, X } from 'lucide-react';

export const OFFICIAL_ACADEMY_WEBSITE_URL = 'https://www.swanarhacademy.com/';

interface OfficialWebsiteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// In-memory cache so reopening the modal within the same session is instant
let cachedWebsiteSrcDoc: string | null = null;

function buildPlayableSrcDoc(rawHtml: string): string {
  const injectedHead = `
    <base href="${OFFICIAL_ACADEMY_WEBSITE_URL}" />
    <script>
      (function() {
        var origPush = history.pushState;
        var origReplace = history.replaceState;
        history.pushState = function(state, title, url) {
          try {
            return origPush.call(history, state, title, url);
          } catch (e) {
            try {
              if (typeof url === 'string' && url.indexOf('#') !== -1) {
                window.location.hash = url.slice(url.indexOf('#'));
              }
            } catch (_) {}
          }
        };
        history.replaceState = function(state, title, url) {
          try {
            return origReplace.call(history, state, title, url);
          } catch (e) {
            try {
              if (typeof url === 'string' && url.indexOf('#') !== -1) {
                window.location.hash = url.slice(url.indexOf('#'));
              }
            } catch (_) {}
          }
        };
        document.addEventListener('click', function(e) {
          var anchor = e.target && e.target.closest ? e.target.closest('a') : null;
          if (!anchor) return;
          var href = anchor.getAttribute('href') || '';
          if (
            href.indexOf('http://') === 0 ||
            href.indexOf('https://') === 0 ||
            href.indexOf('mailto:') === 0 ||
            href.indexOf('tel:') === 0
          ) {
            anchor.setAttribute('target', '_blank');
            anchor.setAttribute('rel', 'noopener noreferrer');
          }
        }, true);
      })();
    </script>
  `;

  if (/<head[^>]*>/i.test(rawHtml)) {
    return rawHtml.replace(/<head[^>]*>/i, (match) => `${match}${injectedHead}`);
  }
  return `<!DOCTYPE html><html><head>${injectedHead}</head><body>${rawHtml}</body></html>`;
}

export const OfficialWebsiteModal: React.FC<OfficialWebsiteModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [iframeKey, setIframeKey] = useState(0);
  const [srcDoc, setSrcDoc] = useState<string | null>(() => cachedWebsiteSrcDoc);
  const [isLoading, setIsLoading] = useState<boolean>(!cachedWebsiteSrcDoc);
  const [loadError, setLoadError] = useState<boolean>(false);
  const [copied, setCopied] = useState(false);

  const loadWebsiteContent = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh && cachedWebsiteSrcDoc) {
      setSrcDoc(cachedWebsiteSrcDoc);
      setIsLoading(false);
      setLoadError(false);
      return;
    }

    setIsLoading(true);
    setLoadError(false);
    try {
      const response = await fetch(OFFICIAL_ACADEMY_WEBSITE_URL, {
        method: 'GET',
        mode: 'cors',
        cache: forceRefresh ? 'reload' : 'default',
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const htmlText = await response.text();
      const preparedDoc = buildPlayableSrcDoc(htmlText);
      cachedWebsiteSrcDoc = preparedDoc;
      setSrcDoc(preparedDoc);
      setIsLoading(false);
    } catch {
      setLoadError(true);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadWebsiteContent(false);
    }
  }, [isOpen, loadWebsiteContent]);

  if (!isOpen) return null;

  const handleReload = () => {
    setIframeKey((prev) => prev + 1);
    loadWebsiteContent(true);
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(OFFICIAL_ACADEMY_WEBSITE_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-6xl h-[92dvh] bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
        {/* Top Toolbar: In-App Viewer Controls + Open in New Tab Option */}
        <div className="px-3 sm:px-5 py-2.5 sm:py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="neu-inset-sm p-1 rounded-xl shrink-0">
              <AcademyLogo size="sm" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate">
                  SwanArh Academy Official Website
                </h3>
              </div>
              <p className="text-[10px] sm:text-[11px] font-mono text-emerald-700 dark:text-emerald-400 truncate">
                {OFFICIAL_ACADEMY_WEBSITE_URL}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 ml-auto">
            <button
              type="button"
              onClick={handleReload}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold transition-colors cursor-pointer"
              title="Website ပြန်လည်ဖွင့်ရန် (Reload)"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-600' : ''}`} />
              <span className="hidden sm:inline">Reload</span>
            </button>

            <button
              type="button"
              onClick={handleCopyUrl}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold transition-colors cursor-pointer"
              title="Website Link ကူးယူရန်"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Copy Link</span>
                </>
              )}
            </button>

            <a
              href={OFFICIAL_ACADEMY_WEBSITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] sm:text-xs font-bold shadow-xs transition-colors cursor-pointer"
              title="Browser Tab အသစ်ဖြင့် ဖွင့်ကြည့်ရန်"
            >
              <span>Tab အသစ်ဖြင့် ဖွင့်ရန်</span>
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
            </a>

            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-200/80 dark:bg-slate-800 hover:bg-rose-100 dark:hover:bg-rose-950/60 text-slate-700 dark:text-slate-200 hover:text-rose-600 dark:hover:text-rose-400 text-[11px] font-bold transition-colors cursor-pointer"
              title="ပိတ်မည် (Close)"
            >
              <X className="w-4 h-4" />
              <span className="hidden sm:inline">ပိတ်မည်</span>
            </button>
          </div>
        </div>

        {/* Embedded In-App Website Viewport */}
        <div className="relative flex-1 w-full bg-white overflow-hidden">
          {isLoading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-50/95 dark:bg-slate-900/95 text-xs text-slate-600 dark:text-slate-300">
              <div className="w-8 h-8 rounded-full border-3 border-emerald-600 border-t-transparent animate-spin" />
              <div className="font-semibold">
                သင်တန်း Website (www.swanarhacademy.com) ကို ဖွင့်နေပါသည်...
              </div>
            </div>
          )}

          {loadError && !srcDoc ? (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center gap-4 bg-slate-50 dark:bg-slate-900">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Globe className="w-6 h-6" />
              </div>
              <div className="space-y-1 max-w-md">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  စွမ်းအားသင်တန်း တရားဝင် ဝက်ဘ်ဆိုဒ် (www.swanarhacademy.com)
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  အင်တာနက်လိုင်း အခြေအနေကြောင့် App အတွင်း တိုက်ရိုက်ဆွဲယူရာတွင် ကြန့်ကြာနေပါသည်။ အောက်ပါခလုတ်ကို နှိပ်၍ ပြန်လည်ဖွင့်နိုင်သလို Browser Tab အသစ်ဖြင့်လည်း တိုက်ရိုက်ဖွင့်ကြည့်နိုင်ပါသည်။
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={handleReload}
                  className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>ပြန်လည်ဖွင့်ရန် (Retry)</span>
                </button>
                <a
                  href={OFFICIAL_ACADEMY_WEBSITE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <span>Browser Tab အသစ်ဖြင့် ဖွင့်ရန်</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          ) : (
            srcDoc && (
              <iframe
                key={iframeKey}
                srcDoc={srcDoc}
                title="SwanArh Academy Official Website"
                onLoad={() => setIsLoading(false)}
                className="w-full h-full border-0 bg-white"
                allow="fullscreen; clipboard-write"
              />
            )
          )}
        </div>

        {/* Bottom Helper Bar */}
        <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-slate-400 shrink-0">
          <span>
            💡 Classroom App ထဲမှ ထွက်စရာမလိုဘဲ သင်တန်း Website ကို တိုက်ရိုက် ကြည့်ရှုနိုင်ပါသည်။
          </span>
          <a
            href={OFFICIAL_ACADEMY_WEBSITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-emerald-700 dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
          >
            <span>မျက်နှာပြင်အပြည့် Browser ဖြင့်ဖွင့်ရန် (www.swanarhacademy.com)</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
};
