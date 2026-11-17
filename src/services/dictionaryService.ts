import { EN_MM_DICTIONARY, DictionaryEntry } from '../data/enMmDictionary';
import { EXTRA_EN_MM_ENTRIES } from '../data/enMmExtraLexicon';
import { CORE_EN_MM_LEXICON } from '../data/coreEnMmLexicon';

const LIVE_CACHE_STORAGE_KEY = 'swanarh_dict_live_cache_v2';

// Deduplicate all static entries by lowercase English headword (preserving curated entries first)
function buildMasterStaticList(): DictionaryEntry[] {
  const seen = new Set<string>();
  const combined = [
    ...EN_MM_DICTIONARY,
    ...EXTRA_EN_MM_ENTRIES,
    ...CORE_EN_MM_LEXICON,
  ];
  const unique: DictionaryEntry[] = [];
  for (const item of combined) {
    const key = item.en.trim().toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }
  return unique.sort((a, b) => a.en.localeCompare(b.en));
}

export const MASTER_STATIC_DICTIONARY: DictionaryEntry[] = buildMasterStaticList();

export function containsMyanmarScript(text: string): boolean {
  return /[\u1000-\u109F\uAA60-\uAA7F]/.test(text);
}

// Common irregular English forms -> base lemma
const IRREGULAR_LEMMAS: Record<string, string> = {
  went: 'go',
  gone: 'go',
  goes: 'go',
  going: 'go',
  did: 'do',
  done: 'do',
  does: 'do',
  doing: 'do',
  had: 'have',
  has: 'have',
  having: 'have',
  was: 'be',
  were: 'be',
  been: 'be',
  am: 'be',
  is: 'be',
  are: 'be',
  wrote: 'write',
  written: 'write',
  writing: 'write',
  spoke: 'speak',
  spoken: 'speak',
  speaking: 'speak',
  took: 'take',
  taken: 'take',
  taking: 'take',
  gave: 'give',
  given: 'give',
  giving: 'give',
  saw: 'see',
  seen: 'see',
  seeing: 'see',
  knew: 'know',
  known: 'know',
  knowing: 'know',
  thought: 'think',
  thinking: 'think',
  taught: 'teach',
  teaching: 'teach',
  bought: 'buy',
  buying: 'buy',
  brought: 'bring',
  bringing: 'bring',
  built: 'build',
  building: 'build',
  caught: 'catch',
  chose: 'choose',
  chosen: 'choose',
  came: 'come',
  coming: 'come',
  found: 'find',
  finding: 'find',
  forgot: 'forget',
  forgotten: 'forget',
  forgave: 'forgive',
  forgiven: 'forgive',
  got: 'get',
  gotten: 'get',
  grew: 'grow',
  grown: 'grow',
  heard: 'hear',
  kept: 'keep',
  led: 'lead',
  left: 'leave',
  lost: 'lose',
  made: 'make',
  making: 'make',
  met: 'meet',
  paid: 'pay',
  put: 'put',
  ran: 'run',
  running: 'run',
  said: 'say',
  saying: 'say',
  sent: 'send',
  sat: 'sit',
  slept: 'sleep',
  spent: 'spend',
  stood: 'stand',
  told: 'tell',
  understood: 'understand',
  won: 'win',
  children: 'child',
  men: 'man',
  women: 'woman',
  people: 'person',
  teeth: 'tooth',
  feet: 'foot',
  lives: 'life',
  leaves: 'leaf',
};

export function getEnglishCandidateStems(rawWord: string): string[] {
  const w = rawWord.trim().toLowerCase();
  if (!w) return [];
  const stems = new Set<string>([w]);

  if (IRREGULAR_LEMMAS[w]) {
    stems.add(IRREGULAR_LEMMAS[w]);
  }

  if (w.length > 4 && w.endsWith('ies')) {
    stems.add(w.slice(0, -3) + 'y');
  }
  if (w.length > 4 && w.endsWith('es')) {
    stems.add(w.slice(0, -2));
    stems.add(w.slice(0, -1));
  }
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us')) {
    stems.add(w.slice(0, -1));
  }
  if (w.length > 5 && w.endsWith('ing')) {
    const base = w.slice(0, -3);
    stems.add(base);
    stems.add(base + 'e');
    if (base.length >= 3 && base[base.length - 1] === base[base.length - 2]) {
      stems.add(base.slice(0, -1));
    }
  }
  if (w.length > 4 && w.endsWith('ied')) {
    stems.add(w.slice(0, -3) + 'y');
  }
  if (w.length > 4 && w.endsWith('ed')) {
    const base = w.slice(0, -2);
    stems.add(base);
    stems.add(w.slice(0, -1));
    if (base.length >= 3 && base[base.length - 1] === base[base.length - 2]) {
      stems.add(base.slice(0, -1));
    }
  }
  if (w.length > 5 && w.endsWith('ly')) {
    stems.add(w.slice(0, -2));
    if (w.endsWith('ily')) {
      stems.add(w.slice(0, -3) + 'y');
    }
  }

  return Array.from(stems);
}

