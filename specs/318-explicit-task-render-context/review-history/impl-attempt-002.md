# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 2. Replace Long Free-Text Override Reasons With Structured Fields
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/completion-overrides.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/completion-overrides.json`  
**Requirement:** R8  
**Issue:** The `reason` and `acceptedRisk` values repeat the same phrases across multiple findings, especially around “valid at attempt 006,” “resolved by current test SHA,” and “proceeding without a further semantic review.” This makes the override hard to review and easy to update inconsistently.  
**Suggestion:** Extract shared metadata into structured fields such as `attempt`, `testSha256`, `reviewRetryStatus`, and `commonAcceptedRisk`, then keep each finding’s `acceptedRisk` focused on the finding-specific evidence.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/completion-overrides.json`  
**Requirement:** R8  
**Issue:** The `reason` and `acceptedRisk` values repeat the same phrases across multiple findings, especially around “valid at attempt 006,” “resolved by current test SHA,” and “proceeding without a further semantic review.” This makes the override hard to review and easy to update inconsistently.  
**Suggestion:** Extract shared metadata into structured fields such as `attempt`, `testSha256`, `reviewRetryStatus`, and `commonAcceptedRisk`, then keep each finding’s `acceptedRisk` focused on the finding-specific evidence.
**Rationale:** Loop review proposal.

### 2. 3. Normalize Successor Owner Representation
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/completion-overrides.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/completion-overrides.json`  
**Requirement:** R8  
**Issue:** `successorOwner` is sometimes a single owner string and sometimes a comma-separated list, for example `"test-execute"` versus `"test-review, test-execute, acceptance-review, final-regression"`. This inconsistent shape complicates parsing and validation.  
**Suggestion:** Change `successorOwner` to either a single string field plus a separate `successorOwners` array, or consistently use an array for all entries, even when there is only one owner.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/completion-overrides.json`  
**Requirement:** R8  
**Issue:** `successorOwner` is sometimes a single owner string and sometimes a comma-separated list, for example `"test-execute"` versus `"test-review, test-execute, acceptance-review, final-regression"`. This inconsistent shape complicates parsing and validation.  
**Suggestion:** Change `successorOwner` to either a single string field plus a separate `successorOwners` array, or consistently use an array for all entries, even when there is only one owner.
**Rationale:** Loop review proposal.

### 3. 1. Deduplicate Repeated Guardrail Observations
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/draft-gate-source.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/draft-gate-source.json`  
**Requirement:** R8  
**Issue:** The same two violation objects are stored twice: once under `evaluations[].observations[]` and again under the top-level `observations[]`. This creates duplicate maintenance surface and risks drift if one copy is edited later.  
**Suggestion:** Keep the detailed observations in one canonical location and derive or reference them from the other location if the schema requires both. If both fields are mandatory, reduce the duplicated objects to stable IDs or summaries in one field.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/draft-gate-source.json`  
**Requirement:** R8  
**Issue:** The same two violation objects are stored twice: once under `evaluations[].observations[]` and again under the top-level `observations[]`. This creates duplicate maintenance surface and risks drift if one copy is edited later.  
**Suggestion:** Keep the detailed observations in one canonical location and derive or reference them from the other location if the schema requires both. If both fields are mandatory, reduce the duplicated objects to stable IDs or summaries in one field.
**Rationale:** Loop review proposal.

### 4. 2. Replace Long Free-Text Override Reasons With Structured Fields
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/completion-overrides.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/completion-overrides.json`  
**Requirement:** R8  
**Issue:** The `reason` and `acceptedRisk` values repeat the same phrases across multiple findings, especially around “valid at attempt 006,” “resolved by current test SHA,” and “proceeding without a further semantic review.” This makes the override hard to review and easy to update inconsistently.  
**Suggestion:** Extract shared metadata into structured fields such as `attempt`, `testSha256`, `reviewRetryStatus`, and `commonAcceptedRisk`, then keep each finding’s `acceptedRisk` focused on the finding-specific evidence.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/completion-overrides.json`  
**Requirement:** R8  
**Issue:** The `reason` and `acceptedRisk` values repeat the same phrases across multiple findings, especially around “valid at attempt 006,” “resolved by current test SHA,” and “proceeding without a further semantic review.” This makes the override hard to review and easy to update inconsistently.  
**Suggestion:** Extract shared metadata into structured fields such as `attempt`, `testSha256`, `reviewRetryStatus`, and `commonAcceptedRisk`, then keep each finding’s `acceptedRisk` focused on the finding-specific evidence.
**Rationale:** Loop review proposal.

### 5. 3. Normalize Successor Owner Representation
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/completion-overrides.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/completion-overrides.json`  
**Requirement:** R8  
**Issue:** `successorOwner` is sometimes a single owner string and sometimes a comma-separated list, for example `"test-execute"` versus `"test-review, test-execute, acceptance-review, final-regression"`. This inconsistent shape complicates parsing and validation.  
**Suggestion:** Change `successorOwner` to either a single string field plus a separate `successorOwners` array, or consistently use an array for all entries, even when there is only one owner.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/completion-overrides.json`  
**Requirement:** R8  
**Issue:** `successorOwner` is sometimes a single owner string and sometimes a comma-separated list, for example `"test-execute"` versus `"test-review, test-execute, acceptance-review, final-regression"`. This inconsistent shape complicates parsing and validation.  
**Suggestion:** Change `successorOwner` to either a single string field plus a separate `successorOwners` array, or consistently use an array for all entries, even when there is only one owner.
**Rationale:** Loop review proposal.

### 6. 1. Deduplicate Repeated Guardrail Observations
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/draft-gate-source.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/draft-gate-source.json`  
**Requirement:** R8  
**Issue:** The same two violation objects are stored twice: once under `evaluations[].observations[]` and again under the top-level `observations[]`. This creates duplicate maintenance surface and risks drift if one copy is edited later.  
**Suggestion:** Keep the detailed observations in one canonical location and derive or reference them from the other location if the schema requires both. If both fields are mandatory, reduce the duplicated objects to stable IDs or summaries in one field.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/draft-gate-source.json`  
**Requirement:** R8  
**Issue:** The same two violation objects are stored twice: once under `evaluations[].observations[]` and again under the top-level `observations[]`. This creates duplicate maintenance surface and risks drift if one copy is edited later.  
**Suggestion:** Keep the detailed observations in one canonical location and derive or reference them from the other location if the schema requires both. If both fields are mandatory, reduce the duplicated objects to stable IDs or summaries in one field.
**Rationale:** Loop review proposal.

### 7. 2. Replace Long Free-Text Override Reasons With Structured Fields
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/completion-overrides.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/completion-overrides.json`  
**Requirement:** R8  
**Issue:** The `reason` and `acceptedRisk` values repeat the same phrases across multiple findings, especially around “valid at attempt 006,” “resolved by current test SHA,” and “proceeding without a further semantic review.” This makes the override hard to review and easy to update inconsistently.  
**Suggestion:** Extract shared metadata into structured fields such as `attempt`, `testSha256`, `reviewRetryStatus`, and `commonAcceptedRisk`, then keep each finding’s `acceptedRisk` focused on the finding-specific evidence.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/completion-overrides.json`  
**Requirement:** R8  
**Issue:** The `reason` and `acceptedRisk` values repeat the same phrases across multiple findings, especially around “valid at attempt 006,” “resolved by current test SHA,” and “proceeding without a further semantic review.” This makes the override hard to review and easy to update inconsistently.  
**Suggestion:** Extract shared metadata into structured fields such as `attempt`, `testSha256`, `reviewRetryStatus`, and `commonAcceptedRisk`, then keep each finding’s `acceptedRisk` focused on the finding-specific evidence.
**Rationale:** Loop review proposal.

### 8. 3. Normalize Successor Owner Representation
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/completion-overrides.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/completion-overrides.json`  
**Requirement:** R8  
**Issue:** `successorOwner` is sometimes a single owner string and sometimes a comma-separated list, for example `"test-execute"` versus `"test-review, test-execute, acceptance-review, final-regression"`. This inconsistent shape complicates parsing and validation.  
**Suggestion:** Change `successorOwner` to either a single string field plus a separate `successorOwners` array, or consistently use an array for all entries, even when there is only one owner.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/completion-overrides.json`  
**Requirement:** R8  
**Issue:** `successorOwner` is sometimes a single owner string and sometimes a comma-separated list, for example `"test-execute"` versus `"test-review, test-execute, acceptance-review, final-regression"`. This inconsistent shape complicates parsing and validation.  
**Suggestion:** Change `successorOwner` to either a single string field plus a separate `successorOwners` array, or consistently use an array for all entries, even when there is only one owner.
**Rationale:** Loop review proposal.

### 9. 1. Deduplicate Repeated Guardrail Observations
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/draft-gate-source.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/draft-gate-source.json`  
**Requirement:** R8  
**Issue:** The same two violation objects are stored twice: once under `evaluations[].observations[]` and again under the top-level `observations[]`. This creates duplicate maintenance surface and risks drift if one copy is edited later.  
**Suggestion:** Keep the detailed observations in one canonical location and derive or reference them from the other location if the schema requires both. If both fields are mandatory, reduce the duplicated objects to stable IDs or summaries in one field.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/draft-gate-source.json`  
**Requirement:** R8  
**Issue:** The same two violation objects are stored twice: once under `evaluations[].observations[]` and again under the top-level `observations[]`. This creates duplicate maintenance surface and risks drift if one copy is edited later.  
**Suggestion:** Keep the detailed observations in one canonical location and derive or reference them from the other location if the schema requires both. If both fields are mandatory, reduce the duplicated objects to stable IDs or summaries in one field.
**Rationale:** Loop review proposal.

### 10. 1. Deduplicate Repeated Guardrail Observations
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/draft-gate-source.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/draft-gate-source.json`  
**Requirement:** R8  
**Issue:** The same two violation objects are stored twice: once under `evaluations[].observations[]` and again under the top-level `observations[]`. This creates duplicate maintenance surface and risks drift if one copy is edited later.  
**Suggestion:** Keep the detailed observations in one canonical location and derive or reference them from the other location if the schema requires both. If both fields are mandatory, reduce the duplicated objects to stable IDs or summaries in one field.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/draft-gate-source.json`  
**Requirement:** R8  
**Issue:** The same two violation objects are stored twice: once under `evaluations[].observations[]` and again under the top-level `observations[]`. This creates duplicate maintenance surface and risks drift if one copy is edited later.  
**Suggestion:** Keep the detailed observations in one canonical location and derive or reference them from the other location if the schema requires both. If both fields are mandatory, reduce the duplicated objects to stable IDs or summaries in one field.
**Rationale:** Loop review proposal.

### 11. 2. Replace Long Free-Text Override Reasons With Structured Fields
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/completion-overrides.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/completion-overrides.json`  
**Requirement:** R8  
**Issue:** The `reason` and `acceptedRisk` values repeat the same phrases across multiple findings, especially around “valid at attempt 006,” “resolved by current test SHA,” and “proceeding without a further semantic review.” This makes the override hard to review and easy to update inconsistently.  
**Suggestion:** Extract shared metadata into structured fields such as `attempt`, `testSha256`, `reviewRetryStatus`, and `commonAcceptedRisk`, then keep each finding’s `acceptedRisk` focused on the finding-specific evidence.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/completion-overrides.json`  
**Requirement:** R8  
**Issue:** The `reason` and `acceptedRisk` values repeat the same phrases across multiple findings, especially around “valid at attempt 006,” “resolved by current test SHA,” and “proceeding without a further semantic review.” This makes the override hard to review and easy to update inconsistently.  
**Suggestion:** Extract shared metadata into structured fields such as `attempt`, `testSha256`, `reviewRetryStatus`, and `commonAcceptedRisk`, then keep each finding’s `acceptedRisk` focused on the finding-specific evidence.
**Rationale:** Loop review proposal.

### 12. 3. Normalize Successor Owner Representation
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/completion-overrides.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/completion-overrides.json`  
**Requirement:** R8  
**Issue:** `successorOwner` is sometimes a single owner string and sometimes a comma-separated list, for example `"test-execute"` versus `"test-review, test-execute, acceptance-review, final-regression"`. This inconsistent shape complicates parsing and validation.  
**Suggestion:** Change `successorOwner` to either a single string field plus a separate `successorOwners` array, or consistently use an array for all entries, even when there is only one owner.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/completion-overrides.json`  
**Requirement:** R8  
**Issue:** `successorOwner` is sometimes a single owner string and sometimes a comma-separated list, for example `"test-execute"` versus `"test-review, test-execute, acceptance-review, final-regression"`. This inconsistent shape complicates parsing and validation.  
**Suggestion:** Change `successorOwner` to either a single string field plus a separate `successorOwners` array, or consistently use an array for all entries, even when there is only one owner.
**Rationale:** Loop review proposal.

### 13. 1. Define explicit task collection bounds
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/draft.json
**Requirement:** R2
**Issue:** **File:** `specs/318-explicit-task-render-context/draft.json`  
**Requirement:** R2  
**Issue:** `TaskCollection` is expected to validate collection size, uniqueness, and parent existence, but the draft does not define concrete upper bounds for task count or parent-chain depth. This violates `bounded-resource-usage` for bulk task processing.  
**Suggestion:** Add explicit limits, for example max tasks per spec and max parent-chain depth, and require `TaskCollection` to enforce them before render/view/sync writes.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/draft.json`  
**Requirement:** R2  
**Issue:** `TaskCollection` is expected to validate collection size, uniqueness, and parent existence, but the draft does not define concrete upper bounds for task count or parent-chain depth. This violates `bounded-resource-usage` for bulk task processing.  
**Suggestion:** Add explicit limits, for example max tasks per spec and max parent-chain depth, and require `TaskCollection` to enforce them before render/view/sync writes.
**Rationale:** Loop review proposal.

### 14. 2. Fix incomplete regex formatting
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/draft.json
**Requirement:** R1
**Issue:** **File:** `specs/318-explicit-task-render-context/draft.json`  
**Requirement:** R1  
**Issue:** Several strings include `` `^[A-Za-z0-9][A-Za-z0-9_-]{0,99} `` without a closing backtick, making the contract harder to read and easy to copy incorrectly.  
**Suggestion:** Normalize every occurrence to `` `^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$` `` or explicitly state whether the anchors are represented outside the regex.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/draft.json`  
**Requirement:** R1  
**Issue:** Several strings include `` `^[A-Za-z0-9][A-Za-z0-9_-]{0,99} `` without a closing backtick, making the contract harder to read and easy to copy incorrectly.  
**Suggestion:** Normalize every occurrence to `` `^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$` `` or explicitly state whether the anchors are represented outside the regex.
**Rationale:** Loop review proposal.

### 15. 3. Remove inconsistent indentation in `impactOnExisting`
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/draft.json
**Requirement:** R7
**Issue:** **File:** `specs/318-explicit-task-render-context/draft.json`  
**Requirement:** R7  
**Issue:** The final three `impactOnExisting` entries are indented more deeply than the other array items, suggesting accidental nesting even though the JSON remains valid.  
**Suggestion:** Align all array entries consistently to reduce review friction and avoid misleading structure.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/draft.json`  
**Requirement:** R7  
**Issue:** The final three `impactOnExisting` entries are indented more deeply than the other array items, suggesting accidental nesting even though the JSON remains valid.  
**Suggestion:** Align all array entries consistently to reduce review friction and avoid misleading structure.
**Rationale:** Loop review proposal.

### 16. 1. Define explicit task collection bounds
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/draft.json
**Requirement:** R2
**Issue:** **File:** `specs/318-explicit-task-render-context/draft.json`  
**Requirement:** R2  
**Issue:** `TaskCollection` is expected to validate collection size, uniqueness, and parent existence, but the draft does not define concrete upper bounds for task count or parent-chain depth. This violates `bounded-resource-usage` for bulk task processing.  
**Suggestion:** Add explicit limits, for example max tasks per spec and max parent-chain depth, and require `TaskCollection` to enforce them before render/view/sync writes.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/draft.json`  
**Requirement:** R2  
**Issue:** `TaskCollection` is expected to validate collection size, uniqueness, and parent existence, but the draft does not define concrete upper bounds for task count or parent-chain depth. This violates `bounded-resource-usage` for bulk task processing.  
**Suggestion:** Add explicit limits, for example max tasks per spec and max parent-chain depth, and require `TaskCollection` to enforce them before render/view/sync writes.
**Rationale:** Loop review proposal.

### 17. 2. Fix incomplete regex formatting
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/draft.json
**Requirement:** R1
**Issue:** **File:** `specs/318-explicit-task-render-context/draft.json`  
**Requirement:** R1  
**Issue:** Several strings include `` `^[A-Za-z0-9][A-Za-z0-9_-]{0,99} `` without a closing backtick, making the contract harder to read and easy to copy incorrectly.  
**Suggestion:** Normalize every occurrence to `` `^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$` `` or explicitly state whether the anchors are represented outside the regex.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/draft.json`  
**Requirement:** R1  
**Issue:** Several strings include `` `^[A-Za-z0-9][A-Za-z0-9_-]{0,99} `` without a closing backtick, making the contract harder to read and easy to copy incorrectly.  
**Suggestion:** Normalize every occurrence to `` `^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$` `` or explicitly state whether the anchors are represented outside the regex.
**Rationale:** Loop review proposal.

### 18. 3. Remove inconsistent indentation in `impactOnExisting`
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/draft.json
**Requirement:** R7
**Issue:** **File:** `specs/318-explicit-task-render-context/draft.json`  
**Requirement:** R7  
**Issue:** The final three `impactOnExisting` entries are indented more deeply than the other array items, suggesting accidental nesting even though the JSON remains valid.  
**Suggestion:** Align all array entries consistently to reduce review friction and avoid misleading structure.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/draft.json`  
**Requirement:** R7  
**Issue:** The final three `impactOnExisting` entries are indented more deeply than the other array items, suggesting accidental nesting even though the JSON remains valid.  
**Suggestion:** Align all array entries consistently to reduce review friction and avoid misleading structure.
**Rationale:** Loop review proposal.

### 19. 1. Define explicit task collection bounds
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/draft.json
**Requirement:** R2
**Issue:** **File:** `specs/318-explicit-task-render-context/draft.json`  
**Requirement:** R2  
**Issue:** `TaskCollection` is expected to validate collection size, uniqueness, and parent existence, but the draft does not define concrete upper bounds for task count or parent-chain depth. This violates `bounded-resource-usage` for bulk task processing.  
**Suggestion:** Add explicit limits, for example max tasks per spec and max parent-chain depth, and require `TaskCollection` to enforce them before render/view/sync writes.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/draft.json`  
**Requirement:** R2  
**Issue:** `TaskCollection` is expected to validate collection size, uniqueness, and parent existence, but the draft does not define concrete upper bounds for task count or parent-chain depth. This violates `bounded-resource-usage` for bulk task processing.  
**Suggestion:** Add explicit limits, for example max tasks per spec and max parent-chain depth, and require `TaskCollection` to enforce them before render/view/sync writes.
**Rationale:** Loop review proposal.

### 20. 2. Fix incomplete regex formatting
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/draft.json
**Requirement:** R1
**Issue:** **File:** `specs/318-explicit-task-render-context/draft.json`  
**Requirement:** R1  
**Issue:** Several strings include `` `^[A-Za-z0-9][A-Za-z0-9_-]{0,99} `` without a closing backtick, making the contract harder to read and easy to copy incorrectly.  
**Suggestion:** Normalize every occurrence to `` `^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$` `` or explicitly state whether the anchors are represented outside the regex.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/draft.json`  
**Requirement:** R1  
**Issue:** Several strings include `` `^[A-Za-z0-9][A-Za-z0-9_-]{0,99} `` without a closing backtick, making the contract harder to read and easy to copy incorrectly.  
**Suggestion:** Normalize every occurrence to `` `^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$` `` or explicitly state whether the anchors are represented outside the regex.
**Rationale:** Loop review proposal.

