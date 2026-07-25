# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 1. Remove Redundant Invalidation Path Lists
**Finding key:** loop-5ccd6bd8f04f08bb9351
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/impl-repair.json
**Requirement:** R8
**Issue:** **File:** `specs/333-failure-atomic-gate/impl-repair.json`  
**Requirement:** R8  
**Issue:** Each entry stores both `invalidatedArtifacts` and `invalidations[].path`, duplicating the same path inventory in two places. This creates drift risk, especially for R8 where evidence and changed-path inventory must match exactly.  
**Suggestion:** Prefer deriving `invalidatedArtifacts` from `invalidations[].path`, or add an explicit validation step that enforces exact equality between the two lists for every entry.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/impl-repair.json`  
**Requirement:** R8  
**Issue:** Each entry stores both `invalidatedArtifacts` and `invalidations[].path`, duplicating the same path inventory in two places. This creates drift risk, especially for R8 where evidence and changed-path inventory must match exactly.  
**Suggestion:** Prefer deriving `invalidatedArtifacts` from `invalidations[].path`, or add an explicit validation step that enforces exact equality between the two lists for every entry.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 2. 2. Normalize Repeated Repair Reason Text
**Finding key:** loop-1f631890f231249ef95a
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/impl-repair.json
**Requirement:** R8
**Issue:** **File:** `specs/333-failure-atomic-gate/impl-repair.json`  
**Requirement:** R8  
**Issue:** Several `invalidations[].reason` values repeat the parent entry `reason` verbatim and append only a mismatch classifier. This makes the ledger noisy and increases the chance of inconsistent wording across evidence fields.  
**Suggestion:** Keep the shared explanation only in entry-level `reason`, and store the classifier separately, for example as `invalidationReasonCode: "repair_fingerprint_mismatch"` or `associated_repair_fingerprint_mismatch`.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/impl-repair.json`  
**Requirement:** R8  
**Issue:** Several `invalidations[].reason` values repeat the parent entry `reason` verbatim and append only a mismatch classifier. This makes the ledger noisy and increases the chance of inconsistent wording across evidence fields.  
**Suggestion:** Keep the shared explanation only in entry-level `reason`, and store the classifier separately, for example as `invalidationReasonCode: "repair_fingerprint_mismatch"` or `associated_repair_fingerprint_mismatch`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 3. 1. Extract Repeated Positive Integer Validation
**Finding key:** loop-e7c733982faece231c45
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/repair-ledger-reconciliation.js
**Requirement:** R8
**Issue:** **File:** `specs/333-failure-atomic-gate/repair-ledger-reconciliation.js`  
**Requirement:** R8  
**Issue:** `preservedEntryCount` positive integer validation is duplicated in both `RepairLedgerReconciliationResult` and `RepairLedgerReconciliationAuthority`.  
**Suggestion:** Add a small helper such as `requirePositiveSafeInteger(value, field)` and use it for `issue` and `preservedEntryCount`. This keeps validation wording consistent and reduces repeated guard logic.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/repair-ledger-reconciliation.js`  
**Requirement:** R8  
**Issue:** `preservedEntryCount` positive integer validation is duplicated in both `RepairLedgerReconciliationResult` and `RepairLedgerReconciliationAuthority`.  
**Suggestion:** Add a small helper such as `requirePositiveSafeInteger(value, field)` and use it for `issue` and `preservedEntryCount`. This keeps validation wording consistent and reduces repeated guard logic.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 4. 2. Extract Bridge Delta Construction
**Finding key:** loop-a67a0e5457e55b3feed9
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/repair-ledger-reconciliation.js
**Requirement:** R8
**Issue:** **File:** `specs/333-failure-atomic-gate/repair-ledger-reconciliation.js`  
**Requirement:** R8  
**Issue:** The same `RepairDeltaArtifact` construction appears in the constructor and again in `prepare()`, with identical fields. This creates a maintenance risk if the bridge identity fields change.  
**Suggestion:** Store the validated delta created in the constructor, or add a private/helper method like `createBridgeDelta()` that returns the canonical bridge delta. Then `prepare()` can reuse that single source of truth.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/repair-ledger-reconciliation.js`  
**Requirement:** R8  
**Issue:** The same `RepairDeltaArtifact` construction appears in the constructor and again in `prepare()`, with identical fields. This creates a maintenance risk if the bridge identity fields change.  
**Suggestion:** Store the validated delta created in the constructor, or add a private/helper method like `createBridgeDelta()` that returns the canonical bridge delta. Then `prepare()` can reuse that single source of truth.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 5. 3. Replace JSON String Comparison With Named Equality Helper
**Finding key:** loop-b87e64c3a48894b2b29d
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/repair-ledger-reconciliation.js
**Requirement:** R8
**Issue:** **File:** `specs/333-failure-atomic-gate/repair-ledger-reconciliation.js`  
**Requirement:** R8  
**Issue:** `serialized(appliedBridgeLedger.toJSON()) !== serialized(plan.appliedLedger.toJSON())` and the delta comparison rely on ad hoc JSON serialization. The helper name `serialized` is also vague about why serialization is being used for equality.  
**Suggestion:** Rename or replace it with a purpose-specific helper such as `jsonEqual(left, right)` or `canonicalJson(value)`. That makes the exact-comparison intent clearer and keeps the comparison pattern consistent.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/repair-ledger-reconciliation.js`  
**Requirement:** R8  
**Issue:** `serialized(appliedBridgeLedger.toJSON()) !== serialized(plan.appliedLedger.toJSON())` and the delta comparison rely on ad hoc JSON serialization. The helper name `serialized` is also vague about why serialization is being used for equality.  
**Suggestion:** Rename or replace it with a purpose-specific helper such as `jsonEqual(left, right)` or `canonicalJson(value)`. That makes the exact-comparison intent clearer and keeps the comparison pattern consistent.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 4. Simplify Changed Path Grouping
**Finding key:** loop-2b9af25b78673e75066e
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/repair-ledger-reconciliation.js
**Requirement:** R8
**Issue:** **File:** `specs/333-failure-atomic-gate/repair-ledger-reconciliation.js`  
**Requirement:** R8  
**Issue:** Prefix calculation for `changedPathGroups` is embedded inside `prepare()`, making the method do validation, delta creation, grouping, and entry creation all at once.  
**Suggestion:** Extract the grouping logic into `buildChangedPathGroups(changedPaths)`. This makes `prepare()` easier to scan and isolates the path-prefix policy for future changes.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/repair-ledger-reconciliation.js`  
**Requirement:** R8  
**Issue:** Prefix calculation for `changedPathGroups` is embedded inside `prepare()`, making the method do validation, delta creation, grouping, and entry creation all at once.  
**Suggestion:** Extract the grouping logic into `buildChangedPathGroups(changedPaths)`. This makes `prepare()` easier to scan and isolates the path-prefix policy for future changes.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 5. Clarify Manifest Evidence Naming
**Finding key:** loop-96e4e5584ab89f623cb9
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/repair-ledger-reconciliation.js
**Requirement:** R8
**Issue:** **File:** `specs/333-failure-atomic-gate/repair-ledger-reconciliation.js`  
**Requirement:** R8  
**Issue:** `RepairLedgerManifestEvidence` only validates and stores a historical manifest hash, but the class name sounds broader than its actual responsibility.  
**Suggestion:** Rename it to something narrower, such as `RepairLedgerManifestHashEvidence` or `HistoricalManifestHashEvidence`, if this file is not yet consumed externally. This better communicates that R8 is binding to a specific manifest hash value, not a full manifest object.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/repair-ledger-reconciliation.js`  
**Requirement:** R8  
**Issue:** `RepairLedgerManifestEvidence` only validates and stores a historical manifest hash, but the class name sounds broader than its actual responsibility.  
**Suggestion:** Rename it to something narrower, such as `RepairLedgerManifestHashEvidence` or `HistoricalManifestHashEvidence`, if this file is not yet consumed externally. This better communicates that R8 is binding to a specific manifest hash value, not a full manifest object.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 1. Consolidate Repeated Overview Entries
**Finding key:** loop-46522c62b43bfdb06595
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/spec.json
**Requirement:** R1
**Issue:** **File:** `specs/333-failure-atomic-gate/spec.json`  
**Requirement:** R1  
**Issue:** The `overview.modules` and `overview.data_flow` sections repeat the same deferred-transition concept in both original entries and `added_by_task: T-1` entries. This makes the spec harder to maintain and increases the chance that future edits update one description but not the other.  
**Suggestion:** Merge the T-1 additions into the existing `run-gate.js` module and data-flow entries, preserving any task attribution only where it adds distinct information.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/spec.json`  
**Requirement:** R1  
**Issue:** The `overview.modules` and `overview.data_flow` sections repeat the same deferred-transition concept in both original entries and `added_by_task: T-1` entries. This makes the spec harder to maintain and increases the chance that future edits update one description but not the other.  
**Suggestion:** Merge the T-1 additions into the existing `run-gate.js` module and data-flow entries, preserving any task attribution only where it adds distinct information.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 2. Normalize Issue Naming
**Finding key:** loop-243512c597893fa2bd63
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/spec.json
**Requirement:** R8
**Issue:** **File:** `specs/333-failure-atomic-gate/spec.json`  
**Requirement:** R8  
**Issue:** The spec uses both `Issue` and `issue`-style phrasing, for example “Issue 456” and “issue-log”. The capitalized `Issue` reads like a proper schema field in some places but not others.  
**Suggestion:** Use a consistent term for the identity field, such as `issue_id` in authority/evidence descriptions, while keeping prose references like “Issue #456” only where referring to the external tracker item.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/spec.json`  
**Requirement:** R8  
**Issue:** The spec uses both `Issue` and `issue`-style phrasing, for example “Issue 456” and “issue-log”. The capitalized `Issue` reads like a proper schema field in some places but not others.  
**Suggestion:** Use a consistent term for the identity field, such as `issue_id` in authority/evidence descriptions, while keeping prose references like “Issue #456” only where referring to the external tracker item.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 10. 3. Remove Status Drift From Tasks
**Finding key:** loop-4dfc4b1ed7dc16854ded
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/spec.json
**Requirement:** R1
**Issue:** **File:** `specs/333-failure-atomic-gate/spec.json`  
**Requirement:** R1  
**Issue:** All requirements are marked `"status": "done"`, but every task still has `"status": "pending"`. That internal contradiction makes the spec ambiguous for automation and reviewers.  
**Suggestion:** Either update task statuses to match the completed requirements or remove task status fields if this file is meant to describe the approved plan rather than execution state.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/spec.json`  
**Requirement:** R1  
**Issue:** All requirements are marked `"status": "done"`, but every task still has `"status": "pending"`. That internal contradiction makes the spec ambiguous for automation and reviewers.  
**Suggestion:** Either update task statuses to match the completed requirements or remove task status fields if this file is meant to describe the approved plan rather than execution state.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 11. 4. Simplify Long Requirement R6
**Finding key:** loop-501a04eb31aeb5192a5c
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/spec.json
**Requirement:** R6
**Issue:** **File:** `specs/333-failure-atomic-gate/spec.json`  
**Requirement:** R6  
**Issue:** R6 contains a long finite inventory in a single string. It mixes export stability, phase behavior, config behavior, semantic envelope behavior, hook behavior, retry accounting, artifact paths, and routing. This is difficult to scan and easy to partially satisfy by mistake.  
**Suggestion:** Split R6 into a structured list field such as `"checks": [...]` while keeping the requirement ID unchanged. That would make each parity expectation independently reviewable without changing the requirement semantics.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/spec.json`  
**Requirement:** R6  
**Issue:** R6 contains a long finite inventory in a single string. It mixes export stability, phase behavior, config behavior, semantic envelope behavior, hook behavior, retry accounting, artifact paths, and routing. This is difficult to scan and easy to partially satisfy by mistake.  
**Suggestion:** Split R6 into a structured list field such as `"checks": [...]` while keeping the requirement ID unchanged. That would make each parity expectation independently reviewable without changing the requirement semantics.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 12. 1. Remove duplicated overview and data-flow statements
**Finding key:** loop-27c4d843a13744af3013
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/spec.md
**Requirement:** R1
**Issue:** **File:** `specs/333-failure-atomic-gate/spec.md`  
**Requirement:** R1  
**Issue:** The `Overview` repeats the `run-gate.js` responsibility twice, and `Data Flow` repeats the inferred gate execution flow in near-identical terms. This makes the spec harder to maintain and increases the chance that later edits update one copy but not the other.  
**Suggestion:** Keep one canonical bullet for `src/flow/lib/run-gate.js` in `Overview`, and one canonical sequence in `Data Flow`. Fold the repeated “validated pending transition / semantic evaluation / artifact persistence / commit” wording into the first occurrence.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/spec.md`  
**Requirement:** R1  
**Issue:** The `Overview` repeats the `run-gate.js` responsibility twice, and `Data Flow` repeats the inferred gate execution flow in near-identical terms. This makes the spec harder to maintain and increases the chance that later edits update one copy but not the other.  
**Suggestion:** Keep one canonical bullet for `src/flow/lib/run-gate.js` in `Overview`, and one canonical sequence in `Data Flow`. Fold the repeated “validated pending transition / semantic evaluation / artifact persistence / commit” wording into the first occurrence.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 2. Remove empty placeholder sections
**Finding key:** loop-94336883ea196b40d8b1
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/spec.md
**Requirement:** R6
**Issue:** **File:** `specs/333-failure-atomic-gate/spec.md`  
**Requirement:** R6  
**Issue:** `Clarifications (Q&A)` and `Open Questions` contain only empty placeholders. They add noise without preserving any decision or review context.  
**Suggestion:** Delete these sections until they contain actual content, or replace them with explicit “None” text if the project template requires the headings.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/spec.md`  
**Requirement:** R6  
**Issue:** `Clarifications (Q&A)` and `Open Questions` contain only empty placeholders. They add noise without preserving any decision or review context.  
**Suggestion:** Delete these sections until they contain actual content, or replace them with explicit “None” text if the project template requires the headings.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 3. Avoid dangling task references
**Finding key:** loop-1920a0767a7c4bea1acd
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/spec.md
**Requirement:** R8
**Issue:** **File:** `specs/333-failure-atomic-gate/spec.md`  
**Requirement:** R8  
**Issue:** The `Tasks` section references `tasks/T-1.md`, `tasks/T-2.md`, and `tasks/T-3.md`, but those files are not part of this diff. For a new spec file, this creates references that may be stale or absent in the submitted change set.  
**Suggestion:** Either include the referenced task files in the change set or remove the `see tasks/...` lines until those files exist.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/spec.md`  
**Requirement:** R8  
**Issue:** The `Tasks` section references `tasks/T-1.md`, `tasks/T-2.md`, and `tasks/T-3.md`, but those files are not part of this diff. For a new spec file, this creates references that may be stale or absent in the submitted change set.  
**Suggestion:** Either include the referenced task files in the change set or remove the `see tasks/...` lines until those files exist.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 15. 1. Extract Shared Boundary Lists
**Finding key:** loop-b0b72178465ef8fbaf54
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js
**Requirement:** R5
**Issue:** **File:** `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`  
**Requirement:** R5  
**Issue:** The boundary list `["validation", "agent", "output-protocol", "artifact-write"]` is repeated across multiple tests. This makes it easier for retry/failure coverage to drift if a boundary is added or renamed.  
**Suggestion:** Define a shared constant such as `const PRE_COMMIT_BOUNDARIES = [...]` near the other test constants and reuse it in all boundary loops.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`  
**Requirement:** R5  
**Issue:** The boundary list `["validation", "agent", "output-protocol", "artifact-write"]` is repeated across multiple tests. This makes it easier for retry/failure coverage to drift if a boundary is added or renamed.  
**Suggestion:** Define a shared constant such as `const PRE_COMMIT_BOUNDARIES = [...]` near the other test constants and reuse it in all boundary loops.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 16. 2. Extract Repeated Fixture Cleanup Pattern
**Finding key:** loop-0fdaa324963dedb66cb4
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js
**Requirement:** R1
**Issue:** **File:** `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`  
**Requirement:** R1  
**Issue:** Many tests repeat the same `const fixture = persistedGateFixture(...); try { ... } finally { removeTmpDir(fixture.root); }` structure. This adds noise and makes the test intent harder to scan.  
**Suggestion:** Add a small helper such as `async function withPersistedGateFixture(prefix, fn)` that creates the fixture, invokes the callback, and always removes the temp directory.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`  
**Requirement:** R1  
**Issue:** Many tests repeat the same `const fixture = persistedGateFixture(...); try { ... } finally { removeTmpDir(fixture.root); }` structure. This adds noise and makes the test intent harder to scan.  
**Suggestion:** Add a small helper such as `async function withPersistedGateFixture(prefix, fn)` that creates the fixture, invokes the callback, and always removes the temp directory.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 17. 3. Rename `transitionFor` For Clarity
**Finding key:** loop-0ab5547778164a8662e1
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js
**Requirement:** R2
**Issue:** **File:** `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`  
**Requirement:** R2  
**Issue:** `transitionFor(state)` is vague; it hides that the helper constructs an inferred gate transition using phase resolution and a `GateMutationOwner`.  
**Suggestion:** Rename it to something more explicit, such as `inferredGateTransitionForState` or `createInferredGateTransition`.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`  
**Requirement:** R2  
**Issue:** `transitionFor(state)` is vague; it hides that the helper constructs an inferred gate transition using phase resolution and a `GateMutationOwner`.  
**Suggestion:** Rename it to something more explicit, such as `inferredGateTransitionForState` or `createInferredGateTransition`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 18. 4. Remove Or Justify `PersistedStaleGateManager.appendMetric`
**Finding key:** loop-cc2300a288ec5630ce6f
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js
**Requirement:** R6
**Issue:** **File:** `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`  
**Requirement:** R6  
**Issue:** `appendMetric()` on `PersistedStaleGateManager` appears unused in this test file, while retry metric behavior is tested using a separate inline `retryContext`.  
**Suggestion:** Remove `recordedMetrics` and `appendMetric()` from the fake manager unless a future test needs manager-backed metrics.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`  
**Requirement:** R6  
**Issue:** `appendMetric()` on `PersistedStaleGateManager` appears unused in this test file, while retry metric behavior is tested using a separate inline `retryContext`.  
**Suggestion:** Remove `recordedMetrics` and `appendMetric()` from the fake manager unless a future test needs manager-backed metrics.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 19. 5. Extract Repeated Persisted JSON Reads
**Finding key:** loop-44dcd44d8bec02dac5d5
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js
**Requirement:** R3
**Issue:** **File:** `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`  
**Requirement:** R3  
**Issue:** The tests repeatedly inline `JSON.parse(fs.readFileSync(path.join(...), "utf8"))` for gate result and issue-log files. This creates duplication and obscures assertions.  
**Suggestion:** Add helpers such as `readJson(specDir, name)` or more specific helpers like `readGateResult(specDir)` and `readIssueLog(specDir)`.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`  
**Requirement:** R3  
**Issue:** The tests repeatedly inline `JSON.parse(fs.readFileSync(path.join(...), "utf8"))` for gate result and issue-log files. This creates duplication and obscures assertions.  
**Suggestion:** Add helpers such as `readJson(specDir, name)` or more specific helpers like `readGateResult(specDir)` and `readIssueLog(specDir)`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 20. 6. Replace Stringly Typed Semantic Results With Constants
**Finding key:** loop-1f7a7253467c6e9f9896
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js
**Requirement:** R6
**Issue:** **File:** `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`  
**Requirement:** R6  
**Issue:** `"pass"` and `"fail"` are repeated throughout helper defaults, loops, and assertions. The values are important protocol literals, so typos would be easy to miss.  
**Suggestion:** Define `const SEMANTIC_RESULTS = ["pass", "fail"]` and optionally `const PASS = "pass"; const FAIL = "fail";` for defaults and comparisons.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`  
**Requirement:** R6  
**Issue:** `"pass"` and `"fail"` are repeated throughout helper defaults, loops, and assertions. The values are important protocol literals, so typos would be easy to miss.  
**Suggestion:** Define `const SEMANTIC_RESULTS = ["pass", "fail"]` and optionally `const PASS = "pass"; const FAIL = "fail";` for defaults and comparisons.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 21. 7. Split Large Parity Test Into Focused Tests
**Finding key:** loop-cb11d8de3a374f057449
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js
**Requirement:** R6
**Issue:** **File:** `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`  
**Requirement:** R6  
**Issue:** `"R6: provider, lifecycle, retry, artifact, and routing parity is exercised directly"` checks provider config, artifact persistence, retry metrics, routing, and command args in one broad test. This mixes unrelated failure causes and makes regressions harder to localize.  
**Suggestion:** Split it into smaller R6 tests, for example provider config parity, artifact path/result parity, retry counter parity, and lifecycle routing parity.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`  
**Requirement:** R6  
**Issue:** `"R6: provider, lifecycle, retry, artifact, and routing parity is exercised directly"` checks provider config, artifact persistence, retry metrics, routing, and command args in one broad test. This mixes unrelated failure causes and makes regressions harder to localize.  
**Suggestion:** Split it into smaller R6 tests, for example provider config parity, artifact path/result parity, retry counter parity, and lifecycle routing parity.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 22. 1. Assert Both Issue Guard Options Explicitly
**Finding key:** loop-da47251a49a4f3f65902
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/tests/parked-resume-help.test.js
**Requirement:** R7
**Issue:** **File:** `specs/333-failure-atomic-gate/tests/parked-resume-help.test.js`  
**Requirement:** R7  
**Issue:** The final assertion uses `/--expect-issue|--expect-no-issue/`, so the test passes if only one of the two guard options is present. That weakens coverage for “retaining existing usage and target-guard option output.”  
**Suggestion:** Replace it with two explicit assertions:

