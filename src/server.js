import http from 'node:http';
import { createReadStream } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  addProduct,
  bulkUpsertMasterProducts,
  callOrder,
  cancelOrder,
  clearAllOrders,
  completeOrder,
  createInitialState,
  createOrder,
  purgeOldOrders,
  removeProduct,
  resetPromoMedia,
  resetQueue,
  rolloverBusinessDay,
  setProductImage,
  updateOwnerPin,
  updateProduct,
  updatePromoMedia,
  validateBulkProductRows,
  verifyOwnerPin,
} from './queue.js';
import {
  approveOutlet,
  authenticateUser,
  createEmployee,
  createPartner,
  normalizeRegistry,
  partnerOwnsOutlet,
  proposeOutlet,
  safeRegistry,
  updateEmployee,
} from './franchise.js';
import {
  closeShift,
  forceCloseShift,
  inventorySummary,
  openShift,
  recordInventoryMovement,
  recordOperationalEntry,
} from './operations.js';
import {
  addMediaItem,
  mediaDurationSeconds,
  removeMediaItem,
  reorderMediaItems,
} from './media.js';
import {
  createPinHash,
  LoginLimiter,
  matchingCredentialKeys,
  validatePin,
  verifyPinHash,
} from './security.js';
import {
  importLegacyJson,
  SqliteDatabase,
  SqliteStore,
} from './sqlite-store.js';
import { buildSalesWorkbook } from './report-export.js';
import { summarizeSales } from '../public/sales.js';

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = dirname(MODULE_DIR);
const CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};
const MAX_MEDIA_BYTES = 25 * 1024 * 1024;
const MAX_PROMO_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_MEDIA_STORAGE_BYTES = 100 * 1024 * 1024;
const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;
const NATIVE_ORIGINS = new Set(['http://localhost', 'https://localhost', 'capacitor://localhost']);

function jakartaToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function detectMedia(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) return { ext: '.png', type: 'image', mime: 'image/png' };
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return { ext: '.jpg', type: 'image', mime: 'image/jpeg' };
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return { ext: '.webp', type: 'image', mime: 'image/webp' };
  if (buffer.toString('ascii', 4, 8) === 'ftyp') return { ext: '.mp4', type: 'video', mime: 'video/mp4' };
  if (buffer.subarray(0, 4).equals(Buffer.from([0x1A, 0x45, 0xDF, 0xA3]))) return { ext: '.webm', type: 'video', mime: 'video/webm' };
  return null;
}

function safeMediaLabel(filename, fallback) {
  const cleaned = String(filename ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 120);
  return cleaned || fallback;
}

function uploadSuffix() {
  return `${Date.now()}-${randomBytes(4).toString('hex')}`;
}

async function removeManagedMedia(publicDir, promoMedia) {
  const url = promoMedia?.url;
  if (typeof url !== 'string' || !/^\/media\/uploaded-promo-[A-Za-z0-9_-]+-\d+(?:-[a-f0-9]+)?\.[A-Za-z0-9]+$/.test(url)) return;
  try {
    await unlink(join(publicDir, url));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function removeManagedProductImage(publicDir, imageUrl) {
  if (typeof imageUrl !== 'string' || !/^\/media\/uploaded-product-[A-Za-z0-9_-]+-\d+(?:-[a-f0-9]+)?\.(?:png|jpg|webp)$/.test(imageUrl)) return;
  try {
    await unlink(join(publicDir, imageUrl));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}


function sendJson(response, status, payload, headers = {}) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...securityHeaders('application/json'),
    ...headers,
  });
  response.end(JSON.stringify(payload));
}

function withoutCredentials(state) {
  const copy = structuredClone(state);
  delete copy.ownerPin;
  delete copy.ownerPinHash;
  return copy;
}

function publicProduct(product) {
  return {
    id: product.id,
    name: product.name,
    category: product.category,
    price: product.price,
    active: product.active !== false,
    ...(product.imageUrl ? { imageUrl: product.imageUrl } : {}),
  };
}

function cashierOrder(order) {
  return {
    ...structuredClone(order),
    items: (order.items ?? []).map(({ unitCost, ...item }) => item),
  };
}

function displayState(state) {
  return {
    products: (state.products ?? []).filter((product) => product.active !== false).map(publicProduct),
    activeCall: state.activeCall ? structuredClone(state.activeCall) : null,
    preparingQueueNumbers: (state.orders ?? [])
      .filter((order) => order.status === 'waiting')
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .map((order) => String(order.queueNumber)),
    promoMedia: state.promoMedia ? structuredClone(state.promoMedia) : null,
    mediaPlaylist: structuredClone(state.mediaPlaylist ?? []),
    revision: state.revision ?? 0,
    serverUpdatedAt: new Date().toISOString(),
  };
}

function cashierState(state) {
  const businessDate = state.businessDate ?? jakartaToday();
  const daily = summarizeSales(state.orders ?? [], businessDate, {
    operationalEntries: state.operationalEntries ?? [],
  });
  return {
    businessDate,
    products: (state.products ?? []).map(publicProduct),
    orders: (state.orders ?? [])
      .filter((order) => ['waiting', 'ready'].includes(order.status))
      .map(cashierOrder),
    activeCall: state.activeCall ? structuredClone(state.activeCall) : null,
    promoMedia: state.promoMedia ? structuredClone(state.promoMedia) : null,
    mediaPlaylist: structuredClone(state.mediaPlaylist ?? []),
    currentShift: structuredClone((state.shifts ?? []).find((shift) => shift.status === 'open') ?? null),
    dailySummary: {
      businessDate,
      revenue: daily.revenue,
      received: daily.grandRevenue,
      transactionCount: daily.transactionCount,
      paymentTotals: structuredClone(daily.paymentTotals),
      products: daily.products.map((product) => ({
        productId: product.productId,
        productName: product.productName,
        category: product.category,
        unitPrice: product.unitPrice,
        quantity: product.quantity,
        revenue: product.revenue,
        transactionCount: product.transactionCount,
        avgQtyPerTrx: product.avgQtyPerTrx,
      })),
    },
    revision: state.revision ?? 0,
    serverUpdatedAt: new Date().toISOString(),
  };
}

function ownerState(state) {
  return withoutCredentials(state);
}

function securityHeaders(contentType = '') {
  const headers = {
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'x-frame-options': 'SAMEORIGIN',
    'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  };
  if (contentType.includes('text/html')) {
    headers['content-security-policy'] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'";
  }
  return headers;
}

function cookies(request) {
  return Object.fromEntries((request.headers.cookie ?? '').split(';').flatMap((entry) => {
    const separator = entry.indexOf('=');
    if (separator < 1) return [];
    return [[entry.slice(0, separator).trim(), entry.slice(separator + 1).trim()]];
  }));
}

async function readJson(request, maxBytes = 35_000_000) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > maxBytes) {
      const error = new Error('Ukuran file terlalu besar');
      error.status = 413;
      throw error;
    }
  }
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch {
    const error = new Error('Format JSON tidak valid');
    error.status = 400;
    throw error;
  }
}

async function serveFile(response, filePath) {
  try {
    const content = await readFile(filePath);
    response.writeHead(200, {
      'content-type': CONTENT_TYPES[extname(filePath)] ?? 'application/octet-stream',
      'cache-control': 'no-store, no-cache, must-revalidate, max-age=0',
      pragma: 'no-cache',
      ...securityHeaders(CONTENT_TYPES[extname(filePath)] ?? ''),
    });
    response.end(content);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    sendJson(response, 404, { error: 'Halaman tidak ditemukan' });
  }
}

async function serveMediaFile(request, response, filePath) {
  let info;
  try {
    info = await stat(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    sendJson(response, 404, { error: 'Media tidak ditemukan' });
    return;
  }
  if (!info.isFile()) {
    sendJson(response, 404, { error: 'Media tidak ditemukan' });
    return;
  }
  const contentType = CONTENT_TYPES[extname(filePath)] ?? 'application/octet-stream';
  const etag = `"${info.size.toString(16)}-${Math.trunc(info.mtimeMs).toString(16)}"`;
  const commonHeaders = {
    'content-type': contentType,
    'accept-ranges': 'bytes',
    'cache-control': 'public, max-age=86400',
    etag,
    'last-modified': info.mtime.toUTCString(),
    ...securityHeaders(contentType),
  };
  if (request.headers['if-none-match'] === etag) {
    response.writeHead(304, commonHeaders);
    response.end();
    return;
  }
  const range = String(request.headers.range ?? '');
  if (!range) {
    response.writeHead(200, { ...commonHeaders, 'content-length': String(info.size) });
    createReadStream(filePath).pipe(response);
    return;
  }
  const match = range.match(/^bytes=(\d*)-(\d*)$/);
  let start = match?.[1] ? Number(match[1]) : null;
  let end = match?.[2] ? Number(match[2]) : null;
  if (match && start === null && end !== null) {
    start = Math.max(0, info.size - end);
    end = info.size - 1;
  } else {
    start ??= 0;
    end ??= info.size - 1;
  }
  if (
    !match
    || !Number.isSafeInteger(start)
    || !Number.isSafeInteger(end)
    || start < 0
    || end < start
    || start >= info.size
  ) {
    response.writeHead(416, {
      ...commonHeaders,
      'content-range': `bytes */${info.size}`,
    });
    response.end();
    return;
  }
  end = Math.min(end, info.size - 1);
  response.writeHead(206, {
    ...commonHeaders,
    'content-range': `bytes ${start}-${end}/${info.size}`,
    'content-length': String(end - start + 1),
  });
  createReadStream(filePath, { start, end }).pipe(response);
}

function normalizeOutletState(rawState, initialState) {
  const state = structuredClone(rawState ?? {});
  let changed = false;
  const ensure = (key, value) => {
    if (state[key] === undefined || state[key] === null) {
      state[key] = structuredClone(value);
      changed = true;
    }
  };

  ensure('products', initialState.products ?? []);
  ensure('orders', []);
  ensure('shifts', []);
  ensure('operationalEntries', []);
  ensure('inventoryMovements', []);
  ensure('nextQueueNumber', 1);
  ensure('activeCall', null);
  ensure('promoMedia', initialState.promoMedia ?? { type: 'video', url: '/media/promo.mp4', filename: 'promo.mp4', fit: 'cover' });
  if ('taxConfig' in state) {
    delete state.taxConfig;
    changed = true;
  }
  ensure('revision', 0);
  if (!Number.isSafeInteger(state.nextCallEventId) || state.nextCallEventId < 1) {
    // Legacy displays may still remember an old eventId in localStorage. A timestamp-based
    // migration guarantees the next call is newer even when activeCall was already cleared.
    state.nextCallEventId = Math.max(1, Number(state.activeCall?.eventId || 0) + 1, Date.now());
    changed = true;
  }
  if (!state.promoMedia.fit) {
    state.promoMedia.fit = 'cover';
    changed = true;
  }
  if (!Array.isArray(state.mediaPlaylist)) {
    state.mediaPlaylist = [{
      id: 'legacy-promo',
      ...structuredClone(state.promoMedia),
      durationSeconds: null,
      imageDurationSeconds: 8,
      active: true,
    }];
    changed = true;
  }
  const productById = new Map((state.products ?? []).map((product) => [product.id, product]));
  for (const order of state.orders ?? []) {
    for (const item of order.items ?? []) {
      if (!item.category) {
        item.category = productById.get(item.productId)?.category || 'Lainnya';
        changed = true;
      }
      if (item.unitPrice === undefined && item.quantity > 0) {
        item.unitPrice = Math.round((item.subtotal ?? 0) / item.quantity);
        changed = true;
      }
    }
    if (!order.paymentStatus) {
      order.paymentStatus = ['cancelled', 'expired'].includes(order.status) ? 'void' : 'paid';
      changed = true;
    }
  }
  if (state.schemaVersion !== 3) {
    state.schemaVersion = 3;
    changed = true;
  }
  return { state, changed };
}

async function writeJsonAtomic(filePath, value) {
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temporaryPath, filePath);
}

