// A small PDF writer, enough for a document made of headings, paragraphs and
// labelled lines: the Proof of Personalisation. Text only, in the fourteen
// fonts every reader carries (Helvetica here), so nothing is embedded and no
// library is shipped — the same reasoning as qr.js, on a module that must work
// with no network at all. Output is bytes; the page turns them into a file.

const A4 = { width: 595.28, height: 841.89 };
const MARGIN = { top: 64, right: 56, bottom: 64, left: 56 };

/** Widths of Helvetica's WinAnsi glyphs in 1/1000 em, for wrapping. Unlisted glyphs count as 556. */
const WIDTHS = { ' ': 278, '!': 278, '"': 355, '#': 556, '$': 556, '%': 889, '&': 667, "'": 191, '(': 333, ')': 333, '*': 389, '+': 584, ',': 278, '-': 333, '.': 278, '/': 278, '0': 556, '1': 556, '2': 556, '3': 556, '4': 556, '5': 556, '6': 556, '7': 556, '8': 556, '9': 556, ':': 278, ';': 278, '<': 584, '=': 584, '>': 584, '?': 556, '@': 1015, A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278, J: 500, K: 667, L: 556, M: 833, N: 722, O: 778, P: 667, Q: 778, R: 722, S: 667, T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611, '[': 278, '\\': 278, ']': 278, '^': 469, _: 556, '`': 333, a: 556, b: 556, c: 500, d: 556, e: 556, f: 278, g: 556, h: 556, i: 222, j: 222, k: 500, l: 222, m: 833, n: 556, o: 556, p: 556, q: 556, r: 333, s: 500, t: 278, u: 556, v: 500, w: 722, x: 500, y: 500, z: 500, '{': 334, '|': 260, '}': 334, '~': 584 };
const BOLD_EXTRA = 1.06;

const textWidth = (text, size, bold) => [...text].reduce((w, ch) => w + (WIDTHS[ch] ?? 556), 0) / 1000 * size * (bold ? BOLD_EXTRA : 1);

/**
 * A document is a list of blocks; layout happens when it is built:
 *   { kind: 'heading', text }          large, bold
 *   { kind: 'subheading', text }       bold
 *   { kind: 'paragraph', text }        wrapped
 *   { kind: 'line', label, value }     bold label, then the value, wrapped together
 *   { kind: 'mono', text }             the value on its own line, wrapped hard (for 24 words, keys)
 *   { kind: 'gap', size }              vertical space
 *   { kind: 'rule' }                   a horizontal line
 */
