import { EN_MM_DICTIONARY, DictionaryEntry } from '../data/enMmDictionary';
import { EXTRA_EN_MM_ENTRIES } from '../data/enMmExtraLexicon';
import { CORE_EN_MM_LEXICON } from '../data/coreEnMmLexicon';

const OXFORD_CACHE_STORAGE_KEY = 'swanarh_oxford_dict_cache_v3';

export interface OxfordSense {
  senseNumber: number;
  definitionEn: string;
  definitionMm?: string;
  exampleEn?: string;
  exampleMm?: string;
  synonyms?: string[];
  antonyms?: string[];
}

export interface OxfordMeaningGroup {
  partOfSpeech: string; // e.g. "noun", "verb", "adjective"
  posAbbrev: string; // e.g. "n.", "v.", "adj."
  posMm: string; // e.g. "နာမ် (Noun)", "ကြိယာ (Verb)"
  mmTerms: string[]; // Bilingual Myanmar equivalents for this POS
  senses: OxfordSense[];
  synonyms: string[];
  antonyms: string[];
}

export interface OxfordDictionaryData {
  headword: string;
  searchedQuery: string;
  isMyanmarSearch: boolean;
  phoneticBrE: string;
  phoneticNAmE: string;
  audioBrE?: string;
  audioNAmE?: string;
  primaryPos: string;
  cefrLevel?: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  primaryMyanmarMeaning: string;
  englishOverviewDef: string;
  meaningGroups: OxfordMeaningGroup[];
  allSynonyms: string[];
  allAntonyms: string[];
  wordForms?: string[];
}

// Deduplicate all static entries by lowercase English headword
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
  better: 'good',
  best: 'good',
  worse: 'bad',
  worst: 'bad',
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

export function mapPosInfo(rawPos: string): {
  full: string;
  abbrev: string;
  mm: string;
} {
  const p = rawPos.toLowerCase().trim().replace(/\.$/, '');
  if (p === 'noun' || p === 'n') {
    return { full: 'noun', abbrev: 'n.', mm: 'နာမ် (Noun)' };
  }
  if (p === 'verb' || p === 'v') {
    return { full: 'verb', abbrev: 'v.', mm: 'ကြိယာ (Verb)' };
  }
  if (p === 'adjective' || p === 'adj') {
    return { full: 'adjective', abbrev: 'adj.', mm: 'နာမဝိသေသန (Adjective)' };
  }
  if (p === 'adverb' || p === 'adv') {
    return { full: 'adverb', abbrev: 'adv.', mm: 'ကြိယာဝိသေသန (Adverb)' };
  }
  if (p === 'preposition' || p === 'prep') {
    return { full: 'preposition', abbrev: 'prep.', mm: 'ဝိဘတ် (Preposition)' };
  }
  if (p === 'conjunction' || p === 'conj') {
    return { full: 'conjunction', abbrev: 'conj.', mm: 'သမ္ဗန္ဓ (Conjunction)' };
  }
  if (p === 'pronoun' || p === 'pron') {
    return { full: 'pronoun', abbrev: 'pron.', mm: 'နာမ်စား (Pronoun)' };
  }
  if (p === 'interjection' || p === 'interj' || p === 'exclamation') {
    return { full: 'exclamation', abbrev: 'excl.', mm: 'အာမေဍိတ် (Exclamation)' };
  }
  if (p.includes('phr')) {
    return { full: 'phrasal verb', abbrev: 'phr.v.', mm: 'တွဲဖက်ကြိယာ (Phrasal Verb)' };
  }
  if (p.includes('idiom')) {
    return { full: 'idiom', abbrev: 'idiom', mm: 'အီဒီယမ် စကားပုံ (Idiom)' };
  }
  return { full: rawPos || 'noun', abbrev: rawPos || 'n.', mm: 'ဝေါဟာရ' };
}

export function estimateCefrLevel(word: string, category?: string): 'A1' | 'A2' | 'B1' | 'B2' | 'C1' {
  const w = word.trim().toLowerCase();
  if (category === 'civil_service' || category === 'academic') {
    return w.length >= 10 ? 'C1' : 'B2';
  }
  if (w.length <= 4) return 'A1';
  if (w.length <= 6) return 'A2';
  if (w.length <= 8) return 'B1';
  if (w.length <= 10) return 'B2';
  return 'C1';
}

