// A QR code encoder: byte mode, versions 1–40, every error-correction level.
//
// The Manager runs on a computer, so a share code that has to reach a phone has
// to leave the screen somehow. A QR code is that route, and it has to work with
// the module unplugged from the world — which rules out any generator fetched
// from a CDN, so here is one, in about as much code as loading a library would
// have cost. It follows ISO/IEC 18004: the tables below are the spec's, the
// arithmetic is Reed–Solomon over GF(256), and the mask is the one of eight the
// spec's own penalty rules like best. `dev/qr.test.mjs` checks the result
// module for module against an independent encoder.

import { svg } from './ui.js';

// Error-correction codewords per block, and how many blocks, by level and version.
const ECC_PER_BLOCK = {
  L: [0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  M: [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  Q: [0, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  H: [0, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
};
const BLOCKS = {
  L: [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  M: [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  Q: [0, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  H: [0, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
};
const FORMAT_BITS = { L: 1, M: 0, Q: 3, H: 2 };   // the level's two bits, not its rank

/** Modules a version has for data and error correction, before any of it is used. */
function rawDataModules(version) {
  let modules = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const alignments = Math.floor(version / 7) + 2;
    modules -= (25 * alignments - 10) * alignments - 55;
    if (version >= 7) modules -= 36;          // the two version blocks
  }
  return modules;
}

const totalCodewords = (version) => Math.floor(rawDataModules(version) / 8);
const dataCodewords = (version, ecc) => totalCodewords(version) - ECC_PER_BLOCK[ecc][version] * BLOCKS[ecc][version];

/** Where the alignment patterns sit: evenly spaced, first at 6, last 6 from the edge. */
function alignmentPositions(version) {
  if (version === 1) return [];
  const count = Math.floor(version / 7) + 2;
  const last = version * 4 + 10;
  const step = version === 32 ? 26 : Math.ceil((last - 6) / (count * 2 - 2)) * 2;
  const positions = [6];
  for (let pos = last; positions.length < count; pos -= step) positions.splice(1, 0, pos);
  return positions;
}

// -- GF(256), the field the error correction lives in ---------------------------------

/** Multiply in GF(256) modulo x^8 + x^4 + x^3 + x^2 + 1, the QR polynomial. */
function gfMul(a, b) {
  let product = 0;
  for (let i = 7; i >= 0; i--) {
    product = (product << 1) ^ ((product >>> 7) * 0x11d);
    product ^= ((b >>> i) & 1) * a;
  }
  return product & 0xff;
}

/** The divisor polynomial for `degree` error-correction codewords. */
function rsDivisor(degree) {
  const divisor = new Uint8Array(degree);
  divisor[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      divisor[j] = gfMul(divisor[j], root);
      if (j + 1 < degree) divisor[j] ^= divisor[j + 1];
    }
    root = gfMul(root, 2);
  }
  return divisor;
}

function rsRemainder(data, divisor) {
  const remainder = new Uint8Array(divisor.length);
  for (const byte of data) {
    const factor = byte ^ remainder[0];
    remainder.copyWithin(0, 1);
    remainder[remainder.length - 1] = 0;
    for (let i = 0; i < remainder.length; i++) remainder[i] ^= gfMul(divisor[i], factor);
  }
  return remainder;
}

// -- the codeword stream ---------------------------------------------------------------

/** Byte-mode segment: mode 0100, the length, the bytes, then the spec's padding. */
function toCodewords(bytes, version, ecc) {
  const capacity = dataCodewords(version, ecc) * 8;
  const countBits = version < 10 ? 8 : 16;
  const bits = [];
  const push = (value, width) => { for (let i = width - 1; i >= 0; i--) bits.push((value >>> i) & 1); };
  push(0b0100, 4);
  push(bytes.length, countBits);
  for (const byte of bytes) push(byte, 8);
  if (bits.length > capacity) throw new Error('qr: data does not fit');

  push(0, Math.min(4, capacity - bits.length));        // terminator
  push(0, (8 - bits.length % 8) % 8);                  // out to a whole codeword
  for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) push(pad, 8);

  const codewords = new Uint8Array(bits.length / 8);
  bits.forEach((bit, i) => { codewords[i >>> 3] |= bit << (7 - (i & 7)); });
  return codewords;
}

/** Split into blocks, add error correction to each, then interleave as the spec says. */
function withErrorCorrection(data, version, ecc) {
  const blockCount = BLOCKS[ecc][version];
  const eccLen = ECC_PER_BLOCK[ecc][version];
  const total = totalCodewords(version);
  const shortBlocks = blockCount - total % blockCount;
  const shortLen = Math.floor(total / blockCount) - eccLen;
  const divisor = rsDivisor(eccLen);

  const dataBlocks = [], eccBlocks = [];
  for (let i = 0, at = 0; i < blockCount; i++) {
    const len = shortLen + (i < shortBlocks ? 0 : 1);
    const block = data.subarray(at, at + len);
    at += len;
    dataBlocks.push(block);
    eccBlocks.push(rsRemainder(block, divisor));
  }

  const result = [];
  for (let i = 0; i < shortLen + 1; i++) {
    for (let b = 0; b < blockCount; b++) {
      if (i < shortLen || b >= shortBlocks) result.push(dataBlocks[b][i]);   // the long blocks' last byte comes after every short block
    }
  }
  for (let i = 0; i < eccLen; i++) for (let b = 0; b < blockCount; b++) result.push(eccBlocks[b][i]);
  return Uint8Array.from(result);
}

// -- the grid ---------------------------------------------------------------------------

class Grid {
  constructor(version) {
    this.version = version;
    this.size = version * 4 + 17;
    this.modules = Array.from({ length: this.size }, () => new Array(this.size).fill(false));
    this.reserved = Array.from({ length: this.size }, () => new Array(this.size).fill(false));
  }

  set(x, y, dark, reserved = true) {
    this.modules[y][x] = dark;
    if (reserved) this.reserved[y][x] = true;
  }

  /** Finder: a 7×7 ring, plus the separator that keeps it apart from the data. */
  finder(cx, cy) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= this.size || y >= this.size) continue;
        const ring = Math.max(Math.abs(dx), Math.abs(dy));
        this.set(x, y, ring !== 2 && ring !== 4);
      }
    }
  }

  alignment(cx, cy) {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) this.set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }

  functionPatterns() {
    for (let i = 0; i < this.size; i++) {          // timing
      this.set(6, i, i % 2 === 0);
      this.set(i, 6, i % 2 === 0);
    }
    this.finder(3, 3);
    this.finder(this.size - 4, 3);
    this.finder(3, this.size - 4);

    const positions = alignmentPositions(this.version);
    const last = positions.length - 1;
    for (let i = 0; i <= last; i++) {
      for (let j = 0; j <= last; j++) {
        const corner = (i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0);
        if (!corner) this.alignment(positions[i], positions[j]);
      }
    }

    for (let i = 0; i < 9; i++) {                  // format information, filled in later
      if (i === 6) continue;                       // that module belongs to the timing pattern
      this.set(i, 8, false);
      this.set(8, i, false);
    }
    for (let i = 0; i < 8; i++) {
      this.set(this.size - 1 - i, 8, false);
      this.set(8, this.size - 1 - i, false);
    }
    this.set(8, this.size - 8, true);              // the module that is always dark

    if (this.version >= 7) {
      const bits = bch(this.version, 0x1f25, 12) | (this.version << 12);
      for (let i = 0; i < 18; i++) {
        const dark = ((bits >>> i) & 1) === 1;
        const a = Math.floor(i / 3), b = i % 3 + this.size - 11;
        this.set(a, b, dark);
        this.set(b, a, dark);
      }
    }
  }

  formatBits(ecc, mask) {
    const data = (FORMAT_BITS[ecc] << 3) | mask;
    const bits = ((data << 10) | bch(data, 0x537, 10)) ^ 0x5412;
    const at = (i) => ((bits >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) this.set(8, i, at(i));
    this.set(8, 7, at(6));
    this.set(8, 8, at(7));
    this.set(7, 8, at(8));
    for (let i = 9; i < 15; i++) this.set(14 - i, 8, at(i));
    for (let i = 0; i < 8; i++) this.set(this.size - 1 - i, 8, at(i));
    for (let i = 8; i < 15; i++) this.set(8, this.size - 15 + i, at(i));
  }

  /** Two columns at a time, upwards then downwards, skipping the timing column. */
  placeData(codewords) {
    let bit = 0;
    for (let right = this.size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let step = 0; step < this.size; step++) {
        for (let c = 0; c < 2; c++) {
          const x = right - c;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? this.size - 1 - step : step;
          if (this.reserved[y][x]) continue;
          const dark = bit < codewords.length * 8 && ((codewords[bit >>> 3] >>> (7 - (bit & 7))) & 1) === 1;
          this.modules[y][x] = dark;
          bit++;
        }
      }
    }
  }

  applyMask(mask) {
    const rule = MASKS[mask];
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        if (!this.reserved[y][x] && rule(x, y)) this.modules[y][x] = !this.modules[y][x];
      }
    }
  }

  /** The spec's four penalties; the lowest-scoring mask is the one to use. */
  penalty() {
    const n = this.size;
    const at = (line, i, horizontal) => (horizontal ? this.modules[line][i] : this.modules[i][line]);
    let score = 0;

    // 1. A run of five or more of one colour costs 3, and one more per module.
    for (let line = 0; line < n; line++) {
      for (const horizontal of [true, false]) {
        let run = 1;
        for (let i = 1; i <= n; i++) {
          if (i < n && at(line, i, horizontal) === at(line, i - 1, horizontal)) run++;
          else { if (run >= 5) score += run - 2; run = 1; }
        }
      }
    }

    // 2. Every 2×2 block of one colour costs 3.
    for (let y = 0; y < n - 1; y++) {
      for (let x = 0; x < n - 1; x++) {
        const colour = this.modules[y][x];
        if (colour === this.modules[y][x + 1] && colour === this.modules[y + 1][x] && colour === this.modules[y + 1][x + 1]) score += 3;
      }
    }

    // 3. Anything a scanner could mistake for a finder pattern costs 40: the
    //    1:1:3:1:1 run with four light modules on one side of it. Outside the
    //    symbol counts as light, so a pattern against the edge counts too.
    const light = (line, i, horizontal) => (i < 0 || i >= n ? true : !at(line, i, horizontal));
    for (let line = 0; line < n; line++) {
      for (let i = 0; i + 7 <= n; i++) {
        for (const horizontal of [true, false]) {
          if (!FINDER_RUN.every((dark, j) => at(line, i + j, horizontal) === dark)) continue;
          const before = [1, 2, 3, 4].every((d) => light(line, i - d, horizontal));
          const after = [0, 1, 2, 3].every((d) => light(line, i + 7 + d, horizontal));
          if (before || after) score += 40;
        }
      }
    }

    // 4. Ten more for every 5% the code strays from half dark.
    let dark = 0;
    for (const row of this.modules) for (const cell of row) if (cell) dark++;
    score += Math.floor(Math.abs((dark * 100) / (n * n) - 50) / 5) * 10;
    return score;
  }
}

