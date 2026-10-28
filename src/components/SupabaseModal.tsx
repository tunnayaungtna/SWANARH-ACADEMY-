import React, { useState } from 'react';
import { SupabaseService, SUPABASE_CONFIG, SUPABASE_SQL_SCHEMA } from '../services/supabase';
import { ClassroomDB } from '../services/storage';
import {
  X,
  Database,
  Check,
  Copy,
  ExternalLink,
  ShieldCheck,
  Users,
  Server,
  Key,
  RefreshCw,
  AlertCircle,
  FileCode,
  Sparkles,
} from 'lucide-react';

interface SupabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupabaseModal: React.FC<SupabaseModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{
    tested: boolean;
    connected: boolean;
    message: string;
  } | null>(null);

  if (!isOpen) return null;

  const handleCopySQL = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
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
      setConnectionStatus({
        tested: true,
        connected: true,
        message: `အောင်မြင်စွာ Sync လုပ်ပြီးပါပြီ! အကောင့် (${res.syncedUsers}) ခုနှင့် သင်တန်း (${res.syncedCourses}) ခုလုံး Supabase Table Editor သို့ ရောက်ရှိသွားပါပြီ။`,
      });
    }
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
                  Supabase Integration & Database Setup
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
              <div className="flex items-center gap-2">
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
          </div>

          {/* User Accounts & Roles Overview */}
          <div className="space-y-2.5">
            <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Configured User Roles (Admin, Co-Admin & Students)</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60">
                <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 block">
                  🛡️ Administrator
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
                    href="https://supabase.com/dashboard/project/wxfassadxuxfvywvnlxs/sql/new"
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
                    href="https://supabase.com/dashboard/project/wxfassadxuxfvywvnlxs/auth/providers"
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
                    href="https://supabase.com/dashboard/project/wxfassadxuxfvywvnlxs/editor"
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
                    <span>App အတွင်းမှ အကောင့်များ စိတ်ကြိုက် ဖန်တီးခြင်းနှင့် Login ဝင်ခြင်း</span>
                  </div>
                </div>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed pl-7">
                  1. App ပေါ်ရှိ <strong>Test Connection</strong> ခလုတ်ကို နှိပ်ပြီး စိမ်းသွားပါက အားလုံး ချိတ်ဆက်မှု အောင်မြင်ပါပြီ။<br />
                  2. Admin ဖြင့် Login ဝင်၍ <strong>Student Directory</strong> &gt; <strong>+ Add New Account</strong> ကို နှိပ်ပြီး မိမိစိတ်ကြိုက် Admin, Co-Admin, Student အကောင့်များကို အကန့်အသတ်မရှိ ဖန်တီးနိုင်ပါသည်။<br />
                  3. <strong>Copy Credentials</strong> ခလုတ်ဖြင့် Username / Password များကို ကာယကံရှင်ထံသို့ ချက်ချင်း ပေးပို့နိုင်ပါသည်။
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