### 21. 3. Remove inconsistent indentation in `impactOnExisting`
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/draft.json
**Requirement:** R7
**Issue:** **File:** `specs/318-explicit-task-render-context/draft.json`  
**Requirement:** R7  
**Issue:** The final three `impactOnExisting` entries are indented more deeply than the other array items, suggesting accidental nesting even though the JSON remains valid.  
**Suggestion:** Align all array entries consistently to reduce review friction and avoid misleading structure.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/draft.json`  
**Requirement:** R7  
**Issue:** The final three `impactOnExisting` entries are indented more deeply than the other array items, suggesting accidental nesting even though the JSON remains valid.  
**Suggestion:** Align all array entries consistently to reduce review friction and avoid misleading structure.
**Rationale:** Loop review proposal.

### 22. 1. Define explicit task collection bounds
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/draft.json
**Requirement:** R2
**Issue:** **File:** `specs/318-explicit-task-render-context/draft.json`  
**Requirement:** R2  
**Issue:** `TaskCollection` is expected to validate collection size, uniqueness, and parent existence, but the draft does not define concrete upper bounds for task count or parent-chain depth. This violates `bounded-resource-usage` for bulk task processing.  
**Suggestion:** Add explicit limits, for example max tasks per spec and max parent-chain depth, and require `TaskCollection` to enforce them before render/view/sync writes.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/draft.json`  
**Requirement:** R2  
**Issue:** `TaskCollection` is expected to validate collection size, uniqueness, and parent existence, but the draft does not define concrete upper bounds for task count or parent-chain depth. This violates `bounded-resource-usage` for bulk task processing.  
**Suggestion:** Add explicit limits, for example max tasks per spec and max parent-chain depth, and require `TaskCollection` to enforce them before render/view/sync writes.
**Rationale:** Loop review proposal.

### 23. 2. Fix incomplete regex formatting
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/draft.json
**Requirement:** R1
**Issue:** **File:** `specs/318-explicit-task-render-context/draft.json`  
**Requirement:** R1  
**Issue:** Several strings include `` `^[A-Za-z0-9][A-Za-z0-9_-]{0,99} `` without a closing backtick, making the contract harder to read and easy to copy incorrectly.  
**Suggestion:** Normalize every occurrence to `` `^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$` `` or explicitly state whether the anchors are represented outside the regex.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/draft.json`  
**Requirement:** R1  
**Issue:** Several strings include `` `^[A-Za-z0-9][A-Za-z0-9_-]{0,99} `` without a closing backtick, making the contract harder to read and easy to copy incorrectly.  
**Suggestion:** Normalize every occurrence to `` `^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$` `` or explicitly state whether the anchors are represented outside the regex.
**Rationale:** Loop review proposal.

### 24. 3. Remove inconsistent indentation in `impactOnExisting`
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/draft.json
**Requirement:** R7
**Issue:** **File:** `specs/318-explicit-task-render-context/draft.json`  
**Requirement:** R7  
**Issue:** The final three `impactOnExisting` entries are indented more deeply than the other array items, suggesting accidental nesting even though the JSON remains valid.  
**Suggestion:** Align all array entries consistently to reduce review friction and avoid misleading structure.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/draft.json`  
**Requirement:** R7  
**Issue:** The final three `impactOnExisting` entries are indented more deeply than the other array items, suggesting accidental nesting even though the JSON remains valid.  
**Suggestion:** Align all array entries consistently to reduce review friction and avoid misleading structure.
**Rationale:** Loop review proposal.

### 25. 1. Define explicit task collection bounds
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/draft.json
**Requirement:** R2
**Issue:** **File:** `specs/318-explicit-task-render-context/draft.json`  
**Requirement:** R2  
**Issue:** `TaskCollection` is expected to validate collection size, uniqueness, and parent existence, but the draft does not define concrete upper bounds for task count or parent-chain depth. This violates `bounded-resource-usage` for bulk task processing.  
**Suggestion:** Add explicit limits, for example max tasks per spec and max parent-chain depth, and require `TaskCollection` to enforce them before render/view/sync writes.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/draft.json`  
**Requirement:** R2  
**Issue:** `TaskCollection` is expected to validate collection size, uniqueness, and parent existence, but the draft does not define concrete upper bounds for task count or parent-chain depth. This violates `bounded-resource-usage` for bulk task processing.  
**Suggestion:** Add explicit limits, for example max tasks per spec and max parent-chain depth, and require `TaskCollection` to enforce them before render/view/sync writes.
**Rationale:** Loop review proposal.

### 26. 2. Fix incomplete regex formatting
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/draft.json
**Requirement:** R1
**Issue:** **File:** `specs/318-explicit-task-render-context/draft.json`  
**Requirement:** R1  
**Issue:** Several strings include `` `^[A-Za-z0-9][A-Za-z0-9_-]{0,99} `` without a closing backtick, making the contract harder to read and easy to copy incorrectly.  
**Suggestion:** Normalize every occurrence to `` `^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$` `` or explicitly state whether the anchors are represented outside the regex.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/draft.json`  
**Requirement:** R1  
**Issue:** Several strings include `` `^[A-Za-z0-9][A-Za-z0-9_-]{0,99} `` without a closing backtick, making the contract harder to read and easy to copy incorrectly.  
**Suggestion:** Normalize every occurrence to `` `^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$` `` or explicitly state whether the anchors are represented outside the regex.
**Rationale:** Loop review proposal.

### 27. 3. Remove inconsistent indentation in `impactOnExisting`
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/draft.json
**Requirement:** R7
**Issue:** **File:** `specs/318-explicit-task-render-context/draft.json`  
**Requirement:** R7  
**Issue:** The final three `impactOnExisting` entries are indented more deeply than the other array items, suggesting accidental nesting even though the JSON remains valid.  
**Suggestion:** Align all array entries consistently to reduce review friction and avoid misleading structure.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/draft.json`  
**Requirement:** R7  
**Issue:** The final three `impactOnExisting` entries are indented more deeply than the other array items, suggesting accidental nesting even though the JSON remains valid.  
**Suggestion:** Align all array entries consistently to reduce review friction and avoid misleading structure.
**Rationale:** Loop review proposal.

### 28. 1. Remove stale references to out-of-diff files
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/impl-review.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/impl-review.json`
**Requirement:** R8
**Issue:** Many `nonBlockingImprovements` entries point to files that are not part of this change set, such as `completion-overrides.json`, `draft.json`, `src/spec/lib/render-contract.js`, and test files. That conflicts with the review scope and makes the artifact noisy for this diff.
**Suggestion:** Filter `nonBlockingImprovements` so this artifact only records proposals for files present in the current diff, or move historical/out-of-scope recommendations into a separate archival field.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/impl-review.json`
**Requirement:** R8
**Issue:** Many `nonBlockingImprovements` entries point to files that are not part of this change set, such as `completion-overrides.json`, `draft.json`, `src/spec/lib/render-contract.js`, and test files. That conflicts with the review scope and makes the artifact noisy for this diff.
**Suggestion:** Filter `nonBlockingImprovements` so this artifact only records proposals for files present in the current diff, or move historical/out-of-scope recommendations into a separate archival field.
**Rationale:** Loop review proposal.

### 29. 2. Deduplicate repeated review recommendations
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/impl-review.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/impl-review.json`
**Requirement:** R8
**Issue:** Several `nonBlockingImprovements` are duplicated verbatim, including “Factor repeated manual-review rationale into shared fields,” “Shorten and structure the top-level reason,” and “Remove duplicated violation payload.” This inflates `summary.nonBlocking` and makes the review result harder to trust.
**Suggestion:** Deduplicate improvements by a stable key such as `file + requirementId + issue`, then update the summary counts from the deduplicated list.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/impl-review.json`
**Requirement:** R8
**Issue:** Several `nonBlockingImprovements` are duplicated verbatim, including “Factor repeated manual-review rationale into shared fields,” “Shorten and structure the top-level reason,” and “Remove duplicated violation payload.” This inflates `summary.nonBlocking` and makes the review result harder to trust.
**Suggestion:** Deduplicate improvements by a stable key such as `file + requirementId + issue`, then update the summary counts from the deduplicated list.
**Rationale:** Loop review proposal.

### 30. 3. Avoid duplicating full proposal text in `issue` and `suggestion`
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/impl-review.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/impl-review.json`
**Requirement:** R8
**Issue:** Each improvement stores the full formatted proposal text twice, once in `issue` and again in `suggestion`, even though both fields currently contain identical content. This doubles payload size and creates drift risk.
**Suggestion:** Store structured fields separately, for example `issue` with only the problem statement and `suggestion` with only the recommendation, or keep one canonical `body` field.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/impl-review.json`
**Requirement:** R8
**Issue:** Each improvement stores the full formatted proposal text twice, once in `issue` and again in `suggestion`, even though both fields currently contain identical content. This doubles payload size and creates drift risk.
**Suggestion:** Store structured fields separately, for example `issue` with only the problem statement and `suggestion` with only the recommendation, or keep one canonical `body` field.
**Rationale:** Loop review proposal.

### 31. 4. Add a bounded retention policy for operational logs
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/issue-log.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/issue-log.json`
**Requirement:** R8
**Issue:** `entries` can grow indefinitely with repeated review attempts, retries, and operational narratives. There is no explicit retention count, byte limit, or compaction boundary, which violates the `bounded-resource-usage` guardrail for bulk data loading and long-running flows.
**Suggestion:** Add a bounded log policy such as maximum entries per step/phase plus summarized rollups for older attempts, or split archived entries into bounded history files referenced by digest.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/issue-log.json`
**Requirement:** R8
**Issue:** `entries` can grow indefinitely with repeated review attempts, retries, and operational narratives. There is no explicit retention count, byte limit, or compaction boundary, which violates the `bounded-resource-usage` guardrail for bulk data loading and long-running flows.
**Suggestion:** Add a bounded log policy such as maximum entries per step/phase plus summarized rollups for older attempts, or split archived entries into bounded history files referenced by digest.
**Rationale:** Loop review proposal.

### 32. 5. Normalize duplicated observation data
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/issue-log.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/issue-log.json`
**Requirement:** R8
**Issue:** Many entries repeat the same facts across `reason`, `observations[].observed`, and `failedEvaluations[].reason`. This creates multiple sources of truth for one finding.
**Suggestion:** Keep detailed finding text in one canonical location, then let `reason` and `failedEvaluations` reference observation IDs or contain short summaries only.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/issue-log.json`
**Requirement:** R8
**Issue:** Many entries repeat the same facts across `reason`, `observations[].observed`, and `failedEvaluations[].reason`. This creates multiple sources of truth for one finding.
**Suggestion:** Keep detailed finding text in one canonical location, then let `reason` and `failedEvaluations` reference observation IDs or contain short summaries only.
**Rationale:** Loop review proposal.

### 33. 6. Remove or populate empty planning arrays
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/flow.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/flow.json`
**Requirement:** R8
**Issue:** `requirements` and `tasks` are empty even though the flow records spec, approval, test, and implementation activity. As-is, these fields look like dead or misleading state.
**Suggestion:** Either populate them from the approved spec or remove them from this artifact if current flow state no longer uses them.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/flow.json`
**Requirement:** R8
**Issue:** `requirements` and `tasks` are empty even though the flow records spec, approval, test, and implementation activity. As-is, these fields look like dead or misleading state.
**Suggestion:** Either populate them from the approved spec or remove them from this artifact if current flow state no longer uses them.
**Rationale:** Loop review proposal.

### 34. 7. Bound flow history arrays
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/flow.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/flow.json`
**Requirement:** R8
**Issue:** Arrays such as `metrics`, `stepAttempts`, `reviewRecoveryBaselines`, and `planRewinds[].invalidatedEvidence` appear append-only and have no visible maximum size. This violates the `bounded-resource-usage` guardrail for bulk data loading over repeated retries/rewinds.
**Suggestion:** Define explicit caps or archival behavior for each history collection, such as max attempts per step, max metrics retained per phase, and compacted evidence manifests after a threshold.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/flow.json`
**Requirement:** R8
**Issue:** Arrays such as `metrics`, `stepAttempts`, `reviewRecoveryBaselines`, and `planRewinds[].invalidatedEvidence` appear append-only and have no visible maximum size. This violates the `bounded-resource-usage` guardrail for bulk data loading over repeated retries/rewinds.
**Suggestion:** Define explicit caps or archival behavior for each history collection, such as max attempts per step, max metrics retained per phase, and compacted evidence manifests after a threshold.
**Rationale:** Loop review proposal.

### 35. 8. Add explicit task-count bounds to the issue contract
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/issue.md
**Requirement:** R2
**Issue:** **File:** `specs/318-explicit-task-render-context/issue.md`
**Requirement:** R2
**Issue:** The issue requires `TaskCollection` to validate uniqueness and parent existence across all tasks, but it does not state a maximum collection size. That leaves bulk validation unbounded under the `bounded-resource-usage` guardrail.
**Suggestion:** Add a concrete maximum task count, for example “reject more than 200 tasks before per-task validation, path planning, or writes,” and mirror that limit in the Japanese section.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/issue.md`
**Requirement:** R2
**Issue:** The issue requires `TaskCollection` to validate uniqueness and parent existence across all tasks, but it does not state a maximum collection size. That leaves bulk validation unbounded under the `bounded-resource-usage` guardrail.
**Suggestion:** Add a concrete maximum task count, for example “reject more than 200 tasks before per-task validation, path planning, or writes,” and mirror that limit in the Japanese section.
**Rationale:** Loop review proposal.

### 36. 9. Add newline at EOF
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/issue.md
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/issue.md`
**Requirement:** R8
**Issue:** The file ends without a trailing newline, which creates avoidable formatting churn in future edits.
**Suggestion:** Add a final newline at end of file.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/issue.md`
**Requirement:** R8
**Issue:** The file ends without a trailing newline, which creates avoidable formatting churn in future edits.
**Suggestion:** Add a final newline at end of file.
**Rationale:** Loop review proposal.

### 37. 6. Remove or populate empty planning arrays
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/flow.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/flow.json`
**Requirement:** R8
**Issue:** `requirements` and `tasks` are empty even though the flow records spec, approval, test, and implementation activity. As-is, these fields look like dead or misleading state.
**Suggestion:** Either populate them from the approved spec or remove them from this artifact if current flow state no longer uses them.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/flow.json`
**Requirement:** R8
**Issue:** `requirements` and `tasks` are empty even though the flow records spec, approval, test, and implementation activity. As-is, these fields look like dead or misleading state.
**Suggestion:** Either populate them from the approved spec or remove them from this artifact if current flow state no longer uses them.
**Rationale:** Loop review proposal.

### 38. 7. Bound flow history arrays
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/flow.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/flow.json`
**Requirement:** R8
**Issue:** Arrays such as `metrics`, `stepAttempts`, `reviewRecoveryBaselines`, and `planRewinds[].invalidatedEvidence` appear append-only and have no visible maximum size. This violates the `bounded-resource-usage` guardrail for bulk data loading over repeated retries/rewinds.
**Suggestion:** Define explicit caps or archival behavior for each history collection, such as max attempts per step, max metrics retained per phase, and compacted evidence manifests after a threshold.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/flow.json`
**Requirement:** R8
**Issue:** Arrays such as `metrics`, `stepAttempts`, `reviewRecoveryBaselines`, and `planRewinds[].invalidatedEvidence` appear append-only and have no visible maximum size. This violates the `bounded-resource-usage` guardrail for bulk data loading over repeated retries/rewinds.
**Suggestion:** Define explicit caps or archival behavior for each history collection, such as max attempts per step, max metrics retained per phase, and compacted evidence manifests after a threshold.
**Rationale:** Loop review proposal.

### 39. 1. Remove stale references to out-of-diff files
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/impl-review.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/impl-review.json`
**Requirement:** R8
**Issue:** Many `nonBlockingImprovements` entries point to files that are not part of this change set, such as `completion-overrides.json`, `draft.json`, `src/spec/lib/render-contract.js`, and test files. That conflicts with the review scope and makes the artifact noisy for this diff.
**Suggestion:** Filter `nonBlockingImprovements` so this artifact only records proposals for files present in the current diff, or move historical/out-of-scope recommendations into a separate archival field.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/impl-review.json`
**Requirement:** R8
**Issue:** Many `nonBlockingImprovements` entries point to files that are not part of this change set, such as `completion-overrides.json`, `draft.json`, `src/spec/lib/render-contract.js`, and test files. That conflicts with the review scope and makes the artifact noisy for this diff.
**Suggestion:** Filter `nonBlockingImprovements` so this artifact only records proposals for files present in the current diff, or move historical/out-of-scope recommendations into a separate archival field.
**Rationale:** Loop review proposal.

### 40. 2. Deduplicate repeated review recommendations
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/impl-review.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/impl-review.json`
**Requirement:** R8
**Issue:** Several `nonBlockingImprovements` are duplicated verbatim, including “Factor repeated manual-review rationale into shared fields,” “Shorten and structure the top-level reason,” and “Remove duplicated violation payload.” This inflates `summary.nonBlocking` and makes the review result harder to trust.
**Suggestion:** Deduplicate improvements by a stable key such as `file + requirementId + issue`, then update the summary counts from the deduplicated list.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/impl-review.json`
**Requirement:** R8
**Issue:** Several `nonBlockingImprovements` are duplicated verbatim, including “Factor repeated manual-review rationale into shared fields,” “Shorten and structure the top-level reason,” and “Remove duplicated violation payload.” This inflates `summary.nonBlocking` and makes the review result harder to trust.
**Suggestion:** Deduplicate improvements by a stable key such as `file + requirementId + issue`, then update the summary counts from the deduplicated list.
**Rationale:** Loop review proposal.

### 41. 3. Avoid duplicating full proposal text in `issue` and `suggestion`
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/impl-review.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/impl-review.json`
**Requirement:** R8
**Issue:** Each improvement stores the full formatted proposal text twice, once in `issue` and again in `suggestion`, even though both fields currently contain identical content. This doubles payload size and creates drift risk.
**Suggestion:** Store structured fields separately, for example `issue` with only the problem statement and `suggestion` with only the recommendation, or keep one canonical `body` field.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/impl-review.json`
**Requirement:** R8
**Issue:** Each improvement stores the full formatted proposal text twice, once in `issue` and again in `suggestion`, even though both fields currently contain identical content. This doubles payload size and creates drift risk.
**Suggestion:** Store structured fields separately, for example `issue` with only the problem statement and `suggestion` with only the recommendation, or keep one canonical `body` field.
**Rationale:** Loop review proposal.

### 42. 4. Add a bounded retention policy for operational logs
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/issue-log.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/issue-log.json`
**Requirement:** R8
**Issue:** `entries` can grow indefinitely with repeated review attempts, retries, and operational narratives. There is no explicit retention count, byte limit, or compaction boundary, which violates the `bounded-resource-usage` guardrail for bulk data loading and long-running flows.
**Suggestion:** Add a bounded log policy such as maximum entries per step/phase plus summarized rollups for older attempts, or split archived entries into bounded history files referenced by digest.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/issue-log.json`
**Requirement:** R8
**Issue:** `entries` can grow indefinitely with repeated review attempts, retries, and operational narratives. There is no explicit retention count, byte limit, or compaction boundary, which violates the `bounded-resource-usage` guardrail for bulk data loading and long-running flows.
**Suggestion:** Add a bounded log policy such as maximum entries per step/phase plus summarized rollups for older attempts, or split archived entries into bounded history files referenced by digest.
**Rationale:** Loop review proposal.

