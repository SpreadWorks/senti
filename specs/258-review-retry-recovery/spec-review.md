# Spec Review Results

## Verdict: FAIL

## Blocking Findings

### 1. Provider and input failures have no durable stop-state path
**Target:** R3/R5/R6, Overview Data Flow
**Issue:** The spec requires `flow get next-action` and `flow get status` to show provider/input-size recovery details after `flow run review` stops. In the existing code, `get-next-action.js` and `get-status.js` only read persisted flow state/metrics. A failed `flow run review` envelope is written to stdout and then lost; provider/input-size failures do not consume `reviewRetry`, are not required to write issue-log entries, and existing agent metrics do not store classification/recovery data. MaxAttempts can be derived from persisted reviewRetry metrics, but provider/input-size stop reasons cannot.
**Required change:** Specify the persisted data path for review stop state, including where provider/input-size classification, reason, retryBudgetConsumed, and recovery hint/command are written and how next-action/status read and clear it.
**Why blocking:** Without a persisted stop-state contract, R5/R6 cannot be implemented or tested for provider/input-size failures except in the same process that produced the failure envelope; follow-up CLI commands will have no codebase state from which to reconstruct the required recovery information.

### 2. Provider failure classification lacks a child-to-wrapper contract
**Target:** R1/R2/R3, T-1/T-2, Modules/Data Flow
**Issue:** Actual provider failures originate inside `src/lib/agent.js` while running the subprocess `src/flow/commands/review.js`; direct invocation currently catches errors by printing a stack/message to stderr and exiting 1. `src/flow/lib/run-review.js` then sees only generic subprocess stdout/stderr/status. The spec requires quota/rate-limit/API/input-length classification and machine-processable envelope data, but does not define whether the child review command or Agent layer emits a structured failure signal for the wrapper, or whether the wrapper is expected to classify raw stderr text.
**Required change:** Add an explicit spec-level integration contract for how provider/input-size failures cross from Agent/review subprocess to `run-review` classification, such as a machine-readable stderr marker or error code/data emitted by `src/flow/commands/review.js` for `run-review` to convert into the failure envelope.
**Why blocking:** Without this data path, implementation must infer provider quota/rate/API/input-size failures from unstructured provider CLI messages and stack traces, so real provider failures can be misclassified as generic subprocess failures and R3 acceptance cannot be made reliable.


## Non-blocking Improvements

### 1. Define stable status recovery field shape
**Target:** R6
**Improvement:** Clarify whether `flow get status` should expose review recovery as a structured field such as `reviewStop` or only as a human-readable summary string. R5 names structured fields for next-action, but R6 leaves the status shape more open.
**Why non-blocking:** An implementer can still satisfy R6 with a readable summary, and tests can assert the chosen output once implemented; the ambiguity does not make the core behavior impossible.
