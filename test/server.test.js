import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { createQueueServer } from '../src/server.js';
import { completeOrder, createInitialState, createOrder } from '../src/queue.js';
import { recordInventoryMovement } from '../src/operations.js';
import { createPinHash } from '../src/security.js';
import { importLegacyJson, SqliteDatabase } from '../src/sqlite-store.js';

async function fixture(t, {
  configuredOutlets,
  ownerPin = '1234',
  registryPatch,
} = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'queue-server-'));
  const publicDir = join(directory, 'public');
  const dataDir = join(directory, 'data');
  await mkdir(publicDir);
  await mkdir(dataDir);
  for (const [name, html] of [['admin.html', '<h1>Admin</h1>'], ['display.html', '<h1>Display</h1>'], ['owner.html', '<h1>Owner</h1>']]) {
    await writeFile(join(publicDir, name), html);
  }
  await writeFile(join(publicDir, 'owner.js'), 'export const owner = true;');
  await writeFile(join(publicDir, 'partner.html'), '<h1>Partner</h1>');
  await writeFile(join(publicDir, 'partner.js'), 'export const partner = true;');
  await writeFile(join(publicDir, 'partner.css'), '.partner {}');
  await writeFile(join(publicDir, 'native-shell.js'), 'export const nativeShell = true;');
  await writeFile(join(publicDir, 'queue-number.js'), 'export const queueNumberText = () => "satu";');
  await writeFile(join(publicDir, 'sales.js'), 'export const sales = true;');

  // Deliberately use a legacy plaintext admin PIN so startup migration is tested.
  const outlets = configuredOutlets ?? [
    { id: 'maucafe-alunalun', name: 'Maucafe Alun-Alun Jepara', address: 'Alun-Alun Jepara', adminPin: '1111' },
    { id: 'maucafe-pik', name: 'Maucafe PIK', address: 'PIK Avenue', adminPin: '2222' },
  ];
  await writeFile(join(dataDir, 'outlets.json'), JSON.stringify(outlets));
  await writeFile(join(dataDir, 'security.json'), JSON.stringify({ ownerPinHash: createPinHash(ownerPin) }, null, 2));

  const initialState = createInitialState({
    products: [{ id: 'latte', name: 'Latte', category: 'Kopi', price: 20000, cost: 8000, active: true }],
  });
  if (registryPatch) {
    const database = await new SqliteDatabase(join(dataDir, 'maucafe.sqlite')).init();
    await importLegacyJson({ database, dataDir, initialState });
    database.writeState('registry', {
      ...database.readState('registry'),
      ...structuredClone(registryPatch),
    });
    database.close();
  }
  const app = await createQueueServer({ dataDir, publicDir, initialState });
  await app.listen(0, '127.0.0.1');
  const address = app.server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  t.after(async () => {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  });
  return { app, baseUrl, dataDir, publicDir, defaultOutletId: outlets[0].id };
}

function cookiePair(response) {
  return (response.headers.get('set-cookie') ?? '').split(';')[0];
}

