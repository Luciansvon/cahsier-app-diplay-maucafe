import test from 'node:test';
import assert from 'node:assert/strict';

import * as security from '../src/security.js';

test('returns every credential key whose hash matches the candidate PIN', () => {
  assert.equal(typeof security.matchingCredentialKeys, 'function');

  const credentials = [
    { key: 'owner', hash: security.createPinHash('2468') },
    { key: 'outlet:a', hash: security.createPinHash('1357') },
    { key: 'user:b', hash: security.createPinHash('2468') },
  ];

  assert.deepEqual(security.matchingCredentialKeys('2468', credentials), ['owner', 'user:b']);
});

test('ignores malformed credential hashes while matching a PIN', () => {
  assert.equal(typeof security.matchingCredentialKeys, 'function');

  assert.deepEqual(security.matchingCredentialKeys('2468', [
    { key: 'broken', hash: { salt: 'not-a-real-salt', hash: 'zz' } },
    { key: 'missing', hash: null },
  ]), []);
});
