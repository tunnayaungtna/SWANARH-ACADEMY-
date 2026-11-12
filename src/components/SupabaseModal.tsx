import React, { useState, useRef } from 'react';
import {
  SupabaseService,
  SUPABASE_CONFIG,
  DEFAULT_SUPABASE_CONFIG,
  SUPABASE_SQL_SCHEMA,
} from '../services/supabase';
import { ClassroomDB } from '../services/storage';
import {
  X,
  Database,
  Check,
  Copy,
  ExternalLink,
  Users,
  Server,
  Key,
  RefreshCw,
  AlertCircle,
  FileCode,
  Sparkles,
  Download,
  Upload,
  ArrowRightLeft,
} from 'lucide-react';

interface SupabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupabaseModal: React.FC<SupabaseModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [isSlimming, setIsSlimming] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [newProjectUrl, setNewProjectUrl] = useState(SUPABASE_CONFIG.url);
  const [newPublishableKey, setNewPublishableKey] = useState(SUPABASE_CONFIG.publishableKey);
  const [connectionStatus, setConnectionStatus] = useState<{
    tested: boolean;
    connected: boolean;
    message: string;
  } | null>(null);
  const [cacheTick, setCacheTick] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const cacheStats = SupabaseService.getClientCacheStats();
  const activeProjectRef = SupabaseService.getActiveProjectRef();
  const hasCustomProject = SupabaseService.hasCustomProjectConfig();

  const handleCopySQL = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleCopyConfigCode = () => {
    const cleanUrl = (newProjectUrl || SUPABASE_CONFIG.url).trim().replace(/\/+$/, '');
    const cleanKey = (newPublishableKey || SUPABASE_CONFIG.publishableKey).trim();
    const codeSnippet = `export const DEFAULT_SUPABASE_CONFIG = {\n  url: import.meta.env.VITE_SUPABASE_URL || '${cleanUrl}',\n  publishableKey:\n    import.meta.env.VITE_SUPABASE_ANON_KEY || '${cleanKey}',\n  jwksUrl:\n    import.meta.env.VITE_SUPABASE_JWKS_URL ||\n    '${cleanUrl}/auth/v1/.well-known/jwks.json',\n};`;
    navigator.clipboard.writeText(codeSnippet);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 3000);
  };

  const handleDownloadBackup = () => {
    const backup = ClassroomDB.exportFullDatabaseBackup();
    const blob = new Blob([backup.json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = backup.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setConnectionStatus({
      tested: true,
      connected: true,
      message: `📥 Backup ဒေါင်းလုဒ်ဆွဲပြီးပါပြီ (${backup.filename})! အကောင့် (${backup.counts.users}) ခု၊ သင်တန်း (${backup.counts.courses}) ခု၊ Post (${backup.counts.posts}) ခုနှင့် Attendance (${backup.counts.attendance}) ခု ပါဝင်ပါသည်။`,
    });
  };

  const handleRestoreBackupFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setIsMigrating(true);
      const res = await ClassroomDB.importFullDatabaseBackup(text);
      setIsMigrating(false);
      setConnectionStatus({
        tested: true,
        connected: res.success,
        message: res.message,
      });
    } catch {
      setIsMigrating(false);
      setConnectionStatus({
        tested: true,
        connected: false,
        message: 'Backup ဖိုင်ဖတ်ရာတွင် အမှားအယွင်းရှိနေပါသည်။',
      });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSwitchAndMigrateProject = async () => {
    setIsMigrating(true);
    const res = await ClassroomDB.migrateToNewSupabaseProject(newProjectUrl, newPublishableKey);
    setIsMigrating(false);
    setCacheTick((t) => t + 1);
    setConnectionStatus({
      tested: true,
      connected: res.success,
      message: res.message,
    });
  };

  const handleResetDefaultProject = () => {
    SupabaseService.resetToDefaultProjectConfig();
    setNewProjectUrl(DEFAULT_SUPABASE_CONFIG.url);
    setNewPublishableKey(DEFAULT_SUPABASE_CONFIG.publishableKey);
    setCacheTick((t) => t + 1);
    setConnectionStatus({
      tested: true,
      connected: true,
      message: `🔄 မူလ Default Supabase Project (${DEFAULT_SUPABASE_CONFIG.url}) သို့ ပြန်လည်ချိတ်ဆက်ပြီးပါပြီ။`,
    });
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    const result = await SupabaseService.checkConnection();
    setConnectionStatus({
      tested: true,
      connected: result.connected,
      message: result.message,
    });
    setIsTesting(false);
  };

  const handleSlimEgressNow = async () => {
    setIsSlimming(true);
    const res = await ClassroomDB.slimCloudDatabaseForLowEgress();
    setIsSlimming(false);
    setConnectionStatus({
      tested: true,
      connected: res.success,
      message: `📉 Database Slimming ပြီးမြောက်ပါပြီ! Supabase Cloud ရှိ ပိုလျှံနေသော Base64 ပုံ/Data အတန်း (${res.slimmedRows}) ခုနှင့် မလိုအပ်တော့သော Orphaned Data (${res.cleanedOrphans}) ခုကို ချက်ချင်း ချုံ့ပြီး ရှင်းလင်းပေးလိုက်ပါပြီ။`,
    });
  };

  const handleSyncAllNow = async () => {
    setIsSyncing(true);
    const res = await ClassroomDB.syncWithSupabase();
    setIsSyncing(false);
    if (res.error) {
      setConnectionStatus({
        tested: true,
        connected: false,
        message: `Sync Error: ${res.error} — အောက်ပါ SQL Script ကို Copy ကူးပြီး Supabase SQL Editor တွင် အရင် RUN ပေးပါ။`,
      });
    } else {
      const cleanedInfo =
        res.cleanedOrphans && res.cleanedOrphans > 0
          ? ` (မလိုအပ်တော့သော Orphaned Data ${res.cleanedOrphans} ခုကိုလည်း Auto-Clean ရှင်းလင်းပြီးပါပြီ)`
          : '';
      setConnectionStatus({
        tested: true,
        connected: true,
        message: `အောင်မြင်စွာ Sync လုပ်ပြီးပါပြီ! အကောင့် (${res.syncedUsers}) ခုနှင့် သင်တန်း (${res.syncedCourses}) ခုလုံး Supabase Table Editor သို့ ရောက်ရှိသွားပါပြီ။${cleanedInfo}`,
      });
    }
  };

  const handleCleanOrphansNow = async () => {
    setIsCleaning(true);
    const res = await ClassroomDB.cleanOrphanedLocalAndCloudData(true);
    setIsCleaning(false);
    setConnectionStatus({
      tested: true,
      connected: true,
      message: `🧹 Auto-Clean ပြီးမြောက်ပါပြီ! Classroom ထဲတွင် မရှိတော့ဘဲ ကျန်နေသော Data (Local: ${res.localCleaned} ခု, Supabase Cloud: ${res.cloudCleaned} ခု) နှင့် မိနစ် ၃၀ ကျော်သော Notification များကို အောင်မြင်စွာ ရှင်းလင်းဖျက်သိမ်းပြီးပါပြီ။`,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-3xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-emerald-600 text-white shadow-xs">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Supabase Integration &amp; Database Setup
                </h3>
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800">
                  Live Connected
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Setup guide, credentials, and SQL schema script for your Supabase project.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-xs sm:text-sm">
          {/* Supabase Project Credentials Summary */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Server className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Supabase Project Configuration</span>
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleSlimEgressNow}
                  disabled={isSlimming || isCleaning || isSyncing}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 text-white transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
                  title="Supabase Database ထဲရှိ Base64 ပုံဟောင်းများနှင့် Egress စားနေသော Data များကို ချက်ချင်း ချုံ့ပေးမည်"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSlimming ? 'animate-spin' : ''}`} />
                  <span>{isSlimming ? 'Slimming...' : '📉 Optimize Egress & Storage'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleCleanOrphansNow}
                  disabled={isCleaning || isSyncing || isSlimming}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Classroom ထဲတွင် မရှိတော့ဘဲ Supabase ထဲ၌ ကျန်နေသော မလိုအပ်သည့် Data များကို ချက်ချင်း ရှင်းလင်းမည်"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isCleaning ? 'animate-spin' : ''}`} />
                  <span>{isCleaning ? 'Cleaning...' : '🧹 Auto-Clean Orphaned Data'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleSyncAllNow}
                  disabled={isSyncing}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Syncing...' : 'Sync All Data to Supabase'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTesting}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                  <span>{isTesting ? 'Testing...' : 'Test Connection'}</span>
                </button>
              </div>
            </div>

            {connectionStatus && (
              <div
                className={`p-2.5 rounded-lg border text-xs flex items-center gap-2 ${
                  connectionStatus.connected
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                    : 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300'
                }`}
              >
                {connectionStatus.connected ? (
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                )}
                <span>{connectionStatus.message}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/70">
                <span className="text-[10px] text-slate-400 font-mono uppercase block">Project URL</span>
                <span className="font-mono text-slate-800 dark:text-slate-200 truncate block mt-0.5">
                  {SUPABASE_CONFIG.url}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/70">
                <span className="text-[10px] text-slate-400 font-mono uppercase block">Publishable API Key</span>
                <span className="font-mono text-slate-800 dark:text-slate-200 truncate block mt-0.5">
                  {SUPABASE_CONFIG.publishableKey.slice(0, 20)}...
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/70 md:col-span-2">
                <span className="text-[10px] text-slate-400 font-mono uppercase block">JWKS URL (Auth Verification)</span>
                <span className="font-mono text-slate-800 dark:text-slate-200 truncate block mt-0.5">
                  {SUPABASE_CONFIG.jwksUrl}
                </span>
              </div>
            </div>

            {/* Zero-Downtime Project Switcher & Data Migration Wizard (Steps 3, 4 & 5) */}
            <div className="p-4 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/70 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                  <ArrowRightLeft className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>
                    Project အသစ်သို့ Data အားလုံး ရွှေ့ပြောင်းခြင်း (Zero-Downtime Migration &amp; Backup)
                  </span>
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={handleDownloadBackup}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 flex items-center gap-1 cursor-pointer transition-colors"
                    title="လက်ရှိ Data အားလုံးကို JSON ဖိုင်ဖြင့် သိမ်းဆည်းရန်"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>1. Download Backup (.json)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isMigrating}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-50"
                    title="Backup JSON ဖိုင်မှ Data ပြန်သွင်းရန်"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Restore (.json)</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={handleRestoreBackupFile}
                    className="hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    အဆင့် ၃ (က) - New Supabase Project URL
                  </label>
                  <input
                    type="url"
                    value={newProjectUrl}
                    onChange={(e) => setNewProjectUrl(e.target.value)}
                    placeholder="https://xxxxxxxxxxxx.supabase.co"
                    className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                    <Key className="w-3 h-3 text-indigo-500" />
                    <span>အဆင့် ၃ (ခ) - New Publishable / Anon Key</span>
                  </label>
                  <input
                    type="text"
                    value={newPublishableKey}
                    onChange={(e) => setNewPublishableKey(e.target.value)}
                    placeholder="sb_publishable_... သို့မဟုတ် eyJhbGci..."
                    className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleSwitchAndMigrateProject}
                    disabled={isMigrating || isSyncing}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isMigrating ? 'animate-spin' : ''}`} />
                    <span>
                      {isMigrating
                        ? 'Migrating All Data...'
                        : '🚀 2. Project အသစ်သို့ ချိတ်ဆက်ပြီး Data အားလုံး ရွှေ့ပြောင်းမည်'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyConfigCode}
                    className="px-2.5 py-1.5 text-[11px] font-semibold rounded-lg bg-slate-800 hover:bg-slate-900 text-slate-100 flex items-center gap-1.5 cursor-pointer transition-colors"
                    title="src/services/supabase.ts တွင် ထည့်ရမည့် SUPABASE_CONFIG Code ကို Copy ကူးရန်"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode ? 'Copied Code!' : 'Copy Code (supabase.ts)'}</span>
                  </button>
                </div>

                {hasCustomProject && (
                  <button
                    type="button"
                    onClick={handleResetDefaultProject}
                    className="text-[11px] font-semibold text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 underline cursor-pointer"
                  >
                    မူလ Project အဟောင်းသို့ ပြန်ပြောင်းရန်
                  </button>
                )}
              </div>
            </div>

            {/* Client-Side Caching Banner */}
            <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Client-Side Caching &amp; High-Speed Sync</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-600 text-white">
                    ⚡ Client Cache Hits: {cacheStats.cacheHits} ({cacheStats.savedMBFormatted} Saved)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      SupabaseService.clearClientCache();
                      setCacheTick((t) => t + 1);
                      setConnectionStatus({
                        tested: true,
                        connected: true,
                        message:
                          '🔄 Client-Side Cache ကို ရှင်းလင်းပြီး အသစ်ပြန်လည် စတင်လိုက်ပါပြီ (Cache Refreshed)!',
                      });
                    }}
                    className="text-[10px] font-bold px-2 py-0.5 rounded bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 cursor-pointer transition-colors"
                    title="Client-Side Cache အသစ်ပြန်လည်ရယူရန်"
                  >
                    Reset Cache
                  </button>
                </div>
              </div>

              <div
                key={cacheTick}
                className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]"
              >
                <div className="p-2 rounded-lg bg-white/90 dark:bg-slate-900/80 border border-emerald-200/70 dark:border-emerald-800/60">
                  <span className="text-[10px] text-slate-400 block">Cache Hits</span>
                  <span className="font-extrabold text-emerald-700 dark:text-emerald-400 font-mono">
                    {cacheStats.cacheHits} hits
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-white/90 dark:bg-slate-900/80 border border-emerald-200/70 dark:border-emerald-800/60">
                  <span className="text-[10px] text-slate-400 block">Egress Saved</span>
                  <span className="font-extrabold text-emerald-700 dark:text-emerald-400 font-mono">
                    {cacheStats.savedMBFormatted}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-white/90 dark:bg-slate-900/80 border border-emerald-200/70 dark:border-emerald-800/60">
                  <span className="text-[10px] text-slate-400 block">Cached Banners</span>
                  <span className="font-extrabold text-indigo-700 dark:text-indigo-400 font-mono">
                    {cacheStats.cachedBannersCount} courses
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-white/90 dark:bg-slate-900/80 border border-emerald-200/70 dark:border-emerald-800/60">
                  <span className="text-[10px] text-slate-400 block">Cached Queries</span>
                  <span className="font-extrabold text-purple-700 dark:text-purple-400 font-mono">
                    {cacheStats.activeQueryCacheCount} tables
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                • <b>Persistent Client-Side Asset &amp; Query Cache</b>: Course Banner ပုံများ၊ Lead Mentor (Admin) Profile ပုံ၊ Posts၊ Quizzes နှင့် Assignments များကို Browser ၏ LocalStorage Cache တွင် သိမ်းဆည်းထားပါသည်။<br />
                • <b>Write-Through Cache Invalidation &amp; Delta Sync</b>: ဆရာ သို့မဟုတ် ကျောင်းသားတစ်ဦးမှ Post အသစ်တင်ခြင်း၊ Comment ပေးခြင်း၊ Attendance ဖွင့်/ပိတ်ခြင်း ပြုလုပ်သည့်အခါ ပြောင်းလဲသွားသော Data အသစ်ကို ချက်ချင်း ဆွဲယူပေးပါသည်။
              </p>
            </div>
          </div>

          {/* User Accounts & Roles Overview */}
          <div className="space-y-2.5">
            <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Configured User Roles (Lead Mentor (Admin), Co-Admin &amp; Students)</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60">
                <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 block">
                  🛡️ Lead Mentor (Admin)
                </span>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                  Full governance: Create/delete courses, publish stream posts, pin up to 3 posts, schedule posts, manage student directory, attendance, and grade assignments.
                </p>
                <div className="mt-2 text-[10px] font-mono text-indigo-700 dark:text-indigo-300 bg-white dark:bg-slate-900 p-1.5 rounded border border-indigo-200 dark:border-indigo-800">
                  Role Policy: Full Read / Write / Delete
                </div>
              </div>

              <div className="p-3 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60">
                <span className="text-xs font-bold text-purple-700 dark:text-purple-300 block">
                  👥 Co-Administrator
                </span>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                  Assistant instructor: Create/delete courses, post lessons, announcements, schedule posts, pin posts, manage attendance, and grade student submissions.
                </p>
                <div className="mt-2 text-[10px] font-mono text-purple-700 dark:text-purple-300 bg-white dark:bg-slate-900 p-1.5 rounded border border-purple-200 dark:border-purple-800">
                  Role Policy: Instructor Read / Write / Delete
                </div>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60">
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 block">
                  🎓 Students
                </span>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                  Learners: View enrolled courses, mark attendance, submit homework, take quizzes, comment & like on stream posts (Post တင်ခွင့်နှင့် ပုံပြောင်းခွင့် ကန့်သတ်ထားပါသည်)။
                </p>
                <div className="mt-2 text-[10px] font-mono text-emerald-700 dark:text-emerald-300 bg-white dark:bg-slate-900 p-1.5 rounded border border-emerald-200 dark:border-emerald-800">
                  Role Policy: Enrolled Cohort RLS Only
                </div>
              </div>
            </div>
          </div>

          {/* What you need to do on Supabase (Step-by-step instructions) */}
          <div className="p-4 sm:p-5 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-r from-indigo-50/70 via-purple-50/40 to-slate-50/50 dark:from-indigo-950/40 dark:via-purple-950/30 dark:to-slate-900 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 text-sm sm:text-base">
                <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Supabase Dashboard တွင် လုပ်ဆောင်ရန် အသေးစိတ် အဆင့် ၄ ဆင့်</span>
              </h4>
              <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold px-2 py-0.5 rounded-full">
                Step-by-Step Guide
              </span>
            </div>

            <div className="space-y-3 text-xs">
              {/* Step 1 */}
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] flex items-center justify-center font-bold">1</span>
                    <span>SQL Schema & Tables Run ခြင်း (အဓိက Database တည်ဆောက်ခြင်း)</span>
                  </div>
                  <a
                    href={`https://supabase.com/dashboard/project/${activeProjectRef}/sql/new`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                  >
                    <span>Open SQL Editor</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed pl-7">
                  1. အထက်ပါ <strong>Open SQL Editor</strong> ခလုတ်ကို နှိပ်ပါ (သို့မဟုတ် ဘယ်ဘက် Sidebar ရှိ <strong>SQL Editor</strong> &gt; <strong>+ New Query</strong>)။<br />
                  2. အောက်တွင်ရှိသော <strong>"Copy SQL Script"</strong> ခလုတ်ကို နှိပ်၍ SQL Script အားလုံးကို Copy ကူးပါ။<br />
                  3. Supabase SQL Editor ထဲသို့ Paste လုပ်ပြီး ညာဘက်အောက် သို့မဟုတ် အပေါ်ရှိ <strong>RUN</strong> ခလုတ် (သို့မဟုတ် Ctrl + Enter) ကို နှိပ်ပါ။<br />
                  4. <span className="text-emerald-600 dark:text-emerald-400 font-semibold font-mono">"Success. No rows returned"</span> ဟု ပေါ်လာပါက Table များနှင့် Initial Roles များ အဆင်သင့် ဖြစ်သွားပါပြီ။
                </p>
              </div>

              {/* Step 2 */}
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
                    <span className="w-5 h-5 rounded-full bg-purple-600 text-white text-[11px] flex items-center justify-center font-bold">2</span>
                    <span>Authentication Setting (အီးမေးလ် အတည်ပြုချက် မလိုဘဲ တန်းဝင်နိုင်အောင် ချိန်ညှိခြင်း)</span>
                  </div>
                  <a
                    href={`https://supabase.com/dashboard/project/${activeProjectRef}/auth/providers`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-950/80 hover:bg-purple-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer border border-purple-300 dark:border-purple-800"
                  >
                    <span>Open Auth Providers</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed pl-7">
                  1. ဘယ်ဘက် Menu ရှိ <strong>Authentication</strong> &gt; <strong>Providers</strong> &gt; <strong>Email</strong> သို့ သွားပါ။<br />
                  2. <strong>Enable Email provider</strong> ကို <strong>ON</strong> (ဖွင့်ထား) ကြောင်း စစ်ဆေးပါ။<br />
                  3. အောက်သို့ scroll လုပ်ပြီး <strong>"Confirm email"</strong> option ကို <strong>OFF (ပိတ်ထားပါ)</strong>။<br />
                  <span className="text-amber-700 dark:text-amber-400 font-medium">
                    (ဤသို့ Confirm email ပိတ်ထားမှသာ Admin မှ အသစ်ဖွင့်ပေးလိုက်သော Student, Co-admin အကောင့်များသည် Email verification စောင့်စရာမလိုဘဲ တိုက်ရိုက် Login ဝင်ရောက်နိုင်မည် ဖြစ်ပါသည်)။
                  </span><br />
                  4. အောက်ခြေရှိ <strong>Save</strong> ကို နှိပ်ပါ။
                </p>
              </div>

              {/* Step 3 */}
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] flex items-center justify-center font-bold">3</span>
                    <span>Table Editor တွင် Data စစ်ဆေးခြင်း (Verification)</span>
                  </div>
                  <a
                    href={`https://supabase.com/dashboard/project/${activeProjectRef}/editor`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 hover:bg-emerald-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer border border-emerald-300 dark:border-emerald-800"
                  >
                    <span>Open Table Editor</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed pl-7">
                  1. ဘယ်ဘက်ခြမ်းရှိ <strong>Table Editor</strong> (ဇယား icon) ကို ဖွင့်ပါ။<br />
                  2. <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-indigo-600 font-mono">profiles</code>, <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-indigo-600 font-mono">courses</code>, <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-indigo-600 font-mono">posts</code>, <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-indigo-600 font-mono">assignments</code> Table များ ရှိနေသည်ကို တွေ့ရပါမည်။<br />
                  3. <code className="font-mono">profiles</code> ထဲတွင် Admin (Dr. Kyaw Swar), Co-Admin (Daw Khin Myo), Student (Aung Min) အစရှိသော Demo အကောင့် ၅ ခု အသင့်ရောက်ရှိနေပါမည်။
                </p>
              </div>

              {/* Step 4 */}
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] flex items-center justify-center font-bold">4</span>
                    <span>Custom Domain (www.swanarhclassroom.online) ချိတ်ဆက်ခြင်း</span>
                  </div>
                  <a
                    href={`https://supabase.com/dashboard/project/${activeProjectRef}/auth/url-configuration`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-950/80 hover:bg-blue-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer border border-blue-300 dark:border-blue-800"
                  >
                    <span>Open URL Config</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed pl-7">
                  1. <strong>Authentication</strong> &gt; <strong>URL Configuration</strong> သို့ သွားပါ။<br />
                  2. <strong>Site URL</strong> တွင် <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-emerald-600 font-mono">https://www.swanarhclassroom.online</code> ကို ထည့်ပြီး Save နှိပ်ပါ။<br />
                  3. <strong>Redirect URLs</strong> တွင် <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-indigo-600 font-mono">https://www.swanarhclassroom.online/**</code> နှင့် <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-indigo-600 font-mono">http://www.swanarhclassroom.online/**</code> တို့ကို ထည့်သွင်းထားပါ။
                </p>
              </div>
            </div>
          </div>

          {/* Copyable SQL Schema */}
          <div className="space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 text-xs">
                <FileCode className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Supabase PostgreSQL Schema, RLS & Data API Grants (Oct 30+ Compliant)</span>
              </span>
              <button
                type="button"
                onClick={handleCopySQL}
                className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-98"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied to Clipboard!' : 'Copy SQL Script'}</span>
              </button>
            </div>

            <div className="relative">
              <pre className="p-3.5 rounded-xl bg-slate-950 text-emerald-400 font-mono text-[11px] leading-relaxed overflow-x-auto max-h-56 border border-slate-800">
                {SUPABASE_SQL_SCHEMA}
              </pre>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 sm:p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Classroom OS is configured to sync seamlessly with your Supabase project.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs"
          >
            Done (ပြီးပါပြီ)
          </button>
        </div>
      </div>
    </div>
  );
};
