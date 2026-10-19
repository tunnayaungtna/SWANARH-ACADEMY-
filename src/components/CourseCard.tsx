import React from 'react';
import { Course, User, StudentProgress } from '../types/classroom';
import { ArrowRight } from 'lucide-react';

interface CourseCardProps {
  course: Course;
  currentUser: User;
  progress?: StudentProgress;
  onSelectCourse: (course: Course) => void;
}

export const CourseCard: React.FC<CourseCardProps> = ({
  course,
  currentUser,
  progress,
  onSelectCourse,
}) => {
  // Compute progress if student
  const totalItems = (course.totalLessons || 1) + course.totalAssignments + course.totalQuizzes;
  const completedCount =
    (progress?.completedLessonIds.length || 0) +
    (progress?.completedAssignmentIds.length || 0) +
    (progress?.passedQuizIds.length || 0);
  const progressPct = Math.min(100, Math.round((completedCount / totalItems) * 100));

  return (
    <div
      onClick={() => onSelectCourse(course)}
      className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between cursor-pointer"
    >
      <div>
        {/* Full 4:1 Google Classroom Header Photo Section — Bright, Unobstructed & Responsive */}
        <div className="relative w-full aspect-[4/1] bg-slate-900 overflow-hidden border-b border-slate-100 dark:border-slate-800">
          <img
            src={course.bannerImage}
            alt={course.title}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover object-center group-hover:scale-103 transition-transform duration-500"
          />
        </div>

        {/* Card Body */}
        <div className="p-4 sm:p-5 space-y-2.5">
          {/* Course Code & Batch */}
          <div className="flex items-center gap-1.5 text-[11px] font-mono font-semibold text-indigo-600 dark:text-indigo-400">
            <span>{course.code}</span>
            <span className="opacity-60">·</span>
            <span className="text-slate-600 dark:text-slate-300">{course.batch}</span>
          </div>

          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-snug line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
              {course.title}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{course.section}</p>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
            {course.description}
          </p>

          {/* Metadata Line */}
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 pt-1">
            <span>{course.instructorName}</span>
            <span aria-hidden="true">·</span>
            <span>{course.totalLessons} Lessons</span>
            <span aria-hidden="true">·</span>
            <span>{course.totalAssignments} Tasks</span>
          </div>

          {/* Progress Bar for enrolled students */}
          {currentUser.role === 'student' && (
            <div className="pt-2">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400 mb-1">
                <span>Course Progress</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">{progressPct}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-600 dark:bg-indigo-500 rounded-full transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Card Footer */}
      <div className="px-4 sm:px-5 py-3 bg-slate-50/80 dark:bg-slate-850 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
        <span className="text-slate-500 dark:text-slate-400 font-mono">
          {currentUser.role === 'admin' || currentUser.role === 'co_admin'
            ? `${course.enrolledStudentIds.length} Enrolled Students`
            : 'Access Granted'}
        </span>

        <span className="flex items-center gap-1 font-semibold text-indigo-600 dark:text-indigo-400 group-hover:translate-x-0.5 transition-transform">
          <span>Enter Classroom</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </div>
  );
};
