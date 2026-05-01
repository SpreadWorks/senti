# Spec Review Results

## Proposals

### 1. I’ll inspect the related modules and tests the spec names, then look for references to `jsonSchemaFlag`, provider profiles, and config schemas outside that list.The configured working directory appears to be a `.tmp` directory without `src/`, `tests/`, or `docs/` present. I’m checking the worktree layout so I can stay inside the active worktree boundary and locate the actual repo files.The repository files are one level above `.tmp`, still within the same feature worktree. I’ll read from that parent worktree root and keep this to inspection only.I found the main implementation surface. I’m checking secondary tests and generated/project config references now, because those are where this kind of profile-schema change often leaves stale assumptions.There is another generator surface: `src/setup.js` writes default agent provider entries during setup. I’m checking that because it is neither `src/templates/` nor `src/presets/`, but it can create configs that depend on the old implicit provider methods.### 1. Active config overrides lose schema support
**File:** `.sdd-forge/config.json`  
**Issue:** The active config defines `agent.providers` entries for `claude/sonnet`, `claude/opus`, `codex/gpt-5.4`, `codex/gpt-5.3`, and `codex/gpt-5.5`. Because `ProviderRegistry._mergeProfiles()` uses full key replacement, these entries will override builtin profiles and will not inherit the new `jsonSchemaFlag/jsonSchemaMode`. `codex/gpt-5.5` is only present in config, not builtin.  
**Suggestion:** Add `.sdd-forge/config.json` to Scope or explicitly state it is out of scope and that local/custom providers must be updated manually. If preserving current workflow matters, require adding the new properties to this config.

### 2. 2. Provider guidance becomes stale
**File:** `src/AGENTS.md`  
**Issue:** The spec excludes `src/AGENTS.md`, but that file contains provider-profile rules saying runtime-injected flags are limited to workDir and documents only `jsonOutputFlag`. The new design introduces profile-declared schema flag injection and `jsonSchemaMode`, so future implementers will read conflicting guidance.  
**Suggestion:** Either include a small `src/AGENTS.md` update in Scope, or add a follow-up requirement explicitly tracking the documentation gap instead of broadly excluding it.

### 3. 3. Agent-specific test suite omitted
**File:** `package.json`  
**Issue:** The acceptance criteria only mention `npm test`, but project rules require `npm run test:agent` when `src/lib/agent.js` changes. This spec directly changes `_buildInvocation` and structured-output behavior.  
**Suggestion:** Add verification criteria: run `npm test` and `npm run test:agent`, or explicitly justify why the agent suite is not required.

### 4. 4. Default `jsonSchemaMode` behavior lacks test coverage
**File:** `tests/unit/lib/agent-service.test.js`  
**Issue:** R5 requires missing `jsonSchemaMode` to behave as `"inline"`, but R8 lists explicit inline/file cases and cross-provider cases, not the omitted-mode case. That leaves the default behavior unverified.  
**Suggestion:** Add an agent-service test where `jsonSchemaFlag` is set and `jsonSchemaMode` is absent, asserting inline schema passing.

### 5. 5. File-mode write behavior is underspecified
**File:** `src/lib/agent.js`  
**Issue:** The spec says `jsonSchemaMode: "file"` passes a file path, but does not require that the schema file is actually written before spawning the provider or that the written content matches `options.jsonSchema`. `_buildInvocation` currently only returns `pendingSchemaWrite`; `_callOnce` performs the write.  
**Suggestion:** Add a requirement and test for file mode that verifies the schema file is written with the expected JSON before command execution, for a non-codex custom provider as well as codex.
