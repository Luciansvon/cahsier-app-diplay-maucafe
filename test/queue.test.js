import test from 'node:test';
import assert from 'node:assert/strict';

import { createPinHash } from '../src/security.js';

import {
  addProduct,
  callOrder,
  cancelOrder,
  clearAllOrders,
  completeOrder,
  createInitialState,
  createOrder,
  purgeOldOrders,
  resetQueue,
  rolloverBusinessDay,
  updateOwnerPin,
  updateProduct,
  updateTaxConfig,
  verifyOwnerPin,
} from '../src/queue.js';

const NOW = '2026-07-23T02:00:00.000Z';

function stateWithMenu() {
  return createInitialState({
    products: [
      { id: 'kopi-susu', name: 'Kopi Susu', category: 'Kopi', price: 18000, cost: 8000, cupUsage: 1, active: true },
    ],
  });
}

test('creates a paid order without a leading zero and keeps the price snapshot', () => {
  const state = stateWithMenu();
  const result = createOrder(state, {
    items: [{ productId: 'kopi-susu', quantity: 2 }],
    paymentMethod: 'QRIS',
  }, NOW);

  assert.equal(result.order.queueNumber, '1');
  assert.equal(result.order.status, 'waiting');
  assert.equal(result.order.total, 36000);
  assert.equal(result.order.grandTotal, 36000);
  assert.equal(result.order.taxAmount, 0);
  assert.deepEqual(result.order.items[0], {
    productId: 'kopi-susu',
    productName: 'Kopi Susu',
    category: 'Kopi',
    unitPrice: 18000,
    unitCost: 8000,
    cupUsage: 1,
    quantity: 2,
    subtotal: 36000,
  });
});

test('resets numbering automatically when Jakarta business date changes', () => {
  let state = stateWithMenu();
  ({ state } = createOrder(state, { items: [{ productId: 'kopi-susu', quantity: 1 }], paymentMethod: 'cash' }, NOW));
  const result = createOrder(state, { items: [{ productId: 'kopi-susu', quantity: 1 }], paymentMethod: 'cash' }, '2026-07-24T02:00:00.000Z');

  assert.equal(result.order.queueNumber, '1');
  assert.equal(result.state.orders[0].status, 'expired');
  assert.equal(result.state.orders[0].paymentStatus, 'void');
  assert.equal(result.state.orders[0].expiredReason, 'Pergantian hari operasional');
});

test('initial state includes franchise ledgers and a compatible media playlist', () => {
  const state = stateWithMenu();

  assert.deepEqual(state.shifts, []);
  assert.deepEqual(state.operationalEntries, []);
  assert.deepEqual(state.inventoryMovements, []);
  assert.equal(state.mediaPlaylist.length, 1);
  assert.equal(state.mediaPlaylist[0].url, '/media/promo.mp4');
  assert.equal(state.mediaPlaylist[0].durationSeconds, null);
  assert.equal(state.schemaVersion, 3);
});

test('rollover expires stale active orders without resetting speech event IDs', () => {
  let state = stateWithMenu();
  const created = createOrder(state, {
    items: [{ productId: 'kopi-susu', quantity: 1 }],
    paymentMethod: 'cash',
  }, NOW);
  state = callOrder(created.state, created.order.id, NOW).state;
  const nextEventId = state.nextCallEventId;

  state = rolloverBusinessDay(state, '2026-07-24T02:00:00.000Z');

  assert.equal(state.businessDate, '2026-07-24');
  assert.equal(state.nextQueueNumber, 1);
  assert.equal(state.orders[0].status, 'expired');
  assert.equal(state.orders[0].paymentStatus, 'void');
  assert.equal(state.orders[0].expiredAt, '2026-07-24T02:00:00.000Z');
  assert.equal(state.orders[0].expiredReason, 'Pergantian hari operasional');
  assert.equal(state.activeCall, null);
  assert.equal(state.nextCallEventId, nextEventId);
});

test('calling and recalling changes the event without duplicating the order', () => {
  let state = stateWithMenu();
  const created = createOrder(state, { items: [{ productId: 'kopi-susu', quantity: 1 }], paymentMethod: 'cash' }, NOW);
  state = callOrder(created.state, created.order.id, NOW).state;
  const recalled = callOrder(state, created.order.id, '2026-07-23T02:01:00.000Z');

  assert.equal(recalled.state.orders.length, 1);
  assert.equal(recalled.state.activeCall.queueNumber, '1');
  assert.equal(recalled.state.activeCall.eventId, 2);
  assert.equal(recalled.order.status, 'ready');
});

test('call event IDs keep increasing after queue reset so TV speech is not suppressed', () => {
  let state = stateWithMenu();
  const first = createOrder(state, { items: [{ productId: 'kopi-susu', quantity: 1 }], paymentMethod: 'cash' }, NOW);
  state = callOrder(first.state, first.order.id, NOW).state;
  state = callOrder(state, first.order.id, '2026-07-23T02:01:00.000Z').state;
  assert.equal(state.activeCall.eventId, 2);

  state = resetQueue(state, '2026-07-23T02:02:00.000Z');
  const second = createOrder(state, { items: [{ productId: 'kopi-susu', quantity: 1 }], paymentMethod: 'cash' }, '2026-07-23T02:03:00.000Z');
  state = callOrder(second.state, second.order.id, '2026-07-23T02:04:00.000Z').state;

  assert.equal(state.activeCall.eventId, 3);
  assert.equal(state.nextCallEventId, 4);
});

