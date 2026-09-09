// Bootstrap: find the module, keep a session, render the shell and the pages.

import { resolveConfig } from './config.js';
import { VERSION, PRODUCT } from './version.js';
import { Session, describeError, describeScope, buildShareCode, shareCodeText, storageMode, gbToSectors, sectorsToGb, isPrefix, parseStorage } from './session.js';
import { ROUTES, currentRoute, href, onRouteChange } from './router.js';
import { h, mark, icon, render } from './ui.js';
import { renderSignIn } from './pages/signin.js';
import { renderOverview } from './pages/overview.js';
import { renderDrive } from './pages/drive.js';
import { renderKeychain } from './pages/keychain.js';
import { renderLog } from './pages/log.js';
import { renderHardware } from './pages/hardware.js';
import { renderSettings } from './pages/settings.js';
import { renderPhones } from './pages/phones.js';
import { renderPersonalise } from './pages/personalise.js';
import { proofOfPersonalisation } from './pdf.js';
import { parseLogFile } from './logfile.js';
import { renderPlaceholder } from './pages/placeholder.js';

const root = document.getElementById('app');
const config = resolveConfig();
const session = new Session(config);
const local = { busy: false, error: null, phone: null };   // sign-in form state
const driveView = { busy: null, error: null };
let probeCtl = null;

// -- sign-in actions ---------------------------------------------------------------

const signInView = {
  local,
  async signIn(password) {
    local.busy = true; local.error = null; paint();
    try { await session.signIn(password); }
    catch (e) { local.error = describeError(e); }
    local.busy = false; paint();
  },
  async signInWithPhone() {
    const ctl = new AbortController();
    local.phone = { cancel: () => ctl.abort() }; local.error = null; paint();
    try { await session.signInWithPhone({ signal: ctl.signal }); }
    catch (e) { if (e?.code !== 'aborted') local.error = describeError(e); }
    local.phone = null; paint();
  },
  cancelPhone() { local.phone?.cancel(); },
  changeAddress() {
    const next = window.prompt('Address of the module', session.urls.hem);
    if (next === null) return;
    const u = new URL(location.href);
    u.searchParams.set('hem', next.trim());
    location.href = u.toString();
  },
};

// -- personalisation ----------------------------------------------------------------------

