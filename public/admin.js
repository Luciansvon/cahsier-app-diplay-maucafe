let state = { products: [], orders: [], activeCall: null, promoMedia: null };
const cart = new Map();
let paymentMethod = 'cash';
let eventsSource = null;

function getOutletId() {
  const match = window.location.pathname.match(/\/outlet\/([^/]+)/);
  return match ? match[1] : 'maucafe-bsd';
}

const outletId = getOutletId();
const apiBase = `/api/outlet/${outletId}`;

const $ = (selector) => document.querySelector(selector);
const rupiah = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function setConnection(online) {
  const status = $('#connection-status');
  if (status) {
    status.textContent = online ? 'Terhubung' : 'Koneksi terputus';
    status.className = `connection ${online ? 'online' : 'offline'}`;
  }
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

function setBusy(busy) {
  document.querySelectorAll('.action-button').forEach((button) => { button.disabled = busy; });
  const checkoutBtn = $('#checkout');
  if (checkoutBtn && !busy) checkoutBtn.disabled = cart.size === 0;
}

function openAdminLogin(message = '') {
  eventsSource?.close();
  eventsSource = null;
  const mainView = $('#admin-main-view');
  const loginView = $('#admin-login');
  if (mainView) mainView.hidden = true;
  if (loginView) loginView.hidden = false;
  const pinInput = $('#admin-pin-input');
  const pinError = $('#admin-pin-error');
  if (pinInput) pinInput.value = '';
  if (pinError) {
    pinError.textContent = message;
    pinError.hidden = !message;
  }
}

function openAdminMain() {
  const mainView = $('#admin-main-view');
  const loginView = $('#admin-login');
  if (loginView) loginView.hidden = true;
  if (mainView) mainView.hidden = false;
}

async function api(subPath, options = {}) {
  setBusy(true);
  clearError();
  const url = subPath.startsWith('/') ? `${apiBase}${subPath}` : subPath;
  try {
    const response = await fetch(url, {
      ...options,
      headers: options.body ? { 'content-type': 'application/json' } : undefined,
    });
    const payload = await response.json();
    if (response.status === 401 && !url.endsWith('/admin/login')) {
      openAdminLogin('Sesi berakhir, masukkan PIN Admin lagi.');
    }
    if (!response.ok) throw new Error(payload.error || 'Request gagal');
    setConnection(true);
    if (payload.state) applyState(payload.state);
    return payload;
  } catch (error) {
    setConnection(false);
    showError(error.message);
    throw error;
  } finally {
    setBusy(false);
  }
}

function applyState(nextState) {
  state = nextState;
  if (nextState.outletInfo) {
    const nameEl = $('#admin-outlet-name');
    const badgeEl = $('#admin-outlet-badge');
    if (nameEl) nameEl.textContent = nextState.outletInfo.name;
    if (badgeEl) badgeEl.textContent = `MAUCAFE - ${nextState.outletInfo.name.toUpperCase()}`;
  }
  renderProducts();
  renderOrders();
  renderMediaStatus();
}

function renderMediaStatus() {
  const currentMediaNode = $('#admin-current-media');
  if (!currentMediaNode) return;
  const promoMedia = state.promoMedia;
  if (!promoMedia || !promoMedia.filename) {
    currentMediaNode.innerHTML = 'Media aktif: <strong>Video Bawaan (promo.mp4)</strong>';
  } else {
    const typeLabel = promoMedia.type === 'image' ? 'Foto' : 'Video';
    currentMediaNode.innerHTML = `Media aktif: <strong>${typeLabel} (${promoMedia.filename})</strong>`;
  }
}

function renderProducts() {
  const grid = $('#product-grid');
  if (!grid) return;
  grid.replaceChildren();
  const products = (state.products || []).filter((product) => product.active);
  if (!products.length) grid.append(element('p', 'empty-state', 'Belum ada menu aktif.'));
  for (const product of products) {
    const button = element('button', 'product-card');
    button.type = 'button';
    button.append(element('span', 'product-category', product.category));
    button.append(element('strong', '', product.name));
    button.append(element('span', 'product-price', rupiah(product.price)));
    button.addEventListener('click', () => {
      cart.set(product.id, (cart.get(product.id) ?? 0) + 1);
      renderCart();
    });
    grid.append(button);
  }
}

function renderCart() {
  const container = $('#cart-items');
  if (!container) return;
  container.replaceChildren();
  let subtotal = 0;
  for (const [productId, quantity] of cart) {
    const product = (state.products || []).find((item) => item.id === productId);
    if (!product) continue;
    subtotal += product.price * quantity;
    const row = element('div', 'cart-row');
    const info = element('div');
    info.append(element('strong', '', product.name), element('small', '', rupiah(product.price * quantity)));
    const controls = element('div', 'quantity-controls');
    const minus = element('button', '', '−');
    const plus = element('button', '', '+');
    minus.type = plus.type = 'button';
    minus.setAttribute('aria-label', `Kurangi ${product.name}`);
    plus.setAttribute('aria-label', `Tambah ${product.name}`);
    minus.addEventListener('click', () => {
      if (quantity <= 1) cart.delete(productId); else cart.set(productId, quantity - 1);
      renderCart();
    });
    plus.addEventListener('click', () => { cart.set(productId, quantity + 1); renderCart(); });
    controls.append(minus, element('span', '', String(quantity)), plus);
    row.append(info, controls);
    container.append(row);
  }
  if (!cart.size) container.append(element('p', 'empty-state', 'Belum ada menu dipilih.'));

  const tax = state.taxConfig;
  const taxAmount = tax?.enabled ? Math.round(subtotal * (tax.rate ?? 0) / 100) : 0;
  const grandTotal = subtotal + taxAmount;

  const subtotalEl = $('#cart-subtotal');
  if (subtotalEl) subtotalEl.textContent = rupiah(subtotal);
  const taxRow = $('#cart-tax-row');
  if (tax?.enabled && taxRow) {
    taxRow.hidden = false;
    $('#cart-tax-label').textContent = `${tax.label || 'Pajak'} ${tax.rate}%`;
    $('#cart-tax-amount').textContent = rupiah(taxAmount);
  } else if (taxRow) {
    taxRow.hidden = true;
  }
  const totalEl = $('#cart-total');
  if (totalEl) totalEl.textContent = rupiah(grandTotal);
  const checkoutBtn = $('#checkout');
  if (checkoutBtn) checkoutBtn.disabled = cart.size === 0;
}

function actionButton(label, className, action) {
  const button = element('button', `${className} action-button`, label);
  button.addEventListener('click', action);
  return button;
}

function renderOrders() {
  const list = $('#orders-list');
  if (!list) return;
  list.replaceChildren();
  const active = (state.orders || []).filter((order) => ['waiting', 'ready'].includes(order.status)).reverse();
  const countEl = $('#order-count');
  if (countEl) countEl.textContent = String(active.length);
  if (!active.length) list.append(element('p', 'empty-state large', 'Belum ada pesanan aktif.'));

  for (const order of active) {
    const card = element('article', `order-card ${order.status}`);
    const top = element('div', 'order-top');
    top.append(element('strong', 'order-number', order.queueNumber), element('span', 'status-pill', order.status === 'ready' ? 'Siap' : 'Menunggu'));
    const summary = element('p', 'order-summary', order.items.map((item) => `${item.quantity}× ${item.productName}`).join(', '));
    const actions = element('div', 'order-actions');
    actions.append(
      actionButton(order.status === 'ready' ? 'Panggil ulang' : 'Panggil', 'primary', () => api(`/orders/${order.id}/call`, { method: 'POST', body: '{}' }).catch(() => {})),
      actionButton('Selesai', 'success', () => api(`/orders/${order.id}/complete`, { method: 'POST', body: '{}' }).catch(() => {})),
      actionButton('Batal', 'ghost danger', () => {
        if (window.confirm(`Batalkan pesanan ${order.queueNumber}?`)) api(`/orders/${order.id}/cancel`, { method: 'POST', body: '{}' }).catch(() => {});
      }),
    );
    card.append(top, summary, actions);
    list.append(card);
  }
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
  });
});

