// Overview: what the module is, how it is doing, what needs a decision.

import { h, pageHead, statusGrid } from '../ui.js';
import { formatBytes, formatUptime } from '../session.js';
import { href, ROUTES } from '../router.js';

export function renderOverview(session) {
  const { state } = session;
  const v = state.version ?? {}, s = state.status ?? {}, health = state.health ?? {};
  const disks = session.disks();
  const exposed = disks.filter((d) => d.state !== 'locked');
  const hostname = state.config?.hostname || s.hostname || session.urls.hem.replace(/^https?:\/\//, '');

  const driveText = disks.length
    ? disks.map((d) => `disk${d.index} ${d.state === 'locked' ? 'locked' : d.state === 'rw' ? 'unlocked, read-write' : 'unlocked, read-only'}`).join(' · ')
    : 'no drive reported';
  const phones = state.phones ? String(state.phones.length) : state.online ? '—' : 'unknown while offline';
  const firmware = health.newfws ? [`${v.fwv}`, h('span.muted', {}, ` · ${health.newfws} available`)] : v.fwv ?? '?';

  const title = exposed.length
    ? (exposed.length === 1 ? 'One drive is on the host.' : 'Both drives are on the host.')
    : 'The module is sealed and reachable.';
  const ledeParts = [];
  if (health.newfws) ledeParts.push(`Firmware ${health.newfws} is available.`);
  if (state.online === false) ledeParts.push('The Encedo backend is unreachable; the module works on its own.');

  const needs = [];
  if (health.newfws) needs.push(['Firmware ' + health.newfws + ' is available', 'Installing reboots the module and locks both drives.', 'Software', href(ROUTES.find((r) => r.id === 'software')), '']);
  for (const d of exposed) needs.push([`disk${d.index} is unlocked ${d.state === 'rw' ? 'read-write' : 'read-only'}`, 'Lock it when the host is done with it.', 'Secure drive', href(ROUTES.find((r) => r.id === 'drive')), 'exposed']);

  return [
    pageHead('Overview', title, ledeParts.join(' ') || null),
    h('div.card', {},
      statusGrid([
        ['Module', `${v.conf ?? v.hwv ?? 'HEM'} · ${hostname}`],
        ['Firmware', firmware],
        ['Backend', state.online ? 'reachable · clock in sync' : state.online === false ? 'unreachable · working offline' : 'not checked', state.online ? '' : 'pending'],
        ['Secure drive', driveText, exposed.length ? 'risk' : ''],
        ['Paired phones', phones, state.phones ? '' : 'pending'],
        ['Uptime', formatUptime(s.uptime) ?? '—'],
      ]),
      h('p.status-note', {}, 'Sealed means inside the module: keys, locked drives, verified logs. Exposed means handed to the host, where anything running there can read it. This page uses no other colours for state.')),
    needs.length ? h('div.card', {},
      h('div.card-head', {}, h('span', {}, 'Needs you'), h('span.v', {}, String(needs.length))),
      h('div', {}, needs.map(([t, d, action, link, kind], i) =>
        h('div.between', { style: `padding: 18px 20px; ${i < needs.length - 1 ? 'border-bottom: 1px solid var(--rule);' : ''}` },
          h('div.stack-s', { style: 'gap: 4px;' }, h('b', { style: 'font-weight: 600;' }, t), h('span.soft', { style: 'font-size: 14px;' }, d)),
          h(`a.button.small${kind ? '.' + kind : ''}`, { href: link }, action))))) : null,
    disks.length ? h('dl', { style: 'display: flex; flex-direction: column; max-width: 860px;' },
      disks.map((d) => h('div.item', {}, h('dt', {}, `disk${d.index}`), h('dd', {}, `${formatBytes(d.bytes)} · ${d.state === 'locked' ? 'sealed' : 'on the host'}`)))) : null,
  ];
}
