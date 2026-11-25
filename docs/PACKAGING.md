# Packaging the Manager for a release

What `npm run build` makes, what the release pipeline wraps it in, and what the
module checks before it installs it. Written down from the packaging CI as it
stood on 2026-09-11 (`gen_manifest_root` and one built release), plus the
change to manual signing decided the same day.

`npm run pack` does everything here except the signature: it builds, lays out
the `webroot/`, writes the manifest and the tar, and prints the version and the
digest to sign. `node pack.mjs attach` puts the signature on afterwards and
`node pack.mjs verify` checks one the way a module would.

## The shape

A release is a directory named `HHMMSS_DDMMYYYY` holding three things:

| Artefact | What it is |
| --- | --- |
| `webroot/` | What the module serves, each file with a `.gz` twin beside it |
| `webroot_src.tar` | A plain tar of the contents of `webroot/`, the manifest included |
| `webroot.tar` | The same tar with a 96-byte signature trailer on the end |

The module's web server answers `GET /x` with `x.gz` and a `Content-Encoding`
header when the twin is there, and with `x` when it is not. That is why the
Manager's own build writes both, and why the convention stays.

## The manifest

`webroot/manifest` is `sha256sum -b` over every file in `webroot/`, originals
and `.gz` twins alike, with paths relative to `webroot/`:

```
d696620697fd160a696fb14aa0fefc5d88866c2d7ad5e76ce1aa4853f6eca477 *./index.html
bbba884b1c0e62184ab6fdc57c0dc4690b4657b7eda9b7f9f0c6144ec8c4e00c *./index.htm.gz
```

It is made after the twins and before the tar, so it covers the twins and does
not contain a line for itself. It is the only file with no twin.

**It is also the version.** The release is identified by the base64 of the
SHA-256 of the manifest — not of the tar:

```bash
hash=$(sha256sum -b webroot/manifest | cut -f1 -d' ')
hash_b64=$(echo $hash | xxd -r -p | base64)                                   # what the backend stores
hash_b64url=$(echo $hash | xxd -r -p | base64 | sed 's/+/-/g; s/\//_/g' | tr -d '=')   # what the URL uses
```

The backend keeps `api:gui:version` in Redis: `current` holds the base64 hash
and each older hash points at the one that replaced it. A symlink named after
the base64url hash points at the release directory, which is what makes
`download/dashboard/<version>` resolve — the same string a module gets as
`newuis` from its check-in, and the same string `broker.download()` takes.

## The signature

96 bytes appended to `webroot_src.tar`, giving `webroot.tar`:

```
[ tar bytes ][ 32-byte Ed25519 public key ][ 64-byte signature ]
```

The 32 bytes are the public key of the signing key. `uis` in
`/api/system/version` is **not** that key: it is the SHA-256 of the installed
manifest - the version above (checked on a PPA, 2026-11-18).

**What is signed** (settled 2026-11-18 against the firmware, `ed25519_verify_file`
in `encedo_firmware/Firmware/src/main.c`, and against the release in hand): the
module takes the whole file but the last 64 bytes - the tar **and the 32-byte
public key** - hashes it with **SHA-512**, and checks the Ed25519 signature over
those 64 bytes:

```
signature = Ed25519-sign( SHA-512( tar || public key ) )
webroot.tar = tar || public key || signature
```

The old documents said "the SHA-256 of the tar"; that does not verify on the
release in hand, and the module would refuse a bundle signed that way.

**From 2026-11-18 the CI signs it** (`.github/workflows/release.yml`, step
Sign): `node pack.mjs sign webroot_src.tar --key-env UI_SIGNING_KEY --expect <pub>`.

- Repository secret **`UI_SIGNING_KEY`**: the 32-byte Ed25519 seed, as 64 hex
  characters - one of the web UI publisher keys pinned in the firmware
  (`ui_publishers[]`, DEV-519).
- Repository variable **`UI_PUBLISHER_KEY`**: its public key, 64 hex characters.
  `sign` stops when the seed gives another key, so a wrong secret never reaches
  a module.

A signature made elsewhere, by hand: `node pack.mjs digest webroot_src.tar --key <pub>`
prints the 64 bytes to sign, `node pack.mjs attach` appends the trailer.

Verifying one, then, is: take the last 64 bytes off, SHA-512 what is left (tar
and key), check the signature over that digest with the key in the trailer -
and check that key against the one the module trusts. **The key in the trailer
names the signer; it does not vouch for it.** Firmware with DEV-519 holds a list
of pinned publisher keys; until it enforces them (`UI_PUBLISHER_PINNING`), any
key with a matching signature is accepted.

## What the module checks before it installs (`check_ui`)

1. The signature, as above (and, once enforced, the key against the pinned list).
2. The tar is unpacked into `/webroot.new`; every manifest line is a 64-hex
   SHA-256, a space, `*`, and the path (`./name`), and every listed file must
   hash to its line.
3. From DEV-519: every regular file of the tar needs a manifest line - the tar
   holds exactly one file more than the manifest has lines (the manifest
   itself). A file the manifest does not list fails the check.

Tar entries carry no `webroot/` prefix (`index.html`, `app.js.gz`, `manifest`):
the module unpacks them into `/webroot.new/` as they are.

## What the Manager's build already does, and what it could take from the CI

`build.mjs` writes `index.html`, `app.js`, `style.css` and `favicon.svg` with a
`.gz` twin of each, reading every twin back to be sure it is the same bytes.
That directory is a `webroot/` as it stands.

Two things worth carrying up into the packaging step, seen in the release in
hand:

