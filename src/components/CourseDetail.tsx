import React, { useState, useEffect } from 'react';
import { Course, CoursePost, User, CertificateData, AttendanceStatus } from '../types/classroom';
import { CourseStream } from './CourseStream';
import { PeopleView } from './PeopleView';
import { AttendanceView } from './AttendanceView';
import { PrivateNotesView } from './PrivateNotesView';
import { QuizzesView } from './QuizzesView';
import { ClassroomDB } from '../services/storage';
import { useBackHandler } from '../utils/backNavigation';
import {
  ArrowLeft,
  MessageSquare,
  Users,
  CalendarCheck,
  Lock,
  Hand,
  Clock,
  CheckCircle2,
  FileQuestion,
} from 'lucide-react';

export type ClassroomTab = 'stream' | 'attendance' | 'quizzes' | 'private_notes' | 'people';

interface CourseDetailProps {
  course: Course;
  currentUser: User;
  posts: CoursePost[];
  initialTab?: ClassroomTab;
  onBack: () => void;
  onRefresh: () => void;
  onOpenCertificate: (cert: CertificateData) => void;
}

export const CourseDetail: React.FC<CourseDetailProps> = ({
  course,
  currentUser,
  posts,
  initialTab = 'stream',
  onBack,
  onRefresh,
  onOpenCertificate,
}) => {
  const [tabHistory, setTabHistory] = useState<ClassroomTab[]>([initialTab]);
  const activeTab = tabHistory[tabHistory.length - 1] || 'stream';
  const [, setLiveTick] = useState(0);
  const [liveStatusToast, setLiveStatusToast] = useState<{
    type: 'opened' | 'closed' | 'checked_in';
    message: string;
  } | null>(null);

  useEffect(() => {
    if (initialTab && initialTab !== activeTab) {
      setTabHistory((prev) => [...prev, initialTab]);
    }
  }, [initialTab, course.id]);

  // Instant Realtime WebSocket + fast 5s delta attendance sync while inside classroom
  useEffect(() => {
    let mounted = true;
    let toastTimer: ReturnType<typeof setTimeout> | null = null;

    const showLiveNotice = (type: 'opened' | 'closed' | 'checked_in', message: string) => {
      if (!mounted) return;
      setLiveStatusToast({ type, message });
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        if (mounted) setLiveStatusToast(null);
      }, 4500);
    };

    const syncCourseLiveState = (forcePull: boolean = false) => {
      if (document.visibilityState === 'visible' && navigator.onLine !== false) {
        ClassroomDB.syncAttendanceFromCloud(forcePull).then((changed) => {
          if (mounted && changed) {
            setLiveTick((t) => t + 1);
            onRefresh();
          }
        });
      }
    };

    const handleRealtimeAttendanceUpdated = () => {
      if (!mounted) return;
      setLiveTick((t) => t + 1);
      onRefresh();
    };

    const handleRemoteAttendanceOpened = (ev: Event) => {
      if (!mounted) return;
      const detail = (ev as CustomEvent)?.detail as { courseId?: string } | undefined;
      if (detail?.courseId && detail.courseId !== course.id) return;
      setLiveTick((t) => t + 1);
      onRefresh();
      if (currentUser.role === 'student') {
        showLiveNotice(
          'opened',
          '🟢 ဆရာ (Admin / Co-Admin) မှ ယခုအတန်းအတွက် Attendance ဖွင့်ပေးလိုက်ပါပြီ! ယခု Present နှိပ်နိုင်ပါပြီ။'
        );
      }
    };

    const handleRemoteAttendanceClosed = (ev: Event) => {
      if (!mounted) return;
      const detail = (ev as CustomEvent)?.detail as { courseId?: string } | undefined;
      if (detail?.courseId && detail.courseId !== course.id) return;
      setLiveTick((t) => t + 1);
      onRefresh();
      if (currentUser.role === 'student') {
        showLiveNotice(
          'closed',
          '🔒 ဆရာ (Admin / Co-Admin) မှ ယခုအတန်း၏ Attendance ကို ပိတ်လိုက်ပါပြီ။'
        );
      }
    };

    syncCourseLiveState(true);
    ClassroomDB.syncPrivateNotesFromCloud(false).then((changed) => {
      if (mounted && changed) {
        setLiveTick((t) => t + 1);
        onRefresh();
      }
    });

    const attTimer = setInterval(() => syncCourseLiveState(false), 5_000);
    const notesTimer = setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine !== false) {
        ClassroomDB.syncPrivateNotesFromCloud(false).then((changed) => {
          if (mounted && changed) {
            setLiveTick((t) => t + 1);
            onRefresh();
          }
        });
      }
    }, 30_000);

    window.addEventListener('attendance-realtime-updated', handleRealtimeAttendanceUpdated);
    window.addEventListener('attendance-opened-remotely', handleRemoteAttendanceOpened);
    window.addEventListener('attendance-closed-remotely', handleRemoteAttendanceClosed);

    return () => {
      mounted = false;
      if (toastTimer) clearTimeout(toastTimer);
      clearInterval(attTimer);
      clearInterval(notesTimer);
      window.removeEventListener('attendance-realtime-updated', handleRealtimeAttendanceUpdated);
      window.removeEventListener('attendance-opened-remotely', handleRemoteAttendanceOpened);
      window.removeEventListener('attendance-closed-remotely', handleRemoteAttendanceClosed);
    };
  }, [course.id, currentUser.role]);

  const handleSwitchTab = (nextTab: ClassroomTab) => {
    if (nextTab === activeTab) return;
    setTabHistory((prev) => [...prev, nextTab]);
    if (typeof navigator === 'undefined' || navigator.onLine !== false) {
      if (nextTab === 'attendance') {
        ClassroomDB.syncApprovedLeavesIntoLocalAttendance();
        ClassroomDB.syncAttendanceFromCloud(true).then((updated) => {
          if (updated) onRefresh();
        });
      } else if (nextTab === 'private_notes') {
        ClassroomDB.syncPrivateNotesFromCloud(true).then((updated) => {
          if (updated) onRefresh();
        });
      } else if (nextTab === 'quizzes') {
        ClassroomDB.syncQuizzesFromCloud(true).then((updated) => {
          if (updated) onRefresh();
        });
      } else {
        ClassroomDB.syncAttendanceFromCloud(true).then((attUpdated) => {
          if (attUpdated) onRefresh();
        });
        ClassroomDB.pullFromSupabase({ background: true }).then((updated) => {
          if (updated) onRefresh();
        });
      }
    }
  };

  // Step back through visited tabs when mobile Back button is pressed
  useBackHandler(tabHistory.length > 1, () => {
    setTabHistory((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  });

  const attendanceSessions = ClassroomDB.getAttendanceSessions(course.id);
  const openAttendanceSessions = attendanceSessions.filter((s) => Boolean(s.isOpen));
  const hasOpenAttendance = openAttendanceSessions.length > 0;
  const unreadPrivateNotesCount = ClassroomDB.getUnreadPrivateNotesCount(course.id, currentUser);
  const courseQuizzesCount = ClassroomDB.getQuizzes(course.id).length;

  const handleQuickStudentCheckIn = (sessionId: string, status: AttendanceStatus) => {
    const res = ClassroomDB.studentCheckIn(sessionId, currentUser, status);
    if (!res.success && res.error) {
      setLiveStatusToast({ type: 'closed', message: res.error });
      setTimeout(() => setLiveStatusToast(null), 4000);
      setLiveTick((t) => t + 1);
      onRefresh();
      return;
    }
    setLiveStatusToast({
      type: 'checked_in',
      message:
        status === 'late'
          ? '⏰ Late (နောက်ကျတက်ရောက်) အဖြစ် မှတ်တမ်းတင်ပြီးပါပြီ!'
          : '✅ Present (တက်ရောက်သည်) အဖြစ် မှတ်တမ်းတင်ပြီးပါပြီ!',
    });
    setTimeout(() => setLiveStatusToast(null), 3500);
    setLiveTick((t) => t + 1);
    onRefresh();
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Top Sculpted Neumorphic Course Header & Tab Switcher */}
      <div className="neu-raised rounded-3xl p-3.5 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="neu-btn p-2.5 rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer shrink-0"
            aria-label="Back to classes"
            title="Back to My Classes"
          >
            <ArrowLeft className="w-4.5 h-4.5" />
          </button>

          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100 truncate">
              {course.title}
            </h2>
            <div className="flex items-center gap-2 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
              <span className="font-bold text-indigo-600 dark:text-indigo-400">{course.code}</span>
              <span aria-hidden="true">·</span>
              <span>{course.batch}</span>
            </div>
          </div>
        </div>

        {/* Recessed Neumorphic 5-Tab Switcher (Stream · Attendance · Quiz & စာမေးပွဲ · Private Notes · People) */}
        <div className="neu-inset p-1.5 rounded-2xl grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1 sm:gap-1.5 text-xs font-bold self-stretch lg:self-auto">
          <button
            onClick={() => handleSwitchTab('stream')}
            className={`flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'stream'
                ? 'neu-raised-sm text-indigo-700 dark:text-indigo-300'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>Stream</span>
          </button>

          <button
            onClick={() => handleSwitchTab('attendance')}
            className={`flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'attendance'
                ? 'neu-raised-sm text-emerald-700 dark:text-emerald-300'
                : hasOpenAttendance
                ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 ring-1 ring-emerald-500/40'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <CalendarCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Attendance</span>
            {hasOpenAttendance && (
              <span
                className="px-1.5 py-0.5 rounded-full bg-emerald-600 text-white text-[9px] font-extrabold uppercase tracking-wider animate-pulse shrink-0"
                title="Attendance Check-in Open"
              >
                LIVE
              </span>
            )}
          </button>

          <button
            onClick={() => handleSwitchTab('quizzes')}
            className={`flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'quizzes'
                ? 'neu-raised-sm text-indigo-700 dark:text-indigo-300'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
            title="Auto-Graded Mini Quiz, စာမေးပွဲ နှင့် Flashcards"
          >
            <FileQuestion className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>Quiz & စာမေးပွဲ</span>
            {courseQuizzesCount > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-indigo-600 text-white text-[10px] font-extrabold flex items-center justify-center shrink-0">
                {courseQuizzesCount}
              </span>
            )}
          </button>

          <button
            onClick={() => handleSwitchTab('private_notes')}
            className={`flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'private_notes'
                ? 'neu-raised-sm text-amber-800 dark:text-amber-300'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
            title={
              currentUser.role === 'student'
                ? 'ဆရာသို့ သီးသန့်မေးရန် / ခွင့်တိုင်ရန် (Private Note & Leave Request)'
                : 'ကျောင်းသား သီးသန့်စာများနှင့် ခွင့်တိုင်ကြားစာများ (Private Student Notes)'
            }
          >
            <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>သီးသန့်စာ</span>
            {unreadPrivateNotesCount > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-extrabold flex items-center justify-center animate-pulse shrink-0">
                {unreadPrivateNotesCount}
              </span>
            )}
          </button>

          <button
            onClick={() => handleSwitchTab('people')}
            className={`flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap col-span-2 sm:col-span-1 ${
              activeTab === 'people'
                ? 'neu-raised-sm text-indigo-700 dark:text-indigo-300'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>People</span>
          </button>
        </div>
      </div>

      {/* Live Attendance Open/Close Transition Notification Banner */}
      {liveStatusToast && (
        <div
          className={`p-3.5 rounded-2xl border text-xs sm:text-sm font-bold flex items-center justify-between gap-3 shadow-sm transition-all ${
            liveStatusToast.type === 'closed'
              ? 'bg-rose-50 dark:bg-rose-950/70 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200'
              : 'bg-emerald-50 dark:bg-emerald-950/70 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
          }`}
        >
          <span>{liveStatusToast.message}</span>
          <button
            type="button"
            onClick={() => setLiveStatusToast(null)}
            className="text-xs underline opacity-80 hover:opacity-100 cursor-pointer shrink-0"
          >
            ပိတ်မည်
          </button>
        </div>
      )}

      {/* Instant Live Open Attendance Banner when Student is viewing Private Notes or People tab */}
      {currentUser.role === 'student' &&
        hasOpenAttendance &&
        activeTab !== 'stream' &&
        activeTab !== 'attendance' && (
          <div className="neu-card rounded-3xl p-4 sm:p-5 space-y-3 ring-2 ring-emerald-400/60">
            {openAttendanceSessions.map((sess) => {
              const myRec = ClassroomDB.getStudentAttendanceRecord(sess, currentUser);
              return (
                <div
                  key={sess.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold text-xs sm:text-sm flex-wrap">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                      <span>
                        🟢 Open Attendance ဖွင့်ထားပါသည် ({sess.displayDate} — {sess.title})
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      ဆရာ {sess.openedBy} မှ Attendance ဖွင့်ပေးထားပါသည်။ ယခုချက်ချင်း Present နှိပ်နိုင်ပါသည်။
                    </p>
                  </div>

                  {myRec ? (
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>
                          {myRec.status === 'present'
                            ? 'Present (တက်ရောက်)'
                            : myRec.status === 'late'
                            ? 'Late (နောက်ကျ)'
                            : myRec.status === 'excused'
                            ? 'Excused (ခွင့်ပြုပြီး)'
                            : 'Absent'}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleSwitchTab('attendance')}
                        className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-700 text-indigo-600 dark:text-indigo-300 text-xs font-bold cursor-pointer"
                      >
                        Attendance သို့သွားရန် →
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleQuickStudentCheckIn(sess.id, 'present')}
                        className="px-4 py-2 rounded-xl neu-btn-emerald text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Hand className="w-3.5 h-3.5" />
                        <span>Mark Present (တက်ရောက်သည်)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickStudentCheckIn(sess.id, 'late')}
                        className="px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>Late</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

      {/* Tab Viewport */}
      <div>
        {activeTab === 'stream' && (
          <CourseStream
            course={course}
            currentUser={currentUser}
            posts={posts}
            onRefresh={onRefresh}
            onOpenAttendance={() => handleSwitchTab('attendance')}
            onOpenPrivateNotes={() => handleSwitchTab('private_notes')}
          />
        )}

        {activeTab === 'attendance' && (
          <AttendanceView
            course={course}
            currentUser={currentUser}
            onRefresh={onRefresh}
            onOpenCertificate={onOpenCertificate}
            onOpenPrivateNotes={() => handleSwitchTab('private_notes')}
          />
        )}

        {activeTab === 'quizzes' && (
          <QuizzesView
            course={course}
            currentUser={currentUser}
            onRefresh={onRefresh}
          />
        )}

        {activeTab === 'private_notes' && (
          <PrivateNotesView
            course={course}
            currentUser={currentUser}
            onRefresh={onRefresh}
          />
        )}

        {activeTab === 'people' && (
          <PeopleView course={course} currentUser={currentUser} onRefresh={onRefresh} />
        )}
      </div>
    </div>
  );
};


