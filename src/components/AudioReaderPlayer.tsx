import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Volume2,
  Play,
  Pause,
  Square,
  SkipBack,
  SkipForward,
  Gauge,
  Sparkles,
  X,
} from 'lucide-react';

interface AudioReaderPlayerProps {
  title?: string;
  rawTextOrHtml: string;
  compact?: boolean;
  className?: string;
}

/**
 * Strips HTML tags and splits long text (Myanmar & English) into natural readable sentence chunks
 * so Web Speech API never cuts off long notes after 15 seconds.
 */
function extractReadableSentences(rawTextOrHtml: string): string[] {
  if (!rawTextOrHtml) return [];

  // Replace block-level HTML tags with sentence breaks before stripping tags
  const withBreaks = rawTextOrHtml
    .replace(/<(br|hr)\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr|blockquote)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");

  // Split by Myanmar full stop (။), Myanmar comma pause (၊) when sentence is very long, English (. ! ?), or newlines
  const rawSegments = withBreaks
    .split(/(?<=[။.!?])\s+|\n+/g)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.length > 0);

  const chunks: string[] = [];
  for (const seg of rawSegments) {
    if (seg.length <= 220) {
      chunks.push(seg);
    } else {
      // Further split very long sentences by Myanmar/English commas so TTS never stalls
      const subParts = seg
        .split(/(?<=[၊,;:])\s+/g)
        .map((p) => p.trim())
        .filter(Boolean);
      let buffer = '';
      for (const part of subParts) {
        if ((buffer + ' ' + part).trim().length <= 200) {
          buffer = (buffer ? buffer + ' ' : '') + part;
        } else {
          if (buffer) chunks.push(buffer);
          if (part.length <= 220) {
            buffer = part;
          } else {
            // Hard chunk at word boundaries
            let start = 0;
            while (start < part.length) {
              chunks.push(part.slice(start, start + 200).trim());
              start += 200;
            }
            buffer = '';
          }
        }
      }
      if (buffer) chunks.push(buffer);
    }
  }

  return chunks;
}

function hasMyanmarCharacters(text: string): boolean {
  return /[\u1000-\u109F\uAA60-\uAA7F]/.test(text);
}

const SPEED_OPTIONS = [0.85, 1, 1.25, 1.5];

