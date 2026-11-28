import React, { useState, useEffect, useMemo } from 'react';
import { User, Course } from '../types/classroom';
import { AudioReaderPlayer } from './AudioReaderPlayer';
import {
  NotebookPen,
  Plus,
  Search,
  Pin,
  Trash2,
  Copy,
  Check,
  Download,
  X,
  CheckSquare,
  Square,
  Clock,
  BookOpen,
  Sparkles,
} from 'lucide-react';

interface StudyChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

type NoteColorId = 'indigo' | 'amber' | 'emerald' | 'rose' | 'slate';

export interface PersonalStudyNote {
  id: string;
  title: string;
  content: string;
  courseId: string; // 'general' or Course.id
  color: NoteColorId;
  isPinned: boolean;
  checklist: StudyChecklistItem[];
  updatedAt: string;
  updatedAtMs: number;
}

interface StudyNotebookModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  courses: Course[];
  activeCourseId?: string;
}

const NOTE_COLOR_STYLES: Record<
  NoteColorId,
  {
    label: string;
    dot: string;
    cardBorder: string;
    badge: string;
  }
> = {
  indigo: {
    label: 'Indigo',
    dot: 'bg-indigo-500',
    cardBorder: 'border-indigo-500/35',
    badge: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
  },
  amber: {
    label: 'Amber Gold',
    dot: 'bg-amber-500',
    cardBorder: 'border-amber-500/40',
    badge: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30',
  },
  emerald: {
    label: 'Emerald',
    dot: 'bg-emerald-500',
    cardBorder: 'border-emerald-500/35',
    badge: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30',
  },
  rose: {
    label: 'Rose',
    dot: 'bg-rose-500',
    cardBorder: 'border-rose-500/35',
    badge: 'bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-500/30',
  },
  slate: {
    label: 'Slate',
    dot: 'bg-slate-500',
    cardBorder: 'border-slate-400/35',
    badge: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30',
  },
};

function getStorageKeyForUser(userId: string): string {
  return `swanarh_personal_study_notebook_v1_${userId}`;
}

