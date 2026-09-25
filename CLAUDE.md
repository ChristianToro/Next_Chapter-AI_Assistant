# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Use the `prompt-history` skill to maintain PROMPT-HISTORY.md — invoke it at the
start of the session and keep it updated as work progresses.

`PROMPT-HISTORY.md` (this directory, skill-maintained engineering log) is not the same as `../PROMPT-LOG.md`, the user's personal course log and a graded deliverable. Only edit `../PROMPT-LOG.md` when asked.

## Project

Tarkov Price Terminal is a course assignment (weekly project, "Lane 3: control"): a **one-task** AI assistant that reports the current market value of one Escape From Tarkov item, in a browser UI styled as a terminal. The rubric rewards narrow scope, so don't add features beyond item price lookup (builds, quests, advice and so on are deliberately OFF-TASK). The graded deliverables are the assistant, `SPEC.md` (one page), and the Prompt Log. `PLAN.md` holds the original build plan.

## Commands

No build step. There is one npm dependency, `@anthropic-ai/sdk`; everything else is Node 21.7+ built-ins (`fetch`, `process.loadEnvFile`, `node:test`).

```bash
npm install
cp .env.example .env              # needs ANTHROPIC_API_KEY and TARKOV_MARKET_API_KEY; ANTHROPIC_MODEL defaults to claude-sonnet-5
node server.js                    # http://127.0.0.1:3000 (PORT, HOST override; HOST defaults to 127.0.0.1)
GUARD=off node server.js          # disables the guard, to demo the failure mode
npm test                          # offline guard unit tests (no key, no network)
node --test --test-name-pattern="rounded" tests/guard.test.mjs   # single test
npm run test:reliability          # live: 6 inputs x 2 runs via Claude + Tarkov Market -> writes TEST-RESULTS.md
```

Don't run `node --test tests/`. It would pick up `reliability.mjs`, which makes live paid API calls.

## Architecture

A request passes through three layers. Together they keep the model from inventing prices:

1. **`lib/tarkov.js`** queries the Tarkov Market REST API (`api.tarkov-market.app/api/v1[/pve]/item?q=`, Pro key in `TARKOV_MARKET_API_KEY`, sent as the `x-api-key` header) for up to 5 matches. tarkov.dev is deprecated; don't go back to it. Flea fields are `null` when `bannedOnFlea` is true or `haveMarketData` is false. Trader prices keep their native currency (₽/$/€), plus the ₽ value. Terms require crediting tarkov-market.com, which the `UPDATED` line and help text do. It **pre-formats every number into the exact display string** (`"₽ 412,300"`, `"+2.1%"`, `"2026-09-24 14:02 UTC"`) so the model only copies and never rounds. On API failure it returns `{error}` and does not throw.
2. **`lib/assistant.js`** runs a manual Claude Messages API tool loop through `@anthropic-ai/sdk`. Settings: model `claude-sonnet-5`, `output_config.effort: "low"`, one `strict` tool `lookup_item`, max 3 tool rounds, then `tool_choice: none`. Inputs:
   - `system` is `prompts/system-prompt.md`.
   - `messages` is the few-shot exchanges from `prompts/examples.json` (Anthropic content-block format, flattened, `_why` ignored), then the user turn prefixed `[mode: regular|pve]`.

   Sonnet 5 rejects `temperature`/`top_p` with a 400, so don't add them. Full `response.content` (including thinking blocks) is pushed back unchanged. All `tool_result` blocks go back in one user message. The client is created lazily in `ask()` so `verify()` can be imported without a key.
