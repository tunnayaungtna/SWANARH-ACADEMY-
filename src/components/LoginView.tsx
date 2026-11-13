import React, { useState } from 'react';
import { ClassroomDB } from '../services/storage';
import { User, UserRole } from '../types/classroom';
import { AcademyLogo } from './AcademyLogo';
import { PWAInstallButton } from './PWAInstallButton';
import { performFullAppVersionUpdate } from '../utils/appUpdater';
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
  RefreshCw,
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

  const [errorMessage, setErrorMessage] = useState<string | null>(() =>
    ClassroomDB.consumeKickReason()
  );
  const [isDeviceLocked, setIsDeviceLocked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdatingApp, setIsUpdatingApp] = useState(false);

  React.useEffect(() => {
    try {
      localStorage.removeItem('classroom_custom_academy_logo');
      localStorage.removeItem('classroom_custom_academy_logo_v2');
      const kickReason = ClassroomDB.consumeKickReason();
      if (kickReason) {
        setErrorMessage(kickReason);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleSwitchTab = (role: UserRole) => {
    setActiveRole(role);
    setErrorMessage(null);
    setIsDeviceLocked(false);
  };

  const executeSignIn = async (forceTakeover: boolean) => {
    if (!identifier.trim()) {
      setErrorMessage('ကျေးဇူးပြု၍ သင်၏ Username သို့မဟုတ် Email ကို ရိုက်ထည့်ပါ။');
      return;
    }

    setErrorMessage(null);
    setIsDeviceLocked(false);
    setIsLoading(true);

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;

    const remotePromise = ClassroomDB.loginWithRemoteFallback(
      identifier,
      password,
      activeRole,
      forceTakeover
    ).then((result) => {
      if (timeoutId) clearTimeout(timeoutId);
      return result;
    });

    const timeoutPromise = new Promise<{
      user: User | null;
      deviceLocked?: boolean;
      error?: string;
    }>((resolve) => {
      timeoutId = setTimeout(() => {
        timedOut = true;
        resolve(ClassroomDB.login(identifier, password, activeRole, forceTakeover));
      }, 3800);
    });

    const res = await Promise.race([remotePromise, timeoutPromise]);
    if (timeoutId && !timedOut) {
      clearTimeout(timeoutId);
    }
    setIsLoading(false);

    if (res.deviceLocked) {
      setIsDeviceLocked(true);
      setErrorMessage(res.error || 'ဤအကောင့်သည် အခြားစက်တွင် Login ဝင်ထားပါသည်။');
      return;
    }

    if (res.error) {
      setErrorMessage(res.error);
    } else if (res.user) {
      if (res.user.role !== activeRole) {
        ClassroomDB.logout();
        setErrorMessage(ClassroomDB.getRoleMismatchError(res.user.role, activeRole));
        return;
      }
      onLoginSuccess(res.user);
      ClassroomDB.pullFromSupabase().catch(() => {});
    }
  };

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeSignIn(false);
  };

  // Smart Paste: If a student copies the entire Login Info message from Admin and pastes it into Username/Email,
  // automatically extract both Username/Email and Password!
  const handleIdentifierPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData?.getData('text') || '';
    if (!pasted || !pasted.includes('\n')) return;

    const lines = pasted
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    let extractedId = '';
    let extractedPwd = '';

    for (const line of lines) {
      const userMatch = line.match(/^(?:🔑\s*)?(?:username|user\s*id)\s*[:：=\-]\s*(.+)$/i);
      const emailMatch = line.match(/^(?:📧\s*)?(?:email|e-mail|mail)\s*[:：=\-]\s*(.+)$/i);
      const pwdMatch = line.match(/^(?:🔒\s*)?(?:password|စကားဝှက်|pass)\s*[:：=\-]\s*(.+)$/i);

      if (userMatch && userMatch[1]) {
        extractedId = userMatch[1].trim();
      } else if (!extractedId && emailMatch && emailMatch[1]) {
        extractedId = emailMatch[1].trim();
      } else if (pwdMatch && pwdMatch[1]) {
        extractedPwd = pwdMatch[1].trim();
      }
    }

    if (extractedId && extractedPwd) {
      e.preventDefault();
      setIdentifier(extractedId);
      setPassword(extractedPwd);
      setErrorMessage(null);
    }
  };

  const handleUpdateLoginApp = async () => {
    if (isUpdatingApp) return;
    setIsUpdatingApp(true);
    await performFullAppVersionUpdate();
  };

  return (
    <div className="min-h-screen neu-canvas text-slate-900 dark:text-slate-100 flex flex-col justify-between transition-colors duration-300 selection:bg-emerald-500/20">
      {/* Top Sculpted Neumorphic Header Bar */}
      <header className="sticky top-0 z-30 w-full px-3 sm:px-6 pt-3">
        <div className="max-w-7xl mx-auto neu-raised rounded-2xl px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="neu-inset-sm p-1.5 rounded-xl shrink-0">
              <AcademyLogo size="sm" />
            </div>
            <div className="truncate">
              <span className="text-sm sm:text-base font-extrabold tracking-tight text-slate-900 dark:text-white block leading-tight truncate">
                SwanArh Classroom
              </span>
              <span className="text-[10px] sm:text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold tracking-wide block leading-tight truncate">
                Dr. Si Thu Aung · Swanarh Academy
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleUpdateLoginApp}
              disabled={isUpdatingApp}
              className="neu-btn flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-400 cursor-pointer whitespace-nowrap"
              title="Classroom App ဗားရှင်းအသစ်နှင့် နောက်ဆုံးအချက်အလက်များကို ရယူရန်"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isUpdatingApp ? 'animate-spin' : ''}`} />
              <span>{isUpdatingApp ? 'Updating...' : 'Update App'}</span>
            </button>
            <PWAInstallButton variant="login" />
            <button
              type="button"
              onClick={onToggleTheme}
              className="neu-btn flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer whitespace-nowrap"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Light Surface</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-slate-600" />
                  <span className="hidden sm:inline">Dark Surface</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Split Layout */}
      <main className="max-w-6xl w-full mx-auto px-4 sm:px-8 py-8 sm:py-12 my-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Column: Sculpted Neumorphic Academy Brand Showcase */}
          <div className="lg:col-span-5 flex flex-col items-center lg:items-start text-center lg:text-left space-y-6">
            {/* Double-Ring Sculpted Neumorphic Pedestal for Official Crest Logo */}
            <div className="neu-card p-3.5 rounded-full inline-flex items-center justify-center">
              <div className="neu-inset p-2.5 rounded-full inline-flex items-center justify-center">
                <div className="rounded-full bg-white p-1.5 shadow-xs">
                  <AcademyLogo size="xl" />
                </div>
              </div>
            </div>

            {/* Academy Title & Mission */}
            <div className="space-y-3">
              <div className="flex items-center justify-center lg:justify-start gap-2 text-xs font-bold tracking-wide text-rose-600 dark:text-rose-400">
                <span>Dr. Si Thu Aung</span>
                <span aria-hidden="true">·</span>
                <span className="text-emerald-700 dark:text-emerald-400">Official Digital Campus</span>
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
                SWANARH ACADEMY
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-md">
                ခေတ်မီ သင်ကြားရေးနှင့် ပညာရေးစီမံခန့်ခွဲမှုစနစ် — သင်ခန်းစာများ၊ ဗီဒီယိုပို့ချချက်များနှင့် သင်တန်းတက်ရောက်မှုမှတ်တမ်းများကို တစ်နေရာတည်းတွင် လုံခြုံစွာ သင်ယူနိုင်သော Digital Classroom Platform။
              </p>
            </div>

            {/* Tactile Neumorphic Feature Modules */}
            <div className="w-full max-w-md space-y-3.5 text-left">
              <div className="neu-raised p-4 rounded-2xl flex items-start gap-3.5">
                <div className="neu-inset-sm p-2.5 rounded-xl text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-extrabold text-slate-900 dark:text-slate-100">
                    Authorized Student Enrollment
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                    သင်တန်းသား အကောင့်သစ်များကို Admin နှင့် Co-Admin ဆရာများကသာ သင်တန်းအပ်နှံပေးရင်း တစ်ခါတည်း အကောင့်ဖွင့်ပေးသည့် လုံခြုံသောစနစ် ဖြစ်ပါသည်။
                  </p>
                </div>
              </div>

              <div className="neu-raised p-4 rounded-2xl flex items-start gap-3.5">
                <div className="neu-inset-sm p-2.5 rounded-xl text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
                  <Award className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-extrabold text-slate-900 dark:text-slate-100">
                    Verified Academic Certificates & Attendance
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                    သင်တန်းတက်ရောက်မှု (Attendance) နှင့် သင်ယူမှုမှတ်တမ်းများအလိုက် အသိအမှတ်ပြု သင်တန်းဆင်းလက်မှတ် ရယူနိုင်ပါသည်။
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Device-Aware Direct Install Card + Premium Neumorphic Sign In Console */}
          <div className="lg:col-span-7 w-full max-w-xl mx-auto space-y-5">
            {/* Device-Aware Direct App Install Banner */}
            <PWAInstallButton variant="login-device-card" />

            {/* Main Sculpted Neumorphic Sign In Card */}
            <div className="neu-card rounded-3xl p-6 sm:p-8 space-y-6 transition-all duration-300">
              {/* Console Header */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="neu-inset-sm p-2.5 rounded-2xl text-emerald-600 dark:text-emerald-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white leading-tight">
                      Account Sign In (အကောင့်ဝင်ရန်)
                    </h2>
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      Swanarh Academy · Authorized Access Only
                    </span>
                  </div>
                </div>

                <div className="neu-inset-sm px-3 py-1.5 rounded-xl text-[11px] font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                  {activeRole === 'admin'
                    ? 'Admin'
                    : activeRole === 'co_admin'
                    ? 'Co-Admin'
                    : 'Student'}
                </div>
              </div>

              {/* Recessed Neumorphic 3-Role Segmented Switcher */}
              <div className="neu-inset p-1.5 rounded-2xl grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleSwitchTab('student')}
                  className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    activeRole === 'student'
                      ? 'neu-raised-sm text-emerald-800 dark:text-emerald-300'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <GraduationCap
                    className={`w-3.5 h-3.5 ${
                      activeRole === 'student'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-slate-400'
                    }`}
                  />
                  <span>Student</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSwitchTab('admin')}
                  className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    activeRole === 'admin'
                      ? 'neu-raised-sm text-rose-700 dark:text-rose-300'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <School
                    className={`w-3.5 h-3.5 ${
                      activeRole === 'admin'
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-slate-400'
                    }`}
                  />
                  <span>Admin</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSwitchTab('co_admin')}
                  className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    activeRole === 'co_admin'
                      ? 'neu-raised-sm text-amber-800 dark:text-amber-300'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <Users
                    className={`w-3.5 h-3.5 ${
                      activeRole === 'co_admin'
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-slate-400'
                    }`}
                  />
                  <span>Co-Admin</span>
                </button>
              </div>

              {/* Active Role Subtitle */}
              <div className="space-y-1">
                <div className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100">
                  {activeRole === 'admin'
                    ? 'Administrator Sign In (ဆရာ / အက်ဒမင်)'
                    : activeRole === 'co_admin'
                    ? 'Co-Administrator Sign In (တွဲဖက်ဆရာ)'
                    : 'Student Account Sign In (သင်တန်းသား ဝင်ရန်)'}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {activeRole === 'admin'
                    ? 'သင်တန်းများ၊ သင်ခန်းစာများနှင့် ကျောင်းသားအကောင့် အသစ်များကို စီမံခန့်ခွဲရန်'
                    : activeRole === 'co_admin'
                    ? 'ကျောင်းသားအသစ် ထည့်သွင်းခြင်း၊ သင်ခန်းစာ Post တင်ခြင်းနှင့် Attendance စီမံရန်'
                    : 'သင်တန်းမှ ထုတ်ပေးထားသော Username သို့မဟုတ် Email နှင့် Password ကို အသုံးပြု၍ အမြန်ဝင်ရောက်ပါ'}
                </p>
              </div>

              {/* Error Message Toast & Single-Device Switch Control */}
              {errorMessage && (
                <div className="neu-inset p-3.5 rounded-2xl space-y-2.5 text-rose-700 dark:text-rose-300 text-xs font-medium">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                    <div className="leading-snug">{errorMessage}</div>
                  </div>
                  {isDeviceLocked && (
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => executeSignIn(true)}
                      className="w-full py-2.5 px-3.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>
                        အခြားစက်မှ အကောင့်ထွက်ပြီး ဤစက်တွင် ဝင်မည် (Switch Active Device Here)
                      </span>
                    </button>
                  )}
                </div>
              )}

              {/* Neumorphic Sign In Form */}
              <form onSubmit={handleSignInSubmit} className="space-y-5">
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 pl-1">
                    {activeRole === 'admin'
                      ? 'Admin Username သို့မဟုတ် Email (ဆရာအကောင့်သာ)'
                      : activeRole === 'co_admin'
                      ? 'Co-Admin Username သို့မဟုတ် Email (တွဲဖက်ဆရာအကောင့်သာ)'
                      : 'Student Username သို့မဟုတ် Email (ကျောင်းသားအကောင့်သာ)'}
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3.5 pointer-events-none text-slate-400 dark:text-slate-500">
                      <UserIcon className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      onPaste={handleIdentifierPaste}
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      autoComplete="username"
                      placeholder={
                        activeRole === 'admin'
                          ? 'Admin Username သို့မဟုတ် Email ရိုက်ထည့်ပါ'
                          : activeRole === 'co_admin'
                          ? 'Co-Admin Username သို့မဟုတ် Email ရိုက်ထည့်ပါ'
                          : 'Student Username သို့မဟုတ် Email ရိုက်ထည့်ပါ'
                      }
                      className="neu-input w-full pl-10 pr-4 py-3.5 text-xs sm:text-sm rounded-2xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 font-mono"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 pl-1">
                    Password (လျှို့ဝှက်နံပါတ်)
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3.5 pointer-events-none text-slate-400 dark:text-slate-500">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      autoComplete="current-password"
                      placeholder="Enter password..."
                      className="neu-input w-full pl-10 pr-12 py-3.5 text-xs sm:text-sm rounded-2xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 font-mono"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="neu-btn absolute right-2 p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="neu-btn-emerald w-full flex items-center justify-center gap-2 py-3.5 px-5 text-white text-xs sm:text-sm font-extrabold rounded-2xl cursor-pointer disabled:opacity-50"
                >
                  <span>{isLoading ? 'Authenticating...' : 'Sign In to Swanarh Academy'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              {/* Recessed Neumorphic Notice about Account Creation */}
              <div className="neu-inset p-4 rounded-2xl text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                <span className="font-bold text-slate-900 dark:text-white">
                  အကောင့်သစ်ဖွင့်ခြင်း သတ်မှတ်ချက်:{' '}
                </span>
                ကျောင်းသားကိုယ်တိုင် အကောင့်သစ် ဖွင့်ခွင့်မရှိပါ။ <strong>Admin</strong> နှင့်{' '}
                <strong>Co-Admin</strong> ဆရာများကသာ ကျောင်းသားအသစ် စာရင်းသွင်းပေးရင်း တစ်ခါတည်း အကောင့်နှင့် သင်တန်းများ သတ်မှတ်ပေးပါသည်။
              </div>

              {/* Clean Unboxed Security Footer */}
              <div className="pt-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1.5 font-medium">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Protected Classroom Environment · Swanarh Academy</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-slate-500 dark:text-slate-400 py-5">
        Dr. Si Thu Aung · Swanarh Academy · Classroom OS Learning Platform
      </footer>
    </div>
  );
};
