// Personalisation: a module out of the box, taken through the steps Manager v1
// took it through — who it belongs to, a password, a name under ence.do, how
// its drives are laid out, what it takes on faith — then the 24 words on paper.

import { h, mark, render, field, select, copyControl, statusGrid } from '../ui.js';
import { VERSION, PRODUCT } from '../version.js';
import { describeError, isPrefix, sectorsToGb, gbToSectors, parseStorage, formatBytes } from '../session.js';
import { progressBody } from './software.js';

const YES_NO = [['1', 'Yes'], ['0', 'No']];

// The three things the module can take on faith, worded as the Settings page words them.
const TRUST = [
  ['trusted_ts', 'Trust Encedo as a time source', 'The module has no clock it can rely on after a long shelf; with this on it takes the time from api.encedo.com at check-in.'],
  ['trusted_backend', 'Allow remote management', 'Lets the backend carry instructions to this module: reporting it stolen, wiping it remotely. Nothing goes through unless you ask.'],
  ['allow_keysearch', 'Answer key searches without a token', 'An application can look a key up by its description before it has authenticated.'],
];

/** What the module is doing, in the order it does it, for the progress list. */
const STEPS = [
  ['words', 'Making the master secret', 'Twenty-four words, made in this browser. They are the key the module trusts above the password.'],
  ['init', 'Personalising the module', 'The configuration goes to the module signed by the master key; the module answers with an instance id.'],
  ['format', 'Formatting the drives', 'The module lays out the regular disk and the secure drive.'],
  ['domain', 'Registering the name', 'The Encedo backend issues a certificate for the name you chose.'],
  ['email', 'Waiting for your e-mail', 'A name of your own is confirmed by a click in your inbox.'],
  ['tls', 'Installing the certificate', 'The module takes the certificate and will answer to the name.'],
];

export function renderPersonalise(root, session, view) {
  const { state } = session;
  root.className = 'app centered';
  const setup = state.setup;
  let card;
  if (setup?.step === 'failed') card = failed(session, view);
  else if (setup?.step === 'done') card = done(session, view);
  else if (setup) card = working(session, view);
  else if (view.step === 'form') card = form(session, view);
  else card = welcome(session, view);
  render(root, h('div.signin.wide', {},
    h('div.brand', {}, mark(40), h('div.masthead', {}, h('span', {}, h('b', {}, PRODUCT), `  ${VERSION}`))),
    card));
}

