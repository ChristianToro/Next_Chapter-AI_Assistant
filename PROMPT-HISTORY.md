# Prompt History

This document records meaningful development interactions between the user and
AI coding agents working on this project. It focuses on requests, outcomes,
implementation decisions, verification, and human-agent collaboration rather
than preserving a raw conversation transcript.

Generated code is included verbatim when reasonably concise. Extensive
implementations are referenced through their canonical repository files.

> This file is an engineering collaboration record, not a source of truth for
> application behavior. The repository itself remains authoritative.

> Not to be confused with `../PROMPT-LOG.md`, the user's personal course log
> (a graded deliverable written in their own words).

---

## Session: 2026-09-24

**Objective:** Build a one-task AI assistant for a weekly course project. It reports the current market value of an Escape From Tarkov item, in a browser UI styled as a terminal.

### Interaction 1 — Assignment scoping and plan

**User Prompt**

> Build a reusable AI assistant for ONE real task [...] Your spec (build exactly this): A system prompt (role + rules). 1–2 examples (few-shot) that make output reliable. A consistent output structure. A responsible-use note [...]. A reliability test: run it on 3+ inputs and show it behaves consistently. [...] One assistant, one task — no mega-tool scope creep. Explain every design choice in your own words. Log your iterations in your Prompt Log. Find one failure mode [...] Name it and add a mitigation. [...] Deliverables: the assistant (link or doc) + a one-page spec sheet + your Prompt Log. Demo Day 5: run it live on one input + show the failure you found.
>
> I want to create a simple, lightweight ai assistant that tells a user the current market value for an Escape From Tarkov item. A simple browser--would look like a terminal

[Prompt abbreviated for history. Core requirements preserved.]

**Agent Outcome**

Wrote a plan in plan mode. The model never supplies prices itself. It calls a `lookup_item` tool backed by the free, keyless tarkov.dev GraphQL API, formats the result into a fixed dot-padded block, and a server-side guard rejects any number not present in the live data. The named failure mode is invented or wrong-item prices (flea-banned items, vague names, data source down).

**Rationale**

An LLM has no live market data, so without a tool it can only produce believable, stale guesses. That makes both the tool and the failure mode central to the assignment.

**Collaboration**

The user chose the **OpenAI API**. Claude had recommended Claude API. The user also chose **both game modes with PvP as the default**.

### Interaction 2 — Build the assistant

**User Prompt**

> Write this plan into a PLAN.md file at the root of this directory, then follow option @, execute with manual approve edits

**Agent Outcome**

Built the full project with zero npm dependencies (Node built-in `fetch`, `node:http`, `node:test`, `process.loadEnvFile`). Also wrote `SPEC.md`, `README.md`, and appended a "Week 2 Project" section with an iteration log (v1–v4.1 plus TODOs) to `../PROMPT-LOG.md`.

Key design points:
- The tool result is **pre-formatted** (`"₽ 412,300"`, `"+2.1%"`) so the model copies strings instead of rounding.
- There are 5 fixed output formats: PRICE / MATCHES / NOT FOUND / ERROR / OFF-TASK.
- There are 2 few-shot examples: a clean match with a pve override, and an ambiguous "keycard" answered with MATCHES. Their prices are deliberately fake.
- The guard replaces any unverifiable reply with an `UNVERIFIED` block. `GUARD=off` disables it for the demo.

**Generated Code**

`lib/assistant.js` (the guard, i.e. the failure-mode mitigation)

```javascript
export function verify(reply, toolResults, question = '') {
  const numbersIn = (s) => s.match(/\d[\d,]*(?:\.\d+)?/g) ?? [];
  const allowed = new Set(['24', '48', ...numbersIn(toolResults.join('\n') + '\n' + question)]);
  const unverified = numbersIn(reply).filter((n) => !allowed.has(n));
  return { passed: unverified.length === 0, unverified };
}
```

**Implementation**

- [`lib/tarkov.js`](lib/tarkov.js): `lookupItem()`, GraphQL query, `rub()` / `pct()` / `stamp()` formatters
- [`lib/assistant.js`](lib/assistant.js): `ask()` tool loop (temperature 0, max 3 tool rounds), `verify()`, `GUARD_BLOCK`
- [`prompts/system-prompt.md`](prompts/system-prompt.md), [`prompts/examples.json`](prompts/examples.json)
- [`server.js`](server.js), [`public/`](public/)
- [`tests/guard.test.mjs`](tests/guard.test.mjs), [`tests/reliability.mjs`](tests/reliability.mjs)

