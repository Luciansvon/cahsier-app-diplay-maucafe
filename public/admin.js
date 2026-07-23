import { summarizeSales } from '/sales.js';

let state = { products: [], orders: [], activeCall: null };
const cart = new Map();
let paymentMethod = 'cash';

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
  status.textContent = online ? 'Terhubung' : 'Koneksi terputus';
  status.className = `connection ${online ? 'online' : 'offline'}`;
}

function showError(message) {
  const banner = $('#error-banner');
  banner.textContent = message;
  banner.hidden = false;
}

function clearError() {
  $('#error-banner').hidden = true;
}

function toast(message) {
  const node = $('#success-toast');
  node.textContent = message;
  node.hidden = false;
  window.setTimeout(() => { node.hidden = true; }, 2400);
}

function setBusy(busy) {
  document.querySelectorAll('.action-button').forEach((button) => { button.disabled = busy; });
  if (!busy) $('#checkout').disabled = cart.size === 0;
}

async function api(path, options = {}) {
  setBusy(true);
  clearError();
  try {
    const response = await fetch(path, {
      ...options,
      headers: options.body ? { 'content-type': 'application/json' } : undefined,
    });
    const payload = await response.json();
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
  renderProducts();
  renderOrders();
  renderSales();
  renderMenu();
}

function renderProducts() {
  const grid = $('#product-grid');
  grid.replaceChildren();
  const products = state.products.filter((product) => product.active);
  if (!products.length) grid.append(element('p', 'empty-state', 'Belum ada menu aktif. Tambahkan dari tab Menu.'));
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
  container.replaceChildren();
  let total = 0;
  for (const [productId, quantity] of cart) {
    const product = state.products.find((item) => item.id === productId);
    if (!product) continue;
    total += product.price * quantity;
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
  $('#cart-total').textContent = rupiah(total);
  $('#checkout').disabled = cart.size === 0;
}

function actionButton(label, className, action) {
  const button = element('button', `${className} action-button`, label);
  button.addEventListener('click', action);
  return button;
}

function renderOrders() {
  const list = $('#orders-list');
  list.replaceChildren();
  const active = state.orders.filter((order) => ['waiting', 'ready'].includes(order.status)).reverse();
  $('#order-count').textContent = String(active.length);
  if (!active.length) list.append(element('p', 'empty-state large', 'Belum ada pesanan aktif.'));

  for (const order of active) {
    const card = element('article', `order-card ${order.status}`);
    const top = element('div', 'order-top');
    top.append(element('strong', 'order-number', order.queueNumber), element('span', 'status-pill', order.status === 'ready' ? 'Siap' : 'Menunggu'));
    const summary = element('p', 'order-summary', order.items.map((item) => `${item.quantity}× ${item.productName}`).join(', '));
    const actions = element('div', 'order-actions');
    actions.append(
      actionButton(order.status === 'ready' ? 'Panggil ulang' : 'Panggil', 'primary', () => api(`/api/orders/${order.id}/call`, { method: 'POST', body: '{}' }).catch(() => {})),
      actionButton('Selesai', 'success', () => api(`/api/orders/${order.id}/complete`, { method: 'POST', body: '{}' }).catch(() => {})),
      actionButton('Batal', 'ghost danger', () => {
        if (window.confirm(`Batalkan pesanan ${order.queueNumber}?`)) api(`/api/orders/${order.id}/cancel`, { method: 'POST', body: '{}' }).catch(() => {});
      }),
    );
    card.append(top, summary, actions);
    list.append(card);
  }
}

const saleStatus = {
  waiting: 'Dibayar',
  ready: 'Siap',
  completed: 'Selesai',
  cancelled: 'Batal',
};

function transactionTime(value) {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(value));
}

function renderSales() {
  const summary = summarizeSales(state.orders, state.businessDate);
  $('#sales-revenue').textContent = rupiah(summary.revenue);
  $('#sales-count').textContent = String(summary.transactionCount);
  $('#sales-cash').textContent = rupiah(summary.paymentTotals.cash);
  $('#sales-qris').textContent = rupiah(summary.paymentTotals.QRIS);

  const products = $('#sold-products');
  products.replaceChildren();
  if (!summary.products.length) products.append(element('p', 'empty-state', 'Belum ada produk terjual.'));
  for (const product of summary.products) {
    const row = element('div', 'sold-product-row');
    const info = element('div');
    info.append(element('strong', '', product.productName), element('small', '', rupiah(product.revenue)));
    row.append(info, element('strong', 'sold-quantity', `${product.quantity} item`));
    products.append(row);
  }

  const list = $('#sales-list');
  list.replaceChildren();
  if (!summary.transactions.length) list.append(element('p', 'empty-state large', 'Belum ada transaksi hari ini.'));
  for (const order of summary.transactions) {
    const row = element('article', `sale-row ${order.status}`);
    const top = element('div', 'sale-top');
    const identity = element('div');
    identity.append(element('strong', 'sale-number', order.queueNumber), element('small', '', transactionTime(order.createdAt)));
    top.append(identity, element('span', 'status-pill', saleStatus[order.status]));
    const items = element('p', 'sale-items', order.items.map((item) => `${item.quantity}× ${item.productName}`).join(', '));
    const meta = element('div', 'sale-meta');
    meta.append(element('span', '', order.paymentMethod === 'cash' ? 'Tunai' : 'QRIS'), element('strong', '', rupiah(order.total)));
    row.append(top, items, meta);
    list.append(row);
  }
}

function resetProductForm() {
  $('#product-form').reset();
  $('#product-id').value = '';
  $('#cancel-edit').hidden = true;
}

function renderMenu() {
  const list = $('#menu-list');
  list.replaceChildren();
  for (const product of state.products) {
    const row = element('div', `menu-row ${product.active ? '' : 'inactive'}`);
    const info = element('div');
    info.append(element('strong', '', product.name), element('small', '', `${product.category} · ${rupiah(product.price)}`));
    const actions = element('div', 'menu-actions');
    const edit = element('button', 'ghost', 'Edit');
    edit.addEventListener('click', () => {
      $('#product-id').value = product.id;
      $('#product-name').value = product.name;
      $('#product-category').value = product.category;
      $('#product-price').value = product.price;
      $('#cancel-edit').hidden = false;
      $('#product-name').focus();
    });
    const toggle = element('button', 'ghost action-button', product.active ? 'Nonaktifkan' : 'Aktifkan');
    toggle.addEventListener('click', () => api(`/api/products/${product.id}`, { method: 'PATCH', body: JSON.stringify({ active: !product.active }) }).catch(() => {}));
    actions.append(edit, toggle);
    row.append(info, actions);
    list.append(row);
  }
}

document.querySelectorAll('.tab').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.tab, .panel').forEach((node) => node.classList.remove('active'));
    button.classList.add('active');
    $(`#${button.dataset.tab}`).classList.add('active');
  });
});