// The 1:1:3:1:1 run itself: dark, light, three dark, light, dark.
const FINDER_RUN = [true, false, true, true, true, false, true];

const MASKS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x, y) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => (x * y) % 2 + (x * y) % 3 === 0,
  (x, y) => ((x * y) % 2 + (x * y) % 3) % 2 === 0,
  (x, y) => ((x + y) % 2 + (x * y) % 3) % 2 === 0,
];

/** Bose–Chaudhuri–Hocquenghem remainder, for the format and version blocks. */
function bch(data, generator, degree) {
  let remainder = data;
  for (let i = 0; i < degree; i++) remainder = (remainder << 1) ^ ((remainder >>> (degree - 1)) * generator);
  return remainder & ((1 << degree) - 1);
}

// -- what a caller sees ------------------------------------------------------------------

/**
 * The matrix for `text`: { version, size, modules } with modules[y][x] true where
 * the code is dark. Throws when the text is longer than a version-40 code holds.
 */
export function qrMatrix(text, { ecc = 'M', minVersion = 1, maxVersion = 40, mask = null } = {}) {
  const bytes = typeof text === 'string' ? new TextEncoder().encode(text) : text;
  let version = minVersion;
  for (; version <= maxVersion; version++) {
    const countBits = version < 10 ? 8 : 16;
    if (4 + countBits + bytes.length * 8 <= dataCodewords(version, ecc) * 8) break;
  }
  if (version > maxVersion) throw new Error(`qr: ${bytes.length} bytes do not fit a version ${maxVersion} code`);

  const codewords = withErrorCorrection(toCodewords(bytes, version, ecc), version, ecc);
  const grid = new Grid(version);
  grid.functionPatterns();
  grid.placeData(codewords);

  let chosen = mask;
  if (chosen === null) {
    let bestScore = Infinity;
    for (let candidate = 0; candidate < 8; candidate++) {
      grid.formatBits(ecc, candidate);
      grid.applyMask(candidate);
      const score = grid.penalty();
      if (score < bestScore) { bestScore = score; chosen = candidate; }
      grid.applyMask(candidate);      // masking twice puts it back
    }
  }
  grid.formatBits(ecc, chosen);
  grid.applyMask(chosen);
  return { version, size: grid.size, mask: chosen, modules: grid.modules };
}

/** The same code as an <svg>: dark on white, whatever the page's theme is. */
export function qrSvg(text, { size = 256, ecc = 'M', quiet = 4 } = {}) {
  const code = qrMatrix(text, { ecc });
  const side = code.size + quiet * 2;
  let path = '';
  for (let y = 0; y < code.size; y++) {
    for (let x = 0; x < code.size; x++) if (code.modules[y][x]) path += `M${x + quiet} ${y + quiet}h1v1h-1z`;
  }
  return svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${side} ${side}" width="${size}" height="${size}" shape-rendering="crispEdges" role="img" aria-label="QR code">
    <rect width="${side}" height="${side}" fill="#ffffff"></rect><path d="${path}" fill="#000000"></path></svg>`);
}
