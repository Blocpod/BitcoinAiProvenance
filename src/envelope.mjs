import { objectDigest, signObject, verifyObject, assertKeyIdentity } from './crypto.mjs';
import { invariant } from './errors.mjs';

export const ENVELOPE_DOMAIN = 'btc-ai:signed-envelope:v1';

export function issueEnvelope(statement, identity) {
  invariant(statement && typeof statement === 'object', 'INVALID_STATEMENT', 'Statement must be an object');
  assertKeyIdentity(identity.keyId, identity.publicKeyPem);
  const statementId = `sha256:${objectDigest(statement, 'btc-ai:statement:v1')}`;
  const signed = { statementId, statement, signer: { algorithm: 'ed25519', keyId: identity.keyId, publicKeyPem: identity.publicKeyPem } };
  return { ...signed, signature: signObject(signed, identity.privateKeyPem, ENVELOPE_DOMAIN) };
}

export function verifyEnvelope(envelope) {
  invariant(envelope && typeof envelope === 'object', 'INVALID_ENVELOPE', 'Envelope must be an object');
  invariant(envelope.signer?.algorithm === 'ed25519', 'UNSUPPORTED_SIGNATURE', 'Only Ed25519 signatures are supported');
  assertKeyIdentity(envelope.signer.keyId, envelope.signer.publicKeyPem);
  const expectedId = `sha256:${objectDigest(envelope.statement, 'btc-ai:statement:v1')}`;
  invariant(envelope.statementId === expectedId, 'STATEMENT_ID_MISMATCH', 'Statement digest does not match statementId');
  const signed = { statementId: envelope.statementId, statement: envelope.statement, signer: envelope.signer };
  invariant(verifyObject(signed, envelope.signature, envelope.signer.publicKeyPem, ENVELOPE_DOMAIN), 'INVALID_SIGNATURE', 'Envelope signature verification failed');
  return true;
}
