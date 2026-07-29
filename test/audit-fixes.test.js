import test from 'node:test';
import assert from 'node:assert/strict';

import { createPinHash } from '../src/security.js';
import { cookiePair, fixture, jsonRequest } from './helpers.js';

async function loginOwner(baseUrl) {
  const result = await jsonRequest(`${baseUrl}/api/owner/login`, 'POST', { pin: '1234' });
  assert.equal(result.response.status, 200);
  return cookiePair(result.response);
}

async function loginAdmin(baseUrl, outletId) {
  const result = await jsonRequest(`${baseUrl}/api/outlet/${outletId}/admin/login`, 'POST', { pin: '1111' });
  assert.equal(result.response.status, 200);
  const cookie = cookiePair(result.response);
  const shift = await jsonRequest(`${baseUrl}/api/outlet/${outletId}/shifts/open`, 'POST', {
    label: 'Audit',
    openingCash: 0,
  }, { cookie });
  assert.equal(shift.response.status, 201);
  return cookie;
}

async function openEventStream(t, url, cookie) {
  const controller = new AbortController();
  t.after(() => controller.abort());
  const response = await fetch(url, {
    headers: { cookie },
    signal: controller.signal,
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/event-stream/);
  const reader = response.body.getReader();
  const initial = await reader.read();
  assert.equal(initial.done, false);
  return { controller, reader };
}

test('Owner SSE stops receiving data immediately after logout', async (t) => {
  const { baseUrl, defaultOutletId } = await fixture(t);
  const revokedCookie = await loginOwner(baseUrl);
  const activeCookie = await loginOwner(baseUrl);
  const stream = await openEventStream(
    t,
    `${baseUrl}/api/outlet/${defaultOutletId}/owner/events`,
    revokedCookie,
  );

  const logout = await jsonRequest(`${baseUrl}/api/owner/logout`, 'POST', {}, { cookie: revokedCookie });
  assert.equal(logout.response.status, 200);
  const mutation = await jsonRequest(
    `${baseUrl}/api/outlet/${defaultOutletId}/products/latte`,
    'PATCH',
    { active: false },
    { cookie: activeCookie },
  );
  assert.equal(mutation.response.status, 200);

  const next = await stream.reader.read();
  assert.equal(next.done, true);
});

test('Admin SSE stops receiving data immediately after logout', async (t) => {
  const { baseUrl, defaultOutletId } = await fixture(t);
  const adminCookie = await loginAdmin(baseUrl, defaultOutletId);
  const ownerCookie = await loginOwner(baseUrl);
  const stream = await openEventStream(
    t,
    `${baseUrl}/api/outlet/${defaultOutletId}/admin/events`,
    adminCookie,
  );

  const logout = await jsonRequest(
    `${baseUrl}/api/outlet/${defaultOutletId}/admin/logout`,
    'POST',
    {},
    { cookie: adminCookie },
  );
  assert.equal(logout.response.status, 200);
  const mutation = await jsonRequest(
    `${baseUrl}/api/outlet/${defaultOutletId}/products/latte`,
    'PATCH',
    { active: false },
    { cookie: ownerCookie },
  );
  assert.equal(mutation.response.status, 200);

  const next = await stream.reader.read();
  assert.equal(next.done, true);
});

test('Mitra cannot re-enable a product disabled by Owner', async (t) => {
  const { baseUrl, defaultOutletId } = await fixture(t, {
    registryPatch: {
      outlets: [{
        id: 'maucafe-alunalun',
        name: 'Maucafe Alun-Alun',
        address: 'Jepara',
        partnerId: 'partner-1',
        status: 'active',
        adminPinHash: createPinHash('1111'),
      }],
      partners: [{
        id: 'partner-1',
        name: 'Mitra 1',
        outletIds: ['maucafe-alunalun'],
        active: true,
      }],
      users: [{
        id: 'user-partner-1',
        username: 'mitra1',
        name: 'Mitra 1',
        role: 'partner',
        partnerId: 'partner-1',
        outletIds: ['maucafe-alunalun'],
        pinHash: createPinHash('5678'),
        active: true,
      }],
      masterProducts: [{
        id: 'latte',
        name: 'Latte',
        category: 'Kopi',
        price: 20_000,
        cost: 8_000,
        active: true,
      }],
    },
  });
  const ownerCookie = await loginOwner(baseUrl);
  const ownerDisabled = await jsonRequest(
    `${baseUrl}/api/outlet/${defaultOutletId}/products/latte`,
    'PATCH',
    { active: false },
    { cookie: ownerCookie },
  );
  assert.equal(ownerDisabled.response.status, 200);

  const partnerLogin = await jsonRequest(`${baseUrl}/api/partner/login`, 'POST', {
    username: 'mitra1',
    pin: '5678',
  });
  const partnerCookie = cookiePair(partnerLogin.response);
  const override = await jsonRequest(
    `${baseUrl}/api/partner/outlets/${defaultOutletId}/products/latte`,
    'PATCH',
    { active: true },
    { cookie: partnerCookie },
  );
  assert.equal(override.response.status, 409);

  const publicState = await jsonRequest(`${baseUrl}/api/outlet/${defaultOutletId}/state`);
  assert.equal(publicState.payload.products.some((product) => product.id === 'latte'), false);
});

test('Kasir receives quantities without financial report fields', async (t) => {
  const { baseUrl, defaultOutletId } = await fixture(t);
  const adminCookie = await loginAdmin(baseUrl, defaultOutletId);
  const order = await jsonRequest(`${baseUrl}/api/outlet/${defaultOutletId}/orders`, 'POST', {
    items: [{ productId: 'latte', quantity: 2 }],
    paymentMethod: 'cash',
  }, { cookie: adminCookie });
  assert.equal(order.response.status, 201);

  const result = await jsonRequest(
    `${baseUrl}/api/outlet/${defaultOutletId}/admin/state`,
    'GET',
    undefined,
    { cookie: adminCookie },
  );
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.dailySummary.totalQuantity, 2);
  assert.equal(result.payload.dailySummary.products[0].quantity, 2);
  for (const key of ['revenue', 'received', 'paymentTotals']) {
    assert.equal(key in result.payload.dailySummary, false);
  }
  for (const key of ['unitPrice', 'revenue']) {
    assert.equal(key in result.payload.dailySummary.products[0], false);
  }
});

