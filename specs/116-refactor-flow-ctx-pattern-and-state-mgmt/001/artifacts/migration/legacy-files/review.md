# Code Review Results

### [x] Now I have a complete picture. Here are the proposals:
---

**Verdict:** APPROVED
**Reason:** Confirmed at line 32 of `src/flow.js`: `const t = translate()` is declared but `t` is never referenced in the help block (lines 33–41). The `translate` import on line 18 has no other usage in the file. This is genuine dead code removal with zero behavior risk.

### [x] 1. Dead code: unused `t` variable in help block
**File:** `src/flow.js`
**Issue:** Line 32 declares `const t = translate()` but `t` is never referenced anywhere in the help block. The `translate()` import is also pulled in without being used.
**Suggestion:** Remove the line `const t = translate();` and remove `translate` from the import on line 18.

---

**Verdict:** APPROVED
**Reason:** The three-line `before/execute/after` sequence appears verbatim at lines 94–97 (prepare branch) and lines 133–136 (group-command branch). Extracting a `runEntry()` helper eliminates duplication and reduces the risk of the two paths diverging when hooks or error handling are added later. This is a clear DRY improvement with no behavior change.

### [x] 2. Duplicate entry-dispatch pattern in `dispatch()`
**File:** `src/flow.js`
**Issue:** The three-line `before/execute/after` call sequence appears verbatim twice: once in the `prepare` branch (lines 94–97) and once in the group-command branch (lines 133–136). This will drift if the pattern ever needs to change (e.g., adding error handling or result validation).
**Suggestion:** Extract a small helper inside `dispatch()`:
```js
async function runEntry(entry, ctx) {
  if (entry.before) entry.before(ctx);
  const mod = await entry.execute();
  const result = await mod.execute(ctx);
  if (entry.after) entry.after(ctx, result);
}
```
Then both dispatch paths reduce to `ctx.args = ...; await runEntry(entry, ctx);`.

---

**Verdict:** APPROVED
**Reason:** Confirmed at lines 65–75: `loadFlowState(root)` is called in both branches of the `if (requiresFlow)` / `else` block. The only difference is the null-check exit. Collapsing to a single call followed by a conditional guard is semantically equivalent, eliminates a redundant file read, and is simpler to maintain. No behavior change.

### [x] 3. Duplicate `loadFlowState` call in `resolveCtx`
**File:** `src/flow.js`
**Issue:** `loadFlowState(root)` is called in both branches of the `if (requiresFlow) / else` block (lines 66 and 73). The only difference is that the `requiresFlow` branch exits on null and the `else` branch silently skips. This reads the same file twice and requires keeping two call sites in sync.
**Suggestion:** Collapse to one call:
```js
flowState = loadFlowState(root);
if (requiresFlow && !flowState) {
  output(fail("flow", group, "NO_FLOW", "no active flow (flow.json not found)"));
  process.exit(EXIT_ERROR);
}
if (flowState) specId = specIdFromPath(flowState.spec);
```

---

**Verdict:** APPROVED
**Reason:** This is a genuine bug, not just a refactoring suggestion. `commands/review.js#main()` (line 189) accepts zero parameters, resolves its own `root` from `repoRoot()`, reads `process.argv` for args, calls `console.log`/`console.error` directly, and returns `undefined`. The caller in `run/review.js` (line 36) calls `await reviewExecute(ctx)` expecting a structured return value with `output` and `stderr` fields. Since `main()` returns `undefined`, `stdout` will always be `""`, all regex parsing will fail, and the command will always route to `"finalize"`. This breaks the review workflow. The suggestion to either restore the subprocess call or refactor `main()` to accept `ctx` is correct and necessary.

