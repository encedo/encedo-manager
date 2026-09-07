# Encedo HEM Manager 2.0

The Manager rebuilt on [hem-sdk-js](../sdk): ES modules, no bundler, served as
static files by the module itself or by any web server. Screens follow the
design canvas in [`design/v2`](../design/v2) and the encedo web style.

## Run it

```bash
node v2/dev/serve.mjs            # http://localhost:8080/v2/
```

Served from a laptop, the Manager talks to the module at `https://my.ence.do`
(the module allows cross-origin calls). Another address: `?hem=https://192.168.7.1`,
remembered by the browser until `?hem=` clears it. Served by the module, it
talks to its own origin.

Without a module on the desk, the dev server also runs a mock of the device
and the broker (password `demo`, one paired phone, two drives, six keys in the
keychain, a firmware update announced; wiping it from Settings gives a module
out of the box, to personalise again):

```
http://localhost:8080/v2/?hem=http://localhost:8080/mock&broker=http://localhost:8080/mockbroker
```

## Test it

```bash
node --test v2/dev/session.test.mjs v2/dev/qr.test.mjs
```

The session logic has no DOM in it and runs against the mock: reaching the
module, check-in with and without the broker, password and phone sign-in,
drive lock and unlock, and the keychain — paging, search, sorting, create,
import, rename, delete and share codes. The QR encoder is checked module for
module against [segno](https://segno.readthedocs.io/), whose matrices are
pinned as hashes so the check needs nothing installed.

The log parser is pinned to lines taken off a real PPA (`Encedo nGINE FW v1.2.2`),
which is also what corrected it: the module writes an mbedTLS error code where a
string was expected, a slice of an HTTP header where a log id was, and logs a key
integrity *check* whose result says how it went. `dev/fetch-logs.mjs` archives a
module's files so a change can be tried against real ones:

```bash
node v2/dev/fetch-logs.mjs --out ~/hem-logs      # asks for the password, verifies each file
```

The page itself is driven in a real browser by

```bash
node v2/dev/smoke.mjs <out-dir>          # needs a chromium binary
```

which signs in, unlocks and locks a drive, searches the keychain, opens a key,
creates one and deletes it again, and leaves a screenshot of each screen.

## Layout

| Path | Role |
| --- | --- |
| `index.html` | Shell; loads `app/main.js` as a module |
| `app/config.js` | Where the module and the broker are |
| `app/session.js` | State of one module and every SDK call, DOM-free |
| `app/router.js` | Hash routes, menu order |
| `app/ui.js` | DOM helpers, icons, the mark |
| `app/pages/*.js` | One module per screen; unbuilt screens say so |
| `app/qr.js` | QR encoder, so a share code can reach a phone with the module air-gapped |
| `app/pdf.js` | PDF writer, for the Proof of Personalisation — text in the standard fonts, nothing embedded |
| `app/logfile.js` | Reading an audit-log file: the module's event table, one entry per line |
| `app/table.js` | Paging, shared by the pages that show lists |
| `app/style.css` | Tokens and components from the encedo web kit |
| `dev/serve.mjs` | Dev server with the mock module and broker |
| `dev/session.test.mjs` | Tests for the session logic |
| `dev/qr.test.mjs` | The QR encoder against vectors from an independent one |
| `dev/fetch-logs.mjs` | Archive every audit-log file off a real module, verified |
| `dev/probe.mjs` | What a real module answers with, so a page is built against it |

## Built so far

- Personalisation: a module out of the box (its status carries `inited`) is
  taken through the steps v1 took it through — who it belongs to and a
  password, a name under ence.do (one the broker hands out, or one of your own,
  confirmed by e-mail), how the drives are laid out, what it takes on faith —
  then the module is initialised with 24 words made in the browser as the
  master key, its drive formatted, the certificate installed, and the words
  shown once with a Proof of Personalisation to print or download. The PDF is
  written by `app/pdf.js`, a small writer of its own, so nothing is fetched.
  A failure wipes the module back to how it came. Air-gapped, it keeps
  my.ence.do and the certificate can be fetched later from Settings.

- Sign-in: waiting for the module, air-gapped notice, password, phone request with cancel.
- Overview: module, firmware and update flag, backend, drives, paired phones, uptime.
- Secure drive: unlock read-only or read-write, lock.
- Settings: who the module belongs to, the three things it can be told to take
  on faith (each with what saying yes costs), a password change that never sends
  the password, the 24 words as an alternative authorisation, a name under
  ence.do with its certificate, and a wipe that has to be typed out.
- Hardware: what the module is, what signed the firmware and bootloader it runs,
  its temperature while the page is open, its own health check, the scopes this
  browser can still use without asking again, and a reboot that asks twice.
- Operation log: the files the module wrote, the logger key checked against the
  nonce the module signs on the spot, then any file downloaded and its HMAC chain
  replayed in the browser — entry by entry, saying which one fails and why. Every
  entry is read into words from the module's event table.
- Paired phones: every phone the module knows, read out of the keychain (its
  key carries `EXTAID` + pid) and checked against the broker's list, so a phone
  in one place only is shown as such rather than hidden. Pairing puts the exact
  JSON the Encedo Mobile Authenticator scans into a QR code drawn here, with the
  seconds left, and waits for the phone; unpairing takes both halves, or the key
  alone while air-gapped, and says which it did.
- Keychain: the whole repository, sorted by any column, searched, and paged ten
  (or 25, 50, all) at a time; a key opens under its own row and shows its public
  key, its description as the bytes it is, rename, delete, and a share code with
  a QR code for a phone to scan. Create a key pair, import a public key or read
  one out of a pasted share code.

Software is drawn in the canvas and stubbed in the menu.
