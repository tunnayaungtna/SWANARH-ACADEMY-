import React, { useState, useMemo } from 'react';
import {
  Course,
  User,
  AttendanceSession,
  AttendanceStatus,
  Quiz,
  QuizSubmission,
  BookDeliveryRecord,
  CertificateData,
} from '../types/classroom';
import { ClassroomDB } from '../services/storage';
import { AcademyLogo } from './AcademyLogo';
import {
  X,
  Download,
  Copy,
  Check,
  Award,
  CalendarCheck,
  FileQuestion,
  ClipboardList,
  Package,
  CheckCircle2,
  Clock,
  XCircle,
  TrendingUp,
  UserCheck,
  Sparkles,
  FileText,
} from 'lucide-react';

export interface StudentExamRecordItem {
  quiz: Quiz;
  submission?: QuizSubmission;
  questionCount: number;
  correctCount: number;
}

export interface StudentFormRecordItem {
  form: Quiz;
  submission?: QuizSubmission;
}

export interface StudentSessionAttendanceItem {
  session: AttendanceSession;
  status: AttendanceStatus;
  checkedInAt?: string;
  note?: string;
}

export interface StudentCoursePerformance {
  student: User;
  course: Course;
  rollNo: string;
  // Attendance
  totalSessions: number;
  presentCount: number;
  lateCount: number;
  excusedCount: number;
  absentCount: number;
  attendanceRate: number;
  sessionItems: StudentSessionAttendanceItem[];
  // Exams
  totalExams: number;
  completedExams: number;
  passedExams: number;
  examAverageScore: number;
  examItems: StudentExamRecordItem[];
  // Data Forms
  totalForms: number;
  completedForms: number;
  formItems: StudentFormRecordItem[];
  // Book Delivery
  bookRecord?: BookDeliveryRecord;
  bookStatusLabel: string;
  // Overall
  overallScore: number;
  gradeCode: 'A+' | 'A' | 'B' | 'C' | 'D';
  gradeLabel: string;
  gradeColorClass: string;
  isCertificateEligible: boolean;
}

export function computeStudentCoursePerformance(
  course: Course,
  student: User
): StudentCoursePerformance {
  // 1. Attendance
  const sessions = ClassroomDB.getAttendanceSessions(course.id);
  let presentCount = 0;
  let lateCount = 0;
  let excusedCount = 0;
  let absentCount = 0;

  const sessionItems: StudentSessionAttendanceItem[] = sessions.map((session) => {
    const rec = ClassroomDB.getStudentAttendanceRecord(session, student);
    const status: AttendanceStatus = rec?.status || 'absent';
    if (status === 'present') presentCount++;
    else if (status === 'late') lateCount++;
    else if (status === 'excused') excusedCount++;
    else absentCount++;

    return {
      session,
      status,
      checkedInAt: rec?.checkedInAt,
      note: rec?.note,
    };
  });

  const totalSessions = sessions.length;
  const attendanceRate =
    totalSessions > 0
      ? ClassroomDB.calculateTotalAttendancePercentage(course.id, student.id)
      : 100;

  // 2. Quizzes & Data Forms
  const allQuizzes = ClassroomDB.getQuizzes(course.id);
  const exams = allQuizzes.filter((q) => q.itemType !== 'data_form');
  const dataForms = allQuizzes.filter((q) => q.itemType === 'data_form');

  let completedExams = 0;
  let passedExams = 0;
  let totalExamScoreSum = 0;

  const examItems: StudentExamRecordItem[] = exams.map((quiz) => {
    const subs = ClassroomDB.getQuizSubmissions(quiz.id, student.id);
    const latest = subs[0];
    const validQuestions = (quiz.questions || []).filter(
      (q) => q && q.id !== '__quiz_meta__'
    );
    const questionCount = validQuestions.length;
    let correctCount = 0;

    if (latest) {
      completedExams++;
      totalExamScoreSum += latest.score;
      if (latest.passed) passedExams++;
      correctCount =
        typeof latest.correctCount === 'number'
          ? latest.correctCount
          : validQuestions.filter((q) => latest.answers?.[q.id] === q.correctIndex).length;
    }

    return {
      quiz,
      submission: latest,
      questionCount,
      correctCount,
    };
  });

  const totalExams = exams.length;
  const examAverageScore =
    completedExams > 0 ? Math.round(totalExamScoreSum / completedExams) : 0;

  let completedForms = 0;
  const formItems: StudentFormRecordItem[] = dataForms.map((form) => {
    const subs = ClassroomDB.getQuizSubmissions(form.id, student.id);
    const latest = subs[0];
    if (latest) completedForms++;
    return {
      form,
      submission: latest,
    };
  });

  const totalForms = dataForms.length;

  // 3. Book Delivery
  const bookRecord = ClassroomDB.getStudentBookDelivery(course.id, student.id);
  const rollNo = bookRecord?.rollNo ? String(bookRecord.rollNo).trim() : '';
  const bookStatusLabel = !bookRecord
    ? 'လိပ်စာ မဖြည့်ရသေး'
    : bookRecord.status === 'received'
    ? 'စာအုပ်ရရှိပြီး (Received ✅)'
    : bookRecord.status === 'shipped'
    ? 'ပို့ဆောင်ပြီး (Shipped 🚚)'
    : bookRecord.status === 'printed'
    ? 'PDF ထုတ်ပြီး (Printed 🖨️)'
    : 'လိပ်စာပေးပို့ပြီး (Pending 📦)';

  // 4. Overall Composite Score & Grade
  let overallScore = attendanceRate;
  if (totalExams > 0 && completedExams > 0) {
    overallScore = Math.round(attendanceRate * 0.5 + examAverageScore * 0.5);
  } else if (totalExams > 0 && completedExams === 0 && totalSessions > 0) {
    overallScore = Math.round(attendanceRate * 0.75);
  }

  let gradeCode: 'A+' | 'A' | 'B' | 'C' | 'D' = 'A+';
  let gradeLabel = 'A+ (ဂုဏ်ထူးဆောင် ထူးချွန် - Distinction)';
  let gradeColorClass =
    'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700';

  if (overallScore >= 90) {
    gradeCode = 'A+';
    gradeLabel = 'A+ (ဂုဏ်ထူးဆောင် ထူးချွန် - Distinction)';
    gradeColorClass =
      'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700';
  } else if (overallScore >= 80) {
    gradeCode = 'A';
    gradeLabel = 'A (အထူးကောင်းမွန် - Excellent)';
    gradeColorClass =
      'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700';
  } else if (overallScore >= 70) {
    gradeCode = 'B';
    gradeLabel = 'B (ကောင်းမွန် - Good)';
    gradeColorClass =
      'bg-cyan-100 dark:bg-cyan-950/80 text-cyan-800 dark:text-cyan-300 border-cyan-300 dark:border-cyan-700';
  } else if (overallScore >= 50) {
    gradeCode = 'C';
    gradeLabel = 'C (သင့်တင့် - Satisfactory)';
    gradeColorClass =
      'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700';
  } else {
    gradeCode = 'D';
    gradeLabel = 'သတိပြုရန် လိုအပ် (Needs Attention)';
    gradeColorClass =
      'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-700';
  }

  return {
    student,
    course,
    rollNo,
    totalSessions,
    presentCount,
    lateCount,
    excusedCount,
    absentCount,
    attendanceRate,
    sessionItems,
    totalExams,
    completedExams,
    passedExams,
    examAverageScore,
    examItems,
    totalForms,
    completedForms,
    formItems,
    bookRecord: bookRecord || undefined,
    bookStatusLabel,
    overallScore,
    gradeCode,
    gradeLabel,
    gradeColorClass,
    isCertificateEligible: attendanceRate >= 75,
  };
}

