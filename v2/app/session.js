// The Manager's view of one module, with no DOM in it: pages render from
// `session.state` and re-render on the 'change' event; Node tests drive it
// against a mock. Every network call goes through hem-sdk-js.

import { HEM, HemError, verifyLog, verifyLoggerKey, generateMnemonic } from '../../sdk/hem-sdk.browser.js';

export const SIGNIN_SCOPE = 'system:config';
export const SIGNIN_EXP = 3600;

export class Session extends EventTarget {
  constructor({ hem, broker }, { HEMClass = HEM } = {}) {
    super();
    this.urls = { hem, broker };
    this.hem = new HEMClass(hem, { broker });
    this.state = {
      phase: 'probing',        // probing | reachable | unpersonalised | signed-in
      model: null,             // 'ppa' | 'epa', read off the version once the module answers
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
      keys: null,              // the keychain, once a page has asked for it
      logs: null,              // { ids, key, signed } once the log page has asked
      selftest: null,          // the last health check this session ran
      master: false,           // the settings were unlocked with the 24 words
      asking: null,            // { scope, since, until, cancel } while a phone is being asked for a token
      setup: null,             // personalisation in progress: { step, status, fields, result, error }
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
      const model = /EPA/i.test(String(version?.hwv ?? '')) ? 'epa' : 'ppa';
      this.#set({ version, model, phase: this.state.phase === 'probing' ? 'reachable' : this.state.phase, lastError: null });
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
    // A module out of the box says so with `inited` in its status — the one
    // field a personalised module never sends. Nothing opens it until then.
    const phase = isUnpersonalised(status) ? 'unpersonalised'
      : this.state.phase === 'unpersonalised' ? 'reachable' : this.state.phase;
    this.#set({ status, health, online, paired, phase, lastError: null });
    if (online && phase !== 'unpersonalised') await this.checkPaired();
  }

  /**
   * Ask the broker whether a phone is paired with this module — no token
   * needed, so the sign-in form can offer the phone. Asked again every time
   * the form is about to show, not once at start: a phone paired or unpaired
   * in the meantime changes the answer. Null when the broker could not say.
   */
  async checkPaired() {
    if (!this.state.online) { this.#set({ paired: null }); return null; }
    let paired = null;
    try { paired = await this.hem.hasExtAuth(); } catch (e) { if (!(e instanceof HemError)) throw e; }
    this.#set({ paired });
    return paired;
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
    this.hem.clearKeys();      // derived keys and every cached token, master included
    this.#set({ phase: 'reachable', mode: null, config: null, phones: null, keys: null, logs: null, master: false, lastError: null });
    if (this.state.online) this.checkPaired().catch(() => {});
  }

  /**
   * A token for `scope`. With a password session the cached derived key signs
   * a fresh request; with a phone session the phone is asked again.
   */
  async token(scope, opts = {}) {
    if (this.state.phase !== 'signed-in') throw new HemError('Not signed in', { code: 'not_signed_in' });
    if (this.state.mode === 'password') return this.hem.authorizePassword(null, scope);
    return this.askPhone(scope, opts);
  }

  /**
   * A token for `scope` from the phone. The SDK answers from its cache when it
   * can; otherwise the phone gets a request, and while it is being waited for
   * `state.asking` says which scope, until when, and how to give up — so the
   * page can tell the person to pick the phone up. One request at a time: a
   * second scope waits for the first to finish rather than sending two pushes.
   */
  async askPhone(scope, { pollTimeout = 180_000, signal = null, ...opts } = {}) {
    const cached = this.hem.tokens.find((t) => t.scope === scope && t.exp > Date.now() / 1000 + 5);
    if (cached) return this.hem.authorizeRemote(scope);          // the SDK hands the cached one back
    while (this.state.asking) await this.state.asking.done.catch(() => {});
    const ctl = new AbortController();
    signal?.addEventListener('abort', () => ctl.abort(), { once: true });
    const asking = { scope, since: Date.now(), until: Date.now() + pollTimeout, cancel: () => ctl.abort(), done: null };
    asking.done = (async () => {
      try {
        return await this.hem.authorizeRemote(scope, { pollInterval: 2000, pollTimeout, ...opts, signal: ctl.signal });
      } finally {
        if (this.state.asking === asking) this.#set({ asking: null });
      }
    })();
    this.#set({ asking });
    return asking.done;
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

  // -- the keychain ------------------------------------------------------------

  /**
   * Every key in the repository. The device answers one page at a time and says
   * how many keys it holds, so this asks again until it has them all; a PPA
   * keychain is small enough that the page can then search it without asking.
   */
  async loadKeys({ pageSize = 50 } = {}) {
    const token = await this.token('keymgmt:list');
    let page = await this.hem.listKeys(token, 0, pageSize);
    const list = [...page.list];
    while (list.length < page.total && page.list.length) {
      page = await this.hem.listKeys(token, list.length, pageSize);
      list.push(...page.list);
    }
    const keys = list.map(describeKey);
    this.#set({ keys, lastError: null });
    return keys;
  }

  /**
   * Keys whose description starts with `pattern`, matched by the device rather
   * than here — this is how a paired phone's keychain entry is found ('EXTAID'
   * + pid). A device with nothing to show answers 404, which is emptiness, not
   * a failure.
   */
  async findKeys(pattern) {
    const token = await this.token('keymgmt:search');
    try {
      return (await this.hem.searchKeys(token, pattern)).map(describeKey);
    } catch (e) {
      if (e instanceof HemError && e.code === 'http_404') return [];
      throw e;
    }
  }

  /** Type and public key of one entry; the list carries no key bytes. */
  async keyPublic(kid) {
    const data = await this.hem.getPubKey(await this.token('keymgmt:get'), kid);
    return { kid, type: data.type ?? '', pubkey: data.pubkey ?? data.der ?? '', updated: data.updated ?? null };
  }

  /**
   * Generate a key pair inside the module; the private half never comes out.
   * `descr` is the description field as base64 — it is bytes on the device, and
   * a caller that has text to put there encodes it with toB64Text() first.
   */
  async createKey({ label, type, mode = null, descr = '' }) {
    const { kid } = await this.hem.createKeyPair(await this.token('keymgmt:gen'), asLabel(label), type, asB64Field(descr), mode);
    await this.loadKeys();
    return kid;
  }

  /** Import someone else's public key, pasted as base64 or hex. */
  async importKey({ label, type, mode = null, pubkey, descr = '' }) {
    const bytes = parseKeyBytes(pubkey);
    const { kid } = await this.hem.importPublicKey(await this.token('keymgmt:imp'), asLabel(label), type, bytes, asB64Field(descr), mode);
    await this.loadKeys();
    return kid;
  }

  /** Label and description are the only parts of a key that can change. */
  async renameKey(kid, label, descr) {
    await this.hem.updateKey(await this.token('keymgmt:upd'), kid, asLabel(label), asB64Field(descr));
    await this.loadKeys();
  }

  async removeKey(kid) {
    await this.hem.deleteKey(await this.token('keymgmt:del'), kid);
    await this.loadKeys();
  }

  /**
   * E-mail a share code to someone. This is the one keychain action that needs
   * the backend; air-gapped, the code is copied out of the page by hand.
   */
  async shareKeyByEmail(email, code) {
    if (!this.state.online) throw new HemError('The Encedo backend is unreachable', { code: 'broker_error' });
    return this.hem.broker.shareEmailPubkey(email, code);
  }

  // -- paired phones -----------------------------------------------------------

  /**
   * Every phone this module knows, from both places a pairing lives: the
   * keychain, where the phone's key sits with 'EXTAID' + pid for a description,
   * and the broker, which routes requests to it. The two agree when nothing
   * went wrong; a phone in one place only is shown as such, not hidden.
   * `atBroker` is null while the broker has not been asked (offline).
   */
  pairedPhones() {
    if (!this.state.keys) return [];                    // not until the keychain is read
    const keys = this.state.keys.filter((k) => k.phone);
    const listed = this.state.phones;                   // null: not asked
    const byPid = new Map(listed?.map((p) => [String(p.pid), p]) ?? []);
    const phones = keys.map((k) => ({
      kid: k.kid,
      pid: k.phone,
      label: k.label || byPid.get(k.phone)?.label || '',
      created: k.created,
      updated: k.updated,
      inKeychain: true,
      atBroker: listed ? byPid.has(k.phone) : null,
    }));
    const known = new Set(keys.map((k) => k.phone));
    for (const p of listed ?? []) {
      if (known.has(String(p.pid))) continue;
      phones.push({ kid: null, pid: String(p.pid), label: p.label || '', created: null, updated: null, inKeychain: false, atBroker: true });
    }
    return phones;
  }

  /** Ask the broker again which phones it routes to. Needs the backend. */
  async refreshPhones() {
    if (!this.state.online) return this.state.phones;
    const phones = await this.hem.listExtAuth(await this.token('system:config'));
    this.#set({ phones, paired: phones.length > 0, lastError: null });
    return phones;
  }

  /**
   * Pair a phone. The module makes a challenge, the broker turns it into a
   * one-time link, and `onQrCode` gets the exact JSON the Encedo Mobile
   * Authenticator scans: that link, a hash of the challenge, and who the
   * module belongs to. Then this waits for the phone; `signal` gives up.
   * Once the module has checked the phone's reply, the phone is a key in the
   * keychain and a subscriber at the broker, and both lists are read again.
   */
  async pairPhone({ onQrCode = null, onPending = null, signal = null, pollInterval = 2000, pollTimeout = 60_000 } = {}) {
    if (!this.state.online) throw new HemError('The Encedo backend is unreachable', { code: 'broker_error' });
    const token = await this.token('system:config');
    const result = await this.hem.registerExtAuth(token, { onQrCode, onPending, signal, pollInterval, pollTimeout });
    await this.loadKeys();
    await this.refreshPhones().catch((e) => { if (!(e instanceof HemError)) throw e; });
    return result;
  }

  /**
   * Unpair a phone: gone from the broker, so nothing is routed to it, and gone
   * from the keychain, so the module would not believe it anyway. Offline, the
   * key still goes — that is the half that revokes — and the broker is told
   * when it next answers; the return value says which halves were done.
   */
  async unpairPhone({ pid, kid }, { skipBroker = false } = {}) {
    const done = { broker: false, key: false };
    if (pid && this.state.online && !skipBroker) {
      try {
        await this.hem.deleteExtAuth(await this.token('system:config'), pid);
        done.broker = true;
      } catch (e) {
        // The broker refusing (4xx: unknown pid, a subscription already gone)
        // is not a reason to keep the key. The caller asks the person and, on
        // yes, comes back with skipBroker — as if the refusal had not happened.
        if (e instanceof HemError && e.status >= 400 && e.status < 500) {
          throw new HemError(`The Encedo backend refused to unpair it (HTTP ${e.status})`, { code: 'broker_refused', status: e.status, data: e.data });
        }
        throw e;
      }
    }
    if (kid) {
      await this.hem.deleteKey(await this.token('keymgmt:del'), kid);
      done.key = true;
    }
    if (this.state.keys) await this.loadKeys();
    await this.refreshPhones().catch((e) => { if (!(e instanceof HemError)) throw e; });
    return done;
  }

  // -- personalisation -----------------------------------------------------------

  /** The prefixes the broker hands out for free: ['my', 'dev', ...]. None while offline. */
  async domainPredefs() {
    if (!this.state.online) return [];
    try {
      const answer = await this.hem.broker.domainPredefs();
      return Array.isArray(answer?.prefix) ? answer.prefix : [];
    } catch (e) {
      if (!(e instanceof HemError)) throw e;
      return [];
    }
  }

  /**
   * Personalise a module out of the box, the way Manager v1 did it:
   *   1. 24 words are made here; they ARE the master key, and the password
   *      derives the everyday key. Neither leaves the browser.
   *   2. POST /api/auth/init with the configuration, signed by the master key.
   *      The module answers with a token for what follows, and an instance id.
   *   3. A PPA formats its drive; this waits until `format` says done.
   *   4. With the backend reachable, the name under ence.do: a free one is
   *      registered at once; one of the owner's own is confirmed by e-mail
   *      first. The tls block goes to the module. Offline, the module keeps
   *      my.ence.do and the certificate can be fetched later from Settings.
   * `state.setup` follows every step, so the page can say where it is. The
   * words stay in it until finishPersonalisation() or rollbackPersonalisation().
   */
  async personalise(fields, { signal = null, pollInterval = 4000 } = {}) {
    const online = this.state.online === true;
    const custom = Boolean(fields.custom) && online;
    const prefix = online ? String(fields.prefix || 'my').trim() : 'my';
    const hostname = `${prefix}.ence.do`;
    const progress = (step, status = null) => this.#set({ setup: { ...this.state.setup, step, status } });
    this.#set({ setup: { step: 'words', status: null, fields: { ...fields, hostname }, result: null, error: null } });

    try {
      const words = await generateMnemonic(256);
      progress('init');
      const cfg = {
        user: String(fields.user ?? '').trim(),
        email: String(fields.email ?? '').trim(),
        hostname,
        ip: fields.ip || '192.168.7.1',
        dnsd: false,
        trusted_ts: Boolean(fields.trusted_ts),
        trusted_backend: Boolean(fields.trusted_backend),
        allow_keysearch: Boolean(fields.allow_keysearch),
        origin: '*',
        ctx: 0,
      };
      if (this.state.model !== 'epa') {          // an EPA has no drive to lay out
        cfg.storage_mode = fields.storage_mode ?? 0x51;
        cfg.storage_disk0size = fields.storage_disk0size ?? 8388608;
      }
      if (custom) cfg.gen_csr = true;
      const init = await this.hem.initialize({ mnemonic: words }, fields.password, cfg);
      if (!init?.token) throw new HemError('The module accepted nothing', { code: 'init_failed' });
      const result = { words, token: init.token, instanceid: init.instanceid ?? null, hostname, genuine: init.genuine ?? null, csr: init.csr ?? null, tls: null, rebootRequired: hostname !== 'my.ence.do', config: null };
      this.#set({ setup: { ...this.state.setup, result } });
      // The ids the proof document names (eid, devid, eid_sign) live in the config.
      try { result.config = await this.hem.getConfig(init.token); } catch (e) { if (!(e instanceof HemError)) throw e; }

      progress('format');
      await this.#waitFormatted(signal);

      if (online) {
        progress('domain');
        const tls = await this.#registerAfterInit(result, prefix, custom, cfg.ip, { signal, pollInterval, onPending: (status) => progress('email', status) });
        progress('tls');
        const answer = await this.hem.setConfig(result.token, { tls });
        result.tls = tls;
        if (answer?.reboot_required) result.rebootRequired = true;
      }
      progress('done');
      return result;
    } catch (e) {
      this.#set({ setup: { ...this.state.setup, step: 'failed', error: e } });
      throw e;
    }
  }

  /**
   * The name under ence.do, with what the init answered: its attestation and,
   * for a name of the owner's own, the CSR it made. A free name registers at
   * once; the other waits for the e-mail click. Without an attestation from
   * the init, the SDK's registerDomain fetches one from the auth challenge.
   */
  async #registerAfterInit(result, prefix, custom, ip, { signal, pollInterval, onPending }) {
    const broker = this.hem.broker;
    if (result.genuine && (!custom || result.csr)) {
      let tls = await broker.domainRegister(prefix, { genuine: result.genuine, csr: custom ? result.csr : null, ip });
      if (!tls?.crt && tls?.id) tls = await broker.waitDomain(tls.id, { pollInterval, pollTimeout: 240_000, onPending, signal });
      return tls;
    }
    return this.hem.registerDomain(result.token, prefix, { ip, newCertificate: custom, pollInterval, onPending, signal });
  }

  /** A PPA formats its drive after the init; `format` in the status says how far it is. */
  async #waitFormatted(signal, { intervalMs = 1000, timeoutMs = 180_000 } = {}) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      let status;
      try { status = await this.hem.getStatus({ timeoutMs: 5000 }); } catch (e) { if (!(e instanceof HemError)) throw e; }
      if (status) {
        this.#set({ status });
        if (status.format === undefined || status.format === 'done') return status;
      }
      await sleep(intervalMs, signal);
    }
    throw new HemError('The module did not finish formatting in time', { code: 'timeout' });
  }

