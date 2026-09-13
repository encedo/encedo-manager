// The sign-in form: the password, the phone, and the address of the module.

import { describeError } from '../session.js';

/** `local` is what the form itself remembers; the page reads it straight off. */
export function createSignInView({ session, paint }) {
  const local = { busy: false, error: null, phone: null, remember: false };
  const view = {
      local,
    async signIn(password, remember = false) {
      local.busy = true; local.error = null; local.remember = remember; paint();
      try { await session.signIn(password, { remember }); }
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

    /**
     * The form starts over when a session ends. The tick in particular: it is a
     * choice about this session, and leaving it set would opt the next person
     * in without their saying so.
     */
    reset() { Object.assign(local, { busy: false, error: null, phone: null, remember: false }); },
    changeAddress() {
      const next = window.prompt('Address of the module', session.urls.hem);
      if (next === null) return;
      const u = new URL(location.href);
      u.searchParams.set('hem', next.trim());
      location.href = u.toString();
    },
  };
  return view;
}
