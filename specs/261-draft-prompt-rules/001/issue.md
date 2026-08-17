## Background

`src/flow/prompts/plan/draft.md` (QA authoring prompt) and `buildDraftReviewPrompt` in `src/flow/commands/review.js` (review prompt) are managing the same category of rules in duplicate. A cross-reference audit identified 5 discrepancies:

1. The `qa[].considered` field is not passed to the review input (required by the schema, yet excluded from review evaluation)
2. Of the 8 Requirements category checklist items, review explicitly covers only 1–2. Test strategy / Alternatives / Future extensibility / Consumer contracts are structurally unchecked
3. Direction mismatch: draft.md says "stay at requirements level" while review says "flag shallow entries". Because spec 254 removed draft-scope-boundary from gate evaluation and moved it into the creation-time prompt, the reviewer has no path to reference that rule at all. The structural dual-maintenance problem is now more pronounced.
4. The `draft.md` "Research → self-verification" MUST has no corresponding axis in review
5. autoApprove mode differences are not reflected on the review side

Additionally, within `draft.md` itself, the 8-item checklist is defined twice — once in the autoApprove branch (around L66–72) and once in the non-autoApprove branch (around L88–95) — because the "Draft scope boundary" text added in spec 254 at L1 shifted the original line numbers.

## Goal

Consolidate the declarative QA rules (schema definition, checklist, field-level boundary, principles) into a single partial so that both the authoring side (`draft.md`) and the reviewer side (`buildDraftReviewPrompt`) reference the same single source of truth.

## Acceptance Criteria

- [ ] `src/flow/prompts/partials/draft-qa-rules.md` exists and describes the QA schema/checklist/boundary/principles in declarative form
- [ ] `getStepInstructions` resolves `` directives (reusing `resolveIncludes` already used in skills.js)
- [ ] `draft.md` replaces the rule sections with partial references, retaining only authoring-specific controls (Choice Format, autoApprove branching, flow get commands, etc.)
- [ ] `buildDraftReviewPrompt` loads the same partial and wraps it in a reviewer-context wrapper
- [ ] `buildDraftReviewPrompt` includes the `considered` field when formatting QA entries
- [ ] Existing review output format (numbered list, `### N. <title>`, `**QA:** Q<N>`, `**Issue:**`, `**Suggestion:**`, `NO_PROPOSALS` marker) remains unchanged
- [ ] Tests: unit test for include resolution, structural tests that both prompts contain partial content, `considered` output test

## Files to Change

### New

`src/flow/prompts/partials/draft-qa-rules.md` — shared rule declarations

### Modified

| File | Change |
|---|---|
| `src/flow/lib/get-step-instructions.js` | Apply `resolveIncludes` to the content loaded by `getStepInstructions`. Pass `baseDir = path.dirname(filePath)` and `pkgDir = PKG_DIR` |
| `src/flow/prompts/plan/draft.md` | Replace the Draft scope boundary text (L1) added in spec 254, schema definition, Premise validation, Research/self-verification, and the duplicated Requirements checklist (autoApprove / non-autoApprove branches) with a partial reference |
| `src/flow/commands/review.js` | Rebase `buildDraftReviewPrompt` on partial loading. Add `considered` to qaText formatting. Replace the old `Focus on:` text with the declarative rules from the partial |

## Include Resolution Strategy

Include paths in flow prompts use the `/flow/prompts/partials/<name>.md` form (absolute path relative to pkgDir). This path form is already handled by the existing resolution rule in `src/lib/include.js` (`startsWith("/")` → pkgDir-relative).

Wiring example for `getStepInstructions`:

```js
import { resolveIncludes } from "../../lib/include.js";
import { PKG_DIR } from "../../lib/cli.js";

export function getStepInstructions(instructionsKey) {
  // ... existing validation ...
  const filePath = resolveKeyPath(instructionsKey);
  const content = readFileSync(filePath, "utf8");
  return resolveIncludes(content, {
    baseDir: path.dirname(filePath),
    pkgDir: PKG_DIR,
    sourceFile: filePath,
  });
}
```

Wiring for `buildDraftReviewPrompt` (single usage site, so inline read is sufficient):

