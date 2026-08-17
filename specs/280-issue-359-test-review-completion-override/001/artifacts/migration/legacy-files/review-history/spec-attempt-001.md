# Spec Review Results

## Verdict: FAIL

## Blocking Findings

### 1. TOOLING_FAILURE overrides have no findingId source
**Target:** R3 / R4 / Acceptance Criteria
**Issue:** The existing TOOLING_FAILURE artifact path creates test-review artifacts with no blocking findings, but OverrideCompletionEvidence still requires a non-empty findings array and each FindingDisposition requires findingId. The spec requires documenting finding fields, but does not say what findingId should be used when the only item being accepted is the tooling failure itself rather than a parsed review finding.
**Required change:** Add the smallest procedure requirement that defines how to populate the required findings[] entry for a TOOLING_FAILURE with no review findings, including the expected findingId source or stable synthetic findingId convention.
**Why blocking:** Without this data path, operators cannot reliably write valid copyable override evidence for the parser_error scenario in Issue #359, and tests cannot determine whether the documented recovery procedure gives a valid value for the schema-required findingId field.

### 2. Test target conflicts with thin dispatcher skill architecture
**Target:** T-1 test_strategy / Overview Modules: src/skills/sdd-forge.flow/SKILL.md
**Issue:** The spec says spec-local tests should read the updated guidance source and deployed skill text, and lists src/skills/sdd-forge.flow/SKILL.md as exposing test-review operational guidance. Current code explicitly makes that skill a thin dispatcher: per-step procedures come from sdd-forge flow get next-action, backed by src/flow/prompts/plan/test-review.md. Forcing the detailed TOOLING_FAILURE procedure into the skill would duplicate per-step guidance and contradict the placement contract in the skill itself.
**Required change:** Change the spec target/test strategy so required guidance assertions are against the next-action prompt source that owns test-review instructions, and only require skill upgrade/synchronization if src/skills content is intentionally changed for a separate dispatcher-level reason.
**Why blocking:** Leaving the deployed skill as a required assertion target makes the implementation choose between failing the spec-local test and placing per-step recovery instructions in a file whose verified role is to avoid encoding per-step procedures.


## Non-blocking Improvements

### 1. Mention artifact recovery text as related guidance
**Target:** Codebase Context / Modules
**Improvement:** Consider listing src/flow/commands/review.js as a related operator-facing text source because buildToolingFailureReview currently emits the vague recovery string about recording an explicit evidence-based override.
**Why non-blocking:** The main implementation can still satisfy the requested procedure by updating src/flow/prompts/plan/test-review.md, but mentioning the artifact text would help keep all user-facing recovery wording consistent.
