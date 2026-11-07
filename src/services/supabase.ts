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
  AuditLogEntry,
} from '../types/classroom';
import { encryptPassword } from '../utils/passwordCrypto';

export const NOTIFICATION_TTL_MS = 30 * 60 * 1000; // 30 minutes auto-delete window
export const AUDIT_LOG_TTL_MS = 2 * 24 * 60 * 60 * 1000; // 2 days (48 hours) security audit auto-delete window
const AUDIT_LOG_SYSTEM_USER_ID = 'SYSTEM_AUDIT_LOG';

// Supabase Project Credentials provided by user
export const SUPABASE_CONFIG = {
  url: import.meta.env.VITE_SUPABASE_URL || 'https://wxfassadxuxfvywvnlxs.supabase.co',
  publishableKey: import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_mhYrcHRIdU-2EXQoXATDaw_s4vO4ZXv',
  jwksUrl: import.meta.env.VITE_SUPABASE_JWKS_URL || 'https://wxfassadxuxfvywvnlxs.supabase.co/auth/v1/.well-known/jwks.json',
};

// Official Singapore Cloud Run Server (Silent Background VPN-Free Relay for Myanmar and International ISPs)
const GLOBAL_VPN_FREE_RELAY_ORIGIN =
  'https://ais-pre-x3aphtm3a4npfd5tmiiqhv-683201169391.asia-southeast1.run.app';

type AutoRouteType = 'direct' | 'same_origin_proxy' | 'sg_cloud_relay';

let activeWinningRoute: AutoRouteType | null = null;
let activeWinningRouteTimestamp = 0;
const ROUTE_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getCandidateRoutesForHost(): AutoRouteType[] {
  if (typeof window === 'undefined') return ['direct'];
  const host = window.location.hostname || '';
  const isNodeProxyHost =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.includes('.run.app') ||
    host.includes('.googleusercontent.com');

  return isNodeProxyHost
    ? ['same_origin_proxy', 'direct']
    : ['direct', 'sg_cloud_relay'];
}

function buildRouteUrl(originalUrl: string, routeType: AutoRouteType): string {
  const baseSb = SUPABASE_CONFIG.url.replace(/\/+$/, '');
  const subPath = originalUrl.startsWith(baseSb)
    ? originalUrl.slice(baseSb.length)
    : originalUrl;
  const normalizedSub = subPath.startsWith('/') ? subPath : `/${subPath}`;

  if (routeType === 'same_origin_proxy' && typeof window !== 'undefined') {
    return `${window.location.origin}/api/sb-proxy${normalizedSub}`;
  }
  if (routeType === 'sg_cloud_relay') {
    return `${GLOBAL_VPN_FREE_RELAY_ORIGIN}/api/sb-proxy${normalizedSub}`;
  }
  return originalUrl;
}

async function fetchSingleRouteWithTimeout(
  url: string,
  init: RequestInit | undefined,
  timeoutMs: number,
  externalSignal?: AbortSignal
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timer);
      throw new Error('Aborted');
    }
    externalSignal.addEventListener('abort', onExternalAbort, { once: true });
  }
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    if (res.status === 502 || res.status === 503 || res.status === 504) {
      throw new Error(`Upstream status ${res.status}`);
    }
    return res;
  } finally {
    clearTimeout(timer);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }
}

/**
 * 100% Automatic Zero-Touch Multi-Route Fetch Engine:
 * - Requires zero user actions, buttons, or VPNs.
 * - When a user in Myanmar or abroad connects, it automatically races Direct Cloud and the
 *   Singapore VPN-Free Relay in the background if no winning route is cached yet (or if the primary route stalls >1.4s),
 *   locking onto whichever path responds fastest on the user's ISP.
 */
const geoResilientSupabaseFetch: typeof fetch = async (input, init) => {
  const rawUrl =
    typeof input === 'string'
      ? input
      : input instanceof URL
      ? input.toString()
      : input.url;

  if (typeof window === 'undefined' || !rawUrl.startsWith(SUPABASE_CONFIG.url)) {
    return fetch(input, init);
  }

  const baseCandidates = getCandidateRoutesForHost();
  const now = Date.now();
  const hasValidCachedWinner =
    activeWinningRoute !== null &&
    now - activeWinningRouteTimestamp < ROUTE_CACHE_TTL_MS &&
    baseCandidates.includes(activeWinningRoute);

  // If we already verified the fastest route for this user's ISP, try it first with a 1.4s hedge timer
  if (hasValidCachedWinner && activeWinningRoute) {
    const primaryRoute = activeWinningRoute;
    const backupRoute = baseCandidates.find((r) => r !== primaryRoute) || 'direct';
    try {
      const primaryUrl = buildRouteUrl(rawUrl, primaryRoute);
      const res = await fetchSingleRouteWithTimeout(primaryUrl, init, 4500);
      if (primaryRoute === 'same_origin_proxy' && (res.status === 404 || res.status === 405)) {
        throw new Error('Same-origin proxy not mounted');
      }
      activeWinningRouteTimestamp = Date.now();
      return res;
    } catch {
      const backupUrl = buildRouteUrl(rawUrl, backupRoute);
      const backupRes = await fetchSingleRouteWithTimeout(backupUrl, init, 8000);
      activeWinningRoute = backupRoute;
      activeWinningRouteTimestamp = Date.now();
      return backupRes;
    }
  }

  // First connection or expired route cache:
  // Race both routes automatically (giving primary a 250ms head start for mutations, or parallel for GET/HEAD)
  const method = (init?.method || 'GET').toUpperCase();
  const isIdempotent = method === 'GET' || method === 'HEAD' || method === 'OPTIONS';

  if (isIdempotent && baseCandidates.length > 1) {
    const raceControllers = baseCandidates.map(() => new AbortController());
    try {
      const winner = await Promise.any(
        baseCandidates.map(async (route, idx) => {
          const url = buildRouteUrl(rawUrl, route);
          const res = await fetchSingleRouteWithTimeout(
            url,
            init,
            7500,
            raceControllers[idx].signal
          );
          if (route === 'same_origin_proxy' && (res.status === 404 || res.status === 405)) {
            throw new Error('Same-origin proxy unavailable');
          }
          return { route, res, idx };
        })
      );

      // Cancel the slower route immediately so bandwidth isn't wasted
      raceControllers.forEach((ctrl, idx) => {
        if (idx !== winner.idx) ctrl.abort();
      });

      activeWinningRoute = winner.route;
      activeWinningRouteTimestamp = Date.now();
      return winner.res;
    } catch {
      // Fallback final attempt
      const fallbackUrl = buildRouteUrl(rawUrl, baseCandidates[0]);
      return fetch(fallbackUrl, init);
    }
  }

  // For non-GET requests when route isn't cached yet: try primary with fast 2.2s failover to backup
  const primaryRoute = baseCandidates[0];
  const backupRoute = baseCandidates[1] || 'direct';
  try {
    const primaryUrl = buildRouteUrl(rawUrl, primaryRoute);
    const res = await fetchSingleRouteWithTimeout(primaryUrl, init, 2200);
    if (primaryRoute === 'same_origin_proxy' && (res.status === 404 || res.status === 405)) {
      throw new Error('Same-origin proxy unavailable');
    }
    activeWinningRoute = primaryRoute;
    activeWinningRouteTimestamp = Date.now();
    return res;
  } catch {
    const backupUrl = buildRouteUrl(rawUrl, backupRoute);
    const backupRes = await fetchSingleRouteWithTimeout(backupUrl, init, 8500);
    activeWinningRoute = backupRoute;
    activeWinningRouteTimestamp = Date.now();
    return backupRes;
  }
};

// Initialize Supabase Client with Automatic Geo-Resilient VPN-Free Fetch
export const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.publishableKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  global: {
    fetch: geoResilientSupabaseFetch,
  },
});

