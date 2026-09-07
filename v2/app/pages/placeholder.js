// Pages that are not built yet say so, and say what they will be built from.

import { h, pageHead } from '../ui.js';

const PLAN = {
  software: ['Software', 'Firmware and Manager updates.', 'hemCheckin flags, broker.download, uploadFirmware / checkFirmware / installFirmware, uploadUi / checkUi / installUi'],
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
