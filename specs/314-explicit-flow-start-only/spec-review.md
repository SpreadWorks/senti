# Spec Review Results

## Verdict: FAIL

## Blocking Findings

### 1. Generated agent files lack a refresh target
**Target:** R1/R5, Scope In, Data Flow
**Issue:** The spec says `senti upgrade` refreshes generated skill/template artifacts after `src/presets` changes, but the verified upgrade path only deploys skills and copies preset guardrail/rubric files. `src/upgrade.js` calls `deploySkills` and `deployPresetCopies`; `src/lib/preset-deploy.js` does not copy `AGENTS.senti.md` or rewrite generated agent files. Existing generated `AGENTS.md` and `CLAUDE.md` still contain automatic startup wording inside `{{data("agents.senti")}}` blocks, and generated agent files are actually updated through `src/setup.js` or `src/docs/commands/agents.js`, not by the current upgrade implementation.
**Required change:** Add a spec-level requirement/acceptance item that names the generated agent-file refresh path: either update `senti upgrade` to refresh the `agents.senti` directive blocks, or explicitly require running the existing setup/docs-agent regeneration path after template changes. The requirement should verify generated `AGENTS.md` and, when present, `CLAUDE.md` no longer retain the old automatic startup wording.
**Why blocking:** If the spec is implemented as written, source templates and skill files can pass tests and `senti upgrade` can record evidence while the repository's generated agent guidance still tells agents to show the mandatory flow/direct-edit confirmation. That directly preserves the behavior the issue is trying to remove and leaves no acceptance test covering the actual generated guidance users read.


## Non-blocking Improvements

### 1. Mention generated-agent tests
**Target:** T-3 test_strategy
**Improvement:** Add `tests/e2e/docs/commands/agents.test.js` and `tests/e2e/051-skill-namespace.test.js` as useful related test targets for generated `AGENTS.md` / `CLAUDE.md` behavior.
**Why non-blocking:** Spec-local text checks can still prove the core policy, but these existing tests are a better fit for guarding the generation paths.
