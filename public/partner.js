import { apiDownload, apiRequest } from './api-client.js';
import { isNativeApp } from './app-config.js';
import { clearNativeSession, getNativeSession, setNativeSession } from './native-session.js';
import { setupNativeShell } from './native-shell.js';

const $ = (selector) => document.querySelector(selector);
const rupiah = (value) => new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
}).format(Number(value) || 0);
let dashboard = null;
let selectedOutletId = '';

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function selectedOutlet() {
  return dashboard?.outlets?.find((outlet) => outlet.id === selectedOutletId) ?? null;
}

function showError(message) {
  const node = $('#partner-error');
  node.textContent = message;
  node.hidden = false;
}

function clearError() {
  $('#partner-error').hidden = true;
}

function toast(message) {
  const node = $('#partner-toast');
  node.textContent = message;
  node.hidden = false;
  window.setTimeout(() => { node.hidden = true; }, 2400);
}

async function request(path, options = {}) {
  clearError();
  try {
    return await apiRequest(path, options);
  } catch (error) {
    if (error.status === 401) {
      clearNativeSession();
      $('#partner-dashboard').hidden = true;
      $('#partner-login').hidden = false;
    }
    showError(error.message);
    throw error;
  }
}

function renderOutlets() {
  const select = $('#partner-outlet-select');
  select.replaceChildren();
  for (const outlet of dashboard.outlets) {
    const option = element('option', '', `${outlet.name} · ${outlet.status === 'active' ? 'Aktif' : 'Menunggu approval'}`);
    option.value = outlet.id;
    option.disabled = outlet.status !== 'active';
    select.append(option);
  }
  const activeOutlets = dashboard.outlets.filter((outlet) => outlet.status === 'active');
  if (!activeOutlets.some((outlet) => outlet.id === selectedOutletId)) {
    selectedOutletId = activeOutlets[0]?.id ?? '';
  }
  select.value = selectedOutletId;

  const list = $('#partner-outlet-list');
  list.replaceChildren();
  for (const outlet of dashboard.outlets) {
    const row = element('article', 'partner-list-item');
    const info = element('div');
    info.append(element('strong', '', outlet.name), element('small', '', outlet.address));
    row.append(info, element('span', 'status-pill', outlet.status === 'active' ? 'Aktif' : 'Menunggu Owner'));
    list.append(row);
  }
}

function renderMetrics() {
  const outlet = selectedOutlet();
  const summary = dashboard.summary;
  $('#partner-summary-title').textContent = `Ringkasan Gabungan ${summary?.outletCount ?? 0} Outlet Aktif`;
  $('#partner-revenue').textContent = rupiah(summary?.revenue);
  $('#partner-received').textContent = rupiah(summary?.received);
  $('#partner-gross-profit').textContent = rupiah(summary?.grossProfit);
  $('#partner-expenses').textContent = rupiah(summary?.operatingExpenses);
  $('#partner-net-profit').textContent = rupiah(summary?.netProfit);
  $('#partner-cup-balance').textContent = String(summary?.inventory?.balance ?? 0);
  const shiftStatus = $('#partner-current-shift');
  shiftStatus.replaceChildren();
  if (outlet?.currentShift) {
    shiftStatus.append(
      element('strong', '', outlet.currentShift.label),
      element('span', '', `Kasir: ${outlet.currentShift.employeeName}`),
      element('span', '', `Saldo awal: ${rupiah(outlet.currentShift.openingCash)}`),
    );
  } else {
    shiftStatus.append(element('span', '', 'Belum ada shift aktif.'));
  }
  $('#partner-force-close-form').hidden = !outlet?.currentShift;
}