test('bulk product endpoint rejects payloads above its advertised one megabyte limit', async (t) => {
  const { baseUrl } = await fixture(t);
  const ownerCookie = await loginOwner(baseUrl);
  const body = JSON.stringify({
    requestId: 'req_payload_limit_1234567890',
    dryRun: true,
    rows: [],
    padding: 'x'.repeat(1_100_000),
  });
  const response = await fetch(`${baseUrl}/api/owner/products/bulk`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: ownerCookie,
    },
    body,
  });
  assert.equal(response.status, 413);
});

test('order lifecycle writes call, complete, and cancel audit events', async (t) => {
  const { app, baseUrl, defaultOutletId } = await fixture(t);
  const adminCookie = await loginAdmin(baseUrl, defaultOutletId);
  const first = await jsonRequest(`${baseUrl}/api/outlet/${defaultOutletId}/orders`, 'POST', {
    items: [{ productId: 'latte', quantity: 1 }],
    paymentMethod: 'cash',
  }, { cookie: adminCookie });
  const second = await jsonRequest(`${baseUrl}/api/outlet/${defaultOutletId}/orders`, 'POST', {
    items: [{ productId: 'latte', quantity: 1 }],
    paymentMethod: 'QRIS',
  }, { cookie: adminCookie });

  await jsonRequest(
    `${baseUrl}/api/outlet/${defaultOutletId}/orders/${first.payload.order.id}/call`,
    'POST',
    {},
    { cookie: adminCookie },
  );
  await jsonRequest(
    `${baseUrl}/api/outlet/${defaultOutletId}/orders/${first.payload.order.id}/complete`,
    'POST',
    {},
    { cookie: adminCookie },
  );
  await jsonRequest(
    `${baseUrl}/api/outlet/${defaultOutletId}/orders/${second.payload.order.id}/cancel`,
    'POST',
    { reason: 'Salah input', ownerPin: '1234' },
    { cookie: adminCookie },
  );

  const audit = app.database.listAudit({ outletId: defaultOutletId, limit: 100 });
  for (const action of ['order.call', 'order.complete', 'order.cancel']) {
    const event = audit.find((entry) => entry.action === action);
    assert.ok(event, `Audit ${action} wajib ada`);
    assert.equal(typeof event.metadata.orderId, 'string');
  }
});
