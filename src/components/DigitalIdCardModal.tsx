import React, { useState, useMemo } from 'react';
import { User, Course } from '../types/classroom';
import {
  X,
  Download,
  RotateCw,
  ShieldCheck,
  GraduationCap,
  Award,
  CheckCircle2,
  Sparkles,
  QrCode,
  Palette,
  BookOpen,
} from 'lucide-react';

interface DigitalIdCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  courses: Course[];
}

type CardThemeId = 'oxford_navy' | 'emerald_scholar' | 'imperial_indigo';

const CARD_THEMES: Record<
  CardThemeId,
  {
    name: string;
    frontBg: string;
    accentText: string;
    badgeBg: string;
    canvasTopColor: string;
    canvasBottomColor: string;
    canvasAccentColor: string;
  }
> = {
  oxford_navy: {
    name: 'Oxford Royal Navy',
    frontBg: 'from-[#07152b] via-[#0c2347] to-[#051020]',
    accentText: 'text-amber-300',
    badgeBg: 'bg-amber-400/20 border-amber-400/40 text-amber-200',
    canvasTopColor: '#07152b',
    canvasBottomColor: '#0c2347',
    canvasAccentColor: '#fbbf24',
  },
  emerald_scholar: {
    name: 'Emerald Scholar',
    frontBg: 'from-[#052e24] via-[#064e3b] to-[#031d17]',
    accentText: 'text-emerald-300',
    badgeBg: 'bg-emerald-400/20 border-emerald-400/40 text-emerald-200',
    canvasTopColor: '#052e24',
    canvasBottomColor: '#064e3b',
    canvasAccentColor: '#34d399',
  },
  imperial_indigo: {
    name: 'Imperial Indigo',
    frontBg: 'from-[#17133a] via-[#272063] to-[#0f0c26]',
    accentText: 'text-indigo-200',
    badgeBg: 'bg-indigo-400/20 border-indigo-400/40 text-indigo-100',
    canvasTopColor: '#17133a',
    canvasBottomColor: '#272063',
    canvasAccentColor: '#a5b4fc',
  },
};

/**
 * Generates a deterministic 21x21 QR-style matrix from a verification string (0 external API calls, works 100% offline)
 */
function buildDeterministicQrMatrix(payload: string): boolean[][] {
  const size = 21;
  const matrix: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const reserved: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  const placeFinderPattern = (r0: number, c0: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const nr = r0 + r;
        const nc = c0 + c;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
          reserved[nr][nc] = true;
          const isOuter = r >= 0 && r <= 6 && c >= 0 && c <= 6 && (r === 0 || r === 6 || c === 0 || c === 6);
          const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          matrix[nr][nc] = isOuter || isInner;
        }
      }
    }
  };

  placeFinderPattern(0, 0);
  placeFinderPattern(0, size - 7);
  placeFinderPattern(size - 7, 0);

  // Timing lines
  for (let i = 8; i < size - 8; i++) {
    reserved[6][i] = true;
    reserved[i][6] = true;
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  // Deterministic hash stream from payload
  let hash = 2166136261;
  for (let i = 0; i < payload.length; i++) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  let seed = hash >>> 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (reserved[r][c]) continue;
      seed = (Math.imul(seed, 1664525) + 1013904223 + r * 31 + c * 17) >>> 0;
      const charByte = payload.charCodeAt((r * size + c) % payload.length) || 73;
      matrix[r][c] = ((seed ^ charByte) & 1) === 1;
    }
  }

  return matrix;
}

export function formatAcademicIdNumber(user: User): string {
  const cleanId = user.id.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  let numHash = 0;
  for (let i = 0; i < user.id.length; i++) {
    numHash = (numHash * 31 + user.id.charCodeAt(i)) % 9000;
  }
  const fourDigit = String(1000 + Math.abs(numHash)).slice(0, 4);
  const rolePrefix =
    user.role === 'admin' ? 'ADM' : user.role === 'co_admin' ? 'INS' : 'STU';
  return `SWA-2026-${rolePrefix}-${fourDigit}${cleanId.slice(-2)}`;
}

