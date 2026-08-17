# Code Review Results

### [x] 1. Centralize Flow Subcommand Metadata
**File:** `src/flow.js`
**Issue:** The `get/set/run` command names and descriptions are now duplicated across the dispatcher help text, [`src/help.js`](/home/nakano/workspace/sdd-forge/.sdd-forge/worktree/feature-095-flow-command-foundation/.tmp/src/help.js), and both locale files. This increases drift risk when subcommands or descriptions change again.
**Suggestion:** Define a single flow command registry that contains command ids, module paths, and help/summary metadata, then reuse it in the dispatcher, help layout generation, and localized UI bindings.

**Verdict:** APPROVED
**Reason:** The diff shows command names and descriptions duplicated across `flow.js`, `help.js`, `en/ui.json`, and `ja/ui.json` — four locations that must stay in sync manually. A single registry consumed by the dispatcher and help system would genuinely reduce drift risk. This is a structural improvement, not cosmetic.

### [ ] 2. Rename `SCRIPTS` to Reflect Dispatcher Semantics
**File:** `src/flow.js`
**Issue:** `SCRIPTS` is generic and no longer communicates that this object is specifically a subcommand routing table for the flow CLI.
**Suggestion:** Rename it to something more intention-revealing such as `FLOW_SUBCOMMANDS`, `SUBCOMMAND_MODULES`, or `FLOW_DISPATCH_TABLE` to align with the dispatcher role and improve consistency with the surrounding help text.

**Verdict:** REJECTED
**Reason:** This is cosmetic. `SCRIPTS` is a module-private constant used in exactly one place. Renaming it has no behavioral impact and negligible readability gain — the surrounding comment and file context already make its purpose clear. Not worth the churn.

### [ ] 3. Avoid Exporting a Low-Level Mutation Primitive Prematurely
**File:** `src/lib/flow-state.js`
**Issue:** Exporting `mutateFlowState` broadens the public surface of the flow-state module with a generic mutator API. That can make call sites less explicit and encourage ad hoc state edits instead of named operations, which weakens design consistency.
**Suggestion:** Prefer keeping `mutateFlowState` private unless multiple concrete commands already require it. If shared write access is needed, expose narrower domain methods like `updateStepStatus`, `updateRequirementStatus`, or `setFlowMetadata` so state transitions stay explicit.

**Verdict:** REJECTED
**Reason:** `mutateFlowState` is already consumed by two concrete command modules (`set/redo.js`, `set/metric.js`), both of which perform domain-specific logic (resetting steps, recording metrics) that doesn't fit neatly into a small set of named wrappers. The export is justified by real usage. Wrapping every mutation in a dedicated function would bloat the API surface of `flow-state.js` further — it already has six internal callers doing the same load-mutate-save pattern. The generic primitive is the right abstraction here.

### [x] 4. Replace the Placeholder Comment with Targeted Coverage
**File:** `tests/unit/flow.test.js`
**Issue:** A large test block was removed and replaced with a comment pointing to other files. The comment itself is dead weight once the suite is reorganized, and it provides no executable safety against routing/help regressions.
**Suggestion:** Delete the placeholder comment and keep coverage discoverable through actual test file names. If not already present elsewhere, add a small focused dispatcher test for `flow --help` and invalid/missing subcommand handling rather than relying on documentation comments in the test file.

**Verdict:** APPROVED
**Reason:** The replacement test files (`routing.test.js`, `get-status.test.js`, `set-step.test.js`) do exist, so coverage was relocated rather than lost. The remaining placeholder comment is dead weight — it provides no executable value and will rot. Deleting it and relying on the actual test file names for discoverability is the right call. If `routing.test.js` already covers dispatcher help and invalid-subcommand handling, the comment adds nothing; if it doesn't, the comment masks a gap that should be an actual test.
