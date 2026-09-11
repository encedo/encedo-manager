// Bootstrap: find the module, keep a session, and put the right page in the
// shell. Every page is a render function in pages/ and a controller in views/;
// this file is the wiring between them, the session and the browser.

import { resolveConfig } from './config.js';
import { Session } from './session.js';
import { currentRoute, onRouteChange } from './router.js';
import { renderShell, askingModal, anywayModal } from './shell.js';

import { renderSignIn } from './pages/signin.js';
import { renderPersonalise } from './pages/personalise.js';
import { renderOverview } from './pages/overview.js';
import { renderDrive } from './pages/drive.js';
import { renderKeychain } from './pages/keychain.js';
import { renderPhones } from './pages/phones.js';
import { renderLog } from './pages/log.js';
import { renderHardware } from './pages/hardware.js';
import { renderSoftware } from './pages/software.js';
import { renderSettings } from './pages/settings.js';

import { createSignInView } from './views/signin.js';
import { createPersonaliseView } from './views/personalise.js';
import { createDriveView } from './views/drive.js';
import { createKeychainView } from './views/keychain.js';
import { createPhonesView } from './views/phones.js';
import { createLogView } from './views/log.js';
import { createHardwareView } from './views/hardware.js';
import { createSoftwareView } from './views/software.js';
import { createSettingsView } from './views/settings.js';

const root = document.getElementById('app');
const config = resolveConfig();
const session = new Session(config);

// Every controller gets the same three things: the module's session, a way to
// redraw, and a way to wait for the module to come back after a reboot.
const ctx = { session, paint, probeAgain, config };
const signIn = createSignInView(ctx);
const drive = createDriveView(ctx);
const keychain = createKeychainView(ctx);
const log = createLogView(ctx);
const hardware = createHardwareView(ctx);
const settings = createSettingsView(ctx);
const software = createSoftwareView(ctx);
const phones = createPhonesView({ ...ctx, keychain });          // the phones are keys
const personalise = createPersonaliseView({ ...ctx, software }); // old firmware goes in first
const pageViews = [drive, keychain, log, hardware, settings, phones, software];

/** One entry per route: the content of the page, and what it needs read first. */
const PAGES = {
  overview: () => renderOverview(session),
  keychain: () => { keychain.ensure(); return renderKeychain(session, keychain); },
  drive: () => renderDrive(session, drive),
  phones: () => { keychain.ensure(); return renderPhones(session, phones); },
  log: () => { log.ensure(); return renderLog(session, log); },
  hardware: () => renderHardware(session, hardware),
  software: () => renderSoftware(session, software),
  settings: () => renderSettings(session, settings),
};

/** While a phone is being asked, the seconds left tick down on the modal. */
let askingTimer = null;
function watchAsking(on) {
  if (on && !askingTimer) askingTimer = setInterval(paint, 1000);
  else if (!on && askingTimer) { clearInterval(askingTimer); askingTimer = null; }
}

/**
 * What each page remembers — an opened key, files already verified, a notice —
 * belongs to one session. When it ends, by signing out or otherwise, the next
 * person to sign in starts with pages that know nothing.
 */
let lastPhase = null;
function forgetPageState() {
  for (const view of pageViews) view.reset();
}

function paint() {
  const route = currentRoute();
  const { phase } = session.state;
  if (lastPhase === 'signed-in' && phase !== 'signed-in') forgetPageState();
  lastPhase = phase;

  hardware.watch(route.id === 'hardware' && phase === 'signed-in');
  phones.watch(route.id === 'phones' && Boolean(phones.pairing?.qrText));
  watchAsking(Boolean(session.state.asking) && phase === 'signed-in');

  if (phase === 'unpersonalised') return renderPersonalise(root, session, personalise);
  if (phase !== 'signed-in') return renderSignIn(root, session, signIn);

  const modal = session.state.asking ? askingModal(session.state.asking)
    : phones.anyway ? anywayModal(phones.anyway, phones)
    : null;
  renderShell(root, { session, config, route, content: (PAGES[route.id] ?? PAGES.overview)(), modal });
}

/** Wait for the module to answer — at startup, and after every reboot. */
let probeCtl = null;
function probeAgain() {
  probeCtl?.abort();
  probeCtl = new AbortController();
  return (async () => {
    try {
      await session.waitForDevice({ signal: probeCtl.signal });
      await session.prepare();
    } catch (e) {
      if (e?.code !== 'aborted') console.error('[manager] could not reach the module', e);
    }
  })();
}

session.addEventListener('change', paint);
onRouteChange(paint);
paint();
probeAgain();
