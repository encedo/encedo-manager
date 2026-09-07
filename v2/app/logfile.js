// Reading an audit-log file: the module writes one line per event, and this
// turns those lines into something a page can show. Nothing here talks to the
// device and nothing verifies — verification is verifyLog() in the SDK, and it
// works on the same text this parses.
//
// A line is seven fields:
//
//   <counter hex>|<epoch hex>|<type hex>|<result>|<subject>|<extra>|<mac>
//
// The first line of every file is a key line (type 0, result 0) whose subject
// field is the nonce that seals the rest of the file and whose extra field is
// that nonce's signature. Comment lines start with '#'.

import { bytesToHex, bytesToB64, asciiText } from './session.js';

/** The module's event table: what each type means, and what its extra field holds. */
export const EVENTS = [
  ['Log integrity key created'],
  ['System powered up'],
  ['System rebooted'],
  ['System shut down'],
  ['Firmware or Manager upgraded'],
  ['Entropy test failed'],
  ['TLS connection error (%)', 'error'],
  ['Self-test passed'],
  ['Entered a not-secure state'],
  ['Log files listed'],
  ['Log file deleted'],
  ['Log file read', 'bytes'],
  ['Scope check failed for %', 'text'],
  ['Token issued, password auth, for %', 'text'],
  ['Token issued, phone auth, for %', 'text'],
  ['Phone paired (%)', 'kid'],
  [null], [null],
  ['Configuration updated'],
  ['Clock set to %', 'time'],
  ['Key generated (%)', 'kid'],
  ['Key deleted (%)', 'kid'],
  ['Public key imported (%)', 'kid'],
  ['Key token issued (%)', 'kid'],
  ['Key integrity check', 'bytes'],
  ['Key label or description changed (%)', 'kid'],
  ['Key derived (%)', 'kid'],
  [null], [null],
  ['Device personalised'],
  ['Hash computed (%)', 'kid'],
  ['Hash verified (%)', 'kid'],
  ['Signature created (%)', 'kid'],
  ['Signature verified (%)', 'kid'],
  ['Key wrapped (%)', 'kid'],
  ['Key unwrapped (%)', 'kid'],
  ['Data encrypted (%)', 'kid'],
  ['Data decrypted (%)', 'kid'],
  ['Shared secret agreed (%)', 'kid'],
];

/** The module records how an operation ended, in three words. */
export const RESULTS = ['ok', 'refused', 'failed'];

