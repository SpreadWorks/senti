# Spec Review Results

## Verdict: FAIL

## Blocking Findings

### 1. Fresh bootstrap path lacks a pre-config integration contract
**Target:** R2 / T-2 / Data Flow
**Issue:** The named implementation precedent, ensureOfficialPackage(), requires an existing .senti/config.json through loadRawConfig() and readStoredProjectConfig(), but current setup reaches the preset prompt before registerProject() and before config generation. The spec requires fresh setup to materialize official presets before the prompt without defining whether setup may create temporary project state, use a manifest-only discovery path, or how that state is cleaned up when base is selected.
**Required change:** Specify the fresh pre-prompt bootstrap mechanism and its cleanup/persistence semantics: either a transient official preset discovery path that does not require config.json, or an allowed temporary minimal config/state flow with exact cleanup rules.
**Why blocking:** Without this, R2 cannot be implemented safely: a direct helper call fails on missing config, while creating config/plugin state before confirmation risks unapproved filesystem side effects and conflicts with R4. Tests also cannot know what state should exist before and after base selection.

### 2. Official state writes must preserve config.local overlay privacy
**Target:** R3 / T-3 / src/lib/plugin-registry.js:ensureOfficialPackage
**Issue:** The codebase supports private plugin sources and packages via .senti/config.local.json overlays. loadRawConfig() merges that overlay, and ensureOfficialPackage() currently writes the merged object back to public .senti/config.json. If setup uses this helper while adding official plugin state in an existing project, private non-official plugin source/package entries can be copied into public config.
**Required change:** Add a spec requirement that setup's official plugin state mutation must preserve public/local config separation and must not copy config.local.json plugin sources or packages into .senti/config.json.
**Why blocking:** Leaving this unspecified makes the implementation unsafe for existing projects with local plugin overlays: selecting an official preset can accidentally persist private local plugin state publicly and alter plugin configuration beyond the setup change.


## Non-blocking Improvements

### 1. Clarify official source resolution wording
**Target:** Background / R2 / T-2
**Improvement:** The spec calls official presets bundled, but the current package.json only publishes src/ and officialPresetPluginRoot() is environment-based while ensureOfficialPackage() otherwise falls back to the official git remote. Clarifying whether production setup should use an env/sibling source, a shipped package asset, or the default remote would reduce implementation ambiguity.
**Why non-blocking:** The existing helper provides an implementation path and the spec already says bootstrap failure is fatal, so implementation can proceed, but the wording may lead to different assumptions about offline behavior.

### 2. Name PRESETS-fixed follow-up surfaces explicitly
**Target:** R7 / Codebase Context
**Improvement:** R7 could explicitly mention known PRESETS-fixed consumers such as src/check/commands/config.js and src/presets-cmd.js as review targets, because they currently remain core-only even after setup can save plugin preset types.
**Why non-blocking:** R7 already requires reviewing related display paths or keeping them out of scope with tests, so this does not block setup implementation; it only makes the intended review surface easier to find.
