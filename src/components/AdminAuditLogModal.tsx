import React, { useState, useEffect, useMemo } from 'react';
import {
  User,
  Course,
  AuditLogEntry,
  AuditLogCategory,
  AuditLogSeverity,
} from '../types/classroom';
import { ClassroomDB } from '../services/storage';
import { AUDIT_LOG_TTL_MS } from '../services/supabase';
import {
  ShieldAlert,
  ShieldCheck,
  Search,
  Download,
  RefreshCw,
  Trash2,
  UserPlus,
  UserMinus,
  BookOpen,
  FileText,
  Key,
  CalendarCheck,
  Clock,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Info,
  X,
  ChevronDown,
  ChevronUp,
  Smartphone,
  Users,
  Activity,
} from 'lucide-react';

interface AdminAuditLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  allUsers: User[];
  courses: Course[];
}

export const AdminAuditLogModal: React.FC<AdminAuditLogModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  allUsers,
  courses,
}) => {
  const [logs, setLogs] = useState<AuditLogEntry[]>(() => ClassroomDB.getAuditLogs());
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | AuditLogCategory>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<'all' | AuditLogSeverity>('all');
  const [selectedActorFilter, setSelectedActorFilter] = useState<string>('all'); // 'all' | 'co_admin_only' | 'admin_only' | specific userId
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>('all');
  const [selectedTimeRange, setSelectedTimeRange] = useState<'all' | 'today' | '24h' | '48h'>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [bannerFeedback, setBannerFeedback] = useState<string | null>(null);

  const staffUsers = useMemo(
    () => allUsers.filter((u) => u.role === 'admin' || u.role === 'co_admin'),
    [allUsers]
  );

  const handleSyncLogs = async () => {
    setIsSyncing(true);
    try {
      ClassroomDB.purgeExpiredAuditLogs(false);
      const synced = await ClassroomDB.syncAuditLogsFromCloud();
      setLogs(synced);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (!isOpen || currentUser.role !== 'admin') return;
    ClassroomDB.purgeExpiredAuditLogs(false);
    setLogs(ClassroomDB.getAuditLogs());
    handleSyncLogs();

    // Background sweep every 15s while modal is open to auto-delete logs older than 2 days (48 hours)
    const timer = setInterval(() => {
      if (ClassroomDB.purgeExpiredAuditLogs(false)) {
        setLogs(ClassroomDB.getAuditLogs());
      }
    }, 15000);

    return () => clearInterval(timer);
  }, [isOpen, currentUser.id, currentUser.role]);

  const formatRelativeTime = (ms: number): string => {
    if (!ms) return '';
    const diffSec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
    if (diffSec < 45) return 'ယခုလေးတင် (Just now)';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} မိနစ်ခန့်က (${diffMin}m ago)`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} နာရီခန့်က (${diffHr}h ago)`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay} ရက်ခန့်က (${diffDay}d ago)`;
  };

  const formatRemainingTTL = (createdAtMs: number): string => {
    if (!createdAtMs) return '2d remaining';
    const remainingMs = Math.max(0, createdAtMs + AUDIT_LOG_TTL_MS - Date.now());
    const totalMins = Math.floor(remainingMs / 60000);
    if (totalMins <= 0) return 'Deleting...';
    if (totalMins < 60) return `${totalMins}m left`;
    const hours = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    if (hours < 24) return `${hours}h ${mins}m left`;
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return `${days}d ${remHours}h left`;
  };

  const filteredLogs = useMemo(() => {
    const now = Date.now();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayMs = startOfToday.getTime();

    return logs.filter((log) => {
      // Category filter
      if (selectedCategory !== 'all' && log.category !== selectedCategory) {
        return false;
      }

      // Severity filter
      if (selectedSeverity !== 'all' && log.severity !== selectedSeverity) {
        return false;
      }

      // Actor filter
      if (selectedActorFilter === 'co_admin_only' && log.actorRole !== 'co_admin') {
        return false;
      }
      if (selectedActorFilter === 'admin_only' && log.actorRole !== 'admin') {
        return false;
      }
      if (
        selectedActorFilter !== 'all' &&
        selectedActorFilter !== 'co_admin_only' &&
        selectedActorFilter !== 'admin_only' &&
        log.actorId !== selectedActorFilter
      ) {
        return false;
      }

      // Course filter
      if (selectedCourseFilter !== 'all' && log.courseId !== selectedCourseFilter) {
        return false;
      }

      // Time range filter (2-day max retention window)
      if (now - log.createdAtMs >= AUDIT_LOG_TTL_MS) {
        return false;
      }
      if (selectedTimeRange === 'today' && log.createdAtMs < todayMs) {
        return false;
      }
      if (selectedTimeRange === '24h' && now - log.createdAtMs > 24 * 3600 * 1000) {
        return false;
      }
      if (selectedTimeRange === '48h' && now - log.createdAtMs > AUDIT_LOG_TTL_MS) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const haystack = [
          log.actorName,
          log.actorUsername,
          log.actionCode,
          log.actionLabel,
          log.summary,
          log.details || '',
          log.targetName || '',
          log.courseCode || '',
          log.courseTitle || '',
          log.deviceId || '',
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [
    logs,
    selectedCategory,
    selectedSeverity,
    selectedActorFilter,
    selectedCourseFilter,
    selectedTimeRange,
    searchQuery,
  ]);

  const stats = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayMs = startOfToday.getTime();

    return {
      total: logs.length,
      coAdminCount: logs.filter((l) => l.actorRole === 'co_admin').length,
      criticalCount: logs.filter((l) => l.severity === 'critical' || l.severity === 'warning').length,
      todayCount: logs.filter((l) => l.createdAtMs >= todayMs).length,
    };
  }, [logs]);

  if (!isOpen) return null;

  // Strict Primary Admin Access Check
  if (currentUser.role !== 'admin') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm">
        <div className="neu-raised max-w-md w-full rounded-3xl p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
            Primary Admin Access Only
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Security Audit Log စစ်ဆေးခွင့်သည် Primary Admin (Main Admin) အကောင့်အတွက်သာ သီးသန့်ခွင့်ပြုထားပါသည်။
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl neu-btn-indigo text-white text-xs font-bold cursor-pointer"
          >
            ပိတ်မည် (Close)
          </button>
        </div>
      </div>
    );
  }

  const getCategoryIcon = (log: AuditLogEntry) => {
    if (log.actionCode.includes('DELETED')) {
      return <Trash2 className="w-4 h-4 text-rose-600 dark:text-rose-400" />;
    }
    switch (log.category) {
      case 'user':
        return log.actionCode.includes('UNENROLLED') ? (
          <UserMinus className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        ) : (
          <UserPlus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
        );
      case 'course':
        return <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
      case 'post':
        return <FileText className="w-4 h-4 text-sky-600 dark:text-sky-400" />;
      case 'academic':
        return <CalendarCheck className="w-4 h-4 text-teal-600 dark:text-teal-400" />;
      case 'security':
      default:
        return <Key className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
    }
  };

  const getSeverityBadge = (severity: AuditLogSeverity) => {
    if (severity === 'critical') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border border-rose-300/60 dark:border-rose-800/60 text-[10px] font-extrabold uppercase">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          Critical / Delete
        </span>
      );
    }
    if (severity === 'warning') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300/60 dark:border-amber-800/60 text-[10px] font-extrabold uppercase">
          <ShieldAlert className="w-3 h-3 shrink-0" />
          Security / Modify
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-800/60 text-[10px] font-extrabold uppercase">
        <Info className="w-3 h-3 shrink-0" />
        Standard Action
      </span>
    );
  };

  const handleExportCSV = () => {
    const res = ClassroomDB.downloadAuditLogsCSV(filteredLogs);
    if (res.success) {
      setBannerFeedback(`✅ Audit Log မှတ်တမ်း (${res.rowCount} ခု) ကို CSV ဖိုင်အဖြစ် ဒေါင်းလုဒ်ဆွဲပြီးပါပြီ။`);
      setTimeout(() => setBannerFeedback(null), 4000);
    }
  };

  const handleConfirmClearLogs = async () => {
    const res = await ClassroomDB.clearAuditLogs(currentUser);
    if (res.success) {
      setLogs(ClassroomDB.getAuditLogs());
      setShowClearConfirm(false);
      setBannerFeedback('✅ Security Audit Log မှတ်တမ်းဟောင်းများကို ရှင်းလင်းပြီးပါပြီ။');
      setTimeout(() => setBannerFeedback(null), 4000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-6xl max-h-[92vh] bg-slate-50 dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col overflow-hidden">
        {/* Top Header */}
        <div className="px-4 sm:px-6 py-4 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-600 text-white shadow-sm shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                  🛡️ Admin & Co-Admin Security Audit Log
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 text-[10px] font-extrabold uppercase tracking-wider">
                  Primary Admin Oversight
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 text-[10px] font-extrabold tracking-wide">
                  ⏱️ 2-Day Auto-Delete Active
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Admin နှင့် Co-Admin တို့၏ လုပ်ဆောင်ချက်မှတ်တမ်းများကို စစ်ဆေးနိုင်ပြီး ၂ ရက် (၄၈ နာရီ) ကြာပြီးသော မှတ်တမ်းဟောင်းများကို Background မှ အလိုအလျောက် ဖျက်သိမ်းပေးပါသည်
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <button
              type="button"
              onClick={handleSyncLogs}
              disabled={isSyncing}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
              title="Supabase Cloud မှ နောက်ဆုံး Audit Log မှတ်တမ်းများကို ဆွဲယူမည်"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Cloud'}</span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
              title="လက်ရှိ စစ်ထုတ်ထားသော Audit Log မှတ်တမ်းများကို Excel CSV ဖိုင်အဖြစ် ဒေါင်းလုဒ်ဆွဲမည်"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV ({filteredLogs.length})</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-100 hover:bg-rose-100 dark:bg-slate-800 dark:hover:bg-rose-950/60 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feedback Banner */}
        {bannerFeedback && (
          <div className="mx-4 sm:mx-6 mt-3 px-4 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/70 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{bannerFeedback}</span>
            </div>
            <button
              type="button"
              onClick={() => setBannerFeedback(null)}
              className="text-[11px] underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* 4 KPI Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 flex items-center gap-3 shadow-2xs">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  စုစုပေါင်း မှတ်တမ်း (Total Logs)
                </div>
                <div className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white font-mono">
                  {stats.total}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                setSelectedActorFilter((prev) => (prev === 'co_admin_only' ? 'all' : 'co_admin_only'))
              }
              className={`p-3.5 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer shadow-2xs ${
                selectedActorFilter === 'co_admin_only'
                  ? 'bg-amber-50/90 dark:bg-amber-950/50 border-amber-400 ring-2 ring-amber-400/30'
                  : 'bg-white dark:bg-slate-800/90 border-slate-200/80 dark:border-slate-700/70 hover:border-amber-300'
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-amber-100/80 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Co-Admin လုပ်ဆောင်ချက်များ
                </div>
                <div className="text-lg sm:text-xl font-extrabold text-amber-700 dark:text-amber-400 font-mono">
                  {stats.coAdminCount}
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() =>
                setSelectedSeverity((prev) => (prev === 'critical' ? 'all' : 'critical'))
              }
              className={`p-3.5 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer shadow-2xs ${
                selectedSeverity === 'critical'
                  ? 'bg-rose-50/90 dark:bg-rose-950/50 border-rose-400 ring-2 ring-rose-400/30'
                  : 'bg-white dark:bg-slate-800/90 border-slate-200/80 dark:border-slate-700/70 hover:border-rose-300'
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-rose-100/80 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  ဖျက်သိမ်းမှု / အရေးကြီး (Alerts)
                </div>
                <div className="text-lg sm:text-xl font-extrabold text-rose-600 dark:text-rose-400 font-mono">
                  {stats.criticalCount}
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSelectedTimeRange((prev) => (prev === 'today' ? 'all' : 'today'))}
              className={`p-3.5 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer shadow-2xs ${
                selectedTimeRange === 'today'
                  ? 'bg-emerald-50/90 dark:bg-emerald-950/50 border-emerald-400 ring-2 ring-emerald-400/30'
                  : 'bg-white dark:bg-slate-800/90 border-slate-200/80 dark:border-slate-700/70 hover:border-emerald-300'
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-100/80 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  ယနေ့ လုပ်ဆောင်ချက် (Today)
                </div>
                <div className="text-lg sm:text-xl font-extrabold text-emerald-700 dark:text-emerald-400 font-mono">
                  {stats.todayCount}
                </div>
              </div>
            </button>
          </div>

          {/* Search & Multi-Filter Console */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 space-y-3.5 shadow-2xs">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
              {/* Search Box */}
              <div className="md:col-span-5 relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Co-Admin အမည်, ကျောင်းသားအမည်, အတန်း, Post အမည်ဖြင့် ရှာရန်..."
                  className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-indigo-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Staff / Role Filter */}
              <div className="md:col-span-3">
                <select
                  value={selectedActorFilter}
                  onChange={(e) => setSelectedActorFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
                >
                  <option value="all">👤 Admin & Co-Admin အားလုံး</option>
                  <option value="co_admin_only">🛡️ Co-Admin များသာ သီးသန့်ကြည့်ရန်</option>
                  <option value="admin_only">👑 Primary Admin များသာ</option>
                  {staffUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.role === 'admin' ? '👑' : '🛡️'} {u.name} (@{u.username})
                    </option>
                  ))}
                </select>
              </div>

              {/* Course Filter */}
              <div className="md:col-span-2">
                <select
                  value={selectedCourseFilter}
                  onChange={(e) => setSelectedCourseFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
                >
                  <option value="all">🏫 အတန်း အားလုံး</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Time Filter */}
              <div className="md:col-span-2">
                <select
                  value={selectedTimeRange}
                  onChange={(e) =>
                    setSelectedTimeRange(e.target.value as 'all' | 'today' | '24h' | '48h')
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
                >
                  <option value="all">🕒 ၂ ရက်အတွင်း အားလုံး</option>
                  <option value="today">📅 ယနေ့ (Today)</option>
                  <option value="24h">⏱️ ၂၄ နာရီအတွင်း (24h)</option>
                  <option value="48h">📅 ၄၈ နာရီ / ၂ ရက်အတွင်း</option>
                </select>
              </div>
            </div>

            {/* Category & Severity Pills */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-700/60">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 mr-1">
                  <Filter className="w-3 h-3" /> အမျိုးအစား:
                </span>
                {[
                  { id: 'all', label: 'အားလုံး (All)' },
                  { id: 'user', label: '👥 ကျောင်းသား/အကောင့်' },
                  { id: 'course', label: '🏫 အတန်းပြင်ဆင်မှု' },
                  { id: 'post', label: '📝 Post တင်/ဖျက်' },
                  { id: 'academic', label: '📅 Attendance & အမှတ်ပေး' },
                  { id: 'security', label: '🔑 Password & လုံခြုံရေး' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id as 'all' | AuditLogCategory)}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                      selectedCategory === cat.id
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5">
                {(['all', 'info', 'warning', 'critical'] as const).map((sev) => (
                  <button
                    key={sev}
                    type="button"
                    onClick={() => setSelectedSeverity(sev)}
                    className={`px-2.5 py-1 rounded-xl text-[10px] font-extrabold uppercase cursor-pointer transition-all ${
                      selectedSeverity === sev
                        ? sev === 'critical'
                          ? 'bg-rose-600 text-white'
                          : sev === 'warning'
                          ? 'bg-amber-600 text-white'
                          : 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900'
                        : 'bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {sev === 'all'
                      ? 'All Severity'
                      : sev === 'critical'
                      ? '🔴 Delete/Critical'
                      : sev === 'warning'
                      ? '🟡 Modify/Security'
                      : '🟢 Create/Normal'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Audit Log Entries List */}
          {filteredLogs.length === 0 ? (
            <div className="p-10 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/60 text-center space-y-2">
              <ShieldCheck className="w-8 h-8 text-slate-400 mx-auto" />
              <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                ရွေးချယ်ထားသော စစ်ထုတ်မှုနှင့် ကိုက်ညီသည့် Audit Log မှတ်တမ်း မရှိသေးပါ
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Admin သို့မဟုတ် Co-Admin က ကျောင်းသားအသစ်ထည့်ခြင်း၊ အတန်းပြင်ခြင်း၊ Post တင်ခြင်း/ဖျက်ခြင်း ပြုလုပ်သည့်အခါ ဤနေရာတွင် အလိုအလျောက် မှတ်တမ်းပေါ်လာပါမည်။
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredLogs.map((log) => {
                const isExpanded = expandedLogId === log.id;
                const isCoAdmin = log.actorRole === 'co_admin';
                return (
                  <div
                    key={log.id}
                    className={`rounded-2xl bg-white dark:bg-slate-800/95 border transition-all p-3.5 sm:p-4 ${
                      log.severity === 'critical'
                        ? 'border-rose-300/80 dark:border-rose-900/70'
                        : log.severity === 'warning'
                        ? 'border-amber-300/80 dark:border-amber-900/70'
                        : 'border-slate-200/80 dark:border-slate-700/70'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      {/* Left: Actor & Action Summary */}
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        {/* Icon / Avatar */}
                        <div className="relative shrink-0 mt-0.5">
                          {log.actorAvatar ? (
                            <img
                              src={log.actorAvatar}
                              alt={log.actorName}
                              referrerPolicy="no-referrer"
                              className="w-10 h-10 rounded-xl object-cover border border-slate-200 dark:border-slate-700"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-extrabold text-xs flex items-center justify-center">
                              {log.actorName.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div className="absolute -bottom-1 -right-1 p-1 rounded-lg bg-white dark:bg-slate-900 shadow-xs border border-slate-200 dark:border-slate-700">
                            {getCategoryIcon(log)}
                          </div>
                        </div>

                        <div className="min-w-0 flex-1 space-y-1">
                          {/* Actor Name + Role Badge + Action Label */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
                              {log.actorName}
                            </span>
                            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                              (@{log.actorUsername})
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                                isCoAdmin
                                  ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300/60 dark:border-amber-800/60'
                                  : 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-300/60 dark:border-indigo-800/60'
                              }`}
                            >
                              {isCoAdmin ? '🛡️ Co-Admin' : '👑 Primary Admin'}
                            </span>
                            <span className="text-slate-300 dark:text-slate-600">•</span>
                            <span className="text-xs font-extrabold text-indigo-700 dark:text-indigo-300">
                              {log.actionLabel}
                            </span>
                          </div>

                          {/* Main Human-Readable Burmese Summary */}
                          <p className="text-xs sm:text-[13px] text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
                            {log.summary}
                          </p>

                          {/* Target & Course Pills */}
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            {log.courseCode && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-[10px] font-mono font-bold">
                                <BookOpen className="w-3 h-3 text-indigo-500" />
                                {log.courseCode}
                                {log.courseTitle ? ` · ${log.courseTitle}` : ''}
                              </span>
                            )}
                            {log.targetName && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-[10px] font-semibold">
                                Target: <strong className="font-bold">{log.targetName}</strong>
                              </span>
                            )}
                            {log.deviceId && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-[10px] font-mono">
                                <Smartphone className="w-3 h-3" />
                                {log.deviceId.slice(0, 16)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Timestamp, Severity Badge & Expand Trigger */}
                      <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                          {getSeverityBadge(log.severity)}
                          <button
                            type="button"
                            onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                            className="p-1 rounded-lg bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer"
                            title="အသေးစိတ် ကြည့်ရှုရန် (View Details)"
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>

                        <div className="text-right">
                          <div className="text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300">
                            {log.createdAt}
                          </div>
                          <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">
                            {formatRelativeTime(log.createdAtMs)} · ⏱️ {formatRemainingTTL(log.createdAtMs)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Expandable Technical Details */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-slate-200/70 dark:border-slate-700/70 bg-slate-50/80 dark:bg-slate-900/60 rounded-xl p-3 text-[11px] font-mono text-slate-600 dark:text-slate-300 space-y-1">
                        <div>
                          <span className="text-slate-400">Audit ID:</span> {log.id}
                        </div>
                        <div>
                          <span className="text-slate-400">Action Code:</span> {log.actionCode} (
                          {log.category.toUpperCase()})
                        </div>
                        <div>
                          <span className="text-slate-400">Actor:</span> {log.actorName} (@
                          {log.actorUsername} · ID: {log.actorId} · Role: {log.actorRole})
                        </div>
                        <div>
                          <span className="text-slate-400">Auto-Delete Policy:</span> 2 Days (48 Hours) —{' '}
                          {formatRemainingTTL(log.createdAtMs)}
                        </div>
                        {log.details && (
                          <div>
                            <span className="text-slate-400">Technical Details:</span> {log.details}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3.5 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              ၂ ရက် (၄၈ နာရီ) ကြာပြီးသော Audit Log မှတ်တမ်းများကို LocalStorage နှင့် Supabase Cloud နှစ်ခုလုံးမှ Background တွင် အလိုအလျောက် ဖျက်သိမ်းပေးပါသည်။
            </span>
          </div>

          <div className="flex items-center justify-end gap-2">
            {!showClearConfirm ? (
              <button
                type="button"
                onClick={() => setShowClearConfirm(true)}
                className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Old Logs</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 bg-rose-50 dark:bg-rose-950/60 px-3 py-1 rounded-xl border border-rose-300 dark:border-rose-800">
                <span className="text-[11px] font-bold text-rose-700 dark:text-rose-300">
                  မှတ်တမ်းအားလုံး ရှင်းမည်လား?
                </span>
                <button
                  type="button"
                  onClick={handleConfirmClearLogs}
                  className="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-bold cursor-pointer"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(false)}
                  className="px-2 py-1 text-[11px] text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-bold cursor-pointer"
            >
              ပိတ်မည် (Close)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
