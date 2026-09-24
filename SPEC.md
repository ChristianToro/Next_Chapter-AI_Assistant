# Spec Sheet: Tarkov Price Terminal

> ✏️ The "Why" lines below are drafts. Rewrite them in your own words before you submit (rubric: *explain every design choice in your own words*).

**Task (one only):** Tell a player the current market value of one Escape From Tarkov item.
**User:** An EFT player mid-raid-prep who wants to know "is this worth selling / keeping?" without opening a wiki.
**Out of scope:** Builds, quests, maps, ammo charts, trading advice, and anything that isn't an item price. These get a one-line OFF-TASK reply.

## Build
| Part | What | Why |
|---|---|---|
| System prompt | `prompts/system-prompt.md`: role, 11 numbered rules, 5 fixed formats | Numbered, blunt rules are easier for the model to follow and easier for me to point at when something breaks. |
| Tool | `lookup_item` → tarkov.dev GraphQL (free, live, no key) | The model has no live prices. Without a tool it can only guess, so the tool is the whole point. |
| Pre-formatted numbers | The server turns `412300` into `"₽ 412,300"` before the model sees it | The model only copies strings. It never rounds or does math, and that makes the output checkable. |
| Few-shot (2) | Clean match with a mode override, and an ambiguous name with a MATCHES list | Example 1 shows both steps (call the tool, then fill the format). Example 2 shows the harder case: don't pick one, ask. |
| Output structure | Dot-padded `LABEL ....... value` block: PRICE / MATCHES / NOT FOUND / ERROR / OFF-TASK | Same shape every time, so it's easy to scan, easy to test with code, and it fits the terminal look. |
| Model | Claude Sonnet 5 (`claude-sonnet-5`), effort `low`, no sampling params | Strong at tool use and following formats, at a lower price than Opus. Effort `low` fits a simple look-up-and-copy task. Sonnet 5 doesn't allow `temperature`, so consistency comes from the strict prompt, the examples, the pre-formatted numbers and the guard, and the reliability test measures it. |
| Guard | `verify()` in `lib/assistant.js` | See Failure mode. |
| Terminal UI | Plain HTML/CSS/JS, output rendered as `textContent` | Light, and model output can never inject HTML. |

## Output structure
```
ITEM ........ LEDX Skin Transilluminator
MODE ........ PvP
FLEA AVG 24H  ₽ ...   (low ₽ ... / high ₽ ...)
LOWEST NOW .. ₽ ...
48H TREND ... +x.x%
BEST TRADER . <Trader> ₽ ...
UPDATED ..... YYYY-MM-DD HH:MM UTC · source: tarkov.dev
NOTE ........ Flea prices move hourly; confirm in-game before trading.
```

## Responsible use
- **Safe to enter:** Item names only. Never enter account names, emails, passwords, or RMT details. Every query is sent to Anthropic (Claude) and tarkov.dev.
- **Where it can hallucinate:** Prices the model "remembers", rounded numbers, or the wrong item picked for a vague name ("red", "key", "battery").
- **Bias and staleness:**
  - tarkov.dev prices are crowd-sourced. Low-volume items can be skewed by a few listings, and data can lag behind the game.
  - The default is PvP. PvE economies differ a lot, so check the MODE line.
- **How to verify:**
  1. Check the `UPDATED` time.
  2. Check that `ITEM` is the item you meant.
  3. Check the in-game flea market before a big trade.
  4. `UNVERIFIED` or `ERROR` means no price was shown, on purpose.

## Failure mode: invented or wrong-item prices
**Where it breaks:**
- Ask for a flea-banned item (no flea price).
- Or give a vague name.
- Or hit it while the price source is down. This happened during the build: tarkov.dev returned "GraphQL server unavailable".

Without controls, the model fills the gap with a believable number from its training data. That number is wrong and looks exactly like a real one.

**Mitigation (layered):**
1. **Prompt rules 1, 2, 6, 8, 9:** always call the tool, only copy numbers, and show MATCHES, "not on flea", or ERROR instead of guessing.
2. **Few-shot example 2:** shows ambiguity handled by asking, not picking.
3. **Server guard:** every number in the reply must match, as a whole token, a number from *this turn's* tool result. Otherwise the reply is replaced with `UNVERIFIED`. It also catches prices copied from the few-shot examples and answers given with no tool call.

**Demo:** `GUARD=off node server.js` and ask the failing input → the unverified output gets through. Then run `node server.js` → the same input is blocked.

## Reliability test
`npm test`: 6 offline guard tests (all pass). `npm run test:reliability`: 5 inputs × 2 runs (price, PvE price, ambiguous, flea-banned, off-task). Checks format, tool use, guard, expected behavior, and run-to-run consistency. Results: `TEST-RESULTS.md`.
