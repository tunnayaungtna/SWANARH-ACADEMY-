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
    <div className="space-y-5 sm:space-y-6">
      {/* Top Sculpted Neumorphic Course Header & Tab Switcher */}
      <div className="neu-raised rounded-3xl p-3.5 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
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

        {/* Recessed Neumorphic 3-Tab Switcher (Stream · Attendance · People) */}
        <div className="neu-inset p-1.5 rounded-2xl flex items-center gap-1.5 text-xs font-bold self-stretch sm:self-auto justify-center overflow-x-auto">
          <button
            onClick={() => handleSwitchTab('stream')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'stream'
                ? 'neu-raised-sm text-indigo-700 dark:text-indigo-300'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Stream</span>
          </button>

          <button
            onClick={() => handleSwitchTab('attendance')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'attendance'
                ? 'neu-raised-sm text-emerald-700 dark:text-emerald-300'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
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
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'people'
                ? 'neu-raised-sm text-indigo-700 dark:text-indigo-300'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
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


