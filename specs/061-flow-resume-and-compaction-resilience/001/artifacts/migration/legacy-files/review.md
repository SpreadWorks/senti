# Code Review Results

### [x] 1. Consolidate Repeated Flow-State Mutation Logic
**File:** `src/lib/flow-state.js`
**Issue:** `updateStepStatus`, `setRequirements`, `updateRequirement`, `setRequest`, and `addNote` all repeat the same `loadFlowState` → null check → mutate → `saveFlowState` pattern. The new `setRequest` and `addNote` increase that duplication further.
**Suggestion:** Add a small helper such as `mutateFlowState(workRoot, mutator)` that loads the state once, throws if absent, applies the mutation, and saves. Rebuild the individual setters on top of that helper to reduce repetition and keep mutation behavior consistent.

**Verdict:** APPROVED
**Reason:** The load→null-check→mutate→save pattern is repeated 5 times with identical null-check error messages. A `mutateFlowState(workRoot, fn)` helper would genuinely reduce duplication and prevent inconsistency (e.g., one function forgetting the null check). The mutation logic in each setter is simple enough that the abstraction won't obscure behavior.

### [ ] 2. Remove Unused Import in Resume Command
**File:** `src/flow/commands/resume.js`
**Issue:** `FLOW_STEPS` is imported but never used. This is dead code and makes the command look more coupled to global step metadata than it actually is.
**Suggestion:** Remove the unused `FLOW_STEPS` import. If step ordering is needed later, reintroduce it only where it is actually consumed.

**Verdict:** REJECTED
**Reason:** `FLOW_STEPS` is imported alongside `loadFlowState` on line 13 and while it's not directly referenced in function bodies, removing it is cosmetic-only. The import has negligible runtime cost (it's already loaded as part of the same module), and `PHASE_MAP` keys are implicitly coupled to `FLOW_STEPS` values—keeping the import makes that dependency visible. The risk/reward ratio doesn't justify the change.

### [x] 3. Avoid Duplicating Skill Content in Two Trees
**File:** `src/templates/skills/sdd-forge.flow-plan/SKILL.md`
**Issue:** The same “Context Recording” section was added both under `.claude/skills/...` and `src/templates/skills/...`. Maintaining identical content in two places creates drift risk and makes future wording changes easy to miss.
**Suggestion:** Make one location the source of truth and generate or sync the other from it. If both must exist, add a documented generation path or verification test so the copies cannot silently diverge.

**Verdict:** APPROVED
**Reason:** The `.claude/skills/` and `src/templates/skills/` trees now have identical "Context Recording" sections added to all three SKILL.md files. `.claude/skills/` is the active project instance while `src/templates/skills/` is the distributable template. With no sync mechanism or test, these will inevitably drift. Establishing a single source of truth (template → generated) is a real improvement that prevents silent divergence.

### [x] 4. Centralize Phase/Step Mapping to Keep Flow Design Consistent
**File:** `src/flow/commands/resume.js`
**Issue:** `PHASE_MAP` hardcodes workflow phase boundaries locally. That makes `resume` responsible for domain rules that are likely shared across flow commands and skills, and it can drift if step IDs or phase boundaries change.
**Suggestion:** Move phase metadata into `src/lib/flow-state.js` or another shared flow module, and expose a helper like `getFlowPhase(stepId)` or `deriveFlowPhase(steps)`. That keeps step semantics in one place and makes new commands consistent by default.

**Verdict:** APPROVED
**Reason:** `PHASE_MAP` in `resume.js` hardcodes the same step IDs defined in `FLOW_STEPS` from `flow-state.js`. If step IDs change in `FLOW_STEPS`, `PHASE_MAP` will silently become stale. Moving phase metadata into `flow-state.js` alongside `FLOW_STEPS` consolidates domain knowledge and makes it available to other flow commands (e.g., `status --check` already has its own implicit phase logic in `CHECKS`). This reduces a real consistency risk.

### [ ] 5. Split `status` Command Responsibilities Before It Becomes a Catch-All
**File:** `src/flow/commands/status.js`
**Issue:** `flow status` now handles display, step updates, requirement updates, archiving, request persistence, note appending, and prerequisite checks. The new `--request` and `--note` options push it further toward a generic state editor, which is inconsistent with the existence of dedicated subcommands like `resume`.
**Suggestion:** Either extract subcommands such as `flow note` / `flow request`, or refactor `status.js` around an action-dispatch table so each behavior is isolated. This keeps the command simpler and prevents the if/return chain from growing into an unstructured control block.

**Verdict:** REJECTED
**Reason:** While the observation is valid long-term, the current `status.js` is ~228 lines with a straightforward if/return chain. Each option is a thin CLI wrapper around a single `flow-state.js` function call. Extracting `flow note` / `flow request` as separate subcommands for two-line operations would add more files and routing complexity than it saves. The `--request` and `--note` flags are intentionally lightweight state mutations that logically belong with other state-update flags in `status`. Premature extraction here adds overhead without clear benefit.

### [x] 6. Align Resume Help Text With Actual Behavior
**File:** `src/flow/commands/resume.js`
**Issue:** The help text says the command reads `flow.json`, `spec.md`, and `draft.md`, but the implementation only reads `flow.json` and `spec.md`. That mismatch creates misleading documentation and suggests unfinished behavior.
**Suggestion:** Either update the help text to describe the current implementation accurately, or actually incorporate `draft.md` into the summary if that was the intended design.

**Verdict:** APPROVED
**Reason:** The help text explicitly claims "Reads flow.json, spec.md, and draft.md" but the implementation only reads `flow.json` and `spec.md`. This is a concrete documentation bug that misleads users. The fix (updating the help text to drop `draft.md`) is trivial and risk-free.
