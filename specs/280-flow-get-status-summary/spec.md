# Feature Specification: 280-flow-get-status-summary

**Feature Branch**: `feature/280-flow-get-status-summary`
**Created**: 2026-06-05
**Status**: Draft
**Input**: GitHub Issue #363

## Goal
`sdd-forge flow get status` の既定出力を current status summary に絞り、監査用の詳細 data は `--details` で取得できるようにする。

## Background
`flow get status` currently mixes current-state data with audit history. The default payload includes progress tables needed by operational skills, but also raw append-only `metrics`, `notes`, `metricsSummary`, broad mode history, and stop-detail fields. Since metrics grow as the flow runs, the default status payload grows with audit history and normal status checks become harder to read. This spec keeps the current-state contract used by `sdd-forge.flow-status` while moving audit data behind an explicit option.

## Scope
- `flow get status` の既定 output contract の summary 化。
- raw `metrics`, `notes`, `metricsSummary`, broad mode history, `request`, `reviewStop`, `gateStop` を取得する `--details` option の追加。
- context-based status と `flow get status <runId>` の同一 summary/details contract 化。
- 既定出力と `--details` 出力の差分を固定する spec-local tests と既存 shared tests の更新。
- `flow get status --help` の `--details` 案内追加。

## Out of Scope
- `flow get next-action` や `flow run` 系 command の output contract 変更。
- metrics の保存形式、記録タイミング、集計アルゴリズムの変更。
- workflow board 連携の仕様変更。
- docs 自動生成の実行。

## Constraints
- No external dependencies. Use Node.js built-ins and existing CLI registry/command patterns only.
- Default status output must preserve the fields consumed by `sdd-forge.flow-status`: `steps`, `requirements`, `stepsProgress`, `requirementsProgress`, and `autoApprove`.
- `active:false` with no active flow remains a successful normal response and must not require `--details`.
- Migration Plan for backward-compatible-cli-interface: consumers that read removed default fields must switch in the same release to `sdd-forge flow get status --details` or `sdd-forge flow get status <runId> --details`.
- Migration Plan for backward-compatible-cli-interface: alpha policy allows the default payload breaking change; do not add a compatibility shim that keeps the old default payload.
- User input validation for validate-user-input-at-entry-point: `--details` is a user-facing boolean flag with no value; values attached to it are not part of the accepted interface.
- User input validation for validate-user-input-at-entry-point: `runId` is an optional user-facing positional string argument, accepted as one non-empty CLI token from 1 to 200 characters, treated as an opaque exact lookup key; an unmatched `runId` fails with non-zero exit status.
- Unknown options must continue to fail at the CLI entry point with a non-zero exit code and status help guidance.
- Exit code contract: valid `flow get status`, valid `flow get status --details`, and valid `flow get status <runId> --details` return success; unknown options and unknown runId continue to fail with non-zero exit status.

## Design Principles
- Make default status cheap to read by keeping it focused on current flow state, not audit history.
- Keep the detailed audit view available through an explicit command option instead of deleting data from the command surface.
- Keep context-based and runId-based status resolution behavior aligned so consumers do not learn two payload contracts.

## Overview
### Modules
- `src/flow/lib/get-status.js`: builds status payloads, progress counts, requirement progress, retry recovery views, and metrics summary.
- `src/flow/registry.js`: registers `flow get status` arguments/options and help text.
- `tests/unit/flow/get-status.test.js` and spec-local tests: verify default/details payload contracts and runId parity.
- `tests/unit/flow/get-unknown-options.test.js`: verifies unknown option failure; update only as needed to keep the contract.

### Data Flow
- CLI parses `flow get status [runId] [--details]`, validates known options, and passes the details flag into `GetStatusCommand`.
- `GetStatusCommand` resolves either active context state or runId state, computes current status fields, and conditionally attaches audit/detail fields only when `--details` is true.
- Default output omits raw append-only history and derived audit summaries. `--details` output includes the default fields plus the detailed audit fields.

### Decisions
- [VERIFY] `get-status.js` currently returns raw metrics, notes, metricsSummary, broadModeHistory*, request, reviewStop/gateStop, and retryRecovery in the default payload; result=match.
- [VERIFY] `flow get status` currently has positional `runId` and no detailed-output option; result=match.
- Default output excludes `metricsSummary`; `metricsSummary` is moved to `--details` with raw `metrics` because it is an audit view derived from append-only metrics.
- The detailed audit option is named `--details`.
- `request` moves to `--details`; `mergeStrategy` remains in default output.
- `retryRecovery` remains in default output; `reviewStop` and `gateStop` move to `--details`.

## Clarifications (Q&A)
- Q: Should `metricsSummary` remain in the default status output?
  - A: No. It moves to `--details` because it is an audit summary derived from raw metrics.
