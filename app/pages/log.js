// Operation log: the files the module wrote, and what is in them once the seal
// on each one has been checked.

import { h, pageHead, statusGrid, render, copyControl } from '../ui.js';
import { pageOf, pagerFoot } from '../table.js';
import { formatDate } from '../session.js';
import { logFileTime, logFileHeader, describeVerification } from '../logfile.js';

const COLUMNS = ['File', 'Written', 'Entries', 'Integrity'];

export function renderLog(session, view) {
  const logs = session.state.logs;

  const listBox = h('div');
  const paintList = () => render(listBox, listCard(session, view, paintList));
  paintList();

  return [
    pageHead('Operation log', title(logs, view),
      'The module signs each file’s key line and seals every entry with it. The Manager checks the chain in your browser; a file that fails says where.'),
    view.error ? h('p.error', { role: 'alert' }, view.error) : null,
    view.notice ? h('p.notice', { role: 'status' }, view.notice) : null,
    !logs && view.error ? h('div.card', {}, h('div.card-body', {},
      h('p.soft.measure', {}, 'The log index could not be read. Nothing has changed on the module.'),
      h('div.row', {}, h('button.button', { type: 'button', onclick: () => view.retry() }, 'Try again')))) : null,
    logs ? keyCard(logs) : null,
    logs?.ids.length ? h('div.row', {},
      h('button.button.plain', { type: 'button', disabled: Boolean(view.busy) || null, onclick: () => view.checkAll() },
        view.busy === 'all' ? `Checking ${view.checked} of ${logs.ids.length}…` : 'Check every file'),
      h('span.soft', { style: 'font-size: 14px;' }, 'Each file is downloaded and its chain replayed here. Nothing is sent anywhere.')) : null,
    listBox,
  ];
}

function title(logs, view) {
  if (!logs) return 'Reading the log index.';
  if (!logs.ids.length) return 'The module has no log files.';
  const read = Object.values(view.files);
  const failed = read.filter((f) => f.result && !f.result.ok).length;
  const verified = read.filter((f) => f.result?.ok).length;
  const writing = read.filter((f) => f.writing).length;
  const count = logs.ids.length === 1 ? 'One log file' : `${logs.ids.length} log files`;
  if (failed) return `${count}; ${failed === 1 ? 'one does not match its seal' : `${failed} do not match their seals`}.`;
  if (!verified) return `${count}, none read yet.`;
  if (verified + writing === logs.ids.length) {
    return writing ? `${count}, every finished one verified.` : `${count}, every one verified.`;
  }
  return `${count}, ${verified} read and verified.`;
}

/** The key everything else is checked against, and whether the module owns it. */
function keyCard(logs) {
  return h('div.card', {},
    statusGrid([
      ['Logger key', h('span.mono', { style: 'font-size: 13px; word-break: break-all;' }, logs.key || '—')],
      ['Proof of possession', logs.signed ? 'The module signed a fresh nonce with it' : 'The module did not sign the nonce', logs.signed ? '' : 'risk'],
      ['Files', String(logs.ids.length)],
    ]),
    h('p.status-note', {}, logs.signed
      ? 'Every file below is checked against this key: the key line’s signature, then an HMAC chain over each entry. The check runs here, in your browser.'
      : 'Until the module proves it holds this key, a verified file means only that the file agrees with itself.'));
}

// -- the files ----------------------------------------------------------------------

function listCard(session, view, paintList) {
  const logs = session.state.logs;
  if (!logs) {
    return h('div.card', {},
      h('div.card-head', {}, h('span', {}, 'Log files'), h('span.v', {}, 'reading')),
      h('div.card-body', {}, h('p.soft', {}, 'Asking the module which log files it still holds.')));
  }
  const rows = [...logs.ids].sort((a, b) => parseInt(b, 16) - parseInt(a, 16));   // newest first
  const page = pageOf(rows, view.page, view.pageSize);
  view.page = page.page;

  return h('div.card', {},
    h('div.card-head', {},
      h('span', {}, 'Log files'),
      h('span.v', {}, view.busy === 'all' ? `checking ${view.checked} of ${rows.length}…` : String(rows.length))),
    rows.length
      ? h('div.table-wrap', {}, h('table', {},
          h('thead', {}, h('tr', {}, [...COLUMNS.map((c) => h('th', {}, c)), h('th', {})])),
          h('tbody', {}, page.rows.flatMap((id) => [
            fileRow(id, view),
            view.open === id ? detailRow(id, view) : null,
          ]))))
      : h('div.card-body', {}, h('p.soft', {}, 'Nothing to show. A module writes a file per session, so this fills up as it is used.')),
    rows.length ? pagerFoot(page, view, paintList) : null);
}

