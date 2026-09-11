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

Confirmed against the release in hand: the 32 bytes are the public key of the
signing key, and they are the value the module reports as `uis` in
`/api/system/version`.

**From 2026-09-11 the signature is made by hand**, by a release engineer with a
YubiKey, the way firmware is signed — and it covers the **SHA-256 of the tar**,
not the tar itself. So the pipeline stops at `webroot_src.tar` and hands over a
digest; the engineer signs the digest and the trailer is appended.

Verifying one, then, is: take the last 96 bytes off, SHA-256 what is left,
check the signature over that digest with the key in the trailer — and check
that key against the one the module trusts. **The key in the trailer names the
signer; it does not vouch for it.** Whatever verifies a bundle has to hold the
expected public key of its own, or anybody can append a key of their own making
along with a matching signature.

## Before the first release under the new scheme

Three things to settle with the firmware side, because the module's
`check_ui` is what decides whether a bundle installs, and it is the firmware —
not the signing tool — that defines the format:

1. **Exactly which bytes are hashed.** The tar without the trailer, which is
   the only thing that can work, but it should be written into the firmware
   spec rather than inferred.
2. **What `check_ui` expects today.** The signature on the release in hand does
   not verify as Ed25519 over the plain tar body, nor over its SHA-256, so the
   old `signer2` framed the message somehow before signing. If the firmware
   checks that framing, moving to a plain signature over the digest is a
   firmware change as well as a process change.
3. **Where the trusted key lives** in the module, and how it is rotated.

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
