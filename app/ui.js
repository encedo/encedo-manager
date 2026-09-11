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
  copy: '<svg viewBox="0 0 20 20"><rect x="7" y="7" width="10" height="10" rx="2"></rect><path d="M13 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"></path></svg>',
  tick: '<svg viewBox="0 0 20 20"><path d="m4 10.5 4 4 8-9"></path></svg>',
};

export const icon = (name) => svg(ICONS[name]);

export function pill(kind, text) {
  return h(`span.pill${kind ? '.' + kind : ''}`, {}, h('i'), text);
}

export function pageHead(eyebrow, title, lede) {
  return h('div.page-head', {}, h('p.eyebrow', {}, eyebrow), h('h1', {}, title), lede ? h('p', {}, lede) : null);
}

let ids = 0;

/**
 * A labelled control: field('Label', input, 'hint'). Labels the control by id.
 * `copy` puts a copy control in the label row — for a field whose value is data
 * someone will want to take somewhere else, rather than something they typed.
 */
export function field(label, control, hint = null, { copy = false, counter = null } = {}) {
  if (!control.id) control.id = `f${++ids}`;
  const head = copy
    ? h('div.field-head', {}, h('label', { for: control.id }, label), copyControl(() => control.value))
    : h('label', { for: control.id }, label);

  // A counter says how much of the field is spent, in the unit the device uses,
  // and turns rust the moment what is typed no longer fits.
  let count = null;
  if (counter) {
    count = h('span.count');
    const refresh = () => {
      const { text, over } = counter(control.value);
      count.textContent = text;
      count.classList.toggle('over', Boolean(over));
    };
    control.addEventListener('input', refresh);
    refresh();
  }
  const foot = hint || count ? h('div.field-foot', {}, hint ? h('span.hint', {}, hint) : h('span'), count) : null;
  return h('div.field', {}, head, control, foot);
}

/**
 * A control that copies and then says it did. The text is read when the button
 * is pressed, not when it is built, so an edited field copies what it now says.
 * A browser that refuses the clipboard says so instead of failing silently.
 */
export function copyControl(text, { className = 'copy', label = 'Copy', done = 'Copied' } = {}) {
  const read = typeof text === 'function' ? text : () => text;
  const button = h(`button.${className}`, { type: 'button' }, icon('copy'), h('span', {}, label));
  button.addEventListener('click', async () => {
    let ok = true;
    try { await navigator.clipboard.writeText(read()); } catch { ok = false; }
    render(button, icon(ok ? 'tick' : 'copy'), h('span', {}, ok ? done : 'Select it and copy'));
    button.classList.toggle('done', ok);
    setTimeout(() => { render(button, icon('copy'), h('span', {}, label)); button.classList.remove('done'); }, 2000);
  });
  return button;
}

/**
 * A <select>. `options` is a list of values, [value, label] pairs, or
 * ['Group name', [...options]] to make an <optgroup>.
 */
export function select(options, value = null, attrs = {}) {
  const el = h('select', attrs);
  const option = (opt) => {
    const [v, label] = Array.isArray(opt) ? opt : [opt, opt];
    return h('option', { value: v, selected: v === value || null }, label);
  };
  for (const opt of options) {
    if (Array.isArray(opt) && Array.isArray(opt[1])) el.append(h('optgroup', { label: opt[0] }, opt[1].map(option)));
    else el.append(option(opt));
  }
  return el;
}

export function statusGrid(items) {
  return h('dl.status-grid', {}, items.map(([dt, dd, cls]) =>
    h('div', {}, h('dt', {}, dt), h(`dd${cls ? '.' + cls : ''}`, {}, dd))));
}

/** Column widths for a table.fixed, as percentages or lengths. */
export const colgroup = (widths) => h('colgroup', {}, widths.map((w) => h('col', { style: `width: ${w};` })));

/** Replace the children of `el`. */
export function render(el, ...children) {
  el.replaceChildren();
  append(el, children);
  return el;
}
