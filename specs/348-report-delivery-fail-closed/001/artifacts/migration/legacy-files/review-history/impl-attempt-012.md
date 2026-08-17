# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 1. Remove Duplicated Implementation Target Entries From Overview
**Finding key:** loop-afd74ba1c790d9eb8561
**Failure mode:** refactor
**File:** specs/348-report-delivery-fail-closed/spec.json
**Requirement:** R7
**Issue:** **File:** `specs/348-report-delivery-fail-closed/spec.json`
**Requirement:** R7
**Issue:** The `overview.modules`, `overview.data_flow`, and `overview.decisions` arrays mix durable design statements with task-added restatements such as `RunReportCommand delivery state and retry` and `Report source loading propagates IssueLogStore failures...`. This duplicates information already covered by requirements and tasks, making the spec harder to maintain consistently.
**Suggestion:** Keep the canonical architectural statements in `overview`, and remove task-tracking restatements that duplicate `requirements` or `tasks`. If provenance is needed, keep it only in `tasks`.
**Suggestion:** **File:** `specs/348-report-delivery-fail-closed/spec.json`
**Requirement:** R7
**Issue:** The `overview.modules`, `overview.data_flow`, and `overview.decisions` arrays mix durable design statements with task-added restatements such as `RunReportCommand delivery state and retry` and `Report source loading propagates IssueLogStore failures...`. This duplicates information already covered by requirements and tasks, making the spec harder to maintain consistently.
**Suggestion:** Keep the canonical architectural statements in `overview`, and remove task-tracking restatements that duplicate `requirements` or `tasks`. If provenance is needed, keep it only in `tasks`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 2. 2. Clarify Delivery State Naming
**Finding key:** loop-caf92e10aff75edd378c
**Failure mode:** refactor
**File:** specs/348-report-delivery-fail-closed/spec.json
**Requirement:** R3
**Issue:** **File:** `specs/348-report-delivery-fail-closed/spec.json`
**Requirement:** R3
**Issue:** The spec uses both `unsent` and `pending` for failed or incomplete delivery, but the distinction is not clearly defined. This can lead to inconsistent implementation and tests.
**Suggestion:** Add a short definition for each allowed delivery state, for example: `unsent` means no attempt was possible because `gh` was unavailable, while `pending` means a delivery attempt failed after report generation.
**Suggestion:** **File:** `specs/348-report-delivery-fail-closed/spec.json`
**Requirement:** R3
**Issue:** The spec uses both `unsent` and `pending` for failed or incomplete delivery, but the distinction is not clearly defined. This can lead to inconsistent implementation and tests.
**Suggestion:** Add a short definition for each allowed delivery state, for example: `unsent` means no attempt was possible because `gh` was unavailable, while `pending` means a delivery attempt failed after report generation.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 3. 3. Align Task Status With Requirement Status
**Finding key:** loop-94c5d69b37eedc57f55f
**Failure mode:** refactor
**File:** specs/348-report-delivery-fail-closed/spec.json
**Requirement:** R1
**Issue:** **File:** `specs/348-report-delivery-fail-closed/spec.json`
**Requirement:** R1
**Issue:** All requirements are marked `"status": "done"`, but the corresponding tasks `T-1`, `T-2`, and `T-3` remain `"status": "pending"`. This internal inconsistency makes completion state ambiguous.
**Suggestion:** Update task statuses to match the requirement state, or change requirement statuses back if this spec is meant to describe planned work rather than completed work.
**Suggestion:** **File:** `specs/348-report-delivery-fail-closed/spec.json`
**Requirement:** R1
**Issue:** All requirements are marked `"status": "done"`, but the corresponding tasks `T-1`, `T-2`, and `T-3` remain `"status": "pending"`. This internal inconsistency makes completion state ambiguous.
**Suggestion:** Update task statuses to match the requirement state, or change requirement statuses back if this spec is meant to describe planned work rather than completed work.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 4. 1. Remove Duplicate Overview Bullets
**Finding key:** loop-38714d738cff3402e809
**Failure mode:** refactor
**File:** specs/348-report-delivery-fail-closed/spec.md
**Requirement:** R7
**Issue:** **File:** `specs/348-report-delivery-fail-closed/spec.md`  
**Requirement:** R7  
**Issue:** The `Overview > Modules` section repeats module responsibilities in two styles: prose bullets followed by fragments like `RunReportCommand in src/flow/lib/run-report.js`, `RunReportCommand delivery state and retry`, and `ReportBinding validates...`. This makes ownership less clear and looks like leftover planning notes.  
**Suggestion:** Consolidate these into the first three module bullets, or remove the fragment bullets entirely if they add no distinct information.
**Suggestion:** **File:** `specs/348-report-delivery-fail-closed/spec.md`  
**Requirement:** R7  
**Issue:** The `Overview > Modules` section repeats module responsibilities in two styles: prose bullets followed by fragments like `RunReportCommand in src/flow/lib/run-report.js`, `RunReportCommand delivery state and retry`, and `ReportBinding validates...`. This makes ownership less clear and looks like leftover planning notes.  
**Suggestion:** Consolidate these into the first three module bullets, or remove the fragment bullets entirely if they add no distinct information.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 5. 2. Normalize Data Flow Into One Style
**Finding key:** loop-43c3f40f7bef9b5f3da9
**Failure mode:** refactor
**File:** specs/348-report-delivery-fail-closed/spec.md
**Requirement:** R5
**Issue:** **File:** `specs/348-report-delivery-fail-closed/spec.md`  
**Requirement:** R5  
**Issue:** `Overview > Data Flow` mixes full workflow descriptions with terse arrow-chain notes such as `IssueLogStore read failure -> RunReportCommand failure`. The same concepts are already described nearby, creating duplicate and inconsistent documentation.  
**Suggestion:** Keep either the explanatory bullets or a concise ordered flow, but not both. For example, convert the section into a numbered sequence from source loading, binding creation, report persistence, delivery attempt, and retry validation.
**Suggestion:** **File:** `specs/348-report-delivery-fail-closed/spec.md`  
**Requirement:** R5  
**Issue:** `Overview > Data Flow` mixes full workflow descriptions with terse arrow-chain notes such as `IssueLogStore read failure -> RunReportCommand failure`. The same concepts are already described nearby, creating duplicate and inconsistent documentation.  
**Suggestion:** Keep either the explanatory bullets or a concise ordered flow, but not both. For example, convert the section into a numbered sequence from source loading, binding creation, report persistence, delivery attempt, and retry validation.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 3. Remove Empty Placeholder Sections
**Finding key:** loop-91223cfc96222836010c
**Failure mode:** refactor
**File:** specs/348-report-delivery-fail-closed/spec.md
**Requirement:** R1
**Issue:** **File:** `specs/348-report-delivery-fail-closed/spec.md`  
**Requirement:** R1  
**Issue:** `Clarifications (Q&A)` contains an empty `Q/A`, and `Open Questions` contains only an empty checkbox. These are dead placeholders that add noise and can be mistaken for unresolved specification work.  
**Suggestion:** Delete both sections if there are no clarifications or open questions, or replace them with explicit `None` statements.
**Suggestion:** **File:** `specs/348-report-delivery-fail-closed/spec.md`  
**Requirement:** R1  
**Issue:** `Clarifications (Q&A)` contains an empty `Q/A`, and `Open Questions` contains only an empty checkbox. These are dead placeholders that add noise and can be mistaken for unresolved specification work.  
**Suggestion:** Delete both sections if there are no clarifications or open questions, or replace them with explicit `None` statements.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 4. Clarify Delivery State Naming
**Finding key:** loop-c4a6da44f8298fb2b622
**Failure mode:** refactor
**File:** specs/348-report-delivery-fail-closed/spec.md
**Requirement:** R3
**Issue:** **File:** `specs/348-report-delivery-fail-closed/spec.md`  
**Requirement:** R3  
**Issue:** The spec uses both `unsent` and `pending` for failed delivery state, but does not clearly define when each should be used. This can lead to inconsistent implementation and tests.  
**Suggestion:** Add a short definition of each delivery status, for example: `unsent` for no attempted delivery due to unavailable tooling, and `pending` for attempted-but-failed comment publication.
**Suggestion:** **File:** `specs/348-report-delivery-fail-closed/spec.md`  
**Requirement:** R3  
**Issue:** The spec uses both `unsent` and `pending` for failed delivery state, but does not clearly define when each should be used. This can lead to inconsistent implementation and tests.  
**Suggestion:** Add a short definition of each delivery status, for example: `unsent` for no attempted delivery due to unavailable tooling, and `pending` for attempted-but-failed comment publication.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 1. Extract Repeated Issue Log Path Helpers
**Finding key:** loop-9cb305d791532ca7618a
**Failure mode:** refactor
**File:** specs/348-report-delivery-fail-closed/tests/report-delivery-fail-closed.test.js
**Requirement:** R1
**Issue:** **File:** `specs/348-report-delivery-fail-closed/tests/report-delivery-fail-closed.test.js`  
**Requirement:** R1  
**Issue:** `path.join(path.dirname(state.spec), "issue-log.json")` is repeated throughout the file, along with similar `reportPath`-style artifact path construction. This makes tests noisier and increases drift risk if spec-relative artifact layout changes.  
**Suggestion:** Add a small helper such as `artifactPath(state, name)` or `issueLogPath(state)` and use it consistently.
**Suggestion:** **File:** `specs/348-report-delivery-fail-closed/tests/report-delivery-fail-closed.test.js`  
**Requirement:** R1  
**Issue:** `path.join(path.dirname(state.spec), "issue-log.json")` is repeated throughout the file, along with similar `reportPath`-style artifact path construction. This makes tests noisier and increases drift risk if spec-relative artifact layout changes.  
**Suggestion:** Add a small helper such as `artifactPath(state, name)` or `issueLogPath(state)` and use it consistently.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 2. Use `try/finally` For All Environment Mutations
**Finding key:** loop-00163f7c493c8cad7156
**Failure mode:** refactor
**File:** specs/348-report-delivery-fail-closed/tests/report-delivery-fail-closed.test.js
**Requirement:** R4
**Issue:** **File:** `specs/348-report-delivery-fail-closed/tests/report-delivery-fail-closed.test.js`  
**Requirement:** R4  
**Issue:** Some tests mutate `process.env.PATH` and `process.env.SENTI_TEST_OUTBOX_KEY` but restore them only at the end of the happy path. If an assertion fails after mutation, later tests can inherit polluted environment state.  
**Suggestion:** Wrap the entire mutation window in `try/finally`, including the resumed delivery assertions in the R4 test and the successful delivery assertions in the R7 test.
**Suggestion:** **File:** `specs/348-report-delivery-fail-closed/tests/report-delivery-fail-closed.test.js`  
**Requirement:** R4  
**Issue:** Some tests mutate `process.env.PATH` and `process.env.SENTI_TEST_OUTBOX_KEY` but restore them only at the end of the happy path. If an assertion fails after mutation, later tests can inherit polluted environment state.  
**Suggestion:** Wrap the entire mutation window in `try/finally`, including the resumed delivery assertions in the R4 test and the successful delivery assertions in the R7 test.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 10. 3. Consolidate Fake `gh` Installer Behavior
**Finding key:** loop-9b01d0eeda1861d70673
**Failure mode:** refactor
**File:** specs/348-report-delivery-fail-closed/tests/report-delivery-fail-closed.test.js
**Requirement:** R2
**Issue:** **File:** `specs/348-report-delivery-fail-closed/tests/report-delivery-fail-closed.test.js`  
**Requirement:** R2  
**Issue:** `installGh` and `installUnavailableGh` duplicate fake executable setup, chmod handling, and bin path construction. The unavailable case is just another behavior mode of the same fake command.  
**Suggestion:** Replace both helpers with one `installGh(root, { available = true, failComment = false } = {})` helper, or extract shared executable creation into `writeGhStub(root, scriptLines)`.
**Suggestion:** **File:** `specs/348-report-delivery-fail-closed/tests/report-delivery-fail-closed.test.js`  
**Requirement:** R2  
**Issue:** `installGh` and `installUnavailableGh` duplicate fake executable setup, chmod handling, and bin path construction. The unavailable case is just another behavior mode of the same fake command.  
**Suggestion:** Replace both helpers with one `installGh(root, { available = true, failComment = false } = {})` helper, or extract shared executable creation into `writeGhStub(root, scriptLines)`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 11. 4. Bound Recursive Step Traversal
**Finding key:** loop-20fc9fe04bffaca833ac
**Failure mode:** refactor
**File:** specs/348-report-delivery-fail-closed/tests/report-delivery-fail-closed.test.js
**Requirement:** R2
**Issue:** **File:** `specs/348-report-delivery-fail-closed/tests/report-delivery-fail-closed.test.js`  
**Requirement:** R2  
**Issue:** `stepStatus` recursively traverses `step.children` without an explicit depth or node-count bound. This violates the bounded-resource-usage guardrail perspective for recursive processing, even in test code.  
**Suggestion:** Replace it with an iterative traversal that caps inspected nodes, for example `maxSteps = 1000`, and throws a clear test error if exceeded.
**Suggestion:** **File:** `specs/348-report-delivery-fail-closed/tests/report-delivery-fail-closed.test.js`  
**Requirement:** R2  
**Issue:** `stepStatus` recursively traverses `step.children` without an explicit depth or node-count bound. This violates the bounded-resource-usage guardrail perspective for recursive processing, even in test code.  
**Suggestion:** Replace it with an iterative traversal that caps inspected nodes, for example `maxSteps = 1000`, and throws a clear test error if exceeded.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 12. 5. Reduce Large Inline Artifact Fixtures
**Finding key:** loop-49c1848f907b40090d0e
**Failure mode:** refactor
**File:** specs/348-report-delivery-fail-closed/tests/report-delivery-fail-closed.test.js
**Requirement:** R5
**Issue:** **File:** `specs/348-report-delivery-fail-closed/tests/report-delivery-fail-closed.test.js`  
**Requirement:** R5  
**Issue:** The R5 binding test contains several large inline JSON fixture objects, which obscures the actual assertion: verifying that present consumed artifacts are recorded with hashes.  
**Suggestion:** Extract fixture builders such as `writeValidTestExecuteArtifact`, `writeValidFinalRegressionArtifact`, and `writeValidUpgradeArtifact`, keeping the test focused on artifact presence and binding expectations.
**Suggestion:** **File:** `specs/348-report-delivery-fail-closed/tests/report-delivery-fail-closed.test.js`  
**Requirement:** R5  
**Issue:** The R5 binding test contains several large inline JSON fixture objects, which obscures the actual assertion: verifying that present consumed artifacts are recorded with hashes.  
**Suggestion:** Extract fixture builders such as `writeValidTestExecuteArtifact`, `writeValidFinalRegressionArtifact`, and `writeValidUpgradeArtifact`, keeping the test focused on artifact presence and binding expectations.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 6. Avoid Recreating `RunReportCommand` Repeatedly In Single Tests
**Finding key:** loop-5086a7530fe5c2faab18
**Failure mode:** refactor
**File:** specs/348-report-delivery-fail-closed/tests/report-delivery-fail-closed.test.js
**Requirement:** R4
**Issue:** **File:** `specs/348-report-delivery-fail-closed/tests/report-delivery-fail-closed.test.js`  
**Requirement:** R4  
**Issue:** Several tests instantiate `new RunReportCommand()` multiple times within the same logical scenario, especially the resume-delivery test. This adds visual noise and makes it less obvious whether state is expected to live on the command instance.  
**Suggestion:** Create `const command = new RunReportCommand();` once per test where multiple calls are made, then call `command.execute(...)` and `command.resumeDelivery(...)`.
**Suggestion:** **File:** `specs/348-report-delivery-fail-closed/tests/report-delivery-fail-closed.test.js`  
**Requirement:** R4  
**Issue:** Several tests instantiate `new RunReportCommand()` multiple times within the same logical scenario, especially the resume-delivery test. This adds visual noise and makes it less obvious whether state is expected to live on the command instance.  
**Suggestion:** Create `const command = new RunReportCommand();` once per test where multiple calls are made, then call `command.execute(...)` and `command.resumeDelivery(...)`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 1. Add an explicit bound for binding source artifacts
**Finding key:** loop-121826f5e24103f40e96
**Failure mode:** refactor
**File:** src/flow/commands/report.js
**Requirement:** R5
**Issue:** **File:** `src/flow/commands/report.js`  
**Requirement:** R5  
**Issue:** `ReportBinding.validate()` iterates over every `sourceArtifacts` entry and reads each file without enforcing the expected artifact count. The spec limits this to `issue-log.json` plus a fixed optional set, so accepting an unbounded array weakens the bounded-resource guardrail.  
**Suggestion:** Reject bindings with more entries than the allowed artifact set, and ideally validate paths against that known set before reading files.
**Suggestion:** **File:** `src/flow/commands/report.js`  
**Requirement:** R5  
**Issue:** `ReportBinding.validate()` iterates over every `sourceArtifacts` entry and reads each file without enforcing the expected artifact count. The spec limits this to `issue-log.json` plus a fixed optional set, so accepting an unbounded array weakens the bounded-resource guardrail.  
**Suggestion:** Reject bindings with more entries than the allowed artifact set, and ideally validate paths against that known set before reading files.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 15. 2. Extract duplicate file hashing logic
**Finding key:** loop-989d8f9883367efe18b8
**Failure mode:** refactor
**File:** src/flow/commands/report.js
**Requirement:** R5
**Issue:** **File:** `src/flow/commands/report.js`  
**Requirement:** R5  
**Issue:** SHA-256 calculation is duplicated in `ReportBinding.fromSourcePaths()` and `ReportBinding.validate()`.  
**Suggestion:** Add a small helper such as `sha256File(absolutePath)` or `hashFileBytes(filePath)` and use it in both places.
**Suggestion:** **File:** `src/flow/commands/report.js`  
**Requirement:** R5  
**Issue:** SHA-256 calculation is duplicated in `ReportBinding.fromSourcePaths()` and `ReportBinding.validate()`.  
**Suggestion:** Add a small helper such as `sha256File(absolutePath)` or `hashFileBytes(filePath)` and use it in both places.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 16. 3. Validate source paths during binding creation
**Finding key:** loop-5d2ddef1c8290524c1b0
**Failure mode:** refactor
**File:** src/flow/commands/report.js
**Requirement:** R5
**Issue:** **File:** `src/flow/commands/report.js`  
**Requirement:** R5  
**Issue:** `fromSourcePaths()` normalizes paths but does not apply the same project-relative/path escape validation used by `normalizeSourceArtifact()`.  
**Suggestion:** Reuse the normalization logic or add a `normalizeProjectRelativePath(root, sourcePath)` helper so binding creation and validation enforce the same path rules.
**Suggestion:** **File:** `src/flow/commands/report.js`  
**Requirement:** R5  
**Issue:** `fromSourcePaths()` normalizes paths but does not apply the same project-relative/path escape validation used by `normalizeSourceArtifact()`.  
**Suggestion:** Reuse the normalization logic or add a `normalizeProjectRelativePath(root, sourcePath)` helper so binding creation and validation enforce the same path rules.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 17. 1. Use a More Specific Parameter Name
**Finding key:** loop-a5d14a7e228eb5b8de53
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R4  
**Issue:** The new `transition` parameter is generic, while this code path is specifically about test evidence refresh recovery. This makes call sites harder to distinguish from other transition concepts in the flow layer.  
**Suggestion:** Rename `transition` to something more specific, such as `recoveryTransition` or `testEvidenceRefreshTransitionOverride`, across `completeTestEvidenceRefresh`, `resumeJournaledTestEvidenceRefresh`, and `commitOwnedTestEvidenceRefresh`.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R4  
**Issue:** The new `transition` parameter is generic, while this code path is specifically about test evidence refresh recovery. This makes call sites harder to distinguish from other transition concepts in the flow layer.  
**Suggestion:** Rename `transition` to something more specific, such as `recoveryTransition` or `testEvidenceRefreshTransitionOverride`, across `completeTestEvidenceRefresh`, `resumeJournaledTestEvidenceRefresh`, and `commitOwnedTestEvidenceRefresh`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 18. 2. Prefer Nullish Coalescing for Optional Override
**Finding key:** loop-3521e6ec742f3a9181f1
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R5  
**Issue:** `transition || testEvidenceRefreshTransition(state, journal)` uses truthiness even though the API validates `transition` as either `null` or an `ExplicitRecoveryTransition`. This works today, but `||` communicates a broader fallback rule than intended.  
**Suggestion:** Replace it with `transition ?? testEvidenceRefreshTransition(state, journal)` to express that only `null` or `undefined` should trigger the default transition.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R5  
**Issue:** `transition || testEvidenceRefreshTransition(state, journal)` uses truthiness even though the API validates `transition` as either `null` or an `ExplicitRecoveryTransition`. This works today, but `||` communicates a broader fallback rule than intended.  
**Suggestion:** Replace it with `transition ?? testEvidenceRefreshTransition(state, journal)` to express that only `null` or `undefined` should trigger the default transition.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 19. 1. Extract Repeated Command Metadata
**Finding key:** loop-1dbc125e22c1fa177ca7
**Failure mode:** refactor
**File:** src/flow/lib/run-recover-existing-implementation.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/run-recover-existing-implementation.js`  
**Requirement:** R2  
**Issue:** The command name pair `"run", "recover-existing-implementation"` is repeated across every `Envelope.ok` and `Envelope.fail` call. This makes future renames or copy/paste changes error-prone.  
**Suggestion:** Introduce constants such as `COMMAND_DOMAIN = "run"` and `COMMAND_NAME = "recover-existing-implementation"`, then use them consistently in all envelope responses.
**Suggestion:** **File:** `src/flow/lib/run-recover-existing-implementation.js`  
**Requirement:** R2  
**Issue:** The command name pair `"run", "recover-existing-implementation"` is repeated across every `Envelope.ok` and `Envelope.fail` call. This makes future renames or copy/paste changes error-prone.  
**Suggestion:** Introduce constants such as `COMMAND_DOMAIN = "run"` and `COMMAND_NAME = "recover-existing-implementation"`, then use them consistently in all envelope responses.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 20. 2. Reuse Lifecycle Validation Helper
**Finding key:** loop-c05470dd75b7d4f0dd93
**Failure mode:** refactor
**File:** src/flow/lib/run-recover-existing-implementation.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/run-recover-existing-implementation.js`  
**Requirement:** R4  
**Issue:** Active-step validation is duplicated in `assertEligibility` and after reloading `refreshed`, with repeated checks for `active?.scope !== "flow"` and `active.stepId !== ...`.  
**Suggestion:** Add a small helper like `requireActiveFlowStep(stateOrActive, stepId, message)` or `isActiveFlowStep(active, stepId)` to centralize the flow-step predicate and keep lifecycle checks consistent.
**Suggestion:** **File:** `src/flow/lib/run-recover-existing-implementation.js`  
**Requirement:** R4  
**Issue:** Active-step validation is duplicated in `assertEligibility` and after reloading `refreshed`, with repeated checks for `active?.scope !== "flow"` and `active.stepId !== ...`.  
**Suggestion:** Add a small helper like `requireActiveFlowStep(stateOrActive, stepId, message)` or `isActiveFlowStep(active, stepId)` to centralize the flow-step predicate and keep lifecycle checks consistent.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 21. 3. Rename `reject` to Avoid Ambiguity
**Finding key:** loop-126aced2db1cd405308a
**Failure mode:** refactor
**File:** src/flow/lib/run-recover-existing-implementation.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/run-recover-existing-implementation.js`  
**Requirement:** R2  
**Issue:** The helper name `reject` is very generic and can be confused with Promise rejection semantics, especially in command code that returns structured failure envelopes.  
**Suggestion:** Rename it to something domain-specific like `throwRecoveryError(code, message)` or `failRecovery(code, message)`.
**Suggestion:** **File:** `src/flow/lib/run-recover-existing-implementation.js`  
**Requirement:** R2  
**Issue:** The helper name `reject` is very generic and can be confused with Promise rejection semantics, especially in command code that returns structured failure envelopes.  
**Suggestion:** Rename it to something domain-specific like `throwRecoveryError(code, message)` or `failRecovery(code, message)`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 22. 4. Avoid Re-reading Invalid Paths During Pending Recovery
**Finding key:** loop-0a5a965f4429f0b930e8
**Failure mode:** refactor
**File:** src/flow/lib/run-recover-existing-implementation.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/run-recover-existing-implementation.js`  
**Requirement:** R1  
**Issue:** `readScenarioValidityResult(specDir)` is always executed, including when `eligibility.pendingRecovery` is true. In that state the transition has already occurred and the evidence may not need to be revalidated just to resume refresh work.  
**Suggestion:** If pending recovery already records the relevant invalid paths or prior evidence in state, reuse that instead. Otherwise, consider documenting why the evidence file must remain mandatory across resumed recovery.
**Suggestion:** **File:** `src/flow/lib/run-recover-existing-implementation.js`  
**Requirement:** R1  
**Issue:** `readScenarioValidityResult(specDir)` is always executed, including when `eligibility.pendingRecovery` is true. In that state the transition has already occurred and the evidence may not need to be revalidated just to resume refresh work.  
**Suggestion:** If pending recovery already records the relevant invalid paths or prior evidence in state, reuse that instead. Otherwise, consider documenting why the evidence file must remain mandatory across resumed recovery.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 23. 5. Name Transition Table Fields Explicitly
**Finding key:** loop-b569028645c92bee159e
**Failure mode:** refactor
**File:** src/flow/lib/run-recover-existing-implementation.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/run-recover-existing-implementation.js`  
**Requirement:** R2  
**Issue:** The `expected` transition table uses positional arrays like `["scenario-validity", "in_progress", "skipped"]`, which makes the mapping less self-documenting.  
**Suggestion:** Replace the tuple array with objects: `{ stepId: "scenario-validity", currentStatus: "in_progress", requestedStatus: "skipped" }`. This removes the need to destructure positional fields and matches the object shape returned later.
**Suggestion:** **File:** `src/flow/lib/run-recover-existing-implementation.js`  
**Requirement:** R2  
**Issue:** The `expected` transition table uses positional arrays like `["scenario-validity", "in_progress", "skipped"]`, which makes the mapping less self-documenting.  
**Suggestion:** Replace the tuple array with objects: `{ stepId: "scenario-validity", currentStatus: "in_progress", requestedStatus: "skipped" }`. This removes the need to destructure positional fields and matches the object shape returned later.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 24. 1. Centralize report path resolution
**Finding key:** loop-68c5a7ef5be0495d87c6
**Failure mode:** refactor
**File:** src/flow/lib/run-report.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/run-report.js`  
**Requirement:** R3  
**Issue:** Report path construction is duplicated in `loadPersistedReport()` and `execute()` via separate `path.join(path.dirname(path.resolve(root, specPath)), "report.json")` expressions.  
**Suggestion:** Add a small `reportPath(root, specPath)` helper and use it from both places. This reduces drift risk as report persistence/resume logic grows.
**Suggestion:** **File:** `src/flow/lib/run-report.js`  
**Requirement:** R3  
**Issue:** Report path construction is duplicated in `loadPersistedReport()` and `execute()` via separate `path.join(path.dirname(path.resolve(root, specPath)), "report.json")` expressions.  
**Suggestion:** Add a small `reportPath(root, specPath)` helper and use it from both places. This reduces drift risk as report persistence/resume logic grows.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 25. 2. Reuse delivery-completion helper in the initial delivery path
**Finding key:** loop-f4a0b0b76b99e490eb2e
**Failure mode:** refactor
**File:** src/flow/lib/run-report.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/run-report.js`  
**Requirement:** R7  
**Issue:** `completedIssueComment()` exists for resume delivery, but the initial delivery success path manually builds a similar `issueComment` object. The two shapes already differ: resumed delivery includes `idempotencyKey`, initial delivery does not.  
**Suggestion:** Use `completedIssueComment(state, ctx.flowOutboxEntry, delivery.posted.resumed)` in both paths so successful linked-Issue delivery artifacts have one consistent shape.
**Suggestion:** **File:** `src/flow/lib/run-report.js`  
**Requirement:** R7  
**Issue:** `completedIssueComment()` exists for resume delivery, but the initial delivery success path manually builds a similar `issueComment` object. The two shapes already differ: resumed delivery includes `idempotencyKey`, initial delivery does not.  
**Suggestion:** Use `completedIssueComment(state, ctx.flowOutboxEntry, delivery.posted.resumed)` in both paths so successful linked-Issue delivery artifacts have one consistent shape.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 26. 3. Simplify pending delivery persistence
**Finding key:** loop-97f83d374181e496abb0
**Failure mode:** refactor
**File:** src/flow/lib/run-report.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/run-report.js`  
**Requirement:** R3  
**Issue:** The linked-Issue path saves a pending report before attempting delivery, then saves another pending report with a failure reason if posting fails. This creates repeated `withDelivery(...deliveryState("pending"...))` construction and makes the control flow noisier.  
**Suggestion:** Introduce a helper such as `pendingDeliveryReport(report, ctx, reason = null)` or `savePendingDeliveryReport(root, state.spec, report, idempotencyKey, reason)` and use it for both the pre-delivery and failure states.
**Suggestion:** **File:** `src/flow/lib/run-report.js`  
**Requirement:** R3  
**Issue:** The linked-Issue path saves a pending report before attempting delivery, then saves another pending report with a failure reason if posting fails. This creates repeated `withDelivery(...deliveryState("pending"...))` construction and makes the control flow noisier.  
**Suggestion:** Introduce a helper such as `pendingDeliveryReport(report, ctx, reason = null)` or `savePendingDeliveryReport(root, state.spec, report, idempotencyKey, reason)` and use it for both the pre-delivery and failure states.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 27. 4. Rename `redolog` to match the loaded artifact
**Finding key:** loop-468026561604bfe2eb1a
**Failure mode:** refactor
**File:** src/flow/lib/run-report.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/run-report.js`  
**Requirement:** R7  
**Issue:** The variable `redolog` now represents the required `issue-log.json` loaded through `loadRequiredIssueLog()`. The old name is less clear and does not match the report data key `issueLog`.  
**Suggestion:** Rename `redolog` to `issueLog` and pass `issueLog` into `generateReport()`. This aligns naming with the source artifact and persisted report data.
**Suggestion:** **File:** `src/flow/lib/run-report.js`  
**Requirement:** R7  
**Issue:** The variable `redolog` now represents the required `issue-log.json` loaded through `loadRequiredIssueLog()`. The old name is less clear and does not match the report data key `issueLog`.  
**Suggestion:** Rename `redolog` to `issueLog` and pass `issueLog` into `generateReport()`. This aligns naming with the source artifact and persisted report data.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 28. 5. Avoid tuple destructuring in `reportSourcePaths()`
**Finding key:** loop-d597b5d06d9e42ef75f1
**Failure mode:** refactor
**File:** src/flow/lib/run-report.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/run-report.js`  
**Requirement:** R5  
**Issue:** `const [issueLog, ...optionalArtifacts] = [...]` obscures that `issue-log.json` is required while the remaining artifacts are optional.  
**Suggestion:** Use explicit constants, for example `const requiredArtifact = "issue-log.json"; const optionalArtifacts = [...]`. This makes the binding source list easier to audit against R5.
**Suggestion:** **File:** `src/flow/lib/run-report.js`  
**Requirement:** R5  
**Issue:** `const [issueLog, ...optionalArtifacts] = [...]` obscures that `issue-log.json` is required while the remaining artifacts are optional.  
**Suggestion:** Use explicit constants, for example `const requiredArtifact = "issue-log.json"; const optionalArtifacts = [...]`. This makes the binding source list easier to audit against R5.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 29. 1. Extract the Revalidation Transition Spec
**Finding key:** loop-e7c3654a6d2c9387e562
**Failure mode:** refactor
**File:** src/flow/lib/step-transition-policy.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/step-transition-policy.js`  
**Requirement:** R1  
**Issue:** `expected` is rebuilt inside the validation branch every time `ExplicitRecoveryTransition` is checked, and the transition rules are embedded directly in control flow.  
**Suggestion:** Move the expected lifecycle transition map to a module-level constant, e.g. `EXISTING_IMPLEMENTATION_REVALIDATION_CHANGES`, alongside the entrypoint constants. This keeps transition policy data colocated and avoids recreating the map per validation.
**Suggestion:** **File:** `src/flow/lib/step-transition-policy.js`  
**Requirement:** R1  
**Issue:** `expected` is rebuilt inside the validation branch every time `ExplicitRecoveryTransition` is checked, and the transition rules are embedded directly in control flow.  
**Suggestion:** Move the expected lifecycle transition map to a module-level constant, e.g. `EXISTING_IMPLEMENTATION_REVALIDATION_CHANGES`, alongside the entrypoint constants. This keeps transition policy data colocated and avoids recreating the map per validation.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 30. 2. Replace Remaining String Literal Entrypoint
**Finding key:** loop-86d050d65e1ca9a45d88
**Failure mode:** refactor
**File:** src/flow/lib/step-transition-policy.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/step-transition-policy.js`  
**Requirement:** R2  
**Issue:** `"impl-repair-invalidation"` is still used as a raw string in `isStepTransition`, while the new entrypoint uses a named constant. This creates inconsistent naming and increases typo risk.  
**Suggestion:** Introduce `const IMPL_REPAIR_INVALIDATION_ENTRYPOINT = "impl-repair-invalidation";` and use it in both validation and `isStepTransition`.
**Suggestion:** **File:** `src/flow/lib/step-transition-policy.js`  
**Requirement:** R2  
**Issue:** `"impl-repair-invalidation"` is still used as a raw string in `isStepTransition`, while the new entrypoint uses a named constant. This creates inconsistent naming and increases typo risk.  
**Suggestion:** Introduce `const IMPL_REPAIR_INVALIDATION_ENTRYPOINT = "impl-repair-invalidation";` and use it in both validation and `isStepTransition`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 31. 3. Share Supported Recovery Entrypoints
**Finding key:** loop-040662e8350117e5a86d
**Failure mode:** refactor
**File:** src/flow/lib/step-transition-policy.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/step-transition-policy.js`  
**Requirement:** R4  
**Issue:** Supported recovery entrypoints are effectively defined in multiple places: the validation `if/else` chain and the `isStepTransition` allowlist. Adding another entrypoint requires updating both locations manually.  
**Suggestion:** Add a module-level `SUPPORTED_RECOVERY_ENTRYPOINTS` set and use it in `isStepTransition`. If the validation branches remain explicit, this still centralizes the public allowlist and makes future additions less error-prone.
**Suggestion:** **File:** `src/flow/lib/step-transition-policy.js`  
**Requirement:** R4  
**Issue:** Supported recovery entrypoints are effectively defined in multiple places: the validation `if/else` chain and the `isStepTransition` allowlist. Adding another entrypoint requires updating both locations manually.  
**Suggestion:** Add a module-level `SUPPORTED_RECOVERY_ENTRYPOINTS` set and use it in `isStepTransition`. If the validation branches remain explicit, this still centralizes the public allowlist and makes future additions less error-prone.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 32. 1. Extract repeated target-guard command boilerplate
**Finding key:** loop-8ef44752cdbff2d99b03
**Failure mode:** refactor
**File:** src/flow/registry.js
**Requirement:** R6
**Issue:** **File:** `src/flow/registry.js`  
**Requirement:** R6  
**Issue:** The new `recover-existing-implementation` registry entry repeats the same `flags`, `options`, `--agent-work-dir` help line, and `FLOW_TARGET_GUARD_HELP_LINES` structure used by nearby flow-run commands. This increases drift risk when shared CLI help or guard options change.  
**Suggestion:** Add a small local helper for flow-run commands that require `FLOW_TARGET_GUARD_FLAGS` and `FLOW_RUN_OPTIONS`, then pass only the command-specific usage, summary, and import target.
**Suggestion:** **File:** `src/flow/registry.js`  
**Requirement:** R6  
**Issue:** The new `recover-existing-implementation` registry entry repeats the same `flags`, `options`, `--agent-work-dir` help line, and `FLOW_TARGET_GUARD_HELP_LINES` structure used by nearby flow-run commands. This increases drift risk when shared CLI help or guard options change.  
**Suggestion:** Add a small local helper for flow-run commands that require `FLOW_TARGET_GUARD_FLAGS` and `FLOW_RUN_OPTIONS`, then pass only the command-specific usage, summary, and import target.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 33. 2. Shorten and clarify the help summary
**Finding key:** loop-4ecd015b9f863d32b4e9
**Failure mode:** refactor
**File:** src/flow/registry.js
**Requirement:** R6
**Issue:** **File:** `src/flow/registry.js`  
**Requirement:** R6  
**Issue:** The help description is a very long sentence with several stacked domain terms: `post-acceptance-rewind scenario-validity preflight block`, `post-implementation test execution`, and `implementation-target changes`. This makes CLI help harder to scan and maintain.  
**Suggestion:** Split the description into two shorter lines, for example one line stating what transition is recorded and one line listing the required evidence/guards. Keep the terminology, but reduce the single dense sentence.
**Suggestion:** **File:** `src/flow/registry.js`  
**Requirement:** R6  
**Issue:** The help description is a very long sentence with several stacked domain terms: `post-acceptance-rewind scenario-validity preflight block`, `post-implementation test execution`, and `implementation-target changes`. This makes CLI help harder to scan and maintain.  
**Suggestion:** Split the description into two shorter lines, for example one line stating what transition is recorded and one line listing the required evidence/guards. Keep the terminology, but reduce the single dense sentence.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 34. 1. Extract Recovery Fixture Setup
**Finding key:** loop-320f38808c0b47699ddc
**Failure mode:** refactor
**File:** tests/unit/flow/recover-existing-implementation.test.js
**Requirement:** R6
**Issue:** **File:** `tests/unit/flow/recover-existing-implementation.test.js`  
**Requirement:** R6  
**Issue:** The first test has a long arrange section that mixes spec creation, flow setup, fingerprint setup, stale evidence setup, and implementation mutation. This makes the behavior under test harder to scan.  
**Suggestion:** Extract a local helper such as `createRecoverableExistingImplementationFixture()` that returns `{ manager, activeState, specDir }`, keeping the test focused on executing the command and asserting outcomes.
**Suggestion:** **File:** `tests/unit/flow/recover-existing-implementation.test.js`  
**Requirement:** R6  
**Issue:** The first test has a long arrange section that mixes spec creation, flow setup, fingerprint setup, stale evidence setup, and implementation mutation. This makes the behavior under test harder to scan.  
**Suggestion:** Extract a local helper such as `createRecoverableExistingImplementationFixture()` that returns `{ manager, activeState, specDir }`, keeping the test focused on executing the command and asserting outcomes.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 35. 2. Centralize Spec Artifact Paths
**Finding key:** loop-dc7c8ddab3d4dfdd1ca9
**Failure mode:** refactor
**File:** tests/unit/flow/recover-existing-implementation.test.js
**Requirement:** R6
**Issue:** **File:** `tests/unit/flow/recover-existing-implementation.test.js`  
**Requirement:** R6  
**Issue:** Paths under `specs/${SPEC_ID}` are constructed repeatedly with template strings and `path.join`, which creates small duplication and increases the chance of future path drift.  
**Suggestion:** Add a small local helper like `specArtifactPath(tmp, ...parts)` or reuse `specDir` consistently for all spec artifact writes and assertions.
**Suggestion:** **File:** `tests/unit/flow/recover-existing-implementation.test.js`  
**Requirement:** R6  
**Issue:** Paths under `specs/${SPEC_ID}` are constructed repeatedly with template strings and `path.join`, which creates small duplication and increases the chance of future path drift.  
**Suggestion:** Add a small local helper like `specArtifactPath(tmp, ...parts)` or reuse `specDir` consistently for all spec artifact writes and assertions.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 36. 1. Normalize Delivery State Terminology Across Spec And Runtime
**Finding key:** loop-cb5b703f92b194891678
**Failure mode:** refactor
**File:** specs/348-report-delivery-fail-closed/spec.json
**Requirement:** R3
**Issue:** **File:** `specs/348-report-delivery-fail-closed/spec.json`
**Requirement:** R3
**Issue:** Both `spec.json` and `spec.md` call out unclear use of `unsent` vs `pending`, while `src/flow/lib/run-report.js` is adding more pending-delivery construction. Without one canonical state definition, implementation and tests can drift.
**Suggestion:** Define delivery states once in the spec and align `run-report.js` helper names and tests to those exact terms.
**Suggestion:** **File:** `specs/348-report-delivery-fail-closed/spec.json`
**Requirement:** R3
**Issue:** Both `spec.json` and `spec.md` call out unclear use of `unsent` vs `pending`, while `src/flow/lib/run-report.js` is adding more pending-delivery construction. Without one canonical state definition, implementation and tests can drift.
**Suggestion:** Define delivery states once in the spec and align `run-report.js` helper names and tests to those exact terms.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 37. 2. Keep Issue Log Naming Consistent Across Report Code
**Finding key:** loop-aa46142cc5724a977bfb
**Failure mode:** refactor
**File:** src/flow/lib/run-report.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/run-report.js`
**Requirement:** R7
**Issue:** `run-report.js` still uses `redolog` for data now loaded as `issue-log.json`, while specs and report binding proposals consistently refer to `issueLog` / `issue-log.json`. This cross-file naming mismatch makes the artifact contract harder to follow.
**Suggestion:** Rename `redolog` to `issueLog` and keep spec, binding, report generation, and tests using the same issue-log terminology.
**Suggestion:** **File:** `src/flow/lib/run-report.js`
**Requirement:** R7
**Issue:** `run-report.js` still uses `redolog` for data now loaded as `issue-log.json`, while specs and report binding proposals consistently refer to `issueLog` / `issue-log.json`. This cross-file naming mismatch makes the artifact contract harder to follow.
**Suggestion:** Rename `redolog` to `issueLog` and keep spec, binding, report generation, and tests using the same issue-log terminology.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 38. 3. Centralize Spec Artifact Path Construction Across Tests And Report Code
**Finding key:** loop-53f7dacf46247d473b78
**Failure mode:** refactor
**File:** src/flow/lib/run-report.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/run-report.js`
**Requirement:** R5
**Issue:** Multiple files independently construct spec-relative artifact paths: report persistence in `run-report.js`, source binding paths in `report.js`, and repeated issue-log/report paths in tests. This duplicates the artifact layout contract across files.
**Suggestion:** Add or reuse a shared path helper for spec-local artifacts such as `issue-log.json`, `report.json`, and binding inputs, then update runtime and tests to use it consistently.
**Suggestion:** **File:** `src/flow/lib/run-report.js`
**Requirement:** R5
**Issue:** Multiple files independently construct spec-relative artifact paths: report persistence in `run-report.js`, source binding paths in `report.js`, and repeated issue-log/report paths in tests. This duplicates the artifact layout contract across files.
**Suggestion:** Add or reuse a shared path helper for spec-local artifacts such as `issue-log.json`, `report.json`, and binding inputs, then update runtime and tests to use it consistently.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 39. 4. Align Recovery Transition Naming Across Flow Modules
**Finding key:** loop-b2e7af85f5a357b7da77
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`
**Requirement:** R4
**Issue:** Recovery transition concepts appear in `impl-repair-artifacts.js`, `run-recover-existing-implementation.js`, and `step-transition-policy.js`, but naming varies between generic `transition`, explicit recovery transition policy, and revalidation transition tables. This makes the interface between recovery modules less clear.
**Suggestion:** Use a consistent domain name such as `recoveryTransition` or `explicitRecoveryTransition` across parameters, validation helpers, and transition policy constants.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`
**Requirement:** R4
**Issue:** Recovery transition concepts appear in `impl-repair-artifacts.js`, `run-recover-existing-implementation.js`, and `step-transition-policy.js`, but naming varies between generic `transition`, explicit recovery transition policy, and revalidation transition tables. This makes the interface between recovery modules less clear.
**Suggestion:** Use a consistent domain name such as `recoveryTransition` or `explicitRecoveryTransition` across parameters, validation helpers, and transition policy constants.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 40. 5. Share Recovery Entrypoint Constants Between Registry, Runner, And Policy
**Finding key:** loop-31481b1a920214e230cf
**Failure mode:** refactor
**File:** src/flow/lib/step-transition-policy.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/step-transition-policy.js`
**Requirement:** R2
**Issue:** Recovery command and entrypoint strings are repeated across `registry.js`, `run-recover-existing-implementation.js`, and `step-transition-policy.js`. This creates a cross-file typo and rename risk.
**Suggestion:** Introduce shared constants for recovery command/entrypoint identifiers, or colocate them in the policy module and import them where registry and runner responses need the same values.
**Suggestion:** **File:** `src/flow/lib/step-transition-policy.js`
**Requirement:** R2
**Issue:** Recovery command and entrypoint strings are repeated across `registry.js`, `run-recover-existing-implementation.js`, and `step-transition-policy.js`. This creates a cross-file typo and rename risk.
**Suggestion:** Introduce shared constants for recovery command/entrypoint identifiers, or colocate them in the policy module and import them where registry and runner responses need the same values.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