**Attempted Approach**

The first `verify()` used `allowed.includes(n)` (substring). That let an invented `412` pass because `412,300` contains it.

**Resolution**

Switched to whole-token matching with a `Set`, and added a regression test for it.

**Changes**

- Created `PLAN.md`, `package.json`, `.env.example`, `server.js`, `lib/tarkov.js`, `lib/assistant.js`, `prompts/system-prompt.md`, `prompts/examples.json`, `public/index.html`, `public/terminal.css`, `public/terminal.js`, `tests/guard.test.mjs`, `tests/reliability.mjs`, `README.md`, `SPEC.md`.
- `../PROMPT-LOG.md`: appended the "Week 2 Project: Tarkov Price Terminal" section.

**Verification**

```bash
node --test tests/guard.test.mjs    # 6/6 pass
```

Smoke test on port 3999:
- `/` and `/terminal.css` return 200.
- A `../server.js` traversal request returns 403.
- `/api/ask` without a key returns a clear `OPENAI_API_KEY is not set` error.

**Not verified:** tarkov.dev returned `GraphQL server unavailable. Try again later.` on every attempt. The GraphQL query, the OpenAI loop end to end, and `tests/reliability.mjs` have **not** been run live. No OpenAI key is configured. The flea-banned test input "Red Rebel ice pick" is an unconfirmed assumption.

**Collaboration**

- The user asked to approve every edit by hand.
- Claude read "option @" as option 2 ("manually approve edits"), since the user said as much in the same sentence.
- The tarkov.dev outage was written up as live evidence of the failure mode.
- The `SPEC.md` "Why" column is flagged as a draft the user must rewrite in their own words, per the rubric.

### Interaction 3 — CLAUDE.md and prompt-history opt-in

**User Prompt**

> /init — include this in the CLAUDE.md file: Use the `prompt-history` skill to maintain PROMPT-HISTORY.md — invoke it at the start of the session and keep it updated as work progresses.

Followed by `/prompt-history`.

**Agent Outcome**

Created `CLAUDE.md` with these sections:
- the requested opt-in line
- a note separating this file from `../PROMPT-LOG.md`
- commands, including a single-test invocation and a warning that `node --test tests/` would run the paid live suite
- the three-layer architecture (lookup → tool loop → guard)
- the label and field-name coupling across prompt, examples, tests and UI
- known unverified state

Started this history file.

**Changes**

- Created `CLAUDE.md`, `PROMPT-HISTORY.md`.

**Verification**

Documentation only; no code changed.

**Collaboration**

- Found an OpenAI Codex config at `~/.codex` and offered to import it with `/import`. It was not read or imported.
- The `prompt-history` skill is user-invoked only, so it was started once the user ran `/prompt-history`.

### Interaction 4 — Stop tracking .env

**User Prompt**

> git is tracked my dot files and referencing changes that should not be tracked

**Agent Outcome**

- The user's local commit `df49a47` ("OpenAI API key added") had committed `.env`.
- `.gitignore` existed but was untracked.
- Checks with values masked showed that `.env` held only the `sk-...` placeholder, and that `origin/main` has no `.env`. No secret leaked.
- Commit `3b5bb75` runs `git rm --cached .env` and adds a broader `.gitignore`. `.env` stays on disk and is now ignored.

**Changes**

- `.gitignore`: ignores `.env` and `.env.*` (except `.env.example`), `node_modules/`, `.claude/settings.local.json`, and OS files including WSL `*:Zone.Identifier`.

**Attempted Approach**

Dropping the unpushed `df49a47` with `git reset HEAD~1` was denied by the permission classifier as a destructive git operation.

**Resolution**

A forward commit instead. The placeholder `.env` stays in `df49a47`'s history, which is harmless since it holds no real key.

**Verification**

- `git status --short --ignored` shows `!! .env`.
- `git ls-files` lists only `.env.example` and `.gitignore` as dotfiles.

**Collaboration**

The user can still squash `df49a47` out before pushing if they want it gone from history.

The user later removed `df49a47` from history themselves (current log: `df23f5e` → `987e0e7` → `92237f8`).

### Interaction 5 — Switch the LLM from OpenAI to Claude Sonnet 5

**User Prompt**

> OpenAI API called will not be the method moving forward. Which Claude model should be used for this project?

**Agent Outcome**

