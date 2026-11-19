import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Course,
  User,
  BookDeliveryRecord,
  BookDeliveryStatus,
  BookDeliverySenderConfig,
} from '../types/classroom';
import { ClassroomDB } from '../services/storage';
import {
  Package,
  Download,
  Printer,
  Plus,
  Edit3,
  Trash2,
  CheckCircle2,
  Clock,
  Search,
  Settings,
  FileSpreadsheet,
  CheckSquare,
  Square,
  ChevronLeft,
  ChevronRight,
  Phone,
  MapPin,
  Hash,
  User as UserIcon,
  X,
  RefreshCw,
  Truck,
  ClipboardPaste,
  PackageCheck,
  RotateCcw,
} from 'lucide-react';

export const SWANARH_SLIP_TEMPLATE_ASSET = '/assets/aistudio/image_6f500bfd.png';

// Exact pixel bounding boxes inside /assets/aistudio/image_6f500bfd.png (498x720)
const LOGO_CROP_BOX = { sx: 403, sy: 19, sw: 82, sh: 82 };
const ILLUSTRATION_CROP_BOX = { sx: 35, sy: 179, sw: 213, sh: 168 };

interface BookDeliveryViewProps {
  course: Course;
  currentUser: User;
  onRefresh: () => void;
}

/**
 * Pure TypeScript Multi-Page JPEG-to-PDF 1.4 Binary Encoder for A4 LANDSCAPE.
 * Embeds each high-DPI A4 Landscape Canvas JPEG into an exact A4 Landscape page
 * (/MediaBox [0 0 841.89 595.28] -> 297mm x 210mm) and returns a genuine `application/pdf` Blob.
 */
