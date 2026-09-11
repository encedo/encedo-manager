// The operation log: the index, one file opened, and every file verified.

import { describeError } from '../session.js';
import { parseLogFile } from '../logfile.js';

export function createLogView({ session, paint }) {
  const view = {
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
      Object.assign(view, { open: id, error: null, notice: null });
      view.entries.page = 1;
      paint();
      if (view.files[id] || view.busy) return;
      view.busy = id;
      readLogFile(id)
        .catch((e) => { view.error = describeError(e); })
        .finally(() => { view.busy = null; paint(); });
    },
    hide() { Object.assign(view, { open: null, error: null }); paint(); },

    /** Read what has not been read. One pass, so the count on screen means something. */
    async checkAll() {
      Object.assign(view, { busy: 'all', checked: 0, error: null, notice: null });
      paint();
      try {
        for (const id of session.state.logs?.ids ?? []) {
          if (!view.files[id]) await readLogFile(id);
          view.checked++;
          paint();
        }
        const failed = Object.values(view.files).filter((f) => f.result && !f.result.ok).length;
        view.notice = failed
          ? (failed === 1 ? 'One file does not match its seal.' : `${failed} files do not match their seals.`)
          : 'Every file verified.';
      } catch (e) {
        view.error = describeError(e);
      }
      view.busy = null;
      paint();
    },

    /** The log index is read once per session, the same way the keychain is. */
    ensure() {
      if (session.state.logs || view.busy || view.error) return;
      view.busy = 'index';
      queueMicrotask(() => session.loadLogs()
        .catch((e) => { view.error = describeError(e); })
        .finally(() => { view.busy = null; paint(); }));
    },

    reset() {
      Object.assign(view, { page: 1, open: null, files: {}, busy: null, checked: 0, error: null, notice: null });
    },
  };

  async function readLogFile(id) {
    try {
      const { text, ...result } = await session.readLog(id);
      view.files[id] = { result, text, entries: parseLogFile(text, id) };
    } catch (e) {
      if (e?.code !== 'log_in_progress') throw e;
      view.files[id] = { writing: true };      // a state, not a failure
    }
    return view.files[id];
  }
  return view;
}
