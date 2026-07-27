import test from 'node:test';
import assert from 'node:assert/strict';

import { buildReceipt } from '../public/receipt-model.js';

test('receipt uses the historical order snapshot instead of current menu prices', () => {
  const order = {
    id: 'order-1',
    queueNumber: '007',
    createdAt: '2026-07-24T03:00:00.000Z',
    paymentMethod: 'QRIS',
    items: [{
      productId: 'latte',
      productName: 'Latte',
      category: 'Kopi',
      unitPrice: 20000,
      unitCost: 8000,
      quantity: 2,
      subtotal: 40000,
    }],
    total: 40000,
    taxLabel: 'PBJT',
    taxRate: 10,
    taxAmount: 4000,
    grandTotal: 44000,
  };

  const receipt = buildReceipt({
    order,
    outlet: { id: 'maucafe-alunalun', name: 'MAUCAFE Alun-Alun', address: 'Jepara' },
  });

  assert.equal(receipt.items[0].unitPrice, 20000);
  assert.equal(receipt.items[0].subtotal, 40000);
  assert.equal(receipt.subtotal, 40000);
  assert.equal('tax' in receipt, false);
  assert.equal(receipt.totalReceived, 40000);
  assert.equal(receipt.paymentMethod, 'QRIS');
  assert.equal(receipt.queueNumber, '007');
  assert.equal('unitCost' in receipt.items[0], false);
});

test('receipt rejects incomplete historical snapshots', () => {
  assert.throws(
    () => buildReceipt({
      order: {
        id: 'broken',
        queueNumber: '001',
        createdAt: '2026-07-24T03:00:00.000Z',
        paymentMethod: 'cash',
        items: [{ productId: 'latte', productName: 'Latte', quantity: 1 }],
        total: 20000,
      },
      outlet: { id: 'demo', name: 'Demo', address: 'Demo' },
    }),
    /snapshot/i,
  );
});
