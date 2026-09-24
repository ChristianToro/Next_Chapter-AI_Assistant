// One question in, one formatted block out.
// Claude (Messages API) + one tool (lookup_item) + a server-side guard
// that refuses any reply containing a number the live data didn't provide.

import { readFileSync } from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import { lookupItem } from './tarkov.js';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
const SYSTEM_PROMPT = readFileSync(new URL('../prompts/system-prompt.md', import.meta.url), 'utf8');
const EXAMPLES = JSON.parse(readFileSync(new URL('../prompts/examples.json', import.meta.url), 'utf8'))
  .flatMap((ex) => ex.messages);

const TOOLS = [{
  name: 'lookup_item',
  description: 'Search Escape From Tarkov items by name and return live flea-market and trader prices (up to 5 matches).',
  strict: true,
  input_schema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Item name or common short name, e.g. "ledx", "graphics card".' },
      gameMode: { type: 'string', enum: ['regular', 'pve'], description: 'regular = PvP.' },
    },
    required: ['name', 'gameMode'],
    additionalProperties: false,
  },
}];

const MAX_TOOL_ROUNDS = 3;

export const GUARD_BLOCK =
  'UNVERIFIED .. Answer contained numbers or item names not found in live data. Blocked.\n' +
  'NOTE ........ Try the full item name. I will not show unverified prices.';

let client; // created on first ask() so importing verify() needs no API key

export async function ask(question, mode = 'regular', { guard = true } = {}) {
  client ??= new Anthropic(); // reads ANTHROPIC_API_KEY
  const messages = [...EXAMPLES, { role: 'user', content: `[mode: ${mode}] ${question}` }];
  const toolResults = []; // raw JSON strings from THIS turn only (not the few-shot data)
  const searches = []; // what the model looked up, for logs and the reliability report
  let nudged = false;

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const response = await create(messages, round < MAX_TOOL_ROUNDS);

    if (response.stop_reason === 'refusal') throw new Error('model declined the request');
    if (response.stop_reason === 'max_tokens') throw new Error('model reply was cut off (max_tokens)');

    // Push full content (incl. thinking blocks) back unchanged, as the API requires.
    messages.push({ role: 'assistant', content: response.content });
    const calls = response.content.filter((b) => b.type === 'tool_use');

    if (response.stop_reason !== 'tool_use' || !calls.length) {
      const raw = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();

      // Answered without looking anything up (e.g. replayed a few-shot answer)?
      // Ask once more before the guard has to block it. Off-task needs no lookup.
      if (!toolResults.length && !raw.startsWith('OFF-TASK') && !nudged && round < MAX_TOOL_ROUNDS) {
        nudged = true;
        messages.push({ role: 'user', content: 'You answered without calling lookup_item. Call lookup_item for the item in my last question now, then answer from its result only.' });
        continue;
      }

      const check = verify(raw, toolResults, question);
      const reply = guard && !check.passed ? GUARD_BLOCK : raw;
      return { reply, raw, toolCalls: toolResults.length, searches, nudged, guard: { enabled: guard, ...check } };
    }

    // All results go back in ONE user message.
    const results = [];
    for (const call of calls) {
      const data = await lookupItem(call.input.name ?? '', call.input.gameMode);
      const content = JSON.stringify(data);
      toolResults.push(content);
      searches.push({ name: call.input.name, gameMode: call.input.gameMode, ...(data.error ? { error: data.error } : { matches: data.matches.map((m) => m.name) }) });
      results.push({ type: 'tool_result', tool_use_id: call.id, content, ...(data.error && { is_error: true }) });
    }
    messages.push({ role: 'user', content: results });
  }
  throw new Error('tool loop did not finish');
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

  const known = new Set(toolResults.flatMap((r) => {
    try { return JSON.parse(r).matches?.map((m) => m.name) ?? []; } catch { return []; }
  }));
  const named = [...reply.matchAll(/^(?:ITEM \.+ |DID YOU MEAN +| +- )(.+)$/gm)].map((m) => m[1].trim());
  unverified.push(...named.filter((n) => !known.has(n)).map((n) => `name: ${n}`));

  return { passed: unverified.length === 0, unverified };
}

// Sonnet 5 rejects temperature/top_p; consistency comes from the prompt,
// few-shot examples, pre-formatted tool data and the guard instead.
async function create(messages, allowTools) {
  try {
    return await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      tool_choice: { type: allowTools ? 'auto' : 'none' },
      output_config: { effort: 'low' },
      messages,
    });
  } catch (err) {
    // Bad key -> AuthenticationError (401). No key at all -> the SDK throws a
    // plain Error before sending, so treat any non-API error with no key set the same way.
    const noKey = !(err instanceof Anthropic.APIError) && !process.env.ANTHROPIC_API_KEY;
    if (err instanceof Anthropic.AuthenticationError || noKey) {
      throw new Error('ANTHROPIC_API_KEY is missing or invalid (copy .env.example to .env)');
    }
    throw err;
  }
}
