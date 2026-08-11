# Threat Model

## Security claims in version 0.1

| Claim | Mechanism | Limitation |
| --- | --- | --- |
| Statement integrity | SHA-256 digest and Ed25519 signature | A signer can make a false statement |
| Signer-key binding | Key ID derived from SPKI bytes | Key ownership and human identity are external |
| Artifact integrity | SHA-256 content addressing | Availability and legal rights are not guaranteed |
| Lineage integrity | Signed parent identifiers and cycle detection | Omitted ancestors cannot be discovered automatically |
| Agent authorization | Signed policy, session-key binding, nonce, time and quota checks | Requires durable, atomic policy state in production |
| Batch inclusion | Domain-separated Merkle proof | Aggregator may omit receipts |
| Bitcoin ordering | Confirmed transaction containing BAIP root | Bitcoin does not validate receipt semantics |

## Defended attacks

- Modified statements or signatures
- Public-key substitution
- Duplicate or malformed Merkle leaves
- Incorrect proof direction, height, promotion, or index
- Artifact-byte modification
- Agent action replay
- Session-key substitution
- Unauthorized model, tool, or target use
- Daily spend and action-limit overflow
- Wrong Bitcoin network
- Missing commitment payload
- Insufficient Bitcoin confirmations
- Workspace path traversal through artifact identifiers

## Out of scope

- Malicious but correctly authenticated actors
- Private-key compromise
- Side-channel attacks
- False TEE measurements
- Model correctness and nondeterminism
- Training-data legality
- Legal title, copyright, or ownership
- Censorship by an aggregator or Bitcoin miner
- Permanent artifact availability
- Bitcoin consensus failures
- Quantum-resistant signatures

## Required production controls

- Hardware-backed or managed keys with rotation and revocation
- Independent timestamp and Bitcoin observers
- Durable transactional storage for policy state
- Receipt transparency monitoring for omission detection
- Artifact replication, repair, and retention policies
- Privacy review before committing sensitive metadata
- External cryptographic and application-security audits
