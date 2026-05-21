# Feature Specification: 265-impl-review-blocking-pass

**Feature Branch**: `feature/265-impl-review-blocking-pass`
**Created**: 2026-05-21
**Status**: Draft
**Input**: GitHub Issue #340

## Goal
Make impl review converge on blocking findings: PASS is based on `blockingFindings.length === 0`, non-blocking improvements do not consume retry budget, and review state is persisted in `impl-review.json`.

## Background
Impl review currently uses proposal absence as the completion condition. That makes review convergence depend on whether the reviewer can stop suggesting code-quality improvements, even after the implementation satisfies the spec. Issue #340 narrows the stopping condition to blocking failure modes and asks for a structured impl review artifact, prompt alignment, and previous review memory so non-blocking improvements remain visible without blocking the flow.

## Scope
- [must] Change impl review detection output to structured `blockingFindings[]` and `nonBlockingImprovements[]` buckets.
- [must] Persist both `review.md` and `impl-review.json` for impl review; `impl-review.json` is the machine-readable source for PASS, retry, next-step, and prompt-memory decisions.
- [must] Define impl review blocking failure modes as exactly: missing or incomplete spec acceptance requirement, behavior that contradicts the spec, and reproducible security or data integrity bug.
- [must] Exclude regression failures, test false positives, scope creep, project-rule violations, naming-only proposals, refactor suggestions, DRY suggestions, comment suggestions, and docs suggestions from impl review blocking findings.
- [must] Treat `blockingFindings.length === 0` as impl review PASS even when `nonBlockingImprovements.length > 0`.
- [must] Ensure non-blocking improvements do not increment reviewRetry and do not route impl review to an apply/repair stop before `gate-impl`.
- [must] Include previous impl review memory in later impl reviewer prompts: previous verdict, blocking count, non-blocking count, previous blocking findings, and acknowledged non-blocking improvements.
- [must] Update implement, reviewer, and triage prompts so all three use the same blocking failure mode list.
- [must] Update impl review parsing, scope filtering, markdown rendering, JSON artifact writing, and run-review post-processing to use the structured artifact contract.
- [must] Add tests that verify structured parsing/filtering/rendering, PASS with non-blocking improvements, retry reset behavior, next step `gate-impl`, and phase transition behavior.
- [should] Add e2e coverage that verifies an impl-review artifact with zero blocking findings can advance to `gate-impl`.

## Out of Scope
- Renaming test review `advisoryFindings` or unifying all review bucket names.
- Adding a persistent suppression mechanism that forbids re-proposing acknowledged non-blocking improvements across rounds.
- Treating existing regression failures, test assertion quality, scope creep, or guardrail violations as impl review blocking findings.
- Changing AI provider selection or model configuration.
- Changing GitHub issue publish workflow.
- Adding external dependencies.

## Constraints
- Use only Node.js built-in modules and existing project helpers.
- Do not keep backward-compatible parsing for the old impl review proposal-only contract; this repository is in alpha and the new structured artifact replaces that contract.
- Represent meaningful review values with classes where they carry invariants or behavior; avoid object-literal type tags for new review artifact concepts.
- Keep `src/` generic. Prompt text must describe review contracts generically and must not mention project-specific issue history.
- Reuse shared helpers when parsing, formatting, or artifact writing appears in more than one impl review path.
- Prompt source under `src/flow/prompts/` changes require `sdd-forge upgrade` after implementation.
- This spec modifies the existing `sdd-forge flow run review` impl-phase behavior but does not add, remove, or rename CLI commands or user-facing options.
- Successful impl review execution returns exit code 0 when review detection completes and writes artifacts. Subprocess errors, invalid artifacts, or invalid JSON output remain failure conditions and must return the existing non-zero error path.
- No new user-facing CLI argument is introduced. Existing `--phase` validation remains owned by the current review command entry point.

