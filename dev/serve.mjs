// Dev server: the repo as static files, plus a mock module and a mock broker
// for working on the Manager without a PPA on the desk.
//
//   node dev/serve.mjs [port]
//
//   http://localhost:8080/                                     → the real module at https://my.ence.do
//   http://localhost:8080/?hem=http://localhost:8080/mock&broker=http://localhost:8080/mockbroker
//                                                              → the mock (password: demo)
//
// The mock speaks the wire format the SDK expects, verifies the eJWT the
// browser signs (so the password really is checked), keeps drive state, pairs
// one phone, and approves a phone request after a few polls.

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mnemonicToEntropy } from '../sdk/hem-sdk.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.map': 'application/json', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };

// ---- mock state --------------------------------------------------------------------------
const b64 = (bytes) => Buffer.from(bytes).toString('base64');
const b64url = (bytes) => Buffer.from(bytes).toString('base64url');
const fromB64 = (s) => new Uint8Array(Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64'));
const jwt = (payload) => `${b64url(Buffer.from('{"alg":"HS256"}'))}.${b64url(Buffer.from(JSON.stringify(payload)))}.mock`;
const jwtPayload = (t) => { try { return JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString()); } catch { return null; } };
const nowSecs = () => Math.floor(Date.now() / 1000);
const secs = (iso) => Math.floor(Date.parse(iso) / 1000);
/**
 * A key as the device reports it: descr is base64 of the raw description field,
 * which holds bytes — pass a string for a text one, an array for a binary one.
 */
const key = (kid, label, type, descr, created) => ({
  kid, label, type,
  descr: Buffer.from(typeof descr === 'string' ? Buffer.from(descr, 'utf8') : Uint8Array.from(descr)).toString('base64'),
  created: secs(created), updated: secs(created),
  pubkey: Buffer.from(kid.repeat(4).slice(0, 32), 'utf8').toString('base64'),
});
const newKid = () => [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
const hexBytes = (hex) => Uint8Array.from(hex.match(/../g) ?? [], (b) => parseInt(b, 16));
const b64urlText = (text) => Buffer.from(text, 'utf8').toString('base64url');
const FIRMWARE = 'Encedo nGINE FW v1.2.2';
/** What the mock backend announces at check-in, and what the module runs once installed. */
export const NEW_FIRMWARE = 'v2.5.0+mock';
export const NEW_MANAGER = 'v2.1.0+mock';
/** The mock module's master secret. A fixture, so the settings page can be driven. */
export const MASTER_WORDS = 'chat march maximum extra maple panda chapter mammal slogan fun actual know hungry catalog grape cherry bubble zone august salad dilemma avoid trigger cotton';

/** The X25519 public key of a 32-byte secret — the words are the key itself. */
async function pubFromSeed(seed) {
  const prefix = new Uint8Array([0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x6e, 0x04, 0x22, 0x04, 0x20]);
  const pkcs8 = new Uint8Array(prefix.length + 32);
  pkcs8.set(prefix); pkcs8.set(seed, prefix.length);
  const priv = await crypto.subtle.importKey('pkcs8', pkcs8, 'X25519', false, ['deriveBits']);
  const base = new Uint8Array(32); base[0] = 9;
  const basePub = await crypto.subtle.importKey('raw', base, 'X25519', false, []);
  return b64(new Uint8Array(await crypto.subtle.deriveBits({ name: 'X25519', public: basePub }, priv, 256)));
}

/**
 * One audit-log file, sealed the way the device seals it: a key line carrying a
 * fresh nonce and its Ed25519 signature, then entries whose last field is the
 * first 16 bytes of HMAC-SHA256(nonce, everything up to and including the last
 * `|`). Counters run in hex without gaps. `tamperAt` edits one entry after it
 * was sealed, which is what a log someone has been at looks like.
 */
async function buildLogFile(signKey, startedAt, entries, { tamperAt = null } = {}) {
  const nonce = crypto.getRandomValues(new Uint8Array(32));
  const signature = new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, signKey, nonce));
  const hmacKey = await crypto.subtle.importKey('raw', nonce, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const seal = async (prefix) => {
    const mac = new Uint8Array(await crypto.subtle.sign('HMAC', hmacKey, Buffer.from(prefix, 'utf8'))).subarray(0, 16);
    return prefix + Buffer.from(mac).toString('base64url');
  };

  // Counters start at 0 and the first entries carry seconds since boot, because
  // the clock is not set until the module is told the time — that is what a real
  // file looks like (`# Encedo nGINE FW v1.2.2`, checked against 137 of them).
  const lines = [`# ${FIRMWARE}`];
  let counter = 0;
  let clock = 0;
  const stamp = () => (clock ? (clock += 23) : (counter + 6)).toString(16);
  lines.push(await seal(`0|${stamp()}|0|0|${Buffer.from(nonce).toString('base64url')}|${Buffer.from(signature).toString('base64url')}|`));
  for (const [type, result, subject = '', extra = ''] of entries) {
    counter++;
    if (type === 0x13) clock = startedAt;                 // the clock is set here
    lines.push(await seal(`${counter.toString(16)}|${stamp()}|${type.toString(16)}|${result}|${subject}|${extra}|`));
  }
  if (tamperAt !== null) {
    const fields = lines[tamperAt].split('|');    // the seal is the last field; edit what it covers
    fields[5] += 'Cg';
    lines[tamperAt] = fields.join('|');
  }
  return { entries: counter, text: lines.join('\n') + '\n' };
}