### [x] 4. Broken integration: `run/review.js` calls `commands/review.js#main` which ignores `ctx` and returns nothing
**File:** `src/flow/run/review.js`
**Issue:** The refactored file imports `main as reviewExecute` from `commands/review.js` and calls `await reviewExecute(ctx)`. However, `commands/review.js#main()` (a) accepts no parameters — it resolves its own context from `process.argv` and `import.meta.url`; (b) calls `console.log`/`process.exit` directly; and (c) returns `undefined`. Consequently `stdout` and `stderr` are always `""`, all regex parses for `proposalCount`, `approved`, `rejected`, and `reviewPathMatch` will return `null` (evaluating to `0`/`null`), and `noChanges`/`noProposals` rely on `stdout` being empty, which biases every call toward the `"finalize"` branch.
**Suggestion:** Either (a) restore the prior `runSync("node", [scriptPath, ...args])` subprocess call that correctly captures stdout/stderr, or (b) refactor `commands/review.js#main` to accept a `ctx` and return a structured `{ output, stderr }` object before switching callers over.

---

**Verdict:** APPROVED
**Reason:** Confirmed at lines 27–42 of `context.js`: `searchEntries` compares `query.toLowerCase()` as a single string against each keyword. The diff shows `aiSearch` (which had `fallbackSearch` with space-split OR-matching) was removed and replaced with a direct `searchEntries` call at line 172. A query like `"auth login"` will look for keywords literally containing `"auth login"` — which will match nothing. The prior `fallbackSearch` split on whitespace and did OR-matching. This is a functional regression that degrades `--search` usability. The fix is straightforward and necessary.

### [ ] 5. `searchEntries` treats multi-word `--search` queries as a literal substring
**File:** `src/flow/get/context.js`
**Issue:** After removing `aiSearch`/`fallbackSearch`, the `--search` path now calls `searchEntries(allEntries, searchQuery)` directly. `searchEntries` compares `query.toLowerCase()` as a single string against each keyword — so `--search "auth login"` looks for keywords that literally contain `"auth login"`, returning zero results for any normal analysis. Previously the `fallbackSearch` function split the query on whitespace and performed OR-matching, which is what a CLI user naturally expects.
**Suggestion:** Either (a) adopt the existing `fallbackSearch` logic inside `searchEntries` (split on whitespace, OR-match), or (b) add a guard at the call site that splits the query and calls `searchEntries` once per term, deduplicating the union. The simplest path is to reuse the splitting logic that was already present in `fallbackSearch` before it was deleted.

---

**Verdict:** REJECTED
**Reason:** All `set/*` commands mutate `flow.json` (via `mutateFlowState`, `setIssue`, `addNote`, `updateStepStatus`, etc.). These operations inherently require an active flow — if `flow.json` doesn't exist, the lib helpers will throw with a file-not-found error anyway. The `requiresFlow: true` default in `resolveCtx` provides a consistent, user-friendly error message ("no active flow") before the command runs, which is better than letting each lib helper throw an opaque filesystem error. The claim that `set issue` or `set request` are "plausibly run before flow.json exists" is incorrect — these commands write into flow.json fields. The blanket gate is appropriate here and removing it would degrade error reporting without functional benefit.

### [ ] 6. `set/*` commands default `requiresFlow` to `true` but operate only on `ctx.root`
**File:** `src/flow/registry.js`
**Issue:** All `set/*` entries (step, request, issue, note, summary, req, metric, redo, auto) lack an explicit `requiresFlow` field, so they default to `true`. This causes `resolveCtx` to fail with `"NO_FLOW"` if `flow.json` does not exist. But several of these operations (e.g. `set issue`, `set request`) are plausibly run *before* flow.json is fully written. More importantly, each command itself checks `ctx.flowState` only when actually needed (e.g. `set/redo.js`), while the others simply mutate flow.json via lib helpers that open the file themselves. The blanket `requiresFlow: true` gate in `resolveCtx` would redundantly abort before the command even has a chance to provide a better error message.
**Suggestion:** Audit each `set/*` entry and set `requiresFlow: false` for those that don't need the pre-loaded flow state in `ctx` (most of them). Let the individual command or its lib helper emit the specific error if the file is missing.

**Verdict:** REJECTED
**Reason:** No verdict provided
