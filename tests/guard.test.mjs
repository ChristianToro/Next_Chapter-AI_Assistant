// Offline unit test for the anti-hallucination guard. No API keys needed.
// Run: node --test tests/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verify } from '../lib/assistant.js';

const tool = JSON.stringify({ matches: [{ fleaAvg24h: '₽ 412,300', change24h: '+2.1%', updated: '2026-09-24 14:02 UTC' }] });

test('passes when every number comes from the tool result', () => {
  const reply = 'FLEA AVG 24H  ₽ 412,300\n24H TREND ... +2.1%\nUPDATED ..... 2026-09-24 14:02 UTC';
  assert.equal(verify(reply, [tool]).passed, true);
});

test('blocks an invented price', () => {
  const r = verify('FLEA AVG 24H  ₽ 450,000', [tool]);
  assert.equal(r.passed, false);
  assert.deepEqual(r.unverified, ['450,000']);
});

test('blocks a rounded price (412,000 is not 412,300)', () => {
  assert.equal(verify('₽ 412,000', [tool]).passed, false);
});

test('matches whole numbers, not substrings (412 is not 412,300)', () => {
  assert.equal(verify('₽ 412', [tool]).passed, false);
});

test('blocks any price when no tool was called (answer from memory)', () => {
  assert.equal(verify('ITEM ........ LEDX\nFLEA AVG 24H  ₽ 900,000', []).passed, false);
});

test('allows numbers from the user question and label digits', () => {
  assert.equal(verify('OFF-TASK .... no m4 builds. 24H 7-day', [], 'best m4 build').passed, true);
});

// Shaped like a real lookupItem() result, where numbers are followed by JSON commas.
const lookup = JSON.stringify({
  gameMode: 'regular', query: 'key', source: 'tarkov-market.com', matchCount: 5,
  matches: [{ name: 'Key tool', fleaAvg24h: '₽ 1,234,567' }, { name: 'Health Resort west wing room 219 key', fleaAvg24h: null }],
});

test('reads a JSON number followed by a comma as the number (matchCount 5)', () => {
  assert.equal(verify('MATCHES ..... 5 items match "key"\n  - Key tool', [lookup]).passed, true);
});

test('keeps thousands separators and item-name digits intact', () => {
  assert.equal(verify('FLEA AVG 24H  ₽ 1,234,567\n  - Health Resort west wing room 219 key', [lookup]).passed, true);
});

test('blocks an item name the lookup did not return (suggestion from memory)', () => {
  const r = verify('DID YOU MEAN  LEDX Skin Transilluminator', [lookup]);
  assert.equal(r.passed, false);
  assert.deepEqual(r.unverified, ['name: LEDX Skin Transilluminator']);
});

test('allows a DID YOU MEAN name the lookup did return', () => {
  assert.equal(verify('DID YOU MEAN  Key tool\nNOTE ........ No exact match for "kee tool".', [lookup], 'kee tool').passed, true);
});
