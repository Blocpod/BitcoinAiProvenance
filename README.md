# BTC AI Provenance Core

[![CI](https://github.com/Blocpod/BitcoinAiProvenance/actions/workflows/ci.yml/badge.svg)](https://github.com/Blocpod/BitcoinAiProvenance/actions/workflows/ci.yml)
[![Node.js 22+](https://img.shields.io/badge/Node.js-22%2B-5FA04E)](https://nodejs.org/)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

BTC AI Provenance Core is a working reference implementation for Bitcoin-anchored AI provenance receipts and bounded autonomous-agent actions.

It answers four independently verifiable questions:

1. What artifact or action was asserted?
2. Which cryptographic identity signed the assertion?
3. What earlier receipts and artifacts does it depend on?
4. Was the resulting batch root committed in a confirmed Bitcoin transaction?

Bitcoin proves commitment and ordering. It does not prove that an assertion is factually or legally true. See [THREAT_MODEL.md](docs/THREAT_MODEL.md).

## Implemented

- Ed25519 identities and domain-separated signed envelopes
- Deterministic canonical JSON with strict input rejection
- SHA-256 content-addressed artifact storage
- Signed provenance receipts and cycle-checked lineage graphs
- Signed agent policies with session-key binding
- Strictly increasing nonces and replay prevention
- Exact satoshi accounting with decimal strings
- Model, tool, target, daily-spend, and action-count enforcement
- Domain-separated Merkle batching, including odd-width trees
- Inclusion proofs for every receipt
- Compact 37-byte BAIP Bitcoin commitment payloads
- Bitcoin Core wallet RPC anchoring and confirmation verification
- Hash-chained local development journal for offline demonstrations
- Dependency-free CLI and local provenance explorer
- Unit, integration, adversarial, determinism, and release gauntlets

## Deliberately not claimed

This release is not a rollup, decentralized storage network, ZKML prover, or BitVM bridge. Those features require additional protocols and audits. They are documented as research tracks rather than represented by placeholder code.

## Requirements

- Node.js 22 or newer
- Optional: Bitcoin Core with a funded wallet for real Signet, testnet, regtest, or mainnet anchoring

There are no third-party runtime dependencies.

## Quick start

```bash
npm test
npm run gauntlet
node bin/btc-ai.mjs demo --workspace ./demo-workspace
node bin/btc-ai.mjs workspace verify --workspace ./demo-workspace
node bin/btc-ai.mjs serve --workspace ./demo-workspace --port 8787
```

Open `http://127.0.0.1:8787` to inspect the local lineage.

The demo intentionally uses a local hash-chained development journal. It never labels that journal as a Bitcoin anchor.

## Real Bitcoin anchor

First build a batch and capture its root:

```bash
node bin/btc-ai.mjs batch build \
  --workspace ./demo-workspace \
  --key authority \
  --number 1
```

Anchor the 32-byte root through a Bitcoin Core wallet:

```bash
node bin/btc-ai.mjs anchor bitcoin \
  --workspace ./demo-workspace \
  --root YOUR_64_CHARACTER_ROOT \
  --rpc-url http://127.0.0.1:38332/wallet/provenance \
  --rpc-user YOUR_RPC_USER \
  --rpc-password YOUR_RPC_PASSWORD \
  --chain signet
```

Credentials are command examples only. Prefer an isolated local environment or a secret manager and do not commit credentials.

Verify the saved anchor after confirmation:

```bash
node bin/btc-ai.mjs anchor verify-bitcoin \
  --file ./demo-workspace/anchors/bitcoin-TXID.json \
  --rpc-url http://127.0.0.1:38332/wallet/provenance \
  --rpc-user YOUR_RPC_USER \
  --rpc-password YOUR_RPC_PASSWORD \
  --confirmations 6
```

## Project map

| Path | Responsibility |
| --- | --- |
| `src/canonical.mjs` | Deterministic serialization and strict value validation |
| `src/envelope.mjs` | Signed statement envelope and identity checks |
| `src/receipts.mjs` | Provenance receipt creation and lineage verification |
| `src/artifacts.mjs` | Content-addressed local artifact storage |
| `src/policy.mjs` | Agent session policy and action evaluation |
| `src/merkle.mjs` | Domain-separated Merkle trees and proofs |
| `src/batches.mjs` | Signed batch manifests |
| `src/bitcoin.mjs` | BAIP payload and Bitcoin Core RPC anchor pipeline |
| `src/explorer.mjs` | Dependency-free local explorer |
| `program.md` | Autonomous research and gauntlet loop |
| `test/` | Unit, adversarial, and end-to-end verification |

## Security reporting

Do not use this experimental release to custody funds or adjudicate legal ownership. Read [SECURITY.md](SECURITY.md) before integrating it into another system.

## License

Apache License 2.0.