  /**
   * Undo a personalisation that did not get to the end: the module is wiped
   * with the token the init gave, and comes back out of the box. Nothing is
   * kept here either — the words go with it.
   */
  async rollbackPersonalisation() {
    const token = this.state.setup?.result?.token;
    if (token) {
      try { await this.hem.setConfig(token, { wipeout: true }); } catch (e) { if (!(e instanceof HemError)) throw e; }
    }
    this.hem.clearKeys();
    this.#set({ setup: null, phase: 'probing', attempts: 0, status: null, config: null, keys: null, lastError: null });
  }

  /**
   * Done with the words on paper: forget them here. A module that got a name
   * of its own reboots to answer to it; one that kept my.ence.do just goes to
   * the sign-in. Either way this browser starts over from the probe.
   */
  async finishPersonalisation() {
    const result = this.state.setup?.result;
    if (!result) throw new HemError('Nothing to finish', { code: 'not_personalising' });
    const reboot = Boolean(result.rebootRequired);
    if (reboot) {
      try { await this.hem.reboot(result.token); } catch (e) { if (!(e instanceof HemError)) throw e; }
    }
    this.hem.clearKeys();
    this.#set({ setup: null, phase: 'probing', attempts: 0, status: null, paired: null, lastError: null });
    return { reboot, hostname: result.hostname };
  }

