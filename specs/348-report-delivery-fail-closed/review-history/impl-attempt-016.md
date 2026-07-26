# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 1. Remove Duplicated Task-Derived Overview Entries
**Finding key:** loop-e8b33391ec01de1e5e12
**Failure mode:** refactor
**File:** specs/348-report-delivery-fail-closed/spec.json
**Requirement:** R7
**Issue:** **File:** `specs/348-report-delivery-fail-closed/spec.json`  
**Requirement:** R7  
**Issue:** `overview.modules`, `overview.data_flow`, and `overview.decisions` repeat several task-level statements already captured under `tasks`, increasing maintenance cost and making the spec harder to keep consistent.  
**Suggestion:** Keep the higher-level overview entries and remove the `added_by_task` duplicate entries, or consolidate them into the relevant task descriptions only.
**Suggestion:** **File:** `specs/348-report-delivery-fail-closed/spec.json`  
**Requirement:** R7  
**Issue:** `overview.modules`, `overview.data_flow`, and `overview.decisions` repeat several task-level statements already captured under `tasks`, increasing maintenance cost and making the spec harder to keep consistent.  
**Suggestion:** Keep the higher-level overview entries and remove the `added_by_task` duplicate entries, or consolidate them into the relevant task descriptions only.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 2. 2. Align Task Status With Requirement Status
**Finding key:** loop-baa886c6dc9d8041e5e9
**Failure mode:** refactor
**File:** specs/348-report-delivery-fail-closed/spec.json
**Requirement:** R7
**Issue:** **File:** `specs/348-report-delivery-fail-closed/spec.json`  
**Requirement:** R7  
**Issue:** All requirements are marked `"status": "done"`, but tasks `T-1`, `T-2`, and `T-3` remain `"status": "pending"`. That creates conflicting lifecycle signals in the same spec.  
**Suggestion:** Update task statuses to match the completed requirement state, or change requirement statuses if implementation is not actually complete.
**Suggestion:** **File:** `specs/348-report-delivery-fail-closed/spec.json`  
**Requirement:** R7  
**Issue:** All requirements are marked `"status": "done"`, but tasks `T-1`, `T-2`, and `T-3` remain `"status": "pending"`. That creates conflicting lifecycle signals in the same spec.  
**Suggestion:** Update task statuses to match the completed requirement state, or change requirement statuses if implementation is not actually complete.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 3. 3. Simplify Repeated Delivery Retry Wording
**Finding key:** loop-94a558076eea66899211
**Failure mode:** refactor
**File:** specs/348-report-delivery-fail-closed/spec.json
**Requirement:** R4
**Issue:** **File:** `specs/348-report-delivery-fail-closed/spec.json`  
**Requirement:** R4  
**Issue:** The one-attempt-per-command retry rule appears in `constraints`, `overview.modules`, `overview.data_flow`, `overview.decisions`, `R4`, `AC4`, and `T-2`. The repeated phrasing increases the chance of subtle divergence.  
**Suggestion:** Keep the normative rule in `constraints` and `R4`, then shorten the other sections to reference “the R4 delivery retry contract” instead of restating the behavior.
**Suggestion:** **File:** `specs/348-report-delivery-fail-closed/spec.json`  
**Requirement:** R4  
**Issue:** The one-attempt-per-command retry rule appears in `constraints`, `overview.modules`, `overview.data_flow`, `overview.decisions`, `R4`, `AC4`, and `T-2`. The repeated phrasing increases the chance of subtle divergence.  
**Suggestion:** Keep the normative rule in `constraints` and `R4`, then shorten the other sections to reference “the R4 delivery retry contract” instead of restating the behavior.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 4. 4. Rename Ambiguous “pending” Delivery State
**Finding key:** loop-10a95903c4073ba728c4
**Failure mode:** refactor
**File:** specs/348-report-delivery-fail-closed/spec.json
**Requirement:** R3
**Issue:** **File:** `specs/348-report-delivery-fail-closed/spec.json`  
**Requirement:** R3  
**Issue:** The spec uses both `unsent` and `pending` for failed delivery states, but their distinction is not clearly defined. This can lead to inconsistent implementation or tests.  
**Suggestion:** Either define the exact semantic difference between `unsent` and `pending`, or collapse to one failure state if the distinction is not required.
**Suggestion:** **File:** `specs/348-report-delivery-fail-closed/spec.json`  
**Requirement:** R3  
**Issue:** The spec uses both `unsent` and `pending` for failed delivery states, but their distinction is not clearly defined. This can lead to inconsistent implementation or tests.  
**Suggestion:** Either define the exact semantic difference between `unsent` and `pending`, or collapse to one failure state if the distinction is not required.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 5. 1. Remove Duplicate Overview Bullets
**Finding key:** loop-0efc805f9e3d4a541ed1
**Failure mode:** refactor
**File:** specs/348-report-delivery-fail-closed/spec.md
**Requirement:** R7
**Issue:** **File:** `specs/348-report-delivery-fail-closed/spec.md`  
**Requirement:** R7  
**Issue:** The `Overview > Modules` section repeats `RunReportCommand` concepts in multiple bullets, including fragments like `RunReportCommand in src/flow/lib/run-report.js` and `RunReportCommand delivery state and retry`, which read like task notes rather than spec design.  
**Suggestion:** Consolidate these into the first `RunReportCommand` bullet and remove the redundant fragment bullets.
**Suggestion:** **File:** `specs/348-report-delivery-fail-closed/spec.md`  
**Requirement:** R7  
**Issue:** The `Overview > Modules` section repeats `RunReportCommand` concepts in multiple bullets, including fragments like `RunReportCommand in src/flow/lib/run-report.js` and `RunReportCommand delivery state and retry`, which read like task notes rather than spec design.  
**Suggestion:** Consolidate these into the first `RunReportCommand` bullet and remove the redundant fragment bullets.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 2. Normalize Data Flow Detail Into Complete Sentences
**Finding key:** loop-07f21d9b0528cd7792a9
**Failure mode:** refactor
**File:** specs/348-report-delivery-fail-closed/spec.md
**Requirement:** R1
**Issue:** **File:** `specs/348-report-delivery-fail-closed/spec.md`  
**Requirement:** R1  
**Issue:** `Data Flow` mixes complete design bullets with terse implementation-note bullets such as `IssueLogStore read failure -> RunReportCommand failure` and `Report generation -> pending delivery artifact -> outbox retry -> Issue comment`. This creates duplication with the surrounding prose and weakens consistency.  
**Suggestion:** Either remove these shorthand bullets or rewrite them as explicit data-flow statements matching the rest of the section.
**Suggestion:** **File:** `specs/348-report-delivery-fail-closed/spec.md`  
**Requirement:** R1  
**Issue:** `Data Flow` mixes complete design bullets with terse implementation-note bullets such as `IssueLogStore read failure -> RunReportCommand failure` and `Report generation -> pending delivery artifact -> outbox retry -> Issue comment`. This creates duplication with the surrounding prose and weakens consistency.  
**Suggestion:** Either remove these shorthand bullets or rewrite them as explicit data-flow statements matching the rest of the section.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 3. Remove Empty Placeholder Sections
**Finding key:** loop-ed9b298b17c3e8af04a7
**Failure mode:** refactor
**File:** specs/348-report-delivery-fail-closed/spec.md
**Requirement:** R7
**Issue:** **File:** `specs/348-report-delivery-fail-closed/spec.md`  
**Requirement:** R7  
**Issue:** `Clarifications (Q&A)` contains empty `Q:` / `A:` placeholders, and `Open Questions` contains only an empty checkbox. These are dead spec content and add noise.  
**Suggestion:** Delete these sections until there is real content, or replace them with a concise `None` if the project template requires the headings.
**Suggestion:** **File:** `specs/348-report-delivery-fail-closed/spec.md`  
**Requirement:** R7  
**Issue:** `Clarifications (Q&A)` contains empty `Q:` / `A:` placeholders, and `Open Questions` contains only an empty checkbox. These are dead spec content and add noise.  
**Suggestion:** Delete these sections until there is real content, or replace them with a concise `None` if the project template requires the headings.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 4. Clarify Delivery State Naming
**Finding key:** loop-ea8ba0586a31aebf7e28
**Failure mode:** refactor
**File:** specs/348-report-delivery-fail-closed/spec.md
**Requirement:** R3
**Issue:** **File:** `specs/348-report-delivery-fail-closed/spec.md`  
**Requirement:** R3  
**Issue:** The spec uses both `unsent` and `pending` for failed delivery states but does not define when each should be used. This ambiguity can lead to inconsistent implementation and tests.  
**Suggestion:** Add a short definition, for example: `unsent` means no delivery attempt was possible, while `pending` means an attempted delivery failed and is retryable.
**Suggestion:** **File:** `specs/348-report-delivery-fail-closed/spec.md`  
**Requirement:** R3  
**Issue:** The spec uses both `unsent` and `pending` for failed delivery states but does not define when each should be used. This ambiguity can lead to inconsistent implementation and tests.  
**Suggestion:** Add a short definition, for example: `unsent` means no delivery attempt was possible, while `pending` means an attempted delivery failed and is retryable.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 5. Tighten Binding Module Naming
**Finding key:** loop-592d7aead95db69d7688
**Failure mode:** refactor
**File:** specs/348-report-delivery-fail-closed/spec.md
**Requirement:** R6
**Issue:** **File:** `specs/348-report-delivery-fail-closed/spec.md`  
**Requirement:** R6  
**Issue:** `ReportBinding validates report Git/source authority...` appears as a standalone module name, but no implementation target or existing module is identified for `ReportBinding`.  
**Suggestion:** Either name the concrete file/module that will own this behavior, or rephrase as “Report artifact validation validates...” to stay consistent with the listed implementation targets.
**Suggestion:** **File:** `specs/348-report-delivery-fail-closed/spec.md`  
**Requirement:** R6  
**Issue:** `ReportBinding validates report Git/source authority...` appears as a standalone module name, but no implementation target or existing module is identified for `ReportBinding`.  
**Suggestion:** Either name the concrete file/module that will own this behavior, or rephrase as “Report artifact validation validates...” to stay consistent with the listed implementation targets.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 10. 1. Remove side-effect test import
**Finding key:** loop-886ed8301fc19eeea8ef
**Failure mode:** refactor
**File:** specs/348-report-delivery-fail-closed/tests/recover-existing-implementation.test.js
**Requirement:** R6
**Issue:** **File:** `specs/348-report-delivery-fail-closed/tests/recover-existing-implementation.test.js`  
**Requirement:** R6  
**Issue:** The spec test imports `../../../tests/unit/flow/recover-existing-implementation.test.js` for side effects, which couples this requirement test to another test file’s execution behavior and can duplicate unrelated assertions.  
**Suggestion:** Keep this file focused on R6 by removing the side-effect import and adding any necessary R6-specific assertions directly in this spec test.
**Suggestion:** **File:** `specs/348-report-delivery-fail-closed/tests/recover-existing-implementation.test.js`  
**Requirement:** R6  
**Issue:** The spec test imports `../../../tests/unit/flow/recover-existing-implementation.test.js` for side effects, which couples this requirement test to another test file’s execution behavior and can duplicate unrelated assertions.  
**Suggestion:** Keep this file focused on R6 by removing the side-effect import and adding any necessary R6-specific assertions directly in this spec test.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 11. 1. Extract Repeated Issue Log Path Helpers
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

