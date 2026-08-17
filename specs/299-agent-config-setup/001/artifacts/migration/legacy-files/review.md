# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. I’ll inspect the touched file around the new helper and related agent resolution paths so the proposals stay grounded in the actual code.The given path is not directly under the current directory, so I’m locating the repository layout first and then I’ll read the same touched file from its actual position.Only `logs` exists in the working directory, so I’m going up to the worktree root to verify whether the full source is available read-only.The repository source is available from the worktree root. I’ll read the relevant resolution and validation code now, then keep the review scoped to `src/lib/agent.js` as required.I found the changed helper is only used in this resolution path. I’m checking the defaults module briefly to avoid suggesting a change that would conflict with how those defaults are shaped.The defaults function deep-clones profile data each call, so there is one concrete simplification/performance issue in the touched file. I’ll also check the attempt construction to see whether the merged profiles are recomputed more often than necessary.### 1. Avoid Rebuilding And Copying All Profiles Per Resolution
**Failure mode:** refactor
**File:** src/lib/agent.js
**Issue:** **File:** `src/lib/agent.js`  
**Issue:** `resolveAgentProfiles()` calls `defaultAgentProfiles()` on every profile resolution, which deep-clones all built-in profiles, then spreads all user profiles. This is unnecessary when only `profileName` and possibly `default` are needed. It also leaves user profile processing unbounded, which conflicts with the bounded-resource guardrail.  
**Suggestion:** Replace the merged-map helper with targeted lookup logic, for example resolving `agentSection.profiles?.[profileName] ?? BUILT_IN_AGENT_PROFILES[profileName]` and resolving the fallback default profile the same way. Initialize `BUILT_IN_AGENT_PROFILES = defaultAgentProfiles()` once at module load.
**Suggestion:** **File:** `src/lib/agent.js`  
**Issue:** `resolveAgentProfiles()` calls `defaultAgentProfiles()` on every profile resolution, which deep-clones all built-in profiles, then spreads all user profiles. This is unnecessary when only `profileName` and possibly `default` are needed. It also leaves user profile processing unbounded, which conflicts with the bounded-resource guardrail.  
**Suggestion:** Replace the merged-map helper with targeted lookup logic, for example resolving `agentSection.profiles?.[profileName] ?? BUILT_IN_AGENT_PROFILES[profileName]` and resolving the fallback default profile the same way. Initialize `BUILT_IN_AGENT_PROFILES = defaultAgentProfiles()` once at module load.
**Rationale:** Loop review proposal.

### 2. 2. Remove Redundant Null Check
**Failure mode:** refactor
**File:** src/lib/agent.js
**Issue:** **File:** `src/lib/agent.js`  
**Issue:** `if (!profiles || !profiles[profileName])` includes a `!profiles` branch, but `resolveAgentProfiles()` always returns an object. This makes the condition noisier than the actual failure mode.  
**Suggestion:** After simplifying lookup, check only the selected profile value, e.g. `if (!profile)`. If keeping the helper, change the condition to `if (!profiles[profileName])`.
**Suggestion:** **File:** `src/lib/agent.js`  
**Issue:** `if (!profiles || !profiles[profileName])` includes a `!profiles` branch, but `resolveAgentProfiles()` always returns an object. This makes the condition noisier than the actual failure mode.  
**Suggestion:** After simplifying lookup, check only the selected profile value, e.g. `if (!profile)`. If keeping the helper, change the condition to `if (!profiles[profileName])`.
**Rationale:** Loop review proposal.

### 3. 3. Rename Helper To Match Behavior
**Failure mode:** refactor
**File:** src/lib/agent.js
**Issue:** **File:** `src/lib/agent.js`  
**Issue:** `resolveAgentProfiles()` sounds like it performs final profile resolution, but it only builds a merged profile map. That overlaps conceptually with `resolveProfileSelection()` and makes the resolution flow harder to scan.  
**Suggestion:** If the helper remains, rename it to something like `mergedAgentProfiles()` or `profileCatalogForAgent()`. If adopting targeted lookup, prefer `resolveAgentProfile(agentSection, profileName)` because that matches the actual responsibility.
**Suggestion:** **File:** `src/lib/agent.js`  
**Issue:** `resolveAgentProfiles()` sounds like it performs final profile resolution, but it only builds a merged profile map. That overlaps conceptually with `resolveProfileSelection()` and makes the resolution flow harder to scan.  
**Suggestion:** If the helper remains, rename it to something like `mergedAgentProfiles()` or `profileCatalogForAgent()`. If adopting targeted lookup, prefer `resolveAgentProfile(agentSection, profileName)` because that matches the actual responsibility.
**Rationale:** Loop review proposal.

