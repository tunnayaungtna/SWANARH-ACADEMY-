import React, { useState } from 'react';
import {
  Course,
  User,
  AttendanceSession,
  AttendanceStatus,
  CertificateData,
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
} from 'lucide-react';

interface AttendanceViewProps {
  course: Course;
  currentUser: User;
  onRefresh: () => void;
  onOpenCertificate?: (cert: CertificateData) => void;
}

export const AttendanceView: React.FC<AttendanceViewProps> = ({
  course,
  currentUser,
  onRefresh,
  onOpenCertificate,
}) => {
  const isInstructor = currentUser.role === 'admin' || currentUser.role === 'co_admin';
  const sessions = ClassroomDB.getAttendanceSessions(course.id);

  // Selected session for roll call (defaults to first/latest session)
  const [selectedSessionId, setSelectedSessionId] = useState<string>(
    sessions[0]?.id || ''
  );

  // Create new attendance session form state (for Instructors)
  const todayIso = new Date().toISOString().slice(0, 10);
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState(todayIso);
  const [openImmediately, setOpenImmediately] = useState(true);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<AttendanceSession | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3200);
  };

  const activeSession: AttendanceSession | undefined =
    sessions.find((s) => s.id === selectedSessionId) || sessions[0];

  // Enrolled students list
  const allUsers = ClassroomDB.getAllUsers();
  const enrolledStudents = allUsers.filter(
    (u) => u.role === 'student' && course.enrolledStudentIds.includes(u.id)
  );

  // Open sessions where student can self check-in
  const openSessions = sessions.filter((s) => s.isOpen);

  const handleCreateSession = (e: React.FormEvent) => {
    e.preventDefault();
    const created = ClassroomDB.createAttendanceSession(
      course.id,
      newTitle.trim() || `အတန်းချိန် တက်ရောက်မှု (${newDate})`,
      newDate,
      openImmediately,
      currentUser
    );
    setNewTitle('');
    setSelectedSessionId(created.id);
    showToast(
      openImmediately
        ? 'Open Attendance ဖွင့်လှစ်ပြီးပါပြီ! ကျောင်းသားများ "Present" နှိပ်နိုင်ပါပြီ။'
        : 'Attendance Session အသစ် ဖန်တီးပြီးပါပြီ။'
    );
    onRefresh();
  };

  const handleToggleOpen = (session: AttendanceSession) => {
    const nextState = !session.isOpen;
    ClassroomDB.toggleAttendanceSessionOpen(session.id, nextState);
    showToast(
      nextState
        ? `"${session.title}" အား Open Attendance ဖွင့်ပေးလိုက်ပါပြီ။`
        : `"${session.title}" အား Attendance ပိတ်လိုက်ပါပြီ။`
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

  const handleStudentCheckIn = (sessionId: string) => {
    const res = ClassroomDB.studentCheckIn(sessionId, currentUser);
    if (!res.success && res.error) {
      showToast(res.error);
      return;
    }
    showToast('✅ Present (တက်ရောက်သည်) မှတ်တမ်းတင်ပြီးပါပြီ!');
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
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <CalendarCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
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
                  className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 ${
                    myCertEligible
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                      : 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300'
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
            <div className="mt-4">
              <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
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

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 text-xs">
                <div className="p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-900/50">
                  <span className="text-[11px] text-emerald-700 dark:text-emerald-300 block">
                    Present (တက်ရောက်)
                  </span>
                  <span className="text-base font-bold font-mono text-emerald-900 dark:text-emerald-100">
                    {myStats.presentCount}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/70 dark:border-amber-900/50">
                  <span className="text-[11px] text-amber-700 dark:text-amber-300 block">
                    Late (နောက်ကျ)
                  </span>
                  <span className="text-base font-bold font-mono text-amber-900 dark:text-amber-100">
                    {myStats.lateCount}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/70 dark:border-indigo-900/50">
                  <span className="text-[11px] text-indigo-700 dark:text-indigo-300 block">
                    Excused (ခွင့်တိုင်)
                  </span>
                  <span className="text-base font-bold font-mono text-indigo-900 dark:text-indigo-100">
                    {myStats.excusedCount}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200/70 dark:border-rose-900/50">
                  <span className="text-[11px] text-rose-700 dark:text-rose-300 block">
                    Absent (ပျက်ကွက်)
                  </span>
                  <span className="text-base font-bold font-mono text-rose-900 dark:text-rose-100">
                    {myStats.absentCount}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Open Daily Check-in Banner for Students */}
          {openSessions.length > 0 && (
            <div className="bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-transparent dark:from-emerald-950/60 dark:via-teal-950/30 rounded-2xl border-2 border-emerald-400/80 dark:border-emerald-700 p-4 sm:p-5 space-y-3 shadow-xs">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-xs sm:text-sm">
                <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Open Attendance — ယနေ့ အတန်းချိန် တက်ရောက်ကြောင်း နှိပ်ရန်</span>
              </div>

              <div className="space-y-2.5">
                {openSessions.map((sess) => {
                  const myRecord = sess.records[currentUser.id];
                  const isAlreadyPresent =
                    myRecord?.status === 'present' || myRecord?.status === 'late';

                  return (
                    <div
                      key={sess.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/70 shadow-2xs"
                    >
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
                          ဆရာ {sess.openedBy} မှ Attendance ဖွင့်ပေးထားပါသည်။
                        </p>
                      </div>

                      {isAlreadyPresent ? (
                        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 text-xs font-bold shrink-0">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <span>
                            တက်ရောက်ပြီး ({myRecord.checkedInAt || 'Recorded'})
                          </span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleStudentCheckIn(sess.id)}
                          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs sm:text-sm font-bold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
                        >
                          <Hand className="w-4 h-4" />
                          <span>Mark Present (တက်ရောက်သည်)</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Student Session-by-Session History */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
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
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {sessions.map((sess) => {
                  const myRec = sess.records[currentUser.id];
                  return (
                    <div
                      key={sess.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                            {sess.displayDate}
                          </span>
                          {sess.isOpen && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                              Open Now
                            </span>
                          )}
                        </div>
                        <div className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                          {sess.title}
                        </div>
                        {myRec?.checkedInAt && (
                          <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                            Checked in at {myRec.checkedInAt} (
                            {myRec.checkedInBy === 'student' ? 'Self Check-in' : 'Marked by Instructor'})
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        {sess.isOpen && !myRec && (
                          <button
                            type="button"
                            onClick={() => handleStudentCheckIn(sess.id)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5"
                          >
                            <Hand className="w-3.5 h-3.5" />
                            <span>Present (တက်ရောက်သည်)</span>
                          </button>
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
      {/* INSTRUCTOR VIEW (Admin & Co-Admin): Open Attendance & Roll Call       */}
      {/* ===================================================================== */}
      {isInstructor && (
        <div className="space-y-6">
          {/* 1. Open New Daily Attendance Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-xs">
                  <CalendarCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                    Open Daily Attendance (အတန်းချိန် တက်ရောက်မှု ဖွင့်လှစ်ရန်)
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    "Open Attendance" ဖွင့်ပေးထားပါက သင်တန်းသားများကိုယ်တိုင် "Present (တက်ရောက်သည်)" နှိပ်နိုင်သလို ဆရာကိုယ်တိုင်လည်း အမည်စာရင်းဖြင့် ခြစ်ပေးနိုင်ပါသည်။
                  </p>
                </div>
              </div>
            </div>

            <form
              onSubmit={handleCreateSession}
              className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800"
            >
              <div className="md:col-span-5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Session / Lecture Title (သင်ခန်းစာ / အတန်းချိန် အမည်)
                </label>
                <input
                  type="text"
                  placeholder="ဥပမာ - Lecture 04: Daily Class Check-in..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Date (နေ့စွဲ)
                </label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-mono focus:outline-hidden focus:border-indigo-500"
                  required
                />
              </div>

              <div className="md:col-span-4 flex items-center justify-between md:justify-end gap-2.5">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
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
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Open Attendance</span>
                </button>
              </div>
            </form>
          </div>

          {/* 2. Daily Roll Call & Self Check-in Control Panel */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Daily Roll Call Sheet (အမည်စာရင်းဖြင့် Attendance ခြစ်ရန်)</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  နေ့စွဲအလိုက် အတန်းချိန်ကို ရွေးချယ်ပြီး ကျောင်းသားတစ်ဦးချင်းစီအတွက် Present / Late / Excused / Absent သတ်မှတ်နိုင်ပါသည်။
                </p>
              </div>

              {/* Session Selector Dropdown */}
              {sessions.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={activeSession?.id || ''}
                    onChange={(e) => setSelectedSessionId(e.target.value)}
                    className="px-3 py-2 text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-indigo-500"
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
                        className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                          activeSession.isOpen
                            ? 'bg-emerald-50 dark:bg-emerald-950/70 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300'
                            : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-emerald-50'
                        }`}
                        title="Toggle student self check-in"
                      >
                        {activeSession.isOpen ? (
                          <>
                            <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Attendance Open (ပိတ်ရန်နှိပ်ပါ)</span>
                          </>
                        ) : (
                          <>
                            <Lock className="w-3.5 h-3.5 text-slate-500" />
                            <span>Closed (ပြန်ဖွင့်ရန်နှိပ်ပါ)</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleMarkAllPresent(activeSession.id)}
                        className="px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        <span>Mark All Present</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteSession(activeSession)}
                        className="p-2 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                        title="Delete this attendance session"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Active Session Roll Call Roster */}
            {!activeSession ? (
              <div className="p-8 text-center text-xs text-slate-500">
                Attendance session မရှိသေးပါ။ အပေါ်ရှိ "Open Attendance" ဖြင့် စတင်ဖွင့်လှစ်ပါ။
              </div>
            ) : enrolledStudents.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                ဤအတန်းတွင် ကျောင်းသား စာရင်းသွင်းထားခြင်း မရှိသေးပါ။
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {enrolledStudents.map((stu) => {
                  const rec = activeSession.records[stu.id];
                  const currentStatus: AttendanceStatus = rec?.status || 'absent';

                  return (
                    <div
                      key={stu.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={stu.avatar}
                          alt={stu.name}
                          referrerPolicy="no-referrer"
                          className="w-9 h-9 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                        />
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                              {stu.name}
                            </span>
                            <span className="text-[11px] font-mono text-slate-400">
                              @{stu.username}
                            </span>
                            {stu.rulesAccepted && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/90 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 text-[10px] font-bold">
                                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                <span>သိရှိ လိုက်နာပါမည်</span>
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {rec?.checkedInAt ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-mono">
                                ✓ Checked in at {rec.checkedInAt} (
                                {rec.checkedInBy === 'student'
                                  ? 'Student Self Check-in'
                                  : 'Instructor Marked'}
                                )
                              </span>
                            ) : (
                              <span>Not checked in yet</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* 4-State Roll Call Buttons */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            handleInstructorMark(activeSession.id, stu, 'present')
                          }
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                            currentStatus === 'present' && rec
                              ? 'bg-emerald-600 text-white shadow-2xs'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 hover:text-emerald-700'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Present</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleInstructorMark(activeSession.id, stu, 'late')
                          }
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                            currentStatus === 'late'
                              ? 'bg-amber-500 text-white shadow-2xs'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-amber-950/50 hover:text-amber-700'
                          }`}
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>Late</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleInstructorMark(activeSession.id, stu, 'excused')
                          }
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                            currentStatus === 'excused'
                              ? 'bg-indigo-600 text-white shadow-2xs'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:text-indigo-700'
                          }`}
                        >
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>Excused</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleInstructorMark(activeSession.id, stu, 'absent')
                          }
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                            !rec || currentStatus === 'absent'
                              ? 'bg-rose-600 text-white shadow-2xs'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:text-rose-700'
                          }`}
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Absent</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. Overall Student Attendance Percentage (%) & Certificate Assessment Matrix */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>
                    Attendance Percentage & Certificate Eligibility (ကျောင်းသားတစ်ဦးချင်း တက်ရောက်မှု ရာခိုင်နှုန်းနှင့် Certificate သုံးသပ်ချက်)
                  </span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  သင်တန်းသားတစ်ဦးချင်းစီ၏ စုစုပေါင်း တက်ရောက်မှု ရာခိုင်နှုန်း (%) ကို တွက်ချက်ပေးထားပြီး Certificate ပေးအပ်နိုင်မှုကို တိုက်ရိုက်စစ်ဆေးနိုင်ပါသည်။
                </p>
              </div>
              <div className="flex items-center gap-3 self-start sm:self-center shrink-0">
                <span className="text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                  Total Sessions: {sessions.length}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const res = ClassroomDB.downloadClassAttendanceCSV(course.id);
                    if (res.success) {
                      showToast(`📥 Attendance Report CSV (${res.filename}) ဒေါင်းလုဒ်ဆွဲပြီးပါပြီ!`);
                    }
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV Report</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-3 text-center">Present</th>
                    <th className="py-3 px-3 text-center">Late</th>
                    <th className="py-3 px-3 text-center">Excused</th>
                    <th className="py-3 px-3 text-center">Absent</th>
                    <th className="py-3 px-4">Attendance %</th>
                    <th className="py-3 px-4 text-right">Certificate Evaluation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {enrolledStudents.map((stu) => {
                    const st = ClassroomDB.getStudentAttendanceStats(course.id, stu.id);
                    const stuProg = ClassroomDB.getStudentProgress(stu.id, course.id);
                    const isEligible = st.percentage >= 75;

                    return (
                      <tr
                        key={stu.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <img
                              src={stu.avatar}
                              alt={stu.name}
                              referrerPolicy="no-referrer"
                              className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                            />
                            <div>
                              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                                <span>{stu.name}</span>
                                {stu.rulesAccepted && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/90 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 text-[10px] font-bold">
                                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                    <span>သိရှိ လိုက်နာပါမည်</span>
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono">
                                @{stu.username}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-3 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {st.presentCount}
                        </td>
                        <td className="py-3.5 px-3 text-center font-mono font-bold text-amber-600 dark:text-amber-400">
                          {st.lateCount}
                        </td>
                        <td className="py-3.5 px-3 text-center font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {st.excusedCount}
                        </td>
                        <td className="py-3.5 px-3 text-center font-mono font-bold text-rose-600 dark:text-rose-400">
                          {st.absentCount}
                        </td>
                        <td className="py-3.5 px-4 min-w-[160px]">
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
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                                isEligible
                                  ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                  : 'bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                              }`}
                            >
                              {isEligible ? '✓ Eligible (≥75%)' : 'Low Attendance (<75%)'}
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
                                <span>Issue Certificate</span>
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
          </div>
        </div>
      )}

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
