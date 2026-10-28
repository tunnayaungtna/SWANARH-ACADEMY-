import React, { useState } from 'react';
import { Course, User, StudentProgress } from '../types/classroom';
import { ClassroomDB } from '../services/storage';
import { ArrowRight, Trash2, AlertTriangle } from 'lucide-react';

interface CourseCardProps {
  course: Course;
  currentUser: User;
  progress?: StudentProgress;
  onSelectCourse: (course: Course) => void;
  onRefresh?: () => void;
}

export const CourseCard: React.FC<CourseCardProps> = ({
  course,
  currentUser,
  progress,
  onSelectCourse,
  onRefresh,
}) => {
  const isInstructor = currentUser.role === 'admin' || currentUser.role === 'co_admin';
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Compute progress if student
  const totalItems = (course.totalLessons || 1) + course.totalAssignments + course.totalQuizzes;
  const completedCount =
    (progress?.completedLessonIds.length || 0) +
    (progress?.completedAssignmentIds.length || 0) +
    (progress?.passedQuizIds.length || 0);
  const progressPct = Math.min(100, Math.round((completedCount / totalItems) * 100));

  const handleConfirmDeleteCourse = (e: React.MouseEvent) => {
    e.stopPropagation();
    ClassroomDB.deleteCourse(course.id, currentUser);
    setShowDeleteConfirm(false);
    if (onRefresh) {
      onRefresh();
    }
  };

  return (
    <>
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
            {isInstructor && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeleteConfirm(true);
                }}
                className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-slate-900/75 hover:bg-rose-600 text-white backdrop-blur-xs transition-colors cursor-pointer shadow-sm"
                title="Delete Classroom (အတန်းဖျက်မည်)"
                aria-label="Delete Classroom"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Card Body */}
          <div className="p-4 sm:p-5 space-y-2.5">
            {/* Course Code & Batch */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-[11px] font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                <span>{course.code}</span>
                <span className="opacity-60">·</span>
                <span className="text-slate-600 dark:text-slate-300">{course.batch}</span>
              </div>
              {isInstructor && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeleteConfirm(true);
                  }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                  title="Delete Classroom & SQL Data"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Delete</span>
                </button>
              )}
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
            {isInstructor
              ? `${course.enrolledStudentIds.length} Enrolled Students`
              : 'Access Granted'}
          </span>

          <span className="flex items-center gap-1 font-semibold text-indigo-600 dark:text-indigo-400 group-hover:translate-x-0.5 transition-transform">
            <span>Enter Classroom</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>

      {/* Delete Classroom Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            setShowDeleteConfirm(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Delete Classroom (အတန်းကို ဖျက်သိမ်းရန် အတည်ပြုပါ)
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                  <strong>{course.code} — {course.title}</strong> ({course.batch}) အတန်းကို အမှန်တကယ် ဖျက်သိမ်းလိုပါသလား?
                </p>
              </div>
            </div>

            <div className="p-3 bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-xl text-[11px] text-rose-800 dark:text-rose-300 space-y-1">
              <strong>သတိပြုရန် (Auto SQL Delete):</strong>
              <div>
                • ဤအတန်းနှင့် သက်ဆိုင်သော သင်ခန်းစာ Posts များ၊ Assignments၊ Quizzes နှင့် Attendance မှတ်တမ်းအားလုံးကို App နှင့် Supabase SQL Database ထဲမှ တစ်ပါတည်း အပြီးတိုင် ဖျက်သိမ်းသွားပါမည်။
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeleteConfirm(false);
                }}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 cursor-pointer"
              >
                မဖျက်တော့ပါ (Cancel)
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteCourse}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Classroom & SQL Data</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};


