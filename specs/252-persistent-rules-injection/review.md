# Code Review Results

### 1. 1. Keep First Principle Within Sentence Limit
**File:** `CLAUDE.md`  
**Issue:** The body under `### 一貫したコミュニケーション` has 4 sentences, but R14 requires each sub-heading to be followed by 1-3 sentences.  
**Suggestion:** Combine or remove one sentence so the body has at most 3 sentences, while preserving the same principles. For example, merge the final two sentences into one.

### 2. 1. Remove the unused adapter argument
**File:** `src/docs/commands/agents.js`  
**Issue:** `resolveFn` still accepts the fourth `a` argument and `resolveAgentsDirectives` still passes a dummy `{}`, but `runAgents` ignores that parameter and closes over `analysis` directly. This keeps dead adapter shape around while adding the new `params` argument.  
**Suggestion:** Simplify both wrappers to match the actual needed contract:

```js
(preset, source, method, labels, params) =>
  resolveFn(preset, source, method, labels, params)
```

and:

```js
const resolveFn = (preset, source, method, labels, params) =>
  resolver.resolve(preset, source, method, analysis, labels, params);
```

### 3. I’ll review the touched file in context so the proposals stay limited to the actual diff surface and don’t drift into unrelated modules.The supplied diff is enough for review, but the workspace path doesn’t contain `src/docs/commands/data.js` directly, so I’ll keep the review grounded in the provided diff only.### 1. Rename `params` to a domain-specific name
**File:** `src/docs/commands/data.js`  
**Issue:** `params` is ambiguous in this command file because it can be confused with CLI args or generic function parameters, while the requirement describes directive option objects.  
**Suggestion:** Rename the newly threaded argument to `directiveOptions` or `options` across the local callbacks, e.g. `(preset, source, method, labels, directiveOptions) => ...`.

### 4. 2. Reduce repeated resolver forwarding signatures
**File:** `src/docs/commands/data.js`  
**Issue:** The same long positional resolver signature is now repeated in multiple wrapper callbacks, increasing the chance that future resolver arguments are accidentally dropped at one layer.  
**Suggestion:** Extract a small local adapter/helper for forwarding resolver calls with `analysis`, or use a named wrapper so the signature is centralized instead of repeated in `processTemplate`, `resolveFn`, and `wrappedResolveFn`.

### 5. I’ll check the touched file around the resolver path so the proposals are grounded in the local naming and call patterns, while keeping the review limited to the diff file.The provided path is not present under the current `.tmp` directory, so I’ll base the review on the supplied diff only and keep the scope to `src/docs/commands/forge.js`.### 1. Rename `params` to match directive terminology
**File:** `src/docs/commands/forge.js`  
**Issue:** The new argument is named `params`, but the requirement describes forwarding directive option objects. If surrounding resolver/DataSource code uses `options`, `directiveOptions`, or similar, `params` makes this callback signature less self-explanatory.  
**Suggestion:** Rename the callback parameter to `options` or `directiveOptions` and forward that name unchanged:

```js
resolveFn = (preset, source, method, analysis, labels, options) =>
  resolver.resolve(preset, source, method, analysis, labels, options);
```

### 6. I’ll check the touched file around this call site so the proposals stay grounded in the local naming and patterns.The provided cwd appears to be the flow temp directory, and the source path is not present there. I’ll locate the repository root from the current workspace before reviewing the local context.I have the changed call site now. I’m checking the resolver callback convention nearby so any naming recommendation reflects the rest of the implementation rather than just the snippet.### 1. Avoid Repeating README Path Resolution
**File:** `src/docs/commands/readme.js`
**Issue:** `ctx.output ? path.resolve(root, ctx.output) : ...` is evaluated twice via `readmeOutputPath` and `readmePath`, which makes the path setup harder to scan.
**Suggestion:** Define `readmePath` once before `resolverDocsDir`, then derive both `resolverDocsDir` and `readmeRelPath` from it.

