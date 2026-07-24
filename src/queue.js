import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';

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

function requireCost(value) {
  if (value === undefined || value === null) return 0;
  if (!Number.isInteger(value) || value < 0) throw new Error('Harga modal harus bilangan bulat positif atau nol');
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
    promoMedia: {
      type: 'video',
      url: '/media/promo.mp4',
      filename: 'promo.mp4',
      updatedAt: new Date().toISOString(),
    },
    taxConfig: {
      enabled: false,
      label: 'Pajak',
      rate: 10,
    },
    ownerPinHash: createOwnerPinHash(DEFAULT_OWNER_PIN),
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
      unitCost: product.cost ?? 0,
      quantity,
      subtotal: product.price * quantity,
    };
  });

  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const tax = state.taxConfig;
  const taxAmount = tax?.enabled ? Math.round(subtotal * (tax.rate ?? 0) / 100) : 0;
  const grandTotal = subtotal + taxAmount;

  const order = {
    id: randomUUID(),
    queueNumber: String(state.nextQueueNumber).padStart(3, '0'),
    businessDate,
    paymentMethod,
    items,
    total: subtotal,
    taxLabel: tax?.enabled ? (tax.label || 'Pajak') : null,
    taxRate: tax?.enabled ? (tax.rate ?? 0) : 0,
    taxAmount,
    grandTotal,
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
    cost: requireCost(input?.cost),
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
  if ('cost' in input) product.cost = requireCost(input.cost);
  if ('active' in input) product.active = Boolean(input.active);
  return { state: changed(state), product };
}

export function updateTaxConfig(currentState, input) {
  const state = clone(currentState);
  if (!input || typeof input !== 'object') throw new Error('Pengaturan pajak tidak valid');
  const config = state.taxConfig ?? { enabled: false, label: 'Pajak', rate: 10 };
  if ('enabled' in input) config.enabled = Boolean(input.enabled);
  if ('label' in input) {
    const label = String(input.label ?? '').trim();
    if (!label) throw new Error('Label pajak wajib diisi');
    config.label = label;
  }
  if ('rate' in input) {
    const rate = Number(input.rate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) throw new Error('Tarif pajak harus antara 0 dan 100');
    config.rate = rate;
  }
  state.taxConfig = config;
  return { state: changed(state), taxConfig: config };
}

export const DEFAULT_OWNER_PIN = '1234';

function createOwnerPinHash(pin) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(String(pin), salt, 32).toString('hex');
  return { salt, hash };
}

function verifyOwnerPinHash(record, inputPin) {
  if (!record?.salt || !record?.hash) return false;
  const expected = Buffer.from(record.hash, 'hex');
  const actual = scryptSync(String(inputPin ?? '').trim(), record.salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function verifyOwnerPin(currentStateOrPin, inputPin) {
  if (typeof currentStateOrPin === 'object' && currentStateOrPin !== null) {
    if (currentStateOrPin.ownerPinHash) {
      return verifyOwnerPinHash(currentStateOrPin.ownerPinHash, inputPin);
    }
    const legacyPin = currentStateOrPin.ownerPin || DEFAULT_OWNER_PIN;
    return String(inputPin ?? '').trim() === String(legacyPin).trim();
  }
  return String(currentStateOrPin).trim() === DEFAULT_OWNER_PIN;
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
  if (!verifyOwnerPin(state, currentPin)) {
    throw new Error('PIN saat ini tidak valid');
  }
  const formattedNewPin = String(newPin ?? '').trim();
  if (!/^\d{4,8}$/.test(formattedNewPin)) {
    throw new Error('PIN baru harus berupa 4 hingga 8 angka');
  }
  state.ownerPinHash = createOwnerPinHash(formattedNewPin);
  delete state.ownerPin;
  return { state: changed(state) };
}

export function purgeOldOrders(currentState, daysToKeep = 30, now = new Date().toISOString()) {
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

export function updatePromoMedia(currentState, { type, url, filename }, now = new Date().toISOString()) {
  const state = clone(currentState);
  if (!['video', 'image'].includes(type)) throw new Error('Tipe media tidak valid');
  if (typeof url !== 'string' || !url.trim()) throw new Error('URL media wajib diisi');
  state.promoMedia = {
    type,
    url: url.trim(),
    filename: filename ? String(filename).trim() : 'custom-promo',
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
    updatedAt: now,
  };
  return { state: changed(state), promoMedia: state.promoMedia };
}
