import React, { useState } from 'react';
import { User } from '../types/classroom';
import { AcademyLogo } from './AcademyLogo';
import {
  CheckCircle2,
  ShieldCheck,
  ScrollText,
  LogOut,
  Check,
  Users,
  Clock,
} from 'lucide-react';

interface AcademyRulesModalProps {
  isOpen: boolean;
  currentUser: User;
  allUsers?: User[];
  isMandatory: boolean;
  onAcceptRules: () => void;
  onClose: () => void;
  onLogout?: () => void;
}

export const ACADEMY_RULES_TITLE =
  'Online အင်္ဂလိပ်စာသင်တန်းနှင့် ရာထူးဝင်ခွင့်သင်တန်း  (Zoom Application) တက်ရောက်မည့် သင်တန်း/သူများ လိုက်နာရန် စည်းကမ်းများ အသိပေးကြေညာချက်';

export const ACADEMY_RULES_LIST: { number: string; text: string }[] = [
  {
    number: '၁။',
    text: 'တပည့်များအားလုံး Zoom Application ကို စာသင်ကြားရန်အတွက်  download လုပ်ပြုလုပ်၍\nသေသေချာချာပြင်ဆင်ထားရမည်။ အသံမကြားရခြင်း၊ အသုံးမပြုတတ်ခြင်းများမဖြစ်အောင် နားလည်တတ်ကျွမ်းသူများထံမှ အကြံဉာဏ်ရယူထားပါ။',
  },
  {
    number: '၂။',
    text: 'Zoom application ဖြင့် သင်ကြားမည့် စာသင်ချိန်သည် တစ်သမတ်တည်းဖြစ်သော်လည်း မီးပျက်ခြင်း၊ Internet line မကောင်းခြင်းများဖြစ်ပါက စာသင်ချိန်နှောင့်နှေးနိုင်သည်။',
  },
  {
    number: '၃။',
    text: 'စာသင်ချိန်မစမီ အနည်းဆုံး နာရီဝက် (သို့မဟုတ်) ၁၅ မိနစ် အလိုတွင် စာသင်ကြားရန် join ရမည့် link ၊ Meeting ID Number နှင့် Password ကို ယခု Classroom တွင် Post တင်ပေးမည်။ ထိုမှဝင်ရန်ဖြစ်သည်။ စာသင်ချိန်မစမီ အနည်းဆုံး ၁၀ မိနစ်အလိုတွင် သင်တန်းသား/သူများအားလုံး အဆင်သင့် join ထားရမည်။ သင်တန်းသားတစ်ဦးလျှင် Device တစ်ခုသာ Join ရမည်။',
  },
  {
    number: '၄။',
    text: 'မိမိတန်းခွဲတွင်သာ တက်ရောက်ရမည်။ မိမိတန်းခွဲ မဟုတ်လျှင် တက်ရောက်ခြင်း လုံးဝမပြုလုပ်ရ။ Display name တွင် မိမိ၏ အမည်ရင်း၊ တန်းခွဲ ၊ ခုံအမှတ် တို့ကို တိတိကျကျ ရေးရမည်။ သက်ဆိုင်ရာ Admin လက်ထောက်ဆရာ /ဆရာမများ စစ်ဆေးရာတွင် တန်းခွဲမှားတက်ခြင်း၊ Display name မပြောင်းထားခြင်းများဖြစ်ပါက ဝင်ရောက် စာသင်ကြားခွင့်ပြုမည်မဟုတ်ပါ။ စာသင်ချိန်အတွင်း သင်တန်းသား/သူများအားလုံး၏ camera များ ဖွင့်ထားရမည်။',
  },
  {
    number: '၅။',
    text: 'စာသင်ချိန်တွင် သင်တန်းခန်း၌ လာတက်သကဲ့သို စည်းကမ်းတကျ သင်ယူရမည်။ တိတ်ဆိတ်ငြိမ်သက်သော အခန်း သို့မဟုတ် နေရာတွင် အဝတ်အစားသပ်သပ်ရပ်ရပ်ဝတ်၍ (သင်တန်းသားများအားလုံး စွပ်ကျယ်အင်္ကျီဝတ်ဆင်၍ သင်ကြားခြင်း လုံးဝ (လုံးဝ) မပြုလုပ်ရ။) စာရေးကိရိယာ အပြည့်အစုံဖြင့် သင်ကြားရမည်။ အခြားမသက်ဆိုင်သူများ သင်တန်းသား/သူများဘေးနားတွင် မရှိစေရ။ ဆူညံသံများ မရှိစေရ။',
  },
  {
    number: '၆။',
    text: 'စာစသင်ပြီဆိုလျှင် သင်တန်းသား/သူများဘက်မှ ဆူညံသံများ မဖြစ်ပေါ်စေရန် mute လုပ်ထားရမည်။ သို့မှသာ သင်တန်းသားများ အားလုံး ဆူညံသံများမရှိဘဲ ရှင်းရှင်းလင်းလင်း ကြားရမည်ဖြစ်သည်။',
  },
  {
    number: '၇။',
    text: 'စကားပြောဆိုရာတွင် ယဥ်ကျေးလိမ္မာစွာ ပြောဆိုပြုမူရမည်။ ရိုင်းစိုင်း မောက်မာ ထောင်လွှားမှုကို လုံးဝ (လုံးဝ) လက်ခံမည်မဟုတ်ပါ။သင်တန်းအပ်ထားပြီး မတက်ရောက်ဖြစ်ပါက မိမိအပိုင်းသာဖြစ်ပြီး သင်တန်းကြေး ပြန်အမ်းမည်မဟုတ်ပါ။ သင်တန်းမှထုတ်ပြန်ထား သော စည်ကမ်းများအားလုံးကို တိတိကျကျလိုက်နာရမည်။ သင်တန်းက လိုအပ်၍ ထပ်မံထုတ်ပြန်သော စည်းကမ်းများကိုလည်း လိုက်နာရမည်။',
  },
  {
    number: '၈။',
    text: 'သင်တန်းမှထုတ်ပေးထားသော သင်ကြားရေးစာရွက်စာတမ်းများ (notes)၊ သင်ကြားပို့ချထားသည့် video များ စသည်တို့ကို အခြားမည်သူတစ်ဦးတစ်ယောက်ကိုမျှ လက်ဆင့်ကမ်းပေးခြင်း၊ ဖြန့်ဝေခြင်းများမပြုလုပ်ရ။ ပေးပို့၊ ဖြန့်ဝေသည်ဟု ခိုင်လုံသော သက်သေရှိပါက သင်တန်းသားအဖြစ်မှ ထုတ်ပယ်ပါမည်။',
  },
  {
    number: '၉။',
    text: 'သင်တန်းတက်ရောက်နေသူများသည် သင်တန်းစာသင်ချိန်စုစုပေါင်း၏ (၈၀)ရာခိုင်နှုန်း ပြည့်မီအောင် တက်ရောက်ရမည်။ သင်တန်း ပျက်ကွက်ပါက ပျက်ကွက်ရသည့်အကြောင်းအရာကို ရုံးစာ(ခွင့်စာ)ပုံစံဖြင့် မပျက်မကွက် ခွင့်တိုင်ရမည်။သင်တန်းမတက်ရောက်ဖြစ်ပါက မိမိအပိုင်းသာဖြစ်ပြီး ပြန်လည်သင်ကြားပေးမည်မဟုတ်ပါ။ သင်တန်းတက်ရောက်ရန် Post တင်ပေးထားသည့် Zoom Link အောက် comment တွင် မိမိအမည်၊ ခုံအမှတ်၊ တန်းခွဲများကို သင်တန်းတက်ရောက်ပြီးသည့်အချိန်တိုင်း မပျက်မကွက်ရေးရမည်။ သင်တန်းတက်ချိန် (၈၀)ရာခိုင်နှုန်းမပြည့်မီလျှင်သော်လည်းကောင်း၊ခွင့်မဲ့ပျက်ကွက်လျှင်သော်လည်ကောင်း၊အကြောင်းမဲ့သင်တန်းပျက် ကွက်လျှင်သော်လည်းကောင်း သင်တန်းကပေးအပ်သည့်မှတ်စုများရရှိမည်မဟုတ်ပါ။ သင်တန်းချိန် (၅) ချိန်ထက်ပို၍ ခွင့်မဲ့ပျက်ကွက်လျင် သင်တန်းတက်ရောက်ခြင်းမရှိတော့ပါဟု မှတ်ယူ၍ သက်ဆိုင်ရာ သင်တန်း (Google Classroom) မှထုတ်ပယ်ပါမည်။',
  },
  {
    number: '၁၀။',
    text: 'သင်တန်းပြီးဆုံးပါက အချိန်သင့် အခါသင့်တွင် ရေးဖြေစာမေးပွဲ ကျင်းပမည်။ ရေးဖြေစာမေးပွဲ အောင်မြင်သူများသည် နှုတ်ဖြေစာမေးပွဲဖြေဆိုရမည်ဖြစ်သည်။ စာမေးပွဲများအားလုံးကို ပြင်ပစာစစ် ဆရာကြီး၊ ဆရာမကြီး (external examiners) များက ဆုံးဖြတ်စစ်ဆေးမည်ဖြစ်သည်။ ကျောင်းခေါ်ချိန် ရာခိုင်နှုန်းမပြည့်ခြင်း၊ စည်းကမ်း ချိုးဖောက်ခြင်းများရှိပါက စာမေးပွဲဝင်ရောက် ဖြေဆို ခွင့်မပြုပါ။ ရေးဖြေ၊ နှုတ်ဖြေအောင်မြင်ပါက အောင်မြင်ကြောင်း Certificate ပေးအပ်မည်ဖြစ်သည်။ စာမေးပွဲဖြေဆိုခွင့်ရသူများသည် စာမေးပွဲကြေးပေးသွင်းရမည်။ [ဤစည်ကမ်းချက်သည် English Proficiency Class (ရာထူးဝင်ခွင့်သင်တန်းတက်ရောက်သူများမပါ) တက်ရောက်သူများနှင့်သာသက်ဆိုင်သည်။]',
  },
  {
    number: '၁၁။',
    text: 'ဤ group ထဲရှိ သင်တန်းသား/သူများ လက်ရှိအသုံးပြုနေသော  account တစ်စုံတစ်ခုပျက်စီးပါက မိမိတာဝန်သာဖြစ်ပြီး နောက်ထပ် account သစ်တစ်ခုကို ထည့်သွင်းပေးမည်မဟုတ်ပါ။ Group ထဲရောက်နေပြီးလျှင် မိမိဘာသာပြန်မထွက်မိအောင် ဂရုပြုရမည်။ ဤ Group သည် Secret group ဖြစ်၍ သင်တန်းသားမဟုတ်သည့် အခြားမသက်ဆိုင်သူများကို invite လုံးဝ (လုံးဝ) မပြုလုပ်ရပါ ။ ပြုလုပ်သည့်သင်တန်းသား/သူကို group မှထုတ်ကာ သင်တန်းမှ ထုတ်ပယ်မည်။ သင်တန်းတက်ရောက်သူများ စာသင်ကြားနိုင်ရန် Google Classroom Application ကို မိမိတို့၏ phone သို့မဟုတ် computer တွင် install လုပ်ထားရမည်ဖြစ်သည်။ သင်တန်းသား/သူ များ၏ gmail account များတွင် မိမိအမည်ရင်းမဟုတ်ပါက first name နှင့် second name တို့တွင် မိမိတို့၏ အမည်အရင်းများပြောင်းထားရမည်ဖြစ်သည်။',
  },
  {
    number: '၁၂။',
    text: 'သင်တန်းတက်ရောက်သည့် ကျောင်းသား/သူများ၏မိဘအုပ်ထိန်းသူများသည် သင်တန်း စတင်သည့်နေ့တွင် သင်တန်းသားနှင့်အတူ ဆရာ၏လမ်းညွှန်ချက်များကိုခေတ္တနားထောင်ရမည်ဖြစ်ပါသည်။(ဤစည်းကမ်းချက်သည် ဘွဲ့ရမဟုတ်သည့် ကလေး များနှင့်သာသက်ဆိုင်သည်။)',
  },
  {
    number: '၁၃။',
    text: 'မိမိ၏ ကလေး သင်တန်းမှန်မှန်တက်ရောက်ရန်နှင့် သင်တန်းက ချမှတ်ထားသောစည်းကမ်းများကိုလိုက်နာရန် မိဘအုပ်ထိန်းသူများက တာဝန်ယူရမည်ဖြစ်ပြီး မိဘအုပ်ထိန်းသူများအနေဖြင့် စာသင်ချိန်တွင် ဝင်ရောက်စကားပြောဆိုခြင်းများမပြုလုပ်ရပါ။(ဤစည်းကမ်းချက်သည် ဘွဲ့ရမဟုတ်သည့် ကလေး များနှင့်သာသက်ဆိုင်သည်။)',
  },
  {
    number: '၁၄။',
    text: 'သင်တန်း အပ်ထားပြီး သင်တန်း မှန်မှန် (၈၀ ရာခိုင်နှန်း)မတက်ရောက်ပါက သင်တန်း မှ ပေးအပ်သည့် စာစဥ်များ မှတ်စုများ လုံးဝရရှိမည်မဟုတ်ပါ။ သင်တန်း ပို့ချသည့်စနစ်သည် (Live)ဖြစ်၍ သင်တန်း ပျက်ကွက်ပါက Zoom (record) လုံးဝရရှိမည် မဟုတ်ပါ။',
  },
];

