# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 1. Cache the schema per test instead of re-reading it repeatedly
**Failure mode:** refactor
**File:** specs/290-acceptance-review-policy/tests/artifact-verdict-contract.test.js
**Issue:** **File:** `specs/290-acceptance-review-policy/tests/artifact-verdict-contract.test.js`  
**Issue:** `loadSchema()` is called inside loops and multiple assertions, causing repeated filesystem reads and JSON parsing in the same test file.  
**Suggestion:** Load the schema once near the top of the `describe` block, or create a small `schemaErrors(artifact)` helper that closes over a cached schema.
**Suggestion:** **File:** `specs/290-acceptance-review-policy/tests/artifact-verdict-contract.test.js`  
**Issue:** `loadSchema()` is called inside loops and multiple assertions, causing repeated filesystem reads and JSON parsing in the same test file.  
**Suggestion:** Load the schema once near the top of the `describe` block, or create a small `schemaErrors(artifact)` helper that closes over a cached schema.
**Rationale:** Loop review proposal.

### 2. 2. Extract repeated required-field assertion logic
**Failure mode:** refactor
**File:** specs/290-acceptance-review-policy/tests/artifact-verdict-contract.test.js
**Issue:** **File:** `specs/290-acceptance-review-policy/tests/artifact-verdict-contract.test.js`  
**Issue:** The top-level, finding, and proposal required-field tests repeat the same loop/assertion pattern.  
**Suggestion:** Add a helper such as `assertFieldsAreRequired(fields, makeBrokenArtifact)` and reuse it across the three tests.
**Suggestion:** **File:** `specs/290-acceptance-review-policy/tests/artifact-verdict-contract.test.js`  
**Issue:** The top-level, finding, and proposal required-field tests repeat the same loop/assertion pattern.  
**Suggestion:** Add a helper such as `assertFieldsAreRequired(fields, makeBrokenArtifact)` and reuse it across the three tests.
**Rationale:** Loop review proposal.

### 3. 3. Centralize unresolved verdict values
**Failure mode:** refactor
**File:** specs/290-acceptance-review-policy/tests/completion-guard.test.js
**Issue:** **File:** `specs/290-acceptance-review-policy/tests/completion-guard.test.js`  
**Issue:** `["blocked", "amend_required", "user_decision_required"]` is repeated in three tests, which can drift if verdict policy changes.  
**Suggestion:** Define `const UNRESOLVED_VERDICTS = [...]` once and reuse it in all unresolved-verdict test loops.
**Suggestion:** **File:** `specs/290-acceptance-review-policy/tests/completion-guard.test.js`  
**Issue:** `["blocked", "amend_required", "user_decision_required"]` is repeated in three tests, which can drift if verdict policy changes.  
**Suggestion:** Define `const UNRESOLVED_VERDICTS = [...]` once and reuse it in all unresolved-verdict test loops.
**Rationale:** Loop review proposal.

### 4. 4. Simplify temp directory cleanup in looped tests
**Failure mode:** refactor
**File:** specs/290-acceptance-review-policy/tests/completion-guard.test.js
**Issue:** **File:** `specs/290-acceptance-review-policy/tests/completion-guard.test.js`  
**Issue:** Tests manually call `removeTmpDir(tmp); tmp = null;` inside loops while also relying on `afterEach`, making cleanup responsibility split across two patterns.  
**Suggestion:** Use a small helper or per-iteration `try/finally` so each temporary flow directory is cleaned in one consistent place.
**Suggestion:** **File:** `specs/290-acceptance-review-policy/tests/completion-guard.test.js`  
**Issue:** Tests manually call `removeTmpDir(tmp); tmp = null;` inside loops while also relying on `afterEach`, making cleanup responsibility split across two patterns.  
**Suggestion:** Use a small helper or per-iteration `try/finally` so each temporary flow directory is cleaned in one consistent place.
**Rationale:** Loop review proposal.

### 5. 5. Remove redundant `node:path` import style
**Failure mode:** refactor
**File:** specs/290-acceptance-review-policy/tests/completion-guard.test.js
**Issue:** **File:** `specs/290-acceptance-review-policy/tests/completion-guard.test.js`  
**Issue:** The file imports both `path` and `{ join }` from `node:path`, then uses both styles.  
**Suggestion:** Use one style consistently, preferably `path.join(...)`, and remove the separate `{ join }` import.
**Suggestion:** **File:** `specs/290-acceptance-review-policy/tests/completion-guard.test.js`  
**Issue:** The file imports both `path` and `{ join }` from `node:path`, then uses both styles.  
**Suggestion:** Use one style consistently, preferably `path.join(...)`, and remove the separate `{ join }` import.
**Rationale:** Loop review proposal.

