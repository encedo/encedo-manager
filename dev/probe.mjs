// What a real module answers with, so a page can be built against it rather
// than against a guess.
//
//   node dev/probe.mjs                       # version and status: no password needed
//   node dev/probe.mjs --config              # also reads the configuration (asks for the password)
//   node dev/probe.mjs --selftest            # also runs the health check (asks for the password)
//   node dev/probe.mjs --hem https://192.168.7.1 --out hem-logs/probe.json
//
// Version and status carry no secrets. The attestation does — it can hand back
// a private key on a device that is not provisioned yet — so this never asks
// for it. The self-test needs a token and answers with counters only.

import fs from 'node:fs/promises';
import readline from 'node:readline';
import { HEM, HemError } from '../sdk/hem-sdk.js';

const args = process.argv.slice(2);
const arg = (name, fallback) => { const at = args.indexOf(name); return at === -1 ? fallback : args[at + 1]; };
const hemUrl = arg('--hem', 'https://my.ence.do').replace(/\/+$/, '');
const outFile = arg('--out', 'hem-logs/probe.json');

const askPassword = (question) => new Promise((resolve) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  let muted = false;
  rl._writeToOutput = (chunk) => { if (!muted) rl.output.write(chunk); };
  rl.question(question, (value) => { rl.close(); process.stdout.write('\n'); resolve(value); });
  muted = true;
});

const hem = new HEM(hemUrl);
const probe = { module: hemUrl, at: new Date().toISOString() };

try {
  probe.version = await hem.getVersion({ timeoutMs: 5000 });
  probe.status = await hem.getStatus({ timeoutMs: 5000 });
} catch (e) {
  console.error(`The module did not answer: ${e.message}`);
  if (e.code === 'network') console.error('If its certificate is not trusted here, run with NODE_TLS_REJECT_UNAUTHORIZED=0.');
  process.exit(1);
}

console.log('--- /api/system/version ---');
console.log(JSON.stringify(probe.version, null, 2));
console.log('--- /api/system/status ---');
console.log(JSON.stringify(probe.status, null, 2));

// The configuration needs a token. It carries the owner's nickname and e-mail —
// the module's own settings, no secrets — and the values a password change is
// built on (eid, spk, nonce).
if (args.includes('--config')) {
  try {
    const password = process.env.HEM_PASSWORD ?? await askPassword('password ');
    const token = await hem.authorizePassword(password, 'system:config', 300);
    probe.config = await hem.getConfig(token);
    console.log('--- /api/system/config ---');
    console.log(JSON.stringify(probe.config, null, 2));
    process.env.HEM_PASSWORD = password;        // so --selftest does not ask twice
  } catch (e) {
    console.error(`config: ${e instanceof HemError ? `${e.code} — ${e.message}` : e.message}`);
    probe.configError = String(e.message);
  }
}

if (args.includes('--selftest')) {
  try {
    const password = process.env.HEM_PASSWORD ?? await askPassword('password ');
    const token = await hem.authorizePassword(password, 'system:config', 300);
    console.log('--- /api/system/selftest (this takes a moment) ---');
    probe.selftest = await hem.selftest(token);
    console.log(JSON.stringify(probe.selftest, null, 2));
    probe.statusAfter = await hem.getStatus({ timeoutMs: 5000 });
  } catch (e) {
    console.error(`self-test: ${e instanceof HemError ? `${e.code} — ${e.message}` : e.message}`);
    probe.selftestError = String(e.message);
  }
}

await fs.mkdir(outFile.replace(/\/[^/]+$/, ''), { recursive: true });
await fs.writeFile(outFile, JSON.stringify(probe, null, 2) + '\n');
console.log(`\nWritten to ${outFile}`);
