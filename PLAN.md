# Tarkov Price Terminal: a one-task AI assistant

> **Update:** the LLM layer later moved from OpenAI to **Claude Sonnet 5** (`@anthropic-ai/sdk`, no temperature, effort low). OpenAI details below are historical; see PROMPT-HISTORY.md and CLAUDE.md for the current setup.

## Context
Weekly project: build a reusable AI assistant for **one** real task, with a system prompt, few-shot examples, a fixed output structure, a responsible-use note, a reliability test (3+ inputs), a named failure mode with a mitigation, a one-page spec sheet, and Prompt Log entries.
**The task:** a user types an Escape From Tarkov item name (loose phrasing is fine, e.g. "how much is a LEDX", "gpu pve") and gets its current market value back. The UI is a lightweight browser page styled like a terminal.

Choices already made: **OpenAI API**. **PvP by default**; the user can switch with `mode pve` / `mode pvp` or by adding "pve" to the question.

Main design point: an LLM does not know live prices and will make up believable numbers. So the model never supplies prices itself. It calls one tool (`lookup_item`), which queries the free, keyless **tarkov.dev GraphQL API** (`https://api.tarkov.dev/graphql`). The model then picks the right match and formats the result. This also produces the failure mode for the demo (see below).

## Architecture (light, no frameworks, no npm deps)
Node 24 has built-in `fetch`, so the project needs only `node server.js`.

```
chatbot/
  server.js              # ~150 lines: serves public/, POST /api/ask, runs the tool loop
  lib/tarkov.js          # lookupItem(name, gameMode) -> GraphQL query to tarkov.dev
  lib/assistant.js       # builds messages (system + few-shot + user), OpenAI tool loop, guard
  prompts/system-prompt.md
  prompts/examples.json  # 2 few-shot exchanges (incl. tool call + tool result)
  public/index.html      # terminal UI (monospace, green-on-black, blinking caret, history ↑/↓)
  public/terminal.js     # input line, `help`, `mode pve|pvp`, `clear`, POST /api/ask
  public/terminal.css
  tests/reliability.mjs  # runs 5 fixed inputs through the real pipeline and writes TEST-RESULTS.md
  .env.example           # OPENAI_API_KEY=, OPENAI_MODEL=gpt-4.1-mini (configurable)
  SPEC.md                # one-page spec sheet (includes responsible-use note + failure mode)
  README.md              # how to run
```
The API key stays in `.env` on the local server and never reaches the browser.

### Flow
1. The browser sends `{question, mode}` to `/api/ask`.
2. `assistant.js` calls OpenAI Chat Completions (raw `fetch`, `tools: [lookup_item]`, `temperature: 0`) with the system prompt and the few-shot messages.
3. The model calls `lookup_item({name, gameMode})`. `tarkov.js` sends GraphQL `items(name:$n, gameMode:$m, lang:en)` and returns the top 5 matches with the fields `name shortName avg24hPrice lastLowPrice low24hPrice high24hPrice changeLast48hPercent updated sellFor{price currency vendor{name}} link`.
4. The model writes the fixed output block.
5. **Guard (the mitigation):** the server pulls every number out of the reply and checks it against the numbers in the tool result. Any number not found there causes the reply to be replaced with a safe "couldn't verify" block. If no tool call happened, the price lines are refused.

### System prompt (role + rules)
- **Role:** Tarkov flea-market price clerk. Answers only "what is item X worth right now".
- **Rules:**
  - Always call `lookup_item` before stating a price.
  - Never state a number that isn't in the tool result.
  - If there are several matches, list up to 5 names and ask the user to pick one. Don't guess.
  - If `avg24hPrice` is null (flea-banned or not tradeable), say so and show only trader sell prices.
  - Refuse off-task requests (builds, quests, cheats, RMT) with one line.
  - Don't give buy/sell advice beyond "best place to sell" from the data.
  - Always use the output structure below.

### Consistent output structure
```
ITEM ........ Graphics card (GPU)
MODE ........ PvP
FLEA AVG 24H  ₽ 412,300      (low ₽ 398,000 / high ₽ 430,500)
LOWEST NOW .. ₽ 405,000
48H TREND ... +2.1%
BEST TRADER . Therapist ₽ 181,000
UPDATED ..... 2026-09-24 14:02 UTC · source: tarkov.dev
NOTE ........ Flea prices move hourly; check in-game before trading.
```
There's an ambiguous variant (`MATCHES` list plus a request to pick one) and a not-found variant.

### Few-shot examples (`examples.json`)
1. **Clean single match.** "how much is a ledx pve" → tool call with `gameMode: pve` → full block.
2. **Ambiguous name.** "salewa" matches one item, but "key" matches many → `MATCHES` list, no prices.

## Failure mode (to name and demo)
**Hallucinated or wrong-item prices.** This happens in two ways:
- The name is ambiguous or slang, e.g. "red", "tank battery", "bitcoin" vs "Physical bitcoin". The top search hit is the wrong item.
- The item has no flea price (banned or quest items). Without guardrails, the model fills the gap with a believable number.

**Mitigations:**
- A prompt rule plus a few-shot example for ambiguous names.
- A null-price rule.
- The server-side number-verification guard.

**Demo:** run the unguarded version first (`GUARD=off`) on an input like a flea-banned item, then show the guarded version refusing to invent a number.

## Reliability test
`node tests/reliability.mjs` runs 5 inputs:
1. `LEDX`
2. `gpu pve`
3. `key`
4. a flea-banned item
5. `best m4 build`

For each input it checks:
- the block has the required labels in order
- a tool was called
- every number is traceable to the data
- the right behavior happened (price / MATCHES / not-on-flea / refusal)

Each input runs 2 times to show the output is consistent. Results are written to `TEST-RESULTS.md` as a pass/fail table plus the raw outputs.

## Docs deliverables
- **SPEC.md (one page):**
  - task and user
  - scope (in/out)
  - design choices with a one-line "why" each
  - output structure
  - responsible-use note:
    - safe data = item names only, no account info
    - hallucination and staleness risks
    - bias: tarkov.dev is crowd-sourced, and the default is PvP
    - how to verify: check the in-game flea market and the `UPDATED` timestamp
  - failure mode and mitigation
  - test summary
  - The rationale sections will be drafted for you to rewrite in your own words, as the rubric requires.
- **Prompt Log:** add a "Week 2 Project: Tarkov Price Terminal" section to `/home/torosanctum/Next_Chapter/PROMPT-LOG.md`, in the same heading style as the existing entries. It logs each iteration:
  - v1: naive prompt with no tool, which hallucinates
  - v2: tool plus a strict rule
  - v3: few-shot for ambiguity
  - v4: server guard

## Verification
1. `cp .env.example .env`, add your OpenAI key, run `node server.js`, open `http://localhost:3000`, and type `LEDX`, `mode pve`, `LEDX`. Check that the prices differ and match the numbers on tarkov.dev.
2. `node tests/reliability.mjs`: all 5 cases pass, and the repeated runs give the same structure.
3. `GUARD=off node server.js` with a flea-banned item, to confirm the failure can be reproduced for the demo.
