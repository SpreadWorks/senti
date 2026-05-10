# Feature Specification: 256-guardrail-ack-exceptions

**Feature Branch**: `feature/256-guardrail-ack-exceptions`
**Created**: 2026-05-09
**Status**: Draft
**Input**: GitHub Issue #314

## Goal
Reflect explicit guardrail exception acknowledgments from spec.json in guardrail evaluation prompts so intentionally documented exceptions do not produce repeated guardrail FAIL loops.

## Background
Issue #314 identifies a recurring failure pattern: a spec explicitly acknowledges a guardrail collision, but guardrail evaluation still fails because the evaluator sees only guardrail articles and raw target content, not guardrail-specific rationale extracted from spec fields. Authors already write guardrail_id rationale in constraints, clarifications, and alternatives_considered. This spec formalizes that existing pattern without adding schema fields.

## Scope
- must: Extract matched rationale entries from spec.json constraints / clarifications / alternatives_considered using case-sensitive token-boundary guardrail_id matching, and render source JSON path plus text in a `## Matched Spec Acknowledgment Rationale` section.
- must: Add common acknowledged-exception clauses to backward-compatible-cli-interface, exit-code-contract, bounded-resource-usage, and no-synchronous-io-in-hot-paths. A matched rationale qualifies only when it is in a scanned field, includes the guardrail_id at least once, and has at least 20 non-whitespace characters after removing the guardrail_id.
- must: Inject the matched rationale section into run-gate spec / task-impl / integration guardrail eval prompts and the flow review review-phase guardrail prompt.
- must: Add raw markdown support to PromptBuilder or an equivalent shared prompt-building API so the matched rationale section is inserted once without duplicate headings.
- must: Forward acknowledged-rationale options through runGateFlow, checkGuardrail, and buildGuardrailArticleEvalPrompt for all guardrail article evaluation call sites.
- must: Preserve acknowledged-exception semantics when any preset-chain or project guardrail override replaces one of the four target guardrails.
- should: Document the author convention in `src/flow/prompts/plan/spec.md`, `src/flow/prompts/plan/gate.md`, `src/flow/prompts/plan/gate-draft.md`, `src/flow/prompts/impl/implement.md`, `src/flow/prompts/impl/gate-impl.md`, `src/flow/prompts/impl/review.md`, `src/flow/prompts/task/impl.md`, `src/flow/prompts/task/review.md`, `src/templates/skills/sdd-forge.flow/SKILL.md`, and in `src/flow/lib/run-gate.js` `buildGuardrailArticleEvalPrompt` rules: write the target guardrail_id directly in constraints / clarifications / alternatives_considered when acknowledging an exception.
- nice-to-have: Add tests across extractor matching, prompt rendering, phase integration, and guardrail article content using spec 228 as the existing fixture and synthetic fixtures for 235 / 229 collision cases.

## Out of Scope
- Adding new spec.json fields or changing the spec schema.
- Replacing the AI guardrail evaluator with a deterministic rules engine.
- Adding acknowledged-exception clauses to guardrails outside the four Issue #314 targets.
- Adding a new guardrail that scores rationale quality.
- Scanning design_principles, approval notes, issue-log text, or generated markdown for acknowledgments.
- Adding draft.json acknowledgment extraction or injecting matched rationale into draft-gate prompts; draft gate remains strict because spec.json does not exist yet.

