# Feature Specification: 153-unified-jsonl-logger

**Feature Branch**: `feature/153-unified-jsonl-logger`
**Created**: 2026-04-07
**Status**: Draft
**Input**: User request — #105 統合 JSONL ログ設計（Logger API リデザイン + プロンプト分離）

## Goal

sdd-forge の動作追跡デバッグログを、軽量な JSONL（メタデータのみ）と独立した JSON プロンプトファイル（重い本体）の 2 段構造に再設計する。これにより AI ツールが JSONL を読み込んでも context を圧迫せず、jq でメタデータを絞り込んでから必要なプロンプトファイルだけを開く調査フローを実用化する。

## Scope

- 新 `Logger` クラス（singleton）の再設計と `agent` / `git` / `event` の 3 ドメインメソッド公開
- `agent` ドメインの完全実装（start / end の 2 イベント、`requestId` 紐付け、プロンプトファイル分離、`spec` / `sddPhase` の自動解決）
- `git` / `event` ドメインメソッドの API 提供のみ（呼び出し側の置き換えはしない）
- 統合ログファイル `.tmp/logs/sdd-forge-YYYY-MM-DD.jsonl`（日次ローテート）の生成
- プロンプトファイル `.tmp/logs/prompts/YYYY-MM-DD/<requestId>.json`（自己完結 JSON）の生成
- 既存 `Log` 基底クラス / `AgentLog` クラス / `writeLogEntry()`（公開 API としての）廃止
- 既存ヘルパー `callAgentWithLog` / `callAgentAwaitLog` / `callAgentAsyncWithLog` の内部書き換え（外部 API シグネチャは維持）
- 設定キー `cfg.logs.prompts` → `cfg.logs.enabled` のリネーム
- `src/sdd-forge.js` エントリポイントでの Logger 初期化
- Logger 単体テスト + `callAgent*` 回帰テスト + e2e テスト

## Out of Scope

- `git-helpers` などからの `Logger.git()` 呼び出し置換（別 spec）
- パイプライン進捗・エラー等での `Logger.event()` 呼び出し（別 spec）
- 閲覧コマンド `sdd-forge logs`（別 spec）
- 集計レポート機能（別 spec）
- ログの自動ローテート削除（不要）
- スタック解析による `command` フィールド抽出（不採用、Q5 参照）

## Clarifications (Q&A)

- Q1: 本 spec の実装スコープはどこまでか？
  - A: Logger 基盤刷新と既存 `callAgent*` ヘルパー経由の agent ログ移行のみ。`Logger.git` / `Logger.event` は API のみ提供。
- Q2: `agent` end イベントの `spec` / `sddPhase` の取得方法は？
  - A: Logger 初期化時に flow-state から自動解決して内部保持。`logCtx` 引数は廃止し、call site から削除する。
- Q3: Logger 初期化のタイミングと `enabled=false` 時の挙動は？
  - A: `src/sdd-forge.js` で常に `Logger.getInstance().init(cwd, cfg, {entryCommand})` を呼ぶ。disabled のときは Logger メソッドが no-op として早期 return する。
- Q4: 既存 `cfg.logs.dir` はどうするか？
  - A: 残す。`cfg.logs.prompts` のみ `cfg.logs.enabled` にリネーム（後方互換なし）。
- Q5: `command` フィールドと `extractCommandFromStack()` を実装すべきか？
  - A: 両方廃止。`entryCommand` と `callerFile` / `callerLine` で実用上の特定は可能。Issue 本文の提案からの差分。
- Q6: テスト戦略は？
  - A: Logger 単体 + `callAgent*` 回帰 + e2e の 3 層。

## Alternatives Considered

