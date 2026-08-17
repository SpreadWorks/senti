# Feature Specification: 189-fix-codex-json-parse

**Feature Branch**: `feature/189-fix-codex-json-parse`
**Created**: 2026-04-18
**Status**: Ready for Approval
**Input**: Issue #169 — CodexProvider JSON parse failure

## Goal

`codex` CLI 経由での agent 呼び出しで NDJSON parse が失敗し、stderr 警告と usage metrics 喪失が発生する問題を根本解決する。併せて、config で上書き不能な暗黙のフラグ自動注入機構を廃止し、profile 定義が常に literal に解釈される設計原則を確立する。

## Scope

- `codex` / `claude` 系 builtin profile の args 定義に JSON 出力フラグを literal に組み込む
- agent サービスが持つフラグ自動注入ロジックを完全削除
- Provider 抽象から「フラグを返すメソッド」を廃止
- UserProvider から独自フラグ指示フィールドの読み取りを廃止
- 関連単体テストの更新（自動注入されない挙動を検証）
- CHANGELOG への breaking change 記載

## Out of Scope

- UserProvider の fallback 挙動（`text: stdout, usage: null`）変更
- gate プロンプトそのものの出力形式変更
- 既存ユーザー config の自動マイグレーション機能
- codex 以外の新規 Provider 追加

## Clarifications (Q&A)

- Q: parse 失敗時の影響範囲は？
  - A: (1) stderr 警告 (2) usage metrics 喪失 (3) fallback text が下流に渡り信頼性低下。
- Q: 対応アプローチは parse フォールバック / gate プロンプト JSON 強制 / 両方のどれか？
  - A: 調査の結果「codex に `--json` フラグを付け忘れている」ことが判明。parse 修正ではなく args 修正で根本対応。
- Q: config との関係は？自動注入で補完すれば config 変更不要ではないか？
  - A: 自動注入は config で上書き不能な隠し動作となり、CLI フラグ名変更時に code 修正必須となるため却下。builtin args に literal 記述する設計に統一する。
- Q: 独自フィールドを config で使っていたユーザーへの移行告知は？
  - A: CHANGELOG のみで告知。ランタイム warning は追加しない（alpha 期間ポリシー、過剰防御回避）。

## Alternatives Considered

| 案 | 採否 | 根拠 |
|---|---|---|
| parse 側で非JSON行を無視/連結 | 却下 | 対症療法。metrics 喪失は残存。 |
| gate プロンプトを JSON 出力強制 | 却下 | gate 以外の呼び出しに効果なし。適用範囲が狭い。 |
| 自動注入を維持したまま codex の注入値のみ追加 | 却下 | config 上書き不能な隠し動作が残存。CLI フラグ名変更時に code 修正必須。 |
| **builtin args に JSON フラグを literal 記述 + 自動注入機構を廃止** | **採用** | config は literal 解釈、フラグ名変更時も config のみで対応可能。 |

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-18
- Notes: ユーザー承認「1 後は頼む」を以て確定。残りステップは自律実行。

## Requirements

### P1: parse 失敗の根絶

- R1.1: **When** JSON 出力対応の builtin profile（`codex/*`, `claude/*`）で agent が呼び出される、**shall** CLI に JSON 出力フラグが渡り、Provider の parse 処理が例外なく完了する。
- R1.2: **When** parse が成功する、**shall** usage metrics（tokens）が flow.json の `accumulateAgentMetrics` 経由で記録される。
- R1.3: **When** 修正後に `sdd-forge flow run gate` を codex profile で実行する、**shall** stderr に `agent output parse failed` 警告が出力されない。

### P2: config profile の literal 解釈

- R2.1: **When** ユーザーが `config.agent.providers` で profile を定義し agent が呼び出される、**shall** 定義された args が CLI にそのまま渡り、本パッケージ側から追加のフラグが注入されない。
- R2.2: **When** CLI のフラグ名が将来変更される、**shall** ユーザーは config の args 編集のみで追従でき、本パッケージのコード修正を必要としない。
- R2.3: **When** agent サービスが profile を実行する、**shall** Provider オブジェクトから「フラグを返すメソッド」を参照せず、かつそのメソッドは Provider 抽象に存在しない。

### P3: 設計原則の明文化

- R3.1: **When** 新たな builtin Provider が追加される、**shall** 必要な CLI フラグは builtin profile の args に literal に記述される規約が docs/ または AGENTS.md に明記されている。

### P4: 移行告知

- R4.1: **When** リリース時、**shall** CHANGELOG に breaking change として「独自フラグ指示フィールドの廃止」「builtin args に JSON フラグが含まれるようになった影響」が記載される。

## Acceptance Criteria

- AC1: `codex` profile で `sdd-forge flow run gate` を実行すると、stderr に parse 失敗警告が出力されない。
- AC2: 上記実行後、`specs/<spec>/flow.json` の metrics 累積に tokens の値が 0 でない形で記録される。
- AC3: `config.agent.providers` に定義したプロファイルの args が、実行時プロセスの argv に literal に一致する（追加・挿入なし）。
- AC4: 既存の agent 関連ユニットテストがすべて pass し、自動注入機構に依存したテストは削除または updated されている。
- AC5: CHANGELOG に該当 breaking change の記載がある。

## Open Questions

- なし（下記 Resolved 参照）

### Resolved
- ユーザー config の独自フラグ指示フィールド使用者数が不明 → ランタイム warning 追加は本 spec のスコープ外とし、必要なら別 spec で対応する方針で確定。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-18
- Notes: ユーザー承認「1 後は頼む」を以て確定。残りステップは自律実行。
