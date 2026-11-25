import React, { useState, useEffect, useRef, Suspense } from 'react';
import { User, Course, CoursePost, Assignment, Quiz, StudentProgress, CertificateData, NotificationItem } from './types/classroom';
import { ClassroomDB } from './services/storage';
import { SupabaseService } from './services/supabase';
import { resolveAvatarUrl, DEFAULT_AVATAR_SVG } from './data/presetAvatars';
import { useBackHandler } from './utils/backNavigation';
import { LoginView } from './components/LoginView';
import { Navbar } from './components/Navbar';
import { CourseCard } from './components/CourseCard';
import { CourseDetail } from './components/CourseDetail';
import { CertificateModal } from './components/CertificateModal';
import { SecurityArchitectureModal } from './components/SecurityArchitectureModal';
import { CreateCourseModal } from './components/CreateCourseModal';
import { AdminStudentDirectoryModal } from './components/AdminStudentDirectoryModal';
import { SupabaseModal } from './components/SupabaseModal';
import { AcademyRulesModal } from './components/AcademyRulesModal';
import { AdminAuditLogModal } from './components/AdminAuditLogModal';
import { OfficialWebsiteModal, OFFICIAL_ACADEMY_WEBSITE_URL } from './components/OfficialWebsiteModal';
import { DictionaryModal } from './components/DictionaryModal';
import { SelectionDictionaryTrigger } from './components/SelectionDictionaryTrigger';
import {
  dispatchDeviceNotification,
  DeviceAlertPayload,
  requestDeviceNotificationPermission,
} from './utils/deviceNotifications';
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
  Globe,
  ExternalLink,
  BookA,
  X,
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
  const [showWebsiteModal, setShowWebsiteModal] = useState(false);
  const [showDictionaryModal, setShowDictionaryModal] = useState(false);
  const [dictionaryInitialQuery, setDictionaryInitialQuery] = useState('');
  const [showReorderPanel, setShowReorderPanel] = useState(false);
  const [draggedCourseId, setDraggedCourseId] = useState<string | null>(null);
  const [appBannerError, setAppBannerError] = useState<string | null>(null);
  const [livePushBanner, setLivePushBanner] = useState<DeviceAlertPayload | null>(null);
  const livePushTimerRef = useRef<number | null>(null);
  const [selectedCourseInitialTab, setSelectedCourseInitialTab] = useState<
    'stream' | 'attendance' | 'quizzes' | 'book_delivery' | 'private_notes' | 'people'
  >('stream');

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
  useBackHandler(showWebsiteModal, () => setShowWebsiteModal(false));
  useBackHandler(showDictionaryModal, () => setShowDictionaryModal(false));

  const handleOpenDictionary = (initialWord?: string) => {
    setDictionaryInitialQuery(initialWord ? initialWord.trim() : '');
    setShowDictionaryModal(true);
  };

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
      ClassroomDB.purgeExpiredComments();
      ClassroomDB.purgeExpiredAuditLogs(false);
      refreshData();

      let isWakeUpdateReload = false;
      try {
        const currentUrl = new URL(window.location.href);
        if (currentUrl.searchParams.has('wake')) {
          isWakeUpdateReload = true;
          currentUrl.searchParams.delete('wake');
          window.history.replaceState({}, '', currentUrl.toString());
        }
      } catch {
        // ignore
      }

      const loggedUser = ClassroomDB.getCurrentUser();
      if (loggedUser) {
        if (isWakeUpdateReload) {
          ClassroomDB.purgeStaleCacheAndForceSync().then(() => {
            refreshData();
          });
        } else {
          ClassroomDB.pullFromSupabase({ force: true }).then((updated) => {
            if (updated || !ClassroomDB.getCurrentUser()) {
              refreshData();
            }
          });
        }
      }
    }, 30);

    // Instant Realtime Broadcast + Postgres Changes subscription across all accounts & devices
    // Smartly routes each Realtime event to ONLY the affected table(s) to cut Log Ingestion & Egress by ~90%
    const unsubscribeRealtime = SupabaseService.subscribeToRealtimeChanges((payload) => {
      const deletedChanged = ClassroomDB.applyRemoteDeletions(payload);
      const attPatchChanged = ClassroomDB.applyRealtimeAttendancePatches(
        payload?.attendancePatches
      );
      const notePatchChanged = ClassroomDB.applyRealtimePrivateNotePatches(
        payload?.privateNotePatches
      );
      if (deletedChanged || attPatchChanged || notePatchChanged) {
        refreshData();
      }
      if (navigator.onLine === false) return;
      const loggedUser = ClassroomDB.getCurrentUser();
      if (!loggedUser) return;

      const kinds =
        payload?.kinds && payload.kinds.length > 0
          ? payload.kinds
          : payload?.kind
          ? [payload.kind]
          : ['all'];

      // 1. Fast path for Attendance-only events (already applied in 0ms via attendancePatches, plus delayed 0.3KB delta verification)
      if (kinds.length === 1 && kinds[0] === 'attendance') {
        const hasEmbeddedPatches = Boolean(
          payload?.attendancePatches && payload.attendancePatches.length > 0
        );
        if (hasEmbeddedPatches) {
          setTimeout(() => {
            ClassroomDB.syncAttendanceFromCloud(true).then((attChanged) => {
              if (attChanged) {
                refreshData();
              }
            });
          }, 700);
        } else {
          ClassroomDB.syncAttendanceFromCloud(true).then((attChanged) => {
            if (attChanged) {
              refreshData();
            }
          });
        }
        return;
      }

      // 1a. Fast path for Student Attendance Check-in events:
      // The student's exact check-in record & timestamp were already applied in 0ms above via `applyRealtimeAttendancePatches`!
      // Only Admin / Co-Admin run a background verification sync.
      if (kinds.length === 1 && kinds[0] === 'attendance_checkin') {
        if (loggedUser.role === 'student') {
          return;
        }
        ClassroomDB.syncAttendanceFromCloud(false).then((attChanged) => {
          if (attChanged) {
            refreshData();
          }
        });
        return;
      }

      // 1b. Fast path for Private Note events:
      // If `privateNotePatches` was already included in the broadcast payload, it was applied in 0ms above
      // WITHOUT needing any extra HTTP SELECT query to Supabase!
      // Only run a fallback cloud sync when no patch was embedded.
      if (kinds.length === 1 && kinds[0] === 'private_note') {
        if (
          loggedUser.role === 'student' &&
          payload?.targetUserIds &&
          payload.targetUserIds.length > 0 &&
          !payload.targetUserIds.includes(loggedUser.id)
        ) {
          return;
        }
        if (payload?.privateNotePatches && payload.privateNotePatches.length > 0) {
          return;
        }
        ClassroomDB.syncPrivateNotesFromCloud(true).then((notesChanged) => {
          if (notesChanged) {
            refreshData();
          }
        });
        return;
      }

      // 2. Fast path for Profile-only events (ignore other students' session lock updates on student devices)
      if (kinds.length === 1 && kinds[0] === 'profile') {
        if (
          loggedUser.role === 'student' &&
          payload?.targetUserIds &&
          payload.targetUserIds.length > 0 &&
          !payload.targetUserIds.includes(loggedUser.id)
        ) {
          return;
        }
        ClassroomDB.pullFromSupabase({ force: true, onlyProfiles: true }).then((updated) => {
          if (updated || !ClassroomDB.getCurrentUser()) {
            refreshData();
          }
        });
        return;
      }

      // 3. Fast path for Delete events where deletedIds were already applied locally
      if (kinds.length === 1 && kinds[0] === 'delete' && payload?.deletedIds?.length) {
        return;
      }

      // 4. Targeted table pull for specific classroom updates (post, course, assignment, quiz, notification)
      if (!kinds.includes('all') && !kinds.includes('delete')) {
        const tableSet = new Set<
          'profiles' | 'courses' | 'posts' | 'assignments' | 'quizzes' | 'attendance' | 'notifications'
        >();
        for (const k of kinds) {
          if (k === 'post') {
            tableSet.add('posts');
            tableSet.add('notifications');
          } else if (k === 'course') {
            tableSet.add('courses');
            tableSet.add('notifications');
          } else if (k === 'notification' || k === 'private_note') {
            tableSet.add('notifications');
          } else if (k === 'assignment' || k === 'submission') {
            tableSet.add('assignments');
            tableSet.add('courses');
            tableSet.add('notifications');
          } else if (k === 'quiz' || k === 'quiz_submission') {
            tableSet.add('quizzes');
            tableSet.add('courses');
            tableSet.add('notifications');
          } else if (k === 'attendance') {
            tableSet.add('attendance');
          } else if (k === 'attendance_checkin') {
            if (loggedUser.role !== 'student') {
              tableSet.add('attendance');
            }
          } else if (k === 'profile') {
            tableSet.add('profiles');
          }
        }
        if (tableSet.size === 0) {
          return;
        }
        if (tableSet.size > 0) {
          ClassroomDB.pullFromSupabase({
            force: true,
            tables: Array.from(tableSet),
          }).then((updated) => {
            if (updated || !ClassroomDB.getCurrentUser()) {
              refreshData();
            }
          });
          return;
        }
      }

      ClassroomDB.pullFromSupabase({ force: true }).then((updated) => {
        if (updated || !ClassroomDB.getCurrentUser()) {
          refreshData();
        }
      });
    });

    // Multi-user / multi-tab & live attendance synchronization
    const handleStorageChange = () => {
      refreshData();
    };
    const handleRemoteAttendanceOpen = (e: Event) => {
      refreshData();
      const detail = (e as CustomEvent)?.detail;
      const loggedUser = ClassroomDB.getCurrentUser();
      if (!loggedUser || !detail?.courseId) return;
      const verify = ClassroomDB.getCourseById(detail.courseId, loggedUser);
      if (!verify.course) return;
      dispatchDeviceNotification({
        id: `att_open_${detail.courseId}_${detail.date || Date.now()}`,
        title: `🟢 Attendance ဖွင့်လှစ်လိုက်ပါပြီ — ${verify.course.title}`,
        body: `${verify.course.title} အတန်းအတွက် ယနေ့ Attendance လက်ခံနေပါပြီ။ ယခုပင် Check-in ဝင်ရောက်နိုင်ပါသည်။`,
        courseId: verify.course.id,
        targetTab: 'attendance',
        variant: 'attendance_open',
      });
    };
    const handleRemoteAttendanceClose = (e: Event) => {
      refreshData();
      const detail = (e as CustomEvent)?.detail;
      const loggedUser = ClassroomDB.getCurrentUser();
      if (!loggedUser || !detail?.courseId) return;
      const verify = ClassroomDB.getCourseById(detail.courseId, loggedUser);
      if (!verify.course) return;
      dispatchDeviceNotification({
        id: `att_close_${detail.courseId}_${detail.date || Date.now()}`,
        title: `🔴 Attendance ပိတ်သိမ်းလိုက်ပါပြီ — ${verify.course.title}`,
        body: `${verify.course.title} အတန်း၏ ယနေ့ Attendance စာရင်းသွင်းမှုကို ပိတ်သိမ်းလိုက်ပါပြီ။`,
        courseId: verify.course.id,
        targetTab: 'attendance',
        variant: 'attendance_close',
      });
    };
    const handleLiveDeviceAlert = (e: Event) => {
      const payload = (e as CustomEvent<DeviceAlertPayload>)?.detail;
      if (!payload) return;
      setLivePushBanner(payload);
      if (livePushTimerRef.current) {
        window.clearTimeout(livePushTimerRef.current);
      }
      livePushTimerRef.current = window.setTimeout(() => {
        setLivePushBanner(null);
      }, 6500);
    };
    const navigateToNotifTarget = (courseId?: string, targetTab?: string) => {
      if (!courseId) return;
      const loggedUser = ClassroomDB.getCurrentUser();
      if (!loggedUser) return;
      const check = ClassroomDB.getCourseById(courseId, loggedUser);
      if (!check.course) return;
      const validTab =
        targetTab === 'attendance' ||
        targetTab === 'quizzes' ||
        targetTab === 'private_notes' ||
        targetTab === 'people'
          ? targetTab
          : 'stream';
      setSelectedCourseInitialTab(validTab);
      setSelectedCourse(check.course);
      setPosts(ClassroomDB.getPostsForCourse(check.course.id, loggedUser));
      setAssignments(ClassroomDB.getAssignments(check.course.id));
      setQuizzes(ClassroomDB.getQuizzes(check.course.id));
      setProgress(ClassroomDB.getStudentProgress(loggedUser.id, check.course.id));
      setLivePushBanner(null);
    };
    const handleNotifNavigateEvent = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      navigateToNotifTarget(detail?.courseId, detail?.targetTab);
    };
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'NOTIFICATION_CLICKED') {
        navigateToNotifTarget(event.data.courseId, event.data.targetTab);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('attendance-realtime-updated', handleStorageChange);
    window.addEventListener('attendance-opened-remotely', handleRemoteAttendanceOpen);
    window.addEventListener('attendance-closed-remotely', handleRemoteAttendanceClose);
    window.addEventListener('classroom-live-device-alert', handleLiveDeviceAlert);
    window.addEventListener('classroom-notification-navigate', handleNotifNavigateEvent);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    }

    let hasRequestedNotifPermission = false;
    let lastUserInteractionAt = Date.now();
    let lastWakeUpPullAt = Date.now();
    const markUserActive = () => {
      const now = Date.now();
      const wasIdle = now - lastUserInteractionAt > 180_000;
      lastUserInteractionAt = now;
      if (
        !hasRequestedNotifPermission &&
        typeof window !== 'undefined' &&
        'Notification' in window &&
        Notification.permission === 'default' &&
        ClassroomDB.getCurrentUser()
      ) {
        hasRequestedNotifPermission = true;
        requestDeviceNotificationPermission().catch(() => {});
      }
      SupabaseService.resumeRealtimeConnection();
      if (
        wasIdle &&
        now - lastWakeUpPullAt >= 45_000 &&
        document.visibilityState === 'visible' &&
        navigator.onLine !== false &&
        !isLowBandwidthRef.current
      ) {
        const loggedUser = ClassroomDB.getCurrentUser();
        if (loggedUser) {
          lastWakeUpPullAt = now;
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
    // pull latest delta updates (throttled to 45s to avoid redundant focus/visibility bursts)
    const handleWakeUp = () => {
      if (document.visibilityState === 'hidden') {
        return;
      }
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        lastUserInteractionAt = now;
        SupabaseService.resumeRealtimeConnection();
        ClassroomDB.purgeExpiredComments();
        ClassroomDB.purgeExpiredAuditLogs(false);
        ClassroomDB.checkAndPublishDueScheduledPosts();
        refreshData();

        const loggedUser = ClassroomDB.getCurrentUser();
        if (loggedUser && navigator.onLine !== false && !isLowBandwidthRef.current) {
          ClassroomDB.syncAttendanceFromCloud(true).then((attUpdated) => {
            if (attUpdated) {
              refreshData();
            }
          });
          if (now - lastWakeUpPullAt >= 45_000) {
            lastWakeUpPullAt = now;
            ClassroomDB.pullFromSupabase({ background: true }).then((updated) => {
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

    // Lightweight 8-second live Attendance check while visible so even if a mobile carrier
    // drops a WebSocket packet, newly opened or closed Attendance appears within seconds
    const liveAttendanceCheckInterval = setInterval(() => {
      if (
        document.visibilityState === 'visible' &&
        navigator.onLine !== false &&
        !isLowBandwidthRef.current
      ) {
        const loggedUser = ClassroomDB.getCurrentUser();
        if (loggedUser) {
          SupabaseService.resumeRealtimeConnection();
          ClassroomDB.syncAttendanceFromCloud(false).then((attChanged) => {
            if (attChanged) {
              refreshData();
            }
          });
        }
      }
    }, 8_000);

    // 240s (4-minute) delta background sync fallback when user is active;
    // keeps Realtime WebSocket connected whenever the classroom tab is visible (up to 45 minutes)
    const syncInterval = setInterval(() => {
      const idleMs = Date.now() - lastUserInteractionAt;
      const isUserActive = idleMs <= 45 * 60_000;
      const loggedUser = ClassroomDB.getCurrentUser();
      if (!loggedUser || (!isUserActive && loggedUser.role === 'student')) {
        SupabaseService.pauseRealtimeConnection();
        return;
      }
      if (
        isUserActive &&
        document.visibilityState === 'visible' &&
        navigator.onLine !== false &&
        !isLowBandwidthRef.current
      ) {
        ClassroomDB.pullFromSupabase({ background: true }).then((updated) => {
          if (updated || !ClassroomDB.getCurrentUser()) {
            refreshData();
          }
        });
      }
    }, 240_000);

    // 20-second local timer to immediately auto-publish any due scheduled posts
    const scheduledPostsInterval = setInterval(() => {
      const publishedAny = ClassroomDB.checkAndPublishDueScheduledPosts();
      if (publishedAny) {
        refreshData();
      }
    }, 20_000);

    // 90-second local timer to silently auto-delete expired comments (>2 days), notifications (>30 mins), and Audit Logs (>2 days)
    const notifCleanupInterval = setInterval(() => {
      const publishedDue = ClassroomDB.checkAndPublishDueScheduledPosts();
      const purgedComments = ClassroomDB.purgeExpiredComments();
      const purgedNotifs = ClassroomDB.purgeExpiredNotifications();
      const purgedAudit = ClassroomDB.purgeExpiredAuditLogs();
      if (publishedDue || purgedComments || purgedNotifs || purgedAudit) {
        refreshData();
      }
    }, 90_000);

    // Automatically sync immediately whenever internet connection is restored
    const handleOnline = () => {
      lastUserInteractionAt = Date.now();
      SupabaseService.resumeRealtimeConnection();
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
      unsubscribeRealtime();
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('attendance-realtime-updated', handleStorageChange);
      window.removeEventListener('attendance-opened-remotely', handleRemoteAttendanceOpen);
      window.removeEventListener('attendance-closed-remotely', handleRemoteAttendanceClose);
      window.removeEventListener('classroom-live-device-alert', handleLiveDeviceAlert);
      window.removeEventListener('classroom-notification-navigate', handleNotifNavigateEvent);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
      }
      window.removeEventListener('pointerdown', markUserActive);
      window.removeEventListener('keydown', markUserActive);
      window.removeEventListener('touchstart', markUserActive);
      document.removeEventListener('visibilitychange', handleWakeUp);
      window.removeEventListener('pageshow', handleWakeUp);
      window.removeEventListener('focus', handleWakeUp);
      window.removeEventListener('online', handleOnline);
      clearInterval(liveAttendanceCheckInterval);
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

  const handleOpenCourse = (
    course: Course,
    initialTab:
      | 'stream'
      | 'attendance'
      | 'quizzes'
      | 'book_delivery'
      | 'private_notes'
      | 'people' = 'stream'
  ) => {
    if (!currentUser) return;
    const check = ClassroomDB.getCourseById(course.id, currentUser);
    if (!check.course) {
      setAppBannerError(check.error || 'Access Denied: You are not enrolled in this course.');
      setTimeout(() => setAppBannerError(null), 5000);
      return;
    }

    setSelectedCourseInitialTab(initialTab);
    setSelectedCourse(check.course);
    setPosts(ClassroomDB.getPostsForCourse(check.course.id, currentUser));
    setAssignments(ClassroomDB.getAssignments(check.course.id));
    setQuizzes(ClassroomDB.getQuizzes(check.course.id));
    setProgress(ClassroomDB.getStudentProgress(currentUser.id, check.course.id));

    // Pull latest classroom delta updates when entering a classroom (respecting query cache & cooldown)
    if (navigator.onLine !== false && !isLowBandwidthRef.current) {
      ClassroomDB.pullFromSupabase({ background: true }).then((updated) => {
        if (updated) {
          refreshData();
        }
      });
    }
  };

  const handleOpenCourseById = (
    courseId: string,
    initialTab:
      | 'stream'
      | 'attendance'
      | 'quizzes'
      | 'book_delivery'
      | 'private_notes'
      | 'people' = 'stream'
  ) => {
    if (!currentUser) return;
    const target = courses.find((c) => c.id === courseId);
    if (target) {
      handleOpenCourse(target, initialTab);
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
            SupabaseService.resumeRealtimeConnection();
            ClassroomDB.syncAttendanceFromCloud(true).then((attChanged) => {
              if (attChanged) {
                refreshData();
              }
            });
            ClassroomDB.syncPrivateNotesFromCloud(true).then((notesChanged) => {
              if (notesChanged) {
                refreshData();
              }
            });
            ClassroomDB.pullFromSupabase({ force: true }).then((updated) => {
              if (updated || !ClassroomDB.getCurrentUser()) {
                refreshData();
              }
            });
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
    <div className="min-h-screen w-full max-w-full overflow-x-hidden neu-canvas text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-300">
      <Suspense fallback={null}>
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
          onOpenWebsite={() => setShowWebsiteModal(true)}
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

      {/* Main Container - Responsive padding for mobile, tablet & desktop screens */}
      <main className="flex-1 max-w-7xl w-full min-w-0 mx-auto px-2.5 sm:px-6 py-4 sm:py-8">
        {/* Live Private Note / Leave Request Instant Alert Banner for Admin, Co-Admin & Students */}
        {(() => {
          const allVisibleNotes = ClassroomDB.getPrivateNotes(undefined, currentUser);
          if (currentUser.role === 'admin' || currentUser.role === 'co_admin') {
            const pendingNotes = allVisibleNotes.filter((n) => n.status === 'pending');
            if (pendingNotes.length === 0) return null;
            const latestNote = pendingNotes[0];
            if (
              selectedCourse &&
              selectedCourse.id === latestNote.courseId &&
              selectedCourseInitialTab === 'private_notes'
            ) {
              return null;
            }
            return (
              <div className="mb-5 p-4 rounded-2xl neu-card ring-2 ring-amber-500/45 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
                <div className="flex items-start sm:items-center gap-3 min-w-0">
                  <div className="p-2.5 rounded-xl bg-amber-600 text-white shrink-0 shadow-xs">
                    <Lock className="w-4 h-4 animate-pulse" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate">
                        📩 ကျောင်းသား သီးသန့်စာ / ခွင့်တိုင်စာ ({pendingNotes.length} စောင် မဖြေရသေးပါ)
                      </span>
                      <span className="px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-[10px] font-bold">
                        {latestNote.courseCode}
                      </span>
                    </div>
                    <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 mt-0.5 truncate">
                      <strong>{latestNote.studentName}</strong>: {latestNote.subject} — "{latestNote.content}" ·{' '}
                      <span className="font-mono text-indigo-600 dark:text-indigo-400">
                        {latestNote.createdAt}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      handleOpenCourseById(latestNote.courseId, 'private_notes');
                    }}
                    className="px-3.5 py-2 rounded-xl neu-btn-indigo text-xs font-bold cursor-pointer"
                  >
                    ချက်ချင်း ကြည့်ရှုဖြေကြားမည် →
                  </button>
                </div>
              </div>
            );
          }

          const unreadReplies = allVisibleNotes.filter(
            (n) => n.status !== 'pending' && !n.isReadByStudent
          );
          if (unreadReplies.length === 0) return null;
          const latestReply = unreadReplies[0];
          return (
            <div className="mb-5 p-4 rounded-2xl neu-card ring-2 ring-emerald-500/45 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
              <div className="flex items-start sm:items-center gap-3 min-w-0">
                <div className="p-2.5 rounded-xl bg-emerald-600 text-white shrink-0 shadow-xs">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate">
                    💬 သင်၏ သီးသန့်စာကို ဆရာ {latestReply.repliedByName || 'Instructor'} မှ ပြန်လည်ဖြေကြားလိုက်ပါပြီ!
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 mt-0.5 truncate">
                    [{latestReply.courseCode}] {latestReply.subject}: "{latestReply.replyContent}"
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    ClassroomDB.markPrivateNoteReadByStudent(latestReply.id);
                    refreshData();
                    handleOpenCourseById(latestReply.courseId, 'private_notes');
                  }}
                  className="px-3.5 py-2 rounded-xl neu-btn-indigo text-xs font-bold cursor-pointer"
                >
                  ဆရာ့အဖြေ ဖတ်ရှုမည် →
                </button>
              </div>
            </div>
          );
        })()}

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
              initialTab={selectedCourseInitialTab}
              onBack={() => {
                setSelectedCourse(null);
                setSelectedCourseInitialTab('stream');
              }}
              onRefresh={refreshData}
              onOpenCertificate={(cert) => setActiveCertificate(cert)}
            />
          </Suspense>
        ) : (
          /* Dashboard: Course Catalog & Strict Enrollment View */
          <div className="space-y-6 sm:space-y-9 min-w-0">
            {/* Sleek Liquid Glass Quick Action Console (Mobile, Tablet & Web Responsive) */}
            <div className="neu-card rounded-2xl p-3 sm:p-4 min-w-0 overflow-hidden">
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center justify-between gap-2 sm:gap-3">
                <div className="contents sm:flex sm:flex-wrap sm:items-center sm:gap-2.5 sm:flex-1">
                  <button
                    onClick={() => setShowRulesModal(true)}
                    className="neu-btn flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-2.5 text-emerald-800 dark:text-emerald-300 text-xs font-bold rounded-xl cursor-pointer sm:flex-1 lg:flex-initial"
                  >
                    <ScrollText className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="truncate">စည်းကမ်းချက်များ</span>
                  </button>

                  {currentUser.role === 'student' && currentUser.rulesAccepted && (
                    <button
                      type="button"
                      onClick={() => setShowRulesModal(true)}
                      className="neu-inset-sm flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-emerald-800 dark:text-emerald-300 font-sans font-bold text-xs cursor-pointer hover:text-emerald-600 transition-colors"
                      title="သင်တန်းစည်းကမ်းချက်များကို သိရှိလိုက်နာပါမည်ဟု အတည်ပြုပြီး"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="truncate">သိရှိ လိုက်နာပါမည်</span>
                    </button>
                  )}

                  {(currentUser.role === 'admin' || currentUser.role === 'co_admin') && (
                    <>
                      {currentUser.role === 'admin' && (
                        <button
                          onClick={() => setShowAuditLogModal(true)}
                          className="neu-btn flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-2.5 text-amber-800 dark:text-amber-300 text-xs font-bold rounded-xl cursor-pointer border border-amber-500/20 sm:flex-1 lg:flex-initial"
                          title="Admin နှင့် Co-Admin တို့၏ လုပ်ဆောင်ချက် မှတ်တမ်းအားလုံးကို စစ်ဆေးရန်"
                        >
                          <History className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                          <span className="truncate">Audit Log</span>
                        </button>
                      )}

                      <button
                        onClick={() => setShowStudentDirectoryModal(true)}
                        className="neu-btn flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-2.5 text-slate-800 dark:text-slate-100 text-xs font-bold rounded-xl cursor-pointer sm:flex-1 lg:flex-initial"
                      >
                        <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                        <span className="truncate">Manage Users</span>
                      </button>

                      <button
                        onClick={() => setShowCreateCourseModal(true)}
                        className="neu-btn-indigo flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-2.5 text-white text-xs font-bold rounded-xl cursor-pointer sm:flex-1 lg:flex-initial"
                      >
                        <Plus className="w-4 h-4 shrink-0" />
                        <span className="truncate">Create Class</span>
                      </button>
                    </>
                  )}
                </div>

                <button
                  onClick={handleLogout}
                  className={`neu-btn ${
                    currentUser.role === 'admin' ||
                    (currentUser.role === 'student' && currentUser.rulesAccepted)
                      ? 'col-span-2 sm:col-span-1'
                      : ''
                  } flex items-center justify-center gap-1.5 px-4 py-2.5 text-rose-700 dark:text-rose-300 text-xs font-bold rounded-xl cursor-pointer shrink-0`}
                >
                  <LogOut className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>

            {/* Official Academy Website Bar — Positioned Directly Above All Managed Classes */}
            <div className="neu-raised rounded-2xl px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-emerald-500/20">
              <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-slate-700 dark:text-slate-200 font-semibold min-w-0">
                <div className="w-7 h-7 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                  <Globe className="w-4 h-4" />
                </div>
                <span>စွမ်းအားသင်တန်း တရားဝင် ဝက်ဘ်ဆိုဒ် (Official Website):</span>
                <a
                  href={OFFICIAL_ACADEMY_WEBSITE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-emerald-700 dark:text-emerald-400 hover:underline font-mono truncate"
                >
                  www.swanarhacademy.com
                </a>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowWebsiteModal(true)}
                  className="flex-1 sm:flex-initial justify-center px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <Globe className="w-3.5 h-3.5 shrink-0" />
                  <span>App ထဲတွင် ကြည့်ရန်</span>
                </button>
                <a
                  href={OFFICIAL_ACADEMY_WEBSITE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 sm:flex-initial justify-center neu-btn px-3.5 py-2 rounded-xl text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>Tab အသစ်ဖြင့် ဖွင့်ရန်</span>
                  <ExternalLink className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                </a>
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

        {/* Official Academy Website In-App Viewer Modal (Method 3) */}
        <OfficialWebsiteModal
          isOpen={showWebsiteModal}
          onClose={() => setShowWebsiteModal(false)}
        />

        {/* Cross-Device Live Push Notification Banner (Phone, Tablet & Computer Browser) */}
        {livePushBanner && (
          <div className="fixed top-3 right-3 left-3 sm:left-auto sm:w-96 z-[80] animate-in fade-in slide-in-from-top-3 duration-200">
            <div className="rounded-2xl bg-slate-900/95 dark:bg-slate-900/98 text-white border border-indigo-500/40 shadow-2xl p-3.5 backdrop-blur-md flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                  livePushBanner.variant === 'attendance_open'
                    ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
                    : livePushBanner.variant === 'attendance_close'
                    ? 'bg-rose-500/20 border-rose-400/40 text-rose-300'
                    : 'bg-indigo-500/20 border-indigo-400/40 text-indigo-300'
                }`}
              >
                <Bell className="w-5 h-5" />
              </div>
              <div
                onClick={() => {
                  if (livePushBanner.courseId) {
                    window.dispatchEvent(
                      new CustomEvent('classroom-notification-navigate', {
                        detail: {
                          courseId: livePushBanner.courseId,
                          targetTab: livePushBanner.targetTab || 'stream',
                        },
                      })
                    );
                  } else {
                    setLivePushBanner(null);
                  }
                }}
                className="flex-1 min-w-0 cursor-pointer"
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="px-1.5 py-0.5 rounded bg-indigo-500/30 text-indigo-200 font-mono text-[9px] font-bold uppercase tracking-wider">
                    Classroom Alert
                  </span>
                </div>
                <p className="text-xs font-extrabold text-white leading-snug line-clamp-1">
                  {livePushBanner.title}
                </p>
                <p className="text-[11px] text-slate-300 leading-relaxed line-clamp-2 mt-0.5">
                  {livePushBanner.body}
                </p>
                {livePushBanner.courseId && (
                  <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-bold text-amber-300 hover:underline">
                    နှိပ်၍ တိုက်ရိုက်ကြည့်ရန် →
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setLivePushBanner(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                aria-label="Close Notification Banner"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Persistent Premium Circular Floating Dictionary Button (Bottom-Right across Dashboard & All Classrooms) */}
        <div className="fixed bottom-5 right-4 sm:bottom-7 sm:right-7 z-40 group">
          {/* Hover Tooltip Label on Desktop */}
          <div className="pointer-events-none absolute right-full mr-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all duration-200 hidden sm:flex items-center">
            <div className="neu-raised px-3.5 py-2 rounded-2xl border border-indigo-500/25 shadow-xl whitespace-nowrap flex items-center gap-2">
              <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                အင်္ဂလိပ် ⇄ မြန်မာ အဘိဓာန်
              </span>
              <span className="px-1.5 py-0.5 rounded-md bg-indigo-600 text-white font-mono text-[10px] font-bold">
                Dictionary
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleOpenDictionary()}
            aria-label="Open English to Myanmar Dictionary"
            title="English ⇄ Myanmar Dictionary (အင်္ဂလိပ် ⇄ မြန်မာ အဘိဓာန်)"
            className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-indigo-600 via-indigo-700 to-slate-900 dark:from-indigo-500 dark:via-indigo-700 dark:to-slate-900 text-white shadow-[0_10px_28px_-4px_rgba(79,70,229,0.65)] hover:shadow-[0_14px_34px_-2px_rgba(79,70,229,0.85)] ring-4 ring-white/85 dark:ring-slate-800/90 hover:scale-105 active:scale-95 transition-all duration-200 flex flex-col items-center justify-center cursor-pointer"
          >
            {/* Subtle Inner Gloss Ring */}
            <span
              className="pointer-events-none absolute inset-1 rounded-full border border-white/25"
              aria-hidden="true"
            />
            <BookA className="w-6 h-6 sm:w-6.5 sm:h-6.5 text-white drop-shadow-xs" />
            <span className="mt-0.5 text-[8px] sm:text-[9px] font-mono font-extrabold tracking-tight text-amber-300 leading-none">
              EN⇄MM
            </span>
          </button>
        </div>

        {/* English ⇄ Myanmar Dictionary Modal (0 MB Supabase Usage) */}
        {showDictionaryModal && (
          <DictionaryModal
            isOpen={showDictionaryModal}
            onClose={() => setShowDictionaryModal(false)}
            initialQuery={dictionaryInitialQuery}
          />
        )}

        {/* Quick Text-Selection Lookup Trigger inside Classroom */}
        <SelectionDictionaryTrigger
          disabled={showDictionaryModal}
          onLookupWord={(word) => handleOpenDictionary(word)}
        />

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
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-center">
          <span>Dr. Si Thu Aung · Swanarh Academy · Classroom OS Learning Platform</span>
        </div>
      </footer>
    </div>
  );
}
