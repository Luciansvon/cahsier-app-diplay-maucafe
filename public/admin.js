import { apiRequest } from './api-client.js';
import { apiUrl, isNativeApp, outletFromLocation } from './app-config.js';
import { clearNativeSession, getNativeSession, setNativeSession } from './native-session.js';
import { setupNativeShell } from './native-shell.js';

let state = {
  products: [],
  orders: [],
  activeCall: null,
  promoMedia: null,
  mediaPlaylist: [],
  currentShift: null,
  dailySummary: null,
};
const cart = new Map();
let paymentMethod = 'cash';
let eventsSource = null;
let pollingTimer = null;
let busy = false;
let productSearch = '';
let activeCategory = 'Semua';
let cancellingOrderId = null;
let pendingCheckoutId = null;

const outletId = outletFromLocation();
const apiBase = `/api/outlet/${outletId}`;
const $ = (selector) => document.querySelector(selector);
const rupiah = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value) || 0);

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function setConnection(online) {
  const status = $('#connection-status');
  if (!status) return;
  status.textContent = online ? 'Terhubung' : 'Koneksi terputus';
  status.className = `connection ${online ? 'online' : 'offline'}`;
}

function showError(message) {
  const banner = $('#error-banner');
  if (!banner) return;
  banner.textContent = message;
  banner.hidden = false;
}

function clearError() {
  const banner = $('#error-banner');
  if (banner) banner.hidden = true;
}

function toast(message) {
  const node = $('#success-toast');
  if (!node) return;
  node.textContent = message;
  node.hidden = false;
  window.setTimeout(() => { node.hidden = true; }, 2400);
}

function setBusy(value) {
  busy = value;
  document.querySelectorAll('.action-button').forEach((button) => { button.disabled = value; });
  const checkout = $('#checkout');
  if (checkout) checkout.disabled = value || cart.size === 0;
}

function openAdminLogin(message = '') {
  eventsSource?.close();
  eventsSource = null;
  window.clearInterval(pollingTimer);
  pollingTimer = null;
  $('#admin-main-view').hidden = true;
  $('#admin-login').hidden = false;
  const pinInput = $('#admin-pin-input');
  const pinError = $('#admin-pin-error');
  if (pinInput) pinInput.value = '';
  if (pinError) {
    pinError.textContent = message;
    pinError.hidden = !message;
  }
}

function openAdminMain() {
  $('#admin-login').hidden = true;
  $('#admin-main-view').hidden = false;
}

async function api(subPath, options = {}) {
  setBusy(true);
  clearError();
  const path = subPath.startsWith('/api/') ? subPath : `${apiBase}${subPath}`;
  try {
    const payload = await apiRequest(path, options);
    setConnection(true);
    if (payload.state) applyState(payload.state);
    return payload;
  } catch (error) {
    if (error.status) {
      if (error.status === 401 && !path.endsWith('/admin/login')) openAdminLogin('Sesi berakhir, masukkan PIN Admin lagi.');
      showError(error.message);
      if (!$('#admin-main-view')?.hidden) setConnection(true);
    } else {
      showError('Koneksi ke server terputus. Data belum tersimpan.');
      setConnection(false);
    }
    throw error;
  } finally {
    setBusy(false);
  }
}

function applyState(nextState) {
  state = nextState;
  if (nextState.outletInfo) {
    $('#admin-outlet-name').textContent = nextState.outletInfo.name;
    $('#admin-outlet-badge').textContent = `MAUCAFE - ${nextState.outletInfo.name.toUpperCase()}`;
  }
  for (const productId of [...cart.keys()]) {
    if (!(state.products || []).some((product) => product.id === productId && product.active !== false)) {
      cart.delete(productId);
      pendingCheckoutId = null;
    }
  }
  renderCategoryFilters();
  renderProducts();
  renderCart();
  renderOrders();
  renderMediaStatus();
  renderOperations();
}

