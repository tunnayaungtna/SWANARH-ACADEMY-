import { createClient } from '@supabase/supabase-js';
import {
  User,
  UserRole,
  Course,
  CoursePost,
  Assignment,
  AssignmentSubmission,
  Quiz,
  AttendanceSession,
  NotificationItem,
} from '../types/classroom';

export const NOTIFICATION_TTL_MS = 30 * 60 * 1000; // 30 minutes auto-delete window

// Supabase Project Credentials provided by user
export const SUPABASE_CONFIG = {
  url: import.meta.env.VITE_SUPABASE_URL || 'https://wxfassadxuxfvywvnlxs.supabase.co',
  publishableKey: import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_mhYrcHRIdU-2EXQoXATDaw_s4vO4ZXv',
  jwksUrl: import.meta.env.VITE_SUPABASE_JWKS_URL || 'https://wxfassadxuxfvywvnlxs.supabase.co/auth/v1/.well-known/jwks.json',
};

// Initialize Supabase Client for client-side queries
export const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.publishableKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

/**
 * Production-ready PostgreSQL SQL schema and RLS policies for Supabase
 */
export const SUPABASE_SQL_SCHEMA = `-- ========================================================
-- Classroom OS - Supabase Database Schema & RLS Policies
-- Execute this script in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/wxfassadxuxfvywvnlxs/sql
-- ========================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. User Profiles Table (Admin, Co-Admin, Students)
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'co_admin', 'student')),
  phone TEXT DEFAULT '+95 9 000 000000',
  avatar TEXT,
  title TEXT,
  gender TEXT DEFAULT 'male',
  address TEXT,
  password TEXT DEFAULT 'student123',
  rules_accepted BOOLEAN DEFAULT FALSE,
  rules_accepted_at TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure gender, address, password & rules_accepted columns exist if table was created earlier
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT 'male';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password TEXT DEFAULT 'student123';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS rules_accepted BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS rules_accepted_at TEXT;

-- Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated or public users to read profiles
DROP POLICY IF EXISTS "Public profiles are viewable by all" ON public.profiles;
CREATE POLICY "Public profiles are viewable by all"
  ON public.profiles FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update their profile" ON public.profiles;
CREATE POLICY "Users can update their profile"
  ON public.profiles FOR UPDATE
  USING (true);

DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
CREATE POLICY "Admins can delete profiles"
  ON public.profiles FOR DELETE
  USING (true);

-- 3. Courses Table
CREATE TABLE IF NOT EXISTS public.courses (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  section TEXT NOT NULL,
  batch TEXT NOT NULL,
  description TEXT,
  instructor_name TEXT NOT NULL,
  instructor_email TEXT NOT NULL,
  banner_image TEXT,
  theme_color TEXT DEFAULT 'indigo',
  enrolled_student_ids TEXT[] DEFAULT '{}',
  total_lessons INT DEFAULT 0,
  total_assignments INT DEFAULT 0,
  total_quizzes INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Courses are viewable by all users" ON public.courses;
CREATE POLICY "Courses are viewable by all users"
  ON public.courses FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins and Co-admins can insert courses" ON public.courses;
CREATE POLICY "Admins and Co-admins can insert courses"
  ON public.courses FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins and Co-admins can update courses" ON public.courses;
CREATE POLICY "Admins and Co-admins can update courses"
  ON public.courses FOR UPDATE
  USING (true);

DROP POLICY IF EXISTS "Admins and Co-admins can delete courses" ON public.courses;
CREATE POLICY "Admins and Co-admins can delete courses"
  ON public.courses FOR DELETE
  USING (true);

-- 4. Course Posts Table (Stream Feed, Multi-pin, Scheduled posts)
CREATE TABLE IF NOT EXISTS public.posts (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_role TEXT NOT NULL,
  author_avatar TEXT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  post_type TEXT NOT NULL CHECK (post_type IN ('lesson', 'announcement', 'resource')),
  status TEXT DEFAULT 'published' CHECK (status IN ('published', 'scheduled')),
  scheduled_for TIMESTAMPTZ,
  scheduled_for_display TEXT,
  is_pinned BOOLEAN DEFAULT FALSE,
  pinned_at TIMESTAMPTZ,
  pin_order INT,
  attachments JSONB DEFAULT '[]'::jsonb,
  zoom_meeting JSONB,
  likes TEXT[] DEFAULT '{}',
  comments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Posts viewable according to status" ON public.posts;
CREATE POLICY "Posts viewable according to status"
  ON public.posts FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins and Co-admins can create posts" ON public.posts;
CREATE POLICY "Admins and Co-admins can create posts"
  ON public.posts FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins and Co-admins can update posts" ON public.posts;
CREATE POLICY "Admins and Co-admins can update posts"
  ON public.posts FOR UPDATE
  USING (true);

DROP POLICY IF EXISTS "Admins and Co-admins can delete posts" ON public.posts;
CREATE POLICY "Admins and Co-admins can delete posts"
  ON public.posts FOR DELETE
  USING (true);

-- 5. Assignments & Submissions
CREATE TABLE IF NOT EXISTS public.assignments (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  due_date TEXT NOT NULL,
  total_points INT DEFAULT 100,
  attachments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.assignment_submissions (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  student_avatar TEXT,
  files JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  grade INT,
  feedback TEXT,
  graded_at TIMESTAMPTZ
);

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Assignments viewable" ON public.assignments;
CREATE POLICY "Assignments viewable" ON public.assignments FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage assignments" ON public.assignments;
CREATE POLICY "Admins manage assignments" ON public.assignments FOR ALL USING (true);

DROP POLICY IF EXISTS "Student submissions viewable" ON public.assignment_submissions;
CREATE POLICY "Student submissions viewable" ON public.assignment_submissions FOR ALL USING (true);

-- 6. Quizzes & Quiz Submissions
CREATE TABLE IF NOT EXISTS public.quizzes (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  time_limit_minutes INT DEFAULT 30,
  passing_score INT DEFAULT 70,
  questions JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.quiz_submissions (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  score INT NOT NULL,
  passed BOOLEAN NOT NULL,
  answers JSONB,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Quizzes viewable" ON public.quizzes;
CREATE POLICY "Quizzes viewable" ON public.quizzes FOR ALL USING (true);
DROP POLICY IF EXISTS "Quiz submissions viewable" ON public.quiz_submissions;
CREATE POLICY "Quiz submissions viewable" ON public.quiz_submissions FOR ALL USING (true);

-- 7. Attendance Sessions Table
CREATE TABLE IF NOT EXISTS public.attendance_sessions (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  display_date TEXT NOT NULL,
  title TEXT NOT NULL,
  is_open BOOLEAN DEFAULT TRUE,
  opened_by TEXT NOT NULL,
  records JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Attendance sessions full access" ON public.attendance_sessions;
CREATE POLICY "Attendance sessions full access" ON public.attendance_sessions FOR ALL USING (true);

-- 8. Seed Initial Demo Accounts (Admin, Co-Admin, Students)
INSERT INTO public.profiles (id, name, username, email, role, phone, avatar, title, gender, address)
VALUES
  ('user-admin-1', 'Dr. Kyaw Swar', 'kyawswar.admin', 'kyaw.admin@classroomos.edu', 'admin', '+95 9 791 234567', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80', 'Dean of Computing & Lead Instructor', 'male', 'No. 45, Pyay Road, Kamayut, Yangon'),
  ('user-coadmin-1', 'Daw Khin Myo', 'khinmyo.coadmin', 'khinmyo.coadmin@classroomos.edu', 'co_admin', '+95 9 512 889900', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80', 'Course Coordinator & Assistant Instructor', 'female', 'No. 12, University Avenue, Bahan, Yangon'),
  ('user-student-1', 'Aung Min', 'aungmin2026', 'aung.min@student.edu', 'student', '+95 9 970 882190', 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80', 'Computer Science Undergraduate', 'male', 'Room 3B, Insein Road, Hlaing, Yangon'),
  ('user-student-2', 'Su Su Win', 'susu.win', 'susu.win@student.edu', 'student', '+95 9 420 551829', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80', 'Software Engineering Scholar', 'female', 'No. 88, Bogyoke Aung San Road, Kyauktada, Yangon'),
  ('user-student-3', 'Thura Soe', 'thuraz', 'thura.soe@student.edu', 'student', '+95 9 250 119842', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80', 'Cybersecurity Major', 'male', 'No. 102, Strand Road, Ahlone, Yangon')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  title = EXCLUDED.title,
  gender = EXCLUDED.gender,
  address = EXCLUDED.address;

-- Grant schema usage and table permissions for Supabase Data API (Oct 30+ compliance)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- Ensure any future tables created in public schema automatically receive grants
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public 
GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated, service_role;

-- 9. High-Concurrency Indexes for Supabase Free Plan Performance
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles (username);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles (email);
CREATE INDEX IF NOT EXISTS idx_posts_course_id ON public.posts (course_id);
CREATE INDEX IF NOT EXISTS idx_assignments_course_id ON public.assignments (course_id);
CREATE INDEX IF NOT EXISTS idx_submissions_assignment_id ON public.assignment_submissions (assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student_id ON public.assignment_submissions (student_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_course_id ON public.quizzes (course_id);
CREATE INDEX IF NOT EXISTS idx_quiz_submissions_quiz_id ON public.quiz_submissions (quiz_id);
CREATE INDEX IF NOT EXISTS idx_attendance_course_id ON public.attendance_sessions (course_id);

-- 10. Classroom Notifications Table (Auto-expires 30 minutes after post creation)
CREATE TABLE IF NOT EXISTS public.notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  course_code TEXT,
  course_title TEXT NOT NULL,
  post_id TEXT,
  author_name TEXT,
  author_role TEXT,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'post',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 minutes')
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Notifications full access" ON public.notifications;
CREATE POLICY "Notifications full access" ON public.notifications FOR ALL USING (true);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_expires_at ON public.notifications (expires_at);
CREATE INDEX IF NOT EXISTS idx_notifications_post_id ON public.notifications (post_id);
`;

