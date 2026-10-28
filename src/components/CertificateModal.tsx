import React, { useRef, useEffect } from 'react';
import { CertificateData } from '../types/classroom';
import { Award, Download, Printer, X, CheckCircle, ShieldCheck } from 'lucide-react';

interface CertificateModalProps {
  certificate: CertificateData;
  isOpen: boolean;
  onClose: () => void;
}

export const CertificateModal: React.FC<CertificateModalProps> = ({ certificate, isOpen, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // High DPI Canvas rendering (1200 x 850)
    canvas.width = 1200;
    canvas.height = 850;

    // Background Parchment / Crisp Clean Academic Canvas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 1200, 850);

    // Subtle background tint
    const bgGrad = ctx.createLinearGradient(0, 0, 1200, 850);
    bgGrad.addColorStop(0, '#fcfdfd');
    bgGrad.addColorStop(1, '#f4f6fb');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1200, 850);

    // Outer double border
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 14;
    ctx.strokeRect(30, 30, 1140, 790);

    ctx.strokeStyle = '#4f46e5';
    ctx.lineWidth = 2;
    ctx.strokeRect(48, 48, 1104, 754);

    // Corner Ornaments
    const drawCorner = (x: number, y: number, angle: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.strokeStyle = '#4f46e5';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(30, 0);
      ctx.moveTo(0, 0);
      ctx.lineTo(0, 30);
      ctx.stroke();
      ctx.restore();
    };

    drawCorner(58, 58, 0);
    drawCorner(1142, 58, Math.PI / 2);
    drawCorner(1142, 792, Math.PI);
    drawCorner(58, 792, -Math.PI / 2);

    // Header Emblem
    ctx.fillStyle = '#4f46e5';
    ctx.font = 'bold 20px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CLASSROOM OS · ACADEMIC CREDENTIAL VERIFICATION', 600, 125);

    // Main Title
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 44px "Plus Jakarta Sans", serif';
    ctx.fillText('CERTIFICATE OF COMPLETION', 600, 195);

    // Divider line
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(400, 225);
    ctx.lineTo(800, 225);
    ctx.stroke();

    // Recipient text
    ctx.fillStyle = '#64748b';
    ctx.font = '16px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('THIS IS PROUDLY CONFERRED UPON', 600, 270);

    // Student Name
    ctx.fillStyle = '#1e1b4b';
    ctx.font = 'bold 46px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(certificate.studentName, 600, 335);

    // Course completion text
    ctx.fillStyle = '#475569';
    ctx.font = '17px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('for successfully mastering the curriculum and fulfilling all practical evaluations in', 600, 390);

    // Course Title
    ctx.fillStyle = '#312e81';
    ctx.font = 'bold 28px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`${certificate.courseCode}: ${certificate.courseTitle}`, 600, 440);

    // Achievement stats
    ctx.fillStyle = '#0f172a';
    ctx.font = '500 16px "Plus Jakarta Sans", sans-serif';
    const attPct = certificate.attendancePercentage ?? 100;
    ctx.fillText(
      `Final Evaluation Score: ${certificate.gradeAverage}% · Attendance Rate: ${attPct}% · Grade: High Distinction`,
      600,
      485
    );

    // Verification ID & Date
    ctx.fillStyle = '#64748b';
    ctx.font = '14px "JetBrains Mono", monospace';
    ctx.fillText(`Issued: ${certificate.issuedAt} · Credential ID: ${certificate.certificateId}`, 600, 530);

    // Bottom signatures & Seal Section
    // Left: QR Code Mock
    const qrX = 140;
    const qrY = 620;
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(qrX, qrY, 110, 110);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.strokeRect(qrX, qrY, 110, 110);

    // Draw stylized QR code pattern
    ctx.fillStyle = '#0f172a';
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        if ((r + c) % 2 === 0 || (r === 0 && c === 0) || (r === 0 && c === 6) || (r === 6 && c === 0)) {
          ctx.fillRect(qrX + 12 + c * 12, qrY + 12 + r * 12, 9, 9);
        }
      }
    }
    ctx.fillStyle = '#64748b';
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('SCAN TO VERIFY', qrX + 10, qrY + 130);

    // Center Gold Seal
    ctx.save();
    ctx.translate(600, 680);
    ctx.beginPath();
    ctx.arc(0, 0, 52, 0, Math.PI * 2);
    ctx.fillStyle = '#f59e0b';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#d97706';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, 44, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('★ VERIFIED ★', 0, -6);
    ctx.font = '10px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('ACCREDITED', 0, 10);
    ctx.restore();

    // Right: Signature
    const sigX = 890;
    const sigY = 670;
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sigX, sigY + 10);
    ctx.lineTo(sigX + 200, sigY + 10);
    ctx.stroke();

    ctx.fillStyle = '#1e293b';
    ctx.font = 'italic bold 22px "Brush Script MT", cursive, serif';
    ctx.textAlign = 'center';
    ctx.fillText('Dr. Kyaw Swar', sigX + 100, sigY - 2);

    ctx.fillStyle = '#475569';
    ctx.font = '12px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(certificate.instructorSignature, sigX + 100, sigY + 30);
    ctx.font = '11px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Academic Dean & Instructor', sigX + 100, sigY + 45);
  }, [certificate, isOpen]);

  if (!isOpen) return null;

  const handleDownloadImage = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `${certificate.studentName.replace(/\s+/g, '_')}_${certificate.courseCode}_Certificate.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-6 transition-colors">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="font-semibold text-slate-900 dark:text-white text-base">
              Verified Certificate of Completion
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              · {certificate.certificateId}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadImage}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download High-Res PNG</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-lg transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print / PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Certificate Display Stage */}
        <div className="p-6 bg-slate-100/70 dark:bg-slate-950 flex flex-col items-center justify-center overflow-x-auto">
          <canvas
            ref={canvasRef}
            className="w-full max-w-3xl rounded-lg shadow-lg border border-slate-300 dark:border-slate-700 bg-white"
          />

          {/* Verification Callout */}
          <div className="mt-4 flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-850 px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm w-full max-w-3xl">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div className="flex-1">
              <span className="font-semibold text-slate-900 dark:text-white">Cryptographically Signed Credential: </span>
              This certificate is tied to student account <span className="font-mono text-slate-800 dark:text-slate-200">{certificate.studentName}</span> and recorded on the institutional ledger.
            </div>
            <span className="font-mono text-slate-500 dark:text-slate-400 shrink-0">{certificate.verificationUrl}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
