import { apiDownload, apiRequest } from './api-client.js';
import { apiUrl, isNativeApp } from './app-config.js';
import { clearNativeSession, getNativeSession, setNativeSession } from './native-session.js';
import { setupNativeShell } from './native-shell.js';
import { summarizeSales } from './sales.js';

let outletsList = [];
let selectedOutletId = 'all'; // 'all' atau outletId spesifik
let multiSummaryData = null;
let franchiseData = null;
let state = { businessDate: null, products: [], orders: [], activeCall: null, promoMedia: null };
let allOutletsOrders = [];
let allOperationalEntries = [];
let selectedOutletName = 'Semua Outlet';
let reportDate = null;
let events = null;
let pollingTimer = null;
let isConnected = false;

const $ = (selector) => document.querySelector(selector);
const rupiah = (value) => new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
}).format(value);

function todayJakartaDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function formatTime(value) {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

function setConnection(online, updatedAt) {
  isConnected = online;
  const status = $('#connection-status');
  if (status) {
    status.textContent = online ? 'Terhubung' : 'Data belum diperbarui';
    status.className = `connection ${online ? 'online' : 'offline'}`;
  }
  updateMutatingButtons();
  if (updatedAt) {
    const timeEl = $('#owner-updated-at');
    if (timeEl) timeEl.textContent = `Pembaruan terakhir ${formatTime(updatedAt)} WIB`;
  }
}

function updateMutatingButtons() {
  document.querySelectorAll('.owner-mutating').forEach((button) => {
    if (button.id === 'clear-sales-owner') {
      const isTyped = $('#danger-confirmation')?.value === 'HAPUS';
      button.disabled = !isConnected || !isTyped;
    } else if (button.id === 'clear-all-outlets-sales-btn') {
      const isTyped = $('#global-danger-confirmation')?.value === 'HAPUS SEMUA';
      button.disabled = !isConnected || !isTyped;
    } else {
      button.disabled = !isConnected;
    }
  });
}

function showError(message) {
  const banner = $('#error-banner');
  if (banner) {
    banner.textContent = message;
    banner.hidden = false;
  }
}

function clearError() {
  const banner = $('#error-banner');
  if (banner) banner.hidden = true;
}

function toast(message) {
  const node = $('#success-toast');
  if (node) {
    node.textContent = message;
    node.hidden = false;
    window.setTimeout(() => { node.hidden = true; }, 2400);
  }
}

function openLogin(message = '') {
  events?.close();
  events = null;
  window.clearInterval(pollingTimer);
  pollingTimer = null;
  $('#owner-dashboard').hidden = true;
  if ($('#change-pin-modal')?.open) $('#change-pin-modal').close();
  if ($('#menu-mgmt-modal')?.open) $('#menu-mgmt-modal').close();
  $('#owner-login').hidden = false;
  $('#pin-input').value = '';
  const errEl = $('#pin-error');
  if (errEl) {
    errEl.textContent = message;
    errEl.hidden = !message;
  }
}

function openDashboard() {
  $('#owner-login').hidden = true;
  $('#owner-dashboard').hidden = false;
}

async function request(path, options = {}, lockOnUnauthorized = true) {
  try {
    return await apiRequest(path, options);
  } catch (error) {
    if (error.status === 401 && !path.endsWith('/owner/login') && lockOnUnauthorized) {
      clearNativeSession();
      openLogin('Sesi berakhir, masukkan PIN lagi.');
    }
    throw error;
  }
}

document.querySelectorAll('.owner-tab').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.owner-tab, .owner-panel').forEach((node) => node.classList.remove('active'));
    button.classList.add('active');
    const targetPanel = $(`#${button.dataset.tab}`);
    if (targetPanel) targetPanel.classList.add('active');

    if (button.dataset.tab === 'tab-reports') {
      renderReport();
    }
  });
});

async function loadMultiSummary() {
  try {
    const data = await request('/api/owner/multi-summary', {}, false);
    multiSummaryData = data;
    outletsList = data.summaries || [];
    populateGlobalOutletDropdown(data.summaries);
    renderMultiSummary(data);
    openDashboard();
    await loadFranchise();

    // Default tanggal laporan
    reportDate ||= todayJakartaDate();
    const dateInput = $('#report-date');
    if (dateInput) dateInput.value = reportDate;

    if (selectedOutletId === 'all') {
      await loadAllOutletsOrders();
    }

    setConnection(true, data.updatedAt);
  } catch (error) {
    if ($('#owner-dashboard').hidden) openLogin();
    else showError(error.message);
  }
}

async function loadFranchise() {
  franchiseData = await request('/api/owner/franchise', {}, false);
  renderFranchise();
}

