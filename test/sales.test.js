import test from 'node:test';
import assert from 'node:assert/strict';

import { summarizeSales } from '../public/sales.js';

const orders = [
  {
    id: 'waiting-cash', businessDate: '2026-07-23', status: 'waiting', paymentMethod: 'cash',
    total: 18000, createdAt: '2026-07-23T01:00:00.000Z',
    items: [{ productId: 'kopi', productName: 'Kopi Susu', quantity: 1, subtotal: 18000 }],
  },
  {
    id: 'completed-qris', businessDate: '2026-07-23', status: 'completed', paymentMethod: 'QRIS',
    total: 40000, createdAt: '2026-07-23T02:00:00.000Z',
    items: [{ productId: 'cokelat', productName: 'Chocolate', quantity: 2, subtotal: 40000 }],
  },
  {
    id: 'cancelled', businessDate: '2026-07-23', status: 'cancelled', paymentMethod: 'cash',
    total: 18000, createdAt: '2026-07-23T03:00:00.000Z',
    items: [{ productId: 'kopi', productName: 'Kopi Susu', quantity: 1, subtotal: 18000 }],
  },
  {
    id: 'other-date', businessDate: '2026-07-22', status: 'completed', paymentMethod: 'cash',
    total: 99000, createdAt: '2026-07-22T03:00:00.000Z', items: [],
  },
];

test('summarizes paid sales for one business date and excludes cancelled totals', () => {
  const summary = summarizeSales(orders, '2026-07-23');

  assert.equal(summary.revenue, 58000);
  assert.equal(summary.transactionCount, 2);
  assert.deepEqual(summary.paymentTotals, { cash: 18000, QRIS: 40000 });
  assert.deepEqual(summary.products, [
    { productId: 'cokelat', productName: 'Chocolate', quantity: 2, revenue: 40000 },
    { productId: 'kopi', productName: 'Kopi Susu', quantity: 1, revenue: 18000 },
  ]);
  assert.deepEqual(summary.transactions.map((order) => order.id), ['cancelled', 'completed-qris', 'waiting-cash']);
});

test('returns empty totals when the business date has no transactions', () => {
  assert.deepEqual(summarizeSales(orders, '2026-07-24'), {
    revenue: 0,
    transactionCount: 0,
    paymentTotals: { cash: 0, QRIS: 0 },
    products: [],
    transactions: [],
  });
});