### 4. I'll review this as a code-quality pass limited to `src/lib/config.js`, and I’ll check the bounded-resource guardrail against the diff as requested.The worktree path does not contain `src/lib/config.js` at that relative location, so I’m using the supplied diff as the source of truth rather than wandering outside the requested scope.### 1. Avoid Eager Registry Construction
**Failure mode:** refactor
**File:** src/lib/config.js
**Issue:** **File:** `src/lib/config.js`  
**Issue:** `registry` is constructed whenever `raw.agent` exists, but it is only used inside the `raw.agent?.profiles` validation block. This adds unnecessary work and widens the variable’s lifetime.  
**Suggestion:** Move `const registry = new ProviderRegistry(raw.agent.providers || {})` back inside the `if (raw.agent?.profiles)` block, or lazily initialize it only where profile provider validation runs.
**Suggestion:** **File:** `src/lib/config.js`  
**Issue:** `registry` is constructed whenever `raw.agent` exists, but it is only used inside the `raw.agent?.profiles` validation block. This adds unnecessary work and widens the variable’s lifetime.  
**Suggestion:** Move `const registry = new ProviderRegistry(raw.agent.providers || {})` back inside the `if (raw.agent?.profiles)` block, or lazily initialize it only where profile provider validation runs.
**Rationale:** Loop review proposal.

### 5. 2. Rename Resolved Profile Map for Clarity
**Failure mode:** refactor
**File:** src/lib/config.js
**Issue:** **File:** `src/lib/config.js`  
**Issue:** `agentProfiles` now contains both built-in and user-defined profiles, but the name does not make that resolution/merge behavior obvious.  
**Suggestion:** Rename it to something like `resolvedAgentProfiles` or `availableAgentProfiles` so the `useProfile` validation reads more clearly.
**Suggestion:** **File:** `src/lib/config.js`  
**Issue:** `agentProfiles` now contains both built-in and user-defined profiles, but the name does not make that resolution/merge behavior obvious.  
**Suggestion:** Rename it to something like `resolvedAgentProfiles` or `availableAgentProfiles` so the `useProfile` validation reads more clearly.
**Rationale:** Loop review proposal.

### 6. 3. Add an Explicit Bound for Profile Merging
**Failure mode:** refactor
**File:** src/lib/config.js
**Issue:** **File:** `src/lib/config.js`  
**Issue:** The new spread merge `{ ...defaultAgentProfiles(), ...(raw.agent.profiles || {}) }` bulk-copies all user-defined profiles without an explicit count or size bound. This appears to violate the `bounded-resource-usage` guardrail for bulk data processing.  
**Suggestion:** Enforce or reuse a maximum number of agent profiles before merging, and surface a validation error if the limit is exceeded.
**Suggestion:** **File:** `src/lib/config.js`  
**Issue:** The new spread merge `{ ...defaultAgentProfiles(), ...(raw.agent.profiles || {}) }` bulk-copies all user-defined profiles without an explicit count or size bound. This appears to violate the `bounded-resource-usage` guardrail for bulk data processing.  
**Suggestion:** Enforce or reuse a maximum number of agent profiles before merging, and surface a validation error if the limit is exceeded.
**Rationale:** Loop review proposal.

