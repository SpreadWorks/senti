# Draft: improve-draft-template

**開発種別:** feature
**目的:** draft.md に skeleton テンプレートと構造的検証を導入し、gate-draft で繰り返される reject（mandatory section 欠落、Impact on Existing Features の記述不足、開発種別/目的の書式不明）を削減する。

## Scope Verification

- In scope:
  - `run-prepare-spec.js` に `draft.md` skeleton の生成を追加（既存の spec.md / qa.md と並列）
  - skeleton に以下を含める: 開発種別 / 目的 / Scope Verification / Impact on Existing Features / Q&A / Open Questions / User Approval
  - `checkDraftText()` に以下の機械検証を追加: `## Scope Verification` と `## Impact on Existing Features` セクションの存在、開発種別の enum 値検証
  - 開発種別の enum: `feature` / `bugfix` / `refactor` / `docs` / `chore` / `test` / `other`
  - `src/flow/prompts/plan/draft.md`（draft 段階のプロンプト）を新 skeleton 前提に更新
  - dead code 削除: `DEFAULT_SPEC_TEMPLATE`, `createSpecTemplate()`, spec.md 向け `loadLocalTemplate` 分岐
  - `checkDraftText` の unit test 追加

- Out of scope:
  - spec.md 側の template・gate 変更（`renderSpecMarkdown` は既に mandatory sections を出力しており修正不要）
  - 既存 spec 配下にある過去の draft.md の書き換え・移行（alpha 期間のため backward compat は不要）
  - guardrail.json の `impact-on-existing-features` 定義変更（既存で draft+spec phase に適用されており十分）
  - `.sdd-forge/templates/<lang>/specs/` のローカル override サポート追加

## Impact on Existing Features

- 影響ありの既存機能:
  - `sdd-forge flow prepare` 実行時、`draft.md` が自動生成されるようになる（従来は AI が prompt 指示のみで作成）。既存 spec の生成には影響しない（新規作成分のみ）
  - `sdd-forge flow run gate --phase draft` の判定ロジックが強化される。新しい section / enum の欠落・不一致は FAIL となる
  - `src/flow/prompts/plan/draft.md`（draft prompt）の指示内容が変わる。AI は新 skeleton を前提に書くよう誘導される

- 影響なし:
  - spec.md の生成・検証パイプライン
  - qa.md の生成
  - task-level gate / impl gate / integration gate
  - CLI の外部インターフェース（コマンド名・フラグは変更なし）

## Q&A

- Q1: issue #206 の 3 統合対象をそのまま引き受けてよいか（mandatory sections / Impact 明記 / field format）
  - A1: issue #1（spec.md の mandatory sections）は `renderSpecMarkdown` で既に解消済みと判明。issue #2（Impact 明記）と issue #3（field format）を draft.md 側で解決する方針で合意。加えて既存の dead code（`DEFAULT_SPEC_TEMPLATE`）を本 spec で削除する

- Q2: `Scope Verification` と `Impact on Existing Features` のセクション構造
  - A2: A案（独立した 2 セクション）を採用。gate の機械チェックは両方の `##` header の存在を検証する。1 セクション統合（B案）は書き漏らしの検出ができないため却下

- Q3: 開発種別フィールドの検証レベル
  - A3: enum 厳格化（案Y）。checkDraftText で値を enum メンバーか検証し、違反時は `invalid development type "<value>" (expected one of: <enum>)` で FAIL

- Q4: enum 値のセット
  - A4: `feature` / `bugfix` / `refactor` / `docs` / `chore` / `test` / `other`。Conventional Commits に近いが `build` / `perf` は省き、代わりに `other` をエスケープハッチとして置く。値は英語小文字で固定（ラベルは日本語/英語どちらでも可）

- Q5: 残スコープ確認
  - A5: 承認。`buildDraftTemplate()` パターンで skeleton を inline 定義、prompt 更新、dead code 削除、unit test 追加

## Open Questions

- draft skeleton を `.sdd-forge/templates/<lang>/specs/draft.md` として local override 可能にするかは、別 spec で検討（現状は inline 定数で十分）

## User Approval

- [x] User approved this draft
- Confirmed at: 2026-04-21
- Notes: auto mode + interactive Q&A 5 ラウンドで合意。A案（分離セクション）+ 案Y（enum 厳格）+ 案Q+other（7 値 enum）