## Constraints
- No external dependencies; use Node.js built-ins only.
- Do not change spec.json schema. Existing author fields are used: constraints, clarifications, alternatives_considered.
- Do not scan design_principles. This exclusion is intentional and must be covered by unit tests and author guidance.
- Matched rationale prompt growth is bounded: max 3 entries per guardrail, max 600 characters per entry, max 4000 characters for the whole matched rationale section.
- Token-boundary matching is case-sensitive. A guardrail_id matches only when both adjacent characters are absent or are not ASCII letters, digits, or hyphen.
- Canonical source paths for rendered entries are `$.constraints[N]`, `$.clarifications[N]`, and `$.alternatives_considered[N]`; pair entries use the parent object path, not child field paths.
- Rendering order is deterministic: guardrails follow the filtered guardrail order supplied to the helper; within each guardrail, entries follow scanned field order `constraints`, `clarifications`, `alternatives_considered`, with ascending array index inside each field.
- Entry text is normalized before qualification, truncation, and rendering by collapsing internal whitespace, newlines, and indentation to single spaces.
- The 4000-character section cap is applied at entry boundaries: render entries in deterministic order until the next full entry would exceed the cap, then stop without cutting markdown mid-entry.
- If `src/templates/skills/` files are changed, run `sdd-forge upgrade` and verify generated `.agents/skills/` and `.claude/skills/` diffs. Flow prompt and preset edits are verified by source diffs and tests.
- Preset-chain and project-level guardrail overrides replace earlier guardrails by id, so target guardrail acknowledgment clauses must be preserved by prompt-time augmentation or another deterministic guardrail-loading mechanism.

## Design Principles
- Keep extraction and rendering in a shared helper so run-gate and review prompts cannot drift.
- Represent meaningful values with classes: rationale entry and rationale set carry invariants and rendering behavior.
- Treat matched rationale as context. Exception permission is defined by the guardrail article clause, not by prompt injection alone.
- Use parser-like structured extraction from spec.json rather than searching rendered markdown or raw prompt text.
- Keep behavior additive for internal callers through optional options objects while removing no current CLI behavior.

## Overview
### Modules
- src/flow/lib/acknowledged-rationale.js — new shared helper containing AcknowledgedRationaleEntry, AcknowledgedRationaleSet, token-boundary matching, caps, source labels, and prompt section rendering.
- src/flow/lib/run-gate.js — passes parent spec context to guardrail article evaluation and renders matched rationale between Guardrail Articles and Content.
- src/lib/prompt-builder.js — provides raw markdown section insertion so pre-rendered rationale sections are not wrapped in duplicate headings.
- src/lib/guardrail.js — preserves the common acknowledged-exception clause for the four target guardrail IDs even when preset-chain or project guardrail overrides replace preset bodies.
- src/flow/commands/review.js — passes parent spec context into buildDraftSystemPrompt and renders matched rationale after Additional Guardrail Review Perspectives.
- src/presets/base/guardrail.json, src/presets/cli/guardrail.json, src/presets/node-cli/guardrail.json — receive common acknowledged-exception clauses for the four target guardrails.
- src/flow/prompts/plan/spec.md — documents the author convention for writing guardrail_id directly in scanned spec fields.
- src/flow/prompts/plan/gate.md and src/flow/prompts/impl/implement.md — steer remediation and implementation agents to the scanned acknowledgment fields and current task-impl / integration guardrail phases.
- src/flow/prompts/task/impl.md and src/templates/skills/sdd-forge.flow/SKILL.md — keep per-task implementation guidance and distributed command references aligned with task-impl / integration guardrail phases.
- src/flow/prompts/impl/gate-impl.md — tells task-impl / integration remediation agents how to record intentional exception rationale in scanned spec fields before rerunning gate.
- src/flow/prompts/impl/review.md and src/flow/prompts/task/review.md — tell review remediation agents where to record intentional review-phase guardrail exceptions before rerunning review.
- src/flow/prompts/plan/gate-draft.md — states draft gate is strict and spec.json acknowledgments are unavailable before spec generation.
- src/flow/lib/get-guardrail.js — renders guardrail ids in default markdown output so agents can cite exact guardrail_id values without requiring JSON mode.
- src/flow/registry.js — advertises guardrail lookup phases using VALID_GUARDRAIL_PHASES rather than broad flow phases.