function renderMediaStatus() {
  const node = $('#admin-current-media');
  if (!node) return;
  node.replaceChildren(document.createTextNode('Media aktif: '));
  const strong = element('strong');
  const media = state.promoMedia;
  if (!media?.filename) strong.textContent = 'Video Bawaan (promo.mp4)';
  else strong.textContent = `${media.type === 'image' ? 'Foto' : 'Video'} (${media.filename})`;
  node.append(strong);
  const fitSelect = $('#admin-media-fit');
  if (fitSelect && media?.fit) fitSelect.value = media.fit;
  renderMediaPlaylist();
}

function renderMediaPlaylist() {
  const container = $('#admin-media-playlist');
  if (!container) return;
  container.replaceChildren();
  const items = state.mediaPlaylist ?? [];
  if (!items.length) {
    container.append(element('p', 'empty-state', 'Playlist kosong. Video bawaan dipakai.'));
    return;
  }
  items.forEach((item, index) => {
    const row = element('div', 'media-playlist-item');
    row.append(element('span', '', String(index + 1)), element('strong', '', item.filename || item.url));
    const up = element('button', 'ghost small-btn', '↑');
    const down = element('button', 'ghost small-btn', '↓');
    const remove = element('button', 'danger small-btn', 'Hapus');
    up.type = down.type = remove.type = 'button';
    up.disabled = index === 0;
    down.disabled = index === items.length - 1;
    const move = async (offset) => {
      const ids = items.map((candidate) => candidate.id);
      [ids[index], ids[index + offset]] = [ids[index + offset], ids[index]];
      await api('/media/playlist/order', {
        method: 'PATCH',
        body: JSON.stringify({ orderedIds: ids }),
      });
    };
    up.addEventListener('click', () => move(-1).catch((error) => showError(error.message)));
    down.addEventListener('click', () => move(1).catch((error) => showError(error.message)));
    remove.addEventListener('click', () => api(`/media/playlist/${item.id}`, {
      method: 'DELETE',
    }).catch((error) => showError(error.message)));
    row.append(up, down, remove);
    container.append(row);
  });
}

function renderOperations() {
  const summary = state.dailySummary ?? {};
  if ($('#cashier-daily-quantity')) $('#cashier-daily-quantity').textContent = String(summary.totalQuantity ?? 0);
  if ($('#cashier-daily-products')) $('#cashier-daily-products').textContent = String(summary.productCount ?? 0);
  if ($('#cashier-daily-transactions')) $('#cashier-daily-transactions').textContent = String(summary.transactionCount ?? 0);
  const current = state.currentShift;
  const shiftStatus = $('#current-shift-label');
  if (shiftStatus) {
    shiftStatus.replaceChildren();
    if (current) {
      shiftStatus.append(
        element('strong', '', current.label),
        element('span', '', `Kasir: ${current.employeeName}`),
        element('span', '', `Saldo awal: ${rupiah(current.openingCash)}`),
      );
    } else {
      shiftStatus.append(element('span', '', 'Belum ada shift aktif.'));
    }
  }
  if ($('#open-shift-form')) $('#open-shift-form').hidden = Boolean(current);
  if ($('#close-shift-form')) $('#close-shift-form').hidden = !current;
}

function renderCategoryFilters() {
  const container = $('#category-filters');
  if (!container) return;
  const categories = ['Semua', ...new Set((state.products || []).filter((p) => p.active !== false).map((p) => p.category || 'Lainnya'))];
  if (!categories.includes(activeCategory)) activeCategory = 'Semua';
  container.replaceChildren();
  for (const category of categories) {
    const button = element('button', `category-chip${category === activeCategory ? ' active' : ''}`, category);
    button.type = 'button';
    button.addEventListener('click', () => {
      activeCategory = category;
      renderCategoryFilters();
      renderProducts();
    });
    container.append(button);
  }
}

