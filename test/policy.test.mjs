import test from 'node:test';
import assert from 'node:assert/strict';
import { generateIdentity } from '../src/crypto.mjs';
import { createAgentAction, createPolicy, evaluateAgentAction } from '../src/policy.mjs';

function fixture() {
  const authority = generateIdentity('authority');
  const agent = generateIdentity('agent');
  const policy = createPolicy({
    policyId: 'p1', sessionKeyId: agent.keyId, validFrom: '2026-08-11T00:00:00.000Z', validUntil: '2026-08-12T00:00:00.000Z',
    maxDailySpendSats: '100', maxActionsPerDay: 2, allowedModels: ['sha256:model'], allowedTools: ['infer'], allowedTargets: ['project:a'],
  }, authority);
  return { authority, agent, policy };
}

function action(f, overrides = {}) {
  return createAgentAction({ policyStatementId: f.policy.statementId, nonce: 1, timestamp: '2026-08-11T12:00:00.000Z', modelId: 'sha256:model', tool: 'infer', target: 'project:a', spendSats: '40', requestDigest: 'sha256:req', ...overrides }, f.agent);
}

test('authorized session action updates nonce and daily counters', () => {
  const f = fixture();
  const state = evaluateAgentAction(f.policy, action(f), {}, { now: new Date('2026-08-11T12:01:00.000Z') });
  assert.equal(state.lastNonce, 1);
  assert.deepEqual(state.days['2026-08-11'], { spendSats: '40', actions: 1 });
});

test('policy rejects replay, budget excess, wrong model/tool/target, and wrong session', () => {
  const f = fixture();
  const first = action(f);
  const state = evaluateAgentAction(f.policy, first, {}, { now: new Date('2026-08-11T12:01:00.000Z') });
  assert.throws(() => evaluateAgentAction(f.policy, first, state, { now: new Date('2026-08-11T12:01:00.000Z') }), { code: 'NONCE_REPLAY' });
  assert.throws(() => evaluateAgentAction(f.policy, action(f, { nonce: 2, spendSats: '61' }), state, { now: new Date('2026-08-11T12:01:00.000Z') }), { code: 'SPEND_LIMIT_EXCEEDED' });
  assert.throws(() => evaluateAgentAction(f.policy, action(f, { modelId: 'other' }), {}, { now: new Date('2026-08-11T12:01:00.000Z') }), { code: 'UNAUTHORIZED_MODEL' });
  assert.throws(() => evaluateAgentAction(f.policy, action(f, { tool: 'shell' }), {}, { now: new Date('2026-08-11T12:01:00.000Z') }), { code: 'UNAUTHORIZED_TOOL' });
  assert.throws(() => evaluateAgentAction(f.policy, action(f, { target: 'project:b' }), {}, { now: new Date('2026-08-11T12:01:00.000Z') }), { code: 'UNAUTHORIZED_TARGET' });
  const attacker = generateIdentity('attacker');
  const stolen = createAgentAction({ policyStatementId: f.policy.statementId, nonce: 2, timestamp: '2026-08-11T12:00:00.000Z', modelId: 'sha256:model', tool: 'infer', target: 'project:a', spendSats: '1', requestDigest: 'sha256:req' }, attacker);
  assert.throws(() => evaluateAgentAction(f.policy, stolen, {}, { now: new Date('2026-08-11T12:01:00.000Z') }), { code: 'UNAUTHORIZED_SESSION' });
});

test('policy treats satoshi amounts as lossless integers', () => {
  const f = fixture();
  assert.throws(() => createAgentAction({ policyStatementId: f.policy.statementId, nonce: 1, modelId: 'x', tool: 'x', target: 'x', spendSats: '1.5', requestDigest: 'x' }, f.agent), { code: 'INVALID_SATS' });
});