### 7. 2. Collapse Duplicate Resolver Calls
**File:** `src/docs/commands/readme.js`
**Issue:** The callback now calls `resolveFn(..., params)` in both branches. Future resolver signature changes could require updating both paths again.
**Suggestion:** Compute `resolvedLabels` first, then make a single `return resolveFn(preset, source, method, {}, resolvedLabels, params);`.

### 8. 1. Restore the detached JSDoc
**File:** `src/docs/lib/directive-parser.js`  
**Issue:** The JSDoc for `buildDataFields()` is now separated from the function by `PARSER_OWNED_OPTION_KEYS`, so it no longer documents the intended function cleanly.  
**Suggestion:** Move `PARSER_OWNED_OPTION_KEYS` above the JSDoc, or move the JSDoc back immediately before `buildDataFields()`.

### 9. 2. Rename forwarded params helpers for clarity
**File:** `src/docs/lib/directive-parser.js`  
**Issue:** `extractUserParams()` and `userParams` are vague names. These params are specifically the directive options forwarded to the DataSource layer.  
**Suggestion:** Rename them to something like `extractDataSourceParams()` and `dataSourceParams` to match R23’s contract.

### 10. 3. Simplify marker stripping loop state
**File:** `src/docs/lib/directive-parser.js`  
**Issue:** `stripDataMarkers()` uses `depth`, but nested opens immediately throw, so depth never really models nesting. This makes the loop more complex than the behavior requires.  
**Suggestion:** Replace `depth` with a simple `foundClose` boolean, or scan until the first close marker and throw on nested opens. Also make `body` a `const`.

### 11. 4. Add an explicit processing bound for marker stripping
**File:** `src/docs/lib/directive-parser.js`  
**Issue:** `stripDataMarkers()` splits and scans arbitrary-sized content without an explicit size or line-count bound, which conflicts with the bounded-resource-usage guardrail for bulk processing.  
**Suggestion:** Add a module-level maximum input size or maximum line count, and throw a clear error when exceeded.

### 12. I’ll inspect the touched file context so the proposals stay constrained to the diff file and match the existing resolver patterns.The provided cwd is the flow temp directory, and the source tree is one level up from here. I’ll stay inside the worktree and read the file via the parent path.### 1. Update Factory Return JSDoc Signature
**File:** `src/docs/lib/resolver-factory.js`  
**Issue:** The `createResolver` JSDoc return type still documents `resolve` as accepting only `(preset, source, method, analysis, labels)`, but the implementation now accepts `params` as a sixth argument.  
**Suggestion:** Update the `@returns` function signature to include `params?: Object` so the public resolver contract is documented consistently.

### 13. 2. Give Optional Params a Default
**File:** `src/docs/lib/resolver-factory.js`  
**Issue:** `params` is documented as optional but is forwarded as-is, meaning DataSource methods that expect an options object must handle `undefined` themselves.  
**Suggestion:** Change the signature to `resolve(preset, source, method, analysis, labels, params = {})` to make the resolver contract concrete and keep option-consuming DataSource methods simpler.

### 14. 1. Remove no-op error handling
**File:** `src/flow/lib/get-next-action.js`
**Issue:** `getRulesCached()` catches `loadRules()` errors only to rethrow the same error. The comment adds policy context, but the code path itself is dead weight.
**Suggestion:** Remove the `try/catch` and assign `_cachedRules = loadRules();` directly. If context is needed, keep it as a short comment above the call.

### 15. 2. Align `deriveStateSet` name with its return type
**File:** `src/flow/lib/get-next-action.js`
**Issue:** `deriveStateSet()` returns an array, not a `Set`. The name suggests set semantics and can mislead future callers about uniqueness or available methods.
**Suggestion:** Rename it to `deriveStateValues()` or return an actual `Set` if `filterRules()` supports that contract.

### 16. 3. Avoid stale module-level rule cache
**File:** `src/flow/lib/get-next-action.js`
**Issue:** `_cachedRules` introduces hidden process-global state. In long-lived processes or tests that modify `rules.json`, `flow get next-action` may inject stale rules.
**Suggestion:** Prefer loading rules inside `injectPersistentRules()` per command execution, or add an explicit cache invalidation strategy tied to the rules file mtime.

