# Code Review Results

### [x] 1. Clarify the renamed test prompt
**File:** `src/flow/get/prompt.js`
**Issue:** The choices were changed from test type selection to test creation approach, but the surrounding prompt metadata still reads `テストの種類を選択してください。`. That leaves the prompt name/description semantically behind the new behavior.
**Suggestion:** Rename the prompt concept to something like `test.approach` and update the description to `テストの作成方法を選択してください。` so the key, description, and options all describe the same decision.

**Verdict:** APPROVED
**Reason:** The choices changed from test-type selection (unit/E2E/etc.) to a binary create-or-skip decision, but the prompt key remains `test.type` and description still says `テストの種類を選択してください。` The skill templates already use the updated description (`テストの作成方法を選択してください。`), so the prompt metadata in `prompt.js` is genuinely out of sync with the new behavior. This is a real consistency bug, not cosmetic.

### [ ] 2. Use a less overloaded step name than `spec`
**File:** `src/lib/flow-state.js`
**Issue:** After introducing `prepare-spec`, the remaining `spec` step now specifically means “write/fill the spec”, but `spec` is still too broad and easy to confuse with spec creation or the spec artifact itself.
**Suggestion:** Rename `spec` to something more explicit such as `write-spec` or `fill-spec`, then update the templates accordingly. That makes the phase order self-describing and reduces cognitive overlap with `prepare-spec`.

**Verdict:** REJECTED
**Reason:** The diff already introduced `prepare-spec` and repurposed `spec` to mean "fill/write the spec." The two-step naming (`prepare-spec` → `spec`) is clear enough in context — `prepare-spec` scaffolds, `spec` fills content. Renaming `spec` again to `write-spec` or `fill-spec` would require yet another migration across all skill templates, flow-state, tests, and flow.json files for marginal clarity gain. The cognitive overlap concern is speculative; the current naming is self-describing when read in sequence.

### [ ] 3. Eliminate duplicated step/command definitions across skill templates
**File:** `src/templates/skills/sdd-forge.flow-plan/SKILL.en.md`
**Issue:** The same flow step IDs and CLI command forms are repeated across multiple EN/JA skill templates. This diff had to update many copies of the same command migration (`status` → `get/set/run`) and step rename (`fill-spec` → `prepare-spec`/`spec`), which is a maintenance smell.
**Suggestion:** Move shared command snippets and step lists into reusable template partials or generated placeholders so both languages consume a single source of truth. That will reduce duplication and prevent future drift.

**Verdict:** REJECTED
**Reason:** While the duplication is real, these skill templates are Markdown documents consumed by AI agents at runtime — they need to be self-contained and readable as standalone instructions. Introducing template partials or generated placeholders adds build-time complexity and indirection that could break the agent's ability to parse instructions. The maintenance cost of updating commands across ~8 files during a CLI restructure is a one-time cost that already happened in this diff. The risk of introducing a partial/include system into agent-consumed Markdown outweighs the deduplication benefit.

### [ ] 4. Eliminate duplicated finalize/impl command migrations the same way
**File:** `src/templates/skills/sdd-forge.flow-finalize/SKILL.en.md`
**Issue:** The finalize and impl templates repeat the same command vocabulary changes in both English and Japanese files. Manual duplication makes this design pattern inconsistent over time and increases the chance of one template missing a rename.
**Suggestion:** Extract common command blocks such as “Flow Progress Tracking” and “Commands” into shared generated fragments, then inject localized prose around them. Keep only language-specific narrative in each file.

**Verdict:** REJECTED
**Reason:** Same rationale as proposal 3. The finalize and impl templates share command vocabulary but differ in procedural narrative, step IDs, and behavioral rules. Extracting "shared generated fragments" would couple templates that serve different workflow phases, making independent evolution harder. The duplication is intentional — each skill template is a complete, standalone instruction set for its phase.

### [ ] 5. Add a shared helper for CLI route tests
**File:** `tests/unit/flow/commands/review.test.js`
**Issue:** The test was updated from `flow review` to `flow run review`, but the route/help assertions are still written as ad hoc command invocations. As more commands move under `flow run`, this pattern will duplicate across tests.
**Suggestion:** Introduce a small test helper for invoking flow subcommand help and execution paths, so route migration tests can reuse a single abstraction like `runFlow(["run", "review"])`. This will simplify future command tree refactors.

**Verdict:** REJECTED
**Reason:** There is currently only one test file (`review.test.js`) exercising this pattern. Building a test helper abstraction from a single use case is premature — YAGNI. The current ad-hoc `execFileSync("node", [FLOW_CMD, "run", "review"])` calls are clear, explicit, and easy to understand. If more `flow run <action>` tests emerge and show repeated boilerplate, a helper can be extracted then from concrete examples rather than speculated now.
