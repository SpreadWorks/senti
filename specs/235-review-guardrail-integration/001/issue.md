## Overview

The review command (`src/flow/commands/review.js`) does not read `guardrail.json` at all. It reviews using only the 5 items hardcoded in `buildDraftSystemPrompt`.

Guardrails with `phase: "review"` already exist in nextjs (3 entries) and symfony (8 entries), but they are not wired up and therefore never evaluated. An implementation is needed to inject guardrails filtered by `filterByPhase("review")` into the review prompt.

Additionally, `bounded-resource-usage` has been moved from `task-impl` to `review` (0% legitimacy rate, all 5 cases were false positives). Once the review command can read this guardrail, it will be evaluated as a suggestion rather than a blocker.

## Related Changes (already applied)

- `bounded-resource-usage`: phase changed from `["spec", "task-impl"]` to `["spec", "review"]`
- `exit-code-contract`: added `spec` to phase, rewrote body to cover both spec and impl
- `validate-user-input-at-entry-point`: added `spec` to phase, rewrote body to cover both spec and impl

<details>
<summary>ja</summary>

[ENHANCE] review コマンドの guardrail 対応

## 概要

review コマンド（src/flow/commands/review.js）は guardrail.json を一切読んでいない。buildDraftSystemPrompt にハードコードされた 5 項目のみでレビューしている。

`phase: "review"` を指定した guardrail は nextjs（3件）と symfony（8件）に既に存在するが、配線されていないため評価されていない。filterByPhase("review") した guardrail を review プロンプトに注入する実装が必要。

加えて `bounded-resource-usage` を `task-impl` から `review` に移管済み（正当率 0%、5 件全て false positive）。review コマンドがこの guardrail を読めるようになることで、ブロッキングではなく指摘ベースで評価される。

## 関連変更（実施済み）

- `bounded-resource-usage`: phase を `["spec", "task-impl"]` → `["spec", "review"]` に変更
- `exit-code-contract`: phase に `spec` を追加、body を spec/impl 両対応に書き換え
- `validate-user-input-at-entry-point`: phase に `spec` を追加、body を spec/impl 両対応に書き換え

</details>