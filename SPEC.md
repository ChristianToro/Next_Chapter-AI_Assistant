# Spec Sheet: Tarkov Price Terminal

> *No risk, no loot.*

**Task (one only):** Tell a player the current market value of one Escape From Tarkov item.
**User:** An EFT player mid-raid-prep who wants to know "is this worth selling / keeping?" without opening a wiki.
**Out of scope:** Builds, quests, maps, ammo charts, trading advice, and anything that isn't an item price. These get a one-line OFF-TASK reply.

## System prompt (role + rules)
See [System Prompt](./prompts/system-prompt.md) document.

**Role**: Tarkov flea-market price clerk. Answers only "what is item X worth right now".

**Rules:**
- Always call lookup_item before stating a price.
- Never state a number that isn't in the tool result.
- If there are several matches, list up to 5 names and ask the user to pick one. Don't guess.
- If avg24hPrice is null (flea-banned or not tradeable), say so and show only trader sell prices.
Refuse off-task requests (builds, quests, cheats, RMT) with one line.
Don't give buy/sell advice beyond "best place to sell" from the data.
Always use the output structure below.

## Build
| Part | What | Why |
|---|---|---|
| System prompt | `prompts/system-prompt.md`: role, 11 numbered rules, 6 fixed formats | Numbered, blunt rules are easier for the model to follow and easier for me to point at when something breaks. |
| Tool | `lookup_item` → Tarkov Market API (live flea scans, Pro API key) | The model has no live prices. Without a tool it can only guess, so the tool is the whole point. |
| Pre-formatted numbers | The server turns `412300` into `"₽ 412,300"` before the model sees it | The model only copies strings. It never rounds or does math, and that makes the output checkable. |
| Few-shot (2) | Clean match with a mode override, and an ambiguous name with a MATCHES list | Example 1 shows both steps (call the tool, then fill the format). Example 2 shows the harder case: don't pick one, ask. |
| Output structure | Dot-padded `LABEL ....... value` block: PRICE / MATCHES / DID YOU MEAN / NOT FOUND / ERROR / OFF-TASK | Same shape every time, so it's easy to scan, easy to test with code, and it fits the terminal look. |
| Model | Claude Sonnet 5 (`claude-sonnet-5`), effort `low`, no sampling params | Strong at tool use and following formats, at a lower price than Opus. Effort `low` fits a simple look-up-and-copy task. Sonnet 5 doesn't allow `temperature`, so consistency comes from the strict prompt, the examples, the pre-formatted numbers and the guard, and the reliability test measures it. |
| Guard | `verify()` in `lib/assistant.js` | See Failure mode. |
| Terminal UI | Plain HTML/CSS/JS, output rendered as `textContent` | Light, and model output can never inject HTML. |

## Output structure
```
ITEM ........ LEDX Skin Transilluminator
MODE ........ PvP
FLEA AVG 24H  ₽ ...   (7-day avg ₽ ...)
LOWEST NOW .. ₽ ...
24H TREND ... +x.x%
BEST TRADER . <Trader> ₽ ...
UPDATED ..... YYYY-MM-DD HH:MM UTC · source: tarkov-market.com
NOTE ........ Flea prices move hourly; confirm in-game before trading.
```

## Responsible use
- **Safe to enter:** Item names only. Never enter account names, emails, passwords, or RMT details. Every query is sent to Anthropic (Claude) and tarkov-market.com.
- **Where it can hallucinate:** Prices the model "remembers", rounded numbers, or the wrong item picked for a vague name ("red", "key", "battery").
- **Bias and staleness:**
  - Tarkov Market prices come from its flea-market scanner. Low-volume items can be skewed by a few listings, and a price is only as fresh as the last scan (check `UPDATED`).
  - The default is PvP. PvE economies differ a lot, so check the MODE line.
- **Prompt injection:**
  - The model has one read-only tool, so injected text can't make the app *do* anything.
  - Text in the user's message or in lookup results is treated as data (prompt).
  - The server check shows only answers whose every line matches the live data and the fixed templates. Tested against fake prices in the question, spelled-out and fullwidth numbers, numbers moved between items, and injected NOTE text.
- **Run locally:** the server binds to 127.0.0.1 and rate-limits questions (20/min per client, 60/min total). Tarkov Market's key is for personal use, so don't expose the server publicly.
- **How to verify:**
  1. Check the `UPDATED` time.
  2. Check that `ITEM` is the item you meant.
  3. Check the in-game flea market before a big trade.
  4. `UNVERIFIED` or `ERROR` means no price was shown, on purpose.

## Failure mode: invented or wrong-item prices
**Where it breaks:**
- Ask for a flea-banned item (no flea price).
- Or give a vague name.
- Or hit it while the price source is down. This happened during the build: the first source, tarkov.dev, returned "GraphQL server unavailable" and was later deprecated, so the project moved to Tarkov Market.

Without controls, the model fills the gap with a believable number from its training data. That number is wrong and looks exactly like a real one.

**Seen live** (first reliability run, saved in `tests/reliability_tests/phase_1.md`): asked "LEDX", the model skipped the lookup and replayed the prices from a few-shot example, because the example had used the same item. The guard blocked it. The run also showed the search is fuzzy ("ledz" returns "Can of herring"), so a misspelling could price the wrong item.

**Mitigation (layered):**
1. **Prompt rules 1, 2, 4–9:** always call the tool (even for an item seen earlier), only copy numbers, search the user's own words first, ignore unrelated fuzzy results, and show MATCHES, "not on flea", or ERROR instead of guessing. When the model corrects a misspelling, it shows DID YOU MEAN with a name from the live data and waits for "yes" before showing a price, so a wrong guess never becomes a wrong price.
2. **Few-shot examples:** example 2 shows ambiguity handled by asking, not picking. Example 1 uses an item the tests don't ask about, so it can't be replayed as an answer.
3. **Server nudge:** if the model answers without any lookup (and it isn't OFF-TASK), the server asks it once to look the item up.
4. **Server trim:** only the format block reaches the user. Narration the model adds around it is dropped (seen live in phase 2).
5. **Server guard:** every number in the reply must match, as a whole token, a number from *this turn's* tool result, and every item name shown must be one the lookup returned. A **field-bound format check** then rebuilds the expected block from the looked-up item's own data. Every line must match its template, so a price can't be spelled out, written in other digits, taken from another item or field, or surrounded by extra text. Otherwise the reply is replaced with `UNVERIFIED`. It also catches prices copied from the few-shot examples, answers given with no tool call, and suggestions made from memory.

**Demo:** `GUARD=off node server.js` and ask the failing input → the unverified output gets through. Then run `node server.js` → the same input is blocked.

## Reliability test
`npm test`: 27 offline tests of the guard, the trim, the format check (including the injection bypasses) and prompt/template drift (all pass). `npm run test:reliability`: 6 inputs × 2 runs (price, PvE price, ambiguous, misspelled, flea-banned Physical Bitcoin, off-task). Checks that every reply starts with a format label, plus tool use, guard, expected behavior (exact "not on flea" lines for the banned item), and run-to-run consistency. Phase 1 passed 6/12. Phase 2 passed 12/12, but its consistency check exposed narration and an uneven "not on flea" line, which led to the trim and a stricter rule 8. The report lists what each run searched for, and the model's original reply when the guard blocked it. Most recent test suite results: [`TEST-RESULTS.md`.](./TEST-RESULTS.md) Catalog of suite results: [Reliability Tests.](./tests/reliability_tests/)