export const DigitalIdCardModal: React.FC<DigitalIdCardModalProps> = ({
  isOpen,
  onClose,
  user,
  courses,
}) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [themeId, setThemeId] = useState<CardThemeId>('oxford_navy');
  const [isDownloading, setIsDownloading] = useState(false);

  const theme = CARD_THEMES[themeId];
  const academicId = useMemo(() => formatAcademicIdNumber(user), [user]);

  const userCourses = useMemo(() => {
    if (user.role === 'admin' || user.role === 'co_admin') {
      return courses;
    }
    return courses.filter((c) => c.enrolledStudentIds.includes(user.id));
  }, [courses, user]);

  const verificationPayload = useMemo(
    () =>
      `SWANARH-OS|ID:${academicId}|USER:${user.username}|NAME:${user.name}|ROLE:${user.role.toUpperCase()}|VERIFIED:ACTIVE`,
    [academicId, user]
  );

  const qrMatrix = useMemo(
    () => buildDeterministicQrMatrix(verificationPayload),
    [verificationPayload]
  );

  if (!isOpen) return null;

  const roleBadgeLabel =
    user.role === 'admin'
      ? 'PRIMARY ADMIN · DIRECTOR ID'
      : user.role === 'co_admin'
      ? 'CO-ADMIN · INSTRUCTOR ID'
      : 'OFFICIAL STUDENT ID CARD';

  const roleMyanmarLabel =
    user.role === 'admin'
      ? 'ပင်မ စီမံခန့်ခွဲသူ (Primary Admin)'
      : user.role === 'co_admin'
      ? 'တွဲဖက် ဆရာ/စီမံခန့်ခွဲသူ (Co-Admin)'
      : 'တရားဝင် သင်တန်းသား (Verified Student)';

  const initials =
    user.name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0] || '')
      .join('')
      .toUpperCase() || 'SA';

  const handleDownloadPng = () => {
    setIsDownloading(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 680;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setIsDownloading(false);
        return;
      }

      // Background gradient
      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      grad.addColorStop(0, theme.canvasTopColor);
      grad.addColorStop(0.55, theme.canvasBottomColor);
      grad.addColorStop(1, '#040914');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(0, 0, canvas.width, canvas.height, 44);
      ctx.fill();

      // Gold/Accent outer border
      ctx.strokeStyle = theme.canvasAccentColor;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.roundRect(16, 16, canvas.width - 32, canvas.height - 32, 34);
      ctx.stroke();

      // Header bar
      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.fillRect(20, 20, canvas.width - 40, 125);

      // Academy Title
      ctx.fillStyle = theme.canvasAccentColor;
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText('SWANARH ACADEMY · CLASSROOM OS', 52, 68);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 34px sans-serif';
      ctx.fillText(roleBadgeLabel, 52, 114);

      // Academic ID Pill top-right
      ctx.fillStyle = 'rgba(251, 191, 36, 0.16)';
      ctx.beginPath();
      ctx.roundRect(canvas.width - 385, 48, 335, 62, 16);
      ctx.fill();
      ctx.fillStyle = theme.canvasAccentColor;
      ctx.font = 'bold 23px monospace';
      ctx.fillText(academicId, canvas.width - 365, 87);

      // Avatar circle
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.beginPath();
      ctx.arc(150, 310, 88, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = theme.canvasAccentColor;
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 56px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(initials, 150, 328);
      ctx.textAlign = 'left';

      // User Info
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('FULL NAME / အမည်', 280, 225);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 42px sans-serif';
      ctx.fillText(user.name.slice(0, 28), 280, 275);

      ctx.fillStyle = theme.canvasAccentColor;
      ctx.font = 'bold 24px monospace';
      ctx.fillText(`@${user.username}`, 280, 315);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = 'bold 23px sans-serif';
      ctx.fillText(`အဆင့်သတ်မှတ်ချက်: ${roleMyanmarLabel}`, 280, 368);

      const courseText =
        userCourses.length > 0
          ? userCourses
              .slice(0, 3)
              .map((c) => c.code)
              .join(' · ')
          : 'ALL ACADEMY CLASSROOMS';
      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText(`အတန်းများ (${userCourses.length}): ${courseText}`, 280, 415);

      if (user.title) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '21px sans-serif';
        ctx.fillText(`အလုပ်အကိုင်/ပညာအရည်အချင်း: ${user.title.slice(0, 36)}`, 280, 460);
      }

      // Draw QR code on bottom-right
      const qrBoxSize = 210;
      const qrX = canvas.width - qrBoxSize - 56;
      const qrY = 210;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(qrX - 14, qrY - 14, qrBoxSize + 28, qrBoxSize + 28, 20);
      ctx.fill();

      const cell = qrBoxSize / qrMatrix.length;
      ctx.fillStyle = '#07152b';
      for (let r = 0; r < qrMatrix.length; r++) {
        for (let c = 0; c < qrMatrix[r].length; c++) {
          if (qrMatrix[r][c]) {
            ctx.fillRect(
              Math.floor(qrX + c * cell),
              Math.floor(qrY + r * cell),
              Math.ceil(cell),
              Math.ceil(cell)
            );
          }
        }
      }

      // Footer strip
      ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
      ctx.fillRect(20, canvas.height - 108, canvas.width - 40, 88);

      ctx.fillStyle = '#34d399';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText('● STATUS: ACTIVE & VERIFIED MEMBER', 52, canvas.height - 56);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '20px sans-serif';
      ctx.fillText(
        'Dr. Si Thu Aung · Swanarh Academy · www.swanarhclassroom.online',
        canvas.width - 610,
        canvas.height - 56
      );

      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `Swanarh-ID-${user.username || user.id}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      // ignore
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl neu-raised rounded-3xl border border-indigo-500/30 shadow-2xl overflow-hidden flex flex-col max-h-[94dvh]">
        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 text-white shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
              <Award className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-extrabold text-white truncate flex items-center gap-1.5">
                <span>ဒစ်ဂျစ်တယ် ကျောင်းသား / ဆရာ သက်သေခံကတ်ပြား</span>
                <span className="px-2 py-0.5 rounded-md bg-amber-400 text-slate-950 text-[10px] font-mono font-black uppercase">
                  Smart ID
                </span>
              </h3>
              <p className="text-[11px] text-slate-300 truncate">
                Swanarh Academy Official Digital Academic ID Card with QR Verification
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-rose-600 text-white transition-colors cursor-pointer shrink-0"
            aria-label="Close ID Card Modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
          {/* Top Action Controls: Theme Picker + Flip Front/Back */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1 mr-1">
                <Palette className="w-3.5 h-3.5 text-indigo-500" /> ကတ်အရောင်:
              </span>
              {(Object.keys(CARD_THEMES) as CardThemeId[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setThemeId(key)}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-extrabold transition-all cursor-pointer border ${
                    themeId === key
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-xs'
                      : 'neu-btn text-slate-700 dark:text-slate-300 border-slate-300/60 dark:border-slate-700'
                  }`}
                >
                  {CARD_THEMES[key].name}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setIsFlipped((f) => !f)}
              className="px-3 py-1.5 rounded-xl neu-btn-indigo text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>{isFlipped ? 'ကတ်အရှေ့ဘက် ကြည့်မည်' : 'ကတ်အနောက်ဘက် (QR) လှန်ကြည့်မည်'}</span>
            </button>
          </div>

          {/* 3D Embossed Academic ID Card */}
          {!isFlipped ? (
            /* FRONT OF ID CARD */
            <div
              className={`relative rounded-3xl bg-gradient-to-br ${theme.frontBg} text-white p-5 sm:p-6 border-2 border-amber-400/50 shadow-[0_20px_50px_rgba(0,0,0,0.45)] overflow-hidden select-none`}
            >
              {/* Decorative Holographic Corner Glow */}
              <div className="pointer-events-none absolute -top-20 -right-20 w-56 h-56 rounded-full bg-amber-400/10 blur-2xl" />
              <div className="pointer-events-none absolute -bottom-20 -left-20 w-56 h-56 rounded-full bg-indigo-500/15 blur-2xl" />

              {/* Top Crest Row */}
              <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-white/15">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-300 via-amber-400 to-amber-600 text-slate-950 flex items-center justify-center shadow-md ring-2 ring-white/30 shrink-0">
                    <GraduationCap className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[10px] sm:text-xs font-mono font-black tracking-widest uppercase ${theme.accentText}`}
                      >
                        SWANARH ACADEMY · CLASSROOM OS
                      </span>
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    </div>
                    <h4 className="text-sm sm:text-base font-black tracking-wide text-white">
                      {roleBadgeLabel}
                    </h4>
                  </div>
                </div>

                <div className="px-3 py-1.5 rounded-xl bg-black/35 border border-amber-400/40 text-right">
                  <div className="text-[9px] font-mono uppercase tracking-wider text-slate-300">
                    ACADEMIC ID NO.
                  </div>
                  <div className="text-xs sm:text-sm font-mono font-black text-amber-300 tracking-wider">
                    {academicId}
                  </div>
                </div>
              </div>

              {/* Middle Identity Row */}
              <div className="py-5 flex flex-col sm:flex-row items-center sm:items-start gap-5">
                {/* Photo / Crest Avatar + Mini QR */}
                <div className="flex flex-col items-center gap-2.5 shrink-0">
                  <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-gradient-to-br from-white/15 to-white/5 border-2 border-amber-300/70 shadow-xl flex items-center justify-center overflow-hidden">
                    {user.role === 'admin' && user.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-3xl sm:text-4xl font-black text-amber-300 tracking-wider">
                        {initials}
                      </span>
                    )}
                    <div className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center ring-2 ring-slate-900">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${theme.badgeBg}`}
                  >
                    {roleMyanmarLabel}
                  </span>
                </div>

                {/* Details Grid */}
                <div className="flex-1 min-w-0 space-y-3 text-center sm:text-left w-full">
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-slate-300">
                      HOLDER FULL NAME / အမည်
                    </div>
                    <div className="text-lg sm:text-xl font-black text-white truncate">
                      {user.name}
                    </div>
                    <div className="text-xs font-mono font-bold text-amber-300">
                      @{user.username}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    <div className="p-2.5 rounded-xl bg-white/8 border border-white/10">
                      <div className="text-[10px] text-slate-300 font-semibold">
                        တက်ရောက်/တာဝန်ယူထားသော အတန်းများ
                      </div>
                      <div className="text-xs font-extrabold text-white mt-0.5 flex items-center justify-center sm:justify-start gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                        <span className="truncate">
                          {userCourses.length > 0
                            ? `${userCourses.length} တန်း (${userCourses
                                .slice(0, 2)
                                .map((c) => c.code)
                                .join(', ')})`
                            : 'Academy Member'}
                        </span>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-white/8 border border-white/10">
                      <div className="text-[10px] text-slate-300 font-semibold">
                        အလုပ်အကိုင် / ပညာအရည်အချင်း
                      </div>
                      <div className="text-xs font-extrabold text-white mt-0.5 truncate">
                        {user.title || roleMyanmarLabel}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mini Quick-Verify QR on Front */}
                <div
                  onClick={() => setIsFlipped(true)}
                  className="hidden sm:flex flex-col items-center gap-1 p-2 rounded-2xl bg-white text-slate-950 shadow-lg cursor-pointer hover:scale-105 transition-transform shrink-0"
                  title="QR Code အကြီးကြည့်ရန် နှိပ်ပါ"
                >
                  <svg
                    viewBox={`0 0 ${qrMatrix.length} ${qrMatrix.length}`}
                    className="w-20 h-20"
                    shapeRendering="crispEdges"
                  >
                    {qrMatrix.map((row, rIdx) =>
                      row.map((cell, cIdx) =>
                        cell ? (
                          <rect
                            key={`${rIdx}-${cIdx}`}
                            x={cIdx}
                            y={rIdx}
                            width={1}
                            height={1}
                            fill="#07152b"
                          />
                        ) : null
                      )
                    )}
                  </svg>
                  <span className="text-[9px] font-mono font-black text-slate-800 tracking-tight">
                    SCAN VERIFY
                  </span>
                </div>
              </div>

              {/* Bottom Security Strip */}
              <div className="pt-3 border-t border-white/15 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <div className="flex items-center gap-1.5 font-extrabold text-emerald-300">
                  <ShieldCheck className="w-4 h-4" />
                  <span>STATUS: ACTIVE & VERIFIED</span>
                </div>
                <div className="font-mono text-[10px] text-slate-300">
                  Dr. Si Thu Aung · www.swanarhclassroom.online
                </div>
              </div>
            </div>
          ) : (
            /* BACK OF ID CARD (Full Verification QR + Rules Pledge + Official Seal) */
            <div
              className={`relative rounded-3xl bg-gradient-to-br ${theme.frontBg} text-white p-5 sm:p-6 border-2 border-amber-400/50 shadow-[0_20px_50px_rgba(0,0,0,0.45)] overflow-hidden select-none animate-fade-in`}
            >
              <div className="flex flex-col sm:flex-row items-center gap-5">
                {/* Large Crisp SVG QR Code */}
                <div className="p-3.5 rounded-2xl bg-white text-slate-950 shadow-xl shrink-0 flex flex-col items-center">
                  <svg
                    viewBox={`0 0 ${qrMatrix.length} ${qrMatrix.length}`}
                    className="w-36 h-36 sm:w-40 sm:h-40"
                    shapeRendering="crispEdges"
                  >
                    {qrMatrix.map((row, rIdx) =>
                      row.map((cell, cIdx) =>
                        cell ? (
                          <rect
                            key={`${rIdx}-${cIdx}`}
                            x={cIdx}
                            y={rIdx}
                            width={1}
                            height={1}
                            fill="#07152b"
                          />
                        ) : null
                      )
                    )}
                  </svg>
                  <div className="mt-2 text-[10px] font-mono font-black text-slate-900 tracking-wider">
                    {academicId}
                  </div>
                </div>

                {/* Verification Metadata & Academy Pledge */}
                <div className="flex-1 space-y-3 text-center sm:text-left">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-400/20 border border-amber-400/40 text-amber-300 text-xs font-extrabold">
                    <QrCode className="w-3.5 h-3.5" />
                    <span>Digital Security Verification Seal</span>
                  </div>

                  <p className="text-xs text-slate-200 leading-relaxed">
                    ဤသက်သေခံကတ်ပြားသည် <strong>Swanarh Academy (စွမ်းအား အကယ်ဒမီ)</strong> ၏ တရားဝင် သင်တန်းသား/ဆရာ ဖြစ်ကြောင်း အတည်ပြုထားသည့် Digital Smart ID ဖြစ်ပါသည်။ အခြားသူတစ်ဦးအား အကောင့်လွှဲပြောင်းပေးခြင်း လုံးဝမပြုရ။
                  </p>

                  <div className="p-3 rounded-xl bg-black/35 border border-white/15 font-mono text-[10px] text-amber-200 break-all">
                    {verificationPayload}
                  </div>

                  <div className="pt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300">
                    <span>Authorized By: Dr. Si Thu Aung</span>
                    <span className="text-emerald-300 font-bold">✓ Hologram Seal Verified</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Bottom Download & Close Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              💡 <strong>ID ကတ် ပုံထုတ်ယူမည်</strong> ကိုနှိပ်၍ ဖုန်း သို့မဟုတ် ကွန်ပျူတာထဲတွင် PNG ပုံအဖြစ် သိမ်းဆည်းထားနိုင်ပါသည်။
            </p>
            <div className="flex items-center gap-2.5 ml-auto">
              <button
                type="button"
                onClick={handleDownloadPng}
                disabled={isDownloading}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-extrabold flex items-center gap-2 shadow-md cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>{isDownloading ? 'ပုံထုတ်နေပါသည်...' : '📥 ID ကတ် ပုံထုတ်ယူမည် (PNG)'}</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl neu-btn text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                ပိတ်မည်
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
