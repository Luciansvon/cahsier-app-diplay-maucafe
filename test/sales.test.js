import test from 'node:test';
import assert from 'node:assert/strict';

import { summarizeSales } from '../public/sales.js';

const orders = [
  {
    id: 'waiting-cash', businessDate: '2026-07-23', status: 'waiting', paymentMethod: 'cash',
    total: 18000, taxAmount: 1800, grandTotal: 19800, createdAt: '2026-07-23T01:00:00.000Z',
    items: [{ productId: 'kopi', productName: 'Kopi Susu', category: 'Kopi', unitPrice: 18000, unitCost: 8000, quantity: 1, subtotal: 18000 }],
  },
  {
    id: 'completed-qris', businessDate: '2026-07-23', status: 'completed', paymentMethod: 'QRIS',
    total: 40000, taxAmount: 4000, grandTotal: 44000, createdAt: '2026-07-23T02:00:00.000Z',
    items: [{ productId: 'cokelat', productName: 'Chocolate', category: 'Non-Kopi', unitPrice: 20000, unitCost: 9000, quantity: 2, subtotal: 40000 }],
  },
  {
    id: 'cancelled', businessDate: '2026-07-23', status: 'cancelled', paymentMethod: 'cash',
    total: 18000, taxAmount: 0, grandTotal: 18000, createdAt: '2026-07-23T03:00:00.000Z',
    items: [{ productId: 'kopi', productName: 'Kopi Susu', category: 'Kopi', unitPrice: 18000, unitCost: 8000, quantity: 1, subtotal: 18000 }],
  },
  {
    id: 'other-date', businessDate: '2026-07-22', status: 'completed', paymentMethod: 'cash',
    total: 99000, taxAmount: 0, grandTotal: 99000, createdAt: '2026-07-22T03:00:00.000Z', items: [],
  },
];

test('summarizes paid sales with HPP, category snapshots, tax, and total received', () => {
  const summary = summarizeSales(orders, '2026-07-23');

  assert.equal(summary.revenue, 58000);
  assert.equal(summary.totalCost, 26000); // 8000*1 + 9000*2
  assert.equal(summary.margin, 32000);
  assert.equal(summary.totalTax, 5800);
  assert.equal(summary.grandRevenue, 63800);
  assert.equal(summary.transactionCount, 2);
  assert.deepEqual(summary.paymentTotals, { cash: 19800, QRIS: 44000 });
  assert.deepEqual(summary.products, [
    { productId: 'cokelat', productName: 'Chocolate', category: 'Non-Kopi', unitPrice: 20000, quantity: 2, revenue: 40000, cost: 18000, margin: 22000, transactionCount: 1, avgQtyPerTrx: '2,00' },
    { productId: 'kopi', productName: 'Kopi Susu', category: 'Kopi', unitPrice: 18000, quantity: 1, revenue: 18000, cost: 8000, margin: 10000, transactionCount: 1, avgQtyPerTrx: '1,00' },
  ]);
  assert.deepEqual(summary.transactions.map((order) => order.id), ['cancelled', 'completed-qris', 'waiting-cash']);
});

test('uses canonical unitPrice and preserves historical snapshots independent of current menu changes', () => {
  const historical = summarizeSales([{
    id: 'old-order', businessDate: '2026-07-23', status: 'completed', paymentMethod: 'cash',
    total: 18000, taxAmount: 0, grandTotal: 18000, createdAt: '2026-07-23T01:00:00.000Z',
    items: [{
      productId: 'latte', productName: 'Latte', category: 'Kopi', unitPrice: 18000,
      unitCost: 8000, quantity: 1, subtotal: 18000,
    }],
  }], '2026-07-23');

  assert.equal(historical.products[0].productName, 'Latte');
  assert.equal(historical.products[0].category, 'Kopi');
  assert.equal(historical.products[0].unitPrice, 18000);
  assert.equal(historical.products[0].cost, 8000);
});