function renderFranchise() {
  if (!franchiseData) return;
  const { registry, audit } = franchiseData;
  const partnerList = $('#owner-partner-list');
  partnerList?.replaceChildren();
  for (const partner of registry.partners) {
    const user = registry.users.find((candidate) => (
      candidate.role === 'partner' && candidate.partnerId === partner.id
    ));
    const row = element('article', 'franchise-row');
    const info = element('div');
    info.append(
      element('strong', '', partner.name),
      element('small', '', `${user ? `@${user.username}` : 'Akun belum ada'} · ${partner.outletIds.length} outlet`),
    );
    row.append(info, element('span', 'status-pill', partner.active === false ? 'Nonaktif' : 'Aktif'));
    partnerList?.append(row);
  }
  if (!registry.partners.length) partnerList?.append(element('p', 'empty-state', 'Belum ada Mitra.'));

  const outletList = $('#owner-franchise-outlet-list');
  outletList?.replaceChildren();
  for (const outlet of registry.outlets) {
    const row = element('article', 'franchise-row');
    const info = element('div');
    info.append(
      element('strong', '', outlet.name),
      element('small', '', `${outlet.address} · ${outlet.status === 'pending' ? 'Menunggu approval' : 'Aktif'}`),
    );
    const partnerSelect = element('select', 'outlet-dropdown');
    const empty = element('option', '', 'Belum ditugaskan');
    empty.value = '';
    partnerSelect.append(empty);
    for (const partner of registry.partners.filter((candidate) => candidate.active !== false)) {
      const option = element('option', '', partner.name);
      option.value = partner.id;
      partnerSelect.append(option);
    }
    partnerSelect.value = outlet.partnerId ?? '';
    const assign = element('button', 'ghost small-btn', 'Simpan Mitra');
    assign.type = 'button';
    assign.disabled = !partnerSelect.value;
    partnerSelect.addEventListener('change', () => { assign.disabled = !partnerSelect.value; });
    assign.addEventListener('click', async () => {
      await request(`/api/owner/outlets/${outlet.id}/assign`, {
        method: 'POST',
        body: JSON.stringify({ partnerId: partnerSelect.value }),
      });
      toast('Penugasan outlet disimpan');
      await loadFranchise();
    });
    row.append(info, partnerSelect, assign);
    if (outlet.status === 'pending') {
      const approve = element('button', 'primary small-btn', 'Setujui');
      approve.type = 'button';
      approve.addEventListener('click', async () => {
        await request(`/api/owner/outlets/${outlet.id}/approve`, { method: 'POST', body: '{}' });
        toast('Outlet disetujui dan langsung aktif');
        await loadMultiSummary();
      });
      row.append(approve);
    }
    outletList?.append(row);
  }

  const auditList = $('#owner-audit-list');
  auditList?.replaceChildren();
  for (const entry of audit.slice(0, 20)) {
    const row = element('article', 'franchise-row');
    const info = element('div');
    info.append(
      element('strong', '', entry.action),
      element('small', '', `${entry.actorType}:${entry.actorId}${entry.outletId ? ` · ${entry.outletId}` : ''}`),
    );
    row.append(info, element('time', '', formatTime(entry.createdAt)));
    auditList?.append(row);
  }
}

async function loadAllOutletsOrders() {
  try {
    const data = await request('/api/owner/all-orders', {}, false);
    allOutletsOrders = data.orders || [];
    allOperationalEntries = data.operationalEntries || [];
    renderReport();
  } catch (err) {
    showError(err.message || 'Gagal memuat pesanan semua outlet.');
  }
}

function populateGlobalOutletDropdown(summaries) {
  const dropdown = $('#global-outlet-select');
  if (dropdown) {
    dropdown.replaceChildren();

    const optAll = document.createElement('option');
    optAll.value = 'all';
    optAll.textContent = 'Semua Outlet (Ringkasan Gabungan)';
    dropdown.append(optAll);

    summaries.forEach((s) => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.name;
      dropdown.append(opt);
    });

    dropdown.value = selectedOutletId;
  }

  document.querySelectorAll('.section-outlet-select').forEach((secDropdown) => {
    secDropdown.replaceChildren();
    summaries.forEach((s) => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.name;
      secDropdown.append(opt);
    });
    if (selectedOutletId !== 'all') {
      secDropdown.value = selectedOutletId;
    } else if (summaries.length) {
      secDropdown.value = summaries[0].id;
    }
  });
}

$('#global-outlet-select')?.addEventListener('change', (e) => {
  const val = e.target.value;
  if (val === 'all') {
    showAllOutletsView();
  } else {
    selectOutlet(val);
  }
});

document.querySelectorAll('.section-outlet-select').forEach((secDropdown) => {
  secDropdown.addEventListener('change', (e) => {
    const val = e.target.value;
    if (val) {
      selectOutlet(val);
    }
  });
});

function renderMultiSummary(data) {
  const grandRev = $('#grand-revenue');
  const grandMar = $('#grand-margin');
  const grandNet = $('#grand-net-profit');
  const grandSales = $('#grand-sales-count');
  const grandActive = $('#grand-active-count');

  if (grandRev) grandRev.textContent = rupiah(data.grandTotals.received ?? data.grandTotals.revenue);
  if (grandMar) grandMar.textContent = rupiah(data.grandTotals.margin);
  if (grandNet) grandNet.textContent = rupiah(data.grandTotals.netProfit);
  if (grandSales) grandSales.textContent = String(data.grandTotals.salesCount);
  if (grandActive) grandActive.textContent = String(data.grandTotals.activeCount);

  const grid = $('#outlets-grid');
  if (!grid) return;
  grid.replaceChildren();

  data.summaries.forEach((summary) => {
    const card = element('article', 'card outlet-card');

    const top = element('div', 'outlet-card-header');
    top.append(element('h3', '', summary.name), element('span', 'outlet-address-tag', summary.address));

    const metrics = element('div', 'outlet-card-metrics');

    const m1 = element('div', 'outlet-card-metric');
    m1.append(element('span', '', 'Total Diterima'), element('strong', 'text-success', rupiah(summary.received ?? (summary.revenue + (summary.tax || 0)))));

    const m2 = element('div', 'outlet-card-metric');
    m2.append(element('span', '', 'Profit Bersih'), element('strong', 'text-profit', rupiah(summary.netProfit)));

    const m3 = element('div', 'outlet-card-metric');
    m3.append(element('span', '', 'Transaksi'), element('strong', '', String(summary.salesCount)));

    const m4 = element('div', 'outlet-card-metric');
    m4.append(element('span', '', 'Antrean Aktif'), element('strong', '', String(summary.activeCount)));

    metrics.append(m1, m2, m3, m4);

    const actions = element('div', 'outlet-card-actions');

    const detailBtn = element('button', 'primary small-btn', 'Lihat Laporan & Kelola');
    detailBtn.addEventListener('click', () => selectOutlet(summary.id));

    actions.append(detailBtn);

    card.append(top, metrics, actions);
    grid.append(card);
  });
}

