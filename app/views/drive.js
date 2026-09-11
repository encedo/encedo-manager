// Unlocking and locking the secure drive.

import { describeError } from '../session.js';

export function createDriveView({ session, paint }) {
  const state = { busy: null, error: null };
  const view = {
    get busy() { return state.busy; },
    get error() { return state.error; },
    async unlock(i, mode) { await run(i, () => session.unlockDisk(i, mode)); },
    async lock(i) { await run(i, () => session.lockDisk(i)); },
    reset() { state.busy = null; state.error = null; },
  };

  async function run(i, fn) {
    state.busy = i; state.error = null; paint();
    try { await fn(); } catch (e) { state.error = describeError(e); }
    state.busy = null; paint();
  }

  return view;
}
