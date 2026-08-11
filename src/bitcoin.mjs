import { invariant, ProtocolError } from './errors.mjs';

const MAGIC = Buffer.from('BAIP', 'ascii');
const VERSION = 1;

export function encodeCommitment(rootHex) {
  invariant(/^[0-9a-f]{64}$/.test(rootHex), 'INVALID_COMMITMENT_ROOT', 'Commitment root must be 32-byte lowercase hex');
  return Buffer.concat([MAGIC, Buffer.from([VERSION]), Buffer.from(rootHex, 'hex')]);
}

export function decodeCommitment(bytes) {
  invariant(bytes.length === 37, 'INVALID_COMMITMENT_LENGTH', 'BAIP commitment must be 37 bytes');
  invariant(bytes.subarray(0, 4).equals(MAGIC), 'INVALID_COMMITMENT_MAGIC', 'BAIP commitment magic is invalid');
  invariant(bytes[4] === VERSION, 'UNSUPPORTED_COMMITMENT_VERSION', 'Unsupported BAIP commitment version');
  return { version: bytes[4], root: bytes.subarray(5).toString('hex') };
}

export function encodeNullDataScript(payload) {
  invariant(payload.length <= 75, 'PAYLOAD_TOO_LARGE', 'Only direct-push OP_RETURN payloads are supported');
  return Buffer.concat([Buffer.from([0x6a, payload.length]), payload]).toString('hex');
}

export function decodeNullDataScript(scriptHex) {
  const script = Buffer.from(scriptHex, 'hex');
  invariant(script.length >= 2 && script[0] === 0x6a, 'NOT_NULL_DATA', 'Script is not OP_RETURN');
  const length = script[1];
  invariant(length <= 75 && script.length === length + 2, 'INVALID_NULL_DATA', 'Unsupported or malformed OP_RETURN push');
  return script.subarray(2);
}

export class BitcoinRpc {
  constructor({ url, username = '', password = '', fetchImpl = fetch }) {
    this.url = url;
    this.authorization = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
    this.fetchImpl = fetchImpl;
    this.id = 0;
  }

  async call(method, params = []) {
    const response = await this.fetchImpl(this.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: this.authorization },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++this.id, method, params }),
    });
    if (!response.ok) throw new ProtocolError('BITCOIN_RPC_HTTP', `Bitcoin RPC returned HTTP ${response.status}`);
    const body = await response.json();
    if (body.error) throw new ProtocolError('BITCOIN_RPC_ERROR', body.error.message, body.error);
    return body.result;
  }
}

export async function anchorBatch(rpc, rootHex, { expectedChain = 'signet', feeRateBtcKvB } = {}) {
  const chain = await rpc.call('getblockchaininfo');
  invariant(chain.chain === expectedChain, 'BITCOIN_CHAIN_MISMATCH', `Expected ${expectedChain}, connected to ${chain.chain}`);
  const payloadHex = encodeCommitment(rootHex).toString('hex');
  const raw = await rpc.call('createrawtransaction', [[], [{ data: payloadHex }]]);
  const fundOptions = feeRateBtcKvB ? { fee_rate: feeRateBtcKvB } : {};
  const funded = await rpc.call('fundrawtransaction', [raw, fundOptions]);
  const signed = await rpc.call('signrawtransactionwithwallet', [funded.hex]);
  invariant(signed.complete === true, 'BITCOIN_SIGNING_INCOMPLETE', 'Bitcoin wallet could not fully sign the anchor transaction');
  const txid = await rpc.call('sendrawtransaction', [signed.hex]);
  return { type: 'bitcoin', version: '1.0', chain: expectedChain, txid, root: rootHex, payloadHex, createdAt: new Date().toISOString() };
}

export async function verifyBitcoinAnchor(rpc, anchor, { minConfirmations = 1 } = {}) {
  const chain = await rpc.call('getblockchaininfo');
  invariant(chain.chain === anchor.chain, 'BITCOIN_CHAIN_MISMATCH', 'Anchor chain does not match connected Bitcoin chain');
  const tx = await rpc.call('getrawtransaction', [anchor.txid, true]);
  invariant((tx.confirmations ?? 0) >= minConfirmations, 'ANCHOR_NOT_FINAL', `Anchor has ${tx.confirmations ?? 0} confirmations; ${minConfirmations} required`);
  let found = false;
  for (const output of tx.vout ?? []) {
    try {
      const decoded = decodeCommitment(decodeNullDataScript(output.scriptPubKey.hex));
      if (decoded.root === anchor.root) found = true;
    } catch {}
  }
  invariant(found, 'ANCHOR_COMMITMENT_NOT_FOUND', 'Transaction does not contain the expected BAIP commitment');
  return { valid: true, chain: anchor.chain, txid: anchor.txid, confirmations: tx.confirmations, blockhash: tx.blockhash };
}