### Data Flow
- Parent spec.json -> AcknowledgedRationaleSet.fromSpec(spec, guardrails) -> bounded per-guardrail entries -> `## Matched Spec Acknowledgment Rationale` markdown -> run-gate / review prompt.
- spec gate uses loaded spec.json directly; task-impl and integration load active flow state.spec; flow review injects rationale when parent spec context is available.
- runGateFlow receives prompt options from executeSpec / executeDiffBasedGate, forwards them to checkGuardrail, and checkGuardrail forwards them to buildGuardrailArticleEvalPrompt.
- PromptBuilder.addRaw(markdown) appends a pre-rendered section verbatim; callers use it for matched rationale so the helper-owned `## Matched Spec Acknowledgment Rationale` heading appears exactly once.
- buildGuardrailPrompt, buildGuardrailArticleEvalPrompt, checkGuardrail, and runGateFlow all accept the same optional prompt options object; empty options preserve current output.
- executeDiffBasedGate loads previously passed guardrail ids from issue-log, builds acknowledged-rationale prompt options, and passes both to its direct checkGuardrail call as distinct arguments.
- Previously passed IDs sent to guardrail article evaluation are intersected with the current filtered guardrail article ids; requirement retry state remains separate.
- When optional parent spec context is unavailable in review, helper returns `{ markdown: "", warning: "parent spec context unavailable" }`; no stderr or log warning is emitted.
- Parent spec load failures in diff-based gate and review are treated as unavailable acknowledgment context with warning metadata; spec gate keeps existing strict validation.

### Decisions
- [VERIFY] run-gate prompt currently lacks matched rationale section.
- [VERIFY] review prompt uses one system prompt builder for loop and single-call paths.
- [VERIFY] bounded-resource-usage includes review phase.
- [VERIFY] four target guardrails are in preset guardrail files.
- [VERIFY] spec authoring prompt source exists.
- [VERIFY] runGateFlow is a required forwarding layer.
- [VERIFY] PromptBuilder currently wraps every section with a caller-supplied header.
- [VERIFY] project guardrails override preset guardrails by id.
- [VERIFY] implementation prompt references retired impl guardrail phase.
- [VERIFY] default guardrail markdown hides ids.
- [VERIFY] per-task implementation has separate prompt guidance.
- [VERIFY] distributed flow skill command reference still lists impl.
- [VERIFY] guardrail lookup uses broader flow phases.
- [VERIFY] guardrail command help uses the same broad phase list.
- [VERIFY] gate-impl remediation prompt omits spec-field exception workflow.
- Impact on Existing Features: exported prompt builders keep empty-options output unchanged; `flow get guardrail impl` remains available as an alias to task-impl with exit code 0; invalid phases still fail with non-zero exit.
- Impact on Existing Features: adding acknowledged-exception clauses changes the text seen by all existing and future evaluations of the four target guardrails.
- Impact on Existing Features: default guardrail markdown headings change from `## Guardrail: <title>` to `## Guardrail: <title> (<id>)`.

## Clarifications (Q&A)
- Q: Does this add a new spec.json field?
  - A: No. The implementation uses existing constraints, clarifications, and alternatives_considered fields.
- Q: Is design_principles scanned for acknowledgments?
  - A: No. The initial scan surface follows Issue #314 Fix Policy: constraints, clarifications, and alternatives_considered only.
- Q: Does matched rationale automatically make a guardrail pass?
  - A: No. Matched rationale is prompt context. Exception semantics come from the target guardrail's acknowledgment clause.

## Alternatives Considered
- Add a dedicated acknowledged_exceptions field to spec.json. — Rejected because Issue #314 explicitly avoids schema changes and existing fields already carry author rationale.
- Search raw targetText or rendered spec.md for guardrail_id strings. — Rejected because spec.json is already loaded structurally in relevant phases and raw text matching loses field source labels.
- Limit prompt injection to the four target guardrails only. — Rejected because extraction and rendering can be generic while exception semantics remain limited to guardrails with a clause.
- Add the acknowledgment clause to every guardrail. — Rejected because it changes behavior outside Issue #314 and expands exception semantics too far.
- Scan design_principles as well. — Rejected for the initial implementation because Issue #314 Fix Policy names constraints, clarifications, and alternatives_considered as the prompt injection fields.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-05-09T14:39:59.579Z
- Notes: autoApprove: gate-passed spec approved

