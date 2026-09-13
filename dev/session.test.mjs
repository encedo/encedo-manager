// The session logic against the mock module and broker. Run: node --test dev/
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, MASTER_WORDS, PHONE_PIDS, NEW_FIRMWARE, NEW_MANAGER } from './serve.mjs';
import {
  Session, parseStorage, formatBytes, describeError, describeScope, formatDate,
  isUnpersonalised, storageMode, parseStorageMode, gbToSectors, sectorsToGb, isPrefix, versionNumber, SIGNIN_SCOPE,
  describeKey, asciiText, parseKeyBytes, buildShareCode, shareCodeText, parseShareCode,
  toB64Text, asB64Field, asLabel, isAsciiLabel, bytesToB64, b64ByteLength, textByteLength,
  DESCR_BYTES, LABEL_CHARS,
} from '../app/session.js';
import { filterKeys, sortKeys } from '../app/pages/keychain.js';
import { pageOf } from '../app/table.js';
import { parseLogFile, parseLogLine, logFileHeader, describeVerification } from '../app/logfile.js';
import { resolveConfig, DEFAULT_HEM } from '../app/config.js';
import { proofOfPersonalisation, buildPdf } from '../app/pdf.js';

let server, base;
before(async () => {
  server = await createServer({ approveAfter: 2 });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const toBytes = (text) => new TextEncoder().encode(text);
const urls = () => ({ hem: `${base}/mock`, broker: `${base}/mockbroker` });

test('config: served from a dev host the module defaults to my.ence.do, ?hem= overrides and is remembered', () => {
  const mem = new Map();
  const storage = { get: (k) => mem.get(k) ?? null, set: (k, v) => mem.set(k, v), remove: (k) => mem.delete(k) };
  const loc = { protocol: 'http:', hostname: 'localhost', origin: 'http://localhost:8080', search: '' };
  assert.equal(resolveConfig(loc, storage).hem, DEFAULT_HEM);
  assert.equal(resolveConfig({ ...loc, search: '?hem=https://192.168.7.1/' }, storage).hem, 'https://192.168.7.1');
  assert.equal(resolveConfig(loc, storage).hem, 'https://192.168.7.1', 'remembered');
  assert.equal(resolveConfig({ ...loc, search: '?hem=' }, storage).hem, DEFAULT_HEM, 'empty forgets');
  const onDevice = { protocol: 'https:', hostname: 'my.ence.do', origin: 'https://my.ence.do', search: '' };
  assert.equal(resolveConfig(onDevice, storage).hem, 'https://my.ence.do');
  assert.equal(resolveConfig(onDevice, storage).servedFromDevice, true);
});

test('storage parsing follows the "<sectors>:<state>" format', () => {
  assert.deepEqual(parseStorage({ storage: ['125829120:-', '16777216:rw', '2048:ro', '1:r'] }), [
    { index: 0, bytes: 64424509440, state: 'locked' },
    { index: 1, bytes: 8589934592, state: 'rw' },
    { index: 2, bytes: 1048576, state: 'ro' },
    { index: 3, bytes: 512, state: 'ro' },
  ]);
  assert.equal(formatBytes(64424509440), '60 GB');
  assert.deepEqual(parseStorage({}), []);
});

test('probe counts attempts while the module is away, then reaches it', async () => {
  const away = new Session({ hem: 'http://127.0.0.1:9/mock', broker: `${base}/mockbroker` });
  assert.equal(await away.probe({ timeoutMs: 300 }), false);
  assert.equal(away.state.attempts, 1);
  assert.equal(away.state.phase, 'probing');

  const s = new Session(urls());
  const changes = [];
  s.addEventListener('change', () => changes.push(s.state.phase));
  await s.waitForDevice({ intervalMs: 10 });
  assert.equal(s.state.phase, 'reachable');
  assert.equal(s.state.version.fwv, 'Encedo nGINE FW v1.2.2');
  await s.prepare();
  assert.equal(s.state.online, true);
  assert.equal(s.state.paired, true);
  assert.equal(s.state.health.newfws, 'v2.5.0+mock');
  assert.deepEqual(s.disks().map((d) => d.state), ['locked', 'locked']);
  assert.ok(changes.includes('reachable'));
});

test('waitForDevice can be cancelled', async () => {
  const s = new Session({ hem: 'http://127.0.0.1:9/mock', broker: `${base}/mockbroker` });
  const ctl = new AbortController();
  setTimeout(() => ctl.abort(), 50);
  await assert.rejects(s.waitForDevice({ intervalMs: 10, timeoutMs: 200, signal: ctl.signal }), (e) => e.code === 'aborted');
});

test('a wrong password is refused, the right one signs in and lists the paired phone', async () => {
  const s = new Session(urls());
  await s.waitForDevice({ intervalMs: 10 });
  await s.prepare();
  await assert.rejects(s.signIn('wrong'), (e) => e.code === 'http_401');
  assert.equal(describeError(await s.signIn('wrong').catch((e) => e)), 'The password is not correct.');
  await s.signIn('demo');
  assert.equal(s.state.phase, 'signed-in');
  assert.equal(s.state.mode, 'password');
  assert.equal(s.state.config.user, 'Ann');
  assert.deepEqual(s.state.phones.map((p) => p.pid), [PHONE_PIDS.pixel]);
});

test('signing out asks the broker again whether a phone is paired', async () => {
  const s = new Session(urls());
  await s.waitForDevice({ intervalMs: 10 });
  await s.prepare();
  assert.equal(s.state.paired, true);
  await s.signIn('demo');
  s.state.paired = false;                    // as if the broker had changed its mind meanwhile
  s.signOut();
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(s.state.paired, true, 'checked again on the way to the sign-in form');

  const offline = new Session({ hem: `${base}/mock`, broker: 'http://127.0.0.1:9/nobroker' });
  await offline.waitForDevice({ intervalMs: 10 });
  await offline.prepare();
  assert.equal(offline.state.paired, null, 'not known without the broker');
});

test('unlock and lock a drive through scoped tokens', async () => {
  const s = new Session(urls());
  await s.waitForDevice({ intervalMs: 10 });
  await s.prepare();
  await s.signIn('demo');
  await s.unlockDisk(0, 'rw');
  assert.equal(s.disks()[0].state, 'rw');
  await s.unlockDisk(1, 'ro');
  assert.equal(s.disks()[1].state, 'ro');
  await s.lockDisk(0);
  await s.lockDisk(1);
  assert.deepEqual(s.disks().map((d) => d.state), ['locked', 'locked']);
  s.signOut();
  assert.equal(s.state.phase, 'reachable');
  await assert.rejects(s.unlockDisk(0), (e) => e.code === 'not_signed_in');
});

test('phone sign-in polls the broker and can be cancelled', async () => {
  const s = new Session(urls());
  await s.waitForDevice({ intervalMs: 10 });
  await s.prepare();
  let pending = 0;
  await s.signInWithPhone({ onPending: () => pending++ });
  assert.equal(s.state.mode, 'phone');
  assert.ok(pending >= 1);

  const s2 = new Session(urls());
  await s2.waitForDevice({ intervalMs: 10 });
  await s2.prepare();
  const ctl = new AbortController();
  setTimeout(() => ctl.abort(), 20);
  await assert.rejects(s2.signInWithPhone({ signal: ctl.signal }), (e) => e.code === 'aborted');
  assert.equal(s2.state.phase, 'reachable');
});

test('signed in with the phone, an operation without a token asks the phone and says so', async () => {
  const s = new Session(urls());
  await s.waitForDevice({ intervalMs: 10 });
  await s.prepare();
  await s.signInWithPhone();
  const seen = [];
  s.addEventListener('change', () => { if (s.state.asking) seen.push(s.state.asking.scope); });
  const logs = await s.loadLogs();                    // logger:get — the phone is asked once, then cached
  assert.ok(logs.ids.length > 0);
  assert.deepEqual(seen, ['logger:get']);
  assert.equal(s.state.asking, null, 'nothing pending once it answered');
  assert.deepEqual(s.tokens().map((t) => t.scope).sort(), ['logger:get', 'system:config']);
  await s.readLog(logs.ids[0]).catch((e) => { if (e.code !== 'log_in_progress') throw e; });
  assert.deepEqual(seen, ['logger:get'], 'the second read used the cached token');

  // the unlock is a different scope: the phone is asked again, and the request can be given up
  const ctl = new AbortController();
  const unlock = s.unlockDisk(0, 'rw');
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(s.state.asking?.scope, 'storage:disk0:rw');
  assert.ok(s.state.asking.until > Date.now());
  s.state.asking.cancel();
  await assert.rejects(unlock, (e) => e.code === 'aborted');
  assert.equal(s.state.asking, null);
  assert.equal(describeError(await unlock.catch((e) => e)), 'Cancelled.');
  void ctl;

  assert.equal(describeScope('logger:get'), 'read the operation log');
  assert.equal(describeScope('storage:disk1:rw'), 'unlock disk1 read-write');
  assert.equal(describeScope('keymgmt:use:abc'), 'use a key');
  assert.equal(describeScope('something:new'), 'something:new');
});

test('a phone request carries the lifetime the device asks for, and only a real request covers the page', async () => {
  const s = new Session(urls());
  await s.waitForDevice({ intervalMs: 10 });
  await s.prepare();
  await s.signInWithPhone();
  // Signing in already put a token in the cache; asking for that same scope
  // again must not reach the phone, and must not cover the page either.
  let covered = 0;
  s.addEventListener('change', () => { if (s.state.asking) covered++; });
  await s.token(SIGNIN_SCOPE);
  assert.equal(covered, 0, 'a token the SDK still holds never rang the phone');
  assert.equal(s.state.asking, null);

  await s.token('keymgmt:list');
  assert.ok(covered > 0, 'a scope it does not hold does');
  assert.equal(s.state.asking, null, 'and the page is uncovered once the phone answers');
});

test('two operations that need different scopes ask the phone one after the other', async () => {
  const s = new Session(urls());
  await s.waitForDevice({ intervalMs: 10 });
  await s.prepare();
  await s.signInWithPhone();
  const order = [];
  s.addEventListener('change', () => { if (s.state.asking && order.at(-1) !== s.state.asking.scope) order.push(s.state.asking.scope); });
  await Promise.all([s.loadKeys(), s.loadLogs()]);
  assert.deepEqual(order, ['keymgmt:list', 'logger:get']);
  assert.ok(s.state.keys.length > 0);
  assert.ok(s.state.logs.ids.length > 0);
});

test('air-gapped: no broker, still signs in with the password', async () => {
  const s = new Session({ hem: `${base}/mock`, broker: 'http://127.0.0.1:9' });
  await s.waitForDevice({ intervalMs: 10 });
  await s.prepare();
  assert.equal(s.state.online, false);
  assert.equal(s.state.paired, null);
  await s.signIn('demo');
  assert.equal(s.state.phase, 'signed-in');
  assert.equal(s.state.phones, null);
});

// ---- the keychain ---------------------------------------------------------------------

const signedIn = async () => {
  const s = new Session(urls());
  await s.waitForDevice({ intervalMs: 10 });
  await s.prepare();
  await s.signIn('demo');
  return s;
};

test('a key is read out of its type string and its description', () => {
  const phone = describeKey({ kid: 'K1', label: "Ann's Pixel", type: 'PKEY,ECDH,CURVE25519', description: Uint8Array.from(atob('RVhUQUlE' + PHONE_PIDS.pixel), (c) => c.charCodeAt(0)) });
  assert.equal(phone.algorithm, 'CURVE25519');
  assert.deepEqual(phone.uses, ['ECDH']);
  assert.equal(phone.sealed, true);
  assert.equal(phone.phone, PHONE_PIDS.pixel);

  const imported = describeKey({ kid: 'K2', label: 'bob', type: 'ED25519', description: null });
  assert.equal(imported.sealed, false, 'no PKEY flag means the module holds only the public half');
  assert.equal(imported.descrB64, '');

  const secret = describeKey({ kid: 'K3', label: 'wrap', type: 'AES256', description: null });
  assert.equal(secret.symmetric, true);
  assert.equal(secret.sealed, true, 'a secret key is inside even without a PKEY flag');

  const attested = describeKey({ kid: 'K4', label: 'git', type: 'ATT,PKEY,ExDSA,ED25519', description: null });
  assert.equal(attested.attested, true);
  assert.deepEqual(attested.uses, ['ExDSA']);

  const binary = describeKey({ kid: 'K5', label: 'raw', type: 'AES256', description: new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0, 0]) });
  assert.equal(binary.descrB64, '3q2+7w==', 'the field is bytes, so base64 is what it really is');
  assert.equal(binary.descrHex, 'deadbeef', 'and hex for reading it byte by byte');
  assert.equal('descr' in binary, false, 'there is no decoded reading of it to render by mistake');
  assert.equal(describeKey({ kid: 'K6', label: '-', type: 'AES256', description: null }).descrB64, '');

  // A field that is part text and part bytes must not come back as text at all.
  const mixed = describeKey({ kid: 'K7', label: 'wg', type: 'PKEY,ECDH,CURVE25519', description: new Uint8Array([0x57, 0x47, 0x3a, 0xc3, 0x28, 0xff]) });
  assert.equal(asciiText(mixed.description), null, 'not every byte is printable, so there is no text reading');
  assert.equal(asciiText(new Uint8Array([104, 105, 0, 0])), 'hi', 'when every byte is, there is');
  assert.equal(mixed.phone, null);
  assert.equal(formatDate(Math.floor(Date.UTC(2026, 1, 2, 12) / 1000)), '2 Feb 2026');   // midday, so the date holds in any timezone
  assert.equal(formatDate(null), '—');
});