async function selectOutlet(outletId) {
  selectedOutletId = outletId;
  document.querySelectorAll('#global-outlet-select, .section-outlet-select').forEach((d) => {
    d.value = outletId;
  });

  const targetInfo = outletsList.find((o) => o.id === outletId);
  selectedOutletName = targetInfo ? targetInfo.name : outletId;

  const badge = $('#active-outlet-badge');
  if (badge) badge.textContent = `Mode: ${selectedOutletName.toUpperCase()}`;

  // Update UI Elements
  $('#multi-summary-metrics').hidden = true;
  $('#outlets-grid-container').hidden = true;

  $('#single-summary-metrics').hidden = false;
  $('#single-recent-sales-container').hidden = false;

  // Dynamic Titles & Button Labels
  const title = $('#owner-header-title');
  if (title) title.textContent = `Panel ${selectedOutletName}`;
  const menuTitle = $('#menu-mgmt-modal-title');
  if (menuTitle) menuTitle.textContent = `Kelola Menu ${selectedOutletName}`;
  const dangerSingleTitle = $('#danger-single-title');
  if (dangerSingleTitle) dangerSingleTitle.textContent = `Perubahan Permanen - ${selectedOutletName}`;
  const dangerSingleConfirmLabel = $('#danger-single-confirm-label');
  if (dangerSingleConfirmLabel) dangerSingleConfirmLabel.textContent = `Ketik HAPUS untuk membuka tombol penghapusan ${selectedOutletName}`;
  const resetBtn = $('#reset-queue-owner');
  if (resetBtn) resetBtn.textContent = `Reset antrean ${selectedOutletName} ke 1`;
  const clearBtn = $('#clear-sales-owner');
  if (clearBtn) clearBtn.textContent = `Hapus penjualan ${selectedOutletName}`;

  await syncSingleOutletState();
}

function showAllOutletsView() {
  selectedOutletId = 'all';
  selectedOutletName = 'Semua Outlet';
  const dropdown = $('#global-outlet-select');
  if (dropdown) dropdown.value = 'all';

  const badge = $('#active-outlet-badge');
  if (badge) badge.textContent = 'Mode: SEMUA OUTLET (GABUNGAN)';

  $('#single-summary-metrics').hidden = true;
  $('#single-recent-sales-container').hidden = true;

  $('#multi-summary-metrics').hidden = false;
  $('#outlets-grid-container').hidden = false;

  const eyebrow = $('#owner-eyebrow-tag');
  const title = $('#owner-header-title');
  if (eyebrow) eyebrow.textContent = 'MAUCAFE MULTI-OUTLET';
  if (title) title.textContent = outletsList.length ? `Ringkasan ${outletsList.length} Outlet` : 'Ringkasan Semua Outlet';

  connectEvents();
  loadMultiSummary();
}

async function syncSingleOutletState(connectLive = true) {
  try {
    const payload = await request(`/api/outlet/${selectedOutletId}/owner/state`);
    state = payload.state;
    if (payload.outletInfo) {
      selectedOutletName = payload.outletInfo.name;
    }
    reportDate ||= state.businessDate || todayJakartaDate();
    const dateInput = $('#report-date');
    if (dateInput) dateInput.value = reportDate;

    renderSummary();
    renderReport();
    renderMediaStatus();
    renderTaxConfig();
    if ($('#menu-mgmt-modal')?.open) renderMenuMgmtList();
    if (connectLive) connectEvents();
    setConnection(true, payload.updatedAt);
  } catch (error) {
    showError(error.message);
  }
}

function renderMediaStatus() {
  const currentMediaNode = $('#owner-current-media');
  if (!currentMediaNode) return;
  const promoMedia = state.promoMedia;
  currentMediaNode.replaceChildren(document.createTextNode('Media aktif: '));
  const strong = element('strong');
  if (!promoMedia || !promoMedia.filename) {
    strong.textContent = 'Video Bawaan (promo.mp4)';
  } else {
    const typeLabel = promoMedia.type === 'image' ? 'Foto' : 'Video';
    strong.textContent = `${typeLabel} (${promoMedia.filename})`;
  }
  currentMediaNode.append(strong);
  const fitSelect = $('#owner-media-fit');
  if (fitSelect && promoMedia?.fit) fitSelect.value = promoMedia.fit;
  const playlistNode = $('#owner-media-playlist');
  if (!playlistNode) return;
  playlistNode.replaceChildren();
  const items = state.mediaPlaylist ?? [];
  if (!items.length) {
    playlistNode.append(element('p', 'empty-state', 'Playlist kosong. Video bawaan dipakai.'));
    return;
  }
  items.forEach((item, index) => {
    const row = element('div', 'media-playlist-item');
    row.append(element('span', '', String(index + 1)), element('strong', '', item.filename || item.url));
    const up = element('button', 'ghost small-btn', '↑');
    const down = element('button', 'ghost small-btn', '↓');
    const remove = element('button', 'danger-btn small-btn', 'Hapus');
    up.type = down.type = remove.type = 'button';
    up.disabled = index === 0;
    down.disabled = index === items.length - 1;
    const move = async (offset) => {
      const orderedIds = items.map((candidate) => candidate.id);
      [orderedIds[index], orderedIds[index + offset]] = [orderedIds[index + offset], orderedIds[index]];
      await request(`/api/outlet/${selectedOutletId}/media/playlist/order`, {
        method: 'PATCH',
        body: JSON.stringify({ orderedIds }),
      });
      await syncSingleOutletState();
    };
    up.addEventListener('click', () => move(-1).catch((error) => showError(error.message)));
    down.addEventListener('click', () => move(1).catch((error) => showError(error.message)));
    remove.addEventListener('click', async () => {
      try {
        await request(`/api/outlet/${selectedOutletId}/media/playlist/${item.id}`, { method: 'DELETE' });
        await syncSingleOutletState();
      } catch (error) {
        showError(error.message);
      }
    });
    row.append(up, down, remove);
    playlistNode.append(row);
  });
}

