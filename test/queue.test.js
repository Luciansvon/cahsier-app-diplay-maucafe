import test from 'node:test';
import assert from 'node:assert/strict';

import {
  addProduct,
  callOrder,
  cancelOrder,
  completeOrder,
  createInitialState,
  createOrder,
  resetQueue,
  updateProduct,
} from '../src/queue.js';

const NOW = '2026-07-23T02:00:00.000Z';

function stateWithMenu() {
  return createInitialState({
    products: [
      { id: 'kopi-susu', name: 'Kopi Susu', category: 'Kopi', price: 18000, active: true },
    ],
  });
}

test('creates a paid order with a three digit daily number and price snapshot', () => {
  const state = stateWithMenu();
  const result = createOrder(state, {
    items: [{ productId: 'kopi-susu', quantity: 2 }],
    paymentMethod: 'QRIS',
  }, NOW);

  assert.equal(result.order.queueNumber, '001');
  assert.equal(result.order.status, 'waiting');
  assert.equal(result.order.total, 36000);
  assert.deepEqual(result.order.items[0], {
    productId: 'kopi-susu',
    productName: 'Kopi Susu',
    unitPrice: 18000,
    quantity: 2,
    subtotal: 36000,
  });
});

test('resets numbering automatically when Jakarta business date changes', () => {
  let state = stateWithMenu();
  ({ state } = createOrder(state, { items: [{ productId: 'kopi-susu', quantity: 1 }], paymentMethod: 'cash' }, NOW));
  const result = createOrder(state, { items: [{ productId: 'kopi-susu', quantity: 1 }], paymentMethod: 'cash' }, '2026-07-24T02:00:00.000Z');

  assert.equal(result.order.queueNumber, '001');
});

test('calling and recalling changes the event without duplicating the order', () => {
  let state = stateWithMenu();
  const created = createOrder(state, { items: [{ productId: 'kopi-susu', quantity: 1 }], paymentMethod: 'cash' }, NOW);
  state = callOrder(created.state, created.order.id, NOW).state;
  const recalled = callOrder(state, created.order.id, '2026-07-23T02:01:00.000Z');

  assert.equal(recalled.state.orders.length, 1);
  assert.equal(recalled.state.activeCall.queueNumber, '001');
  assert.equal(recalled.state.activeCall.eventId, 2);
  assert.equal(recalled.order.status, 'ready');
});

test('orders can be completed or cancelled', () => {
  let state = stateWithMenu();
  const first = createOrder(state, { items: [{ productId: 'kopi-susu', quantity: 1 }], paymentMethod: 'cash' }, NOW);
  const second = createOrder(first.state, { items: [{ productId: 'kopi-susu', quantity: 1 }], paymentMethod: 'QRIS' }, NOW);

  state = completeOrder(second.state, first.order.id, NOW).state;
  state = cancelOrder(state, second.order.id, NOW).state;

  assert.equal(state.orders[0].status, 'completed');
  assert.equal(state.orders[1].status, 'cancelled');
});

test('reset clears orders and active call', () => {
  let state = stateWithMenu();
  const created = createOrder(state, { items: [{ productId: 'kopi-susu', quantity: 1 }], paymentMethod: 'cash' }, NOW);
  state = callOrder(created.state, created.order.id, NOW).state;

  state = resetQueue(state, NOW);

  assert.equal(state.orders.length, 0);
  assert.equal(state.activeCall, null);
  assert.equal(state.nextQueueNumber, 1);
});

test('products can be added and updated without mutating previous state', () => {
  const before = createInitialState();
  const added = addProduct(before, { name: 'Americano', category: 'Kopi', price: 15000 });
  const updated = updateProduct(added.state, added.product.id, { price: 17000, active: false });

  assert.equal(before.products.length, 0);
  assert.equal(updated.product.price, 17000);
  assert.equal(updated.product.active, false);
});

test('rejects invalid order input', () => {
  const state = stateWithMenu();
  assert.throws(() => createOrder(state, { items: [], paymentMethod: 'cash' }, NOW), /item/i);
  assert.throws(() => createOrder(state, { items: [{ productId: 'missing', quantity: 1 }], paymentMethod: 'cash' }, NOW), /produk/i);
  assert.throws(() => createOrder(state, { items: [{ productId: 'kopi-susu', quantity: 0 }], paymentMethod: 'cash' }, NOW), /jumlah/i);
});
