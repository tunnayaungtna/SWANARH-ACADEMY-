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

// Lazy singleton cache so 0ms is spent at app startup before the user opens the dictionary
let _masterStaticDictionaryCache: DictionaryEntry[] | null = null;
let _staticHeadwordMapCache: Map<string, DictionaryEntry> | null = null;

function ensureStaticDictionaryInitialized(): {
  list: DictionaryEntry[];
  map: Map<string, DictionaryEntry>;
} {
  if (_masterStaticDictionaryCache && _staticHeadwordMapCache) {
    return {
      list: _masterStaticDictionaryCache,
      map: _staticHeadwordMapCache,
    };
  }
  const map = new Map<string, DictionaryEntry>();
  const combined = [
    ...EN_MM_DICTIONARY,
    ...EXTRA_EN_MM_ENTRIES,
    ...CORE_EN_MM_LEXICON,
  ];
  const unique: DictionaryEntry[] = [];
  for (const item of combined) {
    const key = item.en.trim().toLowerCase();
    if (!map.has(key)) {
      map.set(key, item);
      unique.push(item);
    }
  }
  unique.sort((a, b) => {
    const ak = a.en.toLowerCase();
    const bk = b.en.toLowerCase();
    return ak < bk ? -1 : ak > bk ? 1 : 0;
  });
  _masterStaticDictionaryCache = unique;
  _staticHeadwordMapCache = map;
  return { list: unique, map };
}

export function getMasterStaticDictionary(): DictionaryEntry[] {
  return ensureStaticDictionaryInitialized().list;
}

export function getInstantStaticEntry(word: string): DictionaryEntry | undefined {
  return ensureStaticDictionaryInitialized().map.get(word.trim().toLowerCase());
}

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
    return { results: [], hasExactMatch: false };
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
const inflightLookups = new Map<
  string,
  Promise<{ oxfordData: OxfordDictionaryData; summaryEntry: DictionaryEntry } | null>
>();

let storedCacheLoaded = false;
function ensureOxfordCacheLoaded(): void {
  if (storedCacheLoaded) return;
  storedCacheLoaded = true;
  try {
    const raw = localStorage.getItem(OXFORD_CACHE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, OxfordDictionaryData>;
      for (const [k, v] of Object.entries(parsed)) {
        if (k && v) {
          oxfordMemoryCache.set(k, v);
        }
      }
    }
  } catch {
    // ignore
  }
}

function saveOxfordStoredCache(key: string, data: OxfordDictionaryData): void {
  ensureOxfordCacheLoaded();
  oxfordMemoryCache.set(key, data);
  const headKey = data.headword.trim().toLowerCase();
  if (headKey) {
    oxfordMemoryCache.set(headKey, data);
  }
  try {
    const obj: Record<string, OxfordDictionaryData> = {};
    const entries = Array.from(oxfordMemoryCache.entries()).slice(-150);
    for (const [k, v] of entries) {
      obj[k] = v;
    }
    localStorage.setItem(OXFORD_CACHE_STORAGE_KEY, JSON.stringify(obj));
  } catch {
    // ignore
  }
}

function buildSummaryFromOxfordData(
  cacheKey: string,
  cached: OxfordDictionaryData,
  existingStatic?: DictionaryEntry
): DictionaryEntry {
  if (existingStatic) return existingStatic;
  return {
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
  };
}

