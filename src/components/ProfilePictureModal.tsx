import React, { useState, useRef } from 'react';
import { User } from '../types/classroom';
import { ClassroomDB } from '../services/storage';
import { PRESET_AVATARS, compressImageFile } from '../data/presetAvatars';
import {
  X,
  Upload,
  Check,
  Camera,
  Image as ImageIcon,
  Sparkles,
  Link as LinkIcon,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

interface ProfilePictureModalProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedUser: User) => void;
}

export const ProfilePictureModal: React.FC<ProfilePictureModalProps> = ({
  user,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [selectedAvatar, setSelectedAvatar] = useState<string>(user.avatar);
  const [activeTab, setActiveTab] = useState<'upload' | 'preset' | 'url'>('upload');
  const [customUrl, setCustomUrl] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('ဓာတ်ပုံဖိုင် အမျိုးအစားသာ တင်နိုင်ပါသည် (JPG, PNG, WebP)');
      return;
    }

    try {
      setIsProcessing(true);
      setErrorMessage(null);
      // Auto-compress to clean square avatar
      const compressedDataUri = await compressImageFile(file, 256, 0.88);
      setSelectedAvatar(compressedDataUri);
      setSuccessMessage('ဓာတ်ပုံ အောင်မြင်စွာ တင်ပြီးပါပြီ။');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch {
      setErrorMessage('ဓာတ်ပုံ ဖတ်ရှုရာတွင် ချို့ယွင်းချက်ဖြစ်ပေါ်ပါသည်။ အခြားပုံဖြင့် စမ်းကြည့်ပါ။');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplyUrl = () => {
    const trimmed = customUrl.trim();
    if (!trimmed) {
      setErrorMessage('ဓာတ်ပုံ URL လိပ်စာ ထည့်သွင်းပေးပါ');
      return;
    }
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      setErrorMessage('ကျေးဇူးပြု၍ http:// သို့မဟုတ် https:// ဖြင့် စတင်သော URL ထည့်ပါ');
      return;
    }
    setSelectedAvatar(trimmed);
    setErrorMessage(null);
    setSuccessMessage('URL ပုံ ထည့်သွင်းပြီးပါပြီ။');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleSave = () => {
    setIsProcessing(true);
    setErrorMessage(null);

    const result = ClassroomDB.updateUserProfilePicture(user.id, selectedAvatar);
    if (!result.success || !result.user) {
      setErrorMessage(result.error || 'ပရိုဖိုင်ဓာတ်ပုံ သိမ်းဆည်းရာတွင် အမှားဖြစ်ပေါ်ပါသည်');
      setIsProcessing(false);
      return;
    }

    onSuccess(result.user);
    setIsProcessing(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-150">
      <div
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 leading-tight">
                Profile Picture (ပရိုဖိုင်ဓာတ်ပုံ)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {user.name} ({user.role === 'admin' ? 'Instructor/Admin' : 'Student'})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="ပိတ်မည်"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {/* Messages */}
          {errorMessage && (
            <div className="flex items-center gap-2 p-3 text-xs sm:text-sm bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-xl border border-rose-200 dark:border-rose-900/50">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
          {successMessage && (
            <div className="flex items-center gap-2 p-3 text-xs sm:text-sm bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-xl border border-emerald-200 dark:border-emerald-900/50">
              <Check className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Current / Selected Preview */}
          <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
            <div className="relative group shrink-0">
              <img
                src={selectedAvatar}
                alt="Avatar preview"
                referrerPolicy="no-referrer"
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover ring-4 ring-indigo-500/20 shadow-md"
                onError={(e) => {
                  // Fallback if URL is broken
                  (e.target as HTMLImageElement).src =
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';
                }}
              />
              <div className="absolute inset-0 rounded-full bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera className="w-5 h-5 text-white drop-shadow" />
              </div>
            </div>

            <div className="text-center sm:text-left flex-1 min-w-0">
              <span className="text-xs uppercase tracking-wider font-semibold text-indigo-600 dark:text-indigo-400 block mb-1">
                Preview (အစမ်းမြင်ကွင်း)
              </span>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                {user.name}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                @{user.username} · {user.email}
              </p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                အတန်းတွင်း၊ Post များ၊ Comment များနှင့် People list တွင် ဤပုံကို အသုံးပြုပါမည်။
              </p>
            </div>
          </div>

          {/* Tab Selector */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 text-xs sm:text-sm font-medium rounded-lg transition-all ${
                activeTab === 'upload'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Photo</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('preset')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 text-xs sm:text-sm font-medium rounded-lg transition-all ${
                activeTab === 'preset'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Preset Avatars</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('url')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 text-xs sm:text-sm font-medium rounded-lg transition-all ${
                activeTab === 'url'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <LinkIcon className="w-3.5 h-3.5" />
              <span>Image URL</span>
            </button>
          </div>

          {/* Tab 1: Upload from Device */}
          {activeTab === 'upload' && (
            <div className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-400 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-slate-50/50 dark:bg-slate-800/20 hover:bg-indigo-50/20 dark:hover:bg-indigo-950/20"
              >
                <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-3">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  ဖုန်း သို့မဟုတ် ကွန်ပျူတာထဲမှ ဓာတ်ပုံရွေးချယ်ရန် နှိပ်ပါ
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  JPG, PNG, WebP (အလိုအလျောက် သင့်လျော်သော Profile အရွယ်အစားသို့ ချိန်ညှိပေးပါမည်)
                </p>
                <button
                  type="button"
                  className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Choose Photo File</span>
                </button>
              </div>
            </div>
          )}

          {/* Tab 2: Preset Avatars Gallery */}
          {activeTab === 'preset' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>နမူနာပုံများထဲမှ နှစ်သက်ရာကို ရွေးချယ်ပါ ({PRESET_AVATARS.length} ခု)</span>
                <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-medium">
                  <Sparkles className="w-3.5 h-3.5" />
                  1-Click Select
                </span>
              </div>

              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5 max-h-56 overflow-y-auto p-1">
                {PRESET_AVATARS.map((preset) => {
                  const isSelected = selectedAvatar === preset.url;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setSelectedAvatar(preset.url);
                        setErrorMessage(null);
                      }}
                      className={`relative group rounded-xl overflow-hidden aspect-square border-2 transition-all p-0.5 ${
                        isSelected
                          ? 'border-indigo-600 dark:border-indigo-400 ring-2 ring-indigo-500/30 scale-102'
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500'
                      }`}
                    >
                      <img
                        src={preset.url}
                        alt={preset.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover rounded-lg"
                        loading="lazy"
                      />
                      {isSelected && (
                        <div className="absolute inset-0 bg-indigo-600/30 flex items-center justify-center">
                          <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        </div>
                      )}
                      <span className="absolute bottom-0 inset-x-0 bg-black/60 text-[9px] text-white py-0.5 text-center truncate px-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {preset.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tab 3: Custom URL */}
          {activeTab === 'url' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Image URL (ဓာတ်ပုံ တိုက်ရိုက် Link)
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="url"
                      value={customUrl}
                      onChange={(e) => setCustomUrl(e.target.value)}
                      placeholder="https://example.com/avatar.jpg"
                      className="w-full px-3 py-2 text-xs sm:text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyUrl}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-xl text-xs font-semibold transition-colors shrink-0"
                  >
                    Apply
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                အင်တာနက်ပေါ်ရှိ မည်သည့်ပုံ Direct Image Link ကိုမဆို ထည့်သွင်းနိုင်ပါသည်။
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-850">
          <button
            type="button"
            onClick={() => setSelectedAvatar(user.avatar)}
            disabled={selectedAvatar === user.avatar || isProcessing}
            className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-40 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>မူလပုံအတိုင်း ပြန်ထားမည်</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isProcessing}
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Photo (သိမ်းမည်)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