const head = (session, right) => {
  const v = session.state.version ?? {};
  return h('div.card-head', {}, h('span', {}, session.urls.hem.replace(/^https?:\/\//, '')), h('span.v', {}, right ?? [`firmware ${v.fwv ?? '?'}`, v.conf ?? v.hwv ?? ''].filter(Boolean).join(' · ')));
};

// -- welcome ----------------------------------------------------------------------------

function welcome(session, view) {
  const { state } = session;
  const online = state.online === true;
  return h('div.card.lifted', {},
    head(session),
    h('div.card-body', {},
      h('div.stack-s', {},
        h('p.eyebrow', {}, 'Personalisation'),
        h('h1', {}, 'This module is new.'),
        h('p.soft', { style: 'font-size: 15.5px;' }, 'It has not been personalised yet, so nothing opens it. Personalising takes about a minute and happens once: it makes the module yours, and yours only.')),
      h('div.steps', {},
        step('01', 'Say who it belongs to and choose a password.', ' The password derives a key here; the module never sees it.'),
        step('02', 'Choose a name under ence.do and how the drives are laid out.', online ? ' The backend issues the certificate for the name.' : ' The backend is unreachable, so the module keeps my.ence.do for now.'),
        step('03', 'Put the 24 words on paper.', ' They open the module when everything else is lost. Nobody else has them.')),
      h('div.row', {},
        h('button.button', { type: 'button', disabled: state.update ? true : null, onclick: () => view.start() }, 'Start'),
        h('span.mono.muted', { style: 'font-size: 12px;' }, online ? 'backend reachable' : state.online === false ? 'air-gapped' : ''))),
    firmwareFirst(session, view));
}

/**
 * A module that shipped with old firmware gets current before its first use,
 * as v1 allowed: the upgrade goes in without a token on a module nobody owns
 * yet. Air-gapped, from a file; with the backend, whatever it announced.
 */
function firmwareFirst(session, view) {
  const { state } = session;
  const sw = view.software;
  const newer = state.health?.newfws || null;
  const update = state.update;
  const input = h('input', { type: 'file', accept: '.bin,.hex,application/octet-stream', hidden: true, onchange: (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) sw.pickFile(f); } });
  return h('div.card-body', { style: 'border-top: 1px solid var(--rule);' },
    h('div.stack-s', {},
      h('h2', {}, 'Firmware first?'),
      h('p.soft.measure', {}, `The module runs ${state.version?.fwv ?? 'unknown firmware'}. ${newer ? `The backend has ${newer}.` : 'A newer firmware can go in before it is personalised, from a file, or from the backend once it is reachable.'}`)),
    update ? progressBody(update, sw) : [
      sw.error ? h('p.error', { role: 'alert' }, sw.error) : null,
      sw.notice ? h('p.notice', { role: 'status' }, sw.notice) : null,
      input,
      h('div.row', {},
        newer ? h('button.button.plain', { type: 'button', onclick: () => sw.install('firmware', newer) }, `Install ${newer}`) : null,
        sw.file
          ? [h('button.button.exposed', { type: 'button', onclick: () => sw.installFile() }, `Install ${sw.file.name} (${formatBytes(sw.file.size)})`),
             h('button.button.plain', { type: 'button', onclick: () => sw.dropFile() }, 'Leave it')]
          : h('button.button.plain', { type: 'button', onclick: () => input.click() }, 'Firmware from a file'))]);
}

const step = (n, lead, rest) => h('div.step', {}, h('span.step-n', {}, n), h('p', {}, h('b', {}, lead), rest));

// -- the form -----------------------------------------------------------------------------

function form(session, view) {
  const { state } = session;
  const f = view.form;
  const online = state.online === true;
  const ppa = state.model !== 'epa';
  const disks = parseStorage(state.status);
  const totalSectors = disks.reduce((sum, d) => sum + d.bytes / 512, 0);
  const totalGb = sectorsToGb(totalSectors);

  const user = h('input', { type: 'text', value: f.user, autocomplete: 'nickname', required: true, oninput: (e) => { f.user = e.target.value; } });
  const email = h('input', { type: 'email', value: f.email, autocomplete: 'email', oninput: (e) => { f.email = e.target.value; } });
  const pw = h('input', { type: 'password', value: f.password, autocomplete: 'new-password', required: true, oninput: (e) => { f.password = e.target.value; } });
  const pw2 = h('input', { type: 'password', value: f.password2, autocomplete: 'new-password', required: true, oninput: (e) => { f.password2 = e.target.value; } });
  const ip = h('input', { type: 'text', value: f.ip, inputmode: 'decimal', oninput: (e) => { f.ip = e.target.value; } });

  // The name: one the broker hands out, or one of the owner's own.
  const names = [...view.predefs.map((p) => [p, `${p}.ence.do`]), ['custom', 'A name of my own…']];
  const prefix = select(names, f.prefix, { onchange: (e) => { f.prefix = e.target.value; view.domainCheck = null; view.repaint(); } });
  const custom = h('input', { type: 'text', value: f.customPrefix, placeholder: 'e.g. ann-desk', autocapitalize: 'off', spellcheck: 'false', oninput: (e) => { f.customPrefix = e.target.value.trim().toLowerCase(); view.domainCheck = null; } });

  const disk0 = h('input', { type: 'number', min: '1', max: String(Math.max(1, totalGb - 1)), step: '1', value: String(f.disk0Gb), oninput: (e) => { f.disk0Gb = Number(e.target.value); } });
  const show = select(YES_NO, f.show ? '1' : '0', { onchange: (e) => { f.show = e.target.value === '1'; } });
  const rw = select([['0', 'Read-only'], ['1', 'Writable']], f.rw ? '1' : '0', { onchange: (e) => { f.rw = e.target.value === '1'; } });
  const xts = select([['0', 'CTR'], ['1', 'XTS']], f.xts ? '1' : '0', { onchange: (e) => { f.xts = e.target.value === '1'; } });
  const trust = TRUST.map(([key, label, hint]) => field(label, select(YES_NO, f[key] ? '1' : '0', { onchange: (e) => { f[key] = e.target.value === '1'; } }), hint));

  const submit = (ev) => { ev.preventDefault(); view.submit(); };

  return h('form.card.lifted', { onsubmit: submit, novalidate: true },
    head(session, 'step 1 of 2'),
    h('div.card-body', {},
      h('div.stack-s', {},
        h('p.eyebrow', {}, 'Personalisation'),
        h('h1', {}, 'Make it yours.'),
        h('p.soft', { style: 'font-size: 15.5px;' }, 'Everything below is stored on the module and can be changed later in Settings — except the drive layout, which is set once.')),
      view.error ? h('p.error', { role: 'alert' }, view.error) : null,

      section('Who it belongs to',
        h('div.form-grid', {},
          field('Your name', user, 'What the module calls you, and what a phone sees when it is asked.'),
          field('E-mail', email, online ? 'Optional. Needed to confirm a name of your own, and for the backend to reach you about this module.' : 'Optional.'))),

      section('Password',
        h('div.form-grid', {},
          field('Password', pw, 'Derives the everyday key in this browser. The module sees a signed challenge, never the password.'),
          field('Again', pw2))),

      section('Name under ence.do',
        online
          ? h('div.form-grid', {},
              field('Name', prefix, 'The module answers to this name on its USB network; the backend issues the certificate.'),
              f.prefix === 'custom'
                ? h('div.field', {},
                    h('label', { for: custom.id || (custom.id = 'f-custom') }, 'Your own name'),
                    h('div.row', {}, custom, h('button.button.small.plain', { type: 'button', disabled: view.busy === 'domain' || null, onclick: () => view.checkPrefix() }, view.busy === 'domain' ? 'Asking…' : 'Is it free?')),
                    h('div.field-foot', {}, h('span.hint', {}, view.domainCheck ?? 'Lower-case letters, digits and dashes. Confirmed by a link sent to your e-mail.')))
                : null)
          : h('p.soft', {}, 'The Encedo backend is unreachable, so the module keeps ', h('b', { style: 'font-weight: 600;' }, 'my.ence.do'), ' and no certificate is issued now. Both can be done later from Settings.')),

      ppa ? section('Network', h('div.form-grid', {}, field('Address on the USB network', ip, 'The module’s own address. Change it only if it collides with a network of yours.'))) : null,

      ppa ? section('Drives',
        h('div.form-grid', {},
          field('Regular disk', disk0, `In gigabytes, out of ${totalGb ? `${totalGb} GB` : formatBytes(totalSectors * 512)} in the module. The rest is the secure drive.`),
          field('Show the regular disk when plugged in', show, 'With it hidden, the host sees nothing until the module is unlocked.'),
          field('The regular disk is', rw, 'A writable disk can carry files out; a read-only one can only be read.'),
          field('Secure drive cipher', xts, 'XTS is the disk standard; CTR is what earlier modules used.'))) : null,

      section('What it takes on faith', h('div.form-grid', {}, trust)),

      h('div.row', {},
        h('button.button', { type: 'submit', disabled: view.busy || null }, 'Personalise the module'),
        h('button.button.plain', { type: 'button', onclick: () => view.back() }, 'Back'))));
}

const section = (title, body) => h('div.stack-s', { style: 'padding-top: 6px; border-top: 1px solid var(--rule);' }, h('h2', {}, title), body);

// -- working ----------------------------------------------------------------------------

function working(session, view) {
  const setup = session.state.setup;
  const online = session.state.online === true;
  const custom = Boolean(setup.fields?.custom) && online;
  const order = STEPS.filter(([id]) => (online || (id !== 'domain' && id !== 'tls' && id !== 'email')) && (custom || id !== 'email') && (session.state.model !== 'epa' || id !== 'format'));
  const current = order.findIndex(([id]) => id === setup.step);
  return h('div.card.lifted', {},
    head(session, 'step 2 of 2'),
    h('div.card-body', {},
      h('div.stack-s', {},
        h('p.eyebrow', {}, 'Personalisation'),
        h('h1', {}, 'Working.'),
        h('p.soft', { style: 'font-size: 15.5px;' }, 'Leave the module plugged in. This takes about a minute.')),
      h('div.steps', {}, order.map(([id, lead, rest], i) => {
        const state = i < current ? 'done' : i === current ? 'now' : 'later';
        let detail = rest;
        if (id === 'email' && state === 'now') detail = setup.status === 'email_confirmed' ? ' Confirmed. The certificate is on its way.' : ' Check your inbox and click the link in the e-mail from Encedo.';
        return h('div.step', { 'data-state': state },
          h('span.step-n', {}, state === 'done' ? '✓' : state === 'now' ? '●' : '○'),
          h('p', { style: state === 'later' ? 'color: var(--muted);' : '' }, h('b', {}, lead + (state === 'now' ? '…' : '')), state === 'later' ? '' : ' ' + detail.trim()));
      }))));
}

// -- done -------------------------------------------------------------------------------

function done(session, view) {
  const { state } = session;
  const r = state.setup.result;
  const words = h('p.blob', { style: 'font-size: 15px; line-height: 1.8;' }, r.words);
  return h('div.card.lifted', {},
    head(session, 'personalised'),
    h('div.card-body', {},
      h('div.stack-s', {},
        h('p.eyebrow', {}, 'Personalisation'),
        h('h1', {}, 'The module is yours.'),
        h('p.soft', { style: 'font-size: 15.5px;' }, 'Before you go on, put the 24 words on paper. They are the only way back in when the password is lost and no phone is paired. Nobody has them but you: not this browser after you leave, not Encedo.')),
      view.error ? h('p.error', { role: 'alert' }, view.error) : null,
      statusGrid([
        ['Hostname', r.hostname],
        ['Instance ID', r.instanceid ?? '—'],
        ['Owner', state.setup.fields.user],
        ['Certificate', r.tls ? 'installed' : 'not yet — fetch it later from Settings', r.tls ? '' : 'pending'],
      ]),
      h('div.stack-s', {},
        h('div.field-head', {}, h('span.name', {}, 'Master passphrase · 24 words'), copyControl(r.words)),
        words),
      h('div.stack-s', {},
        h('h2', {}, 'Proof of Personalisation'),
        h('p.soft.measure', {}, 'A one-page document with the words, the ids the module answers with, and what was set. Made in this browser; print it and keep it with your papers.'),
        h('div.row', {},
          h('button.button', { type: 'button', onclick: () => view.print() }, 'Print it'),
          h('button.button.plain', { type: 'button', onclick: () => view.download() }, 'Download the PDF'),
          view.printed ? h('span.mono.muted', { style: 'font-size: 12px;' }, 'on its way to paper') : null)),
      h('div.row', { style: 'border-top: 1px solid var(--rule); padding-top: 18px;' },
        h('button.button', { type: 'button', disabled: !view.printed || view.busy === 'finish' || null, onclick: () => view.finish() },
          view.busy === 'finish' ? 'One moment…' : r.rebootRequired ? `Reboot and open ${r.hostname}` : 'Continue to sign-in'),
        view.printed ? null : h('span.soft', { style: 'font-size: 14px;' }, 'Print or download the proof first.'))));
}

// -- failed -----------------------------------------------------------------------------

function failed(session, view) {
  const setup = session.state.setup;
  const rolled = !setup.result?.token;
  return h('div.card.lifted', {},
    head(session, 'not personalised'),
    h('div.card-body', {},
      h('div.stack-s', {},
        h('p.eyebrow', {}, 'Personalisation'),
        h('h1', {}, 'That did not go through.'),
        h('p.soft', { style: 'font-size: 15.5px;' }, describeError(setup.error)),
        h('p.soft', {}, rolled
          ? 'Nothing was written to the module. Try again, or check the module and the network first.'
          : 'The module was partly set up. Starting again wipes it back to how it came out of the box, then shows the form once more.')),
      h('div.row', {},
        h('button.button', { type: 'button', disabled: view.busy === 'rollback' || null, onclick: () => view.retry() }, view.busy === 'rollback' ? 'Wiping…' : 'Start again'))));
}
