// Tiny zero-dependency server: serves the terminal UI and POST /api/ask.
// Run: node server.js   (GUARD=off node server.js to demo the failure mode)
// Local by default: binds 127.0.0.1 and rate-limits /api/ask, because every
// question spends Anthropic credit and Tarkov Market quota (a Pro key that is
// for personal use only). Set HOST=0.0.0.0 only for a trusted LAN demo.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

try { process.loadEnvFile(); } catch { /* no .env: rely on real env vars */ }
const { ask, UserFacingError } = await import('./lib/assistant.js');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const GUARD = process.env.GUARD !== 'off';
const PUBLIC = new URL('./public/', import.meta.url).pathname;
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };

// Sent with every response. The UI already renders with textContent; these are
// defense in depth (no foreign scripts, no framing, no MIME sniffing).
const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

// Sliding one-minute window: per client IP, and for the whole server.
const WINDOW_MS = 60_000;
const PER_IP_LIMIT = 20;
const GLOBAL_LIMIT = 60;
const hitsByIp = new Map();
let globalHits = [];

createServer(async (req, res) => {
  try {
    if (req.method === 'POST' && req.url === '/api/ask') {
      if (rateLimited(req.socket.remoteAddress ?? 'unknown')) return send(res, 429, { error: 'rate limit, try again in a minute' });

      let body;
      try { body = JSON.parse(await readBody(req)); } catch { return send(res, 400, { error: 'invalid JSON body' }); }
      const { question, mode = 'regular' } = body ?? {};
      if (typeof question !== 'string' || typeof mode !== 'string') return send(res, 400, { error: 'question and mode must be strings' });
      if (!question.trim() || question.length > 200) return send(res, 400, { error: 'question must be 1-200 chars' });

      const result = await ask(question.trim(), mode === 'pve' ? 'pve' : 'regular', { guard: GUARD });
      console.log(`[ask] mode=${mode} q=${JSON.stringify(question)} searches=${JSON.stringify(result.searches.map((s) => s.name))}${result.nudged ? ' nudged' : ''} guard=${result.guard.passed ? 'ok' : 'BLOCKED ' + result.guard.unverified.join('; ')}`);
      // Only what the UI needs. The model's raw text and the guard's reasons stay
      // server-side, so a blocked answer can't be read in the browser's DevTools.
      const { reply, toolCalls, searches, nudged, guard } = result;
      return send(res, 200, { reply, toolCalls, searches, nudged, guard: { enabled: guard.enabled, passed: guard.passed } });
    }

    const path = normalize(join(PUBLIC, req.url === '/' ? 'index.html' : req.url.split('?')[0]));
    if (!path.startsWith(PUBLIC)) return send(res, 403, { error: 'forbidden' });
    const file = await readFile(path).catch(() => null);
    if (!file) return send(res, 404, { error: 'not found' });
    res.writeHead(200, { ...SECURITY_HEADERS, 'Content-Type': TYPES[extname(path)] ?? 'application/octet-stream' });
    res.end(file);
  } catch (err) {
    console.error(err);
    // Only messages written for the user (missing key, refusal…) leave the server.
    send(res, 500, { error: err instanceof UserFacingError ? err.message : 'internal error' });
  }
}).listen(PORT, HOST, () => console.log(`Tarkov Price Terminal on http://${HOST}:${PORT}  (guard ${GUARD ? 'ON' : 'OFF'})`));

function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits) => hits.filter((t) => now - t < WINDOW_MS);
  const mine = recent(hitsByIp.get(ip) ?? []);
  globalHits = recent(globalHits);
  const limited = mine.length >= PER_IP_LIMIT || globalHits.length >= GLOBAL_LIMIT;
  if (!limited) { mine.push(now); globalHits.push(now); }
  if (mine.length) hitsByIp.set(ip, mine); else hitsByIp.delete(ip);
  return limited;
}

function send(res, status, obj) {
  res.writeHead(status, { ...SECURITY_HEADERS, 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 10_000) req.destroy(); });
    req.on('end', () => resolve(data || '{}'));
    req.on('error', reject);
  });
}
