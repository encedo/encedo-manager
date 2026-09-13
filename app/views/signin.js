// The sign-in form: the password, the phone, and the address of the module.

import { describeError } from '../session.js';

/** `local` is what the form itself remembers; the page reads it straight off. */
export function createSignInView({ session, paint }) {
  // Ticked when the page is opened: signing in and then being asked again for
  // every operation is not what somebody sitting down at their own module
  // wants. Signing out unticks it — that is the moment the module might be
  // handed on, and the next person should say for themselves.
  const local = { busy: false, error: null, phone: null, remember: true };
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
     * The form starts over when a session ends, and the tick comes back
     * unticked rather than as it was: signing out is where a module changes
     * hands, and the next person says for themselves.
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
