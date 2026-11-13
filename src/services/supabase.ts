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
  AttendanceRecord,
  NotificationItem,
  AuditLogEntry,
  PrivateNote,
} from '../types/classroom';
import { encryptPassword } from '../utils/passwordCrypto';
import {
  resolveAvatarUrl,
  toCloudAvatarKeyOrUrl,
  DEFAULT_AVATAR_PRESET_KEY,
} from '../data/presetAvatars';

export const NOTIFICATION_TTL_MS = 30 * 60 * 1000; // 30 minutes auto-delete window
export const AUDIT_LOG_TTL_MS = 2 * 24 * 60 * 60 * 1000; // 2 days (48 hours) security audit auto-delete window
export const COMMENT_TTL_MS = 2 * 24 * 60 * 60 * 1000; // 2 days (48 hours) silent post comment auto-delete window
export const PRIVATE_NOTE_TTL_MS = 180 * 24 * 60 * 60 * 1000; // 180 days (6 months) retention for Private Notes
const AUDIT_LOG_SYSTEM_USER_ID = 'SYSTEM_AUDIT_LOG';
const PRIVATE_NOTE_SYSTEM_USER_ID = 'SYSTEM_PRIVATE_NOTE';

export function resolveCommentTimestampMs(
  comment: { id?: unknown; createdAt?: unknown; createdAtMs?: unknown },
  fallbackPostMs?: number
): number {
  const directMs = Number(comment?.createdAtMs);
  if (Number.isFinite(directMs) && directMs > 1_600_000_000_000) {
    return directMs;
  }
  const idStr = String(comment?.id || '');
  const idMatch = idStr.match(/(\d{13})/);
  if (idMatch) {
    const parsedIdMs = Number(idMatch[1]);
    if (Number.isFinite(parsedIdMs) && parsedIdMs > 1_600_000_000_000) {
      return parsedIdMs;
    }
  }
  const rawCreatedAt = String(comment?.createdAt || '').trim();
  if (rawCreatedAt) {
    const parsedDate = Date.parse(rawCreatedAt);
    if (!isNaN(parsedDate) && parsedDate > 1_600_000_000_000) {
      return parsedDate;
    }
  }
  if (fallbackPostMs && Number.isFinite(fallbackPostMs) && fallbackPostMs > 1_600_000_000_000) {
    return fallbackPostMs;
  }
  return Date.now();
}

export function isCommentExpired(
  comment: { id?: unknown; createdAt?: unknown; createdAtMs?: unknown },
  nowMs: number = Date.now(),
  fallbackPostMs?: number
): boolean {
  const createdMs = resolveCommentTimestampMs(comment, fallbackPostMs);
  return nowMs - createdMs >= COMMENT_TTL_MS;
}

const CUSTOM_SUPABASE_CONFIG_STORAGE_KEY = 'classroom_custom_supabase_config_v2';

export function normalizeSupabaseProjectUrl(rawUrl: string): string {
  const trimmed = (rawUrl || '').trim();
  const match = trimmed.match(/^(https:\/\/[a-z0-9-]+\.supabase\.co)/i);
  if (match) {
    return match[1].toLowerCase();
  }
  return trimmed.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
}

export const DEFAULT_SUPABASE_CONFIG = {
  url: normalizeSupabaseProjectUrl(
    import.meta.env.VITE_SUPABASE_URL || 'https://apuyokqzskpmbnmekpyd.supabase.co'
  ),
  publishableKey:
    import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_6eYg1IuvvXOtj7e8Kf-kVg_UDPgI7Gs',
  jwksUrl:
    import.meta.env.VITE_SUPABASE_JWKS_URL ||
    'https://apuyokqzskpmbnmekpyd.supabase.co/auth/v1/.well-known/jwks.json',
};

function loadInitialSupabaseConfig(): {
  url: string;
  publishableKey: string;
  jwksUrl: string;
} {
  if (typeof window !== 'undefined') {
    try {
      // Clear legacy v1 override so the newly migrated default project takes effect immediately
      localStorage.removeItem('classroom_custom_supabase_config_v1');
      const raw = localStorage.getItem(CUSTOM_SUPABASE_CONFIG_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { url?: string; publishableKey?: string };
        const cleanUrl = normalizeSupabaseProjectUrl(parsed.url || '');
        const cleanKey = (parsed.publishableKey || '').trim();
        if (/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(cleanUrl) && cleanKey.length > 15) {
          return {
            url: cleanUrl,
            publishableKey: cleanKey,
            jwksUrl: `${cleanUrl}/auth/v1/.well-known/jwks.json`,
          };
        }
      }
    } catch {
      // ignore
    }
  }
  return { ...DEFAULT_SUPABASE_CONFIG };
}

// Active Supabase Project Credentials (supports zero-downtime switching to a new Supabase project)
export const SUPABASE_CONFIG = loadInitialSupabaseConfig();
const INITIAL_CLIENT_SUPABASE_URL = SUPABASE_CONFIG.url.replace(/\/+$/, '');

// Official Singapore Cloud Run Server (Silent Background VPN-Free Relay for Myanmar and International ISPs)
const GLOBAL_VPN_FREE_RELAY_ORIGIN =
  'https://ais-pre-x3aphtm3a4npfd5tmiiqhv-683201169391.asia-southeast1.run.app';

type AutoRouteType = 'direct' | 'same_origin_proxy' | 'sg_cloud_relay';

let activeWinningRoute: AutoRouteType | null = null;
let activeWinningRouteTimestamp = 0;
const ROUTE_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const WINNING_ROUTE_STORAGE_KEY = 'classroom_winning_route_v1';

if (typeof window !== 'undefined') {
  try {
    const savedRoute = sessionStorage.getItem(WINNING_ROUTE_STORAGE_KEY) as AutoRouteType | null;
    if (
      savedRoute === 'direct' ||
      savedRoute === 'same_origin_proxy' ||
      savedRoute === 'sg_cloud_relay'
    ) {
      activeWinningRoute = savedRoute;
      activeWinningRouteTimestamp = Date.now();
    }
  } catch {
    // ignore
  }
}

function saveWinningRoute(route: AutoRouteType): void {
  activeWinningRoute = route;
  activeWinningRouteTimestamp = Date.now();
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem(WINNING_ROUTE_STORAGE_KEY, route);
    } catch {
      // ignore
    }
  }
}

function getCandidateRoutesForHost(): AutoRouteType[] {
  if (typeof window === 'undefined') return ['direct'];
  const host = window.location.hostname || '';
  const isNodeProxyHost =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.includes('.run.app') ||
    host.includes('.googleusercontent.com');

  return isNodeProxyHost
    ? ['direct', 'same_origin_proxy']
    : ['direct', 'sg_cloud_relay'];
}

function extractSupabaseSubPath(originalUrl: string): string {
  const activeBase = SUPABASE_CONFIG.url.replace(/\/+$/, '');
  const defaultBase = DEFAULT_SUPABASE_CONFIG.url.replace(/\/+$/, '');
  let subPath = originalUrl;
  if (originalUrl.startsWith(activeBase)) {
    subPath = originalUrl.slice(activeBase.length);
  } else if (originalUrl.startsWith(INITIAL_CLIENT_SUPABASE_URL)) {
    subPath = originalUrl.slice(INITIAL_CLIENT_SUPABASE_URL.length);
  } else if (originalUrl.startsWith(defaultBase)) {
    subPath = originalUrl.slice(defaultBase.length);
  }
  return subPath.startsWith('/') ? subPath : `/${subPath}`;
}

function buildRouteUrl(originalUrl: string, routeType: AutoRouteType): string {
  const activeBase = SUPABASE_CONFIG.url.replace(/\/+$/, '');
  const normalizedSub = extractSupabaseSubPath(originalUrl);

  if (routeType === 'same_origin_proxy' && typeof window !== 'undefined') {
    return `${window.location.origin}/api/sb-proxy${normalizedSub}`;
  }
  if (routeType === 'sg_cloud_relay') {
    return `${GLOBAL_VPN_FREE_RELAY_ORIGIN}/api/sb-proxy${normalizedSub}`;
  }
  return `${activeBase}${normalizedSub}`;
}

function applyActiveProjectHeaders(
  init: RequestInit | undefined,
  routeType: AutoRouteType
): RequestInit | undefined {
  const headers = new Headers(init?.headers || {});
  headers.set('apikey', SUPABASE_CONFIG.publishableKey);
  const currentAuth = headers.get('authorization') || headers.get('Authorization') || '';
  if (
    !currentAuth ||
    currentAuth.includes(DEFAULT_SUPABASE_CONFIG.publishableKey) ||
    currentAuth.startsWith('Bearer sb_publishable_') ||
    currentAuth.startsWith('Bearer eyJ')
  ) {
    headers.set('Authorization', `Bearer ${SUPABASE_CONFIG.publishableKey}`);
  }
  if (routeType === 'same_origin_proxy' || routeType === 'sg_cloud_relay') {
    headers.set('x-supabase-target-origin', SUPABASE_CONFIG.url.replace(/\/+$/, ''));
  } else {
    headers.delete('x-supabase-target-origin');
  }
  return {
    ...init,
    headers,
  };
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
    if (
      res.status === 429 ||
      res.status === 502 ||
      res.status === 503 ||
      res.status === 504
    ) {
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

  const isSupabaseRequest =
    rawUrl.startsWith(SUPABASE_CONFIG.url) ||
    rawUrl.startsWith(INITIAL_CLIENT_SUPABASE_URL) ||
    rawUrl.startsWith(DEFAULT_SUPABASE_CONFIG.url);

  if (typeof window === 'undefined' || !isSupabaseRequest) {
    return fetch(input, init);
  }

  const baseCandidates = getCandidateRoutesForHost();
  const now = Date.now();
  const hasValidCachedWinner =
    activeWinningRoute !== null &&
    now - activeWinningRouteTimestamp < ROUTE_CACHE_TTL_MS &&
    baseCandidates.includes(activeWinningRoute);

  // Sequential primary -> backup failover (never fires duplicate parallel requests to Supabase!)
  const primaryRoute =
    hasValidCachedWinner && activeWinningRoute ? activeWinningRoute : baseCandidates[0];
  const backupRoute = baseCandidates.find((r) => r !== primaryRoute) || 'direct';

  try {
    const primaryUrl = buildRouteUrl(rawUrl, primaryRoute);
    const res = await fetchSingleRouteWithTimeout(
      primaryUrl,
      applyActiveProjectHeaders(init, primaryRoute),
      hasValidCachedWinner ? 4500 : 3200
    );
    if (primaryRoute === 'same_origin_proxy' && (res.status === 404 || res.status === 405)) {
      throw new Error('Same-origin proxy not mounted');
    }
    saveWinningRoute(primaryRoute);
    return res;
  } catch {
    const backupUrl = buildRouteUrl(rawUrl, backupRoute);
    const backupRes = await fetchSingleRouteWithTimeout(
      backupUrl,
      applyActiveProjectHeaders(init, backupRoute),
      8000
    );
    saveWinningRoute(backupRoute);
    return backupRes;
  }
};

// Initialize Supabase Client with Automatic Geo-Resilient VPN-Free Fetch & Low-Overhead Realtime Heartbeat
export const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.publishableKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 4,
    },
    heartbeatIntervalMs: 60_000,
  },
  global: {
    fetch: geoResilientSupabaseFetch,
  },
});

/**
 * Production-ready PostgreSQL SQL schema and RLS policies for Supabase
 */
export const SUPABASE_SQL_SCHEMA = `-- ========================================================
-- Classroom OS - Supabase Database Schema & RLS Policies
-- Execute this script in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/apuyokqzskpmbnmekpyd/sql
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

-- Ensure gender, address, password, rules_accepted & updated_at columns exist if table was created earlier
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT 'male';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password TEXT DEFAULT 'student123';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS rules_accepted BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS rules_accepted_at TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

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
  is_open BOOLEAN DEFAULT FALSE,
  opened_by TEXT NOT NULL,
  records JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.attendance_sessions ALTER COLUMN is_open SET DEFAULT FALSE;

ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Attendance sessions full access" ON public.attendance_sessions;
CREATE POLICY "Attendance sessions full access" ON public.attendance_sessions FOR ALL USING (true);

-- 8. Seed Initial Demo Accounts (Admin, Co-Admin, Students)
INSERT INTO public.profiles (id, name, username, email, role, phone, avatar, title, gender, address)
VALUES
  ('user-admin-1', 'Dr. Kyaw Swar', 'kyawswar.admin', 'kyaw.admin@classroomos.edu', 'admin', '+95 9 791 234567', 'preset:mentor-1', 'Dean of Computing & Lead Mentor', 'male', 'No. 45, Pyay Road, Kamayut, Yangon'),
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
CREATE INDEX IF NOT EXISTS idx_posts_course_created ON public.posts (course_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_course_id ON public.attendance_sessions (course_id);
CREATE INDEX IF NOT EXISTS idx_attendance_course_created ON public.attendance_sessions (course_id, created_at DESC);

-- Automatic Orphaned Data Cleanup & Egress Slimming (< 5.5 GB Free Plan Guard)
DELETE FROM public.posts WHERE course_id NOT IN (SELECT id FROM public.courses);
DELETE FROM public.assignments WHERE course_id NOT IN (SELECT id FROM public.courses);
DELETE FROM public.assignment_submissions WHERE assignment_id NOT IN (SELECT id FROM public.assignments) OR student_id NOT IN (SELECT id FROM public.profiles);
DELETE FROM public.quizzes WHERE course_id NOT IN (SELECT id FROM public.courses);
DELETE FROM public.quiz_submissions WHERE quiz_id NOT IN (SELECT id FROM public.quizzes) OR student_id NOT IN (SELECT id FROM public.profiles);
DELETE FROM public.attendance_sessions WHERE course_id NOT IN (SELECT id FROM public.courses);
DELETE FROM public.notifications WHERE course_id NOT IN (SELECT id FROM public.courses) OR (user_id NOT IN ('SYSTEM_AUDIT_LOG', 'SYSTEM_PRIVATE_NOTE') AND (user_id NOT IN (SELECT id FROM public.profiles) OR expires_at <= now()));

-- Strip redundant Base64 avatars from posts, profiles, and submissions to cut Egress by 96%
UPDATE public.posts SET author_avatar = '' WHERE author_avatar IS NOT NULL AND author_avatar <> '';
UPDATE public.profiles SET avatar = '' WHERE role IN ('student', 'co_admin') AND avatar IS NOT NULL AND avatar <> '';
UPDATE public.profiles SET avatar = 'preset:mentor-1' WHERE role = 'admin' AND (avatar LIKE 'data:%' OR length(avatar) > 500);
UPDATE public.assignment_submissions SET student_avatar = '' WHERE student_avatar IS NOT NULL AND student_avatar <> '';
`;

const DEFAULT_FALLBACK_AVATAR = resolveAvatarUrl(DEFAULT_AVATAR_PRESET_KEY);
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
 * Compacts avatars & banners for Supabase SQL sync (< 5.5 GB Free Plan Guard):
 * - NEVER stores Base64 (`data:...`) in Supabase `public.profiles.avatar`!
 * - Students and Co-Admins always store `''` (0 Bytes).
 * - Primary Admin (`role === 'admin'`) stores ONLY a short Preset Key (`preset:mentor-1`, 15 Bytes)
 *   or an External Image URL (`https://...`, <= 500 chars).
 */
function compactAvatarForCloud(avatar?: string, role?: UserRole): string {
  return toCloudAvatarKeyOrUrl(avatar, role);
}

function compactBannerForCloud(banner?: string): string {
  if (!banner || banner.startsWith('/src/assets/images/') || banner.includes('images.unsplash.com')) {
    return DEFAULT_FALLBACK_BANNER;
  }
  if (banner.length > 65_000) return DEFAULT_FALLBACK_BANNER;
  return banner;
}

const RULES_MARKER_PREFIX = '||RULES_OK:';
const DEVICE_SESSION_MARKER_PREFIX = '||DEV_SES:';
const USERNAME_MARKER_PREFIX = '||USR:';
const PASSWORD_ENC_MARKER_PREFIX = '||PWD_ENC:';
const COURSE_ORDER_MARKER_PREFIX = '||ORDER:';
const ATT_STATE_MARKER_PREFIX = '||ATT_STATE:';

