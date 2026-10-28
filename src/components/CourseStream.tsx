import React, { useState, useRef } from 'react';
import { Course, CoursePost, User, VideoAsset, Attachment } from '../types/classroom';
import { SecureVideoPlayer } from './SecureVideoPlayer';
import { EditPostModal } from './EditPostModal';
import { PinSwapModal } from './PinSwapModal';
import { CourseBannerModal } from './CourseBannerModal';
import { useBackHandler } from '../utils/backNavigation';
import { formatFileSize, getFileTypeCategory } from '../utils/fileHelpers';
import { renderTextWithLinks } from '../utils/linkify';
import { ClassroomDB } from '../services/storage';
import {
  MessageSquare,
  ThumbsUp,
  Pin,
  Paperclip,
  Send,
  AlertCircle,
  FileText,
  Clock,
  Sparkles,
  Share2,
  Lock,
  Laptop,
  Plus,
  X,
  Download,
  File,
  FileCode,
  FileArchive,
  Image,
  Video as VideoIcon,
  Music,
  Trash2,
  Eye,
  UploadCloud,
  Calendar,
  Edit3,
  ChevronDown,
  ChevronUp,
  CalendarClock,
  CheckCircle,
  Users,
  FilePlus,
  FileUp,
  CalendarCheck,
  Hand,
} from 'lucide-react';

interface CourseStreamProps {
  course: Course;
  currentUser: User;
  posts: CoursePost[];
  onRefresh: () => void;
  textProtectionEnabled: boolean;
  onOpenAttendance?: () => void;
}

