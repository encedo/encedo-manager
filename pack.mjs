// Pack a release of the Manager the way the module expects it, and sign it.
//
//   node pack.mjs                      build, then release/<HHMMSS_DDMMYYYY>/
//   node pack.mjs --out release/x      somewhere of your choosing
//   node pack.mjs sign <tar> --key-env <VAR> [--expect <pub>]   sign with the seed in $VAR (the CI)
//   node pack.mjs digest <tar> --key <pub>                       what to sign by hand
//   node pack.mjs attach <tar> --key <file> --signature <file>   append a signature made by hand
//   node pack.mjs verify <webroot.tar> [--key <expected>]
//
// A release is a `webroot/` — what the module serves, every file with a `.gz`
// twin beside it — a `manifest` of everything in it, and a tar of the lot.
// docs/PACKAGING.md says what each piece is for and how the module reads it.
//
// The signature is Ed25519 over SHA-512(tar || public key) — what the firmware
// checks (ed25519_verify_file: the whole file but the last 64 bytes, hashed,
// then verified). The CI signs with the seed from a repository secret (`sign`);
// `digest` + `attach` are for a signature made elsewhere, by hand.

import { spawnSync } from 'node:child_process';
import { createHash, verify as verifySignature, sign as signMessage, createPublicKey, createPrivateKey } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KEY_BYTES = 32;         // Ed25519 public key
const SIG_BYTES = 64;         // Ed25519 signature
const TRAILER = KEY_BYTES + SIG_BYTES;

const argv = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const at = argv.indexOf(`--${name}`);
  return at >= 0 && argv[at + 1] ? argv[at + 1] : fallback;
};
const positional = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')));

const sha256 = (bytes) => createHash('sha256').update(bytes).digest();
/** What the signature covers: SHA-512 of the tar followed by the signer's public key (the firmware's ed25519_verify_file). */
const signedDigest = (tar, key) => createHash('sha512').update(tar).update(key).digest();
const b64url = (bytes) => bytes.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const kb = (n) => `${(n / 1024).toFixed(1).padStart(7)} KB`;
const die = (message) => { console.error(message); process.exit(1); };

const command = ['attach', 'verify', 'sign', 'digest'].includes(positional[0]) ? positional[0] : 'pack';
try {
  if (command === 'pack') await pack();
  if (command === 'sign') await sign(positional[1]);
  if (command === 'digest') await digestFor(positional[1]);
  if (command === 'attach') await attach(positional[1]);
  if (command === 'verify') await verify(positional[1]);
} catch (e) {
  die(e.message);
}

// -- pack ---------------------------------------------------------------------------------

async function pack() {
  checkSdk();
  const out = path.resolve(flag('out') ?? path.join(HERE, 'release', stamp()));
  const webroot = path.join(out, 'webroot');
  await fs.rm(out, { recursive: true, force: true });
  await fs.mkdir(webroot, { recursive: true });

  // 1. the files themselves, each with its .gz twin
  run(process.execPath, [path.join(HERE, 'build.mjs'), webroot], { stdio: 'inherit' });

  // 2. the manifest: sha256sum -b over everything, sorted so that two builds of
  //    the same tree produce the same file — and so the same version.
  const files = (await walk(webroot)).sort();
  const lines = [];
  let served = 0;
  for (const rel of files) {
    const bytes = await fs.readFile(path.join(webroot, rel));
    served += bytes.length;
    lines.push(`${sha256(bytes).toString('hex')} *./${rel}`);
  }
  const manifest = Buffer.from(lines.join('\n') + '\n');
  await fs.writeFile(path.join(webroot, 'manifest'), manifest);

  // 3. the tar, with nothing in it that varies between builds: no mtimes, no
  //    owners, entries in one order. GNU format, which is what the module
  //    has always been given.
  const names = (await fs.readdir(webroot)).sort();
  const tar = path.join(out, 'webroot_src.tar');
  //    (On Windows the GNU tar of Git reads "C:..." as host:path - --force-local says it is a file.)
  const local = process.platform === 'win32' ? ['--force-local'] : [];
  run('tar', [...local, '-cf', tar, '--format=gnu', '--sort=name', '--mtime=@0', '--owner=0', '--group=0', '--numeric-owner', ...names], { cwd: webroot });

  // 4. a fingerprint of the tar, and what the backend files the release under
  const tarBytes = await fs.readFile(tar);
  const digest = sha256(tarBytes);
  await fs.writeFile(`${tar}.sha256`, `${digest.toString('hex')} *${path.basename(tar)}\n`);
  const version = sha256(manifest);

  console.log(`\npacked ${path.relative(process.cwd(), out)}/`);
  console.log(`  webroot           ${files.length} files, ${kb(served)} served`);
  console.log(`  manifest          ${kb(manifest.length)}`);
  console.log(`  webroot_src.tar   ${kb(tarBytes.length)}`);
  console.log(`\n  version (base64)     ${version.toString('base64')}`);
  console.log(`  version (base64url)  ${b64url(version)}        <- download/dashboard/<this>`);
  console.log(`  tar SHA-256          ${digest.toString('hex')}`);
  console.log(`\nSign it: node pack.mjs sign ${path.relative(process.cwd(), tar)} --key-env <VAR> --expect <pub>`);
  console.log(`     or by hand: node pack.mjs digest ${path.relative(process.cwd(), tar)} --key <pub>, then attach`);
}

