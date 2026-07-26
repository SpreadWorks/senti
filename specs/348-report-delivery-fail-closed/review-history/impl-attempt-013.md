# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 1. Align Task Status With Requirement Status
**Finding key:** loop-7b2db1be5d46d699fc7a
**Failure mode:** refactor
**File:** specs/348-report-delivery-fail-closed/spec.json
**Requirement:** R1
**Issue:** **File:** `specs/348-report-delivery-fail-closed/spec.json`  
**Requirement:** R1  
**Issue:** The `requirements` entries are all marked `"status": "done"`, but their corresponding `tasks` remain `"status": "pending"`. This creates conflicting lifecycle state in the same spec.  
**Suggestion:** Update task statuses to match the completed requirements, or change requirement statuses back to pending if implementation is not complete.
**Suggestion:** **File:** `specs/348-report-delivery-fail-closed/spec.json`  
**Requirement:** R1  
**Issue:** The `requirements` entries are all marked `"status": "done"`, but their corresponding `tasks` remain `"status": "pending"`. This creates conflicting lifecycle state in the same spec.  
**Suggestion:** Update task statuses to match the completed requirements, or change requirement statuses back to pending if implementation is not complete.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 2. 2. Remove Duplicated Overview Entries
**Finding key:** loop-93725aaa2377c4841ad8
**Failure mode:** refactor
**File:** specs/348-report-delivery-fail-closed/spec.json
**Requirement:** R7
**Issue:** **File:** `specs/348-report-delivery-fail-closed/spec.json`  
**Requirement:** R7  
**Issue:** Several `overview.modules`, `overview.data_flow`, and `overview.decisions` entries repeat the same concepts already captured in requirements and tasks, especially the added `RunReportCommand`, delivery retry, and binding freshness bullets.  
**Suggestion:** Consolidate these repeated `added_by_task` entries into the existing higher-level overview text, keeping the task-specific detail in `tasks`.
**Suggestion:** **File:** `specs/348-report-delivery-fail-closed/spec.json`  
**Requirement:** R7  
**Issue:** Several `overview.modules`, `overview.data_flow`, and `overview.decisions` entries repeat the same concepts already captured in requirements and tasks, especially the added `RunReportCommand`, delivery retry, and binding freshness bullets.  
**Suggestion:** Consolidate these repeated `added_by_task` entries into the existing higher-level overview text, keeping the task-specific detail in `tasks`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 3. 3. Clarify Delivery State Naming
**Finding key:** loop-f3abe2b64c5b51d446bd
**Failure mode:** refactor
**File:** specs/348-report-delivery-fail-closed/spec.json
**Requirement:** R3
**Issue:** **File:** `specs/348-report-delivery-fail-closed/spec.json`  
**Requirement:** R3  
**Issue:** The spec uses both `unsent` and `pending` for incomplete delivery, but does not define when each status applies. This weakens the contract and may lead to inconsistent implementation or tests.  
**Suggestion:** Add a short definition for each delivery status, for example `unsent` for no attempt due to unavailable `gh`, and `pending` for attempted delivery that failed.
**Suggestion:** **File:** `specs/348-report-delivery-fail-closed/spec.json`  
**Requirement:** R3  
**Issue:** The spec uses both `unsent` and `pending` for incomplete delivery, but does not define when each status applies. This weakens the contract and may lead to inconsistent implementation or tests.  
**Suggestion:** Add a short definition for each delivery status, for example `unsent` for no attempt due to unavailable `gh`, and `pending` for attempted delivery that failed.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 4. 4. Simplify Repeated Retry Bound Wording
**Finding key:** loop-fdf6f085b01035b6da79
**Failure mode:** refactor
**File:** specs/348-report-delivery-fail-closed/spec.json
**Requirement:** R4
**Issue:** **File:** `specs/348-report-delivery-fail-closed/spec.json`  
**Requirement:** R4  
**Issue:** The “one attempt per command invocation” constraint appears in `constraints`, `overview.modules`, `overview.decisions`, `requirements`, `acceptance_criteria`, and task acceptance. The repetition increases maintenance cost and risk of drift.  
**Suggestion:** Keep the normative wording in R4 and the guardrail acknowledgment, then shorten the other occurrences to reference R4 rather than restating the full rule.
**Suggestion:** **File:** `specs/348-report-delivery-fail-closed/spec.json`  
**Requirement:** R4  
**Issue:** The “one attempt per command invocation” constraint appears in `constraints`, `overview.modules`, `overview.decisions`, `requirements`, `acceptance_criteria`, and task acceptance. The repetition increases maintenance cost and risk of drift.  
**Suggestion:** Keep the normative wording in R4 and the guardrail acknowledgment, then shorten the other occurrences to reference R4 rather than restating the full rule.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 5. 1. Remove Duplicate Overview Bullets
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

### 6. 2. Normalize Data Flow Into One Style
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

### 7. 3. Remove Empty Placeholder Sections
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

### 8. 4. Clarify Delivery State Naming
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

### 9. 1. Extract Repeated Issue Log Path Helpers
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

### 10. 2. Use `try/finally` For All Environment Mutations
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

### 11. 3. Consolidate Fake `gh` Installer Behavior
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

### 12. 4. Bound Recursive Step Traversal
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

### 13. 5. Reduce Large Inline Artifact Fixtures
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

### 14. 6. Avoid Recreating `RunReportCommand` Repeatedly In Single Tests
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

### 15. 1. Add an explicit bound for binding source artifacts
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

### 16. 2. Extract duplicate file hashing logic
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

### 17. 3. Validate source paths during binding creation
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

### 18. 1. Use a More Specific Parameter Name
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

### 19. 2. Prefer Nullish Coalescing for Optional Override
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

