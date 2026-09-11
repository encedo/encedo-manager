// Hash routes: #/drive, #/keychain ... The sidebar order is the menu order.

export const ROUTES = [
  { id: 'overview', path: '', label: 'Overview' },
  { id: 'keychain', path: 'keychain', label: 'Keychain' },
  { id: 'drive', path: 'drive', label: 'Secure drive' },
  { id: 'phones', path: 'phones', label: 'Paired phones' },
  { id: 'log', path: 'log', label: 'Operation log' },
  { id: 'hardware', path: 'hardware', label: 'Hardware' },
  { id: 'software', path: 'software', label: 'Software' },
  { id: 'settings', path: 'settings', label: 'Settings' },
];

export function currentRoute(hash = globalThis.location?.hash ?? '') {
  const path = hash.replace(/^#\/?/, '').split('?')[0];
  return ROUTES.find((r) => r.path === path) ?? ROUTES[0];
}

export const href = (route) => `#/${route.path}`;

export function onRouteChange(fn) {
  const handler = () => fn(currentRoute());
  globalThis.addEventListener('hashchange', handler);
  return () => globalThis.removeEventListener('hashchange', handler);
}