### 6. 1. Extract repeated step-id fixtures
**Failure mode:** refactor
**File:** specs/290-acceptance-review-policy/tests/decision-routing.test.js
**Issue:** **File:** `specs/290-acceptance-review-policy/tests/decision-routing.test.js`  
**Issue:** The same long step-id arrays are repeated across setup and assertions, which makes future flow changes error-prone.  
**Suggestion:** Define constants such as `COMPLETED_THROUGH_RETRO`, `RESET_FROM_SPEC_THROUGH_ACCEPTANCE`, and `RESET_AFTER_IMPLEMENT`, then reuse them in `setupFlow` calls and status assertions.
**Suggestion:** **File:** `specs/290-acceptance-review-policy/tests/decision-routing.test.js`  
**Issue:** The same long step-id arrays are repeated across setup and assertions, which makes future flow changes error-prone.  
**Suggestion:** Define constants such as `COMPLETED_THROUGH_RETRO`, `RESET_FROM_SPEC_THROUGH_ACCEPTANCE`, and `RESET_AFTER_IMPLEMENT`, then reuse them in `setupFlow` calls and status assertions.
**Rationale:** Loop review proposal.

### 7. 2. Deduplicate CLI decision command setup
**Failure mode:** refactor
**File:** specs/290-acceptance-review-policy/tests/decision-routing.test.js
**Issue:** **File:** `specs/290-acceptance-review-policy/tests/decision-routing.test.js`  
**Issue:** The `["flow", "set", "acceptance-decision", "--choice", ...]` command shape is repeated in several tests.  
**Suggestion:** Add a helper like `setAcceptanceDecision(tmp, choice)` that wraps `runCli`. This keeps each test focused on the decision being exercised.
**Suggestion:** **File:** `specs/290-acceptance-review-policy/tests/decision-routing.test.js`  
**Issue:** The `["flow", "set", "acceptance-decision", "--choice", ...]` command shape is repeated in several tests.  
**Suggestion:** Add a helper like `setAcceptanceDecision(tmp, choice)` that wraps `runCli`. This keeps each test focused on the decision being exercised.
**Rationale:** Loop review proposal.

### 8. 3. Simplify path imports
**Failure mode:** refactor
**File:** specs/290-acceptance-review-policy/tests/decision-routing.test.js
**Issue:** **File:** `specs/290-acceptance-review-policy/tests/decision-routing.test.js`  
**Issue:** The file imports both `path` from `"node:path"` and `{ join }` from `"node:path"`, mixing namespace and named import styles for the same module.  
**Suggestion:** Use one style consistently, e.g. `const CLI = path.join(process.cwd(), "src/senti.js");`, and remove the named `join` import.
**Suggestion:** **File:** `specs/290-acceptance-review-policy/tests/decision-routing.test.js`  
**Issue:** The file imports both `path` from `"node:path"` and `{ join }` from `"node:path"`, mixing namespace and named import styles for the same module.  
**Suggestion:** Use one style consistently, e.g. `const CLI = path.join(process.cwd(), "src/senti.js");`, and remove the named `join` import.
**Rationale:** Loop review proposal.

### 9. 4. Avoid repeated fixture construction inside overrides
**Failure mode:** refactor
**File:** specs/290-acceptance-review-policy/tests/decision-routing.test.js
**Issue:** **File:** `specs/290-acceptance-review-policy/tests/decision-routing.test.js`  
**Issue:** The `decisionRequired` fixture calls `artifact()` multiple times just to copy the base finding, creating unnecessary duplication and making fixture intent harder to read.  
**Suggestion:** Store `const baseFinding = artifact().findings[0];` once, then reuse it when constructing the overridden `findings` array.
**Suggestion:** **File:** `specs/290-acceptance-review-policy/tests/decision-routing.test.js`  
**Issue:** The `decisionRequired` fixture calls `artifact()` multiple times just to copy the base finding, creating unnecessary duplication and making fixture intent harder to read.  
**Suggestion:** Store `const baseFinding = artifact().findings[0];` once, then reuse it when constructing the overridden `findings` array.
**Rationale:** Loop review proposal.

### 10. 5. Remove redundant assertion
**Failure mode:** refactor
**File:** specs/290-acceptance-review-policy/tests/decision-routing.test.js
**Issue:** **File:** `specs/290-acceptance-review-policy/tests/decision-routing.test.js`  
**Issue:** The first test asserts `approval` is `"pending"` inside the reset loop, then separately asserts it is not `"in_progress"`. The second assertion adds no meaningful coverage.  
**Suggestion:** Remove the `assert.notEqual(findStepById(state.steps, "approval").status, "in_progress");` line.
**Suggestion:** **File:** `specs/290-acceptance-review-policy/tests/decision-routing.test.js`  
**Issue:** The first test asserts `approval` is `"pending"` inside the reset loop, then separately asserts it is not `"in_progress"`. The second assertion adds no meaningful coverage.  
**Suggestion:** Remove the `assert.notEqual(findStepById(state.steps, "approval").status, "in_progress");` line.
**Rationale:** Loop review proposal.

