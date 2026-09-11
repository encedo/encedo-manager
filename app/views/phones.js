// Paired phones: pairing one by QR code, and unpairing one.

import { describeError } from '../session.js';

export function createPhonesView({ session, paint, keychain }) {
  let ticking = null;
  const view = {
    pairing: null,            // { qrText, payload, deadline, cancel } while a QR is up
    confirmUnpair: null,      // pid the unpair button is waiting on
    busy: null,
    error: null,
    notice: null,
    get loadError() { return keychain.error; },     // the phones come out of the keychain

    async pair() {
      const ctl = new AbortController();
      const timeout = 60_000;
      Object.assign(view, {
        pairing: { qrText: null, payload: null, deadline: Date.now() + timeout, cancel: () => ctl.abort() },
        busy: 'pair', error: null, notice: null, confirmUnpair: null,
      });
      paint();
      try {
        await session.pairPhone({
          signal: ctl.signal,
          pollTimeout: timeout,
          onQrCode: (qrText, payload) => {
            if (!view.pairing) return;
            Object.assign(view.pairing, { qrText, payload });
            paint();
          },
        });
        view.notice = 'Paired. The phone is a key in the keychain now, and sign-in offers it first.';
      } catch (e) {
        if (e?.code !== 'aborted') view.error = describeError(e);
      }
      Object.assign(view, { pairing: null, busy: null });
      paint();
    },
    cancelPair() { view.pairing?.cancel(); },

    askUnpair(pid) { Object.assign(view, { confirmUnpair: pid, error: null, notice: null }); paint(); },
    cancelUnpair() { view.confirmUnpair = null; paint(); },

    anyway: null,             // { phone, error } while the person is asked whether to go on without the broker

    async unpair(phone, { skipBroker = false } = {}) {
      Object.assign(view, { busy: 'unpair', error: null, notice: null, anyway: null });
      paint();
      try {
        const done = await session.unpairPhone(phone, { skipBroker });
        view.notice = done.key && done.broker ? `${phone.label || 'The phone'} is unpaired: its key is gone and the broker no longer routes to it.`
          : done.key ? `${phone.label || 'The phone'} can no longer answer: its key is gone. The broker ${skipBroker ? 'was not asked again' : 'still lists it until the backend is reachable'}.`
          : `The broker no longer routes to ${phone.label || 'that phone'}.`;
        view.confirmUnpair = null;
      } catch (e) {
        // The broker said no with a 4xx: ask, and on yes do the rest as if it had not.
        if (e?.code === 'broker_refused') view.anyway = { phone, error: describeError(e) };
        else view.error = describeError(e);
      }
      view.busy = null;
      paint();
    },
    unpairAnyway() { const { phone } = view.anyway; view.anyway = null; return view.unpair(phone, { skipBroker: true }); },
    keepAfterAll() { Object.assign(view, { anyway: null, error: view.anyway?.error ?? null }); paint(); },

    /** The seconds left on a pairing tick down on screen only while one is up. */
    watch(on) {
      if (on && !ticking) ticking = setInterval(paint, 1000);
      else if (!on && ticking) { clearInterval(ticking); ticking = null; }
    },

    reset() {
      view.pairing?.cancel();
      Object.assign(view, { pairing: null, confirmUnpair: null, anyway: null, busy: null, error: null, notice: null });
    },
  };
  return view;
}
