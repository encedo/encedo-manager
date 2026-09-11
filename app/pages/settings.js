// Settings: who the module belongs to, what it trusts, what opens it, and the
// two things that cannot be undone.

import { h, pageHead, field, select, statusGrid, copyControl } from '../ui.js';

// Each of these is a choice about what the module takes on faith. The sentence
// under it says what saying yes costs, because that is the whole question.
const TRUST = [
  ['trusted_ts', 'Trust Encedo as a time source',
    'The module has no battery-backed clock it can rely on after a long shelf. With this on, it takes the time from api.encedo.com at check-in — which is one more thing you are trusting. With it off, the time comes from you.'],
  ['trusted_backend', 'Allow remote management',
    'Lets the backend carry instructions to this module: reporting it stolen, wiping it remotely. Nothing goes through it unless you ask for it, and with this off the module answers only to whoever is holding it.'],
  ['allow_keysearch', 'Answer key searches without a token',
    'An application can look a key up by its description before it has authenticated. It makes integrations simpler and it tells anyone who can reach the module what it holds.'],
];

export function renderSettings(session, view) {
  const config = session.state.config;
  if (!config) {
    return [
      pageHead('Settings', 'Reading the configuration.', null),
      h('div.card', {}, h('div.card-body', {}, h('p.soft', {}, 'Asking the module how it is set up.'))),
    ];
  }
  return [
    pageHead('Settings', title(session), 'What this module is called, who it belongs to, what it takes on faith, and what opens it. Everything here is stored on the module itself.'),
    view.error ? h('p.error', { role: 'alert' }, view.error) : null,
    view.notice ? h('p.notice', { role: 'status' }, view.notice) : null,
    ownerCard(config, view),
    trustCard(config, view),
    passwordCard(view),
    masterCard(session, view),
    nameCard(session, config, view),
    wipeCard(view),
  ];
}

function title(session) {
  const config = session.state.config ?? {};
  const owner = config.user ? `${config.user}’s module` : 'This module';
  return session.state.master ? `${owner}, unlocked with the master passphrase.` : `${owner}, as it is set up now.`;
}

// -- who it belongs to ------------------------------------------------------------------

function ownerCard(config, view) {
  const user = h('input', { type: 'text', maxlength: 64, value: config.user ?? '' });
  const email = h('input', { type: 'email', maxlength: 128, value: config.email ?? '' });
  const origin = h('input.mono', { type: 'text', maxlength: 128, value: config.origin ?? '', spellcheck: 'false' });
  const busy = view.busy === 'owner';

  return h('form.card', { onsubmit: (e) => { e.preventDefault(); view.save('owner', { user: user.value.trim(), email: email.value.trim(), origin: origin.value.trim() }); } },
    h('div.card-head', {}, h('span', {}, 'Who it belongs to'), h('span.v', {}, 'stored on the module')),
    h('div.card-body', {},
      h('div.form-grid', {},
        field('Nickname', user, 'Shown on this page and on the paired phone.'),
        field('E-mail address', email, 'Where a share code says it came from.'),
        h('div', { style: 'grid-column: 1 / -1;' },
          field('Origin', origin, 'Which web origins the module answers to (CORS). “*” answers everyone that can reach it.'))),
      h('div.row', {}, h('button.button', { type: 'submit', disabled: busy || null }, busy ? 'Saving…' : 'Save'))));
}

// -- what it takes on faith -------------------------------------------------------------

function trustCard(config, view) {
  const controls = TRUST.map(([key, label, why]) => {
    const control = select([[1, 'Yes'], [0, 'No']], config[key] ? 1 : 0);
    return { key, label, why, control };
  });
  const busy = view.busy === 'trust';

  return h('form.card', {
    onsubmit: (e) => {
      e.preventDefault();
      view.save('trust', Object.fromEntries(controls.map((c) => [c.key, c.control.value === '1'])));
    },
  },
    h('div.card-head', {}, h('span', {}, 'What it takes on faith'), h('span.v', {}, `${controls.filter((c) => c.control.value === '1').length} of ${controls.length} on`)),
    h('div.card-body', {},
      h('dl.items-wide', { style: 'display: flex; flex-direction: column;' },
        controls.map(({ label, why, control }) => h('div.item', {},
          h('dt', {}, label, h('div', { style: 'margin-top: 10px; max-width: 160px;' }, control)),
          h('dd', {}, why)))),
      h('div.row', {}, h('button.button', { type: 'submit', disabled: busy || null }, busy ? 'Saving…' : 'Save'))));
}

// -- what opens it ----------------------------------------------------------------------

