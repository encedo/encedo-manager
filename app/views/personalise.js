// Personalising a module out of the box: the form, the steps, the proof.

import { h } from '../ui.js';
import { describeError, isPrefix, parseStorage, sectorsToGb, gbToSectors, storageMode } from '../session.js';
import { proofOfPersonalisation } from '../pdf.js';

export function createPersonaliseView({ session, paint, probeAgain, config, software }) {
  const view = {
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
      view.form ??= {
        user: '', email: '', password: '', password2: '',
        prefix: 'my', customPrefix: '', ip: '192.168.7.1',
        disk0Gb: Math.max(1, Math.min(totalGb - 1, Math.round(totalGb / 4) || 1)),
        show: true, rw: false, xts: false,
        trusted_ts: true, trusted_backend: true, allow_keysearch: false,
      };
      Object.assign(view, { step: 'form', error: null });
      paint();
      if (!view.predefs.length) {
        view.predefs = await session.domainPredefs();
        if (!view.predefs.includes(view.form.prefix) && view.predefs.length) view.form.prefix = view.predefs[0];
        paint();
      }
    },
    back() { Object.assign(view, { step: 'welcome', error: null }); paint(); },
    get software() { return software; },   // a module that shipped with old firmware gets current before its first use

    async checkPrefix() {
      const prefix = view.form.customPrefix;
      if (!isPrefix(prefix)) { view.domainCheck = 'That is not a name the backend takes.'; paint(); return; }
      Object.assign(view, { busy: 'domain', domainCheck: null });
      paint();
      try {
        view.domainCheck = (await session.domainTaken(prefix)) ? `${prefix}.ence.do is taken.` : `${prefix}.ence.do is free.`;
      } catch (e) {
        view.domainCheck = describeError(e);
      }
      view.busy = null;
      paint();
    },

    async submit() {
      const f = view.form;
      const problem = !f.user.trim() ? 'Say what the module should call you.'
        : !f.password ? 'Choose a password.'
        : f.password !== f.password2 ? 'The two passwords are not the same.'
        : session.state.online && f.prefix === 'custom' && !isPrefix(f.customPrefix) ? 'The name of your own is not one the backend takes.'
        : null;
      if (problem) { view.error = problem; paint(); return; }
      view.error = null;
      const custom = f.prefix === 'custom';
      const fields = {
        user: f.user, email: f.email, password: f.password,
        prefix: custom ? f.customPrefix : f.prefix, custom,
        ip: f.ip.trim() || '192.168.7.1',
        storage_disk0size: gbToSectors(f.disk0Gb),
        storage_mode: storageMode({ show: f.show, rw: f.rw, xts: f.xts }),
        trusted_ts: f.trusted_ts, trusted_backend: f.trusted_backend, allow_keysearch: f.allow_keysearch,
      };
      view.printed = false;
      view.proof = null;
      try { await session.personalise(fields); }
      catch (e) { console.warn('[manager] personalisation failed', e); }   // state.setup says so
      paint();
    },

    async retry() {
      view.busy = 'rollback';
      paint();
      try { await session.rollbackPersonalisation(); }
      catch (e) { view.error = describeError(e); }
      Object.assign(view, { busy: null, step: 'form' });
      paint();
      probeAgain();
    },

    /** The proof, built once from what the init answered and what the module reports. */
    proofFile() {
      if (view.proof) return view.proof;
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
      view.proof = { url, name: `proof-of-personalisation-${r.hostname}.pdf`, bytes };
      return view.proof;
    },

    download() {
      const { url, name } = view.proofFile();
      const a = h('a', { href: url, download: name });
      document.body.append(a); a.click(); a.remove();
      view.printed = true;
      paint();
    },

    print() {
      const { url } = view.proofFile();
      // The PDF is opened in a frame of its own and told to print, the way v1 did it.
      const frame = h('iframe', { src: url, style: 'position: fixed; width: 0; height: 0; border: 0; opacity: 0;', title: 'Proof of Personalisation' });
      frame.addEventListener('load', () => { try { frame.contentWindow.print(); } catch { window.open(url, '_blank'); } });
      document.body.append(frame);
      view.printed = true;
      paint();
    },

    async finish() {
      view.busy = 'finish';
      paint();
      try {
        const { reboot, hostname } = await session.finishPersonalisation();
        if (view.proof) URL.revokeObjectURL(view.proof.url);
        Object.assign(view, { step: 'welcome', form: null, proof: null, printed: false, busy: null });
        if (reboot && /ence\.do$/.test(new URL(session.urls.hem).hostname)) {
          // The module comes back under its new name; this page follows it there.
          setTimeout(() => { location.href = config.servedFromDevice ? `https://${hostname}/` : `${location.pathname}?hem=https://${hostname}`; }, 15_000);
        }
        probeAgain();
      } catch (e) {
        Object.assign(view, { busy: null, error: describeError(e) });
        paint();
      }
    },
  };
  return view;
}
