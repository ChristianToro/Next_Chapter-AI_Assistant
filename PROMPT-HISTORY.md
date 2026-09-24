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
