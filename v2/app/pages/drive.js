// Secure drive: lock and unlock the module's drives.

import { h, pageHead, pill } from '../ui.js';
import { formatBytes, describeError } from '../session.js';

const KIND = ['Primary drive', 'Hidden drive'];

export function renderDrive(session, view) {
  const disks = session.disks();
  const exposed = disks.filter((d) => d.state !== 'locked');
  const title = !disks.length ? 'No drive reported.'
    : exposed.length === 0 ? (disks.length === 1 ? 'The drive is sealed.' : `${disks.length === 2 ? 'Two' : disks.length} drives, all sealed.`)
    : exposed.length === disks.length ? 'Every drive is on the host.'
    : 'One drive is on the host.';

  return [
    pageHead('Secure drive', title, 'Unlocking hands a drive to the computer the module is plugged into, over USB. Read-only keeps the contents; read-write trusts that computer.'),
    view.error ? h('p.error', { role: 'alert' }, view.error) : null,
    disks.length ? h('div.grid-2', {}, disks.map((d) => diskCard(d, view))) : null,
    h('dl', { style: 'display: flex; flex-direction: column; max-width: 860px;' },
      h('div.item', {}, h('dt', {}, 'What unlocking costs'), h('dd', {}, 'While a drive is unlocked, its contents are as safe as the host. Lock it before you walk away; the module locks both on reboot.')),
      h('div.item', {}, h('dt', {}, 'Who can unlock'), h('dd', {}, 'A token for ', h('span.mono', {}, 'storage:disk0'), ' (read-only) or ', h('span.mono', {}, 'storage:disk0:rw'), '. Your password issues one; so does a paired phone.'))),
  ];
}

function diskCard(d, view) {
  const busy = view.busy === d.index;
  const name = `disk${d.index}`;
  const rw = d.state === 'rw', ro = d.state === 'ro';
  const state = d.state === 'locked' ? pill('sealed', 'Locked') : pill('exposed', rw ? 'Unlocked · read-write' : 'Unlocked · read-only');
  const body = d.state === 'locked'
    ? 'Sealed inside the module. The host sees no drive until you unlock it.'
    : rw ? 'The host can read and write this drive over USB. Anything running there can change it.'
         : 'The host can read this drive over USB, and cannot change it.';
  const actions = d.state === 'locked'
    ? [h('button.button', { type: 'button', disabled: busy || null, onclick: () => view.unlock(d.index, 'ro') }, busy ? 'Unlocking…' : 'Unlock read-only'),
       h('button.button.plain', { type: 'button', disabled: busy || null, onclick: () => view.unlock(d.index, 'rw') }, 'Unlock read-write')]
    : [h('button.button.exposed', { type: 'button', disabled: busy || null, onclick: () => view.lock(d.index) }, busy ? 'Locking…' : 'Lock')];
  return h('div.card', {},
    h('div.card-head', {}, h('span', {}, name), h('span.v', {}, d.state === 'locked' ? 'sealed' : 'on the host')),
    h('div.card-body', {},
      h('div.between', { style: 'align-items: flex-start;' },
        h('div.stack-s', { style: 'gap: 4px;' }, h('h2', {}, KIND[d.index] ?? `Drive ${d.index}`), h('span.mono.muted', { style: 'font-size: 13px;' }, formatBytes(d.bytes))),
        state),
      h('p.soft', {}, body),
      h('div.row', {}, actions)));
}

export function driveError(e) { return describeError(e); }
