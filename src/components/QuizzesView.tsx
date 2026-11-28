import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Course, Quiz, QuizQuestion, QuizSubmission, User } from '../types/classroom';
import { ClassroomDB } from '../services/storage';
import {
  FileQuestion,
  Plus,
  Clock,
  Award,
  CheckCircle2,
  XCircle,
  Sparkles,
  Layers,
  Play,
  RotateCcw,
  Eye,
  Edit3,
  Trash2,
  Users,
  Download,
  Search,
  Volume2,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  AlertTriangle,
  KeyRound,
  ClipboardPaste,
  Check,
  X,
  RefreshCw,
  BookOpen,
  Globe,
  Lock,
  BellRing,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  Shuffle,
  Database,
} from 'lucide-react';
import {
  DataFormEditorModal,
  StudentDataFormFillModal,
  DataFormResponsesModal,
  downloadDataFormExcelCsv,
  downloadDataFormPdf,
  DEFAULT_DATA_FORM_FIELDS,
} from './ExamRoomDataFormModals';

interface QuizzesViewProps {
  course: Course;
  currentUser: User;
  onRefresh: () => void;
}

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

/**
 * Deterministic Fisher-Yates shuffle seeded by (quizId + studentId + sessionStartedAtMs)
 * so each student gets a unique question/option order that persists even if they refresh mid-exam.
 */
