# Feature Specification: 229-forest-aware-safety-net

**Feature Branch**: `feature/229-forest-aware-safety-net`
**Created**: 2026-04-25
**Status**: Draft
**Input**: GitHub Issue #263

## Goal
safety-net fallback（in_progress ステップが存在しない場合の回復ロジック）のタスク promotion 順序を、配列順から forest DFS 順に変更する。

## Background
`get-next-action.js` の safety-net fallback（spec 219 で導入）は、in_progress ステップが存在しない異常状態からの回復に `promoteFirstPending`（配列の先頭 pending を promote）を使っている。一方、正常パスでは `promoteNextPending`（forest DFS 順で次の pending タスクを promote）が使われている。手動編集や post-hook 未発火からの回復時に、正常パスと異なる順序でタスクが実行される可能性がある。spec 227 (REQ-B2) の残作業。

## Scope
- `src/flow/lib/get-next-action.js` の safety-net fallback のタスク promotion を forest DFS 順に変更
- fallback 発動後のステップ promotion（タスク内）を正しく連鎖させる
- ユニットテストの追加

## Out of Scope
- `promoteFirstPending` 関数の削除（step promotion で引き続き使用）
- `promoteNextPending` / `findNextPendingTask` のロジック変更
- 正常パスの動作変更

## Constraints
- 外部依存なし（Node.js 組み込みのみ）
- alpha 版ポリシー: 後方互換コードは不要

## Design Principles
- 既存の forest traversal ロジック（`promoteNextPending` / `findNextPendingTask`）を再利用する
- safety-net fallback と正常パスのタスク選択ロジックを統一する

## Overview
### Modules
- `src/flow/lib/get-next-action.js` — safety-net fallback ロジックの変更対象
- `src/lib/flow-helpers.js` — `promoteNextPending` の定義元（変更なし）
- `src/lib/flow-store.js` — `promoteFirstPending` の定義元（変更なし、step promotion で継続使用）

### Data Flow
1. `get-next-action` が `resolveTarget(state)` を呼ぶ → null（in_progress なし）
2. safety-net fallback: `promoteNextPending(state)` でタスクを DFS 順に promote
3. タスクが promote された場合、`promoteFirstPending(task.steps)` でそのタスクの先頭ステップを promote
4. state を save → reload → `resolveTarget` で再ディスパッチ

### Decisions
- タスク promotion に `promoteNextPending` を使用（forest DFS 順）
- ステップ promotion は `promoteFirstPending` を継続使用（配列順で正しい）
- 2段階の promotion（タスク → ステップ）で回復する

## Clarifications (Q&A)
- Q: `promoteNextPending` は `currentTaskId != null` で null を返すが、fallback で問題ないか？
  - A: fallback に到達する条件は in_progress ステップが存在しない状態。`currentTaskId` が設定済みだが対応するタスクのステップが全て done/pending の場合にも発生しうる。その場合は `currentTaskId` をクリアしてから `promoteNextPending` を呼ぶ必要がある。

## Alternatives Considered
- `promoteFirstPending` のまま維持: 単純だが、forest 構造を持つフローで回復順序が不正確になる。正常パスとの一貫性がない。
- `findNextPendingTask` を直接呼ぶ: 低レベルすぎる。`promoteNextPending` が適切な抽象。

## User Confirmation
- [x] User approved this spec (autoApprove)
- Confirmed at: 2026-04-25
- Notes: auto-mode により自動承認

## Requirements
- **REQ-1 (P1):** When safety-net fallback が発動した場合、タスク promotion は `promoteNextPending`（forest DFS 順）を使用するものとする。
- **REQ-2 (P2):** When タスクが promote された場合、そのタスク内のステップ promotion は `promoteFirstPending`（配列順）を使用するものとする。
- **REQ-3 (P3):** 正常パス（in_progress ステップが既に存在する場合）の動作は変更しないものとする。

## Acceptance Criteria
- AC-1: forest 構造を持つ flow state で safety-net fallback が発動した場合、DFS 順で正しいタスクが選択される。
- AC-2: promote されたタスクの先頭 pending ステップが in_progress になる。
- AC-3: 正常パス（in_progress ステップあり）では fallback が発動しない。
- AC-4: flat タスクリスト（parent なし）でも配列順で正しいタスクが選択される（DFS は flat リストで配列順と等価）。

## Implementation Targets
- `src/flow/lib/get-next-action.js`

## Test Strategy
- ユニットテスト: forest 構造（親子タスク）での safety-net fallback 発動時の DFS 順検証
- ユニットテスト: flat タスクリストでの safety-net fallback 発動時の配列順検証
- ユニットテスト: 正常パス（in_progress あり）で fallback が発動しないことの検証

## Open Questions
- なし
