# Draft: Fix Enrich Stuck Entries

## 要件サマリー

`docs enrich` の resume 判定を `summary` 依存から外し、AI 応答の欠落や一時失敗があっても entry ごとの処理状態を正しく扱えるようにする。

## 決定事項

| 項目 | 決定 |
| --- | --- |
| 完了判定 | `summary` ではなく entry ごとの `enrich` メタデータで判定 |
| entry メタデータ | `enrich.processedAt` と `enrich.attempts` を保存 |
| attempts の意味 | その entry を AI 処理対象にした回数（初回含む） |
| summary 欠落 | entry 自体が応答に含まれていれば処理済みとして保存し、WARN を出す |
| entry 欠落 | 未処理のまま残し、次回も再実行する |
| リトライ対象 | 空レスポンスと一時的な AI 呼び出し失敗 |
| リトライ待機 | 3 秒固定 |
| リトライ回数設定 | `agent.retryCount` を参照、未設定時は `1` |
| 設定の適用範囲 | 今回は `docs enrich` のみ。他コマンドは未実装 |
| 失敗時の扱い | 進捗保存後にエラー終了 |

## メモ

- `agent.retryCount` を共有設定名に置くが、今回の実装は `docs enrich` に限定する。
- entry 自体が欠落し続ける根本原因は別途調査対象として残す。

- [x] User approved this draft (2026-03-26)
