# Code Review Results

### 1. 1. Extract Bound Spec Resolver
**File:** `src/lib/flow-manager.js`  
**Issue:** `load`, `loadReadOnly`, and `pathFor` repeat the same `withSpecIdArgDefault(specId, this._boundSpecId)` pattern.  
**Suggestion:** Add a small private helper, e.g. `_resolveSpecIdArg(specId)`, and use it in all three methods. This keeps the bound-spec behavior centralized.

### 2. 2. Avoid Route Resolution Duplication In Commands
**File:** `src/flow/lib/set-request.js`  
**Issue:** Each `set-*` command now imports and calls `resolveCommandRouteOptions(ctx)` inline, repeating the same routing concern across command implementations.  
**Suggestion:** Consider adding a protected helper on `FlowCommand`, such as `this.routeOptions(ctx)`, that delegates to `resolveCommandRouteOptions(ctx)`. Then command classes can stay focused on command-specific validation and mutation.

### 3. 3. Avoid Route Resolution Duplication In Commands
**File:** `src/flow/lib/set-issue.js`  
**Issue:** Same route option resolution pattern is repeated here with `resolveCommandRouteOptions(ctx)`.  
**Suggestion:** Use the shared command-level helper proposed for `FlowCommand` so routing stays consistent across `set request`, `set issue`, `set note`, and `set metric`.

### 4. 4. Avoid Route Resolution Duplication In Commands
**File:** `src/flow/lib/set-note.js`  
**Issue:** The active-flow branch now repeats the command routing call, while preparing-flow routing remains separate. This makes the command carry two routing concepts inline.  
**Suggestion:** Use a shared `FlowCommand` helper for normal flow route options, leaving only the preparing-flow route resolution in this file.

### 5. 5. Avoid Route Resolution Duplication In Commands
**File:** `src/flow/lib/set-metric.js`  
**Issue:** `resolveCommandRouteOptions(ctx)` replaces the old helper call but preserves the same per-command routing boilerplate.  
**Suggestion:** Use a shared command helper so metric routing follows the same path as request, issue, and note without repeated imports.

### 6. 6. Rename Route Flag For Clarity
**File:** `src/lib/flow-store.js`  
**Issue:** In `appendMetric`, `hasRoute` mixes two concepts: explicit route options and a store-bound default spec ID. The name suggests only caller-supplied routing.  
**Suggestion:** Rename it to something like `hasResolvedRoute` or split it into `hasExplicitRoute` and `hasBoundSpecRoute` before combining. This makes the ambient-skip condition easier to reason about.
