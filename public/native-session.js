import { isNativeApp } from './app-config.js';

const SESSION_KEY = 'maucafe-native-session';

export function getNativeSession() {
  if (!isNativeApp) return null;
  try {
    const session = JSON.parse(sessionStorage.getItem(SESSION_KEY));
    if (!session?.token || !session?.expiresAt || new Date(session.expiresAt).getTime() <= Date.now()) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function setNativeSession(session) {
  if (!isNativeApp) return;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({
    token: session.token,
    expiresAt: session.expiresAt,
    role: session.role,
    outletId: session.outlet?.id ?? null,
  }));
}

export function clearNativeSession() {
  if (isNativeApp) sessionStorage.removeItem(SESSION_KEY);
}
