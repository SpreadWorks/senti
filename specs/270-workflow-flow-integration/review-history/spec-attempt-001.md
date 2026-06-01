# Spec Review Results

## Verdict: FAIL

## Blocking Findings

### 1. issue-log-import approval-to-draft path has no integration point in the non-interactive command model
**Target:** R3 / src/workflow/lib/commands/issue-log-import.js
**Issue:** Workflow subcommands run as single-shot, non-interactive commands: src/workflow/index.js loads boardConfig, calls execute(ctx) once, prints a JSON envelope and exits — there is no stdin/approval round-trip (publish.js and add.js confirm this model), and the planned registry entry exposes only --spec. Yet R3 and T-3 require the issue-log-import command itself to present all issue-log entries as candidates, obtain user approval, and create board drafts for only the approved ones. A non-interactive command cannot both collect user approval and receive which entries were approved (no selection input is defined). The Data Flow likewise folds candidate-presentation, user-approval, and 'workflow add 相当' draft creation into a single issue-log-import invocation, which the command execution model cannot satisfy.
**Required change:** Specify the approval boundary explicitly: either (a) issue-log-import emits candidate entries only (no gh/board writes) and finalize-cleanup.md orchestrates the Choice Format approval and invokes workflow add per approved candidate, or (b) add an explicit approved-selection input to issue-log-import (e.g., a second invocation carrying selected entry ids) and define how the skill collects and passes it. Name which component performs the board draft write.
**Why blocking:** Without a defined approval mechanism and a clear command-vs-skill division, implementers cannot build the 'approved-only' draft creation, and AC2/T-3 ('未承認・スキップ時は0件作成') has no observable approval input to design a test against.


## Non-blocking Improvements

### 1. Specify how draft.md / finalize-cleanup.md determine flowIntegration value
**Target:** R4, R5 / src/flow/prompts/plan/draft.md, src/flow/prompts/impl/finalize-cleanup.md
**Improvement:** R1's enable helper is internal JS not reachable from skill templates, and no CLI query for flowIntegration is defined. State concretely how the AI reads the flag in the template (e.g., read .sdd-forge/config.json, consistent with existing config.lang references in draft.md) so the conditional block has a defined data source.
**Why non-blocking:** The AI can read .sdd-forge/config.json directly — an existing, established path already used for config.lang — so the gating instruction is still actionable even without spec-level wording.

### 2. Behavior when flowIntegration=enable but no board/gh is undefined
**Target:** R2, R6 / src/workflow/index.js (loadBoardConfig)
**Improvement:** The dispatcher unconditionally calls loadBoardConfig() (gh CLI) before any subcommand executes and fails with NO_BOARD when no same-named GitHub Project exists or gh is unavailable. R2 only covers item-not-found (matched=false) and R6 covers disable/unset invariance; the enable-but-no-board / gh-missing path returns an error envelope into the draft/finalize step. Consider specifying expected handling for that case.
**Why non-blocking:** Opting into flowIntegration=enable implies a board and gh are present; this is a config-misuse edge that does not block the disable/unset invariance or the core enable happy-path.
