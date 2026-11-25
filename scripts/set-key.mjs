// Save one secret into .env.local without echoing it or touching shell history.
// Usage: npm run key -- SARVAM_API_KEY
import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import { existsSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';

const name = process.argv[2];
if (!/^[A-Z][A-Z0-9_]*$/.test(name ?? '')) {
  console.error('Usage: npm run key -- NAME   (NAME in CAPS, e.g. FLAGSMITH_ENV_KEY)');
  process.exit(1);
}
let muted = false;
const out = new Writable({ write(chunk, _enc, cb) { if (!muted) process.stdout.write(chunk); cb(); } });
const rl = createInterface({ input: process.stdin, output: out, terminal: true });
rl.question(`Paste ${name} (hidden), then Enter: `, value => {
  rl.close();
  process.stdout.write('\n');
  value = value.trim();
  if (!value) { console.error('Nothing entered; unchanged.'); process.exit(1); }
  const file = '.env.local';
  const lines = existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter(l => l && !l.startsWith(name + '=')) : [];
  lines.push(`${name}=${value}`);
  writeFileSync(file, lines.join('\n') + '\n', { mode: 0o600 });
  chmodSync(file, 0o600);
  console.log(`saved ${name} (${value.length} chars) to ${file}`);
});
muted = true;
