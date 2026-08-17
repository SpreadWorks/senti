# Spec Review Results

## Verdict: FAIL

## Blocking Findings

### 1. Generated skill artifact target contradicts dispatcher architecture
**Target:** R3 / Acceptance Criteria / T-1 test_strategy
**Issue:** The spec requires generated `sdd-forge.flow` skill artifacts produced by `sdd-forge upgrade` to contain the corrected draft-gate approval setup guidance. In the current codebase, `src/skills/sdd-forge.flow/SKILL.md` is intentionally a thin dispatcher and states that per-step procedures live in `sdd-forge flow get next-action`, while `src/flow/lib/get-step-instructions.js` loads the actual draft-gate instructions from `src/flow/prompts/plan/draft-gate.md`. `src/upgrade.js` deploys `src/skills/` into `.agents/skills/` and `.claude/skills/`; it does not inline `src/flow/prompts/plan/*.md` into the generated skill artifact.
**Required change:** Change R3 and the generated-artifact acceptance/test wording so prompt guidance is verified through the rendered next-action instructions or `src/flow/prompts/plan/draft-gate.md`; require `sdd-forge upgrade` artifact sync only for `src/skills/` changes, not as the location where draft-gate prompt text must appear.
**Why blocking:** Leaving this unchanged makes the implementation target impossible or misleading: an implementation that correctly edits the prompt source will not make `.agents/skills/sdd-forge.flow/SKILL.md` contain the draft-gate guidance, and a test written from the current spec would fail despite the runtime guidance path being correct.


## Non-blocking Improvements

### 1. Mention PASS hook bypasses repair prompt
**Target:** Background / Overview
**Improvement:** Add `src/flow/registry.js` as supporting context for the normal PASS path: its review post-hook writes empty triage/repair artifacts and marks the repair step done on coverage PASS, so `draft-coverage-repair.md` is not shown before `draft-gate` in that path.
**Why non-blocking:** The spec already identifies `draft-gate.md` and the PASS path as targets, so implementation and testing remain possible; this would just make the cause easier to trace.
