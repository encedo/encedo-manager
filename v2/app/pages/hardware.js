// Hardware: what the module says about itself, what signed the software it
// runs, and how it answers its own tests.

import { h, pageHead, statusGrid, svg, copyControl } from '../ui.js';
import { formatUptime, formatDate } from '../session.js';

// The version fields a module reports. Everything else it sends is shown too,
// under its own name — a firmware that starts reporting something new should
// not have it swallowed because this list has not caught up.
const VERSION_LABELS = {
  hwv: 'Model', fwv: 'Firmware', blv: 'Bootloader', conf: 'Configuration', fws: null, fwk: null,
  bls: null, blk: null, uis: null,
};
const SIGNATURES = [
  ['fwk', 'Firmware signing key'],
  ['fws', 'Firmware signature'],
  ['blk', 'Bootloader signing key'],
  ['bls', 'Bootloader signature'],
  ['uis', 'Manager signature'],
];
// Status fields this page already puts somewhere of its own.
const STATUS_KNOWN = new Set(['hostname', 'uptime', 'ts', 'time', 'temp', 'fls_state', 'storage', 'https']);

/** The self-test's counters, in the order a person would read them. */
const HEALTH = [
  ['se_state', 'Self-test'],
  ['fls_state', 'Fail state'],
  ['selftest_ts', 'This test ran'],
  ['last_selftest_ts', 'The one before it'],
  ['last_fls_state', 'Fail state then'],
  ['kat_busy', 'Known-answer test'],
  ['last_kat_ts', 'Last known-answer test'],
  ['last_entropytest_ts', 'Last entropy test'],
];

