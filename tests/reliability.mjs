// Reliability test: 5 fixed inputs x 2 runs through the REAL pipeline
// (Claude + live tarkov.dev). Writes TEST-RESULTS.md.
// Run: node tests/reliability.mjs

import { writeFileSync } from 'node:fs';

try { process.loadEnvFile(); } catch {}
const { ask } = await import('../lib/assistant.js');

const RUNS = 2;
const PRICE_LABELS = ['ITEM', 'MODE', 'FLEA AVG 24H', 'LOWEST NOW', '48H TREND', 'BEST TRADER', 'UPDATED', 'NOTE'];

const CASES = [
  { input: 'LEDX', mode: 'regular', expect: 'price' },
  { input: 'how much is a gpu in pve', mode: 'regular', expect: 'price', expectMode: 'PvE' },
  { input: 'key', mode: 'regular', expect: 'matches' },
  { input: 'Red Rebel ice pick', mode: 'regular', expect: 'price-or-noflea' },
  { input: 'best m4 build for labs', mode: 'regular', expect: 'offtask' },
];

function judge(c, r) {
  const t = r.reply;
  const fails = [];
  if (!r.guard.passed) fails.push(`guard blocked: ${r.guard.unverified.join(' ')}`);
  if (t.startsWith('ERROR')) return { ok: false, fails: ['price source down (ERROR block shown, no guess — safe but not a pass)'] };

  const hasLabelsInOrder = () => {
    let at = -1;
    return PRICE_LABELS.every((l) => { const i = t.indexOf(l, at + 1); if (i <= at) return false; at = i; return true; });
  };
  switch (c.expect) {
    case 'price':
      if (!hasLabelsInOrder()) fails.push('PRICE labels missing/out of order');
      if (r.toolCalls < 1) fails.push('no tool call');
      if (c.expectMode && !t.includes(`MODE ........ ${c.expectMode}`)) fails.push(`mode not ${c.expectMode}`);
      break;
    case 'price-or-noflea':
      if (!hasLabelsInOrder() && !t.startsWith('MATCHES')) fails.push('neither PRICE nor MATCHES format');
      if (r.toolCalls < 1) fails.push('no tool call');
      break;
    case 'matches':
      if (!t.startsWith('MATCHES')) fails.push('expected MATCHES block');
      if (t.includes('₽')) fails.push('showed a price while ambiguous');
      break;
    case 'offtask':
      if (!t.startsWith('OFF-TASK')) fails.push('expected OFF-TASK block');
      if (/\d{3,}/.test(t)) fails.push('contains numbers');
      break;
  }
  return { ok: fails.length === 0, fails };
}

const rows = [];
const raw = [];
for (const c of CASES) {
  const outs = [];
  for (let i = 0; i < RUNS; i++) {
    let r;
    try { r = await ask(c.input, c.mode); }
    catch (err) { r = { reply: `ERROR ....... ${err.message}`, toolCalls: 0, guard: { passed: true, unverified: [] } }; }
    outs.push({ r, v: judge(c, r) });
    console.log(`${outs.at(-1).v.ok ? 'PASS' : 'FAIL'}  run ${i + 1}  ${c.input}`);
  }
  const firstLines = outs.map((o) => o.r.reply.split('\n')[0]);
  const consistent = outs.every((o) => o.r.reply === outs[0].r.reply) ? 'identical'
    : firstLines.every((l) => l === firstLines[0]) ? 'same structure' : 'DIFFERENT';
  rows.push(`| \`${c.input}\` | ${c.mode} | ${c.expect} | ${outs.map((o) => (o.v.ok ? 'PASS' : 'FAIL')).join(' / ')} | ${consistent} | ${outs.flatMap((o) => o.v.fails).join('; ') || '—'} |`);
  raw.push(`### \`${c.input}\` (default mode: ${c.mode})\n` + outs.map((o, i) =>
    `Run ${i + 1} — tool calls: ${o.r.toolCalls}, guard: ${o.r.guard.passed ? 'passed' : 'BLOCKED'}\n\`\`\`\n${o.r.reply}\n\`\`\``).join('\n'));
}

const md = `# Reliability Test Results

Run: ${new Date().toISOString()} · model: ${process.env.ANTHROPIC_MODEL || 'claude-sonnet-5'} · effort low · ${RUNS} runs per input

| Input | Mode | Expected behavior | Runs | Consistency | Notes |
|---|---|---|---|---|---|
${rows.join('\n')}

"identical" = byte-for-byte same output across runs. "same structure" = same block type (prices may tick between runs).

## Raw outputs

${raw.join('\n\n')}
`;
writeFileSync(new URL('../TEST-RESULTS.md', import.meta.url), md);
console.log('\nWrote TEST-RESULTS.md');
