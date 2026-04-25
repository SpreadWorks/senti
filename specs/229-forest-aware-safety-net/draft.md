# Draft: 229-forest-aware-safety-net

**開発種別:** refactor
**目的:** safety-net fallback の回復時タスク選択順序を、forest DFS 順に揃える。手動編集や post-hook 未発火からの回復時に意図しない順序でタスクが実行される問題を解消する。

## Requirements

1. **(P1)** When `flow get next-action` で in_progress ステップが存在せず safety-net fallback が発動した場合、タスク promotion は forest DFS 順（既存の forest traversal ロジック）に従うものとする（shall）。
2. **(P2)** When タスクが promote された場合、そのタスク内のステップ promotion は配列順のままとする（shall）。ステップ順序は forest 構造と無関係であるため。
3. **(P3)** 正常パス（in_progress ステップが既に存在する場合）の動作は変更しないものとする（shall）。

## Scope Verification
- In scope:
  - safety-net fallback のタスク promotion 順序を forest DFS 順に変更
  - 対応するユニットテストの追加
- Out of scope:
  - 既存の配列順 step promotion ロジックの変更
  - forest traversal ロジック自体の変更
  - 正常パスの動作変更

## Impact on Existing Features
- 影響ありの既存機能:
  - `flow get next-action` の safety-net fallback パス: 回復時のタスク選択順序が配列順から forest DFS 順に変わる。正常パスには影響なし。
- ステップ promotion（done 遷移時）は配列順のままで変更なし。
- CLI インターフェース互換性: コマンド名・オプション・出力 JSON スキーマに変更なし。変更は内部の回復ロジックのみであり、migration plan は不要。

## Q&A
- Q: タスク promotion とステップ promotion の両方を変更するか？
  - A: タスク promotion のみ変更する。根拠（既存コードパターン）: ステップ順序はタスク内の配列順で正しく、forest 構造はタスク間の関係であり、タスク内ステップには適用されない。タスクを DFS 順で promote した後、そのタスクのステップは配列順で promote する。
- Q: 既存の forest traversal ロジックの前提条件は safety-net fallback で満たされるか？
  - A: 満たされる。根拠（既存コードパターン）: fallback に到達する条件は in_progress ステップが存在しない状態であり、forest traversal は pending タスクの探索のみ行うため、前提条件に矛盾はない。
- Q: テスト戦略は？
  - A: 根拠（既存コードパターン）: 既存の flow-helpers テストが forest traversal の DFS 順検証パターンを持っている。同様に、親子関係のあるタスクを持つ flow state で safety-net fallback が発動するシナリオをテストし、DFS 順で正しいタスクが選択されることを検証する。

## Open Questions
- なし

## User Approval
- [x] User approved this draft (autoApprove)
- Confirmed at: 2026-04-25
- Notes: auto-mode により自動承認
