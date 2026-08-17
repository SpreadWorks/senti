# Feature Specification: 279-reduce-gate-impl-prompt-size

**Feature Branch**: `feature/279-reduce-gate-impl-prompt-size`
**Created**: 2026-06-05
**Status**: Draft
**Input**: GitHub Issue #365

## Goal
Reduce gate-impl prompt volume for file-map based requirement checks by sending only target requirement excerpts and batching requirements that share the same diff context.

## Background
gate-impl is the highest prompt-volume phase in the recorded prompt logs for Issue #365. The measured total is 1,185 calls and 240,933,661 chars, with 28,735,082 chars from the Spec portion alone. The existing file-map path narrows diffs per requirement, but each requirement call still sends the full spec rendered by specJsonToPromptText. Recent specs show requirement JSON text is hundreds of chars per requirement while full spec.md files are over ten thousand chars, so requirement excerpts can remove repeated unrelated spec context.

## Scope
- [must] Change gate-impl requirement checks with a file-map so the requirement-check prompt contains target requirement excerpts instead of full spec text.
- [must] Batch multiple requirements that share the same related diff context within a fixed character limit, with a documented single-requirement overflow rule.
- [must] Keep retry skips for previously passed requirements and skip requirements with no related diff before any AI call.
- [must] Keep the no-file-map path as the existing bulk requirement check fallback.
- [must] Preserve the external gatePass/gateFail artifact shape and requirement evaluation fields.

## Out of Scope
- Prompt optimization for phases other than gate-impl.
- Guardrail-check prompt redesign after requirement checks pass.
- AI provider configuration, agent execution behavior, and prompt log aggregation tooling.
- Public CLI command names, options, exit-code contracts, npm publish, and dist-tag operations.

## Constraints
- Node.js built-in modules only; no dependency additions.
- New meaningful values for requirement excerpts or gate batches shall be represented by dedicated classes that enforce constructor invariants and expose behavior such as prompt rendering or fit checks.
- Batching shall be bounded by a named character limit constant so prompt construction cannot grow without an explicit cap.
- No public CLI interface changes; existing gate command success and failure semantics remain unchanged.
- gatePass/gateFail return artifact shape remains unchanged for external consumers.

## Design Principles
- Use requirement-level context for requirement-level checks; do not resend unrelated spec sections when a file-map already narrows the diff.
- Group requirements only when their related diff context is identical so each AI call receives a coherent requirement set and diff.
- Keep skip decisions before prompt construction to avoid spending calls on previously passed or unrelated requirements.
- Test prompt content and call counts with deterministic mocked agents instead of relying on live provider behavior.

## Overview
### Modules
- src/flow/lib/run-gate.js — update buildImplCheckPrompt, buildPerRequirementDiffs consumers, and executeDiffBasedGate's file-map requirement path.
- src/lib/spec-json.js — existing requirement data remains the source for requirement ids and requirement descriptions used by the gate prompt.
- specs/279-reduce-gate-impl-prompt-size/tests/ — spec-local tests cover prompt excerpts, batching, fallback behavior, skip behavior, and return shape preservation.

### Data Flow
- spec.json requirements → requirement excerpt objects → RequirementGateBatch objects → buildImplCheckPrompt → agent.call → parseImplRequirementEvaluation → gatePass/gateFail evaluations.
- file-map + per-file diffs → per-requirement related diff text → identical diff-context grouping → bounded multi-requirement batches or single-requirement overflow batches; no file-map skips grouping where trust checks permit fallback.
- previously passed requirement ids and empty related diffs are resolved before batch construction, so those requirements do not invoke the AI agent.

### Decisions
- [VERIFY] buildImplCheckPrompt currently receives full spec text and adds it as a Spec section for requirement checks.
- [VERIFY] The file-map path already computes per-requirement diffs but still sends the same full spec text for each per-requirement call.
- [VERIFY] Previous PASS and empty related diff skips already happen before per-requirement AI calls and must remain before batching.
- Prompt reduction shall be verified by prompt content and character-count assertions, not by live cost totals.
- Single-requirement related diff overflow is allowed only when the indivisible diff plus excerpt exceeds the batch limit; the existing gate diff cap remains the upper bound.
- Integration gate must preserve artifact trust checks before no-file-map fallback. Missing file-map.json remains a structural integration failure before requirement agent calls.
- Impact on existing features: gate-impl requirement prompt content and file-map requirement call grouping change. Existing no-file-map task-impl fallback, integration trust-input failure, skip reasons, and gatePass/gateFail artifact shape remain unchanged.
- A dedicated batch class is required for the new batch value because project rules prohibit object-literal structural typing for meaningful values.

## Clarifications (Q&A)
- Q: Should acceptance include prompt volume measurement conditions?
  - A: Yes. The spec requires tests or deterministic prompt builder checks that show file-map requirement prompts use requirement excerpts and do not include full spec text.
- Q: What happens when same-diff requirements exceed the batch character limit?
  - A: Multi-requirement groups are split into multiple batches within the configured character limit. If one requirement's indivisible related diff plus excerpt exceeds the limit, that requirement is sent alone as an overflow batch bounded by the existing diff cap.

