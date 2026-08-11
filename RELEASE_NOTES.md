# Release 0.1.0

Released 2026-08-11.

## Outcome

This release replaces the earlier speculative five-crate sketch with a working Bitcoin-anchored AI provenance reference implementation.

## Verified release properties

- 28 unit, integration, and adversarial tests pass
- 23 JavaScript modules pass syntax validation
- Complete demo creates identities, artifacts, policy, action, lineage, batch, and local development anchor
- Workspace verifier independently checks signatures, lineage, artifacts, batches, proofs, and the local journal
- Bitcoin wallet RPC request and confirmation-verification paths pass mocked integration tests
- Secret scan and documentation-overclaim gates pass
- Runtime dependency count is zero

## External verification still required

- Live funded Bitcoin Core wallet testing was not available in the build environment
- No external cryptographic audit has been conducted
- High-value autonomous payment or custody use is not authorized by this release

## Research boundary

BitVM, ZKML, TEE execution, bonded data availability, legal ownership adjudication, and a decentralized L2 remain research tracks. This release does not include placeholder implementations for them.
