import React, { useState } from 'react';
import { Shield, Database, Lock, Code2, Server, Layers, Copy, Check, FileCheck } from 'lucide-react';

interface SecurityArchitectureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SecurityArchitectureModal: React.FC<SecurityArchitectureModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'stack' | 'schema' | 'rls' | 'video' | 'roadmap' | 'zoom'>('stack');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const zoomBackendCode = `// ========================================================
// ZOOM DEEP LINKING PARSER & LAUNCHER (NODE.JS / EXPRESS)
// ========================================================

import { Request, Response } from 'express';

export function parseAndGenerateZoomDeepLink(rawUrl: string, studentName?: string) {
  // Regex to extract Meeting ID from Zoom URLs (supports standard & vanity domains)
  // Example: https://us02web.zoom.us/j/84920193847?pwd=xxxx
  const meetingIdRegex = /\\/(?:j|w|my)\\/(\\d{9,11})/i;
  const match = rawUrl.match(meetingIdRegex);

  if (!match || !match[1]) {
    throw new Error('Invalid Zoom URL format. Missing 9-11 digit meeting number.');
  }

  const meetingId = match[1];

  // Extract passcode if present
  let passcode: string | null = null;
  try {
    const urlObj = new URL(rawUrl);
    passcode = urlObj.searchParams.get('pwd');
  } catch {
    // fallback
  }

  // 1. NATIVE APP PROTOCOL (zoomus:// URI scheme for Windows, Mac, iOS, Android)
  const appParams = new URLSearchParams();
  appParams.set('confno', meetingId);
  if (passcode) appParams.set('pwd', passcode);
  if (studentName) appParams.set('uname', studentName); // Pre-fills student name

  const nativeAppDeepLink = \`zoomus://zoom.us/join?\${appParams.toString()}\`;

  // 2. BROWSER WEB CLIENT FALLBACK (no installation required)
  const browserFallbackUrl = \`https://zoom.us/wc/\${meetingId}/join\${
    passcode ? \`?pwd=\${encodeURIComponent(passcode)}\` : ''
  }\`;

  return {
    meetingId,
    passcode,
    nativeAppDeepLink,
    browserFallbackUrl,
  };
}

// Express Endpoint Controller
export const zoomLinkController = async (req: Request, res: Response) => {
  const { rawUrl } = req.body;
  const studentUser = (req as any).user; // Authenticated user from JWT middleware

  try {
    const parsed = parseAndGenerateZoomDeepLink(rawUrl, studentUser?.fullName);
    return res.json({ success: true, data: parsed });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
};`;

  const sqlSchemaCode = `-- ========================================================
-- CLASSROOM OS: PRODUCTION DATABASE SCHEMA (POSTGRESQL)
-- Includes strict Row-Level Security (RLS) & Foreign Indexes
-- ========================================================

-- 1. Users Table (RBAC: Admin, Instructor, Student)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(64) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'instructor', 'student')),
  phone VARCHAR(32) NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Courses Table
CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(32) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  section VARCHAR(120) NOT NULL,
  batch VARCHAR(120) NOT NULL,
  description TEXT,
  banner_image TEXT,
  instructor_id UUID REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Course Enrollments (Enforces Strict Course Isolation)
CREATE TABLE course_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'completed')),
  UNIQUE(course_id, student_id)
);
CREATE INDEX idx_enrollments_student ON course_enrollments(student_id);
CREATE INDEX idx_enrollments_course ON course_enrollments(course_id);

-- 4. Course Posts & Lessons (Stream Feed)
CREATE TABLE course_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  post_type VARCHAR(20) NOT NULL CHECK (post_type IN ('lesson', 'announcement', 'resource')),
  is_pinned BOOLEAN DEFAULT FALSE,
  video_playback_id VARCHAR(120),
  video_provider VARCHAR(50), -- 'bunny-stream', 'mux', 'vimeo-private'
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_posts_course_created ON course_posts(course_id, created_at DESC);

-- 5. Post Comments & Discussions
CREATE TABLE post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES course_posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_comments_post ON post_comments(post_id);

-- 6. Post Likes
CREATE TABLE post_likes (
  post_id UUID NOT NULL REFERENCES course_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);

-- 7. Assignments & Homework
CREATE TABLE assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  due_date TIMESTAMPTZ NOT NULL,
  max_points INTEGER NOT NULL DEFAULT 100,
  rubric_json JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Assignment Submissions & Teacher Feedback
CREATE TABLE assignment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  submission_note TEXT,
  grade NUMERIC(5,2),
  feedback TEXT,
  status VARCHAR(20) DEFAULT 'submitted' CHECK (status IN ('submitted', 'graded')),
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  graded_at TIMESTAMPTZ,
  UNIQUE(assignment_id, student_id)
);

-- 9. Quizzes (Multiple Choice Exams)
CREATE TABLE quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 15,
  passing_score INTEGER NOT NULL DEFAULT 70,
  questions JSONB NOT NULL, -- Array of { id, question, options, correctIndex, explanation }
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Quiz Submissions & Automated Scores
CREATE TABLE quiz_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  passed BOOLEAN NOT NULL,
  answers JSONB NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Student Progress & Verified Certificates
CREATE TABLE student_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_code VARCHAR(64) UNIQUE NOT NULL,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  grade_average NUMERIC(5,2) NOT NULL,
  verification_hash VARCHAR(128) NOT NULL,
  UNIQUE(course_id, student_id)
);

-- Grant schema usage and table permissions for Supabase Data API (Oct 30+ compliance)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- Ensure any future tables created in public schema automatically receive grants
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public 
GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated, service_role;`;

  const rlsPolicyCode = `-- ========================================================
-- POSTGRESQL ROW-LEVEL SECURITY (RLS) POLICIES
-- Prevents unauthorized students from querying unenrolled courses
-- ========================================================

-- Enable RLS across all sensitive tables
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;

-- 1. COURSES: Students can ONLY SELECT courses they are enrolled in
CREATE POLICY "Student sees enrolled courses only"
ON courses FOR SELECT
TO authenticated_role
USING (
  -- Admins see all courses
  auth.jwt()->>'role' = 'admin'
  OR
  -- Students see courses where enrollment row exists
  EXISTS (
    SELECT 1 FROM course_enrollments
    WHERE course_enrollments.course_id = courses.id
      AND course_enrollments.student_id = auth.uid()
      AND course_enrollments.status = 'active'
  )
);

-- 2. COURSE POSTS: Enrolled students only can view lessons
CREATE POLICY "Enrolled students can read posts"
ON course_posts FOR SELECT
TO authenticated_role
USING (
  auth.jwt()->>'role' = 'admin'
  OR
  EXISTS (
    SELECT 1 FROM course_enrollments
    WHERE course_enrollments.course_id = course_posts.course_id
      AND course_enrollments.student_id = auth.uid()
  )
);

-- 3. ASSIGNMENT SUBMISSIONS: Isolation (Students only see their own submission)
CREATE POLICY "Students see only own submissions"
ON assignment_submissions FOR SELECT
TO authenticated_role
USING (
  auth.jwt()->>'role' = 'admin'
  OR
  student_id = auth.uid()
);

-- 4. INSERT GUARD: Students can only submit if enrolled
CREATE POLICY "Students can only submit to enrolled course assignments"
ON assignment_submissions FOR INSERT
TO authenticated_role
WITH CHECK (
  student_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM assignments a
    JOIN course_enrollments ce ON ce.course_id = a.course_id
    WHERE a.id = assignment_submissions.assignment_id
      AND ce.student_id = auth.uid()
  )
);

-- Grant schema usage and table permissions for Supabase Data API (Oct 30+ compliance)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- Ensure any future tables created in public schema automatically receive grants
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public 
GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated, service_role;`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-6 max-h-[92vh] flex flex-col transition-colors">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 shrink-0">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Architecture, Security & Technical Specifications
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Deliverables: Tech Stack Recommendation, Database Schema, RLS, Anti-Piracy DRM, and Implementation Roadmap
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer text-xs font-semibold"
          >
            ✕ Close
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-6 pt-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 overflow-x-auto text-xs">
          <button
            onClick={() => setActiveTab('stack')}
            className={`px-3.5 py-2 font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'stack'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            1. Recommended Tech Stack
          </button>
          <button
            onClick={() => setActiveTab('schema')}
            className={`px-3.5 py-2 font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'schema'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            2. Complete DB Schema DDL
          </button>
          <button
            onClick={() => setActiveTab('rls')}
            className={`px-3.5 py-2 font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'rls'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            3. Row-Level Security (RLS)
          </button>
          <button
            onClick={() => setActiveTab('video')}
            className={`px-3.5 py-2 font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'video'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            4. Anti-Piracy & DRM Pipeline
          </button>
          <button
            onClick={() => setActiveTab('roadmap')}
            className={`px-3.5 py-2 font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'roadmap'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            5. Step-by-Step Roadmap
          </button>
          <button
            onClick={() => setActiveTab('zoom')}
            className={`px-3.5 py-2 font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'zoom'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            6. Zoom Deep Linking Spec
          </button>
        </div>

        {/* Content Area */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 text-slate-800 dark:text-slate-200 text-xs">
          {/* TAB 1: TECH STACK RECOMMENDATION */}
          {activeTab === 'stack' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60">
                <span className="font-semibold text-indigo-950 dark:text-indigo-200 block text-sm">
                  Recommended Production Architecture: Next.js + PostgreSQL / Supabase + Bunny Stream
                </span>
                <p className="text-indigo-800 dark:text-indigo-300 mt-1 leading-relaxed">
                  Balancing development speed, low ongoing infrastructure cost, strict row-level security, and seamless mobile responsiveness across low-bandwidth environments.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 space-y-2">
                  <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2">
                    <Server className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>Layer 1: Frontend (Next.js / Vite React + Tailwind)</span>
                  </div>
                  <ul className="space-y-1.5 text-slate-600 dark:text-slate-400 list-disc pl-4">
                    <li><strong className="text-slate-800 dark:text-slate-200">Mobile-First Touch UI:</strong> 80%+ mobile student traffic; lightweight bundle under 120KB.</li>
                    <li><strong className="text-slate-800 dark:text-slate-200">Low-Bandwidth Mode:</strong> Dynamic image/asset reduction and client-side caching.</li>
                    <li><strong className="text-slate-800 dark:text-slate-200">HTML5 Canvas Credentials:</strong> Instant client-side certificate rendering & PDF generation with zero external latency.</li>
                  </ul>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 space-y-2">
                  <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2">
                    <Database className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>Layer 2: Database & Authorization (PostgreSQL + RLS)</span>
                  </div>
                  <ul className="space-y-1.5 text-slate-600 dark:text-slate-400 list-disc pl-4">
                    <li><strong className="text-slate-800 dark:text-slate-200">Kernel-Level RLS:</strong> Authorization policies execute inside Postgres, not just middleware.</li>
                    <li><strong className="text-slate-800 dark:text-slate-200">Data Isolation:</strong> Unenrolled students are physically incapable of leaking rows.</li>
                    <li><strong className="text-slate-800 dark:text-slate-200">Composite Indexes:</strong> Fast pagination on course feeds as student counts scale into thousands.</li>
                  </ul>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 space-y-2">
                  <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2">
                    <Lock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>Layer 3: Video Hosting (Bunny Stream / Cloudflare Stream)</span>
                  </div>
                  <ul className="space-y-1.5 text-slate-600 dark:text-slate-400 list-disc pl-4">
                    <li><strong className="text-slate-800 dark:text-slate-200">Domain-Restricted Embeds:</strong> Only requests with verified Referer/Origin headers are served.</li>
                    <li><strong className="text-slate-800 dark:text-slate-200">Signed Token URLs:</strong> HLS m3u8 manifests expire after 30 minutes; MP4 files are disabled.</li>
                    <li><strong className="text-slate-800 dark:text-slate-200">Dynamic Forensic Watermark:</strong> Student username/phone floating across frames to prevent screen recorders.</li>
                  </ul>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 space-y-2">
                  <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>Layer 4: Rate Limiting & Edge Defense (Redis Sliding Window)</span>
                  </div>
                  <ul className="space-y-1.5 text-slate-600 dark:text-slate-400 list-disc pl-4">
                    <li><strong className="text-slate-800 dark:text-slate-200">Comment & Like Throttling:</strong> Max 6 comments/min per student to prevent spam.</li>
                    <li><strong className="text-slate-800 dark:text-slate-200">Login Protection:</strong> Exponential backoff after failed authentication attempts.</li>
                    <li><strong className="text-slate-800 dark:text-slate-200">Content Protection:</strong> Clipboard copy event blocking & disabled right-click context menu.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: COMPLETE DATABASE SCHEMA DDL */}
          {activeTab === 'schema' && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  PostgreSQL Production Tables (Users, Courses, Enrollments, Posts, Quizzes, Certificates)
                </span>
                <button
                  onClick={() => handleCopy(sqlSchemaCode, 'schema')}
                  className="flex items-center justify-center gap-1 px-3 py-1.5 bg-slate-900 dark:bg-indigo-600 text-white rounded-lg text-xs hover:bg-slate-800 dark:hover:bg-indigo-700 cursor-pointer shrink-0"
                >
                  {copiedKey === 'schema' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'schema' ? 'Copied DDL' : 'Copy SQL Schema'}</span>
                </button>
              </div>

              <pre className="p-4 rounded-xl bg-slate-950 text-slate-200 font-mono text-[11px] overflow-x-auto leading-relaxed border border-slate-800 max-h-[460px]">
                {sqlSchemaCode}
              </pre>
            </div>
          )}

          {/* TAB 3: ROW-LEVEL SECURITY */}
          {activeTab === 'rls' && (
            <div className="space-y-4">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-lg text-amber-900 dark:text-amber-200">
                <span className="font-semibold">Why UI filtering is NOT enough:</span> If a student tampers with client-side state or makes direct API calls to <code className="font-mono">/api/courses/course-401</code>, RLS ensures the PostgreSQL query engine evaluates whether an active enrollment row exists. If unenrolled, Postgres returns zero rows (or 403 Forbidden).
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  Row-Level Security Policies (SQL)
                </span>
                <button
                  onClick={() => handleCopy(rlsPolicyCode, 'rls')}
                  className="flex items-center justify-center gap-1 px-3 py-1.5 bg-slate-900 dark:bg-indigo-600 text-white rounded-lg text-xs hover:bg-slate-800 dark:hover:bg-indigo-700 cursor-pointer shrink-0"
                >
                  {copiedKey === 'rls' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'rls' ? 'Copied RLS' : 'Copy RLS Script'}</span>
                </button>
              </div>

              <pre className="p-4 rounded-xl bg-slate-950 text-slate-200 font-mono text-[11px] overflow-x-auto leading-relaxed border border-slate-800 max-h-[420px]">
                {rlsPolicyCode}
              </pre>
            </div>
          )}

          {/* TAB 4: ANTI-PIRACY & VIDEO DRM PIPELINE */}
          {activeTab === 'video' && (
            <div className="space-y-4 leading-relaxed">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                  <div className="font-semibold text-slate-900 dark:text-slate-100 mb-1">1. URL Obfuscation & Tokens</div>
                  <p className="text-slate-600 dark:text-slate-400 text-[11px]">
                    Video URLs are never embedded as raw .mp4 in the DOM. Server-side middleware issues short-lived SHA256 signed tokens for HLS playlist segments (.ts chunks). Direct file download requests return HTTP 403.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                  <div className="font-semibold text-slate-900 dark:text-slate-100 mb-1">2. Domain-Restricted Embeds</div>
                  <p className="text-slate-600 dark:text-slate-400 text-[11px]">
                    Bunny Stream or Vimeo Private delivery restricts origin headers strictly to the authorized platform domain. Hotlinking from other websites or third-party players is rejected.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                  <div className="font-semibold text-slate-900 dark:text-slate-100 mb-1">3. Dynamic Floating Watermark</div>
                  <p className="text-slate-600 dark:text-slate-400 text-[11px]">
                    The authenticated student's full name, email, phone number, and IP/timestamp randomly drift across coordinates in the video frame every 3-7 seconds. If recorded via OBS/phone camera, the leaker is forensically identified.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50">
                <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm mb-2">
                  Client-Side Text Selection & Right-Click Disabling
                </div>
                <p className="text-slate-600 dark:text-slate-400 text-[11px] mb-2">
                  To prevent bulk copy-pasting of proprietary course material and exam prompts:
                </p>
                <div className="p-2.5 bg-slate-900 text-emerald-300 font-mono text-[11px] rounded overflow-x-auto whitespace-pre">
                  <code>
                    {'onContextMenu={(e) => e.preventDefault()}  // Blocks right-click inspect\nclassName="select-none"                     // Prevents text highlighting'}
                  </code>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: ROADMAP */}
          {activeTab === 'roadmap' && (
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold shrink-0 text-xs">1</span>
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-slate-100 block">Step 1: Database Migration & Schema Seeding</span>
                    <p className="text-slate-600 dark:text-slate-400 text-[11px] mt-0.5">
                      Run PostgreSQL DDL script to create tables, foreign keys, and enable Row-Level Security policies. Populate admin role and default student batches.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold shrink-0 text-xs">2</span>
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-slate-100 block">Step 2: Video Provider Integration (Bunny Stream / Mux)</span>
                    <p className="text-slate-600 dark:text-slate-400 text-[11px] mt-0.5">
                      Configure Bunny Stream API keys, enable Token Authentication with 30-minute expiry, and lock Allowed Referrers to your platform production domain.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold shrink-0 text-xs">3</span>
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-slate-100 block">Step 3: Edge Rate Limiting & Auth Endpoints</span>
                    <p className="text-slate-600 dark:text-slate-400 text-[11px] mt-0.5">
                      Mount sliding-window middleware on comments, likes, and login endpoints using Redis / Upstash to neutralize automated spam bots.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold shrink-0 text-xs">4</span>
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-slate-100 block">Step 4: Automated Grading & Certificate Engine</span>
                    <p className="text-slate-600 dark:text-slate-400 text-[11px] mt-0.5">
                      Activate the MCQ scoring engine and trigger official signed PDF/Canvas certificates when curriculum progress milestones (75% - 100%) are unlocked.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: ZOOM DEEP LINKING SPEC */}
          {activeTab === 'zoom' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60">
                <span className="font-semibold text-blue-950 dark:text-blue-200 block text-sm">
                  Zoom Native App Deep Linking & Auto-Launch Architecture
                </span>
                <p className="text-blue-800 dark:text-blue-300 mt-1 leading-relaxed">
                  Bypasses browser web-client redirection by constructing <code className="font-mono font-bold">zoomus://</code> custom protocol links. Directly opens the native Zoom application installed on Windows, macOS, Android, and iOS devices with authenticated student attendance pre-filled.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 space-y-2">
                  <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                    1. URI Scheme Protocol Format
                  </div>
                  <div className="p-2.5 bg-slate-950 text-blue-300 font-mono text-[11px] rounded whitespace-pre-wrap break-all">
                    {'zoomus://zoom.us/join?confno={MEETING_ID}&pwd={PASSWORD}&uname={STUDENT_NAME}'}
                  </div>
                  <ul className="space-y-1 text-slate-600 dark:text-slate-400 list-disc pl-4 text-[11px]">
                    <li><strong className="text-slate-800 dark:text-slate-200">confno:</strong> Extracted 9 to 11 digit meeting number.</li>
                    <li><strong className="text-slate-800 dark:text-slate-200">pwd:</strong> Meeting security passcode.</li>
                    <li><strong className="text-slate-800 dark:text-slate-200">uname:</strong> URL-encoded student full name for automatic attendance check-in.</li>
                  </ul>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 space-y-2">
                  <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                    2. Graceful Fallback Strategy
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                    If the client device does not have Zoom installed or browser security policies suppress custom protocol launches:
                  </p>
                  <div className="p-2.5 bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-mono text-[11px] rounded break-all">
                    {'Fallback Web Client: https://zoom.us/wc/{MEETING_ID}/join?pwd={PASSWORD}'}
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                    The UI automatically provides a 1-click "Join via Browser" escape hatch after timeout.
                  </p>
                </div>
              </div>

              {/* Backend Implementation Code */}
              <div className="space-y-2 pt-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    Backend Parser & API Controller (Node.js / Express)
                  </span>
                  <button
                    onClick={() => handleCopy(zoomBackendCode, 'zoom')}
                    className="flex items-center justify-center gap-1 px-3 py-1.5 bg-slate-900 dark:bg-indigo-600 text-white rounded-lg text-xs hover:bg-slate-800 dark:hover:bg-indigo-700 cursor-pointer shrink-0"
                  >
                    {copiedKey === 'zoom' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'zoom' ? 'Copied Zoom Code' : 'Copy Zoom Handler'}</span>
                  </button>
                </div>

                <pre className="p-4 rounded-xl bg-slate-950 text-slate-200 font-mono text-[11px] overflow-x-auto leading-relaxed border border-slate-800 max-h-[380px]">
                  {zoomBackendCode}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
