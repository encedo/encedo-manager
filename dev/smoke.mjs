// Browser smoke test: drive the real page in headless Chromium over the
// DevTools protocol against the mock, sign in, unlock a drive, and take
// screenshots. No dependencies beyond Node 22+ (global WebSocket) and Chromium.
//
//   node dev/smoke.mjs [out-dir] [chromium-binary]

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import { createServer, MASTER_WORDS } from './serve.mjs';

const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });

const outDir = path.resolve(process.argv[2] ?? '.');
const chromium = process.argv[3] ?? process.env.CHROMIUM ?? '/usr/bin/chromium-browser';
const DEBUG_PORT = await freePort();
setTimeout(() => { console.error('FAIL timed out after 150 s'); process.exit(2); }, 150_000).unref();

let id, pending, logs, send;
const server = await createServer({ approveAfter: 2 });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
// MANAGER_PATH=/dist/ runs the same smoke against the built bundle.
const url = `${base}${process.env.MANAGER_PATH ?? '/'}?hem=${base}/mock&broker=${base}/mockbroker`;

const profile = await fs.mkdtemp(path.join(outDir, '.chrome-'));
const chrome = spawn(chromium, ['--headless=new', '--disable-gpu', '--no-sandbox', `--user-data-dir=${profile}`, `--remote-debugging-port=${DEBUG_PORT}`, '--window-size=1440,900', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });

chrome.on('error', () => {});   // a snap-confined Chromium cannot be signalled; Browser.close does the job
const fail = async (msg) => {
  console.error('FAIL', msg);
  try { console.error('page:', await evaluate(`JSON.stringify({ h1: document.querySelector('h1')?.textContent, errors: [...document.querySelectorAll('.error')].map(e => e.textContent), url: location.href })`)); } catch { /* gone */ }
  if (logs.length) console.error('console:', logs.slice(-20).join('\n'));
  await cleanup(); process.exit(1);
};
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
/** A real mouse click, for the few things a synthetic .click() is not allowed to do. */
const clickAt = async (expression) => {
  const box = await evaluate(`(() => {
    const el = ${expression};
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`);
  if (!box) await fail('nothing to click for ' + expression);
  for (const type of ['mousePressed', 'mouseReleased']) {
    await send('Input.dispatchMouseEvent', { type, x: box.x, y: box.y, button: 'left', clickCount: 1 });
  }
};
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

// 5. keychain: paging, sorting, search, a key opened under its own row, a share
//    code with its QR, and a key created and deleted again
await evaluate(`location.hash = '#/keychain'; true`);
if (!(await waitFor(`document.querySelector('h1')?.textContent === '14 keys; 2 are public keys you imported.'`))) await fail('keychain did not render');
if (!(await waitFor(`document.querySelectorAll('tbody tr:not(.detail)').length === 10`))) await fail('the first page is not ten rows');
if (!(await evaluate(`document.body.textContent.includes('Showing 1–10 of 14')`))) await fail('no word of what is shown');
await shot('smoke-keychain.png');

