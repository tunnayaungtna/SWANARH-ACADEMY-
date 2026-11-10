import React, { useState, useRef, useEffect } from 'react';
import { Course, CoursePost, User, Attachment, AttendanceStatus } from '../types/classroom';
import { EditPostModal } from './EditPostModal';
import { PinSwapModal } from './PinSwapModal';
import { CourseBannerModal } from './CourseBannerModal';
import { useBackHandler } from '../utils/backNavigation';
import { formatFileSize, getFileTypeCategory } from '../utils/fileHelpers';
import { renderTextWithLinks } from '../utils/linkify';
import { ClassroomDB } from '../services/storage';
import { resolveAvatarUrl, DEFAULT_AVATAR_SVG } from '../data/presetAvatars';
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
  Copy,
  ClipboardPaste,
  Check,
  RotateCcw,
} from 'lucide-react';

interface CourseStreamProps {
  course: Course;
  currentUser: User;
  posts: CoursePost[];
  onRefresh: () => void;
  onOpenAttendance?: () => void;
}

export const CourseStream: React.FC<CourseStreamProps> = ({
  course,
  currentUser,
  posts,
  onRefresh,
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
  const [isSubmittingPost, setIsSubmittingPost] = useState(false);

  // Any-file upload attachments state
  const [attachedFiles, setAttachedFiles] = useState<Attachment[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerCardRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [copiedPostId, setCopiedPostId] = useState<string | null>(null);
  const [copiedComposerField, setCopiedComposerField] = useState<'title' | 'content' | 'all' | null>(null);

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
  // Progressive stream post limit for smooth 60fps scrolling
  const [visiblePostLimit, setVisiblePostLimit] = useState<number>(20);
  const userByIdMap = new Map<string, User>(ClassroomDB.getAllUsers().map((u) => [u.id, u]));

  const [rateLimitError, setRateLimitError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Instructor permission check (Admin or Co-Admin)
  const isInstructor = currentUser.role === 'admin' || currentUser.role === 'co_admin';

  // Comment composer state per post
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});

  // Filtered post collections
  const pinnedPosts = posts
    .filter((p) => p.isPinned && p.status !== 'scheduled')
    .sort((a, b) => (a.pinOrder || 99) - (b.pinOrder || 99));
  const scheduledPosts = posts.filter((p) => p.status === 'scheduled');
  const currentPinnedCount = posts.filter((p) => p.isPinned).length;
  const openAttendanceSessions = ClassroomDB.getAttendanceSessions(course.id).filter(
    (s) => s.isOpen
  );
  const [editingStreamAttIds, setEditingStreamAttIds] = useState<Record<string, boolean>>({});

  const handleStreamStudentAttendance = (
    sessionId: string,
    status: AttendanceStatus | 'clear' = 'present'
  ) => {
    const res = ClassroomDB.studentCheckIn(sessionId, currentUser, status);
    if (!res.success && res.error) {
      setRateLimitError(res.error);
      setTimeout(() => setRateLimitError(null), 4000);
      return;
    }
    setEditingStreamAttIds((prev) => ({ ...prev, [sessionId]: false }));
    if (status === 'clear') {
      setSuccessToast('🔄 သင်၏ Attendance မှတ်တမ်းကို ပြန်ဖျက်ပြီးပါပြီ။ ပြန်လည်ရွေးချယ်နှိပ်နိုင်ပါသည်။');
    } else if (status === 'late') {
      setSuccessToast('⏰ Late (နောက်ကျတက်ရောက်) အဖြစ် ပြင်ဆင်မှတ်တမ်းတင်ပြီးပါပြီ!');
    } else if (status === 'excused') {
      setSuccessToast('📝 Excused (ခွင့်တိုင်ကြားသည်) အဖြစ် ပြင်ဆင်မှတ်တမ်းတင်ပြီးပါပြီ!');
    } else {
      setSuccessToast('✅ Present (တက်ရောက်သည်) အဖြစ် မှတ်တမ်းတင်ပြီးပါပြီ!');
    }
    setTimeout(() => setSuccessToast(null), 3500);
    onRefresh();
  };

  // Live 3-second watcher in CourseStream so scheduled posts transition to #1 in the Stream at the exact scheduled moment
  useEffect(() => {
    const checkDue = () => {
      const publishedAny = ClassroomDB.checkAndPublishDueScheduledPosts();
      if (publishedAny) {
        setSuccessToast(
          '🔔 အချိန်သတ်မှတ်ထားသော Post အား သတ်မှတ်ချိန်ပြည့်သဖြင့် Stream ထိပ်ဆုံးသို့ အလိုအလျောက် လွှင့်တင်ပြီးပါပြီ!'
        );
        setTimeout(() => setSuccessToast(null), 4500);
        onRefresh();
      }
    };
    checkDue();
    const timer = setInterval(checkDue, 3000);
    return () => clearInterval(timer);
  }, [course.id, scheduledPosts.length]);

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
    const d = new Date(Date.now() + Math.round(hoursFromNow * 60 * 60 * 1000));
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
    if (isSubmittingPost) return;
    if (!postTitle.trim() || !postContent.trim()) return;

    if (publishMode === 'schedule' && !scheduledDateTime) {
      setRateLimitError('ကျေးဇူးပြု၍ Schedule ပြုလုပ်မည့် နေ့စွဲနှင့် အချိန်ကို ရွေးချယ်ပေးပါ။');
      setTimeout(() => setRateLimitError(null), 4000);
      return;
    }

    if (publishMode === 'schedule' && scheduledDateTime) {
      const schedMs = new Date(scheduledDateTime).getTime();
      if (isNaN(schedMs) || schedMs <= Date.now() - 30000) {
        setRateLimitError(
          'ရွေးချယ်ထားသော Schedule အချိန်သည် လက်ရှိအချိန်ထက် ကျော်လွန်နေပါသည်။ အနာဂတ်အချိန်ကို ရွေးချယ်ပါ သို့မဟုတ် "Post to stream" ဖြင့် ချက်ချင်းတင်ပါ။'
        );
        setTimeout(() => setRateLimitError(null), 4500);
        return;
      }
    }

    if (pinUponPublish && currentPinnedCount >= 3) {
      setRateLimitError('အများဆုံး Pin ၃ ခုသာ သတ်မှတ်နိုင်ပါသည်။ အခြား Post တစ်ခုကို အရင် Unpin လုပ်ပါ။');
      setTimeout(() => setRateLimitError(null), 4000);
      return;
    }

    setIsSubmittingPost(true);
    try {
      let scheduledFor: string | undefined = undefined;
      let scheduledForDisplay: string | undefined = undefined;
      if (publishMode === 'schedule' && scheduledDateTime) {
        const schedObj = new Date(scheduledDateTime);
        scheduledFor = schedObj.toISOString();
        scheduledForDisplay = schedObj.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });
      }

      const res = ClassroomDB.addPost(
        {
          courseId: course.id,
          authorId: currentUser.id,
          authorName: currentUser.name,
          authorRole: currentUser.role,
          authorAvatar: currentUser.role !== 'admin' ? '' : currentUser.avatar,
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

      const notifiedCount = res.notifiedCount ?? course.enrolledStudentIds.length;
      setSuccessToast(
        publishMode === 'schedule'
          ? `Post အား ${scheduledForDisplay} တွင် တင်ရန် အချိန်သတ်မှတ်ပြီးပါပြီ! (သတ်မှတ်ချိန်ရောက်ပါက ကျောင်းသား ${course.enrolledStudentIds.length} ဦးထံ Notification ပို့ပေးပါမည်)`
          : `🔔 Post အား Stream ထိပ်ဆုံးသို့ တင်ပြီး "${course.code}" အတန်းရှိ ကျောင်းသား (${notifiedCount}) ဦးအားလုံးထံ Notification ပေးပို့ပြီးပါပြီ!`
      );
      setTimeout(() => setSuccessToast(null), 4200);

      onRefresh();
    } finally {
      setTimeout(() => setIsSubmittingPost(false), 400);
    }
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
    const notifiedCount = res.notifiedCount ?? course.enrolledStudentIds.length;
    setSuccessToast(
      `🔔 Scheduled Post အား ချက်ချင်းထုတ်ပြန်ပြီး ကျောင်းသား (${notifiedCount}) ဦးအားလုံးထံ Notification ပေးပို့ပြီးပါပြီ!`
    );
    setTimeout(() => setSuccessToast(null), 3800);
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

  // Copy & Paste helpers for Admin / Co-Admin Post Composer & Post Cards
  const handlePasteIntoTitle = async () => {
    try {
      const clipText = await navigator.clipboard.readText();
      if (!clipText || !clipText.trim()) {
        setRateLimitError('Clipboard ထဲတွင် စာသား မရှိသေးပါ။ အရင် Copy ကူးယူပါ။');
        setTimeout(() => setRateLimitError(null), 3000);
        return;
      }
      const trimmed = clipText.trim();
      const lines = trimmed.split(/\r?\n/);
      if (lines.length > 1 && !postContent.trim()) {
        setPostTitle(lines[0].trim());
        setPostContent(lines.slice(1).join('\n').trim());
        setSuccessToast('📋 ခေါင်းစဉ်နှင့် စာသား နှစ်ခုလုံးကို အလိုအလျောက် ခွဲခြား၍ Paste ချပေးပြီးပါပြီ!');
      } else {
        setPostTitle((prev) => (prev.trim() ? `${prev.trim()} ${trimmed.replace(/\r?\n/g, ' ')}` : trimmed.replace(/\r?\n/g, ' ')));
        setSuccessToast('📋 Post Title ထဲသို့ Paste ချပေးပြီးပါပြီ!');
      }
      setTimeout(() => setSuccessToast(null), 2800);
      titleInputRef.current?.focus();
    } catch {
      titleInputRef.current?.focus();
      setRateLimitError('ခေါင်းစဉ်အကွက်ထဲတွင် ဖိနှိပ်၍ Paste (သို့မဟုတ် Ctrl+V / Cmd+V) နှိပ်ပြီး ထည့်သွင်းနိုင်ပါသည်။');
      setTimeout(() => setRateLimitError(null), 3500);
    }
  };

  const handlePasteIntoContent = async () => {
    try {
      const clipText = await navigator.clipboard.readText();
      if (!clipText || !clipText.trim()) {
        setRateLimitError('Clipboard ထဲတွင် စာသား မရှိသေးပါ။ အရင် Copy ကူးယူပါ။');
        setTimeout(() => setRateLimitError(null), 3000);
        return;
      }
      const trimmed = clipText.trim();
      setPostContent((prev) => (prev.trim() ? `${prev.trim()}\n\n${trimmed}` : trimmed));
      if (!postTitle.trim()) {
        const firstLine = trimmed.split(/\r?\n/)[0]?.trim() || '';
        if (firstLine && firstLine.length <= 120) {
          setPostTitle(firstLine);
        }
      }
      setSuccessToast('📋 Post Content ထဲသို့ စာသား Paste ချပေးပြီးပါပြီ!');
      setTimeout(() => setSuccessToast(null), 2800);
      contentTextareaRef.current?.focus();
    } catch {
      contentTextareaRef.current?.focus();
      setRateLimitError('စာသားအကွက်ထဲတွင် ဖိနှိပ်၍ Paste (သို့မဟုတ် Ctrl+V / Cmd+V) နှိပ်ပြီး ထည့်သွင်းနိုင်ပါသည်။');
      setTimeout(() => setRateLimitError(null), 3500);
    }
  };

  const handleCopyComposerText = async (mode: 'title' | 'content' | 'all') => {
    const textToCopy =
      mode === 'title'
        ? postTitle.trim()
        : mode === 'content'
        ? postContent.trim()
        : `${postTitle.trim() ? `${postTitle.trim()}\n\n` : ''}${postContent.trim()}`.trim();

    if (!textToCopy) return;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedComposerField(mode);
      setSuccessToast('📋 စာသားကို Clipboard ထဲသို့ Copy ကူးယူပြီးပါပြီ!');
      setTimeout(() => {
        setCopiedComposerField(null);
        setSuccessToast(null);
      }, 2500);
    } catch {
      // ignore
    }
  };

  const handleCopyPostCard = async (post: CoursePost) => {
    const fullText = `${post.title}\n\n${post.content}`.trim();
    try {
      await navigator.clipboard.writeText(fullText);
      setCopiedPostId(post.id);
      setSuccessToast(`📋 "${post.title}" ပို့စ်စာသားကို Copy ကူးယူပြီးပါပြီ!`);
      setTimeout(() => {
        setCopiedPostId(null);
        setSuccessToast(null);
      }, 2800);
    } catch {
      // ignore
    }
  };

  const handleDuplicatePostToComposer = (post: CoursePost) => {
    setIsComposing(true);
    setPostTitle(post.title);
    setPostContent(post.content);
    setPostType(post.postType);
    setSuccessToast('📋 ပို့စ်စာသားကို Post အသစ်တင်မည့် အကွက်ထဲသို့ ကူးထည့်ပေးပြီးပါပြီ!');
    setTimeout(() => {
      setSuccessToast(null);
      composerCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      contentTextareaRef.current?.focus();
    }, 120);
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
    <div className="space-y-4 sm:space-y-6 w-full max-w-full select-text">
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
      <div className="neu-card rounded-3xl p-3 sm:p-4 overflow-hidden">
        {/* Pure 4:1 Header Image Container (1000 × 250 proportion on all devices, 100% bright & clear) */}
        <div className="relative w-full aspect-[4/1] bg-slate-900 rounded-2xl overflow-hidden group neu-inset-sm p-1">
          <img
            src={course.bannerImage}
            alt={course.title}
            referrerPolicy="no-referrer"
            onClick={() => setPreviewImage({ url: course.bannerImage, name: `${course.title} - Header Photo` })}
            className="w-full h-full object-cover object-center rounded-xl cursor-zoom-in transition-transform duration-300"
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
        <div className="pt-4 pb-1 px-2 sm:px-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-mono text-indigo-600 dark:text-indigo-400">
              <span className="font-bold neu-inset-sm px-2.5 py-0.5 rounded-lg">
                {course.code}
              </span>
              <span>·</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">{course.batch}</span>
              <span>·</span>
              <span className="text-slate-500 dark:text-slate-400">{course.section}</span>
            </div>

            <h1 className="text-base sm:text-xl md:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-snug">
              {course.title}
            </h1>

            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 pt-0.5 text-[11px] sm:text-xs text-slate-600 dark:text-slate-400">
              <span>Instructor: <strong className="text-slate-800 dark:text-slate-200">{course.instructorName}</strong></span>
              <span>·</span>
              <span>Enrolled Students: <strong className="text-slate-800 dark:text-slate-200">{course.enrolledStudentIds.length}</strong></span>
              <span>·</span>
              <span className="text-amber-600 dark:text-amber-400 font-semibold">📌 Pinned: {pinnedPosts.length}/3</span>
              {isInstructor && scheduledPosts.length > 0 && (
                <>
                  <span>·</span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-semibold">⏰ Scheduled: {scheduledPosts.length}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Live Open Attendance Banner in Stream (Students can Mark or Edit before session closes) */}
      {!isInstructor && openAttendanceSessions.length > 0 && (
        <div className="neu-card rounded-3xl p-4 sm:p-5 space-y-3 ring-2 ring-emerald-400/50">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold text-xs sm:text-sm">
              <CalendarCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Open Attendance — အတန်းတက်ရောက်ကြောင်း နှိပ်ရန် (မပိတ်မီ ပြန်ပြင်နိုင်ပါသည်)</span>
            </div>
            {onOpenAttendance && (
              <button
                type="button"
                onClick={onOpenAttendance}
                className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                Attendance မှတ်တမ်းအပြည့်အစုံ ကြည့်ရန် →
              </button>
            )}
          </div>

          <div className="space-y-2.5">
            {openAttendanceSessions.map((sess) => {
              const myRec = sess.records[currentUser.id];
              const isEditingThis = Boolean(editingStreamAttIds[sess.id]);

              return (
                <div
                  key={sess.id}
                  className="flex flex-col gap-2.5 p-3.5 rounded-2xl neu-inset-sm"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                          {sess.displayDate}
                        </span>
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                          {sess.title}
                        </h4>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        ဆရာ {sess.openedBy} မှ Attendance ဖွင့်ပေးထားပါသည်။ Attendance မပိတ်ခင် မိမိနှိပ်ထားသည်ကို ပြန်ပြင်နိုင်ပါသည်။
                      </p>
                    </div>

                    {myRec ? (
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>
                            {myRec.status === 'present'
                              ? 'Present (တက်ရောက်)'
                              : myRec.status === 'late'
                              ? 'Late (နောက်ကျ)'
                              : myRec.status === 'excused'
                              ? 'Excused (ခွင့်တိုင်)'
                              : 'Absent'}
                            {myRec.checkedInAt ? ` (${myRec.checkedInAt})` : ''}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setEditingStreamAttIds((prev) => ({
                              ...prev,
                              [sess.id]: !prev[sess.id],
                            }))
                          }
                          className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>{isEditingThis ? 'မပြင်တော့ပါ' : 'ပြန်ပြင်မည် (Edit)'}</span>
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleStreamStudentAttendance(sess.id, 'present')}
                          className="px-4 py-2 rounded-xl neu-btn-emerald text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Hand className="w-3.5 h-3.5" />
                          <span>Mark Present (တက်ရောက်သည်)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStreamStudentAttendance(sess.id, 'late')}
                          className="px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>Late</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStreamStudentAttendance(sess.id, 'excused')}
                          className="px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-800 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>Excused</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {myRec && isEditingThis && (
                    <div className="pt-2 border-t border-slate-200/70 dark:border-slate-700/70 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                        ✏️ Attendance မပိတ်မီ ပြောင်းလဲရွေးချယ်ရန် -
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleStreamStudentAttendance(sess.id, 'present')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer ${
                            myRec.status === 'present'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                          }`}
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Present (တက်ရောက်)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStreamStudentAttendance(sess.id, 'late')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer ${
                            myRec.status === 'late'
                              ? 'bg-amber-500 text-white'
                              : 'bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                          }`}
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>Late (နောက်ကျ)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStreamStudentAttendance(sess.id, 'excused')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer ${
                            myRec.status === 'excused'
                              ? 'bg-indigo-600 text-white'
                              : 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700'
                          }`}
                        >
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>Excused (ခွင့်တိုင်)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStreamStudentAttendance(sess.id, 'clear')}
                          className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>ပြန်ဖျက်မည်</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Scheduled Posts Management Drawer (Admin/Instructor Only) */}
      {isInstructor && scheduledPosts.length > 0 && (
        <div className="neu-card rounded-3xl p-4 sm:p-5 space-y-3 transition-all">
          <div
            onClick={() => setScheduledDrawerOpen(!scheduledDrawerOpen)}
            className="flex items-center justify-between cursor-pointer select-none"
          >
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-xs">
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
            <button className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl neu-btn">
              {scheduledDrawerOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>

          {scheduledDrawerOpen && (
            <div className="space-y-2.5 pt-2">
              {scheduledPosts.map((sp) => (
                <div
                  key={sp.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3.5 rounded-2xl neu-inset-sm text-xs transition-colors"
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
                      className="px-3 py-1.5 neu-btn-indigo rounded-xl text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                      title="Publish immediately to all students"
                    >
                      <Send className="w-3 h-3" />
                      <span>Publish Now</span>
                    </button>
                    <button
                      onClick={() => setEditingPost(sp)}
                      className="px-2.5 py-1.5 neu-btn text-slate-700 dark:text-slate-300 rounded-xl text-xs font-medium transition-colors cursor-pointer flex items-center gap-1"
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
        <div className="neu-card rounded-3xl p-4 sm:p-5 space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-amber-500 text-white shadow-xs">
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
                className="neu-inset-sm rounded-2xl p-3.5 flex flex-col justify-between space-y-2 transition-colors"
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

                <div className="flex items-center justify-between pt-2 border-t border-slate-200/40 dark:border-slate-700/40 text-[11px]">
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
        <div ref={composerCardRef} className="neu-card rounded-3xl transition-all overflow-hidden">
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
                {currentUser.role === 'admin' ? (
                  <img
                    src={resolveAvatarUrl(currentUser.avatar)}
                    alt={currentUser.name}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = DEFAULT_AVATAR_SVG;
                    }}
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-contain bg-white p-0.5 ring-2 ring-indigo-500/20 group-hover:ring-indigo-500 transition-all"
                  />
                ) : (
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-extrabold text-xs flex items-center justify-center border border-indigo-200 dark:border-indigo-800">
                    {currentUser.role === 'co_admin' ? '👥' : '🎓'}
                  </div>
                )}
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-white dark:ring-slate-900" />
              </div>
              <div className="flex-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors font-medium truncate">
                {isInstructor
                  ? 'Announce something to your class (အတန်းအတွက် ကြေညာချက် သို့မဟုတ် သင်ခန်းစာ တင်ရန်)...'
                  : 'Announce to your class or ask a question (အတန်းတွင်း မေးခွန်း သို့မဟုတ် အကြောင်းအရာ တင်ရန်)...'}
              </div>
            </div>

            {/* Quick Actions (Paste Post, Add File symbol & Schedule post symbol) */}
            <div className="flex items-center gap-1.5 shrink-0">
              {isInstructor && (
                <button
                  type="button"
                  onClick={async () => {
                    setIsComposing(true);
                    try {
                      const clipText = await navigator.clipboard.readText();
                      if (clipText && clipText.trim()) {
                        const trimmed = clipText.trim();
                        const lines = trimmed.split(/\r?\n/);
                        if (lines.length > 1) {
                          setPostTitle(lines[0].trim());
                          setPostContent(lines.slice(1).join('\n').trim());
                        } else {
                          setPostContent(trimmed);
                        }
                        setSuccessToast('📋 Clipboard မှ စာသားကို Post အကွက်ထဲသို့ အသင့် Paste ချပေးပြီးပါပြီ!');
                        setTimeout(() => setSuccessToast(null), 3000);
                      }
                    } catch {
                      setTimeout(() => contentTextareaRef.current?.focus(), 80);
                    }
                  }}
                  className="p-2 sm:px-3 sm:py-1.5 text-emerald-700 dark:text-emerald-300 bg-emerald-50/80 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/70 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-emerald-200 dark:border-emerald-800"
                  title="Clipboard မှ စာသားကို တိုက်ရိုက် Paste ချပြီး Post တင်ရန်"
                >
                  <ClipboardPaste className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="hidden sm:inline">Paste Post</span>
                </button>
              )}

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
                {currentUser.role === 'admin' ? (
                  <img
                    src={resolveAvatarUrl(currentUser.avatar)}
                    alt={currentUser.name}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = DEFAULT_AVATAR_SVG;
                    }}
                    className="w-10 h-10 rounded-full object-contain bg-white p-0.5 ring-2 ring-indigo-500/30 shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-extrabold text-xs flex items-center justify-center border border-indigo-200 dark:border-indigo-800 shrink-0">
                    {currentUser.role === 'co_admin' ? '👥' : '🎓'}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                      {currentUser.name}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                      {currentUser.role === 'admin'
                        ? 'Lead Mentor (Admin)'
                        : currentUser.role === 'co_admin'
                        ? 'Co-Admin (တွဲဖက်ဆရာ)'
                        : 'Student (ကျောင်းသား)'}
                    </span>
                  </div>
                  {/* Google Classroom Audience & Auto-Notification Badge */}
                  <div className="flex items-center gap-2 flex-wrap mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                      <span>For: <strong>All members</strong> in {course.code} ({course.enrolledStudentIds.length} enrolled)</span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                      <span>🔔 ကျောင်းသား {course.enrolledStudentIds.length} ဦးလုံးထံ Auto-Notification ပို့ပေးမည်</span>
                    </span>
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

              {/* Title Input with Quick Copy & Paste Toolbar */}
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                  <label className="text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-300">
                    Post Title (သင်ခန်းစာ သို့မဟုတ် ကြေညာချက် ခေါင်းစဉ်)
                  </label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={handlePasteIntoTitle}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/70 hover:bg-emerald-100 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold transition-colors cursor-pointer"
                      title="Clipboard မှ ခေါင်းစဉ်ကို Paste ချမည်"
                    >
                      <ClipboardPaste className="w-3 h-3" />
                      <span>Paste ချမည်</span>
                    </button>
                    {postTitle.trim() && (
                      <button
                        type="button"
                        onClick={() => handleCopyComposerText('title')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold transition-colors cursor-pointer"
                        title="ခေါင်းစဉ်ကို Copy ကူးမည်"
                      >
                        {copiedComposerField === 'title' ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        <span>{copiedComposerField === 'title' ? 'Copied!' : 'Copy'}</span>
                      </button>
                    )}
                  </div>
                </div>
                <input
                  ref={titleInputRef}
                  type="text"
                  placeholder="Post Title (သင်ခန်းစာ သို့မဟုတ် ကြေညာချက် ခေါင်းစဉ်)..."
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  className="w-full px-4 py-3 text-xs sm:text-sm font-semibold neu-input rounded-2xl text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all select-text"
                  required
                />
              </div>

              {/* Content Textarea with Quick Copy & Paste Toolbar */}
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                  <label className="text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-300">
                    Post Content (သင်ခန်းစာ အကြောင်းအရာ / ကြေညာချက် စာသား)
                  </label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={handlePasteIntoContent}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/70 hover:bg-emerald-100 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold transition-colors cursor-pointer"
                      title="Clipboard မှ စာသားကို Paste ချမည်"
                    >
                      <ClipboardPaste className="w-3 h-3" />
                      <span>Paste စာသားချမည်</span>
                    </button>
                    {postContent.trim() && (
                      <button
                        type="button"
                        onClick={() => handleCopyComposerText('content')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold transition-colors cursor-pointer"
                        title="စာသားကို Copy ကူးမည်"
                      >
                        {copiedComposerField === 'content' ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        <span>{copiedComposerField === 'content' ? 'Copied!' : 'Copy စာသား'}</span>
                      </button>
                    )}
                    {(postTitle.trim() || postContent.trim()) && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleCopyComposerText('all')}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[11px] font-semibold transition-colors cursor-pointer"
                          title="ခေါင်းစဉ်ရော စာသားပါ Copy ကူးမည်"
                        >
                          {copiedComposerField === 'all' ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                          <span>{copiedComposerField === 'all' ? 'All Copied!' : 'Copy All'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPostTitle('');
                            setPostContent('');
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-700 text-[11px] font-medium transition-colors cursor-pointer"
                          title="ရေးထားသမျှ ရှင်းလင်းမည်"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>ရှင်းမည်</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <textarea
                  ref={contentTextareaRef}
                  rows={5}
                  placeholder="Announce something to your class (အတန်းတွင်း ကြေညာချက်၊ သင်ခန်းစာ အကြောင်းအရာ သို့မဟုတ် ညွှန်ကြားချက်များကို ရိုက်ထည့်ပါ သို့မဟုတ် တိုက်ရိုက် Paste ချပါ)..."
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                  className="w-full px-4 py-3.5 text-xs sm:text-sm neu-input rounded-2xl text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 resize-y transition-all leading-relaxed select-text"
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
                            onClick={() => setComposerQuickTime(5 / 60)}
                            className="px-2.5 py-1 text-[11px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 rounded-lg text-slate-700 dark:text-slate-300 transition-colors cursor-pointer font-medium"
                          >
                            +5 Mins
                          </button>
                          <button
                            type="button"
                            onClick={() => setComposerQuickTime(15 / 60)}
                            className="px-2.5 py-1 text-[11px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 rounded-lg text-slate-700 dark:text-slate-300 transition-colors cursor-pointer font-medium"
                          >
                            +15 Mins
                          </button>
                          <button
                            type="button"
                            onClick={() => setComposerQuickTime(0.5)}
                            className="px-2.5 py-1 text-[11px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 rounded-lg text-slate-700 dark:text-slate-300 transition-colors cursor-pointer font-medium"
                          >
                            +30 Mins
                          </button>
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
      <div className="space-y-5 sm:space-y-6">
        {posts.length === 0 ? (
          <div className="p-8 text-center neu-card rounded-3xl text-slate-500 dark:text-slate-400">
            <MessageSquare className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No stream posts yet</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Your instructor will post announcements, lecture modules, and resources here.
            </p>
          </div>
        ) : (
          posts.slice(0, visiblePostLimit).map((post) => {
            const hasLiked = post.likes.includes(currentUser.id);
            const isCommentsOpen = Boolean(expandedComments[post.id]);
            const isPostScheduled = post.status === 'scheduled';

            return (
              <article
                key={post.id}
                className={`neu-card rounded-3xl ${
                  post.isPinned
                    ? 'ring-2 ring-amber-400/40'
                    : isPostScheduled
                    ? 'ring-2 ring-indigo-400/40'
                    : ''
                } overflow-hidden transition-all`}
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
                      {post.authorRole === 'admin' ? (
                        <img
                          src={resolveAvatarUrl(
                            userByIdMap.get(post.authorId)?.avatar || post.authorAvatar
                          )}
                          alt={post.authorName}
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = DEFAULT_AVATAR_SVG;
                          }}
                          className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-contain bg-white p-0.5 border border-indigo-200 dark:border-indigo-700 shrink-0 shadow-2xs"
                        />
                      ) : post.authorRole === 'co_admin' ? (
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 font-extrabold text-xs flex items-center justify-center border border-purple-200 dark:border-purple-800 shrink-0">
                          👥
                        </div>
                      ) : null}
                      <div>
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                          <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                            {post.authorName}
                          </span>
                          <span className="text-[10px] font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded">
                            {post.authorRole === 'admin'
                              ? 'Lead Mentor (Admin)'
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

                      {/* Post Action Controls: Copy, Reuse, Pin, Edit & Delete (Instructors only: Admin & Co-Admin) */}
                      {isInstructor && (
                        <div className="flex items-center gap-1 flex-wrap justify-end">
                          {/* Copy Post Text Button */}
                          <button
                            type="button"
                            onClick={() => handleCopyPostCard(post)}
                            className={`px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                              copiedPostId === post.id
                                ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60'
                                : 'text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50/70 dark:hover:bg-emerald-950/40'
                            }`}
                            title="Copy post title & content (ပို့စ်စာသားကို Copy ကူးမည်)"
                          >
                            {copiedPostId === post.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                            <span className="text-[10px] hidden sm:inline">
                              {copiedPostId === post.id ? 'Copied!' : 'Copy'}
                            </span>
                          </button>

                          {/* Paste / Duplicate into New Post Composer Button */}
                          <button
                            type="button"
                            onClick={() => handleDuplicatePostToComposer(post)}
                            className="px-2 py-1.5 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50/70 dark:hover:bg-indigo-950/40 transition-colors cursor-pointer flex items-center gap-1"
                            title="Copy into Post Composer (ပို့စ်အသစ်တင်မည့် အကွက်ထဲသို့ ကူးထည့်မည်)"
                          >
                            <ClipboardPaste className="w-3.5 h-3.5" />
                            <span className="text-[10px] hidden md:inline">Repost</span>
                          </button>

                          {/* Pin Toggle Button */}
                          <button
                            type="button"
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
                            type="button"
                            onClick={() => setEditingPost(post)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors cursor-pointer"
                            title="Edit post (ပို့စ်ပြင်ဆင်ရန်)"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Post Button */}
                          <button
                            type="button"
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
                  <div className="mt-3 select-text">
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 leading-snug">
                      {post.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 mt-1.5 leading-relaxed whitespace-pre-line">
                      {renderTextWithLinks(post.content)}
                    </p>
                  </div>
                </div>

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
                        const isPlaceholderUrl = !att.url || att.url === '#' || att.url === '#attachment';
                        const isSafeMediaUrl =
                          !isPlaceholderUrl &&
                          /^(https?:|data:image\/|data:audio\/|data:video\/|data:application\/pdf|data:text\/plain|blob:|\/|\.\/)/i.test(
                            att.url.trim()
                          );

                        return (
                          <div
                            key={att.id}
                            className="flex flex-col justify-between p-3 rounded-2xl neu-inset-sm text-xs transition-colors"
                          >
                            {/* Preview for images if available */}
                            {isImg && isSafeMediaUrl && (
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
                            {isAudio && isSafeMediaUrl && (
                              <div className="mb-2">
                                <audio controls className="w-full h-7 rounded">
                                  <source src={att.url} />
                                </audio>
                              </div>
                            )}

                            {/* Video tag if video */}
                            {isVideo && isSafeMediaUrl && (
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
                                href={isSafeMediaUrl ? att.url : '#'}
                                download={att.name}
                                onClick={(e) => {
                                  if (!isSafeMediaUrl) {
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
                  <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleToggleLike(post.id)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer ${
                        hasLiked
                          ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 font-semibold'
                          : 'hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <ThumbsUp className={`w-4 h-4 ${hasLiked ? 'fill-indigo-600 dark:fill-indigo-400' : ''}`} />
                      <span>{post.likes.length} Likes</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setExpandedComments((prev) => ({
                          ...prev,
                          [post.id]: !isCommentsOpen,
                        }))
                      }
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                        isCommentsOpen
                          ? 'text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 font-semibold ring-1 ring-indigo-200 dark:ring-indigo-800/60'
                          : post.comments.length > 0
                          ? 'text-slate-700 dark:text-slate-200 bg-slate-100/80 dark:bg-slate-800/70 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium'
                          : 'hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                      }`}
                      title={isCommentsOpen ? 'မှတ်ချက်များကို ပြန်သိမ်းရန်' : 'မှတ်ချက်များကို နှိပ်၍ ကြည့်ရန် / ရေးသားရန်'}
                    >
                      <MessageSquare className="w-4 h-4 shrink-0" />
                      <span>
                        {post.comments.length} Class Comments
                      </span>
                      <span className="text-[10px] opacity-80 hidden xs:inline">
                        {isCommentsOpen
                          ? '(ပြန်သိမ်းရန်)'
                          : post.comments.length > 0
                          ? '(နှိပ်၍ ကြည့်ရန်)'
                          : '(မှတ်ချက်ပေးရန်)'}
                      </span>
                      {isCommentsOpen ? (
                        <ChevronUp className="w-3.5 h-3.5 ml-0.5 shrink-0" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 ml-0.5 shrink-0" />
                      )}
                    </button>
                  </div>

                  <span className="text-[11px] text-slate-400 dark:text-slate-500 hidden sm:inline-block">
                    Course: {course.code}
                  </span>
                </div>

                {/* Threaded Discussion Section (Collapsed by default, expands on click) */}
                {isCommentsOpen && (
                  <div className="neu-inset-sm mx-3.5 sm:mx-5 mb-4 rounded-2xl px-3.5 sm:px-5 py-3.5 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200/70 dark:border-slate-700/60">
                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        <span>အတန်းတွင်း မှတ်ချက်များ ({post.comments.length})</span>
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedComments((prev) => ({
                            ...prev,
                            [post.id]: false,
                          }))
                        }
                        className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 px-2 py-0.5 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        <span>ပြန်သိမ်းမည်</span>
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {/* Existing Comments */}
                    {post.comments.length > 0 && (
                      <div className="space-y-2.5">
                        {post.comments.map((comm) => {
                          const canDeleteComment =
                            isInstructor || comm.authorId === currentUser.id;
                          const commentUser = userByIdMap.get(comm.authorId);
                          const isCommentInstructor =
                            comm.authorRole === 'admin' || comm.authorRole === 'co_admin';
                          const commentAvatar =
                            comm.authorRole === 'admin'
                              ? resolveAvatarUrl(commentUser?.avatar || comm.authorAvatar)
                              : '';
                          return (
                            <div key={comm.id} className="flex items-start gap-2.5 text-xs">
                              {comm.authorRole === 'admin' && (
                                <img
                                  src={commentAvatar || DEFAULT_AVATAR_SVG}
                                  alt={comm.authorName}
                                  loading="lazy"
                                  referrerPolicy="no-referrer"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = DEFAULT_AVATAR_SVG;
                                  }}
                                  className="w-7 h-7 rounded-full object-contain bg-white p-0.5 border border-indigo-200 dark:border-indigo-700 shrink-0 mt-0.5"
                                />
                              )}
                              <div className="flex-1 neu-raised-sm p-3 rounded-2xl">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-bold text-slate-900 dark:text-slate-100">
                                      {comm.authorName}
                                    </span>
                                    {isCommentInstructor ? (
                                      <span className="text-[9px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded">
                                        {comm.authorRole === 'admin' ? 'Lead Mentor (Admin)' : 'Co-Admin'}
                                      </span>
                                    ) : (
                                      commentUser?.rulesAccepted && (
                                        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/90 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                                          <CheckCircle className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                          <span>သိရှိ လိုက်နာပါမည်</span>
                                        </span>
                                      )
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
                    <div className="flex items-center gap-2.5 pt-1">
                      {currentUser.role === 'admin' && (
                        <img
                          src={resolveAvatarUrl(currentUser.avatar)}
                          alt={currentUser.name}
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = DEFAULT_AVATAR_SVG;
                          }}
                          className="w-8 h-8 rounded-full object-contain bg-white p-0.5 border border-indigo-200 dark:border-indigo-700 shrink-0"
                        />
                      )}
                      <div className="flex-1 flex items-center gap-2">
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
                          className="flex-1 px-3.5 py-2.5 text-xs rounded-xl neu-input text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddComment(post.id)}
                          className="p-2.5 neu-btn-indigo rounded-xl transition-all cursor-pointer shrink-0"
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

        {/* Load Older Posts Button */}
        {posts.length > visiblePostLimit && (
          <div className="neu-card rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <span className="text-slate-600 dark:text-slate-300 font-medium">
              ပြသထားသော ပို့စ်: <strong>{visiblePostLimit}</strong> / စုစုပေါင်း <strong>{posts.length}</strong> ခု
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setVisiblePostLimit((prev) => prev + 20)}
                className="px-4 py-2 rounded-xl neu-btn-indigo font-bold cursor-pointer"
              >
                + ပို့စ်အဟောင်းများ ထပ်ပြမည် (+20)
              </button>
              <button
                type="button"
                onClick={() => setVisiblePostLimit(posts.length)}
                className="px-3.5 py-2 rounded-xl neu-btn text-slate-700 dark:text-slate-200 font-semibold cursor-pointer"
              >
                အားလုံးပြမည် ({posts.length})
              </button>
            </div>
          </div>
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
