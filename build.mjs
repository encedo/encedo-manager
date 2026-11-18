// Build the Manager for the module: dist/ with four files, each with a .gz
// twin. The PPA answers GET /x with x.gz and a Content-Encoding header when
// the twin is there, and with x itself when it is not, so both are written.
//
//   node build.mjs                      -> dist/
//   node build.mjs <dir> --no-minify    readable app.js / style.css, for a stack trace
//
// Rollup folds app/main.js and everything it imports — the SDK included — into
// one ES module; esbuild then minifies it and style.css - less to store on the
// module and to send, gzip on top. The sources are untouched: the dev server
// and the tests keep running on the loose modules.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

// Pinned, so a release built on a runner is the release built on a desk.
// Bump it deliberately; nothing else here has a version to track.
const ROLLUP = 'rollup@4.63.1';
const ESBUILD = 'esbuild@0.28.2';

const here = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const minify = !argv.includes('--no-minify');
const out = path.resolve(argv.find((a) => !a.startsWith('--')) ?? path.join(here, 'dist'));
await fs.rm(out, { recursive: true, force: true });
await fs.mkdir(out, { recursive: true });

// The SDK is a submodule and is bundled in; without it there is nothing to
// build, and rollup's own message for that is not a helpful one.
try {
  await fs.access(path.join(here, 'sdk/hem-sdk.browser.js'));
} catch {
  console.error('sdk/hem-sdk.browser.js is missing — the SDK submodule is not checked out.\n' +
                '  git submodule update --init\n' +
                '  git -C sdk checkout main');
  process.exit(1);
}

// 1. the script: one module out of the graph
const bundle = path.join(out, 'app.js');
// On Windows npx is npx.cmd, which Node starts only through a shell - and the shell needs the paths quoted.
const win = process.platform === 'win32';
const q = (arg) => (win ? `"${arg}"` : arg);
const rollup = spawnSync('npx', ['--yes', ROLLUP, q(path.join(here, 'app/main.js')), '--format', 'es', '--file', q(bundle), '--silent'], { stdio: 'inherit', shell: win });
if (rollup.status !== 0) { console.error('rollup failed'); process.exit(rollup.status ?? 1); }
let js = await fs.readFile(bundle, 'utf8');
// The SDK's Node transport imports node:* lazily, in a branch a browser never
// takes; the module's server has no such files, so a static import would break
// the page — a dynamic one is only a promise nobody awaits. Say so if it changes.
if (/^import .*node:/m.test(js)) { console.error('the bundle imports a node: module statically'); process.exit(1); }
await fs.writeFile(bundle, js);

// 2. the rest, with the paths flattened
const html = (await fs.readFile(path.join(here, 'index.html'), 'utf8'))
  .replace('./app/style.css', './style.css')
  .replace('./app/main.js', './app.js');
await fs.writeFile(path.join(out, 'index.html'), html);
await fs.copyFile(path.join(here, 'app/style.css'), path.join(out, 'style.css'));
await fs.copyFile(path.join(here, 'favicon.svg'), path.join(out, 'favicon.svg'));

// 2b. minified in place - esbuild without bundling, so app.js stays the ES module rollup wrote
if (minify) {
  for (const name of ['app.js', 'style.css']) {
    const file = path.join(out, name);
    const args = ['--yes', ESBUILD, q(file), '--minify', `--outfile=${q(file)}`, '--allow-overwrite', '--log-level=warning'];
    if (name.endsWith('.js')) args.push('--format=esm');
    const r = spawnSync('npx', args, { stdio: 'inherit', shell: win });
    if (r.status !== 0) { console.error(`esbuild failed on ${name}`); process.exit(r.status ?? 1); }
  }
  if (/^import .*node:/m.test(await fs.readFile(bundle, 'utf8'))) { console.error('the minified bundle imports a node: module statically'); process.exit(1); }
}

// 3. the .gz twins, each read back to be sure it is the same bytes
const rows = [];
for (const name of ['index.html', 'app.js', 'style.css', 'favicon.svg']) {
  const file = path.join(out, name);
  const bytes = await fs.readFile(file);
  const gz = gzipSync(bytes, { level: 9 });
  if (!gunzipSync(gz).equals(bytes)) { console.error(`${name}.gz does not round-trip`); process.exit(1); }
  await fs.writeFile(`${file}.gz`, gz);
  rows.push([name, bytes.length, gz.length]);
}

const kb = (n) => `${(n / 1024).toFixed(1).padStart(6)} KB`;
console.log(`built ${path.relative(process.cwd(), out)}/`);
for (const [name, raw, gz] of rows) console.log(`  ${name.padEnd(12)} ${kb(raw)}  gz ${kb(gz)}`);
console.log(`  ${'total'.padEnd(12)} ${kb(rows.reduce((s, r) => s + r[1], 0))}  gz ${kb(rows.reduce((s, r) => s + r[2], 0))}`);