## Design Principles
- Use structured review artifacts for machine decisions and markdown only for human reading.
- Make blocking criteria narrow enough that two reviewers can decide whether a finding blocks progress.
- Let gate/test phases own regression, guardrail, and test-quality concerns instead of duplicating them in impl review.
- Keep non-blocking improvements visible to the implementer without making them flow-stopping conditions.
- Prefer the existing spec-review artifact pattern over inventing a separate review pipeline shape.

## Overview
### Modules
- `src/flow/commands/review.js` builds impl reviewer prompts, invokes the review agent, parses findings, filters them by touched files, writes `review.md`, and should write `impl-review.json`.
- `src/flow/lib/run-review.js` wraps the review subprocess, parses stderr/stdout into flow artifacts, updates reviewRetry, clears review stop state on PASS/ADVISORY, and chooses the next impl step.
- `src/flow/prompts/impl/review.md` guides implementer triage after review findings are generated.
- `src/flow/prompts/impl/implement.md` guides initial implementation before tests and review.
- `src/flow/registry.js` owns post-hook step status transitions after `flow run review` returns a structured command result.
- `src/flow/prompts/task/review.md` guides task-scoped review when `RunReviewCommand` invokes review with `--task-spec`.
- `src/flow/lib/review-failure.js` already consumes retry budget only for verdict FAIL and can be reused without changing the retry policy.

### Data Flow
- Impl review receives the requirement-file map and diff, asks the reviewer for JSON with `blockingFindings[]` and `nonBlockingImprovements[]`, repairs/parses that JSON through existing JSON helpers, and normalizes each entry into review finding objects.
- Scope filtering uses a normalized `file` field for file-specific findings. Missing-acceptance blockers may instead use `requirementId`; those blockers remain in `blockingFindings` when the requirement id exists in `spec.json.requirements[]` even if `file` is empty.
- `review.md` renders a human summary of blocking and non-blocking findings. `impl-review.json` stores version, verdict, counts, included findings, excluded counts, and generated timestamp.
- `run-review` parses the structured review metadata, sets `next` to `gate-impl` when blocking count is zero, and lets reviewRetry reset because the artifact verdict is PASS or ADVISORY rather than FAIL.
- `registry.js` post hooks consume the structured verdict so PASS/ADVISORY complete review while FAIL leaves the flow stopped on review and prevents `gate-impl` promotion.
- The next reviewer prompt includes bounded previous memory from the latest `impl-review.json` so the reviewer sees prior verdict and acknowledged non-blocking context.

### Decisions
- [VERIFY] Impl review currently depends on proposal markdown and `proposalCount`.
- [VERIFY] `run-review` currently treats no proposals as impl PASS.
- [VERIFY] Current triage prompt uses broad proposal criteria.
- [VERIFY] Spec/test review already use structured finding buckets.
- [VERIFY] Review step completion also depends on registry post hooks.
- [VERIFY] Task-scoped review currently mirrors old proposal semantics.
- Use `nonBlockingImprovements` for impl review.
- Use `impl-review.json` as the source of truth and keep `review.md` for readers.
- Non-blocking improvements are advisory for the implementer and do not stop flow.

## Clarifications (Q&A)
- Q: Does this change add or remove a CLI command or option?
  - A: No. It changes the impl-phase behavior of the existing `sdd-forge flow run review` command. No new user-facing CLI argument is introduced.
- Q: What is a blocking impl review finding?
  - A: Only one of the R2 failure modes: missing or incomplete spec acceptance requirement, behavior contradiction against the spec, or reproducible security/data integrity bug.
- Q: What happens when only non-blocking improvements exist?
  - A: The verdict is ADVISORY, reviewRetry is not consumed, and the next step is `gate-impl`.
- Q: Are guardrail violations blocking impl review findings?
  - A: No. Guardrail violations remain owned by gate-impl. The reviewer may record them as non-blocking context only when they name a touched file and an affected function, branch, assertion, prompt sentence, or artifact field, but they do not define the impl review stop condition.
- Q: What owns test regression failures?
  - A: Test execution, test-result-review, and gate-impl own regression evidence. Impl review does not convert regression failures into blocking findings.
