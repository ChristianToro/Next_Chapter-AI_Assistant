# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Use the `prompt-history` skill to maintain PROMPT-HISTORY.md — invoke it at the
start of the session and keep it updated as work progresses.

`PROMPT-HISTORY.md` (this directory, skill-maintained engineering log) is not the same as `../PROMPT-LOG.md`, the user's personal course log and a graded deliverable. Only edit `../PROMPT-LOG.md` when asked.

## Project

Tarkov Price Terminal is a course assignment (weekly project, "Lane 3: control"): a **one-task** AI assistant that reports the current market value of one Escape From Tarkov item, in a browser UI styled as a terminal. The rubric rewards narrow scope, so don't add features beyond item price lookup (builds, quests, advice and so on are deliberately OFF-TASK). The graded deliverables are the assistant, `SPEC.md` (one page), and the Prompt Log. `PLAN.md` holds the original build plan.

## Commands

No build step and no npm dependencies. The project uses Node 21.7+ built-ins (`fetch`, `process.loadEnvFile`, `node:test`).

```bash
cp .env.example .env              # needs OPENAI_API_KEY; OPENAI_MODEL defaults to gpt-4.1-mini
node server.js                    # http://localhost:3000 (PORT overrides)
GUARD=off node server.js          # disables the guard, to demo the failure mode
npm test                          # offline guard unit tests (no key, no network)
node --test --test-name-pattern="rounded" tests/guard.test.mjs   # single test
npm run test:reliability          # live: 5 inputs x 2 runs via OpenAI + tarkov.dev -> writes TEST-RESULTS.md
```

Don't run `node --test tests/`. It would pick up `reliability.mjs`, which makes live paid API calls.

## Architecture

A request passes through three layers. Together they keep the model from inventing prices:

1. **`lib/tarkov.js`** queries the tarkov.dev GraphQL API (free, no key) for up to 5 matches. It **pre-formats every number into the exact display string** (`"₽ 412,300"`, `"+2.1%"`, `"2026-09-24 14:02 UTC"`) so the model only copies and never rounds. On API failure it returns `{error}` and does not throw.
2. **`lib/assistant.js`** runs the OpenAI Chat Completions tool loop over raw `fetch` (temperature 0, one tool `lookup_item`, max 3 tool rounds). Messages are the system prompt from `prompts/system-prompt.md`, then the few-shot exchanges from `prompts/examples.json` (flattened, `_why` ignored), then the user turn prefixed `[mode: regular|pve]`.
3. **`verify()` guard (the named failure-mode mitigation):**
   - It pulls every number token out of the reply.
   - Each token must match, as a whole token, a number from **this turn's** tool results or the user's question. `24` and `48` are always allowed because they appear in labels.
   - Any unmatched number replaces the reply with `GUARD_BLOCK` (`UNVERIFIED ...`).
   - Few-shot example prices are deliberately fake and never count as allowed, so a copied example price also gets blocked.

Coupling to keep in sync when changing things:
- **Output format labels** (`ITEM ........`, `FLEA AVG 24H`, `MATCHES .....`, `ERROR`, `OFF-TASK`, etc.) are defined in `prompts/system-prompt.md`. They are also hard-coded in `prompts/examples.json` answers, in `tests/reliability.mjs` (`PRICE_LABELS`, `startsWith` checks), and in `public/terminal.js` (the warn-color regex).
- **Tool-result field names** (`fleaAvg24h`, `bestTrader`, `change48h`, ...) must match between `lib/tarkov.js`, the `<placeholders>` in the system prompt, and the example tool results.
- Any new number shown in output has to come from the tool result as a pre-formatted string, or the guard will block it.

`server.js` is a plain `node:http` server: static files from `public/` (with a path-traversal check) plus `POST /api/ask` `{question, mode}` → `{reply, raw, toolCalls, guard}`. The frontend (`public/terminal.js`) handles `help`, `clear`, and `mode pve|pvp` itself, and renders replies with `textContent` only. PvP is `regular` in the tarkov.dev API.

## Known state

- The GraphQL query in `lib/tarkov.js` has not been verified live: tarkov.dev returned "GraphQL server unavailable" throughout the initial build.
- The reliability test's flea-banned case ("Red Rebel ice pick") is an assumption to confirm.
- The "Why" column in `SPEC.md` is a draft the user must rewrite in their own words (rubric requirement). Don't polish it for them.
