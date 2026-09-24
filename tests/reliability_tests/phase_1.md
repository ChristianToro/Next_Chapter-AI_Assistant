# Reliability Test Results

Run: 2026-09-24T21:43:58.644Z · model: claude-sonnet-5 · effort low · 2 runs per input

| Input | Mode | Expected behavior | Runs | Consistency | Notes |
|---|---|---|---|---|---|
| `LEDX` | regular | price | PASS / FAIL | DIFFERENT | guard blocked: 901,234 950,000 889,000 1.4 555,111 2026 01 15 09 30; PRICE labels missing/out of order; no tool call |
| `how much is a gpu in pve` | regular | price | PASS / FAIL | DIFFERENT | PRICE labels missing/out of order; mode not PvE |
| `key` | regular | matches | FAIL / FAIL | identical | guard blocked: 5; expected MATCHES block; guard blocked: 5; expected MATCHES block |
| `ledz` | regular | didyoumean | FAIL / FAIL | identical | did not retry with a corrected spelling; did not retry with a corrected spelling |
| `Red Rebel ice pick` | regular | price-or-noflea | PASS / PASS | identical | — |
| `best m4 build for labs` | regular | offtask | PASS / PASS | identical | — |

"identical" = byte-for-byte same output across runs. "same structure" = same block type (prices may tick between runs).

## Raw outputs

### `LEDX` (default mode: regular)
Run 1 — tool calls: 1, guard: passed
```
ITEM ........ LEDX Skin Transilluminator
MODE ........ PvP
FLEA AVG 24H  ₽ 557,192   (7-day avg ₽ 569,657)
LOWEST NOW .. ₽ 590,000
24H TREND ... +5.9%
BEST TRADER . Therapist ₽ 494,700
UPDATED ..... 2026-09-24 20:54 UTC · source: tarkov-market.com
NOTE ........ Flea prices move hourly; confirm in-game before trading.
```
Run 2 — tool calls: 0, guard: BLOCKED
```
UNVERIFIED .. Answer contained numbers not found in live data. Blocked.
NOTE ........ Try the full item name. I will not show unverified prices.
```

### `how much is a gpu in pve` (default mode: regular)
Run 1 — tool calls: 1, guard: passed
```
ITEM ........ Graphics card
MODE ........ PvE
FLEA AVG 24H  ₽ 753,504   (7-day avg ₽ 744,989)
LOWEST NOW .. ₽ 754,999
24H TREND ... +0.2%
BEST TRADER . Therapist ₽ 100,980
UPDATED ..... 2026-09-24 21:34 UTC · source: tarkov-market.com
NOTE ........ Flea prices move hourly; confirm in-game before trading.
```
Run 2 — tool calls: 1, guard: passed
```
DID YOU MEAN  Graphics card
NOTE ........ No exact match for "gpu". Reply "yes" for its price, or type another name.
```

### `key` (default mode: regular)
Run 1 — tool calls: 1, guard: BLOCKED
```
UNVERIFIED .. Answer contained numbers not found in live data. Blocked.
NOTE ........ Try the full item name. I will not show unverified prices.
```
Run 2 — tool calls: 1, guard: BLOCKED
```
UNVERIFIED .. Answer contained numbers not found in live data. Blocked.
NOTE ........ Try the full item name. I will not show unverified prices.
```

### `ledz` (default mode: regular)
Run 1 — tool calls: 1, guard: passed
```
DID YOU MEAN  LEDX Skin Transilluminator
NOTE ........ No exact match for "ledz". Reply "yes" for its price, or type another name.
```
Run 2 — tool calls: 1, guard: passed
```
DID YOU MEAN  LEDX Skin Transilluminator
NOTE ........ No exact match for "ledz". Reply "yes" for its price, or type another name.
```

### `Red Rebel ice pick` (default mode: regular)
Run 1 — tool calls: 1, guard: passed
```
ITEM ........ Red Rebel ice pick
MODE ........ PvP
FLEA AVG 24H  ₽ 846,198   (7-day avg ₽ 825,128)
LOWEST NOW .. ₽ 880,000
24H TREND ... -5.5%
BEST TRADER . Jaeger ₽ 796,773
UPDATED ..... 2026-09-24 21:35 UTC · source: tarkov-market.com
NOTE ........ Flea prices move hourly; confirm in-game before trading.
```
Run 2 — tool calls: 1, guard: passed
```
ITEM ........ Red Rebel ice pick
MODE ........ PvP
FLEA AVG 24H  ₽ 846,198   (7-day avg ₽ 825,128)
LOWEST NOW .. ₽ 880,000
24H TREND ... -5.5%
BEST TRADER . Jaeger ₽ 796,773
UPDATED ..... 2026-09-24 21:35 UTC · source: tarkov-market.com
NOTE ........ Flea prices move hourly; confirm in-game before trading.
```

### `best m4 build for labs` (default mode: regular)
Run 1 — tool calls: 0, guard: passed
```
OFF-TASK .... I only look up current item prices.
NOTE ........ Try: "ledx", "gpu pve", "price of salewa".
```
Run 2 — tool calls: 0, guard: passed
```
OFF-TASK .... I only look up current item prices.
NOTE ........ Try: "ledx", "gpu pve", "price of salewa".
```
