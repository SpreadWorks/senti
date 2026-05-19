# Feature Specification: 261-draft-prompt-rules

**Feature Branch**: `feature/261-draft-prompt-rules`
**Created**: 2026-05-19
**Status**: Draft
**Input**: GitHub Issue #332

## Goal
Unify draft QA authoring and draft coverage review around a shared declarative rules partial, while aligning the runtime draft QA contract so `considered` can be stored and reviewed consistently.

## Background
Draft QA rules are currently spread across the draft authoring prompt and draft review prompt, with the requirements checklist duplicated inside `draft.md` itself. This causes authoring and reviewer criteria to drift. Source verification also showed that the requested `considered` field is not part of the current runtime draft lifecycle contract, so prompt-only changes would leave the shared schema inconsistent with gate validation.

## Scope
- [must] Add `src/flow/prompts/partials/draft-qa-rules.md` as the shared declaration for draft QA schema, boundary, checklist, premise validation, decision evidence, and coverage rules.
- [must] Resolve `<!-- include("path") -->` directives in flow step instructions returned by `getStepInstructions`, preserving the existing include resolver bounds of maximum depth 8 and maximum include count 32.
- [must] Replace duplicated QA rule sections in `src/flow/prompts/plan/draft.md` with an include of the shared partial while preserving draft-authoring controls.
- [must] Align the runtime `draft.json.qa[]` contract with the shared schema by adding a `considered` string field to prepared drafts and draft lifecycle validation.
- [must] Make draft coverage review load the same shared rules and include `considered` in QA entry formatting.
- [must] Preserve existing draft review output markers and parser-visible field names.
- [must] Add regression tests for include resolution, shared prompt content, `considered` formatting, and the runtime draft lifecycle contract.

## Out of Scope
- Unifying spec, test, review-spec, review-test, or impl review prompts.
- Promoting the shared prompt rules into guardrail.json.
- Adding a generic `loadPartial(name)` helper.
- Changing GitHub workflow or board publish behavior.
- Adding external dependencies.

## Constraints
- Use only Node.js built-in modules and existing project helpers.
- Do not add backward-compatibility branches for old draft QA formats; this is an alpha-period contract update.
- Keep `src/` generic and avoid project-specific issue numbers or environment-specific values.
- Question sanity review remains a finite structural check and must not receive coverage rules that would make it generate missing-question findings.
- The shared partial must not include spec-254 migration-history phrasing such as "moved from gate evaluation"; it must state the current rule contract.
- Review prompt output format markers consumed by existing parsers must remain stable.
- `bounded-resource-usage` acknowledged: this spec reuses the existing include resolver's maximum depth 8 and maximum include count 32; it does not add a new byte-size cap because prompt includes are package-controlled files and a global byte cap would affect existing include consumers outside Issue #332.
- This spec does not add or change user-facing CLI arguments. Existing `flow run review --phase draft` argument validation and entry-point behavior remain unchanged.
- Exit code contract for `flow run review --phase draft`: success remains exit code 0 after the review artifact is written; invalid phase, missing draft.json, invalid draft JSON, and agent/subprocess failures continue to return non-zero through the existing command error path.

## Design Principles
- Make the shared partial the single source of truth for draft QA authoring and final draft coverage review rules.
- Keep prompt-level schema and runtime artifact validation aligned so reviewers do not inspect fields the gate rejects.
- Reuse the existing include resolver instead of introducing a parallel directive parser; keep its explicit maximum include depth 8 and maximum include count 32 resource bounds.
- Preserve stage separation: question sanity review checks finite structural defects; coverage review checks unresolved blocking user decisions.

## Overview
### Modules
- `src/flow/prompts/partials/draft-qa-rules.md` will contain the shared declarative draft QA rules used by authoring and coverage review.
- `src/flow/lib/get-step-instructions.js` will resolve include directives before returning next-action instruction content, using maximum include depth 8 and maximum include count 32.
- `src/flow/prompts/plan/draft.md` will keep control-flow instructions and include the shared rules instead of duplicating schema/checklist text.
- `src/flow/lib/draft-lifecycle.js` and prepare-spec draft skeleton creation will accept and initialize `qa[].considered`.
- `src/flow/commands/review.js` will load the shared rules for coverage review and render `**Considered:**` in draft QA entries.
- Unit tests will cover loader behavior, prompt sharing, review formatting, and lifecycle validation.

### Data Flow
- next-action loads `plan.draft` through `getStepInstructions`; include resolution expands `/flow/prompts/partials/draft-qa-rules.md` with maximum include depth 8 and maximum include count 32 before the instruction envelope is returned.
- Draft authoring writes `draft.json.qa[]` entries with the same field set declared in the shared partial, including `considered`.
- Draft coverage review reads `draft.json`, loads the shared partial, formats QA entries with `considered`, and emits the existing review artifact shape.
- Gate-draft validates the runtime draft lifecycle contract, so prompt rules and accepted artifact shape stay synchronized.

### Decisions
- [VERIFY] `getStepInstructions` currently returns raw prompt markdown and does not resolve includes.
- [VERIFY] Existing include resolution already supports the path form required by this spec.
- [VERIFY] Current draft prompt duplicates the requirements checklist and embeds schema/boundary text inline.
- [CORRECTION] `considered` must be added to the runtime lifecycle contract, not only to prompt text.
- [VERIFY] Coverage review and question sanity review are separate stages and should remain separated.
- [VERIFY] Existing review parser-visible output markers must be preserved.

