# Code Review Results

### [x] Based on my analysis of the diff, here are the code quality proposals:
---

**Verdict:** APPROVED
**Reason:** `Logger.getInstance()` is called 9 times in the same lexical scope. Caching the singleton in a `const logger` before the `try` block is a genuine readability and maintainability improvement — it reduces boilerplate, makes every call site cleaner, and doesn't change behavior since a singleton always returns the same instance. This is a textbook example of eliminating noise without risk.

### [x] 1. Repeated `Logger.getInstance()` calls in `src/docs.js`
**File:** `src/docs.js`
**Issue:** `Logger.getInstance()` is called 9 times within the build pipeline block (lines 103, 109, 128, 135, 141, 154, 160, 167, 222). The singleton is resolved on every call, creating noise and making refactoring harder.
**Suggestion:** Assign the instance once before the `try` block and use it throughout:
```js
const logger = Logger.getInstance();
try {
  logger.event("pipeline-step", { step: "scan", phase: "start" });
  ...
  logger.event("error", { message: err.message });
```

---

**Verdict:** APPROVED
**Reason:** The two-line pattern repeats 8 times with an identical structure, with the step name duplicated between both lines on each occurrence. The project's own coding rule states: *"実装時に既存コードと同じパターンが2箇所以上で繰り返される場合、共通ヘルパーに抽出すること"* — this is exactly that case, scaled to 8. A local `startStep(step)` helper eliminates the duplication, removes the risk of mismatched step names between the log and progress calls, and creates a single place to extend the pattern (e.g., adding a `phase: "end"` log). No behavior change.

### [x] 2. Duplicated "log + progress.start" pattern in `src/docs.js`
**File:** `src/docs.js`
**Issue:** The two-line pattern of logging a pipeline step start and then calling `progress.start()` with the same step name repeats 8 times:
```js
Logger.getInstance().event("pipeline-step", { step: "scan", phase: "start" });
progress.start("scan");
```
The step name is duplicated between both lines, and any future change (e.g., adding `phase: "end"`) must be applied 8 times.
**Suggestion:** Extract a local helper inside the `build` block:
```js
function startStep(step) {
  logger.event("pipeline-step", { step, phase: "start" });
  progress.start(step);
}
// usage:
startStep("scan");
startStep("enrich");
```

---

**Verdict:** APPROVED
**Reason:** The conditional git log call appears three times in the diff — once in `runCmd`'s success path, once in its catch path, and once in `runCmdAsync`'s callback — with structurally identical code. Extracting a module-level `logGitResult(cmd, args, result)` helper eliminates the triplication and, combined with Proposal 4's fix, ensures all three sites are consistent. The helper doesn't change observable behavior; it only consolidates the pattern. Directly aligns with the project's 2+ repetition extraction rule.

### [x] 3. Triplicated git logging pattern in `src/lib/process.js`
**File:** `src/lib/process.js`
**Issue:** The conditional git logging call appears three times — once in `runCmd`'s success path, once in its catch path, and once in `runCmdAsync`'s callback — with near-identical structure:
```js
if (cmd === "git") Logger.getInstance().git({ cmd: [cmd, ...args], exitCode: result.status, stderr: result.stderr });
```
The first occurrence also differs slightly by inlining `exitCode: 0, stderr: ""` instead of using `result`, which is an inconsistency.
**Suggestion:** Extract a module-level helper:
```js
function logGitResult(cmd, args, result) {
  if (cmd === "git") Logger.getInstance().git({ cmd: [cmd, ...args], exitCode: result.status, stderr: result.stderr });
}
```
Then in `runCmd`'s success path, use `result` consistently instead of hardcoding `0`/`""`, and call `logGitResult(cmd, args, result)` in all three places.

---

**Verdict:** APPROVED
**Reason:** This is a real inconsistency, not cosmetic. The success path hardcodes `exitCode: 0, stderr: ""` in the git log call while the result object already holds `status: 0` and `stderr: ""` in named fields. The failure path correctly reads from `result`. Although the current values happen to be identical, the inconsistency is a latent maintenance hazard: if the success result shape ever changes (e.g., capturing stderr from a non-error output), the log call will silently emit stale data. Replacing `0` and `""` with `result.status` and `result.stderr` closes this gap with no behavior change and makes the success path consistent with the failure path.

### [ ] 4. Inconsistent result construction in `runCmd` success path (`src/lib/process.js`)
**File:** `src/lib/process.js`
**Issue:** In the `try` block of `runCmd`, the git log call hardcodes `exitCode: 0, stderr: ""` directly rather than reading from the just-constructed `result` object:
```js
const result = { ok: true, status: 0, stdout: ..., stderr: "", ... };
if (cmd === "git") Logger.getInstance().git({ cmd: [cmd, ...args], exitCode: 0, stderr: "" });
```
The failure path correctly uses `result.status` and `result.stderr`. This inconsistency means a future change to the success result shape (e.g., capturing stderr from a warning) would silently log stale data.
**Suggestion:** Replace the hardcoded values with references to `result` to match the failure path pattern:
```js
if (cmd === "git") Logger.getInstance().git({ cmd: [cmd, ...args], exitCode: result.status, stderr: result.stderr });
```

**Verdict:** REJECTED
**Reason:** No verdict provided