/**
 * Strict, accurate search over local dictionary entries.
 * NEVER matches random substrings inside definitions or example sentences.
 */
export function searchLocalDictionary(
  query: string,
  entries: DictionaryEntry[]
): { results: DictionaryEntry[]; hasExactMatch: boolean } {
  const q = query.trim().toLowerCase();
  if (!q) {
    return { results: entries, hasExactMatch: true };
  }

  const isMm = containsMyanmarScript(q);
  const candidateStems = isMm ? [q] : getEnglishCandidateStems(q);
  const scored: Array<{ entry: DictionaryEntry; score: number }> = [];
  let hasExactMatch = false;

  for (const entry of entries) {
    const enLower = entry.en.trim().toLowerCase();
    const mmClean = entry.mm.trim().toLowerCase();
    let score = 0;

    if (isMm) {
      // Split Myanmar meaning by Myanmar comma (၊), English comma, or slash
      const mmParts = mmClean
        .split(/[၊,/()]/)
        .map((p) => p.trim())
        .filter(Boolean);

      if (mmClean === q || mmParts.some((p) => p === q)) {
        score = 1000;
        hasExactMatch = true;
      } else if (mmParts.some((p) => p.startsWith(q))) {
        score = 900;
        if (q.length >= 3) hasExactMatch = true;
      } else if (mmClean.includes(q)) {
        score = 800;
      } else if (entry.mmDetail && entry.mmDetail.toLowerCase().includes(q) && q.length >= 4) {
        score = 600;
      }
    } else {
      // English query: ONLY match headwords, stems, headword prefixes, or exact synonyms!
      const enWords = enLower.split(/\s+/);
      const synonymsLower = (entry.synonyms || []).map((s) => s.toLowerCase().trim());

      if (enLower === q) {
        score = 1000;
        hasExactMatch = true;
      } else if (candidateStems.includes(enLower)) {
        score = 960;
        hasExactMatch = true;
      } else if (q.length >= 2 && enLower.startsWith(q)) {
        // Prefer shorter words that start with q (e.g., "good" -> "goodness" before "goodwill")
        score = 880 - Math.min(40, Math.max(0, enLower.length - q.length));
      } else if (enWords.some((w) => w === q || candidateStems.includes(w))) {
        score = 820;
        hasExactMatch = true;
      } else if (q.length >= 3 && enWords.some((w) => w.startsWith(q))) {
        score = 760;
      } else if (synonymsLower.some((s) => s === q || candidateStems.includes(s))) {
        score = 720;
      }
    }

    if (score > 0) {
      scored.push({ entry, score });
    }
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.entry.en.localeCompare(b.entry.en);
  });

  return {
    results: scored.map((item) => item.entry),
    hasExactMatch,
  };
}

// Memory + LocalStorage cache for live bilingual lookups
const memoryLookupCache = new Map<string, DictionaryEntry>();

