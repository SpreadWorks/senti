# Code Review Results

### [x] 1. Remove Pre-Implementation Test Stubs
**File:** `tests/unit/lib/log.test.js`  
**Issue:** The `try/catch` dynamic import fallback and stub classes/functions are now dead code after `src/lib/log.js` and `src/lib/agent-log.js` exist. This adds branching noise and can hide real import/config errors.  
**Suggestion:** Replace the guarded import block with direct imports at top-level (`import { Log, logger, resolveLogDir } ...`, `import { AgentLog } ...`) and delete all stub fallback logic.

**Verdict:** APPROVED
**Reason:** Implementation is complete — `src/lib/log.js` and `src/lib/agent-log.js` both exist and export the expected symbols. The `try/catch` fallback with stub classes is dead code that actively harms test integrity: if a future refactor breaks the real import, the stubs would silently take over and the test suite would pass while hiding the regression. Direct top-level imports make failures visible immediately, which is the correct behavior for a post-implementation test file.

### [x] 2. Make Base Log Contract Explicit
**File:** `src/lib/log.js`  
**Issue:** `Log` behaves like an abstract base class, but missing subclass contract is silently ignored (`filename` undefined => return, `toJSON()` returns `{}`). This can mask implementation mistakes and create inconsistent log behavior.  
**Suggestion:** Enforce contract explicitly: either throw in `Log.toJSON()` and when `constructor.filename` is missing, or add a clear validation helper in `logger()` (with a stderr warning at minimum) so invalid subclasses fail loudly and consistently.

**Verdict:** APPROVED
**Reason:** The silent `if (!filename) return;` in `logger()` (log.js:59) swallows misconfigured subclasses without any signal — a class that forgets to define `static filename` just produces no logs and no error. Adding a `process.stderr.write(...)` warning at that guard point is a non-breaking improvement aligned with the project's own error policy ("エラーの黙殺禁止"). However, changing `Log.toJSON()` to throw must be rejected: the spec's Test Strategy explicitly documents `"toJSON がデフォルトで空オブジェクトを返す"` and an existing test (`assert.equal(typeof json, "object")`) encodes that contract. Throwing there would contradict the approved spec without a spec revision.

### [ ] 3. Clarify Writer Function Naming
**File:** `src/lib/log.js`  
**Issue:** `logger` is ambiguous as a function name; in many codebases it implies a logger instance/object rather than a one-shot JSONL append operation.  
**Suggestion:** Rename `logger` to an action-oriented name like `appendLogEntry` or `writeLogEntry` to better reflect behavior and improve call-site readability.

**Verdict:** REJECTED
**Reason:** This is a cosmetic rename with zero behavior change. More importantly, the name `logger` was chosen deliberately: the spec, draft, and flow.json all consistently call it "logger 関数," and the module-level JSDoc (`logger() is the unified writer`) reinforces it. Renaming creates drift between the codebase and its design documents. The current name is not wrong — it's unambiguous in context given the module (`lib/log.js`) and its JSDoc description. The rename adds churn without improving correctness or preventing bugs.

### [x] 4. Return Strict Boolean in `isEnabled`
**File:** `src/lib/agent-log.js`  
**Issue:** `isEnabled(cfg)` returns `cfg?.logs?.prompts`, which can be `undefined` instead of a strict boolean. This weakens interface consistency for `Log` subclasses.  
**Suggestion:** Normalize to boolean: `return Boolean(cfg?.logs?.prompts);` so all `isEnabled` implementations conform to a predictable `true/false` contract.

**Verdict:** APPROVED
**Reason:** `cfg?.logs?.prompts` can return `undefined` when the key is absent, making `AgentLog.isEnabled()` a non-boolean contrary to the declared interface contract. The existing tests only assert truthiness/falsiness (`assert.ok(!...)`) and `true`/`false` equality, so `Boolean(cfg?.logs?.prompts)` passes all of them while tightening the type contract. This is a small, safe, behavior-preserving improvement that ensures all `isEnabled` implementations return a predictable `true | false` rather than `true | false | undefined`.

### [ ] 5. Reduce Repetition in Logger Tests
**File:** `tests/unit/lib/log.test.js`  
**Issue:** Test setup repeatedly constructs and populates `AgentLog` objects with similar field assignments, which duplicates logic and makes tests longer than necessary.  
**Suggestion:** Introduce a small local factory/helper (e.g., `createAgentLog(overrides)`) to centralize defaults and reduce duplication across logger test cases.

**Verdict:** REJECTED
**Reason:** Cosmetic only. Each test case sets up exactly the fields it needs for its specific assertion — the "duplication" is intentional test clarity, not harmful repetition. A factory helper would add indirection that makes it harder to see at a glance what state each test starts from. The project's coding rules about extracting common helpers apply to production code; test setup that is locally explicit is preferable. No behavior is affected, and no real maintainability problem exists.

### [x] 6. Simplify `callAgentAsync` Control Flow
**File:** `src/lib/agent.js`  
**Issue:** `callAgentAsync` assigns a `promise` variable and then immediately returns it; this is extra ceremony after log-finalization logic was removed.  
**Suggestion:** Inline the return with a conditional expression:
`return retryCount <= 0 ? callAgentAsyncOnce(...) : callAgentAsyncWithRetry(...);`  
This keeps behavior identical while simplifying the function.

**Verdict:** APPROVED
**Reason:** The `let promise; if (...) { promise = ... } else { promise = ... } return promise;` pattern is a leftover artifact from the log-finalization refactor: `promise` was originally passed into `.then(finish)` — after that chain was removed, the variable became purely ceremonial. Inlining as `return retryCount <= 0 ? callAgentAsyncOnce(...) : callAgentAsyncWithRetry(...);` is behavior-identical, removes the unnecessary mutable binding, and makes the intent immediately readable. This is not purely cosmetic — it eliminates a misleading pattern that implies the variable might be used downstream.
