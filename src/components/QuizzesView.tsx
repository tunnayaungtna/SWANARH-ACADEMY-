import React, { useState, useEffect, useMemo } from 'react';
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
} from 'lucide-react';

interface QuizzesViewProps {
  course: Course;
  currentUser: User;
  onRefresh: () => void;
}

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

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

function formatScheduleDateTime(iso?: string): string {
  if (!iso) return '';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  return dt.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function getExamAvailability(quiz: Quiz, nowMs: number = Date.now()): ExamAvailabilityInfo {
  if (quiz.isOpen === false) {
    return {
      isAvailable: false,
      state: 'closed_manual',
      badgeLabel: '🔒 Exam ပိတ်ထားသည် (Closed)',
      detailText: 'ဆရာမှ စာမေးပွဲကို ယာယီပိတ်ထားပါသည်',
    };
  }

  const openMs = quiz.scheduledOpenAt ? new Date(quiz.scheduledOpenAt).getTime() : NaN;
  const closeMs = quiz.scheduledCloseAt ? new Date(quiz.scheduledCloseAt).getTime() : NaN;

  if (!Number.isNaN(openMs) && nowMs < openMs) {
    return {
      isAvailable: false,
      state: 'scheduled_future',
      badgeLabel: '🕒 အချိန်ဇယားဖြင့် ဖွင့်မည် (Scheduled)',
      detailText: `စတင်ဖြေဆိုနိုင်မည့်အချိန်: ${formatScheduleDateTime(quiz.scheduledOpenAt)}`,
    };
  }

  if (!Number.isNaN(closeMs) && nowMs > closeMs) {
    return {
      isAvailable: false,
      state: 'closed_expired',
      badgeLabel: '⏹️ ဖြေဆိုချိန် ကုန်ဆုံးပြီ (Ended)',
      detailText: `ပိတ်သိမ်းချိန်: ${formatScheduleDateTime(quiz.scheduledCloseAt)}`,
    };
  }

  if (!Number.isNaN(closeMs)) {
    return {
      isAvailable: true,
      state: 'open',
      badgeLabel: '🟢 Exam ဖွင့်ထားသည် (Open)',
      detailText: `ပိတ်မည့်အချိန်: ${formatScheduleDateTime(quiz.scheduledCloseAt)}`,
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

  // Live clock tick every 10s so scheduled Exam Open/Close times update automatically
  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 10_000);
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

  // Student overall quiz stats
  const studentStats = useMemo(() => {
    if (isInstructor) return null;
    let completed = 0;
    let passed = 0;
    let totalScore = 0;

    quizzes.forEach((q) => {
      const subs = ClassroomDB.getQuizSubmissions(q.id, currentUser.id);
      if (subs.length > 0) {
        completed++;
        totalScore += subs[0].score;
        if (subs[0].passed) passed++;
      }
    });

    return {
      total: quizzes.length,
      completed,
      passed,
      avgScore: completed > 0 ? Math.round(totalScore / completed) : 0,
    };
  }, [quizzes, currentUser.id, isInstructor, refreshTick]);

  // Instructor overall stats
  const instructorStats = useMemo(() => {
    if (!isInstructor) return null;
    let totalSubs = 0;
    let passedSubs = 0;
    let scoreSum = 0;

    quizzes.forEach((q) => {
      const subs = ClassroomDB.getAllQuizSubmissionsForQuiz(q.id);
      totalSubs += subs.length;
      subs.forEach((s) => {
        scoreSum += s.score;
        if (s.passed) passedSubs++;
      });
    });

    return {
      totalQuizzes: quizzes.length,
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
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-2xl bg-indigo-600/10 dark:bg-indigo-400/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                <FileQuestion className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                  Exam Room (စာမေးပွဲခန်း နှင့် လေ့ကျင့်ခန်း)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Schedule အချိန်ဇယား သို့မဟုတ် On/Off ခလုတ်ဖြင့် စာမေးပွဲအဖွင့်အပိတ် ထိန်းချုပ်နိုင်ပြီး ဖြေဆိုပြီးသည်နှင့် အမှတ်နှင့် အဖြေမှန်များကို ချက်ချင်း ကြည့်ရှုနိုင်ပါသည်
                </p>
              </div>
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
              <button
                type="button"
                onClick={() => setEditorQuiz('new')}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold shadow-sm flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Exam အသစ်ဖန်တီးမည်</span>
              </button>
            )}
          </div>
        </div>

        {/* Metrics Strip */}
        {isInstructor && instructorStats ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
            <div className="neu-inset-sm p-3 rounded-2xl">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Exam စုစုပေါင်း
              </div>
              <div className="text-lg font-extrabold text-indigo-600 dark:text-indigo-400 font-mono mt-0.5">
                {instructorStats.totalQuizzes} ခု
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
                  အောင်မြင်ပြီး (Passed)
                </div>
                <div className="text-lg font-extrabold text-amber-600 dark:text-amber-400 font-mono mt-0.5">
                  {studentStats.passed} ခု
                </div>
              </div>
            </div>
          )
        )}
      </div>

      {/* Exam List */}
      {quizzes.length === 0 ? (
        <div className="neu-card rounded-3xl p-8 sm:p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
            <FileQuestion className="w-6 h-6" />
          </div>
          <h4 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
            Exam Room တွင် စာမေးပွဲ မရှိသေးပါ
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
            {isInstructor
              ? 'ကျောင်းသားများ တစ်ပြိုင်တည်း ဖြေဆိုပြီး အမှတ်နှင့် အဖြေမှန်များကို ချက်ချင်း ကြည့်ရှုနိုင်မည့် Auto-Graded Exam သို့မဟုတ် Flashcard လေ့ကျင့်ခန်းများကို စတင်ဖန်တီးနိုင်ပါသည်။'
              : 'ဆရာမှ စာမေးပွဲ သို့မဟုတ် လေ့ကျင့်ခန်း Exam အသစ်တင်ပေးသည့်အခါ ဤနေရာတွင် ချက်ချင်း ပေါ်လာပါမည်။'}
          </p>
          {isInstructor && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setEditorQuiz('new')}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>ပထမဆုံး Exam စတင်ဖန်တီးမည်</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {quizzes.map((quiz) => {
            const cleanQuestions = (quiz.questions || []).filter(
              (q) => q && q.id !== '__quiz_meta__'
            );
            const mySubmissions = ClassroomDB.getQuizSubmissions(quiz.id, currentUser.id);
            const myLatestSub = mySubmissions[0];
            const allQuizSubs = isInstructor
              ? ClassroomDB.getAllQuizSubmissionsForQuiz(quiz.id)
              : [];
            const isPracticeMode = quiz.mode === 'practice';
            const availability = getExamAvailability(quiz, nowMs);
            const canStudentTakeQuiz =
              isInstructor || (availability.isAvailable && (!myLatestSub || isPracticeMode));

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
                        <span>{quiz.durationMinutes} မိနစ်</span>
                      </span>

                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">
                        <Award className="w-3 h-3 text-emerald-500" />
                        <span>အောင်မှတ် {quiz.passingScore}%</span>
                      </span>

                      {quiz.enableFlashcards !== false && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                          <Layers className="w-3 h-3" />
                          <span>Flashcards ပါဝင်သည်</span>
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
                            🟢 စတင်ချိန်: {formatScheduleDateTime(quiz.scheduledOpenAt)}
                          </span>
                        )}
                        {quiz.scheduledCloseAt && (
                          <span className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 font-mono">
                            🛑 ပိတ်သိမ်းချိန်: {formatScheduleDateTime(quiz.scheduledCloseAt)}
                          </span>
                        )}
                        {availability.detailText && !quiz.scheduledOpenAt && !quiz.scheduledCloseAt && (
                          <span className="text-rose-600 dark:text-rose-400">
                            {availability.detailText}
                          </span>
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
                          ဖြေဆိုပြီး · {myLatestSub.submittedAt}
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
                        {myLatestSub ? (
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
                                : 'စာမေးပွဲ စတင်ဖြေဆိုမည် (Start Exam)'}
                            </span>
                          </>
                        )}
                      </button>
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
 * 1. TAKE QUIZ / EXAM MODAL (Client-Side 0ms Auto-Grading + Countdown Timer)
 * ============================================================================ */
const TakeQuizModal: React.FC<{
  quiz: Quiz;
  currentUser: User;
  onClose: () => void;
  onSubmitted: (submission: QuizSubmission) => void;
}> = ({ quiz, currentUser, onClose, onSubmitted }) => {
  const questions = useMemo(
    () => (quiz.questions || []).filter((q) => q && q.id !== '__quiz_meta__'),
    [quiz.questions]
  );
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(60, (quiz.durationMinutes || 20) * 60)
  );
  const [startTimeMs] = useState(() => Date.now());
  const [showConfirmUnanswered, setShowConfirmUnanswered] = useState(false);

  const handleFinalSubmit = () => {
    const elapsedSec = Math.max(1, Math.round((Date.now() - startTimeMs) / 1000));
    const result = ClassroomDB.submitQuiz(quiz, answers, currentUser, elapsedSec);
    onSubmitted(result.submission);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (secondsLeft === 0) {
      handleFinalSubmit();
    }
  }, [secondsLeft]);

  if (questions.length === 0) return null;

  const currentQ = questions[currentIdx] || questions[0];
  const answeredCount = Object.keys(answers).length;
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl max-h-[94dvh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
        {/* Exam Header */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate">
              {quiz.title}
            </h3>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              ဖြေဆိုပြီး: {answeredCount} / {questions.length} ပုဒ် · အောင်မှတ်: {quiz.passingScore}%
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div
              className={`px-3 py-1.5 rounded-xl font-mono text-xs sm:text-sm font-extrabold flex items-center gap-1.5 border ${
                secondsLeft <= 60
                  ? 'bg-rose-600 text-white border-rose-600 animate-pulse'
                  : 'bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>
                {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="px-2.5 py-1.5 rounded-xl bg-slate-200/70 dark:bg-slate-800 hover:bg-rose-100 text-slate-600 dark:text-slate-300 hover:text-rose-600 text-xs font-bold cursor-pointer"
            >
              ✕ ပိတ်မည်
            </button>
          </div>
        </div>

        {/* Question Number Pills */}
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
            {currentQ.options.map((opt, oIdx) => {
              const isSelected = answers[currentQ.id] === oIdx;
              return (
                <button
                  key={oIdx}
                  type="button"
                  onClick={() =>
                    setAnswers((prev) => ({
                      ...prev,
                      [currentQ.id]: oIdx,
                    }))
                  }
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
                    {OPTION_LABELS[oIdx] || oIdx + 1}
                  </span>
                  <span className="text-xs sm:text-sm font-semibold leading-relaxed pt-0.5 break-words flex-1">
                    {opt}
                  </span>
                </button>
              );
            })}
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
                  onClick={handleFinalSubmit}
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
                  handleFinalSubmit();
                }
              }}
              className="px-4 sm:px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>အဖြေလွှာအပ်မည် ({answeredCount}/{questions.length})</span>
            </button>
          </div>
        </div>
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
                  <span>📅 {submission.submittedAt}</span>
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
                          ဖြေဆိုချိန်: {sub.submittedAt}{' '}
                          {sub.timeSpentSeconds
                            ? `· ကြာချိန် ${formatDurationSeconds(sub.timeSpentSeconds)}`
                            : ''}
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
  const [isOpen, setIsOpen] = useState<boolean>(initialQuiz?.isOpen !== false);
  const [scheduledOpenAt, setScheduledOpenAt] = useState<string>(
    initialQuiz?.scheduledOpenAt || ''
  );
  const [scheduledCloseAt, setScheduledCloseAt] = useState<string>(
    initialQuiz?.scheduledCloseAt || ''
  );

  const [inputTab, setInputTab] = useState<'builder' | 'bulk'>('builder');
  const [bulkText, setBulkText] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
      const openMs = new Date(scheduledOpenAt).getTime();
      const closeMs = new Date(scheduledCloseAt).getTime();
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
        isOpen,
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
              {course.code} — {course.title} (မြန်မာစာ + English နှစ်ဘာသာလုံးနှင့် Schedule On/Off စနစ် ပါဝင်သည်)
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
                  📝 စာမေးပွဲပုံစံ (Exam Mode — ၁ ကြိမ်ဖြေပြီး အမှတ်တန်းပြသည်)
                </option>
                <option value="practice">
                  🔄 လေ့ကျင့်ခန်းပုံစံ (Practice Mode — အကြိမ်ကြိမ် ပြန်ဖြေနိုင်သည်)
                </option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block font-extrabold text-slate-700 dark:text-slate-200 mb-1">
                  ဖြေဆိုချိန် (မိနစ်)
                </label>
                <input
                  type="number"
                  min={1}
                  max={180}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value) || 20)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-bold"
                />
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

            {/* Exam On/Off & Schedule Control Box */}
            <div className="sm:col-span-2 p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/70 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>Exam On/Off နှင့် Schedule (အချိန်ဇယားဖြင့် အလိုအလျောက် အဖွင့်/အပိတ်)</span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    စာမေးပွဲကို ချက်ချင်း အဖွင့်/အပိတ် လုပ်နိုင်သလို စတင်ဖွင့်မည့်အချိန်နှင့် ပိတ်မည့်အချိန်ကိုပါ ကြိုတင်သတ်မှတ်ထားနိုင်ပါသည်
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-extrabold text-slate-700 dark:text-slate-200">
                      🟢 စတင်ဖွင့်မည့်အချိန် (Scheduled Open)
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
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-extrabold text-slate-700 dark:text-slate-200">
                      🛑 အလိုအလျောက်ပိတ်မည့်အချိန် (Scheduled Close)
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
          </div>

          {/* Input Mode Switcher: Visual Builder vs Smart Paste */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
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

            {inputTab === 'bulk' ? (
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