  // -- the settings ------------------------------------------------------------

  /** Read the configuration again — after saving, or after unlocking it. */
  async refreshConfig() {
    const config = await this.hem.getConfig(await this.token('system:config'));
    this.#set({ config, lastError: null });
    return config;
  }

  /** Write only what changed, and read back what the module made of it. */
  async saveConfig(patch) {
    await this.hem.setConfig(await this.token('system:config'), patch);
    return this.refreshConfig();
  }

  /**
   * Change the everyday password. The module then answers to a key this browser
   * no longer holds, so the session ends here: the next sign-in uses the new one.
   * The 24 words are untouched.
   */
  async changePassword(newPassword) {
    await this.hem.setUserPassword(await this.token('system:config'), newPassword);
    this.hem.clearKeys();
    this.#set({ phase: 'reachable', mode: null, config: null, keys: null, logs: null, selftest: null, master: false });
  }

  /**
   * Take a token with the 24 words instead of the password. The SDK caches it by
   * scope, so what follows is authorised by the master secret without asking again.
   */
  async authorizeMaster(mnemonic) {
    await this.hem.authorizeMaster(mnemonic, SIGNIN_SCOPE, SIGNIN_EXP);
    this.#set({ master: true, lastError: null });
  }

  /** Register a name for this module under ence.do. Needs the backend. */
  async registerDomain(prefix) {
    if (!this.state.online) throw new HemError('The Encedo backend is unreachable', { code: 'broker_error' });
    const tls = await this.hem.registerDomain(await this.token('system:config'), prefix, { pollInterval: 1000 });
    await this.refreshConfig().catch(() => {});
    return tls;
  }