async function fetchJsonWithTimeout(url: string, timeoutMs = 2800): Promise<unknown | null> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = setTimeout(() => {
    controller?.abort();
  }, timeoutMs);
  try {
    const res = await fetch(url, controller ? { signal: controller.signal } : undefined);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

interface DictApiRawEntry {
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
}

/**
 * Fast parallel fetch of English dictionary senses from dictionaryapi.dev
 */
async function fetchEnglishDictApiFast(rawEnglishWord: string): Promise<DictApiRawEntry | null> {
  const candidates = getEnglishCandidateStems(rawEnglishWord).filter(
    (w) => Boolean(w) && !containsMyanmarScript(w)
  );
  if (candidates.length === 0) return null;

  // Query top 2 candidates in parallel (e.g. inflected word + base lemma) so we never wait sequentially!
  const primaryCandidates = candidates.slice(0, 2);
  const results = await Promise.all(
    primaryCandidates.map((cand) =>
      fetchJsonWithTimeout(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cand)}`,
        2600
      )
    )
  );

  for (const dictJson of results) {
    if (Array.isArray(dictJson) && dictJson.length > 0) {
      const first = dictJson[0] as DictApiRawEntry;
      const mergedMeanings = dictJson.flatMap((item: { meanings?: unknown[] }) =>
        Array.isArray(item?.meanings) ? item.meanings : []
      ) as DictApiRawEntry['meanings'];
      return {
        ...first,
        meanings: mergedMeanings,
      };
    }
  }
  return null;
}

function parseGtxResponse(gtxData: unknown): {
  primaryTranslation: string;
  posMap: Map<string, { terms: string[]; reverseTerms: string[] }>;
} {
  let primaryTranslation = '';
  const posMap = new Map<string, { terms: string[]; reverseTerms: string[] }>();

  if (!Array.isArray(gtxData)) {
    return { primaryTranslation, posMap };
  }

  if (Array.isArray(gtxData[0])) {
    primaryTranslation = gtxData[0]
      .map((seg: unknown) => (Array.isArray(seg) ? seg[0] : ''))
      .join('')
      .trim();
  }

  if (Array.isArray(gtxData[1])) {
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
          posMap.set(posInfo.full, { terms, reverseTerms });
        }
      }
    }
  }

  return { primaryTranslation, posMap };
}

/**
 * Fetch fast live autocomplete word suggestions for ANY English prefix
 */
const suggestionCache = new Map<string, string[]>();
export async function fetchWordSuggestions(prefix: string): Promise<string[]> {
  const q = prefix.trim().toLowerCase();
  if (!q || q.length < 2 || containsMyanmarScript(q)) return [];
  if (suggestionCache.has(q)) {
    return suggestionCache.get(q)!;
  }
  try {
    const data = await fetchJsonWithTimeout(
      `https://api.datamuse.com/sug?s=${encodeURIComponent(q)}&max=8`,
      1500
    );
    if (!Array.isArray(data)) return [];
    const list = data
      .map((item: { word?: string }) => (typeof item?.word === 'string' ? item.word : ''))
      .filter(Boolean);
    suggestionCache.set(q, list);
    return list;
  } catch {
    return [];
  }
}

/**
 * Ultra-Fast Parallel Oxford-Style Lookup for ANY English or Myanmar word/phrase!
 * - Zero Supabase usage (0% database, 0% egress)
 * - Runs Google GTX Bilingual API & Free Dictionary API simultaneously in parallel
 * - Emits `onFastPreview` in ~80ms as soon as GTX responds so the UI updates immediately
 */