## Requirements
- R1 [must]: Add `src/flow/lib/acknowledged-rationale.js` with class `AcknowledgedRationaleEntry` constructor `(guardrailId, sourcePath, text, truncated = false)` and method `toPromptLines()`, plus class `AcknowledgedRationaleSet` for per-guardrail entry storage, token-boundary matching, caps, ordering, and rendering.
- R2 [must]: Implement `buildAcknowledgedRationaleSection({ spec, guardrails, heading = "Matched Spec Acknowledgment Rationale" })` returning `{ markdown: string, warning: string }`. If `spec` is null, return `{ markdown: "", warning: "parent spec context unavailable" }`.
- R3 [must]: Extractor scans only `constraints[]`, `clarifications[].q` plus `.a` as one pair entry, and `alternatives_considered[].option` plus `.reason` as one pair entry. It does not scan design_principles, approval notes, issue-log entries, generated markdown, or raw diff text.
- R27 [must]: The 20 non-whitespace-character qualification removes every token-boundary occurrence of the matched guardrail_id from the entry text before counting. Pair labels `Q:`, `A:`, `Option:`, and `Reason:` do not count toward the minimum; truncation happens after qualification. Repeated ids, id-only entries, and pair entries are covered by tests.
- R4 [must]: Matching is case-sensitive and token-boundary aware. A guardrail_id match is valid only when the previous and next characters are absent or are not ASCII letters, digits, or hyphen. Backtick, quote, colon, space, and newline count as valid delimiters.
- R5 [must]: Rendering adds `## Matched Spec Acknowledgment Rationale`, then `### <guardrail_id>`, then entries formatted as `- source: <json-path>` and `  text: <text>`. Canonical source paths are `$.constraints[N]`, `$.clarifications[N]`, and `$.alternatives_considered[N]`. Pair entries use fixed labels `Q: ... A: ...` and `Option: ... Reason: ...`. Entry text is normalized by collapsing internal whitespace, newlines, and indentation to single spaces before qualification, truncation, and rendering. Truncated entries append `[truncated]`.
- R6 [must]: Bound prompt growth with max 3 entries per guardrail, max 600 characters per entry, and max 4000 characters for the whole matched rationale section. Rendering order is filtered guardrail order, then scanned field order `constraints`, `clarifications`, `alternatives_considered`, then ascending array index. Apply the section cap at entry boundaries: render entries in deterministic order until the next full entry would exceed the cap, then stop without cutting markdown mid-entry. Tests assert rendered output does not exceed these caps.
- R7 [must]: Update `buildGuardrailArticleEvalPrompt(targetText, filtered, phase, role, previouslyPassedIds, options = {})` to accept optional `options.acknowledgedRationale` and render it after Guardrail Articles and before Content when markdown is non-empty.
- R26 [must]: Update exported `buildGuardrailPrompt(targetText, guardrails, phase, role, previouslyPassedIds, options = {})` to forward options to `buildGuardrailArticleEvalPrompt`; empty options preserve existing output.
- R8 [must]: Update `checkGuardrail` to accept the same optional options object and pass acknowledged rationale to `buildGuardrailArticleEvalPrompt`; existing callers without options keep current behavior.
- R17 [must]: Update `runGateFlow` to accept guardrail prompt options, including `acknowledgedRationale`, and forward them to `checkGuardrail` alongside `previouslyPassedIds`.
- R18 [must]: Add `PromptBuilder.addRaw(markdown)` or an equivalent shared prompt-builder API and use it for acknowledged rationale so the helper-owned `## Matched Spec Acknowledgment Rationale` heading is not duplicated or stripped by callers.
- R9 [must]: In `executeSpec`, build acknowledged rationale from the loaded parent spec.json and filtered guardrails, then pass it to guardrail article evaluation.
- R10 [must]: In `executeDiffBasedGate` for task-impl and integration, load parent spec.json from active `state.spec`, build acknowledged rationale from filtered guardrails, load previously passed guardrail IDs from issue-log, intersect them with the current filtered guardrail article IDs, and call `checkGuardrail(root, text, phase, role, previouslyPassedIds, options)` while keeping `previouslyPassedIds` distinct from the options object.
- R11 [must]: Update `buildDraftSystemPrompt(guardrails = [], options = {})` in `src/flow/commands/review.js` to render matched rationale immediately after `## Additional Guardrail Review Perspectives` when `options.acknowledgedRationale.markdown` is non-empty.
- R12 [must]: Flow review loads active parent spec.json when available and supplies acknowledged rationale to `buildDraftSystemPrompt` for both `runLoopReview` and the single-call review path. Missing or invalid parent spec context produces empty rationale plus warning metadata rather than a hard failure.
- R34 [must]: For task-impl / integration gates, missing, invalid JSON, or schema-invalid parent specs are treated as unavailable acknowledgment context and produce `{ markdown: "", warning: "parent spec context unavailable" }`; spec gate keeps existing strict spec validation.
- R13 [must]: Add common acknowledged-exception clause and one example sentence to target guardrail bodies in `src/presets/cli/guardrail.json`, `src/presets/base/guardrail.json`, and `src/presets/node-cli/guardrail.json`. The clause states that exception rationale applies only in phases where a matched rationale section is present, must be in scanned fields, include guardrail_id at least once, and contain at least 20 non-whitespace characters after removing guardrail_id.
- R19 [must]: Preserve the common acknowledged-exception clause for the four target guardrail IDs when any preset-chain or project guardrail override replaces an earlier entry, either by prompt-time augmentation in `src/lib/guardrail.js` or by another deterministic guardrail-loading mechanism. Clause preservation is idempotent: append only when the loaded body lacks the common clause.
- R14 [should]: Document the author convention in `src/flow/prompts/plan/spec.md` and in `buildGuardrailArticleEvalPrompt` rules: write the target guardrail_id directly in constraints, clarifications, or alternatives_considered when acknowledging a guardrail exception.
- R20 [should]: Update `src/flow/prompts/plan/gate.md` so gate remediation states that guardrail exception acknowledgments are detected only in constraints, clarifications, and alternatives_considered, must include the exact guardrail_id, and should not be recorded in design_principles or approval notes for this purpose.
- R23 [should]: Update `src/flow/lib/get-guardrail.js` markdown output to include each guardrail id next to the title, for example `## Guardrail: <title> (<id>)`, while preserving JSON output.
- R28 [must]: Update `src/flow/lib/get-guardrail.js` to validate guardrail lookup phases against `VALID_GUARDRAIL_PHASES`: `draft`, `spec`, `task-spec`, `task-impl`, `integration`, `test`, `lint`, and `review`. Preserve backward compatibility by mapping `sdd-forge flow get guardrail impl` to `task-impl` with exit code 0 and the same output as `task-impl`; unknown phases fail with non-zero exit and an error listing valid phases.
- R29 [must]: Update `src/flow/registry.js` `flow get guardrail` help to list guardrail article phases `draft|spec|task-spec|task-impl|integration|test|lint|review` and note `impl` as a backward-compatible alias for `task-impl`.
- R21 [should]: Update `src/flow/prompts/impl/implement.md` to fetch implementation guardrail articles using current phases `task-impl` and `integration` instead of the retired `impl` phase.
- R24 [should]: Update `src/templates/skills/sdd-forge.flow/SKILL.md` command reference to list current guardrail phases, including `task-impl` and `integration`, and rely on `sdd-forge upgrade` to propagate generated skill changes.
- R25 [should]: Update `src/flow/prompts/task/impl.md` to fetch and apply `task-impl` guardrails, reference the same scanned-field guardrail_id acknowledgment convention, and correct stale completion guidance that still says the next action advances to task.run-tests.
- R30 [should]: Update `src/flow/prompts/impl/gate-impl.md` so task-impl / integration gate remediation says intentional guardrail exceptions must be recorded in scanned spec fields with the exact guardrail_id before rerunning gate.
- R32 [should]: Update `src/flow/prompts/impl/review.md` and `src/flow/prompts/task/review.md` so review remediation says intentional review-phase guardrail exceptions must be recorded in scanned parent spec fields with the exact guardrail_id before rerunning review.
- R33 [must]: Document in `src/flow/prompts/plan/gate-draft.md` and spec author guidance that draft gate remains strict and out of scope for matched spec acknowledgment rationale because draft evaluation runs before spec.json exists; draft gate violations must be fixed directly or escalated, not acknowledged in draft.json.
- R15 [nice-to-have]: Add nice-to-have broad fixture coverage using exact existing fixture paths `specs/228-fix-baseline-exit-code/spec.json`, `specs/235-remove-flow-test-management/spec.json`, and `specs/229-test-runner-file-filter/spec.json`, plus synthetic fixtures when collision cases are not present in those files.
- R31 [must]: Add must-have unit tests for extractor matching, design_principles exclusion, prompt section ordering, empty acknowledged-rationale output preservation, section cap behavior, direct diff-gate previous-pass preservation, guardrail phase validation, target guardrail body clauses, override/idempotence clause preservation, and the `impl` alias.
- R22 [must]: Prompt rendering tests assert exact run-gate section order: previously passed guardrails when present, diff scope constraint when applicable, Guardrail Articles, Matched Spec Acknowledgment Rationale, then Content. Tests also assert empty acknowledged rationale preserves existing prompt output.
- R16 [must]: Because `src/templates/skills/sdd-forge.flow/SKILL.md` changes, run `sdd-forge upgrade` and verify generated `.agents/skills/sdd-forge.flow/SKILL.md` and `.claude/skills/sdd-forge.flow/SKILL.md` diffs match the template change. Flow prompt and preset guardrail edits are verified by tests and source diffs, not by upgrade output.

