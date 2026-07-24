import test from 'node:test';
import assert from 'node:assert/strict';

import { summarizeSales } from '../public/sales.js';

const orders = [
  {
    id: 'waiting-cash', businessDate: '2026-07-23', status: 'waiting', paymentMethod: 'cash',
    total: 18000, taxAmount: 1800, grandTotal: 19800, createdAt: '2026-07-23T01:00:00.000Z',
    items: [{ productId: 'kopi', productName: 'Kopi Susu', unitCost: 8000, quantity: 1, subtotal: 18000 }],
  },
  {
    id: 'completed-qris', businessDate: '2026-07-23', status: 'completed', paymentMethod: 'QRIS',
    total: 40000, taxAmount: 4000, grandTotal: 44000, createdAt: '2026-07-23T02:00:00.000Z',
    items: [{ productId: 'cokelat', productName: 'Chocolate', unitCost: 9000, quantity: 2, subtotal: 40000 }],
  },
  {
    id: 'cancelled', businessDate: '2026-07-23', status: 'cancelled', paymentMethod: 'cash',
    total: 18000, taxAmount: 0, grandTotal: 18000, createdAt: '2026-07-23T03:00:00.000Z',
    items: [{ productId: 'kopi', productName: 'Kopi Susu', unitCost: 8000, quantity: 1, subtotal: 18000 }],
  },
  {
    id: 'other-date', businessDate: '2026-07-22', status: 'completed', paymentMethod: 'cash',
    total: 99000, taxAmount: 0, grandTotal: 99000, createdAt: '2026-07-22T03:00:00.000Z', items: [],
  },
];

test('summarizes paid sales with HPP, margin, and tax for one business date', () => {
  const summary = summarizeSales(orders, '2026-07-23');

  assert.equal(summary.revenue, 58000);
  assert.equal(summary.totalCost, 26000); // 8000*1 + 9000*2
  assert.equal(summary.margin, 32000); // 58000 - 26000
  assert.equal(summary.totalTax, 5800); // 1800 + 4000
  assert.equal(summary.transactionCount, 2);
  assert.deepEqual(summary.paymentTotals, { cash: 19800, QRIS: 44000 });
  assert.deepEqual(summary.products, [
    { productId: 'cokelat', productName: 'Chocolate', category: 'Lainnya', unitPrice: 20000, quantity: 2, revenue: 40000, cost: 18000, margin: 22000, transactionCount: 1, avgQtyPerTrx: '2,00' },
    { productId: 'kopi', productName: 'Kopi Susu', category: 'Lainnya', unitPrice: 18000, quantity: 1, revenue: 18000, cost: 8000, margin: 10000, transactionCount: 1, avgQtyPerTrx: '1,00' },
  ]);
  assert.deepEqual(summary.transactions.map((order) => order.id), ['cancelled', 'completed-qris', 'waiting-cash']);
});

test('returns empty totals when the business date has no transactions', () => {
  const summary = summarizeSales(orders, '2026-07-24');
  assert.equal(summary.revenue, 0);
  assert.equal(summary.totalCost, 0);
  assert.equal(summary.margin, 0);
  assert.equal(summary.totalTax, 0);
  assert.equal(summary.transactionCount, 0);
  assert.deepEqual(summary.paymentTotals, { cash: 0, QRIS: 0 });
  assert.deepEqual(summary.products, []);
  assert.deepEqual(summary.transactions, []);
});
