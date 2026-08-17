# Code Review Results

### [ ] 1. ### 1. Clarify Issue Number Semantics
**File:** `src/lib/flow-state.js`
**Issue:** `setIssue(workRoot, issue)` and `state.issue` are ambiguous names. The stored value is not an issue object or issue text, but a GitHub issue number. This weakens readability and makes future extension harder if issue metadata is added later.
**Suggestion:** Rename to something explicit such as `setIssueNumber` / `setLinkedIssueNumber`, and store it as `state.issueNumber` or `state.linkedIssueNumber`. Apply the same naming in `status.js` and tests for consistency.

2. ### 2. Extract Repeated Positive-Integer Parsing
**File:** `src/flow/commands/status.js`
**Issue:** The `--issue` branch embeds validation and parsing logic inline (`Number(...)`, integer check, positive check, error handling). This makes `main()` longer and less uniform, and the same pattern is likely to recur for other numeric CLI options.
**Suggestion:** Move this into a small helper such as `parsePositiveIntegerOption(cli.issue, "--issue")` or a generic CLI validator. That keeps the command dispatcher focused on actions and improves design consistency across options.

3. ### 3. Remove Duplicated Flow Setup in Tests
**File:** `tests/unit/flow.test.js`
**Issue:** The new `setupFlow(dir)` helper inside `describe("setIssue")` duplicates the existing flow-state setup pattern already used elsewhere in the same test file (`setupFlowState(tmp)` and similar initialization). This increases maintenance cost when the default flow-state shape changes.
**Suggestion:** Reuse the existing shared setup helper if possible, or extract a single generic fixture builder for all flow-state tests. Keep only one canonical way to create a valid flow state.

4. ### 4. Reduce Repetition in Skill Template Updates
**File:** `src/templates/skills/sdd-forge.flow-plan/SKILL.en.md`
**Issue:** The new issue-related instructions are inserted in both English and Japanese skill templates with nearly identical structure and command examples. Maintaining parallel manual edits across both files is error-prone.
**Suggestion:** If the template system allows it, centralize the command examples or shared workflow fragments in one reusable source and localize only the explanatory text. If that is not possible, at least keep the issue-handling block compact and isolated so future edits stay synchronized.

5. ### 5. Avoid Redundant Test Coverage by Consolidating CLI Assertions
**File:** `tests/unit/flow.test.js`
**Issue:** The new tests cover `--issue` set, reject invalid value, and display in status output separately, but each re-creates the same CLI invocation scaffolding (`execFileSync`, identical env, repeated setup). The assertions are valid, but the test structure is repetitive.
**Suggestion:** Introduce a small test helper for invoking `flow status` with arguments and environment, or a helper like `runFlowStatus(tmp, ...args)`. This simplifies the test body and makes future CLI option tests cheaper to add.

**Verdict:** REJECTED
**Reason:** The current naming (`issue` / `setIssue`) is consistent with how GitHub CLIs and APIs refer to issues by number (e.g., `gh issue view 17`). The field stores a number and the context is unambiguous — `state.issue` holding `17` clearly means "issue #17." Renaming to `issueNumber` or `linkedIssueNumber` is cosmetic verbosity that would touch multiple files (state, CLI, templates, tests) with zero behavioral improvement. If issue metadata is added later, that's the time to restructure — not now.
