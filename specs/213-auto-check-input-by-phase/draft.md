# Draft: 213-auto-check-input-by-phase

**開発種別:** feature
**目的:** `flow set auto on` の auto-check 入力を、フローの進行状況（spec 承認済み / draft 存在 / pre-prepare）に応じて切り替え、spec を詰め切った後や draft で要件が固まった後でも auto モードを有効化できるようにする。

## Scope Verification
- In scope（優先度順）:
  - **P1** — spec が承認済みと判定できる場合、auto-check を実行せず即 autoApprove を有効化する
  - **P2** — spec 未承認だが draft が既に記述されている場合、auto-check の採点対象を draft 本文に切り替える
  - **P3** — 上記いずれにも該当しない（pre-prepare / draft 未記入）場合、従来どおり request + issue 本文を採点対象にする
  - **P4** — スキップ経路が発生したことを、後続の `flow get status` 等で参照できるフィールドにより通常の採点結果と区別できるようにする（真偽値で判定可能な識別子を含める）
- Out of scope:
  - 採点ロジック・しきい値・静的ゲートキーワードの変更
  - spec 準備や skill ワークフロー手順の変更
  - draft → spec 遷移時の auto 状態の引き継ぎ仕様変更（既存挙動維持）
  - 新規 CLI フラグの追加

## Impact on Existing Features
- 影響ありの既存機能:
  - `flow set auto on`（spec 承認済み時）: auto-check を走らせず即 autoApprove を有効化するように変わる。AI 採点コスト削減とともに、spec 承認後の再拒否が起こらなくなる
  - `flow set auto on`（spec 未承認 + draft あり時）: 採点対象が request+issue から draft 本文に変わるため、同一 request でも判定結果が変化する可能性がある
  - 既存利用者視点: `flow set auto on` の成功条件は緩和方向の変化のみ。これまで通っていた入力は引き続き通る。CLI サブコマンド名・引数・成功時の envelope 既存フィールドは不変
- 影響なし:
  - `flow run auto-check` サブコマンド（独立経路）
  - pre-prepare 段階で draft がまだ存在しないケース

## Q&A
- Q: 「spec 承認済み」の判定シグナルは何を採用するか？
  - A: フロー側が管理する approval ステップの完了状態を正とする。approval は gate PASS + ユーザー承認を経て done になる定義で、フローエンジン内に揃っているため。`spec.json` 内の状態フィールドは代替候補だったが、フロー進行と疎結合で更新漏れリスクがあるため不採用。
- Q: draft 本文はどのタイミングで参照可能か？
  - A: draft フェーズに入ったフロー（spec ディレクトリが確定したフロー）では draft の成果物が参照可能な状態にある。pre-prepare 段階では draft はまだ存在しないため対象外。
- Q: spec 承認済みスキップ時、監査情報はどう扱うか？
  - A: 「通常の採点を経由していない」ことが後から識別できる情報を保持する。正常採点との混同を避けるための最低限の識別子を含める方針のみ本 draft で合意し、具体的な記録スキーマは spec フェーズで決定する。
- Q: spec 承認済みスキップ時に静的ゲートは残すか？
  - A: 残さない。spec 承認自体が人手のゲートとして最上位であり、追加の静的/AI 採点は冗長。draft 入力切替経路では従来どおり静的ゲート + AI 採点を走らせる。
- Q: 互換性リスクと移行方針は？
  - A: CLI サブコマンドの名前・引数・出力 envelope の既存フィールドは不変で、成功条件が緩和される方向の変化のみ。既存利用者には追加対応を求めない。監査記録の差異は spec に明記する。

## Open Questions
-

## User Approval
- [x] User approved this draft (autoApprove)
- Confirmed at: 2026-04-22
- Notes: auto mode による自動承認。
