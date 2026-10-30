import React, { useState } from 'react';
import { Course, CoursePost, User, CertificateData } from '../types/classroom';
import { CourseStream } from './CourseStream';
import { PeopleView } from './PeopleView';
import { AttendanceView } from './AttendanceView';
import { ClassroomDB } from '../services/storage';
import { useBackHandler } from '../utils/backNavigation';
import { ArrowLeft, MessageSquare, Users, CalendarCheck } from 'lucide-react';

interface CourseDetailProps {
  course: Course;
  currentUser: User;
  posts: CoursePost[];
  onBack: () => void;
  onRefresh: () => void;
  onOpenCertificate: (cert: CertificateData) => void;
  textProtectionEnabled: boolean;
}

type ClassroomTab = 'stream' | 'attendance' | 'people';

export const CourseDetail: React.FC<CourseDetailProps> = ({
  course,
  currentUser,
  posts,
  onBack,
  onRefresh,
  onOpenCertificate,
  textProtectionEnabled,
}) => {
  const [tabHistory, setTabHistory] = useState<ClassroomTab[]>(['stream']);
  const activeTab = tabHistory[tabHistory.length - 1] || 'stream';

  const handleSwitchTab = (nextTab: ClassroomTab) => {
    if (nextTab === activeTab) return;
    setTabHistory((prev) => [...prev, nextTab]);
  };

  // Step back through visited tabs when mobile Back button is pressed
  useBackHandler(tabHistory.length > 1, () => {
    setTabHistory((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  });

  const attendanceSessions = ClassroomDB.getAttendanceSessions(course.id);
  const hasOpenAttendance = attendanceSessions.some((s) => s.isOpen);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Top Header / Breadcrumb Bar - Responsive Mobile & Desktop */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <button
            onClick={onBack}
            className="p-1.5 sm:p-2 -ml-1 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            aria-label="Back to classes"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
              {course.title}
            </h2>
            <div className="flex items-center gap-2 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
              <span>{course.code}</span>
              <span>·</span>
              <span>{course.batch}</span>
            </div>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-medium self-stretch sm:self-auto justify-center overflow-x-auto">
          <button
            onClick={() => handleSwitchTab('stream')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'stream'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Stream</span>
          </button>

          <button
            onClick={() => handleSwitchTab('attendance')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'attendance'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <CalendarCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Attendance</span>
            {hasOpenAttendance && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Attendance Check-in Open" />
            )}
          </button>

          <button
            onClick={() => handleSwitchTab('people')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'people'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
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
            textProtectionEnabled={textProtectionEnabled}
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

        {activeTab === 'people' && (
          <PeopleView course={course} currentUser={currentUser} onRefresh={onRefresh} />
        )}
      </div>
    </div>
  );
};


