import React, { useState, useEffect } from 'react';
import {
  X,
  BookOpen,
  GraduationCap,
  ShieldCheck,
  CalendarCheck,
  MessageSquareLock,
  Award,
  Library,
  Truck,
  KeyRound,
  UserPlus,
  Filter,
  Copy,
  Check,
  Lock,
  CheckCircle2,
} from 'lucide-react';
import { User } from '../types/classroom';
import { OFFICIAL_ACADEMY_LOGO } from '../assets/officialLogoData';

interface ClassroomGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
}

export const ClassroomGuideModal: React.FC<ClassroomGuideModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
  const isStaff = currentUser.role === 'admin' || currentUser.role === 'co_admin';
  // Automatically show Teacher Guide for Admin/Co-Admin, and Student Guide for Students
  const [activeRoleTab, setActiveRoleTab] = useState<'student' | 'teacher'>(
    isStaff ? 'teacher' : 'student'
  );
  const [copiedQuickGuide, setCopiedQuickGuide] = useState(false);

  useEffect(() => {
    setActiveRoleTab(isStaff ? 'teacher' : 'student');
  }, [isStaff, currentUser.id, isOpen]);

  if (!isOpen) return null;

  const handleCopyStudentQuickGuide = () => {
    const guideText = [
      `📖 SwanArh Digital Academy — Classroom အသုံးပြုနည်း (User Guide)`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `၁။ 🔐 Login ဝင်ခြင်းနှင့် စကားဝှက်ပြောင်းခြင်း:`,
      `   • သင်တန်းမှပေးသော Username နှင့် Password ဖြင့် Login ဝင်ပါ (Device တစ်ခုတည်းသာ ဝင်ခွင့်ရှိပါသည်)။`,
      `   • စည်းကမ်းချက်များကို ဖတ်ရှုပြီး "သိရှိလိုက်နာပါမည်" ကို နှိပ်ပါ။`,
      `   • ညာဘက်အပေါ်ထောင့် Menu မှ "Change Password" တွင် မိမိစိတ်ကြိုက် Password အသစ်ပြောင်းပါ။`,
      ``,
      `၂။ ✅ နေ့စဉ် Attendance (ကျောင်းတက်ချိန်) နှိပ်ခြင်း:`,
      `   • မိမိတက်ရောက်သည့် အတန်းထဲသို့ ဝင်ပြီး "Attendance" Tab ကို နှိပ်ပါ။`,
      `   • ဆရာမှ Attendance ဖွင့်ထားချိန်တွင် "Present (တက်ရောက်)" ခလုတ်ကို ကိုယ်တိုင်နှိပ်ပါ။`,
      ``,
      `၃။ 🏛️ Library စာကြည့်တိုက် နှင့် ဗီဒီယိုများ ကြည့်ရှုခြင်း:`,
      `   • ပင်မစာမျက်နှာ အပေါ်တန်း (သို့မဟုတ် Menu) ရှိ "Library စာကြည့်တိုက်" ကို နှိပ်ပါ။`,
      `   • 🎬 YouTube (@swanarhacademy) နှင့် TikTok (@dr..si.thu.aung.s) ဗီဒီယိုအားလုံးကို သင်တန်းသားတိုင်း ကန့်သတ်ချက်မရှိ တိုက်ရိုက်ကြည့်ရှုနိုင်ပါသည်။`,
      `   • 📚 eBook စာအုပ်များနှင့် စာရှည်မှတ်စုများကို ဖတ်ရှုနိုင်ရန် သတ်မှတ်ထားသော အတန်း၊ Roll Call % (ဥပမာ 80% နှင့်အထက်)၊ Exam နှင့် အချက်အလက် Form များ ပြည့်စုံအောင် ဖြည့်သွင်းထားရပါမည်။`,
      ``,
      `၄။ 💬 သီးသန့်စာ (Private Notes) ပေးပို့ခြင်း:`,
      `   • အတန်းထဲရှိ "သီးသန့်စာ" Tab မှတစ်ဆင့် ဆရာ့ထံ သင်ခန်းစာမေးမြန်းခြင်း သို့မဟုတ် ခွင့်တိုင်ကြားခြင်းများကို သီးသန့် ပေးပို့နိုင်ပါသည်။`,
      ``,
      `၅။ 📝 Exam ဖြေဆိုခြင်းနှင့် ကျောင်းသားအချက်အလက် Form ဖြည့်ခြင်း:`,
      `   • အတန်းထဲရှိ "Exam Room" Tab တွင် ဆရာတင်ထားသော စာမေးပွဲ (Exam) များနှင့် အချက်အလက် Form များကို အချိန်မီ ဖြည့်သွင်းဖြေဆိုပါ။`,
      ``,
      `၆။ 📦 စာအုပ်မှာယူရန် (Book Delivery):`,
      `   • အတန်းထဲရှိ "စာအုပ်ယူရန်" Tab တွင် မိမိအမည်၊ ဖုန်းနံပါတ်နှင့် စာအုပ်ပို့ဆောင်ရမည့် လိပ်စာအပြည့်အစုံကို ဖြည့်သွင်းနိုင်ပါသည်။`,
      `━━━━━━━━━━━━━━━━━━━━`,
    ].join('\n');

    navigator.clipboard.writeText(guideText).catch(() => {});
    setCopiedQuickGuide(true);
    setTimeout(() => setCopiedQuickGuide(false), 3500);
  };

  // Students always see the Student Guide directly; Admin / Co-Admin see Teacher Guide by default (with option to preview Student Guide)
  const displayMode: 'student' | 'teacher' = isStaff ? activeRoleTab : 'student';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-4">
      <div className="neu-raised rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-indigo-500/20">
        {/* Top Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-5 sm:px-6 py-4 text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={OFFICIAL_ACADEMY_LOGO}
              alt="Swanarh Academy Logo"
              className="w-10 h-10 rounded-2xl object-contain bg-white p-1 shadow-md border border-amber-400/50 shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-mono uppercase tracking-widest text-amber-300 font-bold">
                  {displayMode === 'teacher'
                    ? '👨‍🏫 ဆရာလမ်းညွှန် (ADMIN / CO-ADMIN GUIDE)'
                    : '🎓 ကျောင်းသားလမ်းညွှန် (STUDENT GUIDE)'}
                </span>
              </div>
              <h2 className="text-sm sm:text-lg font-extrabold tracking-tight text-white truncate">
                📖 Classroom အသုံးပြုနည်း (User Guide)
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer shrink-0"
            title="ပိတ်မည်"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub-Toolbar: Role Banner for Students, or Teacher/Student Switcher + Copy Button for Staff */}
        <div className="px-5 sm:px-6 py-3 bg-slate-100/90 dark:bg-slate-900/90 border-b border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          {isStaff ? (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setActiveRoleTab('teacher')}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                  displayMode === 'teacher'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'neu-btn text-slate-700 dark:text-slate-300'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>👨‍🏫 ဆရာလမ်းညွှန် (Admin / Co-Admin)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveRoleTab('student')}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                  displayMode === 'student'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'neu-btn text-slate-700 dark:text-slate-300'
                }`}
              >
                <GraduationCap className="w-4 h-4" />
                <span>🎓 ကျောင်းသားလမ်းညွှန် ကြည့်ရန်</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs font-extrabold text-indigo-800 dark:text-indigo-300">
              <GraduationCap className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>ကျောင်းသားများအတွက် အလွယ်ကူဆုံး အဆင့် (၆) ဆင့် အသုံးပြုနည်း လမ်းညွှန်</span>
            </div>
          )}

          {isStaff && (
            <button
              type="button"
              onClick={handleCopyStudentQuickGuide}
              className="px-3 py-1.5 rounded-xl neu-btn text-xs font-extrabold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5 cursor-pointer"
              title="ကျောင်းသားများထံ Viber / Messenger မှ ပေးပို့ရန် လမ်းညွှန်စာသား Copy ကူးမည်"
            >
              {copiedQuickGuide ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>
                {copiedQuickGuide
                  ? 'Copy ကူးပြီးပါပြီ!'
                  : 'ကျောင်းသားလမ်းညွှန် Copy ကူးရန်'}
              </span>
            </button>
          )}
        </div>

        {/* Main Scrollable Simple & Easy-to-Read Guide Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5 text-xs sm:text-sm leading-relaxed">
          {displayMode === 'student' ? (
            /* 🎓 STUDENT GUIDE — SIMPLE, CLEAR, STEP-BY-STEP */
            <div className="space-y-3">
              {/* Step 1 */}
              <div className="neu-inset rounded-2xl p-4 flex items-start gap-3.5 border border-slate-200/70 dark:border-slate-800">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white font-extrabold flex items-center justify-center shrink-0 text-sm">
                  ၁
                </div>
                <div className="space-y-1 min-w-0">
                  <h3 className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <KeyRound className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span>အကောင့်ဝင်ခြင်း (Login) နှင့် Password ပြောင်းခြင်း</span>
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    • ဖုန်း သို့မဟုတ် ကွန်ပျူတာ <strong>(၁) ခုတည်းတွင်သာ</strong> Login ဝင်နိုင်ပါသည် (စက်ပြောင်းလိုပါက အရင်စက်မှ Logout ထွက်ပါ)။
                    <br />• ပထမဆုံးဝင်ချိန်တွင် စည်းကမ်းချက်များကိုဖတ်၍ <strong>&quot;သိရှိလိုက်နာပါမည်&quot;</strong> ကို နှိပ်ပြီး ညာဘက်အပေါ်ထောင့် Menu မှ <strong>&quot;Change Password&quot;</strong> တွင် မိမိစကားဝှက်အသစ် ပြောင်းပါ။
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="neu-inset rounded-2xl p-4 flex items-start gap-3.5 border border-slate-200/70 dark:border-slate-800">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white font-extrabold flex items-center justify-center shrink-0 text-sm">
                  ၂
                </div>
                <div className="space-y-1 min-w-0">
                  <h3 className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <CalendarCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>နေ့စဉ် Attendance (ကျောင်းတက်ချိန်) နှိပ်ခြင်း</span>
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    • မိမိအတန်းထဲသို့ဝင်ပြီး <strong>&quot;Attendance&quot;</strong> Tab ကိုနှိပ်ပါ။
                    <br />• ဆရာမှ Attendance ဖွင့်ပေးထားချိန်တွင် <strong>&quot;Present (တက်ရောက်)&quot;</strong> ခလုတ်ကို ကိုယ်တိုင်နှိပ်ရပါမည် (သတ်မှတ်ချိန်ကျော်ပါက Late အဖြစ် မှတ်တမ်းဝင်ပါမည်)။
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="neu-inset rounded-2xl p-4 flex items-start gap-3.5 border border-amber-500/30 bg-amber-50/30 dark:bg-amber-950/15">
                <div className="w-8 h-8 rounded-xl bg-amber-600 text-white font-extrabold flex items-center justify-center shrink-0 text-sm">
                  ၃
                </div>
                <div className="space-y-1 min-w-0">
                  <h3 className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Library className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>Library စာကြည့်တိုက် (ဗီဒီယို၊ eBook နှင့် စာရှည်မှတ်စုများ)</span>
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    • 🎬 <strong>YouTube &amp; TikTok ဗီဒီယိုများ:</strong> ဗီဒီယိုအသစ်တင်တိုင်း အလိုအလျောက် တန်းပေါ်ပြီး <strong>သင်တန်းသားအားလုံး ကန့်သတ်ချက်မရှိ</strong> တိုက်ရိုက်ကြည့်ရှုနိုင်ပါသည်။
                    <br />• 📚 <strong>eBook နှင့် စာရှည်မှတ်စုများ:</strong> ဆရာသတ်မှတ်ထားသော အတန်း၊ <strong>Roll Call % (ဥပမာ 80% နှင့်အထက်)</strong>၊ <strong>Exam</strong> နှင့် <strong>အချက်အလက် Form</strong> ပြည့်မီသူများ ဖတ်ရှုနိုင်ပါသည်။
                  </p>
                </div>
              </div>

              {/* Step 4 */}
              <div className="neu-inset rounded-2xl p-4 flex items-start gap-3.5 border border-slate-200/70 dark:border-slate-800">
                <div className="w-8 h-8 rounded-xl bg-purple-600 text-white font-extrabold flex items-center justify-center shrink-0 text-sm">
                  ၄
                </div>
                <div className="space-y-1 min-w-0">
                  <h3 className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <MessageSquareLock className="w-4 h-4 text-purple-500 shrink-0" />
                    <span>သီးသန့်စာ (Private Notes) ဖြင့် ဆရာ့ထံ စာပို့ခြင်း / ခွင့်တိုင်ခြင်း</span>
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    • အတန်းထဲရှိ <strong>&quot;သီးသန့်စာ&quot;</strong> Tab မှတစ်ဆင့် ဆရာ့ထံ သင်ခန်းစာမေးမြန်းခြင်း သို့မဟုတ် ခွင့်တိုင်ကြားခြင်းများကို သီးသန့်ပေးပို့နိုင်ပါသည် (အခြားကျောင်းသားများ မမြင်ရပါ)။
                  </p>
                </div>
              </div>

              {/* Step 5 */}
              <div className="neu-inset rounded-2xl p-4 flex items-start gap-3.5 border border-slate-200/70 dark:border-slate-800">
                <div className="w-8 h-8 rounded-xl bg-rose-600 text-white font-extrabold flex items-center justify-center shrink-0 text-sm">
                  ၅
                </div>
                <div className="space-y-1 min-w-0">
                  <h3 className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-rose-500 shrink-0" />
                    <span>Exam စာမေးပွဲ နှင့် အချက်အလက် Form ဖြည့်သွင်းခြင်း</span>
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    • အတန်းထဲရှိ <strong>&quot;Exam Room&quot;</strong> Tab တွင် ဆရာတင်ပေးထားသော စာမေးပွဲများ (Exams) နှင့် ကျောင်းသားအချက်အလက် Form များကို ဝင်ရောက်ဖြေဆိုပါ။
                  </p>
                </div>
              </div>

              {/* Step 6 */}
              <div className="neu-inset rounded-2xl p-4 flex items-start gap-3.5 border border-slate-200/70 dark:border-slate-800">
                <div className="w-8 h-8 rounded-xl bg-cyan-600 text-white font-extrabold flex items-center justify-center shrink-0 text-sm">
                  ၆
                </div>
                <div className="space-y-1 min-w-0">
                  <h3 className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-cyan-500 shrink-0" />
                    <span>စာအုပ်မှာယူရန် (Book Delivery) နှင့် စွမ်းအား Website</span>
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    • အတန်းထဲရှိ <strong>&quot;စာအုပ်ယူရန်&quot;</strong> Tab တွင် စာအုပ်ပို့ဆောင်ရမည့် လိပ်စာနှင့် ဖုန်းနံပါတ်ကို ဖြည့်သွင်းနိုင်ပြီး၊ ပင်မစာမျက်နှာရှိ <strong>&quot;စွမ်းအား Website&quot;</strong> မှ သင်တန်းကျောင်း Website ကို တိုက်ရိုက်ကြည့်ရှုနိုင်ပါသည်။
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* 👨‍🏫 TEACHER (ADMIN / CO-ADMIN) GUIDE — SIMPLE, CLEAR, STEP-BY-STEP */
            <div className="space-y-3">
              {/* Teacher Step 1 */}
              <div className="neu-inset rounded-2xl p-4 flex items-start gap-3.5 border border-slate-200/70 dark:border-slate-800">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white font-extrabold flex items-center justify-center shrink-0 text-sm">
                  ၁
                </div>
                <div className="space-y-1 min-w-0">
                  <h3 className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <UserPlus className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span>ကျောင်းသားအသစ် ထည့်သွင်းခြင်းနှင့် Login + လမ်းညွှန် Copy ကူးခြင်း</span>
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    • <strong>Manage Users</strong> သို့မဟုတ် အတန်းတွင်းရှိ <strong>&quot;+ ကျောင်းသားထည့်ရန်&quot;</strong> မှ အကောင့်သစ်ဖွင့်ပြီး <strong>Copy Login Info</strong> နှိပ်လိုက်သည်နှင့် Username, Password, Login Link နှင့်အတူ <strong>&quot;📖 Classroom အသုံးပြုနည်း (User Guide) သွားဖတ်ရန် လမ်းညွှန်&quot;</strong> ပါ တစ်ခါတည်း ပါဝင်ပြီးဖြစ်ပါသည်။
                  </p>
                </div>
              </div>

              {/* Teacher Step 2 */}
              <div className="neu-inset rounded-2xl p-4 flex items-start gap-3.5 border border-slate-200/70 dark:border-slate-800">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white font-extrabold flex items-center justify-center shrink-0 text-sm">
                  ၂
                </div>
                <div className="space-y-1 min-w-0">
                  <h3 className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Filter className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Attendance ဖွင့်/ပိတ် နှင့် Roll Call % Filter (100%, ≥80%) စစ်ဆေးခြင်း</span>
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    • <strong>&quot;Attendance&quot;</strong> Tab တွင် နေ့စဉ် Attendance ဖွင့်/ပိတ် ပြုလုပ်နိုင်ပြီး၊ ကျောင်းသားများကို <strong>Roll Call 100%, ≥ 80%, 50%–79%, &lt; 50%</strong> နှင့် <strong>နှိပ်ပြီး / မနှိပ်ရသေး</strong> Filter များဖြင့် အောက်သို့အရှည်ကြီး ဆွဲကြည့်စရာမလိုဘဲ လွယ်ကူရှင်းလင်းစွာ စစ်ဆေးနိုင်ပါသည်။
                  </p>
                </div>
              </div>

              {/* Teacher Step 3 */}
              <div className="neu-inset rounded-2xl p-4 flex items-start gap-3.5 border border-slate-200/70 dark:border-slate-800">
                <div className="w-8 h-8 rounded-xl bg-purple-600 text-white font-extrabold flex items-center justify-center shrink-0 text-sm">
                  ၃
                </div>
                <div className="space-y-1 min-w-0">
                  <h3 className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <MessageSquareLock className="w-4 h-4 text-purple-500 shrink-0" />
                    <span>သီးသန့်စာမှ Attendance တိုက်ရိုက်ခြစ်ပေးခြင်း (ကိုယ်တိုင်စာပြန်စနစ်)</span>
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    • <strong>&quot;သီးသန့်စာ&quot;</strong> Tab တွင် ကျောင်းသားတစ်ဦးချင်းစီအတွက် <strong>Present / Late / Excused / Absent</strong> တစ်ချက်နှိပ်၍ ခြစ်ပေးနိုင်ပါသည်။ Auto စာပြန်ပို့ခြင်း မရှိဘဲ ဆရာ/လက်ထောက်ဆရာ ကိုယ်တိုင် စိတ်ကြိုက်စာပြန်နိုင်ပါသည်။
                  </p>
                </div>
              </div>

              {/* Teacher Step 4 */}
              <div className="neu-inset rounded-2xl p-4 flex items-start gap-3.5 border border-amber-500/30 bg-amber-50/30 dark:bg-amber-950/15">
                <div className="w-8 h-8 rounded-xl bg-amber-600 text-white font-extrabold flex items-center justify-center shrink-0 text-sm">
                  ၄
                </div>
                <div className="space-y-1 min-w-0">
                  <h3 className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Library စာကြည့်တိုက် (ဗီဒီယို Auto-Sync နှင့် eBook/Note ကန့်သတ်ခြင်း)</span>
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    • 🎬 <strong>YouTube &amp; TikTok ဗီဒီယိုများ:</strong> Channel တွင် ဗီဒီယိုအသစ်တင်တိုင်း အလိုအလျောက် တန်းပေါ်ပြီး သင်တန်းသားတိုင်း ကြည့်ရှုနိုင်ပါသည်။
                    <br />• 📚 <strong>eBook နှင့် စာရှည်မှတ်စု ကန့်သတ်ခြင်း:</strong> မည်သည့်အတန်းကို မြင်စေမည်၊ မည်သည့်အတန်းကို ဖျောက်ထားမည်၊ <strong>Roll Call % (ဥပမာ 80%)</strong>၊ <strong>Exam မဖြေသူ</strong> နှင့် <strong>Form မဖြည့်သူများကို မမြင်စေရန်</strong> ကန့်သတ်နိုင်ပါသည်။
                  </p>
                </div>
              </div>

              {/* Teacher Step 5 */}
              <div className="neu-inset rounded-2xl p-4 flex items-start gap-3.5 border border-slate-200/70 dark:border-slate-800">
                <div className="w-8 h-8 rounded-xl bg-rose-600 text-white font-extrabold flex items-center justify-center shrink-0 text-sm">
                  ၅
                </div>
                <div className="space-y-1 min-w-0">
                  <h3 className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-rose-500 shrink-0" />
                    <span>Exam စာမေးပွဲ နှင့် ကျောင်းသား အချက်အလက် Form စီမံခြင်း</span>
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    • <strong>&quot;Exam Room&quot;</strong> Tab တွင် စာမေးပွဲများ (Exams) နှင့် အချက်အလက်ကောက်ယူသည့် Data Form များ ဖန်တီးနိုင်ပြီး အဖြေစာရင်းကို CSV / Excel ထုတ်ယူနိုင်ပါသည်။
                  </p>
                </div>
              </div>

              {/* Teacher Step 6 */}
              <div className="neu-inset rounded-2xl p-4 flex items-start gap-3.5 border border-slate-200/70 dark:border-slate-800">
                <div className="w-8 h-8 rounded-xl bg-cyan-600 text-white font-extrabold flex items-center justify-center shrink-0 text-sm">
                  ၆
                </div>
                <div className="space-y-1 min-w-0">
                  <h3 className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-cyan-500 shrink-0" />
                    <span>စာအုပ်ပို့ဆောင်ရေး စာရင်းနှင့် A4 (4-up) လိပ်စာကတ် Print ထုတ်ခြင်း</span>
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    • <strong>&quot;စာအုပ်ယူရန်&quot;</strong> Tab တွင် ကျောင်းသားလိပ်စာများကို စစ်ဆေးပြီး A4 စာရွက်တစ်ရွက်လျှင် (၄) ဦးနှုန်း ပါဝင်သော လိပ်စာကတ် PDF ထုတ်၍ Print ထုတ်နိုင်ပါသည်။
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3.5 bg-slate-100/90 dark:bg-slate-900/90 border-t border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0 text-xs">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              {isStaff
                ? 'ကျောင်းသားအသစ်ထည့်ပြီး Copy ကူးတိုင်း User Guide ဖတ်ရှုနည်း တစ်ပါတည်း ပါဝင်ပါသည်။'
                : 'အခက်အခဲရှိပါက အတန်းတွင်းရှိ "သီးသန့်စာ" မှတစ်ဆင့် ဆရာ့ထံ ဆက်သွယ်မေးမြန်းနိုင်ပါသည်။'}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl neu-btn-primary font-extrabold cursor-pointer"
          >
            ပိတ်မည်
          </button>
        </div>
      </div>
    </div>
  );
};