$('#checkout')?.addEventListener('click', async () => {
  try {
    const payload = await api('/orders', {
      method: 'POST',
      body: JSON.stringify({ items: [...cart].map(([productId, quantity]) => ({ productId, quantity })), paymentMethod }),
    });
    cart.clear();
    renderCart();
    toast(`Pesanan ${payload.order.queueNumber} berhasil dibuat`);
  } catch {}
});

const mediaForm = $('#admin-media-form');
if (mediaForm) {
  mediaForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = $('#admin-media-file');
    const statusMsg = $('#admin-media-status');
    const file = fileInput.files[0];
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
        await api('/media/upload', {
          method: 'POST',
          body: JSON.stringify({ filename: file.name, dataUrl: reader.result }),
        });
        statusMsg.textContent = 'Media berhasil diunggah & langsung tayang di TV!';
        statusMsg.className = 'media-status-msg success';
        fileInput.value = '';
        toast('Media TV berhasil diperbarui');
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

const resetMediaBtn = $('#admin-reset-media-btn');
if (resetMediaBtn) {
  resetMediaBtn.addEventListener('click', async () => {
    const statusMsg = $('#admin-media-status');
    try {
      await api('/media/reset', { method: 'POST', body: '{}' });
      statusMsg.hidden = false;
      statusMsg.textContent = 'Media dikembalikan ke video bawaan';
      statusMsg.className = 'media-status-msg success';
      toast('Media TV dikembalikan ke video bawaan');
    } catch (err) {
      statusMsg.hidden = false;
      statusMsg.textContent = err.message || 'Gagal mereset media';
      statusMsg.className = 'media-status-msg error';
    }
  });
}

document.querySelectorAll('.key-btn[data-key]').forEach((button) => {
  button.addEventListener('click', () => {
    const input = $('#admin-pin-input');
    if (input && input.value.length < 8) input.value += button.dataset.key;
    const pinErr = $('#admin-pin-error');
    if (pinErr) pinErr.hidden = true;
  });
});

$('#admin-key-clear')?.addEventListener('click', () => {
  const input = $('#admin-pin-input');
  if (input) input.value = '';
  const pinErr = $('#admin-pin-error');
  if (pinErr) pinErr.hidden = true;
});

$('#admin-pin-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const pin = $('#admin-pin-input')?.value;
  try {
    const payload = await api('/admin/login', {
      method: 'POST',
      body: JSON.stringify({ pin }),
    });
    openAdminMain();
    if (payload.outlet) {
      const nameEl = $('#admin-outlet-name');
      if (nameEl) nameEl.textContent = payload.outlet.name;
    }
    connect();
  } catch (error) {
    const pinErr = $('#admin-pin-error');
    if (pinErr) {
      pinErr.textContent = error.message;
      pinErr.hidden = false;
    }
    const input = $('#admin-pin-input');
    if (input) input.value = '';
  }
});

