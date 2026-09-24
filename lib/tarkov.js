// Live price lookup against the Tarkov Market API (tarkov-market.com).
// Needs a Pro API key in TARKOV_MARKET_API_KEY. Terms: personal use; public
// projects must credit tarkov-market.com as the data provider.
// This is the ONLY source of numbers the assistant is allowed to show.

const BASE = 'https://api.tarkov-market.app/api/v1';

export async function lookupItem(name, gameMode = 'regular') {
  const mode = gameMode === 'pve' ? 'pve' : 'regular';
  const key = process.env.TARKOV_MARKET_API_KEY;
  if (!key) return { error: 'price source not configured: TARKOV_MARKET_API_KEY is not set' };

  // PvP is the default collection; PvE lives under /pve. Up to 5 matches, exact first.
  const url = `${BASE}${mode === 'pve' ? '/pve' : ''}/item?${new URLSearchParams({ q: name, lang: 'en' })}`;
  let res;
  try {
    // Key goes in a header, not the query string, so it never lands in URLs or logs.
    res = await fetch(url, { headers: { 'x-api-key': key }, signal: AbortSignal.timeout(15000) });
  } catch (err) {
    return { error: `price source unreachable: ${err.message}` };
  }

  const body = await res.json().catch(() => null);
  if (res.status === 401) return { error: 'price source rejected the API key (401)' };
  if (res.status === 429) return { error: 'price source rate limit hit (429)' };
  if (!res.ok || !Array.isArray(body)) return { error: `price source error: ${body?.error ?? `HTTP ${res.status}`}` };

  // Trim to what the model needs, and pre-format every number as the exact
  // string it should print. The model copies; it never does arithmetic or
  // rounding, so the guard in assistant.js can check numbers verbatim.
  // Field names match the ones the system prompt and examples expect; fields
  // this source doesn't provide (24h low/high, 48h change) are null -> "n/a".
  const matches = body.slice(0, 5).map((it) => {
    const onFlea = !it.bannedOnFlea && it.haveMarketData !== false;
    return {
      name: it.name,
      shortName: it.shortName,
      bannedOnFlea: Boolean(it.bannedOnFlea),
      fleaAvg24h: onFlea ? rub(it.avg24hPrice) : null,
      fleaAvg7d: onFlea ? rub(it.avg7daysPrice) : null,
      fleaLowestNow: onFlea ? rub(it.price) : null,
      flea24hLow: null,
      flea24hHigh: null,
      change24h: onFlea ? pct(it.diff24h) : null,
      change48h: null,
      bestTrader: trader(it),
      updated: stamp(it.updated),
      link: it.link,
    };
  });

  return { gameMode: mode, query: name, source: 'tarkov-market.com', matchCount: matches.length, matches };
}

// 0 / null from the API means "no price".
const rub = (n) => (n ? `₽ ${n.toLocaleString('en-US')}` : null);
const pct = (n) => (n == null ? null : `${n > 0 ? '+' : ''}${n.toFixed(1)}%`);
const stamp = (iso) => (iso ? `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC` : null);

// Traders pay in ₽, $ or €; show the native price, plus the ₽ value when it differs.
function trader(it) {
  if (!it.traderName || !it.traderPrice) return null;
  const cur = it.traderPriceCur || '₽';
  const native = `${cur} ${it.traderPrice.toLocaleString('en-US')}`;
  return cur === '₽' || !it.traderPriceRub ? `${it.traderName} ${native}` : `${it.traderName} ${native} (${rub(it.traderPriceRub)})`;
}
