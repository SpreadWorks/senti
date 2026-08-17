# Feature Specification: 172-audit-unused-flow-commands

**Feature Branch**: `feature/172-audit-unused-flow-commands`
**Created**: 2026-04-13
**Status**: Draft
**Input**: GitHub Issue #140

## Goal

flow の全サブコマンド/オプションを棚卸しし、keep / remove / integrate into skill に分類する。remove 対象は実装・ドキュメントから削除し、integrate 対象はスキルに組み込み手順を追加する。

## Scope

1. remove 対象の削除（コード + ドキュメント）
2. integrate 対象のスキルテンプレートへの組み込み
3. 分類表の作成と判定根拠の永続化

## Out of Scope

- `flow resume` の扱い（スキル自体はコンパクション復帰で有用）
- redo ログ登録ロジックの再設計（別 issue 81d4 で対応）
- keep 対象（`--skip-guardrail`, `--message`, `--dry-run`）の変更

## Clarifications (Q&A)

- Q: 未使用コマンドは一括削除か？
  - A: いいえ。個別に keep / remove / integrate を判断する。Issue の目的は棚卸しと分類。

- Q: alpha ポリシーで migration plan は不要か？
  - A: 不要。ただし `--confirm-skip-guardrail` 削除による動作変更（`--skip-guardrail` 単独で有効化）は CHANGELOG に記載する。

- Q: サブコマンド test-summary / lint / retro は削除か？
  - A: 削除ではなく integrate。完全実装済みで有用な機能。スキルへの組み込みが未完了なだけ。

## Classification Table

### Subcommands

| Command | Classification | Reference Count (skills) | Rationale |
|---|---|---|---|
| `flow set test-summary` | **integrate** | 0 | Fully implemented. Records test counts for reports. Integrate into flow-plan test step |
| `flow run lint` | **integrate** | 0 | Fully implemented. Checks changed files against guardrail lint patterns. Integrate into flow-impl |
| `flow run retro` | **integrate** | 0 | Fully implemented (AI call). Evaluates spec vs implementation accuracy. Integrate into flow-finalize |

### Options

| Option | Parent Command | Classification | Reference Count (skills) | Rationale |
|---|---|---|---|---|
| `--skip-guardrail` | `flow run gate` | **keep** | 0 | Useful for debugging/development to skip AI guardrail check |
| `--confirm-skip-guardrail` | `flow run gate` | **remove** | 0 | Double-confirmation safety for `--skip-guardrail`. Redundant — AI callers don't need it, CLI users find it cumbersome |
| `--message` | `flow run finalize` | **keep** | 0 | Overrides commit message. Useful for direct CLI usage |
| `--dry-run` | `flow run sync` | **keep** | 0 | Preview build+review without commit. Useful for direct CLI usage |

### Other

| Target | Classification | Rationale |
|---|---|---|
| `redo` metric counter (constants.js) | **remove** | Write path (`metrics[phase].redo`) and read path (`flowState.redoCount`) mismatch. Incomplete design. Redesign in issue 81d4 |
| `redoCount` reference (token.js) | **remove** | Always null/0, does not contribute to difficulty calculation |
| AGENTS.md `set/ ... redo` entry | **remove** | No corresponding command implementation (set-redo.js does not exist) |

## Alternatives Considered

- **Delete all unused commands/options** — Rejected. Some are fully implemented and useful; the issue's goal is classification, not blanket removal.
- **Keep everything as-is** — Rejected. `--confirm-skip-guardrail` and redo-related code are genuinely broken or useless, and integrate targets should be wired into skills.

## Why This Approach

The issue asks for an audit and policy decision, not just cleanup. Each command/option was individually evaluated based on implementation completeness, design integrity, and operational value. This approach satisfies all four acceptance criteria: owner assignment, cleanup, skill integration, and rationale preservation.

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-13
- Notes: Approved after gate PASS. All requirements and classification confirmed.

## Requirements

Priority order (highest first):

1. When `flow run gate --skip-guardrail` is called without `--confirm-skip-guardrail`, the gate shall execute the skip without requiring double confirmation. The `--confirm-skip-guardrail` flag definition shall be removed from registry.js and the safety-check logic shall be removed from run-gate.js.
2. When `redo` is passed as a counter to `flow set metric`, the command shall reject it as invalid. The `redo` entry shall be removed from `VALID_METRIC_COUNTERS` in constants.js.
3. When `flow run report` or `sdd-forge metrics token` reads flow state, `redoCount` shall not be referenced. The `redoCount` field and its normalization shall be removed from token.js `DIFFICULTY_BASELINES` and the difficulty calculation.
4. The AGENTS.md directory tree shall not list `redo` under `set/`.
5. When the flow-plan skill completes the test step, it shall call `sdd-forge flow set test-summary` with the test counts. The skill template (`src/templates/skills/sdd-forge.flow-plan/SKILL.md`) shall include this instruction.
6. When the flow-impl skill runs implementation checks, it shall call `sdd-forge flow run lint`. The skill template (`src/templates/skills/sdd-forge.flow-impl/SKILL.md`) shall include this instruction.
7. When the flow-finalize skill generates a report, it shall call `sdd-forge flow run retro` before `flow run report`. The skill template (`src/templates/skills/sdd-forge.flow-finalize/SKILL.md`) shall include this instruction.
8. After skill template changes, `sdd-forge upgrade` shall be run to sync live skills.

## Migration Plan

This project follows an alpha policy where backward-compatible code is not maintained. The following CLI changes require no deprecation period:

- **`--confirm-skip-guardrail` removal**: Users who previously ran `flow run gate --skip-guardrail --confirm-skip-guardrail` shall now run `flow run gate --skip-guardrail` (the confirmation flag is simply dropped). No code migration is needed — the flag was a safety gate, not a behavior toggle.
- **`redo` metric counter removal**: No user-facing migration. The counter was never incremented by any caller.
- **CHANGELOG entry**: The removed flag and counter shall be listed in the CHANGELOG under a "Removed" heading.

## Impact on Existing Features

- `--skip-guardrail` behavior changes: no longer requires `--confirm-skip-guardrail`. This is a simplification, not a breaking change for current users (no skill uses either flag).
- `redo` metric counter removal: no impact. Never incremented by any caller.
- `redoCount` removal from difficulty calculation: no impact. Always null/0.
- Skill template changes: flow-plan, flow-impl, flow-finalize gain new instructions. No existing instructions are removed or changed.

## Test Strategy

- Run existing `npm test` to verify no regressions from code deletions (requirements 1-4).
- Spec verification tests in `specs/172-audit-unused-flow-commands/tests/` to confirm:
  - `flow run gate --skip-guardrail` works without `--confirm-skip-guardrail`
  - `flow set metric <phase> redo` is rejected as invalid
  - Skill templates contain the new instructions (requirements 5-7)

## Acceptance Criteria

- [ ] All flow subcommands/options have a classification and rationale in the Classification Table
- [ ] Remove targets are deleted from both code and documentation
- [ ] Integrate targets have usage instructions in the corresponding skill templates
- [ ] `sdd-forge upgrade` has been run after template changes
- [ ] Existing tests pass (`npm test`)

## Open Questions

- (none)