export const AudioReaderPlayer: React.FC<AudioReaderPlayerProps> = ({
  title,
  rawTextOrHtml,
  compact = false,
  className = '',
}) => {
  const sentences = useMemo(() => {
    const bodySentences = extractReadableSentences(rawTextOrHtml);
    if (title && title.trim()) {
      const cleanTitle = title.replace(/\s+/g, ' ').trim();
      if (bodySentences[0] !== cleanTitle) {
        return [cleanTitle, ...bodySentences];
      }
    }
    return bodySentences;
  }, [title, rawTextOrHtml]);

  const [isExpanded, setIsExpanded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const isPlayingRef = useRef(false);
  const currentIndexRef = useRef(0);
  const playbackRateRef = useRef(1);
  const fallbackAudioRef = useRef<HTMLAudioElement | null>(null);
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  currentIndexRef.current = currentIndex;
  playbackRateRef.current = playbackRate;

  const stopAllAudio = useCallback(() => {
    isPlayingRef.current = false;
    setIsPlaying(false);
    setIsPaused(false);
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    } catch {
      // ignore
    }
    if (fallbackAudioRef.current) {
      try {
        fallbackAudioRef.current.pause();
        fallbackAudioRef.current.src = '';
      } catch {
        // ignore
      }
      fallbackAudioRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopAllAudio();
    };
  }, [stopAllAudio]);

  // Reset when underlying content changes
  useEffect(() => {
    stopAllAudio();
    setCurrentIndex(0);
  }, [rawTextOrHtml, stopAllAudio]);

  const speakSentenceAtIndex = useCallback(
    (index: number) => {
      if (index < 0 || index >= sentences.length) {
        stopAllAudio();
        setCurrentIndex(0);
        return;
      }

      const text = sentences[index];
      setCurrentIndex(index);
      currentIndexRef.current = index;
      isPlayingRef.current = true;
      setIsPlaying(true);
      setIsPaused(false);
      setStatusMessage(null);

      // Clean up any existing audio
      try {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          window.speechSynthesis.cancel();
        }
      } catch {
        // ignore
      }
      if (fallbackAudioRef.current) {
        try {
          fallbackAudioRef.current.pause();
        } catch {
          // ignore
        }
        fallbackAudioRef.current = null;
      }

      const isMm = hasMyanmarCharacters(text);
      const synthAvailable =
        typeof window !== 'undefined' &&
        'speechSynthesis' in window &&
        typeof SpeechSynthesisUtterance !== 'undefined';

      const advanceToNext = () => {
        if (!isPlayingRef.current) return;
        const nextIdx = currentIndexRef.current + 1;
        if (nextIdx < sentences.length) {
          speakSentenceAtIndex(nextIdx);
        } else {
          stopAllAudio();
          setCurrentIndex(0);
        }
      };

      if (synthAvailable) {
        const voices = window.speechSynthesis.getVoices();
        const mmVoice = voices.find(
          (v) =>
            v.lang.toLowerCase().includes('my') ||
            v.name.toLowerCase().includes('myanmar') ||
            v.name.toLowerCase().includes('burmese')
        );
        const enVoice =
          voices.find(
            (v) =>
              v.lang.toLowerCase().startsWith('en-gb') ||
              v.lang.toLowerCase().startsWith('en-us')
          ) || voices.find((v) => v.lang.toLowerCase().startsWith('en'));

        // If text is English OR device has a native Myanmar voice, use Web Speech API directly
        if (!isMm || mmVoice) {
          try {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = playbackRateRef.current;
            utterance.pitch = 1;
            if (isMm && mmVoice) {
              utterance.voice = mmVoice;
              utterance.lang = mmVoice.lang || 'my-MM';
            } else if (!isMm && enVoice) {
              utterance.voice = enVoice;
              utterance.lang = enVoice.lang || 'en-US';
            } else {
              utterance.lang = isMm ? 'my-MM' : 'en-US';
            }

            utterance.onend = () => {
              advanceToNext();
            };
            utterance.onerror = () => {
              if (!isPlayingRef.current) return;
              advanceToNext();
            };

            activeUtteranceRef.current = utterance;
            window.speechSynthesis.speak(utterance);
            return;
          } catch {
            // Fall through to universal fallback
          }
        }

        // Universal Web Speech attempt even without explicit my-MM voice listing (many Android/Windows devices route my-MM automatically)
        try {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = isMm ? 'my-MM' : 'en-US';
          utterance.rate = playbackRateRef.current;
          utterance.onend = () => {
            advanceToNext();
          };
          utterance.onerror = () => {
            if (!isPlayingRef.current) return;
            advanceToNext();
          };
          activeUtteranceRef.current = utterance;
          window.speechSynthesis.speak(utterance);
          return;
        } catch {
          // ignore
        }
      }

      setStatusMessage('သင့် Browser တွင် အသံထွက်စနစ် (Web Speech TTS) မပံ့ပိုးပါ။');
      stopAllAudio();
    },
    [sentences, stopAllAudio]
  );

  const handleTogglePlayPause = () => {
    if (!isExpanded) {
      setIsExpanded(true);
    }

    if (isPlaying && !isPaused) {
      // Pause
      setIsPaused(true);
      isPlayingRef.current = false;
      try {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          window.speechSynthesis.pause();
        }
      } catch {
        // ignore
      }
      if (fallbackAudioRef.current) {
        fallbackAudioRef.current.pause();
      }
      return;
    }

    if (isPlaying && isPaused) {
      // Resume
      setIsPaused(false);
      isPlayingRef.current = true;
      try {
        if (
          typeof window !== 'undefined' &&
          'speechSynthesis' in window &&
          window.speechSynthesis.paused
        ) {
          window.speechSynthesis.resume();
          return;
        }
      } catch {
        // ignore
      }
      speakSentenceAtIndex(currentIndex);
      return;
    }

    // Start from currentIndex
    speakSentenceAtIndex(currentIndex);
  };

  const handlePrevSentence = () => {
    const prev = Math.max(0, currentIndex - 1);
    setCurrentIndex(prev);
    if (isPlaying) {
      speakSentenceAtIndex(prev);
    }
  };

  const handleNextSentence = () => {
    const next = Math.min(sentences.length - 1, currentIndex + 1);
    setCurrentIndex(next);
    if (isPlaying) {
      speakSentenceAtIndex(next);
    }
  };

  const handleCycleSpeed = () => {
    const nextIdx = (SPEED_OPTIONS.indexOf(playbackRate) + 1) % SPEED_OPTIONS.length;
    const nextSpeed = SPEED_OPTIONS[nextIdx];
    setPlaybackRate(nextSpeed);
    playbackRateRef.current = nextSpeed;
    if (isPlaying && !isPaused) {
      speakSentenceAtIndex(currentIndex);
    }
  };

  if (sentences.length === 0) return null;

  const progressPercent =
    sentences.length > 0
      ? Math.min(100, Math.round(((currentIndex + 1) / sentences.length) * 100))
      : 0;

  if (!isExpanded) {
    return (
      <button
        type="button"
        onClick={() => {
          setIsExpanded(true);
          speakSentenceAtIndex(0);
        }}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600/12 via-purple-600/12 to-amber-500/12 hover:from-indigo-600 hover:to-purple-600 text-indigo-700 dark:text-indigo-300 hover:text-white border border-indigo-500/25 text-xs font-extrabold transition-all cursor-pointer shadow-2xs ${className}`}
        title="စာပိုဒ်ကို အသံထွက်ဖတ်ပြစနစ်ဖြင့် နားထောင်ရန် (Audio Reader)"
      >
        <Volume2 className="w-3.5 h-3.5 shrink-0" />
        <span>{compact ? 'အသံဖြင့် နားထောင်မည်' : '🔊 အသံဖြင့် နားထောင်မည် (Audio Reader)'}</span>
      </button>
    );
  }

  return (
    <div
      className={`rounded-2xl p-3 sm:p-3.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white border border-indigo-500/35 shadow-lg animate-fade-in ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/25 border border-indigo-400/40 flex items-center justify-center text-amber-300 shrink-0">
            <Volume2 className={`w-4 h-4 ${isPlaying && !isPaused ? 'animate-pulse' : ''}`} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-extrabold tracking-wide text-amber-300 uppercase flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Smart Audio Reader
              </span>
              <span className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-mono font-bold text-indigo-200">
                ဝါကျ {currentIndex + 1} / {sentences.length}
              </span>
            </div>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handlePrevSentence}
            disabled={currentIndex <= 0}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-35 text-white transition-colors cursor-pointer"
            title="ရှေ့ဝါကျသို့ (Previous Sentence)"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleTogglePlayPause}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 text-xs font-extrabold flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            {isPlaying && !isPaused ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>ခေတ္တရပ်</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{isPaused ? 'ဆက်ဖတ်မည်' : 'ဖတ်ပြမည်'}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleNextSentence}
            disabled={currentIndex >= sentences.length - 1}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-35 text-white transition-colors cursor-pointer"
            title="နောက်ဝါကျသို့ (Next Sentence)"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => {
              stopAllAudio();
              setCurrentIndex(0);
            }}
            className="p-1.5 rounded-lg bg-rose-500/25 hover:bg-rose-500/40 text-rose-200 border border-rose-400/30 transition-colors cursor-pointer"
            title="အသံရပ်မည် (Stop)"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
          </button>

          <button
            type="button"
            onClick={handleCycleSpeed}
            className="px-2 py-1 rounded-lg bg-indigo-500/30 hover:bg-indigo-500/45 border border-indigo-400/30 text-[11px] font-mono font-extrabold text-amber-200 flex items-center gap-1 cursor-pointer"
            title="ဖတ်ပြသည့် အမြန်နှုန်း ပြောင်းရန် (Playback Speed)"
          >
            <Gauge className="w-3 h-3" />
            <span>{playbackRate}x</span>
          </button>

          <button
            type="button"
            onClick={() => {
              stopAllAudio();
              setIsExpanded(false);
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="ပိတ်မည်"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden mb-2">
        <div
          className="h-full bg-gradient-to-r from-amber-400 via-indigo-400 to-emerald-400 transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Active Sentence Live Caption */}
      <div className="px-2.5 py-1.5 rounded-xl bg-black/30 border border-white/10 text-xs text-slate-200 leading-relaxed line-clamp-2">
        <span className="text-amber-300 font-bold mr-1.5">▸ ယခုဖတ်နေသည့်စာကြောင်း:</span>
        {sentences[currentIndex]}
      </div>

      {statusMessage && (
        <p className="mt-1.5 text-[11px] text-rose-300 font-semibold">{statusMessage}</p>
      )}
    </div>
  );
};