test('orders can be completed or cancelled', () => {
  let state = stateWithMenu();
  const first = createOrder(state, { items: [{ productId: 'kopi-susu', quantity: 1 }], paymentMethod: 'cash' }, NOW);
  const second = createOrder(first.state, { items: [{ productId: 'kopi-susu', quantity: 1 }], paymentMethod: 'QRIS' }, NOW);

  state = completeOrder(second.state, first.order.id, NOW).state;
  state = cancelOrder(state, second.order.id, { reason: 'Salah input', cancelledBy: 'admin', approvedBy: 'owner' }, NOW).state;

  assert.equal(state.orders[0].status, 'completed');
  assert.equal(state.orders[1].status, 'cancelled');
  assert.equal(state.orders[1].paymentStatus, 'void');
  assert.equal(state.orders[1].cancelReason, 'Salah input');
  assert.equal(state.orders[1].cancelledBy, 'admin');
  assert.equal(state.orders[1].approvedBy, 'owner');
});

test('completing the called order clears the active display call', () => {
  const state = stateWithMenu();
  const created = createOrder(state, {
    items: [{ productId: 'kopi-susu', quantity: 1 }],
    paymentMethod: 'cash',
  }, NOW);
  const called = callOrder(created.state, created.order.id, NOW);
  const completed = completeOrder(called.state, created.order.id, NOW);

  assert.equal(completed.order.status, 'completed');
  assert.equal(completed.state.activeCall, null);
});

test('cancellation requires a reason and cannot cancel a completed order', () => {
  let state = stateWithMenu();
  const created = createOrder(state, { items: [{ productId: 'kopi-susu', quantity: 1 }], paymentMethod: 'cash' }, NOW);
  assert.throws(() => cancelOrder(created.state, created.order.id, {}, NOW), /alasan/i);

  state = completeOrder(created.state, created.order.id, NOW).state;
  assert.throws(() => cancelOrder(state, created.order.id, { reason: 'Tes' }, NOW), /tidak dapat dibatalkan/i);
});

test('reset cancels active orders and preserves closed sales history', () => {
  let state = stateWithMenu();
  const first = createOrder(state, { items: [{ productId: 'kopi-susu', quantity: 1 }], paymentMethod: 'cash' }, NOW);
  const second = createOrder(first.state, { items: [{ productId: 'kopi-susu', quantity: 1 }], paymentMethod: 'QRIS' }, NOW);
  state = completeOrder(second.state, first.order.id, NOW).state;
  state = callOrder(state, second.order.id, NOW).state;

  state = resetQueue(state, '2026-07-23T02:05:00.000Z');

  assert.equal(state.orders.length, 2);
  assert.equal(state.orders[0].status, 'completed');
  assert.equal(state.orders[1].status, 'cancelled');
  assert.equal(state.orders[1].paymentStatus, 'void');
  assert.equal(state.orders[1].updatedAt, '2026-07-23T02:05:00.000Z');
  assert.equal(state.orders[1].cancelReason, 'Reset antrean oleh Owner');
  assert.equal(state.orders[1].approvedBy, 'owner');
  assert.equal(state.activeCall, null);
  assert.equal(state.nextQueueNumber, 1);
});

test('products can be added and updated with cost without mutating previous state', () => {
  const before = createInitialState();
  const added = addProduct(before, { name: 'Americano', category: 'Kopi', price: 15000, cost: 7000, cupUsage: 1 });
  const updated = updateProduct(added.state, added.product.id, { price: 17000, cost: 8000, cupUsage: 2, active: false });

  assert.equal(before.products.length, 0);
  assert.equal(added.product.cost, 7000);
  assert.equal(updated.product.price, 17000);
  assert.equal(updated.product.cost, 8000);
  assert.equal(updated.product.cupUsage, 2);
  assert.equal(updated.product.active, false);
  assert.throws(() => updateProduct(updated.state, added.product.id, { cupUsage: -1 }), /cup/i);
});

test('stores server supplied shift and employee attribution on an order', () => {
  const result = createOrder(stateWithMenu(), {
    items: [{ productId: 'kopi-susu', quantity: 1 }],
    paymentMethod: 'cash',
    shiftId: 'shift-1',
    employeeId: 'employee-1',
    employeeName: 'Anisa',
  }, NOW);

  assert.equal(result.order.shiftId, 'shift-1');
  assert.equal(result.order.employeeId, 'employee-1');
  assert.equal(result.order.employeeName, 'Anisa');
});

test('rejects invalid order input', () => {
  const state = stateWithMenu();
  assert.throws(() => createOrder(state, { items: [], paymentMethod: 'cash' }, NOW), /item/i);
  assert.throws(() => createOrder(state, { items: [{ productId: 'missing', quantity: 1 }], paymentMethod: 'cash' }, NOW), /produk/i);
  assert.throws(() => createOrder(state, { items: [{ productId: 'kopi-susu', quantity: 0 }], paymentMethod: 'cash' }, NOW), /jumlah/i);
});

