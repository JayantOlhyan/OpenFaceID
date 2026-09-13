# OpenFaceID Performance Engineering Methodology & Evidence Rules

## Principles of Measurement
1. **Separation of Concerns:** Microbenchmarks on synthetic in-memory fixtures are strictly separated from physical camera hardware pipeline latencies.
2. **Non-Comparability Disclosure:** Whenever test configurations, compilers, or input types differ between phases, comparative percentage claims are prohibited and labeled as **NOT DIRECTLY COMPARABLE**.
3. **Controlled Overload Testing:** Backpressure frame dropping is verified by deliberately submitting frames faster than consumer processing capacity.
4. **Honest Qualification:** Single-observation observations (battery, thermal) are labeled as **LIMITED EVIDENCE** rather than universal certifications.
5. **No Manufactured Numbers:** If hardware or extended soak testing was not performed (e.g. 4h+ soak, physical Windows/Linux hardware), it is recorded as **NOT PERFORMED** or **UNVERIFIED**.
