# Manager 2.0 — where it stands

Last updated 2026-09-13, branch `main`, published. What the Manager built on hem-sdk-js has,
what Manager v1 had that it does not, and the order the rest is planned in.
The SDK mapping behind it is in [SDK-MAPPING.md](SDK-MAPPING.md); how to run
and test it is in the [README](../README.md).

## Built and tested

Every screen the menu names. 62 session tests and a browser smoke run against
the mock; the phone paths were tried on a real PPA with the Authenticator v2
app, which is how the missing `exp` on a phone request came to light. The
software update, a personalisation and a release on the module have not been
tried on hardware yet.

| Screen | What it does |
| --- | --- |
| Sign-in | Password; the phone whenever the backend answers, first when a phone is paired; the 24 words as an alternative; air-gapped notice. DEV-535: a sign-in is the token alone (the configuration is read when Settings shows, the phones when the Phones page does); calls name no scope, the SDK picks the token and asks through the session; the status every 15 s, the check-in every 5 minutes; a reboot is told by the module's spk in the SDK, which asks for the password again |
| Overview | Module, firmware and update flag, backend, drives, paired phones, uptime, "needs you" |
| Secure drive | Unlock read-only or read-write, lock |
| Keychain | Sorted, searched, paged; a key opens under its own row: public half, description as bytes, rename, delete, share code with QR or by e-mail; create, import, read a pasted share code |
| Paired phones | Read out of the keychain and checked against the broker (a phone in one place only is shown as such); pairing by QR drawn here, or, on the phone the Manager runs on, Open in Authenticator (`encedo-auth://pair?qr=<base64url of the QR text>`) and Copy link (Paste code in the app); unpairing takes both halves — a 4xx from the broker asks "Do it anyway?" and, on yes, the key goes regardless |
| Operation log | File index; the logger key checked against a nonce of ours the module signs; every line's signature (format v2) checked in the browser; entries read into words; the file still being written shown as such |
| Hardware | Version, what signed the firmware and bootloader, temperature while the page is open, the module's self-test, the scopes this browser holds (and "forget them"), a reboot that asks twice |
| Settings | Owner, the three things the module takes on faith, a password change that never sends the password, the 24 words as authorisation, a name under ence.do with its certificate, a wipe behind a typed WIPE |
| Personalisation | A module out of the box (`inited` in its status) goes through v1's steps: owner, password, name (free, or its own confirmed by e-mail), drive layout, trust; 24 words made in the browser as the master key; init, format, certificate; a Proof of Personalisation PDF written in JS. A failure wipes back to the box. Air-gapped it keeps my.ence.do. A HEM Playground module (firmware version ending in `-sim`) keeps the playground's name, certificate and network: no name under ence.do, no drives, no reboot (also in Settings); its menu has no Software and the overview no firmware offer. The device policy (raw ECDH, public keys in search / list) is chosen here, once, and shown in Settings |
| Phone sessions | Any operation without a cached token asks the phone, one request at a time, behind a modal naming the operation, with cancel |
| Password sessions | The sign-in form offers "remember the password for this session", ticked when the page is opened and unticked again after a sign-out. Ticked, the key derived from it is kept and nothing asks again. Unticked, every scope is a question naming the operation, with the same offer inside it. Tokens are cached either way, so no scope is asked about twice |
| Software | What the module runs and what is newer; firmware from the backend installed as v1 did it (download, upload with progress, the module's own check polled, install); a firmware file from anywhere for the air-gapped case, also before personalisation; firmware reboots the module and the page waits for it. The Manager (DEV-534) comes from its release site on GitHub Pages, offered in the masthead and here only by the Manager a PPA serves itself (not a page hosted elsewhere, not a playground module, not an EPA); the tar is checked against latest.json (size, SHA-256) and the pinned publisher key before it goes to the module, and the page reloads. The backend's newuis is shown as a second opinion, never installed |

Things v1 did not have: log verification in the browser, the keychain/broker
cross-check for phones, per-scope tokens shown and forgettable, the self-test,
a password change without the password leaving the browser.

## Not there yet, against v1

1. **Bootloader update.** v1 had a page for it ("update your bootloader
   first") but no code behind it and no check-in flag; the Software page shows
   the bootloader version and nothing more until the firmware and the backend
   say how a bootloader is updated.
2. **Renaming a paired phone** (`device_edit`). A phone is a key, so this is a
   rename in the phone's row. Small.
3. **EPA.** Required, not optional (owner, 2026-09-13). `state.model` already
   tells one from a PPA and the personalisation skips the drive layout and the
   format wait for it. What is left is the rest of the differences, and they
   are in the naming: an EPA has no USB network, so it registers its name by
   `cname` rather than `ip` — v1 sent `{ genuine: 'EPA:GenuineToken', csr,
   cname }` and hem-api-tester test_2 branches the same way — and the prefix is
   a choice the owner has to make, with the e-mail confirmation, rather than
   one of the broker's free names. `broker.domainRegister()` takes no `cname`
   yet: that is an SDK change first.
4. **Trusted Apps** — a marketing page (owner, 2026-09-13): a list of links to
   the Encedo applications at a frozen version, Onchato and Meet among them.
   Not a launcher and nothing the module answers for; copy and links decide it.
5. **Auxiliary pages** (`about`, `problems_with_login`, `notifications`,
   `favourites`, `qrcode`, `search`). Placeholder text in v1. Only `about` and
   sign-in help are worth carrying, once there is copy for them.
6. **Dark mode by the hour.** An open v1 decision; the colour tokens are there,
   so it is mostly CSS.

## Decided along the way

- Provisioning is done in production and sets up the secure element
  independently of the firmware; it is not part of the Manager.
- The Proof of Personalisation is a PDF written by `app/pdf.js`, no jsPDF.
- A paired phone's keychain entry reads `RVhUQUlE` + pid as base64; the pid is
  base64 itself, not ASCII after `EXTAID`.
- **The drive layout is set once, at personalisation** (owner, 2026-09-13).
  Little of what a module is given at initialisation can be changed afterwards,
  and changing the geometry destroys what is on it. Settings does not offer it.
- Breaking SDK changes are allowed when every affected consumer is fixed in
  the same sitting, and written into `sdk/MIGRATION.md`; the SDK is one line
  on `main` in `encedo/hem-sdk-js`, shared with the other projects that use it.
- Manager 1.3 is archived on the `v1` branch and taken out of `main`; the
  Manager sits at the root of the repository, and `dist/` is built for the
  module rather than committed.

## Next

A live run on a module: a release on it, the software update, a personalisation
from the box, and a key of each 25519 type since `mode` stopped being sent.
Then EPA, which starts with `cname` in the SDK, then renaming a phone. Trusted
Apps and the auxiliary pages are writing, not building: they wait on copy.

### To do: a module without TLS (diagnostic screen)

Noted 2026-11-25, not designed yet. Today a module that answers over plain http
only gives a bare error, or the "Service mode · plain http" band with
`?service=1` (DEV-532).

- **The signal.** `GET /api/system/status` carries `https` only on a plain-http
  connection: `true` when the module's HTTPS server runs, `false` when it does
  not (no TLS key or certificate yet, or it failed to start) - firmware API
  reference, `/api/system/status`. No token needed.
- **What the screen should do.** On `https: false`, before any sign-in: say that
  the module has no working TLS and why that matters (a password sent over
  http can be read on the way), and show the way out - a service visit with
  `?service=1` to repair it (a name under ence.do and its certificate, Settings),
  then back over https. On `https: true` over http: point to the https address
  instead.
- **Decided already.** No "https page + http module" hint in general (owner,
  2026-11-24: the playground is all https; on a PPA either works).
- **Open.** Which repair steps the Manager can run itself in service mode
  (domain registration, certificate) and which need the backend; the wording
  (design/STYLE.md); a smoke step with the mock answering `https: false`.

