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
    "sha256": "<hex, as in webroot_src.tar.sha256>",
    "publisher": "<base64 of the 32-byte key in the trailer>"
  }
}
```

- `version` is `VERSION` from `app/version.js`. The tag must be that version,
  with or without a `v`, or the run stops: a release never announces a version
  it does not carry. A Manager compares it with its own `VERSION`.
- `uis` is the version above - what `/api/system/version` reports as `uis` once
  this release is installed.
- `published` is unix seconds; `tar.url` names the tag, not `latest`, so it
  never moves. The newest file is always at
  `https://github.com/encedo/encedo-manager/releases/latest/download/latest.json`.
- `pack.mjs latest` refuses an unsigned tar and one whose signature does not
  check out.
- Not yet tried: whether a browser may read that file cross-origin (CORS on
  GitHub's release downloads). Check with the first release before the Manager
  relies on it.
