import React, { useState, useRef } from 'react';
import { Course } from '../types/classroom';
import { ClassroomDB } from '../services/storage';
import {
  X,
  Upload,
  Image as ImageIcon,
  Check,
  Sparkles,
  Link as LinkIcon,
  SlidersHorizontal,
} from 'lucide-react';

export interface PresetBannerItem {
  id: string;
  label: string;
  category: string;
  url: string;
}

export const PRESET_CLASSROOM_BANNERS: PresetBannerItem[] = [
  {
    id: 'banner-academy-hall',
    label: 'University Lecture Hall',
    category: 'Academic',
    url: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1000&h=250&fit=crop&q=85',
  },
  {
    id: 'banner-medical-science',
    label: 'Medical & Laboratory Science',
    category: 'Science & Medicine',
    url: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=1000&h=250&fit=crop&q=85',
  },
  {
    id: 'banner-web-arch',
    label: 'Software & Cloud Engineering',
    category: 'Technology',
    url: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1000&h=250&fit=crop&q=85',
  },
  {
    id: 'banner-cyber-sec',
    label: 'Cybersecurity & Networks',
    category: 'Security',
    url: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=1000&h=250&fit=crop&q=85',
  },
  {
    id: 'banner-data-ai',
    label: 'Data Science & Analytics',
    category: 'AI & Math',
    url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1000&h=250&fit=crop&q=85',
  },
  {
    id: 'banner-library-books',
    label: 'Classic Library & Research',
    category: 'Literature',
    url: 'https://images.unsplash.com/photo-1507842229356-51c61504d3ab?w=1000&h=250&fit=crop&q=85',
  },
  {
    id: 'banner-modern-campus',
    label: 'Modern Study Workspace',
    category: 'General',
    url: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=1000&h=250&fit=crop&q=85',
  },
  {
    id: 'banner-biotech',
    label: 'Clinical & Microscope Study',
    category: 'Biology',
    url: 'https://images.unsplash.com/photo-1579154204601-01588f351e67?w=1000&h=250&fit=crop&q=85',
  },
];

/**
 * Formats an uploaded image file to exact Google Classroom Header dimensions:
 * 1200 x 300 pixels (4:1 aspect ratio, high clarity on mobile & desktop retina screens)
 */
export function resizeToGoogleClassroomBanner(
  file: File,
  verticalAlign: 'top' | 'center' | 'bottom' | 'contain' = 'center',
  quality: number = 0.92
): Promise<string> {
  const TARGET_WIDTH = 1200;
  const TARGET_HEIGHT = 300;
  const TARGET_RATIO = TARGET_WIDTH / TARGET_HEIGHT; // 4:1

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = TARGET_WIDTH;
        canvas.height = TARGET_HEIGHT;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable'));
          return;
        }

        const srcW = img.width;
        const srcH = img.height;
        const srcRatio = srcW / srcH;

        if (verticalAlign === 'contain') {
          // Fill blurred backdrop so there are no empty bars, then draw full image centered
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(0, 0, TARGET_WIDTH, TARGET_HEIGHT);
          ctx.save();
          ctx.filter = 'blur(18px) brightness(0.55)';
          ctx.drawImage(img, 0, 0, TARGET_WIDTH, TARGET_HEIGHT);
          ctx.restore();

          let drawW = TARGET_WIDTH;
          let drawH = TARGET_HEIGHT;
          if (srcRatio > TARGET_RATIO) {
            drawW = TARGET_WIDTH;
            drawH = TARGET_WIDTH / srcRatio;
          } else {
            drawH = TARGET_HEIGHT;
            drawW = TARGET_HEIGHT * srcRatio;
          }
          const dx = (TARGET_WIDTH - drawW) / 2;
          const dy = (TARGET_HEIGHT - drawH) / 2;
          ctx.drawImage(img, dx, dy, drawW, drawH);
        } else {
          let cropW = srcW;
          let cropH = srcH;
          let cropX = 0;
          let cropY = 0;

          if (srcRatio > TARGET_RATIO) {
            // Source is wider than 4:1 -> crop horizontally from center
            cropW = srcH * TARGET_RATIO;
            cropX = (srcW - cropW) / 2;
          } else {
            // Source is taller than 4:1 -> crop vertically based on alignment
            cropH = srcW / TARGET_RATIO;
            if (verticalAlign === 'top') {
              cropY = 0;
            } else if (verticalAlign === 'bottom') {
              cropY = srcH - cropH;
            } else {
              cropY = (srcH - cropH) / 2;
            }
          }

          ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, TARGET_WIDTH, TARGET_HEIGHT);
        }

        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = ev.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