test('a phone key is told by its description reading RVhUQUlE + pid in base64, as v1 matched it', () => {
  const pid = 'UElELW1vY2stMQ==';
  const description = Uint8Array.from(atob('RVhUQUlE' + pid), (c) => c.charCodeAt(0));
  const phone = describeKey({ kid: 'k', label: 'Pixel', type: 'PKEY,ECDH,CURVE25519', description });
  assert.equal(phone.phone, pid, 'the pid is the tail of the base64, not of the bytes');
  assert.equal(phone.descrB64, 'RVhUQUlE' + pid);
  assert.equal(describeKey({ kid: 'k', type: 'ED25519', description: toBytes('EXTAID') }).phone, null, 'the prefix alone is not a phone');
  assert.equal(describeKey({ kid: 'k', type: 'ED25519', description: toBytes('EXTAIDS something') }).phone, 'UyBzb21ldGhpbmc=', 'read as base64 whatever the bytes are');
  assert.equal(describeKey({ kid: 'k', type: 'ED25519', description: toBytes('WireGuard') }).phone, null);
});

test('a pasted public key is read as hex or as base64', () => {
  const hex = '00'.repeat(32);
  assert.equal(parseKeyBytes(hex).length, 32);
  assert.equal(parseKeyBytes(' AAAA\nAAAA ').length, 6, 'whitespace is ignored');
  assert.deepEqual([...parseKeyBytes('0a0b0c0d0e0f10111213141516171819202122232425262728293031323334353637383940')].slice(0, 3), [10, 11, 12]);
  assert.throws(() => parseKeyBytes(''), (e) => e.code === 'bad_key');
});

