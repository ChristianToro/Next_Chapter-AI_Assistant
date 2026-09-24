// Live price lookup against the free tarkov.dev GraphQL API (no key needed).
// This is the ONLY source of numbers the assistant is allowed to show.

const ENDPOINT = 'https://api.tarkov.dev/graphql';

const QUERY = `
query Lookup($name: String!, $mode: GameMode) {
  items(name: $name, gameMode: $mode, lang: en, limit: 5) {
    name
    shortName
    avg24hPrice
    lastLowPrice
    low24hPrice
    high24hPrice
    changeLast48hPercent
    updated
    link
    sellFor { priceRUB vendor { name } }
  }
}`;

export async function lookupItem(name, gameMode = 'regular') {
  const mode = gameMode === 'pve' ? 'pve' : 'regular';
  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: QUERY, variables: { name, mode } }),
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    return { error: `price source unreachable: ${err.message}` };
  }

  const body = await res.json().catch(() => null);
  if (!body || body.errors || !body.data) {
    const msg = body?.errors?.[0]?.message ?? body?.errors?.[0] ?? `HTTP ${res.status}`;
    return { error: `price source error: ${msg}` };
  }

  // Trim to what the model needs, and pre-format every number as the exact
  // string it should print. The model copies; it never does arithmetic or
  // rounding, so the guard in assistant.js can check numbers verbatim.
  const matches = body.data.items.map((it) => {
    const traders = it.sellFor.filter((s) => s.vendor.name !== 'Flea Market');
    const best = traders.sort((a, b) => b.priceRUB - a.priceRUB)[0];
    return {
      name: it.name,
      shortName: it.shortName,
      fleaAvg24h: rub(it.avg24hPrice),
      fleaLowestNow: rub(it.lastLowPrice),
      flea24hLow: rub(it.low24hPrice),
      flea24hHigh: rub(it.high24hPrice),
      change48h: pct(it.changeLast48hPercent),
      bestTrader: best ? `${best.vendor.name} ${rub(best.priceRUB)}` : null,
      updated: stamp(it.updated),
      link: it.link,
    };
  });

  return { gameMode: mode, query: name, matchCount: matches.length, matches };
}

// 0 / null from the API means "no flea data" (banned or untradeable item).
const rub = (n) => (n ? `₽ ${n.toLocaleString('en-US')}` : null);
const pct = (n) => (n == null ? null : `${n > 0 ? '+' : ''}${n.toFixed(1)}%`);
const stamp = (iso) => (iso ? `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC` : null);