const statusLabel = {
  waiting: 'Dibayar',
  ready: 'Siap',
  completed: 'Selesai',
  cancelled: 'Batal',
};

function transactionRow(order) {
  const row = element('article', `sale-row ${order.status}`);
  const top = element('div', 'sale-top');
  const identity = element('div');

  const outletPrefix = order.outletName ? `[${order.outletName}] ` : '';
  identity.append(
    element('strong', 'sale-number', `${outletPrefix}#${order.queueNumber}`),
    element('small', '', formatTime(order.createdAt)),
  );
  top.append(identity, element('span', 'status-pill', statusLabel[order.status] ?? order.status));
  const items = element('p', 'sale-items', order.items.map((item) => `${item.quantity}× ${item.productName}`).join(', '));
  const meta = element('div', 'sale-meta');
  meta.append(
    element('span', '', order.paymentMethod === 'cash' ? 'Tunai' : 'QRIS'),
    element('strong', '', rupiah(order.total)),
  );
  row.append(top, items, meta);
  return row;
}

function renderSummary() {
  const summary = summarizeSales(state.orders, state.businessDate || todayJakartaDate(), {
    operationalEntries: state.operationalEntries ?? [],
  });
  $('#owner-revenue').textContent = rupiah(summary.revenue);
  if ($('#owner-received')) $('#owner-received').textContent = rupiah(summary.grandRevenue);
  $('#owner-cash').textContent = rupiah(summary.paymentTotals.cash);
  $('#owner-qris').textContent = rupiah(summary.paymentTotals.QRIS);
  $('#owner-cost').textContent = rupiah(summary.totalCost);
  $('#owner-margin').textContent = rupiah(summary.margin);
  $('#owner-operating-expenses').textContent = rupiah(summary.operatingExpenses);
  $('#owner-net-profit').textContent = rupiah(summary.netProfit);
  $('#owner-sales-count').textContent = String(summary.transactionCount);
  $('#owner-active-count').textContent = String((state.orders || []).filter((order) => ['waiting', 'ready'].includes(order.status)).length);

  const taxCard = $('#owner-tax-card');
  if (state.taxConfig?.enabled && taxCard) {
    taxCard.hidden = false;
    $('#owner-tax-label').textContent = (state.taxConfig.label || 'Pajak') + ' Terkumpul';
    $('#owner-tax').textContent = rupiah(summary.totalTax);
  } else if (taxCard) {
    taxCard.hidden = true;
  }

  const recent = $('#owner-recent-sales');
  if (recent) {
    recent.replaceChildren();
    const transactions = summary.transactions.slice(0, 3);
    if (!transactions.length) {
      recent.append(element('p', 'empty-state large', 'Belum ada transaksi hari ini.'));
    } else {
      transactions.forEach((order) => recent.append(transactionRow(order)));
    }
  }
}

async function exportExcel() {
  reportDate ||= todayJakartaDate();
  if (selectedOutletId === 'all') {
    const exportUrl = `/api/owner/export-sales-all?date=${encodeURIComponent(reportDate)}`;
    await apiDownload(exportUrl, `Laporan_Gabungan_${reportDate}.xls`);
    toast('Laporan gabungan berhasil diunduh.');
    return;
  }

  const summary = summarizeSales(state.orders, reportDate, {
    operationalEntries: state.operationalEntries ?? [],
  });
  if (!summary.products || !summary.products.length) {
    toast('Tidak ada data penjualan untuk diunduh pada tanggal ini.');
    return;
  }

  const exportUrl = `/api/outlet/${selectedOutletId}/owner/export-sales?date=${encodeURIComponent(reportDate)}`;
  await apiDownload(exportUrl, `Laporan_${selectedOutletId}_${reportDate}.xls`);
  toast(`Laporan ${selectedOutletName} berhasil diunduh.`);
}

async function handleExportExcel() {
  clearError();
  try {
    await exportExcel();
  } catch (error) {
    showError(error.message);
  }
}

