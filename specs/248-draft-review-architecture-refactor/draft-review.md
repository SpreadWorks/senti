# Draft Review Results

7 issue(s) detected.

### 1. 1. Prompt-only loop is under-specified for an “implementation” request
**QA:** Q1  
**Issue:** The answer chooses a prompt-driven loop, but does not specify exactly which template/command owns each transition, how the flow step remains active across attempts, or how this interacts with the existing flow engine and post hooks.  
**Suggestion:** Add concrete implementation boundaries: files to change, whether `review-draft.md` alone drives the loop, what command output/state prevents premature step completion, and why no command-level loop is required.

### 2. 2. Duplicate QA update rule is ambiguous
**QA:** Q1  
**Issue:** “同一 issue が再検出された場合は既存 QA を更新” is useful, but unsupported: no identity rule is defined for “same issue.” This can produce either duplicate QA entries or accidental overwrites.  
**Suggestion:** Define the matching rule, such as matching by review proposal title/category plus affected draft section, and specify whether the user must confirm updates before overwriting existing QA.

### 3. 3. Exit-code contract contradicts the later throw behavior
**QA:** Q4  
**Issue:** The QA says review FAIL should exit `0`, but also says `RunReviewCommand.execute` throws on verdict FAIL. If that throw reaches the CLI/flow runner, it likely becomes non-zero and still triggers `runCmdWithRetry`.  
**Suggestion:** Clarify the actual control flow: verdict FAIL must be represented as successful command execution with `artifacts.verdict='FAIL'`, while step completion should be controlled by flow state/verdict handling rather than throwing.

### 4. 4. runCmdWithRetry fix is not directly covered
**QA:** Q4  
**Issue:** Issue #300 explicitly asks for “runCmdWithRetry の誤リトライ修正,” but the QA concludes “runCmdWithRetry 自体のコード変更は不要.” That may be valid, but the evidence is insufficient unless the review command’s non-zero behavior is fully eliminated.  
**Suggestion:** Add a QA entry or strengthen Q4 to specify the retry boundary: which non-zero cases are retryable, which verdict FAIL cases are not, and what test proves FAIL reviews are not retried.

### 5. 5. 生JSON混入防止 lacks provider/type source of truth
**QA:** Q5  
**Issue:** The filter rule depends on “provider streaming event type,” but does not define where that allowlist lives or how it stays provider-specific. A generic `type` field could collide with legitimate model output outside code blocks.  
**Suggestion:** Specify an explicit allowlist near the Claude provider/parser layer, e.g. known Claude CLI event types only, and add tests for legitimate plain-text JSON lines with `type` fields that must be preserved.

### 6. 6. Missing coverage for generated template upgrade effects
**QA:** Q6  
**Issue:** Q6 mentions running `sdd-forge upgrade`, but no QA entry asks what generated files or skill instructions must change after template edits. Since the issue is mostly workflow/template behavior, this is important acceptance coverage.  
**Suggestion:** Add `NEW` QA covering expected changed artifacts after `src/templates/` edits and `sdd-forge upgrade`, including `.agents/skills` / `.claude/skills` behavior if applicable.

### 7. 7. Test strategy dismisses loop testing too quickly
**QA:** Q6  
**Issue:** “review loop の E2E テストは不要” is asserted because it is prompt-only, but the requested behavior includes approval movement, max attempts, QA updates, and retry avoidance. Those are behavioral risks even if partly prompt-driven.  
**Suggestion:** Replace with a narrower test plan: unit-test command/verdict/retry behavior, template snapshot or fixture assertions for `review-draft.md`, and at least one scripted/manual acceptance scenario for FAIL → QA update → PASS → approval.
