import React from 'react';
import { Wifi, WifiOff, Smartphone, Shield, Zap } from 'lucide-react';

interface LowBandwidthBarProps {
  isLowBandwidth: boolean;
  onToggle: () => void;
}

export const LowBandwidthBar: React.FC<LowBandwidthBarProps> = ({ isLowBandwidth, onToggle }) => {
  return (
    <div className="bg-slate-900 text-white text-xs py-2 px-4 border-b border-slate-800">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {isLowBandwidth ? (
            <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
          ) : (
            <Wifi className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <span className="text-[11px] sm:text-xs">
            {isLowBandwidth ? (
              <span className="text-amber-300 font-medium">
                Low-Bandwidth Mode Active · 3G/Edge Optimized (Media preloads paused, ~70% data saved)
              </span>
            ) : (
              <span className="text-slate-300">
                Standard Bandwidth · HD Streams & Adaptive Bitrate Ready
              </span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onToggle}
            className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
              isLowBandwidth
                ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
            }`}
          >
            {isLowBandwidth ? 'Disable Data Saver' : 'Enable Data Saver'}
          </button>
        </div>
      </div>
    </div>
  );
};