### 43. 5. Normalize duplicated observation data
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/issue-log.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/issue-log.json`
**Requirement:** R8
**Issue:** Many entries repeat the same facts across `reason`, `observations[].observed`, and `failedEvaluations[].reason`. This creates multiple sources of truth for one finding.
**Suggestion:** Keep detailed finding text in one canonical location, then let `reason` and `failedEvaluations` reference observation IDs or contain short summaries only.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/issue-log.json`
**Requirement:** R8
**Issue:** Many entries repeat the same facts across `reason`, `observations[].observed`, and `failedEvaluations[].reason`. This creates multiple sources of truth for one finding.
**Suggestion:** Keep detailed finding text in one canonical location, then let `reason` and `failedEvaluations` reference observation IDs or contain short summaries only.
**Rationale:** Loop review proposal.

### 44. 8. Add explicit task-count bounds to the issue contract
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/issue.md
**Requirement:** R2
**Issue:** **File:** `specs/318-explicit-task-render-context/issue.md`
**Requirement:** R2
**Issue:** The issue requires `TaskCollection` to validate uniqueness and parent existence across all tasks, but it does not state a maximum collection size. That leaves bulk validation unbounded under the `bounded-resource-usage` guardrail.
**Suggestion:** Add a concrete maximum task count, for example “reject more than 200 tasks before per-task validation, path planning, or writes,” and mirror that limit in the Japanese section.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/issue.md`
**Requirement:** R2
**Issue:** The issue requires `TaskCollection` to validate uniqueness and parent existence across all tasks, but it does not state a maximum collection size. That leaves bulk validation unbounded under the `bounded-resource-usage` guardrail.
**Suggestion:** Add a concrete maximum task count, for example “reject more than 200 tasks before per-task validation, path planning, or writes,” and mirror that limit in the Japanese section.
**Rationale:** Loop review proposal.

### 45. 9. Add newline at EOF
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/issue.md
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/issue.md`
**Requirement:** R8
**Issue:** The file ends without a trailing newline, which creates avoidable formatting churn in future edits.
**Suggestion:** Add a final newline at end of file.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/issue.md`
**Requirement:** R8
**Issue:** The file ends without a trailing newline, which creates avoidable formatting churn in future edits.
**Suggestion:** Add a final newline at end of file.
**Rationale:** Loop review proposal.

### 46. 7. Remove Redundant Top-Level Issue Number
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/plugin-artifacts/workflow/prepare.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/plugin-artifacts/workflow/prepare.json`
**Requirement:** R8
**Issue:** The file stores issue `414` twice: top-level `issue` and `result.issueNumber`. These can drift if the artifact is edited manually.
**Suggestion:** Keep only `result.issueNumber`, or make the top-level `issue` a generated projection rather than persisted duplicated state.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/plugin-artifacts/workflow/prepare.json`
**Requirement:** R8
**Issue:** The file stores issue `414` twice: top-level `issue` and `result.issueNumber`. These can drift if the artifact is edited manually.
**Suggestion:** Keep only `result.issueNumber`, or make the top-level `issue` a generated projection rather than persisted duplicated state.
**Rationale:** Loop review proposal.

### 47. 1. Deduplicate Repeated Improvement Entries
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/review-history/impl-attempt-001.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/review-history/impl-attempt-001.json`
**Requirement:** R8
**Issue:** `nonBlockingImprovements` and `findings` contain duplicated proposals, including identical repeated entries for completion overrides, draft gate source, draft review questions, and several broader summaries. This inflates the artifact from 42 findings while many are repeats.
**Suggestion:** Store each unique finding once, keyed by stable `id`, and remove duplicate entries from both arrays. If repeated grouping is needed, add a separate summary/grouping field that references finding IDs.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/review-history/impl-attempt-001.json`
**Requirement:** R8
**Issue:** `nonBlockingImprovements` and `findings` contain duplicated proposals, including identical repeated entries for completion overrides, draft gate source, draft review questions, and several broader summaries. This inflates the artifact from 42 findings while many are repeats.
**Suggestion:** Store each unique finding once, keyed by stable `id`, and remove duplicate entries from both arrays. If repeated grouping is needed, add a separate summary/grouping field that references finding IDs.
**Rationale:** Loop review proposal.

### 48. 2. Avoid Duplicating Rendered Proposal Text Across Fields
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/review-history/impl-attempt-001.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/review-history/impl-attempt-001.json`
**Requirement:** R8
**Issue:** Each `nonBlockingImprovements[]` entry stores the full proposal text twice, once in `issue` and again in `suggestion`, and both fields include nested `**File:**`, `**Requirement:**`, `**Issue:**`, and `**Suggestion:**` markdown. This duplicates data and makes the JSON harder to consume.
**Suggestion:** Split the data into structured fields: `file`, `requirementId`, `issue`, and `suggestion`, where `issue` contains only the issue description and `suggestion` contains only the suggested change.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/review-history/impl-attempt-001.json`
**Requirement:** R8
**Issue:** Each `nonBlockingImprovements[]` entry stores the full proposal text twice, once in `issue` and again in `suggestion`, and both fields include nested `**File:**`, `**Requirement:**`, `**Issue:**`, and `**Suggestion:**` markdown. This duplicates data and makes the JSON harder to consume.
**Suggestion:** Split the data into structured fields: `file`, `requirementId`, `issue`, and `suggestion`, where `issue` contains only the issue description and `suggestion` contains only the suggested change.
**Rationale:** Loop review proposal.

### 49. 3. Remove Out-Of-Scope Finding Payloads From Attempt Artifact
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/review-history/impl-attempt-001.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/review-history/impl-attempt-001.json`
**Requirement:** R8
**Issue:** The review artifact includes proposals for files that are not present in this diff, such as `src/flow/lib/render-spec-view.js`, `src/spec/lib/render-contract.js`, and `specs/318-explicit-task-render-context/spec.json`. That conflicts with the scoped review contract represented by this change set.
**Suggestion:** Filter `nonBlockingImprovements` and `findings` to only reference files present in this diff, or move historical out-of-scope findings to a separate archived source artifact.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/review-history/impl-attempt-001.json`
**Requirement:** R8
**Issue:** The review artifact includes proposals for files that are not present in this diff, such as `src/flow/lib/render-spec-view.js`, `src/spec/lib/render-contract.js`, and `specs/318-explicit-task-render-context/spec.json`. That conflicts with the scoped review contract represented by this change set.
**Suggestion:** Filter `nonBlockingImprovements` and `findings` to only reference files present in this diff, or move historical out-of-scope findings to a separate archived source artifact.
**Rationale:** Loop review proposal.

### 50. 4. Fix Duplicated Markdown Rendering
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/review-history/impl-attempt-001.md
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/review-history/impl-attempt-001.md`
**Requirement:** R8
**Issue:** Each rendered improvement repeats the same `File`, `Requirement`, `Issue`, and `Suggestion` content inside both the `Issue` and `Suggestion` sections, making the markdown noisy and difficult to review.
**Suggestion:** Render each finding once with clean fields: title, failure mode, file, requirement, issue description, suggestion, and rationale. Do not embed preformatted proposal markdown inside those fields.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/review-history/impl-attempt-001.md`
**Requirement:** R8
**Issue:** Each rendered improvement repeats the same `File`, `Requirement`, `Issue`, and `Suggestion` content inside both the `Issue` and `Suggestion` sections, making the markdown noisy and difficult to review.
**Suggestion:** Render each finding once with clean fields: title, failure mode, file, requirement, issue description, suggestion, and rationale. Do not embed preformatted proposal markdown inside those fields.
**Rationale:** Loop review proposal.

### 51. 5. Normalize Nested Numbering In Headings
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/review-history/impl-attempt-001.md
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/review-history/impl-attempt-001.md`
**Requirement:** R8
**Issue:** Headings like `### 1. 1. Factor repeated manual-review rationale into shared fields` duplicate numbering from both the markdown renderer and the stored title.
**Suggestion:** Remove numeric prefixes from stored finding titles or strip them during markdown rendering so headings render as `### 1. Factor repeated manual-review rationale into shared fields`.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/review-history/impl-attempt-001.md`
**Requirement:** R8
**Issue:** Headings like `### 1. 1. Factor repeated manual-review rationale into shared fields` duplicate numbering from both the markdown renderer and the stored title.
**Suggestion:** Remove numeric prefixes from stored finding titles or strip them during markdown rendering so headings render as `### 1. Factor repeated manual-review rationale into shared fields`.
**Rationale:** Loop review proposal.

### 52. 6. Consolidate Duplicate Draft Question Findings
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/review-history/draft-questions-attempt-001.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/review-history/draft-questions-attempt-001.json`
**Requirement:** R8
**Issue:** The same five findings are represented in both `repairTargets` and `findings`, with duplicated title/body/category metadata.
**Suggestion:** Keep one canonical `findings` array and make `repairTargets` reference finding IDs plus target IDs, or remove `repairTargets` if it is only a filtered duplicate view.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/review-history/draft-questions-attempt-001.json`
**Requirement:** R8
**Issue:** The same five findings are represented in both `repairTargets` and `findings`, with duplicated title/body/category metadata.
**Suggestion:** Keep one canonical `findings` array and make `repairTargets` reference finding IDs plus target IDs, or remove `repairTargets` if it is only a filtered duplicate view.
**Rationale:** Loop review proposal.

### 53. 7. Remove Redundant Top-Level Issue Number
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/plugin-artifacts/workflow/prepare.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/plugin-artifacts/workflow/prepare.json`
**Requirement:** R8
**Issue:** The file stores issue `414` twice: top-level `issue` and `result.issueNumber`. These can drift if the artifact is edited manually.
**Suggestion:** Keep only `result.issueNumber`, or make the top-level `issue` a generated projection rather than persisted duplicated state.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/plugin-artifacts/workflow/prepare.json`
**Requirement:** R8
**Issue:** The file stores issue `414` twice: top-level `issue` and `result.issueNumber`. These can drift if the artifact is edited manually.
**Suggestion:** Keep only `result.issueNumber`, or make the top-level `issue` a generated projection rather than persisted duplicated state.
**Rationale:** Loop review proposal.

### 54. 6. Consolidate Duplicate Draft Question Findings
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/review-history/draft-questions-attempt-001.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/review-history/draft-questions-attempt-001.json`
**Requirement:** R8
**Issue:** The same five findings are represented in both `repairTargets` and `findings`, with duplicated title/body/category metadata.
**Suggestion:** Keep one canonical `findings` array and make `repairTargets` reference finding IDs plus target IDs, or remove `repairTargets` if it is only a filtered duplicate view.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/review-history/draft-questions-attempt-001.json`
**Requirement:** R8
**Issue:** The same five findings are represented in both `repairTargets` and `findings`, with duplicated title/body/category metadata.
**Suggestion:** Keep one canonical `findings` array and make `repairTargets` reference finding IDs plus target IDs, or remove `repairTargets` if it is only a filtered duplicate view.
**Rationale:** Loop review proposal.

### 55. 1. Deduplicate Repeated Improvement Entries
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/review-history/impl-attempt-001.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/review-history/impl-attempt-001.json`
**Requirement:** R8
**Issue:** `nonBlockingImprovements` and `findings` contain duplicated proposals, including identical repeated entries for completion overrides, draft gate source, draft review questions, and several broader summaries. This inflates the artifact from 42 findings while many are repeats.
**Suggestion:** Store each unique finding once, keyed by stable `id`, and remove duplicate entries from both arrays. If repeated grouping is needed, add a separate summary/grouping field that references finding IDs.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/review-history/impl-attempt-001.json`
**Requirement:** R8
**Issue:** `nonBlockingImprovements` and `findings` contain duplicated proposals, including identical repeated entries for completion overrides, draft gate source, draft review questions, and several broader summaries. This inflates the artifact from 42 findings while many are repeats.
**Suggestion:** Store each unique finding once, keyed by stable `id`, and remove duplicate entries from both arrays. If repeated grouping is needed, add a separate summary/grouping field that references finding IDs.
**Rationale:** Loop review proposal.

### 56. 2. Avoid Duplicating Rendered Proposal Text Across Fields
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/review-history/impl-attempt-001.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/review-history/impl-attempt-001.json`
**Requirement:** R8
**Issue:** Each `nonBlockingImprovements[]` entry stores the full proposal text twice, once in `issue` and again in `suggestion`, and both fields include nested `**File:**`, `**Requirement:**`, `**Issue:**`, and `**Suggestion:**` markdown. This duplicates data and makes the JSON harder to consume.
**Suggestion:** Split the data into structured fields: `file`, `requirementId`, `issue`, and `suggestion`, where `issue` contains only the issue description and `suggestion` contains only the suggested change.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/review-history/impl-attempt-001.json`
**Requirement:** R8
**Issue:** Each `nonBlockingImprovements[]` entry stores the full proposal text twice, once in `issue` and again in `suggestion`, and both fields include nested `**File:**`, `**Requirement:**`, `**Issue:**`, and `**Suggestion:**` markdown. This duplicates data and makes the JSON harder to consume.
**Suggestion:** Split the data into structured fields: `file`, `requirementId`, `issue`, and `suggestion`, where `issue` contains only the issue description and `suggestion` contains only the suggested change.
**Rationale:** Loop review proposal.

### 57. 3. Remove Out-Of-Scope Finding Payloads From Attempt Artifact
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/review-history/impl-attempt-001.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/review-history/impl-attempt-001.json`
**Requirement:** R8
**Issue:** The review artifact includes proposals for files that are not present in this diff, such as `src/flow/lib/render-spec-view.js`, `src/spec/lib/render-contract.js`, and `specs/318-explicit-task-render-context/spec.json`. That conflicts with the scoped review contract represented by this change set.
**Suggestion:** Filter `nonBlockingImprovements` and `findings` to only reference files present in this diff, or move historical out-of-scope findings to a separate archived source artifact.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/review-history/impl-attempt-001.json`
**Requirement:** R8
**Issue:** The review artifact includes proposals for files that are not present in this diff, such as `src/flow/lib/render-spec-view.js`, `src/spec/lib/render-contract.js`, and `specs/318-explicit-task-render-context/spec.json`. That conflicts with the scoped review contract represented by this change set.
**Suggestion:** Filter `nonBlockingImprovements` and `findings` to only reference files present in this diff, or move historical out-of-scope findings to a separate archived source artifact.
**Rationale:** Loop review proposal.

### 58. 4. Fix Duplicated Markdown Rendering
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/review-history/impl-attempt-001.md
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/review-history/impl-attempt-001.md`
**Requirement:** R8
**Issue:** Each rendered improvement repeats the same `File`, `Requirement`, `Issue`, and `Suggestion` content inside both the `Issue` and `Suggestion` sections, making the markdown noisy and difficult to review.
**Suggestion:** Render each finding once with clean fields: title, failure mode, file, requirement, issue description, suggestion, and rationale. Do not embed preformatted proposal markdown inside those fields.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/review-history/impl-attempt-001.md`
**Requirement:** R8
**Issue:** Each rendered improvement repeats the same `File`, `Requirement`, `Issue`, and `Suggestion` content inside both the `Issue` and `Suggestion` sections, making the markdown noisy and difficult to review.
**Suggestion:** Render each finding once with clean fields: title, failure mode, file, requirement, issue description, suggestion, and rationale. Do not embed preformatted proposal markdown inside those fields.
**Rationale:** Loop review proposal.

### 59. 5. Normalize Nested Numbering In Headings
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/review-history/impl-attempt-001.md
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/review-history/impl-attempt-001.md`
**Requirement:** R8
**Issue:** Headings like `### 1. 1. Factor repeated manual-review rationale into shared fields` duplicate numbering from both the markdown renderer and the stored title.
**Suggestion:** Remove numeric prefixes from stored finding titles or strip them during markdown rendering so headings render as `### 1. Factor repeated manual-review rationale into shared fields`.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/review-history/impl-attempt-001.md`
**Requirement:** R8
**Issue:** Headings like `### 1. 1. Factor repeated manual-review rationale into shared fields` duplicate numbering from both the markdown renderer and the stored title.
**Suggestion:** Remove numeric prefixes from stored finding titles or strip them during markdown rendering so headings render as `### 1. Factor repeated manual-review rationale into shared fields`.
**Rationale:** Loop review proposal.

### 60. 4. Fix Duplicated Markdown Rendering
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/review.md
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/review.md`
**Requirement:** R8
**Issue:** Each rendered improvement repeats the same `File`, `Requirement`, `Issue`, and `Suggestion` content inside both the `Issue` and `Suggestion` sections, making the markdown noisy and difficult to review.
**Suggestion:** Render each finding once with clean fields: title, failure mode, file, requirement, issue description, suggestion, and rationale. Do not embed preformatted proposal markdown inside those fields.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/review.md`
**Requirement:** R8
**Issue:** Each rendered improvement repeats the same `File`, `Requirement`, `Issue`, and `Suggestion` content inside both the `Issue` and `Suggestion` sections, making the markdown noisy and difficult to review.
**Suggestion:** Render each finding once with clean fields: title, failure mode, file, requirement, issue description, suggestion, and rationale. Do not embed preformatted proposal markdown inside those fields.
**Rationale:** Loop review proposal.

### 61. 5. Normalize Nested Numbering In Headings
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/review.md
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/review.md`
**Requirement:** R8
**Issue:** Headings like `### 1. 1. Factor repeated manual-review rationale into shared fields` duplicate numbering from both the markdown renderer and the stored title.
**Suggestion:** Remove numeric prefixes from stored finding titles or strip them during markdown rendering so headings render as `### 1. Factor repeated manual-review rationale into shared fields`.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/review.md`
**Requirement:** R8
**Issue:** Headings like `### 1. 1. Factor repeated manual-review rationale into shared fields` duplicate numbering from both the markdown renderer and the stored title.
**Suggestion:** Remove numeric prefixes from stored finding titles or strip them during markdown rendering so headings render as `### 1. Factor repeated manual-review rationale into shared fields`.
**Rationale:** Loop review proposal.

### 62. 3. Normalize count field naming across artifacts
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/review-history/spec-attempt-001.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/review-history/spec-attempt-001.json`
**Requirement:** R8
**Issue:** Spec review counts use `nonBlocking`, while test review counts use `advisory`. These appear to represent the same category but use different names, which adds conditional handling for consumers.
**Suggestion:** Standardize on one field name across review-history artifacts, such as `advisory`, and migrate the spec artifact to match.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/review-history/spec-attempt-001.json`
**Requirement:** R8
**Issue:** Spec review counts use `nonBlocking`, while test review counts use `advisory`. These appear to represent the same category but use different names, which adds conditional handling for consumers.
**Suggestion:** Standardize on one field name across review-history artifacts, such as `advisory`, and migrate the spec artifact to match.
**Rationale:** Loop review proposal.

### 63. 4. Add trailing newline
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/review-history/spec-attempt-001.md
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/review-history/spec-attempt-001.md`
**Requirement:** R8
**Issue:** The file lacks a trailing newline, which is inconsistent with normal text-file formatting and can cause noisy diffs.
**Suggestion:** Add a final newline at the end of the Markdown file.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/review-history/spec-attempt-001.md`
**Requirement:** R8
**Issue:** The file lacks a trailing newline, which is inconsistent with normal text-file formatting and can cause noisy diffs.
**Suggestion:** Add a final newline at the end of the Markdown file.
**Rationale:** Loop review proposal.