  /** Is this name free? The broker answers 200 for taken, 404 for free. */
  async domainTaken(prefix) { return this.hem.broker.domainTaken(prefix); }

  /**
   * Wipe the module: keys, drives, configuration, the lot. It comes back as it
   * left the factory, so this session is over the moment the module accepts it.
   */
  async wipeout() {
    await this.hem.setConfig(await this.token('system:config'), { wipeout: true });
    this.hem.clearKeys();
    this.#set({ phase: 'probing', attempts: 0, mode: null, config: null, status: null, keys: null, logs: null, selftest: null, master: false });
  }

  // -- the hardware ------------------------------------------------------------

  /**
   * Run the module's own health check. It exercises the entropy source and the
   * known-answer tests, so it takes a moment and the module is busy while it
   * runs; the answer is a set of counters, 0 meaning nothing wrong.
   */
  async selftest() {
    const result = await this.hem.selftest(await this.token('system:config'));
    await this.refreshStatus().catch(() => {});      // fls_state may have moved
    this.#set({ selftest: result });
    return result;
  }

  /** Reboot the module. Everything unlocked locks, and this browser loses it. */
  async reboot() {
    const answer = await this.hem.reboot(await this.token('system:config'));
    this.#set({ phase: 'probing', attempts: 0, status: null, keys: null, logs: null });
    return answer;
  }

