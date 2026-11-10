export interface PresetAvatar {
  id: string;
  presetKey: string;
  name: string;
  category: 'Student' | 'Scholar' | 'Tech' | 'Creative';
  url: string;
}

export const DEFAULT_AVATAR_PRESET_KEY = 'preset:mentor-1';

export const DEFAULT_AVATAR_SVG =
  "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150' viewBox='0 0 150 150'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0%25' stop-color='%234f46e5'/%3E%3Cstop offset='100%25' stop-color='%237c3aed'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='150' height='150' rx='75' fill='url(%23g)'/%3E%3Ccircle cx='75' cy='56' r='26' fill='%23ffffff' fill-opacity='0.92'/%3E%3Cpath d='M30 132c8-26 26-38 45-38s37 12 45 38' fill='%23ffffff' fill-opacity='0.92'/%3E%3C/svg%3E";

function makeAvatarSvg(bgStart: string, bgEnd: string, initials: string): string {
  const s = encodeURIComponent(bgStart);
  const e = encodeURIComponent(bgEnd);
  const txt = encodeURIComponent(initials);
  return `data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0%25' stop-color='${s}'/%3E%3Cstop offset='100%25' stop-color='${e}'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='160' height='160' rx='80' fill='url(%23g)'/%3E%3Ccircle cx='80' cy='58' r='25' fill='%23ffffff' fill-opacity='0.22'/%3E%3Cpath d='M34 140c9-26 27-38 46-38s37 12 46 38' fill='%23ffffff' fill-opacity='0.22'/%3E%3Ctext x='80' y='92' text-anchor='middle' fill='%23ffffff' font-family='sans-serif' font-weight='800' font-size='44'%3E${txt}%3C/text%3E%3C/svg%3E`;
}

export const PRESET_AVATARS: PresetAvatar[] = [
  {
    id: 'avatar-student-1',
    presetKey: 'preset:mentor-1',
    name: 'Lead Mentor (Indigo)',
    category: 'Scholar',
    url: makeAvatarSvg('#4f46e5', '#7c3aed', 'LM'),
  },
  {
    id: 'avatar-student-2',
    presetKey: 'preset:mentor-2',
    name: 'Lead Mentor (Teal)',
    category: 'Student',
    url: makeAvatarSvg('#0d9488', '#0284c7', 'ST'),
  },
  {
    id: 'avatar-student-3',
    presetKey: 'preset:mentor-3',
    name: 'Academic Dean (Royal)',
    category: 'Tech',
    url: makeAvatarSvg('#2563eb', '#4f46e5', 'AD'),
  },
  {
    id: 'avatar-student-4',
    presetKey: 'preset:mentor-4',
    name: 'Faculty Lead (Rose)',
    category: 'Creative',
    url: makeAvatarSvg('#db2777', '#9333ea', 'FL'),
  },
  {
    id: 'avatar-student-5',
    presetKey: 'preset:mentor-5',
    name: 'Senior Mentor (Emerald)',
    category: 'Scholar',
    url: makeAvatarSvg('#059669', '#0d9488', 'SM'),
  },
  {
    id: 'avatar-student-6',
    presetKey: 'preset:mentor-6',
    name: 'Academy Director (Crimson)',
    category: 'Student',
    url: makeAvatarSvg('#e11d48', '#db2777', 'DR'),
  },
  {
    id: 'avatar-student-7',
    presetKey: 'preset:mentor-7',
    name: 'Cloud Architect (Sky)',
    category: 'Tech',
    url: makeAvatarSvg('#0284c7', '#2563eb', 'CA'),
  },
  {
    id: 'avatar-student-8',
    presetKey: 'preset:mentor-8',
    name: 'Principal Mentor (Violet)',
    category: 'Creative',
    url: makeAvatarSvg('#9333ea', '#6366f1', 'PM'),
  },
  {
    id: 'avatar-student-9',
    presetKey: 'preset:mentor-9',
    name: 'Course Lead (Amber)',
    category: 'Scholar',
    url: makeAvatarSvg('#d97706', '#ea580c', 'CL'),
  },
  {
    id: 'avatar-student-10',
    presetKey: 'preset:mentor-10',
    name: 'Program Chair (Fuchsia)',
    category: 'Student',
    url: makeAvatarSvg('#7c3aed', '#c026d3', 'PC'),
  },
  {
    id: 'avatar-student-11',
    presetKey: 'preset:mentor-11',
    name: 'Systems Lead (Slate)',
    category: 'Tech',
    url: makeAvatarSvg('#334155', '#0f172a', 'SL'),
  },
  {
    id: 'avatar-student-12',
    presetKey: 'preset:mentor-12',
    name: 'Research Mentor (Cyan)',
    category: 'Creative',
    url: makeAvatarSvg('#0891b2', '#0d9488', 'RM'),
  },
];

