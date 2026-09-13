# OpenFaceID Governance

## 1. Project Overview

OpenFaceID (SightLock) is an open-source project dedicated to local-first, privacy-preserving desktop face presence verification.

This document establishes the project's governance structure, roles, and decision-making processes. The structure is designed to be lightweight, transparent, and proportional to the project's current scale.

---

## 2. Roles & Responsibilities

### 2.1 Project Maintainer

* **Lead Maintainer**: Jayant Olhyan ([@JayantOlhyan](https://github.com/JayantOlhyan))
* **Responsibilities**:
  * Setting strategic architectural direction and roadmap priorities.
  * Triage and review of pull requests and issues.
  * Authority over security vulnerability triage, cryptographic review, and coordinated disclosure.
  * Final release engineering authority and publishing git tags.

### 2.2 Contributors

* Anyone who submits code, tests, documentation, bug reports, or hardware validation evidence.
* Contributors are expected to uphold the [Code of Conduct](CODE_OF_CONDUCT.md), the [Biometric Test Data Policy](docs/testing/biometric-data-policy.md), and architectural boundaries.

---

## 3. Decision-Making & Code Review

1. **Pull Requests**: All functional changes must be submitted via pull request against the `main` branch.
2. **Quality Gates**: A PR must pass all automated CI suites (`npm test`), architectural boundary checks, and API contract tests before merge.
3. **Security Invariants**: Any PR touching `packages/security/`, `packages/core/`, or `packages/storage/` requires explicit maintainer review to verify that fail-closed invariants and zero-telemetry rules are preserved.
4. **Breaking Changes**: Breaking changes to stable public interfaces are permitted only in major version increments (`v1.0.0`) and require documented deprecation periods as specified in [docs/api-stability.md](docs/api-stability.md).

---

## 4. Release Authority

Releases are tagged and published exclusively by the lead maintainer following the procedures documented in [docs/release-checklist.md](docs/release-checklist.md).