### 64. 4. Add trailing newline
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/spec-review.md
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/spec-review.md`
**Requirement:** R8
**Issue:** The file lacks a trailing newline, which is inconsistent with normal text-file formatting and can cause noisy diffs.
**Suggestion:** Add a final newline at the end of the Markdown file.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/spec-review.md`
**Requirement:** R8
**Issue:** The file lacks a trailing newline, which is inconsistent with normal text-file formatting and can cause noisy diffs.
**Suggestion:** Add a final newline at the end of the Markdown file.
**Rationale:** Loop review proposal.

### 65. 1. Avoid storing duplicate review artifacts
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/review-history/test-attempt-001.md
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/review-history/test-attempt-001.md`
**Requirement:** R8
**Issue:** The Markdown file duplicates the same findings already stored structurally in `test-attempt-001.json`. This creates two sources of truth for titles, issues, required changes, and blocking rationale.
**Suggestion:** Keep the JSON as the canonical artifact and generate Markdown views on demand, or store only the Markdown if human-readable history is the intended canonical format.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/review-history/test-attempt-001.md`
**Requirement:** R8
**Issue:** The Markdown file duplicates the same findings already stored structurally in `test-attempt-001.json`. This creates two sources of truth for titles, issues, required changes, and blocking rationale.
**Suggestion:** Keep the JSON as the canonical artifact and generate Markdown views on demand, or store only the Markdown if human-readable history is the intended canonical format.
**Rationale:** Loop review proposal.

### 66. 2. Avoid storing duplicate review artifacts
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/review-history/test-attempt-002.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/review-history/test-attempt-002.json`
**Requirement:** R8
**Issue:** The file repeats each finding in both `blockingFindings` and `findings`, duplicating title/body/origin-style information within the same artifact.
**Suggestion:** Store findings once and derive grouped views such as `blockingFindings` from `findings` by severity when rendering or consuming the artifact.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/review-history/test-attempt-002.json`
**Requirement:** R8
**Issue:** The file repeats each finding in both `blockingFindings` and `findings`, duplicating title/body/origin-style information within the same artifact.
**Suggestion:** Store findings once and derive grouped views such as `blockingFindings` from `findings` by severity when rendering or consuming the artifact.
**Rationale:** Loop review proposal.

### 67. 3. Normalize count field naming across artifacts
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/review-history/spec-attempt-001.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/review-history/spec-attempt-001.json`
**Requirement:** R8
**Issue:** Spec review counts use `nonBlocking`, while test review counts use `advisory`. These appear to represent the same category but use different names, which adds conditional handling for consumers.
**Suggestion:** Standardize on one field name across review-history artifacts, such as `advisory`, and migrate the spec artifact to match.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/review-history/spec-attempt-001.json`
**Requirement:** R8
**Issue:** Spec review counts use `nonBlocking`, while test review counts use `advisory`. These appear to represent the same category but use different names, which adds conditional handling for consumers.
**Suggestion:** Standardize on one field name across review-history artifacts, such as `advisory`, and migrate the spec artifact to match.
**Rationale:** Loop review proposal.

### 68. 4. Add trailing newline
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/review-history/spec-attempt-001.md
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/review-history/spec-attempt-001.md`
**Requirement:** R8
**Issue:** The file lacks a trailing newline, which is inconsistent with normal text-file formatting and can cause noisy diffs.
**Suggestion:** Add a final newline at the end of the Markdown file.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/review-history/spec-attempt-001.md`
**Requirement:** R8
**Issue:** The file lacks a trailing newline, which is inconsistent with normal text-file formatting and can cause noisy diffs.
**Suggestion:** Add a final newline at the end of the Markdown file.
**Rationale:** Loop review proposal.

### 69. 1. Avoid storing duplicate review artifacts
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/review-history/test-attempt-001.md
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/review-history/test-attempt-001.md`
**Requirement:** R8
**Issue:** The Markdown file duplicates the same findings already stored structurally in `test-attempt-001.json`. This creates two sources of truth for titles, issues, required changes, and blocking rationale.
**Suggestion:** Keep the JSON as the canonical artifact and generate Markdown views on demand, or store only the Markdown if human-readable history is the intended canonical format.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/review-history/test-attempt-001.md`
**Requirement:** R8
**Issue:** The Markdown file duplicates the same findings already stored structurally in `test-attempt-001.json`. This creates two sources of truth for titles, issues, required changes, and blocking rationale.
**Suggestion:** Keep the JSON as the canonical artifact and generate Markdown views on demand, or store only the Markdown if human-readable history is the intended canonical format.
**Rationale:** Loop review proposal.

### 70. 2. Avoid storing duplicate review artifacts
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/review-history/test-attempt-002.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/review-history/test-attempt-002.json`
**Requirement:** R8
**Issue:** The file repeats each finding in both `blockingFindings` and `findings`, duplicating title/body/origin-style information within the same artifact.
**Suggestion:** Store findings once and derive grouped views such as `blockingFindings` from `findings` by severity when rendering or consuming the artifact.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/review-history/test-attempt-002.json`
**Requirement:** R8
**Issue:** The file repeats each finding in both `blockingFindings` and `findings`, duplicating title/body/origin-style information within the same artifact.
**Suggestion:** Store findings once and derive grouped views such as `blockingFindings` from `findings` by severity when rendering or consuming the artifact.
**Rationale:** Loop review proposal.

### 71. 1. Deduplicate Review Finding Content
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/review-history/test-attempt-003.json
**Requirement:** R3
**Issue:** **File:** `specs/318-explicit-task-render-context/review-history/test-attempt-003.json`
**Requirement:** R3
**Issue:** The JSON stores the same finding content in multiple places: `blockingFindings`/`advisoryFindings` and again in `findings`. This creates drift risk, especially for titles and body text.
**Suggestion:** Keep one canonical findings array and derive grouped views from it, or remove the duplicated `findings` block if the grouped arrays are the intended source of truth.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/review-history/test-attempt-003.json`
**Requirement:** R3
**Issue:** The JSON stores the same finding content in multiple places: `blockingFindings`/`advisoryFindings` and again in `findings`. This creates drift risk, especially for titles and body text.
**Suggestion:** Keep one canonical findings array and derive grouped views from it, or remove the duplicated `findings` block if the grouped arrays are the intended source of truth.
**Rationale:** Loop review proposal.

### 72. 2. Deduplicate Review Finding Content
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/review-history/test-attempt-004.json
**Requirement:** R7
**Issue:** **File:** `specs/318-explicit-task-render-context/review-history/test-attempt-004.json`
**Requirement:** R7
**Issue:** The JSON repeats finding data across `blockingFindings`/`advisoryFindings` and `findings`, with slightly different field names and severity values. This makes future review history harder to compare mechanically.
**Suggestion:** Store each finding once using a single normalized schema, then generate any markdown or grouped summaries from that canonical representation.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/review-history/test-attempt-004.json`
**Requirement:** R7
**Issue:** The JSON repeats finding data across `blockingFindings`/`advisoryFindings` and `findings`, with slightly different field names and severity values. This makes future review history harder to compare mechanically.
**Suggestion:** Store each finding once using a single normalized schema, then generate any markdown or grouped summaries from that canonical representation.
**Rationale:** Loop review proposal.

### 73. 3. Normalize Failure Kind Naming
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/review-history/test-attempt-004.json
**Requirement:** R3
**Issue:** **File:** `specs/318-explicit-task-render-context/review-history/test-attempt-004.json`
**Requirement:** R3
**Issue:** `failureKind` uses `missing_coverage`, while `test-attempt-003.json` uses `missing-test-coverage`. The inconsistent naming complicates filtering and trend analysis across attempts.
**Suggestion:** Standardize on one enum value format, preferably the already more descriptive `missing-test-coverage`, across all review-history JSON files.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/review-history/test-attempt-004.json`
**Requirement:** R3
**Issue:** `failureKind` uses `missing_coverage`, while `test-attempt-003.json` uses `missing-test-coverage`. The inconsistent naming complicates filtering and trend analysis across attempts.
**Suggestion:** Standardize on one enum value format, preferably the already more descriptive `missing-test-coverage`, across all review-history JSON files.
**Rationale:** Loop review proposal.

### 74. 4. Remove Redundant Markdown Mirrors
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/review-history/test-attempt-003.md
**Requirement:** R2
**Issue:** **File:** `specs/318-explicit-task-render-context/review-history/test-attempt-003.md`
**Requirement:** R2
**Issue:** This markdown file appears to be a rendered duplicate of `test-attempt-003.json`. Maintaining both hand-written artifacts invites content drift without adding distinct information.
**Suggestion:** Treat the JSON as canonical and generate the markdown report from it, or keep only one persisted artifact format per attempt.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/review-history/test-attempt-003.md`
**Requirement:** R2
**Issue:** This markdown file appears to be a rendered duplicate of `test-attempt-003.json`. Maintaining both hand-written artifacts invites content drift without adding distinct information.
**Suggestion:** Treat the JSON as canonical and generate the markdown report from it, or keep only one persisted artifact format per attempt.
**Rationale:** Loop review proposal.

### 75. 5. Remove Redundant Markdown Mirrors
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/review-history/test-attempt-004.md
**Requirement:** R7
**Issue:** **File:** `specs/318-explicit-task-render-context/review-history/test-attempt-004.md`
**Requirement:** R7
**Issue:** This markdown duplicates the structured JSON result for the same attempt. Any future edit must update both files to preserve consistency.
**Suggestion:** Generate this markdown from `test-attempt-004.json` as part of the review tooling, or omit the markdown artifact when the JSON is already committed.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/review-history/test-attempt-004.md`
**Requirement:** R7
**Issue:** This markdown duplicates the structured JSON result for the same attempt. Any future edit must update both files to preserve consistency.
**Suggestion:** Generate this markdown from `test-attempt-004.json` as part of the review tooling, or omit the markdown artifact when the JSON is already committed.
**Rationale:** Loop review proposal.

### 76. 1. Deduplicate Review Finding Content
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/review-history/test-attempt-003.json
**Requirement:** R3
**Issue:** **File:** `specs/318-explicit-task-render-context/review-history/test-attempt-003.json`
**Requirement:** R3
**Issue:** The JSON stores the same finding content in multiple places: `blockingFindings`/`advisoryFindings` and again in `findings`. This creates drift risk, especially for titles and body text.
**Suggestion:** Keep one canonical findings array and derive grouped views from it, or remove the duplicated `findings` block if the grouped arrays are the intended source of truth.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/review-history/test-attempt-003.json`
**Requirement:** R3
**Issue:** The JSON stores the same finding content in multiple places: `blockingFindings`/`advisoryFindings` and again in `findings`. This creates drift risk, especially for titles and body text.
**Suggestion:** Keep one canonical findings array and derive grouped views from it, or remove the duplicated `findings` block if the grouped arrays are the intended source of truth.
**Rationale:** Loop review proposal.

### 77. 4. Remove Redundant Markdown Mirrors
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/review-history/test-attempt-003.md
**Requirement:** R2
**Issue:** **File:** `specs/318-explicit-task-render-context/review-history/test-attempt-003.md`
**Requirement:** R2
**Issue:** This markdown file appears to be a rendered duplicate of `test-attempt-003.json`. Maintaining both hand-written artifacts invites content drift without adding distinct information.
**Suggestion:** Treat the JSON as canonical and generate the markdown report from it, or keep only one persisted artifact format per attempt.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/review-history/test-attempt-003.md`
**Requirement:** R2
**Issue:** This markdown file appears to be a rendered duplicate of `test-attempt-003.json`. Maintaining both hand-written artifacts invites content drift without adding distinct information.
**Suggestion:** Treat the JSON as canonical and generate the markdown report from it, or keep only one persisted artifact format per attempt.
**Rationale:** Loop review proposal.

### 78. 2. Deduplicate Review Finding Content
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/review-history/test-attempt-004.json
**Requirement:** R7
**Issue:** **File:** `specs/318-explicit-task-render-context/review-history/test-attempt-004.json`
**Requirement:** R7
**Issue:** The JSON repeats finding data across `blockingFindings`/`advisoryFindings` and `findings`, with slightly different field names and severity values. This makes future review history harder to compare mechanically.
**Suggestion:** Store each finding once using a single normalized schema, then generate any markdown or grouped summaries from that canonical representation.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/review-history/test-attempt-004.json`
**Requirement:** R7
**Issue:** The JSON repeats finding data across `blockingFindings`/`advisoryFindings` and `findings`, with slightly different field names and severity values. This makes future review history harder to compare mechanically.
**Suggestion:** Store each finding once using a single normalized schema, then generate any markdown or grouped summaries from that canonical representation.
**Rationale:** Loop review proposal.

### 79. 3. Normalize Failure Kind Naming
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/review-history/test-attempt-004.json
**Requirement:** R3
**Issue:** **File:** `specs/318-explicit-task-render-context/review-history/test-attempt-004.json`
**Requirement:** R3
**Issue:** `failureKind` uses `missing_coverage`, while `test-attempt-003.json` uses `missing-test-coverage`. The inconsistent naming complicates filtering and trend analysis across attempts.
**Suggestion:** Standardize on one enum value format, preferably the already more descriptive `missing-test-coverage`, across all review-history JSON files.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/review-history/test-attempt-004.json`
**Requirement:** R3
**Issue:** `failureKind` uses `missing_coverage`, while `test-attempt-003.json` uses `missing-test-coverage`. The inconsistent naming complicates filtering and trend analysis across attempts.
**Suggestion:** Standardize on one enum value format, preferably the already more descriptive `missing-test-coverage`, across all review-history JSON files.
**Rationale:** Loop review proposal.

### 80. 5. Remove Redundant Markdown Mirrors
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/review-history/test-attempt-004.md
**Requirement:** R7
**Issue:** **File:** `specs/318-explicit-task-render-context/review-history/test-attempt-004.md`
**Requirement:** R7
**Issue:** This markdown duplicates the structured JSON result for the same attempt. Any future edit must update both files to preserve consistency.
**Suggestion:** Generate this markdown from `test-attempt-004.json` as part of the review tooling, or omit the markdown artifact when the JSON is already committed.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/review-history/test-attempt-004.md`
**Requirement:** R7
**Issue:** This markdown duplicates the structured JSON result for the same attempt. Any future edit must update both files to preserve consistency.
**Suggestion:** Generate this markdown from `test-attempt-004.json` as part of the review tooling, or omit the markdown artifact when the JSON is already committed.
**Rationale:** Loop review proposal.

### 81. 1. Eliminate Duplicated Finding Payloads
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/review-history/test-attempt-006.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/review-history/test-attempt-006.json`  
**Requirement:** R8  
**Issue:** Each blocking finding is represented twice: once in `blockingFindings` with full structured fields, and again in `findings` with a reduced duplicate body. This creates drift risk if one copy is updated without the other.  
**Suggestion:** Keep one canonical finding collection and derive the alternate view when rendering history artifacts, or replace `findings` entries with references to the canonical `blockingFindings` items.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/review-history/test-attempt-006.json`  
**Requirement:** R8  
**Issue:** Each blocking finding is represented twice: once in `blockingFindings` with full structured fields, and again in `findings` with a reduced duplicate body. This creates drift risk if one copy is updated without the other.  
**Suggestion:** Keep one canonical finding collection and derive the alternate view when rendering history artifacts, or replace `findings` entries with references to the canonical `blockingFindings` items.
**Rationale:** Loop review proposal.

### 82. 2. Normalize Missing Trailing Newlines
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/review-history/test-attempt-005.md
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/review-history/test-attempt-005.md`  
**Requirement:** R8  
**Issue:** The file ends without a trailing newline, which is inconsistent with typical Markdown/text artifact formatting and can create noisy diffs.  
**Suggestion:** Add a final newline at EOF.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/review-history/test-attempt-005.md`  
**Requirement:** R8  
**Issue:** The file ends without a trailing newline, which is inconsistent with typical Markdown/text artifact formatting and can create noisy diffs.  
**Suggestion:** Add a final newline at EOF.
**Rationale:** Loop review proposal.

### 83. 3. Normalize Missing Trailing Newlines
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/review-history/test-attempt-006.md
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/review-history/test-attempt-006.md`  
**Requirement:** R8  
**Issue:** The file ends without a trailing newline, matching the same formatting inconsistency as the previous attempt artifact.  
**Suggestion:** Add a final newline at EOF.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/review-history/test-attempt-006.md`  
**Requirement:** R8  
**Issue:** The file ends without a trailing newline, matching the same formatting inconsistency as the previous attempt artifact.  
**Suggestion:** Add a final newline at EOF.
**Rationale:** Loop review proposal.

### 84. 4. Avoid Embedding Parsed Proposal Data Twice
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/review-history/work-units/impl-review/018870d7c819e46bcb116c71.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/review-history/work-units/impl-review/018870d7c819e46bcb116c71.json`  
**Requirement:** R8  
**Issue:** The artifact stores the complete proposal content in both `rawResponse` and `success.proposals[].body`. This duplicates substantial text and increases artifact size and inconsistency risk.  
**Suggestion:** Store `rawResponse` only for debugging, or store structured `success.proposals` as canonical output and omit `rawResponse` once parsing succeeds.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/review-history/work-units/impl-review/018870d7c819e46bcb116c71.json`  
**Requirement:** R8  
**Issue:** The artifact stores the complete proposal content in both `rawResponse` and `success.proposals[].body`. This duplicates substantial text and increases artifact size and inconsistency risk.  
**Suggestion:** Store `rawResponse` only for debugging, or store structured `success.proposals` as canonical output and omit `rawResponse` once parsing succeeds.
**Rationale:** Loop review proposal.

### 85. 2. Normalize Missing Trailing Newlines
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/review-history/test-attempt-005.md
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/review-history/test-attempt-005.md`  
**Requirement:** R8  
**Issue:** The file ends without a trailing newline, which is inconsistent with typical Markdown/text artifact formatting and can create noisy diffs.  
**Suggestion:** Add a final newline at EOF.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/review-history/test-attempt-005.md`  
**Requirement:** R8  
**Issue:** The file ends without a trailing newline, which is inconsistent with typical Markdown/text artifact formatting and can create noisy diffs.  
**Suggestion:** Add a final newline at EOF.
**Rationale:** Loop review proposal.

### 86. 1. Eliminate Duplicated Finding Payloads
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/review-history/test-attempt-006.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/review-history/test-attempt-006.json`  
**Requirement:** R8  
**Issue:** Each blocking finding is represented twice: once in `blockingFindings` with full structured fields, and again in `findings` with a reduced duplicate body. This creates drift risk if one copy is updated without the other.  
**Suggestion:** Keep one canonical finding collection and derive the alternate view when rendering history artifacts, or replace `findings` entries with references to the canonical `blockingFindings` items.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/review-history/test-attempt-006.json`  
**Requirement:** R8  
**Issue:** Each blocking finding is represented twice: once in `blockingFindings` with full structured fields, and again in `findings` with a reduced duplicate body. This creates drift risk if one copy is updated without the other.  
**Suggestion:** Keep one canonical finding collection and derive the alternate view when rendering history artifacts, or replace `findings` entries with references to the canonical `blockingFindings` items.
**Rationale:** Loop review proposal.