function renderEmployees() {
  const list = $('#partner-employee-list');
  list.replaceChildren();
  const employees = (dashboard.employees ?? []).filter((user) => (
    !selectedOutletId || user.outletIds.includes(selectedOutletId)
  ));
  if (!employees.length) list.append(element('p', 'empty-state', 'Belum ada karyawan untuk outlet ini.'));
  for (const user of employees) {
    const row = element('article', 'partner-list-item');
    const info = element('div');
    info.append(element('strong', '', user.name), element('small', '', `@${user.username}`));
    const reset = element('button', 'ghost small-btn', 'Reset PIN');
    const toggle = element('button', user.active ? 'danger-btn small-btn' : 'primary small-btn', user.active ? 'Nonaktifkan' : 'Aktifkan');
    reset.type = toggle.type = 'button';
    reset.addEventListener('click', async () => {
      const pin = window.prompt(`PIN baru untuk ${user.name} (4-8 angka)`);
      if (!pin) return;
      await request(`/api/partner/employees/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ pin }),
      });
      toast('PIN karyawan diperbarui');
      await loadDashboard();
    });
    toggle.addEventListener('click', async () => {
      await request(`/api/partner/employees/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !user.active }),
      });
      toast('Status karyawan diperbarui');
      await loadDashboard();
    });
    row.append(info, reset, toggle);
    list.append(row);
  }
}

function renderMedia() {
  const list = $('#partner-media-list');
  list.replaceChildren();
  const items = selectedOutlet()?.mediaPlaylist ?? [];
  if (!items.length) list.append(element('p', 'empty-state', 'Playlist kosong.'));
  items.forEach((item, index) => {
    const row = element('article', 'partner-list-item');
    const info = element('div');
    info.append(
      element('strong', '', `${index + 1}. ${item.filename}`),
      element('small', '', item.type === 'video' ? `${item.durationSeconds} detik` : `${item.imageDurationSeconds} detik`),
    );
    const remove = element('button', 'danger-btn small-btn', 'Hapus');
    remove.type = 'button';
    remove.addEventListener('click', async () => {
      await request(`/api/outlet/${selectedOutletId}/media/playlist/${item.id}`, { method: 'DELETE' });
      toast('Media dihapus');
      await loadDashboard();
    });
    row.append(info, remove);
    list.append(row);
  });
}

function render() {
  $('#partner-name').textContent = dashboard.partner.name;
  $('#partner-connection').textContent = 'Terhubung';
  $('#partner-connection').className = 'connection online';
  renderOutlets();
  renderMetrics();
  renderEmployees();
  renderMedia();
}

async function loadDashboard() {
  dashboard = await request('/api/partner/dashboard');
  $('#partner-login').hidden = true;
  $('#partner-dashboard').hidden = false;
  render();
}

$('#partner-login-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const errorNode = $('#partner-login-error');
  errorNode.hidden = true;
  try {
    const payload = await apiRequest(isNativeApp ? '/api/native/partner/login' : '/api/partner/login', {
      method: 'POST',
      body: JSON.stringify({
        username: $('#partner-username').value.trim(),
        pin: $('#partner-pin').value,
      }),
    });
    if (isNativeApp) setNativeSession(payload);
    await loadDashboard();
  } catch (error) {
    errorNode.textContent = error.message;
    errorNode.hidden = false;
  }
});

$('#partner-logout')?.addEventListener('click', async () => {
  await apiRequest(isNativeApp ? '/api/native/logout' : '/api/partner/logout', { method: 'POST', body: '{}' }).catch(() => {});
  clearNativeSession();
  dashboard = null;
  $('#partner-dashboard').hidden = true;
  $('#partner-login').hidden = false;
});

$('#partner-outlet-select')?.addEventListener('change', (event) => {
  selectedOutletId = event.target.value;
  renderMetrics();
  renderEmployees();
  renderMedia();
});
$('#partner-refresh')?.addEventListener('click', () => loadDashboard().catch(() => {}));

document.querySelectorAll('.partner-tab').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.partner-tab, .partner-panel').forEach((node) => node.classList.remove('active'));
    button.classList.add('active');
    $(`#${button.dataset.tab}`).classList.add('active');
  });
});

