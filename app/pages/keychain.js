// Keychain: what the module holds, and the two ways something gets into it.

import { h, pageHead, field, select, statusGrid, render, copyControl, colgroup } from '../ui.js';
import { pageOf, pagerFoot } from '../table.js';
import {
  formatDate, parseShareCode, describeError, toB64Text,
  LABEL_CHARS, DESCR_BYTES, b64ByteLength, textByteLength, isAsciiLabel,
} from '../session.js';
import { qrSvg } from '../qr.js';

// A key that can both sign and agree has to be told which; every other type has
// one use and the module works it out. Order follows what a key is *for*.
const NIST = ['SECP256R1', 'SECP384R1', 'SECP521R1', 'SECP256K1'];
const SIGN = ['ED25519', 'ED448', 'MLDSA44', 'MLDSA65', 'MLDSA87'];
const AGREE = ['CURVE25519', 'CURVE448', 'MLKEM512', 'MLKEM768', 'MLKEM1024'];
const SECRETS = ['AES128', 'AES192', 'AES256', 'SHA2-256', 'SHA2-384', 'SHA2-512', 'SHA3-256', 'SHA3-384', 'SHA3-512'];

const CREATE_TYPES = [
  ['To sign with', SIGN],
  ['To agree a shared secret', AGREE],
  ['Either — you choose below', NIST],
  ['Secrets that only the module uses', SECRETS],
];
const IMPORT_TYPES = [['To verify signatures', SIGN], ['To agree a shared secret', AGREE], ['NIST curves', NIST]];
const USES = [['ECDH,ExDSA', 'Both'], ['ECDH', 'Agree a shared secret only'], ['ExDSA', 'Sign only']];

// What is left of each field, in the unit the module counts in. A label is
// characters; a description is bytes, and base64 is only how they travel.
const labelCount = (value) => {
  if (!isAsciiLabel(value)) return { text: 'ASCII only, 0x20–0x7F', over: true };
  return { text: `${value.length} / ${LABEL_CHARS}`, over: value.length > LABEL_CHARS };
};
const b64Count = (value) => {
  const bytes = b64ByteLength(value);
  if (bytes === null) return { text: 'not base64', over: true };
  return { text: `${bytes} / ${DESCR_BYTES} bytes`, over: bytes > DESCR_BYTES };
};
const textCount = (value) => {
  const bytes = textByteLength(value);
  return { text: `${bytes} / ${DESCR_BYTES} bytes`, over: bytes > DESCR_BYTES };
};

// The key id rides under the label rather than in a column of its own: it is
// what identifies a key everywhere else, and it is too long to truncate twice.
const B64_CHARS = Math.ceil(DESCR_BYTES / 3) * 4;      // as many base64 characters as the field can fill

const COLUMNS = [
  { id: 'label', label: 'Label' },
  { id: 'type', label: 'Type' },
  { id: 'created', label: 'Created', first: 'desc' },   // a date reads newest-first
  { id: 'where', label: 'Where' },
];
export function renderKeychain(session, view) {
  const keys = session.state.keys;

  // Search, sort and paging repaint the table alone, so the caret stays put.
  const listBox = h('div');
  const paintList = () => render(listBox, listCard(session, view, paintList));
  paintList();

  const search = h('input', {
    type: 'search', placeholder: 'wg-peer', value: view.q,
    oninput: (e) => { view.q = e.target.value; view.page = 1; paintList(); },
  });

  return [
    pageHead('Keychain', title(keys), 'Private keys are generated in the module and never exported. Apps ask the module to sign or agree a secret; you decide which of them may, and for how long.'),
    view.error ? h('p.error', { role: 'alert' }, view.error) : null,
    view.notice ? h('p.notice', { role: 'status' }, view.notice) : null,
    !keys && view.error ? retryCard(view) : null,
    h('div.between', {},
      h('div', { style: 'width: 360px;' }, field('Search by label or description', search)),
      h('div.row', {},
        h('button.button', { type: 'button', onclick: () => view.showForm('create') }, 'Create key pair'),
        h('button.button.plain', { type: 'button', onclick: () => view.showForm('import') }, 'Import public key'))),
    view.form === 'create' ? createForm(view) : null,
    view.form === 'import' ? importForm(view) : null,
    listBox,
  ];
}

