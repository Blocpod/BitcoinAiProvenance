#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { generateIdentity, sha256Hex } from '../src/crypto.mjs';
import { ProvenanceWorkspace } from '../src/workspace.mjs';
import { createPolicy, createAgentAction, evaluateAgentAction } from '../src/policy.mjs';
import { createReceipt, verifyLineage, verifyReceipt } from '../src/receipts.mjs';
import { createBatch, verifyBatch } from '../src/batches.mjs';
import { appendLocalAnchor, verifyLocalJournal } from '../src/local-anchor.mjs';
import { BitcoinRpc, anchorBatch, verifyBitcoinAnchor } from '../src/bitcoin.mjs';
import { createExplorerServer } from '../src/explorer.mjs';
import { readJson, safeChildPath, writeJsonAtomic } from '../src/fs-util.mjs';
import { ProtocolError } from '../src/errors.mjs';

function parseArgs(argv) {
  const positional = [];
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) positional.push(token);
    else {
      const key = token.slice(2);
      const next = argv[index + 1];
      if (next && !next.startsWith('--')) { options[key] = next; index += 1; }
      else options[key] = true;
    }
  }
  return { positional, options };
}

function required(options, key) {
  if (typeof options[key] !== 'string' || options[key].length === 0) throw new ProtocolError('MISSING_ARGUMENT', `--${key} is required`);
  return options[key];
}

function listOption(options, key) {
  return String(required(options, key)).split(',').map((value) => value.trim()).filter(Boolean);
}

function output(value) { process.stdout.write(`${JSON.stringify(value, null, 2)}\n`); }

async function demo(root) {
  const workspace = await new ProvenanceWorkspace(root).init();
  const authority = generateIdentity('Demo Authority');
  const agent = generateIdentity('Demo Agent');
  await workspace.saveIdentity('authority', authority);
  await workspace.saveIdentity('agent', agent);
  const model = await workspace.artifacts.addBytes(Buffer.from('deterministic-demo-model-v1'), { name: 'model.bin', mediaType: 'application/vnd.demo.model' });
  const prompt = await workspace.artifacts.addBytes(Buffer.from('Create a verified project assessment.'), { name: 'prompt.txt', mediaType: 'text/plain' });
  const result = await workspace.artifacts.addBytes(Buffer.from('Verified assessment output.'), { name: 'result.txt', mediaType: 'text/plain' });
  const now = new Date();
  const policy = createPolicy({
    policyId: 'demo-policy-v1', sessionKeyId: agent.keyId, validFrom: new Date(now.valueOf() - 60_000).toISOString(),
    validUntil: new Date(now.valueOf() + 86_400_000).toISOString(), maxDailySpendSats: '10000', maxActionsPerDay: 10,
    allowedModels: [model.id], allowedTools: ['artifact.generate'], allowedTargets: ['workspace:demo'],
  }, authority);
  await workspace.savePolicy(policy);
  const action = createAgentAction({
    policyStatementId: policy.statementId, nonce: 1, modelId: model.id, tool: 'artifact.generate', target: 'workspace:demo', spendSats: '25', requestDigest: prompt.id,
  }, agent);
  const policyState = evaluateAgentAction(policy, action);
  await writeJsonAtomic(join(workspace.state, 'demo-agent.json'), policyState);
  const inputReceipt = createReceipt({ sequence: 0, action: 'artifact.registered', role: 'authority', inputs: [], outputs: [model, prompt], claims: { purpose: 'demo-inputs' } }, authority);
  await workspace.saveReceipt(inputReceipt);
  const outputReceipt = createReceipt({
    sequence: 1, action: 'agent.inference.completed', parents: [inputReceipt.statementId], inputs: [model, prompt], outputs: [result],
    execution: { actionStatementId: action.statementId, modelId: model.id, tool: 'artifact.generate' }, policy: policy.statementId,
  }, agent);
  await workspace.saveReceipt(outputReceipt);
  const receipts = [inputReceipt, outputReceipt];
  const lineage = verifyLineage(receipts);
  const batch = createBatch(receipts, authority, { namespace: 'demo', batchNumber: 0 });
  verifyBatch(batch, receipts);
  await workspace.saveBatch(batch);
  const anchor = await appendLocalAnchor(root, batch.envelope.statement.merkle.root);
  const journal = await readJson(join(workspace.anchors, 'local-journal.json'));
  verifyLocalJournal(journal);
  return { workspace: root, valid: true, warning: 'Demo uses a local development journal. Configure Bitcoin Core RPC for a real Bitcoin anchor.', identities: { authority: authority.keyId, agent: agent.keyId }, policy: policy.statementId, action: action.statementId, lineage, batch: { id: batch.envelope.statementId, root: batch.envelope.statement.merkle.root }, anchor };
}