### 11. 6. Bound spec-local test scanning
**Failure mode:** refactor
**File:** specs/290-acceptance-review-policy/tests/definition-policy.test.js
**Issue:** **File:** `specs/290-acceptance-review-policy/tests/definition-policy.test.js`  
**Issue:** The R16 test reads every `.test.js` file in the directory without an explicit upper bound. This conflicts with the bounded-resource-usage guardrail for bulk loading.  
**Suggestion:** Add a small explicit cap before reading files, e.g. assert `files.length <= 50`, or define an expected test filename list and iterate that list instead.
**Suggestion:** **File:** `specs/290-acceptance-review-policy/tests/definition-policy.test.js`  
**Issue:** The R16 test reads every `.test.js` file in the directory without an explicit upper bound. This conflicts with the bounded-resource-usage guardrail for bulk loading.  
**Suggestion:** Add a small explicit cap before reading files, e.g. assert `files.length <= 50`, or define an expected test filename list and iterate that list instead.
**Rationale:** Loop review proposal.

### 12. 1. Remove the unused temp directory churn in looped tests
**Failure mode:** refactor
**File:** specs/290-acceptance-review-policy/tests/migration-parity.test.js
**Issue:** **File:** `specs/290-acceptance-review-policy/tests/migration-parity.test.js`  
**Issue:** The two looped tests remove `tmp` and immediately create a new temp dir at the end of each iteration, including after the final iteration. That leaves an unused directory for `afterEach` and makes cleanup control harder to reason about.  
**Suggestion:** Create the temp directory inside each loop iteration and clean it in a `finally`, or set `tmp = null` after removing it. This removes the extra unused temp dir and simplifies lifecycle handling.
**Suggestion:** **File:** `specs/290-acceptance-review-policy/tests/migration-parity.test.js`  
**Issue:** The two looped tests remove `tmp` and immediately create a new temp dir at the end of each iteration, including after the final iteration. That leaves an unused directory for `afterEach` and makes cleanup control harder to reason about.  
**Suggestion:** Create the temp directory inside each loop iteration and clean it in a `finally`, or set `tmp = null` after removing it. This removes the extra unused temp dir and simplifies lifecycle handling.
**Rationale:** Loop review proposal.

### 13. 3. Use one path import style
**Failure mode:** refactor
**File:** specs/290-acceptance-review-policy/tests/migration-parity.test.js
**Issue:** **File:** `specs/290-acceptance-review-policy/tests/migration-parity.test.js`  
**Issue:** The file imports both `path` and `{ join }` from `node:path`, then uses both styles. This is a small naming/style inconsistency.  
**Suggestion:** Use `path.join(...)` everywhere and remove the named `join` import, or import only the specific functions used.
**Suggestion:** **File:** `specs/290-acceptance-review-policy/tests/migration-parity.test.js`  
**Issue:** The file imports both `path` and `{ join }` from `node:path`, then uses both styles. This is a small naming/style inconsistency.  
**Suggestion:** Use `path.join(...)` everywhere and remove the named `join` import, or import only the specific functions used.
**Rationale:** Loop review proposal.

### 14. 5. Avoid constructor-name assertions for lifecycle actions
**Failure mode:** refactor
**File:** specs/290-acceptance-review-policy/tests/migration-parity.test.js
**Issue:** **File:** `specs/290-acceptance-review-policy/tests/migration-parity.test.js`  
**Issue:** Assertions like `action.constructor.name === "IncrementMetric"` are brittle under refactors, minification, or class renames, and are inconsistent with stronger OOP-style type checks.  
**Suggestion:** Prefer importing the lifecycle action classes and using `instanceof`, or assert stable public behavior/properties if those classes are intentionally not exported.
**Suggestion:** **File:** `specs/290-acceptance-review-policy/tests/migration-parity.test.js`  
**Issue:** Assertions like `action.constructor.name === "IncrementMetric"` are brittle under refactors, minification, or class renames, and are inconsistent with stronger OOP-style type checks.  
**Suggestion:** Prefer importing the lifecycle action classes and using `instanceof`, or assert stable public behavior/properties if those classes are intentionally not exported.
**Rationale:** Loop review proposal.

### 15. 2. Deduplicate CLI fixture setup logic
**Failure mode:** refactor
**File:** specs/290-acceptance-review-policy/tests/next-action-contract.test.js
**Issue:** **File:** `specs/290-acceptance-review-policy/tests/next-action-contract.test.js`  
**Issue:** `runCli`, `CLI`, and flow-state initialization substantially duplicate the same patterns in `migration-parity.test.js`. Since these tests live in the same spec-local test suite, that duplication increases maintenance cost when the CLI envelope or fixture shape changes.  
**Suggestion:** Extract local reusable helpers within the touched spec test files, or consolidate common fixture-building patterns into one helper module if expanding the diff is acceptable in a later change.
**Suggestion:** **File:** `specs/290-acceptance-review-policy/tests/next-action-contract.test.js`  
**Issue:** `runCli`, `CLI`, and flow-state initialization substantially duplicate the same patterns in `migration-parity.test.js`. Since these tests live in the same spec-local test suite, that duplication increases maintenance cost when the CLI envelope or fixture shape changes.  
**Suggestion:** Extract local reusable helpers within the touched spec test files, or consolidate common fixture-building patterns into one helper module if expanding the diff is acceptable in a later change.
**Rationale:** Loop review proposal.

