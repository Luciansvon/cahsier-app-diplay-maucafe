import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { createQueueServer } from '../src/server.js';
import { createInitialState } from '../src/queue.js';

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'queue-server-'));
  const publicDir = join(directory, 'public');
  const dataDir = join(directory, 'data');
  await mkdir(publicDir);
  await mkdir(dataDir);
  await writeFile(join(publicDir, 'admin.html'), '<h1>Admin</h1>');
  await writeFile(join(publicDir, 'display.html'), '<h1>Display</h1>');
  await writeFile(join(publicDir, 'owner.html'), '<h1>Owner</h1>');
  await writeFile(join(publicDir, 'owner.js'), 'export const owner = true;');
  await writeFile(join(publicDir, 'sales.js'), 'export const sales = true;');

  const outlets = [
    { id: 'maucafe-bsd', name: 'Maucafe BSD', address: 'BSD City', adminPin: '1111' },
    { id: 'maucafe-pik', name: 'Maucafe PIK', address: 'PIK Avenue', adminPin: '1111' },
  ];
  await writeFile(join(dataDir, 'outlets.json'), JSON.stringify(outlets));

  const initialState = createInitialState({
    products: [{ id: 'latte', name: 'Latte', category: 'Kopi', price: 20000, active: true }],
  });
  const app = await createQueueServer({ dataDir, publicDir, initialState });
  await app.listen(0, '127.0.0.1');
  const address = app.server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  t.after(async () => {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  });
  return { app, baseUrl, defaultOutletId: 'maucafe-bsd' };
}

async function jsonRequest(url, method = 'GET', body) {
  const response = await fetch(url, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json();
  return { response, payload };
}

async function jsonRequestWithCookie(url, method = 'GET', body, cookie = '') {
  const response = await fetch(url, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json();
  return { response, payload };
}

test('serves admin, display, owner, sales module, outlets list and state per outlet', async (t) => {
  const { baseUrl, defaultOutletId } = await fixture(t);
  assert.match(await (await fetch(`${baseUrl}/outlet/${defaultOutletId}/admin`)).text(), /Admin/);
  assert.match(await (await fetch(`${baseUrl}/outlet/${defaultOutletId}/display`)).text(), /Display/);
  assert.match(await (await fetch(`${baseUrl}/owner`)).text(), /Owner/);

  const outletsReq = await jsonRequest(`${baseUrl}/api/outlets`);
  assert.equal(outletsReq.response.status, 200);
  assert.equal(outletsReq.payload.outlets.length, 2);

  const { response, payload } = await jsonRequest(`${baseUrl}/api/outlet/${defaultOutletId}/state`);
  assert.equal(response.status, 200);
  assert.equal(payload.products[0].name, 'Latte');
  assert.equal('ownerPin' in payload, false);
  assert.equal('ownerPinHash' in payload, false);
});

test('protects owner data with a server session and supports multi-summary', async (t) => {
  const { baseUrl } = await fixture(t);

  const blocked = await jsonRequest(`${baseUrl}/api/owner/multi-summary`);
  assert.equal(blocked.response.status, 401);

  const rejected = await jsonRequest(`${baseUrl}/api/owner/login`, 'POST', { pin: '9999' });
  assert.equal(rejected.response.status, 401);

  const login = await jsonRequest(`${baseUrl}/api/owner/login`, 'POST', { pin: '1234' });
  assert.equal(login.response.status, 200);
  const cookie = login.response.headers.get('set-cookie');
  assert.match(cookie, /owner_session=/);
  assert.match(cookie, /HttpOnly/i);

  const multiSummary = await jsonRequestWithCookie(`${baseUrl}/api/owner/multi-summary`, 'GET', undefined, cookie);
  assert.equal(multiSummary.response.status, 200);
  assert.equal(multiSummary.payload.summaries.length, 2);

  const logout = await jsonRequestWithCookie(`${baseUrl}/api/owner/logout`, 'POST', {}, cookie);
  assert.equal(logout.response.status, 200);
});

test('runs the paid order lifecycle and persists active call per outlet', async (t) => {
  const { baseUrl, defaultOutletId } = await fixture(t);
  const created = await jsonRequest(`${baseUrl}/api/outlet/${defaultOutletId}/orders`, 'POST', {
    items: [{ productId: 'latte', quantity: 2 }],
    paymentMethod: 'QRIS',
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.payload.order.queueNumber, '001');

  const id = created.payload.order.id;
  const called = await jsonRequest(`${baseUrl}/api/outlet/${defaultOutletId}/orders/${id}/call`, 'POST', {});
  assert.equal(called.payload.state.activeCall.queueNumber, '001');

  const state = await jsonRequest(`${baseUrl}/api/outlet/${defaultOutletId}/state`);
  assert.equal(state.payload.activeCall.queueNumber, '001');

  const pikState = await jsonRequest(`${baseUrl}/api/outlet/maucafe-pik/state`);
  assert.equal(pikState.payload.activeCall, null);
});

test('supports product management, cancellation, and queue reset per outlet', async (t) => {
  const { baseUrl, defaultOutletId } = await fixture(t);
  const added = await jsonRequest(`${baseUrl}/api/outlet/${defaultOutletId}/products`, 'POST', {
    name: 'Tea', category: 'Non-Kopi', price: 12000,
  });
  assert.equal(added.response.status, 201);

  const updated = await jsonRequest(`${baseUrl}/api/outlet/${defaultOutletId}/products/${added.payload.product.id}`, 'PATCH', { active: false });
  assert.equal(updated.payload.product.active, false);

  const order = await jsonRequest(`${baseUrl}/api/outlet/${defaultOutletId}/orders`, 'POST', {
    items: [{ productId: 'latte', quantity: 1 }], paymentMethod: 'cash',
  });
  const cancelled = await jsonRequest(`${baseUrl}/api/outlet/${defaultOutletId}/orders/${order.payload.order.id}/cancel`, 'POST', {});
  assert.equal(cancelled.payload.order.status, 'cancelled');

  const blockedReset = await jsonRequest(`${baseUrl}/api/outlet/${defaultOutletId}/reset`, 'POST', {});
  assert.equal(blockedReset.response.status, 401);

  const reset = await jsonRequest(`${baseUrl}/api/outlet/${defaultOutletId}/reset`, 'POST', { pin: '1234' });
  assert.equal(reset.payload.state.orders.length, 1);
  assert.equal(reset.payload.state.orders[0].status, 'cancelled');
});

test('exposes an event stream per outlet with the latest state', async (t) => {
  const { baseUrl, defaultOutletId } = await fixture(t);
  const controller = new AbortController();
  const response = await fetch(`${baseUrl}/api/outlet/${defaultOutletId}/events`, { signal: controller.signal });
  assert.match(response.headers.get('content-type'), /text\/event-stream/);
  const reader = response.body.getReader();
  const first = await reader.read();
  controller.abort();
  assert.match(new TextDecoder().decode(first.value), /"revision":0/);
});
