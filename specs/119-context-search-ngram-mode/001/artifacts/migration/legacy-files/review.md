# Code Review Results

### [x] 1. Unused parameter in `ngramSearch`
**File:** `src/flow/get/context.js`
**Issue:** The `analysis` parameter in `ngramSearch` is documented as "unused, kept for API consistency" — this is a code smell. Carrying dead weight through a public API for "consistency" creates confusion and discourages callers from reasoning about what the function actually needs.
**Suggestion:** Remove the `analysis` parameter from `ngramSearch`. Update the `contextSearch` dispatcher to not pass it. If a uniform signature is truly needed for a future abstraction (e.g., a strategy pattern), introduce a thin adapter or a search-strategy interface at that point rather than pre-emptively polluting every function signature.

---

**Verdict:** APPROVED
**Reason:** The `analysis` parameter is explicitly documented as unused. Keeping dead parameters "for consistency" without an actual interface contract is a real code smell — it misleads callers and violates YAGNI. The codebase is alpha with an explicit policy of not writing backward-compat code, so removing it now is the right call. The only caller is `contextSearch`, so the change is contained.

### [x] 2. Config loading inside a hot search path
**File:** `src/flow/get/context.js`
**Issue:** `contextSearch` calls `loadConfig(root)` on every invocation, including when called in a loop or in rapid succession. Config is static for the lifetime of a command execution, so re-reading it per call is wasteful and buries a side-effectful I/O call inside what appears to be a pure dispatch function.
**Suggestion:** Resolve the search mode once in `execute()` (where `root` and config are already available) and pass the resolved `mode` string into `contextSearch`, or rename it to `dispatchSearch(mode, …)`. This keeps I/O at the boundary and makes the dispatcher a pure function.

```js
// In execute():
let config;
try { config = loadConfig(root); } catch (_e) { config = {}; }
const searchMode = config?.flow?.commands?.context?.search?.mode ?? "ngram";
const results = contextSearch(allEntries, analysis, searchQuery, root, searchMode);

// contextSearch signature:
function contextSearch(allEntries, analysis, query, root, mode = "ngram") { … }
```

---

**Verdict:** APPROVED
**Reason:** `contextSearch` performs synchronous `loadConfig(root)` (file I/O) on every call, yet config is immutable for the duration of a command. `execute()` already has access to `root` and is the natural boundary for I/O. Hoisting mode resolution to the caller makes `contextSearch` a pure dispatcher, improving testability and eliminating redundant I/O. The suggested signature change is clean and non-breaking since `contextSearch` is not exported.

### [x] 3. Dice coefficient counts duplicate bigrams asymmetrically
**File:** `src/flow/get/context.js`
**Issue:** `bigramSimilarity` converts only `b` to a `Set`, so duplicate bigrams in `a` are each counted separately while duplicates in `b` are collapsed. This produces inconsistent scores depending on argument order (i.e., `bigramSimilarity(a, b) !== bigramSimilarity(b, a)` when duplicates exist), which is incorrect for a symmetric coefficient.
**Suggestion:** Either use multisets (count occurrences) for a true Dice coefficient, or deduplicate both sides consistently:

```js
function bigramSimilarity(a, b) {
  if (a.length === 0 || b.length === 0) return 0.0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const bg of setA) {
    if (setB.has(bg)) intersection++;
  }
  return (2 * intersection) / (setA.size + setB.size);
}
```

---

**Verdict:** APPROVED
**Reason:** This is a genuine correctness bug. `bigramSimilarity(a, b)` iterates raw array `a` (with duplicates counted) but deduplicates `b` via `Set`. This means `bigramSimilarity(x, y) !== bigramSimilarity(y, x)`, which violates the mathematical definition of Dice coefficient (a symmetric measure). The fix — deduplicating both sides with `Set` — is simple, correct, and won't degrade search quality (it makes scores consistent regardless of argument order).

### [ ] 4. Magic constant `NGRAM_THRESHOLD` should be co-located with config or named more descriptively
**File:** `src/flow/get/context.js`
**Issue:** `NGRAM_THRESHOLD = 0.15` is a module-level magic constant with no explanation of why `0.15` was chosen. It cannot be overridden by project config, even though `flow.commands.context.search.mode` is already config-driven.
**Suggestion:** Either document the tuning rationale in a comment, or expose it as an optional config key (e.g., `flow.commands.context.search.threshold`) alongside the mode — and add it to `validateConfig` in `types.js` with a numeric range check. At minimum, add a comment:

```js
// Minimum Dice coefficient to include an entry; tuned against test corpus.
const NGRAM_THRESHOLD = 0.15;
```

---

**Verdict:** REJECTED
**Reason:** Adding a comment documenting tuning rationale is fine and trivially worth doing, but the proposal to expose it as a config key (`flow.commands.context.search.threshold`) with validation in `types.js` is premature. The search mode config was just introduced; adding a numeric threshold knob that no user has requested creates unnecessary API surface in an alpha product. A one-line comment is sufficient for now — that doesn't warrant a formal proposal.

### [x] 5. Silent swallow of ngram errors hides bugs
**File:** `src/flow/get/context.js`
**Issue:** The `try/catch` around `ngramSearch` in `contextSearch` swallows errors and continues with `fallbackSearch`. Since `ngramSearch` is pure (no I/O), the only errors that could occur are programmer mistakes (e.g., type errors). Silently degrading hides real bugs.
**Suggestion:** Remove the try/catch. If `ngramSearch` throws it should propagate so the bug is visible. Reserve error suppression for genuinely fallible operations (I/O, network):

```js
results = ngramSearch(allEntries, query);  // let errors surface
```

---

**Verdict:** APPROVED
**Reason:** `ngramSearch` is a pure function operating on in-memory arrays — the only possible errors are programmer bugs (TypeError, ReferenceError, etc.). Swallowing these and silently falling back to `fallbackSearch` masks real defects. The try/catch pattern is appropriate for I/O or external calls, not for pure computation. Removing it lets bugs surface immediately during development rather than hiding behind degraded behavior.

### [x] 6. Duplicated entry-shape projection in `ngramSearch` vs existing `filterEntry`
**File:** `src/flow/get/context.js`
**Issue:** `ngramSearch` manually projects entry fields (`file`, `summary`, `detail`, `keywords`, `chapter`, `role`) using an inline object literal. The file already exports `filterEntry` which performs the same filtering role, and `aiSearch` delegates to it. This is duplicated logic that will diverge silently if fields are added.
**Suggestion:** Apply `filterEntry` (or a shared projection helper) in `ngramSearch` the same way `aiSearch` does, so all search strategies return consistently shaped results:

```js
return scored.map(({ entry }) => filterEntry(entry));
```

**Verdict:** APPROVED
**Reason:** `ngramSearch` manually projects `{file, summary, detail, keywords, chapter, role}` while `filterEntry` already exists and is used by `aiSearch` for the same purpose. The manual projection will silently diverge when fields are added or renamed. Using `filterEntry` in `ngramSearch` (as `aiSearch` already does) eliminates duplication and ensures all search strategies return consistently shaped results. The fix is a one-line change (`return scored.map(({ entry }) => filterEntry(entry))`) with no behavioral risk.