function renderProducts() {
  const grid = $('#product-grid');
  if (!grid) return;
  grid.replaceChildren();
  const needle = productSearch.trim().toLocaleLowerCase('id-ID');
  const products = (state.products || []).filter((product) => {
    if (product.active === false) return false;
    if (activeCategory !== 'Semua' && (product.category || 'Lainnya') !== activeCategory) return false;
    return !needle || `${product.name} ${product.category}`.toLocaleLowerCase('id-ID').includes(needle);
  });
  if (!products.length) {
    grid.append(element('p', 'empty-state large product-empty', needle ? 'Menu tidak ditemukan.' : 'Belum ada menu aktif.'));
    return;
  }
  for (const product of products) {
    const button = element('button', 'product-card');
    button.type = 'button';
    const media = element('span', 'product-card-media');
    if (product.imageUrl) {
      const image = element('img', 'product-card-image');
      image.src = product.imageUrl;
      image.alt = '';
      image.loading = 'lazy';
      media.append(image);
    } else {
      media.append(element('span', 'product-card-fallback', product.name.slice(0, 1).toUpperCase()));
    }
    button.append(
      media,
      element('span', 'product-category', product.category || 'Lainnya'),
      element('strong', '', product.name),
      element('span', 'product-price', rupiah(product.price)),
    );
    button.addEventListener('click', () => {
      if (busy) return;
      cart.set(product.id, (cart.get(product.id) ?? 0) + 1);
      pendingCheckoutId = null;
      renderCart();
    });
    grid.append(button);
  }
}

function cartTotals() {
  let subtotal = 0;
  let itemCount = 0;
  for (const [productId, quantity] of cart) {
    const product = (state.products || []).find((item) => item.id === productId);
    if (!product) continue;
    subtotal += product.price * quantity;
    itemCount += quantity;
  }
  return { subtotal, grandTotal: subtotal, itemCount };
}

function renderCart() {
  const container = $('#cart-items');
  if (!container) return;
  container.replaceChildren();
  for (const [productId, quantity] of cart) {
    const product = (state.products || []).find((item) => item.id === productId);
    if (!product) continue;
    const row = element('div', 'cart-row');
    const info = element('div');
    info.append(element('strong', '', product.name), element('small', '', `${quantity} × ${rupiah(product.price)} = ${rupiah(product.price * quantity)}`));
    const controls = element('div', 'quantity-controls');
    const minus = element('button', '', '−');
    const plus = element('button', '', '+');
    minus.type = plus.type = 'button';
    minus.setAttribute('aria-label', `Kurangi ${product.name}`);
    plus.setAttribute('aria-label', `Tambah ${product.name}`);
    minus.addEventListener('click', () => {
      if (busy) return;
      if (quantity <= 1) cart.delete(productId); else cart.set(productId, quantity - 1);
      pendingCheckoutId = null;
      renderCart();
    });
    plus.addEventListener('click', () => {
      if (busy) return;
      cart.set(productId, quantity + 1);
      pendingCheckoutId = null;
      renderCart();
    });
    controls.append(minus, element('span', '', String(quantity)), plus);
    row.append(info, controls);
    container.append(row);
  }
  if (!cart.size) container.append(element('p', 'empty-state', 'Belum ada menu dipilih.'));

  const { subtotal, grandTotal, itemCount } = cartTotals();
  $('#cart-subtotal').textContent = rupiah(subtotal);
  $('#cart-total').textContent = rupiah(grandTotal);

  const checkout = $('#checkout');
  if (checkout) {
    checkout.disabled = busy || cart.size === 0;
    checkout.textContent = cart.size ? `Bayar ${rupiah(grandTotal)} · ${paymentMethod === 'cash' ? 'Tunai' : 'QRIS'}` : 'Bayar';
  }
  const mobileBar = $('#mobile-cart-bar');
  if (mobileBar) mobileBar.hidden = cart.size === 0;
  if ($('#mobile-cart-count')) $('#mobile-cart-count').textContent = `${itemCount} item`;
  if ($('#mobile-cart-total')) $('#mobile-cart-total').textContent = rupiah(grandTotal);
}

function actionButton(label, className, action) {
  const button = element('button', `${className} action-button`, label);
  button.type = 'button';
  button.addEventListener('click', action);
  return button;
}

function minutesWaiting(order) {
  const ms = Date.now() - new Date(order.createdAt).getTime();
  return Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 60000)) : 0;
}