Planned in plan mode using the `claude-api` skill's current model table. The model options offered were:
- Opus 5 (recommended default, $5/$25 per 1M tokens)
- Sonnet 5 ($2/$10)
- Haiku 4.5 ($1/$5, the only one that still accepts `temperature`)

The user chose **Claude Sonnet 5** (`claude-sonnet-5`). The LLM layer moved to `@anthropic-ai/sdk` with a manual tool loop. `ask()`'s return shape, `verify()`, the guard, the server, the UI and the tarkov.dev lookup are unchanged.

**Rationale**

- Sonnet 5 rejects `temperature`/`top_p` with a 400. "temperature 0" was dropped, and consistency now rests on the prompt, examples, pre-formatted tool data and guard. SPEC.md says so.
- `effort: "low"` suits a look-up-and-copy task.
- The manual loop was kept over the beta Tool Runner so the code can collect this turn's tool results for the guard.
- The skill requires the official SDK over raw `fetch` in a JS project. That adds the project's first npm dependency.

**Changes**

- `lib/assistant.js`:
  - SDK client created lazily, so `verify()` can be imported without a key.
  - Top-level `system`, `strict` tool with `input_schema`, `tool_choice` auto, then none on the last round.
  - Full `response.content` (including thinking) pushed back. All `tool_result` blocks go in one user message, with `is_error` on lookup errors.
  - `refusal` and `max_tokens` stop reasons throw.
  - One friendly message for both a missing key (plain SDK `Error`) and an invalid key (`AuthenticationError`).
- `prompts/examples.json`: converted by script to `tool_use` / `tool_result` blocks. Example text and fake prices unchanged.
- `prompts/system-prompt.md`: all-caps emphasis lowered (ALWAYS/NEVER/NOT/ONLY). No rule removed or weakened.
- `package.json` / `package-lock.json`: `@anthropic-ai/sdk` ^0.128.0.
- `.env.example`: `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL=claude-sonnet-5`.
- `tests/reliability.mjs`: report header names the model and "effort low".
- `README.md`, `SPEC.md` (Model row replaces "temperature 0", data now goes to Anthropic), `CLAUDE.md` (commands, dependency, layer 2, known state), `PLAN.md` (update note at top).

**Verification**

- `npm test`: 6/6 pass. The module imports without a key.
- `POST /api/ask` with no key and with an invalid key both return the friendly error. The invalid-key request reached the API and got a 401.
- **Not verified live:** no Anthropic credentials on this machine (`ANTHROPIC_API_KEY` unset, `ant` CLI not installed), and tarkov.dev still returns "GraphQL server unavailable". The request shape past authentication and the reliability suite are untested.

**Collaboration**

- The user dropped OpenAI.
- The user chose Sonnet 5 over the skill's default recommendation of Opus 5.
- The user's local `.env` still has the OpenAI variable names; they need to replace them with `ANTHROPIC_API_KEY`.
- `../PROMPT-LOG.md` was not edited.

### Interaction 6 — Replace tarkov.dev with the Tarkov Market API

**User Prompt**

> The tarkov.dev api source is deprecated and no longer maintained. Review tarkov-market.com/dev/api for a new method

Follow-up, after being told the API needs a Pro key:

> I have an API key from tarkov market. Rewrite lib/tarkov.js, and edit .env.example to accept the key

**Agent Outcome**

Reviewed the Tarkov Market API docs:
- `GET https://api.tarkov-market.app/api/v1/item?q=`, with PvE at `/api/v1/pve/item`
- `x-api-key` auth, Pro key required
- up to 5 matches, exact match first
- 300 requests/min
- terms: personal use, and public projects must credit tarkov-market.com

Rewrote `lib/tarkov.js` against it, keeping the tool-result field names the prompt and examples expect.

**Rationale**

- Kept to the two files the user named, so existing field names were preserved and fields this source lacks are set to `null`. The prompt then prints `n/a` for them instead of breaking.
  - Missing: 24h low/high (`flea24hLow`, `flea24hHigh`) and 48h change (`change48h`).
  - The 24h change was not relabeled as 48h.
- Flea prices are nulled when `bannedOnFlea` is true or `haveMarketData` is false. This gives an explicit "not on flea" signal, where tarkov.dev only had a missing price.
- Trader prices show the native currency, plus the ₽ value when it differs.
- The key is sent as a header, never in the query string, so it stays out of URLs and logs.

**Changes**

