# Draft: 219-auto-promote-next-step

**開発種別:** bugfix
**目的:** flow step が `done` に遷移した後、次の `pending` step を自動で `in_progress` に昇格させ、skill 側の手動 step 更新操作を不要にする。

> **Discussion mode:** これは最終決定用の draft である（brainstorm ではない）。auto mode で `eligible: true, score: 21/24` と判定済み。

## Scope Verification
- In scope（優先度順）:
  1. **[P1] auto-promote 挙動**: step を `done` に遷移させた際、同一スコープ内に他の `in_progress` が存在しなければ、配列先頭の `pending` step を `in_progress` に昇格する。`skipped` / `done` は自然にスキップされる。
  2. **[P2] NO_IN_PROGRESS_STEP フォールバック**: next-action 要求時に `in_progress` が不在のとき、P1 と同じルールで先頭 pending を promote してから通常ディスパッチする。
  3. **[P3] SKILL.md ドキュメント更新**: 現行の手動 `NO_IN_PROGRESS_STEP` リカバリ手順を削除し、CLI の自動化に合わせた記述に揃える。
  4. **[P4] ユニットテスト追加**: auto-promote 挙動とフォールバック経路の回帰検知。
- Out of scope:
  - task 完了時の flow-level step 進行（既存の `completeTask` で処理される領域）
  - 複数 in_progress を許容する設計への変更
  - `skipped` ロジックや step graph 化など、進行モデル全体の再設計
  - finalize 以降の commit/merge/sync/cleanup の step 構造変更

## Impact on Existing Features
- 影響ありの既存機能:
  - **flow set step 系の挙動変更**: `done` への遷移時に次の pending が `in_progress` に昇格するという副作用が加わる。skill を介さずに直接 CLI を叩くユーザーは、副作用を踏まえた使用に切り替える必要がある。
  - **gate / review の post-hook**: 後続 step が自動で走り出せる状態になる。これにより skill 側の「手動昇格」手順は不要になる。
  - **NO_IN_PROGRESS_STEP エラーの発生頻度が激減する**: 旧 state で保存された flow.json のみ残る。
- 影響なし:
  - `pending` → `in_progress` や `skipped` など、`done` 以外への遷移
  - task scope の既存 invariant（単一 in_progress 前提は維持）
  - flow state の JSON スキーマ（フィールド追加・削除なし）

## Migration Plan（互換性）
- **CLI インターフェース**: 既存の `flow set step <id> <status>` / `flow get next-action` のシグネチャは変わらない。オプション追加・削除なし。
- **挙動変更の扱い**: バグ修正として副作用を追加する形のため、旧版で「done にしたあと別の step を自分で選んで in_progress にする」運用をしていたユーザーは、意図通りに先頭 pending が走るかを 1 度確認すれば良い。副作用を抑止するオプションは設けない（alpha 期間ポリシーに従い互換レイヤを作らない）。
- **既存 flow.json の扱い**: 既存データ構造のまま動作。旧 state で `NO_IN_PROGRESS_STEP` に陥っているフローも P2 のフォールバックで自動復旧する。

## Q&A
- Q: auto-promote の発火トリガーは「`done` 遷移時」に限るべきか？
  - A: 限る。`in_progress` → `pending` などの逆遷移を人が意図的に行う余地を残す。初期化直後の first-in_progress 不在は P2 フォールバックで吸収する。
- Q: 昇格対象は「先頭 pending」で問題ないか？
  - A: 問題ない。steps 配列は進行順に並んでおり、`skipped` / `done` は自然にスキップされる。直後 pending と同義になる。
- Q: task スコープと flow スコープの扱いは？
  - A: 一般化されたスコープ単位の invariant として扱う。task 内の step 遷移でも task 配列内の先頭 pending が昇格する。task 全体が完了したときの flow-level 進行は `completeTask` の責務で、この変更では触らない。
- Q: 複数 in_progress を許容する方向に広げるか？
  - A: 広げない。現行の「単一 in_progress」invariant を維持する。
- Q: 代替案の整理
  - A:
    - (A) post-hook ごとに promote 処理を追加: 分散コストが高い。却下。
    - (B) next-action 側のみの recovery: flow.json が常に「in_progress 不在」のまま残り、外部 tooling から見て不整合。却下。
    - (C) state 変更点（`done` 遷移）に集約 + next-action に safety net: 責務を 1 箇所に集め、復旧経路も確保。採用。
- Q: Test strategy
  - A: ユニットテスト 2 観点で検証。
    - 観点 1: `done` 遷移後、他に `in_progress` がなければ先頭 pending が `in_progress` に昇格する。既に別の `in_progress` がある場合は変化しない。
    - 観点 2: `in_progress` 不在の flow state に対して next-action を呼ぶと、先頭 pending が promote され、通常の envelope が返る（エラーにならない）。
- Q: Future extensibility
  - A: 将来的に「複数 in_progress」「step graph」などを入れる場合、promote ロジックは単一のフックポイントに集約されているため差し替えやすい。

## Open Questions
-

## User Approval
- [x] User approved this draft (autoApprove)
- Confirmed at: 2026-04-23
- Notes: auto-mode で自動承認（score 21/24）
