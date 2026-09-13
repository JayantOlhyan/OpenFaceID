---
name: Hardware Compatibility Report
about: Report physical webcam and OS hardware test results (especially Windows & Linux)
title: '[HW] '
labels: ['hardware-validation']
assignees: ''
---

### Hardware Validation Report

* **Machine ID**: (e.g., `WIN-02`, `LNX-01`, `MAC-02`)
* **Computer Model**: (e.g., Lenovo ThinkPad X1 Carbon Gen 10)
* **CPU Architecture**: (e.g., x86_64, aarch64)
* **Operating System**: (e.g., Windows 11 Enterprise 23H2, Fedora 40 Workstation)
* **Camera Model**: (e.g., Integrated IR/RGB Webcam, Logitech C922)
* **OpenFaceID Commit Hash**: 

### Test Step Checklist

- [ ] `openfaceid doctor` (Permissions granted, device enumerated)
- [ ] `openfaceid camera test` (Measured capture FPS: ___ )
- [ ] `openfaceid identity enroll "Test"` (5 poses captured)
- [ ] `openfaceid recognition test` (Cosine similarity: ___ )
- [ ] Multiple-Face Drop (Presence drops immediately when second person appears)
- [ ] Absence Timeout (Presence transitions to USER_LEFT after timeout)
- [ ] Privacy Pause (Hardware indicator LED turns off)

### Observations & Limitations
Document any driver latency, frame-drop issues, or OS permission behaviors observed.