  /** Scopes this browser can still use without asking the person again. */
  tokens() { return this.hem.tokens; }
  forgetTokens() { this.hem.clearCache(); this.#set({}); }

  // -- the operation log -------------------------------------------------------

  /**
   * The log files the module still holds, and the key it seals them with. The
   * key comes with a nonce the module signs on the spot: without that, a key is
   * only a number, and verifying files against it would prove nothing.
   */
  async loadLogs() {
    const token = await this.token('logger:get');
    const loggerKey = await this.hem.getLoggerKey(token);
    const signed = await verifyLoggerKey(loggerKey);

    let page = await this.hem.listLog(token, 0);
    const ids = [...(page.id ?? [])];
    const total = Number(page.total ?? ids.length);
    let guard = 0;
    while (ids.length < total && page.id?.length && guard++ < 100) {
      page = await this.hem.listLog(token, ids.length);
      if (!page.id?.length) break;
      ids.push(...page.id);
    }
    const logs = { ids, key: loggerKey.key ?? '', signed, total: ids.length };
    this.#set({ logs, lastError: null });
    return logs;
  }

  /**
   * One log file, verified here rather than taken on trust. The device is asked
   * for the file only; the key is the one loadLogs() already checked, so reading
   * ten files costs ten requests and not twenty.
   */
  async readLog(id) {
    const token = await this.token('logger:get');
    let answer;
    try {
      answer = await this.hem.getLogEntry(token, id);
    } catch (e) {
      // The module refuses the file it is writing into right now with a 406.
      // Watched across two archive runs of a real PPA, it was the newest file
      // both times, and both times it read fine once that session had ended.
      if (e instanceof HemError && e.code === 'http_406') {
        throw new HemError('The module is still writing this file', { code: 'log_in_progress' });
      }
      throw e;
    }
    const text = typeof answer === 'string' ? answer : JSON.stringify(answer);
    const key = this.state.logs?.key || (await this.hem.getLoggerKey(token)).key;
    const result = await verifyLog(key, text);
    return { id, text, ...result };
  }
}

// -- helpers ---------------------------------------------------------------------

/** A module out of the box carries `inited` in its status; a personalised one never does. */
export const isUnpersonalised = (status) => status != null && typeof status === 'object' && 'inited' in status;

/**
 * The storage mode byte, as Manager v1 composed it from three answers: is the
 * regular disk shown when the module is plugged in, read-only or writable when
 * it is, and CTR or XTS for the secure drive's cipher.
 *   0x50 CTR, hidden · 0x51 CTR, shown read-only · 0x53 CTR, shown writable
 *   0xA0 XTS, hidden · 0xA1 XTS, shown read-only · 0xA3 XTS, shown writable
 */
export function storageMode({ show = true, rw = false, xts = false } = {}) {
  return (xts ? 0xa0 : 0x50) | (show ? (rw ? 0x03 : 0x01) : 0x00);
}
export function parseStorageMode(mode) {
  const m = Number(mode);
  return { xts: (m & 0xf0) === 0xa0, show: (m & 0x03) !== 0, rw: (m & 0x03) === 0x03 };
}

/** Sectors of 512 bytes to whole gigabytes (GiB) and back — what the init takes and the person reads. */
export const SECTORS_PER_GB = 2097152;
export const sectorsToGb = (sectors) => Math.floor(Number(sectors || 0) / SECTORS_PER_GB);
export const gbToSectors = (gb) => Math.max(0, Math.round(Number(gb || 0))) * SECTORS_PER_GB;

/** What a prefix under ence.do may look like: lower-case letters, digits, dashes inside. */
export const isPrefix = (value) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(String(value ?? ''));

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

/** Base64 of a string's UTF-8 bytes, and back. */
export const toB64Text = (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s ?? '')));
export const fromB64Text = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
export const bytesToB64 = (bytes) => btoa(String.fromCharCode(...bytes));

