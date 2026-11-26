import React, { useState, useEffect } from 'react';
import {
  Course,
  User,
  AttendanceSession,
  AttendanceStatus,
  CertificateData,
  PrivateNote,
} from '../types/classroom';
import { ClassroomDB } from '../services/storage';
import {
  CalendarCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Plus,
  Unlock,
  Lock,
  Users,
  Award,
  Trash2,
  CheckCheck,
  Sparkles,
  Hand,
  Calendar,
  Download,
  Edit3,
  RotateCcw,
  Search,
  Copy,
  UserCheck,
  UserX,
} from 'lucide-react';

interface AttendanceViewProps {
  course: Course;
  currentUser: User;
  onRefresh: () => void;
  onOpenCertificate?: (cert: CertificateData) => void;
  onOpenPrivateNotes?: () => void;
}

export const AttendanceView: React.FC<AttendanceViewProps> = ({
  course,
  currentUser,
  onRefresh,
  onOpenCertificate,
  onOpenPrivateNotes,
}) => {
  const isInstructor = currentUser.role === 'admin' || currentUser.role === 'co_admin';
  const sessions = ClassroomDB.getAttendanceSessions(course.id);

  // Selected session for roll call (defaults to first/latest session)
  const [selectedSessionId, setSelectedSessionId] = useState<string>(
    sessions[0]?.id || ''
  );

  // Create new attendance session form state (for Instructors)
  const todayIso = ClassroomDB.getLocalTodayIso();
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState(todayIso);
  const [openImmediately, setOpenImmediately] = useState(true);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<AttendanceSession | null>(null);
  const [visibleRosterLimit, setVisibleRosterLimit] = useState<number>(100);
  const [instructorSubTab, setInstructorSubTab] = useState<'roll_call' | 'summary'>('roll_call');
  const [showCreateSessionForm, setShowCreateSessionForm] = useState<boolean>(
    sessions.length === 0
  );
  const [compactGridView, setCompactGridView] = useState<boolean>(true);
  const [editingStudentSessionIds, setEditingStudentSessionIds] = useState<Record<string, boolean>>({});
  const [rollCallFilter, setRollCallFilter] = useState<
    'all' | 'checked_in' | 'not_checked_in' | 'present' | 'late' | 'excused' | 'absent'
  >('all');
  const [percentageFilter, setPercentageFilter] = useState<
    'all' | '100' | '80_plus' | '75_plus' | '50_to_79' | 'under_50'
  >('all');
  const [rollCallSearch, setRollCallSearch] = useState<string>('');
  const [blockedLeaveAlert, setBlockedLeaveAlert] = useState<string | null>(null);
  const [quickReplyDrafts, setQuickReplyDrafts] = useState<Record<string, string>>({});

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3800);
  };

  const [, setAttendanceTick] = useState(0);

  // Real-time multi-device Attendance & Leave Request synchronization (instant WebSocket patch + 5s delta verification)
  useEffect(() => {
    let mounted = true;
    const syncNow = (forcePull: boolean = false) => {
      if (document.visibilityState === 'visible' && navigator.onLine !== false) {
        ClassroomDB.syncAttendanceFromCloud(forcePull).then((changed) => {
          if (mounted && changed) {
            setAttendanceTick((t) => t + 1);
            onRefresh();
          }
        });
        if (forcePull || isInstructor) {
          ClassroomDB.syncPrivateNotesFromCloud(forcePull).then((notesChanged) => {
            if (mounted && notesChanged) {
              setAttendanceTick((t) => t + 1);
              onRefresh();
            }
          });
        }
      }
    };
    const handleRemoteClosed = (ev: Event) => {
      if (!mounted) return;
      const detail = (ev as CustomEvent)?.detail as { courseId?: string } | undefined;
      if (detail?.courseId && detail.courseId !== course.id) return;
      setEditingStudentSessionIds({});
      showToast(
        '🔒 ဆရာ (Admin / Co-Admin) မှ Attendance ပိတ်လိုက်ပြီဖြစ်သောကြောင့် နှိပ်၍ မရနိုင်တော့ပါ။'
      );
      setAttendanceTick((t) => t + 1);
      onRefresh();
    };
    const handleRemoteOpened = (ev: Event) => {
      if (!mounted) return;
      const detail = (ev as CustomEvent)?.detail as { courseId?: string } | undefined;
      if (detail?.courseId && detail.courseId !== course.id) return;
      if (!isInstructor) {
        showToast('🟢 ဆရာ (Admin / Co-Admin) မှ Attendance ဖွင့်ပေးလိုက်ပါပြီ! ယခု Present နှိပ်နိုင်ပါပြီ။');
      }
      setAttendanceTick((t) => t + 1);
      onRefresh();
    };
    const handleRealtimeAttendanceUpdate = () => {
      if (!mounted) return;
      setAttendanceTick((t) => t + 1);
      onRefresh();
    };
    const handleRealtimePrivateNote = () => {
      if (!mounted) return;
      setAttendanceTick((t) => t + 1);
      onRefresh();
    };
    syncNow(true);
    const pollIntervalMs = 5_000;
    const timer = setInterval(() => syncNow(false), pollIntervalMs);
    window.addEventListener('attendance-closed-remotely', handleRemoteClosed);
    window.addEventListener('attendance-opened-remotely', handleRemoteOpened);
    window.addEventListener('attendance-realtime-updated', handleRealtimeAttendanceUpdate);
    window.addEventListener('private-note-realtime-update', handleRealtimePrivateNote);
    return () => {
      mounted = false;
      clearInterval(timer);
      window.removeEventListener('attendance-closed-remotely', handleRemoteClosed);
      window.removeEventListener('attendance-opened-remotely', handleRemoteOpened);
      window.removeEventListener('attendance-realtime-updated', handleRealtimeAttendanceUpdate);
      window.removeEventListener('private-note-realtime-update', handleRealtimePrivateNote);
    };
  }, [course.id, isInstructor]);

  // Open sessions where student can self check-in
  const openSessions = sessions.filter((s) => s.isOpen);

  // Automatically switch selectedSessionId to the active open session (e.g., 13th opened on another device)
  // or to the newest session when remote sessions arrive from Supabase
  const latestOpenId = openSessions[0]?.id || '';
  const latestSessionId = sessions[0]?.id || '';
  useEffect(() => {
    if (latestOpenId && selectedSessionId !== latestOpenId) {
      setSelectedSessionId(latestOpenId);
    } else if (!latestOpenId && latestSessionId && !sessions.some((s) => s.id === selectedSessionId)) {
      setSelectedSessionId(latestSessionId);
    }
  }, [latestOpenId, latestSessionId, sessions.length]);

  // Prioritize any currently OPEN session if selectedSessionId is not set or no longer exists
  const activeSession: AttendanceSession | undefined =
    sessions.find((s) => s.id === selectedSessionId) ||
    sessions.find((s) => s.isOpen) ||
    sessions[0];

  // Enrolled students list (includes any student who checked into a session for this course)
  const enrolledStudents = ClassroomDB.getEnrolledStudentsForCourse(course, sessions);

  const handleCreateSession = (e: React.FormEvent) => {
    e.preventDefault();
    const created = ClassroomDB.createAttendanceSession(
      course.id,
      newTitle.trim() || `အတန်းချိန် တက်ရောက်မှု (${newDate})`,
      newDate,
      openImmediately,
      currentUser
    );
    const autoExcusedCount = Object.values(created.records || {}).filter(
      (r) => r.status === 'excused'
    ).length;
    setNewTitle('');
    setSelectedSessionId(created.id);
    setShowCreateSessionForm(false);
    setInstructorSubTab('roll_call');
    setBlockedLeaveAlert(null);
    showToast(
      openImmediately
        ? `Open Attendance ဖွင့်လှစ်ပြီးပါပြီ!${
            autoExcusedCount > 0
              ? ` (ကြိုတင်ခွင့်ပြုထားသော ကျောင်းသား ${autoExcusedCount} ဦးအား အလိုအလျောက် Excused သတ်မှတ်ပေးပြီး)`
              : ' ကျောင်းသားများ "Present" နှိပ်နိုင်ပါပြီ။'
          }`
        : `Attendance Session အသစ် ဖန်တီးပြီးပါပြီ။${
            autoExcusedCount > 0
              ? ` (ကြိုတင်ခွင့်ပြုထားသော ကျောင်းသား ${autoExcusedCount} ဦး Auto Excused ဖြစ်ပြီး)`
              : ''
          }`
    );
    onRefresh();
  };

  const handleToggleOpen = (session: AttendanceSession) => {
    const check = ClassroomDB.checkCanToggleAttendanceSession(session.id);
    if (!check.allowed) {
      const msg =
        check.error ||
        '⚠️ ဤနေ့အတွက် ကျောင်းသားခွင့်တိုင်စာကို Approve သို့မဟုတ် Reject မလုပ်ရသေးသောကြောင့် Attendance ပိတ်ခွင့် နှင့် ပြန်ဖွင့်ခွင့် မရသေးပါ။';
      setBlockedLeaveAlert(msg);
      showToast(msg);
      return;
    }
    setBlockedLeaveAlert(null);
    const nextState = !session.isOpen;
    if (!nextState) {
      ClassroomDB.closeAllOpenAttendanceForCourse(course.id, currentUser);
      ClassroomDB.toggleAttendanceSessionOpen(session.id, false, currentUser);
    } else {
      ClassroomDB.toggleAttendanceSessionOpen(session.id, true, currentUser);
    }
    showToast(
      nextState
        ? `🟢 "${session.title}" အား Open Attendance ဖွင့်ပေးလိုက်ပါပြီ။ ကျောင်းသားများ နှိပ်နိုင်ပါပြီ။`
        : `🔒 "${session.title}" အား Attendance ပိတ်လိုက်ပါပြီ။ ကျောင်းသားအကောင့်များ အားလုံးတွင် ပိတ်သွားပါပြီ။`
    );
    onRefresh();
  };

  const handleCloseAllOpenAttendance = () => {
    const check = ClassroomDB.checkCanCloseCourseAttendance(course.id);
    if (!check.allowed) {
      const msg =
        check.error ||
        '⚠️ ကျောင်းသားခွင့်တိုင်စာကို Approve သို့မဟုတ် Reject မလုပ်ရသေးသောကြောင့် Attendance ပိတ်၍ မရသေးပါ။';
      setBlockedLeaveAlert(msg);
      showToast(msg);
      return;
    }
    setBlockedLeaveAlert(null);
    const count = ClassroomDB.closeAllOpenAttendanceForCourse(course.id, currentUser);
    if (count > 0) {
      showToast(
        '🔒 ဖွင့်ထားသော Attendance အားလုံးကို ပိတ်လိုက်ပါပြီ! ကျောင်းသားအကောင့်များ အားလုံးတွင် နှိပ်၍ မရတော့ပါ။'
      );
      onRefresh();
    }
  };

  const handleQuickResolveLeaveRequest = (
    note: PrivateNote,
    decision: 'approved' | 'rejected'
  ) => {
    const draft = (quickReplyDrafts[note.id] || '').trim();
    ClassroomDB.replyToPrivateNote(note.id, draft, decision, currentUser);
    setQuickReplyDrafts((prev) => {
      const next = { ...prev };
      delete next[note.id];
      return next;
    });
    const remainingPending = activeSession
      ? ClassroomDB.getPendingLeaveRequestsForDate(course.id, activeSession.date)
      : [];
    if (remainingPending.length === 0) {
      setBlockedLeaveAlert(null);
    }
    showToast(
      decision === 'approved'
        ? `✅ ${note.studentName} ၏ ခွင့်တိုင်စာကို Approve (ခွင့်ပြု) ပေးပြီး Attendance တွင် အလိုအလျောက် Excused သတ်မှတ်ပေးလိုက်ပါပြီ!${
            remainingPending.length === 0
              ? ' ယခု Attendance ပိတ်/ဖွင့် နိုင်ပါပြီ။'
              : ''
          }`
        : `✕ ${note.studentName} ၏ ခွင့်တိုင်စာကို Reject (ငြင်းပယ်) သတ်မှတ်ပြီးပါပြီ!${
            remainingPending.length === 0
              ? ' ယခု Attendance ပိတ်/ဖွင့် နိုင်ပါပြီ။'
              : ''
          }`
    );
    onRefresh();
  };

  const handleDeleteSession = (session: AttendanceSession) => {
    setSessionToDelete(session);
  };

  const confirmDeleteSession = () => {
    if (!sessionToDelete) return;
    const session = sessionToDelete;
    setSessionToDelete(null);
    ClassroomDB.deleteAttendanceSession(session.id);
    if (selectedSessionId === session.id) {
      const remaining = sessions.filter((s) => s.id !== session.id);
      setSelectedSessionId(remaining[0]?.id || '');
    }
    showToast('Attendance session အား ဖျက်ပြီး SQL Database မှလည်း တစ်ပါတည်း ဖျက်ပြီးပါပြီ။');
    onRefresh();
  };

  const handleStudentCheckIn = (
    sessionId: string,
    status: AttendanceStatus | 'clear' = 'present'
  ) => {
    const res = ClassroomDB.studentCheckIn(sessionId, currentUser, status);
    if (!res.success && res.error) {
      setEditingStudentSessionIds((prev) => ({ ...prev, [sessionId]: false }));
      showToast(res.error);
      onRefresh();
      return;
    }
    setEditingStudentSessionIds((prev) => ({ ...prev, [sessionId]: false }));
    if (status === 'clear') {
      showToast('🔄 သင်၏ Attendance မှတ်တမ်းကို ပြန်ဖျက်ပြီးပါပြီ။ ပြန်လည်ရွေးချယ်နှိပ်နိုင်ပါသည်။');
    } else if (status === 'present') {
      showToast('✅ Present (တက်ရောက်သည်) အဖြစ် မှတ်တမ်းတင်ပြီးပါပြီ!');
    } else if (status === 'late') {
      showToast('⏰ Late (နောက်ကျတက်ရောက်) အဖြစ် ပြင်ဆင်မှတ်တမ်းတင်ပြီးပါပြီ!');
    } else if (status === 'excused') {
      showToast('📝 Excused (ခွင့်တိုင်ကြားသည်) အဖြစ် ပြင်ဆင်မှတ်တမ်းတင်ပြီးပါပြီ!');
    } else {
      showToast('🔄 Attendance အခြေအနေကို ပြန်လည်ပြင်ဆင်ပြီးပါပြီ!');
    }
    onRefresh();
  };

  const handleInstructorMark = (
    sessionId: string,
    student: User,
    status: AttendanceStatus
  ) => {
    ClassroomDB.instructorMarkAttendance(sessionId, student, status);
    onRefresh();
  };

  const handleMarkAllPresent = (sessionId: string) => {
    ClassroomDB.markAllStudentsAttendance(sessionId, enrolledStudents, 'present');
    showToast('ကျောင်းသားအားလုံးကို Present (တက်ရောက်) အဖြစ် မှတ်သားပြီးပါပြီ။');
    onRefresh();
  };

  // Breakdown of Checked-in vs Not Checked-in students for activeSession
  const checkedInStudents = activeSession
    ? enrolledStudents.filter((stu) => {
        const rec = ClassroomDB.getStudentAttendanceRecord(activeSession, stu);
        return Boolean(
          rec && (rec.status === 'present' || rec.status === 'late' || rec.status === 'excused')
        );
      })
    : [];

  const notCheckedInStudents = activeSession
    ? enrolledStudents.filter((stu) => {
        const rec = ClassroomDB.getStudentAttendanceRecord(activeSession, stu);
        return !rec || rec.status === 'absent';
      })
    : [];

  const presentStudentsCount = activeSession
    ? enrolledStudents.filter(
        (stu) => ClassroomDB.getStudentAttendanceRecord(activeSession, stu)?.status === 'present'
      ).length
    : 0;
  const lateStudentsCount = activeSession
    ? enrolledStudents.filter(
        (stu) => ClassroomDB.getStudentAttendanceRecord(activeSession, stu)?.status === 'late'
      ).length
    : 0;
  const excusedStudentsCount = activeSession
    ? enrolledStudents.filter(
        (stu) => ClassroomDB.getStudentAttendanceRecord(activeSession, stu)?.status === 'excused'
      ).length
    : 0;
  const absentMarkedStudentsCount = activeSession
    ? enrolledStudents.filter(
        (stu) => ClassroomDB.getStudentAttendanceRecord(activeSession, stu)?.status === 'absent'
      ).length
    : 0;

  // Precompute overall attendance stats per student for Roll Call % badge and percentage filtering
  const studentStatsMap = new Map<
    string,
    ReturnType<typeof ClassroomDB.getStudentAttendanceStats>
  >();
  enrolledStudents.forEach((stu) => {
    studentStatsMap.set(stu.id, ClassroomDB.getStudentAttendanceStats(course.id, stu.id));
  });

  const matchesPercentageFilter = (pct: number) => {
    if (percentageFilter === 'all') return true;
    if (percentageFilter === '100') return pct === 100;
    if (percentageFilter === '80_plus') return pct >= 80;
    if (percentageFilter === '75_plus') return pct >= 75;
    if (percentageFilter === '50_to_79') return pct >= 50 && pct < 80;
    if (percentageFilter === 'under_50') return pct < 50;
    return true;
  };

  const countPct100 = enrolledStudents.filter(
    (s) => (studentStatsMap.get(s.id)?.percentage ?? 0) === 100
  ).length;
  const countPct80Plus = enrolledStudents.filter(
    (s) => (studentStatsMap.get(s.id)?.percentage ?? 0) >= 80
  ).length;
  const countPct75Plus = enrolledStudents.filter(
    (s) => (studentStatsMap.get(s.id)?.percentage ?? 0) >= 75
  ).length;
  const countPct50To79 = enrolledStudents.filter((s) => {
    const p = studentStatsMap.get(s.id)?.percentage ?? 0;
    return p >= 50 && p < 80;
  }).length;
  const countPctUnder50 = enrolledStudents.filter(
    (s) => (studentStatsMap.get(s.id)?.percentage ?? 0) < 50
  ).length;

  const filteredRollCallStudents = enrolledStudents.filter((stu) => {
    if (rollCallSearch.trim()) {
      const q = rollCallSearch.trim().toLowerCase();
      const matchName = stu.name.toLowerCase().includes(q);
      const matchUser = stu.username.toLowerCase().includes(q);
      const matchPhone = stu.phone ? stu.phone.toLowerCase().includes(q) : false;
      if (!matchName && !matchUser && !matchPhone) return false;
    }
    const stuPct = studentStatsMap.get(stu.id)?.percentage ?? 0;
    if (!matchesPercentageFilter(stuPct)) return false;

    if (!activeSession || rollCallFilter === 'all') return true;
    const rec = ClassroomDB.getStudentAttendanceRecord(activeSession, stu);
    const isCheckedIn = Boolean(
      rec && (rec.status === 'present' || rec.status === 'late' || rec.status === 'excused')
    );
    if (rollCallFilter === 'checked_in') return isCheckedIn;
    if (rollCallFilter === 'not_checked_in') return !isCheckedIn;
    if (rollCallFilter === 'present') return rec?.status === 'present';
    if (rollCallFilter === 'late') return rec?.status === 'late';
    if (rollCallFilter === 'excused') return rec?.status === 'excused';
    if (rollCallFilter === 'absent') return !rec || rec.status === 'absent';
    return true;
  });

  const filteredSummaryStudents = enrolledStudents.filter((stu) => {
    if (rollCallSearch.trim()) {
      const q = rollCallSearch.trim().toLowerCase();
      const matchName = stu.name.toLowerCase().includes(q);
      const matchUser = stu.username.toLowerCase().includes(q);
      const matchPhone = stu.phone ? stu.phone.toLowerCase().includes(q) : false;
      if (!matchName && !matchUser && !matchPhone) return false;
    }
    const stuPct = studentStatsMap.get(stu.id)?.percentage ?? 0;
    return matchesPercentageFilter(stuPct);
  });

  const handleCopyAttendanceGroupList = (mode: 'checked_in' | 'not_checked_in') => {
    if (!activeSession) return;
    const targetList = mode === 'checked_in' ? checkedInStudents : notCheckedInStudents;
    const header =
      mode === 'checked_in'
        ? `✅ Attendance နှိပ်ပြီးသူများ စာရင်း — ${course.code} (${activeSession.displayDate} - ${activeSession.title}) [${targetList.length}/${enrolledStudents.length} ဦး]`
        : `⏳ Attendance မနှိပ်ရသေးသူများ စာရင်း — ${course.code} (${activeSession.displayDate} - ${activeSession.title}) [${targetList.length}/${enrolledStudents.length} ဦး]`;

    const lines = targetList.map((stu, idx) => {
      const rec = ClassroomDB.getStudentAttendanceRecord(activeSession, stu);
      const statusText =
        mode === 'checked_in'
          ? rec?.status === 'late'
            ? ' [Late]'
            : rec?.status === 'excused'
            ? ' [Excused]'
            : ' [Present]'
          : '';
      const timeText =
        mode === 'checked_in' && rec?.checkedInAt ? ` — ⏰ ${rec.checkedInAt}` : '';
      return `${idx + 1}. ${stu.name} (@${stu.username})${statusText}${timeText}`;
    });

    const fullText = [header, '━━━━━━━━━━━━━━━━━━━━', ...lines].join('\n');
    navigator.clipboard.writeText(fullText);
    showToast(
      mode === 'checked_in'
        ? `📋 Attendance နှိပ်ပြီးသူ (${targetList.length}) ဦး စာရင်းကို Copy ကူးပြီးပါပြီ!`
        : `📋 Attendance မနှိပ်ရသေးသူ (${targetList.length}) ဦး စာရင်းကို Copy ကူးပြီးပါပြီ!`
    );
  };

  const handleMarkRemainingAsAbsent = (sessionId: string) => {
    if (!activeSession || notCheckedInStudents.length === 0) return;
    ClassroomDB.markAllStudentsAttendance(sessionId, notCheckedInStudents, 'absent');
    showToast(
      `⚠️ Attendance မနှိပ်ရသေးသူ (${notCheckedInStudents.length}) ဦးကို Absent (ပျက်ကွက်) အဖြစ် မှတ်သားပြီးပါပြီ။`
    );
    onRefresh();
  };

  const renderStatusBadge = (status?: AttendanceStatus) => {
    switch (status) {
      case 'present':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            Present (တက်ရောက်)
          </span>
        );
      case 'late':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
            <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            Late (နောက်ကျ)
          </span>
        );
      case 'excused':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
            <AlertCircle className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
            Excused (ခွင့်တိုင်)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60">
            <XCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
            Absent (ပျက်ကွက်)
          </span>
        );
    }
  };

  // Student personal attendance stats
  const myStats = ClassroomDB.getStudentAttendanceStats(course.id, currentUser.id);
  const myCertEligible = myStats.percentage >= 75;

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {toastMsg && (
        <div className="fixed bottom-6 right-4 sm:right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-emerald-950 border border-emerald-500/50 text-emerald-100 text-xs rounded-xl shadow-2xl backdrop-blur-md">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* ===================================================================== */}
      {/* STUDENT VIEW: Active Check-in Card & Personal Attendance Percentage   */}
      {/* ===================================================================== */}
      {!isInstructor && (
        <div className="space-y-5">
          {/* Student Personal Attendance Percentage & Certificate Assessment Card */}
          <div className="neu-card rounded-3xl p-5 sm:p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <CalendarCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                    My Class Attendance (ကျွန်ုပ်၏ အတန်းတက်ရောက်မှု မှတ်တမ်း)
                  </h2>
                  {currentUser.rulesAccepted && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/90 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 text-[11px] font-bold">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>သိရှိ လိုက်နာပါမည်</span>
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  သင်တန်းဆင်းလက်မှတ် (Official Certificate) ရရှိရန် အတန်းတက်ရောက်မှု အနည်းဆုံး{' '}
                  <strong className="text-indigo-600 dark:text-indigo-400">75%</strong> ပြည့်မီရန် လိုအပ်ပါသည်။
                </p>
              </div>

              <div className="flex items-center gap-3 self-start md:self-auto">
                <div className="text-right">
                  <div className="text-2xl font-extrabold font-mono text-indigo-600 dark:text-indigo-400">
                    {myStats.percentage}%
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Attendance Rate ({myStats.totalSessions} sessions)
                  </div>
                </div>
                <div
                  className={`px-3.5 py-2 rounded-2xl neu-inset-sm text-xs font-semibold flex items-center gap-1.5 ${
                    myCertEligible
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : 'text-amber-700 dark:text-amber-300'
                  }`}
                >
                  <Award className="w-4 h-4 shrink-0" />
                  <span>
                    {myCertEligible
                      ? 'Certificate Attendance Qualified (≥75%)'
                      : 'Needs ≥75% for Certificate'}
                  </span>
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-5">
              <div className="w-full h-3 neu-inset-sm rounded-full overflow-hidden p-0.5">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    myStats.percentage >= 75
                      ? 'bg-emerald-500'
                      : myStats.percentage >= 50
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                  }`}
                  style={{ width: `${myStats.percentage}%` }}
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-xs">
                <div className="p-3 rounded-2xl neu-inset-sm">
                  <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold block">
                    Present (တက်ရောက်)
                  </span>
                  <span className="text-base font-extrabold font-mono text-emerald-900 dark:text-emerald-100">
                    {myStats.presentCount}
                  </span>
                </div>
                <div className="p-3 rounded-2xl neu-inset-sm">
                  <span className="text-[11px] text-amber-700 dark:text-amber-300 font-semibold block">
                    Late (နောက်ကျ)
                  </span>
                  <span className="text-base font-extrabold font-mono text-amber-900 dark:text-amber-100">
                    {myStats.lateCount}
                  </span>
                </div>
                <div className="p-3 rounded-2xl neu-inset-sm">
                  <span className="text-[11px] text-indigo-700 dark:text-indigo-300 font-semibold block">
                    Excused (ခွင့်တိုင်)
                  </span>
                  <span className="text-base font-extrabold font-mono text-indigo-900 dark:text-indigo-100">
                    {myStats.excusedCount}
                  </span>
                </div>
                <div className="p-3 rounded-2xl neu-inset-sm">
                  <span className="text-[11px] text-rose-700 dark:text-rose-300 font-semibold block">
                    Absent (ပျက်ကွက်)
                  </span>
                  <span className="text-base font-extrabold font-mono text-rose-900 dark:text-rose-100">
                    {myStats.absentCount}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Open Daily Check-in Banner for Students */}
          {openSessions.length > 0 ? (
            <div className="neu-card rounded-3xl p-4 sm:p-5 space-y-3 ring-2 ring-emerald-400/50">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold text-xs sm:text-sm">
                  <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Open Attendance — ယနေ့ အတန်းချိန် တက်ရောက်ကြောင်း နှိပ်ရန် (မပိတ်မီ ပြန်ပြင်နိုင်ပါသည်)</span>
                </div>
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                  🟢 Attendance ဖွင့်ထားဆဲ
                </span>
              </div>

              <div className="space-y-2.5">
                {openSessions.map((sess) => {
                  const myRecord = ClassroomDB.getStudentAttendanceRecord(sess, currentUser);
                  const isEditingThis = Boolean(editingStudentSessionIds[sess.id]);
                  const isInstructorApprovedExcused =
                    myRecord?.status === 'excused' && myRecord?.checkedInBy === 'instructor';
                  const myLeaveNotesForDate = ClassroomDB.getLeaveRequestsForCourseDate(
                    course.id,
                    sess.date
                  ).filter((n) => n.studentId === currentUser.id);
                  const myPendingLeave = myLeaveNotesForDate.find((n) => n.status === 'pending');

                  return (
                    <div
                      key={sess.id}
                      className="flex flex-col gap-3 p-3.5 rounded-2xl neu-inset-sm"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                              {sess.displayDate}
                            </span>
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                              {sess.title}
                            </h4>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                            ဆရာ {sess.openedBy} မှ Attendance ဖွင့်ပေးထားပါသည်။ ခွင့်တိုင်လိုပါက <strong>"သီးသန့်စာ"</strong> Tab မှ ခွင့်တိုင်ကြားပြီး ဆရာ Approve ပေးသည့်အခါ အလိုအလျောက် Excused (ခွင့်) ဖြစ်သွားပါမည်။
                          </p>
                          {myPendingLeave && (
                            <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-100/90 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-800 text-[11px] font-bold text-amber-800 dark:text-amber-300">
                              <Clock className="w-3.5 h-3.5 animate-pulse shrink-0" />
                              <span>
                                ⏳ သင်တင်ပြထားသော ခွင့်တိုင်စာ ({myPendingLeave.subject}) ကို ဆရာ စစ်ဆေးနေဆဲဖြစ်ပါသည် (Approve ပေးပါက အလိုအလျောက် Excused ဖြစ်ပါမည်)
                              </span>
                            </div>
                          )}
                          {isInstructorApprovedExcused && myRecord?.note && (
                            <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-100/90 dark:bg-indigo-950/70 border border-indigo-300 dark:border-indigo-800 text-[11px] font-bold text-indigo-800 dark:text-indigo-300">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              <span>✅ {myRecord.note} (Auto Excused)</span>
                            </div>
                          )}
                        </div>

                        {myRecord ? (
                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            {renderStatusBadge(myRecord.status)}
                            {myRecord.checkedInAt && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-mono font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800">
                                <Clock className="w-3 h-3 shrink-0" />
                                <span>နှိပ်သည့်အချိန်: {myRecord.checkedInAt}</span>
                              </span>
                            )}
                            {!isInstructorApprovedExcused && (
                              <button
                                type="button"
                                onClick={() =>
                                  setEditingStudentSessionIds((prev) => ({
                                    ...prev,
                                    [sess.id]: !prev[sess.id],
                                  }))
                                }
                                className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>{isEditingThis ? 'မပြင်တော့ပါ (Cancel)' : 'ပြန်ပြင်မည် (Edit)'}</span>
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleStudentCheckIn(sess.id, 'present')}
                              className="px-4 py-2.5 rounded-xl neu-btn-emerald text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
                            >
                              <Hand className="w-4 h-4" />
                              <span>Mark Present (တက်ရောက်သည်)</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStudentCheckIn(sess.id, 'late')}
                              className="px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                            >
                              <Clock className="w-3.5 h-3.5" />
                              <span>Late (နောက်ကျ)</span>
                            </button>
                            {onOpenPrivateNotes && (
                              <button
                                type="button"
                                onClick={onOpenPrivateNotes}
                                className="px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-800 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                                title="သီးသန့်စာ Tab မှတစ်ဆင့် ခွင့်တိုင်ကြားစာ ပေးပို့ရန်"
                              >
                                <Lock className="w-3.5 h-3.5" />
                                <span>📩 ခွင့်တိုင်ရန် (သီးသန့်စာ Tab သို့)</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Edit Attendance Drawer when student clicks "ပြန်ပြင်မည် (Edit)" while session is open */}
                      {myRecord && isEditingThis && !isInstructorApprovedExcused && (
                        <div className="pt-2.5 border-t border-slate-200/70 dark:border-slate-700/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 animate-fade-in">
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                            ✏️ Attendance မပိတ်မီ ပြောင်းလဲလိုသော အခြေအနေကို ရွေးချယ်ပါ -
                          </span>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleStudentCheckIn(sess.id, 'present')}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                myRecord.status === 'present'
                                  ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-400/50'
                                  : 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-50'
                              }`}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Present (တက်ရောက်)</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStudentCheckIn(sess.id, 'late')}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                myRecord.status === 'late'
                                  ? 'bg-amber-500 text-white shadow-xs ring-2 ring-amber-400/50'
                                  : 'bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700 hover:bg-amber-50'
                              }`}
                            >
                              <Clock className="w-3.5 h-3.5" />
                              <span>Late (နောက်ကျ)</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStudentCheckIn(sess.id, 'clear')}
                              className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>ပြန်ဖျက်မည် (Undo Check-in)</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="neu-card rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-slate-200/70 dark:border-slate-800">
              <div className="flex items-start sm:items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-xs sm:text-sm font-extrabold text-slate-800 dark:text-slate-100">
                      🔒 လက်ရှိတွင် Attendance ပိတ်ထားပါသည် (Attendance Check-in Closed)
                    </h4>
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Admin / Co-Admin များမှ Attendance ဖွင့်ပေးထားသည့် အချိန်တွင်သာ ကျောင်းသားများ ကိုယ်တိုင် Attendance နှိပ်နိုင်ပါသည်။ ကြိုတင်ခွင့်တိုင်လိုပါက "သီးသန့်စာ" Tab တွင် ပေးပို့ထားနိုင်ပါသည်။
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                {onOpenPrivateNotes && (
                  <button
                    type="button"
                    onClick={onOpenPrivateNotes}
                    className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[11px] font-bold cursor-pointer flex items-center gap-1"
                  >
                    <Lock className="w-3 h-3" />
                    <span>ကြိုတင်ခွင့်တိုင်ရန် (သီးသန့်စာ)</span>
                  </button>
                )}
                <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  🔒 Attendance ပိတ်ထားဆဲ
                </span>
              </div>
            </div>
          )}

          {/* Student Session-by-Session History */}
          <div className="neu-card rounded-3xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200/50 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Attendance History (အတန်းချိန်အလိုက် တက်ရောက်မှု မှတ်တမ်း)
              </h3>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                Total: {sessions.length} Sessions
              </span>
            </div>

            {sessions.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                ဤအတန်းအတွက် Attendance မှတ်တမ်း မရှိသေးပါ။
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[380px] overflow-y-auto">
                {sessions.map((sess) => {
                  const myRec = ClassroomDB.getStudentAttendanceRecord(sess, currentUser);
                  const isInstructorApprovedExcused =
                    myRec?.status === 'excused' && myRec?.checkedInBy === 'instructor';
                  return (
                    <div
                      key={sess.id}
                      className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                            {sess.displayDate}
                          </span>
                          {sess.isOpen ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                              🟢 Open Now
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                              🔒 ပိတ်ထားပြီ (Closed)
                            </span>
                          )}
                          <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {sess.title}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                        {sess.isOpen && !myRec && (
                          <button
                            type="button"
                            onClick={() => handleStudentCheckIn(sess.id, 'present')}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5"
                          >
                            <Hand className="w-3.5 h-3.5" />
                            <span>Present (တက်ရောက်သည်)</span>
                          </button>
                        )}
                        {sess.isOpen && myRec && !isInstructorApprovedExcused && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {myRec.status !== 'present' && (
                              <button
                                type="button"
                                onClick={() => handleStudentCheckIn(sess.id, 'present')}
                                className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/70 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 text-[11px] font-bold cursor-pointer"
                              >
                                Present သို့ပြောင်းမည်
                              </button>
                            )}
                            {myRec.status !== 'late' && (
                              <button
                                type="button"
                                onClick={() => handleStudentCheckIn(sess.id, 'late')}
                                className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/70 hover:bg-amber-100 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700 text-[11px] font-bold cursor-pointer"
                              >
                                Late
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleStudentCheckIn(sess.id, 'clear')}
                              className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/70 hover:bg-rose-100 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-700 text-[11px] font-bold cursor-pointer flex items-center gap-1"
                              title="Attendance မပိတ်မီ မှတ်တမ်းပြန်ဖျက်ရန်"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>ပြန်ဖျက်မည်</span>
                            </button>
                          </div>
                        )}
                        {renderStatusBadge(myRec?.status)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* INSTRUCTOR VIEW (Admin & Co-Admin): Compact Sub-Tabbed Attendance     */}
      {/* ===================================================================== */}
      {isInstructor && (() => {
        const pendingLeavesForActive = activeSession
          ? ClassroomDB.getPendingLeaveRequestsForDate(course.id, activeSession.date)
          : [];
        const approvedLeavesForActive = activeSession
          ? ClassroomDB.getApprovedLeaveRequestsForDate(course.id, activeSession.date)
          : [];
        const closeCheckForCourse = ClassroomDB.checkCanCloseCourseAttendance(course.id);
        const allPendingLeavesMap = new Map<string, PrivateNote>();
        pendingLeavesForActive.forEach((p) => allPendingLeavesMap.set(p.id, p));
        closeCheckForCourse.pendingLeaves.forEach((p) => allPendingLeavesMap.set(p.id, p));
        const pendingLeavesToReview = Array.from(allPendingLeavesMap.values());

        return (
          <div className="space-y-4">
            {/* Blocked Attendance Close / Re-Open Warning & Direct Leave Approval Card */}
            {(pendingLeavesToReview.length > 0 || blockedLeaveAlert) && (
              <div className="neu-card rounded-3xl p-4 space-y-3 ring-2 ring-amber-500/60 border border-amber-400/50 animate-fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-start gap-2.5">
                    <div className="p-2 rounded-xl bg-amber-600 text-white shrink-0 shadow-xs">
                      <AlertCircle className="w-4 h-4 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="text-xs sm:text-sm font-extrabold text-amber-900 dark:text-amber-200">
                        ⚠️ ဤနေ့အတွက် ကျောင်းသား ခွင့်တိုင်ကြားစာ ({pendingLeavesToReview.length} စောင်) စစ်ဆေးရန် ကျန်ရှိနေပါသည်!
                      </h3>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                        {blockedLeaveAlert ||
                          'ခွင့်တိုင်စာကို Approve သို့မဟုတ် Reject လုပ်ပြီးမှသာ Attendance ပိတ်/ဖွင့် ပြုလုပ်နိုင်ပါမည်။'}
                      </p>
                    </div>
                  </div>
                  {onOpenPrivateNotes && (
                    <button
                      type="button"
                      onClick={onOpenPrivateNotes}
                      className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 text-xs font-bold shrink-0 cursor-pointer self-start sm:self-center"
                    >
                      သီးသန့်စာ Tab သို့ →
                    </button>
                  )}
                </div>

                {pendingLeavesToReview.length > 0 && (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {pendingLeavesToReview.map((leaveNote) => (
                      <div
                        key={leaveNote.id}
                        className="p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/35 border border-amber-300/70 dark:border-amber-800/70 space-y-2"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                                🎓 {leaveNote.studentName}
                              </span>
                              <span className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400">
                                @{leaveNote.studentUsername}
                              </span>
                              <span className="px-2 py-0.5 rounded-lg bg-amber-200/80 dark:bg-amber-900 text-amber-900 dark:text-amber-200 text-[10px] font-bold">
                                📅 {leaveNote.leaveDate || activeSession?.date}
                              </span>
                            </div>
                            <p className="text-xs text-slate-700 dark:text-slate-200 mt-0.5">
                              <strong>{leaveNote.subject}:</strong> "{leaveNote.content}"
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleQuickResolveLeaveRequest(leaveNote, 'approved')}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center gap-1 shadow-xs cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>✓ Approve (Auto Excused)</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleQuickResolveLeaveRequest(leaveNote, 'rejected')}
                              className="px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>✕ Reject</span>
                            </button>
                          </div>
                        </div>

                        <input
                          type="text"
                          value={quickReplyDrafts[leaveNote.id] || ''}
                          onChange={(e) =>
                            setQuickReplyDrafts((prev) => ({
                              ...prev,
                              [leaveNote.id]: e.target.value,
                            }))
                          }
                          placeholder="မှတ်ချက် (မထည့်ဘဲ တိုက်ရိုက် Approve / Reject နှိပ်နိုင်ပါသည်)..."
                          className="w-full px-3 py-1 rounded-xl bg-white dark:bg-slate-900 border border-amber-300/80 dark:border-amber-800 text-xs text-slate-900 dark:text-slate-100"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Compact Top Navigation Bar: Sub-Tabs + Open New Session Toggle + Quick Close */}
            <div className="neu-card rounded-2xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-2.5">
              {/* Sub-Tab Switcher */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setInstructorSubTab('roll_call')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer ${
                    instructorSubTab === 'roll_call'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white/70 dark:bg-slate-900/70 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                  }`}
                >
                  <CalendarCheck className="w-3.5 h-3.5" />
                  <span>📋 နေ့စဉ် Attendance ခြစ်ရန်</span>
                  {activeSession && (
                    <span
                      className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono ${
                        instructorSubTab === 'roll_call'
                          ? 'bg-indigo-800/80 text-indigo-100'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {checkedInStudents.length}/{enrolledStudents.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setInstructorSubTab('summary')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer ${
                    instructorSubTab === 'summary'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white/70 dark:bg-slate-900/70 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                  }`}
                >
                  <Award className="w-3.5 h-3.5" />
                  <span>📊 စုစုပေါင်း Roll Call % နှင့် Certificate စာရင်း</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono ${
                      instructorSubTab === 'summary'
                        ? 'bg-indigo-800/80 text-indigo-100'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {enrolledStudents.length} ဦး
                  </span>
                </button>
              </div>

              {/* Right Quick Actions: Active Open Status + Toggle New Session Form */}
              <div className="flex flex-wrap items-center gap-2">
                {openSessions.length > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-700">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                    <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-200">
                      ဖွင့်ထားဆဲ: {openSessions[0]?.displayDate}
                    </span>
                    <button
                      type="button"
                      onClick={handleCloseAllOpenAttendance}
                      className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-extrabold transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Lock className="w-3 h-3" />
                      <span>ပိတ်မည်</span>
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setShowCreateSessionForm((prev) => !prev)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer ${
                    showCreateSessionForm
                      ? 'bg-slate-800 text-white dark:bg-slate-700'
                      : 'neu-btn-emerald'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>
                    {showCreateSessionForm
                      ? '✕ ပိတ်မည်'
                      : '+ Attendance အသစ်ဖွင့်ရန်'}
                  </span>
                </button>
              </div>
            </div>

            {/* Collapsible Open New Daily Attendance Form */}
            {showCreateSessionForm && (
              <div className="neu-card rounded-2xl p-4 animate-fade-in">
                <form
                  onSubmit={handleCreateSession}
                  className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
                >
                  <div className="md:col-span-5">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Session / Lecture Title (သင်ခန်းစာ / အတန်းချိန် အမည်)
                    </label>
                    <input
                      type="text"
                      placeholder="ဥပမာ - Lecture 04: Daily Class Check-in..."
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      className="w-full px-3 py-2 text-xs neu-input rounded-xl text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div className="md:col-span-3">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Date (နေ့စွဲ)
                    </label>
                    <input
                      type="date"
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                      className="w-full px-3 py-2 text-xs neu-input rounded-xl text-slate-900 dark:text-slate-100 font-mono"
                      required
                    />
                  </div>

                  <div className="md:col-span-4 flex items-center justify-between md:justify-end gap-2.5">
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={openImmediately}
                        onChange={(e) => setOpenImmediately(e.target.checked)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>Open Self Check-in</span>
                    </label>

                    <button
                      type="submit"
                      className="px-4 py-2 neu-btn-emerald text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>ဖွင့်လှစ်မည်</span>
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* ================================================================= */}
            {/* SUB-TAB 1: Daily Roll Call & Self Check-in Control Panel          */}
            {/* ================================================================= */}
            {instructorSubTab === 'roll_call' && (
              <div className="neu-card rounded-3xl overflow-hidden">
                {/* Compact Session Selector & Action Bar */}
                <div className="p-3.5 sm:p-4 border-b border-slate-200/50 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
                      Daily Roll Call Sheet
                    </h3>
                    {approvedLeavesForActive.length > 0 && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 text-[10px] font-bold text-indigo-800 dark:text-indigo-300">
                        <CheckCircle2 className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                        <span>ခွင့်ပြုပြီး ({approvedLeavesForActive.length} ဦး Auto Excused)</span>
                      </span>
                    )}
                  </div>

                  {sessions.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <select
                        value={activeSession?.id || ''}
                        onChange={(e) => {
                          setSelectedSessionId(e.target.value);
                          setBlockedLeaveAlert(null);
                        }}
                        className="px-3 py-1.5 text-xs font-semibold neu-input rounded-xl text-slate-900 dark:text-slate-100"
                      >
                        {sessions.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.displayDate} — {s.title} {s.isOpen ? '(🟢 OPEN)' : '(🔒 Closed)'}
                          </option>
                        ))}
                      </select>

                      {activeSession && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleToggleOpen(activeSession)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1 cursor-pointer ${
                              activeSession.isOpen
                                ? 'bg-rose-600 hover:bg-rose-700 border-rose-600 text-white shadow-xs'
                                : 'bg-emerald-600 hover:bg-emerald-700 border-emerald-600 text-white shadow-xs'
                            }`}
                          >
                            {activeSession.isOpen ? (
                              <>
                                <Lock className="w-3.5 h-3.5" />
                                <span>🔒 Attendance ပိတ်မည်</span>
                              </>
                            ) : (
                              <>
                                <Unlock className="w-3.5 h-3.5" />
                                <span>🔓 Attendance ပြန်ဖွင့်မည်</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleMarkAllPresent(activeSession.id)}
                            className="px-2.5 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <CheckCheck className="w-3.5 h-3.5" />
                            <span>Mark All Present</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setCompactGridView((prev) => !prev)}
                            className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-[11px] font-bold cursor-pointer hidden xl:inline-flex items-center gap-1"
                            title="2-Column Grid / 1-Column List ပြောင်းကြည့်ရန်"
                          >
                            <span>{compactGridView ? '☷ 2-Col Grid' : '☰ 1-Col List'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteSession(activeSession)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                            title="Delete this attendance session"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {!activeSession ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    Attendance session မရှိသေးပါ။ အပေါ်ရှိ "+ Attendance အသစ်ဖွင့်ရန်" ဖြင့် စတင်ဖွင့်လှစ်ပါ။
                  </div>
                ) : enrolledStudents.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    ဤအတန်းတွင် ကျောင်းသား စာရင်းသွင်းထားခြင်း မရှိသေးပါ။
                  </div>
                ) : (
                  <div>
                    {/* Compact Filter & Search Header */}
                    <div className="p-3 sm:px-4 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-200/70 dark:border-slate-800 space-y-2.5">
                      {/* Row 1: Status Filter Pills + Search + Quick Copy/Mark */}
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setRollCallFilter('all')}
                            className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                              rollCallFilter === 'all'
                                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xs'
                                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            အားလုံး ({enrolledStudents.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setRollCallFilter('checked_in')}
                            className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                              rollCallFilter === 'checked_in'
                                ? 'bg-emerald-600 text-white shadow-2xs'
                                : 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            }`}
                          >
                            <UserCheck className="w-3 h-3" />
                            <span>နှိပ်ပြီးသူ ({checkedInStudents.length})</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setRollCallFilter('not_checked_in')}
                            className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                              rollCallFilter === 'not_checked_in'
                                ? 'bg-rose-600 text-white shadow-2xs'
                                : 'bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                            }`}
                          >
                            <UserX className="w-3 h-3" />
                            <span>မနှိပ်ရသေးသူ ({notCheckedInStudents.length})</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setRollCallFilter('present')}
                            className={`px-2 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                              rollCallFilter === 'present'
                                ? 'bg-emerald-700 text-white'
                                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            Present ({presentStudentsCount})
                          </button>
                          <button
                            type="button"
                            onClick={() => setRollCallFilter('late')}
                            className={`px-2 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                              rollCallFilter === 'late'
                                ? 'bg-amber-500 text-white'
                                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            Late ({lateStudentsCount})
                          </button>
                          <button
                            type="button"
                            onClick={() => setRollCallFilter('excused')}
                            className={`px-2 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                              rollCallFilter === 'excused'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            Excused ({excusedStudentsCount})
                          </button>
                          <button
                            type="button"
                            onClick={() => setRollCallFilter('absent')}
                            className={`px-2 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                              rollCallFilter === 'absent'
                                ? 'bg-rose-700 text-white'
                                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            Absent ({absentMarkedStudentsCount})
                          </button>
                        </div>

                        {/* Search & Copy Action Buttons */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <div className="relative flex-1 sm:w-48">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                              type="text"
                              value={rollCallSearch}
                              onChange={(e) => setRollCallSearch(e.target.value)}
                              placeholder="အမည် / @username ရှာရန်..."
                              className="w-full pl-8 pr-2.5 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => handleCopyAttendanceGroupList('not_checked_in')}
                            disabled={notCheckedInStudents.length === 0}
                            className="px-2.5 py-1 rounded-xl bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-[11px] font-bold transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            title="Attendance မနှိပ်ရသေးသူများ စာရင်းကို Copy ကူးယူရန်"
                          >
                            <Copy className="w-3 h-3" />
                            <span>မနှိပ်ရသေး ({notCheckedInStudents.length})</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleCopyAttendanceGroupList('checked_in')}
                            disabled={checkedInStudents.length === 0}
                            className="px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            title="Attendance နှိပ်ပြီးသူများ စာရင်းကို Copy ကူးယူရန်"
                          >
                            <Copy className="w-3 h-3" />
                            <span>နှိပ်ပြီး ({checkedInStudents.length})</span>
                          </button>

                          {notCheckedInStudents.length > 0 && (
                            <button
                              type="button"
                              onClick={() => handleMarkRemainingAsAbsent(activeSession.id)}
                              className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 text-white text-[11px] font-bold transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <XCircle className="w-3 h-3" />
                              <span>ကျန်သူ Absent ခြစ်မည်</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Row 2: Roll Call Percentage (%) Filter Row */}
                      <div className="pt-2 border-t border-slate-200/70 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] font-extrabold text-slate-600 dark:text-slate-300 mr-1">
                            📊 Roll Call % Filter:
                          </span>
                          <button
                            type="button"
                            onClick={() => setPercentageFilter('all')}
                            className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                              percentageFilter === 'all'
                                ? 'bg-indigo-600 text-white shadow-2xs'
                                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                            }`}
                          >
                            အားလုံး ({enrolledStudents.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setPercentageFilter('100')}
                            className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                              percentageFilter === '100'
                                ? 'bg-emerald-600 text-white shadow-2xs'
                                : 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50'
                            }`}
                          >
                            💯 100% ({countPct100})
                          </button>
                          <button
                            type="button"
                            onClick={() => setPercentageFilter('80_plus')}
                            className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                              percentageFilter === '80_plus'
                                ? 'bg-teal-600 text-white shadow-2xs'
                                : 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 hover:bg-teal-50'
                            }`}
                          >
                            🟢 80% နှင့်အထက် ({countPct80Plus})
                          </button>
                          <button
                            type="button"
                            onClick={() => setPercentageFilter('75_plus')}
                            className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                              percentageFilter === '75_plus'
                                ? 'bg-indigo-600 text-white shadow-2xs'
                                : 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50'
                            }`}
                          >
                            🎓 75% နှင့်အထက် ({countPct75Plus})
                          </button>
                          <button
                            type="button"
                            onClick={() => setPercentageFilter('50_to_79')}
                            className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                              percentageFilter === '50_to_79'
                                ? 'bg-amber-500 text-white shadow-2xs'
                                : 'bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-50'
                            }`}
                          >
                            🟡 50% – 79% ({countPct50To79})
                          </button>
                          <button
                            type="button"
                            onClick={() => setPercentageFilter('under_50')}
                            className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                              percentageFilter === 'under_50'
                                ? 'bg-rose-600 text-white shadow-2xs'
                                : 'bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 hover:bg-rose-50'
                            }`}
                          >
                            🔴 50% အောက် ({countPctUnder50})
                          </button>
                        </div>

                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          ပြသထားသည်: <strong>{filteredRollCallStudents.length}</strong> ဦး
                        </span>
                      </div>
                    </div>

                    {/* Self-Contained Scrollable Student Roll Call List / 2-Col Grid */}
                    {filteredRollCallStudents.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                        ရွေးချယ်ထားသော စစ်ထုတ်မှုအောက်တွင် ကျောင်းသားမရှိပါ။
                      </div>
                    ) : (
                      <div
                        className={`max-h-[480px] overflow-y-auto ${
                          compactGridView
                            ? 'grid grid-cols-1 xl:grid-cols-2 gap-2 p-3'
                            : 'divide-y divide-slate-100 dark:divide-slate-800'
                        }`}
                      >
                        {filteredRollCallStudents.slice(0, visibleRosterLimit).map((stu, idx) => {
                          const rec = ClassroomDB.getStudentAttendanceRecord(activeSession, stu);
                          const currentStatus: AttendanceStatus = rec?.status || 'absent';
                          const isCheckedIn = Boolean(
                            rec &&
                              (rec.status === 'present' ||
                                rec.status === 'late' ||
                                rec.status === 'excused')
                          );
                          const stuPct = studentStatsMap.get(stu.id)?.percentage ?? 0;

                          return (
                            <div
                              key={stu.id}
                              className={`px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-colors ${
                                compactGridView
                                  ? 'rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/60 dark:bg-slate-900/50'
                                  : ''
                              } ${
                                isCheckedIn
                                  ? 'hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20'
                                  : 'hover:bg-rose-50/30 dark:hover:bg-rose-950/20'
                              }`}
                            >
                              <div className="flex items-center gap-2 flex-wrap min-w-0">
                                <span className="text-[11px] font-mono font-bold text-slate-400 w-6 shrink-0">
                                  #{idx + 1}
                                </span>
                                <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                  {stu.name}
                                </span>
                                <span className="text-[11px] font-mono text-slate-400 truncate">
                                  @{stu.username}
                                </span>
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold border shrink-0 ${
                                    stuPct === 100
                                      ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                                      : stuPct >= 80
                                      ? 'bg-teal-50 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800'
                                      : stuPct >= 50
                                      ? 'bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                      : 'bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                                  }`}
                                >
                                  {stuPct}%
                                </span>
                              </div>

                              {/* Compact 4-State Roll Call Buttons */}
                              <div className="flex flex-wrap items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleInstructorMark(activeSession.id, stu, 'present')
                                  }
                                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                                    currentStatus === 'present' && rec
                                      ? 'bg-emerald-600 text-white shadow-2xs'
                                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 hover:text-emerald-700'
                                  }`}
                                >
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Present</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    handleInstructorMark(activeSession.id, stu, 'late')
                                  }
                                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                                    currentStatus === 'late'
                                      ? 'bg-amber-500 text-white shadow-2xs'
                                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-amber-950/50 hover:text-amber-700'
                                  }`}
                                >
                                  <Clock className="w-3 h-3" />
                                  <span>Late</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    handleInstructorMark(activeSession.id, stu, 'excused')
                                  }
                                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                                    currentStatus === 'excused'
                                      ? 'bg-indigo-600 text-white shadow-2xs'
                                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:text-indigo-700'
                                  }`}
                                >
                                  <AlertCircle className="w-3 h-3" />
                                  <span>Excused</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    handleInstructorMark(activeSession.id, stu, 'absent')
                                  }
                                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                                    !rec || currentStatus === 'absent'
                                      ? 'bg-rose-600 text-white shadow-2xs'
                                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:text-rose-700'
                                  }`}
                                >
                                  <XCircle className="w-3 h-3" />
                                  <span>Absent</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {filteredRollCallStudents.length > visibleRosterLimit && (
                      <div className="p-3 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between gap-2 text-xs">
                        <span className="text-slate-600 dark:text-slate-300">
                          ပြသထားသည်: <strong>{visibleRosterLimit}</strong> / <strong>{filteredRollCallStudents.length}</strong> ဦး
                        </span>
                        <button
                          type="button"
                          onClick={() => setVisibleRosterLimit(enrolledStudents.length)}
                          className="px-3 py-1 rounded-xl neu-btn-indigo text-xs font-bold cursor-pointer"
                        >
                          အားလုံးပြမည် ({filteredRollCallStudents.length})
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ================================================================= */}
            {/* SUB-TAB 2: Overall Student Attendance Percentage & Certificate    */}
            {/* ================================================================= */}
            {instructorSubTab === 'summary' && (
              <div className="neu-card rounded-3xl overflow-hidden">
                <div className="p-3.5 sm:p-4 border-b border-slate-200/50 dark:border-slate-800 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                        <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        <span>
                          Attendance Percentage & Certificate Eligibility (စုစုပေါင်း Roll Call % နှင့် Certificate စာရင်း)
                        </span>
                      </h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 self-start sm:self-center shrink-0">
                      <div className="relative w-48">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={rollCallSearch}
                          onChange={(e) => setRollCallSearch(e.target.value)}
                          placeholder="အမည် / @username ရှာရန်..."
                          className="w-full pl-8 pr-2.5 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <span className="text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                        Sessions: {sessions.length}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const res = ClassroomDB.downloadClassAttendanceCSV(course.id);
                          if (res.success) {
                            showToast(`📥 Attendance Report CSV (${res.filename}) ဒေါင်းလုဒ်ဆွဲပြီးပါပြီ!`);
                          }
                        }}
                        className="px-3 py-1.5 rounded-xl neu-btn-emerald text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Export CSV</span>
                      </button>
                    </div>
                  </div>

                  {/* Roll Call Percentage Filter Pills in Summary Section */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-extrabold text-slate-600 dark:text-slate-300 mr-1">
                        📊 Roll Call % Filter:
                      </span>
                      <button
                        type="button"
                        onClick={() => setPercentageFilter('all')}
                        className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                          percentageFilter === 'all'
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                        }`}
                      >
                        အားလုံး ({enrolledStudents.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setPercentageFilter('100')}
                        className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                          percentageFilter === '100'
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50'
                        }`}
                      >
                        💯 100% ({countPct100})
                      </button>
                      <button
                        type="button"
                        onClick={() => setPercentageFilter('80_plus')}
                        className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                          percentageFilter === '80_plus'
                            ? 'bg-teal-600 text-white shadow-2xs'
                            : 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 hover:bg-teal-50'
                        }`}
                      >
                        🟢 80% နှင့်အထက် ({countPct80Plus})
                      </button>
                      <button
                        type="button"
                        onClick={() => setPercentageFilter('75_plus')}
                        className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                          percentageFilter === '75_plus'
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50'
                        }`}
                      >
                        🎓 75% နှင့်အထက် ({countPct75Plus})
                      </button>
                      <button
                        type="button"
                        onClick={() => setPercentageFilter('50_to_79')}
                        className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                          percentageFilter === '50_to_79'
                            ? 'bg-amber-500 text-white shadow-2xs'
                            : 'bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-50'
                        }`}
                      >
                        🟡 50% – 79% ({countPct50To79})
                      </button>
                      <button
                        type="button"
                        onClick={() => setPercentageFilter('under_50')}
                        className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                          percentageFilter === 'under_50'
                            ? 'bg-rose-600 text-white shadow-2xs'
                            : 'bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 hover:bg-rose-50'
                        }`}
                      >
                        🔴 50% အောက် ({countPctUnder50})
                      </button>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      ပြသထားသည်: <strong>{filteredSummaryStudents.length}</strong> ဦး
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800">
                      <tr className="border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                        <th className="py-2.5 px-4">Student</th>
                        <th className="py-2.5 px-3 text-center">Present</th>
                        <th className="py-2.5 px-3 text-center">Late</th>
                        <th className="py-2.5 px-3 text-center">Excused</th>
                        <th className="py-2.5 px-3 text-center">Absent</th>
                        <th className="py-2.5 px-4">Attendance %</th>
                        <th className="py-2.5 px-4 text-right">Certificate Evaluation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                      {filteredSummaryStudents.slice(0, visibleRosterLimit).map((stu, idx) => {
                        const st =
                          studentStatsMap.get(stu.id) ||
                          ClassroomDB.getStudentAttendanceStats(course.id, stu.id);
                        const stuProg = ClassroomDB.getStudentProgress(stu.id, course.id);
                        const isEligible = st.percentage >= 75;

                        return (
                          <tr
                            key={stu.id}
                            className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
                          >
                            <td className="py-2.5 px-4">
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-mono text-slate-400 w-6">
                                  #{idx + 1}
                                </span>
                                <div>
                                  <div className="font-bold text-slate-900 dark:text-white">
                                    {stu.name}
                                  </div>
                                  <div className="text-[11px] text-slate-400 font-mono">
                                    @{stu.username}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              {st.presentCount}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-amber-600 dark:text-amber-400">
                              {st.lateCount}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-indigo-600 dark:text-indigo-400">
                              {st.excusedCount}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-rose-600 dark:text-rose-400">
                              {st.absentCount}
                            </td>
                            <td className="py-2.5 px-4 min-w-[150px]">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      st.percentage >= 75
                                        ? 'bg-emerald-500'
                                        : st.percentage >= 50
                                        ? 'bg-amber-500'
                                        : 'bg-rose-500'
                                    }`}
                                    style={{ width: `${st.percentage}%` }}
                                  />
                                </div>
                                <span className="font-mono font-bold text-slate-900 dark:text-white w-10 text-right">
                                  {st.percentage}%
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                    isEligible
                                      ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                      : 'bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                                  }`}
                                >
                                  {isEligible ? '✓ Eligible (≥75%)' : '<75%'}
                                </span>

                                {stuProg.certificate ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onOpenCertificate && onOpenCertificate(stuProg.certificate!)
                                    }
                                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold transition-colors cursor-pointer flex items-center gap-1"
                                  >
                                    <Award className="w-3 h-3" />
                                    <span>View Cert</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const cert = ClassroomDB.issueCertificate(stu, course);
                                      showToast(`${stu.name} အတွက် Certificate ထုတ်ပေးပြီးပါပြီ!`);
                                      onRefresh();
                                      if (onOpenCertificate) {
                                        onOpenCertificate(cert);
                                      }
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold transition-colors cursor-pointer flex items-center gap-1"
                                  >
                                    <Award className="w-3 h-3" />
                                    <span>Issue Cert</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {filteredSummaryStudents.length > visibleRosterLimit && (
                  <div className="p-3 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between gap-2 text-xs">
                    <span className="text-slate-600 dark:text-slate-300">
                      ပြသထားသည်: <strong>{visibleRosterLimit}</strong> / <strong>{filteredSummaryStudents.length}</strong> ဦး
                    </span>
                    <button
                      type="button"
                      onClick={() => setVisibleRosterLimit(enrolledStudents.length)}
                      className="px-3 py-1 rounded-xl neu-btn-indigo text-xs font-bold cursor-pointer"
                    >
                      အားလုံးပြမည် ({filteredSummaryStudents.length})
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* Delete Attendance Session Confirmation Modal */}
      {sessionToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Attendance မှတ်တမ်း ဖျက်ရန် အတည်ပြုပါ
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                  <strong>"{sessionToDelete.title} ({sessionToDelete.displayDate})"</strong> မှတ်တမ်းကို ဖျက်လိုပါသလား? (SQL Database မှလည်း တစ်ပါတည်း အလိုအလျောက် ဖျက်သိမ်းသွားပါမည်။)
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setSessionToDelete(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                မဖျက်တော့ပါ (Cancel)
              </button>
              <button
                type="button"
                onClick={confirmDeleteSession}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors shadow-xs cursor-pointer"
              >
                သေချာပါသည်၊ ဖျက်မည်
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
