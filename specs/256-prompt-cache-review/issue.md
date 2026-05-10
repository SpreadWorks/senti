## Overview

Resolve the `cacheCreation = 0` regression in review-spec / review-draft. Bundle the PromptBuilder API refactoring, fixes to review prompt construction, and adding provider information to metrics.

## Included Work

### 1. PromptBuilder API Refactoring

Align to the "set = single overwrite / add = variadic append" convention.

- `setRole(text)` / `setRules(text)` / `setJsonSchema(schema)` / `setFmtFallback(text)` — keep (single)
- `add(header, content)` → rename to **`addUserPrompt(header, content)`**
- Add new **`addSystemPrompt(header, content)`** (makes system sections other than rules addable)
- Keep header argument as required (the `## XXX` heading is a required element in all 13 call sites)

Affected scope: `src/lib/prompt-builder.js` + 13 call sites

### 2. Align review-spec to use PromptBuilder

Replace `buildSpecReviewPrompt(specText, contextEntries)` (review.js:1036-1063) with PromptBuilder, routing role/rules/format to the system side and spec/contextEntries to the user side.

Expected effect: In the 9-call example from 248-draft-review-architecture-refactor, $4.3 → $0.7 (approx. 78% reduction)

### 3. Align review-draft to use PromptBuilder

Apply the same PromptBuilder migration to `buildDraftReviewPrompt(draftJson, requestText, contextEntries)` (review.js:1177-1213).

### 4. Move testDesign to the system side in test review gap analysis / gap fix

Around review.js:935-944. testDesign is fixed within the loop, making it a candidate for the system side. Lower priority, but addressed simultaneously for structural consistency.

### 5. Record provider/profile in flow.json metrics

The discovery of "cost disappeared / cacheCreation = 0" during this investigation was coincidental. If provider names and model tags were recorded, root cause analysis would be immediate. This will also aid in future regression detection.

## Verification

Confirm that `cacheCreation > 0` is recorded in `flow.json` metrics after calling the modified review-spec / review-draft.

## Related

Investigation: board #19a8

<details>
<summary>ja</summary>

[ENHANCE] review-spec / review-draft の prompt cache 化と PromptBuilder API 改修

## 概要

review-spec / review-draft の cacheCreation = 0 退行を解消する。PromptBuilder の API 改修と review 系プロンプト構築の修正、metrics への provider 情報追加をまとめて行う。

## 含まれる作業

### 1. PromptBuilder API 改修

「set = 単一上書き / add = 可変追加」規約に揃える。

- `setRole(text)` / `setRules(text)` / `setJsonSchema(schema)` / `setFmtFallback(text)` — 残す（単一）
- `add(header, content)` → **`addUserPrompt(header, content)`** に改名
- 新規 **`addSystemPrompt(header, content)`** を追加（rules 以外の system セクションを addable にする）
- header 引数は必須として残す（全 13 箇所で `## XXX` 見出しが必須要素）

影響範囲: `src/lib/prompt-builder.js` + 呼び出し側 13 箇所

### 2. review-spec を PromptBuilder 経由に揃える

`buildSpecReviewPrompt(specText, contextEntries)` (review.js:1036-1063) を PromptBuilder に置き換え、role/rules/format を system 側、spec/contextEntries を user 側に振り分ける。

期待効果: 248-draft-review-architecture-refactor 9 コール例で \$4.3 → \$0.7（約 78% 削減）

### 3. review-draft を PromptBuilder 経由に揃える

`buildDraftReviewPrompt(draftJson, requestText, contextEntries)` (review.js:1177-1213) を同様に PromptBuilder 化。

### 4. test review の gap analysis / gap fix で testDesign を system 側に移す

review.js:935-944 周辺。testDesign は loop 内で固定なので system 化候補。優先度低いが構造統一のため同時対応。

### 5. flow.json metrics に provider/profile を記録

今回の調査で「cost 消えた / cacheCreation = 0」を発見したのは偶然だった。provider 名・model タグが残っていれば原因切り分けが即できる。今後の退行検知にも効く。

## 検証方法

修正後の review-spec / review-draft コールで `flow.json` の metrics に `cacheCreation > 0` が記録されることを確認。

## 関連

調査: board #19a8

</details>