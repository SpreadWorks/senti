# Code Review Results

### [x] 1. Duplicated `loadFlowState` + `derivePhase` pattern in registry hooks
**File:** `src/flow/registry.js`
**Issue:** The `context` post hook and the `redo` post hook both repeat the same two-line pattern of loading flow state and deriving the phase. If a third hook needs this pattern, the duplication will grow further.
**Suggestion:** Extract a small helper in `registry.js`:

```js
function deriveActivePhase(root) {
  const state = loadFlowState(root);
  return derivePhase(state?.steps);
}
```

Then call `deriveActivePhase(ctx.root)` in each hook, removing the repeated two-liner.

---

**Verdict:** APPROVED
**Reason:** The two-liner (`loadFlowState` → `derivePhase`) is repeated identically in `context.post` (line 77-78) and `redo.post` (line 124-125). Extracting `deriveActivePhase(root)` is a straightforward DRY improvement with zero behavioral risk. It also future-proofs against the likely addition of more metric-recording hooks.

### [ ] 2. Asymmetric hook naming: `finally` shadows `Function.prototype.finally`
**File:** `src/flow/registry.js`, `src/flow.js`
**Issue:** Using `finally` as a property key in the registry entry object and checking `entry.finally` in `runEntry` is legal JavaScript but misleading — `finally` is a reserved word in statement position and clashes conceptually with `Promise.prototype.finally`. This creates confusion when reading `if (entry.finally) entry.finally(ctx)`.
**Suggestion:** Rename the hook to `cleanup` (or `fin`) to avoid the reserved-word collision and improve readability:

```js
// registry entry
cleanup(ctx) { ... }

// flow.js runEntry
} finally {
  if (entry.cleanup) entry.cleanup(ctx);
}
```

---

**Verdict:** REJECTED
**Reason:** `finally` as a property key on a plain object is perfectly legal and idiomatic JavaScript — it does not shadow anything. The code `entry.finally` is unambiguous; there is no prototype chain conflict since registry entries are plain objects. Renaming to `cleanup` is a cosmetic preference that would touch both `registry.js` and `flow.js` for no functional benefit. The current naming (`pre`/`post`/`onError`/`finally`) mirrors the `try`/`catch`/`finally` structure intentionally and reads naturally.

### [ ] 3. Fragile result-shape detection in `context` post hook
**File:** `src/flow/registry.js`
**Issue:** The post hook distinguishes file mode vs. list/search mode by inspecting `result?.data?.type`, `result?.data?.entries`, and `result?.data?.total`. This couples the registry tightly to the internal shape of `context.js` response objects. A future refactor of those shapes would silently break metric recording with no error.
**Suggestion:** Have `context.js` include an explicit `_mode` field (e.g. `"file"`, `"list"`, `"search"`) in its `ok()` payload, and let the post hook key off that single field:

```js
// context.js
return ok("flow.get.context", { _mode: "file", type: isDocsPath ? "docs" : "src", content });

// registry.js post hook
const mode = result?.data?._mode;
if (mode === "file") { ... }
else if (mode === "list" || mode === "search") { ... }
```

---

**Verdict:** REJECTED
**Reason:** Adding a `_mode` field to `context.js` response payloads changes the public API envelope shape (consumers parse these JSON objects). The existing detection (`result?.data?.type` for file mode, `result?.data?.entries` / `result?.data?.total` for list/search) directly keys off fields that are inherently part of the response contract — if those fields change, the response itself is a breaking change regardless. Introducing `_mode` adds a second source of truth that must stay in sync with the actual payload structure, which is strictly worse. The coupling concern is valid but the proposed fix doesn't actually reduce it.

### [ ] 4. Dead blank line left after `incrementMetric` removal
**File:** `src/flow/get/context.js`
**Issue:** After removing `incrementMetric`, a stray blank line was left at the bottom of the deleted block (visible in the diff after the closing `}`). It is minor but inconsistent with the surrounding code style.
**Suggestion:** Remove the extra blank line so the file stays consistently formatted.

---

**Verdict:** REJECTED
**Reason:** Cosmetic-only. Looking at `context.js` line 212-213, there is one extra blank line before `export async function execute`. This has zero impact on behavior, readability, or maintainability. Not worth a dedicated change.

### [x] 5. `impl-confirm`, `lint`, `retro`, `sync` share identical step IDs that conflict
**File:** `src/flow/registry.js`
**Issue:** `impl-confirm`, `finalize`, and `retro` all use `stepPre("finalize")` / `stepPost("finalize")`, and `lint` uses `stepPre("implement")` / `stepPost("implement")`. This means running any of these commands independently will overwrite the status of steps they don't exclusively own. For example, running `lint` sets `implement` to `done`, even though lint is a sub-task of that phase.
**Suggestion:** Either (a) define distinct step IDs for each command, or (b) only assign `pre`/`post` hooks to commands that *exclusively own* a step, and leave sub-commands (lint, retro) without step-status hooks. Document this decision explicitly in a comment.

---

**Verdict:** APPROVED
**Reason:** This is a real behavioral concern. `lint` uses `stepPre("implement")` / `stepPost("implement")`, meaning running lint alone marks the entire `implement` step as `done` — even if implementation isn't complete. Similarly, `impl-confirm`, `finalize`, and `retro` all compete for the `finalize` step status. Running `retro` (a retrospective) would set `finalize` to `done`, which is semantically wrong if finalize hasn't actually completed. This can corrupt flow state and mislead the skill instructions that rely on step status. At minimum, sub-commands like `lint` and `retro` should not own step transitions they don't exclusively control.

### [ ] 6. `--request` value not validated / sanitised before being written to `flow.json`
**File:** `src/flow/run/prepare-spec.js`
**Issue:** `cli.request` is written directly into `flow.json` with `...(cli.request ? { request: cli.request } : {})`. No length limit or sanitisation is applied. A very long `--request` string, or one containing newlines, could corrupt the JSON readability or exceed shell-argument limits when the skill passes it via `--request "..."`.
**Suggestion:** Trim the value and optionally truncate it to a reasonable maximum (e.g. 2 000 characters) with a warning, consistent with how other text fields are handled in the codebase.

**Verdict:** REJECTED
**Reason:** The codebase explicitly follows the design principle "don't write excessive defensive code — validate at system boundaries only." The `--request` value comes from a CLI argument passed by the skill (SKILL.md), which is a trusted internal interface. JSON.stringify handles newlines and special characters correctly, so flow.json won't be corrupted. Shell ARG_MAX is a concern of the caller, not of `prepare-spec.js`. Adding a 2000-char truncation would be an arbitrary limit that could silently discard user intent with no clear benefit.