```js
assert.match(help, /--expect-issue/);
assert.match(help, /--expect-no-issue/);
```
**Suggestion:** **File:** `specs/333-failure-atomic-gate/tests/parked-resume-help.test.js`  
**Requirement:** R7  
**Issue:** The final assertion uses `/--expect-issue|--expect-no-issue/`, so the test passes if only one of the two guard options is present. That weakens coverage for “retaining existing usage and target-guard option output.”  
**Suggestion:** Replace it with two explicit assertions:

```js
assert.match(help, /--expect-issue/);
assert.match(help, /--expect-no-issue/);
```
**Disposition:** informational
**Rationale:** Loop review proposal.

### 23. 1. Replace Hard-Coded Bridge Values With Fixture Authority Values
**Finding key:** loop-69f9658cfe17990e9f10
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/tests/repair-ledger-reconciliation.test.js
**Requirement:** R8
**Issue:** **File:** `specs/333-failure-atomic-gate/tests/repair-ledger-reconciliation.test.js`  
**Requirement:** R8  
**Issue:** The test mixes fixture-driven expectations with hard-coded values like `"repair-006"` and `5`, even though those values already exist as `authority.bridgeEntryId` and `authority.preservedEntryCount`. This creates duplicate sources of truth and makes the test more brittle if the fixture changes.  
**Suggestion:** Replace hard-coded assertions with `fixture.authority.bridgeEntryId` and `fixture.authority.preservedEntryCount`, including the ledger slice length.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/tests/repair-ledger-reconciliation.test.js`  
**Requirement:** R8  
**Issue:** The test mixes fixture-driven expectations with hard-coded values like `"repair-006"` and `5`, even though those values already exist as `authority.bridgeEntryId` and `authority.preservedEntryCount`. This creates duplicate sources of truth and makes the test more brittle if the fixture changes.  
**Suggestion:** Replace hard-coded assertions with `fixture.authority.bridgeEntryId` and `fixture.authority.preservedEntryCount`, including the ledger slice length.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 24. 2. Extract Repeated File Byte Preservation Assertion
**Finding key:** loop-06f5da355fdcfb484edc
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/tests/repair-ledger-reconciliation.test.js
**Requirement:** R8
**Issue:** **File:** `specs/333-failure-atomic-gate/tests/repair-ledger-reconciliation.test.js`  
**Requirement:** R8  
**Issue:** The mismatch test repeats ledger and delta byte checks inside every variant loop. The repeated read/assert pattern obscures the core purpose of each authority mismatch case.  
**Suggestion:** Add a small helper such as `assertArtifactBytesUnchanged({ ledgerPath, deltaPath, beforeLedger, beforeDelta }, name)` and call it from the loop.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/tests/repair-ledger-reconciliation.test.js`  
**Requirement:** R8  
**Issue:** The mismatch test repeats ledger and delta byte checks inside every variant loop. The repeated read/assert pattern obscures the core purpose of each authority mismatch case.  
**Suggestion:** Add a small helper such as `assertArtifactBytesUnchanged({ ledgerPath, deltaPath, beforeLedger, beforeDelta }, name)` and call it from the loop.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 25. 3. Rename `value` In Mutation Callbacks
**Finding key:** loop-4bf6d5a5098eca30432d
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/tests/repair-ledger-reconciliation.test.js
**Requirement:** R8
**Issue:** **File:** `specs/333-failure-atomic-gate/tests/repair-ledger-reconciliation.test.js`  
**Requirement:** R8  
**Issue:** The variant mutation callbacks use the generic parameter name `value`, but the object being mutated is specifically reconciliation authority input. The vague name makes the table slightly harder to scan.  
**Suggestion:** Rename the callback parameter to `authorityInput` or `authorityJson` in each variant entry.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/tests/repair-ledger-reconciliation.test.js`  
**Requirement:** R8  
**Issue:** The variant mutation callbacks use the generic parameter name `value`, but the object being mutated is specifically reconciliation authority input. The vague name makes the table slightly harder to scan.  
**Suggestion:** Rename the callback parameter to `authorityInput` or `authorityJson` in each variant entry.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 26. 4. Simplify The Single-Import Formatting
**Finding key:** loop-fbbf0259480d354581d8
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/tests/repair-ledger-reconciliation.test.js
**Requirement:** R8
**Issue:** **File:** `specs/333-failure-atomic-gate/tests/repair-ledger-reconciliation.test.js`  
**Requirement:** R8  
**Issue:** `RepairDeltaArtifact` is imported using a multi-line named import even though it is the only imported symbol from that module. This is inconsistent with the compact import style used elsewhere in the file.  
**Suggestion:** Change it to `import { RepairDeltaArtifact } from "../../../src/flow/lib/repair-state-identity.js";`.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/tests/repair-ledger-reconciliation.test.js`  
**Requirement:** R8  
**Issue:** `RepairDeltaArtifact` is imported using a multi-line named import even though it is the only imported symbol from that module. This is inconsistent with the compact import style used elsewhere in the file.  
**Suggestion:** Change it to `import { RepairDeltaArtifact } from "../../../src/flow/lib/repair-state-identity.js";`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 27. 1. Avoid Rebuilding the Step Map Across Capture and Assert
**Finding key:** loop-48b7babecb4d67a3e167
**Failure mode:** refactor
**File:** src/flow/lib/gate-mutation-owner.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/gate-mutation-owner.js`  
**Requirement:** R1  
**Issue:** `captureTransitionStatuses()` and `assertTransitionStatuses()` both rebuild the transition step map with `transitionStepMap(state, this.taskId)`. In the intended atomic gate flow, these methods are likely called as a pair around a commit, so the same lookup structure is repeatedly reconstructed.  
**Suggestion:** Consider returning the captured step lookup context from `captureTransitionStatuses()` or extracting a small transition guard object that owns both the `expectedStatuses` and the resolved lookup scope. This would reduce duplicate traversal and make the capture/assert lifecycle clearer.
**Suggestion:** **File:** `src/flow/lib/gate-mutation-owner.js`  
**Requirement:** R1  
**Issue:** `captureTransitionStatuses()` and `assertTransitionStatuses()` both rebuild the transition step map with `transitionStepMap(state, this.taskId)`. In the intended atomic gate flow, these methods are likely called as a pair around a commit, so the same lookup structure is repeatedly reconstructed.  
**Suggestion:** Consider returning the captured step lookup context from `captureTransitionStatuses()` or extracting a small transition guard object that owns both the `expectedStatuses` and the resolved lookup scope. This would reduce duplicate traversal and make the capture/assert lifecycle clearer.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 28. 2. Rename `transitionStepMap` for Scope Clarity
**Finding key:** loop-e5d4f90cf9517c7de438
**Failure mode:** refactor
**File:** src/flow/lib/gate-mutation-owner.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/gate-mutation-owner.js`  
**Requirement:** R2  
**Issue:** `transitionStepMap` sounds like a map of transitions, but it actually builds a map of steps visible to a transition, combining root flow steps and selected task steps.  
**Suggestion:** Rename it to something like `buildTransitionStepLookup`, `scopedStepMap`, or `buildScopedStepMap` to better describe the behavior.
**Suggestion:** **File:** `src/flow/lib/gate-mutation-owner.js`  
**Requirement:** R2  
**Issue:** `transitionStepMap` sounds like a map of transitions, but it actually builds a map of steps visible to a transition, combining root flow steps and selected task steps.  
**Suggestion:** Rename it to something like `buildTransitionStepLookup`, `scopedStepMap`, or `buildScopedStepMap` to better describe the behavior.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 29. 3. Add an Explicit Bound or Rationale for Flattened Step Traversal
**Finding key:** loop-7a2821c104c601ec4711
**Failure mode:** refactor
**File:** src/flow/lib/gate-mutation-owner.js
**Requirement:** R8
**Issue:** **File:** `src/flow/lib/gate-mutation-owner.js`  
**Requirement:** R8  
**Issue:** The new `transitionStepMap()` eagerly flattens `flowState.steps` and optionally `task.steps` without an explicit upper bound. This may violate the `bounded-resource-usage` guardrail if step trees can grow with user/spec input.  
**Suggestion:** Add an explicit maximum step count/depth check around this traversal, reuse an existing bounded traversal helper if available, or document an acknowledged exception tied to the spec constraints if the step tree size is already bounded elsewhere.
**Suggestion:** **File:** `src/flow/lib/gate-mutation-owner.js`  
**Requirement:** R8  
**Issue:** The new `transitionStepMap()` eagerly flattens `flowState.steps` and optionally `task.steps` without an explicit upper bound. This may violate the `bounded-resource-usage` guardrail if step trees can grow with user/spec input.  
**Suggestion:** Add an explicit maximum step count/depth check around this traversal, reuse an existing bounded traversal helper if available, or document an acknowledged exception tied to the spec constraints if the step tree size is already bounded elsewhere.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 30. 1. Remove unused import
**Finding key:** loop-77fd07a7e3a8884b1f8e
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R1  
**Issue:** `flattenSteps` is imported from `./step-tree.js` but is not used anywhere in the diff.  
**Suggestion:** Remove the unused import to keep the module clean and avoid lint noise.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R1  
**Issue:** `flattenSteps` is imported from `./step-tree.js` but is not used anywhere in the diff.  
**Suggestion:** Remove the unused import to keep the module clean and avoid lint noise.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 31. 2. Consolidate inferred-transition persistence flow
**Finding key:** loop-f81226ced22124108fab
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R3  
**Issue:** The checkpoint, artifact persistence, semantic-result validation, and inferred-transition commit sequence now exists in two places: `RunGateCommand.execute()` and `runGatePhaseWithDependencies()`. This duplicates failure-boundary logic that must remain byte-identical and atomic.  
**Suggestion:** Extract a shared helper for “persist required gate artifacts, then commit inferred transition, rollback durable surfaces on pre-commit failure” and have both call sites use it.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R3  
**Issue:** The checkpoint, artifact persistence, semantic-result validation, and inferred-transition commit sequence now exists in two places: `RunGateCommand.execute()` and `runGatePhaseWithDependencies()`. This duplicates failure-boundary logic that must remain byte-identical and atomic.  
**Suggestion:** Extract a shared helper for “persist required gate artifacts, then commit inferred transition, rollback durable surfaces on pre-commit failure” and have both call sites use it.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 32. 3. Rename `identityProbeError`
**Finding key:** loop-5e5787ab6aec90a8d495
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R6  
**Issue:** `identityProbeError` is vague; the code is specifically probing stale integration test evidence before full trust validation.  
**Suggestion:** Rename it to `staleEvidenceProbeError` or `artifactIdentityProbeError` so the delayed throw is easier to understand.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R6  
**Issue:** `identityProbeError` is vague; the code is specifically probing stale integration test evidence before full trust validation.  
**Suggestion:** Rename it to `staleEvidenceProbeError` or `artifactIdentityProbeError` so the delayed throw is easier to understand.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 33. 4. Avoid brittle root reconstruction from `specDir`
**Finding key:** loop-fbd858899a1a7b5351e4
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R4  
**Issue:** `runGatePhaseWithDependencies()` derives `root` with `path.dirname(path.dirname(specDir))`, which assumes a fixed spec directory depth. That makes the helper fragile if spec layout changes.  
**Suggestion:** Pass `root` explicitly into `runGatePhaseWithDependencies()` when fingerprint construction may be needed.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R4  
**Issue:** `runGatePhaseWithDependencies()` derives `root` with `path.dirname(path.dirname(specDir))`, which assumes a fixed spec directory depth. That makes the helper fragile if spec layout changes.  
**Suggestion:** Pass `root` explicitly into `runGatePhaseWithDependencies()` when fingerprint construction may be needed.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 34. 5. Simplify semantic result predicate
**Finding key:** loop-3ba05b18ce1ca83692c1
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R3  
**Issue:** `completedSemanticGateResult()` encodes `"pass"` and semantic `"fail"` as a custom boolean, but callers use it to decide whether commit is allowed. The function name does not communicate that tooling/artifact failures are intentionally excluded.  
**Suggestion:** Rename it to something more precise, such as `isCommitEligibleSemanticGateResult()`, and keep the PASS/AI semantic FAIL criteria centralized there.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R3  
**Issue:** `completedSemanticGateResult()` encodes `"pass"` and semantic `"fail"` as a custom boolean, but callers use it to decide whether commit is allowed. The function name does not communicate that tooling/artifact failures are intentionally excluded.  
**Suggestion:** Rename it to something more precise, such as `isCommitEligibleSemanticGateResult()`, and keep the PASS/AI semantic FAIL criteria centralized there.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 35. 1. Remove Duplicate `--parked` Help Wording
**Finding key:** loop-bc8ecec8c4397963ec30
**Failure mode:** refactor
**File:** src/flow/registry.js
**Requirement:** R7
**Issue:** **File:** `src/flow/registry.js`  
**Requirement:** R7  
**Issue:** The updated summary line and the following `With --parked...` line now both say that parked resume restores one exact managed-worktree pointer. This makes the help text repetitive.  
**Suggestion:** Keep the new R7-compliant summary line, and simplify the next line to only add the distinct detail, for example: `With --parked, restore from the pointer's saved execution root.`
**Suggestion:** **File:** `src/flow/registry.js`  
**Requirement:** R7  
**Issue:** The updated summary line and the following `With --parked...` line now both say that parked resume restores one exact managed-worktree pointer. This makes the help text repetitive.  
**Suggestion:** Keep the new R7-compliant summary line, and simplify the next line to only add the distinct detail, for example: `With --parked, restore from the pointer's saved execution root.`
**Disposition:** informational
**Rationale:** Loop review proposal.