export function buildPdf(blocks, { title = 'Document', mark = true } = {}) {
  const pages = [];
  let ops = [];
  let y = A4.height - MARGIN.top;
  const usable = A4.width - MARGIN.left - MARGIN.right;

  const newPage = () => { if (ops.length) pages.push(ops); ops = []; y = A4.height - MARGIN.top; };
  const ensure = (needed) => { if (y - needed < MARGIN.bottom) newPage(); };
  const text = (str, size, bold, x = MARGIN.left) => {
    ops.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${escapePdf(str)}) Tj ET`);
  };
  const wrap = (str, size, bold, width = usable) => {
    const lines = [];
    let line = '';
    for (const word of String(str).split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (textWidth(candidate, size, bold) <= width || !line) line = candidate;
      else { lines.push(line); line = word; }
    }
    if (line) lines.push(line);
    return lines;
  };
  const paragraph = (str, size, bold, lead = size * 1.4) => {
    for (const line of wrap(str, size, bold)) { ensure(lead); y -= lead; text(line, size, bold); }
  };

  if (mark) {
    // The product mark, top right: a rounded green square, a light frame, a pale dot.
    const s = 40, x = A4.width - MARGIN.right - s, top = A4.height - MARGIN.top + 12;
    ops.push(`q 0.059 0.373 0.294 rg ${roundedRect(x, top - s, s, s, 8)} f Q`);
    ops.push(`q 0.686 0.824 0.773 RG 2.5 w ${roundedRect(x + 10, top - s + 10, s - 20, s - 20, 4)} S Q`);
    ops.push(`q 0.949 0.973 0.961 rg ${circle(x + s / 2, top - s / 2, 3.75)} f Q`);
  }

  for (const b of blocks) {
    switch (b.kind) {
      case 'heading': y -= 6; paragraph(b.text, 22, true, 28); y -= 6; break;
      case 'subheading': ensure(30); y -= 18; paragraph(b.text, 13, true, 16); y -= 2; break;
      case 'paragraph': paragraph(b.text, 10.5, false, 14.5); y -= 4; break;
      case 'line': {
        const size = 10.5, lead = 15;
        const label = `${b.label}: `;
        const lw = textWidth(label, size, true);
        const lines = wrap(b.value ?? '', size, false, usable - lw);
        ensure(lead);
        y -= lead;
        text(label, size, true);
        text(lines[0] ?? '', size, false, MARGIN.left + lw);
        for (const rest of lines.slice(1)) { ensure(lead); y -= lead; text(rest, size, false, MARGIN.left + lw); }
        break;
      }
      case 'mono': {
        // Wrapped hard, by width, so a key or a passphrase never loses a character.
        const size = 10.5, lead = 15;
        let line = '';
        const flush = () => { if (line) { ensure(lead); y -= lead; text(line, size, false); line = ''; } };
        for (const ch of String(b.text)) {
          if (textWidth(line + ch, size, false) > usable) flush();
          line += ch;
        }
        flush();
        break;
      }
      case 'gap': y -= b.size ?? 10; break;
      case 'rule': ensure(12); y -= 8; ops.push(`q 0.66 0.71 0.69 RG 0.6 w ${MARGIN.left} ${y.toFixed(2)} m ${(A4.width - MARGIN.right).toFixed(2)} ${y.toFixed(2)} l S Q`); y -= 4; break;
      default: throw new Error(`unknown block ${b.kind}`);
    }
  }
  newPage();

  return assemble(pages, title);
}

function roundedRect(x, y, w, h, r) {
  const k = 0.5523 * r;
  return [
    `${(x + r).toFixed(2)} ${y.toFixed(2)} m`,
    `${(x + w - r).toFixed(2)} ${y.toFixed(2)} l`,
    `${(x + w - r + k).toFixed(2)} ${y.toFixed(2)} ${(x + w).toFixed(2)} ${(y + r - k).toFixed(2)} ${(x + w).toFixed(2)} ${(y + r).toFixed(2)} c`,
    `${(x + w).toFixed(2)} ${(y + h - r).toFixed(2)} l`,
    `${(x + w).toFixed(2)} ${(y + h - r + k).toFixed(2)} ${(x + w - r + k).toFixed(2)} ${(y + h).toFixed(2)} ${(x + w - r).toFixed(2)} ${(y + h).toFixed(2)} c`,
    `${(x + r).toFixed(2)} ${(y + h).toFixed(2)} l`,
    `${(x + r - k).toFixed(2)} ${(y + h).toFixed(2)} ${x.toFixed(2)} ${(y + h - r + k).toFixed(2)} ${x.toFixed(2)} ${(y + h - r).toFixed(2)} c`,
    `${x.toFixed(2)} ${(y + r).toFixed(2)} l`,
    `${x.toFixed(2)} ${(y + r - k).toFixed(2)} ${(x + r - k).toFixed(2)} ${y.toFixed(2)} ${(x + r).toFixed(2)} ${y.toFixed(2)} c`,
    'h',
  ].join(' ');
}

function circle(cx, cy, r) {
  const k = 0.5523 * r;
  return [
    `${(cx + r).toFixed(2)} ${cy.toFixed(2)} m`,
    `${(cx + r).toFixed(2)} ${(cy + k).toFixed(2)} ${(cx + k).toFixed(2)} ${(cy + r).toFixed(2)} ${cx.toFixed(2)} ${(cy + r).toFixed(2)} c`,
    `${(cx - k).toFixed(2)} ${(cy + r).toFixed(2)} ${(cx - r).toFixed(2)} ${(cy + k).toFixed(2)} ${(cx - r).toFixed(2)} ${cy.toFixed(2)} c`,
    `${(cx - r).toFixed(2)} ${(cy - k).toFixed(2)} ${(cx - k).toFixed(2)} ${(cy - r).toFixed(2)} ${cx.toFixed(2)} ${(cy - r).toFixed(2)} c`,
    `${(cx + k).toFixed(2)} ${(cy - r).toFixed(2)} ${(cx + r).toFixed(2)} ${(cy - k).toFixed(2)} ${(cx + r).toFixed(2)} ${cy.toFixed(2)} c`,
    'h',
  ].join(' ');
}

/**
 * Text goes into the file in WinAnsi, the encoding the standard fonts use.
 * A character outside it (a Polish ł, say) becomes a question mark rather
 * than a byte the reader would show as something else. Names may suffer;
 * the words, keys and ids this document exists for are ASCII by construction.
 */
function escapePdf(str) {
  let out = '';
  for (const ch of String(str)) {
    const code = ch.codePointAt(0);
    if (ch === '(' || ch === ')' || ch === '\\') out += '\\' + ch;
    else if (code >= 0x20 && code <= 0x7e) out += ch;
    else if (code >= 0xa0 && code <= 0xff) out += '\\' + code.toString(8).padStart(3, '0');
    else out += '?';
  }
  return out;
}

const latin1 = (str) => Uint8Array.from(str, (ch) => ch.charCodeAt(0) & 0xff);

function assemble(pages, title) {
  const objects = [];        // 1-based; each a string body
  const add = (body) => { objects.push(body); return objects.length; };
  const fontRegular = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const fontBold = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const pagesId = objects.length + 1 + pages.length * 2;      // known after the pages are added
  const pageIds = [];
  for (const ops of pages) {
    const stream = ops.join('\n');
    const content = add(`<< /Length ${latin1(stream).length} >>\nstream\n${stream}\nendstream`);
    pageIds.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${A4.width} ${A4.height}] /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> /Contents ${content} 0 R >>`));
  }
  const pagesObj = add(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`);
  if (pagesObj !== pagesId) throw new Error('page tree numbering');
  const catalog = add(`<< /Type /Catalog /Pages ${pagesObj} 0 R >>`);
  const info = add(`<< /Title (${escapePdf(title)}) /Producer (Encedo HEM Manager) /Creator (Encedo HEM Manager) >>`);

  let out = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(latin1(out).length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = latin1(out).length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) out += `${String(off).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return latin1(out);
}

/**
 * The Proof of Personalisation, as Manager v1 printed it: what was set, the
 * ids the module answers with, and the 24 words that open it when everything
 * else is lost. Made here and nowhere else; it goes to paper, not to a disk.
 */
export function proofOfPersonalisation(p) {
  const settings = [
    `Trust Encedo as a time source: ${p.trusted_ts ? 'yes' : 'no'}`,
    `Allow remote management: ${p.trusted_backend ? 'yes' : 'no'}`,
    `Answer key searches without a token: ${p.allow_keysearch ? 'yes' : 'no'}`,
  ].join(' / ');
  const blocks = [
    { kind: 'heading', text: 'Proof of Personalisation' },
    { kind: 'paragraph', text: 'This Encedo module has been personalised and you are its only owner. Here is what was set during that process. Print this document and keep it safe; do not save it on a disk or in the cloud. The master passphrase is the last way back into the module when the password is lost and no phone is paired with it.' },
    { kind: 'subheading', text: 'Setup details' },
    { kind: 'line', label: 'Hostname', value: p.hostname },
    { kind: 'line', label: 'Issued at', value: p.issued },
    { kind: 'line', label: 'Instance ID', value: p.instanceid ?? '' },
    { kind: 'line', label: 'Serial number', value: p.devid ?? '' },
    { kind: 'line', label: 'Instance key', value: p.eid ?? '' },
    { kind: 'line', label: 'Instance log key', value: p.eid_sign ?? '' },
    { kind: 'line', label: 'User identity', value: p.user },
    { kind: 'line', label: 'Settings', value: settings },
    { kind: 'line', label: 'Hardware', value: p.hardware ?? '' },
    { kind: 'line', label: 'Firmware', value: p.firmware ?? '' },
    { kind: 'subheading', text: 'Master passphrase' },
    { kind: 'paragraph', text: 'Twenty-four words, in this order. Together they are the key the module trusts above the password.' },
    ...rowsOfWords(p.words),
    { kind: 'rule' },
    { kind: 'paragraph', text: 'This document was generated in the browser only. Keep it safe: Encedo cannot help you back into the module without it.' },
    { kind: 'paragraph', text: '- END OF FILE -' },
  ];
  return buildPdf(blocks, { title: `Proof of Personalisation - ${p.hostname}` });
}

/** The words numbered, six to a line, so a reader can point at the ninth. */
function rowsOfWords(words) {
  const list = String(words ?? '').trim().split(/\s+/);
  const rows = [];
  for (let i = 0; i < list.length; i += 6) {
    rows.push({ kind: 'mono', text: list.slice(i, i + 6).map((w, j) => `${String(i + j + 1).padStart(2, ' ')}. ${w}`).join('   ') });
  }
  return rows;
}