test('the whole keychain is read a page at a time', async () => {
  const s = await signedIn();
  const keys = await s.loadKeys({ pageSize: 4 });
  assert.equal(keys.length, 14, 'four pages, the last one short');
  assert.equal(s.state.keys.length, 14);
  assert.deepEqual(keys.map((k) => k.label).slice(0, 2), ['wg-peer-03', 'git-signing']);
  assert.equal(keys[0].descrB64, Buffer.from('WireGuard identity, laptop').toString('base64'));
  assert.equal(keys[0].sealed, true);
  assert.deepEqual(keys.filter((k) => !k.sealed).map((k) => k.label), ['bob (imported)', 'carol (imported)']);
  assert.deepEqual(keys.filter((k) => k.phone).map((k) => k.phone), [PHONE_PIDS.pixel, PHONE_PIDS.iphone]);
});

test('the table sorts by one column at a time and pages through the rest', async () => {
  const s = await signedIn();
  const keys = await s.loadKeys();

  const byLabel = sortKeys(keys, 'label', 'asc').map((k) => k.label);
  assert.deepEqual(byLabel, [...byLabel].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())));
  assert.deepEqual(sortKeys(keys, 'label', 'desc').map((k) => k.label), [...byLabel].reverse());

  const dates = sortKeys(keys, 'created', 'desc').map((k) => k.created);
  assert.deepEqual(dates, [...dates].sort((a, b) => b - a), 'newest first');
  assert.equal(sortKeys(keys, 'where', 'asc')[0].sealed, false, 'public before sealed, so the exceptions are on top');
  assert.equal(sortKeys(keys, 'where', 'desc')[0].sealed, true);

  const first = pageOf(keys, 1, 10);
  assert.equal(first.rows.length, 10);
  assert.deepEqual([first.page, first.pages, first.from, first.to, first.total], [1, 2, 1, 10, 14]);
  const second = pageOf(keys, 2, 10);
  assert.deepEqual([second.rows.length, second.from, second.to], [4, 11, 14]);
  assert.equal(pageOf(keys, 9, 10).page, 2, 'a page past the end lands on the last one');
  assert.equal(pageOf(keys, 1, 0).rows.length, 14, 'nought means all of them');
  assert.deepEqual(pageOf([], 1, 10), { rows: [], page: 1, pages: 1, total: 0, from: 0, to: 0 });
});

test('the search box matches label, description, type or key id', async () => {
  const s = await signedIn();
  const keys = await s.loadKeys();
  assert.deepEqual(filterKeys(keys, 'wg-peer').map((k) => k.label), ['wg-peer-03']);
  assert.deepEqual(filterKeys(keys, 'COMMITS').map((k) => k.label), ['git-signing'], 'case does not matter');
  assert.equal(filterKeys(keys, 'MLKEM768').length, 1);
  assert.equal(filterKeys(keys, '').length, 14);
  assert.equal(filterKeys(keys, 'nothing here').length, 0);
});

test('the device searches descriptions by prefix, and answers nothing without failing', async () => {
  const s = await signedIn();
  const phones = await s.findKeys('EXTAID');
  assert.deepEqual(phones.map((k) => k.phone), [PHONE_PIDS.pixel, PHONE_PIDS.iphone]);
  assert.deepEqual(await s.findKeys('no such description'), []);
});

test('a key pair is created inside the module, renamed and deleted', async () => {
  const s = await signedIn();
  await s.loadKeys();
  const kid = await s.createKey({ label: 'test-key', type: 'CURVE25519', descr: toB64Text('made by a test') });
  assert.equal(s.state.keys.length, 15);
  const made = s.state.keys.find((k) => k.kid === kid);
  assert.equal(made.algorithm, 'CURVE25519');
  assert.deepEqual(made.uses, ['ECDH']);
  assert.equal(made.sealed, true);
  assert.equal(made.descrB64, toB64Text('made by a test'));

  await s.renameKey(kid, 'renamed', toB64Text('and described'));
  const after = s.state.keys.find((k) => k.kid === kid);
  assert.equal(after.label, 'renamed');
  assert.equal(after.descrB64, toB64Text('and described'));

  const pub = await s.keyPublic(kid);
  assert.ok(pub.pubkey.length > 0);

  await s.removeKey(kid);
  assert.equal(s.state.keys.length, 14);
  assert.equal(s.state.keys.some((k) => k.kid === kid), false);
});

test('a NIST key is created with the use it was given, an imported key is public only', async () => {
  const s = await signedIn();
  await s.loadKeys();
  const nist = await s.createKey({ label: 'both jobs', type: 'SECP384R1', mode: 'ECDH,ExDSA', descr: '' });
  assert.deepEqual(s.state.keys.find((k) => k.kid === nist).uses, ['ECDH', 'ExDSA']);

  // A NIST curve is the only kind told what it may do; everything else the
  // module works out from the type, and the request carries no mode at all.
  const plain = await s.createKey({ label: 'one job', type: 'CURVE25519', descr: '' });
  assert.deepEqual(s.state.keys.find((k) => k.kid === plain).uses, ['ECDH'], 'the module knows what a 25519 key is for');
  await s.removeKey(plain);

  const kid = await s.importKey({ label: 'bob', type: 'ED25519', pubkey: 'AA'.repeat(32), descr: toB64Text('from bob') });
  const imported = s.state.keys.find((k) => k.kid === kid);
  assert.equal(imported.sealed, false);
  assert.equal(imported.descrB64, toB64Text('from bob'));

  await s.removeKey(nist);      // the mock keychain is shared by every test in this file
  await s.removeKey(kid);
  assert.equal(s.state.keys.length, 14);
});

test('the description is bytes: it goes and comes back as base64, binary and all', async () => {
  const s = await signedIn();
  await s.loadKeys();
  const binary = bytesToB64(new Uint8Array([0x00, 0xff, 0x10, 0x80, 0x41, 0x00, 0x42]));
  const kid = await s.createKey({ label: 'binary-descr', type: 'ED25519', descr: binary });
  const made = s.state.keys.find((k) => k.kid === kid);
  assert.equal(made.descrB64, binary, 'what went in is what comes back');
  assert.equal(asciiText(made.description), null, 'and it is not text, so nothing offers to read it as text');

  const changed = bytesToB64(new Uint8Array([0xde, 0xad, 0x00, 0xbe, 0xef]));
  await s.renameKey(kid, 'binary-descr', changed);
  assert.equal(s.state.keys.find((k) => k.kid === kid).descrHex, 'dead00beef');

  await assert.rejects(s.renameKey(kid, 'binary-descr', 'not base64!'), (e) => e.code === 'bad_description');
  assert.equal(asB64Field('  '), '', 'nothing is a fine description');
  assert.equal(asB64Field(toB64Text('hello')), 'aGVsbG8=');
  await s.removeKey(kid);
});

test('a label is ASCII, 0x20 to 0x7F, and no longer than the field', async () => {
  assert.equal(asLabel('wg-peer-03'), 'wg-peer-03');
  assert.equal(asLabel(' spaces and ~tildes~ '), ' spaces and ~tildes~ ', '0x20 and 0x7E are both inside');
  assert.equal(asLabel(String.fromCharCode(0x7f)), String.fromCharCode(0x7f), 'and 0x7F is the top of the range');
  assert.equal(isAsciiLabel('Ann\'s Pixel'), true);
  assert.equal(isAsciiLabel('zażółć'), false);
  assert.throws(() => asLabel('zażółć'), (e) => e.code === 'bad_label' && /“ż”/.test(e.message));
  assert.throws(() => asLabel('tab\there'), (e) => e.code === 'bad_label', 'a control character is not text a module keeps');
  assert.throws(() => asLabel('x'.repeat(LABEL_CHARS + 1)), (e) => e.code === 'label_too_long');
  assert.equal(asLabel('x'.repeat(LABEL_CHARS)).length, LABEL_CHARS);

  const s = await signedIn();
  await s.loadKeys();
  const before = s.state.keys.length;
  await assert.rejects(s.createKey({ label: 'ćwierć', type: 'ED25519', descr: '' }), (e) => e.code === 'bad_label');
  assert.equal(s.state.keys.length, before, 'and nothing reached the module');
});

