import React, { useState, useEffect, useMemo } from 'react';
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
  Search,
  Layers,
  Bell,
  FileText,
  Youtube,
  Video,
  Download,
  History,
  BookA,
  Globe,
  ClipboardCheck,
  Sparkles,
} from 'lucide-react';
import { User } from '../types/classroom';
import { OFFICIAL_ACADEMY_LOGO } from '../assets/officialLogoData';

interface ClassroomGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
}

interface GuideSectionItem {
  id: string;
  stepNumber: string;
  category: 'account' | 'classroom' | 'library' | 'exam_notes' | 'tools';
  badge: string;
  title: string;
  accentColor: string;
  icon: React.ReactNode;
  summary: string;
  bullets: string[];
  tips?: string[];
}

export const ClassroomGuideModal: React.FC<ClassroomGuideModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
  const isStaff = currentUser.role === 'admin' || currentUser.role === 'co_admin';
  const [activeRoleTab, setActiveRoleTab] = useState<'student' | 'teacher'>(
    isStaff ? 'teacher' : 'student'
  );
  const [selectedCategory, setSelectedCategory] = useState<
    'all' | 'account' | 'classroom' | 'library' | 'exam_notes' | 'tools'
  >('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedMode, setCopiedMode] = useState<'student' | 'teacher' | 'library' | null>(null);

  useEffect(() => {
    setActiveRoleTab(isStaff ? 'teacher' : 'student');
    setSelectedCategory('all');
    setSearchQuery('');
  }, [isStaff, currentUser.id, isOpen]);

  const studentSections: GuideSectionItem[] = useMemo(
    () => [
      {
        id: 'stu-1',
        stepNumber: '၁',
        category: 'account',
        badge: 'Login & လုံခြုံရေး',
        title: 'အကောင့်စတင်ဝင်ရောက်ခြင်း၊ စည်းကမ်းချက်အတည်ပြုခြင်း နှင့် ကိုယ်ပိုင် Password ပြောင်းခြင်း',
        accentColor: 'from-indigo-600 to-blue-600',
        icon: <KeyRound className="w-4 h-4 text-indigo-500 shrink-0" />,
        summary:
          'ကျောင်းသားအကောင့်သစ်ဖြင့် ပထမဆုံးအကြိမ် စတင်ဝင်ရောက်သည့်အခါ လုပ်ဆောင်ရမည့် အဆင့်များ ဖြစ်ပါသည်။',
        bullets: [
          '🔐 1 Account = 1 Device စနစ် — ကျောင်းသားအကောင့်တစ်ခုလျှင် ဖုန်း သို့မဟုတ် ကွန်ပျူတာ (၁) ခုတည်းတွင်သာ Login ဝင်ရောက်အသုံးပြုနိုင်ပါသည်။ စက်ပြောင်းသုံးလိုပါက အရင်စက်မှ Logout အရင်ထွက်ပေးရပါမည်။',
          '📜 အဆင့် (၁) စည်းကမ်းချက် အတည်ပြုခြင်း — ပထမဆုံးအကြိမ် Login ဝင်လိုက်သည်နှင့် သင်တန်းစည်းကမ်းချက် (၁၄) ချက် ပေါ်လာပါမည်။ အပြည့်အစုံဖတ်ရှုပြီး အောက်ခြေရှိ "သိရှိ လိုက်နာပါမည်" ခလုတ်ကို နှိပ်ရပါမည်။',
          '🔑 အဆင့် (၂) ကိုယ်ပိုင် Password အသစ် မဖြစ်မနေ ပြောင်းလဲခြင်း — "သိရှိ လိုက်နာပါမည်" နှိပ်ပြီးသည်နှင့် စနစ်မှ Password အသစ်ပြောင်းရန် အကွက် အလိုအလျောက် ပေါ်လာပါမည်။ သင်တန်းမှပေးထားသော ယာယီ Password အစား မိမိတစ်ဦးတည်းသာသိမည့် Password အသစ် (အနည်းဆုံး ၄ လုံး) ကို ပြောင်းလဲသိမ်းဆည်းပြီးမှ Classroom အတွင်းသို့ ဝင်ရောက်နိုင်ပါမည်။',
          '⚙️ နောက်ပိုင်းတွင်လည်း ညာဘက်အပေါ်ထောင့်ရှိ မိမိအမည် Menu ကိုနှိပ်၍ "Change Password" မှတစ်ဆင့် အချိန်မရွေး Password ထပ်မံပြောင်းလဲနိုင်ပါသည်။',
        ],
        tips: [
          'မိမိပြောင်းလဲလိုက်သော Password အသစ်ကို မမေ့စေရန် သေချာမှတ်သားထားပါ။ အကယ်၍ မေ့သွားပါက ဆရာ (Admin / Co-Admin) ထံ ဆက်သွယ်၍ Password Reset ပြန်ချပေးရန် တောင်းဆိုနိုင်ပါသည်။',
        ],
      },
      {
        id: 'stu-2',
        stepNumber: '၂',
        category: 'classroom',
        badge: 'Stream & Zoom Link',
        title: 'သင်ခန်းစာအတန်း (Stream) ဝင်ရောက်ခြင်း၊ Zoom Link ကြည့်ခြင်း နှင့် Comment ရေးသားခြင်း',
        accentColor: 'from-blue-600 to-cyan-600',
        icon: <Layers className="w-4 h-4 text-blue-500 shrink-0" />,
        summary:
          'မိမိတက်ရောက်ခွင့်ရထားသော အတန်းအတွင်းသို့ ဝင်ရောက်ပြီး နေ့စဉ်သင်ခန်းစာနှင့် Zoom Link များကို ကြည့်ရှုနည်း ဖြစ်ပါသည်။',
        bullets: [
          '🏫 အတန်းထဲသို့ ဝင်ရန် — ပင်မစာမျက်နှာ (Dashboard) ရှိ မိမိအတန်းကတ် (Course Card) ပေါ်ရှိ "Enter Classroom" ကို နှိပ်ပါ။',
          '📌 Pinned Post နှင့် Zoom Link — အတန်းထဲရှိ "Stream" Tab တွင် ဆရာတင်ပေးထားသော နေ့စဉ် Zoom Meeting Link, Meeting ID, Passcode နှင့် သင်ခန်းစာကြေညာချက်များကို အပေါ်ဆုံး၌ တွေ့မြင်ရပါမည်။',
          '💬 Comment ရေးသားခြင်း — စည်းကမ်းချက်အရ Zoom Link Post အောက်ရှိ Comment အကွက်တွင် မိမိအမည်၊ ခုံအမှတ် နှင့် တန်းခွဲတို့ကို သင်တန်းတက်ရောက်သည့်အချိန်တိုင်း ရေးသားပေးပို့နိုင်ပါသည်။',
          '🔔 ပို့စ်အသစ် အချက်ပေးစနစ် — ဆရာက အတန်းထဲတွင် Post အသစ်တင်လိုက်တိုင်း ကျောင်းသား၏ မျက်နှာပြင်ပေါ်၌ အသိပေးချက် (Notification Banner) အလိုအလျောက် ပေါ်လာပြီး "အတန်းသို့ ဝင်ရောက်ဖတ်ရှုမည်" ကို တစ်ချက်နှိပ်ရုံဖြင့် တန်းဝင်ဖတ်နိုင်ပါသည်။',
        ],
      },
      {
        id: 'stu-3',
        stepNumber: '၃',
        category: 'classroom',
        badge: 'Attendance (Roll Call)',
        title: 'နေ့စဉ် Attendance (ကျောင်းတက်ချိန် Roll Call) ကိုယ်တိုင်နှိပ်ခြင်း နှင့် Roll Call % စစ်ဆေးခြင်း',
        accentColor: 'from-emerald-600 to-teal-600',
        icon: <CalendarCheck className="w-4 h-4 text-emerald-500 shrink-0" />,
        summary:
          'သင်တန်းချိန်တိုင်း ကျောင်းတက်ရောက်ကြောင်း ကိုယ်တိုင် Attendance နှိပ်ရမည့် အဆင့်ဖြစ်ပါသည်။',
        bullets: [
          '✅ Attendance နှိပ်ရန် — မိမိအတန်းထဲသို့ ဝင်ပြီး အပေါ်တန်းရှိ "Attendance" Tab ကို နှိပ်ပါ။',
          '🟢 ဆရာမှ Attendance ဖွင့်ပေးထားချိန် (Session Open) တွင် အစိမ်းရောင် "Present (တက်ရောက်)" ခလုတ် ပေါ်လာပါမည်။ ထိုခလုတ်ကို ကျောင်းသားကိုယ်တိုင် နှိပ်ရပါမည်။',
          '⏰ သတ်မှတ်ချိန်အတွင်း နှိပ်ပါက "Present (တက်ရောက်)" အဖြစ် မှတ်တမ်းဝင်ပြီး၊ သတ်မှတ်ချိန်ကျော်လွန်မှ နှိပ်ပါက "Late (နောက်ကျ)" အဖြစ် မှတ်တမ်းဝင်ပါမည်။',
          '📊 မိမိ၏ စုစုပေါင်း ကျောင်းတက်ချိန် ရာခိုင်နှုန်း (Attendance %) ကို Attendance စာမျက်နှာထိပ်တွင် အချိန်မရွေး ကြည့်ရှုစစ်ဆေးနိုင်ပါသည်။ (သင်တန်းစည်းကမ်းအရ Roll Call အနည်းဆုံး 80% ပြည့်မီရပါမည်။)',
        ],
      },
      {
        id: 'stu-4',
        stepNumber: '၄',
        category: 'library',
        badge: 'Library စာကြည့်တိုက် အသေးစိတ်',
        title: 'Library စာကြည့်တိုက် အသုံးပြုနည်း (eBook စာအုပ်စင်၊ စာရှည်မှတ်စုများ၊ YouTube နှင့် TikTok ဗီဒီယိုများ)',
        accentColor: 'from-amber-600 to-orange-600',
        icon: <Library className="w-4 h-4 text-amber-500 shrink-0" />,
        summary:
          'ပင်မစာမျက်နှာ အပေါ်တန်း (သို့မဟုတ် Menu) ရှိ "Library စာကြည့်တိုက်" ခလုတ်ကိုနှိပ်၍ သင်တန်းစာကြည့်တိုက်တစ်ခုလုံးကို အသုံးပြုနည်း ဖြစ်ပါသည်။',
        bullets: [
          '🎬 YouTube နှင့် TikTok သင်ခန်းစာဗီဒီယိုများ (ကန့်သတ်ချက်မရှိ) — Swanarh Academy YouTube Channel (@swanarhacademy) နှင့် Dr. Si Thu Aung TikTok Channel (@dr..si.thu.aung.s) မှ ဗီဒီယိုအားလုံးကို မည်သည့်သင်တန်းသားမဆို ကန့်သတ်ချက်မရှိ ကြည့်ရှုနိုင်ပါသည်။',
          '✨ ဗီဒီယိုအသစ် Auto ပေါ်ခြင်း — ဆရာက YouTube သို့မဟုတ် TikTok တွင် ဗီဒီယိုအသစ်တင်လိုက်တိုင်း Library ထဲ၌ အပေါ်ဆုံး နံပါတ် (#1) နေရာတွင် "✨ NEW အသစ်" တံဆိပ်ဖြင့် အလိုအလျောက် တန်းပေါ်ပါသည်။ ဗီဒီယိုများကို စာကြည့်တိုက်အတွင်း တိုက်ရိုက်ဖွင့်ကြည့်နိုင်သလို "Open TikTok" ခလုတ်နှိပ်၍ TikTok App/Website တွင်လည်း တိုက်ရိုက်ဖွင့်ကြည့်နိုင်ပါသည်။',
          '📚 eBook စာအုပ်စင် နှင့် စာရှည်မှတ်စုများ (Long Notes) — eBook နှင့် စာရှည်မှတ်စုများကို ဖတ်ရှုနိုင်ရန် ဆရာသတ်မှတ်ထားသော အတန်း၊ Roll Call % (ဥပမာ 80% နှင့်အထက်)၊ Exam စာမေးပွဲ နှင့် အချက်အလက် Form များ ပြည့်စုံအောင် ဖြည့်သွင်းထားရပါမည်။',
          '📖 စာဖတ်ခန်း (Reading Room) — စာအုပ် သို့မဟုတ် စာရှည်မှတ်စုကို နှိပ်လိုက်ပါက မျက်စိအေးချမ်းစွာ ဖတ်ရှုနိုင်သည့် Light / Sepia (စာအုပ်ဝါရောင်) / Dark Mode (၃) မျိုးနှင့် စာလုံးအကြီး/အသေး (A- / A+) ချိန်ညှိဖတ်ရှုနိုင်ပါသည်။',
          '📥 eBook Download ဆွဲခြင်း — ဆရာက "📥 Download ခွင့်ပြုထားသည်" ဟု သတ်မှတ်ပေးထားသော eBook များကိုသာ PDF ဒေါင်းလုဒ်ဆွဲယူနိုင်ပြီး၊ "🔒 Download ပိတ်ထားသည် (ဖတ်ရှုရန်သာ)" ဟု သတ်မှတ်ထားသော စာအုပ်များကို စာကြည့်တိုက် စာဖတ်ခန်းအတွင်း၌သာ ဖတ်ရှုနိုင်ပါသည်။',
          '🛡️ Watermark လုံခြုံရေး — စာဖတ်ခန်းအတွင်း၌ သင်တန်း Classroom Logo နှင့် ကျောင်းသား၏ အမည်/Username Watermark ပါရှိသဖြင့် သင်တန်းမှတ်စုများကို ပြင်ပသို့ Screenshot ရိုက်၍ ဖြန့်ဝေခြင်း လုံးဝမပြုလုပ်ရပါ။',
        ],
      },
      {
        id: 'stu-5',
        stepNumber: '၅',
        category: 'exam_notes',
        badge: 'သီးသန့်စာ & ခွင့်တိုင်စာ',
        title: 'သီးသန့်စာ (Private Notes) ဖြင့် ဆရာ့ထံ သင်ခန်းစာမေးမြန်းခြင်း နှင့် ခွင့်တိုင်ကြားခြင်း',
        accentColor: 'from-purple-600 to-fuchsia-600',
        icon: <MessageSquareLock className="w-4 h-4 text-purple-500 shrink-0" />,
        summary:
          'အခြားကျောင်းသားများ မမြင်ရဘဲ ဆရာ (Admin / Co-Admin) ထံသို့သာ သီးသန့်စာပို့ခြင်းနှင့် ခွင့်တိုင်ကြားခြင်း ပြုလုပ်နည်း ဖြစ်ပါသည်။',
        bullets: [
          '✉️ သီးသန့်စာ ပို့ရန် — အတန်းထဲသို့ဝင်ပြီး "သီးသန့်စာ" Tab ကိုနှိပ်ပါ။',
          '📝 အကြောင်းအရာ ခေါင်းစဉ် (ဥပမာ — ခွင့်တိုင်ကြားခြင်း / သင်ခန်းစာ မေးမြန်းခြင်း) နှင့် အကြောင်းအရာ အပြည့်အစုံကို ရေးသား၍ ပေးပို့နိုင်ပါသည်။',
          '💬 ဆရာ့ပြန်စာ ဖတ်ရှုရန် — ဆရာက သင်၏ သီးသန့်စာကို ပြန်လည်ဖြေကြားလိုက်သည်နှင့် ပင်မစာမျက်နှာထိပ်တွင် အစိမ်းရောင် Alert Banner ("သင်၏ သီးသန့်စာကို ဆရာမှ ပြန်လည်ဖြေကြားလိုက်ပါပြီ!") ပေါ်လာမည်ဖြစ်ပြီး တစ်ချက်နှိပ်၍ ဖတ်ရှုနိုင်ပါသည်။',
        ],
      },
      {
        id: 'stu-6',
        stepNumber: '၆',
        category: 'exam_notes',
        badge: 'Exam Room & Data Form',
        title: 'Exam Room (စာမေးပွဲများ ဖြေဆိုခြင်း နှင့် ကျောင်းသားအချက်အလက် Data Form ဖြည့်သွင်းခြင်း)',
        accentColor: 'from-rose-600 to-pink-600',
        icon: <Award className="w-4 h-4 text-rose-500 shrink-0" />,
        summary:
          'သင်တန်းစာမေးပွဲများ (Exams) နှင့် မဖြစ်မနေ ဖြည့်သွင်းရမည့် ကျောင်းသားအချက်အလက် Form များ ဖြည့်သွင်းနည်း ဖြစ်ပါသည်။',
        bullets: [
          '📝 Exam Room သို့ ဝင်ရန် — အတန်းထဲရှိ "Exam Room" Tab ကို နှိပ်ပါ။',
          '📋 ကျောင်းသား အချက်အလက် Form (Data Form) — ဆရာတင်ထားသော အချက်အလက်ကောက်ယူသည့် Form များကို ပြည့်စုံမှန်ကန်စွာ ဖြည့်သွင်းပြီး Submit နှိပ်ပါ။',
          '⏱️ Exam စာမေးပွဲ ဖြေဆိုခြင်း — သတ်မှတ်ထားသော အချိန် (Timer) အတွင်း မေးခွန်းများကို ဖြေဆိုပြီး Submit နှိပ်ပါ။ (Exam နှင့် Data Form ဖြည့်သွင်းပြီးမှသာ Library စာကြည့်တိုက်ရှိ ကန့်သတ်ထားသော eBook နှင့် မှတ်စုများကို ဖတ်ရှုခွင့်ရရှိပါမည်။)',
        ],
      },
      {
        id: 'stu-7',
        stepNumber: '၇',
        category: 'tools',
        badge: 'စာအုပ်ယူရန် & အိမ်စာ',
        title: 'စာအုပ်မှာယူရန် (Book Delivery လိပ်စာဖြည့်ခြင်း) နှင့် Assignments (အိမ်စာတင်ခြင်း)',
        accentColor: 'from-cyan-600 to-sky-600',
        icon: <Truck className="w-4 h-4 text-cyan-500 shrink-0" />,
        summary:
          'သင်တန်းစာအုပ်များ အိမ်အရောက် ပို့ဆောင်ပေးနိုင်ရန် လိပ်စာဖြည့်သွင်းနည်း ဖြစ်ပါသည်။',
        bullets: [
          '📦 စာအုပ်ယူရန် (Book Delivery) — အတန်းထဲရှိ "စာအုပ်ယူရန်" Tab ကိုနှိပ်ပြီး လက်ခံမည့်သူအမည်၊ ဆက်သွယ်ရန် ဖုန်းနံပါတ်၊ မြို့နယ် နှင့် ပို့ဆောင်ရမည့် နေရပ်လိပ်စာ အပြည့်အစုံကို တိကျစွာ ဖြည့်သွင်းသိမ်းဆည်းပါ။',
          '📂 Assignments (အိမ်စာများ) — အတန်းထဲရှိ "Assignments" Tab တွင် ဆရာပေးထားသော အိမ်စာများကို ဝင်ရောက်ဖြေဆိုတင်သွင်းနိုင်ပြီး ဆရာပေးသော အမှတ်နှင့် သုံးသပ်ချက်များကို ပြန်လည်ကြည့်ရှုနိုင်ပါသည်။',
        ],
      },
      {
        id: 'stu-8',
        stepNumber: '၈',
        category: 'tools',
        badge: 'Dictionary & Website',
        title: 'အင်္ဂလိပ် ⇄ မြန်မာ အဘိဓာန် (EN⇄MM Dictionary) နှင့် စွမ်းအား Official Website',
        accentColor: 'from-violet-600 to-indigo-600',
        icon: <BookA className="w-4 h-4 text-violet-500 shrink-0" />,
        summary:
          'စာသင်ယူနေစဉ် အင်္ဂလိပ်ဝေါဟာရများကို ချက်ချင်းရှာဖွေနိုင်သည့် အဘိဓာန်နှင့် သင်တန်းကျောင်း Website ကြည့်ရှုနည်း ဖြစ်ပါသည်။',
        bullets: [
          '📖 EN⇄MM Dictionary — မျက်နှာပြင် ညာဘက်အောက်ထောင့်ရှိ အပြာရောင် အဝိုင်းခလုတ် (EN⇄MM) ကိုနှိပ်၍ အင်္ဂလိပ်မှ မြန်မာ၊ မြန်မာမှ အင်္ဂလိပ် စကားလုံးများကို အသံထွက်၊ အဓိပ္ပာယ်၊ ဥပမာဝါကျများဖြင့် ရှာဖွေနိုင်ပါသည်။',
          '✨ စာသားထောက်၍ တိုက်ရိုက်ရှာခြင်း — သင်ခန်းစာ သို့မဟုတ် မှတ်စုဖတ်နေစဉ် မသိသော အင်္ဂလိပ်စာလုံးကို ဖိထောက် (Select) လိုက်ရုံဖြင့် အဘိဓာန်ဖြင့် ချက်ချင်း အဓိပ္ပာယ်ကြည့်ရှုနိုင်ပါသည်။',
          '🌐 စွမ်းအား Website — ပင်မစာမျက်နှာ အပေါ်တန်းရှိ "စွမ်းအား Website" ခလုတ်ကိုနှိပ်၍ Swanarh Academy ၏ တရားဝင် Website ကို Classroom အတွင်း၌ပင် တိုက်ရိုက်ကြည့်ရှုနိုင်ပါသည်။',
        ],
      },
    ],
    []
  );

  const teacherSections: GuideSectionItem[] = useMemo(
    () => [
      {
        id: 'tch-1',
        stepNumber: '၁',
        category: 'account',
        badge: 'အကောင့်သစ် & First-Login Password',
        title: 'ကျောင်းသား / Co-Admin / Admin အကောင့်သစ် ဖွင့်ပေးခြင်း၊ Auto-Fill Paste နှင့် First-Login Password စနစ်',
        accentColor: 'from-indigo-600 to-blue-600',
        icon: <UserPlus className="w-4 h-4 text-indigo-500 shrink-0" />,
        summary:
          'ကျောင်းသားအသစ်များကို တစ်ဦးချင်းဖြစ်စေ၊ အများအပြား Paste ချ၍ဖြစ်စေ အမြန်ဆုံး အကောင့်ဖွင့်ပေးခြင်းနှင့် လုံခြုံရေးစနစ် ဖြစ်ပါသည်။',
        bullets: [
          '👤 အကောင့်သစ်ဖွင့်ရန် — ပင်မစာမျက်နှာရှိ "Manage Users" (သို့မဟုတ် အတန်းအတွင်းရှိ "+ ကျောင်းသားထည့်ရန်") ကို နှိပ်ပါ။',
          '⚡ Smart Auto-Fill & Batch Quick-Paste — ကျောင်းသားပို့လာသော အချက်အလက်ဖောင် (အမည်၊ Email၊ ဖုန်း၊ အလုပ်အကိုင်၊ ကျား/မ၊ လိပ်စာ) ကို Copy ကူးပြီး Paste ချလိုက်ရုံဖြင့် အကွက်အားလုံး အလိုအလျောက် ဖြည့်သွင်းပေးပါသည်။ ကျောင်းသား (၂) ဦးနှင့်အထက် Paste ချပါက အများအပြား တစ်ပြိုင်နက် အကောင့်ဖွင့်သည့် Batch Mode သို့ အလိုအလျောက် ပြောင်းပေးပါသည်။',
          '⚠️ Username / Email ထပ်နေပါက သတိပေးခြင်း — ရှိပြီးသား ကျောင်းသား၏ Username သို့မဟုတ် Email နှင့် ထပ်နေပါက တန်းမထည့်ဘဲ ရှိပြီးသားအကောင့်ကို ပြသပေးပြီး လက်ရှိအတန်းထဲသို့ တစ်ချက်နှိပ်၍ တိုက်ရိုက် Enroll သွင်းပေးနိုင်ပါသည်။',
          '🔐 ပထမဆုံး Login ဝင်ချိန် Password အသစ်ပြောင်းခိုင်းသည့်စနစ် — အကောင့်အသစ် (Student, Co-Admin, Admin အားလုံး) သည် ပထမဆုံးအကြိမ် Login ဝင်သည်နှင့် ကျောင်းသားဖြစ်ပါက (၁) "သိရှိ လိုက်နာပါမည်" စည်းကမ်းချက် အတည်ပြုရမည်၊ (၂) မိမိကိုယ်ပိုင် Password အသစ် မဖြစ်မနေ ပြောင်းလဲရမည်။ Admin နှင့် Co-Admin အကောင့်သစ်များသည်လည်း Login စဝင်သည်နှင့် ကိုယ်ပိုင် Password အသစ်ပြောင်းပြီးမှ ဆက်သုံးနိုင်ပါသည်။',
          '📋 Copy Login Info — အကောင့်ဖွင့်ပြီး "Copy" နှိပ်လိုက်သည်နှင့် အမည်၊ Username, ယာယီ Password, Login Link, စည်းကမ်းချက်နှင့် Password ပြောင်းရန် အသိပေးချက် နှင့် "📖 Classroom အသုံးပြုနည်း (User Guide)" ဖတ်ရှုနည်းပါ တစ်ပါတည်း Copy ကူးပေးပါသည်။',
        ],
      },
      {
        id: 'tch-2',
        stepNumber: '၂',
        category: 'classroom',
        badge: 'အတန်းစီမံခန့်ခွဲမှု',
        title: 'အတန်းသစ် (Course & Batch) ဖန်တီးခြင်း၊ ပြင်ဆင်ခြင်း နှင့် အတန်းลำดับ စီခြင်း',
        accentColor: 'from-blue-600 to-cyan-600',
        icon: <Layers className="w-4 h-4 text-blue-500 shrink-0" />,
        summary:
          'သင်တန်းအတန်းသစ်များ ဖွင့်လှစ်ခြင်း၊ သင်တန်းချိန်သတ်မှတ်ခြင်းနှင့် အတန်းကတ်များ အစီအစဉ်စီနည်း ဖြစ်ပါသည်။',
        bullets: [
          '➕ အတန်းသစ်ဖွင့်ရန် — ပင်မစာမျက်နှာရှိ "+ Create Course" ခလုတ်ကိုနှိပ်၍ အတန်းအမည် (Title), အတန်းကုဒ် (Course Code), သင်တန်းချိန် (Schedule) နှင့် အတန်းအကြောင်းအရာများကို ဖြည့်သွင်းဖန်တီးနိုင်ပါသည်။',
          '↕️ အတန်းลำดับ စီရန် (Reorder) — ပင်မစာမျက်နှာရှိ "အတန်းစီရန်" ခလုတ်ကိုနှိပ်၍ အတန်းများကို အပေါ်/အောက် စိတ်ကြိုက် ရွှေ့ပြောင်းစီစဉ်နိုင်ပါသည်။',
          '👥 ကျောင်းသား အတန်းသွင်း/ထုတ် — အတန်းထဲရှိ "People" Tab (သို့မဟုတ် "Manage Users") မှတစ်ဆင့် ကျောင်းသားများကို အတန်းတစ်ခု သို့မဟုတ် အတန်းအားလုံးသို့ အလွယ်တကူ ထည့်သွင်း/ဖယ်ရှားနိုင်ပါသည်။',
        ],
      },
      {
        id: 'tch-3',
        stepNumber: '၃',
        category: 'classroom',
        badge: 'Stream & သင်ခန်းစာပို့စ်',
        title: 'Stream တွင် Zoom Link နှင့် သင်ခန်းစာပို့စ်တင်ခြင်း၊ Pin ထိုးခြင်း နှင့် မိနစ် (၃၀) Notification စနစ်',
        accentColor: 'from-teal-600 to-emerald-600',
        icon: <Bell className="w-4 h-4 text-teal-500 shrink-0" />,
        summary:
          'အတန်းအတွင်း နေ့စဉ် Zoom Link များ၊ သင်ခန်းစာများနှင့် အရေးကြီးကြေညာချက်များ တင်နည်း ဖြစ်ပါသည်။',
        bullets: [
          '📢 ပို့စ်အသစ်တင်ရန် — အတန်းထဲရှိ "Stream" Tab တွင် ခေါင်းစဉ်နှင့် အကြောင်းအရာ (Zoom Link, Meeting ID, Passcode, သင်ခန်းစာမှတ်စု) ရေးသား၍ ပုံ သို့မဟုတ် ဖိုင်တွဲတင်နိုင်ပါသည်။',
          '📌 Pin ထိုးခြင်း — အရေးကြီးသော ပို့စ်များကို "Pin" နှိပ်၍ အတန်း၏ အပေါ်ဆုံးတွင် အမြဲမြင်သာအောင် ထားရှိနိုင်ပြီး Pin အစီအစဉ်ကိုလည်း အပေါ်/အောက် ရွှေ့နိုင်ပါသည်။',
          '⏱️ Auto 30-Min Notification — ဆရာက ပို့စ်အသစ်တင်လိုက်သည်နှင့် ထိုအတန်းရှိ ကျောင်းသားအားလုံးထံ Notification ချက်ချင်းရောက်ရှိပြီး မိနစ် (၃၀) ပြည့်သည့်အခါ Notification ဟောင်းများ အလိုအလျောက် ရှင်းလင်းပေးသဖြင့် Database  जागा မပြည့်တော့ပါ။',
        ],
      },
      {
        id: 'tch-4',
        stepNumber: '၄',
        category: 'classroom',
        badge: 'Attendance & Roll Call Filter',
        title: 'Attendance (Roll Call) ဖွင့်/ပိတ်ခြင်း၊ ဆရာကိုယ်တိုင် ခြစ်ပေးခြင်း နှင့် Roll Call % Filter စစ်ဆေးခြင်း',
        accentColor: 'from-emerald-600 to-green-600',
        icon: <Filter className="w-4 h-4 text-emerald-500 shrink-0" />,
        summary:
          'နေ့စဉ် ကျောင်းတက်ချိန် Roll Call ဖွင့်ပေးခြင်းနှင့် ကျောင်းသားများ၏ Roll Call ရာခိုင်နှုန်းကို အမြန်စစ်ဆေးနည်း ဖြစ်ပါသည်။',
        bullets: [
          '🟢 Attendance Session ဖွင့်/ပိတ် — အတန်းထဲရှိ "Attendance" Tab တွင် နေ့ရက်နှင့် အချိန်အလိုက် Attendance အသစ်ဖွင့်ပေးနိုင်ပြီး၊ စာသင်ချိန်ပြီးဆုံးပါက ပြန်ပိတ် (Close Session) နိုင်ပါသည်။',
          '✍️ ဆရာကိုယ်တိုင် ခြစ်ပေးခြင်း — ကျောင်းသားတစ်ဦးချင်းစီကို Present (တက်ရောက်), Late (နောက်ကျ), Excused (ခွင့်တိုင်), Absent (ပျက်ကွက်) ဟု ဆရာက တစ်ချက်နှိပ်၍ တိုက်ရိုက် သတ်မှတ်/ပြင်ဆင်ပေးနိုင်ပါသည်။',
          '🔍 Roll Call % Filter များ — ကျောင်းသားစာရင်း အရှည်ကြီး ဆွဲကြည့်စရာမလိုဘဲ "Roll Call 100%", "≥ 80% (စာမေးပွဲဖြေခွင့်/စာအုပ်ဖတ်ခွင့်မီသူ)", "50%–79%", "< 50% (သတိပေးရမည့်သူ)" နှင့် "နှိပ်ပြီး / မနှိပ်ရသေး" Filter ခလုတ်များဖြင့် တစ်ချက်နှိပ်၍ စစ်ဆေးနိုင်ပါသည်။',
        ],
      },
      {
        id: 'tch-5',
        stepNumber: '၅',
        category: 'exam_notes',
        badge: 'သီးသန့်စာ & ခွင့်စာ စီမံမှု',
        title: 'သီးသန့်စာ (Private Notes) စစ်ဆေးဖြေကြားခြင်း နှင့် သီးသန့်စာထဲမှ Attendance တိုက်ရိုက်ခြစ်ပေးခြင်း',
        accentColor: 'from-purple-600 to-indigo-600',
        icon: <MessageSquareLock className="w-4 h-4 text-purple-500 shrink-0" />,
        summary:
          'ကျောင်းသားများ ပေးပို့လာသော ခွင့်တိုင်စာနှင့် သီးသန့်မေးခွန်းများကို ချက်ချင်းသိရှိဖြေကြားပြီး Attendance တစ်ပါတည်း ခြစ်ပေးနည်း ဖြစ်ပါသည်။',
        bullets: [
          '📩 Instant Alert Banner — ကျောင်းသားတစ်ဦးက သီးသန့်စာ သို့မဟုတ် ခွင့်တိုင်စာ ပို့ထားပါက ပင်မစာမျက်နှာထိပ်တွင် အဝါရောင် Alert Banner ("ကျောင်းသား သီးသန့်စာ / ခွင့်တိုင်စာ မဖြေရသေးပါ") ပေါ်လာပြီး "ချက်ချင်း ကြည့်ရှုဖြေကြားမည်" ကို နှိပ်၍ တန်းသွားနိုင်ပါသည်။',
          '✅ သီးသန့်စာထဲမှ Attendance တိုက်ရိုက်ခြစ်ခြင်း — ကျောင်းသားခွင့်တိုင်စာ ဖတ်ရှုနေရင်း ထိုစာကတ်ပေါ်၌ပင် "Excused (ခွင့်)"၊ "Present"၊ "Late"၊ "Absent" ခလုတ်ကို တစ်ချက်နှိပ်၍ ယနေ့ Attendance ကို တိုက်ရိုက်ခြစ်ပေးနိုင်ပါသည်။',
          '💬 ကိုယ်တိုင် စိတ်ကြိုက်စာပြန်စနစ် — Attendance ခြစ်လိုက်သည့်အခါ စနစ်က Auto စာပြန်ပို့ခြင်း မပြုလုပ်ဘဲ ဆရာ/Co-Admin ကိုယ်တိုင် ရေးသားလိုသော ပြန်စာကို စိတ်ကြိုက်ရေး၍ ပေးပို့နိုင်ပါသည်။',
        ],
      },
      {
        id: 'tch-6',
        stepNumber: '၆',
        category: 'library',
        badge: 'Library စာကြည့်တိုက် အသေးစိတ် (အပြည့်အစုံ)',
        title: 'Library စာကြည့်တိုက် စီမံခန့်ခွဲနည်း အသေးစိတ် (eBook Download ခွင့်ပြု/ပိတ်၊ စာရှည် Copy-Paste၊ အတန်းလိုက် ကန့်သတ်ချက်၊ Watermark နှင့် YouTube/TikTok Auto-Sync)',
        accentColor: 'from-amber-600 to-orange-600',
        icon: <Library className="w-4 h-4 text-amber-500 shrink-0" />,
        summary:
          'သင်တန်းတစ်ခုလုံး၏ Digital Library စာကြည့်တိုက်ကို ဆရာနှင့် Co-Admin များ အသေးစိတ် စီမံခန့်ခွဲနိုင်သည့် လုပ်ဆောင်ချက်အားလုံး ဖြစ်ပါသည်။',
        bullets: [
          '🏛️ ၁။ Library ဖွင့်ရန် — ပင်မစာမျက်နှာ အပေါ်တန်း (သို့မဟုတ် Menu) တွင် "စွမ်းအား Website" နှင့် ဘေးချင်းကပ်လျက်ရှိသော "Library စာကြည့်တိုက်" ကို နှိပ်ပါ။',
          '📥 ၂။ eBook (PDF) တင်ခြင်း နှင့် Download ခွင့်ပြု/ပိတ် ကန့်သတ်ခြင်း — "eBook တင်ရန်" ကိုနှိပ်၍ PDF ဖိုင် သို့မဟုတ် Link တင်သည့်အခါ Admin/Co-Admin က Download ခွင့်ပြုချက် (၂) မျိုးမှ စိတ်ကြိုက်ရွေးချယ်နိုင်ပါသည်— (က) "🔒 Download ပိတ်ထားမည် (ဖတ်ရှုရန်သာ)" ရွေးပါက ကျောင်းသားများ စာကြည့်တိုက်အတွင်း ဖတ်ရှုနိုင်သော်လည်း PDF ဒေါင်းလုဒ်ဆွဲခွင့် မရှိပါ၊ (ခ) "📥 Download လုပ်ခွင့်ပြုမည်" ရွေးပါက သတ်မှတ်ချက်ပြည့်မီသော ကျောင်းသားများ PDF ဒေါင်းလုဒ်ဆွဲနိုင်ပါမည်။ တင်ပြီးနောက်တွင်လည်း စာအုပ်ကတ်အောက်ခြေနှင့် စာဖတ်ခန်းအတွင်းရှိ "Download ခွင့်ပြုထားသည် / ပိတ်ထားသည်" ခလုတ်ကို တစ်ချက်နှိပ်ရုံဖြင့် အချိန်မရွေး ဖွင့်/ပိတ် ပြောင်းနိုင်ပါသည်။',
          '📝 ၃။ စာရှည်မှတ်စုကြီးများ (Long Notes) Copy-Paste တင်ခြင်း — "စာရှည်တင်ရန်" ကိုနှိပ်ပြီး Word, Google Docs, Telegram သို့မဟုတ် Website မှ စာရှည်ကြီးများကို Copy ကူး၍ တိုက်ရိုက် Paste ချလိုက်ရုံဖြင့် မူရင်းစာထဲရှိ စာလုံးအထူ (Bold)၊ စာလုံးအရောင်များ၊ နောက်ခံ Highlight အရောင်များ နှင့် စာသားအောက် မျဉ်းတားထားသည်များ (Underline) အတိုင်း တစ်ထပ်တည်း ပေါ်လာပါသည်။ Toolbar မှလည်း အရောင်၊ မျဉ်းတား၊ ခေါင်းစဉ်ကြီး/လတ် (H1/H2) တို့ကို စိတ်ကြိုက် ထပ်မံပြင်ဆင်နိုင်ပါသည်။',
          '🔒 ၄။ အတန်းလိုက် နှင့် ကျောင်းသားစည်းကမ်းလိုက် ကန့်သတ်ခြင်း (Access Rules) — eBook နှင့် စာရှည်မှတ်စုများတွင် (၁) မြင်တွေ့ခွင့်ပြုမည့် အတန်းများ ရွေးချယ်ခြင်း၊ (၂) လုံးဝ မမြင်စေချင်သော အတန်းများကို ပိတ်ထားခြင်း၊ (၃) ကျောင်းသား Roll Call အနည်းဆုံး ရှိရမည့် % (ဥပမာ 80% မပြည့်သူ မမြင်ရ)၊ (၄) Exam စာမေးပွဲ မဖြေသေးသူများ မမြင်ရ၊ (၅) အချက်အလက် Form မဖြည့်သေးသူများ မမြင်ရ ဟူ၍ အသေးစိတ် ကန့်သတ်နိုင်ပါသည်။',
          '👁️ ၅။ လုံးဝဖျောက်မည် (Strict Hide) (သို့မဟုတ်) သော့ခတ်ပုံစံပြမည် (Locked Card) — သတ်မှတ်ချက်မပြည့်မီသော ကျောင်းသားများအတွက် စာအုပ်ကို လုံးဝဖျောက်ထားမည်လား သို့မဟုတ် သော့ခတ်ပုံစံဖြင့် လိုအပ်ချက်ပြမည်လား စိတ်ကြိုက်ရွေးချယ်နိုင်ပါသည်။ ထို့ပြင် "ကျောင်းသား မြင်တွေ့ခွင့် စစ်ဆေးရန်" နှင့် "ကန့်သတ်ခံရသူအမြင် စမ်းကြည့်ရန်" ခလုတ်များဖြင့် ဆရာက အချိန်မရွေး စမ်းသပ်စစ်ဆေးနိုင်ပါသည်။',
          '🛡️ ၆။ Classroom Logo Watermark — စာဖတ်ခန်း (Reading Room) အတွင်းရှိ eBook နှင့် စာရှည်မှတ်စုတိုင်းတွင် သင်တန်း၏ တရားဝင် Classroom Logo နှင့် လက်ရှိဖတ်ရှုနေသော ကျောင်းသား၏ အမည်/Username Watermark အလိုအလျောက် ပါရှိပါသည်။',
          '🎬 ၇။ YouTube နှင့် TikTok ဗီဒီယိုများ Auto-Sync စနစ် — YouTube (@swanarhacademy) နှင့် TikTok (@dr..si.thu.aung.s) Channel တို့တွင် ဗီဒီယိုအသစ်တင်လိုက်တိုင်း Library ထဲ၌ အပေါ်ဆုံး နံပါတ် (#1) နေရာတွင် အလိုအလျောက် တန်းပေါ်ပါသည်။ ဗီဒီယိုများကို သင်တန်းသားအားလုံး ကန့်သတ်ချက်မရှိ တိုက်ရိုက်ဖွင့်ကြည့်နိုင်ပါသည်။',
        ],
      },
      {
        id: 'tch-7',
        stepNumber: '၇',
        category: 'exam_notes',
        badge: 'Exam Room & Data Form',
        title: 'Exam Room (စာမေးပွဲများ၊ ကျောင်းသားအချက်အလက် Data Form များ ဖန်တီးခြင်း နှင့် CSV/Excel ထုတ်ယူခြင်း)',
        accentColor: 'from-rose-600 to-pink-600',
        icon: <Award className="w-4 h-4 text-rose-500 shrink-0" />,
        summary:
          'အချိန်သတ်မှတ်ထားသော စာမေးပွဲများ (Exams) နှင့် ကျောင်းသားအချက်အလက် ကောက်ယူသည့် Form များ ဖန်တီးစစ်ဆေးနည်း ဖြစ်ပါသည်။',
        bullets: [
          '📝 Exam သို့မဟုတ် Data Form ဖန်တီးရန် — အတန်းထဲရှိ "Exam Room" Tab တွင် စာမေးပွဲ (Exam) သို့မဟုတ် ကျောင်းသားအချက်အလက်ဖောင် (Data Form) အသစ် ဖန်တီးနိုင်ပါသည်။',
          '❓ မေးခွန်းအမျိုးအစားများ — Multiple Choice (ရွေးချယ်ရန်) နှင့် စာသားဖြင့် ဖြေဆိုရသော မေးခွန်းများ၊ အချိန်ကန့်သတ်ချက် (Duration Minutes) နှင့် အောင်မှတ်များကို သတ်မှတ်နိုင်ပါသည်။',
          '📊 အဖြေစာရင်း စစ်ဆေးခြင်း နှင့် Export ထုတ်ခြင်း — ဖြေဆိုပြီးသော ကျောင်းသားစာရင်း၊ အမှတ်များနှင့် အချက်အလက်များကို တစ်နေရာတည်းတွင် ကြည့်ရှုနိုင်ပြီး CSV / Excel ဖိုင်အဖြစ် ဒေါင်းလုဒ်ဆွဲထုတ်ယူနိုင်ပါသည်။',
        ],
      },
      {
        id: 'tch-8',
        stepNumber: '၈',
        category: 'exam_notes',
        badge: 'Assignments & Certificates',
        title: 'Assignments (အိမ်စာစစ်ဆေး အမှတ်ပေးခြင်း) နှင့် သင်တန်းဆင်း Certificate ထုတ်ပေးခြင်း',
        accentColor: 'from-orange-600 to-amber-600',
        icon: <ClipboardCheck className="w-4 h-4 text-orange-500 shrink-0" />,
        summary:
          'ကျောင်းသားများ တင်သွင်းလာသော အိမ်စာများကို အမှတ်ပေးခြင်းနှင့် သင်တန်းဆင်းလက်မှတ် ထုတ်ပေးနည်း ဖြစ်ပါသည်။',
        bullets: [
          '📂 Assignments — အတန်းထဲရှိ "Assignments" Tab တွင် အိမ်စာအသစ်ပေးခြင်း၊ ကျောင်းသားများ တင်ထားသော အဖြေများကို စစ်ဆေး၍ အမှတ်နှင့် Feedback ပေးခြင်းတို့ ပြုလုပ်နိုင်ပါသည်။',
          '🎓 Certificate ထုတ်ပေးခြင်း — အတန်းထဲရှိ "People" Tab တွင် သတ်မှတ်ချက်ပြည့်မီသော ကျောင်းသားများအတွက် သင်တန်းဆင်းဂုဏ်ပြုလက်မှတ် (Official Certificate) ထုတ်ပေးနိုင်ပါသည်။',
        ],
      },
      {
        id: 'tch-9',
        stepNumber: '၉',
        category: 'tools',
        badge: 'Book Delivery & A4 Print',
        title: 'စာအုပ်ပို့ဆောင်ရေး စာရင်းစစ်ဆေးခြင်း နှင့် A4 (4-up) လိပ်စာကတ် PDF / Print ထုတ်ခြင်း',
        accentColor: 'from-cyan-600 to-sky-600',
        icon: <Truck className="w-4 h-4 text-cyan-500 shrink-0" />,
        summary:
          'ကျောင်းသားများ ဖြည့်သွင်းထားသော စာအုပ်ပို့ဆောင်ရမည့် လိပ်စာများကို စီမံခန့်ခွဲပြီး ပါဆယ်ကပ်ရန် လိပ်စာကတ် Print ထုတ်နည်း ဖြစ်ပါသည်။',
        bullets: [
          '📦 လိပ်စာစာရင်း စစ်ဆေးရန် — အတန်းထဲရှိ "စာအုပ်ယူရန်" Tab တွင် ကျောင်းသားများ ဖြည့်ထားသော အမည်၊ ဖုန်းနံပါတ်နှင့် လိပ်စာများကို စစ်ဆေးနိုင်ပြီး ပို့ဆောင်ပြီး/မပို့ရသေး Status မှတ်သားနိုင်ပါသည်။',
          '🖨️ A4 (4-up) လိပ်စာကတ် Print ထုတ်ခြင်း — A4 စာရွက်တစ်ရွက်လျှင် ကျောင်းသား (၄) ဦးနှုန်း ပါဝင်သော သပ်ရပ်သည့် ပါဆယ်လိပ်စာကတ် PDF ထုတ်ယူ၍ တိုက်ရိုက် Print ထုတ်ပြီး စာအုပ်ပါဆယ်ပေါ်တွင် ကပ်နိုင်ပါသည်။',
        ],
      },
      {
        id: 'tch-10',
        stepNumber: '၁၀',
        category: 'tools',
        badge: 'Audit Log, Dictionary & Website',
        title: 'Audit Log လုံခြုံရေးမှတ်တမ်း၊ အင်္ဂလိပ် ⇄ မြန်မာ အဘိဓာန် (Dictionary) နှင့် စွမ်းအား Website',
        accentColor: 'from-violet-600 to-purple-600',
        icon: <History className="w-4 h-4 text-violet-500 shrink-0" />,
        summary:
          'Primary Admin အတွက် လုံခြုံရေးမှတ်တမ်း စစ်ဆေးခြင်းနှင့် အထောက်အကူပြု ကိရိယာများ အသုံးပြုနည်း ဖြစ်ပါသည်။',
        bullets: [
          '🛡️ Audit Log (Primary Admin သီးသန့်) — ပင်မစာမျက်နှာရှိ "Audit Log" ခလုတ်ဖြင့် Admin နှင့် Co-Admin တို့၏ အကောင့်ဝင်ရောက်မှု၊ အကောင့်သစ်ဖွင့်မှု၊ Password ပြောင်းလဲမှု၊ အချက်အလက်ပြင်ဆင်မှုနှင့် ဖျက်သိမ်းမှု မှတ်တမ်းအားလုံးကို အချိန်နာရီအတိအကျဖြင့် ပြန်လည်စစ်ဆေးနိုင်ပါသည်။',
          '📖 EN⇄MM Dictionary — ညာဘက်အောက်ထောင့်ရှိ အဝိုင်းခလုတ် (EN⇄MM) ဖြင့် အင်္ဂလိပ် ⇄ မြန်မာ အဘိဓာန်ကို အချိန်မရွေး ဖွင့်သုံးနိုင်သလို စာသားပေါ် Select ထောက်၍လည်း တိုက်ရိုက် အဓိပ္ပာယ်ကြည့်နိုင်ပါသည်။',
          '🌐 စွမ်းအား Website & Library — ပင်မစာမျက်နှာနှင့် Menu တွင် "စွမ်းအား Website" နှင့် "Library စာကြည့်တိုက်" တို့ကို ဘေးချင်းကပ်လျက် ထားရှိပေးထားသဖြင့် အလွယ်တကူ ဖွင့်ကြည့်နိုင်ပါသည်။',
        ],
      },
    ],
    []
  );

  const displayMode: 'student' | 'teacher' = isStaff ? activeRoleTab : 'student';
  const activeSections = displayMode === 'teacher' ? teacherSections : studentSections;

  const filteredSections = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return activeSections.filter((sec) => {
      if (selectedCategory !== 'all' && sec.category !== selectedCategory) {
        return false;
      }
      if (!q) return true;
      const inTitle = sec.title.toLowerCase().includes(q);
      const inBadge = sec.badge.toLowerCase().includes(q);
      const inSummary = sec.summary.toLowerCase().includes(q);
      const inBullets = sec.bullets.some((b) => b.toLowerCase().includes(q));
      return inTitle || inBadge || inSummary || inBullets;
    });
  }, [activeSections, selectedCategory, searchQuery]);

  const buildCopyText = (mode: 'student' | 'teacher' | 'library'): string => {
    if (mode === 'library') {
      const libSec = teacherSections.find((s) => s.id === 'tch-6');
      return [
        `🏛️ SwanArh Digital Academy — Library စာကြည့်တိုက် အသုံးပြုနည်း အသေးစိတ်လမ်းညွှန်`,
        `━━━━━━━━━━━━━━━━━━━━`,
        ...(libSec ? libSec.bullets : []),
        `━━━━━━━━━━━━━━━━━━━━`,
      ].join('\n\n');
    }

    const list = mode === 'teacher' ? teacherSections : studentSections;
    const header =
      mode === 'teacher'
        ? `👨‍🏫 SwanArh Digital Academy — ဆရာလမ်းညွှန် (Admin & Co-Admin Complete User Guide)`
        : `🎓 SwanArh Digital Academy — ကျောင်းသားလမ်းညွှန် (Student Complete User Guide)`;

    const blocks = list.map((sec) => {
      return [
        `${sec.stepNumber}။ 【${sec.badge}】 ${sec.title}`,
        `   ${sec.summary}`,
        ...sec.bullets.map((b) => `   • ${b}`),
      ].join('\n');
    });

    return [header, `━━━━━━━━━━━━━━━━━━━━`, ...blocks, `━━━━━━━━━━━━━━━━━━━━`].join('\n\n');
  };

  const handleCopyGuide = (mode: 'student' | 'teacher' | 'library') => {
    navigator.clipboard.writeText(buildCopyText(mode)).catch(() => {});
    setCopiedMode(mode);
    setTimeout(() => setCopiedMode(null), 3500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className="neu-raised rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border border-indigo-500/25 shadow-2xl">
        {/* Top Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-4 sm:px-6 py-4 text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={OFFICIAL_ACADEMY_LOGO}
              alt="Swanarh Academy Logo"
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl object-contain bg-white p-1 shadow-md border border-amber-400/50 shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-widest text-amber-300 font-extrabold">
                  {displayMode === 'teacher'
                    ? '👨‍🏫 ဆရာလမ်းညွှန် အပြည့်အစုံ (ADMIN / CO-ADMIN COMPLETE GUIDE)'
                    : '🎓 ကျောင်းသားလမ်းညွှန် အပြည့်အစုံ (STUDENT COMPLETE GUIDE)'}
                </span>
              </div>
              <h2 className="text-sm sm:text-lg font-extrabold tracking-tight text-white truncate">
                📖 Classroom အသုံးပြုနည်း အသေးစိတ်လမ်းညွှန် (Complete User Guide)
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

        {/* Sub-Toolbar: Role Switcher & Copy Buttons + Category Filter & Search */}
        <div className="px-4 sm:px-6 py-3 bg-slate-100/95 dark:bg-slate-900/95 border-b border-slate-200/80 dark:border-slate-800 space-y-2.5 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {isStaff ? (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setActiveRoleTab('teacher');
                    setSelectedCategory('all');
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                    displayMode === 'teacher'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'neu-btn text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>👨‍🏫 ဆရာလမ်းညွှန် (၁၀ ချက်)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveRoleTab('student');
                    setSelectedCategory('all');
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                    displayMode === 'student'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'neu-btn text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <GraduationCap className="w-4 h-4" />
                  <span>🎓 ကျောင်းသားလမ်းညွှန် (၈ ချက်)</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs font-extrabold text-indigo-800 dark:text-indigo-300">
                <GraduationCap className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span>ကျောင်းသားများအတွက် Classroom တစ်ခုလုံး အသုံးပြုနည်း အသေးစိတ် (အဆင့် ၈ ဆင့်)</span>
              </div>
            )}

            {/* Quick Copy Guide Buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {isStaff && (
                <>
                  <button
                    type="button"
                    onClick={() => handleCopyGuide('library')}
                    className="px-2.5 py-1.5 rounded-xl neu-btn text-[11px] font-extrabold text-amber-700 dark:text-amber-300 flex items-center gap-1 cursor-pointer"
                    title="Library စာကြည့်တိုက် အသုံးပြုနည်း အသေးစိတ်ကို Copy ကူးရန်"
                  >
                    {copiedMode === 'library' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {copiedMode === 'library' ? 'Library Guide ကူးပြီး!' : 'Library လမ်းညွှန် Copy'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCopyGuide('teacher')}
                    className="px-2.5 py-1.5 rounded-xl neu-btn text-[11px] font-extrabold text-emerald-700 dark:text-emerald-300 flex items-center gap-1 cursor-pointer"
                    title="ဆရာလမ်းညွှန် အပြည့်အစုံကို Copy ကူးရန်"
                  >
                    {copiedMode === 'teacher' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {copiedMode === 'teacher' ? 'ဆရာလမ်းညွှန် ကူးပြီး!' : 'ဆရာလမ်းညွှန် Copy'}
                    </span>
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => handleCopyGuide('student')}
                className="px-2.5 py-1.5 rounded-xl neu-btn text-[11px] font-extrabold text-indigo-700 dark:text-indigo-300 flex items-center gap-1 cursor-pointer"
                title="ကျောင်းသားလမ်းညွှန် အပြည့်အစုံကို Copy ကူးရန်"
              >
                {copiedMode === 'student' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>
                  {copiedMode === 'student'
                    ? 'ကျောင်းသားလမ်းညွှန် ကူးပြီး!'
                    : 'ကျောင်းသားလမ်းညွှန် Copy'}
                </span>
              </button>
            </div>
          </div>

          {/* Category Quick Filter Pills + Search Input */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {[
                { id: 'all', label: 'အားလုံးကြည့်ရန်' },
                { id: 'account', label: '🔐 အကောင့် & Password' },
                { id: 'classroom', label: '🏫 အတန်း & Attendance' },
                { id: 'library', label: '🏛️ Library စာကြည့်တိုက်' },
                { id: 'exam_notes', label: '📝 သီးသန့်စာ & Exam' },
                { id: 'tools', label: '📦 စာအုပ်ယူရန် & Tools' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() =>
                    setSelectedCategory(
                      cat.id as
                        | 'all'
                        | 'account'
                        | 'classroom'
                        | 'library'
                        | 'exam_notes'
                        | 'tools'
                    )
                  }
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-extrabold whitespace-nowrap cursor-pointer transition-all ${
                    selectedCategory === cat.id
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-white/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-56 shrink-0">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="သိလိုသော အသုံးပြုနည်း ရှာရန်..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300/80 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Main Scrollable Detailed Step-by-Step Guide Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs sm:text-sm leading-relaxed">
          {filteredSections.length === 0 ? (
            <div className="neu-inset rounded-2xl p-8 text-center space-y-2">
              <BookOpen className="w-8 h-8 text-indigo-500 mx-auto opacity-75" />
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                ရှာဖွေထားသော အသုံးပြုနည်း မတွေ့ရှိပါ
              </p>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('all');
                  setSearchQuery('');
                }}
                className="px-3.5 py-1.5 rounded-xl neu-btn text-xs font-extrabold text-indigo-600 dark:text-indigo-300 cursor-pointer"
              >
                လမ်းညွှန်အားလုံး ပြန်ကြည့်ရန်
              </button>
            </div>
          ) : (
            filteredSections.map((sec) => {
              const isLibrarySection = sec.category === 'library';
              return (
                <div
                  key={sec.id}
                  className={`neu-inset rounded-2xl p-4 sm:p-5 space-y-3 border transition-all ${
                    isLibrarySection
                      ? 'border-amber-500/40 bg-amber-50/25 dark:bg-amber-950/15'
                      : 'border-slate-200/80 dark:border-slate-800'
                  }`}
                >
                  {/* Section Title Header */}
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl bg-gradient-to-br ${sec.accentColor} text-white font-extrabold flex items-center justify-center shrink-0 text-sm shadow-sm`}
                    >
                      {sec.stepNumber}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-extrabold text-[10px] border border-indigo-500/20">
                          {sec.badge}
                        </span>
                        {isLibrarySection && (
                          <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-800 dark:text-amber-300 font-extrabold text-[10px] border border-amber-500/30">
                            ★ အသေးစိတ် အပြည့်အစုံ
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5 leading-snug">
                        {sec.icon}
                        <span>{sec.title}</span>
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                        {sec.summary}
                      </p>
                    </div>
                  </div>

                  {/* Detailed Bullet Points */}
                  <div className="pl-0 sm:pl-12 space-y-2">
                    {sec.bullets.map((bullet, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 sm:p-3 rounded-xl bg-white/80 dark:bg-slate-900/75 border border-slate-200/70 dark:border-slate-800/80 text-xs text-slate-700 dark:text-slate-200 leading-relaxed"
                      >
                        {bullet}
                      </div>
                    ))}

                    {sec.tips && sec.tips.length > 0 && (
                      <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/25 text-xs text-indigo-900 dark:text-indigo-200 space-y-1">
                        {sec.tips.map((tip, tIdx) => (
                          <div key={tIdx} className="flex items-start gap-2 font-semibold">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                            <span>💡 မှတ်ချက် — {tip}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3.5 bg-slate-100/95 dark:bg-slate-900/95 border-t border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0 text-xs">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              {isStaff
                ? 'ဆရာလမ်းညွှန်၊ Library လမ်းညွှန် နှင့် ကျောင်းသားလမ်းညွှန်အားလုံးကို အပေါ်ရှိ Copy ခလုတ်များဖြင့် အချိန်မရွေး ကူးယူပေးပို့နိုင်ပါသည်။'
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