// paging
await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent === 'Next').click(); true`);
if (!(await waitFor(`document.querySelectorAll('tbody tr:not(.detail)').length === 4`))) await fail('the second page is not four rows');
if (!(await evaluate(`document.body.textContent.includes('page 2 of 2')`))) await fail('the page counter is missing');
await evaluate(`(() => {
  const size = document.querySelector('.card-foot select');
  size.value = '0'; size.dispatchEvent(new Event('change', { bubbles: true })); return true;
})()`);
if (!(await waitFor(`document.querySelectorAll('tbody tr:not(.detail)').length === 14`))) await fail('“All of them” did not show all of them');

// sorting
const firstLabel = `document.querySelector('tbody tr td b')?.textContent`;
if (await evaluate(firstLabel) !== "Ann's Pixel") await fail('the table does not start sorted by label');
await evaluate(`[...document.querySelectorAll('th button')].find(b => b.textContent.startsWith('Created')).click(); true`);
if (!(await waitFor(`${firstLabel} === 'oidc-p384'`))) await fail('sorting by date did not put the newest first');
await evaluate(`[...document.querySelectorAll('th button')].find(b => b.textContent.startsWith('Created')).click(); true`);
if (!(await waitFor(`${firstLabel} === 'old-attestation'`))) await fail('clicking the same column again did not reverse it');
await evaluate(`[...document.querySelectorAll('th button')].find(b => b.textContent.startsWith('Label')).click(); true`);

// search
await evaluate(`(() => {
  const q = document.querySelector('input[type=search]');
  q.focus(); q.value = 'wg-peer'; q.dispatchEvent(new Event('input', { bubbles: true })); return true;
})()`);
if (!(await waitFor(`document.querySelectorAll('tbody tr:not(.detail)').length === 1`))) await fail('search did not filter the table');
if (!(await evaluate(`document.activeElement === document.querySelector('input[type=search]')`))) await fail('search box lost the caret');
if (!(await evaluate(`document.body.textContent.includes('1 of 14')`))) await fail('the count does not follow the search');

// a key opens under its own row
await evaluate(`(() => {
  const q = document.querySelector('input[type=search]');
  q.value = ''; q.dispatchEvent(new Event('input', { bubbles: true }));
  document.querySelector('tbody tr td.actions button').click(); return true;
})()`);
if (!(await waitFor(`[...document.querySelectorAll('h2')].some(el => el.textContent === 'Public key')`))) await fail('the public key did not arrive');
if (!(await evaluate(`document.querySelector('tbody tr').nextElementSibling?.classList.contains('detail')`))) await fail('the details are not under the row that opened them');
if (!(await evaluate(`[...document.querySelectorAll('td.actions button')].some(b => b.textContent === 'Less')`))) await fail('the open row does not offer to close');
if (!(await evaluate(`document.body.textContent.includes('Sealed in the module')`))) await fail('key details missing');
if (!(await evaluate(`(() => {
  const row = document.querySelector('tbody tr');
  const field = [...document.querySelectorAll('.detail-body input')][1];
  return /^[A-Za-z0-9+/]+={0,2}$/.test(field.value) && row.title.includes(field.value) && row.title.includes('hex');
})()`))) await fail('the row does not offer the same description the field holds');
if (!(await evaluate(`document.querySelector('tbody tr .sub').textContent.startsWith('kid ')`))) await fail('the key id is not under the label');

// the copy control on a field takes what the field says. The clipboard needs a
// focused page and a real click, so this is the one place the test uses both.
await send('Browser.grantPermissions', { origin: base, permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] });
await send('Page.bringToFront');
await clickAt(`[...document.querySelectorAll('.detail-body .field-head')].find(f => f.textContent.startsWith('Label'))?.querySelector('button.copy')`);
if (!(await waitFor(`[...document.querySelectorAll('button.copy')].some(b => b.textContent.includes('Copied'))`))) await fail('the copy control did not say it had copied');
if (await evaluate(`navigator.clipboard.readText()`) !== "Ann's Pixel") await fail('the label did not reach the clipboard');

// a share code, and the QR that carries it to a phone
if (!(await waitFor(`![...document.querySelectorAll('button')].find(b => b.textContent === 'Make a share code')?.disabled`))) await fail('the share button stayed disabled');
await evaluate(`(() => {
  const note = [...document.querySelectorAll('.detail-body input')].find(i => i.placeholder === 'What this key is for');
  note.value = 'for the laptop';
  [...document.querySelectorAll('button')].find(b => b.textContent === 'Make a share code').click(); return true;
})()`);
if (!(await waitFor(`!!document.querySelector('figure.qr svg')`))) await fail('no QR code');
if (!(await evaluate(`document.querySelector('figure.qr svg path').getAttribute('d').length > 500`))) await fail('the QR code is empty');
await evaluate(`document.querySelector('.detail-body').scrollIntoView({ block: 'start' }); true`);
await shot('smoke-key.png');

// the share code goes round: import it back as somebody else's public key
const shareCode = await evaluate(`document.querySelector('.share-out .blob').textContent`);
await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent === 'Import public key').click(); true`);
if (!(await waitFor(`!!document.querySelector('form.card textarea')`))) await fail('the import form did not open');
await evaluate(`(() => {
  const form = document.querySelector('form.card');
  const code = [...form.querySelectorAll('textarea')].find(t => t.placeholder.startsWith('Paste a share code'));
  code.value = ${JSON.stringify(shareCode)};
  [...form.querySelectorAll('button')].find(b => b.textContent === 'Read the share code').click();
  return true;
})()`);
if (!(await waitFor(`(() => {
  const form = document.querySelector('form.card');
  const pubkey = form.querySelector('textarea');
  return pubkey.value.length > 20 && form.querySelector('input').value === "Ann's Pixel";
})()`))) await fail('the share code did not fill the import form in');
await evaluate(`(() => {
  const form = document.querySelector('form.card');
  form.querySelector('input').value = 'ann (imported)';
  form.requestSubmit();
  return true;
})()`);
if (!(await waitFor(`document.querySelector('h1')?.textContent.startsWith('15 keys')`))) await fail('the imported key is not in the list');
if (!(await evaluate(`(() => {
  const row = [...document.querySelectorAll('tbody tr')].find(r => r.textContent.includes('ann (imported)'));
  return row && row.textContent.includes('Public only');
})()`))) await fail('the imported key is not marked public only');
await evaluate(`(() => {
  const row = [...document.querySelectorAll('tbody tr')].find(r => r.textContent.includes('ann (imported)'));
  row.querySelector('td.actions button').click(); return true;
})()`);
if (!(await waitFor(`[...document.querySelectorAll('button')].some(b => b.textContent === 'Delete this key')`))) await fail('the imported key does not open');
await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent === 'Delete this key').click(); true`);
await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent === 'Delete for good').click(); true`);
if (!(await waitFor(`document.querySelector('h1')?.textContent.startsWith('14 keys')`))) await fail('the imported key was not deleted');

