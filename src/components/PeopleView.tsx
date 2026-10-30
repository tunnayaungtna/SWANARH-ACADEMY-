import React, { useState } from 'react';
import { Course, User } from '../types/classroom';
import { ClassroomDB } from '../services/storage';
import { AddStudentModal } from './AddStudentModal';
import { useBackHandler } from '../utils/backNavigation';
import {
  Users,
  UserPlus,
  Shield,
  Check,
  UserX,
  Mail,
  Search,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';

interface PeopleViewProps {
  course: Course;
  currentUser: User;
  onRefresh: () => void;
}

export const PeopleView: React.FC<PeopleViewProps> = ({ course, currentUser, onRefresh }) => {
  const allUsers = ClassroomDB.getAllUsers();
  const [showAddModal, setShowAddModal] = useState(false);
  const [studentToUnenroll, setStudentToUnenroll] = useState<User | null>(null);
  const [enrollmentStatusMessage, setEnrollmentStatusMessage] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');

  // Step-by-step mobile Back button handlers for PeopleView modals
  useBackHandler(showAddModal, () => setShowAddModal(false));
  useBackHandler(!!studentToUnenroll, () => setStudentToUnenroll(null));

  // Get enrolled students objects
  const enrolledStudents = course.enrolledStudentIds
    .map((id) => allUsers.find((u) => u.id === id))
    .filter((u): u is User => !!u)
    .filter(
      (u) =>
        u.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
        u.username.toLowerCase().includes(searchFilter.toLowerCase()) ||
        u.email.toLowerCase().includes(searchFilter.toLowerCase())
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

      {/* Instructors & Faculty Section */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-5 sm:p-6 transition-colors">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
            Instructors & Faculty
          </h2>
          <span className="text-xs text-indigo-600 dark:text-indigo-400 font-mono">Academic Staff</span>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
              alt={course.instructorName}
              referrerPolicy="no-referrer"
              className="w-11 h-11 rounded-full object-cover border border-slate-200 dark:border-slate-700"
            />
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>{course.instructorName}</span>
                <span className="text-[10px] font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded">
                  Lead Instructor
                </span>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">{course.instructorEmail}</span>
            </div>
          </div>

          <a
            href={`mailto:${course.instructorEmail}`}
            className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium rounded-lg transition-colors"
          >
            <Mail className="w-3.5 h-3.5 text-slate-400" />
            <span>Email</span>
          </a>
        </div>
      </section>

      {/* Enrolled Students & Classmates Section */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-4 sm:p-6 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                {currentUser.role === 'admin' || currentUser.role === 'co_admin'
                  ? 'Enrolled Students (အတန်းတွင်း ကျောင်းသားများ)'
                  : 'Classmates & Enrolled Students (အတန်းဖော် ကျောင်းသားများ)'}
              </h2>
              <span className="text-xs font-mono font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full">
                {course.enrolledStudentIds.length} ဦး
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {currentUser.role === 'admin' || currentUser.role === 'co_admin'
                ? 'Instructor / Admin ကွပ်ကဲရေး: ဤအတန်းတွင် စာရင်းဝင်ထားသော ကျောင်းသားများအားလုံးကို ကြည့်ရှုခြင်း၊ ထပ်ထည့်ခြင်းနှင့် ထုတ်ပယ်ခြင်း ပြုလုပ်နိုင်ပါသည်။'
                : 'ဤအတန်းတွင် အတူတကွ တက်ရောက်သင်ယူနေကြသော အတန်းဖော် ကျောင်းသား/သူများ စာရင်း'}
            </p>
          </div>

          {/* Admin / Co-Admin Add Student Button */}
          {(currentUser.role === 'admin' || currentUser.role === 'co_admin') && (
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer shrink-0"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Add Student (ကျောင်းသား ထည့်မည်)</span>
            </button>
          )}
        </div>

        {/* Search Filter Bar (Accessible to both Admin & Students) */}
        {course.enrolledStudentIds.length > 0 && (
          <div className="my-4 relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="အတန်းတွင်း ကျောင်းသားအမည် သို့မဟုတ် Username ဖြင့် ရှာဖွေပါ..."
              className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 transition-colors"
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
            enrolledStudents.map((student) => {
              const isSelf = student.id === currentUser.id;

              return (
                <div
                  key={student.id}
                  className={`py-3 sm:py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs p-2 sm:px-3 rounded-xl transition-colors ${
                    isSelf
                      ? 'bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40'
                      : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={student.avatar}
                      alt={student.name}
                      referrerPolicy="no-referrer"
                      className={`w-9 h-9 rounded-full object-cover shrink-0 ring-1 ${
                        isSelf
                          ? 'ring-indigo-500 ring-2'
                          : 'ring-slate-200 dark:ring-slate-700'
                      }`}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';
                      }}
                    />
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 flex-wrap">
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
                          (currentUser.role === 'admin' || currentUser.role === 'co_admin') && (
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
                            {student.gender.toLowerCase() === 'female' ? '♀ Female' : '♂ Male'}
                          </span>
                        )}
                        {isSelf && (
                          <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-950/80 px-2 py-0.5 rounded-full shrink-0">
                            You (သင်)
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
                        @{student.username}
                        {(currentUser.role === 'admin' || currentUser.role === 'co_admin') && ` · ${student.email} · ${student.phone}`}
                      </div>
                      {(currentUser.role === 'admin' || currentUser.role === 'co_admin') && student.address && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          📍 {student.address}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                    <span className="text-[11px] text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/60 px-2.5 py-0.5 rounded-full font-medium">
                      {isSelf ? 'Enrolled (သင်တက်ရောက်ဆဲ)' : 'Classmate (အတန်းဖော်)'}
                    </span>

                    {/* Admin / Co-Admin Expel / Remove Action */}
                    {(currentUser.role === 'admin' || currentUser.role === 'co_admin') && (
                      <button
                        onClick={() => setStudentToUnenroll(student)}
                        className="flex items-center gap-1 px-2.5 py-1 text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                        title="အတန်းမှ ထုတ်ပယ်မည်"
                      >
                        <UserX className="w-3.5 h-3.5" />
                        <span>Remove (ထုတ်ပယ်မည်)</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
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
    </div>
  );
};