### 16. 4. Simplify envelope key assertions
**Failure mode:** refactor
**File:** specs/290-acceptance-review-policy/tests/next-action-contract.test.js
**Issue:** **File:** `specs/290-acceptance-review-policy/tests/next-action-contract.test.js`  
**Issue:** The first test checks required keys with `includes`, then separately filters unexpected keys. This is more verbose than needed and makes the optional `failurePolicy` contract harder to scan.  
**Suggestion:** Build an `expectedKeys` array that conditionally includes `"failurePolicy"` and assert `deepEqual(Object.keys(envelope.data).sort(), expectedKeys.sort())`.
**Suggestion:** **File:** `specs/290-acceptance-review-policy/tests/next-action-contract.test.js`  
**Issue:** The first test checks required keys with `includes`, then separately filters unexpected keys. This is more verbose than needed and makes the optional `failurePolicy` contract harder to scan.  
**Suggestion:** Build an `expectedKeys` array that conditionally includes `"failurePolicy"` and assert `deepEqual(Object.keys(envelope.data).sort(), expectedKeys.sort())`.
**Rationale:** Loop review proposal.

### 17. 5. Consolidate Failure Policy Assignment
**Failure mode:** refactor
**File:** src/flow/definition.js
**Issue:** **File:** `src/flow/definition.js`  
**Issue:** Failure policy literals are repeated across many `FlowNode` definitions, which makes future policy changes easy to miss.  
**Suggestion:** Add small factory helpers or constants for review/gate policies, e.g. `RETRY_FAILURE_POLICY`, `BLOCK_FAILURE_POLICY`, or helpers like `createGateNode(...)`, so review-family and gate-family defaults are declared consistently.
**Suggestion:** **File:** `src/flow/definition.js`  
**Issue:** Failure policy literals are repeated across many `FlowNode` definitions, which makes future policy changes easy to miss.  
**Suggestion:** Add small factory helpers or constants for review/gate policies, e.g. `RETRY_FAILURE_POLICY`, `BLOCK_FAILURE_POLICY`, or helpers like `createGateNode(...)`, so review-family and gate-family defaults are declared consistently.
**Rationale:** Loop review proposal.

### 18. 1. Bound Recursive Normalization
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Issue:** `clone()` and `removeUndefined()` recursively process arbitrary artifact input without explicit depth or size limits, which violates the `bounded-resource-usage` guardrail.  
**Suggestion:** Add bounded normalization, for example a `normalizeJsonValue(value, { maxDepth, maxArrayLength, maxObjectKeys })` helper, and reject artifacts exceeding those limits before schema validation.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Issue:** `clone()` and `removeUndefined()` recursively process arbitrary artifact input without explicit depth or size limits, which violates the `bounded-resource-usage` guardrail.  
**Suggestion:** Add bounded normalization, for example a `normalizeJsonValue(value, { maxDepth, maxArrayLength, maxObjectKeys })` helper, and reject artifacts exceeding those limits before schema validation.
**Rationale:** Loop review proposal.

### 19. 2. Avoid Re-reading Required Artifacts
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Issue:** `requiredArtifactStatus()` parses JSON and returns `{ value }`, but `buildAcceptanceReviewArtifactFromEvidence()` ignores that value and reads `test-execute-result.json` / `test-result-review.json` again.  
**Suggestion:** Store statuses in a `Map` during the first pass and reuse parsed `status.value` for failure detection.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Issue:** `requiredArtifactStatus()` parses JSON and returns `{ value }`, but `buildAcceptanceReviewArtifactFromEvidence()` ignores that value and reads `test-execute-result.json` / `test-result-review.json` again.  
**Suggestion:** Store statuses in a `Map` during the first pass and reuse parsed `status.value` for failure detection.
**Rationale:** Loop review proposal.

### 20. 3. Extract Repeated JSON Model Serialization
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Issue:** `AcceptanceFinding`, `RequirementAmendmentProposal`, and `MechanicalBlocker` repeat the same `Object.freeze(this)` plus `toJSON() { return { ...this }; }` pattern.  
**Suggestion:** Introduce a small shared base class or helper, such as `freezeJsonModel(instance)` / `toPlainObject(instance)`, to keep the model classes focused on their fields.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Issue:** `AcceptanceFinding`, `RequirementAmendmentProposal`, and `MechanicalBlocker` repeat the same `Object.freeze(this)` plus `toJSON() { return { ...this }; }` pattern.  
**Suggestion:** Introduce a small shared base class or helper, such as `freezeJsonModel(instance)` / `toPlainObject(instance)`, to keep the model classes focused on their fields.
**Rationale:** Loop review proposal.

### 21. 4. Centralize Acceptance Score Defaults
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Issue:** `buildAcceptanceReviewArtifactFromEvidence()` repeats `mechanicalBlockers.length ? 0 : 1` for every score field.  
**Suggestion:** Compute one local value, e.g. `const evidenceScore = mechanicalBlockers.length > 0 ? 0 : 1;`, and assign all four score fields from it.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Issue:** `buildAcceptanceReviewArtifactFromEvidence()` repeats `mechanicalBlockers.length ? 0 : 1` for every score field.  
**Suggestion:** Compute one local value, e.g. `const evidenceScore = mechanicalBlockers.length > 0 ? 0 : 1;`, and assign all four score fields from it.
**Rationale:** Loop review proposal.

