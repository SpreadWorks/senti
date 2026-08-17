# Code Review Results

### [x] 1. Consolidate Repeated Logger Wrapper Logic
**File:** `src/lib/agent.js`  
**Issue:** `callAgentWithLog`, `callAgentAwaitLog`, and `callAgentAsyncWithLog` duplicate the same control flow (`requestId` generation, start log, try/catch/finally, end log payload creation, error handling).  
**Suggestion:** Extract a shared internal runner (e.g. `runWithAgentLogging({ mode, invoke })`) to centralize start/end logging and error/exit-code mapping. Keep thin sync/async wrappers only for invocation style.

**Verdict:** APPROVED
**Reason:** The three wrappers (`callAgentWithLog`, `callAgentAwaitLog`, `callAgentAsyncWithLog`) genuinely duplicate the requestId generation, start-log, try/catch/finally, and end-log assembly pattern. `buildAgentLogPayload` already extracts one piece, but the outer scaffolding repeats across all three. A shared `runWithAgentLogging({ mode, invoke })` runner would eliminate the duplication without changing external signatures or behavior. Note: the subtle difference in error code extraction (`err.status` vs `err.code`) must be preserved per invocation mode when factoring.

### [x] 2. Avoid Unnecessary Flow-State Resolution on Start Events
**File:** `src/lib/log.js`  
**Issue:** `Logger.agent()` resolves flow context (`resolveFlowContext`) before branching on `phase`, so `start` events pay unnecessary async I/O cost.  
**Suggestion:** Move `resolveFlowContext(this.#cwd)` into the `"end"` branch only. `start` events can be logged without `spec/sddPhase`.

**Verdict:** APPROVED
**Reason:** In the current `Logger.agent()`, `resolveFlowContext(this.#cwd)` is awaited unconditionally before the phase branch, even though start events never use `ctx`. The start event record uses only `caller` + common fields. Moving the `resolveFlowContext` call inside the `phase === "end"` branch eliminates unnecessary async filesystem I/O on every agent invocation without any behavioral change to end events.

### [x] 3. Reduce Repetition in Review Command Agent Calls
**File:** `src/flow/commands/review.js`  
**Issue:** Many `callAgentAwaitLog(...)` calls repeat the same argument pattern (`undefined, root, { systemPrompt: ... }`), with readability noise from blank placeholder lines.  
**Suggestion:** Introduce a local helper (e.g. `callReviewAgent(agent, prompt, systemPrompt)`) that fixes `timeoutMs`/`cwd` defaults and only accepts changing inputs.

**Verdict:** APPROVED
**Reason:** After removing `logCtx`, every `callAgentAwaitLog` call in `review.js` passes a blank `undefined` positional arg followed by a fixed `root` and a `{ systemPrompt: ... }` object. A local `callReviewAgent(agent, prompt, systemPrompt)` helper would eliminate the repeated `undefined, root, { systemPrompt: ... }` boilerplate and make it impossible to accidentally reorder the now-meaningless undefined placeholder. This is more than cosmetic: the blank positional slot is a readability hazard and accident-waiting-to-happen.

### [x] 4. Extract Shared Test Utilities
**File:** `tests/unit/lib/log.test.js`  
**Issue:** `todayLocal()` and `readJsonl()` are redefined across multiple test files, creating duplicate parsing/date logic.  
**Suggestion:** Move common helpers into a shared test utility module (e.g. `tests/helpers/log-fixtures.js`) and import from unit/e2e tests.

**Verdict:** APPROVED
**Reason:** `todayLocal()` and `readJsonl()` are identically defined in `log.test.js`, `agent-with-logger.test.js`, and the e2e test — three separate copies. The project's CLAUDE.md coding rule explicitly states: "実装時に既存コードと同じパターンが2箇所以上で繰り返される場合、共通ヘルパーに抽出すること。3回目の出現を待つ必要はない。" Extracting to `tests/helpers/log-fixtures.js` directly satisfies this rule with no risk to production behavior.

### [x] 5. Remove Flaky Timing-Based Flush Wait
**File:** `tests/unit/lib/agent-with-logger.test.js`  
**Issue:** The test uses `setImmediate + setTimeout(50)` to wait for fire-and-forget logging, which can be flaky under load.  
**Suggestion:** Replace timing waits with deterministic synchronization (e.g. mock `Logger.agent`, or expose a test-only flush hook and await it).

**Verdict:** APPROVED
**Reason:** The `setImmediate + setTimeout(50)` wait in `callAgentWithLog`'s test is a known source of CI flakiness — it relies on the fire-and-forget Promise resolving within 50 ms, which can fail under load. Replacing it with a deterministic approach (e.g., mocking `Logger.agent` to capture calls synchronously, or exposing a test-only flush hook) makes the test reliably verify the same behavior. This is a test quality improvement with no production impact.
