# Draft: 統合 JSONL ログ設計（Logger API リデザイン + プロンプト分離）

**開発種別:** Refactor + Feature（既存ログ基盤の刷新と、プロンプト本体の分離保存の追加）

**目的:** sdd-forge の動作追跡デバッグログを、軽量な JSONL（メタデータのみ）と独立した JSON プロンプトファイル（重い本体）の 2 段構造に再設計する。AI ツールが JSONL を読み込んで context を圧迫しない設計にすることで、ログを使った調査・改修を実用化する。

## 背景

- 現状の `prompts.jsonl` は `AgentLog` 専用で、git 操作・パイプライン進捗・任意イベントが記録できない
- `prompts.jsonl` にはプロンプト本体がそのまま入るためサイズが膨大になり、AI ツールでログを読むだけで context を消費してしまう
- ログのメタデータ（軽い）とプロンプト本体（重い）の関心事が分離されていない

## スコープ

### In Scope

- 新 `Logger` クラスの実装（agent / git / event の 3 ドメインメソッドを公開）
- agent ドメインの実装（start / end の 2 イベント、requestId による紐付け、プロンプトファイル分離）
- git / event ドメインメソッドの API 提供のみ（呼び出し側の置き換えはしない）
- 統合ログファイル `.tmp/logs/sdd-forge-YYYY-MM-DD.jsonl`（日次ローテート）
- プロンプトファイル `.tmp/logs/prompts/YYYY-MM-DD/<requestId>.json`（自己完結 JSON）
- 既存 `Log` 基底クラス / `AgentLog` クラス / `writeLogEntry()` の廃止
- 既存ヘルパー `callAgentWithLog` / `callAgentAwaitLog` / `callAgentAsyncWithLog` を内部で `Logger.agent()` を呼ぶよう書き換え（呼び出し側 API は維持）
- `cfg.logs.prompts` → `cfg.logs.enabled` リネーム（alpha のため後方互換なし）
- spec / sddPhase の自動解決（Logger init 時に flow-state から取得し、agent end イベントへ自動付与）
- Logger 単体テスト + callAgent\* 回帰テスト + e2e テスト（`flow run gate` 等を実行して JSONL/プロンプトファイル生成を検証）

### Out of Scope

- git-helpers などからの `Logger.git()` 呼び出し（別 spec）
- パイプライン進捗・エラー等での `Logger.event()` 呼び出し（別 spec）
- 閲覧コマンド `sdd-forge logs`（別 spec）
- 集計レポート機能（別 spec）
- ログの自動ローテート削除（不要）
- `extractCommandFromStack()` のスタック解析機構（廃止判断、下記 Q&A 参照）

## Q&A

### Q1. 本 spec の実装スコープはどこまでか？

**A.** Logger 基盤刷新と既存 `callAgent*` ヘルパー経由の agent ログ移行のみ。`Logger.git` / `Logger.event` は API を提供するだけで、呼び出し側の置き換えは別 spec。
**根拠:** 単一責任ガードレール。ログ基盤と call site 全面置換を 1 spec に混ぜると粒度が大きすぎる。

### Q2. agent end イベントの `spec` / `sddPhase` フィールドはどう取得するか？

**A.** Logger 初期化時に flow-state から自動解決し、Logger 内部で保持する。call site が `logCtx={spec, phase}` を渡す必要をなくし、既存 `logCtx` 引数は廃止する。
**根拠:** 「シンプルなインターフェースに十分な実装を隠す」。call site の負担をゼロにする。

### Q3. Logger 初期化のタイミングと `cfg.logs.enabled=false` 時の挙動は？

**A.** `sdd-forge.js` エントリポイントで常に `Logger.getInstance().init(cwd, cfg, { entryCommand })` を呼ぶ。`disabled` のときは Logger 内部メソッドが no-op になる。
**根拠:** call site で if 分岐を撒かない。「過剰な防御コードを書かない」。

### Q4. 既存 `cfg.logs.dir`（出力先カスタムパス）はどうするか？

**A.** 残す。`cfg.logs.prompts` は `cfg.logs.enabled` にリネーム（後方互換なし）。
**根拠:** dir override は今後も必要。alpha 版ポリシーで旧キーは削除。

### Q5. `command` フィールドと `extractCommandFromStack()` は実装すべきか？

