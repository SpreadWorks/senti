# Clarification Q&A

- Q: 空レスポンス時のリトライはどこまでを対象にするか
  - A: 空レスポンスに加えて、一時的な AI 呼び出し失敗も対象にする。待機時間は 3 秒固定で、回数は `agent.retryCount` を参照する。
- Q: `agent.retryCount` はどこで使うか
  - A: 今回は `docs enrich` のみで使う。他の agent 利用コマンドには適用しない。
- Q: entry ごとの処理状態はどう保存するか
  - A: `enrich.processedAt` と `enrich.attempts` を保存する。`status` は追加しない。
- Q: `summary` 欠落と entry 欠落はどう区別するか
  - A: entry 自体が応答に含まれていれば `summary` が空でも処理済みとして保存する。entry 自体が含まれない場合は未処理のまま残す。
- Q: `enrich.attempts` は何を意味するか
  - A: その entry を AI 処理対象にした回数であり、初回呼び出しを含む。
- Q: リトライ上限後も失敗した場合はどうするか
  - A: それまでの進捗を保存してエラー終了する。

## Confirmation
- Before implementation, ask the user:
  - "この仕様で実装して問題ないですか？"
- If approved, update `spec.md` -> `## User Confirmation` with checked state.