function orderCard(order) {
  const card = element('article', `order-card ${order.status}`);
  const top = element('div', 'order-top');
  top.append(element('strong', 'order-number', order.queueNumber), element('span', 'status-pill', order.status === 'ready' ? 'Siap' : 'Menunggu'));
  const summary = element('p', 'order-summary', order.items.map((item) => `${item.quantity}× ${item.productName}`).join(', '));
  const wait = minutesWaiting(order);
  const waitNode = element('p', `wait-time${wait >= 10 ? ' warning' : ''}`, order.status === 'ready' ? `Siap sejak ${wait} menit dari waktu order` : `Menunggu ${wait} menit`);
  const actions = element('div', 'order-actions');
  actions.append(
    actionButton(order.status === 'ready' ? 'Panggil ulang' : 'Panggil', 'primary', () => api(`/orders/${order.id}/call`, { method: 'POST', body: '{}' }).catch(() => {})),
  );
  if (order.status === 'ready') {
    actions.append(actionButton('Selesai', 'success', () => api(`/orders/${order.id}/complete`, { method: 'POST', body: '{}' }).catch(() => {})));
  }
  actions.append(actionButton('Batal', 'ghost danger', () => openCancelDialog(order)));
  card.append(top, summary, waitNode, actions);
  return card;
}

function appendOrderGroup(list, title, orders, className) {
  if (!orders.length) return;
  const section = element('section', `order-group ${className}`);
  const heading = element('div', 'order-group-heading');
  heading.append(element('h3', '', title), element('span', 'count neutral', String(orders.length)));
  section.append(heading);
  for (const order of orders) section.append(orderCard(order));
  list.append(section);
}

function renderOrders() {
  const list = $('#orders-list');
  if (!list) return;
  list.replaceChildren();
  const active = (state.orders || []).filter((order) => ['waiting', 'ready'].includes(order.status));
  $('#order-count').textContent = String(active.length);
  if (!active.length) {
    list.append(element('p', 'empty-state large', 'Belum ada pesanan aktif.'));
    return;
  }
  const byOldest = (a, b) => new Date(a.createdAt) - new Date(b.createdAt);
  appendOrderGroup(list, 'Siap diambil', active.filter((o) => o.status === 'ready').sort(byOldest), 'ready-group');
  appendOrderGroup(list, 'Sedang dibuat', active.filter((o) => o.status === 'waiting').sort(byOldest), 'waiting-group');
}

function openCancelDialog(order) {
  cancellingOrderId = order.id;
  $('#cancel-dialog-title').textContent = `Batalkan pesanan #${order.queueNumber}`;
  $('#cancel-reason').value = '';
  $('#cancel-owner-pin').value = '';
  $('#cancel-order-error').hidden = true;
  $('#cancel-dialog').showModal();
}

function closeCancelDialog() {
  cancellingOrderId = null;
  const dialog = $('#cancel-dialog');
  if (dialog?.open) dialog.close();
}

document.querySelectorAll('.tab').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.tab, .panel').forEach((node) => node.classList.remove('active'));
    button.classList.add('active');
    $(`#${button.dataset.tab}`)?.classList.add('active');
  });
});

document.querySelectorAll('.payment').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.payment').forEach((node) => node.classList.remove('active'));
    button.classList.add('active');
    paymentMethod = button.dataset.payment;
    pendingCheckoutId = null;
    renderCart();
  });
});

$('#product-search')?.addEventListener('input', (event) => {
  productSearch = event.target.value;
  renderProducts();
});

$('#mobile-cart-open')?.addEventListener('click', () => {
  document.querySelector('.cart-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

$('#checkout')?.addEventListener('click', async () => {
  if (!cart.size || busy) return;
  try {
    pendingCheckoutId ||= crypto.randomUUID?.() ?? `checkout-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const payload = await api('/orders', {
      method: 'POST',
      body: JSON.stringify({
        requestId: pendingCheckoutId,
        items: [...cart].map(([productId, quantity]) => ({ productId, quantity })),
        paymentMethod,
      }),
    });
    cart.clear();
    pendingCheckoutId = null;
    renderCart();
    toast(`Pesanan ${payload.order.queueNumber} berhasil dibuat`);
  } catch (error) {
    showError(error.message || 'Pembayaran gagal. Coba lagi.');
  }
});

$('#cancel-dialog-close')?.addEventListener('click', closeCancelDialog);
$('#cancel-dialog-back')?.addEventListener('click', closeCancelDialog);
$('#cancel-order-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!cancellingOrderId) return;
  const reason = $('#cancel-reason').value;
  const ownerPin = $('#cancel-owner-pin').value;
  const errorNode = $('#cancel-order-error');
  try {
    await api(`/orders/${cancellingOrderId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason, ownerPin }),
    });
    closeCancelDialog();
    toast('Pesanan dibatalkan dan dicatat di riwayat');
  } catch (error) {
    errorNode.textContent = error.message;
    errorNode.hidden = false;
  }
});

