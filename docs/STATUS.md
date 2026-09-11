# Manager 2.0 — where it stands

Last updated 2026-09-11, branch `main`, published. What the Manager built on hem-sdk-js has,
what Manager v1 had that it does not, and the order the rest is planned in.
The SDK mapping behind it is in [SDK-MAPPING.md](SDK-MAPPING.md); how to run
and test it is in the [README](../README.md).

## Built and tested

Every screen the menu names. 60 session tests and a browser smoke run against
the mock; the phone paths are confirmed on a real PPA with the Authenticator v2
app; the software update is not yet tried on a real module.

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
3. **Drive geometry in Settings.** Left out on purpose: changing it destroys
   the data. Set once at personalisation. If wanted, it needs a typed
   confirmation like the wipe.
4. **Trusted Apps** (`thirdparties`: File transfer, Onchato, Video call). In v1
   a launcher for separate applications, mostly "stay tuned". Depends on whether
   those applications come to v2 at all.
5. **Auxiliary pages** (`about`, `problems_with_login`, `notifications`,
   `favourites`, `qrcode`, `search`). Placeholder text in v1. Only `about` and
   sign-in help are worth carrying, once there is copy for them.
6. **Dark mode by the hour.** An open v1 decision; v2 has the colour tokens, so
   it is mostly CSS.
7. **EPA.** `state.model` is the hook (an EPA skips the drive section and the
   format wait); the rest of v1's EPA branches are not carried. Later, by
   decision.

## Decided along the way

- Provisioning is done in production and sets up the secure element
  independently of the firmware; it is not part of the Manager.
- The Proof of Personalisation is a PDF written by `app/pdf.js`, no jsPDF.
- A paired phone's keychain entry reads `RVhUQUlE` + pid as base64; the pid is
  base64 itself, not ASCII after `EXTAID`.
- Breaking SDK changes are allowed when every affected consumer is fixed in
  the same sitting; the SDK lives on `manager-v2` in `encedo/hem-sdk-js`.
- Manager 1.3 is archived on the `v1` branch and taken out of `main`; the
  Manager sits at the root of the repository, and `dist/` is built for the
  module rather than committed.

## Next

Renaming a phone, then serving the Manager from the module and a live run of
the whole thing, the software update included. Trusted Apps and the auxiliary pages after a decision on what stays.
