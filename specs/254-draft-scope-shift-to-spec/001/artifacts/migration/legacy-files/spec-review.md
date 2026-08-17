# Spec Review Results

## Proposals

### 1. I’ll inspect the guardrail, flow, preset, prompt, and test surfaces around the spec’s scope, then list only concrete spec gaps with file references.The current `.tmp` directory appears not to contain `src/` or `docs/`, so I’m checking the worktree layout before drawing conclusions from the provided context.The actual repository content is one level above `.tmp`, still within the active worktree. I’m reading the relevant modules by relative paths from here, and I’ll avoid changing anything.I found the key code paths: `guardrail.js` currently defaults empty `meta.phase` to `["spec"]`, while gate/get-guardrail already depend on `filterByPhase`. Next I’m checking lint, prompt loading, template deployment, and existing tests for hidden dependencies.### 1. Spec render after spec.json edits
**File:** `src/flow/prompts/plan/spec.md`  
**Issue:** The spec adds new `spec.json` content requirements, especially `[VERIFY]` / `[CORRECTION]` decisions, but does not require re-rendering `spec.md`. The existing approval step presents the full spec text, so it can show stale content.  
**Suggestion:** Add a requirement that spec creation runs `sdd-forge spec render` after updating `spec.json` and before marking the spec step done. Include this in the prompt fixture test.

### 2. 2. Gate retry prompt still targets spec.md
**File:** `src/flow/prompts/plan/gate.md`  
**Issue:** The gate prompt says the AI fixes `spec.md`, but the spec gate validates `spec.json`. With the new creation-time verification records, fixing only rendered markdown would not satisfy the actual gate source.  
**Suggestion:** Add `plan/gate.md` to Scope and require it to say: fix `spec.json`, run `sdd-forge spec render`, then re-run gate.

### 3. 3. Verification text may violate schema limits
**File:** `src/flow/schemas/spec.schema.json`  
**Issue:** R5 requires verification and correction records in `overview.decisions[].text`, but that field has `maxLength: 500`. The spec does not constrain prompt wording to keep `[VERIFY]` / `[CORRECTION]` entries schema-valid.  
**Suggestion:** Specify that prefixed decision `text` must be concise and schema-valid, with details placed in `evidence` or split into multiple decision entries if needed.
