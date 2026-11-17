import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  DICTIONARY_CATEGORY_LABELS,
  DictionaryCategory,
  DictionaryEntry,
} from '../data/enMmDictionary';
import {
  MASTER_STATIC_DICTIONARY,
  containsMyanmarScript,
  searchLocalDictionary,
  lookupLiveBilingualWord,
} from '../services/dictionaryService';
import {
  BookA,
  Search,
  Volume2,
  Star,
  X,
  Plus,
  Sparkles,
  Copy,
  Check,
  Trash2,
  Loader2,
} from 'lucide-react';

const SAVED_WORDS_STORAGE_KEY = 'swanarh_dict_saved_ids_v1';
const RECENT_SEARCHES_STORAGE_KEY = 'swanarh_dict_recent_v1';
const CUSTOM_ENTRIES_STORAGE_KEY = 'swanarh_dict_custom_entries_v1';

interface DictionaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
}

export const DictionaryModal: React.FC<DictionaryModalProps> = ({
  isOpen,
  onClose,
  initialQuery = '',
}) => {
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState<
    DictionaryCategory | 'all' | 'saved' | 'custom'
  >('all');
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [savedIds, setSavedIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(SAVED_WORDS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(RECENT_SEARCHES_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [customEntries, setCustomEntries] = useState<DictionaryEntry[]>(() => {
    try {
      const raw = localStorage.getItem(CUSTOM_ENTRIES_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Add Custom Word Form state
  const [showAddCustomForm, setShowAddCustomForm] = useState(false);
  const [customEn, setCustomEn] = useState('');
  const [customPos, setCustomPos] = useState('n.');
  const [customMm, setCustomMm] = useState('');
  const [customExampleEn, setCustomExampleEn] = useState('');
  const [customExampleMm, setCustomExampleMm] = useState('');

  // Automatic Live Bilingual Lookup state (for any word not in static list)
  const [liveLookupEntry, setLiveLookupEntry] = useState<DictionaryEntry | null>(null);
  const [isLookingUpLive, setIsLookingUpLive] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && initialQuery.trim()) {
      setSearchQuery(initialQuery.trim());
      setActiveTab('all');
    }
  }, [isOpen, initialQuery]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 60);
    }
  }, [isOpen]);

  const combinedEntries = useMemo(() => {
    const map = new Map<string, DictionaryEntry>();
    for (const item of customEntries) {
      map.set(item.id, item);
    }
    for (const item of MASTER_STATIC_DICTIONARY) {
      map.set(item.id, item);
    }
    if (liveLookupEntry) {
      map.set(liveLookupEntry.id, liveLookupEntry);
    }
    return Array.from(map.values());
  }, [customEntries, liveLookupEntry]);

  const wordOfTheDay = useMemo(() => {
    const dayIndex =
      Math.floor(Date.now() / 86_400_000) % MASTER_STATIC_DICTIONARY.length;
    return MASTER_STATIC_DICTIONARY[dayIndex] || MASTER_STATIC_DICTIONARY[0];
  }, []);

  // Strict local search (zero false positives)
  const { localResults, hasExactLocalMatch } = useMemo(() => {
    let baseList = [...customEntries, ...MASTER_STATIC_DICTIONARY];

    if (activeTab === 'saved') {
      baseList = combinedEntries.filter((item) => savedIds.includes(item.id));
    } else if (activeTab === 'custom') {
      baseList = customEntries;
    } else if (activeTab !== 'all') {
      baseList = baseList.filter((item) => item.category === activeTab);
    }

    const { results, hasExactMatch } = searchLocalDictionary(searchQuery, baseList);
    return { localResults: results, hasExactLocalMatch: hasExactMatch };
  }, [customEntries, combinedEntries, activeTab, searchQuery, savedIds]);

  // Automatic real-time bilingual lookup when user types any word not exactly in static list
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q || q.length < 2) {
      setLiveLookupEntry(null);
      setIsLookingUpLive(false);
      return;
    }

    // If we already have an exact headword match in English, no need to wait for network
    const isMm = containsMyanmarScript(q);
    if (!isMm && hasExactLocalMatch && localResults[0]?.en.toLowerCase() === q.toLowerCase()) {
      setLiveLookupEntry(null);
      setIsLookingUpLive(false);
      return;
    }

    let cancelled = false;
    setIsLookingUpLive(true);

    const timer = setTimeout(async () => {
      const entry = await lookupLiveBilingualWord(q);
      if (cancelled) return;
      setIsLookingUpLive(false);
      if (entry) {
        setLiveLookupEntry(entry);
      } else {
        setLiveLookupEntry(null);
      }
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, hasExactLocalMatch, localResults]);

  // Final displayed list combining live exact result + strict local matches
  const displayedEntries = useMemo(() => {
    if (!liveLookupEntry || !searchQuery.trim()) {
      return localResults;
    }
    // Avoid duplicating if liveLookupEntry has the same English headword as the first local result
    const liveEnLower = liveLookupEntry.en.trim().toLowerCase();
    const alreadyInLocal = localResults.some(
      (r) => r.en.trim().toLowerCase() === liveEnLower
    );
    if (alreadyInLocal && hasExactLocalMatch) {
      return localResults;
    }
    const filteredLocal = localResults.filter(
      (r) => r.en.trim().toLowerCase() !== liveEnLower
    );
    return [liveLookupEntry, ...filteredLocal];
  }, [localResults, liveLookupEntry, searchQuery, hasExactLocalMatch]);

  const selectedEntry = useMemo(() => {
    if (selectedEntryId) {
      const found =
        displayedEntries.find((e) => e.id === selectedEntryId) ||
        combinedEntries.find((e) => e.id === selectedEntryId);
      if (found) return found;
    }
    return displayedEntries[0] || (!searchQuery.trim() ? wordOfTheDay : null);
  }, [selectedEntryId, displayedEntries, combinedEntries, wordOfTheDay, searchQuery]);

  const recordRecentSearch = (term: string) => {
    const clean = term.trim();
    if (!clean || clean.length < 2) return;
    setRecentSearches((prev) => {
      const next = [
        clean,
        ...prev.filter((item) => item.toLowerCase() !== clean.toLowerCase()),
      ].slice(0, 8);
      try {
        localStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handleToggleSaveWord = (entry: DictionaryEntry, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    // If saving a live-looked-up word, also persist it into customEntries so it stays in Saved tab forever
    if (entry.id.startsWith('live-') && !customEntries.some((c) => c.id === entry.id)) {
      const nextCustom = [entry, ...customEntries];
      setCustomEntries(nextCustom);
      try {
        localStorage.setItem(CUSTOM_ENTRIES_STORAGE_KEY, JSON.stringify(nextCustom));
      } catch {
        // ignore
      }
    }

    setSavedIds((prev) => {
      const exists = prev.includes(entry.id);
      const next = exists
        ? prev.filter((item) => item !== entry.id)
        : [entry.id, ...prev];
      try {
        localStorage.setItem(SAVED_WORDS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const speakEnglishText = (text: string, lang: 'en-US' | 'en-GB' = 'en-US') => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = 0.92;
      window.speechSynthesis.speak(utterance);
    } catch {
      // ignore
    }
  };

  const handleCopyEntry = (entry: DictionaryEntry) => {
    const text = `${entry.en} (${entry.pos}) — ${entry.mm}\n${entry.enDef}\nExample: ${entry.exampleEn} (${entry.exampleMm})`;
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedId(entry.id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleAddCustomWordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEn.trim() || !customMm.trim()) return;

    const newEntry: DictionaryEntry = {
      id: `custom-${Date.now()}`,
      en: customEn.trim(),
      pos: customPos.trim() || 'n.',
      mm: customMm.trim(),
      enDef: customMm.trim(),
      exampleEn:
        customExampleEn.trim() || `Example usage of "${customEn.trim()}".`,
      exampleMm: customExampleMm.trim() || customMm.trim(),
      category: 'general',
    };

    const nextCustom = [newEntry, ...customEntries];
    setCustomEntries(nextCustom);
    try {
      localStorage.setItem(CUSTOM_ENTRIES_STORAGE_KEY, JSON.stringify(nextCustom));
    } catch {
      // ignore
    }

    setCustomEn('');
    setCustomMm('');
    setCustomExampleEn('');
    setCustomExampleMm('');
    setShowAddCustomForm(false);
    setSelectedEntryId(newEntry.id);
    setActiveTab('all');
    setSearchQuery(newEntry.en);
  };

  const handleDeleteCustomEntry = (id: string) => {
    const nextCustom = customEntries.filter((item) => item.id !== id);
    setCustomEntries(nextCustom);
    try {
      localStorage.setItem(CUSTOM_ENTRIES_STORAGE_KEY, JSON.stringify(nextCustom));
    } catch {
      // ignore
    }
    if (selectedEntryId === id) {
      setSelectedEntryId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-5 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[88dvh] rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-[0_24px_60px_-12px_rgba(15,23,42,0.45)] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Clean Premium Top Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-800 text-white flex items-center justify-center shadow-sm shrink-0">
              <BookA className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight truncate">
                အင်္ဂလိပ် ⇄ မြန်မာ အဘိဓာန်
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
                SwanArh English ⇄ Myanmar Dictionary
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowAddCustomForm((prev) => !prev)}
              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                showAddCustomForm
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 hover:text-indigo-600 dark:hover:text-indigo-400'
              }`}
              title="ကိုယ်ပိုင် ဝေါဟာရအသစ် ထည့်သွင်းရန်"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">စာလုံးသစ်မှတ်ရန်</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
              aria-label="Close Dictionary"
              title="ပိတ်မည်"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>

        {/* Clean Collapsible Custom Word Drawer */}
        {showAddCustomForm && (
          <form
            onSubmit={handleAddCustomWordSubmit}
            className="px-4 sm:px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200/70 dark:border-slate-800 space-y-3 animate-in fade-in duration-150"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                ကိုယ်ပိုင် ဝေါဟာရအသစ် မှတ်သားရန်
              </span>
              <button
                type="button"
                onClick={() => setShowAddCustomForm(false)}
                className="text-xs font-semibold text-slate-400 hover:text-rose-500 cursor-pointer"
              >
                ပိတ်မည်
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              <input
                type="text"
                required
                placeholder="English စာလုံး (ဥပမာ - resilient)"
                value={customEn}
                onChange={(e) => setCustomEn(e.target.value)}
                className="sm:col-span-4 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <select
                value={customPos}
                onChange={(e) => setCustomPos(e.target.value)}
                className="sm:col-span-3 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="n.">n. (နာမ်)</option>
                <option value="v.">v. (ကြိယာ)</option>
                <option value="adj.">adj. (နာမဝိသေသန)</option>
                <option value="adv.">adv. (ကြိယာဝိသေသန)</option>
                <option value="phr.v.">phr.v. (Phrasal Verb)</option>
                <option value="idiom">idiom (အီဒီယမ်)</option>
              </select>
              <input
                type="text"
                required
                placeholder="မြန်မာ အဓိပ္ပာယ် (ဥပမာ - ကြံ့ကြံ့ခံနိုင်သော)"
                value={customMm}
                onChange={(e) => setCustomMm(e.target.value)}
                className="sm:col-span-5 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              <input
                type="text"
                placeholder="အင်္ဂလိပ် ဥပမာဝါကျ (Optional)"
                value={customExampleEn}
                onChange={(e) => setCustomExampleEn(e.target.value)}
                className="sm:col-span-5 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="text"
                placeholder="မြန်မာ ဥပမာဝါကျ (Optional)"
                value={customExampleMm}
                onChange={(e) => setCustomExampleMm(e.target.value)}
                className="sm:col-span-5 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                className="sm:col-span-2 py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer shadow-xs"
              >
                သိမ်းမည်
              </button>
            </div>
          </form>
        )}

        {/* Search Input + Clean Filter Tabs */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-slate-100 dark:border-slate-800/80 space-y-3 bg-slate-50/50 dark:bg-slate-900/40">
          {/* Unified Smart Search Box */}
          <div className="relative">
            {isLookingUpLive ? (
              <Loader2 className="w-4.5 h-4.5 absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500 animate-spin pointer-events-none" />
            ) : (
              <Search className="w-4.5 h-4.5 absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500 pointer-events-none" />
            )}
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSelectedEntryId(null);
                if (activeTab !== 'all' && e.target.value.trim()) {
                  setActiveTab('all');
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchQuery.trim()) {
                  recordRecentSearch(searchQuery.trim());
                }
              }}
              placeholder="အင်္ဂလိပ် သို့မဟုတ် မြန်မာစာလုံး ရိုက်ထည့်ရှာဖွေပါ... (ဥပမာ - apple, good, diligent, ပန်းသီး, တာဝန်)"
              className="w-full pl-11 pr-20 py-3 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700/80 text-xs sm:text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedEntryId(null);
                  setLiveLookupEntry(null);
                  searchInputRef.current?.focus();
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-[11px] font-bold text-slate-500 dark:text-slate-300 hover:text-rose-600 cursor-pointer"
              >
                ရှင်းမည်
              </button>
            )}
          </div>

          {/* Minimal Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
            {(
              [
                'all',
                'civil_service',
                'academic',
                'grammar_idiom',
                'business_tech',
                'general',
              ] as const
            ).map((catKey) => {
              const info = DICTIONARY_CATEGORY_LABELS[catKey];
              const isActive = activeTab === catKey;
              return (
                <button
                  key={catKey}
                  type="button"
                  onClick={() => {
                    setActiveTab(catKey);
                    setSelectedEntryId(null);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700/70 hover:border-indigo-300 dark:hover:border-indigo-700'
                  }`}
                >
                  {info.labelMm}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => {
                setActiveTab('saved');
                setSelectedEntryId(null);
              }}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap flex items-center gap-1 transition-all cursor-pointer shrink-0 ${
                activeTab === 'saved'
                  ? 'bg-amber-500 text-white shadow-2xs'
                  : 'bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60'
              }`}
            >
              <Star className="w-3 h-3 fill-current" />
              <span>မှတ်သားထားသော ({savedIds.length})</span>
            </button>
          </div>

          {/* Quick Recent Searches */}
          {recentSearches.length > 0 && !searchQuery && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-semibold text-slate-400">
                ပြန်ကြည့်ရန်:
              </span>
              {recentSearches.map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => setSearchQuery(term)}
                  className="px-2 py-0.5 rounded-lg bg-slate-200/60 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer transition-colors"
                >
                  {term}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Main Split Layout: Clean Word List (Left) + Spacious Detail View (Right) */}
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
          {/* Left Panel: Word List */}
          <div className="md:col-span-5 border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-800/80 overflow-y-auto max-h-52 md:max-h-full p-2.5 sm:p-3 space-y-1 bg-slate-50/30 dark:bg-slate-900/20">
            <div className="flex items-center justify-between px-2.5 py-1 text-[11px] font-semibold text-slate-400">
              <span>ဝေါဟာရစာရင်း ({displayedEntries.length})</span>
              {isLookingUpLive && (
                <span className="text-indigo-500 text-[10px] font-bold">
                  ရှာဖွေနေသည်...
                </span>
              )}
            </div>

            {displayedEntries.length === 0 ? (
              <div className="p-6 text-center space-y-2">
                {isLookingUpLive ? (
                  <div className="flex flex-col items-center gap-2 py-4">
                    <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      “{searchQuery}” ၏ အဓိပ္ပာယ်ကို ရှာဖွေနေပါသည်...
                    </p>
                  </div>
                ) : (
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    “{searchQuery}” အတွက် စာလုံးပေါင်း ပြန်လည်စစ်ဆေးပါ။
                  </p>
                )}
              </div>
            ) : (
              displayedEntries.map((entry) => {
                const isSelected = selectedEntry?.id === entry.id;
                const isSaved = savedIds.includes(entry.id);
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => {
                      setSelectedEntryId(entry.id);
                      if (searchQuery.trim()) {
                        recordRecentSearch(searchQuery.trim());
                      }
                    }}
                    className={`w-full text-left px-3 py-2.5 rounded-2xl transition-all flex items-center justify-between gap-2 cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-800 dark:text-slate-100'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-bold truncate">
                          {entry.en}
                        </span>
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md shrink-0 ${
                            isSelected
                              ? 'bg-white/20 text-white'
                              : 'bg-slate-200/70 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {entry.pos}
                        </span>
                      </div>
                      <p
                        className={`text-xs mt-0.5 truncate ${
                          isSelected
                            ? 'text-indigo-100 font-medium'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {entry.mm}
                      </p>
                    </div>

                    {isSaved && (
                      <Star
                        className={`w-3.5 h-3.5 shrink-0 fill-current ${
                          isSelected ? 'text-amber-300' : 'text-amber-400'
                        }`}
                      />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Right Panel: Clean Premium Word Detail View */}
          <div className="md:col-span-7 overflow-y-auto p-4 sm:p-6 space-y-5 bg-white dark:bg-slate-900">
            {!searchQuery.trim() && selectedEntry?.id === wordOfTheDay.id && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/50 border border-amber-200/70 dark:border-amber-800/50 text-[11px] font-bold text-amber-700 dark:text-amber-300">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>ယနေ့အတွက် မှတ်သားဖွယ် ဝေါဟာရ (Word of the Day)</span>
              </div>
            )}

            {selectedEntry && (
              <div className="space-y-5">
                {/* Word Title + Pronunciation + Quick Actions */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                        {selectedEntry.en}
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-mono text-xs font-bold border border-indigo-200/60 dark:border-indigo-800/60">
                        {selectedEntry.pos}
                      </span>
                    </div>
                    {selectedEntry.phonetic && (
                      <div className="text-xs sm:text-sm font-mono text-slate-400 dark:text-slate-500">
                        {selectedEntry.phonetic}
                      </div>
                    )}
                  </div>

                  {/* Clean Action Buttons */}
                  <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                    <button
                      type="button"
                      onClick={() => speakEnglishText(selectedEntry.en, 'en-US')}
                      className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                      title="အသံထွက် နားထောင်ရန် (US)"
                    >
                      <Volume2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <span>အသံထွက်</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleSaveWord(selectedEntry)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                        savedIds.includes(selectedEntry.id)
                          ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70'
                      }`}
                    >
                      <Star
                        className={`w-3.5 h-3.5 ${
                          savedIds.includes(selectedEntry.id) ? 'fill-current text-amber-500' : ''
                        }`}
                      />
                      <span>{savedIds.includes(selectedEntry.id) ? 'မှတ်ပြီး' : 'မှတ်မည်'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyEntry(selectedEntry)}
                      className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/70 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer transition-colors"
                      title="ကူးယူရန် (Copy)"
                    >
                      {copiedId === selectedEntry.id ? (
                        <Check className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                    {selectedEntry.id.startsWith('custom-') && (
                      <button
                        type="button"
                        onClick={() => handleDeleteCustomEntry(selectedEntry.id)}
                        className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 hover:bg-rose-100 cursor-pointer"
                        title="ဖျက်ရန်"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Myanmar Meaning Highlight Card */}
                <div className="rounded-2xl p-4 sm:p-5 bg-gradient-to-br from-emerald-50/90 to-teal-50/60 dark:from-emerald-950/35 dark:to-slate-900 border border-emerald-200/70 dark:border-emerald-800/50 space-y-2">
                  <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                    မြန်မာ အဓိပ္ပာယ်
                  </div>
                  <div className="text-base sm:text-xl font-extrabold text-slate-900 dark:text-white leading-relaxed">
                    {selectedEntry.mm}
                  </div>
                  {selectedEntry.mmDetail && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed pt-1.5 border-t border-emerald-200/50 dark:border-emerald-800/40">
                      {selectedEntry.mmDetail}
                    </p>
                  )}
                </div>

                {/* English Definition */}
                <div className="space-y-1.5">
                  <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    English Meaning
                  </div>
                  <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                    {selectedEntry.enDef}
                  </p>
                </div>

                {/* Example Sentence Card */}
                <div className="rounded-2xl p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      ဥပမာ ဝါကျ (Example)
                    </span>
                    <button
                      type="button"
                      onClick={() => speakEnglishText(selectedEntry.exampleEn, 'en-US')}
                      className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>ဝါကျအသံထွက်</span>
                    </button>
                  </div>
                  <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white leading-relaxed">
                    “{selectedEntry.exampleEn}”
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {selectedEntry.exampleMm}
                  </p>
                </div>

                {/* Synonyms & Antonyms */}
                {((selectedEntry.synonyms && selectedEntry.synonyms.length > 0) ||
                  (selectedEntry.antonyms && selectedEntry.antonyms.length > 0)) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {selectedEntry.synonyms && selectedEntry.synonyms.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                          အဓိပ္ပာယ်တူ (Synonyms)
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedEntry.synonyms.map((syn) => (
                            <button
                              key={syn}
                              type="button"
                              onClick={() => {
                                setSearchQuery(syn);
                                setSelectedEntryId(null);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 text-xs font-medium cursor-pointer transition-colors"
                            >
                              {syn}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedEntry.antonyms && selectedEntry.antonyms.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                          ဆန့်ကျင်ဘက် (Antonyms)
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedEntry.antonyms.map((ant) => (
                            <button
                              key={ant}
                              type="button"
                              onClick={() => {
                                setSearchQuery(ant);
                                setSelectedEntryId(null);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-slate-700 dark:text-slate-300 hover:text-rose-600 text-xs font-medium cursor-pointer transition-colors"
                            >
                              {ant}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
