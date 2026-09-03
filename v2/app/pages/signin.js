// Sign-in: waiting for the module, the password form, the phone request.

import { h, mark, render } from '../ui.js';
import { describeError } from '../session.js';

export function renderSignIn(root, session, view) {
  const { state } = session;
  root.className = 'app centered';
  const card = state.phase === 'probing' ? waiting(session, view) : form(session, view);
  render(root, h('div.signin', {},
    h('div.brand', {}, mark(40), h('div.masthead', {}, h('span', {}, h('b', {}, 'Encedo HEM Manager'), '  2.0.0-dev'))),
    card));
}

function head(left, right) {
  return h('div.card-head', {}, h('span', {}, left), h('span.v', {}, right));
}

function waiting(session, view) {
  const { state } = session;
  return h('div.card.lifted', {},
    head(session.urls.hem.replace(/^https?:\/\//, ''), 'no answer yet'),
    h('div.card-body', {},
      h('div.stack-s', {},
        h('p.eyebrow', {}, 'Waiting'),
        h('h1', {}, 'Looking for the module.'),
        h('p.soft', {}, 'The Manager asks the module for its version every two seconds. Plug the PPA in, or check that this browser is on its network.')),
      h('div.row', {}, h('button.button.plain', { type: 'button', onclick: () => view.changeAddress() }, 'Change address')),
      h('p.note', {}, `${session.urls.hem} · attempt ${state.attempts}${state.lastError ? ' · ' + describeError(state.lastError) : ''}`)));
}

function form(session, view) {
  const { state } = session;
  const v = state.version ?? {};
  const local = view.local;   // { busy, error, phone: { pending, cancel, secondsLeft } }
  const pw = h('input', { id: 'password', type: 'password', autocomplete: 'current-password', required: true, disabled: local.busy || null });

  const submit = (ev) => { ev.preventDefault(); view.signIn(pw.value); };

  const phoneRow = local.phone
    ? h('div.row', {},
        h('button.button.plain', { type: 'button', onclick: () => view.cancelPhone() }, 'Use password instead'),
        h('span.mono.muted', { style: 'font-size: 12px;' }, 'Confirm on your phone'))
    : h('div.row', {},
        h('button.button', { type: 'submit', disabled: local.busy || null }, local.busy ? 'Unlocking…' : 'Unlock'),
        state.paired ? h('button.button.plain', { type: 'button', disabled: local.busy || null, onclick: () => view.signInWithPhone() }, 'Ask my phone instead') : null);

  const lines = [];
  if (state.online === false) lines.push('Encedo backend unreachable · phone sign-in, pairing and downloads are off until it answers');
  else if (state.online) lines.push(`${state.paired ? 'a phone is paired' : 'no phone paired'} · broker reachable · clock in sync`);
  lines.push('Forgotten the password? The master passphrase from your Proof of Personalization also unlocks the module.');

  return h('form.card.lifted', { onsubmit: submit },
    head(session.urls.hem.replace(/^https?:\/\//, ''), [`firmware ${v.fwv ?? '?'}`, v.conf ?? v.hwv ?? ''].filter(Boolean).join(' · ')),
    h('div.card-body', {},
      h('div.stack-s', {},
        h('p.eyebrow', {}, state.online === false ? 'Air-gapped' : 'The module answered'),
        h('h1', {}, local.phone ? 'Confirm on your phone.' : 'Unlock the Manager.'),
        h('p.soft', { style: 'font-size: 15.5px;' }, local.phone
          ? 'A request went to the phones paired with this module. Approving it on one of them signs you in here.'
          : 'Your password never leaves this browser. It derives a key here; the module only sees a signed challenge.')),
      local.phone ? null : h('div.field', {},
        h('input', { type: 'text', name: 'username', autocomplete: 'username', value: 'user', hidden: true, 'aria-hidden': 'true', tabindex: '-1' }),
        h('label', { for: 'password' }, 'Password'), pw),
      local.error ? h('p.error', { role: 'alert' }, local.error) : null,
      phoneRow,
      h('div.card-foot', {}, lines.map((l) => h('span.note', {}, l)))));
}
