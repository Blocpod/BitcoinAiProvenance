import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMerkleTree, verifyMerkleProof } from '../src/merkle.mjs';
import { generateIdentity } from '../src/crypto.mjs';
import { createReceipt } from '../src/receipts.mjs';
import { createBatch, verifyBatch } from '../src/batches.mjs';

for (const count of [1, 2, 3, 4, 5, 8, 9, 31]) {
  test(`Merkle proofs verify for ${count} leaves`, () => {
    const values = Array.from({ length: count }, (_, index) => `leaf-${index}`);
    const tree = buildMerkleTree(values);
    for (const value of values) assert.equal(verifyMerkleProof(tree.root, tree.proofFor(value)), true);
  });
}

test('Merkle proof rejects direction and index tampering', () => {
  const tree = buildMerkleTree(['a', 'b', 'c']);
  const proof = tree.proofFor('b');
  proof.index = 0;
  assert.throws(() => verifyMerkleProof(tree.root, proof), { code: 'INVALID_PROOF_DIRECTION' });
});

test('signed batch covers every supplied receipt', () => {
  const actor = generateIdentity('actor');
  const receipts = [0, 1, 2].map((sequence) => createReceipt({ sequence, action: `action.${sequence}` }, actor));
  const batch = createBatch(receipts, actor, { batchNumber: 7, createdAt: '2026-08-11T00:00:00.000Z' });
  assert.equal(verifyBatch(batch, receipts), true);
  const tampered = structuredClone(batch);
  tampered.proofs[receipts[0].statementId].value = 'sha256:bad';
  assert.throws(() => verifyBatch(tampered), { code: 'INVALID_MERKLE_PROOF' });
});