// create and delete
await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent === 'Create key pair').click(); true`);
if (!(await waitFor(`!!document.querySelector('form.card input[placeholder="wg-peer-04"]')`))) await fail('the create form did not open');
await evaluate(`(() => {
  const f = document.querySelector('form.card');
  f.querySelector('input[placeholder="wg-peer-04"]').value = 'smoke-key';
  f.querySelector('input[placeholder="WireGuard identity, laptop"]').value = 'made by the smoke test';
  f.requestSubmit(); return true;
})()`);
if (!(await waitFor(`document.querySelector('h1')?.textContent.startsWith('15 keys')`))) await fail('the new key is not in the list');
if (!(await evaluate(`document.body.textContent.includes('Created. The module keeps the private half.')`))) await fail('no word of the new key');

await evaluate(`(() => {
  const q = document.querySelector('input[type=search]');
  q.value = 'smoke-key'; q.dispatchEvent(new Event('input', { bubbles: true }));
  document.querySelector('tbody tr td.actions button').click(); return true;
})()`);
// label and description are read-only until Edit unlocks them
if (!(await waitFor(`document.querySelector('.detail-body input')?.readOnly === true`))) await fail('the label was editable before Edit');
await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent === 'Edit').click(); true`);
if (!(await waitFor(`document.querySelector('.detail-body input')?.readOnly === false`))) await fail('Edit did not unlock the fields');
const counters = await evaluate(`[...document.querySelectorAll('.detail-body .count')].map(c => c.textContent).join(' | ')`);
if (!counters.includes('/ 64') || !counters.includes('/ 128 bytes')) await fail('the fields do not say how much room is left: ' + counters);
await evaluate(`document.querySelector('.detail-body form').scrollIntoView({ block: 'center' }); true`);
await shot('smoke-edit.png');
await evaluate(`(() => {
  const input = document.querySelector('.detail-body input');
  input.value = 'zażółć'; input.dispatchEvent(new Event('input', { bubbles: true })); return true;
})()`);
if (!(await waitFor(`[...document.querySelectorAll('.detail-body .count')].some(c => c.textContent.includes('ASCII only') && c.classList.contains('over'))`))) await fail('a label outside ASCII was not called out');
await evaluate(`(() => {
  const form = [...document.querySelectorAll('.detail-body form')].find(f => f.textContent.includes('Label and description'));
  form.querySelector('input').value = 'smoke-key-2';
  form.requestSubmit(); return true;
})()`);
if (!(await waitFor(`[...document.querySelectorAll('tbody tr td b')].some(b => b.textContent === 'smoke-key-2')`))) await fail('the new label did not reach the table');
if (!(await evaluate(`document.body.textContent.includes('Saved.')`))) await fail('no word that it saved');
if (!(await waitFor(`document.querySelector('.detail-body input')?.readOnly === true`))) await fail('the fields stayed unlocked after saving');

if (!(await waitFor(`[...document.querySelectorAll('button')].some(b => b.textContent === 'Delete this key')`))) await fail('no delete button');
await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent === 'Delete this key').click(); true`);
await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent === 'Delete for good').click(); true`);
if (!(await waitFor(`document.querySelector('h1')?.textContent.startsWith('14 keys')`))) await fail('the key was not deleted');

