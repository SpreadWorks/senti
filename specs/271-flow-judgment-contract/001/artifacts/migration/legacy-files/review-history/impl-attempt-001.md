# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. Unreachable impl-gate branch in validatePostHookManagedStep drops integration regression evidence guard
**Failure mode:** project-rule violation
**File:** src/flow/lib/set-step.js
**Issue:** The dispatch list at the `validatePostHookManagedStep` caller was narrowed to `["test-execute", "retro"]`, so the `else if (id === "impl-gate")` branch (which calls assertIntegrationRegressionEvidence) inside validatePostHookManagedStep is now unreachable dead code. As a side effect, marking `impl-gate` done no longer re-validates integration regression evidence at set-step time; it now relies solely on the impl-gate-result.json contract verdict produced at gate-run time.
**Suggestion:** If the contract validation is intended to replace the evidence guard, remove the dead `else if (id === "impl-gate")` branch in validatePostHookManagedStep. If the freshness re-check at done time should be retained, restore "impl-gate" to the dispatch list.
**Rationale:** Dead branches in a touched function mislead future readers, and the silent removal of the freshness re-check should be explicit rather than incidental.

### 2. New durable artifact pattern leaves a stale test expectation
**Failure mode:** regression failure
**File:** src/flow/lib/test-artifacts.js
**Issue:** Adding IMPL_GATE_RESULT_FILE to DURABLE_TEST_ARTIFACT_RELATIVE_PATTERNS makes durableTestArtifactPathspecs emit 'specs/001/impl-gate-result.json', but tests/unit/flow/run-finalize-retro-commit-scope.test.js asserts a hardcoded expected array that omits it, so that test now fails.
**Suggestion:** Update the expected pathspec array in run-finalize-retro-commit-scope.test.js to include 'specs/001/impl-gate-result.json' so it reflects the newly added durable artifact.
**Rationale:** The failure is a legitimate consequence of the feature, not a product defect; the test expectation simply needs to track the new durable artifact.

### 3. Final-regression contractSummary computed twice with divergent artifactPath
**Failure mode:** refactor proposal
**File:** src/flow/lib/run-final-regression.js
**Issue:** FinalRegressionArtifact.toJSON() already embeds contractSummary using artifactPath=FINAL_REGRESSION_RESULT_FILE (basename), then RunFinalRegressionCommand recomputes json.contractSummary using resultPathRelative (full repo-relative path). The second pass also fingerprints a json that already contains the first pass's contractSummary, making artifactFingerprint depend on the embedded summary.
**Suggestion:** Compute contractSummary in a single place (e.g. pass the resolved relative artifactPath into toJSON, or strip the embedded summary before recomputing in the command) so artifactPath and artifactFingerprint are derived once.
**Rationale:** Single-source computation avoids the basename/relative-path inconsistency and the circular fingerprint dependency, keeping progressSignature inputs clean.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
