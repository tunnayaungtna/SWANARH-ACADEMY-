import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_TARGET_ORIGIN =
  process.env.VITE_SUPABASE_URL || 'https://apuyokqzskpmbnmekpyd.supabase.co';
const SUPABASE_DEFAULT_KEY =
  process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_6eYg1IuvvXOtj7e8Kf-kVg_UDPgI7Gs';

const parsedTargetOrigin = new URL(SUPABASE_TARGET_ORIGIN).origin;

// Per-IP sliding-window rate limiter for /api/sb-proxy to prevent abuse / DoS
const ipRequestBuckets = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 6000;

function checkProxyRateLimit(ip: string): boolean {
  const now = Date.now();
  const recent = (ipRequestBuckets.get(ip) || []).filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
    ipRequestBuckets.set(ip, recent);
    return false;
  }
  recent.push(now);
  ipRequestBuckets.set(ip, recent);
  if (ipRequestBuckets.size > 5000) {
    for (const [key, timestamps] of ipRequestBuckets.entries()) {
      if (timestamps.every((ts) => now - ts >= RATE_LIMIT_WINDOW_MS)) {
        ipRequestBuckets.delete(key);
      }
    }
  }
  return true;
}

function isAllowedSupabaseSubPath(subPath: string): boolean {
  if (!subPath.startsWith('/')) return false;
  let decoded = subPath;
  try {
    decoded = decodeURIComponent(subPath);
  } catch {
    return false;
  }
  if (
    subPath.startsWith('//') ||
    decoded.startsWith('//') ||
    subPath.includes('..') ||
    decoded.includes('..') ||
    subPath.includes('\\') ||
    decoded.includes('\\') ||
    decoded.includes('\0')
  ) {
    return false;
  }
  return (
    decoded.startsWith('/rest/v1/') ||
    decoded.startsWith('/auth/v1/') ||
    decoded.startsWith('/storage/v1/')
  );
}