- **Issue 本文どおり `extractCommandFromStack()` を実装する案**: スタックのパスパターン解析はリファクタで壊れやすく、`callerFile` / `callerLine` があれば実用上の特定は可能なため、本 spec では不採用。
- **call site で `logCtx={spec, phase}` を渡し続ける案**: 現状の API。call site の重複が多く、新規呼び出し追加時に渡し忘れが起きる。Logger 内部での自動解決に統一する。
- **disabled 時に init をスキップする案**: call site で初期化済みかチェックする防御コードが必要になるため不採用。常に init し、内部 no-op で吸収する。
- **`cfg.logs.dir` も廃止する案**: 出力先カスタマイズの将来的な需要を残すため不採用。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-07
- Notes: gate spec PASS (15/15) 後にユーザー承認。Issue #105 の設計を踏襲しつつ extractCommandFromStack は不採用。

## Requirements

優先順位順:

1. **R1: 統合 JSONL ファイル生成（最優先）**
   When `cfg.logs.enabled === true` であり、Logger が初期化済みであるとき、`Logger.agent({phase})` の呼び出しは `<logDir>/sdd-forge-YYYY-MM-DD.jsonl` に 1 行 1 イベントの JSON を append shall。日付は書き込み時の `new Date()` をローカルタイムで整形した値とする。

2. **R2: プロンプトファイル分離**
   When `Logger.agent({phase: "end", prompt, response, ...})` が呼ばれたとき、Logger は `<logDir>/prompts/YYYY-MM-DD/<requestId>.json` に自己完結 JSON（`requestId`, `ts`, `context`, `agent`, `prompt`, `response`, `execution`）を書き込み、JSONL 側の end レコードには `promptFile` フィールドにそのパスを記録 shall。

3. **R3: agent start / end の 2 イベント**
   When `Logger.agent({phase: "start", requestId})` が呼ばれたとき、Logger は最小フィールド（`ts`, `type: "agent"`, `phase: "start"`, `requestId`, `entryCommand`, `callerFile`, `callerLine`, `pid`）の JSONL 行を append shall。
   When `Logger.agent({phase: "end", ...})` が呼ばれたとき、Logger は denormalized リッチレコード（共通フィールド + `spec`, `sddPhase`, `agentKey`, `model`, `promptChars`, `systemChars`, `userChars`, `promptLines`, `responseChars`, `responseLines`, `durationSec`, `exitCode`, `promptFile`）を append shall。

4. **R4: spec / sddPhase の自動解決**
   When Logger が初期化されたとき、Logger は flow-state（`.sdd-forge/state.json` 等の現行アクセス手段）から `spec` / `sddPhase` を読み取り内部に保持 shall。`Logger.agent({phase: "end"})` のレコードにはこれらが自動付与される shall。call site は `spec` / `sddPhase` を渡す必要がない。

5. **R5: 既存ヘルパーの内部書き換え**
   When `callAgentWithLog` / `callAgentAwaitLog` / `callAgentAsyncWithLog` のいずれかが呼ばれたとき、内部実装は新 `Logger.agent()` API を使って start イベント送出 → エージェント実行 → end イベント送出（成功・失敗とも）を行う shall。これらヘルパーの**外部シグネチャと戻り値の型は維持**するが、`logCtx` 引数（spec/phase）は廃止する shall。

6. **R6: cfg.logs.enabled へのリネーム**
   When `cfg.logs` が読み込まれたとき、`cfg.logs.enabled` のみが Logger の有効/無効スイッチ shall。`cfg.logs.dir` は従来どおり出力先 override として読まれる shall。`cfg.logs.prompts` は読まない（旧キーは未設定として扱う）shall。

7. **R7: disabled 時の no-op**
   When `cfg.logs.enabled !== true` のとき、`Logger.agent` / `Logger.git` / `Logger.event` の呼び出しはファイル I/O を行わずに即時 return shall。call site の if 分岐は不要 shall。

8. **R8: エントリポイントでの Logger 初期化**
   When `src/sdd-forge.js` が起動したとき、cfg を読み込んだ直後に `Logger.getInstance().init(cwd, cfg, {entryCommand})` を呼ぶ shall。`entryCommand` は `process.argv.slice(2).join(" ")` 等の正規化された文字列とする。

9. **R9: git / event ドメインの API 提供**
   `Logger.git({cmd, exitCode, stderr})` および `Logger.event(name, fields)` のメソッドを公開 shall。enabled 時は対応する JSONL 行を append し、disabled 時は no-op とする shall。本 spec では call site の置き換えは行わない。

