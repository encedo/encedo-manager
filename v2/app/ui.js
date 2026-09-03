// Small DOM helpers: element construction and the shared marks and icons.

/** h('div.card', { onclick }, child, 'text', ...) — class shorthand in the tag. */
export function h(tag, attrs = {}, ...children) {
  const [name, ...classes] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (classes.length) el.className = classes.join(' ');
  if (attrs && typeof attrs === 'object' && !(attrs instanceof Node) && !Array.isArray(attrs)) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
  } else {
    children.unshift(attrs);
  }
  append(el, children);
  return el;
}

export function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function svg(markup) {
  const t = document.createElement('template');
  t.innerHTML = markup.trim();
  return t.content.firstChild;
}

export const mark = (size = 36) => svg(
  `<svg viewBox="0 0 64 64" width="${size}" height="${size}" role="img" aria-label="Encedo HEM">
    <rect width="64" height="64" rx="13" fill="#0F5F4B"></rect>
    <rect x="16" y="16" width="32" height="32" rx="7" fill="none" stroke="#AFD2C5" stroke-width="4"></rect>
    <circle cx="32" cy="32" r="6" fill="#F2F8F5"></circle></svg>`);

export const ICONS = {
  overview: '<svg viewBox="0 0 20 20"><rect x="3" y="3" width="14" height="14" rx="2.5"></rect><circle cx="10" cy="10" r="2.2"></circle></svg>',
  keychain: '<svg viewBox="0 0 20 20"><circle cx="7" cy="12" r="3.5"></circle><path d="M9.8 9.8 17 2.6M14 5.6l2 2M11.6 8l1.6 1.6"></path></svg>',
  drive: '<svg viewBox="0 0 20 20"><rect x="3" y="6" width="14" height="9" rx="1.5"></rect><path d="M6 10.5h5"></path><circle cx="14" cy="10.5" r=".9"></circle></svg>',
  phones: '<svg viewBox="0 0 20 20"><rect x="6" y="2" width="8" height="16" rx="1.6"></rect><path d="M9 15.2h2"></path></svg>',
  log: '<svg viewBox="0 0 20 20"><path d="M4 5h12M4 10h12M4 15h7"></path></svg>',
  hardware: '<svg viewBox="0 0 20 20"><rect x="6" y="6" width="8" height="8" rx="1"></rect><path d="M8 3v3M12 3v3M8 14v3M12 14v3M3 8h3M3 12h3M14 8h3M14 12h3"></path></svg>',
  software: '<svg viewBox="0 0 20 20"><path d="M10 3v10M6 9l4 4 4-4M4 17h12"></path></svg>',
  settings: '<svg viewBox="0 0 20 20"><path d="M3 6h14M3 14h14"></path><circle cx="8" cy="6" r="2" fill="var(--ground)"></circle><circle cx="13" cy="14" r="2" fill="var(--ground)"></circle></svg>',
};

export const icon = (name) => svg(ICONS[name]);

export function pill(kind, text) {
  return h(`span.pill${kind ? '.' + kind : ''}`, {}, h('i'), text);
}

export function pageHead(eyebrow, title, lede) {
  return h('div.page-head', {}, h('p.eyebrow', {}, eyebrow), h('h1', {}, title), lede ? h('p', {}, lede) : null);
}

export function statusGrid(items) {
  return h('dl.status-grid', {}, items.map(([dt, dd, cls]) =>
    h('div', {}, h('dt', {}, dt), h(`dd${cls ? '.' + cls : ''}`, {}, dd))));
}

/** Replace the children of `el`. */
export function render(el, ...children) {
  el.replaceChildren();
  append(el, children);
  return el;
}
