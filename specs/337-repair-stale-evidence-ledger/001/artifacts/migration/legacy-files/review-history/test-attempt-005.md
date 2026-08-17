# Test Review Results

## Verdict: REJECTED

Coverage artifact: `specs/337-repair-stale-evidence-ledger/test-coverage.json`

## Blocking Findings

### 1. R7 test bypasses the normal lifecycle it claims to cover
**Target:** specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js:469
**Issue:** The R7 test manually writes the post-recovery evidence artifacts with writeRepairEvidenceArtifact() and then calls assertCurrentRepairEvidenceFiles(). It does not execute the normal test-execute, test-result-review, impl-review, impl-gate, retro, and acceptance-review flow, so it can pass even if the real lifecycle rejects the repaired impl-repair ledger schema or fails during one of those steps.
**Required change:** Change or add R7 coverage that drives the actual lifecycle entrypoints/commands for the listed steps after committed recovery, rather than manually fabricating their artifacts.
**Why blocking:** R7 requires normal-flow regeneration after recovery; the current test has a static anti-pattern that passes without exercising the required production behavior.

### 2. R8 lacks exact target guard mismatch coverage for rewind
**Target:** specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js:519
**Issue:** The R8 test covers missing rewind target guards and a matching guarded rewind, but it does not cover wrong expectRunId, expectSpec, or expectIssue values being rejected without recovery mutation.
**Required change:** Add the smallest rewind-test-evidence cases that pass mismatched run/spec/issue guards and assert fail-closed behavior with no recovery mutation.
**Why blocking:** R8 explicitly requires exact target guards for explicit rewind-test-evidence public behavior; success plus missing-guard validation does not prove mismatched guards are rejected.

### 3. R9 shared unit and CLI lifecycle coverage is absent from the artifact
**Target:** Requirement-to-Test Coverage Artifact
**Issue:** R9 requires spec-local requirement tests and affected shared unit and CLI lifecycle tests, but the coverage artifact lists only tests/stale-evidence-repair-transaction.test.js for every requirement and no affected shared unit or CLI lifecycle test files.
**Required change:** Add or reference the affected shared unit and CLI lifecycle tests in the coverage artifact, or narrow R9 if those test layers are intentionally out of scope.
**Why blocking:** The requirement coverage artifact contradicts R9's stated coverage requirement by marking it covered with only one spec-local test file.

### 4. R3 mutation-owner assertion can miss production mutations
**Target:** specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js:52
**Issue:** TransactionalFlowManager.mutate() increments mutateCalls only when state.implRepairTransaction is null before the mutator runs. Any production mutate() call made after a transaction already exists would not be counted, so the R3 assertion mutateCalls === 0 can pass despite extra mutation ownership during recovery.
**Required change:** Count every mutate() invocation, or otherwise assert that no unauthorized mutate() calls occur across the entire recovery path.
**Why blocking:** R3 requires stale entrypoints to delegate mutation effects to the existing impl-repair transaction authority; the current spy has a static anti-pattern that can pass without detecting forbidden production mutation behavior.


## Advisory Findings

No advisory findings.