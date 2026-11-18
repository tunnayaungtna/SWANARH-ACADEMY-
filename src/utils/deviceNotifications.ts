export interface DeviceAlertPayload {
  id: string;
  title: string;
  body: string;
  courseId?: string;
  targetTab?: 'stream' | 'attendance' | 'quizzes' | 'private_notes' | 'people';
  variant?: 'post' | 'attendance_open' | 'attendance_close' | 'private_note' | 'quiz';
  createdAtLabel?: string;
}

const DEVICE_NOTIFIED_IDS_KEY = 'swanarh_device_notified_ids_v1';

function getSeenDeviceNotifIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(DEVICE_NOTIFIED_IDS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed) : new Set();
  } catch {
    return new Set();
  }
}

export function markDeviceNotifIdsSeen(ids: string[]): void {
  if (typeof window === 'undefined' || ids.length === 0) return;
  try {
    const set = getSeenDeviceNotifIds();
    for (const id of ids) {
      if (id) set.add(id);
    }
    const trimmed = Array.from(set).slice(-350);
    localStorage.setItem(DEVICE_NOTIFIED_IDS_KEY, JSON.stringify(trimmed));
  } catch {
    // ignore
  }
}

export function hasDeviceNotifIdBeenSeen(id: string): boolean {
  if (!id) return true;
  return getSeenDeviceNotifIds().has(id);
}

/**
 * Plays a gentle 2-note notification chime using the browser's built-in Web Audio API (0 KB network usage)
 */
function playGentleNotificationChime(): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.setValueAtTime(880, now + 0.11); // A5
    gain1.gain.setValueAtTime(0.08, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.36);
    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 500);
  } catch {
    // ignore if browser blocks autoplay audio before user gesture
  }
}

/**
 * Triggers a cross-device notification on Phone, Tablet, and Computer Browser:
 * 1. In-App Floating Push Banner (`classroom-live-device-alert`)
 * 2. Gentle Chime & Mobile Vibration
 * 3. Native Browser / OS Notification via ServiceWorkerRegistration (`showNotification`) or `new Notification`
 */
export function dispatchDeviceNotification(payload: DeviceAlertPayload): void {
  if (typeof window === 'undefined' || !payload.id) return;

  // Deduplicate so the same event never alerts more than once on this device
  if (hasDeviceNotifIdBeenSeen(payload.id)) {
    return;
  }
  markDeviceNotifIdsSeen([payload.id]);

  // 1. Dispatch In-App Floating Push Banner so Phone/Tablet/Desktop users always see it immediately
  try {
    window.dispatchEvent(
      new CustomEvent<DeviceAlertPayload>('classroom-live-device-alert', {
        detail: payload,
      })
    );
  } catch {
    // ignore
  }

  // 2. Gentle sound chime + subtle vibration on mobile phones/tablets
  playGentleNotificationChime();
  try {
    if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
      navigator.vibrate([120, 60, 120]);
    }
  } catch {
    // ignore
  }

  // 3. Native OS / Browser Notification (Phone, Tablet & Computer Browser)
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  const notifOptions: NotificationOptions & { renotify?: boolean } = {
    body: payload.body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: payload.id,
    data: {
      courseId: payload.courseId,
      targetTab: payload.targetTab || 'stream',
    },
  };

  // Prefer ServiceWorkerRegistration.showNotification() which is required on Android Chrome / Mobile PWAs
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .getRegistration()
      .then((reg) => {
        if (reg && typeof reg.showNotification === 'function') {
          return reg.showNotification(payload.title, notifOptions);
        }
        // Fallback to standard desktop Notification constructor
        const n = new Notification(payload.title, notifOptions);
        n.onclick = () => {
          window.focus();
          if (payload.courseId) {
            window.dispatchEvent(
              new CustomEvent('classroom-notification-navigate', {
                detail: {
                  courseId: payload.courseId,
                  targetTab: payload.targetTab || 'stream',
                },
              })
            );
          }
          n.close();
        };
        return undefined;
      })
      .catch(() => {
        try {
          new Notification(payload.title, notifOptions);
        } catch {
          // ignore
        }
      });
  } else {
    try {
      const n = new Notification(payload.title, notifOptions);
      n.onclick = () => {
        window.focus();
        if (payload.courseId) {
          window.dispatchEvent(
            new CustomEvent('classroom-notification-navigate', {
              detail: {
                courseId: payload.courseId,
                targetTab: payload.targetTab || 'stream',
              },
            })
          );
        }
        n.close();
      };
    } catch {
      // ignore
    }
  }
}

export async function requestDeviceNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  if (Notification.permission === 'granted') {
    return 'granted';
  }
  try {
    const result = await Notification.requestPermission();
    return result;
  } catch {
    return Notification.permission;
  }
}