async function jsonRequest(url, method = 'GET', body, cookie = '', headers = {}) {
  const response = await fetch(url, {
    method,
    headers: {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json();
  return { response, payload };
}

async function loginAdmin(baseUrl, outletId = 'maucafe-alunalun', pin = '1111') {
  const login = await jsonRequest(`${baseUrl}/api/outlet/${outletId}/admin/login`, 'POST', { pin });
  assert.equal(login.response.status, 200);
  const cookie = cookiePair(login.response);
  const shift = await jsonRequest(`${baseUrl}/api/outlet/${outletId}/shifts/open`, 'POST', {
    label: 'Pagi',
    openingCash: 0,
  }, cookie);
  assert.equal([201, 400].includes(shift.response.status), true);
  return cookie;
}

async function loginOwner(baseUrl) {
  const login = await jsonRequest(`${baseUrl}/api/owner/login`, 'POST', { pin: '1234' });
  assert.equal(login.response.status, 200);
  return cookiePair(login.response);
}

async function createPartnerWithApprovedOutlet(baseUrl, ownerCookie) {
  const created = await jsonRequest(`${baseUrl}/api/owner/partners`, 'POST', {
    name: 'Mitra Jepara',
    username: 'mitra.jepara',
    pin: '5678',
  }, ownerCookie);
  assert.equal(created.response.status, 201);
  const login = await jsonRequest(`${baseUrl}/api/partner/login`, 'POST', {
    username: 'mitra.jepara',
    pin: '5678',
  });
  assert.equal(login.response.status, 200);
  const partnerCookie = cookiePair(login.response);
  const proposed = await jsonRequest(`${baseUrl}/api/partner/outlets`, 'POST', {
    name: 'MAUCAFE Mitra Jepara',
    address: 'Jl. Mitra Jepara',
  }, partnerCookie);
  assert.equal(proposed.response.status, 201);
  const approved = await jsonRequest(
    `${baseUrl}/api/owner/outlets/${proposed.payload.outlet.id}/approve`,
    'POST',
    {},
    ownerCookie,
  );
  assert.equal(approved.response.status, 200);
  return {
    ...created.payload.partner,
    outletId: proposed.payload.outlet.id,
    partnerCookie,
  };
}

test('Partner must propose its own outlet before Owner approval', async (t) => {
  const { baseUrl, defaultOutletId } = await fixture(t);
  const ownerCookie = await loginOwner(baseUrl);
  const created = await jsonRequest(`${baseUrl}/api/owner/partners`, 'POST', {
    name: 'Mitra Jepara',
    username: 'mitra.jepara',
    pin: '5678',
  }, ownerCookie);
  assert.equal(created.response.status, 201);

  const legacyAssignment = await jsonRequest(
    `${baseUrl}/api/owner/outlets/${defaultOutletId}/assign`,
    'POST',
    { partnerId: created.payload.partner.id },
    ownerCookie,
  );
  assert.equal(legacyAssignment.response.status, 404);

  const partnerLogin = await jsonRequest(`${baseUrl}/api/partner/login`, 'POST', {
    username: 'mitra.jepara',
    pin: '5678',
  });
  assert.equal(partnerLogin.response.status, 200);
  const partnerCookie = cookiePair(partnerLogin.response);

  const proposed = await jsonRequest(`${baseUrl}/api/partner/outlets`, 'POST', {
    name: 'MAUCAFE Jepara Kota',
    address: 'Jl. Pemuda',
  }, partnerCookie);
  assert.equal(proposed.response.status, 201);
  assert.equal(proposed.payload.outlet.partnerId, created.payload.partner.id);
  assert.equal(proposed.payload.outlet.status, 'pending');

  const approved = await jsonRequest(
    `${baseUrl}/api/owner/outlets/${proposed.payload.outlet.id}/approve`,
    'POST',
    {},
    ownerCookie,
  );
  assert.equal(approved.response.status, 200);
  assert.equal(approved.payload.outlet.status, 'active');
});

test('Partner dashboard combines every active outlet owned by that Partner', async (t) => {
  const { app, baseUrl } = await fixture(t);
  const ownerCookie = await loginOwner(baseUrl);
  const created = await jsonRequest(`${baseUrl}/api/owner/partners`, 'POST', {
    name: 'Mitra Gabungan',
    username: 'mitra.gabungan',
    pin: '5678',
  }, ownerCookie);
  assert.equal(created.response.status, 201);
  const login = await jsonRequest(`${baseUrl}/api/partner/login`, 'POST', {
    username: 'mitra.gabungan',
    pin: '5678',
  });
  const partnerCookie = cookiePair(login.response);

  const outletIds = [];
  for (const [name, address] of [['MAUCAFE Utara', 'Jl. Utara'], ['MAUCAFE Selatan', 'Jl. Selatan']]) {
    const proposed = await jsonRequest(`${baseUrl}/api/partner/outlets`, 'POST', {
      name,
      address,
    }, partnerCookie);
    await jsonRequest(
      `${baseUrl}/api/owner/outlets/${proposed.payload.outlet.id}/approve`,
      'POST',
      {},
      ownerCookie,
    );
    outletIds.push(proposed.payload.outlet.id);
  }

  await app.stores.get(outletIds[0]).store.update((state) => (
    createOrder(state, {
      items: [{ productId: 'latte', quantity: 1 }],
      paymentMethod: 'cash',
    }).state
  ));
  await app.stores.get(outletIds[1]).store.update((state) => (
    createOrder(state, {
      items: [{ productId: 'latte', quantity: 2 }],
      paymentMethod: 'QRIS',
    }).state
  ));

  const dashboard = await jsonRequest(`${baseUrl}/api/partner/dashboard`, 'GET', undefined, partnerCookie);
  assert.equal(dashboard.response.status, 200);
  assert.equal(dashboard.payload.summary.outletCount, 2);
  assert.equal(dashboard.payload.summary.revenue, 60_000);
  assert.equal(dashboard.payload.summary.received, 60_000);
  assert.equal(dashboard.payload.summary.grossProfit, 36_000);
  assert.equal(dashboard.payload.summary.transactionCount, 2);
  assert.deepEqual(dashboard.payload.summary.paymentTotals, { cash: 20_000, QRIS: 40_000 });
});

test('Owner summary combines active outlets per Partner including cup balance', async (t) => {
  const { app, baseUrl } = await fixture(t);
  const ownerCookie = await loginOwner(baseUrl);

  async function createPartnerOutlets({
    name,
    username,
    pin,
    outlets,
    approvedCount,
  }) {
    const created = await jsonRequest(`${baseUrl}/api/owner/partners`, 'POST', {
      name,
      username,
      pin,
    }, ownerCookie);
    assert.equal(created.response.status, 201);
    const login = await jsonRequest(`${baseUrl}/api/partner/login`, 'POST', { username, pin });
    assert.equal(login.response.status, 200);
    const partnerCookie = cookiePair(login.response);
    const outletIds = [];
    for (const [index, [outletName, address]] of outlets.entries()) {
      const proposed = await jsonRequest(`${baseUrl}/api/partner/outlets`, 'POST', {
        name: outletName,
        address,
      }, partnerCookie);
      assert.equal(proposed.response.status, 201);
      outletIds.push(proposed.payload.outlet.id);
      if (index < approvedCount) {
        const approved = await jsonRequest(
          `${baseUrl}/api/owner/outlets/${proposed.payload.outlet.id}/approve`,
          'POST',
          {},
          ownerCookie,
        );
        assert.equal(approved.response.status, 200);
      }
    }
    return { partner: created.payload.partner, outletIds };
  }

  const doni = await createPartnerOutlets({
    name: 'Doni',
    username: 'doni.owner',
    pin: '5678',
    approvedCount: 3,
    outlets: [
      ['MAUCAFE Doni Utara', 'Jl. Doni Utara'],
      ['MAUCAFE Doni Tengah', 'Jl. Doni Tengah'],
      ['MAUCAFE Doni Selatan', 'Jl. Doni Selatan'],
      ['MAUCAFE Doni Pending', 'Jl. Doni Pending'],
    ],
  });
  const dedi = await createPartnerOutlets({
    name: 'Dedi',
    username: 'dedi.owner',
    pin: '6789',
    approvedCount: 2,
    outlets: [
      ['MAUCAFE Dedi Barat', 'Jl. Dedi Barat'],
      ['MAUCAFE Dedi Timur', 'Jl. Dedi Timur'],
    ],
  });

  async function seedOutlet(outletId, { quantity = 0, paymentMethod = 'cash', cups }) {
    await app.stores.get(outletId).store.update((current) => {
      const withOrder = quantity > 0
        ? createOrder(current, {
          items: [{ productId: 'latte', quantity }],
          paymentMethod,
        }).state
        : current;
      return recordInventoryMovement(withOrder, {
        type: 'received',
        quantity: cups,
        actorType: 'owner',
        actorId: 'owner',
        actorName: 'Owner',
      }).state;
    });
  }

  await seedOutlet(doni.outletIds[0], { quantity: 1, paymentMethod: 'cash', cups: 10 });
  await seedOutlet(doni.outletIds[1], { quantity: 2, paymentMethod: 'QRIS', cups: 20 });
  await seedOutlet(doni.outletIds[2], { cups: 5 });
  await seedOutlet(dedi.outletIds[0], { quantity: 3, paymentMethod: 'cash', cups: 9 });
  await seedOutlet(dedi.outletIds[1], { cups: 1 });

  const response = await jsonRequest(`${baseUrl}/api/owner/multi-summary`, 'GET', undefined, ownerCookie);
  assert.equal(response.response.status, 200);
  const doniSummary = response.payload.partnerSummaries.find((summary) => summary.id === doni.partner.id);
  const dediSummary = response.payload.partnerSummaries.find((summary) => summary.id === dedi.partner.id);

  assert.deepEqual({
    outletCount: doniSummary.outletCount,
    pendingOutletCount: doniSummary.pendingOutletCount,
    received: doniSummary.received,
    netProfit: doniSummary.netProfit,
    salesCount: doniSummary.salesCount,
    activeCount: doniSummary.activeCount,
    cupBalance: doniSummary.inventory.balance,
  }, {
    outletCount: 3,
    pendingOutletCount: 1,
    received: 60_000,
    netProfit: 36_000,
    salesCount: 2,
    activeCount: 2,
    cupBalance: 35,
  });
  assert.deepEqual({
    outletCount: dediSummary.outletCount,
    pendingOutletCount: dediSummary.pendingOutletCount,
    received: dediSummary.received,
    netProfit: dediSummary.netProfit,
    salesCount: dediSummary.salesCount,
    activeCount: dediSummary.activeCount,
    cupBalance: dediSummary.inventory.balance,
  }, {
    outletCount: 2,
    pendingOutletCount: 0,
    received: 60_000,
    netProfit: 36_000,
    salesCount: 1,
    activeCount: 1,
    cupBalance: 10,
  });
  assert.equal(response.payload.summaries.some((summary) => summary.id === doni.outletIds[3]), false);
  assert.equal(response.payload.unassignedSummary.name, 'Outlet tanpa Mitra');
  assert.equal(response.payload.unassignedSummary.outletCount, 2);
  assert.equal(response.payload.grandTotals.received, 120_000);
  assert.equal(response.payload.grandTotals.salesCount, 3);
});

test('serves pages and exposes only a minimal public display state', async (t) => {
  const { baseUrl, defaultOutletId } = await fixture(t);
  assert.match(await (await fetch(`${baseUrl}/outlet/${defaultOutletId}/admin`)).text(), /Admin/);
  assert.match(await (await fetch(`${baseUrl}/outlet/${defaultOutletId}/display`)).text(), /Display/);
  assert.match(await (await fetch(`${baseUrl}/owner`)).text(), /Owner/);
  assert.match(await (await fetch(`${baseUrl}/partner`)).text(), /Partner/);
  assert.equal((await fetch(`${baseUrl}/native-shell.js`)).status, 200);
  assert.equal((await fetch(`${baseUrl}/outlet/${defaultOutletId}/native-shell.js`)).status, 200);
  assert.equal((await fetch(`${baseUrl}/queue-number.js`)).status, 200);
  assert.equal((await fetch(`${baseUrl}/outlet/${defaultOutletId}/queue-number.js`)).status, 200);
  assert.equal((await fetch(`${baseUrl}/favicon.ico`)).status, 204);

  const outletsReq = await jsonRequest(`${baseUrl}/api/outlets`);
  assert.equal(outletsReq.response.status, 200);
  assert.equal(outletsReq.payload.outlets.length, 2);
  const health = await jsonRequest(`${baseUrl}/api/health`);
  assert.deepEqual(
    { ok: health.payload.ok, storage: health.payload.storage, activeOutlets: health.payload.activeOutlets },
    { ok: true, storage: 'sqlite', activeOutlets: 2 },
  );

  const { response, payload } = await jsonRequest(`${baseUrl}/api/outlet/${defaultOutletId}/state`);
  assert.equal(response.status, 200);
  assert.equal(payload.products[0].name, 'Latte');
  assert.equal('cost' in payload.products[0], false);
  assert.equal('orders' in payload, false);
  assert.equal('taxConfig' in payload, false);
  assert.equal('ownerPin' in payload, false);
  assert.equal('ownerPinHash' in payload, false);
});

test('public state expires yesterday active queue before exposing display data', async (t) => {
  const { app, baseUrl, defaultOutletId } = await fixture(t);
  const target = app.stores.get(defaultOutletId);
  await target.store.update((state) => ({
    ...state,
    businessDate: '2000-01-01',
    nextQueueNumber: 8,
    orders: [{
      id: 'stale-order',
      queueNumber: '7',
      businessDate: '2000-01-01',
      paymentStatus: 'paid',
      paymentMethod: 'cash',
      items: [],
      total: 0,
      grandTotal: 0,
      status: 'ready',
      createdAt: '2000-01-01T00:00:00.000Z',
      updatedAt: '2000-01-01T00:00:00.000Z',
    }],
    activeCall: {
      orderId: 'stale-order',
      queueNumber: '7',
      eventId: 99,
      calledAt: '2000-01-01T00:00:00.000Z',
    },
    nextCallEventId: 100,
  }));

  const state = await jsonRequest(`${baseUrl}/api/outlet/${defaultOutletId}/state`);

  assert.equal(state.response.status, 200);
  assert.equal(state.payload.activeCall, null);
  assert.equal(target.store.get().orders[0].status, 'expired');
  assert.equal(target.store.get().nextQueueNumber, 1);
  assert.equal(target.store.get().nextCallEventId, 100);
});

test('supports scoped Partner and Employee accounts, shifts, and dynamic outlet approval', async (t) => {
  const { baseUrl } = await fixture(t);
  const ownerCookie = await loginOwner(baseUrl);
  const partner = await createPartnerWithApprovedOutlet(baseUrl, ownerCookie);
  const partnerCookie = partner.partnerCookie;
  const partnerOutletId = partner.outletId;
  assert.equal(
    (await jsonRequest(`${baseUrl}/api/partner/session`, 'GET', undefined, partnerCookie)).payload.authenticated,
    true,
  );

  const employee = await jsonRequest(`${baseUrl}/api/partner/employees`, 'POST', {
    outletId: partnerOutletId,
    name: 'Kasir Pagi',
    username: 'kasir.pagi',
    pin: '2468',
  }, partnerCookie);
  assert.equal(employee.response.status, 201);
  assert.equal(employee.payload.user.role, 'employee');
  assert.equal('pinHash' in employee.payload.user, false);

  const employeeLogin = await jsonRequest(`${baseUrl}/api/outlet/${partnerOutletId}/admin/login`, 'POST', {
    username: 'kasir.pagi',
    pin: '2468',
  });
  assert.equal(employeeLogin.response.status, 200);
  const employeeCookie = cookiePair(employeeLogin.response);

  const blockedOrder = await jsonRequest(`${baseUrl}/api/outlet/${partnerOutletId}/orders`, 'POST', {
    shiftId: 'fake-client-shift',
    employeeId: 'fake-client-user',
    employeeName: 'Palsu',
    items: [{ productId: 'latte', quantity: 1 }],
    paymentMethod: 'cash',
  }, employeeCookie);
  assert.equal(blockedOrder.response.status, 409);
  assert.match(blockedOrder.payload.error, /buka shift/i);

  const opened = await jsonRequest(`${baseUrl}/api/outlet/${partnerOutletId}/shifts/open`, 'POST', {
    label: 'Pagi',
    openingCash: 100_000,
  }, employeeCookie);
  assert.equal(opened.response.status, 201);

  const createdOrder = await jsonRequest(`${baseUrl}/api/outlet/${partnerOutletId}/orders`, 'POST', {
    shiftId: 'fake-client-shift',
    employeeId: 'fake-client-user',
    employeeName: 'Palsu',
    items: [{ productId: 'latte', quantity: 2 }],
    paymentMethod: 'cash',
  }, employeeCookie);
  assert.equal(createdOrder.response.status, 201);
  assert.equal(createdOrder.payload.order.shiftId, opened.payload.shift.id);
  assert.equal(createdOrder.payload.order.employeeId, employee.payload.user.id);
  assert.equal(createdOrder.payload.order.employeeName, 'Kasir Pagi');

  const cashierState = await jsonRequest(
    `${baseUrl}/api/outlet/${partnerOutletId}/admin/state`,
    'GET',
    undefined,
    employeeCookie,
  );
  assert.equal(cashierState.response.status, 200);
  assert.equal(cashierState.payload.dailySummary.revenue, 40_000);
  assert.equal(cashierState.payload.dailySummary.paymentTotals.cash, 40_000);
  assert.equal(cashierState.payload.dailySummary.products[0].quantity, 2);
  assert.equal('totalCost' in cashierState.payload.dailySummary, false);
  assert.equal('netProfit' in cashierState.payload.dailySummary, false);

  const proposed = await jsonRequest(`${baseUrl}/api/partner/outlets`, 'POST', {
    name: 'MAUCAFE Jepara Kota',
    address: 'Jl. Pemuda',
  }, partnerCookie);
  assert.equal(proposed.response.status, 201);
  assert.equal(proposed.payload.outlet.status, 'pending');
  assert.equal((await fetch(`${baseUrl}/outlet/${proposed.payload.outlet.id}/admin`)).status, 404);

  const ownerFranchise = await jsonRequest(`${baseUrl}/api/owner/franchise`, 'GET', undefined, ownerCookie);
  assert.equal(ownerFranchise.response.status, 200);
  assert.equal(ownerFranchise.payload.registry.outlets.some((outlet) => outlet.id === proposed.payload.outlet.id), true);

  const approved = await jsonRequest(
    `${baseUrl}/api/owner/outlets/${proposed.payload.outlet.id}/approve`,
    'POST',
    {},
    ownerCookie,
  );
  assert.equal(approved.response.status, 200);
  assert.equal(approved.payload.outlet.status, 'active');
  assert.match(await (await fetch(`${baseUrl}/outlet/${proposed.payload.outlet.id}/admin`)).text(), /Admin/);

  const dashboard = await jsonRequest(`${baseUrl}/api/partner/dashboard`, 'GET', undefined, partnerCookie);
  assert.equal(dashboard.response.status, 200);
  assert.equal(dashboard.payload.partner.id, partner.id);
  assert.equal(dashboard.payload.outlets.length, 2);
  assert.equal(dashboard.payload.outlets.every((outlet) => outlet.partnerId === partner.id), true);

  const deactivated = await jsonRequest(
    `${baseUrl}/api/partner/employees/${employee.payload.user.id}`,
    'PATCH',
    { active: false },
    partnerCookie,
  );
  assert.equal(deactivated.response.status, 200);
  assert.equal(deactivated.payload.user.active, false);

  const exportResponse = await fetch(
    `${baseUrl}/api/partner/outlets/${partnerOutletId}/export-sales?date=${dashboard.payload.outlets[0].businessDate}`,
    { headers: { cookie: partnerCookie } },
  );
  assert.equal(exportResponse.status, 200);
  const exportText = await exportResponse.text();
  assert.match(exportText, /Profit Bersih/);
  assert.doesNotMatch(exportText, /Total Profit/);
});

test('migrates legacy data into SQLite and hashes plaintext Admin PINs on startup', async (t) => {
  const { app, dataDir } = await fixture(t);
  const outlets = JSON.parse(await readFile(join(dataDir, 'outlets.json'), 'utf8'));
  assert.equal('adminPin' in outlets[0], false);
  assert.equal(outlets[0].adminPinHash.algorithm, 'scrypt');
  assert.equal(typeof outlets[0].adminPinHash.hash, 'string');
  assert.equal(app.database.hasMigration('legacy-json-v1'), true);
  assert.equal(app.database.readState('registry').outlets.length, 2);
  assert.equal(app.database.readState('outlet:maucafe-alunalun').products[0].name, 'Latte');
  assert.equal((await readFile(join(dataDir, 'maucafe.sqlite'))).length > 0, true);
});

test('protects cashier mutations and scopes admin sessions to one outlet', async (t) => {
  const { baseUrl, defaultOutletId } = await fixture(t);

  const blockedCreate = await jsonRequest(`${baseUrl}/api/outlet/${defaultOutletId}/orders`, 'POST', {
    items: [{ productId: 'latte', quantity: 1 }], paymentMethod: 'cash',
  });
  assert.equal(blockedCreate.response.status, 401);

  const adminCookie = await loginAdmin(baseUrl, defaultOutletId, '1111');
  const created = await jsonRequest(`${baseUrl}/api/outlet/${defaultOutletId}/orders`, 'POST', {
    items: [{ productId: 'latte', quantity: 2 }], paymentMethod: 'QRIS',
  }, adminCookie);
  assert.equal(created.response.status, 201);
  assert.equal(created.payload.order.queueNumber, '1');
  assert.equal('unitCost' in created.payload.order.items[0], false);
  const publicPreparing = await jsonRequest(`${baseUrl}/api/outlet/${defaultOutletId}/state`);
  assert.deepEqual(publicPreparing.payload.preparingQueueNumbers, ['1']);
  assert.equal(JSON.stringify(publicPreparing.payload).includes(created.payload.order.id), false);

  const crossOutlet = await jsonRequest(`${baseUrl}/api/outlet/maucafe-pik/orders`, 'POST', {
    items: [{ productId: 'latte', quantity: 1 }], paymentMethod: 'cash',
  }, adminCookie);
  assert.equal(crossOutlet.response.status, 401);

  for (let index = 0; index < 7; index += 1) {
    const additional = await jsonRequest(`${baseUrl}/api/outlet/${defaultOutletId}/orders`, 'POST', {
      items: [{ productId: 'latte', quantity: 1 }],
      paymentMethod: 'cash',
    }, adminCookie);
    assert.equal(additional.response.status, 201);
  }
  const allPreparing = await jsonRequest(`${baseUrl}/api/outlet/${defaultOutletId}/state`);
  assert.deepEqual(allPreparing.payload.preparingQueueNumbers, ['1', '2', '3', '4', '5', '6', '7', '8']);

  const id = created.payload.order.id;
  const called = await jsonRequest(`${baseUrl}/api/outlet/${defaultOutletId}/orders/${id}/call`, 'POST', {}, adminCookie);
  assert.equal(called.response.status, 200);
  assert.equal(called.payload.state.activeCall.queueNumber, '1');

  const completed = await jsonRequest(`${baseUrl}/api/outlet/${defaultOutletId}/orders/${id}/complete`, 'POST', {}, adminCookie);
  assert.equal(completed.response.status, 200);
  assert.equal(completed.payload.order.status, 'completed');
});

test('protects internal admin and owner state while owner retains financial fields', async (t) => {
  const { baseUrl, defaultOutletId } = await fixture(t);

  const blockedAdminState = await jsonRequest(`${baseUrl}/api/outlet/${defaultOutletId}/admin/state`);
  assert.equal(blockedAdminState.response.status, 401);
  const blockedOwnerState = await jsonRequest(`${baseUrl}/api/outlet/${defaultOutletId}/owner/state`);
  assert.equal(blockedOwnerState.response.status, 401);

  const adminCookie = await loginAdmin(baseUrl);
  const adminState = await jsonRequest(`${baseUrl}/api/outlet/${defaultOutletId}/admin/state`, 'GET', undefined, adminCookie);
  assert.equal(adminState.response.status, 200);
  assert.equal('cost' in adminState.payload.products[0], false);

  const ownerCookie = await loginOwner(baseUrl);
  const ownerState = await jsonRequest(`${baseUrl}/api/outlet/${defaultOutletId}/owner/state`, 'GET', undefined, ownerCookie);
  assert.equal(ownerState.response.status, 200);
  assert.equal(ownerState.payload.state.products[0].cost, 8000);
  assert.equal('ownerPinHash' in ownerState.payload.state, false);
});

test('Owner can rotate an outlet Admin PIN without storing plaintext credentials', async (t) => {
  const { app, baseUrl, dataDir, defaultOutletId } = await fixture(t);
  const existingAdminCookie = await loginAdmin(baseUrl);
  const ownerCookie = await loginOwner(baseUrl);

  const changed = await jsonRequest(`${baseUrl}/api/outlet/${defaultOutletId}/admin/pin`, 'POST', { newPin: '6789' }, ownerCookie);
  assert.equal(changed.response.status, 200);

  const revokedSession = await jsonRequest(`${baseUrl}/api/outlet/${defaultOutletId}/admin/state`, 'GET', undefined, existingAdminCookie);
  assert.equal(revokedSession.response.status, 401);
  const oldLogin = await jsonRequest(`${baseUrl}/api/outlet/${defaultOutletId}/admin/login`, 'POST', { pin: '1111' });
  assert.equal(oldLogin.response.status, 401);
  const newLogin = await jsonRequest(`${baseUrl}/api/outlet/${defaultOutletId}/admin/login`, 'POST', { pin: '6789' });
  assert.equal(newLogin.response.status, 200);

  const config = JSON.parse(await readFile(join(dataDir, 'outlets.json'), 'utf8'));
  assert.equal('adminPin' in config[0], false);
  assert.equal(config[0].adminPinHash.algorithm, 'scrypt');
  const sqliteOutlet = app.registryStore.get().outlets.find((outlet) => outlet.id === defaultOutletId);
  assert.equal('adminPin' in sqliteOutlet, false);
  assert.equal(sqliteOutlet.adminPinHash.algorithm, 'scrypt');
});

test('changing the Owner PIN revokes every existing Owner session', async (t) => {
  const { baseUrl, defaultOutletId } = await fixture(t);
  const firstOwnerCookie = await loginOwner(baseUrl);
  const secondOwnerCookie = await loginOwner(baseUrl);

  const changed = await jsonRequest(`${baseUrl}/api/outlet/${defaultOutletId}/owner/pin`, 'POST', {
    currentPin: '1234',
    newPin: '5678',
  }, firstOwnerCookie);
  assert.equal(changed.response.status, 200);

  for (const cookie of [firstOwnerCookie, secondOwnerCookie]) {
    const revoked = await jsonRequest(`${baseUrl}/api/owner/multi-summary`, 'GET', undefined, cookie);
    assert.equal(revoked.response.status, 401);
  }
  const newLogin = await jsonRequest(`${baseUrl}/api/owner/login`, 'POST', { pin: '5678' });
  assert.equal(newLogin.response.status, 200);
});

test('duplicate PIN is rejected when creating or resetting Partner and Employee credentials', async (t) => {
  const { baseUrl } = await fixture(t);
  const ownerCookie = await loginOwner(baseUrl);

  const duplicatePartner = await jsonRequest(`${baseUrl}/api/owner/partners`, 'POST', {
    name: 'Mitra Bentrok',
    username: 'mitra.bentrok',
    pin: '1234',
  }, ownerCookie);
  assert.equal(duplicatePartner.response.status, 409);
  assert.equal(duplicatePartner.payload.error, 'PIN sudah digunakan, pilih PIN lain.');

  const partner = await createPartnerWithApprovedOutlet(baseUrl, ownerCookie);
  const partnerCookie = partner.partnerCookie;
  const partnerOutletId = partner.outletId;

  const duplicateEmployee = await jsonRequest(`${baseUrl}/api/partner/employees`, 'POST', {
    outletId: partnerOutletId,
    name: 'Kasir Bentrok',
    username: 'kasir.bentrok',
    pin: '1111',
  }, partnerCookie);
  assert.equal(duplicateEmployee.response.status, 409);
  assert.equal(duplicateEmployee.payload.error, 'PIN sudah digunakan, pilih PIN lain.');

  const employee = await jsonRequest(`${baseUrl}/api/partner/employees`, 'POST', {
    outletId: partnerOutletId,
    name: 'Kasir Aman',
    username: 'kasir.aman',
    pin: '2468',
  }, partnerCookie);
  assert.equal(employee.response.status, 201);

  const duplicateReset = await jsonRequest(
    `${baseUrl}/api/partner/employees/${employee.payload.user.id}`,
    'PATCH',
    { pin: '1234' },
    partnerCookie,
  );
  assert.equal(duplicateReset.response.status, 409);
  assert.equal(duplicateReset.payload.error, 'PIN sudah digunakan, pilih PIN lain.');

  const oldEmployeeLogin = await jsonRequest(`${baseUrl}/api/outlet/${partnerOutletId}/admin/login`, 'POST', {
    username: 'kasir.aman',
    pin: '2468',
  });
  assert.equal(oldEmployeeLogin.response.status, 200);

  const franchise = await jsonRequest(`${baseUrl}/api/owner/franchise`, 'GET', undefined, ownerCookie);
  assert.equal(franchise.payload.registry.users.some((user) => user.username === 'mitra.bentrok'), false);
  assert.equal(franchise.payload.registry.users.some((user) => user.username === 'kasir.bentrok'), false);
  assert.equal(partner.id, franchise.payload.registry.partners[0].id);
});

test('duplicate PIN is rejected when rotating Admin or Owner credentials', async (t) => {
  const { baseUrl, defaultOutletId } = await fixture(t);
  const ownerCookie = await loginOwner(baseUrl);
  await createPartnerWithApprovedOutlet(baseUrl, ownerCookie);

  const duplicateAdmin = await jsonRequest(
    `${baseUrl}/api/outlet/${defaultOutletId}/admin/pin`,
    'POST',
    { newPin: '5678' },
    ownerCookie,
  );
  assert.equal(duplicateAdmin.response.status, 409);
  assert.equal(duplicateAdmin.payload.error, 'PIN sudah digunakan, pilih PIN lain.');
  assert.equal(
    (await jsonRequest(`${baseUrl}/api/outlet/${defaultOutletId}/admin/login`, 'POST', { pin: '1111' })).response.status,
    200,
  );

  const duplicateOwner = await jsonRequest(
    `${baseUrl}/api/outlet/${defaultOutletId}/owner/pin`,
    'POST',
    { currentPin: '1234', newPin: '1111' },
    ownerCookie,
  );
  assert.equal(duplicateOwner.response.status, 409);
  assert.equal(duplicateOwner.payload.error, 'PIN sudah digunakan, pilih PIN lain.');
  assert.equal((await jsonRequest(`${baseUrl}/api/owner/login`, 'POST', { pin: '1234' })).response.status, 200);
});

test('legacy PIN collision fails closed for Owner and outlet Admin logins', async (t) => {
  const configuredOutlets = [
    { id: 'outlet-a', name: 'Outlet A', address: 'A', adminPin: '1234' },
    { id: 'outlet-b', name: 'Outlet B', address: 'B', adminPin: '1234' },
  ];
  const { baseUrl } = await fixture(t, { configuredOutlets, ownerPin: '1234' });

  const ownerBrowser = await jsonRequest(`${baseUrl}/api/owner/login`, 'POST', { pin: '1234' });
  const ownerNative = await jsonRequest(`${baseUrl}/api/native/owner/login`, 'POST', { pin: '1234' });
  const adminBrowser = await jsonRequest(`${baseUrl}/api/outlet/outlet-a/admin/login`, 'POST', { pin: '1234' });
  const adminNative = await jsonRequest(`${baseUrl}/api/native/admin/login`, 'POST', {
    outletId: 'outlet-a',
    pin: '1234',
  });

  for (const result of [ownerBrowser, ownerNative, adminBrowser, adminNative]) {
    assert.equal(result.response.status, 401);
    assert.doesNotMatch(result.payload.error, /Owner|Admin|Outlet A|Outlet B/i);
  }
});

test('legacy PIN collision fails closed for Partner and Employee logins', async (t) => {
  const configuredOutlets = [
    { id: 'outlet-a', name: 'Outlet A', address: 'A', adminPinHash: createPinHash('1111') },
    { id: 'outlet-b', name: 'Outlet B', address: 'B', adminPinHash: createPinHash('2222') },
  ];
  const duplicatePin = '5678';
  const { baseUrl } = await fixture(t, {
    configuredOutlets,
    registryPatch: {
      partners: [{
        id: 'partner-a',
        name: 'Mitra Lama',
        outletIds: ['outlet-a'],
        active: true,
      }],
      users: [
        {
          id: 'user-partner-a',
          username: 'mitra.lama',
          name: 'Mitra Lama',
          role: 'partner',
          partnerId: 'partner-a',
          outletIds: ['outlet-a'],
          pinHash: createPinHash(duplicatePin),
          active: true,
        },
        {
          id: 'user-employee-a',
          username: 'kasir.lama',
          name: 'Kasir Lama',
          role: 'employee',
          partnerId: 'partner-a',
          outletIds: ['outlet-a'],
          pinHash: createPinHash(duplicatePin),
          active: true,
        },
      ],
    },
  });

  const partnerBrowser = await jsonRequest(`${baseUrl}/api/partner/login`, 'POST', {
    username: 'mitra.lama',
    pin: duplicatePin,
  });
  const partnerNative = await jsonRequest(`${baseUrl}/api/native/partner/login`, 'POST', {
    username: 'mitra.lama',
    pin: duplicatePin,
  });
  const employeeBrowser = await jsonRequest(`${baseUrl}/api/outlet/outlet-a/admin/login`, 'POST', {
    username: 'kasir.lama',
    pin: duplicatePin,
  });
  const employeeNative = await jsonRequest(`${baseUrl}/api/native/admin/login`, 'POST', {
    outletId: 'outlet-a',
    username: 'kasir.lama',
    pin: duplicatePin,
  });

  for (const result of [partnerBrowser, partnerNative, employeeBrowser, employeeNative]) {
    assert.equal(result.response.status, 401);
    assert.doesNotMatch(result.payload.error, /Mitra Lama|Kasir Lama|mitra\.lama|kasir\.lama/i);
  }
});

test('Owner manages one master menu for every current and future outlet', async (t) => {
  const { app, baseUrl, defaultOutletId } = await fixture(t);
  const adminCookie = await loginAdmin(baseUrl);

  const blocked = await jsonRequest(`${baseUrl}/api/outlet/${defaultOutletId}/products`, 'POST', {
    name: 'Tea', category: 'Non-Kopi', price: 12000, cost: 4000,
  }, adminCookie);
  assert.equal(blocked.response.status, 401);

  const ownerCookie = await loginOwner(baseUrl);
  const added = await jsonRequest(`${baseUrl}/api/outlet/${defaultOutletId}/products`, 'POST', {
    name: 'Tea', category: 'Non-Kopi', price: 12000, cost: 4000, cupUsage: 1,
  }, ownerCookie);
  assert.equal(added.response.status, 201);
  assert.equal(added.payload.product.cost, 4000);
  assert.equal(
    app.stores.get('maucafe-pik').store.get().products.some((product) => product.id === added.payload.product.id),
    true,
  );
  assert.equal(
    app.registryStore.get().masterProducts.some((product) => product.id === added.payload.product.id),
    true,
  );

  const updated = await jsonRequest(`${baseUrl}/api/outlet/${defaultOutletId}/products/${added.payload.product.id}`, 'PATCH', { active: false }, ownerCookie);
  assert.equal(updated.response.status, 200);
  assert.equal(updated.payload.product.active, false);
  assert.equal(
    app.stores.get('maucafe-pik').store.get().products.find((product) => product.id === added.payload.product.id).active,
    false,
  );

  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    Buffer.alloc(20),
  ]).toString('base64');
  const blockedImage = await jsonRequest(
    `${baseUrl}/api/outlet/${defaultOutletId}/products/${added.payload.product.id}/image`,
    'POST',
    { filename: 'tea.png', dataUrl: `data:image/png;base64,${png}` },
    adminCookie,
  );
  assert.equal(blockedImage.response.status, 401);

  const uploadedImage = await jsonRequest(
    `${baseUrl}/api/outlet/${defaultOutletId}/products/${added.payload.product.id}/image`,
    'POST',
    { filename: 'tea.png', dataUrl: `data:image/png;base64,${png}` },
    ownerCookie,
  );
  assert.equal(uploadedImage.response.status, 200);
  assert.match(uploadedImage.payload.product.imageUrl, /^\/media\/uploaded-product-/);
  assert.equal(
    app.stores.get('maucafe-pik').store.get().products.find((product) => product.id === added.payload.product.id).imageUrl,
    uploadedImage.payload.product.imageUrl,
  );

  await jsonRequest(
    `${baseUrl}/api/outlet/${defaultOutletId}/products/${added.payload.product.id}`,
    'PATCH',
    { active: true },
    ownerCookie,
  );
  const publicState = await jsonRequest(`${baseUrl}/api/outlet/maucafe-pik/state`);
  assert.equal(
    publicState.payload.products.find((product) => product.id === added.payload.product.id).imageUrl,
    uploadedImage.payload.product.imageUrl,
  );
  assert.equal('cost' in publicState.payload.products[0], false);

  const replacementImage = await jsonRequest(
    `${baseUrl}/api/outlet/${defaultOutletId}/products/${added.payload.product.id}/image`,
    'POST',
    { filename: 'tea-new.png', dataUrl: `data:image/png;base64,${png}` },
    ownerCookie,
  );
  assert.equal(replacementImage.response.status, 200);
  assert.notEqual(replacementImage.payload.product.imageUrl, uploadedImage.payload.product.imageUrl);
  assert.equal((await fetch(`${baseUrl}${uploadedImage.payload.product.imageUrl}`)).status, 404);

  const partner = await createPartnerWithApprovedOutlet(baseUrl, ownerCookie);
  assert.equal(partner.id.length > 0, true);
  assert.equal(
    app.stores.get(partner.outletId).store.get().products.some(
      (product) => product.id === added.payload.product.id && product.imageUrl === replacementImage.payload.product.imageUrl,
    ),
    true,
  );
});

test('cancellation requires an authenticated cashier plus Owner approval and preserves audit metadata', async (t) => {
  const { baseUrl, defaultOutletId } = await fixture(t);
  const adminCookie = await loginAdmin(baseUrl);
  const order = await jsonRequest(`${baseUrl}/api/outlet/${defaultOutletId}/orders`, 'POST', {
    items: [{ productId: 'latte', quantity: 1 }], paymentMethod: 'cash',
  }, adminCookie);
  const cancelUrl = `${baseUrl}/api/outlet/${defaultOutletId}/orders/${order.payload.order.id}/cancel`;

  const noApproval = await jsonRequest(cancelUrl, 'POST', { reason: 'Salah input' }, adminCookie);
  assert.equal(noApproval.response.status, 403);

  const wrongPin = await jsonRequest(cancelUrl, 'POST', { reason: 'Salah input', ownerPin: '9999' }, adminCookie);
  assert.equal(wrongPin.response.status, 403);

  const cancelled = await jsonRequest(cancelUrl, 'POST', { reason: 'Salah input', ownerPin: '1234' }, adminCookie);
  assert.equal(cancelled.response.status, 200);
  assert.equal(cancelled.payload.order.status, 'cancelled');
  assert.equal(cancelled.payload.order.cancelReason, 'Salah input');
  assert.equal(cancelled.payload.order.cancelledBy, 'admin');
  assert.equal(cancelled.payload.order.approvedBy, 'owner');
});

test('owner reports and API expose no tax configuration or totals', async (t) => {
  const { baseUrl, defaultOutletId } = await fixture(t);
  assert.equal((await jsonRequest(`${baseUrl}/api/owner/session`)).payload.authenticated, false);
  const blocked = await jsonRequest(`${baseUrl}/api/owner/multi-summary`);
  assert.equal(blocked.response.status, 401);

  const rejected = await jsonRequest(`${baseUrl}/api/owner/login`, 'POST', { pin: '9999' });
  assert.equal(rejected.response.status, 401);

  const rawOwnerLogin = await jsonRequest(`${baseUrl}/api/owner/login`, 'POST', { pin: '1234' });
  assert.equal(rawOwnerLogin.response.status, 200);
  assert.equal('adminPinHash' in rawOwnerLogin.payload.outlets[0], false);
  const ownerCookie = cookiePair(rawOwnerLogin.response);
  assert.equal(
    (await jsonRequest(`${baseUrl}/api/owner/session`, 'GET', undefined, ownerCookie)).payload.authenticated,
    true,
  );
  const multiSummary = await jsonRequest(`${baseUrl}/api/owner/multi-summary`, 'GET', undefined, ownerCookie);
  assert.equal(multiSummary.response.status, 200);
  assert.equal(multiSummary.payload.summaries.length, 2);
  assert.equal(typeof multiSummary.payload.grandTotals.revenue, 'number');
  assert.equal('tax' in multiSummary.payload.grandTotals, false);
  assert.equal(multiSummary.payload.summaries.some((summary) => 'tax' in summary), false);
  assert.equal(typeof multiSummary.payload.grandTotals.received, 'number');
  const removedTaxRoute = await jsonRequest(
    `${baseUrl}/api/outlet/${defaultOutletId}/tax-config`,
    'POST',
    { enabled: true, label: 'PBJT', rate: 10 },
    ownerCookie,
  );
  assert.equal(removedTaxRoute.response.status, 404);

  const logout = await jsonRequest(`${baseUrl}/api/owner/logout`, 'POST', {}, ownerCookie);
  assert.equal(logout.response.status, 200);
});

test('all-outlet summary always reports the current Jakarta business date', async (t) => {
  const { app, baseUrl, defaultOutletId } = await fixture(t);
  await app.stores.get(defaultOutletId).store.update((current) => {
    const oldOrder = createOrder(current, {
      items: [{ productId: 'latte', quantity: 1 }],
      paymentMethod: 'cash',
    }, '2020-01-01T03:00:00.000Z');
    const completed = completeOrder(oldOrder.state, oldOrder.order.id, '2020-01-01T03:01:00.000Z');
    const staleWaiting = createOrder(completed.state, {
      items: [{ productId: 'latte', quantity: 1 }],
      paymentMethod: 'cash',
    }, '2020-01-01T03:02:00.000Z');
    return staleWaiting.state;
  });

  const ownerCookie = await loginOwner(baseUrl);
  const summary = await jsonRequest(`${baseUrl}/api/owner/multi-summary`, 'GET', undefined, ownerCookie);
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  assert.equal(summary.payload.summaries[0].businessDate, today);
  assert.equal(summary.payload.summaries[0].salesCount, 0);
  assert.equal(summary.payload.summaries[0].activeCount, 0);
  assert.equal(
    app.stores.get(defaultOutletId).store.get().orders.find((order) => order.status === 'expired').paymentStatus,
    'paid',
  );
});

test('native Admin and Owner sessions use scoped bearer tokens and logout revokes them', async (t) => {
  const { baseUrl, defaultOutletId } = await fixture(t);
  const origin = { origin: 'http://localhost' };

  const adminLogin = await jsonRequest(`${baseUrl}/api/native/admin/login`, 'POST', {
    outletId: defaultOutletId,
    pin: '1111',
  }, '', origin);
  assert.equal(adminLogin.response.status, 200);
  assert.equal(adminLogin.payload.role, 'admin');
  assert.equal(typeof adminLogin.payload.token, 'string');
  assert.equal(adminLogin.response.headers.get('access-control-allow-origin'), 'http://localhost');
  assert.equal(adminLogin.response.headers.get('set-cookie'), null);

  const adminAuth = { ...origin, authorization: `Bearer ${adminLogin.payload.token}` };
  const adminState = await jsonRequest(`${baseUrl}/api/outlet/${defaultOutletId}/admin/state`, 'GET', undefined, '', adminAuth);
  assert.equal(adminState.response.status, 200);
  const crossOutlet = await jsonRequest(`${baseUrl}/api/outlet/maucafe-pik/admin/state`, 'GET', undefined, '', adminAuth);
  assert.equal(crossOutlet.response.status, 401);

  const adminLogout = await jsonRequest(`${baseUrl}/api/native/logout`, 'POST', {}, '', adminAuth);
  assert.equal(adminLogout.response.status, 200);
  const revokedAdmin = await jsonRequest(`${baseUrl}/api/outlet/${defaultOutletId}/admin/state`, 'GET', undefined, '', adminAuth);
  assert.equal(revokedAdmin.response.status, 401);

  const ownerLogin = await jsonRequest(`${baseUrl}/api/native/owner/login`, 'POST', { pin: '1234' }, '', origin);
  assert.equal(ownerLogin.response.status, 200);
  assert.equal(ownerLogin.payload.role, 'owner');
  assert.equal(ownerLogin.payload.outlets.length, 2);
  const ownerAuth = { ...origin, authorization: `Bearer ${ownerLogin.payload.token}` };
  const summary = await jsonRequest(`${baseUrl}/api/owner/multi-summary`, 'GET', undefined, '', ownerAuth);
  assert.equal(summary.response.status, 200);
  const partner = await jsonRequest(`${baseUrl}/api/owner/partners`, 'POST', {
    name: 'Mitra Native',
    username: 'mitra.native',
    pin: '5678',
  }, '', ownerAuth);
  assert.equal(partner.response.status, 201);
  const partnerLogin = await jsonRequest(`${baseUrl}/api/native/partner/login`, 'POST', {
    username: 'mitra.native',
    pin: '5678',
  }, '', origin);
  assert.equal(partnerLogin.response.status, 200);
  assert.equal(partnerLogin.payload.role, 'partner');
  assert.equal(typeof partnerLogin.payload.token, 'string');
  assert.equal(partnerLogin.response.headers.get('set-cookie'), null);
  const partnerAuth = { ...origin, authorization: `Bearer ${partnerLogin.payload.token}` };
  assert.equal(
    (await jsonRequest(`${baseUrl}/api/partner/dashboard`, 'GET', undefined, '', partnerAuth)).response.status,
    200,
  );
  await jsonRequest(`${baseUrl}/api/native/logout`, 'POST', {}, '', partnerAuth);
  assert.equal(
    (await jsonRequest(`${baseUrl}/api/partner/dashboard`, 'GET', undefined, '', partnerAuth)).response.status,
    401,
  );

  const ownerLogout = await jsonRequest(`${baseUrl}/api/native/logout`, 'POST', {}, '', ownerAuth);
  assert.equal(ownerLogout.response.status, 200);
  const revokedOwner = await jsonRequest(`${baseUrl}/api/owner/multi-summary`, 'GET', undefined, '', ownerAuth);
  assert.equal(revokedOwner.response.status, 401);
});

test('native API allows Capacitor preflight and rejects untrusted cross-origin requests', async (t) => {
  const { baseUrl } = await fixture(t);
  const preflight = await fetch(`${baseUrl}/api/native/owner/login`, {
    method: 'OPTIONS',
    headers: {
      origin: 'http://localhost',
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'content-type, authorization',
    },
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), 'http://localhost');
  assert.match(preflight.headers.get('access-control-allow-headers'), /authorization/i);

  const foreign = await jsonRequest(
    `${baseUrl}/api/native/owner/login`,
    'POST',
    { pin: '1234' },
    '',
    { origin: 'https://evil.example' },
  );
  assert.equal(foreign.response.status, 403);
  assert.equal(foreign.payload.error, 'Origin tidak diizinkan');
});

test('destructive reset requires an Owner session rather than an unbounded PIN-only endpoint', async (t) => {
  const { baseUrl, defaultOutletId } = await fixture(t);
  const directPin = await jsonRequest(`${baseUrl}/api/outlet/${defaultOutletId}/reset`, 'POST', { pin: '1234' });
  assert.equal(directPin.response.status, 401);

  const ownerCookie = await loginOwner(baseUrl);
  const reset = await jsonRequest(`${baseUrl}/api/outlet/${defaultOutletId}/reset`, 'POST', {}, ownerCookie);
  assert.equal(reset.response.status, 200);
  assert.equal(reset.payload.state.nextQueueNumber, 1);
});

test('Owner can purge retained sales with a bounded retention period', async (t) => {
  const { baseUrl, defaultOutletId } = await fixture(t);
  const ownerCookie = await loginOwner(baseUrl);
  const purgeUrl = `${baseUrl}/api/outlet/${defaultOutletId}/sales/purge`;

  const purged = await jsonRequest(purgeUrl, 'POST', { daysToKeep: 30 }, ownerCookie);
  assert.equal(purged.response.status, 200);

  const tooShort = await jsonRequest(purgeUrl, 'POST', { daysToKeep: 0 }, ownerCookie);
  assert.equal(tooShort.response.status, 400);

  const tooLong = await jsonRequest(purgeUrl, 'POST', { daysToKeep: 3651 }, ownerCookie);
  assert.equal(tooLong.response.status, 400);
});

test('rate limits repeated invalid admin PIN attempts', async (t) => {
  const { baseUrl, defaultOutletId } = await fixture(t);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const failed = await jsonRequest(`${baseUrl}/api/outlet/${defaultOutletId}/admin/login`, 'POST', { pin: '9999' });
    assert.equal(failed.response.status, 401);
  }
  const blocked = await jsonRequest(`${baseUrl}/api/outlet/${defaultOutletId}/admin/login`, 'POST', { pin: '1111' });
  assert.equal(blocked.response.status, 429);
  assert.ok(Number(blocked.response.headers.get('retry-after')) >= 1);
});

