// The Manager's view of one module, with no DOM in it: pages render from
// `session.state` and re-render on the 'change' event; Node tests drive it
// against a mock. Every network call goes through hem-sdk-js.

import { HEM, HemError } from '../../sdk/hem-sdk.browser.js';

export const SIGNIN_SCOPE = 'system:config';
export const SIGNIN_EXP = 3600;

export class Session extends EventTarget {
  constructor({ hem, broker }, { HEMClass = HEM } = {}) {
    super();
    this.urls = { hem, broker };
    this.hem = new HEMClass(hem, { broker });
    this.state = {
      phase: 'probing',        // probing | reachable | signed-in
      attempts: 0,
      lastError: null,         // HemError from the last failed probe or action
      version: null,           // getVersion()
      status: null,            // getStatus()
      health: null,            // hemCheckin() answer, when the broker answered
      online: null,            // true: broker reachable; false: air-gapped; null: not tried
      paired: null,            // true when at least one phone is paired; null when unknown
      mode: null,              // 'password' | 'phone' once signed in
      config: null,            // getConfig() once signed in
      phones: null,            // listExtAuth() once signed in and online
    };
  }

  #set(patch) {
    Object.assign(this.state, patch);
    this.dispatchEvent(new Event('change'));
  }

  // -- reaching the module -----------------------------------------------------

  /** One version probe with a cancellable timeout. Resolves true when the module answered. */
  async probe({ timeoutMs = 2000, signal = null } = {}) {
    try {
      const version = await this.hem.getVersion({ timeoutMs, signal });
      this.#set({ version, phase: this.state.phase === 'probing' ? 'reachable' : this.state.phase, lastError: null });
      return true;
    } catch (e) {
      if (e instanceof HemError && e.code === 'aborted' && signal?.aborted) throw e;
      this.#set({ attempts: this.state.attempts + 1, lastError: e });
      return false;
    }
  }

  /** Probe until the module answers or `signal` cancels. */
  async waitForDevice({ intervalMs = 2000, timeoutMs = 2000, signal = null } = {}) {
    while (!(await this.probe({ timeoutMs, signal }))) {
      await sleep(intervalMs, signal);
    }
  }

  /**
   * After the module answered: read its status, try the check-in, and ask the
   * broker whether a phone is paired. A broker that does not answer leaves the
   * session usable — password sign-in and everything on the module still work.
   */
  async prepare() {
    const status = await this.hem.getStatus({ timeoutMs: 5000 });
    let health = null, online = false, paired = null;
    try {
      health = await this.hem.hemCheckin();
      online = true;
    } catch (e) {
      if (!(e instanceof HemError)) throw e;
    }
    if (online) {
      try { paired = await this.hem.hasExtAuth(); } catch (e) { if (!(e instanceof HemError)) throw e; }
    }
    this.#set({ status, health, online, paired, lastError: null });
  }

  // -- signing in --------------------------------------------------------------

  async signIn(password) {
    const token = await this.hem.authorizePassword(password, SIGNIN_SCOPE, SIGNIN_EXP);
    await this.#afterSignIn('password', token);
  }

  async signInWithPhone({ signal = null, onPending = null, pollTimeout = 180_000 } = {}) {
    const token = await this.hem.authorizeRemote(SIGNIN_SCOPE, { pollInterval: 2000, pollTimeout, onPending, signal });
    await this.#afterSignIn('phone', token);
  }

  async #afterSignIn(mode, token) {
    const config = await this.hem.getConfig(token);
    let phones = null;
    if (this.state.online) {
      try { phones = await this.hem.listExtAuth(token); } catch (e) { if (!(e instanceof HemError)) throw e; }
    }
    this.#set({ phase: 'signed-in', mode, config, phones, lastError: null });
  }

  signOut() {
    this.hem.clearKeys();
    this.#set({ phase: 'reachable', mode: null, config: null, phones: null, lastError: null });
  }

  /**
   * A token for `scope`. With a password session the cached derived key signs
   * a fresh request; with a phone session the phone is asked again.
   */
  async token(scope, opts = {}) {
    if (this.state.phase !== 'signed-in') throw new HemError('Not signed in', { code: 'not_signed_in' });
    if (this.state.mode === 'password') return this.hem.authorizePassword(null, scope);
    return this.hem.authorizeRemote(scope, { pollInterval: 2000, pollTimeout: 180_000, ...opts });
  }

  // -- the module --------------------------------------------------------------

  async refreshStatus() {
    const status = await this.hem.getStatus({ timeoutMs: 5000 });
    this.#set({ status, lastError: null });
    return status;
  }

  /** Disks from getStatus(): [{ index, bytes, state }] with state locked | ro | rw. */
  disks() { return parseStorage(this.state.status); }

  async unlockDisk(index, mode = 'ro') {
    const scope = mode === 'rw' ? `storage:disk${index}:rw` : `storage:disk${index}`;
    await this.hem.unlockStorage(await this.token(scope));
    await this.refreshStatus();
  }

  async lockDisk(index) {
    await this.hem.lockStorage(await this.token(`storage:disk${index}:rw`));
    await this.refreshStatus();
  }
}

// -- helpers ---------------------------------------------------------------------

/** status.storage is ["<512-byte sectors>:<state>", ...]; state is '-', 'ro' ('r') or 'rw'. */
export function parseStorage(status) {
  if (!status?.storage) return [];
  return status.storage.map((entry, index) => {
    const [sectors, st] = String(entry).split(':');
    const state = st === 'rw' ? 'rw' : (st === 'ro' || st === 'r') ? 'ro' : 'locked';
    return { index, bytes: Number(sectors) * 512, state };
  });
}

export function formatBytes(n) {
  if (!Number.isFinite(n) || n <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  const v = n / 1024 ** i;
  const rounded = Math.round(v * 10) / 10;
  return `${v >= 100 || i === 0 || Number.isInteger(rounded) ? Math.round(v) : rounded.toFixed(1)} ${units[i]}`;
}

export function formatUptime(seconds) {
  const s = Number(seconds);
  if (!Number.isFinite(s) || s < 0) return null;
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d ? `${d} d ${h} h` : h ? `${h} h ${m} min` : `${m} min`;
}

/** What to tell a person about a failure. */
export function describeError(e) {
  if (!(e instanceof HemError)) return e?.message ?? String(e);
  switch (e.code) {
    case 'http_401':
    case 'http_403': return 'The password is not correct.';
    case 'denied': return 'The phone declined the request.';
    case 'timeout': return 'The request timed out.';
    case 'aborted': return 'Cancelled.';
    case 'network': return 'The module did not answer.';
    case 'broker_error': return 'The Encedo backend did not answer.';
    case 'auth_password_required': return 'Sign in with the password first.';
    default: return e.message;
  }
}

export function sleep(ms, signal = null) {
  return new Promise((resolve, reject) => {
    const abort = () => reject(new HemError('Cancelled', { code: 'aborted' }));
    if (signal?.aborted) return abort();
    const t = setTimeout(() => { signal?.removeEventListener('abort', onAbort); resolve(); }, ms);
    const onAbort = () => { clearTimeout(t); abort(); };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
