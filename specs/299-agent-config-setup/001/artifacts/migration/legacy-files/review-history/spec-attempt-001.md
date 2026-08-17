# Spec Review Results

## Verdict: FAIL

## Blocking Findings

### 1. Non-interactive multi-agent main selection is ambiguous
**Target:** R3 / R2
**Issue:** The spec requires `senti setup --agent claude,codex` to produce the same config matrix as interactive setup, but the non-interactive contract has only `--agent` and cannot ask the separate main/default-agent question. Codebase context shows `parseSetupArgs()` exposes no main-agent option, and the non-interactive path builds settings without any prompt.
**Required change:** Specify how non-interactive multi-agent setup determines the main/default agent, either by defining value order semantics such as first listed is main or by adding an explicit CLI contract for main/default selection.
**Why blocking:** Implementation and tests cannot determine whether `--agent claude,codex` should write `agent.default=claude` with `agent.useProfile=claude-main` or `agent.default=codex` with `agent.useProfile=codex-main`.

### 2. Non-interactive instruction-file targets are undefined for multi-agent setup
**Target:** R6 / setup --agent contract
**Issue:** R6 decouples AGENTS.md and CLAUDE.md generation targets when both agents are selected, but the spec does not define the non-interactive target contract or default. Existing setup has no CLI option for file targets and currently defaults non-interactive setup to generate one file derived from the selected agent.
**Required change:** Specify the non-interactive behavior for AGENTS.md/CLAUDE.md generation when `--agent` selects both families, either by defining a default target set or by adding a CLI option for generation targets.
**Why blocking:** Tests cannot know whether `--agent claude,codex` should create AGENTS.md, CLAUDE.md, both, or neither, and an implementation could preserve the existing single-derived target despite R6 requiring separate target intent.

### 3. Existing config setup defaults are not specified
**Target:** R1 / R2 / R8
**Issue:** The spec preserves runtime support for existing concrete provider-key defaults, but does not say how rerunning setup should initialize the wizard from existing `agent.default` and `agent.useProfile`. Codebase context shows `loadExistingDefaults()` currently reads `cfg.agent.default` literally; old configs may contain `codex/gpt-5.4` or `claude/sonnet`, while new compact configs encode availability/main in `agent.useProfile`.
**Required change:** Specify that setup normalizes existing concrete provider keys, family aliases, and existing built-in `agent.useProfile` names into wizard availability and main/default defaults before prompting or rewriting config.
**Why blocking:** Rerunning setup on an existing codex or multi-agent config can preselect the wrong agent state and rewrite `agent.default`/`agent.useProfile` incorrectly, causing a compatibility regression that runtime-only R8 coverage would not catch.


## Non-blocking Improvements

### 1. Call out ProviderRegistry built-in consolidation
**Target:** Modules / T-1
**Improvement:** Mention that `src/lib/provider.js` currently has its own built-in profile table and should be backed by, or reconciled with, `src/lib/agent-defaults.js` when making agent-defaults the source of truth.
**Why non-blocking:** The current source-of-truth principle and T-1 are enough to implement correctly, but this note would reduce drift risk because the two existing built-in lists do not contain identical provider keys.
