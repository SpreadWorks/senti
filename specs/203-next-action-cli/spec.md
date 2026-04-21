# Feature Specification: 203-next-action-cli

**Feature Branch**: `feature/203-next-action-cli`
**Created**: 2026-04-21
**Status**: Ready for Review
**Input**: GitHub Issue #187 (cac6/T5)

## Goal

skill 薄化（cac6 計画の主目的）のための CLI ハブとして `sdd-forge flow get next-action` を新設する。現在の flow / task の step に応じて「次に取るべきアクション（instructions 識別子 / 必要な context 記述子 / 出力を拘束する JSON Schema / 承認要否フラグ）」を静的な宣言ルールから決定し、envelope 形式の JSON で返却する。これにより skill 側の分岐ロジックを CLI 層に集約し、skill は「next-action を呼ぶ → 指示に従う」のループに縮退できる。

## Why This Approach

- Issue #187 が明示する契約（返却形式 / context 静的定義 / approval 3 点 / output_schema 拘束）を最小変更で満たす。
- 既存の task/flow step 構造およびフェーズ判定機構を再利用し、決定ロジックの重複を避ける。
- 宣言的な静的ルール表現を採用することで、新 step/action/context 種別の追加を「定義追記のみ」で対応可能にし、将来 T6 以降の拡張を阻害しない。
- `next-action` は副作用のない純粋 getter に限定し、context 解決責務は既存の専用コマンドに委譲することで、単一責務を保ちつつ呼び出し側 JSON を肥大化させない。

## Scope

1. `sdd-forge flow get next-action` サブコマンドの新設と、その振る舞いの完全定義。
2. step → 次アクション情報（context 種別・output_schema 参照・action ラベル・instructions 識別子・requires_approval）を宣言的に保持する静的ルール定義の新設。
3. 各 step の `output_schema` の静的定義（JSON Schema 形式）。本コマンドは実行時にこれを読み込み、返却 JSON にインライン展開する。
4. 上記振る舞いを検証するユニットテスト（公開 CLI 契約テストとして長期維持）。

## Out of Scope

- skill 本体（plan / impl / finalize）の書き換え — 後続タスク（cac6/T7 / 別 issue）。本 spec は CLI 層のみ。
- step ごとの instructions 本文テンプレ配置 — 後続タスク（cac6/T6 / #188）。本 spec は identifier を返すところまで。
- tasks 並列実行・task 追加ワークフロー本体 — 別 spec。
- 既存 gate / impl-confirm / finalize の内部ロジック変更。
- flow get / set / run コマンド全体の返却値契約（エラー vs 状態）の方針統一 — ボード `daf8` として切り出し済み。本 spec では `next-action` 自身の返却契約のみ定義する。

## Clarifications (Q&A)

- Q: flow レベル step と task レベル step の両方を対象にするか？
  - A: 両方。current task が non-null なら task step、null なら flow step にフォールバック（Q2 で確定）。
- Q: `context` フィールドはファイル内容等まで解決して返すか？
  - A: 返さない。記述子（種別名・参照パス等のメタ情報）のみ。解決は既存の `flow get context` 等に委ねる（Q3）。
- Q: `output_schema` は ref か、インライン JSON Schema か？
  - A: インライン JSON Schema。呼び出し側が追加読み込み無しで検証できる形で返す（Q4）。
- Q: active flow / current task が無い場合の返却契約は？
  - A: active flow 無し → `ok: false` でエラー。current task 無し → flow レベル step にフォールバックして `ok: true`（Q5）。「状態問い合わせ系/操作系」の全体方針統一は別課題 `daf8`。
- Q: テスト配置は？
  - A: 公開 CLI 契約テストとして長期維持（Q6）。

## Requirements

要件は優先度順（P1 = 必須契約、P2 = 必須派生、P3 = 必須運用）で整理。全 11 件。

### P1 — CLI 契約

- **REQ-1** When ユーザーが `sdd-forge flow get next-action` を呼んだ時、shall `{ taskId, step, action, instructions, context, output_schema, requires_approval }` の 7 フィールドを持つ `data` を envelope `{ ok, type, key, data, errors }` として返す。
- **REQ-2** When active flow が存在しない時、shall `ok: false` で errors 配列に説明的なエラーメッセージを含めて返し、プロセス終了コードは非ゼロとする。
- **REQ-3** When active flow があり current task が non-null の時、shall 現在 task の最初の `in_progress` step を対象として応答を組み立て、`taskId` にその task の id を設定する。
- **REQ-4** When active flow はあるが current task が null の時、shall flow レベルの最初の `in_progress` step を対象として応答を組み立て、`taskId` には `null` を設定する（task 無しフォールバック）。
- **REQ-5** When 対象 step が「flow レベル `approval`（spec 完了直後の承認点）」「task レベル integration 判断点」「flow レベル `finalize` 直前」の 3 点のいずれかである時、shall `requires_approval: true` を返す。それ以外の全 step では `requires_approval: false` を返す。

### P2 — context と output_schema の決定規則

- **REQ-6** When step が決定された時、shall 宣言的に定義された静的ルール（step → context 種別・output_schema 参照・action ラベル・instructions 識別子・requires_approval）から対応エントリを解決し、返却 JSON に反映する。
- **REQ-7** When 返却 JSON の `context` を組み立てる時、shall 必要な context 種別の記述子（種別名文字列配列、および必要に応じて参照パス等のメタ情報）のみ含める。ファイル内容・git diff 出力・テストログ本文等の解決済みペイロードは含めない。
- **REQ-8** When 返却 JSON の `output_schema` を組み立てる時、shall 事前に定義された JSON Schema をファイルから読み込み、schema オブジェクトそのものをインラインで含める。ref 形式（path のみ）では返さない。
- **REQ-9** When 対象 step に対応する静的ルールが未定義の時、shall `ok: false` でエラーを返し、errors 配列に該当 step 名を含めて明示する（暗黙の空応答・デフォルト応答を返してはならない）。

