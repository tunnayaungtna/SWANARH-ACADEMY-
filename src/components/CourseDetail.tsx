import React, { useState, useEffect } from 'react';
import { Course, CoursePost, User, CertificateData } from '../types/classroom';
import { CourseStream } from './CourseStream';
import { PeopleView } from './PeopleView';
import { AttendanceView } from './AttendanceView';
import { PrivateNotesView } from './PrivateNotesView';
import { ClassroomDB } from '../services/storage';
import { useBackHandler } from '../utils/backNavigation';
import { ArrowLeft, MessageSquare, Users, CalendarCheck, Lock } from 'lucide-react';

export type ClassroomTab = 'stream' | 'attendance' | 'private_notes' | 'people';

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

  useEffect(() => {
    if (initialTab && initialTab !== activeTab) {
      setTabHistory((prev) => [...prev, initialTab]);
    }
  }, [initialTab, course.id]);

  // Live lightweight 0.3KB delta attendance & private notes sync while inside any classroom tab
  // Guarantees that when Admin/Co-Admin opens/closes Attendance or replies to a Private Note, all screens update within seconds!
  useEffect(() => {
    let mounted = true;
    const syncCourseLiveState = () => {
      if (document.visibilityState === 'visible' && navigator.onLine !== false) {
        ClassroomDB.syncAttendanceFromCloud().then((changed) => {
          if (mounted && changed) {
            onRefresh();
          }
        });
        ClassroomDB.syncPrivateNotesFromCloud().then((changed) => {
          if (mounted && changed) {
            onRefresh();
          }
        });
      }
    };
    syncCourseLiveState();
    const timer = setInterval(syncCourseLiveState, 8_000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [course.id]);

  const handleSwitchTab = (nextTab: ClassroomTab) => {
    if (nextTab === activeTab) return;
    setTabHistory((prev) => [...prev, nextTab]);
    if (typeof navigator === 'undefined' || navigator.onLine !== false) {
      if (nextTab === 'attendance') {
        ClassroomDB.syncAttendanceFromCloud(true).then((updated) => {
          if (updated) onRefresh();
        });
      } else if (nextTab === 'private_notes') {
        ClassroomDB.syncPrivateNotesFromCloud(true).then((updated) => {
          if (updated) onRefresh();
        });
      } else {
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
  const hasOpenAttendance = attendanceSessions.some((s) => s.isOpen);
  const unreadPrivateNotesCount = ClassroomDB.getUnreadPrivateNotesCount(course.id, currentUser);

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

        {/* Recessed Neumorphic 4-Tab Switcher (Stream · Attendance · Private Notes · People) */}
        <div className="neu-inset p-1.5 rounded-2xl grid grid-cols-2 sm:flex items-center gap-1 sm:gap-1.5 text-xs font-bold self-stretch lg:self-auto">
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
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <CalendarCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Attendance</span>
            {hasOpenAttendance && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" title="Attendance Check-in Open" />
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
            className={`flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
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

      {/* Tab Viewport */}
      <div>
        {activeTab === 'stream' && (
          <CourseStream
            course={course}
            currentUser={currentUser}
            posts={posts}
            onRefresh={onRefresh}
            onOpenAttendance={() => handleSwitchTab('attendance')}
          />
        )}

        {activeTab === 'attendance' && (
          <AttendanceView
            course={course}
            currentUser={currentUser}
            onRefresh={onRefresh}
            onOpenCertificate={onOpenCertificate}
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