/** A handful of files, oldest first, one of them edited after the fact. */
async function buildLogs(keys) {
  const signing = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const proof = crypto.getRandomValues(new Uint8Array(32));
  const kid = (i) => Buffer.from(hexBytes(keys[i].kid)).toString('base64url');
  const u32 = (n) => Buffer.from(Uint32Array.of(n >>> 0).buffer).toString('base64url');
  const token = (scope) => [0xd, 0, 'U', b64urlText(scope)];    // token issued, password auth
  const session = (started, middle = []) => [
    [1, 0],                                                     // system powered up
    [0x18, 0],                                                  // key integrity check
    [7, 0],                                                     // self-test passed
    [0x13, 0, '', u32(started)],                                // clock set
    ...middle,
    [9, 0, 'U'],                                                // log files listed
    [3, 0],                                                     // system shut down
  ];
  const plans = [
    [0x68b30a00, session(0x68b30a00, [token('keymgmt:gen'), [0x14, 0, 'U', kid(0)], token(`keymgmt:use:${keys[0].kid}`), [0x17, 0, 'U', kid(0)]]), {}],
    [0x68b45c40, session(0x68b45c40, [token('keymgmt:list'), [0x20, 0, 'U', kid(1)], [0x20, 0, 'U', kid(1)], [0x16, 0, 'U', kid(3)]]), {}],
    [0x68b5ae80, session(0x68b5ae80, [token('keymgmt:search'), [0xc, 1, 'U', b64urlText('keymgmt:del')], [0x19, 0, 'U', kid(2)]]), { tamperAt: 7 }],
    [0x68b700c0, session(0x68b700c0, [[0xe, 0, 'M', b64urlText('phone PID-mock-1')], [6, 2, '', u32(-421)], [0x26, 0, 'U', kid(4)]]), {}],
    [0x68b85300, session(0x68b85300, [[0x12, 0, 'U'], [0x1e, 1, 'U'], [0x15, 0, 'U', kid(5)]]), {}],
    [0x68b9a540, session(0x68b9a540, [[0x20, 0, 'U', kid(1)], [0xb, 0, 'U', 'CkNvbnRlbnQtTGVuZ3RoOiA2NzINCg']]), {}],
  ];
  const files = [];
  for (const [started, entries, opts] of plans) {
    const built = await buildLogFile(signing.privateKey, started, entries, opts);
    files.push({ id: started.toString(16), ...built });
  }
  // The session the module is in the middle of. A real one answers 406 for it —
  // seen twice while archiving a PPA, both times on the newest file, and both
  // times readable once that session had ended.
  const live = await buildLogFile(signing.privateKey, 0x68baf780, [[1, 0], [0x18, 0], [7, 0]]);
  files.push({ id: (0x68baf780).toString(16), ...live, open: true });
  return {
    files,
    key: Buffer.from(new Uint8Array(await crypto.subtle.exportKey('raw', signing.publicKey))).toString('base64'),
    nonce: Buffer.from(proof).toString('base64'),
    nonce_signed: Buffer.from(new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, signing.privateKey, proof))).toString('base64'),
  };
}
const listed = (keys) => keys.map(({ pubkey, ...rest }) => rest);   // the list endpoint has no pubkey in it
/**
 * A paired phone's key: the description is 'EXTAID' followed by the bytes the
 * pid is the base64 of, so that the field's base64 reads 'RVhUQUlE' + pid —
 * the shape Manager v1 matched on a real module. Pids are base64 strings.
 */
export const PHONE_PIDS = { pixel: 'UElELW1vY2stMQ==', iphone: 'UElELW1vY2stMg==' };
const phoneDescr = (pid) => [...Buffer.from('EXTAID', 'utf8'), ...Buffer.from(pid, 'base64')];

