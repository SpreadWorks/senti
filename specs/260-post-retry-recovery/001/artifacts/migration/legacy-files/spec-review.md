# Spec Review Results

## Verdict: FAIL

## Blocking Findings

### 1. Gate recovery scope conflicts with tracked gate phases
**Target:** Scope / Constraints / R6
**Issue:** Existing gate retry exhaustion is not limited to task-impl and integration: src/flow/lib/run-gate.js tracks draft, spec, task-impl, and integration, and flow definition has active gate-draft/gate steps with maxAttempts. The spec broadly requires gate/review exhausted recovery and status display, but the command validation only permits gate phases task-impl and integration and does not define the status/recovery behavior for exhausted draft/spec gates.
**Required change:** Either explicitly limit recovery/status behavior to gate task-impl and integration and require recoveryPossible:false with a reason for gate draft/spec exhaustion, or include gate draft/spec in the recovery phase set with their evidence rules.
**Why blocking:** Without this correction, implementers and tests cannot decide whether existing exhausted gate-draft/spec states are recoverable, unsupported, or merely display-only; that can leave an existing retry-exhausted flow state without a defined next-action/status contract.

### 2. Review recovery has no persisted failure baseline
**Target:** R2 / Overview Data Flow
**Issue:** Current review verdict failures only append reviewRetry metrics in the registry post hook; reviewStop is persisted for provider/input-size stops or synthesized from metrics at max attempts, but it does not store the evidence fingerprint for the last verdict FAIL. R2 requires comparing current evidence against the last same kind/phase FAIL or stop record for review recovery.
**Required change:** Specify that review FAIL/stop handling must persist the phase-specific recovery baseline fingerprint, or define an existing persisted artifact/state source that recovery must read as the last review failure baseline.
**Why blocking:** Review recovery cannot safely distinguish changed from unchanged exhausted states without a prior fingerprint; an implementation would have to guess, making unchanged rejection and eligible recovery tests impossible to design correctly.

### 3. Evidence source mapping is undefined
**Target:** R2 / R3 / R6 / R9
**Issue:** The spec does not define which files or data count as implementation diff versus evidence artifact for each kind/phase. The codebase has multiple phase-specific sources, including git diff state, draft/spec review artifacts, spec.json/draft.json, review.md, test-execute-result.json, and test-result-review.json, and existing gate no-progress state currently hashes the whole worktree.
**Required change:** Add a minimal kind/phase to evidence-source mapping and the changed-evidence summary fields used by set-retry and next-action/status.
**Why blocking:** Eligibility and tests can be implemented incompatibly: unrelated artifact changes may grant recovery, or real fixes may be rejected, depending on arbitrary file choices.

### 4. Recovery artifact target is unspecified
**Target:** R4 / R9
**Issue:** R4 requires appending an audited spec-local recovery artifact entry, but the codebase has no generic recovery artifact convention and the spec does not name the file path, container shape, version, or field names for the entry.
**Required change:** Name the recovery artifact file and minimum JSON entry shape, including the audit fields already required by R4.
**Why blocking:** There is no observable acceptance basis for audit artifact creation; implementation and spec-local tests cannot agree on where the recovery audit record must be written or how to validate it.


## Non-blocking Improvements

### 1. Clarify draft review phase aliases
**Target:** Constraints / R6
**Improvement:** State whether status and recovery commands should display canonical persisted phases such as draft-questions and draft-coverage, or user-facing aliases such as review-draft-questions and review-draft-coverage.
**Why non-blocking:** The current active-step context can support a reasonable implementation, but explicit alias guidance would reduce CLI/help inconsistency.

### 2. Mention evidence-related modules
**Target:** Implementation Targets
**Improvement:** Consider adding src/flow/commands/review.js, src/flow/lib/draft-review-routes.js, and src/flow/lib/test-artifacts.js to related targets if the evidence fingerprint rules cover review and integration artifacts.
**Why non-blocking:** The main implementation targets are present; these extra files would just make the phase-specific evidence paths easier to find.
