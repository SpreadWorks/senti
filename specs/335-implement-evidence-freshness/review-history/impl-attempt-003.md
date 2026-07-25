# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 1. Pretty-print the review evidence JSON
**Finding key:** loop-dfcf77e78619ea47e3cb
**Failure mode:** refactor
**File:** specs/335-implement-evidence-freshness/review-evidence/f262dd131dcabe1ebef3a423bed653f94242efc0d989205045da91df03a49843.json
**Requirement:** R5
**Issue:** **File:** `specs/335-implement-evidence-freshness/review-evidence/f262dd131dcabe1ebef3a423bed653f94242efc0d989205045da91df03a49843.json`  
**Requirement:** R5  
**Issue:** The file is committed as a single-line JSON blob, unlike the two review-history JSON files in the same diff. This makes future review, diffs, and manual inspection harder.  
**Suggestion:** Format the JSON with consistent indentation before committing, matching the style used by the other touched JSON artifacts.
**Suggestion:** **File:** `specs/335-implement-evidence-freshness/review-evidence/f262dd131dcabe1ebef3a423bed653f94242efc0d989205045da91df03a49843.json`  
**Requirement:** R5  
**Issue:** The file is committed as a single-line JSON blob, unlike the two review-history JSON files in the same diff. This makes future review, diffs, and manual inspection harder.  
**Suggestion:** Format the JSON with consistent indentation before committing, matching the style used by the other touched JSON artifacts.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 2. 1. Deduplicate Repeated Finding Payloads
**Finding key:** loop-f877771078f6d1c42e2c
**Failure mode:** refactor
**File:** specs/335-implement-evidence-freshness/review-history/test-attempt-001.json
**Requirement:** R5
**Issue:** **File:** `specs/335-implement-evidence-freshness/review-history/test-attempt-001.json`
**Requirement:** R5
**Issue:** The same finding content is duplicated in both `blockingFindings` and `findings`, including repeated titles, rationale, fingerprints, and issue text. This makes the artifact harder to maintain and increases the chance of inconsistent generated history if one representation changes without the other.
**Suggestion:** Keep one canonical finding list and derive phase-specific groupings from it, or reduce `blockingFindings` to references/IDs plus blocking-specific metadata.
**Suggestion:** **File:** `specs/335-implement-evidence-freshness/review-history/test-attempt-001.json`
**Requirement:** R5
**Issue:** The same finding content is duplicated in both `blockingFindings` and `findings`, including repeated titles, rationale, fingerprints, and issue text. This makes the artifact harder to maintain and increases the chance of inconsistent generated history if one representation changes without the other.
**Suggestion:** Keep one canonical finding list and derive phase-specific groupings from it, or reduce `blockingFindings` to references/IDs plus blocking-specific metadata.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 3. 2. Use Distinct Finding Identifiers
**Finding key:** loop-db8e35858697a9f39b21
**Failure mode:** refactor
**File:** specs/335-implement-evidence-freshness/review-history/test-attempt-001.json
**Requirement:** R5
**Issue:** **File:** `specs/335-implement-evidence-freshness/review-history/test-attempt-001.json`
**Requirement:** R5
**Issue:** All four findings share the same `findingId`, `fingerprint`, and `id`, even though they describe different requirements and failure modes. This weakens traceability and makes de-duplication, suppression, or history comparison ambiguous.
**Suggestion:** Generate each finding’s identifier from its own stable content, such as `phase + origin + title + normalized issue`, so separate findings receive distinct IDs.
**Suggestion:** **File:** `specs/335-implement-evidence-freshness/review-history/test-attempt-001.json`
**Requirement:** R5
**Issue:** All four findings share the same `findingId`, `fingerprint`, and `id`, even though they describe different requirements and failure modes. This weakens traceability and makes de-duplication, suppression, or history comparison ambiguous.
**Suggestion:** Generate each finding’s identifier from its own stable content, such as `phase + origin + title + normalized issue`, so separate findings receive distinct IDs.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 4. 3. Add Final Newline
**Finding key:** loop-110510cd7791629070f6
**Failure mode:** refactor
**File:** specs/335-implement-evidence-freshness/review-history/test-attempt-001.md
**Requirement:** R5
**Issue:** **File:** `specs/335-implement-evidence-freshness/review-history/test-attempt-001.md`
**Requirement:** R5
**Issue:** The Markdown file is missing a trailing newline, which is inconsistent with normal text artifact formatting and can create noisy diffs later.
**Suggestion:** End the file with a newline.
**Suggestion:** **File:** `specs/335-implement-evidence-freshness/review-history/test-attempt-001.md`
**Requirement:** R5
**Issue:** The Markdown file is missing a trailing newline, which is inconsistent with normal text artifact formatting and can create noisy diffs later.
**Suggestion:** End the file with a newline.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 5. 3. Add Final Newline
**Finding key:** loop-5d0d8a2ef2e4c8d5b47e
**Failure mode:** refactor
**File:** specs/335-implement-evidence-freshness/review-history/test-attempt-002.md
**Requirement:** R5
**Issue:** **File:** `specs/335-implement-evidence-freshness/review-history/test-attempt-002.md`
**Requirement:** R5
**Issue:** The Markdown file is missing a trailing newline, which is inconsistent with normal text artifact formatting and can create noisy diffs later.
**Suggestion:** End the file with a newline.
**Suggestion:** **File:** `specs/335-implement-evidence-freshness/review-history/test-attempt-002.md`
**Requirement:** R5
**Issue:** The Markdown file is missing a trailing newline, which is inconsistent with normal text artifact formatting and can create noisy diffs later.
**Suggestion:** End the file with a newline.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 3. Add Final Newline
**Finding key:** loop-c768cf6a63a022d9cc9d
**Failure mode:** refactor
**File:** specs/335-implement-evidence-freshness/review-history/test-attempt-003.md
**Requirement:** R5
**Issue:** **File:** `specs/335-implement-evidence-freshness/review-history/test-attempt-003.md`
**Requirement:** R5
**Issue:** The Markdown file is missing a trailing newline, which is inconsistent with normal text artifact formatting and can create noisy diffs later.
**Suggestion:** End the file with a newline.
**Suggestion:** **File:** `specs/335-implement-evidence-freshness/review-history/test-attempt-003.md`
**Requirement:** R5
**Issue:** The Markdown file is missing a trailing newline, which is inconsistent with normal text artifact formatting and can create noisy diffs later.
**Suggestion:** End the file with a newline.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 3. Avoid duplicating full finding data inside the same artifact
**Finding key:** loop-bb45b7ce311f0c933c21
**Failure mode:** refactor
**File:** specs/335-implement-evidence-freshness/review-history/test-attempt-002.json
**Requirement:** R5
**Issue:** **File:** `specs/335-implement-evidence-freshness/review-history/test-attempt-002.json`  
**Requirement:** R5  
**Issue:** Each finding is represented twice: once in `blockingFindings` with detailed fields, and again in `findings` with overlapping fields. This creates maintenance risk because the two copies can drift.  
**Suggestion:** Store the canonical finding records once, then derive blocking/advisory views from severity when reading the artifact, or make `blockingFindings` contain only references to canonical finding IDs.
**Suggestion:** **File:** `specs/335-implement-evidence-freshness/review-history/test-attempt-002.json`  
**Requirement:** R5  
**Issue:** Each finding is represented twice: once in `blockingFindings` with detailed fields, and again in `findings` with overlapping fields. This creates maintenance risk because the two copies can drift.  
**Suggestion:** Store the canonical finding records once, then derive blocking/advisory views from severity when reading the artifact, or make `blockingFindings` contain only references to canonical finding IDs.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 1. Remove duplicate review-history snapshot
**Finding key:** loop-00f9c8144cb536dfc133
**Failure mode:** refactor
**File:** specs/335-implement-evidence-freshness/review-history/test-attempt-003.json
**Requirement:** R5
**Issue:** **File:** `specs/335-implement-evidence-freshness/review-history/test-attempt-003.json`  
**Requirement:** R5  
**Issue:** `test-attempt-003.json` duplicates nearly all content from `test-attempt-002.json`; only timestamps, attempt number, and progress signature differ. Keeping both adds noise without new review signal.  
**Suggestion:** Drop the redundant attempt file if review history does not require every failed retry, or replace repeated full finding payloads with a compact pointer to the prior equivalent attempt.
**Suggestion:** **File:** `specs/335-implement-evidence-freshness/review-history/test-attempt-003.json`  
**Requirement:** R5  
**Issue:** `test-attempt-003.json` duplicates nearly all content from `test-attempt-002.json`; only timestamps, attempt number, and progress signature differ. Keeping both adds noise without new review signal.  
**Suggestion:** Drop the redundant attempt file if review history does not require every failed retry, or replace repeated full finding payloads with a compact pointer to the prior equivalent attempt.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 2. Use unique finding identifiers per finding
**Finding key:** loop-c578794dbfb8db429e35
**Failure mode:** refactor
**File:** specs/335-implement-evidence-freshness/review-history/test-attempt-004.json
**Requirement:** R5
**Issue:** **File:** `specs/335-implement-evidence-freshness/review-history/test-attempt-004.json`  
**Requirement:** R5  
**Issue:** Both findings use the same `findingId`, `fingerprint`, and `id`, despite representing different issues. This makes deduplication, tracking, and historical comparison ambiguous.  
**Suggestion:** Generate `findingId`/`fingerprint` from stable finding content such as phase, origin, title, target, and body so distinct findings receive distinct IDs.
**Suggestion:** **File:** `specs/335-implement-evidence-freshness/review-history/test-attempt-004.json`  
**Requirement:** R5  
**Issue:** Both findings use the same `findingId`, `fingerprint`, and `id`, despite representing different issues. This makes deduplication, tracking, and historical comparison ambiguous.  
**Suggestion:** Generate `findingId`/`fingerprint` from stable finding content such as phase, origin, title, target, and body so distinct findings receive distinct IDs.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 10. 1. Remove duplicated rationale text
**Finding key:** loop-fd94992174a72ceb0831
**Failure mode:** refactor
**File:** specs/335-implement-evidence-freshness/review-history/test-attempt-005.json
**Requirement:** R3
**Issue:** **File:** `specs/335-implement-evidence-freshness/review-history/test-attempt-005.json`  
**Requirement:** R3  
**Issue:** The same explanatory text is duplicated across `rationale`, `whyNonBlocking`, `body`, and the final finding `rationale`. This makes the artifact noisier and increases the chance future edits update one copy but not the others.  
**Suggestion:** Keep the canonical explanation in one field per finding shape, or shorten repeated fields so they reference the same underlying reason without restating the full paragraph.
**Suggestion:** **File:** `specs/335-implement-evidence-freshness/review-history/test-attempt-005.json`  
**Requirement:** R3  
**Issue:** The same explanatory text is duplicated across `rationale`, `whyNonBlocking`, `body`, and the final finding `rationale`. This makes the artifact noisier and increases the chance future edits update one copy but not the others.  
**Suggestion:** Keep the canonical explanation in one field per finding shape, or shorten repeated fields so they reference the same underlying reason without restating the full paragraph.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 11. 1. Remove duplicated rationale text
**Finding key:** loop-3cac9a843348b29b4595
**Failure mode:** refactor
**File:** specs/335-implement-evidence-freshness/test-review.md
**Requirement:** R3
**Issue:** **File:** `specs/335-implement-evidence-freshness/test-review.md`  
**Requirement:** R3  
**Issue:** The same explanatory text is duplicated across `rationale`, `whyNonBlocking`, `body`, and the final finding `rationale`. This makes the artifact noisier and increases the chance future edits update one copy but not the others.  
**Suggestion:** Keep the canonical explanation in one field per finding shape, or shorten repeated fields so they reference the same underlying reason without restating the full paragraph.
**Suggestion:** **File:** `specs/335-implement-evidence-freshness/test-review.md`  
**Requirement:** R3  
**Issue:** The same explanatory text is duplicated across `rationale`, `whyNonBlocking`, `body`, and the final finding `rationale`. This makes the artifact noisier and increases the chance future edits update one copy but not the others.  
**Suggestion:** Keep the canonical explanation in one field per finding shape, or shorten repeated fields so they reference the same underlying reason without restating the full paragraph.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 12. 3. Avoid repeated evidence metadata in scenario results
**Finding key:** loop-1539ec1015042c15de48
**Failure mode:** refactor
**File:** specs/335-implement-evidence-freshness/scenario-validity-result.json
**Requirement:** R5
**Issue:** **File:** `specs/335-implement-evidence-freshness/scenario-validity-result.json`  
**Requirement:** R5  
**Issue:** Each summary entry repeats the same `test_file`, `command`, and `raw_output_lines`. The only unique fields are requirement id, classification, and test name.  
**Suggestion:** Move shared evidence metadata to a top-level shared block if this artifact schema allows it, or generate the repeated values from a single source to avoid stale copied fields.
**Suggestion:** **File:** `specs/335-implement-evidence-freshness/scenario-validity-result.json`  
**Requirement:** R5  
**Issue:** Each summary entry repeats the same `test_file`, `command`, and `raw_output_lines`. The only unique fields are requirement id, classification, and test name.  
**Suggestion:** Move shared evidence metadata to a top-level shared block if this artifact schema allows it, or generate the repeated values from a single source to avoid stale copied fields.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 4. Clarify the exit-code/result combination
**Finding key:** loop-d5b64280911f320d2549
**Failure mode:** refactor
**File:** specs/335-implement-evidence-freshness/scenario-validity-result.json
**Requirement:** R5
**Issue:** **File:** `specs/335-implement-evidence-freshness/scenario-validity-result.json`  
**Requirement:** R5  
**Issue:** The process has `"exitCode": 1`, while the overall `"result"` is `"pass"`. This may be intentional because every scenario is classified as `expected_fail`, but the artifact does not make that relationship explicit.  
**Suggestion:** Add or generate a concise field such as `"passReason": "all failures matched expected_fail"` so reviewers do not have to infer why a failing command produced a passing scenario-validity result.
**Suggestion:** **File:** `specs/335-implement-evidence-freshness/scenario-validity-result.json`  
**Requirement:** R5  
**Issue:** The process has `"exitCode": 1`, while the overall `"result"` is `"pass"`. This may be intentional because every scenario is classified as `expected_fail`, but the artifact does not make that relationship explicit.  
**Suggestion:** Add or generate a concise field such as `"passReason": "all failures matched expected_fail"` so reviewers do not have to infer why a failing command produced a passing scenario-validity result.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 1. Remove duplicate implementation target statements
**Finding key:** loop-6f027fd3a1dc7c444629
**Failure mode:** refactor
**File:** specs/335-implement-evidence-freshness/spec.json
**Requirement:** R5
**Issue:** **File:** `specs/335-implement-evidence-freshness/spec.json`  
**Requirement:** R5  
**Issue:** `src/flow/lib/set-step.js` is described twice in `overview.modules`, and the eligibility/filtering behavior is also repeated across `overview.data_flow`, `decisions`, `constraints`, and `tasks.implementation_notes`. This makes the spec harder to maintain and increases drift risk.  
**Suggestion:** Keep one canonical module description and one canonical data-flow statement for evidence eligibility, then let the task reference those instead of restating the same design.
**Suggestion:** **File:** `specs/335-implement-evidence-freshness/spec.json`  
**Requirement:** R5  
**Issue:** `src/flow/lib/set-step.js` is described twice in `overview.modules`, and the eligibility/filtering behavior is also repeated across `overview.data_flow`, `decisions`, `constraints`, and `tasks.implementation_notes`. This makes the spec harder to maintain and increases drift risk.  
**Suggestion:** Keep one canonical module description and one canonical data-flow statement for evidence eligibility, then let the task reference those instead of restating the same design.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 15. 2. Normalize completion state in the spec
**Finding key:** loop-0bfdc3f0404372a10428
**Failure mode:** refactor
**File:** specs/335-implement-evidence-freshness/spec.json
**Requirement:** R5
**Issue:** **File:** `specs/335-implement-evidence-freshness/spec.json`  
**Requirement:** R5  
**Issue:** Requirements `R1`-`R5` are marked `"status": "done"`, but task `T-1` is still `"status": "pending"`. That state mismatch makes the generated spec internally ambiguous.  
**Suggestion:** Align the task and requirement statuses, or remove per-requirement `"done"` markers until implementation evidence has actually been finalized.
**Suggestion:** **File:** `specs/335-implement-evidence-freshness/spec.json`  
**Requirement:** R5  
**Issue:** Requirements `R1`-`R5` are marked `"status": "done"`, but task `T-1` is still `"status": "pending"`. That state mismatch makes the generated spec internally ambiguous.  
**Suggestion:** Align the task and requirement statuses, or remove per-requirement `"done"` markers until implementation evidence has actually been finalized.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 16. 1. Remove Duplicate Module Ownership Entry
**Finding key:** loop-d548db966332c32b0d79
**Failure mode:** refactor
**File:** specs/335-implement-evidence-freshness/spec.md
**Requirement:** R1
**Issue:** **File:** `specs/335-implement-evidence-freshness/spec.md`  
**Requirement:** R1  
**Issue:** The `Overview > Modules` section lists `src/flow/lib/set-step.js` twice with overlapping responsibility descriptions. This adds noise and makes the ownership model look less precise.  
**Suggestion:** Merge the two bullets into one concise entry, for example: `src/flow/lib/set-step.js` owns implement completion pre-validation and classifies evidence before readiness and producer validation.
**Suggestion:** **File:** `specs/335-implement-evidence-freshness/spec.md`  
**Requirement:** R1  
**Issue:** The `Overview > Modules` section lists `src/flow/lib/set-step.js` twice with overlapping responsibility descriptions. This adds noise and makes the ownership model look less precise.  
**Suggestion:** Merge the two bullets into one concise entry, for example: `src/flow/lib/set-step.js` owns implement completion pre-validation and classifies evidence before readiness and producer validation.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 17. 4. Remove duplicate advisory rationale text
**Finding key:** loop-99d734e0e249b6e311ad
**Failure mode:** refactor
**File:** specs/335-implement-evidence-freshness/test-review.json
**Requirement:** R5
**Issue:** **File:** `specs/335-implement-evidence-freshness/test-review.json`  
**Requirement:** R5  
**Issue:** The advisory finding repeats the same sentence in both `rationale` and `whyNonBlocking`, creating duplicate content with no added signal.  
**Suggestion:** Keep `rationale` for the technical reason and make `whyNonBlocking` a shorter non-duplicative explanation, or omit one if the schema allows it.
**Suggestion:** **File:** `specs/335-implement-evidence-freshness/test-review.json`  
**Requirement:** R5  
**Issue:** The advisory finding repeats the same sentence in both `rationale` and `whyNonBlocking`, creating duplicate content with no added signal.  
**Suggestion:** Keep `rationale` for the technical reason and make `whyNonBlocking` a shorter non-duplicative explanation, or omit one if the schema allows it.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 18. 5. Do not keep stale failing raw logs as reviewed artifacts
**Finding key:** loop-0269a73bd1ce0aed3857
**Failure mode:** refactor
**File:** specs/335-implement-evidence-freshness/tests/.raw/scenario-validity.log
**Requirement:** R5
**Issue:** **File:** `specs/335-implement-evidence-freshness/tests/.raw/scenario-validity.log`  
**Requirement:** R5  
**Issue:** The checked-in raw log records failing test output from an earlier run, while the diff also adds the test source. This creates noise and can mislead future reviewers about the expected current state.  
**Suggestion:** Regenerate this file after the implementation passes, or remove it from the change set if raw logs are not required source artifacts.
**Suggestion:** **File:** `specs/335-implement-evidence-freshness/tests/.raw/scenario-validity.log`  
**Requirement:** R5  
**Issue:** The checked-in raw log records failing test output from an earlier run, while the diff also adds the test source. This creates noise and can mislead future reviewers about the expected current state.  
**Suggestion:** Regenerate this file after the implementation passes, or remove it from the change set if raw logs are not required source artifacts.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 19. 1. Extract repeated pre-validation setup
**Finding key:** loop-32cee314624778cb5a46
**Failure mode:** refactor
**File:** specs/335-implement-evidence-freshness/tests/implement-evidence-freshness.test.js
**Requirement:** R5
**Issue:** **File:** `specs/335-implement-evidence-freshness/tests/implement-evidence-freshness.test.js`  
**Requirement:** R5  
**Issue:** Most test cases repeat the same `preValidate({ root, state, requestedStatus: "done" })` call shape, which makes the tests longer and obscures the scenario-specific setup.  
**Suggestion:** Add a small helper such as `validateDone(preValidate, fixture)` or close over `preValidate` per test to centralize the call and keep each assertion focused on the fixture conditions.
**Suggestion:** **File:** `specs/335-implement-evidence-freshness/tests/implement-evidence-freshness.test.js`  
**Requirement:** R5  
**Issue:** Most test cases repeat the same `preValidate({ root, state, requestedStatus: "done" })` call shape, which makes the tests longer and obscures the scenario-specific setup.  
**Suggestion:** Add a small helper such as `validateDone(preValidate, fixture)` or close over `preValidate` per test to centralize the call and keep each assertion focused on the fixture conditions.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 20. 2. Reuse shared fixture path constants
**Finding key:** loop-06ffa8538df4205c8501
**Failure mode:** refactor
**File:** specs/335-implement-evidence-freshness/tests/implement-evidence-freshness.test.js
**Requirement:** R5
**Issue:** **File:** `specs/335-implement-evidence-freshness/tests/implement-evidence-freshness.test.js`  
**Requirement:** R5  
**Issue:** `specs/${fixtureSpecId}/tests/fixture.test.js` and related raw-output paths are reconstructed in multiple artifact builders. This duplicates path knowledge and increases maintenance risk if the fixture layout changes.  
**Suggestion:** Define constants like `fixtureTestPath`, `scenarioRawOutputPath`, and `testExecutionRawOutputPath` near `fixtureSpecPath`, then reuse them in `validScenarioArtifact()`, `validTestExecuteArtifact()`, and fixture creation.
**Suggestion:** **File:** `specs/335-implement-evidence-freshness/tests/implement-evidence-freshness.test.js`  
**Requirement:** R5  
**Issue:** `specs/${fixtureSpecId}/tests/fixture.test.js` and related raw-output paths are reconstructed in multiple artifact builders. This duplicates path knowledge and increases maintenance risk if the fixture layout changes.  
**Suggestion:** Define constants like `fixtureTestPath`, `scenarioRawOutputPath`, and `testExecutionRawOutputPath` near `fixtureSpecPath`, then reuse them in `validScenarioArtifact()`, `validTestExecuteArtifact()`, and fixture creation.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 21. 3. Split the broad no-rewind regression test into named cases
**Finding key:** loop-99c74e447c220f85da23
**Failure mode:** refactor
**File:** specs/335-implement-evidence-freshness/tests/implement-evidence-freshness.test.js
**Requirement:** R4
**Issue:** **File:** `specs/335-implement-evidence-freshness/tests/implement-evidence-freshness.test.js`  
**Requirement:** R4  
**Issue:** The R4 test covers many unrelated preservation behaviors in one long test body: missing evidence, valid readiness, pending requirements, missing file-map, raw output, and producer adapters. A failure in one scenario makes the test harder to scan and localize.  
**Suggestion:** Convert the cases into a bounded table of named scenarios or split them into separate `test()` blocks with focused names. This would make the preserved behavior matrix clearer without changing coverage.
**Suggestion:** **File:** `specs/335-implement-evidence-freshness/tests/implement-evidence-freshness.test.js`  
**Requirement:** R4  
**Issue:** The R4 test covers many unrelated preservation behaviors in one long test body: missing evidence, valid readiness, pending requirements, missing file-map, raw output, and producer adapters. A failure in one scenario makes the test harder to scan and localize.  
**Suggestion:** Convert the cases into a bounded table of named scenarios or split them into separate `test()` blocks with focused names. This would make the preserved behavior matrix clearer without changing coverage.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 22. 1. Extract duplicate SHA-256 generation
**Finding key:** loop-2fb92fe1d055e549c4df
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R5  
**Issue:** `CanonicalReviewFindingRegistry.uniqueFingerprint()` repeats the same `crypto.createHash("sha256").update(...).digest("hex")` expression in two places, and `register()` has a third equivalent hash expression.  
**Suggestion:** Add a small helper such as `sha256Hex(value)` and use it for fingerprint generation. This keeps the registry logic focused on uniqueness rather than hashing mechanics.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R5  
**Issue:** `CanonicalReviewFindingRegistry.uniqueFingerprint()` repeats the same `crypto.createHash("sha256").update(...).digest("hex")` expression in two places, and `register()` has a third equivalent hash expression.  
**Suggestion:** Add a small helper such as `sha256Hex(value)` and use it for fingerprint generation. This keeps the registry logic focused on uniqueness rather than hashing mechanics.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 23. 2. Simplify collision suffix initialization
**Finding key:** loop-b03492b311cc2b6ca627
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R5  
**Issue:** `uniqueFindingId()` starts with `suffix = 1`, checks `fallback`, then increments before producing `fallback-2`. This works, but the numbering logic is indirect and easy to misread.  
**Suggestion:** Rename `normalized` to `candidateId` and make the sequence explicit, for example: try `fallback`, then loop with `suffix = 2` producing `${fallback}-${suffix}`. Apply the same clarity to `uniqueFingerprint()`.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R5  
**Issue:** `uniqueFindingId()` starts with `suffix = 1`, checks `fallback`, then increments before producing `fallback-2`. This works, but the numbering logic is indirect and easy to misread.  
**Suggestion:** Rename `normalized` to `candidateId` and make the sequence explicit, for example: try `fallback`, then loop with `suffix = 2` producing `${fallback}-${suffix}`. Apply the same clarity to `uniqueFingerprint()`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 24. 3. Rename identity to findingIdentity
**Finding key:** loop-3af4ab4f31efaf4c15b6
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R5  
**Issue:** The variable and map value name `identity` is broad. In this context it means the stable serialized identity of a provider finding, not an object identity or registry identity.  
**Suggestion:** Rename it to `findingIdentity` throughout `CanonicalReviewFindingRegistry` to make collision handling easier to follow.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R5  
**Issue:** The variable and map value name `identity` is broad. In this context it means the stable serialized identity of a provider finding, not an object identity or registry identity.  
**Suggestion:** Rename it to `findingIdentity` throughout `CanonicalReviewFindingRegistry` to make collision handling easier to follow.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 25. 4. Remove unused import
**Finding key:** loop-39fdd0cc6d7ed172f3b6
**Failure mode:** refactor
**File:** src/flow/lib/set-step.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R1  
**Issue:** `isPlanEvidenceFresh` remains imported from `./plan-rewind.js`, but the shown change now uses `isPlanArtifactFresh` for artifact freshness. If `isPlanEvidenceFresh` is no longer referenced in this file, it is dead code at the import site.  
**Suggestion:** Remove `isPlanEvidenceFresh` from the import list if no remaining code in `set-step.js` uses it.
**Suggestion:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R1  
**Issue:** `isPlanEvidenceFresh` remains imported from `./plan-rewind.js`, but the shown change now uses `isPlanArtifactFresh` for artifact freshness. If `isPlanEvidenceFresh` is no longer referenced in this file, it is dead code at the import site.  
**Suggestion:** Remove `isPlanEvidenceFresh` from the import list if no remaining code in `set-step.js` uses it.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 26. 5. Use a domain-specific collection helper for readiness evidence
**Finding key:** loop-15818f1177470e679bcb
**Failure mode:** refactor
**File:** src/flow/lib/set-step.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R2  
**Issue:** The readiness decision repeats `readinessEvidence.some(...)` twice with different predicates. The logic is still small, but this is a core requirement path and the stale-vs-missing distinction is important.  
**Suggestion:** Add local helpers such as `hasCurrentEvidence(evidenceList)` and `hasStaleEvidence(evidenceList)`, or make a small `ImplementEvidenceSet` class with `hasCurrent` / `hasStale` getters. That would align with the new class-based style and make the validation rule read directly.
**Suggestion:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R2  
**Issue:** The readiness decision repeats `readinessEvidence.some(...)` twice with different predicates. The logic is still small, but this is a core requirement path and the stale-vs-missing distinction is important.  
**Suggestion:** Add local helpers such as `hasCurrentEvidence(evidenceList)` and `hasStaleEvidence(evidenceList)`, or make a small `ImplementEvidenceSet` class with `hasCurrent` / `hasStale` getters. That would align with the new class-based style and make the validation rule read directly.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