```js
import { PKG_DIR } from "../../lib/cli.js";
const partialPath = path.join(PKG_DIR, "flow/prompts/partials/draft-qa-rules.md");
const rules = fs.readFileSync(partialPath, "utf8");
```

## Proposed Partial Content (`draft-qa-rules.md`)

Uses subject-omitted MUST form so it works declaratively for both authoring and review contexts.

**Important**: Must align with the policy finalized in spec 254 (draft-scope-boundary content moved to creation-time instructions; code references permitted in all fields: `evidence`/`why`/`considered`/`answer`). The original proposal's "answer field MUST NOT contain function names" contradicts the spec 254 implementation and is not adopted.

```md
## Draft QA Rules

### QA entry schema

Each entry in `draft.json.qa[]` MUST have the following fields:

- `question` — the question asked, written at requirements level
- `answer` — the decision or recommendation. MUST stay at requirements level (what & why), not implementation level (how)
- `evidence` — code reference, grep result, or doc citation supporting the answer
- `why` — rationale for the decision
- `considered` — alternative approaches evaluated and rejected

### Field-level boundary (MUST) — spec 254 finalized policy

Draft is RFP/requirements level only. Mentioning file paths or function names as context is permitted in any field. Do not describe internal algorithms, data structures, control flow, or API design as the substance of the answer.

Code references within the `evidence`, `why`, `considered`, and `answer` fields of QA entries are permitted as justification and do not constitute implementation details. The boundary is about *substance* (requirements vs. implementation policy) rather than *field whitelisting*.

### Requirements category checklist (8 items)

Every draft MUST internally check coverage across these 8 categories. Missing categories MUST be flagged:

1. Goal & Scope — Is the goal clear? Is scope bounded?
2. Impact on existing — What existing features/code/tests are affected?
3. Constraints — Non-functional requirements, guardrails, project rules?
4. Edge cases — Boundary conditions, error cases?
5. Test strategy — What to test and how?
6. Alternatives considered — What other approaches were evaluated? Why was this one chosen?
7. Future extensibility — How does this change affect future modifications or extensions?
8. Consumer contracts — Are there rules that consumers of the introduced interfaces or data structures must follow?

### Premise validation (MUST)

Each QA entry's `question` MUST be based on facts gathered from source code, docs, or prior specs — not on assumption. If the answer can be determined directly from research, state it directly rather than asking. The `evidence` field MUST cite the source consulted.

### Decision entry rule

A "decision" entry — one with non-empty `why` or `considered` — MUST have a non-empty `evidence`. Decisions without evidence are rejected at gate-draft (this is enforced by `checkDraftJson` in `src/flow/lib/run-gate.js`).

### Coverage rule

The QA set MUST address every concern mentioned in the linked request/issue. Concerns not addressed by any QA entry are missing coverage.
```

## `draft.md` Wrapper

Insert authoring context before and after the partial reference. Replace the Draft scope boundary text added in spec 254, the schema definition, Premise validation, Research/self-verification, and the two duplicate Requirements checklist blocks with a partial reference:

```md
**Apply the rules below when authoring each QA entry.**

[Retained: Draft artifact format (note that draft.json is auto-generated as a file), autoApprove flow control, Choice Format MUST, ONE question at a time, flow get command invocations, metric settings, On complete handler]
```

## Review Prompt Wrapper

`buildDraftReviewPrompt` return value:

```js
return [
  "You are a draft QA quality reviewer.",
  "",
  "Evaluate the draft against the rules below. Flag any QA entry that violates them.",
  "",
  rules,  // partial content
  "",
  "Output a numbered list of issues in this format:",
  "### 1. <title>",
  "**QA:** Q<N> (the QA entry number, or 'NEW' for missing coverage)",
  "**Issue:** <which rule is violated and how>",
  "**Suggestion:** <concrete improvement to the QA entry>",
  "",
  "If no issues are found, output: NO_PROPOSALS",
  "",
  "## Request / Issue",
  requestText || "(no request text)",
  "",
  "## Draft QA Entries",
  qaText,  // updated format including considered
  "",
  "## Codebase Context (related files)",
  "The files below are ordered by relevance to the spec.",
  contextText,
].join("\n");
```

QA entry formatting (currently in `src/flow/commands/review.js`):