## Clarifications (Q&A)
- Q: Should `considered` be prompt-only or part of the runtime draft lifecycle contract?
  - A: It must be part of the runtime contract; otherwise the shared prompt schema and gate validation diverge.
- Q: Should question sanity review consume the shared coverage rules?
  - A: No. It remains a finite structural check; shared coverage rules apply to authoring and final coverage review.
- Q: Should the partial include spec-254 migration-history phrasing?
  - A: No. It should state current requirements-level and code-reference boundary rules without migration-history context.
- Q: Does this spec add or change any user-facing `flow run review` arguments?
  - A: No. `validate-user-input-at-entry-point` is satisfied by keeping the existing arguments and validation unchanged: `--phase` remains the user-facing phase selector validated against supported phases, and `--task-spec`, `--dry-run`, and `--skip-confirm` retain their current handling.
- Q: What is the exit code contract for the modified review command path?
  - A: `exit-code-contract`: `flow run review --phase draft` continues to exit 0 when the review artifact is written successfully. Invalid phase, missing draft.json, invalid draft JSON, and agent/subprocess failures continue to exit non-zero through the existing command error path.

## Alternatives Considered
- Only add `considered` to review prompt formatting. — Rejected because the runtime lifecycle validator would still reject or omit the field, leaving the shared schema inconsistent with gate validation.
- Apply the full shared rules partial to question sanity review. — Rejected because that stage explicitly forbids missing-question generation and NEW QA entries; coverage rules belong to authoring and coverage review.
- Add a generic partial loader helper. — Rejected for this spec because the only new direct read site is draft coverage review; `getStepInstructions` can call `resolveIncludes` directly.
- Keep duplicated checklist text in draft.md for autoApprove and non-autoApprove branches. — Rejected because the duplication is one of the drift sources this issue is intended to remove.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-05-19T05:16:36.192Z
- Notes: autoApprove: spec gate passed and approval choice [1] selected automatically.

## Requirements
- R1 [must]: Create `src/flow/prompts/partials/draft-qa-rules.md` with declarative draft QA rules covering the QA entry schema, `considered`, field-level boundary, the 8-item requirements checklist, premise validation, decision evidence, and coverage requirements.
- R2 [must]: `getStepInstructions(instructionsKey)` shall resolve include directives using the existing `resolveIncludes` helper with the prompt file directory as `baseDir` and package `src/` directory as `pkgDir`, preserving `resolveIncludes` bounds of maximum recursion depth 8 and maximum include count 32.
- R3 [must]: `src/flow/prompts/plan/draft.md` shall include the shared rules partial and remove duplicated inline QA schema, boundary, premise validation, research/self-verification rule text, and requirements checklist definitions while retaining draft-authoring control instructions.
- R4 [must]: The runtime draft lifecycle contract shall include `qa[].considered` as a string field initialized in new draft skeletons, accepted by validation, and required to be empty for pending, approved, and dropped entries.
- R5 [must]: Draft coverage review shall load the shared rules partial in reviewer context and format each reviewed QA entry with a `**Considered:**` line, using `(none)` when the field is empty.
- R6 [must]: Draft question sanity review shall remain limited to finite structural defects and shall not use the shared coverage rules to propose missing questions or category coverage findings.
- R7 [must]: Existing draft review output markers and parser-visible field names shall remain unchanged except for the additive `**Considered:**` QA entry line.
- R8 [must]: Automated tests shall verify include resolution, missing include failure, shared partial content in authoring and coverage review prompts, `considered` review formatting, and draft lifecycle acceptance of `considered`.

## Acceptance Criteria
- `getStepInstructions("plan.draft")` returns expanded content containing a marker from `draft-qa-rules.md`, not a raw include directive, while relying on the resolver bounds of depth 8 and include count 32.
- A prompt include pointing at a missing file throws an error message that includes the include path.
- `draft.md` contains one include of `/flow/prompts/partials/draft-qa-rules.md` and no duplicate 8-item requirements checklist blocks.
- `buildDraftReviewPrompt(..., { key: "coverage" })` contains the shared partial marker and still emits the existing coverage review output format.
- `buildDraftReviewPrompt` coverage QA formatting includes `**Considered:** <value>` and `**Considered:** (none)` for empty values.
- New draft skeletons include `considered: ""` in QA entry examples or generated QA entries, and draft lifecycle validation allows answered entries with `considered` populated.
- Question sanity review tests continue to prove the question stage does not generate missing coverage findings.
- All new and updated tests pass under the project unit test runner.

## Implementation Targets
- src/flow/prompts/partials/draft-qa-rules.md
- src/flow/prompts/plan/draft.md
- src/flow/lib/get-step-instructions.js
- src/flow/lib/draft-lifecycle.js
- src/flow/lib/run-prepare-spec.js
- src/flow/commands/review.js
- tests/unit/flow/get-step-instructions.test.js
- tests/unit/flow/commands/review.test.js
- tests/unit/flow/check-draft-json.test.js
- specs/261-draft-prompt-rules/tests/

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Add shared draft rules
  - Create the shared draft QA rules partial and wire flow step instruction loading so prompt includes resolve within maximum depth 8 and maximum include count 32 before next-action returns instructions.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Align draft lifecycle
  - Update the runtime draft QA contract so `considered` is initialized, validated, and available to review formatting.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Wire shared prompts
  - Replace draft authoring rule duplication and make draft coverage review consume the same rules while preserving stage-specific review behavior.
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Add regression coverage
  - Add spec-local and project unit tests that lock the include, shared prompt, lifecycle, and review formatting contracts.
  - see `tasks/T-4.md` for full spec
