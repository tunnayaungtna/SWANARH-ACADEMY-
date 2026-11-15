import React, { useState, useEffect, useCallback } from 'react';
import { AcademyLogo } from './AcademyLogo';
import { Globe, ExternalLink, RotateCw, Copy, Check, X } from 'lucide-react';

export const OFFICIAL_ACADEMY_WEBSITE_URL = 'https://www.swanarhacademy.com/';
const OFFICIAL_ORIGIN = 'https://www.swanarhacademy.com';

interface OfficialWebsiteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// In-memory cache so reopening the modal within the same session is instant (0ms)
let cachedWebsiteSrcDoc: string | null = null;

function patchWebsiteBundleJs(rawJs: string): string {
  return rawJs
    // Route React Router's browser history & router instance to our virtual window
    .replace(
      /history:([A-Za-z0-9_$]+)\(\{window:([A-Za-z0-9_$]+)\?\.window\}\)/g,
      'history:$1({window:window.__swanarhVirtualWindow})'
    )
    .replace(
      /,window:([A-Za-z0-9_$]+)\?\.window,/g,
      ',window:window.__swanarhVirtualWindow,'
    )
    // Ensure Link relative URL checks use the virtual window location href
    .replace(
      /new URL\(window\.location\.href\)/g,
      'new URL(window.__swanarhVirtualWindow.location.href)'
    )
    // Ensure all relative photo paths resolve directly to the official domain
    .replace(/(["'`])\/photos\//g, `$1${OFFICIAL_ORIGIN}/photos/`);
}

function buildPlayableSrcDoc(rawHtml: string, patchedBundleJs?: string): string {
  const virtualEnvScript = `
    <base href="${OFFICIAL_ACADEMY_WEBSITE_URL}" />
    <script>
      (function() {
        var ORIGIN = "${OFFICIAL_ORIGIN}";
        var OrigURL = window.URL;

        function SafeURL(url, base) {
          if (
            base === "about:srcdoc" ||
            base === "null" ||
            (typeof base === "string" && base.indexOf("about:") === 0)
          ) {
            base = ORIGIN + "/";
          }
          if (typeof url === "string" && url.indexOf("about:srcdoc") === 0) {
            url = url.replace("about:srcdoc", ORIGIN);
          }
          return base !== undefined ? new OrigURL(url, base) : new OrigURL(url);
        }
        SafeURL.prototype = OrigURL.prototype;
        Object.setPrototypeOf(SafeURL, OrigURL);
        window.URL = SafeURL;

        var historyStack = [
          {
            pathname: "/",
            search: "",
            hash: "",
            state: { idx: 0, key: "default", usr: null }
          }
        ];
        var currentIndex = 0;

        function parseTargetUrl(url) {
          if (!url) return historyStack[currentIndex];
          try {
            var parsed = new OrigURL(String(url), ORIGIN);
            return {
              pathname: parsed.pathname || "/",
              search: parsed.search || "",
              hash: parsed.hash || ""
            };
          } catch (_) {
            return { pathname: "/", search: "", hash: "" };
          }
        }

        var virtualLocation = {
          get href() {
            var cur = historyStack[currentIndex];
            return ORIGIN + cur.pathname + cur.search + cur.hash;
          },
          set href(val) {
            if (typeof val === "string" && (val.indexOf("tel:") === 0 || val.indexOf("mailto:") === 0 || val.indexOf("http") === 0)) {
              window.open(val, "_blank", "noopener,noreferrer");
            }
          },
          origin: ORIGIN,
          protocol: "https:",
          host: "www.swanarhacademy.com",
          hostname: "www.swanarhacademy.com",
          port: "",
          get pathname() {
            return historyStack[currentIndex].pathname;
          },
          get search() {
            return historyStack[currentIndex].search;
          },
          get hash() {
            return historyStack[currentIndex].hash;
          },
          assign: function(url) {
            if (typeof url === "string" && (url.indexOf("http") === 0 && url.indexOf(ORIGIN) !== 0)) {
              window.open(url, "_blank", "noopener,noreferrer");
              return;
            }
            virtualHistory.pushState({ idx: currentIndex + 1 }, "", url);
            window.dispatchEvent(new PopStateEvent("popstate", { state: virtualHistory.state }));
          },
          replace: function(url) {
            virtualHistory.replaceState({ idx: currentIndex }, "", url);
            window.dispatchEvent(new PopStateEvent("popstate", { state: virtualHistory.state }));
          },
          reload: function() {}
        };

        var virtualHistory = {
          get length() {
            return historyStack.length;
          },
          get state() {
            return historyStack[currentIndex].state;
          },
          scrollRestoration: "auto",
          pushState: function(state, _title, url) {
            var parsed = parseTargetUrl(url);
            historyStack = historyStack.slice(0, currentIndex + 1);
            historyStack.push({
              pathname: parsed.pathname,
              search: parsed.search,
              hash: parsed.hash,
              state: state !== undefined ? state : { idx: historyStack.length }
            });
            currentIndex = historyStack.length - 1;
            window.scrollTo(0, 0);
          },
          replaceState: function(state, _title, url) {
            var cur = historyStack[currentIndex];
            var parsed = url !== undefined && url !== "" ? parseTargetUrl(url) : cur;
            historyStack[currentIndex] = {
              pathname: parsed.pathname,
              search: parsed.search,
              hash: parsed.hash,
              state: state !== undefined ? state : cur.state
            };
          },
          go: function(delta) {
            var nextIdx = currentIndex + (Number(delta) || 0);
            if (nextIdx >= 0 && nextIdx < historyStack.length) {
              currentIndex = nextIdx;
              window.dispatchEvent(new PopStateEvent("popstate", { state: historyStack[currentIndex].state }));
            }
          },
          back: function() {
            this.go(-1);
          },
          forward: function() {
            this.go(1);
          }
        };

        var memorySessionStorage = {};
        var safeSessionStorage = {
          getItem: function(k) {
            return Object.prototype.hasOwnProperty.call(memorySessionStorage, k) ? memorySessionStorage[k] : null;
          },
          setItem: function(k, v) {
            memorySessionStorage[k] = String(v);
          },
          removeItem: function(k) {
            delete memorySessionStorage[k];
          }
        };

        var virtualWindow = new Proxy(window, {
          get: function(target, prop) {
            if (prop === "location") return virtualLocation;
            if (prop === "history") return virtualHistory;
            if (prop === "sessionStorage") return safeSessionStorage;
            if (prop === "origin") return ORIGIN;
            var value = Reflect.get(target, prop, target);
            return typeof value === "function" ? value.bind(target) : value;
          }
        });

        window.__swanarhVirtualWindow = virtualWindow;

        try {
          Object.defineProperty(Document.prototype, "defaultView", {
            configurable: true,
            get: function() {
              return virtualWindow;
            }
          });
        } catch (_) {}

        document.addEventListener(
          "click",
          function(e) {
            var anchor = e.target && e.target.closest ? e.target.closest("a") : null;
            if (!anchor) return;
            var href = anchor.getAttribute("href") || "";
            if (
              href.indexOf("http://") === 0 ||
              href.indexOf("https://") === 0 ||
              href.indexOf("mailto:") === 0 ||
              href.indexOf("tel:") === 0
            ) {
              anchor.setAttribute("target", "_blank");
              anchor.setAttribute("rel", "noopener noreferrer");
            }
          },
          true
        );
      })();
    </script>
  `;

  let processedHtml = rawHtml
    // Remove Cloudflare beacon script which is not needed inside embedded preview
    .replace(/<script[^>]*static\.cloudflareinsights\.com[^>]*><\/script>/gi, '');

  if (patchedBundleJs) {
    const safeInlineJs = patchedBundleJs.replace(/<\/script/gi, '<\\/script');
    processedHtml = processedHtml.replace(
      /<script[^>]+src=["']\/assets\/[^"']+\.js["'][^>]*><\/script>/i,
      () => `<script type="module">${safeInlineJs}</script>`
    );
  }

  if (/<head[^>]*>/i.test(processedHtml)) {
    return processedHtml.replace(/<head[^>]*>/i, (match) => `${match}${virtualEnvScript}`);
  }
  return `<!DOCTYPE html><html><head>${virtualEnvScript}</head><body>${processedHtml}</body></html>`;
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

      let patchedBundleJs: string | undefined;
      const scriptMatch = htmlText.match(
        /<script[^>]+src=["'](\/assets\/[^"']+\.js)["'][^>]*><\/script>/i
      );
      if (scriptMatch && scriptMatch[1]) {
        const scriptUrl = `${OFFICIAL_ORIGIN}${scriptMatch[1]}`;
        const jsResp = await fetch(scriptUrl, {
          method: 'GET',
          mode: 'cors',
          cache: forceRefresh ? 'reload' : 'default',
        });
        if (jsResp.ok) {
          const rawJs = await jsResp.text();
          patchedBundleJs = patchWebsiteBundleJs(rawJs);
        }
      }

      const preparedDoc = buildPlayableSrcDoc(htmlText, patchedBundleJs);
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
            💡 Classroom App ထဲမှ ထွက်စရာမလိုဘဲ သင်တန်း Website ရှိ Courses, Gallery, About, Contact စာမျက်နှာအားလုံးကို တိုက်ရိုက် ကြည့်ရှုနိုင်ပါသည်။
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