### 17. 4. Add explicit bounds for rule injection
**File:** `src/flow/lib/get-next-action.js`
**Issue:** `injectPersistentRules()` loads, filters, and renders all matching rules without an explicit bound on rule count or rendered content size, which conflicts with the `bounded-resource-usage` guardrail.
**Suggestion:** Define clear limits near the injection boundary, such as maximum rule count and maximum rendered block size, and fail with a deterministic error when exceeded.

### 18. 1. Bound pre-expansion memory usage
**File:** `src/lib/skills.js`  
**Issue:** Phase 1 now reads, includes, expands, strips, and stores every skill output in `planned` with no explicit bound on skill count or content size. This violates the bounded-resource guardrail for bulk data loading.  
**Suggestion:** Add explicit limits, for example max skill directories and max expanded skill byte size, and fail before writing if exceeded.

### 19. 2. Extract duplicated target handling
**File:** `src/lib/skills.js`  
**Issue:** The `.agents` and `.claude` paths now duplicate the same “check existing content” and “write if needed” logic.  
**Suggestion:** Build a target list and use shared helpers such as `needsSkillUpdate(dest, finalContent)` and `writeSkillTarget(dest, finalContent)`.

### 20. 3. Remove unused planned metadata
**File:** `src/lib/skills.js`  
**Issue:** `planned.push({ name, srcPath, finalContent })` stores `srcPath`, but Phase 2 never uses it.  
**Suggestion:** Remove `srcPath` from the planned object, or use it intentionally in error context if diagnostics are needed.

### 21. 4. Rename `_ruleCache`
**File:** `src/lib/skills.js`  
**Issue:** `_ruleCache` looks like a private or temporary escape hatch in a public options object, which makes the deploy API less clear.  
**Suggestion:** Rename it to `rules` or `ruleSet`, or keep it out of the public-shaped options object by loading rules in a higher-level coordinator and passing them to an internal helper.

### 22. 1. Remove accidental field-name wording from `body`
**File:** `src/presets/base/guardrail.json`  
**Issue:** The new `body` ends with: `text indicates a code-quality concern...`, which reads like accidental prompt/template residue and makes the guardrail text confusing.  
**Suggestion:** Remove that sentence or rewrite it as normal policy text.

### 23. 2. Avoid duplicating the same guardrail text
**File:** `src/presets/base/guardrail.json`  
**Issue:** `body` and `text` contain nearly identical content, creating drift risk when the guardrail is edited later.  
**Suggestion:** Keep one canonical field if the schema allows it. If both are required, make their roles distinct and consistent with existing guardrail entries.

### 24. 1. Remove inline rule-body duplication
**File:** `src/templates/partials/worktree-mode.md`  
**Issue:** The new `base.skills.rule` directive is added while the existing MUST rule prose remains inline. Per R22, source partials should retain only non-rule prose plus directive placeholders, so this risks duplicated deployed guidance and keeps rule bodies in the source partial.  
**Suggestion:** Move the existing worktree-mode MUST bullets into the appropriate `rules.json` rule body/bodies and leave this partial as the short context intro plus directive placeholders only.

### 25. I’ll inspect the touched test and the imported helper behavior so the proposals are grounded in how this rendering path actually works.The provided cwd is a temporary workspace directory without the repo files at those relative paths, so I’m going to base the review on the supplied diff rather than local file reads.### 1. Hoist rule loading out of the loop
**File:** `tests/e2e/051-skill-namespace.test.js`  
**Issue:** `loadRules()` is called once per skill template, causing repeated filesystem/config loading for data that should be stable during the test.  
**Suggestion:** Load rules once before iterating templates:

```js
const rules = loadRules();
...
const expandedContent = expandSkillRulesDirectives(includedContent, rules);
```

### 26. 2. Rename final rendered content variable
**File:** `tests/e2e/051-skill-namespace.test.js`  
**Issue:** `templateContent` now represents the fully deployed rendering path, not just template content. The name is stale after adding rule expansion and marker stripping.  
**Suggestion:** Rename it to something like `expectedSkillContent` or `renderedTemplateContent`.