10. **R10: 旧 API の削除**
    `src/lib/log.js` の `Log` 基底クラスと `writeLogEntry`（公開 export として）を削除 shall。`src/lib/agent-log.js` ファイルを削除 shall。alpha 版ポリシーにより旧 API のフォールバックは残さない shall。

11. **R11: worktree からの書き込み先解決**
    When sdd-forge が worktree から実行されたとき、Logger はメインリポジトリ側のパスにログを書き込む shall（既存 `resolveLogDir` の挙動を踏襲）。

12. **R12: requestId 生成**
    When `requestId` が必要なとき、`crypto.randomBytes(4).toString("hex")` で 8 文字 hex を生成する shall。同一の `requestId` で start / end / プロンプトファイル名を紐付ける shall。

## Acceptance Criteria

- AC1: `cfg.logs.enabled = true` で `sdd-forge flow run gate` を実行すると、`.tmp/logs/sdd-forge-YYYY-MM-DD.jsonl`（YYYY-MM-DD は実行日）が生成され、`type: "agent"` の `phase: "start"` と `phase: "end"` がそれぞれ 1 行以上 append される。
- AC2: 同実行で `.tmp/logs/prompts/YYYY-MM-DD/<requestId>.json` が生成され、JSONL の end レコードの `promptFile` フィールドのパスと一致する。
- AC3: 生成された end レコードの `spec` フィールドが `153-unified-jsonl-logger`、`sddPhase` フィールドが現在のフェーズ（例: `gate-impl`）になっている。call site で渡していないにも関わらず自動付与されている。
- AC4: `cfg.logs.enabled = false` で同コマンドを実行すると、`.tmp/logs/` 配下にファイルが生成されない（既存ファイルへの追記もない）。
- AC5: `cfg.logs.prompts = true` のみを設定し `cfg.logs.enabled` を未設定にすると、ログは生成されない（旧キーは無視される）。
- AC6: `src/lib/agent-log.js` が削除され、`src/lib/log.js` から `Log` クラスと `writeLogEntry` の export が削除されている。`grep -r "AgentLog\|writeLogEntry" src/` でヒットがない。
- AC7: 既存テスト一式（`npm test`）がパスする（`callAgent*` ヘルパーの外部 API 維持により呼び出し側の改修は不要）。
- AC8: Logger 単体テストで以下が検証されている: init 必須 / disabled 時 no-op / start・end のフィールド構造 / プロンプトファイルの自己完結性 / 同一 requestId での紐付け / 日付ローカルタイム整形 / spec・sddPhase 自動解決。
- AC9: e2e テストで `sdd-forge flow run gate` 実行後、JSONL の end イベント数とプロンプトファイル数が一致し、各 `promptFile` パスが実在することを検証。
- AC10: `sdd-forge flow run gate` 実行時、Logger が原因のエラーで非ゼロ終了することがない（Logger の I/O 失敗はプロセスを落とさず stderr に警告して継続する）。

## テスト方針

### 1. Logger 単体テスト

配置: `tests/unit/lib/logger.test.js`

検証項目:
- `init` 未呼び出しで `Logger.agent` を呼ぶと no-op + stderr 警告
- `cfg.logs.enabled !== true` で no-op
- `Logger.agent({phase: "start", requestId})` が JSONL に最小フィールドを append
- `Logger.agent({phase: "end", ...})` が JSONL に denormalized リッチレコードを append
- end 時にプロンプトファイル `<logDir>/prompts/YYYY-MM-DD/<requestId>.json` が生成され、JSONL の `promptFile` と一致
- プロンプトファイルが `requestId`, `ts`, `context`, `agent`, `prompt`, `response`, `execution` のキーで自己完結
- `spec` / `sddPhase` が flow-state から自動解決される（fixture でモック）
- `Logger.git` / `Logger.event` が enabled で JSONL に append、disabled で no-op
- 日付ローテート: 異なる日付で書き込むと別ファイルに振り分けられる
- `requestId` 8 文字 hex の検証

