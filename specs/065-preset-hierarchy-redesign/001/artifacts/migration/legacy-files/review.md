# Code Review Results

### [x] 1. ### 1. Extract preset-chain fallback logic
**File:** `src/docs/commands/scan.js`, `src/docs/lib/resolver-factory.js`, `src/docs/lib/template-merger.js`, `src/lib/presets.js`  
**Issue:** The same `resolveChain(...)` + `catch` fallback pattern is duplicated in three places, with slightly different comments and edge-case handling. That makes future hierarchy changes harder to apply consistently.  
**Suggestion:** Add a single helper in `src/lib/presets.js` such as `resolveChainSafe(typeOrLeaf)` or `resolvePresetLayers(typePath)` that encapsulates the fallback behavior, base injection, and deduplication. Replace the three local implementations with that shared helper.

2. ### 2. Rename `isArch` to match its new meaning
**File:** `src/lib/presets.js`  
**Issue:** `isArch` no longer means only “architecture-layer preset”. The new logic also marks lang-layer presets and other root-level structural presets as `true`, so the name is now misleading.  
**Suggestion:** Rename it to something like `isStructuralPreset`, `isRootLayer`, or `isTopLevelPreset`, and update comments accordingly. That will make filtering and future maintenance much clearer.

3. ### 3. Remove dead first pass in `printTree`
**File:** `src/presets-cmd.js`  
**Issue:** `printTree()` builds `childrenMap` in two loops, but the first loop has an empty conditional body and does not add any children. It is effectively dead code.  
**Suggestion:** Delete the first loop and keep only the second loop that actually populates `childrenMap`.

4. ### 4. Centralize type-path derivation for variable-depth hierarchies
**File:** `src/lib/presets.js`  
**Issue:** `type` is derived as `${parent}/${d.name}` for non-root presets, which only captures one parent level. That conflicts with the stated move to “variable-length inheritance chains” and will become inconsistent if deeper structural chains are added.  
**Suggestion:** Compute the canonical type path from the resolved ancestor chain instead of only `parent`. A helper like `buildTypePath(preset)` based on `resolveChain()` would keep the model consistent with the new hierarchy design.

5. ### 5. Normalize i18n initialization pattern
**File:** `src/presets-cmd.js`  
**Issue:** The help path now initializes i18n differently from the rest of the CLI (`createI18n` + `loadLang` + `repoRoot` instead of the existing higher-level translation entrypoints). That introduces another pattern for doing the same job.  
**Suggestion:** Reuse the project’s standard i18n bootstrap path, or extract a small shared helper for CLI help commands so all command modules resolve language and translation objects the same way.

6. ### 6. Extract monorepo gating into a dedicated guard
**File:** `src/docs.js`  
**Issue:** The new monorepo early-exit is embedded directly in the `build` branch with hard-coded console output. If other docs commands need similar gating, this will spread conditionals and repeated messages.  
**Suggestion:** Move this into a small helper such as `assertDocsBuildSupported(baseCtx)` or `handleUnsupportedMonorepoBuild(baseCtx)` so the policy and messaging live in one place and the command flow stays simpler.

**Verdict:** APPROVED
**Reason:** The diff clearly shows the same `resolveChain(leaf)` + `try/catch` fallback pattern duplicated in `scan.js`, `resolver-factory.js`, and `template-merger.js` (twice — in `buildLayers` and `resolveChaptersOrder`). Each copy has slightly different fallback behavior (e.g., different dedup strategies, different base-injection logic). Centralizing into a `resolveChainSafe()` helper in `presets.js` would eliminate meaningful duplication and reduce the risk of inconsistent fallback behavior across call sites. This is a real DRY improvement, not cosmetic.
