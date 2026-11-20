import React, { useState, useMemo } from 'react';
import {
  Course,
  DataFormField,
  DataFormFieldType,
  Quiz,
  QuizSubmission,
  User,
} from '../types/classroom';
import { ClassroomDB } from '../services/storage';
import {
  ClipboardList,
  Plus,
  Trash2,
  X,
  Download,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  Search,
  ArrowUp,
  ArrowDown,
  Globe,
  Sparkles,
  Edit3,
  Users,
  Eye,
} from 'lucide-react';

const MMT_OFFSET_MS = (6 * 60 + 30) * 60 * 1000;

function toDatetimeLocalValue(
  raw?: string,
  timezoneMode: 'MMT' | 'LOCAL' = 'MMT'
): string {
  if (!raw || !raw.trim()) return '';
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  const ms = ClassroomDB.parseQuizScheduleMs(trimmed, timezoneMode);
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

export const DEFAULT_DATA_FORM_FIELDS: DataFormField[] = [
  {
    id: 'field-roll-no',
    label: 'Roll No. (ခုံနံပါတ်)',
    type: 'number',
    required: false,
    placeholder: 'ဥပမာ - 12 (English ဂဏန်းသာ)',
  },
  {
    id: 'field-name-mm',
    label: 'အမည် (မြန်မာဘာသာဖြင့်)',
    type: 'text',
    required: true,
    placeholder: 'ကျောင်းသား အမည်အပြည့်အစုံ',
  },
  {
    id: 'field-phone',
    label: 'ဆက်သွယ်ရန် ဖုန်းနံပါတ် (Ph No.)',
    type: 'phone',
    required: true,
    placeholder: '09-XXXXXXXXX',
  },
  {
    id: 'field-address',
    label: 'နေရပ်လိပ်စာ အပြည့်အစုံ (Address)',
    type: 'textarea',
    required: true,
    placeholder: 'အိမ်အမှတ်၊ လမ်း၊ ရပ်ကွက်၊ မြို့နယ်၊ တိုင်း/ပြည်နယ်',
  },
];

const DATA_FORM_PRESETS: Array<{
  id: string;
  badge: string;
  title: string;
  description: string;
  fields: DataFormField[];
}> = [
  {
    id: 'certificate',
    badge: '🎓 Certificate ဖောင်',
    title: 'သင်တန်းဆင်းလက်မှတ် (Certificate) အတွက် အချက်အလက် တောင်းခံလွှာ',
    description:
      'သင်တန်းဆင်းလက်မှတ် (Certificate) ရိုက်နှိပ်ထုတ်ပေးနိုင်ရန် အောက်ပါ ကိုယ်ရေးအချက်အလက်များကို မှန်ကန်တိကျစွာ ဖြည့်သွင်းပေးပါရန် မေတ္တာရပ်ခံအပ်ပါသည်။',
    fields: [
      {
        id: 'cert-roll',
        label: 'Roll No. (ခုံနံပါတ်)',
        type: 'number',
        required: false,
        placeholder: 'ဥပမာ - 5',
      },
      {
        id: 'cert-name-en',
        label: 'Certificate ပေါ်တွင် ရိုက်နှိပ်မည့် အမည် (English စာလုံးအကြီးဖြင့်)',
        type: 'text',
        required: true,
        placeholder: 'ဥပမာ - AUNG AUNG',
      },
      {
        id: 'cert-name-mm',
        label: 'အမည် (မြန်မာဘာသာဖြင့်)',
        type: 'text',
        required: true,
        placeholder: 'ဥပမာ - မောင်အောင်အောင်',
      },
      {
        id: 'cert-nrc',
        label: 'မှတ်ပုံတင်အမှတ် (NRC No. / Passport No.)',
        type: 'text',
        required: true,
        placeholder: 'ဥပမာ - ၁၂/ကမရ(နိုင်)၁၂၃၄၅၆',
      },
      {
        id: 'cert-phone',
        label: 'ဆက်သွယ်ရန် ဖုန်းနံပါတ် (Viber / Telegram)',
        type: 'phone',
        required: true,
        placeholder: '09-XXXXXXXXX',
      },
      {
        id: 'cert-delivery',
        label: 'လက်မှတ် ထုတ်ယူမည့် ပုံစံ',
        type: 'select',
        required: true,
        options: ['Royal Express ဖြင့် ပို့ပေးရန်', 'ကိုယ်တိုင်လာရောက်ယူမည်', 'PDF Softcopy သာ ယူမည်'],
      },
      {
        id: 'cert-address',
        label: 'ပေးပို့ရမည့် လိပ်စာအပြည့်အစုံ',
        type: 'textarea',
        required: false,
        placeholder: 'အိမ်အမှတ်၊ လမ်း၊ ရပ်ကွက်၊ မြို့နယ်၊ တိုင်း/ပြည်နယ်',
      },
    ],
  },
  {
    id: 'biodata',
    badge: '📋 ကိုယ်ရေးအချက်အလက် ဖောင်',
    title: 'သင်တန်းသား ကိုယ်ရေးအချက်အလက် မှတ်တမ်းဖောင် (Student Bio Data Form)',
    description:
      'သင်တန်းသားများ၏ ကိုယ်ရေးအချက်အလက်နှင့် ဆက်သွယ်ရန် မှတ်တမ်းများကို သိမ်းဆည်းထားရှိရန် ဖြည့်သွင်းပေးပါ။',
    fields: [
      {
        id: 'bio-roll',
        label: 'Roll No. (ခုံနံပါတ်)',
        type: 'number',
        required: false,
        placeholder: 'ဥပမာ - 1',
      },
      {
        id: 'bio-name',
        label: 'ကျောင်းသား အမည်အပြည့်အစုံ (Full Name)',
        type: 'text',
        required: true,
        placeholder: 'အမည်အပြည့်အစုံ',
      },
      {
        id: 'bio-dob',
        label: 'မွေးသက္ကရာဇ် (Date of Birth)',
        type: 'date',
        required: false,
        placeholder: 'YYYY-MM-DD',
      },
      {
        id: 'bio-education',
        label: 'ပညာအရည်အချင်း / လက်ရှိအလုပ်အကိုင်',
        type: 'text',
        required: false,
        placeholder: 'ဥပမာ - B.A / ကုမ္ပဏီဝန်ထမ်း',
      },
      {
        id: 'bio-phone',
        label: 'ဖုန်းနံပါတ် (Ph No.)',
        type: 'phone',
        required: true,
        placeholder: '09-XXXXXXXXX',
      },
      {
        id: 'bio-address',
        label: 'နေရပ်လိပ်စာ အပြည့်အစုံ (Address)',
        type: 'textarea',
        required: true,
        placeholder: 'အိမ်အမှတ်၊ လမ်း၊ ရပ်ကွက်၊ မြို့နယ်၊ တိုင်း/ပြည်နယ်',
      },
    ],
  },
  {
    id: 'feedback',
    badge: '💬 သင်တန်း စစ်တမ်းဖောင်',
    title: 'သင်တန်း အကြံပြုချက်နှင့် သဘောထားစစ်တမ်း (Course Survey & Feedback Form)',
    description:
      'သင်တန်းပို့ချမှု ပိုမိုကောင်းမွန်စေရန် သင်တန်းသားများ၏ အကြံပြုချက်များကို ရိုးသားပွင့်လင်းစွာ ဖြည့်သွင်းပေးနိုင်ပါသည်။',
    fields: [
      {
        id: 'fb-name',
        label: 'ကျောင်းသား အမည်',
        type: 'text',
        required: true,
        placeholder: 'အမည်',
      },
      {
        id: 'fb-rating',
        label: 'သင်ကြားမှုအပေါ် စိတ်ကျေနပ်မှု အဆင့်',
        type: 'select',
        required: true,
        options: ['အလွန်ကောင်းမွန်ပါသည် (5/5)', 'ကောင်းမွန်ပါသည် (4/5)', 'သင့်တင့်ပါသည် (3/5)', 'လိုအပ်ချက်ရှိပါသည်'],
      },
      {
        id: 'fb-next-course',
        label: 'ဆက်လက်တက်ရောက်လိုသော သင်တန်းအမျိုးအစား',
        type: 'text',
        required: false,
        placeholder: 'တက်ရောက်လိုသော အတန်းအမည်',
      },
      {
        id: 'fb-comment',
        label: 'အကြံပြုလိုသည့် အချက်များ (Suggestions)',
        type: 'textarea',
        required: true,
        placeholder: 'သင်တန်းအတွက် အကြံပြုချက်များ ရေးသားပေးပါ...',
      },
    ],
  },
];

/* ============================================================================
 * 1. EXCEL / CSV EXPORT ENGINE (UTF-8 with BOM for Myanmar + English Excel)
 * ============================================================================ */
export function downloadDataFormExcelCsv(
  form: Quiz,
  course: Course,
  submissions: QuizSubmission[]
): void {
  const fields: DataFormField[] =
    Array.isArray(form.formFields) && form.formFields.length > 0
      ? form.formFields
      : DEFAULT_DATA_FORM_FIELDS;

  const headerRow = [
    'စဉ် (No.)',
    'ကျောင်းသား အကောင့်အမည် (Account Name)',
    'Username',
    ...fields.map((f) => f.label),
    'ပေးပို့သည့်အချိန် (Submitted Time MMT)',
  ];

  const rows: string[][] = [headerRow];

  if (submissions.length === 0) {
    // Include one blank template row so Excel users can see the column structure
    rows.push(['1', '', '', ...fields.map(() => ''), '']);
  } else {
    submissions.forEach((sub, idx) => {
      const resp = sub.formResponses || {};
      rows.push([
        String(idx + 1),
        sub.studentName || '',
        sub.studentUsername || '',
        ...fields.map((f) => resp[f.id] ?? ''),
        sub.submittedAt || '',
      ]);
    });
  }

  const escapeCsvCell = (cell: unknown): string => {
    let str = String(cell ?? '');
    if (/^[=+\-@\t\r]/.test(str)) {
      str = `'${str}`;
    }
    return `"${str.replace(/"/g, '""')}"`;
  };

  const csvContent =
    '\uFEFF' +
    rows
      .map((row) => row.map(escapeCsvCell).join(','))
      .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const cleanCode = (course.code || 'Course').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanTitle = (form.title || 'Data_Form')
    .replace(/[\\/:*?"<>|]/g, '_')
    .slice(0, 40);
  link.href = url;
  link.download = `SwanArh_${cleanCode}_${cleanTitle}_${submissions.length}Responses.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 6_000);
}

/* ============================================================================
 * 2. MULTI-PAGE A4 LANDSCAPE PDF GENERATOR FOR DATA FORMS & RESPONSES
 * ============================================================================ */
function buildMultiPageA4LandscapePdfFromJpegs(
  pages: Array<{ jpegBytes: Uint8Array; widthPx: number; heightPx: number }>
): Blob {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0];
  let byteLength = 0;

  const pushStr = (s: string) => {
    const arr = encoder.encode(s);
    chunks.push(arr);
    byteLength += arr.byteLength;
  };
  const pushBytes = (arr: Uint8Array) => {
    chunks.push(arr);
    byteLength += arr.byteLength;
  };
  const startObj = (id: number) => {
    offsets[id] = byteLength;
    pushStr(`${id} 0 obj\n`);
  };
  const endObj = () => {
    pushStr('\nendobj\n');
  };

  // A4 Landscape in PDF points (297mm x 210mm = 841.89pt x 595.28pt)
  const pageW = 841.89;
  const pageH = 595.28;

  pushStr('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');

  startObj(1);
  pushStr('<< /Type /Catalog /Pages 2 0 R >>');
  endObj();

  const pageObjIds: number[] = [];
  let nextId = 3;
  const pageEntries = pages.map((p, idx) => {
    const pageId = nextId++;
    const contentId = nextId++;
    const imgId = nextId++;
    pageObjIds.push(pageId);
    return { ...p, idx, pageId, contentId, imgId };
  });

  startObj(2);
  pushStr(
    `<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${
      pageObjIds.length
    } >>`
  );
  endObj();

  for (const entry of pageEntries) {
    const imgName = `/Im${entry.idx + 1}`;
    const streamContent = `q\n${pageW.toFixed(2)} 0 0 ${pageH.toFixed(2)} 0 0 cm\n${imgName} Do\nQ\n`;
    const streamBytes = encoder.encode(streamContent);

    startObj(entry.pageId);
    pushStr(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW.toFixed(2)} ${pageH.toFixed(
        2
      )}] /Resources << /XObject << ${imgName} ${entry.imgId} 0 R >> >> /Contents ${
        entry.contentId
      } 0 R >>`
    );
    endObj();

    startObj(entry.contentId);
    pushStr(`<< /Length ${streamBytes.byteLength} >>\nstream\n`);
    pushBytes(streamBytes);
    pushStr('\nendstream');
    endObj();

    startObj(entry.imgId);
    pushStr(
      `<< /Type /XObject /Subtype /Image /Width ${entry.widthPx} /Height ${entry.heightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${entry.jpegBytes.byteLength} >>\nstream\n`
    );
    pushBytes(entry.jpegBytes);
    pushStr('\nendstream');
    endObj();
  }

  const totalObjects = nextId;
  const xrefOffset = byteLength;
  pushStr(`xref\n0 ${totalObjects}\n`);
  pushStr('0000000000 65535 f \n');
  for (let i = 1; i < totalObjects; i++) {
    const off = String(offsets[i] || 0).padStart(10, '0');
    pushStr(`${off} 00000 n \n`);
  }
  pushStr(
    `trailer\n<< /Size ${totalObjects} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  );

  return new Blob(chunks as unknown as BlobPart[], { type: 'application/pdf' });
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] || '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function wrapCellText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number = 3
): string[] {
  const clean = (text || '').replace(/\r?\n/g, ' ').trim();
  if (!clean) return ['-'];
  if (ctx.measureText(clean).width <= maxWidth) return [clean];

  const tokens = clean.split(/(\s+|၊\s*|။\s*|,\s*|\/|-)/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const tok of tokens) {
    const cand = current ? current + tok : tok;
    if (ctx.measureText(cand).width <= maxWidth) {
      current = cand;
    } else {
      if (current.trim()) {
        lines.push(current.trim());
        current = '';
      }
      const trimmedTok = tok.trimStart();
      if (ctx.measureText(trimmedTok).width > maxWidth) {
        let buf = '';
        for (const ch of Array.from(trimmedTok)) {
          if (ctx.measureText(buf + ch).width <= maxWidth) {
            buf += ch;
          } else {
            if (buf) lines.push(buf);
            buf = ch;
          }
        }
        current = buf;
      } else {
        current = trimmedTok;
      }
    }
  }
  if (current.trim()) lines.push(current.trim());
  if (lines.length <= maxLines) return lines;
  return [...lines.slice(0, maxLines - 1), lines.slice(maxLines - 1).join(' ')];
}

export async function downloadDataFormPdf(
  form: Quiz,
  course: Course,
  submissions: QuizSubmission[],
  mode: 'auto' | 'blank_form' = 'auto'
): Promise<void> {
  await new Promise((r) => setTimeout(r, 30));

  const fields: DataFormField[] =
    Array.isArray(form.formFields) && form.formFields.length > 0
      ? form.formFields
      : DEFAULT_DATA_FORM_FIELDS;

  // High-definition A4 Landscape canvas (2338 x 1654 px)
  const W = 2338;
  const H = 1654;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const fontFam =
    '"Padauk", "Myanmar Text", "Pyidaungsu", "Plus Jakarta Sans", sans-serif';
  const encodedPages: Array<{ jpegBytes: Uint8Array; widthPx: number; heightPx: number }> = [];

  if (mode === 'blank_form' || submissions.length === 0) {
    // Render Printable Blank Form (A4 Landscape)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    // Outer decorative frame
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 4;
    ctx.strokeRect(48, 48, W - 96, H - 96);

    // Header Banner
    ctx.fillStyle = '#1e1b4b';
    ctx.fillRect(48, 48, W - 96, 175);

    ctx.fillStyle = '#ffffff';
    ctx.font = `800 42px ${fontFam}`;
    ctx.fillText(`SwanArh Academy — ${course.code}: ${course.title}`, 92, 115, W - 184);

    ctx.fillStyle = '#c7d2fe';
    ctx.font = `700 32px ${fontFam}`;
    ctx.fillText(`📋 ${form.title}`, 92, 172, W - 184);

    // Description
    let curY = 275;
    if (form.description) {
      ctx.fillStyle = '#334155';
      ctx.font = `600 24px ${fontFam}`;
      ctx.fillText(form.description, 92, curY, W - 184);
      curY += 50;
    }

    // Form Fields Grid (2 columns if > 4 fields, else 1 column)
    const twoCols = fields.length > 4;
    const colW = twoCols ? (W - 220) / 2 : W - 184;
    const rowH = twoCols
      ? Math.min(180, Math.floor((H - curY - 110) / Math.ceil(fields.length / 2)))
      : Math.min(185, Math.floor((H - curY - 110) / Math.max(1, fields.length)));

    fields.forEach((field, idx) => {
      const col = twoCols ? idx % 2 : 0;
      const row = twoCols ? Math.floor(idx / 2) : idx;
      const fx = 92 + col * (colW + 36);
      const fy = curY + row * rowH;

      ctx.fillStyle = '#0f172a';
      ctx.font = `800 25px ${fontFam}`;
      const reqStar = field.required ? ' *' : '';
      ctx.fillText(`${idx + 1}. ${field.label}${reqStar}`, fx, fy + 28, colW);

      // Input Box
      const boxY = fy + 44;
      const boxH = Math.max(58, rowH - 68);
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(fx, boxY, colW, boxH);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      ctx.strokeRect(fx, boxY, colW, boxH);

      if (field.type === 'select' && field.options && field.options.length > 0) {
        ctx.fillStyle = '#475569';
        ctx.font = `600 21px ${fontFam}`;
        ctx.fillText(
          `ရွေးချယ်ရန်: ${field.options.map((o) => `☐ ${o}`).join('    ')}`,
          fx + 18,
          boxY + Math.min(40, boxH / 2 + 7),
          colW - 36
        );
      } else if (field.placeholder) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = `500 20px ${fontFam}`;
        ctx.fillText(field.placeholder, fx + 18, boxY + 38, colW - 36);
      }
    });

    // Footer
    ctx.fillStyle = '#64748b';
    ctx.font = `600 20px ${fontFam}`;
    ctx.fillText(
      `ထုတ်ယူသည့်အချိန်: ${ClassroomDB.formatMyanmarDateTime(Date.now(), false)} · SwanArh Academy Exam Room Data Form`,
      92,
      H - 72
    );

    const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.94);
    encodedPages.push({
      jpegBytes: dataUrlToBytes(jpegDataUrl),
      widthPx: W,
      heightPx: H,
    });
  } else {
    // Render Multi-Page A4 Landscape Student Responses Table
    const rowsPerPage = 10;
    const totalPages = Math.max(1, Math.ceil(submissions.length / rowsPerPage));

    // Columns: No. (70px), Student Name (240px), dynamic fields, Submitted Time (210px)
    const marginX = 56;
    const tableW = W - marginX * 2;
    const noColW = 78;
    const stuColW = 240;
    const timeColW = 215;
    const remainingW = Math.max(400, tableW - noColW - stuColW - timeColW);
    const fieldColW = Math.floor(remainingW / Math.max(1, fields.length));

    for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
      const pageSubs = submissions.slice(
        pageIdx * rowsPerPage,
        (pageIdx + 1) * rowsPerPage
      );

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);

      // Top Header Bar
      ctx.fillStyle = '#1e1b4b';
      ctx.fillRect(marginX, 42, tableW, 136);

      ctx.fillStyle = '#ffffff';
      ctx.font = `800 34px ${fontFam}`;
      ctx.fillText(
        `📋 ${form.title} — (${course.code}: ${course.title})`,
        marginX + 28,
        96,
        tableW - 340
      );

      ctx.fillStyle = '#c7d2fe';
      ctx.font = `600 22px ${fontFam}`;
      ctx.fillText(
        `ဖြည့်သွင်းပြီးသူ စုစုပေါင်း (${submissions.length}) ဦး · ထုတ်ယူချိန်: ${ClassroomDB.formatMyanmarDateTime(
          Date.now(),
          false
        )}`,
        marginX + 28,
        146,
        tableW - 340
      );

      ctx.fillStyle = '#ffffff';
      ctx.font = `800 24px ${fontFam}`;
      ctx.textAlign = 'right';
      ctx.fillText(
        `စာမျက်နှာ ${pageIdx + 1} / ${totalPages}`,
        marginX + tableW - 28,
        120
      );
      ctx.textAlign = 'left';

      // Table Header Row
      const headerY = 196;
      const headerH = 74;
      ctx.fillStyle = '#e0e7ff';
      ctx.fillRect(marginX, headerY, tableW, headerH);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.strokeRect(marginX, headerY, tableW, headerH);

      const columns: Array<{ title: string; x: number; w: number }> = [];
      let curX = marginX;
      columns.push({ title: 'စဉ်', x: curX, w: noColW });
      curX += noColW;
      columns.push({ title: 'အကောင့်အမည်', x: curX, w: stuColW });
      curX += stuColW;
      fields.forEach((f, fIdx) => {
        const w =
          fIdx === fields.length - 1
            ? marginX + tableW - timeColW - curX
            : fieldColW;
        columns.push({ title: f.label, x: curX, w });
        curX += w;
      });
      columns.push({ title: 'ပေးပို့ချိန် (MMT)', x: curX, w: timeColW });

      ctx.fillStyle = '#0f172a';
      ctx.font = `800 20px ${fontFam}`;
      columns.forEach((col, cIdx) => {
        if (cIdx > 0) {
          ctx.beginPath();
          ctx.moveTo(col.x, headerY);
          ctx.lineTo(col.x, headerY + headerH);
          ctx.stroke();
        }
        const wrappedTitle = wrapCellText(ctx, col.title, col.w - 16, 2);
        wrappedTitle.forEach((ln, lIdx) => {
          const ty =
            wrappedTitle.length === 1
              ? headerY + 44
              : headerY + 30 + lIdx * 25;
          ctx.fillText(ln, col.x + 8, ty, col.w - 16);
        });
      });

      // Table Body Rows
      const bodyStartY = headerY + headerH;
      const availableBodyH = H - bodyStartY - 64;
      const rowH = Math.floor(availableBodyH / rowsPerPage);

      pageSubs.forEach((sub, rIdx) => {
        const globalIdx = pageIdx * rowsPerPage + rIdx + 1;
        const ry = bodyStartY + rIdx * rowH;

        ctx.fillStyle = rIdx % 2 === 0 ? '#ffffff' : '#f8fafc';
        ctx.fillRect(marginX, ry, tableW, rowH);
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(marginX, ry, tableW, rowH);

        const resp = sub.formResponses || {};
        const cellValues = [
          String(globalIdx),
          sub.studentName || '-',
          ...fields.map((f) => resp[f.id] || '-'),
          sub.submittedAt || '-',
        ];

        ctx.fillStyle = '#0f172a';
        ctx.font = `700 19px ${fontFam}`;

        columns.forEach((col, cIdx) => {
          if (cIdx > 0) {
            ctx.beginPath();
            ctx.moveTo(col.x, ry);
            ctx.lineTo(col.x, ry + rowH);
            ctx.stroke();
          }
          const val = cellValues[cIdx] || '-';
          const lines = wrapCellText(ctx, val, col.w - 16, 3);
          const lineGap = 24;
          const totalTextH = (lines.length - 1) * lineGap;
          const startTextY = ry + rowH / 2 - totalTextH / 2 + 6;
          lines.forEach((ln, lIdx) => {
            ctx.fillText(ln, col.x + 8, startTextY + lIdx * lineGap, col.w - 16);
          });
        });
      });

      const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.94);
      encodedPages.push({
        jpegBytes: dataUrlToBytes(jpegDataUrl),
        widthPx: W,
        heightPx: H,
      });
    }
  }

  const pdfBlob = buildMultiPageA4LandscapePdfFromJpegs(encodedPages);
  const url = URL.createObjectURL(pdfBlob);
  const link = document.createElement('a');
  const cleanCode = (course.code || 'Course').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanTitle = (form.title || 'Data_Form')
    .replace(/[\\/:*?"<>|]/g, '_')
    .slice(0, 40);
  link.href = url;
  link.download = `SwanArh_${cleanCode}_${cleanTitle}_${
    mode === 'blank_form' ? 'BlankForm' : `${submissions.length}Responses`
  }.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/* ============================================================================
 * 3. MODAL A: CREATE / EDIT STUDENT DATA COLLECTION FORM (Instructor)
 * ============================================================================ */
export const DataFormEditorModal: React.FC<{
  course: Course;
  currentUser: User;
  initialForm?: Quiz;
  onClose: () => void;
  onSaved: () => void;
}> = ({ course, currentUser, initialForm, onClose, onSaved }) => {
  const [title, setTitle] = useState(
    initialForm?.title || 'ကျောင်းသား အချက်အလက် တောင်းခံလွှာ (Student Data Form)'
  );
  const [description, setDescription] = useState(
    initialForm?.description ||
      'သင်တန်းအတွက် လိုအပ်သော အောက်ပါ အချက်အလက်များကို မှန်ကန်ပြည့်စုံစွာ ဖြည့်သွင်းပေးပါရန်။'
  );
  const [isOpen, setIsOpen] = useState<boolean>(
    initialForm ? initialForm.isOpen !== false : true
  );
  const [allowStudentEdit, setAllowStudentEdit] = useState<boolean>(
    initialForm ? initialForm.allowStudentEditSubmission !== false : true
  );
  const [timezoneMode, setTimezoneMode] = useState<'MMT' | 'LOCAL'>(
    initialForm?.timezoneMode === 'LOCAL' ? 'LOCAL' : 'MMT'
  );
  const [scheduledOpenAt, setScheduledOpenAt] = useState<string>(() =>
    toDatetimeLocalValue(
      initialForm?.scheduledOpenAt,
      initialForm?.timezoneMode === 'LOCAL' ? 'LOCAL' : 'MMT'
    )
  );
  const [scheduledCloseAt, setScheduledCloseAt] = useState<string>(() =>
    toDatetimeLocalValue(
      initialForm?.scheduledCloseAt,
      initialForm?.timezoneMode === 'LOCAL' ? 'LOCAL' : 'MMT'
    )
  );
  const [fields, setFields] = useState<DataFormField[]>(() =>
    initialForm?.formFields && initialForm.formFields.length > 0
      ? initialForm.formFields
      : DEFAULT_DATA_FORM_FIELDS
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleApplyPreset = (presetId: string) => {
    const preset = DATA_FORM_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setTitle(preset.title);
    setDescription(preset.description);
    setFields(
      preset.fields.map((f, i) => ({
        ...f,
        id: `${f.id}-${Date.now()}-${i}`,
      }))
    );
  };

  const handleAddField = () => {
    setFields((prev) => [
      ...prev,
      {
        id: `field-${Date.now()}-${prev.length + 1}`,
        label: '',
        type: 'text',
        required: true,
        placeholder: '',
      },
    ]);
  };

  const handleUpdateField = (idx: number, patch: Partial<DataFormField>) => {
    setFields((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  };

  const handleRemoveField = (idx: number) => {
    if (fields.length <= 1) return;
    setFields((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleMoveField = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= fields.length) return;
    setFields((prev) => {
      const copy = [...prev];
      const temp = copy[idx];
      copy[idx] = copy[target];
      copy[target] = temp;
      return copy;
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('⚠️ ဖောင်ခေါင်းစဉ် (Form Title) ထည့်သွင်းပေးပါ။');
      return;
    }
    const validFields = fields
      .map((f, i) => ({
        ...f,
        id: f.id || `field-${Date.now()}-${i}`,
        label: f.label.trim(),
        placeholder: f.placeholder?.trim() || undefined,
        options:
          f.type === 'select'
            ? (f.options || []).map((o) => o.trim()).filter(Boolean)
            : undefined,
      }))
      .filter((f) => f.label.length > 0);

    if (validFields.length === 0) {
      setErrorMsg('⚠️ တောင်းခံလိုသော အချက်အလက် အနည်းဆုံး (၁) ခု ထည့်သွင်းပေးပါ။');
      return;
    }

    ClassroomDB.saveQuiz(
      {
        id: initialForm?.id,
        courseId: course.id,
        title: title.trim(),
        description: description.trim(),
        durationMinutes: 60,
        passingScore: 100,
        itemType: 'data_form',
        formFields: validFields,
        allowStudentEditSubmission: allowStudentEdit,
        mode: 'exam',
        enableFlashcards: false,
        showAnswersImmediately: true,
        isOpen,
        timezoneMode,
        scheduledOpenAt: scheduledOpenAt.trim() || undefined,
        scheduledCloseAt: scheduledCloseAt.trim() || undefined,
        questions: [],
      },
      currentUser
    );
    onSaved();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-4"
      >
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-teal-600/10 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                {initialForm
                  ? 'ကျောင်းသား အချက်အလက်တောင်းခံလွှာ ပြင်ဆင်ခြင်း (Edit Data Form)'
                  : 'ကျောင်းသား အချက်အလက်တောင်းခံလွှာ အသစ်ဖန်တီးခြင်း (Create Data Form)'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                သင်တန်းသားများထံမှ လိုချင်သော Data များကို စိတ်ကြိုက်သတ်မှတ်တောင်းခံပြီး PDF သို့မဟုတ် Excel ဖိုင်အဖြစ် Download ထုတ်ယူနိုင်ပါသည်။
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-5 max-h-[84dvh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-800 text-xs font-bold text-rose-700 dark:text-rose-200">
              {errorMsg}
            </div>
          )}

          {/* Quick Preset Templates */}
          <div className="p-3.5 rounded-2xl bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200/80 dark:border-teal-800/70 space-y-2">
            <div className="text-xs font-extrabold text-teal-900 dark:text-teal-200 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-teal-600" />
              <span>အသင့်သုံး နမူနာ ပုံစံများ (1-Click Quick Templates — လိုသလို ပြန်ပြင်နိုင်သည်)</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {DATA_FORM_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleApplyPreset(preset.id)}
                  className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-teal-300 dark:border-teal-700 text-xs font-extrabold text-teal-800 dark:text-teal-200 hover:bg-teal-100 cursor-pointer transition-colors"
                >
                  {preset.badge}
                </button>
              ))}
            </div>
          </div>

          {/* Form Title & Description */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                ဖောင်ခေါင်းစဉ် (Form Title) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="ဥပမာ - သင်တန်းဆင်းလက်မှတ် (Certificate) အတွက် အချက်အလက် တောင်းခံလွှာ"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                လမ်းညွှန်ချက် / အကြောင်းအရာ (Description)
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="ကျောင်းသားများ ဖောင်ဖြည့်ရာတွင် သိရှိရမည့် အချက်အလက်များ..."
                className="w-full px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Open/Close Status & MMT Schedule */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-xs font-extrabold text-slate-800 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isOpen}
                  onChange={(e) => setIsOpen(e.target.checked)}
                  className="w-4 h-4 rounded accent-teal-600"
                />
                <span>🟢 ဖောင်ဖွင့်ထားမည် (ကျောင်းသားများ ဖြည့်သွင်းခွင့်ပြုမည်)</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowStudentEdit}
                  onChange={(e) => setAllowStudentEdit(e.target.checked)}
                  className="w-4 h-4 rounded accent-indigo-600"
                />
                <span>ဖောင်ဖွင့်ထားစဉ် ကျောင်းသားများ ပြန်လည်ပြင်ဆင်ခွင့်ပြုမည်</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200/70 dark:border-slate-700/70">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  စံတော်ချိန် (Timezone)
                </label>
                <select
                  value={timezoneMode}
                  onChange={(e) =>
                    setTimezoneMode(e.target.value === 'LOCAL' ? 'LOCAL' : 'MMT')
                  }
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200"
                >
                  <option value="MMT">🇲🇲 မြန်မာစံတော်ချိန် (MMT · UTC+06:30)</option>
                  <option value="LOCAL">🌐 မိမိစက် စံတော်ချိန် (Local Time)</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  ဖောင်စဖွင့်မည့်အချိန် (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={scheduledOpenAt}
                  onChange={(e) => setScheduledOpenAt(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-800 dark:text-slate-200"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  ဖောင်ပိတ်မည့်အချိန် (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={scheduledCloseAt}
                  onChange={(e) => setScheduledCloseAt(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-800 dark:text-slate-200"
                />
              </div>
            </div>
          </div>

          {/* Custom Fields Builder */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
                ကျောင်းသားများထံမှ တောင်းခံမည့် အချက်အလက် အကွက်များ ({fields.length} ခု)
              </h4>
              <button
                type="button"
                onClick={handleAddField}
                className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>အချက်အလက် အကွက်အသစ် ထပ်တိုးမည်</span>
              </button>
            </div>

            <div className="space-y-3">
              {fields.map((field, idx) => (
                <div
                  key={field.id}
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2.5 py-0.5 rounded-lg bg-teal-600 text-white text-xs font-extrabold font-mono">
                      အချက်အလက် #{idx + 1}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMoveField(idx, -1)}
                        className="p-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 disabled:opacity-30 cursor-pointer"
                        title="အပေါ်သို့ ရွှေ့ရန်"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === fields.length - 1}
                        onClick={() => handleMoveField(idx, 1)}
                        className="p-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 disabled:opacity-30 cursor-pointer"
                        title="အောက်သို့ ရွှေ့ရန်"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={fields.length <= 1}
                        onClick={() => handleRemoveField(idx)}
                        className="p-1 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 disabled:opacity-30 cursor-pointer"
                        title="ဤအကွက်ကို ဖျက်ရန်"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-5">
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                        တောင်းခံမည့် အချက်အလက် အမည် (Label) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={field.label}
                        onChange={(e) =>
                          handleUpdateField(idx, { label: e.target.value })
                        }
                        placeholder="ဥပမာ - မှတ်ပုံတင်အမှတ် (NRC) / Roll No."
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
                      />
                    </div>

                    <div className="sm:col-span-4">
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                        အမျိုးအစား (Field Type)
                      </label>
                      <select
                        value={field.type}
                        onChange={(e) =>
                          handleUpdateField(idx, {
                            type: e.target.value as DataFormFieldType,
                            ...(e.target.value === 'select' && !field.options
                              ? { options: ['ရွေးချယ်စရာ ၁', 'ရွေးချယ်စရာ ၂'] }
                              : {}),
                          })
                        }
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
                      >
                        <option value="text">📝 စာသားတို (Short Text)</option>
                        <option value="textarea">📄 စာသားရှည် / လိပ်စာ (Paragraph)</option>
                        <option value="number">🔢 English ဂဏန်းသီးသန့် (0-9 Number)</option>
                        <option value="phone">📞 ဖုန်းနံပါတ် (Phone Number)</option>
                        <option value="date">📅 ရက်စွဲ (Date Picker)</option>
                        <option value="select">☑️ ရွေးချယ်စရာ (Dropdown Options)</option>
                      </select>
                    </div>

                    <div className="sm:col-span-3 flex items-end pb-1.5">
                      <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={field.required}
                          onChange={(e) =>
                            handleUpdateField(idx, { required: e.target.checked })
                          }
                          className="w-4 h-4 rounded accent-teal-600"
                        />
                        <span>မဖြစ်မနေ ဖြည့်ရမည်</span>
                      </label>
                    </div>
                  </div>

                  {field.type === 'select' ? (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                        ရွေးချယ်စရာများ (ကော်မာ `,` သို့မဟုတ် `၊` ခြား၍ ရေးပါ)
                      </label>
                      <input
                        type="text"
                        value={(field.options || []).join(', ')}
                        onChange={(e) =>
                          handleUpdateField(idx, {
                            options: e.target.value
                              .split(/[,၊]/)
                              .map((s) => s.trim())
                              .filter(Boolean),
                          })
                        }
                        placeholder="ဥပမာ - Royal Express, ကိုယ်တိုင်လာရောက်ယူမည်"
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                        နမူနာပြ စာသား (Placeholder - Optional)
                      </label>
                      <input
                        type="text"
                        value={field.placeholder || ''}
                        onChange={(e) =>
                          handleUpdateField(idx, { placeholder: e.target.value })
                        }
                        placeholder="ကျောင်းသား အကွက်ထဲတွင် နမူနာပြထားမည့် စာသား..."
                        className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
            >
              ပယ်ဖျက်မည်
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs sm:text-sm font-extrabold shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {initialForm
                  ? 'အချက်အလက်တောင်းခံလွှာ ပြင်ဆင်သိမ်းဆည်းမည်'
                  : 'အချက်အလက်တောင်းခံလွှာ စတင်ထုတ်ပြန်မည်'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ============================================================================
 * 4. MODAL B: STUDENT FILL & SUBMIT DATA FORM MODAL (with PDF/Excel Receipt)
 * ============================================================================ */
export const StudentDataFormFillModal: React.FC<{
  form: Quiz;
  course: Course;
  currentUser: User;
  existingSubmission?: QuizSubmission;
  onClose: () => void;
  onSubmitted: () => void;
}> = ({
  form,
  course,
  currentUser,
  existingSubmission,
  onClose,
  onSubmitted,
}) => {
  const fields: DataFormField[] = useMemo(
    () =>
      Array.isArray(form.formFields) && form.formFields.length > 0
        ? form.formFields
        : DEFAULT_DATA_FORM_FIELDS,
    [form.formFields]
  );

  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    const existingResp = existingSubmission?.formResponses || {};
    fields.forEach((f) => {
      if (existingResp[f.id] !== undefined) {
        init[f.id] = existingResp[f.id];
      } else if (!existingSubmission) {
        // Smart auto-prefill from student profile on first open
        const lbl = f.label.toLowerCase();
        if (f.type === 'phone' || lbl.includes('ဖုန်း') || lbl.includes('phone') || lbl.includes('ph no')) {
          init[f.id] = currentUser.phone || '';
        } else if (lbl.includes('လိပ်စာ') || lbl.includes('address')) {
          init[f.id] = currentUser.address || '';
        } else if (lbl.includes('အမည်') || lbl.includes('name')) {
          init[f.id] = currentUser.name || '';
        } else if (f.type === 'select' && f.options && f.options.length > 0) {
          init[f.id] = f.options[0];
        } else {
          init[f.id] = '';
        }
      } else {
        init[f.id] = '';
      }
    });
    return init;
  });

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedSub, setSavedSub] = useState<QuizSubmission | null>(
    existingSubmission || null
  );
  const [justSubmitted, setJustSubmitted] = useState(false);

  const handleFieldChange = (field: DataFormField, rawVal: string) => {
    const nextVal =
      field.type === 'number' ? rawVal.replace(/[^0-9]/g, '') : rawVal;
    setValues((prev) => ({ ...prev, [field.id]: nextVal }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    for (const f of fields) {
      const val = (values[f.id] || '').trim();
      if (f.required && !val) {
        setErrorMsg(`⚠️ "${f.label}" အကွက်ကို မဖြစ်မနေ ဖြည့်သွင်းပေးပါ။`);
        return;
      }
    }
    const sub = ClassroomDB.submitDataForm(form, values, currentUser);
    setSavedSub(sub);
    setJustSubmitted(true);
    setErrorMsg(null);
    onSubmitted();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-4"
      >
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-teal-600/10 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                {form.title}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {course.code}: {course.title}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[82dvh] overflow-y-auto">
          {form.description && (
            <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
              {form.description}
            </div>
          )}

          {justSubmitted && (
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 space-y-2">
              <div className="text-xs sm:text-sm font-extrabold flex items-center gap-2">
                <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
                <span>
                  ✅ သင်၏ အချက်အလက်များကို ဆရာ / လက်ထောက်ဆရာများထံ အောင်မြင်စွာ ပေးပို့သိမ်းဆည်းပြီးပါပြီ!
                </span>
              </div>
              {savedSub && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => downloadDataFormPdf(form, course, [savedSub])}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>မိမိဖြည့်ထားသော ဖောင် PDF Download</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadDataFormExcelCsv(form, course, [savedSub])}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Excel / CSV Download</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-800 text-xs font-bold text-rose-700 dark:text-rose-200">
              {errorMsg}
            </div>
          )}

          <div className="space-y-4">
            {fields.map((field, idx) => {
              const val = values[field.id] ?? '';
              return (
                <div key={field.id} className="space-y-1.5">
                  <label className="block text-xs sm:text-sm font-extrabold text-slate-800 dark:text-slate-200">
                    {idx + 1}. {field.label}{' '}
                    {field.required && <span className="text-rose-500">*</span>}
                    {field.type === 'number' && (
                      <span className="ml-1.5 text-[11px] font-normal text-indigo-600 dark:text-indigo-400">
                        (English ဂဏန်း 0-9 သာ)
                      </span>
                    )}
                  </label>

                  {field.type === 'textarea' ? (
                    <textarea
                      rows={3}
                      required={field.required}
                      value={val}
                      onChange={(e) => handleFieldChange(field, e.target.value)}
                      placeholder={field.placeholder || `${field.label} ဖြည့်သွင်းပါ...`}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  ) : field.type === 'select' ? (
                    <select
                      required={field.required}
                      value={val}
                      onChange={(e) => handleFieldChange(field, e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="">-- ရွေးချယ်ပါ --</option>
                      {(field.options || []).map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type === 'date' ? 'date' : 'text'}
                      inputMode={field.type === 'number' ? 'numeric' : undefined}
                      pattern={field.type === 'number' ? '[0-9]*' : undefined}
                      required={field.required}
                      value={val}
                      onChange={(e) => handleFieldChange(field, e.target.value)}
                      placeholder={
                        field.placeholder ||
                        (field.type === 'number'
                          ? 'English ဂဏန်း (0-9) သာ ရိုက်ထည့်ပါ'
                          : `${field.label} ဖြည့်သွင်းပါ...`)
                      }
                      className={`w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                        field.type === 'number' ? 'font-mono' : ''
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
            <button
              type="button"
              onClick={() =>
                downloadDataFormPdf(
                  form,
                  course,
                  savedSub ? [savedSub] : [],
                  savedSub ? 'auto' : 'blank_form'
                )
              }
              className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-extrabold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-indigo-600" />
              <span>PDF ဖိုင် ထုတ်ယူရန်</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                ပိတ်မည်
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs sm:text-sm font-extrabold shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {existingSubmission
                    ? 'အချက်အလက် ပြင်ဆင်ပေးပို့မည် (Update)'
                    : 'အချက်အလက် အတည်ပြုပေးပို့မည် (Submit Form)'}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ============================================================================
 * 5. MODAL C: INSTRUCTOR DATA FORM RESPONSES TABLE & PDF / EXCEL DOWNLOAD MODAL
 * ============================================================================ */
export const DataFormResponsesModal: React.FC<{
  form: Quiz;
  course: Course;
  currentUser: User;
  enrolledStudents: User[];
  onClose: () => void;
  onRefresh: () => void;
}> = ({
  form,
  course,
  currentUser,
  enrolledStudents,
  onClose,
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const fields: DataFormField[] = useMemo(
    () =>
      Array.isArray(form.formFields) && form.formFields.length > 0
        ? form.formFields
        : DEFAULT_DATA_FORM_FIELDS,
    [form.formFields]
  );

  const allSubmissions = useMemo(
    () => ClassroomDB.getAllQuizSubmissionsForQuiz(form.id),
    [form.id, refreshTick]
  );

  const filteredSubmissions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allSubmissions;
    return allSubmissions.filter((sub) => {
      const respValues = Object.values(sub.formResponses || {}).join(' ');
      const hay = `${sub.studentName} ${sub.studentUsername || ''} ${respValues}`.toLowerCase();
      return hay.includes(q);
    });
  }, [allSubmissions, searchQuery]);

  const handleDownloadPdf = async (mode: 'auto' | 'blank_form' = 'auto') => {
    if (isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      await downloadDataFormPdf(form, course, filteredSubmissions, mode);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleDeleteSingleSubmission = (studentId: string) => {
    ClassroomDB.resetStudentQuizSubmission(form.id, studentId, currentUser);
    setRefreshTick((t) => t + 1);
    onRefresh();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-6xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-4"
      >
        {/* Top Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-600/10 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                {form.title} — ဖြည့်သွင်းထားသော ကျောင်းသားစာရင်း ({allSubmissions.length} /{' '}
                {enrolledStudents.length} ဦး)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                ကျောင်းသားများ ဖြည့်သွင်းထားသည့် အချက်အလက်အားလုံးကို PDF ဖိုင် သို့မဟုတ် Excel (CSV) ဖိုင်အဖြစ် တစ်ပေါင်းတည်း Download ဆွဲနိုင်ပါသည်။
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isExportingPdf}
              onClick={() => handleDownloadPdf('auto')}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-extrabold shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              <span>
                {isExportingPdf
                  ? 'PDF ပြုလုပ်နေပါသည်...'
                  : `📄 PDF File Download (${filteredSubmissions.length} ဦး)`}
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                downloadDataFormExcelCsv(form, course, filteredSubmissions)
              }
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>📗 Excel / CSV Download ({filteredSubmissions.length} ဦး)</span>
            </button>

            <button
              type="button"
              disabled={isExportingPdf}
              onClick={() => handleDownloadPdf('blank_form')}
              className="px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              title="ပရင့်ထုတ်ရန် ဖောင်အလွတ် PDF ထုတ်မည်"
            >
              <Download className="w-3.5 h-3.5" />
              <span>ဖောင်အလွတ် PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search & Summary Bar */}
        <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
            <span className="px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-950/70 text-teal-800 dark:text-teal-200 border border-teal-200 dark:border-teal-800">
              တောင်းခံထားသော အချက်အလက် ({fields.length}) ချက်
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 text-indigo-800 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800">
              ဖြည့်သွင်းပြီးသူ ({allSubmissions.length}) ဦး
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/70 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800">
              မဖြည့်ရသေးသူ ({Math.max(0, enrolledStudents.length - allSubmissions.length)}) ဦး
            </span>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ကျောင်းသားအမည်၊ ဖုန်း၊ အချက်အလက် ရှာရန်..."
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Responses Table */}
        <div className="p-5 max-h-[70dvh] overflow-auto">
          {filteredSubmissions.length === 0 ? (
            <div className="py-12 text-center space-y-3 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
              <Users className="w-10 h-10 text-slate-400 mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-extrabold text-slate-700 dark:text-slate-200">
                  ဖြည့်သွင်းထားသော ကျောင်းသား အချက်အလက် မရှိသေးပါ
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  ကျောင်းသားများက Exam Room ထဲရှိ ဤဖောင်တွင် ဝင်ရောက်ဖြည့်သွင်းသည့်အခါ စာရင်းအားလုံး ဤဇယားတွင် ပေါ်လာပါမည်။
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-extrabold border-b border-slate-200 dark:border-slate-700">
                    <th className="py-3 px-3 whitespace-nowrap">စဉ်</th>
                    <th className="py-3 px-3 whitespace-nowrap">အကောင့်အမည်</th>
                    {fields.map((f) => (
                      <th key={f.id} className="py-3 px-3 min-w-[140px]">
                        {f.label}
                      </th>
                    ))}
                    <th className="py-3 px-3 whitespace-nowrap">ပေးပို့ချိန် (MMT)</th>
                    <th className="py-3 px-3 text-right whitespace-nowrap">စီမံရန်</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredSubmissions.map((sub, idx) => {
                    const resp = sub.formResponses || {};
                    return (
                      <tr
                        key={sub.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <td className="py-3 px-3 font-mono font-bold text-slate-500">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-3 font-extrabold text-slate-900 dark:text-white whitespace-nowrap">
                          <div>{sub.studentName}</div>
                          {sub.studentUsername && (
                            <div className="text-[10px] font-mono text-slate-400">
                              @{sub.studentUsername}
                            </div>
                          )}
                        </td>
                        {fields.map((f) => (
                          <td
                            key={f.id}
                            className="py-3 px-3 font-semibold text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words max-w-xs"
                          >
                            {resp[f.id] || '-'}
                          </td>
                        ))}
                        <td className="py-3 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          {sub.submittedAt}
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleDeleteSingleSubmission(sub.studentId)}
                            className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-600 dark:text-rose-400 text-[11px] font-bold cursor-pointer"
                            title="ဤကျောင်းသား၏ ဖြည့်သွင်းချက်ကို ဖျက်၍ ပြန်ဖြည့်ခွင့်ပြုရန်"
                          >
                            ဖျက်မည်
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
