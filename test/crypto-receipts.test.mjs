import test from 'node:test';
import assert from 'node:assert/strict';
import { generateIdentity } from '../src/crypto.mjs';
import { createReceipt, verifyLineage, verifyReceipt } from '../src/receipts.mjs';

test('receipt signatures and statement IDs verify', () => {
  const actor = generateIdentity('actor');
  const receipt = createReceipt({ sequence: 0, issuedAt: '2026-08-11T00:00:00.000Z', action: 'model.registered' }, actor);
  assert.equal(verifyReceipt(receipt), true);
  assert.match(receipt.statementId, /^sha256:[0-9a-f]{64}$/);
});

test('tampering with a signed receipt is detected', () => {
  const actor = generateIdentity('actor');
  const receipt = createReceipt({ sequence: 0, action: 'model.registered' }, actor);
  const tampered = structuredClone(receipt);
  tampered.statement.action = 'ownership.transferred';
  assert.throws(() => verifyReceipt(tampered), { code: 'STATEMENT_ID_MISMATCH' });
});

test('lineage validates parents and detects missing nodes and self-cycles', () => {
  const actor = generateIdentity('actor');
  const parent = createReceipt({ sequence: 0, action: 'input.registered' }, actor);
  const child = createReceipt({ sequence: 1, action: 'output.created', parents: [parent.statementId] }, actor);
  assert.equal(verifyLineage([parent, child]).receipts, 2);
  assert.throws(() => verifyLineage([child]), { code: 'MISSING_RECEIPT' });
  const cycle = structuredClone(parent);
  cycle.statement.parents = [cycle.statementId];
  assert.throws(() => verifyReceipt(cycle), { code: 'STATEMENT_ID_MISMATCH' });
});