function renderReport() {
  reportDate ||= todayJakartaDate();
  const dateInput = $('#report-date');
  if (dateInput && !dateInput.value) dateInput.value = reportDate;

  const ordersToSummarize = selectedOutletId === 'all' ? allOutletsOrders : (state.orders || []);
  const summary = summarizeSales(ordersToSummarize, reportDate, {
    operationalEntries: selectedOutletId === 'all' ? allOperationalEntries : state.operationalEntries ?? [],
  });
  $('#report-revenue').textContent = rupiah(summary.revenue);
  $('#report-tax').textContent = rupiah(summary.totalTax);
  $('#report-received').textContent = rupiah(summary.grandRevenue);
  $('#report-cost').textContent = rupiah(summary.totalCost);
  $('#report-gross-profit').textContent = rupiah(summary.margin);
  $('#report-expenses').textContent = rupiah(summary.operatingExpenses);
  $('#report-net-profit').textContent = rupiah(summary.netProfit);

  const reportProdTitle = $('#report-products-title');
  const reportTrxTitle = $('#report-transactions-title');

  if (selectedOutletId === 'all') {
    if (reportProdTitle) reportProdTitle.textContent = 'Laporan Penjualan Per Produk (Gabungan Semua Outlet)';
    if (reportTrxTitle) reportTrxTitle.textContent = 'Riwayat Transaksi Lengkap (Gabungan Semua Outlet)';
  } else {
    if (reportProdTitle) reportProdTitle.textContent = `Laporan Penjualan Per Produk - ${selectedOutletName}`;
    if (reportTrxTitle) reportTrxTitle.textContent = `Riwayat Transaksi Lengkap - ${selectedOutletName}`;
  }

  const products = $('#sold-products');
  if (!products) return;
  products.replaceChildren();

  if (!summary.products.length) {
    products.append(element('p', 'empty-state', `Belum ada produk terjual pada tanggal ${reportDate}.`));
  } else {
    const tableWrapper = element('div', 'report-table-wrapper');
    const table = element('table', 'report-table');
    const thead = element('thead');
    const headRow = element('tr');
    ['No', 'Nama Produk', 'Kategori', 'Harga Jual', 'Qty Terjual', 'Penjualan Bersih', 'Transaksi', 'Rata-rata Qty', 'Laba Kotor']
      .forEach((label) => headRow.append(element('th', '', label)));
    thead.append(headRow);
    const tbody = element('tbody');
    let sumQty = 0;
    let sumRevenue = 0;
    let sumProfit = 0;

    summary.products.forEach((prod, idx) => {
      sumQty += prod.quantity;
      sumRevenue += prod.revenue;
      sumProfit += prod.margin;

      const tr = element('tr');
      tr.append(
        element('td', 'text-center', String(idx + 1)),
        element('td', 'font-bold', prod.productName),
      );
      const categoryCell = element('td');
      categoryCell.append(element('span', 'category-badge', prod.category || 'Lainnya'));
      tr.append(
        categoryCell,
        element('td', 'text-right', rupiah(prod.unitPrice)),
        element('td', 'text-center font-bold', String(prod.quantity)),
        element('td', 'text-right font-bold text-success', rupiah(prod.revenue)),
        element('td', 'text-center', String(prod.transactionCount)),
        element('td', 'text-center', String(prod.avgQtyPerTrx)),
        element('td', `text-right font-bold ${prod.margin >= 0 ? 'text-profit' : 'text-danger'}`, rupiah(prod.margin)),
      );
      tbody.append(tr);
    });

    const tfoot = element('tfoot');
    const footRow = element('tr');
    const totalLabel = element('td', 'text-right font-bold', 'TOTAL');
    totalLabel.colSpan = 4;
    footRow.append(
      totalLabel,
      element('td', 'text-center font-bold', String(sumQty)),
      element('td', 'text-right font-bold text-success', rupiah(sumRevenue)),
      element('td', 'text-center font-bold', String(summary.transactionCount)),
      element('td', '', ''),
      element('td', 'text-right font-bold text-profit', rupiah(sumProfit)),
    );
    tfoot.append(footRow);

    table.append(thead, tbody, tfoot);
    tableWrapper.append(table);
    const hint = element('p', 'table-scroll-hint', 'Geser tabel ke samping untuk melihat detail.');
    products.append(hint, tableWrapper);
  }

  const list = $('#sales-list');
  if (!list) return;
  list.replaceChildren();
  if (!summary.transactions.length) list.append(element('p', 'empty-state large', `Belum ada transaksi pada tanggal ${reportDate}.`));
  summary.transactions.forEach((order) => list.append(transactionRow(order)));
}

function renderTaxConfig() {
  const config = state.taxConfig;
  if (!config) return;
  const enabledInput = $('#tax-enabled');
  const labelInput = $('#tax-label');
  const rateInput = $('#tax-rate');
  if (enabledInput) enabledInput.checked = config.enabled;
  if (labelInput) labelInput.value = config.label || 'Pajak';
  if (rateInput) rateInput.value = config.rate ?? 10;
}

function connectEvents() {
  events?.close();
  events = null;
  window.clearInterval(pollingTimer);
  pollingTimer = null;
  if (selectedOutletId === 'all') return;
  if (isNativeApp) {
    pollingTimer = window.setInterval(() => syncSingleOutletState(false), 5000);
    return;
  }
  events = new EventSource(apiUrl(`/api/outlet/${selectedOutletId}/owner/events`));
  events.onmessage = (event) => {
    state = JSON.parse(event.data);
    renderSummary();
    renderReport();
    setConnection(true);
  };
  events.onerror = () => {
    if (events.readyState === EventSource.CLOSED) {
      setConnection(false);
    }
  };
}

document.querySelectorAll('.key-btn[data-key]').forEach((button) => {
  button.addEventListener('click', () => {
    const input = $('#pin-input');
    if (input && input.value.length < 8) input.value += button.dataset.key;
    const pinErr = $('#pin-error');
    if (pinErr) pinErr.hidden = true;
  });
});

$('#key-clear')?.addEventListener('click', () => {
  const input = $('#pin-input');
  if (input) input.value = '';
  const pinErr = $('#pin-error');
  if (pinErr) pinErr.hidden = true;
});

$('#pin-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const pin = $('#pin-input')?.value;
  try {
    const payload = await request(isNativeApp ? '/api/native/owner/login' : '/api/owner/login', {
      method: 'POST',
      body: JSON.stringify({ pin }),
    });
    if (isNativeApp) setNativeSession(payload);
    await loadMultiSummary();
  } catch (error) {
    const pinErr = $('#pin-error');
    if (pinErr) {
      pinErr.textContent = error.message;
      pinErr.hidden = false;
    }
    const input = $('#pin-input');
    if (input) input.value = '';
  }
});

$('#logout-btn')?.addEventListener('click', async () => {
  try {
    await request(isNativeApp ? '/api/native/logout' : '/api/owner/logout', { method: 'POST', body: '{}' });
  } finally {
    clearNativeSession();
    openLogin();
  }
});

