# Working in this repository

The [README](README.md) says what the Manager is and how to run, test, build
and release it — read it first and do not repeat it here. This file is the
things an agent has to be told: what must not change, what to check before
calling something done, and the facts about the device that have already cost
a day each.

## Ground rules

- **The SDK is a submodule, not a copy**, and other projects use the same
  repository. Anything the Manager needs from hem-sdk-js is changed in `sdk/`
  on `main` — it has one line and no branches — following [`sdk/CLAUDE.md`](sdk/CLAUDE.md): rebuild
  the browser bundle, update the typings, the docs and the tests in the same
  commit, and a breaking change goes in sdk/MIGRATION.md with it. Then push
  it there, and commit the moved pointer here. Never work
  around a missing SDK call in `app/`, and never leave a change sitting in
  `sdk/` uncommitted — `npm run pack` refuses to build a release from one.
  Whether the SDK is pushed is the owner's call; ask before pushing it.
- **`dist/` and `release/` are generated.** Edit the sources and run the build.
- **Nothing real from a device goes in.** No keys, no seeds, no logs off a
  module (`hem-logs/` is ignored for that reason), no customer data. The
  mock's mnemonic in `dev/serve.mjs` is a fixture and stays one.
- **Commits carry no assistant attribution.** No `Co-Authored-By` trailer.
- British spelling and the voice in [`design/STYLE.md`](design/STYLE.md), in
  the interface and in the comments.

## How the app is put together

- `app/session.js` holds the state of one module and every SDK call, and has
  **no DOM in it**. That is what lets the tests drive it in Node. Keep it that
  way: no `document`, no `window`.
- `app/pages/<screen>.js` draws a screen from `(session, view)`.
  `app/views/<screen>.js` decides what its buttons do and holds what it
  remembers. A page renders; a view acts. Neither reaches into the other's job.
- `app/main.js` is the wiring and stays small: a route is a line in `PAGES`.
- **Air-gapped is the default, not the exception.** Every backend call goes
  through `hem.broker` and can throw `broker_error`; a screen has to say so and
  carry on with what the module alone can do.

## Before saying it works

```bash
npm test                          # 60-odd session and QR tests, no browser
npm run smoke -- <out-dir>        # every screen in headless Chromium
npm run build && npm run smoke:dist -- <out-dir>   # when the build changed
```

The smoke is the real check for anything in `app/`: it signs in, drives each
screen, personalises a module from the box and installs a firmware update. It
fails on a console error, so a stray exception does not slip through.

## Facts about the device that bite

- A paired phone is a key in the keychain whose **description read as base64**
  is `RVhUQUlE` + the pid, and the pid is itself base64. Decoding the bytes as
  text gives nonsense that matches nothing the broker says.
- A key's description is a **byte field**, not text. Show it as base64 or hex,
  never through a text decoder.
- A module out of the box carries **`inited`** in `/api/system/status`; a
  personalised one never does. That is the only signal.
- `check_fw` and `check_ui` answer **201 or 202 while the module is still
  verifying** an uploaded image. The SDK's `waitFirmwareCheck` / `waitUiCheck`
  poll them.
- The module refuses the **log file it is writing** with a 406. That is a
  state, not a failure.
- A release's version is the hash of the **manifest**, not of the tar — see
  [`docs/PACKAGING.md`](docs/PACKAGING.md).

## Where to write things down

- [`docs/STATUS.md`](docs/STATUS.md) — update it when a screen lands or a gap
  against Manager 1 closes.
- [`docs/SDK-MAPPING.md`](docs/SDK-MAPPING.md) — every Manager 1 call, its
  endpoint and the SDK method that covers it; mark one covered when it is.
- [`docs/PACKAGING.md`](docs/PACKAGING.md) — the release format and the open
  questions for the firmware side.
