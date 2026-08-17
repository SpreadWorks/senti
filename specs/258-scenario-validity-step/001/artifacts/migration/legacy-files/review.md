# Code Review Results

### 1. 1. Consolidate post-hook step rules
**File:** `.agents/skills/sdd-forge.flow/SKILL.md`  
**Issue:** Post-hook behavior is now split between the “Flow Progress Tracking” table and a separate dispatcher bullet for `flow run review`, which can drift as review behavior changes.  
**Suggestion:** Add review-step behavior to the post-hook-managed table, then simplify C.2 to reference that table for all post-hook-managed transitions.

### 2. 2. Clarify metric placeholder naming
**File:** `.agents/skills/sdd-forge.flow/SKILL.md`  
**Issue:** The commands still use `<current-phase>`, but the new guidance says to use phase/key values from `status` / `next-action`, and examples include both phases and step keys. This makes the placeholder less precise.  
**Suggestion:** Rename placeholders to something like `<metric-phase-or-step-key>` in the two metric commands, or split the examples into explicit phase metrics vs step-key metrics if the CLI treats them differently.

### 3. 1. Consolidate post-hook step rules
**File:** `.claude/skills/sdd-forge.flow/SKILL.md`  
**Issue:** Post-hook behavior is now split between the “Flow Progress Tracking” table and a separate dispatcher bullet for `flow run review`, which can drift as review behavior changes.  
**Suggestion:** Add review-step behavior to the post-hook-managed table, then simplify C.2 to reference that table for all post-hook-managed transitions.

### 4. 2. Clarify metric placeholder naming
**File:** `.claude/skills/sdd-forge.flow/SKILL.md`  
**Issue:** The commands still use `<current-phase>`, but the new guidance says to use phase/key values from `status` / `next-action`, and examples include both phases and step keys. This makes the placeholder less precise.  
**Suggestion:** Rename placeholders to something like `<metric-phase-or-step-key>` in the two metric commands, or split the examples into explicit phase metrics vs step-key metrics if the CLI treats them differently.

### 5. 1. Use Existing String Validator Consistently
**File:** `src/flow/lib/test-artifacts.js`  
**Issue:** Non-empty string checks are repeated inline for `result.command` and `summary[].id` even though `assertNonEmptyString()` was added.  
**Suggestion:** Replace those inline checks with `assertNonEmptyString(result.command, "command")` and `assertNonEmptyString(entry.id, "summary[].id")` to keep validation style consistent.

### 6. 2. Rename Expected Requirement Variables
**File:** `src/flow/lib/test-artifacts.js`  
**Issue:** `expected` and `expectedSet` are vague; they specifically represent expected testable requirement IDs.  
**Suggestion:** Rename them to `expectedRequirementIds` and `expectedRequirementIdSet` to make the summary membership validation easier to read.

### 7. 3. Extract Summary Membership Validation
**File:** `src/flow/lib/test-artifacts.js`  
**Issue:** `validateScenarioValidityResult()` now handles object shape, raw output normalization, summary membership, evidence validation, file checks, and raw text checks in one large function.  
**Suggestion:** Extract the membership block into a helper such as `assertScenarioValiditySummaryMembership(summary, requirements)`. This would reduce the main function’s size and match the surrounding pattern of focused assertion helpers.

### 8. 4. Name Artifact Group by Behavior
**File:** `src/flow/lib/test-artifacts.js`  
**Issue:** `BASE_TEST_ARTIFACT_RELATIVE_PATHS` is effectively the durable artifact list, not just a neutral base list. `DURABLE_TEST_ARTIFACT_RELATIVE_PATHS` is only an alias to it.  
**Suggestion:** Define `DURABLE_TEST_ARTIFACT_RELATIVE_PATHS` directly and build `RESETTABLE_TEST_ARTIFACT_RELATIVE_PATHS` from it. This removes the extra name and better communicates the artifact lifecycle.

### 9. I’ll verify the neighboring prompt and flow step names so any naming proposal is grounded in the repo’s conventions, while keeping the review scope limited to the touched file.The first search hit a command error because one of the paths was not usable from this worktree context. I’m narrowing it to the source tree and the exact prompt file.The `.tmp` directory doesn’t contain the source checkout directly, so I’m checking the worktree layout before drawing conclusions from local files.### 1. Include the Immediate Artifact Review Step
**File:** `src/flow/prompts/impl/test-execute.md`  
**Issue:** The downstream artifact list says `review`, `gate-impl`, and `retro` consume `test-execute-result.json` and the raw log, but omits `test-result-review`, which is the immediate deterministic artifact validation step and is referenced elsewhere as part of the same post-execution chain.  
**Suggestion:** Change the sentence to list the full downstream chain, e.g. `` `test-result-review`, `review`, `gate-impl`, and `retro` read ...; they MUST NOT re-run tests.``