/**
 * Resolves a stored Preset Key (`preset:mentor-1`) or External URL (`https://...`)
 * into a renderable image src for `<img>` elements on the client.
 */
export function resolveAvatarUrl(avatarOrKey?: string | null): string {
  const raw = (avatarOrKey || '').trim();
  if (!raw) return DEFAULT_AVATAR_SVG;

  const matchedPreset = PRESET_AVATARS.find(
    (p) => p.presetKey === raw || p.id === raw || p.url === raw
  );
  if (matchedPreset) {
    return matchedPreset.url;
  }

  if (raw.startsWith('preset:')) {
    return PRESET_AVATARS[0]?.url || DEFAULT_AVATAR_SVG;
  }

  if (raw.startsWith('https://') || raw.startsWith('http://')) {
    if (raw.includes('images.unsplash.com')) {
      return DEFAULT_AVATAR_SVG;
    }
    return raw;
  }

  if (raw.startsWith('data:image/svg+xml')) {
    return raw;
  }

  // Any legacy Base64 raster image (`data:image/jpeg;base64,...`) falls back to clean SVG
  return DEFAULT_AVATAR_SVG;
}

/**
 * Converts any avatar value into a strict Cloud-safe value for Supabase `public.profiles.avatar`:
 * - NEVER stores Base64 (`data:...`) in Supabase Database!
 * - Only stores a short Preset Key (`preset:mentor-1`, ~15 Bytes) or External URL (`https://...`, <= 500 chars).
 * - Co-Admins and Students always store `''` (0 Bytes).
 */
export function toCloudAvatarKeyOrUrl(avatarOrUrl?: string | null, role?: string): string {
  if (role && role !== 'admin') return '';
  const raw = (avatarOrUrl || '').trim();
  if (!raw) return DEFAULT_AVATAR_PRESET_KEY;

  const matchedPreset = PRESET_AVATARS.find(
    (p) => p.presetKey === raw || p.id === raw || p.url === raw
  );
  if (matchedPreset) {
    return matchedPreset.presetKey;
  }

  if (raw.startsWith('preset:') && raw.length <= 64) {
    return raw;
  }

  if (
    (raw.startsWith('https://') || raw.startsWith('http://')) &&
    !raw.includes('images.unsplash.com') &&
    raw.length <= 500
  ) {
    return raw;
  }

  // Block all Base64 / data: URIs from ever entering Supabase Database
  return DEFAULT_AVATAR_PRESET_KEY;
}

/**
 * Returns storage inspection metadata for UI display in ProfilePictureModal
 */
export function getAvatarCloudStorageInfo(avatarOrUrl?: string | null): {
  mode: 'preset' | 'external_url';
  cloudKeyOrUrl: string;
  byteSize: number;
} {
  const cloudVal = toCloudAvatarKeyOrUrl(avatarOrUrl, 'admin');
  const isUrl = cloudVal.startsWith('http://') || cloudVal.startsWith('https://');
  return {
    mode: isUrl ? 'external_url' : 'preset',
    cloudKeyOrUrl: cloudVal,
    byteSize: new Blob([cloudVal]).size,
  };
}