- `lib/tarkov.js`:
  - Rewrote the lookup against the Tarkov Market REST API.
  - Added fields `bannedOnFlea`, `fleaAvg7d`, `change24h`, `source`.
  - Explicit errors for a missing key, 401 and 429.
- `.env.example`: added `TARKOV_MARKET_API_KEY`.
- `CLAUDE.md`: data-source description, env vars, and known state.

**Verification**

- Stubbed `fetch` with the docs' sample LEDX response plus a synthetic flea-banned item with a $ trader price. The output mapped correctly, the PvE path was used, and the key was in the header and not the URL.
- 401 and missing-key cases return `{error}`. `npm test` is 6/6.
- **Not verified live:** `.env` has no `TARKOV_MARKET_API_KEY` yet.

**Collaboration**

- The user identified tarkov.dev as deprecated, chose Tarkov Market, already had a Pro key, and limited the scope to two files.
- Open follow-up the user hasn't approved yet: the prompt's `UPDATED ... source: tarkov.dev` line, the few-shot answers, the terminal help text, README and SPEC still credit tarkov.dev. This conflicts with Tarkov Market's attribution requirement. The label update (7-day avg, 24H TREND) is also pending.

### Interaction 7 — Credit tarkov-market.com and relabel the PRICE block

**User Prompt**

> yes, update those files and the labels

**Agent Outcome**

- The PRICE block now shows `FLEA AVG 24H <avg24h> (7-day avg <avg7d>)` and `24H TREND`, in place of the 24h low/high and 48H TREND this source doesn't have.
- The `UPDATED` line and the terminal help/loading text credit tarkov-market.com, as its terms require.
- `lib/tarkov.js` no longer returns the always-null legacy fields.

**Rationale**

- Only fields the data source actually supplies are shown.
- Because `7-day avg` puts a digit into a label, the guard's label allow-list changed from `{24, 48}` to `{24, 7}`. An answer carrying the old `48H` label is now blocked.
- Rule 8 is now explicit about which lines become `not on flea`, and mentions `bannedOnFlea`.

**Changes**

- `lib/tarkov.js`: removed `flea24hLow`, `flea24hHigh`, `change48h`.
- `prompts/system-prompt.md`: PRICE format, rule 8, source credit.
- `prompts/examples.json`:
  - Tool results rebuilt to the exact `lookupItem()` shape. Fake prices kept, and the example keycard holder case is flagged `bannedOnFlea`.
  - Answer 1 relabeled.
- `lib/assistant.js`: `verify()` allowed label digits `24` and `7`.
- `tests/guard.test.mjs`, `tests/reliability.mjs` (`PRICE_LABELS`): new labels.
- `public/terminal.js`: help and loading text credit tarkov-market.com.
- `README.md` (setup keys, data credit line), `SPEC.md` (tool row, output block, data recipient, bias note, failure-mode history), `CLAUDE.md` (layer 1, guard digits, field names, known state).

**Verification**

- `npm test`: 6/6.
- Offline check with stubbed `fetch` on the docs' sample:
  - The few-shot answer passes the guard against its own tool result.
  - A LEDX PRICE block and a "not on flea" block (with a `$ 1,450 (₽ 190,000)` trader price) both pass.
  - A `48H` label is blocked.
- **Not verified live:** no `ANTHROPIC_API_KEY` or `TARKOV_MARKET_API_KEY` in `.env`.

**Collaboration**

- The user approved updating the files outside the earlier two-file scope and relabeling.
- SPEC "Why" column: only the "What" cells and factual lines changed. The user's draft rationale text was left for them to rewrite.

### Interaction 8 — Spelling leniency with "did you mean" + "yes"

**User Prompt**

> There needs to be a way to allow leniency with spelling. Modify the "no match" section in the system-prompt.md. Allow a user to reply "yes" to a closely matched item

**Agent Outcome**

- On 0 matches, the model now retries with its best guess at the intended name, up to 2 more searches.
- If a corrected spelling finds the item, the reply is a new DID YOU MEAN block with the exact name from the tool result. No prices are shown until the user types "yes".
- The terminal remembers the suggestion and turns "yes" into a lookup of that exact name.

**Rationale**

- The server is stateless: each `/api/ask` call is one question with no history. So "yes" is resolved in the browser by re-asking with the suggested name, instead of adding conversation state.
- Requiring confirmation, and requiring the suggestion to come from the tool result, keeps a wrong spelling guess from turning into a wrong-item price. This extends the failure-mode mitigation.
- Rule numbers were kept stable because SPEC.md cites them.
- 1 search + 2 retries fits the existing `MAX_TOOL_ROUNDS = 3`, so there is no loop change.

