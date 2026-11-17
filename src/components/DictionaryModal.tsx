import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { DictionaryEntry } from '../data/enMmDictionary';
import {
  MASTER_STATIC_DICTIONARY,
  OxfordDictionaryData,
  containsMyanmarScript,
  convertStaticToOxfordData,
  fetchOxfordDictionaryEntry,
  fetchWordSuggestions,
  searchLocalDictionary,
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
  KeyRound,
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
  const [showSavedOnly, setShowSavedOnly] = useState(false);
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

  // Universal Oxford Live Lookup & Autocomplete states
  const [liveLookupEntry, setLiveLookupEntry] = useState<DictionaryEntry | null>(null);
  const [oxfordMap, setOxfordMap] = useState<Record<string, OxfordDictionaryData>>({});
  const [isLookingUpLive, setIsLookingUpLive] = useState(false);
  const [isEnrichingSelected, setIsEnrichingSelected] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (isOpen && initialQuery.trim()) {
      setSearchQuery(initialQuery.trim());
      setSelectedEntryId(null);
      setShowSavedOnly(false);
    }
  }, [isOpen, initialQuery]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 40);
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

    if (showSavedOnly) {
      baseList = combinedEntries.filter((item) => savedIds.includes(item.id));
    }

    const { results, hasExactMatch } = searchLocalDictionary(searchQuery, baseList);
    return { localResults: results, hasExactLocalMatch: hasExactMatch };
  }, [customEntries, combinedEntries, showSavedOnly, searchQuery, savedIds]);

  // Fast Live Autocomplete Suggestions as user types
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q || q.length < 2 || containsMyanmarScript(q)) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const list = await fetchWordSuggestions(q);
      if (!cancelled) {
        setSuggestions(
          list.filter((w) => w.toLowerCase() !== q.toLowerCase()).slice(0, 6)
        );
      }
    }, 80);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  // Universal Live Oxford Lookup for ANY searched word (English or Myanmar)
  const triggerUniversalLookup = useCallback(async (queryText: string) => {
    const q = queryText.trim();
    if (!q) return;

    setIsLookingUpLive(true);
    const res = await fetchOxfordDictionaryEntry(q, (preview) => {
      setLiveLookupEntry(preview.summaryEntry);
      setOxfordMap((prev) => ({
        ...prev,
        [preview.summaryEntry.id]: preview.oxfordData,
        [preview.oxfordData.headword.toLowerCase()]: preview.oxfordData,
        [q.toLowerCase()]: preview.oxfordData,
      }));
    });
    setIsLookingUpLive(false);

    if (res) {
      setLiveLookupEntry(res.summaryEntry);
      setOxfordMap((prev) => ({
        ...prev,
        [res.summaryEntry.id]: res.oxfordData,
        [res.oxfordData.headword.toLowerCase()]: res.oxfordData,
        [q.toLowerCase()]: res.oxfordData,
      }));
    }
  }, []);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setLiveLookupEntry(null);
      setIsLookingUpLive(false);
      return;
    }

    let cancelled = false;
    setIsLookingUpLive(true);

    // Ultra-fast 70ms debounce with progressive ~80ms fast preview callback
    const timer = setTimeout(async () => {
      const res = await fetchOxfordDictionaryEntry(q, (preview) => {
        if (cancelled) return;
        setLiveLookupEntry(preview.summaryEntry);
        setOxfordMap((prev) => ({
          ...prev,
          [preview.summaryEntry.id]: preview.oxfordData,
          [preview.oxfordData.headword.toLowerCase()]: preview.oxfordData,
          [q.toLowerCase()]: preview.oxfordData,
        }));
      });
      if (cancelled) return;
      setIsLookingUpLive(false);
      if (res) {
        setLiveLookupEntry(res.summaryEntry);
        setOxfordMap((prev) => ({
          ...prev,
          [res.summaryEntry.id]: res.oxfordData,
          [res.oxfordData.headword.toLowerCase()]: res.oxfordData,
          [q.toLowerCase()]: res.oxfordData,
        }));
      } else {
        setLiveLookupEntry(null);
      }
    }, 70);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  // Final displayed list combining live exact result + strict local matches
  const displayedEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!liveLookupEntry || !q) {
      return localResults;
    }
    const liveEnLower = liveLookupEntry.en.trim().toLowerCase();
    const firstLocalLower = localResults[0]?.en.trim().toLowerCase();

    if (firstLocalLower === liveEnLower && hasExactLocalMatch) {
      return localResults;
    }

    const filteredLocal = localResults.filter(
      (r) => r.en.trim().toLowerCase() !== liveEnLower && r.id !== liveLookupEntry.id
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

  // Automatically enrich whichever entry is currently selected with full Oxford multi-POS senses & native audio
  useEffect(() => {
    if (!selectedEntry) return;
    const headwordKey = selectedEntry.en.trim().toLowerCase();
    if (oxfordMap[selectedEntry.id] || oxfordMap[headwordKey]) {
      return;
    }

    let cancelled = false;
    setIsEnrichingSelected(true);
    fetchOxfordDictionaryEntry(selectedEntry.en).then((res) => {
      if (cancelled) return;
      setIsEnrichingSelected(false);
      if (res) {
        setOxfordMap((prev) => ({
          ...prev,
          [selectedEntry.id]: res.oxfordData,
          [headwordKey]: res.oxfordData,
        }));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [selectedEntry, oxfordMap]);

  // Resolved OxfordDictionaryData for the right-hand panel (instant fallback + enriched multi-POS data)
  const activeOxfordData: OxfordDictionaryData | null = useMemo(() => {
    if (!selectedEntry) return null;
    const headwordKey = selectedEntry.en.trim().toLowerCase();
    return (
      oxfordMap[selectedEntry.id] ||
      oxfordMap[headwordKey] ||
      convertStaticToOxfordData(selectedEntry)
    );
  }, [selectedEntry, oxfordMap]);

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

  const handleSelectWordJump = (word: string) => {
    const clean = word.trim();
    if (!clean) return;
    setSearchQuery(clean);
    setSelectedEntryId(null);
    setShowSavedOnly(false);
    recordRecentSearch(clean);
    triggerUniversalLookup(clean);
  };

  const handleToggleSaveWord = (entry: DictionaryEntry, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (
      (entry.id.startsWith('live-') || entry.id.startsWith('oxford-')) &&
      !customEntries.some((c) => c.id === entry.id)
    ) {
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

  const playPronunciation = (
    text: string,
    accent: 'en-GB' | 'en-US' = 'en-GB',
    audioUrl?: string
  ) => {
    if (audioUrl) {
      try {
        if (activeAudioRef.current) {
          activeAudioRef.current.pause();
        }
        const audio = new Audio(audioUrl);
        activeAudioRef.current = audio;
        audio.play().catch(() => {
          speakFallback(text, accent);
        });
        return;
      } catch {
        // fallback to speechSynthesis
      }
    }
    speakFallback(text, accent);
  };

  const speakFallback = (text: string, lang: 'en-GB' | 'en-US') => {
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

  const handleCopyEntry = (entry: DictionaryEntry, oxford: OxfordDictionaryData) => {
    const sensesText = oxford.meaningGroups
      .map(
        (g) =>
          `[${g.partOfSpeech} - ${g.posMm}] ${g.mmTerms.join('၊ ')}\n` +
          g.senses
            .map(
              (s) =>
                `  ${s.senseNumber}. ${s.definitionEn}${
                  s.exampleEn ? `\n     • "${s.exampleEn}"` : ''
                }`
            )
            .join('\n')
      )
      .join('\n\n');

    const text = `${oxford.headword} (${oxford.phoneticBrE}) — ${oxford.primaryMyanmarMeaning}\n\n${sensesText}`;
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
    setShowSavedOnly(false);
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
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl max-h-[90dvh] rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-[0_28px_70px_-15px_rgba(0,33,71,0.55)] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Authentic Oxford Navy Header Bar */}
        <div className="bg-[#002147] text-white px-4 sm:px-6 pt-3.5 pb-4 space-y-3">
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 text-amber-300 flex items-center justify-center shadow-inner shrink-0">
                <BookA className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-black tracking-tight text-white truncate">
                    Oxford Learner’s Dictionary
                  </h2>
                  <span className="px-2 py-0.5 rounded-md bg-amber-400/20 border border-amber-300/30 text-amber-200 text-[10px] font-extrabold uppercase tracking-wider">
                    EN ⇄ MM
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-300 truncate">
                  အင်္ဂလိပ် ⇄ မြန်မာ အဘိဓာန် • မည်သည့်စာလုံးမဆို အမြန်ရှာဖွေနိုင်သည်
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowSavedOnly((prev) => !prev);
                  setSelectedEntryId(null);
                }}
                className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  showSavedOnly
                    ? 'bg-amber-400 text-[#002147] shadow-xs'
                    : 'bg-white/10 hover:bg-white/20 text-amber-200 border border-white/15'
                }`}
                title="မှတ်သားထားသော စာလုံးများ"
              >
                <Star className="w-3.5 h-3.5 fill-current" />
                <span className="hidden md:inline">မှတ်သားထားသော</span>
                <span>({savedIds.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setShowAddCustomForm((prev) => !prev)}
                className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  showAddCustomForm
                    ? 'bg-amber-400 text-[#002147]'
                    : 'bg-white/10 hover:bg-white/20 text-white border border-white/15'
                }`}
                title="ကိုယ်ပိုင် ဝေါဟာရအသစ် ထည့်သွင်းရန်"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">စာလုံးသစ်မှတ်ရန်</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl bg-white/10 hover:bg-rose-500/80 text-white transition-colors cursor-pointer"
                aria-label="Close Dictionary"
                title="ပိတ်မည်"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>

          {/* Oxford Universal Search Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (searchQuery.trim()) {
                recordRecentSearch(searchQuery.trim());
                setSelectedEntryId(null);
                triggerUniversalLookup(searchQuery.trim());
              }
            }}
            className="relative flex items-center gap-2"
          >
            <div className="relative flex-1">
              {isLookingUpLive ? (
                <Loader2 className="w-4.5 h-4.5 absolute left-4 top-1/2 -translate-y-1/2 text-[#002147] dark:text-sky-400 animate-spin pointer-events-none" />
              ) : (
                <Search className="w-4.5 h-4.5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              )}
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedEntryId(null);
                  if (showSavedOnly && e.target.value.trim()) {
                    setShowSavedOnly(false);
                  }
                }}
                placeholder="အင်္ဂလိပ် သို့မဟုတ် မြန်မာစာလုံး မည်သည့်စာလုံးမဆို ရိုက်ထည့်ရှာဖွေပါ... (ဥပမာ - run, set, serendipity, ပန်းသီး, ပညာရေး)"
                className="w-full pl-11 pr-20 py-2.5 sm:py-3 rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 text-xs sm:text-sm font-semibold shadow-inner focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedEntryId(null);
                    setLiveLookupEntry(null);
                    setSuggestions([]);
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-300 hover:text-rose-600 cursor-pointer"
                >
                  ရှင်းမည်
                </button>
              )}
            </div>
            <button
              type="submit"
              className="px-4 py-2.5 sm:py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-[#002147] font-black text-xs sm:text-sm shrink-0 cursor-pointer transition-colors shadow-sm"
            >
              ရှာမည်
            </button>
          </form>

          {/* Instant Live Autocomplete Suggestions or Recent Searches */}
          {suggestions.length > 0 && searchQuery.trim().length >= 2 ? (
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              <span className="text-[10px] font-bold text-amber-200/90 uppercase tracking-wider">
                ဆက်စပ်စာလုံးများ:
              </span>
              {suggestions.map((sug) => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => handleSelectWordJump(sug)}
                  className="px-2.5 py-0.5 rounded-lg bg-white/10 hover:bg-amber-400 hover:text-[#002147] text-[11px] font-semibold text-white transition-colors cursor-pointer"
                >
                  {sug}
                </button>
              ))}
            </div>
          ) : (
            recentSearches.length > 0 &&
            !searchQuery && (
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                <span className="text-[10px] font-bold text-slate-300">
                  ပြန်ကြည့်ရန်:
                </span>
                {recentSearches.map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => handleSelectWordJump(term)}
                    className="px-2.5 py-0.5 rounded-lg bg-white/10 hover:bg-amber-400 hover:text-[#002147] text-[11px] font-medium text-slate-200 cursor-pointer transition-colors"
                  >
                    {term}
                  </button>
                ))}
              </div>
            )
          )}
        </div>

        {/* Collapsible Custom Word Drawer */}
        {showAddCustomForm && (
          <form
            onSubmit={handleAddCustomWordSubmit}
            className="px-4 sm:px-6 py-3.5 bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 space-y-2.5"
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
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <input
                type="text"
                required
                placeholder="English စာလုံး (ဥပမာ - resilient)"
                value={customEn}
                onChange={(e) => setCustomEn(e.target.value)}
                className="sm:col-span-4 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
              />
              <select
                value={customPos}
                onChange={(e) => setCustomPos(e.target.value)}
                className="sm:col-span-3 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-mono"
              >
                <option value="n.">noun (နာမ်)</option>
                <option value="v.">verb (ကြိယာ)</option>
                <option value="adj.">adjective (နာမဝိသေသန)</option>
                <option value="adv.">adverb (ကြိယာဝိသေသန)</option>
                <option value="phr.v.">phrasal verb</option>
                <option value="idiom">idiom (အီဒီယမ်)</option>
              </select>
              <input
                type="text"
                required
                placeholder="မြန်မာ အဓိပ္ပာယ် (ဥပမာ - ကြံ့ကြံ့ခံနိုင်သော)"
                value={customMm}
                onChange={(e) => setCustomMm(e.target.value)}
                className="sm:col-span-5 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <input
                type="text"
                placeholder="အင်္ဂလိပ် ဥပမာဝါကျ (Optional)"
                value={customExampleEn}
                onChange={(e) => setCustomExampleEn(e.target.value)}
                className="sm:col-span-5 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
              />
              <input
                type="text"
                placeholder="မြန်မာ ဥပမာဝါကျ (Optional)"
                value={customExampleMm}
                onChange={(e) => setCustomExampleMm(e.target.value)}
                className="sm:col-span-5 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
              />
              <button
                type="submit"
                className="sm:col-span-2 py-2 px-4 rounded-xl bg-[#002147] hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
              >
                သိမ်းမည်
              </button>
            </div>
          </form>
        )}

        {/* Main Split Body: Left Index List + Right Oxford Entry View */}
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
          {/* Left Panel: Headword Index */}
          <div className="md:col-span-4 border-b md:border-b-0 md:border-r border-slate-200/80 dark:border-slate-800 overflow-y-auto max-h-44 md:max-h-full p-2.5 space-y-1 bg-slate-50/40 dark:bg-slate-900/30">
            <div className="flex items-center justify-between px-2.5 py-1 text-[11px] font-bold text-slate-400">
              <span>
                {showSavedOnly
                  ? `မှတ်သားထားသော စာလုံးများ (${displayedEntries.length})`
                  : `ဝေါဟာရစာရင်း (${displayedEntries.length})`}
              </span>
              {isLookingUpLive && (
                <span className="text-[#002147] dark:text-sky-400 text-[10px] font-bold flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  ရှာဖွေနေသည်...
                </span>
              )}
            </div>

            {displayedEntries.length === 0 ? (
              <div className="p-6 text-center space-y-2">
                {isLookingUpLive ? (
                  <div className="flex flex-col items-center gap-2 py-4">
                    <Loader2 className="w-5 h-5 text-[#002147] dark:text-sky-400 animate-spin" />
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      “{searchQuery}” ကို Oxford အဘိဓာန်တွင် ရှာဖွေနေပါသည်...
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 py-3">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {showSavedOnly
                        ? 'မှတ်သားထားသော ဝေါဟာရ မရှိသေးပါ။'
                        : `“${searchQuery}” အတွက် စာလုံးပေါင်း ပြန်လည်စစ်ဆေးပါ။`}
                    </p>
                    {searchQuery.trim() && (
                      <button
                        type="button"
                        onClick={() => triggerUniversalLookup(searchQuery)}
                        className="px-3 py-1.5 rounded-xl bg-[#002147] text-white text-xs font-bold cursor-pointer"
                      >
                        “{searchQuery}” ကို အသေးစိတ် ပြန်ရှာမည်
                      </button>
                    )}
                  </div>
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
                    className={`w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center justify-between gap-2 cursor-pointer ${
                      isSelected
                        ? 'bg-[#002147] text-white shadow-xs'
                        : 'hover:bg-slate-200/60 dark:hover:bg-slate-800/70 text-slate-800 dark:text-slate-100'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-extrabold truncate">
                          {entry.en}
                        </span>
                        <span
                          className={`text-[10px] italic font-serif px-1.5 py-0.2 rounded shrink-0 ${
                            isSelected
                              ? 'bg-white/15 text-amber-200'
                              : 'bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {entry.pos}
                        </span>
                      </div>
                      <p
                        className={`text-xs mt-0.5 truncate ${
                          isSelected
                            ? 'text-slate-200 font-medium'
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

          {/* Right Panel: Authentic Oxford Learner's Dictionary Entry View */}
          <div className="md:col-span-8 overflow-y-auto p-4 sm:p-6 space-y-5 bg-white dark:bg-slate-900">
            {!searchQuery.trim() && selectedEntry?.id === wordOfTheDay.id && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/50 border border-amber-200/80 dark:border-amber-800/50 text-[11px] font-bold text-amber-800 dark:text-amber-300">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Word of the Day • ယနေ့အတွက် မှတ်သားဖွယ် ဝေါဟာရ</span>
              </div>
            )}

            {selectedEntry && activeOxfordData && (
              <div className="space-y-5">
                {/* OXFORD HEADWORD BLOCK */}
                <div className="pb-4 border-b-2 border-[#002147]/15 dark:border-slate-800 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-baseline gap-3 flex-wrap">
                        <h1 className="text-2xl sm:text-4xl font-black text-[#002147] dark:text-white tracking-tight">
                          {activeOxfordData.headword}
                        </h1>
                        <span className="text-sm sm:text-base italic font-serif font-semibold text-slate-600 dark:text-slate-300">
                          {activeOxfordData.primaryPos}
                        </span>
                        {activeOxfordData.cefrLevel && (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#002147] text-amber-300 text-[11px] font-black tracking-wider uppercase shadow-2xs"
                            title="Oxford 3000 / CEFR Vocabulary Level"
                          >
                            <KeyRound className="w-3 h-3" />
                            <span>{activeOxfordData.cefrLevel}</span>
                          </span>
                        )}
                      </div>

                      {activeOxfordData.isMyanmarSearch && (
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                          ရှာဖွေထားသော မြန်မာစာလုံး:{' '}
                          <span className="text-[#002147] dark:text-amber-300 font-bold">
                            “{activeOxfordData.searchedQuery}”
                          </span>
                        </p>
                      )}
                    </div>

                    {/* Save & Copy Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleSaveWord(selectedEntry)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                          savedIds.includes(selectedEntry.id)
                            ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200/70'
                        }`}
                      >
                        <Star
                          className={`w-3.5 h-3.5 ${
                            savedIds.includes(selectedEntry.id)
                              ? 'fill-current text-amber-500'
                              : ''
                          }`}
                        />
                        <span>
                          {savedIds.includes(selectedEntry.id) ? 'မှတ်ပြီး' : 'မှတ်မည်'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCopyEntry(selectedEntry, activeOxfordData)}
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

                  {/* OXFORD BrE & NAmE PHONETICS & AUDIO BAR */}
                  <div className="flex flex-wrap items-center gap-2.5 pt-1">
                    {/* British English (BrE) */}
                    <button
                      type="button"
                      onClick={() =>
                        playPronunciation(
                          activeOxfordData.headword,
                          'en-GB',
                          activeOxfordData.audioBrE
                        )
                      }
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-sky-50 dark:bg-sky-950/50 hover:bg-sky-100 dark:hover:bg-sky-900/70 border border-sky-200/80 dark:border-sky-800/60 transition-colors cursor-pointer group"
                      title="British English အသံထွက် နားထောင်ရန်"
                    >
                      <span className="px-1.5 py-0.5 rounded bg-[#002147] text-white text-[10px] font-black tracking-wider">
                        BrE
                      </span>
                      <Volume2 className="w-4 h-4 text-[#002147] dark:text-sky-300 group-hover:scale-110 transition-transform" />
                      <span className="text-xs sm:text-sm font-mono font-semibold text-slate-700 dark:text-slate-200">
                        {activeOxfordData.phoneticBrE}
                      </span>
                    </button>

                    {/* North American English (NAmE) */}
                    <button
                      type="button"
                      onClick={() =>
                        playPronunciation(
                          activeOxfordData.headword,
                          'en-US',
                          activeOxfordData.audioNAmE
                        )
                      }
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-50/80 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200/80 dark:border-rose-800/60 transition-colors cursor-pointer group"
                      title="North American English အသံထွက် နားထောင်ရန်"
                    >
                      <span className="px-1.5 py-0.5 rounded bg-rose-700 text-white text-[10px] font-black tracking-wider">
                        NAmE
                      </span>
                      <Volume2 className="w-4 h-4 text-rose-700 dark:text-rose-300 group-hover:scale-110 transition-transform" />
                      <span className="text-xs sm:text-sm font-mono font-semibold text-slate-700 dark:text-slate-200">
                        {activeOxfordData.phoneticNAmE}
                      </span>
                    </button>

                    {isEnrichingSelected && (
                      <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Oxford အသေးစိတ်အချက်အလက် ရယူနေသည်...
                      </span>
                    )}
                  </div>
                </div>

                {/* PRIMARY MYANMAR MEANING BANNER */}
                <div className="rounded-2xl p-4 sm:p-5 bg-gradient-to-br from-[#002147]/[0.04] to-amber-500/[0.06] dark:from-slate-800/90 dark:to-slate-800/50 border-l-4 border-[#002147] dark:border-amber-400 space-y-1.5">
                  <div className="text-[11px] font-extrabold text-[#002147] dark:text-amber-300 uppercase tracking-wider">
                    မြန်မာ အဓိပ္ပာယ် (Myanmar Meaning)
                  </div>
                  <div className="text-base sm:text-xl font-extrabold text-slate-900 dark:text-white leading-relaxed">
                    {activeOxfordData.primaryMyanmarMeaning}
                  </div>
                </div>

                {/* OXFORD MULTI-POS MEANING GROUPS & NUMBERED SENSES */}
                <div className="space-y-6">
                  {activeOxfordData.meaningGroups.map((group, groupIdx) => (
                    <div
                      key={`${group.partOfSpeech}-${groupIdx}`}
                      className="space-y-3.5"
                    >
                      {/* Oxford POS Section Header Bar */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-xs bg-[#002147] dark:bg-amber-400 shrink-0" />
                          <span className="text-sm sm:text-base font-black italic font-serif text-[#002147] dark:text-amber-300">
                            {group.partOfSpeech}
                          </span>
                          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                            — {group.posMm}
                          </span>
                        </div>

                        {/* Myanmar Equivalents for this specific Part of Speech */}
                        {group.mmTerms.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {group.mmTerms.slice(0, 5).map((term) => (
                              <span
                                key={term}
                                className="px-2.5 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/70 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs font-bold"
                              >
                                {term}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Numbered Senses (1, 2, 3...) in Oxford Style */}
                      <div className="space-y-4 pl-1 sm:pl-2">
                        {group.senses.map((sense) => (
                          <div
                            key={sense.senseNumber}
                            className="flex items-start gap-3"
                          >
                            {/* Sense Number Badge */}
                            <span className="w-6 h-6 rounded-md bg-[#002147] dark:bg-slate-800 text-white dark:text-amber-300 text-xs font-black flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                              {sense.senseNumber}
                            </span>

                            <div className="flex-1 min-w-0 space-y-2">
                              {/* English Definition */}
                              <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 leading-relaxed">
                                {sense.definitionEn}
                              </p>

                              {/* Sense Myanmar Meaning */}
                              {sense.definitionMm && (
                                <p className="text-xs sm:text-sm font-bold text-emerald-700 dark:text-emerald-400 leading-relaxed">
                                  ▸ {sense.definitionMm}
                                </p>
                              )}

                              {/* Oxford Bullet Example Sentence */}
                              {sense.exampleEn && (
                                <div className="pl-3 border-l-2 border-slate-300 dark:border-slate-700 space-y-1 py-0.5">
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="text-xs sm:text-sm italic font-serif text-slate-700 dark:text-slate-300 leading-relaxed">
                                      • “{sense.exampleEn}”
                                    </p>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        playPronunciation(
                                          sense.exampleEn!,
                                          'en-GB'
                                        )
                                      }
                                      className="p-1 rounded-lg text-slate-400 hover:text-[#002147] dark:hover:text-amber-300 shrink-0 cursor-pointer"
                                      title="ဥပမာဝါကျ အသံထွက် နားထောင်ရန်"
                                    >
                                      <Volume2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                  {sense.exampleMm && (
                                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                      {sense.exampleMm}
                                    </p>
                                  )}
                                </div>
                              )}

                              {/* Sense-level SYN / OPP Pills */}
                              {((sense.synonyms && sense.synonyms.length > 0) ||
                                (sense.antonyms && sense.antonyms.length > 0)) && (
                                <div className="flex flex-wrap items-center gap-2 pt-1">
                                  {sense.synonyms &&
                                    sense.synonyms.map((syn) => (
                                      <button
                                        key={syn}
                                        type="button"
                                        onClick={() => handleSelectWordJump(syn)}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 text-[11px] font-semibold cursor-pointer transition-colors"
                                      >
                                        <span className="font-black text-[9px] uppercase px-1 rounded bg-indigo-200/70 dark:bg-indigo-900">
                                          SYN
                                        </span>
                                        <span>{syn}</span>
                                      </button>
                                    ))}
                                  {sense.antonyms &&
                                    sense.antonyms.map((ant) => (
                                      <button
                                        key={ant}
                                        type="button"
                                        onClick={() => handleSelectWordJump(ant)}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-700 dark:text-rose-300 text-[11px] font-semibold cursor-pointer transition-colors"
                                      >
                                        <span className="font-black text-[9px] uppercase px-1 rounded bg-rose-200/70 dark:bg-rose-900">
                                          OPP
                                        </span>
                                        <span>{ant}</span>
                                      </button>
                                    ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* OXFORD THESAURUS / WORD BANK (Overall Synonyms & Antonyms) */}
                {(activeOxfordData.allSynonyms.length > 0 ||
                  activeOxfordData.allAntonyms.length > 0) && (
                  <div className="rounded-2xl p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-3">
                    <div className="text-[11px] font-black text-[#002147] dark:text-amber-300 uppercase tracking-wider">
                      Oxford Word Bank • ဆက်စပ် ဝေါဟာရများ (နှိပ်၍ တိုက်ရိုက်ကြည့်နိုင်သည်)
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {activeOxfordData.allSynonyms.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 rounded bg-indigo-600 text-white text-[10px] font-black uppercase">
                              SYN
                            </span>
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                              အဓိပ္ပာယ်တူ (Synonyms)
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {activeOxfordData.allSynonyms.map((syn) => (
                              <button
                                key={syn}
                                type="button"
                                onClick={() => handleSelectWordJump(syn)}
                                className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-[#002147] dark:hover:border-amber-400 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-[#002147] dark:hover:text-amber-300 cursor-pointer transition-colors"
                              >
                                {syn}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {activeOxfordData.allAntonyms.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[10px] font-black uppercase">
                              OPP
                            </span>
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                              ဆန့်ကျင်ဘက် (Opposites)
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {activeOxfordData.allAntonyms.map((ant) => (
                              <button
                                key={ant}
                                type="button"
                                onClick={() => handleSelectWordJump(ant)}
                                className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-rose-500 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-rose-600 cursor-pointer transition-colors"
                              >
                                {ant}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
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
