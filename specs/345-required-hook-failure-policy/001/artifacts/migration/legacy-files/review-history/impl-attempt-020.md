# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 1. Consolidate review exclusion inputs
**Finding key:** loop-ff341d835d3e953e51ee
**Failure mode:** refactor
**File:** src/flow/commands/review.js
**Requirement:** R8
**Issue:** **File:** `src/flow/commands/review.js`  
**Requirement:** R8  
**Issue:** `resolveReviewTarget` now accepts both `excludeMatcher` and `exclusions`, which represent the same policy in two forms. This creates a drift risk if callers pass a matcher built from one exclusion list and a different raw list to `collectCommittedAndStagedDiff`.  
**Suggestion:** Pass a single exclusion policy object, e.g. `{ matcher, paths }`, or construct both inside `resolveReviewTarget` from one `exclusions` argument.
**Suggestion:** **File:** `src/flow/commands/review.js`  
**Requirement:** R8  
**Issue:** `resolveReviewTarget` now accepts both `excludeMatcher` and `exclusions`, which represent the same policy in two forms. This creates a drift risk if callers pass a matcher built from one exclusion list and a different raw list to `collectCommittedAndStagedDiff`.  
**Suggestion:** Pass a single exclusion policy object, e.g. `{ matcher, paths }`, or construct both inside `resolveReviewTarget` from one `exclusions` argument.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 2. 2. Avoid post-construction identity mutation
**Finding key:** loop-24d62a2b17742aa06d04
**Failure mode:** refactor
**File:** src/flow/commands/review.js
**Requirement:** R8
**Issue:** **File:** `src/flow/commands/review.js`  
**Requirement:** R8  
**Issue:** `applyImplReviewDispositionPolicy` mutates `typed.findingId` and `typed.fingerprint` after `finding.withDisposition(...)`. That weakens the class/object invariant: a finding can temporarily exist with stale identity, and callers must remember to patch it afterward.  
**Suggestion:** Move identity preservation into the construction path, either by making `withDisposition(disposition, requirementIds, fingerprint)` preserve/override identity, or by adding a dedicated method such as `withDispositionAndIdentity(...)`.
**Suggestion:** **File:** `src/flow/commands/review.js`  
**Requirement:** R8  
**Issue:** `applyImplReviewDispositionPolicy` mutates `typed.findingId` and `typed.fingerprint` after `finding.withDisposition(...)`. That weakens the class/object invariant: a finding can temporarily exist with stale identity, and callers must remember to patch it afterward.  
**Suggestion:** Move identity preservation into the construction path, either by making `withDisposition(disposition, requirementIds, fingerprint)` preserve/override identity, or by adding a dedicated method such as `withDispositionAndIdentity(...)`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 3. 1. Extract Repeated Pre-Hook Setup
**Finding key:** loop-82c077df2117bb988752
**Failure mode:** refactor
**File:** src/flow/lib/run-finalize-cleanup.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Requirement:** R7  
**Issue:** The same `finalizeCleanupPrePluginLifecycleContext` + `runFinalizePreHooks` + early return pattern appears in both lifecycle branches and again in `runTeardownTransactionOwned`. This makes required-hook stop behavior easier to accidentally diverge.  
**Suggestion:** Add a helper such as `runFinalizeCleanupPreLifecycle(ctx, state, { worktreePath, mainRepoPath, specId })` that returns `{ ok, env, pluginContext, pluginPre }`, and reuse it in all three call sites.
**Suggestion:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Requirement:** R7  
**Issue:** The same `finalizeCleanupPrePluginLifecycleContext` + `runFinalizePreHooks` + early return pattern appears in both lifecycle branches and again in `runTeardownTransactionOwned`. This makes required-hook stop behavior easier to accidentally diverge.  
**Suggestion:** Add a helper such as `runFinalizeCleanupPreLifecycle(ctx, state, { worktreePath, mainRepoPath, specId })` that returns `{ ok, env, pluginContext, pluginPre }`, and reuse it in all three call sites.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 4. 2. Reuse Required Hook Failure Envelope Helper
**Finding key:** loop-c3041fa4f53806148d89
**Failure mode:** refactor
**File:** src/flow/lib/run-finalize-cleanup.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Requirement:** R3  
**Issue:** `finalizeRequiredPluginHookFailure(pluginLifecycle)` exists, but `runTeardownTransactionOwned` rebuilds a near-duplicate `Envelope.fail(...)` for required post-hook failures. The duplicated construction already differs in metadata shape and message assembly.  
**Suggestion:** Extend `finalizeRequiredPluginHookFailure` to accept optional extra metadata, or create one shared helper for required plugin hook failures, then wrap it with `failBeforeCommit(...)` in the transaction path.
**Suggestion:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Requirement:** R3  
**Issue:** `finalizeRequiredPluginHookFailure(pluginLifecycle)` exists, but `runTeardownTransactionOwned` rebuilds a near-duplicate `Envelope.fail(...)` for required post-hook failures. The duplicated construction already differs in metadata shape and message assembly.  
**Suggestion:** Extend `finalizeRequiredPluginHookFailure` to accept optional extra metadata, or create one shared helper for required plugin hook failures, then wrap it with `failBeforeCommit(...)` in the transaction path.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 5. 3. Clarify Pre-Hook Context Naming
**Finding key:** loop-ee7950a980d85a53ccdd
**Failure mode:** refactor
**File:** src/flow/lib/run-finalize-cleanup.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Requirement:** R6  
**Issue:** `finalizeCleanupPrePluginLifecycleContext` reads like a lifecycle context for all finalize cleanup plugin work, but it actually selects a pre-hook-specific artifact authority and may discard artifacts on success. That distinction is central to preventing teardown side effects after required pre-hook failure.  
**Suggestion:** Rename it to something more explicit, for example `finalizeCleanupPreHookContext` or `finalizeCleanupPreHookArtifactContext`, and keep `finalizeCleanupPluginLifecycleContext` for the normal post/retained artifact context.
**Suggestion:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Requirement:** R6  
**Issue:** `finalizeCleanupPrePluginLifecycleContext` reads like a lifecycle context for all finalize cleanup plugin work, but it actually selects a pre-hook-specific artifact authority and may discard artifacts on success. That distinction is central to preventing teardown side effects after required pre-hook failure.  
**Suggestion:** Rename it to something more explicit, for example `finalizeCleanupPreHookContext` or `finalizeCleanupPreHookArtifactContext`, and keep `finalizeCleanupPluginLifecycleContext` for the normal post/retained artifact context.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 4. Avoid Inline Compact Hook Invocation Object
**Finding key:** loop-b759bd0e343c9fee8f27
**Failure mode:** refactor
**File:** src/flow/lib/run-finalize-cleanup.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Requirement:** R4  
**Issue:** `runFinalizePostHooks` passes `{ command: "finalize-cleanup", hook: "post", flow: pluginContext.flow, result }` on one line, while the pre-hook call uses the multi-line shape. This is a minor consistency issue, but this code now encodes the structured runner contract and should stay easy to scan.  
**Suggestion:** Format the post-hook options object like the pre-hook object, or extract a small `finalizeHookRequest(pluginContext, hook, result)` helper used by both pre and post calls.
**Suggestion:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Requirement:** R4  
**Issue:** `runFinalizePostHooks` passes `{ command: "finalize-cleanup", hook: "post", flow: pluginContext.flow, result }` on one line, while the pre-hook call uses the multi-line shape. This is a minor consistency issue, but this code now encodes the structured runner contract and should stay easy to scan.  
**Suggestion:** Format the post-hook options object like the pre-hook object, or extract a small `finalizeHookRequest(pluginContext, hook, result)` helper used by both pre and post calls.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 1. Bound JSON Candidate Scanning
**Finding key:** loop-82f6f6ade8a772dd8bad
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R8
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R8  
**Issue:** `extractJsonCandidate()` scans the entire provider output with no explicit size bound. This violates the bounded-resource-usage guardrail for bulk/recursive-style processing over external text.  
**Suggestion:** Add a maximum candidate input length or scan limit before the brace-balancing loop, using an existing project constant if available or a local `MAX_JSON_CANDIDATE_SCAN_CHARS`.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R8  
**Issue:** `extractJsonCandidate()` scans the entire provider output with no explicit size bound. This violates the bounded-resource-usage guardrail for bulk/recursive-style processing over external text.  
**Suggestion:** Add a maximum candidate input length or scan limit before the brace-balancing loop, using an existing project constant if available or a local `MAX_JSON_CANDIDATE_SCAN_CHARS`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 2. Rename Parser State Flags
**Finding key:** loop-a175aaebf25ec69bcca9
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R1  
**Issue:** The brace parser uses `quoted` and `escaped`, which are correct but slightly ambiguous. `quoted` can read like “this character is quoted” rather than “the parser is currently inside a string.”  
**Suggestion:** Rename `quoted` to `inString` and `escaped` to `escapeNext` to make the state machine easier to audit.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R1  
**Issue:** The brace parser uses `quoted` and `escaped`, which are correct but slightly ambiguous. `quoted` can read like “this character is quoted” rather than “the parser is currently inside a string.”  
**Suggestion:** Rename `quoted` to `inString` and `escaped` to `escapeNext` to make the state machine easier to audit.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 3. Extract Historical Advisory Predicate
**Finding key:** loop-a723569f6e695f40757c
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R4  
**Issue:** The catch block embeds a domain rule inline: non-latest artifacts with zero `blockingFindings` are ignored because historical advisory-only reports do not create obligations. This makes the exception path harder to distinguish from generic constructor failure handling.  
**Suggestion:** Extract the condition into a small helper such as `isHistoricalAdvisoryOnlyArtifact(candidate, raw)` and use it in the catch block. This keeps the policy named and easier to test or adjust later.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R4  
**Issue:** The catch block embeds a domain rule inline: non-latest artifacts with zero `blockingFindings` are ignored because historical advisory-only reports do not create obligations. This makes the exception path harder to distinguish from generic constructor failure handling.  
**Suggestion:** Extract the condition into a small helper such as `isHistoricalAdvisoryOnlyArtifact(candidate, raw)` and use it in the catch block. This keeps the policy named and easier to test or adjust later.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 10. 1. Remove no-op try/catch around lifecycle writes
**Finding key:** loop-5f7ee5bd3ba7173d9eeb
**Failure mode:** refactor
**File:** src/flow/lib/run-prepare-spec.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/run-prepare-spec.js`  
**Requirement:** R7  
**Issue:** `writeFlowState()` wraps the hook snapshot, file creation, lifecycle execution, and repair publication in `try { ... } catch (error) { throw error; }`, which adds no behavior and makes the new control flow harder to read.  
**Suggestion:** Remove the `try/catch` and let errors propagate directly. Keep the required-hook rollback branch inline after `runFlowCommandWithPluginLifecycle()`.
**Suggestion:** **File:** `src/flow/lib/run-prepare-spec.js`  
**Requirement:** R7  
**Issue:** `writeFlowState()` wraps the hook snapshot, file creation, lifecycle execution, and repair publication in `try { ... } catch (error) { throw error; }`, which adds no behavior and makes the new control flow harder to read.  
**Suggestion:** Remove the `try/catch` and let errors propagate directly. Keep the required-hook rollback branch inline after `runFlowCommandWithPluginLifecycle()`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 11. 2. Rename `writePrepareFiles` to clarify side effects and return value
**Finding key:** loop-0e6f7c728d06e2aec013
**Failure mode:** refactor
**File:** src/flow/lib/run-prepare-spec.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/run-prepare-spec.js`  
**Requirement:** R6  
**Issue:** The new `writeFlowState(extra, writePrepareFiles)` parameter name is vague: the callback both creates missing prepare source files and returns the subset it created for rollback. That return contract is important for required hook failure behavior.  
**Suggestion:** Rename the parameter to something like `createMissingPrepareSourceFiles` or `writePrepareFilesAndReturnCreatedPaths`, and consider renaming `createdSourceFiles` to `createdPrepareFiles` for consistency with `writeSpecFiles()`.
**Suggestion:** **File:** `src/flow/lib/run-prepare-spec.js`  
**Requirement:** R6  
**Issue:** The new `writeFlowState(extra, writePrepareFiles)` parameter name is vague: the callback both creates missing prepare source files and returns the subset it created for rollback. That return contract is important for required hook failure behavior.  
**Suggestion:** Rename the parameter to something like `createMissingPrepareSourceFiles` or `writePrepareFilesAndReturnCreatedPaths`, and consider renaming `createdSourceFiles` to `createdPrepareFiles` for consistency with `writeSpecFiles()`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 12. 3. Avoid rollback deleting pre-existing plugin artifacts
**Finding key:** loop-156e856928bac8506495
**Failure mode:** refactor
**File:** src/flow/lib/run-prepare-spec.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/run-prepare-spec.js`  
**Requirement:** R6  
**Issue:** `rollbackRequiredPrepareHookFailure()` always removes `plugin-artifacts` recursively, but the helper only tracks newly created source files. If `plugin-artifacts` existed before this prepare attempt, a required pre-hook failure could delete pre-existing content, which exceeds rollback of this command’s changes.  
**Suggestion:** Track whether `plugin-artifacts` existed before lifecycle execution, or track created artifact paths if available. Only remove the directory when it was created by this prepare attempt.
**Suggestion:** **File:** `src/flow/lib/run-prepare-spec.js`  
**Requirement:** R6  
**Issue:** `rollbackRequiredPrepareHookFailure()` always removes `plugin-artifacts` recursively, but the helper only tracks newly created source files. If `plugin-artifacts` existed before this prepare attempt, a required pre-hook failure could delete pre-existing content, which exceeds rollback of this command’s changes.  
**Suggestion:** Track whether `plugin-artifacts` existed before lifecycle execution, or track created artifact paths if available. Only remove the directory when it was created by this prepare attempt.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 4. Use non-deprecated directory removal API
**Finding key:** loop-fba2f7c7cb5de1be3285
**Failure mode:** refactor
**File:** src/flow/lib/run-prepare-spec.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/run-prepare-spec.js`  
**Requirement:** R6  
**Issue:** `fs.rmdirSync(specDir)` is used after checking the directory is empty. In modern Node.js code, `fs.rmSync(..., { dir options })` is generally preferred and is already used in the same helper.  
**Suggestion:** Replace `fs.rmdirSync(specDir)` with `fs.rmSync(specDir, { recursive: false, force: true })` or the project’s existing preferred empty-directory removal helper if one exists in this file.
**Suggestion:** **File:** `src/flow/lib/run-prepare-spec.js`  
**Requirement:** R6  
**Issue:** `fs.rmdirSync(specDir)` is used after checking the directory is empty. In modern Node.js code, `fs.rmSync(..., { dir options })` is generally preferred and is already used in the same helper.  
**Suggestion:** Replace `fs.rmdirSync(specDir)` with `fs.rmSync(specDir, { recursive: false, force: true })` or the project’s existing preferred empty-directory removal helper if one exists in this file.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 1. Centralize Outcome Kind Constants
**Finding key:** loop-bbcce557f521c40659fd
**Failure mode:** refactor
**File:** src/lib/plugin-registry.js
**Requirement:** R2
**Issue:** **File:** `src/lib/plugin-registry.js`  
**Requirement:** R2  
**Issue:** Outcome kind strings (`"success"`, `"business-failure"`, `"integrity-failure"`) are repeated across validation, construction, and result composition. This makes future changes error-prone.  
**Suggestion:** Define a frozen `FLOW_COMMAND_HOOK_OUTCOME_KINDS` object or static factory methods on `FlowCommandHookExecutionOutcome` such as `success()`, `businessFailure(policy, failure)`, and `integrityFailure(failure)`.
**Suggestion:** **File:** `src/lib/plugin-registry.js`  
**Requirement:** R2  
**Issue:** Outcome kind strings (`"success"`, `"business-failure"`, `"integrity-failure"`) are repeated across validation, construction, and result composition. This makes future changes error-prone.  
**Suggestion:** Define a frozen `FLOW_COMMAND_HOOK_OUTCOME_KINDS` object or static factory methods on `FlowCommandHookExecutionOutcome` such as `success()`, `businessFailure(policy, failure)`, and `integrityFailure(failure)`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 15. 2. Avoid Revalidating Entire Hook Snapshot Per Dispatch
**Finding key:** loop-3536876b544cb44a8e45
**Failure mode:** refactor
**File:** src/lib/plugin-registry.js
**Requirement:** R1
**Issue:** **File:** `src/lib/plugin-registry.js`  
**Requirement:** R1  
**Issue:** `runFlowCommandHooks()` validates every snapshot entry on each invocation, even when only one `command`/`hook` subset will run. Lifecycle execution calls this twice, duplicating validation work.  
**Suggestion:** Validate the snapshot once at the lifecycle boundary, or filter matching plans first and validate only the plans about to execute. Keep hard rejection before execution, but avoid repeated full-snapshot scans.
**Suggestion:** **File:** `src/lib/plugin-registry.js`  
**Requirement:** R1  
**Issue:** `runFlowCommandHooks()` validates every snapshot entry on each invocation, even when only one `command`/`hook` subset will run. Lifecycle execution calls this twice, duplicating validation work.  
**Suggestion:** Validate the snapshot once at the lifecycle boundary, or filter matching plans first and validate only the plans about to execute. Keep hard rejection before execution, but avoid repeated full-snapshot scans.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 16. 3. Preserve Multiple Advisory Failure Outcomes
**Finding key:** loop-5edbbe2b49238032028d
**Failure mode:** refactor
**File:** src/lib/plugin-registry.js
**Requirement:** R2
**Issue:** **File:** `src/lib/plugin-registry.js`  
**Requirement:** R2  
**Issue:** `outcome` is overwritten on each advisory business failure, so if multiple advisory hooks fail, only the last failure is represented in the typed outcome while earlier failures only remain in warnings.  
**Suggestion:** Either make `FlowCommandHookExecutionOutcome.failure` hold an array for business failures, or keep a separate `failures` collection and construct the outcome from all advisory failures at the end.
**Suggestion:** **File:** `src/lib/plugin-registry.js`  
**Requirement:** R2  
**Issue:** `outcome` is overwritten on each advisory business failure, so if multiple advisory hooks fail, only the last failure is represented in the typed outcome while earlier failures only remain in warnings.  
**Suggestion:** Either make `FlowCommandHookExecutionOutcome.failure` hold an array for business failures, or keep a separate `failures` collection and construct the outcome from all advisory failures at the end.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 17. 4. Rename `terminal` for Lifecycle Composition Clarity
**Finding key:** loop-8c6e0becc74460599534
**Failure mode:** refactor
**File:** src/lib/plugin-registry.js
**Requirement:** R7
**Issue:** **File:** `src/lib/plugin-registry.js`  
**Requirement:** R7  
**Issue:** In `composePluginLifecycleResult(result, pre, terminal, ok)`, `terminal` actually means either the post-hook result or the failing hook result. The name hides lifecycle semantics and makes the outcome selection harder to read.  
**Suggestion:** Rename it to `hookResult` or `finalHookResult`, and consider passing an options object to make pre/post/failure roles explicit.
**Suggestion:** **File:** `src/lib/plugin-registry.js`  
**Requirement:** R7  
**Issue:** In `composePluginLifecycleResult(result, pre, terminal, ok)`, `terminal` actually means either the post-hook result or the failing hook result. The name hides lifecycle semantics and makes the outcome selection harder to read.  
**Suggestion:** Rename it to `hookResult` or `finalHookResult`, and consider passing an options object to make pre/post/failure roles explicit.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 18. 1. Remove redundant fixture directory creation
**Finding key:** loop-f745a22b2de77d44ed80
**Failure mode:** refactor
**File:** tests/unit/flow/commands/review.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/commands/review.test.js`  
**Requirement:** R1  
**Issue:** The new test creates `specs/demo` before `initTestRepo(...)`, then creates the same directory again immediately after reading `baseSha`. Since `initTestRepo` already receives `specs/demo/flow.json`, the first explicit `fs.mkdirSync(...)` appears redundant, and the second one is enough before writing `spec.json`.  
**Suggestion:** Delete the first `fs.mkdirSync(join(tmp, "specs/demo"), { recursive: true });` in `"applies configured exclusions to the fallback tracked diff"` to keep the fixture setup tighter.
**Suggestion:** **File:** `tests/unit/flow/commands/review.test.js`  
**Requirement:** R1  
**Issue:** The new test creates `specs/demo` before `initTestRepo(...)`, then creates the same directory again immediately after reading `baseSha`. Since `initTestRepo` already receives `specs/demo/flow.json`, the first explicit `fs.mkdirSync(...)` appears redundant, and the second one is enough before writing `spec.json`.  
**Suggestion:** Delete the first `fs.mkdirSync(join(tmp, "specs/demo"), { recursive: true });` in `"applies configured exclusions to the fallback tracked diff"` to keep the fixture setup tighter.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 19. 1. Extract repeated plugin hook registration setup
**Finding key:** loop-adadd4c8923a01e2f733
**Failure mode:** refactor
**File:** tests/unit/flow/finalize-cleanup-transaction-v2.test.js
**Requirement:** R8
**Issue:** **File:** `tests/unit/flow/finalize-cleanup-transaction-v2.test.js`  
**Requirement:** R8  
**Issue:** The test now duplicates plugin runtime setup across main/worktree paths: config writing, hook source writing, state hook metadata, and matching `failurePolicy` values. This makes future changes to hook metadata easy to miss in one place.  
**Suggestion:** Add a small local helper in this test file, such as `installFinalizeHookPlugin({ root, worktreePath, pluginId, hook, failurePolicy, source })`, that writes both configs/hooks and returns the `flowCommandHooks` entry.
**Suggestion:** **File:** `tests/unit/flow/finalize-cleanup-transaction-v2.test.js`  
**Requirement:** R8  
**Issue:** The test now duplicates plugin runtime setup across main/worktree paths: config writing, hook source writing, state hook metadata, and matching `failurePolicy` values. This makes future changes to hook metadata easy to miss in one place.  
**Suggestion:** Add a small local helper in this test file, such as `installFinalizeHookPlugin({ root, worktreePath, pluginId, hook, failurePolicy, source })`, that writes both configs/hooks and returns the `flowCommandHooks` entry.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 20. 2. Avoid string duplication for failure policy literals
**Finding key:** loop-5f45a0305ca86cc2d554
**Failure mode:** refactor
**File:** tests/unit/flow/finalize-cleanup-transaction-v2.test.js
**Requirement:** R8
**Issue:** **File:** `tests/unit/flow/finalize-cleanup-transaction-v2.test.js`  
**Requirement:** R8  
**Issue:** The same `failurePolicy` value is repeated in both hook class definitions and serialized fixture state. If they diverge, the test may stop asserting the intended behavior.  
**Suggestion:** Define a local constant per test, for example `const failurePolicy = "advisory";`, and interpolate/use it in both the hook source and `fixture.state.plugins` entry.
**Suggestion:** **File:** `tests/unit/flow/finalize-cleanup-transaction-v2.test.js`  
**Requirement:** R8  
**Issue:** The same `failurePolicy` value is repeated in both hook class definitions and serialized fixture state. If they diverge, the test may stop asserting the intended behavior.  
**Suggestion:** Define a local constant per test, for example `const failurePolicy = "advisory";`, and interpolate/use it in both the hook source and `fixture.state.plugins` entry.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 21. 3. Rename `stopped` to describe the result
**Finding key:** loop-91036adb147a8432ace2
**Failure mode:** refactor
**File:** tests/unit/flow/finalize-cleanup-transaction-v2.test.js
**Requirement:** R8
**Issue:** **File:** `tests/unit/flow/finalize-cleanup-transaction-v2.test.js`  
**Requirement:** R8  
**Issue:** `stopped` describes an expected state rather than the value returned by `runFinalize`, which slightly obscures the assertion flow.  
**Suggestion:** Rename it to `result` or `finalizeResult` and keep the failure expectation in the assertions.
**Suggestion:** **File:** `tests/unit/flow/finalize-cleanup-transaction-v2.test.js`  
**Requirement:** R8  
**Issue:** `stopped` describes an expected state rather than the value returned by `runFinalize`, which slightly obscures the assertion flow.  
**Suggestion:** Rename it to `result` or `finalizeResult` and keep the failure expectation in the assertions.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 22. 1. Reuse the stale finding identity value
**Finding key:** loop-23e600bcdddfd64da1f8
**Failure mode:** refactor
**File:** tests/unit/flow/finding-gate-readiness.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/finding-gate-readiness.test.js`  
**Requirement:** R1  
**Issue:** The test duplicates `"0".repeat(64)` for both `findingId` and `fingerprint`, which makes the intended “same stale identity” relationship implicit.  
**Suggestion:** Introduce a local constant, e.g. `const staleFindingIdentity = "0".repeat(64);`, and assign it to both fields. This improves readability and avoids accidental divergence if the value changes later.
**Suggestion:** **File:** `tests/unit/flow/finding-gate-readiness.test.js`  
**Requirement:** R1  
**Issue:** The test duplicates `"0".repeat(64)` for both `findingId` and `fingerprint`, which makes the intended “same stale identity” relationship implicit.  
**Suggestion:** Introduce a local constant, e.g. `const staleFindingIdentity = "0".repeat(64);`, and assign it to both fields. This improves readability and avoids accidental divergence if the value changes later.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 23. 1. Extract repeated mock transition application
**Finding key:** loop-596044e5410734926d09
**Failure mode:** refactor
**File:** tests/unit/flow/set-step-impl-repair.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R1  
**Issue:** The mocked `updateStepStatus` implementation repeats the same transition-change application logic in multiple test cases. This makes future API changes or status mutation behavior easy to update inconsistently.  
**Suggestion:** Extract a local helper such as `applyStepTransition(state, transition)` or `createFlowManager(state, transitions)` and reuse it across these tests.
**Suggestion:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R1  
**Issue:** The mocked `updateStepStatus` implementation repeats the same transition-change application logic in multiple test cases. This makes future API changes or status mutation behavior easy to update inconsistently.  
**Suggestion:** Extract a local helper such as `applyStepTransition(state, transition)` or `createFlowManager(state, transitions)` and reuse it across these tests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 24. 2. Avoid silent fixture cleanup with `force: true`
**Finding key:** loop-70d034a4fa7bc97aea51
**Failure mode:** refactor
**File:** tests/unit/flow/set-step-impl-repair.test.js
**Requirement:** R2
**Issue:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R2  
**Issue:** Changing `fs.rmSync(... )` to `fs.rmSync(..., { force: true })` hides cases where the expected fixture files were never created. In a unit test, that can mask setup drift and reduce the test’s diagnostic value.  
**Suggestion:** If the files are expected to exist, keep the strict removal. If absence is valid for this scenario, add an explicit comment or assertion around that condition so the intent is clear.
**Suggestion:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R2  
**Issue:** Changing `fs.rmSync(... )` to `fs.rmSync(..., { force: true })` hides cases where the expected fixture files were never created. In a unit test, that can mask setup drift and reduce the test’s diagnostic value.  
**Suggestion:** If the files are expected to exist, keep the strict removal. If absence is valid for this scenario, add an explicit comment or assertion around that condition so the intent is clear.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 25. 1. Centralize required hook failure handling
**Finding key:** loop-a04afbdf1329108a7710
**Failure mode:** refactor
**File:** src/flow/lib/run-finalize-cleanup.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Requirement:** R3  
**Issue:** Required hook failure envelope construction appears to be diverging between finalize cleanup transaction handling and the shared `finalizeRequiredPluginHookFailure(...)` path. `run-prepare-spec.js` also has required pre-hook rollback behavior with its own failure handling, so required-hook stop semantics are being implemented in multiple places.  
**Suggestion:** Introduce one shared lifecycle failure helper for required hook failures that accepts command/hook metadata and optional rollback metadata, then use it from finalize cleanup and prepare-spec paths.
**Suggestion:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Requirement:** R3  
**Issue:** Required hook failure envelope construction appears to be diverging between finalize cleanup transaction handling and the shared `finalizeRequiredPluginHookFailure(...)` path. `run-prepare-spec.js` also has required pre-hook rollback behavior with its own failure handling, so required-hook stop semantics are being implemented in multiple places.  
**Suggestion:** Introduce one shared lifecycle failure helper for required hook failures that accepts command/hook metadata and optional rollback metadata, then use it from finalize cleanup and prepare-spec paths.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 26. 2. Unify lifecycle hook execution setup
**Finding key:** loop-64eb926792c16427039d
**Failure mode:** refactor
**File:** src/flow/lib/run-finalize-cleanup.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Requirement:** R7  
**Issue:** Finalize cleanup repeats pre-hook setup in multiple branches, while `run-prepare-spec.js` has a separate lifecycle write/rollback sequence for prepare hooks. The lifecycle boundary contract is spreading across command implementations instead of living in one reusable abstraction.  
**Suggestion:** Extract a command-agnostic helper for flow command lifecycle execution, returning hook result, plugin context, and rollback inputs. Keep command-specific rollback behavior as callbacks.
**Suggestion:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Requirement:** R7  
**Issue:** Finalize cleanup repeats pre-hook setup in multiple branches, while `run-prepare-spec.js` has a separate lifecycle write/rollback sequence for prepare hooks. The lifecycle boundary contract is spreading across command implementations instead of living in one reusable abstraction.  
**Suggestion:** Extract a command-agnostic helper for flow command lifecycle execution, returning hook result, plugin context, and rollback inputs. Keep command-specific rollback behavior as callbacks.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 27. 3. Standardize hook context naming
**Finding key:** loop-7b390cb654141301f9cb
**Failure mode:** refactor
**File:** src/flow/lib/run-finalize-cleanup.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Requirement:** R6  
**Issue:** Names such as `finalizeCleanupPrePluginLifecycleContext`, `finalizeCleanupPluginLifecycleContext`, `terminal`, `pluginPre`, and prepare-specific callback names describe similar lifecycle concepts inconsistently across files. This makes it harder to compare pre/post/failure paths across `run-finalize-cleanup.js`, `run-prepare-spec.js`, and `plugin-registry.js`.  
**Suggestion:** Adopt consistent lifecycle terms such as `preHookContext`, `postHookContext`, `hookResult`, `preHookResult`, and `createdRollbackPaths` across these files.
**Suggestion:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Requirement:** R6  
**Issue:** Names such as `finalizeCleanupPrePluginLifecycleContext`, `finalizeCleanupPluginLifecycleContext`, `terminal`, `pluginPre`, and prepare-specific callback names describe similar lifecycle concepts inconsistently across files. This makes it harder to compare pre/post/failure paths across `run-finalize-cleanup.js`, `run-prepare-spec.js`, and `plugin-registry.js`.  
**Suggestion:** Adopt consistent lifecycle terms such as `preHookContext`, `postHookContext`, `hookResult`, `preHookResult`, and `createdRollbackPaths` across these files.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 28. 4. Consolidate repeated plugin hook test fixtures
**Finding key:** loop-2c855d7623278e14e205
**Failure mode:** refactor
**File:** tests/unit/flow/finalize-cleanup-transaction-v2.test.js
**Requirement:** R8
**Issue:** **File:** `tests/unit/flow/finalize-cleanup-transaction-v2.test.js`  
**Requirement:** R8  
**Issue:** Hook plugin setup and failure policy literals are duplicated in finalize cleanup tests, while related required/advisory hook behavior is also exercised by prepare/finding-gate tests. Fixture drift could cause tests to validate different lifecycle contracts unintentionally.  
**Suggestion:** Add local or shared test helpers for installing flow command hook plugins and declaring failure policies, then reuse them across lifecycle-hook tests where practical.
**Suggestion:** **File:** `tests/unit/flow/finalize-cleanup-transaction-v2.test.js`  
**Requirement:** R8  
**Issue:** Hook plugin setup and failure policy literals are duplicated in finalize cleanup tests, while related required/advisory hook behavior is also exercised by prepare/finding-gate tests. Fixture drift could cause tests to validate different lifecycle contracts unintentionally.  
**Suggestion:** Add local or shared test helpers for installing flow command hook plugins and declaring failure policies, then reuse them across lifecycle-hook tests where practical.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
