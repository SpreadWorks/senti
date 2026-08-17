# Draft: 099-consolidate-temp-files

## Q&A

### Q1: 一時ファイルの移動先
- Q: enrich 失敗ダンプをどこに移動するか？
- A: `.tmp/`（agent.workDir）に移動する。

### Q2: config 設定
- Q: 新しい temp 設定を追加するか？
- A: agent.workDir をそのまま使う。新設定は追加しない。

### Q3: 既存ファイルのクリーンアップ
- Q: 既存の enrich-fail-batch ファイルはどうするか？
- A: クリーンアップしない。新規分のみ移動先を変更。

## Approval

- [x] User approved this draft
- Confirmed at: 2026-03-29
