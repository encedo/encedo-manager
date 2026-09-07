// Paired phones: the phones that can answer for the person instead of the
// password, and the way a new one is paired — a QR code on this page, scanned
// by the Encedo Mobile Authenticator, with the module checking the reply.

import { h, pageHead, colgroup } from '../ui.js';
import { formatDate } from '../session.js';
import { qrSvg } from '../qr.js';

const STEPS = [
  ['Install Encedo Mobile Authenticator', ' from Google Play or the App Store.'],
  ['Scan this code', ' in the app. It carries a one-time link and a hash of the module’s challenge.'],
  ['Confirm on the phone.', ' The module checks the phone’s reply before the pairing is kept.'],
];

export function renderPhones(session, view) {
  const { state } = session;
  const phones = session.pairedPhones();
  const loading = !state.keys && !view.loadError;      // the phones are keys, read once per session
  const count = phones.length;
  const title = loading ? 'Reading the keychain…'
    : count === 0 ? 'No phone is paired.'
    : count === 1 ? 'One phone can answer for you.'
    : count === 2 ? 'Two phones can answer for you.'
    : `${count} phones can answer for you.`;

  return [
    pageHead('Paired phones', title,
      'A paired phone approves sign-ins and key operations instead of the password. Each one is a key in the keychain and a subscriber at the broker; unpairing removes both.'),
    view.error || view.loadError ? h('p.error', { role: 'alert' }, view.error ?? view.loadError) : null,
    view.notice ? h('p.notice', { role: 'status' }, view.notice) : null,
    phonesCard(session, phones, view, loading),
    pairCard(session, view),
  ];
}

// -- the list ---------------------------------------------------------------------------

function phonesCard(session, phones, view, loading) {
  const { state } = session;
  return h('div.card', {},
    h('div.card-head', {}, h('span', {}, 'Paired'), h('span.v', {}, loading ? 'reading' : `${phones.length} phone${phones.length === 1 ? '' : 's'}`)),
    phones.length
      ? h('div.table-wrap', {}, h('table.fixed', {},
          colgroup(['34%', '16%', '36%', '14%']),
          h('thead', {}, h('tr', {}, ['Phone', 'Paired', 'Where it is'].map((c) => h('th', {}, c)), h('th', {}))),
          h('tbody', {}, phones.flatMap((p) => [row(p, view), view.confirmUnpair === p.pid ? confirmRow(p, view) : null]))))
      : h('div.card-body', {}, h('p.soft', {}, loading ? 'The keychain is being read; the phones are in it.' : 'None yet. Pair one below, and phone sign-in is offered first from then on.')),
    h('p.status-note', {},
      state.online === false
        ? 'The Encedo backend is unreachable, so the broker could not be asked which phones it still routes to. What is listed comes from the keychain alone.'
        : 'Phone sign-in is offered first while at least one phone is paired. The password always works.'));
}

function row(p, view) {
  const asked = view.confirmUnpair === p.pid;
  return h(`tr${asked ? '.open' : ''}`, {},
    h('td', {},
      h('b', { style: 'font-weight: 600;' }, p.label || '(no name)'),
      h('br'),
      h('span.muted.mono.sub', { title: p.kid ? `kid ${p.kid}` : null }, `pid ${shortPid(p.pid)}`)),
    h('td', {}, p.created ? formatDate(p.created) : '—'),
    whereCell(p),
    h('td.actions', {},
      h('button.button.small.plain', { type: 'button', disabled: view.busy || null, onclick: () => (asked ? view.cancelUnpair() : view.askUnpair(p.pid)) }, asked ? 'Keep it' : 'Unpair')));
}

/** Where the pairing lives, and whether both halves agree. */
function whereCell(p) {
  if (!p.inKeychain) return h('td.risk', {}, 'Broker only', h('br'), h('span.muted', { style: 'font-size: 12px;' }, 'no key in the module, so it cannot answer'));
  if (p.atBroker === false) return h('td.risk', {}, 'Keychain only', h('br'), h('span.muted', { style: 'font-size: 12px;' }, 'the broker does not route to it'));
  if (p.atBroker === null) return h('td', {}, 'Keychain', h('br'), h('span.muted', { style: 'font-size: 12px;' }, 'broker not asked while offline'));
  return h('td.safe', {}, 'Keychain and broker');
}

function confirmRow(p, view) {
  const busy = view.busy === 'unpair';
  const what = !p.inKeychain
    ? 'The broker stops routing requests to it. There is no key in the module to remove.'
    : p.atBroker === null
      ? 'Its key leaves the module, so it can no longer answer for you. The broker is told when the backend is reachable again; until then it still lists the phone.'
      : 'Its key leaves the module and the broker stops routing requests to it. Pairing the same phone again makes a new key.';
  return h('tr.detail', {}, h('td', { colspan: '4' },
    h('div.detail-body', { style: 'gap: 14px;' },
      h('p.soft.measure', {}, what),
      h('div.row', {},
        h('button.button.small.exposed', { type: 'button', disabled: busy || null, onclick: () => view.unpair(p) }, busy ? 'Unpairing…' : `Unpair ${p.label || 'this phone'}`),
        h('button.button.small.plain', { type: 'button', disabled: busy || null, onclick: () => view.cancelUnpair() }, 'Keep it')))));
}

const shortPid = (pid) => (pid.length > 14 ? `${pid.slice(0, 6)}…${pid.slice(-4)}` : pid);

// -- pairing ----------------------------------------------------------------------------

function pairCard(session, view) {
  const { state } = session;
  const pairing = view.pairing;
  if (pairing) return pairingCard(pairing, view);

  const offline = state.online === false;
  return h('div.card', {},
    h('div.card-head', {}, h('span', {}, 'Pair a phone'), h('span.v', {}, offline ? 'needs the backend' : 'about a minute')),
    h('div.card-body', {},
      h('div.steps', {}, STEPS.map(([lead, rest], i) => step(i, lead, rest))),
      h('div.row', {},
        h('button.button', { type: 'button', disabled: offline || view.busy || null, onclick: () => view.pair() }, 'Pair a phone'),
        offline ? h('span.soft', { style: 'font-size: 14px;' }, 'Pairing needs the Encedo backend, and it is unreachable.') : null)));
}

function pairingCard(pairing, view) {
  const left = Math.max(0, Math.ceil((pairing.deadline - Date.now()) / 1000));
  let qr = null;
  if (pairing.qrText) {
    try { qr = qrSvg(pairing.qrText, { size: 260 }); }
    catch { qr = h('p.error', {}, 'The pairing data does not fit in a QR code.'); }
  }
  return h('div.card', {},
    h('div.card-head', {}, h('span', {}, 'Pair a phone'), h('span.v', {}, pairing.qrText ? `${left} s left` : 'asking the module')),
    h('div.card-body', {},
      h('div.share-out', {},
        h('div.stack', {},
          h('div.steps', {}, STEPS.map(([lead, rest], i) => step(i, lead, rest))),
          h('div.row', {},
            h('button.button.plain', { type: 'button', onclick: () => view.cancelPair() }, 'Cancel'),
            h('span.mono.muted', { style: 'font-size: 12px;' }, pairing.qrText ? 'Waiting for the phone' : 'Asking the module for a challenge…'))),
        pairing.qrText
          ? h('figure.qr', {}, qr, h('figcaption', {}, 'One-time. It stops working when the timer runs out or you cancel.'))
          : null)));
}

const step = (i, lead, rest) => h('div.step', {}, h('span.step-n', {}, String(i + 1).padStart(2, '0')), h('p', {}, h('b', {}, lead), rest));
