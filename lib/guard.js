// Answer checks that run on the server before anything reaches the user.
// The model writes the answer; this code proves it says only what this turn's
// live lookups say. Three layers, in order:
//   extractBlock()   only the format block is shown (narration dropped)
//   verify()         every number and item name comes from this turn's lookups
//   validateFormat() every line matches its template, and a PRICE block's
//                    values are the looked-up item's own fields
// validateFormat closes what verify alone can't see: prices spelled out or in
// non-ASCII digits, a real number moved to the wrong field or item, a wrong
// MODE line, and injected text in lines that should be fixed (NOTE, OFF-TASK…).

export const GUARD_BLOCK =
  'UNVERIFIED .. Answer did not match the live data exactly. Blocked.\n' +
  'NOTE ........ Try the full item name. I will not show unverified prices.';

// The answer formats, copied from prompts/system-prompt.md (a test checks they
// still appear there verbatim). <placeholders> are filled from lookup data or,
// for <query>, checked against the user's question and this turn's searches.
export const TEMPLATES = {
  item: 'ITEM ........ <name>',
  mode: 'MODE ........ <PvP|PvE>',
  fleaAvg: 'FLEA AVG 24H  <fleaAvg24h>   (7-day avg <fleaAvg7d>)',
  lowest: 'LOWEST NOW .. <fleaLowestNow>',
  trend: '24H TREND ... <change24h>',
  noFleaAvg: 'FLEA AVG 24H  not on flea',
  noFleaLowest: 'LOWEST NOW .. not on flea',
  noFleaTrend: '24H TREND ... not on flea',
  trader: 'BEST TRADER . <bestTrader>',
  updated: 'UPDATED ..... <updated> · source: tarkov-market.com',
  priceNote: 'NOTE ........ Flea prices move hourly; confirm in-game before trading.',
  matches: 'MATCHES ..... <matchCount> items match "<query>"',
  matchesNote: 'NOTE ........ Type the full item name to get its price.',
  didYouMean: 'DID YOU MEAN  <name>',
  didYouMeanNote: 'NOTE ........ No exact match for "<query>". Reply "yes" for its price, or type another name.',
  notFound: 'NOT FOUND ... No item matches "<query>" (spelling variations tried too)',
  notFoundNote: "NOTE ........ Try the item's full in-game name or its short name.",
  error: 'ERROR ....... Live price source unavailable. No price shown.',
  errorNote: 'NOTE ........ Try again in a minute. I will not guess prices.',
  offTask: 'OFF-TASK .... I only look up current item prices.',
  offTaskNote: 'NOTE ........ Try: "ledx", "gpu pve", "price of salewa".',
};

// The model sometimes narrates ("Exact match found …") despite rule 11. Keep
// only the format block: from the first line that starts with a format label
// through the first NOTE line after it (every format ends with NOTE). If no
// label is found, return the text unchanged so tests and the guard see it.
const BLOCK_START = /^(?:ITEM \.|MATCHES \.|DID YOU MEAN |NOT FOUND \.|ERROR \.|OFF-TASK \.)/m;
export function extractBlock(text) {
  const start = text.search(BLOCK_START);
  if (start === -1) return text;
  const block = text.slice(start);
  const note = block.search(/^NOTE \.+ .*$/m);
  if (note === -1) return block.trim();
  const end = block.indexOf('\n', note);
  return (end === -1 ? block : block.slice(0, end)).trim();
}

// Every number in the reply must appear verbatim in a tool result from this
// turn (or in the user's own question, e.g. "m4"). Label digits are fine:
// 24 ("FLEA AVG 24H", "24H TREND") and 7 ("7-day avg").
// Every item name the reply presents (ITEM, DID YOU MEAN, MATCHES bullets)
// must be a name a lookup returned this turn, so suggestions can't come from memory.
export function verify(reply, toolResults, question = '') {
  // Whole numbers with optional thousands groups and decimals. The groups must be
  // exactly 3 digits so a JSON separator ("matchCount":5,) isn't swallowed.
  const numbersIn = (s) => s.match(/\d+(?:,\d{3})*(?:\.\d+)?/g) ?? [];
  const allowed = new Set(['24', '7', ...numbersIn(toolResults.join('\n') + '\n' + question)]);
  const unverified = numbersIn(reply).filter((n) => !allowed.has(n));

  const known = new Set(lookups(toolResults).flatMap((r) => r.matches.map((m) => m.name)));
  const named = [...reply.matchAll(/^(?:ITEM \.+ |DID YOU MEAN +| +- )(.+)$/gm)].map((m) => m[1].trim());
  unverified.push(...named.filter((n) => !known.has(n)).map((n) => `name: ${n}`));

  return { passed: unverified.length === 0, unverified };
}

