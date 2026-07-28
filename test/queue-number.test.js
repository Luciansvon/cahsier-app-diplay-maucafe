import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeQueueNumber, queueNumberPage, queueNumberText } from '../public/queue-number.js';

test('normalizes queue numbers without a leading zero', () => {
  assert.equal(normalizeQueueNumber('001'), '1');
  assert.equal(normalizeQueueNumber('050'), '50');
  assert.equal(normalizeQueueNumber('100'), '100');
});

test('converts queue numbers into Indonesian words for reliable speech', () => {
  assert.equal(queueNumberText('1'), 'satu');
  assert.equal(queueNumberText('11'), 'sebelas');
  assert.equal(queueNumberText('30'), 'tiga puluh');
  assert.equal(queueNumberText('050'), 'lima puluh');
  assert.equal(queueNumberText('100'), 'seratus');
});

test('paginates every waiting queue number six at a time', () => {
  const values = ['001', '2', '3', '4', '5', '6', '7', '8'];
  assert.deepEqual(queueNumberPage(values, 0), {
    numbers: ['1', '2', '3', '4', '5', '6'],
    pageIndex: 0,
    pageCount: 2,
  });
  assert.deepEqual(queueNumberPage(values, 1), {
    numbers: ['7', '8'],
    pageIndex: 1,
    pageCount: 2,
  });
  assert.equal(queueNumberPage(values, 2).pageIndex, 0);
});
