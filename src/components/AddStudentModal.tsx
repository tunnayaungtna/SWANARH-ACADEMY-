import React, { useState, useRef } from 'react';
import { Course, User } from '../types/classroom';
import { ClassroomDB } from '../services/storage';
import { SupabaseService } from '../services/supabase';
import { PRESET_AVATARS } from '../data/presetAvatars';
import { useBackHandler } from '../utils/backNavigation';
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
  Sparkles,
  BookOpen,
  Mail,
  Phone,
  Briefcase,
  MapPin,
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
  useBackHandler(isOpen, onClose);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState<'existing' | 'new'>('existing');
  const [searchQuery, setSearchQuery] = useState('');
  const [, setRefreshTick] = useState(0);
  const [revealedExistingPasswords, setRevealedExistingPasswords] = useState<Record<string, boolean>>({});
  const [copiedExistingUserId, setCopiedExistingUserId] = useState<string | null>(null);

  const allUsers = ClassroomDB.getAllUsers();
  const currentUser = ClassroomDB.getCurrentUser();
  const availableCourses = currentUser ? ClassroomDB.getCourses(currentUser) : [course];
  const latestCurrentCourse = availableCourses.find((c) => c.id === course.id) || course;

  const unenrolledStudents = allUsers.filter(
    (u) => u.role === 'student' && !latestCurrentCourse.enrolledStudentIds.includes(u.id)
  );

  const filteredUnenrolled = unenrolledStudents.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const [newName, setNewName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newGender, setNewGender] = useState<'male' | 'female' | 'other'>('male');
  const [newAddress, setNewAddress] = useState('');
  const [smartPasteBox, setSmartPasteBox] = useState('');
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([course.id]);
  const [newPassword, setNewPassword] = useState('student123');
  const [newAvatar] = useState(PRESET_AVATARS[0].url);
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

  const STUDENT_FORM_TEMPLATE = `အမည်(Full Name): 
Email: 
ဖုန်းနံပါတ်(Phone): 
အလုပ်အကိုင်/ပညာအရည်အချင်း: 
ကျား/မ(Gender): 
နေရပ်လိပ်စာ(Address): `;

  const buildStudentCredentialMessage = (info: {
    name: string;
    username: string;
    password: string;
    occupation?: string;
    coursesLabel: string;
  }): string => {
    const loginUrl =
      typeof window !== 'undefined' &&
      window.location.hostname &&
      !window.location.hostname.includes('.run.app') &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1'
        ? window.location.origin
        : 'https://www.swanarhclassroom.online';

    const lines = [
      `🎓 SwanArh Digital Academy (Student (ကျောင်းသား) Login)`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `👤 အမည် (Name): ${info.name}`,
      `🔑 Username: ${info.username}`,
      `🔒 Password: ${info.password}`,
    ];
    if (info.occupation) {
      lines.push(`💼 အလုပ်အကိုင်/ပညာအရည်အချင်း: ${info.occupation}`);
    }
    if (info.coursesLabel) {
      lines.push(`📚 တက်ရောက်ခွင့်ရသည့်အတန်း: ${info.coursesLabel}`);
    }
    lines.push(`🌐 Login ဝင်ရန် လင့်ခ် (Login Link):`);
    lines.push(loginUrl);
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

  const normalizeMyanmarPhone = (val: string): string => {
    const mmDigits: Record<string, string> = {
      '၀': '0',
      '၁': '1',
      '၂': '2',
      '၃': '3',
      '၄': '4',
      '၅': '5',
      '၆': '6',
      '၇': '7',
      '၈': '8',
      '၉': '9',
    };
    return val.replace(/[၀-၉]/g, (d) => mmDigits[d] || d).trim();
  };

  const applySmartAutoFill = (rawText: string) => {
    setSmartPasteBox(rawText);
    const trimmed = rawText.trim();
    if (!trimmed) return;

    const lines = trimmed
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    let name = '';
    let email = '';
    let phone = '';
    let occupation = '';
    let gender: 'male' | 'female' | null = null;
    let address = '';

    for (const line of lines) {
      const cleanLine = line.replace(/^[\d၀-၉]+[.)\-]\s*/, '').trim();
      const colonIdx = cleanLine.search(/[:：=]/);
      if (colonIdx !== -1) {
        const key = cleanLine.slice(0, colonIdx).trim().toLowerCase();
        const val = cleanLine.slice(colonIdx + 1).trim();
        if (!val) continue;

        if (key.includes('အမည်') || key.includes('name') || key.includes('နာမည်')) {
          name = val;
        } else if (key.includes('email') || key.includes('အီးမေး') || key.includes('mail')) {
          email = val;
        } else if (key.includes('ဖုန်း') || key.includes('phone') || key.includes('ph') || key.includes('ဆက်သွယ်ရန်')) {
          phone = normalizeMyanmarPhone(val);
        } else if (
          key.includes('အလုပ်အကိုင်') ||
          key.includes('ပညာအရည်အချင်း') ||
          key.includes('occupation') ||
          key.includes('education') ||
          key.includes('job') ||
          key.includes('title')
        ) {
          occupation = val;
        } else if (key.includes('ကျား') || key.includes('မ') || key.includes('gender') || key.includes('sex')) {
          const vLow = val.toLowerCase();
          if (vLow.includes('မ') || vLow.includes('female') || vLow === 'f' || vLow.includes('woman') || vLow.includes('girl')) {
            gender = 'female';
          } else if (vLow.includes('ကျား') || vLow.includes('male') || vLow === 'm' || vLow.includes('man') || vLow.includes('boy')) {
            gender = 'male';
          }
        } else if (key.includes('လိပ်စာ') || key.includes('နေရပ်') || key.includes('address') || key.includes('မြို့')) {
          address = val;
        }
      }
    }

    if (!name && lines.length === 1) {
      const parts = lines[0].split(/[,，|\t;]+/).map((p) => p.trim()).filter(Boolean);
      for (const p of parts) {
        const normP = normalizeMyanmarPhone(p);
        if (p.includes('@') && p.includes('.')) {
          email = p.toLowerCase();
        } else if (/^(\+?95|09|\d{7,12})/.test(normP.replace(/[\s-]/g, ''))) {
          phone = normP;
        } else if (['ကျား', 'male', 'm'].includes(p.toLowerCase())) {
          gender = 'male';
        } else if (['မ', 'female', 'f'].includes(p.toLowerCase())) {
          gender = 'female';
        } else if (!name) {
          name = p;
        } else if (!occupation) {
          occupation = p;
        } else if (!address) {
          address = p;
        }
      }
    }

    if (name) {
      setNewName(name);
      // Use base username first so if an existing student has this username, it is immediately detected and shown
      const baseSuggested = ClassroomDB.suggestUsername(name, false);
      setNewUsername(baseSuggested);
      if (!email) {
        setNewEmail(`${baseSuggested}@swanarh.edu`);
      }
    }
    if (email) setNewEmail(email.toLowerCase().replace(/\s+/g, ''));
    if (phone) setNewPhone(phone);
    if (occupation) setNewTitle(occupation);
    if (gender) setNewGender(gender);
    if (address) setNewAddress(address);
  };

  const toggleCourseSelection = (cId: string) => {
    setSelectedCourseIds((prev) =>
      prev.includes(cId) ? prev.filter((id) => id !== cId) : [...prev, cId]
    );
  };

  const handleEnrollExisting = (studentId: string, studentName: string) => {
    ClassroomDB.enrollStudent(course.id, studentId);
    setSuccessMessage(`ကျောင်းသား ${studentName} ကို ${course.code} အတန်းထဲသို့ အောင်မြင်စွာ ထည့်သွင်းပြီးပါပြီ။`);
    setRefreshTick((t) => t + 1);
    onStudentEnrolled();
    setTimeout(() => {
      setSuccessMessage(null);
    }, 3000);
  };

  // Live check if typed Username or Email already belongs to an existing account
  const normalizedUsernameCheck = newUsername.trim().toLowerCase().replace(/\s+/g, '');
  const normalizedEmailCheck = newEmail.trim().toLowerCase().replace(/\s+/g, '');

  const existingByUsername: User | undefined = normalizedUsernameCheck
    ? allUsers.find((u) => u.username.toLowerCase() === normalizedUsernameCheck)
    : undefined;

  const existingByEmail: User | undefined = normalizedEmailCheck
    ? allUsers.find((u) => u.email.toLowerCase() === normalizedEmailCheck)
    : undefined;

  const existingMatchedUsers: Array<{ user: User; reason: string }> = [];
  if (existingByUsername) {
    const alsoEmailMatch = existingByEmail && existingByEmail.id === existingByUsername.id;
    existingMatchedUsers.push({
      user: existingByUsername,
      reason: alsoEmailMatch
        ? `Username (@${existingByUsername.username}) နှင့် Email (${existingByUsername.email}) နှစ်ခုလုံး ရှိပြီးသားဖြစ်နေပါသည်`
        : `Username (@${existingByUsername.username}) သည် ရှိပြီးသားအကောင့်ဖြစ်နေပါသည်`,
    });
  }
  if (existingByEmail && (!existingByUsername || existingByEmail.id !== existingByUsername.id)) {
    existingMatchedUsers.push({
      user: existingByEmail,
      reason: `Email (${existingByEmail.email}) သည် ရှိပြီးသားအကောင့်ဖြစ်နေပါသည်`,
    });
  }

  const handleToggleExistingUserCourse = (targetUser: User, targetCourse: Course, isCurrentlyEnrolled: boolean) => {
    if (isCurrentlyEnrolled) {
      ClassroomDB.unenrollStudent(targetCourse.id, targetUser.id);
      setSuccessMessage(
        `🔄 "${targetUser.name}" (@${targetUser.username}) ကို ${targetCourse.code} အတန်းမှ ဖယ်ရှားပြီးပါပြီ။`
      );
    } else {
      ClassroomDB.enrollStudent(targetCourse.id, targetUser.id);
      setSuccessMessage(
        `✅ "${targetUser.name}" (@${targetUser.username}) ကို ${targetCourse.code} (${targetCourse.title}) အတန်းထဲသို့ ထည့်သွင်းပြီးပါပြီ!`
      );
    }
    setFormError(null);
    setRefreshTick((t) => t + 1);
    onStudentEnrolled();
  };

  const handleEnrollExistingUserInSelectedCourses = (targetUser: User) => {
    const targets = selectedCourseIds.length > 0 ? selectedCourseIds : [course.id];
    const addedCodes: string[] = [];
    targets.forEach((cId) => {
      const cObj = availableCourses.find((c) => c.id === cId);
      if (cObj && !cObj.enrolledStudentIds.includes(targetUser.id)) {
        ClassroomDB.enrollStudent(cId, targetUser.id);
        addedCodes.push(cObj.code);
      }
    });
    setFormError(null);
    setRefreshTick((t) => t + 1);
    onStudentEnrolled();
    if (addedCodes.length > 0) {
      setSuccessMessage(
        `✅ ရှိပြီးသားအကောင့် "${targetUser.name}" (@${targetUser.username}) ကို (${addedCodes.join(', ')}) အတန်းထဲသို့ တိုက်ရိုက် ထည့်သွင်းပေးပြီးပါပြီ!`
      );
    } else {
      setSuccessMessage(
        `ℹ️ "${targetUser.name}" (@${targetUser.username}) သည် ရွေးထားသောအတန်းထဲတွင် ရှိပြီးသားဖြစ်ပါသည်။`
      );
    }
  };

  const renderExistingAccountCard = (targetUser: User, reasonLabel: string) => {
    const enrolledCoursesForUser = availableCourses.filter((c) =>
      c.enrolledStudentIds.includes(targetUser.id)
    );
    const isProtectedAdmin = currentUser?.role === 'co_admin' && targetUser.role === 'admin';
    const plainPwd = isProtectedAdmin ? 'Protected' : ClassroomDB.getDecryptedPassword(targetUser);
    const isPwdShown = !isProtectedAdmin && Boolean(revealedExistingPasswords[targetUser.id]);
    const isCopiedThis = copiedExistingUserId === targetUser.id;
    const targetsToCheck = selectedCourseIds.length > 0 ? selectedCourseIds : [course.id];
    const missingSelectedCourses = availableCourses.filter(
      (c) => targetsToCheck.includes(c.id) && !c.enrolledStudentIds.includes(targetUser.id)
    );
    const uniqueAlternativeUsername = ClassroomDB.suggestUsername(
      newName.trim() || targetUser.username,
      true
    );

    return (
      <div
        key={targetUser.id}
        className="p-3.5 rounded-xl bg-amber-50/95 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-700/80 space-y-3 text-xs shadow-xs"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-amber-950 dark:text-amber-200">
                ⚠️ {reasonLabel}
              </div>
              <div className="text-[11px] text-amber-800 dark:text-amber-300/90 mt-0.5">
                အကောင့်ထပ်ဖွင့်စရာမလိုဘဲ ဤနေရာမှပင် အချက်အလက်ကြည့်ရှုပြီး အတန်းများ တိုက်ရိုက် ထည့်/ဖြုတ် နိုင်ပါသည်။
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              const enrolledLabel =
                enrolledCoursesForUser.map((c) => `${c.code} (${c.title})`).join(', ') ||
                course.code;
              navigator.clipboard.writeText(
                buildStudentCredentialMessage({
                  name: targetUser.name,
                  username: targetUser.username,
                  password: plainPwd,
                  occupation: targetUser.title,
                  coursesLabel: enrolledLabel,
                })
              );
              setCopiedExistingUserId(targetUser.id);
              setTimeout(() => setCopiedExistingUserId(null), 2500);
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold shadow-2xs transition-colors cursor-pointer shrink-0"
          >
            {isCopiedThis ? <CheckCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{isCopiedThis ? 'Copied!' : 'Login Info Copy ကူးမည်'}</span>
          </button>
        </div>

        {/* Account Details Box */}
        <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-200/80 dark:border-slate-800 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                {targetUser.name}
              </span>
              <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800">
                @{targetUser.username}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {targetUser.role === 'admin'
                  ? 'Admin'
                  : targetUser.role === 'co_admin'
                  ? 'Co-Admin'
                  : 'ကျောင်းသား (Student)'}
              </span>
              {targetUser.gender && (
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    targetUser.gender === 'female'
                      ? 'bg-pink-50 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300'
                      : 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300'
                  }`}
                >
                  {targetUser.gender === 'female' ? '♀ မ (Female)' : '♂ ကျား (Male)'}
                </span>
              )}
              {targetUser.role === 'student' && (
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    targetUser.rulesAccepted
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                      : 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300'
                  }`}
                >
                  {targetUser.rulesAccepted ? '✅ စည်းကမ်းသိရှိပြီး' : '⏳ စည်းကမ်းမဖတ်ရသေး'}
                </span>
              )}
            </div>

            {/* Password viewer */}
            <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] text-slate-400">Password:</span>
              <span className="font-mono font-bold text-[11px] text-emerald-700 dark:text-emerald-400">
                {isPwdShown ? plainPwd : '••••••••'}
              </span>
              <button
                type="button"
                onClick={() =>
                  setRevealedExistingPasswords((prev) => ({
                    ...prev,
                    [targetUser.id]: !prev[targetUser.id],
                  }))
                }
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 ml-0.5 cursor-pointer"
                title={isPwdShown ? 'Hide Password' : 'Show Password'}
              >
                {isPwdShown ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-slate-600 dark:text-slate-300 pt-1 border-t border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center gap-1.5 truncate">
              <Mail className="w-3 h-3 text-slate-400 shrink-0" />
              <span className="font-mono truncate">{targetUser.email}</span>
            </div>
            <div className="flex items-center gap-1.5 truncate">
              <Phone className="w-3 h-3 text-slate-400 shrink-0" />
              <span className="font-mono truncate">{targetUser.phone || 'ဖုန်းမထည့်ရသေးပါ'}</span>
            </div>
            {targetUser.title && (
              <div className="flex items-center gap-1.5 truncate">
                <Briefcase className="w-3 h-3 text-slate-400 shrink-0" />
                <span className="truncate">{targetUser.title}</span>
              </div>
            )}
            {targetUser.address && (
              <div className="flex items-center gap-1.5 truncate">
                <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                <span className="truncate">{targetUser.address}</span>
              </div>
            )}
          </div>
        </div>

        {/* Currently Joined Classes + Interactive Class Editor */}
        {targetUser.role === 'student' && (
          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900/60 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span className="font-bold text-slate-900 dark:text-slate-100 text-[11px]">
                  📚 လက်ရှိ Join ထားသော အတန်းများ ({enrolledCoursesForUser.length} တန်း)
                </span>
              </div>

              {missingSelectedCourses.length > 0 && (
                <button
                  type="button"
                  onClick={() => handleEnrollExistingUserInSelectedCourses(targetUser)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-2xs transition-colors cursor-pointer"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>
                    ➕ ရွေးထားသော ({missingSelectedCourses.map((c) => c.code).join(', ')}) အတန်းထဲ တန်းထည့်မည်
                  </span>
                </button>
              )}
            </div>

            {enrolledCoursesForUser.length === 0 ? (
              <div className="text-[11px] text-rose-600 dark:text-rose-400 font-medium bg-rose-50/70 dark:bg-rose-950/30 px-2.5 py-1.5 rounded-lg border border-rose-200/60 dark:border-rose-900/50">
                မည်သည့်အတန်းမှ Join မထားရသေးပါ။ အောက်ပါအတန်းခလုတ်များကို နှိပ်၍ အတန်းထည့်ပေးနိုင်ပါသည်။
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {enrolledCoursesForUser.map((c) => (
                  <span
                    key={c.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                  >
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                    <span>
                      {c.code} · {c.title} ({c.batch})
                    </span>
                  </span>
                ))}
              </div>
            )}

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-1">
                <span className="text-[11px] font-bold text-indigo-950 dark:text-indigo-200">
                  ✏️ အတန်းများ တိုက်ရိုက် ထည့် / ဖြုတ် လုပ်ရန် (နှိပ်၍ ပြင်နိုင်သည်) -
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      availableCourses.forEach((c) => {
                        if (!c.enrolledStudentIds.includes(targetUser.id)) {
                          ClassroomDB.enrollStudent(c.id, targetUser.id);
                        }
                      });
                      setRefreshTick((t) => t + 1);
                      onStudentEnrolled();
                      setSuccessMessage(
                        `✅ "${targetUser.name}" ကို အတန်းအားလုံး (${availableCourses.length} တန်း) ထဲသို့ ထည့်သွင်းပြီးပါပြီ!`
                      );
                    }}
                    className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 cursor-pointer"
                  >
                    + အတန်းအားလုံးထည့်မည်
                  </button>
                  {enrolledCoursesForUser.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        availableCourses.forEach((c) => {
                          if (c.enrolledStudentIds.includes(targetUser.id)) {
                            ClassroomDB.unenrollStudent(c.id, targetUser.id);
                          }
                        });
                        setRefreshTick((t) => t + 1);
                        onStudentEnrolled();
                        setSuccessMessage(
                          `🔄 "${targetUser.name}" ကို အတန်းအားလုံးမှ ဖယ်ရှားပြီးပါပြီ။`
                        );
                      }}
                      className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 hover:bg-rose-100 cursor-pointer"
                    >
                      အတန်းအားလုံးဖြုတ်မည်
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {availableCourses.map((c) => {
                  const isEnrolled = c.enrolledStudentIds.includes(targetUser.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleToggleExistingUserCourse(targetUser, c, isEnrolled)}
                      className={`p-2 rounded-lg border text-left flex items-center justify-between gap-2 transition-all cursor-pointer ${
                        isEnrolled
                          ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500 text-emerald-950 dark:text-emerald-100 shadow-2xs'
                          : 'bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-400'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-[11px] truncate">
                          {c.code} · {c.title}
                        </div>
                        <div className="text-[10px] opacity-75 truncate">{c.batch}</div>
                      </div>
                      <span
                        className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-bold ${
                          isEnrolled
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {isEnrolled ? '✓ Joined (ဖြုတ်ရန်)' : '+ Join (ထည့်ရန်)'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Option if this is actually a different new student who happens to share the same name */}
        {existingByUsername && existingByUsername.id === targetUser.id && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-amber-900 dark:text-amber-200">
            <span>နာမည်တူ ကျောင်းသားအသစ် ဖြစ်ပါသလား?</span>
            <button
              type="button"
              onClick={() => {
                setNewUsername(uniqueAlternativeUsername);
                if (!newEmail || newEmail.endsWith('@swanarh.edu')) {
                  setNewEmail(`${uniqueAlternativeUsername}@swanarh.edu`);
                }
                setFormError(null);
              }}
              className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-amber-400 dark:border-amber-600 font-bold text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              ✨ လူသစ်ဖြစ်ပါက @{uniqueAlternativeUsername} သို့ ပြောင်း၍ အကောင့်သစ်ဖွင့်မည်
            </button>
          </div>
        )}
      </div>
    );
  };

  const executeCreateAndEnroll = (autoCopyAfterCreate: boolean) => {
    const cleanName = newName.trim();
    const cleanUsername = (newUsername.trim() || ClassroomDB.suggestUsername(cleanName)).toLowerCase().replace(/\s+/g, '');
    const cleanEmail = (newEmail.trim() || `${cleanUsername}@swanarh.edu`).toLowerCase().replace(/\s+/g, '');

    if (!cleanName || !cleanUsername) {
      setFormError('ကျေးဇူးပြု၍ ကျောင်းသားအမည် ဖြည့်စွက်ပေးပါ။');
      return;
    }

    if (!newPassword.trim() || newPassword.trim().length < 4) {
      setFormError('App Login Password သည် အနည်းဆုံး ၄ လုံး ရှိရပါမည်။');
      return;
    }

    const targetCourses = selectedCourseIds.length > 0 ? selectedCourseIds : [course.id];

    setFormError(null);
    const result = ClassroomDB.registerNewStudent({
      name: cleanName,
      username: cleanUsername,
      password: newPassword.trim(),
      email: cleanEmail,
      phone: newPhone.trim() || '+95 9 790 000000',
      avatar: newAvatar,
      title: newTitle.trim() || undefined,
      gender: newGender,
      address: newAddress.trim() || undefined,
      initialCourseIds: targetCourses,
    });

    if (result.error) {
      setFormError(result.error);
      return;
    }

    if (result.student) {
      SupabaseService.signUpWithSupabase(cleanEmail, newPassword.trim(), {
        id: result.student.id,
        name: result.student.name,
        username: result.student.username,
        role: 'student',
        phone: result.student.phone,
        avatar: result.student.avatar,
        title: result.student.title,
        gender: newGender,
        address: result.student.address,
      }).catch(() => {});
    }

    const enrolledCourseCodes = availableCourses
      .filter((c) => targetCourses.includes(c.id))
      .map((c) => c.code)
      .join(', ');

    const finalCoursesLabel = enrolledCourseCodes || course.code;

    setCreatedDetails({
      name: cleanName,
      username: cleanUsername,
      password: newPassword.trim(),
      coursesLabel: finalCoursesLabel,
    });

    if (autoCopyAfterCreate) {
      navigator.clipboard.writeText(
        buildStudentCredentialMessage({
          name: cleanName,
          username: cleanUsername,
          password: newPassword.trim(),
          occupation: newTitle.trim() || undefined,
          coursesLabel: finalCoursesLabel,
        })
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }

    setSuccessMessage(
      autoCopyAfterCreate
        ? `✅ "${cleanName}" (@${cleanUsername}) အကောင့် ဖန်တီးပြီး Login အချက်အလက်များကို Clipboard ထဲသို့ Auto Copy ကူးယူပြီးပါပြီ!`
        : `ကျောင်းသားအသစ် "${cleanName}" (@${cleanUsername}) အတွက် Login အကောင့် ဖန်တီးပြီး (${finalCoursesLabel}) အတန်းများထဲသို့ တစ်ပြိုင်တည်း ထည့်သွင်းပြီးပါပြီ!`
    );

    // Reset form fields
    setNewName('');
    setNewUsername('');
    setNewEmail('');
    setNewPhone('');
    setNewTitle('');
    setNewGender('male');
    setNewAddress('');
    setSmartPasteBox('');
    setSelectedCourseIds([course.id]);
    setNewPassword('student123');

    onStudentEnrolled();
    setTimeout(() => {
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }, 60);
  };

  const handleCreateAndEnroll = (e: React.FormEvent) => {
    e.preventDefault();
    executeCreateAndEnroll(false);
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
        <div
          ref={scrollContainerRef}
          className="overflow-y-auto flex-1 min-h-0 p-4 sm:p-6 space-y-4"
        >
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
                  filteredUnenrolled.map((student) => {
                    const joinedCourses = availableCourses.filter((c) =>
                      c.enrolledStudentIds.includes(student.id)
                    );
                    return (
                      <div
                        key={student.id}
                        className="p-3 flex items-center justify-between gap-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 flex-wrap">
                            <span>{student.name}</span>
                            {student.rulesAccepted && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                                <Check className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400 stroke-[3]" />
                                <span>သိရှိ လိုက်နာပါမည်</span>
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
                            @{student.username} · {student.email}
                          </div>
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="text-[10px] text-slate-400">Join ထားသောအတန်း:</span>
                            {joinedCourses.length === 0 ? (
                              <span className="text-[10px] text-rose-500">မရှိသေးပါ</span>
                            ) : (
                              joinedCourses.map((jc) => (
                                <span
                                  key={jc.id}
                                  className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                                >
                                  {jc.code}
                                </span>
                              ))
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleEnrollExisting(student.id, student.name)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium shadow-2xs transition-colors cursor-pointer shrink-0"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Enroll</span>
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Tab 2: Create New Student with Login Access & Smart Auto-Fill */}
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
                          buildStudentCredentialMessage({
                            name: createdDetails.name,
                            username: createdDetails.username,
                            password: createdDetails.password,
                            coursesLabel: createdDetails.coursesLabel || course.code,
                          })
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
                  <div className="p-2 rounded-lg bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 text-[10px] text-amber-950 dark:text-amber-200 space-y-0.5 leading-snug">
                    <div className="font-bold">📌 Copy ကူးယူရာတွင် တစ်ပါတည်း ပါဝင်မည့် လမ်းညွှန်ချက်များ -</div>
                    <div>၁။ Device တစ်ခုတည်းသာ Login ဝင်လို့ရပါမည် (အခြား Device ပြောင်းလိုပါက အရင် Logout ထွက်ရမည်)</div>
                    <div>၂။ သင်တန်းစည်းကမ်းချက်များကို ဖတ်ပြီး "သိရှိလိုက်နာပါမည်" ရွေးချယ်ရမည်</div>
                    <div>၃။ ပထမဆုံးပေးသော Password ကို မိမိအသုံးပြုမည့် Password သို့ ပြန်ချိန်းပြီးမှ သုံးရမည်</div>
                  </div>
                </div>
              )}

              {/* Smart Student Registration Form Auto-Filler */}
              <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/70 rounded-xl space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span className="text-[11px] font-bold text-indigo-950 dark:text-indigo-200">
                      ⚡ Smart Auto-Fill (ကျောင်းသားပို့သော Form ကို တန်းဖြည့်ရန်)
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(STUDENT_FORM_TEMPLATE);
                        setSuccessMessage('📋 ကျောင်းသားထံ ပို့ပေးရမည့် Form ပုံစံကို Copy ကူးယူပြီးပါပြီ!');
                        setTimeout(() => setSuccessMessage(null), 3000);
                      }}
                      className="text-[10px] font-bold px-2 py-1 rounded-lg bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700 hover:bg-indigo-50 cursor-pointer"
                    >
                      📋 Form ပုံစံ Copy ကူးမည်
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const clip = await navigator.clipboard.readText();
                          if (clip && clip.trim()) {
                            applySmartAutoFill(clip);
                            setSuccessMessage('✨ Clipboard မှ အချက်အလက်များကို သက်ဆိုင်ရာ အကွက်များထဲသို့ Auto ဖြည့်သွင်းပြီးပါပြီ!');
                            setTimeout(() => setSuccessMessage(null), 3000);
                          }
                        } catch {
                          setFormError('အောက်ပါအကွက်ထဲတွင် တိုက်ရိုက် Paste (Ctrl+V) ချပေးပါ။');
                        }
                      }}
                      className="text-[10px] font-bold px-2 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
                    >
                      📥 Clipboard မှ တန်းဖြည့်မည်
                    </button>
                  </div>
                </div>
                <textarea
                  rows={2}
                  value={smartPasteBox}
                  onChange={(e) => applySmartAutoFill(e.target.value)}
                  placeholder="ကျောင်းသားပြန်ပို့သော Form စာသားကို ဤနေရာတွင် Paste ချလိုက်ပါက အောက်ရှိအကွက်များအားလုံး သူ့ဘာသာ Auto ဖြည့်ပေးပါမည်..."
                  className="w-full px-2.5 py-1.5 text-[11px] bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-lg text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

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
                        const val = e.target.value;
                        setNewName(val);
                        const baseSuggested = ClassroomDB.suggestUsername(val, false);
                        setNewUsername(baseSuggested);
                        if (!newEmail || newEmail.endsWith('@swanarh.edu')) {
                          setNewEmail(`${baseSuggested}@swanarh.edu`);
                        }
                      }}
                      placeholder="e.g. မောင်အောင်မင်း / Aung Min"
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
                      placeholder="e.g. aungmin"
                      className={`w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 font-mono focus:outline-hidden ${
                        existingByUsername
                          ? 'border-amber-500 dark:border-amber-500 focus:border-amber-600'
                          : 'border-slate-300 dark:border-slate-700 focus:border-indigo-500'
                      }`}
                      required
                    />
                  </div>
                </div>

                {/* Live Existing Account Card (shows details, joined classes, and allows adding/removing classes right here) */}
                {existingMatchedUsers.length > 0 && (
                  <div className="space-y-2.5">
                    {existingMatchedUsers.map(({ user, reason }) =>
                      renderExistingAccountCard(user, reason)
                    )}
                  </div>
                )}

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
                      Student Email (မရှိပါက Auto ဖြည့်ပေးပါမည်)
                    </label>
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="student@swanarh.edu"
                      className={`w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden ${
                        existingByEmail
                          ? 'border-amber-500 dark:border-amber-500 focus:border-amber-600'
                          : 'border-slate-300 dark:border-slate-700 focus:border-indigo-500'
                      }`}
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
                      အလုပ်အကိုင် / ပညာအရည်အချင်း
                    </label>
                    <input
                      type="text"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="ဥပမာ - B.C.Sc / ကျောင်းသား"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                      Address (နေရပ်လိပ်စာ)
                    </label>
                    <input
                      type="text"
                      value={newAddress}
                      onChange={(e) => setNewAddress(e.target.value)}
                      placeholder="ဥပမာ - ကမာရွတ်မြို့နယ်၊ ရန်ကုန်မြို့"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500"
                    />
                  </div>
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

                <div className="pt-2 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3.5 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    Create ({selectedCourseIds.length || 1} Classes)
                  </button>
                  <button
                    type="button"
                    onClick={() => executeCreateAndEnroll(true)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>⚡ အကောင့်ဖွင့်ပြီး Login Info တန်း Copy ကူးမည်</span>
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