**Changes**

- `prompts/system-prompt.md`:
  - rule 4: spelling leniency, up to 2 corrected searches
  - rule 5: DID YOU MEAN when the match came only from a correction, with the name copied from the tool result
  - rule 7: NOT FOUND only after the retries
  - new DID YOU MEAN format, and NOT FOUND wording updated
- `public/terminal.js`: a `suggestion` variable, `y|yes|yeah|yep|yup` handling, and a `yes` line in help. Any other input clears the suggestion.
- `tests/reliability.mjs`: new `ledz` → `didyoumean` case. It must start with DID YOU MEAN, show no ₽, and make ≥2 tool calls. Now 6 inputs.
- `README.md`, `SPEC.md` (6 formats, 6 inputs, mitigation now names rule 5 and the confirmation step), `CLAUDE.md` (label coupling, "yes" flow).

**Verification**

- `npm test`: 6/6. `node --check` passes on `public/terminal.js` and `tests/reliability.mjs`.
- Simulated UI run with a stub DOM and stubbed `/api/ask`:
  - "yes" with nothing pending prints a local hint.
  - `ledz` shows the suggestion, and after `mode pve`, "YES" sends `{question:"LEDX Skin Transilluminator", mode:"pve"}`.
  - A second "yes" has nothing to confirm.
- **Not verified live:** whether Sonnet 5 follows rules 4/5 (misspelling → DID YOU MEAN) needs the reliability run with both API keys. There is no few-shot example for this case, which keeps the assignment's 1–2 example limit.

**Collaboration**

The user asked for the prompt change. The terminal-side "yes" handling was added because a stateless server can't interpret a bare "yes".

### Interaction 9 — Review of the first live reliability run

**User Prompt**

> npm run test:reliability was conducted, and a test-results.md was generated. Review the results

**Agent Outcome**

First live run (Sonnet 5, effort low, 6 inputs × 2): 6 of 12 runs passed. Only off-task and "Red Rebel ice pick" passed both runs. Root causes, confirmed offline and with read-only Tarkov Market API calls using the user's key:

1. **Guard bug: every MATCHES reply is blocked.** `verify()`'s regex `\d[\d,]*` captures the comma after a JSON number (`"matchCount":5,` → `5,`), so the count `5` never matches. Reproduced offline; few-shot example 2 fails against its own tool result (`3`).
2. **The model answered from the few-shot example (LEDX run 2).** It made 0 tool calls and copied example 1's fake prices (901,234 / 950,000 / 889,000 / 555,111 / 2026-01-15). The examples are real message turns, so the model sees "ledx" as already answered earlier in the conversation. The guard blocked it. This is a real, captured instance of the named failure mode.
3. **The model corrects spelling before searching the user's words.** `ledz` ×2 and `gpu` run 2 made 1 tool call and returned DID YOU MEAN.
   - The API returns **Can of herring** as the single match for `ledz`, and **Graphics card [GPU]** first for `gpu`. The GPU result is an exact shortName match, so it should have been PRICE.
   - Either the model skipped the user's spelling, or it suggested LEDX from memory. That would break rule 5, and the guard only checks numbers, not names.
   - The report doesn't record tool queries, so which of the two happened can't be told.
4. **Fuzzy single matches are a wrong-item risk.** Rule 5 says "exactly 1 match → PRICE", which would price Can of herring for `ledz`.
5. **Test-data assumption was wrong.** Red Rebel ice pick is not flea-banned (`bannedOnFlea: false`, price 880,000), so the no-flea branch was never tested. `/items/all` shows 681 banned items, e.g. Physical Bitcoin [0.2BTC] (trader Therapist) and GPNVG-18.

**Verification**

- Offline `verify()` reproduction for #1.
- `GET /item?q=` for ledz / ledx / gpu / key, and `GET /items/all` for banned items (read-only, key not printed).
- No code changed.

**Collaboration**

The user ran the live suite; the review was agent-led. `TEST-RESULTS.md` is untracked, and the next run overwrites it. It's worth keeping as failure-mode evidence (LEDX run 2).

### Interaction 10 — Apply the five reliability fixes

**User Prompt**

> I stored the the results of the test suite into a different folder and file, so next runs can rewrite at will. Apply all 5 fixes.

**Agent Outcome**

The user committed the phase 1 results as `tests/reliability_tests/phase_1.md` (commit `27823ad`). Applied all five fixes from Interaction 9:

