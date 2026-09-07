# Manager → hem-sdk-js mapping

Working document for the v2 rewrite. It lists every device and cloud call the
Manager v1 makes (from `src/encedo.js` and `src/core2.js`), the `HEM` method in
[`sdk/`](../sdk) (git submodule of `encedo/hem-sdk-js`) that replaces it, and
what the SDK still lacks. SDK changes go upstream in the submodule, never in a
copy (see `sdk/CLAUDE.md`).

Status legend: **covered** = SDK call exists · **partial** = exists but misses
something the Manager relies on · **missing** = no SDK counterpart yet ·
**n/a** = stays in the app or is new in the SDK.

Coverage of the 30 rows below, after SDK branch `manager-v2` (`a750037`):
**25 covered · 1 partial · 1 missing · 3 n/a.** Before that branch it was
14 · 4 · 9 · 3; the nine broker-side gaps were closed by moving every
`api.encedo.com` call into a new `Broker` class and composing it from `HEM`.
What is left needs a decision, not code: the BIP39 master passphrase.

## 1. Method map

### Connection and system

| Manager v1 | Endpoints | hem-sdk-js | Status | Note |
|---|---|---|---|---|
| `version()` | `GET api/system/version` | `getVersion({timeoutMs, signal})` | covered | SDK adds a cancellable timeout; use it for the "waiting for device" probe |
| `status()`, `checkAPI()`, `ping()` | `GET api/system/status` | `getStatus({timeoutMs, signal})` | covered | |
| `check()` | `api/system/checkin` → broker `/checkin` → `api/system/checkin` | `hemCheckin()` | covered | returns the step-3 payload; `newfws` / `newuis` feed `broker.download()` |
| `reboot()` | `api/system/reboot` | `reboot(token)` | covered | |
| selftest (core2) | `api/system/selftest` | `selftest(token)` | covered | |
| `updateCfg()`, settings forms | `GET/POST api/system/config` | `getConfig`, `setConfig` | covered | |
| `wipeout()` | `POST api/system/config {wipeout:true}` | `setConfig(token, {wipeout:true})` | covered | |
| — | `api/system/config/attestation` | `getAttestation(token)` | n/a | new in SDK; candidate for the Hardware status page |

### Authentication

| Manager v1 | Endpoints | hem-sdk-js | Status | Note |
|---|---|---|---|---|
| `auth()`, `postAuthToken()`, `scope()`, `scoped()`, `tokens[]` | `GET+POST api/auth/token` | `authorizePassword(pw, scope, exp)` + built-in token cache | covered | PBKDF2 (600k) → X25519 → eJWT and the per-scope cache move into the SDK; asking "password or phone?" stays UI policy |
| `mobileConnection()`, `mobileAuth()` | `api/auth/ext/request`, broker `notify/session`, `notify/event/new`, `notify/event/check/{id}`, `api/auth/ext/token` | `authorizeRemote(scope, {pollInterval, pollTimeout, onPending, signal})` | covered | v1 polls every 3 s for ~200 s |
| `mobileAuthCleanup()` | `DELETE` broker `notify/event/{id}` | inside `authorizeRemote` (on abort / timeout), `broker.eventDelete()` | covered | cancelling withdraws the event; `onEvent` exposes the id |
| "Use Master Passphrase" (settings) | `api/auth/token` with a key derived from the BIP39 mnemonic | — | missing | `authorizePassword` derives from a typed password; v1's admin identity is the 24-word mnemonic on the Proof of Personalization PDF |

### Personalisation