export function exportClassPerformanceCsv(course: Course, students: User[]): void {
  const headers = [
    'စဉ် (No.)',
    'Roll No.',
    'ကျောင်းသားအမည် (Student Name)',
    'Username',
    'ဖုန်းနံပါတ် (Phone)',
    'Attendance (%)',
    'Present (ကြိမ်)',
    'Late (ကြိမ်)',
    'Excused/ခွင့် (ကြိမ်)',
    'Absent/ပျက် (ကြိမ်)',
    'Exam ဖြေဆိုပြီး',
    'Exam ပျမ်းမျှရမှတ် (%)',
    'Exam အောင်မြင်မှု',
    'Data Form ဖြည့်ပြီး',
    'စာအုပ်ရရှိမှု အခြေအနေ (Book Delivery)',
    'စုစုပေါင်းအဆင့် (Overall Score & Grade)',
  ];

  const rows: string[][] = [headers];

  students.forEach((student, idx) => {
    const perf = computeStudentCoursePerformance(course, student);
    rows.push([
      String(idx + 1),
      perf.rollNo || '-',
      student.name,
      `@${student.username}`,
      student.phone || '-',
      `${perf.attendanceRate}%`,
      String(perf.presentCount),
      String(perf.lateCount),
      String(perf.excusedCount),
      String(perf.absentCount),
      `${perf.completedExams}/${perf.totalExams}`,
      perf.completedExams > 0 ? `${perf.examAverageScore}%` : '-',
      `${perf.passedExams}/${perf.totalExams}`,
      `${perf.completedForms}/${perf.totalForms}`,
      perf.bookStatusLabel,
      `${perf.overallScore}% (${perf.gradeCode})`,
    ]);
  });

  const escapeCsvCell = (val: string) => {
    let clean = String(val ?? '');
    if (/^[=+\-@\t\r]/.test(clean)) {
      clean = `'${clean}`;
    }
    return `"${clean.replace(/"/g, '""')}"`;
  };

  const csvContent =
    '\uFEFF' + rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeCode = (course.code || 'Course').replace(/[^a-zA-Z0-9_-]/g, '_');
  link.href = url;
  link.download = `SwanArh_ReportCard_Summary_${safeCode}_${students.length}Students.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] || '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function buildSinglePageA4PortraitPdf(
  jpegBytes: Uint8Array,
  widthPx: number,
  heightPx: number
): Blob {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let byteOffset = 0;

  const pushStr = (s: string) => {
    const arr = encoder.encode(s);
    chunks.push(arr);
    byteOffset += arr.length;
  };
  const pushBytes = (arr: Uint8Array) => {
    chunks.push(arr);
    byteOffset += arr.length;
  };
  const startObj = (id: number) => {
    offsets[id] = byteOffset;
    pushStr(`${id} 0 obj\n`);
  };
  const endObj = () => {
    pushStr('\nendobj\n');
  };

  const pageW = 595.28; // A4 Portrait width in pt
  const pageH = 841.89; // A4 Portrait height in pt

  pushStr('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');

  startObj(1);
  pushStr('<< /Type /Catalog /Pages 2 0 R >>');
  endObj();

  startObj(2);
  pushStr('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  endObj();

  startObj(3);
  pushStr(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW.toFixed(2)} ${pageH.toFixed(
      2
    )}] /Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>`
  );
  endObj();

  startObj(4);
  pushStr(
    `<< /Type /XObject /Subtype /Image /Width ${widthPx} /Height ${heightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`
  );
  pushBytes(jpegBytes);
  pushStr('\nendstream');
  endObj();

  const contentStream = `q\n${pageW.toFixed(2)} 0 0 ${pageH.toFixed(2)} 0 0 cm\n/Im1 Do\nQ\n`;
  const contentBytes = encoder.encode(contentStream);
  startObj(5);
  pushStr(`<< /Length ${contentBytes.length} >>\nstream\n`);
  pushBytes(contentBytes);
  pushStr('endstream');
  endObj();

  const xrefOffset = byteOffset;
  pushStr('xref\n0 6\n0000000000 65535 f \n');
  for (let id = 1; id <= 5; id++) {
    const off = String(offsets[id] || 0).padStart(10, '0');
    pushStr(`${off} 00000 n \n`);
  }
  pushStr(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  return new Blob(chunks as unknown as BlobPart[], { type: 'application/pdf' });
}

