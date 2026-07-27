import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { createQueueServer } from '../src/server.js';
import { createInitialState } from '../src/queue.js';
import { createPinHash } from '../src/security.js';

function cookiePair(response) {
  return (response.headers.get('set-cookie') ?? '').split(';')[0];
}

async function runLiveFlowTest() {
  console.log('🚀 Memulai smoke test alur multi-outlet terisolasi...');
  const root = await mkdtemp(join(tmpdir(), 'maucafe-live-flow-'));
  const dataDir = join(root, 'data');
  const publicDir = join(root, 'public');
  await mkdir(dataDir);
  await mkdir(publicDir);

  const outlets = [
    ['maucafe-alunalun', 'Maucafe Alun-Alun Jepara', 'Alun-Alun Jepara', '1111'],
    ['maucafe-tahunan', 'Maucafe Tahunan', 'Tahunan', '2222'],
    ['maucafe-bandengan', 'Maucafe Pantai Bandengan', 'Bandengan', '3333'],
    ['maucafe-kartini', 'Maucafe Pantai Kartini', 'Kartini', '4444'],
    ['maucafe-pecangaan', 'Maucafe Pecangaan', 'Pecangaan', '5555'],
  ].map(([id, name, address, adminPin]) => ({ id, name, address, adminPin }));
  await writeFile(join(dataDir, 'outlets.json'), JSON.stringify(outlets, null, 2));
  await writeFile(join(dataDir, 'security.json'), JSON.stringify({ ownerPinHash: createPinHash('1234') }, null, 2));

  const initialState = createInitialState({
    products: [
      { id: 'latte', name: 'Kopi Susu', category: 'Kopi', price: 18000, cost: 8000, active: true },
      { id: 'croissant', name: 'Croissant', category: 'Makanan', price: 17000, cost: 8000, active: true },
    ],
  });

  const app = await createQueueServer({ initialState, dataDir, publicDir });
  try {
    await app.listen(0, '127.0.0.1');
    const { port } = app.server.address();
    const baseUrl = `http://127.0.0.1:${port}`;

    const outletResponse = await fetch(`${baseUrl}/api/outlets`);
    const outletData = await outletResponse.json();
    assert.equal(outletData.outlets.length, 5);

    const publicState = await (await fetch(`${baseUrl}/api/outlet/maucafe-alunalun/state`)).json();
    assert.equal(publicState.products[0].id, 'latte');
    assert.equal('cost' in publicState.products[0], false);
    assert.equal('orders' in publicState, false);

    const adminLogin = await fetch(`${baseUrl}/api/outlet/maucafe-alunalun/admin/login`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pin: '1111' }),
    });
    assert.equal(adminLogin.status, 200);
    const bsdCookie = cookiePair(adminLogin);
    const firstShift = await fetch(`${baseUrl}/api/outlet/maucafe-alunalun/shifts/open`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: bsdCookie },
      body: JSON.stringify({ label: 'Pagi', openingCash: 0 }),
    });
    assert.equal(firstShift.status, 201);

    const orderResponse = await fetch(`${baseUrl}/api/outlet/maucafe-alunalun/orders`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: bsdCookie },
      body: JSON.stringify({ items: [{ productId: 'latte', quantity: 2 }], paymentMethod: 'QRIS' }),
    });
    assert.equal(orderResponse.status, 201);
    const orderData = await orderResponse.json();
    assert.equal(orderData.order.queueNumber, '1');

    const callResponse = await fetch(`${baseUrl}/api/outlet/maucafe-alunalun/orders/${orderData.order.id}/call`, {
      method: 'POST', headers: { 'content-type': 'application/json', cookie: bsdCookie }, body: '{}',
    });
    assert.equal(callResponse.status, 200);
    assert.equal((await callResponse.json()).state.activeCall.queueNumber, '1');

    const pikLogin = await fetch(`${baseUrl}/api/outlet/maucafe-tahunan/admin/login`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pin: '2222' }),
    });
    assert.equal(pikLogin.status, 200);
    const pikCookie = cookiePair(pikLogin);
    const secondShift = await fetch(`${baseUrl}/api/outlet/maucafe-tahunan/shifts/open`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: pikCookie },
      body: JSON.stringify({ label: 'Pagi', openingCash: 0 }),
    });
    assert.equal(secondShift.status, 201);
    const pikOrder = await fetch(`${baseUrl}/api/outlet/maucafe-tahunan/orders`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: pikCookie },
      body: JSON.stringify({ items: [{ productId: 'latte', quantity: 1 }], paymentMethod: 'cash' }),
    });
    assert.equal(pikOrder.status, 201);
    assert.equal((await pikOrder.json()).order.queueNumber, '1');

    const ownerLogin = await fetch(`${baseUrl}/api/owner/login`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pin: '1234' }),
    });
    assert.equal(ownerLogin.status, 200);
    const ownerCookie = cookiePair(ownerLogin);
    const summaryResponse = await fetch(`${baseUrl}/api/owner/multi-summary`, { headers: { cookie: ownerCookie } });
    assert.equal(summaryResponse.status, 200);
    const summary = await summaryResponse.json();
    assert.equal(summary.summaries.length, 5);
    assert.equal(summary.grandTotals.salesCount, 2);
    assert.equal(summary.grandTotals.received, 54000);

    console.log('✅ Smoke test multi-outlet lulus: auth, isolasi outlet, antrean, display state, dan owner summary bekerja.');
  } finally {
    await app.close().catch(() => {});
    await rm(root, { recursive: true, force: true });
  }
}

await runLiveFlowTest();
