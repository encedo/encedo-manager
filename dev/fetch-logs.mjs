// Read every audit-log file off a real module and keep it.
//
//   node dev/fetch-logs.mjs                          # https://my.ence.do, asks for the password
//   node dev/fetch-logs.mjs --hem https://192.168.7.1 --out ~/hem-logs
//   node dev/fetch-logs.mjs --phone                  # approve on the paired phone instead
//
// The password is read with the echo off, used to take one `logger:get` token,
// and never written anywhere. Every file is verified in this process — the same
// check the Manager does in the browser — and the results land in index.json
// beside the files, so a failure is recorded rather than glossed over.

import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';
import { HEM, HemError, verifyLog, verifyLoggerKey } from '../sdk/hem-sdk.js';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const at = args.indexOf(name);
  return at === -1 ? fallback : args[at + 1];
};
const has = (name) => args.includes(name);

const hemUrl = arg('--hem', 'https://my.ence.do').replace(/\/+$/, '');
const outDir = path.resolve(arg('--out', 'hem-logs').replace(/^~(?=$|\/)/, process.env.HOME ?? '~'));

function askPassword(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    let muted = false;
    rl._writeToOutput = (chunk) => { if (!muted) rl.output.write(chunk); };
    rl.question(question, (value) => { rl.close(); process.stdout.write('\n'); resolve(value); });
    muted = true;
  });
}

const hem = new HEM(hemUrl);
console.log(`module   ${hemUrl}`);

let version;
try {
  version = await hem.getVersion({ timeoutMs: 5000 });
} catch (e) {
  console.error(`\nThe module did not answer: ${e.message}`);
  console.error('Plug the PPA in, or pass --hem with the address it answers on.');
  if (e.code === 'network') console.error('If it answers on https with a certificate this machine does not trust, run with NODE_TLS_REJECT_UNAUTHORIZED=0.');
  process.exit(1);
}
console.log(`firmware ${version.fwv} · ${version.conf ?? version.hwv}`);

let token;
try {
  if (has('--phone')) {
    process.stdout.write('waiting for the phone to approve');
    token = await hem.authorizeRemote('logger:get', { pollInterval: 2000, pollTimeout: 180_000, onPending: () => process.stdout.write('.') });
    process.stdout.write('\n');
  } else {
    const password = process.env.HEM_PASSWORD ?? await askPassword('password ');
    token = await hem.authorizePassword(password, 'logger:get', 900);
  }
} catch (e) {
  console.error(`\nThe module refused: ${e instanceof HemError ? `${e.code} — ${e.message}` : e.message}`);
  process.exit(1);
}

const loggerKey = await hem.getLoggerKey(token);
const signed = await verifyLoggerKey(loggerKey);
console.log(`logger key ${loggerKey.key?.slice(0, 16)}… · nonce ${signed ? 'signed by this module' : 'NOT SIGNED — the key proves nothing'}`);

const ids = [];
let page = await hem.listLog(token, 0);
const total = Number(page.total ?? page.id?.length ?? 0);
while (page.id?.length) {
  ids.push(...page.id);
  if (ids.length >= total) break;
  page = await hem.listLog(token, ids.length);
}
console.log(`${ids.length} log file${ids.length === 1 ? '' : 's'}\n`);

await fs.mkdir(outDir, { recursive: true });
// A second run keeps what is already there and asks only for what is missing.
const already = new Set((await fs.readdir(outDir).catch(() => [])).filter((f) => f.endsWith('.log')).map((f) => f.replace(/\.log$/, '')));
if (already.size) console.log(`${already.size} already in ${outDir}; asking only for the rest\n`);
const index = { module: hemUrl, firmware: version, loggerKey, keySigned: signed, fetched: new Date().toISOString(), files: [] };

/** A module answering over USB drops the odd request; ask again before giving up. */
async function readFile(id, attempts = 3) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await hem.getLogEntry(token, id);
    } catch (e) {
      if (attempt >= attempts) throw e;
      await new Promise((r) => setTimeout(r, 400 * attempt));
    }
  }
}

for (const id of ids) {
  let text;
  try {
    if (already.has(id) && !has('--again')) {
      text = await fs.readFile(path.join(outDir, `${id}.log`), 'utf8');
    } else {
      text = await readFile(id);
    }
  } catch (e) {
    console.log(`${id}  could not be read after three tries: ${e.message}`);
    index.files.push({ id, error: e.message });
    continue;
  }
  if (typeof text !== 'string') text = JSON.stringify(text);
  const result = await verifyLog(loggerKey.key, text);
  const lines = text.split('\n').filter((l) => l && l[0] !== '#').length;
  await fs.writeFile(path.join(outDir, `${id}.log`), text);
  index.files.push({ id, bytes: text.length, lines, ...result });
  const when = new Date(parseInt(id, 16) * 1000);
  const stamp = Number.isFinite(when.getTime()) ? when.toISOString().slice(0, 19).replace('T', ' ') : '—';
  console.log(`${id}  ${stamp}  ${String(lines).padStart(5)} lines  ${result.ok ? 'verified' : `FAILS at entry ${result.line} · ${result.reason}`}`);
}

await fs.writeFile(path.join(outDir, 'index.json'), JSON.stringify(index, null, 2) + '\n');
console.log(`\nWritten to ${outDir}`);
console.log('These are your module\'s records. The repo does not track that directory.');
