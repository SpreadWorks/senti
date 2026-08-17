# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 1. Remove non-bridge ledger entry from the R8 repair file
**Finding key:** loop-b0374d1813fa92559f81
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/impl-repair.json
**Requirement:** R8
**Issue:** **File:** `specs/333-failure-atomic-gate/impl-repair.json`  
**Requirement:** R8  
**Issue:** R8 requires this repair fingerprint history to be reconciled by appending exactly one bridge entry. The file contains both `repair-006`, described as the history-preserving bridge, and a later `repair-007` entry, so the R8-specific artifact no longer represents a single bridge append.  
**Suggestion:** Keep the preserved historical entries and the single bridge entry only. Move `repair-007` evidence to the appropriate non-R8 repair artifact, or remove it from this file if this file is intended to prove only the R8 bridge reconciliation.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/impl-repair.json`  
**Requirement:** R8  
**Issue:** R8 requires this repair fingerprint history to be reconciled by appending exactly one bridge entry. The file contains both `repair-006`, described as the history-preserving bridge, and a later `repair-007` entry, so the R8-specific artifact no longer represents a single bridge append.  
**Suggestion:** Keep the preserved historical entries and the single bridge entry only. Move `repair-007` evidence to the appropriate non-R8 repair artifact, or remove it from this file if this file is intended to prove only the R8 bridge reconciliation.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 2. 2. Normalize duplicated invalidation reason text
**Finding key:** loop-b2735647736c3e29b6a0
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/impl-repair.json
**Requirement:** R8
**Issue:** **File:** `specs/333-failure-atomic-gate/impl-repair.json`  
**Requirement:** R8  
**Issue:** The same long `reason` strings are repeated across each entry and again inside every invalidation. This makes the ledger bulky and increases the chance of accidental drift between the entry-level reason and per-artifact invalidation reasons.  
**Suggestion:** Store the canonical reason once at the entry level and keep invalidation-specific fields limited to `path`, mismatch type, and `previousFingerprint`, if the consuming schema allows it. If the schema requires full reasons, generate this file from structured source data instead of hand-maintaining repeated strings.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/impl-repair.json`  
**Requirement:** R8  
**Issue:** The same long `reason` strings are repeated across each entry and again inside every invalidation. This makes the ledger bulky and increases the chance of accidental drift between the entry-level reason and per-artifact invalidation reasons.  
**Suggestion:** Store the canonical reason once at the entry level and keep invalidation-specific fields limited to `path`, mismatch type, and `previousFingerprint`, if the consuming schema allows it. If the schema requires full reasons, generate this file from structured source data instead of hand-maintaining repeated strings.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 3. 3. Recheck inconsistent previous fingerprints in `repair-007`
**Finding key:** loop-5e2d7ee3bb6567b2f3e9
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/impl-repair.json
**Requirement:** R8
**Issue:** **File:** `specs/333-failure-atomic-gate/impl-repair.json`  
**Requirement:** R8  
**Issue:** `repair-007.previousHash` is `704826...`, but its invalidations reference two different `previousFingerprint` values, `2459...` and `2c5e...`. That weakens the authority binding expected by R8, where identity, hash, and evidence values must match exactly before writing.  
**Suggestion:** Either remove `repair-007` from this R8 bridge ledger or verify and align every invalidation fingerprint with the intended evidence baseline for that entry. If multiple baselines are intentional, encode that distinction explicitly rather than overloading `previousFingerprint`.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/impl-repair.json`  
**Requirement:** R8  
**Issue:** `repair-007.previousHash` is `704826...`, but its invalidations reference two different `previousFingerprint` values, `2459...` and `2c5e...`. That weakens the authority binding expected by R8, where identity, hash, and evidence values must match exactly before writing.  
**Suggestion:** Either remove `repair-007` from this R8 bridge ledger or verify and align every invalidation fingerprint with the intended evidence baseline for that entry. If multiple baselines are intentional, encode that distinction explicitly rather than overloading `previousFingerprint`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 4. 1. Extract Positive Integer Validation
**Finding key:** loop-8c89db00680bcf91b05a
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/repair-ledger-reconciliation.js
**Requirement:** R8
**Issue:** **File:** `specs/333-failure-atomic-gate/repair-ledger-reconciliation.js`  
**Requirement:** R8  
**Issue:** The positive safe integer validation for `issue`, `preservedEntryCount`, and `RepairLedgerReconciliationResult.preservedEntryCount` is duplicated with slightly different inline error text.  
**Suggestion:** Add a small helper such as `requirePositiveSafeInteger(value, field)` and reuse it in all constructors. This keeps validation behavior consistent and reduces repeated branches.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/repair-ledger-reconciliation.js`  
**Requirement:** R8  
**Issue:** The positive safe integer validation for `issue`, `preservedEntryCount`, and `RepairLedgerReconciliationResult.preservedEntryCount` is duplicated with slightly different inline error text.  
**Suggestion:** Add a small helper such as `requirePositiveSafeInteger(value, field)` and reuse it in all constructors. This keeps validation behavior consistent and reduces repeated branches.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 5. 2. Deduplicate Bridge Delta Construction
**Finding key:** loop-02c55644da0393a7aec1
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/repair-ledger-reconciliation.js
**Requirement:** R8
**Issue:** **File:** `specs/333-failure-atomic-gate/repair-ledger-reconciliation.js`  
**Requirement:** R8  
**Issue:** The `RepairDeltaArtifact` for the bridge is constructed once in the authority constructor and again in `prepare()` with the same fields. If those fields change later, the two call sites can drift.  
**Suggestion:** Add a private/helper method like `createBridgeDelta()` that constructs the `RepairDeltaArtifact` from authority fields, and use it in both places.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/repair-ledger-reconciliation.js`  
**Requirement:** R8  
**Issue:** The `RepairDeltaArtifact` for the bridge is constructed once in the authority constructor and again in `prepare()` with the same fields. If those fields change later, the two call sites can drift.  
**Suggestion:** Add a private/helper method like `createBridgeDelta()` that constructs the `RepairDeltaArtifact` from authority fields, and use it in both places.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 3. Add Explicit Bound For Changed Path Processing
**Finding key:** loop-7e456ff49a552d978fa2
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/repair-ledger-reconciliation.js
**Requirement:** R8
**Issue:** **File:** `specs/333-failure-atomic-gate/repair-ledger-reconciliation.js`  
**Requirement:** R8  
**Issue:** `prepare()` iterates over every `delta.changedPaths` entry to build `changedPathGroups`. The preview is bounded by `CHANGED_PATH_PREVIEW_LIMIT`, but the grouping pass itself has no explicit local upper bound, which violates the `bounded-resource-usage` guardrail unless the bound is guaranteed elsewhere and acknowledged.  
**Suggestion:** Define and enforce a maximum changed path count in this file, or validate that `RepairDeltaArtifact` exposes an explicit bounded limit before grouping. Fail before the loop if the inventory exceeds that bound.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/repair-ledger-reconciliation.js`  
**Requirement:** R8  
**Issue:** `prepare()` iterates over every `delta.changedPaths` entry to build `changedPathGroups`. The preview is bounded by `CHANGED_PATH_PREVIEW_LIMIT`, but the grouping pass itself has no explicit local upper bound, which violates the `bounded-resource-usage` guardrail unless the bound is guaranteed elsewhere and acknowledged.  
**Suggestion:** Define and enforce a maximum changed path count in this file, or validate that `RepairDeltaArtifact` exposes an explicit bounded limit before grouping. Fail before the loop if the inventory exceeds that bound.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 4. Rename `serialized` For Intent
**Finding key:** loop-05121b5bd6add003f49a
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/repair-ledger-reconciliation.js
**Requirement:** R8
**Issue:** **File:** `specs/333-failure-atomic-gate/repair-ledger-reconciliation.js`  
**Requirement:** R8  
**Issue:** The helper name `serialized` is vague and hides that it is used for exact JSON structural comparison in `verifyApplied()`.  
**Suggestion:** Rename it to something more specific, such as `toComparableJson()` or `serializeForExactComparison()`, so the equality checks read closer to the reconciliation invariant they enforce.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/repair-ledger-reconciliation.js`  
**Requirement:** R8  
**Issue:** The helper name `serialized` is vague and hides that it is used for exact JSON structural comparison in `verifyApplied()`.  
**Suggestion:** Rename it to something more specific, such as `toComparableJson()` or `serializeForExactComparison()`, so the equality checks read closer to the reconciliation invariant they enforce.
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

### 38. 1. Consolidate duplicated inferred-transition atomic persistence logic
**Finding key:** loop-5709f573784be86d2026
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/run-gate.js`
**Requirement:** R3
**Issue:** Multiple summaries point to the same atomic gate flow being duplicated or repeated across files: `run-gate.js` has two implementations of checkpoint/artifact/commit sequencing, while `spec.md` and `spec.json` also duplicate the same deferred-transition/data-flow description. This creates a cross-file drift risk between implementation and spec artifacts for the core atomicity behavior.
**Suggestion:** Extract one implementation helper in `run-gate.js`, then update `spec.md` and `spec.json` to describe that single canonical sequence once.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`
**Requirement:** R3
**Issue:** Multiple summaries point to the same atomic gate flow being duplicated or repeated across files: `run-gate.js` has two implementations of checkpoint/artifact/commit sequencing, while `spec.md` and `spec.json` also duplicate the same deferred-transition/data-flow description. This creates a cross-file drift risk between implementation and spec artifacts for the core atomicity behavior.
**Suggestion:** Extract one implementation helper in `run-gate.js`, then update `spec.md` and `spec.json` to describe that single canonical sequence once.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 39. 2. Normalize issue identity naming across spec and repair artifacts
**Finding key:** loop-f9644e5545cb25b42247
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/spec.json
**Requirement:** R8
**Issue:** **File:** `specs/333-failure-atomic-gate/spec.json`
**Requirement:** R8
**Issue:** The spec uses mixed “Issue” / “issue” phrasing while the repair ledger uses fields such as `issue`, `previousHash`, and `previousFingerprint`. The summaries also note fingerprint/hash ambiguity in `impl-repair.json`, so inconsistent identity terminology across files weakens the authority/evidence contract.
**Suggestion:** Standardize on one identity vocabulary across `spec.json`, `spec.md`, `impl-repair.json`, and reconciliation tests, such as `issue_id` for tracker identity and explicit `previousFingerprint` / `previousHash` meanings for artifact evidence.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/spec.json`
**Requirement:** R8
**Issue:** The spec uses mixed “Issue” / “issue” phrasing while the repair ledger uses fields such as `issue`, `previousHash`, and `previousFingerprint`. The summaries also note fingerprint/hash ambiguity in `impl-repair.json`, so inconsistent identity terminology across files weakens the authority/evidence contract.
**Suggestion:** Standardize on one identity vocabulary across `spec.json`, `spec.md`, `impl-repair.json`, and reconciliation tests, such as `issue_id` for tracker identity and explicit `previousFingerprint` / `previousHash` meanings for artifact evidence.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 40. 3. Use shared bridge authority values instead of duplicating repair constants
**Finding key:** loop-fac624a87d16a471fa96
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/tests/repair-ledger-reconciliation.test.js
**Requirement:** R8
**Issue:** **File:** `specs/333-failure-atomic-gate/tests/repair-ledger-reconciliation.test.js`
**Requirement:** R8
**Issue:** The repair test hard-codes bridge values like `repair-006` and `5`, while `impl-repair.json` is also expected to preserve exactly one bridge append. This creates duplicate sources of truth across the ledger artifact and tests.
**Suggestion:** Drive test expectations from the fixture authority values and keep the bridge ledger entry as the single canonical artifact value.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/tests/repair-ledger-reconciliation.test.js`
**Requirement:** R8
**Issue:** The repair test hard-codes bridge values like `repair-006` and `5`, while `impl-repair.json` is also expected to preserve exactly one bridge append. This creates duplicate sources of truth across the ledger artifact and tests.
**Suggestion:** Drive test expectations from the fixture authority values and keep the bridge ledger entry as the single canonical artifact value.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 41. 4. Align bounded traversal/resource checks across reconciliation and gate mutation code
**Finding key:** loop-030a32dc32d9c58b2af4
**Failure mode:** refactor
**File:** src/flow/lib/gate-mutation-owner.js
**Requirement:** R8
**Issue:** **File:** `src/flow/lib/gate-mutation-owner.js`
**Requirement:** R8
**Issue:** Both `gate-mutation-owner.js` and `repair-ledger-reconciliation.js` introduce unbounded grouping/traversal over user/spec-derived structures. The same bounded-resource guardrail is being handled inconsistently across files.
**Suggestion:** Define or reuse a common bounded traversal policy/helper for step flattening and changed-path grouping, with explicit limits and consistent failure behavior.
**Suggestion:** **File:** `src/flow/lib/gate-mutation-owner.js`
**Requirement:** R8
**Issue:** Both `gate-mutation-owner.js` and `repair-ledger-reconciliation.js` introduce unbounded grouping/traversal over user/spec-derived structures. The same bounded-resource guardrail is being handled inconsistently across files.
**Suggestion:** Define or reuse a common bounded traversal policy/helper for step flattening and changed-path grouping, with explicit limits and consistent failure behavior.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 42. 5. Normalize semantic gate result constants across implementation and tests
**Finding key:** loop-29d71bb90ec02e9f4676
**Failure mode:** refactor
**File:** specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js
**Requirement:** R6
**Issue:** **File:** `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`
**Requirement:** R6
**Issue:** Tests repeat string literals `"pass"` and `"fail"`, while `run-gate.js` has commit eligibility logic around semantic pass/fail results. This duplicates protocol literals across implementation and tests.
**Suggestion:** Centralize semantic result constants or import the production protocol values into tests where appropriate, then use those constants in both commit eligibility checks and test assertions.
**Suggestion:** **File:** `specs/333-failure-atomic-gate/tests/gate-failure-atomicity.test.js`
**Requirement:** R6
**Issue:** Tests repeat string literals `"pass"` and `"fail"`, while `run-gate.js` has commit eligibility logic around semantic pass/fail results. This duplicates protocol literals across implementation and tests.
**Suggestion:** Centralize semantic result constants or import the production protocol values into tests where appropriate, then use those constants in both commit eligibility checks and test assertions.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 43. 6. Align requirement naming in tests with spec requirement IDs
**Finding key:** loop-1fbedf873e8a3ec69807
**Failure mode:** refactor
**File:** tests/unit/flow/gate-phase-inference.test.js
**Requirement:** R6
**Issue:** **File:** `tests/unit/flow/gate-phase-inference.test.js`
**Requirement:** R6
**Issue:** One test still uses `AC3` naming while the spec and other review summaries use `R1` through `R8`. This creates cross-file naming drift between the test suite and requirement documents.
**Suggestion:** Rename the test to use requirement IDs, for example `R3/R6: preserves inferred gate steps when downstream integration validation does not complete`.
**Suggestion:** **File:** `tests/unit/flow/gate-phase-inference.test.js`
**Requirement:** R6
**Issue:** One test still uses `AC3` naming while the spec and other review summaries use `R1` through `R8`. This creates cross-file naming drift between the test suite and requirement documents.
**Suggestion:** Rename the test to use requirement IDs, for example `R3/R6: preserves inferred gate steps when downstream integration validation does not complete`.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