### 12. 2. Use `try/finally` For All Environment Mutations
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

### 13. 3. Consolidate Fake `gh` Installer Behavior
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

### 14. 4. Bound Recursive Step Traversal
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

### 15. 5. Reduce Large Inline Artifact Fixtures
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

### 16. 6. Avoid Recreating `RunReportCommand` Repeatedly In Single Tests
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

### 17. 1. Add an explicit bound for binding source artifacts
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

### 18. 2. Extract duplicate file hashing logic
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

### 19. 3. Validate source paths during binding creation
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

### 20. 1. Use a More Specific Parameter Name
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

### 21. 2. Prefer Nullish Coalescing for Optional Override
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

### 22. 1. Extract Repeated Command Metadata
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

### 23. 2. Reuse Lifecycle Validation Helper
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

### 24. 3. Rename `reject` to Avoid Ambiguity
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

### 25. 4. Avoid Re-reading Invalid Paths During Pending Recovery
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

### 26. 5. Name Transition Table Fields Explicitly
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

### 27. 1. Centralize report path resolution
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

### 28. 2. Reuse delivery-completion helper in the initial delivery path
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

### 29. 3. Simplify pending delivery persistence
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

### 30. 4. Rename `redolog` to match the loaded artifact
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

### 31. 5. Avoid tuple destructuring in `reportSourcePaths()`
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

