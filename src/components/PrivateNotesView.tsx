import React, { useState, useEffect } from 'react';
import {
  Course,
  User,
  PrivateNote,
  PrivateNoteCategory,
  PrivateNoteStatus,
} from '../types/classroom';
import { ClassroomDB } from '../services/storage';
import {
  Lock,
  Send,
  CheckCircle2,
  Clock,
  XCircle,
  Calendar,
  BookOpen,
  MessageSquare,
  Search,
  Trash2,
  Edit3,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  Reply,
} from 'lucide-react';

interface PrivateNotesViewProps {
  course: Course;
  currentUser: User;
  onRefresh: () => void;
}

export const PrivateNotesView: React.FC<PrivateNotesViewProps> = ({
  course,
  currentUser,
  onRefresh,
}) => {
  const isInstructor = currentUser.role === 'admin' || currentUser.role === 'co_admin';

  // Student compose state
  const [category, setCategory] = useState<PrivateNoteCategory>('question');
  const [subject, setSubject] = useState('');
  const [leaveDate, setLeaveDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [content, setContent] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Instructor filter & reply state
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'resolved'>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | PrivateNoteCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const notes = ClassroomDB.getPrivateNotes(course.id, currentUser);

  // Automatically mark unread notes/replies as read when opening this tab
  useEffect(() => {
    ClassroomDB.markPrivateNotesReadForCourse(course.id, currentUser);
    onRefresh();
    ClassroomDB.syncPrivateNotesFromCloud(true).then((changed) => {
      if (changed) {
        ClassroomDB.markPrivateNotesReadForCourse(course.id, currentUser);
        onRefresh();
      }
    });
  }, [course.id, currentUser.id]);

  // Background poll every 10 seconds while inside the Private Notes tab
  useEffect(() => {
    let mounted = true;
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine !== false) {
        ClassroomDB.syncPrivateNotesFromCloud().then((changed) => {
          if (mounted && changed) {
            onRefresh();
          }
        });
      }
    }, 10_000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [course.id]);

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await ClassroomDB.syncPrivateNotesFromCloud(true);
      onRefresh();
    } finally {
      setIsSyncing(false);
    }
  };

  const handleStudentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!content.trim()) {
      setSubmitError('ကျေးဇူးပြု၍ မေးမြန်းလိုသော အကြောင်းအရာ သို့မဟုတ် ခွင့်တိုင်လိုသော အကြောင်းပြချက်ကို ရေးသားပါ။');
      return;
    }
    try {
      ClassroomDB.createPrivateNote(
        {
          courseId: course.id,
          category,
          subject: subject.trim(),
          leaveDate: category === 'leave_request' ? leaveDate : undefined,
          content: content.trim(),
        },
        currentUser
      );
      setSubject('');
      setContent('');
      setSubmitSuccess(
        'သင်၏ သီးသန့်စာကို ဆရာ (Admin / Co-Admin) ထံသို့ အောင်မြင်စွာ ပေးပို့ပြီးပါပြီ! ဆရာ ပြန်လည်ဖြေကြားသည့်အခါ အပေါ်ဆုံး ခေါင်းလောင်းပုံ (Notification Bell) နှင့် ဤစာမျက်နှာတွင် ချက်ချင်း ပေါ်လာပါမည်။'
      );
      onRefresh();
      setTimeout(() => setSubmitSuccess(null), 5000);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'စာပေးပို့ရာတွင် အမှားဖြစ်ပေါ်ခဲ့ပါသည်။');
    }
  };

  const handleInstructorReply = (
    note: PrivateNote,
    newStatus: Exclude<PrivateNoteStatus, 'pending'>
  ) => {
    const draft = (replyDrafts[note.id] ?? note.replyContent ?? '').trim();
    ClassroomDB.replyToPrivateNote(note.id, draft, newStatus, currentUser);
    setEditingNoteId(null);
    onRefresh();
  };

  const handleDeleteNote = (noteId: string) => {
    ClassroomDB.deletePrivateNote(noteId, currentUser);
    setConfirmDeleteId(null);
    onRefresh();
  };

  const pendingCount = notes.filter((n) => n.status === 'pending').length;
  const resolvedCount = notes.filter((n) => n.status !== 'pending').length;

  const filteredNotes = notes.filter((n) => {
    if (statusFilter === 'pending' && n.status !== 'pending') return false;
    if (statusFilter === 'resolved' && n.status === 'pending') return false;
    if (categoryFilter !== 'all' && n.category !== categoryFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        n.studentName.toLowerCase().includes(q) ||
        n.studentUsername.toLowerCase().includes(q) ||
        n.subject.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        (n.replyContent || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const renderCategoryBadge = (cat: PrivateNoteCategory, noteLeaveDate?: string) => {
    if (cat === 'leave_request') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-xl bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 text-[11px] font-bold border border-amber-300/60 dark:border-amber-800/60">
          <Calendar className="w-3 h-3 shrink-0" />
          <span>ခွင့်တိုင်ကြားစာ{noteLeaveDate ? ` (${noteLeaveDate})` : ''}</span>
        </span>
      );
    }
    if (cat === 'question') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-xl bg-indigo-100 dark:bg-indigo-950/70 text-indigo-800 dark:text-indigo-300 text-[11px] font-bold border border-indigo-300/60 dark:border-indigo-800/60">
          <BookOpen className="w-3 h-3 shrink-0" />
          <span>သင်ခန်းစာ မေးခွန်း</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold border border-emerald-300/60 dark:border-emerald-800/60">
        <MessageSquare className="w-3 h-3 shrink-0" />
        <span>သီးသန့် တင်ပြချက်</span>
      </span>
    );
  };

  const renderStatusBadge = (status: PrivateNoteStatus) => {
    if (status === 'pending') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-xl bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 text-[11px] font-extrabold border border-rose-300/60 dark:border-rose-800/60">
          <Clock className="w-3 h-3 shrink-0 animate-pulse" />
          <span>မဖြေရသေး (Pending)</span>
        </span>
      );
    }
    if (status === 'approved') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 text-[11px] font-extrabold border border-emerald-300/60 dark:border-emerald-800/60">
          <CheckCircle2 className="w-3 h-3 shrink-0" />
          <span>ခွင့်ပြုပြီး (Approved)</span>
        </span>
      );
    }
    if (status === 'rejected') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-extrabold border border-slate-300 dark:border-slate-700">
          <XCircle className="w-3 h-3 shrink-0 text-rose-500" />
          <span>ငြင်းပယ်ထားသည် (Declined)</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-xl bg-indigo-100 dark:bg-indigo-950/70 text-indigo-800 dark:text-indigo-300 text-[11px] font-extrabold border border-indigo-300/60 dark:border-indigo-800/60">
        <CheckCircle2 className="w-3 h-3 shrink-0" />
        <span>ဖြေကြားပြီး (Replied)</span>
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Privacy & Feature Banner */}
      <div className="neu-raised rounded-3xl p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-indigo-500/15">
        <div className="flex items-start sm:items-center gap-3.5 min-w-0">
          <div className="neu-inset-sm p-3 rounded-2xl text-indigo-600 dark:text-indigo-400 shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                {isInstructor
                  ? 'ကျောင်းသား သီးသန့်မေးခွန်းများနှင့် ခွင့်တိုင်ကြားစာများ (Private Student Notes)'
                  : 'ဆရာသို့ သီးသန့်မေးမြန်းရန်နှင့် ခွင့်တိုင်ကြားရန် (Private Note to Instructor)'}
              </h3>
              <span className="px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold">
                🔒 1-on-1 Private
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              {isInstructor
                ? 'ကျောင်းသားများ ပေးပို့ထားသော သင်ခန်းစာ မေးခွန်းများနှင့် ခွင့်တိုင်စာများကို ဤနေရာတွင် လက်ခံဖြေကြားနိုင်ပါသည်။ ခွင့်တိုင်စာကို "ခွင့်ပြုသည်" နှိပ်ပါက ထိုရက်၏ Attendance တွင်လည်း "ခွင့် (Excused)" အဖြစ် အလိုအလျောက် မှတ်တမ်းတင်ပေးပါသည်။'
                : 'အတန်းတွင်း လူသိရှင်ကြား မမေးလိုသော သင်ခန်းစာ မေးခွန်းများ၊ ခွင့်တိုင်ကြားစာများကို ဆရာ (Admin / Co-Admin) ထံသို့ သီးသန့် ပေးပို့နိုင်ပါသည်။ အခြားကျောင်းသားများ လုံးဝ မမြင်တွေ့နိုင်ပါ။'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleManualSync}
          disabled={isSyncing}
          className="neu-btn px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 cursor-pointer self-end sm:self-center shrink-0"
          title="နောက်ဆုံးရ စာများကို ပြန်လည်ရယူရန်"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>Sync</span>
        </button>
      </div>

      {/* STUDENT COMPOSE FORM */}
      {!isInstructor && (
        <form
          onSubmit={handleStudentSubmit}
          className="neu-card rounded-3xl p-4 sm:p-6 space-y-4 border border-slate-200/70 dark:border-slate-800"
        >
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200/60 dark:border-slate-800">
            <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Send className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>စာအသစ် ပေးပို့ရန် (Send New Private Note / Leave Request)</span>
            </h4>
            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
              {course.code}
            </span>
          </div>

          {/* Category Selector */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              ၁။ အမျိုးအစား ရွေးချယ်ပါ (Select Category)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setCategory('question')}
                className={`p-3 rounded-2xl text-xs font-bold flex items-center gap-2.5 transition-all cursor-pointer text-left ${
                  category === 'question'
                    ? 'neu-inset ring-2 ring-indigo-500/40 text-indigo-700 dark:text-indigo-300'
                    : 'neu-btn text-slate-600 dark:text-slate-300'
                }`}
              >
                <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <div>
                  <div>သင်ခန်းစာ မေးခွန်း</div>
                  <div className="text-[10px] font-normal opacity-75">Lesson Question</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setCategory('leave_request')}
                className={`p-3 rounded-2xl text-xs font-bold flex items-center gap-2.5 transition-all cursor-pointer text-left ${
                  category === 'leave_request'
                    ? 'neu-inset ring-2 ring-amber-500/40 text-amber-800 dark:text-amber-300'
                    : 'neu-btn text-slate-600 dark:text-slate-300'
                }`}
              >
                <Calendar className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <div>
                  <div>ခွင့်တိုင်ကြားစာ</div>
                  <div className="text-[10px] font-normal opacity-75">Leave Request</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setCategory('feedback')}
                className={`p-3 rounded-2xl text-xs font-bold flex items-center gap-2.5 transition-all cursor-pointer text-left ${
                  category === 'feedback'
                    ? 'neu-inset ring-2 ring-emerald-500/40 text-emerald-800 dark:text-emerald-300'
                    : 'neu-btn text-slate-600 dark:text-slate-300'
                }`}
              >
                <MessageSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <div>အထွေထွေ တင်ပြချက်</div>
                  <div className="text-[10px] font-normal opacity-75">General Feedback</div>
                </div>
              </button>
            </div>
          </div>

          {/* Subject & Optional Leave Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                ၂။ ခေါင်းစဉ် / အကြောင်းအရာအကျဉ်း (Subject)
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={
                  category === 'leave_request'
                    ? 'ဥပမာ — ကျန်းမာရေးကြောင့် ၁ ရက် ခွင့်တိုင်ကြားခြင်း'
                    : category === 'question'
                    ? 'ဥပမာ — Lesson 2 မှ သင်ခန်းစာ မရှင်းလင်းချက် မေးမြန်းခြင်း'
                    : 'ဥပမာ — သင်တန်းချိန်နှင့် ပတ်သက်၍ တင်ပြချက်'
                }
                className="neu-input w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100"
              />
            </div>

            {category === 'leave_request' && (
              <div>
                <label className="block text-xs font-bold text-amber-800 dark:text-amber-300 mb-1.5">
                  📅 ခွင့်ယူလိုသည့် ရက်စွဲ (Leave Date)
                </label>
                <input
                  type="date"
                  value={leaveDate}
                  onChange={(e) => setLeaveDate(e.target.value)}
                  className="neu-input w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-mono text-slate-900 dark:text-slate-100"
                />
              </div>
            )}
          </div>

          {/* Content Textarea */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              ၃။ အသေးစိတ် ရေးသားရန် (Message Details) <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={
                category === 'leave_request'
                  ? 'အတန်းမတက်ရောက်နိုင်သည့် အကြောင်းပြချက်ကို ရေးသားပေးပါ...'
                  : 'ဆရာထံ သီးသန့်မေးမြန်းလိုသော အကြောင်းအရာကို ပြည့်စုံစွာ ရေးသားပေးပါ...'
              }
              className="neu-input w-full px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 leading-relaxed"
            />
          </div>

          {submitError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs font-semibold text-rose-700 dark:text-rose-300">
              {submitError}
            </div>
          )}

          {submitSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{submitSuccess}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>ဤစာသည် မိနစ် ၃၀ ကြာလျှင်လည်း လုံးဝ မပျက်သွားဘဲ ဆရာဖြေကြားသည့်အထိ ရှိနေပါမည်။</span>
            </div>

            <button
              type="submit"
              className="neu-btn-indigo px-5 py-2.5 rounded-xl text-xs font-extrabold text-white flex items-center justify-center gap-2 cursor-pointer shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span>ဆရာထံ ပေးပို့မည် (Send Private Note)</span>
            </button>
          </div>
        </form>
      )}

      {/* INSTRUCTOR FILTER & SEARCH BAR */}
      {isInstructor && (
        <div className="neu-card rounded-3xl p-4 sm:p-5 space-y-3.5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Status Filter Pills */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                  statusFilter === 'all'
                    ? 'neu-btn-indigo text-white'
                    : 'neu-btn text-slate-600 dark:text-slate-300'
                }`}
              >
                အားလုံး ({notes.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('pending')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 ${
                  statusFilter === 'pending'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'neu-btn text-rose-700 dark:text-rose-300'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                <span>မဖြေရသေး ({pendingCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('resolved')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                  statusFilter === 'resolved'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'neu-btn text-emerald-700 dark:text-emerald-300'
                }`}
              >
                ✓ ဖြေကြားပြီး ({resolvedCount})
              </button>
            </div>

            {/* Category Filter + Student Search */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as 'all' | PrivateNoteCategory)}
                className="neu-input px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                <option value="all">အမျိုးအစား အားလုံး (All Types)</option>
                <option value="question">📘 သင်ခန်းစာ မေးခွန်းများ</option>
                <option value="leave_request">📅 ခွင့်တိုင်ကြားစာများ</option>
                <option value="feedback">💬 အထွေထွေ တင်ပြချက်များ</option>
              </select>

              <div className="relative w-full sm:w-60">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ကျောင်းသားအမည် / စာရှာရန်..."
                  className="neu-input w-full pl-9 pr-3 py-2 rounded-xl text-xs text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NOTES LIST */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h4 className="text-xs sm:text-sm font-extrabold text-slate-800 dark:text-slate-200">
            {isInstructor
              ? `လက်ခံရရှိသော စာများ (${filteredNotes.length})`
              : `သင်ပေးပို့ထားသော စာများနှင့် ဆရာ့အဖြေများ (${filteredNotes.length})`}
          </h4>
        </div>

        {filteredNotes.length === 0 ? (
          <div className="neu-card rounded-3xl p-8 sm:p-12 text-center space-y-2">
            <div className="neu-inset-sm w-12 h-12 rounded-2xl mx-auto flex items-center justify-center text-slate-400">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300">
              {isInstructor
                ? 'လက်ရှိတွင် ကျောင်းသားများ ပေးပို့ထားသော သီးသန့်စာ မရှိသေးပါ။'
                : 'သင်ပေးပို့ထားသော သီးသန့်စာ သို့မဟုတ် ခွင့်တိုင်ကြားစာ မရှိသေးပါ။'}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              {isInstructor
                ? 'ကျောင်းသားတစ်ဦးမှ မေးခွန်း သို့မဟုတ် ခွင့်တိုင်စာ ပေးပို့လာပါက ဤနေရာနှင့် Notification Bell တွင် ချက်ချင်း ပေါ်လာပါမည်။'
                : 'အပေါ်ရှိ ဖောင်မှတစ်ဆင့် သင်ခန်းစာ မေးခွန်း သို့မဟုတ် ခွင့်တိုင်ကြားစာကို ဆရာထံ သီးသန့် ပေးပို့နိုင်ပါသည်။'}
            </p>
          </div>
        ) : (
          filteredNotes.map((note) => {
            const isReplyingOrEditing =
              isInstructor && (note.status === 'pending' || editingNoteId === note.id);
            const currentDraft =
              replyDrafts[note.id] !== undefined
                ? replyDrafts[note.id]
                : note.replyContent || '';

            return (
              <div
                key={note.id}
                className={`neu-card rounded-3xl p-4 sm:p-5 space-y-3.5 transition-all border ${
                  note.status === 'pending'
                    ? 'border-amber-500/30 dark:border-amber-500/30'
                    : 'border-slate-200/70 dark:border-slate-800'
                }`}
              >
                {/* Header: Student Identity, Category & Status */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-200/60 dark:border-slate-800">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center font-extrabold text-xs shrink-0">
                      🎓
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
                          {note.studentName}
                        </span>
                        <span className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400">
                          @{note.studentUsername}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-400">
                        ပေးပို့ချိန်: {note.createdAt}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {renderCategoryBadge(note.category, note.leaveDate)}
                    {renderStatusBadge(note.status)}

                    {confirmDeleteId === note.id ? (
                      <div className="flex items-center gap-1 bg-rose-50 dark:bg-rose-950/70 px-2 py-1 rounded-xl border border-rose-300 dark:border-rose-800">
                        <button
                          type="button"
                          onClick={() => handleDeleteNote(note.id)}
                          className="text-[11px] font-extrabold text-rose-600 dark:text-rose-400 px-1.5 cursor-pointer"
                        >
                          ဖျက်မည်
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-[11px] font-semibold text-slate-500 px-1 cursor-pointer"
                        >
                          မဖျက်ပါ
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(note.id)}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                        title="ဤစာကို ဖျက်ရန် (Delete Note)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Subject & Message Body */}
                <div className="space-y-1.5">
                  <div className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
                    {note.subject}
                  </div>
                  <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed neu-inset-sm p-3.5 rounded-2xl">
                    {note.content}
                  </p>
                </div>

                {/* Existing Instructor Reply Display */}
                {note.status !== 'pending' && note.replyContent && editingNoteId !== note.id && (
                  <div className="p-3.5 sm:p-4 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/35 border border-indigo-200/80 dark:border-indigo-800/60 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs font-extrabold text-indigo-900 dark:text-indigo-200">
                        <UserCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                        <span>
                          ဆရာ့အဖြေ — {note.repliedByName || 'Instructor'}{' '}
                          <span className="font-normal text-[11px] opacity-80">
                            ({note.repliedByRole === 'admin' ? 'Lead Mentor / Admin' : 'Co-Admin'})
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {note.repliedAt && (
                          <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400">
                            {note.repliedAt}
                          </span>
                        )}
                        {isInstructor && (
                          <button
                            type="button"
                            onClick={() => {
                              setReplyDrafts((prev) => ({
                                ...prev,
                                [note.id]: note.replyContent || '',
                              }));
                              setEditingNoteId(note.id);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800 text-[11px] font-bold text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700 cursor-pointer"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>ပြင်မည်</span>
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap leading-relaxed">
                      {note.replyContent}
                    </p>
                  </div>
                )}

                {/* Instructor Reply / Approval Box */}
                {isReplyingOrEditing && (
                  <div className="pt-2 space-y-2.5">
                    <textarea
                      rows={2}
                      value={currentDraft}
                      onChange={(e) =>
                        setReplyDrafts((prev) => ({
                          ...prev,
                          [note.id]: e.target.value,
                        }))
                      }
                      placeholder={
                        note.category === 'leave_request'
                          ? 'မှတ်ချက်/အဖြေ ရေးရန် (မရေးဘဲ "ခွင့်ပြုသည်" တိုက်ရိုက်နှိပ်လျှင်လည်း စနစ်မှ အလိုအလျောက် စာသားထည့်ပေးပါမည်)...'
                          : 'ကျောင်းသားထံ ပြန်လည်ဖြေကြားလိုသော အဖြေကို ရေးသားပါ...'
                      }
                      className="neu-input w-full px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm text-slate-900 dark:text-slate-100"
                    />

                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {editingNoteId === note.id && (
                        <button
                          type="button"
                          onClick={() => setEditingNoteId(null)}
                          className="neu-btn px-3 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
                        >
                          မပြင်တော့ပါ (Cancel)
                        </button>
                      )}

                      {note.category === 'leave_request' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleInstructorReply(note, 'approved')}
                            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-xs cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>✓ ခွင့်ပြုသည် (Approve Leave)</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleInstructorReply(note, 'rejected')}
                            className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>ငြင်းပယ်သည် (Decline)</span>
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => handleInstructorReply(note, 'replied')}
                        className="neu-btn-indigo px-4 py-2 rounded-xl text-xs font-extrabold text-white flex items-center gap-1.5 cursor-pointer"
                      >
                        <Reply className="w-3.5 h-3.5" />
                        <span>အဖြေပေးပို့မည် (Send Reply)</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
