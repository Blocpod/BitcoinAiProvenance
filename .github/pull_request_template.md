## Summary

Describe the protocol, implementation, or documentation change.

## Security impact

- Which trust assumptions or security claims change?
- Does this alter canonical bytes, signatures, identifiers, Merkle roots, policy evaluation, or Bitcoin commitments?

## Verification

- [ ] `npm test`
- [ ] `npm run gauntlet`
- [ ] New or changed behavior has an adversarial test
- [ ] Documentation distinguishes cryptographic integrity from factual or legal truth
- [ ] No secrets, private keys, or confidential artifact bytes are included

## Compatibility

Explain any impact on existing receipts, batches, anchors, or verifier behavior.
