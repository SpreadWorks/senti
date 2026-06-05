# Spec Review Results

## Verdict: FAIL

## Blocking Findings

### 1. Oversized single-diff batches are undefined
**Target:** R2 / Acceptance Criteria
**Issue:** The spec requires every RequirementGateBatch to stay within MAX_IMPL_REQUIREMENT_BATCH_CHARS = 120000 for the rendered requirement excerpt section plus related diff section, but existing gate diffs can be much larger than that. src/flow/lib/run-gate.js allows task implementation diffs up to TASK_IMPL_GATE_DIFF_MAX_BYTES = 1048576, and buildPerRequirementDiffs can assign fullDiff to an unmapped requirement or append unmappedDiff to every mapped requirement. If one requirement's related diff alone exceeds 120000 characters, splitting cannot produce a compliant batch.
**Required change:** Define the required behavior for an indivisible requirement whose related diff section plus its excerpt exceeds 120000 characters, such as fail before agent.call, truncate with an explicit marker, raise the limit to the existing diff cap, or allow a documented single-item overflow exception.
**Why blocking:** Without this behavior, the implementation cannot satisfy the batch-size invariant for valid existing diffs, and tests for the 120000-character acceptance criterion cannot be designed for the oversized single-requirement case.

### 2. No-file-map fallback conflicts with integration artifact trust
**Target:** R4 / Acceptance Criteria
**Issue:** R4 says that when file-map is absent or empty, gate-impl uses the existing bulk requirement check fallback and calls the agent once. In existing code, impl-gate can run with phase integration, and executeDiffBasedGate calls checkIntegrationTestArtifacts before requirement checking. validateIntegrationArtifactTrust requires file-map.json as an integration trust input, so a missing file-map fails structurally before the bulk fallback can run.
**Required change:** Qualify the no-file-map bulk fallback to the gate phases where existing artifact trust permits it, or explicitly state that integration gate must preserve the existing file-map.json trust-input failure before any bulk fallback.
**Why blocking:** If implemented literally for integration, the spec would weaken the existing artifact trust contract; if implemented conservatively, the unqualified R4 acceptance test would fail because no agent call occurs when file-map.json is missing.


## Non-blocking Improvements

### 1. Clarify partial file-map behavior
**Target:** R3 / Data Flow
**Improvement:** Mention that the existing buildPerRequirementDiffs compatibility behavior should remain: a requirement with no file-map entry receives the full diff, while a mapped requirement whose mapped files have no diff gets an empty related diff and is skipped.
**Why non-blocking:** Existing tests in specs/248-gate-impl-per-req-diff already cover this behavior, so an implementer following current helpers will preserve it; the clarification would reduce ambiguity but is not required to implement the main change.
