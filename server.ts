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
const RATE_LIMIT_MAX_REQUESTS = 360;

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
  if (subPath.startsWith('//') || subPath.includes('..') || subPath.includes('\\')) {
    return false;
  }
  return (
    subPath.startsWith('/rest/v1/') ||
    subPath.startsWith('/auth/v1/') ||
    subPath.startsWith('/storage/v1/')
  );
}

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  const PORT = Number(process.env.PORT) || 3000;

  // Security & Global CORS headers so students in Myanmar and worldwide can access seamlessly
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    res.setHeader('Access-Control-Allow-Origin', '*');
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
        if (targetUrl.origin !== activeTargetOrigin) {
          res.status(403).json({
            message: 'Invalid target origin.',
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

        if (!forwardHeaders.has('apikey')) {
          forwardHeaders.set('apikey', SUPABASE_DEFAULT_KEY);
        }
        if (!forwardHeaders.has('authorization')) {
          forwardHeaders.set('authorization', `Bearer ${SUPABASE_DEFAULT_KEY}`);
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
