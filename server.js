// Tiny zero-dependency server: serves the terminal UI and POST /api/ask.
// Run: node server.js   (GUARD=off node server.js to demo the failure mode)

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

try { process.loadEnvFile(); } catch { /* no .env: rely on real env vars */ }
const { ask } = await import('./lib/assistant.js');

const PORT = Number(process.env.PORT) || 3000;
const GUARD = process.env.GUARD !== 'off';
const PUBLIC = new URL('./public/', import.meta.url).pathname;
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };

createServer(async (req, res) => {
  try {
    if (req.method === 'POST' && req.url === '/api/ask') {
      const { question = '', mode = 'regular' } = JSON.parse(await readBody(req));
      if (!question.trim() || question.length > 200) return send(res, 400, { error: 'question must be 1-200 chars' });
      const result = await ask(question.trim(), mode === 'pve' ? 'pve' : 'regular', { guard: GUARD });
      console.log(`[ask] mode=${mode} q=${JSON.stringify(question)} tools=${result.toolCalls} guard=${result.guard.passed ? 'ok' : 'BLOCKED ' + result.guard.unverified}`);
      return send(res, 200, result);
    }

    const path = normalize(join(PUBLIC, req.url === '/' ? 'index.html' : req.url.split('?')[0]));
    if (!path.startsWith(PUBLIC)) return send(res, 403, { error: 'forbidden' });
    const file = await readFile(path).catch(() => null);
    if (!file) return send(res, 404, { error: 'not found' });
    res.writeHead(200, { 'Content-Type': TYPES[extname(path)] ?? 'application/octet-stream' });
    res.end(file);
  } catch (err) {
    console.error(err);
    send(res, 500, { error: err.message });
  }
}).listen(PORT, () => console.log(`Tarkov Price Terminal on http://localhost:${PORT}  (guard ${GUARD ? 'ON' : 'OFF'})`));

function send(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
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
