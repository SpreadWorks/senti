## Background
Currently `createPlanReviewNode` has a fixed `maxAttempts: 3`. In auto mode, the AI that wrote the draft itself receives feedback from the review agent and self-corrects in a loop, but there is a structural limitation where the loop never converges — the same AI that missed something will miss it at the same blind spot no matter how many iterations. In manual mode, the user makes a judgment call each round, so having 3–5 attempts provides more flexibility.

## Proposal
Allow `FlowNode.maxAttempts` to accept `{auto:N, manual:N}` format in addition to scalar values, and switch only review-type nodes to mode-specific settings.

### Changes
- `src/flow/definition.js`
  - Normalize `FlowNode.maxAttempts` from number → `{auto, manual}` (backward compatible: a plain number expands to `{auto:N, manual:N}`)
  - Change `createPlanReviewNode` to `maxAttempts: { auto: 1, manual: 5 }`
  - Add `autoApprove` argument to `deriveNextAction(scope, stepId, opts)` for mode resolution
- `src/flow/get/next-action.js` — envelope builder passes `flow.autoApprove` to `deriveNextAction`
- `src/flow/commands/review.js:57` — refactor to `getReviewMaxAttempts(phase, autoApprove)`
- `src/flow/lib/run-gate.js:812` — add mode resolution logic (gate nodes stay as-is, but handle for API consistency)
- Review prompts: `review-draft.md`, `review-spec.md`, `review-test.md` require no changes (resolved numeric values are injected into the envelope)
- Tests: add unit tests for maxAttempts resolution

### Recommended Initial Values
| Node | manual | auto |
|---|---|---|
| review-draft | 5 | 1 |
| review-spec | 5 | 1 |
| review-test | 3 | 1 |
| gate nodes | unchanged | unchanged (no mode difference) |

### Design Points (to be finalized in spec)
1. Value format: Is `{auto:N, manual:N}` acceptable?
2. Is limiting mode-specific settings to review nodes appropriate? (Applying to all nodes would be over-engineering.)
3. Backward compatibility: maintain automatic expansion of plain number format.

## Related
- review-draft.md:8-10 loop specification
- definition.js:53-63 `createPlanReviewNode`
- definition.js:380-396 `deriveNextAction`

<details>
<summary>ja</summary>

[ENHANCE] review ノードの maxAttempts を auto/manual モード別に設定可能にする

## 背景
現状 `createPlanReviewNode` は `maxAttempts: 3` 固定。auto モードでは draft を書いた AI 自身が review エージェントの指摘を受けて自問自答で修正するため、ループしても収束しない構造的限界がある（同じ AI が見落としたものは何度回しても同じ盲点で見落とす）。一方、手動モードではユーザーが各ラウンド判断するので 3〜5 回の余裕があった方がよい。

## 提案
`FlowNode.maxAttempts` をスカラーに加え `{auto:N, manual:N}` 形式も許容し、review 系ノードのみ mode 別設定に切り替える。

### 変更点
- `src/flow/definition.js`
  - `FlowNode.maxAttempts` を number → `{auto, manual}` に正規化（後方互換: number は `{auto:N, manual:N}` に展開）
  - `createPlanReviewNode` を `maxAttempts: { auto: 1, manual: 5 }` に
  - `deriveNextAction(scope, stepId, opts)` に `autoApprove` 引数を追加し mode 解決
- `src/flow/get/next-action.js` envelope ビルダーで `flow.autoApprove` を `deriveNextAction` に渡す
- `src/flow/commands/review.js:57` `getReviewMaxAttempts(phase, autoApprove)` 化
- `src/flow/lib/run-gate.js:812` mode 解決ロジック追加（gate 系は据え置き予定だが API 整合のため対応）
- review 系プロンプト: `review-draft.md`, `review-spec.md`, `review-test.md` の表記は変更不要（envelope に解決済み数値が入る）
- テスト: maxAttempts 解決の単体テスト追加

### 推奨初期値
| ノード | manual | auto |
|---|---|---|
| review-draft | 5 | 1 |
| review-spec | 5 | 1 |
| review-test | 3 | 1 |
| gate 系 | 据え置き | 据え置き（mode 差なし） |

### 設計論点（spec 段階で確定すべき）
1. 値の形式: `{auto:N, manual:N}` でよいか
2. review 系のみ mode 別にする方針でよいか（全ノード対応は過剰設計）
3. 後方互換（number 形式の自動展開）の維持

## 関連
- review-draft.md:8-10 のループ仕様
- definition.js:53-63 createPlanReviewNode
- definition.js:380-396 deriveNextAction

</details>