function formatNowDisplay(): string {
  return new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const StudyNotebookModal: React.FC<StudyNotebookModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  courses,
  activeCourseId,
}) => {
  const storageKey = getStorageKeyForUser(currentUser.id);

  const [notes, setNotes] = useState<PersonalStudyNote[]>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [
      {
        id: `note-welcome-${Date.now()}`,
        title: '📚 ကျွန်ုပ်၏ ကိုယ်ပိုင် သင်ခန်းစာ မှတ်စုစာအုပ် (My Study Pad)',
        content:
          'သင်ခန်းစာ ဗီဒီယိုများ ကြည့်ရှုရင်း သို့မဟုတ် Library စာအုပ်များ ဖတ်ရှုရင်း အရေးကြီးသော အချက်များ၊ ဝေါဟာရများနှင့် စာမေးပွဲအတွက် မှတ်သားစရာများကို ဤနေရာတွင် လွတ်လပ်စွာ ရေးမှတ်သိမ်းဆည်းထားနိုင်ပါသည်။\n\n• အတန်းတစ်ခုချင်းစီအလိုက် ခွဲခြားမှတ်သားနိုင်ပါသည်။\n• အောက်ပါ Checklist တွင်လည်း လေ့လာရန် ကျန်ရှိသည့် သင်ခန်းစာများကို အမှန်ခြစ် (✓) မှတ်သားနိုင်ပါသည်။',
        courseId: activeCourseId || 'general',
        color: 'indigo',
        isPinned: true,
        checklist: [
          {
            id: 'chk-1',
            text: 'ယနေ့ သင်ခန်းစာ မှတ်စုများကို ပြန်လည်ဖတ်ရှုရန်',
            done: false,
          },
          {
            id: 'chk-2',
            text: 'Library ထဲမှ eBook နှင့် အဘိဓာန် ဝေါဟာရများ လေ့ကျင့်ရန်',
            done: false,
          },
        ],
        updatedAt: formatNowDisplay(),
        updatedAtMs: Date.now(),
      },
    ];
  });

  const [selectedNoteId, setSelectedNoteId] = useState<string>(() => notes[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCourseId, setFilterCourseId] = useState<string>('all');
  const [newChecklistText, setNewChecklistText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(notes));
    } catch {
      // ignore
    }
  }, [notes, storageKey]);

  const filteredNotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...notes]
      .filter((n) => {
        if (filterCourseId !== 'all' && n.courseId !== filterCourseId) return false;
        if (!q) return true;
        return (
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q) ||
          n.checklist.some((c) => c.text.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return b.updatedAtMs - a.updatedAtMs;
      });
  }, [notes, searchQuery, filterCourseId]);

  const activeNote = useMemo(
    () => notes.find((n) => n.id === selectedNoteId) || filteredNotes[0] || null,
    [notes, selectedNoteId, filteredNotes]
  );

  if (!isOpen) return null;

  const handleCreateNewNote = () => {
    const newNote: PersonalStudyNote = {
      id: `studynote-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: 'မှတ်စုအသစ် (Untitled Study Note)',
      content: '',
      courseId:
        filterCourseId !== 'all'
          ? filterCourseId
          : activeCourseId || 'general',
      color: 'indigo',
      isPinned: false,
      checklist: [],
      updatedAt: formatNowDisplay(),
      updatedAtMs: Date.now(),
    };
    setNotes((prev) => [newNote, ...prev]);
    setSelectedNoteId(newNote.id);
  };

  const handleUpdateActiveNote = (patch: Partial<PersonalStudyNote>) => {
    if (!activeNote) return;
    const nowDisplay = formatNowDisplay();
    const nowMs = Date.now();
    setNotes((prev) =>
      prev.map((n) =>
        n.id === activeNote.id
          ? {
              ...n,
              ...patch,
              updatedAt: nowDisplay,
              updatedAtMs: nowMs,
            }
          : n
      )
    );
  };

  const handleDeleteNote = (id: string) => {
    setNotes((prev) => {
      const remaining = prev.filter((n) => n.id !== id);
      if (selectedNoteId === id) {
        setSelectedNoteId(remaining[0]?.id || '');
      }
      return remaining;
    });
  };

  const handleAddChecklistItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeNote || !newChecklistText.trim()) return;
    const nextItem: StudyChecklistItem = {
      id: `chk-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      text: newChecklistText.trim(),
      done: false,
    };
    handleUpdateActiveNote({
      checklist: [...activeNote.checklist, nextItem],
    });
    setNewChecklistText('');
  };

  const handleToggleChecklistItem = (itemId: string) => {
    if (!activeNote) return;
    handleUpdateActiveNote({
      checklist: activeNote.checklist.map((item) =>
        item.id === itemId ? { ...item, done: !item.done } : item
      ),
    });
  };

  const handleRemoveChecklistItem = (itemId: string) => {
    if (!activeNote) return;
    handleUpdateActiveNote({
      checklist: activeNote.checklist.filter((item) => item.id !== itemId),
    });
  };

  const handleInsertTimestamp = () => {
    if (!activeNote) return;
    const stamp = `\n[${formatNowDisplay()}] — `;
    handleUpdateActiveNote({
      content: (activeNote.content || '') + stamp,
    });
  };

  const handleCopyNote = (note: PersonalStudyNote) => {
    const checklistStr =
      note.checklist.length > 0
        ? '\n\nChecklist:\n' +
          note.checklist.map((c) => `${c.done ? '☑' : '☐'} ${c.text}`).join('\n')
        : '';
    const fullText = `${note.title}\nUpdated: ${note.updatedAt}\n\n${note.content}${checklistStr}`;
    navigator.clipboard?.writeText(fullText);
    setCopiedId(note.id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleExportTxt = (note: PersonalStudyNote) => {
    const courseObj = courses.find((c) => c.id === note.courseId);
    const courseLabel = courseObj ? `${courseObj.code} - ${courseObj.title}` : 'General Study Note';
    const checklistStr =
      note.checklist.length > 0
        ? '\n\n--- Study Checklist ---\n' +
          note.checklist.map((c) => `[${c.done ? '✓' : ' '}] ${c.text}`).join('\n')
        : '';
    const fullText = `SWANARH ACADEMY — PERSONAL STUDY NOTEBOOK\nTitle: ${note.title}\nCourse: ${courseLabel}\nLast Updated: ${note.updatedAt}\n==========================================\n\n${note.content}${checklistStr}\n`;
    const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${note.title.slice(0, 32).replace(/[^a-zA-Z0-9\u1000-\u109F_-]/g, '_') || 'study_note'}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-6xl h-[93dvh] sm:h-[88dvh] neu-canvas rounded-2xl sm:rounded-3xl border border-indigo-500/30 shadow-2xl overflow-hidden flex flex-col">
        {/* Top Header */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200/80 dark:border-slate-800 bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
              <NotebookPen className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-extrabold text-white truncate flex items-center gap-2">
                <span>ကိုယ်ပိုင် သင်ခန်းစာ မှတ်စုစာအုပ် (My Personal Study Notebook)</span>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-mono font-bold">
                  <Sparkles className="w-3 h-3" /> Auto-Saved
                </span>
              </h3>
              <p className="text-[11px] text-slate-300 truncate">
                သင်ခန်းစာ မှတ်စုများ၊ အရေးကြီးအချက်များနှင့် လေ့လာရန် Checklist များကို မိမိကိုယ်ပိုင် မှတ်စုအဖြစ် သိမ်းဆည်းနိုင်သည်
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCreateNewNote}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 text-xs font-extrabold flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>မှတ်စုအသစ် ယူမည်</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-rose-600 text-white transition-colors cursor-pointer"
              aria-label="Close Notebook"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main Split Workspace */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
          {/* Left Sidebar: Notes List & Filters */}
          <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-slate-200/80 dark:border-slate-800 flex flex-col max-h-56 md:max-h-none shrink-0 bg-slate-100/50 dark:bg-slate-900/50">
            <div className="p-3 space-y-2 border-b border-slate-200/70 dark:border-slate-800">
              {/* Search Box */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="မှတ်စု ရှာဖွေရန်..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl neu-inset text-xs text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              {/* Course Filter */}
              <select
                value={filterCourseId}
                onChange={(e) => setFilterCourseId(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl neu-inset text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none"
              >
                <option value="all">📚 အတန်းအားလုံး၏ မှတ်စုများ ({notes.length})</option>
                <option value="general">🌐 အထွေထွေ မှတ်စု (General)</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Notes List */}
            <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
              {filteredNotes.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                  မှတ်စု မရှိသေးပါ။ အပေါ်မှ "မှတ်စုအသစ် ယူမည်" ကို နှိပ်ပါ။
                </div>
              ) : (
                filteredNotes.map((note) => {
                  const isSelected = activeNote?.id === note.id;
                  const cStyle = NOTE_COLOR_STYLES[note.color || 'indigo'];
                  const courseObj = courses.find((c) => c.id === note.courseId);
                  return (
                    <div
                      key={note.id}
                      onClick={() => setSelectedNoteId(note.id)}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                        isSelected
                          ? `neu-raised ${cStyle.cardBorder} ring-2 ring-indigo-500/40`
                          : 'neu-card border-transparent hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${cStyle.dot}`} />
                          <h4 className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                            {note.title || 'Untitled Note'}
                          </h4>
                        </div>
                        {note.isPinned && (
                          <Pin className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                        )}
                      </div>

                      <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 mt-1">
                        {note.content || 'စာသား မရေးရသေးပါ...'}
                      </p>

                      <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                        <span className={`px-1.5 py-0.5 rounded-md border font-bold truncate ${cStyle.badge}`}>
                          {courseObj ? courseObj.code : 'အထွေထွေ'}
                        </span>
                        <span className="font-mono shrink-0">{note.updatedAt}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Editor Area */}
          <div className="flex-1 min-w-0 flex flex-col overflow-y-auto p-3.5 sm:p-5 space-y-4">
            {activeNote ? (
              <>
                {/* Top Metadata & Action Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200/70 dark:border-slate-800">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Course Selector for Note */}
                    <div className="flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                      <select
                        value={activeNote.courseId}
                        onChange={(e) => handleUpdateActiveNote({ courseId: e.target.value })}
                        className="px-2.5 py-1 rounded-xl neu-inset text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none"
                      >
                        <option value="general">🌐 အထွေထွေ မှတ်စု (General)</option>
                        {courses.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.code} — {c.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Color Tag Picker */}
                    <div className="flex items-center gap-1 px-2 py-1 rounded-xl neu-inset">
                      {(Object.keys(NOTE_COLOR_STYLES) as NoteColorId[]).map((cid) => (
                        <button
                          key={cid}
                          type="button"
                          onClick={() => handleUpdateActiveNote({ color: cid })}
                          className={`w-4 h-4 rounded-full transition-transform cursor-pointer ${
                            NOTE_COLOR_STYLES[cid].dot
                          } ${
                            activeNote.color === cid
                              ? 'scale-125 ring-2 ring-offset-1 ring-indigo-500'
                              : 'opacity-65 hover:opacity-100'
                          }`}
                          title={NOTE_COLOR_STYLES[cid].label}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleUpdateActiveNote({ isPinned: !activeNote.isPinned })}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer border ${
                        activeNote.isPinned
                          ? 'bg-amber-500/20 border-amber-500/40 text-amber-700 dark:text-amber-300'
                          : 'neu-btn text-slate-600 dark:text-slate-300 border-transparent'
                      }`}
                    >
                      <Pin className="w-3.5 h-3.5" />
                      <span>{activeNote.isPinned ? 'Pinned' : 'Pin'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleInsertTimestamp}
                      className="px-2.5 py-1.5 rounded-xl neu-btn text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1 cursor-pointer"
                      title="လက်ရှိ နေ့စွဲနှင့် အချိန် ထည့်ရန်"
                    >
                      <Clock className="w-3.5 h-3.5 text-indigo-500" />
                      <span>အချိန်ထည့်</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopyNote(activeNote)}
                      className="px-2.5 py-1.5 rounded-xl neu-btn text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedId === activeNote.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="text-emerald-600 dark:text-emerald-400">ကူးယူပြီး</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleExportTxt(activeNote)}
                      className="px-2.5 py-1.5 rounded-xl neu-btn text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 cursor-pointer"
                      title="မှတ်စုကို .txt ဖိုင်အဖြစ် ဒေါင်းလုဒ်ဆွဲရန်"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>.TXT ထုတ်မည်</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteNote(activeNote.id)}
                      className="p-1.5 rounded-xl neu-btn text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                      title="ဤမှတ်စုကို ဖျက်မည်"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Audio Reader Bar for this Note */}
                {activeNote.content.trim().length > 0 && (
                  <AudioReaderPlayer
                    title={activeNote.title}
                    rawTextOrHtml={activeNote.content}
                    compact
                  />
                )}

                {/* Title Input */}
                <input
                  type="text"
                  value={activeNote.title}
                  onChange={(e) => handleUpdateActiveNote({ title: e.target.value })}
                  placeholder="မှတ်စု ခေါင်းစဉ် ရေးပါ..."
                  className="w-full px-3.5 py-2.5 rounded-2xl neu-inset text-sm sm:text-base font-extrabold text-slate-900 dark:text-white focus:outline-none"
                />

                {/* Main Content Textarea */}
                <textarea
                  value={activeNote.content}
                  onChange={(e) => handleUpdateActiveNote({ content: e.target.value })}
                  placeholder="သင်ခန်းစာ မှတ်စုများ၊ အရေးကြီးသော ဝေါဟာရများ သို့မဟုတ် မှတ်သားလိုသည်များကို ဤနေရာတွင် ရေးသားပါ..."
                  rows={8}
                  className="w-full flex-1 min-h-[180px] p-4 rounded-2xl neu-inset text-xs sm:text-sm text-slate-800 dark:text-slate-100 leading-relaxed resize-y focus:outline-none"
                />

                {/* Interactive Study Checklist Section */}
                <div className="p-3.5 rounded-2xl neu-card border border-slate-200/70 dark:border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <CheckSquare className="w-4 h-4 text-emerald-500" />
                      <span>
                        လေ့လာရန် အချက်များ (Study Checklist —{' '}
                        {activeNote.checklist.filter((c) => c.done).length}/
                        {activeNote.checklist.length})
                      </span>
                    </h5>
                  </div>

                  {/* Checklist Items */}
                  {activeNote.checklist.length > 0 && (
                    <div className="space-y-1.5">
                      {activeNote.checklist.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800"
                        >
                          <button
                            type="button"
                            onClick={() => handleToggleChecklistItem(item.id)}
                            className="flex items-center gap-2 text-left flex-1 min-w-0 cursor-pointer"
                          >
                            {item.done ? (
                              <CheckSquare className="w-4 h-4 text-emerald-500 shrink-0" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-400 shrink-0" />
                            )}
                            <span
                              className={`text-xs ${
                                item.done
                                  ? 'line-through text-slate-400 dark:text-slate-500'
                                  : 'text-slate-800 dark:text-slate-200 font-semibold'
                              }`}
                            >
                              {item.text}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveChecklistItem(item.id)}
                            className="text-slate-400 hover:text-rose-500 p-1 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Checklist Input */}
                  <form onSubmit={handleAddChecklistItem} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newChecklistText}
                      onChange={(e) => setNewChecklistText(e.target.value)}
                      placeholder="+ လုပ်ဆောင်ရန် သို့မဟုတ် လေ့လာရန် အချက်အသစ် ထည့်ရန်..."
                      className="flex-1 px-3 py-1.5 rounded-xl neu-inset text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 rounded-xl neu-btn-indigo text-xs font-bold cursor-pointer shrink-0"
                    >
                      + ထည့်မည်
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <NotebookPen className="w-12 h-12 text-indigo-400 mb-3 opacity-60" />
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  ရွေးချယ်ထားသော မှတ်စု မရှိသေးပါ
                </p>
                <button
                  type="button"
                  onClick={handleCreateNewNote}
                  className="mt-3 px-4 py-2 rounded-xl neu-btn-indigo text-xs font-extrabold cursor-pointer"
                >
                  + မှတ်စုအသစ် စတင်ရေးသားမည်
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
