const out = document.getElementById('out');
const input = document.getElementById('in');
const promptEl = document.getElementById('prompt');
const form = document.getElementById('line');

let mode = 'regular';
const history = [];
let histPos = 0;

const HELP = `TARKOV PRICE TERMINAL v1 — current market value of one EFT item.

  <item name>     look up a price       e.g.  ledx | gpu pve | price of salewa
  mode pve|pvp    switch default mode   (currently shown in the prompt)
  clear           clear the screen
  help            show this help

Price data: tarkov-market.com (live flea scans). Confirm in-game before trading.
Only type item names. Never enter account names, emails or passwords.`;

print(HELP, 'dim');

document.getElementById('term').addEventListener('click', () => input.focus());

input.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowUp' && histPos > 0) input.value = history[--histPos];
  else if (e.key === 'ArrowDown' && histPos < history.length) input.value = history[++histPos] ?? '';
  else return;
  e.preventDefault();
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const cmd = input.value.trim();
  input.value = '';
  if (!cmd) return;
  history.push(cmd);
  histPos = history.length;
  print(`${promptEl.textContent} ${cmd}`, 'echo');

  const lower = cmd.toLowerCase();
  if (lower === 'help') return print(HELP, 'dim');
  if (lower === 'clear') { out.textContent = ''; return; }
  const m = lower.match(/^mode\s+(pve|pvp)$/);
  if (m) {
    mode = m[1] === 'pve' ? 'pve' : 'regular';
    promptEl.textContent = `pmc@flea:~[${m[1]}]$`;
    return print(`mode set to ${m[1].toUpperCase()}`, 'dim');
  }

  const pending = print('querying tarkov-market.com ', 'dim busy');
  input.disabled = true;
  try {
    const res = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: cmd, mode }),
    });
    const data = await res.json();
    pending.remove();
    if (!res.ok) return print(`ERROR ....... ${data.error}`, 'err');
    const cls = /^(UNVERIFIED|ERROR|NOT FOUND|OFF-TASK)/.test(data.reply) ? 'warn' : '';
    print(data.reply, cls);
    if (!data.guard.enabled) print('[guard OFF — output not verified]', 'err');
  } catch (err) {
    pending.remove();
    print(`ERROR ....... ${err.message}`, 'err');
  } finally {
    input.disabled = false;
    input.focus();
    window.scrollTo(0, document.body.scrollHeight);
  }
});

function print(text, cls = '') {
  const div = document.createElement('div');
  div.className = cls;
  div.textContent = text; // textContent, never innerHTML: model output is untrusted
  out.appendChild(div);
  window.scrollTo(0, document.body.scrollHeight);
  return div;
}