const personaliseView = {
  step: 'welcome',          // welcome | form; the rest follows session.state.setup
  form: null,               // filled in when the form opens, from the module's status
  predefs: [],
  busy: null,
  error: null,
  domainCheck: null,
  printed: false,
  proof: null,              // { url, name } once the PDF is built
  repaint: () => paint(),

  async start() {
    const disks = parseStorage(session.state.status);
    const totalGb = sectorsToGb(disks.reduce((sum, d) => sum + d.bytes / 512, 0));
    personaliseView.form ??= {
      user: '', email: '', password: '', password2: '',
      prefix: 'my', customPrefix: '', ip: '192.168.7.1',
      disk0Gb: Math.max(1, Math.min(totalGb - 1, Math.round(totalGb / 4) || 1)),
      show: true, rw: false, xts: false,
      trusted_ts: true, trusted_backend: true, allow_keysearch: false,
    };
    Object.assign(personaliseView, { step: 'form', error: null });
    paint();
    if (!personaliseView.predefs.length) {
      personaliseView.predefs = await session.domainPredefs();
      if (!personaliseView.predefs.includes(personaliseView.form.prefix) && personaliseView.predefs.length) personaliseView.form.prefix = personaliseView.predefs[0];
      paint();
    }
  },
  back() { Object.assign(personaliseView, { step: 'welcome', error: null }); paint(); },

  async checkPrefix() {
    const prefix = personaliseView.form.customPrefix;
    if (!isPrefix(prefix)) { personaliseView.domainCheck = 'That is not a name the backend takes.'; paint(); return; }
    Object.assign(personaliseView, { busy: 'domain', domainCheck: null });
    paint();
    try {
      personaliseView.domainCheck = (await session.domainTaken(prefix)) ? `${prefix}.ence.do is taken.` : `${prefix}.ence.do is free.`;
    } catch (e) {
      personaliseView.domainCheck = describeError(e);
    }
    personaliseView.busy = null;
    paint();
  },

  async submit() {
    const f = personaliseView.form;
    const problem = !f.user.trim() ? 'Say what the module should call you.'
      : !f.password ? 'Choose a password.'
      : f.password !== f.password2 ? 'The two passwords are not the same.'
      : session.state.online && f.prefix === 'custom' && !isPrefix(f.customPrefix) ? 'The name of your own is not one the backend takes.'
      : null;
    if (problem) { personaliseView.error = problem; paint(); return; }
    personaliseView.error = null;
    const custom = f.prefix === 'custom';
    const fields = {
      user: f.user, email: f.email, password: f.password,
      prefix: custom ? f.customPrefix : f.prefix, custom,
      ip: f.ip.trim() || '192.168.7.1',
      storage_disk0size: gbToSectors(f.disk0Gb),
      storage_mode: storageMode({ show: f.show, rw: f.rw, xts: f.xts }),
      trusted_ts: f.trusted_ts, trusted_backend: f.trusted_backend, allow_keysearch: f.allow_keysearch,
    };
    personaliseView.printed = false;
    personaliseView.proof = null;
    try { await session.personalise(fields); }
    catch (e) { console.warn('[manager] personalisation failed', e); }   // state.setup says so
    paint();
  },

  async retry() {
    personaliseView.busy = 'rollback';
    paint();
    try { await session.rollbackPersonalisation(); }
    catch (e) { personaliseView.error = describeError(e); }
    Object.assign(personaliseView, { busy: null, step: 'form' });
    paint();
    probeAgain();
  },

  /** The proof, built once from what the init answered and what the module reports. */
  proofFile() {
    if (personaliseView.proof) return personaliseView.proof;
    const { setup, version } = session.state;
    const r = setup.result, f = setup.fields, cfg = r.config ?? {};
    const bytes = proofOfPersonalisation({
      hostname: r.hostname, issued: new Date().toISOString().replace(/\.\d+Z$/, 'Z'), instanceid: r.instanceid,
      devid: cfg.devid, eid: cfg.eid, eid_sign: cfg.eid_sign,
      user: f.email ? `${f.user} (${f.email})` : f.user,
      trusted_ts: f.trusted_ts, trusted_backend: f.trusted_backend, allow_keysearch: f.allow_keysearch,
      hardware: version?.hwv, firmware: version?.fwv, words: r.words,
    });
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    personaliseView.proof = { url, name: `proof-of-personalisation-${r.hostname}.pdf`, bytes };
    return personaliseView.proof;
  },

  download() {
    const { url, name } = personaliseView.proofFile();
    const a = h('a', { href: url, download: name });
    document.body.append(a); a.click(); a.remove();
    personaliseView.printed = true;
    paint();
  },

  print() {
    const { url } = personaliseView.proofFile();
    // The PDF is opened in a frame of its own and told to print, the way v1 did it.
    const frame = h('iframe', { src: url, style: 'position: fixed; width: 0; height: 0; border: 0; opacity: 0;', title: 'Proof of Personalisation' });
    frame.addEventListener('load', () => { try { frame.contentWindow.print(); } catch { window.open(url, '_blank'); } });
    document.body.append(frame);
    personaliseView.printed = true;
    paint();
  },

  async finish() {
    personaliseView.busy = 'finish';
    paint();
    try {
      const { reboot, hostname } = await session.finishPersonalisation();
      if (personaliseView.proof) URL.revokeObjectURL(personaliseView.proof.url);
      Object.assign(personaliseView, { step: 'welcome', form: null, proof: null, printed: false, busy: null });
      if (reboot && /ence\.do$/.test(new URL(session.urls.hem).hostname)) {
        // The module comes back under its new name; this page follows it there.
        setTimeout(() => { location.href = config.servedFromDevice ? `https://${hostname}/` : `${location.pathname}?hem=https://${hostname}`; }, 15_000);
      }
      probeAgain();
    } catch (e) {
      Object.assign(personaliseView, { busy: null, error: describeError(e) });
      paint();
    }
  },
};

// -- drive actions --------------------------------------------------------------------

const driveActions = {
  get busy() { return driveView.busy; },
  get error() { return driveView.error; },
  async unlock(i, mode) { await driveOp(i, () => session.unlockDisk(i, mode)); },
  async lock(i) { await driveOp(i, () => session.lockDisk(i)); },
};

async function driveOp(i, fn) {
  driveView.busy = i; driveView.error = null; paint();
  try { await fn(); } catch (e) { driveView.error = describeError(e); }
  driveView.busy = null; paint();
}

