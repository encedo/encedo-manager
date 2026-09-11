// The settings: the owner, what the module trusts, the password, the name, the wipe.

import { describeError } from '../session.js';

export function createSettingsView({ session, paint, probeAgain }) {
  const view = {
    busy: null,
    error: null,
    notice: null,
    confirmWipe: false,
    domainCheck: null,

    async run(name, fn, notice) {
      Object.assign(view, { busy: name, error: null, notice: null });
      paint();
      try {
        await fn();
        view.notice = notice;
      } catch (e) {
        view.error = describeError(e);
      }
      view.busy = null;
      paint();
    },

    save(which, patch) {
      return view.run(which, () => session.saveConfig(patch), 'Saved. The module answers with what it made of it.');
    },

    changePassword(next, again) {
      if (next !== again) {
        view.error = 'The two passwords are not the same.';
        paint();
        return Promise.resolve();
      }
      if (!next) {
        view.error = 'Type the new password first.';
        paint();
        return Promise.resolve();
      }
      return view.run('password', () => session.changePassword(next),
        'The password is changed. Sign in again with the new one — the 24 words still work as they did.');
    },

    useMaster(words) {
      return view.run('master', () => session.authorizeMaster(words.trim()),
        'The settings are authorised with the master secret now.');
    },

    async checkDomain(prefix) {
      if (!prefix) return;
      Object.assign(view, { busy: 'domain', error: null, notice: null, domainCheck: null });
      paint();
      try {
        const taken = await session.domainTaken(prefix);
        view.domainCheck = taken ? `${prefix}.ence.do is taken.` : `${prefix}.ence.do is free.`;
      } catch (e) {
        view.error = describeError(e);
      }
      view.busy = null;
      paint();
    },

    registerDomain(prefix) {
      if (!prefix) {
        view.error = 'Type the name first.';
        paint();
        return Promise.resolve();
      }
      return view.run('domain', () => session.registerDomain(prefix),
        `Registered. The module answers to ${prefix}.ence.do once it has installed the certificate.`);
    },

    askWipe() { view.confirmWipe = true; paint(); },
    cancelWipe() { Object.assign(view, { confirmWipe: false, error: null }); paint(); },

    wipe(typed) {
      if (typed.trim().toUpperCase() !== 'WIPE') {
        view.error = 'Type WIPE to confirm, or leave it.';
        paint();
        return Promise.resolve();
      }
      return view.run('wipe', async () => {
        await session.wipeout();
        view.confirmWipe = false;
        probeAgain();
      }, 'The module is wiped. It comes back waiting to be personalised.');
    },

    reset() {
      Object.assign(view, { busy: null, error: null, notice: null, confirmWipe: false, domainCheck: null });
    },
  };
  return view;
}
