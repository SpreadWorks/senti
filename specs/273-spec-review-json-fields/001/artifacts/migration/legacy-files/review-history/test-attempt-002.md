# Test Review Results

## Verdict: ADVISORY

Coverage artifact: `specs/273-spec-review-json-fields/test-coverage.json`

## Blocking Findings

No blocking findings.

## Advisory Findings

### 1. R1 does not assert the fallback format separately from the prompt
**Target:** specs/273-spec-review-json-fields/tests/spec-review-json-fields.test.js — test("R1: ...")
**Improvement:** The test concatenates systemPrompt + userPrompt + fmtFallback into one string and matches against the whole. R1 requires BOTH the prompt AND the fallback format to require blockingFindings[]/nonBlockingImprovements[] and the empty-arrays instruction. As written, the test would pass even if the new instruction lives only in the system prompt and the fmtFallback omits it. Add a separate assertion against prompt.fmtFallback (e.g. assert.match(prompt.fmtFallback, /nonBlockingImprovements/) and /empty arrays/i) to verify the fallback specifically.
**Why non-blocking:** R1 is still partially covered — the required phrases (blockingFindings[], nonBlockingImprovements[], empty arrays) are asserted in the combined string, and the current fmtFallback already embeds the schema plus the empty-arrays line, so the substance is exercised. This only tightens which artifact is checked.

### 2. Bounded-retry guarantee (at most one repair) is only asserted on the success path
**Target:** specs/273-spec-review-json-fields/tests/spec-review-json-fields.test.js — test("R4: ...")
**Improvement:** R3 asserts repairCalls === 1 for the successful-repair case, but R4 (invalid repair output) uses a callback with no call counter and only asserts the promise rejects. An implementation that retried the repair agent multiple times before failing would still pass R4. Add a counter in R4's repair callback and assert it is invoked exactly once to lock in the 'at most one additional time' bound on the failure path.
**Why non-blocking:** The 'at most one' bound is already exercised once via R3's repairCalls === 1, and R4 still verifies the core fail-instead-of-write behavior. This is a hardening of an already-covered guarantee.

### 3. R6 test is a self-referential regex check, not an assertion of the unit-level coverage it claims
**Target:** specs/273-spec-review-json-fields/tests/spec-review-json-fields.test.js — test("R6: ...")
**Improvement:** R6 requires spec-local tests for R1-R5 plus unit-level assertions for normalization, schema-repair retry, and invalid-output rejection. The R6 test only greps its own source for test("RN:") blocks; it does not verify those unit-level assertions exist. Consider asserting the presence of the key production symbols exercised (e.g. parseSpecReviewFindingsWithRepair usage) or rely explicitly on R2/R3/R4 as the substantive coverage and narrow R6's wording.
**Why non-blocking:** The substantive unit-level assertions R6 refers to are actually present in R2 (normalization), R3 (repair retry), and R4 (invalid-output rejection), so the requirement is covered in aggregate; R6's check is redundant rather than missing.