// -- keychain actions -------------------------------------------------------------------

/** Page state and the actions behind it; the page reads these fields directly. */
const keychainView = {
  q: '',                 // what is typed in the search box
  sort: { by: 'label', dir: 'asc' },
  page: 1,
  pageSize: 10,
  form: null,            // 'create' | 'import'
  open: null,            // kid of the expanded key
  detail: null,          // { kid, pubkey, type } once the module has answered
  share: null,           // { kid, code, text } once a share code is built
  shareNote: '',
  shareEmail: '',
  editing: null,         // kid whose label and description are unlocked
  confirmDelete: null,   // kid the delete button is waiting on
  busy: null,
  error: null,
  notice: null,

  showForm(kind) { Object.assign(keychainView, { form: kind, error: null, notice: null }); paint(); },
  closeForm() { keychainView.form = null; paint(); },

  openKey(kid) {
    Object.assign(keychainView, { open: kid, detail: null, share: null, shareNote: '', shareEmail: '', editing: null, confirmDelete: null, error: null, notice: null });
    paint();
    const key = (session.state.keys ?? []).find((k) => k.kid === kid);
    if (!key || key.symmetric) return;          // a secret key has no public half to fetch
    session.keyPublic(kid)
      .then((detail) => { if (keychainView.open === kid) keychainView.detail = detail; })
      .catch((e) => { if (keychainView.open === kid) keychainView.error = describeError(e); })
      .finally(() => { if (keychainView.open === kid) paint(); });
  },
  closeKey() { Object.assign(keychainView, { open: null, detail: null, share: null, editing: null, confirmDelete: null }); paint(); },

  startEdit(kid) { Object.assign(keychainView, { editing: kid, error: null, notice: null }); paint(); },
  cancelEdit() { keychainView.editing = null; paint(); },

  create(fields) {
    return keychainOp('create', async () => {
      await session.createKey(fields);
      keychainView.form = null;
    }, 'Created. The module keeps the private half.');
  },

  import(fields) {
    return keychainOp('import', async () => {
      await session.importKey(fields);
      keychainView.form = null;
    }, 'Imported. It is a public key: the module can verify and agree with it, not sign as it.');
  },

  rename(kid, label, descr) {
    return keychainOp('rename', async () => {
      await session.renameKey(kid, label, descr);
      keychainView.editing = null;          // saved, so it locks again
    }, 'Saved.');
  },

  remove(kid) {
    return keychainOp('delete', async () => {
      await session.removeKey(kid);
      Object.assign(keychainView, { open: null, detail: null, share: null, editing: null, confirmDelete: null });
    }, 'The key is gone.');
  },

  askDelete(kid) { keychainView.confirmDelete = kid; paint(); },
  cancelDelete() { keychainView.confirmDelete = null; paint(); },

  makeShare(key, pubkey, note) {
    if (!pubkey) return;
    const code = buildShareCode(key, pubkey, note);
    Object.assign(keychainView, { share: { kid: key.kid, code, text: shareCodeText(code) }, error: null, notice: null });
    paint();
  },

  emailShare(key, pubkey, note, address) {
    if (!address) { keychainView.error = 'Type the address to send it to.'; paint(); return Promise.resolve(); }
    const code = buildShareCode(key, pubkey, note);
    keychainView.share = { kid: key.kid, code, text: shareCodeText(code) };
    return keychainOp('share', () => session.shareKeyByEmail(address, code), `The share code is on its way to ${address}.`);
  },
};

async function keychainOp(name, fn, notice = null) {
  Object.assign(keychainView, { busy: name, error: null, notice: null });
  paint();
  try {
    await fn();
    keychainView.notice = notice;
  } catch (e) {
    keychainView.error = describeError(e);
  }
  keychainView.busy = null;
  paint();
}

// -- operation log actions ---------------------------------------------------------------