document.querySelectorAll('.payment').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.payment').forEach((node) => node.classList.remove('active'));
    button.classList.add('active');
    paymentMethod = button.dataset.payment;
  });
});

$('#checkout').addEventListener('click', async () => {
  try {
    const payload = await api('/api/orders', {
      method: 'POST',
      body: JSON.stringify({ items: [...cart].map(([productId, quantity]) => ({ productId, quantity })), paymentMethod }),
    });
    cart.clear();
    renderCart();
    toast(`Pesanan ${payload.order.queueNumber} berhasil dibuat`);
  } catch {}
});

$('#reset-queue').addEventListener('click', () => {
  if (window.confirm('Reset antrean? Semua pesanan aktif akan dibatalkan, tetapi riwayat penjualan tetap disimpan.')) {
    api('/api/reset', { method: 'POST', body: '{}' }).then(() => toast('Antrean berhasil direset')).catch(() => {});
  }
});

$('#product-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const id = $('#product-id').value;
  const body = JSON.stringify({
    name: $('#product-name').value,
    category: $('#product-category').value,
    price: Number($('#product-price').value),
  });
  try {
    await api(id ? `/api/products/${id}` : '/api/products', { method: id ? 'PATCH' : 'POST', body });
    resetProductForm();
    toast(id ? 'Menu diperbarui' : 'Menu ditambahkan');
  } catch {}
});

$('#cancel-edit').addEventListener('click', resetProductForm);

async function connect() {
  try {
    const response = await fetch('/api/state', { cache: 'no-store' });
    if (!response.ok) throw new Error('Server tidak merespons');
    applyState(await response.json());
    setConnection(true);
  } catch (error) {
    setConnection(false);
    showError(error.message);
  }

  const events = new EventSource('/api/events');
  events.onmessage = (event) => { applyState(JSON.parse(event.data)); setConnection(true); clearError(); };
  events.onerror = () => setConnection(false);
}

renderCart();
connect();
