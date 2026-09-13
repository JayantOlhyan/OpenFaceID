## Summary of Changes
Provide a brief summary of what this pull request introduces or fixes.

## Motivation & Context
Why is this change required? What issue does it resolve?

## Description of Changes
- Change 1
- Change 2

## Testing Performed
- [ ] `npm test` passes (0 failures across all suites)
- [ ] `node --experimental-strip-types --test tests/unit/architecture_boundaries.test.ts` passes
- [ ] `node --experimental-strip-types --test tests/unit/api_contracts.test.ts` passes
- [ ] Added new unit tests under `tests/unit/`

## Security & Privacy Impact
- [ ] **NO real camera captures, face crops, or personal biometric vectors are in this PR.**
- [ ] Any visual fixtures use synthetic generators (`examples/demo/fixtures.ts`).
- [ ] Zero runtime dependencies added to `package.json`.
- [ ] File permissions and path traversal validations are maintained.
- [ ] Zero telemetry and zero network egress invariants preserved.

## Performance Impact
Does this change impact inference latency or idle memory footprint?
- [ ] Benchmarks run via `npm run test:perf` (attach results if applicable)

## Breaking Changes & API Stability
- [ ] No breaking changes to Stable APIs (see `docs/api-stability.md`).
- [ ] If breaking changes exist, deprecation notices and migration steps are documented.

## Documentation
- [ ] Documentation updated under `docs/` or `README.md` if applicable.
