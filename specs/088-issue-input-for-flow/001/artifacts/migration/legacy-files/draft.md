# Draft: 088-issue-input-for-flow

## Q&A

- Q: `--issue` オプションはどのコマンドに追加する？
  - A: `sdd-forge flow status --issue <number>` に追加。既存の setter パターン（--request, --note 等）に合わせる。

- Q: issue 内容のフェッチやドラフト短縮はプロダクトコードで行う？
  - A: いいえ。issue は情報ソースの一つとして扱う。フェッチはスキル側で `gh issue view` を使う。既存フローの構造は変更しない。

## Decisions

- `flow status --issue` で flow.json に issue 番号を保存
- `flow-state.js` に `setIssue()` を追加
- `merge.js` の `buildPrBody()` は既に `state.issue` 対応済み
- スキル側で issue 内容を取得し、ドラフトの参考情報として使う

- [x] User approved this draft
- Confirmed at: 2026-03-23
