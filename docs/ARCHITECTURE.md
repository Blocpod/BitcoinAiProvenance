# Architecture

## Trust boundary

The protocol separates statements, artifacts, aggregation, and Bitcoin anchoring.

1. An actor signs a canonical statement.
2. The statement digest becomes its stable identifier.
3. Receipts reference earlier signed statement identifiers and content-addressed artifacts.
4. An aggregator sorts receipt identifiers and builds a domain-separated Merkle tree.
5. The aggregator signs the complete batch manifest.
6. A 37-byte payload commits the batch root in a Bitcoin `OP_RETURN` output.
7. A verifier independently checks signatures, lineage, artifact digests, Merkle proofs, transaction contents, chain identity, and confirmation depth.

## Signed envelope

Every signed object has four fields:

```json
{
  "statementId": "sha256:<digest>",
  "statement": {},
  "signer": {
    "algorithm": "ed25519",
    "keyId": "ed25519:<spki-digest>",
    "publicKeyPem": "..."
  },
  "signature": "<base64url>"
}
```

The statement identifier is domain-separated from the signature envelope. The signature covers the statement, identifier, and signer metadata.

## Bitcoin payload

The version 1 payload is 37 bytes:

| Field | Bytes |
| --- | ---: |
| Magic `BAIP` | 4 |
| Version | 1 |
| Merkle root | 32 |

The payload fits within a simple direct-push `OP_RETURN` script. No spendable anchor UTXO is created and no public payload is mistaken for a spending condition.

## Local development anchor

The offline journal is a hash chain used only for demos and tests. Every returned local anchor contains an explicit warning. It is not interchangeable with a Bitcoin anchor.

## Future compatibility

The signed envelope can carry C2PA, in-toto, SLSA, W3C PROV, TEE-attestation, and proof-system references through versioned claims. Verification of those extensions must be implemented before a verifier reports them as valid.
