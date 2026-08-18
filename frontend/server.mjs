/**
 * Static file server for the built frontend.
 *
 * Replaces `serve`, which has no middleware hook and so gave us nowhere to
 * enforce the source-IP allowlist. Routing behaviour is unchanged: the SPA
 * rewrites are still read from serve.json, which remains the single source of
 * truth for which paths fall through to index.html.
 */

import express from 'express';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createIpAllowlist, loadConfigFromEnv, logStartupState } from './ipAccess.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const distDir = join(here, 'dist');
const indexHtml = join(distDir, 'index.html');
const port = Number(process.env.PORT) || 3000;

const app = express();

const accessConfig = loadConfigFromEnv();
// Match the allowlist's hop counting so req.ip agrees with it.
app.set('trust proxy', accessConfig.proxyHops);
app.disable('x-powered-by');

// Liveness probe, before the allowlist so Railway's health checks still pass
// when the allowlist is active (it is also in the default bypass list).
app.get('/healthz', (_req, res) => res.status(200).json({ ok: true }));

logStartupState(accessConfig);
app.use(createIpAllowlist(accessConfig));

app.use(
  express.static(distDir, {
    index: false,
    // Hashed Vite assets are immutable; index.html must never be cached or
    // clients pin to a stale bundle after a deploy.
    setHeaders: (res, filePath) => {
      if (filePath.startsWith(join(distDir, 'assets'))) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  }),
);

// SPA rewrites, preserved verbatim from serve.json.
const { rewrites = [] } = JSON.parse(readFileSync(join(here, 'serve.json'), 'utf8'));
for (const { source } of rewrites) {
  app.get(source, (_req, res) => res.sendFile(indexHtml));
}

app.use((_req, res) => res.status(404).type('text/plain').send('Not Found'));

app.listen(port, '0.0.0.0', () => {
  console.log(`Frontend serving ${distDir} on port ${port}`);
});