test('the field sizes are counted in what the module counts in', async () => {
  assert.equal(b64ByteLength(''), 0);
  assert.equal(b64ByteLength('aGVsbG8='), 5, 'base64 characters are not the measure; the bytes are');
  assert.equal(b64ByteLength(bytesToB64(new Uint8Array(DESCR_BYTES))), DESCR_BYTES);
  assert.equal(b64ByteLength('not base64!'), null);
  assert.equal(textByteLength('zażółć'), 10, 'nor are characters, once they are not ASCII: four of these take two bytes');

  const s = await signedIn();
  await s.loadKeys();
  const kid = await s.createKey({ label: 'sized', type: 'ED25519', descr: '' });
  const full = bytesToB64(Uint8Array.from({ length: DESCR_BYTES }, (_, i) => (i % 254) + 1));
  await s.renameKey(kid, 'sized', full);
  assert.equal(s.state.keys.find((k) => k.kid === kid).descrB64, full, 'a full field is fine');

  const overflowing = bytesToB64(Uint8Array.from({ length: DESCR_BYTES + 1 }, (_, i) => (i % 254) + 1));
  await assert.rejects(s.renameKey(kid, 'sized', overflowing), (e) => e.code === 'descr_too_long');
  assert.equal(s.state.keys.find((k) => k.kid === kid).descrB64, full, 'and the one that did not fit changed nothing');
  await s.removeKey(kid);
});

test('a share code carries the public half and reads back into an import', async () => {
  const s = await signedIn();
  const keys = await s.loadKeys();
  const key = keys.find((k) => k.label === 'wg-peer-03');
  const { pubkey } = await s.keyPublic(key.kid);
  const code = buildShareCode(key, pubkey, 'for the laptop');
  const read = parseShareCode(shareCodeText(code));
  assert.equal(read.label, key.label);
  assert.equal(read.type, 'CURVE25519');
  assert.equal(read.pubkey, pubkey);
  assert.equal(read.descrB64, key.descrB64, 'the description crosses as bytes, both ways');
  assert.equal(read.note, 'for the laptop');

  const v1Style = { key: { pubkey: 'UFVC', type: 'ECDH,CURVE25519', descr: '', label: '' }, note: '' };
  const fromV1 = parseShareCode(shareCodeText(v1Style));
  assert.equal(fromV1.type, 'CURVE25519', "v1 wrote the uses into the type");
  assert.equal(fromV1.mode, 'ECDH');
  assert.throws(() => parseShareCode('not a code'), (e) => e.code === 'bad_share_code');

  assert.deepEqual(await s.shareKeyByEmail('bob@example.com', code), { sent: true, to: 'bob@example.com' });
});

test('air-gapped: the keychain works, sharing by e-mail does not', async () => {
  const s = new Session({ hem: `${base}/mock`, broker: 'http://127.0.0.1:9' });
  await s.waitForDevice({ intervalMs: 10 });
  await s.prepare();
  await s.signIn('demo');
  const keys = await s.loadKeys();
  assert.ok(keys.some((k) => k.label === 'wg-peer-03'), 'the module answers on its own');
  await assert.rejects(s.shareKeyByEmail('bob@example.com', {}), (e) => e.code === 'broker_error');
  assert.equal(describeError(await s.shareKeyByEmail('b@e.com', {}).catch((e) => e)), 'The Encedo backend did not answer.');
});

// ---- the operation log ----------------------------------------------------------------

test('the phones are read out of the keychain and checked against the broker', async () => {
  const s = new Session(urls());
  await s.waitForDevice({ intervalMs: 10 });
  await s.prepare();
  await s.signIn('demo');
  assert.deepEqual(s.pairedPhones(), [], 'nothing before the keychain is read');
  await s.loadKeys();
  const phones = s.pairedPhones();
  assert.deepEqual(phones.map((p) => [p.label, p.pid, p.inKeychain, p.atBroker]), [
    ["Ann's Pixel", PHONE_PIDS.pixel, true, true],
    ['Work iPhone', PHONE_PIDS.iphone, true, false],      // a key the broker no longer knows
  ]);
  assert.ok(phones.every((p) => p.kid && p.created));
});