## Acceptance Criteria
- `npm test` passes.
- Unit tests prove `exit-code-contract` matches in `exit-code-contract` and `` `exit-code-contract` ``, and does not match `not-exit-code-contract-anymore`.
- Unit tests prove clarifications and alternatives are included as whole pair entries when either side contains the guardrail_id.
- Unit tests prove the 20 non-whitespace-character qualification removes all token-boundary guardrail_id occurrences before counting and excludes pair labels from the count.
- Unit tests prove multiline, Markdown, and indented rationale text is normalized to single-space text before qualification, truncation, and rendering.
- Unit tests assert exact source labels `$.constraints[N]`, `$.clarifications[N]`, and `$.alternatives_considered[N]`.
- Unit tests prove design_principles, approval notes, issue-log text, generated markdown, and raw diff text are not scanned.
- Prompt rendering tests assert the exact `## Matched Spec Acknowledgment Rationale` structure, source paths, pair labels, and `[truncated]` marker.
- Prompt rendering tests assert run-gate section order: Previously Passed Guardrails when present, Diff Scope Constraint when applicable, Guardrail Articles, Matched Spec Acknowledgment Rationale, then Content.
- Prompt rendering tests assert empty acknowledged rationale preserves the current prompt output byte-for-byte except for intentional PromptBuilder internal representation changes.
- Prompt rendering tests assert max 3 entries per guardrail, max 600 characters per entry, max 4000 characters for the section, and section-cap stopping at entry boundaries.
- Prompt rendering tests assert deterministic ordering by filtered guardrail order, scanned field order, and ascending array index.
- run-gate spec / task-impl / integration paths include matched rationale when parent spec has matching scanned entries.
- run-gate task-impl / integration and flow review paths treat missing, invalid, or schema-invalid parent spec context as empty acknowledged rationale with warning metadata; spec gate remains strict.
- run-gate task-impl / integration direct diff gate prompts preserve Previously Passed Guardrails when previous passes exist.
- run-gate task-impl / integration direct diff gate prompts filter previous passed IDs to current guardrail article IDs before rendering Previously Passed Guardrails.
- flow review loop and single-call paths include matched rationale in the system prompt when active parent spec context is available.
- The four target guardrail bodies contain the common acknowledgment clause and one example sentence each.
- A preset-chain override and a project guardrail override for target IDs still present the common acknowledged-exception clause to guardrail evaluation without duplicating it when the body already contains the clause.
- Must-have guardrail content tests assert all four target IDs contain the common clause and example sentence, and non-target guardrails do not gain acknowledged-exception semantics.
- Default `sdd-forge flow get guardrail <phase>` markdown output includes exact guardrail ids.
- `sdd-forge flow get guardrail impl` exits 0 and returns the same output as `task-impl`; unknown phases exit non-zero and list valid phases `draft|spec|task-spec|task-impl|integration|test|lint|review`.
- `src/flow/prompts/plan/spec.md` contains the author convention for direct guardrail_id acknowledgments.
- `src/flow/prompts/plan/gate.md` tells remediation agents that only constraints, clarifications, and alternatives_considered are scanned for exception acknowledgments.
- `src/flow/prompts/plan/gate-draft.md` says acknowledged exceptions are spec.json-only and draft gate violations must be fixed directly or escalated.
- `src/flow/prompts/impl/implement.md` and `src/flow/prompts/task/impl.md` fetch task-impl and integration guardrail articles instead of `impl` where relevant.
- `src/flow/prompts/impl/gate-impl.md` documents the scanned-field acknowledgment remediation path for intentional exceptions.
- `src/flow/prompts/impl/review.md` and `src/flow/prompts/task/review.md` document the scanned-field acknowledgment remediation path for intentional review-phase exceptions.
- Spec documentation states draft gate remains strict and out of scope for matched spec acknowledgment rationale.
- `src/templates/skills/sdd-forge.flow/SKILL.md` command reference lists task-impl and integration guardrail phases.
- `src/flow/registry.js` guardrail command help lists guardrail article phases and names `impl` as a task-impl alias.
- Every spec verification test file under `specs/256-guardrail-ack-exceptions/tests/` starts with a `// spec: R<N> ...` header.
- `sdd-forge upgrade` has been executed because the flow skill template changes, and generated skill diffs match the template change.

