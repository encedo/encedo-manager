// The frame every signed-in page is drawn in: the sidebar, the masthead, and
// the modal that covers them both while the module is waiting on a phone.

import { ROUTES, href } from './router.js';
import { h, mark, icon, render } from './ui.js';
import { VERSION, PRODUCT } from './version.js';
import { describeScope } from './session.js';

export function renderShell(root, { session, config, route, content, modal = null }) {
  const { state } = session;
  const v = state.version ?? {};
  const host = session.urls.hem.replace(/^https?:\/\//, '');
  root.className = 'app';
  render(root,
    h('aside.sidebar', {},
      h('div.brand', {}, mark(36), h('div.name', {}, h('b', {}, 'Encedo HEM'), h('span', {}, 'Manager'))),
      h('nav.nav', { 'aria-label': 'Sections' }, ROUTES.map((r) =>
        h(`a${r.id === route.id ? '.active' : ''}`, { href: href(r), 'aria-current': r.id === route.id ? 'page' : null }, icon(r.id), h('span', {}, r.label)))),
      h('div.sidebar-foot', {},
        h('span.host', {}, state.config?.hostname || state.status?.hostname || host),
        h('span', {}, `${host} · ${config.servedFromDevice ? 'served by the module' : 'dev server'}`),
        h('span', {}, `${state.config?.user ?? 'signed in'} · `,
          h('a', { href: '#', onclick: (e) => { e.preventDefault(); session.signOut(); } }, 'Sign out')))),
    h('main.main', {},
      h('div.masthead', {},
        h('span', {}, h('b', {}, PRODUCT), `  ${VERSION}`),
        h('span', {}, [
          `firmware ${v.fwv ?? '?'}`,
          v.conf ?? v.hwv,
          state.online ? 'backend reachable' : state.online === false ? 'air-gapped' : null,
          state.mode === 'phone' ? 'signed in with the phone' : null,
        ].filter(Boolean).join(' · '))),
      content),
    modal);
}

/**
 * What the person sees while their phone is being asked: which operation, how
 * long it has, and a way to give up. It sits over the page, with the page
 * behind it blurred, because nothing else can happen until the phone answers.
 */
export function askingModal(asking) {
  const left = Math.max(0, Math.ceil((asking.until - Date.now()) / 1000));
  return veil('asking-title',
    h('div.card-head', {}, h('span', {}, 'Confirm on your phone'), h('span.v', {}, `${left} s left`)),
    h('div.card-body', {},
      h('div.stack-s', {},
        h('p.eyebrow', {}, 'Waiting for the phone'),
        h('h1', { id: 'asking-title' }, 'Approve this on your phone.'),
        h('p.soft', { style: 'font-size: 15.5px;' },
          'The module wants your approval to ',
          h('b', { style: 'font-weight: 600; color: var(--ink);' }, describeScope(asking.scope)),
          '. The request is on the phones paired with it. Approve it on one of them and this page carries on; decline it there, or cancel here, and nothing happens.')),
      h('div.row', {},
        h('button.button.plain', { type: 'button', autofocus: true, onclick: () => asking.cancel() }, 'Cancel'),
        h('span.mono.muted', { style: 'font-size: 12px;' }, asking.scope))));
}

/** The broker refused to unpair a phone; the key can still go. */
export function anywayModal({ phone, error }, phones) {
  return veil('anyway-title',
    h('div.card-head', {}, h('span', {}, 'The backend said no'), h('span.v', {}, phone.label || phone.pid)),
    h('div.card-body', {},
      h('div.stack-s', {},
        h('p.eyebrow', {}, 'Unpair'),
        h('h1', { id: 'anyway-title' }, 'Do it anyway?'),
        h('p.soft', { style: 'font-size: 15.5px;' }, error),
        h('p.soft', { style: 'font-size: 15.5px;' }, phone.kid
          ? 'The key is what lets the phone answer for you, and the key is in the module. Going on removes it from the keychain and leaves the broker as it is.'
          : 'There is no key in the module for this phone, so there is nothing else to remove.')),
      h('div.row', {},
        h('button.button.exposed', { type: 'button', disabled: !phone.kid || null, onclick: () => phones.unpairAnyway() }, 'Do it anyway'),
        h('button.button.plain', { type: 'button', autofocus: true, onclick: () => phones.keepAfterAll() }, 'Leave it'))));
}

const veil = (labelledBy, ...children) => h('div.veil', {},
  h('div.card.lifted.asking', { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': labelledBy }, ...children));
