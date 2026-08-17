# Draft: 064-generic-coverage-check-and-patch

## 要件

1. review の WARN をすべて FAIL に昇格する
2. analysis.json mtime チェック（package.json/composer.json との比較）を削除する
3. スナップショット差分チェックを review から削除する
4. snapshot コマンド自体を削除する（snapshot.js, テスト, docs.js からのルーティング）
5. FAIL メッセージに具体的な解決手順を含める（例: `run: sdd-forge docs scan`）
6. forge で解決できない場合は例外終了し、flow-merge では AI がエラーを読んでユーザーに解決方法を提示する（現状の暗黙の動作を明文化）

## Q&A

- Q: カバレッジ検知の粒度は？
  - A: エントリ単位（個々のファイル/クラスが docs に記述されているか）→ 今回のスコープでは見送り。既存のカテゴリ単位チェック（#12）を FAIL に昇格するのみ。

- Q: forge で解決できないケースは？
  - A: analysis.json がない（scan 必要）、agent 未設定で {{text}} 未充填、未カバー analysis カテゴリ（テンプレートの問題）

- Q: flow-merge で forge が例外終了した場合は？
  - A: AI がエラー内容を読んでユーザーに解決方法を提示する

- [x] User approved this draft
- Confirmed at: 2026-03-16
