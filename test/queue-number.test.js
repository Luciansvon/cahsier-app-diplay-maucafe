import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeQueueNumber, queueNumberText } from '../public/queue-number.js';

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