function title(keys) {
  if (!keys) return 'Reading the keychain.';
  if (!keys.length) return 'The keychain is empty.';
  const count = keys.length === 1 ? 'One key' : `${keys.length} keys`;
  const open = keys.filter((k) => !k.sealed).length;
  if (!open) return `${count}, every private half sealed inside.`;
  return `${count}; ${open === 1 ? 'one is a public key' : `${open} are public keys`} you imported.`;
}

// -- the list -------------------------------------------------------------------------

function listCard(session, view, paintList) {
  const keys = session.state.keys;
  if (!keys) {
    return h('div.card', {},
      h('div.card-head', {}, h('span', {}, 'Keys in the module'), h('span.v', {}, 'reading')),
      h('div.card-body', {}, h('p.soft', {}, 'Asking the module for the keychain. It answers a page at a time.')));
  }
  const found = sortKeys(filterKeys(keys, view.q), view.sort.by, view.sort.dir);
  const page = pageOf(found, view.page, view.pageSize);
  view.page = page.page;

  return h('div.card', {},
    h('div.card-head', {}, h('span', {}, 'Keys in the module'), h('span.v', {}, `${found.length} of ${keys.length}`)),
    found.length
      ? h('div.table-wrap', {}, h('table.fixed', {},
          colgroup(['36%', '20%', '14%', '16%', '14%']),
          h('thead', {}, headerRow(view, paintList)),
          h('tbody', {}, page.rows.flatMap((k) => [row(k, view, paintList), view.open === k.kid ? detailRow(session, k, view) : null]))))
      : h('div.card-body', {}, h('p.soft', {}, keys.length ? `Nothing here matches “${view.q}”.` : 'No keys yet. Create a key pair, or import someone else’s public key.')),
    found.length ? pagerFoot(page, view, paintList) : null);
}

function headerRow(view, paintList) {
  const sort = (col) => {
    view.sort = view.sort.by === col.id
      ? { by: col.id, dir: view.sort.dir === 'asc' ? 'desc' : 'asc' }
      : { by: col.id, dir: col.first ?? 'asc' };
    view.page = 1;
    paintList();
  };
  return h('tr', {}, [
    ...COLUMNS.map((col) => {
      const active = view.sort.by === col.id;
      return h('th.sortable', { 'aria-sort': active ? (view.sort.dir === 'asc' ? 'ascending' : 'descending') : 'none' },
        h('button', { type: 'button', onclick: () => sort(col) }, col.label, h('span.arrow', {}, active ? (view.sort.dir === 'asc' ? '▲' : '▼') : '')));
    }),
    h('th', {}),
  ]);
}

function row(k, view, paintList) {
  const open = view.open === k.kid;
  const uses = k.uses.length ? k.uses.join(', ') : k.symmetric ? 'secret' : '—';
  return h(`tr${open ? '.open' : ''}`, { title: descrTitle(k) },
    h('td', {},
      h('b', { style: 'font-weight: 600;' }, k.label || '(no label)'),
      h('br'),
      h('span.muted.mono.sub', {}, `kid ${k.kid}`)),
    h('td.mono', {}, k.algorithm, h('br'), h('span.muted', { style: 'font-size: 12px;' }, uses)),
    h('td', {}, formatDate(k.created)),
    h(`td.${k.sealed ? 'safe' : 'risk'}`, {}, k.sealed ? 'Sealed' : 'Public only'),
    h('td.actions', {},
      h('button.button.small.plain', { type: 'button', onclick: () => { open ? view.closeKey() : view.openKey(k.kid); paintList(); } }, open ? 'Less' : 'More')));
}

/** The description is a byte field, so hovering a key offers it both ways it can be read. */
const descrTitle = (k) => (k.descrB64 ? `description\nbase64  ${k.descrB64}\nhex     ${k.descrHex}` : null);

