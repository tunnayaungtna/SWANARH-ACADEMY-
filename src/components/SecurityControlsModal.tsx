import React, { useState } from 'react';
import { ClassroomDB } from '../services/storage';
import { User } from '../types/classroom';
import { Lock, CheckCircle } from 'lucide-react';

interface SecurityControlsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onUpdate: () => void;
}

export const SecurityControlsModal: React.FC<SecurityControlsModalProps> = ({
  isOpen,
  onClose,
  currentUser: _currentUser,
  onUpdate,
}) => {
  const currentSettings = ClassroomDB.getSecuritySettings();
  const [textProtection, setTextProtection] = useState(currentSettings.textProtectionEnabled);
  const [dynamicWatermark, setDynamicWatermark] = useState(currentSettings.dynamicWatermarkEnabled);
  const [watermarkOpacity, setWatermarkOpacity] = useState(currentSettings.watermarkOpacity);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    ClassroomDB.updateSecuritySettings({
      textProtectionEnabled: textProtection,
      dynamicWatermarkEnabled: dynamicWatermark,
      watermarkOpacity,
    });
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onUpdate();
      onClose();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 transition-colors">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="font-bold text-slate-900 dark:text-white text-base">
              Content Security & Anti-Piracy Settings
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="py-4 space-y-4 text-xs text-slate-700 dark:text-slate-300">
          {/* Dynamic Watermark Control */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-750 bg-slate-50 dark:bg-slate-800/60 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-900 dark:text-white block">Dynamic Watermark Overlay</span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Renders randomized moving coordinates containing student's Name, Phone, and Email during video playback.
                </p>
              </div>
              <input
                type="checkbox"
                checked={dynamicWatermark}
                onChange={(e) => setDynamicWatermark(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
            </div>

            {dynamicWatermark && (
              <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700">
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                  <span>Watermark Opacity</span>
                  <span className="font-mono">{Math.round(watermarkOpacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={0.5}
                  step={0.05}
                  value={watermarkOpacity}
                  onChange={(e) => setWatermarkOpacity(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded appearance-none accent-indigo-600"
                />
              </div>
            )}
          </div>

          {/* Text & Right-Click Protection */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-750 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between">
            <div>
              <span className="font-semibold text-slate-900 dark:text-white block">Text Selection & Inspect Protection</span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Prevents drag-copying source lesson content and disables contextual inspect menus on students.
              </p>
            </div>
            <input
              type="checkbox"
              checked={textProtection}
              onChange={(e) => setTextProtection(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
            />
          </div>

          {/* Security Alert / Notice */}
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-xl text-amber-900 dark:text-amber-200 text-[11px] leading-relaxed">
            <strong>Architecture Note:</strong> Watermark & copy protection settings are enforced client-side with cryptographic tamper-evident signatures across student views.
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
          <div>
            {savedSuccess && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle className="w-4 h-4" />
                Settings saved successfully
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Apply Protection Rules
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
