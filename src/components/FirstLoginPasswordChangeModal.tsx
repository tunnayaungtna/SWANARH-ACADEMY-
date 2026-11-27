import React, { useState } from 'react';
import { User } from '../types/classroom';
import { ClassroomDB } from '../services/storage';
import { AcademyLogo } from './AcademyLogo';
import {
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  Eye,
  EyeOff,
  LogOut,
  AlertCircle,
  Lock,
} from 'lucide-react';

interface FirstLoginPasswordChangeModalProps {
  currentUser: User;
  onPasswordChanged: (updatedUser: User) => void;
  onLogout: () => void;
}

export const FirstLoginPasswordChangeModal: React.FC<FirstLoginPasswordChangeModalProps> = ({
  currentUser,
  onPasswordChanged,
  onLogout,
}) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isStudent = currentUser.role === 'student';
  const roleLabel =
    currentUser.role === 'admin'
      ? 'Admin (ဆရာ)'
      : currentUser.role === 'co_admin'
      ? 'Co-Admin (တွဲဖက်ဆရာ)'
      : 'Student (ကျောင်းသား)';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanNew = newPassword.trim();
    const cleanConfirm = confirmPassword.trim();

    if (cleanNew.length < 4) {
      setErrorMsg('Password အသစ်သည် အနည်းဆုံး စာလုံး (၄) လုံး ရှိရပါမည်။');
      return;
    }

    if (cleanNew !== cleanConfirm) {
      setErrorMsg('Password အသစ် နှစ်ကြိမ် ရိုက်ထည့်ထားသည်မှာ မတူညီပါ။ ပြန်လည်စစ်ဆေးပေးပါ။');
      return;
    }

    setIsSubmitting(true);
    const res = ClassroomDB.completeFirstLoginPasswordChange(currentUser.id, cleanNew);
    setIsSubmitting(false);

    if (!res.success || !res.user) {
      setErrorMsg(res.error || 'Password ပြောင်းလဲရာတွင် အမှားအယွင်းရှိနေပါသည်။');
      return;
    }

    onPasswordChanged(res.user);
  };

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border-2 border-indigo-500/40 dark:border-indigo-600/60 overflow-hidden my-auto">
        {/* Top Header */}
        <div className="px-5 sm:px-6 py-4 bg-gradient-to-r from-indigo-950 via-indigo-900 to-slate-900 text-white border-b border-indigo-800/70">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-xl bg-white/10 ring-1 ring-white/20 shrink-0">
              <AcademyLogo size="md" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-500/25 text-indigo-200 border border-indigo-400/30">
                  SWANARH ACADEMY · ACCOUNT SECURITY
                </span>
                <span className="text-[10px] sm:text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950">
                  မဖြစ်မနေ ပြောင်းလဲရန် လိုအပ်ပါသည်
                </span>
              </div>
              <h2 className="text-sm sm:text-base font-extrabold text-white mt-1.5 leading-snug">
                ပထမဆုံးအကြိမ် အကောင့်ဝင်ရောက်မှု — ကိုယ်ပိုင် Password အသစ် ပြောင်းလဲရန်
              </h2>
            </div>
          </div>
        </div>

        {/* Step Indicator Banner */}
        {isStudent ? (
          <div className="px-5 py-3 bg-emerald-50 dark:bg-emerald-950/50 border-b border-emerald-200 dark:border-emerald-800/60 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>အဆင့် (၁) စည်းကမ်းချက် &ldquo;သိရှိ လိုက်နာပါမည်&rdquo; အတည်ပြုပြီး</span>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-600 text-white font-extrabold text-[11px]">
              အဆင့် (၂/၂) Password အသစ်ပြောင်းရန်
            </span>
          </div>
        ) : (
          <div className="px-5 py-2.5 bg-indigo-50 dark:bg-indigo-950/50 border-b border-indigo-200 dark:border-indigo-800/60 flex items-center gap-2 text-xs font-bold text-indigo-900 dark:text-indigo-200">
            <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>
              {roleLabel} အကောင့်အသစ် လုံခြုံရေးအတွက် မိမိကိုယ်ပိုင် Password အသစ်သို့ ပြောင်းလဲပြီးမှ ဆက်လက်အသုံးပြုနိုင်ပါမည်။
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 text-xs">
          {/* Account Info Summary */}
          <div className="p-3.5 rounded-2xl bg-slate-100/90 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                လက်ရှိ ဝင်ရောက်ထားသော အကောင့် ({roleLabel})
              </div>
              <div className="text-sm font-extrabold text-slate-900 dark:text-white mt-0.5">
                {currentUser.name}{' '}
                <span className="font-mono text-indigo-600 dark:text-indigo-400">
                  (@{currentUser.username})
                </span>
              </div>
            </div>
            <div className="px-2.5 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-300 font-bold text-[11px] flex items-center gap-1">
              <KeyRound className="w-3.5 h-3.5" />
              <span>ယာယီ Password အား အသစ်ပြောင်းရန်</span>
            </div>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            သင်တန်းမှ ပထမဆုံး စတင်ဖွင့်ပေးထားသော ယာယီ Password အစား သင်တစ်ဦးတည်းသာ သိရှိမည့်{' '}
            <strong className="text-indigo-700 dark:text-indigo-300">
              ကိုယ်ပိုင် Password အသစ် (အနည်းဆုံး ၄ လုံး)
            </strong>{' '}
            ကို သတ်မှတ်ပေးပါ။ Password ပြောင်းလဲပြီးမှသာ Classroom ကို ဆက်လက်အသုံးပြုနိုင်ပါမည်။
          </p>

          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 font-bold flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="font-extrabold text-slate-800 dark:text-slate-200 block">
                ၁။ ကိုယ်ပိုင် Password အသစ် (New Password) *
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showNewPwd ? 'text' : 'password'}
                  required
                  minLength={4}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="မိမိမှတ်မိလွယ်မည့် Password အသစ် ရိုက်ထည့်ပါ (အနည်းဆုံး ၄ လုံး)"
                  className="w-full pl-10 pr-10 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                >
                  {showNewPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-extrabold text-slate-800 dark:text-slate-200 block">
                ၂။ Password အသစ်ကို ထပ်မံအတည်ပြုပါ (Confirm New Password) *
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showConfirmPwd ? 'text' : 'password'}
                  required
                  minLength={4}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="အပေါ်မှ Password အသစ်အတိုင်း ထပ်မံရိုက်ထည့်ပါ"
                  className="w-full pl-10 pr-10 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                >
                  {showConfirmPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2.5">
            <button
              type="button"
              onClick={onLogout}
              className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>အကောင့်မှ ထွက်မည်</span>
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Password အသစ်သိမ်းပြီး Classroom သို့ ဝင်မည်</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
