// Reliability test: 6 fixed inputs x 2 runs through the REAL pipeline
// (Claude + live Tarkov Market API). Writes TEST-RESULTS.md.
// Run: node tests/reliability.mjs

import { writeFileSync } from 'node:fs';

try { process.loadEnvFile(); } catch {}
const { ask } = await import('../lib/assistant.js');

const RUNS = 2;
const PRICE_LABELS = ['ITEM', 'MODE', 'FLEA AVG 24H', 'LOWEST NOW', '24H TREND', 'BEST TRADER', 'UPDATED', 'NOTE'];
const BLOCK_START = /^(ITEM \.|MATCHES \.|DID YOU MEAN |NOT FOUND \.|ERROR \.|OFF-TASK \.|UNVERIFIED \.)/;
const NO_FLEA = /^FLEA AVG 24H  not on flea\nLOWEST NOW \.\. not on flea\n24H TREND \.\.\. not on flea$/m;

const CASES = [
  { input: 'LEDX', mode: 'regular', expect: 'price' },
  { input: 'how much is a gpu in pve', mode: 'regular', expect: 'price', expectMode: 'PvE' },
  { input: 'key', mode: 'regular', expect: 'matches' },
  { input: 'ledz', mode: 'regular', expect: 'didyoumean' },
  // Confirmed bannedOnFlea: true via the API (2026-09-24). Name matches exactly among 3 results.
  { input: 'Physical Bitcoin', mode: 'regular', expect: 'noflea' },
  { input: 'best m4 build for labs', mode: 'regular', expect: 'offtask' },
];

function judge(c, r) {
  const t = r.reply;
  if (r.crashed) return { ok: false, fails: [`run crashed: ${r.crashed}`] };
  const fails = [];
  if (!r.guard.passed) fails.push(`guard blocked: ${r.guard.unverified.join(', ')}`);
  if (t.startsWith('ERROR')) return { ok: false, fails: ['price source down (ERROR block shown, no guess — safe but not a pass)'] };
  if (!BLOCK_START.test(t)) fails.push(`reply does not start with a format label: "${t.split('\n')[0].slice(0, 40)}"`);

  const hasLabelsInOrder = () => {
    let at = -1;
    return PRICE_LABELS.every((l) => { const i = t.indexOf(l, at + 1); if (i <= at) return false; at = i; return true; });
  };
  switch (c.expect) {
    case 'price':
    case 'noflea':
      if (r.toolCalls < 1) fails.push('no tool call');
      // Only judge the lines of a PRICE block when there is one.
      if (!hasLabelsInOrder()) { fails.push(`expected PRICE block, got "${t.split('\n')[0].slice(0, 40)}"`); break; }
      if (c.expectMode && !t.includes(`MODE ........ ${c.expectMode}`)) fails.push(`mode not ${c.expectMode}`);
      if (c.expect === 'noflea' && !NO_FLEA.test(t)) fails.push('expected the three exact "not on flea" lines');
      break;
    case 'matches':
      if (!t.startsWith('MATCHES')) fails.push('expected MATCHES block');
      if (t.includes('₽')) fails.push('showed a price while ambiguous');
      break;
    case 'didyoumean':
      if (!t.startsWith('DID YOU MEAN')) fails.push('expected DID YOU MEAN block');
      if (t.includes('₽')) fails.push('showed a price before confirmation');
      if (r.toolCalls < 2) fails.push('did not retry with a corrected spelling');
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
    catch (err) { r = { reply: `ERROR ....... ${err.message}`, crashed: err.message, toolCalls: 0, guard: { passed: true, unverified: [] } }; }
    outs.push({ r, v: judge(c, r) });
    console.log(`${outs.at(-1).v.ok ? 'PASS' : 'FAIL'}  run ${i + 1}  ${c.input}`);
  }
  const firstLines = outs.map((o) => o.r.reply.split('\n')[0]);
  const consistent = outs.every((o) => o.r.reply === outs[0].r.reply) ? 'identical'
    : firstLines.every((l) => l === firstLines[0]) ? 'same structure' : 'DIFFERENT';
  // Narration the server trimmed isn't a failure (the user never sees it), but
  // it shows the model still ignoring rule 11, so it's noted.
  const trimmedRuns = outs.filter((o) => o.r.trimmed).length;
  const notes = [...outs.flatMap((o) => o.v.fails), ...(trimmedRuns ? [`narration trimmed in ${trimmedRuns}/${RUNS} runs`] : [])];
  rows.push(`| \`${c.input}\` | ${c.mode} | ${c.expect} | ${outs.map((o) => (o.v.ok ? 'PASS' : 'FAIL')).join(' / ')} | ${consistent} | ${notes.join('; ') || '—'} |`);
  raw.push(`### \`${c.input}\` (default mode: ${c.mode})\n` + outs.map((o, i) => runDetail(o.r, i)).join('\n'));
}

// What the model searched, whether it had to be nudged into a lookup, and,
// when the guard blocked the reply, what the model actually wrote.
function runDetail(r, i) {
  const searches = (r.searches ?? []).map((s) => `"${s.name}" (${s.gameMode}) → ${s.error ?? (s.matches.length ? s.matches.join(' | ') : '0 matches')}`);
  const lines = [
    `Run ${i + 1} — tool calls: ${r.toolCalls}, guard: ${r.guard.passed ? 'passed' : 'BLOCKED'}${r.nudged ? ', nudged to look up' : ''}${r.trimmed ? ', narration trimmed' : ''}`,
    ...searches.map((s) => `- search ${s}`),
    '```', r.reply, '```',
  ];
  if (r.raw && (!r.guard.passed || r.trimmed)) lines.push(r.guard.passed ? 'Model reply before trimming:' : 'Blocked model reply:', '```', r.raw, '```');
  return lines.join('\n');
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