const mediaForm = $('#admin-media-form');
mediaForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  const fileInput = $('#admin-media-file');
  const status = $('#admin-media-status');
  const file = fileInput.files[0];
  if (!file) return;
  if (file.size > 25 * 1024 * 1024) {
    showError('Ukuran file maksimal 25MB');
    return;
  }
  status.hidden = false;
  status.textContent = 'Mengunggah file...';
  status.className = 'media-status-msg info';
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      await api('/media/upload', {
        method: 'POST',
        body: JSON.stringify({
          filename: file.name,
          dataUrl: reader.result,
          fit: $('#admin-media-fit')?.value || 'cover',
          imageDurationSeconds: Number($('#admin-image-duration')?.value || 8),
        }),
      });
      status.textContent = 'Media berhasil diunggah dan langsung tayang di TV.';
      status.className = 'media-status-msg success';
      fileInput.value = '';
      toast('Media TV berhasil diperbarui');
    } catch (error) {
      status.textContent = error.message || 'Gagal mengunggah media';
      status.className = 'media-status-msg error';
    }
  };
  reader.onerror = () => {
    status.textContent = 'Gagal membaca file';
    status.className = 'media-status-msg error';
  };
  reader.readAsDataURL(file);
});

$('#admin-reset-media-btn')?.addEventListener('click', async () => {
  const status = $('#admin-media-status');
  try {
    await api('/media/reset', { method: 'POST', body: '{}' });
    status.hidden = false;
    status.textContent = 'Media dikembalikan ke video bawaan';
    status.className = 'media-status-msg success';
    toast('Media TV dikembalikan ke video bawaan');
  } catch (error) {
    status.hidden = false;
    status.textContent = error.message || 'Gagal mereset media';
    status.className = 'media-status-msg error';
  }
});

$('#open-shift-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await api('/shifts/open', {
      method: 'POST',
      body: JSON.stringify({
        label: $('#shift-label').value.trim(),
        openingCash: Number($('#shift-opening-cash').value),
      }),
    });
    toast('Shift dibuka');
  } catch (error) {
    showError(error.message);
  }
});

$('#close-shift-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!state.currentShift) return;
  try {
    const payload = await api(`/shifts/${state.currentShift.id}/close`, {
      method: 'POST',
      body: JSON.stringify({
        actualCash: Number($('#shift-actual-cash').value),
        reason: $('#shift-close-reason').value.trim(),
      }),
    });
    toast(`Shift ditutup. Selisih ${rupiah(payload.shift.variance)}`);
  } catch (error) {
    showError(error.message);
  }
});

$('#operation-entry-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!state.currentShift) {
    showError('Buka shift dulu sebelum mencatat kas atau biaya.');
    return;
  }
  try {
    await api('/operations', {
      method: 'POST',
      body: JSON.stringify({
        type: $('#operation-type').value,
        amount: Number($('#operation-amount').value),
        category: $('#operation-category').value.trim(),
        note: $('#operation-note').value.trim(),
        shiftId: state.currentShift.id,
      }),
    });
    event.currentTarget.reset();
    toast('Catatan operasional tersimpan');
  } catch (error) {
    showError(error.message);
  }
});

$('#inventory-entry-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await api('/inventory', {
      method: 'POST',
      body: JSON.stringify({
        type: $('#inventory-type').value,
        quantity: Number($('#inventory-quantity').value),
        reason: $('#inventory-reason').value.trim(),
        shiftId: state.currentShift?.id ?? null,
      }),
    });
    event.currentTarget.reset();
    toast('Pergerakan cup tersimpan');
  } catch (error) {
    showError(error.message);
  }
});