// 6. operation log: the index, one file verified in the browser, then all of them
await evaluate(`location.hash = '#/log'; true`);
if (!(await waitFor(`document.querySelector('h1')?.textContent === '7 log files, none read yet.'`))) await fail('the log index did not render');
if (!(await evaluate(`document.body.textContent.includes('The module signed a fresh nonce with it')`))) await fail('the logger key is not vouched for');
if (!(await evaluate(`document.querySelectorAll('tbody tr:not(.detail)').length === 7`))) await fail('the log files are not listed');
// The newest file is the session the module is still writing: it refuses it with a 406.
await evaluate(`document.querySelector('tbody tr td.actions button').click(); true`);
if (!(await waitFor(`document.body.textContent.includes('still being written')`))) await fail('the open file is not reported as open');
if (!(await evaluate(`document.body.textContent.includes('hands a file over once that session ends')`))) await fail('and it does not say why');
await evaluate(`document.querySelector('tbody tr td.actions button').click(); true`);

await evaluate(`[...document.querySelectorAll('tbody tr:not(.detail)')][1].querySelector('td.actions button').click(); true`);
if (!(await waitFor(`document.body.textContent.includes('entries verified')`))) await fail('the file did not verify');
if (!(await waitFor(`document.querySelectorAll('tr.detail tbody tr').length > 5`))) await fail('the entries are not shown');
if (!(await evaluate(`document.body.textContent.includes('Encedo nGINE FW')`))) await fail('the file does not say which firmware wrote it');
if (!(await evaluate(`document.body.textContent.includes('Clock set to')`))) await fail('an entry is not read into words');
if (!(await evaluate(`/Signature created \\([0-9a-f]{32}\\)/.test(document.body.textContent)`))) await fail('a key id in an entry is not rendered');
if (!(await evaluate(`document.body.textContent.includes('Log file read')`))) await fail('the opaque entry is not named');
// Entries from before the clock was set are dated from the file's own start.
if (!(await evaluate(`document.body.textContent.includes('Written before the clock was set')`))) await fail('the computed times are not explained');
if (!(await evaluate(`(() => {
  const first = document.querySelector('tr.detail tbody tr td:nth-child(2)');
  return /^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2} \\*$/.test(first.textContent.trim()) && first.title.includes('after the module started');
})()`))) await fail('the first entry is not dated with an asterisk');
await evaluate(`document.querySelector('tr.detail').scrollIntoView({ block: 'center' }); true`);
await shot('smoke-log.png');