### 87. 3. Normalize Missing Trailing Newlines
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/review-history/test-attempt-006.md
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/review-history/test-attempt-006.md`  
**Requirement:** R8  
**Issue:** The file ends without a trailing newline, matching the same formatting inconsistency as the previous attempt artifact.  
**Suggestion:** Add a final newline at EOF.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/review-history/test-attempt-006.md`  
**Requirement:** R8  
**Issue:** The file ends without a trailing newline, matching the same formatting inconsistency as the previous attempt artifact.  
**Suggestion:** Add a final newline at EOF.
**Rationale:** Loop review proposal.

### 88. 4. Avoid Embedding Parsed Proposal Data Twice
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/review-history/work-units/impl-review/018870d7c819e46bcb116c71.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/review-history/work-units/impl-review/018870d7c819e46bcb116c71.json`  
**Requirement:** R8  
**Issue:** The artifact stores the complete proposal content in both `rawResponse` and `success.proposals[].body`. This duplicates substantial text and increases artifact size and inconsistency risk.  
**Suggestion:** Store `rawResponse` only for debugging, or store structured `success.proposals` as canonical output and omit `rawResponse` once parsing succeeds.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/review-history/work-units/impl-review/018870d7c819e46bcb116c71.json`  
**Requirement:** R8  
**Issue:** The artifact stores the complete proposal content in both `rawResponse` and `success.proposals[].body`. This duplicates substantial text and increases artifact size and inconsistency risk.  
**Suggestion:** Store `rawResponse` only for debugging, or store structured `success.proposals` as canonical output and omit `rawResponse` once parsing succeeds.
**Rationale:** Loop review proposal.

### 89. 1. Avoid storing duplicate identity fields
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/review-history/work-units/impl-review/59fa3a31c681356961cc7bdf.json
**Requirement:** R4
**Issue:** **File:** `specs/318-explicit-task-render-context/review-history/work-units/impl-review/59fa3a31c681356961cc7bdf.json`  
**Requirement:** R4  
**Issue:** Metadata such as `phase`, `kind`, `unitId`, `targetFiles`, `inputHash`, `providerIdentity`, `promptVersion`, and `schemaVersion` is duplicated both at the top level and inside `identity`. This creates avoidable consistency risk across persisted review units.  
**Suggestion:** Keep these fields canonical in one location, preferably `identity`, and have readers derive or project the top-level values when needed.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/review-history/work-units/impl-review/59fa3a31c681356961cc7bdf.json`  
**Requirement:** R4  
**Issue:** Metadata such as `phase`, `kind`, `unitId`, `targetFiles`, `inputHash`, `providerIdentity`, `promptVersion`, and `schemaVersion` is duplicated both at the top level and inside `identity`. This creates avoidable consistency risk across persisted review units.  
**Suggestion:** Keep these fields canonical in one location, preferably `identity`, and have readers derive or project the top-level values when needed.
**Rationale:** Loop review proposal.

### 90. 2. Normalize raw response and parsed proposals
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/review-history/work-units/impl-review/635b54e59ef6bd709a49df1c.json
**Requirement:** R4
**Issue:** **File:** `specs/318-explicit-task-render-context/review-history/work-units/impl-review/635b54e59ef6bd709a49df1c.json`  
**Requirement:** R4  
**Issue:** `rawResponse` stores the full proposal text, while `success.proposals[]` stores the parsed version of the same content. This duplicates review data and can drift if one representation is edited or regenerated independently.  
**Suggestion:** Persist either the raw provider output for audit or the parsed structured proposals as canonical data. If both are required, mark `rawResponse` as audit-only and avoid using it as a second source of truth.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/review-history/work-units/impl-review/635b54e59ef6bd709a49df1c.json`  
**Requirement:** R4  
**Issue:** `rawResponse` stores the full proposal text, while `success.proposals[]` stores the parsed version of the same content. This duplicates review data and can drift if one representation is edited or regenerated independently.  
**Suggestion:** Persist either the raw provider output for audit or the parsed structured proposals as canonical data. If both are required, mark `rawResponse` as audit-only and avoid using it as a second source of truth.
**Rationale:** Loop review proposal.

### 91. 3. Extract repeated work-unit envelope structure
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/review-history/work-units/impl-review/75f4871091a34c2fc78b9a8b.json
**Requirement:** R5
**Issue:** **File:** `specs/318-explicit-task-render-context/review-history/work-units/impl-review/75f4871091a34c2fc78b9a8b.json`  
**Requirement:** R5  
**Issue:** The newly added work-unit JSON files repeat the same envelope shape with only identifiers, target files, hashes, timestamps, and response payloads changing. This makes generated artifacts noisy and harder to inspect for meaningful differences.  
**Suggestion:** Use a shared schema/template for the invariant envelope and persist only variable fields per work unit, or ensure these files are generated from a single serializer so the repeated structure is not manually maintained.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/review-history/work-units/impl-review/75f4871091a34c2fc78b9a8b.json`  
**Requirement:** R5  
**Issue:** The newly added work-unit JSON files repeat the same envelope shape with only identifiers, target files, hashes, timestamps, and response payloads changing. This makes generated artifacts noisy and harder to inspect for meaningful differences.  
**Suggestion:** Use a shared schema/template for the invariant envelope and persist only variable fields per work unit, or ensure these files are generated from a single serializer so the repeated structure is not manually maintained.
**Rationale:** Loop review proposal.

### 92. 4. Remove duplicated proposal numbering from structured titles
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/review-history/work-units/impl-review/bd3798396b2128f722503801.json
**Requirement:** R4
**Issue:** **File:** `specs/318-explicit-task-render-context/review-history/work-units/impl-review/bd3798396b2128f722503801.json`  
**Requirement:** R4  
**Issue:** Each parsed proposal `title` includes a numeric prefix such as `"1. Add Explicit Task Count Bounds"`, duplicating the proposal’s array position. This makes reordering or merging proposals more error-prone.  
**Suggestion:** Store titles without ordinal prefixes, for example `"Add Explicit Task Count Bounds"`, and let renderers add numbering at display time.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/review-history/work-units/impl-review/bd3798396b2128f722503801.json`  
**Requirement:** R4  
**Issue:** Each parsed proposal `title` includes a numeric prefix such as `"1. Add Explicit Task Count Bounds"`, duplicating the proposal’s array position. This makes reordering or merging proposals more error-prone.  
**Suggestion:** Store titles without ordinal prefixes, for example `"Add Explicit Task Count Bounds"`, and let renderers add numbering at display time.
**Rationale:** Loop review proposal.

### 93. 1. Avoid storing duplicate identity fields
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/review-history/work-units/impl-review/59fa3a31c681356961cc7bdf.json
**Requirement:** R4
**Issue:** **File:** `specs/318-explicit-task-render-context/review-history/work-units/impl-review/59fa3a31c681356961cc7bdf.json`  
**Requirement:** R4  
**Issue:** Metadata such as `phase`, `kind`, `unitId`, `targetFiles`, `inputHash`, `providerIdentity`, `promptVersion`, and `schemaVersion` is duplicated both at the top level and inside `identity`. This creates avoidable consistency risk across persisted review units.  
**Suggestion:** Keep these fields canonical in one location, preferably `identity`, and have readers derive or project the top-level values when needed.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/review-history/work-units/impl-review/59fa3a31c681356961cc7bdf.json`  
**Requirement:** R4  
**Issue:** Metadata such as `phase`, `kind`, `unitId`, `targetFiles`, `inputHash`, `providerIdentity`, `promptVersion`, and `schemaVersion` is duplicated both at the top level and inside `identity`. This creates avoidable consistency risk across persisted review units.  
**Suggestion:** Keep these fields canonical in one location, preferably `identity`, and have readers derive or project the top-level values when needed.
**Rationale:** Loop review proposal.

### 94. 2. Normalize raw response and parsed proposals
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/review-history/work-units/impl-review/635b54e59ef6bd709a49df1c.json
**Requirement:** R4
**Issue:** **File:** `specs/318-explicit-task-render-context/review-history/work-units/impl-review/635b54e59ef6bd709a49df1c.json`  
**Requirement:** R4  
**Issue:** `rawResponse` stores the full proposal text, while `success.proposals[]` stores the parsed version of the same content. This duplicates review data and can drift if one representation is edited or regenerated independently.  
**Suggestion:** Persist either the raw provider output for audit or the parsed structured proposals as canonical data. If both are required, mark `rawResponse` as audit-only and avoid using it as a second source of truth.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/review-history/work-units/impl-review/635b54e59ef6bd709a49df1c.json`  
**Requirement:** R4  
**Issue:** `rawResponse` stores the full proposal text, while `success.proposals[]` stores the parsed version of the same content. This duplicates review data and can drift if one representation is edited or regenerated independently.  
**Suggestion:** Persist either the raw provider output for audit or the parsed structured proposals as canonical data. If both are required, mark `rawResponse` as audit-only and avoid using it as a second source of truth.
**Rationale:** Loop review proposal.

### 95. 3. Extract repeated work-unit envelope structure
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/review-history/work-units/impl-review/75f4871091a34c2fc78b9a8b.json
**Requirement:** R5
**Issue:** **File:** `specs/318-explicit-task-render-context/review-history/work-units/impl-review/75f4871091a34c2fc78b9a8b.json`  
**Requirement:** R5  
**Issue:** The newly added work-unit JSON files repeat the same envelope shape with only identifiers, target files, hashes, timestamps, and response payloads changing. This makes generated artifacts noisy and harder to inspect for meaningful differences.  
**Suggestion:** Use a shared schema/template for the invariant envelope and persist only variable fields per work unit, or ensure these files are generated from a single serializer so the repeated structure is not manually maintained.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/review-history/work-units/impl-review/75f4871091a34c2fc78b9a8b.json`  
**Requirement:** R5  
**Issue:** The newly added work-unit JSON files repeat the same envelope shape with only identifiers, target files, hashes, timestamps, and response payloads changing. This makes generated artifacts noisy and harder to inspect for meaningful differences.  
**Suggestion:** Use a shared schema/template for the invariant envelope and persist only variable fields per work unit, or ensure these files are generated from a single serializer so the repeated structure is not manually maintained.
**Rationale:** Loop review proposal.

### 96. 4. Remove duplicated proposal numbering from structured titles
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/review-history/work-units/impl-review/bd3798396b2128f722503801.json
**Requirement:** R4
**Issue:** **File:** `specs/318-explicit-task-render-context/review-history/work-units/impl-review/bd3798396b2128f722503801.json`  
**Requirement:** R4  
**Issue:** Each parsed proposal `title` includes a numeric prefix such as `"1. Add Explicit Task Count Bounds"`, duplicating the proposal’s array position. This makes reordering or merging proposals more error-prone.  
**Suggestion:** Store titles without ordinal prefixes, for example `"Add Explicit Task Count Bounds"`, and let renderers add numbering at display time.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/review-history/work-units/impl-review/bd3798396b2128f722503801.json`  
**Requirement:** R4  
**Issue:** Each parsed proposal `title` includes a numeric prefix such as `"1. Add Explicit Task Count Bounds"`, duplicating the proposal’s array position. This makes reordering or merging proposals more error-prone.  
**Suggestion:** Store titles without ordinal prefixes, for example `"Add Explicit Task Count Bounds"`, and let renderers add numbering at display time.
**Rationale:** Loop review proposal.

### 97. 1. Remove duplicated proposal payloads
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/review-history/work-units/impl-review/c43a47f76d207c075c9f3648.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/review-history/work-units/impl-review/c43a47f76d207c075c9f3648.json`  
**Requirement:** R8  
**Issue:** The proposal content is stored twice: once as formatted Markdown in `rawResponse`, and again as structured entries under `success.proposals`. This creates drift risk and makes the artifact larger than needed.  
**Suggestion:** Keep `success.proposals` as the canonical representation and omit `rawResponse`, or store only a provider transcript reference if the raw response is required for audit.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/review-history/work-units/impl-review/c43a47f76d207c075c9f3648.json`  
**Requirement:** R8  
**Issue:** The proposal content is stored twice: once as formatted Markdown in `rawResponse`, and again as structured entries under `success.proposals`. This creates drift risk and makes the artifact larger than needed.  
**Suggestion:** Keep `success.proposals` as the canonical representation and omit `rawResponse`, or store only a provider transcript reference if the raw response is required for audit.
**Rationale:** Loop review proposal.

### 98. 2. Remove duplicated proposal payloads
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/review-history/work-units/impl-review/d7e860f04f301bf9cac6a177.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/review-history/work-units/impl-review/d7e860f04f301bf9cac6a177.json`  
**Requirement:** R8  
**Issue:** `rawResponse` repeats the same proposal titles, file paths, requirement IDs, issues, and suggestions already represented in `success.proposals`.  
**Suggestion:** Drop `rawResponse` from successful structured review artifacts, or derive it from `success.proposals` at render time.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/review-history/work-units/impl-review/d7e860f04f301bf9cac6a177.json`  
**Requirement:** R8  
**Issue:** `rawResponse` repeats the same proposal titles, file paths, requirement IDs, issues, and suggestions already represented in `success.proposals`.  
**Suggestion:** Drop `rawResponse` from successful structured review artifacts, or derive it from `success.proposals` at render time.
**Rationale:** Loop review proposal.

### 99. 3. Remove duplicated proposal payloads
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/review-history/work-units/impl-review/daa1ec06b7749cf79bff0b16.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/review-history/work-units/impl-review/daa1ec06b7749cf79bff0b16.json`  
**Requirement:** R8  
**Issue:** The same review proposals are duplicated in both `rawResponse` and `success.proposals`, including repeated file and requirement metadata.  
**Suggestion:** Use `success.proposals` as the single source of truth and avoid storing the Markdown copy unless the raw provider output is explicitly needed.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/review-history/work-units/impl-review/daa1ec06b7749cf79bff0b16.json`  
**Requirement:** R8  
**Issue:** The same review proposals are duplicated in both `rawResponse` and `success.proposals`, including repeated file and requirement metadata.  
**Suggestion:** Use `success.proposals` as the single source of truth and avoid storing the Markdown copy unless the raw provider output is explicitly needed.
**Rationale:** Loop review proposal.

### 100. 4. Avoid repeating target file lists inside work-unit identity
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/review-history/work-units/impl-review/daa1ec06b7749cf79bff0b16.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/review-history/work-units/impl-review/daa1ec06b7749cf79bff0b16.json`  
**Requirement:** R8  
**Issue:** `targetFiles` appears both at the top level and inside `identity.targetFiles` with identical content. The same duplication also applies to fields like `inputHash`, `providerIdentity`, `promptVersion`, `schemaVersion`, and `unitId`.  
**Suggestion:** Keep immutable identity fields under `identity` and remove the duplicated top-level copies, or keep top-level fields and reduce `identity` to only fields that are not otherwise represented.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/review-history/work-units/impl-review/daa1ec06b7749cf79bff0b16.json`  
**Requirement:** R8  
**Issue:** `targetFiles` appears both at the top level and inside `identity.targetFiles` with identical content. The same duplication also applies to fields like `inputHash`, `providerIdentity`, `promptVersion`, `schemaVersion`, and `unitId`.  
**Suggestion:** Keep immutable identity fields under `identity` and remove the duplicated top-level copies, or keep top-level fields and reduce `identity` to only fields that are not otherwise represented.
**Rationale:** Loop review proposal.

### 101. 5. Centralize repeated scenario command data
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/scenario-validity-result.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/scenario-validity-result.json`  
**Requirement:** R8  
**Issue:** The full test command is stored once at the top level and repeated in every `summary[].evidence.command`. This is noisy and risks inconsistency if one entry is updated independently.  
**Suggestion:** Keep the command only at the top level, and let each evidence entry reference the shared command implicitly or by a short command ID.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/scenario-validity-result.json`  
**Requirement:** R8  
**Issue:** The full test command is stored once at the top level and repeated in every `summary[].evidence.command`. This is noisy and risks inconsistency if one entry is updated independently.  
**Suggestion:** Keep the command only at the top level, and let each evidence entry reference the shared command implicitly or by a short command ID.
**Rationale:** Loop review proposal.

### 102. 6. Deduplicate gate observations
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/spec-gate-source.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/spec-gate-source.json`  
**Requirement:** R8  
**Issue:** Each guardrail observation is duplicated under both `evaluations[].observations` and the top-level `observations` array. The repeated objects are identical, so updates can drift.  
**Suggestion:** Store observations once, preferably under `evaluations`, and generate the flattened top-level view only when needed by consumers.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/spec-gate-source.json`  
**Requirement:** R8  
**Issue:** Each guardrail observation is duplicated under both `evaluations[].observations` and the top-level `observations` array. The repeated objects are identical, so updates can drift.  
**Suggestion:** Store observations once, preferably under `evaluations`, and generate the flattened top-level view only when needed by consumers.
**Rationale:** Loop review proposal.

### 103. 1. Normalize Test File Paths
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/test-coverage.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/test-coverage.json`  
**Requirement:** R8  
**Issue:** `requirements[].files` and `files[].file` use `tests/render-contract.test.js`, while `test-execute-result.json` uses the full spec-local path `specs/318-explicit-task-render-context/tests/render-contract.test.js`. This inconsistency makes artifact comparison and tooling harder.  
**Suggestion:** Use one canonical path format across artifacts, preferably the full repo-relative spec-local path.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/test-coverage.json`  
**Requirement:** R8  
**Issue:** `requirements[].files` and `files[].file` use `tests/render-contract.test.js`, while `test-execute-result.json` uses the full spec-local path `specs/318-explicit-task-render-context/tests/render-contract.test.js`. This inconsistency makes artifact comparison and tooling harder.  
**Suggestion:** Use one canonical path format across artifacts, preferably the full repo-relative spec-local path.
**Rationale:** Loop review proposal.

### 104. 2. Remove Ambiguous AC References
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/tasks/T-4.md
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/tasks/T-4.md`  
**Requirement:** R8  
**Issue:** The acceptance criterion says `AC1-AC7`, but this task file does not define AC-numbered criteria. The surrounding spec appears to track requirements as `R1-R8`, so this naming is inconsistent.  
**Suggestion:** Replace `AC1-AC7` with the specific requirement range or behavior names it means, such as `R1-R7`, unless separate AC IDs exist elsewhere.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/tasks/T-4.md`  
**Requirement:** R8  
**Issue:** The acceptance criterion says `AC1-AC7`, but this task file does not define AC-numbered criteria. The surrounding spec appears to track requirements as `R1-R8`, so this naming is inconsistent.  
**Suggestion:** Replace `AC1-AC7` with the specific requirement range or behavior names it means, such as `R1-R7`, unless separate AC IDs exist elsewhere.
**Rationale:** Loop review proposal.

### 105. 3. Factor Repeated Execution Evidence
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/test-execute-result.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/test-execute-result.json`  
**Requirement:** R8  
**Issue:** Each summary entry repeats the same `command` and identical `raw_output_lines` range. This creates noisy duplication and increases the chance of drift if the command or log range changes.  
**Suggestion:** If the artifact contract allows it, move shared execution metadata to a top-level field and keep per-requirement entries focused on `id`, `result`, `test_file`, and `test_name`.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/test-execute-result.json`  
**Requirement:** R8  
**Issue:** Each summary entry repeats the same `command` and identical `raw_output_lines` range. This creates noisy duplication and increases the chance of drift if the command or log range changes.  
**Suggestion:** If the artifact contract allows it, move shared execution metadata to a top-level field and keep per-requirement entries focused on `id`, `result`, `test_file`, and `test_name`.
**Rationale:** Loop review proposal.

