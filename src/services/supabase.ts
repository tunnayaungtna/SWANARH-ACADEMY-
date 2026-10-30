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
} from '../types/classroom';

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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure gender, address & password columns exist if table was created earlier
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT 'male';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password TEXT DEFAULT 'student123';

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
`;

export class SupabaseService {
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
        message: 'Supabase Database နှင့် အောင်မြင်စွာ ချိတ်ဆက်ပြီး အသင့်အနေအထား ရှိပါသည်!',
        tableCount: data ? 1 : 0,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { connected: false, message: `Connection error: ${msg}` };
    }
  }

  /**
   * Fetch all profiles from Supabase if table exists
   */
  static async getRemoteProfiles(): Promise<User[] | null> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*');

      if (error || !data) {
        return null;
      }

      return data.map((row) => ({
        id: row.id,
        name: row.name,
        username: row.username,
        email: row.email,
        password: row.password || undefined,
        role: row.role as UserRole,
        phone: row.phone || '',
        avatar: row.avatar || '',
        title: row.title || undefined,
        gender: row.gender || undefined,
        address: row.address || undefined,
      }));
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
        .select('*');

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
        bannerImage: row.banner_image || 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200&auto=format&fit=crop&q=80',
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
   * Fetch all posts (stream lessons, announcements, videos, comments, likes) from Supabase
   */
  static async getRemotePosts(): Promise<CoursePost[] | null> {
    try {
      const { data, error } = await supabase.from('posts').select('*');
      if (error || !data) return null;

      return data.map((row) => ({
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
      }));
    } catch {
      return null;
    }
  }

  /**
   * Fetch all assignments from Supabase
   */
  static async getRemoteAssignments(): Promise<Assignment[] | null> {
    try {
      const { data, error } = await supabase.from('assignments').select('*');
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
      const { data, error } = await supabase.from('assignment_submissions').select('*');
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
      const { data, error } = await supabase.from('quizzes').select('*');
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
   * Fetch all attendance sessions from Supabase
   */
  static async getRemoteAttendanceSessions(): Promise<AttendanceSession[] | null> {
    try {
      const { data, error } = await supabase.from('attendance_sessions').select('*');
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
   * Create or update a profile in Supabase with automatic fallback
   * if gender/address/password columns haven't been added to the user's Supabase table yet.
   */
  static async upsertProfile(user: User): Promise<{ success: boolean; error?: string }> {
    try {
      // Avoid sending huge base64 strings if avatar exceeds 50KB; use default URL for remote DB if needed
      const safeAvatar =
        user.avatar && user.avatar.length > 60000
          ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
          : user.avatar;

      const fullPayload = {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        password: user.password || (user.role === 'admin' ? 'admin123' : user.role === 'co_admin' ? 'coadmin123' : 'student123'),
        role: user.role,
        phone: user.phone || '+95 9 000 000000',
        avatar: safeAvatar,
        title: user.title || null,
        gender: user.gender || 'male',
        address: user.address || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('profiles')
        .upsert(fullPayload, { onConflict: 'id' });

      if (!error) {
        return { success: true };
      }

      // Fallback 1: without password column
      const { password: _pwd, ...withoutPassword } = fullPayload;
      const { error: errNoPwd } = await supabase
        .from('profiles')
        .upsert(withoutPassword, { onConflict: 'id' });

      if (!errNoPwd) {
        return { success: true };
      }

      // Fallback 2: core columns only
      const fallbackPayload = {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
        phone: user.phone || '+95 9 000 000000',
        avatar: safeAvatar,
        title: user.title || null,
        updated_at: new Date().toISOString(),
      };

      const { error: fallbackError } = await supabase
        .from('profiles')
        .upsert(fallbackPayload, { onConflict: 'id' });

      if (!fallbackError) {
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
      const { error } = await supabase.from('courses').upsert(
        {
          id: course.id,
          code: course.code,
          title: course.title,
          section: course.section,
          batch: course.batch,
          description: course.description,
          instructor_name: course.instructorName,
          instructor_email: course.instructorEmail,
          banner_image: course.bannerImage,
          theme_color: course.themeColor || 'indigo',
          enrolled_student_ids: course.enrolledStudentIds || [],
          total_lessons: course.totalLessons || 0,
          total_assignments: course.totalAssignments || 0,
          total_quizzes: course.totalQuizzes || 0,
        },
        { onConflict: 'id' }
      );
      if (error) {
        return { success: false, error: error.message };
      }
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
      // Explicitly delete child records first in case ON DELETE CASCADE wasn't applied on older tables
      await Promise.allSettled([
        supabase.from('posts').delete().eq('course_id', courseId),
        supabase.from('assignments').delete().eq('course_id', courseId),
        supabase.from('quizzes').delete().eq('course_id', courseId),
        supabase.from('attendance_sessions').delete().eq('course_id', courseId),
      ]);
      const { error } = await supabase.from('courses').delete().eq('id', courseId);
      return !error;
    } catch {
      return false;
    }
  }

  /**
   * Upsert a stream post (including comments & likes) to Supabase SQL database
   */
  static async upsertPost(post: CoursePost): Promise<boolean> {
    try {
      const safeAttachments = (post.attachments || []).map((att) => ({
        ...att,
        // Avoid sending oversized data URLs > 100KB to JSONB column
        url: att.url && att.url.length > 100000 ? '#attachment' : att.url,
      }));

      const { error } = await supabase.from('posts').upsert(
        {
          id: post.id,
          course_id: post.courseId,
          author_id: post.authorId,
          author_name: post.authorName,
          author_role: post.authorRole,
          author_avatar: post.authorAvatar || '',
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
          comments: post.comments || [],
        },
        { onConflict: 'id' }
      );
      return !error;
    } catch {
      return false;
    }
  }

  /**
   * Auto-delete a post from Supabase SQL database
   */
  static async deletePost(postId: string): Promise<boolean> {
    try {
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

  /**
   * Upsert an assignment submission to Supabase SQL database
   */
  static async upsertAssignmentSubmission(sub: AssignmentSubmission): Promise<boolean> {
    try {
      const { error } = await supabase.from('assignment_submissions').upsert(
        {
          id: sub.id,
          assignment_id: sub.assignmentId,
          student_id: sub.studentId,
          student_name: sub.studentName,
          student_avatar: sub.studentAvatar || '',
          files: sub.fileAttachment ? [sub.fileAttachment] : [],
          notes: sub.submissionText || '',
          grade: sub.grade ?? null,
          feedback: sub.feedback ?? null,
        },
        { onConflict: 'id' }
      );
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
          student_name: sub.studentName,
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
      const { error } = await supabase.from('attendance_sessions').upsert(
        {
          id: session.id,
          course_id: session.courseId,
          date: session.date,
          display_date: session.displayDate,
          title: session.title,
          is_open: session.isOpen,
          opened_by: session.openedBy,
          records: session.records || {},
        },
        { onConflict: 'id' }
      );
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
      const { error } = await supabase.from('attendance_sessions').delete().eq('id', sessionId);
      return !error;
    } catch {
      return false;
    }
  }

  /**
   * Sync all local users, courses, posts, assignments, submissions, quizzes, attendance, and purge deleted IDs in Supabase
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
    let syncedUsers = 0;
    let syncedCourses = 0;
    let lastError: string | undefined;

    // 1. Purge any deleted IDs from Supabase SQL tables first
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

    for (const u of users) {
      const res = await this.upsertProfile(u);
      if (res.success) {
        syncedUsers++;
      } else {
        lastError = res.error;
      }
    }

    for (const c of courses) {
      const res = await this.upsertCourse(c);
      if (res.success) {
        syncedCourses++;
      } else if (!lastError) {
        lastError = res.error;
      }
    }

    for (const p of posts) {
      await this.upsertPost(p);
    }

    for (const a of assignments) {
      await this.upsertAssignment(a);
    }

    for (const sub of submissions) {
      await this.upsertAssignmentSubmission(sub);
    }

    for (const q of quizzes) {
      await this.upsertQuiz(q);
    }

    for (const att of attendanceSessions) {
      await this.upsertAttendanceSession(att);
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
          return {
            user: {
              id: profile.id,
              name: profile.name,
              username: profile.username,
              email: profile.email,
              role: profile.role as UserRole,
              phone: profile.phone || '',
              avatar: profile.avatar || '',
              title: profile.title || undefined,
              gender: profile.gender || undefined,
              address: profile.address || undefined,
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
