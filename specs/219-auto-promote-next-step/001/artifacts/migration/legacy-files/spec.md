# Feature Specification: 219-auto-promote-next-step

**Feature Branch**: `feature/219-auto-promote-next-step`
**Created**: 2026-04-23
**Status**: Approved
**Input**: GitHub Issue #235

## Goal
- flow step が `done` に遷移した際、同一スコープ内で次の `pending` step を `in_progress` へ自動昇格させ、skill / CLI 利用時の手動 step 更新操作を排除する。

## Background
- 現行の `flow-store.updateStepStatus` は要求された step の `status` を差し替えるだけで、後続 step への進行は行わない。
- gate / review の post-hook は完了 step を `done` にするだけ。`get-next-action` は `in_progress` 不在時に `NO_IN_PROGRESS_STEP` エラーを返す。
- 結果として SDD flow を 1 本走らせる間に 7 箇所前後の手動 `flow set step <id> in_progress` が必要になっており、auto mode では特に摩擦が大きい（Issue #235 の実測）。

## Scope
- `flow-store.updateStepStatus` に「`done` 遷移時、同スコープに `in_progress` が存在しなければ先頭 `pending` を `in_progress` に昇格」するロジックを追加。
- `get-next-action` に「`in_progress` 不在時に先頭 pending を promote してからディスパッチ」するフォールバックを追加。両スコープ（flow / task）で動作する。
- SKILL.md (`src/templates/skills/sdd-forge.flow/SKILL.md`) から「NO_IN_PROGRESS_STEP 時の手動リカバリ」節を削除。
- ユニットテスト追加: auto-promote 挙動、フォールバック経路、在 `in_progress` 時は非干渉を検証。

## Out of Scope
- task 完了（`completeTask`）と flow-level step 進行の連携ルール変更。
- 複数 `in_progress` 許容などの進行モデル再設計。
- finalize 以降の commit/merge/sync/cleanup の step 構造リファクタ。
- SKILL.md 以外のテンプレート（`.agents/` 等）への同等文書変更（自動生成側は対象外）。

## Constraints
- 既存の `flow.json` JSON スキーマを変更しない（フィールド追加・削除なし）。
- CLI コマンド・オプションのシグネチャを変更しない。
- alpha 版ポリシーに従い後方互換シム・フラグは追加しない。
- `pending` → `in_progress` / `skipped` など `done` 以外の遷移では promote を行わない。
- スコープ内に既に `in_progress` の step がある場合は何もしない（単一 `in_progress` invariant を維持）。
- 外部依存なし（Node.js 組み込みのみ）。

## Design Principles
- Promotion の責務は「state 書き込み点」（= `updateStepStatus`）に集約する。post-hook ごとに分散させない。
- `get-next-action` の promote は旧 state / 外部編集に対するセーフティネットとして位置付ける。
- 先頭 `pending` を昇格する単純ルールで十分。steps 配列は進行順に整列しており、`skipped` / `done` は自然に飛ばされる。

## Overview
### Modules
- `src/lib/flow-store.js` — `updateStepStatus` に promote ロジックを追加。
- `src/flow/lib/get-next-action.js` — `in_progress` 不在時のフォールバックを追加。
- `src/templates/skills/sdd-forge.flow/SKILL.md` — C.1 節の手動リカバリ手順を削除。

### Data Flow
```
set-step done / post-hook done
  └─ updateStepStatus(stepId, "done")
        └─ mutate(state):
              step.status = "done"
              if (!scope.hasInProgress && hasPending) promoteFirstPending()

get next-action
  └─ resolveTarget(state)
        └─ if target == null:
              flowManager.promoteFirstPendingAcrossScopes(state)
              target = resolveTarget(reload)
```

### Decisions
- `done` 遷移時の promote と `get-next-action` フォールバックを同じヘルパー（scope 内で「他に in_progress がなく、先頭 pending がある」時のみ promote）で実装する。
- Flow / task スコープの切り替えは `resolveMutationScope` / `findInProgress` の既存ロジックに合わせる。

