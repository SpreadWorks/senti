# Draft: 203-next-action-cli

**Input**: GitHub Issue #187 (cac6/T5)

**Mode:** Decision mode（以下の Q&A はすべてユーザー承認済みの確定事項であり、ブレインストーミングではない）

**開発種別:** 機能追加（CLI コマンド新設）

**目的:** skill 薄化のための CLI ハブとして `sdd-forge flow get next-action` を新設し、現在 flow / task の step に応じた次アクション（instructions / context / output_schema / requires_approval）を静的に決定・返却する。これにより skill 側の分岐ロジックを CLI 側に集約する。

## 背景

- cac6 の 11 分解タスクのうち T5。T1–T4 は closed 済み（spec.json 化 / tasks[] 拡張 / guardrail 3 層化 / test-first determinism）。
- 現状の skill（plan / impl / finalize）には、どの step でどのコマンドを呼ぶか・どこで承認を取るかというフロー制御が大量に書かれている。これを CLI `next-action` 一点に集約し、skill 側は「next-action を呼ぶ → 指示に従う」というループに縮退させる。
- 既に flow.json に task 群と現在 task の保持機構（T2）、task step 列（plan 由来・addition 由来）、task-aware なフェーズ判定機構は揃っている。

## 要件（Requirements）

要件は優先度順（P1 = 必須契約、P2 = 必須派生、P3 = 必須運用）で整理。

### P1 — CLI 契約

- **REQ-1** When ユーザーが `sdd-forge flow get next-action` を呼んだ時、shall `{ taskId, step, action, instructions, context, output_schema, requires_approval }` の 7 フィールドを持つ JSON を返す。
- **REQ-2** When active flow が存在しない時、shall `ok: false` でエラー応答を返す（呼び出し側はガード処理に用いる）。
- **REQ-3** When active flow があり current task が non-null の時、shall 現在 task の in_progress step を対象として応答を組み立てる。
- **REQ-4** When active flow はあるが current task が null の時、shall flow レベルの in_progress step を対象として応答を組み立てる（task 無しフォールバック）。
- **REQ-5** When 対象 step が「spec 完了直後の承認点」「integration 判断時」「finalize 直前」の 3 点のいずれかである時、shall `requires_approval: true` を返す。上記以外の全 step では `requires_approval: false` を返す。

### P2 — context と output_schema の決定規則

- **REQ-6** When step が決定された時、shall その step に対応する context 種別リスト・output_schema・action ラベル・instructions 識別子を、宣言的に定義された静的ルールから解決する。
- **REQ-7** When 返却 JSON の `context` を組み立てる時、shall 必要な context 種別の記述子（種別名・参照パス等のメタ情報）のみ含める。ファイル内容や git diff 出力等の解決済みペイロードは含めない。
- **REQ-8** When 返却 JSON の `output_schema` を組み立てる時、shall JSON Schema オブジェクトをインラインで含める（呼び出し側が単一フィールドを渡すだけで検証可能な形）。
- **REQ-9** When 対象 step に対応する静的ルールが未定義の時、shall `ok: false` で明示的なエラーを返す（暗黙の空応答を返してはならない）。

### P3 — 運用

- **REQ-10** When 呼び出し側が AI 出力を検証する時、shall 本コマンドが返す `output_schema` のみで完結した検証が可能である（外部ファイルの追加読み込みを要しない）。
- **REQ-11** When 新しい step / action / context 種別を追加する時、shall 宣言的ルール定義（静的データ）の追記のみで対応可能であり、`next-action` 本体コードの条件分岐追加を要しない。

## スコープ

1. `sdd-forge flow get next-action` サブコマンドの新設。
2. context 静的ルール定義の新設（step → context 種別・output_schema 参照・action ラベル・instructions 識別子・requires_approval フラグ）。
3. 各 step の output_schema 定義の新設。
4. 上記の振る舞いを検証するユニットテスト。

## スコープ外

- skill 本体の書き換え（T7 / 別 issue の担当）。本 spec は CLI 層の振る舞い定義のみ。
- step ごとの instructions 本文テンプレ配置（T6 / #188 の担当）。本 spec は identifier（キー）を返すところまで。
- tasks 並列実行・task 追加ワークフロー本体。
- 既存 gate / impl-confirm / finalize の内部ロジック変更。
- 「flow get/set/run 全体の返却値契約（エラー vs 状態）の方針統一」。ボード draft `daf8` として切り出し済み。本 spec では `next-action` 自身の返却契約のみ定義する。

## 既存機能への影響