3. **Server-side answer checks in `lib/guard.js` (the named failure-mode mitigation).** `ask()` runs `extractBlock()`, then `verify()` **and** `validateFormat()`. Either failing replaces the reply with `GUARD_BLOCK`, and the reasons are logged server-side only.

   `verify()`:
   - It pulls every number token out of the reply. Tokens are whole numbers with exactly-3-digit thousands groups (`\d+(?:,\d{3})*(?:\.\d+)?`). A looser pattern once swallowed JSON separators (`"matchCount":5,` → `5,`) and blocked every MATCHES reply.
   - Each token must match, as a whole token, a number from **this turn's** tool results or the user's question. `24` and `7` are always allowed because they appear in labels (`FLEA AVG 24H`, `24H TREND`, `7-day avg`).
   - Every item name the reply shows (`ITEM` line, `DID YOU MEAN` line, MATCHES `  - ` bullets) must be a `matches[].name` from this turn's tool results.
   - Few-shot example prices are deliberately fake and never count as allowed, so a copied example price also gets blocked.

   `validateFormat()` is the prompt-injection defense:
   - It compares every line (whitespace runs collapsed) against `TEMPLATES` in `lib/guard.js`.
   - A PRICE block is rebuilt from the looked-up item's own fields and its lookup's `gameMode`, so every value must be that item's value in that field. Rule 8 lines apply when `fleaAvg24h` is null; `n/a` for other nulls.
   - MATCHES count must equal the bullets, and bullets and DID YOU MEAN names must be returned names.
   - A quoted `"<query>"` must be in the user's question or be one of this turn's search queries.
   - ERROR / OFF-TASK / NOTE lines must match exactly.
   - This blocks fake prices planted in the question, spelled-out or fullwidth numbers, values moved between items or fields, and injected text (see the bypass tests in `tests/guard.test.mjs`).
   - A **drift test** fails if any `TEMPLATES` line isn't verbatim in `prompts/system-prompt.md`. Change both together.

   `extractBlock()` keeps only the format block: from the first line starting with a format label through the first `NOTE ........` line. Sonnet 5 sometimes narrates ("Exact match found …") despite rule 11. The guard checks the trimmed block, which is what the user sees. `trimmed: true` is returned when narration was dropped, and the report notes it. A new format must start with a label listed in `BLOCK_START` (in both `lib/guard.js` and `tests/reliability.mjs`), end with a NOTE line, and get a branch in `validateFormat()`.

   `ask()` also **nudges** once: a final answer with zero lookups that isn't `OFF-TASK` gets a follow-up user message asking the model to call `lookup_item`. In the first live run the model replayed a few-shot answer with no lookup. `ask()` also returns `searches` (query, mode, and returned names or error) and `nudged`, for the server log and the reliability report.

Coupling to keep in sync when changing things:
- **Output format labels** (`ITEM ........`, `FLEA AVG 24H`, `MATCHES .....`, `DID YOU MEAN`, `ERROR`, `OFF-TASK`, etc.) are defined in `prompts/system-prompt.md` and mirrored in `TEMPLATES` (`lib/guard.js`, drift-tested). They are also hard-coded in `prompts/examples.json` answers, in `tests/reliability.mjs` (`PRICE_LABELS`, `startsWith` checks), and in `public/terminal.js` (the warn-color regex, and the `DID YOU MEAN` regex that captures the suggestion).
- **Tool-result field names** (`fleaAvg24h`, `fleaAvg7d`, `change24h`, `bestTrader`, ...) must match between `lib/tarkov.js`, the `<placeholders>` in the system prompt, and the example tool results.
- Any new number shown in output has to come from the tool result as a pre-formatted string, or the guard will block it. A new digit in a label has to be added to the `allowed` set in `verify()`.

`server.js` is a plain `node:http` server: static files from `public/` (with a path-traversal check) plus `POST /api/ask` `{question, mode}` → `{reply, toolCalls, searches, nudged, guard:{enabled, passed}}`. It deliberately doesn't send `raw` or the guard's reasons to the browser. Hardening:
- binds `HOST` (default `127.0.0.1`)
- in-memory rate limit of 20/min per IP and 60/min global → 429
- `question`/`mode` must be strings, bad JSON → 400
- 500s show only `UserFacingError` messages (thrown in `lib/assistant.js`), otherwise `internal error`
- CSP / nosniff / no-referrer headers on every response

 The frontend (`public/terminal.js`) handles `help`, `clear`, and `mode pve|pvp` itself. It also handles **"yes"**: the server is stateless, so the terminal stores the item name from the last `DID YOU MEAN` reply and sends that exact name as the next question. The model does the spelling correction (prompt rules 4, 5, 7), within the existing 3 tool rounds. Replies are rendered with `textContent` only. PvP is `regular` internally (default Tarkov Market path); PvE uses the `/pve` path.

## Known state

- `lib/tarkov.js` is tested only against the documented sample response with a stubbed `fetch`, not live.
- The Claude tool loop has not run live either: no Anthropic key was available when it was written. Only the offline tests and the missing- and invalid-key error paths have been exercised.
- Live results are saved per phase in `tests/reliability_tests/` (e.g. `phase_1.md`). `TEST-RESULTS.md` is overwritten on every run.
- The flea-banned test case is Physical Bitcoin, confirmed `bannedOnFlea: true` via the API. Red Rebel ice pick is not banned. The Tarkov Market search is fuzzy (`ledz` → Can of herring), which is why prompt rules 4–7 search the user's own words first and ignore unrelated results.
- The "Why" column in `SPEC.md` is a draft the user must rewrite in their own words (rubric requirement). Don't polish it for them.