await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.startsWith('Check every file')).click(); true`);
if (!(await waitFor(`document.body.textContent.includes('One file does not match its seal.')`, 20000))) await fail('checking every file did not find the edited one');
if (!(await evaluate(`document.body.textContent.includes('Fails at entry')`))) await fail('the edited file is not marked in the list');
if (!(await evaluate(`document.querySelector('h1')?.textContent.includes('one does not match its seal')`))) await fail('the heading does not report it');
if (!(await evaluate(`document.body.textContent.includes('still being written')`))) await fail('checking every file lost the open one');

// 6b. paired phones: the two in the keychain, one of them unknown to the broker;
//     a new one paired through the QR code; then one unpaired
await evaluate(`location.hash = '#/phones'; true`);
if (!(await waitFor(`document.querySelector('h1')?.textContent === 'Two phones can answer for you.'`))) await fail('the phones did not render');
if (!(await evaluate(`document.body.textContent.includes('Keychain only')`))) await fail('the phone the broker does not know is not marked');
await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent === 'Pair a phone').click(); true`);
if (!(await waitFor(`!!document.querySelector('figure.qr svg')`))) await fail('the pairing QR did not appear');
if (!(await evaluate(`/\\d+ s left/.test(document.querySelector('.card-head .v')?.textContent ?? '') || [...document.querySelectorAll('.card-head .v')].some(v => /\\d+ s left/.test(v.textContent))`))) await fail('the pairing timer is not shown');
await shot('smoke-phones-pairing.png');
if (!(await waitFor(`document.body.textContent.includes('Paired. The phone is a key in the keychain now')`, 15000))) await fail('the mock phone did not pair');
if (!(await waitFor(`document.querySelector('h1')?.textContent === '3 phones can answer for you.'`))) await fail('the new phone is not listed');
await evaluate(`[...document.querySelectorAll('tbody tr:not(.detail)')][0].querySelector('td.actions button').click(); true`);
if (!(await waitFor(`!!document.querySelector('tr.detail')`))) await fail('unpair did not ask first');
await shot('smoke-phones.png');
await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.startsWith('Unpair Ann')).click(); true`);
if (!(await waitFor(`document.body.textContent.includes('is unpaired: its key is gone')`))) await fail('the phone did not unpair');
if (!(await waitFor(`document.querySelector('h1')?.textContent === 'Two phones can answer for you.'`))) await fail('the list did not shrink');
// The phone the broker does not know: the broker answers 404, the page asks, and on yes the key goes anyway.
await evaluate(`[...document.querySelectorAll('tbody tr:not(.detail)')].find(r => r.textContent.includes('Work iPhone')).querySelector('td.actions button').click(); true`);
await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent === 'Unpair Work iPhone').click(); true`);
if (!(await waitFor(`document.querySelector('.veil h1')?.textContent === 'Do it anyway?'`))) await fail('the broker refusal did not ask');
if (!(await evaluate(`document.body.textContent.includes('refused to unpair it (HTTP 404)')`))) await fail('the modal does not say what the broker said');
await shot('smoke-phones-anyway.png');
await evaluate(`[...document.querySelectorAll('.veil button')].find(b => b.textContent === 'Leave it').click(); true`);
if (!(await waitFor(`!document.querySelector('.veil') && document.body.textContent.includes('Work iPhone')`))) await fail('leaving it did not keep the phone');
await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent === 'Unpair Work iPhone').click(); true`);
if (!(await waitFor(`document.querySelector('.veil h1')?.textContent === 'Do it anyway?'`))) await fail('the second refusal did not ask');
await evaluate(`[...document.querySelectorAll('.veil button')].find(b => b.textContent === 'Do it anyway').click(); true`);
if (!(await waitFor(`document.body.textContent.includes('can no longer answer: its key is gone')`))) await fail('doing it anyway did not remove the key');
if (!(await waitFor(`document.querySelector('h1')?.textContent === 'One phone can answer for you.'`))) await fail('the list did not shrink after doing it anyway');

// 7. hardware: what the module says about itself, its own health check, the
//    tokens this browser holds, and the reboot it will not do without asking twice
await evaluate(`location.hash = '#/hardware'; true`);
if (!(await waitFor(`document.querySelector('h1')?.textContent === 'The module reports nothing wrong.'`))) await fail('the hardware page did not render');
if (!(await evaluate(`document.body.textContent.includes('PPA rev 2.2')`))) await fail('the model is missing');
if (!(await evaluate(`document.body.textContent.includes('Encedo nGINE FW v1.2.2')`))) await fail('the firmware version is missing');
if (!(await evaluate(`document.body.textContent.includes('Bootloader signature')`))) await fail('what signed the software is missing');
if (!(await evaluate(`/\\d+(\\.\\d+)? °C/.test(document.body.textContent)`))) await fail('no temperature');

await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent === 'Run the health check').click(); true`);
if (!(await waitFor(`document.body.textContent.includes('found nothing wrong')`))) await fail('the health check did not report');
if (!(await evaluate(`document.body.textContent.includes('Known-answer test') && document.body.textContent.includes('Last entropy test')`))) await fail('the counters are not named');
await evaluate(`window.scrollTo(0, 0); true`);
await shot('smoke-hardware.png');

