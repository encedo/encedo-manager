// The hardware page: the health check, the tokens, the reboot, the temperature.

import { describeError } from '../session.js';

export function createHardwareView({ session, paint, probeAgain }) {
  let timer = null;
  const view = {
    temps: [],                // { at, temp } while the page is open, and only then
    busy: null,
    confirmReboot: false,
    error: null,
    notice: null,

    sample() {
      const temp = session.state.status?.temp;
      if (temp === undefined) return;
      view.temps.push({ at: Date.now(), temp: Number(temp) });
      if (view.temps.length > 180) view.temps.shift();   // half an hour at ten seconds
    },

    async runSelftest() {
      Object.assign(view, { busy: 'selftest', error: null, notice: null });
      paint();
      try {
        const result = await session.selftest();
        view.notice = Number(result.fls_state ?? 0) === 0 && Number(result.se_state ?? 0) === 0
          ? 'The module tested itself and found nothing wrong.'
          : 'The module reported a problem. The counters below say which test.';
      } catch (e) {
        view.error = describeError(e);
      }
      view.busy = null;
      paint();
    },

    askReboot() { view.confirmReboot = true; paint(); },
    cancelReboot() { view.confirmReboot = false; paint(); },

    async reboot() {
      Object.assign(view, { busy: 'reboot', error: null, notice: null });
      paint();
      try {
        await session.reboot();
        view.temps = [];
        view.notice = 'The module is rebooting. This page waits for it to answer again.';
        probeAgain();
      } catch (e) {
        view.error = describeError(e);
      }
      Object.assign(view, { busy: null, confirmReboot: false });
      paint();
    },

    forgetTokens() {
      session.forgetTokens();
      view.notice = 'Forgotten. The next operation asks you again.';
      paint();
    },

    /** The module is asked for its temperature only while this page is open. */
    watch(on) {
      if (on && !timer) {
        view.sample();
        timer = setInterval(() => {
          session.refreshStatus().then(() => view.sample()).catch(() => {});
        }, 10_000);
      } else if (!on && timer) {
        clearInterval(timer);
        timer = null;
      }
    },

    reset() {
      view.watch(false);
      Object.assign(view, { temps: [], busy: null, confirmReboot: false, error: null, notice: null });
    },
  };
  return view;
}
