# Code Review Results

### [x] 1. Reintroduce Shared Draft Field Pattern Builder
**File:** `src/flow/lib/run-gate.js`  
**Issue:** `checkDraftText()` now duplicates regex structure for development type/goal and drops the previously supported `## heading` format, creating both duplication and behavioral regression risk.  
**Suggestion:** Restore a shared helper (e.g. `buildDraftFieldPattern(labels)`) and use it for both fields so colon format and heading format are handled consistently.

**Verdict:** APPROVED
**Reason:** This is a genuine behavioral regression. The diff shows `buildDraftFieldPattern` was removed from `run-gate.js` in this branch, reverting `checkDraftText()` to colon-only detection (lines 136–137, 143–144). Spec 156 explicitly implemented heading-format support (`## 開発種別`, `## Goal`) and its tests confirm the intent. The current code silently drops that behavior. Restoring `buildDraftFieldPattern` fixes the regression *and* eliminates the now-duplicated two-branch OR pattern shared between `hasDevType` and `hasGoal` — exactly the case CLAUDE.md mandates helper extraction for (≥2 repetitions).

### [x] 2. Remove Unused `raw` Parsing Payload
**File:** `src/lib/agent.js`  
**Issue:** `parseClaudeOutput` / `parseCodexOutput` return `raw`, but downstream logic discards it. This is dead data and adds noise.  
**Suggestion:** Either remove `raw` from parser return types, or persist it intentionally in logging payload when debugging is needed.

**Verdict:** APPROVED
**Reason:** `parseClaudeOutput` returns `raw: data` and `parseCodexOutput` returns `raw: { lines: stdout }`, but `resolveAgentResult` only reads `parsed.text` and `parsed.usage` — `raw` is silently discarded. The JSDoc for `parseAgentOutput` advertises `raw` in its return type, creating a false contract. This is concrete dead data, not speculative: no code path downstream of `resolveAgentResult` can access it. Either remove it from the parser return types (cleaner), or route it intentionally to the log payload for debug purposes. Either direction is better than the current state.

### [x] 3. Tighten JSON Flag De-duplication Logic
**File:** `src/lib/agent.js`  
**Issue:** `injectJsonFlag()` only checks `flagParts[0]`, so partial matches can incorrectly suppress injection (or allow malformed combinations).  
**Suggestion:** Compare full flag sequence (or normalize to a canonical flag key/value check) before deciding duplication.

**Verdict:** APPROVED
**Reason:** `injectJsonFlag` calls `args.includes(flagParts[0])`, which for `--output-format json` checks only for `--output-format`. If the user's existing args contain `--output-format stream`, the check fires and injection is skipped — leaving the agent in `stream` mode instead of `json`. This is a real silent correctness failure: the flag is present so no injection occurs, but the value is wrong and usage parsing will fail (or fall back silently). A full-sequence check (e.g., test that `flagParts` already appears consecutively in args) would prevent this class of error without breaking the valid dedup case.

### [x] 4. Unify Provider Parse Dispatch
**File:** `src/lib/agent.js`  
**Issue:** `parseAgentOutput()` has repeated provider-specific `try/catch` branches, which is harder to extend and keep consistent.  
**Suggestion:** Use a parser map (e.g. `{ claude: parseClaudeOutput, codex: parseCodexOutput }`) with one shared error-handling path.

**Verdict:** APPROVED
**Reason:** `parseAgentOutput` contains two structurally identical try/catch blocks that differ only in which parser function is called and which provider name appears in the warning string. A parser map `{ claude: parseClaudeOutput, codex: parseCodexOutput }` with one shared error-handling path removes the repetition, makes the exhaustive-provider contract explicit at a glance, and makes adding a third provider (`gemini`, etc.) a single-line map entry rather than another copy-pasted block. This is a genuine quality improvement with no behavioral change.

### [ ] 5. Clarify Sync/Async Raw Call Naming
**File:** `src/lib/agent.js`  
**Issue:** `callAgentRaw` (sync) and `callAgentAsyncRaw` are close in name but differ in execution model, which can cause maintenance mistakes.  
**Suggestion:** Rename to explicit pairs like `callAgentSyncRaw` / `callAgentAsyncRaw` for design consistency and readability.

**Verdict:** REJECTED
**Reason:** `callAgentRaw` and `callAgentAsyncRaw` are non-exported internal functions. The `Async` in the second name already establishes the distinguishing contrast; renaming the first to `callAgentSyncRaw` is purely cosmetic. Both names are unambiguous in their calling context — `callAgent` delegates to `callAgentRaw`, `callAgentAsync` delegates to `callAgentAsyncRaw`. The rename would touch multiple call sites for zero semantic gain, violating the project principle of avoiding unnecessary churn.
