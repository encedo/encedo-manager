// Firmware and Manager updates: from the backend, or from a file.

import { describeError } from '../session.js';

export function createSoftwareView({ session, paint, probeAgain }) {
  const view = {
    busy: null,
    error: null,
    notice: null,
    file: null,               // a File picked for a manual firmware update
    ctl: null,                // AbortController of the update in flight
    describe: describeError,

    /** Which step failed, for the step list: the one the update was on. */
    failedAt(update, order) {
      const at = order.indexOf(update.failedStep ?? '');
      return at >= 0 ? at : order.length;
    },

    async checkIn() {
      Object.assign(view, { busy: 'checkin', error: null, notice: null });
      paint();
      const health = await session.checkIn();
      view.notice = health ? 'Checked in.' : null;
      view.error = health ? null : 'The Encedo backend did not answer.';
      view.busy = null;
      paint();
    },

    install(kind, version) { return view.run(kind, { version }); },

    pickFile(file) { Object.assign(view, { file, error: null, notice: null }); paint(); },
    dropFile() { view.file = null; paint(); },
    async installFile() {
      const file = view.file;
      if (!file) return;
      const bytes = new Uint8Array(await file.arrayBuffer());
      view.file = null;
      return view.run('firmware', { bytes });
    },

    async run(kind, { version = null, bytes = null }) {
      const ctl = new AbortController();
      Object.assign(view, { ctl, error: null, notice: null });
      paint();
      try {
        if (kind === 'firmware') {
          await session.updateFirmware({ version, bytes, signal: ctl.signal });
          probeAgain();                       // the module reboots; this page waits for it
        } else {
          await session.updateManager({ version, bytes, signal: ctl.signal });
          setTimeout(() => location.reload(), 2500);
        }
      } catch (e) {
        if (session.state.update) session.state.update.failedStep = failedStepOf(session.state.update);
        if (e?.code === 'aborted') { session.clearUpdate(); view.notice = 'Cancelled. Nothing was installed.'; }
      }
      view.ctl = null;
      paint();
    },
    cancel() { view.ctl?.abort(); },
    dismiss() { session.clearUpdate(); paint(); },

    reset() {
      view.ctl?.abort();
      Object.assign(view, { busy: null, error: null, notice: null, file: null, ctl: null });
    },
  };

  /** The step an update was on when it failed: the last one it reached. */
  function failedStepOf(update) {
    if (update.result) return 'install';
    if (update.loaded && update.loaded >= update.total && update.total) return 'verify';
    if (update.size) return 'upload';
    return update.source === 'backend' ? 'download' : 'upload';
  }
  return view;
}