const logView = {
  page: 1,
  pageSize: 10,
  entries: { page: 1, pageSize: 25 },     // paging inside one opened file
  open: null,                             // id of the file showing its entries
  files: {},                              // { [id]: { result, entries, text } } once read
  busy: null,                             // a file id, or 'all' while every file is checked
  checked: 0,
  error: null,
  notice: null,

  show(id) {
    Object.assign(logView, { open: id, error: null, notice: null });
    logView.entries.page = 1;
    paint();
    if (logView.files[id] || logView.busy) return;
    logView.busy = id;
    readLogFile(id)
      .catch((e) => { logView.error = describeError(e); })
      .finally(() => { logView.busy = null; paint(); });
  },
  hide() { Object.assign(logView, { open: null, error: null }); paint(); },

  /** Read what has not been read. One pass, so the count on screen means something. */
  async checkAll() {
    Object.assign(logView, { busy: 'all', checked: 0, error: null, notice: null });
    paint();
    try {
      for (const id of session.state.logs?.ids ?? []) {
        if (!logView.files[id]) await readLogFile(id);
        logView.checked++;
        paint();
      }
      const failed = Object.values(logView.files).filter((f) => f.result && !f.result.ok).length;
      logView.notice = failed
        ? (failed === 1 ? 'One file does not match its seal.' : `${failed} files do not match their seals.`)
        : 'Every file verified.';
    } catch (e) {
      logView.error = describeError(e);
    }
    logView.busy = null;
    paint();
  },
};

async function readLogFile(id) {
  try {
    const { text, ...result } = await session.readLog(id);
    logView.files[id] = { result, text, entries: parseLogFile(text, id) };
  } catch (e) {
    if (e?.code !== 'log_in_progress') throw e;
    logView.files[id] = { writing: true };      // a state, not a failure
  }
  return logView.files[id];
}

// -- paired phones actions ---------------------------------------------------------------

const phonesView = {
  pairing: null,            // { qrText, payload, deadline, cancel } while a QR is up
  confirmUnpair: null,      // pid the unpair button is waiting on
  busy: null,
  error: null,
  notice: null,
  get loadError() { return keychainView.error; },     // the phones come out of the keychain

  async pair() {
    const ctl = new AbortController();
    const timeout = 60_000;
    Object.assign(phonesView, {
      pairing: { qrText: null, payload: null, deadline: Date.now() + timeout, cancel: () => ctl.abort() },
      busy: 'pair', error: null, notice: null, confirmUnpair: null,
    });
    paint();
    try {
      await session.pairPhone({
        signal: ctl.signal,
        pollTimeout: timeout,
        onQrCode: (qrText, payload) => {
          if (!phonesView.pairing) return;
          Object.assign(phonesView.pairing, { qrText, payload });
          paint();
        },
      });
      phonesView.notice = 'Paired. The phone is a key in the keychain now, and sign-in offers it first.';
    } catch (e) {
      if (e?.code !== 'aborted') phonesView.error = describeError(e);
    }
    Object.assign(phonesView, { pairing: null, busy: null });
    paint();
  },
  cancelPair() { phonesView.pairing?.cancel(); },

  askUnpair(pid) { Object.assign(phonesView, { confirmUnpair: pid, error: null, notice: null }); paint(); },
  cancelUnpair() { phonesView.confirmUnpair = null; paint(); },

  anyway: null,             // { phone, error } while the person is asked whether to go on without the broker

  async unpair(phone, { skipBroker = false } = {}) {
    Object.assign(phonesView, { busy: 'unpair', error: null, notice: null, anyway: null });
    paint();
    try {
      const done = await session.unpairPhone(phone, { skipBroker });
      phonesView.notice = done.key && done.broker ? `${phone.label || 'The phone'} is unpaired: its key is gone and the broker no longer routes to it.`
        : done.key ? `${phone.label || 'The phone'} can no longer answer: its key is gone. The broker ${skipBroker ? 'was not asked again' : 'still lists it until the backend is reachable'}.`
        : `The broker no longer routes to ${phone.label || 'that phone'}.`;
      phonesView.confirmUnpair = null;
    } catch (e) {
      // The broker said no with a 4xx: ask, and on yes do the rest as if it had not.
      if (e?.code === 'broker_refused') phonesView.anyway = { phone, error: describeError(e) };
      else phonesView.error = describeError(e);
    }
    phonesView.busy = null;
    paint();
  },
  unpairAnyway() { const { phone } = phonesView.anyway; phonesView.anyway = null; return phonesView.unpair(phone, { skipBroker: true }); },
  keepAfterAll() { Object.assign(phonesView, { anyway: null, error: phonesView.anyway?.error ?? null }); paint(); },
};

