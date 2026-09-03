// Browser smoke test: drive the real page in headless Chromium over the
// DevTools protocol against the mock, sign in, unlock a drive, and take
// screenshots. No dependencies beyond Node 22+ (global WebSocket) and Chromium.
//
//   node v2/dev/smoke.mjs [out-dir] [chromium-binary]

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import { createServer } from './serve.mjs';

const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });

const outDir = path.resolve(process.argv[2] ?? '.');
const chromium = process.argv[3] ?? process.env.CHROMIUM ?? '/usr/bin/chromium-browser';
const DEBUG_PORT = await freePort();
setTimeout(() => { console.error('FAIL timed out after 90 s'); process.exit(2); }, 90_000).unref();

let id, pending, logs, send;
const server = await createServer({ approveAfter: 2 });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const url = `${base}/v2/?hem=${base}/mock&broker=${base}/mockbroker`;

const profile = await fs.mkdtemp(path.join(outDir, '.chrome-'));
const chrome = spawn(chromium, ['--headless=new', '--disable-gpu', '--no-sandbox', `--user-data-dir=${profile}`, `--remote-debugging-port=${DEBUG_PORT}`, '--window-size=1440,900', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });

chrome.on('error', () => {});   // a snap-confined Chromium cannot be signalled; Browser.close does the job
const fail = async (msg) => { console.error('FAIL', msg); await cleanup(); process.exit(1); };
async function cleanup() {
  try { await Promise.race([send('Browser.close'), new Promise((r) => setTimeout(r, 1500))]); } catch { /* already gone */ }
  try { chrome.kill(); } catch { /* EACCES under snap */ }
  server.close();
  await fs.rm(profile, { recursive: true, force: true }).catch(() => {});
}

// wait for the devtools endpoint
let targets;
for (let i = 0; i < 50; i++) {
  try { targets = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`)).json(); break; } catch { await new Promise((r) => setTimeout(r, 200)); }
}
if (!targets) await fail('chromium did not open the devtools port');
const page = targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });

id = 0; pending = new Map(); logs = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); }
  if (m.method === 'Runtime.consoleAPICalled') logs.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
  if (m.method === 'Runtime.exceptionThrown') logs.push('EXCEPTION ' + (m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text));
};
send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async (expression) => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text); return r.result.value; };
const waitFor = async (expression, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await evaluate(expression)) return true; await new Promise((r) => setTimeout(r, 100)); } return false; };
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); await fs.writeFile(path.join(outDir, name), Buffer.from(r.data, 'base64')); console.log('screenshot', name); };

await send('Runtime.enable'); await send('Page.enable');
await send('Page.navigate', { url });

// 1. sign-in form appears once the mock answered
if (!(await waitFor(`!!document.querySelector('#password')`))) await fail('sign-in form did not appear');
if (!(await waitFor(`document.body.textContent.includes('a phone is paired')`))) await fail('prepare() did not finish (phone status missing)');
await shot('smoke-signin.png');

// 2. wrong password is refused
await evaluate(`document.querySelector('#password').value = 'nope'; document.querySelector('form').requestSubmit(); true`);
if (!(await waitFor(`document.body.textContent.includes('The password is not correct.')`))) await fail('wrong password was not refused');

// 3. right password signs in and the overview renders
await evaluate(`document.querySelector('#password').value = 'demo'; document.querySelector('form').requestSubmit(); true`);
if (!(await waitFor(`document.querySelector('h1')?.textContent === 'The module is sealed and reachable.'`))) await fail('overview did not render after sign-in');
if (!(await waitFor(`document.body.textContent.includes('v2.5.0+mock available')`))) await fail('update flag missing on overview');
await shot('smoke-overview.png');

// 4. secure drive: unlock read-write, then lock
await evaluate(`location.hash = '#/drive'; true`);
if (!(await waitFor(`document.querySelector('h1')?.textContent === 'Two drives, all sealed.'`))) await fail('drive page did not render');
await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent === 'Unlock read-write').click(); true`);
if (!(await waitFor(`document.querySelector('h1')?.textContent === 'One drive is on the host.'`))) await fail('unlock did not change the drive state');
await shot('smoke-drive.png');
await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent === 'Lock').click(); true`);
if (!(await waitFor(`document.querySelector('h1')?.textContent === 'Two drives, all sealed.'`))) await fail('lock did not change the drive state');

// 5. sign out returns to the form
await evaluate(`[...document.querySelectorAll('a')].find(a => a.textContent === 'Sign out').click(); true`);
if (!(await waitFor(`!!document.querySelector('#password')`))) await fail('sign out did not return to the form');

const bad = logs.filter((l) => /EXCEPTION|error/i.test(l));
if (bad.length) { console.log('console:', bad.join('\n')); await fail('page logged errors'); }
console.log('OK: sign-in, overview, drive unlock/lock, sign-out');
await cleanup();
