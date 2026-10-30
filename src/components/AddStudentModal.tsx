import React, { useState } from 'react';
import { Course } from '../types/classroom';
import { ClassroomDB } from '../services/storage';
import { SupabaseService } from '../services/supabase';
import { PRESET_AVATARS } from '../data/presetAvatars';
import {
  UserPlus,
  Search,
  Check,
  AlertCircle,
  UserCheck,
  Eye,
  EyeOff,
  Copy,
  CheckCheck,
} from 'lucide-react';

interface AddStudentModalProps {
  course: Course;
  isOpen: boolean;
  onClose: () => void;
  onStudentEnrolled: () => void;
}

export const AddStudentModal: React.FC<AddStudentModalProps> = ({
  course,
  isOpen,
  onClose,
  onStudentEnrolled,
}) => {
  const [activeTab, setActiveTab] = useState<'existing' | 'new'>('existing');
  const [searchQuery, setSearchQuery] = useState('');

  const allUsers = ClassroomDB.getAllUsers();
  const unenrolledStudents = allUsers.filter(
    (u) => u.role === 'student' && !course.enrolledStudentIds.includes(u.id)
  );

  const filteredUnenrolled = unenrolledStudents.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // New student form with App login account
  const currentUser = ClassroomDB.getCurrentUser();
  const availableCourses = currentUser ? ClassroomDB.getCourses(currentUser) : [course];

  const [newName, setNewName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newGender, setNewGender] = useState<'male' | 'female' | 'other'>('male');
  const [newAddress, setNewAddress] = useState('');
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([course.id]);
  const [newPassword, setNewPassword] = useState('student123');
  const [newAvatar, setNewAvatar] = useState(PRESET_AVATARS[0].url);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [createdDetails, setCreatedDetails] = useState<{
    username: string;
    password: string;
    name: string;
    coursesLabel: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const toggleCourseSelection = (cId: string) => {
    setSelectedCourseIds((prev) =>
      prev.includes(cId) ? prev.filter((id) => id !== cId) : [...prev, cId]
    );
  };

  const handleEnrollExisting = (studentId: string, studentName: string) => {
    ClassroomDB.enrollStudent(course.id, studentId);
    setSuccessMessage(`ကျောင်းသား ${studentName} ကို ${course.code} အတန်းထဲသို့ အောင်မြင်စွာ ထည့်သွင်းပြီးပါပြီ။`);
    onStudentEnrolled();
    setTimeout(() => {
      setSuccessMessage(null);
    }, 3000);
  };

  const handleCreateAndEnroll = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newUsername.trim() || !newEmail.trim()) {
      setFormError('ကျေးဇူးပြု၍ အချက်အလက်များ အပြည့်အစုံ ဖြည့်စွက်ပေးပါ။');
      return;
    }

    if (!newPassword.trim() || newPassword.trim().length < 4) {
      setFormError('App Login Password သည် အနည်းဆုံး ၄ လုံး ရှိရပါမည်။');
      return;
    }

    const targetCourses = selectedCourseIds.length > 0 ? selectedCourseIds : [course.id];

    setFormError(null);
    const result = ClassroomDB.registerNewStudent({
      name: newName,
      username: newUsername,
      password: newPassword.trim(),
      email: newEmail,
      phone: newPhone || '+95 9 790 000000',
      avatar: newAvatar,
      gender: newGender,
      address: newAddress.trim() || undefined,
      initialCourseIds: targetCourses,
    });

    if (result.error) {
      setFormError(result.error);
      return;
    }

    if (result.student) {
      SupabaseService.signUpWithSupabase(newEmail.trim(), newPassword.trim(), {
        id: result.student.id,
        name: result.student.name,
        username: result.student.username,
        role: 'student',
        phone: result.student.phone,
        avatar: result.student.avatar,
        gender: newGender,
        address: result.student.address,
      }).catch(() => {});
    }

    const enrolledCourseCodes = availableCourses
      .filter((c) => targetCourses.includes(c.id))
      .map((c) => c.code)
      .join(', ');

    setCreatedDetails({
      name: newName.trim(),
      username: newUsername.trim(),
      password: newPassword.trim(),
      coursesLabel: enrolledCourseCodes || course.code,
    });

    setSuccessMessage(
      `ကျောင်းသားအသစ် "${newName}" (@${newUsername}) အတွက် Login အကောင့် ဖန်တီးပြီး (${enrolledCourseCodes || course.code}) အတန်းများထဲသို့ တစ်ပြိုင်တည်း ထည့်သွင်းပြီးပါပြီ!`
    );

    // Reset form fields
    setNewName('');
    setNewUsername('');
    setNewEmail('');
    setNewPhone('');
    setNewGender('male');
    setNewAddress('');
    setSelectedCourseIds([course.id]);
    setNewPassword('student123');

    onStudentEnrolled();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-850">
          <div className="flex items-center gap-2.5">
            <UserPlus className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base">
                Add Student to Class (ကျောင်းသား ထည့်သွင်းရန်)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                {course.code} · {course.batch}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1.5 rounded-lg cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 p-1.5 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800 text-xs shrink-0">
          <button
            type="button"
            onClick={() => {
              setActiveTab('existing');
              setFormError(null);
            }}
            className={`py-2 rounded-lg font-medium transition-colors cursor-pointer ${
              activeTab === 'existing'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            ရှိပြီးသား ကျောင်းသားထဲမှ ရွေးမည် ({unenrolledStudents.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('new');
              setFormError(null);
            }}
            className={`py-2 rounded-lg font-medium transition-colors cursor-pointer ${
              activeTab === 'new'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            + ကျောင်းသားအသစ် ဖန်တီး၍ ထည့်မည်
          </button>
        </div>

        {/* Scrollable Container */}
        <div className="overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Status Alerts */}
          {successMessage && (
            <div className="flex items-start gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-300 text-xs rounded-xl">
              <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="leading-snug">{successMessage}</div>
            </div>
          )}

          {formError && (
            <div className="flex items-start gap-2 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-300 text-xs rounded-xl">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="leading-snug">{formError}</div>
            </div>
          )}

          {/* Tab 1: Existing Students List */}
          {activeTab === 'existing' && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ကျောင်းသား အမည် သို့မဟုတ် Username ဖြင့် ရှာဖွေပါ..."
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
                {filteredUnenrolled.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                    {unenrolledStudents.length === 0
                      ? 'ကျောင်းသားအားလုံး ဤအတန်းထဲသို့ ထည့်သွင်းပြီးဖြစ်ပါသည်။ ကျောင်းသားအသစ်ထည့်လိုပါက အပေါ်မှ "+ ကျောင်းသားအသစ် ဖန်တီး၍ ထည့်မည်" ကို ရွေးချယ်ပါ။'
                      : 'ရှာဖွေမှုနှင့် ကိုက်ညီသော ကျောင်းသား မတွေ့ရှိပါ။'}
                  </div>
                ) : (
                  filteredUnenrolled.map((student) => (
                    <div
                      key={student.id}
                      className="p-3 flex items-center justify-between text-xs hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={student.avatar}
                          alt={student.name}
                          referrerPolicy="no-referrer"
                          className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                        />
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-slate-100">{student.name}</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                            @{student.username} · {student.email}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleEnrollExisting(student.id, student.name)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium shadow-2xs transition-colors cursor-pointer"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Enroll</span>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Tab 2: Create New Student with Login Access & Profile Picture */}
          {activeTab === 'new' && (
            <div className="space-y-4">
              {/* If credentials recently created, display the copyable card */}
              {createdDetails && (
                <div className="p-4 bg-indigo-50/80 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200">
                      Login Credentials for {createdDetails.name}:
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `SwanArh Classroom Login:\nURL: ${window.location.origin}${window.location.pathname}\nUsername: ${createdDetails.username}\nPassword: ${createdDetails.password}\nClass: ${createdDetails.coursesLabel || course.code}`
                        );
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2500);
                      }}
                      className="flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700 transition-colors cursor-pointer font-medium"
                    >
                      {copied ? <CheckCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copied!' : 'Copy Login Details'}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-indigo-100 dark:border-slate-800">
                    <div>
                      <span className="text-slate-400 block text-[10px]">USERNAME</span>
                      <span className="font-bold text-slate-800 dark:text-slate-100">@{createdDetails.username}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">PASSWORD</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">{createdDetails.password}</span>
                    </div>
                  </div>
                </div>
              )}

              <form onSubmit={handleCreateAndEnroll} className="space-y-3.5 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                      Full Name (ကျောင်းသား အမည်) *
                    </label>
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => {
                        setNewName(e.target.value);
                        if (!newUsername) {
                          const suggested = e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9]/g, '')
                            .slice(0, 12);
                          if (suggested) setNewUsername(suggested);
                        }
                      }}
                      placeholder="e.g. Aung Kaung Myat"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                      Username (အကောင့် Login ID) *
                    </label>
                    <input
                      type="text"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                      placeholder="e.g. aung.kaung"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 font-mono focus:outline-hidden focus:border-indigo-500"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                      App Login Password *
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Min 4 characters"
                        className="w-full pl-3 pr-8 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-mono focus:outline-hidden focus:border-indigo-500"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                      Student Email *
                    </label>
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="student@example.com"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                      Phone Number (ဖုန်းနံပါတ်)
                    </label>
                    <input
                      type="tel"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      placeholder="+95 9 123 456789"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 font-mono focus:outline-hidden focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                      Gender (ကျား / မ ရွေးချယ်ရန်) *
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setNewGender('male')}
                        className={`py-2 px-3 rounded-xl border font-semibold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer ${
                          newGender === 'male'
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                        }`}
                      >
                        ♂ Male (ကျား)
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewGender('female')}
                        className={`py-2 px-3 rounded-xl border font-semibold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer ${
                          newGender === 'female'
                            ? 'bg-pink-600 text-white border-pink-600 shadow-2xs'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                        }`}
                      >
                        ♀ Female (မ)
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                    Address (နေရပ်လိပ်စာ)
                  </label>
                  <input
                    type="text"
                    value={newAddress}
                    onChange={(e) => setNewAddress(e.target.value)}
                    placeholder="ဥပမာ - အမှတ် (၁၂)၊ ပြည်လမ်း၊ ကမာရွတ်မြို့နယ်၊ ရန်ကုန်မြို့"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500"
                  />
                </div>

                {/* Multi-course selection */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold">
                      ထည့်သွင်းမည့် သင်တန်းများ (Select One or More Courses) *
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedCourseIds(
                          selectedCourseIds.length === availableCourses.length
                            ? [course.id]
                            : availableCourses.map((c) => c.id)
                        )
                      }
                      className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      {selectedCourseIds.length === availableCourses.length
                        ? 'လက်ရှိအတန်းသာ ရွေးမည်'
                        : 'အတန်းအားလုံး ရွေးမည်'}
                    </button>
                  </div>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {availableCourses.map((c) => {
                      const isSelected = selectedCourseIds.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => toggleCourseSelection(c.id)}
                          className={`w-full p-2 rounded-lg border text-left flex items-center gap-2.5 transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-950 dark:text-indigo-100'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                              isSelected
                                ? 'bg-indigo-600 border-indigo-600 text-white'
                                : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="font-semibold">{c.code}</span> · {c.title}{' '}
                            <span className="text-[10px] text-slate-500">({c.batch})</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    Create & Enroll ({selectedCourseIds.length || 1} Classes)
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