test('falls back safely for legacy order items that predate category and unitPrice snapshots', () => {
  const summary = summarizeSales([{
    id: 'legacy', businessDate: '2026-07-23', status: 'completed', paymentMethod: 'cash',
    total: 30000, taxAmount: 0, grandTotal: 30000, createdAt: '2026-07-23T01:00:00.000Z',
    items: [{ productId: 'legacy-item', productName: 'Legacy', unitCost: 5000, quantity: 2, subtotal: 30000 }],
  }], '2026-07-23');

  assert.equal(summary.products[0].category, 'Lainnya');
  assert.equal(summary.products[0].unitPrice, 15000);
});

test('returns empty totals when the business date has no transactions', () => {
  const summary = summarizeSales(orders, '2026-07-24');
  assert.equal(summary.revenue, 0);
  assert.equal(summary.totalCost, 0);
  assert.equal(summary.margin, 0);
  assert.equal(summary.totalTax, 0);
  assert.equal(summary.grandRevenue, 0);
  assert.equal(summary.transactionCount, 0);
  assert.deepEqual(summary.paymentTotals, { cash: 0, QRIS: 0 });
  assert.deepEqual(summary.products, []);
  assert.deepEqual(summary.transactions, []);
});

test('excludes void and expired orders then subtracts operating expenses from gross margin', () => {
  const dailyOrders = [
    {
      id: 'shift-1-cash', shiftId: 'shift-1', businessDate: '2026-07-27', status: 'completed',
      paymentStatus: 'paid', paymentMethod: 'cash', total: 100_000, taxAmount: 10_000,
      grandTotal: 110_000, createdAt: '2026-07-27T01:00:00.000Z',
      items: [{ productId: 'kopi', productName: 'Kopi', category: 'Kopi', unitPrice: 50_000, unitCost: 20_000, quantity: 2, subtotal: 100_000 }],
    },
    {
      id: 'shift-2-qris', shiftId: 'shift-2', businessDate: '2026-07-27', status: 'waiting',
      paymentStatus: 'paid', paymentMethod: 'QRIS', total: 50_000, taxAmount: 0,
      grandTotal: 50_000, createdAt: '2026-07-27T02:00:00.000Z',
      items: [{ productId: 'latte', productName: 'Latte', category: 'Kopi', unitPrice: 50_000, unitCost: 25_000, quantity: 1, subtotal: 50_000 }],
    },
    {
      id: 'expired', shiftId: 'shift-1', businessDate: '2026-07-27', status: 'expired',
      paymentStatus: 'void', paymentMethod: 'cash', total: 999_000, taxAmount: 0,
      grandTotal: 999_000, createdAt: '2026-07-27T03:00:00.000Z', items: [],
    },
  ];
  const operationalEntries = [
    { id: 'expense-1', type: 'expense', amount: 15_000, shiftId: 'shift-1', businessDate: '2026-07-27' },
    { id: 'deposit', type: 'deposit', amount: 30_000, shiftId: 'shift-1', businessDate: '2026-07-27' },
    { id: 'expense-shift-2', type: 'expense', amount: 5_000, shiftId: 'shift-2', businessDate: '2026-07-27' },
    { id: 'expense-old', type: 'expense', amount: 100_000, shiftId: 'shift-1', businessDate: '2026-07-26' },
  ];

  const all = summarizeSales(dailyOrders, '2026-07-27', { operationalEntries });
  assert.equal(all.revenue, 150_000);
  assert.equal(all.totalCost, 65_000);
  assert.equal(all.margin, 85_000);
  assert.equal(all.operatingExpenses, 20_000);
  assert.equal(all.netProfit, 65_000);
  assert.equal(all.grandRevenue, 160_000);

  const shiftOne = summarizeSales(dailyOrders, '2026-07-27', {
    operationalEntries,
    shiftId: 'shift-1',
  });
  assert.equal(shiftOne.revenue, 100_000);
  assert.equal(shiftOne.operatingExpenses, 15_000);
  assert.equal(shiftOne.netProfit, 45_000);
  assert.deepEqual(shiftOne.paymentTotals, { cash: 110_000, QRIS: 0 });
});