### 2. `callAgent*` 回帰テスト

配置: `tests/unit/lib/agent-with-logger.test.js`

検証項目:
- `callAgentWithLog` / `callAgentAwaitLog` / `callAgentAsyncWithLog` を擬似 agent で呼び出し、start イベント・end イベント・プロンプトファイルの 3 点が生成されること
- ヘルパーの外部戻り値（trim 済み response 文字列）が新旧で同じであること
- ヘルパーの呼び出し失敗時も end イベント（`exitCode != 0`）が記録されること

### 3. e2e テスト

配置: `specs/153-unified-jsonl-logger/tests/`（spec verification として、`tests/` には置かない）

理由: `flow run gate` の実行は重く、本 spec の達成確認が目的のため `tests/` ではなく spec ローカルに配置する。`tests/README.md` に実行方法と期待結果を記載する。

検証項目:
- 実プロジェクト fixture で `sdd-forge flow run gate` を実行
- 実行後に `.tmp/logs/sdd-forge-*.jsonl` が存在し、`agent` イベントが含まれる
- end イベント数と `prompts/*/` 配下の JSON ファイル数が一致
- 各 end イベントの `promptFile` パスが実在
- 各 end イベントに `spec`, `sddPhase`, `entryCommand`, `callerFile`, `callerLine` が記録されている

## Open Questions

なし。

## Migration

`cfg.logs.prompts` → `cfg.logs.enabled` リネームは設定キーの破壊的変更となるため、本リリースで以下の対応を行う:

1. **`src/templates/config.example.json` の確認**: 現状のテンプレートには `logs` セクションが含まれない（ロギングは opt-in 機能）。`logs.prompts` の記述が存在しないため、テンプレート側の置換作業は不要。新規プロジェクトでロギングを有効化したいユーザーは config に `"logs": { "enabled": true }` を追加する。
2. **CHANGELOG / リリースノート記載**: alpha 期間の破壊的変更として、ユーザーが `.sdd-forge/config.json` の `logs.prompts: true` を `logs.enabled: true` に書き換える必要があることを明記する。
3. **既存 `prompts.jsonl` の扱い**: 既存ファイルは削除も移行もしない。新ログは `sdd-forge-YYYY-MM-DD.jsonl` に書かれ、ユーザーが手動で旧ファイルを削除できる。
4. **未設定検出時の警告**: 旧 `cfg.logs.prompts` が設定されているが `cfg.logs.enabled` が未設定の場合、エントリポイントで stderr に「`cfg.logs.prompts` は廃止されました。`cfg.logs.enabled` を使用してください」と一度だけ警告する shall。これは alpha 版でも気付きを与えるための最小の救済措置とする。

## Implementation Notes

- flow-state からの `spec` / `sddPhase` 取得 API は、既存ヘルパー（例: `flow-state.js` の `loadFlowState()`）を再利用するか Logger 専用の薄い読み取り関数を新設するかは実装時に決定する。spec の達成にはどちらでも良い。

## Why this approach

- **2 段構造（軽量 JSONL + 重いプロンプト JSON）**: AI ツールが JSONL 全体を読み込んでも context が圧迫されない。jq で絞り込んでから必要な JSON だけ開く調査フローを支える。
- **Logger 内部での `spec` / `sddPhase` 自動解決**: call site の煩雑さ・渡し忘れを排除する。`callAgent*` ヘルパー数十箇所の引数を毎回組み立てる必要がなくなる。
- **`extractCommandFromStack` 不採用**: スタックのパスパターン解析はリファクタで脆く、`callerFile` + `callerLine` の生値で実用上の特定は可能。「シンプルなインターフェースに十分な実装を隠す」原則。
- **常に init / 内部 no-op**: call site の if 分岐を撒かないことで、新規 call site 追加のコストを下げる。
- **alpha 版ポリシー準拠**: `cfg.logs.prompts` の旧キー読み取りや `prompts.jsonl` への書き込みを残さず、コードを単純に保つ。