| Manager v1 | Endpoints | hem-sdk-js | Status | Note |
|---|---|---|---|---|
| `init()`, `initFinal()` | `GET+POST api/auth/init` | `initialize({ mnemonic }, userPw, cfg)` | covered | built on v2's personalisation flow (2026-09-07): `generateMnemonic()` makes the 24 words, which ARE the master key; the cfg fields are v1's (`user, email, hostname, ip, storage_mode, storage_disk0size, dnsd, trusted_ts, trusted_backend, allow_keysearch, origin, ctx`, `gen_csr` for a name of the owner's own); then `status.format` is polled, the name registered with the init's `genuine`/`csr` (`broker.domainRegister` + `waitDomain`), and `setConfig({ tls })`; a failure wipes with the init token, as v1's `initRollback` did |
| `provisioning()` | broker `/provisioning`, `POST api/system/config/provisioning` | `provision()`, `installProvisioning()`, `broker.provisioning()` | covered | not part of the Manager: provisioning happens in production and sets up the secure element independently of the firmware (owner, 2026-09-07); v1 never called it from core2 either |
| `updateTLS()`, domain flow (core2) | broker `domain/predefs`, `domain/check/{name}`, `domain/register/{prefix}`, `domain/register/{id}` | `registerDomain()`, `broker.domainPredefs()`, `broker.domainTaken()`, `broker.domainStatus()`, `broker.waitDomain()` | covered | `domainTaken` reads 200 as taken and 404 as free; a custom prefix answers 201 + id and is polled until the e-mail click (`pending` → `email_confirmed` → `done`), as v1's `checkDomainAfterInit` did |

### Paired devices

| Manager v1 | Endpoints | hem-sdk-js | Status | Note |
|---|---|---|---|---|
| `pair()` + `pairdeviceNow` (core2) | `api/auth/ext/init`, broker `notify/session`, `notify/register/init|check|finalise`, `api/auth/ext/validate` | `registerExtAuth(token, {onQrCode, pollInterval, pollTimeout, onPending, signal})` | covered | built on v2's Paired phones page (2026-09-07): `onQrCode` hands over the exact JSON and v2/app/qr.js draws it, no library |
| `paired()` | `api/auth/ext/mac` + broker `notify/subscribers/list` | `listExtAuth(token)` | covered | v2 lists phones from the keychain (`listKeys`, description `EXTAID` + pid) and uses this to say which the broker still routes to; v1's `keymgmt/search` depended on `allow_keysearch` |
| `unpair(pid)` | `api/auth/ext/mac` + broker `notify/subscribers/delete` | `deleteExtAuth(token, pid)` | covered | the keychain entry `RVhUQUlE` + pid is still deleted with `deleteKey`; air-gapped, v2 deletes the key alone (that is the half that revokes) and says the broker still lists it |
| `checkPairing()` | `api/auth/token` + broker `notify/session` | `hasExtAuth()` | covered | no token needed |

### Keychain

| Manager v1 | Endpoints | hem-sdk-js | Status | Note |
|---|---|---|---|---|
| keychain pages (core2), `removeKey()` | `api/keymgmt/list|search|get|create|import|update|delete` | `listKeys`, `searchKeys`, `getPubKey`, `createKeyPair`, `importPublicKey`, `updateKey`, `deleteKey` | covered | built on v2's Keychain page (2026-09-04). Two SDK fixes on the way: `listKeys` returns `{ list, total }` with `created`/`updated`, so a page can show dates and know when to ask for the next page; `createKeyPair` / `deriveKey` send `mode` only where the device wants one — the SECP* curves, which the caller now chooses for — instead of `mode: 'AES256'` |
| share key by e-mail (core2) | broker `share/emailpubkey` | `broker.shareEmailPubkey()` | covered | |

### Secure drive

| Manager v1 | Endpoints | hem-sdk-js | Status | Note |
|---|---|---|---|---|
| `unlockEncedoDisk()`, `lockEncedoDisk()` | `api/storage/unlock/ro`, `unlock/rw`, `api/storage/lock`; scope `storage:disk<N>[:rw]` | `unlockStorage(token)`, `lockStorage(token)` | covered | v1's `/ro` and `/rw` sub-paths are legacy: `hem-api-tester/test_12.php` calls plain `/unlock` and the scope selects the mode |

### Operation log

| Manager v1 | Endpoints | hem-sdk-js | Status | Note |
|---|---|---|---|---|
| consolelog pages (core2) | `api/logger/key`, `api/logger/list`, `api/logger/{id}` | `getLoggerKey`, `listLog`, `getLogEntry` | covered | |
| `check_log_integrity()` (core2) | client-side: Ed25519 verify of the signed nonce, HMAC-SHA256 per line | `verifyLog()`, `verifyLoggerKey()`, `verifyLogEntry(token, id)` | covered | result names the first failing line and why. `verifyLoggerKey` was added on 2026-09-04: `/api/logger/key` answers with a nonce and its signature, and without checking that, a verified file only agrees with itself. Both were run over 137 files off a real PPA — all verified |

### Software updates

| Manager v1 | Endpoints | hem-sdk-js | Status | Note |
|---|---|---|---|---|
| `getNewFirmware()`, `getNewDashboard()` | broker `download/firmware/{v}`, `download/dashboard/{v}`, then `POST upload_fw` / `upload_ui` via XHR with progress | `broker.download(kind, version)`, `uploadFirmware(token, bytes, name, {onProgress})`, `uploadUi(...)` | covered | |
| `checkNewFirmware()`, `installNewFirmware()`, `checkNewDashboard()`, `installNewDashboard()` | `check_fw`, `install_fw`, `check_ui`, `install_ui` | `checkFirmware`, `installFirmware`, `checkUi`, `installUi` | covered | |
| — | `api/system/upgrade/usbmode` | `usbMode(token)` | n/a | Not needed by the Manager (decided 2026-09-03); USB ACM uploads have their own webshell |

### Helpers

| Manager v1 | hem-sdk-js | Status | Note |
|---|---|---|---|
| `pbkdf2KeyDerive()`, `generateSharedSecret()`, `jwt_generate_hs256()`, `sha256()`, `hmacSha256()`, `base64*` | private `#deriveX25519`, `#buildEjwt`, `toB64` / `fromB64` | covered | internal to the SDK |
| `parseJwt()` | `jwtParse` (exported) | covered | |
| `genKeys()`, `hash()`, `startCounting()`, `setTime()`, `log()`, `error()`, `info()`, `arg()` | — | n/a | UI utilities stay in the app |

## 2. Gaps in milestone order

Closed on SDK branch `manager-v2` (`a750037`), each with a test in `sdk/test/sdk.test.mjs`:

1. ~~Login: `hemCheckin()` payload~~ returns `{ status, newfws, newuis }`.
2. ~~Login: cancelling a mobile request~~ `authorizeRemote` deletes the broker event on abort and timeout.
3. ~~Login, UI: export `jwtParse`~~ exported.
4. Disk unlock: nothing was missing; v1's `/ro` and `/rw` paths are dropped, the scope selects the mode.
5. ~~Paired devices~~ `listExtAuth`, `deleteExtAuth`, `hasExtAuth`.
6. ~~Operation log~~ `verifyLog`, `verifyLogEntry`.
7. ~~Software updates~~ `broker.download`, `onProgress` on uploads. `usbMode` is not needed by the Manager.
8. ~~Keychain share~~ `broker.shareEmailPubkey`.
9. Personalisation: ~~`provision`~~, ~~domains~~ done. **Decided: the BIP39 master passphrase stays.** The SDK gets it in two places, at the dashboard-building stage: `initialize` with a mnemonic-derived admin key, and a master-passphrase `authorize` for the settings page. v1 derives the admin key as `nacl.box.keyPair.fromSecretKey(hex(seed).substr(1, 64))`, one character into the BIP39 seed's hex string; devices in the field were personalised that way, so the SDK must reproduce it exactly.

Also fixed on the way: `registerExtAuth` sent `hash: 'not_implemented_yet'` in the QR payload; it now sends `base64(SHA-256(request))` as v1 did.

## 3. Manager pages → SDK calls

| Page (v1 id) | SDK calls | Gap |
|---|---|---|
| `authenticate` | `getVersion` / `getStatus` with `timeoutMs` while waiting for the device, `hemCheckin`, `hasExtAuth`, `authorizePassword` or `authorizeRemote` | — |
| `home` | `getStatus`, `getConfig`, update flags from checkin | — |
| `securestorage` | `unlockStorage`, `lockStorage` with `storage:disk<N>[:rw]` | — |
| `devices`, `device_details` | `registerExtAuth` + QR render, `listExtAuth`, `deleteExtAuth` | — (built in v2) |
| `keychain`, `key_*` | `listKeys`, `searchKeys`, `getPubKey`, `createKeyPair`, `importPublicKey`, `updateKey`, `deleteKey`, `broker.shareEmailPubkey` | — (built in v2) |
| `hardware` | `getVersion`, `getStatus`, `selftest`, `reboot`, and the new `hem.tokens` getter | — (built in v2; the attestation is left alone — it can hand back a private key on a device that is not provisioned yet) |
| `consolelog`, `consolelog_show` | `getLoggerKey`, `verifyLoggerKey`, `listLog`, `getLogEntry`, `verifyLog` | — (built in v2) |
| `update`, `update_*_page` | checkin flags, `broker.download`, `uploadFirmware` / `checkFirmware` / `installFirmware`, `uploadUi` / `checkUi` / `installUi` | — |
| `settings` | `getConfig`, `setConfig` (incl. wipeout), `setUserPassword`, `registerDomain`, `domainTaken`, `authorizeMaster` | — (built in v2; drive geometry is not, because changing it destroys the data on them) |
| `gettingStarted`, `initialisationPage`, `domainSetupPage`, `tutorial` | `initialize`, `broker.domainRegister` + `waitDomain`, `setConfig({ tls })`; the proof PDF is written by v2/app/pdf.js | — (built in v2) |

## 4. Integration notes

- **Module loading.** The SDK is an ES module; `sdk/hem-sdk.browser.js` can be imported from a `<script type="module">` without a bundler, which suits the PPA's static hosting. The v2 build copies it into the served bundle.
- **Browser floor.** SDK: Chrome 113+ / Firefox 130+ (X25519 in WebCrypto). v1 already requires Chrome 120+, Firefox 133+, Safari 17+. Verify X25519 on the Safari versions we want to support.
- **Air-gapped operation.** Every backend call is a `Broker` method and no device-only method touches it, so the boundary is in the type system. `hemCheckin()` throws `broker_error` offline; the login flow catches it and continues with password auth, as v1's `check()` should have.
- **Tokens.** SDK caches one JWT per scope and purges on expiry; v1's `app.tokens` map and the `scoped()` prompt logic reduce to UI policy (ask for password or push).
- **Errors.** `HemError.code` maps onto v1's messages: `http_401` → "Password is incorrect", `denied` → "Access denied by mobile app", `timeout` → "Operation timed out", `network` → "Connection to Encedo failed".
