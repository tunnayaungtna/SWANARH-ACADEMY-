export type UserRole = 'admin' | 'co_admin' | 'student';

export interface User {
  id: string;
  name: string;
  email: string;
  username: string;
  password?: string; // App login password
  role: UserRole;
  phone: string;
  avatar: string;
  title?: string; // e.g. "Lead Instructor"
  gender?: 'male' | 'female' | 'other' | 'Male' | 'Female' | 'Other';
  address?: string;
  rulesAccepted?: boolean;
  rulesAcceptedAt?: string;
  mustChangePassword?: boolean; // When true, user must change password upon first login before using the app
  passwordChangedAt?: string; // Timestamp when user completed their password change
  activeDeviceId?: string;
  activeSessionToken?: string;
  sessionUpdatedAtMs?: number;
  createdAt?: string;
}

export interface VideoAsset {
  id: string;
  title: string;
  provider: 'vimeo-private' | 'bunny-stream' | 'mux-secure';
  playbackId: string;
  duration: string;
  thumbnailUrl: string;
  hlsStreamProxy: string; // obfuscated proxy endpoint
  allowDynamicWatermark: boolean;
}

export interface Attachment {
  id: string;
  name: string;
  size: string;
  type: 'pdf' | 'doc' | 'sheet' | 'slide' | 'image' | 'video' | 'zip' | 'code' | 'audio' | 'file' | string;
  url: string;
  fileData?: string;
}

export interface PostComment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  authorAvatar: string;
  content: string;
  createdAt: string;
  createdAtMs?: number;
}

export interface ZoomMeetingDetails {
  meetingId: string;
  passcode?: string;
  rawUrl: string;
  deepLink: string;
  browserFallbackUrl: string;
  scheduledTime?: string;
  topic?: string;
}