export const bytesToHex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');

/** The description is a fixed 128-byte field; only what precedes the padding counts. */
export function trimField(bytes) {
  if (!bytes?.length) return new Uint8Array(0);
  let end = bytes.length;
  while (end > 0 && bytes[end - 1] === 0) end--;
  return bytes.subarray(0, end);
}

/**
 * The bytes as text, but only if every one of them is printable ASCII. The
 * description field holds bytes, and running a decoder over bytes that are not
 * text produces replacement characters that look like data and are not — so
 * this answers null rather than guess, and the UI shows base64 instead.
 */
export function asciiText(bytes) {
  const field = trimField(bytes);
  if (!field.length) return null;
  for (const byte of field) if (byte < 0x20 || byte > 0x7e) return null;
  return String.fromCharCode(...field);
}

/** Does the field begin with these ASCII characters? A byte test, not a decode. */
export function startsWithAscii(bytes, text) {
  if (!bytes || bytes.length < text.length) return false;
  return [...text].every((c, i) => bytes[i] === c.charCodeAt(0));
}

/**
 * A paired phone's keychain entry. Manager v1 matched it as the description's
 * base64 being 'RVhUQUlE' + pid — base64('EXTAID') with the broker's pid, which
 * is itself base64, written straight after it. So the pid is the tail of the
 * field's base64, not the tail of its bytes: read the bytes as text and the
 * pid comes out as nonsense that matches nothing the broker says.
 */
