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
  phones: () => { keychain.ensure(); phones.ensure(); return renderPhones(session, phones); },
  log: () => { log.ensure(); return renderLog(session, log); },
  hardware: () => renderHardware(session, hardware),
  software: () => renderSoftware(session, software),
  settings: () => { settings.ensure(); return renderSettings(session, settings); },
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
  signIn.reset();
}

/** The password question on screen: nothing repaints under it while it is typed into. */
let shownPasswordQuestion = null;

function paint() {
  const route = currentRoute();
  const { phase, asking } = session.state;
  // Every repaint builds the page anew, and a new password field is an empty one
  // with no focus: while the question is open nothing redraws it (2026-11-25,
  // PPA - the status poll and the 1 s timer cleared the field as it was typed).
  if (phase === 'signed-in' && asking?.kind === 'password' && asking === shownPasswordQuestion) return;
  shownPasswordQuestion = phase === 'signed-in' && asking?.kind === 'password' ? asking : null;
  if (lastPhase === 'signed-in' && phase !== 'signed-in') forgetPageState();
  lastPhase = phase;

  hardware.watch(route.id === 'hardware' && phase === 'signed-in');
  phones.watch(route.id === 'phones' && Boolean(phones.pairing?.qrText));
  watchAsking(asking?.kind === 'phone' && phase === 'signed-in');   // the phone's seconds tick down; a password does not

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
      session.checkRelease();   // DEV-534: once a page load, not waited for; it never throws
    } catch (e) {
      if (e?.code !== 'aborted') console.error('[manager] could not reach the module', e);
    }
  })();
}

// The module's status every 15 s while signed in, and the check-in every 5
// minutes while it answers (owner, 2026-11-25). A reboot is the SDK's to tell
// (the module's spk, DEV-535), not the status's.
const STATUS_EVERY_MS = 15_000;
const CHECKIN_EVERY_MS = 5 * 60_000;
setInterval(() => { if (session.state.phase === 'signed-in') session.pollStatus(); }, STATUS_EVERY_MS);
setInterval(() => { if (session.state.phase !== 'probing') session.checkIn(); }, CHECKIN_EVERY_MS);

session.addEventListener('change', paint);
onRouteChange(paint);
paint();
probeAgain();
