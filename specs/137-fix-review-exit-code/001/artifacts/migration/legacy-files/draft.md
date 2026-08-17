# Draft: Fix spec review exit code inconsistency (#82)

**開発種別:** バグ修正

**目的:** `spec review` および `test review` が、review ループ内で issues/gaps を 0 件に解決した場合に正しく PASS を返すようにする。

## Issue Summary

**GitHub Issue**: #82 — `spec review` returns exit code 1 despite 0 issues remaining

spec review (and potentially test review) が、review ループ内で issues を修正して 0 件にしたにもかかわらず、FAIL (exit code 1) を返すことがある。spec #135 フロー中に検出。

## Goal & Scope

### Goal
`runReviewLoop` が issues/gaps を 0 件に解決した場合に、正しく PASS を返すようにする。

### Scope
- `src/flow/lib/run-review.js` — `parseSpecReviewOutput`, `parseTestReviewOutput`
- `src/flow/commands/review.js` — `runReviewLoop`

### Root Cause Analysis

`runReviewLoop` の構造:
```
attempt 0: detect → issues found → fix
attempt 1: detect → issues found → fix
attempt 2: detect → issues found → (NO fix, last attempt)
→ finalIssues = last detect result → FAIL
```

最終イテレーションでは `attempt < maxRetries - 1` が false のため fix が実行されない。これ自体は意図的だが、以下のシナリオで問題が発生する:

1. **attempt 1 の fix が全 issues を解決** → spec.md は clean
2. **attempt 2 の detect で AI が誤検出** → issues > 0 と判定
3. → FAIL (spec.md 自体は正しいが、AI の非決定性により FAIL)

さらに、`parseSpecReviewOutput` / `parseTestReviewOutput` は subprocess の exit code のみで PASS/FAIL を判定する。stderr に `issues=0` があっても exit code が 1 なら FAIL として Error を throw する。

## Impact on Existing

- `sdd-forge flow run review --phase spec` — spec review パイプライン
- `sdd-forge flow run review --phase test` — test review パイプライン
- `sdd-forge flow run review` (no phase) — code review は `runReviewLoop` を使わないため影響なし
- SDD flow skill — review ステップの成功判定が正確になる

## Constraints

- `runReviewLoop` は spec review と test review の共通関数。変更は両方に影響する。
- AI エージェント呼び出し回数が増える変更は最小限にする（コスト・時間）
- 外部依存禁止、Node.js 組み込みモジュールのみ
- テストを通すためにテストコードを修正してはならない

## Edge Cases

1. **全 retry で fix が失敗**（proposals 全却下 or invalid output）→ FAIL のまま正しい
2. **detect が一貫して同じ issues を返す**（fix が効かない）→ FAIL のまま正しい
3. **最後の fix 後に真の issues が残る** → 最終 detect で正しく検出されれば FAIL
4. **subprocess が review ループ以外の理由でクラッシュ** → Error throw のまま正しい

## Test Strategy

- `runReviewLoop` のユニットテスト（mock detect/fix で各シナリオ検証）
- `parseSpecReviewOutput` / `parseTestReviewOutput` のユニットテスト
- 既存テスト（review 関連）の確認

## Q&A

### Q1: バグの再現条件は？
A: `runReviewLoop` で最終イテレーション（attempt = maxRetries - 1）の detect が issues > 0 を返した場合。fix が前のイテレーションで全 issues を解決済みでも、AI の非決定性で detect が issues を報告すると FAIL になる。

### Q2: 修正のスコープは？
A: `src/flow/commands/review.js` の `runReviewLoop` 関数と、`src/flow/lib/run-review.js` の `parseSpecReviewOutput` / `parseTestReviewOutput` 関数。

### Q3: 既存の review（code review）への影響は？
A: `sdd-forge flow run review`（phase なし）は `runReviewLoop` を使わないため影響なし。

- [x] User approved this draft (autoApprove)
