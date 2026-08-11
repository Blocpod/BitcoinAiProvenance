import { buildMerkleTree, verifyMerkleProof } from './merkle.mjs';
import { issueEnvelope, verifyEnvelope } from './envelope.mjs';
import { verifyReceipt } from './receipts.mjs';
import { invariant } from './errors.mjs';

const BATCH_TYPE = 'org.blockpod.btc-ai.batch-manifest';

export function createBatch(receipts, aggregator, options = {}) {
  invariant(receipts.length > 0, 'EMPTY_BATCH', 'Batch requires at least one receipt');
  for (const receipt of receipts) verifyReceipt(receipt);
  const receiptIds = receipts.map((entry) => entry.statementId);
  const tree = buildMerkleTree(receiptIds);
  const statement = {
    type: BATCH_TYPE,
    version: '1.0',
    namespace: options.namespace ?? 'default',
    batchNumber: options.batchNumber ?? 0,
    createdAt: options.createdAt ?? new Date().toISOString(),
    previousBatchId: options.previousBatchId ?? null,
    merkle: { algorithm: 'sha256-domain-separated-v1', root: tree.root, leafCount: tree.leaves.length },
    receiptIds: tree.leaves,
  };
  const envelope = issueEnvelope(statement, aggregator);
  return {
    envelope,
    proofs: Object.fromEntries(tree.leaves.map((id) => [id, tree.proofFor(id)])),
  };
}

export function verifyBatch(batch, receipts = []) {
  verifyEnvelope(batch.envelope);
  const statement = batch.envelope.statement;
  invariant(statement.type === BATCH_TYPE && statement.version === '1.0', 'UNSUPPORTED_BATCH', 'Unsupported batch manifest');
  invariant(statement.merkle.leafCount === statement.receiptIds.length, 'BATCH_COUNT_MISMATCH', 'Batch leaf count is inconsistent');
  const tree = buildMerkleTree(statement.receiptIds);
  invariant(statement.receiptIds.every((id, index) => id === tree.leaves[index]), 'NON_CANONICAL_ORDER', 'Batch receipt IDs must be sorted');
  invariant(tree.root === statement.merkle.root, 'BATCH_ROOT_MISMATCH', 'Batch Merkle root does not match receipt IDs');
  for (const id of statement.receiptIds) {
    invariant(batch.proofs[id], 'MISSING_MERKLE_PROOF', `Missing proof for ${id}`);
    invariant(verifyMerkleProof(statement.merkle.root, batch.proofs[id]), 'INVALID_MERKLE_PROOF', `Invalid proof for ${id}`);
  }
  if (receipts.length > 0) {
    const supplied = new Set(receipts.map((receipt) => receipt.statementId));
    invariant(supplied.size === statement.receiptIds.length, 'BATCH_RECEIPT_SET_MISMATCH', 'Supplied receipt set has the wrong size');
    for (const id of statement.receiptIds) invariant(supplied.has(id), 'BATCH_RECEIPT_SET_MISMATCH', `Missing receipt ${id}`);
  }
  return true;
}
