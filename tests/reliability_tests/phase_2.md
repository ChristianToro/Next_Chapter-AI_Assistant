# Reliability Test Results

Run: 2026-09-25T00:24:03.762Z · model: claude-sonnet-5 · effort low · 2 runs per input

| Input | Mode | Expected behavior | Runs | Consistency | Notes |
|---|---|---|---|---|---|
| `LEDX` | regular | price | PASS / PASS | identical | — |
| `how much is a gpu in pve` | regular | price | PASS / PASS | identical | — |
| `key` | regular | matches | PASS / PASS | identical | — |
| `ledz` | regular | didyoumean | PASS / PASS | identical | — |
| `Physical Bitcoin` | regular | noflea | PASS / PASS | DIFFERENT | — |
| `best m4 build for labs` | regular | offtask | PASS / PASS | identical | — |

"identical" = byte-for-byte same output across runs. "same structure" = same block type (prices may tick between runs).

## Raw outputs

### `LEDX` (default mode: regular)
Run 1 — tool calls: 1, guard: passed
- search "LEDX" (regular) → LEDX Skin Transilluminator
```
ITEM ........ LEDX Skin Transilluminator
MODE ........ PvP
FLEA AVG 24H  ₽ 564,999   (7-day avg ₽ 569,487)
LOWEST NOW .. ₽ 659,999
24H TREND ... +16.8%
BEST TRADER . Therapist ₽ 494,700
UPDATED ..... 2026-09-24 23:42 UTC · source: tarkov-market.com
NOTE ........ Flea prices move hourly; confirm in-game before trading.
```
Run 2 — tool calls: 1, guard: passed
- search "LEDX" (regular) → LEDX Skin Transilluminator
```
ITEM ........ LEDX Skin Transilluminator
MODE ........ PvP
FLEA AVG 24H  ₽ 564,999   (7-day avg ₽ 569,487)
LOWEST NOW .. ₽ 659,999
24H TREND ... +16.8%
BEST TRADER . Therapist ₽ 494,700
UPDATED ..... 2026-09-24 23:42 UTC · source: tarkov-market.com
NOTE ........ Flea prices move hourly; confirm in-game before trading.
```

### `how much is a gpu in pve` (default mode: regular)
Run 1 — tool calls: 1, guard: passed
- search "gpu" (pve) → Graphics card | AR-15 5.56x45 Magpul PMAG D-60 STANAG 60-round magazine | AR-10 7.62x51 Magpul PMAG 20 SR-LR GEN M3 20-round magazine | AR-15 5.56x45 Magpul PMAG 20 GEN M3 STANAG 20-round magazine | M700 7.62x51 Magpul PMAG AC 5-round magazine
```
ITEM ........ Graphics card
MODE ........ PvE
FLEA AVG 24H  ₽ 755,065   (7-day avg ₽ 744,552)
LOWEST NOW .. ₽ 750,000
24H TREND ... -7.3%
BEST TRADER . Therapist ₽ 100,980
UPDATED ..... 2026-09-25 00:20 UTC · source: tarkov-market.com
NOTE ........ Flea prices move hourly; confirm in-game before trading.
```
Run 2 — tool calls: 1, guard: passed
- search "gpu" (pve) → Graphics card | AR-15 5.56x45 Magpul PMAG D-60 STANAG 60-round magazine | AR-10 7.62x51 Magpul PMAG 20 SR-LR GEN M3 20-round magazine | AR-15 5.56x45 Magpul PMAG 20 GEN M3 STANAG 20-round magazine | M700 7.62x51 Magpul PMAG AC 5-round magazine
```
ITEM ........ Graphics card
MODE ........ PvE
FLEA AVG 24H  ₽ 755,065   (7-day avg ₽ 744,552)
LOWEST NOW .. ₽ 750,000
24H TREND ... -7.3%
BEST TRADER . Therapist ₽ 100,980
UPDATED ..... 2026-09-25 00:20 UTC · source: tarkov-market.com
NOTE ........ Flea prices move hourly; confirm in-game before trading.
```

### `key` (default mode: regular)
Run 1 — tool calls: 1, guard: passed
- search "key" (regular) → TerraGroup Labs keycard (Blue) | TerraGroup Labs access keycard | Kiba Arms outer door key | Key tool | Health Resort west wing room 219 key
```
MATCHES ..... 5 items match "key"
  - TerraGroup Labs keycard (Blue)
  - TerraGroup Labs access keycard
  - Kiba Arms outer door key
  - Key tool
  - Health Resort west wing room 219 key
NOTE ........ Type the full item name to get its price.
```
Run 2 — tool calls: 1, guard: passed
- search "key" (regular) → TerraGroup Labs keycard (Blue) | TerraGroup Labs access keycard | Kiba Arms outer door key | Key tool | Health Resort west wing room 219 key
```
MATCHES ..... 5 items match "key"
  - TerraGroup Labs keycard (Blue)
  - TerraGroup Labs access keycard
  - Kiba Arms outer door key
  - Key tool
  - Health Resort west wing room 219 key
NOTE ........ Type the full item name to get its price.
```

### `ledz` (default mode: regular)
Run 1 — tool calls: 2, guard: passed
- search "ledz" (regular) → Can of herring
- search "ledx" (regular) → LEDX Skin Transilluminator
```
DID YOU MEAN  LEDX Skin Transilluminator
NOTE ........ No exact match for "ledz". Reply "yes" for its price, or type another name.
```
Run 2 — tool calls: 2, guard: passed
- search "ledz" (regular) → Can of herring
- search "LEDX" (regular) → LEDX Skin Transilluminator
```
DID YOU MEAN  LEDX Skin Transilluminator
NOTE ........ No exact match for "ledz". Reply "yes" for its price, or type another name.
```

### `Physical Bitcoin` (default mode: regular)
Run 1 — tool calls: 1, guard: passed
- search "Physical Bitcoin" (regular) → Physical Bitcoin | Left half of a Physical Bitcoin | Right half of a Physical Bitcoin
```
Exact match found on "Physical Bitcoin".

ITEM ........ Physical Bitcoin
MODE ........ PvP
FLEA AVG 24H  not on flea
LOWEST NOW .. not on flea
24H TREND ... not on flea
BEST TRADER . Therapist ₽ 534,392
UPDATED ..... 2026-09-24 23:54 UTC · source: tarkov-market.com
NOTE ........ Flea prices move hourly; confirm in-game before trading.
```
Run 2 — tool calls: 1, guard: passed
- search "Physical Bitcoin" (regular) → Physical Bitcoin | Left half of a Physical Bitcoin | Right half of a Physical Bitcoin
```
Exact name match found - using PRICE format.

ITEM ........ Physical Bitcoin
MODE ........ PvP
FLEA AVG 24H  not on flea   (7-day avg not on flea)
LOWEST NOW .. not on flea
24H TREND ... not on flea
BEST TRADER . Therapist ₽ 534,392
UPDATED ..... 2026-09-24 23:54 UTC · source: tarkov-market.com
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