export function renderHardware(session, view) {
  const { state } = session;
  const version = state.version ?? {};
  const status = state.status ?? {};
  const failing = Number(status.fls_state ?? 0) !== 0;
  // A real module answers /status without a hostname; that lives in the config.
  const hostname = state.config?.hostname || status.hostname || session.urls.hem.replace(/^https?:\/\//, '');

  return [
    pageHead('Hardware', failing ? 'The module is in a fail state.' : 'The module reports nothing wrong.',
      'What the module says about itself: what it is, what signed the software it runs, and how it answers when asked to test itself.'),
    view.error ? h('p.error', { role: 'alert' }, view.error) : null,
    view.notice ? h('p.notice', { role: 'status' }, view.notice) : null,
    moduleCard(version, status, failing, hostname),
    temperatureCard(view, status),
    signaturesCard(version),
    healthCard(session, view),
    tokensCard(session, view),
    rebootCard(view),
  ];
}

function moduleCard(version, status, failing, hostname) {
  const clock = status.ts ? String(status.ts).replace('T', ' ').replace('Z', '') : status.time ? formatDate(status.time) : null;
  // Anything the module reports that this page has no name for is still shown,
  // under the module's own name for it — `ctx`, on the firmware seen so far.
  const extra = [
    ...Object.entries(version).filter(([key]) => !(key in VERSION_LABELS)),
    ...Object.entries(status).filter(([key]) => !STATUS_KNOWN.has(key)),
  ];

  return h('div.card', {},
    statusGrid([
      ['Model', version.hwv ?? '—'],
      ['Firmware', version.fwv ?? '—'],
      ['Bootloader', version.blv ?? '—'],
      // Only some firmware reports a configuration name; an empty box saying
      // nothing is worse than one row fewer.
      ...(version.conf ? [['Configuration', version.conf]] : []),
      ['Hostname', hostname],
      ['Uptime', formatUptime(status.uptime) ?? '—'],
      ['Clock', clock ?? '—'],
      ['Temperature', status.temp === undefined ? '—' : `${status.temp} °C`],
      ['Fail state', failing ? `reported: ${status.fls_state}` : 'clear', failing ? 'risk' : ''],
    ]),
    extra.length
      ? h('div.card-body', { style: 'border-top: 1px solid var(--rule);' },
          h('h2', {}, 'Also reported'),
          h('dl', { style: 'display: flex; flex-direction: column;' },
            extra.map(([key, value]) => h('div.item', {},
              h('dt', {}, key),
              h('dd.mono', { style: 'font-size: 13px; word-break: break-all;' }, String(value))))))
      : null);
}

/** Temperature while the page is open: the module is asked every ten seconds. */
function temperatureCard(view, status) {
  if (status.temp === undefined) return null;
  const samples = view.temps;
  const span = samples.length > 1 ? Math.round((samples.at(-1).at - samples[0].at) / 60000) : 0;
  return h('div.card', {},
    h('div.card-head', {},
      h('span', {}, 'Temperature'),
      h('span.v', {}, samples.length > 1 ? `${span} min · ${Math.min(...samples.map((s) => s.temp))}–${Math.max(...samples.map((s) => s.temp))} °C` : 'watching')),
    h('div.card-body', {},
      sparkline(samples),
      h('p.soft', {}, `Now ${status.temp} °C. The module is asked every ten seconds while this page is open, and nothing is kept once you leave it.`)));
}

function sparkline(samples, width = 720, height = 64) {
  if (samples.length < 2) return h('p.note', {}, 'Collecting readings…');
  const temps = samples.map((s) => s.temp);
  const low = Math.min(...temps) - 0.5, high = Math.max(...temps) + 0.5;
  const x = (i) => (i / (samples.length - 1)) * width;
  const y = (t) => height - ((t - low) / (high - low)) * height;
  const line = temps.map((t, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(t).toFixed(1)}`).join(' ');
  return svg(`<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img"
      aria-label="Temperature over the last ${Math.round(samples.length / 6)} minutes"
      style="width: 100%; height: ${height}px; overflow: visible;">
    <path d="${line} L${width} ${height} L0 ${height} Z" fill="var(--sealed-soft)"></path>
    <path d="${line}" fill="none" stroke="var(--sealed)" stroke-width="1.5" stroke-linejoin="round"></path>
  </svg>`);
}

function signaturesCard(version) {
  const rows = SIGNATURES.filter(([key]) => version[key]);
  if (!rows.length) return null;
  return h('div.card', {},
    h('div.card-head', {}, h('span', {}, 'What signed the software'), h('span.v', {}, `${rows.length} values`)),
    h('div.card-body', {},
      h('p.soft.measure', {}, 'The module reports the keys its firmware and bootloader were signed with, and the signatures themselves. They say what it is running; they do not prove it on their own — that is what the attestation at api.encedo.com is for.'),
      rows.map(([key, label]) => h('div.stack-s', {},
        h('div.field-head', {}, h('span.name', {}, `${label} · ${key}`), copyControl(version[key])),
        h('p.blob', {}, version[key])))));
}

function healthCard(session, view) {
  const result = session.state.selftest;
  const busy = view.busy === 'selftest';
  return h('div.card', {},
    h('div.card-head', {}, h('span', {}, 'Health check'), h('span.v', {}, result ? 'run in this session' : 'not run yet')),
    h('div.card-body', {},
      h('p.soft.measure', {}, 'The module tests its own entropy source and runs known-answer tests against its algorithms. It is busy while that happens, so nothing else reaches it for a moment. Every counter it answers with means "nothing wrong" at zero.'),
      h('div.row', {},
        h('button.button', { type: 'button', disabled: busy || null, onclick: () => view.runSelftest() }, busy ? 'Testing…' : 'Run the health check'))),
    result ? h('div', {}, statusGrid(healthRows(result))) : null,
    result?.repo_stats ? repoCard(result.repo_stats) : null);
}

/** What the key repository looks like inside, as the self-test found it. */
function repoCard(stats) {
  const busy = Number(stats.invalid ?? 0) !== 0;
  return h('div', {},
    statusGrid([
      ['Keys held', String(stats.total ?? '—')],
      ['Slots deleted', String(stats.deleted ?? '—')],
      ['Invalid', String(stats.invalid ?? '—'), busy ? 'risk' : ''],
      ['Fragmented', String(stats.fragmented ?? '—')],
      ['Free slots', String(stats.freeslots ?? '—')],
    ]),
    h('p.status-note', {}, 'The key repository, counted by the module itself. Deleted and fragmented slots are room a key once took; they are reused as keys come and go. An invalid slot is the one number here that should never move off zero.'));
}

function healthRows(result) {
  const named = HEALTH.filter(([key]) => key in result);
  const rest = Object.keys(result)
    .filter((key) => !HEALTH.some(([k]) => k === key) && typeof result[key] !== 'object')
    .map((key) => [key, key]);
  return [...named, ...rest].map(([key, label]) => [label, healthValue(key, result[key]), healthTone(key, result[key])]);
}

function healthValue(key, value) {
  if (key === 'kat_busy') return value ? 'running now' : 'done';
  if (key.endsWith('_ts')) return Number(value) > 0 ? new Date(Number(value) * 1000).toISOString().slice(0, 19).replace('T', ' ') : 'never';
  return Number(value) === 0 ? 'nothing wrong' : `reported ${value}`;
}

function healthTone(key, value) {
  if (key === 'kat_busy' || key.endsWith('_ts')) return '';
  return Number(value) === 0 ? '' : 'risk';
}

function tokensCard(session, view) {
  const tokens = session.tokens();
  const now = Math.floor(Date.now() / 1000);
  return h('div.card', {},
    h('div.card-head', {}, h('span', {}, 'What this browser can still do'), h('span.v', {}, `${tokens.length} token${tokens.length === 1 ? '' : 's'}`)),
    tokens.length
      ? h('div.table-wrap', {}, h('table', {},
          h('thead', {}, h('tr', {}, ['Scope', 'Good for'].map((c) => h('th', {}, c)))),
          h('tbody', {}, tokens.map((t) => h('tr', {},
            h('td.mono', {}, t.scope),
            h('td', {}, t.exp - now > 0 ? `${Math.max(1, Math.round((t.exp - now) / 60))} min` : 'expired'))))))
      : h('div.card-body', {}, h('p.soft', {}, 'None. The next thing you ask for will need your password, or your phone.')),
    h('div.card-body', { style: 'border-top: 1px solid var(--rule);' },
      h('p.soft.measure', {}, 'A token lets this page repeat one kind of operation without asking you again, until it expires. Forgetting them costs nothing but a password prompt.'),
      h('div.row', {}, h('button.button.small.plain', { type: 'button', disabled: !tokens.length || null, onclick: () => view.forgetTokens() }, 'Forget them'))));
}

function rebootCard(view) {
  const asked = view.confirmReboot;
  const busy = view.busy === 'reboot';
  return h('div.card', {},
    h('div.card-head', {}, h('span', {}, 'Reboot'), h('span.v', {}, 'the module, not this page')),
    h('div.card-body', {},
      h('p.soft.measure', {}, 'Everything unlocked locks: both drives go back inside, every token this browser holds stops working, and the module writes a new log file when it comes up. It is away for about half a minute, and this page waits for it.'),
      asked
        ? h('div.row', {},
            h('button.button.exposed', { type: 'button', disabled: busy || null, onclick: () => view.reboot() }, busy ? 'Rebooting…' : 'Reboot the module'),
            h('button.button.plain', { type: 'button', onclick: () => view.cancelReboot() }, 'Leave it running'))
        : h('div.row', {}, h('button.button.exposed', { type: 'button', onclick: () => view.askReboot() }, 'Reboot the module'))));
}
