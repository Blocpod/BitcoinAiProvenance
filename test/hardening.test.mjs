import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateIdentity } from '../src/crypto.mjs';
import { issueEnvelope } from '../src/envelope.mjs';
import { createReceipt, verifyReceipt } from '../src/receipts.mjs';
import { buildMerkleTree, verifyMerkleProof } from '../src/merkle.mjs';
import { ArtifactStore } from '../src/artifacts.mjs';
import { appendLocalAnchor, verifyLocalJournal } from '../src/local-anchor.mjs';
import { readJson } from '../src/fs-util.mjs';
import { ProvenanceWorkspace } from '../src/workspace.mjs';
import { createBatch } from '../src/batches.mjs';
import { createExplorerServer } from '../src/explorer.mjs';

test('a correctly signed but non-canonical receipt is rejected', () => {
  const actor = generateIdentity('actor');
  const parentA = createReceipt({ sequence: 0, action: 'a' }, actor);
  const parentB = createReceipt({ sequence: 1, action: 'b' }, actor);
  const canonical = createReceipt({ sequence: 2, action: 'c', parents: [parentA.statementId, parentB.statementId] }, actor);
  const statement = structuredClone(canonical.statement);
  statement.parents.reverse();
  const signedNonCanonical = issueEnvelope(statement, actor);
  assert.throws(() => verifyReceipt(signedNonCanonical), { code: 'NON_CANONICAL_ORDER' });
});

test('Merkle verifier rejects malformed promotion and unknown directions', () => {
  const tree = buildMerkleTree(['a', 'b', 'c']);
  const promoted = tree.proofFor('c');
  promoted.proof[0].hash = '00'.repeat(32);
  assert.throws(() => verifyMerkleProof(tree.root, promoted), { code: 'INVALID_PROMOTION' });
  const direction = tree.proofFor('a');
  direction.proof[0].side = 'above';
  assert.throws(() => verifyMerkleProof(tree.root, direction), { code: 'INVALID_PROOF_DIRECTION' });
});

test('content-addressed store detects tampering when the same digest is re-added', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'btc-ai-artifact-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new ArtifactStore(root);
  const bytes = Buffer.from('original bytes');
  const record = await store.addBytes(bytes);
  await writeFile(join(store.objects, record.digest), Buffer.from('tampered bytes'));
  await assert.rejects(store.addBytes(bytes), { code: 'ARTIFACT_TAMPERED' });
});

test('local anchor rejects invalid roots and detects journal tampering', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'btc-ai-anchor-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await assert.rejects(appendLocalAnchor(root, '../bad'), { code: 'INVALID_COMMITMENT_ROOT' });
  await appendLocalAnchor(root, '11'.repeat(32));
  const journal = await readJson(join(root, 'anchors', 'local-journal.json'));
  journal.entries[0].root = '22'.repeat(32);
  assert.throws(() => verifyLocalJournal(journal), { code: 'LOCAL_ANCHOR_TAMPERED' });
});

test('explorer API verifies the complete local workspace', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'btc-ai-explorer-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const workspace = await new ProvenanceWorkspace(root).init();
  const actor = generateIdentity('actor');
  const artifact = await workspace.artifacts.addBytes(Buffer.from('artifact'));
  const receipt = createReceipt({ sequence: 0, action: 'artifact.registered', outputs: [artifact] }, actor);
  await workspace.saveReceipt(receipt);
  const batch = createBatch([receipt], actor, { batchNumber: 0 });
  await workspace.saveBatch(batch);
  await appendLocalAnchor(root, batch.envelope.statement.merkle.root);
  const server = createExplorerServer(workspace);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/workspace`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.valid, true);
  assert.equal(body.verification.artifacts, 'verified');
  assert.equal(body.verification.localAnchors, 'verified');
});
