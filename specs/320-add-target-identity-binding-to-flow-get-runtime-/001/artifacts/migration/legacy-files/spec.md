# Feature Specification: 320-add-target-identity-binding-to-flow-get-runtime-

**Feature Branch**: `feature/320-add-target-identity-binding-to-flow-get-runtime-`
**Created**: 2026-07-12
**Status**: Draft
**Input**: GitHub Issue #438

## Goal
Make `senti flow get runtime-log` return runtime-log content only after an explicitly supplied flow identity resolves to one target and every supplied run ID, Issue, and spec expectation matches that target.

## Background
The runtime-log command currently parses only format, sequence, and log-block run ID options, loads flow state from the working context, and selects a spec-scoped or no-flow log file without proving the caller's intended flow identity. Other target-aware flow commands already normalize run ID, Issue, and spec expectations and return structured mismatch data. The missing integration blocks safe failure inspection when multiple active or preparing flows exist and is especially risky because preparing commands share the no-flow runtime-log file.

## Scope
- Add `--expect-run-id`, `--expect-issue`, and `--expect-spec` to the runtime-log command contract.
- Require at least one expectation while accepting any non-empty subset and validating every supplied identity.
- Resolve active and preparing flow targets without falling back to an unrelated current, active, or preparing flow.
- Return structured mismatch and not-found errors before runtime-log content can be emitted.
- Preserve successful raw and JSON output, block selection options, and read-only behavior.
- Add automated contract and regression coverage for identity binding, isolation, missing resources, output parity, and no mutation.

## Out of Scope
- Changing runtime-log writer, truncation, retention, or storage formats.
- Changing target semantics or option acceptance for any other `flow get` subcommand.
- Changing GitHub Issue or workflow-board integrations.
- Adding compatibility paths for a bare runtime-log read.

## Constraints
- Use only Node.js built-in modules and existing project libraries.
- Keep all `src/` behavior generic and free of project-specific paths, identities, or assumptions.
- Reuse the existing `FlowTargetExpectation` value type and structured `Envelope` contract.
- Model any additional constrained target-resolution value as a class whose constructor enforces its invariants.
- A runtime-log read must not mutate flow state, spec metadata, runtime-log content, Issue state, or board state; existing dispatcher command logging remains the only established lifecycle append.
- Do not add legacy fallback behavior when an explicit target is missing or mismatched.

## Design Principles
- Resolve one target authority before resolving its runtime-log file or block.
- Treat expectations as validation of a local flow context and as exact selection criteria only when no local flow context exists.
- Use the resolved target run ID to prevent shared or historical log files from returning another flow's block.
- Keep target resolution and log block selection distinct: `--expect-run-id` identifies the flow, while `--run-id` retains its runtime-log block-selection syntax.
- Keep the command read path independent of mutable lifecycle hooks.

## Overview
### Modules
- `src/flow/registry.js` declares runtime-log expectation options, help text, read-only target behavior, and structured argument parsing.
- `src/flow/lib/get-runtime-log.js` resolves the validated target and emits either unchanged raw/JSON log content or a structured failure envelope.
- `src/flow/lib/flow-context.js` provides opt-in exact preparing-target resolution for runtime-log without changing other command resolution.
- `src/lib/flow-target-guard.js` remains the owner of expectation normalization and `ACTIVE_FLOW_MISMATCH` data.
- `src/lib/runtime-log.js` remains the owner of runtime-log files, blocks, metadata, and selection behavior.

### Data Flow
- The registry parses at least one expectation plus existing block options, then the flow context resolver binds the local flow or selects one exact active/preparing target.
- The shared target expectation validates every supplied identity against the resolved target before the command derives a log file.
- The command selects only a block whose metadata belongs to the resolved target, then emits the existing raw text or JSON envelope unchanged.
- Argument, mismatch, missing-target, and missing-log failures emit structured JSON with no runtime-log content and no alternate target lookup.

### Decisions
- [VERIFY] Existing target expectations are independently optional and compare all supplied values; runtime-log requires a non-empty subset but reuses those comparison semantics.
- [VERIFY] Existing flow context selection uses expectations only when cwd has no flow state, so a local target can produce mismatch instead of redirecting to another flow.
- [VERIFY] Runtime-log storage is spec-scoped for active flows and `no-flow` scoped before a spec exists, so block metadata must bind preparing-flow reads.
- Accept any non-empty expectation subset so spec-less preparing flows remain diagnosable without creating a runtime-log-only three-flag requirement.
- Remove successful bare runtime-log reads; an explicit identity is required even inside a worktree.

## Clarifications (Q&A)
- Q: Are all three target expectations mandatory together?
  - A: No. At least one is mandatory, every non-empty subset is accepted, and every supplied identity must match.