## Alternatives Considered
- Keep sending full spec text for every file-map requirement call — Rejected because it preserves the measured Spec portion retransmission that Issue #365 identifies as the root prompt-volume problem.
- Use only per-requirement prompts without batching — Rejected because requirements sharing identical diff context can be checked together without losing context, reducing call count while preserving bounded prompt size.
- Batch requirements without a character limit — Rejected because bounded-resource-usage requires explicit size limits for bulk prompt construction.
- Change prompt log aggregation to hide gate-impl volume — Rejected because the target problem is prompt construction volume in gate-impl, not reporting.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-06-05T01:08:42.927Z
- Notes: User approved the gate-passed spec with option [1].

## Requirements
- R1 [must]: When a file-map exists, gate-impl requirement checks build the requirement prompt from only the target requirement excerpts instead of the full specJsonToPromptText output. Each excerpt includes the requirement id, desc, priority when present, and an explicit testing-not-required marker only when testable is false.
- R2 [must]: When a file-map exists, requirements that share the same related diff context are grouped into RequirementGateBatch instances. Multi-requirement batch prompts stay within MAX_IMPL_REQUIREMENT_BATCH_CHARS = 120000 characters for the rendered requirement excerpt section plus related diff section. If a same-context group exceeds the limit, it is split into multiple batches. If one requirement's indivisible related diff plus excerpt exceeds 120000 characters, it is sent as a single-requirement overflow batch and remains bounded by the existing TASK_IMPL_GATE_DIFF_MAX_BYTES = 1048576 diff cap.
- R3 [must]: The file-map gate-impl path preserves pre-call skips: requirements listed in previous passed guardrails are emitted as pass with reason `previously passed (skipped on retry)`, and requirements whose related diff is empty are emitted as skip with reason `no related diff found`; neither case invokes agent.call.
- R4 [must]: When no file-map exists in a gate phase that permits requirement checking without file-map trust input, gate-impl keeps the existing bulk requirement check behavior: build one requirement prompt from the full spec text and full diff, call agent.call once, and parse evaluations for all usable requirement ids. Integration gate preserves the existing file-map.json trust-input validation and fails structurally before requirement agent calls when that trust input is missing.
- R5 [must]: The external gate result shape is unchanged. gatePass/gateFail artifacts still expose requirement evaluations with guardrail_id, result, reason, title, and category fields, and no new required top-level artifact fields are added for callers.
- R6 [must]: Spec-local tests under specs/279-reduce-gate-impl-prompt-size/tests/ verify prompt-volume behavior without live AI providers. Each spec-local test file includes a `// spec: R<N> ...` header. Coverage verifies file-map prompts omit unrelated full spec text, target requirement prompt content is less than 50% of the full spec fixture character count, batching reduces or maintains agent call count relative to checked requirements, multi-requirement batch splitting obeys the 120000 character limit, single-requirement overflow is explicit, and integration missing-file-map trust failure remains before requirement agent calls.

## Acceptance Criteria
- A file-map gate-impl requirement prompt for a single target requirement includes that requirement id and desc, and excludes another unrelated requirement desc from the same spec fixture.
- A file-map gate-impl requirement prompt does not contain the full specJsonToPromptText output when target requirement excerpts are available.
- Requirements with identical related diff context are sent in one agent.call when the rendered requirement excerpt section plus related diff section is within 120000 characters.
- A same-context requirement group whose rendered requirement excerpt section plus related diff section exceeds 120000 characters is split into multiple agent.call batches; every multi-requirement batch is at or below 120000 characters for those sections.
- A single requirement whose indivisible related diff plus excerpt exceeds 120000 characters is sent as one overflow batch, and the test asserts the overflow contains exactly one requirement id and remains subject to TASK_IMPL_GATE_DIFF_MAX_BYTES = 1048576.
- The number of requirement agent.call invocations in the file-map path is less than or equal to the number of checked requirements after previously passed and empty-diff skips are removed.
- Previously passed requirements and requirements with empty related diffs produce the existing pass/skip evaluations and do not call the agent.
- When file-map is absent or empty in task-impl broad requirement checking, the bulk path calls the agent once with full spec text and full diff for all usable requirement ids.
- When integration gate is missing file-map.json as a trust input, the existing structural trust failure occurs before any bulk fallback agent.call.
- gatePass/gateFail artifacts for requirement checks keep the same top-level shape and evaluation field names used before this spec.
- Existing affected features are explicitly preserved: no-file-map task-impl bulk fallback, integration file-map trust failure, previously passed skip reason, empty related diff skip reason, and gatePass/gateFail artifact shape.
- Every spec-local test file under specs/279-reduce-gate-impl-prompt-size/tests/ includes a `// spec: R<N> ...` header.
- node --test specs/279-reduce-gate-impl-prompt-size/tests/*.test.js passes.
- npm test passes.

## Implementation Targets
- src/flow/lib/run-gate.js
- specs/279-reduce-gate-impl-prompt-size/tests/

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Model requirement excerpts
  - Represent target requirement prompt content as dedicated classes and update the requirement check prompt to consume excerpts instead of full spec text in the file-map path.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Apply batched gate execution
  - Batch file-map requirement checks by identical related diff context within the character limit while preserving existing skip and fallback behavior.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Cover prompt reduction
  - Add spec-local regression tests that verify prompt size reduction conditions and project regression coverage for the gate-impl prompt changes.
  - see `tasks/T-3.md` for full spec
