import React, { useState, useEffect } from 'react';
import { BookA } from 'lucide-react';

interface SelectionDictionaryTriggerProps {
  onLookupWord: (word: string) => void;
  disabled?: boolean;
}

export const SelectionDictionaryTrigger: React.FC<SelectionDictionaryTriggerProps> = ({
  onLookupWord,
  disabled = false,
}) => {
  const [selectedWord, setSelectedWord] = useState<string>('');
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (disabled) {
      setSelectedWord('');
      setCoords(null);
      return;
    }

    const handleSelectionCheck = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        setSelectedWord('');
        setCoords(null);
        return;
      }

      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          (activeEl as HTMLElement).isContentEditable)
      ) {
        return;
      }

      const text = selection.toString().trim();
      // Only show quick dictionary lookup for 1 to 3 words (between 2 and 36 chars)
      if (text.length < 2 || text.length > 36 || text.split(/\s+/).length > 3) {
        setSelectedWord('');
        setCoords(null);
        return;
      }

      try {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return;

        const clampedX = Math.max(80, Math.min(window.innerWidth - 80, rect.left + rect.width / 2));
        const clampedY = Math.max(56, rect.top - 10);

        setSelectedWord(text.replace(/^[.,;:!?"'()[\]]+|[.,;:!?"'()[\]]+$/g, ''));
        setCoords({ x: clampedX, y: clampedY });
      } catch {
        setSelectedWord('');
        setCoords(null);
      }
    };

    const handleMouseUp = () => {
      setTimeout(handleSelectionCheck, 20);
    };

    const handleScrollOrDown = () => {
      setSelectedWord('');
      setCoords(null);
    };

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchend', handleMouseUp, { passive: true });
    window.addEventListener('scroll', handleScrollOrDown, { passive: true });

    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchend', handleMouseUp);
      window.removeEventListener('scroll', handleScrollOrDown);
    };
  }, [disabled]);

  if (!selectedWord || !coords) return null;

  return (
    <div
      style={{
        left: `${coords.x}px`,
        top: `${coords.y}px`,
        transform: 'translate(-50%, -100%)',
      }}
      className="fixed z-50 pointer-events-auto animate-in fade-in zoom-in-95 duration-150"
    >
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const word = selectedWord;
          setSelectedWord('');
          setCoords(null);
          window.getSelection()?.removeAllRanges();
          onLookupWord(word);
        }}
        className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold shadow-xl border border-indigo-400/40 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
      >
        <BookA className="w-3.5 h-3.5 shrink-0" />
        <span>အဘိဓာန်ကြည့်ရန်: “{selectedWord}”</span>
      </button>
    </div>
  );
};