### 22. 1. Bound acceptance blocker aggregation
**Failure mode:** refactor
**File:** src/flow/lib/flow-judgment-contract.js
**Issue:** **File:** `src/flow/lib/flow-judgment-contract.js`
**Issue:** `contractFromAcceptanceReviewArtifact()` copies `mechanicalBlockers` and `hardBlockers` with unbounded spreads. A large artifact can cause unbounded memory use, violating `bounded-resource-usage`.
**Suggestion:** Add an explicit maximum blocker count or validate this at artifact parsing time before constructing `blockingFindings`.
**Suggestion:** **File:** `src/flow/lib/flow-judgment-contract.js`
**Issue:** `contractFromAcceptanceReviewArtifact()` copies `mechanicalBlockers` and `hardBlockers` with unbounded spreads. A large artifact can cause unbounded memory use, violating `bounded-resource-usage`.
**Suggestion:** Add an explicit maximum blocker count or validate this at artifact parsing time before constructing `blockingFindings`.
**Rationale:** Loop review proposal.

### 23. 2. Remove duplicated acceptance-review validation code
**Failure mode:** refactor
**File:** src/flow/lib/flow-judgment-contract.js
**Issue:** **File:** `src/flow/lib/flow-judgment-contract.js`
**Issue:** `validateStepCompletionTransition()` repeats the `stepId === "acceptance-review" ? "STEP_ARTIFACT_VALIDATION_FAILED" : ...` branch and has a separate acceptance-review envelope block that mostly duplicates `buildCompletionValidationEnvelope()`.
**Suggestion:** Move the failure code into `StepCompletionPolicy` or a small helper such as `completionValidationFailureCode(stepId)`, and let `buildCompletionValidationEnvelope()` accept the code override.
**Suggestion:** **File:** `src/flow/lib/flow-judgment-contract.js`
**Issue:** `validateStepCompletionTransition()` repeats the `stepId === "acceptance-review" ? "STEP_ARTIFACT_VALIDATION_FAILED" : ...` branch and has a separate acceptance-review envelope block that mostly duplicates `buildCompletionValidationEnvelope()`.
**Suggestion:** Move the failure code into `StepCompletionPolicy` or a small helper such as `completionValidationFailureCode(stepId)`, and let `buildCompletionValidationEnvelope()` accept the code override.
**Rationale:** Loop review proposal.

### 24. 3. Avoid terse blocker variable names
**Failure mode:** refactor
**File:** src/flow/lib/flow-judgment-contract.js
**Issue:** **File:** `src/flow/lib/flow-judgment-contract.js`
**Issue:** `mechanical` and `hard` are abbreviated local names for artifact fields, while surrounding code appears to favor explicit domain terms.
**Suggestion:** Rename them to `mechanicalBlockers` and `hardBlockers` to match the artifact schema and make `blockingFindings: [...mechanicalBlockers, ...hardBlockers]` self-explanatory.
**Suggestion:** **File:** `src/flow/lib/flow-judgment-contract.js`
**Issue:** `mechanical` and `hard` are abbreviated local names for artifact fields, while surrounding code appears to favor explicit domain terms.
**Suggestion:** Rename them to `mechanicalBlockers` and `hardBlockers` to match the artifact schema and make `blockingFindings: [...mechanicalBlockers, ...hardBlockers]` self-explanatory.
**Rationale:** Loop review proposal.

### 25. 4. Centralize acceptance-review next-action metadata
**Failure mode:** refactor
**File:** src/flow/lib/flow-judgment-contract.js
**Issue:** **File:** `src/flow/lib/flow-judgment-contract.js`
**Issue:** `"final-regression"` and `"acceptance_review_not_pass"` are embedded directly in `contractFromAcceptanceReviewArtifact()`, while related step behavior also appears in `StepCompletionPolicy`.
**Suggestion:** Define acceptance-review transition constants or derive `nextAction`/failure behavior from the policy so the same transition rule is not maintained in multiple places.
**Suggestion:** **File:** `src/flow/lib/flow-judgment-contract.js`
**Issue:** `"final-regression"` and `"acceptance_review_not_pass"` are embedded directly in `contractFromAcceptanceReviewArtifact()`, while related step behavior also appears in `StepCompletionPolicy`.
**Suggestion:** Define acceptance-review transition constants or derive `nextAction`/failure behavior from the policy so the same transition rule is not maintained in multiple places.
**Rationale:** Loop review proposal.

