import { OFFICIAL_ACADEMY_LOGO } from '../assets/officialLogoData';

export interface PresetAvatarItem {
  presetKey: string;
  name: string;
  url: string;
}

const makeAvatarSvg = (bg1: string, bg2: string, initials: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${bg1}"/><stop offset="100%" stop-color="${bg2}"/></linearGradient></defs><rect width="160" height="160" rx="80" fill="url(#g)"/><circle cx="80" cy="58" r="26" fill="#ffffff" fill-opacity="0.92"/><path d="M32 138c9-26 27-39 48-39s39 13 48 39" fill="#ffffff" fill-opacity="0.92"/><text x="80" y="66" font-family="sans-serif" font-size="20" font-weight="bold" fill="${bg1}" text-anchor="middle">${initials}</text></svg>`
  )}`;

export const DEFAULT_AVATAR_PRESET_KEY = 'preset:mentor-1';

export const DEFAULT_AVATAR_SVG = OFFICIAL_ACADEMY_LOGO;

export const PRESET_AVATARS: PresetAvatarItem[] = [
  {
    presetKey: 'preset:mentor-1',
    name: 'SwanArh Academy Official Logo (Default Admin)',
    url: OFFICIAL_ACADEMY_LOGO,
  },
  {
    presetKey: 'preset:mentor-2',
    name: 'Mentor Emerald',
    url: makeAvatarSvg('#059669', '#0d9488', 'SA'),
  },
  {
    presetKey: 'preset:mentor-3',
    name: 'Mentor Ocean',
    url: makeAvatarSvg('#0284c7', '#2563eb', 'DR'),
  },
  {
    presetKey: 'preset:mentor-4',
    name: 'Mentor Amber',
    url: makeAvatarSvg('#d97706', '#ea580c', 'MT'),
  },
  {
    presetKey: 'preset:mentor-5',
    name: 'Mentor Rose',
    url: makeAvatarSvg('#e11d48', '#db2777', 'pf'),
  },
  {
    presetKey: 'preset:mentor-6',
    name: 'Mentor Slate',
    url: makeAvatarSvg('#334155', '#0f172a', 'AD'),
  },
  {
    presetKey: 'preset:mentor-7',
    name: 'Mentor Indigo',
    url: makeAvatarSvg('#4f46e5', '#7c3aed', 'LM'),
  },
  {
    presetKey: 'preset:mentor-8',
    name: 'Mentor Teal',
    url: makeAvatarSvg('#0f766e', '#115e59', 'T2'),
  },
  {
    presetKey: 'preset:mentor-9',
    name: 'Mentor Violet',
    url: makeAvatarSvg('#6d28d9', '#4c1d95', 'T3'),
  },
  {
    presetKey: 'preset:mentor-10',
    name: 'Mentor Sky',
    url: makeAvatarSvg('#0369a1', '#1e40af', 'T4'),
  },
  {
    presetKey: 'preset:mentor-11',
    name: 'Mentor Gold',
    url: makeAvatarSvg('#b45309', '#92400e', 'T5'),
  },
  {
    presetKey: 'preset:mentor-12',
    name: 'Mentor Crimson',
    url: makeAvatarSvg('#be123c', '#881337', 'T6'),
  },
];

const PRESET_BY_KEY = new Map<string, PresetAvatarItem>(
  PRESET_AVATARS.map((item) => [item.presetKey, item])
);

const PRESET_BY_URL = new Map<string, PresetAvatarItem>(
  PRESET_AVATARS.map((item) => [item.url, item])
);

/**
 * Resolves a stored avatar value (which may be a compact `preset:mentor-X` key or an External https:// URL)
 * into a renderable `<img src="..." />` URL for the browser UI.
 * By default, Admin accounts resolve to the official SwanArh Academy application logo (`OFFICIAL_ACADEMY_LOGO`).
 */
export function resolveAvatarUrl(raw: string | undefined | null): string {
  if (!raw || !raw.trim()) return OFFICIAL_ACADEMY_LOGO;
  const trimmed = raw.trim();

  if (trimmed === DEFAULT_AVATAR_PRESET_KEY) {
    return OFFICIAL_ACADEMY_LOGO;
  }

  // 1. Direct Preset Key lookup (e.g., "preset:mentor-2")
  const foundByKey = PRESET_BY_KEY.get(trimmed);
  if (foundByKey) {
    return foundByKey.url;
  }

  // 2. External HTTP/HTTPS URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  // 3. Official Academy Logo or matching Preset SVG
  if (trimmed === OFFICIAL_ACADEMY_LOGO) {
    return OFFICIAL_ACADEMY_LOGO;
  }
  const foundByUrl = PRESET_BY_URL.get(trimmed);
  if (foundByUrl) {
    return foundByUrl.url;
  }

  // 4. Upgrade any legacy generic SVG silhouette / initial avatars to the Official Application Logo
  if (trimmed.startsWith('data:image/svg+xml')) {
    return OFFICIAL_ACADEMY_LOGO;
  }

  if (trimmed.startsWith('data:image/')) {
    return trimmed;
  }

  return OFFICIAL_ACADEMY_LOGO;
}

/**
 * Zero-Base64 Supabase Storage Guard:
 * Ensures we NEVER store Base64 (`data:image/...`) strings inside `public.profiles.avatar` in Supabase.
 * - Non-admin accounts (`student`, `co_admin`) always store `''` (0 Bytes).
 * - Admin accounts store ONLY a compact `preset:mentor-X` key (15 Bytes) or an External `https://` URL (< 500 chars).
 */
export function toCloudAvatarKeyOrUrl(
  raw: string | undefined | null,
  role: string = 'admin'
): string {
  if (role !== 'admin') return '';
  if (!raw || !raw.trim()) return DEFAULT_AVATAR_PRESET_KEY;
  const trimmed = raw.trim();

  if (trimmed === OFFICIAL_ACADEMY_LOGO || trimmed === DEFAULT_AVATAR_PRESET_KEY) {
    return DEFAULT_AVATAR_PRESET_KEY;
  }

  // Already a valid preset key
  if (PRESET_BY_KEY.has(trimmed)) {
    return trimmed;
  }

  // Matches one of our local preset URLs -> convert to its 15-byte presetKey!
  const matchedPreset = PRESET_BY_URL.get(trimmed);
  if (matchedPreset) {
    return matchedPreset.presetKey;
  }

  // Valid external HTTP/HTTPS URL (keep if reasonably sized)
  if (
    (trimmed.startsWith('http://') || trimmed.startsWith('https://')) &&
    trimmed.length <= 500
  ) {
    return trimmed;
  }

  // Block any Base64 (`data:image/...`) from ever being sent to Supabase Database
  return DEFAULT_AVATAR_PRESET_KEY;
}

/**
 * Returns human-readable metadata about how an avatar will be stored in Supabase.
 */
export function getAvatarCloudStorageInfo(raw: string | undefined | null): {
  cloudKeyOrUrl: string;
  storageType: 'preset_key' | 'external_url';
  byteSize: number;
} {
  const cloudVal = toCloudAvatarKeyOrUrl(raw, 'admin');
  const isUrl = cloudVal.startsWith('http://') || cloudVal.startsWith('https://');
  return {
    cloudKeyOrUrl: cloudVal,
    storageType: isUrl ? 'external_url' : 'preset_key',
    byteSize: new Blob([cloudVal]).size,
  };
}
