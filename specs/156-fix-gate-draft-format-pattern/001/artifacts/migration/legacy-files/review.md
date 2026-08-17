# Code Review Results

### [x] 1. Extract Draft Field Pattern Builder
**File:** `src/flow/lib/run-gate.js`  
**Issue:** `hasDevType` と `hasGoal` で「見出し形式 + コロン形式」の正規表現構造が重複しており、今後の項目追加時に同じ修正を繰り返す設計になっています。  
**Suggestion:** `buildDraftFieldPattern(labels)` のようなヘルパーを作り、`const DRAFT_DEV_TYPE_PATTERN` / `const DRAFT_GOAL_PATTERN` を定義して `test(text)` する形に統一する。

**Verdict:** APPROVED
**Reason:** The structural duplication is real and immediate — lines 136–137 and 143–144 share an identical two-branch OR pattern `(?:##\s+(?:LABELS)|...\*{0,2}LABELS\*{0,2}\s*[:：])`. CLAUDE.md explicitly mandates helper extraction at 2+ repetitions without waiting for a third. A `buildDraftFieldPattern(labels)` factory would make future field additions mechanical and reduce regex authoring errors. No behavioral change.

### [x] 2. Anchor Heading Detection to Line Start
**File:** `src/flow/lib/run-gate.js`  
**Issue:** `##` 検出が行頭アンカーなしのため、本文中の断片文字列に偶発マッチする余地があります。`checkSpecText()` 側の見出し検出スタイルとも一貫していません。  
**Suggestion:** `/(?:^|\n)\s*##\s+(...)/i` あるいは `m` フラグ付き `^\s*##\s+(...)` にして、見出し行のみを明示的に対象にする。

**Verdict:** APPROVED
**Reason:** This is a genuine correctness gap. The current pattern `/(?:##\s+(?:開発種別|...))/i` (line 137) matches `##` anywhere in the document text — including mid-line fragments like `foo ##\s開発種別`. `checkSpecText()` already uses `/^\s*##\s+.../im` with proper line anchoring (lines 76, 79, 82, 100). Adding `m` flag + `^` anchor (or the `(?:^|\n)` form) aligns behavior with the existing style in the same file and closes a real false-positive window. Low risk, consistent with established patterns.

### [ ] 3. Improve Boolean Naming Clarity
**File:** `src/flow/lib/run-gate.js`  
**Issue:** `hasDevType` は意味は通るものの、他箇所の用語と比べると略語が混ざり可読性が少し落ちます。  
**Suggestion:** `hasDevelopmentTypeField` のように完全語へ寄せるか、`draftHasDevelopmentType` / `draftHasGoal` の命名規則で揃える。

**Verdict:** REJECTED
**Reason:** Pure cosmetic rename. `hasDevType` is unambiguous in its local context (a boolean guard in a 15-line function). Lengthening to `hasDevelopmentTypeField` or `draftHasDevelopmentType` adds no semantic clarity and contradicts the project's preference for concise, non-redundant naming. No quality improvement, non-zero churn cost.

### [ ] 4. DRY Up Repeated Test Assertions
**File:** `specs/156-fix-gate-draft-format-pattern/tests/check-draft-text.test.js`  
**Issue:** `issues.some((i) => i.includes(...))` のロジックが複数テストで重複し、文言変更に弱いです。  
**Suggestion:** `expectNoIssuesFor(issues, keywords)` / `expectHasIssueFor(issues, keywords)` の小ヘルパーを追加して重複を削減する。

**Verdict:** REJECTED
**Reason:** The `issues.some((i) => i.includes(...))` calls are in spec-local regression tests, each with intentionally different keyword sets and assertion directions (positive vs. negative). Abstracting to `expectNoIssuesFor` / `expectHasIssueFor` would introduce an indirection layer that obscures what keyword is being checked and which direction the assertion runs — the opposite of what test code should do. Test clarity outweighs DRY here, and the duplication is shallow (single-line predicates, not logic blocks).

### [ ] 5. Remove Empty Placeholder Content
**File:** `specs/156-fix-gate-draft-format-pattern/qa.md`  
**Issue:** `Q:` / `A:` が空のまま残っており、実質的にデッドなテンプレート行になっています。  
**Suggestion:** 実際のQ&Aがないなら該当プレースホルダを削除し、「確認事項なし」などの明示文だけにしてドキュメントの一貫性を上げる。

**Verdict:** REJECTED
**Reason:** Cosmetic-only change to a spec artifact file (`qa.md`) with no behavioral surface. The empty `Q:` / `A:` is a minor visual wart in a one-shot spec directory that will not be read after the feature merges. The fix would improve documentation tidiness only, which doesn't meet the bar for a code-quality refactoring.