### 106. 2. Remove Ambiguous AC References
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/tasks/T-4.md
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/tasks/T-4.md`  
**Requirement:** R8  
**Issue:** The acceptance criterion says `AC1-AC7`, but this task file does not define AC-numbered criteria. The surrounding spec appears to track requirements as `R1-R8`, so this naming is inconsistent.  
**Suggestion:** Replace `AC1-AC7` with the specific requirement range or behavior names it means, such as `R1-R7`, unless separate AC IDs exist elsewhere.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/tasks/T-4.md`  
**Requirement:** R8  
**Issue:** The acceptance criterion says `AC1-AC7`, but this task file does not define AC-numbered criteria. The surrounding spec appears to track requirements as `R1-R8`, so this naming is inconsistent.  
**Suggestion:** Replace `AC1-AC7` with the specific requirement range or behavior names it means, such as `R1-R7`, unless separate AC IDs exist elsewhere.
**Rationale:** Loop review proposal.

### 107. 1. Normalize Test File Paths
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/test-coverage.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/test-coverage.json`  
**Requirement:** R8  
**Issue:** `requirements[].files` and `files[].file` use `tests/render-contract.test.js`, while `test-execute-result.json` uses the full spec-local path `specs/318-explicit-task-render-context/tests/render-contract.test.js`. This inconsistency makes artifact comparison and tooling harder.  
**Suggestion:** Use one canonical path format across artifacts, preferably the full repo-relative spec-local path.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/test-coverage.json`  
**Requirement:** R8  
**Issue:** `requirements[].files` and `files[].file` use `tests/render-contract.test.js`, while `test-execute-result.json` uses the full spec-local path `specs/318-explicit-task-render-context/tests/render-contract.test.js`. This inconsistency makes artifact comparison and tooling harder.  
**Suggestion:** Use one canonical path format across artifacts, preferably the full repo-relative spec-local path.
**Rationale:** Loop review proposal.

### 108. 3. Factor Repeated Execution Evidence
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/test-execute-result.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/test-execute-result.json`  
**Requirement:** R8  
**Issue:** Each summary entry repeats the same `command` and identical `raw_output_lines` range. This creates noisy duplication and increases the chance of drift if the command or log range changes.  
**Suggestion:** If the artifact contract allows it, move shared execution metadata to a top-level field and keep per-requirement entries focused on `id`, `result`, `test_file`, and `test_name`.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/test-execute-result.json`  
**Requirement:** R8  
**Issue:** Each summary entry repeats the same `command` and identical `raw_output_lines` range. This creates noisy duplication and increases the chance of drift if the command or log range changes.  
**Suggestion:** If the artifact contract allows it, move shared execution metadata to a top-level field and keep per-requirement entries focused on `id`, `result`, `test_file`, and `test_name`.
**Rationale:** Loop review proposal.

### 109. 1. Normalize Test File Paths
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/test-coverage.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/test-coverage.json`  
**Requirement:** R8  
**Issue:** `requirements[].files` and `files[].file` use `tests/render-contract.test.js`, while `test-execute-result.json` uses the full spec-local path `specs/318-explicit-task-render-context/tests/render-contract.test.js`. This inconsistency makes artifact comparison and tooling harder.  
**Suggestion:** Use one canonical path format across artifacts, preferably the full repo-relative spec-local path.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/test-coverage.json`  
**Requirement:** R8  
**Issue:** `requirements[].files` and `files[].file` use `tests/render-contract.test.js`, while `test-execute-result.json` uses the full spec-local path `specs/318-explicit-task-render-context/tests/render-contract.test.js`. This inconsistency makes artifact comparison and tooling harder.  
**Suggestion:** Use one canonical path format across artifacts, preferably the full repo-relative spec-local path.
**Rationale:** Loop review proposal.

### 110. 2. Remove Ambiguous AC References
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/tasks/T-4.md
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/tasks/T-4.md`  
**Requirement:** R8  
**Issue:** The acceptance criterion says `AC1-AC7`, but this task file does not define AC-numbered criteria. The surrounding spec appears to track requirements as `R1-R8`, so this naming is inconsistent.  
**Suggestion:** Replace `AC1-AC7` with the specific requirement range or behavior names it means, such as `R1-R7`, unless separate AC IDs exist elsewhere.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/tasks/T-4.md`  
**Requirement:** R8  
**Issue:** The acceptance criterion says `AC1-AC7`, but this task file does not define AC-numbered criteria. The surrounding spec appears to track requirements as `R1-R8`, so this naming is inconsistent.  
**Suggestion:** Replace `AC1-AC7` with the specific requirement range or behavior names it means, such as `R1-R7`, unless separate AC IDs exist elsewhere.
**Rationale:** Loop review proposal.

### 111. 3. Factor Repeated Execution Evidence
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/test-execute-result.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/test-execute-result.json`  
**Requirement:** R8  
**Issue:** Each summary entry repeats the same `command` and identical `raw_output_lines` range. This creates noisy duplication and increases the chance of drift if the command or log range changes.  
**Suggestion:** If the artifact contract allows it, move shared execution metadata to a top-level field and keep per-requirement entries focused on `id`, `result`, `test_file`, and `test_name`.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/test-execute-result.json`  
**Requirement:** R8  
**Issue:** Each summary entry repeats the same `command` and identical `raw_output_lines` range. This creates noisy duplication and increases the chance of drift if the command or log range changes.  
**Suggestion:** If the artifact contract allows it, move shared execution metadata to a top-level field and keep per-requirement entries focused on `id`, `result`, `test_file`, and `test_name`.
**Rationale:** Loop review proposal.

### 112. 1. Remove Stale Failing Raw Log
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/tests/.raw/scenario-validity.log
**Requirement:** R1
**Issue:** **File:** `specs/318-explicit-task-render-context/tests/.raw/scenario-validity.log`  
**Requirement:** R1  
**Issue:** This added raw log records 18 failing tests from a different worktree path (`issue-414-scenario-baseline-replay-r2`), while the reviewed test artifacts report `PASS`. Keeping a stale failure transcript alongside the passing execution log creates contradictory evidence and looks like dead/generated residue.  
**Suggestion:** Delete `scenario-validity.log` from this change set unless it is explicitly consumed by the review pipeline. If it must remain, regenerate it from the current worktree so it matches the passing test state.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/tests/.raw/scenario-validity.log`  
**Requirement:** R1  
**Issue:** This added raw log records 18 failing tests from a different worktree path (`issue-414-scenario-baseline-replay-r2`), while the reviewed test artifacts report `PASS`. Keeping a stale failure transcript alongside the passing execution log creates contradictory evidence and looks like dead/generated residue.  
**Suggestion:** Delete `scenario-validity.log` from this change set unless it is explicitly consumed by the review pipeline. If it must remain, regenerate it from the current worktree so it matches the passing test state.
**Rationale:** Loop review proposal.

### 113. 2. Avoid Duplicating Test Review State Across Markdown And JSON
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/test-review.md
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/test-review.md`  
**Requirement:** R8  
**Issue:** `test-review.md` repeats the same verdict, coverage artifact, and empty findings already represented structurally in `test-review.json`. This creates duplicate review state that can drift.  
**Suggestion:** Prefer the JSON artifact as the source of truth and either omit this Markdown mirror or generate it mechanically from `test-review.json` during the pipeline.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/test-review.md`  
**Requirement:** R8  
**Issue:** `test-review.md` repeats the same verdict, coverage artifact, and empty findings already represented structurally in `test-review.json`. This creates duplicate review state that can drift.  
**Suggestion:** Prefer the JSON artifact as the source of truth and either omit this Markdown mirror or generate it mechanically from `test-review.json` during the pipeline.
**Rationale:** Loop review proposal.

### 114. 3. Add Missing Final Newline
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/test-review.md
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/test-review.md`  
**Requirement:** R8  
**Issue:** The file is added without a trailing newline, which is inconsistent with normal text artifact formatting and can cause noisy future diffs.  
**Suggestion:** Add a final newline at EOF.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/test-review.md`  
**Requirement:** R8  
**Issue:** The file is added without a trailing newline, which is inconsistent with normal text artifact formatting and can cause noisy future diffs.  
**Suggestion:** Add a final newline at EOF.
**Rationale:** Loop review proposal.

### 115. 1. Remove Stale Failing Raw Log
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/tests/.raw/scenario-validity.log
**Requirement:** R1
**Issue:** **File:** `specs/318-explicit-task-render-context/tests/.raw/scenario-validity.log`  
**Requirement:** R1  
**Issue:** This added raw log records 18 failing tests from a different worktree path (`issue-414-scenario-baseline-replay-r2`), while the reviewed test artifacts report `PASS`. Keeping a stale failure transcript alongside the passing execution log creates contradictory evidence and looks like dead/generated residue.  
**Suggestion:** Delete `scenario-validity.log` from this change set unless it is explicitly consumed by the review pipeline. If it must remain, regenerate it from the current worktree so it matches the passing test state.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/tests/.raw/scenario-validity.log`  
**Requirement:** R1  
**Issue:** This added raw log records 18 failing tests from a different worktree path (`issue-414-scenario-baseline-replay-r2`), while the reviewed test artifacts report `PASS`. Keeping a stale failure transcript alongside the passing execution log creates contradictory evidence and looks like dead/generated residue.  
**Suggestion:** Delete `scenario-validity.log` from this change set unless it is explicitly consumed by the review pipeline. If it must remain, regenerate it from the current worktree so it matches the passing test state.
**Rationale:** Loop review proposal.

### 116. 2. Avoid Duplicating Test Review State Across Markdown And JSON
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/test-review.md
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/test-review.md`  
**Requirement:** R8  
**Issue:** `test-review.md` repeats the same verdict, coverage artifact, and empty findings already represented structurally in `test-review.json`. This creates duplicate review state that can drift.  
**Suggestion:** Prefer the JSON artifact as the source of truth and either omit this Markdown mirror or generate it mechanically from `test-review.json` during the pipeline.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/test-review.md`  
**Requirement:** R8  
**Issue:** `test-review.md` repeats the same verdict, coverage artifact, and empty findings already represented structurally in `test-review.json`. This creates duplicate review state that can drift.  
**Suggestion:** Prefer the JSON artifact as the source of truth and either omit this Markdown mirror or generate it mechanically from `test-review.json` during the pipeline.
**Rationale:** Loop review proposal.

### 117. 3. Add Missing Final Newline
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/test-review.md
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/test-review.md`  
**Requirement:** R8  
**Issue:** The file is added without a trailing newline, which is inconsistent with normal text artifact formatting and can cause noisy future diffs.  
**Suggestion:** Add a final newline at EOF.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/test-review.md`  
**Requirement:** R8  
**Issue:** The file is added without a trailing newline, which is inconsistent with normal text artifact formatting and can cause noisy future diffs.  
**Suggestion:** Add a final newline at EOF.
**Rationale:** Loop review proposal.

### 118. 2. Avoid Duplicating Test Review State Across Markdown And JSON
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/test-review.md
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/test-review.md`  
**Requirement:** R8  
**Issue:** `test-review.md` repeats the same verdict, coverage artifact, and empty findings already represented structurally in `test-review.json`. This creates duplicate review state that can drift.  
**Suggestion:** Prefer the JSON artifact as the source of truth and either omit this Markdown mirror or generate it mechanically from `test-review.json` during the pipeline.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/test-review.md`  
**Requirement:** R8  
**Issue:** `test-review.md` repeats the same verdict, coverage artifact, and empty findings already represented structurally in `test-review.json`. This creates duplicate review state that can drift.  
**Suggestion:** Prefer the JSON artifact as the source of truth and either omit this Markdown mirror or generate it mechanically from `test-review.json` during the pipeline.
**Rationale:** Loop review proposal.

### 119. 3. Add Missing Final Newline
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/test-review.md
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/test-review.md`  
**Requirement:** R8  
**Issue:** The file is added without a trailing newline, which is inconsistent with normal text artifact formatting and can cause noisy future diffs.  
**Suggestion:** Add a final newline at EOF.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/test-review.md`  
**Requirement:** R8  
**Issue:** The file is added without a trailing newline, which is inconsistent with normal text artifact formatting and can cause noisy future diffs.  
**Suggestion:** Add a final newline at EOF.
**Rationale:** Loop review proposal.

### 120. 1. Remove Stale Failing Raw Log
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/tests/.raw/scenario-validity.log
**Requirement:** R1
**Issue:** **File:** `specs/318-explicit-task-render-context/tests/.raw/scenario-validity.log`  
**Requirement:** R1  
**Issue:** This added raw log records 18 failing tests from a different worktree path (`issue-414-scenario-baseline-replay-r2`), while the reviewed test artifacts report `PASS`. Keeping a stale failure transcript alongside the passing execution log creates contradictory evidence and looks like dead/generated residue.  
**Suggestion:** Delete `scenario-validity.log` from this change set unless it is explicitly consumed by the review pipeline. If it must remain, regenerate it from the current worktree so it matches the passing test state.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/tests/.raw/scenario-validity.log`  
**Requirement:** R1  
**Issue:** This added raw log records 18 failing tests from a different worktree path (`issue-414-scenario-baseline-replay-r2`), while the reviewed test artifacts report `PASS`. Keeping a stale failure transcript alongside the passing execution log creates contradictory evidence and looks like dead/generated residue.  
**Suggestion:** Delete `scenario-validity.log` from this change set unless it is explicitly consumed by the review pipeline. If it must remain, regenerate it from the current worktree so it matches the passing test state.
**Rationale:** Loop review proposal.

### 121. 1. Remove Stale Failing Raw Log
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/tests/.raw/scenario-validity.log
**Requirement:** R1
**Issue:** **File:** `specs/318-explicit-task-render-context/tests/.raw/scenario-validity.log`  
**Requirement:** R1  
**Issue:** This added raw log records 18 failing tests from a different worktree path (`issue-414-scenario-baseline-replay-r2`), while the reviewed test artifacts report `PASS`. Keeping a stale failure transcript alongside the passing execution log creates contradictory evidence and looks like dead/generated residue.  
**Suggestion:** Delete `scenario-validity.log` from this change set unless it is explicitly consumed by the review pipeline. If it must remain, regenerate it from the current worktree so it matches the passing test state.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/tests/.raw/scenario-validity.log`  
**Requirement:** R1  
**Issue:** This added raw log records 18 failing tests from a different worktree path (`issue-414-scenario-baseline-replay-r2`), while the reviewed test artifacts report `PASS`. Keeping a stale failure transcript alongside the passing execution log creates contradictory evidence and looks like dead/generated residue.  
**Suggestion:** Delete `scenario-validity.log` from this change set unless it is explicitly consumed by the review pipeline. If it must remain, regenerate it from the current worktree so it matches the passing test state.
**Rationale:** Loop review proposal.

### 122. 2. Avoid Duplicating Test Review State Across Markdown And JSON
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/test-review.md
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/test-review.md`  
**Requirement:** R8  
**Issue:** `test-review.md` repeats the same verdict, coverage artifact, and empty findings already represented structurally in `test-review.json`. This creates duplicate review state that can drift.  
**Suggestion:** Prefer the JSON artifact as the source of truth and either omit this Markdown mirror or generate it mechanically from `test-review.json` during the pipeline.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/test-review.md`  
**Requirement:** R8  
**Issue:** `test-review.md` repeats the same verdict, coverage artifact, and empty findings already represented structurally in `test-review.json`. This creates duplicate review state that can drift.  
**Suggestion:** Prefer the JSON artifact as the source of truth and either omit this Markdown mirror or generate it mechanically from `test-review.json` during the pipeline.
**Rationale:** Loop review proposal.

### 123. 3. Add Missing Final Newline
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/test-review.md
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/test-review.md`  
**Requirement:** R8  
**Issue:** The file is added without a trailing newline, which is inconsistent with normal text artifact formatting and can cause noisy future diffs.  
**Suggestion:** Add a final newline at EOF.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/test-review.md`  
**Requirement:** R8  
**Issue:** The file is added without a trailing newline, which is inconsistent with normal text artifact formatting and can cause noisy future diffs.  
**Suggestion:** Add a final newline at EOF.
**Rationale:** Loop review proposal.

### 124. I’ll review only the touched files in the supplied diff and focus on maintainability/style issues plus the bounded-resource guardrail. Since this is a diff-only review, I won’t inspect unrelated code paths.### 1. Extract Repeated Snapshot Assertions
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/tests/render-contract.test.js
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/tests/render-contract.test.js`  
**Requirement:** R8  
**Issue:** Several tests repeat the same setup pattern: create existing generated/orphan/output files, snapshot byte contents and directory entries, run a rejection path, then assert byte-for-byte preservation. This duplication makes future contract changes harder to apply consistently.  
**Suggestion:** Add small helpers such as `snapshotFiles(paths)`, `assertFilesUnchanged(snapshot)`, and `assertDirectoryEntriesUnchanged(dir, beforeNames)`, then reuse them in the CLI rejection and internal view rejection tests.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/tests/render-contract.test.js`  
**Requirement:** R8  
**Issue:** Several tests repeat the same setup pattern: create existing generated/orphan/output files, snapshot byte contents and directory entries, run a rejection path, then assert byte-for-byte preservation. This duplication makes future contract changes harder to apply consistently.  
**Suggestion:** Add small helpers such as `snapshotFiles(paths)`, `assertFilesUnchanged(snapshot)`, and `assertDirectoryEntriesUnchanged(dir, beforeNames)`, then reuse them in the CLI rejection and internal view rejection tests.
**Rationale:** Loop review proposal.

### 125. 2. Remove Obsolete `state` Option From Test Calls
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/tests/render-contract.test.js
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/tests/render-contract.test.js`  
**Requirement:** R8  
**Issue:** `renderSpecView` no longer consumes `state`, but some tests still pass `state: null` or a foreign `state` object. That obscures the new contract that render metadata comes from colocated `flow.json` through `SpecRenderContext`, not from caller-supplied ambient state.  
**Suggestion:** Drop the unused `state` properties from test calls, or add one focused compatibility test if retaining ignored `state` is intentional.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/tests/render-contract.test.js`  
**Requirement:** R8  
**Issue:** `renderSpecView` no longer consumes `state`, but some tests still pass `state: null` or a foreign `state` object. That obscures the new contract that render metadata comes from colocated `flow.json` through `SpecRenderContext`, not from caller-supplied ambient state.  
**Suggestion:** Drop the unused `state` properties from test calls, or add one focused compatibility test if retaining ignored `state` is intentional.
**Rationale:** Loop review proposal.

### 126. 5. Avoid Recomputing Render Metadata Through Multiple `toRenderMeta()` Calls
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/tests/render-contract.test.js
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/tests/render-contract.test.js`  
**Requirement:** R8  
**Issue:** The `SpecRenderContext` test repeatedly calls `toRenderMeta()` on the same context. If the implementation ever stops returning a cached immutable value, the test could become noisy or subtly time-dependent because metadata includes filesystem-derived dates.  
**Suggestion:** Store each metadata result once, for example `const absentMeta = absentContext.toRenderMeta();`, and assert against that object. This also improves readability.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/tests/render-contract.test.js`  
**Requirement:** R8  
**Issue:** The `SpecRenderContext` test repeatedly calls `toRenderMeta()` on the same context. If the implementation ever stops returning a cached immutable value, the test could become noisy or subtly time-dependent because metadata includes filesystem-derived dates.  
**Suggestion:** Store each metadata result once, for example `const absentMeta = absentContext.toRenderMeta();`, and assert against that object. This also improves readability.
**Rationale:** Loop review proposal.

