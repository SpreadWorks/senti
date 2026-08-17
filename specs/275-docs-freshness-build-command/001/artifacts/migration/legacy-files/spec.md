# Feature Specification: 275-docs-freshness-build-command

**Feature Branch**: `feature/275-docs-freshness-build-command`
**Created**: 2026-06-04
**Status**: Draft
**Input**: GitHub Issue #355

## Goal
`sdd-forge check freshness` が docs regeneration を案内するとき、実在する `sdd-forge docs build` を表示し、実在しない `sdd-forge build` を表示しない。

## Background
`sdd-forge check freshness` currently tells users to run `sdd-forge build` when docs are stale or missing. The CLI registry exposes docs generation through `sdd-forge docs build`, so the displayed next action can send users to an unknown command. The fix is a narrow bugfix to align freshness check guidance with the registered docs command.

## Scope
- `sdd-forge check freshness --help` の docs regeneration guidance
- `sdd-forge check freshness` の `stale` text output
- `sdd-forge check freshness` の `never-built` text output
- freshness guidance を検証する spec-local test

## Out of Scope
- top-level `sdd-forge build` alias の追加
- `sdd-forge docs build` pipeline の実行順序や生成内容の変更
- `sdd-forge check freshness` の mtime 判定、JSON output shape、exit code contract の変更

## Constraints
- alpha 版ポリシーに従い、存在しない旧 command への互換 alias は追加しない。
- `sdd-forge check freshness` の text output と help text の案内先は `sdd-forge docs build` に統一する。
- `sdd-forge check freshness` の exit code contract は維持する。`fresh` は exit code 0、`stale` と `never-built` は exit code 1 のままとする。
- JSON output は `{ ok, result, srcNewest, docsNewest }` の shape と値の意味を維持する。
- `sdd-forge check freshness` の user-facing arguments は既存の `--format <text|json>` と `-h` / `--help` のみとする。`--format` は `text` または `json` の文字列だけを受け付け、その他の値は既存どおり error output と non-zero exit にする。内部専用 argument は追加しない。

## Design Principles
- CLI が次に実行すべき command を表示する場合、表示する command は現在の registry で dispatch 可能な command と一致させる。
- freshness check の責務は docs freshness 判定と次アクション案内に限定し、docs build の動作や command surface は変更しない。

## Overview
### Modules
- `src/check/commands/freshness.js` owns `sdd-forge check freshness` help text, text result rendering, freshness comparison, and JSON output.
- `src/lib/command-registry.js` registers docs build as `docsCommands.build`; `src/docs.js` dispatches it as `sdd-forge docs build`.

### Data Flow
- `runFreshnessCheck` parses `--format`, computes freshness via `checkFreshness`, then renders either JSON output or one text line for `fresh`, `stale`, or `never-built`.

### Decisions
- [VERIFY] Checked draft policy against source: docs build is registered under the docs command subtree, so freshness guidance must point to `sdd-forge docs build`.
- Do not add a top-level `sdd-forge build` alias.
- Existing behavior impact is limited to text output and help text.

## Clarifications (Q&A)
- Q: Should this spec add a top-level `sdd-forge build` alias?
  - A: No. The issue is resolved by correcting freshness guidance to the registered command. Adding an alias is out of scope.
- Q: Which command is the canonical docs generation command for this spec?
  - A: `sdd-forge docs build`.

## Alternatives Considered
- Add top-level `sdd-forge build` alias — Rejected because issue #355 targets incorrect freshness guidance, and the project alpha policy avoids backward compatibility code for old or nonexistent command forms.
- Leave freshness output unchanged and document a fallback elsewhere — Rejected because users still encounter the wrong command directly in the failing workflow.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-06-04T09:28:48.471Z
- Notes: User selected option 1 to approve the gate-passed spec.

## Requirements
- R1 [must]: `sdd-forge check freshness --help` must display `sdd-forge docs build` as the command to run when docs regeneration is needed and must not display `sdd-forge build` as that command.
- R2 [must]: `sdd-forge check freshness` text output for both `stale` and `never-built` results must display `sdd-forge docs build` and must not display `sdd-forge build`.
- R3 [must]: The fix must preserve freshness result classification, JSON output shape, and exit codes for `fresh`, `stale`, and `never-built`.
- R4 [must]: `sdd-forge check freshness` must keep the existing user-facing argument contract: `--format <text|json>` accepts only `text` or `json`, `-h` and `--help` print help, and no internal-only arguments are introduced.

## Acceptance Criteria
- `sdd-forge check freshness --help` output contains `sdd-forge docs build` and does not contain `sdd-forge build` as the regeneration command.
- A stale docs scenario exits non-zero and prints `run: sdd-forge docs build`.
- A missing docs scenario exits non-zero and prints `run: sdd-forge docs build`.
- `--format json` behavior continues to emit the existing JSON fields and non-zero exit for stale or never-built results.
- `--format xml` or any other unsupported format continues to fail validation at the command entry point.

## Implementation Targets
- src/check/commands/freshness.js
- specs/275-docs-freshness-build-command/tests/

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Update freshness guidance
  - Change freshness check help and text result output so every docs regeneration hint points to `sdd-forge docs build`.
  - see `tasks/T-1.md` for full spec
