import { isNativeApp } from './app-config.js';

let setupPromise;

function loadCapacitorCore() {
  if (globalThis.Capacitor?.registerPlugin) return Promise.resolve(globalThis.Capacitor);
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = './capacitor.js';
    script.onload = () => resolve(globalThis.Capacitor);
    script.onerror = () => reject(new Error('Bridge Android gagal dimuat'));
    document.head.append(script);
  });
}

export function setupNativeShell({ root = false } = {}) {
  if (!isNativeApp) return Promise.resolve();
  setupPromise ||= loadCapacitorCore().then(async (Capacitor) => {
    const App = Capacitor.registerPlugin('App');
    const Network = Capacitor.registerPlugin('Network');

    await App.addListener('backButton', async () => {
      if (root) await App.exitApp();
      else window.location.href = './index.html';
    });
    await App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) window.dispatchEvent(new Event('maucafe:resume'));
    });
    await Network.addListener('networkStatusChange', (status) => {
      window.dispatchEvent(new CustomEvent('maucafe:network', { detail: status }));
    });
  });
  return setupPromise;
}