- Q: How does a missing acceptance requirement survive file scope filtering?
  - A: The finding uses `failureMode: "missing_acceptance_requirement"` and a valid `requirementId`; that entry remains in `blockingFindings` even when `file` is empty because the blocker is tied to a required behavior, not a touched file.
- Q: Does task-scoped review keep the old proposal-only behavior?
  - A: No. The same structured blocking/non-blocking contract applies to task-scoped review invoked with `--task-spec`.

## Alternatives Considered
- Keep proposalCount as the PASS condition and suppress repeated proposals. — Rejected because Issue #340 identifies feedback inflation as newly generated suggestions rather than repeated identical proposals; proposal absence remains the wrong stop condition.
- Use `advisoryFindings` for impl review non-blocking output. — Rejected because the requested target pattern is spec review's `nonBlockingImprovements`; unifying test review naming is out of scope.
- Use `review.md` as the only artifact. — Rejected because PASS, retry, next-step, and previous-memory decisions need structured fields and should not parse human markdown.
- Route non-blocking improvements through the apply step before gate-impl. — Rejected because it keeps non-blocking suggestions as a flow-stopping condition and conflicts with the completion criterion that non-blocking improvements do not consume retry budget.
- Include regression, test quality, scope creep, and guardrail violations as blocking impl review findings. — Rejected because those concerns already have dedicated downstream phases and gates.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-05-21T02:37:04.291Z
- Notes: User approved spec #265 for Issue #340.

## Requirements
- R1 [must]: Impl reviewer prompt output shall be JSON with top-level arrays `blockingFindings` and `nonBlockingImprovements`; each included finding shall contain `title`, `failureMode`, `issue`, `suggestion`, and `rationale`. File-specific findings shall include `file`; missing-acceptance blockers may use `requirementId` instead of `file`.
- R2 [must]: Impl review blocking findings shall be limited to these three failure modes: an acceptance requirement from the spec is missing or incomplete, implementation behavior contradicts the spec, or the diff introduces a reproducible security or data integrity bug.
- R3 [must]: Impl review shall classify regression failures, test false positives, scope creep, project-rule violations, naming proposals, refactor proposals, DRY proposals, comment proposals, and docs proposals as non-blocking or out of scope rather than blocking findings.
- R4 [must]: Impl review shall write `specs/<spec>/impl-review.json` containing `version`, `phase`, `generatedAt`, `verdict`, `summary`, `blockingFindings`, `nonBlockingImprovements`, and excluded scope counts.
- R5 [must]: Impl review shall write `review.md` as a human-readable summary that separately lists blocking findings and non-blocking improvements and states when either bucket is empty.
- R6 [must]: Impl review PASS shall be determined by `impl-review.json.blockingFindings.length === 0`; `nonBlockingImprovements.length > 0` shall not make the result FAIL.
- R7 [must]: `sdd-forge flow run review` for impl phase shall set `artifacts.verdict` to `PASS` when both buckets are empty, `ADVISORY` when blocking is empty and non-blocking is non-empty, and `FAIL` when blocking is non-empty.
- R8 [must]: When impl review verdict is PASS or ADVISORY, reviewRetry shall be reset or left unconsumed and the next step shall be `gate-impl`.
- R9 [must]: When impl review verdict is FAIL, reviewRetry shall be consumed through the existing review failure path and the flow shall not advance to `gate-impl` until blocking findings are addressed.
- R10 [must]: Previous impl review memory shall include previous verdict, blocking count, non-blocking count, previous blocking findings, and acknowledged non-blocking improvements, with explicit array and character bounds in code.
- R11 [must]: `src/flow/prompts/impl/review.md`, `src/flow/prompts/impl/implement.md`, and the impl reviewer system prompt shall contain the same three blocking failure modes from R2.
- R12 [must]: Prompt text shall state that non-blocking improvements are optional and should not be generated unless they name a touched file, describe an observable issue in that file, and provide a replacement action that names the affected function, branch, assertion, prompt sentence, or artifact field.
- R13 [must]: Scope filtering shall apply to both `blockingFindings` and `nonBlockingImprovements`. File-specific findings whose `file` is empty or not in the touched-file set shall be dropped and counted; missing-acceptance blockers with a valid `requirementId` shall remain blocking even when `file` is empty.
- R14 [must]: Spec-local and shared tests shall verify JSON parsing, scope filtering, `review.md` rendering, `impl-review.json` rendering, ADVISORY retry behavior, and impl review phase transitions.
- R15 [must]: `FLOW_COMMANDS.run.review.post` shall consume the impl review structured verdict: PASS and ADVISORY mark the impl `review` step done, while FAIL leaves the flow stopped on review and prevents `gate-impl` from becoming the next pending step.
- R16 [must]: The structured impl review contract shall apply to task-scoped review invoked with `--task-spec`, including artifact verdict behavior and task review prompt text.
- R17 [must]: `src/flow/prompts/task/review.md` shall replace proposal-only review wording with the same blocking/non-blocking policy used by flow-level impl review.

