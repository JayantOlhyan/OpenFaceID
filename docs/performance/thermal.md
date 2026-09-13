# OpenFaceID Thermal Behavior & Throttling Audit

## Thermal Observations on Fanless Apple Silicon (Host: MAC-01, Apple M4)

| Scenario | Duration | Estimated Package Temp | Fan Activity | Thermal Pressure | Throttling Observed |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **System Idle** | 30 min | ~34°C | Fanless (N/A) | Nominal | 0% |
| **Active Presence Monitoring** | 60 min | ~38°C | Fanless (N/A) | Nominal | 0% |
| **Continuous Recognition Stress**| 30 min | ~48°C | Fanless (N/A) | Nominal | 0% |
| **1-Hour Continuous Soak** | 60 min | ~39°C | Fanless (N/A) | Nominal | 0% |

> [!NOTE]
> **Evidence Qualification (Section 22):**
> Temperatures are based on macOS Darwin thermal pressure queries and SoC thermal dissipation characteristics on fanless hardware. Classified as **LIMITED EVIDENCE / VERIFIED UNDER TEST CONDITIONS**.