/**
 * The SDK is a repository of its own, shared with the other projects that use
 * it, and it is bundled into app.js. A release built from a working copy
 * nobody else can obtain is a release nobody can rebuild — so an uncommitted
 * change stops this, and a commit that is not on a remote is called out.
 * `--dirty-sdk` is for trying something, never for a release.
 */
function checkSdk() {
  const sdk = path.join(HERE, 'sdk');
  const git = (args) => spawnSync('git', ['-C', sdk, ...args], { encoding: 'utf8' });
  if (git(['rev-parse', '--git-dir']).status !== 0) die('sdk/ is not checked out: git submodule update --init');

  const dirty = (git(['status', '--porcelain']).stdout ?? '').trim();
  if (dirty && !argv.includes('--dirty-sdk')) {
    die(`sdk/ has changes that are not committed:\n${dirty}\n\n` +
        'Commit them in sdk/ and push them, then commit the submodule pointer here.\n' +
        'To pack anyway, for something that is not a release: --dirty-sdk');
  }

  const head = (git(['rev-parse', 'HEAD']).stdout ?? '').trim();
  const onRemote = (git(['branch', '-r', '--contains', 'HEAD']).stdout ?? '').trim();
  if (dirty) console.log(`! sdk/ is dirty and you said to pack anyway`);
  else if (onRemote) console.log(`  sdk ${head.slice(0, 8)} on ${onRemote.split('\n')[0].trim()}`);
  else console.log(`! sdk ${head.slice(0, 8)} is on no remote branch this clone knows of — push it, or nobody can rebuild this`);
}