### 127. I’ll review only the touched files in the supplied diff and focus on maintainability/style issues plus the bounded-resource guardrail. Since this is a diff-only review, I won’t inspect unrelated code paths.### 1. Extract Repeated Snapshot Assertions
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/tests/render-contract.test.js
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/tests/render-contract.test.js`  
**Requirement:** R8  
**Issue:** Several tests repeat the same setup pattern: create existing generated/orphan/output files, snapshot byte contents and directory entries, run a rejection path, then assert byte-for-byte preservation. This duplication makes future contract changes harder to apply consistently.  
**Suggestion:** Add small helpers such as `snapshotFiles(paths)`, `assertFilesUnchanged(snapshot)`, and `assertDirectoryEntriesUnchanged(dir, beforeNames)`, then reuse them in the CLI rejection and internal view rejection tests.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/tests/render-contract.test.js`  
**Requirement:** R8  
**Issue:** Several tests repeat the same setup pattern: create existing generated/orphan/output files, snapshot byte contents and directory entries, run a rejection path, then assert byte-for-byte preservation. This duplication makes future contract changes harder to apply consistently.  
**Suggestion:** Add small helpers such as `snapshotFiles(paths)`, `assertFilesUnchanged(snapshot)`, and `assertDirectoryEntriesUnchanged(dir, beforeNames)`, then reuse them in the CLI rejection and internal view rejection tests.
**Rationale:** Loop review proposal.

### 128. 2. Remove Obsolete `state` Option From Test Calls
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/tests/render-contract.test.js
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/tests/render-contract.test.js`  
**Requirement:** R8  
**Issue:** `renderSpecView` no longer consumes `state`, but some tests still pass `state: null` or a foreign `state` object. That obscures the new contract that render metadata comes from colocated `flow.json` through `SpecRenderContext`, not from caller-supplied ambient state.  
**Suggestion:** Drop the unused `state` properties from test calls, or add one focused compatibility test if retaining ignored `state` is intentional.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/tests/render-contract.test.js`  
**Requirement:** R8  
**Issue:** `renderSpecView` no longer consumes `state`, but some tests still pass `state: null` or a foreign `state` object. That obscures the new contract that render metadata comes from colocated `flow.json` through `SpecRenderContext`, not from caller-supplied ambient state.  
**Suggestion:** Drop the unused `state` properties from test calls, or add one focused compatibility test if retaining ignored `state` is intentional.
**Rationale:** Loop review proposal.

### 129. 3. Centralize Plan-Then-Persist-Then-Apply Flow
**Failure mode:** refactor
**File:** src/flow/lib/render-spec-view.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/render-spec-view.js`  
**Requirement:** R7  
**Issue:** `run-update-overview.js` and `set-approval.js` now both implement the same sequence manually: build render plan, save `spec.json`, apply render plan. This creates a design pattern that callers must remember and duplicate.  
**Suggestion:** Add an exported helper in `render-spec-view.js`, for example `renderPlannedSpecViewAfterSave({ root, specPath, spec, save })`, or a clearer two-step helper name matching the project style. Then both callers can use one shared flow.
**Suggestion:** **File:** `src/flow/lib/render-spec-view.js`  
**Requirement:** R7  
**Issue:** `run-update-overview.js` and `set-approval.js` now both implement the same sequence manually: build render plan, save `spec.json`, apply render plan. This creates a design pattern that callers must remember and duplicate.  
**Suggestion:** Add an exported helper in `render-spec-view.js`, for example `renderPlannedSpecViewAfterSave({ root, specPath, spec, save })`, or a clearer two-step helper name matching the project style. Then both callers can use one shared flow.
**Rationale:** Loop review proposal.

### 130. 4. Rename `MissingSpecViewRenderPlan`
**Failure mode:** refactor
**File:** src/flow/lib/render-spec-view.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/render-spec-view.js`  
**Requirement:** R7  
**Issue:** `MissingSpecViewRenderPlan` sounds like an absent plan, but it is actually a completed no-op plan for the optional-missing case. That makes the `applySpecViewPlan` type check slightly misleading.  
**Suggestion:** Rename it to something like `NoopSpecViewRenderPlan` or `OptionalMissingSpecViewPlan` to reflect that it intentionally applies to `{ rendered: false }`.
**Suggestion:** **File:** `src/flow/lib/render-spec-view.js`  
**Requirement:** R7  
**Issue:** `MissingSpecViewRenderPlan` sounds like an absent plan, but it is actually a completed no-op plan for the optional-missing case. That makes the `applySpecViewPlan` type check slightly misleading.  
**Suggestion:** Rename it to something like `NoopSpecViewRenderPlan` or `OptionalMissingSpecViewPlan` to reflect that it intentionally applies to `{ rendered: false }`.
**Rationale:** Loop review proposal.

### 131. 5. Avoid Recomputing Render Metadata Through Multiple `toRenderMeta()` Calls
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/tests/render-contract.test.js
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/tests/render-contract.test.js`  
**Requirement:** R8  
**Issue:** The `SpecRenderContext` test repeatedly calls `toRenderMeta()` on the same context. If the implementation ever stops returning a cached immutable value, the test could become noisy or subtly time-dependent because metadata includes filesystem-derived dates.  
**Suggestion:** Store each metadata result once, for example `const absentMeta = absentContext.toRenderMeta();`, and assert against that object. This also improves readability.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/tests/render-contract.test.js`  
**Requirement:** R8  
**Issue:** The `SpecRenderContext` test repeatedly calls `toRenderMeta()` on the same context. If the implementation ever stops returning a cached immutable value, the test could become noisy or subtly time-dependent because metadata includes filesystem-derived dates.  
**Suggestion:** Store each metadata result once, for example `const absentMeta = absentContext.toRenderMeta();`, and assert against that object. This also improves readability.
**Rationale:** Loop review proposal.

### 132. 3. Centralize Plan-Then-Persist-Then-Apply Flow
**Failure mode:** refactor
**File:** src/flow/lib/render-spec-view.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/render-spec-view.js`  
**Requirement:** R7  
**Issue:** `run-update-overview.js` and `set-approval.js` now both implement the same sequence manually: build render plan, save `spec.json`, apply render plan. This creates a design pattern that callers must remember and duplicate.  
**Suggestion:** Add an exported helper in `render-spec-view.js`, for example `renderPlannedSpecViewAfterSave({ root, specPath, spec, save })`, or a clearer two-step helper name matching the project style. Then both callers can use one shared flow.
**Suggestion:** **File:** `src/flow/lib/render-spec-view.js`  
**Requirement:** R7  
**Issue:** `run-update-overview.js` and `set-approval.js` now both implement the same sequence manually: build render plan, save `spec.json`, apply render plan. This creates a design pattern that callers must remember and duplicate.  
**Suggestion:** Add an exported helper in `render-spec-view.js`, for example `renderPlannedSpecViewAfterSave({ root, specPath, spec, save })`, or a clearer two-step helper name matching the project style. Then both callers can use one shared flow.
**Rationale:** Loop review proposal.

### 133. 4. Rename `MissingSpecViewRenderPlan`
**Failure mode:** refactor
**File:** src/flow/lib/render-spec-view.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/render-spec-view.js`  
**Requirement:** R7  
**Issue:** `MissingSpecViewRenderPlan` sounds like an absent plan, but it is actually a completed no-op plan for the optional-missing case. That makes the `applySpecViewPlan` type check slightly misleading.  
**Suggestion:** Rename it to something like `NoopSpecViewRenderPlan` or `OptionalMissingSpecViewPlan` to reflect that it intentionally applies to `{ rendered: false }`.
**Suggestion:** **File:** `src/flow/lib/render-spec-view.js`  
**Requirement:** R7  
**Issue:** `MissingSpecViewRenderPlan` sounds like an absent plan, but it is actually a completed no-op plan for the optional-missing case. That makes the `applySpecViewPlan` type check slightly misleading.  
**Suggestion:** Rename it to something like `NoopSpecViewRenderPlan` or `OptionalMissingSpecViewPlan` to reflect that it intentionally applies to `{ rendered: false }`.
**Rationale:** Loop review proposal.

### 134. I’ll review only the touched files in the supplied diff and focus on maintainability/style issues plus the bounded-resource guardrail. Since this is a diff-only review, I won’t inspect unrelated code paths.### 1. Extract Repeated Snapshot Assertions
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/tests/render-contract.test.js
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/tests/render-contract.test.js`  
**Requirement:** R8  
**Issue:** Several tests repeat the same setup pattern: create existing generated/orphan/output files, snapshot byte contents and directory entries, run a rejection path, then assert byte-for-byte preservation. This duplication makes future contract changes harder to apply consistently.  
**Suggestion:** Add small helpers such as `snapshotFiles(paths)`, `assertFilesUnchanged(snapshot)`, and `assertDirectoryEntriesUnchanged(dir, beforeNames)`, then reuse them in the CLI rejection and internal view rejection tests.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/tests/render-contract.test.js`  
**Requirement:** R8  
**Issue:** Several tests repeat the same setup pattern: create existing generated/orphan/output files, snapshot byte contents and directory entries, run a rejection path, then assert byte-for-byte preservation. This duplication makes future contract changes harder to apply consistently.  
**Suggestion:** Add small helpers such as `snapshotFiles(paths)`, `assertFilesUnchanged(snapshot)`, and `assertDirectoryEntriesUnchanged(dir, beforeNames)`, then reuse them in the CLI rejection and internal view rejection tests.
**Rationale:** Loop review proposal.

### 135. 2. Remove Obsolete `state` Option From Test Calls
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/tests/render-contract.test.js
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/tests/render-contract.test.js`  
**Requirement:** R8  
**Issue:** `renderSpecView` no longer consumes `state`, but some tests still pass `state: null` or a foreign `state` object. That obscures the new contract that render metadata comes from colocated `flow.json` through `SpecRenderContext`, not from caller-supplied ambient state.  
**Suggestion:** Drop the unused `state` properties from test calls, or add one focused compatibility test if retaining ignored `state` is intentional.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/tests/render-contract.test.js`  
**Requirement:** R8  
**Issue:** `renderSpecView` no longer consumes `state`, but some tests still pass `state: null` or a foreign `state` object. That obscures the new contract that render metadata comes from colocated `flow.json` through `SpecRenderContext`, not from caller-supplied ambient state.  
**Suggestion:** Drop the unused `state` properties from test calls, or add one focused compatibility test if retaining ignored `state` is intentional.
**Rationale:** Loop review proposal.

### 136. 3. Centralize Plan-Then-Persist-Then-Apply Flow
**Failure mode:** refactor
**File:** src/flow/lib/render-spec-view.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/render-spec-view.js`  
**Requirement:** R7  
**Issue:** `run-update-overview.js` and `set-approval.js` now both implement the same sequence manually: build render plan, save `spec.json`, apply render plan. This creates a design pattern that callers must remember and duplicate.  
**Suggestion:** Add an exported helper in `render-spec-view.js`, for example `renderPlannedSpecViewAfterSave({ root, specPath, spec, save })`, or a clearer two-step helper name matching the project style. Then both callers can use one shared flow.
**Suggestion:** **File:** `src/flow/lib/render-spec-view.js`  
**Requirement:** R7  
**Issue:** `run-update-overview.js` and `set-approval.js` now both implement the same sequence manually: build render plan, save `spec.json`, apply render plan. This creates a design pattern that callers must remember and duplicate.  
**Suggestion:** Add an exported helper in `render-spec-view.js`, for example `renderPlannedSpecViewAfterSave({ root, specPath, spec, save })`, or a clearer two-step helper name matching the project style. Then both callers can use one shared flow.
**Rationale:** Loop review proposal.

### 137. 4. Rename `MissingSpecViewRenderPlan`
**Failure mode:** refactor
**File:** src/flow/lib/render-spec-view.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/render-spec-view.js`  
**Requirement:** R7  
**Issue:** `MissingSpecViewRenderPlan` sounds like an absent plan, but it is actually a completed no-op plan for the optional-missing case. That makes the `applySpecViewPlan` type check slightly misleading.  
**Suggestion:** Rename it to something like `NoopSpecViewRenderPlan` or `OptionalMissingSpecViewPlan` to reflect that it intentionally applies to `{ rendered: false }`.
**Suggestion:** **File:** `src/flow/lib/render-spec-view.js`  
**Requirement:** R7  
**Issue:** `MissingSpecViewRenderPlan` sounds like an absent plan, but it is actually a completed no-op plan for the optional-missing case. That makes the `applySpecViewPlan` type check slightly misleading.  
**Suggestion:** Rename it to something like `NoopSpecViewRenderPlan` or `OptionalMissingSpecViewPlan` to reflect that it intentionally applies to `{ rendered: false }`.
**Rationale:** Loop review proposal.

### 138. 5. Avoid Recomputing Render Metadata Through Multiple `toRenderMeta()` Calls
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/tests/render-contract.test.js
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/tests/render-contract.test.js`  
**Requirement:** R8  
**Issue:** The `SpecRenderContext` test repeatedly calls `toRenderMeta()` on the same context. If the implementation ever stops returning a cached immutable value, the test could become noisy or subtly time-dependent because metadata includes filesystem-derived dates.  
**Suggestion:** Store each metadata result once, for example `const absentMeta = absentContext.toRenderMeta();`, and assert against that object. This also improves readability.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/tests/render-contract.test.js`  
**Requirement:** R8  
**Issue:** The `SpecRenderContext` test repeatedly calls `toRenderMeta()` on the same context. If the implementation ever stops returning a cached immutable value, the test could become noisy or subtly time-dependent because metadata includes filesystem-derived dates.  
**Suggestion:** Store each metadata result once, for example `const absentMeta = absentContext.toRenderMeta();`, and assert against that object. This also improves readability.
**Rationale:** Loop review proposal.

### 139. I’ll review only the touched files in the supplied diff and focus on maintainability/style issues plus the bounded-resource guardrail. Since this is a diff-only review, I won’t inspect unrelated code paths.### 1. Extract Repeated Snapshot Assertions
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/tests/render-contract.test.js
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/tests/render-contract.test.js`  
**Requirement:** R8  
**Issue:** Several tests repeat the same setup pattern: create existing generated/orphan/output files, snapshot byte contents and directory entries, run a rejection path, then assert byte-for-byte preservation. This duplication makes future contract changes harder to apply consistently.  
**Suggestion:** Add small helpers such as `snapshotFiles(paths)`, `assertFilesUnchanged(snapshot)`, and `assertDirectoryEntriesUnchanged(dir, beforeNames)`, then reuse them in the CLI rejection and internal view rejection tests.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/tests/render-contract.test.js`  
**Requirement:** R8  
**Issue:** Several tests repeat the same setup pattern: create existing generated/orphan/output files, snapshot byte contents and directory entries, run a rejection path, then assert byte-for-byte preservation. This duplication makes future contract changes harder to apply consistently.  
**Suggestion:** Add small helpers such as `snapshotFiles(paths)`, `assertFilesUnchanged(snapshot)`, and `assertDirectoryEntriesUnchanged(dir, beforeNames)`, then reuse them in the CLI rejection and internal view rejection tests.
**Rationale:** Loop review proposal.

### 140. 2. Remove Obsolete `state` Option From Test Calls
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/tests/render-contract.test.js
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/tests/render-contract.test.js`  
**Requirement:** R8  
**Issue:** `renderSpecView` no longer consumes `state`, but some tests still pass `state: null` or a foreign `state` object. That obscures the new contract that render metadata comes from colocated `flow.json` through `SpecRenderContext`, not from caller-supplied ambient state.  
**Suggestion:** Drop the unused `state` properties from test calls, or add one focused compatibility test if retaining ignored `state` is intentional.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/tests/render-contract.test.js`  
**Requirement:** R8  
**Issue:** `renderSpecView` no longer consumes `state`, but some tests still pass `state: null` or a foreign `state` object. That obscures the new contract that render metadata comes from colocated `flow.json` through `SpecRenderContext`, not from caller-supplied ambient state.  
**Suggestion:** Drop the unused `state` properties from test calls, or add one focused compatibility test if retaining ignored `state` is intentional.
**Rationale:** Loop review proposal.

### 141. 3. Centralize Plan-Then-Persist-Then-Apply Flow
**Failure mode:** refactor
**File:** src/flow/lib/render-spec-view.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/render-spec-view.js`  
**Requirement:** R7  
**Issue:** `run-update-overview.js` and `set-approval.js` now both implement the same sequence manually: build render plan, save `spec.json`, apply render plan. This creates a design pattern that callers must remember and duplicate.  
**Suggestion:** Add an exported helper in `render-spec-view.js`, for example `renderPlannedSpecViewAfterSave({ root, specPath, spec, save })`, or a clearer two-step helper name matching the project style. Then both callers can use one shared flow.
**Suggestion:** **File:** `src/flow/lib/render-spec-view.js`  
**Requirement:** R7  
**Issue:** `run-update-overview.js` and `set-approval.js` now both implement the same sequence manually: build render plan, save `spec.json`, apply render plan. This creates a design pattern that callers must remember and duplicate.  
**Suggestion:** Add an exported helper in `render-spec-view.js`, for example `renderPlannedSpecViewAfterSave({ root, specPath, spec, save })`, or a clearer two-step helper name matching the project style. Then both callers can use one shared flow.
**Rationale:** Loop review proposal.

### 142. 4. Rename `MissingSpecViewRenderPlan`
**Failure mode:** refactor
**File:** src/flow/lib/render-spec-view.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/render-spec-view.js`  
**Requirement:** R7  
**Issue:** `MissingSpecViewRenderPlan` sounds like an absent plan, but it is actually a completed no-op plan for the optional-missing case. That makes the `applySpecViewPlan` type check slightly misleading.  
**Suggestion:** Rename it to something like `NoopSpecViewRenderPlan` or `OptionalMissingSpecViewPlan` to reflect that it intentionally applies to `{ rendered: false }`.
**Suggestion:** **File:** `src/flow/lib/render-spec-view.js`  
**Requirement:** R7  
**Issue:** `MissingSpecViewRenderPlan` sounds like an absent plan, but it is actually a completed no-op plan for the optional-missing case. That makes the `applySpecViewPlan` type check slightly misleading.  
**Suggestion:** Rename it to something like `NoopSpecViewRenderPlan` or `OptionalMissingSpecViewPlan` to reflect that it intentionally applies to `{ rendered: false }`.
**Rationale:** Loop review proposal.

### 143. 5. Avoid Recomputing Render Metadata Through Multiple `toRenderMeta()` Calls
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/tests/render-contract.test.js
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/tests/render-contract.test.js`  
**Requirement:** R8  
**Issue:** The `SpecRenderContext` test repeatedly calls `toRenderMeta()` on the same context. If the implementation ever stops returning a cached immutable value, the test could become noisy or subtly time-dependent because metadata includes filesystem-derived dates.  
**Suggestion:** Store each metadata result once, for example `const absentMeta = absentContext.toRenderMeta();`, and assert against that object. This also improves readability.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/tests/render-contract.test.js`  
**Requirement:** R8  
**Issue:** The `SpecRenderContext` test repeatedly calls `toRenderMeta()` on the same context. If the implementation ever stops returning a cached immutable value, the test could become noisy or subtly time-dependent because metadata includes filesystem-derived dates.  
**Suggestion:** Store each metadata result once, for example `const absentMeta = absentContext.toRenderMeta();`, and assert against that object. This also improves readability.
**Rationale:** Loop review proposal.