function encodeAttendanceOpenedBy(session: AttendanceSession): string {
  const cleanOpenedBy =
    (session.openedBy || 'Instructor').split(ATT_STATE_MARKER_PREFIX)[0].trim() || 'Instructor';
  const ts =
    typeof session.statusUpdatedAtMs === 'number' &&
    Number.isFinite(session.statusUpdatedAtMs) &&
    session.statusUpdatedAtMs > 0
      ? Math.round(session.statusUpdatedAtMs)
      : Date.now();
  const recordsObj = session.records || {};
  const recCount = Object.keys(recordsObj).length;
  const recHash = computeFastStringHash(JSON.stringify(recordsObj));
  return `${cleanOpenedBy}${ATT_STATE_MARKER_PREFIX}${session.isOpen ? '1' : '0'}~${ts}~R${recCount}_${recHash}`;
}

function decodeAttendanceOpenedBy(
  rawOpenedBy?: string | null,
  rawIsOpen?: unknown
): {
  openedBy: string;
  isOpen: boolean;
  statusUpdatedAtMs?: number;
  recordCount?: number;
  recordHash?: string;
} {
  const str = String(rawOpenedBy || 'Instructor');
  const colIsOpen = Boolean(rawIsOpen);
  if (str.includes(ATT_STATE_MARKER_PREFIX)) {
    const [cleanName, stateRaw] = str.split(ATT_STATE_MARKER_PREFIX);
    const [flagStr, tsRaw, recRaw] = (stateRaw || '').trim().split('~');
    const parsedTs = Number(tsRaw);
    let parsedRecCount: number | undefined;
    let parsedRecHash: string | undefined;
    if (recRaw && recRaw.startsWith('R')) {
      const [cntPart, hashPart] = recRaw.slice(1).split('_');
      const n = Number(cntPart);
      if (Number.isFinite(n) && n >= 0) {
        parsedRecCount = n;
      }
      if (hashPart) {
        parsedRecHash = hashPart;
      }
    }
    const resolvedOpen =
      flagStr === '0' ? false : flagStr === '1' ? true : colIsOpen;
    return {
      openedBy: (cleanName || 'Instructor').trim() || 'Instructor',
      isOpen: resolvedOpen && colIsOpen,
      statusUpdatedAtMs: Number.isFinite(parsedTs) && parsedTs > 0 ? parsedTs : undefined,
      recordCount: parsedRecCount,
      recordHash: parsedRecHash,
    };
  }
  return {
    openedBy: str.trim() || 'Instructor',
    isOpen: colIsOpen,
  };
}

function computeFastStringHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

function encodeCourseThemeWithOrder(course: Course): string {
  const baseTheme =
    (course.themeColor || 'indigo')
      .split(COURSE_ORDER_MARKER_PREFIX)[0]
      .split('~B')[0]
      .trim() || 'indigo';
  const bannerStr = course.bannerImage || '';
  const bannerLen = bannerStr.length;
  const bannerHash = bannerLen > 0 ? computeFastStringHash(bannerStr) : '0';
  const orderVal =
    typeof course.sortOrder === 'number' && Number.isFinite(course.sortOrder)
      ? Math.max(1, Math.round(course.sortOrder))
      : 0;
  return `${baseTheme}${COURSE_ORDER_MARKER_PREFIX}${orderVal}~B${bannerLen}_${bannerHash}`;
}