- Q: What is the explicit detailed-output option name?
  - A: `--details`.
- Q: What happens to `request`, `mergeStrategy`, `reviewStop`, `gateStop`, and `retryRecovery`?
  - A: `request`, `reviewStop`, and `gateStop` move to `--details`; `mergeStrategy` and `retryRecovery` remain in default output.

## Alternatives Considered
- Keep `metricsSummary` in default output. — Rejected because it weakens the payload boundary; `metricsSummary` is derived audit information and belongs with raw `metrics` in `--details`.
- Use `--verbose` instead of `--details`. — Rejected because `--verbose` is broader than the chosen JSON details contract and could conflict with future human-facing verbosity.
- Keep all recovery fields in default output. — Rejected because `reviewStop` and `gateStop` are detailed stop fields; default output keeps only `retryRecovery` as the current recovery summary.
- Maintain the old default payload as a compatibility shim. — Rejected under the alpha policy and backward-compatible-cli-interface migration plan: consumers migrate to `--details` in the same release.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-06-05T06:06:57.514Z
- Notes: User approved spec after spec gate PASS.

## Requirements
- R1 [must]: Default `sdd-forge flow get status` for an active flow returns current status fields only: `active`, `spec`, `baseBranch`, `featureBranch`, `worktree`, `issue`, `runId`, `phase`, `steps`, `stepsProgress`, `requirements`, `requirementsProgress`, `mergeStrategy`, `autoApprove`, and `retryRecovery` when a retry recovery view exists.
- R2 [must]: Default `sdd-forge flow get status` for an active flow omits audit/detail fields: `notes`, `metrics`, `metricsSummary`, `request`, `reviewStop`, `gateStop`, `broadModeHistory`, `broadModeHistoryTotal`, and `broadModeHistoryTruncated`.
- R3 [must]: `sdd-forge flow get status --details` for an active flow returns the default current status fields plus `notes`, `metrics`, `metricsSummary`, `request`, `reviewStop` when present, `gateStop` when present, `broadModeHistory`, `broadModeHistoryTotal`, and `broadModeHistoryTruncated`.
- R4 [must]: `sdd-forge flow get status <runId>` and `sdd-forge flow get status <runId> --details` apply the same default/details field contract as context-based status resolution.
- R5 [must]: When no active flow exists, default `sdd-forge flow get status` still succeeds with `{ active: false }`; adding `--details` does not require an active flow and does not change the inactive contract.
- R6 [must]: `flow get status` accepts the user-facing boolean flag `--details`, documents it in help text, validates optional positional `runId` as an opaque non-empty string token from 1 to 200 characters, preserves existing unknown-option failure behavior, and preserves non-zero failure for an unmatched runId.
- R7 [must]: Default status generation does not build or attach `metricsSummary` unless `--details` is requested.
- R8 [must]: Spec-local tests under `specs/280-flow-get-status-summary/tests/` cover the default/details payload contract with `// spec: R<N>` headers, and shared regression tests are updated where production command contracts change.

## Acceptance Criteria
- AC1 (R1, R2): A unit/spec-local test creates an active flow with notes, metrics, request, and broad mode history, runs `flow get status`, and asserts current status fields are present while `metrics`, `metricsSummary`, `notes`, `request`, `reviewStop`, `gateStop`, and broad mode history fields are absent.
- AC2 (R3): A unit/spec-local test runs `flow get status --details` against the same flow and asserts raw `metrics`, `metricsSummary`, `notes`, `request`, and broad mode history fields are present while current status fields remain present.
- AC3 (R4): A test resolves the same flow by runId and verifies default runId output omits audit/detail fields while `flow get status <runId> --details` includes them.
- AC4 (R5): Existing inactive-flow behavior remains covered: `flow get status` returns `ok: true` and `data.active === false`; `flow get status --details` also returns `data.active === false`.
- AC5 (R6): Help text includes `--details`, valid details invocations exit successfully, unknown status options still fail with help guidance, invalid runId input fails before internal resolution, and unmatched runId remains a failure.
- AC6 (R7): A test or code assertion verifies `metricsSummary` is not present in default output and is present only in `--details` output.
- AC7 (R8): Spec-local tests include `// spec: R<N>` headers and are executed by the flow test step; shared tests continue to pass.

## Implementation Targets
- src/flow/lib/get-status.js
- src/flow/registry.js
- tests/unit/flow/get-status.test.js
- tests/unit/flow/get-unknown-options.test.js
- specs/280-flow-get-status-summary/tests/

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Add status details contract
  - Implement the summary/default and `--details` payload split for `flow get status`, including runId parity and help text.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Cover status payload contract
  - Add spec-local tests with requirement headers and update shared regression tests for the new status output contract.
  - see `tasks/T-2.md` for full spec
