import React, { useState, useEffect, useRef, Suspense } from 'react';
import { User, Course, CoursePost, Assignment, Quiz, StudentProgress, CertificateData, NotificationItem } from './types/classroom';
import { ClassroomDB } from './services/storage';
import { resolveAvatarUrl, DEFAULT_AVATAR_SVG } from './data/presetAvatars';
import { useBackHandler } from './utils/backNavigation';
import { LoginView } from './components/LoginView';
import { Navbar } from './components/Navbar';
import { CourseCard } from './components/CourseCard';
import { LowBandwidthBar } from './components/LowBandwidthBar';
import { CourseDetail } from './components/CourseDetail';
import { CertificateModal } from './components/CertificateModal';
import { SecurityArchitectureModal } from './components/SecurityArchitectureModal';
import { CreateCourseModal } from './components/CreateCourseModal';
import { AdminStudentDirectoryModal } from './components/AdminStudentDirectoryModal';
import { SupabaseModal } from './components/SupabaseModal';
import { AcademyRulesModal } from './components/AcademyRulesModal';
import { AdminAuditLogModal } from './components/AdminAuditLogModal';
import {
  BookOpen,
  Plus,
  ShieldCheck,
  Users,
  AlertTriangle,
  Lock,
  Layers,
  LogOut,
  Search,
  Database,
  ScrollText,
  CheckCircle2,
  Bell,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  GripVertical,
  Check,
  History,
} from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => ClassroomDB.getCurrentUser());
  const [allUsers, setAllUsers] = useState<User[]>(() => ClassroomDB.getAllUsers());
  const [courses, setCourses] = useState<Course[]>(() => {
    const user = ClassroomDB.getCurrentUser();
    return user ? ClassroomDB.getCourses(user) : [];
  });
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const selectedCourseRef = useRef<Course | null>(null);
  selectedCourseRef.current = selectedCourse;
  const [courseSearch, setCourseSearch] = useState('');

  // Active course data
  const [posts, setPosts] = useState<CoursePost[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [progress, setProgress] = useState<StudentProgress>({
    studentId: '',
    courseId: '',
    completedLessonIds: [],
    completedAssignmentIds: [],
    passedQuizIds: [],
  });
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    const user = ClassroomDB.getCurrentUser();
    return user ? ClassroomDB.getNotifications(user.id) : [];
  });

  // Modals & Drawers
  const [activeCertificate, setActiveCertificate] = useState<CertificateData | null>(null);
  const [showArchitectureModal, setShowArchitectureModal] = useState(false);
  const [showCreateCourseModal, setShowCreateCourseModal] = useState(false);
  const [showStudentDirectoryModal, setShowStudentDirectoryModal] = useState(false);
  const [showSupabaseModal, setShowSupabaseModal] = useState(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showAuditLogModal, setShowAuditLogModal] = useState(false);
  const [showReorderPanel, setShowReorderPanel] = useState(false);
  const [draggedCourseId, setDraggedCourseId] = useState<string | null>(null);
  const [appBannerError, setAppBannerError] = useState<string | null>(null);

  // Mobile Back Key step-by-step navigation handlers (outer to inner)
  useBackHandler(!!selectedCourse, () => setSelectedCourse(null));
  useBackHandler(!!activeCertificate, () => setActiveCertificate(null));
  useBackHandler(showArchitectureModal, () => setShowArchitectureModal(false));
  useBackHandler(showCreateCourseModal, () => setShowCreateCourseModal(false));
  useBackHandler(showStudentDirectoryModal, () => setShowStudentDirectoryModal(false));
  useBackHandler(showSupabaseModal, () => setShowSupabaseModal(false));
  useBackHandler(showResetConfirmModal, () => setShowResetConfirmModal(false));
  useBackHandler(showRulesModal, () => setShowRulesModal(false));
  useBackHandler(showAuditLogModal, () => setShowAuditLogModal(false));

  // Performance & Theme Settings
  const [isLowBandwidth, setIsLowBandwidth] = useState(false);
  const isLowBandwidthRef = useRef(false);
  isLowBandwidthRef.current = isLowBandwidth;
  const [theme, setTheme] = useState<'light' | 'dark'>(() => ClassroomDB.getTheme());
  const [, setRefreshTick] = useState(0);

  const handleToggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    ClassroomDB.setTheme(nextTheme);
  };

  // Reload data when user changes or action taken
  const refreshData = () => {
    setRefreshTick((t) => t + 1);
    const user = ClassroomDB.getCurrentUser();
    setCurrentUser(user);
    setAllUsers(ClassroomDB.getAllUsers());

    if (!user) {
      setCourses([]);
      setNotifications([]);
      setSelectedCourse(null);
      return;
    }

    // Strict Course Access Control (RLS simulation)
    const userCourses = ClassroomDB.getCourses(user);
    setCourses(userCourses);

    // Notifications
    setNotifications(ClassroomDB.getNotifications(user.id));

    // If a course is selected, refresh its child items using ref so background intervals never see stale null state
    const activeCourse = selectedCourseRef.current;
    if (activeCourse) {
      const verify = ClassroomDB.getCourseById(activeCourse.id, user);
      if (!verify.course) {
        setSelectedCourse(null);
      } else {
        setSelectedCourse(verify.course);
        setPosts(ClassroomDB.getPostsForCourse(verify.course.id, user));
        setAssignments(ClassroomDB.getAssignments(verify.course.id));
        setQuizzes(ClassroomDB.getQuizzes(verify.course.id));
        setProgress(ClassroomDB.getStudentProgress(user.id, verify.course.id));
      }
    }
  };

  useEffect(() => {
    // Allow first paint of LoginView or Dashboard to complete immediately before running network sync
    const initTimer = setTimeout(() => {
      ClassroomDB.init();
      ClassroomDB.purgeExpiredAuditLogs(true);
      refreshData();
      const loggedUser = ClassroomDB.getCurrentUser();
      if (loggedUser) {
        const isAlreadyCloudSynced =
          localStorage.getItem('classroom_os_cloud_synced_v1') === 'true';
        ClassroomDB.pullFromSupabase({
          force: !isAlreadyCloudSynced,
          background: isAlreadyCloudSynced,
        }).then((updated) => {
          if (updated || !ClassroomDB.getCurrentUser()) {
            refreshData();
          }
        });
      }
    }, 30);

    // Multi-user / multi-tab synchronization
    const handleStorageChange = () => {
      refreshData();
    };
    window.addEventListener('storage', handleStorageChange);

    let lastUserInteractionAt = Date.now();
    const markUserActive = () => {
      const wasIdle = Date.now() - lastUserInteractionAt > 360_000;
      lastUserInteractionAt = Date.now();
      if (wasIdle && document.visibilityState === 'visible' && navigator.onLine !== false) {
        const loggedUser = ClassroomDB.getCurrentUser();
        if (loggedUser) {
          ClassroomDB.pullFromSupabase({ background: true }).then((updated) => {
            if (updated || !ClassroomDB.getCurrentUser()) {
              refreshData();
            }
          });
        }
      }
    };
    window.addEventListener('pointerdown', markUserActive, { passive: true });
    window.addEventListener('keydown', markUserActive, { passive: true });
    window.addEventListener('touchstart', markUserActive, { passive: true });

    // When refreshing, focusing, or reopening the installed PWA from the background,
    // throttle cloud pulls to at most once per 60s and use lightweight delta sync unless hidden >5 minutes
    let lastWakeUpPullAt = Date.now();
    let lastHiddenAt = 0;
    const handleWakeUp = () => {
      if (document.visibilityState === 'hidden') {
        lastHiddenAt = Date.now();
        return;
      }
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        lastUserInteractionAt = now;
        ClassroomDB.purgeExpiredAuditLogs(false);
        ClassroomDB.checkAndPublishDueScheduledPosts();
        refreshData();

        const loggedUser = ClassroomDB.getCurrentUser();
        if (loggedUser && navigator.onLine !== false && !isLowBandwidthRef.current) {
          // Lightweight 0.3KB delta attendance check (throttled internally to 12s)
          ClassroomDB.syncAttendanceFromCloud().then((attChanged) => {
            if (attChanged) refreshData();
          });

          // Only trigger a cloud pull if at least 60s elapsed since last wake-up pull
          if (now - lastWakeUpPullAt >= 60_000) {
            const wasHiddenLong = lastHiddenAt > 0 && now - lastHiddenAt > 300_000;
            lastWakeUpPullAt = now;
            lastHiddenAt = 0;
            ClassroomDB.pullFromSupabase(
              wasHiddenLong ? { force: true } : { background: true }
            ).then((updated) => {
              if (updated || !ClassroomDB.getCurrentUser()) {
                refreshData();
              }
            });
          }
        }
      }
    };
    document.addEventListener('visibilitychange', handleWakeUp);
    window.addEventListener('pageshow', handleWakeUp);
    window.addEventListener('focus', handleWakeUp);

    // Egress-optimized background sync (180s–240s jittered when user is active; auto-pauses when idle >6m)
    const jitteredIntervalMs = 180000 + Math.floor(Math.random() * 60000);
    const syncInterval = setInterval(() => {
      const isUserActive = Date.now() - lastUserInteractionAt <= 360_000;
      if (
        isUserActive &&
        document.visibilityState === 'visible' &&
        navigator.onLine !== false &&
        !isLowBandwidthRef.current
      ) {
        const loggedUser = ClassroomDB.getCurrentUser();
        if (loggedUser) {
          ClassroomDB.pullFromSupabase({ background: true }).then((updated) => {
            if (updated || !ClassroomDB.getCurrentUser()) {
              refreshData();
            }
          });
        }
      }
    }, jitteredIntervalMs);

    // 10-second timer to immediately auto-publish any due scheduled posts and perform 0.3KB delta Attendance checks when active
    let attendanceTickCounter = 0;
    const scheduledPostsInterval = setInterval(() => {
      const publishedAny = ClassroomDB.checkAndPublishDueScheduledPosts();
      if (publishedAny) {
        refreshData();
      }
      attendanceTickCounter++;
      const isUserActive = Date.now() - lastUserInteractionAt <= 360_000;
      // Check every 20s (every 2nd tick) if any session is open locally, or every 60s (every 6th tick) when all sessions are closed
      const hasOpenLocalSession = ClassroomDB.getAttendanceSessions().some((s) => s.isOpen);
      const shouldPollAttendance =
        (hasOpenLocalSession && attendanceTickCounter % 2 === 0) ||
        attendanceTickCounter % 6 === 0;
      if (
        shouldPollAttendance &&
        isUserActive &&
        document.visibilityState === 'visible' &&
        navigator.onLine !== false &&
        !isLowBandwidthRef.current &&
        ClassroomDB.getCurrentUser()
      ) {
        ClassroomDB.syncAttendanceFromCloud().then((attChanged) => {
          if (attChanged) {
            refreshData();
          }
        });
      }
    }, 10000);

    // 30-second local timer to auto-delete notifications (>30 mins) and Audit Logs (>2 days / 48 hours)
    const notifCleanupInterval = setInterval(() => {
      const publishedDue = ClassroomDB.checkAndPublishDueScheduledPosts();
      const purgedNotifs = ClassroomDB.purgeExpiredNotifications();
      const purgedAudit = ClassroomDB.purgeExpiredAuditLogs();
      if (publishedDue || purgedNotifs || purgedAudit) {
        refreshData();
      }
    }, 30000);

    // Automatically sync immediately whenever internet connection is restored
    const handleOnline = () => {
      lastUserInteractionAt = Date.now();
      const loggedUser = ClassroomDB.getCurrentUser();
      if (loggedUser) {
        ClassroomDB.pullFromSupabase({ force: true }).then((updated) => {
          if (updated || !ClassroomDB.getCurrentUser()) {
            refreshData();
          }
        });
      }
    };
    window.addEventListener('online', handleOnline);

    return () => {
      clearTimeout(initTimer);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('pointerdown', markUserActive);
      window.removeEventListener('keydown', markUserActive);
      window.removeEventListener('touchstart', markUserActive);
      document.removeEventListener('visibilitychange', handleWakeUp);
      window.removeEventListener('pageshow', handleWakeUp);
      window.removeEventListener('focus', handleWakeUp);
      window.removeEventListener('online', handleOnline);
      clearInterval(syncInterval);
      clearInterval(scheduledPostsInterval);
      clearInterval(notifCleanupInterval);
    };
  }, []);

  const handleSelectUser = (user: User) => {
    ClassroomDB.setCurrentUser(user);
    setCurrentUser(user);
    const userCourses = ClassroomDB.getCourses(user);
    setCourses(userCourses);
    setNotifications(ClassroomDB.getNotifications(user.id));

    if (selectedCourse) {
      const isAllowed =
        user.role === 'admin' ||
        user.role === 'co_admin' ||
        selectedCourse.enrolledStudentIds.includes(user.id);
      if (!isAllowed) {
        setSelectedCourse(null);
      } else {
        setPosts(ClassroomDB.getPostsForCourse(selectedCourse.id, user));
        setAssignments(ClassroomDB.getAssignments(selectedCourse.id));
        setQuizzes(ClassroomDB.getQuizzes(selectedCourse.id));
        setProgress(ClassroomDB.getStudentProgress(user.id, selectedCourse.id));
      }
    }
  };

  const handleLogout = () => {
    ClassroomDB.logout();
    setCurrentUser(null);
    setSelectedCourse(null);
    setCourses([]);
  };

  const handleOpenCourse = (course: Course) => {
    if (!currentUser) return;
    const check = ClassroomDB.getCourseById(course.id, currentUser);
    if (!check.course) {
      setAppBannerError(check.error || 'Access Denied: You are not enrolled in this course.');
      setTimeout(() => setAppBannerError(null), 5000);
      return;
    }

    setSelectedCourse(check.course);
    setPosts(ClassroomDB.getPostsForCourse(check.course.id, currentUser));
    setAssignments(ClassroomDB.getAssignments(check.course.id));
    setQuizzes(ClassroomDB.getQuizzes(check.course.id));
    setProgress(ClassroomDB.getStudentProgress(currentUser.id, check.course.id));
  };

  const handleOpenCourseById = (courseId: string) => {
    if (!currentUser) return;
    const target = courses.find((c) => c.id === courseId);
    if (target) {
      handleOpenCourse(target);
    }
  };

  const handleResetData = () => {
    setShowResetConfirmModal(true);
  };

  const confirmResetData = () => {
    ClassroomDB.resetAll();
    setSelectedCourse(null);
    setShowResetConfirmModal(false);
    refreshData();
  };

  // If user is not authenticated, display the dedicated Login View immediately
  if (!currentUser) {
    return (
      <>
        <LoginView
          onLoginSuccess={(user) => {
            setCurrentUser(user);
            refreshData();
          }}
          onOpenArchitecture={() => setShowArchitectureModal(true)}
          theme={theme}
          onToggleTheme={handleToggleTheme}
        />
        {showArchitectureModal && (
          <Suspense fallback={null}>
            <SecurityArchitectureModal
              isOpen={showArchitectureModal}
              onClose={() => setShowArchitectureModal(false)}
            />
          </Suspense>
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen neu-canvas text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-300">
      <Suspense fallback={null}>
        {/* Low Bandwidth & One-Click Update Bar */}
        <LowBandwidthBar
          isLowBandwidth={isLowBandwidth}
          onToggle={() => setIsLowBandwidth(!isLowBandwidth)}
          onRefreshData={refreshData}
        />

        {/* Top Bar Contract Navbar */}
        <Navbar
          currentUser={currentUser}
          allUsers={allUsers}
          onSelectUser={handleSelectUser}
          onLogout={handleLogout}
          onOpenArchitecture={() => setShowArchitectureModal(true)}
          onOpenStudentDirectory={() => setShowStudentDirectoryModal(true)}
          onOpenAuditLog={() => setShowAuditLogModal(true)}
          onOpenRules={() => setShowRulesModal(true)}
          onResetData={handleResetData}
          onNavigateHome={() => setSelectedCourse(null)}
          notifications={notifications}
          onRefreshNotifications={refreshData}
          onSelectNotificationCourse={handleOpenCourseById}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          onUpdateCurrentUser={(updated) => {
            setCurrentUser(updated);
            refreshData();
          }}
        />
      </Suspense>

      {/* Main Container - Responsive padding for mobile & desktop screens */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-5 sm:py-8">
        {/* Student Unread Classroom Post Notification Alert Banner */}
        {currentUser.role === 'student' &&
          notifications.some((n) => !n.isRead && n.type === 'post') && (() => {
            const latestPostNotif = notifications.find((n) => !n.isRead && n.type === 'post');
            if (!latestPostNotif) return null;
            return (
              <div className="mb-5 p-4 rounded-2xl neu-card ring-2 ring-indigo-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
                <div className="flex items-start sm:items-center gap-3 min-w-0">
                  <div className="p-2.5 rounded-xl bg-indigo-600 text-white shrink-0 shadow-xs">
                    <Bell className="w-4 h-4 animate-bounce" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate">
                      {latestPostNotif.title}
                    </div>
                    <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                      {latestPostNotif.message} ·{' '}
                      <span className="font-mono text-indigo-600 dark:text-indigo-400">
                        {latestPostNotif.createdAt}
                      </span>
                      {latestPostNotif.expiresAtMs && (
                        <span className="ml-1.5 font-mono text-amber-600 dark:text-amber-400 font-semibold">
                          (⏱ {Math.max(1, Math.ceil((latestPostNotif.expiresAtMs - Date.now()) / 60000))} မိနစ်အတွင်း Auto ပျက်မည်)
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      ClassroomDB.markNotificationRead(latestPostNotif.id);
                      refreshData();
                      if (latestPostNotif.courseId) {
                        handleOpenCourseById(latestPostNotif.courseId);
                      }
                    }}
                    className="px-3.5 py-2 rounded-xl neu-btn-indigo text-xs font-bold cursor-pointer"
                  >
                    အတန်းသို့ ဝင်ရောက်ဖတ်ရှုမည် →
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      ClassroomDB.markNotificationRead(latestPostNotif.id);
                      refreshData();
                    }}
                    className="px-2.5 py-2 rounded-xl neu-btn text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
                  >
                    ဖတ်ပြီး
                  </button>
                </div>
              </div>
            );
          })()}

        {appBannerError && (
          <div className="mb-5 p-4 rounded-2xl neu-inset text-rose-800 dark:text-rose-200 text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>{appBannerError}</span>
            </div>
            <button
              onClick={() => setAppBannerError(null)}
              className="text-xs font-semibold underline cursor-pointer shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}
        {selectedCourse ? (
          /* Active Course Workspace (Stream, Attendance, People) */
          <Suspense
            fallback={
              <div className="py-16 text-center text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                သင်ခန်းစာအခန်းကို ဖွင့်နေပါသည်...
              </div>
            }
          >
            <CourseDetail
              course={selectedCourse}
              currentUser={currentUser}
              posts={posts}
              onBack={() => setSelectedCourse(null)}
              onRefresh={refreshData}
              onOpenCertificate={(cert) => setActiveCertificate(cert)}
            />
          </Suspense>
        ) : (
          /* Dashboard: Course Catalog & Strict Enrollment View */
          <div className="space-y-7 sm:space-y-9">
            {/* Sculpted Neumorphic Welcome & Role Command Console (Mobile, Tablet & Web Responsive) */}
            <div className="neu-card rounded-3xl p-4 sm:p-6 lg:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6">
              <div className="flex items-start sm:items-center gap-3.5 sm:gap-4 min-w-0">
                {currentUser.role === 'admin' && (
                  <img
                    src={resolveAvatarUrl(currentUser.avatar)}
                    alt={currentUser.name}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = DEFAULT_AVATAR_SVG;
                    }}
                    className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-contain bg-white p-1 border-2 border-indigo-200 dark:border-indigo-700 shadow-sm shrink-0"
                  />
                )}
                <div className="space-y-1.5 sm:space-y-2 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-mono text-slate-600 dark:text-slate-400">
                    <span>
                      Logged in as:{' '}
                      <strong className="text-slate-900 dark:text-white">{currentUser.name}</strong>
                    </span>
                    {currentUser.role === 'student' && currentUser.rulesAccepted && (
                      <>
                        <span aria-hidden="true">·</span>
                        <button
                          type="button"
                          onClick={() => setShowRulesModal(true)}
                          className="neu-inset-sm inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-xl text-emerald-800 dark:text-emerald-300 font-sans font-bold text-[11px] cursor-pointer hover:text-emerald-600 transition-colors"
                          title="သင်တန်းစည်းကမ်းချက်များကို သိရှိလိုက်နာပါမည်ဟု အတည်ပြုပြီး"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>သိရှိ လိုက်နာပါမည်</span>
                        </button>
                      </>
                    )}
                    <span aria-hidden="true">·</span>
                    <span className="capitalize font-semibold text-indigo-600 dark:text-indigo-400">
                      Role:{' '}
                      {currentUser.role === 'admin'
                        ? 'Lead Mentor (Admin)'
                        : currentUser.role === 'co_admin'
                        ? 'Co-Admin (တွဲဖက် အက်ဒမင်)'
                        : 'Student (ကျောင်းသား)'}
                    </span>
                  </div>

                  <h1 className="text-lg sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 leading-tight">
                    {currentUser.role === 'admin' || currentUser.role === 'co_admin'
                      ? 'Faculty & Classroom Management'
                      : 'My Enrolled Classes'}
                  </h1>

                  {/* Clean Unboxed Security Rule Notice */}
                  <div className="flex items-start sm:items-center gap-2 text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 pt-0.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5 sm:mt-0" />
                    <span>
                      Strict Visibility Active: Unenrolled courses are physically excluded from dashboard queries.
                    </span>
                  </div>
                </div>
              </div>

              {/* Tactile Neumorphic Action Buttons (Responsive Grid on Mobile, Flex on Tablet & Desktop) */}
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-2.5 lg:justify-end shrink-0">
                <button
                  onClick={() => setShowRulesModal(true)}
                  className="neu-btn flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2.5 text-emerald-800 dark:text-emerald-300 text-xs font-bold rounded-2xl cursor-pointer"
                >
                  <ScrollText className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="truncate">စည်းကမ်းချက်များ</span>
                </button>

                {(currentUser.role === 'admin' || currentUser.role === 'co_admin') && (
                  <>
                    {currentUser.role === 'admin' && (
                      <button
                        onClick={() => setShowAuditLogModal(true)}
                        className="neu-btn flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2.5 text-amber-800 dark:text-amber-300 text-xs font-bold rounded-2xl cursor-pointer border border-amber-500/20"
                        title="Admin နှင့် Co-Admin တို့၏ လုပ်ဆောင်ချက် မှတ်တမ်းအားလုံးကို စစ်ဆေးရန်"
                      >
                        <History className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                        <span className="truncate">Audit Log</span>
                      </button>
                    )}

                    <button
                      onClick={() => setShowStudentDirectoryModal(true)}
                      className="neu-btn flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2.5 text-slate-800 dark:text-slate-100 text-xs font-bold rounded-2xl cursor-pointer"
                    >
                      <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <span className="truncate">Manage Users</span>
                    </button>

                    <button
                      onClick={() => setShowCreateCourseModal(true)}
                      className="neu-btn-indigo flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2.5 text-white text-xs font-bold rounded-2xl cursor-pointer"
                    >
                      <Plus className="w-4 h-4 shrink-0" />
                      <span className="truncate">Create Class</span>
                    </button>
                  </>
                )}

                <button
                  onClick={handleLogout}
                  className="neu-btn col-span-2 sm:col-span-1 flex items-center justify-center gap-1.5 px-3.5 py-2.5 text-rose-700 dark:text-rose-300 text-xs font-bold rounded-2xl cursor-pointer"
                >
                  <LogOut className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>

            {/* Course Grid Header & Carved Search Bar */}
            <div className="space-y-5 min-w-0">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="neu-inset-sm p-2.5 rounded-2xl text-indigo-600 dark:text-indigo-400 shrink-0">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100 truncate">
                        {currentUser.role === 'admin' || currentUser.role === 'co_admin'
                          ? 'All Managed Classes'
                          : 'Authorized Courses'}
                      </h2>
                      <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        ({courses.length})
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {currentUser.role === 'admin' || currentUser.role === 'co_admin'
                        ? 'အတန်းများကို စိတ်ကြိုက် အစီအစဉ် (Order) စီနိုင်ပြီး ပြောင်းလဲမှုအားလုံး စက်အားလုံးတွင် တန်းပြောင်းပါသည်'
                        : 'သင်တက်ရောက်ခွင့်ရရှိထားသော အတန်းများသို့ ဝင်ရောက်၍ သင်ခန်းစာများ လေ့လာနိုင်ပါသည်'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
                  {/* Admin / Co-Admin Custom Classroom Order Button */}
                  {(currentUser.role === 'admin' || currentUser.role === 'co_admin') && courses.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setShowReorderPanel((prev) => !prev)}
                      className={`flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                        showReorderPanel
                          ? 'neu-btn-indigo text-white'
                          : 'neu-btn text-indigo-700 dark:text-indigo-300'
                      }`}
                    >
                      <ArrowUpDown className="w-4 h-4" />
                      <span>
                        {showReorderPanel
                          ? '✓ အစီအစဉ်စီခြင်း ပြီးပြီ (Done)'
                          : 'အတန်းများ အစီအစဉ်စီရန် (Order Classes)'}
                      </span>
                    </button>
                  )}

                  {/* Carved Neumorphic Course Search Filter */}
                  <div className="relative w-full sm:w-64 md:w-72">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search courses or batches..."
                      value={courseSearch}
                      onChange={(e) => setCourseSearch(e.target.value)}
                      className="neu-input w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-2xl"
                    />
                  </div>
                </div>
              </div>

              {/* Interactive Custom Classroom Order Manager Panel for Admin & Co-Admin */}
              {showReorderPanel && (currentUser.role === 'admin' || currentUser.role === 'co_admin') && courses.length > 1 && (
                <div className="neu-raised rounded-3xl p-4 sm:p-5 border border-indigo-500/20 space-y-3.5 animate-in fade-in duration-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-200/70 dark:border-slate-800">
                    <div>
                      <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                        <ArrowUpDown className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        <span>Custom Classroom Order (အတန်းများ စိတ်ကြိုက် အစီအစဉ်စီရန်)</span>
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Drag ဆွဲ၍ဖြစ်စေ၊ <strong>↑ / ↓</strong> ခလုတ် သို့မဟုတ် အမှတ်စဉ် ရွေးချယ်၍ဖြစ်စေ စိတ်ကြိုက်စီနိုင်ပါသည်။ စီထားသည့်အတိုင်း Admin, Co-Admin နှင့် ကျောင်းသားအားလုံးထံတွင် တန်းပေါ်ပါမည်။
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowReorderPanel(false)}
                      className="self-end sm:self-center px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0 shadow-xs"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>သိမ်းဆည်းပြီး ပိတ်မည်</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {courses.map((course, idx) => (
                      <div
                        key={course.id}
                        draggable
                        onDragStart={() => setDraggedCourseId(course.id)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => {
                          if (!draggedCourseId || draggedCourseId === course.id) return;
                          const ids = courses.map((c) => c.id);
                          const fromIdx = ids.indexOf(draggedCourseId);
                          const toIdx = ids.indexOf(course.id);
                          if (fromIdx !== -1 && toIdx !== -1) {
                            ids.splice(fromIdx, 1);
                            ids.splice(toIdx, 0, draggedCourseId);
                            ClassroomDB.reorderCourses(ids);
                            refreshData();
                          }
                          setDraggedCourseId(null);
                        }}
                        onDragEnd={() => setDraggedCourseId(null)}
                        className={`neu-inset-sm rounded-2xl p-2.5 sm:p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-all ${
                          draggedCourseId === course.id ? 'opacity-50 ring-2 ring-indigo-500' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="text-slate-400 cursor-grab active:cursor-grabbing shrink-0 hidden sm:block">
                            <GripVertical className="w-4 h-4" />
                          </div>
                          <span className="w-7 h-7 rounded-xl bg-indigo-600 text-white font-mono text-xs font-extrabold flex items-center justify-center shrink-0 shadow-2xs">
                            #{idx + 1}
                          </span>
                          <img
                            src={course.bannerImage}
                            alt={course.title}
                            referrerPolicy="no-referrer"
                            className="w-12 h-7 rounded-lg object-cover shrink-0 border border-slate-300 dark:border-slate-700 hidden xs:block"
                          />
                          <div className="min-w-0">
                            <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                              {course.title}
                            </div>
                            <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                              {course.code} · {course.batch} · {course.enrolledStudentIds.length} students
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-1.5 shrink-0">
                          <select
                            value={idx + 1}
                            onChange={(e) => {
                              ClassroomDB.moveCourseOrder(course.id, Number(e.target.value));
                              refreshData();
                            }}
                            className="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-mono font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
                            title="Move to specific position"
                          >
                            {courses.map((_, posIdx) => (
                              <option key={posIdx + 1} value={posIdx + 1}>
                                အမှတ်စဉ် #{posIdx + 1}
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => {
                              ClassroomDB.moveCourseOrder(course.id, 'top');
                              refreshData();
                            }}
                            className="px-2 py-1 rounded-lg bg-slate-200/80 dark:bg-slate-800 hover:bg-indigo-100 dark:hover:bg-indigo-950 text-[11px] font-bold text-slate-700 dark:text-slate-300 disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                            title="ထိပ်ဆုံး (#1) သို့ပို့မည်"
                          >
                            Top #1
                          </button>

                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => {
                              ClassroomDB.moveCourseOrder(course.id, 'up');
                              refreshData();
                            }}
                            className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 text-slate-700 dark:text-slate-200 disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                            title="အပေါ်သို့ ရွှေ့မည် (Move Up)"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            disabled={idx === courses.length - 1}
                            onClick={() => {
                              ClassroomDB.moveCourseOrder(course.id, 'down');
                              refreshData();
                            }}
                            className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 text-slate-700 dark:text-slate-200 disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                            title="အောက်သို့ ရွှေ့မည် (Move Down)"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {courses.length === 0 ? (
                <div className="neu-card p-8 sm:p-12 text-center rounded-3xl text-slate-500 dark:text-slate-400">
                  <div className="neu-inset-sm w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-3 text-slate-400 dark:text-slate-500">
                    <Lock className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    No Authorized Courses Found
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                    You are not currently enrolled in any active class cohorts. Please contact the Academy Faculty to obtain batch authorization.
                  </p>
                </div>
              ) : (
                <Suspense fallback={null}>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
                    {courses
                      .filter((c) => {
                        if (!courseSearch.trim()) return true;
                        const q = courseSearch.toLowerCase();
                        return (
                          c.title.toLowerCase().includes(q) ||
                          c.code.toLowerCase().includes(q) ||
                          c.batch.toLowerCase().includes(q)
                        );
                      })
                      .map((course) => {
                        const studentProg = ClassroomDB.getStudentProgress(currentUser.id, course.id);
                        const fullIdx = courses.findIndex((c) => c.id === course.id);

                        return (
                          <CourseCard
                            key={course.id}
                            course={course}
                            currentUser={currentUser}
                            progress={studentProg}
                            courseIndex={fullIdx >= 0 ? fullIdx : 0}
                            totalCourses={courses.length}
                            onSelectCourse={handleOpenCourse}
                            onRefresh={refreshData}
                          />
                        );
                      })}
                  </div>
                </Suspense>
              )}
            </div>
          </div>
        )}
      </main>

      <Suspense fallback={null}>
        {/* Verified Certificate Modal */}
        {activeCertificate && (
          <CertificateModal
            certificate={activeCertificate}
            isOpen={!!activeCertificate}
            onClose={() => setActiveCertificate(null)}
          />
        )}

        {/* Technical Architecture & Deliverables Modal */}
        {showArchitectureModal && (
          <SecurityArchitectureModal
            isOpen={showArchitectureModal}
            onClose={() => setShowArchitectureModal(false)}
          />
        )}

        {/* Admin Create Course & Batch Modal */}
        {showCreateCourseModal && (
          <CreateCourseModal
            isOpen={showCreateCourseModal}
            onClose={() => setShowCreateCourseModal(false)}
            currentUser={currentUser}
            onCourseCreated={() => refreshData()}
          />
        )}

        {/* Admin Student Directory & Enrolment Manager Modal */}
        {showStudentDirectoryModal && (
          <AdminStudentDirectoryModal
            isOpen={showStudentDirectoryModal}
            onClose={() => setShowStudentDirectoryModal(false)}
            courses={courses}
            onRefresh={refreshData}
          />
        )}

        {/* Supabase Integration & SQL Setup Modal */}
        {showSupabaseModal && (
          <SupabaseModal
            isOpen={showSupabaseModal}
            onClose={() => setShowSupabaseModal(false)}
          />
        )}

        {/* Primary Admin Security Audit Log Modal */}
        {showAuditLogModal && (
          <AdminAuditLogModal
            isOpen={showAuditLogModal}
            onClose={() => setShowAuditLogModal(false)}
            currentUser={currentUser}
            allUsers={allUsers}
            courses={courses}
          />
        )}

        {/* Academy Rules & Regulations Modal (Mandatory on Student First Login, or Viewable Anytime) */}
        {(showRulesModal || (currentUser.role === 'student' && !currentUser.rulesAccepted)) && (
          <AcademyRulesModal
            isOpen={true}
            currentUser={currentUser}
            allUsers={allUsers}
            isMandatory={currentUser.role === 'student' && !currentUser.rulesAccepted}
            onAcceptRules={() => {
              const updated = ClassroomDB.acceptAcademyRules(currentUser.id);
              if (updated) {
                setCurrentUser(updated);
              }
              setShowRulesModal(false);
              refreshData();
            }}
            onClose={() => setShowRulesModal(false)}
            onLogout={handleLogout}
          />
        )}

        {/* Primary Admin Local Cache Reset Confirmation Modal */}
        {showResetConfirmModal && currentUser.role === 'admin' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
            <div className="neu-raised w-full max-w-md rounded-2xl p-6 border border-rose-500/20">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Reset Local Demo Data?
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Primary Admin Action Only
                  </p>
                </div>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-5">
                ဤလုပ်ဆောင်ချက်သည် ယခု Browser ပေါ်ရှိ Local Cache Data များကို မူလ Default အနေအထားသို့ ပြန်လည်သတ်မှတ်ပြီး Supabase Cloud မှ Data အသစ်များကို ပြန်လည်ဆွဲယူပေးမည် ဖြစ်ပါသည်။
              </p>
              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowResetConfirmModal(false)}
                  className="neu-btn px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmResetData}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-sm cursor-pointer"
                >
                  Confirm Reset
                </button>
              </div>
            </div>
          </div>
        )}
      </Suspense>

      {/* Quiet Footer */}
      <footer className="mt-auto py-6 text-center text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>Dr. Si Thu Aung · Swanarh Academy · Classroom OS Learning Platform</span>
          <div className="flex items-center gap-3 text-slate-400 dark:text-slate-500">
            <span>Row-Level Security</span>
            <span>·</span>
            <span>Client-Side Cache Engine</span>
            <span>·</span>
            <span>Mobile-First Engine</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
