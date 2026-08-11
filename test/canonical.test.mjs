import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalize, parseCanonical } from '../src/canonical.mjs';

test('canonical JSON sorts object keys recursively', () => {
  assert.equal(canonicalize({ z: 1, a: { d: true, c: 'x' }, list: [2, 1] }), '{"a":{"c":"x","d":true},"list":[2,1],"z":1}');
});

test('canonical JSON rejects undefined, unsafe numbers, cycles, and invalid unicode', () => {
  assert.throws(() => canonicalize({ x: undefined }), { code: 'UNDEFINED_VALUE' });
  assert.throws(() => canonicalize({ x: Number.MAX_VALUE }), { code: 'UNSAFE_NUMBER' });
  const cyclic = {}; cyclic.self = cyclic;
  assert.throws(() => canonicalize(cyclic), { code: 'CYCLIC_VALUE' });
  assert.throws(() => canonicalize({ x: '\ud800' }), { code: 'INVALID_UNICODE' });
});

test('parseCanonical rejects semantically valid but non-canonical JSON', () => {
  assert.deepEqual(parseCanonical('{"a":1,"b":2}'), { a: 1, b: 2 });
  assert.throws(() => parseCanonical('{"b":2,"a":1}'), { code: 'NON_CANONICAL_JSON' });
});