test('media upload requires auth, validates actual file signature, and supports fit mode', async (t) => {
  const { baseUrl, defaultOutletId } = await fixture(t);
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), Buffer.alloc(20)]).toString('base64');
  const body = { filename: '<img onerror=alert(1)>.png', dataUrl: `data:image/png;base64,${png}`, fit: 'contain' };

  const blocked = await jsonRequest(`${baseUrl}/api/outlet/${defaultOutletId}/media/upload`, 'POST', body);
  assert.equal(blocked.response.status, 401);

  const adminCookie = await loginAdmin(baseUrl);
  const uploaded = await jsonRequest(`${baseUrl}/api/outlet/${defaultOutletId}/media/upload`, 'POST', body, adminCookie);
  assert.equal(uploaded.response.status, 200);
  assert.equal(uploaded.payload.promoMedia.fit, 'contain');
  assert.match(uploaded.payload.promoMedia.url, /^\/media\/uploaded-promo-/);
  assert.equal(uploaded.payload.item.type, 'image');
  assert.equal(uploaded.payload.state.mediaPlaylist.length, 1);

  const ranged = await fetch(`${baseUrl}${uploaded.payload.promoMedia.url}`, {
    headers: { range: 'bytes=0-7' },
  });
  assert.equal(ranged.status, 206);
  assert.equal(ranged.headers.get('accept-ranges'), 'bytes');
  assert.equal(ranged.headers.get('content-range'), 'bytes 0-7/28');
  assert.equal((await ranged.arrayBuffer()).byteLength, 8);
  const invalidRange = await fetch(`${baseUrl}${uploaded.payload.promoMedia.url}`, {
    headers: { range: 'bytes=999-1000' },
  });
  assert.equal(invalidRange.status, 416);

  const spoofed = await jsonRequest(`${baseUrl}/api/outlet/${defaultOutletId}/media/upload`, 'POST', {
    filename: 'fake.jpg', dataUrl: `data:image/jpeg;base64,${png}`, fit: 'cover',
  }, adminCookie);
  assert.equal(spoofed.response.status, 400);

  const removed = await jsonRequest(
    `${baseUrl}/api/outlet/${defaultOutletId}/media/playlist/${uploaded.payload.item.id}`,
    'DELETE',
    undefined,
    adminCookie,
  );
  assert.equal(removed.response.status, 200);
  assert.equal(removed.payload.mediaPlaylist.length, 0);
  assert.equal((await fetch(`${baseUrl}${uploaded.payload.promoMedia.url}`)).status, 404);
});