interface CourseBannerModalProps {
  course: Course;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CourseBannerModal: React.FC<CourseBannerModalProps> = ({
  course,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [selectedBanner, setSelectedBanner] = useState<string>(course.bannerImage);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [cropAlign, setCropAlign] = useState<'top' | 'center' | 'bottom' | 'contain'>('center');
  const [customUrl, setCustomUrl] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('ကျေးဇူးပြု၍ ပုံဖိုင် (JPG, PNG, WEBP) ကိုသာ ရွေးချယ်ပါ။');
      return;
    }

    setErrorMsg(null);
    setIsProcessing(true);
    setUploadedFile(file);

    try {
      const formattedDataUrl = await resizeToGoogleClassroomBanner(file, cropAlign);
      setSelectedBanner(formattedDataUrl);
    } catch {
      setErrorMsg('ပုံဖိုင် ပြုပြင်ရာတွင် အမှားဖြစ်ပေါ်ခဲ့ပါသည်။');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleChangeCropAlign = async (align: 'top' | 'center' | 'bottom' | 'contain') => {
    setCropAlign(align);
    if (uploadedFile) {
      setIsProcessing(true);
      try {
        const formattedDataUrl = await resizeToGoogleClassroomBanner(uploadedFile, align);
        setSelectedBanner(formattedDataUrl);
      } catch {
        // ignore
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleApplyUrl = () => {
    if (!customUrl.trim()) return;
    setUploadedFile(null);
    setSelectedBanner(customUrl.trim());
  };

  const handleSaveBanner = () => {
    if (!selectedBanner.trim()) return;
    ClassroomDB.updateCourseBanner(course.id, selectedBanner);
    onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-850">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Customize Classroom Header Photo
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Google Classroom Header Size: <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">1000 × 250 px (4:1 Aspect Ratio)</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-xs">
          {/* Live 1000x250 (4:1) Google Classroom Header Preview — Unobstructed & Clear */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Live Header Photo Preview (Mobile & Computer 4:1 Full View)
              </span>
              <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
                1000 × 250 px (4:1)
              </span>
            </div>

            <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-md bg-white dark:bg-slate-900">
              <div className="relative w-full aspect-[4/1] bg-slate-900 overflow-hidden">
                <img
                  src={selectedBanner}
                  alt="Header Preview"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover object-center"
                />
              </div>
              <div className="px-4 py-2.5 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <div className="truncate">
                  <span className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm truncate block">
                    {course.title}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    {course.code} · {course.batch} · {course.instructorName}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs">
              {errorMsg}
            </div>
          )}

          {/* Upload from Device Section */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="font-bold text-slate-900 dark:text-slate-100">
                  ၁။ ကွန်ပျူတာ သို့မဟုတ် ဖုန်းထဲမှ ပုံတင်ရန် (Upload Custom Photo)
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  ဖုန်းနှင့် ကွန်ပျူတာနှစ်မျိုးလုံးတွင် ကြည်လင်ပြတ်သားစွာ မြင်ရစေရန် 4:1 အချိုးသို့ ချိန်ညှိပေးပါသည်။
                </p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-xs transition-colors cursor-pointer shrink-0"
              >
                <Upload className="w-4 h-4" />
                <span>{isProcessing ? 'Formatting...' : 'Upload Photo'}</span>
              </button>
            </div>

            {/* Crop Alignment Control if user uploaded a custom file */}
            {uploadedFile && (
              <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-2 flex-wrap">
                <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-500" />
                  <span>ပုံအနေအထား ချိန်ညှိရန် (Photo Fit & Position):</span>
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      { id: 'center', label: 'Center (အလယ်)' },
                      { id: 'top', label: 'Top (အပေါ်)' },
                      { id: 'bottom', label: 'Bottom (အောက်)' },
                      { id: 'contain', label: 'Fit Full Photo (ပုံအပြည့်ပြရန်)' },
                    ] as const
                  ).map((pos) => (
                    <button
                      key={pos.id}
                      type="button"
                      onClick={() => handleChangeCropAlign(pos.id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                        cropAlign === pos.id
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {pos.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Preset Classroom Themes Gallery */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-slate-100">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>၂။ အသင့်သုံး Google Classroom Header ပုံများမှ ရွေးချယ်ရန် (Preset Themes)</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {PRESET_CLASSROOM_BANNERS.map((item) => {
                const isSelected = selectedBanner === item.url;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setUploadedFile(null);
                      setSelectedBanner(item.url);
                    }}
                    className={`group relative rounded-xl overflow-hidden border-2 text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-indigo-600 ring-2 ring-indigo-500/30'
                        : 'border-slate-200 dark:border-slate-800 hover:border-indigo-400'
                    }`}
                  >
                    <div className="aspect-[4/1] w-full bg-slate-900 overflow-hidden">
                      <img
                        src={item.url}
                        alt={item.label}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                    <div className="p-2 bg-white dark:bg-slate-900 flex items-center justify-between gap-1">
                      <div className="truncate">
                        <div className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {item.label}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">{item.category}</div>
                      </div>
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Paste Image URL */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
              <LinkIcon className="w-3.5 h-3.5 text-slate-400" />
              <span>၃။ ပုံ Link (Image URL) တိုက်ရိုက်ထည့်ရန် (Optional)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="https://example.com/header-1000x250.jpg"
                className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-hidden focus:border-indigo-500 font-mono text-xs"
              />
              <button
                type="button"
                onClick={handleApplyUrl}
                className="px-3.5 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Preview URL
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-850 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveBanner}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Save Header Photo (သိမ်းဆည်းမည်)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
