# Manager → hem-sdk-js mapping

Working document for the v2 rewrite. It lists every device and cloud call the
Manager v1 makes (from `src/encedo.js` and `src/core2.js`), the `HEM` method in
[`sdk/`](../sdk) (git submodule of `encedo/hem-sdk-js`) that replaces it, and
what the SDK still lacks. SDK changes go upstream in the submodule, never in a
copy (see `sdk/CLAUDE.md`).

Status legend: **covered** = SDK call exists · **partial** = exists but misses
something the Manager relies on · **missing** = no SDK counterpart yet ·
**n/a** = stays in the app or is new in the SDK.

Coverage of the 30 rows below: 14 covered · 4 partial · 9 missing · 3 n/a.
Every missing item except the log verifier and the mnemonic key is a call to
the notification broker (`api.encedo.com`), so the gaps are one "broker" module
rather than many device fixes.

## 1. Method map

### Connection and system

| Manager v1 | Endpoints | hem-sdk-js | Status | Note |
|---|---|---|---|---|
| `version()` | `GET api/system/version` | `getVersion({timeoutMs, signal})` | covered | SDK adds a cancellable timeout; use it for the "waiting for device" probe |
| `status()`, `checkAPI()`, `ping()` | `GET api/system/status` | `getStatus({timeoutMs, signal})` | covered | |
| `check()` | `api/system/checkin` → broker `/checkin` → `api/system/checkin` | `hemCheckin()` | partial | SDK resolves to `true` and drops the step-3 payload; v1 reads `newfws` / `newuis` from it to show available updates |
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
| `mobileAuthCleanup()` | `DELETE` broker `notify/event/{id}` | — | missing | `signal` stops polling but leaves the event pending on the broker and the push on the phone |
| "Use Master Passphrase" (settings) | `api/auth/token` with a key derived from the BIP39 mnemonic | — | missing | `authorizePassword` derives from a typed password; v1's admin identity is the 24-word mnemonic on the Proof of Personalization PDF |

### Personalisation

| Manager v1 | Endpoints | hem-sdk-js | Status | Note |
|---|---|---|---|---|
| `init()`, `initFinal()` | `GET+POST api/auth/init` | `initialize(adminPw, userPw, cfg)` | partial | cfg fields line up (`user, email, hostname, ip, storage_mode, dnsd, trusted_ts, trusted_backend, allow_keysearch, origin, ctx`); v1 derives the master key from a generated BIP39 mnemonic, the SDK from a password |
| `provisioning()` | broker `/provisioning` | — | missing | cloud |
| `updateTLS()`, domain flow (core2) | broker `domain/predefs`, `domain/check/{name}`, `domain/register/{prefix}` | — | missing | cloud: `my.ence.do` hostname and TLS certificate |

### Paired devices

| Manager v1 | Endpoints | hem-sdk-js | Status | Note |
|---|---|---|---|---|
| `pair()` + `pairdeviceNow` (core2) | `api/auth/ext/init`, broker `notify/session`, `notify/register/init|check|finalise`, `api/auth/ext/validate` | `registerExtAuth(token, {onQrCode, pollInterval, pollTimeout, onPending, signal})` | covered | QR rendering stays in the UI (`qr-code-styling`); `onQrCode` hands over the exact JSON |
| `paired()` | `api/auth/ext/mac` + broker `notify/subscribers/list` | `getExtAuthMac(token)` | partial | MAC handshake covered, the broker list call is not |
| `unpair(pid)` | `api/auth/ext/mac` + broker `notify/subscribers/delete` | — | missing | |
| `checkPairing()` | `api/auth/token` + broker `notify/session` | — | missing (low) | probes whether any phone is paired; drives "mobile auth by default" |

### Keychain

| Manager v1 | Endpoints | hem-sdk-js | Status | Note |
|---|---|---|---|---|
| keychain pages (core2), `removeKey()` | `api/keymgmt/list|search|get|create|import|update|delete` | `listKeys`, `searchKeys`, `getPubKey`, `createKeyPair`, `importPublicKey`, `updateKey`, `deleteKey` | covered | SDK already shapes `mode` and the base64 `^` search pattern current firmware expects |
| share key by e-mail (core2) | broker `share/emailpubkey` | — | missing | cloud |

### Secure drive

| Manager v1 | Endpoints | hem-sdk-js | Status | Note |
|---|---|---|---|---|
| `unlockEncedoDisk()`, `lockEncedoDisk()` | `api/storage/unlock/ro`, `unlock/rw`, `api/storage/lock`; scope `storage:disk<N>[:rw]` | `unlockStorage(token)`, `lockStorage(token)` | covered | v1's `/ro` and `/rw` sub-paths are legacy: `hem-api-tester/test_12.php` calls plain `/unlock` and the scope selects the mode |

### Operation log

| Manager v1 | Endpoints | hem-sdk-js | Status | Note |
|---|---|---|---|---|
| consolelog pages (core2) | `api/logger/key`, `api/logger/list`, `api/logger/{id}` | `getLoggerKey`, `listLog`, `getLogEntry` | covered | |
| `check_log_integrity()` (core2) | client-side: Ed25519 verify of the signed nonce, HMAC-SHA256 per line | — | missing | pure WebCrypto, DOM-free: belongs in the SDK |

### Software updates

