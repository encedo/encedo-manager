// Pages that are not built yet say so, and say what they will be built from.

import { h, pageHead } from '../ui.js';

const PLAN = {
  keychain: ['Keychain', 'Keys stay inside; the module answers for them.', 'listKeys, searchKeys, getPubKey, createKeyPair, importPublicKey, updateKey, deleteKey, broker.shareEmailPubkey'],
  phones: ['Paired phones', 'Phones that can answer for you.', 'registerExtAuth with a QR code, listExtAuth, deleteExtAuth'],
  log: ['Operation log', 'Every log file is verified before you read it.', 'getLoggerKey, listLog, getLogEntry, verifyLogEntry'],
  hardware: ['Hardware', 'What the module reports about itself.', 'getVersion, getStatus, selftest, getAttestation, reboot'],
  software: ['Software', 'Firmware and Manager updates.', 'hemCheckin flags, broker.download, uploadFirmware / checkFirmware / installFirmware, uploadUi / checkUi / installUi'],
  settings: ['Settings', 'Owner, hostname, domain and the master passphrase.', 'getConfig, setConfig, registerDomain; master passphrase once the SDK has BIP39'],
};

export function renderPlaceholder(routeId) {
  const [eyebrow, title, calls] = PLAN[routeId] ?? [routeId, routeId, ''];
  return [
    pageHead(eyebrow, title),
    h('div.card', {},
      h('div.card-head', {}, h('span', {}, 'Not built yet'), h('span.v', {}, 'v2 in progress')),
      h('div.card-body', {},
        h('p.soft', {}, 'This page is drawn in the design canvas and not built yet. It will be built on these SDK calls:'),
        h('p.mono.soft', { style: 'font-size: 13px; line-height: 1.7;' }, calls))),
  ];
}
