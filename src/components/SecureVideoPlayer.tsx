import React, { useState, useEffect, useRef } from 'react';
import { User, VideoAsset } from '../types/classroom';
import { Play, Pause, Volume2, VolumeX, Maximize, Shield, Wifi, AlertCircle, RefreshCw } from 'lucide-react';

interface SecureVideoPlayerProps {
  video: VideoAsset;
  currentUser: User;
  onCompleted?: () => void;
  textProtectionEnabled?: boolean;
}

export const SecureVideoPlayer: React.FC<SecureVideoPlayerProps> = ({
  video,
  currentUser,
  onCompleted,
  textProtectionEnabled = true,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(180); // 3 min simulation for lecture preview
  const [isMuted, setIsMuted] = useState(false);
  const [resolution, setResolution] = useState<'360p' | '720p' | '1080p Auto'>('720p');
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [watermarkPos, setWatermarkPos] = useState({ top: 20, left: 30 });
  const [showTokenDetails, setShowTokenDetails] = useState(false);
  const [securityAlert, setSecurityAlert] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const simulatedTimerRef = useRef<any>(null);

  // Dynamic Forensic Watermark random jitter every 4.5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const randomTop = Math.floor(15 + Math.random() * 65);
      const randomLeft = Math.floor(10 + Math.random() * 65);
      setWatermarkPos({ top: randomTop, left: randomLeft });
    }, 4500);

    return () => clearInterval(interval);
  }, []);

  // Video playback timer
  useEffect(() => {
    if (isPlaying) {
      simulatedTimerRef.current = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= duration) {
            setIsPlaying(false);
            if (onCompleted) onCompleted();
            return duration;
          }
          return prev + 1;
        });
      }, 1000 / playbackSpeed);
    } else {
      clearInterval(simulatedTimerRef.current);
    }

    return () => clearInterval(simulatedTimerRef.current);
  }, [isPlaying, duration, playbackSpeed, onCompleted]);

  // Anti-Inspection & Right-Click Prevention on Player Container
  const handleContextMenu = (e: React.MouseEvent) => {
    if (textProtectionEnabled) {
      e.preventDefault();
      setSecurityAlert('Right-click inspect is disabled by Academic Content Protection policy.');
      setTimeout(() => setSecurityAlert(null), 3500);
    }
  };

  const handleTogglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentTime(Number(e.target.value));
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  return (
    <div
      ref={containerRef}
      onContextMenu={handleContextMenu}
      className={`relative w-full overflow-hidden rounded-xl bg-slate-950 border border-slate-800 shadow-xl select-none`}
    >
      {/* Security alert toast */}
      {securityAlert && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-3.5 py-2 bg-rose-950/90 border border-rose-800 text-rose-200 text-xs rounded-lg shadow-lg backdrop-blur-md">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{securityAlert}</span>
        </div>
      )}

      {/* Main Video Viewport Canvas */}
      <div className="relative aspect-video w-full flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-hidden">
        {/* Background Lecture Poster */}
        <img
          src={video.thumbnailUrl}
          alt={video.title}
          referrerPolicy="no-referrer"
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
            isPlaying ? 'opacity-30 blur-[2px]' : 'opacity-70'
          }`}
        />

        {/* Ambient Dark Gradient Scrim */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-slate-950/60" />

        {/* Anti-Piracy Watermark: Displays logged-in student info */}
        {video.allowDynamicWatermark && (
          <div
            style={{
              top: `${watermarkPos.top}%`,
              left: `${watermarkPos.left}%`,
            }}
            className="pointer-events-none absolute z-20 transition-all duration-1000 ease-in-out"
          >
            <div className="flex flex-col text-[11px] font-mono tracking-wider text-white/25 select-none bg-black/15 px-2.5 py-1 rounded border border-white/5 backdrop-blur-[1px]">
              <span className="font-semibold text-white/35">
                {currentUser.name} · {currentUser.username}
              </span>
              <span>ID: {currentUser.id.slice(0, 12)} · {currentUser.phone}</span>
              <span className="text-[9px] text-white/20">
                HOST: {window.location.hostname} · {new Date().toLocaleTimeString()}
              </span>
            </div>
          </div>
        )}

        {/* Center Play Overlay Trigger */}
        {!isPlaying && (
          <button
            onClick={handleTogglePlay}
            className="group relative z-30 flex items-center justify-center w-16 h-16 rounded-full bg-indigo-600/90 text-white shadow-2xl hover:scale-105 hover:bg-indigo-500 transition-all cursor-pointer"
            aria-label="Play secure video"
          >
            <Play className="w-7 h-7 ml-1 fill-white" />
          </button>
        )}

        {/* Active Playback Graphic State */}
        {isPlaying && (
          <div className="relative z-10 text-center px-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-900/80 border border-slate-700/60 rounded-full text-xs text-indigo-300 font-mono mb-3">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>HLS Secure Stream Active</span>
              <span className="text-slate-400">· {resolution}</span>
            </div>
            <h4 className="text-sm md:text-base font-semibold text-slate-200 max-w-md mx-auto line-clamp-1">
              {video.title}
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              Encrypted chunk delivery authenticated for {currentUser.name}
            </p>
          </div>
        )}

        {/* Top Badges: Security Protection Specs */}
        <div className="absolute top-3 left-3 z-30 flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900/80 border border-slate-700/70 rounded text-[11px] font-medium text-slate-300 backdrop-blur-sm">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>Anti-Piracy DRM</span>
          </div>
          <button
            onClick={() => setShowTokenDetails(!showTokenDetails)}
            className="px-2 py-1 bg-slate-900/80 hover:bg-slate-800 border border-slate-700/70 rounded text-[11px] font-mono text-slate-400 hover:text-slate-200 backdrop-blur-sm cursor-pointer transition-colors"
          >
            {showTokenDetails ? 'Hide Token' : 'Verify DRM'}
          </button>
        </div>

        {/* Token Inspection Drawer */}
        {showTokenDetails && (
          <div className="absolute top-12 left-3 right-3 z-30 p-3 bg-slate-950/95 border border-indigo-500/40 rounded-lg text-xs font-mono text-slate-300 shadow-2xl backdrop-blur-md">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-indigo-400 font-semibold">
              <span>Token-Authenticated HLS Pipeline Security</span>
              <span className="text-[10px] text-emerald-400 font-normal">Signed & Bound</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 text-[11px] text-slate-400">
              <div>
                <span className="text-slate-500">Provider:</span> {video.provider} (Domain Locked)
              </div>
              <div>
                <span className="text-slate-500">Authorized Domain:</span> {window.location.hostname}
              </div>
              <div className="truncate">
                <span className="text-slate-500">Obfuscated Stream:</span> {video.hlsStreamProxy}
              </div>
              <div>
                <span className="text-slate-500">Watermark Signature:</span> SHA256({currentUser.id}:
                {currentUser.phone})
              </div>
            </div>
            <p className="mt-2 text-[10px] text-slate-500">
              * Direct MP4 downloads are blocked. Requests from external referrers or unauthenticated browser sessions receive HTTP 403 Forbidden.
            </p>
          </div>
        )}
      </div>

      {/* Video Control Bar */}
      <div className="p-3 bg-slate-900 border-t border-slate-800 text-slate-300 flex flex-col gap-2">
        {/* Progress Timeline Slider */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono tabular-nums text-slate-400 w-10 text-right">
            {formatTime(currentTime)}
          </span>
          <div className="relative flex-1 flex items-center">
            <input
              type="range"
              min={0}
              max={duration}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              aria-label="Seek video"
            />
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-400 w-10">
            {formatTime(duration)}
          </span>
        </div>

        {/* Controls Row */}
        <div className="flex items-center justify-between text-xs pt-1">
          <div className="flex items-center gap-2">
            <button
              onClick={handleTogglePlay}
              className="p-1.5 rounded hover:bg-slate-800 text-slate-200 transition-colors cursor-pointer"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>

            <button
              onClick={() => setIsMuted(!isMuted)}
              className="p-1.5 rounded hover:bg-slate-800 text-slate-200 transition-colors cursor-pointer"
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <span className="hidden sm:inline-block text-slate-400 text-[11px] font-medium border-l border-slate-700 pl-2">
              {video.title}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Speed selector */}
            <select
              value={playbackSpeed}
              onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
              className="bg-slate-800 border border-slate-700 text-slate-300 rounded px-2 py-0.5 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value={0.75}>0.75x</option>
              <option value={1}>1.0x</option>
              <option value={1.25}>1.25x</option>
              <option value={1.5}>1.5x</option>
              <option value={2}>2.0x</option>
            </select>

            {/* Resolution selector for low-bandwidth optimization */}
            <select
              value={resolution}
              onChange={(e) => setResolution(e.target.value as any)}
              className="bg-slate-800 border border-slate-700 text-slate-300 rounded px-2 py-0.5 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="360p">360p (Data Saver)</option>
              <option value="720p">720p HD</option>
              <option value="1080p Auto">1080p Auto</option>
            </select>

            <button
              onClick={toggleFullscreen}
              className="p-1.5 rounded hover:bg-slate-800 text-slate-200 transition-colors cursor-pointer"
              aria-label="Fullscreen"
            >
              <Maximize className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
