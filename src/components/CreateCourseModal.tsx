import React, { useState, useRef } from 'react';
import { ClassroomDB } from '../services/storage';
import { User, Course } from '../types/classroom';
import { PRESET_CLASSROOM_BANNERS, resizeToGoogleClassroomBanner } from './CourseBannerModal';
import { PlusCircle, Upload, Image as ImageIcon } from 'lucide-react';

interface CreateCourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onCourseCreated: (course: Course) => void;
}

export const CreateCourseModal: React.FC<CreateCourseModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onCourseCreated,
}) => {
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [batch, setBatch] = useState('Batch 2026-D');
  const [section, setSection] = useState('Section A (Weekday Evening)');
  const [description, setDescription] = useState('');
  const [bannerImage, setBannerImage] = useState(PRESET_CLASSROOM_BANNERS[0].url);
  const [isProcessingBanner, setIsProcessingBanner] = useState(false);
  const [themeColor] = useState<'indigo' | 'emerald' | 'amber' | 'rose'>('indigo');

  const bannerFileRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessingBanner(true);
    try {
      const dataUrl = await resizeToGoogleClassroomBanner(file, 'center');
      setBannerImage(dataUrl);
    } catch {
      // ignore
    } finally {
      setIsProcessingBanner(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !code.trim()) return;

    const newCourse = ClassroomDB.createCourse({
      code: code.trim().toUpperCase(),
      title: title.trim(),
      section: section.trim(),
      batch: batch.trim(),
      description: description.trim() || 'Comprehensive academic course curriculum.',
      instructorName: currentUser.name,
      instructorEmail: currentUser.email,
      bannerImage,
      themeColor,
      enrolledStudentIds: [],
      totalLessons: 1,
      totalAssignments: 0,
      totalQuizzes: 0,
    });

    onCourseCreated(newCourse);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 max-h-[90vh] overflow-y-auto transition-colors">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="font-bold text-slate-900 dark:text-white text-base">Create New Class / Batch</h3>
          </div>
          <button
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="py-4 space-y-3.5 text-xs">
          {/* Google Classroom 1000x250 Header Photo Picker */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-semibold">
                <ImageIcon className="w-3.5 h-3.5 text-indigo-500" />
                <span>Classroom Header Photo (1000 × 250 px)</span>
              </label>
              <input
                ref={bannerFileRef}
                type="file"
                accept="image/*"
                onChange={handleBannerUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => bannerFileRef.current?.click()}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-semibold hover:bg-indigo-100 transition-colors cursor-pointer text-[11px]"
              >
                <Upload className="w-3 h-3" />
                <span>{isProcessingBanner ? 'Formatting...' : 'Upload Custom Photo'}</span>
              </button>
            </div>

            <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
              <div className="relative w-full aspect-[4/1] bg-slate-900 overflow-hidden">
                <img
                  src={bannerImage}
                  alt="Class Header Preview"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover object-center"
                />
              </div>
              <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700">
                <div className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400">
                  {code || 'COURSE-CODE'} · {batch || 'Batch'}
                </div>
                <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {title || 'New Classroom Title Preview'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {PRESET_CLASSROOM_BANNERS.slice(0, 5).map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setBannerImage(preset.url)}
                  className={`relative w-20 aspect-[4/1] rounded-lg overflow-hidden border-2 shrink-0 cursor-pointer ${
                    bannerImage === preset.url
                      ? 'border-indigo-600 ring-1 ring-indigo-500'
                      : 'border-slate-200 dark:border-slate-700 opacity-75 hover:opacity-100'
                  }`}
                  title={preset.label}
                >
                  <img
                    src={preset.url}
                    alt={preset.label}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Course Code</label>
              <input
                type="text"
                placeholder="e.g., CS-502"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-indigo-500 font-mono text-slate-900 dark:text-white"
                required
              />
            </div>
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Batch Identifier</label>
              <input
                type="text"
                placeholder="e.g., Batch 2026-D"
                value={batch}
                onChange={(e) => setBatch(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-indigo-500 font-mono text-slate-900 dark:text-white"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Course Title</label>
            <input
              type="text"
              placeholder="e.g., Distributed Cloud Microservices & Kubernetes"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-900 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Section / Schedule</label>
            <input
              type="text"
              placeholder="e.g., Section A (Weekday Evening - Online Live)"
              value={section}
              onChange={(e) => setSection(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-900 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Course Syllabus Overview</label>
            <textarea
              rows={3}
              placeholder="Brief description of prerequisites, key topics, and learning objectives..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-indigo-500 resize-none text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Create Class & Initialize Batch
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
