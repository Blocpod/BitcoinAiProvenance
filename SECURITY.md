# Security Policy

Version 0.1.0 is an experimental reference implementation.

Do not use it to custody Bitcoin, enforce legal ownership, or make irreversible autonomous payments without an independent security review and production-grade state storage.

Keep private keys outside shared workspaces. The CLI creates private PEM files with owner-only permissions, but production deployments should use hardware-backed or managed signing systems.

Never place secrets, private prompts, personal data, raw model weights, or confidential licensing terms in public Bitcoin commitment metadata. Commit only digests and selectively disclosed claims.

Security reports should include a minimal reproducer, affected module, expected behavior, observed behavior, and whether private keys or funds may be at risk.
