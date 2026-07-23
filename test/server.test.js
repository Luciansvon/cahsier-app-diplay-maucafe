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
  await mkdir(publicDir);
  await writeFile(join(publicDir, 'admin.html'), '<h1>Admin</h1>');
  await writeFile(join(publicDir, 'display.html'), '<h1>Display</h1>');
  const initialState = createInitialState({
    products: [{ id: 'latte', name: 'Latte', category: 'Kopi', price: 20000, active: true }],
  });
  const app = await createQueueServer({ dataFile: join(directory, 'state.json'), publicDir, initialState });
  await app.listen(0, '127.0.0.1');
  const address = app.server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  t.after(async () => {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  });
  return { app, baseUrl };
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

test('serves admin, display, and current state', async (t) => {
  const { baseUrl } = await fixture(t);
  assert.match(await (await fetch(`${baseUrl}/admin`)).text(), /Admin/);
  assert.match(await (await fetch(`${baseUrl}/display`)).text(), /Display/);
  const { response, payload } = await jsonRequest(`${baseUrl}/api/state`);
  assert.equal(response.status, 200);
  assert.equal(payload.products[0].name, 'Latte');
});

test('runs the paid order lifecycle and persists the active call', async (t) => {
  const { baseUrl } = await fixture(t);
  const created = await jsonRequest(`${baseUrl}/api/orders`, 'POST', {
    items: [{ productId: 'latte', quantity: 2 }],
    paymentMethod: 'QRIS',
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.payload.order.queueNumber, '001');

  const id = created.payload.order.id;
  const called = await jsonRequest(`${baseUrl}/api/orders/${id}/call`, 'POST', {});
  assert.equal(called.payload.state.activeCall.queueNumber, '001');
  const recalled = await jsonRequest(`${baseUrl}/api/orders/${id}/call`, 'POST', {});
  assert.equal(recalled.payload.state.activeCall.eventId, 2);
  const completed = await jsonRequest(`${baseUrl}/api/orders/${id}/complete`, 'POST', {});
  assert.equal(completed.payload.order.status, 'completed');

  const state = await jsonRequest(`${baseUrl}/api/state`);
  assert.equal(state.payload.activeCall.queueNumber, '001');
});

test('supports product management, cancellation, and queue reset', async (t) => {
  const { baseUrl } = await fixture(t);
  const added = await jsonRequest(`${baseUrl}/api/products`, 'POST', {
    name: 'Tea', category: 'Non-Kopi', price: 12000,
  });
  assert.equal(added.response.status, 201);

  const updated = await jsonRequest(`${baseUrl}/api/products/${added.payload.product.id}`, 'PATCH', { active: false });
  assert.equal(updated.payload.product.active, false);

  const order = await jsonRequest(`${baseUrl}/api/orders`, 'POST', {
    items: [{ productId: 'latte', quantity: 1 }], paymentMethod: 'cash',
  });
  const cancelled = await jsonRequest(`${baseUrl}/api/orders/${order.payload.order.id}/cancel`, 'POST', {});
  assert.equal(cancelled.payload.order.status, 'cancelled');

  const reset = await jsonRequest(`${baseUrl}/api/reset`, 'POST', {});
  assert.equal(reset.payload.state.orders.length, 1);
  assert.equal(reset.payload.state.orders[0].status, 'cancelled');
  assert.equal(reset.payload.state.activeCall, null);
  assert.equal(reset.payload.state.nextQueueNumber, 1);
});

test('returns visible JSON errors for invalid input and unknown routes', async (t) => {
  const { baseUrl } = await fixture(t);
  const invalid = await jsonRequest(`${baseUrl}/api/orders`, 'POST', { items: [], paymentMethod: 'cash' });
  assert.equal(invalid.response.status, 400);
  assert.match(invalid.payload.error, /item/i);

  const missing = await jsonRequest(`${baseUrl}/api/missing`);
  assert.equal(missing.response.status, 404);
});

test('exposes an event stream with the latest state', async (t) => {
  const { baseUrl } = await fixture(t);
  const controller = new AbortController();
  const response = await fetch(`${baseUrl}/api/events`, { signal: controller.signal });
  assert.match(response.headers.get('content-type'), /text\/event-stream/);
  const reader = response.body.getReader();
  const first = await reader.read();
  controller.abort();
  assert.match(new TextDecoder().decode(first.value), /"revision":0/);
});
