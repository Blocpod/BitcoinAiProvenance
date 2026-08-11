import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify } from 'node:crypto';
import { canonicalBytes } from './canonical.mjs';
import { invariant } from './errors.mjs';

export function sha256Bytes(bytes) {
  return createHash('sha256').update(bytes).digest();
}

export function sha256Hex(bytes) {
  return sha256Bytes(bytes).toString('hex');
}

export function objectDigest(value, domain = 'btc-ai:object:v1') {
  return sha256Hex(Buffer.concat([Buffer.from(`${domain}\0`, 'utf8'), canonicalBytes(value)]));
}

export function generateIdentity(label = '') {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  return { label, keyId: keyIdFromPublicKey(publicKeyPem), publicKeyPem, privateKeyPem };
}

export function keyIdFromPublicKey(publicKeyPem) {
  const der = createPublicKey(publicKeyPem).export({ type: 'spki', format: 'der' });
  return `ed25519:${sha256Hex(der)}`;
}

export function signObject(value, privateKeyPem, domain) {
  const message = Buffer.concat([Buffer.from(`${domain}\0`, 'utf8'), canonicalBytes(value)]);
  return sign(null, message, createPrivateKey(privateKeyPem)).toString('base64url');
}

export function verifyObject(value, signature, publicKeyPem, domain) {
  const message = Buffer.concat([Buffer.from(`${domain}\0`, 'utf8'), canonicalBytes(value)]);
  try {
    return verify(null, message, createPublicKey(publicKeyPem), Buffer.from(signature, 'base64url'));
  } catch {
    return false;
  }
}

export function assertKeyIdentity(keyId, publicKeyPem) {
  invariant(keyIdFromPublicKey(publicKeyPem) === keyId, 'KEY_ID_MISMATCH', 'Public key does not match keyId');
}