function loadCachedLiveEntries(): Record<string, DictionaryEntry> {
  try {
    const raw = localStorage.getItem(LIVE_CACHE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCachedLiveEntry(key: string, entry: DictionaryEntry): void {
  memoryLookupCache.set(key, entry);
  try {
    const current = loadCachedLiveEntries();
    current[key] = entry;
    // Keep most recent 150 cached lookups
    const keys = Object.keys(current);
    if (keys.length > 150) {
      delete current[keys[0]];
    }
    localStorage.setItem(LIVE_CACHE_STORAGE_KEY, JSON.stringify(current));
  } catch {
    // ignore storage errors
  }
}

function mapPosAbbreviation(rawPos: string): string {
  const p = rawPos.toLowerCase().trim();
  if (p === 'noun') return 'n.';
  if (p === 'verb') return 'v.';
  if (p === 'adjective') return 'adj.';
  if (p === 'adverb') return 'adv.';
  if (p === 'preposition') return 'prep.';
  if (p === 'conjunction') return 'conj.';
  if (p === 'pronoun') return 'pron.';
  if (p === 'interjection') return 'interj.';
  return rawPos || 'n.';
}

/**
 * Live Bilingual English ⇄ Myanmar & Myanmar ⇄ English lookup for ANY word or phrase.
 * Combines Google GTX Bilingual Dictionary (`dt=t&dt=bd&dt=md&dt=ex&dt=ss`) +
 * Free English Dictionary API (`api.dictionaryapi.dev`) for phonetics, definitions, and examples.
 * Uses 0 Bytes of Supabase Database or Egress.
 */
export async function lookupLiveBilingualWord(
  rawQuery: string
): Promise<DictionaryEntry | null> {
  const query = rawQuery.trim();
  if (!query || query.length < 1) return null;

  const cacheKey = query.toLowerCase();
  if (memoryLookupCache.has(cacheKey)) {
    return memoryLookupCache.get(cacheKey)!;
  }

  const storedCache = loadCachedLiveEntries();
  if (storedCache[cacheKey]) {
    memoryLookupCache.set(cacheKey, storedCache[cacheKey]);
    return storedCache[cacheKey];
  }

  const isMmQuery = containsMyanmarScript(query);
  const sourceLang = isMmQuery ? 'my' : 'en';
  const targetLang = isMmQuery ? 'en' : 'my';

  try {
    const gtxUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&dt=bd&dt=md&dt=ex&dt=ss&q=${encodeURIComponent(
      query
    )}`;

    const gtxRes = await fetch(gtxUrl);
    if (!gtxRes.ok) {
      return null;
    }

    const gtxData = await gtxRes.json();

    // 1. Primary translation from data[0]
    let primaryTranslation = '';
    if (Array.isArray(gtxData?.[0])) {
      primaryTranslation = gtxData[0]
        .map((segment: unknown) => (Array.isArray(segment) ? segment[0] : ''))
        .join('')
        .trim();
    }

    // 2. Bilingual Dictionary breakdown by Part of Speech from data[1]
    const posGroups: Array<{ pos: string; terms: string[]; reverseTerms: string[] }> = [];
    if (Array.isArray(gtxData?.[1])) {
      for (const group of gtxData[1]) {
        if (Array.isArray(group)) {
          const posName = typeof group[0] === 'string' ? mapPosAbbreviation(group[0]) : '';
          const terms = Array.isArray(group[1])
            ? group[1].filter((t: unknown) => typeof t === 'string').slice(0, 6)
            : [];
          const reverseTerms: string[] = [];
          if (Array.isArray(group[2])) {
            for (const entryDetail of group[2].slice(0, 4)) {
              if (Array.isArray(entryDetail) && Array.isArray(entryDetail[1])) {
                for (const rev of entryDetail[1].slice(0, 3)) {
                  if (typeof rev === 'string' && !reverseTerms.includes(rev)) {
                    reverseTerms.push(rev);
                  }
                }
              }
            }
          }
          if (terms.length > 0) {
            posGroups.push({ pos: posName, terms, reverseTerms });
          }
        }
      }
    }

    // Determine English headword and Myanmar meaning
    let enHeadword = isMmQuery ? primaryTranslation : query;
    let mmMeaning = isMmQuery ? query : primaryTranslation;

    if (isMmQuery && posGroups.length > 0 && posGroups[0].terms.length > 0) {
      // For Myanmar -> English, show the best English words clearly
      const topEnglishWords = posGroups[0].terms.slice(0, 3);
      enHeadword = topEnglishWords[0] || primaryTranslation;
    }

    if (!isMmQuery && posGroups.length > 0) {
      // Combine the top Myanmar meanings across parts of speech
      const allMmTerms: string[] = [];
      if (primaryTranslation && !allMmTerms.includes(primaryTranslation)) {
        allMmTerms.push(primaryTranslation);
      }
      for (const g of posGroups) {
        for (const t of g.terms.slice(0, 4)) {
          if (!allMmTerms.includes(t)) {
            allMmTerms.push(t);
          }
        }
      }
      mmMeaning = allMmTerms.slice(0, 6).join('၊ ');
    }

    // Build detailed breakdown in Myanmar/English (`mmDetail`)
    let mmDetail = '';
    if (posGroups.length > 0) {
      mmDetail = posGroups
        .map((g) => `(${g.pos}) ${g.terms.slice(0, 5).join('၊ ')}`)
        .join('  •  ');
    }

    // Check if the resolved English headword already exists in our curated static dictionary!
    if (isMmQuery && enHeadword) {
      const existingStatic = MASTER_STATIC_DICTIONARY.find(
        (item) => item.en.toLowerCase() === enHeadword.toLowerCase()
      );
      if (existingStatic) {
        const enrichedStatic: DictionaryEntry = {
          ...existingStatic,
          mm: existingStatic.mm.includes(query)
            ? existingStatic.mm
            : `${query} — ${existingStatic.mm}`,
          mmDetail: mmDetail || existingStatic.mmDetail,
        };
        saveCachedLiveEntry(cacheKey, enrichedStatic);
        return enrichedStatic;
      }
    }

    // 3. Fetch English Phonetics, Definition, Example, and Synonyms from Free Dictionary API
    let phonetic = '';
    let pos = posGroups[0]?.pos || 'n.';
    let enDef = '';
    let exampleEn = '';
    const synonymsSet = new Set<string>();
    const antonymsSet = new Set<string>();

    // Collect reverse English synonyms from GTX data[1]
    for (const g of posGroups) {
      if (isMmQuery) {
        for (const t of g.terms.slice(1, 6)) {
          synonymsSet.add(t);
        }
      } else {
        for (const rev of g.reverseTerms) {
          if (rev.toLowerCase() !== enHeadword.toLowerCase()) {
            synonymsSet.add(rev);
          }
        }
      }
    }

    const cleanEnglishWord = enHeadword.trim().toLowerCase();
    if (cleanEnglishWord && !containsMyanmarScript(cleanEnglishWord) && !cleanEnglishWord.includes(' ')) {
      try {
        const dictRes = await fetch(
          `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanEnglishWord)}`
        );
        if (dictRes.ok) {
          const dictData = await dictRes.json();
          const firstEntry = Array.isArray(dictData) ? dictData[0] : null;
          if (firstEntry) {
            phonetic =
              firstEntry.phonetic ||
              firstEntry.phonetics?.find((p: { text?: string }) => Boolean(p?.text))?.text ||
              '';
            if (Array.isArray(firstEntry.meanings) && firstEntry.meanings.length > 0) {
              const firstMeaning = firstEntry.meanings[0];
              if (firstMeaning.partOfSpeech) {
                pos = mapPosAbbreviation(firstMeaning.partOfSpeech);
              }
              const defs = firstMeaning.definitions || [];
              if (defs[0]?.definition) {
                enDef = defs[0].definition;
              }
              const defWithEx = defs.find((d: { example?: string }) => Boolean(d?.example));
              if (defWithEx?.example) {
                exampleEn = defWithEx.example;
              }
              for (const m of firstEntry.meanings) {
                for (const s of m.synonyms || []) {
                  if (typeof s === 'string' && synonymsSet.size < 8) synonymsSet.add(s);
                }
                for (const a of m.antonyms || []) {
                  if (typeof a === 'string' && antonymsSet.size < 6) antonymsSet.add(a);
                }
              }
            }
          }
        }
      } catch {
        // Ignore dictionaryapi errors; GTX translation is already available
      }
    }

    // 4. If we have an English example sentence, translate it to Myanmar for bilingual context
    let exampleMm = '';
    if (!exampleEn) {
      exampleEn = `Please check the usage and meaning of "${enHeadword}".`;
      exampleMm = `“${enHeadword}” ၏ အဓိပ္ပာယ်မှာ “${mmMeaning}” ဖြစ်ပါသည်။`;
    } else {
      try {
        const exUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=my&dt=t&q=${encodeURIComponent(
          exampleEn
        )}`;
        const exRes = await fetch(exUrl);
        if (exRes.ok) {
          const exData = await exRes.json();
          if (Array.isArray(exData?.[0])) {
            exampleMm = exData[0]
              .map((seg: unknown) => (Array.isArray(seg) ? seg[0] : ''))
              .join('')
              .trim();
          }
        }
      } catch {
        // ignore
      }
      if (!exampleMm) {
        exampleMm = `${mmMeaning}`;
      }
    }

    if (!enDef) {
      enDef = isMmQuery
        ? `English equivalent for "${query}": ${
            posGroups.length > 0
              ? posGroups.map((g) => g.terms.slice(0, 4).join(', ')).join('; ')
              : enHeadword
          }.`
        : `Meaning of "${enHeadword}": ${mmMeaning}.`;
    }

    const liveEntry: DictionaryEntry = {
      id: `live-${cacheKey.replace(/[^a-z0-9\u1000-\u109F]/gi, '-')}`,
      en: enHeadword,
      phonetic: phonetic || undefined,
      pos: pos || 'n.',
      mm: mmMeaning || primaryTranslation,
      mmDetail: mmDetail || undefined,
      enDef,
      exampleEn,
      exampleMm,
      synonyms: Array.from(synonymsSet).slice(0, 6),
      antonyms: Array.from(antonymsSet).slice(0, 6),
      category: 'general',
    };

    saveCachedLiveEntry(cacheKey, liveEntry);
    return liveEntry;
  } catch {
    return null;
  }
}