```js
const qaText = Array.isArray(draftJson?.qa)
  ? draftJson.qa.map((q, i) =>
    `### Q${i + 1}: ${q.question}\n` +
    `**Answer:** ${q.answer}\n` +
    `**Evidence:** ${q.evidence || "(none)"}\n` +
    `**Why:** ${q.why || "(none)"}\n` +
    `**Considered:** ${q.considered || "(none)"}`
  ).join("\n\n")
  : "(no QA entries)";
```

## Tests

### New

- `tests/unit/flow/get-step-instructions-include.test.js`
  - `getStepInstructions` resolves `` and returns a string containing the partial content
  - Throws when a partial does not exist (error message includes the include path)

- `tests/unit/flow/draft-prompts-shared.test.js`
  - Return value of `getStepInstructions("plan.draft")` contains a marker string from the partial (e.g., `"Field-level boundary"`)
  - Return value of `buildDraftReviewPrompt(draftJson, requestText, [])` contains the same marker string
  - Both outputs contain all 8 items of the "Requirements category checklist"

- `tests/unit/flow/draft-review-considered.test.js`
  - The qaText section of `buildDraftReviewPrompt` contains `**Considered:**` (output as `(none)` even when `considered` is empty)
  - The value of `draftJson.qa[i].considered` is reflected in the output

### Impact on Existing Tests

- `tests/unit/flow/instructions-coverage.test.js` — registered key coverage is unchanged, so no impact expected. Verify only.
- If any test hits `buildDraftReviewPrompt` via snapshot, update the snapshot

## Out of Scope

- Unifying other phase prompts (spec.md / test.md / review-spec.md / review-test.md) — separate spec
- Unification with impl review (`buildDraftSystemPrompt`) — its subject is a diff, not draft.json
- Reflecting partial rules into guardrail.json — partial rules are prompt-only; guardrail promotion is a separate decision
- Extracting a generic `loadPartial(name)` helper — inline `fs.readFileSync` is sufficient at one usage site

## Relationship to #318 / spec 254 (completed)

#318 was completed in spec 254. draft-scope-boundary was not fully removed — it was disabled via `phase=[]`, its definition remains in guardrail.json, and its content was moved into draft.md as a creation-time instruction. The same pattern was applied to spec-synthesize-not-copy, which was moved into spec.md.

Impact on this issue:
- Discrepancy 3 (direction mismatch) is **more pronounced**: now that the gate evaluation path is gone, the reviewer's only path to reference the rule is one side of the duplicated pair (the review prompt). Prompt-level partial sharing is the only remaining mechanism to ensure authoring and reviewer are consistent.
- The "Field-level boundary" wording in the partial must align with the implementation confirmed in spec 254 (code references permitted in all fields). This spec clarifies that wording.
- The `phase=[]` = disabled loader semantics introduced in spec 254 are out of scope for this issue (this issue covers prompt-layer partial extraction only)

## Known Decision Points

- The partial uses declarative form (subject-omitted MUST). Imperative forms (`Ask...`, `Generate...`) are authoring-specific and remain in the `draft.md` wrapper.
- Handling of the "Draft scope boundary (creation-time guidance — moved from gate evaluation)" text added in spec 254: whether to leave it in `draft.md` or absorb it into the partial is to be decided in this spec. The phrase "moved from gate evaluation" is specific to the spec 254 context, so including it in the partial risks losing that context.

<details>
<summary>ja</summary>

[ENHANCE] draft authoring prompt と draft review prompt の共通化

## 背景

`src/flow/prompts/plan/draft.md` (QA 作成プロンプト) と `src/flow/commands/review.js` の `buildDraftReviewPrompt` (review プロンプト) で同種のルールが二重管理されている。突き合わせ調査で5箇所の齟齬が確認された:

1. `qa[].considered` フィールドが review 入力に渡されていない (schema 上必須なのに review 評価対象外)
2. Requirements category checklist 8 項目のうち、review が明示カバーするのは 1-2 のみ。Test strategy / Alternatives / Future extensibility / Consumer contracts 等は構造的に未検査
3. draft.md「要件レベルに留める」 vs review「shallow を flag」の方向性ずれ。spec 254 で draft-scope-boundary が gate 評価対象から外され creation-time prompt に移植されたため、reviewer が当該ルールを参照する経路は完全に消失。構造的二重管理問題はより顕在化
4. draft.md「Research → self-verification」MUST が review に対応軸なし
5. autoApprove モード差異が review 側に反映されない

加えて、draft.md 内部でも 8 項目 checklist が autoApprove 分岐 (L66-72 付近) と非 autoApprove 分岐 (L88-95 付近) で重複定義されている (spec 254 で先頭に Draft scope boundary 文言が追加されたため当初の line 番号からシフト)。

## 目標

QA に関する宣言的ルール (schema 定義、checklist、field-level boundary、原則) を単一の partial に集約し、authoring 側 (`draft.md`) と reviewer 側 (`buildDraftReviewPrompt`) の両方が同一情報源を参照する構造にする。

## 完了条件

- [ ] `src/flow/prompts/partials/draft-qa-rules.md` が存在し、QA schema/checklist/boundary/原則を宣言形で記述している
- [ ] `getStepInstructions` が `` ディレクティブを解決する (skills.js で使われている `resolveIncludes` を流用)
- [ ] `draft.md` がルール部分を partial 参照に置換し、authoring 固有の制御 (Choice Format, autoApprove 分岐, flow get コマンド等) のみを残している
- [ ] `buildDraftReviewPrompt` が同 partial を読込み、reviewer 文脈 wrapper で挟んで使用する
- [ ] `buildDraftReviewPrompt` が QA エントリ整形時に `considered` フィールドも含める
- [ ] 既存 review 出力フォーマット (numbered list, `### N. <title>`, `**QA:** Q<N>`, `**Issue:**`, `**Suggestion:**`, `NO_PROPOSALS` マーカー) は不変
- [ ] テスト: include 解決の単体、両 prompt が partial 内容を含むことの structural test、`considered` 出力テスト