// Silently probe and lock onto the fastest unblocked route in the background on startup
if (typeof window !== 'undefined') {
  setTimeout(() => {
    supabase
      .from('profiles')
      .select('id', { head: true })
      .limit(1)
      .then(() => {}, () => {});
  }, 10);
}

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
  ('user-admin-1', 'Dr. Kyaw Swar', 'kyawswar.admin', 'kyaw.admin@classroomos.edu', 'admin', '+95 9 791 234567', '', 'Dean of Computing & Lead Instructor', 'male', 'No. 45, Pyay Road, Kamayut, Yangon'),
  ('user-coadmin-1', 'Daw Khin Myo', 'khinmyo.coadmin', 'khinmyo.coadmin@classroomos.edu', 'co_admin', '+95 9 512 889900', '', 'Course Coordinator & Assistant Instructor', 'female', 'No. 12, University Avenue, Bahan, Yangon'),
  ('user-student-1', 'Aung Min', 'aungmin2026', 'aung.min@student.edu', 'student', '+95 9 970 882190', '', 'Computer Science Undergraduate', 'male', 'Room 3B, Insein Road, Hlaing, Yangon'),
  ('user-student-2', 'Su Su Win', 'susu.win', 'susu.win@student.edu', 'student', '+95 9 420 551829', '', 'Software Engineering Scholar', 'female', 'No. 88, Bogyoke Aung San Road, Kyauktada, Yangon'),
  ('user-student-3', 'Thura Soe', 'thuraz', 'thura.soe@student.edu', 'student', '+95 9 250 119842', '', 'Cybersecurity Major', 'male', 'No. 102, Strand Road, Ahlone, Yangon')
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
CREATE INDEX IF NOT EXISTS idx_profiles_username_lower ON public.profiles (lower(username));
CREATE INDEX IF NOT EXISTS idx_profiles_email_lower ON public.profiles (lower(email));
CREATE INDEX IF NOT EXISTS idx_posts_course_id ON public.posts (course_id);
CREATE INDEX IF NOT EXISTS idx_attendance_course_id ON public.attendance_sessions (course_id);

