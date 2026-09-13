# Manager 2.0 — where it stands

Last updated 2026-09-13, branch `main`, published. What the Manager built on hem-sdk-js has,
what Manager v1 had that it does not, and the order the rest is planned in.
The SDK mapping behind it is in [SDK-MAPPING.md](SDK-MAPPING.md); how to run
and test it is in the [README](../README.md).

## Built and tested

Every screen the menu names. 61 session tests and a browser smoke run against
the mock; the phone paths were tried on a real PPA with the Authenticator v2
app, which is how the missing `exp` on a phone request came to light. The
software update, a personalisation and a release on the module have not been
tried on hardware yet.

| Screen | What it does |
| --- | --- |
| Sign-in | Password; the phone whenever the backend answers, first when a phone is paired; the 24 words as an alternative; air-gapped notice |
| Overview | Module, firmware and update flag, backend, drives, paired phones, uptime, "needs you" |
| Secure drive | Unlock read-only or read-write, lock |
| Keychain | Sorted, searched, paged; a key opens under its own row: public half, description as bytes, rename, delete, share code with QR or by e-mail; create, import, read a pasted share code |
| Paired phones | Read out of the keychain and checked against the broker (a phone in one place only is shown as such); pairing by QR drawn here; unpairing takes both halves — a 4xx from the broker asks "Do it anyway?" and, on yes, the key goes regardless |
| Operation log | File index; the logger key checked against a nonce the module signs; each file's HMAC chain replayed in the browser; entries read into words; the file still being written shown as such |
| Hardware | Version, what signed the firmware and bootloader, temperature while the page is open, the module's self-test, the scopes this browser holds (and "forget them"), a reboot that asks twice |
| Settings | Owner, the three things the module takes on faith, a password change that never sends the password, the 24 words as authorisation, a name under ence.do with its certificate, a wipe behind a typed WIPE |
| Personalisation | A module out of the box (`inited` in its status) goes through v1's steps: owner, password, name (free, or its own confirmed by e-mail), drive layout, trust; 24 words made in the browser as the master key; init, format, certificate; a Proof of Personalisation PDF written in JS. A failure wipes back to the box. Air-gapped it keeps my.ence.do |
| Phone sessions | Any operation without a cached token asks the phone, one request at a time, behind a modal naming the operation, with cancel |
| Software | What the module runs and what the backend has newer; firmware or Manager installed as v1 did it (download, upload with progress, the module's own check polled, install); a firmware file from anywhere for the air-gapped case, also before personalisation; firmware reboots the module and the page waits for it, the Manager reloads the page |

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
