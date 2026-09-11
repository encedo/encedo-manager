// Software: what the module runs, what the backend has newer, and the way an
// update goes in — download, upload, the module's own check, install. Firmware
// reboots the module; the Manager reloads this page. Air-gapped, a firmware
// file obtained elsewhere goes in the same way; the module checks the signature
// either way.

import { h, pageHead, statusGrid } from '../ui.js';
import { formatBytes, versionNumber } from '../session.js';
import { VERSION } from '../version.js';

const STEPS = {
  firmware: [
    ['download', 'Download', ' from the backend.'],
    ['upload', 'Upload to the module', ' over the USB network.'],
    ['verify', 'Verify', ' the image on the module — its signature, by the module itself.'],
    ['install', 'Install and reboot.', ' Both drives lock. The module is away for about 40 seconds.'],
  ],
  manager: [
    ['download', 'Download', ' from the backend.'],
    ['upload', 'Upload to the module', ' over the USB network.'],
    ['verify', 'Verify', ' the bundle on the module.'],
    ['install', 'Install and reload.', ' The module keeps running; this page comes back in the new version.'],
  ],
};

export function renderSoftware(session, view) {
  const { state } = session;
  const health = state.health ?? {};
  const version = state.version ?? {};
  const newer = { firmware: health.newfws || null, manager: health.newuis || null };

  const title = state.online === false ? 'The backend is unreachable, so nothing was checked.'
    : newer.firmware && newer.manager ? `Firmware ${versionNumber(newer.firmware)} and Manager ${versionNumber(newer.manager)} are ready to install.`
    : newer.firmware ? `Firmware ${versionNumber(newer.firmware)} is ready to install.`
    : newer.manager ? `Manager ${versionNumber(newer.manager)} is ready to install.`
    : 'Everything is up to date.';

  return [
    pageHead('Software', title, 'Updates come from the Encedo backend when the module checks in, signed for this module. Installing firmware reboots it and locks both drives; installing the Manager reloads this page.'),
    view.error ? h('p.error', { role: 'alert' }, view.error) : null,
    view.notice ? h('p.notice', { role: 'status' }, view.notice) : null,
    versionsCard(session, view, newer),
    updateCard(session, view, 'firmware', newer.firmware, version.fwv),
    updateCard(session, view, 'manager', newer.manager, VERSION),
    fileCard(session, view),
  ];
}

function versionsCard(session, view, newer) {
  const { state } = session;
  const v = state.version ?? {};
  const when = state.checkedInAt ? new Date(state.checkedInAt).toISOString().slice(0, 19).replace('T', ' ') : null;
  return h('div.card', {},
    statusGrid([
      ['Firmware installed', v.fwv ?? '—'],
      ['Firmware available', newer.firmware ? versionNumber(newer.firmware) : state.online ? 'none newer' : '—', newer.firmware ? '' : 'pending'],
      ['Bootloader', v.blv ?? '—'],
      ['Manager installed', VERSION],
      ['Manager available', newer.manager ? versionNumber(newer.manager) : state.online ? 'none newer' : '—', newer.manager ? '' : 'pending'],
      ['Last check-in', when ?? (state.online === false ? 'the backend did not answer' : 'not yet')],
    ]),
    h('div.card-body', { style: 'border-top: 1px solid var(--rule);' },
      h('div.row', {},
        h('button.button.small.plain', { type: 'button', disabled: view.busy === 'checkin' || null, onclick: () => view.checkIn() }, view.busy === 'checkin' ? 'Asking…' : 'Check again'),
        h('span.soft', { style: 'font-size: 14px;' }, 'The module asks the backend what is newer than what it runs, and sets its clock while it is at it.'))));
}

/** One kind of update: the offer, or the update in flight. */
function updateCard(session, view, kind, available, installed) {
  const { state } = session;
  const update = state.update?.kind === kind ? state.update : null;
  const label = kind === 'firmware' ? 'Firmware' : 'Manager';
  const head = h('div.card-head', {},
    h('span', {}, label),
    h('span.v', {}, update ? stepLabel(update) : available ? `${versionNumber(available)} available` : 'up to date'));

  if (update) return h('div.card', {}, head, progressBody(update, view));

  const busyElsewhere = Boolean(state.update) && !['done', 'failed'].includes(state.update.step);
  return h('div.card', {},
    head,
    h('div.card-body', {},
      available
        ? [
            h('p.soft.measure', {}, kind === 'firmware'
              ? `The module runs ${versionNumber(installed)}; the backend has ${versionNumber(available)}, signed for this module. Installing reboots it: sessions end, both drives lock, and it is unreachable for about 40 seconds. Nothing in the keychain changes.`
              : `This page is Manager ${installed}; the backend has ${versionNumber(available)}. The module keeps running while it is installed, and this page reloads into the new version.`),
            h('div.row', {},
              h('button.button', { type: 'button', disabled: busyElsewhere || state.online !== true || null, onclick: () => view.install(kind, available) }, `Install ${label} ${versionNumber(available)}`)),
          ]
        : h('p.soft', {}, state.online === false
            ? `The backend could not be asked whether there is a newer ${label.toLowerCase()}.`
            : `The ${label.toLowerCase()} is current, as far as the backend knows.`)));
}

