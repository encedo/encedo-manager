// The QR encoder against vectors from an independent implementation (segno,
// which was run once with its 7.4.10 padding corrected — it pads a whole extra
// zero byte when the bit stream already ends on a codeword boundary). Every
// matrix below is that encoder's, module for module, hashed.
//
//   node --test dev/qr.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { qrMatrix } from '../app/qr.js';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const filler = (n) => Array.from({ length: n }, (_, i) => ALPHABET[(i * 7 + 3) % 64]).join('');
const digest = (code) => createHash('sha256')
  .update(code.modules.map((row) => row.map((dark) => (dark ? '1' : '0')).join('')).join(''))
  .digest('hex');

const VECTORS = [
  { text: "D", ecc: 'L', mask: 0, version: 1, size: 21, sha256: '52174c0d25fcf33a8e6b29c0174d3275bc25c111aa09c51c2378d767b56524b0' },
  { text: "HELLO WORLD", ecc: 'M', mask: 3, version: 1, size: 21, sha256: 'da030348c4f3821c6d2429f59b748e89e2df099e0d627ed38a5ddb9d15b994bf' },
  { text: "https://my.ence.do/#/keychain", ecc: 'Q', mask: 5, version: 3, size: 29, sha256: '110bc50c572358d6b4c33c34d5a37d3ddc9abd1a9938ae1950babe591aaf8122' },
  { text: "zażółć gęślą jaźń", ecc: 'M', mask: 6, version: 2, size: 25, sha256: 'b2ee7e3c8b5e594f10469f99fc78f40bdaa98ce657c14ac576bd9de6409a67bb' },
  { text: filler(50), ecc: 'H', mask: 2, version: 6, size: 41, sha256: '59069ff15bcc9a43c44c7289465223271067f10971ac0bff364ee1d2e08c9ae7' },
  { text: filler(200), ecc: 'L', mask: 2, version: 9, size: 53, sha256: 'f8fa07fe6ca054ec0fffdf020f2c542cd54af9bfa87755d82fd6c57269581bb2' },
  { text: filler(300), ecc: 'M', mask: 7, version: 13, size: 69, sha256: '08e9b5cf756cd0db64c92eb19cda7cc325c72e2b9f1eb2d0304e262cac527aa5' },
  { text: filler(500), ecc: 'Q', mask: 4, version: 21, size: 101, sha256: '511df366aaed29501bfecaf5f769aebe35cf3a9371600047874ac2d688298c49' },
  { text: filler(800), ecc: 'H', mask: 1, version: 32, size: 145, sha256: '1cd663d43adcc1f4494325b57fef97a0d98b038c9f5fb57c0437e03e353f91ad' },
  { text: filler(1600), ecc: 'L', mask: 4, version: 29, size: 133, sha256: 'e394a468c6dc035e8ce561a893aa9e98ee7378143870840d234ff92953be6cc0' },
  { text: filler(2900), ecc: 'L', mask: 0, version: 40, size: 177, sha256: '0c437a41f448a33fad8d4a2639153fd8b022505a98db0f95c0b141f57104ebc9' },
];

test('every matrix matches the reference encoder, module for module', () => {
  for (const v of VECTORS) {
    const code = qrMatrix(v.text, { ecc: v.ecc, mask: v.mask });
    assert.equal(code.version, v.version, `version for ${v.ecc}/${v.text.length} bytes`);
    assert.equal(code.size, v.size);
    assert.equal(code.size, code.version * 4 + 17);
    assert.equal(digest(code), v.sha256, `matrix for ${v.ecc}/${v.text.length} bytes, mask ${v.mask}`);
  }
});

test('the chosen mask is one of the eight, and the matrix is that mask applied', () => {
  for (const text of ['D', filler(120), filler(700)]) {
    const auto = qrMatrix(text, { ecc: 'M' });
    assert.ok(auto.mask >= 0 && auto.mask < 8);
    assert.equal(digest(auto), digest(qrMatrix(text, { ecc: 'M', mask: auto.mask })));
  }
});

test('function patterns land where the spec puts them', () => {
  const { modules, size } = qrMatrix('anything', { ecc: 'L' });
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
    assert.equal(modules[cy][cx], true, 'the dark centre');
    assert.equal(modules[cy - 1][cx - 1], true, 'the 3x3 block around it');
    assert.equal(modules[cy - 2][cx - 2], false, 'the light ring');
    assert.equal(modules[cy - 3][cx - 3], true, 'the dark ring outside that');
  }
  for (let i = 8; i < size - 8; i++) {
    assert.equal(modules[6][i], i % 2 === 0, 'horizontal timing');
    assert.equal(modules[i][6], i % 2 === 0, 'vertical timing');
  }
  assert.equal(modules[size - 8][8], true, 'the module that is always dark');
});

test('too much text is refused rather than truncated', () => {
  assert.throws(() => qrMatrix(filler(3000), { ecc: 'L' }), /do not fit/);
  assert.throws(() => qrMatrix(filler(1300), { ecc: 'H' }), /do not fit/);
  assert.doesNotThrow(() => qrMatrix(filler(2900), { ecc: 'L' }));
});