export async function createMock({ password = 'demo', eid = 'mock-eid-0001', approveAfter = 3, personalised = true } = {}) {
  const devKeys = await crypto.subtle.generateKey({ name: 'X25519' }, true, ['deriveBits']);
  const spk = b64(new Uint8Array(await crypto.subtle.exportKey('raw', devKeys.publicKey)));
  // The public key a correct password derives (PBKDF2-SHA256, 600k, salt = eid),
  // so a wrong one gets a 401. A password change replaces it.
  let expectedPub = await derivePub(password, eid);
  // And the master secret: the 24 words ARE the key, so the module accepts what
  // they sign as readily as the password. These are a fixture, printed at start.
  let masterPub = await pubFromSeed(await mnemonicToEntropy(MASTER_WORDS));
  const state = {
    storage: ['125829120:-', '16777216:-'],   // 60 GB, 8 GB, both locked
    logger: null,                             // filled in below, once the keys exist
    // What the broker knows: one of the two phones in the keychain. The other
    // is the shape a page has to cope with — a key left behind after the
    // subscription went, or a phone paired while the Manager was offline.
    subscribers: [{ pid: PHONE_PIDS.pixel }],
    pairings: {},                             // rid -> { pid, polls }
    polls: {},
    uptime: 3 * 86400 + 5 * 3600 + 12 * 60,
    temp: 42,
    selftest: null,
    // A module out of the box: /status carries `inited` (any value) and nothing
    // opens it until POST /api/auth/init. After that it formats the drive for a
    // few status polls (`format`), the way a PPA does.
    personalised,
    formatPolls: 0,
    domainJobs: {},                           // custom-prefix registrations waiting for an e-mail click
    // Software: what the module runs, and an upload in flight. The check
    // answers 202 twice before it says yes, the way a real module verifies in
    // the background; an image whose first byte is 0xff does not verify.
    fwv: FIRMWARE,
    managerInstalled: false,
    upgrade: { fw: null, ui: null },          // { size, checks }
    pendingHostname: null,
    configNonce: b64(crypto.getRandomValues(new Uint8Array(32))),
    // The settings a module keeps, with the names hem-api-tester writes them under.
    config: {
      user: 'Ann',
      email: 'ann@example.com',
      hostname: 'my.ence.do',
      origin: '*',
      trusted_ts: true,
      trusted_backend: true,
      allow_keysearch: false,
      storage_mode: 0x51,
      storage_disk0size: 8388608,
      devid: 'PPA-0001',
    },
    keys: [
      key('8a41f0c2d3e45b67912c4d0ea7b3f658', 'wg-peer-03', 'PKEY,ECDH,CURVE25519', 'WireGuard identity, laptop', '2026-02-02'),
      key('c07d5a1b9e3f2c48a06e51d97b2f4380', 'git-signing', 'ATT,PKEY,ExDSA,ED25519', 'Commits and tags', '2026-02-02'),
      key('5e2b7c4409af1d3682c05fa7419e6db3', 'backup-kem', 'PKEY,MLKEM768', 'Post-quantum wrap for the backup set', '2026-05-19'),
      key('11f0aa93c6d2e5784b71c93a0d5e2f86', 'bob (imported)', 'ED25519', 'Public key from bob@example.com', '2026-07-07'),
      key('9c3a2e6f70b1d845e23f80c94a17b6d2', "Ann's Pixel", 'PKEY,ECDH,CURVE25519', phoneDescr(PHONE_PIDS.pixel), '2026-06-12'),
      key('2d77b8e40a5c9f1360b2ea48d519c73f', 'Work iPhone', 'PKEY,ECDH,CURVE25519', phoneDescr(PHONE_PIDS.iphone), '2026-03-03'),
      key('4b19d0c8e2a63f7581d04b62ea937c15', 'pgp-sign-ann', 'ATT,PKEY,ExDSA,ED25519', 'OpenPGP signing, ann@example.com', '2026-01-14'),
      key('7fa3e5910c4d82b6c419d073a58e2fb4', 'pgp-ecdh-ann', 'PKEY,ECDH,CURVE25519', 'OpenPGP encryption, ann@example.com', '2026-01-14'),
      key('a6c48f2071bd3e9052f4ac180b697d3e', 'chat-identity', 'PKEY,ECDH,CURVE25519', 'Encedo chat, handle @ann', '2026-04-21'),
      // A field that starts as text and carries on as bytes — the shape that catches
      // any UI tempted to run a text decoder over a description.
      key('e05b7d3a94f1c26839a7b0e421d56f8c', 'backup-wrap', 'AES256', [0x57, 0x47, 0x3a, 0x70, 0x72, 0x3a, 0xc3, 0x28, 0xff, 0x75, 0x00, 0x6c, 0x20, 0x63], '2026-02-27'),
      key('3c81a49f6e0b5d72f0e93b1748ac25d6', 'log-hmac', 'SHA2-256', 'Operation log integrity', '2025-11-30'),
      key('62d0fb18a7c395e41ab7d0243f5e968c', 'oidc-p384', 'PKEY,ECDH,ExDSA,SECP384R1', 'Single sign-on, both jobs', '2026-08-02'),
      key('95e2c703d81a6f4b2d0916bae4c73f58', 'carol (imported)', 'CURVE25519', 'Public key from carol@example.net', '2026-07-19'),
      key('08fd6b2e51739ca4e8b1470d2f96a35c', 'old-attestation', 'ATT,PKEY,ExDSA,ED25519', 'Retired device attestation', '2025-09-08'),
    ],
  };

  const freshConfig = () => ({
    user: '', email: '', hostname: 'my.ence.do', origin: '*', trusted_ts: true, trusted_backend: true,
    allow_keysearch: false, storage_mode: 0x51, storage_disk0size: 8388608, devid: 'PPA-0001',
  });
  const NAMES = ['my', 'dev', 'devel', 'moje'];           // the prefixes the broker hands out for free

  async function verifyEjwt(ejwt, { anyIssuer = false } = {}) {
    const [h, p, sig] = ejwt.split('.');
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString());
    const userPub = await crypto.subtle.importKey('raw', fromB64(payload.iss), 'X25519', false, []);
    const shared = await crypto.subtle.deriveBits({ name: 'X25519', public: userPub }, devKeys.privateKey, 256);
    const key = await crypto.subtle.importKey('raw', shared, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('HMAC', key, fromB64(sig), Buffer.from(`${h}.${p}`));
    return { ok: ok && (anyIssuer || payload.iss === expectedPub || payload.iss === masterPub), payload };
  }

  state.logger = await buildLogs(state.keys);

  /** The device's side of a password change: HMAC the nonce under the shared secret. */
  async function verifyUserKey({ userkey, userkey_nonce, userkey_hmac }) {
    if (userkey_nonce !== state.configNonce) return false;
    try {
      const userPub = await crypto.subtle.importKey('raw', fromB64(userkey), 'X25519', false, []);
      const shared = await crypto.subtle.deriveBits({ name: 'X25519', public: userPub }, devKeys.privateKey, 256);
      const key = await crypto.subtle.importKey('raw', shared, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
      return crypto.subtle.verify('HMAC', key, fromB64(userkey_hmac), fromB64(state.configNonce));
    } catch {
      return false;
    }
  }

  const scopeOf = (req) => jwtPayload((req.headers.authorization ?? '').replace(/^Bearer /, ''))?.scope ?? '';

  /** Returns [status, body] or null when the path is not a mock path. */
  return async function mock(method, p, body, req, raw = null) {
    // ---- device -----------------------------------------------------------------------
    // The field set a real PPA answers with — no `conf` on this firmware, and the
    // signing keys and signatures of what it is running. The values are made up.
    if (p === '/mock/api/system/version') return [200, {
      hwv: 'PPA rev 2.2',
      fwv: state.fwv,
      fwk: 'x/aUqQQG0w2APlV4i6QdIMY1mYQbemkNwzfSaXTzobw=',
      fws: 'T8Ihe616IGmxiOHf2Ze8UNaplG3NjZ4RLeOmUv+1D0ENBleDxk37j0DHOq5q8c/z0tJ+rQBrnnMBP3YjNSN7pQ==',
      blv: 'Encedo Secure Bootloader v2.0.1',
      blk: 'qS5cxes2jANu+Jd6vMSedHE6fKGzO1aEwnTACrCwd/k=',
      bls: 'wutHuWWYlNualnZz6/uZu6VGBGBf2OtAIbn7VR1inq0pa8yAtoXzCXQoNZnk6qXXiD1s4SR7Dl32+J6Tvw0jhw==',
      uis: 'qnu0b8DquUik4+5iXgB+8oFWR9/96jgEeLy9pM5y0KY=',
    }];
    // The fields a real PPA answers with — no hostname (that is in the config),
    // a whole-degree temperature, and `ctx`, whose meaning the firmware knows.
    if (p === '/mock/api/system/status') {
      state.uptime += 7;
      state.temp = Math.min(52, Math.max(38, state.temp + Math.round((Math.random() - 0.5) * 2)));
      let format;
      if (state.formatPolls > 0) format = --state.formatPolls > 1 ? 'formatting' : 'done';
      return [200, {
        ...(state.personalised ? {} : { inited: false }),
        ...(format ? { format } : {}),
        ctx: 0,
        uptime: state.uptime,
        ts: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
        time: Math.floor(Date.now() / 1000),
        storage: state.storage,
        temp: state.temp,
        fls_state: 0,
      }];
    }
    if (p === '/mock/api/system/selftest') {
      if (!scopeOf(req)) return [403, { error: 'scope' }];
      const now = Math.floor(Date.now() / 1000);
      state.selftest = {
        last_selftest_ts: state.selftest?.selftest_ts ?? now - 86400,
        last_fls_state: 0,
        last_entropytest_ts: now - 4,
        last_kat_ts: now - 59,
        kat_busy: true,
        fls_state: 0,
        selftest_ts: now,
        // The module also reports what its key repository looks like inside.
        repo_stats: { total: state.keys.length, deleted: 36, invalid: 0, fragmented: 55, freeslots: 24094 },
        se_state: 0,
      };
      return [200, state.selftest];
    }
    if (p === '/mock/api/system/reboot') {
      if (!scopeOf(req)) return [403, { error: 'scope' }];
      state.storage = state.storage.map((entry) => entry.split(':')[0] + ':-');   // a reboot locks the drives
      state.uptime = 0;
      return [200, { rebooting: true }];
    }
    if (p === '/mock/api/system/checkin' && method === 'GET') return [200, { check: 'mock-check' }];
    if (p === '/mock/api/system/checkin' && method === 'POST') {
      return [200, { status: 'ok', newfws: state.fwv === NEW_FIRMWARE ? null : NEW_FIRMWARE, newuis: state.managerInstalled ? null : NEW_MANAGER }];
    }
    // ---- software: upload, check in the background, install ----
    if (p.startsWith('/mock/api/system/upgrade/')) {
      const op = p.split('/').pop();
      // An unpersonalised module takes an upgrade without a token, as v1 relied on.
      if (state.personalised && scopeOf(req) !== 'system:upgrade') return [403, { error: 'scope' }];
      const slot = op.endsWith('_fw') ? 'fw' : op.endsWith('_ui') ? 'ui' : null;
      if (!slot) return [404, { error: 'no such upgrade call' }];
      if (op.startsWith('upload_')) {
        if (!raw?.length) return [400, { error: 'empty upload' }];
        state.upgrade[slot] = { size: raw.length, bad: raw[0] === 0xff, checks: 0 };
        return [200, { received: raw.length }];
      }
      const up = state.upgrade[slot];
      if (!up) return [404, { error: 'nothing uploaded' }];
      if (op.startsWith('check_')) {
        if (++up.checks < 3) return [202, null];
        if (up.bad) return [400, { error: 'the image does not verify' }];
        return [200, { verified: true, size: up.size, version: slot === 'fw' ? NEW_FIRMWARE : NEW_MANAGER }];
      }
      if (op.startsWith('install_')) {
        if (up.checks < 3 || up.bad) return [409, { error: 'not verified' }];
        state.upgrade[slot] = null;
        if (slot === 'fw') {
          // The module reboots into the new firmware: drives lock, uptime restarts.
          state.fwv = NEW_FIRMWARE;
          state.storage = state.storage.map((entry) => entry.split(':')[0] + ':-');
          state.uptime = 0;
          return [200, { installing: true, reboot: true }];
        }
        state.managerInstalled = true;
        return [200, { installing: true }];
      }
    }
    if (p === '/mock/api/system/config' && method === 'GET') {
      if (!scopeOf(req)) return [403, { error: 'scope' }];
      return [200, { eid, spk, nonce: state.configNonce, ...state.config }];
    }
    if (p === '/mock/api/system/config' && method === 'POST') {
      if (!scopeOf(req)) return [403, { error: 'scope' }];
      if (body.wipeout) {
        Object.assign(state, { personalised: false, keys: [], subscribers: [], formatPolls: 0, pendingHostname: null, config: freshConfig() });
        state.storage = state.storage.map((entry) => entry.split(':')[0] + ':-');
        expectedPub = null;
        return [200, { wipeout: true }];
      }
      if (body.gen_csr) return [200, { genuine: 'GENUINE-MOCK', csr: 'CSR-MOCK' }];
      if (body.tls) {
        const next = body.tls?.prefix ? `${body.tls.prefix}.ence.do` : state.pendingHostname ?? state.config.hostname;
        const changed = next !== state.config.hostname;
        state.config.hostname = next;
        state.pendingHostname = null;
        return [200, { updated: true, ...(changed ? { reboot_required: true } : {}) }];
      }
      if (body.userkey) {
        // What a module does before it accepts a new password: check that
        // whoever sent this key can also do ECDH with it against the module.
        const ok = await verifyUserKey(body);
        if (!ok) return [401, { error: 'the proof does not check out' }];
        expectedPub = body.userkey;                 // that password now opens it
        return [200, { updated: true, userkey: true }];
      }
      for (const [key, value] of Object.entries(body)) {
        if (key in state.config) state.config[key] = value;
      }
      return [200, { updated: true }];
    }
    if (p === '/mock/api/auth/init' && method === 'GET') {
      if (state.personalised) return [403, { error: 'already personalised' }];
      return [200, { eid, spk, jti: 'init-' + Date.now(), exp: Math.floor(Date.now() / 1000) + 300, genuine: 'GENUINE-MOCK' }];
    }
    if (p === '/mock/api/auth/init' && method === 'POST') {
      if (state.personalised) return [403, { error: 'already personalised' }];
      const { ok, payload } = await verifyEjwt(body.init, { anyIssuer: true });
      if (!ok) return [401, { error: 'the init request does not verify' }];
      const cfg = payload.cfg ?? {};
      if (!cfg.userkey || !cfg.masterkey || cfg.masterkey !== payload.iss) return [400, { error: 'keys missing' }];
      masterPub = cfg.masterkey;                  // the 24 words that were just made
      expectedPub = cfg.userkey;                  // and the password that was typed
      const next = freshConfig();
      for (const key of Object.keys(next)) if (key in cfg) next[key] = cfg[key];
      state.config = next;
      state.keys = [];
      state.subscribers = [];
      state.personalised = true;
      state.formatPolls = 4;                      // 'formatting', 'formatting', 'done', then nothing
      return [200, {
        token: jwt({ scope: 'system:config', exp: Math.floor(Date.now() / 1000) + 600, sub: 'init' }),
        instanceid: 'INST-' + b64(crypto.getRandomValues(new Uint8Array(6))).replace(/[^A-Za-z0-9]/g, '').slice(0, 8),
        genuine: 'GENUINE-MOCK',
        ...(cfg.gen_csr ? { csr: 'CSR-MOCK' } : {}),
      }];
    }
    if (p === '/mock/api/auth/token' && method === 'GET') return [200, { eid, spk, jti: 'jti-' + Date.now() }];
    if (p === '/mock/api/auth/token' && method === 'POST') {
      const { ok, payload } = await verifyEjwt(body.auth);
      if (!ok) return [401, { error: 'authentication failed' }];
      return [200, { token: jwt({ scope: payload.scope, exp: payload.exp, sub: payload.iss === masterPub ? 'master' : 'user' }) }];
    }
    if (p === '/mock/api/auth/ext/request') return [200, { challenge: 'mock', epk: body.epk, scope: body.scope }];
    if (p === '/mock/api/auth/ext/token') {
      // The reply names the scope the phone approved, the way the real one is bound to it.
      const scope = String(body.authreply ?? '').replace(/^mock-reply:/, '') || 'system:config';
      return [200, { token: jwt({ scope, exp: Math.floor(Date.now() / 1000) + 300, sub: 'phone' }) }];
    }
    if (p === '/mock/api/auth/ext/mac') return [200, { nonce: 'N', mac: 'M', eid }];
    // Pairing a phone: the module's challenge, then its check of the phone's reply,
    // after which the phone is a key in the keychain with 'EXTAID' + pid for a description.
    if (p === '/mock/api/auth/ext/init') {
      if (!scopeOf(req)) return [403, { error: 'scope' }];
      return [200, { eid, request: 'REQ-' + body.epk }];
    }
    if (p === '/mock/api/auth/ext/validate') {
      if (!scopeOf(req)) return [403, { error: 'scope' }];
      if (!body.pid || body.reply !== 'REPLY-' + body.pid) return [400, { error: 'the reply does not verify' }];
      // A real module gives the new key a label of its own; what it says is not pinned here.
      state.keys.push(key(newKid(), 'Phone ' + body.pid.slice(0, 4), 'PKEY,ECDH,CURVE25519', phoneDescr(body.pid), new Date().toISOString().slice(0, 10)));
      return [200, { pid: body.pid, confirmation: 'CONF-' + body.pid }];
    }
    if (p === '/mock/api/storage/unlock') {
      const m = /^storage:disk(\d)(:rw)?$/.exec(scopeOf(req));
      if (!m) return [403, { error: 'scope' }];
      const i = Number(m[1]);
      state.storage[i] = state.storage[i].split(':')[0] + (m[2] ? ':rw' : ':ro');
      return [200, { unlocked: i }];
    }
    if (p === '/mock/api/storage/lock') {
      const m = /^storage:disk(\d)(:rw)?$/.exec(scopeOf(req));
      if (!m) return [403, { error: 'scope' }];
      const i = Number(m[1]);
      state.storage[i] = state.storage[i].split(':')[0] + ':-';
      return [200, { locked: i }];
    }
    // ---- keychain ---------------------------------------------------------------------
    if (p.startsWith('/mock/api/keymgmt/list')) {
      if (scopeOf(req) !== 'keymgmt:list') return [403, { error: 'scope' }];
      const [offset = 0, limit = 15] = p.split('/').slice(5).map(Number);
      const page = state.keys.slice(offset, offset + limit);
      return [200, { total: state.keys.length, listed: page.length, list: listed(page) }];
    }
    if (p === '/mock/api/keymgmt/search' && method === 'POST') {
      if (scopeOf(req) !== 'keymgmt:search') return [403, { error: 'scope' }];
      const want = Buffer.from(String(body.descr ?? '').replace(/^\^/, ''), 'base64');
      const hits = state.keys.filter((k) => Buffer.from(k.descr, 'base64').subarray(0, want.length).equals(want));
      const offset = Number(body.offset ?? 0), limit = Number(body.limit ?? 15);
      const page = hits.slice(offset, offset + limit);
      if (!hits.length) return [404, { error: 'not found' }];
      return [200, { total: hits.length, listed: page.length, list: listed(page) }];
    }
    if (p.startsWith('/mock/api/keymgmt/get/')) {
      if (scopeOf(req) !== 'keymgmt:get') return [403, { error: 'scope' }];
      const k = state.keys.find((x) => x.kid === p.split('/').pop());
      return k ? [200, { type: k.type, pubkey: k.pubkey, updated: k.updated }] : [404, { error: 'no such key' }];
    }
    if (p === '/mock/api/keymgmt/create' && method === 'POST') {
      if (scopeOf(req) !== 'keymgmt:gen') return [403, { error: 'scope' }];
      const kid = newKid();
      const type = ['PKEY', body.mode, body.type].filter(Boolean).join(',');
      state.keys.unshift({ kid, label: body.label, type, descr: body.descr ?? '', created: nowSecs(), updated: nowSecs(), pubkey: Buffer.from(kid.repeat(4).slice(0, 32), 'utf8').toString('base64') });
      return [200, { kid }];
    }
    if (p === '/mock/api/keymgmt/import' && method === 'POST') {
      if (scopeOf(req) !== 'keymgmt:imp') return [403, { error: 'scope' }];
      const kid = newKid();
      state.keys.unshift({ kid, label: body.label, type: [body.mode, body.type].filter(Boolean).join(','), descr: body.descr ?? '', created: nowSecs(), updated: nowSecs(), pubkey: body.pubkey });
      return [200, { kid }];
    }
    if (p === '/mock/api/keymgmt/update' && method === 'POST') {
      if (scopeOf(req) !== 'keymgmt:upd') return [403, { error: 'scope' }];
      const k = state.keys.find((x) => x.kid === body.kid);
      if (!k) return [404, { error: 'no such key' }];
      k.label = body.label ?? k.label;
      if (body.descr !== undefined) k.descr = body.descr;
      k.updated = nowSecs();
      return [200, { updated: true }];
    }
    if (p.startsWith('/mock/api/keymgmt/delete/') && method === 'DELETE') {
      if (scopeOf(req) !== 'keymgmt:del') return [403, { error: 'scope' }];
      const kid = p.split('/').pop();
      const before = state.keys.length;
      state.keys = state.keys.filter((k) => k.kid !== kid);
      return before === state.keys.length ? [404, { error: 'no such key' }] : [200, { deleted: kid }];
    }
    // ---- the audit log ------------------------------------------------------------------
    if (p === '/mock/api/logger/key') {
      if (scopeOf(req) !== 'logger:get') return [403, { error: 'scope' }];
      const { key, nonce, nonce_signed } = state.logger;
      return [200, { key, nonce, nonce_signed }];
    }
    if (p.startsWith('/mock/api/logger/list')) {
      if (scopeOf(req) !== 'logger:get') return [403, { error: 'scope' }];
      const offset = Number(p.split('/')[5] ?? 0);
      const page = state.logger.files.slice(offset, offset + 120);
      return [200, { id: page.map((f) => f.id), total: state.logger.files.length, listed: page.length }];
    }
    if (p.startsWith('/mock/api/logger/')) {
      if (scopeOf(req) !== 'logger:get') return [403, { error: 'scope' }];
      const file = state.logger.files.find((f) => f.id === p.split('/').pop());
      if (!file) return [404, { error: 'no such log file' }];
      if (file.open) return [406, { error: 'log file still open' }];
      return [200, file.text, 'text/plain; charset=utf-8'];
    }
    // ---- broker -----------------------------------------------------------------------
    if (p === '/mockbroker/checkin') return [200, { checked: 'ok' }];
    if (p === '/mockbroker/notify/session' && method === 'GET') return [200, { epk: 'EPK-anon' }];
    if (p === '/mockbroker/notify/session' && method === 'POST') return [200, { epk: 'EPK-' + body.eid, paired: state.subscribers.length > 0 }];
    if (p === '/mockbroker/notify/register/init') {
      const rid = 'RID' + Date.now();
      state.pairings[rid] = { pid: b64(crypto.getRandomValues(new Uint8Array(12))), polls: 0 };
      return [200, { rid, link: `https://api.encedo.com/notify/register/${rid}` }];
    }
    if (p.startsWith('/mockbroker/notify/register/check/')) {
      const pairing = state.pairings[p.split('/').pop()];
      if (!pairing) return [404, { error: 'no such registration' }];
      if (++pairing.polls < approveAfter) return [202, null];
      return [200, { pid: pairing.pid, reply: 'REPLY-' + pairing.pid }];
    }
    if (p.startsWith('/mockbroker/notify/register/finalise/')) {
      const rid = p.split('/').pop();
      const pairing = state.pairings[rid];
      if (!pairing || body.confirmation !== 'CONF-' + pairing.pid) return [400, { error: 'the confirmation does not verify' }];
      state.subscribers.push({ pid: pairing.pid });
      delete state.pairings[rid];
      return [200, { paired: true, pid: pairing.pid }];
    }
    if (p === '/mockbroker/notify/event/new') {
      const id = 'EV' + Date.now() + Math.random().toString(36).slice(2, 6);
      state.polls[id] = { n: 0, scope: body.scope ?? 'system:config' };
      return [200, { eventid: id }];
    }
    if (p.startsWith('/mockbroker/notify/event/check/')) {
      const ev = state.polls[p.split('/').pop()];
      if (!ev) return [404, { error: 'no such event' }];
      if (++ev.n < approveAfter) return [202, null];
      return [200, { authreply: 'mock-reply:' + ev.scope }];
    }
    if (p.startsWith('/mockbroker/notify/event/') && method === 'DELETE') return [200, { deleted: true }];
    if (p === '/mockbroker/notify/subscribers/list') return [200, state.subscribers];
    if (p === '/mockbroker/notify/subscribers/delete') {
      const before = state.subscribers.length;
      state.subscribers = state.subscribers.filter((s) => s.pid !== body.pid);
      return before === state.subscribers.length ? [404, { error: 'not a subscriber' }] : [200, { deleted: body.pid }];
    }
    if (p === '/mockbroker/share/emailpubkey') return [200, { sent: true, to: body.email }];
    if (p.startsWith('/mockbroker/domain/check/')) {
      const prefix = decodeURIComponent(p.split('/').pop());
      return ['my', 'ann', 'demo'].includes(prefix) ? [200, { taken: true }] : [404, { error: 'free' }];
    }
    if (p.startsWith('/mockbroker/download/')) {
      // An image: a few KB of bytes with a header, so a page has something to upload.
      const kind = p.split('/')[3];
      const size = kind === 'firmware' ? 24 * 1024 : 12 * 1024;
      const image = Buffer.alloc(size, 0x5a);
      image.write(`ENCEDO ${kind.toUpperCase()} ${kind === 'firmware' ? NEW_FIRMWARE : NEW_MANAGER}`, 0, 'latin1');
      return [200, image, 'application/octet-stream'];
    }
    if (p === '/mockbroker/domain/predefs') return [200, { prefix: NAMES }];
    if (p.startsWith('/mockbroker/domain/register/')) {
      const tail = decodeURIComponent(p.split('/').pop());
      if (method === 'GET') {
        const job = state.domainJobs[tail];
        if (!job) return [404, { error: 'no such registration' }];
        const n = ++job.polls;
        if (n === 1) return [200, { status: 'pending' }];
        if (n === 2) return [200, { status: 'email_confirmed' }];
        state.pendingHostname = `${job.prefix}.ence.do`;
        return [200, { status: 'done', emp: 'EMP', key: 'KEY', crt: 'CRT', prefix: job.prefix }];
      }
      // A name of the owner's own comes with a CSR and is confirmed by e-mail first.
      if (body?.csr && !NAMES.includes(tail)) {
        const id = 'JOB-' + tail;
        state.domainJobs[id] = { prefix: tail, polls: 0 };
        return [201, { id }];
      }
      state.pendingHostname = `${tail}.ence.do`;
      return [200, { emp: 'EMP', key: 'KEY', crt: 'CRT', prefix: tail }];
    }
    if (p.startsWith('/mock')) return [404, { error: 'not mocked: ' + method + ' ' + p }];
    return null;
  };
}

async function derivePub(password, salt) {
  const enc = new TextEncoder();
  const passKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const seed = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 600_000, hash: 'SHA-256' }, passKey, 256));
  const prefix = new Uint8Array([0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x6e, 0x04, 0x22, 0x04, 0x20]);
  const pkcs8 = new Uint8Array(prefix.length + 32); pkcs8.set(prefix); pkcs8.set(seed, prefix.length);
  const priv = await crypto.subtle.importKey('pkcs8', pkcs8, 'X25519', false, ['deriveBits']);
  const base = new Uint8Array(32); base[0] = 9;
  const basePub = await crypto.subtle.importKey('raw', base, 'X25519', false, []);
  return b64(new Uint8Array(await crypto.subtle.deriveBits({ name: 'X25519', public: basePub }, priv, 256)));
}