$('#report-date')?.addEventListener('change', (event) => {
  reportDate = event.target.value;
  renderReport();
});

$('#danger-confirmation')?.addEventListener('input', updateMutatingButtons);
$('#global-danger-confirmation')?.addEventListener('input', updateMutatingButtons);

$('#clear-all-outlets-sales-btn')?.addEventListener('click', async () => {
  if ($('#global-danger-confirmation').value !== 'HAPUS SEMUA') return;
  if (!window.confirm('Hapus SELURUH riwayat penjualan di SEMUA OUTLET? Data tidak bisa dikembalikan.')) return;
  try {
    await request('/api/owner/clear-all-outlets-sales', { method: 'POST', body: JSON.stringify({}) });
    $('#global-danger-confirmation').value = '';
    updateMutatingButtons();
    toast('Seluruh riwayat penjualan SEMUA outlet telah dibersihkan.');
    await loadMultiSummary();
  } catch (error) {
    showError(error.message);
  }
});

$('#reset-queue-owner')?.addEventListener('click', async () => {
  if (selectedOutletId === 'all') {
    toast('Pilih outlet spesifik terlebih dahulu.');
    return;
  }
  if (!window.confirm(`Reset antrean '${selectedOutletName}' ke 1?`)) return;
  try {
    await request(`/api/outlet/${selectedOutletId}/reset`, { method: 'POST', body: JSON.stringify({}) }, false);
    toast(`Antrean ${selectedOutletName} dikembalikan ke 1.`);
    await syncSingleOutletState();
  } catch (error) {
    showError(error.message);
  }
});

$('#purge-sales-owner')?.addEventListener('click', async () => {
  if (selectedOutletId === 'all') {
    toast('Pilih outlet spesifik terlebih dahulu.');
    return;
  }
  if (!window.confirm(`Bersihkan transaksi '${selectedOutletName}' yang lebih lama dari 30 hari?`)) return;
  try {
    await request(`/api/outlet/${selectedOutletId}/sales/purge`, { method: 'POST', body: JSON.stringify({ daysToKeep: 30 }) });
    toast(`Data lama ${selectedOutletName} (> 30 hari) sudah dibersihkan.`);
    await syncSingleOutletState();
  } catch (error) {
    showError(error.message);
  }
});

$('#clear-sales-owner')?.addEventListener('click', async () => {
  if (selectedOutletId === 'all') {
    toast('Pilih outlet spesifik terlebih dahulu.');
    return;
  }
  if ($('#danger-confirmation').value !== 'HAPUS') return;
  if (!window.confirm(`Hapus SELURUH riwayat penjualan ${selectedOutletName}? Data tidak bisa dikembalikan.`)) return;
  try {
    await request(`/api/outlet/${selectedOutletId}/sales/clear`, { method: 'POST', body: JSON.stringify({}) }, false);
    $('#danger-confirmation').value = '';
    updateMutatingButtons();
    toast(`Seluruh riwayat penjualan ${selectedOutletName} sudah dihapus.`);
    await syncSingleOutletState();
  } catch (error) {
    showError(error.message);
  }
});

$('#admin-pin-config-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const status = $('#admin-pin-config-status');
  if (selectedOutletId === 'all') {
    status.textContent = 'Pilih outlet spesifik terlebih dahulu.';
    status.className = 'media-status-msg error';
    status.hidden = false;
    return;
  }
  const newPin = $('#new-admin-pin').value.trim();
  const confirmPin = $('#confirm-admin-pin').value.trim();
  if (!/^\d{4,8}$/.test(newPin)) {
    status.textContent = 'PIN Admin harus 4 hingga 8 angka.';
    status.className = 'media-status-msg error';
    status.hidden = false;
    return;
  }
  if (newPin !== confirmPin) {
    status.textContent = 'Konfirmasi PIN Admin tidak cocok.';
    status.className = 'media-status-msg error';
    status.hidden = false;
    return;
  }
  try {
    await request(`/api/outlet/${selectedOutletId}/admin/pin`, { method: 'POST', body: JSON.stringify({ newPin }) });
    $('#new-admin-pin').value = '';
    $('#confirm-admin-pin').value = '';
    status.textContent = `PIN kasir ${selectedOutletName} berhasil diganti.`;
    status.className = 'media-status-msg success';
    status.hidden = false;
    toast('PIN kasir outlet berhasil diganti');
  } catch (error) {
    status.textContent = error.message;
    status.className = 'media-status-msg error';
    status.hidden = false;
  }
});

$('#tax-config-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (selectedOutletId === 'all') {
    toast('Pilih outlet spesifik terlebih dahulu untuk mengatur pajak.');
    return;
  }
  try {
    await request(`/api/outlet/${selectedOutletId}/tax-config`, {
      method: 'POST',
      body: JSON.stringify({
        enabled: $('#tax-enabled').checked,
        label: $('#tax-label').value.trim() || 'Pajak',
        rate: Number($('#tax-rate').value) || 0,
      }),
    });
    toast('Pengaturan pajak disimpan');
    await syncSingleOutletState();
  } catch (err) {
    showError(err.message);
  }
});