test('reuses an order request ID and rejects unsafe order totals', () => {
  const state = stateWithMenu();
  const input = {
    requestId: 'checkout-123',
    items: [{ productId: 'kopi-susu', quantity: 1 }],
    paymentMethod: 'cash',
  };
  const first = createOrder(state, input, NOW);
  const repeated = createOrder(first.state, input, NOW);

  assert.equal(repeated.order.id, first.order.id);
  assert.equal(repeated.state.orders.length, 1);
  assert.equal(repeated.duplicate, true);

  const tooManyLines = Array.from({ length: 101 }, () => ({ productId: 'kopi-susu', quantity: 1 }));
  assert.throws(
    () => createOrder(state, { items: tooManyLines, paymentMethod: 'cash' }, NOW),
    /maksimal 100/i,
  );

  const unsafeState = stateWithMenu();
  unsafeState.products[0].price = Number.MAX_SAFE_INTEGER;
  assert.throws(
    () => createOrder(unsafeState, { items: [{ productId: 'kopi-susu', quantity: 2 }], paymentMethod: 'cash' }, NOW),
    /total pesanan/i,
  );
});

test('verifies owner PIN and purges old closed orders', () => {
  const credentials = { ownerPinHash: createPinHash('2468') };
  assert.equal(verifyOwnerPin(credentials, '2468'), true);
  assert.equal(verifyOwnerPin(credentials, '9999'), false);

  let state = stateWithMenu();
  const oldOrder = createOrder(state, { items: [{ productId: 'kopi-susu', quantity: 1 }], paymentMethod: 'cash' }, '2026-05-01T00:00:00.000Z');
  state = completeOrder(oldOrder.state, oldOrder.order.id, '2026-05-01T00:01:00.000Z').state;

  const recentOrder = createOrder(state, { items: [{ productId: 'kopi-susu', quantity: 1 }], paymentMethod: 'cash' }, NOW);
  state = completeOrder(recentOrder.state, recentOrder.order.id, NOW).state;

  const purged = purgeOldOrders(state, 30, NOW);
  assert.equal(purged.orders.length, 1);
  assert.equal(purged.orders[0].id, recentOrder.order.id);
});

test('clears all orders and resets queue completely', () => {
  let state = stateWithMenu();
  const created = createOrder(state, { items: [{ productId: 'kopi-susu', quantity: 2 }], paymentMethod: 'cash' }, NOW);
  state = completeOrder(created.state, created.order.id, NOW).state;

  const cleared = clearAllOrders(state);
  assert.equal(cleared.orders.length, 0);
  assert.equal(cleared.activeCall, null);
  assert.equal(cleared.nextQueueNumber, 1);
});

test('updates owner PIN successfully and rejects invalid input', () => {
  let state = stateWithMenu();
  state.ownerPinHash = createPinHash('2468');
  assert.equal(verifyOwnerPin(state, '2468'), true);

  const updated = updateOwnerPin(state, '2468', '5678');
  assert.equal(verifyOwnerPin(updated.state, '5678'), true);
  assert.equal(verifyOwnerPin(updated.state, '1234'), false);
  assert.equal('ownerPin' in updated.state, false);
  assert.equal(typeof updated.state.ownerPinHash?.hash, 'string');
  assert.equal(typeof updated.state.ownerPinHash?.salt, 'string');

  assert.throws(() => updateOwnerPin(updated.state, '2468', '9999'), /saat ini tidak valid/i);
  assert.throws(() => updateOwnerPin(updated.state, '5678', 'abc'), /4 hingga 8 angka/i);
});

test('creates order with tax when taxConfig is enabled', () => {
  let state = stateWithMenu();
  state = updateTaxConfig(state, { enabled: true, label: 'PPN', rate: 10 }).state;
  const result = createOrder(state, {
    items: [{ productId: 'kopi-susu', quantity: 1 }],
    paymentMethod: 'cash',
  }, NOW);

  assert.equal(result.order.total, 18000);
  assert.equal(result.order.taxAmount, 1800);
  assert.equal(result.order.grandTotal, 19800);
  assert.equal(result.order.taxLabel, 'PPN');
  assert.equal(result.order.taxRate, 10);
});

test('updateTaxConfig validates input and updates state', () => {
  let state = stateWithMenu();
  const result = updateTaxConfig(state, { enabled: true, label: 'PBJT', rate: 10 });
  assert.equal(result.taxConfig.enabled, true);
  assert.equal(result.taxConfig.label, 'PBJT');
  assert.equal(result.taxConfig.rate, 10);

  assert.throws(() => updateTaxConfig(state, { rate: -5 }), /antara 0 dan 100/i);
  assert.throws(() => updateTaxConfig(state, { rate: 150 }), /antara 0 dan 100/i);
  assert.throws(() => updateTaxConfig(state, { label: '' }), /wajib diisi/i);
});