export const PHONE_PREFIX = 'EXTAID';
export const PHONE_PREFIX_B64 = 'RVhUQUlE';
export const phonePid = (descrB64) => (descrB64?.startsWith(PHONE_PREFIX_B64) && descrB64.length > PHONE_PREFIX_B64.length ? descrB64.slice(PHONE_PREFIX_B64.length) : null);

/**
 * What a page needs to know about one key. The device's type is a comma list
 * with the algorithm last: 'PKEY' means the private half is in the module,
 * 'ATT' that the module attests to it, 'ECDH' / 'ExDSA' what it may be used
 * for. Everything else is read out of the description.
 */
export function describeKey(k) {
  const parts = String(k.type ?? '').split(',').filter(Boolean);
  const algorithm = parts.at(-1) ?? '';
  const flags = parts.slice(0, -1);
  const symmetric = /^(AES|SHA)/.test(algorithm);
  const descrB64 = bytesToB64(trimField(k.description));
  return {
    kid: k.kid,
    label: k.label ?? '',
    type: k.type ?? '',
    algorithm,
    flags,
    uses: flags.filter((f) => f === 'ECDH' || f === 'ExDSA'),
    attested: flags.includes('ATT'),
    symmetric,
    sealed: flags.includes('PKEY') || symmetric,   // the module holds secret material
    phone: phonePid(descrB64),               // the broker's pid, or null for a key that is not a phone
    created: k.created ?? null,
    updated: k.updated ?? null,
    // The description is a byte field and stays one: base64 is what the module
    // gave us and what goes back, hex is for reading it. Nothing decodes it.
    description: k.description ?? null,
    descrB64,
    descrHex: bytesToHex(trimField(k.description)),
  };
}

/**
 * What the module gives each field: a label in characters, a description in
 * bytes. These are the firmware in preparation, which doubles both — a module
 * on older firmware takes 32 and 64, refuses anything longer, and the page
 * shows what it said. The Manager ships with the firmware, so it counts to the
 * new sizes.
 */
export const LABEL_CHARS = 64;
export const DESCR_BYTES = 128;

/** The label is ASCII and nothing else: 0x20 to 0x7F, the range the module stores. */
export const isAsciiLabel = (value) => [...String(value ?? '')]
  .every((ch) => { const code = ch.codePointAt(0); return code >= 0x20 && code <= 0x7f; });

export function asLabel(value) {
  const text = String(value ?? '');
  for (const ch of text) {
    const code = ch.codePointAt(0);
    if (code < 0x20 || code > 0x7f) {
      throw new HemError(`The label takes ASCII only, and “${ch}” is not part of it`, { code: 'bad_label' });
    }
  }
  if (text.length > LABEL_CHARS) {
    throw new HemError(`The label holds ${LABEL_CHARS} characters and that is ${text.length}`, { code: 'label_too_long' });
  }
  return text;
}

/** How many bytes a base64 string stands for, or null when it is not base64. */
export function b64ByteLength(value) {
  const text = String(value ?? '').trim();
  if (!text) return 0;
  if (text.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(text)) return null;
  return (text.length / 4) * 3 - (text.endsWith('==') ? 2 : text.endsWith('=') ? 1 : 0);
}

/** UTF-8 bytes a string takes up — what the device counts, not what the eye does. */
export const textByteLength = (value) => new TextEncoder().encode(String(value ?? '')).length;

/**
 * The description field goes to the device as base64 and comes back as base64,
 * because it holds bytes and not every key's bytes are text. Anything that is
 * not base64, or too long for the field, is a caller's mistake — and saying so
 * beats writing rubbish into a field that cannot be read back any other way.
 */
export function asB64Field(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const bytes = b64ByteLength(text);
  if (bytes === null) throw new HemError('The description must be base64', { code: 'bad_description' });
  if (bytes > DESCR_BYTES) {
    throw new HemError(`The description field holds ${DESCR_BYTES} bytes and that is ${bytes}`, { code: 'descr_too_long' });
  }
  return text;
}