### 26. 1. Bound acceptance blocker aggregation
**Failure mode:** refactor
**File:** src/flow/lib/flow-judgment-contract.js
**Issue:** **File:** `src/flow/lib/flow-judgment-contract.js`
**Issue:** `contractFromAcceptanceReviewArtifact()` copies `mechanicalBlockers` and `hardBlockers` with unbounded spreads. A large artifact can cause unbounded memory use, violating `bounded-resource-usage`.
**Suggestion:** Add an explicit maximum blocker count or validate this at artifact parsing time before constructing `blockingFindings`.
**Suggestion:** **File:** `src/flow/lib/flow-judgment-contract.js`
**Issue:** `contractFromAcceptanceReviewArtifact()` copies `mechanicalBlockers` and `hardBlockers` with unbounded spreads. A large artifact can cause unbounded memory use, violating `bounded-resource-usage`.
**Suggestion:** Add an explicit maximum blocker count or validate this at artifact parsing time before constructing `blockingFindings`.
**Rationale:** Loop review proposal.

### 27. 2. Remove duplicated acceptance-review validation code
**Failure mode:** refactor
**File:** src/flow/lib/flow-judgment-contract.js
**Issue:** **File:** `src/flow/lib/flow-judgment-contract.js`
**Issue:** `validateStepCompletionTransition()` repeats the `stepId === "acceptance-review" ? "STEP_ARTIFACT_VALIDATION_FAILED" : ...` branch and has a separate acceptance-review envelope block that mostly duplicates `buildCompletionValidationEnvelope()`.
**Suggestion:** Move the failure code into `StepCompletionPolicy` or a small helper such as `completionValidationFailureCode(stepId)`, and let `buildCompletionValidationEnvelope()` accept the code override.
**Suggestion:** **File:** `src/flow/lib/flow-judgment-contract.js`
**Issue:** `validateStepCompletionTransition()` repeats the `stepId === "acceptance-review" ? "STEP_ARTIFACT_VALIDATION_FAILED" : ...` branch and has a separate acceptance-review envelope block that mostly duplicates `buildCompletionValidationEnvelope()`.
**Suggestion:** Move the failure code into `StepCompletionPolicy` or a small helper such as `completionValidationFailureCode(stepId)`, and let `buildCompletionValidationEnvelope()` accept the code override.
**Rationale:** Loop review proposal.

### 28. 3. Avoid terse blocker variable names
**Failure mode:** refactor
**File:** src/flow/lib/flow-judgment-contract.js
**Issue:** **File:** `src/flow/lib/flow-judgment-contract.js`
**Issue:** `mechanical` and `hard` are abbreviated local names for artifact fields, while surrounding code appears to favor explicit domain terms.
**Suggestion:** Rename them to `mechanicalBlockers` and `hardBlockers` to match the artifact schema and make `blockingFindings: [...mechanicalBlockers, ...hardBlockers]` self-explanatory.
**Suggestion:** **File:** `src/flow/lib/flow-judgment-contract.js`
**Issue:** `mechanical` and `hard` are abbreviated local names for artifact fields, while surrounding code appears to favor explicit domain terms.
**Suggestion:** Rename them to `mechanicalBlockers` and `hardBlockers` to match the artifact schema and make `blockingFindings: [...mechanicalBlockers, ...hardBlockers]` self-explanatory.
**Rationale:** Loop review proposal.

### 29. 4. Centralize acceptance-review next-action metadata
**Failure mode:** refactor
**File:** src/flow/lib/flow-judgment-contract.js
**Issue:** **File:** `src/flow/lib/flow-judgment-contract.js`
**Issue:** `"final-regression"` and `"acceptance_review_not_pass"` are embedded directly in `contractFromAcceptanceReviewArtifact()`, while related step behavior also appears in `StepCompletionPolicy`.
**Suggestion:** Define acceptance-review transition constants or derive `nextAction`/failure behavior from the policy so the same transition rule is not maintained in multiple places.
**Suggestion:** **File:** `src/flow/lib/flow-judgment-contract.js`
**Issue:** `"final-regression"` and `"acceptance_review_not_pass"` are embedded directly in `contractFromAcceptanceReviewArtifact()`, while related step behavior also appears in `StepCompletionPolicy`.
**Suggestion:** Define acceptance-review transition constants or derive `nextAction`/failure behavior from the policy so the same transition rule is not maintained in multiple places.
**Rationale:** Loop review proposal.

### 30. 1. Bound fixture artifact loading
**Failure mode:** refactor
**File:** src/flow/lib/run-acceptance-review.js
**Issue:** **File:** `src/flow/lib/run-acceptance-review.js`  
**Issue:** `readFixtureArtifact()` reads and parses the full file from `SENTI_ACCEPTANCE_REVIEW_ARTIFACT` with no size limit. That violates the `bounded-resource-usage` guardrail for bulk data loading.  
**Suggestion:** Check `fs.statSync(file).size` before `readFileSync`, reject files over an explicit maximum, and parse only after that bound passes.
**Suggestion:** **File:** `src/flow/lib/run-acceptance-review.js`  
**Issue:** `readFixtureArtifact()` reads and parses the full file from `SENTI_ACCEPTANCE_REVIEW_ARTIFACT` with no size limit. That violates the `bounded-resource-usage` guardrail for bulk data loading.  
**Suggestion:** Check `fs.statSync(file).size` before `readFileSync`, reject files over an explicit maximum, and parse only after that bound passes.
**Rationale:** Loop review proposal.

