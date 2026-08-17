# Feature Specification: 300-final-regression-skip

**Feature Branch**: `feature/300-final-regression-skip`
**Created**: 2026-06-15
**Status**: Draft
**Input**: GitHub Issue #391

## Goal
Run `final-regression` only when it adds regression evidence: reuse fresh same-flow full regression evidence from `test-execute`, skip non-runtime changes with a static proof, and fail closed to the existing full project regression path for stale, runtime-sensitive, config-sensitive, or unknown changes.

## Background
Issue #391 targets duplicate full project regression execution. In recent flows, `test-execute` ran full project regression because configuration forced it, then `final-regression` ran the same root command again before finalize. Existing code already has changed-file classification and test-execute regression evidence, but final-regression has no reuse or risk-based skip path and its artifact/schema/post-hook/report surfaces assume only pass/fail execution.

## Scope
- Define and implement same-flow `test-execute` full regression reuse for `final-regression`.
- Define and implement fail-closed risk-based `final-regression` skip for non-runtime-only changes.
- Extend `final-regression-result.json`, next-action schema, validation, report rendering, post-hook completion, finalize artifact handling, and prompts to represent executed and skipped outcomes.
- Add spec-local and shared tests for covered-by-test-execute skip, risk-based skip, runtime-sensitive run, stale evidence run, unknown change fail-closed, skipped artifact validation, post-hook completion, report rendering, and finalize artifact inclusion.

## Out of Scope
- Cross-flow last-known-green reuse is out of scope.
- CI, nightly, or release-time full regression orchestration is out of scope.
- Project-specific runtime path lists must not be hardcoded into `src/`.

## Constraints
- Use only Node.js built-in modules and existing project helpers.
- Do not preserve old alpha artifact formats with compatibility shims.
- Represent meaningful value shapes with dedicated classes where invariants or behavior are needed.
- `src/` changes must stay generic and must not embed this repository's project-specific runtime paths.
- If `src/flow/prompts/**`, `src/skills/**`, or preset/template sources are changed, run `senti upgrade` and keep the upgrade evidence artifact.

## Design Principles
- Prefer one current-run `final-regression-result.json` contract over split skip artifacts.
- Treat skip as an audited decision, not as absence of evidence.
- When classification cannot prove skip eligibility, run the existing full project regression command.

## Overview
### Modules
- `src/flow/lib/run-final-regression.js` owns final regression execution, failure classification, raw attempt logs, result artifacts, and the run envelope.
- `src/flow/lib/run-test-execute.js` owns spec-local execution and writes `test-execute-result.json` version 2, including project regression mode, result, command, changed files, and trigger-relevant changed files.
- `src/flow/lib/test-regression.js` owns changed-file classification, command discovery, test policy planning, and process execution helpers used by both `test-execute` and `final-regression`.
- `src/flow/lib/test-artifacts.js`, `src/flow/schemas/next-action/final-regression.schema.json`, `src/flow/registry.js`, and `src/flow/commands/report.js` are retained public surfaces for artifact validation, envelope schema, step completion, and reporting.

### Data Flow
- `test-execute` runs spec-local tests, optionally runs targeted/full project regression, and writes `test-execute-result.json` with `regression` evidence.
- `final-regression` lists current changed files, discovers the root regression command, evaluates skip eligibility, then either writes a skipped artifact with proof or runs the command and writes pass/fail evidence.
- Downstream consumers read `final-regression-result.json` and must be able to distinguish `result: "pass"`, `result: "fail"`, and `result: "skipped"` with `skipKind`.

### Decisions
- [VERIFY] `run-test-execute.js` writes v2 regression evidence that includes required/mode/result/command/changed-file fields.
- [VERIFY] `run-final-regression.js` currently discovers the root command and always executes it when the worktree root check passes.
- [VERIFY] current final-regression validation and next-action schema only allow pass/fail.
- Fresh covered-by-test-execute reuse requires full/pass same-flow evidence, matching root command/source, and no current trigger-relevant changed file outside the test-execute artifact.
- Risk-based skip is limited to non-runtime classifications and must fail closed for package/config/test runner/runtime source/external integration/unknown files.
- Skipped final-regression uses the current-run `final-regression-result.json` contract with `result: "skipped"`, `skipKind`, and proof fields.
- Cross-flow last-known-green reuse is excluded from this spec.
- Impact on existing features: `run-final-regression.js` keeps existing full regression execution as the fail-closed fallback and adds two pre-execution skip decisions.
- Impact on existing features: final-regression artifact validation and next-action schema accept `result: "skipped"` in addition to existing pass/fail results.
- Impact on existing features: registry and flow-judgment completion add a skipped completion path without changing pass/fail completion semantics.
- Impact on existing features: report and finalize handling preserve skipped evidence while retaining existing executed final-regression artifacts.
- Impact on existing features: `run-test-execute.js` and `test-regression.js` expose same-flow command identity and changed-file fingerprints for final-regression freshness checks.

