# Feature Specification: 282-review-test-input-contract

**Feature Branch**: `feature/282-review-test-input-contract`
**Created**: 2026-06-06
**Status**: Draft
**Input**: GitHub Issue #369

## Goal
Lock the review-test prompt input contract and 1,000,000 character limit with regression tests so future changes cannot reintroduce oversized prompt input.

## Background
Saved prompt logs showed review-test as a high-volume phase, and earlier failures were caused by Existing Test Code growing into a large prompt. Current source already narrows review-test input to spec-local tests, sets a 1,000,000 character limit, and keeps test design in systemPrompt for the gap-analysis and gap-fix prompt builders. The risk is regression: without explicit tests, future edits could mix project root tests, raw logs, or spec.md into review-test prompts or move stable test design text back into userPrompt.

## Scope
- Review-test prompt input collection and prompt construction in `src/flow/commands/review.js`.
- `collectTestFiles`, `buildGapAnalysisPrompt`, `buildTestFixPrompt`, `TEST_REVIEW_PROMPT_CHAR_LIMIT`, and the review-test provider-call boundary.
- Spec-local regression tests under `specs/282-review-test-input-contract/tests/` with `// spec: R<N> ...` headers.
- Shared unit or e2e tests under `tests/unit` or `tests/e2e` provide normal `npm test` coverage of the same contract.

## Out of Scope
- Changing review-test AI scoring, finding classification, or auto-fix behavior.
- Changing provider configuration, model selection, or provider input limits.
- Adding saved prompt log analytics or metrics reporting.
- Changing CLI options, command names, or exit-code semantics.
- Running npm publish, npm dist-tag, or release preparation.

## Constraints
- Use only Node.js built-in modules and existing test infrastructure; do not add external dependencies.
- Do not weaken existing tests to make the new tests pass.
- Keep `src/` generic. Do not add project-specific paths or environment-specific values to production code.
- Do not change review-test runtime behavior except for exposing or structuring existing behavior so the contract can be tested.
- Spec-local coverage is required under `specs/282-review-test-input-contract/tests/`; shared tests may supplement but do not replace it.
- The existing CLI interface and exit-code contract remain unchanged.
- `bounded-resource-usage` is acknowledged for the existing recursive `collectTestsRecursive` traversal because this spec keeps the traversal scoped to `path.resolve(root, specDir, "tests")` and requires a pre-provider 1,000,000 character prompt limit that stops before the configured agent call.

## Design Principles
- Prefer direct contract tests around the existing helpers and provider-call boundary over broad prompt rewrites.
- Keep unit tests responsible for detailed prompt shape assertions and use e2e coverage only for process boundaries not visible at helper level.
- Make excluded inputs explicit in fixtures so regressions show which input source leaked into the prompt.

## Overview
### Modules
- `src/flow/commands/review.js` owns review-test input collection, prompt construction, prompt-size checks, and provider invocation for `flow run review --phase test`.
- `tests/unit/flow/commands/review.test.js` already covers part of the spec-local test-file collection contract and can be extended for shared regression coverage.
- `specs/282-review-test-input-contract/tests/` will hold spec-local coverage with requirement headers for the new contract tests.

### Data Flow
- review-test loads `spec.json`, generates or reads coverage context, collects spec-local test files, builds review prompts, checks prompt size, and only then calls the configured agent.
- gap-analysis and gap-fix prompt builders place stable test design text in `systemPrompt` and changing test code or gap text in `userPrompt`.

### Decisions
- [VERIFY] Source check: `collectTestFiles` collects only from the active spec's `tests/` directory.
- [VERIFY] Source check: review-test has a fixed prompt character limit of 1,000,000.
- [VERIFY] Source check: gap-analysis and gap-fix prompts keep `Test Design` in `systemPrompt`.
- Use unit tests for detailed prompt contract checks and e2e coverage only for provider boundary or CLI-path behavior not visible through exported helpers.
- Do not pin exact user-facing error wording for over-limit prompts.

## Clarifications (Q&A)
- Q: Should implementation change review-test behavior or mainly add tests?
  - A: Mainly add tests. Production changes are allowed only when needed to expose existing behavior to tests or keep the current contract observable.
- Q: What is the provider-boundary condition for over-limit prompts?
  - A: The configured agent must not be called when measured review-test prompt characters exceed `TEST_REVIEW_PROMPT_CHAR_LIMIT`.
- Q: How should e2e coverage be used?
  - A: Use e2e coverage only for CLI/process behavior not visible through unit tests; detailed prompt content assertions belong in unit or spec-local tests.

## Alternatives Considered
- Rewrite review-test prompt wording while adding contract tests. — Rejected because Issue #369 is about locking the current input contract, and wording changes would broaden the change beyond regression protection.
- Use only e2e tests for the contract. — Rejected because prompt structure and excluded input sources are more precise and cheaper to verify at unit/spec-local level.
- Assert exact over-limit error text. — Rejected because the required safety property is the provider-call boundary; exact wording can change without reintroducing input-too-large risk.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-06-06T14:13:51.456Z
- Notes: User approved gate-passed spec for Issue #369.

## Requirements
- R1 [must]: `collectTestFiles(root, specDir)` must include only `.test` or `.spec` JavaScript/TypeScript module files under `path.resolve(root, specDir, "tests")` and must not include project root `tests/`, `specs/<id>/tests/.raw/test-execution.log`, or `specs/<id>/spec.md` content.
- R2 [must]: `buildGapAnalysisPrompt(testDesign, testFiles)` and `buildTestFixPrompt(testDesign, gaps, testFiles)` must include `testDesign` in `systemPrompt` under `## Test Design` and must not include `## Test Design` in `userPrompt`.
- R3 [must]: review-test prompt size enforcement must use a 1,000,000 character limit and must stop before invoking the configured agent when the measured prompt exceeds that limit.
- R4 [must]: The normal `npm test` run must detect violations of R1, R2, and R3 through shared tests under `tests/unit` or `tests/e2e`; spec-local tests remain flow-local requirement coverage and are not required to be discovered directly by `npm test`.
- R5 [should]: The change must not alter review-test AI scoring, finding classification, auto-fix behavior, CLI options, or exit-code semantics.

## Acceptance Criteria
- R1: A regression test creates spec-local tests, project root tests, `.raw/test-execution.log`, and `spec.md` fixtures; the collected prompt input contains only spec-local `.test` or `.spec` module files.
- R2: Regression tests assert both gap-analysis and gap-fix prompt objects contain `## Test Design` in `systemPrompt` and do not contain `## Test Design` in `userPrompt`.
- R3: A regression test constructs review-test input over 1,000,000 characters and proves the configured agent call is not executed.
- R4: Shared tests under `tests/unit` or `tests/e2e` are added or updated so `npm test` fails if R1, R2, or R3 is broken; spec-local tests remain flow-local coverage.
- R5: Existing review-test command route and review artifact tests continue to pass without CLI option or exit-code expectation changes.

## Implementation Targets
- src/flow/commands/review.js
- tests/unit/flow/commands/review.test.js
- tests/e2e/flow/commands/
- specs/282-review-test-input-contract/tests/

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Lock collected inputs
  - Add regression coverage proving review-test input collection stays limited to spec-local test modules and excludes root tests, raw logs, and spec.md.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Lock prompt structure
  - Add regression coverage proving gap-analysis and gap-fix prompts keep `testDesign` in `systemPrompt` and do not copy `## Test Design` into `userPrompt`.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Lock prompt limit
  - Add regression coverage proving review-test prompt input over 1,000,000 characters stops before the configured agent call.
  - see `tasks/T-3.md` for full spec