async function main() {
  const { positional, options } = parseArgs(process.argv.slice(2));
  const [command, subcommand] = positional;
  const root = resolve(String(options.workspace ?? './btc-ai-workspace'));
  const workspace = new ProvenanceWorkspace(root);
  if (command === 'init') { await workspace.init(); output({ initialized: root }); return; }
  if (command === 'demo') { output(await demo(root)); return; }
  if (command === 'keygen') {
    await workspace.init(); const name = required(options, 'name'); const identity = generateIdentity(String(options.label ?? name)); await workspace.saveIdentity(name, identity); output({ name, keyId: identity.keyId }); return;
  }
  if (command === 'artifact' && subcommand === 'add') {
    const record = await workspace.artifacts.addFile(resolve(required(options, 'file')), { name: options.name, mediaType: String(options['media-type'] ?? 'application/octet-stream') }); output(record); return;
  }
  if (command === 'receipt' && subcommand === 'verify') {
    const receipt = await readJson(resolve(required(options, 'file'))); verifyReceipt(receipt); output({ valid: true, statementId: receipt.statementId }); return;
  }
  if (command === 'workspace' && subcommand === 'verify') {
    const snapshot = await workspace.inspect(); const lineage = verifyLineage(snapshot.receipts); const receiptById = new Map(snapshot.receipts.map((receipt) => [receipt.statementId, receipt])); for (const batch of snapshot.batches) verifyBatch(batch, batch.envelope.statement.receiptIds.map((id) => receiptById.get(id)).filter(Boolean)); for (const metadata of await workspace.loadJsonFiles(workspace.artifacts.metadata)) await workspace.artifacts.verify(metadata); for (const anchor of snapshot.anchors.filter((entry) => entry.type === 'local-development-anchor')) verifyLocalJournal(anchor); output({ valid: true, lineage, batches: snapshot.batches.length, artifacts: snapshot.artifactCount, localAnchors: 'verified', bitcoinAnchors: 'verify separately with Bitcoin RPC' }); return;
  }
  if (command === 'batch' && subcommand === 'build') {
    const identity = await workspace.loadIdentity(required(options, 'key')); const receipts = await workspace.loadJsonFiles(workspace.receipts); const batch = createBatch(receipts, identity, { namespace: String(options.namespace ?? 'default'), batchNumber: Number(options.number ?? 0), previousBatchId: options.previous ?? null }); const path = await workspace.saveBatch(batch); output({ path, statementId: batch.envelope.statementId, root: batch.envelope.statement.merkle.root }); return;
  }
  if (command === 'anchor' && subcommand === 'local') {
    const anchor = await appendLocalAnchor(root, required(options, 'root')); output(anchor); return;
  }
  if (command === 'anchor' && subcommand === 'bitcoin') {
    const rpc = new BitcoinRpc({ url: required(options, 'rpc-url'), username: String(options['rpc-user'] ?? process.env.BITCOIN_RPC_USER ?? ''), password: String(options['rpc-password'] ?? process.env.BITCOIN_RPC_PASSWORD ?? '') }); const anchor = await anchorBatch(rpc, required(options, 'root'), { expectedChain: String(options.chain ?? 'signet') }); await workspace.saveAnchor(anchor); output(anchor); return;
  }
  if (command === 'anchor' && subcommand === 'verify-bitcoin') {
    const anchor = await readJson(resolve(required(options, 'file'))); const rpc = new BitcoinRpc({ url: required(options, 'rpc-url'), username: String(options['rpc-user'] ?? process.env.BITCOIN_RPC_USER ?? ''), password: String(options['rpc-password'] ?? process.env.BITCOIN_RPC_PASSWORD ?? '') }); output(await verifyBitcoinAnchor(rpc, anchor, { minConfirmations: Number(options.confirmations ?? 1) })); return;
  }
  if (command === 'serve') {
    const port = Number(options.port ?? 8787); const server = createExplorerServer(workspace); server.listen(port, '127.0.0.1', () => process.stdout.write(`Explorer: http://127.0.0.1:${port}\n`)); return;
  }
  process.stdout.write(`btc-ai-provenance-core\n\nCommands:\n  init --workspace DIR\n  demo --workspace DIR\n  keygen --workspace DIR --name NAME\n  artifact add --workspace DIR --file FILE [--media-type TYPE]\n  receipt verify --file FILE\n  workspace verify --workspace DIR\n  batch build --workspace DIR --key NAME [--number N]\n  anchor local --workspace DIR --root HEX\n  anchor bitcoin --workspace DIR --root HEX --rpc-url URL [--chain signet]\n  anchor verify-bitcoin --file ANCHOR --rpc-url URL [--confirmations 6]\n  serve --workspace DIR [--port 8787]\n`);
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ ok: false, code: error.code ?? 'INTERNAL', error: error.message, details: error.details }, null, 2)}\n`);
  process.exitCode = 1;
});
