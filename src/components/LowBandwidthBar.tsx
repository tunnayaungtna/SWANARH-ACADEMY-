import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, Check, Sparkles, RotateCcw } from 'lucide-react';
import {
  performQuickUpdateAndSync,
  performFullAppVersionUpdate,
  APP_VERSION_LABEL,
} from '../utils/appUpdater';

interface LowBandwidthBarProps {
  isLowBandwidth: boolean;
  onToggle: () => void;
  onRefreshData?: () => void;
}

export const LowBandwidthBar: React.FC<LowBandwidthBarProps> = ({
  isLowBandwidth,
  onToggle,
  onRefreshData,
}) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateDone, setUpdateDone] = useState(false);
  const [hasNewSwVersion, setHasNewSwVersion] = useState(false);

  useEffect(() => {
    const handleSwUpdate = () => setHasNewSwVersion(true);
    window.addEventListener('sw-update-available', handleSwUpdate);

    let onMessage: ((event: MessageEvent) => void) | null = null;
    if ('serviceWorker' in navigator) {
      onMessage = (event: MessageEvent) => {
        if (event.data && event.data.type === 'SW_ACTIVATED') {
          setHasNewSwVersion(false);
        }
      };
      navigator.serviceWorker.addEventListener('message', onMessage);
    }

    return () => {
      window.removeEventListener('sw-update-available', handleSwUpdate);
      if (onMessage && 'serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', onMessage);
      }
    };
  }, []);

  const handleQuickUpdate = async () => {
    if (isUpdating) return;
    setIsUpdating(true);
    setUpdateDone(false);
    try {
      const res = await performQuickUpdateAndSync(onRefreshData);
      if (res.swUpdated || hasNewSwVersion) {
        await performFullAppVersionUpdate(onRefreshData);
        return;
      }
      setUpdateDone(true);
      setTimeout(() => setUpdateDone(false), 3500);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="bg-slate-900 text-white text-xs py-2 px-3 sm:px-5 border-b border-slate-800">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 min-w-0">
          {isLowBandwidth ? (
            <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          ) : (
            <Wifi className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          )}
          <span className="text-[11px] sm:text-xs truncate">
            {isLowBandwidth ? (
              <span className="text-amber-300 font-medium">
                Data Saver Active · Background Polling Paused (Manual Update Mode)
              </span>
            ) : (
              <span className="text-slate-300">
                <strong className="text-emerald-400 font-semibold">Free Plan Eco-Sync</strong>
                <span className="hidden md:inline"> · 98% Egress Saved · {APP_VERSION_LABEL}</span>
              </span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-auto">
          {hasNewSwVersion && (
            <button
              type="button"
              onClick={() => performFullAppVersionUpdate(onRefreshData)}
              className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[11px] font-extrabold flex items-center gap-1 shadow-xs animate-pulse cursor-pointer"
              title="App ဗားရှင်းအသစ် ထွက်ရှိထားပါသည် - နှိပ်၍ ချက်ချင်း Update လုပ်ပါ"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>App အသစ် Update လုပ်မည်</span>
            </button>
          )}

          {/* 1-Click Fast Data & App Update Button for all users */}
          <button
            type="button"
            onClick={handleQuickUpdate}
            disabled={isUpdating}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              updateDone
                ? 'bg-emerald-600 text-white'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-2xs'
            }`}
            title="နောက်ဆုံးရ ပို့စ်၊ Attendance နှင့် App Update များကို ချက်ချင်း ရယူရန်"
          >
            {isUpdating ? (
              <>
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Updating...</span>
              </>
            ) : updateDone ? (
              <>
                <Check className="w-3 h-3" />
                <span>Updated!</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-3 h-3" />
                <span>Update (အသစ်ရယူရန်)</span>
              </>
            )}
          </button>

          {/* 1-Click Full App Reload (clears stale browser/SW cache while keeping user logged in) */}
          <button
            type="button"
            onClick={() => performFullAppVersionUpdate(onRefreshData)}
            className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer"
            title="App Version အသစ် ပြန်လည်ဖွင့်ရန် (Cache ရှင်းပြီး App ပြန်ဖွင့်မည် - Login ပြန်ဝင်ရန်မလိုပါ)"
          >
            <RotateCcw className="w-3 h-3 text-emerald-400" />
            <span className="hidden sm:inline">App ပြန်ဖွင့်ရန်</span>
          </button>

          <button
            type="button"
            onClick={onToggle}
            className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer hidden xs:inline-block ${
              isLowBandwidth
                ? 'bg-amber-400 text-slate-950 hover:bg-amber-300 font-bold'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
          >
            {isLowBandwidth ? 'Eco Pause: ON' : 'Data Saver'}
          </button>
        </div>
      </div>
    </div>
  );
};
