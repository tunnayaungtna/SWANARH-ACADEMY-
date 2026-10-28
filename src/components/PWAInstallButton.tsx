import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  usePWAInstall,
  useOnlineStatus,
  openInSystemBrowserForInstall,
} from '../hooks/usePWAInstall';
import { useBackHandler } from '../utils/backNavigation';
import {
  Download,
  Smartphone,
  Monitor,
  CheckCircle2,
  X,
  Sparkles,
  Loader2,
  Share,
  PlusSquare,
  MoreVertical,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';

interface PWAInstallButtonProps {
  variant?: 'navbar' | 'mobile-drawer' | 'login' | 'login-device-card';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'navbar' }) => {
  const {
    isInstallable,
    isInstalled,
    wasPreviouslyInstalled,
    isIOS,
    isAndroid,
    isInAppBrowser,
    deviceLabel,
    isInIframe,
    install,
  } = usePWAInstall();

  const [showInstallModal, setShowInstallModal] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const getDirectAutoInstallUrl = () => {
    if (typeof window === 'undefined') return '/?auto_install=1';
    try {
      const url = new URL(window.location.origin + window.location.pathname);
      url.searchParams.set('auto_install', '1');
      return url.toString();
    } catch {
      return window.location.href;
    }
  };

  // If opened in a full browser tab with ?auto_install=1, automatically open the Install Modal
  useEffect(() => {
    if (variant !== 'login-device-card' || isInstalled) return;
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('auto_install') === '1' || params.get('install') === '1') {
        const url = new URL(window.location.href);
        url.searchParams.delete('auto_install');
        url.searchParams.delete('install');
        window.history.replaceState({}, '', url.toString());
        setShowInstallModal(true);
      }
    } catch {
      // ignore
    }
  }, [variant, isInstalled]);

  useBackHandler(showInstallModal, () => setShowInstallModal(false));

  if (isInstalled) {
    return null;
  }

  const handleCopyUrl = async () => {
    try {
      const cleanUrl = window.location.origin + window.location.pathname;
      await navigator.clipboard.writeText(cleanUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleInstallClick = async () => {
    if (isInstalling) return;

    // If native beforeinstallprompt is available right now, trigger the OS install dialog immediately!
    if (isInstallable) {
      setIsInstalling(true);
      try {
        const outcome = await install();
        if (outcome === 'accepted') {
          setInstallSuccess(true);
          setShowInstallModal(true);
          setTimeout(() => {
            setShowInstallModal(false);
          }, 2200);
          return;
        }
        if (outcome === 'dismissed') {
          return;
        }
      } finally {
        setIsInstalling(false);
      }
    }

    // Otherwise, immediately open the clean device-specific Install Modal (0ms delay, no fake spinner!)
    setShowInstallModal(true);
  };

  const DeviceIcon = isIOS || isAndroid ? Smartphone : Monitor;

  const installModalNode =
    showInstallModal && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
            onClick={() => setShowInstallModal(false)}
          >
            <div
              className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setShowInstallModal(false)}
                className="absolute top-3.5 right-3.5 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="p-5 sm:p-6 text-center space-y-4">
                {/* Official App Icon & Title */}
                <div className="mx-auto w-20 h-20 rounded-2xl shadow-md border border-emerald-200 dark:border-emerald-800/80 bg-white p-1.5 flex items-center justify-center">
                  <img
                    src="/pwa-512x512.png"
                    alt="SwanArh Classroom Icon"
                    className="w-full h-full rounded-xl object-contain"
                  />
                </div>

                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold">
                    <Sparkles className="w-3 h-3" />
                    <span>{deviceLabel} · Native App</span>
                  </div>
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                    SwanArh Classroom
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Dr. Si Thu Aung · Swanarh Academy
                  </p>
                </div>

                {installSuccess ? (
                  <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed flex flex-col items-center gap-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                    <span className="font-bold text-sm">
                      SwanArh Classroom App သွင်းပြီးပါပြီ!
                    </span>
                    <span>
                      သင့် {deviceLabel} ၏ Home Screen / Desktop ပေါ်တွင်{' '}
                      <strong>SwanArh Classroom</strong> App Icon ဖြင့် တိုက်ရိုက်ဖွင့်သုံးနိုင်ပါပြီ။
                    </span>
                  </div>
                ) : isInstallable ? (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      အောက်ပါ <strong>Install SwanArh Classroom</strong> ခလုတ်ကို နှိပ်လိုက်ပါက{' '}
                      <strong>SwanArh Classroom</strong> App (Icon နှင့် Name အပါအဝင်) ကို သင့်{' '}
                      <strong>{deviceLabel}</strong> ပေါ်သို့ တိုက်ရိုက် Install တင်ပေးပါမည်။
                    </p>
                    <button
                      type="button"
                      disabled={isInstalling}
                      onClick={handleInstallClick}
                      className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-bold shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
                    >
                      {isInstalling ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Installing SwanArh Classroom...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          <span>Install SwanArh Classroom Now</span>
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="text-left space-y-3">
                    {/* Case 1: Inside AI Studio Preview Iframe -> Provide 1-click button to open in full browser tab */}
                    {isInIframe && (
                      <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/80 space-y-2.5">
                        <p className="text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed font-medium">
                          Preview ဘောင်အတွင်းမှ တိုက်ရိုက် Install တင်ရန်အတွက် အောက်ပါခလုတ်ကိုနှိပ်ပြီး Browser Tab အပြည့်ဖြင့် ဖွင့်၍ <strong>Install</strong> နှိပ်ပါ —
                        </p>
                        <a
                          href={getDirectAutoInstallUrl()}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setShowInstallModal(false)}
                          className="w-full py-2.5 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
                        >
                          <ExternalLink className="w-4 h-4 shrink-0" />
                          <span>Browser Tab အပြည့်ဖြင့်ဖွင့်၍ Install တင်မည်</span>
                        </a>
                      </div>
                    )}

                    {/* Case 2: Inside Messenger / Telegram / Viber / Facebook In-App Browser */}
                    {isInAppBrowser && (
                      <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/80 space-y-2.5">
                        <p className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed font-medium">
                          လက်ရှိ In-App Browser ထဲတွင် ရောက်နေသဖြင့် <strong>{isIOS ? 'Safari' : 'Google Chrome'}</strong> ဖြင့် ဖွင့်မှသာ Native App အဖြစ် Install တင်နိုင်ပါမည် —
                        </p>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <button
                            type="button"
                            onClick={() => openInSystemBrowserForInstall(getDirectAutoInstallUrl())}
                            className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                            <span>{isIOS ? 'Safari ဖြင့်ဖွင့်မည်' : 'Chrome ဖြင့်ဖွင့်မည်'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleCopyUrl}
                            className="py-2.5 px-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            {copiedLink ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span>Copy ကူးပြီးပါပြီ</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 shrink-0" />
                                <span>Link Copy ကူးမည်</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Device-Specific Step-by-Step Native Install Instructions */}
                    <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-3">
                      {wasPreviouslyInstalled && (
                        <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 font-semibold">
                          ✓ SwanArh Classroom App ကို သင့်စက်တွင် သွင်းထားပြီးသားဖြစ်ပါသည် (Home Screen / Desktop ပေါ်တွင် ဖွင့်သုံးနိုင်ပါသည်)။
                        </div>
                      )}

                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                        {deviceLabel} တွင် SwanArh Classroom App သွင်းယူနည်း —
                      </p>

                      {isIOS ? (
                        <div className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                          <div className="flex items-start gap-2.5">
                            <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                              1
                            </span>
                            <span>
                              Safari Browser ၏ အောက်ခြေ (သို့) အပေါ်ထောင့်ရှိ{' '}
                              <strong>Share</strong>{' '}
                              <Share className="w-3.5 h-3.5 inline text-emerald-600 mx-0.5" />{' '}
                              ခလုတ်ကို နှိပ်ပါ။
                            </span>
                          </div>
                          <div className="flex items-start gap-2.5">
                            <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                              2
                            </span>
                            <span>
                              <strong>Add to Home Screen</strong>{' '}
                              <PlusSquare className="w-3.5 h-3.5 inline text-emerald-600 mx-0.5" />{' '}
                              ကိုရွေးပြီး ညာဘက်အပေါ်ထောင့်ရှိ <strong>Add</strong> ကိုနှိပ်ပါ (
                              <strong>SwanArh Classroom</strong> Icon နှင့် Name အလိုအလျောက်
                              ပါဝင်ပြီးဖြစ်ပါသည်)။
                            </span>
                          </div>
                        </div>
                      ) : isAndroid ? (
                        <div className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                          <div className="flex items-start gap-2.5">
                            <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                              1
                            </span>
                            <span>
                              Google Chrome Browser ညာဘက်အပေါ်ထောင့်ရှိ{' '}
                              <strong>⋮ (Menu)</strong>{' '}
                              <MoreVertical className="w-3.5 h-3.5 inline text-emerald-600 mx-0.5" />{' '}
                              ကိုနှိပ်ပါ။
                            </span>
                          </div>
                          <div className="flex items-start gap-2.5">
                            <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                              2
                            </span>
                            <span>
                              <strong>Install app</strong> (သို့မဟုတ်{' '}
                              <strong>Add to Home screen</strong>) ကိုနှိပ်ပြီး{' '}
                              <strong>Install</strong> နှိပ်လိုက်ပါက <strong>SwanArh Classroom</strong>{' '}
                              App အဖြစ် Home Screen ပေါ်သို့ တန်းသွင်းပေးပါမည်။
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                          <div className="flex items-start gap-2.5">
                            <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                              1
                            </span>
                            <span>
                              Browser Address Bar (URL လိပ်စာဘား) ၏ ညာဘက်ထောင့်ရှိ{' '}
                              <strong>Install SwanArh Classroom</strong>{' '}
                              <Download className="w-3.5 h-3.5 inline text-emerald-600 mx-0.5" />{' '}
                              icon ကို နှိပ်ပါ။
                            </span>
                          </div>
                          <div className="flex items-start gap-2.5">
                            <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                              2
                            </span>
                            <span>
                              (သို့မဟုတ်) Browser ညာဘက်အပေါ်ထောင့်ရှိ{' '}
                              <strong>⋮ Menu &gt; Save and share &gt; Install SwanArh Classroom</strong>{' '}
                              ကိုနှိပ်၍ ကွန်ပျူတာပေါ်သို့ တိုက်ရိုက်သွင်းယူနိုင်ပါသည်။
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowInstallModal(false)}
                      className="w-full py-2.5 rounded-xl bg-slate-200/80 hover:bg-slate-300/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold cursor-pointer transition-colors"
                    >
                      ပိတ်မည် (Close)
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  // On Login Page: Prominent Device-Smart 1-Click Install Card
  if (variant === 'login-device-card') {
    return (
      <>
        <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-emerald-50/90 via-white to-emerald-50/60 dark:from-emerald-950/40 dark:via-slate-900 dark:to-slate-900 border border-emerald-200/90 dark:border-emerald-800/70 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
            <div className="flex items-center gap-3 min-w-0">
              <img
                src="/pwa-512x512.png"
                alt="SwanArh Classroom App Icon"
                className="w-12 h-12 rounded-xl shadow-xs border border-slate-200/90 dark:border-slate-700 bg-white shrink-0 object-contain"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/70 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold">
                    <DeviceIcon className="w-3 h-3" />
                    <span>{deviceLabel}</span>
                  </span>
                  <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                    {isInstallable ? '1-Click Auto Install Ready' : 'Official Native App'}
                  </span>
                </div>
                <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate mt-0.5">
                  SwanArh Classroom
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
                  Install ကိုနှိပ်၍ SwanArh Classroom App Icon နှင့် Name ကို Home Screen ပေါ်သို့ တိုက်ရိုက်သွင်းယူပါ
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={isInstalling}
                onClick={handleInstallClick}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-bold shadow-xs transition-all cursor-pointer whitespace-nowrap"
              >
                {isInstalling ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                    <span>Installing...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5 shrink-0" />
                    <span>Install App ({deviceLabel})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
        {installModalNode}
      </>
    );
  }

  // Mobile Drawer variant
  if (variant === 'mobile-drawer') {
    return (
      <>
        <button
          type="button"
          disabled={isInstalling}
          onClick={handleInstallClick}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/70 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-left font-semibold cursor-pointer transition-colors"
        >
          <div className="flex items-center gap-2.5">
            {isInstalling ? (
              <Loader2 className="w-4 h-4 text-emerald-600 animate-spin shrink-0" />
            ) : (
              <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            )}
            <span>Install SwanArh Classroom ({deviceLabel})</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-emerald-600 text-white shrink-0">
            {isInstalling ? '...' : 'Install'}
          </span>
        </button>
        {installModalNode}
      </>
    );
  }

  // Top Header Button (Login header & Navbar)
  return (
    <>
      <button
        type="button"
        disabled={isInstalling}
        onClick={handleInstallClick}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer whitespace-nowrap"
        title={`Install SwanArh Classroom on ${deviceLabel}`}
      >
        {isInstalling ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
        ) : (
          <Download className="w-3.5 h-3.5 shrink-0" />
        )}
        <span className={variant === 'navbar' ? 'hidden sm:inline' : ''}>
          {isInstalling ? 'Installing...' : 'Install App'}
        </span>
      </button>
      {installModalNode}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg">
      <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
      <span>Offline Mode — သိမ်းဆည်းထားသော အချက်အလက်များဖြင့် ပြသနေပါသည်</span>
    </div>
  );
};
