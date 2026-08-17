# Code Review Results

### [x] 1. ### 1. Extract Language-Preset Resolution
**File:** `src/docs/lib/template-merger.js`  
**Issue:** `typePath.split("/").pop()` and `resolveLangPreset(...)` are repeated in both `buildLayers()` and `resolveChaptersOrder()`. This duplicates lookup logic and makes future changes to preset resolution easy to miss in one of the call sites.  
**Suggestion:** Introduce a small helper such as `getLanguageAxisPreset(typePath)` and reuse it in both functions. That keeps the resolution rule in one place and simplifies both methods.

2. ### 2. Clarify `langPreset` Naming
**File:** `src/docs/lib/template-merger.js`  
**Issue:** `langPreset` is easy to confuse with the `lang` argument, but it actually represents a preset on the `"lang"` axis, not the current locale itself. In this file both concepts are now used together, so the naming is ambiguous.  
**Suggestion:** Rename the local variable to something more explicit like `languageAxisPreset` or `runtimePreset`. If possible, align the imported API name as well for consistency.

3. ### 3. Remove Hardcoded Chapter Placement Rule
**File:** `src/docs/lib/template-merger.js`  
**Issue:** `resolveChaptersOrder()` now contains a special-case rule that inserts language-axis chapters immediately after `overview.md`. This is a hidden policy embedded in merger logic, while other chapter ordering rules live declaratively in `preset.json`. That makes the design less consistent and harder to extend for other preset axes.  
**Suggestion:** Move placement policy into preset metadata, for example with an insertion hint like `"insertAfter": "overview.md"` or an explicit merge strategy. Then `resolveChaptersOrder()` can apply a generic rule instead of knowing about `overview.md`.

4. ### 4. Consolidate Compatibility Skill Links
**File:** `.claude/skills/sdd-forge.flow-impl/SKILL.md`  
**Issue:** The four `.claude/skills/.../SKILL.md` entries are now thin compatibility symlinks to `.agents/skills/...`. That removes duplicated content, but the compatibility layer itself is still duplicated file-by-file and depends on repeated relative paths.  
**Suggestion:** If `.claude/skills` must remain supported, generate these links from a small setup script or keep a single compatibility mapping mechanism instead of maintaining one symlink per skill manually. This reduces maintenance overhead and avoids path drift across files.

**Verdict:** APPROVED
**Reason:** The duplication is real — both `buildLayers()` (line 51-52) and `resolveChaptersOrder()` (line 274-275) perform identical `typePath.split("/").pop()` + `resolveLangPreset(leaf)` sequences. A small helper like `getLanguageAxisPreset(typePath)` would genuinely reduce the risk of these two call sites diverging when the resolution logic changes. This is a low-risk structural improvement.