## Clarifications (Q&A)
- Q: auto-promote は `done` 遷移時に限定するか？
  - A: する。`in_progress` → `pending` の逆遷移を人が意図して行う余地を残す。初期状態の first-in_progress 不在は `get-next-action` フォールバックで吸収する。
- Q: 複数 in_progress 許容に広げるか？
  - A: 広げない。現行 invariant を維持する。
- Q: 昇格先は「先頭 pending」「直後 pending」どちらか？
  - A: 先頭 pending。steps 配列が進行順のため直後 pending と同等となり、`skipped` / `done` を自然にスキップできる。
- Q: task スコープでの挙動は？
  - A: task.steps 配列内で同じルールで昇格する。task 完了時の flow-level 進行は既存 `completeTask` の領域で変更しない。
- Q: 旧 `flow.json` との整合は？
  - A: スキーマ変更なし。`NO_IN_PROGRESS_STEP` 状態で残っていた state は next-action 呼び出し時にフォールバックで復旧する。
- Q: post-hook 側で promote する代替案は？
  - A: 採用しない。gate / review / finalize の各 post-hook が `tryUpdateStepStatus` を呼ぶため、`updateStepStatus` 1 箇所に集約する方が DRY。

## Alternatives Considered
- (A) 各 post-hook で promote を追記: 分散して保守コスト増。却下。
- (B) `get-next-action` のみで復旧: 永続 state が `in_progress` 不在のまま残り不整合。却下。
- (C) state 書き込み点に集約 + next-action セーフティネット: 採用。

## User Confirmation
- [x] User approved this spec (autoApprove)
- Confirmed at: 2026-04-23
- Notes: auto mode（score 21/24）

## Requirements
- R1: `updateStepStatus(stepId, "done")` が成功したとき、当該 step を含むスコープ（flow または task の `steps` 配列）に他の `in_progress` step が存在しなければ、配列順で最初の `pending` step を `in_progress` に昇格させる。
- R2: `updateStepStatus` が `done` 以外の status を指定された場合、または同スコープに既に `in_progress` が存在する場合は promote を行わず、従来通り指定 step のみを更新する。
- R3: `get-next-action` 実行時、flow scope / task scope のいずれにも `in_progress` step が存在しない場合、`flow-store` のヘルパーを用いて先頭 `pending` を `in_progress` に昇格させ、state を再読込してから通常のディスパッチを続行する。昇格先が皆無のときのみ `NO_IN_PROGRESS_STEP` を返す。
- R4: SKILL.md の C.1 節から「On `NO_IN_PROGRESS_STEP`: ... 手動で first pending を in_progress に set してリトライ」相当の手順を削除し、CLI 自動化に依存する旨の記述に置き換える。
- R5: 上記 R1-R3 の挙動をカバーするユニットテストを追加する（最小 3 ケース: done 遷移 promote、in_progress 在時の非干渉、next-action フォールバック）。

## Acceptance Criteria
- AC1: `npm test` が全てパスする。既存テストのうち期待値を拡張したものも含め regression しない。
- AC2: 新規ユニットテストで R1/R2/R3 が検証されている。
- AC3: skill 観点での結合確認として、同一 flow 内で `gate` → 後続 step が手動昇格なしで `get next-action` に到達できることが、テスト fixture ベースで確認できる（実フロー実行は不要、state fixture での検証で代替）。
- AC4: SKILL.md の C.1 から手動リカバリ記述が消えていることを文字列 assertion で検証する、またはドキュメントレビューで確認する。

## Implementation Targets
- `src/lib/flow-store.js`
- `src/flow/lib/get-next-action.js`
- `src/templates/skills/sdd-forge.flow/SKILL.md`
- `tests/unit/flow.test.js` or `tests/unit/flow/set-step.test.js`
- `tests/unit/flow/get-next-action.test.js`

## Open Questions
- [ ] （なし）