/**
 * Convert a local static DictionaryEntry into rich OxfordDictionaryData
 */
export function convertStaticToOxfordData(entry: DictionaryEntry): OxfordDictionaryData {
  const posParts = entry.pos.split('/').map((s) => s.trim());
  const firstPos = mapPosInfo(posParts[0] || 'noun');
  const phonetic = entry.phonetic || `/${entry.en.toLowerCase()}/`;

  return {
    headword: entry.en,
    searchedQuery: entry.en,
    isMyanmarSearch: false,
    phoneticBrE: phonetic,
    phoneticNAmE: phonetic,
    primaryPos: posParts.map((p) => mapPosInfo(p).full).join(', '),
    cefrLevel: estimateCefrLevel(entry.en, entry.category),
    primaryMyanmarMeaning: entry.mm,
    englishOverviewDef: entry.enDef,
    meaningGroups: [
      {
        partOfSpeech: firstPos.full,
        posAbbrev: firstPos.abbrev,
        posMm: firstPos.mm,
        mmTerms: entry.mm
          .split(/[၊,]/)
          .map((t) => t.trim())
          .filter(Boolean),
        senses: [
          {
            senseNumber: 1,
            definitionEn: entry.enDef,
            definitionMm: entry.mmDetail || entry.mm,
            exampleEn: entry.exampleEn,
            exampleMm: entry.exampleMm,
            synonyms: entry.synonyms,
            antonyms: entry.antonyms,
          },
        ],
        synonyms: entry.synonyms || [],
        antonyms: entry.antonyms || [],
      },
    ],
    allSynonyms: entry.synonyms || [],
    allAntonyms: entry.antonyms || [],
  };
}

/**
 * Strict, accurate search over local dictionary entries (Zero false positives)
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
      const enWords = enLower.split(/\s+/);
      const synonymsLower = (entry.synonyms || []).map((s) => s.toLowerCase().trim());

      if (enLower === q) {
        score = 1000;
        hasExactMatch = true;
      } else if (candidateStems.includes(enLower)) {
        score = 960;
        hasExactMatch = true;
      } else if (q.length >= 2 && enLower.startsWith(q)) {
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

// Memory + LocalStorage cache for full Oxford dictionary lookups
const oxfordMemoryCache = new Map<string, OxfordDictionaryData>();

function loadOxfordStoredCache(): Record<string, OxfordDictionaryData> {
  try {
    const raw = localStorage.getItem(OXFORD_CACHE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveOxfordStoredCache(key: string, data: OxfordDictionaryData): void {
  oxfordMemoryCache.set(key, data);
  try {
    const current = loadOxfordStoredCache();
    current[key] = data;
    const keys = Object.keys(current);
    if (keys.length > 120) {
      delete current[keys[0]];
    }
    localStorage.setItem(OXFORD_CACHE_STORAGE_KEY, JSON.stringify(current));
  } catch {
    // ignore
  }
}

/**
 * Fetch fast live autocomplete word suggestions for ANY English prefix (using Datamuse free API)
 */