| Manager v1 | Endpoints | hem-sdk-js | Status | Note |
|---|---|---|---|---|
| `getNewFirmware()`, `getNewDashboard()` | broker `download/firmware/{v}`, `download/dashboard/{v}`, then `POST upload_fw` / `upload_ui` via XHR with progress | `uploadFirmware(token, bytes)`, `uploadUi(token, bytes)` | partial | download is a plain `fetch` in the app; upload progress callback missing (v1 shows a progress bar) |
| `checkNewFirmware()`, `installNewFirmware()`, `checkNewDashboard()`, `installNewDashboard()` | `check_fw`, `install_fw`, `check_ui`, `install_ui` | `checkFirmware`, `installFirmware`, `checkUi`, `installUi` | covered | |
| — | `api/system/upgrade/usb` | `usbMode(token)` | n/a | SDK examples call it before upload, v1 never does; confirm with firmware whether it is required |

### Helpers

| Manager v1 | hem-sdk-js | Status | Note |
|---|---|---|---|
| `pbkdf2KeyDerive()`, `generateSharedSecret()`, `jwt_generate_hs256()`, `sha256()`, `hmacSha256()`, `base64*` | private `#deriveX25519`, `#buildEjwt`, `toB64` / `fromB64` | covered | internal to the SDK |
| `parseJwt()` | `jwtParse` (module-level, not exported) | missing (small) | UI shows token scope and expiry; export it |
| `genKeys()`, `hash()`, `startCounting()`, `setTime()`, `log()`, `error()`, `info()`, `arg()` | — | n/a | UI utilities stay in the app |

## 2. Gaps in milestone order

Ordered by the v2 plan: skeleton → login → disk unlock → the remaining pages →
personalisation last.

1. **Login.** `hemCheckin()` returns the step-3 payload (`newfws`, `newuis`, `status`) instead of `true`. One-line change.
2. **Login.** Cancelling a mobile request: `DELETE notify/event/{id}` on abort, or a `cancelRemote(eventid)` next to `authorizeRemote` that exposes the event id.
3. **Login, UI.** Export `jwtParse` (token scope and expiry in the status bar).
4. **Disk unlock.** Nothing missing. Drop v1's `/ro` and `/rw` paths, choose the mode by scope.
5. **Paired devices.** `listExtAuth(token)` and `deleteExtAuth(token, pid)` built on `getExtAuthMac` plus broker `notify/subscribers/list|delete`.
6. **Operation log.** `verifyLogEntry(signerKey, entry)` with the Ed25519 nonce check and the HMAC-SHA256 line check from `check_log_integrity`.
7. **Software updates.** `onProgress` for `uploadFirmware` / `uploadUi` (browser `fetch` has no upload progress, so this needs XHR in the browser path). Decide whether `usbMode` is mandatory.
8. **Keychain.** `shareKeyByEmail` on broker `share/emailpubkey`.
9. **Personalisation.** `initialize` variant accepting a mnemonic-derived admin key, master-passphrase login, `provisioning`, and a domain module (`predefs`, `check`, `register` with TLS). Decision first: keep the BIP39 Proof-of-Personalization model or move to the SDK's two-password model.

## 3. Manager pages → SDK calls

| Page (v1 id) | SDK calls | Gap |
|---|---|---|
| `authenticate` | `getVersion` / `getStatus` with `timeoutMs` while waiting for the device, `hemCheckin`, `authorizePassword` or `authorizeRemote` | 1, 2 |
| `home` | `getStatus`, `getConfig`, update flags from checkin | 1 |
| `securestorage` | `unlockStorage`, `lockStorage` with `storage:disk<N>[:rw]` | — |
| `devices`, `device_details` | `registerExtAuth` + QR render, list and delete paired phones | 5 |
| `keychain`, `key_*` | `listKeys`, `searchKeys`, `getPubKey`, `createKeyPair`, `importPublicKey`, `updateKey`, `deleteKey` | 8 (share) |
| `hardware` | `getVersion`, `getStatus`, `selftest`, `getAttestation`, `reboot` | — |
| `consolelog`, `consolelog_show` | `getLoggerKey`, `listLog`, `getLogEntry`, verify | 6 |
| `update`, `update_*_page` | checkin flags, `fetch` broker `download/*`, `uploadFirmware` / `checkFirmware` / `installFirmware`, `uploadUi` / `checkUi` / `installUi` | 1, 7 |
| `settings` | `getConfig`, `setConfig` (incl. wipeout), domain, master passphrase | 9 |
| `gettingStarted`, `initialisationPage`, `domainSetupPage` | `initialize`, provisioning, domain register; PDF stays on jsPDF in the app | 9 |

## 4. Integration notes

- **Module loading.** The SDK is an ES module; `sdk/hem-sdk.browser.js` can be imported from a `<script type="module">` without a bundler, which suits the PPA's static hosting. The v2 build copies it into the served bundle.
- **Browser floor.** SDK: Chrome 113+ / Firefox 130+ (X25519 in WebCrypto). v1 already requires Chrome 120+, Firefox 133+, Safari 17+. Verify X25519 on the Safari versions we want to support.
- **Air-gapped operation.** The broker is only involved in checkin, mobile auth, pairing, updates and domains. `hemCheckin()` throws `broker_error` offline, so the login flow must catch it and continue with password auth; v1's `check()` had the same coupling.
- **Tokens.** SDK caches one JWT per scope and purges on expiry; v1's `app.tokens` map and the `scoped()` prompt logic reduce to UI policy (ask for password or push).
- **Errors.** `HemError.code` maps onto v1's messages: `http_401` → "Password is incorrect", `denied` → "Access denied by mobile app", `timeout` → "Operation timed out", `network` → "Connection to Encedo failed".
