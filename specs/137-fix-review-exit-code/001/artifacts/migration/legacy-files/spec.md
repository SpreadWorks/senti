# Feature Specification: 137-fix-review-exit-code

**Feature Branch**: `feature/137-fix-review-exit-code`
**Created**: 2026-04-04
**Status**: Draft
**Input**: GitHub Issue #82

## Goal

`runReviewLoop` が最終イテレーションで fix を実行した後に追加の detect を行い、issues が 0 件であれば PASS を返すようにする。現在のコードは最終イテレーションでは fix を実行しないため、前のイテレーションの fix が全 issues を解決していても AI の非決定的な detect 結果に依存して誤って FAIL を返す。

**Why this approach**: ループ構造を「detect → fix → detect(verification)」の形に変更し、最後の fix 後に必ず検証用の detect を実行する。これにより AI の非決定性に頼らず、fix 後の実際の状態を確認できる。

## Scope

- `src/flow/commands/review.js` — `runReviewLoop` 関数の修正
- `src/flow/lib/run-review.js` — `parseSpecReviewOutput` / `parseTestReviewOutput` の防御的修正
- `specs/136-fix-review-cmd-bugs/tests/review-bugs.test.js` の Bug #2 テストは、Requirement 3-4 のエラーメッセージ変更による影響を確認し、新メッセージでも PASS することを検証する

## Out of Scope

- `sdd-forge flow run review`（phase なし）の code review パイプライン（`runReviewLoop` を使用しない）
- `src/docs/commands/review.js`（docs review）および `src/docs/commands/forge.js`（forge review ループ）— これらは `runReviewLoop` を使用せず exit code ベースで判定するため対象外
- spec review のプリアンブル混入問題（#136 で対応予定）
- AI エージェントのプロンプト改善
- review コマンドの CLI インターフェース変更

## Clarifications (Q&A)

- Q: `runReviewLoop` のループ構造をどう変更するか？
  - A: 最終イテレーションでも fix を実行し、その後に追加の detect(verification) を 1 回実行する。この verification detect で issues が 0 件なら PASS。既存の maxRetries の意味は「detect-fix サイクルの最大回数」のまま維持する。

- Q: `parseSpecReviewOutput` / `parseTestReviewOutput` の防御的修正とは？
  - A: subprocess が exit code 1 を返したが stderr に `issues=0` / `gaps=0` がある場合、subprocess 内部で review ループ以外の要因でクラッシュした可能性がある。この場合のエラーメッセージを改善する（PASS に変更するのではなく、エラーの詳細を正確に報告する）。

- Q: 既存テストへの影響は？
  - A: `runReviewLoop` のインターフェース（引数・戻り値）は変更しない。内部のイテレーション回数が最大 1 回増える可能性があるが、外部から見た振る舞いは「FAIL だったケースが PASS になる」方向のみ。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-04
- Notes: autoApprove mode

## Requirements

1. When `runReviewLoop` の最終 detect-fix サイクルで fix が実行された場合、追加の verification detect を 1 回実行する。verification detect が issues 0 件を返したら verdict を PASS にする。
2. When `runReviewLoop` の全イテレーションで detect が issues > 0 を返し、かつ全ての fix が no-op だった場合（proposals 全却下 or invalid output）、verdict は FAIL のままとする。
3. When `parseSpecReviewOutput` が `res.ok === false` かつ stderr の `issues=0` を検出した場合、エラーメッセージに「subprocess error (not review FAIL)」の旨を含める。
4. When `parseTestReviewOutput` が `res.ok === false` かつ stderr の `gaps=0` を検出���た場合、同様にエラーメッセージを改善する。
5. `runReviewLoop` の既存インターフェース（引数の型・戻り値の型）は変更しない。

## Acceptance Criteria

- `runReviewLoop` で detect → fix → detect(verification) → 0 issues のケースが PASS を返すことをテストで確認
- `runReviewLoop` で全 fix が no-op のケースが FAIL を返すことをテストで確認
- `runReviewLoop` で最初の detect が 0 issues のケースが即座に PASS を返すことをテストで確認（既存動作の回帰テスト）
- `parseSpecReviewOutput` が exit 1 + issues=0 のケースで適切なエラーメッセージを返すことをテストで確認
- 既存の review 関連テストが全て PASS すること（`specs/136-fix-review-cmd-bugs/tests/review-bugs.test.js` の Bug #2 テストを含む）

## Test Strategy

- `runReviewLoop` のユニットテスト: detect/fix を mock して各シナリオを網羅
- `parseSpecReviewOutput` / `parseTestReviewOutput` のユニットテスト: exit code と stderr の組み合わせパターン
- テスト配置: spec verification tests（`specs/137-fix-review-exit-code/tests/`）+ formal tests（`tests/`）

## Open Questions

None.

## Resource Limits

- verification detect は最大 1 回のみ追加される（ループ終了時に FAIL の場合のみ）。
- AI エージェント呼び出しの合計回数は最大 `maxRetries + 1` 回の detect + `maxRetries` 回の fix = `2 * maxRetries + 1` 回。現在の `MAX_REVIEW_RETRIES=3` で最大 7 回。
- `RunReviewCommand` の既存タイムアウト（300秒）は維持する。1 回の AI 呼び出しが約 30-60 秒として、7 回でも 210-420 秒。300 秒を超える場合は既存のタイムアウトエラーで安全に停止する。本 spec ではタイムアウト値の変更は行わない。