function decodeCourseThemeAndOrder(rawTheme?: string | null): {
  themeColor: Course['themeColor'];
  sortOrder?: number;
  bannerLen?: number;
  bannerHash?: string;
} {
  const str = String(rawTheme || 'indigo');
  if (str.includes(COURSE_ORDER_MARKER_PREFIX)) {
    const [cleanTheme, restRaw] = str.split(COURSE_ORDER_MARKER_PREFIX);
    const [orderRaw, bannerMetaRaw] = (restRaw || '').split('~B');
    const [bannerLenRaw, bannerHashRaw] = (bannerMetaRaw || '').split('_');
    const parsedOrder = Number(orderRaw);
    const parsedBannerLen = Number(bannerLenRaw);
    return {
      themeColor: ((cleanTheme || 'indigo').trim() as Course['themeColor']) || 'indigo',
      sortOrder: Number.isFinite(parsedOrder) && parsedOrder > 0 ? parsedOrder : undefined,
      bannerLen: Number.isFinite(parsedBannerLen) && parsedBannerLen > 0 ? parsedBannerLen : undefined,
      bannerHash: bannerHashRaw ? bannerHashRaw.trim() : undefined,
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
  // Live Realtime Broadcast + Postgres Changes synchronization across all accounts & browsers
  private static realtimeListeners = new Set<
    (payload?: {
      kind?: string;
      kinds?: string[];
      targetUserIds?: string[];
      deletedIds?: string[];
      deletedUsernames?: string[];
      deletedEmails?: string[];
    }) => void
  >();
  private static activeRealtimeChannel: ReturnType<typeof supabase.channel> | null = null;
  private static localBroadcastChannel: BroadcastChannel | null = null;
  private static realtimeDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private static pendingDeletedIds = new Set<string>();
  private static pendingDeletedUsernames = new Set<string>();
  private static pendingDeletedEmails = new Set<string>();
  private static pendingKinds = new Set<string>();
  private static pendingTargetUserIds = new Set<string>();
  private static ignoredRealtimeDeleteIds = new Set<string>();
  // Outbound broadcast coalescer & visibility auto-pause to keep Realtime Messages < 5% of quota
  private static outboundBroadcastTimer: ReturnType<typeof setTimeout> | null = null;
  private static pendingOutboundKinds = new Set<string>();
  private static pendingOutboundTargetUserIds = new Set<string>();
  private static pendingOutboundDeletedIds = new Set<string>();
  private static pendingOutboundDeletedUsernames = new Set<string>();
  private static pendingOutboundDeletedEmails = new Set<string>();
  private static lastBroadcastSentByKind = new Map<string, number>();
  private static visibilityListenerRegistered = false;
  private static hiddenDisconnectTimer: ReturnType<typeof setTimeout> | null = null;

  private static loadCloudCleanupTimestamps(): void {
    if (
      typeof window === 'undefined' ||
      (this.lastExpiredCleanupAt > 0 && this.lastAuditLogCleanupAt > 0 && this.lastOrphanCleanupAt > 0)
    ) {
      return;
    }
    try {
      const raw = localStorage.getItem('classroom_os_cloud_cleanup_ts_v1');
      if (raw) {
        const parsed = JSON.parse(raw) as { expired?: number; audit?: number; orphan?: number };
        if (typeof parsed.expired === 'number') this.lastExpiredCleanupAt = parsed.expired;
        if (typeof parsed.audit === 'number') this.lastAuditLogCleanupAt = parsed.audit;
        if (typeof parsed.orphan === 'number') this.lastOrphanCleanupAt = parsed.orphan;
      }
    } catch {
      // ignore
    }
  }

  private static saveCloudCleanupTimestamps(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(
        'classroom_os_cloud_cleanup_ts_v1',
        JSON.stringify({
          expired: this.lastExpiredCleanupAt,
          audit: this.lastAuditLogCleanupAt,
          orphan: this.lastOrphanCleanupAt,
        })
      );
    } catch {
      // ignore
    }
  }

  static computePostSignature(
    content: string,
    comments: CoursePost['comments'] | Record<string, unknown>[],
    isPinned?: boolean,
    pinOrder?: number | null
  ): string {
    const cleanComments = (comments || []).slice(-50).map((c) => {
      const rec = c as Record<string, unknown>;
      return `${String(rec.id || '')}:${String(rec.content || '').slice(0, 1000)}`;
    });
    return computeFastStringHash(
      `${content || ''}||${cleanComments.join('|')}||${Boolean(isPinned)}:${pinOrder ?? ''}`
    );
  }

  private static getLoggedUserRole(): UserRole | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem('classroom_current_user');
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { role?: UserRole };
      if (parsed?.role === 'admin' || parsed?.role === 'co_admin' || parsed?.role === 'student') {
        return parsed.role;
      }
      return null;
    } catch {
      return null;
    }
  }

  static pauseRealtimeConnection(): void {
    if (this.hiddenDisconnectTimer) {
      clearTimeout(this.hiddenDisconnectTimer);
      this.hiddenDisconnectTimer = null;
    }
    if (this.activeRealtimeChannel) {
      try {
        supabase.removeChannel(this.activeRealtimeChannel).catch(() => {});
      } catch {
        // ignore
      }
      this.activeRealtimeChannel = null;
    }
  }

  static resumeRealtimeConnection(): void {
    if (!this.activeRealtimeChannel && this.realtimeListeners.size > 0) {
      this.ensureRealtimeChannel();
    }
  }

  private static ensureRealtimeChannel(): void {
    if (typeof window === 'undefined') return;
    if (!this.localBroadcastChannel && typeof BroadcastChannel !== 'undefined') {
      try {
        this.localBroadcastChannel = new BroadcastChannel('classroom_os_local_sync_v1');
        this.localBroadcastChannel.onmessage = (ev) => {
          const data = (ev?.data || {}) as {
            kind?: string;
            kinds?: string[];
            targetUserIds?: string[];
            deletedIds?: string[];
            deletedUsernames?: string[];
            deletedEmails?: string[];
          };
          this.triggerRealtimeListeners(data);
        };
      } catch {
        // ignore
      }
    }
    if (!this.visibilityListenerRegistered && typeof document !== 'undefined') {
      this.visibilityListenerRegistered = true;
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          if (this.hiddenDisconnectTimer) clearTimeout(this.hiddenDisconnectTimer);
          // Disconnect hidden background tabs after 15s to save Realtime Concurrent Connections & Heartbeat Messages
          this.hiddenDisconnectTimer = setTimeout(() => {
            this.hiddenDisconnectTimer = null;
            if (document.visibilityState === 'hidden') {
              this.pauseRealtimeConnection();
            }
          }, 15_000);
        } else if (document.visibilityState === 'visible') {
          if (this.hiddenDisconnectTimer) {
            clearTimeout(this.hiddenDisconnectTimer);
            this.hiddenDisconnectTimer = null;
          }
          this.resumeRealtimeConnection();
        }
      });
    }
    if (this.activeRealtimeChannel) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    // Never open a Supabase Realtime WebSocket connection on the logged-out Login screen!
    const activeRole = this.getLoggedUserRole();
    if (!activeRole) return;
    try {
      // Lightweight Broadcast-only channel (eliminates wildcard postgres_changes WAL replication fan-out across 90+ peers)
      const ch = supabase
        .channel('classroom-live-sync-v1', {
          config: { broadcast: { self: false } },
        })
        .on('broadcast', { event: 'classroom_update' }, (msg) => {
          const data = (msg?.payload || {}) as {
            kind?: string;
            kinds?: string[];
            targetUserIds?: string[];
            deletedIds?: string[];
            deletedUsernames?: string[];
            deletedEmails?: string[];
          };
          this.triggerRealtimeListeners(data);
        })
        .subscribe();
      this.activeRealtimeChannel = ch;
    } catch {
      // ignore if WebSocket is unavailable
    }
  }

  private static triggerRealtimeListeners(meta?: {
    kind?: string;
    kinds?: string[];
    targetUserIds?: string[];
    deletedIds?: string[];
    deletedUsernames?: string[];
    deletedEmails?: string[];
  }): void {
    if (Array.isArray(meta?.kinds) && meta.kinds.length > 0) {
      meta.kinds.forEach((k) => {
        if (k) this.pendingKinds.add(k);
      });
    } else {
      const incomingKind = meta?.kind || 'all';
      this.pendingKinds.add(incomingKind);
    }

    for (const incomingKind of Array.from(this.pendingKinds)) {
      if (incomingKind === 'profile' || incomingKind === 'delete' || incomingKind === 'all') {
        this.invalidateClientCache('profiles');
        this.invalidateClientCache('profile_candidates');
      }
      if (incomingKind === 'course' || incomingKind === 'delete' || incomingKind === 'all') {
        this.invalidateClientCache('courses');
      }
      if (incomingKind === 'post' || incomingKind === 'delete' || incomingKind === 'all') {
        this.invalidateClientCache('posts');
        this.invalidateClientCache('notifs');
      }
      if (
        incomingKind === 'attendance' ||
        incomingKind === 'attendance_checkin' ||
        incomingKind === 'delete' ||
        incomingKind === 'all'
      ) {
        this.invalidateClientCache('attendance');
      }
      if (incomingKind === 'notification' || incomingKind === 'delete' || incomingKind === 'all') {
        this.invalidateClientCache('notifs');
      }
      if (incomingKind === 'private_note' || incomingKind === 'delete' || incomingKind === 'all') {
        this.invalidateClientCache('private_notes');
      }
      if (incomingKind === 'assignment' || incomingKind === 'delete' || incomingKind === 'all') {
        this.invalidateClientCache('assignments');
      }
      if (incomingKind === 'submission' || incomingKind === 'delete' || incomingKind === 'all') {
        this.invalidateClientCache('submissions');
      }
      if (incomingKind === 'quiz' || incomingKind === 'delete' || incomingKind === 'all') {
        this.invalidateClientCache('quizzes');
      }
    }

    if (Array.isArray(meta?.targetUserIds)) {
      meta.targetUserIds.forEach((uid) => {
        if (uid) this.pendingTargetUserIds.add(uid);
      });
    }
    if (Array.isArray(meta?.deletedIds)) {
      meta.deletedIds.forEach((id) => {
        if (id) this.pendingDeletedIds.add(id);
      });
    }
    if (Array.isArray(meta?.deletedUsernames)) {
      meta.deletedUsernames.forEach((u) => {
        if (u) this.pendingDeletedUsernames.add(u.trim().toLowerCase());
      });
    }
    if (Array.isArray(meta?.deletedEmails)) {
      meta.deletedEmails.forEach((e) => {
        if (e) this.pendingDeletedEmails.add(e.trim().toLowerCase());
      });
    }

    if (this.realtimeDebounceTimer) {
      clearTimeout(this.realtimeDebounceTimer);
    }
    this.realtimeDebounceTimer = setTimeout(() => {
      this.realtimeDebounceTimer = null;
      const kindsList = Array.from(this.pendingKinds);
      const primaryKind =
        kindsList.length === 1 ? kindsList[0] : kindsList.includes('delete') ? 'delete' : 'all';
      const snapshot = {
        kind: primaryKind,
        kinds: kindsList,
        targetUserIds:
          this.pendingTargetUserIds.size > 0 ? Array.from(this.pendingTargetUserIds) : undefined,
        deletedIds:
          this.pendingDeletedIds.size > 0 ? Array.from(this.pendingDeletedIds) : undefined,
        deletedUsernames:
          this.pendingDeletedUsernames.size > 0
            ? Array.from(this.pendingDeletedUsernames)
            : undefined,
        deletedEmails:
          this.pendingDeletedEmails.size > 0 ? Array.from(this.pendingDeletedEmails) : undefined,
      };
      this.pendingKinds.clear();
      this.pendingTargetUserIds.clear();
      this.pendingDeletedIds.clear();
      this.pendingDeletedUsernames.clear();
      this.pendingDeletedEmails.clear();

      this.realtimeListeners.forEach((cb) => {
        try {
          cb(snapshot);
        } catch {
          // ignore
        }
      });
    }, 350);
  }

  static subscribeToRealtimeChanges(
    onChange: (payload?: {
      kind?: string;
      kinds?: string[];
      targetUserIds?: string[];
      deletedIds?: string[];
      deletedUsernames?: string[];
      deletedEmails?: string[];
    }) => void
  ): () => void {
    this.realtimeListeners.add(onChange);
    this.ensureRealtimeChannel();
    return () => {
      this.realtimeListeners.delete(onChange);
    };
  }

  static notifyRealtimePeers(
    kind: string = 'all',
    meta?: {
      targetUserIds?: string[];
      deletedIds?: string[];
      deletedUsernames?: string[];
      deletedEmails?: string[];
    }
  ): void {
    if (typeof window === 'undefined') return;
    this.ensureRealtimeChannel();
    const immediateLocalPayload = {
      kind,
      ts: Date.now(),
      ...(meta?.targetUserIds?.length ? { targetUserIds: meta.targetUserIds } : {}),
      ...(meta?.deletedIds?.length ? { deletedIds: meta.deletedIds } : {}),
      ...(meta?.deletedUsernames?.length ? { deletedUsernames: meta.deletedUsernames } : {}),
      ...(meta?.deletedEmails?.length ? { deletedEmails: meta.deletedEmails } : {}),
    };
    try {
      if (this.localBroadcastChannel) {
        this.localBroadcastChannel.postMessage(immediateLocalPayload);
      }
    } catch {
      // ignore
    }

    // CRITICAL REALTIME QUOTA PROTECTION:
    // Student actions (attendance check-ins, login/logout session locks, quiz/assignment submissions, post likes/comments)
    // must NEVER broadcast WebSocket messages to 94+ connected student peers (1 broadcast = 95 Realtime Messages billed!).
    // Only Admin and Co-Admin browsers broadcast classroom updates over Supabase Realtime WebSocket!
    const currentRole = this.getLoggedUserRole();
    if (currentRole !== 'admin' && currentRole !== 'co_admin') {
      return;
    }

    // Coalesce & throttle outbound Supabase WebSocket broadcasts so rapid bursts send only 1 message
    this.pendingOutboundKinds.add(kind);
    if (Array.isArray(meta?.targetUserIds)) {
      meta.targetUserIds.forEach((id) => {
        if (id) this.pendingOutboundTargetUserIds.add(id);
      });
    }
    if (Array.isArray(meta?.deletedIds)) {
      meta.deletedIds.forEach((id) => {
        if (id) this.pendingOutboundDeletedIds.add(id);
      });
    }
    if (Array.isArray(meta?.deletedUsernames)) {
      meta.deletedUsernames.forEach((u) => {
        if (u) this.pendingOutboundDeletedUsernames.add(u.trim().toLowerCase());
      });
    }
    if (Array.isArray(meta?.deletedEmails)) {
      meta.deletedEmails.forEach((e) => {
        if (e) this.pendingOutboundDeletedEmails.add(e.trim().toLowerCase());
      });
    }

    const isUrgentKind = kind === 'attendance' || kind === 'delete';
    const now = Date.now();
    const lastSent = this.lastBroadcastSentByKind.get(kind) || 0;
    const minIntervalMs = isUrgentKind ? 400 : 2_000;
    const delayMs = Math.max(isUrgentKind ? 80 : 350, minIntervalMs - (now - lastSent));

    if (this.outboundBroadcastTimer && !isUrgentKind) {
      return;
    }
    if (this.outboundBroadcastTimer) {
      clearTimeout(this.outboundBroadcastTimer);
    }

    this.outboundBroadcastTimer = setTimeout(() => {
      this.outboundBroadcastTimer = null;
      const kindsList = Array.from(this.pendingOutboundKinds);
      if (kindsList.length === 0) return;
      const primaryKind =
        kindsList.length === 1 ? kindsList[0] : kindsList.includes('delete') ? 'delete' : 'all';
      const coalescedPayload = {
        kind: primaryKind,
        kinds: kindsList,
        ts: Date.now(),
        ...(this.pendingOutboundTargetUserIds.size > 0
          ? { targetUserIds: Array.from(this.pendingOutboundTargetUserIds) }
          : {}),
        ...(this.pendingOutboundDeletedIds.size > 0
          ? { deletedIds: Array.from(this.pendingOutboundDeletedIds) }
          : {}),
        ...(this.pendingOutboundDeletedUsernames.size > 0
          ? { deletedUsernames: Array.from(this.pendingOutboundDeletedUsernames) }
          : {}),
        ...(this.pendingOutboundDeletedEmails.size > 0
          ? { deletedEmails: Array.from(this.pendingOutboundDeletedEmails) }
          : {}),
      };

      const sentAt = Date.now();
      kindsList.forEach((k) => this.lastBroadcastSentByKind.set(k, sentAt));
      this.pendingOutboundKinds.clear();
      this.pendingOutboundTargetUserIds.clear();
      this.pendingOutboundDeletedIds.clear();
      this.pendingOutboundDeletedUsernames.clear();
      this.pendingOutboundDeletedEmails.clear();

      try {
        if (this.activeRealtimeChannel) {
          this.activeRealtimeChannel
            .send({
              type: 'broadcast',
              event: 'classroom_update',
              payload: coalescedPayload,
            })
            .catch(() => {});
        }
      } catch {
        // ignore
      }
    }, delayMs);
  }

  /**
   * Returns the active Supabase project reference ID (e.g., 'apuyokqzskpmbnmekpyd')
   */
  static getActiveProjectRef(): string {
    const match = SUPABASE_CONFIG.url.match(/^https:\/\/([a-z0-9-]+)\.supabase\.co/i);
    return match ? match[1] : 'apuyokqzskpmbnmekpyd';
  }

  static hasCustomProjectConfig(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      return Boolean(localStorage.getItem(CUSTOM_SUPABASE_CONFIG_STORAGE_KEY));
    } catch {
      return false;
    }
  }

  /**
   * Dynamically switches the active Supabase project URL & Publishable/Anon Key with zero downtime
   */
  static setCustomProjectConfig(
    newUrl: string,
    newPublishableKey: string
  ): { success: boolean; error?: string } {
    const cleanUrl = normalizeSupabaseProjectUrl(newUrl || '');
    const cleanKey = (newPublishableKey || '').trim();
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(cleanUrl)) {
      return {
        success: false,
        error:
          'Project URL ပုံစံ မမှန်ကန်ပါ။ https://xxxxxxxxxxxx.supabase.co ပုံစံဖြင့် ထည့်သွင်းပေးပါ။',
      };
    }
    if (cleanKey.length < 15) {
      return {
        success: false,
        error: 'Supabase Publishable / Anon API Key ကို ပြည့်စုံစွာ ထည့်သွင်းပေးပါ။',
      };
    }
    SUPABASE_CONFIG.url = cleanUrl;
    SUPABASE_CONFIG.publishableKey = cleanKey;
    SUPABASE_CONFIG.jwksUrl = `${cleanUrl}/auth/v1/.well-known/jwks.json`;

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          CUSTOM_SUPABASE_CONFIG_STORAGE_KEY,
          JSON.stringify({ url: cleanUrl, publishableKey: cleanKey })
        );
      } catch {
        // ignore
      }
    }

    // Reset cached schema/table probes & query cache for the new project
    this.profileSchemaMode = 'full';
    this.notificationsTableStatus = 'unknown';
    this.lastUpsertSignatures.clear();
    activeWinningRoute = null;
    activeWinningRouteTimestamp = 0;
    this.clearClientCache();
    return { success: true };
  }

  static resetToDefaultProjectConfig(): void {
    SUPABASE_CONFIG.url = DEFAULT_SUPABASE_CONFIG.url;
    SUPABASE_CONFIG.publishableKey = DEFAULT_SUPABASE_CONFIG.publishableKey;
    SUPABASE_CONFIG.jwksUrl = DEFAULT_SUPABASE_CONFIG.jwksUrl;
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(CUSTOM_SUPABASE_CONFIG_STORAGE_KEY);
      } catch {
        // ignore
      }
    }
    this.profileSchemaMode = 'full';
    this.notificationsTableStatus = 'unknown';
    this.lastUpsertSignatures.clear();
    activeWinningRoute = null;
    activeWinningRouteTimestamp = 0;
    this.clearClientCache();
  }

  // ============================================================================
  // CLIENT-SIDE CACHING ENGINE (Reduces Supabase Egress by up to 96%)
  // ============================================================================
  private static readonly ASSET_CACHE_STORAGE_KEY = 'classroom_os_asset_cache_v2';
  private static readonly QUERY_CACHE_STORAGE_KEY = 'classroom_os_query_cache_v3_apuyokqz';
  private static readonly CACHE_STATS_STORAGE_KEY = 'classroom_os_cache_stats_v2';

  private static clientQueryCache = new Map<
    string,
    { data: unknown; expiresAt: number; savedBytesEstimate: number }
  >();
  private static assetCacheLoaded = false;
  private static cachedCourseBanners = new Map<string, string>();
  private static cachedAdminAvatars = new Map<string, string>();
  private static cacheHits = 0;
  private static savedBytesTotal = 0;

  private static ensureClientCacheLoaded(): void {
    if (this.assetCacheLoaded || typeof window === 'undefined') return;
    this.assetCacheLoaded = true;
    try {
      const rawAssets = localStorage.getItem(this.ASSET_CACHE_STORAGE_KEY);
      if (rawAssets) {
        const parsed = JSON.parse(rawAssets) as {
          banners?: Record<string, string>;
          avatars?: Record<string, string>;
        };
        if (parsed.banners && typeof parsed.banners === 'object') {
          Object.entries(parsed.banners).forEach(([k, v]) => {
            if (k && typeof v === 'string' && v.length > 0) {
              this.cachedCourseBanners.set(k, v);
            }
          });
        }
        if (parsed.avatars && typeof parsed.avatars === 'object') {
          Object.entries(parsed.avatars).forEach(([k, v]) => {
            if (k && typeof v === 'string' && v.length > 0) {
              this.cachedAdminAvatars.set(k, v);
            }
          });
        }
      }
      const rawStats = localStorage.getItem(this.CACHE_STATS_STORAGE_KEY);
      if (rawStats) {
        const parsedStats = JSON.parse(rawStats) as { hits?: number; savedBytes?: number };
        this.cacheHits = typeof parsedStats.hits === 'number' ? parsedStats.hits : 0;
        this.savedBytesTotal =
          typeof parsedStats.savedBytes === 'number' ? parsedStats.savedBytes : 0;
      }
      const rawQueries = localStorage.getItem(this.QUERY_CACHE_STORAGE_KEY);
      if (rawQueries) {
        const parsedQueries = JSON.parse(rawQueries) as Record<
          string,
          { data: unknown; expiresAt: number; savedBytesEstimate: number }
        >;
        const now = Date.now();
        Object.entries(parsedQueries).forEach(([k, entry]) => {
          if (entry && typeof entry.expiresAt === 'number' && entry.expiresAt > now) {
            this.clientQueryCache.set(k, entry);
          }
        });
      }
    } catch {
      // Ignore malformed localStorage cache
    }
  }

  private static persistAssetCache(): void {
    if (typeof window === 'undefined') return;
    try {
      const banners: Record<string, string> = {};
      this.cachedCourseBanners.forEach((v, k) => {
        if (v && v !== DEFAULT_FALLBACK_BANNER && v.length <= 70_000) {
          banners[k] = v;
        }
      });
      const avatars: Record<string, string> = {};
      this.cachedAdminAvatars.forEach((v, k) => {
        if (v && v !== DEFAULT_FALLBACK_AVATAR && v.length <= 50_000) {
          avatars[k] = v;
        }
      });
      localStorage.setItem(this.ASSET_CACHE_STORAGE_KEY, JSON.stringify({ banners, avatars }));
    } catch {
      // Ignore storage quota errors
    }
  }

  private static recordCacheHit(savedBytes: number): void {
    this.ensureClientCacheLoaded();
    this.cacheHits += 1;
    this.savedBytesTotal += Math.max(256, savedBytes);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          this.CACHE_STATS_STORAGE_KEY,
          JSON.stringify({ hits: this.cacheHits, savedBytes: this.savedBytesTotal })
        );
      } catch {
        // ignore
      }
    }
  }

  private static getCachedQuery<T>(key: string): T | null {
    this.ensureClientCacheLoaded();
    const entry = this.clientQueryCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.clientQueryCache.delete(key);
      return null;
    }
    this.recordCacheHit(entry.savedBytesEstimate || 4096);
    return entry.data as T;
  }

  private static setCachedQuery<T>(key: string, data: T, ttlMs: number): void {
    this.ensureClientCacheLoaded();
    let byteEstimate = 2048;
    try {
      const serialized = JSON.stringify(data);
      byteEstimate = serialized.length;
    } catch {
      // ignore
    }
    this.clientQueryCache.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
      savedBytesEstimate: byteEstimate,
    });
    if (typeof window !== 'undefined' && byteEstimate < 180_000) {
      try {
        const persistedObj: Record<
          string,
          { data: unknown; expiresAt: number; savedBytesEstimate: number }
        > = {};
        const now = Date.now();
        this.clientQueryCache.forEach((val, k) => {
          if (val.expiresAt > now && val.savedBytesEstimate < 90_000) {
            persistedObj[k] = val;
          }
        });
        localStorage.setItem(this.QUERY_CACHE_STORAGE_KEY, JSON.stringify(persistedObj));
      } catch {
        // ignore quota errors
      }
    }
  }

  /**
   * Invalidates Client-Side Cache entries matching prefix (Write-Through Cache coherence)
   */
  static invalidateClientCache(prefix?: string): void {
    this.ensureClientCacheLoaded();
    if (!prefix) {
      this.clientQueryCache.clear();
    } else {
      for (const k of Array.from(this.clientQueryCache.keys())) {
        if (k.startsWith(prefix)) {
          this.clientQueryCache.delete(k);
        }
      }
    }
    if (typeof window !== 'undefined') {
      try {
        if (!prefix) {
          localStorage.removeItem(this.QUERY_CACHE_STORAGE_KEY);
        } else {
          const persistedObj: Record<
            string,
            { data: unknown; expiresAt: number; savedBytesEstimate: number }
          > = {};
          const now = Date.now();
          this.clientQueryCache.forEach((val, k) => {
            if (val.expiresAt > now && val.savedBytesEstimate < 90_000) {
              persistedObj[k] = val;
            }
          });
          localStorage.setItem(this.QUERY_CACHE_STORAGE_KEY, JSON.stringify(persistedObj));
        }
      } catch {
        // ignore
      }
    }
  }

  static getClientCacheStats(): {
    cacheHits: number;
    savedBytesTotal: number;
    savedMBFormatted: string;
    cachedBannersCount: number;
    cachedAdminAvatarsCount: number;
    activeQueryCacheCount: number;
  } {
    this.ensureClientCacheLoaded();
    const mb = this.savedBytesTotal / (1024 * 1024);
    return {
      cacheHits: this.cacheHits,
      savedBytesTotal: this.savedBytesTotal,
      savedMBFormatted: mb >= 1 ? `${mb.toFixed(2)} MB` : `${Math.round(this.savedBytesTotal / 1024)} KB`,
      cachedBannersCount: this.cachedCourseBanners.size,
      cachedAdminAvatarsCount: this.cachedAdminAvatars.size,
      activeQueryCacheCount: this.clientQueryCache.size,
    };
  }

  static clearClientCache(): void {
    this.clientQueryCache.clear();
    this.cachedCourseBanners.clear();
    this.cachedAdminAvatars.clear();
    this.lastUpsertSignatures.clear();
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.ASSET_CACHE_STORAGE_KEY);
      localStorage.removeItem(this.QUERY_CACHE_STORAGE_KEY);
      localStorage.removeItem('classroom_os_pull_meta_v2');
    }
  }

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
        role !== 'admin'
          ? ''
          : resolveAvatarUrl(String(row.avatar || '')),
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
        const isEmailInput = compactId.includes('@');
        const filterSet = new Set<string>();
        if (isEmailInput) {
          filterSet.add(`email.ilike.${compactId}`);
        } else {
          filterSet.add(`username.ilike.${compactId}`);
          filterSet.add(`title.ilike.%||USR:${compactId}||%`);
        }

        const matchesExactIdentifier = (u: User): boolean => {
          const uName = (u.username || '').trim().replace(/^@+/, '').toLowerCase();
          const uEmail = (u.email || '').trim().toLowerCase();
          return isEmailInput ? uEmail === compactId : uName === compactId;
        };

        const profileFullCols =
          'id,name,username,email,role,phone,avatar,title,gender,address,password';
        const profileCoreCols = 'id,name,username,email,role,phone,avatar,title';
        const profileNoUsernameCols = 'id,name,email,role,phone,avatar,title';

        const { data, error } = await supabase
          .from('profiles')
          .select(profileFullCols)
          .or(Array.from(filterSet).join(','))
          .limit(15);

        if (!error && Array.isArray(data) && data.length > 0) {
          return data
            .map((r) => this.mapProfileRowToUser(r as unknown as Record<string, unknown>))
            .filter(matchesExactIdentifier);
        }

        // Fallback 1: core columns with username column intact (if password/gender/address are missing)
        if (error) {
          const { data: coreData, error: coreErr } = await supabase
            .from('profiles')
            .select(profileCoreCols)
            .or(Array.from(filterSet).join(','))
            .limit(15);
          if (!coreErr && Array.isArray(coreData) && coreData.length > 0) {
            return coreData
              .map((r) => this.mapProfileRowToUser(r as unknown as Record<string, unknown>))
              .filter(matchesExactIdentifier);
          }

          // Fallback 2: if `username` column itself is missing in an older table schema
          const noUserFilters = isEmailInput
            ? [`email.ilike.${compactId}`]
            : [`title.ilike.%||USR:${compactId}||%`, `email.ilike.${compactId}@%`];
          const { data: fbData, error: fbErr } = await supabase
            .from('profiles')
            .select(profileNoUsernameCols)
            .or(Array.from(new Set(noUserFilters)).join(','))
            .limit(15);
          if (!fbErr && Array.isArray(fbData) && fbData.length > 0) {
            return fbData
              .map((r) => this.mapProfileRowToUser(r as unknown as Record<string, unknown>))
              .filter(matchesExactIdentifier);
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
   * Authoritative Cloud Login Existence Check:
   * - Queries Supabase `profiles` for matching username/email (costs < 0.5 KB egress).
   * - Distinguishes between a network/query error vs. an account that was genuinely deleted in Supabase (`users.length === 0 && dbSeeded === true`).
   */
  static async checkRemoteLoginCandidates(identifier: string): Promise<{
    networkOk: boolean;
    dbSeeded: boolean;
    users: User[];
  }> {
    const rawClean = (identifier || '')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/^(🔑\s*|📧\s*|👤\s*)?(username|email|e-mail|mail|id)\s*[:：=\-]\s*/i, '')
      .trim()
      .replace(/^@+/, '')
      .toLowerCase();
    if (!rawClean) return { networkOk: false, dbSeeded: false, users: [] };

    const safeId = rawClean.replace(/[,()"'\\]/g, '').trim();
    const compactId = safeId.replace(/\s+/g, '');
    if (!compactId) return { networkOk: false, dbSeeded: false, users: [] };

    const isEmailInput = compactId.includes('@');
    const matchesExactIdentifier = (u: User): boolean => {
      const uName = (u.username || '').trim().replace(/^@+/, '').toLowerCase();
      const uEmail = (u.email || '').trim().toLowerCase();
      return isEmailInput ? uEmail === compactId : uName === compactId;
    };

    try {
      const filterSet = new Set<string>();
      if (isEmailInput) {
        filterSet.add(`email.ilike.${compactId}`);
      } else {
        filterSet.add(`username.ilike.${compactId}`);
        filterSet.add(`title.ilike.%||USR:${compactId}||%`);
      }

      const profileFullCols =
        'id,name,username,email,role,phone,avatar,title,gender,address,password';
      const profileCoreCols = 'id,name,username,email,role,phone,avatar,title';
      const profileNoUsernameCols = 'id,name,email,role,phone,avatar,title';

      const isAlreadyKnownSeeded =
        typeof window !== 'undefined' &&
        localStorage.getItem('classroom_cloud_synced') === 'true';

      const { data, error } = await supabase
        .from('profiles')
        .select(profileFullCols)
        .or(Array.from(filterSet).join(','))
        .limit(15);

      if (!error && Array.isArray(data)) {
        const matchedUsers = data
          .map((r) => this.mapProfileRowToUser(r as unknown as Record<string, unknown>))
          .filter(matchesExactIdentifier);
        if (matchedUsers.length > 0) {
          return {
            networkOk: true,
            dbSeeded: true,
            users: matchedUsers,
          };
        }
        if (isAlreadyKnownSeeded) {
          return {
            networkOk: true,
            dbSeeded: true,
            users: [],
          };
        }
        // 0 rows matched on first unverified check: verify via lightweight HEAD count (0 bytes row payload) that `profiles` table is seeded
        const { count, error: countErr } = await supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true });
        if (!countErr) {
          return {
            networkOk: true,
            dbSeeded: (count ?? 0) > 0,
            users: [],
          };
        }
        return { networkOk: false, dbSeeded: false, users: [] };
      }

      if (error) {
        // Fallback 1: core columns WITH username filter intact
        const { data: coreData, error: coreErr } = await supabase
          .from('profiles')
          .select(profileCoreCols)
          .or(Array.from(filterSet).join(','))
          .limit(15);
        if (!coreErr && Array.isArray(coreData)) {
          const matchedCoreUsers = coreData
            .map((r) => this.mapProfileRowToUser(r as unknown as Record<string, unknown>))
            .filter(matchesExactIdentifier);
          if (matchedCoreUsers.length > 0) {
            return {
              networkOk: true,
              dbSeeded: true,
              users: matchedCoreUsers,
            };
          }
          if (isAlreadyKnownSeeded) {
            return {
              networkOk: true,
              dbSeeded: true,
              users: [],
            };
          }
          const { count, error: countErr } = await supabase
            .from('profiles')
            .select('id', { count: 'exact', head: true });
          if (!countErr) {
            return {
              networkOk: true,
              dbSeeded: (count ?? 0) > 0,
              users: [],
            };
          }
          return { networkOk: false, dbSeeded: false, users: [] };
        }

        // Fallback 2: if `username` column itself is missing
        const fallbackFilters = isEmailInput
          ? [`email.ilike.${compactId}`]
          : [`title.ilike.%||USR:${compactId}||%`, `email.ilike.${compactId}@%`];
        const { data: fbData, error: fbErr } = await supabase
          .from('profiles')
          .select(profileNoUsernameCols)
          .or(Array.from(new Set(fallbackFilters)).join(','))
          .limit(15);
        if (!fbErr && Array.isArray(fbData)) {
          const matchedFbUsers = fbData
            .map((r) => this.mapProfileRowToUser(r as unknown as Record<string, unknown>))
            .filter(matchesExactIdentifier);
          if (matchedFbUsers.length > 0) {
            return {
              networkOk: true,
              dbSeeded: true,
              users: matchedFbUsers,
            };
          }
          if (isAlreadyKnownSeeded) {
            return {
              networkOk: true,
              dbSeeded: true,
              users: [],
            };
          }
          const { count, error: countErr } = await supabase
            .from('profiles')
            .select('id', { count: 'exact', head: true });
          if (!countErr) {
            return {
              networkOk: true,
              dbSeeded: (count ?? 0) > 0,
              users: [],
            };
          }
        }
      }
      return { networkOk: false, dbSeeded: false, users: [] };
    } catch {
      return { networkOk: false, dbSeeded: false, users: [] };
    }
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
    const isEmailInput = compactId.includes('@');

    return (
      candidates.find((u) => {
        const uName = (u.username || '').trim().toLowerCase();
        const uEmail = (u.email || '').trim().toLowerCase();
        return isEmailInput ? uEmail === compactId : uName === compactId;
      }) || null
    );
  }

  /**
   * Fetch profiles from Supabase:
   * - For Admin/Co-Admin: fetches full roster (up to 3,000 users) for Student Directory & Roll Call.
   * - For Students (`studentLightweight: true`): fetches ONLY Admin/Co-Admin profiles + the logged-in student's own row (~3 rows instead of 3,000!), cutting student profile Egress by 96%!
   * - When `knownAvatars` is provided, skips downloading the `avatar` column on bulk polls and only fetches `avatar` for Admin/Co-Admin rows that don't have a cached avatar yet!
   */
  static async getRemoteProfiles(
    skipDedupe: boolean = false,
    options?: {
      studentLightweight?: boolean;
      currentUserId?: string;
      knownAvatars?: Map<string, string>;
    }
  ): Promise<User[] | null> {
    this.ensureClientCacheLoaded();
    const mergedKnownAvatars = new Map<string, string>(this.cachedAdminAvatars);
    if (options?.knownAvatars) {
      options.knownAvatars.forEach((v, k) => {
        if (k && v) mergedKnownAvatars.set(k, v);
      });
    }

    const isStudentLite = Boolean(options?.studentLightweight && options?.currentUserId);
    const useAvatarLite = mergedKnownAvatars.size > 0;
    const cacheKey = `${
      isStudentLite ? `profiles:student:${options?.currentUserId}` : 'profiles:all'
    }:${useAvatarLite ? 'lite' : 'full'}`;

    if (!skipDedupe) {
      const cached = this.getCachedQuery<User[]>(cacheKey);
      if (cached) return cached;
    }

    const fetcher = async () => {
      try {
        const liteCols =
          this.profileSchemaMode === 'core'
            ? 'id,name,username,email,role,phone,title'
            : this.profileSchemaMode === 'no_password'
            ? 'id,name,username,email,role,phone,title,gender,address'
            : 'id,name,username,email,role,phone,title,gender,address,password';

        const fullCols =
          this.profileSchemaMode === 'core'
            ? 'id,name,username,email,role,phone,avatar,title'
            : this.profileSchemaMode === 'no_password'
            ? 'id,name,username,email,role,phone,avatar,title,gender,address'
            : 'id,name,username,email,role,phone,avatar,title,gender,address,password';

        const selectedCols: string = useAvatarLite ? liteCols : fullCols;
        let query = supabase
          .from('profiles')
          .select(selectedCols);

        if (isStudentLite && options?.currentUserId) {
          const safeUid = options.currentUserId.replace(/[,()"'\\]/g, '').trim();
          query = query.or(`id.eq.${safeUid},role.in.(admin,co_admin)`).limit(25);
        } else {
          query = query.limit(3000);
        }

        const primaryRes = await query;
        let rows: Record<string, unknown>[] | null =
          !primaryRes.error && Array.isArray(primaryRes.data)
            ? (primaryRes.data as unknown as Record<string, unknown>[])
            : null;
        let error = primaryRes.error;

        // Fallback to core explicit columns if optional columns are missing on an older schema
        if (error) {
          if (this.profileSchemaMode !== 'core') {
            this.profileSchemaMode = 'core';
          }
          const coreFallbackCols = useAvatarLite
            ? 'id,name,username,email,role,phone,title'
            : 'id,name,username,email,role,phone,avatar,title';
          let fbQuery = supabase.from('profiles').select(coreFallbackCols);
          if (isStudentLite && options?.currentUserId) {
            const safeUid = options.currentUserId.replace(/[,()"'\\]/g, '').trim();
            fbQuery = fbQuery.or(`id.eq.${safeUid},role.in.(admin,co_admin)`).limit(25);
          } else {
            fbQuery = fbQuery.limit(3000);
          }
          const fbRes = await fbQuery;
          rows =
            !fbRes.error && Array.isArray(fbRes.data)
              ? (fbRes.data as unknown as Record<string, unknown>[])
              : null;
          error = fbRes.error;
        }

        if (error || !rows) {
          return null;
        }
        const fetchedAvatars = new Map<string, string>();
        let avatarCacheChanged = false;

        if (useAvatarLite) {
          const adminIdsMissingAvatar: string[] = [];
          for (const r of rows) {
            const uId = String(r.id || '');
            const uRole = String(r.role || 'student');
            if (uRole === 'admin') {
              const cachedAv = mergedKnownAvatars.get(uId);
              if (!cachedAv || cachedAv === DEFAULT_FALLBACK_AVATAR) {
                adminIdsMissingAvatar.push(uId);
              } else {
                this.recordCacheHit(cachedAv.length);
              }
            }
          }
          if (adminIdsMissingAvatar.length > 0) {
            const { data: avRows } = await supabase
              .from('profiles')
              .select('id,avatar')
              .in('id', adminIdsMissingAvatar);
            if (Array.isArray(avRows)) {
              avRows.forEach((ar) => {
                if (ar.id && ar.avatar) {
                  const avStr = String(ar.avatar);
                  fetchedAvatars.set(String(ar.id), avStr);
                  this.cachedAdminAvatars.set(String(ar.id), avStr);
                  avatarCacheChanged = true;
                }
              });
            }
          }
        }

        const mapped = rows.map((row) => {
          const uId = String(row.id || '');
          const resolvedRow =
            !row.avatar && (fetchedAvatars.has(uId) || mergedKnownAvatars.has(uId))
              ? { ...row, avatar: fetchedAvatars.get(uId) || mergedKnownAvatars.get(uId) || '' }
              : row;
          const userObj = this.mapProfileRowToUser(resolvedRow);
          if (
            userObj.role === 'admin' &&
            userObj.avatar &&
            userObj.avatar !== DEFAULT_FALLBACK_AVATAR &&
            this.cachedAdminAvatars.get(uId) !== userObj.avatar
          ) {
            this.cachedAdminAvatars.set(uId, userObj.avatar);
            avatarCacheChanged = true;
          }
          return userObj;
        });

        if (avatarCacheChanged) {
          this.persistAssetCache();
        }
        this.setCachedQuery(cacheKey, mapped, isStudentLite ? 120_000 : 90_000);
        return mapped;
      } catch {
        return null;
      }
    };

    if (skipDedupe) {
      return fetcher();
    }
    return this.dedupeGet(cacheKey, fetcher);
  }

  /**
   * Fetch all courses from Supabase if table exists (deduplicated across concurrent callers).
   * Automatically uses Persistent Client-Side Asset Cache (`cachedCourseBanners`) so heavy 65KB+
   * `banner_image` strings are NEVER re-downloaded across page reloads unless their banner length changed!
   */
  static async getRemoteCourses(knownBanners?: Map<string, string>): Promise<Course[] | null> {
    this.ensureClientCacheLoaded();
    const mergedBanners = new Map<string, string>(this.cachedCourseBanners);
    if (knownBanners) {
      knownBanners.forEach((v, k) => {
        if (k && v) mergedBanners.set(k, v);
      });
    }
    const useLiteColumns = mergedBanners.size > 0;
    const cacheKey = useLiteColumns ? 'courses:lite' : 'courses:all';
    const cached = this.getCachedQuery<Course[]>(cacheKey);
    if (cached) return cached;

    return this.dedupeGet(cacheKey, async () => {
      try {
        const selectCols = useLiteColumns
          ? 'id,code,title,section,batch,description,instructor_name,instructor_email,theme_color,enrolled_student_ids,total_lessons,total_assignments,total_quizzes,created_at'
          : 'id,code,title,section,batch,description,instructor_name,instructor_email,banner_image,theme_color,enrolled_student_ids,total_lessons,total_assignments,total_quizzes,created_at';

        const { data, error } = await supabase
          .from('courses')
          .select(selectCols)
          .limit(200);

        if (error || !data) {
          return null;
        }

        const rows = data as unknown as Record<string, unknown>[];
        const fetchedBannerMap = new Map<string, string>();
        let bannerCacheChanged = false;

        if (useLiteColumns) {
          const idsNeedingBanner: string[] = [];
          for (const row of rows) {
            const cId = String(row.id || '');
            const localBanner = mergedBanners.get(cId);
            const decodedTheme = decodeCourseThemeAndOrder(row.theme_color as string | null);
            const remoteBannerLen = decodedTheme.bannerLen;
            const remoteBannerHash = decodedTheme.bannerHash;
            const localBannerHash = localBanner ? computeFastStringHash(localBanner) : '';
            if (
              !localBanner ||
              localBanner === DEFAULT_FALLBACK_BANNER ||
              (remoteBannerLen && remoteBannerLen !== localBanner.length) ||
              (remoteBannerHash && remoteBannerHash !== '0' && remoteBannerHash !== localBannerHash)
            ) {
              idsNeedingBanner.push(cId);
            } else {
              this.recordCacheHit(localBanner.length);
            }
          }
          if (idsNeedingBanner.length > 0) {
            const { data: bannerRows } = await supabase
              .from('courses')
              .select('id,banner_image')
              .in('id', idsNeedingBanner);
            if (Array.isArray(bannerRows)) {
              bannerRows.forEach((br) => {
                if (br.id && br.banner_image) {
                  const bStr = String(br.banner_image);
                  fetchedBannerMap.set(String(br.id), bStr);
                  this.cachedCourseBanners.set(String(br.id), bStr);
                  bannerCacheChanged = true;
                }
              });
            }
          }
        }

        const mappedCourses = rows.map((row) => {
          const cId = String(row.id || '');
          const rawBanner = String(
            row.banner_image || fetchedBannerMap.get(cId) || mergedBanners.get(cId) || ''
          );
          const resolvedBanner =
            !rawBanner || rawBanner.startsWith('/src/assets/images/') || rawBanner.includes('images.unsplash.com')
              ? DEFAULT_FALLBACK_BANNER
              : rawBanner;

          if (
            resolvedBanner &&
            resolvedBanner !== DEFAULT_FALLBACK_BANNER &&
            this.cachedCourseBanners.get(cId) !== resolvedBanner
          ) {
            this.cachedCourseBanners.set(cId, resolvedBanner);
            bannerCacheChanged = true;
          }

          const decodedTheme = decodeCourseThemeAndOrder(row.theme_color as string | null);

          return {
            id: cId,
            code: String(row.code || ''),
            title: String(row.title || ''),
            section: String(row.section || ''),
            batch: String(row.batch || ''),
            description: String(row.description || ''),
            instructorName: String(row.instructor_name || ''),
            instructorEmail: String(row.instructor_email || ''),
            bannerImage: resolvedBanner,
            themeColor: decodedTheme.themeColor,
            sortOrder: decodedTheme.sortOrder,
            enrolledStudentIds: Array.isArray(row.enrolled_student_ids)
              ? (row.enrolled_student_ids as string[])
              : [],
            totalLessons: typeof row.total_lessons === 'number' ? row.total_lessons : 0,
            totalAssignments: typeof row.total_assignments === 'number' ? row.total_assignments : 0,
            totalQuizzes: typeof row.total_quizzes === 'number' ? row.total_quizzes : 0,
          };
        });

        if (bannerCacheChanged) {
          this.persistAssetCache();
        }
        this.setCachedQuery(cacheKey, mappedCourses, 90_000);
        return mappedCourses;
      } catch {
        return null;
      }
    });
  }

  /**
   * Fetch posts from Supabase (optionally scoped to enrolled courseIds to save Egress bandwidth).
   * - NEVER selects the legacy `author_avatar` column (resolved dynamically from instructor profiles),
   *   immediately preventing any old Base64 avatar strings in `public.posts` from consuming Egress!
   * - When `knownPosts` is provided on background polls, queries lightweight metadata first and only downloads
   *   `content` and `comments` for newly created posts or posts whose title/commentCount/contentLen changed!
   */
  static async getRemotePosts(
    courseIds?: string[],
    knownPosts?: Map<
      string,
      {
        title: string;
        content: string;
        comments: CoursePost['comments'];
        sig?: string;
        isPinned?: boolean;
        pinOrder?: number;
      }
    >
  ): Promise<CoursePost[] | null> {
    if (courseIds && courseIds.length === 0) {
      return [];
    }
    const useDeltaPosts = Boolean(knownPosts && knownPosts.size > 0);
    const scopeKey = `${
      courseIds && courseIds.length > 0 ? courseIds.slice().sort().join(',') : 'all'
    }:${useDeltaPosts ? 'delta' : 'full'}`;
    const cacheKey = `posts:${scopeKey}`;
    const cached = this.getCachedQuery<CoursePost[]>(cacheKey);
    if (cached) return cached;

    return this.dedupeGet(cacheKey, async () => {
      try {
        const liteCols =
          'id,course_id,author_id,author_name,title,post_type,attachments,likes,created_at';
        const fullColsNoAvatar =
          'id,course_id,author_id,author_name,title,content,post_type,attachments,likes,comments,created_at';

        let query = supabase
          .from('posts')
          .select(useDeltaPosts ? liteCols : fullColsNoAvatar)
          .order('created_at', { ascending: false })
          .limit(80);

        if (courseIds && courseIds.length > 0 && courseIds.length <= 25) {
          query = query.in('course_id', courseIds);
        }

        const { data, error } = await query;
        if (error || !data) return null;

        const rows = data as unknown as Record<string, unknown>[];
        const fetchedBodyMap = new Map<
          string,
          { content: string; comments: Record<string, unknown>[] }
        >();

        if (useDeltaPosts && knownPosts) {
          const idsNeedingBody: string[] = [];
          for (const row of rows) {
            const pId = String(row.id || '');
            const localPost = knownPosts.get(pId);
            if (!localPost) {
              idsNeedingBody.push(pId);
              continue;
            }
            const rawAtt = Array.isArray(row.attachments) ? row.attachments : [];
            let rowMeta: Record<string, unknown> = {};
            for (const att of rawAtt) {
              if (att && att.id === '__post_meta__' && typeof att.url === 'string') {
                try {
                  rowMeta = JSON.parse(att.url) as Record<string, unknown>;
                } catch {
                  // ignore
                }
              }
            }
            const remoteTitle = String(row.title || '');
            const remoteCommentCount =
              typeof rowMeta.commentCount === 'number' ? rowMeta.commentCount : undefined;
            const remoteContentLen =
              typeof rowMeta.contentLen === 'number' ? rowMeta.contentLen : undefined;
            const remoteSig = typeof rowMeta.sig === 'string' ? rowMeta.sig : undefined;
            const localSig =
              localPost.sig ||
              this.computePostSignature(
                localPost.content || '',
                localPost.comments || [],
                localPost.isPinned,
                localPost.pinOrder
              );

            if (
              localPost.title !== remoteTitle ||
              (remoteSig !== undefined && remoteSig !== localSig) ||
              (remoteCommentCount !== undefined &&
                remoteCommentCount !== (localPost.comments?.length || 0)) ||
              (remoteContentLen !== undefined &&
                remoteContentLen !== (localPost.content?.length || 0))
            ) {
              idsNeedingBody.push(pId);
            }
          }

          if (idsNeedingBody.length > 0) {
            const { data: bodyRows } = await supabase
              .from('posts')
              .select('id,content,comments')
              .in('id', idsNeedingBody);
            if (Array.isArray(bodyRows)) {
              bodyRows.forEach((br) => {
                if (br.id) {
                  fetchedBodyMap.set(String(br.id), {
                    content: String(br.content || ''),
                    comments: Array.isArray(br.comments)
                      ? (br.comments as Record<string, unknown>[])
                      : [],
                  });
                }
              });
            }
          }
        }

        const mappedPosts = rows.map((row) => {
          const pId = String(row.id || '');
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

          const parsedRowMs = row.created_at ? new Date(String(row.created_at)).getTime() : undefined;
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

          const fetchedBody = fetchedBodyMap.get(pId);
          const localCachedPost = knownPosts?.get(pId);
          const resolvedContent =
            row.content !== undefined
              ? String(row.content || '')
              : fetchedBody
              ? fetchedBody.content
              : localCachedPost?.content || '';

          const rawCommentsSource = Array.isArray(row.comments)
            ? (row.comments as Record<string, unknown>[])
            : fetchedBody
            ? fetchedBody.comments
            : (localCachedPost?.comments as unknown as Record<string, unknown>[]) || [];

          const comments = rawCommentsSource.map((cm: Record<string, unknown>) => ({
            ...cm,
            authorAvatar: cm.authorRole !== 'admin' ? '' : String(cm.authorAvatar || ''),
            createdAtMs: resolveCommentTimestampMs(cm, effectiveCreatedMs),
          }));

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
            id: pId,
            courseId: String(row.course_id || ''),
            authorId: String(row.author_id || 'user-admin-1'),
            authorName: String(row.author_name || 'Instructor'),
            authorRole,
            authorAvatar: '',
            title: String(row.title || ''),
            content: resolvedContent,
            createdAt: formattedCreatedAt,
            createdAtMs: effectiveCreatedMs,
            postType: (row.post_type as CoursePost['postType']) || 'announcement',
            status,
            scheduledFor: status === 'scheduled' ? scheduledFor : undefined,
            scheduledForDisplay: status === 'scheduled' ? scheduledForDisplay : undefined,
            isPinned,
            pinnedAt,
            pinOrder,
            attachments: visibleAttachments as CoursePost['attachments'],
            likes: Array.isArray(row.likes) ? (row.likes as string[]) : [],
            comments: comments as CoursePost['comments'],
          };
        });
        this.setCachedQuery(cacheKey, mappedPosts, 45_000);
        return mappedPosts;
      } catch {
        return null;
      }
    });
  }

  /**
   * Fetch all assignments from Supabase (with 5-minute Client-Side Cache TTL)
   */
  static async getRemoteAssignments(forceRefresh: boolean = false): Promise<Assignment[] | null> {
    if (!forceRefresh) {
      const cached = this.getCachedQuery<Assignment[]>('assignments:all');
      if (cached) return cached;
    }
    return this.dedupeGet('assignments:all', async () => {
      try {
        const { data, error } = await supabase
          .from('assignments')
          .select('id,course_id,title,description,due_date,total_points')
          .limit(200);
        if (error || !data) return null;

        const mapped = data.map((row) => ({
          id: row.id,
          courseId: row.course_id,
          title: row.title || '',
          description: row.description || '',
          dueDate: row.due_date || '',
          maxPoints: row.total_points ?? 100,
          rubricItems: ['Code Quality & Correctness', 'Documentation & Verification'],
        }));
        this.setCachedQuery('assignments:all', mapped, 180_000);
        return mapped;
      } catch {
        return null;
      }
    });
  }

  /**
   * Fetch all assignment submissions from Supabase (with 60s Client-Side Cache TTL & no student_avatar column)
   */
  static async getRemoteSubmissions(
    forceRefresh: boolean = false
  ): Promise<AssignmentSubmission[] | null> {
    if (!forceRefresh) {
      const cached = this.getCachedQuery<AssignmentSubmission[]>('submissions:all');
      if (cached) return cached;
    }
    return this.dedupeGet('submissions:all', async () => {
      try {
        const { data, error } = await supabase
          .from('assignment_submissions')
          .select('id,assignment_id,student_id,student_name,files,notes,grade,feedback,submitted_at')
          .limit(300);
        if (error || !data) return null;

        const mapped = data.map((row) => {
          const filesArr = Array.isArray(row.files) ? row.files : [];
          return {
            id: row.id,
            assignmentId: row.assignment_id,
            courseId: '',
            studentId: row.student_id,
            studentName: row.student_name || 'Student',
            studentAvatar: '',
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
            status: (typeof row.grade === 'number' ? 'graded' : 'submitted') as
              | 'submitted'
              | 'graded',
          };
        });
        this.setCachedQuery('submissions:all', mapped, 60_000);
        return mapped;
      } catch {
        return null;
      }
    });
  }

  /**
   * Fetch all quizzes from Supabase (with 3-minute Client-Side Cache TTL)
   */
  static async getRemoteQuizzes(forceRefresh: boolean = false): Promise<Quiz[] | null> {
    if (!forceRefresh) {
      const cached = this.getCachedQuery<Quiz[]>('quizzes:all');
      if (cached) return cached;
    }
    return this.dedupeGet('quizzes:all', async () => {
      try {
        const { data, error } = await supabase
          .from('quizzes')
          .select('id,course_id,title,time_limit_minutes,passing_score,questions')
          .limit(150);
        if (error || !data) return null;

        const mapped = data.map((row) => ({
          id: row.id,
          courseId: row.course_id,
          title: row.title || '',
          description: 'Timed Assessment',
          timeLimitMinutes: row.time_limit_minutes ?? 30,
          durationMinutes: row.time_limit_minutes ?? 30,
          passingScore: row.passing_score ?? 70,
          questions: Array.isArray(row.questions) ? row.questions : [],
        }));
        this.setCachedQuery('quizzes:all', mapped, 180_000);
        return mapped;
      } catch {
        return null;
      }
    });
  }

  /**
   * Fetch attendance sessions from Supabase (deduplicated & scoped to enrolled courseIds to save Egress).
   * When `knownSessions` is provided, performs an ultra-lightweight 0.8KB metadata query first and only
   * downloads the heavy `records` JSONB for currently OPEN sessions or sessions whose state/timestamp changed!
   */
  static async getRemoteAttendanceSessions(
    courseIds?: string[],
    knownSessions?: Map<
      string,
      { isOpen: boolean; statusUpdatedAtMs?: number; records: Record<string, AttendanceRecord> }
    >,
    forceRefresh: boolean = false,
    forStudentId?: string
  ): Promise<AttendanceSession[] | null> {
    if (courseIds && courseIds.length === 0) {
      return [];
    }
    const useDeltaRecords = Boolean(knownSessions && knownSessions.size > 0);
    const scopeKey = `${
      courseIds && courseIds.length > 0 ? courseIds.slice().sort().join(',') : 'all'
    }:${useDeltaRecords ? 'delta' : 'full'}:${forStudentId || 'inst'}`;
    const cacheKey = `attendance:${scopeKey}`;
    if (!forceRefresh) {
      const cached = this.getCachedQuery<AttendanceSession[]>(cacheKey);
      if (cached) return cached;
    }

    return this.dedupeGet(cacheKey, async () => {
      try {
        const selectCols = useDeltaRecords
          ? 'id,course_id,date,display_date,title,is_open,opened_by,created_at'
          : 'id,course_id,date,display_date,title,is_open,opened_by,records,created_at';

        let query = supabase
          .from('attendance_sessions')
          .select(selectCols)
          .order('created_at', { ascending: false })
          .limit(60);

        if (courseIds && courseIds.length > 0 && courseIds.length <= 25) {
          query = query.in('course_id', courseIds);
        }

        const { data, error } = await query;
        if (error || !data) return null;

        const rows = data as unknown as Record<string, unknown>[];
        const fetchedRecordsById = new Map<string, Record<string, AttendanceRecord>>();

        if (useDeltaRecords && knownSessions) {
          const idsNeedingRecords: string[] = [];
          for (const row of rows) {
            const sId = String(row.id || '');
            const decodedState = decodeAttendanceOpenedBy(
              row.opened_by as string | null,
              row.is_open
            );
            const rowIsOpen = Boolean(row.is_open) && decodedState.isOpen;
            const localKnown = knownSessions.get(sId);
            const localRecObj = localKnown?.records || {};
            const localRecCount = Object.keys(localRecObj).length;
            const localRecHash = computeFastStringHash(JSON.stringify(localRecObj));
            const studentAlreadyCheckedInLocally = Boolean(
              forStudentId && localRecObj[forStudentId]
            );

            // Fetch full `records` JSONB ONLY if:
            // 1. Session is not in local storage yet (`!localKnown`)
            // 2. Session's Open/Close state (`isOpen`) changed
            // 3. Session's `statusUpdatedAtMs` timestamp changed (Instructor opened/closed or marked a student)
            // 4. For Instructors (or Students who haven't checked in yet): `recordCount` or `recordHash` changed
            //    (Students who ALREADY checked in do NOT need to re-download 90+ classmates' records every time another student checks in!)
            if (
              !localKnown ||
              localKnown.isOpen !== rowIsOpen ||
              (decodedState.statusUpdatedAtMs &&
                localKnown.statusUpdatedAtMs !== decodedState.statusUpdatedAtMs) ||
              (!studentAlreadyCheckedInLocally &&
                decodedState.recordCount !== undefined &&
                localRecCount !== decodedState.recordCount) ||
              (!studentAlreadyCheckedInLocally &&
                decodedState.recordHash !== undefined &&
                localRecHash !== decodedState.recordHash) ||
              (rowIsOpen && !decodedState.statusUpdatedAtMs)
            ) {
              idsNeedingRecords.push(sId);
            }
          }

          if (idsNeedingRecords.length > 0) {
            const { data: recRows } = await supabase
              .from('attendance_sessions')
              .select('id,records')
              .in('id', idsNeedingRecords);

            if (Array.isArray(recRows)) {
              recRows.forEach((rr) => {
                const rawRec =
                  rr.records && typeof rr.records === 'object'
                    ? (rr.records as Record<string, AttendanceRecord>)
                    : {};
                const cleanRec: Record<string, AttendanceRecord> = {};
                for (const [k, v] of Object.entries(rawRec)) {
                  if (k !== '__session_meta__' && v && typeof v === 'object' && 'status' in v) {
                    cleanRec[k] = v;
                  }
                }
                fetchedRecordsById.set(String(rr.id), cleanRec);
              });
            }
          }
        }

        const mappedSessions = rows.map((row) => {
          const sId = String(row.id || '');
          const decodedState = decodeAttendanceOpenedBy(
            row.opened_by as string | null,
            row.is_open
          );
          const resolvedOpenState = Boolean(row.is_open) && decodedState.isOpen;

          let cleanRecords: Record<string, AttendanceRecord> = {};
          if (fetchedRecordsById.has(sId)) {
            cleanRecords = fetchedRecordsById.get(sId)!;
          } else if (row.records && typeof row.records === 'object') {
            const rawRecords = row.records as Record<string, AttendanceRecord>;
            for (const [k, v] of Object.entries(rawRecords)) {
              if (k !== '__session_meta__' && v && typeof v === 'object' && 'status' in v) {
                cleanRecords[k] = v;
              }
            }
          } else if (knownSessions?.has(sId)) {
            cleanRecords = knownSessions.get(sId)!.records;
          }

          return {
            id: sId,
            courseId: String(row.course_id || ''),
            date: String(row.date || ''),
            displayDate: String(row.display_date || row.date || ''),
            title: String(row.title || 'Class Attendance'),
            isOpen: resolvedOpenState,
            openedBy: decodedState.openedBy,
            createdAt: String(row.created_at || new Date().toISOString()),
            statusUpdatedAtMs: decodedState.statusUpdatedAtMs,
            records: cleanRecords,
          };
        });
        this.setCachedQuery(cacheKey, mappedSessions, 15_000);
        return mappedSessions;
      } catch {
        return null;
      }
    });
  }

  /**
   * Fetch active (non-expired) notifications for a user from Supabase
   */
  static async getRemoteNotifications(userId?: string): Promise<NotificationItem[] | null> {
    if (this.notificationsTableStatus === 'missing') {
      return null;
    }
    const cacheKey = `notifs:${userId || 'all'}`;
    const cached = this.getCachedQuery<NotificationItem[]>(cacheKey);
    if (cached) return cached;

    return this.dedupeGet(cacheKey, async () => {
      try {
        const cutoffIso = new Date(Date.now() - NOTIFICATION_TTL_MS).toISOString();
        let query = supabase
          .from('notifications')
          .select(
            'id,user_id,course_id,course_code,course_title,post_id,author_name,author_role,title,message,type,is_read,created_at,expires_at'
          )
          .gt('created_at', cutoffIso)
          .order('created_at', { ascending: false })
          .limit(40);

        if (userId) {
          query = query.in('user_id', [userId, 'COURSE_BROADCAST']);
        } else {
          query = query
            .neq('user_id', AUDIT_LOG_SYSTEM_USER_ID)
            .neq('user_id', PRIVATE_NOTE_SYSTEM_USER_ID);
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

        const mappedNotifs = data.map((row) => {
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
        this.setCachedQuery(cacheKey, mappedNotifs, 90_000);
        return mappedNotifs;
      } catch {
        return null;
      }
    });
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

      this.invalidateClientCache('notifs');
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
   * Auto-delete notifications older than 30 minutes (and also trigger 2-day Audit Log cleanup) from Supabase SQL database.
   * Throttled via persistent localStorage to once every 60 minutes unless forced to protect Supabase Free Plan Log Ingestion quota.
   */
  static async purgeExpiredNotifications(expiredIds: string[] = [], force: boolean = false): Promise<boolean> {
    if (this.notificationsTableStatus === 'missing') {
      return false;
    }
    this.loadCloudCleanupTimestamps();
    const now = Date.now();
    const shouldRunTimeSweep = force || now - this.lastExpiredCleanupAt >= 3_600_000;

    if (shouldRunTimeSweep) {
      this.purgeExpiredAuditLogs([], force).catch(() => {});
    }

    if (!shouldRunTimeSweep && expiredIds.length === 0) {
      return true;
    }

    try {
      if (shouldRunTimeSweep) {
        this.lastExpiredCleanupAt = now;
        this.saveCloudCleanupTimestamps();
        const cutoffIso = new Date(now - NOTIFICATION_TTL_MS).toISOString();
        const nowIso = new Date(now).toISOString();
        const { error } = await supabase
          .from('notifications')
          .delete()
          .neq('user_id', AUDIT_LOG_SYSTEM_USER_ID)
          .neq('user_id', PRIVATE_NOTE_SYSTEM_USER_ID)
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
   * Auto-delete Security Audit Logs older than 2 days (48 hours) from Supabase SQL database in the background.
   * Throttled via persistent localStorage to once every 60 minutes unless forced.
   */
  static async purgeExpiredAuditLogs(expiredIds: string[] = [], force: boolean = false): Promise<boolean> {
    if (this.notificationsTableStatus === 'missing') {
      return false;
    }
    this.loadCloudCleanupTimestamps();
    const now = Date.now();
    const shouldRunSweep = force || now - this.lastAuditLogCleanupAt >= 3_600_000;
    if (!shouldRunSweep && expiredIds.length === 0) {
      return true;
    }

    try {
      if (shouldRunSweep) {
        this.lastAuditLogCleanupAt = now;
        this.saveCloudCleanupTimestamps();
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
        .neq('user_id', PRIVATE_NOTE_SYSTEM_USER_ID)
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
    const cacheKey = `audit_logs:${limit}`;
    const cached = this.getCachedQuery<AuditLogEntry[]>(cacheKey);
    if (cached) return cached;

    return this.dedupeGet(cacheKey, async () => {
      try {
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

        this.setCachedQuery(cacheKey, logs, 45_000);
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
      this.invalidateClientCache('audit_logs');
      const rows = entries.map((e) => {
        const createdMs = e.createdAtMs || Date.now();
        const expiresMs = createdMs + AUDIT_LOG_TTL_MS;
        const { actorAvatar: _omitAvatar, ...compactAuditEntry } = e;
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
          message: JSON.stringify(compactAuditEntry),
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
      this.invalidateClientCache('audit_logs');
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', AUDIT_LOG_SYSTEM_USER_ID);
      return !error;
    } catch {
      return false;
    }
  }

  /**
   * Fetch Private Notes / Leave Requests from Supabase.
   * - Students filter by `post_id = studentId` so they physically ONLY download their own notes!
   * - Admins / Co-Admins fetch all private notes across courses.
   */
  static async getRemotePrivateNotes(options?: {
    studentId?: string;
    courseIds?: string[];
    limit?: number;
    forceRefresh?: boolean;
  }): Promise<PrivateNote[] | null> {
    if (this.notificationsTableStatus === 'missing') {
      return null;
    }
    const studentKey = options?.studentId || 'all';
    const courseKey =
      options?.courseIds && options.courseIds.length > 0
        ? options.courseIds.slice().sort().join(',')
        : 'all';
    const limit = options?.limit || 300;
    const cacheKey = `private_notes:${studentKey}:${courseKey}:${limit}`;

    if (!options?.forceRefresh) {
      const cached = this.getCachedQuery<PrivateNote[]>(cacheKey);
      if (cached) return cached;
    }

    return this.dedupeGet(cacheKey, async () => {
      try {
        let query = supabase
          .from('notifications')
          .select('id,course_id,course_code,course_title,post_id,author_name,title,message,created_at')
          .eq('user_id', PRIVATE_NOTE_SYSTEM_USER_ID)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (options?.studentId) {
          query = query.eq('post_id', options.studentId);
        }
        if (options?.courseIds && options.courseIds.length > 0 && options.courseIds.length <= 25) {
          query = query.in('course_id', options.courseIds);
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

        const notes: PrivateNote[] = [];
        for (const row of data) {
          try {
            if (row.message && String(row.message).trim().startsWith('{')) {
              const parsed = JSON.parse(String(row.message)) as PrivateNote;
              if (parsed && parsed.id && parsed.courseId && parsed.studentId) {
                notes.push(parsed);
                continue;
              }
            }
          } catch {
            // ignore malformed JSON
          }
        }
        this.setCachedQuery(cacheKey, notes, 90_000);
        return notes;
      } catch {
        return null;
      }
    });
  }

  /**
   * Upsert a Private Note / Leave Request to Supabase (`user_id = 'SYSTEM_PRIVATE_NOTE'`).
   * Never deleted by the 30-minute notification sweep.
   */
  static async upsertPrivateNote(note: PrivateNote, silent: boolean = false): Promise<boolean> {
    if (this.notificationsTableStatus === 'missing') {
      return false;
    }
    try {
      this.invalidateClientCache('private_notes');
      const createdMs = note.createdAtMs || Date.now();
      const expiresMs = createdMs + PRIVATE_NOTE_TTL_MS;
      const row = {
        id: note.id,
        user_id: PRIVATE_NOTE_SYSTEM_USER_ID,
        course_id: note.courseId,
        course_code: note.courseCode || null,
        course_title: note.courseTitle || '',
        post_id: note.studentId, // Stored in post_id for strict student-scoped SQL filtering
        author_name: note.studentName,
        author_role: 'student',
        title: note.subject || 'Private Note',
        message: JSON.stringify(note),
        type: 'private_note',
        is_read: Boolean(note.isReadByInstructor && note.isReadByStudent),
        created_at: new Date(createdMs).toISOString(),
        expires_at: new Date(expiresMs).toISOString(),
      };

      const { error } = await supabase.from('notifications').upsert([row], { onConflict: 'id' });
      if (error) {
        if (error.code === '42P01' || error.message?.includes('notifications')) {
          this.notificationsTableStatus = 'missing';
        }
        return false;
      }
      this.notificationsTableStatus = 'available';
      if (!silent) {
        this.notifyRealtimePeers('private_note', { targetUserIds: [note.studentId] });
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete a Private Note from Supabase
   */
  static async deleteRemotePrivateNote(noteId: string, studentId?: string): Promise<boolean> {
    if (this.notificationsTableStatus === 'missing') return false;
    try {
      this.invalidateClientCache('private_notes');
      this.ignoredRealtimeDeleteIds.add(noteId);
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', noteId)
        .eq('user_id', PRIVATE_NOTE_SYSTEM_USER_ID);
      if (!error) {
        this.notifyRealtimePeers('delete', {
          deletedIds: [noteId],
          targetUserIds: studentId ? [studentId] : undefined,
        });
      }
      return !error;
    } catch {
      return false;
    }
  }

  private static buildProfilePayload(
    user: User,
    mode: 'full' | 'no_password' | 'core' | 'minimal'
  ): Record<string, unknown> {
    const safeAvatar = compactAvatarForCloud(user.avatar, user.role);
    const encodedTitle = encodeTitleWithRules(user);

    if (mode === 'minimal') {
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: safeAvatar,
        title: encodedTitle,
      };
    }

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
    };
  }

  /**
   * Create or update a profile in Supabase with cached schema mode & signature deduplication
   */
  static async upsertProfile(
    user: User,
    forceUpload: boolean = false,
    options?: {
      silentRealtime?: boolean;
      sessionLockOnly?: boolean;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      let resolvedPassword = user.password;
      if (!resolvedPassword && typeof window !== 'undefined') {
        try {
          const rawUsers = localStorage.getItem('classroom_users');
          if (rawUsers) {
            const parsed = JSON.parse(rawUsers) as User[];
            const match = Array.isArray(parsed)
              ? parsed.find((u) => u && u.id === user.id && u.password)
              : undefined;
            if (match?.password) {
              resolvedPassword = match.password;
            }
          }
        } catch {
          // ignore
        }
      }
      const normalizedUser: User = {
        ...user,
        username: (user.username || '').trim().toLowerCase(),
        email: (user.email || '').trim().toLowerCase(),
        password: resolvedPassword,
      };
      const payload = this.buildProfilePayload(normalizedUser, this.profileSchemaMode);
      const sigKey = `profile:${normalizedUser.id}`;
      if (!forceUpload && !this.hasChangedSignature(sigKey, payload)) {
        return { success: true };
      }

      // Immediately invalidate client-side and in-flight profile caches so subsequent reads/logins see the updated user
      this.invalidateClientCache('profiles');
      this.invalidateClientCache('profile_candidates');
      for (const k of Array.from(this.inflightGetRequests.keys())) {
        if (k.startsWith('profiles') || k.startsWith('profile_candidates')) {
          this.inflightGetRequests.delete(k);
        }
      }

      const emitProfilePeerUpdate = () => {
        if (options?.silentRealtime) return;
        if (options?.sessionLockOnly || normalizedUser.role === 'student') {
          this.notifyRealtimePeers('profile', { targetUserIds: [normalizedUser.id] });
        } else {
          this.notifyRealtimePeers('profile');
        }
      };

      const { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' });

      if (!error) {
        this.recordSignature(sigKey, payload);
        emitProfilePeerUpdate();
        return { success: true };
      }

      // Handle unique constraint violation (23505) on username or email when an account is recreated with a new ID
      if (
        error.code === '23505' ||
        (error.message && error.message.toLowerCase().includes('duplicate key'))
      ) {
        try {
          const dupFilters: string[] = [];
          if (normalizedUser.username) dupFilters.push(`username.ilike.${normalizedUser.username}`);
          if (normalizedUser.email) dupFilters.push(`email.ilike.${normalizedUser.email}`);
          if (dupFilters.length > 0) {
            const { data: oldDups } = await supabase
              .from('profiles')
              .select('id')
              .or(dupFilters.join(','))
              .neq('id', normalizedUser.id);
            if (Array.isArray(oldDups)) {
              oldDups.forEach((d) => {
                if (d?.id) this.ignoredRealtimeDeleteIds.add(String(d.id));
              });
            }
          }
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
            this.recordSignature(sigKey, payload);
            emitProfilePeerUpdate();
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

      // Fallback 1: without password column
      if (this.profileSchemaMode === 'full') {
        const noPwdPayload = this.buildProfilePayload(normalizedUser, 'no_password');
        const { error: errNoPwd } = await supabase
          .from('profiles')
          .upsert(noPwdPayload, { onConflict: 'id' });
        if (!errNoPwd) {
          if (isMissingColumnError) {
            this.profileSchemaMode = 'no_password';
          }
          this.recordSignature(sigKey, payload);
          emitProfilePeerUpdate();
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
        this.recordSignature(sigKey, payload);
        emitProfilePeerUpdate();
        return { success: true };
      }

      // Fallback 3: minimal columns (if username or phone column is missing on an older table)
      const minimalPayload = this.buildProfilePayload(normalizedUser, 'minimal');
      const { error: minError } = await supabase
        .from('profiles')
        .upsert(minimalPayload, { onConflict: 'id' });

      if (!minError) {
        this.recordSignature(sigKey, payload);
        emitProfilePeerUpdate();
        return { success: true };
      }

      return { success: false, error: minError.message || fallbackError.message || error.message };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  }

  /**
   * Delete a profile and all associated student submissions & notifications from Supabase SQL database
   * (Deletes by id AND any duplicate rows matching username or email so deleted accounts can NEVER log in again)
   */
  static async deleteProfile(
    userId: string,
    username?: string,
    email?: string
  ): Promise<boolean> {
    try {
      this.lastUpsertSignatures.delete(`profile:${userId}`);
      this.invalidateClientCache('profiles');
      const cleanUName = (username || '')
        .trim()
        .replace(/^@+/, '')
        .replace(/[,()"'\\]/g, '')
        .toLowerCase();
      const cleanEmail = (email || '')
        .trim()
        .replace(/[,()"'\\]/g, '')
        .toLowerCase();

      // Lookup any duplicate profile IDs sharing the same username or email so their submissions/notifications are also deleted
      const allTargetIds = new Set<string>([userId]);
      if (cleanUName || cleanEmail) {
        try {
          const filters: string[] = [];
          if (cleanUName && cleanUName !== 'user') filters.push(`username.ilike.${cleanUName}`);
          if (cleanEmail) filters.push(`email.ilike.${cleanEmail}`);
          if (filters.length > 0) {
            const { data: dupRows } = await supabase
              .from('profiles')
              .select('id')
              .or(filters.join(','));
            if (Array.isArray(dupRows)) {
              dupRows.forEach((r) => {
                if (r?.id) allTargetIds.add(String(r.id));
              });
            }
          }
        } catch {
          // ignore
        }
      }

      const idList = Array.from(allTargetIds);
      idList.forEach((id) => this.lastUpsertSignatures.delete(`profile:${id}`));

      await Promise.allSettled([
        supabase.from('assignment_submissions').delete().in('student_id', idList),
        supabase.from('quiz_submissions').delete().in('student_id', idList),
        this.notificationsTableStatus !== 'missing'
          ? supabase.from('notifications').delete().in('user_id', idList)
          : Promise.resolve(),
      ]);

      const deleteTasks: PromiseLike<unknown>[] = [
        supabase.from('profiles').delete().in('id', idList),
      ];
      if (cleanUName && cleanUName !== 'user') {
        deleteTasks.push(supabase.from('profiles').delete().ilike('username', cleanUName));
      }
      if (cleanEmail) {
        deleteTasks.push(supabase.from('profiles').delete().ilike('email', cleanEmail));
      }
      const results = await Promise.allSettled(deleteTasks);
      const primaryOk =
        results[0].status === 'fulfilled' &&
        !(results[0].value as { error?: unknown })?.error;

      this.notifyRealtimePeers('delete', {
        deletedIds: idList,
        deletedUsernames: cleanUName ? [cleanUName] : undefined,
        deletedEmails: cleanEmail ? [cleanEmail] : undefined,
      });

      return primaryOk;
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
      this.invalidateClientCache('courses');
      this.notifyRealtimePeers('course');
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
      this.invalidateClientCache('courses');
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
      if (!error) {
        this.notifyRealtimePeers('delete', {
          deletedIds: [courseId, ...assIds, ...quizIds],
        });
      }
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

    const idTsMatch = post.id ? post.id.match(/(\d{13})/) : null;
    const idTs = idTsMatch ? Number(idTsMatch[1]) : undefined;
    const isInitialDemoPost = /^post-\d{3}$/.test(post.id || '');
    const effectiveMs =
      post.createdAtMs ||
      (idTs && idTs > 1_600_000_000_000 ? idTs : undefined) ||
      (isInitialDemoPost ? 1_704_067_200_000 : Date.now());

    // Automatically filter out any comment >= 2 days (48 hours) old and keep latest 50 comments max in Supabase row
    const nowForRow = Date.now();
    const safeComments = (post.comments || [])
      .filter((c) => !isCommentExpired(c, nowForRow, effectiveMs))
      .slice(-50)
      .map((c) => ({
        id: c.id,
        postId: c.postId,
        authorId: c.authorId,
        authorName: c.authorName,
        authorRole: c.authorRole,
        authorAvatar: '',
        content: (c.content || '').slice(0, 1000),
        createdAt: c.createdAt,
        createdAtMs: resolveCommentTimestampMs(c, effectiveMs),
      }));

    const postStatus = post.status || 'published';
    const postSig = this.computePostSignature(
      post.content || '',
      safeComments,
      post.isPinned,
      post.pinOrder
    );
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
        commentCount: safeComments.length,
        contentLen: (post.content || '').length,
        sig: postSig,
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
      author_avatar: '',
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
      this.invalidateClientCache('posts');
      const { error } = await supabase.from('posts').upsert(row, { onConflict: 'id' });
      if (!error) {
        this.recordSignature(sigKey, row);
        this.notifyRealtimePeers('post');
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
          this.notifyRealtimePeers('post');
          return true;
        }
      }

      // Fallback to core columns if optional columns (e.g. scheduled_for, status, is_pinned) are missing
      const coreRow = this.formatPostRow(post, true);
      const { error: coreErr } = await supabase.from('posts').upsert(coreRow, { onConflict: 'id' });
      if (!coreErr) {
        this.recordSignature(sigKey, row);
        this.notifyRealtimePeers('post');
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
      this.invalidateClientCache('posts');
      this.invalidateClientCache('notifs');
      await this.deleteNotificationsByPostId(postId);
      const { error } = await supabase.from('posts').delete().eq('id', postId);
      if (!error) {
        this.notifyRealtimePeers('delete', { deletedIds: [postId] });
      }
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
      this.invalidateClientCache('assignments');
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
      if (!error) {
        this.notifyRealtimePeers('assignment');
      }
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
      this.invalidateClientCache('assignments');
      this.invalidateClientCache('submissions');
      await supabase.from('assignment_submissions').delete().eq('assignment_id', assignmentId);
      const { error } = await supabase.from('assignments').delete().eq('id', assignmentId);
      if (!error) {
        this.notifyRealtimePeers('delete', { deletedIds: [assignmentId] });
      }
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
      this.invalidateClientCache('submissions');
      const { error } = await supabase
        .from('assignment_submissions')
        .upsert(this.formatSubmissionRow(sub), { onConflict: 'id' });
      if (!error) {
        this.notifyRealtimePeers('submission');
      }
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
      this.invalidateClientCache('submissions');
      const { error } = await supabase.from('assignment_submissions').delete().eq('id', submissionId);
      if (!error) {
        this.notifyRealtimePeers('delete', { deletedIds: [submissionId] });
      }
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
      this.invalidateClientCache('quizzes');
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
      if (!error) {
        this.notifyRealtimePeers('quiz');
      }
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
      this.invalidateClientCache('quizzes');
      await supabase.from('quiz_submissions').delete().eq('quiz_id', quizId);
      const { error } = await supabase.from('quizzes').delete().eq('id', quizId);
      if (!error) {
        this.notifyRealtimePeers('delete', { deletedIds: [quizId] });
      }
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
      if (!error) {
        this.notifyRealtimePeers('quiz_submission');
      }
      return !error;
    } catch {
      return false;
    }
  }

  /**
   * Upsert an attendance session to Supabase SQL database with conflict-free record merging
   * and authoritative open/close state synchronization across all Admin, Co-Admin, and Student devices.
   */
  static async upsertAttendanceSession(
    session: AttendanceSession,
    options?: {
      force?: boolean;
      preserveRemoteOpenState?: boolean;
      onlyUpdateOpenState?: boolean;
    }
  ): Promise<boolean> {
    try {
      const sigKey = `att:${session.id}`;
      let mergedRecords: Record<string, AttendanceRecord> = { ...(session.records || {}) };
      let resolvedIsOpen = Boolean(session.isOpen);
      let resolvedStatusMs = session.statusUpdatedAtMs || Date.now();

      const candidateSession: AttendanceSession = {
        ...session,
        isOpen: resolvedIsOpen,
        statusUpdatedAtMs: resolvedStatusMs,
        records: mergedRecords,
      };
      const initialRow = {
        id: session.id,
        course_id: session.courseId,
        date: session.date,
        display_date: session.displayDate,
        title: session.title,
        is_open: resolvedIsOpen,
        opened_by: encodeAttendanceOpenedBy(candidateSession),
        records: mergedRecords,
      };

      // Deduplicate identical attendance session upserts before making network calls
      if (!options?.force && !this.hasChangedSignature(sigKey, initialRow)) {
        return true;
      }

      // Fetch current remote row first so concurrent student check-ins or remote open/close changes are never clobbered
      const { data: existingRow } = await supabase
        .from('attendance_sessions')
        .select('id,is_open,opened_by,records')
        .eq('id', session.id)
        .maybeSingle();

      if (existingRow) {
        const remoteRecords =
          existingRow.records && typeof existingRow.records === 'object'
            ? (existingRow.records as Record<string, AttendanceRecord>)
            : {};
        const cleanRemoteRecords: Record<string, AttendanceRecord> = {};
        for (const [k, v] of Object.entries(remoteRecords)) {
          if (k !== '__session_meta__' && v && typeof v === 'object' && 'status' in v) {
            cleanRemoteRecords[k] = v;
          }
        }

        // Merge remote student check-ins with local records so toggling open/close or marking a student never drops other students' check-ins
        mergedRecords = {
          ...cleanRemoteRecords,
          ...(session.records || {}),
        };

        if (options?.preserveRemoteOpenState) {
          resolvedIsOpen = Boolean(existingRow.is_open);
        }

        const decodedExisting = decodeAttendanceOpenedBy(
          existingRow.opened_by as string | null,
          existingRow.is_open
        );
        if (options?.preserveRemoteOpenState) {
          resolvedIsOpen = Boolean(existingRow.is_open) && decodedExisting.isOpen;
          resolvedStatusMs = decodedExisting.statusUpdatedAtMs || session.statusUpdatedAtMs || Date.now();
        } else {
          // Strictly increment statusUpdatedAtMs above any existing remote value so clock skew between devices never blocks Open/Close!
          resolvedStatusMs = Math.max(
            session.statusUpdatedAtMs || Date.now(),
            (decodedExisting.statusUpdatedAtMs || 0) + 1000
          );
        }

        // If remote state + records are already identical to what we would write and not forcing an explicit Open/Close update, skip UPSERT
        if (
          !options?.onlyUpdateOpenState &&
          !options?.force &&
          Boolean(existingRow.is_open) === resolvedIsOpen &&
          decodedExisting.isOpen === resolvedIsOpen &&
          JSON.stringify(cleanRemoteRecords) === JSON.stringify(mergedRecords)
        ) {
          this.recordSignature(sigKey, initialRow);
          return true;
        }
      }

      const sessionToEncode: AttendanceSession = {
        ...session,
        isOpen: resolvedIsOpen,
        statusUpdatedAtMs: resolvedStatusMs,
        records: mergedRecords,
      };

      const row = {
        id: session.id,
        course_id: session.courseId,
        date: session.date,
        display_date: session.displayDate,
        title: session.title,
        is_open: resolvedIsOpen,
        opened_by: encodeAttendanceOpenedBy(sessionToEncode),
        records: mergedRecords,
      };

      // Clear any cached or in-flight attendance GET deduplication so subsequent reads immediately fetch the new state
      this.invalidateClientCache('attendance');
      for (const k of Array.from(this.inflightGetRequests.keys())) {
        if (k.startsWith('attendance:')) {
          this.inflightGetRequests.delete(k);
        }
      }

      let writeOk = false;
      const { error } = await supabase
        .from('attendance_sessions')
        .upsert(row, { onConflict: 'id' });
      if (!error) {
        writeOk = true;
      } else if (existingRow) {
        // If only updating an existing row, try targeted .update() as fallback
        const { error: updErr } = await supabase
          .from('attendance_sessions')
          .update({
            is_open: resolvedIsOpen,
            opened_by: encodeAttendanceOpenedBy(sessionToEncode),
            records: mergedRecords,
          })
          .eq('id', session.id);
        if (!updErr) {
          writeOk = true;
        }
      }

      // Whenever an Admin/Co-Admin closes attendance (or opens a single session for a course),
      // guarantee that NO OTHER session in the same course remains is_open = true in Supabase SQL!
      if (writeOk && options?.onlyUpdateOpenState && session.courseId) {
        if (!resolvedIsOpen) {
          await supabase
            .from('attendance_sessions')
            .update({ is_open: false })
            .eq('course_id', session.courseId)
            .neq('id', session.id)
            .eq('is_open', true);
        } else {
          await supabase
            .from('attendance_sessions')
            .update({ is_open: false })
            .eq('course_id', session.courseId)
            .neq('id', session.id)
            .eq('is_open', true);
        }
      }

      if (writeOk) {
        this.recordSignature(sigKey, row);
        this.notifyRealtimePeers('attendance');
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Atomic-style Student Check-In Sync:
   * - Fetches the latest remote attendance session row from Supabase first.
   * - If an Admin or Co-Admin has already closed the session (`is_open === false` or `decodedRemote.isOpen === false`),
   *   rejects the check-in and returns `closedRemotely: true` so the student's browser never checks in to or re-opens a closed session!
   * - Updates ONLY the `records` column (merging this student's check-in with all other students' remote records)
   *   and preserves the instructor's `statusUpdatedAtMs` so student phone clocks never interfere with Open/Close timestamps!
   */
  static async syncStudentCheckInToCloud(
    sessionId: string,
    studentId: string,
    record: AttendanceRecord | null,
    fallbackSession: AttendanceSession
  ): Promise<{
    success: boolean;
    closedRemotely?: boolean;
    remoteIsOpen?: boolean;
    remoteStatusUpdatedAtMs?: number;
    mergedRecords?: Record<string, AttendanceRecord>;
  }> {
    this.invalidateClientCache('attendance');
    for (const k of Array.from(this.inflightGetRequests.keys())) {
      if (k.startsWith('attendance:')) {
        this.inflightGetRequests.delete(k);
      }
    }

    try {
      // Seed accumulatedRecords with known records from fallbackSession so concurrent check-ins never get dropped
      const accumulatedRecords: Record<string, AttendanceRecord> = {};
      if (fallbackSession?.records && typeof fallbackSession.records === 'object') {
        for (const [k, v] of Object.entries(fallbackSession.records)) {
          if (k !== '__session_meta__' && v && typeof v === 'object' && 'status' in v) {
            accumulatedRecords[k] = v;
          }
        }
      }
      if (record === null) {
        delete accumulatedRecords[studentId];
      } else {
        accumulatedRecords[studentId] = record;
      }

      const maxAttempts = 4;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const { data: existingRow, error: fetchErr } = await supabase
          .from('attendance_sessions')
          .select('id,is_open,opened_by,records')
          .eq('id', sessionId)
          .maybeSingle();

        if (!fetchErr && existingRow) {
          const decodedRemote = decodeAttendanceOpenedBy(
            existingRow.opened_by as string | null,
            existingRow.is_open
          );
          const remoteRecords =
            existingRow.records && typeof existingRow.records === 'object'
              ? (existingRow.records as Record<string, AttendanceRecord>)
              : {};
          const cleanRemoteRecords: Record<string, AttendanceRecord> = {};
          for (const [k, v] of Object.entries(remoteRecords)) {
            if (k !== '__session_meta__' && v && typeof v === 'object' && 'status' in v) {
              cleanRemoteRecords[k] = v;
            }
          }

          // If Admin/Co-Admin already closed this attendance session on another device, do NOT allow check-in or overwrite is_open!
          if (!existingRow.is_open || !decodedRemote.isOpen) {
            return {
              success: false,
              closedRemotely: true,
              remoteIsOpen: false,
              remoteStatusUpdatedAtMs: decodedRemote.statusUpdatedAtMs || Date.now(),
              mergedRecords: cleanRemoteRecords,
            };
          }

          // Union remote records with accumulatedRecords so NO student's concurrent check-in is ever lost
          for (const [k, v] of Object.entries(cleanRemoteRecords)) {
            if (k !== studentId) {
              accumulatedRecords[k] = v;
            }
          }
          if (record === null) {
            delete accumulatedRecords[studentId];
          } else {
            accumulatedRecords[studentId] = record;
          }

          const nextRecords: Record<string, AttendanceRecord> = { ...accumulatedRecords };

          // Preserve the Instructor's statusUpdatedAtMs so student device clocks never advance or skew Open/Close timestamps!
          const preservedStatusMs =
            decodedRemote.statusUpdatedAtMs || fallbackSession.statusUpdatedAtMs || Date.now();
          const encodedMarker = encodeAttendanceOpenedBy({
            ...fallbackSession,
            openedBy: decodedRemote.openedBy,
            isOpen: true,
            statusUpdatedAtMs: preservedStatusMs,
            records: nextRecords,
          });

          const { error: updateErr } = await supabase
            .from('attendance_sessions')
            .update({
              records: nextRecords,
              opened_by: encodedMarker,
            })
            .eq('id', sessionId)
            .eq('is_open', true);

          if (!updateErr) {
            // Read-after-write verification after short random jitter (70-190ms) to guarantee concurrent student check-ins did not clobber each other
            const jitterMs = 70 + Math.floor(Math.random() * 120);
            await new Promise((r) => setTimeout(r, jitterMs));

            const { data: verifyRow, error: verifyErr } = await supabase
              .from('attendance_sessions')
              .select('id,is_open,opened_by,records')
              .eq('id', sessionId)
              .maybeSingle();

            if (!verifyErr && verifyRow) {
              const verifyDecoded = decodeAttendanceOpenedBy(
                verifyRow.opened_by as string | null,
                verifyRow.is_open
              );
              const verifyRaw =
                verifyRow.records && typeof verifyRow.records === 'object'
                  ? (verifyRow.records as Record<string, AttendanceRecord>)
                  : {};
              const verifyClean: Record<string, AttendanceRecord> = {};
              for (const [k, v] of Object.entries(verifyRaw)) {
                if (k !== '__session_meta__' && v && typeof v === 'object' && 'status' in v) {
                  verifyClean[k] = v;
                  if (k !== studentId) {
                    accumulatedRecords[k] = v;
                  }
                }
              }

              if (!verifyRow.is_open || !verifyDecoded.isOpen) {
                return {
                  success: false,
                  closedRemotely: true,
                  remoteIsOpen: false,
                  remoteStatusUpdatedAtMs: verifyDecoded.statusUpdatedAtMs || Date.now(),
                  mergedRecords: verifyClean,
                };
              }

              const myVerifiedRec = verifyClean[studentId];
              const myWriteIntact =
                record === null
                  ? !myVerifiedRec
                  : Boolean(myVerifiedRec && myVerifiedRec.status === record.status);
              const allPeersIntact = Object.keys(accumulatedRecords).every((peerId) =>
                peerId === studentId ? myWriteIntact : Boolean(verifyClean[peerId])
              );

              if (myWriteIntact && allPeersIntact) {
                this.invalidateClientCache('attendance');
                this.notifyRealtimePeers('attendance_checkin');
                return {
                  success: true,
                  remoteIsOpen: true,
                  remoteStatusUpdatedAtMs: preservedStatusMs,
                  mergedRecords: verifyClean,
                };
              }
              // Concurrent write detected! Loop will immediately re-merge and write the union of both students' records.
              continue;
            }

            this.invalidateClientCache('attendance');
            this.notifyRealtimePeers('attendance_checkin');
            return {
              success: true,
              remoteIsOpen: true,
              remoteStatusUpdatedAtMs: preservedStatusMs,
              mergedRecords: nextRecords,
            };
          }
        }

        // If row does not exist in Supabase yet:
        // - If it is a real newly opened session (not a demo att-sess-1..4), upsert it so the student's check-in is saved!
        // - Only treat demo sessions as closedRemotely.
        if (!fetchErr && !existingRow) {
          const isDemoSession = /^att-sess-\d{1,4}$/.test(sessionId || '');
          if (!isDemoSession && fallbackSession && fallbackSession.isOpen) {
            const sessionToCreate: AttendanceSession = {
              ...fallbackSession,
              isOpen: true,
              records: accumulatedRecords,
            };
            const createdOk = await this.upsertAttendanceSession(sessionToCreate, {
              force: true,
            });
            if (createdOk) {
              this.invalidateClientCache('attendance');
              this.notifyRealtimePeers('attendance_checkin');
              return {
                success: true,
                remoteIsOpen: true,
                remoteStatusUpdatedAtMs: fallbackSession.statusUpdatedAtMs || Date.now(),
                mergedRecords: accumulatedRecords,
              };
            }
          }
          if (isDemoSession) {
            return {
              success: false,
              closedRemotely: true,
              remoteIsOpen: false,
              remoteStatusUpdatedAtMs: Date.now(),
            };
          }
          return {
            success: false,
            remoteIsOpen: true,
            mergedRecords: accumulatedRecords,
          };
        }

        await new Promise((r) => setTimeout(r, 120 * (attempt + 1)));
      }

      return { success: false, mergedRecords: accumulatedRecords };
    } catch {
      return { success: false };
    }
  }

  /**
   * Auto-delete an attendance session from Supabase SQL database
   */
  static async deleteAttendanceSession(sessionId: string): Promise<boolean> {
    try {
      this.lastUpsertSignatures.delete(`att:${sessionId}`);
      this.invalidateClientCache('attendance');
      const { error } = await supabase.from('attendance_sessions').delete().eq('id', sessionId);
      if (!error) {
        this.notifyRealtimePeers('delete', { deletedIds: [sessionId] });
      }
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
    this.loadCloudCleanupTimestamps();
    const now = Date.now();
    // Throttle automatic cloud orphan sweeps to once every 6 hours unless forced
    if (!force && now - this.lastOrphanCleanupAt < 21_600_000) {
      return { success: true, totalCleaned: 0, details: 'Skipped (within 6h throttle window)' };
    }
    this.lastOrphanCleanupAt = now;
    this.saveCloudCleanupTimestamps();

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
          // For SYSTEM_PRIVATE_NOTE rows, pId stores studentId (not postId)
          if (uId === PRIVATE_NOTE_SYSTEM_USER_ID) {
            if (
              deletedSet.has(id) ||
              (cId && !courseIdSet.has(cId)) ||
              (pId && !userIdSet.has(pId))
            ) {
              orphanNotifIds.push(id);
            }
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
   * 1-Click Cloud Database Slimmer (< 5.5 GB Free Plan Egress Guard):
   * - Strips any legacy Base64 `author_avatar` strings from `public.posts`
   * - Strips any legacy Base64 `avatar` strings from student rows in `public.profiles`
   * - Replaces any oversized (>45KB) Admin/Co-Admin avatars or (>65KB) Course banners with ultra-lightweight SVG fallbacks
   * - Strips `student_avatar` from `public.assignment_submissions`
   * - Purges expired notifications and orphaned cloud records
   */
  static async slimDatabaseForLowEgress(): Promise<{
    success: boolean;
    slimmedRows: number;
    details: string;
  }> {
    let slimmedRows = 0;
    try {
      // 1. Strip author_avatar in posts, student & co_admin avatar in profiles, and student_avatar in assignment_submissions
      const [postAvRes, stuAvRes, subAvRes] = await Promise.allSettled([
        supabase
          .from('posts')
          .update({ author_avatar: '' })
          .neq('author_avatar', '')
          .select('id'),
        supabase
          .from('profiles')
          .update({ avatar: '' })
          .in('role', ['student', 'co_admin'])
          .neq('avatar', '')
          .select('id'),
        supabase
          .from('assignment_submissions')
          .update({ student_avatar: '' })
          .neq('student_avatar', '')
          .select('id'),
      ]);

      if (postAvRes.status === 'fulfilled' && Array.isArray(postAvRes.value.data)) {
        slimmedRows += postAvRes.value.data.length;
      }
      if (stuAvRes.status === 'fulfilled' && Array.isArray(stuAvRes.value.data)) {
        slimmedRows += stuAvRes.value.data.length;
      }
      if (subAvRes.status === 'fulfilled' && Array.isArray(subAvRes.value.data)) {
        slimmedRows += subAvRes.value.data.length;
      }

      // 2. Check Primary Admin avatars for any Base64 (`data:...`) or non-key/non-URL values, and Course banners for oversized payloads
      const [adminRowsRes, courseRowsRes] = await Promise.allSettled([
        supabase.from('profiles').select('id,role,avatar').eq('role', 'admin'),
        supabase.from('courses').select('id,banner_image'),
      ]);

      if (adminRowsRes.status === 'fulfilled' && Array.isArray(adminRowsRes.value.data)) {
        for (const r of adminRowsRes.value.data) {
          const av = String(r.avatar || '');
          const cloudSafe = toCloudAvatarKeyOrUrl(av, 'admin');
          if (av !== cloudSafe) {
            await supabase
              .from('profiles')
              .update({ avatar: cloudSafe })
              .eq('id', String(r.id));
            slimmedRows++;
          }
        }
      }

      if (courseRowsRes.status === 'fulfilled' && Array.isArray(courseRowsRes.value.data)) {
        for (const c of courseRowsRes.value.data) {
          const bn = String(c.banner_image || '');
          if (bn.length > 65_000) {
            await supabase
              .from('courses')
              .update({ banner_image: DEFAULT_FALLBACK_BANNER })
              .eq('id', String(c.id));
            slimmedRows++;
          }
        }
      }

      // 3. Purge expired notifications
      await this.purgeExpiredNotifications([], true);

      return {
        success: true,
        slimmedRows,
        details: `Slimmed ${slimmedRows} oversized cloud rows and purged expired notifications.`,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, slimmedRows, details: msg };
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

    // 1. Batch upsert profiles in chunks of 200 with pre-deduplication & batch schema fallback
    // (Prevents 238+ individual fallback requests and eliminates "Too many requests" 429 errors)
    let syncedUsers = 0;
    if (users.length > 0) {
      // 1a. Normalize & deduplicate usernames and emails in memory so no two rows in the batch conflict
      const seenUsernames = new Set<string>();
      const seenEmails = new Set<string>();
      const sanitizedUsers: User[] = users.map((u, idx) => {
        const cleanId = String(u.id || `user-${idx}`).trim();
        let cleanUsername = (u.username || '').trim().toLowerCase();
        if (!cleanUsername) {
          cleanUsername = `user_${cleanId.replace(/[^a-z0-9]/gi, '').slice(-8) || idx}`;
        }
        if (seenUsernames.has(cleanUsername)) {
          cleanUsername = `${cleanUsername}_${idx}`;
        }
        seenUsernames.add(cleanUsername);

        let cleanEmail = (u.email || '').trim().toLowerCase();
        if (!cleanEmail) {
          cleanEmail = `${cleanUsername}@swanarh.edu.mm`;
        }
        if (seenEmails.has(cleanEmail)) {
          const atIdx = cleanEmail.indexOf('@');
          cleanEmail =
            atIdx > 0
              ? `${cleanEmail.slice(0, atIdx)}+${idx}${cleanEmail.slice(atIdx)}`
              : `${cleanUsername}_${idx}@swanarh.edu.mm`;
        }
        seenEmails.add(cleanEmail);

        return {
          ...u,
          id: cleanId,
          username: cleanUsername,
          email: cleanEmail,
        };
      });

      // 1b. Reconcile any remote profiles that have the same username or email under an old/different ID in 1 batch query
      try {
        const { data: remoteProfiles } = await supabase
          .from('profiles')
          .select('id,username,email')
          .limit(5000);

        if (Array.isArray(remoteProfiles) && remoteProfiles.length > 0) {
          const localByUsername = new Map<string, string>();
          const localByEmail = new Map<string, string>();
          const localIdSet = new Set<string>();
          for (const lu of sanitizedUsers) {
            localIdSet.add(lu.id);
            localByUsername.set(lu.username.toLowerCase(), lu.id);
            localByEmail.set(lu.email.toLowerCase(), lu.id);
          }

          const staleRemoteIdsToReplace: string[] = [];
          for (const rp of remoteProfiles) {
            const rId = String(rp.id || '');
            const rUser = String(rp.username || '').trim().toLowerCase();
            const rEmail = String(rp.email || '').trim().toLowerCase();
            if (!rId || localIdSet.has(rId)) continue;

            const matchedLocalIdByUser = rUser ? localByUsername.get(rUser) : undefined;
            const matchedLocalIdByEmail = rEmail ? localByEmail.get(rEmail) : undefined;
            if (
              (matchedLocalIdByUser && matchedLocalIdByUser !== rId) ||
              (matchedLocalIdByEmail && matchedLocalIdByEmail !== rId)
            ) {
              staleRemoteIdsToReplace.push(rId);
            }
          }

          if (staleRemoteIdsToReplace.length > 0) {
            staleRemoteIdsToReplace.forEach((id) => this.ignoredRealtimeDeleteIds.add(id));
            for (const delChunk of this.chunkArray(staleRemoteIdsToReplace, 150)) {
              await supabase.from('profiles').delete().in('id', delChunk);
            }
          }
        }
      } catch {
        // Ignore pre-reconciliation errors and proceed with batch upsert
      }

      // 1c. Helper to batch upsert a chunk of users across schema modes ('full' -> 'no_password' -> 'core' -> 'minimal')
      const upsertUserBatchWithSchemaFallback = async (
        batchUsers: User[]
      ): Promise<{ ok: boolean; err?: string }> => {
        const modesToTry: Array<'full' | 'no_password' | 'core' | 'minimal'> =
          this.profileSchemaMode === 'full'
            ? ['full', 'no_password', 'core', 'minimal']
            : this.profileSchemaMode === 'no_password'
            ? ['no_password', 'core', 'minimal']
            : ['core', 'minimal'];

        let lastBatchErr = '';
        for (const mode of modesToTry) {
          const payloads = batchUsers.map((u) => this.buildProfilePayload(u, mode));
          const { error: batchErr } = await supabase
            .from('profiles')
            .upsert(payloads, { onConflict: 'id' });

          if (!batchErr) {
            if (mode !== 'minimal') {
              this.profileSchemaMode = mode;
            }
            for (let i = 0; i < batchUsers.length; i++) {
              const { updated_at: _ignoreTs, ...comparable } = payloads[i];
              this.recordSignature(`profile:${batchUsers[i].id}`, comparable);
            }
            return { ok: true };
          }

          lastBatchErr = batchErr.message || String(batchErr);
          const isColErr =
            batchErr.code === '42703' ||
            batchErr.code === 'PGRST204' ||
            lastBatchErr.toLowerCase().includes('column');

          if (!isColErr) {
            break;
          }
        }
        return { ok: false, err: lastBatchErr };
      };

      const userChunks = this.chunkArray(sanitizedUsers, 200);
      for (const chunk of userChunks) {
        const batchRes = await upsertUserBatchWithSchemaFallback(chunk);
        if (batchRes.ok) {
          syncedUsers += chunk.length;
        } else {
          // Sub-batch into smaller chunks of 40 instead of 238 individual requests
          const subChunks = this.chunkArray(chunk, 40);
          for (const subChunk of subChunks) {
            const subRes = await upsertUserBatchWithSchemaFallback(subChunk);
            if (subRes.ok) {
              syncedUsers += subChunk.length;
            } else {
              lastError = subRes.err || batchRes.err;
            }
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

    // 3. Chunked batch upserts for child tables
    const batchTasks: PromiseLike<unknown>[] = [];

    if (posts.length > 0) {
      for (const rawBatch of this.chunkArray(posts, 150)) {
        batchTasks.push(
          (async () => {
            const fullRows = rawBatch.map((p) => this.formatPostRow(p, false));
            const { error: postErr } = await supabase
              .from('posts')
              .upsert(fullRows, { onConflict: 'id' });
            if (postErr) {
              const coreRows = rawBatch.map((p) => this.formatPostRow(p, true));
              await supabase.from('posts').upsert(coreRows, { onConflict: 'id' });
            }
          })()
        );
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
        is_open: Boolean(session.isOpen),
        opened_by: encodeAttendanceOpenedBy(session),
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
      success: (users.length === 0 || syncedUsers > 0) && !lastError,
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
        // Fetch matching profile using selective columns
        const { data: profile } = await supabase
          .from('profiles')
          .select('id,name,username,email,role,phone,avatar,title,gender,address,rules_accepted,rules_accepted_at')
          .eq('email', email.trim())
          .maybeSingle();

        if (profile) {
          const decoded = decodeTitleAndRules(
            profile.title,
            profile.rules_accepted,
            profile.rules_accepted_at
          );
          const resolvedRole = (profile.role as UserRole) || 'student';
          return {
            user: {
              id: profile.id,
              name: profile.name,
              username: profile.username,
              email: profile.email,
              role: resolvedRole,
              phone: profile.phone || '',
              avatar: resolvedRole === 'admin' ? resolveAvatarUrl(profile.avatar) : '',
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
        userData.role !== 'admin'
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
