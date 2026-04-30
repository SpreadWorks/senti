Fix structural issues in draft review.

## Problems

### 1. Choice UI still present (draft only)
- `review-draft.md` still contains `[1] Perform QA review to detect gaps [2] Skip`
- Other review prompts (review-spec, review-test, impl/review) had choices removed in spec 247
- Target: `src/flow/prompts/plan/review-draft.md`

### 2. Approval position is incorrect
- Draft approval is placed inside the draft step (`draft.md` L110-111)
- Correct placement is after review-draft (approval choice should appear after review completes)
- Target: `src/flow/prompts/plan/draft.md`, `src/flow/prompts/plan/review-draft.md`

### 3. Review loop not implemented
- Expected flow: question generation complete → review → user answers gaps → re-review → approval if no issues
- Review before question generation is unnecessary (detecting gaps with only Q and no A is possible, but one pass after questions are complete is sufficient)
- Currently review runs only once and exits on issue detection
- Target: `src/flow/prompts/plan/review-draft.md`, `src/flow/definition.js`

### 4. runCmdWithRetry misretry
- `runDraftReview` calls `process.exit(EXIT_ERROR)` when issues are detected
- `runCmdWithRetry` interprets this as a transient error and reruns the same command without changes to draft.json
- Result is identical every time, ending with a "retry limit reached" error
- Reproduced in spec 247-metrics-token-avg-row
- Target: `src/flow/lib/run-review.js` (`runCmdWithRetry`)

### 5. Raw JSON injected into draft-review.md
- Agent output streaming control messages (e.g. `{"type":"thread.started",...}`) are written to the file unparsed
- Target: `src/flow/commands/review.js` (`runDraftReview`)

## Related Files

- `src/flow/prompts/plan/review-draft.md` — choice UI, review loop instructions
- `src/flow/prompts/plan/draft.md` — approval logic (L110-111)
- `src/flow/commands/review.js` — `runDraftReview` (L1191-1250)
- `src/flow/lib/run-review.js` — `runCmdWithRetry` (L78-98), draft parser (L60-62)
- `src/flow/definition.js` — review-draft node definition (L96)

<details>
<summary>ja</summary>

draft review アーキテクチャ改修（承認位置・reviewループ・リトライ・JSON混入・選択肢廃止）

draft review の構造的問題を修正する。

## 問題点

### 1. choice UI が残存（draft のみ）
- `review-draft.md` に `[1] QA レビューを行い不足を検出する [2] しない` が残っている
- 他の review prompt（review-spec, review-test, impl/review）は spec 247 で選択肢廃止済み
- 対象: `src/flow/prompts/plan/review-draft.md`

### 2. 承認の位置が不正
- draft 承認が draft ステップ内にある（`draft.md` L110-111）
- 正しくは review-draft の後（レビュー完了後に承認選択肢を出す）
- 対象: `src/flow/prompts/plan/draft.md`, `src/flow/prompts/plan/review-draft.md`

### 3. review loop 未実装
- 期待する流れ: 設問作成完了→レビュー→ユーザーが不足を回答→再レビュー→問題なければ承認
- 設問作成前のレビューは不要（Qのみ・Aなしの状態でも不足検出は可能だが、設問完了後の1回で十分）
- 現状は review が1回きりで、issue 検出時に exit してしまう
- 対象: `src/flow/prompts/plan/review-draft.md`, `src/flow/definition.js`

### 4. runCmdWithRetry の誤リトライ
- `runDraftReview` は issue 検出時に `process.exit(EXIT_ERROR)` する
- `runCmdWithRetry` がこれを一時エラーと解釈し、draft.json 未変更のまま同じコマンドを再実行する
- 結果は毎回同一で「リトライ上限に達しました」エラーになる
- spec 247-metrics-token-avg-row で実際に発生
- 対象: `src/flow/lib/run-review.js` (`runCmdWithRetry`)

### 5. draft-review.md に生 JSON 混入
- エージェント出力のストリーミング制御メッセージ（`{"type":"thread.started",...}` 等）がパースされずそのまま書き込まれる
- 対象: `src/flow/commands/review.js` (`runDraftReview`)

## 関連ファイル

- `src/flow/prompts/plan/review-draft.md` — choice UI, review loop 指示
- `src/flow/prompts/plan/draft.md` — 承認ロジック（L110-111）
- `src/flow/commands/review.js` — `runDraftReview`（L1191-1250）
- `src/flow/lib/run-review.js` — `runCmdWithRetry`（L78-98）, draft parser（L60-62）
- `src/flow/definition.js` — review-draft ノード定義（L96）

</details>