### 20. 1. Extract Repeated Command Metadata
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

### 21. 2. Reuse Lifecycle Validation Helper
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

### 22. 3. Rename `reject` to Avoid Ambiguity
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

### 23. 4. Avoid Re-reading Invalid Paths During Pending Recovery
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

### 24. 5. Name Transition Table Fields Explicitly
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

### 25. 1. Centralize report path resolution
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

### 26. 2. Reuse delivery-completion helper in the initial delivery path
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

### 27. 3. Simplify pending delivery persistence
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

### 28. 4. Rename `redolog` to match the loaded artifact
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

### 29. 5. Avoid tuple destructuring in `reportSourcePaths()`
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

### 30. 1. Extract the Revalidation Transition Spec
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

### 31. 2. Replace Remaining String Literal Entrypoint
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

### 32. 3. Share Supported Recovery Entrypoints
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

### 33. 1. Extract repeated target-guard command boilerplate
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

### 34. 2. Shorten and clarify the help summary
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

### 35. 1. Extract Recovery Fixture Setup
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

### 36. 2. Centralize Spec Artifact Paths
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

### 37. 1. Define Delivery Status Vocabulary Once
**Finding key:** loop-a667a2e29ee66ae321b6
**Failure mode:** refactor
**File:** specs/348-report-delivery-fail-closed/spec.md
**Requirement:** R3
**Issue:** **File:** `specs/348-report-delivery-fail-closed/spec.md`  
**Requirement:** R3  
**Issue:** Both `spec.md` and `spec.json` use `unsent` and `pending` without a shared definition. This creates a cross-file contract ambiguity for `src/flow/lib/run-report.js` and the report delivery tests.  
**Suggestion:** Add the same canonical status definitions to both spec representations, or generate one from the other, so implementation and tests can consistently distinguish “not attempted” from “attempted but failed.”
**Suggestion:** **File:** `specs/348-report-delivery-fail-closed/spec.md`  
**Requirement:** R3  
**Issue:** Both `spec.md` and `spec.json` use `unsent` and `pending` without a shared definition. This creates a cross-file contract ambiguity for `src/flow/lib/run-report.js` and the report delivery tests.  
**Suggestion:** Add the same canonical status definitions to both spec representations, or generate one from the other, so implementation and tests can consistently distinguish “not attempted” from “attempted but failed.”
**Disposition:** informational
**Rationale:** Loop review proposal.

### 38. 2. Align Initial And Resumed Delivery Artifact Shape
**Finding key:** loop-000c025b55db7225ba10
**Failure mode:** refactor
**File:** src/flow/lib/run-report.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/run-report.js`  
**Requirement:** R7  
**Issue:** The initial delivery path and resumed delivery path produce different successful `issueComment` shapes: resumed delivery includes `idempotencyKey`, while initial delivery does not. Tests and report consumers may see inconsistent interfaces for the same completed delivery state.  
**Suggestion:** Use the same helper, such as `completedIssueComment(...)`, for both initial and resumed successful delivery so the persisted report schema is stable.
**Suggestion:** **File:** `src/flow/lib/run-report.js`  
**Requirement:** R7  
**Issue:** The initial delivery path and resumed delivery path produce different successful `issueComment` shapes: resumed delivery includes `idempotencyKey`, while initial delivery does not. Tests and report consumers may see inconsistent interfaces for the same completed delivery state.  
**Suggestion:** Use the same helper, such as `completedIssueComment(...)`, for both initial and resumed successful delivery so the persisted report schema is stable.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 39. 3. Consolidate Spec Overview Duplication Across Formats
**Finding key:** loop-bbefd08005987ed77593
**Failure mode:** refactor
**File:** specs/348-report-delivery-fail-closed/spec.json
**Requirement:** R7
**Issue:** **File:** `specs/348-report-delivery-fail-closed/spec.json`  
**Requirement:** R7  
**Issue:** `spec.json` and `spec.md` both contain duplicated overview/module/data-flow material, but not in exactly the same shape. This increases the chance that one spec format drifts from the other.  
**Suggestion:** Keep one canonical overview structure and mirror it consistently between `spec.json` and `spec.md`, removing fragment-style repeated bullets from both.
**Suggestion:** **File:** `specs/348-report-delivery-fail-closed/spec.json`  
**Requirement:** R7  
**Issue:** `spec.json` and `spec.md` both contain duplicated overview/module/data-flow material, but not in exactly the same shape. This increases the chance that one spec format drifts from the other.  
**Suggestion:** Keep one canonical overview structure and mirror it consistently between `spec.json` and `spec.md`, removing fragment-style repeated bullets from both.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 40. 4. Standardize Recovery Transition Naming
**Finding key:** loop-d8a4122fb3ebc1e0a4c8
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R4  
**Issue:** Recovery transition concepts appear across `impl-repair-artifacts.js`, `run-recover-existing-implementation.js`, and `step-transition-policy.js`, but names vary between generic `transition`, explicit recovery transition objects, entrypoint strings, and transition tables. This makes the cross-file interface harder to audit.  
**Suggestion:** Use a consistent naming scheme such as `recoveryTransition` for values and `*_RECOVERY_ENTRYPOINT` for entrypoint constants across all three files.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R4  
**Issue:** Recovery transition concepts appear across `impl-repair-artifacts.js`, `run-recover-existing-implementation.js`, and `step-transition-policy.js`, but names vary between generic `transition`, explicit recovery transition objects, entrypoint strings, and transition tables. This makes the cross-file interface harder to audit.  
**Suggestion:** Use a consistent naming scheme such as `recoveryTransition` for values and `*_RECOVERY_ENTRYPOINT` for entrypoint constants across all three files.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
