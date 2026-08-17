# Draft: Auto-post implementation report to issue on finalize

## Goal
finalize 時に issue 起点のフローであれば、report.text を元 issue にコメントとして自動投稿する。

## Decisions
- 条件: `state.issue` が存在 AND `isGhAvailable()` が true の場合のみ投稿
- 条件を満たさない場合: スキップ（警告なし）
- タイミング: finalize.js の commit ステップの post フック的な位置（report 生成後、merge の前）
- コメント本文: `report.text` をそのまま投稿（ヘッダー追加なし）
- merge の成否に関わらず投稿する

## Impact
- `src/flow/run/finalize.js`: report ステップ完了後に gh issue comment を追加

## Test Strategy
- state.issue + gh available 時にコメント投稿されることを検証（gh コマンドのモック必要）
- state.issue なしの場合スキップされることを検証

- [x] User approved this draft (2026-04-02)
