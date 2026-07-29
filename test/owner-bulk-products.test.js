import assert from 'node:assert/strict';
import test from 'node:test';
import { bulkUpsertMasterProducts, validateBulkProductRows } from '../src/queue.js';
import { fixture, jsonRequest } from './helpers.js';

test('validateBulkProductRows rejects empty rows and rows exceeding max limit', () => {
  const existing = [{ id: 'p1', name: 'Kopi A', category: 'Kopi', price: 10000, cost: 5000, cupUsage: 1, active: true }];
  
  const emptyRes = validateBulkProductRows(existing, []);
  assert.equal(emptyRes.ok, false);
  assert.equal(emptyRes.error, 'Data import tidak boleh kosong');

  const tooManyRows = Array.from({ length: 251 }, (_, i) => ({
    name: `Menu ${i}`, category: 'Kopi', price: 10000, cost: 5000, cupUsage: 1, active: true,
  }));
  const tooManyRes = validateBulkProductRows(existing, tooManyRows, { maxRows: 250 });
  assert.equal(tooManyRes.ok, false);
  assert.match(tooManyRes.error, /melebihi batas maksimal/);
});

test('validateBulkProductRows rejects unsafe or negative price/cost and invalid cupUsage', () => {
  const existing = [];
  const invalidRows = [
    { name: 'Kopi Unsafe', category: 'Kopi', price: -5000, cost: 2000, cupUsage: 1, active: true },
    { name: 'Kopi Cup', category: 'Kopi', price: 10000, cost: 5000, cupUsage: 15, active: true },
    { name: 'Kopi Float', category: 'Kopi', price: 10000.5, cost: 5000, cupUsage: 1, active: true },
  ];
  const res = validateBulkProductRows(existing, invalidRows);
  assert.equal(res.ok, false);
  assert.equal(res.rowErrors.length, 3);
});

test('validateBulkProductRows rejects duplicate ID or duplicate name+category inside batch', () => {
  const existing = [{ id: 'p1', name: 'Kopi Susu', category: 'Kopi', price: 15000, cost: 7000, cupUsage: 1, active: true }];
  
  const duplicateBatch = [
    { name: 'Teh Manis', category: 'Non-Kopi', price: 5000, cost: 2000 },
    { name: 'Teh Manis', category: 'Non-Kopi', price: 6000, cost: 2000 },
  ];
  const resBatch = validateBulkProductRows(existing, duplicateBatch);
  assert.equal(resBatch.ok, false);
  assert.match(resBatch.rowErrors[0].message, /duplikat dalam batch/);

  const duplicateExisting = [
    { name: 'Kopi Susu', category: 'Kopi', price: 15000, cost: 7000 },
  ];
  const resExist = validateBulkProductRows(existing, duplicateExisting);
  assert.equal(resExist.ok, false);
  assert.match(resExist.rowErrors[0].message, /sudah ada di database/);
});

test('validateBulkProductRows allows updating existing product with matching ID', () => {
  const existing = [{ id: 'p1', name: 'Kopi Susu', category: 'Kopi', price: 15000, cost: 7000, cupUsage: 1, active: true }];
  const updateRows = [
    { id: 'p1', name: 'Kopi Susu Gula Aren', category: 'Kopi', price: 18000, cost: 8000, cupUsage: 1, active: true },
  ];
  const res = validateBulkProductRows(existing, updateRows);
  assert.equal(res.ok, true);
  assert.equal(res.validatedRows[0].id, 'p1');
  assert.equal(res.validatedRows[0].name, 'Kopi Susu Gula Aren');
});

test('bulkUpsertMasterProducts updates products and tracks summary', () => {
  const initial = {
    products: [
      { id: 'p1', name: 'Kopi A', category: 'Kopi', price: 10000, cost: 5000, cupUsage: 1, active: true },
      { id: 'p2', name: 'Kopi B', category: 'Kopi', price: 12000, cost: 6000, cupUsage: 1, active: true },
    ],
  };

  const validatedRows = [
    { id: 'p1', name: 'Kopi A Super', category: 'Kopi', price: 15000, cost: 7000, cupUsage: 1, active: true },
    { id: 'p2', name: 'Kopi B', category: 'Kopi', price: 12000, cost: 6000, cupUsage: 1, active: true },
    { id: null, name: 'Kopi C Baru', category: 'Kopi', price: 20000, cost: 9000, cupUsage: 1, active: true },
  ];

  const result = bulkUpsertMasterProducts(initial, validatedRows);
  assert.equal(result.summary.created, 1);
  assert.equal(result.summary.updated, 1);
  assert.equal(result.summary.unchanged, 1);
  assert.equal(result.state.products.length, 3);
});