const ownerMediaForm = $('#owner-media-form');
if (ownerMediaForm) {
  ownerMediaForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (selectedOutletId === 'all') {
      toast('Pilih outlet spesifik terlebih dahulu untuk ganti media TV.');
      return;
    }
    const fileInput = $('#owner-media-file');
    const statusMsg = $('#owner-media-status');
    const file = fileInput?.files[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      showError('Ukuran file maksimal 25MB');
      return;
    }

    statusMsg.hidden = false;
    statusMsg.textContent = 'Mengunggah file...';
    statusMsg.className = 'media-status-msg info';

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await request(`/api/outlet/${selectedOutletId}/media/upload`, {
          method: 'POST',
          body: JSON.stringify({
            filename: file.name,
            dataUrl: reader.result,
            fit: $('#owner-media-fit')?.value || 'cover',
            imageDurationSeconds: Number($('#owner-image-duration')?.value || 8),
          }),
        });
        statusMsg.textContent = 'Media berhasil diunggah & langsung tayang di TV!';
        statusMsg.className = 'media-status-msg success';
        if (fileInput) fileInput.value = '';
        toast('Media TV berhasil diperbarui');
        await syncSingleOutletState();
      } catch (err) {
        statusMsg.textContent = err.message || 'Gagal mengunggah media';
        statusMsg.className = 'media-status-msg error';
      }
    };
    reader.onerror = () => {
      statusMsg.textContent = 'Gagal membaca file';
      statusMsg.className = 'media-status-msg error';
    };
    reader.readAsDataURL(file);
  });
}

// MODAL GANTI PIN
const changePinModal = $('#change-pin-modal');
function openChangePin() {
  if (changePinModal) {
    $('#current-pin-input').value = '';
    $('#new-pin-input').value = '';
    $('#confirm-pin-input').value = '';
    const err = $('#change-pin-error');
    if (err) err.hidden = true;
    changePinModal.showModal();
  }
}
function closeChangePin() {
  if (changePinModal?.open) changePinModal.close();
}
$('#open-change-pin-modal')?.addEventListener('click', openChangePin);
$('#close-change-pin-modal')?.addEventListener('click', closeChangePin);
$('#cancel-change-pin')?.addEventListener('click', closeChangePin);
changePinModal?.addEventListener('click', (e) => {
  if (e.target === changePinModal) closeChangePin();
});

$('#change-pin-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const currentPin = $('#current-pin-input').value;
  const newPin = $('#new-pin-input').value;
  const confirmPin = $('#confirm-pin-input').value;
  const errDiv = $('#change-pin-error');
  if (errDiv) errDiv.hidden = true;

  if (newPin !== confirmPin) {
    if (errDiv) { errDiv.textContent = 'Konfirmasi PIN baru tidak cocok'; errDiv.hidden = false; }
    return;
  }

  const outletTarget = selectedOutletId === 'all' ? 'maucafe-alunalun' : selectedOutletId;
  try {
    await request(`/api/outlet/${outletTarget}/owner/pin`, {
      method: 'POST',
      body: JSON.stringify({ currentPin, newPin }),
    });
    clearNativeSession();
    closeChangePin();
    openLogin('PIN berhasil diubah. Masuk kembali dengan PIN baru.');
  } catch (err) {
    if (errDiv) { errDiv.textContent = err.message || 'Gagal mengubah PIN'; errDiv.hidden = false; }
  }
});

const menuMgmtModal = $('#menu-mgmt-modal');

function populateMenuModalOutletDropdown() {
  const dropdown = $('#menu-modal-outlet-select');
  if (!dropdown) return;
  dropdown.replaceChildren();

  outletsList.forEach((s) => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.name;
    dropdown.append(opt);
  });

  const currentVal = selectedOutletId === 'all' ? (outletsList[0]?.id || 'maucafe-alunalun') : selectedOutletId;
  dropdown.value = currentVal;
}

$('#menu-modal-outlet-select')?.addEventListener('change', async (e) => {
  await selectOutlet(e.target.value);
  renderMenuMgmtList();
});

function openMenuMgmt() {
  populateMenuModalOutletDropdown();
  if (selectedOutletId === 'all') {
    selectOutlet(outletsList[0]?.id || 'maucafe-alunalun');
  } else {
    renderMenuMgmtList();
  }
  if (menuMgmtModal) menuMgmtModal.showModal();
}
function closeMenuMgmt() {
  if (menuMgmtModal?.open) menuMgmtModal.close();
  const err = $('#add-product-error');
  if (err) err.hidden = true;
}

