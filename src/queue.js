import { randomUUID } from 'node:crypto';
import { createPinHash, validatePin, verifyPinHash } from './security.js';

const PAYMENT_METHODS = new Set(['cash', 'QRIS']);
const MAX_ORDER_LINES = 100;

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

function requireText(value, label, maxLength = 120) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} wajib diisi`);
  const text = value.trim();
  if (text.length > maxLength) throw new Error(`${label} maksimal ${maxLength} karakter`);
  return text;
}

function requirePrice(value) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 1_000_000_000) throw new Error('Harga harus bilangan bulat antara 0 dan 1 miliar');
  return value;
}

function requireCost(value) {
  if (value === undefined || value === null) return 0;
  if (!Number.isSafeInteger(value) || value < 0 || value > 1_000_000_000) throw new Error('Harga modal harus bilangan bulat antara 0 dan 1 miliar');
  return value;
}

function requireCupUsage(value) {
  if (value === undefined || value === null) return 0;
  if (!Number.isSafeInteger(value) || value < 0 || value > 10) {
    throw new Error('Pemakaian cup harus bilangan bulat antara 0 dan 10');
  }
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
  const promoMedia = {
    type: 'video',
    url: '/media/promo.mp4',
    filename: 'promo.mp4',
    fit: 'cover',
    updatedAt: new Date().toISOString(),
  };
  return {
    businessDate: null,
    nextQueueNumber: 1,
    nextCallEventId: 1,
    products: clone(products),
    orders: [],
    shifts: [],
    operationalEntries: [],
    inventoryMovements: [],
    activeCall: null,
    promoMedia,
    mediaPlaylist: [{
      id: 'default-promo',
      ...clone(promoMedia),
      durationSeconds: null,
      imageDurationSeconds: 8,
      active: true,
    }],
    revision: 0,
    schemaVersion: 3,
  };
}

export function rolloverBusinessDay(currentState, now = new Date().toISOString()) {
  const state = clone(currentState);
  const businessDate = jakartaDate(now);
  if (state.businessDate === businessDate) return state;

  state.businessDate = businessDate;
  state.nextQueueNumber = 1;
  for (const order of state.orders ?? []) {
    if (['waiting', 'ready'].includes(order.status)) {
      order.status = 'expired';
      order.expiredAt = now;
      order.expiredReason = 'Pergantian hari operasional';
      order.updatedAt = now;
    }
  }
  state.activeCall = null;
  return changed(state);
}

export function createOrder(currentState, input, now = new Date().toISOString()) {
  let state = clone(currentState);
  if (!Array.isArray(input?.items) || input.items.length === 0) throw new Error('Item pesanan wajib diisi');
  if (input.items.length > MAX_ORDER_LINES) throw new Error(`Item pesanan maksimal ${MAX_ORDER_LINES} baris`);

  const requestId = input.requestId === undefined || input.requestId === null
    ? null
    : requireText(input.requestId, 'ID permintaan', 100);
  const existingOrder = requestId ? state.orders.find((order) => order.requestId === requestId) : null;
  if (existingOrder) return { state, order: existingOrder, duplicate: true };

  const paymentMethod = input.paymentMethod === 'qris' ? 'QRIS' : input.paymentMethod;
  if (!PAYMENT_METHODS.has(paymentMethod)) throw new Error('Metode pembayaran tidak valid');

  const businessDate = jakartaDate(now);
  state = rolloverBusinessDay(state, now);

  const items = input.items.map(({ productId, quantity }) => {
    const product = state.products.find((candidate) => candidate.id === productId && candidate.active !== false);
    if (!product) throw new Error('Produk tidak ditemukan atau sedang nonaktif');
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 999) throw new Error('Jumlah item harus bilangan bulat antara 1 dan 999');
    const subtotal = product.price * quantity;
    if (!Number.isSafeInteger(subtotal)) throw new Error('Total pesanan terlalu besar');
    return {
      productId: product.id,
      productName: product.name,
      unitPrice: product.price,
      unitCost: product.cost ?? 0,
      cupUsage: requireCupUsage(product.cupUsage),
      category: product.category || 'Lainnya',
      quantity,
      subtotal,
    };
  });

  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  if (!Number.isSafeInteger(subtotal)) throw new Error('Total pesanan terlalu besar');

  const order = {
    id: randomUUID(),
    ...(requestId ? { requestId } : {}),
    queueNumber: String(state.nextQueueNumber),
    businessDate,
    paymentMethod,
    paymentStatus: 'paid',
    ...(input.shiftId || input.employeeId || input.employeeName ? {
      shiftId: requireText(input.shiftId, 'Shift', 100),
      employeeId: requireText(input.employeeId, 'ID karyawan', 100),
      employeeName: requireText(input.employeeName, 'Nama karyawan', 120),
    } : {}),
    items,
    total: subtotal,
    grandTotal: subtotal,
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
    eventId: state.nextCallEventId ?? 1,
    calledAt: now,
  };
  state.nextCallEventId = (state.nextCallEventId ?? 1) + 1;
  return { state: changed(state), order };
}

export function completeOrder(currentState, orderId, now = new Date().toISOString()) {
  const state = clone(currentState);
  const order = findOrder(state, orderId);
  if (['completed', 'cancelled', 'expired'].includes(order.status)) throw new Error('Pesanan ini sudah ditutup');
  order.status = 'completed';
  order.updatedAt = now;
  if (state.activeCall?.orderId === order.id) state.activeCall = null;
  return { state: changed(state), order };
}

export function cancelOrder(currentState, orderId, details = {}, now = new Date().toISOString()) {
  const state = clone(currentState);
  const order = findOrder(state, orderId);
  if (order.status === 'completed') throw new Error('Pesanan selesai tidak dapat dibatalkan');
  if (['cancelled', 'expired'].includes(order.status)) throw new Error('Pesanan ini sudah ditutup');
  const reason = requireText(details?.reason, 'Alasan pembatalan', 300);
  order.status = 'cancelled';
  order.paymentStatus = 'void';
  order.cancelledAt = now;
  order.cancelReason = reason;
  order.cancelledBy = details?.cancelledBy || 'admin';
  order.approvedBy = details?.approvedBy || 'owner';
  order.updatedAt = now;
  if (state.activeCall?.orderId === order.id) state.activeCall = null;
  return { state: changed(state), order };
}

export function resetQueue(currentState, now = new Date().toISOString()) {
  const state = clone(currentState);
  state.businessDate = jakartaDate(now);
  state.nextQueueNumber = 1;
  for (const order of state.orders) {
    if (['waiting', 'ready'].includes(order.status)) {
      order.status = 'expired';
      order.expiredAt = now;
      order.expiredReason = 'Reset antrean oleh Owner';
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
    name: requireText(input?.name, 'Nama produk', 100),
    category: requireText(input?.category, 'Kategori', 60),
    price: requirePrice(input?.price),
    cost: requireCost(input?.cost),
    cupUsage: requireCupUsage(input?.cupUsage),
    active: input?.active !== false,
  };
  state.products.push(product);
  return { state: changed(state), product };
}

export function updateProduct(currentState, productId, input) {
  const state = clone(currentState);
  const product = state.products.find((candidate) => candidate.id === productId);
  if (!product) throw new Error('Produk tidak ditemukan');
  if ('name' in input) product.name = requireText(input.name, 'Nama produk', 100);
  if ('category' in input) product.category = requireText(input.category, 'Kategori', 60);
  if ('price' in input) product.price = requirePrice(input.price);
  if ('cost' in input) product.cost = requireCost(input.cost);
  if ('cupUsage' in input) product.cupUsage = requireCupUsage(input.cupUsage);
  if ('active' in input) product.active = Boolean(input.active);
  return { state: changed(state), product };
}

export function setProductImage(currentState, productId, imageUrl) {
  const state = clone(currentState);
  const product = state.products.find((candidate) => candidate.id === productId);
  if (!product) throw new Error('Produk tidak ditemukan');
  const normalized = String(imageUrl ?? '').trim();
  if (!/^\/media\/uploaded-product-[A-Za-z0-9_-]+-\d+(?:-[a-f0-9]+)?\.(?:png|jpg|webp)$/.test(normalized)) {
    throw new Error('URL foto produk tidak valid');
  }
  product.imageUrl = normalized;
  return { state: changed(state), product };
}

function createOwnerPinHash(pin) {
  return createPinHash(pin);
}

export function verifyOwnerPin(currentState, inputPin) {
  if (!currentState || typeof currentState !== 'object') return false;
  if (currentState.ownerPinHash) return verifyPinHash(currentState.ownerPinHash, inputPin);
  if (currentState.ownerPin) return String(inputPin ?? '').trim() === String(currentState.ownerPin).trim();
  return false;
}

export function migrateOwnerPin(currentState, inputPin) {
  if (!verifyOwnerPin(currentState, inputPin)) throw new Error('PIN Pemilik tidak valid');
  if (currentState.ownerPinHash && !currentState.ownerPin) return currentState;
  const state = clone(currentState);
  state.ownerPinHash = createOwnerPinHash(inputPin);
  delete state.ownerPin;
  return state;
}

export function updateOwnerPin(currentState, currentPin, newPin) {
  const state = clone(currentState);
  if (!verifyOwnerPin(state, currentPin)) throw new Error('PIN saat ini tidak valid');
  const formattedNewPin = validatePin(newPin, 'PIN baru');
  state.ownerPinHash = createOwnerPinHash(formattedNewPin);
  delete state.ownerPin;
  return { state: changed(state) };
}

export function purgeOldOrders(currentState, daysToKeep = 30, now = new Date().toISOString()) {
  if (!Number.isSafeInteger(daysToKeep) || daysToKeep < 1 || daysToKeep > 3650) {
    throw new Error('Retensi laporan harus bilangan bulat antara 1 dan 3650 hari');
  }
  const state = clone(currentState);
  const cutoffMs = new Date(now).getTime() - daysToKeep * 24 * 60 * 60 * 1000;
  state.orders = state.orders.filter((order) => {
    if (['waiting', 'ready'].includes(order.status)) return true;
    const createdMs = new Date(order.createdAt).getTime();
    return createdMs >= cutoffMs;
  });
  return changed(state);
}

export function clearAllOrders(currentState) {
  const state = clone(currentState);
  state.orders = [];
  state.activeCall = null;
  state.nextQueueNumber = 1;
  return changed(state);
}

export function updatePromoMedia(currentState, { type, url, filename, fit = 'cover' }, now = new Date().toISOString()) {
  const state = clone(currentState);
  if (!['video', 'image'].includes(type)) throw new Error('Tipe media tidak valid');
  if (typeof url !== 'string' || !url.trim()) throw new Error('URL media wajib diisi');
  if (!['cover', 'contain'].includes(fit)) throw new Error('Mode tampilan media tidak valid');
  state.promoMedia = {
    type,
    url: url.trim(),
    filename: filename ? String(filename).trim().slice(0, 120) : 'custom-promo',
    fit,
    updatedAt: now,
  };
  return { state: changed(state), promoMedia: state.promoMedia };
}

export function resetPromoMedia(currentState, now = new Date().toISOString()) {
  const state = clone(currentState);
  state.promoMedia = {
    type: 'video',
    url: '/media/promo.mp4',
    filename: 'promo.mp4',
    fit: 'cover',
    updatedAt: now,
  };
  return { state: changed(state), promoMedia: state.promoMedia };
}
