import React, { useState } from 'react';
import { ClassroomDB } from '../services/storage';
import { User, UserRole } from '../types/classroom';
import { AcademyLogo } from './AcademyLogo';
import {
  ShieldCheck,
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  GraduationCap,
  School,
  AlertCircle,
  ArrowRight,
  Sun,
  Moon,
  Users,
  Award,
  BookOpen,
} from 'lucide-react';

interface LoginViewProps {
  onLoginSuccess: (user: User) => void;
  onOpenArchitecture?: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  onLoginSuccess,
  theme,
  onToggleTheme,
}) => {
  const [activeRole, setActiveRole] = useState<UserRole>('student');

  // Sign In inputs
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  React.useEffect(() => {
    // Clear any old custom logo override from localStorage so the official logo always shows
    try {
      localStorage.removeItem('classroom_custom_academy_logo');
      localStorage.removeItem('classroom_custom_academy_logo_v2');
    } catch {
      // ignore
    }
    ClassroomDB.pullFromSupabase().catch(() => {});
  }, []);

  const handleSwitchTab = (role: UserRole) => {
    setActiveRole(role);
    setErrorMessage(null);
  };

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setErrorMessage('ကျေးဇူးပြု၍ သင်၏ Username သို့မဟုတ် Email ကို ရိုက်ထည့်ပါ။');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    // Ensure latest accounts & enrollments from Supabase are pulled before verifying login
    await ClassroomDB.pullFromSupabase();

    const res = ClassroomDB.login(identifier, password, activeRole);
    setIsLoading(false);

    if (res.error) {
      setErrorMessage(res.error);
    } else if (res.user) {
      onLoginSuccess(res.user);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between transition-colors duration-200">
      {/* Top Bar */}
      <header className="w-full border-b border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <AcademyLogo size="sm" />
            <div className="truncate">
              <span className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white block leading-tight truncate">
                SWANARH ACADEMY
              </span>
              <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold tracking-wide block leading-tight">
                DR. SI THU AUNG · CLASSROOM OS
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onToggleTheme}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors cursor-pointer whitespace-nowrap"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden xs:inline">Light Mode</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-slate-600" />
                  <span className="hidden xs:inline">Dark Mode</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Split Layout */}
      <main className="max-w-6xl w-full mx-auto px-4 sm:px-8 py-8 sm:py-12 my-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          {/* Left Column: Academy Brand Showcase & Official White Crest Logo */}
          <div className="lg:col-span-5 flex flex-col items-center lg:items-start text-center lg:text-left space-y-6">
            {/* Official Logo Showcase Badge */}
            <div className="p-2.5 rounded-full bg-white shadow-xl border border-slate-200/90 dark:border-slate-700">
              <AcademyLogo size="xl" />
            </div>

            {/* Academy Title & Mission */}
            <div className="space-y-2.5">
              <div className="text-xs font-bold tracking-widest uppercase text-rose-600 dark:text-rose-400">
                DR. SI THU AUNG
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
                SWANARH ACADEMY
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-md">
                ခေတ်မီ သင်ကြားရေးနှင့် ပညာရေးစီမံခန့်ခွဲမှုစနစ် — သင်ခန်းစာများ၊ ဗီဒီယိုပို့ချချက်များ၊ အိမ်စာနှင့် စာမေးပွဲများကို တစ်နေရာတည်းတွင် လုံခြုံစွာ သင်ယူနိုင်သော Digital Classroom Platform။
              </p>
            </div>

            {/* Key Academy Highlights */}
            <div className="w-full max-w-md space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800 text-left">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-emerald-100/80 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Authorized Student Enrollment
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    သင်တန်းသား အကောင့်သစ်များကို Admin နှင့် Co-Admin ဆရာများကသာ သင်တန်းအပ်နှံပေးရင်း တစ်ခါတည်း အကောင့်ဖွင့်ပေးသည့် လုံခြုံသောစနစ် ဖြစ်ပါသည်။
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-amber-100/80 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5">
                  <Award className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Verified Academic Certificates & Assessments
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    အိမ်စာနှင့် စာမေးပွဲ အမှတ်စာရင်းများအလိုက် အသိအမှတ်ပြု သင်တန်းဆင်းလက်မှတ် ရယူနိုင်ပါသည်။
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Dedicated Sign In Card */}
          <div className="lg:col-span-7 w-full max-w-xl mx-auto">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200/90 dark:border-slate-800 overflow-hidden transition-colors">
              {/* Card Header Banner */}
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-850 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    Account Sign In (အကောင့်ဝင်ရန်)
                  </span>
                </div>
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Authorized Access Only
                </span>
              </div>

              {/* 3 Role Selector Tab Bar */}
              <div className="grid grid-cols-3 p-1.5 bg-slate-100/90 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => handleSwitchTab('student')}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    activeRole === 'student'
                      ? 'bg-white dark:bg-slate-900 text-emerald-800 dark:text-emerald-300 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <GraduationCap className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Student</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSwitchTab('admin')}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    activeRole === 'admin'
                      ? 'bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-300 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <School className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                  <span>Admin</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSwitchTab('co_admin')}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    activeRole === 'co_admin'
                      ? 'bg-white dark:bg-slate-900 text-amber-800 dark:text-amber-300 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <Users className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Co-Admin</span>
                </button>
              </div>

              {/* Sign In Form Container */}
              <div className="p-6 sm:p-7 space-y-4">
                <div>
                  <span className="text-xs font-mono font-semibold text-emerald-700 dark:text-emerald-400 block">
                    {activeRole === 'admin'
                      ? 'Swanarh Academy · Administrator Portal'
                      : activeRole === 'co_admin'
                      ? 'Swanarh Academy · Co-Administrator Portal'
                      : 'Swanarh Academy · Student Portal'}
                  </span>
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                    {activeRole === 'admin'
                      ? 'Administrator Sign In (ဆရာ / အက်ဒမင်)'
                      : activeRole === 'co_admin'
                      ? 'Co-Administrator Sign In (တွဲဖက်ဆရာ)'
                      : 'Student Account Sign In (သင်တန်းသား ဝင်ရန်)'}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {activeRole === 'admin'
                      ? 'သင်တန်းများ၊ သင်ခန်းစာများနှင့် ကျောင်းသားအကောင့် အသစ်များကို စီမံခန့်ခွဲရန်'
                      : activeRole === 'co_admin'
                      ? 'ကျောင်းသားအသစ် ထည့်သွင်းခြင်း၊ သင်ခန်းစာ Post တင်ခြင်းနှင့် အိမ်စာ အမှတ်ပေးရန်'
                      : 'သင်တန်းမှ ထုတ်ပေးထားသော Username နှင့် Password ကို အသုံးပြု၍ ဝင်ရောက်ပါ'}
                  </p>
                </div>

                {/* Error Message Toast */}
                {errorMessage && (
                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-300 text-xs">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div className="leading-snug">{errorMessage}</div>
                  </div>
                )}

                <form onSubmit={handleSignInSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      {activeRole === 'student' ? 'Username သို့မဟုတ် Email' : 'Admin / Co-Admin Username သို့မဟုတ် Email'}
                    </label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        placeholder={
                          activeRole === 'student'
                            ? 'Enter your student username or email'
                            : 'Enter administrator username or email'
                        }
                        className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-emerald-600 font-mono"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Password (လျှို့ဝှက်နံပါတ်)
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter password..."
                        className="w-full pl-9 pr-9 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-emerald-600 font-mono"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all hover:shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    <span>{isLoading ? 'Authenticating...' : 'Sign In to Swanarh Academy'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>

                {/* Notice about Account Creation by Admin / Co-Admin Only */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  <span className="font-semibold text-slate-900 dark:text-white">အကောင့်သစ်ဖွင့်ခြင်း သတ်မှတ်ချက်: </span>
                  ကျောင်းသားကိုယ်တိုင် အကောင့်သစ် ဖွင့်ခွင့်မရှိပါ။ <strong>Admin</strong> နှင့် <strong>Co-Admin</strong> ဆရာများကသာ ကျောင်းသားအသစ် စာရင်းသွင်းပေးရင်း တစ်ခါတည်း အကောင့်နှင့် သင်တန်းများ သတ်မှတ်ပေးပါသည်။
                </div>
              </div>

              {/* Security Footer */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Protected Classroom Environment · Swanarh Academy</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-slate-400 dark:text-slate-500 py-4 border-t border-slate-200/60 dark:border-slate-800/60">
        Dr. Si Thu Aung · Swanarh Academy · Classroom OS Learning Platform
      </footer>
    </div>
  );
};
