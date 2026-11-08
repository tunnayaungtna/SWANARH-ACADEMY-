import React, { useState, useEffect } from 'react';
import { Course, User } from '../types/classroom';
import { ClassroomDB } from '../services/storage';
import {
  CalendarCheck,
  CheckCircle2,
  Download,
  Hand,
  Lock,
  Unlock,
  Plus,
  Users,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Edit3,
  Clock,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { AttendanceStatus } from '../types/classroom';

interface DashboardAttendanceWidgetProps {
  courses: Course[];
  currentUser: User;
  onRefresh: () => void;
  onOpenCourse?: (course: Course) => void;
}

export const DashboardAttendanceWidget: React.FC<DashboardAttendanceWidgetProps> = ({
  courses,
  currentUser,
  onRefresh,
  onOpenCourse,
}) => {
  const isInstructor = currentUser.role === 'admin' || currentUser.role === 'co_admin';
  const [selectedCourseId, setSelectedCourseId] = useState<string>(courses[0]?.id || '');
  const [sessionTitle, setSessionTitle] = useState('');
  const [expandedRoster, setExpandedRoster] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [editingSessionIds, setEditingSessionIds] = useState<Record<string, boolean>>({});
  const [dashboardRosterFilter, setDashboardRosterFilter] = useState<
    'all' | 'checked_in' | 'not_checked_in'
  >('all');

  useEffect(() => {
    let mounted = true;
    const syncNow = () => {
      if (document.visibilityState === 'visible' && navigator.onLine !== false) {
        ClassroomDB.syncAttendanceFromCloud().then((changed) => {
          if (mounted && changed) {
            onRefresh();
          }
        });
      }
    };
    syncNow();
    const timer = setInterval(syncNow, 5000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [courses.length]);

  if (courses.length === 0) return null;

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3200);
  };

  const activeCourse = courses.find((c) => c.id === selectedCourseId) || courses[0];
  const allUsers = ClassroomDB.getAllUsers();

  // For Admin/Co-Admin: Open Attendance for a specific class
  const handleOpenClassAttendance = (course: Course, customTitle?: string) => {
    const sessions = ClassroomDB.getAttendanceSessions(course.id);
    const existingOpen = sessions.find((s) => s.isOpen);

    if (existingOpen) {
      showToast(`"${course.code}" တွင် Open Attendance ဖွင့်ထားပြီးသား ဖြစ်ပါသည်။`);
      return;
    }

    const todayIso = new Date().toISOString().slice(0, 10);
    const existingTodayClosed = !customTitle?.trim()
      ? sessions.find((s) => s.date === todayIso && !s.isOpen)
      : undefined;

    if (existingTodayClosed) {
      ClassroomDB.toggleAttendanceSessionOpen(existingTodayClosed.id, true, currentUser);
      setSessionTitle('');
      showToast(
        `✅ "${course.code}: ${course.title}" အတွက် ယနေ့ Attendance ကို ပြန်ဖွင့်ပေးလိုက်ပါပြီ! ကျောင်းသားများ "Mark Present" နှိပ်နိုင်ပါပြီ။`
      );
      onRefresh();
      return;
    }

    const titleToUse =
      customTitle?.trim() ||
      `Daily Attendance Check-in (${new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })})`;

    ClassroomDB.createAttendanceSession(course.id, titleToUse, todayIso, true, currentUser);
    setSessionTitle('');
    showToast(
      `✅ "${course.code}: ${course.title}" အတွက် Open Attendance ဖွင့်ပေးလိုက်ပါပြီ! ကျောင်းသားများ Dashboard တွင် "Mark Present" နှိပ်နိုင်ပါပြီ။`
    );
    onRefresh();
  };

  const handleCloseClassAttendance = (sessionId: string, courseId: string, courseCode: string) => {
    const closedCount = ClassroomDB.closeAllOpenAttendanceForCourse(courseId, currentUser);
    if (closedCount === 0) {
      ClassroomDB.toggleAttendanceSessionOpen(sessionId, false, currentUser);
    }
    showToast(`🔒 "${courseCode}" ၏ Attendance Check-in ကို ပိတ်လိုက်ပါပြီ။`);
    onRefresh();
  };

  const handleStudentMarkPresent = (
    sessionId: string,
    courseTitle: string,
    status: AttendanceStatus | 'clear' = 'present'
  ) => {
    const res = ClassroomDB.studentCheckIn(sessionId, currentUser, status);
    if (!res.success && res.error) {
      showToast(res.error);
      return;
    }
    setEditingSessionIds((prev) => ({ ...prev, [sessionId]: false }));
    if (status === 'clear') {
      showToast(`🔄 "${courseTitle}" အတွက် Attendance မှတ်တမ်းကို ပြန်ဖျက်ပြီးပါပြီ။`);
    } else if (status === 'late') {
      showToast(`⏰ "${courseTitle}" အတွက် Late (နောက်ကျ) အဖြစ် ပြင်ဆင်မှတ်တမ်းတင်ပြီးပါပြီ!`);
    } else if (status === 'excused') {
      showToast(`📝 "${courseTitle}" အတွက် Excused (ခွင့်တိုင်) အဖြစ် ပြင်ဆင်မှတ်တမ်းတင်ပြီးပါပြီ!`);
    } else {
      showToast(`✅ "${courseTitle}" အတွက် Mark Present (တက်ရောက်သည်) မှတ်တမ်းတင်ပြီးပါပြီ!`);
    }
    onRefresh();
  };

  const handleExportClassCSV = (courseId: string) => {
    const res = ClassroomDB.downloadClassAttendanceCSV(courseId);
    if (res.success) {
      showToast(`📥 Attendance CSV Report (${res.filename}) ဒေါင်းလုဒ်ဆွဲပြီးပါပြီ။`);
    }
  };

  // =========================================================================
  // STUDENT DASHBOARD VIEW: "Mark Present" Button & Total Attendance %
  // =========================================================================
  if (!isInstructor) {
    const courseAttendanceCards = courses.map((course) => {
      const sessions = ClassroomDB.getAttendanceSessions(course.id);
      const openSession = sessions.find((s) => s.isOpen);
      const stats = ClassroomDB.getStudentAttendanceStats(course.id, currentUser.id);
      const totalPct = ClassroomDB.calculateTotalAttendancePercentage(
        course.id,
        currentUser.id
      );
      const myRecord = openSession ? openSession.records[currentUser.id] : undefined;
      const isMarkedPresent =
        myRecord?.status === 'present' || myRecord?.status === 'late';

      return {
        course,
        openSession,
        stats,
        totalPct,
        myRecord,
        isMarkedPresent,
      };
    });

    const hasAnyOpenSession = courseAttendanceCards.some((c) => !!c.openSession);

    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-4 sm:p-6 space-y-4">
        {toastMsg && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{toastMsg}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2.5 rounded-xl text-white shadow-xs ${
                hasAnyOpenSession ? 'bg-emerald-600' : 'bg-indigo-600'
              }`}
            >
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  Daily Attendance & Check-in (အတန်းတက်ရောက်မှု မှတ်တမ်း)
                </h2>
                {hasAnyOpenSession && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 animate-pulse">
                    <Sparkles className="w-3 h-3" />
                    Attendance Open Now
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                ဆရာမှ Open Attendance ဖွင့်ပေးထားချိန်တွင် "Mark Present" ခလုတ်ကို တစ်ချက်နှိပ်၍ အတန်းတက်ရောက်ကြောင်း စာရင်းသွင်းနိုင်ပါသည်။
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {courseAttendanceCards.map(
            ({ course, openSession, stats, totalPct, myRecord, isMarkedPresent }) => (
              <div
                key={course.id}
                className={`p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                  openSession
                    ? 'bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700/80 shadow-xs'
                    : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800">
                      {course.code}
                    </span>
                    <span className="text-xs font-mono font-extrabold text-emerald-700 dark:text-emerald-300">
                      Total Attendance: {totalPct}%
                    </span>
                  </div>

                  <h3
                    onClick={() => onOpenCourse && onOpenCourse(course)}
                    className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white line-clamp-1 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
                  >
                    {course.title}
                  </h3>

                  {/* Attendance Progress Bar */}
                  <div>
                    <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          totalPct >= 75
                            ? 'bg-emerald-500'
                            : totalPct >= 50
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                        }`}
                        style={{ width: `${totalPct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-1">
                      <span>
                        Present: {stats.presentCount + stats.lateCount}/{stats.totalSessions} Sessions
                      </span>
                      <span>{totalPct >= 75 ? '✓ Cert Eligible' : 'Min 75% Req'}</span>
                    </div>
                  </div>
                </div>

                {/* Mark Present Action Area */}
                <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800">
                  {openSession ? (
                    <div className="space-y-2">
                      <div className="text-[11px] text-emerald-800 dark:text-emerald-300 font-medium truncate">
                        🟢 {openSession.title} ({openSession.displayDate})
                      </div>
                      {myRecord ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 py-2 px-3 rounded-xl bg-emerald-100 dark:bg-emerald-950/90 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center justify-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                              <span>
                                {myRecord.status === 'present'
                                  ? 'Present (တက်ရောက်)'
                                  : myRecord.status === 'late'
                                  ? 'Late (နောက်ကျ)'
                                  : myRecord.status === 'excused'
                                  ? 'Excused (ခွင့်တိုင်)'
                                  : 'Absent'}{' '}
                                {myRecord.checkedInAt ? `(${myRecord.checkedInAt})` : ''}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setEditingSessionIds((prev) => ({
                                  ...prev,
                                  [openSession.id]: !prev[openSession.id],
                                }))
                              }
                              className="py-2 px-3 rounded-xl bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700 text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>{editingSessionIds[openSession.id] ? 'ပိတ်မည်' : 'ပြန်ပြင်မည်'}</span>
                            </button>
                          </div>

                          {editingSessionIds[openSession.id] && (
                            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2">
                              <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                                Attendance မပိတ်မီ ပြန်လည်ရွေးချယ်ရန် -
                              </div>
                              <div className="grid grid-cols-2 gap-1.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleStudentMarkPresent(openSession.id, course.title, 'present')
                                  }
                                  className="py-1.5 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                                >
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Present</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleStudentMarkPresent(openSession.id, course.title, 'late')
                                  }
                                  className="py-1.5 px-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                                >
                                  <Clock className="w-3 h-3" />
                                  <span>Late</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleStudentMarkPresent(openSession.id, course.title, 'excused')
                                  }
                                  className="py-1.5 px-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                                >
                                  <AlertCircle className="w-3 h-3" />
                                  <span>Excused</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleStudentMarkPresent(openSession.id, course.title, 'clear')
                                  }
                                  className="py-1.5 px-2 rounded-lg bg-rose-50 dark:bg-rose-950/70 hover:bg-rose-100 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-700 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>ပြန်ဖျက်မည်</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleStudentMarkPresent(openSession.id, course.title, 'present')}
                          className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Hand className="w-4 h-4" />
                          <span>Mark Present (တက်ရောက်သည်)</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 py-1">
                      <span>No active check-in right now</span>
                      {onOpenCourse && (
                        <button
                          type="button"
                          onClick={() => onOpenCourse(course)}
                          className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold cursor-pointer"
                        >
                          View Class →
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          )}
        </div>
      </div>
    );
  }

  // =========================================================================
  // ADMIN & CO-ADMIN DASHBOARD VIEW: Open Attendance per Class & Percentages
  // =========================================================================
  const activeCourseSessions = ClassroomDB.getAttendanceSessions(activeCourse.id);
  const activeOpenSession = activeCourseSessions.find((s) => s.isOpen);
  const enrolledStudentsInActive = allUsers.filter(
    (u) => u.role === 'student' && activeCourse.enrolledStudentIds.includes(u.id)
  );

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-4 sm:p-6 space-y-5">
      {toastMsg && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header & Quick Class Attendance Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-600 text-white shadow-xs shrink-0">
            <CalendarCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
              Classroom Attendance Tracker (အတန်းအလိုက် Open Attendance ဖွင့်ရန် နှင့် ရာခိုင်နှုန်းစစ်ဆေးရန်)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              သတ်မှတ်ထားသော အတန်းအတွက် "Open Attendance" ဖွင့်ပေးလိုက်ပါက ကျောင်းသားများ၏ Dashboard တွင် "Mark Present" ခလုတ် ချက်ချင်းပေါ်လာပါမည်။
            </p>
          </div>
        </div>

        {/* Export All Classes CSV Button */}
        <div className="flex items-center gap-2 self-start lg:self-center shrink-0">
          <button
            type="button"
            onClick={() => handleExportClassCSV(activeCourse.id)}
            className="px-3.5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Export selected class attendance report as CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export {activeCourse.code} CSV</span>
          </button>
        </div>
      </div>

      {/* Class Cards Grid: Open / Close Attendance per Class */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {courses.map((course) => {
          const sessions = ClassroomDB.getAttendanceSessions(course.id);
          const openSess = sessions.find((s) => s.isOpen);
          const isSelected = course.id === activeCourse.id;
          const enrolledList = allUsers.filter(
            (u) => u.role === 'student' && course.enrolledStudentIds.includes(u.id)
          );
          const avgAttendance =
            enrolledList.length > 0
              ? Math.round(
                  enrolledList.reduce(
                    (acc, stu) =>
                      acc + ClassroomDB.calculateTotalAttendancePercentage(course.id, stu.id),
                    0
                  ) / enrolledList.length
                )
              : 100;

          const checkedInCount = openSess
            ? Object.values(openSess.records).filter(
                (r) => r.status === 'present' || r.status === 'late'
              ).length
            : 0;

          return (
            <div
              key={course.id}
              onClick={() => setSelectedCourseId(course.id)}
              className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                isSelected
                  ? 'border-indigo-500 dark:border-indigo-500 bg-indigo-50/30 dark:bg-indigo-950/20 ring-1 ring-indigo-500/20'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                    {course.code} · {course.batch}
                  </span>
                  {openSess ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                      🟢 Open ({checkedInCount}/{enrolledList.length})
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono text-slate-400">
                      {sessions.length} Sessions
                    </span>
                  )}
                </div>

                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white mt-1.5 line-clamp-1">
                  {course.title}
                </h3>

                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono">
                  <span>Students: {enrolledList.length}</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    Class Avg: {avgAttendance}%
                  </span>
                </div>
              </div>

              <div
                onClick={(e) => e.stopPropagation()}
                className="pt-2.5 border-t border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-2"
              >
                {openSess ? (
                  <button
                    type="button"
                    onClick={() => handleCloseClassAttendance(openSess.id, course.id, course.code)}
                    className="flex-1 py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Close Attendance</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleOpenClassAttendance(course)}
                    className="flex-1 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    <span>Open Attendance</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleExportClassCSV(course.id)}
                  className="p-2 rounded-lg bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                  title={`Export ${course.code} Attendance CSV`}
                >
                  <Download className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Expandable Student Attendance Percentage Roster for Selected Class */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setExpandedRoster(!expandedRoster)}
            className="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
          >
            <Users className="w-4 h-4" />
            <span>
              {activeCourse.code} Student Attendance Percentages ({enrolledStudentsInActive.length}{' '}
              Students)
            </span>
            {expandedRoster ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          {!activeOpenSession && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder={`Custom session title for ${activeCourse.code}...`}
                value={sessionTitle}
                onChange={(e) => setSessionTitle(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={() => handleOpenClassAttendance(activeCourse, sessionTitle)}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Open Attendance</span>
              </button>
            </div>
          )}
        </div>

        {expandedRoster && (
          <div className="mt-3 space-y-2.5">
            {(() => {
              const latestSess = activeOpenSession || activeCourseSessions[0];
              const checkedCount = latestSess
                ? enrolledStudentsInActive.filter((s) => {
                    const r = latestSess.records[s.id];
                    return Boolean(
                      r && (r.status === 'present' || r.status === 'late' || r.status === 'excused')
                    );
                  }).length
                : 0;
              const notCheckedCount = enrolledStudentsInActive.length - checkedCount;
              const filteredDashStudents = enrolledStudentsInActive.filter((s) => {
                if (!latestSess || dashboardRosterFilter === 'all') return true;
                const r = latestSess.records[s.id];
                const isChk = Boolean(
                  r && (r.status === 'present' || r.status === 'late' || r.status === 'excused')
                );
                return dashboardRosterFilter === 'checked_in' ? isChk : !isChk;
              });

              return (
                <>
                  {latestSess && (
                    <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs">
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        📅 {latestSess.displayDate} — {latestSess.title}
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setDashboardRosterFilter('all')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                            dashboardRosterFilter === 'all'
                              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          အားလုံး ({enrolledStudentsInActive.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setDashboardRosterFilter('checked_in')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                            dashboardRosterFilter === 'checked_in'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          }`}
                        >
                          ✅ နှိပ်ပြီးသူ ({checkedCount})
                        </button>
                        <button
                          type="button"
                          onClick={() => setDashboardRosterFilter('not_checked_in')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                            dashboardRosterFilter === 'not_checked_in'
                              ? 'bg-rose-600 text-white'
                              : 'bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                          }`}
                        >
                          ⏳ မနှိပ်ရသေးသူ ({notCheckedCount})
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                          <th className="py-2.5 px-3.5">Student</th>
                          <th className="py-2.5 px-3 text-center">Present</th>
                          <th className="py-2.5 px-3 text-center">Late</th>
                          <th className="py-2.5 px-3 text-center">Absent</th>
                          <th className="py-2.5 px-3.5">Total Attendance %</th>
                          <th className="py-2.5 px-3.5 text-right">Today&apos;s Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredDashStudents.map((stu) => {
                          const st = ClassroomDB.getStudentAttendanceStats(
                            activeCourse.id,
                            stu.id
                          );
                          const totalPct = ClassroomDB.calculateTotalAttendancePercentage(
                            activeCourse.id,
                            stu.id
                          );
                          const latestRec = latestSess?.records[stu.id];
                          const isCheckedIn = Boolean(
                            latestRec &&
                              (latestRec.status === 'present' ||
                                latestRec.status === 'late' ||
                                latestRec.status === 'excused')
                          );

                          return (
                            <tr
                              key={stu.id}
                              className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30"
                            >
                              <td className="py-2.5 px-3.5 font-semibold text-slate-900 dark:text-white">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span>{stu.name}</span>
                                  <span className="text-[11px] font-mono text-slate-400">
                                    (@{stu.username})
                                  </span>
                                  {latestSess &&
                                    (isCheckedIn ? (
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                                        ✅ နှိပ်ပြီး
                                      </span>
                                    ) : (
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
                                        ⏳ မနှိပ်ရသေး
                                      </span>
                                    ))}
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-600">
                                {st.presentCount}
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono font-bold text-amber-600">
                                {st.lateCount}
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono font-bold text-rose-600">
                                {st.absentCount}
                              </td>
                              <td className="py-2.5 px-3.5">
                                <div className="flex items-center gap-2">
                                  <div className="w-24 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${
                                        totalPct >= 75
                                          ? 'bg-emerald-500'
                                          : totalPct >= 50
                                          ? 'bg-amber-500'
                                          : 'bg-rose-500'
                                      }`}
                                      style={{ width: `${totalPct}%` }}
                                    />
                                  </div>
                                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                                    {totalPct}%
                                  </span>
                                </div>
                              </td>
                              <td className="py-2.5 px-3.5 text-right">
                                {latestSess ? (
                                  isCheckedIn ? (
                                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                      ✓ {latestRec?.status === 'late' ? 'Late' : latestRec?.status === 'excused' ? 'Excused' : 'Present'} (
                                      {latestRec?.checkedInAt})
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        ClassroomDB.instructorMarkAttendance(
                                          latestSess.id,
                                          stu,
                                          'present'
                                        );
                                        onRefresh();
                                      }}
                                      className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold cursor-pointer"
                                    >
                                      Mark Present
                                    </button>
                                  )
                                ) : (
                                  <span className="text-slate-400">No session</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
};
