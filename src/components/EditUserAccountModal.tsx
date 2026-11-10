import React, { useState, useEffect } from 'react';
import { User, Course } from '../types/classroom';
import { ClassroomDB } from '../services/storage';
import {
  UserCog,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  Copy,
  X,
  BookOpen,
  Shield,
} from 'lucide-react';

interface EditUserAccountModalProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedUser: User) => void;
  courses?: Course[];
}

export const EditUserAccountModal: React.FC<EditUserAccountModalProps> = ({
  user,
  isOpen,
  onClose,
  onSuccess,
  courses,
}) => {
  const currentLoggedUser = ClassroomDB.getCurrentUser();
  const allCourses: Course[] = courses || ClassroomDB.getCourses(currentLoggedUser || user);
  const isEditingSelf = currentLoggedUser?.id === user.id;

  const [name, setName] = useState(user.name || '');
  const [username, setUsername] = useState(user.username || '');
  const [email, setEmail] = useState(user.email || '');
  const [phone, setPhone] = useState(user.phone || '+95 9 ');
  const [title, setTitle] = useState(user.title || '');
  const [gender, setGender] = useState<'male' | 'female'>(
    user.gender === 'female' ? 'female' : 'male'
  );
  const [address, setAddress] = useState(user.address || '');
  const [password, setPassword] = useState(() => ClassroomDB.getDecryptedPassword(user));
  const [showPassword, setShowPassword] = useState(true);
  const [enrolledCourseIds, setEnrolledCourseIds] = useState<string[]>(() =>
    user.role === 'student'
      ? allCourses.filter((c) => c.enrolledStudentIds.includes(user.id)).map((c) => c.id)
      : []
  );

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [copiedNotice, setCopiedNotice] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      const latestCourses: Course[] =
        courses || ClassroomDB.getCourses(ClassroomDB.getCurrentUser() || user);
      setName(user.name || '');
      setUsername(user.username || '');
      setEmail(user.email || '');
      setPhone(user.phone || '+95 9 ');
      setTitle(user.title || '');
      setGender(user.gender === 'female' ? 'female' : 'male');
      setAddress(user.address || '');
      setPassword(ClassroomDB.getDecryptedPassword(user));
      setEnrolledCourseIds(
        user.role === 'student'
          ? latestCourses.filter((c) => c.enrolledStudentIds.includes(user.id)).map((c) => c.id)
          : []
      );
      setErrorMsg(null);
      setSuccessMsg(null);
      setCopiedNotice(false);
    }
  }, [isOpen, user, courses]);

  if (!isOpen) return null;

  const allUsers = ClassroomDB.getAllUsers();
  const cleanUsername = username.trim().replace(/^@+/, '').toLowerCase();
  const cleanEmail = email.trim().toLowerCase();

  const duplicateUsernameOwner = cleanUsername
    ? allUsers.find((u) => u.id !== user.id && u.username.toLowerCase() === cleanUsername)
    : undefined;
  const duplicateEmailOwner = cleanEmail
    ? allUsers.find((u) => u.id !== user.id && u.email.toLowerCase() === cleanEmail)
    : undefined;

  const getOfficialLoginUrl = () => {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      if (host && !host.includes('.run.app') && host !== 'localhost' && host !== '127.0.0.1') {
        return window.location.origin;
      }
    }
    return 'https://www.swanarhclassroom.online';
  };

  const formatCredentialMessage = (targetUser: User, plainPassword: string) => {
    const roleLabel =
      targetUser.role === 'admin'
        ? 'Admin (ဆရာ)'
        : targetUser.role === 'co_admin'
        ? 'Co-Admin (တွဲဖက်ဆရာ)'
        : 'Student (ကျောင်းသား)';
    const enrolledLabels =
      targetUser.role === 'student'
        ? allCourses
            .filter((c) => enrolledCourseIds.includes(c.id))
            .map((c) => c.code)
            .join(', ')
        : 'All Courses (Staff Access)';

    const lines = [
      `🎓 SwanArh Digital Academy (${roleLabel} Login)`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `👤 အမည် (Name): ${targetUser.name}`,
      `🔑 Username: ${targetUser.username}`,
      `🔒 Password: ${plainPassword}`,
    ];
    if (targetUser.title) {
      lines.push(`💼 အလုပ်အကိုင်/ပညာအရည်အချင်း: ${targetUser.title}`);
    }
    if (enrolledLabels) {
      lines.push(`📚 တက်ရောက်ခွင့်ရသည့်အတန်း: ${enrolledLabels}`);
    }
    lines.push(`🌐 Login ဝင်ရန် လင့်ခ် (Login Link):`);
    lines.push(getOfficialLoginUrl());
    lines.push(`━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`📌 သတိပြုရန် အချက်များ -`);
    lines.push(
      `၁။ ကျောင်းသား/သူများသည် Device တစ်ခုတည်းသာ Login ဝင်လို့ရပါမည်။ တခြား Device မှာ အသုံးပြုလိုပါက အရင်ဝင်ထားတဲ့ Device မှ Logout ထွက်ပြီးမှ Login ဝင်လို့ရပါမည်။`
    );
    lines.push(
      `၂။ Login ဝင်ပြီးပါက ပေါ်လာသည့် သင်တန်းစည်းကမ်းချက်များကို သေချာဖတ်ပြီး "သိရှိလိုက်နာပါမည်" ကို ရွေးချယ်ပြီးမှ Classroom ကို ဝင်ရောက်လို့ရပါမည်။`
    );
    lines.push(
      `၃။ သင်တန်းမှ ပထမဆုံးပေးသော Password ကို Classroom ထဲရောက်ပါက မိမိအသုံးပြုမည့် Password ကို ပြန်ချိန်းပြီးမှ သုံးပါ။`
    );
    lines.push(`━━━━━━━━━━━━━━━━━━━━`);
    return lines.join('\n');
  };

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let pass = '';
    for (let i = 0; i < 8; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(pass);
  };

  const toggleCourse = (courseId: string) => {
    setEnrolledCourseIds((prev) =>
      prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId]
    );
  };

  const handleSave = (copyAfterSave: boolean = false) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    const res = ClassroomDB.updateUserAccountInfo(user.id, {
      name,
      username: cleanUsername,
      email: cleanEmail,
      phone,
      title,
      gender,
      address,
      newPassword: password,
      enrolledCourseIds: user.role === 'student' ? enrolledCourseIds : undefined,
    });

    if (!res.success || !res.user) {
      setErrorMsg(res.error || 'အကောင့်အချက်အလက် ပြင်ဆင်ရာတွင် အမှားဖြစ်ပေါ်ခဲ့ပါသည်။');
      return;
    }

    if (copyAfterSave) {
      navigator.clipboard
        .writeText(formatCredentialMessage(res.user, password.trim()))
        .catch(() => {});
      setCopiedNotice(true);
    }

    setSuccessMsg(
      copyAfterSave
        ? `✅ "${res.user.name}" (@${res.user.username}) ၏ အချက်အလက်များကို သိမ်းဆည်းပြီး Login Info ကိုပါ Copy ကူးပြီးပါပြီ!`
        : `✅ "${res.user.name}" (@${res.user.username}) ၏ အကောင့်အချက်အလက်များကို အောင်မြင်စွာ ပြင်ဆင်သိမ်းဆည်းပြီးပါပြီ!`
    );

    onSuccess(res.user);
    setTimeout(() => {
      onClose();
    }, 900);
  };

  const roleBadgeLabel =
    user.role === 'admin'
      ? '🛡️ Lead Mentor (Admin)'
      : user.role === 'co_admin'
      ? '👥 Co-Admin (တွဲဖက် အက်ဒမင်)'
      : '🎓 Student (ကျောင်းသား)';

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/75 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92dvh]">
        {/* Modal Header */}
        <div className="p-4 sm:px-6 sm:py-4 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <UserCog className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate">
                  {isEditingSelf
                    ? '✏️ မိမိအကောင့် အချက်အလက် ပြင်ဆင်ရန် (Edit My Account)'
                    : user.role === 'student'
                    ? '✏️ ကျောင်းသား အကောင့်အချက်အလက် ပြင်ဆင်ရန် (Edit Student Info)'
                    : '✏️ အကောင့် အချက်အလက် ပြင်ဆင်ရန် (Edit Account Info)'}
                </h3>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  {roleBadgeLabel}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate mt-0.5">
                Current: {user.name} (@{user.username}) · {user.email}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-200/70 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer shrink-0"
            title="ပိတ်မည်"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave(false);
          }}
          className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 text-xs"
        >
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 flex items-center gap-2 font-bold">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Row 1: Full Name, Username & Password */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                ၁။ အမည် (Full Name) *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="အမည် ရိုက်ထည့်ပါ"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  ၂။ Username (Login ID) *
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const suggested = ClassroomDB.suggestUsername(name, false);
                    if (suggested) {
                      setUsername(suggested);
                      if (email.endsWith('@swanarh.edu')) {
                        setEmail(`${suggested}@swanarh.edu`);
                      }
                    }
                  }}
                  className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5 cursor-pointer font-semibold"
                  title="အမည်မှ Username အလိုအလျောက် ပြန်ထုတ်ပေးရန်"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Auto</span>
                </button>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono">
                  @
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) =>
                    setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''))
                  }
                  placeholder="username"
                  className={`w-full pl-7 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl font-mono text-slate-900 dark:text-white focus:outline-none ${
                    duplicateUsernameOwner
                      ? 'border-rose-500 ring-2 ring-rose-500/20'
                      : 'border-slate-300 dark:border-slate-700 focus:border-indigo-500'
                  }`}
                  required
                />
              </div>
              {duplicateUsernameOwner && (
                <p className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold mt-1">
                  ⚠️ @{cleanUsername} သည် &ldquo;{duplicateUsernameOwner.name}&rdquo; တွင် ရှိပြီးသားဖြစ်ပါသည်။
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  ၃။ Password (စကားဝှက်) *
                </label>
                <button
                  type="button"
                  onClick={generateRandomPassword}
                  className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5 cursor-pointer font-semibold"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Auto</span>
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 4 chars"
                  className="w-full pl-3 pr-9 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Row 2: Email, Phone & Occupation/Education */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                ၄။ Email *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@swanarh.edu"
                className={`w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl font-mono text-slate-900 dark:text-white focus:outline-none ${
                  duplicateEmailOwner
                    ? 'border-rose-500 ring-2 ring-rose-500/20'
                    : 'border-slate-300 dark:border-slate-700 focus:border-indigo-500'
                }`}
                required
              />
              {duplicateEmailOwner && (
                <p className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold mt-1">
                  ⚠️ ဤ Email သည် &ldquo;{duplicateEmailOwner.name}&rdquo; တွင် ရှိပြီးသားဖြစ်ပါသည်။
                </p>
              )}
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                ၅။ ဖုန်းနံပါတ် (Phone)
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+95 9..."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                ၆။ {user.role === 'student' ? 'အလုပ်အကိုင် / ပညာအရည်အချင်း' : 'ရာထူး / တာဝန် (Title)'}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  user.role === 'student'
                    ? 'ဥပမာ - ကျောင်းသား / B.C.Sc / ဝန်ထမ်း'
                    : 'ဥပမာ - Lead Mentor (Admin) / Co-Admin'
                }
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Row 3: Gender & Address */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                ၇။ ကျား / မ (Gender)
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setGender('male')}
                  className={`py-2 px-2 rounded-xl border font-bold text-xs cursor-pointer transition-all ${
                    gender === 'male'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                  }`}
                >
                  ♂ ကျား (Male)
                </button>
                <button
                  type="button"
                  onClick={() => setGender('female')}
                  className={`py-2 px-2 rounded-xl border font-bold text-xs cursor-pointer transition-all ${
                    gender === 'female'
                      ? 'bg-pink-600 text-white border-pink-600'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                  }`}
                >
                  ♀ မ (Female)
                </button>
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                ၈။ နေရပ်လိပ်စာ (Address)
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="မြို့နယ် / နေရပ်လိပ်စာ..."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Row 4: Class Enrollments (Only when editing a Student account) */}
          {user.role === 'student' && allCourses.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>
                    ၉။ တက်ရောက်ခွင့်ပြုထားသော အတန်းများ ({enrolledCourseIds.length}/
                    {allCourses.length} တန်း)
                  </span>
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEnrolledCourseIds(allCourses.map((c) => c.id))}
                    className="px-2 py-1 text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 rounded-lg cursor-pointer"
                  >
                    အားလုံးရွေးမည် (Select All)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEnrolledCourseIds([])}
                    className="px-2 py-1 text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg cursor-pointer"
                  >
                    အားလုံးဖြုတ်မည် (Clear)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {allCourses.map((course) => {
                  const isChecked = enrolledCourseIds.includes(course.id);
                  return (
                    <button
                      key={course.id}
                      type="button"
                      onClick={() => toggleCourse(course.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                        isChecked
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-950 dark:text-emerald-100'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                          isChecked
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600'
                        }`}
                      >
                        {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-xs truncate">
                          {course.code} · {course.title}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate">{course.batch}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {user.role === 'co_admin' && (
            <div className="p-2.5 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60 text-[11px] text-purple-900 dark:text-purple-200 flex items-center gap-2">
              <Shield className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
              <span>
                Co-Admin အကောင့်များအတွက် Profile ဓာတ်ပုံ စနစ်ကို ပိတ်ထားပြီး အတန်းအားလုံးသို့ ဝင်ရောက်စီမံခွင့် ရရှိထားပါသည်။
              </span>
            </div>
          )}

          {/* Footer Action Buttons */}
          <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold cursor-pointer"
            >
              မလုပ်တော့ပါ (Cancel)
            </button>

            <button
              type="button"
              onClick={() => handleSave(true)}
              disabled={Boolean(duplicateUsernameOwner || duplicateEmailOwner)}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer shadow-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              {copiedNotice ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>သိမ်းဆည်းပြီး Login Info Copy ကူးမည်</span>
            </button>

            <button
              type="submit"
              disabled={Boolean(duplicateUsernameOwner || duplicateEmailOwner)}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer shadow-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>ပြင်ဆင်မှု သိမ်းဆည်းမည် (Save Changes)</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