$('#partner-employee-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!selectedOutletId) return showError('Belum ada outlet aktif.');
  await request('/api/partner/employees', {
    method: 'POST',
    body: JSON.stringify({
      outletId: selectedOutletId,
      name: $('#employee-name').value.trim(),
      username: $('#employee-username').value.trim(),
      pin: $('#employee-pin').value,
    }),
  });
  event.currentTarget.reset();
  toast('Karyawan dibuat');
  await loadDashboard();
});

$('#partner-outlet-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  await request('/api/partner/outlets', {
    method: 'POST',
    body: JSON.stringify({
      name: $('#proposal-name').value.trim(),
      address: $('#proposal-address').value.trim(),
    }),
  });
  event.currentTarget.reset();
  toast('Pengajuan outlet dikirim ke Owner');
  await loadDashboard();
});

$('#partner-operation-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const shift = selectedOutlet()?.currentShift;
  if (!shift) return showError('Belum ada shift aktif.');
  await request(`/api/outlet/${selectedOutletId}/operations`, {
    method: 'POST',
    body: JSON.stringify({
      shiftId: shift.id,
      type: $('#partner-operation-type').value,
      amount: Number($('#partner-operation-amount').value),
      category: $('#partner-operation-category').value.trim(),
      note: $('#partner-operation-note').value.trim(),
    }),
  });
  event.currentTarget.reset();
  toast('Catatan operasional tersimpan');
  await loadDashboard();
});

$('#partner-inventory-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  await request(`/api/outlet/${selectedOutletId}/inventory`, {
    method: 'POST',
    body: JSON.stringify({
      shiftId: selectedOutlet()?.currentShift?.id ?? null,
      type: $('#partner-inventory-type').value,
      quantity: Number($('#partner-inventory-quantity').value),
      reason: $('#partner-inventory-reason').value.trim(),
    }),
  });
  event.currentTarget.reset();
  toast('Pergerakan cup tersimpan');
  await loadDashboard();
});

$('#partner-force-close-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const shift = selectedOutlet()?.currentShift;
  if (!shift) return;
  await request(`/api/outlet/${selectedOutletId}/shifts/${shift.id}/close`, {
    method: 'POST',
    body: JSON.stringify({
      actualCash: Number($('#partner-actual-cash').value),
      reason: $('#partner-close-reason').value.trim(),
    }),
  });
  event.currentTarget.reset();
  toast('Shift ditutup paksa dan diaudit');
  await loadDashboard();
});

$('#partner-media-form')?.addEventListener('submit', (event) => {
  event.preventDefault();
  const file = $('#partner-media-file').files?.[0];
  if (!file) return;
  if (file.size > 25 * 1024 * 1024) return showError('Media maksimal 25MB.');
  const reader = new FileReader();
  reader.onload = async () => {
    await request(`/api/outlet/${selectedOutletId}/media/upload`, {
      method: 'POST',
      body: JSON.stringify({
        filename: file.name,
        dataUrl: reader.result,
        fit: $('#partner-media-fit').value,
        imageDurationSeconds: Number($('#partner-image-duration').value),
      }),
    });
    event.currentTarget.reset();
    toast('Media masuk playlist');
    await loadDashboard();
  };
  reader.onerror = () => showError('File gagal dibaca.');
  reader.readAsDataURL(file);
});

$('#partner-export')?.addEventListener('click', async () => {
  if (!selectedOutletId) return;
  const date = selectedOutlet()?.businessDate;
  await apiDownload(
    `/api/partner/outlets/${selectedOutletId}/export-sales?date=${encodeURIComponent(date)}`,
    `Laporan_Mitra_${selectedOutletId}.xls`,
  );
});

setupNativeShell({ root: true });
window.addEventListener('maucafe:resume', () => loadDashboard().catch(() => {}));

async function restoreSession() {
  if (isNativeApp && !getNativeSession()?.token) return;
  const session = await apiRequest('/api/partner/session');
  if (session.authenticated) await loadDashboard();
}

restoreSession().catch((error) => {
  $('#partner-login-error').textContent = error.message;
  $('#partner-login-error').hidden = false;
});