### 27. 3. Extract the expected rendering path into a helper
**File:** `tests/e2e/051-skill-namespace.test.js`  
**Issue:** The deploy-equivalent rendering sequence is embedded inline in the assertion loop, making future deploy pipeline changes easier to miss.  
**Suggestion:** Add a local helper such as `renderExpectedSkillContent(rawContent, templateFile, skillDir, rules)` that performs include resolution, skill-rule expansion, and marker stripping in one named place.

### 28. 1. Assert the rule-prefix behavior explicitly
**File:** `tests/unit/flow/get-next-action.test.js`  
**Issue:** The updated assertion only checks `ins.content.endsWith(onDisk)`, so the test would still pass if rule injection stopped happening entirely and `ins.content === onDisk`. For a matching phase/state case, that weakens coverage of the intended behavior.  
**Suggestion:** Add an assertion that the returned content is longer than `onDisk`, or otherwise verify the expected injected prefix exists before the suffix assertion.

### 29. 2. Reduce duplicated explanation in test name and comment
**File:** `tests/unit/flow/get-next-action.test.js`  
**Issue:** The test title and inline comment both explain that rules may be prepended and the prompt remains the suffix. This makes the test a little noisy without adding distinct information.  
**Suggestion:** Keep the intent in the test name and remove or shorten the comment, for example only noting the key invariant: `// Injected rules are prepended; the resolved prompt remains the suffix.`

### 30. 1. Standardize Directive Options Naming
**File:** `src/docs/lib/resolver-factory.js`  
**Issue:** The new forwarded resolver argument is called `params` in several command files, `userParams` in `directive-parser.js`, and `_ruleCache`/options-like names elsewhere. This makes the resolver/DataSource interface unclear across files.  
**Suggestion:** Pick one contract name, preferably `directiveOptions`, and use it consistently in `resolver-factory.js`, `directive-parser.js`, and all `src/docs/commands/*.js` callbacks.

### 31. 2. Centralize Resolver Forwarding Shape
**File:** `src/docs/commands/data.js`  
**Issue:** Multiple command files now repeat long positional resolver forwarding callbacks, and some wrappers still preserve stale adapter arguments. This increases the chance that future resolver arguments drift between files.  
**Suggestion:** Introduce one small shared forwarding helper or normalize all callbacks to the same resolver signature: `(preset, source, method, analysis, labels, directiveOptions)`.

### 32. 3. Unify Persistent Rule Loading Strategy
**File:** `src/flow/lib/get-next-action.js`  
**Issue:** Rule loading/caching is introduced in multiple places with inconsistent shapes: `_cachedRules` in flow logic, `_ruleCache` in skills deployment, and repeated `loadRules()` calls in tests. This creates stale-cache and naming drift risk.  
**Suggestion:** Use a single explicit pattern: load rules once at the command/deploy boundary, pass `rules` or `ruleSet` into lower-level helpers, and avoid hidden module-level caches unless they have invalidation.

### 33. 4. Avoid Duplicated Rule Rendering Pipelines
**File:** `src/lib/skills.js`  
**Issue:** Skill rendering now appears to involve include expansion, rule directive expansion, and marker stripping, while the e2e test recreates that same sequence manually. Pipeline changes can drift between production and tests.  
**Suggestion:** Extract the deploy rendering sequence into a named helper and have both deployment code and tests call that helper, with tests asserting behavior around it rather than duplicating every step inline.

### 34. 5. Consolidate Bounded Resource Limits
**File:** `src/docs/lib/directive-parser.js`  
**Issue:** Several files introduce bulk processing without explicit limits: directive marker stripping, persistent rule injection, and skill expansion. If each file adds its own ad hoc limit later, behavior and error messages will diverge.  
**Suggestion:** Define shared limit constants or a small shared guard helper for generated directive/rule content size, then reuse it in directive parsing, rule injection, and skill deployment.