- Q: Does `--expect-run-id` replace the existing `--run-id` option?
  - A: No. The expectation binds the flow target; `--run-id` retains log-block selection and optional `#sequence` parsing.
- Q: Can cwd or another active flow be used after explicit resolution fails?
  - A: No. Cwd is only a candidate local target that must pass expectations, and failed explicit selection never redirects to an unrelated flow.

## Alternatives Considered
- Require all three expectations on every call — Rejected because preparing flows have no spec and because it creates a runtime-log-only constraint inconsistent with existing target-aware comparison semantics.
- Validate the current worktree only — Rejected because the command must diagnose explicit active and preparing targets and cwd alone does not establish caller intent.
- Search another active flow after mismatch or not-found — Rejected because fallback can disclose the wrong runtime log and directly violates the target-binding goal.
- Treat `--expect-run-id` as an alias for `--run-id` — Rejected because flow identity resolution and log-block selection are separate public contracts and existing `--run-id` supports sequence syntax.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-07-12T23:21:13.634Z
- Notes: Approved: R1-R7 and AC1-AC9 define explicit identity matching, local/active/preparing isolation, structured mismatch/not-found behavior, shared-log block ownership, raw/JSON parity, no mutation, and regression protection for other get commands while keeping FlowTargetExpectation separate from runtime-log block selection.

## Requirements
- R1 [must]: The runtime-log command must accept `--expect-run-id`, `--expect-issue`, and `--expect-spec` using the existing target-aware types and validation, require at least one of them, and accept every non-empty subset.
- R2 [must]: The command must resolve exactly one local, active, or preparing target from the supplied identity; every supplied expectation must match, and missing, ambiguous, or mismatched input must not fall back to another flow.
- R3 [must]: Run ID, Issue, and spec mismatches against a resolved target must return `ACTIVE_FLOW_MISMATCH` with the existing expected/active identity data and no runtime-log content.
- R4 [must]: A missing or ambiguous explicit target must return a structured `FLOW_TARGET_NOT_FOUND` failure, and a target with no matching log block must return the existing `RUNTIME_LOG_NOT_FOUND` failure; neither failure may disclose another target's log.
- R5 [must]: After a target match, raw text, `--format json`, `--sequence`, `--run-id`, `runId#sequence`, conflict validation, latest non-runtime-log selection, and existing invalid-argument envelopes must retain their public behavior while selecting only blocks owned by the resolved target run ID.
- R6 [must]: Successful and failed runtime-log reads must not modify flow files, spec files, runtime-log content, metadata, Issue state, board state, or generated product artifacts beyond the dispatcher's established command-log append.
- R7 [must]: All other `flow get` subcommands must retain their existing options, target resolution, output envelopes, and mutation behavior.

## Acceptance Criteria
- AC1 (R1): Each single expectation and representative two- and three-expectation combinations are accepted; no expectation returns a structured argument error.
- AC2 (R2, R3): A local target with an incorrect run ID, Issue, or spec expectation returns the corresponding `ACTIVE_FLOW_MISMATCH` identity fields and never emits log text.
- AC3 (R2, R4): From a context without a local flow, an exact active or preparing identity selects only that target; missing and ambiguous identities return `FLOW_TARGET_NOT_FOUND` with no fallback.
- AC4 (R4): An existing target without a runtime-log file or matching block returns `RUNTIME_LOG_NOT_FOUND` and no content.
- AC5 (R2, R5): With multiple active/preparing flows and shared no-flow logs, only a block whose metadata run ID belongs to the resolved target can be returned.
- AC6 (R5): A full identity match returns byte-equivalent raw log content and the same JSON envelope fields as the pre-change command for the same selected block.
- AC7 (R5): Existing block-selection and invalid-argument tests for format, sequence, run ID, `runId#sequence`, and conflicts continue to pass.
- AC8 (R6): Before/after snapshots on success, mismatch, missing-target, and missing-log paths show no product-state or runtime-log mutation by the read command.
- AC9 (R7): The existing automated suites for every other `flow get` subcommand pass unchanged.

## Implementation Targets
- src/flow/registry.js
- src/flow.js
- src/flow/lib/get-runtime-log.js
- src/flow/lib/flow-context.js
- src/lib/flow-target-guard.js
- src/lib/runtime-log.js
- tests/
- specs/320-add-target-identity-binding-to-flow-get-runtime-/tests/

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Declare runtime-log target options
  - Expose the three expectation options and the explicit-target requirement through the runtime-log registry contract without changing adjacent get commands.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Resolve explicit runtime-log targets
  - Bind each read to one matching active or preparing flow authority and block access to unrelated target logs.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Preserve runtime-log read contracts
  - Retain successful content, block-selection, error, and read-only semantics after target binding.
  - see `tasks/T-3.md` for full spec
