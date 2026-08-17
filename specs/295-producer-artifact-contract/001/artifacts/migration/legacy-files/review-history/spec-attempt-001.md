# Spec Review Results

## Verdict: FAIL

## Blocking Findings

### 1. Disambiguate impl-gate phases
**Target:** R6/R7
**Issue:** The spec names impl-gate as a retry-exhaustion deferral target, but existing code maps the impl-gate flow node to both gate phases `integration` and `task-impl`, and retry counters/artifacts are keyed by phase. R7 lists migration parity for `senti flow run gate --phase integration` but omits the existing public `--phase task-impl` surface from `VALID_GATE_PHASES`.
**Required change:** Specify whether R6/R7 apply to both `task-impl` and `integration`, or explicitly exclude `task-impl` while requiring its existing retry/artifact behavior to be preserved.
**Why blocking:** Without this, implementation and tests can update only integration while regressing task-level impl gate retry handling, deferred findings, artifact paths, or public command behavior.

### 2. Define lint readiness evidence for implement completion
**Target:** R4/T-3
**Issue:** R4 requires implement completion to verify guardrail or lint readiness, but existing lint is a `flow run lint` sub-task with no durable artifact and registry comments state that lint does not own a step and is managed by the skill, not hooks. The spec does not say whether set-step should run lint synchronously, read a persisted artifact, inspect issue-log evidence, or use some other state.
**Required change:** Add the exact observable data path for guardrail/lint readiness in implement completion, or remove that condition from R4 if it is out of scope.
**Why blocking:** Tests cannot construct a valid or invalid implement-completion fixture for lint readiness, and an implementation could either block all completions due to missing evidence or silently accept stale/no lint evidence.

### 3. Specify spec-review source finding extraction
**Target:** R6
**Issue:** R6 requires spec-review retry exhaustion to mirror unresolved findings into `flow-findings.json`, but existing spec-review artifacts are written with blockers under `blocking[]` and improvements under `improvements[]`, not the `blockingFindings[]` shape used by other review artifacts. The spec does not identify this artifact-specific source data path.
**Required change:** State that spec-review deferral must source unresolved semantic findings from the current `spec-review.json` `blocking[]` records and preserve their ids or synthesize stable sourceFindingId values.
**Why blocking:** A generic implementation can pass tests against a normalized `blockingFindings[]` fixture while failing to defer real spec-review FAIL artifacts, leaving acceptance-review without the required deferred findings.


## Non-blocking Improvements

### 1. List task-impl parity explicitly
**Target:** R7
**Improvement:** If `task-impl` is intentionally retained, include `senti flow run gate --phase task-impl` in the retained public surfaces list alongside integration.
**Why non-blocking:** The blocking issue is the ambiguous behavior target; once resolved, this is a straightforward parity-list completeness improvement.