document.querySelectorAll('.key-btn[data-key]').forEach((button) => {
  button.addEventListener('click', () => {
    const input = $('#admin-pin-input');
    if (input && input.value.length < 8) input.value += button.dataset.key;
    $('#admin-pin-error').hidden = true;
  });
});

$('#admin-key-clear')?.addEventListener('click', () => {
  $('#admin-pin-input').value = '';
  $('#admin-pin-error').hidden = true;
});

$('#admin-pin-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const payload = await api(isNativeApp ? '/api/native/admin/login' : '/admin/login', {
      method: 'POST',
      body: JSON.stringify({
        outletId,
        username: $('#admin-username-input').value.trim() || undefined,
        pin: $('#admin-pin-input').value,
      }),
    });
    if (isNativeApp) setNativeSession(payload);
    openAdminMain();
    if (payload.outlet) $('#admin-outlet-name').textContent = payload.outlet.name;
    connect();
  } catch (error) {
    $('#admin-pin-error').textContent = error.message;
    $('#admin-pin-error').hidden = false;
    $('#admin-pin-input').value = '';
  }
});

$('#admin-logout-btn')?.addEventListener('click', async () => {
  try {
    await api(isNativeApp ? '/api/native/logout' : '/admin/logout', { method: 'POST', body: '{}' });
  } finally {
    clearNativeSession();
    openAdminLogin();
  }
});

async function checkSession() {
  try {
    const session = getNativeSession();
    if (isNativeApp && (!session || (session.role === 'admin' && session.outletId !== outletId))) {
      const data = await apiRequest(`${apiBase}/info`);
      $('#admin-login-title').textContent = `Panel Kasir ${data.outlet.name}`;
      $('#admin-login-outlet-tag').textContent = `MAUCAFE - ${data.outlet.name.toUpperCase()}`;
      openAdminLogin();
      return;
    }
    const data = await apiRequest(`${apiBase}/admin/session`);
    if (data.outlet) {
      $('#admin-login-title').textContent = `Panel Kasir ${data.outlet.name}`;
      $('#admin-login-outlet-tag').textContent = `MAUCAFE - ${data.outlet.name.toUpperCase()}`;
      $('#admin-outlet-name').textContent = data.outlet.name;
      $('#admin-outlet-badge').textContent = `MAUCAFE - ${data.outlet.name.toUpperCase()}`;
    }
    if (data.authenticated) {
      openAdminMain();
      connect();
    } else openAdminLogin();
  } catch {
    openAdminLogin('Gagal terhubung ke server');
  }
}

async function connect() {
  try {
    applyState(await apiRequest(`${apiBase}/admin/state`));
    setConnection(true);
  } catch (error) {
    if (error.status === 401) {
      openAdminLogin('Sesi berakhir, masukkan PIN Admin lagi.');
      return;
    }
    setConnection(false);
    showError(error.message);
  }

  eventsSource?.close();
  window.clearInterval(pollingTimer);
  if (isNativeApp) {
    pollingTimer = window.setInterval(async () => {
      try {
        applyState(await apiRequest(`${apiBase}/admin/state`));
        setConnection(true);
        clearError();
      } catch (error) {
        setConnection(false);
        if (error.status === 401) openAdminLogin('Sesi berakhir, masukkan PIN Admin lagi.');
      }
    }, 5000);
    return;
  }
  eventsSource = new EventSource(apiUrl(`${apiBase}/admin/events`));
  eventsSource.onmessage = (event) => {
    applyState(JSON.parse(event.data));
    setConnection(true);
    clearError();
  };
  eventsSource.onerror = () => setConnection(false);
}

window.setInterval(renderOrders, 60_000);
window.addEventListener('online', () => {
  if (!$('#admin-main-view')?.hidden) connect();
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && !$('#admin-main-view')?.hidden) connect();
});
window.addEventListener('maucafe:resume', () => {
  if (!$('#admin-main-view')?.hidden) connect();
});
window.addEventListener('maucafe:network', (event) => {
  setConnection(event.detail.connected);
  if (event.detail.connected && !$('#admin-main-view')?.hidden) connect();
});
setupNativeShell();
renderCart();
checkSession();