/** The broker refused to unpair a phone; the key can still go. */
function anywayModal({ phone, error }) {
  return h('div.veil', {},
    h('div.card.lifted.asking', { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'anyway-title' },
      h('div.card-head', {}, h('span', {}, 'The backend said no'), h('span.v', {}, phone.label || phone.pid)),
      h('div.card-body', {},
        h('div.stack-s', {},
          h('p.eyebrow', {}, 'Unpair'),
          h('h1', { id: 'anyway-title' }, 'Do it anyway?'),
          h('p.soft', { style: 'font-size: 15.5px;' }, error),
          h('p.soft', { style: 'font-size: 15.5px;' }, phone.kid
            ? 'The key is what lets the phone answer for you, and the key is in the module. Going on removes it from the keychain and leaves the broker as it is.'
            : 'There is no key in the module for this phone, so there is nothing else to remove.')),
        h('div.row', {},
          h('button.button.exposed', { type: 'button', disabled: !phone.kid || null, onclick: () => phonesView.unpairAnyway() }, 'Do it anyway'),
          h('button.button.plain', { type: 'button', autofocus: true, onclick: () => phonesView.keepAfterAll() }, 'Leave it')))));
}

/** The seconds left on a pairing tick down on screen only while one is up. */
let pairingTimer = null;
function watchPairing(on) {
  if (on && !pairingTimer) pairingTimer = setInterval(paint, 1000);
  else if (!on && pairingTimer) { clearInterval(pairingTimer); pairingTimer = null; }
}

// -- hardware actions --------------------------------------------------------------------

const hardwareView = {
  temps: [],                // { at, temp } while the page is open, and only then
  busy: null,
  confirmReboot: false,
  error: null,
  notice: null,

  sample() {
    const temp = session.state.status?.temp;
    if (temp === undefined) return;
    hardwareView.temps.push({ at: Date.now(), temp: Number(temp) });
    if (hardwareView.temps.length > 180) hardwareView.temps.shift();   // half an hour at ten seconds
  },

  async runSelftest() {
    Object.assign(hardwareView, { busy: 'selftest', error: null, notice: null });
    paint();
    try {
      const result = await session.selftest();
      hardwareView.notice = Number(result.fls_state ?? 0) === 0 && Number(result.se_state ?? 0) === 0
        ? 'The module tested itself and found nothing wrong.'
        : 'The module reported a problem. The counters below say which test.';
    } catch (e) {
      hardwareView.error = describeError(e);
    }
    hardwareView.busy = null;
    paint();
  },

  askReboot() { hardwareView.confirmReboot = true; paint(); },
  cancelReboot() { hardwareView.confirmReboot = false; paint(); },

  async reboot() {
    Object.assign(hardwareView, { busy: 'reboot', error: null, notice: null });
    paint();
    try {
      await session.reboot();
      hardwareView.temps = [];
      hardwareView.notice = 'The module is rebooting. This page waits for it to answer again.';
      probeAgain();
    } catch (e) {
      hardwareView.error = describeError(e);
    }
    Object.assign(hardwareView, { busy: null, confirmReboot: false });
    paint();
  },

  forgetTokens() {
    session.forgetTokens();
    hardwareView.notice = 'Forgotten. The next operation asks you again.';
    paint();
  },
};

// -- settings actions --------------------------------------------------------------------