## Clarifications (Q&A)
- Q: Can final-regression reuse full regression evidence from previous flows?
  - A: No. Cross-flow last-known-green reuse is explicitly out of scope for this spec.
- Q: What happens when skip proof is incomplete?
  - A: Final-regression runs the existing full project regression command instead of skipping.

## Alternatives Considered
- Always run final-regression — Rejected because it preserves the duplicate full regression cost that Issue #391 targets.
- Store skip proof in a separate artifact — Rejected because downstream validator, report, and finalize paths already consume `final-regression-result.json` as the current-run contract.
- Reuse cross-flow last-known-green evidence — Rejected for this scope because it requires additional freshness assumptions about prior commands, dependencies, base branches, and runtime environments.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-06-15T09:52:25.570Z
- Notes:

## Requirements
- R1 [must]: Final-regression must skip with `skipKind: "covered_by_test_execute_full_regression"` only when same-flow `test-execute-result.json` has `version: "2"`, `regression.required: true`, `regression.mode: "full"`, and `regression.result: "pass"`; the current full command identity exactly matches the stored identity on keys `command`, `commandSource`, `argv`, `env`, `source`, `metadata`, `resolvedScriptDigest`, and `resolvedConfigDigest`; string and null values compare by exact value, `argv` compares by same length and same string at each index, and `env`/`metadata` compare by exact key set plus exact JSON primitive value for each key after sorting keys for comparison only; and the current trigger-relevant changed-file fingerprint set exactly equals the fingerprint set captured with that full regression evidence. No subset of command identity keys is sufficient.
- R2 [must]: Final-regression must skip with `skipKind: "risk_based_static_proof"` only when every current changed path is in the explicit non-runtime allowlist: spec artifacts whose relative path starts with the current flow spec directory prefix `specs/300-final-regression-skip/` and does not resolve outside that directory; documentation markdown files matching `docs/**/*.md`, `docs/**/*.mdx`, top-level `*.md`, or top-level `*.mdx`; flow prompt files under `src/flow/prompts/**`; skill/template/preset source paths with `senti upgrade` evidence when changed; or generic test-only files that `classifyRegression()` classifies as non-runtime test files by existing patterns `tests/**`, `test/**`, `**/*.test.js`, or `**/*.spec.js`, excluding package/config/test-runner/dependency/runtime-source/external-integration classifications. A targeted or full `test-execute` regression artifact covers a generic test-only changed file only when the same-flow `test-execute-result.json` has `version: "2"`, `regression.result: "pass"`, `regression.mode` of `"targeted"` or `"full"`, and `regression.changed_files` contains the exact current path plus fingerprint for that file. All non-allowlisted paths, package/config/test runner/runtime source/external integration paths, unknown paths, and changed test files without exact same-flow path-plus-fingerprint coverage must run full regression.
- R3 [must]: Skipped `final-regression-result.json` must use `version: "1"`, `completed: true`, `result: "skipped"`, `failureKind: null`, `skipKind`, `reason`, `command`, `commandSource`, `rawOutputPath`, `rawOutputLines`, `process`, `changedFiles`, `retryable: false`, `nextAction: "finalize-commit"`, and `proof`. For skipped artifacts, `rawOutputPath` is the retained skip decision log path matching `tests/.raw/final-regression-attempt-*.log`, `rawOutputLines` is a `{ start, end }` range for the decision lines written to that log, and `process` is `{ started: false, exitCode: null, signal: null, timedOut: false, spawnError: null }`. For `covered_by_test_execute_full_regression`, `proof` must be `{ kind: "covered_by_test_execute_full_regression", reusedArtifactPath, commandIdentity, changedFileFingerprints, staleCheck }`, where `commandIdentity` contains the R1 identity keys, `changedFileFingerprints` is an array of `{ path, fingerprint }`, and `staleCheck` is `{ sameFlow: true, commandIdentityMatched: true, changedFileFingerprintsMatched: true }`. For `risk_based_static_proof`, `proof` must be `{ kind: "risk_based_static_proof", allowlistClassifications, checkedSensitivePathClasses, failClosedDecision, upgradeEvidencePath, testExecuteEvidencePath }`, where `allowlistClassifications` is an array of `{ path, category, fingerprint }`, `checkedSensitivePathClasses` is an array of class names that were ruled out, `failClosedDecision` is `{ eligible: true, fallbackReasons: [] }`, and evidence paths are string paths or null.
- R4 [must]: `validateFinalRegressionResult()`, the final-regression next-action schema, `contractFromFinalRegressionArtifact()` / flow-judgment completion policy, and the registry post-hook must accept skipped artifacts and mark `final-regression` done when `completed: true`, `result: "skipped"`, `failureKind: null`, valid `skipKind`, and `nextAction: "finalize-commit"` are present.
- R5 [must]: Report and finalize handling must preserve skipped final-regression evidence: report JSON/text exposes `result` and `skipKind`, and finalize durable artifact handling includes `final-regression-result.json` plus the retained raw skip decision log path under `tests/.raw/final-regression-attempt-*.log`.
- R6 [must]: `src/flow/prompts/impl/test-execute.md` must list spec-local, targeted, explicit-full, and deferred final-regression responsibilities; `src/flow/prompts/impl/final-regression.md` must list executed, covered-by-test-execute skip, and risk-based skip outcomes with required artifact fields.
- R7 [should]: The implementation must keep cross-flow last-known-green reuse out of scope; no code path may reuse full regression evidence from a prior flow or prior invocation outside the current flow.

