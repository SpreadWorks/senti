# Draft: 212-req-diff-verifiability-gate

**開発種別:** feature
**目的:** spec phase の gate に「各 REQ が diff + test execution summary だけで PASS/FAIL 判定可能か」を問う guardrail を追加し、診断不能な REQ を spec 段階で弾く。

## Requirements

- **R1:** When `sdd-forge flow run gate --phase spec` / `sdd-forge spec gate` が実行されたとき、gate は「各 REQ の判定に必要な evidence が unified diff と test execution summary の範囲に収まるか」を評価する guardrail を AI 応答に含めなければならない (shall)。
- **R2:** When spec.md の REQ が「将来挙動の保証」「コード変更なしで X できる等の拡張性契約」「diff 外のプロセス不変条件」を要求するとき、gate はその REQ を FAIL として報告しなければならない (shall)。
- **R3:** When draft phase の gate が実行されたとき、本 guardrail は評価対象に含まれてはならない (shall not)。draft は要件レベル段階であり、verifiability の厳密審査は spec で行う。

## Scope Verification
- In scope:
  - spec phase guardrail として「REQ diff-verifiability」ルールの追加
  - 本 guardrail が spec phase のみで評価対象となることの確認
- Out of scope:
  - 既存 spec の REQ 書き換え（本 draft は新規 guardrail 追加のみ、遡及修正は行わない）
  - 案C（多数決）/ 案F との統合（別 draft で扱う）
  - gate-impl 側の guardrail 調整・判定 fallback の見直し

## Impact on Existing Features
- 影響ありの既存機能:
  - `sdd-forge spec gate` および `sdd-forge flow run gate --phase spec`: guardrail 1 件追加により AI prompt が拡張される。evaluation プロトコル（`evaluations[]` schema）は不変のため後方互換。
  - 進行中の active flow で再 gate を行うと新 guardrail 分の FAIL が発生し得るが、done 済み spec へは遡及しない。
- 影響なし: preset 継承チェーン（追加のみ）、guardrail JSON schema、`spec.json` フォーマット、`flow.json` フォーマット、既存の guardrail id / body。

## Q&A
- Q: guardrail の category は何にする？
  - A: `process`。
  - Basis: 既存の `unambiguous-requirements`, `complete-context` が同じ「REQ 書式に関する process 系」ルールとして `process` カテゴリに属しているため、既存パターンに揃える。
- Q: phase は `spec` のみでよいか？`draft` にも入れる？
  - A: `spec` のみ。
  - Basis: guardrail 原則 `draft-scope-boundary`（Draft Stays at Requirements Level）が「draft は RFP/要件レベル」と定義しているため、verifiability の厳密審査は spec phase で行うのが整合する。
- Q: guardrail id と body の文面は？
  - A: id=`req-diff-verifiability`、body は「各 REQ について、通常の unified diff と test execution summary だけで PASS/FAIL 判定可能でなければならない。将来挙動の保証、『コード変更なしで X できる』のような拡張性契約、diff 外のプロセス不変条件を要求する REQ は書き直すこと。」
  - Basis: issue #214 の proposed guardrail 文面を簡潔化。既存 guardrail の body が単文 shall 形式である命名規約に合わせた。
- Q: 既存 guardrail との重複はないか？
  - A: 重複なし。
  - Basis: `unambiguous-requirements` は語彙（vague adjectives）を扱い、`complete-context` は When/shall の構造を扱う。本 guardrail は「証拠の観測可能性」を問う新しい軸で、既存 3 軸（語彙・構造・evidence）の独立カバーになる。

## Open Questions
- なし

## User Approval
- [x] User approved this draft
- Confirmed at: 2026-04-22
- Notes: issue #214 に基づく。spec phase のみ、guardrail 1 件追加。
