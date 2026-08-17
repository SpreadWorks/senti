# Spec Review Results

## Verdict: FAIL

## Blocking Findings

### 1. Official help surfaces are underspecified
**Target:** Goal, R2, R7, Acceptance Criteria; src/help.js; src/locale/{en,ja}/messages.json; experimental/workflow/registry.js
**Issue:** The codebase has a static top-level help layout in src/help.js backed by locale keys, and the workflow registry help strings currently hard-code `workflow.js`. The spec only requires routing plus a [EXPERIMENTAL] label for `sdd-forge workflow --help`, and only requires rewriting the skill body. It does not require updating `sdd-forge help` or the subcommand usage strings shown by `sdd-forge workflow <subcommand> --help`.
**Required change:** Add the smallest explicit requirement and acceptance basis that top-level help/locales list `workflow` as an [EXPERIMENTAL] official command and that all workflow dispatcher/registry usage strings use `sdd-forge workflow`, with no remaining user-facing `workflow.js` invocation.
**Why blocking:** Without this, implementation can delete experimental/workflow.js while command-specific help still points users at a removed entrypoint and top-level `sdd-forge help` omits the promoted official command, so the new CLI surface is unsafe to release and cannot be tested correctly.

### 2. CLAUDE.md target relies on a false symlink assumption
**Target:** Decision about CLAUDE.md; R8; Acceptance Criteria
**Issue:** The spec states that root CLAUDE.md is a symlink to AGENTS.md, but the verified codebase has AGENTS.md and CLAUDE.md as separate regular files. R8 says README.md and CLAUDE.md(AGENTS.md), while the acceptance criterion only names README.md and AGENTS.md.
**Required change:** Correct R8 and the acceptance criterion to explicitly require updating README.md, AGENTS.md, and CLAUDE.md in non-generated regions, or explicitly scope out CLAUDE.md with rationale.
**Why blocking:** If the spec is left unchanged, an implementation can update only AGENTS.md and still satisfy the written acceptance criterion, leaving Claude-facing instructions without the experimental warning and making the expected documentation target impossible to test unambiguously.


## Non-blocking Improvements

### 1. Clarify publish agent command id
**Target:** R4; experimental/workflow/lib/commands/publish.js
**Improvement:** State whether `COMMAND_ID = "experimental.workflow.publish"` should be preserved or renamed to `workflow.publish` when the CLI/config namespace moves.
**Why non-blocking:** The current behavior can be preserved by moving the code unchanged, but the migration wording could otherwise invite an accidental agent profile key change.

### 2. Mention config typedef update
**Target:** src/lib/types.js
**Improvement:** Add `workflow.languages` to the JSDoc config typedefs when the runtime schema is updated.
**Why non-blocking:** Runtime validation and command behavior are governed by src/lib/config.js and publish command reads, so missing JSDoc would not block implementation or tests.

### 3. Update architecture overview
**Target:** src/AGENTS.md
**Improvement:** Consider adding src/workflow/ to the command routing and directory structure overview after promotion.
**Why non-blocking:** The spec already requires src/workflow/AGENTS.md and functional routing changes; this broader architecture documentation update is helpful but not necessary to implement or verify the feature.
