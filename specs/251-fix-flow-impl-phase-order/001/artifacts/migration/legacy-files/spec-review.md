# Spec Review Results

## Proposals

### 1. I’ll inspect the flow definition, command helpers, prompts/templates, and tests around the listed scope to find references the spec may have missed. I’ll also compare docs/source timestamps first per the local project rule, but I won’t modify files.The first broad scan returned no usable output, so I’m narrowing it to confirm the worktree contents and then search the relevant paths directly.This checkout has the Git worktree rooted one level above `.tmp`; `.tmp` itself only contains tool scaffolding. I’ll read from the Git top-level path and keep the review read-only.The timestamp check shows `src/` is newer than `docs/`, so the local rule would normally call for proposing `sdd-forge build` before relying on generated docs. For this review I’m treating source as authoritative and using docs only as secondary context.I’ve confirmed most step order is derived from `definition.js`, but there are still standalone literals and tests that can drift. I’m checking those exact literals and generated/deployed skill files now.### 1. Test-only autoApprove still skips the gate before review
**File:** `src/flow/prompts/impl/implement.md`  
**Issue:** The spec only mentions updating `Skip to step 3 (review)`, but line 4 still tells the agent to set `gate-impl` to `skipped`. With the new order, that means review can run and then finalize without any impl gate.  
**Suggestion:** Add an explicit requirement for the test-only path: do not skip `gate-impl` before review, or define the intended test-only sequence precisely.

### 2. 2. Gate prompt always runs task-impl, not integration
**File:** `src/flow/prompts/impl/gate-impl.md`  
**Issue:** The shared gate prompt always says `sdd-forge flow run gate --phase task-impl`. For the flow-level integration gate after review, this bypasses the `integration` phase whose PASS_NEXT the spec updates. This also contradicts Out-of-Scope saying impl.gate-impl prompt body is unchanged while R8 depends on integration behavior.  
**Suggestion:** Bring this prompt into scope and make it conditional: task scope uses `--phase task-impl`; flow-level integration scope uses `--phase integration`.

### 3. 3. Skill command reference omits integration gate
**File:** `src/templates/skills/sdd-forge.flow/SKILL.md`  
**Issue:** R4 updates the description and hard stop, but the command reference still lists `sdd-forge flow run gate [--phase <draft|spec|task-impl>]`, omitting `integration`.  
**Suggestion:** Add this line to R4/R10 scope and update it to include `integration`.

### 4. 4. CLI help still advertises legacy gate phases
**File:** `src/flow/registry.js`  
**Issue:** The `flow run gate` help text still says `--phase <draft|pre|post|impl> Gate phase (default: pre)`, which is both legacy and incomplete for the new `integration` gate path.  
**Suggestion:** Add a requirement to update the help text to the valid gate phases: `draft|spec|task-spec|task-impl|integration`.

### 5. 5. Integration gate behavior lacks direct test coverage
**File:** `tests/e2e/flow/gate-impl-integration.test.js`  
**Issue:** Despite the filename, this test helper always invokes `flow run gate --phase task-impl`. R8 changes `"integration": "finalize-commit"`, but no listed test verifies integration PASS returns that next hint.  
**Suggestion:** Add or update a test that runs `flow run gate --phase integration` and asserts PASS returns `next: "finalize-commit"`.

### 6. 6. Gate phase inference still codifies gate-impl as task-impl
**File:** `tests/unit/flow/gate-phase-inference.test.js`  
**Issue:** The test asserts flow-level `gate-impl` in progress resolves to `task-impl`. If the implementation relies on omitted `--phase` for the new flow-level integration gate, this contradicts the desired integration behavior.  
**Suggestion:** The spec should explicitly choose one path: either keep inference unchanged and require explicit `--phase integration`, or bring `gate-step.js` inference/tests into scope.
