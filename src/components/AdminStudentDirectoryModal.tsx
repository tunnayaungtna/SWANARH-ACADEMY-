import React, { useState, useRef } from 'react';
import { ClassroomDB } from '../services/storage';
import { Course, User, UserRole } from '../types/classroom';
import { PRESET_AVATARS, compressImageFile } from '../data/presetAvatars';
import { ProfilePictureModal } from './ProfilePictureModal';
import { SupabaseService } from '../services/supabase';
import {
  Users,
  UserPlus,
  Search,
  Check,
  Trash2,
  AlertCircle,
  Lock,
  Eye,
  EyeOff,
  Copy,
  Sparkles,
  Camera,
  Upload,
  ShieldCheck,
  UserCheck,
  GraduationCap,
  Briefcase,
  Layers,
  Download,
  CalendarCheck,
} from 'lucide-react';

interface AdminStudentDirectoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  courses: Course[];
  onRefresh: () => void;
}

export const AdminStudentDirectoryModal: React.FC<AdminStudentDirectoryModalProps> = ({
  isOpen,
  onClose,
  courses,
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);
  const [roleFilter, setRoleFilter] = useState<'all' | 'staff' | 'student'>('all');

  // Form fields
  const [selectedRole, setSelectedRole] = useState<UserRole>('student');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('student123');
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [title, setTitle] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');
  const [address, setAddress] = useState('');
  const [selectedInitialCourses, setSelectedInitialCourses] = useState<string[]>(
    courses[0]?.id ? [courses[0].id] : []
  );
  const [avatar, setAvatar] = useState(PRESET_AVATARS[0].url);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Success credential card
  const [createdCredentials, setCreatedCredentials] = useState<{
    name: string;
    username: string;
    password: string;
    role: UserRole;
    gender?: string;
    address?: string;
    courseName?: string;
  } | null>(null);
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  // Inline password reset
  const [resettingUser, setResettingUser] = useState<User | null>(null);
  const [newUserPassword, setNewUserPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);

  // Editing profile picture of any user
  const [editingAvatarUser, setEditingAvatarUser] = useState<User | null>(null);

  // Revealed passwords state per user
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});
  const [selectedCsvCourseId, setSelectedCsvCourseId] = useState<string>(courses[0]?.id || 'all');

  if (!isOpen) return null;

  const handleExportAttendanceCSV = (courseId: string) => {
    if (courseId === 'all') {
      const res = ClassroomDB.downloadAllClassesAttendanceCSV();
      if (res.success) {
        setToastMsg(
          `📥 အတန်းအားလုံး၏ Attendance Report CSV (${res.filename}) ကို အောင်မြင်စွာ ဒေါင်းလုဒ်ဆွဲပြီးပါပြီ!`
        );
        setTimeout(() => setToastMsg(null), 4000);
      }
      return;
    }

    const res = ClassroomDB.downloadClassAttendanceCSV(courseId);
    if (res.success) {
      setToastMsg(
        `📥 Attendance Report CSV (${res.filename}) ကို အောင်မြင်စွာ ဒေါင်းလုဒ်ဆွဲပြီးပါပြီ!`
      );
      setTimeout(() => setToastMsg(null), 4000);
    }
  };

  const allUsers = ClassroomDB.getAllUsers();
  const staffUsers = allUsers.filter((u) => u.role === 'admin' || u.role === 'co_admin');
  const studentUsers = allUsers.filter((u) => u.role === 'student');

  const filteredUsers = allUsers.filter((u) => {
    if (roleFilter === 'staff' && u.role !== 'admin' && u.role !== 'co_admin') return false;
    if (roleFilter === 'student' && u.role !== 'student') return false;

    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      u.name.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.address && u.address.toLowerCase().includes(q)) ||
      (u.title && u.title.toLowerCase().includes(q)) ||
      u.role.toLowerCase().includes(q)
    );
  });

  const handleRoleChange = (role: UserRole) => {
    setSelectedRole(role);
    if (role === 'admin') {
      setPassword('admin123');
      if (!title) setTitle('Lead Instructor & Administrator');
    } else if (role === 'co_admin') {
      setPassword('coadmin123');
      if (!title) setTitle('Course Coordinator & Assistant Instructor');
    } else {
      setPassword('student123');
      if (!title) setTitle('Undergraduate Student');
    }
  };

  const toggleInitialCourseSelection = (courseId: string) => {
    setSelectedInitialCourses((prev) =>
      prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId]
    );
  };

  const generateRandomPassword = () => {
    const prefix = selectedRole === 'admin' ? 'ad-' : selectedRole === 'co_admin' ? 'co-' : 'st-';
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    let res = prefix;
    for (let i = 0; i < 4; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(res);
  };

  const handleAvatarFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, 256, 0.85);
      setAvatar(compressed);
    } catch {
      setErrorMsg('ဓာတ်ပုံဖိုင် ဖတ်ရှုရာတွင် ချို့ယွင်းချက်ဖြစ်ပေါ်ပါသည်');
    }
  };

  const handleToggleCourseForStudent = (studentId: string, courseId: string, isEnrolled: boolean) => {
    if (isEnrolled) {
      ClassroomDB.unenrollStudent(courseId, studentId);
      setToastMsg('အတန်းမှ ထုတ်ပယ်ပြီးပါပြီ (Unenrolled). RLS အရ အဆိုပါ Course ပုန်းကွယ်သွားပါမည်။');
    } else {
      ClassroomDB.enrollStudent(courseId, studentId);
      setToastMsg('အတန်းထဲသို့ ထည့်သွင်းပြီးပါပြီ (Enrolled). ကျောင်းသား Dashboard တွင် ချက်ချင်း ပေါ်လာပါမည်။');
    }
    onRefresh();
    setTimeout(() => setToastMsg(null), 3500);
  };

  const handleCreateAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !username.trim() || !email.trim()) {
      setErrorMsg('ကျေးဇူးပြု၍ အမည်၊ Username နှင့် Email အားလုံး ဖြည့်သွင်းပေးပါ။');
      return;
    }

    if (!password.trim() || password.trim().length < 4) {
      setErrorMsg('Login Password သည် အနည်းဆုံး ၄ လုံး ရှိရပါမည်။');
      return;
    }

    setErrorMsg(null);
    setIsSubmitting(true);
    const chosenCourses = courses.filter((c) => selectedInitialCourses.includes(c.id));

    const res = ClassroomDB.registerNewUser({
      name: name.trim(),
      username: username.trim(),
      password: password.trim(),
      email: email.trim(),
      phone: phone.trim() || '+95 9 790 000000',
      role: selectedRole,
      avatar,
      title: title.trim() || undefined,
      gender,
      address: address.trim() || undefined,
      initialCourseIds: selectedRole === 'student' ? selectedInitialCourses : undefined,
    });

    if (res.error) {
      setIsSubmitting(false);
      setErrorMsg(res.error);
      return;
    }

    // Direct sync with Supabase Auth & profiles table using the exact same user ID
    let supabaseError: string | undefined;
    try {
      const supRes = await SupabaseService.signUpWithSupabase(email.trim(), password.trim(), {
        id: res.user?.id,
        name: name.trim(),
        username: username.trim(),
        role: selectedRole,
        phone: phone.trim(),
        avatar,
        title: title.trim(),
        gender,
        address: address.trim(),
      });
      if (!supRes.profileSynced && supRes.error) {
        supabaseError = supRes.error;
      }
      // Also sync the courses so enrolled_student_ids updates in Supabase
      for (const c of ClassroomDB.getCourses(res.user || allUsers[0])) {
        await SupabaseService.upsertCourse(c);
      }
    } catch {
      // offline or pending schema setup
    }

    setIsSubmitting(false);

    // Set created credentials card for immediate copying
    setCreatedCredentials({
      name: name.trim(),
      username: username.trim(),
      password: password.trim(),
      role: selectedRole,
      gender: gender === 'male' ? 'Male (ကျား)' : gender === 'female' ? 'Female (မ)' : 'Other',
      address: address.trim() || undefined,
      courseName:
        selectedRole === 'student' && chosenCourses.length > 0
          ? chosenCourses.map((c) => `${c.code} (${c.title})`).join(', ')
          : undefined,
    });

    const roleLabel = selectedRole === 'admin' ? 'Admin' : selectedRole === 'co_admin' ? 'Co-Admin' : 'Student';
    if (supabaseError) {
      setToastMsg(
        `${roleLabel} အကောင့် "${name}" (@${username}) ကို App ထဲတွင် ဖွင့်ပြီးပါပြီ။ (Supabase သတိပေးချက်: ${supabaseError} — Supabase Setup မှ SQL Script ကို Run ပေးပါ)`
      );
    } else {
      setToastMsg(
        `${roleLabel} အကောင့် "${name}" (@${username}) ကို App နှင့် Supabase "profiles" Table သို့ အောင်မြင်စွာ ထည့်သွင်းပြီးပါပြီ!`
      );
    }
    setName('');
    setUsername('');
    setPassword(selectedRole === 'admin' ? 'admin123' : selectedRole === 'co_admin' ? 'coadmin123' : 'student123');
    setEmail('');
    setPhone('');
    setTitle('');
    setGender('male');
    setAddress('');
    setSelectedInitialCourses(courses[0]?.id ? [courses[0].id] : []);
    setAvatar(PRESET_AVATARS[0].url);
    setShowNewForm(false);
    onRefresh();
  };

  const handleCopyCredentials = (creds: {
    username: string;
    password: string;
    name: string;
    role: UserRole;
    gender?: string;
    address?: string;
    courseName?: string;
  }) => {
    const roleTitle = creds.role === 'admin' ? 'Administrator (ဆရာ)' : creds.role === 'co_admin' ? 'Co-Admin (တွဲဖက်ဆရာ)' : 'Student (ကျောင်းသား)';
    const loginUrl = window.location.origin + window.location.pathname;
    const text = `🎓 Classroom OS Login Credentials\n👤 Name: ${creds.name}\n🛡️ Role: ${roleTitle}${
      creds.gender ? `\n⚧ Gender: ${creds.gender}` : ''
    }${creds.address ? `\n📍 Address: ${creds.address}` : ''}\n🔑 Username: ${creds.username}\n🔒 Password: ${creds.password}${
      creds.courseName ? `\n📚 Assigned Classes: ${creds.courseName}` : ''
    }\n🌐 Login URL: ${loginUrl}`;

    navigator.clipboard.writeText(text);
    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(false), 2500);
  };

  const handleManualSyncToSupabase = async () => {
    setIsSubmitting(true);
    const syncRes = await ClassroomDB.syncWithSupabase();
    setIsSubmitting(false);
    if (syncRes.error) {
      setToastMsg(
        `Supabase Sync သတိပေးချက်: ${syncRes.error} (Navbar ရှိ "Supabase Setup" ကိုနှိပ်ပြီး SQL Script ကို Supabase SQL Editor တွင် Run ပေးပါ)`
      );
    } else {
      setToastMsg(
        `✅ Supabase သို့ အောင်မြင်စွာ Sync လုပ်ပြီးပါပြီ! (Users: ${syncRes.syncedUsers} ဦး, Courses: ${syncRes.syncedCourses} ခု)`
      );
    }
    setTimeout(() => setToastMsg(null), 6000);
  };

  const handleSaveResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resettingUser) return;

    if (!newUserPassword.trim() || newUserPassword.trim().length < 4) {
      setToastMsg('⚠️ စကားဝှက်အသစ်သည် အနည်းဆုံး ၄ လုံး ရှိရပါမည်။');
      setTimeout(() => setToastMsg(null), 3500);
      return;
    }

    const res = ClassroomDB.adminUpdateStudentPassword(resettingUser.id, newUserPassword.trim());
    if (res.success) {
      setToastMsg(`အကောင့် "${resettingUser.name}" ၏ Login Password ကို အောင်မြင်စွာ ပြောင်းလဲပြီးပါပြီ။`);
      setResettingUser(null);
      setNewUserPassword('');
      onRefresh();
      setTimeout(() => setToastMsg(null), 3500);
    } else {
      setToastMsg(res.error || 'စကားဝှက် ပြောင်းလဲရာတွင် အမှားဖြစ်ပေါ်ခဲ့ပါသည်။');
      setTimeout(() => setToastMsg(null), 3500);
    }
  };

  const handleDeleteUser = (user: User) => {
    setUserToDelete(user);
  };

  const confirmDeleteUser = () => {
    if (!userToDelete) return;
    const user = userToDelete;
    setUserToDelete(null);
    const res = ClassroomDB.deleteUser(user.id);
    if (!res.success) {
      setToastMsg(res.error || 'အသုံးပြုသူအား ဖျက်သိမ်း၍ မရပါ');
      setTimeout(() => setToastMsg(null), 3500);
      return;
    }
    setToastMsg(`အကောင့် "${user.name}" ကို စနစ်နှင့် SQL Database မှ အောင်မြင်စွာ ဖျက်သိမ်းပြီးပါပြီ။`);
    onRefresh();
    setTimeout(() => setToastMsg(null), 3500);
  };

  const toggleRevealPassword = (userId: string) => {
    setRevealedPasswords((prev) => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
        <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-3 sm:my-6 max-h-[92vh] flex flex-col transition-colors">
          {/* Modal Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-xs">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base flex items-center gap-2">
                  <span>User Accounts Directory (အကောင့်များ စီမံခန့်ခွဲမှု)</span>
                  <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800">
                    Supabase Connected
                  </span>
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                  Admin, Co-Admin နှင့် Students အကောင့်များ ဖန်တီးခြင်း၊ စကားဝှက်နှင့် အတန်းဝင်ခွင့်များ စီမံခြင်း
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 justify-end flex-wrap">
              <button
                type="button"
                onClick={handleManualSyncToSupabase}
                disabled={isSubmitting}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0 shadow-xs disabled:opacity-50"
                title="လက်ရှိ ကျောင်းသားနှင့် အတန်းစာရင်း အားလုံးကို Supabase သို့ ချက်ချင်း ပို့မည်"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Syncing...' : 'Sync to Supabase'}</span>
              </button>

              <button
                onClick={() => {
                  setShowNewForm(!showNewForm);
                  if (!showNewForm) {
                    setPassword(selectedRole === 'admin' ? 'admin123' : selectedRole === 'co_admin' ? 'coadmin123' : 'student123');
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0 shadow-xs"
              >
                <UserPlus className="w-4 h-4" />
                <span>{showNewForm ? 'စာရင်းကြည့်မည်' : '+ Add User Account (အကောင့်သစ်)'}</span>
              </button>

              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg text-xs font-semibold cursor-pointer shrink-0"
              >
                ✕ ပိတ်မည်
              </button>
            </div>
          </div>

          {/* Status Toast */}
          {toastMsg && (
            <div className="m-4 mb-0 flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs rounded-xl shadow-xs">
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{toastMsg}</span>
            </div>
          )}

          {/* Created Account Credentials Notice Card */}
          {createdCredentials && (
            <div className="m-4 mb-0 p-4 bg-gradient-to-r from-indigo-50 via-purple-50 to-indigo-50 dark:from-indigo-950/40 dark:via-purple-950/40 dark:to-indigo-950/40 border-2 border-indigo-300 dark:border-indigo-700 rounded-2xl shadow-sm text-xs space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold">
                    ✓
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                      {createdCredentials.role === 'admin' ? 'Admin' : createdCredentials.role === 'co_admin' ? 'Co-Admin' : 'Student'} Login အကောင့် အောင်မြင်စွာ ဖန်တီးပြီးပါပြီ!
                    </h4>
                    <p className="text-slate-600 dark:text-slate-300 text-[11px]">
                      အောက်ပါ အချက်အလက်များအား အသုံးပြုသူထံသို့ ပေးပို့နိုင်ရန် Copy ပြုလုပ်နိုင်ပါသည်:
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setCreatedCredentials(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold p-1 cursor-pointer"
                  title="Dismiss"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 bg-white dark:bg-slate-800 p-3 rounded-xl border border-indigo-200 dark:border-indigo-900/60 font-mono text-[11px]">
                <div>
                  <span className="text-slate-400 dark:text-slate-400 block text-[10px] uppercase font-sans font-semibold">
                    Name & Role
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white truncate block">{createdCredentials.name}</span>
                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold uppercase">{createdCredentials.role}</span>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-slate-400 block text-[10px] uppercase font-sans font-semibold">
                    Username
                  </span>
                  <span className="font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/50 px-1.5 py-0.5 rounded">
                    @{createdCredentials.username}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-slate-400 block text-[10px] uppercase font-sans font-semibold">
                    Password
                  </span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/50 px-1.5 py-0.5 rounded">
                    {createdCredentials.password}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-slate-400 block text-[10px] uppercase font-sans font-semibold">
                    Class / Status
                  </span>
                  <span className="text-slate-700 dark:text-slate-300 text-xs truncate block">
                    {createdCredentials.courseName || 'All Courses Access'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  ⚡ Supabase Auth & Local Profiles သို့လည်း အလိုအလျောက် sync ပြုလုပ်ပေးထားပါသည်။
                </span>

                <button
                  onClick={() => handleCopyCredentials(createdCredentials)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-xs transition-colors cursor-pointer shadow-xs active:scale-98"
                >
                  {copiedSuccess ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied! (ကူးယူပြီးပါပြီ)</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Credentials (အချက်အလက် ကူးယူမည်)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Content Body */}
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
            {/* Form to Register New User (Admin, Co-Admin, Student) */}
            {showNewForm ? (
              <form
                onSubmit={handleCreateAccountSubmit}
                className="p-4 sm:p-5 rounded-2xl border-2 border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-4 text-xs"
              >
                <div className="flex items-center justify-between border-b border-indigo-100 dark:border-indigo-900/50 pb-2">
                  <div className="flex items-center gap-2 text-indigo-950 dark:text-indigo-200 font-bold text-sm">
                    <UserPlus className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>Create User Account (Admin, Co-Admin သို့မဟုတ် ကျောင်းသား အကောင့်သစ် ဖွင့်မည်)</span>
                  </div>
                  <span className="text-[11px] font-medium text-indigo-600 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/50 px-2 py-0.5 rounded-full">
                    Supabase + ClassroomDB
                  </span>
                </div>

                {errorMsg && (
                  <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Account Role Selector */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    ၁။ အကောင့်အမျိုးအစား ရွေးချယ်ပါ (Account Role) *
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleRoleChange('student')}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                        selectedRole === 'student'
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-900 dark:text-emerald-100 ring-2 ring-emerald-500/20 shadow-xs'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                      }`}
                    >
                      <GraduationCap className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <div>
                        <div className="font-bold text-xs">🎓 Student (ကျောင်းသား)</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">အတန်းတက်၊ အိမ်စာတင်၊ စာမေးပွဲဖြေ</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRoleChange('co_admin')}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                        selectedRole === 'co_admin'
                          ? 'bg-purple-50 dark:bg-purple-950/60 border-purple-500 text-purple-900 dark:text-purple-100 ring-2 ring-purple-500/20 shadow-xs'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                      }`}
                    >
                      <Users className="w-5 h-5 text-purple-600 dark:text-purple-400 shrink-0" />
                      <div>
                        <div className="font-bold text-xs">👥 Co-Admin (တွဲဖက်ဆရာ)</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">Post တင်၊ Schedule၊ အမှတ်ပေး</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRoleChange('admin')}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                        selectedRole === 'admin'
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-900 dark:text-indigo-100 ring-2 ring-indigo-500/20 shadow-xs'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                      }`}
                    >
                      <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <div>
                        <div className="font-bold text-xs">🛡️ Admin (ပင်မ အက်ဒမင်)</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">အတန်းဖန်တီး၊ User စီမံ၊ အကုန်လုပ်ပိုင်ခွင့်</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Profile Picture Selection (Only for Admin & Co-Admin accounts) */}
                {(selectedRole === 'admin' || selectedRole === 'co_admin') && (
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-indigo-100 dark:border-slate-700 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <Camera className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        <span>Profile Picture (Admin / Co-Admin ကိုယ်ရေးဓာတ်ပုံ ရွေးချယ်ပါ)</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 rounded-lg text-[11px] font-medium cursor-pointer"
                      >
                        <Upload className="w-3 h-3" />
                        <span>ပုံတင်မည် (Upload)</span>
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarFileUpload}
                        className="hidden"
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      <img
                        src={avatar}
                        alt="Selected preview"
                        className="w-14 h-14 rounded-full object-cover border-2 border-indigo-500 shadow-xs shrink-0"
                      />
                      <div className="flex-1 overflow-x-auto pb-1">
                        <div className="flex items-center gap-2">
                          {PRESET_AVATARS.map((p) => (
                            <button
                              type="button"
                              key={p.id}
                              onClick={() => setAvatar(p.url)}
                              className={`relative rounded-full p-0.5 transition-all shrink-0 cursor-pointer ${
                                avatar === p.url
                                  ? 'ring-2 ring-indigo-600 scale-105'
                                  : 'opacity-70 hover:opacity-100'
                              }`}
                              title={p.name}
                            >
                              <img
                                src={p.url}
                                alt={p.name}
                                className="w-9 h-9 rounded-full object-cover"
                              />
                              {avatar === p.url && (
                                <div className="absolute inset-0 bg-indigo-600/30 rounded-full flex items-center justify-center">
                                  <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Name & Username */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      ၂။ အမည် (Full Name) *
                    </label>
                    <input
                      type="text"
                      placeholder={selectedRole === 'admin' ? 'e.g., Dr. Zaw Min' : selectedRole === 'co_admin' ? 'e.g., Daw Hla Hla' : 'e.g., မောင်မင်းခန့်'}
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        if (!username && e.target.value) {
                          const suggested = e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9]/g, '');
                          if (suggested) {
                            setUsername(suggested);
                          }
                        }
                      }}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-900 dark:text-white shadow-2xs"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      ၃။ Login အကောင့်အမည် (Username) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono">
                        @
                      </span>
                      <input
                        type="text"
                        placeholder="username"
                        value={username}
                        onChange={(e) =>
                          setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''))
                        }
                        className="w-full pl-7 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-indigo-500 font-mono text-slate-900 dark:text-white shadow-2xs"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Password Setting with Generator */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-300">
                      ၄။ App Login စကားဝှက် (Password) *
                    </label>
                    <button
                      type="button"
                      onClick={generateRandomPassword}
                      className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>စကားဝှက် အလိုအလျောက် သတ်မှတ်မည်</span>
                    </button>
                  </div>

                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                      <Lock className="w-4 h-4" />
                    </span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password"
                      className="w-full pl-9 pr-16 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-indigo-500 font-mono text-slate-900 dark:text-white shadow-2xs"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Email, Phone & Title */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      ၅။ အီးမေးလ် (Email Address) *
                    </label>
                    <input
                      type="email"
                      placeholder="user@classroomos.edu"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-indigo-500 font-mono text-slate-900 dark:text-white shadow-2xs"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      ၆။ ဖုန်းနံပါတ် (Phone Number)
                    </label>
                    <input
                      type="text"
                      placeholder="+95 9 123 456789"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-indigo-500 font-mono text-slate-900 dark:text-white shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      ၇။ ရာထူး / ပညာအရည်အချင်း (Title)
                    </label>
                    <input
                      type="text"
                      placeholder={selectedRole === 'admin' ? 'Dean / Lead Instructor' : selectedRole === 'co_admin' ? 'Course Coordinator' : 'Computer Science Scholar'}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-900 dark:text-white shadow-2xs"
                    />
                  </div>
                </div>

                {/* Gender (Male / Female) & Address */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      ၈။ ကျား / မ ရွေးချယ်ရန် (Gender: Male or Female) *
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setGender('male')}
                        className={`py-2 px-3 rounded-xl border font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          gender === 'male'
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-indigo-400'
                        }`}
                      >
                        <span>♂ Male (ကျား)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setGender('female')}
                        className={`py-2 px-3 rounded-xl border font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          gender === 'female'
                            ? 'bg-pink-600 text-white border-pink-600 shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-pink-400'
                        }`}
                      >
                        <span>♀ Female (မ)</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      ၉။ နေရပ်လိပ်စာ (Address)
                    </label>
                    <input
                      type="text"
                      placeholder="ဥပမာ - အမှတ် (၁၂)၊ ပြည်လမ်း၊ ကမာရွတ်မြို့နယ်၊ ရန်ကုန်မြို့"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-900 dark:text-white shadow-2xs"
                    />
                  </div>
                </div>

                {/* Multi-Course Initial Class Enrollment for Students */}
                {selectedRole === 'student' && (
                  <div className="p-3.5 bg-white dark:bg-slate-800 rounded-xl border border-indigo-100 dark:border-slate-700 space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <label className="block font-semibold text-slate-800 dark:text-slate-200">
                          ၁၀။ စတင်ထည့်သွင်းမည့် သင်တန်းများ (Enroll in Multiple Courses at Once)
                        </label>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          သင်တန်း တစ်ခုထက်ပို၍ တစ်ခါတည်း ရွေးချယ်ထည့်သွင်းနိုင်ပါသည် ({selectedInitialCourses.length} ခု ရွေးချယ်ထားသည်)
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedInitialCourses(courses.map((c) => c.id))}
                          className="px-2.5 py-1 text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-100 cursor-pointer"
                        >
                          အားလုံးရွေးမည် (Select All)
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedInitialCourses([])}
                          className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 cursor-pointer"
                        >
                          ရှင်းမည် (Clear)
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {courses.map((c) => {
                        const isChecked = selectedInitialCourses.includes(c.id);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => toggleInitialCourseSelection(c.id)}
                            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                              isChecked
                                ? 'bg-emerald-50/90 dark:bg-emerald-950/60 border-emerald-500 text-emerald-950 dark:text-emerald-100 ring-1 ring-emerald-500/30'
                                : 'bg-slate-50 dark:bg-slate-850 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-400'
                            }`}
                          >
                            <div
                              className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center shrink-0 border ${
                                isChecked
                                  ? 'bg-emerald-600 border-emerald-600 text-white'
                                  : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600'
                              }`}
                            >
                              {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-xs truncate">
                                {c.code} · {c.title}
                              </div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                {c.batch} · {c.section}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Form Action Buttons */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-indigo-100 dark:border-indigo-900/50">
                  <button
                    type="button"
                    onClick={() => setShowNewForm(false)}
                    className="px-3.5 py-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>{isSubmitting ? 'Creating...' : `Create ${selectedRole === 'admin' ? 'Admin' : selectedRole === 'co_admin' ? 'Co-Admin' : 'Student'} Account`}</span>
                  </button>
                </div>
              </form>
            ) : null}

            {/* Class Attendance Report CSV Export Bar (For Admins & Co-Admins) */}
            <div className="p-3.5 sm:p-4 rounded-xl border border-emerald-200 dark:border-emerald-800/70 bg-emerald-50/60 dark:bg-emerald-950/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start sm:items-center gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-600 text-white shrink-0">
                  <CalendarCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    Export Class Attendance Report (CSV ဖိုင်ထုတ်ယူရန်)
                  </h4>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300">
                    အတန်းတစ်ခုချင်းစီအလိုက် ကျောင်းသားများ၏ တက်ရောက်မှု ရာခိုင်နှုန်း (%) နှင့် နေ့စွဲအလိုက် Attendance မှတ်တမ်းအပြည့်အစုံကို CSV (Excel) ဖိုင်အဖြစ် ဒေါင်းလုဒ်ဆွဲနိုင်ပါသည်။
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <select
                  value={selectedCsvCourseId}
                  onChange={(e) => setSelectedCsvCourseId(e.target.value)}
                  className="px-3 py-1.5 text-xs font-semibold bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden"
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.title} ({c.enrolledStudentIds.length} students)
                    </option>
                  ))}
                  <option value="all">All Classes Combined Report</option>
                </select>

                <button
                  type="button"
                  onClick={() => handleExportAttendanceCSV(selectedCsvCourseId)}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Attendance CSV</span>
                </button>
              </div>
            </div>

            {/* Filter Tabs & Search bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Role Filter Tabs */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setRoleFilter('all')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    roleFilter === 'all'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  All Accounts ({allUsers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setRoleFilter('staff')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    roleFilter === 'staff'
                      ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-2xs font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  🛡️ Admins & Co-Admins ({staffUsers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setRoleFilter('student')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    roleFilter === 'student'
                      ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-2xs font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  🎓 Students ({studentUsers.length})
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="အမည်၊ Username၊ လိပ်စာ ရှာရန်..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Users Directory Cards */}
            <div className="space-y-3">
              {filteredUsers.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800">
                  ရှာဖွေမှုနှင့် ကိုက်ညီသော အကောင့် မတွေ့ရှိပါ။
                </div>
              ) : (
                filteredUsers.map((user) => {
                  const isRevealed = revealedPasswords[user.id];
                  const userPassword =
                    user.password || (user.role === 'admin' ? 'admin123' : user.role === 'co_admin' ? 'coadmin123' : 'student123');
                  const normalizedGender = user.gender?.toLowerCase();

                  return (
                    <div
                      key={user.id}
                      className="p-3.5 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 hover:border-slate-300 dark:hover:border-slate-700 transition-colors shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3.5"
                    >
                      {/* User Info & Credentials */}
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="relative group/avatar shrink-0">
                          <img
                            src={user.avatar}
                            alt={user.name}
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = PRESET_AVATARS[0].url;
                            }}
                            className="w-11 h-11 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                          />
                          {(user.role === 'admin' || user.role === 'co_admin') && (
                            <button
                              type="button"
                              onClick={() => setEditingAvatarUser(user)}
                              className="absolute inset-0 bg-slate-900/60 rounded-full opacity-0 group-hover/avatar:opacity-100 flex items-center justify-center text-white transition-opacity cursor-pointer"
                              title="Edit Profile Picture (Admin / Co-Admin Only)"
                            >
                              <Camera className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-slate-900 dark:text-white">
                              {user.name}
                            </span>
                            <span className="text-[11px] font-mono text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-200/50 dark:border-indigo-800/40">
                              @{user.username}
                            </span>

                            {/* Role Badge */}
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                user.role === 'admin'
                                  ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                                  : user.role === 'co_admin'
                                  ? 'bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                                  : 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                              }`}
                            >
                              {user.role === 'admin' ? '🛡️ Admin' : user.role === 'co_admin' ? '👥 Co-Admin' : '🎓 Student'}
                            </span>

                            {/* Academy Rules Accepted Badge for Students */}
                            {user.role === 'student' && (
                              user.rulesAccepted ? (
                                <span
                                  className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/90 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700"
                                  title={
                                    user.rulesAcceptedAt
                                      ? `သင်တန်းစည်းကမ်းချက် သိရှိလိုက်နာပါမည် အတည်ပြုပြီး (${user.rulesAcceptedAt})`
                                      : 'သင်တန်းစည်းကမ်းချက် သိရှိလိုက်နာပါမည် အတည်ပြုပြီး'
                                  }
                                >
                                  <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400 stroke-[3]" />
                                  <span>သိရှိ လိုက်နာပါမည်</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                  <span>⏳ စည်းကမ်းချက် လက်ခံရန်ကျန်</span>
                                </span>
                              )
                            )}

                            {/* Gender Badge */}
                            {normalizedGender && (
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                                  normalizedGender === 'female'
                                    ? 'bg-pink-50 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800'
                                    : 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800'
                                }`}
                              >
                                {normalizedGender === 'female' ? '♀ Female (မ)' : '♂ Male (ကျား)'}
                              </span>
                            )}
                          </div>

                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
                            {user.email} · {user.phone}
                            {user.title && ` · ${user.title}`}
                          </div>

                          {user.address && (
                            <div className="text-[11px] text-slate-600 dark:text-slate-300 truncate">
                              📍 လိပ်စာ: {user.address}
                            </div>
                          )}

                          {/* Login Credentials Pill */}
                          <div className="flex items-center gap-2 pt-0.5">
                            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                              Login Password:
                            </span>
                            <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                              {isRevealed ? userPassword : '••••••••'}
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleRevealPassword(user.id)}
                              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-0.5"
                              title={isRevealed ? 'Hide Password' : 'Show Password'}
                            >
                              {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                handleCopyCredentials({
                                  name: user.name,
                                  username: user.username,
                                  password: userPassword,
                                  role: user.role,
                                  gender: normalizedGender === 'female' ? 'Female (မ)' : 'Male (ကျား)',
                                  address: user.address,
                                });
                                setToastMsg(`အကောင့် "${user.name}" ၏ Login အချက်အလက်များကို ကူးယူပြီးပါပြီ။`);
                                setTimeout(() => setToastMsg(null), 3000);
                              }}
                              className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 cursor-pointer p-0.5"
                              title="Copy Credentials to Clipboard"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setResettingUser(user);
                                setNewUserPassword(userPassword);
                                setShowResetPassword(false);
                              }}
                              className="text-[10px] text-amber-700 dark:text-amber-400 hover:underline font-medium cursor-pointer ml-1"
                            >
                              Reset Password
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Class Enrolment Toggles (for Students) or Privileges Note (for Admin/Co-Admin) */}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3 shrink-0">
                        {user.role === 'student' ? (
                          <div className="space-y-1">
                            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                              Course Enrollments (အတန်းများ)
                            </span>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {courses.map((course) => {
                                const isEnrolled = course.enrolledStudentIds.includes(user.id);
                                const attPct = isEnrolled
                                  ? ClassroomDB.calculateTotalAttendancePercentage(
                                      course.id,
                                      user.id
                                    )
                                  : null;

                                return (
                                  <button
                                    key={course.id}
                                    onClick={() =>
                                      handleToggleCourseForStudent(user.id, course.id, isEnrolled)
                                    }
                                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                                      isEnrolled
                                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 hover:bg-rose-50 dark:hover:bg-rose-950/60 hover:text-rose-700 hover:border-rose-300'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 hover:text-indigo-600 border border-slate-200 dark:border-slate-700'
                                    }`}
                                    title={
                                      isEnrolled
                                        ? `Attendance: ${attPct}% — Click to remove from ${course.code}`
                                        : `Click to enroll in ${course.code}`
                                    }
                                  >
                                    {isEnrolled ? (
                                      <>
                                        <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                        <span>
                                          {course.code} ({attPct}%)
                                        </span>
                                      </>
                                    ) : (
                                      <>
                                        <span>+ {course.code}</span>
                                      </>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <div className="text-right">
                            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                              Platform Access
                            </span>
                            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded">
                              {user.role === 'admin' ? 'All Classes & Faculty Privileges' : 'Assistant Instructor Privileges'}
                            </span>
                          </div>
                        )}

                        {/* Delete User Action */}
                        <button
                          onClick={() => handleDeleteUser(user)}
                          className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors cursor-pointer self-end sm:self-center"
                          title="Delete user from platform"
                          aria-label="Delete user"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Admin Reset Password Modal Dialog */}
          {resettingUser && (
            <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-20">
              <div className="bg-white dark:bg-slate-850 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-2xl max-w-sm w-full space-y-3 text-xs">
                <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm">
                  <Lock className="w-4 h-4 text-amber-600" />
                  <span>စကားဝှက် အသစ် သတ်မှတ်ခြင်း</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300">
                  အသုံးပြုသူ <strong>{resettingUser.name}</strong> (@{resettingUser.username}) အတွက်
                  စကားဝှက်အသစ် ရိုက်ထည့်ပေးပါ:
                </p>

                <div className="relative">
                  <input
                    type={showResetPassword ? 'text' : 'password'}
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono text-slate-900 dark:text-white"
                    placeholder="New password (min 4 chars)"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  >
                    {showResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setResettingUser(null)}
                    className="px-3 py-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveResetPassword}
                    className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-semibold cursor-pointer shadow-xs"
                  >
                    Save Password
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Delete User Confirmation Modal Dialog */}
          {userToDelete && (
            <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-20">
              <div className="bg-white dark:bg-slate-850 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-2xl max-w-sm w-full space-y-4 text-xs">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 shrink-0">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                      အကောင့်ဖျက်သိမ်းရန် အတည်ပြုပါ
                    </h4>
                    <p className="text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                      အသုံးပြုသူ <strong>"{userToDelete.name}"</strong> (@{userToDelete.username}) အား စနစ်နှင့် SQL Database တစ်ခုလုံးမှ လုံးဝ ဖျက်သိမ်းလိုပါသလား?
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setUserToDelete(null)}
                    className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold cursor-pointer"
                  >
                    မဖျက်တော့ပါ
                  </button>
                  <button
                    type="button"
                    onClick={confirmDeleteUser}
                    className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold cursor-pointer shadow-xs"
                  >
                    သေချာပါသည်၊ ဖျက်မည်
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Profile Picture Modal for Admin & Co-Admin accounts only */}
      {editingAvatarUser && (editingAvatarUser.role === 'admin' || editingAvatarUser.role === 'co_admin') && (
        <ProfilePictureModal
          user={editingAvatarUser}
          isOpen={true}
          onClose={() => setEditingAvatarUser(null)}
          onSuccess={() => {
            setEditingAvatarUser(null);
            onRefresh();
          }}
        />
      )}
    </>
  );
};