// ---- server ------------------------------------------------------------------------------
export async function createServer(opts = {}) {
  const mock = await createMock(opts);
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'content-type, authorization' };
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
    const chunks = []; for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks);
    const body = raw.length && (req.headers['content-type'] ?? '').includes('json') ? JSON.parse(raw.toString()) : null;
    try {
      const hit = await mock(req.method, url.pathname, body, req, raw);
      if (hit) {
        const [status, data, type] = hit;      // a log file comes back as text, not JSON
        res.writeHead(status, { ...cors, 'Content-Type': type ?? 'application/json' });
        return res.end(data === null ? '' : Buffer.isBuffer(data) ? data : type ? String(data) : JSON.stringify(data));
      }
    } catch (e) {
      res.writeHead(500, { ...cors, 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: e.message }));
    }
    // static
    let file = path.normalize(path.join(ROOT, decodeURIComponent(url.pathname)));
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    try {
      if ((await fs.stat(file)).isDirectory()) file = path.join(file, 'index.html');
      const data = await fs.readFile(file);
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(data);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('not found');
    }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const port = Number(process.argv[2] ?? 8080);
  const server = await createServer();
  server.listen(port, '127.0.0.1', () => {
    console.log(`Encedo HEM Manager dev server`);
    console.log(`  real module:  http://localhost:${port}/`);
    console.log(`  mock module:  http://localhost:${port}/?hem=http://localhost:${port}/mock&broker=http://localhost:${port}/mockbroker   (password: demo)`);
    console.log(`  master words: ${MASTER_WORDS}`);
  });
}
