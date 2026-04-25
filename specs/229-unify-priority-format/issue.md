## Symptom

Two different priority notations coexist in the spec creation flow, requiring manual conversion every time.

- **draft.md / spec.md**: P + number format like `**(P1)**` / `**(P2)**` (required by gate-draft's `prioritize-requirements` guardrail)
- **spec.json**: enum of `priority: "must" | "should" | "nice-to-have"` (required by schema validation)

Both must be written by hand to match, making it easy to hit a schema validation FAIL by writing `"priority": "P1"` in the initial spec.json (actually occurred in spec 221).

## Root Cause

- The gate-draft prompt and spec.json schema adopt different priority representations without being unified
- The error pattern of transcribing P1/P2 from draft directly into spec.json remains, though it can be avoided by referencing existing specs (e.g., spec 220) that use must/should/nice-to-have

## Impact

- spec gate FAILs on schema validation → 1 retry consumed
- It is ambiguous in documentation which is correct: "P1" or "must" (both coexist in the implementation)
- AI is prone to mistakes when generating spec.json (occurred in spec 221)

## Proposed Solutions

- A: Unify to one notation (e.g., deprecate P1/P2 and use only must/should/nice-to-have)
- B: Auto-normalize `P1 → must`, `P2 → should`, `P3 → nice-to-have` at the `spec render` / `spec gate` stage
- C: Update gate-draft guardrail wording to use `must / should / nice-to-have` notation so both sides match from the start
- D: Relax the spec.json schema's priority enum to also accept P1/P2/P3

## Difference from Existing Similar Issues

- `4b8e` (Done, Issue #181): Introduction of spec.json schema itself (resolving the dual standard in this issue was out of scope)
- `817b` (Ideas): Introduction of REQ classification tags (a different axis, such as verifiable-from-diff)

This issue is specific to **unifying priority notation**.

## Source

flow 221 (fix-gate-impl-untracked-diff) gate (spec) schema validation FAIL → fixed and re-PASSed.

<details>
<summary>ja</summary>

[ENHANCE] spec の priority フォーマット二重基準 (draft の P1/P2 vs spec.json の must/should) を解消する

## 症状

spec 作成フローで priority の表記が 2 種類混在し、毎回手動で変換が必要になる。

- **draft.md / spec.md**: `**(P1)**` / `**(P2)**` のような P + 数字形式 (gate-draft の `prioritize-requirements` ガードレールが要求)
- **spec.json**: `priority: "must" | "should" | "nice-to-have"` の enum (schema validation が要求)

両方を手書きで合わせる必要があり、初回 spec.json 作成時に `"priority": "P1"` を書いて schema validation FAIL するパターンが起きやすい (spec 221 で実際に発生)。

## 原因

- gate-draft 側の prompt と spec.json schema が異なる priority 表現を採用したまま統一されていない
- 既存 spec (例: spec 220) が must/should/nice-to-have で書かれているのを参照すれば回避可能だが、新規ユーザー / AI が draft の P1/P2 をそのまま spec.json に転記するエラーパターンが残る

## 影響

- spec gate が schema validation で FAIL する → 1 retry 消費
- 「P1」「must」のどちらが正なのかドキュメント上で曖昧 (実装上は両方が共存)
- AI が spec.json を生成する際にミスしやすい (本件 spec 221 で発生)

## 対応案

- A: どちらか一方に統一 (例: P1/P2 を廃止し must/should/nice-to-have のみに)
- B: `spec render` / `spec gate` 段階で `P1 → must`, `P2 → should`, `P3 → nice-to-have` の自動正規化
- C: gate-draft のガードレール文言を `must / should / nice-to-have` 表記に統一し、初めから両者一致させる
- D: spec.json schema の priority enum を緩めて P1/P2/P3 も受理する

## 既存類似 issue との差異

- `4b8e` (Done, Issue #181): spec.json schema 導入そのもの (本件の二重基準解消は対象外)
- `817b` (Ideas): REQ 分類タグ導入 (verifiable-from-diff など別軸)

本件は **priority 表記の単一化** に固有。

## 出典

flow 221 (fix-gate-impl-untracked-diff) gate (spec) で schema validation FAIL → 修正で再 PASS。

</details>