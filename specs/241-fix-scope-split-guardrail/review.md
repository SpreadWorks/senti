# Code Review Results

### [ ] 変更差分のレビューとして、対象を `src/flow/prompts/plan/draft.md` と `src/presets/base/guardrail.json` に限定して文面の整合性と guardrail 観点を確認します。相対パスの基準がずれているようなので、まず worktree 内のレイアウトを確認して diff 対象ファイルの実パスを特定します。実作業ルートは `.tmp` の一つ上にあるようです。diff 対象の実ファイルをその範囲で読み、文言の一貫性を確認します。差分自体は小さいので、周辺の表現パターンだけ軽く確認しています。主に `Issue/request` の命名一貫性と、今回追加したルール文が別の guardrail と衝突していないかを見ます。### 1. Remove duplicated scope-policy wording from the draft prompt
**File:** `src/flow/prompts/plan/draft.md`  
**Issue:** The new sentence restates policy that is now also encoded in the `single-responsibility` guardrail. That creates two sources of truth for the same rule, and they already drift slightly (`Issue/request` here vs `Issue or request` in the guardrail). This increases maintenance cost and makes future policy changes easier to apply inconsistently.  
**Suggestion:** Keep this note focused on draft-phase behavior and reference the guardrail as the authority instead of re-explaining the scope rule here. For example, shorten it to task-decomposition guidance plus an explicit reference to `single-responsibility` / `task-single-responsibility`, or reuse the exact same wording as the guardrail.

**Verdict:** REJECTED
**Reason:** The "duplication" is actually intentional reinforcement. The draft.md sentence is a concise in-context reminder during the draft phase, while the guardrail is an enforcement rule. Stripping the prompt to a bare reference to `single-responsibility` weakens the prompt-level signal during draft authoring without removing real maintenance burden (only two short sentences are involved). The "drift" cited (`Issue/request` vs `Issue or request`) is a wording nit better solved by Proposal 3 alone, not by gutting the prompt note.

### [ ] 2. Keep the single-responsibility guardrail enforceable
**File:** `src/presets/base/guardrail.json`  
**Issue:** The added sentence `Whether an Issue constitutes one concern is the user's judgment.` weakens the guardrail enough that it becomes effectively non-actionable for broad user requests. It also conflicts with the opening requirement `Each spec shall address one concern`, because the rule can no longer challenge an obviously multi-concern issue.  
**Suggestion:** Separate “do not auto-split user scope” from “spec must remain cohesive.” A tighter wording would be: treat a user-created Issue/request as the default scope boundary, and if it appears to span multiple concerns, the AI should ask for clarification or confirmation rather than split it autonomously. That preserves the intent without turning the guardrail into an unenforceable exception.

**Verdict:** REJECTED
**Reason:** The proposal's suggested wording ("AI should ask for clarification or confirmation rather than split it autonomously") directly contradicts the explicit project policy recorded in `feedback_no_scope_splitting.md`: "Issue が1つの concern なら分割提案せずユーザー判断に委ねる". The new sentence is the intended fix — it deliberately makes user-defined Issue scope authoritative and forbids the AI from re-litigating it. Reverting it under the banner of "enforceability" would undo the user's stated intent for this change.

### [x] 3. Normalize request terminology
**File:** `src/flow/prompts/plan/draft.md`  
**Issue:** `Issue/request` introduces an ad hoc slash form that does not match the phrasing used in `guardrail.json` (`Issue or request`). For prompt-driven systems, even small terminology differences tend to accumulate into inconsistent behavior and harder-to-search policy text.  
**Suggestion:** Use one canonical term everywhere in these touched files, preferably `Issue or request` to match the guardrail text and keep the policy language mechanically searchable.

**Verdict:** APPROVED
**Reason:** Aligning `Issue/request` in `draft.md` with `Issue or request` in `guardrail.json` is a low-risk consistency fix that improves grep-ability of policy language and matches the project rule on consistent terminology within touched files. No behavior change, purely textual unification.