export const AcademyRulesModal: React.FC<AcademyRulesModalProps> = ({
  isOpen,
  currentUser,
  allUsers = [],
  isMandatory,
  onAcceptRules,
  onClose,
  onLogout,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const isStaff = currentUser.role === 'admin' || currentUser.role === 'co_admin';
  const studentAccounts = allUsers.filter((u) => u.role === 'student');
  const acceptedStudentsCount = studentAccounts.filter((u) => u.rulesAccepted).length;

  const handleConfirmAccept = () => {
    setIsSubmitting(true);
    onAcceptRules();
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border-2 border-emerald-500/40 dark:border-emerald-700/60 overflow-hidden my-auto max-h-[94vh] flex flex-col">
        {/* Official Academy Header */}
        <div className="px-4 sm:px-6 py-4 bg-gradient-to-r from-emerald-950 via-emerald-900 to-slate-900 text-white border-b border-emerald-800/70 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-xl bg-white/10 ring-1 ring-white/20 shrink-0">
                <AcademyLogo size="md" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                    SWANARH ACADEMY · OFFICIAL NOTICE
                  </span>
                  {isMandatory && (
                    <span className="text-[10px] sm:text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950">
                      ဖတ်ရှုပြီး လက်ခံရန် လိုအပ်ပါသည်
                    </span>
                  )}
                </div>
                <h2 className="text-sm sm:text-base md:text-lg font-bold text-white mt-1.5 leading-relaxed">
                  {ACADEMY_RULES_TITLE}
                </h2>
              </div>
            </div>

            {!isMandatory && (
              <button
                type="button"
                onClick={onClose}
                className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors cursor-pointer shrink-0"
              >
                ✕ ပိတ်မည်
              </button>
            )}
          </div>
        </div>

        {/* Status Banner for Staff or Already Accepted Student */}
        {isStaff && (
          <div className="px-4 sm:px-6 py-2.5 bg-indigo-50 dark:bg-indigo-950/60 border-b border-indigo-200 dark:border-indigo-900/60 flex flex-wrap items-center justify-between gap-2 text-xs text-indigo-900 dark:text-indigo-200 shrink-0">
            <div className="flex items-center gap-2 font-semibold">
              <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>
                ကျောင်းသားအားလုံး ပထမဆုံးအကြိမ် အကောင့်ဝင်သည့်အခါ ဤစည်းကမ်းချက်များကို &ldquo;သိရှိ လိုက်နာပါမည်&rdquo; နှိပ်ရပါမည်။
              </span>
            </div>
            <span className="font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
              ✓ သိရှိ လိုက်နာပါမည် နှိပ်ပြီးသူ: {acceptedStudentsCount} / {studentAccounts.length} ဦး
            </span>
          </div>
        )}

        {!isStaff && currentUser.rulesAccepted && (
          <div className="px-4 sm:px-6 py-2.5 bg-emerald-50 dark:bg-emerald-950/60 border-b border-emerald-200 dark:border-emerald-800/70 flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-900 dark:text-emerald-200 shrink-0">
            <div className="flex items-center gap-2 font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>
                သင်သည် သင်တန်းစည်းကမ်းချက်များကို &ldquo;သိရှိ လိုက်နာပါမည်&rdquo; ဟု အတည်ပြုပြီးဖြစ်ပါသည်။
              </span>
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-600 text-white font-bold text-[11px]">
              <Check className="w-3 h-3 stroke-[3]" />
              <span>သိရှိ လိုက်နာပါမည် ({currentUser.name})</span>
            </span>
          </div>
        )}

        {/* Scrollable 14 Rules Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-3 bg-slate-50/70 dark:bg-slate-950/50">
          {ACADEMY_RULES_LIST.map((item, idx) => (
            <div
              key={idx}
              className="p-3.5 sm:p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs flex items-start gap-3 hover:border-emerald-300 dark:hover:border-emerald-800 transition-colors"
            >
              <span className="inline-flex items-center justify-center min-w-[2.2rem] h-7 px-2 rounded-lg bg-emerald-100 dark:bg-emerald-950/90 text-emerald-800 dark:text-emerald-300 font-bold text-xs sm:text-sm shrink-0 border border-emerald-200 dark:border-emerald-800/70">
                {item.number}
              </span>
              <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-100 leading-relaxed whitespace-pre-line font-medium">
                {item.text}
              </p>
            </div>
          ))}

          {/* Official Sign-Off */}
          <div className="p-4 sm:p-5 rounded-xl bg-gradient-to-r from-emerald-50 via-teal-50/60 to-white dark:from-emerald-950/50 dark:via-slate-900 dark:to-slate-900 border border-emerald-200 dark:border-emerald-800/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <ScrollText className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0" />
              <div className="text-xs text-slate-600 dark:text-slate-300">
                အထက်ပါ စည်းကမ်းချက် (၁၄) ချက်လုံးကို သင်တန်းသား/သူများအားလုံး တိတိကျကျ လိုက်နာကြရန် အသိပေးအပ်ပါသည်။
              </div>
            </div>
            <div className="text-right shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-emerald-200/60 dark:border-emerald-800/50">
              <div className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
                Admin Team
              </div>
              <div className="text-xs sm:text-sm font-black tracking-wide text-emerald-700 dark:text-emerald-400">
                SWANARH ACADEMY
              </div>
            </div>
          </div>
        </div>

        {/* Footer Action Bar */}
        <div className="px-4 sm:px-6 py-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0">
          {currentUser.role === 'student' && !currentUser.rulesAccepted ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start sm:items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5 sm:mt-0" />
                <span>
                  သင်တန်းခန်းမ (Classroom) အတွင်းသို့ ဝင်ရောက်ရန်{' '}
                  <strong className="text-emerald-700 dark:text-emerald-400">
                    &ldquo;သိရှိ လိုက်နာပါမည်&rdquo;
                  </strong>{' '}
                  ခလုတ်ကို နှိပ်၍ အတည်ပြုပါ။
                </span>
              </div>

              <div className="flex items-center justify-end gap-2.5 shrink-0">
                {onLogout && (
                  <button
                    type="button"
                    onClick={onLogout}
                    className="px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>ထွက်မည်</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleConfirmAccept}
                  disabled={isSubmitting}
                  className="flex-1 sm:flex-initial px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs sm:text-sm font-extrabold shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                  <span>သိရှိ လိုက်နာပါမည်</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 font-bold">
                {currentUser.role === 'student' ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>✓ သိရှိ လိုက်နာပါမည် ({currentUser.name})</span>
                    {currentUser.rulesAcceptedAt && (
                      <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 font-normal flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {currentUser.rulesAcceptedAt}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span>SWANARH ACADEMY · စည်းကမ်းချက် (၁၄) ချက်</span>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                ပိတ်မည် (Close)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
