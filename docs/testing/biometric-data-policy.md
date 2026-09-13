# OpenFaceID Biometric Test Data Policy

## 1. Scope & Objective

This policy defines the acceptable and strictly prohibited uses of biometric data within the OpenFaceID open-source repository, continuous integration (CI) workflows, test suites, and documentation.

The objective is to safeguard contributor privacy, comply with global biometric privacy regulations (e.g., GDPR Article 9, Illinois BIPA, CCPA/CPRA), and ensure the public codebase remains free from identifiable human biometric information.

---

## 2. Strictly Prohibited Data

The following data types **MUST NEVER** be committed to the Git repository, pushed to remote branches, attached to GitHub issues, or included in pull requests:

* **Real Camera Captures**: JPEG, PNG, WebP, TIFF, or raw pixel buffers of real human faces.
* **Face Crops**: Cropped bounding boxes of real individuals.
* **Real Biometric Embeddings**: Mathematical feature vectors (e.g., 512D ArcFace embeddings) generated from real human faces.
* **Biometric Datasets**: Raw or processed folders from external facial recognition benchmarks (e.g., LFW, CASIA-WebFace, CelebA, VGGFace2) unless explicitly licensed and synthetic.
* **Production Identity Files**: Plaintext or encrypted `~/.openfaceid/identities/*.json` files from personal developer machines.
* **Keys & Tokens**: Operating system keystore dumps, master encryption keys, or IPC bearer tokens.

> [!CAUTION]
> Any pull request or commit containing real facial photographs or personal biometric vectors will be immediately closed, and the commit history will be purged.

---

## 3. Permitted & Synthetic Test Data

The following types of data are permitted for testing and development:

### 3.1 Synthetic Image Fixtures (`examples/demo/fixtures.ts`)

* **Mathematically Generated Gradients**: Synthetic pixel arrays generated via deterministic algorithms (e.g., coordinate modulo patterns, concentric geometric ellipses, or smooth synthetic gradients).
* **Synthetic Landmark Geometries**: Hardcoded, normalized facial landmark coordinate structures that approximate facial geometry without representing any real person:
  ```ts
  import { createSyntheticFrame, createSyntheticLandmarks } from './demo/fixtures.ts';
  const frame = createSyntheticFrame(640, 480, 42); // Seeded synthetic pattern
  const landmarks = createSyntheticLandmarks(640, 480);
  ```

### 3.2 Mock & Synthetic Embeddings

* Unit tests must generate embeddings using pseudorandom number generators (PRNG) or normalized orthogonal basis vectors:
  ```ts
  const mockVector = new Float32Array(512);
  mockVector[0] = 1.0; // Unit-length orthogonal vector
  ```

### 3.3 Local-Only Temporary Validation Media

Contributors performing physical webcam hardware validation (e.g., following `docs/hardware-testing.md`) may capture live webcam frames **strictly in local volatile memory** on their own machines.
* Local test scripts must automatically invoke `MemorySanitizer.zeroizeBuffer` upon test completion.
* No local capture files may be written to disk or committed.
* Automated CI test suites (`npm test`) must run 100% headlessly using synthetic fixtures.
