# Code Review Results

### [x] 1. ### 1. Reuse the Shared `gh` Availability Helper
**File:** `src/flow/commands/merge.js`  
**Issue:** This file reintroduces a local `isGhAvailable()` implementation even though `src/lib/git-state.js` already provides the same capability check. That creates duplicate logic and risks behavioral drift between commands.  
**Suggestion:** Remove the local helper and import `isGhAvailable` from `src/lib/git-state.js` so all `gh` detection follows one implementation.

2. ### 2. Restore a Best-Effort Step Status Wrapper
**File:** `src/flow/registry.js`  
**Issue:** `stepPre()` and `stepPost()` now call `updateStepStatus()` directly after the previous `tryUpdateStepStatus()` abstraction was removed. That makes lifecycle handling less consistent and reintroduces coupling to flow-state persistence errors.  
**Suggestion:** Bring back a small helper such as `tryUpdateStepStatus(root, stepId, status)` and use it in both hooks. This keeps the “best effort” behavior explicit and centralizes future logging or recovery behavior.

3. ### 3. Re-Extract Repeated Git Repo Setup in Init E2E Tests
**File:** `tests/e2e/specs/commands/init.test.js`  
**Issue:** The previous `initProject()` helper was removed, and the same repo bootstrap sequence (`git init`, branch checkout, empty commit) is now duplicated across many test cases. This increases noise and makes future setup changes error-prone.  
**Suggestion:** Reintroduce a focused helper such as `initGitRepo(tmp)` or `initSpecTestRepo(tmp)` that performs the shared setup, and keep per-test differences inline only where needed.

4. ### 4. Test the Public Command Interface Consistently
**File:** `tests/unit/flow/set-auto.test.js`  
**Issue:** The test now invokes `src/flow/set/auto.js` directly instead of exercising the public CLI entrypoint used elsewhere. That makes the test less representative of real usage and inconsistent with the command-routing pattern in the rest of the suite.  
**Suggestion:** Run the test through `src/sdd-forge.js` or `src/flow.js` with `flow set auto ...` so the test covers the actual CLI contract rather than an internal module path.

5. ### 5. Keep Deprecated Command Handling Behind a Reusable Alias Pattern
**File:** `src/flow/registry.js`  
**Issue:** The deprecated `redo` command is now implemented inline as a one-off `Promise.resolve({ execute() { ... } })` entry. That works, but it mixes deprecation plumbing directly into the registry and is likely to be repeated for future command renames.  
**Suggestion:** Extract a small helper for deprecated aliases, for example `deprecatedCommand(oldKey, newKey, message)`, and use it for `redo`. This keeps the registry declarative and makes command-renaming behavior consistent.

**Verdict:** APPROVED
**Reason:** The diff clearly shows `merge.js` removed the import of `isGhAvailable` from `src/lib/git-state.js` and reintroduced a local implementation without `timeout: 5000` (uses bare `stdio: "ignore"` instead). Meanwhile `git-state.js` still exports `isGhAvailable()` using `tryExec` with a 5-second timeout. This is genuine behavioral drift — the shared version is more robust (timeout protection), and having two implementations creates a real maintenance risk. Consolidating back to the shared import is correct.