1. **Guard regex:** now `\d+(?:,\d{3})*(?:\.\d+)?`, so JSON separators are no longer swallowed. The guard also checks **item names**: every `ITEM`, `DID YOU MEAN` and MATCHES-bullet name must be a `matches[].name` from this turn's lookups. The block message now says "numbers or item names".
2. **Answers without a lookup:**
   - Few-shot example 1 moved from LEDX to Tetriz portable game console. The real name came from the API; the prices are fake.
   - Rule 1 says earlier example turns are illustrations and the item must be looked up again.
   - `ask()` nudges once when a final answer has zero lookups and isn't OFF-TASK.
3. **Rules 4–7:** the first search always uses the user's own words. A result counts only if its name or shortName equals or contains the searched words, so unrelated fuzzy results don't count. Corrections come only after no match. DID YOU MEAN / MATCHES / NOT FOUND follow from that.
4. **Test data:**
   - Physical Bitcoin replaces Red Rebel ice pick as the `noflea` case (confirmed `bannedOnFlea: true`; exact name among 3 results) and must show `not on flea`.
   - The MODE line is only judged when a PRICE block exists.
   - Crashed runs are labeled "run crashed", not "price source down".
5. **Report:** each run lists its searches (query, mode, returned names or error) and whether it was nudged. A blocked run includes the model's original reply. The server log also prints searches and the nudge.

**Rationale**

- The guard now checks names too, so a suggestion made from memory is blocked in code instead of relying only on the prompt.
- The nudge fixes the no-lookup case at its cause, before the guard has to block anything. It fires at most once and skips OFF-TASK.
- Rule numbers 8–11 are unchanged. SPEC now cites rules 1, 2, 4–9.

**Changes**

- `lib/assistant.js`: regex, name check, nudge, `searches` / `nudged` in the result.
- `tests/guard.test.mjs`: +4 tests (JSON comma, thousands and name digits, unknown name blocked, returned name allowed), 10 total.
- `prompts/examples.json`: example 1 is now Tetriz.
- `prompts/system-prompt.md`: rules 1 and 4–7.
- `tests/reliability.mjs`: Physical Bitcoin case, PRICE-only MODE check, crash label, `runDetail()` report.
- `server.js`: log line.
- `SPEC.md`: failure mode "seen live" paragraph, mitigation layers (nudge, name check), 10 tests.
- `CLAUDE.md`: guard and nudge description, known state.

**Verification**

- `npm test`: 10/10. Both few-shot answers pass the guard against their own tool results.
- Offline `ask()` run with stubbed Anthropic and Tarkov Market `fetch`: a memory answer triggered one nudge, then one lookup, and the final reply passed the guard. The request had no `temperature`, effort `low`, and a `strict` tool.
- The reliability report was smoke-tested with a blank model key (all runs "run crashed"). `TEST-RESULTS.md` was then restored from git.
- **Not verified live:** the next `npm run test:reliability` will show whether Sonnet 5 follows the new rules 4–7.

**Collaboration**

The user approved all five fixes and archived the phase 1 evidence themselves before re-running.

### Interaction 11 — Review of the phase 2 live run

**User Prompt**

> Results are in from npm run test:reliability with all passing.

**Agent Outcome**

Phase 2 (saved by the user as `tests/reliability_tests/phase_2.md`): 12/12 PASS, no nudges needed, no guard blocks. The search log confirms the Interaction 10 fixes:
- `ledz` → "ledz" (Can of herring, ignored) → "ledx" → DID YOU MEAN
- `gpu` searched as typed → PRICE via exact shortName
- `key` → MATCHES 5 (the guard comma fix works)

Two defects the checks didn't catch, both surfaced by the Physical Bitcoin "DIFFERENT" consistency flag:
1. **Preamble before the block.** Both runs started with "Exact match found …" before `ITEM ........`, which breaks rule 11. The test finds labels anywhere and doesn't require the reply to start with one.
2. **Rule 8 applied inconsistently.** Run 2 wrote `FLEA AVG 24H  not on flea   (7-day avg not on flea)`. The test's `includes()` check accepts both versions.

Proposed:
- a server-side trim of lines before the first format label
- rule 8 showing the literal line
- tests requiring the reply to start with a label and matching the not-on-flea line exactly

Awaiting user approval; no code changed.

**Verification**

Read `TEST-RESULTS.md` (searches, per-run outputs, Physical Bitcoin raw blocks).
