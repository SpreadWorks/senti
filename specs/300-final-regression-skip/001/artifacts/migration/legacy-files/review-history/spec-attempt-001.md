# Spec Review Results

## Verdict: FAIL

## Blocking Findings

### 1. Freshness proof does not cover same-path changes
**Target:** R1
**Issue:** The reuse rule only requires current trigger-relevant changed files to appear in the test-execute artifact. Existing changed-file evidence from listChangedFilesDetailed is path/status based, and run-test-execute persists root_test_command as ParsedCommand.toString() plus source, which omits env and command metadata such as package script content. A file or test command source can change after test-execute while keeping the same path and same rendered command/source.
**Required change:** Require a freshness proof that compares immutable current evidence, such as changed-file content/diff fingerprints and a full command identity including env/metadata or resolved config/script digest, before allowing covered_by_test_execute_full_regression.
**Why blocking:** Final-regression could skip after runtime or config-sensitive same-path changes that were not covered by the earlier full regression, so stale evidence would be accepted as fresh and regression coverage would be lost.

### 2. Risk skip relies on an unsafe non-runtime boundary
**Target:** R2
**Issue:** The spec says to use current changed-file classification for non-runtime-only skip, but existing classifyRegression can classify unanalysed text-like non-doc files as non-project-only with required=false. That can include unknown or external-integration/config-like files, while the spec also requires unknown and external integration changes to run full regression.
**Required change:** Define the exact allowlisted classification categories or path classes that qualify for risk_based_static_proof, and require all unclassified or non-allowlisted paths to become trigger-relevant full-regression inputs.
**Why blocking:** An implementation that reuses the existing required=false classification as skip proof can incorrectly skip final-regression for unknown text/config/integration files, violating the fail-closed safety requirement.

### 3. Completion contract path is omitted for skipped results
**Target:** R4
**Issue:** Registry post-hook completion is not the only completion gate. tryUpdateStepStatus calls assertStepCompletionTransitionAllowed, which uses contractFromFinalRegressionArtifact and StepCompletionPolicy. Today final-regression only allows verdict pass and treats any non-pass result as blocking.
**Required change:** Extend R4/T2 to require flow-judgment-contract handling so skipped final-regression artifacts with failureKind null, valid skipKind, and nextAction finalize-commit are normal completion evidence.
**Why blocking:** Even if validation and the registry post-hook accept skipped artifacts, marking final-regression done will fail through the existing completion contract, preventing the flow from advancing to finalize-commit.


## Non-blocking Improvements

### 1. Name the minimum skip proof fields
**Target:** R3
**Improvement:** List the minimum proof fields expected for each skipKind, especially the reused regression evidence fields versus static risk classification fields.
**Why non-blocking:** The requirements already establish the skip decisions and downstream result/skipKind surfaces, but explicit proof-field names would make validator and report tests less interpretive.