## Acceptance Criteria
- Covered-by-test-execute skip writes a skipped final-regression artifact when same-flow full/pass evidence, command identity, and changed-file fingerprints all match current final-regression inputs.
- Stale evidence runs full regression when any command identity field differs by the R1 comparison rules, script/config digest differs, changed-file fingerprint differs, or any current trigger-relevant changed file lacks matching test-execute evidence.
- Risk-based skip writes a skipped artifact only when every changed path is matched by the explicit non-runtime allowlist and all required upgrade or exact same-flow path-plus-fingerprint targeted/full test-execute evidence exists.
- Runtime-sensitive, config-sensitive, test-runner, dependency, external integration, and unknown changes run full regression as before.
- Skipped artifacts validate through `validateFinalRegressionResult()` and next-action schema and advance the flow to `finalize-commit` through the post-hook.
- Report JSON contains `finalRegression.result`; when `finalRegression.result` is `"skipped"`, report JSON contains `finalRegression.skipKind` equal to `"covered_by_test_execute_full_regression"` or `"risk_based_static_proof"`, and text report output includes both `result: skipped` and the concrete `skipKind` value.
- Finalize artifact handling retains skipped final-regression result and raw decision evidence in the durable artifact set.
- Prompt guidance names the changed responsibilities and outcomes, and `senti upgrade` is run if prompt source changes require deployed skill/template updates.

## Implementation Targets
- src/flow/lib/run-final-regression.js
- src/flow/lib/run-test-execute.js
- src/flow/lib/test-regression.js
- src/flow/lib/test-artifacts.js
- src/flow/schemas/next-action/final-regression.schema.json
- src/flow/registry.js
- src/flow/commands/report.js
- src/flow/prompts/impl/test-execute.md
- src/flow/prompts/impl/final-regression.md
- specs/300-final-regression-skip/tests/final-regression-skip.test.js
- tests/unit/flow/final-regression.test.js
- tests/unit/flow/test-regression-policy.test.js

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Add final-regression skip planning
  - Introduce final-regression decision logic for same-flow full regression reuse and fail-closed risk-based skip.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Extend skipped artifact contract
  - Extend final-regression artifact validation and downstream consumers to accept and display skipped outcomes.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Refresh flow prompt guidance
  - Update implementation prompts so agents understand test-execute responsibilities and final-regression executed/skipped outcomes.
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Cover regression skip behavior
  - Add focused spec-local and shared regression tests that lock the new final-regression execution policy and artifact contract.
  - see `tasks/T-4.md` for full spec
