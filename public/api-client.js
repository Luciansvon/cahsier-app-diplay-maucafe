import { apiUrl, isNativeApp } from './app-config.js';
import { getNativeSession } from './native-session.js';

export async function apiRequest(path, options = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), options.timeoutMs ?? 20_000);
  const session = getNativeSession();
  const headers = new Headers(options.headers);
  if (options.body !== undefined && !headers.has('content-type')) headers.set('content-type', 'application/json');
  if (session?.token) headers.set('authorization', `Bearer ${session.token}`);

  try {
    const response = await fetch(apiUrl(path), {
      ...options,
      headers,
      credentials: isNativeApp ? 'omit' : 'same-origin',
      cache: options.cache ?? 'no-store',
      signal: controller.signal,
    });
    const text = await response.text();
    const payload = text ? JSON.parse(text) : {};
    if (!response.ok) {
      const error = new Error(payload.error || 'Permintaan gagal');
      error.status = response.status;
      throw error;
    }
    return payload;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Server terlalu lama merespons');
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function apiDownload(path, fallbackName) {
  const session = getNativeSession();
  const headers = session?.token ? { authorization: `Bearer ${session.token}` } : {};
  const response = await fetch(apiUrl(path), {
    headers,
    credentials: isNativeApp ? 'omit' : 'same-origin',
  });
  if (!response.ok) throw new Error('Laporan gagal diunduh');
  const disposition = response.headers.get('content-disposition') ?? '';
  const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? fallbackName;
  const objectUrl = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
