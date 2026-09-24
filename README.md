# Tarkov Price Terminal

A one-task AI assistant: type an Escape From Tarkov item, get its current market value. The browser UI looks like a terminal.

## Run
```bash
npm install                 # one dependency: @anthropic-ai/sdk
cp .env.example .env        # paste your Anthropic API key into .env
node server.js              # Node 21.7+
# open http://localhost:3000
```
In the terminal: `ledx`, `gpu pve`, `mode pve`, `help`, `clear`.

## Test
```bash
npm test                    # offline guard tests (no key needed)
npm run test:reliability    # 5 inputs x 2 runs, live -> TEST-RESULTS.md
```

## Demo the failure mode
```bash
GUARD=off node server.js    # guard disabled: unverified numbers get through
```
See `SPEC.md` → Failure mode.

## Files
| File | Role |
|---|---|
| `prompts/system-prompt.md` | Role, rules, and the fixed output formats |
| `prompts/examples.json` | 2 few-shot exchanges (clean match, ambiguous name) |
| `lib/tarkov.js` | Live lookup against tarkov.dev, with numbers pre-formatted |
| `lib/assistant.js` | Claude (Sonnet 5) tool loop and the number-verification guard |
| `server.js` | Static UI and `POST /api/ask` |
| `public/` | Terminal UI |
| `SPEC.md` | One-page spec sheet |