## Implementation Targets
- src/flow/lib/acknowledged-rationale.js
- src/flow/lib/run-gate.js
- src/flow/lib/get-guardrail.js
- src/flow/commands/review.js
- src/lib/prompt-builder.js
- src/lib/guardrail.js
- src/flow/prompts/plan/spec.md
- src/flow/prompts/plan/gate.md
- src/flow/prompts/plan/gate-draft.md
- src/flow/prompts/impl/implement.md
- src/flow/prompts/impl/gate-impl.md
- src/flow/prompts/impl/review.md
- src/flow/prompts/task/impl.md
- src/flow/prompts/task/review.md
- src/templates/skills/sdd-forge.flow/SKILL.md
- src/presets/base/guardrail.json
- src/presets/cli/guardrail.json
- src/presets/node-cli/guardrail.json
- specs/256-guardrail-ack-exceptions/tests/acknowledged-rationale.test.js

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Add rationale helper
  - Create a shared helper that extracts, bounds, and renders acknowledged guardrail rationale from spec.json.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Inject gate rationale
  - Wire matched rationale into run-gate guardrail article evaluation for spec, task-impl, and integration phases.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Inject review rationale
  - Wire matched rationale into flow review's review-phase guardrail system prompt.
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Update guardrail clauses
  - Add common acknowledged-exception clauses and one example sentence to the four Issue #314 target guardrail bodies.
  - see `tasks/T-4.md` for full spec
- **T-5** [pending]: Expose author convention
  - Document where spec authors must write guardrail_id acknowledgments.
  - see `tasks/T-5.md` for full spec
- **T-6** [pending]: Add rationale tests
  - Add deterministic tests covering extractor matching, prompt rendering, phase wiring, guardrail body content, and upgrade-sensitive outputs.
  - see `tasks/T-6.md` for full spec
- **T-7** [pending]: Align guardrail CLI phase handling
  - Keep guardrail lookup help, validation, markdown ids, and the retired impl phase compatible with current guardrail article phases.
  - see `tasks/T-7.md` for full spec