if (!(await evaluate(`document.body.textContent.includes('system:config')`))) await fail('the tokens this browser holds are not listed');
await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent === 'Forget them').click(); true`);
if (!(await waitFor(`document.body.textContent.includes('The next operation asks you again')`))) await fail('forgetting the tokens said nothing');
if (!(await evaluate(`document.body.textContent.includes('None. The next thing you ask for')`))) await fail('the token list did not empty');

await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent === 'Reboot the module').click(); true`);
if (!(await waitFor(`[...document.querySelectorAll('button')].some(b => b.textContent === 'Leave it running')`))) await fail('reboot went ahead without asking twice');
await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent === 'Leave it running').click(); true`);
if (!(await waitFor(`document.querySelector('h1')?.textContent === 'The module reports nothing wrong.'`))) await fail('cancelling the reboot did not return the page');

// the temperature line needs a second reading, which is ten seconds away
if (!(await waitFor(`!!document.querySelector('svg[aria-label^="Temperature"]')`, 20000))) await fail('the temperature line never drew');

// 8. settings: the owner, what the module trusts, the master passphrase, a name
//    under ence.do, the wipe guard, and a password change that ends the session
await evaluate(`location.hash = '#/settings'; true`);
if (!(await waitFor(`document.querySelector('h1')?.textContent === 'Ann’s module, as it is set up now.'`))) await fail('the settings did not render');

await evaluate(`(() => {
  const form = [...document.querySelectorAll('form.card')].find(f => f.textContent.includes('Who it belongs to'));
  form.querySelector('input').value = 'Ann R';
  form.requestSubmit(); return true;
})()`);
if (!(await waitFor(`document.body.textContent.includes('Saved. The module answers with what it made of it.')`))) await fail('the owner did not save');
if (!(await waitFor(`document.querySelector('h1')?.textContent.startsWith('Ann R')`))) await fail('and the page did not read it back');

await evaluate(`(() => {
  const form = [...document.querySelectorAll('form.card')].find(f => f.textContent.includes('What it takes on faith'));
  const answers = [...form.querySelectorAll('select')];
  answers[2].value = '1';                      // answer key searches without a token
  form.requestSubmit(); return true;
})()`);
if (!(await waitFor(`document.body.textContent.includes('3 of 3 on')`))) await fail('the trust settings did not save');

await evaluate(`(() => {
  const form = [...document.querySelectorAll('form.card')].find(f => f.textContent.includes('Master passphrase'));
  form.querySelector('textarea').value = ${JSON.stringify(MASTER_WORDS)};
  form.requestSubmit(); return true;
})()`);
if (!(await waitFor(`document.querySelector('h1')?.textContent.includes('unlocked with the master passphrase')`))) await fail('the 24 words did not unlock the settings');
await shot('smoke-settings.png');

await evaluate(`(() => {
  const form = [...document.querySelectorAll('form.card')].find(f => f.textContent.includes('What it is called'));
  form.querySelector('input').value = 'ann-ppa';
  [...form.querySelectorAll('button')].find(b => b.textContent === 'Is it free?').click(); return true;
})()`);
if (!(await waitFor(`document.body.textContent.includes('ann-ppa.ence.do is free.')`))) await fail('the domain check said nothing');

await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent === 'Wipe the module').click(); true`);
if (!(await waitFor(`!!document.querySelector('input[placeholder="WIPE"]')`))) await fail('the wipe did not ask to be confirmed');
await evaluate(`(() => {
  document.querySelector('input[placeholder="WIPE"]').value = 'yes go on';
  [...document.querySelectorAll('button')].find(b => b.textContent === 'Wipe it').click(); return true;
})()`);
if (!(await waitFor(`document.body.textContent.includes('Type WIPE to confirm')`))) await fail('the wipe accepted something other than WIPE');
await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent === 'Keep everything').click(); true`);

await evaluate(`(() => {
  const form = [...document.querySelectorAll('form.card')].find(f => f.textContent.includes('Password'));
  const fields = [...form.querySelectorAll('input')];
  fields[0].value = 'demo2'; fields[1].value = 'demo3';
  form.requestSubmit(); return true;
})()`);
if (!(await waitFor(`document.body.textContent.includes('The two passwords are not the same.')`))) await fail('two different passwords were accepted');
await evaluate(`(() => {
  const form = [...document.querySelectorAll('form.card')].find(f => f.textContent.includes('Password'));
  const fields = [...form.querySelectorAll('input')];
  fields[0].value = 'demo2'; fields[1].value = 'demo2';
  form.requestSubmit(); return true;
})()`);
if (!(await waitFor(`!!document.querySelector('#password')`))) await fail('changing the password did not end the session');
await evaluate(`document.querySelector('#password').value = 'demo'; document.querySelector('form').requestSubmit(); true`);
if (!(await waitFor(`document.body.textContent.includes('The password is not correct.')`))) await fail('the old password still worked');
await evaluate(`document.querySelector('#password').value = 'demo2'; document.querySelector('form').requestSubmit(); true`);
if (!(await waitFor(`!!document.querySelector('.sidebar')`))) await fail('the new password did not sign in');
// Signing in again lands on the page that was open, and the master authorisation went with the old session.
if (!(await waitFor(`document.querySelector('h1')?.textContent === 'Ann R’s module, as it is set up now.'`))) await fail('the settings still claim the master passphrase is in use');
await evaluate(`location.hash = '#/'; true`);
if (!(await waitFor(`document.querySelector('h1')?.textContent === 'The module is sealed and reachable.'`))) await fail('the overview did not come back');

// 9. sign out returns to the form
await evaluate(`[...document.querySelectorAll('a')].find(a => a.textContent === 'Sign out').click(); true`);
if (!(await waitFor(`!!document.querySelector('#password')`))) await fail('sign out did not return to the form');

// 10. signed in with the phone, a page that needs a token asks the phone and says so
await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent === 'Ask my phone').click(); true`);
if (!(await waitFor(`document.querySelector('h1')?.textContent === 'Confirm on your phone.'`))) await fail('the phone sign-in did not start');
if (!(await waitFor(`document.querySelector('h1')?.textContent === 'The module is sealed and reachable.'`, 15000))) await fail('the mock phone did not approve the sign-in');
if (!(await evaluate(`document.body.textContent.includes('signed in with the phone')`))) await fail('the masthead does not say how');
await evaluate(`location.hash = '#/log'; true`);
if (await evaluate(`document.body.textContent.includes('does not match its seal')`)) await fail('the last session\'s log notice survived the sign-out');
if (!(await waitFor(`!!document.querySelector('.card.asking')`))) await fail('the log page did not ask the phone');
if (!(await evaluate(`document.body.textContent.includes('read the operation log')`))) await fail('the banner does not say what for');
await shot('smoke-asking.png');
if (!(await waitFor(`!document.querySelector('.card.asking')`, 15000))) await fail('the banner did not go once the phone answered');
if (!(await waitFor(`document.querySelector('h1')?.textContent === '7 log files, none read yet.'`))) await fail('the log index did not render after the phone answered');
await evaluate(`location.hash = '#/drive'; true`);
if (!(await waitFor(`document.querySelector('h1')?.textContent === 'Two drives, all sealed.'`))) await fail('drive page did not render');
await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent === 'Unlock read-write').click(); true`);
if (!(await waitFor(`!!document.querySelector('.card.asking')`))) await fail('the unlock did not ask the phone');
await evaluate(`document.querySelector('.card.asking button').click(); true`);
if (!(await waitFor(`!document.querySelector('.card.asking') && document.body.textContent.includes('Cancelled.')`))) await fail('cancelling the request did not say so');
await evaluate(`[...document.querySelectorAll('a')].find(a => a.textContent === 'Sign out').click(); true`);
if (!(await waitFor(`!!document.querySelector('#password')`))) await fail('sign out did not return to the form');

// 11. a module out of the box: wipe this one from Settings, then personalise it
//     through the form, get the proof, and sign in with the new password
await evaluate(`location.hash = '#/'; document.querySelector('#password').value = 'demo2'; document.querySelector('form').requestSubmit(); true`);   // step 8 changed it
if (!(await waitFor(`document.querySelector('h1')?.textContent === 'The module is sealed and reachable.'`))) await fail('could not sign in again for the wipe');
await evaluate(`location.hash = '#/settings'; true`);
if (!(await waitFor(`[...document.querySelectorAll('button')].some(b => b.textContent === 'Wipe the module')`))) await fail('the settings did not render');
await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent === 'Wipe the module').click(); true`);
if (!(await waitFor(`(() => {
  const input = [...document.querySelectorAll('input')].find(i => i.placeholder === 'WIPE' || i.getAttribute('aria-label') === 'WIPE') ?? [...document.querySelectorAll('.card')].find(c => c.textContent.includes('Wipe it'))?.querySelector('input');
  if (!input) return false;
  input.value = 'WIPE'; input.dispatchEvent(new Event('input', { bubbles: true }));
  [...document.querySelectorAll('button')].find(b => b.textContent === 'Wipe it').click(); return true;
})()`))) await fail('the wipe could not be confirmed');
if (!(await waitFor(`document.querySelector('h1')?.textContent === 'This module is new.'`, 15000))) await fail('the wiped module did not show the welcome');
await shot('smoke-personalise-welcome.png');
await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent === 'Start').click(); true`);
if (!(await waitFor(`document.querySelector('h1')?.textContent === 'Make it yours.' && [...document.querySelectorAll('option')].some(o => o.value === 'dev')`))) await fail('the form did not open with the names from the broker');
// an empty form is refused before anything reaches the module
await evaluate(`document.querySelector('form.card').requestSubmit(); true`);
if (!(await waitFor(`document.body.textContent.includes('Say what the module should call you.')`))) await fail('an empty name was not refused');
await evaluate(`(() => {
  const form = document.querySelector('form.card');
  const set = (input, value) => { input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); };
  const inputs = [...form.querySelectorAll('input')];
  set(inputs.find(i => i.autocomplete === 'nickname'), 'Ann');
  set(inputs.find(i => i.type === 'email'), 'ann@example.com');
  const pws = inputs.filter(i => i.type === 'password');
  set(pws[0], 'first-light'); set(pws[1], 'first-light');
  return true;
})()`);
await shot('smoke-personalise-form.png');
await evaluate(`document.querySelector('form.card').requestSubmit(); true`);
if (!(await waitFor(`document.querySelector('h1')?.textContent === 'Working.'`))) await fail('the personalisation did not start');
if (!(await waitFor(`document.querySelector('h1')?.textContent === 'The module is yours.'`, 30000))) await fail('the personalisation did not finish');
if (!(await evaluate(`document.querySelector('.blob')?.textContent.trim().split(/\\s+/).length === 24`))) await fail('the 24 words are not shown');
if (!(await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.startsWith('Continue'))?.disabled`))) await fail('continuing is not gated on the proof');
await shot('smoke-personalise-done.png');
await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent === 'Download the PDF').click(); true`);
if (!(await waitFor(`![...document.querySelectorAll('button')].find(b => b.textContent.startsWith('Continue'))?.disabled`))) await fail('the download did not release the gate');
await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent === 'Continue to sign-in').click(); true`);
if (!(await waitFor(`!!document.querySelector('#password')`, 15000))) await fail('the sign-in did not come back after personalising');
await evaluate(`location.hash = '#/'; document.querySelector('#password').value = 'first-light'; document.querySelector('form').requestSubmit(); true`);
if (!(await waitFor(`document.querySelector('h1')?.textContent === 'The module is sealed and reachable.'`))) await fail('the new password does not open the module');
if (!(await evaluate(`document.body.textContent.includes('Ann')`))) await fail('the owner is not the one who personalised it');

