# OpenFaceID Developer Examples Catalog

This directory contains standalone, executable developer examples demonstrating core subsystems, public APIs, vision pipelines, presence tracking, IPC, and automation.

All examples run natively with pure Node.js standard library using `--experimental-strip-types`. No build steps or third-party packages are required.

---

## Example Catalog

| File | Subsystem | Description | Command |
| :--- | :--- | :--- | :--- |
| [`core-state.ts`](file:///Users/jayantolhyan/Desktop/my%20projects/open%20source%20/OpenFaceID/examples/core-state.ts) | Core Engine | Authoritative canonical state transitions and multi-face revocation. | `node --experimental-strip-types examples/core-state.ts` |
| [`camera-access.ts`](file:///Users/jayantolhyan/Desktop/my%20projects/open%20source%20/OpenFaceID/examples/camera-access.ts) | Hardware | Video capture discovery, permissions, and RAM zeroization. | `node --experimental-strip-types examples/camera-access.ts` |
| [`recognition.ts`](file:///Users/jayantolhyan/Desktop/my%20projects/open%20source%20/OpenFaceID/examples/recognition.ts) | Vision Engine | ArcFace 512D embeddings, cosine metric, and gallery evaluation. | `node --experimental-strip-types examples/recognition.ts` |
| [`liveness.ts`](file:///Users/jayantolhyan/Desktop/my%20projects/open%20source%20/OpenFaceID/examples/liveness.ts) | Anti-Spoofing | Passive motion variance and active challenge PAD evaluation. | `node --experimental-strip-types examples/liveness.ts` |
| [`presence.ts`](file:///Users/jayantolhyan/Desktop/my%20projects/open%20source%20/OpenFaceID/examples/presence.ts) | Presence | Absence timeout tracking, grace period, and session lifecycles. | `node --experimental-strip-types examples/presence.ts` |
| [`ipc-client.ts`](file:///Users/jayantolhyan/Desktop/my%20projects/open%20source%20/OpenFaceID/examples/ipc-client.ts) | Desktop IPC | Connecting to local daemon via authenticated REST with Bearer token. | `node --experimental-strip-types examples/ipc-client.ts` |
| [`cli-integration.ts`](file:///Users/jayantolhyan/Desktop/my%20projects/open%20source%20/OpenFaceID/examples/cli-integration.ts) | CLI Interface | Executing CLI programmatically and parsing `--json` machine output. | `node --experimental-strip-types examples/cli-integration.ts` |
| [`automation.ts`](file:///Users/jayantolhyan/Desktop/my%20projects/open%20source%20/OpenFaceID/examples/automation.ts) | Automation | Screen locking and desktop notification dispatching. | `node --experimental-strip-types examples/automation.ts` |

---

## Biometric Privacy Rules for Examples

1. **Purely Synthetic Test Fixtures**: [`demo/fixtures.ts`](file:///Users/jayantolhyan/Desktop/my%20projects/open%20source%20/OpenFaceID/examples/demo/fixtures.ts) provides synthetic non-biometric frames and landmark coordinates.
2. **Never Commit Real Face Images**: Do NOT commit real photographs, webcam frames, or personal biometric vectors to this directory.
3. **Automated Verification**: All examples in this directory are tested for execution correctness and regressions by `tests/unit/examples.test.ts`.