### 32. 1. Extract the Revalidation Transition Spec
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

### 33. 2. Replace Remaining String Literal Entrypoint
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

### 34. 3. Share Supported Recovery Entrypoints
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

### 35. 1. Extract repeated target-guard command boilerplate
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

### 36. 2. Shorten and clarify the help summary
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

### 37. 1. Extract Recovery Fixture Setup
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

### 38. 2. Centralize Spec Artifact Paths
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

### 39. 1. Extract audited skipped precondition setup
**Finding key:** loop-31de9b403aeda2893470
**Failure mode:** refactor
**File:** tests/unit/flow/retry-exhaustion-defer.test.js
**Requirement:** R7
**Issue:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R7  
**Issue:** The new test manually mutates the `scenario-validity` step, reads `scenario-validity-result.json`, changes `result`, and writes it back inline. That setup is specific and likely reusable for other audited skipped precondition cases.  
**Suggestion:** Extract a small helper in this test file, for example `markScenarioValiditySkippedWithResult(fixture, "block")`, to reduce setup noise and make the test’s intent clearer.
**Suggestion:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R7  
**Issue:** The new test manually mutates the `scenario-validity` step, reads `scenario-validity-result.json`, changes `result`, and writes it back inline. That setup is specific and likely reusable for other audited skipped precondition cases.  
**Suggestion:** Extract a small helper in this test file, for example `markScenarioValiditySkippedWithResult(fixture, "block")`, to reduce setup noise and make the test’s intent clearer.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 40. 2. Improve assertion clarity
**Finding key:** loop-04bde99267f3f71c98b9
**Failure mode:** refactor
**File:** tests/unit/flow/retry-exhaustion-defer.test.js
**Requirement:** R7
**Issue:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R7  
**Issue:** The assertion checks `assert.equal(context.mechanicalBlockers.some(...), false)`, which reads indirectly and hides the intended condition.  
**Suggestion:** Replace it with a clearer negative assertion, such as:
```js
assert.ok(
  !context.mechanicalBlockers.some((blocker) => blocker.kind === "failed_tests"),
);
```
or assign the boolean to a named variable like `hasFailedTestBlocker` before asserting.
**Suggestion:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R7  
**Issue:** The assertion checks `assert.equal(context.mechanicalBlockers.some(...), false)`, which reads indirectly and hides the intended condition.  
**Suggestion:** Replace it with a clearer negative assertion, such as:
```js
assert.ok(
  !context.mechanicalBlockers.some((blocker) => blocker.kind === "failed_tests"),
);
```
or assign the boolean to a named variable like `hasFailedTestBlocker` before asserting.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 41. 1. Define Delivery Failure State Names Once
**Finding key:** loop-316dc1b5dca436618151
**Failure mode:** refactor
**File:** specs/348-report-delivery-fail-closed/spec.md
**Requirement:** R3
**Issue:** **File:** `specs/348-report-delivery-fail-closed/spec.md`  
**Requirement:** R3  
**Issue:** Both `spec.md` and `spec.json` use `unsent` and `pending` for failed delivery states without a shared definition, creating a cross-file terminology mismatch risk for implementation and tests.  
**Suggestion:** Add one canonical definition in both spec representations, or collapse to a single state name if no behavioral distinction is required.
**Suggestion:** **File:** `specs/348-report-delivery-fail-closed/spec.md`  
**Requirement:** R3  
**Issue:** Both `spec.md` and `spec.json` use `unsent` and `pending` for failed delivery states without a shared definition, creating a cross-file terminology mismatch risk for implementation and tests.  
**Suggestion:** Add one canonical definition in both spec representations, or collapse to a single state name if no behavioral distinction is required.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 42. 2. Keep Initial And Resumed Issue Comment Artifacts Consistent
**Finding key:** loop-ca2c664cab06c14248b1
**Failure mode:** refactor
**File:** src/flow/lib/run-report.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/run-report.js`  
**Requirement:** R7  
**Issue:** The resumed delivery path uses `completedIssueComment()` and includes `idempotencyKey`, while the initial delivery success path manually builds a similar artifact without the same shape. Tests and downstream readers can observe different interfaces for the same successful delivery result.  
**Suggestion:** Use the same helper for initial and resumed delivery success so both paths persist identical `issueComment` fields.
**Suggestion:** **File:** `src/flow/lib/run-report.js`  
**Requirement:** R7  
**Issue:** The resumed delivery path uses `completedIssueComment()` and includes `idempotencyKey`, while the initial delivery success path manually builds a similar artifact without the same shape. Tests and downstream readers can observe different interfaces for the same successful delivery result.  
**Suggestion:** Use the same helper for initial and resumed delivery success so both paths persist identical `issueComment` fields.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 43. 3. Avoid Cross-Test Side-Effect Coupling
**Finding key:** loop-bcac174a39a2ddebcf16
**Failure mode:** refactor
**File:** specs/348-report-delivery-fail-closed/tests/recover-existing-implementation.test.js
**Requirement:** R6
**Issue:** **File:** `specs/348-report-delivery-fail-closed/tests/recover-existing-implementation.test.js`  
**Requirement:** R6  
**Issue:** The spec-level recovery test imports `tests/unit/flow/recover-existing-implementation.test.js` for side effects, duplicating execution across test layers and coupling two files’ assertion scopes.  
**Suggestion:** Remove the side-effect import and move any requirement-specific assertions into the spec test directly, while keeping the unit test independent.
**Suggestion:** **File:** `specs/348-report-delivery-fail-closed/tests/recover-existing-implementation.test.js`  
**Requirement:** R6  
**Issue:** The spec-level recovery test imports `tests/unit/flow/recover-existing-implementation.test.js` for side effects, duplicating execution across test layers and coupling two files’ assertion scopes.  
**Suggestion:** Remove the side-effect import and move any requirement-specific assertions into the spec test directly, while keeping the unit test independent.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 44. 4. Centralize Recovery Transition Metadata
**Finding key:** loop-b1b591c83a4ce23d35f1
**Failure mode:** refactor
**File:** src/flow/lib/step-transition-policy.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/step-transition-policy.js`  
**Requirement:** R4  
**Issue:** Recovery transition concepts are spread across `step-transition-policy.js`, `run-recover-existing-implementation.js`, and `impl-repair-artifacts.js` with overlapping entrypoint, expected-step, and transition naming. This increases drift risk as recovery flows evolve.  
**Suggestion:** Expose shared constants or helper predicates for supported recovery entrypoints and expected lifecycle changes, then reuse them from command and artifact-refresh code.
**Suggestion:** **File:** `src/flow/lib/step-transition-policy.js`  
**Requirement:** R4  
**Issue:** Recovery transition concepts are spread across `step-transition-policy.js`, `run-recover-existing-implementation.js`, and `impl-repair-artifacts.js` with overlapping entrypoint, expected-step, and transition naming. This increases drift risk as recovery flows evolve.  
**Suggestion:** Expose shared constants or helper predicates for supported recovery entrypoints and expected lifecycle changes, then reuse them from command and artifact-refresh code.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 45. 5. Normalize Spec Overview Content Across Formats
**Finding key:** loop-007c91f993ef61d7f6d9
**Failure mode:** refactor
**File:** specs/348-report-delivery-fail-closed/spec.json
**Requirement:** R7
**Issue:** **File:** `specs/348-report-delivery-fail-closed/spec.json`  
**Requirement:** R7  
**Issue:** Both `spec.json` and `spec.md` contain duplicated task-derived overview entries, but the duplicate content is not organized consistently between the two spec formats. Maintaining both increases the chance that one format diverges from the other.  
**Suggestion:** Keep only canonical high-level overview content in both files and move task-specific details to the task sections.
**Suggestion:** **File:** `specs/348-report-delivery-fail-closed/spec.json`  
**Requirement:** R7  
**Issue:** Both `spec.json` and `spec.md` contain duplicated task-derived overview entries, but the duplicate content is not organized consistently between the two spec formats. Maintaining both increases the chance that one format diverges from the other.  
**Suggestion:** Keep only canonical high-level overview content in both files and move task-specific details to the task sections.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
