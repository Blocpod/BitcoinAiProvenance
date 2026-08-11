import test from 'node:test';
import assert from 'node:assert/strict';
import { BitcoinRpc, anchorBatch, decodeCommitment, decodeNullDataScript, encodeCommitment, encodeNullDataScript, verifyBitcoinAnchor } from '../src/bitcoin.mjs';

test('BAIP payload roundtrips through canonical OP_RETURN script', () => {
  const root = 'ab'.repeat(32);
  const payload = encodeCommitment(root);
  assert.equal(payload.length, 37);
  assert.equal(decodeCommitment(decodeNullDataScript(encodeNullDataScript(payload))).root, root);
});

test('Bitcoin anchoring uses wallet RPC pipeline and verifies inclusion', async () => {
  const root = '11'.repeat(32);
  const calls = [];
  const fetchImpl = async (_url, request) => {
    const body = JSON.parse(request.body); calls.push(body);
    const responses = {
      getblockchaininfo: { chain: 'signet' }, createrawtransaction: 'raw', fundrawtransaction: { hex: 'funded' },
      signrawtransactionwithwallet: { hex: 'signed', complete: true }, sendrawtransaction: 'aa'.repeat(32),
      getrawtransaction: { confirmations: 6, blockhash: 'bb'.repeat(32), vout: [{ scriptPubKey: { hex: encodeNullDataScript(encodeCommitment(root)) } }] },
    };
    return { ok: true, json: async () => ({ result: responses[body.method], error: null }) };
  };
  const rpc = new BitcoinRpc({ url: 'http://127.0.0.1:38332', fetchImpl });
  const anchor = await anchorBatch(rpc, root, { expectedChain: 'signet' });
  const verdict = await verifyBitcoinAnchor(rpc, anchor, { minConfirmations: 6 });
  assert.equal(verdict.valid, true);
  assert.deepEqual(calls.slice(0, 5).map((call) => call.method), ['getblockchaininfo', 'createrawtransaction', 'fundrawtransaction', 'signrawtransactionwithwallet', 'sendrawtransaction']);
});

test('anchor verification rejects missing payload and insufficient confirmations', async () => {
  const root = '22'.repeat(32);
  const makeRpc = (confirmations, scriptHex) => ({ call: async (method) => method === 'getblockchaininfo' ? { chain: 'signet' } : { confirmations, vout: [{ scriptPubKey: { hex: scriptHex } }] } });
  const anchor = { chain: 'signet', txid: 'x', root };
  await assert.rejects(verifyBitcoinAnchor(makeRpc(0, encodeNullDataScript(encodeCommitment(root))), anchor), { code: 'ANCHOR_NOT_FINAL' });
  await assert.rejects(verifyBitcoinAnchor(makeRpc(6, encodeNullDataScript(encodeCommitment('33'.repeat(32)))), anchor), { code: 'ANCHOR_COMMITMENT_NOT_FOUND' });
});
