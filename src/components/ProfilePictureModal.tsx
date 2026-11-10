import React, { useState } from 'react';
import { User } from '../types/classroom';
import { ClassroomDB } from '../services/storage';
import {
  PRESET_AVATARS,
  DEFAULT_AVATAR_SVG,
  resolveAvatarUrl,
  toCloudAvatarKeyOrUrl,
  getAvatarCloudStorageInfo,
} from '../data/presetAvatars';
import {
  X,
  Check,
  Camera,
  Sparkles,
  Link as LinkIcon,
  AlertCircle,
  RefreshCw,
  Database,
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
  const initialCloudKeyOrUrl = toCloudAvatarKeyOrUrl(user.avatar, 'admin');
  const isInitialExternalUrl =
    initialCloudKeyOrUrl.startsWith('http://') || initialCloudKeyOrUrl.startsWith('https://');

  const [selectedAvatar, setSelectedAvatar] = useState<string>(
    isInitialExternalUrl ? initialCloudKeyOrUrl : resolveAvatarUrl(initialCloudKeyOrUrl)
  );
  const [activeTab, setActiveTab] = useState<'preset' | 'url'>(
    isInitialExternalUrl ? 'url' : 'preset'
  );
  const [customUrl, setCustomUrl] = useState<string>(
    isInitialExternalUrl ? initialCloudKeyOrUrl : ''
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen || user.role !== 'admin') return null;

  const storageInfo = getAvatarCloudStorageInfo(selectedAvatar);

  const handleApplyUrl = () => {
    const trimmed = customUrl.trim();
    if (!trimmed) {
      setErrorMessage('ဓာတ်ပုံ External URL လိပ်စာ ထည့်သွင်းပေးပါ');
      return;
    }
    if (trimmed.startsWith('data:')) {
      setErrorMessage(
        'Supabase Egress သက်သာစေရန် Base64 (data:) ပုံများ လက်မခံပါ။ https:// ဖြင့်စတင်သော External URL သို့မဟုတ် Preset Avatar ကိုသာ သုံးပါ။'
      );
      return;
    }
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      setErrorMessage('ကျေးဇူးပြု၍ http:// သို့မဟုတ် https:// ဖြင့် စတင်သော External URL ထည့်ပါ');
      return;
    }
    if (trimmed.length > 500) {
      setErrorMessage('External URL သည် စာလုံးရေ 500 အောက်သာ ရှိရပါမည်။');
      return;
    }
    setSelectedAvatar(trimmed);
    setErrorMessage(null);
    setSuccessMessage('External URL ပုံ ထည့်သွင်းပြီးပါပြီ။');
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
                {user.name} (Lead Mentor (Admin))
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="ပိတ်မည်"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
          {/* Zero-Base64 Supabase Storage Guard Notice */}
          <div className="p-3 rounded-xl bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-start gap-2.5">
            <Database className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-[11px] sm:text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed">
              <span className="font-bold">Zero-Base64 Avatar Storage Active:</span> Supabase Database ထဲသို့ Base64 ပုံများ လုံးဝမထည့်ဘဲ{' '}
              <code className="font-mono font-bold px-1 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60">
                Preset Key
              </code>{' '}
              သို့မဟုတ်{' '}
              <code className="font-mono font-bold px-1 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60">
                External URL
              </code>{' '}
              ({storageInfo.byteSize} Bytes သာ) ဖြင့် သိမ်းဆည်းပါသည်။
            </div>
          </div>

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
                src={resolveAvatarUrl(selectedAvatar)}
                alt="Avatar preview"
                referrerPolicy="no-referrer"
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover ring-4 ring-indigo-500/20 shadow-md"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = DEFAULT_AVATAR_SVG;
                }}
              />
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
              <div className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-200/80 dark:bg-slate-800 text-[10px] font-mono text-slate-700 dark:text-slate-300 max-w-full truncate">
                <span>Cloud Value:</span>
                <strong className="text-indigo-600 dark:text-indigo-400 truncate">
                  {storageInfo.cloudKeyOrUrl}
                </strong>
                <span>({storageInfo.byteSize} B)</span>
              </div>
            </div>
          </div>

          {/* Tab Selector (Preset Key vs External URL only) */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('preset')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 text-xs sm:text-sm font-medium rounded-lg transition-all cursor-pointer ${
                activeTab === 'preset'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Preset Key Avatars</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('url')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 text-xs sm:text-sm font-medium rounded-lg transition-all cursor-pointer ${
                activeTab === 'url'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <LinkIcon className="w-3.5 h-3.5" />
              <span>External Image URL</span>
            </button>
          </div>

          {/* Tab 1: Preset Avatars Gallery (Stored as 15-Byte Preset Key in Supabase) */}
          {activeTab === 'preset' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Preset Key ပုံများထဲမှ ရွေးချယ်ပါ ({PRESET_AVATARS.length} ခု)</span>
                <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-medium">
                  <Sparkles className="w-3.5 h-3.5" />
                  15 Bytes Preset Key
                </span>
              </div>

              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5 max-h-56 overflow-y-auto p-1">
                {PRESET_AVATARS.map((preset) => {
                  const isSelected =
                    selectedAvatar === preset.url ||
                    selectedAvatar === preset.presetKey ||
                    storageInfo.cloudKeyOrUrl === preset.presetKey;
                  return (
                    <button
                      key={preset.presetKey}
                      type="button"
                      onClick={() => {
                        setSelectedAvatar(preset.url);
                        setErrorMessage(null);
                      }}
                      className={`relative group rounded-xl overflow-hidden aspect-square border-2 transition-all p-0.5 cursor-pointer ${
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
                      <span className="absolute bottom-0 inset-x-0 bg-black/65 text-[9px] text-white py-0.5 text-center truncate px-1 opacity-0 group-hover:opacity-100 transition-opacity font-mono">
                        {preset.presetKey}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tab 2: External Image URL */}
          {activeTab === 'url' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  External Image URL (https:// ဖြင့်စတင်သော ဓာတ်ပုံ Link)
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="url"
                      value={customUrl}
                      onChange={(e) => setCustomUrl(e.target.value)}
                      placeholder="https://example.com/mentor-avatar.jpg"
                      className="w-full px-3 py-2 text-xs sm:text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyUrl}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-xl text-xs font-semibold transition-colors shrink-0 cursor-pointer"
                  >
                    Apply URL
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                External URL ကို သုံးပါက Supabase Database ထဲတွင် URL စာသား (~60 Bytes) ကိုသာ သိမ်းဆည်းသောကြောင့် Database နှင့် Egress လုံးဝ မတက်ပါ။
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-850">
          <button
            type="button"
            onClick={() => setSelectedAvatar(resolveAvatarUrl(user.avatar))}
            disabled={isProcessing}
            className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-40 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>မူလပုံအတိုင်း ပြန်ထားမည်</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isProcessing}
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
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
