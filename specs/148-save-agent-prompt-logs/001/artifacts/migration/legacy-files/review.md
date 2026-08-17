# Code Review Results

### [x] Now I have a full picture of all changed files. Here are the proposals:
---

**Verdict:** APPROVED
**Reason:** The duplication is real — both `callAgent` and `callAgentAsync` repeat identical 3-line setup and teardown blocks. Moving mutation logic into `AgentLog` itself aligns with the "deep module" principle cited in CLAUDE.md and gives the class a meaningful behavioral role rather than acting as a passive data container. The proposed API is clean and the change is behaviorally equivalent.

### [x] 1. Extract `AgentLog.start()` / `AgentLog.end()` to eliminate duplicated setup/teardown
**File:** `src/lib/agent-log.js`, `src/lib/agent.js`

**Issue:** Both `callAgent` and `callAgentAsync` repeat the same three-line setup block:
```js
if (agentLog) {
  agentLog.prompt = prompt;
  agentLog.executeStartAt = new Date();
}
```
and a structurally identical three-line teardown. This scatters the `AgentLog` state-mutation logic across `agent.js`, violating the "deep module" principle from `CLAUDE.md`.

**Suggestion:** Add `start(prompt)` and `end(cwd, cfg)` methods to `AgentLog`, moving all mutation and write logic into the class itself:

```js
// src/lib/agent-log.js
start(prompt) {
  this.prompt = prompt;
  this.executeStartAt = new Date();
}

end(cwd, cfg) {
  this.executeEndAt = new Date();
  this.executeTime = (this.executeEndAt - this.executeStartAt) / 1000;
  appendAgentLog(this, cwd, cfg);
}
```

Callers become one-liners using optional chaining:
```js
// callAgent
agentLog?.start(prompt);
try { ... } finally { agentLog?.end(cwd, cfg); }

// callAgentAsync
agentLog?.start(prompt);
return promise.finally(() => agentLog?.end(cwd, cfg));
```

---

**Verdict:** APPROVED
**Reason:** The dual-timestamp issue is legitimate: `agentLog.executeStartAt = new Date()` and `const startMs = Date.now()` are set milliseconds apart, making `executeTime` slightly inconsistent with `executeEndAt − executeStartAt`. Computing `executeTime` from the already-stored `Date` objects (as in `(this.executeEndAt - this.executeStartAt) / 1000`) removes the discrepancy and eliminates the unconditional `startMs` allocation. This is directly enabled by Proposal 1 and does not change observable behavior for callers.

### [x] 2. Eliminate `startMs` — remove the dual-timestamp inconsistency
**File:** `src/lib/agent.js`

**Issue:** Both `callAgent` and `callAgentAsync` capture two separate timestamps for the same moment: `agentLog.executeStartAt = new Date()` and `const startMs = Date.now()`. These are set milliseconds apart and can drift, so `executeTime` will not exactly match `executeEndAt − executeStartAt`. Additionally, `startMs` is allocated unconditionally even when `agentLog` is `null`.

**Suggestion:** Remove `startMs` entirely. Compute `executeTime` from the already-stored `Date` objects (as shown in Proposal 1's `end()` method):
```js
this.executeTime = (this.executeEndAt - this.executeStartAt) / 1000;
```
This makes the three timing fields (`executeStartAt`, `executeEndAt`, `executeTime`) internally consistent and removes the unconditional allocation.

---

**Verdict:** APPROVED
**Reason:** The current `promise.then(result => { finish(); return result; }, err => { finish(); throw err; })` pattern is the textbook manual approximation of `.finally()`. Using `Promise.prototype.finally` is semantically identical, more readable, and removes the `finish` closure entirely (especially after Proposal 1). The one subtlety — that `.finally()` preserves the original rejection — is exactly the desired behavior here, and `appendAgentLog` already swallows write errors internally, so there is no risk of suppressing agent failures.

### [x] 3. Use `Promise.prototype.finally` in `callAgentAsync`
**File:** `src/lib/agent.js`

**Issue:** The current pattern to run cleanup on both success and failure is:
```js
return promise.then(
  (result) => { finish(); return result; },
  (err)    => { finish(); throw err; },
);
```
This is the manual equivalent of `finally` — a well-known anti-pattern when the native construct exists. It also forces a `const finish = () => { ... }` closure just to share logic between the two branches.

**Suggestion:** Use `Promise.prototype.finally`, which re-throws automatically and is the idiomatic choice here. After adopting Proposal 1, the `finish` closure disappears entirely:
```js
return promise.finally(() => agentLog?.end(cwd, cfg));
```
`appendAgentLog` already swallows all write errors, so `.finally()` will not suppress the original rejection.

---

**Verdict:** APPROVED
**Reason:** The diff confirms `before` and `after` are imported on line 8 but never referenced anywhere in the 229-line test file — only `afterEach` is used. Removing dead imports is a genuine quality improvement (reduces noise, eliminates potential linter warnings) with zero behavioral risk. This is not cosmetic-only; unused imports in test files can mislead readers into thinking lifecycle hooks are active when they are not.

### [ ] 4. Remove unused `before` / `after` imports in test file
**File:** `specs/148-save-agent-prompt-logs/tests/agent-log.test.js`

**Issue:** Line 8 imports `before` and `after` from `node:test`, but neither is referenced anywhere in the file — only `afterEach` is used. Dead imports add noise and may cause linter warnings.

**Suggestion:** Remove them from the import:
```js
// Before
import { describe, it, before, after, afterEach } from "node:test";

// After
import { describe, it, afterEach } from "node:test";
```

**Verdict:** REJECTED
**Reason:** No verdict provided
