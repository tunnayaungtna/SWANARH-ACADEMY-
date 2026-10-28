import { useEffect, useState } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

declare global {
  interface Window {
    __pwaDeferredPrompt?: BeforeInstallPromptEvent | null;
  }
  interface Navigator {
    getInstalledRelatedApps?: () => Promise<Array<{ id?: string; platform?: string; url?: string }>>;
  }
}

export type DevicePlatform = 'android' | 'ios' | 'desktop';

const promptListeners = new Set<(prompt: BeforeInstallPromptEvent | null) => void>();

function getGlobalPrompt(): BeforeInstallPromptEvent | null {
  if (typeof window === 'undefined') return null;
  return window.__pwaDeferredPrompt || null;
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    window.__pwaDeferredPrompt = e as BeforeInstallPromptEvent;
    promptListeners.forEach((listener) => listener(window.__pwaDeferredPrompt || null));
  });

  window.addEventListener('pwa-prompt-ready', () => {
    promptListeners.forEach((listener) => listener(window.__pwaDeferredPrompt || null));
  });

  window.addEventListener('appinstalled', () => {
    window.__pwaDeferredPrompt = null;
    promptListeners.forEach((listener) => listener(null));
  });
}

function detectDevicePlatform(): {
  isIOS: boolean;
  isAndroid: boolean;
  isInAppBrowser: boolean;
  deviceType: DevicePlatform;
  deviceLabel: string;
} {
  if (typeof window === 'undefined') {
    return {
      isIOS: false,
      isAndroid: false,
      isInAppBrowser: false,
      deviceType: 'desktop',
      deviceLabel: 'Computer',
    };
  }
  const userAgent = window.navigator.userAgent.toLowerCase();
  const ios =
    /iphone|ipad|ipod/.test(userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /android/.test(userAgent);

  // Detect Messenger, Telegram, Viber, Facebook, Instagram, Line, WeChat, or Android WebView
  const inApp =
    /fban|fbav|fb_iab|messenger|viber|telegram|instagram|line\/|micromessenger|; wv\)|\bwv\b/.test(
      userAgent
    );

  if (ios) {
    const isIPad =
      /ipad/.test(userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    return {
      isIOS: true,
      isAndroid: false,
      isInAppBrowser: inApp,
      deviceType: 'ios',
      deviceLabel: isIPad ? 'iPad (iOS)' : 'iPhone (iOS)',
    };
  }

  if (android) {
    return {
      isIOS: false,
      isAndroid: true,
      isInAppBrowser: inApp,
      deviceType: 'android',
      deviceLabel: 'Android ဖုန်း',
    };
  }

  const isMac = /macintosh|mac os x/.test(userAgent);
  const isWindows = /windows/.test(userAgent);
  return {
    isIOS: false,
    isAndroid: false,
    isInAppBrowser: false,
    deviceType: 'desktop',
    deviceLabel: isWindows ? 'Windows Computer' : isMac ? 'Mac Computer' : 'Computer',
  };
}

/**
 * Opens the target URL directly inside Google Chrome (on Android) or Safari (on iOS)
 * when the user explicitly clicks the "Open in Chrome / Safari" button inside an In-App WebView.
 */
export function openInSystemBrowserForInstall(targetUrl: string): void {
  if (typeof window === 'undefined') return;
  const { isAndroid, isIOS } = detectDevicePlatform();

  if (isAndroid) {
    try {
      const parsed = new URL(targetUrl, window.location.origin);
      const hostAndPath = `${parsed.host}${parsed.pathname}${parsed.search}`;
      const intentUrl = `intent://${hostAndPath}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(
        parsed.toString()
      )};end`;
      window.location.href = intentUrl;
      return;
    } catch {
      // fallback below
    }
  }

  if (isIOS) {
    try {
      const parsed = new URL(targetUrl, window.location.origin);
      const safariUrl = parsed.toString().replace(/^https:\/\//i, 'x-safari-https://');
      window.location.href = safariUrl;
      return;
    } catch {
      // fallback below
    }
  }

  window.location.href = targetUrl;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    getGlobalPrompt
  );
  const [isInstalled, setIsInstalled] = useState(false);
  const [hasRelatedAppInstalled, setHasRelatedAppInstalled] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState(detectDevicePlatform);
  const [isInIframe, setIsInIframe] = useState(false);

  useEffect(() => {
    const checkStandalone = () => {
      const standalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: window-controls-overlay)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      setIsInstalled(standalone);
    };
    checkStandalone();

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleMediaChange = () => checkStandalone();
    mediaQuery.addEventListener?.('change', handleMediaChange);

    setDeviceInfo(detectDevicePlatform());

    try {
      setIsInIframe(window.self !== window.top);
    } catch {
      setIsInIframe(true);
    }

    if (typeof navigator.getInstalledRelatedApps === 'function') {
      navigator
        .getInstalledRelatedApps()
        .then((apps) => {
          if (Array.isArray(apps) && apps.length > 0) {
            setHasRelatedAppInstalled(true);
          }
        })
        .catch(() => {});
    }

    const handlePromptUpdate = (promptEvent: BeforeInstallPromptEvent | null) => {
      setDeferredPrompt(promptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    if (window.__pwaDeferredPrompt) {
      setDeferredPrompt(window.__pwaDeferredPrompt);
    }

    promptListeners.add(handlePromptUpdate);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('pwa-installed', handleAppInstalled);

    return () => {
      promptListeners.delete(handlePromptUpdate);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('pwa-installed', handleAppInstalled);
      mediaQuery.removeEventListener?.('change', handleMediaChange);
    };
  }, []);

  /**
   * Immediately invokes the native browser install prompt synchronously with the user's click gesture.
   * Never delays with setTimeout so transient user activation is never lost.
   */
  const install = async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    const promptToUse = deferredPrompt || window.__pwaDeferredPrompt || null;
    if (!promptToUse) {
      return 'unavailable';
    }

    try {
      await promptToUse.prompt();
      const { outcome } = await promptToUse.userChoice;
      if (outcome === 'accepted') {
        window.__pwaDeferredPrompt = null;
        setIsInstalled(true);
        setDeferredPrompt(null);
        return 'accepted';
      }
      return 'dismissed';
    } catch {
      return 'unavailable';
    }
  };

  return {
    isInstallable: !!(deferredPrompt || window.__pwaDeferredPrompt),
    isInstalled,
    wasPreviouslyInstalled: hasRelatedAppInstalled,
    isIOS: deviceInfo.isIOS,
    isAndroid: deviceInfo.isAndroid,
    isInAppBrowser: deviceInfo.isInAppBrowser,
    deviceType: deviceInfo.deviceType,
    deviceLabel: deviceInfo.deviceLabel,
    isInIframe,
    install,
  };
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
