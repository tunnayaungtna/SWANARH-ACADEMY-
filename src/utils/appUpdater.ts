import { ClassroomDB } from '../services/storage';

export const APP_VERSION_LABEL = 'v21.1';
export const ACTIVE_SW_CACHE_NAME = 'swanarh-classroom-v21';

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

    // 2. Purge all stale local/query caches and pull latest authoritative data from Supabase
    // (Courses, Attendance Sessions, Posts, Private Notes, Profiles, Notifications)
    const [pulled] = await Promise.all([
      ClassroomDB.purgeStaleCacheAndForceSync(),
      swCheckPromise,
    ]);

    dataUpdated = Boolean(pulled);
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
 * Performs a full application shell & Service Worker cache refresh while wiping stale
 * classroom caches and preserving the user's login session and attendance check-in ledger.
 */
export async function performFullAppVersionUpdate(
  _onDataRefreshed?: () => void
): Promise<void> {
  try {
    // Clear stale local/query caches in 0ms before reloading; the reloaded page (?wake=)
    // immediately executes a single authoritative purgeStaleCacheAndForceSync() pass!
    ClassroomDB.prepareStaleCachePurgeForReload();
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