### 31. 2. Clarify artifact override naming
**Failure mode:** refactor
**File:** src/flow/lib/run-acceptance-review.js
**Issue:** **File:** `src/flow/lib/run-acceptance-review.js`  
**Issue:** `readFixtureArtifact` sounds test-only, but it is controlled by a runtime environment variable and can affect command behavior.  
**Suggestion:** Rename it to something domain-specific like `readAcceptanceReviewArtifactOverride()`, and rename `file` to `artifactPath` for clearer intent.
**Suggestion:** **File:** `src/flow/lib/run-acceptance-review.js`  
**Issue:** `readFixtureArtifact` sounds test-only, but it is controlled by a runtime environment variable and can affect command behavior.  
**Suggestion:** Rename it to something domain-specific like `readAcceptanceReviewArtifactOverride()`, and rename `file` to `artifactPath` for clearer intent.
**Rationale:** Loop review proposal.

### 32. 3. Use domain-specific decision naming
**Failure mode:** refactor
**File:** src/flow/lib/set-acceptance-decision.js
**Issue:** **File:** `src/flow/lib/set-acceptance-decision.js`  
**Issue:** `choice` is generic inside a command with domain-specific acceptance decision behavior.  
**Suggestion:** Rename the local variable to `decisionChoice` or `acceptanceDecisionChoice`, then pass it as `choice: decisionChoice` to keep the external API unchanged while improving local readability.
**Suggestion:** **File:** `src/flow/lib/set-acceptance-decision.js`  
**Issue:** `choice` is generic inside a command with domain-specific acceptance decision behavior.  
**Suggestion:** Rename the local variable to `decisionChoice` or `acceptanceDecisionChoice`, then pass it as `choice: decisionChoice` to keep the external API unchanged while improving local readability.
**Rationale:** Loop review proposal.

### 33. 2. Avoid Inline Final-Regression Promotion Logic
**Failure mode:** refactor
**File:** src/flow/lib/set-step.js
**Issue:** **File:** `src/flow/lib/set-step.js`  
**Issue:** The new `promoteFinalRegression` handling embeds a specific step id and status transition directly inside the general set-step command. This makes side-effect behavior harder to scan and risks accumulating special cases in this command.  
**Suggestion:** Extract the mutation into a small helper in the same file, such as `promotePendingFinalRegression(ctx)`, and call it from the side-effect branch. That keeps the command flow readable and gives the special-case transition a named intent.
**Suggestion:** **File:** `src/flow/lib/set-step.js`  
**Issue:** The new `promoteFinalRegression` handling embeds a specific step id and status transition directly inside the general set-step command. This makes side-effect behavior harder to scan and risks accumulating special cases in this command.  
**Suggestion:** Extract the mutation into a small helper in the same file, such as `promotePendingFinalRegression(ctx)`, and call it from the side-effect branch. That keeps the command flow readable and gives the special-case transition a named intent.
**Rationale:** Loop review proposal.

### 34. 1. Add Explicit Evidence Read Bounds
**Failure mode:** refactor
**File:** src/flow/prompts/impl/acceptance-review.md
**Issue:** **File:** `src/flow/prompts/impl/acceptance-review.md`  
**Issue:** The prompt instructs acceptance-review to read implementation evidence, test evidence, issue-log, retro, and optional `report.json`, but does not define size/count limits. This risks violating the `bounded-resource-usage` guardrail for bulk data loading.  
**Suggestion:** Add explicit caps, for example maximum files, entries per artifact, characters per entry, and total characters read/summarized. Also specify that oversized inputs must be summarized or treated as blocked with bounded evidence.
**Suggestion:** **File:** `src/flow/prompts/impl/acceptance-review.md`  
**Issue:** The prompt instructs acceptance-review to read implementation evidence, test evidence, issue-log, retro, and optional `report.json`, but does not define size/count limits. This risks violating the `bounded-resource-usage` guardrail for bulk data loading.  
**Suggestion:** Add explicit caps, for example maximum files, entries per artifact, characters per entry, and total characters read/summarized. Also specify that oversized inputs must be summarized or treated as blocked with bounded evidence.
**Rationale:** Loop review proposal.

### 35. 3. Avoid duplicating acceptance-decision choice lists in help text
**Failure mode:** refactor
**File:** src/flow/registry.js
**Issue:** **File:** `src/flow/registry.js`
**Issue:** The `acceptance-decision` help text hardcodes the valid choices. If validation logic in `set-acceptance-decision.js` changes, the registry help can drift.
**Suggestion:** Define local constants for `USER_DECISION_CHOICES` and `BLOCKED_DECISION_CHOICES` near the registry entry and build the help text from them, or import shared constants if that module already exposes them.
**Suggestion:** **File:** `src/flow/registry.js`
**Issue:** The `acceptance-decision` help text hardcodes the valid choices. If validation logic in `set-acceptance-decision.js` changes, the registry help can drift.
**Suggestion:** Define local constants for `USER_DECISION_CHOICES` and `BLOCKED_DECISION_CHOICES` near the registry entry and build the help text from them, or import shared constants if that module already exposes them.
**Rationale:** Loop review proposal.