function buildMultiPageA4LandscapePdfBlob(
  pages: Array<{ jpegBytes: Uint8Array; widthPx: number; heightPx: number }>
): Blob {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0]; // index 0 unused; 1-based PDF object offsets
  let currentByteLength = 0;

  const pushBytes = (bytes: Uint8Array) => {
    chunks.push(bytes);
    currentByteLength += bytes.byteLength;
  };

  const pushText = (str: string) => {
    pushBytes(encoder.encode(str));
  };

  // PDF 1.4 Header
  pushBytes(
    new Uint8Array([
      0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a,
    ])
  );

  const totalObjects = 2 + pages.length * 3;
  const pageObjIds = pages.map((_, i) => 3 + i * 3);

  // 1 0 obj (Catalog)
  offsets[1] = currentByteLength;
  pushText(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);

  // 2 0 obj (Pages)
  offsets[2] = currentByteLength;
  const kidsRef = pageObjIds.map((id) => `${id} 0 R`).join(' ');
  pushText(`2 0 obj\n<< /Type /Pages /Kids [ ${kidsRef} ] /Count ${pages.length} >>\nendobj\n`);

  // Exact A4 Landscape dimensions in PostScript points (297mm x 210mm)
  const a4LandscapeWidthPt = 841.89;
  const a4LandscapeHeightPt = 595.28;

  pages.forEach((page, i) => {
    const pageObjId = 3 + i * 3;
    const contentObjId = 4 + i * 3;
    const imageObjId = 5 + i * 3;
    const imgName = `/Im${i + 1}`;

    // Page Object
    offsets[pageObjId] = currentByteLength;
    pushText(
      `${pageObjId} 0 obj\n` +
        `<< /Type /Page /Parent 2 0 R /MediaBox [ 0 0 ${a4LandscapeWidthPt} ${a4LandscapeHeightPt} ] ` +
        `/Resources << /XObject << ${imgName} ${imageObjId} 0 R >> >> ` +
        `/Contents ${contentObjId} 0 R >>\n` +
        `endobj\n`
    );

    // Content Stream Object (draws the image across the full A4 Landscape page)
    const contentStream = `q\n${a4LandscapeWidthPt} 0 0 ${a4LandscapeHeightPt} 0 0 cm\n${imgName} Do\nQ\n`;
    const contentBytes = encoder.encode(contentStream);
    offsets[contentObjId] = currentByteLength;
    pushText(`${contentObjId} 0 obj\n<< /Length ${contentBytes.byteLength} >>\nstream\n`);
    pushBytes(contentBytes);
    pushText(`\nendstream\nendobj\n`);

    // Image XObject (DCTDecode JPEG)
    offsets[imageObjId] = currentByteLength;
    pushText(
      `${imageObjId} 0 obj\n` +
        `<< /Type /XObject /Subtype /Image ` +
        `/Width ${page.widthPx} /Height ${page.heightPx} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 ` +
        `/Filter /DCTDecode /Length ${page.jpegBytes.byteLength} >>\n` +
        `stream\n`
    );
    pushBytes(page.jpegBytes);
    pushText(`\nendstream\nendobj\n`);
  });

  // Cross-Reference Table (xref)
  const xrefOffset = currentByteLength;
  pushText(`xref\n0 ${totalObjects + 1}\n`);
  pushText(`0000000000 65535 f \n`);
  for (let objId = 1; objId <= totalObjects; objId++) {
    const offStr = String(offsets[objId] || 0).padStart(10, '0');
    pushText(`${offStr} 00000 n \n`);
  }

  // Trailer
  pushText(
    `trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  );

  return new Blob(chunks as BlobPart[], { type: 'application/pdf' });
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

/**
 * Word-wraps Burmese & English text across lines to fit `maxWidth` on a 2D Canvas.
 */
function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number = 4
): string[] {
  const rawLines = (text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (rawLines.length === 0) return [''];

  const wrapped: string[] = [];
  for (const rawLine of rawLines) {
    if (ctx.measureText(rawLine).width <= maxWidth) {
      wrapped.push(rawLine);
      continue;
    }
    const tokens = rawLine.split(/(\s+|၊\s*|။\s*|,\s*|\/)/).filter(Boolean);
    let currentLine = '';

    for (const token of tokens) {
      const candidate = currentLine ? currentLine + token : token;
      if (ctx.measureText(candidate).width <= maxWidth) {
        currentLine = candidate;
      } else {
        if (currentLine) {
          wrapped.push(currentLine.trim());
          currentLine = '';
        }
        if (ctx.measureText(token).width > maxWidth) {
          let charBuf = '';
          for (const ch of Array.from(token)) {
            if (ctx.measureText(charBuf + ch).width <= maxWidth) {
              charBuf += ch;
            } else {
              if (charBuf) wrapped.push(charBuf);
              charBuf = ch;
            }
          }
          currentLine = charBuf;
        } else {
          currentLine = token.trimStart();
        }
      }
    }
    if (currentLine.trim()) {
      wrapped.push(currentLine.trim());
    }
  }

  if (wrapped.length <= maxLines) return wrapped;
  const truncated = wrapped.slice(0, maxLines);
  truncated[maxLines - 1] = truncated[maxLines - 1] + '…';
  return truncated;
}

/**
 * Draws a single SwanArh Academy Book Delivery Slip onto a 2D Canvas rectangle (x, y, w, h)
 * matching the exact layout of `/assets/aistudio/image_6f500bfd.png` and fitting the quadrant ကွက်တိ.
 */
function drawSwanArhDeliverySlipOnCanvas(
  ctx: CanvasRenderingContext2D,
  box: { x: number; y: number; w: number; h: number },
  record: BookDeliveryRecord | null,
  sender: BookDeliverySenderConfig,
  templateImg: HTMLImageElement | null
) {
  const { x, y, w, h } = box;
  // Base coordinate system is 498 x 360; sx and sy map horizontally and vertically across the exact quadrant
  const sx = w / 498;
  const sy = h / 360;
  const s = Math.min(sx, sy);

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  // Crisp White Card Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, w, h);

  // Outer Card Border (ကွက်တိ Frame)
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = Math.max(1.5, 1.8 * s);
  ctx.strokeRect(x, y, w, h);

  // 1. Top-Right Circular Logo (DR. SI THU AUNG - SWANARH ACADEMY)
  const logoSize = 84 * s;
  const logoX = x + w - logoSize - 14 * sx;
  const logoY = y + 16 * sy;

  if (templateImg && templateImg.complete && templateImg.naturalWidth > 0) {
    ctx.drawImage(
      templateImg,
      LOGO_CROP_BOX.sx,
      LOGO_CROP_BOX.sy,
      LOGO_CROP_BOX.sw,
      LOGO_CROP_BOX.sh,
      logoX,
      logoY,
      logoSize,
      logoSize
    );
  } else {
    const cx = logoX + logoSize / 2;
    const cy = logoY + logoSize / 2;
    const r = logoSize / 2 - 2 * s;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 2 * s;
    ctx.strokeStyle = '#1e293b';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.65, 0, Math.PI * 2);
    ctx.strokeStyle = '#16a34a';
    ctx.lineWidth = 1.5 * s;
    ctx.stroke();

    ctx.fillStyle = '#dc2626';
    ctx.font = `800 ${Math.round(8.5 * s)}px "Georgia", serif`;
    ctx.textAlign = 'center';
    ctx.fillText('DR. SI THU AUNG', cx, cy - r * 0.72);

    ctx.fillStyle = '#15803d';
    ctx.font = `700 ${Math.round(7.5 * s)}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillText('SWANARH ACADEMY', cx, cy + r * 0.82);
    ctx.restore();
  }

  // 2. Bottom-Left Classroom Cartoon Illustration
  const illusW = 212 * sx;
  const illusH = 166 * sy;
  const illusX = x + 32 * sx;
  const illusY = y + h - illusH - 12 * sy;

  if (templateImg && templateImg.complete && templateImg.naturalWidth > 0) {
    ctx.drawImage(
      templateImg,
      ILLUSTRATION_CROP_BOX.sx,
      ILLUSTRATION_CROP_BOX.sy,
      ILLUSTRATION_CROP_BOX.sw,
      ILLUSTRATION_CROP_BOX.sh,
      illusX,
      illusY,
      illusW,
      illusH
    );
  }

  // 3. Top-Left "From" Section
  ctx.fillStyle = '#0f172a';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // "From"
  ctx.font = `800 ${Math.round(17 * s)}px "Georgia", "Times New Roman", serif`;
  ctx.fillText('From', x + 18 * sx, y + 38 * sy);

  // "SwanArh Academy"
  ctx.font = `800 ${Math.round(16 * s)}px "Georgia", "Times New Roman", serif`;
  ctx.fillText(sender.academyName || 'SwanArh Academy', x + 56 * sx, y + 63 * sy);

  // Address Lines (Burmese bold)
  ctx.font = `700 ${Math.round(13.5 * s)}px "Padauk", "Myanmar Text", "Pyidaungsu", "Plus Jakarta Sans", sans-serif`;
  const addrLines =
    sender.addressLines && sender.addressLines.length > 0
      ? sender.addressLines
      : [
          'အမှတ် (၄၆၀)၊ ဗိုလ်လက်ျာလမ်း၊',
          'ရန်အောင် (၁) ရပ်ကွက်၊ ပျဉ်းမနားမြို့၊',
          'နေပြည်တော်။',
        ];
  let addrY = y + 88 * sy;
  addrLines.slice(0, 3).forEach((line) => {
    ctx.fillText(line, x + 58 * sx, addrY);
    addrY += 23 * sy;
  });

  // Phone Icon Circle + Phone Numbers
  const phoneRowY = y + 154 * sy;
  const phoneIconCx = x + 44 * sx;
  const phoneIconCy = phoneRowY - 5 * sy;
  const phoneIconR = 8.5 * s;

  ctx.save();
  ctx.beginPath();
  ctx.arc(phoneIconCx, phoneIconCy, phoneIconR, 0, Math.PI * 2);
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.6 * s;
  ctx.stroke();
  ctx.fillStyle = '#0f172a';
  ctx.font = `700 ${Math.round(10 * s)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('✆', phoneIconCx, phoneIconCy + 0.5 * sy);
  ctx.restore();

  ctx.fillStyle = '#0f172a';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `800 ${Math.round(13.5 * s)}px "Georgia", "Times New Roman", serif`;
  ctx.fillText(sender.phones || '09-428121183, 09-969012234', x + 57 * sx, phoneRowY);

  // 4. Vertical Black Divider Line between From and Roll No.
  const divX = x + 259 * sx;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(divX, y + 66 * sy);
  ctx.lineTo(divX, y + 157 * sy);
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = Math.max(1.8, 2.2 * s);
  ctx.stroke();
  ctx.restore();

  // 5. "Roll No. (   2   )"
  const rollY = y + 100 * sy;
  ctx.fillStyle = '#0f172a';
  ctx.font = `800 ${Math.round(14 * s)}px "Georgia", "Times New Roman", serif`;
  ctx.textAlign = 'left';
  ctx.fillText('Roll No. (', x + 276 * sx, rollY);

  const rollValue = (record?.rollNo || '').trim();
  if (rollValue) {
    ctx.font = `800 ${Math.round(19 * s)}px "Georgia", "Times New Roman", serif`;
    ctx.textAlign = 'center';
    ctx.fillText(rollValue, x + 360 * sx, rollY + 1 * sy);
  }

  ctx.font = `800 ${Math.round(14 * s)}px "Georgia", "Times New Roman", serif`;
  ctx.textAlign = 'left';
  ctx.fillText(')', x + 382 * sx, rollY);

  // 6. Bottom-Right "To" Section
  const toBaseX = x + 269 * sx;
  const labelX = x + 289 * sx;
  const valueX = x + 356 * sx;
  const maxValueWidth = x + w - valueX - 12 * sx;

  // "To"
  ctx.fillStyle = '#0f172a';
  ctx.font = `800 ${Math.round(17.5 * s)}px "Georgia", "Times New Roman", serif`;
  ctx.fillText('To', toBaseX, y + 190 * sy);

  // "Name:"
  const nameY = y + 216 * sy;
  ctx.fillStyle = '#334155';
  ctx.font = `700 ${Math.round(15 * s)}px "Plus Jakarta Sans", sans-serif`;
  ctx.fillText('Name:', labelX, nameY);

  if (record?.studentName) {
    ctx.fillStyle = '#0f172a';
    ctx.font = `800 ${Math.round(14.5 * s)}px "Padauk", "Myanmar Text", "Pyidaungsu", "Plus Jakarta Sans", sans-serif`;
    const nameLines = wrapCanvasText(ctx, record.studentName, maxValueWidth + 10 * sx, 1);
    ctx.fillText(nameLines[0] || '', valueX - 10 * sx, nameY);
  }

  // "Address:"
  const addrLabelY = y + 243 * sy;
  ctx.fillStyle = '#334155';
  ctx.font = `700 ${Math.round(15 * s)}px "Plus Jakarta Sans", sans-serif`;
  ctx.fillText('Address:', labelX, addrLabelY);

  if (record?.address) {
    ctx.fillStyle = '#0f172a';
    ctx.font = `700 ${Math.round(13 * s)}px "Padauk", "Myanmar Text", "Pyidaungsu", "Plus Jakarta Sans", sans-serif`;
    const fullAddr = record.note ? `${record.address} (${record.note})` : record.address;
    const firstLineMaxW = x + w - (valueX + 4 * sx) - 10 * sx;
    const fullColMaxW = x + w - labelX - 12 * sx;
    const wrappedFirst = wrapCanvasText(ctx, fullAddr, firstLineMaxW, 5);

    if (wrappedFirst.length === 1) {
      ctx.fillText(wrappedFirst[0], valueX + 4 * sx, addrLabelY);
    } else {
      const blockLines = wrapCanvasText(ctx, fullAddr, fullColMaxW, 3);
      let curY = addrLabelY + 21 * sy;
      blockLines.forEach((ln) => {
        ctx.fillText(ln, labelX + 4 * sx, curY);
        curY += 19.5 * sy;
      });
    }
  }

  // "Ph No."
  const phY = y + 328 * sy;
  ctx.fillStyle = '#334155';
  ctx.font = `700 ${Math.round(15 * s)}px "Plus Jakarta Sans", sans-serif`;
  ctx.fillText('Ph No.', labelX, phY);

  if (record?.phone) {
    ctx.fillStyle = '#0f172a';
    ctx.font = `800 ${Math.round(14.5 * s)}px "Georgia", "Plus Jakarta Sans", sans-serif`;
    ctx.fillText(record.phone, valueX - 6 * sx, phY);
  }

  ctx.restore();
}

/**
 * Renders a complete A4 LANDSCAPE Page (297mm x 210mm) with 4 Student Slips fitted ကွက်တိ (2x2 Grid).
 */
function renderA4LandscapePageToCanvas(
  canvas: HTMLCanvasElement,
  pageRecords: Array<BookDeliveryRecord | null>,
  sender: BookDeliverySenderConfig,
  templateImg: HTMLImageElement | null,
  dpiScale: number = 2
) {
  // Standard A4 Landscape aspect ratio (297mm x 210mm -> 1.4142857 : 1)
  const baseW = 1169;
  const baseH = 827;
  const W = Math.round(baseW * dpiScale);
  const H = Math.round(baseH * dpiScale);

  if (canvas.width !== W || canvas.height !== H) {
    canvas.width = W;
    canvas.height = H;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Crisp white A4 Landscape sheet background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // Exact ကွက်တိ 2x2 Quadrant Division on A4 Landscape (minimal safe print border = 6px * dpiScale)
  const margin = Math.round(6 * dpiScale);
  const cellW = Math.floor((W - margin * 2) / 2);
  const cellH = Math.floor((H - margin * 2) / 2);

  for (let slot = 0; slot < 4; slot++) {
    const col = slot % 2;
    const row = Math.floor(slot / 2);
    const cellX = margin + col * cellW;
    const cellY = margin + row * cellH;
    const rec = pageRecords[slot] || null;

    drawSwanArhDeliverySlipOnCanvas(
      ctx,
      { x: cellX, y: cellY, w: cellW, h: cellH },
      rec,
      sender,
      templateImg
    );
  }

  // Center Cross Cut Line across the 4 quadrants
  const midX = margin + cellW;
  const midY = margin + cellH;
  ctx.save();
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = Math.max(1.5, 1.8 * dpiScale);
  ctx.beginPath();
  ctx.moveTo(midX, margin);
  ctx.lineTo(midX, margin + cellH * 2);
  ctx.moveTo(margin, midY);
  ctx.lineTo(margin + cellW * 2, midY);
  ctx.stroke();
  ctx.restore();
}

/**
 * Interactive Single Slip Preview Component (used in Student Form & Teacher Editor)
 */
const SingleSlipPreviewCanvas: React.FC<{
  record: BookDeliveryRecord;
  sender: BookDeliverySenderConfig;
  templateImg: HTMLImageElement | null;
}> = ({ record, sender, templateImg }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = 996;
    const H = 720;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawSwanArhDeliverySlipOnCanvas(ctx, { x: 0, y: 0, w: W, h: H }, record, sender, templateImg);
  }, [record, sender, templateImg]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-auto rounded-2xl shadow-md border border-slate-300 dark:border-slate-700 bg-white"
    />
  );
};

export const BookDeliveryView: React.FC<BookDeliveryViewProps> = ({
  course,
  currentUser,
  onRefresh,
}) => {
  const isInstructor = currentUser.role === 'admin' || currentUser.role === 'co_admin';
  const [refreshTick, setRefreshTick] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [templateImg, setTemplateImg] = useState<HTMLImageElement | null>(null);

  // Load SwanArh slip template image asset once for exact Logo + Classroom Illustration rendering
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => setTemplateImg(img);
    img.src = SWANARH_SLIP_TEMPLATE_ASSET;
  }, []);

  // Cloud Sync on open
  useEffect(() => {
    let mounted = true;
    ClassroomDB.syncBookDeliveriesFromCloud(true).then((changed) => {
      if (mounted && changed) {
        setRefreshTick((t) => t + 1);
        onRefresh();
      }
    });
    return () => {
      mounted = false;
    };
  }, [course.id]);

  const senderConfig = useMemo(
    () => ClassroomDB.getBookDeliverySenderConfig(),
    [refreshTick]
  );

  const allCourseDeliveries = useMemo(
    () => ClassroomDB.getBookDeliveries(course.id),
    [course.id, refreshTick]
  );

  const myStudentDelivery = useMemo(
    () => ClassroomDB.getStudentBookDelivery(course.id, currentUser.id),
    [course.id, currentUser.id, refreshTick]
  );

  // Student Self-Service Form State
  const [studentRollNo, setStudentRollNo] = useState(() => myStudentDelivery?.rollNo || '');
  const [studentName, setStudentName] = useState(
    () => myStudentDelivery?.studentName || currentUser.name || ''
  );
  const [studentAddress, setStudentAddress] = useState(
    () => myStudentDelivery?.address || currentUser.address || ''
  );
  const [studentPhone, setStudentPhone] = useState(
    () => myStudentDelivery?.phone || currentUser.phone || ''
  );
  const [studentNote, setStudentNote] = useState(() => myStudentDelivery?.note || '');
  const [studentSavedBanner, setStudentSavedBanner] = useState<string | null>(null);

  useEffect(() => {
    if (myStudentDelivery) {
      setStudentRollNo(myStudentDelivery.rollNo || '');
      setStudentName(myStudentDelivery.studentName || currentUser.name || '');
      setStudentAddress(myStudentDelivery.address || '');
      setStudentPhone(myStudentDelivery.phone || currentUser.phone || '');
      setStudentNote(myStudentDelivery.note || '');
    }
  }, [myStudentDelivery?.id, myStudentDelivery?.updatedAtMs]);

  // Instructor Filter & PDF Generator State
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'not_shipped' | 'shipped' | 'received' | 'printed'
  >('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [onlySelectedMode, setOnlySelectedMode] = useState(false);
  const [previewPageIdx, setPreviewPageIdx] = useState(0);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfSuccessNotice, setPdfSuccessNotice] = useState<{
    studentCount: number;
    pageCount: number;
    recordIds: string[];
  } | null>(null);

  // Instructor Modals
  const [editingRecord, setEditingRecord] = useState<BookDeliveryRecord | 'new' | null>(null);
  const [showBulkPasteModal, setShowBulkPasteModal] = useState(false);
  const [showSenderSettingsModal, setShowSenderSettingsModal] = useState(false);
  const [deleteConfirmRecord, setDeleteConfirmRecord] = useState<BookDeliveryRecord | null>(null);

  const a4PreviewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allCourseDeliveries.filter((rec) => {
      if (onlySelectedMode && !selectedIds.includes(rec.id)) return false;
      if (statusFilter === 'not_shipped') {
        if (rec.status !== 'pending' && rec.status !== 'printed') return false;
      } else if (statusFilter === 'shipped') {
        if (rec.status !== 'shipped') return false;
      } else if (statusFilter === 'received') {
        if (rec.status !== 'received') return false;
      } else if (statusFilter === 'printed') {
        if (rec.status !== 'printed') return false;
      }
      if (q) {
        const hay = `${rec.rollNo} ${rec.studentName} ${rec.address} ${rec.phone} ${rec.note || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allCourseDeliveries, statusFilter, searchQuery, onlySelectedMode, selectedIds]);

  // Chunk into A4 Landscape Pages of 4 students each
  const a4Pages = useMemo(() => {
    const pages: Array<Array<BookDeliveryRecord | null>> = [];
    if (filteredRecords.length === 0) {
      pages.push([null, null, null, null]);
      return pages;
    }
    for (let i = 0; i < filteredRecords.length; i += 4) {
      const slice: Array<BookDeliveryRecord | null> = filteredRecords.slice(i, i + 4);
      while (slice.length < 4) {
        slice.push(null);
      }
      pages.push(slice);
    }
    return pages;
  }, [filteredRecords]);

  useEffect(() => {
    if (previewPageIdx >= a4Pages.length) {
      setPreviewPageIdx(Math.max(0, a4Pages.length - 1));
    }
  }, [a4Pages.length, previewPageIdx]);

  // Render Live A4 Landscape Page Preview for Instructor
  useEffect(() => {
    if (!isInstructor || !a4PreviewCanvasRef.current) return;
    const currentPageRecords = a4Pages[previewPageIdx] || [null, null, null, null];
    renderA4LandscapePageToCanvas(
      a4PreviewCanvasRef.current,
      currentPageRecords,
      senderConfig,
      templateImg,
      1.5
    );
  }, [isInstructor, a4Pages, previewPageIdx, senderConfig, templateImg]);

  const handleManualCloudSync = async () => {
    setIsSyncing(true);
    try {
      await ClassroomDB.syncBookDeliveriesFromCloud(true);
      setRefreshTick((t) => t + 1);
      onRefresh();
    } finally {
      setIsSyncing(false);
    }
  };

  // Download Combined Multi-Page A4 LANDSCAPE PDF File (All Filtered/Selected Students, 4 per A4 sheet)
  const handleDownloadCombinedA4Pdf = async (recordsToExport: BookDeliveryRecord[]) => {
    if (isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    setPdfSuccessNotice(null);

    try {
      await new Promise((r) => setTimeout(r, 40));

      const exportPages: Array<Array<BookDeliveryRecord | null>> = [];
      if (recordsToExport.length === 0) {
        exportPages.push([null, null, null, null]);
      } else {
        for (let i = 0; i < recordsToExport.length; i += 4) {
          const chunk: Array<BookDeliveryRecord | null> = recordsToExport.slice(i, i + 4);
          while (chunk.length < 4) chunk.push(null);
          exportPages.push(chunk);
        }
      }

      const offscreenCanvas = document.createElement('canvas');
      const encodedPages: Array<{ jpegBytes: Uint8Array; widthPx: number; heightPx: number }> = [];

      for (let p = 0; p < exportPages.length; p++) {
        renderA4LandscapePageToCanvas(
          offscreenCanvas,
          exportPages[p],
          senderConfig,
          templateImg,
          2.0 // High-Definition 2338 x 1654 px A4 Landscape resolution
        );
        const jpegDataUrl = offscreenCanvas.toDataURL('image/jpeg', 0.94);
        encodedPages.push({
          jpegBytes: dataUrlToUint8Array(jpegDataUrl),
          widthPx: offscreenCanvas.width,
          heightPx: offscreenCanvas.height,
        });
      }

      const pdfBlob = buildMultiPageA4LandscapePdfBlob(encodedPages);
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      const cleanCode = (course.code || 'Course').replace(/[^a-zA-Z0-9_-]/g, '_');
      link.href = url;
      link.download = `SwanArh_Book_Delivery_A4_Landscape_${cleanCode}_${recordsToExport.length}Students_${exportPages.length}Pages.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 10_000);

      if (isInstructor && recordsToExport.length > 0) {
        setPdfSuccessNotice({
          studentCount: recordsToExport.length,
          pageCount: exportPages.length,
          recordIds: recordsToExport.map((r) => r.id),
        });
      }
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Export CSV / Excel Checklist of All Book Delivery Statuses
  const handleExportCsvReport = () => {
    const rows = [
      [
        'Roll No.',
        'Name',
        'Phone',
        'Address',
        'Note',
        'Status',
        'Shipped Time (MMT)',
        'Received Time (MMT)',
        'Submitted Time (MMT)',
      ],
    ];
    filteredRecords.forEach((r) => {
      const statusBurmese =
        r.status === 'received'
          ? 'စာအုပ်ရရှိပြီး (Received)'
          : r.status === 'shipped'
          ? 'ပို့ပြီး (Shipped)'
          : r.status === 'printed'
          ? 'PDF ထုတ်ပြီး (Printed)'
          : 'မပို့ရသေး (Pending)';
      rows.push([
        r.rollNo || '',
        r.studentName || '',
        r.phone || '',
        r.address || '',
        r.note || '',
        statusBurmese,
        r.shippedAt || '-',
        r.receivedAt || '-',
        r.createdAt || '-',
      ]);
    });

    const csvContent =
      '\uFEFF' +
      rows
        .map((row) =>
          row.map((cell) => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')
        )
        .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const cleanCode = (course.code || 'Course').replace(/[^a-zA-Z0-9_-]/g, '_');
    link.href = url;
    link.download = `SwanArh_Book_List_${cleanCode}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 5_000);
  };

  const handleSaveStudentOwnDelivery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim() || !studentAddress.trim() || !studentPhone.trim()) {
      setStudentSavedBanner('⚠️ အမည်၊ လိပ်စာအပြည့်အစုံ နှင့် ဖုန်းနံပါတ်တို့ကို ပြည့်စုံစွာ ဖြည့်သွင်းပေးပါ။');
      return;
    }
    ClassroomDB.saveBookDelivery(
      {
        id: myStudentDelivery?.id,
        course,
        studentId: currentUser.id,
        rollNo: studentRollNo.trim(),
        studentName: studentName.trim(),
        address: studentAddress.trim(),
        phone: studentPhone.trim(),
        note: studentNote.trim() || undefined,
      },
      currentUser
    );
    setRefreshTick((t) => t + 1);
    onRefresh();
    setStudentSavedBanner(
      '✅ သင်တန်းစာအုပ်ယူရန် သင့်လိပ်စာနှင့် ဖုန်းနံပါတ်ကို အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ!'
    );
    setTimeout(() => setStudentSavedBanner(null), 5000);
  };

  const handleStudentConfirmBookReceived = (received: boolean) => {
    if (!myStudentDelivery) return;
    ClassroomDB.confirmStudentBookReceived(course.id, currentUser, received);
    setRefreshTick((t) => t + 1);
    onRefresh();
    setStudentSavedBanner(
      received
        ? '🎉 စာအုပ် လက်ခံရရှိပြီးကြောင်း ဆရာ / လက်ထောက်ဆရာများထံ အသိပေး အတည်ပြုပြီးပါပြီ!'
        : '🔄 စာအုပ် လက်ခံရရှိမှု အတည်ပြုချက်ကို ပြန်လည်ပြင်ဆင်ပြီးပါပြီ။'
    );
    setTimeout(() => setStudentSavedBanner(null), 5000);
  };

  const toggleSelectRecord = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAllFiltered = () => {
    const filteredIdList = filteredRecords.map((r) => r.id);
    const allSelected =
      filteredIdList.length > 0 && filteredIdList.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !filteredIdList.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...filteredIdList])));
    }
  };

  const handleBatchMarkStatus = (ids: string[], status: BookDeliveryStatus) => {
    if (ids.length === 0) return;
    ClassroomDB.updateBookDeliveryStatus(ids, status, currentUser);
    setRefreshTick((t) => t + 1);
    onRefresh();
    setPdfSuccessNotice(null);
  };

  const notShippedCount = allCourseDeliveries.filter(
    (r) => r.status === 'pending' || r.status === 'printed'
  ).length;
  const printedCount = allCourseDeliveries.filter((r) => r.status === 'printed').length;
  const shippedCount = allCourseDeliveries.filter((r) => r.status === 'shipped').length;
  const receivedCount = allCourseDeliveries.filter((r) => r.status === 'received').length;

  /* ============================================================================
   * STUDENT VIEW: Self-Service Address Entry, Book Received Confirmation & Slip Preview
   * ============================================================================ */
  if (!isInstructor) {
    const livePreviewRecord: BookDeliveryRecord = {
      id: myStudentDelivery?.id || 'preview',
      courseId: course.id,
      studentId: currentUser.id,
      rollNo: studentRollNo.trim(),
      studentName: studentName.trim() || currentUser.name,
      address: studentAddress.trim() || 'လိပ်စာ ဖြည့်သွင်းရန်...',
      phone: studentPhone.trim() || currentUser.phone || '09-XXXXXXXXX',
      note: studentNote.trim() || undefined,
      status: myStudentDelivery?.status || 'pending',
      updatedByRole: 'student',
      createdAt: myStudentDelivery?.createdAt || 'ယခု',
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
    };

    const isReceived = myStudentDelivery?.status === 'received';
    const isShipped = myStudentDelivery?.status === 'shipped' || isReceived;

    return (
      <div className="space-y-6">
        {/* Student Header & Book Received Confirmation Card */}
        <div className="neu-card rounded-3xl p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                  သင်တန်းစာအုပ်ယူရန် နှင့် လက်ခံရရှိမှု အသိပေးခြင်း (Book Delivery)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  သင်တန်းစာအုပ်များ ပေးပို့နိုင်ရန် သင်၏ Roll No., အမည်, လိပ်စာ, ဖုန်းနံပါတ်ကို ဖြည့်သွင်းပြီး၊ စာအုပ်ရောက်ရှိပါက အောက်ပါခလုတ်မှတစ်ဆင့် ရရှိကြောင်း အသိပေးနိုင်ပါသည်။
                </p>
              </div>
            </div>
          </div>

          {/* 3-Step Delivery Progress & Student "Confirm Book Received" Action Panel */}
          {myStudentDelivery && (
            <div
              className={`p-4 sm:p-5 rounded-2xl border transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                isReceived
                  ? 'bg-emerald-50/90 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700'
                  : isShipped
                  ? 'bg-indigo-50/90 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700'
                  : 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800'
              }`}
            >
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-xs font-extrabold">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>၁။ လိပ်စာပေးပို့ပြီး</span>
                  </span>
                  <span className="text-slate-400">→</span>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border ${
                      isShipped
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white/60 dark:bg-slate-900/50 text-slate-500 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <Truck className="w-3.5 h-3.5" />
                    <span>၂။ {isShipped ? 'ဆရာဘက်မှ ပို့ဆောင်ပြီး' : 'ပို့ဆောင်ရန် ပြင်ဆင်ဆဲ'}</span>
                  </span>
                  <span className="text-slate-400">→</span>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border ${
                      isReceived
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white/60 dark:bg-slate-900/50 text-slate-500 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <PackageCheck className="w-3.5 h-3.5" />
                    <span>၃။ {isReceived ? 'စာအုပ် လက်ခံရရှိပြီး' : 'စာအုပ် လက်ခံရရှိရန်'}</span>
                  </span>
                </div>

                <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">
                  {isReceived ? (
                    <>
                      🎉 သင်တန်းစာအုပ် လက်ခံရရှိပြီးကြောင်း ဆရာ/လက်ထောက်ဆရာများထံ အသိပေးပြီးပါပြီ။{' '}
                      {myStudentDelivery.receivedAt && (
                        <span className="text-xs font-mono text-emerald-700 dark:text-emerald-300">
                          (ရရှိချိန်: {myStudentDelivery.receivedAt})
                        </span>
                      )}
                    </>
                  ) : isShipped ? (
                    <>
                      🚚 ဆရာ/ဆရာမများဘက်မှ သင့်ထံသို့ စာအုပ်ပို့ဆောင်ပေးလိုက်ပါပြီ! စာအုပ်လက်ဝယ်ရောက်ရှိပါက ညာဘက်ရှိ{' '}
                      <strong>&ldquo;စာအုပ် လက်ခံရရှိပါပြီ&rdquo;</strong> ခလုတ်ကို နှိပ်၍ အသိပေးပါ။
                    </>
                  ) : (
                    <>
                      📦 သင်၏ လိပ်စာကို ဆရာ/ဆရာမများထံ ပေးပို့ထားပြီး ဖြစ်ပါသည်။ စာအုပ်လက်ခံရရှိသည့်အခါ ညာဘက်ရှိ{' '}
                      <strong>&ldquo;စာအုပ် လက်ခံရရှိပါပြီ&rdquo;</strong> ခလုတ်ကို နှိပ်၍ အသိပေးနိုင်ပါသည်။
                    </>
                  )}
                </p>
              </div>

              <div className="shrink-0">
                {isReceived ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs sm:text-sm font-extrabold flex items-center gap-2 shadow-sm">
                      <PackageCheck className="w-4 h-4" />
                      <span>စာအုပ် လက်ခံရရှိပြီး (Received ✅)</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleStudentConfirmBookReceived(false)}
                      className="px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 flex items-center gap-1 cursor-pointer"
                      title="မှားနှိပ်မိပါက မရရှိသေးအဖြစ် ပြန်ပြင်ရန်"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>ပြန်ပြင်ရန်</span>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleStudentConfirmBookReceived(true)}
                    className="px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-extrabold shadow-md flex items-center gap-2 cursor-pointer transition-all"
                  >
                    <PackageCheck className="w-4.5 h-4.5" />
                    <span>📬 စာအုပ် လက်ခံရရှိပါပြီ (ဆရာ့ထံ အသိပေးမည်)</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {studentSavedBanner && (
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs sm:text-sm font-bold flex items-center justify-between gap-3">
            <span>{studentSavedBanner}</span>
            <button
              type="button"
              onClick={() => setStudentSavedBanner(null)}
              className="text-xs underline cursor-pointer shrink-0"
            >
              ပိတ်မည်
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Student Input Form */}
          <form
            onSubmit={handleSaveStudentOwnDelivery}
            className="lg:col-span-6 neu-card rounded-3xl p-5 sm:p-6 space-y-4"
          >
            <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>စာအုပ်လက်ခံမည့်သူ အချက်အလက် ဖြည့်ရန်</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Roll No. (ခုံနံပါတ်)
                </label>
                <div className="relative">
                  <Hash className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={studentRollNo}
                    onChange={(e) => setStudentRollNo(e.target.value)}
                    placeholder="ဥပမာ - 2"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Name (အမည်) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    placeholder="ကျောင်းသား အမည်အပြည့်အစုံ"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Address (စာအုပ်ပို့ရမည့် လိပ်စာအပြည့်အစုံ) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <textarea
                  rows={3}
                  required
                  value={studentAddress}
                  onChange={(e) => setStudentAddress(e.target.value)}
                  placeholder="အိမ်အမှတ်၊ လမ်း၊ ရပ်ကွက်၊ မြို့နယ်၊ တိုင်း/ပြည်နယ် (သို့မဟုတ်) လက်ခံမည့် ကားဂိတ် / Express အမည်"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Ph No. (ဖုန်းနံပါတ်) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={studentPhone}
                    onChange={(e) => setStudentPhone(e.target.value)}
                    placeholder="09-XXXXXXXXX"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  ပို့ဆောင်ရေး မှတ်ချက် (Optional)
                </label>
                <input
                  type="text"
                  value={studentNote}
                  onChange={(e) => setStudentNote(e.target.value)}
                  placeholder="ဥပမာ - Royal Express / ကားဂိတ်ထုတ်"
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-end gap-3">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-extrabold shadow-md flex items-center gap-2 cursor-pointer transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {myStudentDelivery
                    ? 'လိပ်စာ ပြင်ဆင်သိမ်းဆည်းမည် (Update Address)'
                    : 'လိပ်စာ အတည်ပြုပေးပို့မည် (Submit Address)'}
                </span>
              </button>
            </div>
          </form>

          {/* Right: Live SwanArh Academy Parcel Slip Preview */}
          <div className="lg:col-span-6 neu-card rounded-3xl p-5 sm:p-6 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                စာအုပ်ပို့မည့် လိပ်စာကတ် နမူနာ (Live Slip Preview)
              </h4>
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                SwanArh Academy Official Slip
              </span>
            </div>

            <SingleSlipPreviewCanvas
              record={livePreviewRecord}
              sender={senderConfig}
              templateImg={templateImg}
            />

            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              အထက်ပါ ပုံစံအတိုင်း ဆရာ/ဆရာမများဘက်တွင် A4 Landscape တစ်ရွက် (၄) ယောက်စာ ကွက်တိ PDF လိပ်စာကတ် ထွက်ရှိမည်ဖြစ်ပါသည်။
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* ============================================================================
   * INSTRUCTOR (ADMIN / CO-ADMIN) VIEW: Tracking Dashboard & A4 Landscape 4-Up PDF
   * ============================================================================ */
  return (
    <div className="space-y-6">
      {/* Top Action & Summary Header */}
      <div className="neu-card rounded-3xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                  သင်တန်းစာအုပ်ယူရန် စာရင်းစီမံခန့်ခွဲမှု နှင့် A4 Landscape (၄ ယောက်စာ ကွက်တိ) PDF စနစ်
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  မပို့ရသေးသူ၊ ပို့ပြီးသူ နှင့် ကျောင်းသားဘက်မှ စာအုပ်လက်ခံရရှိပြီးသူများကို တစ်နေရာတည်းတွင် အလွယ်တကူ စစ်ဆေးမှတ်သားပြီး A4 Landscape PDF ထုတ်နိုင်ပါသည်။
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleManualCloudSync}
              disabled={isSyncing}
              className="px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
              title="Cloud မှ နောက်ဆုံး အချက်အလက်များ ဆွဲယူမည်"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-indigo-600' : ''}`} />
              <span>Sync</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsvReport}
              disabled={filteredRecords.length === 0}
              className="px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 disabled:opacity-40 flex items-center gap-1.5 cursor-pointer"
              title="စာအုပ်ရရှိပြီး/ပို့ပြီး/မပို့ရသေး စာရင်းချုပ်ကို Excel/CSV ဖိုင်ထုတ်မည်"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Excel/CSV စာရင်းထုတ်ရန်</span>
            </button>

            <button
              type="button"
              onClick={() => setShowSenderSettingsModal(true)}
              className="px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5 text-slate-500" />
              <span>From လိပ်စာပြင်ရန်</span>
            </button>

            <button
              type="button"
              onClick={() => setShowBulkPasteModal(true)}
              className="px-3.5 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 text-xs font-extrabold hover:bg-amber-100 flex items-center gap-1.5 cursor-pointer"
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              <span>စာရင်းအများကြီး အမြန်သွင်းမည်</span>
            </button>

            <button
              type="button"
              onClick={() => setEditingRecord('new')}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>လိပ်စာအသစ် ထည့်မည်</span>
            </button>
          </div>
        </div>

        {/* 4 Interactive Status Summary Cards (All · Not Shipped · Shipped · Book Received) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          <button
            type="button"
            onClick={() => {
              setStatusFilter('all');
              setOnlySelectedMode(false);
            }}
            className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
              statusFilter === 'all' && !onlySelectedMode
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                : 'bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 hover:border-indigo-300'
            }`}
          >
            <div
              className={`text-[11px] font-bold ${
                statusFilter === 'all' && !onlySelectedMode
                  ? 'text-indigo-100'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              စုစုပေါင်း စာရင်းသွင်းသူ (All)
            </div>
            <div className="text-xl sm:text-2xl font-extrabold font-mono tabular-nums mt-1">
              {allCourseDeliveries.length} <span className="text-xs font-normal">ဦး</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setStatusFilter('not_shipped');
              setOnlySelectedMode(false);
            }}
            className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
              statusFilter === 'not_shipped' && !onlySelectedMode
                ? 'bg-amber-600 text-white border-amber-600 shadow-md'
                : 'bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 hover:border-amber-400'
            }`}
          >
            <div
              className={`text-[11px] font-bold ${
                statusFilter === 'not_shipped' && !onlySelectedMode
                  ? 'text-amber-100'
                  : 'text-amber-700 dark:text-amber-400'
              }`}
            >
              📦 မပို့ရသေးသူများ (Not Shipped)
            </div>
            <div className="text-xl sm:text-2xl font-extrabold font-mono tabular-nums mt-1">
              {notShippedCount} <span className="text-xs font-normal">ဦး</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setStatusFilter('shipped');
              setOnlySelectedMode(false);
            }}
            className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
              statusFilter === 'shipped' && !onlySelectedMode
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                : 'bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 hover:border-indigo-400'
            }`}
          >
            <div
              className={`text-[11px] font-bold ${
                statusFilter === 'shipped' && !onlySelectedMode
                  ? 'text-indigo-100'
                  : 'text-indigo-600 dark:text-indigo-400'
              }`}
            >
              🚚 ပို့ပြီးသူများ (Shipped)
            </div>
            <div className="text-xl sm:text-2xl font-extrabold font-mono tabular-nums mt-1">
              {shippedCount} <span className="text-xs font-normal">ဦး</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setStatusFilter('received');
              setOnlySelectedMode(false);
            }}
            className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
              statusFilter === 'received' && !onlySelectedMode
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                : 'bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 hover:border-emerald-400'
            }`}
          >
            <div
              className={`text-[11px] font-bold ${
                statusFilter === 'received' && !onlySelectedMode
                  ? 'text-emerald-100'
                  : 'text-emerald-700 dark:text-emerald-400'
              }`}
            >
              ✅ စာအုပ်ရရှိပြီးသူများ (Received)
            </div>
            <div className="text-xl sm:text-2xl font-extrabold font-mono tabular-nums mt-1">
              {receivedCount} <span className="text-xs font-normal">ဦး</span>
            </div>
          </button>
        </div>

        {/* Filter Pills & Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-200/80 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setStatusFilter('all');
                setOnlySelectedMode(false);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-colors cursor-pointer ${
                statusFilter === 'all' && !onlySelectedMode
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              အားလုံး ({allCourseDeliveries.length})
            </button>

            <button
              type="button"
              onClick={() => {
                setStatusFilter('not_shipped');
                setOnlySelectedMode(false);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-colors cursor-pointer ${
                statusFilter === 'not_shipped' && !onlySelectedMode
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              📦 မပို့ရသေး ({notShippedCount})
            </button>

            <button
              type="button"
              onClick={() => {
                setStatusFilter('shipped');
                setOnlySelectedMode(false);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-colors cursor-pointer ${
                statusFilter === 'shipped' && !onlySelectedMode
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              🚚 ပို့ပြီး ({shippedCount})
            </button>

            <button
              type="button"
              onClick={() => {
                setStatusFilter('received');
                setOnlySelectedMode(false);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-colors cursor-pointer ${
                statusFilter === 'received' && !onlySelectedMode
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              ✅ စာအုပ်ရရှိပြီး ({receivedCount})
            </button>

            {printedCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('printed');
                  setOnlySelectedMode(false);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-colors cursor-pointer ${
                  statusFilter === 'printed' && !onlySelectedMode
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                🖨️ PDF ထုတ်ပြီး ({printedCount})
              </button>
            )}

            {selectedIds.length > 0 && (
              <button
                type="button"
                onClick={() => setOnlySelectedMode((v) => !v)}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-colors cursor-pointer ${
                  onlySelectedMode
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-700'
                }`}
              >
                ရွေးချယ်ထားသူများသာ ({selectedIds.length})
              </button>
            )}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Roll No., အမည်, မြို့နယ်, ဖုန်း ရှာရန်..."
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
      </div>

      {/* Post-Download Status Prompt Banner */}
      {pdfSuccessNotice && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs sm:text-sm font-bold text-emerald-900 dark:text-emerald-200">
            ✅ ကျောင်းသား <strong>{pdfSuccessNotice.studentCount} ဦး</strong> အတွက် A4 Landscape စာမျက်နှာ{' '}
            <strong>{pdfSuccessNotice.pageCount} ရွက်</strong> (၁ မျက်နှာ ၄ ယောက်စာ ကွက်တိ) PDF File Download ဆွဲပြီးပါပြီ!
            ထိုကျောင်းသားများကို အောက်ပါအတိုင်း မှတ်သားထားမည်လား?
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleBatchMarkStatus(pdfSuccessNotice.recordIds, 'shipped')}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold cursor-pointer"
            >
              🚚 ပို့ပြီး (Shipped) အဖြစ် မှတ်မည်
            </button>
            <button
              type="button"
              onClick={() => handleBatchMarkStatus(pdfSuccessNotice.recordIds, 'printed')}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-extrabold cursor-pointer"
            >
              🖨️ PDF ထုတ်ပြီးအဖြစ် မှတ်မည်
            </button>
            <button
              type="button"
              onClick={() => setPdfSuccessNotice(null)}
              className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:underline cursor-pointer"
            >
              ပိတ်မည်
            </button>
          </div>
        </div>
      )}

      {/* Main Two-Column Workspace: Left = Student Tracking List, Right = Live A4 Landscape (4-Up) Preview & PDF Download */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN (7 cols): Student Delivery & Receipt Directory */}
        <div className="xl:col-span-7 neu-card rounded-3xl p-4 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleSelectAllFiltered}
                className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                title="အားလုံး ရွေးချယ်ရန် / ပြန်ဖြုတ်ရန်"
              >
                {filteredRecords.length > 0 &&
                filteredRecords.every((r) => selectedIds.includes(r.id)) ? (
                  <CheckSquare className="w-4.5 h-4.5 text-indigo-600 dark:text-indigo-400" />
                ) : (
                  <Square className="w-4.5 h-4.5" />
                )}
              </button>
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                ကျောင်းသား စာအုပ်ပို့ဆောင်မှု စာရင်း ({filteredRecords.length} ဦး · A4 Landscape {a4Pages.length} ရွက်)
              </h4>
            </div>

            {selectedIds.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleBatchMarkStatus(selectedIds, 'pending')}
                  className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 text-[11px] font-extrabold cursor-pointer"
                >
                  ရွေးထားသူများ → 📦 မပို့ရသေး
                </button>
                <button
                  type="button"
                  onClick={() => handleBatchMarkStatus(selectedIds, 'shipped')}
                  className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700 text-[11px] font-extrabold cursor-pointer"
                >
                  ရွေးထားသူများ → 🚚 ပို့ပြီး
                </button>
                <button
                  type="button"
                  onClick={() => handleBatchMarkStatus(selectedIds, 'received')}
                  className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 text-[11px] font-extrabold cursor-pointer"
                >
                  ရွေးထားသူများ → ✅ ရရှိပြီး
                </button>
              </div>
            )}
          </div>

          {filteredRecords.length === 0 ? (
            <div className="py-12 px-4 text-center space-y-3 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
              <Package className="w-10 h-10 text-slate-400 mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-extrabold text-slate-700 dark:text-slate-200">
                  ရွေးချယ်ထားသော အမျိုးအစားတွင် ကျောင်းသားစာရင်း မရှိသေးပါ
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  ကျောင်းသားများက &ldquo;စာအုပ်ယူရန်&rdquo; Tab မှ ကိုယ်တိုင် ဝင်ရောက်ဖြည့်သွင်းနိုင်သလို၊ ဆရာ/လက်ထောက်ဆရာများဘက်မှလည်း တိုက်ရိုက် ထည့်သွင်းနိုင်ပါသည်။
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingRecord('new')}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold cursor-pointer"
                >
                  + လိပ်စာအသစ် ထည့်မည်
                </button>
                <button
                  type="button"
                  onClick={() => setShowBulkPasteModal(true)}
                  className="px-4 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 text-xs font-extrabold cursor-pointer"
                >
                  📋 စာရင်းအများကြီး အမြန်သွင်းမည်
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[700px] overflow-y-auto pr-1">
              {filteredRecords.map((rec, idx) => {
                const isSelected = selectedIds.includes(rec.id);
                const pageNumber = Math.floor(idx / 4) + 1;
                const isNotShipped = rec.status === 'pending' || rec.status === 'printed';

                return (
                  <div
                    key={rec.id}
                    className={`p-3.5 rounded-2xl border transition-all flex flex-col gap-3 ${
                      isSelected
                        ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-400 dark:border-indigo-700'
                        : rec.status === 'received'
                        ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/80'
                        : 'bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => toggleSelectRecord(rec.id)}
                          className="mt-0.5 text-slate-500 hover:text-indigo-600 cursor-pointer shrink-0"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4.5 h-4.5 text-indigo-600 dark:text-indigo-400" />
                          ) : (
                            <Square className="w-4.5 h-4.5" />
                          )}
                        </button>

                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2 py-0.5 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-extrabold font-mono">
                              Roll No. ({rec.rollNo || '-'})
                            </span>
                            <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                              {rec.studentName}
                            </span>
                            <span className="text-[11px] font-mono text-slate-400">
                              · A4 စာမျက်နှာ {pageNumber}
                            </span>
                          </div>

                          <p className="text-xs text-slate-700 dark:text-slate-300 font-medium break-words">
                            📍 {rec.address}
                            {rec.note ? ` (${rec.note})` : ''}
                          </p>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 font-mono">
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              📞 {rec.phone || '-'}
                            </span>
                            {rec.shippedAt && (
                              <span className="text-indigo-600 dark:text-indigo-400">
                                · ပို့ချိန်: {rec.shippedAt}
                              </span>
                            )}
                            {rec.receivedAt && (
                              <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                                · ကျောင်းသားရရှိချိန်: {rec.receivedAt}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Edit / Preview / Delete Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setPreviewPageIdx(Math.floor(idx / 4))}
                          className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-[11px] font-bold cursor-pointer"
                          title="ဤကျောင်းသားပါဝင်သော A4 Landscape စာမျက်နှာကို ကြည့်မည်"
                        >
                          A4 ကြည့်ရန်
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingRecord(rec)}
                          className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 cursor-pointer"
                          title="ပြင်ဆင်မည် (Edit)"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmRecord(rec)}
                          className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-600 dark:text-rose-400 cursor-pointer"
                          title="ဖျက်မည် (Delete)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Easy 1-Click Status Switcher Bar for Teachers & Co-Admins */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 pl-7">
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        စာအုပ်အခြေအနေ သတ်မှတ်ရန် —
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleBatchMarkStatus([rec.id], 'pending')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold border transition-all cursor-pointer ${
                            isNotShipped
                              ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                              : 'bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-amber-400'
                          }`}
                        >
                          📦 မပို့ရသေး {rec.status === 'printed' ? '(PDF ထုတ်ပြီး)' : ''}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleBatchMarkStatus([rec.id], 'shipped')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold border transition-all cursor-pointer ${
                            rec.status === 'shipped'
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                              : 'bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                          }`}
                        >
                          🚚 ပို့ပြီး (Shipped)
                        </button>

                        <button
                          type="button"
                          onClick={() => handleBatchMarkStatus([rec.id], 'received')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold border transition-all cursor-pointer ${
                            rec.status === 'received'
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                              : 'bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-emerald-400'
                          }`}
                        >
                          ✅ စာအုပ်ရရှိပြီး (Received)
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN (5 cols): Live A4 Landscape (4-Up Exact Fit) Sheet Preview & Combined PDF Download */}
        <div className="xl:col-span-5 neu-card rounded-3xl p-4 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                A4 Landscape တစ်မျက်နှာ (၄) ယောက်စာ ကွက်တိ နမူနာ
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                A4 အလျားလိုက် (297mm × 210mm) · စုစုပေါင်း {filteredRecords.length} ဦး → A4 ({a4Pages.length}) ရွက်
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[11px] font-extrabold">
              A4 Landscape 2×2 ကွက်တိ
            </span>
          </div>

          {/* Primary Combined Multi-Page A4 Landscape PDF Download CTA */}
          <button
            type="button"
            disabled={isGeneratingPdf || filteredRecords.length === 0}
            onClick={() => handleDownloadCombinedA4Pdf(filteredRecords)}
            className="w-full py-3.5 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold text-xs sm:text-sm shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            <Download className={`w-4.5 h-4.5 ${isGeneratingPdf ? 'animate-bounce' : ''}`} />
            <span>
              {isGeneratingPdf
                ? 'A4 Landscape စာမျက်နှာများအားလုံးကို PDF ပေါင်းစည်းနေပါသည်...'
                : `အားလုံးကို တစ်ပေါင်းတည်း A4 Landscape PDF Download (${filteredRecords.length} ဦး · ${a4Pages.length} ရွက်)`}
            </span>
          </button>

          {/* Page Navigation Bar */}
          {a4Pages.length > 1 && (
            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold">
              <button
                type="button"
                disabled={previewPageIdx <= 0}
                onClick={() => setPreviewPageIdx((p) => Math.max(0, p - 1))}
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 disabled:opacity-40 flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>ရှေ့စာမျက်နှာ</span>
              </button>

              <span className="font-mono text-slate-700 dark:text-slate-200">
                A4 Landscape စာမျက်နှာ {previewPageIdx + 1} / {a4Pages.length}
              </span>

              <button
                type="button"
                disabled={previewPageIdx >= a4Pages.length - 1}
                onClick={() => setPreviewPageIdx((p) => Math.min(a4Pages.length - 1, p + 1))}
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 disabled:opacity-40 flex items-center gap-1 cursor-pointer"
              >
                <span>နောက်စာမျက်နှာ</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Live A4 Landscape Canvas Preview Stage */}
          <div className="p-3 rounded-2xl bg-slate-200/80 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 flex flex-col items-center">
            <canvas
              ref={a4PreviewCanvasRef}
              className="w-full h-auto rounded-lg shadow-xl bg-white border border-slate-300"
            />
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 text-center">
              A4 Landscape တစ်ရွက်လျှင် ဘယ် (၂) ယောက်၊ ညာ (၂) ယောက် — စုစုပေါင်း (၄) ယောက်စာ ကွက်တိ ထွက်ရှိပါသည်။
            </p>
          </div>
        </div>
      </div>

      {/* MODAL 1: Add / Edit Single Student Delivery Address */}
      {editingRecord && (
        <SingleDeliveryEditorModal
          course={course}
          currentUser={currentUser}
          initialRecord={editingRecord === 'new' ? undefined : editingRecord}
          sender={senderConfig}
          templateImg={templateImg}
          nextSuggestedRollNo={String(allCourseDeliveries.length + 1)}
          onClose={() => setEditingRecord(null)}
          onSaved={() => {
            setEditingRecord(null);
            setRefreshTick((t) => t + 1);
            onRefresh();
          }}
        />
      )}

      {/* MODAL 2: Bulk Paste / Quick Import Modal */}
      {showBulkPasteModal && (
        <BulkDeliveryImportModal
          course={course}
          currentUser={currentUser}
          startingRollNumber={allCourseDeliveries.length + 1}
          onClose={() => setShowBulkPasteModal(false)}
          onImported={() => {
            setShowBulkPasteModal(false);
            setRefreshTick((t) => t + 1);
            onRefresh();
          }}
        />
      )}

      {/* MODAL 3: Sender ("From") Settings Modal */}
      {showSenderSettingsModal && (
        <SenderConfigModal
          initialConfig={senderConfig}
          onClose={() => setShowSenderSettingsModal(false)}
          onSaved={() => {
            setShowSenderSettingsModal(false);
            setRefreshTick((t) => t + 1);
          }}
        />
      )}

      {/* MODAL 4: Delete Confirmation Modal */}
      {deleteConfirmRecord && (
        <div
          onClick={() => setDeleteConfirmRecord(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4"
          >
            <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
              လိပ်စာစာရင်း ဖျက်သိမ်းမည်လား?
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Roll No. ({deleteConfirmRecord.rollNo}) —{' '}
              <strong>{deleteConfirmRecord.studentName}</strong> ၏ စာအုပ်ပို့ရန် လိပ်စာကို ဖျက်သိမ်းပါမည်။
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmRecord(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                မဖျက်တော့ပါ
              </button>
              <button
                type="button"
                onClick={() => {
                  ClassroomDB.deleteBookDelivery(deleteConfirmRecord.id, currentUser);
                  setDeleteConfirmRecord(null);
                  setRefreshTick((t) => t + 1);
                  onRefresh();
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold cursor-pointer"
              >
                ဖျက်သိမ်းမည်
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ============================================================================
 * SUB-MODAL 1: Single Student Address Add / Edit Modal (with Enrolled Student Picker)
 * ============================================================================ */
const SingleDeliveryEditorModal: React.FC<{
  course: Course;
  currentUser: User;
  initialRecord?: BookDeliveryRecord;
  sender: BookDeliverySenderConfig;
  templateImg: HTMLImageElement | null;
  nextSuggestedRollNo: string;
  onClose: () => void;
  onSaved: () => void;
}> = ({
  course,
  currentUser,
  initialRecord,
  sender,
  templateImg,
  nextSuggestedRollNo,
  onClose,
  onSaved,
}) => {
  const enrolledStudents = useMemo(() => {
    const allUsers = ClassroomDB.getAllUsers();
    return allUsers.filter(
      (u) => u.role === 'student' && course.enrolledStudentIds.includes(u.id)
    );
  }, [course.enrolledStudentIds]);

  const [selectedStudentId, setSelectedStudentId] = useState(
    initialRecord?.studentId || ''
  );
  const [rollNo, setRollNo] = useState(initialRecord?.rollNo || nextSuggestedRollNo);
  const [studentName, setStudentName] = useState(initialRecord?.studentName || '');
  const [address, setAddress] = useState(initialRecord?.address || '');
  const [phone, setPhone] = useState(initialRecord?.phone || '');
  const [note, setNote] = useState(initialRecord?.note || '');
  const [status, setStatus] = useState<BookDeliveryStatus>(
    initialRecord?.status || 'pending'
  );

  const handleSelectEnrolledStudent = (stuId: string) => {
    setSelectedStudentId(stuId);
    const stu = enrolledStudents.find((s) => s.id === stuId);
    if (stu) {
      setStudentName(stu.name || '');
      if (stu.phone) setPhone(stu.phone);
      if (stu.address) setAddress(stu.address);
    }
  };

  const previewRec: BookDeliveryRecord = {
    id: initialRecord?.id || 'preview',
    courseId: course.id,
    studentId: selectedStudentId || 'preview',
    rollNo: rollNo.trim(),
    studentName: studentName.trim(),
    address: address.trim(),
    phone: phone.trim(),
    note: note.trim() || undefined,
    status,
    updatedByRole: currentUser.role,
    createdAt: 'ယခု',
    createdAtMs: Date.now(),
    updatedAtMs: Date.now(),
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim() || !address.trim()) return;
    ClassroomDB.saveBookDelivery(
      {
        id: initialRecord?.id,
        course,
        studentId: selectedStudentId || undefined,
        rollNo: rollNo.trim(),
        studentName: studentName.trim(),
        address: address.trim(),
        phone: phone.trim(),
        note: note.trim() || undefined,
        status,
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
        className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-4"
      >
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
            {initialRecord
              ? 'စာအုပ်ပို့ရန် လိပ်စာ ပြင်ဆင်ခြင်း (Edit Delivery Slip)'
              : 'စာအုပ်ပို့ရန် လိပ်စာအသစ် ထည့်သွင်းခြင်း (Add Delivery Slip)'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[85dvh] overflow-y-auto">
          {!initialRecord && enrolledStudents.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                အတန်းထဲရှိ ကျောင်းသားစာရင်းမှ အမြန်ရွေးရန် (Optional Auto-Fill)
              </label>
              <select
                value={selectedStudentId}
                onChange={(e) => handleSelectEnrolledStudent(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
              >
                <option value="">-- ကိုယ်တိုင် စာရိုက်ထည့်မည် (Manual Entry) --</option>
                {enrolledStudents.map((stu) => (
                  <option key={stu.id} value={stu.id}>
                    {stu.name} ({stu.phone || stu.username})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Roll No.
              </label>
              <input
                type="text"
                value={rollNo}
                onChange={(e) => setRollNo(e.target.value)}
                placeholder="ဥပမာ - 2"
                className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Name (ကျောင်းသားအမည်) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="အမည်အပြည့်အစုံ"
                className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Address (လိပ်စာအပြည့်အစုံ) <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={2}
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="အိမ်အမှတ်၊ လမ်း၊ ရပ်ကွက်၊ မြို့နယ် (သို့) ကားဂိတ်အမည်"
              className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Ph No. (ဖုန်းနံပါတ်)
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="09-XXXXXXXXX"
                className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                မှတ်ချက် (Optional)
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Royal Express / ကားဂိတ်"
                className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                စာအုပ် အခြေအနေ
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as BookDeliveryStatus)}
                className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
              >
                <option value="pending">📦 မပို့ရသေး (Pending)</option>
                <option value="printed">🖨️ PDF ထုတ်ပြီး (Printed)</option>
                <option value="shipped">🚚 ပို့ပြီး (Shipped)</option>
                <option value="received">✅ စာအုပ်ရရှိပြီး (Received)</option>
              </select>
            </div>
          </div>

          {/* Live Card Preview inside Editor */}
          <div className="space-y-1.5 pt-1">
            <span className="text-[11px] font-bold text-slate-500">
              လိပ်စာကတ် နမူနာ (Live Slip Preview)
            </span>
            <SingleSlipPreviewCanvas
              record={previewRec}
              sender={sender}
              templateImg={templateImg}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
            >
              ပယ်ဖျက်မည်
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold cursor-pointer"
            >
              သိမ်းဆည်းမည် (Save)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ============================================================================
 * SUB-MODAL 2: Bulk Paste / Quick Import Modal (Excel, Viber, Messenger Text)
 * ============================================================================ */
function parseBulkDeliveryText(
  rawText: string,
  startingRollNumber: number
): Array<{ rollNo: string; studentName: string; address: string; phone: string }> {
  const lines = (rawText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const results: Array<{ rollNo: string; studentName: string; address: string; phone: string }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const parts = line.includes('|')
      ? line.split('|').map((p) => p.trim())
      : line.includes('\t')
      ? line.split('\t').map((p) => p.trim())
      : line.split(/\s*[,;၊]\s*/).map((p) => p.trim());

    if (parts.length >= 4) {
      results.push({
        rollNo: parts[0] || String(startingRollNumber + results.length),
        studentName: parts[1] || '',
        address: parts.slice(2, parts.length - 1).join('၊ '),
        phone: parts[parts.length - 1] || '',
      });
    } else if (parts.length === 3) {
      if (/^\d{1,4}$/.test(parts[0])) {
        results.push({
          rollNo: parts[0],
          studentName: parts[1],
          address: parts[2],
          phone: '',
        });
      } else {
        results.push({
          rollNo: String(startingRollNumber + results.length),
          studentName: parts[0],
          address: parts[1],
          phone: parts[2],
        });
      }
    } else if (parts.length === 2) {
      results.push({
        rollNo: String(startingRollNumber + results.length),
        studentName: parts[0],
        address: parts[1],
        phone: '',
      });
    }
  }

  return results;
}

const BulkDeliveryImportModal: React.FC<{
  course: Course;
  currentUser: User;
  startingRollNumber: number;
  onClose: () => void;
  onImported: () => void;
}> = ({ course, currentUser, startingRollNumber, onClose, onImported }) => {
  const [rawText, setRawText] = useState('');

  const parsedEntries = useMemo(
    () => parseBulkDeliveryText(rawText, startingRollNumber),
    [rawText, startingRollNumber]
  );

  const handleImport = () => {
    if (parsedEntries.length === 0) return;
    ClassroomDB.bulkImportBookDeliveries(course, parsedEntries, currentUser);
    onImported();
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
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              ကျောင်းသား လိပ်စာအများကြီး တစ်ခါတည်း အမြန်သွင်းခြင်း (Bulk Quick Paste)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              တစ်ကြောင်းလျှင် ကျောင်းသား (၁) ဦးနှုန်းဖြင့် `Roll No | Name | Address | Ph No` ပုံစံ Paste ချနိုင်ပါသည်။
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[82dvh] overflow-y-auto">
          <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800/80 text-xs font-mono text-slate-600 dark:text-slate-300 space-y-1">
            <div className="font-bold text-slate-900 dark:text-white">နမူနာ ပုံစံ (Example Format):</div>
            <div>1 | မောင်အောင်အောင် | အမှတ် (၁၂)၊ ပြည်လမ်း၊ ကမာရွတ်မြို့နယ်၊ ရန်ကုန် | 09-123456789</div>
            <div>2 | မမြမြသွယ် | ၇၈ လမ်း၊ ချမ်းအေးသာစံမြို့နယ်၊ မန္တလေး | 09-987654321</div>
          </div>

          <textarea
            rows={7}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Excel သို့မဟုတ် Viber/Telegram မှ စာရင်းများကို ဤနေရာတွင် Paste ချပါ..."
            className="w-full p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />

          {parsedEntries.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400">
                ✅ အသင့်ဖတ်ယူပြီးသော ကျောင်းသား ({parsedEntries.length}) ဦး — (A4 Landscape စာမျက်နှာ{' '}
                {Math.ceil(parsedEntries.length / 4)} ရွက်စာ)
              </div>
              <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                {parsedEntries.map((item, i) => (
                  <div
                    key={i}
                    className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs flex flex-wrap items-center justify-between gap-2"
                  >
                    <div>
                      <span className="font-mono font-extrabold text-indigo-600 dark:text-indigo-400">
                        Roll ({item.rollNo})
                      </span>{' '}
                      <strong className="text-slate-900 dark:text-white">{item.studentName}</strong>{' '}
                      <span className="text-slate-600 dark:text-slate-300">— {item.address}</span>
                    </div>
                    <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                      {item.phone}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
            >
              ပယ်ဖျက်မည်
            </button>
            <button
              type="button"
              disabled={parsedEntries.length === 0}
              onClick={handleImport}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-extrabold cursor-pointer"
            >
              ကျောင်းသား ({parsedEntries.length}) ဦး ထည့်သွင်းမည်
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * SUB-MODAL 3: Sender ("From") Address & Phone Configuration Modal
 * ============================================================================ */
const SenderConfigModal: React.FC<{
  initialConfig: BookDeliverySenderConfig;
  onClose: () => void;
  onSaved: () => void;
}> = ({ initialConfig, onClose, onSaved }) => {
  const [academyName, setAcademyName] = useState(initialConfig.academyName);
  const [addressText, setAddressText] = useState(initialConfig.addressLines.join('\n'));
  const [phones, setPhones] = useState(initialConfig.phones);

  const handleResetDefault = () => {
    const def = ClassroomDB.getDefaultBookDeliverySenderConfig();
    setAcademyName(def.academyName);
    setAddressText(def.addressLines.join('\n'));
    setPhones(def.phones);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    ClassroomDB.saveBookDeliverySenderConfig({
      academyName,
      addressLines: addressText.split(/\r?\n/),
      phones,
    });
    onSaved();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
            ပေးပို့သူ (From) ကျောင်းလိပ်စာနှင့် ဖုန်းနံပါတ် ပြင်ဆင်ရန်
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              သင်တန်းကျောင်း အမည် (Academy Name)
            </label>
            <input
              type="text"
              value={academyName}
              onChange={(e) => setAcademyName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              From လိပ်စာ (စာကြောင်း ၃ ကြောင်းအထိ)
            </label>
            <textarea
              rows={3}
              value={addressText}
              onChange={(e) => setAddressText(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              ဆက်သွယ်ရန် ဖုန်းနံပါတ်များ
            </label>
            <input
              type="text"
              value={phones}
              onChange={(e) => setPhones(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleResetDefault}
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
            >
              မူလ SwanArh Academy လိပ်စာအတိုင်း ပြန်ထားမည်
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                ပိတ်မည်
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold cursor-pointer"
              >
                သိမ်းဆည်းမည်
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
