# Code Review Results

### [ ] 1. Extract the repeated monorepo directive into a shared template mechanism
**File:** `src/presets/base/templates/{en,ja}/{development,overview,project_structure,stack_and_ops}.md`  
**Issue:** The same `<!-- {{data[ignoreError=true]: monorepo.monorepo.apps(...)}} -->` block is duplicated across 8 templates. That increases maintenance cost and makes future directive changes easy to miss in one language or chapter.  
**Suggestion:** Move this into a shared base block/partial if the template system supports it, or introduce a single reusable template fragment for the monorepo app section. If reuse is not available, at least centralize the chapter-to-directive mapping so the templates only reference one shared construct.

**Verdict:** REJECTED
**Reason:** The template system uses `{{data}}` and `{{text}}` directives with a design philosophy that explicitly values **structural stability** — "AI writes within the frame and does not change paragraph structure." Templates are intentionally self-contained per-chapter, per-language. Introducing a partial/include mechanism is a significant architectural addition that doesn't exist today, and the "duplication" is only 8 identical 2-line blocks. The maintenance cost is low and the risk of introducing a new abstraction layer (partials) into the template engine outweighs the benefit. Furthermore, a "centralized chapter-to-directive mapping" would violate the principle that templates define their own structure.

### [x] 2. Rename `parseTextFillParams` to reflect its broader responsibility
**File:** `src/docs/lib/directive-parser.js`  
**Issue:** `parseTextFillParams()` now parses both `text[...]` and `data[...]` parameters, so the name is no longer accurate. That makes the parser harder to understand and creates a mismatch between behavior and naming.  
**Suggestion:** Rename it to something neutral such as `parseDirectiveParams` and update call sites. This keeps the naming aligned with the actual abstraction.

**Verdict:** APPROVED
**Reason:** The function now parses parameters for both `text[...]` and `data[...]` directives (the diff shows it being called with `dataMatch[1]` and inline `m[1]`). The name `parseTextFillParams` is actively misleading. Renaming to `parseDirectiveParams` is a low-risk, high-clarity improvement — it's a pure rename with no behavioral change, and the function is internal to `directive-parser.js`.

### [x] 3. Remove regex duplication by centralizing data-directive parsing
**File:** `src/docs/lib/directive-parser.js`  
**Issue:** The data-directive syntax is now encoded in three places: `DATA_RE`, `INLINE_DATA_RE`, and the inline `openTag` regex inside `resolveDataDirectives()`. These patterns must stay perfectly aligned, and the recent capture-index shifts already show how fragile that is.  
**Suggestion:** Build the data-directive pattern from shared fragments or add a small helper that parses and reconstructs opening tags. That eliminates duplicated syntax definitions and reduces the risk of subtle parser drift.

**Verdict:** APPROVED
**Reason:** The diff concretely demonstrates the fragility: `DATA_RE`, `INLINE_DATA_RE`, and the inline `openTag` regex inside `resolveDataDirectives()` all had to be updated in lockstep to add the `(?:\[([^\]]*)\])?` group, with corresponding capture-index shifts from `[1]-[4]` to `[2]-[5]`. Three co-dependent regex patterns with aligned capture groups is a real maintenance hazard. Building patterns from shared fragments or extracting a parse helper would reduce the surface area for parser drift bugs.

### [x] 4. Extract directive-removal logic for the new `ignoreError` path
**File:** `src/docs/lib/directive-parser.js`  
**Issue:** The `ignoreError=true` branch in `resolveDataDirectives()` duplicates line-removal behavior that already exists in the unresolved-data handling path. The control flow now has two places that know how to remove inline/block directives.  
**Suggestion:** Introduce a helper such as `removeDirective(lines, directive)` and use it for both silent-ignore and unresolved cases. This simplifies the function and keeps directive replacement behavior consistent.

**Verdict:** APPROVED
**Reason:** The diff shows near-identical removal logic in two places within `resolveDataDirectives()`: the new `ignoreError=true` branch (lines 342-348) performs inline `replace(d.raw, "")` or `splice(d.line, ...)`, and the existing unresolved handler below it does the same pattern. Extracting a `removeDirective()` helper eliminates this duplication and ensures both paths stay consistent if removal semantics change (e.g., whitespace cleanup).

### [ ] 5. Make the prompt option API less generic until there are multiple options
**File:** `src/docs/commands/enrich.js`  
**Issue:** `buildEnrichPrompt(chapters, batchEntries, opts)` currently accepts a generic `opts` object but only reads `opts.monorepoApps`. That adds indirection without much value and makes the function signature look more extensible than it really is.  
**Suggestion:** Either pass `monorepoApps` directly as the third argument, or commit to an options-pattern consistently by documenting the options object and using a clearer name such as `promptOptions`.

**Verdict:** REJECTED
**Reason:** The `opts` pattern is a standard, well-understood JavaScript convention for extensible function signatures. The function was *just* extended from zero options to one (`monorepoApps`), and in a project actively adding monorepo support, more prompt options are likely imminent. Passing `monorepoApps` as a bare third positional argument would require another signature change as soon as a second option is added. The current `opts` pattern is pragmatic and idiomatic — this proposal is cosmetic and would create unnecessary churn.