async function loadOutletsConfig(outletsFilePath) {
  let parsed;
  try {
    parsed = JSON.parse(await readFile(outletsFilePath, 'utf8'));
  } catch (error) {
    error.message = `Konfigurasi outlet gagal dibaca: ${error.message}`;
    throw error;
  }
  if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('Konfigurasi outlet harus berupa array yang tidak kosong');

  let migrated = false;
  const normalized = parsed.map((entry) => {
    if (!entry?.id || !entry?.name) throw new Error('Setiap outlet wajib memiliki id dan name');
    const outlet = { ...entry };
    if (!outlet.adminPinHash && outlet.adminPin) {
      outlet.adminPinHash = createPinHash(outlet.adminPin);
      delete outlet.adminPin;
      migrated = true;
    }
    if (!outlet.adminPinHash && outlet.status === 'active') {
      throw new Error(`Outlet aktif ${outlet.id} belum memiliki adminPinHash`);
    }
    delete outlet.adminPin;
    return outlet;
  });

  if (migrated) await writeJsonAtomic(outletsFilePath, normalized);
  return normalized;
}

export async function createQueueServer({
  dataDir = join(PROJECT_DIR, 'data'),
  publicDir = join(PROJECT_DIR, 'public'),
  initialState = createInitialState(),
  production = process.env.NODE_ENV === 'production',
} = {}) {
  const outletsFilePath = join(dataDir, 'outlets.json');
  // Sanitize the only supported legacy plaintext credential before copying
  // legacy data into SQLite. After bootstrap, SQLite is the runtime source.
  await loadOutletsConfig(outletsFilePath);
  const database = await new SqliteDatabase(join(dataDir, 'maucafe.sqlite')).init();
  try {
    await importLegacyJson({ database, dataDir, initialState: withoutCredentials(initialState) });
  } catch (error) {
    database.close();
    throw error;
  }
  const registryStore = await new SqliteStore(database, 'registry', {
    outlets: [],
    partners: [],
    users: [],
    masterProducts: initialState.products ?? [],
    schemaVersion: 1,
  }).init();
  let registry = normalizeRegistry(registryStore.get());
  if (JSON.stringify(registry) !== JSON.stringify(registryStore.get())) {
    await registryStore.update(() => registry);
  }
  let outletsConfig = registry.outlets;
  const stores = new Map();
  const displayClientsMap = new Map();
  const adminClientsMap = new Map();
  const ownerClientsMap = new Map();
  const adminSessions = new Map();
  const ownerSessions = new Map();
  const partnerSessions = new Map();
  let securityStore;
  const ownerSessionLifetimeMs = 8 * 60 * 60 * 1000;
  const adminSessionLifetimeMs = 12 * 60 * 60 * 1000;
  const adminLoginLimiter = new LoginLimiter();
  const ownerLoginLimiter = new LoginLimiter();
  const partnerLoginLimiter = new LoginLimiter();
  const mediaUploadHistory = new Map();
  const processedRequests = new Map();

  function recordProcessedRequest(requestId, data) {
    if (!requestId) return;
    if (processedRequests.size >= 500) {
      const firstKey = processedRequests.keys().next().value;
      processedRequests.delete(firstKey);
    }
    processedRequests.set(requestId, data);
  }

  let mutationQueue = Promise.resolve();

  function withMutationLock(task) {
    const operation = mutationQueue.then(task, task);
    mutationQueue = operation.catch(() => {});
    return operation;
  }

  async function initializeOutlet(outlet) {
    if (stores.has(outlet.id)) {
      stores.get(outlet.id).outlet = outlet;
      return stores.get(outlet.id);
    }
    const outletInitialState = {
      ...withoutCredentials(initialState),
      products: structuredClone(
        registry.masterProducts.length ? registry.masterProducts : initialState.products ?? [],
      ),
    };
    const store = await new SqliteStore(
      database,
      `outlet:${outlet.id}`,
      outletInitialState,
    ).init();
    const normalized = normalizeOutletState(store.get(), initialState);
    const masterProducts = registry.masterProducts.length
      ? registry.masterProducts
      : initialState.products ?? [];
    const existingProductsMap = new Map((normalized.state.products || []).map((p) => [p.id, p]));
    const mergedProducts = masterProducts.map((mp) => {
      const existing = existingProductsMap.get(mp.id);
      const disabledByPartner = existing?.disabledByPartner === true;
      return {
        ...mp,
        disabledByPartner,
        active: (mp.active !== false) && !disabledByPartner,
      };
    });
    if (JSON.stringify(normalized.state.products) !== JSON.stringify(mergedProducts)) {
      normalized.state.products = mergedProducts;
      normalized.state.revision = (normalized.state.revision ?? 0) + 1;
      normalized.changed = true;
    }
    if (normalized.changed) await store.update(() => normalized.state);
    stores.set(outlet.id, { outlet, store });
    displayClientsMap.set(outlet.id, new Set());
    adminClientsMap.set(outlet.id, new Set());
    ownerClientsMap.set(outlet.id, new Set());
    return stores.get(outlet.id);
  }

  for (const outlet of outletsConfig) {
    await initializeOutlet(outlet);
  }

  const defaultOutletId = outletsConfig[0]?.id || 'maucafe-alunalun';
  const securityConfig = database.readState('security');
  if (!securityConfig?.ownerPinHash?.salt || !securityConfig?.ownerPinHash?.hash) {
    database.close();
    throw new Error('security.json tidak memiliki ownerPinHash yang valid');
  }
  securityStore = await new SqliteStore(database, 'security', securityConfig).init();
  if (production && (
    verifyOwnerPin(securityStore.get(), '1234')
    || outletsConfig.some((outlet) => verifyPinHash(outlet.adminPinHash, '1111'))
  )) {
    database.close();
    throw new Error('Credential demo 1111/1234 wajib diganti sebelum server production dijalankan');
  }

  for (const { store } of stores.values()) {
    const snapshot = store.get();
    if (snapshot.ownerPin || snapshot.ownerPinHash) {
      await store.update((current) => {
        const next = structuredClone(current);
        delete next.ownerPin;
        delete next.ownerPinHash;
        return next;
      });
    }
  }

  function ownerSession(request) {
    const token = bearerToken(request) || cookies(request).owner_session;
    if (!token) return null;
    const expiresAt = ownerSessions.get(token);
    if (!expiresAt || expiresAt <= Date.now()) {
      ownerSessions.delete(token);
      return null;
    }
    return token;
  }

  function adminSessionDetails(request, outletId) {
    const token = bearerToken(request) || cookies(request)[`admin_session_${outletId}`];
    if (!token) return null;
    const session = adminSessions.get(token);
    if (!session || session.expiresAt <= Date.now() || session.outletId !== outletId) {
      if (token) adminSessions.delete(token);
      return null;
    }
    const currentOutlet = stores.get(outletId)?.outlet;
    if (session.legacy) {
      if (!currentOutlet || currentOutlet.legacyAdminDisabled === true) {
        adminSessions.delete(token);
        return null;
      }
    } else {
      const user = registry.users.find((candidate) => (
        candidate.id === session.userId
        && candidate.role === 'employee'
        && candidate.active !== false
        && candidate.outletIds.includes(outletId)
        && candidate.partnerId === currentOutlet?.partnerId
      ));
      if (!user) {
        adminSessions.delete(token);
        return null;
      }
    }
    return { token, ...session };
  }

  function adminSession(request, outletId) {
    return adminSessionDetails(request, outletId)?.token ?? null;
  }

  function partnerSession(request) {
    const token = bearerToken(request) || cookies(request).partner_session;
    if (!token) return null;
    const session = partnerSessions.get(token);
    if (!session || session.expiresAt <= Date.now()) {
      partnerSessions.delete(token);
      return null;
    }
    const user = registry.users.find((candidate) => (
      candidate.id === session.userId
      && candidate.role === 'partner'
      && candidate.active !== false
    ));
    const partner = registry.partners.find((candidate) => (
      candidate.id === session.partnerId
      && candidate.active !== false
    ));
    if (!user || !partner || user.partnerId !== partner.id) {
      partnerSessions.delete(token);
      return null;
    }
    return { token, ...session, user: structuredClone(user) };
  }

  function bearerToken(request) {
    const match = String(request.headers.authorization ?? '').match(/^Bearer ([a-f0-9]{64})$/i);
    return match?.[1] ?? null;
  }

  function issueOwnerSession() {
    const token = randomBytes(32).toString('hex');
    const expiresAt = Date.now() + ownerSessionLifetimeMs;
    ownerSessions.set(token, expiresAt);
    return { token, expiresAt };
  }

  function issueAdminSession(outletId, identity = {}) {
    const token = randomBytes(32).toString('hex');
    const expiresAt = Date.now() + adminSessionLifetimeMs;
    adminSessions.set(token, {
      outletId,
      expiresAt,
      userId: identity.userId ?? `legacy-admin:${outletId}`,
      userName: identity.userName ?? 'Admin Outlet',
      partnerId: identity.partnerId ?? null,
      legacy: identity.legacy !== false,
    });
    return { token, expiresAt };
  }

  function issuePartnerSession(user) {
    const token = randomBytes(32).toString('hex');
    const expiresAt = Date.now() + adminSessionLifetimeMs;
    partnerSessions.set(token, {
      userId: user.id,
      partnerId: user.partnerId,
      expiresAt,
    });
    return { token, expiresAt };
  }

  function revokeAdminSessions(outletId) {
    for (const [token, session] of adminSessions) {
      if (session.outletId === outletId) adminSessions.delete(token);
    }
  }

  function credentialHashes(currentRegistry = registry, currentSecurity = securityStore.get()) {
    return [
      { key: 'owner', hash: currentSecurity.ownerPinHash },
      ...currentRegistry.outlets.map((outlet) => ({
        key: `outlet:${outlet.id}`,
        hash: outlet.adminPinHash,
      })),
      ...currentRegistry.users.map((user) => ({
        key: `user:${user.id}`,
        hash: user.pinHash,
      })),
    ];
  }

  function assertPinAvailable(pin, {
    currentRegistry = registry,
    currentSecurity = securityStore.get(),
    excludeKey = null,
  } = {}) {
    const conflict = matchingCredentialKeys(
      pin,
      credentialHashes(currentRegistry, currentSecurity),
    ).some((key) => key !== excludeKey);
    if (!conflict) return;
    const error = new Error('PIN sudah digunakan, pilih PIN lain.');
    error.status = 409;
    throw error;
  }

  function hasPinCollision(pin) {
    return matchingCredentialKeys(pin, credentialHashes()).length > 1;
  }

  function publicOutlets() {
    return outletsConfig
      .filter((outlet) => outlet.status === 'active')
      .map(({ id, name, address }) => ({ id, name, address }));
  }

  async function mutateRegistry(transform, auditEvent) {
    return withMutationLock(async () => {
      let output;
      const nextRegistry = await registryStore.update((current) => {
        output = transform(normalizeRegistry(current));
        return normalizeRegistry(output.registry ?? output);
      });
      registry = normalizeRegistry(nextRegistry);
      outletsConfig = registry.outlets;
      for (const outlet of outletsConfig) await initializeOutlet(outlet);
      await writeJsonAtomic(outletsFilePath, outletsConfig);
      if (auditEvent) {
        database.appendAudit({
          ...auditEvent,
          metadata: {
            ...(auditEvent.metadata ?? {}),
            resultId: output.partner?.id ?? output.user?.id ?? output.outlet?.id ?? null,
          },
        });
      }
      return output;
    });
  }


  function requestIp(request) {
    return String(request.socket.remoteAddress ?? 'unknown');
  }

  function secureCookie(request) {
    return request.socket.encrypted || request.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
  }

  function mediaUploadAllowed(request, outletId, now = Date.now()) {
    const key = `${outletId}:${requestIp(request)}`;
    const recent = (mediaUploadHistory.get(key) ?? []).filter((value) => now - value < 60_000);
    if (recent.length >= 10) return false;
    recent.push(now);
    mediaUploadHistory.set(key, recent);
    return true;
  }

  async function mediaStorageBytes(outletId) {
    const mediaDir = join(publicDir, 'media');
    let filenames;
    try {
      filenames = await readdir(mediaDir);
    } catch (error) {
      if (error.code === 'ENOENT') return 0;
      throw error;
    }
    const prefix = `uploaded-promo-${outletId}-`;
    let total = 0;
    for (const filename of filenames) {
      if (!filename.startsWith(prefix)) continue;
      try {
        const info = await stat(join(mediaDir, filename));
        if (info.isFile()) total += info.size;
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
    return total;
  }

  function broadcastGroup(clients, payload) {
    if (!clients) return;
    const message = `data: ${JSON.stringify(payload)}\n\n`;
    for (const client of clients) client.write(message);
  }

  function broadcast(outletId, state) {
    const outlet = stores.get(outletId)?.outlet;
    if (!outlet) return;
    const outletInfo = { id: outlet.id, name: outlet.name };
    broadcastGroup(displayClientsMap.get(outletId), { ...displayState(state), outletInfo });
    broadcastGroup(adminClientsMap.get(outletId), { ...cashierState(state), outletInfo });
    broadcastGroup(ownerClientsMap.get(outletId), { ...ownerState(state), outletInfo });
  }

  async function mutate(outletId, transform) {
    return withMutationLock(async () => {
      const target = stores.get(outletId);
      if (!target) throw new Error(`Outlet ${outletId} tidak ditemukan`);
      let output;
      const state = await target.store.update((current) => {
        output = transform(current);
        return output.state ?? output;
      });
      broadcast(outletId, state);
      return { state, output };
    });
  }

  async function mutateMasterProducts(outletId, transform, action) {
    return withMutationLock(async () => {
      const result = transform({
        products: structuredClone(registry.masterProducts),
        revision: 0,
      });
      const masterProducts = structuredClone(result.state.products);
      const nextRegistry = normalizeRegistry({ ...registry, masterProducts });
      const nextStates = new Map();
      for (const [targetOutletId, target] of stores) {
        const current = target.store.get();
        const existingProductsMap = new Map((current.products || []).map((p) => [p.id, p]));
        const mergedProducts = masterProducts.map((mp) => {
          const existing = existingProductsMap.get(mp.id);
          const disabledByPartner = existing?.disabledByPartner === true;
          return {
            ...mp,
            disabledByPartner,
            active: (mp.active !== false) && !disabledByPartner,
          };
        });
        nextStates.set(targetOutletId, {
          ...current,
          products: mergedProducts,
          revision: (current.revision ?? 0) + 1,
        });
      }
      database.transaction(() => {
        database.writeState('registry', nextRegistry);
        for (const [targetOutletId, nextState] of nextStates) {
          database.writeState(`outlet:${targetOutletId}`, nextState);
        }
        if (action) {
          const actionName = typeof action === 'object' ? action.action : action;
          const metadata = typeof action === 'object' ? action.metadata : { productId: result.product?.id };
          database.appendAudit({
            actorType: 'owner',
            actorId: 'owner',
            action: actionName,
            outletId: outletId || null,
            metadata: {
              scope: 'global-master',
              affectedOutlets: nextStates.size,
              ...metadata,
            },
          });
        }
      });
      registry = nextRegistry;
      outletsConfig = registry.outlets;
      registryStore.refreshFromDatabase();
      for (const [targetOutletId, target] of stores) {
        const state = target.store.refreshFromDatabase();
        broadcast(targetOutletId, state);
      }
      return result;
    });
  }

  async function ensureCurrentBusinessDay(outletId, now = new Date()) {
    const target = stores.get(outletId);
    if (!target) throw new Error(`Outlet ${outletId} tidak ditemukan`);
    if (target.store.get().businessDate === jakartaToday(now)) return target.store.get();
    const { state } = await mutate(
      outletId,
      (current) => rolloverBusinessDay(current, now.toISOString()),
    );
    return state;
  }

  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    const path = url.pathname;
    const origin = String(request.headers.origin ?? '');
    const sameHostOrigin = origin && (() => {
      try {
        return new URL(origin).host === request.headers.host;
      } catch {
        return false;
      }
    })();
    const allowedOrigin = NATIVE_ORIGINS.has(origin) || sameHostOrigin;

    if (origin && !allowedOrigin && path.startsWith('/api/')) {
      sendJson(response, 403, { error: 'Origin tidak diizinkan' });
      return;
    }
    if (origin && allowedOrigin) {
      response.setHeader('access-control-allow-origin', origin);
      response.setHeader('access-control-allow-methods', 'GET, POST, PATCH, DELETE, OPTIONS');
      response.setHeader('access-control-allow-headers', 'content-type, authorization');
      response.setHeader('vary', 'Origin');
    }
    if (request.method === 'OPTIONS' && path.startsWith('/api/')) {
      response.writeHead(204, securityHeaders());
      response.end();
      return;
    }

    try {
      if (request.method === 'GET' && path === '/') {
        await serveFile(response, join(publicDir, 'index.html'));
        return;
      }

      if (request.method === 'GET' && path === '/favicon.ico') {
        response.writeHead(204, securityHeaders());
        response.end();
        return;
      }

      if (request.method === 'GET' && (path === '/admin' || path === '/display')) {
        response.writeHead(302, { location: `/outlet/${defaultOutletId}${path}` });
        response.end();
        return;
      }

      const staticFiles = new Map([
        ['/owner', 'owner.html'],
        ['/partner', 'partner.html'],
        ['/index.html', 'index.html'],
        ['/admin.html', 'admin.html'],
        ['/display.html', 'display.html'],
        ['/owner.html', 'owner.html'],
        ['/partner.html', 'partner.html'],
        ['/admin.js', 'admin.js'],
        ['/api-client.js', 'api-client.js'],
        ['/app-config.js', 'app-config.js'],
        ['/launcher.js', 'launcher.js'],
        ['/native-session.js', 'native-session.js'],
        ['/native-shell.js', 'native-shell.js'],
        ['/queue-number.js', 'queue-number.js'],
        ['/receipt-model.js', 'receipt-model.js'],
        ['/runtime-config.js', 'runtime-config.js'],
        ['/sales.js', 'sales.js'],
        ['/display.js', 'display.js'],
        ['/owner.js', 'owner.js'],
        ['/partner.js', 'partner.js'],
        ['/admin.css', 'admin.css'],
        ['/base.css', 'base.css'],
        ['/display.css', 'display.css'],
        ['/launcher.css', 'launcher.css'],
        ['/owner.css', 'owner.css'],
        ['/partner.css', 'partner.css'],
        ['/typography.css', 'typography.css'],
      ]);

      if (request.method === 'GET' && staticFiles.has(path)) {
        await serveFile(response, join(publicDir, staticFiles.get(path)));
        return;
      }

      const nestedAssetMatch = path.match(/^\/outlet\/[^/]+\/(admin\.css|admin\.js|api-client\.js|app-config\.js|base\.css|display\.css|display\.js|native-session\.js|native-shell\.js|queue-number\.js|receipt-model\.js|runtime-config\.js|typography\.css)$/);
      if (request.method === 'GET' && nestedAssetMatch) {
        await serveFile(response, join(publicDir, nestedAssetMatch[1]));
        return;
      }

      const outletPageMatch = path.match(/^\/outlet\/([^/]+)\/(admin|display)$/);
      if (request.method === 'GET' && outletPageMatch) {
        const [, outletId, page] = outletPageMatch;
        if (!stores.has(outletId) || stores.get(outletId).outlet.status !== 'active') {
          sendJson(response, 404, { error: 'Outlet tidak ditemukan' });
          return;
        }
        await serveFile(response, join(publicDir, `${page}.html`));
        return;
      }

      if (request.method === 'GET' && path.startsWith('/media/')) {
        const mediaMatch = path.match(/^\/media\/([A-Za-z0-9._-]+)$/);
        if (!mediaMatch) {
          sendJson(response, 404, { error: 'Media tidak ditemukan' });
          return;
        }
        await serveMediaFile(request, response, join(publicDir, 'media', mediaMatch[1]));
        return;
      }

      if (request.method === 'GET' && path === '/api/outlets') {
        sendJson(response, 200, { outlets: publicOutlets(), defaultOutletId });
        return;
      }

      if (request.method === 'GET' && path === '/api/health') {
        database.readState('registry');
        sendJson(response, 200, {
          ok: true,
          storage: 'sqlite',
          activeOutlets: publicOutlets().length,
          uptimeSeconds: Math.floor(process.uptime()),
          checkedAt: new Date().toISOString(),
        });
        return;
      }

      if (request.method === 'POST' && (path === '/api/partner/login' || path === '/api/native/partner/login')) {
        const nativeLogin = path === '/api/native/partner/login';
        const body = await readJson(request);
        const loginKey = `partner:${requestIp(request)}`;
        const loginStatus = partnerLoginLimiter.status(loginKey);
        if (!loginStatus.allowed) {
          sendJson(response, 429, { error: 'Terlalu banyak percobaan login Mitra. Coba lagi sebentar.' }, {
            'retry-after': String(Math.ceil(loginStatus.retryAfterMs / 1000)),
          });
          return;
        }
        const user = authenticateUser(registry, {
          username: body.username,
          pin: body.pin,
          role: 'partner',
        });
        if (!user || hasPinCollision(body.pin)) {
          partnerLoginLimiter.fail(loginKey);
          sendJson(response, 401, { error: 'Username atau PIN Mitra tidak valid' });
          return;
        }
        partnerLoginLimiter.success(loginKey);
        const session = issuePartnerSession(user);
        const safeUser = safeRegistry(registry).users.find((candidate) => candidate.id === user.id);
        sendJson(response, 200, {
          ok: true,
          role: 'partner',
          user: safeUser,
          ...(nativeLogin ? {
            token: session.token,
            expiresAt: new Date(session.expiresAt).toISOString(),
          } : {}),
        }, nativeLogin ? {} : {
          'set-cookie': `partner_session=${session.token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${secureCookie(request)}`,
        });
        return;
      }

      if (request.method === 'POST' && path === '/api/partner/logout') {
        const session = partnerSession(request);
        if (session) partnerSessions.delete(session.token);
        sendJson(response, 200, { ok: true }, {
          'set-cookie': 'partner_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0',
        });
        return;
      }

      if (request.method === 'GET' && path === '/api/partner/session') {
        const session = partnerSession(request);
        sendJson(response, 200, {
          authenticated: Boolean(session),
          user: session
            ? safeRegistry(registry).users.find((candidate) => candidate.id === session.userId)
            : null,
        });
        return;
      }

      if (request.method === 'GET' && path === '/api/partner/dashboard') {
        const session = partnerSession(request);
        if (!session) {
          sendJson(response, 401, { error: 'Sesi Mitra berakhir.' });
          return;
        }
        const partner = registry.partners.find((candidate) => candidate.id === session.partnerId);
        const outlets = [];
        for (const outlet of outletsConfig.filter((candidate) => candidate.partnerId === session.partnerId)) {
          const state = await ensureCurrentBusinessDay(outlet.id);
          const reportDate = jakartaToday();
          const summary = summarizeSales(state.orders, reportDate, {
            operationalEntries: state.operationalEntries,
          });
          outlets.push({
            id: outlet.id,
            name: outlet.name,
            address: outlet.address,
            partnerId: outlet.partnerId,
            status: outlet.status,
            businessDate: reportDate,
            revenue: summary.revenue,
            received: summary.grandRevenue,
            cost: summary.totalCost,
            grossProfit: summary.margin,
            operatingExpenses: summary.operatingExpenses,
            netProfit: summary.netProfit,
            transactionCount: summary.transactionCount,
            paymentTotals: structuredClone(summary.paymentTotals),
            inventory: inventorySummary(state, reportDate),
            currentShift: (state.shifts ?? []).find((shift) => shift.status === 'open') ?? null,
            mediaPlaylist: structuredClone(state.mediaPlaylist ?? []),
            shifts: structuredClone((state.shifts ?? []).slice(-10)),
          });
        }
        const activeOutlets = outlets.filter((outlet) => outlet.status === 'active');
        const summary = activeOutlets.reduce((totals, outlet) => ({
          outletCount: totals.outletCount + 1,
          revenue: totals.revenue + outlet.revenue,
          received: totals.received + outlet.received,
          cost: totals.cost + outlet.cost,
          grossProfit: totals.grossProfit + outlet.grossProfit,
          operatingExpenses: totals.operatingExpenses + outlet.operatingExpenses,
          netProfit: totals.netProfit + outlet.netProfit,
          transactionCount: totals.transactionCount + outlet.transactionCount,
          paymentTotals: {
            cash: totals.paymentTotals.cash + outlet.paymentTotals.cash,
            QRIS: totals.paymentTotals.QRIS + outlet.paymentTotals.QRIS,
          },
          inventory: {
            balance: totals.inventory.balance + outlet.inventory.balance,
          },
        }), {
          outletCount: 0,
          revenue: 0,
          received: 0,
          cost: 0,
          grossProfit: 0,
          operatingExpenses: 0,
          netProfit: 0,
          transactionCount: 0,
          paymentTotals: { cash: 0, QRIS: 0 },
          inventory: { balance: 0 },
        });
        sendJson(response, 200, {
          partner: structuredClone(partner),
          user: safeRegistry(registry).users.find((candidate) => candidate.id === session.userId),
          outlets,
          summary,
          employees: safeRegistry(registry).users.filter((user) => (
            user.role === 'employee' && user.partnerId === session.partnerId
          )),
          updatedAt: new Date().toISOString(),
        });
        return;
      }

      const partnerExportRoute = path.match(/^\/api\/partner\/outlets\/([^/]+)\/export-sales$/);
      if (request.method === 'GET' && partnerExportRoute) {
        const session = partnerSession(request);
        const outletId = partnerExportRoute[1];
        if (!session || !partnerOwnsOutlet(registry, session.partnerId, outletId)) {
          sendJson(response, 403, { error: 'Outlet bukan milik Mitra ini.' });
          return;
        }
        const target = stores.get(outletId);
        const date = url.searchParams.get('date') || jakartaToday();
        const snapshot = target.store.get();
        const summary = summarizeSales(snapshot.orders, date, {
          operationalEntries: snapshot.operationalEntries ?? [],
        });
        const workbook = buildSalesWorkbook({
          title: target.outlet.name,
          date,
          summary,
          filenamePrefix: `Laporan_Mitra_${outletId}`,
        });
        response.writeHead(200, {
          'content-type': 'application/vnd.ms-excel; charset=utf-8',
          'content-disposition': `attachment; filename="${workbook.filename}"`,
          'cache-control': 'no-cache',
          ...securityHeaders('application/vnd.ms-excel'),
        });
        response.end(workbook.html);
        return;
      }

      if (request.method === 'POST' && path === '/api/partner/employees') {
        const session = partnerSession(request);
        if (!session) {
          sendJson(response, 401, { error: 'Sesi Mitra diperlukan.' });
          return;
        }
        const body = await readJson(request);
        if (!partnerOwnsOutlet(registry, session.partnerId, body.outletId)) {
          sendJson(response, 403, { error: 'Outlet bukan milik Mitra ini.' });
          return;
        }
        const output = await mutateRegistry(
          (current) => {
            assertPinAvailable(body.pin, { currentRegistry: current });
            return createEmployee(current, {
              ...body,
              partnerId: session.partnerId,
            });
          },
          {
            actorType: 'partner',
            actorId: session.userId,
            action: 'employee.create',
            outletId: body.outletId,
            metadata: { username: body.username, name: body.name },
          },
        );
        const safeUser = safeRegistry(registry).users.find((candidate) => candidate.id === output.user.id);
        sendJson(response, 201, { user: safeUser });
        return;
      }

      const partnerEmployeeRoute = path.match(/^\/api\/partner\/employees\/([^/]+)$/);
      if (request.method === 'PATCH' && partnerEmployeeRoute) {
        const session = partnerSession(request);
        if (!session) {
          sendJson(response, 401, { error: 'Sesi Mitra diperlukan.' });
          return;
        }
        const body = await readJson(request);
        const output = await mutateRegistry(
          (current) => {
            if (body.pin !== undefined && String(body.pin).trim()) {
              assertPinAvailable(body.pin, {
                currentRegistry: current,
                excludeKey: `user:${partnerEmployeeRoute[1]}`,
              });
            }
            return updateEmployee(current, partnerEmployeeRoute[1], {
              ...body,
              partnerId: session.partnerId,
            });
          },
          {
            actorType: 'partner',
            actorId: session.userId,
            action: 'employee.update',
            metadata: { employeeId: partnerEmployeeRoute[1], active: body.active },
          },
        );
        const safeUser = safeRegistry(registry).users.find((candidate) => candidate.id === output.user.id);
        sendJson(response, 200, { user: safeUser });
        return;
      }

      if (request.method === 'POST' && path === '/api/partner/outlets') {
        const session = partnerSession(request);
        if (!session) {
          sendJson(response, 401, { error: 'Sesi Mitra diperlukan.' });
          return;
        }
        const body = await readJson(request);
        const output = await mutateRegistry(
          (current) => proposeOutlet(current, {
            ...body,
            partnerId: session.partnerId,
          }),
          {
            actorType: 'partner',
            actorId: session.userId,
            action: 'outlet.propose',
            metadata: { name: body.name, address: body.address },
          },
        );
        sendJson(response, 201, { outlet: safeRegistry(registry).outlets.find((item) => item.id === output.outlet.id) });
        return;
      }

      const partnerGetProductsRoute = path.match(/^\/api\/partner\/outlets\/([^/]+)\/products$/);
      if (request.method === 'GET' && partnerGetProductsRoute) {
        const session = partnerSession(request);
        const outletId = partnerGetProductsRoute[1];
        if (!session || !partnerOwnsOutlet(registry, session.partnerId, outletId)) {
          sendJson(response, 403, { error: 'Outlet bukan milik Mitra ini.' });
          return;
        }
        const target = stores.get(outletId);
        if (!target) {
          sendJson(response, 404, { error: 'Outlet tidak ditemukan.' });
          return;
        }
        const snapshot = target.store.get();
        const sanitizedProducts = (snapshot.products || []).map(({ id, name, category, price, active, imageUrl, cupUsage }) => ({
          id,
          name,
          category,
          price,
          active: active !== false,
          imageUrl: imageUrl ?? null,
          cupUsage: cupUsage ?? 1,
        }));
        sendJson(response, 200, { products: sanitizedProducts });
        return;
      }

      const partnerToggleProductRoute = path.match(/^\/api\/partner\/outlets\/([^/]+)\/products\/([^/]+)$/);
      if (request.method === 'PATCH' && partnerToggleProductRoute) {
        const session = partnerSession(request);
        const [, outletId, productId] = partnerToggleProductRoute;
        if (!session || !partnerOwnsOutlet(registry, session.partnerId, outletId)) {
          sendJson(response, 403, { error: 'Outlet bukan milik Mitra ini.' });
          return;
        }
        const body = await readJson(request);
        if (typeof body.active !== 'boolean') {
          sendJson(response, 400, { error: 'Status aktif produk harus berupa boolean.' });
          return;
        }
        const { state: nextState, output } = await mutate(outletId, (current) => {
          const products = Array.isArray(current.products) ? [...current.products] : [];
          const index = products.findIndex((p) => p.id === productId);
          if (index === -1) throw new Error('Produk tidak ditemukan');
          products[index] = {
            ...products[index],
            active: body.active,
            disabledByPartner: !body.active,
          };
          return {
            state: { ...current, products, revision: (current.revision ?? 0) + 1 },
            product: products[index],
          };
        });
        database.appendAudit({
          actorType: 'partner',
          actorId: session.userId,
          action: 'partner.product.toggle',
          outletId,
          metadata: { productId, active: body.active },
        });
        const sanitizedProduct = {
          id: output.product.id,
          name: output.product.name,
          category: output.product.category,
          price: output.product.price,
          active: output.product.active !== false,
          imageUrl: output.product.imageUrl ?? null,
        };
        sendJson(response, 200, { ok: true, product: sanitizedProduct });
        return;
      }

      if (request.method === 'GET' && path === '/api/owner/franchise') {
        if (!ownerSession(request)) {
          sendJson(response, 401, { error: 'Sesi Owner diperlukan.' });
          return;
        }
        sendJson(response, 200, {
          registry: safeRegistry(registry),
          audit: database.listAudit({ limit: 100 }),
          updatedAt: new Date().toISOString(),
        });
        return;
      }

      if (request.method === 'GET' && path === '/api/owner/products') {
        if (!ownerSession(request)) {
          sendJson(response, 401, { error: 'Sesi Owner diperlukan.' });
          return;
        }
        sendJson(response, 200, {
          products: registry.masterProducts || [],
          limits: {
            maxProducts: 500,
            maxBulkRows: 250,
            maxPayloadBytes: 1048576,
          },
          revision: registry.revision ?? 0,
        });
        return;
      }

      if (request.method === 'POST' && path === '/api/owner/products/bulk') {
        if (!ownerSession(request)) {
          sendJson(response, 401, { error: 'Sesi Owner diperlukan.' });
          return;
        }
        const body = await readJson(request);
        const requestId = String(body?.requestId ?? '').trim();
        if (!requestId || requestId.length < 16 || requestId.length > 100 || !/^[a-zA-Z0-9_-]+$/.test(requestId)) {
          sendJson(response, 400, { error: 'requestId wajib 16-100 karakter aman' });
          return;
        }

        if (processedRequests.has(requestId)) {
          sendJson(response, 200, processedRequests.get(requestId));
          return;
        }

        const validation = validateBulkProductRows(registry.masterProducts, body?.rows, { maxProducts: 500, maxRows: 250 });
        if (!validation.ok) {
          sendJson(response, 400, { error: validation.error, rowErrors: validation.rowErrors });
          return;
        }

        if (body?.dryRun === true) {
          let createdCount = 0;
          let updatedCount = 0;
          let unchangedCount = 0;
          const existingMap = new Map((registry.masterProducts || []).map((p) => [p.id, p]));
          for (const row of validation.validatedRows) {
            if (row.id) {
              const currentProd = existingMap.get(row.id);
              if (currentProd) {
                const isSame = currentProd.name === row.name &&
                  currentProd.category === row.category &&
                  currentProd.price === row.price &&
                  currentProd.cost === row.cost &&
                  currentProd.cupUsage === row.cupUsage &&
                  currentProd.active === row.active;
                if (isSame) unchangedCount++;
                else updatedCount++;
              }
            } else {
              createdCount++;
            }
          }
          sendJson(response, 200, {
            ok: true,
            dryRun: true,
            requestId,
            summary: {
              created: createdCount,
              updated: updatedCount,
              unchanged: unchangedCount,
              affectedOutlets: stores.size,
            },
            revision: registry.revision ?? 0,
          });
          return;
        }

        let bulkSummary = null;
        await mutateMasterProducts(
          null,
          (current) => {
            const res = bulkUpsertMasterProducts(current, validation.validatedRows);
            bulkSummary = res.summary;
            return res;
          },
          {
            action: 'product.bulk_import',
            metadata: {
              requestId,
              rowCount: validation.validatedRows.length,
            },
          },
        );

        const resultResponse = {
          ok: true,
          dryRun: false,
          requestId,
          summary: {
            ...bulkSummary,
            affectedOutlets: stores.size,
          },
          products: registry.masterProducts || [],
          revision: registry.revision ?? 0,
        };

        recordProcessedRequest(requestId, resultResponse);
        sendJson(response, 200, resultResponse);
        return;
      }

      if (request.method === 'PATCH' && path === '/api/owner/products/bulk') {
        if (!ownerSession(request)) {
          sendJson(response, 401, { error: 'Sesi Owner diperlukan.' });
          return;
        }
        const body = await readJson(request);
        const requestId = String(body?.requestId ?? '').trim();
        if (!requestId || requestId.length < 16 || requestId.length > 100 || !/^[a-zA-Z0-9_-]+$/.test(requestId)) {
          sendJson(response, 400, { error: 'requestId wajib 16-100 karakter aman' });
          return;
        }
        if (processedRequests.has(requestId)) {
          sendJson(response, 200, processedRequests.get(requestId));
          return;
        }
        const productIds = Array.isArray(body?.productIds) ? body.productIds : [];
        if (!productIds.length) {
          sendJson(response, 400, { error: 'Pilih minimal satu produk' });
          return;
        }
        const changes = body?.changes || {};
        const allowedKeys = new Set(['category', 'active']);
        const hasInvalidKey = Object.keys(changes).some((k) => !allowedKeys.has(k));
        if (hasInvalidKey) {
          sendJson(response, 400, { error: 'Perubahan massal hanya mengizinkan kategori atau status aktif' });
          return;
        }

        let updatedCount = 0;
        await mutateMasterProducts(
          null,
          (current) => {
            const state = structuredClone(current);
            updatedCount = 0;
            for (const id of productIds) {
              const prod = state.products.find((p) => p.id === id);
              if (prod) {
                if ('category' in changes) prod.category = String(changes.category).trim();
                if ('active' in changes) prod.active = Boolean(changes.active);
                updatedCount++;
              }
            }
            state.revision = (state.revision ?? 0) + 1;
            return { state, updatedCount };
          },
          {
            action: 'product.bulk_patch',
            metadata: { requestId, productIdsCount: productIds.length, changes },
          },
        );

        const resultResponse = {
          ok: true,
          requestId,
          updatedCount,
          products: registry.masterProducts || [],
          revision: registry.revision ?? 0,
        };
        recordProcessedRequest(requestId, resultResponse);
        sendJson(response, 200, resultResponse);
        return;
      }

      if (request.method === 'POST' && path === '/api/owner/partners') {
        if (!ownerSession(request)) {
          sendJson(response, 401, { error: 'Sesi Owner diperlukan.' });
          return;
        }
        const body = await readJson(request);
        const output = await mutateRegistry(
          (current) => {
            assertPinAvailable(body.pin, { currentRegistry: current });
            return createPartner(current, body);
          },
          {
            actorType: 'owner',
            actorId: 'owner',
            action: 'partner.create',
            metadata: { username: body.username, name: body.name },
          },
        );
        const safe = safeRegistry(registry);
        sendJson(response, 201, {
          partner: safe.partners.find((partner) => partner.id === output.partner.id),
          user: safe.users.find((user) => user.id === output.user.id),
        });
        return;
      }

      const ownerApproveOutlet = path.match(/^\/api\/owner\/outlets\/([^/]+)\/approve$/);
      if (request.method === 'POST' && ownerApproveOutlet) {
        if (!ownerSession(request)) {
          sendJson(response, 401, { error: 'Sesi Owner diperlukan.' });
          return;
        }
        await readJson(request);
        const output = await mutateRegistry(
          (current) => approveOutlet(current, ownerApproveOutlet[1], { approvedBy: 'owner' }),
          {
            actorType: 'owner',
            actorId: 'owner',
            action: 'outlet.approve',
            outletId: ownerApproveOutlet[1],
          },
        );
        sendJson(response, 200, { outlet: safeRegistry(registry).outlets.find((outlet) => outlet.id === output.outlet.id) });
        return;
      }

      if (request.method === 'POST' && path === '/api/native/owner/login') {
        const body = await readJson(request);
        const loginKey = `owner:${requestIp(request)}`;
        const loginStatus = ownerLoginLimiter.status(loginKey);
        if (!loginStatus.allowed) {
          sendJson(response, 429, { error: 'Terlalu banyak percobaan PIN. Coba lagi sebentar.' }, { 'retry-after': String(Math.ceil(loginStatus.retryAfterMs / 1000)) });
          return;
        }
        if (!verifyOwnerPin(securityStore.get(), body.pin) || hasPinCollision(body.pin)) {
          ownerLoginLimiter.fail(loginKey);
          sendJson(response, 401, { error: 'PIN Pemilik tidak valid' });
          return;
        }
        ownerLoginLimiter.success(loginKey);
        const session = issueOwnerSession();
        sendJson(response, 200, {
          ok: true,
          role: 'owner',
          token: session.token,
          expiresAt: new Date(session.expiresAt).toISOString(),
          outlets: publicOutlets(),
        });
        return;
      }

      if (request.method === 'POST' && path === '/api/native/admin/login') {
        const body = await readJson(request);
        const outlet = stores.get(String(body.outletId ?? ''))?.outlet;
        if (!outlet || outlet.status !== 'active') {
          sendJson(response, 404, { error: 'Outlet tidak ditemukan' });
          return;
        }
        const loginKey = `admin:${outlet.id}:${requestIp(request)}`;
        const loginStatus = adminLoginLimiter.status(loginKey);
        if (!loginStatus.allowed) {
          sendJson(response, 429, { error: 'Terlalu banyak percobaan PIN. Coba lagi sebentar.' }, { 'retry-after': String(Math.ceil(loginStatus.retryAfterMs / 1000)) });
          return;
        }
        const employee = body.username
          ? authenticateUser(registry, {
              username: body.username,
              pin: body.pin,
              role: 'employee',
              outletId: outlet.id,
            })
          : null;
        const legacyValid = !body.username
          && outlet.legacyAdminDisabled !== true
          && verifyPinHash(outlet.adminPinHash, String(body.pin ?? '').trim());
        if ((!employee && !legacyValid) || hasPinCollision(body.pin)) {
          adminLoginLimiter.fail(loginKey);
          sendJson(response, 401, { error: 'Akun atau PIN Karyawan tidak valid' });
          return;
        }
        adminLoginLimiter.success(loginKey);
        const session = issueAdminSession(outlet.id, employee ? {
          userId: employee.id,
          userName: employee.name,
          partnerId: employee.partnerId,
          legacy: false,
        } : {
          userName: `Admin ${outlet.name}`,
          partnerId: outlet.partnerId,
          legacy: true,
        });
        sendJson(response, 200, {
          ok: true,
          role: 'admin',
          token: session.token,
          expiresAt: new Date(session.expiresAt).toISOString(),
          outlet: { id: outlet.id, name: outlet.name },
          user: employee ? safeRegistry(registry).users.find((user) => user.id === employee.id) : {
            id: `legacy-admin:${outlet.id}`,
            name: `Admin ${outlet.name}`,
            role: 'employee',
            outletIds: [outlet.id],
            legacy: true,
          },
        });
        return;
      }

      if (request.method === 'POST' && path === '/api/native/logout') {
        await readJson(request);
        const token = bearerToken(request);
        if (token) {
          adminSessions.delete(token);
          ownerSessions.delete(token);
          partnerSessions.delete(token);
        }
        sendJson(response, 200, { ok: true });
        return;
      }

      if (request.method === 'POST' && path === '/api/owner/login') {
        const body = await readJson(request);
        const loginKey = `owner:${requestIp(request)}`;
        const loginStatus = ownerLoginLimiter.status(loginKey);
        if (!loginStatus.allowed) {
          sendJson(response, 429, { error: 'Terlalu banyak percobaan PIN. Coba lagi sebentar.' }, { 'retry-after': String(Math.ceil(loginStatus.retryAfterMs / 1000)) });
          return;
        }
        if (!verifyOwnerPin(securityStore.get(), body.pin) || hasPinCollision(body.pin)) {
          ownerLoginLimiter.fail(loginKey);
          sendJson(response, 401, { error: 'PIN Pemilik tidak valid' });
          return;
        }
        ownerLoginLimiter.success(loginKey);
        const session = issueOwnerSession();
        sendJson(response, 200, { ok: true, outlets: publicOutlets() }, {
          'set-cookie': `owner_session=${session.token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secureCookie(request)}`,
        });
        return;
      }

      if (request.method === 'POST' && path === '/api/owner/logout') {
        const token = ownerSession(request);
        if (token) ownerSessions.delete(token);
        sendJson(response, 200, { ok: true }, {
          'set-cookie': 'owner_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0',
        });
        return;
      }

      if (request.method === 'GET' && path === '/api/owner/session') {
        sendJson(response, 200, { authenticated: Boolean(ownerSession(request)) });
        return;
      }

      if (request.method === 'GET' && path === '/api/owner/multi-summary') {
        if (!ownerSession(request)) {
          sendJson(response, 401, { error: 'Sesi berakhir, masukkan PIN lagi.' });
          return;
        }
        const summaries = [];
        let grandRevenue = 0;
        let grandReceived = 0;
        let grandCost = 0;
        let grandMargin = 0;
        let grandOperatingExpenses = 0;
        let grandNetProfit = 0;
        let grandSalesCount = 0;
        let grandActiveCount = 0;
        const reportDate = jakartaToday();

        for (const outlet of outletsConfig.filter((candidate) => candidate.status === 'active')) {
          const state = await ensureCurrentBusinessDay(outlet.id);
          const summary = summarizeSales(state.orders, reportDate, {
            operationalEntries: state.operationalEntries ?? [],
          });
          const activeCount = state.orders.filter((o) => ['waiting', 'ready'].includes(o.status)).length;
          const inventory = inventorySummary(state, reportDate);

          summaries.push({
            id: outlet.id,
            name: outlet.name,
            address: outlet.address,
            partnerId: outlet.partnerId ?? null,
            businessDate: reportDate,
            revenue: summary.revenue,
            received: summary.grandRevenue,
            cash: summary.paymentTotals.cash,
            qris: summary.paymentTotals.QRIS,
            cost: summary.totalCost,
            margin: summary.margin,
            operatingExpenses: summary.operatingExpenses,
            netProfit: summary.netProfit,
            salesCount: summary.transactionCount,
            activeCount,
            inventory,
          });

          grandRevenue += summary.revenue;
          grandReceived += summary.grandRevenue;
          grandCost += summary.totalCost;
          grandMargin += summary.margin;
          grandOperatingExpenses += summary.operatingExpenses;
          grandNetProfit += summary.netProfit;
          grandSalesCount += summary.transactionCount;
          grandActiveCount += activeCount;
        }

        const aggregateOutlets = ({
          id,
          name,
          outlets,
          pendingOutletCount = 0,
        }) => outlets.reduce((totals, outlet) => ({
          ...totals,
          outletCount: totals.outletCount + 1,
          revenue: totals.revenue + outlet.revenue,
          received: totals.received + outlet.received,
          cash: totals.cash + outlet.cash,
          qris: totals.qris + outlet.qris,
          cost: totals.cost + outlet.cost,
          margin: totals.margin + outlet.margin,
          operatingExpenses: totals.operatingExpenses + outlet.operatingExpenses,
          netProfit: totals.netProfit + outlet.netProfit,
          salesCount: totals.salesCount + outlet.salesCount,
          activeCount: totals.activeCount + outlet.activeCount,
          inventory: {
            balance: totals.inventory.balance + outlet.inventory.balance,
          },
        }), {
          id,
          name,
          outletCount: 0,
          pendingOutletCount,
          revenue: 0,
          received: 0,
          cash: 0,
          qris: 0,
          cost: 0,
          margin: 0,
          operatingExpenses: 0,
          netProfit: 0,
          salesCount: 0,
          activeCount: 0,
          inventory: { balance: 0 },
        });
        const partnerSummaries = registry.partners
          .filter((partner) => partner.active !== false)
          .map((partner) => aggregateOutlets({
            id: partner.id,
            name: partner.name,
            outlets: summaries.filter((outlet) => outlet.partnerId === partner.id),
            pendingOutletCount: outletsConfig.filter((outlet) => (
              outlet.partnerId === partner.id && outlet.status === 'pending'
            )).length,
          }));
        const unassignedOutlets = summaries.filter((outlet) => !outlet.partnerId);
        const unassignedSummary = unassignedOutlets.length
          ? aggregateOutlets({
            id: 'unassigned',
            name: 'Outlet tanpa Mitra',
            outlets: unassignedOutlets,
          })
          : null;

        sendJson(response, 200, {
          summaries,
          partnerSummaries,
          unassignedSummary,
          grandTotals: {
            revenue: grandRevenue,
            received: grandReceived,
            cost: grandCost,
            margin: grandMargin,
            operatingExpenses: grandOperatingExpenses,
            netProfit: grandNetProfit,
            salesCount: grandSalesCount,
            activeCount: grandActiveCount,
          },
          updatedAt: new Date().toISOString(),
        });
        return;
      }

      if (request.method === 'GET' && path === '/api/owner/all-orders') {
        if (!ownerSession(request)) {
          sendJson(response, 401, { error: 'Sesi berakhir, masukkan PIN lagi.' });
          return;
        }
        const allOrders = [];
        const operationalEntries = [];
        for (const [outletId, { outlet, store }] of stores.entries()) {
          const state = store.get();
          for (const order of state.orders) {
            allOrders.push({ ...order, outletId, outletName: outlet.name });
          }
          for (const entry of state.operationalEntries ?? []) {
            operationalEntries.push({ ...entry, outletId, outletName: outlet.name });
          }
        }
        sendJson(response, 200, { orders: allOrders, operationalEntries, updatedAt: new Date().toISOString() });
        return;
      }

      if (request.method === 'GET' && path === '/api/owner/export-sales-all') {
        if (!ownerSession(request)) {
          sendJson(response, 401, { error: 'Sesi berakhir, masukkan PIN lagi.' });
          return;
        }
        const allOrders = [];
        const allOperationalEntries = [];
        for (const { store } of stores.values()) {
          const state = store.get();
          allOrders.push(...state.orders);
          allOperationalEntries.push(...(state.operationalEntries ?? []));
        }
        const dateStr = url.searchParams.get('date') || new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
        const summary = summarizeSales(allOrders, dateStr, {
          operationalEntries: allOperationalEntries,
        });
        const workbook = buildSalesWorkbook({
          title: `Gabungan Semua Outlet (${publicOutlets().length} Outlet)`,
          date: dateStr,
          summary,
          filenamePrefix: 'Laporan_Gabungan_Semua_Outlet',
        });
        response.writeHead(200, {
          'content-type': 'application/vnd.ms-excel; charset=utf-8',
          'content-disposition': `attachment; filename="${workbook.filename}"`,
          'cache-control': 'no-cache',
          ...securityHeaders('application/vnd.ms-excel'),
        });
        response.end(workbook.html);
        return;
      }

      if (request.method === 'POST' && path === '/api/owner/clear-all-outlets-sales') {
        if (!ownerSession(request)) {
          sendJson(response, 401, { error: 'Sesi berakhir, masukkan PIN lagi.' });
          return;
        }
        const body = await readJson(request);
        const loginKey = `owner_clear:${requestIp(request)}`;
        const status = ownerLoginLimiter.status(loginKey);
        if (!status.allowed) {
          sendJson(response, 429, { error: 'Terlalu banyak percobaan. Coba lagi sebentar.' }, { 'retry-after': String(Math.ceil(status.retryAfterMs / 1000)) });
          return;
        }
        if (body?.confirmation !== 'HAPUS SEMUA') {
          ownerLoginLimiter.fail(loginKey);
          sendJson(response, 400, { error: 'Frasa konfirmasi "HAPUS SEMUA" wajib sesuai persis.' });
          return;
        }
        if (!verifyOwnerPin(securityStore.get(), body?.currentPin)) {
          ownerLoginLimiter.fail(loginKey);
          sendJson(response, 401, { error: 'PIN Pemilik tidak valid.' });
          return;
        }
        ownerLoginLimiter.success(loginKey);

        const requestId = String(body?.requestId ?? '').trim();
        if (requestId && processedRequests.has(requestId)) {
          sendJson(response, 200, processedRequests.get(requestId));
          return;
        }

        let totalDeletedOrders = 0;
        const affectedOutlets = stores.size;

        database.transaction(() => {
          for (const [outletId, { store }] of stores.entries()) {
            const current = store.get();
            const orderCount = (current.orders || []).length;
            totalDeletedOrders += orderCount;
            const nextState = clearAllOrders(current);
            database.writeState(`outlet:${outletId}`, nextState);
          }
          database.appendAudit({
            actorType: 'owner',
            actorId: 'owner',
            action: 'owner.sales.clear_all',
            metadata: {
              confirmation: body.confirmation,
              reason: body.reason || null,
              affectedOutlets,
              deletedOrders: totalDeletedOrders,
              requestId: requestId || null,
            },
          });
        });

        for (const [outletId, { store }] of stores.entries()) {
          const nextState = store.refreshFromDatabase();
          broadcast(outletId, nextState);
        }

        const resultResponse = {
          ok: true,
          affectedOutlets,
          deletedOrders: totalDeletedOrders,
          requestId: requestId || null,
        };

        if (requestId) {
          recordProcessedRequest(requestId, resultResponse);
        }

        sendJson(response, 200, resultResponse);
        return;
      }


      const outletApiMatch = path.match(/^\/api\/outlet\/([^/]+)(\/.+)?$/);
      if (!outletApiMatch) {
        sendJson(response, 404, { error: 'Route tidak ditemukan' });
        return;
      }

      const [, outletId, subPath = '/'] = outletApiMatch;
      const targetOutlet = stores.get(outletId);
      if (!targetOutlet || targetOutlet.outlet.status !== 'active') {
        sendJson(response, 404, { error: `Outlet '${outletId}' tidak ditemukan` });
        return;
      }

      const { outlet, store } = targetOutlet;

      if (request.method === 'POST' && subPath === '/admin/login') {
        const body = await readJson(request);
        const inputPin = String(body.pin ?? '').trim();
        const loginKey = `admin:${outletId}:${requestIp(request)}`;
        const loginStatus = adminLoginLimiter.status(loginKey);
        if (!loginStatus.allowed) {
          sendJson(response, 429, { error: 'Terlalu banyak percobaan PIN. Coba lagi sebentar.' }, { 'retry-after': String(Math.ceil(loginStatus.retryAfterMs / 1000)) });
          return;
        }
        const employee = body.username
          ? authenticateUser(registry, {
              username: body.username,
              pin: inputPin,
              role: 'employee',
              outletId,
            })
          : null;
        const legacyValid = !body.username && outlet.legacyAdminDisabled !== true && verifyPinHash(outlet.adminPinHash, inputPin);
        if ((!employee && !legacyValid) || hasPinCollision(inputPin)) {
          adminLoginLimiter.fail(loginKey);
          sendJson(response, 401, { error: 'Akun atau PIN Karyawan tidak valid' });
          return;
        }
        adminLoginLimiter.success(loginKey);
        const session = issueAdminSession(outletId, employee ? {
          userId: employee.id,
          userName: employee.name,
          partnerId: employee.partnerId,
          legacy: false,
        } : {
          userName: `Admin ${outlet.name}`,
          partnerId: outlet.partnerId,
          legacy: true,
        });
        sendJson(response, 200, {
          ok: true,
          outlet: { id: outlet.id, name: outlet.name },
          user: employee ? safeRegistry(registry).users.find((user) => user.id === employee.id) : {
            id: `legacy-admin:${outlet.id}`,
            name: `Admin ${outlet.name}`,
            role: 'employee',
            outletIds: [outlet.id],
            legacy: true,
          },
        }, {
          'set-cookie': `admin_session_${outletId}=${session.token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${secureCookie(request)}`,
        });
        return;
      }

      if (request.method === 'POST' && subPath === '/admin/logout') {
        const token = adminSession(request, outletId);
        if (token) adminSessions.delete(token);
        sendJson(response, 200, { ok: true }, {
          'set-cookie': `admin_session_${outletId}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`,
        });
        return;
      }

      if (request.method === 'GET' && subPath === '/admin/session') {
        const isAuth = Boolean(adminSession(request, outletId) || ownerSession(request));
        sendJson(response, 200, { authenticated: isAuth, outlet: { id: outlet.id, name: outlet.name } });
        return;
      }

      if (request.method === 'GET' && subPath === '/info') {
        sendJson(response, 200, { outlet: { id: outlet.id, name: outlet.name, address: outlet.address } });
        return;
      }

      if (request.method === 'GET' && subPath === '/state') {
        const state = await ensureCurrentBusinessDay(outletId);
        sendJson(response, 200, { ...displayState(state), outletInfo: { id: outlet.id, name: outlet.name } });
        return;
      }

      if (request.method === 'GET' && subPath === '/events') {
        const state = await ensureCurrentBusinessDay(outletId);
        response.writeHead(200, {
          'content-type': 'text/event-stream; charset=utf-8',
          'cache-control': 'no-cache',
          connection: 'keep-alive',
          ...securityHeaders('text/event-stream'),
        });
        const clients = displayClientsMap.get(outletId);
        clients.add(response);
        const payload = { ...displayState(state), outletInfo: { id: outlet.id, name: outlet.name } };
        response.write(`data: ${JSON.stringify(payload)}\n\n`);
        request.on('close', () => clients.delete(response));
        return;
      }

      if (request.method === 'GET' && subPath === '/admin/state') {
        if (!adminSession(request, outletId) && !ownerSession(request)) {
          sendJson(response, 401, { error: 'Sesi Admin berakhir.' });
          return;
        }
        const state = await ensureCurrentBusinessDay(outletId);
        sendJson(response, 200, { ...cashierState(state), outletInfo: { id: outlet.id, name: outlet.name } });
        return;
      }

      if (request.method === 'GET' && subPath === '/admin/events') {
        if (!adminSession(request, outletId) && !ownerSession(request)) {
          sendJson(response, 401, { error: 'Sesi Admin berakhir.' });
          return;
        }
        const state = await ensureCurrentBusinessDay(outletId);
        response.writeHead(200, {
          'content-type': 'text/event-stream; charset=utf-8',
          'cache-control': 'no-cache',
          connection: 'keep-alive',
          ...securityHeaders('text/event-stream'),
        });
        const clients = adminClientsMap.get(outletId);
        clients.add(response);
        response.write(`data: ${JSON.stringify({ ...cashierState(state), outletInfo: { id: outlet.id, name: outlet.name } })}\n\n`);
        request.on('close', () => clients.delete(response));
        return;
      }

      if (request.method === 'GET' && subPath === '/owner/state') {
        if (!ownerSession(request)) {
          sendJson(response, 401, { error: 'Sesi berakhir, masukkan PIN lagi.' });
          return;
        }
        const state = await ensureCurrentBusinessDay(outletId);
        sendJson(response, 200, {
          state: ownerState(state),
          outletInfo: { id: outlet.id, name: outlet.name },
          updatedAt: new Date().toISOString(),
        });
        return;
      }

      if (request.method === 'GET' && subPath === '/owner/events') {
        if (!ownerSession(request)) {
          sendJson(response, 401, { error: 'Sesi berakhir, masukkan PIN lagi.' });
          return;
        }
        const state = await ensureCurrentBusinessDay(outletId);
        response.writeHead(200, {
          'content-type': 'text/event-stream; charset=utf-8',
          'cache-control': 'no-cache',
          connection: 'keep-alive',
          ...securityHeaders('text/event-stream'),
        });
        const clients = ownerClientsMap.get(outletId);
        clients.add(response);
        response.write(`data: ${JSON.stringify({ ...ownerState(state), outletInfo: { id: outlet.id, name: outlet.name } })}\n\n`);
        request.on('close', () => clients.delete(response));
        return;
      }

      if (request.method === 'GET' && subPath === '/owner/export-sales') {
        if (!ownerSession(request)) {
          sendJson(response, 401, { error: 'Sesi berakhir, masukkan PIN lagi.' });
          return;
        }
        const state = store.get();
        const dateStr = url.searchParams.get('date') || state.businessDate;
        const summary = summarizeSales(state.orders, dateStr, {
          operationalEntries: state.operationalEntries ?? [],
        });
        const workbook = buildSalesWorkbook({
          title: outlet.name,
          date: dateStr,
          summary,
          filenamePrefix: `Laporan_${outlet.id}`,
        });
        response.writeHead(200, {
          'content-type': 'application/vnd.ms-excel; charset=utf-8',
          'content-disposition': `attachment; filename="${workbook.filename}"`,
          'cache-control': 'no-cache',
          ...securityHeaders('application/vnd.ms-excel'),
        });
        response.end(workbook.html);
        return;
      }

      if (request.method === 'POST' && subPath === '/shifts/open') {
        const admin = adminSessionDetails(request, outletId);
        if (!admin) {
          sendJson(response, 401, { error: 'Login Karyawan diperlukan.' });
          return;
        }
        const body = await readJson(request);
        const { state: nextState, output } = await mutate(outletId, (current) => openShift(current, {
          label: body.label,
          openingCash: body.openingCash,
          employeeId: admin.userId,
          employeeName: admin.userName,
        }));
        database.appendAudit({
          actorType: 'employee',
          actorId: admin.userId,
          action: 'shift.open',
          outletId,
          metadata: { shiftId: output.shift.id, label: output.shift.label, openingCash: output.shift.openingCash },
        });
        sendJson(response, 201, { state: cashierState(nextState), shift: output.shift });
        return;
      }

      const shiftCloseRoute = subPath.match(/^\/shifts\/([^/]+)\/close$/);
      if (request.method === 'POST' && shiftCloseRoute) {
        const admin = adminSessionDetails(request, outletId);
        const ownerToken = ownerSession(request);
        const partner = partnerSession(request);
        if (!admin && !ownerToken && !(partner && partnerOwnsOutlet(registry, partner.partnerId, outletId))) {
          sendJson(response, 401, { error: 'Sesi Karyawan, Mitra, atau Owner diperlukan.' });
          return;
        }
        const body = await readJson(request);
        const forced = !admin;
        const actor = ownerToken
          ? { actorType: 'owner', actorId: 'owner', actorName: 'Owner' }
          : partner
            ? { actorType: 'partner', actorId: partner.userId, actorName: partner.user.name }
            : null;
        const { state: nextState, output } = await mutate(outletId, (current) => (
          forced
            ? forceCloseShift(current, shiftCloseRoute[1], { ...body, ...actor })
            : closeShift(current, shiftCloseRoute[1], {
                ...body,
                employeeId: admin.userId,
                employeeName: admin.userName,
              })
        ));
        database.appendAudit({
          actorType: forced ? actor.actorType : 'employee',
          actorId: forced ? actor.actorId : admin.userId,
          action: forced ? 'shift.force-close' : 'shift.close',
          outletId,
          metadata: {
            shiftId: output.shift.id,
            expectedCash: output.shift.expectedCash,
            actualCash: output.shift.actualCash,
            variance: output.shift.variance,
            reason: output.shift.closeReason,
          },
        });
        sendJson(response, 200, {
          state: ownerToken || partner ? ownerState(nextState) : cashierState(nextState),
          shift: output.shift,
        });
        return;
      }

      if (request.method === 'POST' && subPath === '/operations') {
        const admin = adminSessionDetails(request, outletId);
        const ownerToken = ownerSession(request);
        const partner = partnerSession(request);
        if (!admin && !ownerToken && !(partner && partnerOwnsOutlet(registry, partner.partnerId, outletId))) {
          sendJson(response, 401, { error: 'Sesi Karyawan, Mitra, atau Owner diperlukan.' });
          return;
        }
        const body = await readJson(request);
        const actor = admin
          ? { actorType: 'employee', actorId: admin.userId, actorName: admin.userName }
          : ownerToken
            ? { actorType: 'owner', actorId: 'owner', actorName: 'Owner' }
            : { actorType: 'partner', actorId: partner.userId, actorName: partner.user.name };
        const { state: nextState, output } = await mutate(
          outletId,
          (current) => recordOperationalEntry(current, { ...body, ...actor }),
        );
        database.appendAudit({
          actorType: actor.actorType,
          actorId: actor.actorId,
          action: `operation.${output.entry.type}`,
          outletId,
          metadata: {
            entryId: output.entry.id,
            shiftId: output.entry.shiftId,
            amount: output.entry.amount,
            category: output.entry.category,
          },
        });
        sendJson(response, 201, {
          state: ownerToken || partner ? ownerState(nextState) : cashierState(nextState),
          entry: output.entry,
        });
        return;
      }

      if (request.method === 'POST' && subPath === '/inventory') {
        const admin = adminSessionDetails(request, outletId);
        const ownerToken = ownerSession(request);
        const partner = partnerSession(request);
        if (!admin && !ownerToken && !(partner && partnerOwnsOutlet(registry, partner.partnerId, outletId))) {
          sendJson(response, 401, { error: 'Sesi Karyawan, Mitra, atau Owner diperlukan.' });
          return;
        }
        const body = await readJson(request);
        const actor = admin
          ? { actorType: 'employee', actorId: admin.userId, actorName: admin.userName }
          : ownerToken
            ? { actorType: 'owner', actorId: 'owner', actorName: 'Owner' }
            : { actorType: 'partner', actorId: partner.userId, actorName: partner.user.name };
        const { state: nextState, output } = await mutate(
          outletId,
          (current) => recordInventoryMovement(current, { ...body, ...actor }),
        );
        database.appendAudit({
          actorType: actor.actorType,
          actorId: actor.actorId,
          action: `inventory.${output.movement.type}`,
          outletId,
          metadata: {
            movementId: output.movement.id,
            quantity: output.movement.quantity,
            reason: output.movement.reason,
          },
        });
        sendJson(response, 201, {
          state: ownerToken || partner ? ownerState(nextState) : cashierState(nextState),
          movement: output.movement,
          inventory: inventorySummary(nextState, nextState.businessDate),
        });
        return;
      }

      if (request.method === 'POST' && subPath === '/orders') {
        const admin = adminSessionDetails(request, outletId);
        const ownerToken = ownerSession(request);
        if (!admin && !ownerToken) {
          sendJson(response, 401, { error: 'Login Admin diperlukan.' });
          return;
        }
        const body = await readJson(request);
        const current = await ensureCurrentBusinessDay(outletId);
        const activeShift = (current.shifts ?? []).find((shift) => (
          shift.status === 'open' && shift.businessDate === current.businessDate
        ));
        if (!activeShift) {
          sendJson(response, 409, { error: 'Buka shift aktif sebelum membuat pesanan.' });
          return;
        }
        if (admin && admin.userId !== activeShift.employeeId) {
          sendJson(response, 403, { error: `Shift aktif sedang dipakai oleh ${activeShift.employeeName}.` });
          return;
        }
        const { state: nextState, output } = await mutate(outletId, (state) => createOrder(state, {
          ...body,
          shiftId: activeShift.id,
          employeeId: activeShift.employeeId,
          employeeName: activeShift.employeeName,
        }));
        database.appendAudit({
          actorType: admin ? 'employee' : 'owner',
          actorId: admin?.userId ?? 'owner',
          action: 'order.create',
          outletId,
          metadata: {
            orderId: output.order.id,
            shiftId: activeShift.id,
            total: output.order.grandTotal,
            paymentMethod: output.order.paymentMethod,
          },
        });
        sendJson(response, output.duplicate ? 200 : 201, { state: cashierState(nextState), order: cashierOrder(output.order) });
        return;
      }

      const orderAction = subPath.match(/^\/orders\/([^/]+)\/(call|complete)$/);
      if (request.method === 'POST' && orderAction) {
        if (!adminSession(request, outletId) && !ownerSession(request)) {
          sendJson(response, 401, { error: 'Login Admin diperlukan.' });
          return;
        }
        await readJson(request);
        const [, orderId, action] = orderAction;
        const actions = { call: callOrder, complete: completeOrder };
        const { state: nextState, output } = await mutate(outletId, (current) => actions[action](current, orderId));
        sendJson(response, 200, { state: cashierState(nextState), order: cashierOrder(output.order) });
        return;
      }

      const cancelRoute = subPath.match(/^\/orders\/([^/]+)\/cancel$/);
      if (request.method === 'POST' && cancelRoute) {
        if (!adminSession(request, outletId) && !ownerSession(request)) {
          sendJson(response, 401, { error: 'Login Admin diperlukan.' });
          return;
        }
        const body = await readJson(request);
        const ownerToken = ownerSession(request);
        if (!ownerToken) {
          const approvalKey = `owner-approval:${requestIp(request)}`;
          const approvalStatus = ownerLoginLimiter.status(approvalKey);
          if (!approvalStatus.allowed) {
            sendJson(response, 429, { error: 'Terlalu banyak percobaan PIN Pemilik. Coba lagi sebentar.' });
            return;
          }
          if (hasPinCollision(body.ownerPin) || !verifyOwnerPin(securityStore.get(), body.ownerPin)) {
            ownerLoginLimiter.fail(approvalKey);
            sendJson(response, 403, { error: 'PIN Pemilik diperlukan untuk membatalkan pesanan.' });
            return;
          }
          ownerLoginLimiter.success(approvalKey);
        }
        const { state: nextState, output } = await mutate(outletId, (current) => cancelOrder(current, cancelRoute[1], {
          reason: body.reason,
          cancelledBy: ownerToken ? 'owner' : 'admin',
          approvedBy: 'owner',
        }));
        sendJson(response, 200, { state: cashierState(nextState), order: cashierOrder(output.order) });
        return;
      }

      if (request.method === 'POST' && subPath === '/reset') {
        await readJson(request);
        if (!ownerSession(request)) {
          sendJson(response, 401, { error: 'Sesi Owner diperlukan.' });
          return;
        }
        const { state: nextState } = await mutate(outletId, (current) => resetQueue(current));
        sendJson(response, 200, { state: ownerState(nextState) });
        return;
      }

      if (request.method === 'POST' && subPath === '/sales/purge') {
        const body = await readJson(request);
        if (!ownerSession(request)) {
          sendJson(response, 401, { error: 'Sesi Owner diperlukan.' });
          return;
        }
        const { state: nextState } = await mutate(outletId, (current) => purgeOldOrders(current, body.daysToKeep ?? 30));
        sendJson(response, 200, { state: ownerState(nextState) });
        return;
      }

      if (request.method === 'POST' && subPath === '/sales/clear') {
        await readJson(request);
        if (!ownerSession(request)) {
          sendJson(response, 401, { error: 'Sesi Owner diperlukan.' });
          return;
        }
        const { state: nextState } = await mutate(outletId, (current) => clearAllOrders(current));
        sendJson(response, 200, { state: ownerState(nextState) });
        return;
      }

      if (request.method === 'POST' && subPath === '/admin/pin') {
        if (!ownerSession(request)) {
          sendJson(response, 401, { error: 'Sesi Owner diperlukan.' });
          return;
        }
        const body = await readJson(request);
        const newPin = validatePin(body.newPin, 'PIN Admin baru');
        await mutateRegistry((current) => {
          const targetOutlet = current.outlets.find((candidate) => candidate.id === outletId);
          if (!targetOutlet) throw new Error('Outlet tidak ditemukan');
          assertPinAvailable(newPin, {
            currentRegistry: current,
            excludeKey: `outlet:${outletId}`,
          });
          targetOutlet.adminPinHash = createPinHash(newPin);
          targetOutlet.legacyAdminDisabled = false;
          return { registry: current, outlet: targetOutlet };
        }, {
          actorType: 'owner',
          actorId: 'owner',
          action: 'outlet.admin-pin.update',
          outletId,
        });
        revokeAdminSessions(outletId);
        sendJson(response, 200, { ok: true, outlet: { id: outlet.id, name: outlet.name } });
        return;
      }

      if (request.method === 'POST' && subPath === '/owner/pin') {
        const body = await readJson(request);
        if (!ownerSession(request)) {
          sendJson(response, 401, { error: 'Sesi berakhir, masukkan PIN lagi.' });
          return;
        }
        const updated = await withMutationLock(async () => {
          const currentSecurity = securityStore.get();
          assertPinAvailable(body.newPin, {
            currentSecurity,
            excludeKey: 'owner',
          });
          const output = updateOwnerPin(currentSecurity, body.currentPin, body.newPin);
          await securityStore.update(() => output.state);
          return output;
        });
        ownerSessions.clear();
        const updatedTargetState = ownerState(stores.get(outletId).store.get());
        sendJson(response, 200, { state: updatedTargetState, changed: true });
        return;
      }

      if (request.method === 'POST' && subPath === '/products') {
        if (!ownerSession(request)) {
          sendJson(response, 401, { error: 'Sesi Owner diperlukan.' });
          return;
        }
        const body = await readJson(request);
        const { state: nextState, product } = await mutateMasterProducts(
          outletId,
          (current) => addProduct(current, body),
          'product.create',
        );
        sendJson(response, 201, { state: ownerState(nextState), product });
        return;
      }

      const productRoute = subPath.match(/^\/products\/([^/]+)$/);
      if (request.method === 'PATCH' && productRoute) {
        if (!ownerSession(request)) {
          sendJson(response, 401, { error: 'Sesi Owner diperlukan.' });
          return;
        }
        const body = await readJson(request);
        const { state: nextState, product } = await mutateMasterProducts(
          outletId,
          (current) => updateProduct(current, productRoute[1], body),
          'product.update',
        );
        sendJson(response, 200, { state: ownerState(nextState), product });
        return;
      }

      if (request.method === 'DELETE' && productRoute) {
        if (!ownerSession(request)) {
          sendJson(response, 401, { error: 'Sesi Owner diperlukan.' });
          return;
        }
        const targetId = productRoute[1];
        const previousProduct = registry.masterProducts.find(
          (candidate) => candidate.id === targetId,
        );
        if (!previousProduct) {
          sendJson(response, 404, { error: 'Produk tidak ditemukan' });
          return;
        }
        const { state: nextState, product } = await mutateMasterProducts(
          outletId,
          (current) => removeProduct(current, targetId),
          'product.delete',
        );
        if (previousProduct.imageUrl) {
          await removeManagedProductImage(publicDir, previousProduct.imageUrl).catch(() => {});
        }
        sendJson(response, 200, { ok: true, state: ownerState(nextState), product });
        return;
      }

      const productImageRoute = subPath.match(/^\/products\/([^/]+)\/image$/);
      if (request.method === 'POST' && productImageRoute) {
        if (!ownerSession(request)) {
          sendJson(response, 401, { error: 'Sesi Owner diperlukan.' });
          return;
        }
        const body = await readJson(request, 8_000_000);
        const match = typeof body.dataUrl === 'string'
          ? body.dataUrl.match(/^data:([^;]+);base64,([A-Za-z0-9+/=\r\n]+)$/)
          : null;
        if (!match) {
          sendJson(response, 400, { error: 'Format foto produk tidak valid.' });
          return;
        }
        const declaredMime = match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase();
        const buffer = Buffer.from(match[2], 'base64');
        const detected = detectMedia(buffer);
        if (
          !buffer.length
          || buffer.length > MAX_PRODUCT_IMAGE_BYTES
          || detected?.type !== 'image'
          || detected.mime !== declaredMime
        ) {
          sendJson(response, buffer.length > MAX_PRODUCT_IMAGE_BYTES ? 413 : 400, {
            error: buffer.length > MAX_PRODUCT_IMAGE_BYTES
              ? 'Ukuran foto produk maksimal 5MB.'
              : 'Isi foto tidak sesuai format PNG, JPG, atau WebP.',
          });
          return;
        }
        const previousProduct = registry.masterProducts.find(
          (candidate) => candidate.id === productImageRoute[1],
        );
        if (!previousProduct) {
          sendJson(response, 404, { error: 'Produk tidak ditemukan' });
          return;
        }
        const mediaDir = join(publicDir, 'media');
        await mkdir(mediaDir, { recursive: true });
        const safeFilename = `uploaded-product-${productImageRoute[1]}-${uploadSuffix()}${detected.ext}`;
        const filePath = join(mediaDir, safeFilename);
        await writeFile(filePath, buffer, { flag: 'wx' });
        let productImageCommitted = false;
        try {
          const { state: nextState, product } = await mutateMasterProducts(
            outletId,
            (current) => setProductImage(current, productImageRoute[1], `/media/${safeFilename}`),
            'product.image.update',
          );
          productImageCommitted = true;
          await removeManagedProductImage(publicDir, previousProduct.imageUrl).catch(() => {});
          sendJson(response, 200, { state: ownerState(nextState), product });
        } catch (error) {
          if (!productImageCommitted) await unlink(filePath).catch(() => {});
          throw error;
        }
        return;
      }

      if (request.method === 'POST' && subPath === '/media/upload') {
        const admin = adminSessionDetails(request, outletId);
        const ownerToken = ownerSession(request);
        const partner = partnerSession(request);
        const partnerAllowed = partner && partnerOwnsOutlet(registry, partner.partnerId, outletId);
        if (!admin && !ownerToken && !partnerAllowed) {
          sendJson(response, 401, { error: 'Login Karyawan, Mitra, atau Owner diperlukan.' });
          return;
        }
        if (!mediaUploadAllowed(request, outletId)) {
          sendJson(response, 429, { error: 'Terlalu banyak upload. Coba lagi dalam satu menit.' });
          return;
        }
        const body = await readJson(request, 35_000_000);
        const { filename, dataUrl, fit = 'cover', imageDurationSeconds = 8 } = body;
        if (!dataUrl || typeof dataUrl !== 'string') {
          sendJson(response, 400, { error: 'Data file media tidak valid' });
          return;
        }
        const match = dataUrl.match(/^data:([^;]+);base64,([A-Za-z0-9+/=\r\n]+)$/);
        if (!match) {
          sendJson(response, 400, { error: 'Format data URL tidak valid' });
          return;
        }
        const [, declaredMime, base64Data] = match;
        const buffer = Buffer.from(base64Data, 'base64');
        if (!buffer.length || buffer.length > MAX_MEDIA_BYTES) {
          sendJson(response, 413, { error: 'Ukuran file maksimal 25MB' });
          return;
        }
        const detected = detectMedia(buffer);
        const allowedDeclared = new Set(['video/mp4', 'video/webm', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp']);
        if (!detected || !allowedDeclared.has(declaredMime.toLowerCase())) {
          sendJson(response, 400, { error: 'Isi file tidak sesuai format media yang didukung.' });
          return;
        }
        const normalizedDeclared = declaredMime.toLowerCase() === 'image/jpg' ? 'image/jpeg' : declaredMime.toLowerCase();
        if (normalizedDeclared !== detected.mime) {
          sendJson(response, 400, { error: 'Tipe file tidak cocok dengan isi file.' });
          return;
        }
        if (detected.type === 'image' && buffer.length > MAX_PROMO_IMAGE_BYTES) {
          sendJson(response, 413, { error: 'Ukuran foto promo maksimal 5MB.' });
          return;
        }
        const usedStorageBytes = await mediaStorageBytes(outletId);
        if (usedStorageBytes + buffer.length > MAX_MEDIA_STORAGE_BYTES) {
          sendJson(response, 413, { error: 'Penyimpanan media outlet maksimal 100MB.' });
          return;
        }
        let durationSeconds = null;
        if (detected.type === 'video') {
          if (detected.mime !== 'video/mp4') {
            sendJson(response, 400, { error: 'Playlist video hanya mendukung MP4.' });
            return;
          }
          try {
            durationSeconds = mediaDurationSeconds(buffer);
          } catch (error) {
            sendJson(response, 400, { error: error.message });
            return;
          }
          if (durationSeconds > 120) {
            sendJson(response, 400, { error: 'Durasi video maksimal 120 detik.' });
            return;
          }
        }
        if (!['cover', 'contain'].includes(fit)) {
          sendJson(response, 400, { error: 'Mode tampilan media tidak valid.' });
          return;
        }

        const mediaDir = join(publicDir, 'media');
        await mkdir(mediaDir, { recursive: true });
        const safeFilename = `uploaded-promo-${outletId}-${uploadSuffix()}${detected.ext}`;
        const filePath = join(mediaDir, safeFilename);
        await writeFile(filePath, buffer, { flag: 'wx' });
        let mediaCommitted = false;

        try {
          const mediaUrl = `/media/${safeFilename}`;
          const { state: nextState, output } = await mutate(outletId, (current) => {
            const working = structuredClone(current);
            working.mediaPlaylist = (working.mediaPlaylist ?? []).filter(
              (item) => item.url !== '/media/promo.mp4',
            );
            const added = addMediaItem(working, {
              type: detected.type,
              url: mediaUrl,
              filename: safeMediaLabel(filename, safeFilename),
              fit,
              durationSeconds,
              imageDurationSeconds: Number(imageDurationSeconds),
            });
            added.state.promoMedia = {
              type: added.item.type,
              url: added.item.url,
              filename: added.item.filename,
              fit: added.item.fit,
              updatedAt: added.item.createdAt,
            };
            return added;
          });
          mediaCommitted = true;
          database.appendAudit({
            actorType: ownerToken ? 'owner' : partnerAllowed ? 'partner' : 'employee',
            actorId: ownerToken ? 'owner' : partnerAllowed ? partner.userId : admin.userId,
            action: 'media.upload',
            outletId,
            metadata: {
              mediaId: output.item.id,
              type: output.item.type,
              durationSeconds: output.item.durationSeconds,
            },
          });
          sendJson(response, 200, {
            state: ownerToken || partnerAllowed ? ownerState(nextState) : cashierState(nextState),
            promoMedia: nextState.promoMedia,
            item: output.item,
          });
        } catch (error) {
          if (!mediaCommitted) await unlink(filePath).catch(() => {});
          throw error;
        }
        return;
      }

      if (request.method === 'PATCH' && subPath === '/media/playlist/order') {
        const admin = adminSessionDetails(request, outletId);
        const ownerToken = ownerSession(request);
        const partner = partnerSession(request);
        const partnerAllowed = partner && partnerOwnsOutlet(registry, partner.partnerId, outletId);
        if (!admin && !ownerToken && !partnerAllowed) {
          sendJson(response, 401, { error: 'Sesi pengelola media diperlukan.' });
          return;
        }
        const body = await readJson(request);
        const { state: nextState, output } = await mutate(
          outletId,
          (current) => reorderMediaItems(current, body.orderedIds),
        );
        database.appendAudit({
          actorType: ownerToken ? 'owner' : partnerAllowed ? 'partner' : 'employee',
          actorId: ownerToken ? 'owner' : partnerAllowed ? partner.userId : admin.userId,
          action: 'media.reorder',
          outletId,
          metadata: { orderedIds: body.orderedIds },
        });
        sendJson(response, 200, {
          state: ownerToken || partnerAllowed ? ownerState(nextState) : cashierState(nextState),
          mediaPlaylist: output.mediaPlaylist,
        });
        return;
      }

      const mediaDeleteRoute = subPath.match(/^\/media\/playlist\/([^/]+)$/);
      if (request.method === 'DELETE' && mediaDeleteRoute) {
        const admin = adminSessionDetails(request, outletId);
        const ownerToken = ownerSession(request);
        const partner = partnerSession(request);
        const partnerAllowed = partner && partnerOwnsOutlet(registry, partner.partnerId, outletId);
        if (!admin && !ownerToken && !partnerAllowed) {
          sendJson(response, 401, { error: 'Sesi pengelola media diperlukan.' });
          return;
        }
        const { state: nextState, output } = await mutate(outletId, (current) => {
          const removed = removeMediaItem(current, mediaDeleteRoute[1]);
          const nextActive = removed.state.mediaPlaylist.find((item) => item.active !== false);
          if (removed.state.promoMedia?.url === removed.item.url) {
            removed.state.promoMedia = nextActive
              ? {
                  type: nextActive.type,
                  url: nextActive.url,
                  filename: nextActive.filename,
                  fit: nextActive.fit,
                  updatedAt: new Date().toISOString(),
                }
              : resetPromoMedia(removed.state).promoMedia;
          }
          return removed;
        });
        await removeManagedMedia(publicDir, output.item).catch(() => {});
        database.appendAudit({
          actorType: ownerToken ? 'owner' : partnerAllowed ? 'partner' : 'employee',
          actorId: ownerToken ? 'owner' : partnerAllowed ? partner.userId : admin.userId,
          action: 'media.delete',
          outletId,
          metadata: { mediaId: output.item.id, type: output.item.type },
        });
        sendJson(response, 200, {
          state: ownerToken || partnerAllowed ? ownerState(nextState) : cashierState(nextState),
          mediaPlaylist: output.mediaPlaylist,
        });
        return;
      }

      if (request.method === 'POST' && subPath === '/media/reset') {
        if (!adminSession(request, outletId) && !ownerSession(request)) {
          sendJson(response, 401, { error: 'Login Admin atau Owner diperlukan.' });
          return;
        }
        const previousPlaylist = store.get().mediaPlaylist ?? [];
        const { state: nextState, output } = await mutate(outletId, (current) => {
          const reset = resetPromoMedia(current);
          reset.state.mediaPlaylist = [{
            id: 'default-promo',
            ...structuredClone(reset.promoMedia),
            durationSeconds: null,
            imageDurationSeconds: null,
            active: true,
          }];
          return reset;
        });
        await Promise.all(previousPlaylist.map((item) => removeManagedMedia(publicDir, item)));
        sendJson(response, 200, { state: ownerSession(request) ? ownerState(nextState) : cashierState(nextState), promoMedia: output.promoMedia });
        return;
      }

      sendJson(response, 404, { error: 'Route tidak ditemukan' });
    } catch (error) {
      sendJson(response, error.status ?? 400, { error: error.message || 'Request gagal' });
    }
  });

  const keepAlive = setInterval(() => {
    for (const map of [displayClientsMap, adminClientsMap, ownerClientsMap]) {
      for (const clients of map.values()) {
        for (const client of clients) client.write(': keep-alive\n\n');
      }
    }
  }, 20_000);

  return {
    server,
    stores,
    database,
    registryStore,
    listen(port = 3000, host = '0.0.0.0') {
      return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => {
          server.off('error', reject);
          resolve();
        });
      });
    },
    close() {
      clearInterval(keepAlive);
      for (const map of [displayClientsMap, adminClientsMap, ownerClientsMap]) {
        for (const clients of map.values()) {
          for (const client of clients) client.end();
        }
      }
      return new Promise((resolve, reject) => server.close((error) => {
        database.close();
        if (error) reject(error);
        else resolve();
      }));
    },
  };
}

async function start() {
  const example = JSON.parse(await readFile(join(PROJECT_DIR, 'data', 'state.example.json'), 'utf8'));
  const app = await createQueueServer({ initialState: example });
  const port = Number(process.env.PORT || 3000);
  await app.listen(port);
  console.log(`Coffee Queue Multi-Outlet aktif di http://localhost:${port}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  start().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
