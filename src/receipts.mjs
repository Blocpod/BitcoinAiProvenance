import { issueEnvelope, verifyEnvelope } from './envelope.mjs';
import { invariant } from './errors.mjs';

const RECEIPT_TYPE = 'org.blockpod.btc-ai.provenance-receipt';

function uniqueSorted(values, field) {
  invariant(Array.isArray(values), 'INVALID_RECEIPT', `${field} must be an array`);
  const normalized = [...values].sort();
  invariant(new Set(normalized).size === normalized.length, 'DUPLICATE_REFERENCE', `${field} contains duplicates`);
  return normalized;
}

function assertAlreadyUniqueSorted(values, field) {
  const normalized = uniqueSorted(values, field);
  invariant(values.every((value, index) => value === normalized[index]), 'NON_CANONICAL_ORDER', `${field} must be lexicographically sorted`);
}

function assertArtifactList(values, field) {
  invariant(Array.isArray(values), 'INVALID_RECEIPT', `${field} must be an array`);
  const ids = values.map((entry) => entry?.id);
  invariant(ids.every((id) => typeof id === 'string' && id.length > 0), 'INVALID_ARTIFACT_REFERENCE', `${field} contains an invalid artifact`);
  assertAlreadyUniqueSorted(ids, field);
}

export function createReceipt(input, identity) {
  invariant(Number.isSafeInteger(input.sequence) && input.sequence >= 0, 'INVALID_SEQUENCE', 'sequence must be a non-negative safe integer');
  invariant(typeof input.action === 'string' && input.action.length > 0, 'INVALID_ACTION', 'action is required');
  const statement = {
    type: RECEIPT_TYPE,
    version: '1.0',
    namespace: input.namespace ?? 'default',
    sequence: input.sequence,
    issuedAt: input.issuedAt ?? new Date().toISOString(),
    action: input.action,
    actor: { keyId: identity.keyId, role: input.role ?? 'agent' },
    parents: uniqueSorted(input.parents ?? [], 'parents'),
    inputs: [...(input.inputs ?? [])].sort((a, b) => a.id.localeCompare(b.id)),
    outputs: [...(input.outputs ?? [])].sort((a, b) => a.id.localeCompare(b.id)),
    execution: input.execution ?? {},
    claims: input.claims ?? {},
    policy: input.policy ?? null,
  };
  return issueEnvelope(statement, identity);
}

export function verifyReceipt(envelope) {
  verifyEnvelope(envelope);
  const statement = envelope.statement;
  invariant(statement.type === RECEIPT_TYPE && statement.version === '1.0', 'UNSUPPORTED_RECEIPT', 'Unsupported receipt type or version');
  invariant(statement.actor?.keyId === envelope.signer.keyId, 'ACTOR_SIGNER_MISMATCH', 'Receipt actor is not the signer');
  invariant(Number.isSafeInteger(statement.sequence) && statement.sequence >= 0, 'INVALID_SEQUENCE', 'Invalid receipt sequence');
  const parsedTime = Date.parse(statement.issuedAt);
  invariant(!Number.isNaN(parsedTime) && new Date(parsedTime).toISOString() === statement.issuedAt, 'INVALID_TIMESTAMP', 'Receipt issuedAt must be a canonical ISO timestamp');
  assertAlreadyUniqueSorted(statement.parents, 'parents');
  assertArtifactList(statement.inputs, 'inputs');
  assertArtifactList(statement.outputs, 'outputs');
  return true;
}

export function verifyLineage(receipts, { requireAllParents = true } = {}) {
  const byId = new Map();
  for (const receipt of receipts) {
    verifyReceipt(receipt);
    invariant(!byId.has(receipt.statementId), 'DUPLICATE_RECEIPT', `Duplicate receipt ${receipt.statementId}`);
    byId.set(receipt.statementId, receipt);
  }
  const visiting = new Set();
  const visited = new Set();
  function visit(id) {
    if (visited.has(id)) return;
    invariant(!visiting.has(id), 'LINEAGE_CYCLE', `Cycle detected at ${id}`);
    const receipt = byId.get(id);
    invariant(receipt || !requireAllParents, 'MISSING_RECEIPT', `Missing receipt ${id}`);
    if (!receipt) return;
    visiting.add(id);
    for (const parent of receipt.statement.parents) {
      invariant(parent !== id, 'LINEAGE_CYCLE', `Receipt ${id} references itself`);
      visit(parent);
    }
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of byId.keys()) visit(id);
  return { valid: true, receipts: byId.size, roots: [...byId.values()].filter((entry) => entry.statement.parents.length === 0).map((entry) => entry.statementId) };
}
