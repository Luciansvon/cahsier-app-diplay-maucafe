import { randomUUID } from 'node:crypto';

const PAYMENT_METHODS = new Set(['cash', 'QRIS']);

function clone(value) {
  return structuredClone(value);
}

function jakartaDate(now) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(now));
}

function requireText(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} wajib diisi`);
  return value.trim();
}

function requirePrice(value) {
  if (!Number.isInteger(value) || value < 0) throw new Error('Harga harus bilangan bulat positif');
  return value;
}

function findOrder(state, orderId) {
  const order = state.orders.find((item) => item.id === orderId);
  if (!order) throw new Error('Pesanan tidak ditemukan');
  return order;
}

function changed(state) {
  state.revision = (state.revision ?? 0) + 1;
  return state;
}

export function createInitialState({ products = [] } = {}) {
  return {
    businessDate: null,
    nextQueueNumber: 1,
    products: clone(products),
    orders: [],
    activeCall: null,
    revision: 0,
  };
}

export function createOrder(currentState, input, now = new Date().toISOString()) {
  const state = clone(currentState);
  if (!Array.isArray(input?.items) || input.items.length === 0) throw new Error('Item pesanan wajib diisi');

  const paymentMethod = input.paymentMethod === 'qris' ? 'QRIS' : input.paymentMethod;
  if (!PAYMENT_METHODS.has(paymentMethod)) throw new Error('Metode pembayaran tidak valid');

  const businessDate = jakartaDate(now);
  if (state.businessDate !== businessDate) {
    state.businessDate = businessDate;
    state.nextQueueNumber = 1;
  }

  const items = input.items.map(({ productId, quantity }) => {
    const product = state.products.find((candidate) => candidate.id === productId && candidate.active !== false);
    if (!product) throw new Error('Produk tidak ditemukan atau sedang nonaktif');
    if (!Number.isInteger(quantity) || quantity < 1) throw new Error('Jumlah item minimal satu');
    return {
      productId: product.id,
      productName: product.name,
      unitPrice: product.price,
      quantity,
      subtotal: product.price * quantity,
    };
  });

  const order = {
    id: randomUUID(),
    queueNumber: String(state.nextQueueNumber).padStart(3, '0'),
    businessDate,
    paymentMethod,
    items,
    total: items.reduce((sum, item) => sum + item.subtotal, 0),
    status: 'waiting',
    createdAt: now,
    updatedAt: now,
  };

  state.nextQueueNumber += 1;
  state.orders.push(order);
  return { state: changed(state), order };
}

export function callOrder(currentState, orderId, now = new Date().toISOString()) {
  const state = clone(currentState);
  const order = findOrder(state, orderId);
  if (!['waiting', 'ready'].includes(order.status)) throw new Error('Pesanan ini tidak dapat dipanggil');

  order.status = 'ready';
  order.updatedAt = now;
  state.activeCall = {
    orderId: order.id,
    queueNumber: order.queueNumber,
    eventId: (state.activeCall?.eventId ?? 0) + 1,
    calledAt: now,
  };
  return { state: changed(state), order };
}

export function completeOrder(currentState, orderId, now = new Date().toISOString()) {
  const state = clone(currentState);
  const order = findOrder(state, orderId);
  if (['completed', 'cancelled'].includes(order.status)) throw new Error('Pesanan ini sudah ditutup');
  order.status = 'completed';
  order.updatedAt = now;
  return { state: changed(state), order };
}

export function cancelOrder(currentState, orderId, now = new Date().toISOString()) {
  const state = clone(currentState);
  const order = findOrder(state, orderId);
  if (order.status === 'completed') throw new Error('Pesanan selesai tidak dapat dibatalkan');
  order.status = 'cancelled';
  order.updatedAt = now;
  return { state: changed(state), order };
}

export function resetQueue(currentState, now = new Date().toISOString()) {
  const state = clone(currentState);
  state.businessDate = jakartaDate(now);
  state.nextQueueNumber = 1;
  for (const order of state.orders) {
    if (['waiting', 'ready'].includes(order.status)) {
      order.status = 'cancelled';
      order.updatedAt = now;
    }
  }
  state.activeCall = null;
  return changed(state);
}

export function addProduct(currentState, input) {
  const state = clone(currentState);
  const product = {
    id: randomUUID(),
    name: requireText(input?.name, 'Nama produk'),
    category: requireText(input?.category, 'Kategori'),
    price: requirePrice(input?.price),
    active: input?.active !== false,
  };
  state.products.push(product);
  return { state: changed(state), product };
}

export function updateProduct(currentState, productId, input) {
  const state = clone(currentState);
  const product = state.products.find((candidate) => candidate.id === productId);
  if (!product) throw new Error('Produk tidak ditemukan');
  if ('name' in input) product.name = requireText(input.name, 'Nama produk');
  if ('category' in input) product.category = requireText(input.category, 'Kategori');
  if ('price' in input) product.price = requirePrice(input.price);
  if ('active' in input) product.active = Boolean(input.active);
  return { state: changed(state), product };
}