- **Skip a twin that does not win.** Twelve of its fifty-six twins were larger
  than the file they compress — PNG, JPEG, woff2. The module then serves more
  bytes and asks the browser to decompress them.
- **`gzip -n9`, not the default.** Level 9 is free; `-n` keeps the name and the
  timestamp out of the header, without which two builds of identical content
  produce different twins, a different manifest and so a different version.

## latest.json - what a Manager reads to offer an update

A release (the `release` event of `.github/workflows/release.yml`) also gets
`latest.json`, written by `node pack.mjs latest <webroot.tar> --tag <tag>`:

```json
{
  "product": "encedo-manager",
  "version": "2.0.0",
  "uis": "<base64 SHA-256 of the manifest>",
  "tag": "v2.0.0",
  "published": 1795539669,
  "commit": "<this repository's commit>",
  "sdk": "<sdk/ commit>",
  "tar": {
    "url": "https://github.com/encedo/encedo-manager/releases/download/v2.0.0/webroot.tar",
    "size": 307296,
    "sha256": "<hex SHA-256 of webroot.tar, the signed tar>",
    "publisher": "<base64 of the 32-byte key in the trailer>"
  },
  "run": "https://github.com/encedo/encedo-manager/actions/runs/<id>"
}
```

- `version` is `VERSION` from `app/version.js`. The tag must be that version,
  with or without a `v`, or the run stops: a release never announces a version
  it does not carry. A Manager compares it with its own `VERSION`.
- `uis` is the version above - what `/api/system/version` reports as `uis` once
  this release is installed.
- `published` is unix seconds; `tar.url` names the tag, not `latest`, so it
  never moves.
- `run` is the Actions run that built and signed the release (from the
  release after 2.0.0; 2.0.0 has none).
- `pack.mjs latest` refuses an unsigned tar and one whose signature does not
  check out.

### Where a Manager reads it: GitHub Pages

A browser cannot read GitHub's release downloads cross-origin: neither
`github.com/.../releases/download/...` nor the `release-assets.githubusercontent.com`
it redirects to sends `Access-Control-Allow-Origin` (tried with 2.0.0,
2026-11-25). GitHub Pages sends `Access-Control-Allow-Origin: *`, so the
release workflow (job `pages`, after `webroot`, on a release and on a manual
run) publishes there:

| Path | What it is |
| --- | --- |
| `https://encedo.github.io/encedo-manager/latest.json` | the release GitHub marks *Latest* - what a Manager reads |
| `.../<tag>/latest.json` | that release's latest.json |
| `.../<tag>/webroot.tar` | that release's signed tar, unchanged |
| `.../index.html` | every release, newest first: its notes, links, digests |

- The releases are the only source. Each run downloads every release that
  carries `latest.json` (drafts and pre-releases left out) and
  `node pack.mjs site` rebuilds the whole site, so a release edited, deleted
  or newly marked *Latest* shows after the next run (a manual *Run workflow*
  does it without a release).
- In the Pages copies `tar.url` points at the tar on Pages and `release` at
  the release's page; the rest is the release's own latest.json unchanged.
  The copy attached to the release keeps the release download URL.
- `pack.mjs site` checks every tar first - its size and sha256 against its
  latest.json, its signature with the `publisher` named there - and a
  mismatch stops the run before anything is published.
- Pages serves with `Cache-Control: max-age=600`: a new release may take up
  to ten minutes to show.
- `deploy-pages` sometimes does not find the artifact just uploaded ("No
  artifacts named github-pages", GitHub side); the job tries once more a
  minute later. Still failing: *Re-run failed jobs*.
- Set up once: *Settings > Pages > Source: GitHub Actions*. The `github-pages`
  environment must let tags deploy (the release event runs on the tag): *No
  restriction*, or a tag rule `*` beside `main`.
- Hosting is transport only: a Manager trusts a tar because its sha256, size
  and signature match, never because of where it came from.

### What the Manager does with it (DEV-534)

`app/release.js`, used by the session:

- **Who offers it.** Only the Manager a PPA serves itself: the module it talks
  to is the origin it was loaded from (`servedByModule` in `app/config.js`),
  the module answered, it is not a playground module and not an EPA (which
  keeps no Manager). A page hosted elsewhere - manager.playground.ence.do -
  never offers one; it is updated where it is hosted.
- **When.** `latest.json` is read once a page load, after the module answered
  (no cookies, 5 s at most), and again on *Check again*. A site that does not
  answer is a state the Software page shows, nothing more.
- **What it offers.** `version` newer than `VERSION` (semver, build metadata
  ignored): *Install*. When the module's `uis` (`/api/system/version`) already
  is `latest.uis`, the module serves the new one and this page is the old one:
  *Reload*.
- **Before the upload.** The tar is fetched from the URL in latest.json, which
  must be on the release site, and goes to the module only when its size and
  SHA-256 match latest.json and the key in its trailer is both the `publisher`
  named there and one of `UI_PUBLISHERS` pinned in `app/release.js`. The
  signature is the module's to check (`check_ui`).
- **The backend's word.** `newuis` from the check-in names a build by its uis.
  The Manager shows it as a second opinion - "the backend names a different
  build", or, with the release site down, "a newer Manager exists" - and never
  installs from it. DEV-534 has the backend side: set `newuis` from the same
  latest.json.
- **The dev server** mocks the release site under `/mockpages`
  (`&releases=http://localhost:8080/mockpages`, honoured only for a module on
  this machine); its tar carries the real publisher key and a signature of
  zeros, which the mock module does not check.