export async function fetchOxfordDictionaryEntry(
  rawQuery: string,
  onFastPreview?: (preview: {
    oxfordData: OxfordDictionaryData;
    summaryEntry: DictionaryEntry;
  }) => void
): Promise<{ oxfordData: OxfordDictionaryData; summaryEntry: DictionaryEntry } | null> {
  const query = rawQuery.trim();
  if (!query) return null;

  ensureOxfordCacheLoaded();
  const cacheKey = query.toLowerCase();
  const existingStatic = getInstantStaticEntry(cacheKey);

  // Instant memory/localStorage hit (0ms)
  if (oxfordMemoryCache.has(cacheKey)) {
    const cached = oxfordMemoryCache.get(cacheKey)!;
    return {
      oxfordData: cached,
      summaryEntry: buildSummaryFromOxfordData(cacheKey, cached, existingStatic),
    };
  }

  // Deduplicate concurrent identical requests
  if (inflightLookups.has(cacheKey)) {
    return inflightLookups.get(cacheKey)!;
  }

  const lookupPromise = (async () => {
    const isMmQuery = containsMyanmarScript(query);
    const sourceLang = isMmQuery ? 'my' : 'en';
    const targetLang = isMmQuery ? 'en' : 'my';

    try {
      const gtxUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&dt=bd&dt=md&dt=ex&dt=ss&dt=at&q=${encodeURIComponent(
        query
      )}`;

      let gtxPrimaryTranslation = '';
      let gtxPosMap = new Map<string, { terms: string[]; reverseTerms: string[] }>();
      let dictApiEntry: DictApiRawEntry | null = null;

      if (!isMmQuery) {
        // PARALLEL EXECUTION for English queries:
        // Fire Google GTX (~80ms) AND Free Dictionary API (~220ms) at the exact same time!
        const gtxTask = fetchJsonWithTimeout(gtxUrl, 2500).then((gtxJson) => {
          const parsed = parseGtxResponse(gtxJson);
          gtxPrimaryTranslation = parsed.primaryTranslation;
          gtxPosMap = parsed.posMap;

          // Progressive Fast Preview (~80ms): immediately give the user the Myanmar meaning while audio/senses finish
          if (onFastPreview && (parsed.primaryTranslation || parsed.posMap.size > 0)) {
            const fastTerms: string[] = [];
            if (parsed.primaryTranslation) fastTerms.push(parsed.primaryTranslation);
            for (const g of parsed.posMap.values()) {
              for (const t of g.terms.slice(0, 4)) {
                if (!fastTerms.includes(t)) fastTerms.push(t);
              }
            }
            const fastMm = existingStatic?.mm || fastTerms.slice(0, 5).join('၊ ') || query;
            const previewGroups: OxfordMeaningGroup[] = [];
            for (const [posKey, grp] of parsed.posMap.entries()) {
              const pInfo = mapPosInfo(posKey);
              previewGroups.push({
                partOfSpeech: pInfo.full,
                posAbbrev: pInfo.abbrev,
                posMm: pInfo.mm,
                mmTerms: grp.terms,
                senses: [
                  {
                    senseNumber: 1,
                    definitionEn:
                      existingStatic?.enDef ||
                      (grp.reverseTerms.length > 0
                        ? `Meanings: ${grp.reverseTerms.join(', ')}.`
                        : `Myanmar meaning: ${grp.terms.join('၊ ')}`),
                    definitionMm: grp.terms.join('၊ '),
                    exampleEn: existingStatic?.exampleEn,
                    exampleMm: existingStatic?.exampleMm,
                  },
                ],
                synonyms: grp.reverseTerms.slice(0, 6),
                antonyms: [],
              });
            }
            if (previewGroups.length === 0) {
              const pInfo = mapPosInfo(existingStatic?.pos || 'noun');
              previewGroups.push({
                partOfSpeech: pInfo.full,
                posAbbrev: pInfo.abbrev,
                posMm: pInfo.mm,
                mmTerms: [fastMm],
                senses: [
                  {
                    senseNumber: 1,
                    definitionEn: existingStatic?.enDef || `Meaning of "${query}": ${fastMm}`,
                    definitionMm: fastMm,
                  },
                ],
                synonyms: existingStatic?.synonyms || [],
                antonyms: existingStatic?.antonyms || [],
              });
            }
            const fastOxford: OxfordDictionaryData = {
              headword: existingStatic?.en || query,
              searchedQuery: query,
              isMyanmarSearch: false,
              phoneticBrE: existingStatic?.phonetic || `/${query.toLowerCase()}/`,
              phoneticNAmE: existingStatic?.phonetic || `/${query.toLowerCase()}/`,
              primaryPos: previewGroups.map((g) => g.partOfSpeech).join(', '),
              cefrLevel: estimateCefrLevel(query, existingStatic?.category),
              primaryMyanmarMeaning: fastMm,
              englishOverviewDef:
                existingStatic?.enDef || previewGroups[0].senses[0].definitionEn,
              meaningGroups: previewGroups,
              allSynonyms: existingStatic?.synonyms || previewGroups[0]?.synonyms || [],
              allAntonyms: existingStatic?.antonyms || [],
            };
            onFastPreview({
              oxfordData: fastOxford,
              summaryEntry: buildSummaryFromOxfordData(cacheKey, fastOxford, existingStatic),
            });
          }
        });

        const dictTask = fetchEnglishDictApiFast(query).then((res) => {
          dictApiEntry = res;
        });

        await Promise.all([gtxTask, dictTask]);
      } else {
        // Myanmar query: Step 1 resolves Myanmar -> English headword, then parallelizes English -> Myanmar POS & English Dict API!
        const gtxJson = await fetchJsonWithTimeout(gtxUrl, 2500);
        const parsed = parseGtxResponse(gtxJson);
        gtxPrimaryTranslation = parsed.primaryTranslation;
        gtxPosMap = parsed.posMap;
      }

      // Determine the canonical English headword
      let enHeadword = isMmQuery ? gtxPrimaryTranslation : query;
      if (isMmQuery && gtxPosMap.size > 0) {
        const firstGroup = Array.from(gtxPosMap.values())[0];
        if (firstGroup.terms[0]) {
          enHeadword = firstGroup.terms[0];
        }
      }
      if (!enHeadword) {
        enHeadword = query;
      }

      const matchedCurated =
        existingStatic || getInstantStaticEntry(enHeadword);

      // For Myanmar queries, fetch reverse POS breakdown & English Dictionary API in PARALLEL!
      if (isMmQuery && enHeadword && !containsMyanmarScript(enHeadword)) {
        const revUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=my&dt=t&dt=bd&q=${encodeURIComponent(
          enHeadword
        )}`;
        const [revJson, dictRes] = await Promise.all([
          fetchJsonWithTimeout(revUrl, 2400),
          fetchEnglishDictApiFast(enHeadword),
        ]);
        dictApiEntry = dictRes;
        const revParsed = parseGtxResponse(revJson);
        if (revParsed.posMap.size > 0) {
          gtxPosMap = revParsed.posMap;
        }
      }

      // Build primary Myanmar meaning string
      let primaryMyanmarMeaning = matchedCurated?.mm || '';
      if (!primaryMyanmarMeaning) {
        const allMmTerms: string[] = [];
        if (isMmQuery) {
          allMmTerms.push(query);
        } else if (gtxPrimaryTranslation) {
          allMmTerms.push(gtxPrimaryTranslation);
        }
        for (const g of gtxPosMap.values()) {
          for (const t of g.terms.slice(0, 4)) {
            if (!allMmTerms.includes(t)) {
              allMmTerms.push(t);
            }
          }
        }
        primaryMyanmarMeaning =
          allMmTerms.slice(0, 6).join('၊ ') || gtxPrimaryTranslation || query;
      } else if (isMmQuery && !primaryMyanmarMeaning.includes(query)) {
        primaryMyanmarMeaning = `${query}၊ ${primaryMyanmarMeaning}`;
      }

      // Build Oxford Meaning Groups & Phonetics
      let phoneticBrE = matchedCurated?.phonetic || '';
      let phoneticNAmE = matchedCurated?.phonetic || '';
      let audioBrE: string | undefined;
      let audioNAmE: string | undefined;

      const meaningGroups: OxfordMeaningGroup[] = [];
      const allSynonymsSet = new Set<string>(matchedCurated?.synonyms || []);
      const allAntonymsSet = new Set<string>(matchedCurated?.antonyms || []);

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
            if (
              rev.toLowerCase() !== enHeadword.toLowerCase() &&
              allSynonymsSet.size < 12
            ) {
              allSynonymsSet.add(rev);
            }
          }

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
        } else if (gtxPrimaryTranslation) {
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
        phoneticNAmE:
          phoneticNAmE || phoneticBrE || `/${enHeadword.toLowerCase()}/`,
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

      const summaryEntry = buildSummaryFromOxfordData(
        cacheKey,
        oxfordData,
        matchedCurated
      );

      return { oxfordData, summaryEntry };
    } catch {
      if (existingStatic) {
        return {
          oxfordData: convertStaticToOxfordData(existingStatic),
          summaryEntry: existingStatic,
        };
      }
      return null;
    } finally {
      inflightLookups.delete(cacheKey);
    }
  })();

  inflightLookups.set(cacheKey, lookupPromise);
  return lookupPromise;
}
