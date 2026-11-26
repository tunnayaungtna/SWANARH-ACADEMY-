import React, { useState, useEffect } from 'react';
import { Course, User, CertificateData } from '../types/classroom';
import { ClassroomDB } from '../services/storage';
import { AddStudentModal } from './AddStudentModal';
import { EditUserAccountModal } from './EditUserAccountModal';
import {
  StudentReportCardModal,
  computeStudentCoursePerformance,
  exportClassPerformanceCsv,
} from './StudentReportCardModal';
import { useBackHandler } from '../utils/backNavigation';
import { resolveAvatarUrl, DEFAULT_AVATAR_SVG } from '../data/presetAvatars';
import {
  Users,
  UserPlus,
  Shield,
  Check,
  UserX,
  Mail,
  Search,
  AlertTriangle,
  Edit3,
  BarChart3,
  Download,
} from 'lucide-react';

interface PeopleViewProps {
  course: Course;
  currentUser: User;
  onRefresh: () => void;
  onOpenCertificate?: (cert: CertificateData) => void;
}

export const PeopleView: React.FC<PeopleViewProps> = ({
  course,
  currentUser,
  onRefresh,
  onOpenCertificate,
}) => {
  const allUsers = ClassroomDB.getAllUsers();
  const [showAddModal, setShowAddModal] = useState(false);
  const [studentToUnenroll, setStudentToUnenroll] = useState<User | null>(null);
  const [editingAccountUser, setEditingAccountUser] = useState<User | null>(null);
  const [inspectReportStudent, setInspectReportStudent] = useState<User | null>(null);
  const [enrollmentStatusMessage, setEnrollmentStatusMessage] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [visibleStudentLimit, setVisibleStudentLimit] = useState<number>(60);

  useEffect(() => {
    let mounted = true;
    if (currentUser.role === 'student') {
      return () => {
        mounted = false;
      };
    }
    const knownIds = new Set(ClassroomDB.getAllUsers().map((u) => u.id));
    const hasMissingEnrolledStudent = course.enrolledStudentIds.some((id) => !knownIds.has(id));
    if (
      hasMissingEnrolledStudent &&
      (typeof navigator === 'undefined' || navigator.onLine !== false)
    ) {
      ClassroomDB.pullFromSupabase({ onlyProfiles: true }).then((updated) => {
        if (mounted && updated) {
          onRefresh();
        }
      });
    }
    return () => {
      mounted = false;
    };
  }, [course.id, course.enrolledStudentIds.length, currentUser.role]);

  // Step-by-step mobile Back button handlers for PeopleView modals
  useBackHandler(showAddModal, () => setShowAddModal(false));
  useBackHandler(!!studentToUnenroll, () => setStudentToUnenroll(null));
  useBackHandler(!!editingAccountUser, () => setEditingAccountUser(null));
  useBackHandler(!!inspectReportStudent, () => setInspectReportStudent(null));

  // Fast O(1) lookup Map so 2,000 enrolled students resolve in <1ms instead of O(N^2)
  const isStaff = currentUser.role === 'admin' || currentUser.role === 'co_admin';
  const userByIdMap = new Map<string, User>(allUsers.map((u) => [u.id, u]));
  const cleanSearch = searchFilter.toLowerCase().trim();

  // Get enrolled students objects (Students can only search classmates by Name, never by other students' Usernames/Emails)
  const enrolledStudents = course.enrolledStudentIds
    .map((id) => userByIdMap.get(id))
    .filter((u): u is User => !!u)
    .filter(
      (u) =>
        !cleanSearch ||
        u.name.toLowerCase().includes(cleanSearch) ||
        ((isStaff || u.id === currentUser.id) &&
          (u.username.toLowerCase().includes(cleanSearch) ||
            u.email.toLowerCase().includes(cleanSearch)))
    );

  const handleConfirmUnenroll = () => {
    if (!studentToUnenroll) return;
    ClassroomDB.unenrollStudent(course.id, studentToUnenroll.id);
    setEnrollmentStatusMessage(
      `ကျောင်းသား "${studentToUnenroll.name}" ကို ${course.code} အတန်းမှ ထုတ်ပယ်ပြီးပါပြီ။ Row-Level Security (RLS) အရ ၎င်းကျောင်းသား၏ Dashboard တွင် ဤ Course သည် လုံးဝ ပုန်းကွယ်သွားပါမည်။`
    );
    setStudentToUnenroll(null);
    onRefresh();
    setTimeout(() => setEnrollmentStatusMessage(null), 5000);
  };

  return (
    <div className="space-y-6 sm:space-y-8 max-w-4xl mx-auto">
      {/* Toast Notification */}
      {enrollmentStatusMessage && (
        <div className="flex items-start gap-2.5 p-3.5 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 text-indigo-900 dark:text-indigo-200 text-xs rounded-xl shadow-xs">
          <Shield className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
          <div className="leading-snug">{enrollmentStatusMessage}</div>
        </div>
      )}

      {/* Student Personal Progress & Report Card Summary Banner */}
      {!isStaff && (() => {
        const myPerf = computeStudentCoursePerformance(course, currentUser);
        return (
          <section className="neu-card rounded-3xl p-4 sm:p-5 border border-indigo-200/80 dark:border-indigo-800/70 bg-gradient-to-br from-indigo-50/60 via-white/80 to-sky-50/50 dark:from-indigo-950/40 dark:via-slate-900/90 dark:to-sky-950/30">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-indigo-600 text-white shadow-2xs">
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span>STUDENT REPORT CARD</span>
                  </span>
                  <span className="text-xs font-extrabold text-indigo-700 dark:text-indigo-300">
                    Grade: {myPerf.gradeLabel}
                  </span>
                </div>
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-slate-100">
                  📊 မိမိ၏ သင်ယူတိုးတက်မှု မှတ်တမ်းချုပ် ({currentUser.name})
                </h2>
                <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] font-bold">
                  <span className="px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    📅 Attendance: {myPerf.attendanceRate}% ({myPerf.presentCount + myPerf.lateCount + myPerf.excusedCount}/{myPerf.totalSessions})
                  </span>
                  <span className="px-2.5 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    📝 Exam Room: {myPerf.totalExams > 0 ? `${myPerf.passedExams}/${myPerf.totalExams} အောင်မြင် (${myPerf.examAverageScore}%)` : 'စာမေးပွဲ မရှိသေးပါ'}
                  </span>
                  <span className="px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                    📋 Data Forms: {myPerf.completedForms}/{myPerf.totalForms} ခု ဖြည့်သွင်းပြီး
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setInspectReportStudent(currentUser)}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl neu-btn-indigo text-white text-xs font-extrabold shadow-sm cursor-pointer shrink-0"
              >
                <BarChart3 className="w-4 h-4" />
                <span>📊 မိမိ Report Card နှင့် PDF ထုတ်ယူရန်</span>
              </button>
            </div>
          </section>
        );
      })()}

      {/* Instructors & Faculty Section */}
      <section className="neu-card rounded-3xl p-5 sm:p-6 transition-colors">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200/50 dark:border-slate-800">
          <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100">
            Instructors & Faculty
          </h2>
          <span className="text-xs text-indigo-600 dark:text-indigo-400 font-mono font-bold neu-inset-sm px-2.5 py-1 rounded-lg">
            Academic Staff
          </span>
        </div>

        <div className="mt-4 space-y-3">
          {allUsers
            .filter((u) => u.role === 'admin' || u.role === 'co_admin')
            .map((instructor) => {
              const canEditInstructor =
                (currentUser.role === 'admin' || currentUser.role === 'co_admin') &&
                (currentUser.role === 'admin' || instructor.id === currentUser.id);
              return (
                <div
                  key={instructor.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3.5 rounded-2xl neu-inset-sm"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {instructor.role === 'admin' ? (
                      <img
                        src={resolveAvatarUrl(instructor.avatar)}
                        alt={instructor.name}
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = DEFAULT_AVATAR_SVG;
                        }}
                        className="w-11 h-11 rounded-full object-contain bg-white p-0.5 border border-indigo-200 dark:border-indigo-700 shrink-0 shadow-2xs"
                      />
                    ) : (
                      /* Clean Non-Photo Co-Admin Badge (Profile Photo Function Removed for Co-Admin) */
                      <div className="w-11 h-11 rounded-2xl bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 font-extrabold text-sm flex items-center justify-center shrink-0 border border-purple-200 dark:border-purple-800">
                        👥
                      </div>
                    )}
                    <div>
                      <div className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 flex-wrap">
                        <span>{instructor.name}</span>
                        <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md">
                          {instructor.role === 'admin' ? 'Lead Mentor (Admin)' : 'Co-Admin'}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                        {isStaff ? `@${instructor.username} · ${instructor.email}` : instructor.email}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    {canEditInstructor && (
                      <button
                        type="button"
                        onClick={() => setEditingAccountUser(instructor)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 hover:bg-indigo-100 dark:hover:bg-indigo-900/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-bold transition-all cursor-pointer"
                        title="အကောင့်အချက်အလက် ပြင်ဆင်ရန်"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>{instructor.id === currentUser.id ? 'မိမိအကောင့်ပြင်ရန်' : 'Edit'}</span>
                      </button>
                    )}

                    <a
                      href={`mailto:${instructor.email}`}
                      className="flex items-center gap-1.5 px-3.5 py-2 neu-btn text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl transition-all"
                    >
                      <Mail className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Email</span>
                    </a>
                  </div>
                </div>
              );
            })}
        </div>
      </section>

      {/* Enrolled Students & Classmates Section */}
      <section className="neu-card rounded-3xl p-4 sm:p-6 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/50 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100">
                {currentUser.role === 'admin' || currentUser.role === 'co_admin'
                  ? 'Enrolled Students (အတန်းတွင်း ကျောင်းသားများ)'
                  : 'Classmates & Enrolled Students (အတန်းဖော် ကျောင်းသားများ)'}
              </h2>
              <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 neu-inset-sm px-2.5 py-0.5 rounded-full">
                {course.enrolledStudentIds.length} ဦး
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {currentUser.role === 'admin' || currentUser.role === 'co_admin'
                ? 'Instructor / Admin ကွပ်ကဲရေး: ဤအတန်းတွင် စာရင်းဝင်ထားသော ကျောင်းသားများအားလုံးကို ကြည့်ရှုခြင်း၊ ထပ်ထည့်ခြင်းနှင့် ထုတ်ပယ်ခြင်း ပြုလုပ်နိုင်ပါသည်။'
                : 'ဤအတန်းတွင် အတူတကွ တက်ရောက်သင်ယူနေကြသော အတန်းဖော် ကျောင်းသား/သူများ စာရင်း'}
            </p>
          </div>

          {/* Admin / Co-Admin Add Student & Export Class Report Card Buttons */}
          {(currentUser.role === 'admin' || currentUser.role === 'co_admin') && (
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {enrolledStudents.length > 0 && (
                <button
                  type="button"
                  onClick={() => exportClassPerformanceCsv(course, enrolledStudents)}
                  className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-xs transition-all cursor-pointer"
                  title="အတန်းတွင်း ကျောင်းသားအားလုံး၏ Attendance, Exam အမှတ်များ၊ Form နှင့် စာအုပ်ပို့ဆောင်မှု စာရင်းချုပ်ကို Excel (CSV) ဖြင့် ထုတ်ယူမည်"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>📊 တစ်တန်းလုံး Report Card (Excel/CSV)</span>
                </button>
              )}
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 neu-btn-indigo text-xs font-bold rounded-xl transition-all cursor-pointer shrink-0"
              >
                <UserPlus className="w-4 h-4" />
                <span>+ Add Student (ကျောင်းသား ထည့်မည်)</span>
              </button>
            </div>
          )}
        </div>

        {/* Search Filter Bar (Accessible to both Admin & Students) */}
        {course.enrolledStudentIds.length > 0 && (
          <div className="my-4 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => {
                setSearchFilter(e.target.value);
                setVisibleStudentLimit(60);
              }}
              placeholder={
                isStaff
                  ? 'အတန်းတွင်း ကျောင်းသားအမည် သို့မဟုတ် Username ဖြင့် ရှာဖွေပါ...'
                  : 'အတန်းတွင်း ကျောင်းသား/သူ အမည်ဖြင့် ရှာဖွေပါ...'
              }
              className="w-full pl-10 pr-4 py-2.5 text-xs neu-input rounded-2xl text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all"
            />
          </div>
        )}

        {/* Enrolled Students / Classmates List */}
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {enrolledStudents.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400 space-y-2">
              <Users className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
              <p className="font-medium text-slate-700 dark:text-slate-300">ဤအတန်းတွင် ကျောင်းသား မရှိသေးပါ</p>
              {(currentUser.role === 'admin' || currentUser.role === 'co_admin') && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold cursor-pointer"
                >
                  + ပထမဆုံး ကျောင်းသား စာရင်းထည့်သွင်းပါ
                </button>
              )}
            </div>
          ) : (
            enrolledStudents.slice(0, visibleStudentLimit).map((student, idx) => {
              const isSelf = student.id === currentUser.id;
              const isStaff = currentUser.role === 'admin' || currentUser.role === 'co_admin';
              const attPct = isStaff
                ? ClassroomDB.calculateTotalAttendancePercentage(course.id, student.id)
                : null;

              return (
                <div
                  key={student.id}
                  className={`py-3 sm:py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs p-2.5 sm:px-3.5 rounded-2xl transition-colors min-w-0 ${
                    isSelf
                      ? 'bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40'
                      : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[11px] font-extrabold flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700">
                      #{idx + 1}
                    </div>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 flex-wrap">
                        <span className="truncate">{student.name}</span>
                        {student.rulesAccepted ? (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/90 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 shrink-0"
                            title={
                              student.rulesAcceptedAt
                                ? `သင်တန်းစည်းကမ်းချက် သိရှိလိုက်နာပါမည် အတည်ပြုပြီး (${student.rulesAcceptedAt})`
                                : 'သင်တန်းစည်းကမ်းချက် သိရှိလိုက်နာပါမည် အတည်ပြုပြီး'
                            }
                          >
                            <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400 stroke-[3]" />
                            <span>သိရှိ လိုက်နာပါမည်</span>
                          </span>
                        ) : (
                          isStaff && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shrink-0">
                              <span>⏳ စည်းကမ်းချက် လက်ခံရန်ကျန်</span>
                            </span>
                          )
                        )}
                        {student.gender && (
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                              student.gender.toLowerCase() === 'female'
                                ? 'bg-pink-50 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300'
                                : 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300'
                            }`}
                          >
                            {student.gender.toLowerCase() === 'female' ? '♀ မ' : '♂ ကျား'}
                          </span>
                        )}
                        {isSelf && (
                          <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-950/80 px-2 py-0.5 rounded-full shrink-0">
                            You (သင်)
                          </span>
                        )}
                      </div>
                      {(isStaff || isSelf) && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
                          @{student.username}
                          {isStaff && ` · ${student.phone || ''} · ${student.email}`}
                        </div>
                      )}
                      {isStaff && student.address && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          📍 {student.address}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                    {isStaff && attPct !== null && (
                      <span
                        className={`text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                          attPct >= 75
                            ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                            : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                        }`}
                      >
                        Attendance: {attPct}%
                      </span>
                    )}

                    {!isStaff && (
                      <span className="text-[11px] text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/60 px-2.5 py-0.5 rounded-full font-medium">
                        {isSelf ? 'Enrolled (သင်တက်ရောက်ဆဲ)' : 'Classmate (အတန်းဖော်)'}
                      </span>
                    )}

                    {/* Report Card Button (Visible to Staff for every student, or to Student for their own row) */}
                    {(isStaff || isSelf) && (
                      <button
                        type="button"
                        onClick={() => setInspectReportStudent(student)}
                        className="flex items-center gap-1 px-2.5 py-1 text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900/60 border border-sky-200 dark:border-sky-800/70 rounded-xl text-xs font-extrabold transition-colors cursor-pointer"
                        title="ကျောင်းသား၏ Attendance, Exam Room အမှတ်များ၊ Data Form နှင့် စာအုပ်ပို့ဆောင်မှု Report Card အပြည့်အစုံကြည့်ရန်"
                      >
                        <BarChart3 className="w-3.5 h-3.5" />
                        <span>{isSelf && !isStaff ? 'My Report Card' : 'Report Card'}</span>
                      </button>
                    )}

                    {/* Admin / Co-Admin Edit Student Info & Remove Actions */}
                    {isStaff && (
                      <>
                        <button
                          type="button"
                          onClick={() => setEditingAccountUser(student)}
                          className="flex items-center gap-1 px-2.5 py-1 text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800/70 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                          title="ကျောင်းသား အချက်အလက် (အမည်၊ Username၊ Email၊ ဖုန်း၊ အလုပ်အကိုင်၊ လိပ်စာ၊ Password၊ အတန်းများ) ပြင်ဆင်ရန်"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setStudentToUnenroll(student)}
                          className="flex items-center gap-1 px-2.5 py-1 text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                          title="အတန်းမှ ထုတ်ပယ်မည်"
                        >
                          <UserX className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Progressive Load More Bar for 2,000+ Classmates */}
        {enrolledStudents.length > visibleStudentLimit && (
          <div className="mt-4 p-3.5 rounded-2xl neu-inset-sm flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs">
            <span className="text-slate-600 dark:text-slate-300 font-medium">
              ပြသထားသည်: <strong>{visibleStudentLimit}</strong> / စုစုပေါင်း <strong>{enrolledStudents.length}</strong> ဦး
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setVisibleStudentLimit((prev) => prev + 100)}
                className="px-3.5 py-1.5 rounded-xl neu-btn-indigo font-bold cursor-pointer"
              >
                + နောက်ထပ် ၁၀၀ ဦး ပြမည်
              </button>
              <button
                type="button"
                onClick={() => setVisibleStudentLimit(enrolledStudents.length)}
                className="px-3 py-1.5 rounded-xl neu-btn text-slate-700 dark:text-slate-200 font-semibold cursor-pointer"
              >
                အားလုံးပြမည် ({enrolledStudents.length})
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Confirmation Modal for Removing Student */}
      {studentToUnenroll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Confirm Student Removal (အတန်းမှ ထုတ်ပယ်ရန် အတည်ပြုပါ)
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                  ကျောင်းသား <strong>"{studentToUnenroll.name}"</strong> (@{studentToUnenroll.username}) ကို{' '}
                  <strong>{course.code} ({course.batch})</strong> အတန်းမှ အမှန်တကယ် ထုတ်ပယ်လိုပါသလား?
                </p>
              </div>
            </div>

            <div className="p-3 bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-xl text-[11px] text-rose-800 dark:text-rose-300 space-y-1">
              <strong>လုံခြုံရေး အကျိုးသက်ရောက်မှု:</strong>
              <div>
                • ထုတ်ပယ်လိုက်သည်နှင့် Row-Level Security မူဝါဒအရ ၎င်းကျောင်းသား၏ Dashboard မှ ဤသင်ခန်းစာများအားလုံး ချက်ချင်း ပုန်းကွယ်သွားမည်ဖြစ်ပြီး ဝင်ရောက်ခွင့် ပိတ်ပင်သွားပါမည်။
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setStudentToUnenroll(null)}
                className="px-3.5 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 cursor-pointer"
              >
                မပြုလုပ်ပါ
              </button>
              <button
                type="button"
                onClick={handleConfirmUnenroll}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                အတန်းမှ ထုတ်ပယ်မည်
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Student Modal */}
      <AddStudentModal
        course={course}
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onStudentEnrolled={onRefresh}
      />

      {/* Edit Account Info Modal (Admin / Co-Admin editing own account or student account) */}
      {editingAccountUser && (
        <EditUserAccountModal
          user={editingAccountUser}
          isOpen={true}
          onClose={() => setEditingAccountUser(null)}
          onSuccess={(updatedUser) => {
            setEditingAccountUser(null);
            onRefresh();
            setEnrollmentStatusMessage(
              `✅ "${updatedUser.name}" (@${updatedUser.username}) ၏ အကောင့်အချက်အလက်များကို အောင်မြင်စွာ ပြင်ဆင်သိမ်းဆည်းပြီးပါပြီ!`
            );
            setTimeout(() => setEnrollmentStatusMessage(null), 5000);
          }}
        />
      )}

      {/* Student Performance Report Card Modal */}
      {inspectReportStudent && (
        <StudentReportCardModal
          course={course}
          student={inspectReportStudent}
          currentUser={currentUser}
          onClose={() => setInspectReportStudent(null)}
          onOpenCertificate={onOpenCertificate}
        />
      )}
    </div>
  );
};
