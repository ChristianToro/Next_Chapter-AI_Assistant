// One question in, one formatted block out.
// OpenAI chat completions + one tool (lookup_item) + a server-side guard
// that refuses any reply containing a number the live data didn't provide.

import { readFileSync } from 'node:fs';
import { lookupItem } from './tarkov.js';

const SYSTEM_PROMPT = readFileSync(new URL('../prompts/system-prompt.md', import.meta.url), 'utf8');
const EXAMPLES = JSON.parse(readFileSync(new URL('../prompts/examples.json', import.meta.url), 'utf8'))
  .flatMap((ex) => ex.messages);

const TOOLS = [{
  type: 'function',
  function: {
    name: 'lookup_item',
    description: 'Search Escape From Tarkov items by name and return live flea-market and trader prices (up to 5 matches).',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Item name or common short name, e.g. "ledx", "graphics card".' },
        gameMode: { type: 'string', enum: ['regular', 'pve'], description: 'regular = PvP.' },
      },
      required: ['name', 'gameMode'],
      additionalProperties: false,
    },
  },
}];

const MAX_TOOL_ROUNDS = 3;

export const GUARD_BLOCK =
  'UNVERIFIED .. Answer contained numbers not found in live data. Blocked.\n' +
  'NOTE ........ Try the full item name. I will not show unverified prices.';

export async function ask(question, mode = 'regular', { guard = true } = {}) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...EXAMPLES,
    { role: 'user', content: `[mode: ${mode}] ${question}` },
  ];
  const toolResults = []; // raw JSON strings from THIS turn only (not the few-shot data)

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const msg = await chat(messages, round < MAX_TOOL_ROUNDS);
    messages.push(msg);

    if (!msg.tool_calls?.length) {
      const raw = (msg.content ?? '').trim();
      const check = verify(raw, toolResults, question);
      const reply = guard && !check.passed ? GUARD_BLOCK : raw;
      return { reply, raw, toolCalls: toolResults.length, guard: { enabled: guard, ...check } };
    }

    for (const call of msg.tool_calls) {
      const args = JSON.parse(call.function.arguments || '{}');
      const result = JSON.stringify(await lookupItem(args.name ?? '', args.gameMode));
      toolResults.push(result);
      messages.push({ role: 'tool', tool_call_id: call.id, content: result });
    }
  }
  throw new Error('tool loop did not finish');
}

// Every number in the reply must appear verbatim in a tool result from this
// turn (or in the user's own question, e.g. "m4"). Label digits 24/48 are fine.
export function verify(reply, toolResults, question = '') {
  const numbersIn = (s) => s.match(/\d[\d,]*(?:\.\d+)?/g) ?? [];
  const allowed = new Set(['24', '48', ...numbersIn(toolResults.join('\n') + '\n' + question)]);
  const unverified = numbersIn(reply).filter((n) => !allowed.has(n));
  return { passed: unverified.length === 0, unverified };
}

async function chat(messages, allowTools) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY is not set (copy .env.example to .env)');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      temperature: 0,
      messages,
      tools: TOOLS,
      tool_choice: allowTools ? 'auto' : 'none',
    }),
    signal: AbortSignal.timeout(60000),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${body.error?.message ?? 'unknown error'}`);
  return body.choices[0].message;
}
