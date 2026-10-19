import React from 'react';
import { CoursePost, User } from '../types/classroom';
import { ClassroomDB } from '../services/storage';
import { Pin, X, ArrowRightLeft, AlertCircle } from 'lucide-react';

interface PinSwapModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetPost: CoursePost | null;
  pinnedPosts: CoursePost[];
  currentUser: User;
  onSwapped: () => void;
}

export const PinSwapModal: React.FC<PinSwapModalProps> = ({
  isOpen,
  onClose,
  targetPost,
  pinnedPosts,
  currentUser,
  onSwapped,
}) => {
  if (!isOpen || !targetPost) return null;

  const handleSwap = (postToUnpinId: string) => {
    // Unpin selected post
    ClassroomDB.togglePinPost(postToUnpinId, currentUser);
    // Pin target post
    ClassroomDB.togglePinPost(targetPost.id, currentUser);
    onSwapped();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-amber-50/70 dark:bg-amber-950/30">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
            <Pin className="w-4 h-4 fill-amber-600 dark:fill-amber-400" />
            <span className="text-sm font-bold">
              Pin Limit Reached (အများဆုံး ၃ ခု ပြည့်နေပါသည်)
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            ဤအတန်းတွင် Pinned Post <strong>အများဆုံး ၃ ခု</strong> သတ်မှတ်ထားရှိပြီး ဖြစ်ပါသည်။ အောက်ပါ Post အသစ်အား Pin ထိုးရန်အတွက် လက်ရှိ Pin ထားသော ပို့စ် ၃ ခုအနက်မှ အစားထိုးလိုသည့် ပို့စ်တစ်ခုကို ရွေးချယ်ပေးပါ-
          </p>

          {/* Target Post Preview */}
          <div className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60">
            <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider block">
              New Post to Pin:
            </span>
            <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 block mt-0.5 truncate">
              {targetPost.title}
            </span>
          </div>

          {/* Currently Pinned Posts to Replace */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
              Select one post to unpin and replace:
            </span>
            {pinnedPosts.slice(0, 3).map((p, idx) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 hover:border-amber-400 dark:hover:border-amber-600 transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300">
                      Pin #{idx + 1}
                    </span>
                    <span className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate block max-w-[240px]">
                      {p.title}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-0.5 truncate">
                    {p.createdAt} · {p.postType}
                  </span>
                </div>

                <button
                  onClick={() => handleSwap(p.id)}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:scale-98 text-white rounded-lg text-xs font-semibold shrink-0 shadow-2xs flex items-center gap-1 transition-all cursor-pointer"
                >
                  <ArrowRightLeft className="w-3 h-3" />
                  <span>Replace</span>
                </button>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer"
            >
              Cancel (ပယ်ဖျက်မည်)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