### 144. 2. Avoid Re-Copying Task Collections
**Failure mode:** refactor
**File:** src/flow/lib/sync-spec-tasks.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/sync-spec-tasks.js`  
**Requirement:** R6  
**Issue:** `newTasks = [...collection].filter(...)` materializes the whole collection before filtering. The collection is already bounded, but this adds avoidable allocation and weakens the “linear bounded entries” design style introduced by `TaskCollection`.  
**Suggestion:** Build `newTasks` with a simple loop over `collection`, pushing only missing IDs. This keeps the append plan explicitly O(n) without an intermediate full-array copy.
**Suggestion:** **File:** `src/flow/lib/sync-spec-tasks.js`  
**Requirement:** R6  
**Issue:** `newTasks = [...collection].filter(...)` materializes the whole collection before filtering. The collection is already bounded, but this adds avoidable allocation and weakens the “linear bounded entries” design style introduced by `TaskCollection`.  
**Suggestion:** Build `newTasks` with a simple loop over `collection`, pushing only missing IDs. This keeps the append plan explicitly O(n) without an intermediate full-array copy.
**Rationale:** Loop review proposal.

### 145. 1. Extract Shared Task ID Pattern Constant
**Failure mode:** refactor
**File:** src/spec/lib/render-contract.js
**Requirement:** R1
**Issue:** **File:** `src/spec/lib/render-contract.js`  
**Requirement:** R1  
**Issue:** The task ID regex exists here as `TASK_ID_PATTERN` and separately as a JSON Schema string in `src/flow/schemas/spec.schema.json`. That creates a drift risk for a requirement that says both must accept exactly the same language.  
**Suggestion:** Define a shared exported pattern string, for example `TASK_ID_PATTERN_SOURCE = "^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$"`, derive `TASK_ID_PATTERN` from it, and add a schema-generation or validation test that asserts the schema pattern matches the exported source.
**Suggestion:** **File:** `src/spec/lib/render-contract.js`  
**Requirement:** R1  
**Issue:** The task ID regex exists here as `TASK_ID_PATTERN` and separately as a JSON Schema string in `src/flow/schemas/spec.schema.json`. That creates a drift risk for a requirement that says both must accept exactly the same language.  
**Suggestion:** Define a shared exported pattern string, for example `TASK_ID_PATTERN_SOURCE = "^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$"`, derive `TASK_ID_PATTERN` from it, and add a schema-generation or validation test that asserts the schema pattern matches the exported source.
**Rationale:** Loop review proposal.

### 146. 2. Avoid Re-Copying Task Collections
**Failure mode:** refactor
**File:** src/flow/lib/sync-spec-tasks.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/sync-spec-tasks.js`  
**Requirement:** R6  
**Issue:** `newTasks = [...collection].filter(...)` materializes the whole collection before filtering. The collection is already bounded, but this adds avoidable allocation and weakens the “linear bounded entries” design style introduced by `TaskCollection`.  
**Suggestion:** Build `newTasks` with a simple loop over `collection`, pushing only missing IDs. This keeps the append plan explicitly O(n) without an intermediate full-array copy.
**Suggestion:** **File:** `src/flow/lib/sync-spec-tasks.js`  
**Requirement:** R6  
**Issue:** `newTasks = [...collection].filter(...)` materializes the whole collection before filtering. The collection is already bounded, but this adds avoidable allocation and weakens the “linear bounded entries” design style introduced by `TaskCollection`.  
**Suggestion:** Build `newTasks` with a simple loop over `collection`, pushing only missing IDs. This keeps the append plan explicitly O(n) without an intermediate full-array copy.
**Rationale:** Loop review proposal.

### 147. 3. Rename `ValidatedTask` To Reflect Spec Task Semantics
**Failure mode:** refactor
**File:** src/spec/lib/render-contract.js
**Requirement:** R2
**Issue:** **File:** `src/spec/lib/render-contract.js`  
**Requirement:** R2  
**Issue:** `ValidatedTask` is generic, but the object specifically represents a spec task whose `id` and `parent` fields have been converted to `TaskId` instances. The generic name makes later call sites less obvious, especially because render/sync code still calls values `task` or `specTask`.  
**Suggestion:** Rename it to something like `ValidatedSpecTask` or `TaskCollectionEntry` to clarify that it is the normalized entry type exposed by `TaskCollection`.
**Suggestion:** **File:** `src/spec/lib/render-contract.js`  
**Requirement:** R2  
**Issue:** `ValidatedTask` is generic, but the object specifically represents a spec task whose `id` and `parent` fields have been converted to `TaskId` instances. The generic name makes later call sites less obvious, especially because render/sync code still calls values `task` or `specTask`.  
**Suggestion:** Rename it to something like `ValidatedSpecTask` or `TaskCollectionEntry` to clarify that it is the normalized entry type exposed by `TaskCollection`.
**Rationale:** Loop review proposal.

### 148. 4. Simplify Pattern Validation Logic
**Failure mode:** refactor
**File:** src/lib/schema-validate.js
**Requirement:** R1
**Issue:** **File:** `src/lib/schema-validate.js`  
**Requirement:** R1  
**Issue:** `hasExplicitFullStringAnchors()` adds custom regex-anchor interpretation on top of JavaScript `RegExp`, but the existing `match[0] !== value` check already enforces full-string matching when the pattern is anchored. The helper increases maintenance surface for a narrow case.  
**Suggestion:** Either use JSON Schema’s normal `new RegExp(pattern).test(value)` semantics consistently, or if this validator intentionally enforces full matches for anchored patterns, replace the helper with a short comment and a direct condition tailored to the project’s supported schema subset.
**Suggestion:** **File:** `src/lib/schema-validate.js`  
**Requirement:** R1  
**Issue:** `hasExplicitFullStringAnchors()` adds custom regex-anchor interpretation on top of JavaScript `RegExp`, but the existing `match[0] !== value` check already enforces full-string matching when the pattern is anchored. The helper increases maintenance surface for a narrow case.  
**Suggestion:** Either use JSON Schema’s normal `new RegExp(pattern).test(value)` semantics consistently, or if this validator intentionally enforces full matches for anchored patterns, replace the helper with a short comment and a direct condition tailored to the project’s supported schema subset.
**Rationale:** Loop review proposal.

### 149. 4. Simplify Pattern Validation Logic
**Failure mode:** refactor
**File:** src/lib/schema-validate.js
**Requirement:** R1
**Issue:** **File:** `src/lib/schema-validate.js`  
**Requirement:** R1  
**Issue:** `hasExplicitFullStringAnchors()` adds custom regex-anchor interpretation on top of JavaScript `RegExp`, but the existing `match[0] !== value` check already enforces full-string matching when the pattern is anchored. The helper increases maintenance surface for a narrow case.  
**Suggestion:** Either use JSON Schema’s normal `new RegExp(pattern).test(value)` semantics consistently, or if this validator intentionally enforces full matches for anchored patterns, replace the helper with a short comment and a direct condition tailored to the project’s supported schema subset.
**Suggestion:** **File:** `src/lib/schema-validate.js`  
**Requirement:** R1  
**Issue:** `hasExplicitFullStringAnchors()` adds custom regex-anchor interpretation on top of JavaScript `RegExp`, but the existing `match[0] !== value` check already enforces full-string matching when the pattern is anchored. The helper increases maintenance surface for a narrow case.  
**Suggestion:** Either use JSON Schema’s normal `new RegExp(pattern).test(value)` semantics consistently, or if this validator intentionally enforces full matches for anchored patterns, replace the helper with a short comment and a direct condition tailored to the project’s supported schema subset.
**Rationale:** Loop review proposal.

### 150. 1. Extract Shared Task ID Pattern Constant
**Failure mode:** refactor
**File:** src/spec/lib/render-contract.js
**Requirement:** R1
**Issue:** **File:** `src/spec/lib/render-contract.js`  
**Requirement:** R1  
**Issue:** The task ID regex exists here as `TASK_ID_PATTERN` and separately as a JSON Schema string in `src/flow/schemas/spec.schema.json`. That creates a drift risk for a requirement that says both must accept exactly the same language.  
**Suggestion:** Define a shared exported pattern string, for example `TASK_ID_PATTERN_SOURCE = "^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$"`, derive `TASK_ID_PATTERN` from it, and add a schema-generation or validation test that asserts the schema pattern matches the exported source.
**Suggestion:** **File:** `src/spec/lib/render-contract.js`  
**Requirement:** R1  
**Issue:** The task ID regex exists here as `TASK_ID_PATTERN` and separately as a JSON Schema string in `src/flow/schemas/spec.schema.json`. That creates a drift risk for a requirement that says both must accept exactly the same language.  
**Suggestion:** Define a shared exported pattern string, for example `TASK_ID_PATTERN_SOURCE = "^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$"`, derive `TASK_ID_PATTERN` from it, and add a schema-generation or validation test that asserts the schema pattern matches the exported source.
**Rationale:** Loop review proposal.

### 151. 2. Avoid Re-Copying Task Collections
**Failure mode:** refactor
**File:** src/flow/lib/sync-spec-tasks.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/sync-spec-tasks.js`  
**Requirement:** R6  
**Issue:** `newTasks = [...collection].filter(...)` materializes the whole collection before filtering. The collection is already bounded, but this adds avoidable allocation and weakens the “linear bounded entries” design style introduced by `TaskCollection`.  
**Suggestion:** Build `newTasks` with a simple loop over `collection`, pushing only missing IDs. This keeps the append plan explicitly O(n) without an intermediate full-array copy.
**Suggestion:** **File:** `src/flow/lib/sync-spec-tasks.js`  
**Requirement:** R6  
**Issue:** `newTasks = [...collection].filter(...)` materializes the whole collection before filtering. The collection is already bounded, but this adds avoidable allocation and weakens the “linear bounded entries” design style introduced by `TaskCollection`.  
**Suggestion:** Build `newTasks` with a simple loop over `collection`, pushing only missing IDs. This keeps the append plan explicitly O(n) without an intermediate full-array copy.
**Rationale:** Loop review proposal.

### 152. 3. Rename `ValidatedTask` To Reflect Spec Task Semantics
**Failure mode:** refactor
**File:** src/spec/lib/render-contract.js
**Requirement:** R2
**Issue:** **File:** `src/spec/lib/render-contract.js`  
**Requirement:** R2  
**Issue:** `ValidatedTask` is generic, but the object specifically represents a spec task whose `id` and `parent` fields have been converted to `TaskId` instances. The generic name makes later call sites less obvious, especially because render/sync code still calls values `task` or `specTask`.  
**Suggestion:** Rename it to something like `ValidatedSpecTask` or `TaskCollectionEntry` to clarify that it is the normalized entry type exposed by `TaskCollection`.
**Suggestion:** **File:** `src/spec/lib/render-contract.js`  
**Requirement:** R2  
**Issue:** `ValidatedTask` is generic, but the object specifically represents a spec task whose `id` and `parent` fields have been converted to `TaskId` instances. The generic name makes later call sites less obvious, especially because render/sync code still calls values `task` or `specTask`.  
**Suggestion:** Rename it to something like `ValidatedSpecTask` or `TaskCollectionEntry` to clarify that it is the normalized entry type exposed by `TaskCollection`.
**Rationale:** Loop review proposal.

### 153. 4. Simplify Pattern Validation Logic
**Failure mode:** refactor
**File:** src/lib/schema-validate.js
**Requirement:** R1
**Issue:** **File:** `src/lib/schema-validate.js`  
**Requirement:** R1  
**Issue:** `hasExplicitFullStringAnchors()` adds custom regex-anchor interpretation on top of JavaScript `RegExp`, but the existing `match[0] !== value` check already enforces full-string matching when the pattern is anchored. The helper increases maintenance surface for a narrow case.  
**Suggestion:** Either use JSON Schema’s normal `new RegExp(pattern).test(value)` semantics consistently, or if this validator intentionally enforces full matches for anchored patterns, replace the helper with a short comment and a direct condition tailored to the project’s supported schema subset.
**Suggestion:** **File:** `src/lib/schema-validate.js`  
**Requirement:** R1  
**Issue:** `hasExplicitFullStringAnchors()` adds custom regex-anchor interpretation on top of JavaScript `RegExp`, but the existing `match[0] !== value` check already enforces full-string matching when the pattern is anchored. The helper increases maintenance surface for a narrow case.  
**Suggestion:** Either use JSON Schema’s normal `new RegExp(pattern).test(value)` semantics consistently, or if this validator intentionally enforces full matches for anchored patterns, replace the helper with a short comment and a direct condition tailored to the project’s supported schema subset.
**Rationale:** Loop review proposal.

### 154. 1. Extract Shared Task ID Pattern Constant
**Failure mode:** refactor
**File:** src/spec/lib/render-contract.js
**Requirement:** R1
**Issue:** **File:** `src/spec/lib/render-contract.js`  
**Requirement:** R1  
**Issue:** The task ID regex exists here as `TASK_ID_PATTERN` and separately as a JSON Schema string in `src/flow/schemas/spec.schema.json`. That creates a drift risk for a requirement that says both must accept exactly the same language.  
**Suggestion:** Define a shared exported pattern string, for example `TASK_ID_PATTERN_SOURCE = "^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$"`, derive `TASK_ID_PATTERN` from it, and add a schema-generation or validation test that asserts the schema pattern matches the exported source.
**Suggestion:** **File:** `src/spec/lib/render-contract.js`  
**Requirement:** R1  
**Issue:** The task ID regex exists here as `TASK_ID_PATTERN` and separately as a JSON Schema string in `src/flow/schemas/spec.schema.json`. That creates a drift risk for a requirement that says both must accept exactly the same language.  
**Suggestion:** Define a shared exported pattern string, for example `TASK_ID_PATTERN_SOURCE = "^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$"`, derive `TASK_ID_PATTERN` from it, and add a schema-generation or validation test that asserts the schema pattern matches the exported source.
**Rationale:** Loop review proposal.

### 155. 3. Rename `ValidatedTask` To Reflect Spec Task Semantics
**Failure mode:** refactor
**File:** src/spec/lib/render-contract.js
**Requirement:** R2
**Issue:** **File:** `src/spec/lib/render-contract.js`  
**Requirement:** R2  
**Issue:** `ValidatedTask` is generic, but the object specifically represents a spec task whose `id` and `parent` fields have been converted to `TaskId` instances. The generic name makes later call sites less obvious, especially because render/sync code still calls values `task` or `specTask`.  
**Suggestion:** Rename it to something like `ValidatedSpecTask` or `TaskCollectionEntry` to clarify that it is the normalized entry type exposed by `TaskCollection`.
**Suggestion:** **File:** `src/spec/lib/render-contract.js`  
**Requirement:** R2  
**Issue:** `ValidatedTask` is generic, but the object specifically represents a spec task whose `id` and `parent` fields have been converted to `TaskId` instances. The generic name makes later call sites less obvious, especially because render/sync code still calls values `task` or `specTask`.  
**Suggestion:** Rename it to something like `ValidatedSpecTask` or `TaskCollectionEntry` to clarify that it is the normalized entry type exposed by `TaskCollection`.
**Rationale:** Loop review proposal.

### 156. 1. Extract duplicated invalid task fixtures
**Failure mode:** refactor
**File:** tests/helpers/render-artifact-snapshot.js
**Requirement:** R5
**Issue:** **File:** `tests/helpers/render-artifact-snapshot.js`  
**Requirement:** R5  
**Issue:** `specTask` and the invalid task collection fixtures are duplicated in `tests/unit/flow/run-update-overview.test.js` and `tests/unit/flow/set-approval.test.js`. That makes future changes to task validity cases easy to miss in one test file.  
**Suggestion:** Add small exported helpers such as `makeSpecTask()` and `invalidTaskCollectionFixtures()` to this helper file, then import them from both tests.
**Suggestion:** **File:** `tests/helpers/render-artifact-snapshot.js`  
**Requirement:** R5  
**Issue:** `specTask` and the invalid task collection fixtures are duplicated in `tests/unit/flow/run-update-overview.test.js` and `tests/unit/flow/set-approval.test.js`. That makes future changes to task validity cases easy to miss in one test file.  
**Suggestion:** Add small exported helpers such as `makeSpecTask()` and `invalidTaskCollectionFixtures()` to this helper file, then import them from both tests.
**Rationale:** Loop review proposal.

### 157. 2. Add explicit bounds to snapshot loading
**Failure mode:** refactor
**File:** tests/helpers/render-artifact-snapshot.js
**Requirement:** R5
**Issue:** **File:** `tests/helpers/render-artifact-snapshot.js`  
**Requirement:** R5  
**Issue:** `RenderArtifactSnapshot` reads every task file in `tasks/` with no explicit entry or size bound. This conflicts with the `bounded-resource-usage` guardrail because bulk filesystem loading can grow without limit.  
**Suggestion:** Add explicit limits, for example `maxTaskEntries` and `maxTaskBytes`, defaulting to the project’s expected task limit. Fail fast if the directory exceeds the bound or if a task file is too large before reading all contents.
**Suggestion:** **File:** `tests/helpers/render-artifact-snapshot.js`  
**Requirement:** R5  
**Issue:** `RenderArtifactSnapshot` reads every task file in `tasks/` with no explicit entry or size bound. This conflicts with the `bounded-resource-usage` guardrail because bulk filesystem loading can grow without limit.  
**Suggestion:** Add explicit limits, for example `maxTaskEntries` and `maxTaskBytes`, defaulting to the project’s expected task limit. Fail fast if the directory exceeds the bound or if a task file is too large before reading all contents.
**Rationale:** Loop review proposal.

### 158. 4. Simplify repeated invalid-collection test setup
**Failure mode:** refactor
**File:** tests/unit/flow/run-update-overview.test.js
**Requirement:** R5
**Issue:** **File:** `tests/unit/flow/run-update-overview.test.js`  
**Requirement:** R5  
**Issue:** The invalid collection test repeats setup details that are conceptually about preserving render artifacts: creating `tasks/`, writing existing task files, and constructing the snapshot. Similar setup also exists in `set-approval.test.js`.  
**Suggestion:** Move the repeated artifact setup into a local helper such as `writeExistingRenderArtifacts(dir)` or into the shared render artifact helper module, then keep each test focused on the command or function under test.
**Suggestion:** **File:** `tests/unit/flow/run-update-overview.test.js`  
**Requirement:** R5  
**Issue:** The invalid collection test repeats setup details that are conceptually about preserving render artifacts: creating `tasks/`, writing existing task files, and constructing the snapshot. Similar setup also exists in `set-approval.test.js`.  
**Suggestion:** Move the repeated artifact setup into a local helper such as `writeExistingRenderArtifacts(dir)` or into the shared render artifact helper module, then keep each test focused on the command or function under test.
**Rationale:** Loop review proposal.

### 159. 3. Avoid duplicated cleanup inside loop
**Failure mode:** refactor
**File:** tests/unit/flow/set-approval.test.js
**Requirement:** R5
**Issue:** **File:** `tests/unit/flow/set-approval.test.js`  
**Requirement:** R5  
**Issue:** The test manually removes `tmp` inside the loop and also relies on `afterEach` cleanup. Setting `tmp = null` avoids double cleanup, but the mixed ownership makes the test harder to follow.  
**Suggestion:** Use a local `projectDir` inside the loop and clean it up with `try/finally`, leaving the shared `tmp`/`afterEach` pattern for tests that only create one project.
**Suggestion:** **File:** `tests/unit/flow/set-approval.test.js`  
**Requirement:** R5  
**Issue:** The test manually removes `tmp` inside the loop and also relies on `afterEach` cleanup. Setting `tmp = null` avoids double cleanup, but the mixed ownership makes the test harder to follow.  
**Suggestion:** Use a local `projectDir` inside the loop and clean it up with `try/finally`, leaving the shared `tmp`/`afterEach` pattern for tests that only create one project.
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