test('Owner bulk API endpoints enforce auth, dryRun, all-or-nothing, and idempotency', async (t) => {
  const { baseUrl } = await fixture(t);
  
  const loginRes = await jsonRequest(`${baseUrl}/api/owner/login`, 'POST', { pin: '1234' });
  assert.equal(loginRes.response.status, 200);
  const ownerCookie = loginRes.response.headers.get('set-cookie');

  // Authorization check
  const unauthorizedRes = await jsonRequest(`${baseUrl}/api/owner/products`, 'GET');
  assert.equal(unauthorizedRes.response.status, 401);

  // GET /api/owner/products
  const getRes = await jsonRequest(`${baseUrl}/api/owner/products`, 'GET', null, { Cookie: ownerCookie });
  assert.equal(getRes.response.status, 200);
  assert.ok(Array.isArray(getRes.payload.products));
  assert.equal(getRes.payload.limits.maxProducts, 500);

  // Dry-run POST
  const requestId = 'req_test_dryrun_1234567890';
  const bulkRows = [
    { id: null, name: 'Es Teh Manis Bulk', category: 'Non-Kopi', price: 5000, cost: 2000, cupUsage: 1, active: true },
    { id: null, name: 'Es Jeruk Bulk', category: 'Non-Kopi', price: 7000, cost: 3000, cupUsage: 1, active: true },
  ];

  const dryRunRes = await jsonRequest(`${baseUrl}/api/owner/products/bulk`, 'POST', {
    requestId,
    dryRun: true,
    rows: bulkRows,
  }, { Cookie: ownerCookie });

  assert.equal(dryRunRes.response.status, 200);
  assert.equal(dryRunRes.payload.dryRun, true);
  assert.equal(dryRunRes.payload.summary.created, 2);

  // Verify products state unchanged after dryRun
  const getAfterDryRun = await jsonRequest(`${baseUrl}/api/owner/products`, 'GET', null, { Cookie: ownerCookie });
  const hasEsTeh = getAfterDryRun.payload.products.some((p) => p.name === 'Es Teh Manis Bulk');
  assert.equal(hasEsTeh, false);

  // All-or-nothing test with 1 invalid row
  const invalidBulkRows = [
    { id: null, name: 'Es Alpukat', category: 'Non-Kopi', price: 10000, cost: 4000, cupUsage: 1, active: true },
    { id: null, name: 'Es Durian Invalid', category: 'Non-Kopi', price: -500, cost: 4000, cupUsage: 1, active: true },
  ];
  const invalidCommitRes = await jsonRequest(`${baseUrl}/api/owner/products/bulk`, 'POST', {
    requestId: 'req_test_invalid_1234567890',
    dryRun: false,
    rows: invalidBulkRows,
  }, { Cookie: ownerCookie });

  assert.equal(invalidCommitRes.response.status, 400);
  assert.ok(Array.isArray(invalidCommitRes.payload.rowErrors));

  // Valid Commit POST
  const commitRequestId = 'req_test_commit_1234567890';
  const commitRes = await jsonRequest(`${baseUrl}/api/owner/products/bulk`, 'POST', {
    requestId: commitRequestId,
    dryRun: false,
    rows: bulkRows,
  }, { Cookie: ownerCookie });

  assert.equal(commitRes.response.status, 200);
  assert.equal(commitRes.payload.dryRun, false);
  assert.equal(commitRes.payload.summary.created, 2);

  // Retry same requestId returns same result (idempotency)
  const retryRes = await jsonRequest(`${baseUrl}/api/owner/products/bulk`, 'POST', {
    requestId: commitRequestId,
    dryRun: false,
    rows: bulkRows,
  }, { Cookie: ownerCookie });
  assert.equal(retryRes.response.status, 200);
  assert.equal(retryRes.payload.summary.created, 2);

  // Verify database now contains the 2 new products
  const getAfterCommit = await jsonRequest(`${baseUrl}/api/owner/products`, 'GET', null, { Cookie: ownerCookie });
  const addedTeh = getAfterCommit.payload.products.find((p) => p.name === 'Es Teh Manis Bulk');
  assert.ok(addedTeh);

  // PATCH bulk status
  const patchRequestId = 'req_test_patch_1234567890';
  const patchRes = await jsonRequest(`${baseUrl}/api/owner/products/bulk`, 'PATCH', {
    requestId: patchRequestId,
    productIds: [addedTeh.id],
    changes: { active: false },
  }, { Cookie: ownerCookie });

  assert.equal(patchRes.response.status, 200);
  assert.equal(patchRes.payload.updatedCount, 1);

  const invalidBoolean = await jsonRequest(`${baseUrl}/api/owner/products/bulk`, 'PATCH', {
    requestId: 'req_test_patch_invalid_boolean',
    productIds: [addedTeh.id],
    changes: { active: 'false' },
  }, { Cookie: ownerCookie });
  assert.equal(invalidBoolean.response.status, 400);
});

test('POST /api/owner/clear-all-outlets-sales requires phrase HAPUS SEMUA and Owner PIN', async (t) => {
  const { baseUrl } = await fixture(t, { ownerPin: '1234' });
  const loginRes = await jsonRequest(`${baseUrl}/api/owner/login`, 'POST', { pin: '1234' });
  const ownerCookie = loginRes.response.headers.get('set-cookie');

  // Wrong confirmation phrase -> rejected
  const wrongPhrase = await jsonRequest(`${baseUrl}/api/owner/clear-all-outlets-sales`, 'POST', {
    confirmation: 'HAPUS',
    currentPin: '1234',
  }, { Cookie: ownerCookie });
  assert.equal(wrongPhrase.response.status, 400);

  // Wrong PIN -> rejected
  const wrongPin = await jsonRequest(`${baseUrl}/api/owner/clear-all-outlets-sales`, 'POST', {
    confirmation: 'HAPUS SEMUA',
    currentPin: '9999',
  }, { Cookie: ownerCookie });
  assert.equal(wrongPin.response.status, 401);

  // Valid request
  const validClear = await jsonRequest(`${baseUrl}/api/owner/clear-all-outlets-sales`, 'POST', {
    confirmation: 'HAPUS SEMUA',
    currentPin: '1234',
    requestId: 'req_clear_all_1234567890',
  }, { Cookie: ownerCookie });
  assert.equal(validClear.response.status, 200);
  assert.equal(validClear.payload.ok, true);
  assert.ok(typeof validClear.payload.deletedOrders === 'number');
});
