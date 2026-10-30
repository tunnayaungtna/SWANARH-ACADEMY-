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

  // Performance & Security Settings
  const [isLowBandwidth, setIsLowBandwidth] = useState(false);
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
      ClassroomDB.pullFromSupabase().then((updated) => {
        if (updated) {
          refreshData();
        }
      });
    }, 50);

    // Multi-user / multi-tab synchronization
    const handleStorageChange = () => {
      refreshData();
    };
    window.addEventListener('storage', handleStorageChange);

    // When reopening the installed PWA from the background after 2-3 hours,
    // silently refresh local & remote data without showing any blocking loading screen
    const handleWakeUp = () => {
      if (document.visibilityState === 'visible') {
        refreshData();
        ClassroomDB.pullFromSupabase().then((updated) => {
          if (updated) {
            refreshData();
          }
        });
      }
    };
    document.addEventListener('visibilitychange', handleWakeUp);
    window.addEventListener('pageshow', handleWakeUp);

    // Periodic background sync with Supabase for online multi-user consistency
    const syncInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        ClassroomDB.pullFromSupabase().then((updated) => {
          if (updated) {
            refreshData();
          }
        });
      }
    }, 25000);

    return () => {
      clearTimeout(initTimer);
      window.removeEventListener('storage', handleStorageChange);
      document.removeEventListener('visibilitychange', handleWakeUp);
      window.removeEventListener('pageshow', handleWakeUp);
      clearInterval(syncInterval);
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
      className={`min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200 ${
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
          onResetData={handleResetData}
          onNavigateHome={() => setSelectedCourse(null)}
          notifications={notifications}
          onRefreshNotifications={refreshData}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          onUpdateCurrentUser={(updated) => {
            setCurrentUser(updated);
            refreshData();
          }}
        />
      </Suspense>

      {/* Main Container - Responsive padding for mobile & desktop screens */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-8">
        {appBannerError && (
          <div className="mb-4 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/70 text-rose-800 dark:text-rose-200 text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
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
          /* Active Course Workspace (Stream, Classwork, People, Quizzes, Video) */
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
              assignments={assignments}
              quizzes={quizzes}
              progress={progress}
              onBack={() => setSelectedCourse(null)}
              onRefresh={refreshData}
              onOpenCertificate={(cert) => setActiveCertificate(cert)}
              textProtectionEnabled={securitySettings.textProtectionEnabled}
            />
          </Suspense>
        ) : (
          /* Dashboard: Course Catalog & Strict Enrollment View */
          <div className="space-y-6 sm:space-y-8">
            {/* Context & Role Banner - Mobile & Desktop Responsive */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs p-4 sm:p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-5 sm:gap-6">
              <div className="space-y-1.5 sm:space-y-2">
                <div className="flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400">
                  <span>Logged in as: {currentUser.name}</span>
                  <span>·</span>
                  <span className="capitalize font-semibold text-indigo-600 dark:text-indigo-400">
                    Role: {currentUser.role === 'admin' ? 'Faculty / Admin (ဆရာ)' : currentUser.role === 'co_admin' ? 'Co-Admin (တွဲဖက် အက်ဒမင်)' : 'Student (ကျောင်းသား)'}
                  </span>
                </div>

                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
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

              {/* Action Buttons - Fully responsive wrapping */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
                {(currentUser.role === 'admin' || currentUser.role === 'co_admin') && (
                  <>
                    <button
                      onClick={() => setShowStudentDirectoryModal(true)}
                      className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-2 sm:py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-medium rounded-xl shadow-xs transition-colors cursor-pointer"
                    >
                      <Users className="w-4 h-4" />
                      <span>Manage Users (အကောင့်များ စီမံရန်)</span>
                    </button>

                    <button
                      onClick={() => setShowCreateCourseModal(true)}
                      className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-2 sm:py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-xl shadow-xs transition-colors cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Create Class / Batch</span>
                    </button>

                    <button
                      onClick={() => setShowSupabaseModal(true)}
                      className="flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-2 sm:py-2.5 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-xs font-semibold rounded-xl shadow-2xs transition-colors cursor-pointer"
                      title="View Supabase configuration, connection test and SQL schema"
                    >
                      <Database className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Supabase SQL</span>
                    </button>

                    <button
                      onClick={() => setShowArchitectureModal(true)}
                      className="flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-2 sm:py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-xl shadow-2xs transition-colors cursor-pointer"
                    >
                      <Layers className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                      <span>DB Spec</span>
                    </button>
                  </>
                )}

                <button
                  onClick={handleLogout}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 sm:py-2.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 text-xs font-medium rounded-xl shadow-2xs transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>

            {/* Course Grid Header & Search Bar */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                    {currentUser.role === 'admin' || currentUser.role === 'co_admin' ? 'All Managed Classes' : 'Authorized Courses'}
                  </h2>
                  <span className="text-xs font-mono text-slate-500 dark:text-slate-400 ml-1">
                    ({courses.length})
                  </span>
                </div>

                {/* Course Search Filter */}
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search courses or batches..."
                    value={courseSearch}
                    onChange={(e) => setCourseSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl focus:outline-hidden focus:border-indigo-500 shadow-2xs"
                  />
                </div>
              </div>

              {courses.length === 0 ? (
                <div className="p-8 sm:p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <Lock className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    No Authorized Courses Found
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                    You are not currently enrolled in any active class cohorts. Please contact Dr.
                    Kyaw Swar to obtain batch authorization.
                  </p>
                </div>
              ) : (
                <Suspense fallback={null}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
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
      </Suspense>

      {/* Quiet Footer */}
      <footer className="mt-auto border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>Classroom OS · Enterprise Academic Learning Platform</span>
          <div className="flex items-center gap-4 text-slate-400 dark:text-slate-500">
            <span>Domain-Locked Video DRM</span>
            <span>·</span>
            <span>PostgreSQL RLS</span>
            <span>·</span>
            <span>Mobile-First Engine</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
