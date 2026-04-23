# Draft: 220-auto-check-phase-aware-input

**開発種別:** feature
**目的:** auto-check の入力テキスト選択を flow 進行 phase に応じて切り替え、spec 承認後は無条件 eligible 化することで、「spec 確定後でも auto 判定 NG」の体感バグと `MULTIPLE_PREPARING_FLOWS` 事故を構造的に解消する。

## 議論モード

本 draft は**決定モード**での合意を反映する (brainstorm ではない)。Q1-Q5 で提示した選択肢に対し、ユーザーが明示的に [1] を選択して確定済み。

## Scope Verification
- In scope:
  - auto-check の入力テキストを flow 進行 phase に応じて選択する能力
  - spec 承認済みの flow に対して auto-check を実行した場合、AI 判定をスキップして無条件 eligible を返す能力
  - auto-check と set-auto で重複していた input 解決ロジックの統一
  - preparing flow を対象とする CLI 操作において実行対象を明示指定する運用への変更
  - 上記能力・変更に対するテストカバレッジ
- Out of scope:
  - implement 完了後の post-hoc 検証 (既存 review 機能と責務重複)
  - 累積した preparing flow の自動クリーンアップ (別 issue)
  - 旧 CLI オプションの経過措置 (alpha 版ポリシーに従い即廃止)
  - `flow prepare` の既存挙動

## Impact on Existing Features
- 影響ありの既存機能:
  - `sdd-forge flow run auto-check`: 既存の任意入力テキスト指定を受理しなくなる。呼び出し元は flow 初期化を経由する運用に移行する
  - `sdd-forge flow set auto on/off`: preparing flow 対象時の対象特定ルールが「明示指定必須」に変わる。暗黙の自動選択は行わない
  - flow 運用スキル群 (flow 起動から auto-check を呼び出す skill): 引数形態変更に追従が必要
- 影響なし:
  - `sdd-forge flow prepare`: 既に明示指定運用
  - `sdd-forge flow run review`: 独立機能、変更なし
  - AI 呼び出し経路 (`tests/agent/` で検証される層): プロンプト・モデル呼び出しロジックに変化なし

## 要求事項 (優先順位付き、When / shall 形式)

- **P1 (最優先、体感バグの直接解決)**: When ユーザーが spec 承認済みの flow に対して auto-check を実行したとき、shall システムは AI 判定をスキップして無条件 eligible を返す
- **P2**: When auto-check が preparing flow または active flow を対象に実行されたとき、shall システムは flow の進行 phase に応じて入力テキストを静的に決定する (任意入力指定に依存しない)
- **P3**: When auto-check / set-auto が preparing flow を対象に実行され、かつ対象識別子が明示指定されていないとき、shall システムはエラーで終了する (暗黙自動選択を行わない)
- **P4**: When auto-check と set-auto の両者が input 解決を行うとき、shall 両者は同一のロジック (共通モジュール) を参照する

## 移行計画 (破壊的 CLI 変更)

alpha 版ポリシーにより後方互換コードは保持しない。ただし移行経路を明示する:

- **廃止される操作**: `flow run auto-check` への任意入力テキスト直接指定
- **移行先**: `flow set init` で preparing flow を先に作成 → 返却された識別子を `flow run auto-check` に明示指定
- **影響を受ける呼び出し側**: flow 運用スキル。本 spec スコープ内で追従する
- **外部の呼び出し側**: alpha 期間のため事前通知なし。CHANGELOG に破壊的変更として記載
- **preparing flow 対象指定の暗黙自動選択撤廃**: preparing flow が 1 個のみの場合も明示指定を要求するよう統一

## Q&A (決定の記録)
- Q1: post-hoc 検証 (implement 後の整合性チェック) を本 spec に含めるか
  - A: 含めない。根拠は **guardrail "Single Responsibility"** — 既存 review 機能と責務が重複するため分離を優先。issue 本文も phase 4 削除済み
- Q2: 任意入力テキスト指定の扱い
  - A: 完全廃止。根拠は **CLAUDE.md の alpha 版ポリシー "後方互換コードは書かない"** と、**guardrail "Complete Context"** — 呼び出し側で文脈判断させるとブレの原因となるため経路を単一化する
- Q3: spec 確定状態の判定マーカー
  - A: ユーザー明示承認を示すマーカーを採用。根拠は **既存コード `src/flow/lib/set-auto.js` の `isSpecApproved` 実装との整合性** — 同一意味の判定を既存パターンに揃え、AI ゲート通過だけでは循環承認になる設計上の懸念を回避
- Q4: preparing flow 対象指定の必須化と暗黙自動選択の撤廃
  - A: 実施。根拠は **今回の `MULTIPLE_PREPARING_FLOWS` 事故の再現観測** と **guardrail "Unambiguous Requirements"** — ヒューリスティック依存のインターフェースは障害時に回復が難しいため明示指定に統一
- Q5: テスト方針
  - A: 既存 unit テスト拡張 + integration シナリオ 1 本追加。stub agent で AI 呼び出しを代替。根拠は **既存の spec 218 テスト配置パターン** — 公開 CLI コントラクトを検証する層に揃える

## Open Questions
- なし (全て draft 段階で解決)

## User Approval
- [x] User approved this draft
- Confirmed at: 2026-04-23
- Notes: Q1-Q5 全て合意。issue #237 本文も phase 4 削除済みに更新完了。
