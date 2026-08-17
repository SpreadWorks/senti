# Draft: 224-fix-gate-retry-history-filter

**開発種別:** bugfix
**目的:** gate が retry 予算切れ escalation を返すとき、`Previous FAIL reasons` に escalating phase 自身の FAIL 履歴のみが表示されるようにする。現状は別 phase の履歴が混入しデバッグを妨げる。

## Requirements（優先順位付き）

- **R1 (最優先)**: When gate escalation が task-impl / integration phase で retry 予算切れにより発生したとき、`Previous FAIL reasons` は escalating phase と同じ phase の FAIL 履歴のみを含むものとする（他 phase の履歴は含めない）。
  - 根拠: Issue #248 の中核症状。現状の filter は step のみで絞っており、draft phase の履歴が task-impl escalation に混入する。
- **R2**: When 履歴エントリが retry 予算切れ escalation 自身の自己記録（`Previous FAIL reasons` を含むエントリ）であるとき、そのエントリは `Previous FAIL reasons` に含めないものとする。
  - 根拠: 自己参照的であり、FAIL 理由の情報価値を持たないため。プロジェクト `CLAUDE.md` の「過剰な防御コードを書かない／内部インターフェースは信頼」方針に従い、意味のある情報のみを表示する。
- **R3**: When 履歴エントリに phase 情報が欠落しているとき、そのエントリは履歴から除外されてよい。
  - 根拠: プロジェクト `CLAUDE.md` の「alpha 版ポリシー: 後方互換コードは書かない」に従う。新規エントリは必ず phase を記録する。
- **R4**: 本変更は retry 予算カウンタの増減・reset・threshold 判定挙動を変更してはならない。変更は escalation メッセージの表示内容のみに限定する。
  - 根拠: Issue 記述「retry 予算の仕組み自体は正常」。scope を最小化するためのガードレール。

## Scope Verification
- In scope:
  - gate escalation 時の `Previous FAIL reasons` 絞り込みロジック
  - escalation 自己記録エントリの除外
  - 回帰テスト（step と phase の組み合わせで正しく絞り込めることの検証）
- Out of scope:
  - retry counter（`gateRetry` metric）の増減ロジック
  - phase 情報欠落の古いエントリの救済・マイグレーション
  - `checkNoProgressSinceLastFail` など別経路の escalation（本件と独立したバグ経路のため）

## Impact on Existing Features
- 影響ありの既存機能:
  - retry 予算切れ escalation メッセージ: task-impl / integration phase でのみ表示内容が改善される（正しい phase の履歴のみ表示）
- 影響なし:
  - retry 予算カウンタの増減動作
  - issue-log への書き込み動作（新規エントリのフォーマット・内容）
  - draft / spec / task-spec phase の gate 挙動（retry-tracked phase でないため escalation 経路を通らない）

## Q&A
- Q1: 本件の目的・対象・範囲の理解で draft を開始してよいか
  - A: [1] はい
  - 根拠: Issue #248 の本文がバグ症状・再現手順・原因・修正方針を明記している
- Q2: retry 予算切れ escalation 自体の自己記録エントリを `Previous FAIL reasons` に含めるか
  - A: [1] 除外する
  - 根拠: 自己参照的な通知であり FAIL 理由としての情報価値を持たない。プロジェクトの「シンプルなインターフェースに十分な実装を隠す」方針（CLAUDE.md）に従い、ノイズを表示しない
- Q3: phase 情報が欠落した過去エントリの扱い
  - A: [1] 無視する
  - 根拠: CLAUDE.md の「alpha 版ポリシー: 後方互換コードは書かない／旧フォーマット・非推奨パスは保持せず削除する」
- Q4: テスト戦略（何をどう検証するか）
  - A: 履歴絞り込みの挙動を unit test で回帰検証する。step × phase の組み合わせと escalation 自己記録の除外を確認する
  - 根拠: 既存 `tests/unit/flow/gate-envelope-issue-log.test.js` が `checkRetryBelowMax` の同系統挙動を unit test で検証しており、パターンを踏襲できる

## Open Questions
- 特になし

## User Approval
- [x] User approved this draft
- Confirmed at: 2026-04-23
- Notes: Issue #248 のバグ内容と修正案を R1-R4 の要件として再整理。escalation 自己記録除外 (R2) と phase 欠落無視 (R3) を明記、retry 予算機構への無影響 (R4) をガードレール化。