export const CourseStream: React.FC<CourseStreamProps> = ({
  course,
  currentUser,
  posts,
  onRefresh,
  textProtectionEnabled,
  onOpenAttendance,
}) => {
  // Post Composer State (for Admin/Instructor)
  const [isComposing, setIsComposing] = useState(false);
  const [postTitle, setPostTitle] = useState('');
  const [postContent, setPostContent] = useState('');
  const [postType, setPostType] = useState<'lesson' | 'announcement' | 'resource'>('lesson');

  // Scheduling & Pinning State for Composer
  const [publishMode, setPublishMode] = useState<'now' | 'schedule'>('now');
  const [postDropdownOpen, setPostDropdownOpen] = useState(false);
  const [scheduledDateTime, setScheduledDateTime] = useState('');
  const [pinUponPublish, setPinUponPublish] = useState(false);

  // Any-file upload attachments state
  const [attachedFiles, setAttachedFiles] = useState<Attachment[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modals state
  const [editingPost, setEditingPost] = useState<CoursePost | null>(null);
  const [pinSwapTarget, setPinSwapTarget] = useState<CoursePost | null>(null);
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);
  const [showBannerModal, setShowBannerModal] = useState(false);
  const [postToDeleteId, setPostToDeleteId] = useState<string | null>(null);

  // Step-by-step mobile Back button handlers for Stream modals & composer
  useBackHandler(isComposing, () => setIsComposing(false));
  useBackHandler(!!editingPost, () => setEditingPost(null));
  useBackHandler(!!pinSwapTarget, () => setPinSwapTarget(null));
  useBackHandler(!!previewImage, () => setPreviewImage(null));
  useBackHandler(showBannerModal, () => setShowBannerModal(false));
  useBackHandler(!!postToDeleteId, () => setPostToDeleteId(null));

  // Scheduled posts drawer expand state
  const [scheduledDrawerOpen, setScheduledDrawerOpen] = useState(true);

  const [rateLimitError, setRateLimitError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Instructor permission check (Admin or Co-Admin)
  const isInstructor = currentUser.role === 'admin' || currentUser.role === 'co_admin';

  // Comment composer state per post
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});

  // Filtered post collections
  const pinnedPosts = posts.filter((p) => p.isPinned && p.status !== 'scheduled');
  const scheduledPosts = posts.filter((p) => p.status === 'scheduled');
  const currentPinnedCount = posts.filter((p) => p.isPinned).length;

  // Process incoming file list (works for file input & drag-and-drop)
  const processFiles = (fileList: FileList | File[]) => {
    const filesArray = Array.from(fileList);
    if (filesArray.length === 0) return;

    filesArray.forEach((file) => {
      const typeCategory = getFileTypeCategory(file.name);
      const reader = new FileReader();

      if (file.size < 6 * 1024 * 1024) {
        reader.onload = (e) => {
          const resultUrl = e.target?.result as string;
          const newAtt: Attachment = {
            id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: file.name,
            size: formatFileSize(file.size),
            type: typeCategory,
            url: resultUrl || URL.createObjectURL(file),
          };
          setAttachedFiles((prev) => [...prev, newAtt]);
        };
        reader.readAsDataURL(file);
      } else {
        const fileUrl = URL.createObjectURL(file);
        const newAtt: Attachment = {
          id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: file.name,
          size: formatFileSize(file.size),
          type: typeCategory,
          url: fileUrl,
        };
        setAttachedFiles((prev) => [...prev, newAtt]);
      }
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleRemoveAttachedFile = (fileId: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  // Helper chips for quick scheduled date & time
  const setComposerQuickTime = (hoursFromNow: number) => {
    const d = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    setScheduledDateTime(`${year}-${month}-${day}T${hours}:${minutes}`);
    setPublishMode('schedule');
  };

  const handleCreatePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!postTitle.trim() || !postContent.trim()) return;

    if (publishMode === 'schedule' && !scheduledDateTime) {
      setRateLimitError('ကျေးဇူးပြု၍ Schedule ပြုလုပ်မည့် နေ့စွဲနှင့် အချိန်ကို ရွေးချယ်ပေးပါ။');
      setTimeout(() => setRateLimitError(null), 4000);
      return;
    }

    if (pinUponPublish && currentPinnedCount >= 3) {
      setRateLimitError('အများဆုံး Pin ၃ ခုသာ သတ်မှတ်နိုင်ပါသည်။ အခြား Post တစ်ခုကို အရင် Unpin လုပ်ပါ။');
      setTimeout(() => setRateLimitError(null), 4000);
      return;
    }

    let scheduledFor: string | undefined = undefined;
    let scheduledForDisplay: string | undefined = undefined;
    if (publishMode === 'schedule' && scheduledDateTime) {
      const schedObj = new Date(scheduledDateTime);
      scheduledFor = schedObj.toISOString();
      scheduledForDisplay = schedObj.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }

    const res = ClassroomDB.addPost(
      {
        courseId: course.id,
        authorId: currentUser.id,
        authorName: currentUser.name,
        authorRole: currentUser.role,
        authorAvatar: currentUser.avatar,
        title: postTitle.trim(),
        content: postContent.trim(),
        postType,
        attachments: attachedFiles.length > 0 ? attachedFiles : undefined,
        status: publishMode === 'schedule' ? 'scheduled' : 'published',
        scheduledFor,
        scheduledForDisplay,
        isPinned: pinUponPublish,
        pinOrder: pinUponPublish ? currentPinnedCount + 1 : undefined,
        pinnedAt: pinUponPublish ? new Date().toISOString() : undefined,
      },
      currentUser
    );

    if (res.error) {
      setRateLimitError(res.error);
      setTimeout(() => setRateLimitError(null), 4000);
      return;
    }

    // Reset composer
    setPostTitle('');
    setPostContent('');
    setAttachedFiles([]);
    setPublishMode('now');
    setScheduledDateTime('');
    setPinUponPublish(false);
    setIsComposing(false);

    setSuccessToast(
      publishMode === 'schedule'
        ? `Post အား ${scheduledForDisplay} တွင် တင်ရန် အချိန်သတ်မှတ်ပြီးပါပြီ!`
        : 'Post အား Stream ထဲသို့ ချက်ချင်းတင်ပြီးပါပြီ!'
    );
    setTimeout(() => setSuccessToast(null), 3500);

    onRefresh();
  };

  const handleTogglePin = (postId: string) => {
    const target = posts.find((p) => p.id === postId);
    if (!target) return;

    if (target.isPinned) {
      // Unpin
      ClassroomDB.togglePinPost(postId, currentUser);
      setSuccessToast('Post အား Unpin ပြုလုပ်ပြီးပါပြီ');
      setTimeout(() => setSuccessToast(null), 2500);
      onRefresh();
    } else {
      // Check if limit of 3 is reached
      const currentlyPinned = posts.filter((p) => p.isPinned);
      if (currentlyPinned.length >= 3) {
        setPinSwapTarget(target);
        return;
      }
      const res = ClassroomDB.togglePinPost(postId, currentUser);
      if (!res.success && res.error) {
        setRateLimitError(res.error);
        setTimeout(() => setRateLimitError(null), 4000);
      } else {
        setSuccessToast(`Post အား ထိပ်တွင် Pin ပြုလုပ်ပြီးပါပြီ (Pin #${res.pinnedCount || 1}/3)`);
        setTimeout(() => setSuccessToast(null), 2500);
        onRefresh();
      }
    }
  };

  const handlePublishNow = (postId: string) => {
    const res = ClassroomDB.publishScheduledPostNow(postId, currentUser);
    if (res.error) {
      setRateLimitError(res.error);
      setTimeout(() => setRateLimitError(null), 4000);
      return;
    }
    setSuccessToast('Scheduled Post အား ချက်ချင်းထုတ်ပြန်ပြီးပါပြီ!');
    setTimeout(() => setSuccessToast(null), 3000);
    onRefresh();
  };

  const handleDeletePost = (postId: string) => {
    setPostToDeleteId(postId);
  };

  const handleConfirmDeletePost = () => {
    if (!postToDeleteId) return;
    ClassroomDB.deletePost(postToDeleteId, currentUser);
    setPostToDeleteId(null);
    setSuccessToast('Post အား App နှင့် Supabase SQL Database မှ ဖျက်သိမ်းပြီးပါပြီ');
    setTimeout(() => setSuccessToast(null), 2500);
    onRefresh();
  };

  const handleToggleLike = (postId: string) => {
    ClassroomDB.toggleLike(postId, currentUser.id);
    onRefresh();
  };

  const handleAddComment = (postId: string) => {
    const text = commentInputs[postId]?.trim();
    if (!text) return;

    const res = ClassroomDB.addComment(postId, text, currentUser);
    if (res.error) {
      setRateLimitError(res.error);
      setTimeout(() => setRateLimitError(null), 4000);
      return;
    }

    setCommentInputs((prev) => ({ ...prev, [postId]: '' }));
    onRefresh();
  };

  const handleDeleteComment = (postId: string, commentId: string) => {
    const ok = ClassroomDB.deleteComment(postId, commentId, currentUser);
    if (ok) {
      setSuccessToast('Comment အား App နှင့် SQL Database မှ ဖျက်သိမ်းပြီးပါပြီ');
      setTimeout(() => setSuccessToast(null), 2500);
      onRefresh();
    }
  };

  const handleLessonViewed = (lessonPostId: string) => {
    ClassroomDB.markLessonCompleted(currentUser.id, course.id, lessonPostId);
    onRefresh();
  };

  const handleContentContextMenu = (e: React.MouseEvent) => {
    if (textProtectionEnabled) {
      e.preventDefault();
      setRateLimitError('Academic Content Protection: Text selection and copying are disabled.');
      setTimeout(() => setRateLimitError(null), 3000);
    }
  };

  const renderFileIcon = (type: string) => {
    switch (type) {
      case 'image':
        return <Image className="w-4 h-4 text-emerald-600 shrink-0" />;
      case 'video':
        return <VideoIcon className="w-4 h-4 text-violet-600 shrink-0" />;
      case 'audio':
        return <Music className="w-4 h-4 text-amber-600 shrink-0" />;
      case 'zip':
        return <FileArchive className="w-4 h-4 text-amber-700 shrink-0" />;
      case 'code':
        return <FileCode className="w-4 h-4 text-blue-600 shrink-0" />;
      case 'pdf':
        return <FileText className="w-4 h-4 text-rose-600 shrink-0" />;
      case 'sheet':
        return <FileText className="w-4 h-4 text-emerald-700 shrink-0" />;
      case 'slide':
        return <FileText className="w-4 h-4 text-orange-600 shrink-0" />;
      case 'doc':
        return <FileText className="w-4 h-4 text-indigo-600 shrink-0" />;
      default:
        return <File className="w-4 h-4 text-slate-600 shrink-0" />;
    }
  };

  return (
    <div
      onContextMenu={handleContentContextMenu}
      className={`space-y-4 sm:space-y-6 w-full max-w-full ${textProtectionEnabled ? 'select-none' : ''}`}
    >
      {/* Toast Alert for Rate Limiting / Content Protection */}
      {rateLimitError && (
        <div className="fixed bottom-6 right-4 sm:right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-slate-900 border border-amber-500/40 text-amber-200 text-xs rounded-xl shadow-2xl backdrop-blur-md max-w-[calc(100vw-32px)]">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="truncate">{rateLimitError}</span>
        </div>
      )}

      {/* Success Notification Toast */}
      {successToast && (
        <div className="fixed bottom-6 right-4 sm:right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-emerald-950 border border-emerald-500/50 text-emerald-100 text-xs rounded-xl shadow-2xl backdrop-blur-md max-w-[calc(100vw-32px)] animate-fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="truncate">{successToast}</span>
        </div>
      )}

      {/* Course Banner Hero — Full Unobstructed 4:1 Google Classroom Header Photo for Mobile, Computer & Web */}
      <div className="rounded-2xl overflow-hidden shadow-xs border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900">
        {/* Pure 4:1 Header Image Container (1000 × 250 proportion on all devices, 100% bright & clear) */}
        <div className="relative w-full aspect-[4/1] bg-slate-900 overflow-hidden group">
          <img
            src={course.bannerImage}
            alt={course.title}
            referrerPolicy="no-referrer"
            onClick={() => setPreviewImage({ url: course.bannerImage, name: `${course.title} - Header Photo` })}
            className="w-full h-full object-cover object-center cursor-zoom-in transition-transform duration-300"
            title="ပုံအကြီးချဲ့ကြည့်ရန် နှိပ်ပါ (Click to view full header photo)"
          />

          {/* Top-Right Customize Button for Admin & Co-Admin */}
          {isInstructor && (
            <div className="absolute top-2.5 right-2.5 sm:top-4 sm:right-4 z-10">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowBannerModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-white/95 hover:bg-white text-slate-900 text-[11px] sm:text-xs font-semibold shadow-md border border-slate-200/80 backdrop-blur-md transition-all cursor-pointer"
                title="Customize Classroom Header Photo (1000 × 250 px)"
              >
                <Image className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>Customize Header Photo</span>
              </button>
            </div>
          )}
        </div>

        {/* Dedicated Course Title & Metadata Bar below Header Photo (Never covers the photo on mobile or desktop) */}
        <div className="p-4 sm:p-5 md:p-6 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-mono text-indigo-600 dark:text-indigo-400">
              <span className="font-semibold bg-indigo-50 dark:bg-indigo-950/70 px-2 py-0.5 rounded border border-indigo-200/80 dark:border-indigo-800/60">
                {course.code}
              </span>
              <span>·</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">{course.batch}</span>
              <span>·</span>
              <span className="text-slate-500 dark:text-slate-400">{course.section}</span>
            </div>

            <h1 className="text-base sm:text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-white leading-snug">
              {course.title}
            </h1>

            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 pt-0.5 text-[11px] sm:text-xs text-slate-600 dark:text-slate-400">
              <span>Instructor: <strong className="text-slate-800 dark:text-slate-200">{course.instructorName}</strong></span>
              <span>·</span>
              <span>Enrolled Students: <strong className="text-slate-800 dark:text-slate-200">{course.enrolledStudentIds.length}</strong></span>
              <span>·</span>
              <span className="text-amber-600 dark:text-amber-400 font-medium">📌 Pinned: {pinnedPosts.length}/3</span>
              {isInstructor && scheduledPosts.length > 0 && (
                <>
                  <span>·</span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-medium">⏰ Scheduled: {scheduledPosts.length}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Scheduled Posts Management Drawer (Admin/Instructor Only) */}
      {isInstructor && scheduledPosts.length > 0 && (
        <div className="bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-transparent dark:from-indigo-950/40 dark:via-purple-950/20 rounded-2xl border border-indigo-200 dark:border-indigo-800/80 p-4 sm:p-5 space-y-3 transition-all">
          <div
            onClick={() => setScheduledDrawerOpen(!scheduledDrawerOpen)}
            className="flex items-center justify-between cursor-pointer select-none"
          >
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-xs">
                <CalendarClock className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                    Scheduled Posts ({scheduledPosts.length})
                  </h3>
                  <span className="text-[10px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/60 px-2 py-0.5 rounded-full">
                    သတ်မှတ်ထားသော ပို့စ်များ
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  ဤပို့စ်များကို ကျောင်းသားများ မမြင်တွေ့နိုင်သေးဘဲ သတ်မှတ်ချိန်ရောက်မှ အလိုအလျောက် ပေါ်လာပါမည်။
                </span>
              </div>
            </div>
            <button className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg">
              {scheduledDrawerOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>

          {scheduledDrawerOpen && (
            <div className="space-y-2.5 pt-2 border-t border-indigo-100 dark:border-indigo-900/40">
              {scheduledPosts.map((sp) => (
                <div
                  key={sp.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-xl bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900/50 text-xs shadow-2xs hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 capitalize">
                        {sp.postType}
                      </span>
                      {sp.isPinned && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 flex items-center gap-1">
                          <Pin className="w-2.5 h-2.5 fill-amber-500" />
                          Pinned
                        </span>
                      )}
                      <span className="font-bold text-slate-900 dark:text-slate-100 truncate">
                        {sp.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      <Clock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <span>
                        သတ်မှတ်ချိန်: <strong className="text-indigo-600 dark:text-indigo-400">{sp.scheduledForDisplay || sp.scheduledFor || 'Upcoming'}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 pt-1 sm:pt-0">
                    <button
                      onClick={() => handlePublishNow(sp.id)}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white rounded-lg text-xs font-semibold shadow-2xs flex items-center gap-1 transition-all cursor-pointer"
                      title="Publish immediately to all students"
                    >
                      <Send className="w-3 h-3" />
                      <span>Publish Now</span>
                    </button>
                    <button
                      onClick={() => setEditingPost(sp)}
                      className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => handleDeletePost(sp.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                      title="Delete scheduled post"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pinned Posts Showcase Banner (Up to 3 Pins - for Students & Instructors) */}
      {pinnedPosts.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-transparent dark:from-amber-950/40 dark:via-amber-950/20 rounded-2xl border border-amber-300/80 dark:border-amber-700/50 p-4 sm:p-5 space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500 text-white shadow-xs">
                <Pin className="w-4 h-4 fill-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                    Pinned Posts ({pinnedPosts.length}/3)
                  </h3>
                  <span className="text-[10px] font-semibold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/60 px-2 py-0.5 rounded-full">
                    အရေးကြီး ပင်ထိုးထားသော ပို့စ်များ
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  အတန်း၏ အရေးကြီး ကြေညာချက်နှင့် သင်ခန်းစာ (အများဆုံး ၃ ခု) ကို ထိပ်တွင် စိတ်ကြိုက် ပြင်ဆင်ထားရှိနိုင်ပါသည်။
                </span>
              </div>
            </div>

            {isInstructor && (
              <span className="text-[11px] text-amber-700 dark:text-amber-300 font-mono font-semibold hidden sm:inline-block">
                Slot: {pinnedPosts.length}/3 used
              </span>
            )}
          </div>

          {/* Grid of Pinned Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {pinnedPosts.map((p, idx) => (
              <div
                key={`pinned-${p.id}`}
                className="bg-white dark:bg-slate-900 rounded-xl p-3.5 border border-amber-200 dark:border-amber-800/60 shadow-2xs flex flex-col justify-between space-y-2 hover:border-amber-400 dark:hover:border-amber-500 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 flex items-center gap-1">
                      <Pin className="w-2.5 h-2.5 fill-amber-600 dark:fill-amber-400" />
                      Pin #{idx + 1}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono capitalize">
                      {p.postType}
                    </span>
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 line-clamp-2 leading-snug">
                    {p.title}
                  </h4>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2 mt-1 leading-relaxed">
                    {renderTextWithLinks(p.content)}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                  <span className="text-slate-400 dark:text-slate-500 text-[10px] truncate max-w-[120px]">
                    {p.createdAt}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {isInstructor && (
                      <>
                        <button
                          onClick={() => handleTogglePin(p.id)}
                          className="px-2 py-0.5 text-[10px] text-slate-500 hover:text-amber-600 dark:text-slate-400 dark:hover:text-amber-400 rounded hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors cursor-pointer"
                          title="Unpin this post"
                        >
                          Unpin
                        </button>
                        <button
                          onClick={() => setEditingPost(p)}
                          className="px-2 py-0.5 text-[10px] text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded transition-colors cursor-pointer font-medium flex items-center gap-0.5"
                          title="Edit pinned post"
                        >
                          <Edit3 className="w-2.5 h-2.5" />
                          <span>Edit</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Google Classroom Style Post Composer (Accessible to Instructors only - Admin & Co-Admin) */}
      {isInstructor && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md transition-all overflow-hidden">
          {!isComposing ? (
            /* Collapsed Google Classroom Announcement Bar */
            <div className="p-3.5 sm:p-4.5 flex items-center justify-between gap-3">
            <div
              onClick={() => {
                setIsComposing(true);
                if (!isInstructor && postType === 'lesson') {
                  setPostType('announcement');
                }
              }}
              className="flex items-center gap-3 flex-1 cursor-pointer group"
            >
              <div className="relative shrink-0">
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  referrerPolicy="no-referrer"
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover ring-2 ring-indigo-500/20 group-hover:ring-indigo-500 transition-all"
                />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-white dark:ring-slate-900" />
              </div>
              <div className="flex-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors font-medium truncate">
                {isInstructor
                  ? 'Announce something to your class (အတန်းအတွက် ကြေညာချက် သို့မဟုတ် သင်ခန်းစာ တင်ရန်)...'
                  : 'Announce to your class or ask a question (အတန်းတွင်း မေးခွန်း သို့မဟုတ် အကြောင်းအရာ တင်ရန်)...'}
              </div>
            </div>

            {/* Quick Actions (Add File symbol & Schedule post symbol) */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsComposing(true);
                  if (!isInstructor && postType === 'lesson') setPostType('announcement');
                  setTimeout(() => fileInputRef.current?.click(), 100);
                }}
                className="p-2 sm:px-3 sm:py-1.5 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-800"
                title="Add file (ဖိုင်ထည့်ရန်)"
              >
                <Paperclip className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span className="hidden sm:inline">Add file</span>
              </button>

              {isInstructor && (
                <button
                  type="button"
                  onClick={() => {
                    setIsComposing(true);
                    setPublishMode('schedule');
                    if (!scheduledDateTime) setComposerQuickTime(1);
                  }}
                  className="p-2 sm:px-3 sm:py-1.5 text-slate-600 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/60 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer border border-slate-200 dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-800"
                  title="Schedule post (အချိန်သတ်မှတ်တင်ရန်)"
                >
                  <CalendarClock className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span className="hidden sm:inline">Schedule</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Expanded Google Classroom Post Composer */
          <form onSubmit={handleCreatePost} className="p-4 sm:p-5 space-y-4">
            {/* Header: User profile, Audience selector & Post category */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  referrerPolicy="no-referrer"
                  className="w-10 h-10 rounded-full object-cover ring-2 ring-indigo-500/30 shrink-0"
                />
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                      {currentUser.name}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                      {currentUser.role === 'admin'
                        ? 'Lead Instructor (Admin)'
                        : currentUser.role === 'co_admin'
                        ? 'Co-Admin (တွဲဖက်ဆရာ)'
                        : 'Student (ကျောင်းသား)'}
                    </span>
                  </div>
                  {/* Google Classroom Audience Badge */}
                  <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    <Users className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                    <span>For: <strong>All members</strong> in {course.code} ({course.enrolledStudentIds.length} enrolled)</span>
                  </div>
                </div>
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl text-xs self-start sm:self-auto">
                {isInstructor && (
                  <button
                    type="button"
                    onClick={() => setPostType('lesson')}
                    className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                      postType === 'lesson'
                        ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs font-bold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    Lesson
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPostType('announcement')}
                  className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                    postType === 'announcement'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  Announcement
                </button>
                <button
                  type="button"
                  onClick={() => setPostType('resource')}
                  className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                    postType === 'resource'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {isInstructor ? 'Resource' : 'Resource / Question'}
                </button>
              </div>
            </div>

              {/* Title Input */}
              <div>
                <input
                  type="text"
                  placeholder="Post Title (သင်ခန်းစာ သို့မဟုတ် ကြေညာချက် ခေါင်းစဉ်)..."
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm font-semibold bg-white dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  required
                />
              </div>

              {/* Content Textarea (Google Classroom Announcement Editor Style) */}
              <div>
                <textarea
                  rows={4}
                  placeholder="Announce something to your class (အတန်းတွင်း ကြေညာချက်၊ သင်ခန်းစာ အကြောင်းအရာ သို့မဟုတ် ညွှန်ကြားချက်များ ရေးသားပါ)..."
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                  className="w-full px-3.5 py-3 text-xs sm:text-sm bg-white dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 resize-none transition-all leading-relaxed"
                  required
                />
              </div>

              {/* Google Classroom Attachment Toolbar with Add File Symbol */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`p-3 sm:p-4 rounded-xl border transition-all ${
                  isDraggingOver
                    ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 border-dashed ring-2 ring-indigo-400/20'
                    : 'border-slate-200/90 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/40'
                }`}
              >
                {/* Hidden File Input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="*/*"
                  onChange={handleFileChange}
                  className="hidden"
                  id="google-classroom-file-upload"
                />

                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Google Classroom Add File Button with Paperclip Symbol */}
                    <label
                      htmlFor="google-classroom-file-upload"
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-slate-800 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 text-xs font-semibold border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 shadow-2xs cursor-pointer transition-all active:scale-98"
                      title="Attach documents, slides, images, videos or any files"
                    >
                      <div className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                        <Paperclip className="w-3.5 h-3.5" />
                      </div>
                      <span>Add File (ဖိုင်ထည့်ရန်)</span>
                    </label>

                    {/* Pin to Top Button (Instructors only, up to 3 pins) */}
                    {isInstructor && (
                      <button
                        type="button"
                        onClick={() => {
                          if (!pinUponPublish && currentPinnedCount >= 3) {
                            setRateLimitError('အများဆုံး Pin ၃ ခုသာ သတ်မှတ်နိုင်ပါသည်။ အခြား Post တစ်ခုကို အရင် unpin လုပ်ပါ။');
                            setTimeout(() => setRateLimitError(null), 4000);
                            return;
                          }
                          setPinUponPublish(!pinUponPublish);
                        }}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                          pinUponPublish
                            ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                            : 'bg-white dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                        title="Pin post to the top of the stream (max 3 posts)"
                      >
                        <Pin className={`w-3.5 h-3.5 ${pinUponPublish ? 'fill-amber-500 text-amber-500' : 'text-slate-400'}`} />
                        <span>Pin to Top ({currentPinnedCount}/3)</span>
                      </button>
                    )}
                  </div>

                  <span className="text-[11px] text-slate-400 dark:text-slate-500 hidden sm:inline">
                    Drag & drop files or click Add File
                  </span>
                </div>

                {/* Google Classroom Style Attached Files Grid Cards */}
                {attachedFiles.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-3 border-t border-slate-200/80 dark:border-slate-700/80 mt-3 animate-fade-in">
                    {attachedFiles.map((file) => (
                      <div
                        key={file.id}
                        className="group flex items-center justify-between gap-2.5 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700 text-xs shadow-2xs hover:border-indigo-400 dark:hover:border-indigo-600 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 truncate min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                            {renderFileIcon(file.type)}
                          </div>
                          <div className="truncate min-w-0">
                            <span className="truncate block font-semibold text-slate-800 dark:text-slate-200 text-xs">
                              {file.name}
                            </span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono uppercase">
                              {file.type} · {file.size}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveAttachedFile(file.id)}
                          className="p-1 text-slate-400 hover:text-rose-500 rounded-md transition-colors cursor-pointer shrink-0"
                          title="Remove attached file"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Posting Option Choice: Post to stream vs Schedule post (Instructors only) */}
              {isInstructor && (
                <div className="p-3.5 sm:p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/60 bg-gradient-to-r from-indigo-50/60 via-purple-50/30 to-slate-50/60 dark:from-indigo-950/30 dark:via-purple-950/20 dark:to-slate-900/40 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        Posting Option (တင်မည့်ပုံစံ ရွေးချယ်ပါ):
                      </span>
                    </div>

                    {/* Choice Tabs: Post to stream vs Schedule post */}
                    <div className="grid grid-cols-2 gap-1.5 bg-slate-200/80 dark:bg-slate-800 p-1 rounded-xl text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setPublishMode('now');
                          setPostDropdownOpen(false);
                        }}
                        className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          publishMode === 'now'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Post to stream</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPublishMode('schedule');
                          if (!scheduledDateTime) setComposerQuickTime(1);
                          setPostDropdownOpen(false);
                        }}
                        className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          publishMode === 'schedule'
                            ? 'bg-purple-600 text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <CalendarClock className="w-3.5 h-3.5" />
                        <span>Schedule post</span>
                      </button>
                    </div>
                  </div>

                  {/* When Schedule post is chosen: Google Classroom Schedule Panel */}
                  {publishMode === 'schedule' && (
                    <div className="space-y-2.5 pt-2.5 border-t border-indigo-200/70 dark:border-indigo-900/50 animate-fade-in">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                          <span>Schedule date & time (သတ်မှတ်ထားသော နေ့စွဲနှင့် အချိန်):</span>
                        </label>
                        <span className="text-[10px] text-purple-700 dark:text-purple-300 font-semibold bg-purple-100 dark:bg-purple-950 px-2 py-0.5 rounded-full">
                          သတ်မှတ်ချိန်ရောက်မှ ပေါ်ပါမည်
                        </span>
                      </div>

                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <input
                          type="datetime-local"
                          value={scheduledDateTime}
                          onChange={(e) => setScheduledDateTime(e.target.value)}
                          className="px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 font-mono shadow-2xs"
                          required={publishMode === 'schedule'}
                        />

                        {/* Quick Preset Chips */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setComposerQuickTime(1)}
                            className="px-2.5 py-1 text-[11px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 rounded-lg text-slate-700 dark:text-slate-300 transition-colors cursor-pointer font-medium"
                          >
                            +1 Hour
                          </button>
                          <button
                            type="button"
                            onClick={() => setComposerQuickTime(3)}
                            className="px-2.5 py-1 text-[11px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 rounded-lg text-slate-700 dark:text-slate-300 transition-colors cursor-pointer font-medium"
                          >
                            +3 Hours
                          </button>
                          <button
                            type="button"
                            onClick={() => setComposerQuickTime(24)}
                            className="px-2.5 py-1 text-[11px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 rounded-lg text-slate-700 dark:text-slate-300 transition-colors cursor-pointer font-medium"
                          >
                            Tomorrow (+24 hrs)
                          </button>
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        💡 ဤ Post အား သတ်မှတ်ချိန်ရောက်မှ Stream တွင် အလိုအလျောက် ထုတ်ပြန်ပေးမည်ဖြစ်ပြီး မထုတ်ပြန်မီ Admin မှ ပြန်လည်ပြင်ဆင်နိုင်ပါသည်။
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Bottom Actions Row: Cancel & Google Classroom Split Post Button */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 flex-wrap">
                  <span className="font-medium">
                    {attachedFiles.length > 0
                      ? `📎 ${attachedFiles.length} file(s) attached`
                      : 'No files attached'}
                  </span>
                  {pinUponPublish && (
                    <span className="text-amber-600 dark:text-amber-400 font-semibold">· 📌 Will be pinned</span>
                  )}
                </div>

                <div className="flex items-center gap-2 justify-end relative">
                  {/* Cancel Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsComposing(false);
                      setAttachedFiles([]);
                      setPostDropdownOpen(false);
                    }}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel (ပယ်ဖျက်မည်)
                  </button>

                  {isInstructor ? (
                    /* Google Classroom Split Button with Dropdown Choice (Instructors) */
                    <div className="inline-flex rounded-xl shadow-xs">
                      <button
                        type="submit"
                        className={`px-4 py-2 text-xs font-bold text-white rounded-l-xl transition-all cursor-pointer flex items-center gap-2 ${
                          publishMode === 'schedule'
                            ? 'bg-purple-600 hover:bg-purple-700 active:bg-purple-800'
                            : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800'
                        }`}
                      >
                        {publishMode === 'schedule' ? (
                          <>
                            <CalendarClock className="w-4 h-4" />
                            <span>Schedule post (သတ်မှတ်ချိန်တင်မည်)</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            <span>Post to stream (ချက်ချင်းတင်မည်)</span>
                          </>
                        )}
                      </button>

                      {/* Split Dropdown Trigger Button */}
                      <button
                        type="button"
                        onClick={() => setPostDropdownOpen(!postDropdownOpen)}
                        className={`px-2 py-2 border-l border-white/20 text-white rounded-r-xl transition-colors cursor-pointer ${
                          publishMode === 'schedule'
                            ? 'bg-purple-700 hover:bg-purple-800'
                            : 'bg-indigo-700 hover:bg-indigo-800'
                        }`}
                        title="Choose Post to stream or Schedule post"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    /* Direct Post to stream button for Students */
                    <button
                      type="submit"
                      className="px-4 py-2 text-xs font-bold text-white rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 transition-all cursor-pointer flex items-center gap-2 shadow-xs"
                    >
                      <Send className="w-4 h-4" />
                      <span>Post to stream (လွှင့်တင်မည်)</span>
                    </button>
                  )}

                  {/* Google Classroom Split Dropdown Menu */}
                  {isInstructor && postDropdownOpen && (
                    <div className="absolute right-0 bottom-full mb-2 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-1.5 z-30 animate-fade-in space-y-1">
                      <button
                        type="button"
                        onClick={() => {
                          setPublishMode('now');
                          setPostDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold flex items-start gap-2.5 transition-colors cursor-pointer ${
                          publishMode === 'now'
                            ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        <Send className="w-4 h-4 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
                        <div>
                          <div className="font-bold">Post to stream (ချက်ချင်းတင်မည်)</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                            Publish immediately to all students
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setPublishMode('schedule');
                          if (!scheduledDateTime) setComposerQuickTime(1);
                          setPostDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold flex items-start gap-2.5 transition-colors cursor-pointer ${
                          publishMode === 'schedule'
                            ? 'bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        <CalendarClock className="w-4 h-4 text-purple-600 dark:text-purple-400 mt-0.5 shrink-0" />
                        <div>
                          <div className="font-bold">Schedule post (အချိန်သတ်မှတ်တင်မည်)</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                            Release automatically at chosen date & time
                          </div>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Stream Posts Feed */}
      <div className="space-y-4 sm:space-y-5">
        {posts.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
            <MessageSquare className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">No stream posts yet</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Your instructor will post announcements, lecture modules, and resources here.
            </p>
          </div>
        ) : (
          posts.map((post) => {
            const hasLiked = post.likes.includes(currentUser.id);
            const isCommentsOpen = expandedComments[post.id] ?? (post.comments.length > 0);
            const isPostScheduled = post.status === 'scheduled';

            return (
              <article
                key={post.id}
                className={`bg-white dark:bg-slate-900 rounded-2xl border ${
                  post.isPinned
                    ? 'border-amber-300 dark:border-amber-700/60 ring-1 ring-amber-400/20'
                    : isPostScheduled
                    ? 'border-indigo-300 dark:border-indigo-700/60 ring-1 ring-indigo-400/20'
                    : 'border-slate-200/90 dark:border-slate-800'
                } shadow-xs overflow-hidden transition-all hover:shadow-md`}
              >
                {/* Scheduled Notice Banner on Card (Visible to Admin) */}
                {isPostScheduled && (
                  <div className="bg-indigo-50 dark:bg-indigo-950/60 px-4 py-2 border-b border-indigo-100 dark:border-indigo-900/50 flex items-center justify-between text-xs text-indigo-700 dark:text-indigo-300">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>
                        သတ်မှတ်ချိန်: <strong>{post.scheduledForDisplay || post.scheduledFor || 'Upcoming'}</strong> (ကျောင်းသားများ မမြင်တွေ့ရသေးပါ)
                      </span>
                    </div>
                    {isInstructor && (
                      <button
                        onClick={() => handlePublishNow(post.id)}
                        className="px-2.5 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-[10px] font-semibold transition-colors cursor-pointer"
                      >
                        Publish Now
                      </button>
                    )}
                  </div>
                )}

                {/* Post Header */}
                <div className="p-3.5 sm:p-5 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 sm:gap-3">
                      <img
                        src={post.authorAvatar}
                        alt={post.authorName}
                        referrerPolicy="no-referrer"
                        className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                      />
                      <div>
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                          <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                            {post.authorName}
                          </span>
                          <span className="text-[10px] font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded">
                            {post.authorRole === 'admin'
                              ? 'Instructor (Admin)'
                              : post.authorRole === 'co_admin'
                              ? 'Co-Admin'
                              : 'Student'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          <span>{post.createdAt}</span>
                          <span>·</span>
                          <span className="capitalize">{post.postType}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Pinned Badge (Visible to all) */}
                      {post.isPinned && (
                        <div className="flex items-center gap-1 text-[10px] sm:text-[11px] text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/80 px-2 py-0.5 rounded-full font-semibold shrink-0">
                          <Pin className="w-3 h-3 fill-amber-600 dark:fill-amber-400" />
                          <span>Pinned ({post.pinOrder || 1}/3)</span>
                        </div>
                      )}

                      {/* Post Action Controls: Pin, Edit & Delete (Instructors only: Admin & Co-Admin) */}
                      {isInstructor && (
                        <div className="flex items-center gap-1">
                          {/* Pin Toggle Button */}
                          <button
                            onClick={() => handleTogglePin(post.id)}
                            className={`p-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                              post.isPinned
                                ? 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100'
                                : 'text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                            title={
                              post.isPinned
                                ? 'Unpin post'
                                : `Pin post to top (${currentPinnedCount}/3 currently pinned)`
                            }
                          >
                            <Pin className={`w-3.5 h-3.5 ${post.isPinned ? 'fill-amber-600 dark:fill-amber-400' : ''}`} />
                            <span className="text-[10px] hidden md:inline">
                              {post.isPinned ? 'Unpin' : `Pin (${currentPinnedCount}/3)`}
                            </span>
                          </button>

                          {/* Edit Post Button */}
                          <button
                            onClick={() => setEditingPost(post)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors cursor-pointer"
                            title="Edit post (ပို့စ်ပြင်ဆင်ရန်)"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Post Button */}
                          <button
                            onClick={() => handleDeletePost(post.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                            title="Delete post (ပို့စ်ဖျက်ရန်)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Post Title & Content */}
                  <div className="mt-3">
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 leading-snug">
                      {post.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 mt-1.5 leading-relaxed whitespace-pre-line">
                      {renderTextWithLinks(post.content)}
                    </p>
                  </div>
                </div>

                {/* Video Asset Section */}
                {post.videoAsset && (
                  <div className="px-3.5 sm:px-5 py-2">
                    <div className="mb-2 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                      <span className="font-semibold flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
                        <Lock className="w-3.5 h-3.5" />
                        <span>Protected Video Playback</span>
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono hidden sm:inline">
                        Watermark: {currentUser.name} ({currentUser.username})
                      </span>
                    </div>

                    <SecureVideoPlayer
                      video={post.videoAsset}
                      currentUser={currentUser}
                      onCompleted={() => handleLessonViewed(post.id)}
                      textProtectionEnabled={textProtectionEnabled}
                    />
                  </div>
                )}

                {/* Attachments Section - Any File Format */}
                {post.attachments && post.attachments.length > 0 && (
                  <div className="px-3.5 sm:px-5 py-2 space-y-2">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                      Attachments ({post.attachments.length} files):
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {post.attachments.map((att) => {
                        const isImg = att.type === 'image';
                        const isAudio = att.type === 'audio';
                        const isVideo = att.type === 'video';

                        return (
                          <div
                            key={att.id}
                            className="flex flex-col justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-xs shadow-2xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          >
                            {/* Preview for images if available */}
                            {isImg && att.url && att.url !== '#' && (
                              <div
                                onClick={() => setPreviewImage({ url: att.url, name: att.name })}
                                className="relative h-24 rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-700 mb-2 cursor-pointer group/img"
                              >
                                <img
                                  src={att.url}
                                  alt={att.name}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover group-hover/img:scale-105 transition-transform"
                                />
                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white">
                                  <Eye className="w-4 h-4 mr-1" />
                                  <span className="text-[10px] font-medium">View</span>
                                </div>
                              </div>
                            )}

                            {/* Audio player if audio */}
                            {isAudio && att.url && att.url !== '#' && (
                              <div className="mb-2">
                                <audio controls className="w-full h-7 rounded">
                                  <source src={att.url} />
                                </audio>
                              </div>
                            )}

                            {/* Video tag if video */}
                            {isVideo && att.url && att.url !== '#' && (
                              <div className="mb-2 rounded overflow-hidden bg-black">
                                <video controls className="w-full max-h-36">
                                  <source src={att.url} />
                                </video>
                              </div>
                            )}

                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 truncate min-w-0">
                                {renderFileIcon(att.type)}
                                <div className="truncate">
                                  <span className="font-medium text-slate-800 dark:text-slate-200 truncate block max-w-[170px] sm:max-w-[200px]">
                                    {att.name}
                                  </span>
                                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                                    {att.size}
                                  </span>
                                </div>
                              </div>

                              <a
                                href={att.url}
                                download={att.name}
                                onClick={(e) => {
                                  if (att.url === '#') {
                                    e.preventDefault();
                                    setSuccessToast(`ဖိုင် ဒေါင်းလုဒ်ဆွဲနေပါသည်: ${att.name} (${att.size})`);
                                    setTimeout(() => setSuccessToast(null), 3500);
                                  }
                                }}
                                className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors shrink-0"
                                title={`Download ${att.name}`}
                              >
                                <Download className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Social Interaction Bar */}
                <div className="px-3.5 sm:px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => handleToggleLike(post.id)}
                      className={`flex items-center gap-1.5 transition-colors cursor-pointer ${
                        hasLiked ? 'text-indigo-600 dark:text-indigo-400 font-semibold' : 'hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      <ThumbsUp className={`w-4 h-4 ${hasLiked ? 'fill-indigo-600 dark:fill-indigo-400' : ''}`} />
                      <span>{post.likes.length} Likes</span>
                    </button>

                    <button
                      onClick={() =>
                        setExpandedComments((prev) => ({
                          ...prev,
                          [post.id]: !isCommentsOpen,
                        }))
                      }
                      className="flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-slate-200 transition-colors cursor-pointer"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>{post.comments.length} Class Comments</span>
                    </button>
                  </div>

                  <span className="text-[11px] text-slate-400 dark:text-slate-500 hidden sm:inline-block">
                    Course: {course.code}
                  </span>
                </div>

                {/* Threaded Discussion Section */}
                {isCommentsOpen && (
                  <div className="bg-slate-50/70 dark:bg-slate-850/70 border-t border-slate-100 dark:border-slate-800 px-3.5 sm:px-5 py-4 space-y-3">
                    {/* Existing Comments */}
                    {post.comments.length > 0 && (
                      <div className="space-y-2.5">
                        {post.comments.map((comm) => {
                          const canDeleteComment =
                            isInstructor || comm.authorId === currentUser.id;
                          return (
                            <div key={comm.id} className="flex items-start gap-2.5 text-xs">
                              <img
                                src={comm.authorAvatar}
                                alt={comm.authorName}
                                referrerPolicy="no-referrer"
                                className="w-7 h-7 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0 mt-0.5"
                              />
                              <div className="flex-1 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                                      {comm.authorName}
                                    </span>
                                    {(comm.authorRole === 'admin' || comm.authorRole === 'co_admin') && (
                                      <span className="text-[9px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-1 rounded">
                                        Instructor
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                                      {comm.createdAt}
                                    </span>
                                    {canDeleteComment && (
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteComment(post.id, comm.id)}
                                        className="p-0.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded transition-colors cursor-pointer"
                                        title="Delete comment (SQL Auto-Delete)"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <p className="text-slate-700 dark:text-slate-300 mt-1 leading-relaxed whitespace-pre-line">
                                  {renderTextWithLinks(comm.content)}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Add Comment Input Form */}
                    <div className="flex items-center gap-2 pt-1">
                      <img
                        src={currentUser.avatar}
                        alt={currentUser.name}
                        referrerPolicy="no-referrer"
                        className="w-7 h-7 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                      />
                      <div className="flex-1 flex items-center gap-1.5">
                        <input
                          type="text"
                          placeholder="Add a class comment or question..."
                          value={commentInputs[post.id] || ''}
                          onChange={(e) =>
                            setCommentInputs((prev) => ({
                              ...prev,
                              [post.id]: e.target.value,
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleAddComment(post.id);
                            }
                          }}
                          className="flex-1 px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddComment(post.id)}
                          className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer shrink-0"
                          title="Send comment"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>

      {/* Edit Post Modal for Instructors */}
      {editingPost && (
        <EditPostModal
          isOpen={true}
          onClose={() => setEditingPost(null)}
          post={editingPost}
          currentUser={currentUser}
          currentPinnedCount={currentPinnedCount}
          onSaved={() => {
            setSuccessToast('Post အား ပြင်ဆင်သိမ်းဆည်းပြီးပါပြီ!');
            setTimeout(() => setSuccessToast(null), 3000);
            onRefresh();
          }}
        />
      )}

      {/* Pin Swap Modal when 3 limit is reached */}
      {pinSwapTarget && (
        <PinSwapModal
          isOpen={true}
          onClose={() => setPinSwapTarget(null)}
          targetPost={pinSwapTarget}
          pinnedPosts={pinnedPosts}
          currentUser={currentUser}
          onSwapped={() => {
            setSuccessToast('Pinned Post အား အောင်မြင်စွာ အစားထိုးလဲလှယ်ပြီးပါပြီ!');
            setTimeout(() => setSuccessToast(null), 3000);
            onRefresh();
          }}
        />
      )}

      {/* Full-Screen Image Preview Modal */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md cursor-zoom-out"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-4xl max-h-[90vh] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl p-2 cursor-default flex flex-col"
          >
            <div className="flex items-center justify-between p-2 text-white text-xs border-b border-slate-800">
              <span className="font-medium truncate max-w-xs">{previewImage.name}</span>
              <button
                onClick={() => setPreviewImage(null)}
                className="p-1 text-slate-400 hover:text-white rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-2 overflow-auto flex items-center justify-center">
              <img
                src={previewImage.url}
                alt={previewImage.name}
                className="max-h-[75vh] max-w-full object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}

      {/* Customize Classroom Header Photo Modal (Admin & Co-Admin Only) */}
      {showBannerModal && (
        <CourseBannerModal
          course={course}
          isOpen={showBannerModal}
          onClose={() => setShowBannerModal(false)}
          onSuccess={() => {
            setSuccessToast('Classroom Header Photo (1000 × 250 px) ကို အောင်မြင်စွာ ပြောင်းလဲပြီးပါပြီ!');
            setTimeout(() => setSuccessToast(null), 3000);
            onRefresh();
          }}
        />
      )}

      {/* Delete Post Confirmation Modal */}
      {postToDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Delete Post (ပို့စ်ကို ဖျက်သိမ်းရန် အတည်ပြုပါ)
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                  ဤ Post ကို အတန်း Stream နှင့် Supabase SQL Database ထဲမှ အပြီးတိုင် ဖျက်သိမ်းလိုပါသလား?
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setPostToDeleteId(null)}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 cursor-pointer"
              >
                မဖျက်တော့ပါ (Cancel)
              </button>
              <button
                type="button"
                onClick={handleConfirmDeletePost}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Post & SQL Row</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
