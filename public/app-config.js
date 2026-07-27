const runtime = globalThis.MAUCAFE_CONFIG ?? {};
const ENDPOINT_KEY = 'maucafe-api-base-url';

export const isNativeApp = runtime.buildTarget === 'android';

function normalizeBaseUrl(value) {
  return String(value ?? '').trim().replace(/\/+$/, '');
}

export function getApiBaseUrl() {
  const configured = normalizeBaseUrl(runtime.apiBaseUrl);
  if (configured) return configured;
  return isNativeApp ? normalizeBaseUrl(localStorage.getItem(ENDPOINT_KEY)) : '';
}

export function setApiBaseUrl(value) {
  const url = new URL(normalizeBaseUrl(value));
  if (isNativeApp && url.protocol !== 'https:') throw new Error('Alamat server APK wajib memakai HTTPS');
  const normalized = url.origin + url.pathname.replace(/\/+$/, '');
  localStorage.setItem(ENDPOINT_KEY, normalized);
  return normalized;
}

export function apiUrl(path) {
  const baseUrl = getApiBaseUrl();
  if (isNativeApp && !baseUrl) throw new Error('Alamat server belum diatur');
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

export function resourceUrl(path) {
  if (!path || /^(data:|blob:|https?:)/i.test(path)) return path;
  return apiUrl(path);
}

export function outletFromLocation(fallback = 'maucafe-alunalun') {
  const queryOutlet = new URLSearchParams(window.location.search).get('outlet');
  if (queryOutlet) return queryOutlet;
  return window.location.pathname.match(/\/outlet\/([^/]+)/)?.[1] ?? fallback;
}