export async function downloadStudentReportCardPdf(
  perf: StudentCoursePerformance,
  showUsername: boolean
): Promise<void> {
  const canvas = document.createElement('canvas');
  const W = 1240;
  const H = 1754;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const fontStack =
    '"Padauk", "Myanmar Text", "Pyidaungsu", "Plus Jakarta Sans", sans-serif';

  // Background
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, W, H);

  // Outer Border Card
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(40, 40, W - 80, H - 80);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  ctx.strokeRect(40, 40, W - 80, H - 80);

  // Header Banner
  const grad = ctx.createLinearGradient(40, 40, W - 40, 220);
  grad.addColorStop(0, '#0f172a');
  grad.addColorStop(0.5, '#1e3a8a');
  grad.addColorStop(1, '#065f46');
  ctx.fillStyle = grad;
  ctx.fillRect(40, 40, W - 80, 175);

  ctx.fillStyle = '#34d399';
  ctx.font = `800 18px ${fontStack}`;
  ctx.fillText('SWANARH DIGITAL ACADEMY · OFFICIAL STUDENT REPORT CARD', 80, 92);

  ctx.fillStyle = '#ffffff';
  ctx.font = `800 34px ${fontStack}`;
  ctx.fillText('ကျောင်းသား သင်ယူတိုးတက်မှု မှတ်တမ်းချုပ် (Report Card)', 80, 142);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = `600 20px ${fontStack}`;
  ctx.fillText(
    `${perf.course.code} — ${perf.course.title} (${perf.course.batch})`,
    80,
    185
  );

  // Student Profile Box
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(75, 245, W - 150, 155);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(75, 245, W - 150, 155);

  ctx.fillStyle = '#0f172a';
  ctx.font = `800 28px ${fontStack}`;
  ctx.fillText(`အမည်: ${perf.student.name}`, 105, 295);

  ctx.fillStyle = '#334155';
  ctx.font = `700 20px ${fontStack}`;
  const idLine = [
    perf.rollNo ? `Roll No: ${perf.rollNo}` : '',
    showUsername ? `Username: @${perf.student.username}` : '',
    perf.student.title ? `အလုပ်အကိုင်/ပညာ: ${perf.student.title}` : '',
  ]
    .filter(Boolean)
    .join('   |   ');
  ctx.fillText(idLine || `သင်တန်းသား အမှတ်စဉ်: ${perf.student.id.slice(0, 8)}`, 105, 335);

  ctx.fillStyle = '#475569';
  ctx.font = `600 18px ${fontStack}`;
  ctx.fillText(
    `ထုတ်ပေးသည့်ရက်စွဲ (MMT): ${ClassroomDB.formatMyanmarDateTime(Date.now(), true)}`,
    105,
    375
  );

  // Overall Grade Badge on Right of Profile Box
  ctx.fillStyle = perf.overallScore >= 80 ? '#059669' : perf.overallScore >= 60 ? '#2563eb' : '#d97706';
  ctx.fillRect(W - 390, 268, 290, 108);
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 18px ${fontStack}`;
  ctx.textAlign = 'center';
  ctx.fillText('OVERALL PERFORMANCE', W - 245, 302);
  ctx.font = `900 36px ${fontStack}`;
  ctx.fillText(`${perf.overallScore}% (${perf.gradeCode})`, W - 245, 350);
  ctx.textAlign = 'left';

  // 4 Key Metric Cards
  const cardY = 430;
  const cardW = (W - 150 - 45) / 4;
  const cardH = 145;
  const metrics = [
    {
      title: '၁။ Attendance (တက်ရောက်မှု)',
      val: `${perf.attendanceRate}%`,
      sub: `Present ${perf.presentCount} · Late ${perf.lateCount} · ခွင့် ${perf.excusedCount} · ပျက် ${perf.absentCount}`,
      color: '#059669',
    },
    {
      title: '၂။ Exam ပျမ်းမျှရမှတ်',
      val: perf.completedExams > 0 ? `${perf.examAverageScore}%` : 'မဖြေရသေး',
      sub: `ဖြေဆိုပြီး ${perf.completedExams}/${perf.totalExams} ခု (အောင် ${perf.passedExams} ခု)`,
      color: '#4f46e5',
    },
    {
      title: '၃။ Data Form ဖြည့်သွင်းမှု',
      val: `${perf.completedForms} / ${perf.totalForms}`,
      sub:
        perf.totalForms === 0
          ? 'တောင်းခံထားသော Form မရှိသေးပါ'
          : perf.completedForms >= perf.totalForms
          ? 'အားလုံး ဖြည့်သွင်းပြီး ✓'
          : 'ဖြည့်သွင်းရန် ကျန်ရှိသေးသည်',
      color: '#0d9488',
    },
    {
      title: '၄။ သင်တန်းစာအုပ် ရရှိမှု',
      val: !perf.bookRecord
        ? 'မဖြည့်ရသေး'
        : perf.bookRecord.status === 'received'
        ? 'ရရှိပြီး ✓'
        : perf.bookRecord.status === 'shipped'
        ? 'ပို့ဆောင်ပြီး'
        : 'လိပ်စာပို့ပြီး',
      sub: perf.bookRecord?.note || 'Book Delivery Status',
      color: '#d97706',
    },
  ];

  metrics.forEach((m, i) => {
    const cx = 75 + i * (cardW + 15);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx, cardY, cardW, cardH);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cx, cardY, cardW, cardH);

    ctx.fillStyle = m.color;
    ctx.fillRect(cx, cardY, cardW, 7);

    ctx.fillStyle = '#475569';
    ctx.font = `700 16px ${fontStack}`;
    ctx.fillText(m.title, cx + 16, cardY + 38, cardW - 32);

    ctx.fillStyle = '#0f172a';
    ctx.font = `800 30px ${fontStack}`;
    ctx.fillText(m.val, cx + 16, cardY + 86, cardW - 32);

    ctx.fillStyle = '#64748b';
    ctx.font = `600 14px ${fontStack}`;
    ctx.fillText(m.sub, cx + 16, cardY + 122, cardW - 32);
  });

  // Section: Exam Results Table
  let curY = 620;
  ctx.fillStyle = '#0f172a';
  ctx.font = `800 22px ${fontStack}`;
  ctx.fillText(
    `📝 စာမေးပွဲ ရမှတ်မှတ်တမ်းများ (Exam Room Results — ${perf.completedExams}/${perf.totalExams})`,
    75,
    curY
  );
  curY += 20;

  // Table Header
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(75, curY, W - 150, 44);
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 16px ${fontStack}`;
  ctx.fillText('စဉ်', 95, curY + 28);
  ctx.fillText('စာမေးပွဲ ခေါင်းစဉ် (Exam Title)', 155, curY + 28);
  ctx.fillText('အဖြေမှန်', 730, curY + 28);
  ctx.fillText('ရမှတ် (%)', 860, curY + 28);
  ctx.fillText('အခြေအနေ', 990, curY + 28);
  curY += 44;

  const maxExamsToShow = Math.min(8, perf.examItems.length);
  if (maxExamsToShow === 0) {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(75, curY, W - 150, 52);
    ctx.strokeStyle = '#e2e8f0';
    ctx.strokeRect(75, curY, W - 150, 52);
    ctx.fillStyle = '#64748b';
    ctx.font = `600 16px ${fontStack}`;
    ctx.fillText('ဤအတန်းတွင် စာမေးပွဲ (Exam) မရှိသေးပါ။', 95, curY + 32);
    curY += 68;
  } else {
    for (let i = 0; i < maxExamsToShow; i++) {
      const item = perf.examItems[i];
      const rowH = 48;
      ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#f8fafc';
      ctx.fillRect(75, curY, W - 150, rowH);
      ctx.strokeStyle = '#e2e8f0';
      ctx.strokeRect(75, curY, W - 150, rowH);

      ctx.fillStyle = '#334155';
      ctx.font = `700 16px ${fontStack}`;
      ctx.fillText(`${i + 1}.`, 95, curY + 30);
      ctx.fillText(item.quiz.title, 155, curY + 30, 550);

      if (item.submission) {
        ctx.fillText(`${item.correctCount} / ${item.questionCount}`, 730, curY + 30);
        ctx.font = `800 17px ${fontStack}`;
        ctx.fillStyle = item.submission.passed ? '#059669' : '#d97706';
        ctx.fillText(`${item.submission.score}%`, 860, curY + 30);
        ctx.fillText(item.submission.passed ? 'PASS ✓' : 'RETRY', 990, curY + 30);
      } else {
        ctx.fillStyle = '#94a3b8';
        ctx.fillText('-', 730, curY + 30);
        ctx.fillText('-', 860, curY + 30);
        ctx.fillText('မဖြေရသေး', 990, curY + 30);
      }
      curY += rowH;
    }
    curY += 28;
  }

  // Section: Recent Attendance History
  ctx.fillStyle = '#0f172a';
  ctx.font = `800 22px ${fontStack}`;
  ctx.fillText(
    `📅 အတန်းတက်ရောက်မှု မှတ်တမ်း (Recent Attendance Sessions — စုစုပေါင်း ${perf.totalSessions} ကြိမ်)`,
    75,
    curY
  );
  curY += 20;

  ctx.fillStyle = '#065f46';
  ctx.fillRect(75, curY, W - 150, 44);
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 16px ${fontStack}`;
  ctx.fillText('စဉ်', 95, curY + 28);
  ctx.fillText('နေ့စွဲ (Date)', 155, curY + 28);
  ctx.fillText('သင်ခန်းစာ / အတန်းချိန် (Session Title)', 360, curY + 28);
  ctx.fillText('တက်ရောက်မှု အခြေအနေ', 900, curY + 28);
  curY += 44;

  const maxSessionsToShow = Math.min(9, perf.sessionItems.length);
  if (maxSessionsToShow === 0) {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(75, curY, W - 150, 52);
    ctx.strokeStyle = '#e2e8f0';
    ctx.strokeRect(75, curY, W - 150, 52);
    ctx.fillStyle = '#64748b';
    ctx.font = `600 16px ${fontStack}`;
    ctx.fillText('Attendance မှတ်တမ်း မရှိသေးပါ။', 95, curY + 32);
    curY += 68;
  } else {
    for (let i = 0; i < maxSessionsToShow; i++) {
      const item = perf.sessionItems[i];
      const rowH = 44;
      ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#f8fafc';
      ctx.fillRect(75, curY, W - 150, rowH);
      ctx.strokeStyle = '#e2e8f0';
      ctx.strokeRect(75, curY, W - 150, rowH);

      ctx.fillStyle = '#334155';
      ctx.font = `700 15px ${fontStack}`;
      ctx.fillText(`${i + 1}.`, 95, curY + 28);
      ctx.fillText(item.session.date, 155, curY + 28);
      ctx.fillText(item.session.title, 360, curY + 28, 510);

      const stLabel =
        item.status === 'present'
          ? 'Present (တက်ရောက် ✓)'
          : item.status === 'late'
          ? 'Late (နောက်ကျ ⏰)'
          : item.status === 'excused'
          ? 'Excused (ခွင့် 📝)'
          : 'Absent (ပျက်ကွက် ✕)';
      ctx.fillStyle =
        item.status === 'present'
          ? '#059669'
          : item.status === 'late'
          ? '#d97706'
          : item.status === 'excused'
          ? '#4f46e5'
          : '#e11d48';
      ctx.font = `800 15px ${fontStack}`;
      ctx.fillText(stLabel, 900, curY + 28);
      curY += rowH;
    }
  }

  // Footer
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(75, H - 140, W - 150, 65);
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 16px ${fontStack}`;
  ctx.fillText(
    'SwanArh Digital Academy — Verified Academic Progress Report Card',
    105,
    H - 100
  );
  ctx.fillStyle = '#34d399';
  ctx.textAlign = 'right';
  ctx.fillText('www.swanarhacademy.com', W - 105, H - 100);
  ctx.textAlign = 'left';

  const jpegUrl = canvas.toDataURL('image/jpeg', 0.94);
  const pdfBlob = buildSinglePageA4PortraitPdf(dataUrlToUint8Array(jpegUrl), W, H);
  const url = URL.createObjectURL(pdfBlob);
  const link = document.createElement('a');
  const safeName = (perf.student.username || perf.student.name || 'Student').replace(
    /[^a-zA-Z0-9_-]/g,
    '_'
  );
  const safeCourse = (perf.course.code || 'Course').replace(/[^a-zA-Z0-9_-]/g, '_');
  link.href = url;
  link.download = `SwanArh_ReportCard_${safeCourse}_${safeName}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 8000);
}

interface StudentReportCardModalProps {
  course: Course;
  student: User;
  currentUser: User;
  onClose: () => void;
  onOpenCertificate?: (cert: CertificateData) => void;
}

export const StudentReportCardModal: React.FC<StudentReportCardModalProps> = ({
  course,
  student,
  currentUser,
  onClose,
  onOpenCertificate,
}) => {
  const isStaff = currentUser.role === 'admin' || currentUser.role === 'co_admin';
  const isSelf = currentUser.id === student.id;
  const showUsername = isStaff || isSelf;

  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState<'overview' | 'attendance' | 'exams'>(
    'overview'
  );

  const perf = useMemo(
    () => computeStudentCoursePerformance(course, student),
    [course, student]
  );

  const handleDownloadPdf = async () => {
    setIsDownloadingPdf(true);
    try {
      await downloadStudentReportCardPdf(perf, showUsername);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleCopySummaryText = () => {
    const lines = [
      `📊 SwanArh Digital Academy — ကျောင်းသား Report Card`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `📚 အတန်း: ${course.code} — ${course.title} (${course.batch})`,
      `👤 အမည်: ${student.name}${perf.rollNo ? ` (Roll No. ${perf.rollNo})` : ''}`,
      ...(showUsername ? [`🔑 Username: @${student.username}`] : []),
      `🏆 စုစုပေါင်းအဆင့်: ${perf.overallScore}% — ${perf.gradeLabel}`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `✅ Attendance တက်ရောက်မှု: ${perf.attendanceRate}% (Present ${perf.presentCount} / Late ${perf.lateCount} / ခွင့် ${perf.excusedCount} / ပျက် ${perf.absentCount} — စုစုပေါင်း ${perf.totalSessions} ကြိမ်)`,
      `📝 Exam ဖြေဆိုမှု: ${perf.completedExams}/${perf.totalExams} ခု (ပျမ်းမျှရမှတ်: ${
        perf.completedExams > 0 ? `${perf.examAverageScore}%` : 'မဖြေရသေး'
      } · အောင်မြင် ${perf.passedExams} ခု)`,
      `📋 Data Form ဖြည့်သွင်းမှု: ${perf.completedForms}/${perf.totalForms} ခု`,
      `📦 သင်တန်းစာအုပ် အခြေအနေ: ${perf.bookStatusLabel}`,
      `━━━━━━━━━━━━━━━━━━━━`,
    ];
    navigator.clipboard.writeText(lines.join('\n')).catch(() => {});
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 3000);
  };

  const handleOpenCert = () => {
    if (!onOpenCertificate) return;
    onOpenCertificate({
      certificateId: `CERT-${course.code}-${student.id.slice(-4).toUpperCase()}`,
      courseId: course.id,
      courseTitle: course.title,
      courseCode: course.code,
      studentId: student.id,
      studentName: student.name,
      issuedAt: new Date().toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }),
      gradeAverage: perf.overallScore,
      attendancePercentage: perf.attendanceRate,
      verificationUrl: `https://swanarh.edu.mm/verify/CERT-${course.code}-${student.id.slice(-4).toUpperCase()}`,
      instructorSignature: course.instructorName,
    });
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-4xl max-h-[94dvh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden"
      >
        {/* Top Gradient Header */}
        <div className="px-4 sm:px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-emerald-950 text-white flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-1.5 rounded-2xl bg-white/10 border border-white/15 shrink-0">
              <AcademyLogo size="sm" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-extrabold">
                  📊 Official Student Report Card
                </span>
                <span className="text-xs font-mono text-indigo-200 truncate">
                  {course.code} · {course.batch}
                </span>
              </div>
              <h3 className="text-sm sm:text-lg font-extrabold text-white truncate mt-0.5">
                {student.name} — သင်ယူတိုးတက်မှု မှတ်တမ်းချုပ်
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopySummaryText}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
              title="Report Card အကျဉ်းချုပ် စာသားကို Copy ကူးယူရန်"
            >
              {copiedSummary ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">စာသား Copy ကူးမည်</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-extrabold shadow-sm flex items-center gap-1.5 cursor-pointer transition-colors"
              title="A4 Report Card PDF ဖိုင်အဖြစ် ဒေါင်းလုဒ်ဆွဲရန်"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isDownloadingPdf ? 'PDF ထုတ်နေသည်...' : '📄 PDF Report Card ထုတ်မည်'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-rose-600/80 text-white cursor-pointer transition-colors"
              title="ပိတ်မည် (Close)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Report Card Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* Student Identity & Overall Standing Banner */}
          <div className="neu-inset-sm p-4 sm:p-5 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-indigo-500/15">
            <div className="space-y-1.5 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-base sm:text-xl font-extrabold text-slate-900 dark:text-white">
                  {student.name}
                </h4>
                {perf.rollNo && (
                  <span className="px-2.5 py-0.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-mono font-extrabold">
                    Roll No. ({perf.rollNo})
                  </span>
                )}
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold border ${perf.gradeColorClass}`}>
                  {perf.gradeLabel}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-300 font-mono">
                {showUsername && <span className="font-bold text-indigo-600 dark:text-indigo-400">@{student.username}</span>}
                {isStaff && student.phone && <span>📞 {student.phone}</span>}
                {student.title && <span className="font-sans">💼 {student.title}</span>}
                {isStaff && student.address && <span className="font-sans">📍 {student.address}</span>}
              </div>

              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                အတန်း: <strong className="text-slate-800 dark:text-slate-200">{course.title}</strong> ({course.section})
              </div>
            </div>

            {/* Right: Overall Score Circle & Certificate Action */}
            <div className="flex items-center gap-3 self-start md:self-center shrink-0">
              <div className="px-4 py-3 rounded-2xl bg-indigo-600 text-white text-center shadow-md min-w-[110px]">
                <div className="text-[10px] uppercase tracking-wider font-bold opacity-85">
                  Overall Score
                </div>
                <div className="text-2xl font-black font-mono leading-tight">
                  {perf.overallScore}%
                </div>
                <div className="text-[11px] font-extrabold text-emerald-300">
                  Grade: {perf.gradeCode}
                </div>
              </div>

              {perf.isCertificateEligible && onOpenCertificate && (
                <button
                  type="button"
                  onClick={handleOpenCert}
                  className="px-3.5 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-extrabold shadow-sm flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors"
                  title="သင်တန်းဆင်းဂုဏ်ပြုလက်မှတ် (Certificate) ထုတ်ယူရန်"
                >
                  <Award className="w-5 h-5" />
                  <span>🎓 Certificate</span>
                </button>
              )}
            </div>
          </div>

          {/* 4 Pillar Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* 1. Attendance Card */}
            <div className="neu-card rounded-2xl p-4 space-y-2 border-l-4 border-emerald-500">
              <div className="flex items-center justify-between text-xs font-extrabold text-emerald-700 dark:text-emerald-400">
                <span className="flex items-center gap-1.5">
                  <CalendarCheck className="w-4 h-4" />
                  <span>၁။ Attendance</span>
                </span>
                <span className="font-mono text-base">{perf.attendanceRate}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${Math.min(100, perf.attendanceRate)}%` }}
                />
              </div>
              <div className="grid grid-cols-2 gap-1 pt-1 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                <span>✅ Present: {perf.presentCount}</span>
                <span>⏰ Late: {perf.lateCount}</span>
                <span>📝 ခွင့် (Excused): {perf.excusedCount}</span>
                <span>❌ ပျက် (Absent): {perf.absentCount}</span>
              </div>
            </div>

            {/* 2. Exam Performance Card */}
            <div className="neu-card rounded-2xl p-4 space-y-2 border-l-4 border-indigo-500">
              <div className="flex items-center justify-between text-xs font-extrabold text-indigo-700 dark:text-indigo-400">
                <span className="flex items-center gap-1.5">
                  <FileQuestion className="w-4 h-4" />
                  <span>၂။ Exam ရမှတ်ချုပ်</span>
                </span>
                <span className="font-mono text-base">
                  {perf.completedExams > 0 ? `${perf.examAverageScore}%` : '-'}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all"
                  style={{ width: `${Math.min(100, perf.examAverageScore)}%` }}
                />
              </div>
              <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300 space-y-0.5 pt-1">
                <div>
                  ဖြေဆိုပြီး: <strong>{perf.completedExams}</strong> / {perf.totalExams} ခု
                </div>
                <div className="text-emerald-600 dark:text-emerald-400">
                  အောင်မြင်ပြီး (Passed): <strong>{perf.passedExams}</strong> ခု
                </div>
              </div>
            </div>

            {/* 3. Data Forms Completion Card */}
            <div className="neu-card rounded-2xl p-4 space-y-2 border-l-4 border-teal-500">
              <div className="flex items-center justify-between text-xs font-extrabold text-teal-700 dark:text-teal-400">
                <span className="flex items-center gap-1.5">
                  <ClipboardList className="w-4 h-4" />
                  <span>၃။ Data Forms</span>
                </span>
                <span className="font-mono text-base">
                  {perf.completedForms}/{perf.totalForms}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-teal-500 rounded-full transition-all"
                  style={{
                    width: `${
                      perf.totalForms > 0
                        ? Math.min(100, Math.round((perf.completedForms / perf.totalForms) * 100))
                        : 100
                    }%`,
                  }}
                />
              </div>
              <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300 pt-1">
                {perf.totalForms === 0 ? (
                  <span>တောင်းခံထားသော Form မရှိသေးပါ</span>
                ) : perf.completedForms >= perf.totalForms ? (
                  <span className="text-emerald-600 dark:text-emerald-400">
                    ✓ တောင်းခံလွှာအားလုံး ဖြည့်ပြီး
                  </span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400">
                    ⏳ ဖြည့်သွင်းရန် {perf.totalForms - perf.completedForms} ခု ကျန်ရှိ
                  </span>
                )}
              </div>
            </div>

            {/* 4. Book Delivery Status Card */}
            <div className="neu-card rounded-2xl p-4 space-y-2 border-l-4 border-amber-500">
              <div className="flex items-center justify-between text-xs font-extrabold text-amber-700 dark:text-amber-400">
                <span className="flex items-center gap-1.5">
                  <Package className="w-4 h-4" />
                  <span>၄။ သင်တန်းစာအုပ်</span>
                </span>
                {perf.rollNo && (
                  <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200">
                    #{perf.rollNo}
                  </span>
                )}
              </div>
              <div className="text-xs font-extrabold text-slate-900 dark:text-white pt-0.5">
                {perf.bookStatusLabel}
              </div>
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                {perf.bookRecord
                  ? `🚚 ${perf.bookRecord.note || 'Royal Express'}`
                  : 'စာအုပ်ယူရန် Tab တွင် လိပ်စာဖြည့်နိုင်သည်'}
              </div>
            </div>
          </div>

          {/* Sub-Tab Switcher for Detailed Breakdown */}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2.5">
            <button
              type="button"
              onClick={() => setActiveDetailTab('overview')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer transition-all ${
                activeDetailTab === 'overview'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              📊 အသေးစိတ် အားလုံးကြည့်ရန် (All Details)
            </button>
            <button
              type="button"
              onClick={() => setActiveDetailTab('exams')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer transition-all ${
                activeDetailTab === 'exams'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              📝 စာမေးပွဲ နှင့် Form များ ({perf.totalExams + perf.totalForms})
            </button>
            <button
              type="button"
              onClick={() => setActiveDetailTab('attendance')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer transition-all ${
                activeDetailTab === 'attendance'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              📅 Attendance ရက်စွဲအလိုက် ({perf.totalSessions})
            </button>
          </div>

          {/* Exam & Data Form Breakdown */}
          {(activeDetailTab === 'overview' || activeDetailTab === 'exams') && (
            <div className="space-y-4">
              {/* Exams List */}
              <div className="space-y-2.5">
                <h5 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <FileQuestion className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>
                    စာမေးပွဲ ရမှတ်စာရင်း (Exam Results — {perf.completedExams}/{perf.totalExams})
                  </span>
                </h5>

                {perf.examItems.length === 0 ? (
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-500 dark:text-slate-400 text-center">
                    ဤအတန်းတွင် စာမေးပွဲ (Exam) မရှိသေးပါ။
                  </div>
                ) : (
                  <div className="space-y-2">
                    {perf.examItems.map((item, idx) => (
                      <div
                        key={item.quiz.id}
                        className="p-3 sm:p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="font-extrabold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-indigo-600 dark:text-indigo-400">
                              #{idx + 1}
                            </span>
                            <span>{item.quiz.title}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono">
                              {item.questionCount} ပုဒ် · အောင်မှတ် {item.quiz.passingScore}%
                            </span>
                          </div>
                          {item.submission && (
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                              ဖြေဆိုချိန်: {item.submission.submittedAt}
                            </div>
                          )}
                        </div>

                        {item.submission ? (
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-200">
                              အဖြေမှန် {item.correctCount}/{item.questionCount}
                            </span>
                            <span
                              className={`px-3 py-1 rounded-xl font-mono font-extrabold text-xs ${
                                item.submission.passed
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-amber-600 text-white'
                              }`}
                            >
                              {item.submission.score}% ({item.submission.passed ? 'PASS ✓' : 'RETRY'})
                            </span>
                          </div>
                        ) : (
                          <span className="px-2.5 py-1 rounded-xl bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 font-bold text-[11px] self-start sm:self-auto shrink-0">
                            ⏳ မဖြေရသေးပါ
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Data Forms List */}
              {perf.formItems.length > 0 && (
                <div className="space-y-2.5 pt-2">
                  <h5 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                    <span>
                      အချက်အလက် တောင်းခံလွှာများ (Data Forms — {perf.completedForms}/
                      {perf.totalForms})
                    </span>
                  </h5>
                  <div className="space-y-2">
                    {perf.formItems.map((item, idx) => (
                      <div
                        key={item.form.id}
                        className="p-3 rounded-2xl bg-teal-50/50 dark:bg-teal-950/30 border border-teal-200/70 dark:border-teal-800/60 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="font-bold text-slate-900 dark:text-white truncate">
                          <span className="font-mono text-teal-600 mr-1.5">#{idx + 1}</span>
                          {item.form.title}
                        </div>
                        {item.submission ? (
                          <span className="px-2.5 py-1 rounded-xl bg-emerald-600 text-white text-[11px] font-extrabold shrink-0">
                            ✓ ဖြည့်သွင်းပြီး ({item.submission.submittedAt})
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-[11px] font-bold shrink-0">
                            ⏳ မဖြည့်ရသေး
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Attendance Session-by-Session History */}
          {(activeDetailTab === 'overview' || activeDetailTab === 'attendance') && (
            <div className="space-y-2.5">
              <h5 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <CalendarCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>
                  ရက်စွဲအလိုက် အတန်းတက်ရောက်မှု မှတ်တမ်း (Attendance Log — စုစုပေါင်း{' '}
                  {perf.totalSessions} ကြိမ်)
                </span>
              </h5>

              {perf.sessionItems.length === 0 ? (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-500 dark:text-slate-400 text-center">
                  ဤအတန်းတွင် Attendance မှတ်တမ်း မရှိသေးပါ။
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                  {perf.sessionItems.map((item) => (
                    <div
                      key={item.session.id}
                      className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/70 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          📅 {item.session.date}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {item.session.title}
                        </div>
                      </div>

                      <span
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold shrink-0 ${
                          item.status === 'present'
                            ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300/60'
                            : item.status === 'late'
                            ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300/60'
                            : item.status === 'excused'
                            ? 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300 border border-indigo-300/60'
                            : 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-300/60'
                        }`}
                      >
                        {item.status === 'present'
                          ? '✅ Present'
                          : item.status === 'late'
                          ? '⏰ Late'
                          : item.status === 'excused'
                          ? '📝 ခွင့် (Excused)'
                          : '❌ Absent'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
