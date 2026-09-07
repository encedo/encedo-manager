// Paging, shared by every page that shows a list the module could make long.

import { h, select } from './ui.js';

export const PAGE_SIZES = [[10, '10 per page'], [25, '25 per page'], [50, '50 per page'], [0, 'All of them']];

/** One page of rows. `size` 0 means all of them; `page` is clamped to what exists. */
export function pageOf(rows, page = 1, size = 10) {
  const total = rows.length;
  const pages = size > 0 ? Math.max(1, Math.ceil(total / size)) : 1;
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pages);
  const from = size > 0 ? (current - 1) * size : 0;
  const shown = size > 0 ? rows.slice(from, from + size) : rows;
  return { rows: shown, page: current, pages, total, from: total ? from + 1 : 0, to: from + shown.length };
}

/**
 * The strip under a table: what is shown, how much fits on a page, and the way
 * to the next one. `view` holds `page` and `pageSize`; `repaint` redraws the
 * table alone, so nothing above it moves.
 */
export function pagerFoot(page, view, repaint, { sizes = PAGE_SIZES } = {}) {
  const size = select(sizes, view.pageSize, {
    onchange: (e) => { view.pageSize = Number(e.target.value); view.page = 1; repaint(); },
  });
  const step = (to) => { view.page = to; repaint(); };
  return h('div.card-foot', {},
    h('span', {}, page.total ? `Showing ${page.from}–${page.to} of ${page.total}` : 'Nothing to show'),
    h('div.row', { style: 'gap: 10px;' },
      size,
      page.pages > 1 ? h('button.button.small.plain', { type: 'button', disabled: page.page === 1 || null, onclick: () => step(page.page - 1) }, 'Previous') : null,
      page.pages > 1 ? h('span', {}, `page ${page.page} of ${page.pages}`) : null,
      page.pages > 1 ? h('button.button.small.plain', { type: 'button', disabled: page.page === page.pages || null, onclick: () => step(page.page + 1) }, 'Next') : null));
}