function passwordCard(view) {
  const next = h('input', { type: 'password', autocomplete: 'new-password', required: true });
  const again = h('input', { type: 'password', autocomplete: 'new-password', required: true });
  const busy = view.busy === 'password';

  return h('form.card', {
    onsubmit: (e) => {
      e.preventDefault();
      view.changePassword(next.value, again.value);
    },
  },
    h('div.card-head', {}, h('span', {}, 'Password'), h('span.v', {}, 'the everyday one')),
    h('div.card-body', {},
      h('p.soft.measure', {}, 'The password never leaves this page: what the module receives is the key the password derives to, and a proof that whoever sent it can use that key. Changing it ends this session — sign in again with the new one. The 24 words are not touched and still open the module if this is forgotten.'),
      h('div.form-grid', {}, field('New password', next), field('Type it again', again)),
      h('div.row', {}, h('button.button', { type: 'submit', disabled: busy || null }, busy ? 'Changing…' : 'Change the password'))));
}

function masterCard(session, view) {
  const words = h('textarea', { placeholder: 'the twenty-four words, separated by spaces', spellcheck: 'false', autocomplete: 'off' });
  const busy = view.busy === 'master';
  if (session.state.master) {
    return h('div.card', {},
      h('div.card-head', {}, h('span', {}, 'Master passphrase'), h('span.v', {}, 'in use')),
      h('div.card-body', {}, h('p.soft.measure', {}, 'Settings on this page are being authorised with the master secret, not the password. That lasts until this token expires or you sign out.')));
  }
  return h('form.card', { onsubmit: (e) => { e.preventDefault(); view.useMaster(words.value); } },
    h('div.card-head', {}, h('span', {}, 'Master passphrase'), h('span.v', {}, '24 words')),
    h('div.card-body', {},
      h('p.soft.measure', {}, 'The words are the master secret itself, not a hint to it: the module was personalised from them and they open it when the password will not. Type them here to authorise what follows with the master key instead. They are checked in this page before anything is sent — a mistyped word is named rather than refused.'),
      field('The words', words),
      h('div.row', {}, h('button.button.plain', { type: 'submit', disabled: busy || null }, busy ? 'Checking…' : 'Unlock the settings with them'))));
}

// -- what it is called ------------------------------------------------------------------

function nameCard(session, config, view) {
  const prefix = h('input.mono', { type: 'text', maxlength: 32, placeholder: 'my', spellcheck: 'false' });
  const online = session.state.online;
  const busy = view.busy === 'domain';

  return h('form.card', { onsubmit: (e) => { e.preventDefault(); view.registerDomain(prefix.value.trim()); } },
    h('div.card-head', {}, h('span', {}, 'What it is called on the network'), h('span.v.mono', {}, config.hostname ?? '—')),
    h('div', {},
      statusGrid([
        ['Hostname', config.hostname ?? '—'],
        ['Device id', config.devid ?? '—'],
        ['Module id', h('span.mono', { style: 'font-size: 12.5px; word-break: break-all;' }, config.eid ?? '—')],
      ]),
      h('div.card-body', { style: 'border-top: 1px solid var(--rule);' },
        h('p.soft.measure', {}, 'A name under ence.do comes with a certificate for it, so a browser reaches the module over https without a warning. Registering asks the backend to sign the module’s own certificate request against its attestation; the module then installs what comes back.'),
        h('div.form-grid', {},
          field('Name', prefix, online ? 'It becomes name.ence.do.' : 'The backend is unreachable, so nothing can be registered right now.'),
          h('div', {}, view.domainCheck ? h('p.note', {}, view.domainCheck) : null)),
        h('div.row', {},
          h('button.button.plain', { type: 'button', disabled: !online || busy || null, onclick: () => view.checkDomain(prefix.value.trim()) }, 'Is it free?'),
          h('button.button', { type: 'submit', disabled: !online || busy || null }, busy ? 'Registering…' : 'Register it')))));
}

// -- the one that cannot be undone ------------------------------------------------------

function wipeCard(view) {
  const typed = h('input.mono', { type: 'text', placeholder: 'WIPE', spellcheck: 'false' });
  const busy = view.busy === 'wipe';
  return h('div.card', {},
    h('div.card-head', {}, h('span', {}, 'Wipe the module'), h('span.v', {}, 'there is no undoing this')),
    h('div.card-body', {},
      h('p.soft.measure', {}, 'Every key the module generated goes, and no copy of a private half exists anywhere else. Both drives go with them, and so does everything on this page. What is left is a module as it came from the factory, waiting to be personalised — with new words, because the old ones open nothing any more.'),
      view.confirmWipe
        ? [h('div.form-grid', {}, field('Type WIPE to be sure', typed)),
           h('div.row', {},
             h('button.button.exposed', { type: 'button', disabled: busy || null, onclick: () => view.wipe(typed.value) }, busy ? 'Wiping…' : 'Wipe it'),
             h('button.button.plain', { type: 'button', onclick: () => view.cancelWipe() }, 'Keep everything'))]
        : h('div.row', {}, h('button.button.exposed', { type: 'button', onclick: () => view.askWipe() }, 'Wipe the module'))));
}

export { TRUST };
