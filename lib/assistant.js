// One question in, one formatted block out.
// Claude (Messages API) + one tool (lookup_item) + the server-side checks in
// guard.js, which block any reply that says something the live data didn't.

import { readFileSync } from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import { lookupItem } from './tarkov.js';
import { GUARD_BLOCK, extractBlock, verify, validateFormat } from './guard.js';

// Errors whose message is safe and useful to show the user; the server hides all others.
export class UserFacingError extends Error {}

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

let client; // created on first ask() so importing this module needs no API key

export async function ask(question, mode = 'regular', { guard = true } = {}) {
  client ??= new Anthropic(); // reads ANTHROPIC_API_KEY
  const messages = [...EXAMPLES, { role: 'user', content: `[mode: ${mode}] ${question}` }];
  const toolResults = []; // raw JSON strings from THIS turn only (not the few-shot data)
  const searches = []; // what the model looked up, for logs and the reliability report
  let nudged = false;

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const response = await create(messages, round < MAX_TOOL_ROUNDS);

    if (response.stop_reason === 'refusal') throw new UserFacingError('model declined the request');
    if (response.stop_reason === 'max_tokens') throw new UserFacingError('model reply was cut off (max_tokens)');

    // Push full content (incl. thinking blocks) back unchanged, as the API requires.
    messages.push({ role: 'assistant', content: response.content });
    const calls = response.content.filter((b) => b.type === 'tool_use');

    if (response.stop_reason !== 'tool_use' || !calls.length) {
      const raw = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
      const answer = extractBlock(raw); // drop any narration around the format block

      // Answered without looking anything up (e.g. replayed a few-shot answer)?
      // Ask once more before the guard has to block it. Off-task needs no lookup.
      if (!toolResults.length && !answer.startsWith('OFF-TASK') && !nudged && round < MAX_TOOL_ROUNDS) {
        nudged = true;
        messages.push({ role: 'user', content: 'You answered without calling lookup_item. Call lookup_item for the item in my last question now, then answer from its result only.' });
        continue;
      }

      // Numbers/names must come from this turn's lookups, and every line must
      // match its template with the looked-up item's own values.
      const numbers = verify(answer, toolResults, question);
      const format = validateFormat(answer, toolResults, question);
      const check = { passed: numbers.passed && format.passed, unverified: [...numbers.unverified, ...format.problems] };
      const reply = guard && !check.passed ? GUARD_BLOCK : answer;
      return { reply, raw, trimmed: answer !== raw, toolCalls: toolResults.length, searches, nudged, guard: { enabled: guard, ...check } };
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
      throw new UserFacingError('ANTHROPIC_API_KEY is missing or invalid (copy .env.example to .env)');
    }
    throw err;
  }
}
