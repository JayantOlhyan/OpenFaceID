# OpenFaceID Documentation Index

Welcome to the **OpenFaceID (SightLock)** documentation directory. This index provides direct navigation across all architectural specifications, security models, testing guides, and API references.

---

## 1. Getting Started & Product Overview

* [README](../README.md): High-level overview, platform support matrix, quick start, and security boundaries.
* [ROADMAP](../ROADMAP.md): Engineering roadmap across Current, Next, Future, Research, and Deferred phases.
* [CHANGELOG](../CHANGELOG.md): Comprehensive release history conforming to Keep a Changelog.

---

## 2. Architecture & System Design

* [Architecture & System Design](architecture.md): Full end-to-end architecture, Mermaid diagrams, authoritative core vs untrusted UI, and fail-closed rules.
* [Development Architecture](development-architecture.md): Monorepo structure, package dependency rules, forbidden imports, and architectural boundary tests.
* [Inter-Process Communication (IPC)](ipc.md): Local REST/SSE daemon protocol, Bearer token authentication, schemas, and automation allowlists.

---

## 3. Security & Privacy

* [Security Policy](../SECURITY.md): Vulnerability reporting procedures, supported versions, and threat mitigations.
* [Security Architecture](security-architecture.md): In-depth threat model, AES-256-GCM encryption, key derivation, and filesystem permissions.
* [Privacy Policy](../PRIVACY.md): Core privacy invariants, local-only processing, and zero telemetry guarantee.
* [Privacy Architecture](privacy-architecture.md): Data lifecycle diagrams, RAM frame zeroization, and Privacy Pause hardware cutoff.

---

## 4. Interfaces, CLI & API

* [CLI Reference](cli.md): Complete command-line reference, exit codes (0–7), arguments, and machine-readable `--json` schemas.
* [API Stability Policy](api-stability.md): Stability tiers (`Stable`, `Experimental`, `Internal`), deprecation process, and versioning strategy.
* [Configuration Reference](configuration.md): Complete JSON configuration schema, recognition thresholds (`Balanced`, `Strict`, `Very Strict`), and validation rules.
* [Canonical Error Reference](errors.md): Error codes, categories, recovery suggestions, and retryability flags.
* [Developer Examples](../examples/README.md): Index of runnable code samples demonstrating core state, camera access, recognition, liveness, and IPC.

---

## 5. Computer Vision & Models

* [Model Provenance & CV Formulations](models.md): Technical reality of in-tree analytical formulations (BlazeFace and ArcFace), limitations, and future plug-in interfaces (`IFaceDetector`, `IFaceEmbedder`).

---

## 6. Testing & Quality Assurance

* [Testing Guide](testing.md): Comprehensive testing methodology, test tiers, and running tests locally.
* [Test Command Matrix](testing/commands.md): Quick reference for `npm test`, benchmarks, evaluation, and hardware commands.
* [Test Matrix](testing/test-matrix.md): Complete matrix of automated test suites, pass criteria, and execution targets.
* [Biometric Test Data Policy](testing/biometric-data-policy.md): Strict prohibitions against committing real facial photographs or embeddings to git.
* [Hardware Testing Guide](hardware-testing.md): Physical hardware validation protocol and standardized reporting format for Windows and Linux contributors.

---

## 7. Release Engineering & Governance

* [Release Engineering Checklist](release-checklist.md): Pre-release verification gates, packaging, and git tagging procedures.
* [Release Notes v0.2.1-rc.1](releases/v0.2.1-rc.1.md): Release notes for version 0.2.1-rc.1.
* [Contributing Guide](../CONTRIBUTING.md): Setup instructions, coding standards, and PR requirements.
* [Governance](../GOVERNANCE.md): Project maintainers, roles, decision-making, and code review standards.
* [Code of Conduct](../CODE_OF_CONDUCT.md): Contributor Covenant community standards.