test('a phone is paired through a QR code that carries the link and a hash of the challenge', async () => {
  const s = new Session(urls());
  await s.waitForDevice({ intervalMs: 10 });
  await s.prepare();
  await s.signIn('demo');
  await s.loadKeys();
  const before = s.pairedPhones().length;
  let qr = null;
  let pending = 0;
  await s.pairPhone({ pollInterval: 5, onPending: () => pending++, onQrCode: (text, payload) => { qr = { text, payload }; } });
  assert.ok(qr, 'the QR was handed over');
  assert.deepEqual(JSON.parse(qr.text), qr.payload, 'the text is the payload, byte for byte');
  assert.deepEqual(Object.keys(qr.payload), ['link', 'hash', 'user', 'email', 'hostname'], 'in the order the app expects');
  assert.match(qr.payload.link, /^https:\/\/api\.encedo\.com\/notify\/register\//);
  assert.equal(qr.payload.hash.length, 44, 'base64 of a SHA-256');
  assert.equal(qr.payload.user, 'Ann');
  assert.ok(pending >= 1, 'the broker was polled');
  const phones = s.pairedPhones();
  assert.equal(phones.length, before + 1);
  const added = phones.at(-1);
  assert.equal(added.inKeychain, true);
  assert.equal(added.atBroker, true, 'the broker lists it too');
  assert.equal(s.state.paired, true);

  // cancelling withdraws the request and leaves nothing behind
  const ctl = new AbortController();
  setTimeout(() => ctl.abort(), 10);
  await assert.rejects(s.pairPhone({ pollInterval: 1000, signal: ctl.signal }), (e) => e.code === 'aborted');
  await s.loadKeys();
  assert.equal(s.pairedPhones().length, before + 1);
});

test('air-gapped: unpairing takes the key, pairing does not start', async () => {
  const s = new Session({ hem: `${base}/mock`, broker: 'http://127.0.0.1:9/nobroker' });
  await s.waitForDevice({ intervalMs: 10 });
  await s.prepare();
  await s.signIn('demo');
  await s.loadKeys();
  const phone = s.pairedPhones().at(-1);              // the one the test above paired
  assert.equal(phone.atBroker, null, 'the broker was not asked');
  await assert.rejects(s.pairPhone(), (e) => e.code === 'broker_error');
  assert.deepEqual(await s.unpairPhone(phone), { broker: false, key: true });
  assert.ok(!s.state.keys.some((k) => k.kid === phone.kid));
});

test('unpairing removes the key and the subscription, or whichever half exists', async () => {
  const s = new Session(urls());
  await s.waitForDevice({ intervalMs: 10 });
  await s.prepare();
  await s.signIn('demo');
  await s.loadKeys();
  const both = s.pairedPhones().find((p) => p.pid === PHONE_PIDS.pixel);
  assert.deepEqual(await s.unpairPhone(both), { broker: true, key: true });
  assert.ok(!s.pairedPhones().some((p) => p.pid === PHONE_PIDS.pixel));
  assert.ok(!s.state.keys.some((k) => k.kid === both.kid), 'the key is gone from the keychain');

  const keyOnly = s.pairedPhones().find((p) => p.pid === PHONE_PIDS.iphone);
  assert.equal(keyOnly.atBroker, false);
  // The broker has nothing to delete and says so with a 404: that is a question
  // for the person, not the end — and on "do it anyway" the key goes regardless.
  const refusal = await s.unpairPhone(keyOnly).catch((e) => e);
  assert.equal(refusal.code, 'broker_refused');
  assert.equal(refusal.status, 404);
  assert.equal(describeError(refusal), 'The Encedo backend refused to unpair it (HTTP 404)');
  assert.ok(s.state.keys.some((k) => k.kid === keyOnly.kid), 'and the key stays until that is answered');
  assert.deepEqual(await s.unpairPhone(keyOnly, { skipBroker: true }), { broker: false, key: true });
  assert.ok(!s.state.keys.some((k) => k.kid === keyOnly.kid), 'anyway: the key is gone');

  // What the air-gapped test left behind: a subscription with no key under it.
  const brokerOnly = s.pairedPhones();
  assert.deepEqual(brokerOnly.map((p) => [p.inKeychain, p.atBroker]), [[false, true]]);
  assert.deepEqual(await s.unpairPhone(brokerOnly[0]), { broker: true, key: false });
  assert.equal(s.pairedPhones().length, 0);
  assert.equal(s.state.paired, false, 'no phone left, so sign-in stops offering one');
});

test('a log line is read the way the module wrote it', () => {
  // Every line below is a real one, off a PPA running Encedo nGINE FW v1.2.2.
  const token = parseLogLine('5|69d7d400|d|0|U|a2V5bWdtdDpzZWFyY2g|9CVg-ThsWsplIvD1NNwNIQ');
  assert.equal(token.no, 5);
  assert.equal(token.at.toISOString().slice(0, 10), '2026-04-09');
  assert.equal(token.event, 'Token issued, password auth, for keymgmt:search');
  assert.equal(token.result, 'ok');
  assert.deepEqual(token.subject, { kind: 'user', text: 'User' });

  const clock = parseLogLine('3|69d7d1b4|13|0||T9HXaQ|j9TdNzeSJD-K7gPhufQqdw');
  assert.equal(clock.event, 'Clock set to 2026-04-09 16:18:23', 'four bytes, least significant first');

  const tls = parseLogLine('19|6a568311|6|2||W_7__w|aGKO7rlO0uQz1XrhzKZQNg');
  assert.equal(tls.event, 'TLS connection error (-421)', 'an error code is a number, not a string');
  assert.equal(tls.result, 'failed');
  assert.equal(tls.ok, false);

  const boot = parseLogLine('2|7|18|0|||cz-j4dzOx3o2o3bkzEHlpA');
  assert.equal(boot.event, 'Key integrity check', 'the check is the event; the result column says how it went');
  assert.equal(boot.at, null, 'on its own, seconds since boot is not a date');
  assert.equal(boot.uptime, 7);

  const refused = parseLogLine('d|69d8b244|20|1|U||BhX9cKoLHncXp3_jyO38zg');
  assert.equal(refused.event, 'Signature created', 'a refused operation names no key, so the name carries no parenthetical');
  assert.equal(refused.result, 'refused');

  // The module puts a slice of an HTTP header in this one. It is not text.
  const opaque = parseLogLine('a|6a6352af|b|0|U|CkNvbnRlbnQtTGVuZ3RoOiA2NzINCkNvbnRlbnQtVHlwZTogdGV4dC9wbGFpbg|HGeb8NtN6JXtKbHoDtHFOg');
  assert.equal(opaque.event, 'Log file read');
  assert.equal(opaque.extra.kind, 'bytes', 'bytes that are not text stay bytes');
  assert.equal(opaque.extra.text, undefined);
  assert.match(opaque.extra.hex, /^0a436f6e74656e742d/);

  const keyLine = parseLogLine('0|69d7d1b4|0|0|42PxAFOtW_G7WLOu-OrfVmZwo6z4GpiCUAWaO1JqpL8|YqJu0R6aeg2YBYuU_GftTXvzoPz8GN5JH7CfUZGg6EEQOCphJTu_7ko5ZKJcQ5SY_-yb7HXKhWhOfXNbE3FTBA|1M4_m-_7oyieCAHqPIUqKA');
  assert.equal(keyLine.keyLine, true);
  assert.equal(keyLine.event, 'Log integrity key created');
  assert.equal(keyLine.subject, null, 'the nonce is not a subject');

  assert.equal(parseLogLine('# Encedo nGINE FW v1.2.2'), null);
  assert.equal(parseLogLine(''), null);
  assert.equal(logFileHeader('# Encedo nGINE FW v1.2.2\n0|1|0|0|a|b|c\n'), 'Encedo nGINE FW v1.2.2');
});

test('an entry from before the clock was set is dated from the file it is in', () => {
  // 69f4d8a6.log off a real PPA: the file is named after the epoch it was made,
  // which the module worked out by taking its uptime off the time it finally got.
  const id = '69f4d8a6';
  const boot = parseInt(id, 16);

  const early = parseLogLine('1|6|1|0|||s2WRIDpkSGrODI93PPV6mQ', boot);
  assert.equal(early.derived, true, 'computed, not recorded');
  assert.equal(early.uptime, 6);
  assert.equal(early.at.toISOString(), new Date((boot + 6) * 1000).toISOString());
  assert.equal(early.at.toISOString(), '2026-05-01T16:45:32.000Z');

  const synced = parseLogLine('4|69f4d8b5|13|0||tdj0aQ|vQ_iDByFltFfi-5gyqankg', boot);
  assert.equal(synced.derived, false, 'this one carries a real time of its own');
  assert.equal(synced.at.toISOString(), '2026-05-01T16:45:41.000Z');
  assert.equal(synced.at.getTime() / 1000 - boot, 15, 'and it lands 15 s after the file started, which is the uptime');

  const file = parseLogFile('# Encedo nGINE FW v1.2.2\n0|6|0|0|a|b|c\n1|6|1|0|||d\n', id);
  assert.deepEqual(file.map((e) => e.derived), [true, true]);
  assert.deepEqual(parseLogFile('0|6|0|0|a|b|c\n').map((e) => e.at), [null], 'without the file id there is nothing to count from');
});

test('the file the module is still writing is a state, not a failure', async () => {
  const s = await signedIn();
  const logs = await s.loadLogs();
  const newest = [...logs.ids].sort((a, b) => parseInt(b, 16) - parseInt(a, 16))[0];
  await assert.rejects(s.readLog(newest), (e) => e.code === 'log_in_progress');
  assert.equal(describeError(await s.readLog(newest).catch((e) => e)),
    'The module is still writing this file. It can be read once that session ends.');
  const older = [...logs.ids].sort((a, b) => parseInt(b, 16) - parseInt(a, 16))[1];
  assert.equal((await s.readLog(older)).ok, true, 'the one before it reads fine');
});

test('the log index comes with a key the module proves it holds', async () => {
  const s = await signedIn();
  const logs = await s.loadLogs();
  assert.equal(logs.ids.length, 7);
  assert.equal(logs.signed, true, 'the module signed the nonce it sent with the key');
  assert.ok(logs.key.length > 20);
  assert.equal(s.state.logs.ids[0], logs.ids[0]);
});

test('a file is verified here, entry by entry, before it is read', async () => {
  const s = await signedIn();
  const logs = await s.loadLogs();
  const read = await s.readLog(logs.ids[0]);
  assert.equal(read.ok, true);
  assert.equal(describeVerification(read), `${read.lines} entries verified.`);

  const entries = parseLogFile(read.text, read.id);
  assert.equal(entries.length, read.lines, 'every line the check counted is an entry the page shows');
  assert.ok(entries.filter((e) => e.derived).length >= 3, 'the entries from before the clock was set are dated too');
  assert.ok(entries.every((e) => e.at instanceof Date), 'so every entry has a time');
  assert.equal(entries[0].keyLine, true);
  assert.deepEqual(entries.slice(1, 4).map((e) => e.event), ['System powered up', 'Key integrity check', 'Self-test passed']);
  assert.ok(entries.some((e) => e.event.startsWith('Key generated (')));
  assert.equal(logFileHeader(read.text), 'Encedo nGINE FW v1.2.2');
});

test('a file that was changed after the module wrote it says which entry', async () => {
  const s = await signedIn();
  const logs = await s.loadLogs();
  const results = [];
  for (const id of logs.ids) {
    try {
      results.push(await s.readLog(id));
    } catch (e) {
      assert.equal(e.code, 'log_in_progress', 'the only file that cannot be read is the open one');
    }
  }
  assert.equal(results.length, 6, 'six finished files, one still being written');
  const failed = results.filter((r) => !r.ok);
  assert.equal(failed.length, 1, 'one file in the mock was edited after sealing');
  assert.equal(failed[0].reason, 'hmac');
  assert.equal(typeof failed[0].line, 'number');
  assert.match(describeVerification(failed[0]), /does not match its seal/);

  // The entries are still readable; nothing is hidden because one line failed.
  assert.ok(parseLogFile(failed[0].text).length > 5);
});

// ---- the hardware ---------------------------------------------------------------------

test('the module tests itself and answers in counters', async () => {
  const s = await signedIn();
  assert.equal(s.state.selftest, null);
  const result = await s.selftest();
  assert.equal(result.fls_state, 0, 'nothing wrong');
  assert.equal(result.se_state, 0);
  assert.ok(result.selftest_ts > 0);
  assert.deepEqual(s.state.selftest, result, 'the page reads it off the session');
});

test('the session can say what this browser still holds, and forget it', async () => {
  const s = await signedIn();
  await s.loadKeys();                       // takes a keymgmt:list token
  await s.selftest();                       // and a system:config one
  const scopes = s.tokens().map((t) => t.scope).sort();
  assert.deepEqual(scopes, ['keymgmt:list', 'system:config']);
  assert.ok(s.tokens().every((t) => t.exp > Math.floor(Date.now() / 1000)));
  assert.equal(s.tokens().some((t) => 'token' in t), false, 'the tokens themselves stay in the SDK');

  s.forgetTokens();
  assert.deepEqual(s.tokens(), []);
  await s.loadKeys();                       // and the next call quietly takes a new one
  assert.deepEqual(s.tokens().map((t) => t.scope), ['keymgmt:list']);
});

test('a reboot locks the drives and leaves the browser signed out', async () => {
  const s = await signedIn();
  await s.unlockDisk(0, 'rw');
  assert.equal(s.disks()[0].state, 'rw');

  await s.reboot();
  assert.equal(s.state.phase, 'probing', 'the session is not signed in to anything any more');
  assert.equal(s.state.status, null);
  await assert.rejects(s.loadKeys(), (e) => e.code === 'not_signed_in');

  await s.waitForDevice({ intervalMs: 10 });
  await s.prepare();
  assert.deepEqual(s.disks().map((d) => d.state), ['locked', 'locked'], 'both drives went back inside');
  assert.equal(s.state.status.uptime < 60, true, 'and it is freshly up');
});

// ---- the settings ---------------------------------------------------------------------

test('the settings the module keeps are read, changed and read back', async () => {
  const s = await signedIn();
  assert.equal(s.state.config.user, 'Ann');
  assert.equal(s.state.config.origin, '*');
  assert.equal(s.state.config.trusted_backend, true);

  const after = await s.saveConfig({ user: 'Ann R', email: 'ann@encedo.com', origin: 'https://my.ence.do' });
  assert.equal(after.user, 'Ann R', 'what comes back is what the module made of it, not what was typed');
  assert.equal(after.origin, 'https://my.ence.do');
  assert.equal(s.state.config.email, 'ann@encedo.com');

  await s.saveConfig({ trusted_ts: false, trusted_backend: false, allow_keysearch: true });
  assert.deepEqual(
    [s.state.config.trusted_ts, s.state.config.trusted_backend, s.state.config.allow_keysearch],
    [false, false, true],
  );
  await s.saveConfig({ user: 'Ann', email: 'ann@example.com', origin: '*', trusted_ts: true, trusted_backend: true, allow_keysearch: false });
});

test('changing the password ends the session, and the new one opens the module', async () => {
  const s = await signedIn();
  await s.changePassword('a new password');
  assert.equal(s.state.phase, 'reachable', 'this browser holds a key the module no longer answers to');
  assert.equal(s.state.config, null);

  await assert.rejects(s.signIn('demo'), (e) => e.code === 'http_401', 'the old password is done');
  await s.signIn('a new password');
  assert.equal(s.state.phase, 'signed-in');

  await s.changePassword('demo');           // the mock keychain is shared; put it back
  await s.signIn('demo');
  assert.equal(s.state.phase, 'signed-in');
});

test('a name under ence.do is checked before it is taken', async () => {
  const s = await signedIn();
  assert.equal(await s.domainTaken('my'), true);
  assert.equal(await s.domainTaken('something-nobody-has'), false);

  const tls = await s.registerDomain('ann-ppa');
  assert.equal(tls.crt, 'CRT', 'the certificate the broker signed');
  assert.equal(s.state.config.hostname, 'ann-ppa.ence.do', 'and the module installed it');
  await s.saveConfig({ hostname: 'my.ence.do' });
});

test('air-gapped, a domain cannot be registered and says so', async () => {
  const s = new Session({ hem: `${base}/mock`, broker: 'http://127.0.0.1:9' });
  await s.waitForDevice({ intervalMs: 10 });
  await s.prepare();
  await s.signIn('demo');
  await assert.rejects(s.registerDomain('anything'), (e) => e.code === 'broker_error');
});

test('the master passphrase authorises the settings, a wrong word does not', async () => {
  const s = await signedIn();
  assert.equal(s.state.master, false);
  await assert.rejects(s.authorizeMaster('zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo'),
    (e) => e.code === 'mnemonic_checksum');
  await assert.rejects(s.authorizeMaster('not even a word list'), (e) => /mnemonic/.test(e.code));
  assert.equal(s.state.master, false, 'and nothing was unlocked on the way');

  await s.authorizeMaster(MASTER_WORDS);
  assert.equal(s.state.master, true);
  const saved = await s.saveConfig({ user: 'Ann' });     // and it authorises what follows
  assert.equal(saved.user, 'Ann');

  s.signOut();
  assert.equal(s.state.master, false, 'signing out drops the master token with the rest');
  assert.deepEqual(s.tokens(), []);
});

test('wiping the module ends everything', async () => {
  const s = await signedIn();
  await s.wipeout();
  assert.equal(s.state.phase, 'probing');
  assert.equal(s.state.config, null);
  assert.equal(s.state.keys, null);
  await assert.rejects(s.loadKeys(), (e) => e.code === 'not_signed_in');
});

// -- personalisation: a module out of the box, on a server of its own ----------------------

const freshModule = async () => {
  const server = await createServer({ approveAfter: 2, personalised: false });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const b = `http://127.0.0.1:${server.address().port}`;
  return { server, urls: { hem: `${b}/mock`, broker: `${b}/mockbroker` }, base: b };
};

const FIELDS = {
  user: 'Ann', email: 'ann@example.com', password: 'first-light', prefix: 'my', custom: false, ip: '192.168.7.1',
  storage_disk0size: gbToSectors(4), storage_mode: storageMode({ show: true, rw: false, xts: false }),
  trusted_ts: true, trusted_backend: false, allow_keysearch: false,
};

test('the storage mode byte and the sizes are the ones v1 composed', () => {
  assert.equal(storageMode({ show: true, rw: false, xts: false }), 0x51);
  assert.equal(storageMode({ show: true, rw: true, xts: false }), 0x53);
  assert.equal(storageMode({ show: false, rw: true, xts: false }), 0x50, 'hidden means hidden, writable or not');
  assert.equal(storageMode({ show: true, rw: false, xts: true }), 0xa1);
  assert.equal(storageMode({ show: false, xts: true }), 0xa0);
  assert.deepEqual(parseStorageMode(0xa3), { xts: true, show: true, rw: true });
  assert.deepEqual(parseStorageMode(0x50), { xts: false, show: false, rw: false });
  assert.equal(gbToSectors(4), 8388608, 'a GB is 2097152 sectors of 512 bytes');
  assert.equal(sectorsToGb(125829120 + 16777216), 68);
  assert.equal(isPrefix('ann-desk'), true);
  assert.equal(isPrefix('-ann'), false);
  assert.equal(isPrefix('Ann'), false);
  assert.equal(isUnpersonalised({ inited: false }), true);
  assert.equal(isUnpersonalised({ uptime: 5 }), false);
});

test('a module out of the box is told by its status, and the words plus the password open it afterwards', async () => {
  const fresh = await freshModule();
  try {
    const s = new Session(fresh.urls);
    await s.waitForDevice({ intervalMs: 10 });
    await s.prepare();
    assert.equal(s.state.phase, 'unpersonalised');
    assert.equal(s.state.model, 'ppa');
    assert.deepEqual(await s.domainPredefs(), ['my', 'dev', 'devel', 'moje']);
    await assert.rejects(s.signIn('anything'), (e) => e.code === 'http_401', 'nothing opens it yet');

    const steps = [];
    s.addEventListener('change', () => { const st = s.state.setup?.step; if (st && steps.at(-1) !== st) steps.push(st); });
    const result = await s.personalise(FIELDS, { pollInterval: 10 });
    assert.deepEqual(steps, ['words', 'init', 'format', 'domain', 'tls', 'done']);
    assert.equal(result.words.split(' ').length, 24);
    assert.equal(result.hostname, 'my.ence.do');
    assert.equal(result.rebootRequired, false, 'my.ence.do is what it answers to already');
    assert.ok(result.instanceid?.startsWith('INST-'));
    assert.equal(result.tls.crt, 'CRT');
    assert.equal(result.config.devid, 'PPA-0001', 'the proof gets the ids from the config');
    assert.equal(s.state.setup.result.words, result.words, 'the words stay until the person has them');

    const { reboot } = await s.finishPersonalisation();
    assert.equal(reboot, false);
    assert.equal(s.state.setup, null, 'and then they are gone');
    assert.equal(s.state.phase, 'probing');

    await s.waitForDevice({ intervalMs: 10 });
    await s.prepare();
    assert.equal(s.state.phase, 'reachable', 'personalised now');
    assert.equal(s.state.status.inited, undefined);
    await assert.rejects(s.signIn('demo'), (e) => e.code === 'http_401', 'the old mock password is nobody');
    await s.signIn('first-light');
    assert.equal(s.state.config.user, 'Ann');
    assert.equal(s.state.config.storage_mode, 0x51);
    assert.equal(s.state.config.trusted_backend, false);
    await s.loadKeys();
    assert.deepEqual(s.state.keys, [], 'a fresh keychain');
    await s.authorizeMaster(result.words);
    assert.equal(s.state.master, true, 'the 24 words are the master key');
  } finally {
    fresh.server.close();
  }
});

test('a name of the owner\'s own waits for the e-mail click, and the module reboots to answer to it', async () => {
  const fresh = await freshModule();
  try {
    const s = new Session(fresh.urls);
    await s.waitForDevice({ intervalMs: 10 });
    await s.prepare();
    const statuses = [];
    s.addEventListener('change', () => { const st = s.state.setup; if (st?.step === 'email' && statuses.at(-1) !== st.status) statuses.push(st.status); });
    const result = await s.personalise({ ...FIELDS, prefix: 'ann-desk', custom: true }, { pollInterval: 10 });
    assert.deepEqual(statuses, ['pending', 'email_confirmed']);
    assert.equal(result.hostname, 'ann-desk.ence.do');
    assert.equal(result.csr, 'CSR-MOCK', 'the init made the CSR the registration used');
    assert.equal(result.tls.prefix, 'ann-desk');
    assert.equal(result.rebootRequired, true);
    const { reboot, hostname } = await s.finishPersonalisation();
    assert.equal(reboot, true);
    assert.equal(hostname, 'ann-desk.ence.do');
  } finally {
    fresh.server.close();
  }
});

test('air-gapped, the module is personalised as my.ence.do with no certificate', async () => {
  const fresh = await freshModule();
  try {
    const s = new Session({ hem: fresh.urls.hem, broker: 'http://127.0.0.1:9/nobroker' });
    await s.waitForDevice({ intervalMs: 10 });
    await s.prepare();
    assert.equal(s.state.phase, 'unpersonalised');
    assert.deepEqual(await s.domainPredefs(), []);
    const steps = [];
    s.addEventListener('change', () => { const st = s.state.setup?.step; if (st && steps.at(-1) !== st) steps.push(st); });
    const result = await s.personalise({ ...FIELDS, prefix: 'ann-desk', custom: true });
    assert.deepEqual(steps, ['words', 'init', 'format', 'done'], 'no domain steps without the backend');
    assert.equal(result.hostname, 'my.ence.do', 'the name of its own has to wait');
    assert.equal(result.tls, null);
  } finally {
    fresh.server.close();
  }
});

test('a personalisation that fails is rolled back, and the module is out of the box again', async () => {
  const fresh = await freshModule();
  try {
    const s = new Session(fresh.urls);
    await s.waitForDevice({ intervalMs: 10 });
    await s.prepare();
    // The broker refuses the name: the init went through, so the module has to be wiped.
    const broken = new Session({ hem: fresh.urls.hem, broker: `${fresh.base}/nothing-here` });
    await broken.waitForDevice({ intervalMs: 10 });
    await broken.prepare();
    broken.state.online = true;               // as if the check-in had worked and the broker died after
    await assert.rejects(broken.personalise(FIELDS, { pollInterval: 10 }));
    assert.equal(broken.state.setup.step, 'failed');
    assert.ok(broken.state.setup.result?.token, 'the init token is what the rollback uses');
    assert.ok(broken.state.setup.error);

    const s2 = new Session(fresh.urls);
    await s2.waitForDevice({ intervalMs: 10 });
    await s2.prepare();
    assert.equal(s2.state.phase, 'reachable', 'half done: the module thinks it is personalised');

    await broken.rollbackPersonalisation();
    assert.equal(broken.state.setup, null);
    await s2.prepare();
    assert.equal(s2.state.phase, 'unpersonalised', 'wiped back to how it came');
  } finally {
    fresh.server.close();
  }
});

test('the proof of personalisation is a PDF a reader can open, with the words in it', () => {
  const words = 'chat march maximum extra maple panda chapter mammal slogan fun actual know hungry catalog grape cherry bubble zone august salad dilemma avoid trigger cotton';
  const bytes = proofOfPersonalisation({ hostname: 'my.ence.do', issued: '2026-09-07T10:00:00Z', instanceid: 'INST-1', devid: 'PPA-0001', eid: 'EID', eid_sign: 'SIGN', user: 'Ann (ann@example.com)', trusted_ts: true, trusted_backend: false, allow_keysearch: false, hardware: 'PPA rev 2.2', firmware: 'FW v1.2.2', words });
  const text = Buffer.from(bytes).toString('latin1');
  assert.ok(text.startsWith('%PDF-1.4'));
  assert.ok(text.trimEnd().endsWith('%%EOF'));
  assert.match(text, /\/Type \/Catalog/);
  assert.match(text, /\/Count 1/, 'one page');
  for (const w of ['chat', 'cotton', 'PPA-0001', 'my.ence.do']) assert.ok(text.includes(w), w);
  // the cross-reference table points at the objects it names
  const xref = Number(/startxref\n(\d+)/.exec(text)[1]);
  assert.equal(text.slice(xref, xref + 4), 'xref');
  const first = Number(/xref\n0 \d+\n0000000000 65535 f \n(\d{10})/.exec(text)[1]);
  assert.equal(text.slice(first, first + 7), '1 0 obj');
  // a parenthesis or a character outside WinAnsi does not break the file: escaped, or a question mark
  const odd = Buffer.from(buildPdf([{ kind: 'paragraph', text: 'Zażółć (gęślą) jaźń \\ ok' }])).toString('latin1');
  assert.ok(odd.includes('\\(g'), 'the parenthesis is escaped');
  assert.ok(odd.includes('\\\\ ok'), 'so is the backslash');
  assert.ok(!/[^\x00-\xff]/.test(odd), 'nothing outside one byte per character');
});

// -- software: on a server of its own, because installing changes what the module runs ---

const ownModule = async (opts = {}) => {
  const server = await createServer({ approveAfter: 2, ...opts });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const b = `http://127.0.0.1:${server.address().port}`;
  return { server, urls: { hem: `${b}/mock`, broker: `${b}/mockbroker` }, base: b };
};

test('a version string is read down to its number', () => {
  assert.equal(versionNumber('Encedo nGINE FW v1.2.2'), '1.2.2');
  assert.equal(versionNumber('v2.5.0+mock'), '2.5.0+mock');
  assert.equal(versionNumber('2.0.0'), '2.0.0');
  assert.equal(versionNumber('unknown'), 'unknown');
});

test('the firmware announced at check-in is downloaded, uploaded, checked by the module and installed; the module reboots', async () => {
  const own = await ownModule();
  try {
    const s = new Session(own.urls);
    await s.waitForDevice({ intervalMs: 10 });
    await s.prepare();
    assert.equal(s.state.health.newfws, NEW_FIRMWARE);
    assert.ok(s.state.checkedInAt > 0);
    await s.signIn('demo');
    const steps = [];
    s.addEventListener('change', () => { const st = s.state.update?.step; if (st && steps.at(-1) !== st) steps.push(st); });
    const result = await s.updateFirmware({ version: NEW_FIRMWARE, pollInterval: 5 });
    assert.deepEqual(steps, ['download', 'upload', 'verify', 'install', 'done']);
    assert.equal(result.source, 'backend');
    assert.equal(result.size, 24 * 1024, 'the image the backend handed out');
    assert.equal(result.result.verified, true, 'what the module said when it had checked it');
    assert.equal(s.state.phase, 'probing', 'the module is rebooting');
    assert.equal(s.state.mode, null);

    await s.waitForDevice({ intervalMs: 10 });
    await s.prepare();
    assert.equal(s.state.version.fwv, NEW_FIRMWARE, 'it came back on the new firmware');
    assert.equal(s.state.health.newfws, null, 'and the backend has nothing newer');
    assert.deepEqual(s.disks().map((d) => d.state), ['locked', 'locked']);
    s.clearUpdate();
    assert.equal(s.state.update, null);
  } finally {
    own.server.close();
  }
});

test('the Manager is updated the same way, and the module keeps running', async () => {
  const own = await ownModule();
  try {
    const s = new Session(own.urls);
    await s.waitForDevice({ intervalMs: 10 });
    await s.prepare();
    assert.equal(s.state.health.newuis, NEW_MANAGER);
    await s.signIn('demo');
    const result = await s.updateManager({ version: NEW_MANAGER, pollInterval: 5 });
    assert.equal(result.step, 'done');
    assert.equal(result.size, 12 * 1024);
    assert.equal(s.state.phase, 'signed-in', 'no reboot for the Manager');
    assert.equal((await s.checkIn()).newuis, null, 'checked in again: nothing newer');
  } finally {
    own.server.close();
  }
});

test('a firmware file goes in without the backend, and one the module does not trust fails at the check', async () => {
  const own = await ownModule();
  try {
    const s = new Session({ hem: own.urls.hem, broker: 'http://127.0.0.1:9/nobroker' });
    await s.waitForDevice({ intervalMs: 10 });
    await s.prepare();
    await s.signIn('demo');
    await assert.rejects(s.updateFirmware({ version: 'v9' }), (e) => e.code === 'broker_error', 'nothing to download from');

    const bad = new Uint8Array(4096).fill(0x11); bad[0] = 0xff;
    await assert.rejects(s.updateFirmware({ bytes: bad, pollInterval: 5 }), (e) => e.code === 'http_400');
    assert.equal(s.state.update.step, 'failed');
    assert.equal(s.state.update.source, 'file');
    assert.ok(s.state.update.error);
    assert.equal(s.state.phase, 'signed-in', 'nothing was installed, nothing rebooted');
    await assert.rejects(s.updateManager({ version: NEW_MANAGER }), (e) => e.code === 'broker_error');

    s.clearUpdate();
    const good = new Uint8Array(4096).fill(0x22);
    const steps = [];
    s.addEventListener('change', () => { const st = s.state.update?.step; if (st && steps.at(-1) !== st) steps.push(st); });
    await s.updateFirmware({ bytes: good, pollInterval: 5 });
    assert.deepEqual(steps, ['upload', 'verify', 'install', 'done'], 'no download step for a file');
    assert.equal(s.state.phase, 'probing');
  } finally {
    own.server.close();
  }
});

test('an update can be cancelled while the module is still checking, and only one runs at a time', async () => {
  const own = await ownModule();
  try {
    const s = new Session(own.urls);
    await s.waitForDevice({ intervalMs: 10 });
    await s.prepare();
    await s.signIn('demo');
    const ctl = new AbortController();
    const going = s.updateFirmware({ version: NEW_FIRMWARE, signal: ctl.signal, pollInterval: 50 });
    await new Promise((r) => setTimeout(r, 5));
    await assert.rejects(s.updateManager({ version: NEW_MANAGER }), (e) => e.code === 'update_busy');
    while (s.state.update?.step !== 'verify') await new Promise((r) => setTimeout(r, 5));
    ctl.abort();
    await assert.rejects(going, (e) => e.code === 'aborted');
    assert.equal(s.state.update.step, 'failed');
    assert.equal(s.state.phase, 'signed-in');
  } finally {
    own.server.close();
  }
});

test('a module out of the box takes a firmware update without a token', async () => {
  const own = await ownModule({ personalised: false });
  try {
    const s = new Session(own.urls);
    await s.waitForDevice({ intervalMs: 10 });
    await s.prepare();
    assert.equal(s.state.phase, 'unpersonalised');
    await s.updateFirmware({ version: NEW_FIRMWARE, pollInterval: 5 });
    assert.equal(s.state.update.step, 'done');
    await s.waitForDevice({ intervalMs: 10 });
    await s.prepare();
    assert.equal(s.state.phase, 'unpersonalised', 'still out of the box');
    assert.equal(s.state.version.fwv, NEW_FIRMWARE, 'on the new firmware');
  } finally {
    own.server.close();
  }
});