### 10. 1. Deep-freeze or avoid sharing mutable argument arrays
**File:** `src/flow/registry.js`  
**Issue:** `NO_ARGS` is shallow-frozen, but its `flags` and `options` arrays remain mutable. Because the same object is shared across commands, any downstream mutation of `args.flags` or `args.options` could leak between commands.  
**Suggestion:** Either freeze the nested arrays as well, or return fresh arrays via a helper if the command parser mutates args:

```js
const NO_ARGS = Object.freeze({
  flags: Object.freeze([]),
  options: Object.freeze([]),
});
```

or

```js
function noArgs() {
  return { flags: [], options: [] };
}
```

### 11. 1. Enforce the limit before buffering all Git output
**File:** `src/lib/git-helpers.js`  
**Issue:** `splitBoundedGitOutput()` bounds entries only after `runGit()` has already captured the full stdout and `stdout.split()` has allocated the full line array. For very large diffs/status output, resource use is still effectively unbounded at the subprocess output-buffering stage.  
**Suggestion:** Add an output-size bound at the Git command execution layer from this file, or parse stdout incrementally without materializing all lines first. The entry limit should prevent both excessive result size and excessive memory use while reading command output.

### 12. 2. Avoid allocating two arrays while counting bounded output
**File:** `src/lib/git-helpers.js`  
**Issue:** `stdout.split("\n").filter(Boolean)` creates a full array of all lines, then another filtered array, even though the function only needs to stop once `maxEntries` is exceeded.  
**Suggestion:** Replace it with a small bounded collector that iterates through split segments, skips empty lines, pushes up to `maxEntries`, and throws immediately when the next non-empty line is encountered. This keeps the helper aligned with the bounded-resource intent.

### 13. 3. Make the aggregate-limit error more precise
**File:** `src/lib/git-helpers.js`  
**Issue:** The `add()` error says `listChangedFilesDetailed returned more than ... entries`, but this limit is applied to unique deduplicated entries in `byKey`, while `splitBoundedGitOutput()` applies the same limit to raw Git output lines. The shared terminology makes it harder to tell which bound failed.  
**Suggestion:** Rename the message to clarify it is the combined unique changed-file limit, for example: `listChangedFilesDetailed found more than ${maxChangedFileEntries} unique changed file entries`.

### 14. 1. Clarify plural step entries
**File:** `src/templates/partials/flow-tracking.md`
**Issue:** The table header says `Step`, but the `finalize-* leaves` row represents multiple concrete steps and commands. This is slightly inconsistent with the other rows, which are single step IDs.
**Suggestion:** Rename the column to `Step(s)` or split the finalize leaves into separate rows for `finalize-commit`, `finalize-merge`, `finalize-sync`, and `finalize-cleanup`.

### 15. 2. Reduce repeated command prefix
**File:** `src/templates/partials/flow-tracking.md`
**Issue:** The `Command` column repeats `sdd-forge flow run` in every row, which adds noise to a tracking template.
**Suggestion:** Add a short sentence before the table such as “Commands are run with `sdd-forge flow run <step>`” and change the column values to only the step command names.

### 16. 1. Add `scenario-validity` to next-action step examples
**File:** `src/templates/skills/sdd-forge.flow/SKILL.md`  
**Issue:** The metric guidance now distinguishes phases from step keys, but the step-key examples omit the newly introduced `scenario-validity` step.  
**Suggestion:** Update the examples to include `scenario-validity`, e.g. `test`, `scenario-validity`, `review-test`, `review`, `gate-impl`, and `retro`.

### 17. 2. Make the scenario-validity artifact path explicitly spec-local
**File:** `src/templates/skills/sdd-forge.flow/SKILL.md`  
**Issue:** The note says `scenario-validity` persists `tests/.raw/scenario-validity.log`, while the preceding phrase says tests are spec-local. The shortened path can be misread as repository-root `tests/.raw`.  
**Suggestion:** Use a clearer path such as `specs/<spec>/tests/.raw/scenario-validity.log` or state that `tests/.raw/scenario-validity.log` is relative to the current spec directory.

### 18. 3. Reduce ambiguity in the Flow Progress Tracking reference
**File:** `src/templates/skills/sdd-forge.flow/SKILL.md`  
**Issue:** “If the current step is listed in **Flow Progress Tracking** exceptions” requires the reader to infer which table row and CLI command correspond to the current step. This is less concrete than the previous explicit command list.  
**Suggestion:** Make the referenced section/table name exact and ensure it maps `step -> command -> post-hook behavior`, or add a short parenthetical with the relevant commands such as `gate`, `impl-confirm`, `finalize-*`, `sync`, `test-execute`, `test-result-review`, and `retro`.

### 19. 1. Align test name with assertion scope
**File:** `tests/unit/flow/flow-steps.test.js`  
**Issue:** The test name says it checks that scenario-validity appears before `review-test`, but the assertion actually verifies the full flow prefix through `review-test`.  
**Suggestion:** Rename the test to reflect the stricter contract, e.g. `has expected planning prefix through review-test`, or narrow the assertion to explicit ordering checks if the full prefix is not intended to be part of the contract.
