import { issueEnvelope, verifyEnvelope } from './envelope.mjs';
import { invariant } from './errors.mjs';

const POLICY_TYPE = 'org.blockpod.btc-ai.agent-policy';
const ACTION_TYPE = 'org.blockpod.btc-ai.agent-action';

function normalizeList(values, field) {
  invariant(Array.isArray(values), 'INVALID_POLICY', `${field} must be an array`);
  const result = [...values].sort();
  invariant(new Set(result).size === result.length, 'INVALID_POLICY', `${field} must not contain duplicates`);
  return result;
}

function parseSats(value, field) {
  invariant(typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value), 'INVALID_SATS', `${field} must be a non-negative decimal string`);
  return BigInt(value);
}

export function createPolicy(input, authority) {
  invariant(input.sessionKeyId?.startsWith('ed25519:'), 'INVALID_POLICY', 'sessionKeyId is required');
  const validFrom = input.validFrom ?? new Date().toISOString();
  invariant(!Number.isNaN(Date.parse(validFrom)) && !Number.isNaN(Date.parse(input.validUntil)), 'INVALID_POLICY_TIME', 'Policy validity timestamps are invalid');
  invariant(Date.parse(input.validUntil) > Date.parse(validFrom), 'INVALID_POLICY_TIME', 'Policy validUntil must follow validFrom');
  parseSats(input.maxDailySpendSats, 'maxDailySpendSats');
  invariant(Number.isSafeInteger(input.maxActionsPerDay) && input.maxActionsPerDay > 0, 'INVALID_POLICY', 'maxActionsPerDay must be positive');
  return issueEnvelope({
    type: POLICY_TYPE,
    version: '1.0',
    policyId: input.policyId,
    namespace: input.namespace ?? 'default',
    authorityKeyId: authority.keyId,
    sessionKeyId: input.sessionKeyId,
    validFrom,
    validUntil: input.validUntil,
    maxDailySpendSats: input.maxDailySpendSats,
    maxActionsPerDay: input.maxActionsPerDay,
    allowedModels: normalizeList(input.allowedModels, 'allowedModels'),
    allowedTools: normalizeList(input.allowedTools, 'allowedTools'),
    allowedTargets: normalizeList(input.allowedTargets, 'allowedTargets'),
  }, authority);
}

export function createAgentAction(input, sessionIdentity) {
  invariant(Number.isSafeInteger(input.nonce) && input.nonce >= 0, 'INVALID_NONCE', 'Action nonce must be a non-negative safe integer');
  parseSats(input.spendSats, 'spendSats');
  return issueEnvelope({
    type: ACTION_TYPE,
    version: '1.0',
    policyStatementId: input.policyStatementId,
    sessionKeyId: sessionIdentity.keyId,
    nonce: input.nonce,
    timestamp: input.timestamp ?? new Date().toISOString(),
    modelId: input.modelId,
    tool: input.tool,
    target: input.target,
    spendSats: input.spendSats,
    requestDigest: input.requestDigest,
  }, sessionIdentity);
}

function utcDay(timestamp) {
  const date = new Date(timestamp);
  invariant(!Number.isNaN(date.valueOf()), 'INVALID_ACTION_TIME', 'Action timestamp is invalid');
  return date.toISOString().slice(0, 10);
}

export function evaluateAgentAction(policyEnvelope, actionEnvelope, state = {}, { now = new Date() } = {}) {
  verifyEnvelope(policyEnvelope);
  verifyEnvelope(actionEnvelope);
  const policy = policyEnvelope.statement;
  const action = actionEnvelope.statement;
  invariant(policy.type === POLICY_TYPE && action.type === ACTION_TYPE, 'WRONG_STATEMENT_TYPE', 'Expected policy and action statements');
  invariant(policy.authorityKeyId === policyEnvelope.signer.keyId, 'POLICY_AUTHORITY_MISMATCH', 'Policy authority is not the signer');
  invariant(action.sessionKeyId === actionEnvelope.signer.keyId, 'SESSION_SIGNER_MISMATCH', 'Action session key is not the signer');
  invariant(policy.sessionKeyId === action.sessionKeyId, 'UNAUTHORIZED_SESSION', 'Session key is not authorized by policy');
  invariant(action.policyStatementId === policyEnvelope.statementId, 'POLICY_REFERENCE_MISMATCH', 'Action references a different policy');
  const timestamp = Date.parse(action.timestamp);
  invariant(timestamp >= Date.parse(policy.validFrom) && timestamp <= Date.parse(policy.validUntil), 'POLICY_EXPIRED', 'Action falls outside policy validity');
  invariant(timestamp <= now.valueOf() + 5 * 60_000, 'ACTION_FROM_FUTURE', 'Action timestamp is too far in the future');
  invariant(policy.allowedModels.includes(action.modelId), 'UNAUTHORIZED_MODEL', 'Model is not allowed');
  invariant(policy.allowedTools.includes(action.tool), 'UNAUTHORIZED_TOOL', 'Tool is not allowed');
  invariant(policy.allowedTargets.includes(action.target), 'UNAUTHORIZED_TARGET', 'Target is not allowed');
  const day = utcDay(action.timestamp);
  const previousNonce = state.lastNonce ?? -1;
  invariant(action.nonce > previousNonce, 'NONCE_REPLAY', 'Action nonce must strictly increase');
  const bucket = state.days?.[day] ?? { spendSats: '0', actions: 0 };
  const nextSpend = parseSats(bucket.spendSats, 'state spend') + parseSats(action.spendSats, 'spendSats');
  invariant(nextSpend <= parseSats(policy.maxDailySpendSats, 'maxDailySpendSats'), 'SPEND_LIMIT_EXCEEDED', 'Daily spend limit exceeded');
  invariant(bucket.actions + 1 <= policy.maxActionsPerDay, 'ACTION_LIMIT_EXCEEDED', 'Daily action limit exceeded');
  return {
    lastNonce: action.nonce,
    days: { ...(state.days ?? {}), [day]: { spendSats: nextSpend.toString(), actions: bucket.actions + 1 } },
  };
}
