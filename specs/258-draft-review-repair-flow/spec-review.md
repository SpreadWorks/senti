# Spec Review Results

## Verdict: FAIL

## Blocking Findings

### 1. Draft approval owner is unspecified after removing review mutation
**Target:** R1, R6, R7, Data Flow, gate-draft
**Issue:** Existing gate-draft validation calls validateDraftLifecycle(), and DraftApproval.validate() fails unless draft.json has approval.approved = true. Today review-draft-coverage sets that field through approveDraftAfterCoverageReview(). The spec removes draft.json mutation from review and allows PASS to skip or complete empty triage/repair artifacts, but it does not assign any later step responsibility for setting approval on a clean coverage review path.
**Required change:** Specify which step sets draft.json approval.approved/confirmedAt before gate-draft when coverage review has no unresolved blocking findings, including the PASS/no-repair path, or explicitly change the gate-draft approval contract.
**Why blocking:** A valid PASS coverage review can leave draft.json with approval.approved = false, causing gate-draft to fail existing lifecycle validation even though the new review/triage/repair artifacts are correct.

### 2. Draft triage decision semantics are missing
**Target:** R4, R7, R8
**Issue:** The spec requires gate-draft to validate allowed decisions and unresolved blocking findings, but draft triage artifacts only say each item records a decision. Unlike existing spec-review-triage validation, there is no draft decision enum or rule saying which decisions resolve blockingFindings, which require repair items, and which leave a blocking user-decision state. Existing draft repair code also has a draft-specific requires_user_decision path that is not mapped into the new triage contract.
**Required change:** Add the exact allowed draft triage decisions and define their gate meaning for blockingFindings and repairTargets, including which decisions require draft repair items and which leave gate-draft blocked.
**Why blocking:** Without this contract, implementation cannot safely validate allowed decisions or determine whether a blocking draft review finding is resolved, and tests for FAIL routing/unresolved blocking state cannot be designed.

### 3. Active-flow migration lacks status rules for inserted draft leaves
**Target:** R9
**Issue:** Existing flow-store migrations must insert concrete step objects with statuses, and active flows may already be between draft review, gate-draft, spec, or later steps. The spec says to insert new draft triage/repair leaves and update old artifact references, but it does not define status synthesis for those inserted leaves or how old markdown-only review/repair artifacts affect migrated state.
**Required change:** Specify the migration status policy for each new draft triage/repair leaf based on neighboring review/refine/gate statuses, and state whether migrated flows past draft gate must generate empty/new JSON artifacts, mark leaves done, or rewind to rerun draft review.
**Why blocking:** If inserted leaves default to pending, existing active flows can be forced backward after review/spec work; if they default to done, gate-draft may later validate missing JSON artifacts. Either choice can break next-action ordering or artifact validation without a spec-level rule.


## Non-blocking Improvements

### 1. Name the new draft step ids explicitly
**Target:** R3, Tasks T-2
**Improvement:** Add the exact leaf ids intended for the two triage/repair pairs, for example draft-questions-triage, draft-questions-repair, draft-coverage-triage, and draft-coverage-repair.
**Why non-blocking:** The artifact names and placement make the likely ids inferable, but explicit ids would reduce churn across flow definition, prompt filenames, tests, registry hooks, and migration code.

### 2. Mention persistent rules inventory
**Target:** R10 / Scope Modules
**Improvement:** Include src/templates/skills/rules.json in the guidance update scope if new flow step ids should receive the same persistent next-action rules as existing plan steps.
**Why non-blocking:** The generated flow skill still carries universal guidance, but get-next-action rule injection is keyed by step id, so listing the file would help preserve current prompt behavior for the new leaves.