### 7. 1. Clarify Interactive Agent Prompt
**Failure mode:** refactor
**File:** src/locale/en/ui.json
**Issue:** **File:** `src/locale/en/ui.json`
**Issue:** The existing `"agent": "Default AI agent:"` label now conflicts with the new `"mainAgent": "Main/default AI agent:"`. With multi-agent setup, `"agent"` appears to mean available agent families, not the default.
**Suggestion:** Rename the `"agent"` prompt text to something like `"Available AI agents:"` or `"Agent families:"` so `"mainAgent"` is the only label that refers to the default.
**Suggestion:** **File:** `src/locale/en/ui.json`
**Issue:** The existing `"agent": "Default AI agent:"` label now conflicts with the new `"mainAgent": "Main/default AI agent:"`. With multi-agent setup, `"agent"` appears to mean available agent families, not the default.
**Suggestion:** Rename the `"agent"` prompt text to something like `"Available AI agents:"` or `"Agent families:"` so `"mainAgent"` is the only label that refers to the default.
**Rationale:** Loop review proposal.

### 8. 2. Make `--agent` Help Describe Ordering Semantics
**Failure mode:** refactor
**File:** src/locale/en/ui.json
**Issue:** **File:** `src/locale/en/ui.json`
**Issue:** The updated help text says `Agent family`, but the option accepts multiple families and the order determines the default for multi-agent values.
**Suggestion:** Change the help text to mention plural values and first-listed default behavior, for example: `--agent <agent>             Agent families: claude|codex|claude,codex|codex,claude; first is default`.
**Suggestion:** **File:** `src/locale/en/ui.json`
**Issue:** The updated help text says `Agent family`, but the option accepts multiple families and the order determines the default for multi-agent values.
**Suggestion:** Change the help text to mention plural values and first-listed default behavior, for example: `--agent <agent>             Agent families: claude|codex|claude,codex|codex,claude; first is default`.
**Rationale:** Loop review proposal.

### 9. 3. Verify `agentFiles` Is Not a Dead Locale Key
**Failure mode:** refactor
**File:** src/locale/en/ui.json
**Issue:** **File:** `src/locale/en/ui.json`
**Issue:** `"agentFiles": "Agent instruction files:"` is added, but this diff does not show any usage or requirement tied to an “agent files” prompt. If it is not wired elsewhere, it becomes dead locale data.
**Suggestion:** Remove the key unless it is used by this change set, or rename it to the exact concept shown in the UI if it is already wired.
**Suggestion:** **File:** `src/locale/en/ui.json`
**Issue:** `"agentFiles": "Agent instruction files:"` is added, but this diff does not show any usage or requirement tied to an “agent files” prompt. If it is not wired elsewhere, it becomes dead locale data.
**Suggestion:** Remove the key unless it is used by this change set, or rename it to the exact concept shown in the UI if it is already wired.
**Rationale:** Loop review proposal.

### 10. I’ll inspect the touched locale file around these keys so the proposals are grounded in the existing naming and wording patterns.The path from the diff is not present at the current working directory root, so I’m checking the workspace layout before relying only on the provided diff.### 1. Use Consistent Japanese Terminology for `--agent`
**Failure mode:** refactor
**File:** src/locale/ja/ui.json
**Issue:** **File:** `src/locale/ja/ui.json`  
**Issue:** The help text mixes Japanese with the English singular word `family`, even though the option accepts one or multiple agent families.  
**Suggestion:** Rename the label to a clearer Japanese phrase, e.g. `利用エージェント: claude|codex|claude,codex|codex,claude` or `エージェントファミリー: ...`.
**Suggestion:** **File:** `src/locale/ja/ui.json`  
**Issue:** The help text mixes Japanese with the English singular word `family`, even though the option accepts one or multiple agent families.  
**Suggestion:** Rename the label to a clearer Japanese phrase, e.g. `利用エージェント: claude|codex|claude,codex|codex,claude` or `エージェントファミリー: ...`.
**Rationale:** Loop review proposal.

### 11. 2. Clarify Main Agent Label Without Slash Wording
**Failure mode:** refactor
**File:** src/locale/ja/ui.json
**Issue:** **File:** `src/locale/ja/ui.json`  
**Issue:** `メイン/デフォルト AI エージェント:` duplicates the existing `デフォルト AI エージェント:` wording and uses slash wording that is less polished for UI copy.  
**Suggestion:** Use a single clear label such as `メイン AI エージェント（デフォルト）:` to distinguish it from the single-agent default prompt.
**Suggestion:** **File:** `src/locale/ja/ui.json`  
**Issue:** `メイン/デフォルト AI エージェント:` duplicates the existing `デフォルト AI エージェント:` wording and uses slash wording that is less polished for UI copy.  
**Suggestion:** Use a single clear label such as `メイン AI エージェント（デフォルト）:` to distinguish it from the single-agent default prompt.
**Rationale:** Loop review proposal.