/**
 * The field as something a search box can match: printable ASCII kept, every
 * other byte a space. Used for matching only — it is never put on the page,
 * because a byte that is not text must not be shown as if it were.
 */
const searchable = (bytes) => (bytes ? [...bytes].map((b) => (b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : ' ')).join('') : '');

/** Label, description or key id — whatever the person remembers about a key. */
export function filterKeys(keys, q) {
  const needle = String(q ?? '').trim().toLowerCase();
  if (!needle) return keys;
  return keys.filter((k) => `${k.label} ${searchable(k.description)} ${k.descrB64} ${k.descrHex} ${k.kid} ${k.algorithm}`.toLowerCase().includes(needle));
}

/** Sort by one column; equal rows keep a stable order, by label then key id. */
export function sortKeys(keys, by = 'label', dir = 'asc') {
  const sign = dir === 'desc' ? -1 : 1;
  const of = (k) => ({
    label: k.label.toLowerCase(),
    type: k.algorithm.toLowerCase(),
    kid: k.kid,
    created: k.created ?? 0,
    where: k.sealed ? 'sealed' : 'public',
  })[by] ?? '';
  return [...keys].sort((a, b) => {
    const va = of(a), vb = of(b);
    if (va < vb) return -sign;
    if (va > vb) return sign;
    return a.label.localeCompare(b.label) || a.kid.localeCompare(b.kid);
  });
}

// -- create and import ----------------------------------------------------------------

function createForm(view) {
  const label = h('input', { type: 'text', maxlength: LABEL_CHARS, required: true, placeholder: 'wg-peer-04' });
  const descr = h('input', { type: 'text', maxlength: DESCR_BYTES, placeholder: 'WireGuard identity, laptop' });
  const mode = select(USES, 'ECDH,ExDSA');
  const modeBox = field('What it may do', mode, 'A NIST curve can sign and agree. The module holds it to one answer.');
  const type = select(CREATE_TYPES, 'CURVE25519', { onchange: () => { modeBox.hidden = !NIST.includes(type.value); } });
  modeBox.hidden = true;

  const submit = (e) => {
    e.preventDefault();
    view.create({ label: label.value.trim(), type: type.value, mode: NIST.includes(type.value) ? mode.value : null, descr: toB64Text(descr.value.trim()) });
  };
  return formCard(view, 'Create key pair', 'Generated inside the module',
    'The module makes the pair and keeps the private half. Nothing you do here, and nothing an app does later, can get that half out.',
    [field('Label', label, null, { counter: labelCount }), field('Type', type),
     field('Description', descr, 'Stored as bytes: what you type is encoded as UTF-8.', { counter: textCount }), modeBox],
    view.busy === 'create' ? 'Generating…' : 'Create key pair', submit);
}

