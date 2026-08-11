# Autonomous Research and Engineering Program

## Goal

Improve BTC AI Provenance Core while preserving all existing security claims and passing every release gate.

The metric is not lines of code. The metric is the number of independently verified protocol properties with zero failing gates and zero increased trust assumptions.

## Fixed constraints

- Never claim that a cryptographic commitment proves truth or legal ownership.
- Never represent a local development journal as a Bitcoin anchor.
- Never add placeholder BitVM, ZKML, TEE, or storage-network code and call it functional.
- Do not weaken validation to make a test pass.
- Do not introduce a runtime dependency unless it removes more risk than it adds and its integrity is pinned.
- Make one bounded hypothesis-driven change per experiment.

## Baseline

Run:

```bash
npm run gauntlet
```

Record the pass count, failed gate, runtime, and security-property count in `research/results.tsv`.

## Experiment loop

Repeat until the target gate is satisfied or no evidence-backed hypothesis remains:

1. Inspect the latest gauntlet report and failing test.
2. State one falsifiable hypothesis in `research/beliefs.md`.
3. Predict which test or security property will change.
4. Make the smallest coherent implementation change.
5. Add or strengthen the test before accepting the change.
6. Run the narrow test.
7. Run the complete gauntlet.
8. Keep the change only if all existing gates pass and the targeted property improves.
9. Record the result, including rejected experiments.

## Acceptance rule

An experiment is kept only when:

- Unit and integration tests pass
- Syntax checks pass
- The end-to-end demo passes
- Workspace verification detects artifact and receipt tampering
- Secret and private-key scans pass
- Documentation claim checks pass
- The change adds or strengthens a demonstrated property

## Stop conditions

Stop when all release gates pass and every release claim maps to a test, or when the next change requires an external trust decision, funded Bitcoin wallet, hardware enclave, proving network, or cryptographic audit.

External dependencies are reported as explicit next gates, not silently mocked into production claims.