function fileRow(id, view) {
  const open = view.open === id;
  const read = view.files[id];
  const at = logFileTime(id);
  const integrity = !read
    ? h('span.muted', {}, view.busy === id ? 'reading…' : 'not read yet')
    : read.writing
      ? h('span.muted', { title: 'The module hands over a file once the session that writes it has ended.' }, 'still being written')
      : read.result.ok
        ? h('span.safe', {}, 'Verified')
        : h('span.risk', {}, `Fails at entry ${read.result.line} · ${read.result.reason}`);

  return h(`tr${open ? '.open' : ''}`, {},
    h('td', {}, h('b.mono', { style: 'font-weight: 600;' }, id)),
    h('td', {}, at ? `${formatDate(at.getTime() / 1000)} ${at.toTimeString().slice(0, 5)}` : '—'),
    h('td.mono', {}, read?.entries ? String(read.entries.length) : '—'),
    h('td', {}, integrity),
    h('td.actions', {},
      h('button.button.small.plain', { type: 'button', disabled: view.busy === id || null, onclick: () => (open ? view.hide() : view.show(id)) }, open ? 'Less' : 'More')));
}

function detailRow(id, view) {
  const read = view.files[id];
  const body = !read ? h('p.soft', {}, 'Reading the file and checking every entry…')
    : read.writing ? h('p.soft.measure', {}, 'This is the session the module is in the middle of. It hands a file over once that session ends — until then there is nothing to verify, because the file is not finished.')
    : fileDetail(id, read, view);
  return h('tr.detail', {}, h('td', { colspan: String(COLUMNS.length + 1) }, h('div.detail-body', {}, body)));
}

function fileDetail(id, read, view) {
  read = { ...read, id };
  const entriesBox = h('div');
  const paintEntries = () => render(entriesBox, entriesCard(read, view, paintEntries));
  paintEntries();

  const failed = !read.result.ok;
  return [
    h('div.between', { style: 'align-items: flex-start;' },
      h('div.stack-s', { style: 'gap: 6px;' },
        h('h2', {}, failed ? 'This file was changed after the module wrote it' : 'Every entry matches its seal'),
        h(`p.${failed ? 'error' : 'soft'}`, {}, describeVerification(read.result))),
      h('div.row', {},
        copyControl(read.text, { className: 'button.small.plain', label: 'Copy file' }),
        downloadButton(id, read.text))),
    h('p.note', {}, [logFileHeader(read.text), `${read.text.length} bytes`].filter(Boolean).join(' · ')),
    failed ? h('p.soft.measure', {}, 'The entries are shown as they are, up to and including the one that fails. Nothing here is repaired and nothing is hidden.') : null,
    entriesBox,
  ];
}

function entriesCard(read, view, paintEntries) {
  const page = pageOf(read.entries, view.entries.page, view.entries.pageSize);
  view.entries.page = page.page;
  const computed = read.entries.some((entry) => entry.derived);
  return h('div.card', {},
    h('div.card-head', {}, h('span', {}, 'Entries'), h('span.v', {}, String(read.entries.length))),
    h('div.table-wrap', {}, h('table', {},
      h('thead', {}, h('tr', {}, ['No', 'When', 'Event', 'Result', 'Subject'].map((c) => h('th', {}, c)))),
      h('tbody', {}, page.rows.map((entry) => entryRow(entry, read))))),
    computed ? h('p.status-note', {}, '* Written before the clock was set, so the module recorded seconds since it started. The time shown is the file’s own start — the epoch it is named after — plus that count.') : null,
    pagerFoot(page, view.entries, paintEntries));
}

const stamp = (at) => at.toISOString().slice(0, 19).replace('T', ' ');

function entryRow(entry, read) {
  const failedHere = !read.result.ok && read.result.line === entry.no;
  return h(`tr${failedHere ? '.open' : ''}`, {},
    h('td.mono', {}, String(entry.no)),
    h('td', { title: entry.derived ? `The clock was not set yet. ${entry.uptime} s after the module started, and the file starts at ${stamp(logFileTime(read.id))}.` : null },
      entry.at ? stamp(entry.at) : '—',
      entry.derived ? h('span.muted', {}, ' *') : null),
    h('td', {}, entry.event, failedHere ? h('span.risk', {}, ' · seal does not match') : null),
    h(`td.${entry.ok ? 'safe' : 'risk'}`, {}, entry.result),
    h('td.mono', { style: 'font-size: 12.5px;' }, entry.subject?.text ?? '—'));
}

/** The file as the module wrote it, saved where the person keeps records. */
function downloadButton(id, text) {
  const link = h('a.button.small.plain', { download: `encedo-${id}.log` }, 'Download file');
  link.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  return link;
}