const bytesFromB64url = (field) => {
  try {
    return Uint8Array.from(atob(String(field).replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
  } catch {
    return new Uint8Array(0);
  }
};
// No module has a real clock reading below this (2001-09-09), so a smaller
// number in the time field is not a time: it is seconds since the module
// started, written before anything told it what the date was.
const CLOCK_FLOOR = 1_000_000_000;

const epochFrom = (hex) => {
  const seconds = parseInt(hex, 16);
  return Number.isFinite(seconds) && seconds >= CLOCK_FLOOR ? new Date(seconds * 1000) : null;
};

/**
 * When an entry was written. A file is named after the epoch it was created,
 * which the module works out once the clock is set by subtracting its uptime —
 * so an entry from before the clock was set still has a real time: the file's
 * own start plus the uptime that entry carries. That time is computed rather
 * than recorded, and says so (`derived`), because it is only as good as the
 * moment the clock was finally set.
 */
function readStamp(hex, bootEpoch) {
  const value = parseInt(hex, 16);
  if (!Number.isFinite(value)) return { at: null, derived: false, uptime: null };
  if (value >= CLOCK_FLOOR) return { at: new Date(value * 1000), derived: false, uptime: null };
  if (bootEpoch) return { at: new Date((bootEpoch + value) * 1000), derived: true, uptime: value };
  return { at: null, derived: false, uptime: value };
}

/** Who the entry is about: the user, the master secret, or one key by its id. */
function readSubject(field, type) {
  if (field === 'U') return { kind: 'user', text: 'User' };
  if (field === 'M') return { kind: 'master', text: 'Master' };
  if (field && field.length > 2 && type > 0) {
    const kid = bytesToHex(bytesFromB64url(field));
    return { kind: 'key', kid, text: kid };
  }
  return null;
}

/**
 * The extra field, read the way this event type says it should be — and never
 * as text unless every byte of it is text. Real modules put an mbedTLS error
 * code in one of these and a slice of an HTTP header in another; running a
 * decoder over those produces something that looks like a message and is not.
 * Whatever it holds, the bytes stay available as base64 and hex.
 */
function readExtra(field, kind) {
  if (!kind || !field) return null;
  const bytes = bytesFromB64url(field);
  const raw = { b64: bytesToB64(bytes), hex: bytesToHex(bytes) };

  if (kind === 'kid') {
    const kid = bytesToHex(bytes);
    return { kind, kid, text: kid, ...raw };
  }
  if (kind === 'time') {
    const seconds = readUint32(bytes);
    const at = new Date(seconds * 1000);
    return { kind, at, text: at.toISOString().slice(0, 19).replace('T', ' '), ...raw };
  }
  if (kind === 'error') {
    const code = readUint32(bytes) | 0;              // the module writes them signed
    return { kind, code, text: String(code), ...raw };
  }
  if (kind === 'text') {
    const text = asciiText(bytes);                   // null the moment a byte is not printable
    return text === null ? { kind: 'bytes', ...raw } : { kind, text, ...raw };
  }
  return { kind: 'bytes', ...raw };
}

/** Four bytes, least significant first — how the module writes a number. */
const readUint32 = (bytes) => (bytes[0] ?? 0) + (bytes[1] ?? 0) * 256 + (bytes[2] ?? 0) * 65536 + (bytes[3] ?? 0) * 16777216;

/**
 * One line, or null when it is a comment or too short to be an entry.
 * `bootEpoch` is the file's own id as a number, which dates the entries that
 * were written before the clock was set.
 */
export function parseLogLine(line, bootEpoch = null) {
  if (!line || line[0] === '#' || line.length < 3) return null;
  const f = line.split('|');
  if (f.length < 6) return null;

  const no = parseInt(f[0], 16);
  const type = parseInt(f[2], 16);
  const result = Number(f[3]);
  const keyLine = type === 0 && result === 0;
  const [text, extraKind] = EVENTS[type] ?? [];

  const subject = keyLine ? null : readSubject(f[4], type);
  const extra = keyLine ? null : readExtra(f[5], extraKind);
  // An operation the module refused carries no key and no code, so the name is
  // left as it is rather than padded with a parenthetical about nothing.
  const event = !text ? `Event type ${type}`
    : extra?.text ? text.replace('%', extra.text)
    : text.replace(/\s*\(%\)/, '').replace(' %', '').replace('%', '—');

  const when = readStamp(f[1], bootEpoch);
  return {
    no,
    at: when.at,
    derived: when.derived,          // computed from the file's start, not recorded
    uptime: when.uptime,
    type,
    result: RESULTS[result] ?? `result ${result}`,
    ok: result === 0,
    event: keyLine ? 'Log integrity key created' : event,
    subject,
    extra,
    keyLine,
    raw: line,
  };
}

/**
 * Every entry in a file, in the order the module wrote them. Pass the file's id
 * and the entries from before the clock was set get their times worked out.
 */
export function parseLogFile(text, fileId = null) {
  const bootEpoch = fileId ? parseInt(fileId, 16) : null;
  const entries = [];
  for (const line of String(text ?? '').split('\n')) {
    const entry = parseLogLine(line, Number.isFinite(bootEpoch) ? bootEpoch : null);
    if (entry) entries.push(entry);
  }
  return entries;
}

/** The line a module writes at the top of every file: which firmware wrote it. */
export function logFileHeader(text) {
  const first = String(text ?? '').split('\n').find((line) => line.startsWith('#'));
  return first ? first.replace(/^#\s*/, '') : null;
}

/** What a file is called: its id is the hex epoch of the session that opened it. */
export function logFileTime(id) {
  return epochFrom(id);
}

/** Why a file failed to verify, in a sentence rather than a code. */
export function describeVerification(result) {
  if (!result) return 'Not read yet.';
  if (result.ok) return `${result.lines} entries verified.`;
  const where = result.line === undefined ? '' : ` at entry ${result.line}`;
  switch (result.reason) {
    case 'signature': return `The key line${where} is not signed by this module.`;
    case 'sequence': return `The counter jumps${where}: entries are missing.`;
    case 'no_key': return `There is no key line before entry ${result.line}.`;
    case 'hmac': return `Entry ${result.line} does not match its seal — it was changed after the module wrote it.`;
    default: return `Verification failed${where}.`;
  }
}
