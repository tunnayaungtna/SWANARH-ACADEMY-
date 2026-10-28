import React, { useState } from 'react';
import { User, NotificationItem } from '../types/classroom';
import { ClassroomDB } from '../services/storage';
import { ProfilePictureModal } from './ProfilePictureModal';
import { AcademyLogo } from './AcademyLogo';
import { PWAInstallButton } from './PWAInstallButton';
import { useBackHandler } from '../utils/backNavigation';
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
} from 'lucide-react';

interface NavbarProps {
  currentUser: User;
  allUsers: User[];
  onSelectUser: (user: User) => void;
  onLogout: () => void;
  onOpenArchitecture: () => void;
  onOpenSecurity: () => void;
  onOpenStudentDirectory?: () => void;
  onResetData: () => void;
  onNavigateHome: () => void;
  notifications: NotificationItem[];
  onRefreshNotifications: () => void;
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
  onOpenSecurity,
  onOpenStudentDirectory,
  onResetData: _onResetData,
  onNavigateHome,
  notifications,
  onRefreshNotifications,
  theme,
  onToggleTheme,
  onUpdateCurrentUser,
}) => {
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Profile Picture state
  const [showProfilePictureModal, setShowProfilePictureModal] = useState(false);

  // Change Password state
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  // Step-by-step mobile Back button handlers for Navbar drawers/modals
  useBackHandler(isMobileMenuOpen, () => setIsMobileMenuOpen(false));
  useBackHandler(showNotifications, () => setShowNotifications(false));
  useBackHandler(showUserDropdown, () => setShowUserDropdown(false));
  useBackHandler(showProfilePictureModal, () => setShowProfilePictureModal(false));
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
    <header className="sticky top-0 z-40 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-15 sm:h-16 flex items-center justify-between gap-3 sm:gap-6">
        {/* Zone 1: Brand Wordmark & Role Indicator */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            onClick={() => {
              onNavigateHome();
              setIsMobileMenuOpen(false);
            }}
            className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer text-left flex items-center gap-2"
          >
            <AcademyLogo size="sm" />
            <span>SwanArh Classroom</span>
          </button>

          <span className="text-[10px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 hidden xs:inline-block">
            · {currentUser.role === 'admin' ? 'Admin (ဆရာ)' : currentUser.role === 'co_admin' ? 'Co-Admin (တွဲဖက်)' : 'Student (ကျောင်းသား)'}
          </span>
        </div>

        {/* Zone 2: Desktop Navigation Links (hidden on mobile, visible on lg+) */}
        <nav className="hidden lg:flex items-center gap-5 xl:gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
          <button
            onClick={onNavigateHome}
            className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            My Classes
          </button>
          {(currentUser.role === 'admin' || currentUser.role === 'co_admin') && (
            <>
              {onOpenStudentDirectory && (
                <button
                  onClick={onOpenStudentDirectory}
                  className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Manage Users</span>
                </button>
              )}
              <button
                onClick={onOpenArchitecture}
                className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                DB Schema & RLS
              </button>
              <button
                onClick={onOpenSecurity}
                className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Video Protection
              </button>
            </>
          )}
        </nav>

        {/* Zone 3: Actions (PWA Install, Theme Toggle, Notifications, Profile Switcher & Mobile Menu Toggle) */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* In-App PWA Install Button */}
          <PWAInstallButton variant="navbar" />

          {/* Dark / Light Mode Toggle Button */}
          <button
            type="button"
            onClick={onToggleTheme}
            className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title={theme === 'dark' ? 'Switch to Light Mode (အလင်းရောင်)' : 'Switch to Dark Mode (အမှောင်ရောင်)'}
            aria-label="Toggle color mode"
          >
            {theme === 'dark' ? (
              <Sun className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-amber-400 animate-in spin-in-90 duration-200" />
            ) : (
              <Moon className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-slate-600 animate-in spin-in-90 duration-200" />
            )}
          </button>

          {/* Notifications Bell */}
          <div className="relative">
            <button
              onClick={() => {
                setShowNotifications(!showNotifications);
                setShowUserDropdown(false);
              }}
              className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors relative cursor-pointer"
              aria-label="View notifications"
            >
              <Bell className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              )}
            </button>

            {/* Notifications Popover */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-76 sm:w-80 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 p-3 z-50">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    Notifications ({unreadCount} new)
                  </span>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkNotificationsRead}
                      className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-72 overflow-y-auto mt-2">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      No notifications at this time
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        className={`py-2 px-1 text-xs ${
                          !notif.isRead ? 'bg-indigo-50/50 dark:bg-indigo-950/30 rounded' : ''
                        }`}
                      >
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{notif.title}</div>
                        <p className="text-slate-600 dark:text-slate-300 text-[11px] mt-0.5">{notif.message}</p>
                        <span className="text-[10px] text-slate-400 font-mono mt-1 block">
                          {notif.createdAt}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Account Dropdown Trigger */}
          <div className="relative">
            <button
              onClick={() => {
                setShowUserDropdown(!showUserDropdown);
                setShowNotifications(false);
              }}
              className="flex items-center gap-1.5 sm:gap-2 p-1 sm:p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                referrerPolicy="no-referrer"
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover shrink-0 ring-1 ring-slate-200 dark:ring-slate-700"
              />
              <div className="hidden sm:block text-left pr-1 max-w-[100px] md:max-w-[120px]">
                <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {currentUser.name}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 capitalize">
                  {currentUser.role}
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>

            {/* Account Profile Dropdown */}
            {showUserDropdown && (
              <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 p-2 z-50">
                <div className="px-3 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2.5">
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.name}
                    referrerPolicy="no-referrer"
                    className="w-9 h-9 rounded-full object-cover shrink-0 ring-1 ring-slate-200 dark:ring-slate-700"
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                      {currentUser.name}
                    </div>
                    <div className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 truncate">
                      @{currentUser.username}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                      {currentUser.email}
                    </div>
                  </div>
                </div>

                {/* Account Actions: Profile Picture (Admin & Co-Admin only) & Password */}
                <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 space-y-0.5">
                  {(currentUser.role === 'admin' || currentUser.role === 'co_admin') && (
                    <button
                      onClick={() => {
                        setShowUserDropdown(false);
                        setShowProfilePictureModal(true);
                      }}
                      className="w-full flex items-center gap-2 p-2 rounded-lg text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer font-medium"
                    >
                      <Camera className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span>Change Profile Picture (ဓာတ်ပုံ ပြောင်းမည်)</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setShowUserDropdown(false);
                      setShowPasswordModal(true);
                      setPwdError(null);
                      setPwdSuccess(null);
                    }}
                    className="w-full flex items-center gap-2 p-2 rounded-lg text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer font-medium"
                  >
                    <Key className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Change Password (စကားဝှက် ပြောင်းမည်)</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowUserDropdown(false);
                      onLogout();
                    }}
                    className="w-full flex items-center gap-2 p-2 rounded-lg text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer font-medium"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out (အကောင့်မှ ထွက်ရန်)</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Menu Hamburger Button (visible on mobile/tablet < lg) */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {isMobileMenuOpen && (
        <div className="lg:hidden bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 space-y-2 shadow-lg animate-in slide-in-from-top-2 duration-150">
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                referrerPolicy="no-referrer"
                className="w-8 h-8 rounded-full object-cover"
              />
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100">{currentUser.name}</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 capitalize">
                  {currentUser.role === 'admin'
                    ? 'Faculty / Admin (ဆရာ)'
                    : currentUser.role === 'co_admin'
                    ? 'Co-Admin (တွဲဖက် အက်ဒမင်)'
                    : 'Student (ကျောင်းသား)'}
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                onLogout();
              }}
              className="text-xs font-medium text-rose-600 dark:text-rose-400 hover:text-rose-700 px-2 py-1 rounded bg-rose-50 dark:bg-rose-950/50 cursor-pointer"
            >
              Sign Out
            </button>
          </div>

          <div className="grid grid-cols-1 gap-1 text-xs font-medium">
            {/* Mobile PWA Install Button */}
            <PWAInstallButton variant="mobile-drawer" />

            {/* Mobile Theme Toggle */}
            <button
              onClick={onToggleTheme}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-left cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                {theme === 'dark' ? (
                  <Sun className="w-4 h-4 text-amber-400" />
                ) : (
                  <Moon className="w-4 h-4 text-slate-600" />
                )}
                <span>Theme Mode: {theme === 'dark' ? 'Dark Mode (အမှောင်)' : 'Light Mode (အလင်း)'}</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                Change
              </span>
            </button>

            <button
              onClick={() => {
                onNavigateHome();
                setIsMobileMenuOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-left cursor-pointer"
            >
              <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>My Classes (သင်ခန်းစာ အတန်းများ)</span>
            </button>

            {(currentUser.role === 'admin' || currentUser.role === 'co_admin') && onOpenStudentDirectory && (
              <button
                onClick={() => {
                  onOpenStudentDirectory();
                  setIsMobileMenuOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-indigo-700 dark:text-indigo-300 bg-indigo-50/70 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-left font-semibold cursor-pointer"
              >
                <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Manage Users & Add Students (ကျောင်းသား စီမံရန်)</span>
              </button>
            )}

            {/* Profile Picture Option in Mobile Drawer (Admin & Co-Admin only) */}
            {(currentUser.role === 'admin' || currentUser.role === 'co_admin') && (
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setShowProfilePictureModal(true);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-left cursor-pointer"
              >
                <Camera className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Change Profile Picture (ပရိုဖိုင်ဓာတ်ပုံ ပြောင်းမည်)</span>
              </button>
            )}

            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                setShowPasswordModal(true);
                setPwdError(null);
                setPwdSuccess(null);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-left cursor-pointer"
            >
              <Key className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Change Password (စကားဝှက် ပြောင်းမည်)</span>
            </button>

            {(currentUser.role === 'admin' || currentUser.role === 'co_admin') && (
              <>
                <button
                  onClick={() => {
                    onOpenArchitecture();
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-left cursor-pointer"
                >
                  <Layers className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                  <span>DB Schema & RLS Architecture</span>
                </button>

                <button
                  onClick={() => {
                    onOpenSecurity();
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-left cursor-pointer"
                >
                  <Shield className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                  <span>Video Protection & Anti-Piracy</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Profile Picture Modal (Admin & Co-Admin only) */}
      {showProfilePictureModal && (currentUser.role === 'admin' || currentUser.role === 'co_admin') && (
        <ProfilePictureModal
          user={currentUser}
          isOpen={showProfilePictureModal}
          onClose={() => setShowProfilePictureModal(false)}
          onSuccess={(updated) => {
            onUpdateCurrentUser(updated);
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
