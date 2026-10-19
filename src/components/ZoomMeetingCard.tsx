import React, { useState } from 'react';
import { ZoomMeetingDetails, User } from '../types/classroom';
import { openZoomMeeting, parseZoomUrl } from '../utils/zoomDeepLink';
import { Video, Copy, Check, ExternalLink, Laptop, AlertCircle, Sparkles } from 'lucide-react';

interface ZoomMeetingCardProps {
  meeting: ZoomMeetingDetails;
  currentUser: User;
}

export const ZoomMeetingCard: React.FC<ZoomMeetingCardProps> = ({ meeting, currentUser }) => {
  const [copiedPasscode, setCopiedPasscode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [launchStatus, setLaunchStatus] = useState<'idle' | 'launching' | 'fallback'>('idle');

  // Parse dynamically with student name pre-filled
  const parsed = parseZoomUrl(meeting.rawUrl, currentUser.name);

  const handleLaunchNativeZoom = () => {
    openZoomMeeting(parsed, (status) => {
      setLaunchStatus(status);
    });
  };

  const handleCopyPasscode = () => {
    if (meeting.passcode) {
      navigator.clipboard.writeText(meeting.passcode);
      setCopiedPasscode(true);
      setTimeout(() => setCopiedPasscode(false), 2500);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(meeting.rawUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const formatMeetingId = (id: string) => {
    // Format: 849 2019 3847
    if (id.length === 11) {
      return `${id.slice(0, 3)} ${id.slice(3, 7)} ${id.slice(7)}`;
    } else if (id.length === 10) {
      return `${id.slice(0, 3)} ${id.slice(3, 6)} ${id.slice(6)}`;
    }
    return id;
  };

  return (
    <div className="rounded-xl border border-blue-200 dark:border-blue-900/60 bg-gradient-to-br from-blue-50/80 via-white to-sky-50/50 dark:from-slate-900 dark:via-slate-900 dark:to-blue-950/40 p-4 sm:p-5 shadow-xs space-y-3.5 my-3 transition-colors">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-blue-100 dark:border-blue-900/40">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <Video className="w-5 h-5 fill-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-blue-900 dark:text-blue-300 uppercase tracking-wide">
                Live Zoom Classroom Session
              </span>
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 text-[10px] font-bold border border-rose-200/50 dark:border-rose-900/40">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                LIVE
              </span>
            </div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white line-clamp-1">
              {meeting.topic || 'Online Interactive Live Lecture & Q&A'}
            </h4>
          </div>
        </div>

        {meeting.scheduledTime && (
          <span className="text-xs font-mono font-medium text-blue-800 dark:text-blue-300 bg-blue-100/70 dark:bg-blue-950/70 px-2.5 py-1 rounded-lg shrink-0 border border-blue-200/40 dark:border-blue-800/40">
            ⏰ {meeting.scheduledTime}
          </span>
        )}
      </div>

      {/* Meeting Credentials Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        <div className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-blue-100 dark:border-slate-700">
          <span className="text-slate-500 dark:text-slate-400 font-medium">Meeting ID:</span>
          <span className="font-mono font-bold text-slate-900 dark:text-white tracking-wider">
            {formatMeetingId(meeting.meetingId)}
          </span>
        </div>

        {meeting.passcode && (
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-blue-100 dark:border-slate-700">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Passcode:</span>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-slate-900 dark:text-white">{meeting.passcode}</span>
              <button
                type="button"
                onClick={handleCopyPasscode}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-[11px] flex items-center gap-0.5 cursor-pointer"
                title="Copy passcode"
              >
                {copiedPasscode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedPasscode ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Deep Link Launch Guidance / Status */}
      {launchStatus === 'launching' && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-blue-100/70 dark:bg-blue-950/60 border border-blue-300 dark:border-blue-800 text-blue-900 dark:text-blue-200 text-xs">
          <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div className="leading-snug">
            Invoking <strong>zoomus://</strong> URI scheme... Zoom Native App is opening with your attendance name (<span className="font-semibold">{currentUser.name}</span>).
          </div>
        </div>
      )}

      {launchStatus === 'fallback' && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200 text-xs">
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="leading-snug">
            Zoom App not installed or did not open?{' '}
            <a
              href={parsed.browserFallbackUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold underline text-blue-700 dark:text-blue-400 hover:text-blue-900"
            >
              Click here to join directly via Web Browser
            </a>
            .
          </div>
        </div>
      )}

      {/* Action Buttons Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        {/* Primary 1-Click Launch Zoom App Button */}
        <button
          type="button"
          onClick={handleLaunchNativeZoom}
          className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
        >
          <Laptop className="w-4 h-4" />
          <span>Launch in Zoom App (zoomus://)</span>
        </button>

        {/* Secondary Browser Fallback */}
        <div className="flex items-center gap-2 text-xs">
          <a
            href={parsed.browserFallbackUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-medium rounded-xl transition-colors cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span>Join via Browser</span>
          </a>

          <button
            type="button"
            onClick={handleCopyLink}
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            title="Copy meeting link"
            aria-label="Copy invitation"
          >
            {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Technical Protocol Footer Tag */}
      <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 font-mono pt-1">
        <span>Protocol: zoomus://zoom.us/join?confno={parsed.meetingId}</span>
        <span className="hidden sm:inline">Pre-fill: {currentUser.name}</span>
      </div>
    </div>
  );
};