// 12. software: what runs and what is newer, then the firmware installed — the
//     module reboots, the page waits for it and comes back on the new version
await evaluate(`location.hash = '#/software'; true`);
if (!(await waitFor(`document.querySelector('h1')?.textContent === 'Firmware 2.5.0+mock and Manager 2.1.0+mock are ready to install.'`))) await fail('the software page did not render');
if (!(await evaluate(`document.body.textContent.includes('Encedo nGINE FW v1.2.2') && document.body.textContent.includes('Bootloader')`))) await fail('the versions are not shown');
await shot('smoke-software.png');
await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent === 'Install Firmware 2.5.0+mock').click(); true`);
if (!(await waitFor(`[...document.querySelectorAll('.card-head .v')].some(v => /uploading|verifying|installing|rebooting/.test(v.textContent))`))) await fail('the update did not start');
if (!(await waitFor(`document.body.textContent.includes('Verify')`))) await fail('the steps are not listed');
await shot('smoke-software-update.png');
if (!(await waitFor(`!!document.querySelector('#password')`, 30000))) await fail('the module did not come back to the sign-in after the firmware install');
if (!(await waitFor(`document.body.textContent.includes('v2.5.0+mock')`))) await fail('the sign-in does not show the new firmware');
await evaluate(`location.hash = '#/'; document.querySelector('#password').value = 'first-light'; document.querySelector('form').requestSubmit(); true`);
if (!(await waitFor(`document.querySelector('h1')?.textContent === 'The module is sealed and reachable.'`))) await fail('could not sign in after the update');
if (await evaluate(`document.body.textContent.includes('v2.5.0+mock available')`)) await fail('the overview still offers the firmware that is installed');

const bad = logs.filter((l) => /EXCEPTION|error/i.test(l));
if (bad.length) { console.log('console:', bad.join('\n')); await fail('page logged errors'); }
console.log('OK: sign-in, overview, drive, keychain (paging/sorting/search/detail/share QR/import/create/edit/delete), operation log (index/verify/entries/check all), paired phones (list/pair via QR/unpair/do it anyway on a broker 4xx), hardware (health check/tokens/reboot guard/temperature), settings (owner/trust/master words/domain/wipe guard/password change), sign-out, phone sign-in with per-scope requests, wipe and personalise from the box, software (versions/firmware install/reboot)');
await cleanup();
