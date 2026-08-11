# Roadmap and Research Gates

## Release 0.1: complete in this package

- Signed provenance receipts
- Content-addressed artifacts
- Agent policy evaluator
- Merkle batches and proofs
- Bitcoin Core RPC anchor and verifier
- CLI, explorer, demo, and gauntlet

## Release 0.2: interoperability

- DSSE and in-toto statement adapter
- SLSA model-build provenance predicate
- C2PA assertion adapter for media outputs
- W3C PROV export
- DID or certificate-backed organizational identity
- Key rotation and revocation receipts

## Release 0.3: operational hardening

- Transactional policy-state service
- Transparency-log consistency proofs
- Independent witness cosigning
- Artifact replication and retention monitoring
- Prometheus/OpenTelemetry instrumentation
- External security audit

## Research track: verifiable computation

Before any ZKML implementation is accepted, the project must define the precise relation being proven, model and quantization commitments, preprocessing, decoding, nondeterminism, proof-system setup, resource bounds, and verifier security.

## Research track: Bitcoin disputes

BitVM integration requires a complete proof relation, official transaction-graph primitives, setup assumptions, connector construction, challenger economics, liveness analysis, and independent audit. A NAND-script fragment is not an acceptable substitute.

## Research track: data availability

A bonded storage network requires erasure coding, replication, repair, provider selection, unbiased challenge derivation, proof probability targets, payment enforcement, slashing finality, and recovery from mass provider failure.