- 既存の flow get / set / run コマンドの挙動は変更しない（新規コマンドの追加のみ）。
- 既存 skill / gate / finalize の呼び出しパスは変更しない（本 spec 範囲外）。
- 既存の step/phase 定数・フェーズ判定ロジックは既存のまま流用し、再定義しない。
- help テキストへの追記（新規コマンドの説明）以外、ユーザー体験への既存影響はない。

## 制約

- Node.js 組み込みモジュールのみ使用（プロジェクトポリシー）。
- alpha 版ポリシー: 後方互換コードは書かない。
- `next-action` は副作用なし（ファイル書き込み・状態更新なし）。読み取りのみ。
- 返却 JSON は既存 `flow get` の envelope 形式 `{ ok, type, key, data, errors }` に従う。

## 決定事項（Q&A より）

- Q1: 返却対象スコープ → flow / task 両方（task 主、flow フォールバック）
- Q2: `context` フィールド → 記述子のみ
- Q3: `output_schema` → インライン JSON Schema
- Q4: active flow / current task 無しの挙動 → active flow 無し=ok:false、task 無し=flow レベルへフォールバック
- Q5: テスト配置 → 公開 CLI 契約テストとして長期維持

## テスト戦略

- 公開 CLI コマンドの契約テストとして配置し、長期維持する。仕様レベルの観点は上記 P1–P3 要件すべてを満たすこと。

## 将来拡張

- T6（#188）で instructions 本文配置が整えば、`instructions` フィールドの返却内容を識別子から本文へ拡張可能（本 spec 外）。

## Q&A

### Q1: 意図確認（2026-04-21）

**AI 推奨:** Issue #187 本文（next-action CLI 新設、context-rules 静的定義、approval 3 点、output_schema 拘束）の理解で着手する。
**根拠:** Issue 本文に仕様が明記されており、cac6 他タスクとの依存関係も記載されている。
**ユーザー回答:** [1] はい。

### Q2: 返却対象スコープ（flow / task レベル）

**AI 推奨:** [1] 両方を対象とする（task 主、flow は approval 点のみ特別対応）。
**根拠:** Issue #187 の context-rules は task step 4 種を指定しつつ、approval 3 点には flow レベル step（spec 完了後・finalize 直前）が含まれる。両方扱う以外に Issue 要件を満たせない。既存のフェーズ判定機構が flow / task 両対応済みなので再利用できる。
**ユーザー回答:** [1] 採用。

### Q3: context フィールドの返し方

**AI 推奨:** [1] 記述子のみ返す（解決は呼び出し側）。
**根拠:** (既存パターン) context 解決専用の CLI コマンドが既に存在する。`next-action` は薄いラッパーではなく「深いモジュール」として司令塔役に留め、解決責務を重複させない。返却 JSON 肥大化も回避できる。
**ユーザー回答:** [1] 採用。

### Q4: output_schema の返し方

**AI 推奨:** [1] インライン JSON Schema で返す。
**根拠:** (既存コード) プロジェクトのスキーマ検証ユーティリティは `(value, schema)` 形式で動作する。ref 解決機構を新設すれば depth-1 の間接が増えるだけで益がない。
**ユーザー回答:** [1] 採用。

### Q5: active flow / current task が無い場合の挙動

**AI 推奨:** [1] active flow 無し=`ok: false`、current task 無し=flow レベルへフォールバック。
**根拠:** (既存パターン) `flow get status` は active 無しでも `active: false` を `ok: true` で返す設計（状態問い合わせ系）。ただし `next-action` は「次に取るべきアクション」を返す契約であり、対象 step が決定できない状況では明示的にエラーとする方が呼び出し側が扱いやすい。task 無しは flow レベル step 解決で正常応答可能なためエラーにはしない。
**ユーザー補足:** 返却値契約（エラー vs 状態）全体の方針統一は別課題。`daf8` としてボードに切り出し済み。本 spec ではこのコマンドに限定した挙動を定義する。
**ユーザー回答:** [1] 採用。

### Q6: テスト戦略

**AI 推奨:** [1] 公開 CLI 契約テストとして長期維持。
**根拠:** (SKILL.md 判断ルール) 「将来の変更で壊れたら常にバグか？ YES → 正式テスト」。`next-action` は公開 CLI 契約であり、仮に静的ルールを破壊的に変更した場合はテストが落ちて気付ける状態を長期維持したい。
**ユーザー回答:** [1] 採用。

## User Confirmation

- [x] User approved this draft
- Confirmed at: 2026-04-21
- Notes: Q1–Q6 の回答および返却値契約方針について承認。別課題 `daf8`（flow 全体の返却値設計）は切り出し済み。
