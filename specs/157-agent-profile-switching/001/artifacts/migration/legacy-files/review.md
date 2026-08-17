# Code Review Results

### [x] Now I have enough context to provide a thorough review. Here are the proposals:
---

**Verdict:** APPROVED
**Reason:** The diff confirms the regression is real. `src/flow/lib/run-gate.js` now only runs `git diff ${state.baseBranch}...HEAD` (committed), dropping `git diff HEAD` (staged + unstaged) that spec #157 intentionally added. The error message also loses the `"(committed or uncommitted)"` qualifier. The spec documents (now deleted) explicitly record the two-diff approach as a deliberate bug fix for the standard flow where `finalize` commits last. Restoring this behavior — including the `runGitDiff` helper to avoid the duplicated `runCmd + assertOk` pattern — is both correct and required.

### [x] 1. Regression: uncommitted diff detection removed from `executeImpl`
**File:** `src/flow/lib/run-gate.js`
**Issue:** The spec #157 fix intentionally combined `git diff baseBranch...HEAD` (committed) with `git diff HEAD` (staged + unstaged) so that `gate impl` works before `finalize` commits the changes. This branch reverts that fix — only committed changes are checked again, and the error message drops the `"(committed or uncommitted)"` qualifier. Since the spec #157 completion artifacts are being deleted as part of cleanup, this reverts a deliberate bug fix silently.
**Suggestion:** Restore the two-diff approach:
```js
const committed = runCmd("git", ["diff", `${state.baseBranch}...HEAD`], { cwd: root });
assertOk(committed, "failed to get git diff");
const uncommitted = runCmd("git", ["diff", "HEAD"], { cwd: root });
assertOk(uncommitted, "failed to get uncommitted git diff");
const diff = committed.stdout + uncommitted.stdout;
if (!diff.trim()) {
  return gateFail("impl", specPath, [], ["no changes found (committed or uncommitted) against base branch"]);
}
```
Also restore the `runGitDiff` helper that was extracted in the review of spec #157 to eliminate the repeated `runCmd + assertOk` pattern.

---

**Verdict:** APPROVED
**Reason:** The diff confirms the code reads `if (!diffRes.ok) { assertOk(diffRes, "...") }`. Since `assertOk` unconditionally throws when `!res.ok`, the `if` guard is a no-op that adds indentation and misleads readers into thinking the `if` branch has distinct semantics. Removing it is a genuine clarity improvement with zero behavioral risk.

### [x] 2. Dead code: redundant guard before `assertOk`
**File:** `src/flow/lib/run-gate.js` (lines 424–426)
**Issue:** `assertOk` already throws when `!res.ok`. Wrapping it in `if (!diffRes.ok)` is a no-op guard that adds noise without effect:
```js
if (!diffRes.ok) {
  assertOk(diffRes, "failed to get git diff");  // assertOk throws unconditionally here
}
```
**Suggestion:** Call `assertOk` directly without the guard:
```js
assertOk(diffRes, "failed to get git diff");
```

---

**Verdict:** APPROVED
**Reason:** The diff confirms both branches of `resolveAgent` end with identical three-line sequences: provider lookup, null guard, and spread-return with `detectProviderKey`. Per the project's CLAUDE.md, extracting a helper is mandatory when the same pattern appears ≥2 times. `buildAgentResult(providers, key, timeoutMs)` removes the duplication cleanly with no behavioral change.

### [x] 3. Duplicate final-resolution logic in `resolveAgent`
**File:** `src/lib/agent.js` (lines 683–693)
**Issue:** Both the profile branch and the no-profile branch end with identical code:
```js
const provider = providers[key];
if (!provider) return null;
return { ...provider, timeoutMs, providerKey: detectProviderKey(provider.command) };
```
**Suggestion:** Extract a shared helper and call it from both branches:
```js
function buildAgentResult(providers, key, timeoutMs) {
  const provider = providers[key];
  if (!provider) return null;
  return { ...provider, timeoutMs, providerKey: detectProviderKey(provider.command) };
}

// In resolveAgent:
if (profileName) {
  // ...
  return buildAgentResult(providers, providerKey || defaultAgent, timeoutMs);
}
return buildAgentResult(providers, defaultAgent, timeoutMs);
```

---

**Verdict:** APPROVED
**Reason:** This is a real functional bug. The diff confirms the wizard still produces `config.agent.default = "claude"` (or `"codex"`) — the updated test explicitly asserts `config.agent.default === "claude"`. However, `resolveAgent` now merges `BUILTIN_PROVIDERS` (keyed as `"claude/sonnet"`, `"claude/opus"`, etc.) with user providers, then looks up `providers[defaultAgent]`. `providers["claude"]` is `undefined`, so `resolveAgent` returns `null` for every newly set-up project. All agent-driven commands silently fail. The fix (option a: update wizard choices to namespaced keys) is the right approach.

### [ ] 4. Setup wizard produces unresolvable `agent.default` values
**File:** `src/setup.js` (lines 328–331) + `src/lib/agent.js`
**Issue:** The wizard still offers `"claude"` and `"codex"` as agent choices (plain names), which become `config.agent.default`. However, `BUILTIN_PROVIDERS` uses namespaced keys: `"claude/sonnet"`, `"claude/opus"`, `"codex/gpt-5.4"`, `"codex/gpt-5.3"`. A project created with `sdd-forge setup` will have `default: "claude"`, which matches nothing in `BUILTIN_PROVIDERS` and no user-defined provider, causing `resolveAgent` to always return `null`.
**Suggestion:** Either (a) update the wizard choices to offer specific provider keys (`"claude/sonnet"`, `"claude/opus"`, etc.) so `default` matches a builtin, or (b) add `"claude"` and `"codex"` as alias entries in `BUILTIN_PROVIDERS` that point to sensible defaults (e.g., `"claude"` → same as `"claude/sonnet"`). Option (a) is preferred to keep the config explicit.

---

**Verdict:** REJECTED
**Reason:** The string is already assigned to a named local variable `thin` at the top of `formatText`, and all `pushSection` calls within that function receive `thin` as a parameter. Hoisting it to a module-level `DIVIDER` constant does not eliminate any duplication (it appears once in the assignment) and changes no behavior. This is a cosmetic rename with no quality improvement in the current code structure.

### [ ] 5. `DIVIDER` inlined as a magic string literal
**File:** `src/flow/commands/report.js` (line 124)
**Issue:** After `formatter.js` was deleted, `pushSection` was re-inlined but the `DIVIDER` constant was replaced with a raw Unicode string literal:
```js
const thin = "────────────────────────────────────────────────";
```
This magic string is used repeatedly through `pushSection` calls. If the divider character or length ever needs changing, the literal must be found and edited manually.
**Suggestion:** Declare it as a named module-level constant:
```js
const DIVIDER = "────────────────────────────────────────────────";
```
and reference `DIVIDER` in `formatText` instead of the inline literal. This also makes it consistent with how it was named when it lived in `formatter.js`.

**Verdict:** REJECTED
**Reason:** No verdict provided