function renderMenuMgmtList() {
  const container = $('#menu-mgmt-list');
  if (!container) return;
  container.replaceChildren();

  if (!state.products || !state.products.length) {
    container.append(element('p', 'empty-state', 'Belum ada menu terdaftar.'));
    return;
  }

  state.products.forEach((prod) => {
    const card = element('div', 'menu-item-edit-card');

    const header = element('div', 'menu-item-header');
    const thumbnail = element('span', 'menu-item-thumbnail');
    if (prod.imageUrl) {
      const image = element('img');
      image.src = prod.imageUrl;
      image.alt = '';
      image.loading = 'lazy';
      thumbnail.append(image);
    } else {
      thumbnail.append(element('span', '', prod.name.slice(0, 1).toUpperCase()));
    }
    header.append(
      thumbnail,
      element('strong', 'menu-item-name', prod.name),
      element('span', 'menu-item-category-badge', prod.category)
    );

    const inputsRow = element('div', 'menu-item-inputs-row');

    const priceLabel = element('label', 'input-compact');
    priceLabel.append(element('span', '', 'Harga Jual (Rp)'));
    const priceInput = element('input');
    priceInput.type = 'number';
    priceInput.value = prod.price;
    priceLabel.append(priceInput);

    const costLabel = element('label', 'input-compact');
    costLabel.append(element('span', '', 'Modal / HPP (Rp)'));
    const costInput = element('input');
    costInput.type = 'number';
    costInput.value = prod.cost ?? 0;
    costLabel.append(costInput);

    const cupLabel = element('label', 'input-compact');
    cupLabel.append(element('span', '', 'Cup / item'));
    const cupInput = element('input');
    cupInput.type = 'number';
    cupInput.min = '0';
    cupInput.max = '10';
    cupInput.value = prod.cupUsage ?? 0;
    cupLabel.append(cupInput);

    inputsRow.append(priceLabel, costLabel, cupLabel);

    const actionsRow = element('div', 'menu-item-actions-row');

    const toggleLabel = element('label', 'status-toggle');
    const toggleCheckbox = element('input');
    toggleCheckbox.type = 'checkbox';
    toggleCheckbox.checked = prod.active !== false;
    const statusText = element('span', '', prod.active !== false ? 'Tersedia' : 'Habis');
    toggleLabel.append(toggleCheckbox, statusText);

    toggleCheckbox.addEventListener('change', () => {
      statusText.textContent = toggleCheckbox.checked ? 'Tersedia' : 'Habis';
    });

    const saveBtn = element('button', 'primary small-btn', 'Simpan');
    saveBtn.type = 'button';
    saveBtn.addEventListener('click', async () => {
      try {
        const newPrice = Number(priceInput.value);
        const newCost = Number(costInput.value);
        const cupUsage = Number(cupInput.value);
        const isActive = toggleCheckbox.checked;
        await request(`/api/outlet/${selectedOutletId}/products/${prod.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ price: newPrice, cost: newCost, cupUsage, active: isActive }),
        });
        toast(`Menu ${prod.name} diperbarui!`);
        await syncSingleOutletState();
      } catch (err) {
        toast(err.message || 'Gagal memperbarui menu');
      }
    });

    const photoLabel = element('label', 'product-photo-control', 'Ganti foto');
    const photoInput = element('input');
    photoInput.type = 'file';
    photoInput.accept = 'image/png,image/jpeg,image/webp';
    photoInput.hidden = true;
    photoInput.addEventListener('change', () => {
      const file = photoInput.files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        toast('Foto maksimal 5MB');
        photoInput.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          await request(`/api/outlet/${selectedOutletId}/products/${prod.id}/image`, {
            method: 'POST',
            body: JSON.stringify({ filename: file.name, dataUrl: reader.result }),
          });
          toast(`Foto ${prod.name} diperbarui`);
          await syncSingleOutletState();
          renderMenuMgmtList();
        } catch (err) {
          toast(err.message || 'Gagal mengunggah foto');
        }
      };
      reader.onerror = () => toast('Gagal membaca foto');
      reader.readAsDataURL(file);
    });
    photoLabel.append(photoInput);

    actionsRow.append(toggleLabel, photoLabel, saveBtn);
    card.append(header, inputsRow, actionsRow);
    container.append(card);
  });
}

$('#open-menu-mgmt-modal')?.addEventListener('click', openMenuMgmt);
$('#close-menu-mgmt-modal')?.addEventListener('click', closeMenuMgmt);
menuMgmtModal?.addEventListener('click', (e) => {
  if (e.target === menuMgmtModal) closeMenuMgmt();
});

const addProductForm = $('#add-product-form');
if (addProductForm) {
  addProductForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errDiv = $('#add-product-error');
    if (errDiv) errDiv.hidden = true;
    try {
      const name = $('#new-product-name').value.trim();
      const category = $('#new-product-category').value;
      const price = Number($('#new-product-price').value);
      const cost = Number($('#new-product-cost').value);
      const cupUsage = Number($('#new-product-cup-usage').value);
      await request(`/api/outlet/${selectedOutletId}/products`, {
        method: 'POST',
        body: JSON.stringify({ name, category, price, cost, cupUsage }),
      });
      $('#new-product-name').value = '';
      $('#new-product-price').value = '';
      $('#new-product-cost').value = '';
      toast('Menu baru berhasil ditambahkan!');
      await syncSingleOutletState();
      renderMenuMgmtList();
    } catch (err) {
      if (errDiv) {
        errDiv.textContent = err.message || 'Gagal menambah menu';
        errDiv.hidden = false;
      }
    }
  });
}

$('#export-excel-btn')?.addEventListener('click', handleExportExcel);

$('#owner-partner-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await request('/api/owner/partners', {
      method: 'POST',
      body: JSON.stringify({
        name: $('#owner-partner-name').value.trim(),
        username: $('#owner-partner-username').value.trim(),
        pin: $('#owner-partner-pin').value,
      }),
    });
    event.currentTarget.reset();
    toast('Akun Mitra dibuat');
    await loadFranchise();
  } catch (error) {
    showError(error.message);
  }
});

async function restoreOwnerSession() {
  if (isNativeApp && !getNativeSession()?.token) return;
  const session = await apiRequest('/api/owner/session');
  if (session.authenticated) await loadMultiSummary();
}

// Inisialisasi
restoreOwnerSession().catch((error) => showError(error.message));
window.setInterval(() => {
  if (!$('#owner-dashboard')?.hidden && selectedOutletId === 'all') loadMultiSummary();
}, isNativeApp ? 5000 : 15000);
window.addEventListener('online', () => {
  if ($('#owner-dashboard')?.hidden) return;
  if (selectedOutletId === 'all') loadMultiSummary(); else syncSingleOutletState();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden || $('#owner-dashboard')?.hidden) return;
  if (selectedOutletId === 'all') loadMultiSummary(); else syncSingleOutletState();
});
window.addEventListener('maucafe:resume', () => {
  if ($('#owner-dashboard')?.hidden) return;
  if (selectedOutletId === 'all') loadMultiSummary(); else syncSingleOutletState();
});
window.addEventListener('maucafe:network', (event) => {
  setConnection(event.detail.connected);
  if (!event.detail.connected || $('#owner-dashboard')?.hidden) return;
  if (selectedOutletId === 'all') loadMultiSummary(); else syncSingleOutletState();
});
setupNativeShell();