function isTrustedCorsOrigin(origin?: string): boolean {
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    const host = parsed.hostname.toLowerCase();
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === 'swanarhclassroom.online' ||
      host.endsWith('.swanarhclassroom.online') ||
      host === 'swanarhacademy.com' ||
      host.endsWith('.swanarhacademy.com') ||
      host.endsWith('.run.app') ||
      host.endsWith('.github.io')
    );
  } catch {
    return false;
  }
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs: number = 8_000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  const PORT = Number(process.env.PORT) || 3000;

  // Security & Origin-Validated CORS headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    const reqOrigin = typeof req.headers.origin === 'string' ? req.headers.origin : '';
    if (reqOrigin && isTrustedCorsOrigin(reqOrigin)) {
      res.setHeader('Access-Control-Allow-Origin', reqOrigin);
      res.setHeader('Vary', 'Origin');
    }
    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD'
    );
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Origin, X-Requested-With, Content-Type, Accept, Accept-Profile, Content-Profile, Authorization, apikey, Prefer, Range, x-client-info, x-supabase-api-version, x-supabase-target-origin'
    );
    res.setHeader(
      'Access-Control-Expose-Headers',
      'Content-Range, Range-Unit, X-Total-Count, Content-Location, Preference-Applied'
    );
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.status(200).json({
      ok: true,
      region: 'global-vpn-free-relay',
      timestamp: Date.now(),
    });
  });

  // Live YouTube Channel Feed Resolver & RSS + Multi-Tab Parser (resolves @swanarhacademy or any YouTube channel URL to latest videos automatically)
  const ytFeedCache = new Map<
    string,
    {
      channelId: string;
      channelTitle: string;
      videos: Array<{
        videoId: string;
        title: string;
        publishedAt: string;
        thumbnailUrl: string;
        videoUrl: string;
      }>;
      fetchedAt: number;
    }
  >();
  const ytVideoTitleCache = new Map<string, string>();

  app.get('/api/youtube-feed', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    try {
      const clientIp =
        (typeof req.headers['x-forwarded-for'] === 'string'
          ? req.headers['x-forwarded-for'].split(',')[0].trim()
          : req.socket.remoteAddress) || 'unknown';
      if (!checkProxyRateLimit(clientIp)) {
        res.status(429).json({ ok: false, videos: [], message: 'Too many requests.' });
        return;
      }

      const rawHandle = String(req.query.handle || '@swanarhacademy').trim();
      const rawChannelId = String(req.query.channelId || '').trim();
      const force = req.query.force === '1';

      // Strict validation to prevent SSRF: only allow valid YouTube handles (@...) or UC... channel IDs
      const cleanHandle = rawHandle.replace(/^https?:\/\/(www\.)?youtube\.com\//i, '').split(/[/?#]/)[0].trim();
      const handlePath = cleanHandle.startsWith('@') ? cleanHandle : `@${cleanHandle.replace(/^@+/, '')}`;
      const isSwanarhDefault = handlePath.toLowerCase() === '@swanarhacademy';
      const validChannelId = /^UC[a-zA-Z0-9_-]{20,28}$/.test(rawChannelId)
        ? rawChannelId
        : isSwanarhDefault
        ? 'UCk0VikA7fYKBuoJkI_cOxRg'
        : '';
      const cacheKey = `${handlePath.toLowerCase()}:${validChannelId}`;

      const cached = ytFeedCache.get(cacheKey);
      if (!force && cached && Date.now() - cached.fetchedAt < 60 * 1000 && cached.videos.length > 0) {
        res.status(200).json({ ok: true, ...cached });
        return;
      }

      if (!/^@[a-zA-Z0-9._-]{2,60}$/.test(handlePath)) {
        res.status(400).json({ ok: false, message: 'Invalid YouTube handle format.' });
        return;
      }

      const ytHeaders = {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        Cookie: 'SOCS=CAESEwgDEgk0ODE3Nzk3MjQaAmVuIAEaBgiA_LyaBg',
      };

      let resolvedChannelId = validChannelId;
      if (!resolvedChannelId) {
        const pageRes = await fetchWithTimeout(`https://www.youtube.com/${handlePath}`, {
          headers: ytHeaders,
        });
        if (pageRes.ok) {
          const html = await pageRes.text();
          const cidMatch =
            html.match(/"externalId"\s*:\s*"(UC[a-zA-Z0-9_-]{20,28})"/) ||
            html.match(/channel_id=(UC[a-zA-Z0-9_-]{20,28})/) ||
            html.match(/"channelId"\s*:\s*"(UC[a-zA-Z0-9_-]{20,28})"/);
          if (cidMatch && cidMatch[1]) {
            resolvedChannelId = cidMatch[1];
          }
        }
      }

      let channelTitle = isSwanarhDefault ? 'SwanArh Academy' : handlePath;
      const videoMap = new Map<
        string,
        {
          videoId: string;
          title: string;
          publishedAt: string;
          thumbnailUrl: string;
          videoUrl: string;
        }
      >();

      // 1. Parse YouTube Atom RSS Feed for latest videos & publish timestamps
      if (resolvedChannelId) {
        try {
          const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(
            resolvedChannelId
          )}`;
          const rssRes = await fetchWithTimeout(rssUrl, { headers: ytHeaders });
          if (rssRes.ok) {
            const xml = await rssRes.text();
            const channelTitleMatch = xml.match(/<title>([^<]+)<\/title>/);
            if (channelTitleMatch && channelTitleMatch[1]) {
              channelTitle = channelTitleMatch[1].trim();
            }

            const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
            let match: RegExpExecArray | null;
            while ((match = entryRegex.exec(xml)) !== null && videoMap.size < 50) {
              const block = match[1];
              const vidMatch = block.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
              const titleMatch = block.match(/<title>([\s\S]*?)<\/title>/);
              const pubMatch = block.match(/<published>([^<]+)<\/published>/);
              if (vidMatch && vidMatch[1]) {
                const videoId = vidMatch[1].trim();
                if (/^[a-zA-Z0-9_-]{11}$/.test(videoId) && !videoMap.has(videoId)) {
                  const rawTitle = (titleMatch ? titleMatch[1] : 'YouTube Video')
                    .replace(/&amp;/g, '&')
                    .replace(/&quot;/g, '"')
                    .replace(/&#39;/g, "'")
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .trim();
                  const publishedAt = pubMatch ? pubMatch[1].trim() : new Date().toISOString();
                  ytVideoTitleCache.set(videoId, rawTitle);
                  videoMap.set(videoId, {
                    videoId,
                    title: rawTitle,
                    publishedAt,
                    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                    videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
                  });
                }
              }
            }
          }
        } catch {
          // continue to channel page scraping
        }
      }

      // 2. Also scrape /videos and /shorts tabs to discover full channel catalog beyond the 15-item RSS limit
      const extraIds: string[] = [];
      for (const tab of ['videos', 'shorts']) {
        try {
          const tabRes = await fetchWithTimeout(`https://www.youtube.com/${handlePath}/${tab}`, {
            headers: ytHeaders,
          });
          if (!tabRes.ok) continue;
          const html = await tabRes.text();
          if (!resolvedChannelId) {
            const cidMatch =
              html.match(/"externalId"\s*:\s*"(UC[a-zA-Z0-9_-]{20,28})"/) ||
              html.match(/"channelId"\s*:\s*"(UC[a-zA-Z0-9_-]{20,28})"/);
            if (cidMatch && cidMatch[1]) {
              resolvedChannelId = cidMatch[1];
            }
          }
          const vidRegex = /"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/g;
          let vm: RegExpExecArray | null;
          while ((vm = vidRegex.exec(html)) !== null) {
            const vid = vm[1];
            if (!videoMap.has(vid) && !extraIds.includes(vid) && videoMap.size + extraIds.length < 40) {
              extraIds.push(vid);
            }
          }
        } catch {
          // ignore tab fetch error
        }
      }

      if (extraIds.length > 0) {
        const resolvedExtras = await Promise.all(
          extraIds.map(async (vid) => {
            let title = ytVideoTitleCache.get(vid) || '';
            if (!title) {
              try {
                const oRes = await fetchWithTimeout(
                  `https://www.youtube.com/oembed?url=${encodeURIComponent(
                    `https://www.youtube.com/watch?v=${vid}`
                  )}&format=json`
                );
                if (oRes.ok) {
                  const oData = (await oRes.json()) as { title?: string };
                  if (oData.title) {
                    title = String(oData.title).trim();
                    ytVideoTitleCache.set(vid, title);
                  }
                }
              } catch {
                // ignore oembed failure
              }
            }
            return {
              videoId: vid,
              title: title || `${channelTitle} — သင်ခန်းစာ ဗီဒီယို`,
              publishedAt: 'SwanArh Academy',
              thumbnailUrl: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
              videoUrl: `https://www.youtube.com/watch?v=${vid}`,
            };
          })
        );
        for (const item of resolvedExtras) {
          if (!videoMap.has(item.videoId)) {
            videoMap.set(item.videoId, item);
          }
        }
      }

      const videos = Array.from(videoMap.values());
      const payload = {
        channelId: resolvedChannelId || (isSwanarhDefault ? 'UCk0VikA7fYKBuoJkI_cOxRg' : ''),
        channelTitle,
        videos,
        fetchedAt: Date.now(),
      };
      if (videos.length > 0) {
        ytFeedCache.set(cacheKey, payload);
      }
      res.status(200).json({ ok: videos.length > 0, ...payload });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(200).json({ ok: false, videos: [], message: msg });
    }
  });

  // Helper to decode exact Unix timestamp (ms) from 64-bit TikTok Snowflake video ID
  function getTikTokVideoTimestampMs(videoId: string): number {
    try {
      const clean = String(videoId || '').replace(/\D/g, '');
      if (clean.length < 15) return 0;
      const sec = Number(BigInt(clean) >> 32n);
      if (sec > 1400000000 && sec < 4000000000) {
        return sec * 1000;
      }
      return 0;
    } catch {
      return 0;
    }
  }

  // Live TikTok Creator Feed Resolver (discovers video IDs & metadata from @dr..si.thu.aung.s automatically)
  const ttFeedCache = new Map<
    string,
    {
      handle: string;
      videos: Array<{
        videoId: string;
        title: string;
        publishedAt?: string;
        timestampMs?: number;
        thumbnailUrl?: string;
        videoUrl: string;
      }>;
      fetchedAt: number;
    }
  >();

  app.get('/api/tiktok-feed', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    try {
      const clientIp =
        (typeof req.headers['x-forwarded-for'] === 'string'
          ? req.headers['x-forwarded-for'].split(',')[0].trim()
          : req.socket.remoteAddress) || 'unknown';
      if (!checkProxyRateLimit(clientIp)) {
        res.status(429).json({ ok: false, videos: [], message: 'Too many requests.' });
        return;
      }

      const rawHandle = String(req.query.handle || 'dr..si.thu.aung.s').trim();
      const force = req.query.force === '1';
      const cleanHandle = rawHandle
        .replace(/^https?:\/\/(www\.)?tiktok\.com\/@?/i, '')
        .split(/[/?#]/)[0]
        .replace(/^@+/, '')
        .trim();

      if (!/^[a-zA-Z0-9._-]{2,60}$/.test(cleanHandle)) {
        res.status(400).json({ ok: false, videos: [], message: 'Invalid TikTok handle.' });
        return;
      }

      const cached = ttFeedCache.get(cleanHandle);
      if (!force && cached && Date.now() - cached.fetchedAt < 45 * 1000) {
        res.status(200).json({ ok: true, ...cached });
        return;
      }

      const videos: Array<{
        videoId: string;
        title: string;
        publishedAt?: string;
        timestampMs?: number;
        thumbnailUrl?: string;
        videoUrl: string;
      }> = [];
      const seenIds = new Set<string>();

      const endpoints = [
        `https://www.tiktok.com/embed/@${cleanHandle}`,
        `https://www.tiktok.com/@${cleanHandle}`,
      ];

      for (const ep of endpoints) {
        try {
          const resp = await fetchWithTimeout(ep, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              'Accept-Language': 'en-US,en;q=0.9',
              'Cache-Control': 'no-cache',
            },
          });
          if (!resp.ok) continue;
          const html = await resp.text();

          // 1. Parse structured __FRONTITY_CONNECT_STATE__ from TikTok embed page (includes full Myanmar descriptions & cover images)
          const frontityMatch = html.match(
            /<script id="__FRONTITY_CONNECT_STATE__"[^>]*>([\s\S]*?)<\/script>/i
          );
          if (frontityMatch && frontityMatch[1]) {
            try {
              const stateObj = JSON.parse(frontityMatch[1]);
              const dataMap = stateObj?.source?.data || {};
              for (const k of Object.keys(dataMap)) {
                const vList = dataMap[k]?.videoList;
                if (Array.isArray(vList)) {
                  vList.forEach((v: Record<string, unknown>, idx: number) => {
                    const vid = String(v?.id || '').replace(/\D/g, '');
                    if (vid.length >= 17 && vid.length <= 21 && !seenIds.has(vid)) {
                      seenIds.add(vid);
                      const rawDesc = String(v?.desc || '')
                        .replace(/\s+/g, ' ')
                        .trim();
                      const cleanTitle = rawDesc
                        ? rawDesc.slice(0, 160)
                        : `Dr. Si Thu Aung (@${cleanHandle}) TikTok Video #${idx + 1}`;
                      const cover =
                        typeof v?.coverUrl === 'string' && v.coverUrl
                          ? v.coverUrl
                          : typeof v?.originCoverUrl === 'string' && v.originCoverUrl
                          ? v.originCoverUrl
                          : undefined;
                      const tsMs = getTikTokVideoTimestampMs(vid);
                      videos.push({
                        videoId: vid,
                        title: cleanTitle,
                        timestampMs: tsMs || undefined,
                        publishedAt: tsMs
                          ? new Date(tsMs).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : undefined,
                        thumbnailUrl: cover,
                        videoUrl: `https://www.tiktok.com/@${cleanHandle}/video/${vid}`,
                      });
                    }
                  });
                }
              }
            } catch {
              // fallback to regex extraction below
            }
          }

          // 2. Fallback regex extraction for any additional video IDs
          const idMatches = html.match(/\/video\/(\d{17,21})/g) || [];
          for (const raw of idMatches) {
            const digits = raw.replace(/\D/g, '');
            if (digits.length >= 17 && digits.length <= 21 && !seenIds.has(digits)) {
              seenIds.add(digits);
            }
          }
        } catch {
          // ignore endpoint error
        }
      }

      const existingIds = new Set(videos.map((v) => v.videoId));
      const remainingIds = Array.from(seenIds)
        .filter((id) => !existingIds.has(id))
        .slice(0, 18);

      await Promise.all(
        remainingIds.map(async (vid) => {
          const vUrl = `https://www.tiktok.com/@${cleanHandle}/video/${vid}`;
          const tsMs = getTikTokVideoTimestampMs(vid);
          const pubDate = tsMs
            ? new Date(tsMs).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
            : undefined;
          try {
            const oeRes = await fetchWithTimeout(
              `https://www.tiktok.com/oembed?url=${encodeURIComponent(vUrl)}`
            );
            if (oeRes.ok) {
              const oe = (await oeRes.json()) as {
                title?: string;
                thumbnail_url?: string;
              };
              if (oe.title || oe.thumbnail_url) {
                videos.push({
                  videoId: vid,
                  title: oe.title || `Dr. Si Thu Aung (@${cleanHandle}) TikTok Video`,
                  timestampMs: tsMs || undefined,
                  publishedAt: pubDate,
                  thumbnailUrl: oe.thumbnail_url,
                  videoUrl: vUrl,
                });
                return;
              }
            }
          } catch {
            // fallback
          }
          videos.push({
            videoId: vid,
            title: `Dr. Si Thu Aung (@${cleanHandle}) TikTok Video`,
            timestampMs: tsMs || undefined,
            publishedAt: pubDate,
            videoUrl: vUrl,
          });
        })
      );

      // Sort strictly by Snowflake videoId descending (newest uploaded video first, so older pinned videos don't hide brand-new uploads)
      videos.sort((a, b) => {
        try {
          const idA = BigInt(a.videoId.replace(/\D/g, '') || '0');
          const idB = BigInt(b.videoId.replace(/\D/g, '') || '0');
          if (idB > idA) return 1;
          if (idB < idA) return -1;
          return 0;
        } catch {
          return (b.timestampMs || 0) - (a.timestampMs || 0);
        }
      });

      const payload = {
        handle: cleanHandle,
        videos,
        fetchedAt: Date.now(),
      };
      if (videos.length > 0) {
        ttFeedCache.set(cleanHandle, payload);
      }
      res.status(200).json({ ok: videos.length > 0, ...payload });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(200).json({ ok: false, videos: [], message: msg });
    }
  });

  // Hardened /api/sb-proxy reverse proxy with strict SSRF & path validation
  app.use(
    '/api/sb-proxy',
    express.raw({ type: '*/*', limit: '6mb' }),
    async (req, res) => {
      try {
        const clientIp =
          (typeof req.headers['x-forwarded-for'] === 'string'
            ? req.headers['x-forwarded-for'].split(',')[0].trim()
            : req.socket.remoteAddress) || 'unknown';

        if (!checkProxyRateLimit(clientIp)) {
          res.status(429).json({
            message: 'Too many requests. Please wait a moment and try again.',
          });
          return;
        }

        const rawSub = req.originalUrl.replace(/^\/api\/sb-proxy/, '') || '/';
        const normalizedSub = rawSub.startsWith('/') ? rawSub : `/${rawSub}`;

        if (!isAllowedSupabaseSubPath(normalizedSub)) {
          res.status(403).json({
            message: 'Forbidden proxy path.',
          });
          return;
        }

        const customOriginHeader = req.headers['x-supabase-target-origin'];
        let activeTargetOrigin = parsedTargetOrigin;
        if (
          typeof customOriginHeader === 'string' &&
          /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(customOriginHeader.trim())
        ) {
          activeTargetOrigin = new URL(customOriginHeader.trim()).origin;
        }

        const targetUrl = new URL(normalizedSub, activeTargetOrigin);
        if (
          targetUrl.origin !== activeTargetOrigin ||
          !isAllowedSupabaseSubPath(targetUrl.pathname)
        ) {
          res.status(403).json({
            message: 'Invalid target origin or path.',
          });
          return;
        }

        const forwardHeaders = new Headers();
        const allowedIncomingHeaders = [
          'accept',
          'accept-profile',
          'authorization',
          'apikey',
          'content-profile',
          'content-type',
          'prefer',
          'range',
          'x-client-info',
          'x-supabase-api-version',
        ];

        for (const h of allowedIncomingHeaders) {
          const val = req.headers[h];
          if (typeof val === 'string' && val.length > 0) {
            forwardHeaders.set(h, val);
          }
        }

        // Only attach default server key if proxying to the default project origin
        if (activeTargetOrigin === parsedTargetOrigin) {
          if (!forwardHeaders.has('apikey')) {
            forwardHeaders.set('apikey', SUPABASE_DEFAULT_KEY);
          }
          if (!forwardHeaders.has('authorization')) {
            forwardHeaders.set('authorization', `Bearer ${SUPABASE_DEFAULT_KEY}`);
          }
        }

        const hasBody =
          req.method !== 'GET' &&
          req.method !== 'HEAD' &&
          req.body &&
          Buffer.isBuffer(req.body) &&
          req.body.length > 0;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15_000);

        try {
          const upstreamRes = await fetch(targetUrl.toString(), {
            method: req.method,
            headers: forwardHeaders,
            body: hasBody ? new Uint8Array(req.body) : undefined,
            signal: controller.signal,
          });

          res.status(upstreamRes.status);

          const passthroughResponseHeaders = [
            'content-type',
            'content-range',
            'range-unit',
            'x-total-count',
            'content-location',
            'preference-applied',
          ];
          for (const h of passthroughResponseHeaders) {
            const val = upstreamRes.headers.get(h);
            if (val) {
              res.setHeader(h, val);
            }
          }

          const arrayBuf = await upstreamRes.arrayBuffer();
          res.send(Buffer.from(arrayBuf));
        } finally {
          clearTimeout(timeout);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        res.status(502).json({
          message: `Global Relay Proxy Error: ${msg}`,
        });
      }
    }
  );

  // Reject any unknown /api/* route with JSON 404
  app.use('/api', (_req, res) => {
    res.status(404).json({ message: 'API route not found.' });
  });

  const distDir = path.resolve(__dirname, 'dist');
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, watch: null },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, watch: null },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SwanArh Global VPN-Free Classroom Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