const settingsView = {
  busy: null,
  error: null,
  notice: null,
  confirmWipe: false,
  domainCheck: null,

  async run(name, fn, notice) {
    Object.assign(settingsView, { busy: name, error: null, notice: null });
    paint();
    try {
      await fn();
      settingsView.notice = notice;
    } catch (e) {
      settingsView.error = describeError(e);
    }
    settingsView.busy = null;
    paint();
  },

  save(which, patch) {
    return settingsView.run(which, () => session.saveConfig(patch), 'Saved. The module answers with what it made of it.');
  },

  changePassword(next, again) {
    if (next !== again) {
      settingsView.error = 'The two passwords are not the same.';
      paint();
      return Promise.resolve();
    }
    if (!next) {
      settingsView.error = 'Type the new password first.';
      paint();
      return Promise.resolve();
    }
    return settingsView.run('password', () => session.changePassword(next),
      'The password is changed. Sign in again with the new one — the 24 words still work as they did.');
  },

  useMaster(words) {
    return settingsView.run('master', () => session.authorizeMaster(words.trim()),
      'The settings are authorised with the master secret now.');
  },

  async checkDomain(prefix) {
    if (!prefix) return;
    Object.assign(settingsView, { busy: 'domain', error: null, notice: null, domainCheck: null });
    paint();
    try {
      const taken = await session.domainTaken(prefix);
      settingsView.domainCheck = taken ? `${prefix}.ence.do is taken.` : `${prefix}.ence.do is free.`;
    } catch (e) {
      settingsView.error = describeError(e);
    }
    settingsView.busy = null;
    paint();
  },

  registerDomain(prefix) {
    if (!prefix) {
      settingsView.error = 'Type the name first.';
      paint();
      return Promise.resolve();
    }
    return settingsView.run('domain', () => session.registerDomain(prefix),
      `Registered. The module answers to ${prefix}.ence.do once it has installed the certificate.`);
  },

  askWipe() { settingsView.confirmWipe = true; paint(); },
  cancelWipe() { Object.assign(settingsView, { confirmWipe: false, error: null }); paint(); },

  wipe(typed) {
    if (typed.trim().toUpperCase() !== 'WIPE') {
      settingsView.error = 'Type WIPE to confirm, or leave it.';
      paint();
      return Promise.resolve();
    }
    return settingsView.run('wipe', async () => {
      await session.wipeout();
      settingsView.confirmWipe = false;
      probeAgain();
    }, 'The module is wiped. It comes back waiting to be personalised.');
  },
};

/** The module is asked for its temperature only while the page showing it is open. */
let temperatureTimer = null;
function watchTemperature(on) {
  if (on && !temperatureTimer) {
    hardwareView.sample();
    temperatureTimer = setInterval(() => {
      session.refreshStatus().then(() => hardwareView.sample()).catch(() => {});
    }, 10_000);
  } else if (!on && temperatureTimer) {
    clearInterval(temperatureTimer);
    temperatureTimer = null;
  }
}

/** While a phone is being asked, the seconds left tick down on the banner. */
let askingTimer = null;
function watchAsking(on) {
  if (on && !askingTimer) askingTimer = setInterval(paint, 1000);
  else if (!on && askingTimer) { clearInterval(askingTimer); askingTimer = null; }
}

/**
 * What the person sees while their phone is being asked: which operation, how
 * long it has, and a way to give up. It sits over the page, with the page
 * behind it blurred, because nothing else can happen until the phone answers.
 */
function askingModal(asking) {
  const left = Math.max(0, Math.ceil((asking.until - Date.now()) / 1000));
  return h('div.veil', {},
    h('div.card.lifted.asking', { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'asking-title' },
      h('div.card-head', {}, h('span', {}, 'Confirm on your phone'), h('span.v', {}, `${left} s left`)),
      h('div.card-body', {},
        h('div.stack-s', {},
          h('p.eyebrow', {}, 'Waiting for the phone'),
          h('h1', { id: 'asking-title' }, 'Approve this on your phone.'),
          h('p.soft', { style: 'font-size: 15.5px;' }, 'The module wants your approval to ', h('b', { style: 'font-weight: 600; color: var(--ink);' }, describeScope(asking.scope)), '. The request is on the phones paired with it. Approve it on one of them and this page carries on; decline it there, or cancel here, and nothing happens.')),
        h('div.row', {},
          h('button.button.plain', { type: 'button', autofocus: true, onclick: () => asking.cancel() }, 'Cancel'),
          h('span.mono.muted', { style: 'font-size: 12px;' }, asking.scope)))));
}

/** The log index is read once per session, the same way the keychain is. */
function ensureLogs() {
  if (session.state.logs || logView.busy || logView.error) return;
  logView.busy = 'index';
  queueMicrotask(() => session.loadLogs()
    .catch((e) => { logView.error = describeError(e); })
    .finally(() => { logView.busy = null; paint(); }));
}

/**
 * The keychain is read once per session, when a page first asks for it. The
 * read starts after this render, not inside it, so paint() never re-enters.
 */
function ensureKeys() {
  if (session.state.keys || keychainView.busy || keychainView.error) return;
  keychainView.busy = 'load';
  queueMicrotask(() => session.loadKeys()
    .catch((e) => { keychainView.error = describeError(e); })
    .finally(() => { keychainView.busy = null; paint(); }));
}

// -- shell ------------------------------------------------------------------------------

