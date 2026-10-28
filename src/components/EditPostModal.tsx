import React, { useState, useEffect, useRef } from 'react';
import { CoursePost, User, Attachment } from '../types/classroom';
import { ClassroomDB } from '../services/storage';
import { formatFileSize, getFileTypeCategory } from '../utils/fileHelpers';
import {
  X,
  Pin,
  Clock,
  Calendar,
  Paperclip,
  Plus,
  Video,
  AlertCircle,
  Save,
  Trash2,
  Send,
} from 'lucide-react';

interface EditPostModalProps {
  isOpen: boolean;
  onClose: () => void;
  post: CoursePost | null;
  currentUser: User;
  currentPinnedCount: number;
  onSaved: () => void;
}

export const EditPostModal: React.FC<EditPostModalProps> = ({
  isOpen,
  onClose,
  post,
  currentUser,
  currentPinnedCount,
  onSaved,
}) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [postType, setPostType] = useState<'lesson' | 'announcement' | 'resource'>('lesson');
  const [isPinned, setIsPinned] = useState(false);
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDateTime, setScheduledDateTime] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (post) {
      setTitle(post.title || '');
      setContent(post.content || '');
      setPostType(post.postType || 'lesson');
      setIsPinned(!!post.isPinned);
      setIsScheduled(post.status === 'scheduled');
      setScheduledDateTime(post.scheduledFor ? post.scheduledFor.slice(0, 16) : '');
      setAttachments(post.attachments || []);
      setErrorMsg(null);
    }
  }, [post, isOpen]);

  if (!isOpen || !post) return null;

  // Check if pinning limit will be exceeded
  const wouldExceedPinLimit = !post.isPinned && isPinned && currentPinnedCount >= 3;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const filesArray = Array.from(e.target.files);

    filesArray.forEach((file) => {
      const typeCategory = getFileTypeCategory(file.name);
      const reader = new FileReader();

      if (file.size < 6 * 1024 * 1024) {
        reader.onload = (event) => {
          const resultUrl = event.target?.result as string;
          const newAtt: Attachment = {
            id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: file.name,
            size: formatFileSize(file.size),
            type: typeCategory,
            url: resultUrl || URL.createObjectURL(file),
          };
          setAttachments((prev) => [...prev, newAtt]);
        };
        reader.readAsDataURL(file);
      } else {
        const newAtt: Attachment = {
          id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: file.name,
          size: formatFileSize(file.size),
          type: typeCategory,
          url: URL.createObjectURL(file),
        };
        setAttachments((prev) => [...prev, newAtt]);
      }
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveAttachment = (attId: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== attId));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setErrorMsg('ကျေးဇူးပြု၍ ခေါင်းစဉ်နှင့် စာသားကို ဖြည့်သွင်းပါ။');
      return;
    }

    if (isScheduled && !scheduledDateTime) {
      setErrorMsg('ကျေးဇူးပြု၍ Schedule ပြုလုပ်မည့် နေ့စွဲနှင့် အချိန်ကို ရွေးချယ်ပေးပါ။');
      return;
    }

    if (isPinned && !post.isPinned && currentPinnedCount >= 3) {
      setErrorMsg('အများဆုံး Pin ၃ ခုသာ သတ်မှတ်နိုင်ပါသည်။ အခြား Post တစ်ခုကို အရင် Unpin လုပ်ပါ။');
      return;
    }

    const updates: Partial<CoursePost> = {
      title: title.trim(),
      content: content.trim(),
      postType,
      isPinned,
      attachments: attachments.length > 0 ? attachments : undefined,
      zoomMeeting: undefined,
    };

    // If pin status changed
    if (isPinned && !post.isPinned) {
      updates.pinnedAt = new Date().toISOString();
      updates.pinOrder = currentPinnedCount + 1;
    } else if (!isPinned && post.isPinned) {
      updates.pinnedAt = undefined;
      updates.pinOrder = undefined;
    }

    // Schedule status handling
    if (isScheduled && scheduledDateTime) {
      const scheduledDateObj = new Date(scheduledDateTime);
      const formattedDate = scheduledDateObj.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      updates.status = 'scheduled';
      updates.scheduledFor = scheduledDateObj.toISOString();
      updates.scheduledForDisplay = formattedDate;
      updates.createdAt = `Scheduled for ${formattedDate}`;
    } else {
      updates.status = 'published';
      updates.scheduledFor = undefined;
      updates.scheduledForDisplay = undefined;
    }

    const res = ClassroomDB.updatePost(post.id, updates, currentUser);
    if (res.error) {
      setErrorMsg(res.error);
      return;
    }

    onSaved();
    onClose();
  };

  const handlePublishNow = () => {
    const res = ClassroomDB.publishScheduledPostNow(post.id, currentUser);
    if (res.error) {
      setErrorMsg(res.error);
      return;
    }
    onSaved();
    onClose();
  };

  // Helper chips for quick dates
  const setQuickTime = (hoursFromNow: number) => {
    const d = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
    // Format YYYY-MM-DDTHH:mm
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    setScheduledDateTime(`${year}-${month}-${day}T${hours}:${minutes}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-6">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850">
          <div className="flex items-center gap-2">
            <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
              Edit Post (ပို့စ်ပြင်ဆင်ရန်)
            </span>
            {post.isPinned && (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/80 px-2 py-0.5 rounded-full">
                <Pin className="w-2.5 h-2.5 fill-amber-600 dark:fill-amber-400" />
                Pinned
              </span>
            )}
            {post.status === 'scheduled' && (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-950/80 px-2 py-0.5 rounded-full">
                <Clock className="w-2.5 h-2.5" />
                Scheduled
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="m-4 mb-0 flex items-center gap-2 px-3.5 py-2.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs rounded-xl">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Post Type Selector */}
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Post Type:
            </label>
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setPostType('lesson')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  postType === 'lesson'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Lesson
              </button>
              <button
                type="button"
                onClick={() => setPostType('announcement')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  postType === 'announcement'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Announcement
              </button>
              <button
                type="button"
                onClick={() => setPostType('resource')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  postType === 'resource'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Resource
              </button>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Title (ခေါင်းစဉ်)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500"
              required
            />
          </div>

          {/* Content */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Content (စာသားနှင့် အကြောင်းအရာ)
            </label>
            <textarea
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 resize-none"
              required
            />
          </div>

          {/* Pin Post Control (Up to 3 pinned posts) */}
          <div className="p-3 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300">
                <Pin className="w-4 h-4 fill-amber-600 dark:fill-amber-400" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                  Pin to Top (အတန်းထိပ်တွင် Pin ထားရှိရန်)
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {post.isPinned
                    ? `ဤ Post အား ထိပ်တွင် Pin ထားရှိပါသည်။ (အတန်းတွင် စုစုပေါင်း ${currentPinnedCount}/3 ခု Pin ထားပြီး)`
                    : `ဤအတန်းအတွက် လက်ရှိ ${currentPinnedCount}/3 ခု Pin ပြုလုပ်ထားပါသည်။ (အများဆုံး ၃ ခု)`}
                </span>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isPinned}
                onChange={(e) => {
                  if (e.target.checked && wouldExceedPinLimit) {
                    setErrorMsg('အများဆုံး Pin ၃ ခုသာ သတ်မှတ်နိုင်ပါသည်။ အခြား Post တစ်ခုကို အရင် unpin လုပ်ပါ။');
                    return;
                  }
                  setErrorMsg(null);
                  setIsPinned(e.target.checked);
                }}
                className="sr-only peer"
              />
              <div className="w-10 h-5.5 bg-slate-300 dark:bg-slate-700 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
            </label>
          </div>

          {/* Schedule vs Publish Control */}
          <div className="p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/20 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Release Schedule (ထုတ်ပြန်မည့် အချိန်သတ်မှတ်ချက်)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isScheduled}
                    onChange={(e) => setIsScheduled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5.5 bg-slate-300 dark:bg-slate-700 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>
            </div>

            {isScheduled ? (
              <div className="space-y-2 pt-1 border-t border-indigo-100 dark:border-indigo-900/40">
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  သတ်မှတ်ထားသော နေ့စွဲနှင့် အချိန် (Date & Time):
                </label>
                <input
                  type="datetime-local"
                  value={scheduledDateTime}
                  onChange={(e) => setScheduledDateTime(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-indigo-500"
                  required={isScheduled}
                />

                {/* Quick Helper Chips */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">Quick set:</span>
                  <button
                    type="button"
                    onClick={() => setQuickTime(1)}
                    className="px-2 py-0.5 text-[10px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 rounded-md text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                  >
                    +1 Hour
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickTime(3)}
                    className="px-2 py-0.5 text-[10px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 rounded-md text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                  >
                    +3 Hours
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickTime(24)}
                    className="px-2 py-0.5 text-[10px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 rounded-md text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                  >
                    Tomorrow (+24 hrs)
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Post is published and visible to all enrolled students immediately.
              </p>
            )}

            {/* Quick Publish Now Button for Scheduled Post */}
            {post.status === 'scheduled' && (
              <div className="pt-2 border-t border-indigo-100 dark:border-indigo-900/40 flex items-center justify-between">
                <span className="text-[11px] text-indigo-700 dark:text-indigo-300 font-medium">
                  အချိန်မစောင့်ဘဲ ချက်ချင်းထုတ်ပြန်လိုပါသလား?
                </span>
                <button
                  type="button"
                  onClick={handlePublishNow}
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3 h-3" />
                  <span>Publish Now (ချက်ချင်းတင်ရန်)</span>
                </button>
              </div>
            )}
          </div>

          {/* Attachments Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Attached Files ({attachments.length})</span>
              </label>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="*/*"
                onChange={handleFileChange}
                className="hidden"
                id="edit-post-file-upload"
              />
              <label
                htmlFor="edit-post-file-upload"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-xs font-semibold cursor-pointer border border-indigo-200 dark:border-indigo-800 transition-colors shadow-2xs"
              >
                <Paperclip className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>+ Add File (ဖိုင်ထည့်ရန်)</span>
              </label>
            </div>

            {attachments.length > 0 && (
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                  >
                    <span className="truncate text-slate-800 dark:text-slate-200">
                      {att.name} <span className="text-slate-400 font-mono">({att.size})</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(att.id)}
                      className="p-1 text-slate-400 hover:text-rose-500 rounded transition-colors cursor-pointer"
                      title="Remove file"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer"
            >
              Cancel (ပယ်ဖျက်မည်)
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Changes (သိမ်းဆည်းမည်)</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
