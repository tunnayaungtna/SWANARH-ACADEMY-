import { ClassroomDB } from '../services/storage';

export const APP_VERSION_LABEL = 'v20.5';
export const ACTIVE_SW_CACHE_NAME = 'swanarh-classroom-v20';

/**
 * Performs a fast, non-destructive live update of both Classroom Cloud Data (Supabase)
 * and checks for any new Service Worker / Application Bundle updates.
 */
export async function performQuickUpdateAndSync(
  onDataRefreshed?: () => void
): Promise<{ dataUpdated: boolean; swUpdated: boolean }> {
  let dataUpdated = false;
  let swUpdated = false;

  try {
    // 1. Check Service Worker for new app bundle in parallel with Supabase data pull
    const swCheckPromise = (async () => {
      if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
        return false;
      }
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.update().catch(() => {});
          if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            swUpdated = true;
          }
        }
        return swUpdated;
      } catch {
        return false;
      }
    })();

    // 2. Pull latest authoritative data from Supabase (Courses, Posts, Attendance, Profiles, Notifications)
    const [pulled, attChanged] = await Promise.all([
      ClassroomDB.pullFromSupabase({ force: true }),
      ClassroomDB.syncAttendanceFromCloud(true),
      swCheckPromise,
    ]);

    dataUpdated = Boolean(pulled || attChanged);
    if (onDataRefreshed) {
      onDataRefreshed();
    }
  } catch {
    if (onDataRefreshed) {
      onDataRefreshed();
    }
  }

  return { dataUpdated, swUpdated };
}

/**
 * Performs a full application shell & Service Worker cache refresh while preserving
 * the user's login session and local classroom state.
 */
export async function performFullAppVersionUpdate(
  onDataRefreshed?: () => void
): Promise<void> {
  try {
    await performQuickUpdateAndSync(onDataRefreshed);
  } catch {
    // continue to reload
  }

  try {
    if (typeof window !== 'undefined') {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.allSettled(
          registrations.map(async (reg) => {
            if (reg.waiting) {
              reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
            await reg.update().catch(() => {});
          })
        );
      }

      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.allSettled(keys.map((k) => caches.delete(k)));
      }

      const url = new URL(window.location.href);
      url.searchParams.set('wake', String(Date.now()));
      window.location.replace(url.toString());
    }
  } catch {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }
}