export async function fetchWordSuggestions(prefix: string): Promise<string[]> {
  const q = prefix.trim().toLowerCase();
  if (!q || q.length < 2 || containsMyanmarScript(q)) return [];
  try {
    const res = await fetch(
      `https://api.datamuse.com/sug?s=${encodeURIComponent(q)}&max=8`
    );
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data
      .map((item: { word?: string }) => (typeof item?.word === 'string' ? item.word : ''))
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Full Oxford-Style Deep Lookup for ANY English or Myanmar word/phrase!
 * Combines:
 * 1. Curated Static Entry (if matched)
 * 2. Google GTX Bilingual Dictionary (`dt=t&dt=bd&dt=md&dt=ex&dt=ss&dt=at`)
 * 3. Free English Dictionary API (`api.dictionaryapi.dev`) for multi-POS, numbered senses, BrE/NAmE IPA phonetics, and native audio MP3s!
 */
export async function fetchOxfordDictionaryEntry(
  rawQuery: string
): Promise<{ oxfordData: OxfordDictionaryData; summaryEntry: DictionaryEntry } | null> {
  const query = rawQuery.trim();
  if (!query) return null;

  const cacheKey = query.toLowerCase();
  const existingStatic = MASTER_STATIC_DICTIONARY.find(
    (item) => item.en.toLowerCase() === cacheKey
  );

  if (oxfordMemoryCache.has(cacheKey)) {
    const cached = oxfordMemoryCache.get(cacheKey)!;
    return {
      oxfordData: cached,
      summaryEntry: existingStatic || {
        id: `oxford-${cacheKey.replace(/[^a-z0-9\u1000-\u109F]/gi, '-')}`,
        en: cached.headword,
        phonetic: cached.phoneticBrE,
        pos: mapPosInfo(cached.primaryPos.split(',')[0] || 'noun').abbrev,
        mm: cached.primaryMyanmarMeaning,
        enDef: cached.englishOverviewDef,
        exampleEn:
          cached.meaningGroups[0]?.senses[0]?.exampleEn ||
          `Example usage of "${cached.headword}".`,
        exampleMm:
          cached.meaningGroups[0]?.senses[0]?.exampleMm ||
          cached.primaryMyanmarMeaning,
        synonyms: cached.allSynonyms,
        antonyms: cached.allAntonyms,
        category: 'general',
      },
    };
  }

  const stored = loadOxfordStoredCache();
  if (stored[cacheKey]) {
    const cached = stored[cacheKey];
    oxfordMemoryCache.set(cacheKey, cached);
    return {
      oxfordData: cached,
      summaryEntry: existingStatic || {
        id: `oxford-${cacheKey.replace(/[^a-z0-9\u1000-\u109F]/gi, '-')}`,
        en: cached.headword,
        phonetic: cached.phoneticBrE,
        pos: mapPosInfo(cached.primaryPos.split(',')[0] || 'noun').abbrev,
        mm: cached.primaryMyanmarMeaning,
        enDef: cached.englishOverviewDef,
        exampleEn:
          cached.meaningGroups[0]?.senses[0]?.exampleEn ||
          `Example usage of "${cached.headword}".`,
        exampleMm:
          cached.meaningGroups[0]?.senses[0]?.exampleMm ||
          cached.primaryMyanmarMeaning,
        synonyms: cached.allSynonyms,
        antonyms: cached.allAntonyms,
        category: 'general',
      },
    };
  }

  const isMmQuery = containsMyanmarScript(query);
  const sourceLang = isMmQuery ? 'my' : 'en';
  const targetLang = isMmQuery ? 'en' : 'my';

  try {
    // Step 1: Query Google GTX Bilingual Dictionary (`dt=t&dt=bd&dt=md&dt=ex&dt=ss&dt=at`)
    const gtxUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&dt=bd&dt=md&dt=ex&dt=ss&dt=at&q=${encodeURIComponent(
      query
    )}`;

    const gtxRes = await fetch(gtxUrl);
    let primaryTranslation = '';
    const gtxPosMap = new Map<
      string,
      { terms: string[]; reverseTerms: string[] }
    >();

    if (gtxRes.ok) {
      const gtxData = await gtxRes.json();

      if (Array.isArray(gtxData?.[0])) {
        primaryTranslation = gtxData[0]
          .map((seg: unknown) => (Array.isArray(seg) ? seg[0] : ''))
          .join('')
          .trim();
      }

      if (Array.isArray(gtxData?.[1])) {
        for (const group of gtxData[1]) {
          if (Array.isArray(group)) {
            const posInfo = mapPosInfo(typeof group[0] === 'string' ? group[0] : 'noun');
            const terms = Array.isArray(group[1])
              ? group[1].filter((t: unknown) => typeof t === 'string').slice(0, 8)
              : [];
            const reverseTerms: string[] = [];
            if (Array.isArray(group[2])) {
              for (const detail of group[2].slice(0, 5)) {
                if (Array.isArray(detail) && Array.isArray(detail[1])) {
                  for (const rev of detail[1].slice(0, 4)) {
                    if (typeof rev === 'string' && !reverseTerms.includes(rev)) {
                      reverseTerms.push(rev);
                    }
                  }
                }
              }
            }
            if (terms.length > 0) {
              gtxPosMap.set(posInfo.full, { terms, reverseTerms });
            }
          }
        }
      }
    }

    // Determine the canonical English headword and primary Myanmar meaning
    let enHeadword = isMmQuery ? primaryTranslation : query;
    if (isMmQuery && gtxPosMap.size > 0) {
      const firstGroup = Array.from(gtxPosMap.values())[0];
      if (firstGroup.terms[0]) {
        enHeadword = firstGroup.terms[0];
      }
    }
    if (!enHeadword) {
      enHeadword = query;
    }

    // Check if the resolved English headword matches one of our curated static entries
    const matchedCurated =
      existingStatic ||
      MASTER_STATIC_DICTIONARY.find(
        (item) => item.en.toLowerCase() === enHeadword.trim().toLowerCase()
      );

    // If it was a Myanmar query, also fetch English -> Myanmar GTX for the resolved English headword so we get full Myanmar POS breakdowns!
    if (isMmQuery && enHeadword && !containsMyanmarScript(enHeadword)) {
      try {
        const revUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=my&dt=t&dt=bd&q=${encodeURIComponent(
          enHeadword
        )}`;
        const revRes = await fetch(revUrl);
        if (revRes.ok) {
          const revData = await revRes.json();
          if (Array.isArray(revData?.[1])) {
            gtxPosMap.clear();
            for (const group of revData[1]) {
              if (Array.isArray(group)) {
                const posInfo = mapPosInfo(typeof group[0] === 'string' ? group[0] : 'noun');
                const terms = Array.isArray(group[1])
                  ? group[1].filter((t: unknown) => typeof t === 'string').slice(0, 8)
                  : [];
                const reverseTerms: string[] = [];
                if (Array.isArray(group[2])) {
                  for (const detail of group[2].slice(0, 5)) {
                    if (Array.isArray(detail) && Array.isArray(detail[1])) {
                      for (const rev of detail[1].slice(0, 4)) {
                        if (typeof rev === 'string' && !reverseTerms.includes(rev)) {
                          reverseTerms.push(rev);
                        }
                      }
                    }
                  }
                }
                if (terms.length > 0) {
                  gtxPosMap.set(posInfo.full, { terms, reverseTerms });
                }
              }
            }
          }
        }
      } catch {
        // ignore
      }
    }

    // Build primary Myanmar meaning string
    let primaryMyanmarMeaning = matchedCurated?.mm || '';
    if (!primaryMyanmarMeaning) {
      const allMmTerms: string[] = [];
      if (isMmQuery) {
        allMmTerms.push(query);
      } else if (primaryTranslation) {
        allMmTerms.push(primaryTranslation);
      }
      for (const g of gtxPosMap.values()) {
        for (const t of g.terms.slice(0, 4)) {
          if (!allMmTerms.includes(t)) {
            allMmTerms.push(t);
          }
        }
      }
      primaryMyanmarMeaning = allMmTerms.slice(0, 6).join('၊ ') || primaryTranslation || query;
    } else if (isMmQuery && !primaryMyanmarMeaning.includes(query)) {
      primaryMyanmarMeaning = `${query}၊ ${primaryMyanmarMeaning}`;
    }

    // Step 2: Query Free English Dictionary API (`api.dictionaryapi.dev`) for full Oxford-style senses, phonetics & audio
    let phoneticBrE = matchedCurated?.phonetic || '';
    let phoneticNAmE = matchedCurated?.phonetic || '';
    let audioBrE: string | undefined;
    let audioNAmE: string | undefined;

    const meaningGroups: OxfordMeaningGroup[] = [];
    const allSynonymsSet = new Set<string>(matchedCurated?.synonyms || []);
    const allAntonymsSet = new Set<string>(matchedCurated?.antonyms || []);

    const candidateLookupWords = getEnglishCandidateStems(enHeadword.trim());
    let dictApiEntry: {
      word?: string;
      phonetic?: string;
      phonetics?: Array<{ text?: string; audio?: string }>;
      meanings?: Array<{
        partOfSpeech?: string;
        definitions?: Array<{
          definition?: string;
          example?: string;
          synonyms?: string[];
          antonyms?: string[];
        }>;
        synonyms?: string[];
        antonyms?: string[];
      }>;
    } | null = null;

    for (const candidate of candidateLookupWords) {
      if (!candidate || containsMyanmarScript(candidate)) continue;
      try {
        const dictRes = await fetch(
          `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(candidate)}`
        );
        if (dictRes.ok) {
          const dictJson = await dictRes.json();
          if (Array.isArray(dictJson) && dictJson.length > 0) {
            // Merge meanings across all homograph entries returned by dictionaryapi.dev
            const first = dictJson[0];
            const mergedMeanings = dictJson.flatMap(
              (item: { meanings?: unknown[] }) =>
                Array.isArray(item?.meanings) ? item.meanings : []
            );
            dictApiEntry = {
              ...first,
              meanings: mergedMeanings,
            };
            break;
          }
        }
      } catch {
        // continue
      }
    }

    if (dictApiEntry) {
      const defaultIpa =
        dictApiEntry.phonetic ||
        dictApiEntry.phonetics?.find((p) => Boolean(p?.text))?.text ||
        phoneticBrE ||
        `/${enHeadword.toLowerCase()}/`;

      phoneticBrE = defaultIpa;
      phoneticNAmE = defaultIpa;

      if (Array.isArray(dictApiEntry.phonetics)) {
        for (const p of dictApiEntry.phonetics) {
          const audioUrl = p?.audio || '';
          if (audioUrl) {
            if (audioUrl.includes('-uk') || audioUrl.includes('_gb')) {
              audioBrE = audioUrl;
              if (p.text) phoneticBrE = p.text;
            } else if (audioUrl.includes('-us') || audioUrl.includes('_us')) {
              audioNAmE = audioUrl;
              if (p.text) phoneticNAmE = p.text;
            } else if (!audioBrE) {
              audioBrE = audioUrl;
            }
          }
        }
      }

      // Group meanings by Part of Speech
      const groupedByPos = new Map<
        string,
        {
          posInfo: { full: string; abbrev: string; mm: string };
          senses: OxfordSense[];
          synonyms: Set<string>;
          antonyms: Set<string>;
        }
      >();

      for (const m of dictApiEntry.meanings || []) {
        const posInfo = mapPosInfo(m.partOfSpeech || 'noun');
        if (!groupedByPos.has(posInfo.full)) {
          groupedByPos.set(posInfo.full, {
            posInfo,
            senses: [],
            synonyms: new Set<string>(),
            antonyms: new Set<string>(),
          });
        }
        const bucket = groupedByPos.get(posInfo.full)!;

        for (const s of m.synonyms || []) {
          if (typeof s === 'string') {
            bucket.synonyms.add(s);
            if (allSynonymsSet.size < 12) allSynonymsSet.add(s);
          }
        }
        for (const a of m.antonyms || []) {
          if (typeof a === 'string') {
            bucket.antonyms.add(a);
            if (allAntonymsSet.size < 10) allAntonymsSet.add(a);
          }
        }

        for (const d of (m.definitions || []).slice(0, 4)) {
          if (d?.definition && bucket.senses.length < 5) {
            bucket.senses.push({
              senseNumber: bucket.senses.length + 1,
              definitionEn: d.definition,
              exampleEn: d.example,
              synonyms: (d.synonyms || []).slice(0, 4),
              antonyms: (d.antonyms || []).slice(0, 4),
            });
          }
        }
      }

      for (const [posKey, bucket] of groupedByPos.entries()) {
        const gtxGroup = gtxPosMap.get(posKey);
        const mmTerms = gtxGroup?.terms || [];
        for (const rev of gtxGroup?.reverseTerms || []) {
          if (rev.toLowerCase() !== enHeadword.toLowerCase() && allSynonymsSet.size < 12) {
            allSynonymsSet.add(rev);
          }
        }

        // If the first sense matches our curated entry, attach curated Myanmar example
        if (bucket.senses.length > 0 && matchedCurated) {
          if (!bucket.senses[0].exampleEn) {
            bucket.senses[0].exampleEn = matchedCurated.exampleEn;
            bucket.senses[0].exampleMm = matchedCurated.exampleMm;
          }
          bucket.senses[0].definitionMm = matchedCurated.mmDetail || matchedCurated.mm;
        } else if (bucket.senses.length > 0 && mmTerms.length > 0) {
          bucket.senses[0].definitionMm = mmTerms.slice(0, 4).join('၊ ');
        }

        meaningGroups.push({
          partOfSpeech: bucket.posInfo.full,
          posAbbrev: bucket.posInfo.abbrev,
          posMm: bucket.posInfo.mm,
          mmTerms,
          senses: bucket.senses,
          synonyms: Array.from(bucket.synonyms).slice(0, 8),
          antonyms: Array.from(bucket.antonyms).slice(0, 6),
        });
      }
    }

    // If dictionaryapi.dev didn't have entries (e.g., multi-word idiom/phrase), build from GTX + Curated
    if (meaningGroups.length === 0) {
      if (gtxPosMap.size > 0) {
        for (const [posKey, gtxGroup] of gtxPosMap.entries()) {
          const posInfo = mapPosInfo(posKey);
          meaningGroups.push({
            partOfSpeech: posInfo.full,
            posAbbrev: posInfo.abbrev,
            posMm: posInfo.mm,
            mmTerms: gtxGroup.terms,
            senses: [
              {
                senseNumber: 1,
                definitionEn:
                  matchedCurated?.enDef ||
                  (gtxGroup.reverseTerms.length > 0
                    ? `Related English meanings: ${gtxGroup.reverseTerms.join(', ')}.`
                    : `Meaning of "${enHeadword}": ${gtxGroup.terms.join(', ')}.`),
                definitionMm: gtxGroup.terms.join('၊ '),
                exampleEn: matchedCurated?.exampleEn,
                exampleMm: matchedCurated?.exampleMm,
              },
            ],
            synonyms: gtxGroup.reverseTerms.slice(0, 6),
            antonyms: [],
          });
        }
      } else if (matchedCurated) {
        return {
          oxfordData: convertStaticToOxfordData(matchedCurated),
          summaryEntry: matchedCurated,
        };
      } else if (primaryTranslation) {
        const posInfo = mapPosInfo('noun');
        meaningGroups.push({
          partOfSpeech: posInfo.full,
          posAbbrev: posInfo.abbrev,
          posMm: posInfo.mm,
          mmTerms: [primaryMyanmarMeaning],
          senses: [
            {
              senseNumber: 1,
              definitionEn: isMmQuery
                ? `English translation for "${query}": ${enHeadword}`
                : `Myanmar translation for "${enHeadword}": ${primaryMyanmarMeaning}`,
              definitionMm: primaryMyanmarMeaning,
            },
          ],
          synonyms: [],
          antonyms: [],
        });
      } else {
        return null;
      }
    }

    const firstSense = meaningGroups[0]?.senses[0];
    const englishOverviewDef =
      matchedCurated?.enDef ||
      firstSense?.definitionEn ||
      `Definition of ${enHeadword}`;

    const oxfordData: OxfordDictionaryData = {
      headword: matchedCurated?.en || enHeadword,
      searchedQuery: query,
      isMyanmarSearch: isMmQuery,
      phoneticBrE: phoneticBrE || `/${enHeadword.toLowerCase()}/`,
      phoneticNAmE: phoneticNAmE || phoneticBrE || `/${enHeadword.toLowerCase()}/`,
      audioBrE,
      audioNAmE,
      primaryPos: meaningGroups.map((g) => g.partOfSpeech).join(', '),
      cefrLevel: estimateCefrLevel(enHeadword, matchedCurated?.category),
      primaryMyanmarMeaning,
      englishOverviewDef,
      meaningGroups,
      allSynonyms: Array.from(allSynonymsSet).slice(0, 10),
      allAntonyms: Array.from(allAntonymsSet).slice(0, 8),
    };

    saveOxfordStoredCache(cacheKey, oxfordData);

    const summaryEntry: DictionaryEntry = matchedCurated || {
      id: `oxford-${cacheKey.replace(/[^a-z0-9\u1000-\u109F]/gi, '-')}`,
      en: oxfordData.headword,
      phonetic: oxfordData.phoneticBrE,
      pos: meaningGroups[0]?.posAbbrev || 'n.',
      mm: oxfordData.primaryMyanmarMeaning,
      enDef: oxfordData.englishOverviewDef,
      exampleEn:
        firstSense?.exampleEn || `Example usage of "${oxfordData.headword}".`,
      exampleMm: firstSense?.exampleMm || oxfordData.primaryMyanmarMeaning,
      synonyms: oxfordData.allSynonyms,
      antonyms: oxfordData.allAntonyms,
      category: 'general',
    };

    return { oxfordData, summaryEntry };
  } catch {
    if (existingStatic) {
      return {
        oxfordData: convertStaticToOxfordData(existingStatic),
        summaryEntry: existingStatic,
      };
    }
    return null;
  }
}