const stepLabel = (u) => ({
  download: 'downloading', upload: 'uploading', verify: 'verifying', install: 'installing',
  done: u.kind === 'firmware' ? 'rebooting' : 'reloading', failed: 'failed',
})[u.step] ?? u.step;

/** The update in flight: the steps, the bar while uploading, cancel, and what went wrong. */
export function progressBody(update, view) {
  const steps = STEPS[update.kind].filter(([id]) => update.source === 'backend' || id !== 'download');
  const order = steps.map(([id]) => id);
  const current = update.step === 'done' ? order.length : update.step === 'failed' ? -1 : order.indexOf(update.step);
  const pct = update.total ? Math.min(100, Math.round((update.loaded / update.total) * 100)) : 0;
  const inFlight = !['done', 'failed'].includes(update.step);

  return h('div.card-body', {},
    h('div.steps', {}, steps.map(([id, lead, rest], i) => {
      const st = update.step === 'failed' ? (i < view.failedAt(update, order) ? 'done' : i === view.failedAt(update, order) ? 'failed' : 'later')
        : i < current ? 'done' : i === current ? 'now' : 'later';
      return h('div.step', { 'data-state': st },
        h('span.step-n', {}, st === 'done' ? '✓' : st === 'now' ? '●' : st === 'failed' ? '✕' : '○'),
        h('p', { style: st === 'later' ? 'color: var(--muted);' : '' },
          h('b', {}, lead + (st === 'now' ? '…' : '')),
          st === 'later' ? '' : rest,
          id === 'upload' && st !== 'later' && update.total ? ` ${formatBytes(update.loaded)} of ${formatBytes(update.total)}.` : ''));
    })),
    update.step === 'upload' && update.total
      ? h('div.stack-s', { style: 'gap: 6px;' },
          h('div.progress', { role: 'progressbar', 'aria-valuenow': String(pct), 'aria-valuemin': '0', 'aria-valuemax': '100' }, h('i', { style: `width: ${pct}%;` })),
          h('span.mono.muted', { style: 'font-size: 12px;' }, `${pct} %`))
      : null,
    update.step === 'failed' ? h('p.error', { role: 'alert' }, view.describe(update.error)) : null,
    update.step === 'done' ? h('p.notice', { role: 'status' }, update.kind === 'firmware'
      ? 'Installed. The module is rebooting into the new firmware; this page waits for it and then asks you to sign in again.'
      : 'Installed. This page reloads in a moment.') : null,
    h('div.row', {},
      inFlight && update.step !== 'install'
        ? h('button.button.plain', { type: 'button', onclick: () => view.cancel() }, update.step === 'verify' ? 'Stop waiting' : 'Cancel')
        : null,
      update.step === 'failed' ? h('button.button.plain', { type: 'button', onclick: () => view.dismiss() }, 'Dismiss') : null));
}

/** Air-gapped, or a version of one's own: a firmware file goes in the same way. */
function fileCard(session, view) {
  const { state } = session;
  const input = h('input', { type: 'file', accept: '.bin,.hex,application/octet-stream', hidden: true, onchange: (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) view.pickFile(f); } });
  const picked = view.file;
  const busy = Boolean(state.update) && !['done', 'failed'].includes(state.update.step);
  return h('div.card', {},
    h('div.card-head', {}, h('span', {}, 'Without the backend'), h('span.v', {}, picked ? picked.name : 'a firmware file')),
    h('div.card-body', {},
      h('p.soft.measure', {}, 'Upload a firmware file you obtained elsewhere. The module verifies its signature either way, and refuses what Encedo did not sign. There is no way back to the version it runs now.'),
      input,
      picked
        ? h('div.row', {},
            h('button.button.exposed', { type: 'button', disabled: busy || null, onclick: () => view.installFile() }, `Install ${picked.name} (${formatBytes(picked.size)})`),
            h('button.button.plain', { type: 'button', onclick: () => view.dropFile() }, 'Leave it'))
        : h('div.row', {}, h('button.button.plain', { type: 'button', disabled: busy || null, onclick: () => input.click() }, 'Choose a file'))));
}
