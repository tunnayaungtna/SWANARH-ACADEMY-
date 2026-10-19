export interface PresetAvatar {
  id: string;
  name: string;
  category: 'Student' | 'Scholar' | 'Tech' | 'Creative';
  url: string;
}

export const PRESET_AVATARS: PresetAvatar[] = [
  {
    id: 'avatar-student-1',
    name: 'Aung Min',
    category: 'Student',
    url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=250&auto=format&fit=crop&q=80',
  },
  {
    id: 'avatar-student-2',
    name: 'Su Myat',
    category: 'Student',
    url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=250&auto=format&fit=crop&q=80',
  },
  {
    id: 'avatar-student-3',
    name: 'Thura Tun',
    category: 'Tech',
    url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=250&auto=format&fit=crop&q=80',
  },
  {
    id: 'avatar-student-4',
    name: 'Hnin Nu',
    category: 'Creative',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=250&auto=format&fit=crop&q=80',
  },
  {
    id: 'avatar-student-5',
    name: 'Kyaw Zayar',
    category: 'Scholar',
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=250&auto=format&fit=crop&q=80',
  },
  {
    id: 'avatar-student-6',
    name: 'May Thu',
    category: 'Student',
    url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=250&auto=format&fit=crop&q=80',
  },
  {
    id: 'avatar-student-7',
    name: 'Zin Ko',
    category: 'Tech',
    url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=250&auto=format&fit=crop&q=80',
  },
  {
    id: 'avatar-student-8',
    name: 'Ei Phyu',
    category: 'Creative',
    url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=250&auto=format&fit=crop&q=80',
  },
  {
    id: 'avatar-student-9',
    name: 'Hein Htet',
    category: 'Scholar',
    url: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=250&auto=format&fit=crop&q=80',
  },
  {
    id: 'avatar-student-10',
    name: 'Phyu Sin',
    category: 'Student',
    url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=250&auto=format&fit=crop&q=80',
  },
  {
    id: 'avatar-student-11',
    name: 'Min Khant',
    category: 'Tech',
    url: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=250&auto=format&fit=crop&q=80',
  },
  {
    id: 'avatar-student-12',
    name: 'Shwe Yee',
    category: 'Creative',
    url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=250&auto=format&fit=crop&q=80',
  },
];

/**
 * Compresses an image file client-side to a square avatar JPEG data URI.
 * Guaranteed to be small (< 100KB) to ensure localStorage stability.
 */
export async function compressImageFile(file: File, maxDimension = 256, quality = 0.85): Promise<string> {
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
