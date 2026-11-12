import React, { useState } from 'react';
import { User, NotificationItem } from '../types/classroom';
import { ClassroomDB } from '../services/storage';
import { ProfilePictureModal } from './ProfilePictureModal';
import { EditUserAccountModal } from './EditUserAccountModal';
import { AcademyLogo } from './AcademyLogo';
import { PWAInstallButton } from './PWAInstallButton';
import { useBackHandler } from '../utils/backNavigation';
import { performFullAppVersionUpdate } from '../utils/appUpdater';
import { resolveAvatarUrl, DEFAULT_AVATAR_SVG } from '../data/presetAvatars';
import {
  Bell,
  Check,
  LogOut,
  ChevronDown,
  Menu,
  X,
  BookOpen,
  Users,
  Layers,
  Shield,
  RotateCcw,
  Sparkles,
  Lock,
  Key,
  Eye,
  EyeOff,
  Sun,
  Moon,
  Camera,
  ScrollText,
  CheckCircle2,
  UserCog,
} from 'lucide-react';

interface NavbarProps {
  currentUser: User;
  allUsers: User[];
  onSelectUser: (user: User) => void;
  onLogout: () => void;
  onOpenArchitecture: () => void;
  onOpenStudentDirectory?: () => void;
  onOpenAuditLog?: () => void;
  onOpenRules?: () => void;
  onResetData: () => void;
  onNavigateHome: () => void;
  notifications: NotificationItem[];
  onRefreshNotifications: () => void;
  onSelectNotificationCourse?: (courseId: string) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onUpdateCurrentUser: (user: User) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  allUsers: _allUsers,
  onSelectUser: _onSelectUser,
  onLogout,
  onOpenArchitecture,
  onOpenStudentDirectory,
  onOpenAuditLog,
  onOpenRules,
  onResetData: _onResetData,
  onNavigateHome,
  notifications,
  onRefreshNotifications,
  onSelectNotificationCourse,
  theme,
  onToggleTheme,
  onUpdateCurrentUser,
}) => {
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  // Profile Picture state (Primary Admin only)
  const [showProfilePictureModal, setShowProfilePictureModal] = useState(false);

  // Edit Own Account Info state (Admin & Co-Admin)
  const [showEditMyAccountModal, setShowEditMyAccountModal] = useState(false);

  // Change Password state
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  // Step-by-step mobile Back button handlers for Navbar drawers/modals
  useBackHandler(showNotifications, () => setShowNotifications(false));
  useBackHandler(showUserDropdown, () => setShowUserDropdown(false));
  useBackHandler(showProfilePictureModal, () => setShowProfilePictureModal(false));
  useBackHandler(showEditMyAccountModal, () => setShowEditMyAccountModal(false));
  useBackHandler(showPasswordModal, () => setShowPasswordModal(false));
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showPwdInputs, setShowPwdInputs] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdSuccess, setPwdSuccess] = useState<string | null>(null);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleMarkNotificationsRead = () => {
    ClassroomDB.markAllNotificationsRead(currentUser.id);
    onRefreshNotifications();
  };

  const handleChangePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPwd.trim()) {
      setPwdError('လက်ရှိ လျှို့ဝှက်နံပါတ် (Current Password) ကို ရိုက်ထည့်ပါ။');
      return;
    }
    if (!newPwd.trim() || newPwd.trim().length < 4) {
      setPwdError('လျှို့ဝှက်နံပါတ် အသစ်သည် အနည်းဆုံး ၄ လုံး ရှိရပါမည်။');
      return;
    }
    if (newPwd.trim() !== confirmPwd.trim()) {
      setPwdError('လျှို့ဝှက်နံပါတ် အသစ် နှစ်ကြိမ် ရိုက်ထည့်မှု မတူညီပါ။');
      return;
    }

    setPwdError(null);
    const res = ClassroomDB.changePassword(currentUser.id, currentPwd.trim(), newPwd.trim());
    if (res.success) {
      setPwdSuccess('စကားဝှက် (Password) အသစ်ကို အောင်မြင်စွာ ပြောင်းလဲပြီးပါပြီ!');
      setCurrentPwd('');
      setNewPwd('');
      setConfirmPwd('');
      setTimeout(() => {
        setPwdSuccess(null);
        setShowPasswordModal(false);
      }, 2000);
    } else {
      setPwdError(res.error || 'စကားဝှက် ပြောင်းလဲရာတွင် အမှားဖြစ်ပေါ်ခဲ့ပါသည်။');
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full max-w-full px-2 sm:px-6 pt-2 sm:pt-3">
      <div className="max-w-7xl mx-auto neu-raised rounded-2xl px-2.5 sm:px-5 h-14 sm:h-16 flex items-center justify-between gap-1.5 sm:gap-4 min-w-0 w-full">
        {/* Zone 1: Brand Wordmark & Role Indicator */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 sm:flex-initial sm:shrink-0">
          <button
            onClick={() => {
              onNavigateHome();
              setShowUserDropdown(false);
            }}
            className="text-sm sm:text-base lg:text-lg font-extrabold tracking-tight text-slate-900 dark:text-slate-100 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer text-left flex items-center gap-2 min-w-0 max-w-full"
          >
            <div className="neu-inset-sm p-1 sm:p-1.5 rounded-xl shrink-0">
              <AcademyLogo size="sm" />
            </div>
            <span className="truncate">SwanArh Classroom</span>
          </button>

          <span className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 hidden xl:inline-block shrink-0">
            · {currentUser.role === 'admin' ? 'Lead Mentor (Admin)' : currentUser.role === 'co_admin' ? 'Co-Admin (တွဲဖက်)' : 'Student (ကျောင်းသား)'}
          </span>
        </div>

        {/* Zone 2: Desktop Navigation Links (hidden on mobile/tablet, visible on lg+) */}
        <nav className="hidden lg:flex items-center gap-4 xl:gap-6 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 shrink-0">
          <button
            onClick={onNavigateHome}
            className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            My Classes
          </button>
          {onOpenRules && (
            <button
              onClick={onOpenRules}
              className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5"
            >
              <ScrollText className="w-3.5 h-3.5" />
              <span>စည်းကမ်းချက်များ</span>
            </button>
          )}
          {(currentUser.role === 'admin' || currentUser.role === 'co_admin') && (
            <>
              {onOpenStudentDirectory && (
                <button
                  onClick={onOpenStudentDirectory}
                  className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Manage Users</span>
                </button>
              )}
              {currentUser.role === 'admin' && onOpenAuditLog && (
                <button
                  onClick={onOpenAuditLog}
                  className="text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Audit Log</span>
                </button>
              )}
            </>
          )}
        </nav>

        {/* Zone 3: Actions (PWA Install, Theme Toggle, Notifications & Unified Profile/Menu Button) */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 min-w-0">
          {/* In-App PWA Install Button (Visible on md+, also inside unified Profile Menu) */}
          <div className="hidden md:block shrink-0">
            <PWAInstallButton variant="navbar" />
          </div>

          {/* Dark / Light Mode Toggle Button (Visible on sm+, also inside unified Profile Menu) */}
          <button
            type="button"
            onClick={onToggleTheme}
            className="hidden sm:flex neu-btn p-2 sm:p-2.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-xl cursor-pointer shrink-0"
            title={theme === 'dark' ? 'Switch to Light Mode (အလင်းရောင်)' : 'Switch to Dark Mode (အမှောင်ရောင်)'}
            aria-label="Toggle color mode"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-amber-400 animate-in spin-in-90 duration-200" />
            ) : (
              <Moon className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-slate-600 animate-in spin-in-90 duration-200" />
            )}
          </button>

          {/* Notifications Bell */}
          <div className="relative shrink-0">
            <button
              onClick={() => {
                setShowNotifications(!showNotifications);
                setShowUserDropdown(false);
              }}
              className="neu-btn p-2 sm:p-2.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-xl relative cursor-pointer"
              aria-label="View notifications"
              title="အတန်းတွင်း အသိပေးချက်များ (Classroom Notifications)"
            >
              <Bell className={`w-4 h-4 sm:w-4.5 sm:h-4.5 ${unreadCount > 0 ? 'text-indigo-600 dark:text-indigo-400' : ''}`} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-extrabold flex items-center justify-center shadow-xs animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Popover (Responsive on Mobile, Tablet & Desktop) */}
            {showNotifications && (
              <div className="neu-card fixed left-2.5 right-2.5 top-16 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2.5 sm:w-96 max-w-[calc(100vw-1.25rem)] max-h-[calc(100dvh-4.75rem)] overflow-y-auto overflow-x-hidden rounded-2xl p-3.5 sm:p-4 z-50">
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200/60 dark:border-slate-800">
                  <div className="flex items-center gap-2 min-w-0">
                    <Bell className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-slate-100 truncate">
                      အသိပေးချက်များ ({unreadCount} အသစ်)
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {typeof window !== 'undefined' &&
                      'Notification' in window &&
                      Notification.permission === 'default' && (
                        <button
                          type="button"
                          onClick={() => {
                            Notification.requestPermission().catch(() => {});
                          }}
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 cursor-pointer"
                          title="Browser Push Notification ဖွင့်ရန်"
                        >
                          🔔 Alert ဖွင့်မည်
                        </button>
                      )}
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkNotificationsRead}
                        className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                      >
                        အားလုံးဖတ်ပြီး
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-2 px-2.5 py-1.5 rounded-lg bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 text-[10px] text-amber-800 dark:text-amber-300 font-medium flex items-center justify-between gap-2">
                  <span className="truncate">⏱ ပို့စ်တင်ပြီး ၃၀ မိနစ်ကြာလျှင် အလိုအလျောက် ပျက်ပါမည်</span>
                  <span className="font-mono font-bold shrink-0">30m Auto-Delete</span>
                </div>

                <div className="space-y-2.5 max-h-72 overflow-y-auto mt-2.5 pr-0.5">
                  {notifications.length === 0 ? (
                    <div className="neu-inset-sm p-5 rounded-xl text-center text-xs text-slate-500 dark:text-slate-400">
                      လက်ရှိတွင် အသိပေးချက် အသစ် မရှိသေးပါ။
                    </div>
                  ) : (
                    notifications.map((notif) => {
                      const remainingMins = notif.expiresAtMs
                        ? Math.max(1, Math.ceil((notif.expiresAtMs - Date.now()) / 60000))
                        : null;
                      return (
                        <div
                          key={notif.id}
                          onClick={() => {
                            ClassroomDB.markNotificationRead(notif.id);
                            onRefreshNotifications();
                            if (notif.courseId && onSelectNotificationCourse) {
                              onSelectNotificationCourse(notif.courseId);
                              setShowNotifications(false);
                            }
                          }}
                          className={`p-3 rounded-xl text-xs transition-all cursor-pointer ${
                            !notif.isRead
                              ? 'neu-inset-sm ring-1 ring-indigo-500/30'
                              : 'opacity-80 hover:opacity-100 hover:bg-white/40 dark:hover:bg-slate-800/40'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-bold text-slate-900 dark:text-slate-100 leading-snug break-words min-w-0">
                              {notif.title}
                            </div>
                            {!notif.isRead && (
                              <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400 shrink-0 mt-1" />
                            )}
                          </div>
                          <p className="text-slate-600 dark:text-slate-300 text-[11px] mt-1 leading-relaxed break-words">
                            {notif.message}
                          </p>
                          <div className="flex items-center justify-between gap-2 mt-2 pt-1.5 border-t border-slate-200/40 dark:border-slate-700/40 text-[10px]">
                            <span className="text-slate-400 font-mono truncate">
                              {notif.createdAt}
                              {remainingMins !== null && (
                                <span className="ml-1.5 text-amber-600 dark:text-amber-400 font-semibold">
                                  · ⏱ {remainingMins}m ကျန်
                                </span>
                              )}
                            </span>
                            {notif.courseId && (
                              <span className="font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
                                အတန်းသို့ →
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Unified Account Profile & Navigation Menu Trigger (Combines Profile + Menu into One Clean Button) */}
          <div className="relative min-w-0 shrink">
            <button
              onClick={() => {
                setShowUserDropdown(!showUserDropdown);
                setShowNotifications(false);
              }}
              className="neu-btn flex items-center gap-1.5 sm:gap-2 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-xl cursor-pointer min-w-0 max-w-[160px] sm:max-w-[200px] md:max-w-[230px]"
              title={`${currentUser.name} (@${currentUser.username}) — Menu & Account Settings`}
            >
              {currentUser.role === 'admin' ? (
                <img
                  src={resolveAvatarUrl(currentUser.avatar)}
                  alt={currentUser.name}
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = DEFAULT_AVATAR_SVG;
                  }}
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-contain bg-white p-0.5 shrink-0 ring-2 ring-indigo-500/30 dark:ring-indigo-400/40 shadow-2xs"
                />
              ) : (
                <div
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-extrabold text-xs shrink-0 border ${
                    currentUser.role === 'co_admin'
                      ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                      : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                  }`}
                >
                  {currentUser.role === 'co_admin' ? '👥' : '🎓'}
                </div>
              )}
              <div className="text-left min-w-0 flex-1 overflow-hidden">
                <div className="text-[11px] sm:text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                  {currentUser.name}
                </div>
                {currentUser.role === 'student' && currentUser.rulesAccepted ? (
                  <div className="text-[9px] sm:text-[10px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-0.5 truncate">
                    <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />
                    <span className="truncate">သိရှိ လိုက်နာပါမည်</span>
                  </div>
                ) : (
                  <div className="text-[9px] sm:text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold truncate">
                    {currentUser.role === 'admin'
                      ? 'Lead Mentor (Admin)'
                      : currentUser.role === 'co_admin'
                      ? 'Co-Admin'
                      : 'Student'}
                  </div>
                )}
              </div>
              {showUserDropdown ? (
                <X className="w-3.5 h-3.5 text-slate-500 dark:text-slate-300 shrink-0" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              )}
            </button>

            {/* Unified Account Profile & Navigation Dropdown (Mobile, Tablet & Web) */}
            {showUserDropdown && (
              <div className="neu-card fixed left-2.5 right-2.5 top-16 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2.5 sm:w-88 max-w-[calc(100vw-1.25rem)] max-h-[calc(100dvh-4.75rem)] overflow-y-auto overflow-x-hidden rounded-2xl p-3 z-50 space-y-2 animate-in fade-in zoom-in-95 duration-150">
                {/* User Identity Summary Header */}
                <div className="neu-inset-sm p-3 rounded-xl flex items-center justify-between gap-2.5 min-w-0">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {currentUser.role === 'admin' ? (
                      <img
                        src={resolveAvatarUrl(currentUser.avatar)}
                        alt={currentUser.name}
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = DEFAULT_AVATAR_SVG;
                        }}
                        className="w-11 h-11 rounded-full object-contain bg-white p-0.5 shrink-0 ring-2 ring-indigo-500/30 dark:ring-indigo-400/40 shadow-xs"
                      />
                    ) : (
                      <div
                        className={`w-11 h-11 rounded-2xl flex items-center justify-center text-base font-extrabold shrink-0 border ${
                          currentUser.role === 'co_admin'
                            ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                            : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                        }`}
                      >
                        {currentUser.role === 'co_admin' ? '👥' : '🎓'}
                      </div>
                    )}
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <div className="text-xs font-extrabold text-slate-900 dark:text-slate-100 truncate">
                        {currentUser.name}
                      </div>
                      <div className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 truncate">
                        @{currentUser.username}
                      </div>
                      {currentUser.role === 'student' && currentUser.rulesAccepted ? (
                        <div className="mt-0.5 inline-flex items-center gap-1 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>သိရှိ လိုက်နာပါမည်</span>
                        </div>
                      ) : (
                        <div className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 truncate">
                          {currentUser.role === 'admin'
                            ? 'Lead Mentor (Admin)'
                            : currentUser.role === 'co_admin'
                            ? 'Co-Admin (တွဲဖက် အက်ဒမင်)'
                            : 'Student (ကျောင်းသား)'}
                        </div>
                      )}
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {currentUser.email}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Unified Menu Items (Navigation + Account + System Actions) */}
                <div className="space-y-1">
                  {/* PWA Install Button (when available) */}
                  <PWAInstallButton variant="mobile-drawer" />

                  {/* Theme Mode Switcher */}
                  <button
                    type="button"
                    onClick={onToggleTheme}
                    className="w-full flex items-center justify-between gap-2 p-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/70 transition-colors cursor-pointer min-w-0"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {theme === 'dark' ? (
                        <Sun className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      ) : (
                        <Moon className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                      )}
                      <span className="truncate">
                        Theme: {theme === 'dark' ? 'Dark Mode (အမှောင်)' : 'Light Mode (အလင်း)'}
                      </span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300 shrink-0">
                      ပြောင်းမည်
                    </span>
                  </button>

                  {/* My Classes Navigation */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowUserDropdown(false);
                      onNavigateHome();
                    }}
                    className="w-full flex items-center gap-2.5 p-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/70 transition-colors cursor-pointer min-w-0"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <span className="truncate">My Classes (သင်ခန်းစာ အတန်းများ)</span>
                  </button>

                  {/* Academy Rules */}
                  {onOpenRules && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowUserDropdown(false);
                        onOpenRules();
                      }}
                      className="w-full flex items-center gap-2.5 p-2.5 rounded-xl text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors cursor-pointer font-bold min-w-0"
                    >
                      <ScrollText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="truncate">သင်တန်းစည်းကမ်းချက်များ (Academy Rules)</span>
                    </button>
                  )}

                  {/* Manage Users & Add Students (Staff Only) */}
                  {(currentUser.role === 'admin' || currentUser.role === 'co_admin') &&
                    onOpenStudentDirectory && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowUserDropdown(false);
                          onOpenStudentDirectory();
                        }}
                        className="w-full flex items-center gap-2.5 p-2.5 rounded-xl text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-50/70 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors cursor-pointer font-bold min-w-0"
                      >
                        <Users className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                        <span className="truncate">Manage Users & Add Students (ကျောင်းသား စီမံရန်)</span>
                      </button>
                    )}

                  {/* Edit Own Account Info (Staff Only) */}
                  {(currentUser.role === 'admin' || currentUser.role === 'co_admin') && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowUserDropdown(false);
                        setShowEditMyAccountModal(true);
                      }}
                      className="w-full flex items-center gap-2.5 p-2.5 rounded-xl text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-50/70 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors cursor-pointer font-bold min-w-0"
                    >
                      <UserCog className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <span className="truncate">မိမိအကောင့် အချက်အလက်ပြင်ရန် (Edit My Account)</span>
                    </button>
                  )}

                  {/* Change Profile Picture (Primary Admin Only) */}
                  {currentUser.role === 'admin' && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowUserDropdown(false);
                        setShowProfilePictureModal(true);
                      }}
                      className="w-full flex items-center gap-2.5 p-2.5 rounded-xl text-xs text-slate-700 dark:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/70 transition-colors cursor-pointer font-semibold min-w-0"
                    >
                      <Camera className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <span className="truncate">Change Profile Picture (ပရိုဖိုင်ဓာတ်ပုံ ပြောင်းမည်)</span>
                    </button>
                  )}

                  {/* Security Audit Log (Primary Admin Only) */}
                  {currentUser.role === 'admin' && onOpenAuditLog && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowUserDropdown(false);
                        onOpenAuditLog();
                      }}
                      className="w-full flex items-center gap-2.5 p-2.5 rounded-xl text-xs text-amber-800 dark:text-amber-300 bg-amber-50/70 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors cursor-pointer font-bold min-w-0"
                    >
                      <Shield className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span className="truncate">Security Audit Log (လုပ်ဆောင်ချက် မှတ်တမ်း)</span>
                    </button>
                  )}

                  {/* Change Password */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowUserDropdown(false);
                      setShowPasswordModal(true);
                      setPwdError(null);
                      setPwdSuccess(null);
                    }}
                    className="w-full flex items-center gap-2.5 p-2.5 rounded-xl text-xs text-slate-700 dark:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/70 transition-colors cursor-pointer font-semibold min-w-0"
                  >
                    <Key className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <span className="truncate">Change Password (စကားဝှက် ပြောင်းမည်)</span>
                  </button>

                  {/* Update App & Sync */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowUserDropdown(false);
                      performFullAppVersionUpdate(onRefreshNotifications);
                    }}
                    className="w-full flex items-center gap-2.5 p-2.5 rounded-xl text-xs text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50/70 dark:hover:bg-indigo-950/40 transition-colors cursor-pointer font-bold min-w-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <span className="truncate">Update App & Sync (ဗားရှင်းအသစ် ရယူရန်)</span>
                  </button>

                  {/* Sign Out */}
                  <div className="pt-1 border-t border-slate-200/60 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setShowUserDropdown(false);
                        onLogout();
                      }}
                      className="w-full flex items-center gap-2.5 p-2.5 rounded-xl text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50/70 dark:hover:bg-rose-950/40 transition-colors cursor-pointer font-bold min-w-0"
                    >
                      <LogOut className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">Sign Out (အကောင့်မှ ထွက်ရန်)</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Profile Picture Modal (Primary Admin only) */}
      {showProfilePictureModal && currentUser.role === 'admin' && (
        <ProfilePictureModal
          user={currentUser}
          isOpen={showProfilePictureModal}
          onClose={() => setShowProfilePictureModal(false)}
          onSuccess={(updated) => {
            onUpdateCurrentUser(updated);
          }}
        />
      )}

      {/* Edit Own Account Info Modal (Admin & Co-Admin) */}
      {showEditMyAccountModal && (currentUser.role === 'admin' || currentUser.role === 'co_admin') && (
        <EditUserAccountModal
          user={currentUser}
          isOpen={showEditMyAccountModal}
          onClose={() => setShowEditMyAccountModal(false)}
          onSuccess={(updated) => {
            onUpdateCurrentUser(updated);
            onRefreshNotifications();
          }}
        />
      )}

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm">
          <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                    Change Password (စကားဝှက် ပြောင်းမည်)
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    @{currentUser.username} ({currentUser.name})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPasswordModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {pwdError && (
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs">
                {pwdError}
              </div>
            )}

            {pwdSuccess && (
              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>{pwdSuccess}</span>
              </div>
            )}

            <form onSubmit={handleChangePasswordSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  လက်ရှိ လျှို့ဝှက်နံပါတ် (Current Password) *
                </label>
                <input
                  type={showPwdInputs ? 'text' : 'password'}
                  value={currentPwd}
                  onChange={(e) => setCurrentPwd(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-indigo-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  စကားဝှက် အသစ် (New Password) *
                </label>
                <input
                  type={showPwdInputs ? 'text' : 'password'}
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  placeholder="Min 4 characters"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-indigo-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  စကားဝှက် အသစ်ကို ထပ်မံရိုက်ထည့်ပါ (Confirm) *
                </label>
                <input
                  type={showPwdInputs ? 'text' : 'password'}
                  value={confirmPwd}
                  onChange={(e) => setConfirmPwd(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-indigo-500 font-mono"
                  required
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setShowPwdInputs(!showPwdInputs)}
                  className="text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                >
                  {showPwdInputs ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{showPwdInputs ? 'Hide passwords' : 'Show passwords'}</span>
                </button>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="px-3 py-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  ပြောင်းလဲမည် (Save)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};
