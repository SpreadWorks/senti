# Draft: Remove non-existent flow run scan from skill (#86)

**開発種別:** バグ修正

**目的:** flow-plan スキルテンプレートの draft フェーズ手順から、存在しない `sdd-forge flow run scan` コマンドを削除し、エラーを防止する。

## Q&A

### Q1: 削除するか、正しいコマンドに置換するか？
A: 削除する。`sdd-forge flow get context` が内部で analysis.json を参照し、必要に応じて scan を促す。明示的な scan 実行はスキルの責務ではない。

### Q2: テストは必要か？
A: テンプレート（.md ファイル）の 1 行削除のみ。コード変更なし、テスト不要。

- [x] User approved this draft (autoApprove)
