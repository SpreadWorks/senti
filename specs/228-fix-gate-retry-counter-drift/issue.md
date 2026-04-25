## Symptoms

During auto mode execution of spec 221, the gate-impl retry counter reached 3/3 earlier than expected, and attempt 3 was immediately rejected by the CLI with `ESCALATE_RETRY_EXHAUSTED` without reaching AI evaluation. Actual AI evaluation FAILs occurred only twice, at attempts 1 and 2.

## Reproduction

- attempt 1: FAIL by AI evaluation (insufficient test-summary shape)
- Between attempt 1 → 2: recorded `flow set issue-log --reason "fix: ..."` once
- attempt 2: FAIL by AI evaluation (3 articles: silent-error / exit-code / sync-io)
- Between attempt 2 → 3: recorded `flow set issue-log --reason "fix: ..."` once
- attempt 3: rejected before AI invocation with `gate retry: 3/3 used (0 remaining)`

## Suspected Causes

- Hypothesis A: The `flow set issue-log --reason "fix:..."` entries recorded manually may be counted as "FAIL attempts"
- Hypothesis B: The no-progress check of `assertNoRepeatedFail` from spec 212 may have consumed attempt 3
- In either case, the counter increment timing deviates from the behavior implied by the skill instructions documentation (`config.flow.retry.max` default 3)

## Impact

- Structural risk of losing one fix opportunity during auto mode
- Users misjudge the expected attempt count and don't notice until the retry limit is reached
- The existing `5b0e` (Issue #208, Done) added a CLI reset feature, but this issue is a separate problem: "exhaustion occurring in situations where reset should not be needed"

## Differences from Similar Existing Issues

- `5b0e` (Done): Added reset feature after retry exhaustion (used manually this time)
- `6e12` (Ideas): Consolidating retry limits into blueprint (about consolidation, not increment timing)

This issue is specific to **counter increment timing/visibility**.

## Proposed Actions

- Display counter breakdown on each `flow run gate` execution ("Used: AI-FAIL=2, no-progress=1, manual-reset=0")
- Ensure `flow set issue-log` recording does not increment the counter (if it currently does)
- Display a message when pre-rejection mechanisms such as `assertNoRepeatedFail` consume the counter

## Source

Observed in gate-impl of flow 221 (fix-gate-impl-untracked-diff). Relevant entries exist in the issue-log.

<details>
<summary>ja</summary>

[BUG] gate retry counter が直感と異なるタイミングで消費され auto モード中に黙って枯渇する

## 症状

spec 221 の auto モード実行中、gate-impl の retry counter が想定より早く 3/3 に到達し、attempt 3 では AI 評価に到達せず CLI 側で即座に `ESCALATE_RETRY_EXHAUSTED` で拒否された。実際の AI 評価による FAIL は attempt 1, 2 の 2回のみ。

## 再現状況

- attempt 1: AI 評価で FAIL (test-summary shape 不足)
- attempt 1 → 2 の間に `flow set issue-log --reason "fix: ..."` を 1 回記録
- attempt 2: AI 評価で FAIL (silent-error / exit-code / sync-io の 3 articles)
- attempt 2 → 3 の間に `flow set issue-log --reason "fix: ..."` を 1 回記録
- attempt 3: `gate retry: 3/3 used (0 remaining)` で AI 呼び出し前に拒否

## 推測される原因

- 仮説 A: 自分が記録した `flow set issue-log --reason "fix:..."` エントリが「FAIL attempt」として数えられている可能性
- 仮説 B: spec 212 の `assertNoRepeatedFail` 系の no-progress 判定が attempt 3 を消費した可能性
- いずれの仮説にせよ counter の増分タイミングが skill instructions のドキュメント (`config.flow.retry.max` default 3) から読み取れる挙動と乖離している

## 影響

- auto モード中に修正の機会を 1 回失う構造的リスク
- ユーザーは attempt 数の見積もりを誤り、retry 上限到達まで気づかない
- 既存の `5b0e` (Issue #208, Done) で CLI reset 機能はあるが、本件は「reset 不要なはずの場面で枯渇する」という別問題

## 既存類似 issue との差異

- `5b0e` (Done): retry 枯渇後の reset 機能追加 (今回手動で活用)
- `6e12` (Ideas): retry 上限を blueprint に集約 (集約の話で増分タイミングは対象外)

本件は **counter 増分のタイミング/可視性** に固有。

## 対応案

- 各 `flow run gate` 実行時に counter 内訳を表示 ("Used: AI-FAIL=2, no-progress=1, manual-reset=0")
- `flow set issue-log` 記録は counter 増分しないことを保証 (もし増分しているなら)
- `assertNoRepeatedFail` 等の事前拒否メカニズムが counter を消費する場合はその旨を表示

## 出典

flow 221 (fix-gate-impl-untracked-diff) の gate-impl 実測。issue-log に該当エントリあり。

</details>