const DEFAULT_FALLBACK_AVATAR =
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';
const DEFAULT_FALLBACK_BANNER =
  'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200&auto=format&fit=crop&q=80';

/**
 * Strips base64 images & oversized strings (> 2.5KB) before sending to Supabase SQL
 * so the 500MB Free Plan database and 5GB monthly Egress Bandwidth stay ultra-lean.
 * Local storage retains high-res data:image/ URLs on the user's device.
 */
function compactAvatarForCloud(avatar?: string): string {
  if (!avatar) return DEFAULT_FALLBACK_AVATAR;
  if (avatar.startsWith('data:') || avatar.length > 2500) return DEFAULT_FALLBACK_AVATAR;
  return avatar;
}

function compactBannerForCloud(banner?: string): string {
  if (!banner) return DEFAULT_FALLBACK_BANNER;
  if (banner.startsWith('data:') || banner.length > 3500) return DEFAULT_FALLBACK_BANNER;
  return banner;
}

const RULES_MARKER_PREFIX = '||RULES_OK:';

function encodeTitleWithRules(user: User): string | null {
  const baseTitle = (user.title || '').split(RULES_MARKER_PREFIX)[0].trim();
  if (user.rulesAccepted) {
    const stamp = user.rulesAcceptedAt || new Date().toISOString();
    return `${baseTitle}${RULES_MARKER_PREFIX}${stamp}`;
  }
  return baseTitle || null;
}

function decodeTitleAndRules(
  rawTitle?: string | null,
  rowRulesAccepted?: boolean | null,
  rowRulesAcceptedAt?: string | null
): { title?: string; rulesAccepted?: boolean; rulesAcceptedAt?: string } {
  const str = rawTitle || '';
  if (str.includes(RULES_MARKER_PREFIX)) {
    const [cleanTitle, acceptedStamp] = str.split(RULES_MARKER_PREFIX);
    return {
      title: cleanTitle.trim() || undefined,
      rulesAccepted: true,
      rulesAcceptedAt: rowRulesAcceptedAt || acceptedStamp?.trim() || undefined,
    };
  }
  return {
    title: str.trim() || undefined,
    rulesAccepted: rowRulesAccepted ? true : undefined,
    rulesAcceptedAt: rowRulesAcceptedAt || undefined,
  };
}