function importForm(view) {
  const label = h('input', { type: 'text', maxlength: LABEL_CHARS, required: true, placeholder: 'bob' });
  const descr = h('input.mono', { type: 'text', maxlength: B64_CHARS, placeholder: 'base64, or leave it empty', spellcheck: 'false' });
  const pubkey = h('textarea', { required: true, placeholder: 'base64 or hex' });
  const mode = select(USES, 'ECDH,ExDSA');
  const modeBox = field('What it may do', mode);
  const type = select(IMPORT_TYPES, 'ED25519', { onchange: () => { modeBox.hidden = !NIST.includes(type.value); } });
  modeBox.hidden = true;

  const code = h('textarea', { placeholder: 'Paste a share code here to fill this form in' });
  const said = h('span.hint');
  const useCode = () => {
    try {
      const filled = parseShareCode(code.value);
      label.value = filled.label;
      descr.value = filled.descrB64;
      pubkey.value = filled.pubkey;
      type.value = filled.type;
      mode.value = filled.mode ?? mode.value;
      modeBox.hidden = !NIST.includes(type.value);
      said.className = 'hint';
      said.textContent = filled.note ? `From whoever sent it: ${filled.note}` : 'Filled in from the share code.';
    } catch (e) {
      said.className = 'error';
      said.textContent = describeError(e);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    view.import({ label: label.value.trim(), type: type.value, mode: NIST.includes(type.value) ? mode.value : null, pubkey: pubkey.value, descr: descr.value.trim() });
  };
  return formCard(view, 'Import public key', 'Someone else’s half',
    'An imported key is public: the module can verify signatures with it and agree secrets against it, and anyone who reads the module learns nothing they could not already know.',
    [field('Label', label, null, { counter: labelCount }), field('Type', type),
     field('Description (base64)', descr, 'The field as bytes — a share code fills it in.', { counter: b64Count }), modeBox,
     h('div', { style: 'grid-column: 1 / -1;' }, field('Public key', pubkey, 'Raw bytes for 25519/448, a compressed SEC1 point for the NIST curves.', { copy: true })),
     h('div', { style: 'grid-column: 1 / -1;' }, field('Share code', code, null),
       h('div.row', { style: 'margin-top: 10px;' }, h('button.button.small.plain', { type: 'button', onclick: useCode }, 'Read the share code'), said))],
    view.busy === 'import' ? 'Importing…' : 'Import public key', submit);
}

function formCard(view, head, eyebrow, lede, fields, action, submit) {
  return h('form.card.lifted', { onsubmit: submit },
    h('div.card-head', {}, h('span', {}, head), h('span.v', {}, eyebrow)),
    h('div.card-body', {},
      h('p.soft.measure', {}, lede),
      h('div.form-grid', {}, fields),
      h('div.row', {},
        h('button.button', { type: 'submit', disabled: view.busy || null }, action),
        h('button.button.plain', { type: 'button', onclick: () => view.closeForm() }, 'Cancel'))));
}

// -- one key, opened under its own row ------------------------------------------------

function detailRow(session, key, view) {
  const detail = view.detail?.kid === key.kid ? view.detail : null;
  return h('tr.detail', {}, h('td', { colspan: String(COLUMNS.length + 1) },
    h('div.detail-body', {},
      h('div.card', {}, statusGrid([
        ['Type', key.algorithm],
        ['May be used to', key.uses.length ? key.uses.join(' and ') : key.symmetric ? 'work inside the module' : '—'],
        ['Where', key.sealed ? 'Sealed in the module' : 'Public only', key.sealed ? '' : 'risk'],
        ['Key id', key.kid],
        ['Created', formatDate(key.created)],
        ['Last changed', formatDate(key.updated)],
      ])),
      publicKeyBlock(key, detail),
      renameBlock(key, view),
      key.symmetric ? null : shareBlock(session, key, detail, view),
      deleteBlock(key, view))));
}

function publicKeyBlock(key, detail) {
  if (key.symmetric) return h('p.soft', {}, 'A secret key has no public half. It never leaves the module in any form.');
  if (!detail) return h('p.soft', {}, 'Reading the public key from the module…');
  return h('div.stack-s', {},
    h('div.field-head', {}, h('h2', {}, 'Public key'), copyControl(detail.pubkey)),
    h('p.blob', {}, detail.pubkey || '—'));
}

function renameBlock(key, view) {
  const editing = view.editing === key.kid;
  const saving = view.busy === 'rename';
  const label = h('input', { type: 'text', maxlength: LABEL_CHARS, value: key.label, readonly: !editing || null });
  const descr = h('input.mono', { type: 'text', maxlength: B64_CHARS, value: key.descrB64, readonly: !editing || null, spellcheck: 'false' });
  return h('form.stack-s', { onsubmit: (e) => { e.preventDefault(); if (editing) view.rename(key.kid, label.value.trim(), descr.value); } },
    h('h2', {}, 'Label and description'),
    h('p.soft', {}, 'The only parts of a key that can change. The key itself cannot.'),
    h('div.form-grid', {},
      field('Label', label, null, { copy: true, counter: editing ? labelCount : null }),
      field('Description (base64)', descr,
        editing ? 'The field exactly as the module has it, so binary survives an edit.' : null,
        { copy: true, counter: editing ? b64Count : null })),
    h('div.row', {}, editing
      ? [h('button.button.small', { type: 'submit', disabled: saving || null }, saving ? 'Saving…' : 'Save'),
         h('button.button.small.plain', { type: 'button', disabled: saving || null, onclick: () => view.cancelEdit() }, 'Cancel')]
      : h('button.button.small.plain', { type: 'button', onclick: () => view.startEdit(key.kid) }, 'Edit')));
}

function shareBlock(session, key, detail, view) {
  // Kept on the view, so making the code (which repaints) does not empty the fields.
  const note = h('input', { type: 'text', maxlength: 120, placeholder: 'What this key is for', value: view.shareNote ?? '', oninput: (e) => { view.shareNote = e.target.value; } });
  const email = h('input', { type: 'email', placeholder: 'bob@example.com', value: view.shareEmail ?? '', oninput: (e) => { view.shareEmail = e.target.value; } });
  const share = view.share?.kid === key.kid ? view.share : null;
  const online = session.state.online;

  return h('div.stack-s', {},
    h('h2', {}, 'Share the public half'),
    h('p.soft.measure', {}, 'A share code carries this key’s public half, its type and a note — nothing secret. Scan it off the screen with a phone, send it by e-mail through Encedo, or copy it and pass it on yourself.'),
    h('div.form-grid', {}, field('Note', note), field('Send to', email, online ? 'The code goes through api.encedo.com.' : 'The backend is unreachable; the code and the QR still work.')),
    h('div.row', {},
      h('button.button.small.plain', { type: 'button', disabled: !detail || null, onclick: () => view.makeShare(key, detail?.pubkey, note.value) }, share ? 'Make it again' : 'Make a share code'),
      h('button.button.small', { type: 'button', disabled: !online || !detail || view.busy === 'share' || null, onclick: () => view.emailShare(key, detail?.pubkey, note.value, email.value.trim()) }, view.busy === 'share' ? 'Sending…' : 'Send by e-mail')),
    share ? shareResult(share) : null);
}

function shareResult(share) {
  let qr;
  try {
    qr = qrSvg(share.text, { size: 260 });
  } catch (e) {
    qr = h('p.error', {}, `The share code is too long for a QR code (${share.text.length} characters). Copy it instead.`);
  }
  return h('div.share-out', {},
    h('div.stack-s', {},
      h('div.field-head', {}, h('span.name', {}, 'Share code'), copyControl(share.text)),
      h('p.blob', {}, share.text)),
    h('figure.qr', {}, qr, h('figcaption', {}, 'Point a phone at this. It carries the same code.')));
}

function deleteBlock(key, view) {
  const asked = view.confirmDelete === key.kid;
  return h('div.stack-s', { style: 'border-top: 1px solid var(--rule); padding-top: 18px;' },
    h('h2', {}, 'Delete'),
    h('p.soft.measure', {}, key.sealed
      ? 'Deleting takes the private half with it. Anything signed with this key stays verifiable only if someone kept the public half; anything encrypted to it becomes unreadable.'
      : 'Deleting removes this public key from the module. You can import it again from the same bytes.'),
    asked
      ? h('div.row', {},
          h('button.button.small.exposed', { type: 'button', disabled: view.busy === 'delete' || null, onclick: () => view.remove(key.kid) }, view.busy === 'delete' ? 'Deleting…' : 'Delete for good'),
          h('button.button.plain.small', { type: 'button', onclick: () => view.cancelDelete() }, 'Keep it'))
      : h('div.row', {}, h('button.button.small.exposed', { type: 'button', onclick: () => view.askDelete(key.kid) }, 'Delete this key')));
}

/**
 * The keychain could not be read — a refused password, a module that went
 * away. Whatever it was, the way out is to ask again, and there is nothing
 * else on this page until it works.
 */
function retryCard(view) {
  return h('div.card', {},
    h('div.card-body', {},
      h('p.soft.measure', {}, 'The keys could not be read. Nothing has changed on the module.'),
      h('div.row', {}, h('button.button', { type: 'button', onclick: () => view.retry() }, 'Try again'))));
}
