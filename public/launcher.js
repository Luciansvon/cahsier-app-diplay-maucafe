import { apiRequest } from './api-client.js';
import { getApiBaseUrl, isNativeApp, setApiBaseUrl } from './app-config.js';
import { setupNativeShell } from './native-shell.js';

const outletSelect = document.querySelector('#launcher-outlet');
const actions = document.querySelector('#launcher-actions');
const serverForm = document.querySelector('#server-form');
const status = document.querySelector('#launcher-status');

function setStatus(message, online = false) {
  status.textContent = message;
  status.className = `connection ${online ? 'online' : 'offline'}`;
}

async function loadOutlets() {
  try {
    const data = await apiRequest('/api/outlets');
    outletSelect.replaceChildren();
    for (const outlet of data.outlets) {
      const option = document.createElement('option');
      option.value = outlet.id;
      option.textContent = outlet.name;
      outletSelect.append(option);
    }
    outletSelect.value = localStorage.getItem('maucafe-last-outlet') || data.defaultOutletId;
    actions.hidden = false;
    serverForm.hidden = true;
    setStatus('Server terhubung', true);
  } catch (error) {
    actions.hidden = true;
    if (isNativeApp) serverForm.hidden = false;
    setStatus(error.message);
  }
}

serverForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    setApiBaseUrl(document.querySelector('#server-url').value);
    await loadOutlets();
  } catch (error) {
    setStatus(error.message);
  }
});

document.querySelector('#open-cashier')?.addEventListener('click', () => {
  const outletId = outletSelect.value;
  if (!outletId) return;
  localStorage.setItem('maucafe-last-outlet', outletId);
  window.location.href = `./admin.html?outlet=${encodeURIComponent(outletId)}`;
});

if (isNativeApp && getApiBaseUrl()) document.querySelector('#server-url').value = getApiBaseUrl();
setupNativeShell({ root: true });
window.addEventListener('maucafe:resume', loadOutlets);
window.addEventListener('maucafe:network', (event) => {
  if (event.detail.connected) loadOutlets();
  else setStatus('Perangkat sedang offline');
});
loadOutlets();
