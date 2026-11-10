export interface PresetAvatar {
  id: string;
  name: string;
  category: 'Student' | 'Scholar' | 'Tech' | 'Creative';
  url: string;
}

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
    name: 'Dr. Si Thu / Lead',
    category: 'Scholar',
    url: makeAvatarSvg('#4f46e5', '#7c3aed', 'ST'),
  },
  {
    id: 'avatar-student-2',
    name: 'Coordinator',
    category: 'Student',
    url: makeAvatarSvg('#0d9488', '#0284c7', 'CO'),
  },
  {
    id: 'avatar-student-3',
    name: 'Academic Staff',
    category: 'Tech',
    url: makeAvatarSvg('#2563eb', '#4f46e5', 'AS'),
  },
  {
    id: 'avatar-student-4',
    name: 'Faculty Member',
    category: 'Creative',
    url: makeAvatarSvg('#db2777', '#9333ea', 'FM'),
  },
  {
    id: 'avatar-student-5',
    name: 'Senior Lecturer',
    category: 'Scholar',
    url: makeAvatarSvg('#059669', '#0d9488', 'SL'),
  },
  {
    id: 'avatar-student-6',
    name: 'May Thu',
    category: 'Student',
    url: makeAvatarSvg('#e11d48', '#db2777', 'MT'),
  },
  {
    id: 'avatar-student-7',
    name: 'Zin Ko',
    category: 'Tech',
    url: makeAvatarSvg('#0284c7', '#2563eb', 'ZK'),
  },
  {
    id: 'avatar-student-8',
    name: 'Ei Phyu',
    category: 'Creative',
    url: makeAvatarSvg('#9333ea', '#6366f1', 'EP'),
  },
  {
    id: 'avatar-student-9',
    name: 'Hein Htet',
    category: 'Scholar',
    url: makeAvatarSvg('#d97706', '#ea580c', 'HH'),
  },
  {
    id: 'avatar-student-10',
    name: 'Phyu Sin',
    category: 'Student',
    url: makeAvatarSvg('#7c3aed', '#c026d3', 'PS'),
  },
  {
    id: 'avatar-student-11',
    name: 'Min Khant',
    category: 'Tech',
    url: makeAvatarSvg('#334155', '#0f172a', 'MK'),
  },
  {
    id: 'avatar-student-12',
    name: 'Shwe Yee',
    category: 'Creative',
    url: makeAvatarSvg('#0891b2', '#0d9488', 'SY'),
  },
];

/**
 * Compresses an image file client-side to a square avatar JPEG data URI.
 * Guaranteed to be small (< 100KB) to ensure localStorage stability.
 */
export async function compressImageFile(file: File, maxDimension = 128, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image format'));
      img.onload = () => {
        // Calculate center crop to square
        const minDim = Math.min(img.width, img.height);
        const startX = (img.width - minDim) / 2;
        const startY = (img.height - minDim) / 2;

        const canvas = document.createElement('canvas');
        canvas.width = maxDimension;
        canvas.height = maxDimension;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve(reader.result as string);
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, maxDimension, maxDimension);

        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
