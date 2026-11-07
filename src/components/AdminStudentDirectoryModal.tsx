import React, { useState, useRef } from 'react';
import { Course, User, UserRole } from '../types/classroom';
import { ClassroomDB } from '../services/storage';
import { SupabaseService } from '../services/supabase';
import { ProfilePictureModal } from './ProfilePictureModal';
import { useBackHandler } from '../utils/backNavigation';
import {
  Users,
  UserPlus,
  Search,
  Check,
  AlertCircle,
  Lock,
  Eye,
  EyeOff,
  Copy,
  Sparkles,
  Trash2,
  Shield,
  ShieldCheck,
  GraduationCap,
  RefreshCw,
  Upload,
  Camera,
  Download,
  CalendarCheck,
  BookOpen,
  KeyRound,
  X,
  FileSpreadsheet,
} from 'lucide-react';

import { PRESET_AVATARS as SHARED_PRESET_AVATARS } from '../data/presetAvatars';

const PRESET_AVATARS = SHARED_PRESET_AVATARS.slice(0, 5);

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
  const [roleFilter, setRoleFilter] = useState<'all' | 'staff' | 'student'>('all');
  const [ruleStatusFilter, setRuleStatusFilter] = useState<'all' | 'accepted' | 'pending'>('all');
  const [courseFilterId, setCourseFilterId] = useState<string>('all');
  const [visibleLimit, setVisibleLimit] = useState<number>(60);
  const [showNewForm, setShowNewForm] = useState(false);
  const [showReportsDrawer, setShowReportsDrawer] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>('student');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [isUsernameManuallyEdited, setIsUsernameManuallyEdited] = useState(false);
  const [email, setEmail] = useState('');
  const [isEmailManuallyEdited, setIsEmailManuallyEdited] = useState(false);
  const [phone, setPhone] = useState('+95 9 ');
  const [password, setPassword] = useState('student123');
  const [title, setTitle] = useState('');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [address, setAddress] = useState('');
  const [avatar, setAvatar] = useState(PRESET_AVATARS[0].url);
  const [showPassword, setShowPassword] = useState(true);
  const [selectedInitialCourses, setSelectedInitialCourses] = useState<string[]>(
    courses[0]?.id ? [courses[0].id] : []
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [selectedCsvCourseId, setSelectedCsvCourseId] = useState<string>(courses[0]?.id || 'all');
  const [auditFilterMode, setAuditFilterMode] = useState<'accepted_only' | 'all'>('accepted_only');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Profile Picture Editing Modal state
  const [editingAvatarUser, setEditingAvatarUser] = useState<User | null>(null);

  // Revealed passwords in directory table
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});

  // Admin password reset modal state
  const [resettingUser, setResettingUser] = useState<User | null>(null);
  const [newUserPassword, setNewUserPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);

  // Delete user confirmation state
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  // Step-by-step mobile Back button handlers for nested sub-dialogs
  useBackHandler(!!editingAvatarUser, () => setEditingAvatarUser(null));
  useBackHandler(!!resettingUser, () => setResettingUser(null));
  useBackHandler(!!userToDelete, () => setUserToDelete(null));
  useBackHandler(showNewForm, () => setShowNewForm(false));

  // Newly created user credentials display (Single Mode)
  const [createdCredentials, setCreatedCredentials] = useState<{
    name: string;
    username: string;
    password: string;
    role: UserRole;
    occupation?: string;
    courseName?: string;
    gender?: string;
    address?: string;
    loginUrl: string;
  } | null>(null);
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  // Quick Text Paste Mode & Smart Student Form Auto-Fill
  const [createEntryMode, setCreateEntryMode] = useState<'single' | 'paste'>('single');
  const [singleSmartPasteText, setSingleSmartPasteText] = useState('');
  const [singleAutoFilledNotice, setSingleAutoFilledNotice] = useState<string | null>(null);
  const [copiedTemplateNotice, setCopiedTemplateNotice] = useState(false);
  const [autoCopyAfterSingleCreate, setAutoCopyAfterSingleCreate] = useState(false);
  const [pasteRawText, setPasteRawText] = useState('');
  const [pastePasswordMode, setPastePasswordMode] = useState<'shared' | 'random'>('shared');
  const [pasteSharedPassword, setPasteSharedPassword] = useState('student123');
  const [pasteDefaultOccupation, setPasteDefaultOccupation] = useState('');
  const [batchCreatedCredentials, setBatchCreatedCredentials] = useState<
    Array<{
      id: string;
      name: string;
      username: string;
      password: string;
      role: UserRole;
      email?: string;
      occupation?: string;
      phone?: string;
      gender?: string;
      address?: string;
      courseName?: string;
      loginUrl: string;
    }>
  >([]);
  const [copiedBatchIds, setCopiedBatchIds] = useState<Record<string, boolean>>({});
  const [copiedAllBatchSuccess, setCopiedAllBatchSuccess] = useState(false);

  const getOfficialLoginUrl = () => {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      if (host && !host.includes('.run.app') && host !== 'localhost' && host !== '127.0.0.1') {
        return window.location.origin;
      }
    }
    return 'https://www.swanarhclassroom.online';
  };

  if (!isOpen) return null;

  const currentLoggedUser = ClassroomDB.getCurrentUser();
  const isCoAdminSession = currentLoggedUser?.role === 'co_admin';

  const allUsers = ClassroomDB.getAllUsers();
  const staffUsers = allUsers.filter((u) => u.role === 'admin' || u.role === 'co_admin');
  const studentUsers = allUsers.filter((u) => u.role === 'student');
  const acceptedStudentsCount = studentUsers.filter((s) => Boolean(s.rulesAccepted)).length;
  const pendingStudentsCount = studentUsers.length - acceptedStudentsCount;

  const selectedFilterCourse =
    courseFilterId !== 'all' ? courses.find((c) => c.id === courseFilterId) : null;

  const filteredUsers = allUsers
    .filter((u) => {
      if (roleFilter === 'staff') return u.role === 'admin' || u.role === 'co_admin';
      if (roleFilter === 'student') return u.role === 'student';
      return true;
    })
    .filter((u) => {
      if (ruleStatusFilter === 'accepted') {
        return u.role === 'student' && Boolean(u.rulesAccepted);
      }
      if (ruleStatusFilter === 'pending') {
        return u.role === 'student' && !u.rulesAccepted;
      }
      return true;
    })
    .filter((u) => {
      if (!selectedFilterCourse) return true;
      if (u.role !== 'student') return false;
      return selectedFilterCourse.enrolledStudentIds.includes(u.id);
    })
    .filter(
      (s) =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.phone && s.phone.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (s.title && s.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (s.address && s.address.toLowerCase().includes(searchQuery.toLowerCase()))
    );

  const handleRoleChange = (role: UserRole) => {
    setSelectedRole(role);
    if (role === 'admin') {
      setPassword('admin123');
    } else if (role === 'co_admin') {
      setPassword('coadmin123');
    } else {
      setPassword('student123');
    }
  };

  const generateUsernameFromName = (rawName: string, extraTaken?: Set<string>): string => {
    const trimmed = rawName.trim();
    if (!trimmed) return '';

    // 1. Common Myanmar name syllables & words dictionary for natural romanization
    const mmWordMap: Array<[RegExp, string]> = [
      [/မောင်/g, 'mg'],
      [/ကို/g, 'ko'],
      [/ဒေါ်/g, 'daw'],
      [/ဦး/g, 'u'],
      [/အောင်/g, 'aung'],
      [/မင်း/g, 'min'],
      [/ခန့်/g, 'khant'],
      [/ကျော်/g, 'kyaw'],
      [/စွာ/g, 'swar'],
      [/ထွန်း/g, 'htun'],
      [/နေ/g, 'nay'],
      [/ဝင်း/g, 'win'],
      [/စု/g, 'su'],
      [/သူရ/g, 'thura'],
      [/သူ/g, 'thu'],
      [/စိုး/g, 'soe'],
      [/နိုင်/g, 'naing'],
      [/လင်း/g, 'lin'],
      [/ထက်/g, 'htet'],
      [/ဖြိုး/g, 'phyo'],
      [/ပိုင်/g, 'paing'],
      [/သက်/g, 'thet'],
      [/ဇော်/g, 'zaw'],
      [/မြတ်/g, 'myat'],
      [/နွယ်/g, 'nwe'],
      [/မေ/g, 'may'],
      [/သဇင်/g, 'thazin'],
      [/နှင်း/g, 'hnin'],
      [/ရတနာ/g, 'yadanar'],
      [/ကေသီ/g, 'kaythi'],
      [/မိုး/g, 'moe'],
      [/တိုး/g, 'toe'],
      [/လှိုင်/g, 'hlaing'],
      [/သန်း/g, 'than'],
      [/သိန်း/g, 'thein'],
      [/ချို/g, 'cho'],
      [/ဖြူ/g, 'phyu'],
      [/ဝေ/g, 'wai'],
      [/ယမင်း/g, 'yamin'],
      [/ချမ်း/g, 'chan'],
      [/မြင့်/g, 'myint'],
      [/ဇင်/g, 'zin'],
      [/ခင်/g, 'khin'],
      [/မျိုး/g, 'myo'],
      [/သီရိ/g, 'thiri'],
      [/ရွှေ/g, 'shwe'],
      [/စန်း/g, 'san'],
      [/ထူး/g, 'htoo'],
      [/လွင်/g, 'lwin'],
      [/ဦး/g, 'oo'],
    ];

    let processed = trimmed;
    for (const [pattern, replacement] of mmWordMap) {
      processed = processed.replace(pattern, ` ${replacement} `);
    }

    // 2. Fallback character-by-character Myanmar consonant & digit romanization
    const mmCharMap: Record<string, string> = {
      က: 'k',
      ခ: 'kh',
      ဂ: 'g',
      ဃ: 'gh',
      င: 'ng',
      စ: 's',
      ဆ: 'hs',
      ဇ: 'z',
      ဈ: 'zh',
      ည: 'ny',
      ဉ: 'ny',
      ဋ: 't',
      ဌ: 'ht',
      ဍ: 'd',
      ဎ: 'dh',
      ဏ: 'n',
      တ: 't',
      ထ: 'ht',
      ဒ: 'd',
      ဓ: 'dh',
      န: 'n',
      ပ: 'p',
      ဖ: 'ph',
      ဗ: 'b',
      ဘ: 'bh',
      မ: 'm',
      ယ: 'y',
      ရ: 'y',
      လ: 'l',
      ဝ: 'w',
      သ: 'th',
      ဟ: 'h',
      ဠ: 'l',
      အ: 'a',
      'ါ': 'a',
      'ာ': 'a',
      'ိ': 'i',
      'ီ': 'i',
      'ု': 'u',
      'ူ': 'u',
      'ေ': 'ay',
      'ဲ': 'e',
      'ော': 'aw',
      'ော်': 'aw',
      'ို': 'o',
      'က်': 'et',
      'င်': 'in',
      'င့်': 'int',
      'င်း': 'in',
      'စ်': 'it',
      'ည်': 'i',
      'ဉ်': 'in',
      'တ်': 'at',
      'န်': 'an',
      'န့်': 'ant',
      'န်း': 'an',
      'ပ်': 'at',
      'မ်': 'am',
      'မ်း': 'am',
      'ံ': 'an',
      '့': '',
      'း': '',
      '်': '',
      'ျ': 'y',
      'ြ': 'y',
      'ွ': 'w',
      'ှ': 'h',
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

    let romanized = '';
    for (const ch of processed) {
      if (mmCharMap[ch] !== undefined) {
        romanized += mmCharMap[ch];
      } else {
        romanized += ch;
      }
    }

    // 3. Normalize to clean lowercase username characters
    let base = romanized
      .toLowerCase()
      .replace(/^(dr\.|mr\.|mrs\.|ms\.)\s*/i, '')
      .replace(/[^a-z0-9]+/g, '');

    if (!base) {
      base = `user${Math.floor(100 + Math.random() * 900)}`;
    }

    // 4. Ensure uniqueness against existing accounts and current batch
    const existingUsernames = new Set(allUsers.map((u) => u.username.toLowerCase()));
    if (extraTaken) {
      extraTaken.forEach((u) => existingUsernames.add(u.toLowerCase()));
    }
    if (!existingUsernames.has(base)) {
      return base;
    }
    let counter = 1;
    while (existingUsernames.has(`${base}${counter}`)) {
      counter++;
    }
    return `${base}${counter}`;
  };

  const handleNameInputChange = (newName: string) => {
    setName(newName);
    if (!isUsernameManuallyEdited) {
      const autoUser = generateUsernameFromName(newName);
      setUsername(autoUser);
      if (!isEmailManuallyEdited) {
        setEmail(autoUser ? `${autoUser}@swanarh.edu` : '');
      }
    }
  };

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let pass = '';
    for (let i = 0; i < 8; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(pass);
  };

  const handleAvatarFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('ကျေးဇူးပြု၍ ပုံဖိုင် (JPG, PNG, WEBP) ကိုသာ ရွေးချယ်ပါ။');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 240;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setAvatar(dataUrl);
          setErrorMsg(null);
        }
      };
      if (typeof event.target?.result === 'string') {
        img.src = event.target.result;
      }
    };
    reader.readAsDataURL(file);
  };

  const toggleInitialCourseSelection = (courseId: string) => {
    setSelectedInitialCourses((prev) =>
      prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId]
    );
  };

  const handleCreateAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !username.trim() || !email.trim() || !password.trim()) {
      setErrorMsg('အမည်၊ Username၊ Email နှင့် Password အားလုံး ပြည့်စုံစွာ ဖြည့်စွက်ပါ။');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const cleanPwd = password.trim();
    const res = ClassroomDB.registerNewUser({
      name: name.trim(),
      username: username.trim().toLowerCase(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      role: selectedRole,
      password: cleanPwd,
      avatar: selectedRole === 'student' ? '' : avatar,
      title: title.trim() || undefined,
      gender,
      address: address.trim() || undefined,
      initialCourseIds: selectedRole === 'student' ? selectedInitialCourses : undefined,
      skipCloudUpsert: true,
    });

    if (res.error || !res.user) {
      setErrorMsg(res.error || 'Failed to create user account.');
      setIsSubmitting(false);
      return;
    }

    const supabaseRes = await SupabaseService.signUpWithSupabase(email.trim().toLowerCase(), cleanPwd, {
      id: res.user.id,
      name: res.user.name,
      username: res.user.username,
      role: res.user.role,
      phone: res.user.phone,
      avatar: res.user.avatar,
      title: res.user.title,
      gender,
      address: res.user.address,
    });

    const enrolledCoursesList =
      selectedRole === 'student'
        ? courses.filter((c) => selectedInitialCourses.includes(c.id))
        : [];

    if (enrolledCoursesList.length > 0) {
      await Promise.all(
        enrolledCoursesList.map((course) =>
          SupabaseService.upsertCourse({
            ...course,
            enrolledStudentIds: Array.from(new Set([...course.enrolledStudentIds, res.user!.id])),
          })
        )
      ).catch(() => {});
    }

    const roleDisplay =
      selectedRole === 'admin'
        ? 'Admin (ဆရာ / စီမံခန့်ခွဲသူ)'
        : selectedRole === 'co_admin'
        ? 'Co-Admin (တွဲဖက် အက်ဒမင်)'
        : 'Student (ကျောင်းသား)';

    const enrolledLabel =
      selectedRole === 'student'
        ? enrolledCoursesList.length > 0
          ? enrolledCoursesList.map((c) => c.code).join(', ')
          : 'No initial course'
        : 'All Courses (Staff Access)';

    const loginLink = getOfficialLoginUrl();

    const newCredsObj = {
      name: res.user.name,
      username: res.user.username,
      password: cleanPwd,
      role: selectedRole,
      occupation: title.trim() || res.user.title,
      courseName: enrolledLabel,
      gender: gender === 'male' ? 'Male (ကျား)' : 'Female (မ)',
      address: res.user.address,
      loginUrl: loginLink,
    };

    setCreatedCredentials(newCredsObj);

    if (autoCopyAfterSingleCreate) {
      navigator.clipboard.writeText(formatCredentialMessage(newCredsObj)).catch(() => {});
      setCopiedSuccess(true);
      setTimeout(() => setCopiedSuccess(false), 4000);
    }

    setName('');
    setUsername('');
    setIsUsernameManuallyEdited(false);
    setEmail('');
    setIsEmailManuallyEdited(false);
    setPhone('+95 9 ');
    setTitle('');
    setAddress('');
    setSingleSmartPasteText('');
    setSingleAutoFilledNotice(null);
    setAutoCopyAfterSingleCreate(false);
    setShowNewForm(false);
    setIsSubmitting(false);
    setTimeout(() => {
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }, 60);

    const syncNote = supabaseRes.profileSynced
      ? 'Supabase Cloud & Local Database သို့ ချိတ်ဆက်သိမ်းဆည်းပြီးပါပြီ။'
      : 'Local Database သို့ သိမ်းဆည်းပြီးပါပြီ။';

    setToastMsg(
      `${roleDisplay} အကောင့် "${res.user.name}" (@${res.user.username}) ကို ဖန်တီးပြီးပါပြီ! ${
        autoCopyAfterSingleCreate ? '📋 Login အချက်အလက်ကိုလည်း Auto-Copy ကူးပေးပြီးပါပြီ!' : syncNote
      }`
    );
    onRefresh();
    setTimeout(() => setToastMsg(null), 6000);
  };

  const handleSyncAllToSupabase = async () => {
    setIsSyncingAll(true);
    await ClassroomDB.pullFromSupabase({ force: true });
    const res = await ClassroomDB.syncWithSupabase();
    onRefresh();
    setIsSyncingAll(false);
    if (res.success) {
      const cleanNote =
        res.cleanedOrphans && res.cleanedOrphans > 0
          ? ` (Orphaned data ${res.cleanedOrphans} ခု အလိုအလျောက် ရှင်းလင်းပြီး)`
          : '';
      setToastMsg(
        `✅ Supabase Cloud Sync အောင်မြင်ပါသည်! အကောင့် (${res.syncedUsers}) ခုနှင့် အတန်း (${res.syncedCourses}) ခု ချိတ်ဆက်ပြီးပါပြီ။${cleanNote}`
      );
    } else {
      setToastMsg(
        `⚠️ Supabase Sync သတိပေးချက်: ${res.error || 'Table မရှိသေးပါ။ Supabase SQL ခလုတ်နှိပ်၍ SQL Script ကို Run ပေးပါ။'}`
      );
    }
    setTimeout(() => setToastMsg(null), 6000);
  };

  function formatCredentialMessage(creds: {
    name: string;
    username: string;
    password: string;
    role: UserRole;
    occupation?: string;
    courseName?: string;
    gender?: string;
    address?: string;
    loginUrl?: string;
  }): string {
    const roleLabel =
      creds.role === 'admin'
        ? 'Admin (ဆရာ)'
        : creds.role === 'co_admin'
        ? 'Co-Admin (တွဲဖက်ဆရာ)'
        : 'Student (ကျောင်းသား)';
    const loginLink = creds.loginUrl || getOfficialLoginUrl();

    const lines = [
      `🎓 SwanArh Digital Academy (${roleLabel} Login)`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `👤 အမည် (Name): ${creds.name}`,
      `🔑 Username: ${creds.username}`,
      `🔒 Password: ${creds.password}`,
    ];
    if (creds.occupation) {
      lines.push(`💼 အလုပ်အကိုင်/ပညာအရည်အချင်း: ${creds.occupation}`);
    }
    if (creds.courseName) {
      lines.push(`📚 တက်ရောက်ခွင့်ရသည့်အတန်း: ${creds.courseName}`);
    }
    lines.push(`🌐 Login ဝင်ရန် လင့်ခ် (Login Link):`);
    lines.push(loginLink);
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
  }

  const handleCopyCredentials = (creds: {
    name: string;
    username: string;
    password: string;
    role: UserRole;
    occupation?: string;
    courseName?: string;
    gender?: string;
    address?: string;
    loginUrl?: string;
  }) => {
    navigator.clipboard.writeText(formatCredentialMessage(creds));
    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(false), 3000);
  };

  // Official Student Registration Form Template to send to students
  const STUDENT_FORM_TEMPLATE = [
    'အမည်(Full Name): ',
    'Email: ',
    'ဖုန်းနံပါတ်(Phone): ',
    'အလုပ်အကိုင်/ပညာအရည်အချင်း: ',
    'ကျား/မ(Gender): ',
    'နေရပ်လိပ်စာ(Address): ',
  ].join('\n');

  const handleCopyStudentFormTemplate = () => {
    navigator.clipboard.writeText(STUDENT_FORM_TEMPLATE);
    setCopiedTemplateNotice(true);
    setTimeout(() => setCopiedTemplateNotice(false), 3500);
  };

  const normalizeMyanmarDigits = (str: string): string => {
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
    return str.replace(/[၀-၉]/g, (d) => mmDigits[d] || d);
  };

  const parseGenderValue = (rawGender: string): 'male' | 'female' => {
    const cleaned = rawGender.trim().toLowerCase();
    if (!cleaned) return 'male';
    if (
      cleaned === 'မ' ||
      cleaned.includes('မ (') ||
      cleaned.includes('(မ)') ||
      cleaned.includes('အမျိုးသမီး') ||
      cleaned.includes('မိန်းကလေး') ||
      cleaned.includes('female') ||
      cleaned === 'f' ||
      cleaned.includes('woman') ||
      cleaned.includes('girl')
    ) {
      return 'female';
    }
    return 'male';
  };

  // Smart Multi-Format Parser: Supports both labeled Student Registration Form blocks AND 1-line entries
  const parseQuickPasteLines = (raw: string) => {
    if (!raw || !raw.trim()) return [];

    const rawLines = raw.split(/\r?\n/);

    // Check if text contains labeled form fields like "အမည်(Full Name):", "ဖုန်းနံပါတ်(Phone):", etc.
    const labelLineRegex =
      /^(?:[\d၀-၉]+[.)။\s]*|[-•*]\s*)?(အမည်\s*\(\s*full\s*name\s*\)|အမည်|နာမည်|full\s*name|name|email|e-mail|အီးမေးလ်|gmail|ဖုန်းနံပါတ်\s*\(\s*phone\s*\)|ဖုန်းနံပါတ်|ဖုန်း|phone\s*no|phone|ph|အလုပ်အကိုင်\s*\/\s*ပညာအရည်အချင်း|အလုပ်အကိုင်|ပညာအရည်အချင်း|occupation|education|title|ကျား\s*\/\s*မ\s*\(\s*gender\s*\)|ကျား\s*\/\s*မ|လိင်|gender|sex|နေရပ်လိပ်စာ\s*\(\s*address\s*\)|နေရပ်လိပ်စာ|နေရပ်|လိပ်စာ|address)\s*[:：=\-]\s*(.*)$/i;

    const hasLabeledLines = rawLines.some((l) => labelLineRegex.test(l.trim()));

    const assignedInPreview = new Set<string>();

    if (hasLabeledLines) {
      interface DraftBlock {
        name: string;
        email: string;
        phone: string;
        occupation: string;
        gender: 'male' | 'female';
        address: string;
      }

      const blocks: DraftBlock[] = [];
      let current: DraftBlock | null = null;

      const ensureCurrent = (): DraftBlock => {
        if (!current) {
          current = {
            name: '',
            email: '',
            phone: '',
            occupation: pasteDefaultOccupation.trim(),
            gender: 'male',
            address: '',
          };
          blocks.push(current);
        }
        return current;
      };

      for (const rawLine of rawLines) {
        const trimmed = rawLine.trim();
        if (!trimmed) continue;

        const match = trimmed.match(labelLineRegex);
        if (match) {
          const rawKey = match[1].toLowerCase().replace(/\s+/g, '');
          const val = match[2].trim();

          if (rawKey.includes('အမည်') || rawKey.includes('နာမည်') || rawKey.includes('name')) {
            // If current block already has a name, start a new student block!
            if (current && current.name) {
              current = {
                name: val,
                email: '',
                phone: '',
                occupation: pasteDefaultOccupation.trim(),
                gender: 'male',
                address: '',
              };
              blocks.push(current);
            } else {
              const blk = ensureCurrent();
              blk.name = val;
            }
          } else if (rawKey.includes('email') || rawKey.includes('e-mail') || rawKey.includes('အီးမေးလ်') || rawKey.includes('gmail')) {
            const blk = ensureCurrent();
            blk.email = val;
          } else if (rawKey.includes('ဖုန်း') || rawKey.includes('phone') || rawKey === 'ph') {
            const blk = ensureCurrent();
            blk.phone = normalizeMyanmarDigits(val);
          } else if (
            rawKey.includes('အလုပ်အကိုင်') ||
            rawKey.includes('ပညာအရည်အချင်း') ||
            rawKey.includes('occupation') ||
            rawKey.includes('education') ||
            rawKey.includes('title')
          ) {
            const blk = ensureCurrent();
            if (val) blk.occupation = val;
          } else if (rawKey.includes('ကျား') || rawKey.includes('လိင်') || rawKey.includes('gender') || rawKey.includes('sex')) {
            const blk = ensureCurrent();
            blk.gender = parseGenderValue(val);
          } else if (rawKey.includes('လိပ်စာ') || rawKey.includes('နေရပ်') || rawKey.includes('address')) {
            const blk = ensureCurrent();
            blk.address = val;
          }
        }
      }

      return blocks
        .filter((b) => b.name.trim().length > 0)
        .map((b, idx) => {
          const cleanName = b.name.trim();
          const autoUsername = generateUsernameFromName(cleanName, assignedInPreview);
          assignedInPreview.add(autoUsername);

          const rawEmail = b.email.trim().toLowerCase();
          const hasValidEmail = rawEmail.includes('@') && rawEmail.includes('.');
          const finalEmail = hasValidEmail ? rawEmail : `${autoUsername}@swanarh.edu`;

          return {
            index: idx + 1,
            name: cleanName,
            username: autoUsername,
            email: finalEmail,
            phone: b.phone.trim(),
            occupation: b.occupation.trim() || pasteDefaultOccupation.trim(),
            gender: b.gender,
            address: b.address.trim(),
          };
        });
    }

    // Fallback: 1-line-per-student format (e.g. "မောင်မင်းခန့်, 0912345678, B.C.Sc, ရန်ကုန်")
    const lines = rawLines
      .map((l) =>
        l
          .trim()
          .replace(/^(?:[\d၀-၉]+[.)။:\-\s]+|\([\d၀-၉]+\)\s*|[-•*]\s*)/, '')
          .trim()
      )
      .filter(Boolean);

    return lines
      .map((line, idx) => {
        const parts = line
          .split(/[,|\t]+/)
          .map((p) => p.trim())
          .filter(Boolean);
        const rawStudentName = parts[0] || '';
        if (!rawStudentName) return null;

        let parsedEmail = '';
        let parsedPhone = '';
        let parsedOccupation = pasteDefaultOccupation.trim();
        let parsedGender: 'male' | 'female' = 'male';
        let parsedAddress = '';

        for (let i = 1; i < parts.length; i++) {
          const part = parts[i];
          const normalizedDigits = normalizeMyanmarDigits(part);
          if (part.includes('@') && part.includes('.')) {
            parsedEmail = part.toLowerCase();
          } else if (/^[+\d\s\-()]{6,}$/.test(normalizedDigits)) {
            parsedPhone = normalizedDigits;
          } else if (
            part === 'ကျား' ||
            part === 'မ' ||
            part.toLowerCase() === 'male' ||
            part.toLowerCase() === 'female'
          ) {
            parsedGender = parseGenderValue(part);
          } else if (!parsedOccupation || parsedOccupation === pasteDefaultOccupation.trim()) {
            parsedOccupation = part;
          } else if (!parsedAddress) {
            parsedAddress = part;
          }
        }

        const autoUsername = generateUsernameFromName(rawStudentName, assignedInPreview);
        assignedInPreview.add(autoUsername);

        return {
          index: idx + 1,
          name: rawStudentName,
          username: autoUsername,
          email: parsedEmail || `${autoUsername}@swanarh.edu`,
          phone: parsedPhone,
          occupation: parsedOccupation,
          gender: parsedGender,
          address: parsedAddress,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  };

  const parsedPastePreview = parseQuickPasteLines(pasteRawText);

  // Apply pasted Student Form directly into Single Account fields (or switch to Batch Mode if 2+ students)
  const applySmartAutoFillToSingleForm = (raw: string) => {
    setSingleSmartPasteText(raw);
    if (!raw.trim()) {
      setSingleAutoFilledNotice(null);
      return;
    }

    const parsedList = parseQuickPasteLines(raw);
    if (parsedList.length === 0) {
      return;
    }

    if (parsedList.length > 1) {
      // Automatically switch to Quick Paste Mode if Admin pasted 2 or more students!
      setPasteRawText(raw);
      setCreateEntryMode('paste');
      setSingleSmartPasteText('');
      setErrorMsg(null);
      setToastMsg(
        `✨ ကျောင်းသား (${parsedList.length}) ဦး၏ အချက်အလက်ကို တွေ့ရှိသဖြင့် အများအပြား အမြန်သွင်းသည့်စနစ်ထဲသို့ အလိုအလျောက် ထည့်သွင်းပေးထားပါသည်!`
      );
      setTimeout(() => setToastMsg(null), 5000);
      return;
    }

    const first = parsedList[0];
    setSelectedRole('student');
    setName(first.name);
    setUsername(first.username);
    setIsUsernameManuallyEdited(false);
    setEmail(first.email);
    setIsEmailManuallyEdited(Boolean(first.email && !first.email.endsWith('@swanarh.edu')));
    if (first.phone) {
      setPhone(first.phone);
    }
    if (first.occupation) {
      setTitle(first.occupation);
    }
    setGender(first.gender);
    if (first.address) {
      setAddress(first.address);
    }
    setErrorMsg(null);
    setSingleAutoFilledNotice(
      `✓ "${first.name}" (@${first.username}) ၏ အချက်အလက်များကို သက်ဆိုင်ရာ အကွက်များထဲသို့ Auto ဖြည့်သွင်းပြီးပါပြီ! အောက်တွင် စစ်ဆေးပြီး Create တန်းနှိပ်နိုင်ပါသည်။`
    );
  };

  const handleClipboardAutoFillSingle = async () => {
    try {
      const clipText = await navigator.clipboard.readText();
      if (!clipText || !clipText.trim()) {
        setErrorMsg('Clipboard ထဲတွင် စာသားမရှိသေးပါ။ ကျောင်းသားပို့လာသော စာကို အရင် Copy ကူးယူပါ။');
        return;
      }
      applySmartAutoFillToSingleForm(clipText);
    } catch {
      setErrorMsg('Clipboard ဖတ်ယူရန် အောက်ပါ အကွက်ထဲတွင် တိုက်ရိုက် Paste (Ctrl+V / ဖိနှိပ်၍ Paste) ချပေးပါ။');
    }
  };

  const handleClipboardPasteBatch = async () => {
    try {
      const clipText = await navigator.clipboard.readText();
      if (!clipText || !clipText.trim()) {
        setErrorMsg('Clipboard ထဲတွင် စာသားမရှိသေးပါ။ ကျောင်းသားပို့လာသော စာကို အရင် Copy ကူးယူပါ။');
        return;
      }
      setPasteRawText((prev) => (prev.trim() ? `${prev.trim()}\n\n${clipText.trim()}` : clipText.trim()));
      setErrorMsg(null);
    } catch {
      setErrorMsg('အောက်ပါ စာသားအကွက်ထဲတွင် တိုက်ရိုက် Paste (Ctrl+V / ဖိနှိပ်၍ Paste) ချပေးပါ။');
    }
  };

  const generateShortEasyPassword = () => {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    let pass = '';
    for (let i = 0; i < 6; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pass;
  };

  const handleQuickPasteBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedPastePreview.length === 0) {
      setErrorMsg('ကျေးဇူးပြု၍ အနည်းဆုံး ကျောင်းသား (၁) ဦး၏ အချက်အလက်ကို ရိုက်ထည့်ပါ (သို့မဟုတ် Paste ကူးထည့်ပါ)။');
      return;
    }
    if (pastePasswordMode === 'shared' && !pasteSharedPassword.trim()) {
      setErrorMsg('ကျေးဇူးပြု၍ ဘုံသုံးမည့် Password (သို့မဟုတ် Auto Password စနစ်) ကို ရွေးချယ်ပါ။');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const enrolledCoursesList = courses.filter((c) => selectedInitialCourses.includes(c.id));
    const enrolledLabel =
      enrolledCoursesList.length > 0
        ? enrolledCoursesList.map((c) => c.code).join(', ')
        : 'No initial course';
    const loginLink = getOfficialLoginUrl();

    const createdList: Array<{
      id: string;
      name: string;
      username: string;
      password: string;
      role: UserRole;
      email?: string;
      occupation?: string;
      phone?: string;
      gender?: string;
      address?: string;
      courseName?: string;
      loginUrl: string;
    }> = [];

    const assignedUsernames = new Set<string>();
    const newStudentIds: string[] = [];

    for (const item of parsedPastePreview) {
      const finalUsername = generateUsernameFromName(item.name, assignedUsernames);
      assignedUsernames.add(finalUsername);

      const finalPassword =
        pastePasswordMode === 'random'
          ? generateShortEasyPassword()
          : pasteSharedPassword.trim() || 'student123';

      const finalEmail =
        item.email && item.email.includes('@') && !item.email.endsWith('@swanarh.edu')
          ? item.email.toLowerCase()
          : `${finalUsername}@swanarh.edu`;

      const res = ClassroomDB.registerNewUser({
        name: item.name,
        username: finalUsername,
        email: finalEmail,
        phone: item.phone || '+95 9 ',
        role: 'student',
        password: finalPassword,
        avatar: '',
        title: item.occupation || undefined,
        gender: item.gender || 'male',
        address: item.address || undefined,
        initialCourseIds: selectedInitialCourses,
        skipCloudUpsert: true,
      });

      if (res.user) {
        newStudentIds.push(res.user.id);
        createdList.push({
          id: res.user.id,
          name: res.user.name,
          username: res.user.username,
          password: finalPassword,
          role: 'student',
          email: finalEmail,
          occupation: item.occupation || undefined,
          phone: item.phone || undefined,
          gender: item.gender === 'female' ? 'မ (Female)' : 'ကျား (Male)',
          address: item.address || undefined,
          courseName: enrolledLabel,
          loginUrl: loginLink,
        });

        await SupabaseService.signUpWithSupabase(finalEmail, finalPassword, {
          id: res.user.id,
          name: res.user.name,
          username: res.user.username,
          role: 'student',
          phone: res.user.phone,
          avatar: '',
          title: res.user.title,
          gender: item.gender || 'male',
          address: res.user.address,
        }).catch(() => {});
      }
    }

    if (enrolledCoursesList.length > 0 && newStudentIds.length > 0) {
      await Promise.all(
        enrolledCoursesList.map((course) =>
          SupabaseService.upsertCourse({
            ...course,
            enrolledStudentIds: Array.from(new Set([...course.enrolledStudentIds, ...newStudentIds])),
          })
        )
      ).catch(() => {});
    }

    setBatchCreatedCredentials(createdList);
    setCopiedBatchIds({});
    setCopiedAllBatchSuccess(false);
    setCreatedCredentials(null);
    setPasteRawText('');
    setShowNewForm(false);
    setIsSubmitting(false);
    setTimeout(() => {
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }, 60);

    setToastMsg(
      `🎉 ကျောင်းသားအကောင့်သစ် (${createdList.length}) ဦးကို တစ်ပြိုင်နက် ဖွင့်လှစ်ပြီး အတန်းသွင်းပေးပြီးပါပြီ! တစ်ဦးချင်းစီအတွက် Copy ခလုတ်နှိပ်၍ ပေးပို့နိုင်ပါပြီ။`
    );
    onRefresh();
    setTimeout(() => setToastMsg(null), 7000);
  };

  const handleCopySingleBatchItem = (item: {
    id: string;
    name: string;
    username: string;
    password: string;
    role: UserRole;
    occupation?: string;
    courseName?: string;
    loginUrl: string;
  }) => {
    navigator.clipboard.writeText(formatCredentialMessage(item));
    setCopiedBatchIds((prev) => ({ ...prev, [item.id]: true }));
  };

  const handleCopyAllBatchItems = () => {
    if (batchCreatedCredentials.length === 0) return;
    const combined = batchCreatedCredentials
      .map((item, idx) => `[${idx + 1}] ${formatCredentialMessage(item)}`)
      .join('\n\n');
    navigator.clipboard.writeText(combined);
    setCopiedAllBatchSuccess(true);
    const allMarked: Record<string, boolean> = {};
    batchCreatedCredentials.forEach((item) => {
      allMarked[item.id] = true;
    });
    setCopiedBatchIds(allMarked);
    setTimeout(() => setCopiedAllBatchSuccess(false), 3500);
  };

  const toggleRevealPassword = (studentId: string) => {
    setRevealedPasswords((prev) => ({
      ...prev,
      [studentId]: !prev[studentId],
    }));
  };

  const handleSaveResetPassword = () => {
    if (!resettingUser) return;
    const res = ClassroomDB.adminUpdateStudentPassword(resettingUser.id, newUserPassword);
    if (res.success) {
      setToastMsg(
        `အသုံးပြုသူ "${resettingUser.name}" (@${resettingUser.username}) ၏ စကားဝှက်အသစ်ကို ပြောင်းလဲသိမ်းဆည်းပြီးပါပြီ။`
      );
      setResettingUser(null);
      setNewUserPassword('');
      onRefresh();
      setTimeout(() => setToastMsg(null), 4000);
    }
  };

  const handleToggleCourseForStudent = (
    studentId: string,
    courseId: string,
    currentlyEnrolled: boolean
  ) => {
    if (currentlyEnrolled) {
      ClassroomDB.unenrollStudent(courseId, studentId);
    } else {
      ClassroomDB.enrollStudent(courseId, studentId);
    }
    onRefresh();
  };

  const handleEnrollStudentInAllCourses = (studentId: string, enrollAll: boolean) => {
    courses.forEach((c) => {
      if (enrollAll) {
        ClassroomDB.enrollStudent(c.id, studentId);
      } else {
        ClassroomDB.unenrollStudent(c.id, studentId);
      }
    });
    onRefresh();
  };

  const handleExportAttendanceCSV = (courseIdOrAll: string) => {
    if (courseIdOrAll === 'all') {
      const res = ClassroomDB.downloadAllClassesAttendanceCSV();
      if (res.success) {
        setToastMsg(
          `📊 အတန်းအားလုံး၏ Attendance Report ဖိုင် (${res.filename}) ကို အောင်မြင်စွာ ဒေါင်းလုဒ်ဆွဲပြီးပါပြီ!`
        );
        setTimeout(() => setToastMsg(null), 5000);
      }
    } else {
      const res = ClassroomDB.downloadClassAttendanceCSV(courseIdOrAll);
      if (res.success) {
        setToastMsg(
          `📊 Attendance CSV Report ဖိုင် (${res.filename}) ကို အောင်မြင်စွာ ဒေါင်းလုဒ်ဆွဲပြီးပါပြီ!`
        );
        setTimeout(() => setToastMsg(null), 5000);
      }
    }
  };

  const handleExportAcceptanceAudit = (mode: 'all' | 'accepted_only') => {
    const res = ClassroomDB.downloadRulesAcceptanceAuditCSV(mode);
    if (res.success) {
      setToastMsg(
        `📋 စည်းကမ်းချက် လက်ခံပြီးကြောင်း စစ်ဆေးချက်ဖိုင် (${res.filename}) — ${res.acceptedCount}/${res.totalStudents} ဦး ဒေါင်းလုဒ်ဆွဲပြီးပါပြီ!`
      );
      setTimeout(() => setToastMsg(null), 5000);
    }
  };

  const handleDeleteUser = (user: User) => {
    if (isCoAdminSession && user.role === 'admin') {
      setToastMsg('ခွင့်ပြုချက် မရှိပါ: Main Admin အကောင့်အား Co-Admin မှ ဖျက်ခွင့်မရှိပါ။');
      setTimeout(() => setToastMsg(null), 4000);
      return;
    }
    const adminCount = allUsers.filter((u) => u.role === 'admin').length;
    if (user.role === 'admin' && adminCount <= 1) {
      setToastMsg('တစ်ခုတည်းသော Primary Admin အကောင့်အား ဖျက်၍မရပါ။');
      setTimeout(() => setToastMsg(null), 4000);
      return;
    }
    setUserToDelete(user);
  };

  const confirmDeleteUser = () => {
    if (!userToDelete) return;
    const res = ClassroomDB.deleteUser(userToDelete.id);
    if (res.success) {
      setToastMsg(`အသုံးပြုသူ "${userToDelete.name}" ကို စနစ်နှင့် SQL Database ထဲမှ ဖယ်ရှားပြီးပါပြီ။`);
      onRefresh();
    } else if (res.error) {
      setToastMsg(res.error);
    }
    setUserToDelete(null);
    setTimeout(() => setToastMsg(null), 4000);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-sm">
        <div className="relative w-full max-w-6xl bg-slate-50 dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[94dvh] transition-colors">
          {/* Clean, Uncluttered Modal Header */}
          <div className="p-3.5 sm:px-6 sm:py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3 shrink-0">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Users className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate">
                      Manage Users & Class Enrollments
                    </h2>
                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                      {allUsers.length} Accounts
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex-wrap">
                    <span>🛡️ Staff: <strong>{staffUsers.length}</strong></span>
                    <span>·</span>
                    <span>🎓 Students: <strong>{studentUsers.length}</strong></span>
                    <span>·</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                      ✓ Rules Accepted: {acceptedStudentsCount}/{studentUsers.length}
                    </span>
                  </div>
                </div>
              </div>

              {/* Mobile Close Button */}
              <button
                type="button"
                onClick={onClose}
                className="lg:hidden p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer shrink-0"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Clean Top Action Bar */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowNewForm((prev) => !prev);
                  if (!showNewForm) setShowReportsDrawer(false);
                  setErrorMsg(null);
                }}
                className={`flex-1 sm:flex-initial px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs ${
                  showNewForm
                    ? 'bg-slate-800 text-white dark:bg-slate-700'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{showNewForm ? 'စာရင်းပြန်ကြည့်မည်' : '+ အကောင့်သစ် ဖွင့်မည် (Add User)'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowReportsDrawer((prev) => !prev);
                  if (!showReportsDrawer) setShowNewForm(false);
                }}
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  showReportsDrawer
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-emerald-400'
                }`}
                title="Attendance CSV နှင့် Rules Acceptance စာရင်းထုတ်ရန်"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>CSV / Reports</span>
              </button>

              <button
                type="button"
                onClick={handleSyncAllToSupabase}
                disabled={isSyncingAll}
                className="px-3 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                title="Sync all accounts & enrollments with Supabase Cloud"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-indigo-500 ${isSyncingAll ? 'animate-spin' : ''}`} />
                <span>{isSyncingAll ? 'Syncing...' : 'Sync'}</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="hidden lg:inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-slate-600 dark:text-slate-300 hover:text-rose-600 text-xs font-bold cursor-pointer transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                <span>ပိတ်မည်</span>
              </button>
            </div>
          </div>

          {/* Main Scrollable Content Area (Everything inside scrolls smoothly) */}
          <div
            ref={scrollContainerRef}
            className="p-3.5 sm:p-5 overflow-y-auto flex-1 min-h-0 space-y-4 min-w-0"
          >
            {/* Status Toast */}
            {toastMsg && (
              <div className="flex items-center justify-between gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs rounded-xl shadow-2xs">
                <div className="flex items-center gap-2 min-w-0">
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="break-words">{toastMsg}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setToastMsg(null)}
                  className="text-emerald-700 dark:text-emerald-300 hover:opacity-75 text-xs font-bold px-1 cursor-pointer shrink-0"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Newly Created Account Credentials Banner */}
            {createdCredentials && (
              <div className="p-3.5 sm:p-4 bg-indigo-50/90 dark:bg-indigo-950/50 border-2 border-indigo-300 dark:border-indigo-700 rounded-2xl shadow-xs text-xs space-y-3">
                {/* Top Header with Prominent Immediate Copy Button */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold shrink-0">
                      ✓
                    </span>
                    <h4 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                      {createdCredentials.role === 'admin'
                        ? 'Admin'
                        : createdCredentials.role === 'co_admin'
                        ? 'Co-Admin'
                        : 'Student'}{' '}
                      အကောင့်သစ် ဖွင့်ပြီးပါပြီ — Copy နှိပ်၍ Login အချက်အလက်အားလုံး ကူးယူပေးပို့နိုင်ပါသည်
                    </h4>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                    <button
                      type="button"
                      onClick={() => handleCopyCredentials(createdCredentials)}
                      className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs cursor-pointer shadow-xs"
                    >
                      {copiedSuccess ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      <span>
                        {copiedSuccess
                          ? 'Copied! (ကူးပြီးပါပြီ)'
                          : '📋 Copy Login Info (ကူးမည်)'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreatedCredentials(null)}
                      className="text-slate-400 hover:text-slate-700 dark:hover:text-white font-bold p-1.5 rounded-lg cursor-pointer"
                      title="ပိတ်မည်"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 bg-white dark:bg-slate-800 p-3 rounded-xl border border-indigo-200 dark:border-indigo-900/60 font-mono text-[11px]">
                  <div className="min-w-0">
                    <span className="text-slate-400 block text-[10px] uppercase font-sans font-semibold">အမည် (Name)</span>
                    <span className="font-bold text-slate-900 dark:text-white truncate block">{createdCredentials.name}</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-slate-400 block text-[10px] uppercase font-sans font-semibold">Username</span>
                    <span className="font-bold text-indigo-600 dark:text-indigo-300 truncate block">{createdCredentials.username}</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-slate-400 block text-[10px] uppercase font-sans font-semibold">Password</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 truncate block">{createdCredentials.password}</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-slate-400 block text-[10px] uppercase font-sans font-semibold">အလုပ်အကိုင်/ပညာအရည်အချင်း</span>
                    <span className="text-slate-700 dark:text-slate-300 truncate block font-sans">{createdCredentials.occupation || '—'}</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-slate-400 block text-[10px] uppercase font-sans font-semibold">Login ဝင်ရန် လင့်ခ်</span>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400 truncate block">{createdCredentials.loginUrl}</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 text-[11px] text-amber-950 dark:text-amber-200 space-y-1 leading-relaxed">
                  <div className="font-bold text-amber-800 dark:text-amber-300">
                    📌 Copy ကူးယူရာတွင် တစ်ပါတည်း ပါဝင်မည့် လမ်းညွှန်ချက်များ -
                  </div>
                  <div>
                    ၁။ ကျောင်းသား/သူများသည် Device တစ်ခုတည်းသာ Login ဝင်လို့ရပါမည်။ တခြား Device မှာ အသုံးပြုလိုပါက အရင်ဝင်ထားတဲ့ Device မှ Logout ထွက်ပြီးမှ Login ဝင်လို့ရပါမည်။
                  </div>
                  <div>
                    ၂။ Login ဝင်ပြီးပါက ပေါ်လာသည့် သင်တန်းစည်းကမ်းချက်များကို သေချာဖတ်ပြီး "သိရှိလိုက်နာပါမည်" ကို ရွေးချယ်ပြီးမှ Classroom ကို ဝင်ရောက်လို့ရပါမည်။
                  </div>
                  <div>
                    ၃။ သင်တန်းမှ ပထမဆုံးပေးသော Password ကို Classroom ထဲရောက်ပါက မိမိအသုံးပြုမည့် Password ကို ပြန်ချိန်းပြီးမှ သုံးပါ။
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-0.5">
                  <span className="text-[11px] text-slate-600 dark:text-slate-300">
                    📋 Copy နှိပ်ပါက <strong>Login Link, အမည်, Username, Password နှင့် အထက်ပါ လမ်းညွှန်ချက် (၃) ချက်</strong> အားလုံး တစ်ခါတည်း ကူးယူပေးပါမည်။
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyCredentials(createdCredentials)}
                    className="flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs cursor-pointer shadow-xs shrink-0"
                  >
                    {copiedSuccess ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>
                      {copiedSuccess
                        ? 'Copied! (Login Info + လမ်းညွှန်ချက်များ ကူးပြီးပါပြီ)'
                        : 'Copy Login Info (Login လင့်ခ်နှင့် အချက်အလက်အားလုံး ကူးမည်)'}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* Batch Created Accounts Credentials Panel (Quick Text Paste Mode Results) */}
            {batchCreatedCredentials.length > 0 && (
              <div className="p-3.5 sm:p-4 bg-emerald-50/90 dark:bg-emerald-950/40 border-2 border-emerald-400 dark:border-emerald-700 rounded-2xl shadow-xs text-xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0">
                      ✓
                    </span>
                    <div className="min-w-0">
                      <h4 className="font-extrabold text-slate-900 dark:text-white text-xs sm:text-sm">
                        ကျောင်းသားအကောင့်သစ် ({batchCreatedCredentials.length}) ဦး ဖွင့်ပြီးပါပြီ — တစ်ဦးချင်းစီအတွက် Copy တန်းကူးနိုင်ပါသည်
                      </h4>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300">
                        တစ်ယောက်ချင်းစီ၏ <strong>Copy Login Info</strong> ခလုတ်ကို နှိပ်၍ Viber / Messenger သို့ တိုက်ရိုက် ပေးပို့နိုင်ပါသည် ({Object.keys(copiedBatchIds).length}/{batchCreatedCredentials.length} ကူးယူပြီး)
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                    <button
                      type="button"
                      onClick={handleCopyAllBatchItems}
                      className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs cursor-pointer shadow-2xs"
                    >
                      {copiedAllBatchSuccess ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>
                        {copiedAllBatchSuccess
                          ? 'အားလုံး Copy ကူးပြီးပါပြီ!'
                          : `အားလုံး စုပေါင်း Copy ကူးမည် (${batchCreatedCredentials.length} ဦး)`}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setBatchCreatedCredentials([])}
                      className="text-slate-400 hover:text-slate-700 dark:hover:text-white font-bold px-2 py-1 rounded-lg cursor-pointer"
                      title="ပိတ်မည်"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                  {batchCreatedCredentials.map((item, idx) => {
                    const isCopied = Boolean(copiedBatchIds[item.id]);
                    return (
                      <div
                        key={item.id}
                        className={`p-2.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-colors ${
                          isCopied
                            ? 'bg-emerald-100/70 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 min-w-0 font-mono text-[11px]">
                          <span className="font-sans font-extrabold text-slate-400 text-xs">#{idx + 1}</span>
                          <span className="font-sans font-bold text-slate-900 dark:text-white text-xs">
                            👤 {item.name}
                          </span>
                          <span className="text-indigo-600 dark:text-indigo-300 font-bold">
                            🔑 @{item.username}
                          </span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                            🔒 {item.password}
                          </span>
                          {item.occupation && (
                            <span className="font-sans text-slate-600 dark:text-slate-300">
                              💼 {item.occupation}
                            </span>
                          )}
                          {item.courseName && (
                            <span className="font-sans text-slate-500 dark:text-slate-400">
                              📚 {item.courseName}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopySingleBatchItem(item)}
                          className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shrink-0 transition-all ${
                            isCopied
                              ? 'bg-emerald-600 text-white shadow-2xs'
                              : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs'
                          }`}
                        >
                          {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{isCopied ? 'Copied! (ထပ်ကူးမည်)' : 'Copy Login Info'}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {/* Collapsible Reports & CSV Export Drawer */}
            {showReportsDrawer && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 shadow-xs animate-in fade-in duration-150">
                {/* Attendance CSV Export */}
                <div className="p-3 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/50 dark:bg-emerald-950/30 flex flex-col justify-between gap-2.5">
                  <div className="flex items-start gap-2.5">
                    <div className="p-2 rounded-lg bg-emerald-600 text-white shrink-0">
                      <CalendarCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                        Export Class Attendance CSV (တက်ရောက်မှု မှတ်တမ်း)
                      </h4>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                        အတန်းအလိုက် ကျောင်းသားများ၏ Attendance (%) ကို Excel / CSV ဖိုင်ထုတ်ယူရန်
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <select
                      value={selectedCsvCourseId}
                      onChange={(e) => setSelectedCsvCourseId(e.target.value)}
                      className="flex-1 min-w-0 px-2.5 py-1.5 text-xs font-semibold bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 rounded-lg text-slate-900 dark:text-white"
                    >
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code} — {c.title} ({c.enrolledStudentIds.length} ဦး)
                        </option>
                      ))}
                      <option value="all">All Classes Combined Report</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => handleExportAttendanceCSV(selectedCsvCourseId)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download CSV</span>
                    </button>
                  </div>
                </div>

                {/* Rules Acceptance Audit CSV */}
                <div className="p-3 rounded-xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/50 dark:bg-indigo-950/30 flex flex-col justify-between gap-2.5">
                  <div className="flex items-start gap-2.5">
                    <div className="p-2 rounded-lg bg-indigo-600 text-white shrink-0">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                        Export Rules Acceptance Audit ({acceptedStudentsCount}/{studentUsers.length} Accepted)
                      </h4>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                        စည်းကမ်းချက် ၁၄ ချက်ကို &ldquo;သိရှိ လိုက်နာပါမည်&rdquo; အတည်ပြုပြီးသူများ စာရင်းထုတ်ယူရန်
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <select
                      value={auditFilterMode}
                      onChange={(e) => setAuditFilterMode(e.target.value as 'accepted_only' | 'all')}
                      className="flex-1 min-w-0 px-2.5 py-1.5 text-xs font-semibold bg-white dark:bg-slate-800 border border-indigo-300 dark:border-indigo-700 rounded-lg text-slate-900 dark:text-white"
                    >
                      <option value="accepted_only">Accepted Only ({acceptedStudentsCount} ဦး)</option>
                      <option value="all">All Students ({studentUsers.length} ဦး — {pendingStudentsCount} pending)</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => handleExportAcceptanceAudit(auditFilterMode)}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Audit</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Create New Account Form (Supports Both Normal Single Mode & Quick Text Paste Mode) */}
            {showNewForm && (
              <div className="p-4 sm:p-5 rounded-2xl border-2 border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-800/90 space-y-4 text-xs shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-100 dark:border-slate-700 pb-3">
                  <div className="flex items-center gap-2 text-slate-900 dark:text-white font-extrabold text-sm">
                    <UserPlus className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>အကောင့်အသစ် ဖွင့်လှစ်ခြင်း (Create New Account)</span>
                  </div>

                  {/* Mode Switcher & Copy Student Form Template Button */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyStudentFormTemplate}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                        copiedTemplateNotice
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                          : 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700 hover:bg-amber-100'
                      }`}
                      title="ကျောင်းသားများထံ ပို့ပေးရမည့် အချက်အလက်တောင်းခံလွှာ ပုံစံကို Copy ကူးရန်"
                    >
                      {copiedTemplateNotice ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>
                        {copiedTemplateNotice
                          ? 'Form ပုံစံ Copy ကူးပြီးပါပြီ!'
                          : '📋 ကျောင်းသားထံ တောင်းရန် Form ပုံစံ Copy ကူးမည်'}
                      </span>
                    </button>

                    <div className="inline-flex rounded-xl p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                      <button
                        type="button"
                        onClick={() => {
                          setCreateEntryMode('single');
                          setErrorMsg(null);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                          createEntryMode === 'single'
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>ပုံမှန် တစ်ဦးချင်း ဖွင့်မည်</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCreateEntryMode('paste');
                          setErrorMsg(null);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                          createEntryMode === 'paste'
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>⚡ အများအပြား တစ်ပြိုင်နက် သွင်းမည် (Multi-Form Paste)</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowNewForm(false)}
                      className="text-slate-400 hover:text-slate-700 dark:hover:text-white font-bold cursor-pointer px-2 py-1"
                    >
                      ✕ ပိတ်မည်
                    </button>
                  </div>
                </div>

                {errorMsg && (
                  <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {createEntryMode === 'single' ? (
                  <form onSubmit={handleCreateAccountSubmit} className="space-y-4">
                    {/* Smart Student Registration Form Auto-Fill Bar */}
                    <div className="p-3 rounded-xl bg-indigo-50/75 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/80 space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="space-y-0.5">
                          <div className="font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5 text-xs">
                            <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                            <span>✨ ကျောင်းသားပို့လာသော Form စာသားမှ အကွက်များထဲသို့ Auto တန်းဖြည့်မည်</span>
                          </div>
                          <p className="text-[11px] text-slate-600 dark:text-slate-300">
                            ကျောင်းသားဖြည့်ပို့လာသော <strong>&ldquo;အမည်(Full Name): ... ဖုန်းနံပါတ်(Phone): ...&rdquo;</strong> စာသားကို Copy ကူးပြီး <strong>Clipboard မှ တန်းဖြည့်မည်</strong> နှိပ်ရုံ (သို့မဟုတ် အောက်အကွက်တွင် Paste ချရုံ) ဖြင့် သက်ဆိုင်ရာ အကွက်အားလုံး အလိုအလျောက် ပြည့်သွားပါမည်။
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleClipboardAutoFillSingle}
                          className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs cursor-pointer shadow-2xs flex items-center justify-center gap-1.5 shrink-0"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>📥 Clipboard မှ တန်းဖြည့်မည် (1-Click Auto-Fill)</span>
                        </button>
                      </div>

                      <textarea
                        rows={2}
                        value={singleSmartPasteText}
                        onChange={(e) => applySmartAutoFillToSingleForm(e.target.value)}
                        placeholder="သို့မဟုတ် ကျောင်းသားပို့လာသော Form စာသားကို ဤနေရာတွင် Paste (Ctrl+V / ဖိနှိပ်၍ Paste) ချလိုက်ပါက အောက်ရှိ အကွက်များထဲသို့ အလိုအလျောက် တန်းဝင်သွားပါမည်..."
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-indigo-500"
                      />

                      {singleAutoFilledNotice && (
                        <div className="px-3 py-1.5 rounded-lg bg-emerald-100/90 dark:bg-emerald-900/50 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 font-bold text-[11px] flex items-center justify-between gap-2">
                          <span>{singleAutoFilledNotice}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setSingleSmartPasteText('');
                              setSingleAutoFilledNotice(null);
                            }}
                            className="text-emerald-700 dark:text-emerald-300 hover:underline text-[10px] cursor-pointer shrink-0"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Role Selector */}
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        ၁။ အကောင့်အမျိုးအစား (Account Role) *
                      </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => handleRoleChange('student')}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                        selectedRole === 'student'
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-900 dark:text-emerald-100 ring-2 ring-emerald-500/20'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <GraduationCap className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <div>
                        <div className="font-bold text-xs">🎓 Student (ကျောင်းသား)</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">1 Device Only · No Profile Photo</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRoleChange('co_admin')}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                        selectedRole === 'co_admin'
                          ? 'bg-purple-50 dark:bg-purple-950/60 border-purple-500 text-purple-900 dark:text-purple-100 ring-2 ring-purple-500/20'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <Users className="w-5 h-5 text-purple-600 dark:text-purple-400 shrink-0" />
                      <div>
                        <div className="font-bold text-xs">👥 Co-Admin (တွဲဖက်ဆရာ)</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">Multi-Device · Post & Manage</div>
                      </div>
                    </button>

                    {!isCoAdminSession && (
                      <button
                        type="button"
                        onClick={() => handleRoleChange('admin')}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                          selectedRole === 'admin'
                            ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-900 dark:text-indigo-100 ring-2 ring-indigo-500/20'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                        <div>
                          <div className="font-bold text-xs">🛡️ Admin (ပင်မ အက်ဒမင်)</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">Multi-Device · Full Access</div>
                        </div>
                      </button>
                    )}
                  </div>
                </div>

                {/* Profile Picture Selection (Only for Admin & Co-Admin) */}
                {(selectedRole === 'admin' || selectedRole === 'co_admin') && (
                  <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2.5">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <Camera className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        <span>Profile Picture (Admin / Co-Admin ကိုယ်ရေးဓာတ်ပုံ)</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 rounded-lg text-[11px] font-semibold cursor-pointer"
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
                        alt="Preview"
                        className="w-12 h-12 rounded-full object-cover border-2 border-indigo-500 shrink-0"
                      />
                      <div className="flex items-center gap-2 overflow-x-auto pb-1">
                        {PRESET_AVATARS.map((p) => (
                          <button
                            type="button"
                            key={p.id}
                            onClick={() => setAvatar(p.url)}
                            className={`relative rounded-full p-0.5 transition-all shrink-0 cursor-pointer ${
                              avatar === p.url ? 'ring-2 ring-indigo-600 scale-105' : 'opacity-70 hover:opacity-100'
                            }`}
                          >
                            <img src={p.url} alt={p.name} className="w-8 h-8 rounded-full object-cover" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Core Account Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      ၂။ အမည် (Full Name) *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., မောင်မင်းခန့် / Aung Min"
                      value={name}
                      onChange={(e) => handleNameInputChange(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                      required
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-bold text-slate-700 dark:text-slate-300">
                        ၃။ Username (Login ID) *
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setIsUsernameManuallyEdited(false);
                          const autoUser = generateUsernameFromName(name);
                          if (autoUser) {
                            setUsername(autoUser);
                            if (!isEmailManuallyEdited) {
                              setEmail(`${autoUser}@swanarh.edu`);
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
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono">@</span>
                      <input
                        type="text"
                        placeholder="အမည်ရိုက်ထည့်ပါက Auto ပေါ်ပါမည်"
                        value={username}
                        onChange={(e) => {
                          const val = e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, '');
                          setUsername(val);
                          setIsUsernameManuallyEdited(Boolean(val));
                        }}
                        className="w-full pl-7 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-mono text-slate-900 dark:text-white"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-bold text-slate-700 dark:text-slate-300">
                        ၄။ Password (စကားဝှက်) *
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
                        className="w-full pl-3 pr-9 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-mono text-slate-900 dark:text-white"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Contact, Occupation/Education & Demographics */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      ၅။ Email *
                    </label>
                    <input
                      type="email"
                      placeholder="user@swanarh.edu"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setIsEmailManuallyEdited(Boolean(e.target.value));
                      }}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-mono text-slate-900 dark:text-white"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      ၆။ ဖုန်းနံပါတ် (Phone)
                    </label>
                    <input
                      type="text"
                      placeholder="+95 9..."
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-mono text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      ၇။ အလုပ်အကိုင် / ပညာအရည်အချင်း
                    </label>
                    <input
                      type="text"
                      placeholder="ဥပမာ - ကျောင်းသား / B.C.Sc / ဝန်ထမ်း"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      ၈။ ကျား / မ (Gender)
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setGender('male')}
                        className={`py-2 px-2 rounded-xl border font-bold text-xs cursor-pointer ${
                          gender === 'male'
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                        }`}
                      >
                        ♂ ကျား
                      </button>
                      <button
                        type="button"
                        onClick={() => setGender('female')}
                        className={`py-2 px-2 rounded-xl border font-bold text-xs cursor-pointer ${
                          gender === 'female'
                            ? 'bg-pink-600 text-white border-pink-600'
                            : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                        }`}
                      >
                        ♀ မ
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      ၉။ နေရပ်လိပ်စာ (Address)
                    </label>
                    <input
                      type="text"
                      placeholder="မြို့နယ် / လိပ်စာ"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Initial Class Enrollment for Students */}
                {selectedRole === 'student' && (
                  <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <label className="font-bold text-slate-800 dark:text-slate-200">
                        ၁၀။ တက်ရောက်ခွင့်ပြုမည့် အတန်းများ ({selectedInitialCourses.length} တန်း ရွေးထားသည်)
                      </label>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedInitialCourses(courses.map((c) => c.id))}
                          className="px-2 py-1 text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 rounded-lg cursor-pointer"
                        >
                          Select All
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedInitialCourses([])}
                          className="px-2 py-1 text-[11px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg cursor-pointer"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {courses.map((c) => {
                        const isChecked = selectedInitialCourses.includes(c.id);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => toggleInitialCourseSelection(c.id)}
                            className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2 ${
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
                              <div className="font-bold text-xs truncate">{c.code} · {c.title}</div>
                              <div className="text-[10px] text-slate-500 truncate">{c.batch}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                    <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                      <button
                        type="button"
                        onClick={() => setShowNewForm(false)}
                        className="px-3.5 py-2 text-slate-600 dark:text-slate-300 font-semibold cursor-pointer"
                      >
                        မလုပ်တော့ပါ
                      </button>
                      <button
                        type="submit"
                        onClick={() => setAutoCopyAfterSingleCreate(false)}
                        disabled={isSubmitting}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <UserPlus className="w-4 h-4" />
                        <span>{isSubmitting ? 'Creating...' : 'အကောင့်သစ် သိမ်းဆည်းမည်'}</span>
                      </button>
                      <button
                        type="submit"
                        onClick={() => setAutoCopyAfterSingleCreate(true)}
                        disabled={isSubmitting}
                        className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <Copy className="w-4 h-4" />
                        <span>
                          {isSubmitting
                            ? 'Creating & Copying...'
                            : '⚡ အကောင့်ဖွင့်ပြီး Login Info တန်း Copy ကူးမည်'}
                        </span>
                      </button>
                    </div>
                  </form>
                ) : (
                  /* နည်းလမ်း (၁) — Multi-Form / Quick Text Paste Mode */
                  <form onSubmit={handleQuickPasteBatchSubmit} className="space-y-4">
                    <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/70 text-slate-700 dark:text-slate-200 space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>
                            ကျောင်းသားများ ပို့လာသော Form စာသားများကို တစ်ပြိုင်နက် Paste ချပြီး အကောင့်အားလုံး တန်းဖွင့်သည့်စနစ်
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleClipboardPasteBatch}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer shadow-2xs flex items-center gap-1.5"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>📥 Clipboard မှ စာသား ထပ်ပေါင်းထည့်မည် (Paste from Clipboard)</span>
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                        ကျောင်းသား (၁) ဦး သို့မဟုတ် အများအပြား ပို့လာသော <strong>&ldquo;အမည်(Full Name): ... Email: ... ဖုန်းနံပါတ်(Phone): ... အလုပ်အကိုင်/ပညာအရည်အချင်း: ... ကျား/မ(Gender): ... နေရပ်လိပ်စာ(Address): ...&rdquo;</strong> ပုံစံများကို တစ်ဆက်တည်း Paste ကူးထည့်လိုက်ရုံဖြင့် စနစ်က တစ်ဦးချင်းစီ၏ သက်ဆိုင်ရာ အကွက်များထဲသို့ အလိုအလျောက် ခွဲခြားဖြည့်ပေးပြီး တစ်ပြိုင်နက် အကောင့်ဖွင့်ပေးပါမည်။
                      </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Left: Textarea Input */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="font-bold text-slate-800 dark:text-slate-200">
                            ၁။ ကျောင်းသားများ ပို့လာသော Form စာသားများ Paste ကူးထည့်ရန် *
                          </label>
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 font-bold text-[11px]">
                            {parsedPastePreview.length} ဦး အသင့်တွေ့ရှိသည်
                          </span>
                        </div>
                        <textarea
                          rows={9}
                          value={pasteRawText}
                          onChange={(e) => setPasteRawText(e.target.value)}
                          placeholder={`အမည်(Full Name): မောင်မင်းခန့်\nEmail: minkhant@gmail.com\nဖုန်းနံပါတ်(Phone): 0912345678\nအလုပ်အကိုင်/ပညာအရည်အချင်း: B.C.Sc\nကျား/မ(Gender): ကျား\nနေရပ်လိပ်စာ(Address): ရန်ကုန်မြို့\n\nအမည်(Full Name): မေသဇင်\nEmail: \nဖုန်းနံပါတ်(Phone): 0998765432\nအလုပ်အကိုင်/ပညာအရည်အချင်း: ဝန်ထမ်း\nကျား/မ(Gender): မ\nနေရပ်လိပ်စာ(Address): မန္တလေးမြို့`}
                          className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-sans text-xs leading-relaxed focus:outline-none focus:border-emerald-500"
                        />
                        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                          <span>💡 Email မပါလျှင်လည်း @swanarh.edu ဖြင့် အလိုအလျောက် ဖြည့်ပေးပါသည်။</span>
                          {pasteRawText && (
                            <button
                              type="button"
                              onClick={() => setPasteRawText('')}
                              className="text-rose-600 dark:text-rose-400 font-bold hover:underline cursor-pointer"
                            >
                              ရှင်းလင်းမည် (Clear)
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Right: Password Settings, Default Occupation & Auto-Segmented Live Preview Cards */}
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                              ၂။ Password သတ်မှတ်ပုံ
                            </label>
                            <div className="grid grid-cols-2 gap-1.5">
                              <button
                                type="button"
                                onClick={() => setPastePasswordMode('shared')}
                                className={`py-2 px-2 rounded-xl border font-bold text-[11px] cursor-pointer ${
                                  pastePasswordMode === 'shared'
                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                    : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                                }`}
                              >
                                တူညီသော Password
                              </button>
                              <button
                                type="button"
                                onClick={() => setPastePasswordMode('random')}
                                className={`py-2 px-2 rounded-xl border font-bold text-[11px] cursor-pointer ${
                                  pastePasswordMode === 'random'
                                    ? 'bg-emerald-600 text-white border-emerald-600'
                                    : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                                }`}
                              >
                                တစ်ဦးချင်း Auto သီးသန့်
                              </button>
                            </div>
                          </div>

                          {pastePasswordMode === 'shared' ? (
                            <div>
                              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                ဘုံသုံးမည့် Password *
                              </label>
                              <input
                                type="text"
                                value={pasteSharedPassword}
                                onChange={(e) => setPasteSharedPassword(e.target.value)}
                                placeholder="student123"
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-mono text-slate-900 dark:text-white"
                              />
                            </div>
                          ) : (
                            <div>
                              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                အလုပ်အကိုင်/ပညာအရည်အချင်း (Default)
                              </label>
                              <input
                                type="text"
                                value={pasteDefaultOccupation}
                                onChange={(e) => setPasteDefaultOccupation(e.target.value)}
                                placeholder="ဥပမာ - သင်တန်းသား (မထည့်လည်းရသည်)"
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                              />
                            </div>
                          )}
                        </div>

                        {/* Live Preview Cards with All 6 Auto-Extracted Fields */}
                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 space-y-2">
                          <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-300">
                            <span>🔍 အကွက်များထဲ အလိုအလျောက် ခွဲခြားဖြည့်ထားသော စာရင်း (Auto-Filled Preview)</span>
                            <span className="text-emerald-600 dark:text-emerald-400">{parsedPastePreview.length} ဦး</span>
                          </div>
                          {parsedPastePreview.length === 0 ? (
                            <div className="text-[11px] text-slate-400 py-6 text-center">
                              ဘယ်ဘက်အကွက်တွင် ကျောင်းသားပို့လာသော Form စာသားကို Paste ချလိုက်ပါက အမည်၊ Username၊ Email၊ ဖုန်း၊ အလုပ်အကိုင်၊ ကျား/မ၊ လိပ်စာ တို့ကို အလိုအလျောက် ခွဲခြားဖြည့်ပေးပါမည်...
                            </div>
                          ) : (
                            <div className="max-h-48 overflow-y-auto space-y-2 pr-1 text-[11px]">
                              {parsedPastePreview.map((p) => (
                                <div
                                  key={`${p.index}-${p.username}`}
                                  className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1 shadow-2xs"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="font-bold text-slate-900 dark:text-white truncate">
                                      <span className="text-slate-400 mr-1.5">#{p.index}</span>
                                      <span>👤 {p.name}</span>
                                      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                        {p.gender === 'female' ? '♀ မ' : '♂ ကျား'}
                                      </span>
                                    </div>
                                    <div className="shrink-0 font-mono flex items-center gap-2">
                                      <span className="text-indigo-600 dark:text-indigo-300 font-bold">
                                        @{p.username}
                                      </span>
                                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                        {pastePasswordMode === 'random' ? '[Auto-Pwd]' : pasteSharedPassword}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-slate-600 dark:text-slate-300 pt-0.5 border-t border-slate-100 dark:border-slate-700/60">
                                    <div className="truncate">📧 Email: <span className="font-mono">{p.email}</span></div>
                                    <div className="truncate">📞 ဖုန်း: <span className="font-mono">{p.phone || '—'}</span></div>
                                    <div className="truncate">💼 အလုပ်/ပညာ: {p.occupation || '—'}</div>
                                    <div className="truncate">📍 လိပ်စာ: {p.address || '—'}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Course Selection for Batch Paste */}
                    <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <label className="font-bold text-slate-800 dark:text-slate-200">
                          ၄။ တစ်ပြိုင်နက် တက်ရောက်ခွင့်ပြုမည့် အတန်းများ ({selectedInitialCourses.length} တန်း ရွေးထားသည်)
                        </label>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedInitialCourses(courses.map((c) => c.id))}
                            className="px-2 py-1 text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 rounded-lg cursor-pointer"
                          >
                            Select All
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedInitialCourses([])}
                            className="px-2 py-1 text-[11px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg cursor-pointer"
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {courses.map((c) => {
                          const isChecked = selectedInitialCourses.includes(c.id);
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => toggleInitialCourseSelection(c.id)}
                              className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2 ${
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
                                <div className="font-bold text-xs truncate">{c.code} · {c.title}</div>
                                <div className="text-[10px] text-slate-500 truncate">{c.batch}</div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                      <button
                        type="button"
                        onClick={() => setShowNewForm(false)}
                        className="px-3.5 py-2 text-slate-600 dark:text-slate-300 font-semibold cursor-pointer"
                      >
                        မလုပ်တော့ပါ
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting || parsedPastePreview.length === 0}
                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <Sparkles className="w-4 h-4" />
                        <span>
                          {isSubmitting
                            ? `Creating ${parsedPastePreview.length} Accounts...`
                            : `ကျောင်းသား (${parsedPastePreview.length}) ဦးလုံးကို တစ်ပြိုင်နက် အကောင့်ဖွင့်မည်`}
                        </span>
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* Clean Unified Search & Filter Control Bar */}
            <div className="p-3 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-2.5 shadow-2xs">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
                {/* Search Input */}
                <div className="relative flex-1 min-w-0">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setVisibleLimit(60);
                    }}
                    placeholder="အမည်၊ @username၊ ဖုန်းနံပါတ် သို့မဟုတ် လိပ်စာဖြင့် အမြန်ရှာရန်..."
                    className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-900 dark:text-white"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Course Enrollment Filter Dropdown */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="relative flex-1 sm:flex-initial">
                    <BookOpen className="w-3.5 h-3.5 text-indigo-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <select
                      value={courseFilterId}
                      onChange={(e) => {
                        setCourseFilterId(e.target.value);
                        if (e.target.value !== 'all') {
                          setRoleFilter('student');
                        }
                        setVisibleLimit(60);
                      }}
                      className="w-full sm:w-auto pl-8 pr-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 cursor-pointer focus:outline-none focus:border-indigo-500"
                    >
                      <option value="all">အတန်းအားလုံး (All Classes)</option>
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code} — {c.title} ({c.enrolledStudentIds.length} ဦး)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Role & Rule Status Segmented Pills */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-700/60">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setRoleFilter('all');
                      setRuleStatusFilter('all');
                      setCourseFilterId('all');
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      roleFilter === 'all' && ruleStatusFilter === 'all' && courseFilterId === 'all'
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    အားလုံး ({allUsers.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRoleFilter('staff');
                      setRuleStatusFilter('all');
                      setCourseFilterId('all');
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      roleFilter === 'staff'
                        ? 'bg-purple-600 text-white shadow-2xs'
                        : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    🛡️ Admin & Co-Admin ({staffUsers.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRoleFilter('student');
                      setRuleStatusFilter('all');
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      roleFilter === 'student' && ruleStatusFilter === 'all'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    🎓 ကျောင်းသားများ ({studentUsers.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRoleFilter('student');
                      setRuleStatusFilter(ruleStatusFilter === 'accepted' ? 'all' : 'accepted');
                    }}
                    className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                      ruleStatusFilter === 'accepted'
                        ? 'bg-emerald-700 text-white'
                        : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Rule Accepted ({acceptedStudentsCount})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRoleFilter('student');
                      setRuleStatusFilter(ruleStatusFilter === 'pending' ? 'all' : 'pending');
                    }}
                    className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                      ruleStatusFilter === 'pending'
                        ? 'bg-amber-600 text-white'
                        : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60'
                    }`}
                  >
                    <span>⏳ Pending ({pendingStudentsCount})</span>
                  </button>
                </div>

                <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                  ပြသထားသည်: <strong>{Math.min(visibleLimit, filteredUsers.length)}</strong> / {filteredUsers.length} ဦး
                </span>
              </div>
            </div>

            {/* Clean, Easy-to-Scan User Directory List */}
            <div className="space-y-2.5">
              {filteredUsers.length === 0 ? (
                <div className="p-10 text-center text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800">
                  ရှာဖွေမှုနှင့် ကိုက်ညီသော အကောင့် မတွေ့ရှိပါ။
                </div>
              ) : (
                filteredUsers.slice(0, visibleLimit).map((user, index) => {
                  const isProtectedPrimaryAdmin = isCoAdminSession && user.role === 'admin';
                  const isRevealed = !isProtectedPrimaryAdmin && revealedPasswords[user.id];
                  const userPassword = ClassroomDB.getDecryptedPassword(user);
                  const pwdFingerprint = ClassroomDB.getPasswordFingerprint(user);
                  const normalizedGender = user.gender?.toLowerCase();
                  const enrolledCount =
                    user.role === 'student'
                      ? courses.filter((c) => c.enrolledStudentIds.includes(user.id)).length
                      : courses.length;

                  return (
                    <div
                      key={user.id}
                      className="p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-800/90 hover:border-indigo-300 dark:hover:border-slate-700 transition-all shadow-2xs space-y-3"
                    >
                      {/* Top Row: User Identity + Quick Credentials Strip + Delete */}
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                        {/* Left: Identity & Contact */}
                        <div className="flex items-start gap-3 min-w-0">
                          {user.role === 'admin' || user.role === 'co_admin' ? (
                            <div className="relative group/avatar shrink-0">
                              <img
                                src={user.avatar || PRESET_AVATARS[0].url}
                                alt={user.name}
                                loading="lazy"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = PRESET_AVATARS[0].url;
                                }}
                                className="w-11 h-11 rounded-full object-cover border-2 border-indigo-200 dark:border-indigo-800"
                              />
                              {!isProtectedPrimaryAdmin && (
                                <button
                                  type="button"
                                  onClick={() => setEditingAvatarUser(user)}
                                  className="absolute inset-0 bg-slate-900/60 rounded-full opacity-0 group-hover/avatar:opacity-100 flex items-center justify-center text-white transition-opacity cursor-pointer"
                                  title="Change Profile Photo"
                                >
                                  <Camera className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          ) : (
                            /* Clean Numbered Index Badge for Students (Zero Student Profile Photo) */
                            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-700/80 text-slate-700 dark:text-slate-200 font-mono text-xs font-extrabold flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-600">
                              #{index + 1}
                            </div>
                          )}

                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm font-extrabold text-slate-900 dark:text-white inline-flex items-center gap-1">
                                <span>{user.name}</span>
                                {user.role === 'student' && (
                                  <Shield
                                    className={`w-3.5 h-3.5 shrink-0 ${
                                      user.rulesAccepted
                                        ? 'text-emerald-500 fill-emerald-500/20'
                                        : 'text-slate-300 dark:text-slate-600'
                                    }`}
                                  />
                                )}
                              </span>

                              <span className="text-[11px] font-mono font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/70 px-2 py-0.5 rounded-md border border-indigo-200/60 dark:border-indigo-800/50">
                                @{user.username}
                              </span>

                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  user.role === 'admin'
                                    ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                                    : user.role === 'co_admin'
                                    ? 'bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                                    : 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                }`}
                              >
                                {user.role === 'admin'
                                  ? '🛡️ Admin'
                                  : user.role === 'co_admin'
                                  ? '👥 Co-Admin'
                                  : '🎓 Student'}
                              </span>

                              {normalizedGender && (
                                <span
                                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                    normalizedGender === 'female'
                                      ? 'bg-pink-50 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300'
                                      : 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300'
                                  }`}
                                >
                                  {normalizedGender === 'female' ? '♀ မ' : '♂ ကျား'}
                                </span>
                              )}

                              {user.role === 'student' &&
                                (user.rulesAccepted ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/90 text-emerald-800 dark:text-emerald-300">
                                    <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                    <span>သိရှိ လိုက်နာပါမည်</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300">
                                    <span>⏳ စည်းကမ်းချက် လက်ခံရန်ကျန်</span>
                                  </span>
                                ))}
                            </div>

                            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              <span>{user.phone || 'No phone'}</span>
                              <span>·</span>
                              <span className="truncate">{user.email}</span>
                              {user.title && (
                                <>
                                  <span>·</span>
                                  <span className="font-sans font-semibold text-indigo-700 dark:text-indigo-300">
                                    💼 {user.title}
                                  </span>
                                </>
                              )}
                              {user.address && (
                                <>
                                  <span>·</span>
                                  <span className="font-sans text-slate-600 dark:text-slate-300">
                                    📍 {user.address}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right: Clean Compact Credentials Strip & Actions */}
                        <div className="flex flex-wrap items-center justify-between lg:justify-end gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-700/50 shrink-0">
                          {isProtectedPrimaryAdmin ? (
                            <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-xl border border-indigo-200 dark:border-indigo-800">
                              🔒 Protected (Primary Admin)
                            </span>
                          ) : (
                            <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 dark:bg-slate-900/90 px-2.5 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700">
                              <span
                                className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/70 px-1.5 py-0.5 rounded-md border border-emerald-200/70 dark:border-emerald-800/60"
                                title={`Encrypted in DB & LocalStorage (${pwdFingerprint})`}
                              >
                                🔒 ENC
                              </span>
                              <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200 min-w-[64px]">
                                {isRevealed ? userPassword : '••••••••'}
                              </span>
                              <button
                                type="button"
                                onClick={() => toggleRevealPassword(user.id)}
                                className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-pointer"
                                title={isRevealed ? 'Hide Password' : 'Decrypt & Show Password'}
                              >
                                {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  const userEnrolledCourses =
                                    user.role === 'student'
                                      ? courses
                                          .filter((c) => c.enrolledStudentIds.includes(user.id))
                                          .map((c) => c.code)
                                          .join(', ')
                                      : 'All Courses (Staff Access)';
                                  handleCopyCredentials({
                                    name: user.name,
                                    username: user.username,
                                    password: userPassword,
                                    role: user.role,
                                    occupation: user.title,
                                    courseName: userEnrolledCourses || undefined,
                                    gender: normalizedGender === 'female' ? 'Female (မ)' : 'Male (ကျား)',
                                    address: user.address,
                                    loginUrl: getOfficialLoginUrl(),
                                  });
                                  setToastMsg(
                                    `📋 "${user.name}" (@${user.username}) ၏ Login Link, Username နှင့် Password အချက်အလက်အားလုံး ကူးယူပြီးပါပြီ။`
                                  );
                                  setTimeout(() => setToastMsg(null), 3000);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold cursor-pointer"
                                title="Copy Login Link, Name, Username & Password"
                              >
                                <Copy className="w-3 h-3" />
                                <span>Copy</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setResettingUser(user);
                                  setNewUserPassword(userPassword);
                                  setShowResetPassword(true);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/70 hover:bg-amber-100 text-amber-700 dark:text-amber-300 text-[11px] font-bold cursor-pointer"
                                title="Reset Password"
                              >
                                <KeyRound className="w-3 h-3" />
                                <span>Reset</span>
                              </button>
                            </div>
                          )}

                          {!isProtectedPrimaryAdmin && (
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(user)}
                              className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl transition-colors cursor-pointer"
                              title="Delete Account"
                              aria-label="Delete user"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Bottom Row: 1-Click Classroom Enrollment Manager (For Students) */}
                      {user.role === 'student' && courses.length > 0 && (
                        <div className="pt-2.5 border-t border-slate-100 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mr-1">
                              အတန်းများ ({enrolledCount}/{courses.length}):
                            </span>
                            {courses.map((course) => {
                              const isEnrolled = course.enrolledStudentIds.includes(user.id);
                              const attPct = isEnrolled
                                ? ClassroomDB.calculateTotalAttendancePercentage(course.id, user.id)
                                : null;

                              return (
                                <button
                                  key={course.id}
                                  type="button"
                                  onClick={() =>
                                    handleToggleCourseForStudent(user.id, course.id, isEnrolled)
                                  }
                                  className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                    isEnrolled
                                      ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700 hover:bg-rose-50 dark:hover:bg-rose-950/60 hover:text-rose-700 hover:border-rose-300'
                                      : 'bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 hover:text-indigo-600 border border-slate-200 dark:border-slate-700'
                                  }`}
                                  title={
                                    isEnrolled
                                      ? `${course.title} (${attPct}% Attendance) — နှိပ်ပါက ဤအတန်းမှ ထုတ်ပယ်မည်`
                                      : `${course.title} အတန်းသို့ ထည့်သွင်းရန် နှိပ်ပါ`
                                  }
                                >
                                  {isEnrolled ? (
                                    <>
                                      <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400 stroke-[3]" />
                                      <span>
                                        {course.code} ({attPct}%)
                                      </span>
                                    </>
                                  ) : (
                                    <span>+ {course.code}</span>
                                  )}
                                </button>
                              );
                            })}
                          </div>

                          {courses.length > 1 && (
                            <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                              {enrolledCount < courses.length && (
                                <button
                                  type="button"
                                  onClick={() => handleEnrollStudentInAllCourses(user.id, true)}
                                  className="text-[10px] font-bold px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-900 hover:bg-emerald-50 text-slate-600 dark:text-slate-300 hover:text-emerald-700 cursor-pointer"
                                >
                                  + အားလုံးထည့်မည်
                                </button>
                              )}
                              {enrolledCount > 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleEnrollStudentInAllCourses(user.id, false)}
                                  className="text-[10px] font-bold px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-900 hover:bg-rose-50 text-slate-500 dark:text-slate-400 hover:text-rose-600 cursor-pointer"
                                >
                                  အားလုံးဖြုတ်မည်
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              {/* Progressive Load More Bar */}
              {filteredUsers.length > visibleLimit && (
                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs">
                  <span className="text-slate-600 dark:text-slate-300 font-medium">
                    ပြသထားသည်: <strong>{visibleLimit}</strong> / စုစုပေါင်း <strong>{filteredUsers.length}</strong> ဦး
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setVisibleLimit((prev) => prev + 100)}
                      className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer"
                    >
                      + နောက်ထပ် ၁၀၀ ဦး ပြမည်
                    </button>
                    <button
                      type="button"
                      onClick={() => setVisibleLimit(filteredUsers.length)}
                      className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold cursor-pointer"
                    >
                      အားလုံးပြမည် ({filteredUsers.length})
                    </button>
                  </div>
                </div>
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
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer"
                  >
                    {showResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setResettingUser(null)}
                    className="px-3 py-1.5 text-slate-600 dark:text-slate-300 font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveResetPassword}
                    className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold cursor-pointer shadow-xs"
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
                    className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold cursor-pointer shadow-xs"
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
