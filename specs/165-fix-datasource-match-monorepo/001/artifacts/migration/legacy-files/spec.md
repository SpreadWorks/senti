# Feature Specification: 165-fix-datasource-match-monorepo

**Feature Branch**: `feature/165-fix-datasource-match-monorepo`
**Created**: 2026-04-10
**Status**: Draft
**Input**: User request (`#128 issueの対応を進めてください。`)

## Goal
Fix false negatives in preset `match(relPath)` evaluation for nested monorepo paths, while preserving existing root-level behavior and CLI compatibility.

## Scope
- All presets that define `match(relPath)`.
- Matching behavior for nested paths such as `aaa/bbb/src/Controller/UserController.php`.
- Boundary-safe segment matching to avoid look-alike false positives.
- Preservation of preset-specific constraints (extensions and additional matching conditions).
- Documenting presets that required no code changes.

## Out of Scope
- Changes to `parse()` behavior.
- Changes to CLI command names/options/semantics.
- Handling framework-specific non-standard directory conventions beyond current preset definitions.
- New external dependencies.

## Clarifications (Q&A)
- Q: 仕様書の進め方は？
  - A: Q&A を先に整理してから spec 化する。
- Q: 対象範囲は issue 記載分のみか？
  - A: いいえ。全プリセット対象で漏れなく対応する。
- Q: 一括置換で修正するか？
  - A: いいえ。機械的一括置換は採用しない。
- Q: `match()` の引数は変更するか？
  - A: 変更しない。`match(relPath)` を維持する。
- Q: 共通化と個別差分の扱いは？
  - A: 共通ルールは統一し、プリセット固有条件は維持する。

## Alternatives Considered
- Ad-hoc per-file fixes without shared rule alignment: rejected due to consistency and maintenance risk across many presets.

## Why This Approach
- Boundary-safe segment matching addresses the root cause of nested monorepo false negatives without loosening rules into high false-positive risk.
- Keeping `match(relPath)` unchanged preserves existing integration points and avoids CLI/API compatibility impact.
- Shared rule alignment with preserved preset-specific constraints balances consistency and framework-specific correctness.

## Requirements
1. P1 When `relPath` contains a valid target directory as an exact path segment sequence for a preset DataSource (including nested prefixes), `match()` shall return true if the preset's existing file-type conditions are satisfied.
2. P1 When `relPath` includes look-alike segment names without exact segment boundary match (example: `src/ControllerX/` for target `src/Controller/`), `match()` shall return false.
3. P1 When `relPath` is in existing root-level layouts currently supported, `match()` shall preserve existing true/false outcomes.
4. P2 When a preset defines extension constraints, `match()` shall preserve and enforce the same extension constraints after this change.
5. P2 When a preset defines additional naming/path constraints, `match()` shall preserve those constraints.
6. P3 When planning and verification are completed for this change, implementation and tests shall cover all presets that define `match(relPath)`, and artifacts shall identify any preset that required no modification.

## Test Strategy
- Framework: existing Node.js test infrastructure (`node:test`) via project `npm test` workflow.
- Scope of verification:
  - Unit-level `match(relPath)` behavior for nested valid paths, boundary false positives, and root-level regression.
  - Preset-specific constraints (extension and additional naming/path conditions) regression checks.
  - Coverage audit listing all presets with `match(relPath)` and whether each required code change.
- Execution:
  - Run affected preset unit tests plus aggregate test command used by the repository.
  - Record test locations and commands in spec test artifacts.

## Acceptance Criteria
1. For representative nested paths under valid target directories, each affected preset returns `true` under the same file-type and additional conditions expected for root-level paths.
2. For look-alike invalid paths (`ControllerX`, similar non-boundary segments), matching returns `false`.
3. Existing root-level path test expectations remain passing.
4. Preset-specific extension and additional constraints continue to behave as before.
5. Test artifacts show coverage for all presets with `match(relPath)` and explicitly note unchanged presets.
6. No CLI interface changes are introduced.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-04-10
- Notes: Approved after gate-pass review.

## Open Questions
- None
