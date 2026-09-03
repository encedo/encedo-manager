// Dev server: the repo as static files, plus a mock module and a mock broker
// for working on the Manager without a PPA on the desk.
//
//   node v2/dev/serve.mjs [port]
//
//   http://localhost:8080/v2/                                  → the real module at https://my.ence.do
//   http://localhost:8080/v2/?hem=http://localhost:8080/mock&broker=http://localhost:8080/mockbroker
//                                                              → the mock (password: demo)
//
// The mock speaks the wire format the SDK expects, verifies the eJWT the
// browser signs (so the password really is checked), keeps drive state, pairs
// one phone, and approves a phone request after a few polls.

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.map': 'application/json', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };

// ---- mock state --------------------------------------------------------------------------
const b64 = (bytes) => Buffer.from(bytes).toString('base64');
const b64url = (bytes) => Buffer.from(bytes).toString('base64url');
const fromB64 = (s) => new Uint8Array(Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64'));
const jwt = (payload) => `${b64url(Buffer.from('{"alg":"HS256"}'))}.${b64url(Buffer.from(JSON.stringify(payload)))}.mock`;
const jwtPayload = (t) => { try { return JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString()); } catch { return null; } };

export async function createMock({ password = 'demo', eid = 'mock-eid-0001', approveAfter = 3 } = {}) {
  const devKeys = await crypto.subtle.generateKey({ name: 'X25519' }, true, ['deriveBits']);
  const spk = b64(new Uint8Array(await crypto.subtle.exportKey('raw', devKeys.publicKey)));
  // The public key a correct password derives (PBKDF2-SHA256, 600k, salt = eid), so a wrong one gets a 401.
  const expectedPub = await derivePub(password, eid);
  const state = {
    storage: ['125829120:-', '16777216:-'],   // 60 GB, 8 GB, both locked
    paired: true,
    polls: {},
    uptime: 3 * 86400 + 5 * 3600 + 12 * 60,
  };

  async function verifyEjwt(ejwt) {
    const [h, p, sig] = ejwt.split('.');
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString());
    const userPub = await crypto.subtle.importKey('raw', fromB64(payload.iss), 'X25519', false, []);
    const shared = await crypto.subtle.deriveBits({ name: 'X25519', public: userPub }, devKeys.privateKey, 256);
    const key = await crypto.subtle.importKey('raw', shared, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('HMAC', key, fromB64(sig), Buffer.from(`${h}.${p}`));
    return { ok: ok && payload.iss === expectedPub, payload };
  }

  const scopeOf = (req) => jwtPayload((req.headers.authorization ?? '').replace(/^Bearer /, ''))?.scope ?? '';

  /** Returns [status, body] or null when the path is not a mock path. */
  return async function mock(method, p, body, req) {
    // ---- device -----------------------------------------------------------------------
    if (p === '/mock/api/system/version') return [200, { hwv: 'ENCEDO PPA rev C', blv: '1.3.0', fwv: '2.4.1', fws: 'mock', conf: 'PPA' }];
    if (p === '/mock/api/system/status') return [200, { hostname: 'my.ence.do', https: 1, fls_state: 0, uptime: state.uptime++, time: Math.floor(Date.now() / 1000), storage: state.storage }];
    if (p === '/mock/api/system/checkin' && method === 'GET') return [200, { check: 'mock-check' }];
    if (p === '/mock/api/system/checkin' && method === 'POST') return [200, { status: 'ok', newfws: 'v2.5.0+mock', newuis: null }];
    if (p === '/mock/api/system/config' && method === 'GET') return [200, { eid, user: 'Ann', email: 'ann@example.com', hostname: 'my.ence.do', devid: 'PPA-0001' }];
    if (p === '/mock/api/system/config' && method === 'POST') return [200, { updated: true }];
    if (p === '/mock/api/auth/token' && method === 'GET') return [200, { eid, spk, jti: 'jti-' + Date.now() }];
    if (p === '/mock/api/auth/token' && method === 'POST') {
      const { ok, payload } = await verifyEjwt(body.auth);
      if (!ok) return [401, { error: 'authentication failed' }];
      return [200, { token: jwt({ scope: payload.scope, exp: payload.exp, sub: 'user' }) }];
    }
    if (p === '/mock/api/auth/ext/request') return [200, { challenge: 'mock', epk: body.epk, scope: body.scope }];
    if (p === '/mock/api/auth/ext/token') return [200, { token: jwt({ scope: 'system:config', exp: Math.floor(Date.now() / 1000) + 300, sub: 'phone' }) }];
    if (p === '/mock/api/auth/ext/mac') return [200, { nonce: 'N', mac: 'M', eid }];
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
    // ---- broker -----------------------------------------------------------------------
    if (p === '/mockbroker/checkin') return [200, { checked: 'ok' }];
    if (p === '/mockbroker/notify/session' && method === 'GET') return [200, { epk: 'EPK-anon' }];
    if (p === '/mockbroker/notify/session' && method === 'POST') return [200, { epk: 'EPK-' + body.eid, paired: state.paired }];
    if (p === '/mockbroker/notify/event/new') { const id = 'EV' + Date.now(); state.polls[id] = 0; return [200, { eventid: id }]; }
    if (p.startsWith('/mockbroker/notify/event/check/')) {
      const id = p.split('/').pop();
      if (++state.polls[id] < approveAfter) return [202, null];
      return [200, { authreply: 'mock-reply' }];
    }
    if (p.startsWith('/mockbroker/notify/event/') && method === 'DELETE') return [200, { deleted: true }];
    if (p === '/mockbroker/notify/subscribers/list') return [200, [{ pid: 'PID-mock-1', label: "Ann's phone" }]];
    if (p === '/mockbroker/notify/subscribers/delete') return [200, { deleted: body.pid }];
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
      const hit = await mock(req.method, url.pathname, body, req);
      if (hit) {
        const [status, data] = hit;
        res.writeHead(status, { ...cors, 'Content-Type': 'application/json' });
        return res.end(data === null ? '' : JSON.stringify(data));
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
    console.log(`Manager v2 dev server`);
    console.log(`  real module:  http://localhost:${port}/v2/`);
    console.log(`  mock module:  http://localhost:${port}/v2/?hem=http://localhost:${port}/mock&broker=http://localhost:${port}/mockbroker   (password: demo)`);
  });
}
