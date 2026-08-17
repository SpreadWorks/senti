# Code Review Results

### [ ] 1. Centralize Help Command Metadata
**File:** `src/help.js`
**Issue:** The new flow commands are now maintained manually in multiple places: `LAYOUT`, `src/locale/en/ui.json`, `src/locale/ja/ui.json`, and tests. This creates avoidable duplication and makes help output easy to desynchronize from actual command support.
**Suggestion:** Define command metadata once in a shared registry (for example: `id`, `section`, `descriptionKey`) and generate the help layout from that registry. Locale files should only provide text, not command membership.

**Verdict:** REJECTED
**Reason:** The actual change is simply adding three missing command entries to `LAYOUT` and their locale strings — a straightforward, correct registration of new commands. The proposal to build a shared registry is a speculative architectural change that adds complexity without solving a real bug. The current pattern (declarative array + locale keys) is already clean and easy to maintain for a CLI of this size.

### [x] 2. Finish the `agent` Config Migration and Remove Flat Fallbacks
**File:** `src/lib/types.js`
**Issue:** This change moves validation to `agent.providers`, but the rest of the codebase still supports flat keys like `defaultAgent` and `providers`. That leaves two parallel config shapes and inconsistent naming (`agent.default` vs `defaultAgent`), which weakens design consistency and keeps compatibility code alive unnecessarily.
**Suggestion:** Add a single config-normalization step that converts legacy flat keys into `agent.*`, update consumers to read only the normalized shape, and then remove flat-path fallbacks in a follow-up cleanup. That matches the project’s alpha policy better than continuing dual support.

**Verdict:** APPROVED
**Reason:** The diff moves validation from flat `providers` to `agent.providers` but the `SddConfig` typedef still documents both the old (`defaultAgent`, `providers`) and new (`agent`) shapes. The project explicitly follows an alpha policy that forbids backward-compatibility code. A normalization step + removal of flat fallbacks is a legitimate follow-up that aligns with stated project rules and prevents config shape ambiguity from spreading further.

### [ ] 3. Extract Agent Validation into Dedicated Helpers
**File:** `src/lib/types.js`
**Issue:** Agent validation is currently inline and only partially covers the documented schema. `agent.workDir`, `agent.timeout`, and `agent.providers` are checked, but `agent` itself, `agent.default`, and `agent.commands` are not validated even though they are part of the documented structure. As the schema grows, this style will duplicate checks and become harder to maintain.
**Suggestion:** Introduce helper functions such as `validateAgentConfig()` and `validateAgentProvider()`. Validate the full `agent` object in one place, including documented fields, so the schema and validator stay aligned.

**Verdict:** REJECTED
**Reason:** The current inline validation is ~20 lines covering `agent.providers`. Extracting `validateAgentConfig()` / `validateAgentProvider()` helpers for this volume of code is premature abstraction. The proposal also asks to validate undocumented-in-code fields (`agent.default`, `agent.commands`) that may not yet have stable semantics — adding validation for fields with no consumers risks false rejections and couples the validator to speculative schema.

### [ ] 4. Remove Redundant Schema Tests
**File:** `tests/lib/types.test.js`
**Issue:** The new `agent.providers` assertions duplicate coverage already present in `tests/060-help-layout-validate-config.test.js`, which already tests valid nested providers and missing required fields. This adds maintenance cost without much additional signal.
**Suggestion:** Keep one focused test suite for config-schema migration behavior and remove the overlapping cases from `tests/lib/types.test.js`, or consolidate everything into the numbered regression file.

**Verdict:** REJECTED
**Reason:** The tests in `types.test.js` validate the `validateConfig()` function directly — they are unit tests for that module. The numbered regression file (`060-help-layout-validate-config.test.js`) likely tests integration-level behavior. These serve different purposes. Removing unit tests because an integration test happens to cover similar ground weakens the test pyramid. The project rules also explicitly prohibit modifying tests to make things pass — removing tests to reduce "duplication" is the wrong direction.

### [ ] 5. Replace Stringly-Typed Command IDs with Shared Constants
**File:** `src/help.js`
**Issue:** Command names such as `"flow review"`, `"flow merge"`, and `"flow cleanup"` are repeated as raw strings. This pattern is brittle because renames require manual updates across help text, routing, and tests.
**Suggestion:** Introduce shared command ID constants or export the command list from the routing layer, then reuse those values in help generation and tests. This simplifies future command additions and reduces typo risk.

**Verdict:** REJECTED
**Reason:** The command names (`"flow review"`, etc.) are user-facing identifiers that appear in help output, routing, and locale files. Introducing constants adds indirection without meaningful safety — command renames in a CLI are rare and intentional, and the current grep-ability of string literals is a feature. The cost of a constants module (new file, new imports across the codebase) outweighs the marginal typo-prevention benefit for a small, stable command set.
