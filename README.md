# Encedo HEM Manager

The web Manager built into the Encedo PPA: it personalises a module out of the
box, opens it with a password, the paired phone or the 24 words, and then runs
the keychain, the secure drive, the audit log, the hardware and the software on
it. Static ES modules on [hem-sdk-js](https://github.com/encedo/hem-sdk-js),
served by the module itself, with no framework and no build step in
development.

Keys are derived in the browser and the module only ever sees a signed
challenge. Everything works air-gapped; the Encedo backend is needed for
phone sign-in, pairing, a name under `ence.do` and software downloads, and the
pages say so when it cannot be reached.

## Run it

```bash
node dev/serve.mjs               # http://localhost:8080/
```

Served from a laptop, the Manager talks to the module at `https://my.ence.do`
(the module allows cross-origin calls). Another address: `?hem=https://192.168.7.1`,
remembered by the browser until `?hem=` clears it. Served by the module, it
talks to its own origin and needs no query string at all.

Without a module on the desk, the dev server also runs a mock of the device and
the broker — password `demo`, one paired phone, two drives, fourteen keys, a
firmware and a Manager update announced. Wiping it from Settings leaves a module
out of the box, to personalise again:

```
http://localhost:8080/?hem=http://localhost:8080/mock&broker=http://localhost:8080/mockbroker
```

## Test it

```bash
npm test                         # node --test dev/session.test.mjs dev/qr.test.mjs
npm run smoke -- <out-dir>       # the real page in headless Chromium
```

The session logic has no DOM in it and runs against the mock: reaching the
module, check-in with and without the broker, the three ways of signing in,
drives, the keychain, the operation log, pairing and unpairing a phone,
personalising a module from the box, and the software updates. The QR encoder is
checked module for module against [segno](https://segno.readthedocs.io/), whose
matrices are pinned as hashes so the check needs nothing installed. The log
parser is pinned to lines taken off a real PPA (`Encedo nGINE FW v1.2.2`), which
is also what corrected it: the module writes an mbedTLS error code where a
string was expected, a slice of an HTTP header where a log id was, and logs a
key integrity *check* whose result says how it went.

The browser smoke drives every screen in order and leaves a screenshot of each:
sign-in, the drive, the keychain, the log, the phones, the hardware, the
settings, a wipe and a personalisation from the box, and a firmware update with
the reboot after it.

Against a module on the desk:

```bash
node dev/probe.mjs                               # what it answers with
node dev/fetch-logs.mjs --out ~/hem-logs         # archive its audit log, each file verified
```

## Put it on a module

```bash
npm run build                    # -> dist/
```

Four files — `index.html`, `app.js`, `style.css`, `favicon.svg` — and a `.gz`
twin of each, about 100 KB compressed. Rollup folds `app/main.js` and everything
it imports, the SDK included, into the one `app.js`; nothing is minified, gzip
does the work and a stack trace out of the module stays readable. The module
answers `GET /x` with `x.gz` and a `Content-Encoding` header when the twin is
there and with `x` when it is not, so both go on it.

The sources stay loose modules for the dev server and the tests, and the same
smoke runs against the bundle:

```bash
npm run smoke:dist -- <out-dir>
```

## Release it

```bash
npm run pack                     # -> release/<HHMMSS_DDMMYYYY>/
```

A release is a `webroot/` (the built files with their `.gz` twins), a
`manifest` of everything in it, and `webroot_src.tar` of the lot, with the
tar's SHA-256 beside it. Two packs of the same tree produce the same bytes and
so the same version, which is the base64 of the SHA-256 of the manifest —
the string the backend files the release under and a module asks for by name.

The tar is signed by hand: a release engineer signs that SHA-256 with the
release key and appends the trailer.

```bash
node pack.mjs attach release/*/webroot_src.tar --key <pub> --signature <sig>
node pack.mjs verify release/*/webroot.tar --key <pub>
```

[`.github/workflows/release.yml`](.github/workflows/release.yml) does the
build and the pack on a published release and attaches the unsigned tar and
its digest; the signed `webroot.tar` is uploaded to the same release
afterwards. [`docs/PACKAGING.md`](docs/PACKAGING.md) has the format, what the
module checks, and what is still to settle with the firmware side.

## Layout

| Path | Role |
| --- | --- |
| `index.html` | Shell; loads `app/main.js` as a module |
| `app/main.js` | Bootstrap: the session, the routes, the wiring between pages and views |
| `app/session.js` | State of one module and every SDK call, DOM-free |
| `app/shell.js` | The frame a signed-in page is drawn in, and the modals over it |
| `app/config.js` | Where the module and the broker are |
| `app/router.js` | Hash routes, menu order |
| `app/ui.js` | DOM helpers, icons, the mark |
| `app/table.js` | Paging, shared by the pages that show lists |
| `app/pages/*.js` | One module per screen: what it looks like, given a session and a view |
| `app/views/*.js` | One module per screen: what its buttons do, and what it remembers |
| `app/qr.js` | QR encoder, so a share code reaches a phone with the module air-gapped |
| `app/pdf.js` | PDF writer, for the Proof of Personalisation — standard fonts, nothing embedded |
| `app/logfile.js` | Reading an audit-log file: the module's event table, one entry per line |
| `app/style.css` | Tokens and components from the encedo web kit |
| `app/version.js` | The version the mastheads show |
| `build.mjs` | Makes `dist/` for the module |
| `pack.mjs` | Makes a release out of it: webroot, manifest, tar; attaches and checks a signature |
| `dev/serve.mjs` | Dev server, with the mock module and broker in it |
| `dev/session.test.mjs` | Tests for the session logic |
| `dev/qr.test.mjs` | The QR encoder against vectors from an independent one |
| `dev/smoke.mjs` | The real page in headless Chromium, screen by screen |
| `dev/probe.mjs` | What a real module answers with, so a page is built against it |
| `dev/fetch-logs.mjs` | Archive every audit-log file off a real module, verified |
| `sdk/` | Submodule: [`encedo/hem-sdk-js`](https://github.com/encedo/hem-sdk-js), branch `manager-v2` |
| `design/` | The product style, and the screen mockups as design-canvas artboards |
| `docs/` | Where the Manager stands, how Manager 1 maps onto the SDK, how a release is packed |
| `CLAUDE.md` | The house rules, for an agent working here |

Clone it with the SDK, or fetch the SDK afterwards:

```bash
git clone --recurse-submodules git@github.com:encedo/encedo-manager.git
git submodule update --init          # in a clone that already exists
```

## Branches

| Branch | What it is |
| --- | --- |
| `main` | The Manager, version 2.x — this code |
| `v1` | Manager 1.3, archived as it was: one `index.html`, `assets/`, `src/`, `build.sh` |

## Also here

- [`docs/STATUS.md`](docs/STATUS.md) — what is built, what Manager 1 had that
  this does not, and what comes next.
- [`docs/SDK-MAPPING.md`](docs/SDK-MAPPING.md) — every Manager 1 call against
  the device, the endpoint behind it and the SDK method that covers it.
- [`docs/PACKAGING.md`](docs/PACKAGING.md) — the release format the module
  takes, and how a release is signed.
- [`design/STYLE.md`](design/STYLE.md) — the product style: the palette, the
  voice, and what changes for the phone app.