### 36. 1. Add explicit bounds to acceptance-review arrays and strings
**Failure mode:** refactor
**File:** src/flow/schemas/acceptance-review.schema.json
**Issue:** **File:** `src/flow/schemas/acceptance-review.schema.json`
**Issue:** `findings`, `requirementAmendmentProposals`, `mechanicalBlockers`, `hardBlockers`, `reportRefs`, and nested reference arrays are unbounded. This violates the `bounded-resource-usage` guardrail for bulk artifact loading.
**Suggestion:** Add `maxItems` to all arrays and `maxLength` to free-text strings such as `summary`, `reason`, `proposedRequirementSummary`, and `reimplementationReason`.
**Suggestion:** **File:** `src/flow/schemas/acceptance-review.schema.json`
**Issue:** `findings`, `requirementAmendmentProposals`, `mechanicalBlockers`, `hardBlockers`, `reportRefs`, and nested reference arrays are unbounded. This violates the `bounded-resource-usage` guardrail for bulk artifact loading.
**Suggestion:** Add `maxItems` to all arrays and `maxLength` to free-text strings such as `summary`, `reason`, `proposedRequirementSummary`, and `reimplementationReason`.
**Rationale:** Loop review proposal.

### 37. 2. Extract repeated schema fragments into `$defs`
**Failure mode:** refactor
**File:** src/flow/schemas/acceptance-review.schema.json
**Issue:** **File:** `src/flow/schemas/acceptance-review.schema.json`
**Issue:** The schema repeats common structures like string arrays, non-empty strings, ID references, and permissive object blocks.
**Suggestion:** Use JSON Schema `$defs` for reusable fragments such as `nonEmptyString`, `stringArray`, `finding`, `requirementAmendmentProposal`, and `mechanicalBlocker`, then reference them with `$ref`.
**Suggestion:** **File:** `src/flow/schemas/acceptance-review.schema.json`
**Issue:** The schema repeats common structures like string arrays, non-empty strings, ID references, and permissive object blocks.
**Suggestion:** Use JSON Schema `$defs` for reusable fragments such as `nonEmptyString`, `stringArray`, `finding`, `requirementAmendmentProposal`, and `mechanicalBlocker`, then reference them with `$ref`.
**Rationale:** Loop review proposal.

### 38. 1. Bound acceptance review arrays
**Failure mode:** refactor
**File:** src/flow/schemas/next-action/acceptance-review.schema.json
**Issue:** **File:** `src/flow/schemas/next-action/acceptance-review.schema.json`  
**Issue:** `findings`, `requirementAmendmentProposals`, `mechanicalBlockers`, and `hardBlockers` allow unbounded arrays of arbitrary objects, which violates the bounded-resource-usage guardrail for bulk data.  
**Suggestion:** Add explicit `maxItems` limits for each array, and consider `maxProperties` / bounded string lengths inside item schemas if the item shape is known.
**Suggestion:** **File:** `src/flow/schemas/next-action/acceptance-review.schema.json`  
**Issue:** `findings`, `requirementAmendmentProposals`, `mechanicalBlockers`, and `hardBlockers` allow unbounded arrays of arbitrary objects, which violates the bounded-resource-usage guardrail for bulk data.  
**Suggestion:** Add explicit `maxItems` limits for each array, and consider `maxProperties` / bounded string lengths inside item schemas if the item shape is known.
**Rationale:** Loop review proposal.

### 39. 2. Reuse the repeated array schema
**Failure mode:** refactor
**File:** src/flow/schemas/next-action/acceptance-review.schema.json
**Issue:** **File:** `src/flow/schemas/next-action/acceptance-review.schema.json`  
**Issue:** The four array fields repeat the same `{ "type": "array", "items": { "type": "object" } }` schema.  
**Suggestion:** Define a shared schema under `$defs` such as `objectList` and reference it from each property, especially if bounds or item constraints are added.
**Suggestion:** **File:** `src/flow/schemas/next-action/acceptance-review.schema.json`  
**Issue:** The four array fields repeat the same `{ "type": "array", "items": { "type": "object" } }` schema.  
**Suggestion:** Define a shared schema under `$defs` such as `objectList` and reference it from each property, especially if bounds or item constraints are added.
**Rationale:** Loop review proposal.

### 40. 3. Make flow command ordering easier to maintain
**Failure mode:** refactor
**File:** src/lib/plugin-registry.js
**Issue:** **File:** `src/lib/plugin-registry.js`  
**Issue:** `FLOW_COMMANDS` is a long single-line list where insertion order matters conceptually, but the formatting makes review of additions like `acceptance-review` harder.  
**Suggestion:** Expand the set entries to one command per line and group lifecycle/finalize commands visually so future stage insertions are easier to review.
**Suggestion:** **File:** `src/lib/plugin-registry.js`  
**Issue:** `FLOW_COMMANDS` is a long single-line list where insertion order matters conceptually, but the formatting makes review of additions like `acceptance-review` harder.  
**Suggestion:** Expand the set entries to one command per line and group lifecycle/finalize commands visually so future stage insertions are easier to review.
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 5
- Out of scope: 0
