// The keychain: the list, a key opened under its row, and every key operation.

import { describeError, buildShareCode, shareCodeText } from '../session.js';

export function createKeychainView({ session, paint }) {
  const view = {
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

    showForm(kind) { Object.assign(view, { form: kind, error: null, notice: null }); paint(); },
    closeForm() { view.form = null; paint(); },

    openKey(kid) {
      Object.assign(view, { open: kid, detail: null, share: null, shareNote: '', shareEmail: '', editing: null, confirmDelete: null, error: null, notice: null });
      paint();
      const key = (session.state.keys ?? []).find((k) => k.kid === kid);
      if (!key || key.symmetric) return;          // a secret key has no public half to fetch
      session.keyPublic(kid)
        .then((detail) => { if (view.open === kid) view.detail = detail; })
        .catch((e) => { if (view.open === kid) view.error = describeError(e); })
        .finally(() => { if (view.open === kid) paint(); });
    },
    closeKey() { Object.assign(view, { open: null, detail: null, share: null, editing: null, confirmDelete: null }); paint(); },

    startEdit(kid) { Object.assign(view, { editing: kid, error: null, notice: null }); paint(); },
    cancelEdit() { view.editing = null; paint(); },

    create(fields) {
      return keychainOp('create', async () => {
        await session.createKey(fields);
        view.form = null;
      }, 'Created. The module keeps the private half.');
    },

    import(fields) {
      return keychainOp('import', async () => {
        await session.importKey(fields);
        view.form = null;
      }, 'Imported. It is a public key: the module can verify and agree with it, not sign as it.');
    },

    rename(kid, label, descr) {
      return keychainOp('rename', async () => {
        await session.renameKey(kid, label, descr);
        view.editing = null;          // saved, so it locks again
      }, 'Saved.');
    },

    remove(kid) {
      return keychainOp('delete', async () => {
        await session.removeKey(kid);
        Object.assign(view, { open: null, detail: null, share: null, editing: null, confirmDelete: null });
      }, 'The key is gone.');
    },

    askDelete(kid) { view.confirmDelete = kid; paint(); },
    cancelDelete() { view.confirmDelete = null; paint(); },

    makeShare(key, pubkey, note) {
      if (!pubkey) return;
      const code = buildShareCode(key, pubkey, note);
      Object.assign(view, { share: { kid: key.kid, code, text: shareCodeText(code) }, error: null, notice: null });
      paint();
    },

    emailShare(key, pubkey, note, address) {
      if (!address) { view.error = 'Type the address to send it to.'; paint(); return Promise.resolve(); }
      const code = buildShareCode(key, pubkey, note);
      view.share = { kid: key.kid, code, text: shareCodeText(code) };
      return keychainOp('share', () => session.shareKeyByEmail(address, code), `The share code is on its way to ${address}.`);
    },

    /**
     * The keychain is read once per session, when a page first asks for it. The
     * read starts after this render, not inside it, so paint() never re-enters.
     */
    ensure() {
      if (session.state.keys || view.busy || view.error) return;
      view.busy = 'load';
      queueMicrotask(() => session.loadKeys()
        .catch((e) => { view.error = describeError(e); })
        .finally(() => { view.busy = null; paint(); }));
    },

    /** Ask for it again after a read that failed — a refused password, say. */
    retry() {
      view.error = null;
      view.ensure();
      paint();
    },

    reset() {
      Object.assign(view, { q: '', page: 1, form: null, open: null, detail: null, share: null, shareNote: '', shareEmail: '', editing: null, confirmDelete: null, busy: null, error: null, notice: null });
    },
  };

  async function keychainOp(name, fn, notice = null) {
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
  }
  return view;
}