/** A public key pasted as base64 or as hex. Hex wins when it could be either. */
export function parseKeyBytes(text) {
  const s = String(text ?? '').replace(/\s+/g, '');
  if (!s) throw new HemError('Paste the public key first', { code: 'bad_key' });
  if (s.length >= 40 && s.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(s)) {
    return Uint8Array.from(s.match(/../g), (b) => parseInt(b, 16));
  }
  try {
    return Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
  } catch {
    throw new HemError('That is neither base64 nor hex', { code: 'bad_key' });
  }
}

/**
 * The share-code envelope Manager v1 made and Encedo apps read: the public key,
 * its type and description, and a note, all base64 inside base64. It carries
 * nothing secret — only what the other side needs to talk to this key.
 */
export function buildShareCode(key, pubkey, note = '') {
  return {
    key: {
      pubkey,
      type: key.algorithm,
      descr: key.descrB64 ?? '',              // the field as bytes, base64, exactly as it is stored
      label: toB64Text(key.label),
    },
    note: toB64Text(note),
  };
}

export const shareCodeText = (code) => btoa(JSON.stringify(code));

/** The other direction: a pasted share code fills in the import form. */
export function parseShareCode(text) {
  let envelope;
  try {
    envelope = JSON.parse(fromB64Text(String(text ?? '').replace(/\s+/g, '')));
  } catch {
    throw new HemError('That is not a share code', { code: 'bad_share_code' });
  }
  const key = envelope?.key;
  if (!key?.pubkey || !key?.type) throw new HemError('That share code carries no key', { code: 'bad_share_code' });
  const parts = String(key.type).split(',').filter(Boolean);   // v1 wrote 'ECDH,CURVE25519'
  const uses = parts.filter((part) => part === 'ECDH' || part === 'ExDSA');
  return {
    label: key.label ? fromB64Text(key.label) : '',      // a label is text by construction
    type: parts.at(-1),
    mode: uses.join(',') || null,
    pubkey: key.pubkey,
    descrB64: key.descr ?? '',                           // the description is not: it stays base64
    note: envelope.note ? fromB64Text(envelope.note) : '',
  };
}

/**
 * What a scope lets the holder do, in the words the phone shows for it. A scope
 * this list has no words for is shown as it is: the phone still names it.
 */
const SCOPES = [
  [/^system:config$/, 'change the settings'],
  [/^system:upgrade$/, 'update the software'],
  [/^storage:disk(\d+):rw$/, 'unlock disk$1 read-write'],
  [/^storage:disk(\d+)$/, 'unlock disk$1 read-only'],
  [/^logger:get$/, 'read the operation log'],
  [/^logger:del$/, 'delete the operation log'],
  [/^keymgmt:list$/, 'list the keys'],
  [/^keymgmt:search$/, 'search the keys'],
  [/^keymgmt:get$/, 'read a public key'],
  [/^keymgmt:gen$/, 'generate a key'],
  [/^keymgmt:imp$/, 'import a public key'],
  [/^keymgmt:upd$/, 'rename a key'],
  [/^keymgmt:del$/, 'delete a key'],
  [/^keymgmt:use:/, 'use a key'],
  [/^auth:ext:pair$/, 'pair a phone'],
];
export function describeScope(scope) {
  for (const [re, words] of SCOPES) {
    const m = re.exec(scope);
    if (m) return words.replace(/\$(\d)/g, (_, i) => m[Number(i)] ?? '');
  }
  return scope;
}

/** '2 Feb 2026' — short enough for a table column, unambiguous in every locale. */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function formatDate(seconds) {
  const d = new Date(Number(seconds) * 1000);
  if (!seconds || Number.isNaN(d.getTime())) return '—';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
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
    case 'timeout': return 'The phone did not answer in time.';
    case 'aborted': return 'Cancelled.';
    case 'network': return 'The module did not answer.';
    case 'broker_error': return 'The Encedo backend did not answer.';
    case 'log_in_progress': return 'The module is still writing this file. It can be read once that session ends.';
    case 'auth_password_required': return 'Sign in with the password first.';
    case 'ext_register_error': return 'The module did not start the pairing.';
    case 'broker_refused': return e.message;
    case 'init_failed': return 'The module did not accept the personalisation.';
    case 'domain_failed': return 'The Encedo backend refused the name.';
    case 'mnemonic_invalid': return 'That is not a valid set of 24 words.';
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