function shell(route, content) {
  const { state } = session;
  const v = state.version ?? {};
  root.className = 'app';
  render(root,
    h('aside.sidebar', {},
      h('div.brand', {}, mark(36), h('div.name', {}, h('b', {}, 'Encedo HEM'), h('span', {}, 'Manager'))),
      h('nav.nav', { 'aria-label': 'Sections' }, ROUTES.map((r) =>
        h(`a${r.id === route.id ? '.active' : ''}`, { href: href(r), 'aria-current': r.id === route.id ? 'page' : null }, icon(r.id), h('span', {}, r.label)))),
      h('div.sidebar-foot', {},
        h('span.host', {}, state.config?.hostname || state.status?.hostname || session.urls.hem.replace(/^https?:\/\//, '')),
        h('span', {}, `${session.urls.hem.replace(/^https?:\/\//, '')} · ${config.servedFromDevice ? 'served by the module' : 'dev server'}`),
        h('span', {}, `${state.config?.user ?? 'signed in'} · `, h('a', { href: '#', onclick: (e) => { e.preventDefault(); session.signOut(); } }, 'Sign out')))),
    h('main.main', {},
      h('div.masthead', {},
        h('span', {}, h('b', {}, PRODUCT), `  ${VERSION}`),
        h('span', {}, [`firmware ${v.fwv ?? '?'}`, v.conf ?? v.hwv, state.online ? 'backend reachable' : state.online === false ? 'air-gapped' : null, state.mode === 'phone' ? 'signed in with the phone' : null].filter(Boolean).join(' · '))),
      content),
    state.asking ? askingModal(state.asking) : phonesView.anyway ? anywayModal(phonesView.anyway) : null);
}

/**
 * What each page remembers — an opened key, files already verified, a notice —
 * belongs to one session. When it ends, by signing out or otherwise, the next
 * person to sign in starts with pages that know nothing.
 */
let lastPhase = null;
function forgetPageState() {
  Object.assign(keychainView, { q: '', page: 1, form: null, open: null, detail: null, share: null, shareNote: '', shareEmail: '', editing: null, confirmDelete: null, busy: null, error: null, notice: null });
  Object.assign(logView, { page: 1, open: null, files: {}, busy: null, checked: 0, error: null, notice: null });
  Object.assign(hardwareView, { temps: [], busy: null, confirmReboot: false, error: null, notice: null });
  Object.assign(settingsView, { busy: null, error: null, notice: null, confirmWipe: false, domainCheck: null });
  phonesView.pairing?.cancel();
  Object.assign(phonesView, { pairing: null, confirmUnpair: null, anyway: null, busy: null, error: null, notice: null });
  driveView.busy = null; driveView.error = null;
}

function paint() {
  const route = currentRoute();
  if (lastPhase === 'signed-in' && session.state.phase !== 'signed-in') forgetPageState();
  lastPhase = session.state.phase;
  watchTemperature(route.id === 'hardware' && session.state.phase === 'signed-in');
  watchPairing(route.id === 'phones' && Boolean(phonesView.pairing?.qrText));
  watchAsking(Boolean(session.state.asking) && session.state.phase === 'signed-in');
  if (session.state.phase === 'unpersonalised') {
    renderPersonalise(root, session, personaliseView);
    return;
  }
  if (session.state.phase !== 'signed-in') {
    renderSignIn(root, session, signInView);
    return;
  }
  let content;
  if (route.id === 'overview') content = renderOverview(session);
  else if (route.id === 'drive') content = renderDrive(session, driveActions);
  else if (route.id === 'keychain') { ensureKeys(); content = renderKeychain(session, keychainView); }
  else if (route.id === 'log') { ensureLogs(); content = renderLog(session, logView); }
  else if (route.id === 'hardware') content = renderHardware(session, hardwareView);
  else if (route.id === 'settings') content = renderSettings(session, settingsView);
  else if (route.id === 'phones') { ensureKeys(); content = renderPhones(session, phonesView); }
  else content = renderPlaceholder(route.id);
  shell(route, content);
}

// -- start --------------------------------------------------------------------------------

session.addEventListener('change', paint);
onRouteChange(paint);
paint();

/** Wait for the module to answer again — at startup, and after a reboot. */
function probeAgain() {
  probeCtl?.abort();
  probeCtl = new AbortController();
  return (async () => {
    try {
      await session.waitForDevice({ signal: probeCtl.signal });
      await session.prepare();
    } catch (e) {
      if (e?.code !== 'aborted') console.error('[manager] start failed', e);
    }
  })();
}

probeAgain();