## 変更対象ファイル

### 新規作成

`src/flow/prompts/partials/draft-qa-rules.md` — 共通ルール宣言

### 修正

| ファイル | 変更内容 |
|---|---|
| `src/flow/lib/get-step-instructions.js` | `getStepInstructions` で読み込んだ content に `resolveIncludes` を適用。`baseDir = path.dirname(filePath)`、`pkgDir = PKG_DIR` を渡す |
| `src/flow/prompts/plan/draft.md` | spec 254 で追加された Draft scope boundary (L1)、schema 定義、Premise validation、Research/self-verification、Requirements checklist (autoApprove 分岐 / 非 autoApprove 分岐の重複) を partial 参照に置換 |
| `src/flow/commands/review.js` | `buildDraftReviewPrompt` を partial 読込ベースに変更。qaText 整形に `considered` 追加。`Focus on:` の旧文言を partial の宣言形ルールに置換 |

## include resolution 方針

flow prompt 内の include パスは `/flow/prompts/partials/<name>.md` 形式 (pkgDir 起点の絶対パス) を採用。同パス形式は `src/lib/include.js` の既存 resolution rule (`startsWith(\"/\")` → `pkgDir` 起点) で対応済み。

`getStepInstructions` の wiring 例:

```js
import { resolveIncludes } from "../../lib/include.js";
import { PKG_DIR } from "../../lib/cli.js";

export function getStepInstructions(instructionsKey) {
  // ... existing validation ...
  const filePath = resolveKeyPath(instructionsKey);
  const content = readFileSync(filePath, "utf8");
  return resolveIncludes(content, {
    baseDir: path.dirname(filePath),
    pkgDir: PKG_DIR,
    sourceFile: filePath,
  });
}
```

`buildDraftReviewPrompt` の wiring (単一使用箇所のため inline 読込):

```js
import { PKG_DIR } from "../../lib/cli.js";
const partialPath = path.join(PKG_DIR, "flow/prompts/partials/draft-qa-rules.md");
const rules = fs.readFileSync(partialPath, "utf8");
```

## partial 内容案 (`draft-qa-rules.md`)

宣言形で authoring/reviewer 両用できるよう "MUST contain" 等の主語省略形を採用。