test('server fails closed when the Owner credential file is missing', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'queue-no-security-'));
  try {
    const publicDir = join(directory, 'public');
    const dataDir = join(directory, 'data');
    await mkdir(publicDir);
    await mkdir(dataDir);
    await writeFile(join(dataDir, 'outlets.json'), JSON.stringify([{
      id: 'demo', name: 'Demo', address: 'Demo', adminPinHash: createPinHash('1111'),
    }]));
    await assert.rejects(
      () => createQueueServer({ dataDir, publicDir, initialState: createInitialState() }),
      /security\.json tidak ditemukan/i,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('production startup rejects the documented demo PINs', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'queue-demo-credentials-'));
  try {
    const publicDir = join(directory, 'public');
    const dataDir = join(directory, 'data');
    await mkdir(publicDir);
    await mkdir(dataDir);
    await writeFile(join(dataDir, 'outlets.json'), JSON.stringify([{
      id: 'demo', name: 'Demo', address: 'Demo', adminPinHash: createPinHash('1111'),
    }]));
    await writeFile(join(dataDir, 'security.json'), JSON.stringify({ ownerPinHash: createPinHash('1234') }));
    await assert.rejects(
      () => createQueueServer({ dataDir, publicDir, initialState: createInitialState(), production: true }),
      /credential demo/i,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('public event stream contains display data only', async (t) => {
  const { baseUrl, defaultOutletId } = await fixture(t);
  const controller = new AbortController();
  const response = await fetch(`${baseUrl}/api/outlet/${defaultOutletId}/events`, { signal: controller.signal });
  assert.match(response.headers.get('content-type'), /text\/event-stream/);
  const reader = response.body.getReader();
  const first = await reader.read();
  controller.abort();
  const text = new TextDecoder().decode(first.value);
  assert.match(text, /"revision":\d+/);
  assert.doesNotMatch(text, /unitCost|ownerPinHash|paymentMethod|"orders"/);
});

test('Partner can view sanitized products and toggle menu active status per outlet', async (t) => {
  const { baseUrl, defaultOutletId } = await fixture(t, {
    registryPatch: {
      outlets: [
        { id: 'maucafe-alunalun', name: 'Maucafe Alun-Alun', address: 'Jepara', partnerId: 'partner-1', status: 'active', adminPinHash: createPinHash('1111') },
        { id: 'maucafe-pik', name: 'Maucafe PIK', address: 'PIK', partnerId: 'partner-2', status: 'active', adminPinHash: createPinHash('2222') },
      ],
      partners: [{ id: 'partner-1', name: 'Mitra 1', outletIds: ['maucafe-alunalun'], active: true }],
      users: [{ id: 'u-partner-1', username: 'mitra1', name: 'Mitra 1', role: 'partner', partnerId: 'partner-1', outletIds: ['maucafe-alunalun'], pinHash: createPinHash('9999'), active: true }],
      masterProducts: [{ id: 'latte', name: 'Latte', category: 'Kopi', price: 20000, cost: 8000, active: true }],
    },
  });

  const loginRes = await jsonRequest(`${baseUrl}/api/partner/login`, 'POST', { username: 'mitra1', pin: '9999' });
  assert.equal(loginRes.response.status, 200);
  const partnerCookie = loginRes.response.headers.get('set-cookie');

  // Fetch partner products
  const productsRes = await jsonRequest(`${baseUrl}/api/partner/outlets/maucafe-alunalun/products`, 'GET', undefined, partnerCookie);
  assert.equal(productsRes.response.status, 200);
  assert.equal(productsRes.payload.products.length, 1);
  assert.equal(productsRes.payload.products[0].id, 'latte');
  assert.equal(productsRes.payload.products[0].active, true);
  // Ensure HPP/cost is NOT exposed
  assert.equal(productsRes.payload.products[0].cost, undefined);
  assert.equal(productsRes.payload.products[0].unitCost, undefined);

  // Toggle product to inactive
  const toggleRes = await jsonRequest(`${baseUrl}/api/partner/outlets/maucafe-alunalun/products/latte`, 'PATCH', { active: false }, partnerCookie);
  assert.equal(toggleRes.response.status, 200);
  assert.equal(toggleRes.payload.product.active, false);

  // Verify product is inactive in maucafe-alunalun
  const checkRes = await jsonRequest(`${baseUrl}/api/partner/outlets/maucafe-alunalun/products`, 'GET', undefined, partnerCookie);
  assert.equal(checkRes.payload.products[0].active, false);

  // Unauthorized partner attempting to toggle outlet 2
  const unauthRes = await jsonRequest(`${baseUrl}/api/partner/outlets/maucafe-pik/products/latte`, 'PATCH', { active: false }, partnerCookie);
  assert.equal(unauthRes.response.status, 403);
});

test('Owner can delete a master product via DELETE API', async (t) => {
  const { baseUrl, defaultOutletId } = await fixture(t, {
    registryPatch: {
      masterProducts: [{ id: 'latte', name: 'Latte', category: 'Kopi', price: 20000, cost: 8000, active: true }],
    },
  });
  const ownerCookie = await loginOwner(baseUrl);

  // Non-owner gets 401
  const unauthRes = await jsonRequest(`${baseUrl}/api/outlet/${defaultOutletId}/products/latte`, 'DELETE');
  assert.equal(unauthRes.response.status, 401);

  // Owner deletes master product
  const deleteRes = await jsonRequest(`${baseUrl}/api/outlet/${defaultOutletId}/products/latte`, 'DELETE', undefined, ownerCookie);
  assert.equal(deleteRes.response.status, 200);
  assert.equal(deleteRes.payload.ok, true);
  assert.equal(deleteRes.payload.product.id, 'latte');

  // Verify product is gone from master product list
  const listRes = await jsonRequest(`${baseUrl}/api/outlet/${defaultOutletId}/owner/state`, 'GET', undefined, ownerCookie);
  assert.equal(listRes.response.status, 200);
  assert.equal(listRes.payload.state.products.some((p) => p.id === 'latte'), false);
});

