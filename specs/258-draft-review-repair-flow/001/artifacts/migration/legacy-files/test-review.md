# Test Review Results

## Test Design
See [tests/spec.md](tests/spec.md) for the full test design.

## Gap Analysis
### Iteration 1
### GAP-1: Top-level review artifact required fields negative tests incomplete
**Missing:** The design (TC-3) requires each review artifact to contain `version`, `phase`, `sourceDraft`, `generatedAt`, `verdict`, `summary`, `blockingFindings[]`, `advisoryFindings[]`, `repairTargets[]`. The test code only explicitly tests one missing top-level field — `verdict` (gate-draft-validation.test.js: "SCHEMA_MISSING_FIELD when review verdict is missing"). The other 8 required fields are validated only via positive well-formed fixtures (`validateReviewArtifact(buildReviewArtifact())`); no test removes them individually to assert each one is rejected with a clear error.
**Severity:** MEDIUM
**Fix:** Add a table-driven test to `draft-artifact-contract.test.js` iterating over each required top-level field (`version`, `phase`, `sourceDraft`, `generatedAt`, `summary`, `blockingFindings`, `advisoryFindings`, `repairTargets`), deleting it from `buildReviewArtifact()` and asserting `validateReviewArtifact()` returns an error referencing that field name — analogous to the existing TC-6 loop for item-level fields.

### GAP-2: TC-20 (triage non-apply decisions resolve without repair items) not explicitly tested
**Missing:** Design TC-20 specifies that triage decisions `invalid`, `already_resolved`, and `downgraded_to_non_blocking` must resolve cleanly without requiring a matching repair entry, and gate-draft must NOT raise a missing-repair error for those items. The current tests only assert (a) `apply` items must have matching repair entries (TC-14, TC-25 ITEM_COUNT_MISMATCH) and (b) `requires_user_decision` blocks. There is no positive test case where a triage contains only non-apply, non-user-decision items and the gate-draft validator passes with an empty/short repair items array.
**Severity:** MEDIUM
**Fix:** Add a test in `gate-draft-validation.test.js` that builds a triage with one item per non-apply decision (`invalid`, `already_resolved`, `downgraded_to_non_blocking`) — for example mapping each blocking finding to one of these decisions — with an empty repair items array, and asserts `gateDraft({...})` returns `{ ok: true }`. This locks in the contract that only `apply` items consume repair slots.

### GAP-3: Truncation integrity for capped arrays (TC-4 second clause) not tested
**Missing:** Design TC-4 requires that when a producer emits 25 candidates and the array is capped at 20, "truncation does not corrupt remaining items." The tests verify both the upper-bound rejection (21 items → cap error) and the boundary acceptance (exactly 20) but never feed a 25-item input through any producer/truncator to assert the surviving 20 items remain well-formed and ordered. Since the validator is encoded in-test, this contract is currently unprotected against producer-side truncation bugs that drop fields or reorder items.
**Severity:** LOW
**Fix:** Either (a) declare truncation a producer-side concern that the validator does not enforce and remove the clause from the design, or (b) add a producer-side test in `draft-artifact-contract.test.js` that runs a synthetic truncator over a 25-item array and asserts the first 20 items still pass `validateReviewArtifact()` with all required item fields intact.

### GAP-4: TC-33 spec-local suite-coverage inventory check absent
**Missing:** Design TC-33 calls for a meta-test that asserts the spec-local suite contains tests for the four R11 categories: (a) review non-mutation, (b) triage/repair artifact shape, (c) gate-draft validation failures, (d) PASS/ADVISORY/FAIL routing. While each category is in fact covered by other tests, no explicit inventory test enforces that all four remain represented as the suite evolves.
**Severity:** LOW
**Fix:** Add a single inventory test (e.g., in `flow-routing-migration.test.js`) that reads the three spec-local test files and asserts each category's marker is present — for instance grep for `TC-1`/`TC-2` (non-mutation), `TC-8`/`TC-13` (artifact shape), `gate-draft-validation.test.js` file existence with non-zero `it(...)` count, and `TC-35`/`TC-36`/`TC-37` (routing) — so a future refactor cannot silently drop a whole category.

### Iteration 2
Reviewing the test design (TC-1 through TC-33) against the three spec-local test files in `specs/258-draft-review-repair-flow/tests/`:

**Mapping design TCs → test code:**
- TC-1, TC-2, TC-15 (non-mutation) → flow-routing-migration `TC-1`, `TC-2`, `TC-18`/`TC-38`
- TC-3 (review top-level fields) → draft-artifact-contract `GAP-1/TC-3` table-driven test of all 9 required fields
- TC-4 (≤20 cap) → `TC-4` boundary + `TC-5` over-cap + `GAP-3/TC-4` truncation integrity
- TC-5, TC-6 (classification rules) → `TC-7`, `TC-42`, per-array enforcement test
- TC-7 (plan ordering) → flow-routing-migration `TC-8` `planLeafIds` ordering check
- TC-8 (triage shape/cap) → `TC-9`, `TC-10`, `TC-41` boundary
- TC-9 (triage decisions) → `TC-12` enumerates all 5 + rejects `defer`
- TC-10 (triage scope) → `TC-11` scope rule
- TC-11 (repair shape/cap) → `TC-13`, `TC-15`, `TC-41`
- TC-12 (repair count = apply count) → `TC-14`
- TC-13, TC-14 (auto-approval rules) → `TC-16`, `TC-17` with `applyCoverageRepairApproval`
- TC-16–TC-18 (PASS/ADVISORY/FAIL routing) → `TC-19`–`TC-21` + end-to-end `TC-35`–`TC-37`
- TC-19 (requires_user_decision blocks) → `TC-22` + gate-draft `UNRESOLVED_DECISION`
- TC-20 (non-apply decisions resolve without repair) → gate-draft-validation `GAP-2/TC-20` with table-driven decisions
- TC-21 (apply without repair) → gate-draft-validation `ITEM_COUNT_MISMATCH` `TC-25`
- TC-22–TC-24 (gate-draft validation errors) → gate-draft-validation `TC-23`/`TC-27` (missing), `TC-24` (link), `TC-25` (count)
- TC-25 (gate-draft passes consistent set) → first test in gate-draft-validation
- TC-26–TC-29 (migration) → flow-routing-migration `TC-29` (pending), `TC-30` (done propagation), `TC-31` (edges), `TC-32` (markdown→JSON rewrite), `TC-34` (empty JSON validates)
- TC-30–TC-32 (acceptance paths) → end-to-end `TC-35`/`TC-36`/`TC-37`
- TC-33 (meta inventory) → flow-routing-migration `GAP-4/TC-33` enforces TC markers exist for categories (a)–(d)

Additionally the tests embed extra coverage beyond the design (TC-43 unknown field path, TC-39 distinct error codes, TC-40 zero-finding artifact, leaf-id grep tripwires).

NO_GAPS

## Verdict: PASS