$('#admin-logout-btn')?.addEventListener('click', async () => {
  try {
    await api('/admin/logout', { method: 'POST', body: '{}' });
  } finally {
    openAdminLogin();
  }
});

async function checkSession() {
  try {
    const res = await fetch(`${apiBase}/admin/session`, { cache: 'no-store' });
    const data = await res.json();
    if (data.outlet) {
      const titleEl = $('#admin-login-title');
      const tagEl = $('#admin-login-outlet-tag');
      const nameEl = $('#admin-outlet-name');
      const badgeEl = $('#admin-outlet-badge');
      if (titleEl) titleEl.textContent = `Panel Kasir ${data.outlet.name}`;
      if (tagEl) tagEl.textContent = `MAUCAFE - ${data.outlet.name.toUpperCase()}`;
      if (nameEl) nameEl.textContent = data.outlet.name;
      if (badgeEl) badgeEl.textContent = `MAUCAFE - ${data.outlet.name.toUpperCase()}`;
    }
    if (data.authenticated) {
      openAdminMain();
      connect();
    } else {
      openAdminLogin();
    }
  } catch {
    openAdminLogin('Gagal terhubung ke server');
  }
}

async function connect() {
  try {
    const response = await fetch(`${apiBase}/state`, { cache: 'no-store' });
    if (!response.ok) throw new Error('Server tidak merespons');
    applyState(await response.json());
    setConnection(true);
  } catch (error) {
    setConnection(false);
    showError(error.message);
  }

  eventsSource?.close();
  eventsSource = new EventSource(`${apiBase}/events`);
  eventsSource.onmessage = (event) => { applyState(JSON.parse(event.data)); setConnection(true); clearError(); };
  eventsSource.onerror = () => setConnection(false);
}

renderCart();
checkSession();
