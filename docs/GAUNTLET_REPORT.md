# Gauntlet Report

Generated: 2026-08-11T17:33:57.136Z

Result: **PASS**

| Gate | Result | Evidence |
| --- | --- | --- |
| required-release-files | PASS | 8 required files present |
| syntax-check | PASS | 23 modules parsed |
| unit-integration-adversarial-tests | PASS | 28 tests passed |
| end-to-end-demo-and-verifier | PASS | demo, lineage, batch, and 3 artifacts verified |
| secret-scan | PASS | 48 files scanned |
| claim-hygiene | PASS | 8 documents checked |
| package-dry-run | PASS | 48 release files, 35692 bytes packed |

This report verifies the local release gates. A mocked Bitcoin Core RPC validates request and response handling; a live funded Bitcoin wallet was not available in this environment. External cryptographic review remains required before high-value deployment.
