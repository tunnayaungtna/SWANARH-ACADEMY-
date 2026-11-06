import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_TARGET_ORIGIN =
  process.env.VITE_SUPABASE_URL || 'https://wxfassadxuxfvywvnlxs.supabase.co';
const SUPABASE_DEFAULT_KEY =
  process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_mhYrcHRIdU-2EXQoXATDaw_s4vO4ZXv';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Global CORS support so students on www.swanarhclassroom.online or any mirror domain
  // can transparently relay Supabase queries through this Singapore Cloud Run server without VPN
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD'
    );
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Origin, X-Requested-With, Content-Type, Accept, Authorization, apikey, Prefer, Range, x-client-info, x-supabase-api-version'
    );
    res.setHeader(
      'Access-Control-Expose-Headers',
      'Content-Range, Range-Unit, X-Total-Count, Content-Location'
    );
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  // Health check endpoint for Geo-Resilient multi-route detector
  app.get('/api/health', (_req, res) => {
    res.status(200).json({
      ok: true,
      region: 'global-vpn-free-relay',
      timestamp: Date.now(),
    });
  });

  // Raw body parser specifically for /api/sb-proxy so POST/PATCH/UPSERT payloads forward cleanly
  app.use(
    '/api/sb-proxy',
    express.raw({ type: '*/*', limit: '10mb' }),
    async (req, res) => {
      try {
        const subPath = req.originalUrl.replace(/^\/api\/sb-proxy/, '') || '/';
        const targetUrl = `${SUPABASE_TARGET_ORIGIN.replace(/\/+$/, '')}${subPath.startsWith('/') ? subPath : `/${subPath}`}`;

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

        const upstreamRes = await fetch(targetUrl, {
          method: req.method,
          headers: forwardHeaders,
          body: hasBody ? new Uint8Array(req.body) : undefined,
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
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        res.status(502).json({
          message: `Global Relay Proxy Error: ${msg}`,
          hint: 'Automatic failover route encountered an upstream network issue.',
        });
      }
    }
  );

  const distDir = path.resolve(__dirname, 'dist');
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
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
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SwanArh Global VPN-Free Classroom Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
