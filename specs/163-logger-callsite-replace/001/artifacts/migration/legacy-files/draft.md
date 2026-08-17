**開発種別:** 機能改善（既存 API の call site 接続）

**目的:** spec 153 で実装済みの `Logger.git` / `Logger.event` API を実際の呼び出し元に接続し、git 実行・パイプライン進捗・config ロード・flow step 変更が統合 JSONL ログに記録されるようにする。

## Q&A

**Q1: Logger.git をどのレイヤーでフックするか？**
A: `runCmd` 内で `cmd === "git"` を検出してフックする。
理由: git-helpers.js を経由しない `runCmd("git", ...)` 直接呼び出しも漏れなくカバーでき、変更箇所が1箇所で済む。

**Q2: `runCmdAsync` も同様にフックするか？**
A: はい、両方フックする。
理由: 将来の git 呼び出しが runCmdAsync 経由になるケースを漏れなく拾う。パターンも同一なので追加コストは小さい。

**Q3: Logger.event のイベント名命名規約は？**
A: kebab-case（`config-loaded`, `pipeline-step`, `flow-step-change`）。
理由: 既存テストコード（`log.test.js`）および issue 本文の例がすべて kebab-case で統一されている。

**Q4: catch ブロックで stderr + JSONL の二重ログは許容するか？**
A: 許容する。
理由: stderr はリアルタイム通知、JSONL は後から時系列追跡という役割が異なる。`cfg.logs.enabled = false` 時は JSONL には書かれないため常に二重になるわけでもない。

**Q5: `pipeline-step` イベントのフィールド構造は？**
A: `{ step, phase }` のシンプル構造（開始記録のみ）。
理由: duration/counts の計測はステップ完了後の呼び出しも必要になり複雑化する。今回スコープ外。

## スコープ

### Logger.git の call site 置換

- `src/lib/process.js` の `runCmd`（同期）内で `cmd === "git"` を検出し、結果確定後に `Logger.getInstance().git({ cmd: [cmd, ...args], exitCode, stderr })` を fire-and-forget で呼ぶ
- `runCmdAsync`（非同期）も同様に対応

### Logger.event の call site 置換（最低限の主要箇所）

| イベント名 | トリガー | フィールド |
|---|---|---|
| `config-loaded` | `loadConfig` 完了時 | `{ path, keys }` |
| `pipeline-step` | docs build パイプライン各ステップ開始 | `{ step, phase: "start" }` |
| `flow-step-change` | `flow set step` で step 状態変更時 | `{ step, status }` |
| `error` | ユーザーに見せる重要な `console.error` 箇所 | `{ message }` |

## スコープ外

- Logger.event の網羅的な call site 追加（最低限の主要箇所のみ）
- `sdd-forge logs` ログ閲覧コマンド（別 spec）
- 集計・レポート機能（別 spec）
- 同期版 loggerSync（ボード ffe7）
- `pipeline-step` の終了イベント・duration 計測

## 既存機能への影響

- `runCmd` / `runCmdAsync` のシグネチャは変更しない
- Logger は `cfg.logs.enabled = false`（または未初期化）時は no-op。既存の動作に変化なし
- 既存テスト: `runCmd` のテストが Logger の fire-and-forget 呼び出しによる副作用を観測する可能性あり（disabled 時は no-op なので問題なし）

## 制約

- `Logger.git` / `Logger.event` の API シグネチャは変更しない
- 新規依存追加なし
- alpha 版ポリシーで後方互換コードは書かない

- [x] User approved this draft