// Line-by-line check against the templates. Whitespace runs are collapsed on
// both sides so dot-padding and spacing differences don't matter; every other
// character must match exactly.
export function validateFormat(answer, toolResults, question = '') {
  const results = lookups(toolResults);
  const lines = answer.split('\n').map(norm).filter(Boolean);
  const first = lines[0] ?? '';
  const problems = [];

  // A quoted <query> must be the user's own words or something searched this turn,
  // so it can't carry injected text.
  const queryOk = (q) => {
    const l = q.toLowerCase();
    return l.length > 0 && (question.toLowerCase().includes(l) || results.some((r) => String(r.query).toLowerCase() === l));
  };
  const known = (name) => results.some((r) => r.matches.some((m) => m.name === name));
  const exact = (expected) => {
    const want = expected.map(norm);
    if (want.length !== lines.length) problems.push(`format: expected ${want.length} lines, got ${lines.length}`);
    want.forEach((w, i) => { if (lines[i] !== undefined && lines[i] !== w) problems.push(`format: line ${i + 1} "${lines[i]}" should be "${w}"`); });
  };

  if (first.startsWith('ITEM ')) {
    const [name] = capture(TEMPLATES.item, first) ?? [];
    // The same name can come back from more than one search (e.g. PvP then PvE);
    // the block passes if it equals the expected block for any of them.
    const candidates = results.flatMap((r) => r.matches.filter((m) => m.name === name).map((m) => expectedPrice(m, r.gameMode)));
    if (!candidates.length) problems.push(`format: ITEM "${name ?? first}" was not returned by a lookup`);
    else if (!candidates.some((c) => c.length === lines.length && c.every((l, i) => l === lines[i]))) {
      const c = candidates[0];
      const i = c.findIndex((l, j) => l !== lines[j]);
      problems.push(i === -1 ? `format: expected ${c.length} lines, got ${lines.length}` : `format: line ${i + 1} "${lines[i] ?? ''}" should be "${c[i]}"`);
    }
  } else if (first.startsWith('MATCHES ')) {
    const [count, query] = capture(TEMPLATES.matches, first) ?? [];
    const bullets = lines.slice(1, -1);
    const names = bullets.map((b) => b.match(/^- (.+)$/)?.[1]);
    if (count === undefined) problems.push(`format: bad MATCHES line "${first}"`);
    else {
      if (!/^\d+$/.test(count) || Number(count) !== bullets.length) problems.push(`format: MATCHES count ${count} but ${bullets.length} items listed`);
      if (!queryOk(query)) problems.push(`format: quoted query "${query}" is not the user's words or a search`);
    }
    if (!bullets.length) problems.push('format: MATCHES lists no items');
    names.forEach((n, i) => { if (!n || !known(n)) problems.push(`format: MATCHES item "${bullets[i]}" was not returned by a lookup`); });
    if (lines.at(-1) !== norm(TEMPLATES.matchesNote)) problems.push(`format: last line should be "${norm(TEMPLATES.matchesNote)}"`);
  } else if (first.startsWith('DID YOU MEAN ')) {
    const [name] = capture(TEMPLATES.didYouMean, first) ?? [];
    const [query] = capture(TEMPLATES.didYouMeanNote, lines[1] ?? '') ?? [];
    if (lines.length !== 2) problems.push(`format: expected 2 lines, got ${lines.length}`);
    if (!name || !known(name)) problems.push(`format: suggestion "${name ?? first}" was not returned by a lookup`);
    if (query === undefined) problems.push(`format: bad DID YOU MEAN note "${lines[1] ?? ''}"`);
    else if (!queryOk(query)) problems.push(`format: quoted query "${query}" is not the user's words or a search`);
  } else if (first.startsWith('NOT FOUND ')) {
    const [query] = capture(TEMPLATES.notFound, first) ?? [];
    if (query === undefined) problems.push(`format: bad NOT FOUND line "${first}"`);
    else if (!queryOk(query)) problems.push(`format: quoted query "${query}" is not the user's words or a search`);
    exact([first, TEMPLATES.notFoundNote]);
  } else if (first.startsWith('ERROR ')) {
    exact([TEMPLATES.error, TEMPLATES.errorNote]);
  } else if (first.startsWith('OFF-TASK ')) {
    exact([TEMPLATES.offTask, TEMPLATES.offTaskNote]);
  } else {
    problems.push(`format: reply does not start with a format label: "${first.slice(0, 40)}"`);
  }
  return { passed: problems.length === 0, problems };
}

// The PRICE block this item's lookup data requires, line by line (rule 8 for no flea price).
function expectedPrice(m, gameMode) {
  const na = (v) => v ?? 'n/a';
  const flea = m.fleaAvg24h == null
    ? [TEMPLATES.noFleaAvg, TEMPLATES.noFleaLowest, TEMPLATES.noFleaTrend]
    : [
      fill(TEMPLATES.fleaAvg, { fleaAvg24h: m.fleaAvg24h, fleaAvg7d: na(m.fleaAvg7d) }),
      fill(TEMPLATES.lowest, { fleaLowestNow: na(m.fleaLowestNow) }),
      fill(TEMPLATES.trend, { change24h: na(m.change24h) }),
    ];
  return [
    fill(TEMPLATES.item, { name: m.name }),
    fill(TEMPLATES.mode, { 'PvP|PvE': gameMode === 'pve' ? 'PvE' : 'PvP' }),
    ...flea,
    fill(TEMPLATES.trader, { bestTrader: na(m.bestTrader) }),
    fill(TEMPLATES.updated, { updated: na(m.updated) }),
    TEMPLATES.priceNote,
  ].map(norm);
}

// Successful lookups from this turn's raw tool-result strings.
function lookups(toolResults) {
  return toolResults.flatMap((r) => {
    try { const d = JSON.parse(r); return Array.isArray(d?.matches) ? [d] : []; } catch { return []; }
  });
}

const norm = (s) => s.replace(/\s+/g, ' ').trim();
const fill = (t, vars) => t.replace(/<([^>]+)>/g, (_, k) => vars[k]);
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Match a line against a template; returns the placeholder values in order, or null.
function capture(template, line) {
  const re = new RegExp('^' + norm(template).split(/(<[^>]+>)/).map((p) => (p.startsWith('<') ? '(.+?)' : escape(p))).join('') + '$');
  return line.match(re)?.slice(1) ?? null;
}
