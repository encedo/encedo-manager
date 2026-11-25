// The Manager's own releases: where they are published, which key must have
// signed them, and what to make of what the release site and the backend say.
// No DOM in here; the session uses it, the tests drive it.
//
// The release workflow publishes every release on GitHub Pages (pack.mjs site,
// docs/PACKAGING.md): latest.json of the release marked Latest, and each
// release's signed webroot.tar. Pages answers cross-origin; GitHub's release
// downloads do not. Hosting is transport only: a tar is trusted because its
// size, its SHA-256 and the publisher key in its trailer match, and the module
// checks the signature itself before it installs.

export const RELEASES = 'https://encedo.github.io/encedo-manager';

/**
 * The web UI publisher keys a release may carry in its trailer (base64 of the
 * 32-byte Ed25519 public key) - the key the release workflow signs with
 * (repository variable UI_PUBLISHER_KEY), one of the firmware's ui_publishers[].
 */
export const UI_PUBLISHERS = ['Sm8cSfRvRlLgRyEQUE0i/dkHlShYEQ7JA49eXd7fHZo='];

const TRAILER = 96;          // 32-byte public key || 64-byte signature
const SIG_BYTES = 64;

/**
 * '2.1.0' against '2.0.0': 1, -1 or 0. Semver: numbers compared as numbers, a
 * pre-release (2.1.0-rc.1) below its release, build metadata (+mock) ignored.
 * null when either is not a version.
 */
export function compareVersions(a, b) {
  const parse = (v) => {
    const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(String(v ?? '').trim());
    return m ? { core: [Number(m[1]), Number(m[2]), Number(m[3])], pre: m[4] ?? null } : null;
  };
  const x = parse(a), y = parse(b);
  if (!x || !y) return null;
  for (let i = 0; i < 3; i++) if (x.core[i] !== y.core[i]) return x.core[i] > y.core[i] ? 1 : -1;
  if (x.pre === y.pre) return 0;
  if (x.pre === null) return 1;
  if (y.pre === null) return -1;
  const xs = x.pre.split('.'), ys = y.pre.split('.');
  for (let i = 0; i < Math.max(xs.length, ys.length); i++) {
    if (xs[i] === undefined) return -1;
    if (ys[i] === undefined) return 1;
    const xn = /^\d+$/.test(xs[i]), yn = /^\d+$/.test(ys[i]);
    if (xn && yn && Number(xs[i]) !== Number(ys[i])) return Number(xs[i]) > Number(ys[i]) ? 1 : -1;
    if (xn !== yn) return xn ? -1 : 1;
    if (xs[i] !== ys[i]) return xs[i] > ys[i] ? 1 : -1;
  }
  return 0;
}

const isVersion = (v) => compareVersions(v, v) === 0;

/**
 * latest.json as the release site serves it, or an Error saying why not. Only
 * the fields the Manager acts on are checked; the tar has to come from the
 * same site.
 */
export function readLatest(doc, base) {
  const ok = doc && typeof doc === 'object' && doc.product === 'encedo-manager'
    && isVersion(doc.version)
    && typeof doc.uis === 'string' && /^[A-Za-z0-9+/]{43}=$/.test(doc.uis)
    && doc.tar && typeof doc.tar.url === 'string'
    && Number.isSafeInteger(doc.tar.size) && doc.tar.size > TRAILER
    && /^[0-9a-f]{64}$/.test(String(doc.tar.sha256 ?? ''))
    && typeof doc.tar.publisher === 'string';
  if (!ok) throw new Error('latest.json is not a Manager release');
  let url;
  try { url = new URL(doc.tar.url); } catch { throw new Error('latest.json names no tar'); }
  if (url.origin !== new URL(base).origin) throw new Error('latest.json points at a tar on another site');
  return {
    version: doc.version, uis: doc.uis, tag: doc.tag ?? null, published: doc.published ?? null,
    release: doc.release ?? null, tar: { url: url.href, size: doc.tar.size, sha256: doc.tar.sha256, publisher: doc.tar.publisher },
  };
}

/** Fetch latest.json from the release site: no cookies, a few seconds at most. */
export async function fetchLatest(base, { fetchImpl = globalThis.fetch, timeoutMs = 5000, signal = null } = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  const onAbort = () => ctl.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    const res = await fetchImpl(`${base}/latest.json`, { credentials: 'omit', cache: 'no-cache', signal: ctl.signal });
    if (!res.ok) throw new Error(`the release site answered ${res.status}`);
    return readLatest(await res.json(), base);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

/**
 * Is this the tar latest.json describes, carrying a key the Manager trusts?
 * Its size, its SHA-256 and the key in its trailer; the signature is the
 * module's to check (check_ui), which it does before anything is installed.
 * Returns null when it is, or what is wrong.
 */
export async function checkBundle(bytes, latest, publishers = UI_PUBLISHERS) {
  if (bytes.length !== latest.tar.size) return `${bytes.length} bytes, latest.json says ${latest.tar.size}`;
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const hex = [...digest].map((b) => b.toString(16).padStart(2, '0')).join('');
  if (hex !== latest.tar.sha256) return 'its SHA-256 is not the one latest.json gives';
  const key = base64(bytes.subarray(bytes.length - TRAILER, bytes.length - SIG_BYTES));
  if (key !== latest.tar.publisher) return 'it is signed with another key than latest.json names';
  if (!publishers.includes(key)) return 'it is signed with a key this Manager does not know';
  return null;
}

/**
 * What the Software page and the masthead say about the Manager, from the two
 * channels: the release site (latest.json, read by this page) and the backend
 * (newuis in the module's check-in, base64 like uis). DEV-534.
 *
 *   offer        a newer release on the site: Install
 *   reload       the module already has it; this page is the old one
 *   current      the site has nothing newer
 *   unreachable  the site did not answer (or answered nonsense)
 *   none         not checked: not served by a PPA of its own
 *
 * `backend` is set when the backend names a build the site does not:
 * 'other' (the site answered, with another one) or 'newer' (the site did not
 * answer). Never a button - the Manager installs only what the site serves.
 */
export function managerOffer({ eligible, release, newuis, installedUis, version }) {
  if (!eligible || !release) return { state: 'none', latest: null, backend: null };
  const latest = release.latest ?? null;
  if (!latest) return { state: 'unreachable', latest: null, backend: newuis ? 'newer' : null, error: release.error ?? null };
  const backend = newuis && newuis !== latest.uis && newuis !== installedUis ? 'other' : null;
  const newer = compareVersions(latest.version, version) === 1;
  if (newer && installedUis && installedUis === latest.uis) return { state: 'reload', latest, backend };
  return { state: newer ? 'offer' : 'current', latest, backend };
}

function base64(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