export interface CoursePost {
  id: string;
  courseId: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  authorAvatar: string;
  title: string;
  content: string;
  postType: 'lesson' | 'announcement' | 'resource';
  videoAsset?: VideoAsset;
  zoomMeeting?: ZoomMeetingDetails;
  attachments?: Attachment[];
  likes: string[]; // userIds
  comments: PostComment[];
  createdAt: string;
  createdAtMs?: number; // Epoch ms when post was created/published
  isPinned?: boolean;
  pinnedAt?: string; // ISO string when post was pinned
  pinOrder?: number; // 1, 2, or 3
  status?: 'published' | 'scheduled';
  scheduledFor?: string; // ISO string when post will be published
  scheduledForDisplay?: string; // Friendly text (e.g. "Oct 18, 2026 · 10:00 AM")
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export type DataFormFieldType = 'text' | 'textarea' | 'number' | 'phone' | 'date' | 'select';

export interface DataFormField {
  id: string;
  label: string;
  type: DataFormFieldType;
  required: boolean;
  placeholder?: string;
  options?: string[]; // Used when type === 'select'
}

export interface Quiz {
  id: string;
  courseId: string;
  title: string;
  description: string;
  durationMinutes: number;
  passingScore: number; // percentage, e.g. 70
  questions: QuizQuestion[];
  itemType?: 'exam' | 'data_form';
  formFields?: DataFormField[];
  allowStudentEditSubmission?: boolean;
  dueNotice?: string;
  mode?: 'exam' | 'practice';
  enableFlashcards?: boolean;
  showAnswersImmediately?: boolean;
  isOpen?: boolean; // Manual On/Off toggle (true = open, false = closed)
  scheduledOpenAt?: string; // ISO/datetime string for scheduled auto-open
  scheduledCloseAt?: string; // ISO/datetime string for scheduled auto-close
  timezoneMode?: 'MMT' | 'LOCAL'; // 'MMT' = Myanmar Standard Time (UTC+06:30 Asia/Yangon)
  statusUpdatedAtMs?: number;
  createdBy?: string;
  createdAt?: string;
  createdAtMs?: number;
}

export interface StudentExamSession {
  quizId: string;
  courseId: string;
  studentId: string;
  startedAtMs: number;
  startedAtMmt: string;
  durationMinutes: number;
  expiresAtMs: number;
  draftAnswers: Record<string, number>;
  fiveMinWarningShown?: boolean;
  isLockedOut?: boolean;
  quizStatusUpdatedAtMs?: number;
}

export interface QuizSubmission {
  id: string;
  quizId: string;
  courseId: string;
  studentId: string;
  studentName: string;
  studentUsername?: string;
  score: number; // percentage (0-100)
  correctCount?: number;
  totalQuestions?: number;
  passed: boolean;
  answers: Record<string, number>;
  formResponses?: Record<string, string>;
  timeSpentSeconds?: number;
  startedAtMs?: number;
  startedAtMmt?: string;
  autoSubmittedOnTimeout?: boolean;
  attemptCount?: number;
  submittedAt: string;
  submittedAtMs?: number;
}

export interface Assignment {
  id: string;
  courseId: string;
  title: string;
  description: string;
  dueDate: string;
  maxPoints: number;
  rubricItems: string[];
  attachments?: Attachment[];
}

export interface AssignmentSubmission {
  id: string;
  assignmentId: string;
  courseId: string;
  studentId: string;
  studentName: string;
  studentAvatar: string;
  submissionText: string;
  fileAttachment?: {
    name: string;
    size: string;
    uploadDate: string;
    mockUrl: string;
  };
  status: 'submitted' | 'graded';
  grade?: number;
  feedback?: string;
  submittedAt: string;
  gradedAt?: string;
}

export interface Course {
  id: string;
  code: string;
  title: string;
  section: string;
  batch: string;
  description: string;
  instructorName: string;
  instructorEmail: string;
  bannerImage: string;
  themeColor: string; // e.g. "indigo" | "emerald" | "cyan"
  enrolledStudentIds: string[];
  totalLessons: number;
  totalAssignments: number;
  totalQuizzes: number;
  sortOrder?: number;
}

export type AttendanceStatus = 'present' | 'late' | 'excused' | 'absent';

export interface AttendanceRecord {
  studentId: string;
  studentName: string;
  status: AttendanceStatus;
  checkedInAt?: string;
  checkedInAtMs?: number;
  checkedInBy: 'student' | 'instructor';
  note?: string;
}

export interface RealtimeAttendancePatch {
  type: 'session_upsert' | 'session_close_all' | 'student_checkin';
  sessionId?: string;
  courseId?: string;
  session?: AttendanceSession;
  studentId?: string;
  record?: AttendanceRecord | null;
  statusUpdatedAtMs?: number;
}

export interface AttendanceSession {
  id: string;
  courseId: string;
  date: string; // YYYY-MM-DD
  displayDate: string; // e.g. "Oct 26, 2026"
  title: string; // e.g. "Lecture 03: Daily Class Check-in"
  isOpen: boolean; // When true, students can click "Present" themselves
  openedBy: string;
  createdAt: string;
  statusUpdatedAtMs?: number; // Epoch ms when isOpen was last opened/closed by Admin/Co-Admin
  records: Record<string, AttendanceRecord>; // keyed by studentId
}

export interface CertificateData {
  certificateId: string;
  courseId: string;
  courseTitle: string;
  courseCode: string;
  studentId: string;
  studentName: string;
  issuedAt: string;
  gradeAverage: number;
  attendancePercentage?: number;
  verificationUrl: string;
  instructorSignature: string;
}

export interface StudentProgress {
  studentId: string;
  courseId: string;
  completedLessonIds: string[];
  completedAssignmentIds: string[];
  passedQuizIds: string[];
  certificate?: CertificateData;
}

export type PrivateNoteCategory = 'question' | 'leave_request' | 'attendance_request' | 'feedback';

export type PrivateNoteStatus = 'pending' | 'replied' | 'approved' | 'rejected';

export interface PrivateNote {
  id: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  studentId: string;
  studentName: string;
  studentUsername: string;
  category: PrivateNoteCategory;
  subject: string;
  leaveDate?: string;
  content: string;
  status: PrivateNoteStatus;
  replyContent?: string;
  repliedById?: string;
  repliedByName?: string;
  repliedByRole?: UserRole;
  repliedAt?: string;
  repliedAtMs?: number;
  isReadByInstructor: boolean;
  isReadByStudent: boolean;
  createdAt: string;
  createdAtMs: number;
  updatedAtMs?: number;
}

export interface RealtimePrivateNotePatch {
  type: 'note_upsert' | 'note_delete' | 'note_typing';
  noteId?: string;
  courseId?: string;
  studentId?: string;
  note?: PrivateNote;
  typingActorId?: string;
  typingActorName?: string;
  typingActorRole?: UserRole;
  typingAtMs?: number;
}

export type BookDeliveryStatus = 'pending' | 'printed' | 'shipped' | 'received';

export interface BookDeliveryRecord {
  id: string;
  courseId: string;
  courseCode?: string;
  courseTitle?: string;
  studentId: string;
  rollNo: string;
  studentName: string;
  address: string;
  phone: string;
  note?: string;
  status: BookDeliveryStatus;
  shippedAt?: string;
  receivedAt?: string;
  updatedByRole: UserRole;
  createdAt: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface BookDeliverySenderConfig {
  academyName: string;
  addressLines: string[];
  phones: string;
}

export interface RealtimeBookDeliveryPatch {
  type: 'delivery_upsert' | 'delivery_delete';
  recordId?: string;
  courseId?: string;
  studentId?: string;
  record?: BookDeliveryRecord;
}

export interface NotificationItem {
  id: string;
  userId: string;
  courseId: string;
  courseCode?: string;
  courseTitle: string;
  postId?: string;
  authorName?: string;
  authorRole?: UserRole;
  title: string;
  message: string;
  type: 'post' | 'grade' | 'quiz' | 'certificate' | 'private_note';
  targetTab?: 'stream' | 'attendance' | 'quizzes' | 'people' | 'private_notes' | 'book_delivery' | 'library';
  privateNoteId?: string;
  isRead: boolean;
  createdAt: string;
  createdAtMs?: number; // Epoch ms when notification was created
  expiresAtMs?: number; // Epoch ms when notification auto-deletes (createdAtMs + 30 mins)
}

export type AuditLogCategory = 'user' | 'course' | 'post' | 'academic' | 'security';

export type AuditLogSeverity = 'info' | 'warning' | 'critical';

export interface AuditLogEntry {
  id: string;
  actorId: string;
  actorName: string;
  actorUsername: string;
  actorRole: UserRole;
  actorAvatar?: string;
  category: AuditLogCategory;
  actionCode: string; // e.g. 'USER_CREATED', 'POST_DELETED', 'COURSE_UPDATED'
  actionLabel: string; // Bilingual label e.g. 'ကျောင်းသား/အကောင့်အသစ် ထည့်သွင်းခြင်း (User Created)'
  severity: AuditLogSeverity;
  targetType?: 'user' | 'course' | 'post' | 'assignment' | 'quiz' | 'attendance' | 'system';
  targetId?: string;
  targetName?: string;
  courseId?: string;
  courseCode?: string;
  courseTitle?: string;
  summary: string;
  details?: string;
  deviceId?: string;
  createdAt: string;
  createdAtMs: number;
}

export type LibraryItemType = 'ebook' | 'long_note' | 'youtube' | 'tiktok';

export interface LibraryAccessRules {
  enabled: boolean;
  allowedCourseIds?: string[]; // If non-empty, ONLY students enrolled in at least one of these classes can see this item
  blockedCourseIds?: string[]; // If non-empty, students enrolled in any of these classes are blocked from seeing this item
  minAttendancePercentage?: number; // e.g., 80 means students with <= 79% Roll Call are restricted
  requireAllExamsSubmitted?: boolean; // Must submit all course exams (itemType !== 'data_form')
  requireAllExamsPassed?: boolean; // Must pass all course exams
  requireAllDataFormsSubmitted?: boolean; // Must submit all course Student Data Forms (itemType === 'data_form')
  requiredQuizIds?: string[]; // Optional specific exam or data form IDs required
  hideWhenRestricted?: boolean; // true = completely hidden from ineligible students ("မမြင်ရအောင် လုံးဝဖျောက်ထားမည်"), false = show locked preview with unlock checklist
}

export interface LibraryItem {
  id: string;
  courseId: string;
  courseCode?: string;
  courseTitle?: string;
  itemType: LibraryItemType;
  title: string;
  subtitle?: string;
  category?: string;
  description?: string;
  content?: string; // Full text/markdown for long_note, or summary for ebook/video
  fileUrl?: string; // PDF / eBook URL or Data URL or Google Drive / Direct link
  fileName?: string;
  fileSize?: string;
  coverImage?: string;
  videoUrl?: string; // Original YouTube or TikTok URL
  embedId?: string; // Extracted YouTube Video ID or TikTok Video ID
  channelHandle?: string; // e.g. @swanarhacademy or @dr..si.thu.aung.s
  authorName: string;
  authorRole: UserRole;
  isPinned?: boolean;
  watermarkProtected?: boolean; // Overlays student name & username to prevent leaks
  allowDownload?: boolean; // true = students can download eBook PDF, false = Read-Only inside Library Reader
  accessRules: LibraryAccessRules;
  createdAt: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface LibraryChannelConfig {
  courseId: string;
  youtubeChannelUrl: string;
  youtubeHandle: string;
  youtubeChannelId?: string; // Optional UC... ID for direct RSS & uploads playlist
  tiktokProfileUrl: string;
  tiktokHandle: string;
  autoEmbedLiveFeeds: boolean; // Automatically show live TikTok creator feed & YouTube channel feed at top of video tabs
  defaultEbookNoteAccessRules: LibraryAccessRules; // Default gating rules applied to new eBooks & Long Notes
  updatedAtMs: number;
}




