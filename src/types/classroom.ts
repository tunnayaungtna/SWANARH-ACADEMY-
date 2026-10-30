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

export interface Quiz {
  id: string;
  courseId: string;
  title: string;
  description: string;
  durationMinutes: number;
  passingScore: number; // percentage, e.g. 70
  questions: QuizQuestion[];
  dueNotice?: string;
}

export interface QuizSubmission {
  id: string;
  quizId: string;
  courseId: string;
  studentId: string;
  studentName: string;
  score: number; // percentage
  passed: boolean;
  answers: Record<string, number>;
  submittedAt: string;
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
}

export type AttendanceStatus = 'present' | 'late' | 'excused' | 'absent';

export interface AttendanceRecord {
  studentId: string;
  studentName: string;
  status: AttendanceStatus;
  checkedInAt?: string;
  checkedInBy: 'student' | 'instructor';
  note?: string;
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

export interface NotificationItem {
  id: string;
  userId: string;
  courseId: string;
  courseTitle: string;
  title: string;
  message: string;
  type: 'post' | 'grade' | 'quiz' | 'certificate';
  isRead: boolean;
  createdAt: string;
}

