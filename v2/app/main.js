// Bootstrap: find the module, keep a session, render the shell and the pages.

import { resolveConfig } from './config.js';
import { Session, describeError } from './session.js';
import { ROUTES, currentRoute, href, onRouteChange } from './router.js';
import { h, mark, icon, render } from './ui.js';
import { renderSignIn } from './pages/signin.js';
import { renderOverview } from './pages/overview.js';
import { renderDrive } from './pages/drive.js';
import { renderPlaceholder } from './pages/placeholder.js';

const root = document.getElementById('app');
const config = resolveConfig();
const session = new Session(config);
const local = { busy: false, error: null, phone: null };   // sign-in form state
const driveView = { busy: null, error: null };
let probeCtl = null;

// -- sign-in actions ---------------------------------------------------------------

const signInView = {
  local,
  async signIn(password) {
    local.busy = true; local.error = null; paint();
    try { await session.signIn(password); }
    catch (e) { local.error = describeError(e); }
    local.busy = false; paint();
  },
  async signInWithPhone() {
    const ctl = new AbortController();
    local.phone = { cancel: () => ctl.abort() }; local.error = null; paint();
    try { await session.signInWithPhone({ signal: ctl.signal }); }
    catch (e) { if (e?.code !== 'aborted') local.error = describeError(e); }
    local.phone = null; paint();
  },
  cancelPhone() { local.phone?.cancel(); },
  changeAddress() {
    const next = window.prompt('Address of the module', session.urls.hem);
    if (next === null) return;
    const u = new URL(location.href);
    u.searchParams.set('hem', next.trim());
    location.href = u.toString();
  },
};

// -- drive actions --------------------------------------------------------------------

const driveActions = {
  get busy() { return driveView.busy; },
  get error() { return driveView.error; },
  async unlock(i, mode) { await driveOp(i, () => session.unlockDisk(i, mode)); },
  async lock(i) { await driveOp(i, () => session.lockDisk(i)); },
};

async function driveOp(i, fn) {
  driveView.busy = i; driveView.error = null; paint();
  try { await fn(); } catch (e) { driveView.error = describeError(e); }
  driveView.busy = null; paint();
}

// -- shell ------------------------------------------------------------------------------

function shell(route, content) {
  const { state } = session;
  const v = state.version ?? {};
  root.className = 'app';
  render(root,
    h('aside.sidebar', {},
      h('div.brand', {}, mark(36), h('div.name', {}, h('b', {}, 'Encedo HEM'), h('span', {}, 'Manager'))),
      h('nav.nav', { 'aria-label': 'Sections' }, ROUTES.map((r) =>
        h(`a${r.id === route.id ? '.active' : ''}`, { href: href(r), 'aria-current': r.id === route.id ? 'page' : null }, icon(r.id), h('span', {}, r.label)))),
      h('div.sidebar-foot', {},
        h('span.host', {}, state.config?.hostname || state.status?.hostname || session.urls.hem.replace(/^https?:\/\//, '')),
        h('span', {}, `${session.urls.hem.replace(/^https?:\/\//, '')} · ${config.servedFromDevice ? 'served by the module' : 'dev server'}`),
        h('span', {}, `${state.config?.user ?? 'signed in'} · `, h('a', { href: '#', onclick: (e) => { e.preventDefault(); session.signOut(); } }, 'Sign out')))),
    h('main.main', {},
      h('div.masthead', {},
        h('span', {}, h('b', {}, 'Encedo HEM Manager'), '  2.0.0-dev'),
        h('span', {}, [`firmware ${v.fwv ?? '?'}`, v.conf ?? v.hwv, state.online ? 'backend reachable' : state.online === false ? 'air-gapped' : null].filter(Boolean).join(' · '))),
      content));
}

function paint() {
  const route = currentRoute();
  if (session.state.phase !== 'signed-in') {
    renderSignIn(root, session, signInView);
    return;
  }
  let content;
  if (route.id === 'overview') content = renderOverview(session);
  else if (route.id === 'drive') content = renderDrive(session, driveActions);
  else content = renderPlaceholder(route.id);
  shell(route, content);
}

// -- start --------------------------------------------------------------------------------

session.addEventListener('change', paint);
onRouteChange(paint);
paint();

(async () => {
  probeCtl = new AbortController();
  try {
    await session.waitForDevice({ signal: probeCtl.signal });
    await session.prepare();
  } catch (e) {
    if (e?.code !== 'aborted') console.error('[manager] start failed', e);
  }
})();