### 12. 3. Expand Japanese Help Coverage for Agent Config Fields
**Failure mode:** refactor
**File:** src/locale/ja/ui.json
**Issue:** **File:** `src/locale/ja/ui.json`  
**Issue:** The updated `--agent` help lists accepted values, but the related requirement also expects setup help/docs to explain `agent.default`, `agent.useProfile`, built-in profile names, and override examples for `agent.profiles` / `agent.providers`.  
**Suggestion:** Add or update adjacent Japanese help/completion strings in this locale file so the Japanese UI exposes the same config-field guidance as the rest of the setup flow.
**Suggestion:** **File:** `src/locale/ja/ui.json`  
**Issue:** The updated `--agent` help lists accepted values, but the related requirement also expects setup help/docs to explain `agent.default`, `agent.useProfile`, built-in profile names, and override examples for `agent.profiles` / `agent.providers`.  
**Suggestion:** Add or update adjacent Japanese help/completion strings in this locale file so the Japanese UI exposes the same config-field guidance as the rest of the setup flow.
**Rationale:** Loop review proposal.

### 13. 1. Remove leftover type calculation
**Failure mode:** refactor
**File:** src/setup.js
**Issue:** **File:** `src/setup.js`
**Issue:** `selectedTypes` is still computed in `main()` after config construction was moved into `buildSetupConfig()`, but the local value is no longer used.
**Suggestion:** Delete the unused `selectedTypes` block in `main()` and let `buildSetupConfig()` remain the single owner of that logic.
**Suggestion:** **File:** `src/setup.js`
**Issue:** `selectedTypes` is still computed in `main()` after config construction was moved into `buildSetupConfig()`, but the local value is no longer used.
**Suggestion:** Delete the unused `selectedTypes` block in `main()` and let `buildSetupConfig()` remain the single owner of that logic.
**Rationale:** Loop review proposal.

### 14. 2. Avoid duplicate CLI agent parsing
**Failure mode:** refactor
**File:** src/setup.js
**Issue:** **File:** `src/setup.js`
**Issue:** In the interactive defaults path, `parseSetupAgentOption(cli.agent)` is called separately for `selectedAgents` and `mainAgent`.
**Suggestion:** Parse once into a local `agentIntent`, as already done in the non-interactive path, and reuse it for both fields.
**Suggestion:** **File:** `src/setup.js`
**Issue:** In the interactive defaults path, `parseSetupAgentOption(cli.agent)` is called separately for `selectedAgents` and `mainAgent`.
**Suggestion:** Parse once into a local `agentIntent`, as already done in the non-interactive path, and reuse it for both fields.
**Rationale:** Loop review proposal.

### 15. 3. Centralize agent instruction file names
**Failure mode:** refactor
**File:** src/setup.js
**Issue:** **File:** `src/setup.js`
**Issue:** `"AGENTS.md"` and `"CLAUDE.md"` are hardcoded in several places despite `SETUP_AGENT_FILE_BY_FAMILY` already existing.
**Suggestion:** Add a shared `SETUP_AGENT_FILE_TARGETS = Object.values(SETUP_AGENT_FILE_BY_FAMILY)` constant and use it for filtering, prompt options, and defaults.
**Suggestion:** **File:** `src/setup.js`
**Issue:** `"AGENTS.md"` and `"CLAUDE.md"` are hardcoded in several places despite `SETUP_AGENT_FILE_BY_FAMILY` already existing.
**Suggestion:** Add a shared `SETUP_AGENT_FILE_TARGETS = Object.values(SETUP_AGENT_FILE_BY_FAMILY)` constant and use it for filtering, prompt options, and defaults.
**Rationale:** Loop review proposal.

