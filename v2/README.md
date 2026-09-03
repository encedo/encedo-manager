# Encedo HEM Manager v2

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
and the broker (password `demo`, one paired phone, drives, a firmware update
announced):

```
http://localhost:8080/v2/?hem=http://localhost:8080/mock&broker=http://localhost:8080/mockbroker
```

## Test it

```bash
node --test v2/dev/session.test.mjs
```

The session logic has no DOM in it and runs against the mock: reaching the
module, check-in with and without the broker, password and phone sign-in,
drive lock and unlock.

## Layout

| Path | Role |
| --- | --- |
| `index.html` | Shell; loads `app/main.js` as a module |
| `app/config.js` | Where the module and the broker are |
| `app/session.js` | State of one module and every SDK call, DOM-free |
| `app/router.js` | Hash routes, menu order |
| `app/ui.js` | DOM helpers, icons, the mark |
| `app/pages/*.js` | One module per screen; unbuilt screens say so |
| `app/style.css` | Tokens and components from the encedo web kit |
| `dev/serve.mjs` | Dev server with the mock module and broker |
| `dev/session.test.mjs` | Tests for the session logic |

## Built so far

- Sign-in: waiting for the module, air-gapped notice, password, phone request with cancel.
- Overview: module, firmware and update flag, backend, drives, paired phones, uptime.
- Secure drive: unlock read-only or read-write, lock.

Everything else is drawn in the canvas and stubbed in the menu.