**A.** 両方廃止する。ログには `entryCommand`（init 時固定）と `callerFile` / `callerLine`（`new Error().stack` の生値から抽出）のみを記録する。
**根拠:** スタックのパスパターン解析は壊れやすい（リファクタで動かなくなる）。`callerFile` / `callerLine` があれば実用上の特定は可能で、`command` フィールドは冗長。「シンプルなインターフェースに十分な実装を隠す」。
**Issue からの差分:** Issue 本文では `extractCommandFromStack` の実装が提案されていたが、本 spec では不採用とする。

### Q6. テスト戦略は？

**A.** 以下の 3 種類:
1. **Logger 単体テスト** — init / agent start・end / disabled no-op / 日次ファイル分割 / プロンプトファイル分離 / spec・sddPhase 自動解決
2. **`callAgent*` 回帰テスト** — 既存ヘルパーが `Logger.agent()` 経由で start / end イベントとプロンプトファイルを正しく書き出すか
3. **e2e テスト** — 実際に `sdd-forge flow run gate` 等を走らせ、`.tmp/logs/sdd-forge-*.jsonl` と `.tmp/logs/prompts/*/<requestId>.json` の双方が期待どおり生成されることを検証
**根拠:** Logger 公開 API + 既存 call site の挙動 + エンドツーエンドの三層でリグレッションを防ぐ。

## ログ構造（決定事項のサマリ）

### 統合 JSONL ファイル `.tmp/logs/sdd-forge-YYYY-MM-DD.jsonl`

共通フィールド:
- `ts` — ISO8601 タイムスタンプ
- `type` — `agent` / `git` / `event`
- `entryCommand` — ユーザーが叩いたコマンド（init 時固定）
- `callerFile` / `callerLine` — `new Error().stack` から抽出
- `pid` — プロセス識別

agent ドメイン:
- start イベント: `{ts, type, phase: "start", requestId, entryCommand, callerFile, callerLine, pid}`
- end イベント: 上記 + `spec, sddPhase, agentKey, model, promptChars, systemChars, userChars, promptLines, responseChars, responseLines, durationSec, exitCode, promptFile`

### プロンプトファイル `.tmp/logs/prompts/YYYY-MM-DD/<requestId>.json`

自己完結 JSON。`requestId` / `ts` / `context` / `agent` / `prompt` / `response` / `execution` の構造（Issue 本文の構造を踏襲）。

### 共通仕様

- 日付判定: 書き込み時の `new Date()` をローカルタイムで整形（プロセス起動時固定はしない）
- worktree 実行時もメインリポジトリ側に書き込む（`resolveLogDir` の挙動を踏襲）
- `requestId` は `crypto.randomBytes(4).toString("hex")` の 8 文字 hex
- 自動ローテート削除なし

## 既存機能への影響

| 領域 | 影響 |
|---|---|
| `src/lib/log.js` | `Log` 基底クラス削除、`writeLogEntry` を Logger 内部の private 実装に格下げ、`Logger` クラスを新 API に書き換え |
| `src/lib/agent-log.js` | ファイル削除 |
| `src/lib/agent.js` | `callAgentWithLog` / `callAgentAwaitLog` / `callAgentAsyncWithLog` の内部実装を `Logger.agent()` 呼び出しに変更（公開 API 維持） |
| `cfg.logs.prompts` | `cfg.logs.enabled` にリネーム。既存設定は読まず、未設定扱い（disabled）になる |
| 既存 `prompts.jsonl` | 新規書き込みは行わない。古いファイルは残置（手動削除） |
| flow-state アクセス | Logger init 時に spec / sddPhase を解決するため、flow-state ローダーへの読み取り依存が発生する |
| エントリポイント `src/sdd-forge.js` | `Logger.getInstance().init(cwd, cfg, {entryCommand})` を必ず呼ぶ |

## 制約・前提

- 外部依存禁止（Node.js 組み込みのみ）
- 統計値（promptChars 等）は文字数 + 行数の概算。外部 tokenizer は使わない
- alpha 版のため後方互換コード禁止（旧設定キー、旧ファイル名のフォールバックは実装しない）

## 想定される調査フロー（参考）

1. `jq 'select(.type=="agent" and .phase=="end" and .promptChars > 10000)' .tmp/logs/sdd-forge-*.jsonl`
2. ヒットした end イベントの `promptFile` を取得
3. 該当 JSON ファイルを開いてプロンプト本体・レスポンス・コンテキストを確認
4. `callerFile` / `callerLine` から生成元コードを開いて改修

## Open Questions

なし。

---

## User Confirmation

- [x] User approved this draft
- 承認日: 2026-04-07
- 補足: 6 件の Q&A を経て合意。Issue 本文の `extractCommandFromStack` は不採用、それ以外は Issue の設計を踏襲。
