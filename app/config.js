// Where the module and the broker are.
//
// Served from the module itself, the Manager talks to its own origin. Served
// from anywhere else (a dev server, a laptop), it talks to https://my.ence.do,
// the name every PPA answers to on its USB network, unless told otherwise:
//   ?hem=https://192.168.7.1          the module
//   ?broker=http://localhost:8080/mockbroker   the broker (dev only)
// A value given once is remembered in this browser; ?hem= (empty) forgets it.
//   ?service=1   sign-in (password, 24 words) and personalisation over plain http
//                (DEV-532): a service mode for repairing a module's TLS, never
//                remembered - every visit that wants it asks for it again.

export const DEFAULT_HEM = 'https://my.ence.do';
export const DEFAULT_BROKER = 'https://api.encedo.com';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '0.0.0.0']);

export function resolveConfig(loc = globalThis.location, storage = safeStorage()) {
  const params = new URLSearchParams(loc?.search ?? '');
  const pick = (key, fallback) => {
    if (params.has(key)) {
      const v = params.get(key).trim();
      if (v) { storage.set(key, v); return v; }
      storage.remove(key);
      return fallback();
    }
    return storage.get(key) ?? fallback();
  };
  const hem = pick('hem', () => servedFromDevice(loc) ? loc.origin : DEFAULT_HEM);
  const broker = pick('broker', () => DEFAULT_BROKER);
  const service = params.get('service') === '1';   // DEV-532: not remembered
  return { hem: hem.replace(/\/+$/, ''), broker: broker.replace(/\/+$/, ''), servedFromDevice: servedFromDevice(loc), service };
}

/** A module URL on this machine: a mock or a dev server, where plain http is the only way. */
export function isLoopback(url) {
  try { return LOCAL_HOSTS.has(new URL(url).hostname); } catch { return false; }
}

export function servedFromDevice(loc = globalThis.location) {
  if (!loc || !/^https?:$/.test(loc.protocol)) return false;
  return !LOCAL_HOSTS.has(loc.hostname);
}

function safeStorage() {
  const ls = (() => { try { return globalThis.localStorage; } catch { return null; } })();
  const key = (k) => `manager.${k}`;
  return {
    get: (k) => { try { return ls?.getItem(key(k)) ?? null; } catch { return null; } },
    set: (k, v) => { try { ls?.setItem(key(k), v); } catch { /* private mode */ } },
    remove: (k) => { try { ls?.removeItem(key(k)); } catch { /* private mode */ } },
  };
}
