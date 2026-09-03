// The session logic against the mock module and broker. Run: node --test v2/dev/
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from './serve.mjs';
import { Session, parseStorage, formatBytes, describeError } from '../app/session.js';
import { resolveConfig, DEFAULT_HEM } from '../app/config.js';

let server, base;
before(async () => {
  server = await createServer({ approveAfter: 2 });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

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
  assert.equal(s.state.version.fwv, '2.4.1');
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
  assert.deepEqual(s.state.phones.map((p) => p.pid), ['PID-mock-1']);
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