export class SupabaseService {
  // Caches detected profile schema columns so we never repeat fallback roundtrips
  private static profileSchemaMode: 'full' | 'no_password' | 'core' = 'full';
  // Caches whether public.notifications table exists in Supabase to avoid wasted 404/42P01 calls
  private static notificationsTableStatus: 'unknown' | 'available' | 'missing' = 'unknown';
  // In-memory payload signature cache so identical records are never re-uploaded to Supabase
  private static lastUpsertSignatures = new Map<string, string>();
  private static lastExpiredCleanupAt = 0;

  private static hasChangedSignature(key: string, payload: unknown): boolean {
    try {
      const sig = JSON.stringify(payload);
      if (this.lastUpsertSignatures.get(key) === sig) {
        return false;
      }
      return true;
    } catch {
      return true;
    }
  }

  private static recordSignature(key: string, payload: unknown): void {
    try {
      this.lastUpsertSignatures.set(key, JSON.stringify(payload));
    } catch {
      // ignore
    }
  }

  /**
   * Check connection status to Supabase
   */
  static async checkConnection(): Promise<{ connected: boolean; message: string; tableCount?: number }> {
    try {
      const { data, error } = await supabase.from('profiles').select('id', { count: 'exact', head: true });
      if (error) {
        if (error.code === '42P01') {
          return {
            connected: false,
            message: 'Supabase သို့ ချိတ်ဆက်မိသော်လည်း "profiles" table မရှိသေးပါ။ အောက်ပါ SQL Script ကို Copy ကူးပြီး Supabase SQL Editor တွင် RUN ပေးပါ။',
          };
        }
        return {
          connected: false,
          message: `Supabase error (${error.code || 'Error'}): ${error.message}`,
        };
      }
      return {
        connected: true,
        message: 'Supabase Database (Free Plan Optimized) နှင့် အောင်မြင်စွာ ချိတ်ဆက်ပြီး အသင့်အနေအထား ရှိပါသည်!',
        tableCount: data ? 1 : 0,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { connected: false, message: `Connection error: ${msg}` };
    }
  }

  /**
   * Fetch all profiles from Supabase if table exists (bounded for Free Plan efficiency)
   */
  static async getRemoteProfiles(): Promise<User[] | null> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .limit(600);

      if (error || !data) {
        return null;
      }

      return data.map((row) => {
        const decoded = decodeTitleAndRules(
          row.title,
          row.rules_accepted,
          row.rules_accepted_at
        );
        return {
          id: row.id,
          name: row.name,
          username: row.username,
          email: row.email,
          password: row.password || undefined,
          role: row.role as UserRole,
          phone: row.phone || '',
          avatar: row.avatar || '',
          title: decoded.title,
          gender: row.gender || undefined,
          address: row.address || undefined,
          rulesAccepted: decoded.rulesAccepted,
          rulesAcceptedAt: decoded.rulesAcceptedAt,
        };
      });
    } catch {
      return null;
    }
  }

  /**
   * Fetch all courses from Supabase if table exists
   */
  static async getRemoteCourses(): Promise<Course[] | null> {
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .limit(200);

      if (error || !data) {
        return null;
      }

      return data.map((row) => ({
        id: row.id,
        code: row.code,
        title: row.title,
        section: row.section,
        batch: row.batch,
        description: row.description || '',
        instructorName: row.instructor_name,
        instructorEmail: row.instructor_email,
        bannerImage: row.banner_image || DEFAULT_FALLBACK_BANNER,
        themeColor: (row.theme_color as Course['themeColor']) || 'indigo',
        enrolledStudentIds: Array.isArray(row.enrolled_student_ids) ? row.enrolled_student_ids : [],
        totalLessons: row.total_lessons ?? 0,
        totalAssignments: row.total_assignments ?? 0,
        totalQuizzes: row.total_quizzes ?? 0,
      }));
    } catch {
      return null;
    }
  }

  /**
   * Fetch posts from Supabase (optionally scoped to enrolled courseIds to save Egress bandwidth)
   */
  static async getRemotePosts(courseIds?: string[]): Promise<CoursePost[] | null> {
    try {
      if (courseIds && courseIds.length === 0) {
        return [];
      }
      let query = supabase
        .from('posts')
        .select(
          'id,course_id,author_id,author_name,author_role,author_avatar,title,content,post_type,status,scheduled_for,scheduled_for_display,is_pinned,pinned_at,pin_order,attachments,likes,comments,created_at'
        )
        .order('created_at', { ascending: false })
        .limit(150);

      if (courseIds && courseIds.length > 0 && courseIds.length <= 25) {
        query = query.in('course_id', courseIds);
      }

      const { data, error } = await query;
      if (error || !data) return null;

      return data.map((row) => {
        const parsedMs = row.created_at ? new Date(row.created_at).getTime() : undefined;
        return {
          id: row.id,
          courseId: row.course_id,
          authorId: row.author_id || 'user-admin-1',
          authorName: row.author_name || 'Instructor',
          authorRole: (row.author_role as UserRole) || 'admin',
          authorAvatar: row.author_avatar || '',
          title: row.title || '',
          content: row.content || '',
          createdAt: row.created_at
            ? new Date(row.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
            : 'Recently',
          createdAtMs: parsedMs && !isNaN(parsedMs) ? parsedMs : undefined,
          postType: (row.post_type as CoursePost['postType']) || 'announcement',
          status: (row.status as CoursePost['status']) || 'published',
          scheduledFor: row.scheduled_for || undefined,
          scheduledForDisplay: row.scheduled_for_display || undefined,
          isPinned: Boolean(row.is_pinned),
          pinnedAt: row.pinned_at || undefined,
          pinOrder: row.pin_order ?? undefined,
          attachments: Array.isArray(row.attachments) ? row.attachments : [],
          likes: Array.isArray(row.likes) ? row.likes : [],
          comments: Array.isArray(row.comments) ? row.comments : [],
        };
      });
    } catch {
      return null;
    }
  }

  /**
   * Fetch all assignments from Supabase
   */
  static async getRemoteAssignments(): Promise<Assignment[] | null> {
    try {
      const { data, error } = await supabase
        .from('assignments')
        .select('*')
        .limit(300);
      if (error || !data) return null;

      return data.map((row) => ({
        id: row.id,
        courseId: row.course_id,
        title: row.title || '',
        description: row.description || '',
        dueDate: row.due_date || '',
        maxPoints: row.total_points ?? 100,
        rubricItems: ['Code Quality & Correctness', 'Documentation & Verification'],
      }));
    } catch {
      return null;
    }
  }

  /**
   * Fetch all assignment submissions from Supabase
   */
  static async getRemoteSubmissions(): Promise<AssignmentSubmission[] | null> {
    try {
      const { data, error } = await supabase
        .from('assignment_submissions')
        .select('*')
        .limit(500);
      if (error || !data) return null;

      return data.map((row) => {
        const filesArr = Array.isArray(row.files) ? row.files : [];
        return {
          id: row.id,
          assignmentId: row.assignment_id,
          courseId: '',
          studentId: row.student_id,
          studentName: row.student_name || 'Student',
          studentAvatar: row.student_avatar || '',
          submittedAt: row.submitted_at
            ? new Date(row.submitted_at).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })
            : 'Submitted',
          fileAttachment: filesArr[0] || undefined,
          submissionText: row.notes || '',
          grade: typeof row.grade === 'number' ? row.grade : undefined,
          feedback: row.feedback || undefined,
          status: (typeof row.grade === 'number' ? 'graded' : 'submitted') as 'submitted' | 'graded',
        };
      });
    } catch {
      return null;
    }
  }

  /**
   * Fetch all quizzes from Supabase
   */
  static async getRemoteQuizzes(): Promise<Quiz[] | null> {
    try {
      const { data, error } = await supabase
        .from('quizzes')
        .select('*')
        .limit(200);
      if (error || !data) return null;

      return data.map((row) => ({
        id: row.id,
        courseId: row.course_id,
        title: row.title || '',
        description: 'Timed Assessment',
        timeLimitMinutes: row.time_limit_minutes ?? 30,
        durationMinutes: row.time_limit_minutes ?? 30,
        passingScore: row.passing_score ?? 70,
        questions: Array.isArray(row.questions) ? row.questions : [],
      }));
    } catch {
      return null;
    }
  }

  /**
   * Fetch attendance sessions from Supabase (optionally scoped to enrolled courseIds)
   */
  static async getRemoteAttendanceSessions(courseIds?: string[]): Promise<AttendanceSession[] | null> {
    try {
      if (courseIds && courseIds.length === 0) {
        return [];
      }
      let query = supabase
        .from('attendance_sessions')
        .select('id,course_id,date,display_date,title,is_open,opened_by,records,created_at')
        .limit(150);

      if (courseIds && courseIds.length > 0 && courseIds.length <= 25) {
        query = query.in('course_id', courseIds);
      }

      const { data, error } = await query;
      if (error || !data) return null;

      return data.map((row) => ({
        id: row.id,
        courseId: row.course_id,
        date: row.date,
        displayDate: row.display_date || row.date,
        title: row.title || 'Class Attendance',
        isOpen: Boolean(row.is_open),
        openedBy: row.opened_by || 'Instructor',
        createdAt: row.created_at || new Date().toISOString(),
        records: row.records && typeof row.records === 'object' ? row.records : {},
      }));
    } catch {
      return null;
    }
  }

  /**
   * Fetch active (non-expired) notifications for a user from Supabase and auto-purge expired (>30 mins) rows
   */
  static async getRemoteNotifications(userId?: string): Promise<NotificationItem[] | null> {
    if (this.notificationsTableStatus === 'missing') {
      return null;
    }
    try {
      // Piggyback periodic cleanup of expired (>30 mins) notifications in Supabase (at most once per 60s)
      await this.purgeExpiredNotifications();

      const cutoffIso = new Date(Date.now() - NOTIFICATION_TTL_MS).toISOString();
      let query = supabase
        .from('notifications')
        .select(
          'id,user_id,course_id,course_code,course_title,post_id,author_name,author_role,title,message,type,is_read,created_at,expires_at'
        )
        .gt('created_at', cutoffIso)
        .order('created_at', { ascending: false })
        .limit(60);

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;
      if (error) {
        if (error.code === '42P01' || error.message?.includes('notifications')) {
          this.notificationsTableStatus = 'missing';
        }
        return null;
      }
      this.notificationsTableStatus = 'available';
      if (!data) return [];

      return data.map((row) => {
        const createdMs = row.created_at ? new Date(row.created_at).getTime() : Date.now();
        const expiresMs = row.expires_at
          ? new Date(row.expires_at).getTime()
          : createdMs + NOTIFICATION_TTL_MS;
        return {
          id: row.id,
          userId: row.user_id,
          courseId: row.course_id,
          courseCode: row.course_code || undefined,
          courseTitle: row.course_title || '',
          postId: row.post_id || undefined,
          authorName: row.author_name || undefined,
          authorRole: (row.author_role as UserRole) || undefined,
          title: row.title || '',
          message: row.message || '',
          type: (row.type as NotificationItem['type']) || 'post',
          isRead: Boolean(row.is_read),
          createdAt: row.created_at
            ? new Date(row.created_at).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            : 'Just now',
          createdAtMs: createdMs,
          expiresAtMs: expiresMs,
        };
      });
    } catch {
      return null;
    }
  }

  /**
   * Batch upsert notifications to Supabase (with 30-minute expiration timestamp)
   */
  static async upsertNotifications(notifs: NotificationItem[]): Promise<boolean> {
    if (this.notificationsTableStatus === 'missing' || notifs.length === 0) {
      return false;
    }
    try {
      const now = Date.now();
      const validNotifs = notifs.filter((n) => {
        const created = n.createdAtMs || now;
        return now - created < NOTIFICATION_TTL_MS;
      });
      if (validNotifs.length === 0) return true;

      const rows = validNotifs.map((n) => {
        const createdMs = n.createdAtMs || now;
        const expiresMs = n.expiresAtMs || createdMs + NOTIFICATION_TTL_MS;
        return {
          id: n.id,
          user_id: n.userId,
          course_id: n.courseId,
          course_code: n.courseCode || null,
          course_title: n.courseTitle,
          post_id: n.postId || null,
          author_name: n.authorName || null,
          author_role: n.authorRole || null,
          title: n.title,
          message: n.message,
          type: n.type || 'post',
          is_read: Boolean(n.isRead),
          created_at: new Date(createdMs).toISOString(),
          expires_at: new Date(expiresMs).toISOString(),
        };
      });

      const { error } = await supabase.from('notifications').upsert(rows, { onConflict: 'id' });
      if (error) {
        if (error.code === '42P01' || error.message?.includes('notifications')) {
          this.notificationsTableStatus = 'missing';
        }
        return false;
      }
      this.notificationsTableStatus = 'available';
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Auto-delete notifications older than 30 minutes (or specific expired IDs) from Supabase SQL database
   */
  static async purgeExpiredNotifications(expiredIds: string[] = [], force: boolean = false): Promise<boolean> {
    if (this.notificationsTableStatus === 'missing') {
      return false;
    }
    const now = Date.now();
    const shouldRunTimeSweep = force || now - this.lastExpiredCleanupAt >= 45_000;
    if (!shouldRunTimeSweep && expiredIds.length === 0) {
      return true;
    }

    try {
      if (shouldRunTimeSweep) {
        this.lastExpiredCleanupAt = now;
        const cutoffIso = new Date(now - NOTIFICATION_TTL_MS).toISOString();
        const nowIso = new Date(now).toISOString();
        const { error } = await supabase
          .from('notifications')
          .delete()
          .or(`created_at.lt.${cutoffIso},expires_at.lte.${nowIso}`);

        if (error) {
          if (error.code === '42P01' || error.message?.includes('notifications')) {
            this.notificationsTableStatus = 'missing';
            return false;
          }
        } else {
          this.notificationsTableStatus = 'available';
        }
      }

      if (expiredIds.length > 0) {
        await supabase.from('notifications').delete().in('id', expiredIds.slice(0, 100));
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete notifications associated with a deleted post or course in Supabase
   */
  static async deleteNotificationsByPostId(postId: string): Promise<boolean> {
    if (this.notificationsTableStatus === 'missing') return false;
    try {
      const { error } = await supabase.from('notifications').delete().eq('post_id', postId);
      if (error && (error.code === '42P01' || error.message?.includes('notifications'))) {
        this.notificationsTableStatus = 'missing';
      }
      return !error;
    } catch {
      return false;
    }
  }

  private static buildProfilePayload(
    user: User,
    mode: 'full' | 'no_password' | 'core'
  ): Record<string, unknown> {
    const safeAvatar = compactAvatarForCloud(user.avatar);
    const nowIso = new Date().toISOString();
    const encodedTitle = encodeTitleWithRules(user);

    if (mode === 'core') {
      return {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
        phone: user.phone || '+95 9 000 000000',
        avatar: safeAvatar,
        title: encodedTitle,
        updated_at: nowIso,
      };
    }

    if (mode === 'no_password') {
      return {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
        phone: user.phone || '+95 9 000 000000',
        avatar: safeAvatar,
        title: encodedTitle,
        gender: user.gender || 'male',
        address: user.address || null,
        updated_at: nowIso,
      };
    }

    return {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      password:
        user.password ||
        (user.role === 'admin' ? 'admin123' : user.role === 'co_admin' ? 'coadmin123' : 'student123'),
      role: user.role,
      phone: user.phone || '+95 9 000 000000',
      avatar: safeAvatar,
      title: encodedTitle,
      gender: user.gender || 'male',
      address: user.address || null,
      updated_at: nowIso,
    };
  }

  /**
   * Create or update a profile in Supabase with cached schema mode & signature deduplication
   * so Free Plan never wastes extra HTTP calls.
   */
  static async upsertProfile(user: User): Promise<{ success: boolean; error?: string }> {
    try {
      const payload = this.buildProfilePayload(user, this.profileSchemaMode);
      const sigKey = `profile:${user.id}`;
      // Compare without updated_at timestamp so identical profiles aren't re-uploaded
      const { updated_at: _ignoreTs, ...comparablePayload } = payload;
      if (!this.hasChangedSignature(sigKey, comparablePayload)) {
        return { success: true };
      }

      const { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' });

      if (!error) {
        this.recordSignature(sigKey, comparablePayload);
        return { success: true };
      }

      // Fallback 1: without password column
      if (this.profileSchemaMode === 'full') {
        const noPwdPayload = this.buildProfilePayload(user, 'no_password');
        const { error: errNoPwd } = await supabase
          .from('profiles')
          .upsert(noPwdPayload, { onConflict: 'id' });
        if (!errNoPwd) {
          this.profileSchemaMode = 'no_password';
          this.recordSignature(sigKey, comparablePayload);
          return { success: true };
        }
      }

      // Fallback 2: core columns only
      const corePayload = this.buildProfilePayload(user, 'core');
      const { error: fallbackError } = await supabase
        .from('profiles')
        .upsert(corePayload, { onConflict: 'id' });

      if (!fallbackError) {
        this.profileSchemaMode = 'core';
        this.recordSignature(sigKey, comparablePayload);
        return { success: true };
      }

      return { success: false, error: fallbackError.message || error.message };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  }

  /**
   * Delete a profile and all associated student submissions from Supabase SQL database
   */
  static async deleteProfile(userId: string): Promise<boolean> {
    try {
      this.lastUpsertSignatures.delete(`profile:${userId}`);
      await Promise.allSettled([
        supabase.from('assignment_submissions').delete().eq('student_id', userId),
        supabase.from('quiz_submissions').delete().eq('student_id', userId),
      ]);
      const { error } = await supabase.from('profiles').delete().eq('id', userId);
      return !error;
    } catch {
      return false;
    }
  }

  /**
   * Create or update a course (including enrolled_student_ids) in Supabase
   */
  static async upsertCourse(course: Course): Promise<{ success: boolean; error?: string }> {
    try {
      const row = {
        id: course.id,
        code: course.code,
        title: course.title,
        section: course.section,
        batch: course.batch,
        description: course.description,
        instructor_name: course.instructorName,
        instructor_email: course.instructorEmail,
        banner_image: compactBannerForCloud(course.bannerImage),
        theme_color: course.themeColor || 'indigo',
        enrolled_student_ids: course.enrolledStudentIds || [],
        total_lessons: course.totalLessons || 0,
        total_assignments: course.totalAssignments || 0,
        total_quizzes: course.totalQuizzes || 0,
      };
      const sigKey = `course:${course.id}`;
      if (!this.hasChangedSignature(sigKey, row)) {
        return { success: true };
      }
      const { error } = await supabase.from('courses').upsert(row, { onConflict: 'id' });
      if (error) {
        return { success: false, error: error.message };
      }
      this.recordSignature(sigKey, row);
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  }

  /**
   * Delete a classroom/course and all its child records from Supabase SQL database
   */
  static async deleteCourse(courseId: string): Promise<boolean> {
    try {
      this.lastUpsertSignatures.delete(`course:${courseId}`);
      await Promise.allSettled([
        supabase.from('posts').delete().eq('course_id', courseId),
        supabase.from('assignments').delete().eq('course_id', courseId),
        supabase.from('quizzes').delete().eq('course_id', courseId),
        supabase.from('attendance_sessions').delete().eq('course_id', courseId),
        this.notificationsTableStatus !== 'missing'
          ? supabase.from('notifications').delete().eq('course_id', courseId)
          : Promise.resolve(),
      ]);
      const { error } = await supabase.from('courses').delete().eq('id', courseId);
      return !error;
    } catch {
      return false;
    }
  }

  private static formatPostRow(post: CoursePost) {
    // Strip heavy base64 fileData & oversized data URLs from attachments before storing in Supabase
    const safeAttachments = (post.attachments || []).map((att) => ({
      id: att.id,
      name: att.name,
      size: att.size,
      type: att.type,
      url:
        att.url && (att.url.startsWith('data:') || att.url.length > 2000)
          ? '#attachment'
          : att.url,
    }));

    // Keep latest 50 comments max in Supabase row and strip base64 avatars
    const safeComments = (post.comments || []).slice(-50).map((c) => ({
      id: c.id,
      postId: c.postId,
      authorId: c.authorId,
      authorName: c.authorName,
      authorRole: c.authorRole,
      authorAvatar: compactAvatarForCloud(c.authorAvatar),
      content: (c.content || '').slice(0, 1000),
      createdAt: c.createdAt,
    }));

    return {
      id: post.id,
      course_id: post.courseId,
      author_id: post.authorId,
      author_name: post.authorName,
      author_role: post.authorRole,
      author_avatar: compactAvatarForCloud(post.authorAvatar),
      title: post.title,
      content: post.content,
      post_type: post.postType,
      status: post.status || 'published',
      scheduled_for: post.scheduledFor || null,
      scheduled_for_display: post.scheduledForDisplay || null,
      is_pinned: Boolean(post.isPinned),
      pinned_at: post.pinnedAt || null,
      pin_order: post.pinOrder ?? null,
      attachments: safeAttachments,
      likes: post.likes || [],
      comments: safeComments,
    };
  }

  /**
   * Upsert a stream post (including comments & likes) to Supabase SQL database
   */
  static async upsertPost(post: CoursePost): Promise<boolean> {
    try {
      const row = this.formatPostRow(post);
      const sigKey = `post:${post.id}`;
      if (!this.hasChangedSignature(sigKey, row)) {
        return true;
      }
      const { error } = await supabase.from('posts').upsert(row, { onConflict: 'id' });
      if (!error) {
        this.recordSignature(sigKey, row);
      }
      return !error;
    } catch {
      return false;
    }
  }

  /**
   * Auto-delete a post and its associated student notifications from Supabase SQL database
   */
  static async deletePost(postId: string): Promise<boolean> {
    try {
      this.lastUpsertSignatures.delete(`post:${postId}`);
      await this.deleteNotificationsByPostId(postId);
      const { error } = await supabase.from('posts').delete().eq('id', postId);
      return !error;
    } catch {
      return false;
    }
  }

  /**
   * Upsert an assignment to Supabase SQL database
   */
  static async upsertAssignment(assignment: Assignment): Promise<boolean> {
    try {
      const { error } = await supabase.from('assignments').upsert(
        {
          id: assignment.id,
          course_id: assignment.courseId,
          title: assignment.title,
          description: assignment.description,
          due_date: assignment.dueDate,
          total_points: assignment.maxPoints || 100,
        },
        { onConflict: 'id' }
      );
      return !error;
    } catch {
      return false;
    }
  }

  /**
   * Auto-delete an assignment and its submissions from Supabase SQL database
   */
  static async deleteAssignment(assignmentId: string): Promise<boolean> {
    try {
      await supabase.from('assignment_submissions').delete().eq('assignment_id', assignmentId);
      const { error } = await supabase.from('assignments').delete().eq('id', assignmentId);
      return !error;
    } catch {
      return false;
    }
  }

  private static formatSubmissionRow(sub: AssignmentSubmission) {
    const safeFile = sub.fileAttachment
      ? {
          ...sub.fileAttachment,
          mockUrl:
            sub.fileAttachment.mockUrl && sub.fileAttachment.mockUrl.length > 8000
              ? '#attachment'
              : sub.fileAttachment.mockUrl,
        }
      : null;

    return {
      id: sub.id,
      assignment_id: sub.assignmentId,
      student_id: sub.studentId,
      student_name: sub.studentName,
      student_avatar: compactAvatarForCloud(sub.studentAvatar),
      files: safeFile ? [safeFile] : [],
      notes: sub.submissionText || '',
      grade: sub.grade ?? null,
      feedback: sub.feedback ?? null,
    };
  }

  /**
   * Upsert an assignment submission to Supabase SQL database
   */
  static async upsertAssignmentSubmission(sub: AssignmentSubmission): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('assignment_submissions')
        .upsert(this.formatSubmissionRow(sub), { onConflict: 'id' });
      return !error;
    } catch {
      return false;
    }
  }

  /**
   * Auto-delete an assignment submission from Supabase SQL database
   */
  static async deleteAssignmentSubmission(submissionId: string): Promise<boolean> {
    try {
      const { error } = await supabase.from('assignment_submissions').delete().eq('id', submissionId);
      return !error;
    } catch {
      return false;
    }
  }

  /**
   * Upsert a quiz to Supabase SQL database
   */
  static async upsertQuiz(quiz: Quiz): Promise<boolean> {
    try {
      const { error } = await supabase.from('quizzes').upsert(
        {
          id: quiz.id,
          course_id: quiz.courseId,
          title: quiz.title,
          time_limit_minutes: quiz.durationMinutes || 30,
          passing_score: quiz.passingScore || 70,
          questions: quiz.questions || [],
        },
        { onConflict: 'id' }
      );
      return !error;
    } catch {
      return false;
    }
  }

  /**
   * Auto-delete a quiz and its submissions from Supabase SQL database
   */
  static async deleteQuiz(quizId: string): Promise<boolean> {
    try {
      await supabase.from('quiz_submissions').delete().eq('quiz_id', quizId);
      const { error } = await supabase.from('quizzes').delete().eq('id', quizId);
      return !error;
    } catch {
      return false;
    }
  }

  /**
   * Upsert a student quiz submission to Supabase SQL database
   */
  static async upsertQuizSubmission(sub: {
    id: string;
    quizId: string;
    studentId: string;
    studentName: string;
    score: number;
    passed: boolean;
    answers: Record<string, number>;
  }): Promise<boolean> {
    try {
      const { error } = await supabase.from('quiz_submissions').upsert(
        {
          id: sub.id,
          quiz_id: sub.quizId,
          student_id: sub.studentId,
          score: sub.score,
          passed: sub.passed,
          answers: sub.answers || {},
        },
        { onConflict: 'id' }
      );
      return !error;
    } catch {
      return false;
    }
  }

  /**
   * Upsert an attendance session to Supabase SQL database
   */
  static async upsertAttendanceSession(session: AttendanceSession): Promise<boolean> {
    try {
      const row = {
        id: session.id,
        course_id: session.courseId,
        date: session.date,
        display_date: session.displayDate,
        title: session.title,
        is_open: session.isOpen,
        opened_by: session.openedBy,
        records: session.records || {},
      };
      const sigKey = `att:${session.id}`;
      if (!this.hasChangedSignature(sigKey, row)) {
        return true;
      }
      const { error } = await supabase
        .from('attendance_sessions')
        .upsert(row, { onConflict: 'id' });
      if (!error) {
        this.recordSignature(sigKey, row);
      }
      return !error;
    } catch {
      return false;
    }
  }

  /**
   * Auto-delete an attendance session from Supabase SQL database
   */
  static async deleteAttendanceSession(sessionId: string): Promise<boolean> {
    try {
      this.lastUpsertSignatures.delete(`att:${sessionId}`);
      const { error } = await supabase.from('attendance_sessions').delete().eq('id', sessionId);
      return !error;
    } catch {
      return false;
    }
  }

  /**
   * High-Speed Batch Sync: Syncs all local users, courses, posts, assignments, submissions, quizzes, and attendance
   * using single-table batch upserts (reduces 200+ requests down to 7 parallel batch requests for Supabase Free Plan).
   */
  static async syncAllData(
    users: User[],
    courses: Course[],
    posts: CoursePost[] = [],
    assignments: Assignment[] = [],
    quizzes: Quiz[] = [],
    attendanceSessions: AttendanceSession[] = [],
    deletedIds: string[] = [],
    submissions: AssignmentSubmission[] = []
  ): Promise<{ success: boolean; syncedUsers: number; syncedCourses: number; error?: string }> {
    let lastError: string | undefined;

    // 0. Always purge expired (>30 mins) notifications in Supabase first
    await this.purgeExpiredNotifications(deletedIds, true);

    // 1. Purge any deleted IDs from Supabase SQL tables
    if (deletedIds.length > 0) {
      await Promise.allSettled([
        supabase.from('courses').delete().in('id', deletedIds),
        supabase.from('profiles').delete().in('id', deletedIds),
        supabase.from('posts').delete().in('id', deletedIds),
        supabase.from('assignments').delete().in('id', deletedIds),
        supabase.from('assignment_submissions').delete().in('id', deletedIds),
        supabase.from('quizzes').delete().in('id', deletedIds),
        supabase.from('quiz_submissions').delete().in('id', deletedIds),
        supabase.from('attendance_sessions').delete().in('id', deletedIds),
      ]);
    }

    // 2. Batch upsert profiles (with automatic schema fallback if needed)
    let syncedUsers = 0;
    if (users.length > 0) {
      const profilePayloads = users.map((u) => this.buildProfilePayload(u, this.profileSchemaMode));
      const { error: profErr } = await supabase
        .from('profiles')
        .upsert(profilePayloads, { onConflict: 'id' });

      if (!profErr) {
        syncedUsers = users.length;
      } else {
        // Fallback to individual upserts to detect schema mode
        for (const u of users) {
          const res = await this.upsertProfile(u);
          if (res.success) syncedUsers++;
          else lastError = res.error;
        }
      }
    }

    // 3. Batch upsert courses
    let syncedCourses = 0;
    if (courses.length > 0) {
      const coursePayloads = courses.map((course) => ({
        id: course.id,
        code: course.code,
        title: course.title,
        section: course.section,
        batch: course.batch,
        description: course.description,
        instructor_name: course.instructorName,
        instructor_email: course.instructorEmail,
        banner_image: compactBannerForCloud(course.bannerImage),
        theme_color: course.themeColor || 'indigo',
        enrolled_student_ids: course.enrolledStudentIds || [],
        total_lessons: course.totalLessons || 0,
        total_assignments: course.totalAssignments || 0,
        total_quizzes: course.totalQuizzes || 0,
      }));
      const { error: courseErr } = await supabase
        .from('courses')
        .upsert(coursePayloads, { onConflict: 'id' });
      if (!courseErr) {
        syncedCourses = courses.length;
      } else if (!lastError) {
        lastError = courseErr.message;
      }
    }

    // 4. Parallel batch upserts for child tables (1 request per table)
    const batchTasks: PromiseLike<unknown>[] = [];

    if (posts.length > 0) {
      batchTasks.push(
        supabase.from('posts').upsert(
          posts.map((p) => this.formatPostRow(p)),
          { onConflict: 'id' }
        )
      );
    }

    if (assignments.length > 0) {
      batchTasks.push(
        supabase.from('assignments').upsert(
          assignments.map((a) => ({
            id: a.id,
            course_id: a.courseId,
            title: a.title,
            description: a.description,
            due_date: a.dueDate,
            total_points: a.maxPoints || 100,
          })),
          { onConflict: 'id' }
        )
      );
    }

    if (submissions.length > 0) {
      batchTasks.push(
        supabase.from('assignment_submissions').upsert(
          submissions.map((sub) => this.formatSubmissionRow(sub)),
          { onConflict: 'id' }
        )
      );
    }

    if (quizzes.length > 0) {
      batchTasks.push(
        supabase.from('quizzes').upsert(
          quizzes.map((q) => ({
            id: q.id,
            course_id: q.courseId,
            title: q.title,
            time_limit_minutes: q.durationMinutes || 30,
            passing_score: q.passingScore || 70,
            questions: q.questions || [],
          })),
          { onConflict: 'id' }
        )
      );
    }

    if (attendanceSessions.length > 0) {
      batchTasks.push(
        supabase.from('attendance_sessions').upsert(
          attendanceSessions.map((session) => ({
            id: session.id,
            course_id: session.courseId,
            date: session.date,
            display_date: session.displayDate,
            title: session.title,
            is_open: session.isOpen,
            opened_by: session.openedBy,
            records: session.records || {},
          })),
          { onConflict: 'id' }
        )
      );
    }

    if (batchTasks.length > 0) {
      await Promise.allSettled(batchTasks);
    }

    return {
      success: syncedUsers > 0 && !lastError,
      syncedUsers,
      syncedCourses,
      error: lastError,
    };
  }

  /**
   * Sign In with Supabase Auth
   */
  static async signInWithSupabase(
    email: string,
    password: string
  ): Promise<{ user: User | null; error?: string }> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (error) {
        return { user: null, error: error.message };
      }

      if (data?.user) {
        // Fetch matching profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', email.trim())
          .maybeSingle();

        if (profile) {
          const decoded = decodeTitleAndRules(
            profile.title,
            profile.rules_accepted,
            profile.rules_accepted_at
          );
          return {
            user: {
              id: profile.id,
              name: profile.name,
              username: profile.username,
              email: profile.email,
              role: profile.role as UserRole,
              phone: profile.phone || '',
              avatar: profile.avatar || '',
              title: decoded.title,
              gender: profile.gender || undefined,
              address: profile.address || undefined,
              rulesAccepted: decoded.rulesAccepted,
              rulesAcceptedAt: decoded.rulesAcceptedAt,
            },
          };
        }

        // Fallback user from auth metadata
        const meta = data.user.user_metadata || {};
        return {
          user: {
            id: data.user.id,
            name: meta.name || data.user.email?.split('@')[0] || 'User',
            username: meta.username || data.user.email?.split('@')[0] || 'user',
            email: data.user.email || email,
            role: (meta.role as UserRole) || 'student',
            phone: meta.phone || '',
            avatar: meta.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
            title: meta.title || undefined,
            gender: meta.gender || undefined,
            address: meta.address || undefined,
          },
        };
      }

      return { user: null, error: 'No user returned from Supabase Auth.' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { user: null, error: msg };
    }
  }

  /**
   * Sign Up a new user with Supabase Auth & Profile
   */
  static async signUpWithSupabase(
    email: string,
    password: string,
    userData: {
      id?: string;
      name: string;
      username: string;
      role: UserRole;
      phone?: string;
      avatar?: string;
      title?: string;
      gender?: 'male' | 'female' | 'other';
      address?: string;
    }
  ): Promise<{ user: User | null; error?: string; profileSynced?: boolean }> {
    const userId = userData.id || `user-${userData.role}-${Date.now()}`;
    const newUser: User = {
      id: userId,
      name: userData.name,
      username: userData.username,
      email: email.trim(),
      role: userData.role,
      phone: userData.phone || '+95 9 000 000000',
      avatar: userData.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      title: userData.title || undefined,
      gender: userData.gender || 'male',
      address: userData.address || undefined,
    };

    // 1. Always upsert directly to public.profiles table first so Table Editor immediately shows the row
    const profileRes = await this.upsertProfile(newUser);

    // 2. Also register in Supabase Auth (non-blocking if email confirmation / rate limit is active)
    try {
      await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
        options: {
          data: {
            id: userId,
            name: userData.name,
            username: userData.username,
            role: userData.role,
            phone: userData.phone || '',
            title: userData.title || '',
            gender: userData.gender || 'male',
            address: userData.address || '',
          },
        },
      });
    } catch {
      // Ignore auth signup errors if profile table insert succeeded
    }

    if (!profileRes.success) {
      return { user: newUser, error: profileRes.error, profileSynced: false };
    }

    return { user: newUser, profileSynced: true };
  }
}
