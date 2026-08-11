# Contributing

Contributions are welcome when they preserve the protocol's explicit trust boundary and include verifiable evidence.

## Development workflow

1. Use Node.js 22 or newer.
2. Create a focused branch from `main`.
3. State one falsifiable hypothesis for behavioral or security changes.
4. Add or strengthen an adversarial test.
5. Run `npm test` and `npm run gauntlet`.
6. Open a pull request using the repository template.

## Protocol changes

Changes to canonical serialization, signature domains, identifiers, policy semantics, Merkle construction, or Bitcoin commitment bytes require:

- An RFC update
- Compatibility analysis
- New test vectors
- A migration or explicit version boundary

Never weaken validation to preserve compatibility silently.

## Commit style

Use concise imperative messages such as:

- `harden Merkle proof validation`
- `document Bitcoin confirmation policy`
- `add C2PA export test vectors`

## Security

Do not open public issues containing secrets, private keys, exploitable transaction data, or confidential artifacts. Follow [SECURITY.md](SECURITY.md).