function seededShuffleArray<T>(items: T[], seedStr: string): T[] {
  const arr = [...items];
  let hash = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    hash ^= seedStr.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  let seed = hash >>> 0;
  for (let i = arr.length - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const j = seed % (i + 1);
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

const MYANMAR_CHOICE_MAP: Record<string, number> = {
  'က': 0,
  'ခ': 1,
  'ဂ': 2,
  'ဃ': 3,
  'င': 4,
  'စ': 5,
  'ဆ': 6,
  'ဇ': 7,
  '၁': 0,
  '၂': 1,
  '၃': 2,
  '၄': 3,
  '၅': 4,
  '၆': 5,
  '၇': 6,
  '၈': 7,
};

function resolveChoiceTokenIndex(rawToken: string): number {
  const token = rawToken.trim().toUpperCase();
  if (token in MYANMAR_CHOICE_MAP) return MYANMAR_CHOICE_MAP[token];
  const letterIdx = OPTION_LABELS.indexOf(token);
  if (letterIdx >= 0) return letterIdx;
  const num = parseInt(token, 10);
  if (!Number.isNaN(num) && num >= 1 && num <= 8) return num - 1;
  return -1;
}

export interface ExamAvailabilityInfo {
  isAvailable: boolean;
  state: 'open' | 'closed_manual' | 'scheduled_future' | 'closed_expired';
  badgeLabel: string;
  detailText?: string;
}

const MMT_OFFSET_MS = (6 * 60 + 30) * 60 * 1000; // UTC+06:30 (Myanmar Standard Time)

function parseScheduleDateTimeMs(
  iso?: string,
  timezoneMode: 'MMT' | 'LOCAL' = 'MMT'
): number {
  return ClassroomDB.parseQuizScheduleMs(iso, timezoneMode);
}

function formatScheduleDateTime(
  iso?: string,
  timezoneMode: 'MMT' | 'LOCAL' = 'MMT'
): string {
  if (!iso) return '';
  const ms = parseScheduleDateTimeMs(iso, timezoneMode);
  if (Number.isNaN(ms)) return iso;
  try {
    if (timezoneMode !== 'LOCAL') {
      return (
        new Date(ms).toLocaleString('en-GB', {
          timeZone: 'Asia/Yangon',
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        }) + ' (မြန်မာစံတော်ချိန် MMT)'
      );
    }
    return new Date(ms).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return new Date(ms).toLocaleString('en-US');
  }
}

function formatLiveMyanmarClock(nowMs: number = Date.now()): string {
  try {
    return new Date(nowMs).toLocaleString('en-GB', {
      timeZone: 'Asia/Yangon',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  } catch {
    return new Date(nowMs).toLocaleTimeString();
  }
}

function toDatetimeLocalInputValue(
  raw?: string,
  timezoneMode: 'MMT' | 'LOCAL' = 'MMT'
): string {
  if (!raw || !raw.trim()) return '';
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  const ms = parseScheduleDateTimeMs(trimmed, timezoneMode);
  if (Number.isNaN(ms)) return '';
  if (timezoneMode !== 'LOCAL') {
    const mmtDate = new Date(ms + MMT_OFFSET_MS);
    const yyyy = mmtDate.getUTCFullYear();
    const mm = String(mmtDate.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(mmtDate.getUTCDate()).padStart(2, '0');
    const hh = String(mmtDate.getUTCHours()).padStart(2, '0');
    const min = String(mmtDate.getUTCMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  }
  const d = new Date(ms);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function getDatetimeLocalWithOffset(
  offsetMinutes: number = 0,
  timezoneMode: 'MMT' | 'LOCAL' = 'MMT',
  baseMs: number = Date.now()
): string {
  const targetMs = baseMs + offsetMinutes * 60 * 1000;
  if (timezoneMode !== 'LOCAL') {
    const mmtDate = new Date(targetMs + MMT_OFFSET_MS);
    const yyyy = mmtDate.getUTCFullYear();
    const mm = String(mmtDate.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(mmtDate.getUTCDate()).padStart(2, '0');
    const hh = String(mmtDate.getUTCHours()).padStart(2, '0');
    const min = String(mmtDate.getUTCMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  }
  const d = new Date(targetMs);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function formatCountdownClock(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(clamped / 3600);
  const mins = Math.floor((clamped % 3600) / 60);
  const secs = clamped % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function playExamWarningTone(kind: 'five_min' | 'time_up'): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const freqs = kind === 'five_min' ? [587.33, 880, 587.33] : [440, 349.23, 293.66];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + idx * 0.18);
      gain.gain.setValueAtTime(0.12, now + idx * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.18 + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.18);
      osc.stop(now + idx * 0.18 + 0.17);
    });
  } catch {
    // ignore audio restrictions
  }
}

function getExamAvailability(quiz: Quiz, nowMs: number = Date.now()): ExamAvailabilityInfo {
  const tzMode = quiz.timezoneMode === 'LOCAL' ? 'LOCAL' : 'MMT';
  if (quiz.isOpen === false) {
    return {
      isAvailable: false,
      state: 'closed_manual',
      badgeLabel: '🔒 Exam ပိတ်ထားသည် (Closed)',
      detailText: 'ဆရာမှ စာမေးပွဲကို ယာယီပိတ်ထားပါသည်',
    };
  }

  const openMs = parseScheduleDateTimeMs(quiz.scheduledOpenAt, tzMode);
  const closeMs = parseScheduleDateTimeMs(quiz.scheduledCloseAt, tzMode);

  if (!Number.isNaN(openMs) && nowMs < openMs) {
    return {
      isAvailable: false,
      state: 'scheduled_future',
      badgeLabel: '🕒 အချိန်ဇယားဖြင့် ဖွင့်မည် (Scheduled)',
      detailText: `စတင်ဖြေဆိုနိုင်မည့်အချိန်: ${formatScheduleDateTime(quiz.scheduledOpenAt, tzMode)}`,
    };
  }

  if (!Number.isNaN(closeMs) && nowMs > closeMs) {
    return {
      isAvailable: false,
      state: 'closed_expired',
      badgeLabel: '⏹️ ဖြေဆိုချိန် ကုန်ဆုံးပြီ (Ended)',
      detailText: `ပိတ်သိမ်းချိန်: ${formatScheduleDateTime(quiz.scheduledCloseAt, tzMode)}`,
    };
  }

  if (!Number.isNaN(closeMs)) {
    return {
      isAvailable: true,
      state: 'open',
      badgeLabel: '🟢 Exam ဖွင့်ထားသည် (Open)',
      detailText: `ပိတ်မည့်အချိန်: ${formatScheduleDateTime(quiz.scheduledCloseAt, tzMode)}`,
    };
  }

  return {
    isAvailable: true,
    state: 'open',
    badgeLabel: '🟢 Exam ဖွင့်ထားသည် (Open)',
  };
}

function formatDurationSeconds(sec?: number): string {
  if (!sec || sec <= 0) return '—';
  const mins = Math.floor(sec / 60);
  const rem = sec % 60;
  if (mins === 0) return `${rem}s`;
  return `${mins}m ${rem}s`;
}

function parseSmartBulkQuestions(rawText: string): QuizQuestion[] {
  if (!rawText || !rawText.trim()) return [];
  const normalized = rawText.replace(/\r\n/g, '\n').trim();

  // Split by blank lines first; if user pasted without blank lines, split before numbered question headers
  let blocks = normalized
    .split(/\n\s*\n+/)
    .map((b) => b.trim())
    .filter(Boolean);

  if (blocks.length === 1) {
    const splitByQHeader = normalized
      .split(/\n(?=(?:Q\d+|မေးခွန်း\s*[၀-၉\d]+|\(?\d+[.)။]|\(?[၀-၉]+[.)။])\s+)/i)
      .map((b) => b.trim())
      .filter(Boolean);
    if (splitByQHeader.length > 1) {
      blocks = splitByQHeader;
    }
  }

  const parsed: QuizQuestion[] = [];
  const now = Date.now();

  blocks.forEach((block, idx) => {
    const lines = block
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) return;

    let questionText = '';
    const options: string[] = [];
    let correctIndex = 0;
    let explanation = '';

    lines.forEach((line) => {
      // 1. Check explicit Answer line (supports English A-H, 1-8 and Myanmar က-ဇ, ၁-၈)
      const ansMatch = line.match(
        /^(?:အဖြေမှန်|အဖြေ|answer|ans|correct)\s*[:：=\-။]\s*\(?([A-Ha-hက-ဇ၁-၈1-8])\)?/i
      );
      if (ansMatch) {
        const resolved = resolveChoiceTokenIndex(ansMatch[1]);
        if (resolved >= 0) {
          correctIndex = resolved;
        }
        return;
      }

      // 2. Check Explanation / Note line (Myanmar or English)
      const expMatch = line.match(
        /^(?:ရှင်းလင်းချက်|မှတ်ချက်|အကြောင်းပြချက်|explanation|note|reason)\s*[:：=\-။]\s*(.+)$/i
      );
      if (expMatch) {
        explanation = expMatch[1].trim();
        return;
      }

      // 3. Check Option line: supports *A), (A), A., က), (က), က။, က-, ၁), etc.
      const optMatch = line.match(
        /^([*✓✔])?\s*(?:\(([A-Ha-hက-ဇ၁-၈1-8])\)|([A-Ha-hက-ဇ])(?=[.)။:\-\s])|([1-8၁-၈])(?=[.)။:\-]))[.)။:\-\s]*(.+)$/
      );
      if (optMatch && (questionText.length > 0 || options.length > 0)) {
        let optText = (optMatch[5] || '').trim();
        const starred =
          Boolean(optMatch[1]) ||
          optText.startsWith('*') ||
          optText.endsWith('*') ||
          optText.endsWith('✓') ||
          optText.endsWith('✔') ||
          /\((?:အဖြေမှန်|အဖြေ|correct|ans|✓|✔)\)|\[(?:အဖြေမှန်|အဖြေ|correct|ans|✓|✔)\]/i.test(
            optText
          );

        optText = optText
          .replace(/^[*✓✔]+\s*/, '')
          .replace(/\s*[*✓✔]+$/, '')
          .replace(
            /\((?:အဖြေမှန်|အဖြေ|correct|ans|✓|✔)\)|\[(?:အဖြေမှန်|အဖြေ|correct|ans|✓|✔)\]/gi,
            ''
          )
          .trim();

        if (starred) {
          correctIndex = options.length;
        }
        if (optText) {
          options.push(optText);
        }
        return;
      }

      // 4. Otherwise treat as Question text (supports multi-line Myanmar & English questions)
      if (!questionText) {
        questionText = line
          .replace(
            /^(?:Question\s*\d+|Q\d+|မေးခွန်း\s*\(?[၀-၉\d]+\)?|\(\d+\)|\([၀-၉]+\)|\d+|[၀-၉]+)[.)။:\-\s]+/i,
            ''
          )
          .trim();
        if (!questionText) questionText = line.trim();
      } else if (options.length === 0) {
        questionText += ` ${line}`;
      }
    });

    // Preserve exact number of choices provided (2 choices stays 2 choices, up to 8 choices max)
    if (questionText && options.length >= 2) {
      const keptOptions = options.slice(0, 8);
      parsed.push({
        id: `q-${now}-${idx + 1}`,
        question: questionText,
        options: keptOptions,
        correctIndex: Math.min(Math.max(0, correctIndex), keptOptions.length - 1),
        explanation,
      });
    }
  });

  return parsed;
}

const SAMPLE_BULK_TEXT = `1. Choose the correct synonym for the word "Abundant":
A) Scarce
*B) Plentiful
C) Tiny
D) Weak
ရှင်းလင်းချက်: Abundant သည် ပေါများကြွယ်ဝသော (Plentiful) ဟု အဓိပ္ပာယ်ရပါသည်။

၂။ "The Earth revolves around the Sun." သည် မှန်ကန်ပါသလား။ (Choose 2 ခုတည်းပါသော နမူနာ)
*က) မှန်ပါသည် (True)
ခ) မှားပါသည် (False)
ရှင်းလင်းချက်: ကမ္ဘာသည် နေကို လှည့်ပတ်နေသောကြောင့် True (မှန်ပါသည်) ဖြစ်ပါသည်။

၃။ မြန်မာစာရေးထုံးအရ အမှန်ဆုံး စာလုံးပေါင်းကို ရွေးချယ်ပါ။
*က) ပရိသတ်
ခ) ပရိတ်သတ်
ဂ) ပရိသာတ်
ရှင်းလင်းချက်: "ပရိသတ်" (သတ်ပုံ - သ တစ်လုံးတည်း) သာ အမှန်ဖြစ်ပါသည်။`;

export const QuizzesView: React.FC<QuizzesViewProps> = ({ course, currentUser, onRefresh }) => {
  const isInstructor = currentUser.role === 'admin' || currentUser.role === 'co_admin';
  const [refreshTick, setRefreshTick] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);

  // Active modals / views
  const [activeTakeQuiz, setActiveTakeQuiz] = useState<Quiz | null>(null);
  const [activeFlashcardQuiz, setActiveFlashcardQuiz] = useState<Quiz | null>(null);
  const [reviewModalData, setReviewModalData] = useState<{
    quiz: Quiz;
    submission?: QuizSubmission;
    isAnswerKeyOnly?: boolean;
  } | null>(null);
  const [scoreboardQuiz, setScoreboardQuiz] = useState<Quiz | null>(null);
  const [editorQuiz, setEditorQuiz] = useState<Quiz | 'new' | null>(null);
  const [deleteConfirmQuiz, setDeleteConfirmQuiz] = useState<Quiz | null>(null);

  // Student Data Collection Form modals & filter state
  const [roomFilter, setRoomFilter] = useState<'all' | 'exam' | 'data_form'>('all');
  const [editorDataForm, setEditorDataForm] = useState<Quiz | 'new' | null>(null);
  const [activeFillDataForm, setActiveFillDataForm] = useState<Quiz | null>(null);
  const [responsesDataForm, setResponsesDataForm] = useState<Quiz | null>(null);
  const [downloadingFormPdfId, setDownloadingFormPdfId] = useState<string | null>(null);

  // Live 1-second clock tick so Myanmar Standard Time (MMT), scheduled Exam Open/Close times,
  // and per-student active exam countdowns update in real time
  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1_000);
    return () => clearInterval(timer);
  }, []);

  // Sync quizzes and submissions from cloud when opening tab
  useEffect(() => {
    let mounted = true;
    ClassroomDB.syncQuizzesFromCloud(true).then((changed) => {
      if (mounted && changed) {
        setRefreshTick((t) => t + 1);
        onRefresh();
      }
    });

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine !== false) {
        ClassroomDB.syncQuizzesFromCloud(false).then((changed) => {
          if (mounted && changed) {
            setRefreshTick((t) => t + 1);
          }
        });
      }
    }, 20_000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [course.id]);

  const quizzes = useMemo(
    () => ClassroomDB.getQuizzes(course.id),
    [course.id, refreshTick]
  );

  // Automatically close and auto-submit any active student exam session whose individual duration expired while modal was closed
  useEffect(() => {
    if (isInstructor || activeTakeQuiz) return;
    let didExpireAny = false;
    quizzes.forEach((q) => {
      if (q.itemType === 'data_form' || q.mode === 'practice') return;
      const existingSubs = ClassroomDB.getQuizSubmissions(q.id, currentUser.id);
      if (existingSubs.length > 0) return;
      const session = ClassroomDB.getStudentExamSession(q, currentUser.id);
      if (session && !session.isLockedOut && nowMs >= session.expiresAtMs) {
        const elapsedSec = Math.max(1, Math.round((session.expiresAtMs - session.startedAtMs) / 1000));
        ClassroomDB.submitQuiz(q, session.draftAnswers || {}, currentUser, elapsedSec, {
          startedAtMs: session.startedAtMs,
          startedAtMmt: session.startedAtMmt,
          autoSubmittedOnTimeout: true,
        });
        ClassroomDB.lockStudentExamSession(q.id, currentUser.id);
        didExpireAny = true;
      }
    });
    if (didExpireAny) {
      setRefreshTick((t) => t + 1);
      onRefresh();
    }
  }, [nowMs, quizzes, isInstructor, activeTakeQuiz, currentUser]);

  const handleToggleExamOpen = (quiz: Quiz) => {
    const nextIsOpen = quiz.isOpen === false ? true : false;
    ClassroomDB.toggleQuizOpenStatus(quiz.id, nextIsOpen, currentUser);
    setRefreshTick((t) => t + 1);
    onRefresh();
  };

  const enrolledStudents = useMemo(() => {
    const allUsers = ClassroomDB.getAllUsers();
    return allUsers.filter(
      (u) => u.role === 'student' && course.enrolledStudentIds.includes(u.id)
    );
  }, [course.enrolledStudentIds, refreshTick]);

  const handleManualSync = async () => {
    setIsSyncingCloud(true);
    try {
      await ClassroomDB.syncQuizzesFromCloud(true);
      setRefreshTick((t) => t + 1);
      onRefresh();
    } finally {
      setIsSyncingCloud(false);
    }
  };

  const examCount = useMemo(
    () => quizzes.filter((q) => q.itemType !== 'data_form').length,
    [quizzes]
  );
  const dataFormCount = useMemo(
    () => quizzes.filter((q) => q.itemType === 'data_form').length,
    [quizzes]
  );
  const filteredQuizzes = useMemo(() => {
    if (roomFilter === 'exam') return quizzes.filter((q) => q.itemType !== 'data_form');
    if (roomFilter === 'data_form') return quizzes.filter((q) => q.itemType === 'data_form');
    return quizzes;
  }, [quizzes, roomFilter]);

  const handleQuickDownloadFormPdf = async (
    form: Quiz,
    submissions: QuizSubmission[],
    mode: 'responses' | 'blank_form' = 'responses'
  ) => {
    setDownloadingFormPdfId(`${form.id}_${mode}`);
    try {
      await downloadDataFormPdf(form, course, submissions, mode === 'blank_form' ? 'blank_form' : 'auto');
    } finally {
      setDownloadingFormPdfId(null);
    }
  };

  // Student overall quiz stats
  const studentStats = useMemo(() => {
    if (isInstructor) return null;
    let completed = 0;
    let passed = 0;
    let totalScore = 0;
    let examItems = 0;
    let dataFormTotal = 0;
    let dataFormCompleted = 0;

    quizzes.forEach((q) => {
      const subs = ClassroomDB.getQuizSubmissions(q.id, currentUser.id);
      if (q.itemType === 'data_form') {
        dataFormTotal++;
        if (subs.length > 0) dataFormCompleted++;
        return;
      }
      examItems++;
      if (subs.length > 0) {
        completed++;
        totalScore += subs[0].score;
        if (subs[0].passed) passed++;
      }
    });

    return {
      total: examItems,
      completed,
      passed,
      avgScore: completed > 0 ? Math.round(totalScore / completed) : 0,
      dataFormTotal,
      dataFormCompleted,
    };
  }, [quizzes, currentUser.id, isInstructor, refreshTick]);

  // Instructor overall stats
  const instructorStats = useMemo(() => {
    if (!isInstructor) return null;
    let totalSubs = 0;
    let passedSubs = 0;
    let scoreSum = 0;
    let examItems = 0;
    let dataFormItems = 0;
    let dataFormSubs = 0;

    quizzes.forEach((q) => {
      const subs = ClassroomDB.getAllQuizSubmissionsForQuiz(q.id);
      if (q.itemType === 'data_form') {
        dataFormItems++;
        dataFormSubs += subs.length;
        return;
      }
      examItems++;
      totalSubs += subs.length;
      subs.forEach((s) => {
        scoreSum += s.score;
        if (s.passed) passedSubs++;
      });
    });

    return {
      totalQuizzes: examItems,
      dataFormItems,
      dataFormSubs,
      enrolledCount: enrolledStudents.length,
      totalSubmissions: totalSubs,
      avgScore: totalSubs > 0 ? Math.round(scoreSum / totalSubs) : 0,
      passRate: totalSubs > 0 ? Math.round((passedSubs / totalSubs) * 100) : 0,
    };
  }, [quizzes, enrolledStudents.length, isInstructor, refreshTick]);

  return (
    <div className="space-y-5">
      {/* Top Header & Summary Banner */}
      <div className="neu-card rounded-3xl p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-2xl bg-indigo-600/10 dark:bg-indigo-400/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                <FileQuestion className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                  Exam Room (စာမေးပွဲခန်း နှင့် လေ့ကျင့်ခန်း)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  မြန်မာ စံတော်ချိန် (MMT - UTC+06:30) အချိန်ဇယားဖြင့် နိုင်ငံစုံမှ တစ်ပြိုင်တည်း ဖြေဆိုနိုင်ပြီး ကျောင်းသား စနှိပ်သည့်အချိန်မှစ၍ သတ်မှတ်ကြာချိန်ပြည့်သည်နှင့် အလိုအလျောက် ဖြေဆိုခွင့်ပိတ်ပေးပါသည်
                </p>
              </div>
            </div>
            <div className="inline-flex flex-wrap items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-50/90 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800/70 text-[11px] font-bold text-indigo-800 dark:text-indigo-200 font-mono">
              <Globe className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>🇲🇲 လက်ရှိ မြန်မာစံတော်ချိန် (MMT · UTC+06:30):</span>
              <span className="font-extrabold text-indigo-950 dark:text-white">
                {formatLiveMyanmarClock(nowMs)}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleManualSync}
              disabled={isSyncingCloud}
              className="neu-btn px-3 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1.5 cursor-pointer"
              title="Cloud မှ အမှတ်စာရင်းနှင့် မေးခွန်းသစ်များ ရယူရန်"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingCloud ? 'animate-spin text-indigo-600' : ''}`} />
              <span>Sync Exam Room</span>
            </button>

            {isInstructor && (
              <>
                <button
                  type="button"
                  onClick={() => setEditorDataForm('new')}
                  className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-extrabold shadow-sm flex items-center gap-1.5 cursor-pointer transition-colors"
                  title="ကျောင်းသားများထံမှ လိုအပ်သော အချက်အလက်များ တောင်းခံရန် Form ဖန်တီးပြီး PDF / Excel ဒေါင်းလုဒ်ရယူရန်"
                >
                  <ClipboardList className="w-4 h-4" />
                  <span>+ အချက်အလက်တောင်းရန် Form ဖန်တီးမည်</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditorQuiz('new')}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold shadow-sm flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Exam အသစ်ဖန်တီးမည်</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Metrics Strip */}
        {isInstructor && instructorStats ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
            <div className="neu-inset-sm p-3 rounded-2xl">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Exam / Data Form စုစုပေါင်း
              </div>
              <div className="text-lg font-extrabold text-indigo-600 dark:text-indigo-400 font-mono mt-0.5">
                {instructorStats.totalQuizzes} Exam · {instructorStats.dataFormItems} Form
              </div>
            </div>
            <div className="neu-inset-sm p-3 rounded-2xl">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                အတန်းရှိ ကျောင်းသားဦးရေ
              </div>
              <div className="text-lg font-extrabold text-slate-900 dark:text-white font-mono mt-0.5">
                {instructorStats.enrolledCount} ဦး
              </div>
            </div>
            <div className="neu-inset-sm p-3 rounded-2xl">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                ဖြေဆိုပြီးသည့် အကြိမ်ရေ
              </div>
              <div className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                {instructorStats.totalSubmissions} ဦး
              </div>
            </div>
            <div className="neu-inset-sm p-3 rounded-2xl">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                ပျမ်းမျှရမှတ် / အောင်ချက်
              </div>
              <div className="text-lg font-extrabold text-amber-600 dark:text-amber-400 font-mono mt-0.5">
                {instructorStats.avgScore}% · ({instructorStats.passRate}% Pass)
              </div>
            </div>
          </div>
        ) : (
          studentStats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
              <div className="neu-inset-sm p-3 rounded-2xl">
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Exam စုစုပေါင်း
                </div>
                <div className="text-lg font-extrabold text-indigo-600 dark:text-indigo-400 font-mono mt-0.5">
                  {studentStats.total} ခု
                </div>
              </div>
              <div className="neu-inset-sm p-3 rounded-2xl">
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  ဖြေဆိုပြီးသည့် အရေအတွက်
                </div>
                <div className="text-lg font-extrabold text-slate-900 dark:text-white font-mono mt-0.5">
                  {studentStats.completed} / {studentStats.total}
                </div>
              </div>
              <div className="neu-inset-sm p-3 rounded-2xl">
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  မိမိ ပျမ်းမျှရမှတ်
                </div>
                <div className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                  {studentStats.avgScore}%
                </div>
              </div>
              <div className="neu-inset-sm p-3 rounded-2xl">
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  အောင်မြင်ပြီး / ဖောင်ဖြည့်ပြီး
                </div>
                <div className="text-lg font-extrabold text-amber-600 dark:text-amber-400 font-mono mt-0.5">
                  {studentStats.passed} Exam · {studentStats.dataFormCompleted}/{studentStats.dataFormTotal} Form
                </div>
              </div>
            </div>
          )
        )}

        {/* Filter Tabs: All / Exams / Data Forms */}
        <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setRoomFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer transition-all ${
                roomFilter === 'all'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              အားလုံး ({quizzes.length})
            </button>
            <button
              type="button"
              onClick={() => setRoomFilter('exam')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer transition-all flex items-center gap-1.5 ${
                roomFilter === 'exam'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100'
              }`}
            >
              <FileQuestion className="w-3.5 h-3.5" />
              <span>စာမေးပွဲများ - Exams ({examCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setRoomFilter('data_form')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer transition-all flex items-center gap-1.5 ${
                roomFilter === 'data_form'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 hover:bg-teal-100'
              }`}
            >
              <ClipboardList className="w-3.5 h-3.5" />
              <span>အချက်အလက် တောင်းခံလွှာများ - Data Forms ({dataFormCount})</span>
            </button>
          </div>
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
            📋 Data Form များကို PDF သို့မဟုတ် Excel (.csv) ဖိုင်အဖြစ် တိုက်ရိုက် ဒေါင်းလုဒ်ရယူနိုင်ပါသည်
          </span>
        </div>
      </div>

      {/* Exam & Data Form List */}
      {filteredQuizzes.length === 0 ? (
        <div className="neu-card rounded-3xl p-8 sm:p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
            {roomFilter === 'data_form' ? (
              <ClipboardList className="w-6 h-6 text-teal-600" />
            ) : (
              <FileQuestion className="w-6 h-6" />
            )}
          </div>
          <h4 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
            {roomFilter === 'data_form'
              ? 'အချက်အလက် တောင်းခံလွှာ (Data Form) မရှိသေးပါ'
              : 'Exam Room တွင် စာမေးပွဲ မရှိသေးပါ'}
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
            {isInstructor
              ? 'ကျောင်းသားများ တစ်ပြိုင်တည်း ဖြေဆိုရန် Auto-Graded Exam သို့မဟုတ် ကျောင်းသားများထံမှ လိုအပ်သည့် အချက်အလက်များ တောင်းခံပြီး PDF / Excel ဒေါင်းလုဒ်ရယူနိုင်သည့် Data Form များကို ဖန်တီးနိုင်ပါသည်။'
              : 'ဆရာမှ စာမေးပွဲ သို့မဟုတ် အချက်အလက်ဖြည့်သွင်းရန် Form အသစ်တင်ပေးသည့်အခါ ဤနေရာတွင် ချက်ချင်း ပေါ်လာပါမည်။'}
          </p>
          {isInstructor && (
            <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setEditorDataForm('new')}
                className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <ClipboardList className="w-4 h-4" />
                <span>+ အချက်အလက်တောင်းရန် Form ဖန်တီးမည်</span>
              </button>
              <button
                type="button"
                onClick={() => setEditorQuiz('new')}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>+ Exam အသစ်ဖန်တီးမည်</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredQuizzes.map((quiz) => {
            const isDataForm = quiz.itemType === 'data_form';
            const formFields =
              quiz.formFields && quiz.formFields.length > 0
                ? quiz.formFields
                : DEFAULT_DATA_FORM_FIELDS;

            if (isDataForm) {
              const mySubmissions = ClassroomDB.getQuizSubmissions(quiz.id, currentUser.id);
              const myLatestSub = mySubmissions[0];
              const allFormSubs = isInstructor
                ? ClassroomDB.getAllQuizSubmissionsForQuiz(quiz.id)
                : mySubmissions;
              const tzMode = quiz.timezoneMode === 'LOCAL' ? 'LOCAL' : 'MMT';
              const availability = getExamAvailability(quiz, nowMs);
              const canStudentFill =
                isInstructor ||
                (availability.isAvailable &&
                  (!myLatestSub || quiz.allowStudentEditSubmission !== false));

              return (
                <div
                  key={quiz.id}
                  className="neu-card rounded-3xl p-4 sm:p-6 space-y-4 border-2 border-teal-500/30 dark:border-teal-500/30 transition-all"
                >
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    <div className="space-y-2.5 min-w-0 flex-1">
                      {/* Badges Row */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
                            availability.state === 'open'
                              ? 'bg-emerald-100 dark:bg-emerald-950/90 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                              : availability.state === 'scheduled_future'
                                ? 'bg-amber-100 dark:bg-amber-950/90 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                                : 'bg-rose-100 dark:bg-rose-950/90 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-700'
                          }`}
                        >
                          <span>
                            {availability.state === 'open'
                              ? '🟢 Form ဖွင့်ထားသည် (ဖြည့်သွင်းနိုင်သည်)'
                              : availability.state === 'scheduled_future'
                                ? '⏳ သတ်မှတ်ချိန်ရောက်မှ ပွင့်မည်'
                                : '🔒 Form ပိတ်ထားသည်'}
                          </span>
                        </span>

                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-teal-100 dark:bg-teal-950/90 text-teal-800 dark:text-teal-300 border border-teal-300 dark:border-teal-700">
                          <ClipboardList className="w-3 h-3" />
                          <span>📋 အချက်အလက် တောင်းခံလွှာ (Student Data Form)</span>
                        </span>

                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">
                          <span>တောင်းခံထားသော အချက်အလက် {formFields.length} ချက်</span>
                        </span>

                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                          <Globe className="w-3 h-3" />
                          <span>
                            {tzMode === 'MMT'
                              ? '🇲🇲 မြန်မာစံတော်ချိန် (MMT · UTC+06:30)'
                              : '🌐 ဒေသစံတော်ချိန် (Local Time)'}
                          </span>
                        </span>
                      </div>

                      <h4 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white leading-snug">
                        {quiz.title}
                      </h4>

                      {quiz.description && (
                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                          {quiz.description}
                        </p>
                      )}

                      {/* Requested Fields Chips Preview */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        <span className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400">
                          တောင်းခံထားသည့် အချက်အလက်များ:
                        </span>
                        {formFields.map((field, idx) => (
                          <span
                            key={field.id}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-teal-50/90 dark:bg-teal-950/50 border border-teal-200/80 dark:border-teal-800 text-[11px] font-bold text-teal-900 dark:text-teal-200"
                          >
                            <span className="font-mono text-teal-600 dark:text-teal-400">
                              {idx + 1}.
                            </span>
                            <span>{field.label}</span>
                            {field.required && <span className="text-rose-500 font-black">*</span>}
                          </span>
                        ))}
                      </div>

                      {/* Schedule Info Banner */}
                      {(quiz.scheduledOpenAt || quiz.scheduledCloseAt || quiz.isOpen === false) && (
                        <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                          {quiz.scheduledOpenAt && (
                            <span className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 font-mono">
                              🟢 Form စဖွင့်ချိန်: {formatScheduleDateTime(quiz.scheduledOpenAt, tzMode)}
                            </span>
                          )}
                          {quiz.scheduledCloseAt && (
                            <span className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 font-mono">
                              🛑 Form ပိတ်ချိန်: {formatScheduleDateTime(quiz.scheduledCloseAt, tzMode)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Right Status Box: Student Submitted Badge or Teacher Response Counter */}
                    {myLatestSub && !isInstructor ? (
                      <div className="p-3.5 rounded-2xl border bg-emerald-50/90 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-700 shrink-0 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <div className="text-xs space-y-0.5">
                          <div className="font-extrabold text-emerald-950 dark:text-emerald-200">
                            အချက်အလက် ပေးပို့ပြီး ✓
                          </div>
                          <div className="text-[11px] text-emerald-700 dark:text-emerald-300 font-mono">
                            {myLatestSub.submittedAt}
                          </div>
                        </div>
                      </div>
                    ) : isInstructor ? (
                      <div
                        onClick={() => setResponsesDataForm(quiz)}
                        className="neu-inset-sm p-3.5 rounded-2xl shrink-0 cursor-pointer hover:ring-2 hover:ring-teal-500/40 transition-all flex items-center gap-3"
                        title="ကျောင်းသားများ ဖြည့်သွင်းထားသော အချက်အလက်စာရင်းနှင့် PDF / Excel ဒေါင်းလုဒ်ရယူရန်"
                      >
                        <div className="w-10 h-10 rounded-xl bg-teal-600/10 text-teal-600 dark:text-teal-400 flex items-center justify-center font-mono font-extrabold text-xs">
                          {allFormSubs.length}/{enrolledStudents.length}
                        </div>
                        <div className="text-xs">
                          <div className="font-extrabold text-slate-900 dark:text-white">
                            ဖောင်ဖြည့်ပြီးသူ {allFormSubs.length} ဦး
                          </div>
                          <div className="text-[11px] text-teal-600 dark:text-teal-400 font-semibold">
                            စာရင်းနှင့် PDF/Excel ကြည့်ရန် →
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {/* Action Buttons Footer for Data Form */}
                  <div className="pt-3 border-t border-slate-200/60 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      {canStudentFill ? (
                        <button
                          type="button"
                          onClick={() => setActiveFillDataForm(quiz)}
                          className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-extrabold shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>
                            {isInstructor
                              ? '✍️ စမ်းသပ်ဖြည့်သွင်းကြည့်မည် (Fill Form)'
                              : myLatestSub
                                ? '✏️ ဖြည့်သွင်းထားသည်ကို ကြည့်မည် / ပြန်ပြင်မည်'
                                : '✍️ ဖောင်ဖြည့်သွင်းမည် (Fill Form)'}
                          </span>
                        </button>
                      ) : myLatestSub ? (
                        <button
                          type="button"
                          onClick={() => setActiveFillDataForm(quiz)}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>ဖြည့်သွင်းထားသော အချက်အလက် ပြန်ကြည့်ရန်</span>
                        </button>
                      ) : (
                        <div className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5 text-rose-500" />
                          <span>
                            {availability.detailText || 'Form ဖြည့်သွင်းခွင့် ပိတ်ထားပါသည်'}
                          </span>
                        </div>
                      )}

                      {/* Direct 1-Click PDF & Excel Download Buttons on the Card */}
                      <button
                        type="button"
                        disabled={downloadingFormPdfId === `${quiz.id}_responses`}
                        onClick={() => handleQuickDownloadFormPdf(quiz, allFormSubs, 'responses')}
                        className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-extrabold shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                        title={
                          isInstructor
                            ? 'ကျောင်းသားများ ဖြည့်သွင်းထားသော အချက်အလက်စာရင်း (သို့) ဖောင်အလွတ်ကို PDF ဖိုင်အဖြစ် ဒေါင်းလုဒ်ဆွဲရန်'
                            : 'ဖောင်ကို PDF ဖိုင်အဖြစ် ဒေါင်းလုဒ်ဆွဲရန်'
                        }
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>
                          {downloadingFormPdfId === `${quiz.id}_responses`
                            ? 'PDF ထုတ်နေသည်...'
                            : isInstructor
                              ? `📄 PDF Download (${allFormSubs.length} ဦး)`
                              : '📄 PDF Download'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => downloadDataFormExcelCsv(quiz, course, allFormSubs)}
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                        title="Excel (.csv) ဖိုင်အဖြစ် ဒေါင်းလုဒ်ဆွဲရန်"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        <span>
                          {isInstructor
                            ? `📗 Excel Download (${allFormSubs.length} ဦး)`
                            : '📗 Excel Download'}
                        </span>
                      </button>
                    </div>

                    {/* Teacher Management Controls for Data Form */}
                    {isInstructor && (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleExamOpen(quiz)}
                          className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 cursor-pointer transition-colors border ${
                            quiz.isOpen === false
                              ? 'bg-rose-50 dark:bg-rose-950/70 hover:bg-rose-100 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-700'
                              : 'bg-emerald-50 dark:bg-emerald-950/70 hover:bg-emerald-100 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                          }`}
                        >
                          <span>
                            {quiz.isOpen === false
                              ? '🔒 Form ပိတ်ထားသည် (နှိပ်၍ ဖွင့်မည်)'
                              : '🟢 Form ဖွင့်ထားသည် (နှိပ်၍ ပိတ်မည်)'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setResponsesDataForm(quiz)}
                          className="px-3.5 py-2 rounded-xl bg-teal-50 dark:bg-teal-950/70 hover:bg-teal-100 dark:hover:bg-teal-900/60 text-teal-800 dark:text-teal-300 border border-teal-300 dark:border-teal-700 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <Users className="w-3.5 h-3.5" />
                          <span>
                            📊 ဖြည့်သွင်းထားသူ စာရင်း ({allFormSubs.length}/{enrolledStudents.length})
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setEditorDataForm(quiz)}
                          className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-teal-50 dark:hover:bg-teal-950/60 text-slate-600 dark:text-slate-300 hover:text-teal-600 text-xs font-bold cursor-pointer transition-colors"
                          title="Form အချက်အလက်များ ပြင်ဆင်ရန် (Edit Data Form)"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeleteConfirmQuiz(quiz)}
                          className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/60 text-slate-600 dark:text-slate-300 hover:text-rose-600 text-xs font-bold cursor-pointer transition-colors"
                          title="Form ဖျက်သိမ်းရန် (Delete Form)"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            }
            const cleanQuestions = (quiz.questions || []).filter(
              (q) => q && q.id !== '__quiz_meta__'
            );
            const mySubmissions = ClassroomDB.getQuizSubmissions(quiz.id, currentUser.id);
            const myLatestSub = mySubmissions[0];
            const allQuizSubs = isInstructor
              ? ClassroomDB.getAllQuizSubmissionsForQuiz(quiz.id)
              : [];
            const isPracticeMode = quiz.mode === 'practice';
            const tzMode = quiz.timezoneMode === 'LOCAL' ? 'LOCAL' : 'MMT';
            const availability = getExamAvailability(quiz, nowMs);

            // Check per-student individual exam timer session
            const activeStudentSession = ClassroomDB.getStudentExamSession(quiz, currentUser.id);
            const sessionRemainingSec =
              activeStudentSession && !activeStudentSession.isLockedOut
                ? Math.max(0, Math.ceil((activeStudentSession.expiresAtMs - nowMs) / 1000))
                : 0;
            const isStudentSessionInProgress = Boolean(
              activeStudentSession &&
                !activeStudentSession.isLockedOut &&
                sessionRemainingSec > 0 &&
                (!myLatestSub || isPracticeMode)
            );
            const isStudentSessionExpiredOrLocked = Boolean(
              !isPracticeMode &&
                ((activeStudentSession &&
                  (activeStudentSession.isLockedOut || nowMs >= activeStudentSession.expiresAtMs)) ||
                  Boolean(myLatestSub))
            );

            const canStudentTakeQuiz =
              isInstructor ||
              (availability.isAvailable &&
                (isPracticeMode || (!myLatestSub && !isStudentSessionExpiredOrLocked)));

            const correctCount = myLatestSub
              ? typeof myLatestSub.correctCount === 'number'
                ? myLatestSub.correctCount
                : cleanQuestions.filter((q) => myLatestSub.answers?.[q.id] === q.correctIndex)
                    .length
              : 0;

            return (
              <div
                key={quiz.id}
                className="neu-card rounded-3xl p-4 sm:p-6 space-y-4 border border-slate-200/70 dark:border-slate-800/80 transition-all"
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="space-y-2 min-w-0 flex-1">
                    {/* Badges Row */}
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Live Availability Status Badge */}
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
                          availability.state === 'open'
                            ? 'bg-emerald-100 dark:bg-emerald-950/90 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                            : availability.state === 'scheduled_future'
                              ? 'bg-amber-100 dark:bg-amber-950/90 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                              : 'bg-rose-100 dark:bg-rose-950/90 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-700'
                        }`}
                      >
                        <span>{availability.badgeLabel}</span>
                      </span>

                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
                          isPracticeMode
                            ? 'bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 border border-teal-300 dark:border-teal-700'
                            : 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700'
                        }`}
                      >
                        {isPracticeMode
                          ? '🔄 လေ့ကျင့်ခန်း (Practice Mode)'
                          : '📝 စာမေးပွဲ (Exam Mode)'}
                      </span>

                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">
                        <FileQuestion className="w-3 h-3 text-indigo-500" />
                        <span>{cleanQuestions.length} ပုဒ်</span>
                      </span>

                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">
                        <Clock className="w-3 h-3 text-amber-500" />
                        <span>ဖြေဆိုချိန် {quiz.durationMinutes} မိနစ် (စနှိပ်ချိန်မှစတွက်သည်)</span>
                      </span>

                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">
                        <Award className="w-3 h-3 text-emerald-500" />
                        <span>အောင်မှတ် {quiz.passingScore}%</span>
                      </span>

                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                        <Globe className="w-3 h-3" />
                        <span>
                          {tzMode === 'MMT'
                            ? '🇲🇲 မြန်မာစံတော်ချိန် (MMT · UTC+06:30)'
                            : '🌐 ဒေသစံတော်ချိန် (Local Time)'}
                        </span>
                      </span>

                      {quiz.enableFlashcards !== false && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                          <Layers className="w-3 h-3" />
                          <span>Flashcards ပါဝင်သည်</span>
                        </span>
                      )}

                      {(quiz.shuffleQuestions || quiz.shuffleOptions) && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300/80 dark:border-amber-800">
                          <Shuffle className="w-3 h-3" />
                          <span>
                            ကျပန်းမေးခွန်းစနစ် (
                            {quiz.shuffleQuestions && quiz.shuffleOptions
                              ? 'Questions + Choices Shuffle'
                              : quiz.shuffleQuestions
                              ? 'Questions Shuffle'
                              : 'Choices Shuffle'}
                            )
                          </span>
                        </span>
                      )}
                    </div>

                    <h4 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white leading-snug">
                      {quiz.title}
                    </h4>

                    {quiz.description && (
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                        {quiz.description}
                      </p>
                    )}

                    {/* Schedule Info Banner (if scheduledOpenAt / scheduledCloseAt or manual closed) */}
                    {(quiz.scheduledOpenAt || quiz.scheduledCloseAt || quiz.isOpen === false) && (
                      <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                        {quiz.scheduledOpenAt && (
                          <span className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 font-mono">
                            🟢 Exam စမည့်အချိန်: {formatScheduleDateTime(quiz.scheduledOpenAt, tzMode)}
                          </span>
                        )}
                        {quiz.scheduledCloseAt && (
                          <span className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 font-mono">
                            🛑 Exam ပိတ်မည့်အချိန်: {formatScheduleDateTime(quiz.scheduledCloseAt, tzMode)}
                          </span>
                        )}
                        {availability.detailText && !quiz.scheduledOpenAt && !quiz.scheduledCloseAt && (
                          <span className="text-rose-600 dark:text-rose-400">
                            {availability.detailText}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Active Student Countdown Strip on Exam Card */}
                    {isStudentSessionInProgress && activeStudentSession && (
                      <div
                        className={`p-3 rounded-2xl border flex flex-wrap items-center justify-between gap-2 text-xs ${
                          sessionRemainingSec <= 300
                            ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-700 text-rose-900 dark:text-rose-200'
                            : 'bg-indigo-50/90 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 text-indigo-950 dark:text-indigo-200'
                        }`}
                      >
                        <div className="flex items-center gap-2 font-extrabold">
                          <Clock className="w-4 h-4 shrink-0 animate-pulse" />
                          <span>
                            ⏳ သင် စတင်ဖြေဆိုနေဆဲဖြစ်သည် — လက်ကျန်ချိန် (Count Time):{' '}
                            <span className="font-mono text-sm underline">
                              {formatCountdownClock(sessionRemainingSec)}
                            </span>
                          </span>
                        </div>
                        <div className="text-[11px] font-mono">
                          စနှိပ်သည့်အချိန်: {activeStudentSession.startedAtMmt} · ပိတ်မည့်အချိန်:{' '}
                          {ClassroomDB.formatMyanmarDateTime(activeStudentSession.expiresAtMs, true)}
                        </div>
                        {sessionRemainingSec <= 300 && (
                          <div className="w-full text-[11px] font-extrabold text-rose-600 dark:text-rose-300 flex items-center gap-1">
                            <BellRing className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              ⚠️ သတိပေးချက်: သတ်မှတ်ချိန်ပြည့်ရန် (၅) မိနစ်အောက်သာ ကျန်ပါတော့သည်! အချိန်ပြည့်သည်နှင့် ဖြေဆိုခွင့် အလိုအလျောက် ပိတ်ပါမည်။
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Student Score Badge or Teacher Submission Count Box */}
                  {myLatestSub ? (
                    <div
                      className={`p-3.5 rounded-2xl border shrink-0 flex items-center gap-3 ${
                        myLatestSub.passed
                          ? 'bg-emerald-50/90 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-700'
                          : 'bg-amber-50/90 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700'
                      }`}
                    >
                      <div
                        className={`w-11 h-11 rounded-2xl flex items-center justify-center font-mono font-black text-sm text-white shrink-0 ${
                          myLatestSub.passed ? 'bg-emerald-600' : 'bg-amber-600'
                        }`}
                      >
                        {myLatestSub.score}%
                      </div>
                      <div className="text-xs space-y-0.5">
                        <div className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span>
                            ရမှတ်: {correctCount} / {cleanQuestions.length} မှတ်
                          </span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
                              myLatestSub.passed
                                ? 'bg-emerald-600 text-white'
                                : 'bg-amber-600 text-white'
                            }`}
                          >
                            {myLatestSub.passed ? 'PASS ✓' : 'RETRY'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                          {myLatestSub.autoSubmittedOnTimeout
                            ? '⏰ သတ်မှတ်ချိန်ပြည့်၍ အလိုအလျောက်ပိတ်ပြီး'
                            : 'ဖြေဆိုပြီး'}{' '}
                          · {myLatestSub.submittedAt}
                        </div>
                      </div>
                    </div>
                  ) : isInstructor ? (
                    <div
                      onClick={() => setScoreboardQuiz(quiz)}
                      className="neu-inset-sm p-3.5 rounded-2xl shrink-0 cursor-pointer hover:ring-2 hover:ring-indigo-500/40 transition-all flex items-center gap-3"
                      title="ကျောင်းသား ရမှတ်စာရင်းနှင့် အဖြေလွှာများ ကြည့်ရန်"
                    >
                      <div className="w-10 h-10 rounded-xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-mono font-extrabold text-xs">
                        {allQuizSubs.length}/{enrolledStudents.length}
                      </div>
                      <div className="text-xs">
                        <div className="font-extrabold text-slate-900 dark:text-white">
                          ဖြေဆိုပြီးသူ {allQuizSubs.length} ဦး
                        </div>
                        <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold">
                          အမှတ်စာရင်းကြည့်ရန် →
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* Action Buttons Footer */}
                <div className="pt-3 border-t border-slate-200/60 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Student or Teacher Take / Retake Exam Button */}
                    {canStudentTakeQuiz ? (
                      <button
                        type="button"
                        onClick={() => setActiveTakeQuiz(quiz)}
                        className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        {isStudentSessionInProgress ? (
                          <>
                            <Clock className="w-3.5 h-3.5 animate-pulse" />
                            <span>
                              ဆက်လက်ဖြေဆိုမည် (လက်ကျန်ချိန် {formatCountdownClock(sessionRemainingSec)})
                            </span>
                          </>
                        ) : myLatestSub ? (
                          <>
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>ပြန်လည်လေ့ကျင့်ဖြေဆိုမည် (Retake Exam)</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>
                              {isInstructor
                                ? 'စမ်းသပ်ဖြေဆိုကြည့်မည် (Preview Exam)'
                                : 'ဖြေဆိုမည် (Start Exam)'}
                            </span>
                          </>
                        )}
                      </button>
                    ) : isStudentSessionExpiredOrLocked ? (
                      <div className="px-3.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-extrabold flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                        <span>
                          {myLatestSub?.autoSubmittedOnTimeout
                            ? `သတ်မှတ်ချိန် (${quiz.durationMinutes} မိနစ်) ပြည့်သွားသဖြင့် ဖြေဆိုခွင့် ပိတ်သိမ်းထားပါသည်`
                            : 'ဖြေဆိုပြီးသားဖြစ်သဖြင့် Exam Form ဖြေဆိုခွင့် ပိတ်ထားပါသည်'}
                        </span>
                      </div>
                    ) : (
                      !myLatestSub && (
                        <div className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-rose-500" />
                          <span>
                            {availability.detailText || 'စာမေးပွဲ ဖြေဆိုရန် ပိတ်ထားပါသည်'}
                          </span>
                        </div>
                      )
                    )}

                    {/* View Score & Correct Answers Button (Shown immediately after student submits!) */}
                    {myLatestSub && (
                      <button
                        type="button"
                        onClick={() =>
                          setReviewModalData({
                            quiz,
                            submission: myLatestSub,
                          })
                        }
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>
                          အမှတ်နှင့် အဖြေမှန်များ ကြည့်ရန် ({correctCount}/{cleanQuestions.length})
                        </span>
                      </button>
                    )}

                    {/* Flashcard Mode Button */}
                    {quiz.enableFlashcards !== false &&
                      cleanQuestions.length > 0 &&
                      (isInstructor || availability.isAvailable) && (
                        <button
                          type="button"
                          onClick={() => setActiveFlashcardQuiz(quiz)}
                          className="px-3.5 py-2 rounded-xl bg-purple-50 dark:bg-purple-950/70 hover:bg-purple-100 dark:hover:bg-purple-900/70 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <Layers className="w-3.5 h-3.5" />
                          <span>🃏 ကတ်ပြားဖြင့် လေ့ကျင့်မည် (Flashcards)</span>
                        </button>
                      )}
                  </div>

                  {/* Teacher Management Controls */}
                  {isInstructor && (
                    <div className="flex flex-wrap items-center gap-2">
                      {/* 1-Click Exam On/Off Switch */}
                      <button
                        type="button"
                        onClick={() => handleToggleExamOpen(quiz)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 cursor-pointer transition-colors border ${
                          quiz.isOpen === false
                            ? 'bg-rose-50 dark:bg-rose-950/70 hover:bg-rose-100 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-700'
                            : 'bg-emerald-50 dark:bg-emerald-950/70 hover:bg-emerald-100 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                        }`}
                        title="စာမေးပွဲကို ချက်ချင်း အဖွင့် / အပိတ် (On/Off) ပြုလုပ်ရန်"
                      >
                        <span>
                          {quiz.isOpen === false
                            ? '🔒 Exam ပိတ်ထားသည် (နှိပ်၍ ဖွင့်မည်)'
                            : '🟢 Exam ဖွင့်ထားသည် (နှိပ်၍ ပိတ်မည်)'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setScoreboardQuiz(quiz)}
                        className="px-3.5 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/70 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>
                          📊 အမှတ်စာရင်းနှင့် အဖြေလွှာများ ({allQuizSubs.length}/
                          {enrolledStudents.length})
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setReviewModalData({
                            quiz,
                            isAnswerKeyOnly: true,
                          })
                        }
                        className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                        title="မေးခွန်းနှင့် အဖြေမှန်များ အားလုံးကြည့်ရန် (Teacher Answer Key)"
                      >
                        <KeyRound className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        <span>အဖြေမှန်စာရင်း (Answer Key)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setEditorQuiz(quiz)}
                        className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-slate-600 dark:text-slate-300 hover:text-indigo-600 text-xs font-bold cursor-pointer transition-colors"
                        title="မေးခွန်းနှင့် Schedule ပြင်ဆင်ရန် (Edit Exam)"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeleteConfirmQuiz(quiz)}
                        className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/60 text-slate-600 dark:text-slate-300 hover:text-rose-600 text-xs font-bold cursor-pointer transition-colors"
                        title="စာမေးပွဲ ဖျက်သိမ်းရန် (Delete Exam)"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 1. Take Quiz / Exam Modal */}
      {activeTakeQuiz && (
        <TakeQuizModal
          quiz={activeTakeQuiz}
          currentUser={currentUser}
          onClose={() => setActiveTakeQuiz(null)}
          onSubmitted={(submission) => {
            const completedQuiz = activeTakeQuiz;
            setActiveTakeQuiz(null);
            setRefreshTick((t) => t + 1);
            onRefresh();
            // Automatically open the Graded Results & Correct Answers screen immediately after submitting!
            setReviewModalData({
              quiz: completedQuiz,
              submission,
            });
          }}
        />
      )}

      {/* 2. Review Answers, Explanations & Score Modal (For both Student & Teacher) */}
      {reviewModalData && (
        <QuizAnswerReviewModal
          quiz={reviewModalData.quiz}
          submission={reviewModalData.submission}
          isAnswerKeyOnly={reviewModalData.isAnswerKeyOnly}
          currentUser={currentUser}
          onClose={() => setReviewModalData(null)}
          onRetake={
            reviewModalData.quiz.mode === 'practice' && !reviewModalData.isAnswerKeyOnly
              ? () => {
                  const q = reviewModalData.quiz;
                  setReviewModalData(null);
                  setActiveTakeQuiz(q);
                }
              : undefined
          }
        />
      )}

      {/* 3. Teacher Live Scoreboard & Student Answer Inspector Modal */}
      {scoreboardQuiz && isInstructor && (
        <TeacherQuizScoreboardModal
          quiz={scoreboardQuiz}
          course={course}
          enrolledStudents={enrolledStudents}
          currentUser={currentUser}
          onClose={() => setScoreboardQuiz(null)}
          onInspectStudentSubmission={(sub) => {
            setReviewModalData({
              quiz: scoreboardQuiz,
              submission: sub,
            });
          }}
          onDataChanged={() => {
            setRefreshTick((t) => t + 1);
            onRefresh();
          }}
        />
      )}

      {/* 4. Interactive 3D Flashcards Modal */}
      {activeFlashcardQuiz && (
        <FlashcardsPracticeModal
          quiz={activeFlashcardQuiz}
          onClose={() => setActiveFlashcardQuiz(null)}
        />
      )}

      {/* 5. Teacher Create / Edit Quiz Modal */}
      {editorQuiz && isInstructor && (
        <QuizEditorModal
          course={course}
          currentUser={currentUser}
          initialQuiz={editorQuiz === 'new' ? undefined : editorQuiz}
          onClose={() => setEditorQuiz(null)}
          onSaved={() => {
            setEditorQuiz(null);
            setRefreshTick((t) => t + 1);
            onRefresh();
          }}
        />
      )}

      {/* 5b. Teacher Create / Edit Student Data Collection Form Modal */}
      {editorDataForm && isInstructor && (
        <DataFormEditorModal
          course={course}
          currentUser={currentUser}
          initialForm={editorDataForm === 'new' ? undefined : editorDataForm}
          onClose={() => setEditorDataForm(null)}
          onSaved={() => {
            setEditorDataForm(null);
            setRefreshTick((t) => t + 1);
            onRefresh();
          }}
        />
      )}

      {/* 5c. Student Fill Data Collection Form Modal */}
      {activeFillDataForm && (
        <StudentDataFormFillModal
          form={activeFillDataForm}
          course={course}
          currentUser={currentUser}
          existingSubmission={
            ClassroomDB.getQuizSubmissions(activeFillDataForm.id, currentUser.id)[0]
          }
          onClose={() => setActiveFillDataForm(null)}
          onSubmitted={() => {
            setRefreshTick((t) => t + 1);
            onRefresh();
          }}
        />
      )}

      {/* 5d. Teacher Data Form Responses & PDF / Excel Export Modal */}
      {responsesDataForm && isInstructor && (
        <DataFormResponsesModal
          form={responsesDataForm}
          course={course}
          enrolledStudents={enrolledStudents}
          currentUser={currentUser}
          onClose={() => setResponsesDataForm(null)}
          onRefresh={() => {
            setRefreshTick((t) => t + 1);
            onRefresh();
          }}
        />
      )}

      {/* 6. Delete Confirmation Modal */}
      {deleteConfirmQuiz && isInstructor && (
        <div
          onClick={() => setDeleteConfirmQuiz(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Quiz / စာမေးပွဲ ဖျက်သိမ်းရန် အတည်ပြုပါ
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                  <strong>"{deleteConfirmQuiz.title}"</strong> နှင့် ၎င်း၏ ကျောင်းသားအမှတ်စာရင်းအားလုံးကို App နှင့် Supabase SQL Database ထဲမှ အပြီးတိုင် ဖျက်သိမ်းလိုပါသလား?
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeleteConfirmQuiz(null)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 cursor-pointer"
              >
                မဖျက်တော့ပါ
              </button>
              <button
                type="button"
                onClick={() => {
                  ClassroomDB.deleteQuiz(deleteConfirmQuiz.id, currentUser);
                  setDeleteConfirmQuiz(null);
                  setRefreshTick((t) => t + 1);
                  onRefresh();
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>ဖျက်သိမ်းမည် (Delete)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ============================================================================
 * 1. TAKE QUIZ / EXAM MODAL (Per-Student Timer, 5-Min Warning & Auto-Lock)
 * ============================================================================ */
const TakeQuizModal: React.FC<{
  quiz: Quiz;
  currentUser: User;
  onClose: () => void;
  onSubmitted: (submission: QuizSubmission) => void;
}> = ({ quiz, currentUser, onClose, onSubmitted }) => {
  const rawQuestions = useMemo(
    () => (quiz.questions || []).filter((q) => q && q.id !== '__quiz_meta__'),
    [quiz.questions]
  );

  // Initialize or resume per-student individual exam session anchored to their click timestamp
  const [session] = useState(() => {
    const existingSubs = ClassroomDB.getQuizSubmissions(quiz.id, currentUser.id);
    const existingSession = ClassroomDB.getStudentExamSession(quiz, currentUser.id);
    const shouldStartFresh =
      (quiz.mode === 'practice' &&
        (existingSubs.length > 0 ||
          !existingSession ||
          existingSession.isLockedOut ||
          Date.now() >= existingSession.expiresAtMs)) ||
      ((currentUser.role === 'admin' || currentUser.role === 'co_admin') &&
        (!existingSession ||
          existingSession.isLockedOut ||
          Date.now() >= existingSession.expiresAtMs));
    return ClassroomDB.startOrResumeStudentExamSession(quiz, currentUser.id, shouldStartFresh);
  });

  // Apply deterministic per-student question order shuffle when quiz.shuffleQuestions is enabled
  const questions = useMemo(() => {
    if (!quiz.shuffleQuestions) return rawQuestions;
    return seededShuffleArray(
      rawQuestions,
      `qshuffle|${quiz.id}|${currentUser.id}|${session.startedAtMs}`
    );
  }, [rawQuestions, quiz.shuffleQuestions, quiz.id, currentUser.id, session.startedAtMs]);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>(
    () => session.draftAnswers || {}
  );
  const answersRef = useRef<Record<string, number>>(session.draftAnswers || {});
  const hasSubmittedRef = useRef(false);

  const totalDurationSeconds = Math.max(60, (session.durationMinutes || quiz.durationMinutes || 20) * 60);
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.ceil((session.expiresAtMs - Date.now()) / 1000))
  );
  const [showFiveMinPopup, setShowFiveMinPopup] = useState(false);
  const [fiveMinWarningTriggered, setFiveMinWarningTriggered] = useState(
    () => Boolean(session.fiveMinWarningShown)
  );
  const [isTimeExpiredLocked, setIsTimeExpiredLocked] = useState(
    () => Boolean(session.isLockedOut || Date.now() >= session.expiresAtMs)
  );
  const [autoLockedSubmission, setAutoLockedSubmission] = useState<QuizSubmission | null>(null);
  const [showConfirmUnanswered, setShowConfirmUnanswered] = useState(false);

  // Sync draft answers to student session whenever an answer is selected
  useEffect(() => {
    answersRef.current = answers;
    if (!hasSubmittedRef.current && !isTimeExpiredLocked) {
      ClassroomDB.updateStudentExamSessionDraft(
        quiz.id,
        currentUser.id,
        answers,
        fiveMinWarningTriggered
      );
    }
  }, [answers, fiveMinWarningTriggered, quiz.id, currentUser.id, isTimeExpiredLocked]);

  const executeSubmit = (isTimeoutAutoClose: boolean) => {
    if (hasSubmittedRef.current) return;
    hasSubmittedRef.current = true;
    const now = Date.now();
    const elapsedSec = isTimeoutAutoClose
      ? totalDurationSeconds
      : Math.max(1, Math.min(totalDurationSeconds, Math.round((now - session.startedAtMs) / 1000)));

    const result = ClassroomDB.submitQuiz(
      quiz,
      answersRef.current,
      currentUser,
      elapsedSec,
      {
        startedAtMs: session.startedAtMs,
        startedAtMmt: session.startedAtMmt,
        autoSubmittedOnTimeout: isTimeoutAutoClose,
      }
    );

    if (isTimeoutAutoClose) {
      ClassroomDB.lockStudentExamSession(quiz.id, currentUser.id);
      setIsTimeExpiredLocked(true);
      setAutoLockedSubmission(result.submission);
      playExamWarningTone('time_up');
    } else {
      onSubmitted(result.submission);
    }
  };

  // Authoritative 250ms clock check against session.expiresAtMs so background tabs never drift
  useEffect(() => {
    const tick = () => {
      const rem = Math.max(0, Math.ceil((session.expiresAtMs - Date.now()) / 1000));
      setSecondsLeft(rem);
      if (rem <= 0 && !hasSubmittedRef.current) {
        executeSubmit(true);
      }
    };
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [session.expiresAtMs]);

  // Trigger 5-Minute Warning Notification (သတ်မှတ်ချိန် မပြည့်ခင် ၅ မိနစ်အလို သတိပေးချက်)
  useEffect(() => {
    if (
      secondsLeft > 0 &&
      secondsLeft <= 300 &&
      !fiveMinWarningTriggered &&
      !isTimeExpiredLocked
    ) {
      setFiveMinWarningTriggered(true);
      setShowFiveMinPopup(true);
      ClassroomDB.updateStudentExamSessionDraft(
        quiz.id,
        currentUser.id,
        answersRef.current,
        true
      );
      playExamWarningTone('five_min');
    }
  }, [secondsLeft, fiveMinWarningTriggered, isTimeExpiredLocked, quiz.id, currentUser.id]);

  if (questions.length === 0) return null;

  const currentQ = questions[currentIdx] || questions[0];
  const answeredCount = Object.keys(answers).length;
  const remainingPct = Math.min(100, Math.max(0, (secondsLeft / totalDurationSeconds) * 100));
  const isFiveMinWarningZone = secondsLeft > 0 && secondsLeft <= 300;
  const isOneMinCriticalZone = secondsLeft > 0 && secondsLeft <= 60;
  const expiresAtMmtLabel = ClassroomDB.formatMyanmarDateTime(session.expiresAtMs, true);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl max-h-[95dvh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
        {/* Live Countdown Progress Bar at Top Edge */}
        <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 shrink-0 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              isTimeExpiredLocked || isOneMinCriticalZone
                ? 'bg-rose-600'
                : isFiveMinWarningZone
                ? 'bg-amber-500'
                : 'bg-emerald-500'
            }`}
            style={{ width: `${isTimeExpiredLocked ? 0 : remainingPct}%` }}
          />
        </div>

        {/* Exam Header with Live Count Time */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate">
                {quiz.title}
              </h3>
              {(quiz.shuffleQuestions || quiz.shuffleOptions) && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 text-[10px] font-extrabold">
                  <Shuffle className="w-3 h-3" />
                  <span>Anti-Cheat ကျပန်းမေးခွန်းစနစ်</span>
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
              <span>
                ဖြေဆိုပြီး: <strong>{answeredCount}/{questions.length}</strong> ပုဒ်
              </span>
              <span>· သတ်မှတ်ကြာချိန်: {session.durationMinutes} မိနစ်</span>
              <span>· အောင်မှတ်: {quiz.passingScore}%</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Live Count Time Display */}
            <div
              className={`px-3.5 py-2 rounded-2xl font-mono text-xs sm:text-sm font-black flex items-center gap-2 border shadow-xs ${
                isTimeExpiredLocked
                  ? 'bg-rose-700 text-white border-rose-700'
                  : isOneMinCriticalZone
                  ? 'bg-rose-600 text-white border-rose-600 animate-pulse'
                  : isFiveMinWarningZone
                  ? 'bg-amber-500 text-slate-950 border-amber-600 animate-pulse'
                  : 'bg-indigo-600 text-white border-indigo-600'
              }`}
              title="လက်ကျန်ဖြေဆိုချိန် (Live Countdown Timer)"
            >
              <Clock className="w-4 h-4 shrink-0" />
              <div className="flex flex-col leading-tight">
                <span className="text-[9px] uppercase tracking-wider opacity-90 font-sans font-extrabold">
                  {isTimeExpiredLocked ? 'အချိန်ပြည့်ပြီ' : 'Count Time'}
                </span>
                <span className="text-sm sm:text-base tracking-tight">
                  {formatCountdownClock(secondsLeft)}
                </span>
              </div>
            </div>

            {!isTimeExpiredLocked && (
              <button
                type="button"
                onClick={onClose}
                className="px-2.5 py-2 rounded-xl bg-slate-200/70 dark:bg-slate-800 hover:bg-rose-100 text-slate-600 dark:text-slate-300 hover:text-rose-600 text-xs font-bold cursor-pointer"
                title="ခေတ္တပိတ်မည် (Timer သည် နောက်ကွယ်တွင် ဆက်လက်မှတ်သားနေပါမည်)"
              >
                ✕ ပိတ်မည်
              </button>
            )}
          </div>
        </div>

        {/* Per-Student Start Time & Expiry Time Bar (Myanmar Standard Time MMT) */}
        <div className="px-4 sm:px-6 py-2 bg-indigo-50/70 dark:bg-indigo-950/40 border-b border-indigo-100 dark:border-indigo-900/60 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-700 dark:text-slate-300 shrink-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>
              🟢 စနှိပ်သည့်အချိန်: <strong>{session.startedAtMmt}</strong>
            </span>
            <span>
              🛑 ပိတ်မည့်အချိန်: <strong className="text-rose-600 dark:text-rose-400">{expiresAtMmtLabel}</strong>
            </span>
          </div>
          <span className="text-[10px] font-sans font-bold text-indigo-700 dark:text-indigo-300">
            🇲🇲 မြန်မာစံတော်ချိန် (MMT · UTC+06:30)
          </span>
        </div>

        {/* Persistent 5-Minute Warning Banner (Shown throughout the last 5 minutes) */}
        {isFiveMinWarningZone && !isTimeExpiredLocked && (
          <div
            className={`px-4 sm:px-6 py-2.5 border-b flex items-center justify-between gap-3 shrink-0 ${
              isOneMinCriticalZone
                ? 'bg-rose-600 text-white border-rose-700'
                : 'bg-amber-100 dark:bg-amber-950/90 text-amber-950 dark:text-amber-100 border-amber-300 dark:border-amber-700'
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-extrabold">
              <BellRing className="w-4 h-4 shrink-0 animate-bounce" />
              <span>
                ⚠️ သတိပေးချက် — သတ်မှတ်ဖြေဆိုချိန် ပြည့်ခါနီးပါပြီ! လက်ကျန်ချိန်{' '}
                <span className="font-mono underline px-1">
                  {formatCountdownClock(secondsLeft)}
                </span>{' '}
                သာ ကျန်ပါတော့သည်။ အချိန်ပြည့်သည်နှင့် Exam Form ဖြေဆိုခွင့် အလိုအလျောက် ပိတ်သိမ်းသွားပါမည်။
              </span>
            </div>
          </div>
        )}

        {/* Pop-up 5-Minute Alert Card when crossing the 5-minute mark */}
        {showFiveMinPopup && !isTimeExpiredLocked && (
          <div className="mx-4 sm:mx-6 mt-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950 border-2 border-amber-500 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-0.5 text-xs">
                <div className="font-black text-amber-950 dark:text-amber-100 text-sm">
                  ⏰ ၅ မိနစ် သတိပေးချက် — ဖြေဆိုချိန် ပြည့်ခါနီးပြီဖြစ်ပါသည်!
                </div>
                <p className="text-amber-900 dark:text-amber-200 leading-relaxed">
                  သတ်မှတ်ဖြေဆိုချိန် ပြည့်ရန်{' '}
                  <strong className="font-mono">{formatCountdownClock(secondsLeft)}</strong> သာ
                  ကျန်ပါတော့သည်။ သတ်မှတ်ချိန် ပြည့်သည်နှင့် Exam Form သည် အလိုအလျောက် ဖြေဆိုခွင့် ပိတ်သွားမည်ဖြစ်ပါသဖြင့် မိမိအဖြေများကို အမြန်ဆုံး စစ်ဆေးဖြေဆိုပေးပါ။
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowFiveMinPopup(false)}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold shrink-0 cursor-pointer"
            >
              သိရှိပါပြီ၊ ဆက်ဖြေမည်
            </button>
          </div>
        )}

        {/* Question Number Pills */}
        {!isTimeExpiredLocked && (
          <div className="px-4 sm:px-6 py-2.5 bg-slate-100/70 dark:bg-slate-900 border-b border-slate-200/70 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto shrink-0">
            {questions.map((q, idx) => {
              const isAnswered = answers[q.id] !== undefined;
              const isCurrent = idx === currentIdx;
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setCurrentIdx(idx)}
                  className={`w-7 h-7 rounded-lg font-mono text-xs font-extrabold shrink-0 transition-all cursor-pointer ${
                    isCurrent
                      ? 'bg-indigo-600 text-white ring-2 ring-indigo-400 scale-105'
                      : isAnswered
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700'
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        )}

        {/* Main Body: Locked Screen if Time Expired, otherwise Question Form */}
        {isTimeExpiredLocked ? (
          <div className="p-6 sm:p-10 overflow-y-auto flex-1 flex flex-col items-center justify-center text-center space-y-5">
            <div className="w-16 h-16 rounded-3xl bg-rose-100 dark:bg-rose-950/80 border-2 border-rose-500 text-rose-600 dark:text-rose-400 flex items-center justify-center shadow-md">
              <Lock className="w-8 h-8" />
            </div>

            <div className="space-y-2 max-w-lg">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 text-xs font-extrabold">
                ⏰ သတ်မှတ်ဖြေဆိုချိန် ({session.durationMinutes} မိနစ်) ပြည့်သွားပါပြီ
              </span>
              <h4 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                Exam Form ဖြေဆိုခွင့် အလိုအလျောက် ပိတ်သိမ်းလိုက်ပါပြီ
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                သင် စတင်နှိပ်ခဲ့သည့်အချိန် (<strong>{session.startedAtMmt}</strong>) မှစ၍ သတ်မှတ်ကြာချိန်{' '}
                <strong>{session.durationMinutes} မိနစ်</strong> ပြည့်သွားပြီဖြစ်သောကြောင့် Exam Form
                ကို ဆက်လက်ဖြေဆိုခွင့် ပိတ်သိမ်းပြီး သင်ရွေးချယ်ထားသော အဖြေ ({answeredCount}/{questions.length} ပုဒ်)
                ကို စနစ်မှ အလိုအလျောက် အမှတ်စစ်ဆေး သိမ်းဆည်းပေးထားပါသည်။
              </p>
            </div>

            <div className="w-full max-w-md p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs space-y-2 font-mono text-left">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">စတင်ဖြေဆိုချိန်:</span>
                <span className="font-bold text-slate-900 dark:text-white">{session.startedAtMmt}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">ဖြေဆိုခွင့်ပိတ်ချိန်:</span>
                <span className="font-bold text-rose-600 dark:text-rose-400">{expiresAtMmtLabel}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">ဖြေဆိုခဲ့သော မေးခွန်း:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {answeredCount} / {questions.length} ပုဒ်
                </span>
              </div>
              {autoLockedSubmission && (
                <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500">ရရှိသော ရမှတ်:</span>
                  <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                    {autoLockedSubmission.score}% ({autoLockedSubmission.correctCount}/{questions.length} မှတ်)
                  </span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                if (autoLockedSubmission) {
                  onSubmitted(autoLockedSubmission);
                } else {
                  const latest = ClassroomDB.getQuizSubmissions(quiz.id, currentUser.id)[0];
                  if (latest) onSubmitted(latest);
                  else onClose();
                }
              }}
              className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-extrabold shadow-md flex items-center gap-2 cursor-pointer"
            >
              <Eye className="w-4 h-4" />
              <span>ရမှတ်နှင့် အဖြေမှန်များ ကြည့်ရှုမည် →</span>
            </button>
          </div>
        ) : (
          <>
            {/* Question Body */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
              <div className="space-y-1.5">
                <span className="inline-block text-[11px] font-mono font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  မေးခွန်း အမှတ်စဉ် ({currentIdx + 1} / {questions.length})
                </span>
                <div className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white leading-relaxed whitespace-pre-line">
                  {currentQ.question}
                </div>
              </div>

              <div className="space-y-2.5 pt-1">
                {(() => {
                  const baseOptionEntries = currentQ.options.map((optText, origIdx) => ({
                    text: optText,
                    originalIdx: origIdx,
                  }));
                  const displayOptions = quiz.shuffleOptions
                    ? seededShuffleArray(
                        baseOptionEntries,
                        `oshuffle|${quiz.id}|${currentUser.id}|${session.startedAtMs}|${currentQ.id}`
                      )
                    : baseOptionEntries;

                  return displayOptions.map((entry, displayIdx) => {
                    const isSelected = answers[currentQ.id] === entry.originalIdx;
                    return (
                      <button
                        key={entry.originalIdx}
                        type="button"
                        disabled={isTimeExpiredLocked}
                        onClick={() => {
                          if (isTimeExpiredLocked) return;
                          setAnswers((prev) => ({
                            ...prev,
                            [currentQ.id]: entry.originalIdx,
                          }));
                        }}
                        className={`w-full p-3.5 sm:p-4 rounded-2xl border-2 text-left transition-all cursor-pointer flex items-start gap-3 ${
                          isSelected
                            ? 'bg-indigo-50 dark:bg-indigo-950/70 border-indigo-600 dark:border-indigo-400 text-indigo-950 dark:text-white shadow-xs'
                            : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:border-indigo-300 text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        <span
                          className={`w-7 h-7 rounded-xl font-mono text-xs font-extrabold flex items-center justify-center shrink-0 ${
                            isSelected
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {OPTION_LABELS[displayIdx] || displayIdx + 1}
                        </span>
                        <span className="text-xs sm:text-sm font-semibold leading-relaxed pt-0.5 break-words flex-1">
                          {entry.text}
                        </span>
                      </button>
                    );
                  });
                })()}
              </div>

              {showConfirmUnanswered && (
                <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-700 text-xs text-amber-900 dark:text-amber-200 space-y-2">
                  <div className="font-extrabold">
                    ⚠️ မေးခွန်း ({questions.length - answeredCount}) ပုဒ် ဖြေဆိုရန် ကျန်နေပါသေးသည်!
                  </div>
                  <p>မဖြေရသေးသော မေးခွန်းများအတိုင်း အဖြေလွှာကို ယခု တန်းအပ်လိုပါသလား?</p>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowConfirmUnanswered(false)}
                      className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold cursor-pointer"
                    >
                      ပြန်စစ်မည်
                    </button>
                    <button
                      type="button"
                      onClick={() => executeSubmit(false)}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white font-extrabold cursor-pointer"
                    >
                      သေချာပါသည်၊ အဖြေလွှာအပ်မည်
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Exam Footer Navigation */}
            <div className="px-4 sm:px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex items-center justify-between gap-2 shrink-0">
              <button
                type="button"
                disabled={currentIdx === 0}
                onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
                className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 disabled:opacity-40 flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>ရှေ့တစ်ပုဒ်</span>
              </button>

              <div className="flex items-center gap-2">
                {currentIdx < questions.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentIdx((i) => Math.min(questions.length - 1, i + 1))}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold flex items-center gap-1 cursor-pointer"
                  >
                    <span>နောက်တစ်ပုဒ်</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => {
                    if (answeredCount < questions.length) {
                      setShowConfirmUnanswered(true);
                    } else {
                      executeSubmit(false);
                    }
                  }}
                  className="px-4 sm:px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>အဖြေလွှာအပ်မည် ({answeredCount}/{questions.length})</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

/* ============================================================================
 * 2. GRADED ANSWER SHEET & CORRECT ANSWERS REVIEW MODAL (Teacher & Student)
 * ============================================================================ */
const QuizAnswerReviewModal: React.FC<{
  quiz: Quiz;
  submission?: QuizSubmission;
  isAnswerKeyOnly?: boolean;
  currentUser: User;
  onClose: () => void;
  onRetake?: () => void;
}> = ({ quiz, submission, isAnswerKeyOnly, currentUser, onClose, onRetake }) => {
  const [filterMode, setFilterMode] = useState<'all' | 'correct' | 'wrong'>('all');
  const questions = useMemo(
    () => (quiz.questions || []).filter((q) => q && q.id !== '__quiz_meta__'),
    [quiz.questions]
  );

  const stats = useMemo(() => {
    if (!submission || isAnswerKeyOnly) {
      return {
        correct: questions.length,
        wrong: 0,
        score: 100,
        passed: true,
      };
    }
    let correct = 0;
    questions.forEach((q) => {
      if (submission.answers?.[q.id] === q.correctIndex) {
        correct++;
      }
    });
    const wrong = questions.length - correct;
    return {
      correct,
      wrong,
      score: submission.score,
      passed: submission.passed,
    };
  }, [questions, submission, isAnswerKeyOnly]);

  const filteredQuestions = useMemo(() => {
    return questions
      .map((q, index) => ({ q, index }))
      .filter(({ q }) => {
        if (!submission || isAnswerKeyOnly || filterMode === 'all') return true;
        const isCorrect = submission.answers?.[q.id] === q.correctIndex;
        return filterMode === 'correct' ? isCorrect : !isCorrect;
      });
  }, [questions, submission, isAnswerKeyOnly, filterMode]);

  const isViewingOwn = submission?.studentId === currentUser.id;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-4xl max-h-[94dvh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden"
      >
        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                {isAnswerKeyOnly
                  ? '🔑 ဆရာသုံး အဖြေမှန်စာရင်း (Answer Key)'
                  : isViewingOwn
                  ? '📊 မိမိရမှတ်နှင့် အဖြေမှန် တိုက်ဆိုင်စစ်ဆေးချက်'
                  : `👤 ${submission?.studentName} ၏ အဖြေလွှာနှင့် ရမှတ်`}
              </span>
            </div>
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate mt-1">
              {quiz.title}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl bg-slate-200/80 dark:bg-slate-800 hover:bg-rose-100 text-slate-700 dark:text-slate-200 hover:text-rose-600 text-xs font-extrabold cursor-pointer shrink-0"
          >
            ✕ ပိတ်မည်
          </button>
        </div>

        {/* Score Summary Banner (When viewing a submission) */}
        {submission && !isAnswerKeyOnly && (
          <div
            className={`px-4 sm:px-6 py-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 ${
              stats.passed
                ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60'
                : 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <div
                className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center text-white font-mono shadow-sm shrink-0 ${
                  stats.passed ? 'bg-emerald-600' : 'bg-amber-600'
                }`}
              >
                <span className="text-lg font-black leading-none">{stats.score}%</span>
                <span className="text-[9px] font-bold uppercase mt-0.5">
                  {stats.passed ? 'PASS' : 'SCORE'}
                </span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white flex flex-wrap items-center gap-2">
                  <span>{submission.studentName}</span>
                  <span className="text-emerald-700 dark:text-emerald-300 font-mono">
                    ({stats.correct} / {questions.length} မှတ်)
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600 dark:text-slate-300 font-mono">
                  <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                    ✓ အဖြေမှန်: {stats.correct} ပုဒ်
                  </span>
                  <span className="text-rose-600 dark:text-rose-400 font-bold">
                    ✗ အဖြေမှား: {stats.wrong} ပုဒ်
                  </span>
                  {submission.timeSpentSeconds ? (
                    <span>⏱ ကြာချိန်: {formatDurationSeconds(submission.timeSpentSeconds)}</span>
                  ) : null}
                  {submission.startedAtMmt ? (
                    <span>🟢 စနှိပ်ချိန်: {submission.startedAtMmt}</span>
                  ) : null}
                  <span>📅 အပ်နှံချိန်: {submission.submittedAt}</span>
                  {submission.autoSubmittedOnTimeout ? (
                    <span className="px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-bold">
                      ⏰ သတ်မှတ်ချိန်ပြည့်၍ အလိုအလျောက်ပိတ်သိမ်းခဲ့သည်
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                  filterMode === 'all'
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                    : 'bg-white/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                အားလုံး ({questions.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('correct')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                  filterMode === 'correct'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white/80 dark:bg-slate-800 text-emerald-700 dark:text-emerald-300'
                }`}
              >
                ✓ အမှန် ({stats.correct})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('wrong')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                  filterMode === 'wrong'
                    ? 'bg-rose-600 text-white'
                    : 'bg-white/80 dark:bg-slate-800 text-rose-600 dark:text-rose-300'
                }`}
              >
                ✗ အမှား ({stats.wrong})
              </button>
            </div>
          </div>
        )}

        {/* Question-by-Question Answer Breakdown */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {filteredQuestions.map(({ q, index }) => {
            const selectedOption =
              submission && !isAnswerKeyOnly ? submission.answers?.[q.id] : undefined;
            const isCorrect =
              isAnswerKeyOnly || (selectedOption !== undefined && selectedOption === q.correctIndex);
            const isUnanswered = !isAnswerKeyOnly && selectedOption === undefined;

            return (
              <div
                key={q.id}
                className={`p-4 sm:p-5 rounded-2xl border-2 space-y-3 ${
                  isAnswerKeyOnly
                    ? 'bg-slate-50/70 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
                    : isCorrect
                    ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/70'
                    : 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800/70'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white leading-relaxed">
                    <span className="font-mono text-indigo-600 dark:text-indigo-400 mr-1.5">
                      #{index + 1}.
                    </span>
                    {q.question}
                  </div>

                  {!isAnswerKeyOnly && (
                    <span
                      className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold shrink-0 inline-flex items-center gap-1 ${
                        isCorrect
                          ? 'bg-emerald-600 text-white'
                          : isUnanswered
                          ? 'bg-slate-500 text-white'
                          : 'bg-rose-600 text-white'
                      }`}
                    >
                      {isCorrect ? (
                        <>
                          <Check className="w-3 h-3" />
                          <span>အဖြေမှန် (+1)</span>
                        </>
                      ) : isUnanswered ? (
                        <span>မဖြေဆိုခဲ့ပါ (0)</span>
                      ) : (
                        <>
                          <X className="w-3 h-3" />
                          <span>အဖြေမှား (0)</span>
                        </>
                      )}
                    </span>
                  )}
                </div>

                {/* Options with Clear Visual Highlighting for Student Pick & Correct Answer */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {q.options.map((opt, oIdx) => {
                    const isRightAnswer = oIdx === q.correctIndex;
                    const isStudentPicked = !isAnswerKeyOnly && selectedOption === oIdx;

                    let cardStyle =
                      'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300';
                    if (isRightAnswer) {
                      cardStyle =
                        'bg-emerald-100/90 dark:bg-emerald-950/80 border-2 border-emerald-500 text-emerald-950 dark:text-emerald-100 font-bold';
                    } else if (isStudentPicked && !isRightAnswer) {
                      cardStyle =
                        'bg-rose-100/90 dark:bg-rose-950/80 border-2 border-rose-500 text-rose-950 dark:text-rose-100 font-bold';
                    }

                    return (
                      <div
                        key={oIdx}
                        className={`p-3 rounded-xl border text-xs flex items-start justify-between gap-2 ${cardStyle}`}
                      >
                        <div className="flex items-start gap-2 min-w-0">
                          <span
                            className={`w-5 h-5 rounded-md font-mono text-[11px] font-extrabold flex items-center justify-center shrink-0 ${
                              isRightAnswer
                                ? 'bg-emerald-600 text-white'
                                : isStudentPicked
                                ? 'bg-rose-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {OPTION_LABELS[oIdx] || oIdx + 1}
                          </span>
                          <span className="leading-relaxed break-words">{opt}</span>
                        </div>

                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {isRightAnswer && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-extrabold whitespace-nowrap">
                              ✓ အဖြေမှန်
                            </span>
                          )}
                          {isStudentPicked && !isRightAnswer && (
                            <span className="px-2 py-0.5 rounded-md bg-rose-600 text-white text-[10px] font-extrabold whitespace-nowrap">
                              ✗ ရွေးချယ်ခဲ့သောအဖြေ
                            </span>
                          )}
                          {isStudentPicked && isRightAnswer && (
                            <span className="px-2 py-0.5 rounded-md bg-indigo-600 text-white text-[10px] font-extrabold whitespace-nowrap">
                              သင်ရွေးချယ်ခဲ့သည်
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Explanation Box */}
                {q.explanation && (
                  <div className="p-3 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/50 border border-indigo-200/80 dark:border-indigo-800/60 text-xs text-indigo-950 dark:text-indigo-200 flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-extrabold">ရှင်းလင်းချက်: </span>
                      <span>{q.explanation}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex items-center justify-between gap-2 shrink-0">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            စုစုပေါင်း မေးခွန်း ({questions.length}) ပုဒ် · အောင်မှတ် {quiz.passingScore}%
          </span>
          <div className="flex items-center gap-2">
            {onRetake && (
              <button
                type="button"
                onClick={onRetake}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>ပြန်လည်ဖြေဆိုမည်</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-extrabold cursor-pointer"
            >
              ပိတ်မည် (Close)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 3. TEACHER LIVE SCOREBOARD & STUDENT ANSWER INSPECTOR MODAL
 * ============================================================================ */
const TeacherQuizScoreboardModal: React.FC<{
  quiz: Quiz;
  course: Course;
  enrolledStudents: User[];
  currentUser: User;
  onClose: () => void;
  onInspectStudentSubmission: (sub: QuizSubmission) => void;
  onDataChanged: () => void;
}> = ({
  quiz,
  course,
  enrolledStudents,
  currentUser,
  onClose,
  onInspectStudentSubmission,
  onDataChanged,
}) => {
  const [search, setSearch] = useState('');
  const [tabFilter, setTabFilter] = useState<'all' | 'submitted' | 'pending' | 'passed' | 'failed'>(
    'all'
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [localTick, setLocalTick] = useState(0);

  const cleanQuestions = useMemo(
    () => (quiz.questions || []).filter((q) => q && q.id !== '__quiz_meta__'),
    [quiz.questions]
  );

  // Pull fresh submissions when teacher opens scoreboard
  useEffect(() => {
    let mounted = true;
    ClassroomDB.syncQuizzesFromCloud(true, quiz.id).then((changed) => {
      if (mounted && changed) {
        setLocalTick((t) => t + 1);
        onDataChanged();
      }
    });
    return () => {
      mounted = false;
    };
  }, [quiz.id]);

  const submissions = useMemo(
    () => ClassroomDB.getAllQuizSubmissionsForQuiz(quiz.id),
    [quiz.id, localTick]
  );

  const subByStudentId = useMemo(() => {
    const map = new Map<string, QuizSubmission>();
    submissions.forEach((s) => map.set(s.studentId, s));
    return map;
  }, [submissions]);

  // Combine enrolled students + any extra students who submitted
  const rows = useMemo(() => {
    const studentMap = new Map<string, { user?: User; submission?: QuizSubmission }>();
    enrolledStudents.forEach((st) => {
      studentMap.set(st.id, { user: st, submission: subByStudentId.get(st.id) });
    });
    submissions.forEach((sub) => {
      if (!studentMap.has(sub.studentId)) {
        studentMap.set(sub.studentId, { submission: sub });
      }
    });

    const list = Array.from(studentMap.entries()).map(([studentId, item]) => {
      const name = item.user?.name || item.submission?.studentName || 'Student';
      const username = item.user?.username || item.submission?.studentUsername || '';
      const sub = item.submission;
      const correctCount = sub
        ? typeof sub.correctCount === 'number'
          ? sub.correctCount
          : cleanQuestions.filter((q) => sub.answers?.[q.id] === q.correctIndex).length
        : 0;

      return {
        studentId,
        name,
        username,
        submission: sub,
        correctCount,
      };
    });

    return list.sort((a, b) => {
      if (a.submission && !b.submission) return -1;
      if (!a.submission && b.submission) return 1;
      if (a.submission && b.submission) {
        if (b.submission.score !== a.submission.score) {
          return b.submission.score - a.submission.score;
        }
      }
      return a.name.localeCompare(b.name);
    });
  }, [enrolledStudents, subByStudentId, submissions, cleanQuestions]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (tabFilter === 'submitted' && !r.submission) return false;
      if (tabFilter === 'pending' && r.submission) return false;
      if (tabFilter === 'passed' && (!r.submission || !r.submission.passed)) return false;
      if (tabFilter === 'failed' && (!r.submission || r.submission.passed)) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        return r.name.toLowerCase().includes(q) || r.username.toLowerCase().includes(q);
      }
      return true;
    });
  }, [rows, tabFilter, search]);

  const handleRefreshCloud = async () => {
    setIsRefreshing(true);
    try {
      await ClassroomDB.syncQuizzesFromCloud(true, quiz.id);
      setLocalTick((t) => t + 1);
      onDataChanged();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleExportCSV = () => {
    const headers = [
      'No',
      'Student Name',
      'Username',
      'Status',
      'Score (%)',
      `Correct (/${cleanQuestions.length})`,
      'Pass/Fail',
      'Submitted At',
    ];
    const csvRows = rows.map((r, idx) => [
      idx + 1,
      `"${r.name.replace(/"/g, '""')}"`,
      `"${r.username}"`,
      r.submission ? 'Submitted' : 'Not Submitted',
      r.submission ? `${r.submission.score}%` : '-',
      r.submission ? `${r.correctCount}/${cleanQuestions.length}` : '-',
      r.submission ? (r.submission.passed ? 'PASS' : 'FAIL') : '-',
      r.submission ? `"${r.submission.submittedAt}"` : '-',
    ]);

    const csvContent =
      '\uFEFF' + [headers.join(','), ...csvRows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${course.code}_${quiz.title.slice(0, 25)}_Scores.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const submittedCount = rows.filter((r) => Boolean(r.submission)).length;
  const pendingCount = rows.length - submittedCount;
  const passedCount = rows.filter((r) => r.submission?.passed).length;
  const failedCount = submittedCount - passedCount;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-5xl max-h-[94dvh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div>
            <div className="text-[11px] font-extrabold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
              📊 ဆရာသုံး အမှတ်စာရင်းနှင့် အဖြေလွှာ စစ်ဆေးရေး (Teacher Scoreboard)
            </div>
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white mt-0.5">
              {quiz.title} ({cleanQuestions.length} ပုဒ် · အောင်မှတ် {quiz.passingScore}%)
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefreshCloud}
              disabled={isRefreshing}
              className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-600' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Excel (CSV) ထုတ်မည်</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-extrabold cursor-pointer"
            >
              ✕ ပိတ်မည်
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="px-4 sm:px-6 py-3 bg-slate-100/70 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setTabFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                tabFilter === 'all'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              အားလုံး ({rows.length})
            </button>
            <button
              type="button"
              onClick={() => setTabFilter('submitted')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                tabFilter === 'submitted'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300'
              }`}
            >
              ဖြေဆိုပြီး ({submittedCount})
            </button>
            <button
              type="button"
              onClick={() => setTabFilter('pending')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                tabFilter === 'pending'
                  ? 'bg-amber-600 text-white'
                  : 'bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-300'
              }`}
            >
              မဖြေရသေးသူ ({pendingCount})
            </button>
            <button
              type="button"
              onClick={() => setTabFilter('passed')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                tabFilter === 'passed'
                  ? 'bg-teal-600 text-white'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              အောင်မြင်သူ ({passedCount})
            </button>
            <button
              type="button"
              onClick={() => setTabFilter('failed')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                tabFilter === 'failed'
                  ? 'bg-rose-600 text-white'
                  : 'bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-300'
              }`}
            >
              ကျရှုံးသူ ({failedCount})
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ကျောင်းသားအမည် ရှာရန်..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Student Score List */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-2.5">
          {filteredRows.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
              ရှာဖွေမှုနှင့် ကိုက်ညီသော ကျောင်းသားစာရင်း မရှိပါ။
            </div>
          ) : (
            filteredRows.map((row, idx) => {
              const sub = row.submission;
              return (
                <div
                  key={row.studentId}
                  className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-7 h-7 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono text-xs font-extrabold flex items-center justify-center shrink-0">
                      #{idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate">
                        {row.name}{' '}
                        {row.username && (
                          <span className="text-[11px] font-mono font-normal text-slate-500">
                            (@{row.username})
                          </span>
                        )}
                      </div>
                      {sub ? (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                          {sub.startedAtMmt ? `စနှိပ်ချိန်: ${sub.startedAtMmt} · ` : ''}
                          အပ်နှံချိန်: {sub.submittedAt}{' '}
                          {sub.timeSpentSeconds
                            ? `· ကြာချိန် ${formatDurationSeconds(sub.timeSpentSeconds)}`
                            : ''}
                          {sub.autoSubmittedOnTimeout ? ' · (⏰ အချိန်ပြည့် Auto-Closed)' : ''}
                        </div>
                      ) : (
                        <div className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
                          ⏳ မဖြေဆိုရသေးပါ
                        </div>
                      )}
                    </div>
                  </div>

                  {sub ? (
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <span
                        className={`px-3 py-1 rounded-xl font-mono text-xs font-extrabold ${
                          sub.passed
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                            : 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-700'
                        }`}
                      >
                        {row.correctCount}/{cleanQuestions.length} မှတ် · ({sub.score}%) ·{' '}
                        {sub.passed ? 'PASS' : 'FAIL'}
                      </span>

                      <button
                        type="button"
                        onClick={() => onInspectStudentSubmission(sub)}
                        className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>အဖြေလွှာကြည့်ရန်</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          ClassroomDB.resetStudentQuizSubmission(
                            quiz.id,
                            row.studentId,
                            currentUser
                          );
                          setLocalTick((t) => t + 1);
                          onDataChanged();
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-rose-100 text-slate-600 dark:text-slate-300 hover:text-rose-600 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                        title="ဤကျောင်းသားအား ပြန်လည်ဖြေဆိုခွင့်ပြုရန် (Reset Attempt)"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>ပြန်ဖြေခွင့်ပြုမည်</span>
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs font-mono text-slate-400">Pending</span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 4. INTERACTIVE 3D FLASHCARDS PRACTICE MODAL (0% Supabase Usage)
 * ============================================================================ */
const FlashcardsPracticeModal: React.FC<{
  quiz: Quiz;
  onClose: () => void;
}> = ({ quiz, onClose }) => {
  const questions = useMemo(
    () => (quiz.questions || []).filter((q) => q && q.id !== '__quiz_meta__'),
    [quiz.questions]
  );
  const [cardIndex, setCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [masteredIds, setMasteredIds] = useState<Set<string>>(new Set());

  if (questions.length === 0) return null;
  const currentCard = questions[cardIndex] || questions[0];
  const correctAnswerText = currentCard.options[currentCard.correctIndex] || '';

  const speakText = (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'en-US';
      utter.rate = 0.92;
      window.speechSynthesis.speak(utter);
    }
  };

  const toggleMastered = () => {
    setMasteredIds((prev) => {
      const next = new Set(prev);
      if (next.has(currentCard.id)) next.delete(currentCard.id);
      else next.add(currentCard.id);
      return next;
    });
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-6 space-y-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="text-[11px] font-extrabold text-purple-600 dark:text-purple-400 uppercase tracking-wider flex items-center gap-1">
              <Layers className="w-3.5 h-3.5" />
              <span>🃏 Flashcards ကတ်ပြားလှန် လေ့ကျင့်ခန်း ({cardIndex + 1}/{questions.length})</span>
            </div>
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate mt-0.5">
              {quiz.title}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-xs font-extrabold">
              ✓ ရပြီ: {masteredIds.size}/{questions.length}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-2.5 py-1.5 rounded-xl bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer"
            >
              ✕ ပိတ်မည်
            </button>
          </div>
        </div>

        {/* Interactive Flip Card */}
        <div
          onClick={() => setIsFlipped((f) => !f)}
          className={`min-h-[260px] sm:min-h-[300px] p-5 sm:p-7 rounded-3xl border-2 cursor-pointer transition-all flex flex-col justify-between select-none ${
            isFlipped
              ? 'bg-emerald-50/90 dark:bg-emerald-950/50 border-emerald-400 dark:border-emerald-600'
              : 'bg-slate-50 dark:bg-slate-800/80 border-indigo-200 dark:border-indigo-800 hover:border-indigo-400'
          }`}
        >
          <div className="flex items-center justify-between gap-2 text-xs font-bold">
            <span
              className={`px-2.5 py-1 rounded-lg ${
                isFlipped
                  ? 'bg-emerald-600 text-white'
                  : 'bg-indigo-600 text-white'
              }`}
            >
              {isFlipped ? '✓ အဖြေမှန် (Answer Side)' : '❓ မေးခွန်း (Question Side)'}
            </span>

            <button
              type="button"
              onClick={(e) =>
                speakText(isFlipped ? correctAnswerText : currentCard.question, e)
              }
              className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 flex items-center gap-1 text-[11px] font-bold cursor-pointer"
              title="အသံထွက် နားထောင်ရန်"
            >
              <Volume2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Listen</span>
            </button>
          </div>

          {!isFlipped ? (
            <div className="my-auto py-4 space-y-4">
              <p className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white leading-relaxed text-center">
                {currentCard.question}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                {currentCard.options.map((opt, idx) => (
                  <div
                    key={idx}
                    className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    <span className="font-mono font-extrabold text-indigo-600 dark:text-indigo-400 mr-1.5">
                      {OPTION_LABELS[idx]})
                    </span>
                    {opt}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="my-auto py-4 space-y-3 text-center">
              <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase">
                အဖြေမှန် (Correct Answer)
              </div>
              <div className="text-lg sm:text-xl font-black text-emerald-900 dark:text-emerald-100">
                {OPTION_LABELS[currentCard.correctIndex]}) {correctAnswerText}
              </div>
              {currentCard.explanation && (
                <div className="p-3 rounded-2xl bg-white/90 dark:bg-slate-900/80 border border-emerald-200 dark:border-emerald-800 text-xs text-slate-700 dark:text-slate-200 max-w-lg mx-auto leading-relaxed">
                  <strong>💡 ရှင်းလင်းချက်:</strong> {currentCard.explanation}
                </div>
              )}
            </div>
          )}

          <div className="text-center text-[11px] font-bold text-slate-400 dark:text-slate-500">
            👆 ကတ်ပြားကို နှိပ်၍ {isFlipped ? 'မေးခွန်းဘက်သို့' : 'အဖြေမှန်ဘက်သို့'} လှန်ကြည့်ပါ
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <button
            type="button"
            disabled={cardIndex === 0}
            onClick={() => {
              setIsFlipped(false);
              setCardIndex((i) => Math.max(0, i - 1));
            }}
            className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 disabled:opacity-40 flex items-center gap-1 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>ရှေ့ကတ်ပြား</span>
          </button>

          <button
            type="button"
            onClick={toggleMastered}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold cursor-pointer flex items-center gap-1.5 ${
              masteredIds.has(currentCard.id)
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{masteredIds.has(currentCard.id) ? '✓ မှတ်မိပြီ (Mastered)' : 'မှတ်မိပြီဟု မှတ်သားမည်'}</span>
          </button>

          <button
            type="button"
            disabled={cardIndex >= questions.length - 1}
            onClick={() => {
              setIsFlipped(false);
              setCardIndex((i) => Math.min(questions.length - 1, i + 1));
            }}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-extrabold disabled:opacity-40 flex items-center gap-1 cursor-pointer"
          >
            <span>နောက်ကတ်ပြား</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 5. TEACHER CREATE / EDIT QUIZ & EXAM MODAL (Visual Builder + Smart Paste)
 * ============================================================================ */
const QuizEditorModal: React.FC<{
  course: Course;
  currentUser: User;
  initialQuiz?: Quiz;
  onClose: () => void;
  onSaved: () => void;
}> = ({ course, currentUser, initialQuiz, onClose, onSaved }) => {
  const [title, setTitle] = useState(initialQuiz?.title || '');
  const [description, setDescription] = useState(
    initialQuiz?.description ||
      'မေးခွန်းအားလုံးကို သေချာဖတ်ရှုပြီး အမှန်ဆုံးအဖြေကို ရွေးချယ်ဖြေဆိုပါ။ ဖြေဆိုပြီးသည်နှင့် ရမှတ်နှင့် အဖြေမှန်များကို ချက်ချင်း ကြည့်ရှုနိုင်ပါသည်။'
  );
  const [mode, setMode] = useState<'exam' | 'practice'>(initialQuiz?.mode || 'exam');
  const [durationMinutes, setDurationMinutes] = useState(initialQuiz?.durationMinutes || 20);
  const [passingScore, setPassingScore] = useState(initialQuiz?.passingScore || 60);
  const [enableFlashcards, setEnableFlashcards] = useState(
    initialQuiz?.enableFlashcards !== false
  );
  const [shuffleQuestions, setShuffleQuestions] = useState<boolean>(
    initialQuiz ? Boolean(initialQuiz.shuffleQuestions) : true
  );
  const [shuffleOptions, setShuffleOptions] = useState<boolean>(
    initialQuiz ? Boolean(initialQuiz.shuffleOptions) : true
  );
  const [isOpen, setIsOpen] = useState<boolean>(initialQuiz?.isOpen !== false);
  const [timezoneMode, setTimezoneMode] = useState<'MMT' | 'LOCAL'>(
    initialQuiz?.timezoneMode === 'LOCAL' ? 'LOCAL' : 'MMT'
  );
  const [scheduledOpenAt, setScheduledOpenAt] = useState<string>(() =>
    toDatetimeLocalInputValue(
      initialQuiz?.scheduledOpenAt,
      initialQuiz?.timezoneMode === 'LOCAL' ? 'LOCAL' : 'MMT'
    )
  );
  const [scheduledCloseAt, setScheduledCloseAt] = useState<string>(() =>
    toDatetimeLocalInputValue(
      initialQuiz?.scheduledCloseAt,
      initialQuiz?.timezoneMode === 'LOCAL' ? 'LOCAL' : 'MMT'
    )
  );
  const [liveClockMs, setLiveClockMs] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setLiveClockMs(Date.now()), 1_000);
    return () => clearInterval(t);
  }, []);

  const [inputTab, setInputTab] = useState<'builder' | 'bulk' | 'bank'>('builder');
  const [bulkText, setBulkText] = useState('');
  const [bankSearch, setBankSearch] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const allBankQuestions = useMemo(() => ClassroomDB.getQuestionBank(), []);

  const [questions, setQuestions] = useState<QuizQuestion[]>(() => {
    const existing = (initialQuiz?.questions || []).filter(
      (q) => q && q.id !== '__quiz_meta__'
    );
    if (existing.length > 0) return existing;
    return [
      {
        id: `q-${Date.now()}-1`,
        question: '',
        options: ['', '', '', ''],
        correctIndex: 0,
        explanation: '',
      },
    ];
  });

  const handleAddQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      {
        id: `q-${Date.now()}-${prev.length + 1}`,
        question: '',
        options: ['', '', '', ''],
        correctIndex: 0,
        explanation: '',
      },
    ]);
  };

  const handleRemoveQuestion = (idx: number) => {
    if (questions.length <= 1) return;
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleQuestionChange = (idx: number, field: keyof QuizQuestion, value: unknown) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === idx ? { ...q, [field]: value } : q))
    );
  };

  const handleOptionChange = (qIdx: number, optIdx: number, val: string) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q;
        const nextOpts = [...q.options];
        nextOpts[optIdx] = val;
        return { ...q, options: nextOpts };
      })
    );
  };

  const handleAddOptionToQuestion = (qIdx: number) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx || q.options.length >= 8) return q;
        return { ...q, options: [...q.options, ''] };
      })
    );
  };

  const handleRemoveOptionFromQuestion = (qIdx: number, optIdx: number) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx || q.options.length <= 2) return q;
        const nextOpts = q.options.filter((_, idx) => idx !== optIdx);
        let nextCorrect = q.correctIndex;
        if (nextCorrect === optIdx) {
          nextCorrect = 0;
        } else if (nextCorrect > optIdx) {
          nextCorrect = nextCorrect - 1;
        }
        return {
          ...q,
          options: nextOpts,
          correctIndex: Math.min(nextCorrect, nextOpts.length - 1),
        };
      })
    );
  };

  const handleSetOptionCountForQuestion = (qIdx: number, targetCount: number) => {
    const clamped = Math.max(2, Math.min(8, targetCount));
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q;
        const nextOpts = [...q.options];
        while (nextOpts.length < clamped) nextOpts.push('');
        const sliced = nextOpts.slice(0, clamped);
        return {
          ...q,
          options: sliced,
          correctIndex: Math.min(q.correctIndex, sliced.length - 1),
        };
      })
    );
  };

  const handleApplyBulkPaste = () => {
    const parsed = parseSmartBulkQuestions(bulkText);
    if (parsed.length === 0) {
      setErrorMsg(
        'မေးခွန်းပုံစံ ရှာမတွေ့ပါ။ နမူနာပုံစံအတိုင်း မေးခွန်းနှင့် A) B) သို့မဟုတ် က) ခ) ရွေးချယ်စရာ အနည်းဆုံး (၂) ခု (အဖြေမှန်ရှေ့တွင် * ခံ၍) ထည့်သွင်းပေးပါ။'
      );
      return;
    }
    const nonEmptyExisting = questions.filter((q) => q.question.trim().length > 0);
    setQuestions([...nonEmptyExisting, ...parsed]);
    setBulkText('');
    setInputTab('builder');
    setErrorMsg(null);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Exam ခေါင်းစဉ် (Title) ရိုက်ထည့်ပေးပါ။');
      return;
    }

    if (scheduledOpenAt && scheduledCloseAt) {
      const openMs = parseScheduleDateTimeMs(scheduledOpenAt, timezoneMode);
      const closeMs = parseScheduleDateTimeMs(scheduledCloseAt, timezoneMode);
      if (!Number.isNaN(openMs) && !Number.isNaN(closeMs) && closeMs <= openMs) {
        setErrorMsg('Exam ပိတ်သိမ်းချိန် (Close Time) သည် စတင်ဖွင့်ချိန် (Open Time) ထက် နောက်ကျရပါမည်။');
        return;
      }
    }

    const validQuestions = questions
      .map((q) => {
        // Keep non-empty options and adjust correctIndex if leading empty options were trimmed
        const pairs = q.options.map((o, idx) => ({
          text: o.trim(),
          wasCorrect: idx === q.correctIndex,
        }));
        const nonEmpty = pairs.filter((p) => p.text.length > 0);
        const newCorrectIdx = nonEmpty.findIndex((p) => p.wasCorrect);
        return {
          ...q,
          question: q.question.trim(),
          options: nonEmpty.map((p) => p.text),
          correctIndex: newCorrectIdx >= 0 ? newCorrectIdx : 0,
        };
      })
      .filter((q) => q.question.length > 0 && q.options.length >= 2);

    if (validQuestions.length === 0) {
      setErrorMsg('အနည်းဆုံး မေးခွန်း (၁) ပုဒ်နှင့် ရွေးချယ်စရာ အဖြေ (၂) ခု ပြည့်စုံစွာ ထည့်သွင်းပေးပါ။');
      return;
    }

    ClassroomDB.saveQuiz(
      {
        id: initialQuiz?.id,
        courseId: course.id,
        title: title.trim(),
        description: description.trim(),
        durationMinutes,
        passingScore,
        mode,
        enableFlashcards,
        showAnswersImmediately: true,
        shuffleQuestions,
        shuffleOptions,
        isOpen,
        timezoneMode,
        scheduledOpenAt: scheduledOpenAt.trim() || undefined,
        scheduledCloseAt: scheduledCloseAt.trim() || undefined,
        questions: validQuestions,
      },
      currentUser
    );
    onSaved();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-4xl max-h-[94dvh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex items-center justify-between gap-3 shrink-0">
          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
              {initialQuiz
                ? '✏️ Exam ပြင်ဆင်ရန် (Edit Exam & Schedule)'
                : '✨ Exam Room — စာမေးပွဲအသစ် ဖန်တီးရန်'}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {course.code} — {course.title} (မြန်မာစံတော်ချိန် MMT Schedule + ကျောင်းသားတစ်ဦးချင်း ကြာချိန်ထိန်းချုပ်စနစ် ပါဝင်သည်)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-extrabold cursor-pointer"
          >
            ✕ ပိတ်မည်
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-bold">
              ⚠️ {errorMsg}
            </div>
          )}

          {/* Quiz Settings Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="sm:col-span-2">
              <label className="block font-extrabold text-slate-700 dark:text-slate-200 mb-1">
                Exam ခေါင်းစဉ် (Title) *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="ဥပမာ — Week 1: English & မြန်မာစာ Exam"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-bold focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-extrabold text-slate-700 dark:text-slate-200 mb-1">
                လမ်းညွှန်ချက် / ဖော်ပြချက် (Description)
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block font-extrabold text-slate-700 dark:text-slate-200 mb-1">
                ဖြေဆိုမှု ပုံစံ (Exam Mode)
              </label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as 'exam' | 'practice')}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-bold"
              >
                <option value="exam">
                  📝 စာမေးပွဲပုံစံ (Exam Mode — ၁ ကြိမ်ဖြေပြီး အချိန်ပြည့်သည်နှင့် ပိတ်သည်)
                </option>
                <option value="practice">
                  🔄 လေ့ကျင့်ခန်းပုံစံ (Practice Mode — အကြိမ်ကြိမ် ပြန်ဖြေနိုင်သည်)
                </option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block font-extrabold text-slate-700 dark:text-slate-200 mb-1">
                  ကျောင်းသား ဖြေဆိုချိန် ကြာချိန် (မိနစ်)
                </label>
                <input
                  type="number"
                  min={1}
                  max={300}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value) || 20)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-bold"
                />
                <span className="block text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  * ကျောင်းသား "ဖြေဆိုမည်" စနှိပ်ချိန်မှစ၍ တွက်ချက်ပြီး ၅ မိနစ်အလိုတွင် သတိပေးပါသည်
                </span>
              </div>
              <div>
                <label className="block font-extrabold text-slate-700 dark:text-slate-200 mb-1">
                  အောင်မှတ် (%)
                </label>
                <input
                  type="number"
                  min={10}
                  max={100}
                  value={passingScore}
                  onChange={(e) => setPassingScore(Number(e.target.value) || 60)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-bold"
                />
              </div>
            </div>

            {/* Exam On/Off & Myanmar Standard Time (MMT) Schedule Control Box */}
            <div className="sm:col-span-2 p-3.5 sm:p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/70 space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>Exam On/Off နှင့် Schedule (မြန်မာ စံတော်ချိန် MMT သတ်မှတ်ချက်)</span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    နိုင်ငံစုံမှ ဆရာများနှင့် ကျောင်းသားများ အချိန်တစ်ပြေးညီ ဖြစ်စေရန် မြန်မာ စံတော်ချိန် (UTC+06:30) ဖြင့် စမည့်အချိန်နှင့် ပိတ်မည့်အချိန် သတ်မှတ်နိုင်ပါသည်
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsOpen((v) => !v)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-extrabold cursor-pointer border transition-colors ${
                    isOpen
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-rose-600 text-white border-rose-600'
                  }`}
                >
                  {isOpen ? '🟢 Exam ON (ဖွင့်ထားသည်)' : '🔒 Exam OFF (ပိတ်ထားသည်)'}
                </button>
              </div>

              {/* Timezone Standard Selector (Myanmar Standard Time MMT vs Local) */}
              <div className="p-3 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-indigo-200/80 dark:border-indigo-800/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="space-y-0.5">
                  <div className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>စံတော်ချိန် သတ်မှတ်ချက် (Exam Timezone Standard)</span>
                  </div>
                  <div className="text-[11px] font-mono text-indigo-700 dark:text-indigo-300">
                    🇲🇲 လက်ရှိ မြန်မာစံတော်ချိန် (MMT): <strong>{formatLiveMyanmarClock(liveClockMs)}</strong>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setTimezoneMode('MMT')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer border transition-all ${
                      timezoneMode === 'MMT'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    🇲🇲 မြန်မာ စံတော်ချိန် (MMT · UTC+06:30)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimezoneMode('LOCAL')}
                    className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold cursor-pointer border transition-all ${
                      timezoneMode === 'LOCAL'
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    🌐 Local Time
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-extrabold text-slate-700 dark:text-slate-200">
                      🟢 Exam စတင်ဖွင့်မည့်အချိန် ({timezoneMode === 'MMT' ? 'မြန်မာစံတော်ချိန် MMT' : 'Local'})
                    </label>
                    {scheduledOpenAt && (
                      <button
                        type="button"
                        onClick={() => setScheduledOpenAt('')}
                        className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer"
                      >
                        ပြန်ဖြုတ်မည်
                      </button>
                    )}
                  </div>
                  <input
                    type="datetime-local"
                    value={scheduledOpenAt}
                    onChange={(e) => setScheduledOpenAt(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-xs"
                  />
                  <div className="flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setScheduledOpenAt(getDatetimeLocalWithOffset(0, timezoneMode))
                      }
                      className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 cursor-pointer hover:bg-indigo-50"
                    >
                      ယခုချက်ချင်း (MMT Now)
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setScheduledOpenAt(getDatetimeLocalWithOffset(30, timezoneMode))
                      }
                      className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-100"
                    >
                      +၃၀ မိနစ်
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setScheduledOpenAt(getDatetimeLocalWithOffset(60, timezoneMode))
                      }
                      className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-100"
                    >
                      +၁ နာရီ
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-extrabold text-slate-700 dark:text-slate-200">
                      🛑 Exam ပိတ်သိမ်းမည့်အချိန် ({timezoneMode === 'MMT' ? 'မြန်မာစံတော်ချိန် MMT' : 'Local'})
                    </label>
                    {scheduledCloseAt && (
                      <button
                        type="button"
                        onClick={() => setScheduledCloseAt('')}
                        className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer"
                      >
                        ပြန်ဖြုတ်မည်
                      </button>
                    )}
                  </div>
                  <input
                    type="datetime-local"
                    value={scheduledCloseAt}
                    onChange={(e) => setScheduledCloseAt(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-xs"
                  />
                  <div className="flex flex-wrap items-center gap-1">
                    {[
                      { label: '+၁ နာရီ', mins: 60 },
                      { label: '+၂ နာရီ', mins: 120 },
                      { label: '+၆ နာရီ', mins: 360 },
                      { label: '+၁ ရက်', mins: 1440 },
                    ].map((preset) => (
                      <button
                        key={preset.mins}
                        type="button"
                        onClick={() => {
                          const baseMs = scheduledOpenAt
                            ? parseScheduleDateTimeMs(scheduledOpenAt, timezoneMode)
                            : Date.now();
                          setScheduledCloseAt(
                            getDatetimeLocalWithOffset(
                              preset.mins,
                              timezoneMode,
                              Number.isNaN(baseMs) ? Date.now() : baseMs
                            )
                          );
                        }}
                        className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-100"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="sm:col-span-2 flex items-center justify-between p-3 rounded-2xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                <div>
                  <div className="font-extrabold text-slate-900 dark:text-white">
                    🃏 ကတ်ပြားလှန် လေ့ကျင့်ခန်း (Flashcards Mode) ပါ တစ်ပါတည်း ဖွင့်ပေးမည်
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    ကျောင်းသားများ မေးခွန်းများကို ကတ်ပြားလှန်၍ အသံထွက်နားထောင်ကာ လေ့ကျင့်နိုင်ပါမည်
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={enableFlashcards}
                onChange={(e) => setEnableFlashcards(e.target.checked)}
                className="w-4 h-4 accent-purple-600 cursor-pointer"
              />
            </div>

            {/* Anti-Cheat Question & Answer Shuffling Toggles */}
            <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center justify-between p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60">
                <div className="flex items-center gap-2 pr-2">
                  <Shuffle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <div>
                    <div className="font-extrabold text-slate-900 dark:text-white">
                      🔀 မေးခွန်းအစီအစဉ် ကျပန်းရောမွှေမည် (Auto-Shuffle Questions)
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      ကျောင်းသားတစ်ဦးနှင့်တစ်ဦး မေးခွန်းနံပါတ် အစီအစဉ် မတူညီစေရန် အလိုအလျောက် ရောမွှေပေးမည်
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={shuffleQuestions}
                  onChange={(e) => setShuffleQuestions(e.target.checked)}
                  className="w-4 h-4 accent-amber-600 cursor-pointer shrink-0"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60">
                <div className="flex items-center gap-2 pr-2">
                  <Shuffle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div>
                    <div className="font-extrabold text-slate-900 dark:text-white">
                      🎲 အဖြေ (A, B, C, D) ကျပန်းရောမွှေမည် (Auto-Shuffle Choices)
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      အဖြေကူးချ၍ မရစေရန် မေးခွန်းတစ်ပုဒ်ချင်းစီ၏ A, B, C, D အစီအစဉ်ကို ကျပန်းနေရာပြောင်းပေးမည်
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={shuffleOptions}
                  onChange={(e) => setShuffleOptions(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600 cursor-pointer shrink-0"
                />
              </div>
            </div>
          </div>

          {/* Input Mode Switcher: Visual Builder vs Smart Paste vs Question Bank */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setInputTab('builder')}
                  className={`px-3.5 py-2 rounded-xl font-extrabold flex items-center gap-1.5 cursor-pointer ${
                    inputTab === 'builder'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>တစ်ပုဒ်ချင်း ရေးသွင်းရန် ({questions.length} ပုဒ်)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInputTab('bulk')}
                  className={`px-3.5 py-2 rounded-xl font-extrabold flex items-center gap-1.5 cursor-pointer ${
                    inputTab === 'bulk'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <ClipboardPaste className="w-3.5 h-3.5" />
                  <span>📋 စာသားဖြင့် အမြန်သွင်းရန် (Smart Paste)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInputTab('bank')}
                  className={`px-3.5 py-2 rounded-xl font-extrabold flex items-center gap-1.5 cursor-pointer ${
                    inputTab === 'bank'
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>🏦 မေးခွန်းဘဏ်မှ ရွေးထည့်ရန် (Question Bank · {allBankQuestions.length})</span>
                </button>
              </div>

              {inputTab === 'builder' && (
                <button
                  type="button"
                  onClick={handleAddQuestion}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>မေးခွန်းအသစ် ထပ်ထည့်မည်</span>
                </button>
              )}
            </div>

            {inputTab === 'bank' ? (
              <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-slate-800/80 border border-amber-300/70 dark:border-amber-700/60 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Database className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      <span>Swanarh Academy မေးခွန်းဘဏ် (Question Bank Repository)</span>
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      ယခင် စာမေးပွဲများမှ မေးခွန်းဟောင်းများကို တစ်ချက်နှိပ်ရုံဖြင့် ယခု Exam ထဲသို့ ပြန်လည်ရွေးထည့်နိုင်ပါသည်
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const existingNorm = new Set(
                        questions.map((q) => q.question.trim().toLowerCase()).filter(Boolean)
                      );
                      const available = allBankQuestions.filter(
                        (bq) => !existingNorm.has(bq.question.trim().toLowerCase())
                      );
                      if (available.length === 0) return;
                      const randomFive = seededShuffleArray(
                        available,
                        `randompick|${Date.now()}`
                      ).slice(0, 5);
                      const cloned: QuizQuestion[] = randomFive.map((rq, idx) => ({
                        id: `q-bank-${Date.now()}-${idx}`,
                        question: rq.question,
                        options: [...rq.options],
                        correctIndex: rq.correctIndex,
                        explanation: rq.explanation || '',
                      }));
                      const nonEmpty = questions.filter((q) => q.question.trim().length > 0);
                      setQuestions([...nonEmpty, ...cloned]);
                      setInputTab('builder');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                    <span>🎲 မေးခွန်းဘဏ်မှ ကျပန်း (၅) ပုဒ် အလိုအလျောက် ရွေးထည့်မည်</span>
                  </button>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={bankSearch}
                    onChange={(e) => setBankSearch(e.target.value)}
                    placeholder="မေးခွန်းဘဏ်ထဲမှ မေးခွန်း သို့မဟုတ် စာမေးပွဲအမည်ဖြင့် ရှာဖွေရန်..."
                    className="w-full pl-8 pr-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                  {allBankQuestions
                    .filter((bq) => {
                      const q = bankSearch.trim().toLowerCase();
                      if (!q) return true;
                      return (
                        bq.question.toLowerCase().includes(q) ||
                        bq.sourceQuizTitle.toLowerCase().includes(q) ||
                        bq.options.some((o: string) => o.toLowerCase().includes(q))
                      );
                    })
                    .map((bq, bIdx) => {
                      const alreadyAdded = questions.some(
                        (eq) =>
                          eq.question.trim().toLowerCase() ===
                          bq.question.trim().toLowerCase()
                      );
                      return (
                        <div
                          key={`${bq.id}-${bIdx}`}
                          className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                        >
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-mono text-[10px] font-bold">
                                {bq.sourceQuizTitle}
                              </span>
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                                ✓ အဖြေမှန်: {OPTION_LABELS[bq.correctIndex] || 'A'} ({bq.options[bq.correctIndex]})
                              </span>
                            </div>
                            <p className="text-xs font-extrabold text-slate-900 dark:text-white">
                              {bq.question}
                            </p>
                          </div>

                          <button
                            type="button"
                            disabled={alreadyAdded}
                            onClick={() => {
                              const nonEmpty = questions.filter(
                                (q) => q.question.trim().length > 0
                              );
                              setQuestions([
                                ...nonEmpty,
                                {
                                  id: `q-bank-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                                  question: bq.question,
                                  options: [...bq.options],
                                  correctIndex: bq.correctIndex,
                                  explanation: bq.explanation || '',
                                },
                              ]);
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold shrink-0 cursor-pointer ${
                              alreadyAdded
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 cursor-default'
                                : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                            }`}
                          >
                            {alreadyAdded ? '✓ ထည့်သွင်းပြီး' : '+ ရွေးထည့်မည်'}
                          </button>
                        </div>
                      );
                    })}
                </div>
              </div>
            ) : inputTab === 'bulk' ? (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-200 space-y-1">
                    <div>
                      💡 မြန်မာစာ (<code className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-mono">က) ခ) ဂ) ဃ)</code>) သို့မဟုတ် English (<code className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-mono">A) B) C) D)</code>) ကြိုက်နှစ်သက်ရာ ပုံစံဖြင့် Copy/Paste ချနိုင်ပါသည်။
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      ✨ <strong>Auto Choice Count:</strong> ရွေးချယ်စရာ Choose (၂) ခုပဲ ပါလျှင် (၂) ခုတည်း အလိုအလျောက် သတ်မှတ်ပေးပြီး၊ (၃) ခု၊ (၄) ခု၊ (၅) ခု ပါလျှင်လည်း ပါသလောက် အလိုအလျောက် စီပေးပါသည် (အဖြေမှန်ရှေ့တွင် <code className="px-1 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-mono">*</code> ခံပေးပါ)။
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBulkText(SAMPLE_BULK_TEXT)}
                    className="px-2.5 py-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold text-[11px] cursor-pointer shrink-0"
                  >
                    မြန်မာ + English နမူနာပုံစံ ထည့်ကြည့်ရန်
                  </button>
                </div>

                <textarea
                  rows={11}
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder={SAMPLE_BULK_TEXT}
                  className="w-full p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono text-xs leading-relaxed text-slate-900 dark:text-white"
                />

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleApplyBulkPaste}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold cursor-pointer"
                  >
                    ✓ မေးခွန်းစာရင်းထဲသို့ အလိုအလျောက် ခွဲထည့်မည်
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {questions.map((q, qIdx) => (
                  <div
                    key={q.id}
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono font-extrabold text-indigo-600 dark:text-indigo-400">
                        မေးခွန်း အမှတ်စဉ် #{qIdx + 1} ({q.options.length} Choices)
                      </span>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {/* Quick Choice Count Presets (2, 3, 4) + Add Choice */}
                        <div className="flex items-center gap-1 bg-white dark:bg-slate-900 px-2 py-1 rounded-xl border border-slate-200 dark:border-slate-700">
                          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mr-1">
                            Choose:
                          </span>
                          {[2, 3, 4].map((cnt) => (
                            <button
                              key={cnt}
                              type="button"
                              onClick={() => handleSetOptionCountForQuestion(qIdx, cnt)}
                              className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold cursor-pointer ${
                                q.options.length === cnt
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                              }`}
                              title={`ရွေးချယ်စရာ ${cnt} ခု ထားရန်`}
                            >
                              {cnt} ခု
                            </button>
                          ))}
                          {q.options.length < 8 && (
                            <button
                              type="button"
                              onClick={() => handleAddOptionToQuestion(qIdx)}
                              className="px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 text-[10px] font-extrabold cursor-pointer"
                              title="ရွေးချယ်စရာ အကွက် ၁ ခု ထပ်တိုးမည်"
                            >
                              + ထပ်တိုး
                            </button>
                          )}
                        </div>

                        {questions.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveQuestion(qIdx)}
                            className="text-rose-600 hover:underline text-[11px] font-bold flex items-center gap-1 cursor-pointer ml-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>မေးခွန်းဖျက်မည်</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <input
                      type="text"
                      value={q.question}
                      onChange={(e) => handleQuestionChange(qIdx, 'question', e.target.value)}
                      placeholder="မေးခွန်းစာသား ရိုက်ထည့်ပါ (မြန်မာစာ သို့မဟုတ် English)..."
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-bold"
                    />

                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                          ရွေးချယ်စရာ အဖြေများ (အဖြေမှန်ဖြစ်သော အကွက်ဘေးရှိ A, B, C ခလုတ်ကို နှိပ်၍ အစိမ်းရောင် အမှန်ခြစ်ပေးပါ):
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {q.options.map((opt, oIdx) => {
                          const isCorrect = q.correctIndex === oIdx;
                          const label = OPTION_LABELS[oIdx] || String(oIdx + 1);
                          return (
                            <div
                              key={oIdx}
                              className={`flex items-center gap-2 p-2 rounded-xl border ${
                                isCorrect
                                  ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500'
                                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => handleQuestionChange(qIdx, 'correctIndex', oIdx)}
                                className={`w-6 h-6 rounded-lg font-mono text-xs font-extrabold flex items-center justify-center shrink-0 cursor-pointer ${
                                  isCorrect
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                }`}
                                title="ဤအဖြေကို အဖြေမှန်အဖြစ် သတ်မှတ်ရန် နှိပ်ပါ"
                              >
                                {label}
                              </button>
                              <input
                                type="text"
                                value={opt}
                                onChange={(e) => handleOptionChange(qIdx, oIdx, e.target.value)}
                                placeholder={`Option ${label}`}
                                className="flex-1 bg-transparent text-slate-900 dark:text-white focus:outline-none text-xs min-w-0"
                              />
                              {isCorrect && (
                                <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 shrink-0">
                                  ✓ အဖြေမှန်
                                </span>
                              )}
                              {q.options.length > 2 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveOptionFromQuestion(qIdx, oIdx)}
                                  className="w-5 h-5 rounded-md hover:bg-rose-100 dark:hover:bg-rose-950/60 text-slate-400 hover:text-rose-600 flex items-center justify-center shrink-0 cursor-pointer"
                                  title="ဤရွေးချယ်စရာ အကွက်ကို လျှော့မည် (Remove Choice)"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <input
                        type="text"
                        value={q.explanation}
                        onChange={(e) =>
                          handleQuestionChange(qIdx, 'explanation', e.target.value)
                        }
                        placeholder="💡 အဖြေမှန် ရှင်းလင်းချက် / မှတ်ချက် (မထည့်လည်းရပါသည်)..."
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs"
                      />
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={handleAddQuestion}
                  className="w-full py-2.5 rounded-2xl border-2 border-dashed border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 font-extrabold hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>နောက်ထပ် မေးခွန်းတစ်ပုဒ် ထပ်ထည့်မည် (+ Add Question)</span>
                </button>
              </div>
            )}
          </div>

          {/* Save Footer */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 font-bold cursor-pointer"
            >
              မလုပ်တော့ပါ
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold shadow-sm cursor-pointer flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {initialQuiz
                  ? 'ပြင်ဆင်ချက်များ သိမ်းဆည်းမည် (Save Changes)'
                  : `Exam (${questions.length} ပုဒ်) လွှင့်တင်မည်`}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
