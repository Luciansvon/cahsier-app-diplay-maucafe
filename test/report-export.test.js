import test from 'node:test';
import assert from 'node:assert/strict';

import { buildSalesWorkbook } from '../src/report-export.js';

test('sales workbook uses explicit financial definitions through net profit', () => {
  const workbook = buildSalesWorkbook({
    title: 'MAUCAFE Jepara',
    date: '2026-07-27',
    filenamePrefix: 'Laporan_maucafe-jepara',
    summary: {
      revenue: 100_000,
      grandRevenue: 100_000,
      totalCost: 40_000,
      margin: 60_000,
      operatingExpenses: 15_000,
      netProfit: 45_000,
      transactionCount: 2,
      products: [{
        productName: '<Kopi>',
        category: 'Kopi',
        unitPrice: 50_000,
        quantity: 2,
        revenue: 100_000,
        cost: 40_000,
        margin: 60_000,
        transactionCount: 2,
        avgQtyPerTrx: '1,00',
      }],
    },
  });

  assert.equal(workbook.filename, 'Laporan_maucafe-jepara_20260727.xls');
  for (const label of [
    'Penjualan Bersih',
    'Total Diterima',
    'Total HPP',
    'Laba Kotor',
    'Biaya Operasional',
    'Profit Bersih',
  ]) {
    assert.match(workbook.html, new RegExp(label));
  }
  assert.doesNotMatch(workbook.html, /Pajak|PBJT|PPN/i);
  assert.doesNotMatch(workbook.html, /Total Profit/);
  assert.match(workbook.html, /&lt;Kopi&gt;/);
  assert.doesNotMatch(workbook.html, /<Kopi>/);
});