### 16. 4. Reconsider `buildSetupAgentPromptPlan`
**Failure mode:** refactor
**File:** src/setup.js
**Issue:** **File:** `src/setup.js`
**Issue:** `buildSetupAgentPromptPlan()` duplicates parts of `runWizard()`’s prompt/file-target decision logic but is not used by the setup flow in this diff. That creates a drift risk.
**Suggestion:** Either wire `runWizard()` through this helper or remove the helper/export if it exists only as speculative structure.
**Suggestion:** **File:** `src/setup.js`
**Issue:** `buildSetupAgentPromptPlan()` duplicates parts of `runWizard()`’s prompt/file-target decision logic but is not used by the setup flow in this diff. That creates a drift risk.
**Suggestion:** Either wire `runWizard()` through this helper or remove the helper/export if it exists only as speculative structure.
**Rationale:** Loop review proposal.

### 17. 5. Bound recursive config cloning
**Failure mode:** refactor
**File:** src/setup.js
**Issue:** **File:** `src/setup.js`
**Issue:** The new `clone()` helper uses `JSON.stringify()` / `JSON.parse()` on arbitrary config-shaped input. This performs recursive traversal without an explicit depth or size bound, which conflicts with the `bounded-resource-usage` guardrail.
**Suggestion:** Avoid deep cloning the whole config, clone only the wizard-managed shallow branches, or enforce an explicit config size/depth limit before cloning.
**Suggestion:** **File:** `src/setup.js`
**Issue:** The new `clone()` helper uses `JSON.stringify()` / `JSON.parse()` on arbitrary config-shaped input. This performs recursive traversal without an explicit depth or size bound, which conflicts with the `bounded-resource-usage` guardrail.
**Suggestion:** Avoid deep cloning the whole config, clone only the wizard-managed shallow branches, or enforce an explicit config size/depth limit before cloning.
**Rationale:** Loop review proposal.

### 18. 1. Avoid full JSON clone for a targeted migration
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`  
**Issue:** `migrateConfigForUpgrade()` deep-clones the entire config with `JSON.parse(JSON.stringify(...))`, but the migration only changes `chapters`. This adds unnecessary serialization work and increases memory usage for large configs. It also weakens the `bounded-resource-usage` guardrail because the extra full-config clone has no explicit size bound.  
**Suggestion:** Replace `clone()` with a targeted copy, for example shallow-copy the config and only replace `chapters` when migration is needed. If mutation is acceptable, operate on the parsed config directly and remove `clone()` entirely.
**Suggestion:** **File:** `src/upgrade.js`  
**Issue:** `migrateConfigForUpgrade()` deep-clones the entire config with `JSON.parse(JSON.stringify(...))`, but the migration only changes `chapters`. This adds unnecessary serialization work and increases memory usage for large configs. It also weakens the `bounded-resource-usage` guardrail because the extra full-config clone has no explicit size bound.  
**Suggestion:** Replace `clone()` with a targeted copy, for example shallow-copy the config and only replace `chapters` when migration is needed. If mutation is acceptable, operate on the parsed config directly and remove `clone()` entirely.
**Rationale:** Loop review proposal.

### 19. 2. Remove redundant `configChanged` assignment
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`  
**Issue:** `configChanged` is set to `true` inside the `migrated.migratedChapters > 0` block, then immediately set again when `migrated.changed` is true. For the current migration, those conditions are equivalent.  
**Suggestion:** Let `migrated.changed` be the single source of truth for whether the config changed, and keep the chapter-specific block only for logging.
**Suggestion:** **File:** `src/upgrade.js`  
**Issue:** `configChanged` is set to `true` inside the `migrated.migratedChapters > 0` block, then immediately set again when `migrated.changed` is true. For the current migration, those conditions are equivalent.  
**Suggestion:** Let `migrated.changed` be the single source of truth for whether the config changed, and keep the chapter-specific block only for logging.
**Rationale:** Loop review proposal.

### 20. 3. Use a clearer count name
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`  
**Issue:** `migratedChapters` reads like a collection of migrated chapter objects, but it actually stores a numeric count.  
**Suggestion:** Rename it to `migratedChapterCount` to make the return shape self-describing.
**Suggestion:** **File:** `src/upgrade.js`  
**Issue:** `migratedChapters` reads like a collection of migrated chapter objects, but it actually stores a numeric count.  
**Suggestion:** Rename it to `migratedChapterCount` to make the return shape self-describing.
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 4
- Out of scope: 0
