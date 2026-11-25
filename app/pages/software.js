// Software: what the module runs, what is newer, and the way an update goes
// in — download, upload, the module's own check, install. Firmware comes from
// the backend and reboots the module; the Manager comes from its release site
// (DEV-534) and reloads this page. Air-gapped, a firmware file obtained
// elsewhere goes in the same way; the module checks the signature either way.

import { h, pageHead, statusGrid } from '../ui.js';
import { formatBytes, formatDate, versionNumber } from '../session.js';
import { VERSION } from '../version.js';

const STEPS = {
  firmware: [
    ['download', 'Download', ' from the backend.'],
    ['upload', 'Upload to the module', ' over the USB network.'],
    ['verify', 'Verify', ' the image on the module — its signature, by the module itself.'],
    ['install', 'Install and reboot.', ' Both drives lock. The module is away for about 40 seconds.'],
  ],
  manager: [
    ['download', 'Download', ' from the release site, checked against its digest and the publisher key.'],
    ['upload', 'Upload to the module', ' over the USB network.'],
    ['verify', 'Verify', ' the bundle on the module.'],
    ['install', 'Install and reload.', ' The module keeps running; this page comes back in the new version.'],
  ],
};

export function renderSoftware(session, view) {
  const { state } = session;
  const health = state.health ?? {};
  const version = state.version ?? {};
  const offer = session.managerOffer();   // DEV-534
  const newer = { firmware: health.newfws || null, manager: offer.state === 'offer' ? offer.latest.version : null };

  const title = newer.firmware && newer.manager ? `Firmware ${versionNumber(newer.firmware)} and Manager ${newer.manager} are ready to install.`
    : newer.firmware ? `Firmware ${versionNumber(newer.firmware)} is ready to install.`
    : newer.manager ? `Manager ${newer.manager} is ready to install.`
    : state.online === false ? 'The backend is unreachable, so the firmware was not checked.'
    : 'Everything is up to date.';

  return [
    pageHead('Software', title, 'Firmware comes from the Encedo backend when the module checks in, signed for this module; the Manager comes from its release site. Installing firmware reboots the module and locks both drives; installing the Manager reloads this page.'),
    view.error ? h('p.error', { role: 'alert' }, view.error) : null,
    view.notice ? h('p.notice', { role: 'status' }, view.notice) : null,
    versionsCard(session, view, newer, offer),
    updateCard(session, view, 'firmware', newer.firmware, version.fwv),
    managerCard(session, view, offer),
    fileCard(session, view),
  ];
}

function versionsCard(session, view, newer, offer) {
  const { state } = session;
  const v = state.version ?? {};
  const when = state.checkedInAt ? new Date(state.checkedInAt).toISOString().slice(0, 19).replace('T', ' ') : null;
  return h('div.card', {},
    statusGrid([
      ['Firmware installed', v.fwv ?? '—'],
      ['Firmware available', newer.firmware ? versionNumber(newer.firmware) : state.online ? 'none newer' : '—', newer.firmware ? '' : 'pending'],
      ['Bootloader', v.blv ?? '—'],
      ['Manager installed', VERSION],
      ['Manager available', newer.manager ?? (offer.state === 'reload' ? `${offer.latest.version}, installed` : offer.state === 'current' ? 'none newer' : '—'), newer.manager ? '' : 'pending'],
      ['Last check-in', when ?? (state.online === false ? 'the backend did not answer' : 'not yet')],
    ]),
    h('div.card-body', { style: 'border-top: 1px solid var(--rule);' },
      h('div.row', {},
        h('button.button.small.plain', { type: 'button', disabled: view.busy === 'checkin' || null, onclick: () => view.checkIn() }, view.busy === 'checkin' ? 'Asking…' : 'Check again'),
        h('span.soft', { style: 'font-size: 14px;' }, 'The module asks the backend what is newer than what it runs, and sets its clock while it is at it.'))));
}

/**
 * The Manager (DEV-534): offered from the release site, and only by the
 * Manager a PPA serves itself. What the backend says (newuis) is a second
 * opinion, shown and never installed.
 */
function managerCard(session, view, offer) {
  const { state } = session;
  const update = state.update?.kind === 'manager' ? state.update : null;
  const latest = offer.latest;
  const head = (v) => h('div.card-head', {}, h('span', {}, 'Manager'), h('span.v', {}, v));
  if (update) return h('div.card', {}, head(stepLabel(update)), progressBody(update, view));

  const busyElsewhere = Boolean(state.update) && !['done', 'failed'].includes(state.update.step);
  const backendNote = offer.backend === 'other'
    ? h('p.soft.measure', {}, 'The backend names a different build of the Manager than the release site does. Only what the release site publishes is installed from here.')
    : offer.backend === 'newer'
      ? h('p.soft.measure', {}, 'The backend says a newer Manager exists. It can be installed once the release site answers.')
      : null;
  const notes = latest?.release ? h('a', { href: latest.release, target: '_blank', rel: 'noopener noreferrer' }, `What is new in ${latest.version}`) : null;

  switch (offer.state) {
    case 'offer':
      return h('div.card', {}, head(`${latest.version} available`),
        h('div.card-body', {},
          h('p.soft.measure', {}, `This page is Manager ${VERSION}; ${latest.version} was released ${formatDate(latest.published)}. It comes from the release site and is checked against its digest and the publisher key before it goes to the module, which checks the signature itself. The module keeps running while it is installed, and this page reloads into the new version.`),
          backendNote,
          h('div.row', {},
            h('button.button', { type: 'button', disabled: busyElsewhere || null, onclick: () => view.install('manager', latest) }, `Install Manager ${latest.version}`),
            notes)));
    case 'reload':
      return h('div.card', {}, head(`${latest.version} installed`),
        h('div.card-body', {},
          h('p.soft.measure', {}, `The module already serves Manager ${latest.version}; this page is ${VERSION}, loaded before it was installed.`),
          h('div.row', {}, h('button.button', { type: 'button', onclick: () => view.reload() }, 'Reload this page'))));
    case 'current':
      return h('div.card', {}, head('up to date'),
        h('div.card-body', {}, h('p.soft', {}, 'This is the latest Manager on the release site.'), backendNote));
    case 'unreachable':
      return h('div.card', {}, head('not checked'),
        h('div.card-body', {}, h('p.soft.measure', {}, 'The release site did not answer, so the Manager was not checked. Nothing else on this page needs it.'), backendNote));
    default:
      return h('div.card', {}, head('not from here'),
        h('div.card-body', {}, h('p.soft.measure', {}, state.model === 'epa'
          ? 'An EPA keeps no Manager of its own. This page is updated where it is hosted.'
          : state.playground
            ? 'A playground module runs the playground\'s Manager. It is updated there.'
            : 'This page was not served by the module, so it is updated where it is hosted. Open the Manager from the module itself to update the one it serves.')));
  }
}

/** The firmware: the offer, or the update in flight. */
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
            h('p.soft.measure', {}, `The module runs ${versionNumber(installed)}; the backend has ${versionNumber(available)}, signed for this module. Installing reboots it: sessions end, both drives lock, and it is unreachable for about 40 seconds. Nothing in the keychain changes.`),
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
  const steps = STEPS[update.kind].filter(([id]) => update.source !== 'file' || id !== 'download');
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