### P3 — 運用

- **REQ-10** When 呼び出し側が AI 出力を検証する時、shall 本コマンドが返す `output_schema` のみで完結した検証が可能である（外部ファイルの追加読み込みを要しない）。
- **REQ-11** When 新しい step / action / context 種別を追加する時、shall 宣言的ルール定義（静的データ）および output_schema ファイルの追加のみで対応可能であり、`next-action` 本体コードの条件分岐追加を要しない。

## Acceptance Criteria

- `sdd-forge flow get next-action` が flow レベル各 step（draft / gate-draft / spec / gate / approval / test / implement / review / finalize 等）で期待通りの `action` / `requires_approval` / `output_schema` / `context` を返す。
- `sdd-forge flow get next-action` が task レベル plan 由来 step（gate / approval / write-tests / impl / run-tests / review / update-overview）および addition 由来 step（draft / approval / gate / approval-2 / write-tests / impl / run-tests / review / update-overview）で期待通りの応答を返す。
- `requires_approval: true` を返す step が 3 種類のみ（flow レベル approval / task レベル integration 判断点 / flow レベル finalize 直前）であり、他は false。
- active flow が無い状態で呼ぶと `ok: false` で errors に「no active flow」相当のメッセージが入り、非ゼロ終了コードとなる。
- active flow はあるが current task が null の状態で呼ぶと、flow レベル step にフォールバックして正常応答する（`ok: true`, `taskId: null`）。
- 静的ルールに未定義な step を in_progress として渡すと `ok: false` でエラーになり、errors に step 名を含む。
- 返却 `output_schema` が JSON としてパース可能な JSON Schema オブジェクト（少なくとも `type` フィールドを持つ）である。
- 新しい step を静的ルール・schema 追加のみで認識可能であり、`next-action` 本体コードの変更を要しない（テストで検証）。
- ユニットテストは公開 CLI 契約テストとして配置され、`npm test` で実行される。

## Alternatives Considered

1. **`context` に解決済みペイロードを含める** — 却下。CLI レスポンスが肥大化し、既存の context 解決コマンドと責務重複。skill 側は必要な context のみ個別取得できるほうが柔軟。
2. **`output_schema` を ref（path）形式で返す** — 却下。既存の schema 検証ユーティリティは `(value, schema)` 形式で動作しており、ref 解決機構を別途新設する価値がない。呼び出し側の追加 I/O も発生させたくない。
3. **static ルールを JSON ではなく JS コードで定義** — 却下。宣言的データとして JSON 化することで、ハードコード分岐を避け、テスト容易性・拡張性（REQ-11）を確保する。
4. **task レベル step のみ対応、approval 3 点も task 側で処理** — 却下。approval のうち「spec 完了直後」「finalize 直前」は flow レベル固有で、task 構造に無理に寄せると Issue 本文と乖離する。
5. **active flow 無しも `ok: true` で no-op 応答** — 却下。`next-action` は「次に取るべきアクション」を返す契約であり、対象 step が決定できないなら明示的にエラーの方が呼び出し側のガード処理が単純になる。なお flow 全体の「状態 vs エラー」方針統一は別課題 `daf8`。

## Test Strategy

公開 CLI コマンドの契約テストとして `npm test` で実行されるユニットテストを新設し、長期維持する。

- **happy path**: flow / task 各 step での正常な応答構造（7 フィールドの型と内容）の検証。
- **flow レベル step 網羅**: draft / gate-draft / spec / gate / approval / test / implement / review / finalize の主要 step での action / requires_approval の値。
- **task レベル step 網羅**: plan 由来・addition 由来の全 step の action / requires_approval の値。
- **approval 3 点の検証**: `requires_approval: true` を返すのが 3 種類の step のみであること。
- **エラーケース**: active flow 無し → `ok: false`。静的ルール未定義 step → `ok: false`。
- **フォールバック**: current task 無しのとき flow レベル step に遷移すること。
- **output_schema の形状検証**: 返却された schema が JSON Schema オブジェクトとして妥当（`type` フィールド保持）で、`validateSchema` にそのまま渡せること。
- **拡張性テスト**: 新規 step を静的ルールに追加した場合、`next-action` 本体コード変更なしでその step の応答が返ること（fixture 差し替えで検証）。

## Impact on Existing Features

- 既存の flow get / set / run コマンドの挙動は変更しない（新規コマンド追加のみ、既存契約は不変）。
- 既存の skill / gate / impl-confirm / finalize の呼び出しパスは変更しない（本 spec 範囲外）。
- 既存の step/phase 定数・フェーズ判定ロジックは流用し、再定義も破壊的変更も行わない。
- help テキストへの追記（新規コマンドの説明）以外、ユーザー体験への既存影響はない。
- 既存テストへの影響なし（新規テスト追加のみ）。

## Constraints

- Node.js 組み込みモジュールのみ使用（プロジェクトポリシー「外部依存なし」）。
- alpha 版ポリシー: 後方互換コードは書かない。
- `next-action` は副作用なし（ファイル書き込み・状態更新・外部プロセス起動なし）。読み取りのみ。
- 返却 JSON は既存 `flow get` 系の envelope 形式 `{ ok, type, key, data, errors }` に準拠。
- エラー時は必ず非ゼロ終了コード（プロジェクトガードレール「Exit Code Contract」）。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-21
- Notes: Q1–Q6 の決定事項および本 spec 内容について承認（auto モード下の gate PASS 経由）。

## Open Questions

- (なし — Q&A は全て解決済み。実装時に新たに出た論点は `issue-log.json` に記録する)
