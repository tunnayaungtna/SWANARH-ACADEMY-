import React, { useState, useEffect, useRef, Suspense } from 'react';
import { User, Course, CoursePost, Assignment, Quiz, StudentProgress, CertificateData, NotificationItem } from './types/classroom';
import { ClassroomDB } from './services/storage';
import { useBackHandler } from './utils/backNavigation';
import { LoginView } from './components/LoginView';
import { Navbar } from './components/Navbar';
import { CourseCard } from './components/CourseCard';
import { LowBandwidthBar } from './components/LowBandwidthBar';
import { CourseDetail } from './components/CourseDetail';
import { CertificateModal } from './components/CertificateModal';
import { SecurityArchitectureModal } from './components/SecurityArchitectureModal';
import { SecurityControlsModal } from './components/SecurityControlsModal';
import { CreateCourseModal } from './components/CreateCourseModal';
import { AdminStudentDirectoryModal } from './components/AdminStudentDirectoryModal';
import { SupabaseModal } from './components/SupabaseModal';
import { AcademyRulesModal } from './components/AcademyRulesModal';
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
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [showCreateCourseModal, setShowCreateCourseModal] = useState(false);
  const [showStudentDirectoryModal, setShowStudentDirectoryModal] = useState(false);
  const [showSupabaseModal, setShowSupabaseModal] = useState(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [appBannerError, setAppBannerError] = useState<string | null>(null);

  // Mobile Back Key step-by-step navigation handlers (outer to inner)
  useBackHandler(!!selectedCourse, () => setSelectedCourse(null));
  useBackHandler(!!activeCertificate, () => setActiveCertificate(null));
  useBackHandler(showArchitectureModal, () => setShowArchitectureModal(false));
  useBackHandler(showSecurityModal, () => setShowSecurityModal(false));
  useBackHandler(showCreateCourseModal, () => setShowCreateCourseModal(false));
  useBackHandler(showStudentDirectoryModal, () => setShowStudentDirectoryModal(false));
  useBackHandler(showSupabaseModal, () => setShowSupabaseModal(false));
  useBackHandler(showResetConfirmModal, () => setShowResetConfirmModal(false));
  useBackHandler(showRulesModal, () => setShowRulesModal(false));

  // Performance & Security Settings
  const [isLowBandwidth, setIsLowBandwidth] = useState(false);
  const isLowBandwidthRef = useRef(false);
  isLowBandwidthRef.current = isLowBandwidth;
  const [securitySettings, setSecuritySettings] = useState(() => ClassroomDB.getSecuritySettings());
  const [theme, setTheme] = useState<'light' | 'dark'>(() => ClassroomDB.getTheme());

  const handleToggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    ClassroomDB.setTheme(nextTheme);
  };

  // Reload data when user changes or action taken
  const refreshData = () => {
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

    // Security
    setSecuritySettings(ClassroomDB.getSecuritySettings());

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
      refreshData();
      const loggedUser = ClassroomDB.getCurrentUser();
      if (loggedUser) {
        ClassroomDB.pullFromSupabase({ force: true }).then((updated) => {
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

    // When refreshing, focusing, or reopening the installed PWA from the background,
    // immediately pull authoritative remote state (courses, posts, deletions, and 1-device session lock)
    const handleWakeUp = () => {
      if (document.visibilityState === 'visible') {
        refreshData();
        const loggedUser = ClassroomDB.getCurrentUser();
        if (loggedUser) {
          ClassroomDB.pullFromSupabase({ force: true }).then((updated) => {
            if (updated || !ClassroomDB.getCurrentUser()) {
              refreshData();
            }
          });
        }
      }
    };
    document.addEventListener('visibilitychange', handleWakeUp);
    window.addEventListener('pageshow', handleWakeUp);
    window.addEventListener('focus', handleWakeUp);

    // Fast background sync (25s–35s jittered) so Admin/Co-Admin changes & single-device session enforcement reflect rapidly across devices
    const jitteredIntervalMs = 25000 + Math.floor(Math.random() * 10000);
    const syncInterval = setInterval(() => {
      if (
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

    // 20-second timer to auto-delete notifications older than 30 minutes locally & in Supabase
    const notifCleanupInterval = setInterval(() => {
      if (ClassroomDB.purgeExpiredNotifications()) {
        refreshData();
      }
    }, 20000);

    return () => {
      clearTimeout(initTimer);
      window.removeEventListener('storage', handleStorageChange);
      document.removeEventListener('visibilitychange', handleWakeUp);
      window.removeEventListener('pageshow', handleWakeUp);
      window.removeEventListener('focus', handleWakeUp);
      clearInterval(syncInterval);
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
    <div
      className={`min-h-screen neu-canvas text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-300 ${
        securitySettings.textProtectionEnabled ? 'select-none' : ''
      }`}
    >
      <Suspense fallback={null}>
        {/* Low Bandwidth Optimization Bar */}
        <LowBandwidthBar
          isLowBandwidth={isLowBandwidth}
          onToggle={() => setIsLowBandwidth(!isLowBandwidth)}
        />

        {/* Top Bar Contract Navbar */}
        <Navbar
          currentUser={currentUser}
          allUsers={allUsers}
          onSelectUser={handleSelectUser}
          onLogout={handleLogout}
          onOpenArchitecture={() => setShowArchitectureModal(true)}
          onOpenSecurity={() => setShowSecurityModal(true)}
          onOpenStudentDirectory={() => setShowStudentDirectoryModal(true)}
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
              textProtectionEnabled={securitySettings.textProtectionEnabled}
            />
          </Suspense>
        ) : (
          /* Dashboard: Course Catalog & Strict Enrollment View */
          <div className="space-y-7 sm:space-y-9">
            {/* Sculpted Neumorphic Welcome & Role Command Console */}
            <div className="neu-card rounded-3xl p-5 sm:p-7 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-5 sm:gap-6">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-600 dark:text-slate-400">
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
                        className="neu-inset-sm inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-emerald-800 dark:text-emerald-300 font-sans font-bold text-[11px] cursor-pointer hover:text-emerald-600 transition-colors"
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
                      ? 'Faculty / Admin (ဆရာ)'
                      : currentUser.role === 'co_admin'
                      ? 'Co-Admin (တွဲဖက် အက်ဒမင်)'
                      : 'Student (ကျောင်းသား)'}
                  </span>
                </div>

                <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                  {currentUser.role === 'admin' || currentUser.role === 'co_admin'
                    ? 'Faculty & Classroom Management'
                    : 'My Enrolled Classes'}
                </h1>

                {/* Clean Unboxed Security Rule Notice */}
                <div className="flex items-center gap-2 text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 pt-0.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>
                    Strict Visibility Active: Unenrolled courses are physically excluded from dashboard queries.
                  </span>
                </div>
              </div>

              {/* Tactile Neumorphic Action Buttons */}
              <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 shrink-0">
                <button
                  onClick={() => setShowRulesModal(true)}
                  className="neu-btn flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-2.5 text-emerald-800 dark:text-emerald-300 text-xs font-bold rounded-2xl cursor-pointer"
                >
                  <ScrollText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>စည်းကမ်းချက်များ</span>
                </button>

                {(currentUser.role === 'admin' || currentUser.role === 'co_admin') && (
                  <>
                    <button
                      onClick={() => setShowStudentDirectoryModal(true)}
                      className="neu-btn flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 text-slate-800 dark:text-slate-100 text-xs font-bold rounded-2xl cursor-pointer"
                    >
                      <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <span>Manage Users (အကောင့်များ စီမံရန်)</span>
                    </button>

                    <button
                      onClick={() => setShowCreateCourseModal(true)}
                      className="neu-btn-indigo flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 text-white text-xs font-bold rounded-2xl cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Create Class / Batch</span>
                    </button>

                    <button
                      onClick={() => setShowSupabaseModal(true)}
                      className="neu-btn flex items-center justify-center gap-1.5 px-3.5 py-2.5 text-emerald-800 dark:text-emerald-300 text-xs font-bold rounded-2xl cursor-pointer"
                      title="View Supabase configuration, connection test and SQL schema"
                    >
                      <Database className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Supabase SQL</span>
                    </button>

                    <button
                      onClick={() => setShowArchitectureModal(true)}
                      className="neu-btn flex items-center justify-center gap-1.5 px-3.5 py-2.5 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-2xl cursor-pointer"
                    >
                      <Layers className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                      <span>DB Spec</span>
                    </button>
                  </>
                )}

                <button
                  onClick={handleLogout}
                  className="neu-btn flex items-center justify-center gap-1.5 px-3.5 py-2.5 text-rose-700 dark:text-rose-300 text-xs font-bold rounded-2xl cursor-pointer"
                >
                  <LogOut className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>

            {/* Course Grid Header & Carved Search Bar */}
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
                <div className="flex items-center gap-3">
                  <div className="neu-inset-sm p-2.5 rounded-2xl text-indigo-600 dark:text-indigo-400">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100">
                        {currentUser.role === 'admin' || currentUser.role === 'co_admin'
                          ? 'All Managed Classes'
                          : 'Authorized Courses'}
                      </h2>
                      <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        ({courses.length})
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      သင်တက်ရောက်ခွင့်ရရှိထားသော အတန်းများသို့ ဝင်ရောက်၍ သင်ခန်းစာများ လေ့လာနိုင်ပါသည်
                    </p>
                  </div>
                </div>

                {/* Carved Neumorphic Course Search Filter */}
                <div className="relative w-full sm:w-72">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-7">
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

                        return (
                          <CourseCard
                            key={course.id}
                            course={course}
                            currentUser={currentUser}
                            progress={studentProg}
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

        {/* Content Security & Watermark Settings Modal */}
        {showSecurityModal && (
          <SecurityControlsModal
            isOpen={showSecurityModal}
            onClose={() => setShowSecurityModal(false)}
            currentUser={currentUser}
            onUpdate={refreshData}
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
            <span>Protected Video Playback</span>
            <span>·</span>
            <span>Row-Level Security</span>
            <span>·</span>
            <span>Mobile-First Engine</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