## Acceptance Criteria
- A review JSON payload with one blocking finding and zero non-blocking improvements produces `impl-review.json.verdict === "FAIL"`, `blockingFindings.length === 1`, and `nonBlockingImprovements.length === 0`.
- A review JSON payload with zero blocking findings and one non-blocking improvement produces `impl-review.json.verdict === "ADVISORY"` and `sdd-forge flow run review` artifacts with `next === "gate-impl"`.
- A review JSON payload with both arrays empty produces `impl-review.json.verdict === "PASS"` and `review.md` states that no blocking findings or non-blocking improvements were recorded.
- A finding with a missing file path is excluded from the relevant bucket and increments the missing-file excluded count.
- A blocking finding with `failureMode === "missing_acceptance_requirement"`, a valid `requirementId`, and an empty `file` remains in `blockingFindings` and makes the verdict FAIL.
- A finding whose file path is not in the touched-file set is excluded from the relevant bucket and increments the out-of-scope excluded count.
- `updateReviewRetryCounter` does not increment reviewRetry for impl review artifacts whose verdict is PASS or ADVISORY.
- `updateReviewRetryCounter` increments reviewRetry for impl review artifacts whose verdict is FAIL.
- `FLOW_COMMANDS.run.review.post` does not promote `gate-impl` after an impl review FAIL artifact.
- Task-scoped review with `--task-spec` writes the same structured artifact shape and uses the same PASS/ADVISORY/FAIL verdict policy.
- `src/flow/prompts/impl/review.md`, `src/flow/prompts/impl/implement.md`, and the impl reviewer system prompt each include the same three blocking failure mode labels.
- `src/flow/prompts/task/review.md` includes the same blocking/non-blocking review policy as flow-level impl review.
- Spec-local tests under `specs/265-impl-review-blocking-pass/tests/` include `// spec: R<N>` headers covering R1 through R17.

## Implementation Targets
- src/flow/commands/review.js
- src/flow/lib/run-review.js
- src/flow/registry.js
- src/flow/prompts/impl/review.md
- src/flow/prompts/impl/implement.md
- src/flow/prompts/task/review.md
- tests/unit/flow/commands/review.test.js
- tests/unit/flow/run-review-advisory.test.js
- tests/unit/flow/phases-review.test.js
- tests/e2e/flow/gate-impl-integration.test.js
- specs/265-impl-review-blocking-pass/tests/

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Add impl review artifact
  - Introduce the structured impl review finding and artifact contract used by review command output.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Route impl review verdict
  - Update `run-review` impl-phase post-processing so structured verdicts control PASS, retry, and next-step behavior.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Align review prompts
  - Make implementation, reviewer, and triage prompts share the same blocking failure modes and non-blocking policy.
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Add review coverage
  - Add traceable spec-local and shared tests for the new impl review artifact and verdict contracts.
  - see `tasks/T-4.md` for full spec