**重要**: spec 254 で確定した方針 (draft-scope-boundary 内容を creation-time 指示として移植、code references は `evidence`/`why`/`considered`/`answer` 全フィールドで許容) と整合させる。当初案にあった "answer field MUST NOT contain function names" は 254 実装と矛盾するため採用しない。

```md
## Draft QA Rules

### QA entry schema

Each entry in `draft.json.qa[]` MUST have the following fields:

- `question` — the question asked, written at requirements level
- `answer` — the decision or recommendation. MUST stay at requirements level (what & why), not implementation level (how)
- `evidence` — code reference, grep result, or doc citation supporting the answer
- `why` — rationale for the decision
- `considered` — alternative approaches evaluated and rejected

### Field-level boundary (MUST) — spec 254 確定方針

Draft is RFP/requirements level only. Mentioning file paths or function names as context is permitted in any field. Do not describe internal algorithms, data structures, control flow, or API design as the substance of the answer.

Code references within the `evidence`, `why`, `considered`, and `answer` fields of QA entries are permitted as justification and do not constitute implementation details. The boundary is about *substance* (要件 vs 実装方針) rather than *field whitelisting*.

### Requirements category checklist (8 items)

Every draft MUST internally check coverage across these 8 categories. Missing categories MUST be flagged:

1. Goal & Scope — Is the goal clear? Is scope bounded?
2. Impact on existing — What existing features/code/tests are affected?
3. Constraints — Non-functional requirements, guardrails, project rules?
4. Edge cases — Boundary conditions, error cases?
5. Test strategy — What to test and how?
6. Alternatives considered — What other approaches were evaluated? Why was this one chosen?
7. Future extensibility — How does this change affect future modifications or extensions?
8. Consumer contracts — Are there rules that consumers of the introduced interfaces or data structures must follow?

### Premise validation (MUST)

Each QA entry's `question` MUST be based on facts gathered from source code, docs, or prior specs — not on assumption. If the answer can be determined directly from research, state it directly rather than asking. The `evidence` field MUST cite the source consulted.

### Decision entry rule

A "decision" entry — one with non-empty `why` or `considered` — MUST have a non-empty `evidence`. Decisions without evidence are rejected at gate-draft (this is enforced by `checkDraftJson` in `src/flow/lib/run-gate.js`).

### Coverage rule

The QA set MUST address every concern mentioned in the linked request/issue. Concerns not addressed by any QA entry are missing coverage.
```

## draft.md の wrapper

partial 参照の前後に authoring 文脈を挿入。spec 254 で追加された Draft scope boundary 文言、schema 定義・Premise validation・Research/self-verification・Requirements checklist の重複2箇所を partial 参照に置換:

```md
**Apply the rules below when authoring each QA entry.**

[残置: Draft artifact format (draft.json はファイルとして自動生成される旨)、autoApprove flow 制御、Choice Format MUST、ONE question at a time、flow get コマンド呼び出し、metric 設定、On complete handler]
```

## review prompt の wrapper

`buildDraftReviewPrompt` 戻り値:

```js
return [
  "You are a draft QA quality reviewer.",
  "",
  "Evaluate the draft against the rules below. Flag any QA entry that violates them.",
  "",
  rules,  // partial の中身
  "",
  "Output a numbered list of issues in this format:",
  "### 1. <title>",
  "**QA:** Q<N> (the QA entry number, or 'NEW' for missing coverage)",
  "**Issue:** <which rule is violated and how>",
  "**Suggestion:** <concrete improvement to the QA entry>",
  "",
  "If no issues are found, output: NO_PROPOSALS",
  "",
  "## Request / Issue",
  requestText || "(no request text)",
  "",
  "## Draft QA Entries",
  qaText,  // considered を含めたフォーマットに変更
  "",
  "## Codebase Context (related files)",
  "以下のファイルは spec との関連度順に並んでいます。",
  contextText,
].join("\\n");
```

QA エントリ整形 (現状 `src/flow/commands/review.js`):

```js
const qaText = Array.isArray(draftJson?.qa)
  ? draftJson.qa.map((q, i) =>
    `### Q${i + 1}: ${q.question}\\n` +
    `**Answer:** ${q.answer}\\n` +
    `**Evidence:** ${q.evidence || \"(none)\"}\\n` +
    `
... (truncated)