### 36. 1. Clarify Snapshot Variable Name
**Finding key:** loop-e2250e17ea959bb84e7a
**Failure mode:** refactor
**File:** tests/unit/flow/gate-phase-inference.test.js
**Requirement:** R3
**Issue:** **File:** `tests/unit/flow/gate-phase-inference.test.js`  
**Requirement:** R3  
**Issue:** The variable name `before` is vague for a test whose core assertion is atomic preservation of persisted step state.  
**Suggestion:** Rename `before` to something like `preTransitionSnapshot` or `preCommitSnapshot` so the assertion reads directly against the requirement.
**Suggestion:** **File:** `tests/unit/flow/gate-phase-inference.test.js`  
**Requirement:** R3  
**Issue:** The variable name `before` is vague for a test whose core assertion is atomic preservation of persisted step state.  
**Suggestion:** Rename `before` to something like `preTransitionSnapshot` or `preCommitSnapshot` so the assertion reads directly against the requirement.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 37. 2. Align Test Title With Current Requirement Language
**Finding key:** loop-134fca0704317b3e3ca3
**Failure mode:** refactor
**File:** tests/unit/flow/gate-phase-inference.test.js
**Requirement:** R6
**Issue:** **File:** `tests/unit/flow/gate-phase-inference.test.js`  
**Requirement:** R6  
**Issue:** The test name still starts with `AC3`, while the review context and related requirements are expressed as `R3`/`R6`. This creates naming drift in the test suite.  
**Suggestion:** Rename the test to reference the requirement-oriented behavior directly, for example: `R3/R6: preserves inferred gate steps when downstream integration validation does not complete`.
**Suggestion:** **File:** `tests/unit/flow/gate-phase-inference.test.js`  
**Requirement:** R6  
**Issue:** The test name still starts with `AC3`, while the review context and related requirements are expressed as `R3`/`R6`. This creates naming drift in the test suite.  
**Suggestion:** Rename the test to reference the requirement-oriented behavior directly, for example: `R3/R6: preserves inferred gate steps when downstream integration validation does not complete`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 38. 1. Consolidate Repeated Deferred Gate Flow Descriptions
**Finding key:** loop-c5ee3229c45598b0b8a1
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/spec.json
**Requirement:** R1
**Issue:** **File:** `specs/333-failure-atomic-gate/spec.json`
**Requirement:** R1
**Issue:** Both `spec.json` and `spec.md` repeat the same deferred/inferred gate transition overview and data-flow language. This creates cross-file drift risk because the machine-readable and human-readable spec can diverge independently.
**Suggestion:** Make one version canonical, then regenerate or mechanically mirror the other. At minimum, collapse the duplicate `run-gate.js` and data-flow entries in both files to one matching description.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/spec.json`
**Requirement:** R1
**Issue:** Both `spec.json` and `spec.md` repeat the same deferred/inferred gate transition overview and data-flow language. This creates cross-file drift risk because the machine-readable and human-readable spec can diverge independently.
**Suggestion:** Make one version canonical, then regenerate or mechanically mirror the other. At minimum, collapse the duplicate `run-gate.js` and data-flow entries in both files to one matching description.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 39. 2. Align Requirement Naming Across Spec And Tests
**Finding key:** loop-3a59daa605f28a476a09
**Failure mode:** refactor
**File:** tests/unit/flow/gate-phase-inference.test.js
**Requirement:** R6
**Issue:** **File:** `tests/unit/flow/gate-phase-inference.test.js`
**Requirement:** R6
**Issue:** The test still uses `AC3` naming while the spec and review summaries use `R1` through `R8`. This creates cross-file requirement-name drift between executable coverage and the current spec contract.
**Suggestion:** Rename the test to use requirement IDs consistent with `spec.json` and `spec.md`, for example `R3/R6: preserves inferred gate steps when downstream integration validation does not complete`.
**Suggestion:** **File:** `tests/unit/flow/gate-phase-inference.test.js`
**Requirement:** R6
**Issue:** The test still uses `AC3` naming while the spec and review summaries use `R1` through `R8`. This creates cross-file requirement-name drift between executable coverage and the current spec contract.
**Suggestion:** Rename the test to use requirement IDs consistent with `spec.json` and `spec.md`, for example `R3/R6: preserves inferred gate steps when downstream integration validation does not complete`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 40. 3. Centralize Semantic Gate Result Literals
**Finding key:** loop-fa775b63854473c9b3a4
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/run-gate.js`
**Requirement:** R6
**Issue:** Semantic result literals such as `"pass"` and `"fail"` appear in both production gate logic and tests. This duplicates protocol values across files and makes typo or future enum changes harder to apply consistently.
**Suggestion:** Export canonical semantic result constants or a predicate from the gate logic module, then reuse those in `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`
**Requirement:** R6
**Issue:** Semantic result literals such as `"pass"` and `"fail"` appear in both production gate logic and tests. This duplicates protocol values across files and makes typo or future enum changes harder to apply consistently.
**Suggestion:** Export canonical semantic result constants or a predicate from the gate logic module, then reuse those in `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 41. 4. Normalize Issue Identity Naming
**Finding key:** loop-31561bb0af443eb0b9ed
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/spec.json
**Requirement:** R8
**Issue:** **File:** `specs/333-failure-atomic-gate/spec.json`
**Requirement:** R8
**Issue:** The spec uses mixed issue identity wording, while reconciliation code and tests appear to treat `issue` as a validated authority/evidence field. This can blur whether `Issue`, `issue`, `issue-log`, and issue IDs are prose labels or schema/interface fields.
**Suggestion:** Use one schema-facing name such as `issue_id` or `issue` consistently across spec prose, JSON fields, reconciliation authority validation, and test fixtures; reserve “Issue #456” only for prose references to the external tracker.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/spec.json`
**Requirement:** R8
**Issue:** The spec uses mixed issue identity wording, while reconciliation code and tests appear to treat `issue` as a validated authority/evidence field. This can blur whether `Issue`, `issue`, `issue-log`, and issue IDs are prose labels or schema/interface fields.
**Suggestion:** Use one schema-facing name such as `issue_id` or `issue` consistently across spec prose, JSON fields, reconciliation authority validation, and test fixtures; reserve “Issue #456” only for prose references to the external tracker.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