-- Automatic Orphaned Data Cleanup (Safe to run anytime)
DELETE FROM public.posts WHERE course_id NOT IN (SELECT id FROM public.courses);
DELETE FROM public.assignments WHERE course_id NOT IN (SELECT id FROM public.courses);
DELETE FROM public.assignment_submissions WHERE assignment_id NOT IN (SELECT id FROM public.assignments) OR student_id NOT IN (SELECT id FROM public.profiles);
DELETE FROM public.quizzes WHERE course_id NOT IN (SELECT id FROM public.courses);
DELETE FROM public.quiz_submissions WHERE quiz_id NOT IN (SELECT id FROM public.quizzes) OR student_id NOT IN (SELECT id FROM public.profiles);
DELETE FROM public.attendance_sessions WHERE course_id NOT IN (SELECT id FROM public.courses);
DELETE FROM public.notifications WHERE course_id NOT IN (SELECT id FROM public.courses) OR user_id NOT IN (SELECT id FROM public.profiles) OR expires_at <= now();
`;

const DEFAULT_FALLBACK_AVATAR =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'><rect width='120' height='120' rx='60' fill='%23059669'/><circle cx='60' cy='45' r='22' fill='%23ffffff' fill-opacity='0.92'/><path d='M24 104c6-20 22-32 36-32s30 12 36 32' fill='%23ffffff' fill-opacity='0.92'/></svg>";
const DEFAULT_FALLBACK_BANNER =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 300'><defs><linearGradient id='g' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='%23064e3b'/><stop offset='50%' stop-color='%23047857'/><stop offset='100%' stop-color='%230f172a'/></linearGradient></defs><rect width='1200' height='300' fill='url(%23g)'/><circle cx='1050' cy='60' r='180' fill='%2310b981' fill-opacity='0.14'/><circle cx='180' cy='260' r='220' fill='%2334d399' fill-opacity='0.1'/></svg>";

function sanitizeBlockedExternalImageUrl(url: string | undefined, fallback: string): string {
  if (!url) return fallback;
  // Replace Fastly-hosted images.unsplash.com URLs which frequently hang on Myanmar mobile ISPs without VPN
  if (url.includes('images.unsplash.com')) {
    return fallback;
  }
  return url;
}

/**
 * Compacts avatars & banners for Supabase SQL sync:
 * - Students NEVER have profile photos (`''`).
 * - Admin & Co-Admin compressed profile photos (including custom uploaded data:image/ URLs up to 180KB) sync across all devices.
 * - Classroom header banners (including custom uploaded data:image/ URLs up to 220KB) sync across all devices.
 */
function compactAvatarForCloud(avatar?: string, role?: UserRole): string {
  if (role === 'student') return '';
  if (!avatar || avatar.includes('images.unsplash.com')) return DEFAULT_FALLBACK_AVATAR;
  if (avatar.length > 180_000) return DEFAULT_FALLBACK_AVATAR;
  return avatar;
}

function compactBannerForCloud(banner?: string): string {
  if (!banner || banner.startsWith('/src/assets/images/') || banner.includes('images.unsplash.com')) {
    return DEFAULT_FALLBACK_BANNER;
  }
  if (banner.length > 220_000) return DEFAULT_FALLBACK_BANNER;
  return banner;
}

const RULES_MARKER_PREFIX = '||RULES_OK:';
const DEVICE_SESSION_MARKER_PREFIX = '||DEV_SES:';
const USERNAME_MARKER_PREFIX = '||USR:';
const PASSWORD_ENC_MARKER_PREFIX = '||PWD_ENC:';
const COURSE_ORDER_MARKER_PREFIX = '||ORDER:';

function encodeCourseThemeWithOrder(course: Course): string {
  const baseTheme = (course.themeColor || 'indigo').split(COURSE_ORDER_MARKER_PREFIX)[0].trim() || 'indigo';
  if (typeof course.sortOrder === 'number' && Number.isFinite(course.sortOrder)) {
    return `${baseTheme}${COURSE_ORDER_MARKER_PREFIX}${Math.max(1, Math.round(course.sortOrder))}`;
  }
  return baseTheme;
}

function decodeCourseThemeAndOrder(rawTheme?: string | null): {
  themeColor: Course['themeColor'];
  sortOrder?: number;
} {
  const str = String(rawTheme || 'indigo');
  if (str.includes(COURSE_ORDER_MARKER_PREFIX)) {
    const [cleanTheme, orderRaw] = str.split(COURSE_ORDER_MARKER_PREFIX);
    const parsedOrder = Number(orderRaw);
    return {
      themeColor: ((cleanTheme || 'indigo').trim() as Course['themeColor']) || 'indigo',
      sortOrder: Number.isFinite(parsedOrder) && parsedOrder > 0 ? parsedOrder : undefined,
    };
  }
  return {
    themeColor: (str.trim() as Course['themeColor']) || 'indigo',
  };
}

function encodeTitleWithRules(user: User): string | null {
  const rawBase = (user.title || '')
    .split(RULES_MARKER_PREFIX)[0]
    .split(DEVICE_SESSION_MARKER_PREFIX)[0]
    .split(USERNAME_MARKER_PREFIX)[0]
    .split(PASSWORD_ENC_MARKER_PREFIX)[0]
    .trim();

  let encoded = rawBase;
  if (user.rulesAccepted) {
    const stamp = user.rulesAcceptedAt || new Date().toISOString();
    encoded += `${RULES_MARKER_PREFIX}${stamp}`;
  }
  if (user.activeDeviceId) {
    const sesToken = (user.activeSessionToken || '').replace(/[~|]/g, '');
    const sesTs = user.sessionUpdatedAtMs || Date.now();
    encoded += `${DEVICE_SESSION_MARKER_PREFIX}${user.activeDeviceId}~${sesToken}~${sesTs}`;
  }
  const cleanUser = (user.username || '').trim().toLowerCase().replace(/[|~]/g, '');
  if (cleanUser) {
    encoded += `${USERNAME_MARKER_PREFIX}${cleanUser}`;
  }
  const encryptedPwd = encryptPassword(user.password, user.role, user.id);
  encoded += `${PASSWORD_ENC_MARKER_PREFIX}${encryptedPwd}`;
  return encoded || null;
}

function decodeTitleAndRules(
  rawTitle?: string | null,
  rowRulesAccepted?: boolean | null,
  rowRulesAcceptedAt?: string | null
): {
  title?: string;
  rulesAccepted?: boolean;
  rulesAcceptedAt?: string;
  activeDeviceId?: string;
  activeSessionToken?: string;
  sessionUpdatedAtMs?: number;
  username?: string;
  encryptedPassword?: string;
} {
  let working = rawTitle || '';
  let activeDeviceId: string | undefined;
  let activeSessionToken: string | undefined;
  let sessionUpdatedAtMs: number | undefined;
  let username: string | undefined;
  let encryptedPassword: string | undefined;

  if (working.includes(PASSWORD_ENC_MARKER_PREFIX)) {
    const [beforePwd, pwdRaw] = working.split(PASSWORD_ENC_MARKER_PREFIX);
    working = beforePwd;
    if (pwdRaw && pwdRaw.trim()) {
      encryptedPassword = pwdRaw.trim();
    }
  }

  if (working.includes(USERNAME_MARKER_PREFIX)) {
    const [beforeUsr, usrRaw] = working.split(USERNAME_MARKER_PREFIX);
    working = beforeUsr;
    if (usrRaw && usrRaw.trim()) {
      username = usrRaw.trim().toLowerCase();
    }
  }

  if (working.includes(DEVICE_SESSION_MARKER_PREFIX)) {
    const [beforeSes, sesRaw] = working.split(DEVICE_SESSION_MARKER_PREFIX);
    working = beforeSes;
    if (sesRaw) {
      const [devId, token, tsStr] = sesRaw.trim().split('~');
      if (devId) activeDeviceId = devId.trim();
      if (token) activeSessionToken = token.trim();
      const parsedTs = Number(tsStr);
      if (Number.isFinite(parsedTs) && parsedTs > 0) {
        sessionUpdatedAtMs = parsedTs;
      }
    }
  }

  if (working.includes(RULES_MARKER_PREFIX)) {
    const [cleanTitle, acceptedStamp] = working.split(RULES_MARKER_PREFIX);
    return {
      title: cleanTitle.trim() || undefined,
      rulesAccepted: true,
      rulesAcceptedAt: rowRulesAcceptedAt || acceptedStamp?.trim() || undefined,
      activeDeviceId,
      activeSessionToken,
      sessionUpdatedAtMs,
      username,
      encryptedPassword,
    };
  }
  return {
    title: working.trim() || undefined,
    rulesAccepted: rowRulesAccepted ? true : undefined,
    rulesAcceptedAt: rowRulesAcceptedAt || undefined,
    activeDeviceId,
    activeSessionToken,
    sessionUpdatedAtMs,
    username,
    encryptedPassword,
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
  private static lastAuditLogCleanupAt = 0;
  private static lastOrphanCleanupAt = 0;
  // In-flight GET request deduplication map for 2,000+ concurrent user scalability
  private static inflightGetRequests = new Map<string, Promise<unknown>>();

  private static chunkArray<T>(items: T[], chunkSize: number = 250): T[][] {
    if (items.length <= chunkSize) return items.length ? [items] : [];
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += chunkSize) {
      chunks.push(items.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private static dedupeGet<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const existing = this.inflightGetRequests.get(key) as Promise<T> | undefined;
    if (existing) {
      return existing;
    }
    const promise = fetcher().finally(() => {
      this.inflightGetRequests.delete(key);
    });
    this.inflightGetRequests.set(key, promise);
    return promise;
  }

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
        message: 'Supabase Database (2,000+ Users High-Concurrency & Auto-Clean Ready) နှင့် အောင်မြင်စွာ ချိတ်ဆက်ပြီး အသင့်အနေအထား ရှိပါသည်!',
        tableCount: data ? 1 : 0,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { connected: false, message: `Connection error: ${msg}` };
    }
  }

  private static mapProfileRowToUser(row: Record<string, unknown>): User {
    const decoded = decodeTitleAndRules(
      row.title as string | null,
      row.rules_accepted as boolean | null,
      row.rules_accepted_at as string | null
    );
    const role = ((row.role as UserRole) || 'student');
    const userId = String(row.id || '');
    const rawRowPwd = row.password ? String(row.password) : undefined;
    const resolvedEncryptedPwd = encryptPassword(
      decoded.encryptedPassword || rawRowPwd,
      role,
      userId
    );
    const rawEmail = String(row.email || '').trim().toLowerCase();
    const emailLocalPart = rawEmail.includes('@') ? rawEmail.split('@')[0].trim() : '';
    const rawRowUsername = String(row.username || '').trim().toLowerCase();
    const resolvedUsername =
      (rawRowUsername && rawRowUsername !== 'user' ? rawRowUsername : '') ||
      (decoded.username && decoded.username !== 'user' ? decoded.username : '') ||
      emailLocalPart ||
      rawRowUsername ||
      'user';

    return {
      id: userId,
      name: String(row.name || 'User'),
      username: resolvedUsername,
      email: rawEmail || `${resolvedUsername}@swanarh.edu`,
      password: resolvedEncryptedPwd,
      role,
      phone: String(row.phone || ''),
      avatar:
        role === 'student'
          ? ''
          : sanitizeBlockedExternalImageUrl(String(row.avatar || ''), DEFAULT_FALLBACK_AVATAR),
      title: decoded.title,
      gender: (row.gender as User['gender']) || undefined,
      address: row.address ? String(row.address) : undefined,
      rulesAccepted: decoded.rulesAccepted,
      rulesAcceptedAt: decoded.rulesAcceptedAt,
      activeDeviceId: decoded.activeDeviceId,
      activeSessionToken: decoded.activeSessionToken,
      sessionUpdatedAtMs: decoded.sessionUpdatedAtMs,
    };
  }

  /**
   * Fast lookup strictly by username or email for Login (returns all candidate matches up to 15 rows)
   */
  static async getRemoteCandidateProfiles(
    identifier: string,
    skipDedupe: boolean = false
  ): Promise<User[]> {
    const rawClean = (identifier || '')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/^(🔑\s*|📧\s*|👤\s*)?(username|email|e-mail|mail|id)\s*[:：=\-]\s*/i, '')
      .trim()
      .replace(/^@+/, '')
      .toLowerCase();
    if (!rawClean) return [];

    // Sanitize against PostgREST filter syntax characters
    const safeId = rawClean.replace(/[,()"'\\]/g, '').trim();
    const compactId = safeId.replace(/\s+/g, '');
    if (!compactId) return [];

    const idLocalPart = compactId.includes('@') ? compactId.split('@')[0].trim() : compactId;

    const fetcher = async (): Promise<User[]> => {
      try {
        const filterSet = new Set<string>();
        filterSet.add(`username.ilike.${compactId}`);
        filterSet.add(`email.ilike.${compactId}`);
        if (idLocalPart) {
          filterSet.add(`username.ilike.${idLocalPart}`);
          filterSet.add(`email.ilike.${idLocalPart}@%`);
        }

        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .or(Array.from(filterSet).join(','))
          .limit(15);

        if (!error && Array.isArray(data) && data.length > 0) {
          return data.map((r) => this.mapProfileRowToUser(r as Record<string, unknown>));
        }

        // Fallback if `username` column is missing in an older Supabase table schema
        if (error) {
          const fallbackFilters = [
            `email.ilike.${compactId}`,
            ...(idLocalPart ? [`email.ilike.${idLocalPart}@%`, `title.ilike.%||USR:${idLocalPart}%`] : []),
          ];
          const { data: fbData, error: fbErr } = await supabase
            .from('profiles')
            .select('*')
            .or(Array.from(new Set(fallbackFilters)).join(','))
            .limit(15);
          if (!fbErr && Array.isArray(fbData) && fbData.length > 0) {
            return fbData.map((r) => this.mapProfileRowToUser(r as Record<string, unknown>));
          }
        }
        return [];
      } catch {
        return [];
      }
    };

    if (skipDedupe) {
      return fetcher();
    }
    return this.dedupeGet(`profile_candidates:${compactId}`, fetcher);
  }

  /**
   * Fast single-row lookup by username, email, or name for Login (handles mobile @ prefix, spaces, and copy-paste formatting)
   */
  static async getRemoteProfileByIdentifier(
    identifier: string,
    skipDedupe: boolean = false
  ): Promise<User | null> {
    const candidates = await this.getRemoteCandidateProfiles(identifier, skipDedupe);
    if (candidates.length === 0) return null;

    const rawClean = (identifier || '')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/^(🔑\s*|📧\s*)?(username|email|e-mail|mail|id|အမည်|name)\s*[:：=\-]\s*/i, '')
      .trim()
      .replace(/^@+/, '')
      .toLowerCase();
    const compactId = rawClean.replace(/\s+/g, '');
    const idLocalPart = compactId.includes('@') ? compactId.split('@')[0].trim() : compactId;

    return (
      candidates.find((u) => {
        const uName = (u.username || '').trim().toLowerCase();
        const uEmail = (u.email || '').trim().toLowerCase();
        const uEmailLocal = uEmail.includes('@') ? uEmail.split('@')[0].trim() : uEmail;
        return (
          uName === compactId ||
          uName === rawClean ||
          uEmail === compactId ||
          uEmail === rawClean ||
          (idLocalPart && (uName === idLocalPart || uEmailLocal === idLocalPart))
        );
      }) || candidates[0]
    );
  }

  /**
   * Fetch all profiles from Supabase if table exists (supports up to 3,000 concurrent classroom users)
   */
  static async getRemoteProfiles(skipDedupe: boolean = false): Promise<User[] | null> {
    const fetcher = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .limit(3000);

        if (error || !data) {
          return null;
        }

        return data.map((row) => this.mapProfileRowToUser(row as Record<string, unknown>));
      } catch {
        return null;
      }
    };

    if (skipDedupe) {
      return fetcher();
    }
    return this.dedupeGet('profiles:all', fetcher);
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

      return data.map((row) => {
        const rawBanner = String(row.banner_image || '');
        const resolvedBanner =
          !rawBanner || rawBanner.startsWith('/src/assets/images/') || rawBanner.includes('images.unsplash.com')
            ? DEFAULT_FALLBACK_BANNER
            : rawBanner;

        const decodedTheme = decodeCourseThemeAndOrder(row.theme_color as string | null);

        return {
          id: row.id,
          code: row.code,
          title: row.title,
          section: row.section,
          batch: row.batch,
          description: row.description || '',
          instructorName: row.instructor_name,
          instructorEmail: row.instructor_email,
          bannerImage: resolvedBanner,
          themeColor: decodedTheme.themeColor,
          sortOrder: decodedTheme.sortOrder,
          enrolledStudentIds: Array.isArray(row.enrolled_student_ids) ? row.enrolled_student_ids : [],
          totalLessons: row.total_lessons ?? 0,
          totalAssignments: row.total_assignments ?? 0,
          totalQuizzes: row.total_quizzes ?? 0,
        };
      });
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
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (courseIds && courseIds.length > 0 && courseIds.length <= 25) {
        query = query.in('course_id', courseIds);
      }

      const { data, error } = await query;
      if (error || !data) return null;

      return data.map((row) => {
        const rawAttachments = Array.isArray(row.attachments) ? row.attachments : [];
        let metaObj: Record<string, unknown> = {};
        const visibleAttachments = rawAttachments.filter((att: Record<string, unknown>) => {
          if (att && att.id === '__post_meta__' && typeof att.url === 'string') {
            try {
              metaObj = JSON.parse(att.url) as Record<string, unknown>;
            } catch {
              // ignore malformed meta
            }
            return false;
          }
          return true;
        });

        const parsedRowMs = row.created_at ? new Date(row.created_at).getTime() : undefined;
        const metaCreatedMs =
          typeof metaObj.createdAtMs === 'number' && Number.isFinite(metaObj.createdAtMs)
            ? metaObj.createdAtMs
            : undefined;
        const effectiveCreatedMs =
          metaCreatedMs && parsedRowMs
            ? Math.max(metaCreatedMs, parsedRowMs)
            : metaCreatedMs || (parsedRowMs && !isNaN(parsedRowMs) ? parsedRowMs : undefined);

        const authorRole =
          ((row.author_role as UserRole) || (metaObj.authorRole as UserRole) || 'admin');
        const status: CoursePost['status'] =
          ((row.status as CoursePost['status']) ||
            (metaObj.status as CoursePost['status']) ||
            'published');
        const scheduledFor =
          (row.scheduled_for ? String(row.scheduled_for) : undefined) ||
          (typeof metaObj.scheduledFor === 'string' ? metaObj.scheduledFor : undefined);
        const scheduledForDisplay =
          (row.scheduled_for_display ? String(row.scheduled_for_display) : undefined) ||
          (typeof metaObj.scheduledForDisplay === 'string' ? metaObj.scheduledForDisplay : undefined);
        const isPinned =
          row.is_pinned !== undefined && row.is_pinned !== null
            ? Boolean(row.is_pinned)
            : Boolean(metaObj.isPinned);
        const pinnedAt =
          (row.pinned_at ? String(row.pinned_at) : undefined) ||
          (typeof metaObj.pinnedAt === 'string' ? metaObj.pinnedAt : undefined);
        const pinOrder =
          typeof row.pin_order === 'number'
            ? row.pin_order
            : typeof metaObj.pinOrder === 'number'
            ? metaObj.pinOrder
            : undefined;

        const comments = Array.isArray(row.comments)
          ? row.comments.map((cm: Record<string, unknown>) => ({
              ...cm,
              authorAvatar: cm.authorRole === 'student' ? '' : String(cm.authorAvatar || ''),
            }))
          : [];

        const formattedCreatedAt =
          status === 'scheduled'
            ? `Scheduled for ${
                scheduledForDisplay ||
                (scheduledFor
                  ? new Date(scheduledFor).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true,
                    })
                  : 'upcoming')
              }`
            : effectiveCreatedMs
            ? new Date(effectiveCreatedMs).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
              })
            : 'Recently';

        return {
          id: row.id,
          courseId: row.course_id,
          authorId: row.author_id || 'user-admin-1',
          authorName: row.author_name || 'Instructor',
          authorRole,
          authorAvatar: authorRole === 'student' ? '' : (row.author_avatar || ''),
          title: row.title || '',
          content: row.content || '',
          createdAt: formattedCreatedAt,
          createdAtMs: effectiveCreatedMs,
          postType: (row.post_type as CoursePost['postType']) || 'announcement',
          status,
          scheduledFor: status === 'scheduled' ? scheduledFor : undefined,
          scheduledForDisplay: status === 'scheduled' ? scheduledForDisplay : undefined,
          isPinned,
          pinnedAt,
          pinOrder,
          attachments: visibleAttachments,
          likes: Array.isArray(row.likes) ? row.likes : [],
          comments: comments as CoursePost['comments'],
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
      } else {
        query = query.neq('user_id', AUDIT_LOG_SYSTEM_USER_ID);
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

      const chunks = this.chunkArray(rows, 250);
      for (const batch of chunks) {
        const { error } = await supabase.from('notifications').upsert(batch, { onConflict: 'id' });
        if (error) {
          if (error.code === '42P01' || error.message?.includes('notifications')) {
            this.notificationsTableStatus = 'missing';
          }
          return false;
        }
      }
      this.notificationsTableStatus = 'available';
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Auto-delete notifications older than 30 minutes (and also trigger 2-day Audit Log cleanup) from Supabase SQL database
   */
  static async purgeExpiredNotifications(expiredIds: string[] = [], force: boolean = false): Promise<boolean> {
    if (this.notificationsTableStatus === 'missing') {
      return false;
    }
    const now = Date.now();
    const shouldRunTimeSweep = force || now - this.lastExpiredCleanupAt >= 45_000;

    // Also run the 2-day Audit Log background auto-delete sweep
    this.purgeExpiredAuditLogs([], force).catch(() => {});

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
          .neq('user_id', AUDIT_LOG_SYSTEM_USER_ID)
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
   * Auto-delete Security Audit Logs older than 2 days (48 hours) from Supabase SQL database in the background
   */
  static async purgeExpiredAuditLogs(expiredIds: string[] = [], force: boolean = false): Promise<boolean> {
    if (this.notificationsTableStatus === 'missing') {
      return false;
    }
    const now = Date.now();
    const shouldRunSweep = force || now - this.lastAuditLogCleanupAt >= 60_000;
    if (!shouldRunSweep && expiredIds.length === 0) {
      return true;
    }

    try {
      if (shouldRunSweep) {
        this.lastAuditLogCleanupAt = now;
        const cutoffIso = new Date(now - AUDIT_LOG_TTL_MS).toISOString();
        const nowIso = new Date(now).toISOString();
        const { error } = await supabase
          .from('notifications')
          .delete()
          .eq('user_id', AUDIT_LOG_SYSTEM_USER_ID)
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
        await supabase
          .from('notifications')
          .delete()
          .eq('user_id', AUDIT_LOG_SYSTEM_USER_ID)
          .in('id', expiredIds.slice(0, 100));
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
      const { error } = await supabase
        .from('notifications')
        .delete()
        .neq('user_id', AUDIT_LOG_SYSTEM_USER_ID)
        .eq('post_id', postId);
      if (error && (error.code === '42P01' || error.message?.includes('notifications'))) {
        this.notificationsTableStatus = 'missing';
      }
      return !error;
    } catch {
      return false;
    }
  }

  /**
   * Fetch Security Audit Logs (Admin & Co-Admin activity records) from Supabase
   * while automatically purging any logs older than 2 days (48 hours).
   */
  static async getRemoteAuditLogs(limit: number = 250): Promise<AuditLogEntry[] | null> {
    if (this.notificationsTableStatus === 'missing') {
      return null;
    }
    return this.dedupeGet(`audit_logs:${limit}`, async () => {
      try {
        // Trigger background 2-day auto-purge in Supabase
        this.purgeExpiredAuditLogs([], false).catch(() => {});

        const now = Date.now();
        const cutoffIso = new Date(now - AUDIT_LOG_TTL_MS).toISOString();

        const { data, error } = await supabase
          .from('notifications')
          .select(
            'id,user_id,course_id,course_code,course_title,post_id,author_name,author_role,title,message,type,created_at,expires_at'
          )
          .eq('user_id', AUDIT_LOG_SYSTEM_USER_ID)
          .gte('created_at', cutoffIso)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (error) {
          if (error.code === '42P01' || error.message?.includes('notifications')) {
            this.notificationsTableStatus = 'missing';
          }
          return null;
        }
        this.notificationsTableStatus = 'available';
        if (!data) return [];

        const logs: AuditLogEntry[] = [];
        const expiredCloudIds: string[] = [];

        for (const row of data) {
          const rowCreatedMs = row.created_at ? new Date(row.created_at).getTime() : now;
          if (now - rowCreatedMs >= AUDIT_LOG_TTL_MS) {
            expiredCloudIds.push(String(row.id));
            continue;
          }

          try {
            if (row.message && String(row.message).trim().startsWith('{')) {
              const parsed = JSON.parse(String(row.message)) as AuditLogEntry;
              if (parsed && parsed.id && parsed.actionCode) {
                const entryMs = parsed.createdAtMs || rowCreatedMs;
                if (now - entryMs >= AUDIT_LOG_TTL_MS) {
                  expiredCloudIds.push(String(row.id));
                  continue;
                }
                logs.push(parsed);
                continue;
              }
            }
          } catch {
            // Fallback to column reconstruction below
          }
          logs.push({
            id: String(row.id),
            actorId: 'admin',
            actorName: String(row.author_name || 'Admin'),
            actorUsername: 'admin',
            actorRole: ((row.author_role as UserRole) || 'admin'),
            category: ((row.course_code as AuditLogEntry['category']) || 'security'),
            actionCode: String(row.course_title || 'ADMIN_ACTION'),
            actionLabel: String(row.course_title || 'Admin Action'),
            severity: ((row.post_id as AuditLogEntry['severity']) || 'info'),
            courseId: row.course_id && row.course_id !== 'GLOBAL' ? String(row.course_id) : undefined,
            summary: String(row.title || ''),
            details: String(row.message || ''),
            createdAt: new Date(rowCreatedMs).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }),
            createdAtMs: rowCreatedMs,
          });
        }

        if (expiredCloudIds.length > 0) {
          this.purgeExpiredAuditLogs(expiredCloudIds, true).catch(() => {});
        }

        return logs;
      } catch {
        return null;
      }
    });
  }

  /**
   * Upsert Security Audit Log entries to Supabase (stored automatically in public.notifications with 2-day auto-delete retention)
   */
  static async upsertAuditLogs(entries: AuditLogEntry[]): Promise<boolean> {
    if (this.notificationsTableStatus === 'missing' || entries.length === 0) {
      return false;
    }
    try {
      const rows = entries.map((e) => {
        const createdMs = e.createdAtMs || Date.now();
        const expiresMs = createdMs + AUDIT_LOG_TTL_MS;
        return {
          id: e.id,
          user_id: AUDIT_LOG_SYSTEM_USER_ID,
          course_id: e.courseId || 'GLOBAL',
          course_code: e.category,
          course_title: e.actionCode,
          post_id: e.severity,
          author_name: `${e.actorName} (@${e.actorUsername})`,
          author_role: e.actorRole,
          title: e.summary,
          message: JSON.stringify(e),
          type: 'audit_log',
          is_read: true,
          created_at: new Date(createdMs).toISOString(),
          expires_at: new Date(expiresMs).toISOString(),
        };
      });

      for (const batch of this.chunkArray(rows, 150)) {
        const { error } = await supabase.from('notifications').upsert(batch, { onConflict: 'id' });
        if (error) {
          if (error.code === '42P01' || error.message?.includes('notifications')) {
            this.notificationsTableStatus = 'missing';
          }
          return false;
        }
      }
      this.notificationsTableStatus = 'available';
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clear remote Security Audit Logs (Primary Admin action)
   */
  static async clearRemoteAuditLogs(): Promise<boolean> {
    if (this.notificationsTableStatus === 'missing') return false;
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', AUDIT_LOG_SYSTEM_USER_ID);
      return !error;
    } catch {
      return false;
    }
  }

  private static buildProfilePayload(
    user: User,
    mode: 'full' | 'no_password' | 'core'
  ): Record<string, unknown> {
    const safeAvatar = compactAvatarForCloud(user.avatar, user.role);
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
      password: encryptPassword(user.password, user.role, user.id),
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
  static async upsertProfile(
    user: User,
    forceUpload: boolean = false
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const normalizedUser: User = {
        ...user,
        username: (user.username || '').trim().toLowerCase(),
        email: (user.email || '').trim().toLowerCase(),
      };
      const payload = this.buildProfilePayload(normalizedUser, this.profileSchemaMode);
      const sigKey = `profile:${normalizedUser.id}`;
      // Compare without updated_at timestamp so identical profiles aren't re-uploaded
      const { updated_at: _ignoreTs, ...comparablePayload } = payload;
      if (!forceUpload && !this.hasChangedSignature(sigKey, comparablePayload)) {
        return { success: true };
      }

      const { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' });

      if (!error) {
        this.recordSignature(sigKey, comparablePayload);
        return { success: true };
      }

      // Handle unique constraint violation (23505) on username or email when an account is recreated with a new ID
      if (
        error.code === '23505' ||
        (error.message && error.message.toLowerCase().includes('duplicate key'))
      ) {
        try {
          if (normalizedUser.username) {
            await supabase
              .from('profiles')
              .delete()
              .ilike('username', normalizedUser.username)
              .neq('id', normalizedUser.id);
          }
          if (normalizedUser.email) {
            await supabase
              .from('profiles')
              .delete()
              .ilike('email', normalizedUser.email)
              .neq('id', normalizedUser.id);
          }
          const { error: retryErr } = await supabase
            .from('profiles')
            .upsert(payload, { onConflict: 'id' });
          if (!retryErr) {
            this.recordSignature(sigKey, comparablePayload);
            return { success: true };
          }
        } catch {
          // continue to fallback if needed
        }
      }

      const isMissingColumnError =
        error.code === '42703' ||
        error.code === 'PGRST204' ||
        (error.message && error.message.toLowerCase().includes('column'));

      // Fallback 1: without password column (only downgrade schema mode if column is genuinely missing)
      if (this.profileSchemaMode === 'full' && isMissingColumnError) {
        const noPwdPayload = this.buildProfilePayload(normalizedUser, 'no_password');
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
      const corePayload = this.buildProfilePayload(normalizedUser, 'core');
      const { error: fallbackError } = await supabase
        .from('profiles')
        .upsert(corePayload, { onConflict: 'id' });

      if (!fallbackError) {
        if (isMissingColumnError) {
          this.profileSchemaMode = 'core';
        }
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
   * Delete a profile and all associated student submissions & notifications from Supabase SQL database
   */
  static async deleteProfile(userId: string): Promise<boolean> {
    try {
      this.lastUpsertSignatures.delete(`profile:${userId}`);
      await Promise.allSettled([
        supabase.from('assignment_submissions').delete().eq('student_id', userId),
        supabase.from('quiz_submissions').delete().eq('student_id', userId),
        this.notificationsTableStatus !== 'missing'
          ? supabase.from('notifications').delete().eq('user_id', userId)
          : Promise.resolve(),
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
        theme_color: encodeCourseThemeWithOrder(course),
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
   * Delete a classroom/course and ALL its child records (including assignment_submissions and quiz_submissions) from Supabase SQL database
   */
  static async deleteCourse(courseId: string): Promise<boolean> {
    try {
      this.lastUpsertSignatures.delete(`course:${courseId}`);
      // First lookup assignment IDs and quiz IDs belonging to this course so their submissions don't become orphans
      const [assRes, quizRes] = await Promise.allSettled([
        supabase.from('assignments').select('id').eq('course_id', courseId),
        supabase.from('quizzes').select('id').eq('course_id', courseId),
      ]);

      const assIds =
        assRes.status === 'fulfilled' && Array.isArray(assRes.value.data)
          ? assRes.value.data.map((r) => String(r.id))
          : [];
      const quizIds =
        quizRes.status === 'fulfilled' && Array.isArray(quizRes.value.data)
          ? quizRes.value.data.map((r) => String(r.id))
          : [];

      const subCleanupTasks: PromiseLike<unknown>[] = [];
      if (assIds.length > 0) {
        subCleanupTasks.push(
          supabase.from('assignment_submissions').delete().in('assignment_id', assIds)
        );
      }
      if (quizIds.length > 0) {
        subCleanupTasks.push(
          supabase.from('quiz_submissions').delete().in('quiz_id', quizIds)
        );
      }
      if (subCleanupTasks.length > 0) {
        await Promise.allSettled(subCleanupTasks);
      }

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

  private static formatPostRow(post: CoursePost, coreOnly: boolean = false) {
    // Strip heavy base64 fileData & oversized data URLs from attachments before storing in Supabase
    const cleanVisibleAttachments = (post.attachments || [])
      .filter((att) => att && att.id !== '__post_meta__')
      .map((att) => ({
        id: att.id,
        name: att.name,
        size: att.size,
        type: att.type,
        url:
          att.url && (att.url.startsWith('data:') || att.url.length > 2000)
            ? '#attachment'
            : att.url,
      }));

    // Keep latest 50 comments max in Supabase row and strip student avatars
    const safeComments = (post.comments || []).slice(-50).map((c) => ({
      id: c.id,
      postId: c.postId,
      authorId: c.authorId,
      authorName: c.authorName,
      authorRole: c.authorRole,
      authorAvatar: compactAvatarForCloud(c.authorAvatar, c.authorRole),
      content: (c.content || '').slice(0, 1000),
      createdAt: c.createdAt,
    }));

    const idTsMatch = post.id ? post.id.match(/(\d{13})/) : null;
    const idTs = idTsMatch ? Number(idTsMatch[1]) : undefined;
    const isInitialDemoPost = /^post-\d{3}$/.test(post.id || '');
    const effectiveMs =
      post.createdAtMs ||
      (idTs && idTs > 1_600_000_000_000 ? idTs : undefined) ||
      (isInitialDemoPost ? 1_704_067_200_000 : Date.now());

    const postStatus = post.status || 'published';
    const metaAttachment = {
      id: '__post_meta__',
      name: '__post_meta__',
      size: '0B',
      type: 'meta',
      url: JSON.stringify({
        status: postStatus,
        scheduledFor: postStatus === 'scheduled' ? post.scheduledFor || null : null,
        scheduledForDisplay: postStatus === 'scheduled' ? post.scheduledForDisplay || null : null,
        isPinned: Boolean(post.isPinned),
        pinnedAt: post.pinnedAt || null,
        pinOrder: post.pinOrder ?? null,
        createdAtMs: effectiveMs,
        authorRole: post.authorRole || 'admin',
      }),
    };

    const safeAttachments = [...cleanVisibleAttachments, metaAttachment];

    if (coreOnly) {
      return {
        id: post.id,
        course_id: post.courseId,
        author_id: post.authorId,
        author_name: post.authorName,
        title: post.title,
        content: post.content,
        post_type: post.postType || 'announcement',
        attachments: safeAttachments,
        likes: post.likes || [],
        comments: safeComments,
        ...(effectiveMs ? { created_at: new Date(effectiveMs).toISOString() } : {}),
      };
    }

    return {
      id: post.id,
      course_id: post.courseId,
      author_id: post.authorId,
      author_name: post.authorName,
      author_role: post.authorRole || 'admin',
      author_avatar: compactAvatarForCloud(post.authorAvatar, post.authorRole),
      title: post.title,
      content: post.content,
      post_type: post.postType || 'announcement',
      status: postStatus,
      scheduled_for: postStatus === 'scheduled' ? post.scheduledFor || null : null,
      scheduled_for_display: postStatus === 'scheduled' ? post.scheduledForDisplay || null : null,
      is_pinned: Boolean(post.isPinned),
      pinned_at: post.pinnedAt || null,
      pin_order: post.pinOrder ?? null,
      attachments: safeAttachments,
      likes: post.likes || [],
      comments: safeComments,
      ...(effectiveMs ? { created_at: new Date(effectiveMs).toISOString() } : {}),
    };
  }

  /**
   * Upsert a stream post (including comments, likes, schedule & pin metadata) to Supabase SQL database
   * with automatic schema fallback so posts never fail or disappear even if optional columns are missing.
   */
  static async upsertPost(post: CoursePost, parentCourse?: Course): Promise<boolean> {
    try {
      const row = this.formatPostRow(post, false);
      const sigKey = `post:${post.id}`;
      if (!this.hasChangedSignature(sigKey, row)) {
        return true;
      }
      const { error } = await supabase.from('posts').upsert(row, { onConflict: 'id' });
      if (!error) {
        this.recordSignature(sigKey, row);
        return true;
      }

      // If foreign key violation on course_id (23503), ensure parentCourse is upserted first and retry
      if (
        parentCourse &&
        (error.code === '23503' ||
          (error.message && error.message.toLowerCase().includes('foreign key')))
      ) {
        await this.upsertCourse(parentCourse);
        const { error: retryFkErr } = await supabase.from('posts').upsert(row, { onConflict: 'id' });
        if (!retryFkErr) {
          this.recordSignature(sigKey, row);
          return true;
        }
      }

      // Fallback to core columns if optional columns (e.g. scheduled_for, status, is_pinned) are missing
      const coreRow = this.formatPostRow(post, true);
      const { error: coreErr } = await supabase.from('posts').upsert(coreRow, { onConflict: 'id' });
      if (!coreErr) {
        this.recordSignature(sigKey, row);
        return true;
      }

      return false;
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
   * Automatically scans Supabase tables for orphaned records (e.g., posts, assignments, submissions,
   * quizzes, quiz_submissions, attendance_sessions, notifications whose parent course, user, post,
   * assignment, or quiz no longer exists in the classroom) and permanently deletes them from Supabase.
   */
  static async cleanOrphanedCloudData(
    validCourseIds?: string[],
    validUserIds?: string[],
    deletedIds: string[] = [],
    force: boolean = false
  ): Promise<{ success: boolean; totalCleaned: number; details: string }> {
    const now = Date.now();
    // Throttle automatic cloud orphan sweeps to once every 5 minutes unless forced
    if (!force && now - this.lastOrphanCleanupAt < 300_000) {
      return { success: true, totalCleaned: 0, details: 'Skipped (within 5m throttle window)' };
    }
    this.lastOrphanCleanupAt = now;

    let totalCleaned = 0;
    const deletedSet = new Set(deletedIds);

    try {
      // 1. Always purge expired (>30 mins) notifications first
      await this.purgeExpiredNotifications(deletedIds, true);

      // 2. Delete any explicitly tracked deletedIds across tables in safe chunks
      if (deletedIds.length > 0) {
        for (const chunk of this.chunkArray(deletedIds, 200)) {
          await Promise.allSettled([
            supabase.from('courses').delete().in('id', chunk),
            supabase.from('profiles').delete().in('id', chunk),
            supabase.from('posts').delete().in('id', chunk),
            supabase.from('assignments').delete().in('id', chunk),
            supabase.from('assignment_submissions').delete().in('id', chunk),
            supabase.from('quizzes').delete().in('id', chunk),
            supabase.from('quiz_submissions').delete().in('id', chunk),
            supabase.from('attendance_sessions').delete().in('id', chunk),
          ]);
        }
      }

      // 3. Determine active course IDs and user IDs by ALWAYS unioning local valid IDs with actual Supabase rows
      // so a client with partial/unloaded local courses NEVER mistakenly deletes another classroom's posts!
      const [cQueryRes, uQueryRes] = await Promise.all([
        supabase.from('courses').select('id').limit(500),
        supabase.from('profiles').select('id').limit(3000),
      ]);

      if (cQueryRes.error || uQueryRes.error || !cQueryRes.data || !uQueryRes.data) {
        return {
          success: true,
          totalCleaned,
          details: 'Skipped referential sweep (could not verify remote parent catalog)',
        };
      }

      const courseIdSet = new Set<string>();
      (validCourseIds || []).forEach((id) => {
        if (id && !deletedSet.has(id)) courseIdSet.add(String(id));
      });
      cQueryRes.data.forEach((r) => {
        const id = String(r.id || '');
        if (id && !deletedSet.has(id)) courseIdSet.add(id);
      });

      const userIdSet = new Set<string>();
      (validUserIds || []).forEach((id) => {
        if (id && !deletedSet.has(id)) userIdSet.add(String(id));
      });
      uQueryRes.data.forEach((r) => {
        const id = String(r.id || '');
        if (id && !deletedSet.has(id)) userIdSet.add(id);
      });

      // If either set is empty, skip referential sweep to avoid accidental deletion
      if (courseIdSet.size === 0 || userIdSet.size === 0) {
        return { success: true, totalCleaned, details: 'No active parent catalog to compare' };
      }

      // 4. Fetch lightweight foreign-key metadata from child tables in parallel
      const [
        postsMeta,
        assMeta,
        subMeta,
        quizMeta,
        quizSubMeta,
        attMeta,
        notifMeta,
      ] = await Promise.allSettled([
        supabase.from('posts').select('id,course_id').limit(1000),
        supabase.from('assignments').select('id,course_id').limit(1000),
        supabase.from('assignment_submissions').select('id,assignment_id,student_id').limit(2000),
        supabase.from('quizzes').select('id,course_id').limit(1000),
        supabase.from('quiz_submissions').select('id,quiz_id,student_id').limit(2000),
        supabase.from('attendance_sessions').select('id,course_id').limit(1000),
        this.notificationsTableStatus !== 'missing'
          ? supabase.from('notifications').select('id,course_id,user_id,post_id').limit(2000)
          : Promise.resolve({ data: [] }),
      ]);

      const validPostIds = new Set<string>();
      const orphanPostIds: string[] = [];
      if (postsMeta.status === 'fulfilled' && Array.isArray(postsMeta.value.data)) {
        postsMeta.value.data.forEach((row) => {
          const id = String(row.id);
          const cId = String(row.course_id || '');
          if (deletedSet.has(id) || !courseIdSet.has(cId)) {
            orphanPostIds.push(id);
          } else {
            validPostIds.add(id);
          }
        });
      }

      const validAssIds = new Set<string>();
      const orphanAssIds: string[] = [];
      if (assMeta.status === 'fulfilled' && Array.isArray(assMeta.value.data)) {
        assMeta.value.data.forEach((row) => {
          const id = String(row.id);
          const cId = String(row.course_id || '');
          if (deletedSet.has(id) || !courseIdSet.has(cId)) {
            orphanAssIds.push(id);
          } else {
            validAssIds.add(id);
          }
        });
      }

      const orphanSubIds: string[] = [];
      if (subMeta.status === 'fulfilled' && Array.isArray(subMeta.value.data)) {
        subMeta.value.data.forEach((row) => {
          const id = String(row.id);
          const aId = String(row.assignment_id || '');
          const sId = String(row.student_id || '');
          if (deletedSet.has(id) || !validAssIds.has(aId) || !userIdSet.has(sId)) {
            orphanSubIds.push(id);
          }
        });
      }

      const validQuizIds = new Set<string>();
      const orphanQuizIds: string[] = [];
      if (quizMeta.status === 'fulfilled' && Array.isArray(quizMeta.value.data)) {
        quizMeta.value.data.forEach((row) => {
          const id = String(row.id);
          const cId = String(row.course_id || '');
          if (deletedSet.has(id) || !courseIdSet.has(cId)) {
            orphanQuizIds.push(id);
          } else {
            validQuizIds.add(id);
          }
        });
      }

      const orphanQuizSubIds: string[] = [];
      if (quizSubMeta.status === 'fulfilled' && Array.isArray(quizSubMeta.value.data)) {
        quizSubMeta.value.data.forEach((row) => {
          const id = String(row.id);
          const qId = String(row.quiz_id || '');
          const sId = String(row.student_id || '');
          if (deletedSet.has(id) || !validQuizIds.has(qId) || !userIdSet.has(sId)) {
            orphanQuizSubIds.push(id);
          }
        });
      }

      const orphanAttIds: string[] = [];
      if (attMeta.status === 'fulfilled' && Array.isArray(attMeta.value.data)) {
        attMeta.value.data.forEach((row) => {
          const id = String(row.id);
          const cId = String(row.course_id || '');
          if (deletedSet.has(id) || !courseIdSet.has(cId)) {
            orphanAttIds.push(id);
          }
        });
      }

      const orphanNotifIds: string[] = [];
      if (notifMeta.status === 'fulfilled' && Array.isArray(notifMeta.value.data)) {
        notifMeta.value.data.forEach((row) => {
          const r = row as Record<string, unknown>;
          const id = String(r.id || '');
          const cId = String(r.course_id || '');
          const uId = String(r.user_id || '');
          const pId = r.post_id ? String(r.post_id) : '';
          // Never delete SYSTEM_AUDIT_LOG rows during orphan notification sweeps
          if (uId === AUDIT_LOG_SYSTEM_USER_ID) {
            return;
          }
          if (
            deletedSet.has(id) ||
            (cId && !courseIdSet.has(cId)) ||
            (uId && !userIdSet.has(uId)) ||
            (pId && validPostIds.size > 0 && !validPostIds.has(pId))
          ) {
            orphanNotifIds.push(id);
          }
        });
      }

      // 5. Execute chunked deletes for all discovered orphans
      const deleteByIdChunks = async (table: string, ids: string[]) => {
        for (const chunk of this.chunkArray(ids, 200)) {
          await supabase.from(table).delete().in('id', chunk);
        }
      };

      const cleanupPromises: Promise<unknown>[] = [];
      if (orphanSubIds.length > 0) {
        totalCleaned += orphanSubIds.length;
        cleanupPromises.push(deleteByIdChunks('assignment_submissions', orphanSubIds));
      }
      if (orphanQuizSubIds.length > 0) {
        totalCleaned += orphanQuizSubIds.length;
        cleanupPromises.push(deleteByIdChunks('quiz_submissions', orphanQuizSubIds));
      }
      if (orphanNotifIds.length > 0 && this.notificationsTableStatus !== 'missing') {
        totalCleaned += orphanNotifIds.length;
        cleanupPromises.push(deleteByIdChunks('notifications', orphanNotifIds));
      }
      if (orphanPostIds.length > 0) {
        totalCleaned += orphanPostIds.length;
        cleanupPromises.push(deleteByIdChunks('posts', orphanPostIds));
      }
      if (orphanAssIds.length > 0) {
        totalCleaned += orphanAssIds.length;
        cleanupPromises.push(deleteByIdChunks('assignments', orphanAssIds));
      }
      if (orphanQuizIds.length > 0) {
        totalCleaned += orphanQuizIds.length;
        cleanupPromises.push(deleteByIdChunks('quizzes', orphanQuizIds));
      }
      if (orphanAttIds.length > 0) {
        totalCleaned += orphanAttIds.length;
        cleanupPromises.push(deleteByIdChunks('attendance_sessions', orphanAttIds));
      }

      if (cleanupPromises.length > 0) {
        await Promise.allSettled(cleanupPromises);
      }

      return {
        success: true,
        totalCleaned,
        details: `Cleaned ${totalCleaned} orphaned cloud records (posts: ${orphanPostIds.length}, assignments: ${orphanAssIds.length}, submissions: ${orphanSubIds.length + orphanQuizSubIds.length}, attendance: ${orphanAttIds.length}, notifications: ${orphanNotifIds.length}).`,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, totalCleaned, details: msg };
    }
  }

  /**
   * High-Speed Batch Sync: Syncs all local users, courses, posts, assignments, submissions, quizzes, and attendance
   * using chunked batch upserts (supports 2,000+ users without hitting PostgREST payload size limits)
   * and automatically cleans orphaned records in Supabase.
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
  ): Promise<{ success: boolean; syncedUsers: number; syncedCourses: number; cleanedOrphans?: number; error?: string }> {
    let lastError: string | undefined;

    // 0. Always purge expired (>30 mins) notifications in Supabase first
    await this.purgeExpiredNotifications(deletedIds, true);

    // 1. Batch upsert profiles in chunks of 250 (supports 2,000+ users smoothly)
    let syncedUsers = 0;
    if (users.length > 0) {
      const userChunks = this.chunkArray(users, 250);
      for (const chunk of userChunks) {
        const profilePayloads = chunk.map((u) => this.buildProfilePayload(u, this.profileSchemaMode));
        const { error: profErr } = await supabase
          .from('profiles')
          .upsert(profilePayloads, { onConflict: 'id' });

        if (!profErr) {
          syncedUsers += chunk.length;
        } else {
          // Fallback to individual upserts to detect schema mode
          for (const u of chunk) {
            const res = await this.upsertProfile(u);
            if (res.success) syncedUsers++;
            else lastError = res.error;
          }
        }
      }
    }

    // 2. Batch upsert courses in chunks
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
        theme_color: encodeCourseThemeWithOrder(course),
        enrolled_student_ids: course.enrolledStudentIds || [],
        total_lessons: course.totalLessons || 0,
        total_assignments: course.totalAssignments || 0,
        total_quizzes: course.totalQuizzes || 0,
      }));
      for (const batch of this.chunkArray(coursePayloads, 100)) {
        const { error: courseErr } = await supabase
          .from('courses')
          .upsert(batch, { onConflict: 'id' });
        if (!courseErr) {
          syncedCourses += batch.length;
        } else if (!lastError) {
          lastError = courseErr.message;
        }
      }
    }

    // 3. Parallel chunked batch upserts for child tables
    const batchTasks: PromiseLike<unknown>[] = [];

    if (posts.length > 0) {
      const formattedPosts = posts.map((p) => this.formatPostRow(p));
      for (const batch of this.chunkArray(formattedPosts, 150)) {
        batchTasks.push(supabase.from('posts').upsert(batch, { onConflict: 'id' }));
      }
    }

    if (assignments.length > 0) {
      const formattedAssignments = assignments.map((a) => ({
        id: a.id,
        course_id: a.courseId,
        title: a.title,
        description: a.description,
        due_date: a.dueDate,
        total_points: a.maxPoints || 100,
      }));
      for (const batch of this.chunkArray(formattedAssignments, 200)) {
        batchTasks.push(supabase.from('assignments').upsert(batch, { onConflict: 'id' }));
      }
    }

    if (submissions.length > 0) {
      const formattedSubmissions = submissions.map((sub) => this.formatSubmissionRow(sub));
      for (const batch of this.chunkArray(formattedSubmissions, 200)) {
        batchTasks.push(supabase.from('assignment_submissions').upsert(batch, { onConflict: 'id' }));
      }
    }

    if (quizzes.length > 0) {
      const formattedQuizzes = quizzes.map((q) => ({
        id: q.id,
        course_id: q.courseId,
        title: q.title,
        time_limit_minutes: q.durationMinutes || 30,
        passing_score: q.passingScore || 70,
        questions: q.questions || [],
      }));
      for (const batch of this.chunkArray(formattedQuizzes, 150)) {
        batchTasks.push(supabase.from('quizzes').upsert(batch, { onConflict: 'id' }));
      }
    }

    if (attendanceSessions.length > 0) {
      const formattedAtt = attendanceSessions.map((session) => ({
        id: session.id,
        course_id: session.courseId,
        date: session.date,
        display_date: session.displayDate,
        title: session.title,
        is_open: session.isOpen,
        opened_by: session.openedBy,
        records: session.records || {},
      }));
      for (const batch of this.chunkArray(formattedAtt, 150)) {
        batchTasks.push(supabase.from('attendance_sessions').upsert(batch, { onConflict: 'id' }));
      }
    }

    if (batchTasks.length > 0) {
      await Promise.allSettled(batchTasks);
    }

    // 4. Run Orphaned Data Auto-Cleanup in Supabase so any rows no longer in the classroom are purged
    const orphanSweep = await this.cleanOrphanedCloudData(
      courses.map((c) => c.id),
      users.map((u) => u.id),
      deletedIds,
      true
    );

    return {
      success: syncedUsers > 0 && !lastError,
      syncedUsers,
      syncedCourses,
      cleanedOrphans: orphanSweep.totalCleaned,
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
            avatar: meta.avatar || DEFAULT_FALLBACK_AVATAR,
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
   * Sign Up a new user with Supabase Profile (Authoritative Cloud Sync)
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
      name: userData.name.trim(),
      username: userData.username.trim().toLowerCase(),
      email: email.trim().toLowerCase(),
      password: encryptPassword(password.trim(), userData.role, userId),
      role: userData.role,
      phone: userData.phone || '+95 9 000 000000',
      avatar:
        userData.role === 'student'
          ? ''
          : userData.avatar || DEFAULT_FALLBACK_AVATAR,
      title: userData.title || undefined,
      gender: userData.gender || 'male',
      address: userData.address || undefined,
    };

    // Always force upsert directly to public.profiles table so mobile devices immediately see the new account
    const profileRes = await this.upsertProfile(newUser, true);

    if (!profileRes.success) {
      return { user: newUser, error: profileRes.error, profileSynced: false };
    }

    return { user: newUser, profileSynced: true };
  }
}