/** A release directory is named the way the packaging CI has always named one. */
function stamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}_${p(d.getDate())}${p(d.getMonth() + 1)}${d.getFullYear()}`;
}

async function walk(dir, prefix = '') {
  const out = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...await walk(path.join(dir, entry.name), rel));
    else out.push(rel);
  }
  return out;
}

/**
 * Does this file carry a trailer? A tar is always a whole number of 512-byte
 * blocks; 96 more bytes never are, so the answer needs no guesswork.
 */
function isSigned(bytes) {
  return bytes.length > TRAILER && bytes.length % 512 !== 0;
}

// -- sign ---------------------------------------------------------------------------------

/**
 * Sign in the CI: the 32-byte Ed25519 seed comes from an environment variable
 * (a repository secret), as hex or base64, and never touches a file. `--expect`
 * names the public key the seed must give — a wrong secret stops here, not on
 * a module that refuses the bundle. The result goes through verify() before
 * this returns.
 */
async function sign(tarPath) {
  if (!tarPath) die('which tar? node pack.mjs sign <tar> --key-env <VAR> [--expect <pub>]');
  const varName = flag('key-env');
  if (!varName) die('--key-env <VAR>: the environment variable that holds the signing seed');
  const secret = (process.env[varName] ?? '').trim();
  if (!secret) die(`$${varName} is empty - is the secret set for this repository?`);
  let seed = null;
  for (const encoding of ['hex', 'base64']) {
    if (encoding === 'hex' && !/^[0-9a-fA-F]{64}$/.test(secret)) continue;
    const bytes = Buffer.from(secret, encoding);
    if (bytes.length === KEY_BYTES) { seed = bytes; break; }
  }
  if (!seed) die(`$${varName} is not a 32-byte Ed25519 seed as hex or base64`);

  const privateKey = createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), seed]), format: 'der', type: 'pkcs8' });
  seed.fill(0);
  const key = createPublicKey(privateKey).export({ format: 'der', type: 'spki' }).subarray(-KEY_BYTES);
  if (flag('expect')) {
    const want = await readBytes(flag('expect'), KEY_BYTES, 'expect');
    if (!want.equals(key)) die(`$${varName} gives the key ${key.toString('hex')}, not the one --expect names`);
  }

  const tar = await fs.readFile(tarPath);
  if (isSigned(tar)) die(`${tarPath} already carries a trailer — sign the unsigned tar`);
  const signature = signMessage(null, signedDigest(tar, key), privateKey);
  const out = flag('out') ?? path.join(path.dirname(tarPath), 'webroot.tar');
  await fs.writeFile(out, Buffer.concat([tar, key, signature]));
  console.log(`signed ${path.relative(process.cwd(), out)}`);
  console.log(`  signed by  ${key.toString('hex')}   (base64 ${key.toString('base64')})`);
  await verify(out, key);
}

// -- digest -------------------------------------------------------------------------------

/** What to sign by hand: SHA-512(tar || public key) - the signer's key is part of the message. */
async function digestFor(tarPath) {
  if (!tarPath) die('which tar? node pack.mjs digest <tar> --key <pub>');
  const tar = await fs.readFile(tarPath);
  if (isSigned(tar)) die(`${tarPath} already carries a trailer — use the unsigned tar`);
  const key = await readBytes(flag('key'), KEY_BYTES, 'key');
  console.log(`  sign these 64 bytes (Ed25519, as the message): ${signedDigest(tar, key).toString('hex')}`);
}

// -- attach -------------------------------------------------------------------------------

/**
 * Put the signature on the end: the 32-byte public key, then the 64-byte
 * signature of SHA-512(tar || public key). The result is checked before it is
 * written, so a wrong file or a signature over the wrong digest is caught here
 * rather than by a module that then refuses to install.
 */
async function attach(tarPath) {
  if (!tarPath) die('which tar? node pack.mjs attach <tar> --key <file> --signature <file>');
  const tar = await fs.readFile(tarPath);
  if (isSigned(tar)) die(`${tarPath} already carries a trailer — sign the unsigned tar`);
  const key = await readBytes(flag('key'), KEY_BYTES, 'key');
  const signature = await readBytes(flag('signature') ?? flag('sig'), SIG_BYTES, 'signature');

  const digest = signedDigest(tar, key);
  if (!ed25519Verify(key, signature, digest)) {
    die(`that signature does not check out over SHA-512(tar || key) (${digest.toString('hex')})`);
  }
  const out = flag('out') ?? path.join(path.dirname(tarPath), 'webroot.tar');
  await fs.writeFile(out, Buffer.concat([tar, key, signature]));
  console.log(`signed ${path.relative(process.cwd(), out)}`);
  console.log(`  signed by  ${key.toString('base64')}`);
  console.log(`  over       ${digest.toString('hex')}`);
}

// -- verify -------------------------------------------------------------------------------

/**
 * What a module does before it installs: take the trailer off, hash what is
 * left, check the signature over that. The key in the trailer says who signed;
 * it is not a reason to trust them, so `--key` compares it with the one you
 * expect - one of the publisher keys pinned in the firmware. (`uis` in
 * /api/system/version is not the key: it is the SHA-256 of the manifest, the version.)
 */
async function verify(file, expectedKey = null) {
  if (!file) die('which file? node pack.mjs verify <webroot.tar>');
  const bytes = await fs.readFile(file);
  if (!isSigned(bytes)) die(`${file} is ${bytes.length} bytes — too short to carry a signature`);
  const body = bytes.subarray(0, bytes.length - TRAILER);
  const key = bytes.subarray(bytes.length - TRAILER, bytes.length - SIG_BYTES);
  const signature = bytes.subarray(bytes.length - SIG_BYTES);
  const digest = signedDigest(body, key);

  console.log(`${path.relative(process.cwd(), file)}`);
  console.log(`  tar        ${kb(body.length)}`);
  console.log(`  SHA-512    ${digest.toString('hex')}   (tar || key)`);
  console.log(`  signed by  ${key.toString('hex')}`);
  const ok = ed25519Verify(key, signature, digest);
  console.log(`  signature  ${ok ? 'checks out over that digest' : 'DOES NOT check out'}`);

  const expected = expectedKey ?? flag('key');
  if (expected) {
    const want = Buffer.isBuffer(expected) ? expected : await readBytes(expected, KEY_BYTES, 'key');
    const same = want.equals(key);
    console.log(`  key        ${same ? 'is the one you expected' : 'IS NOT the one you expected'}`);
    if (!same) process.exitCode = 1;
  } else {
    console.log('  key        not checked against anything — pass --key to say whose signature you will accept');
  }
  if (!ok) process.exitCode = 1;
}


// -- odds and ends ------------------------------------------------------------------------

/** A key or a signature as raw bytes, hex or base64 — whatever the token wrote. */
async function readBytes(where, length, what) {
  if (!where) die(`--${what} <file>, or the bytes as hex or base64`);
  let raw;
  try { raw = await fs.readFile(where); } catch { raw = Buffer.from(where); }
  if (raw.length === length) return raw;
  const text = raw.toString('utf8').trim().replace(/\s+/g, '');
  for (const encoding of ['hex', 'base64']) {
    if (encoding === 'hex' && !/^[0-9a-fA-F]+$/.test(text)) continue;
    const bytes = Buffer.from(text, encoding);
    if (bytes.length === length) return bytes;
  }
  die(`the ${what} is not ${length} bytes, as raw bytes, hex or base64`);
}

function ed25519Verify(key, signature, message) {
  try {
    const spki = Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), key]);
    return verifySignature(null, message, createPublicKey({ key: spki, format: 'der', type: 'spki' }), signature);
  } catch {
    return false;
  }
}

function run(command, args, opts = {}) {
  const r = spawnSync(command, args, { stdio: 'inherit', ...opts });
  if (r.error) throw new Error(`${command}: ${r.error.message}`);
  if (r.status !== 0) throw new Error(`${command} exited with ${r.status}`);
}
