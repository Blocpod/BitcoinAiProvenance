import { sha256Bytes } from './crypto.mjs';
import { invariant } from './errors.mjs';

const LEAF_DOMAIN = Buffer.from('btc-ai:merkle-leaf:v1\0');
const NODE_DOMAIN = Buffer.from('btc-ai:merkle-node:v1\0');

function assertHash(hash) {
  invariant(Buffer.isBuffer(hash) && hash.length === 32, 'INVALID_MERKLE_HASH', 'Merkle hashes must be 32 bytes');
}

export function hashLeaf(value) {
  return sha256Bytes(Buffer.concat([LEAF_DOMAIN, Buffer.from(value, 'utf8')]));
}

export function hashNode(left, right) {
  assertHash(left);
  assertHash(right);
  return sha256Bytes(Buffer.concat([NODE_DOMAIN, left, right]));
}

export function buildMerkleTree(values) {
  invariant(Array.isArray(values) && values.length > 0, 'EMPTY_MERKLE_TREE', 'Merkle tree requires at least one value');
  invariant(values.every((value) => typeof value === 'string' && value.length > 0), 'INVALID_MERKLE_LEAF', 'Merkle leaves must be non-empty strings');
  invariant(new Set(values).size === values.length, 'DUPLICATE_MERKLE_LEAF', 'Merkle leaves must be unique');
  const leaves = [...values].sort();
  const levels = [leaves.map(hashLeaf)];
  while (levels.at(-1).length > 1) {
    const previous = levels.at(-1);
    const next = [];
    for (let index = 0; index < previous.length; index += 2) {
      next.push(index + 1 < previous.length ? hashNode(previous[index], previous[index + 1]) : previous[index]);
    }
    levels.push(next);
  }
  const root = levels.at(-1)[0].toString('hex');
  function proofFor(value) {
    let index = leaves.indexOf(value);
    invariant(index >= 0, 'LEAF_NOT_FOUND', 'Value is not in the Merkle tree');
    const proof = [];
    for (let level = 0; level < levels.length - 1; level += 1) {
      const nodes = levels[level];
      const siblingIndex = index % 2 === 0 ? index + 1 : index - 1;
      if (siblingIndex < nodes.length) {
        proof.push({ side: siblingIndex < index ? 'left' : 'right', hash: nodes[siblingIndex].toString('hex') });
      } else {
        proof.push({ side: 'promote' });
      }
      index = Math.floor(index / 2);
    }
    return { value, index: leaves.indexOf(value), leafCount: leaves.length, proof };
  }
  return { root, leaves, proofFor };
}

export function verifyMerkleProof(rootHex, inclusion) {
  invariant(/^[0-9a-f]{64}$/.test(rootHex), 'INVALID_MERKLE_ROOT', 'Merkle root must be lowercase hex');
  invariant(Number.isSafeInteger(inclusion.leafCount) && inclusion.leafCount > 0 && Array.isArray(inclusion.proof), 'INVALID_MERKLE_PROOF', 'Malformed Merkle inclusion proof');
  invariant(Number.isSafeInteger(inclusion.index) && inclusion.index >= 0 && inclusion.index < inclusion.leafCount, 'INVALID_PROOF_INDEX', 'Merkle proof index is out of range');
  let hash = hashLeaf(inclusion.value);
  let index = inclusion.index;
  let width = inclusion.leafCount;
  for (const step of inclusion.proof) {
    if (step.side === 'promote') {
      invariant(index === width - 1 && width % 2 === 1, 'INVALID_PROMOTION', 'Invalid Merkle promotion step');
      invariant(step.hash === undefined, 'INVALID_PROMOTION', 'Promotion steps must not contain a sibling hash');
    } else {
      invariant(step.side === 'left' || step.side === 'right', 'INVALID_PROOF_DIRECTION', 'Unknown Merkle proof direction');
      invariant(/^[0-9a-f]{64}$/.test(step.hash), 'INVALID_PROOF_HASH', 'Invalid Merkle proof hash');
      const sibling = Buffer.from(step.hash, 'hex');
      invariant((step.side === 'left') === (index % 2 === 1), 'INVALID_PROOF_DIRECTION', 'Merkle proof direction is inconsistent with index');
      hash = step.side === 'left' ? hashNode(sibling, hash) : hashNode(hash, sibling);
    }
    index = Math.floor(index / 2);
    width = Math.ceil(width / 2);
  }
  invariant(width === 1 && inclusion.proof.length === Math.ceil(Math.log2(inclusion.leafCount)), 'INVALID_PROOF_HEIGHT', 'Merkle proof has an invalid height');
  return hash.toString('hex') === rootHex;
}
