// Build the Manager for the module: dist/ with four files, each with a .gz
// twin. The PPA answers GET /x with x.gz and a Content-Encoding header when
// the twin is there, and with x itself when it is not, so both are written.
//
//   node v2/build.mjs            -> v2/dist/
//
// Rollup folds app/main.js and everything it imports — the SDK included — into
// one ES module; nothing is minified, gzip does the work and a stack trace out
// of the module stays readable. The sources are untouched: the dev server and
// the tests keep running on the loose modules.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(process.argv[2] ?? path.join(here, 'dist'));
await fs.rm(out, { recursive: true, force: true });
await fs.mkdir(out, { recursive: true });

// 1. the script: one module out of the graph
const bundle = path.join(out, 'app.js');
const rollup = spawnSync('npx', ['rollup', path.join(here, 'app/main.js'), '--format', 'es', '--file', bundle, '--silent'], { stdio: 'inherit' });
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
