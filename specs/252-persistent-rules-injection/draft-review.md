# Draft Review Results

15 issue(s) detected.

### 1. 1. DataSource Adapter Path Conflicts With Request
**QA:** Q4, Q10, Q18  
**Issue:** The request explicitly says `src/docs/data/rules.js`, but the draft repeatedly changes this to `src/docs/data/skills.js` and justifies it with “user-confirmed” context that is not present in the provided issue/request.  
**Suggestion:** Either align the QA with `src/docs/data/rules.js`, or add a QA entry documenting the decision to override the issue text, with concrete evidence from the actual flow notes.

### 2. 2. SSOT Filename Is Ambiguous
**QA:** Q9, Q15  
**Issue:** The request says “Add `skill-rules.json` SSOT”, while the draft specifies `src/templates/skills/rules.json`. That may be correct, but the draft does not explicitly reconcile the filename mismatch.  
**Suggestion:** Add a clarification: whether “skill-rules.json” is a conceptual name or the actual filename. If the actual file is `rules.json`, explain why.

### 3. 3. Phase Inventory Has Internal Count Contradictions
**QA:** Q2, Q9, Q14  
**Issue:** The draft says flow has 21 leaf entries in some places, 22 in Q2 evidence, and full set is 24 entries elsewhere. It also claims shared ids include `impl` while saying `impl` is task-only. These contradictions undermine the proposed canonical enum.  
**Suggestion:** Recompute the exact leaf set from `FLOW_DEFINITION` and `TASK_DEFINITION`, then update all QA entries to use one consistent count and list.

### 4. 4. Request Mentions “Filtered By Phase+State” But Phase Mapping Is Over-Specified Without Issue Support
**QA:** Q2, Q9, Q14  
**Issue:** The scoped phase format `flow.review` / `task.review` may be a good design, but the draft presents it as definitive despite the request only saying “phase+state”. The answer relies heavily on inferred collisions and one example rule.  
**Suggestion:** Add evidence that the issue requires scope-aware phase ids, or reframe this as a design decision needing spec confirmation.

### 5. 5. Loader Body-Quality Enforcement Seems Overreaching
**QA:** Q6  
**Issue:** The request asks for rules injection and SSOT, but Q6 adds deterministic body-quality validation with `DRIFT_PRONE_RULE_IDS`, `RuleBodyQualityError`, and required `Why:` markers. This is a large behavioral constraint not clearly requested.  
**Suggestion:** Split this into a proposed optional guardrail, or ask whether body-quality should be enforced by loader validation versus reviewed manually in spec/tests.

### 6. 6. “Unknown Fields Rejected” Needs Support
**QA:** Q2, Q9  
**Issue:** Strict schema rejection of all unknown JSON fields is asserted, but the request does not mention schema strictness. This is plausible, but unsupported.  
**Suggestion:** Add rationale tied to alpha policy or existing guardrail loader behavior, or soften to “recommended unless contradicted by existing schema patterns.”

### 7. 7. DataSource Error Contract Is Contradictory
**QA:** Q4, Q10  
**Issue:** Q4 says tests cover “DataSource path returns Paragraph or throws”, while also saying the existing resolver catches DataSource errors and returns null. Q10 repeats both behaviors. The boundary is unclear: does caller observe throw or null?  
**Suggestion:** Distinguish direct `SkillsSource.rule()` tests from resolver-mediated tests. Add one explicit assertion for each path.

### 8. 8. `stripDataMarkers` Contract May Conflict With Non-Skill Data Directives
**QA:** Q11  
**Issue:** Q11 says `stripDataMarkers` throws if any non-skill data directive remains in skill templates. That is a strong global constraint on skill template content, but the request only says “stripDataMarkers post-process.”  
**Suggestion:** Add a QA entry asking whether skill templates are allowed to contain future non-rule data directives. If yes, `stripDataMarkers` needs narrower behavior.

### 9. 9. Test Plan Is Too Broad And Partly Duplicative
**QA:** Q5, Q16  
**Issue:** Many test files overlap: loader tests, rule resolution tests, package-files tests, upgrade integration, get-next-action integration. Some assertions are repeated across Q5 and Q16.  
**Suggestion:** Consolidate into unit, integration, and packaging groups. Remove duplicate assertions and mark which tests are required for this issue versus nice-to-have.

### 10. 10. Package Verification Uses Wrong Existing Test Reference
**QA:** Q5  
**Issue:** Q5 proposes `tests/unit/package-files.test.js` but evidence says `tests/unit/package.test.js` already exists. This creates ambiguity about whether to extend or create.  
**Suggestion:** State the intended file definitively after checking existing tests: “append to `tests/unit/package.test.js`” or “create new because package.test.js covers unrelated behavior.”

### 11. 11. CLAUDE.md Append Details Are Unsupported By Provided Request
**QA:** Q12  
**Issue:** The request says “Append 6 rules to CLAUDE.md”, but Q12 invents exact Japanese section title, insertion point, headings, and duplicate-prevention policy. Some may be correct, but evidence is mostly conversational/contextual rather than issue-backed.  
**Suggestion:** Add a QA entry asking for the exact six rule texts and insertion location, or label the current wording as draft proposal rather than contract.

### 12. 12. Issue Body Mutation Requirement Is Out Of Scope
**QA:** Q14  
**Issue:** Q14 says the implementation deliverable must include `gh issue edit 311 --body ...`. The request asks to analyze QA entries and describes implementation scope, but does not require editing the GitHub issue body.  
**Suggestion:** Move this to an open question: “Should the issue body be updated to reflect the 10-rule decision?” Do not make it a mandatory implementation deliverable unless confirmed.

### 13. 13. Missing QA For Performance/Caching In Hot Path
**QA:** NEW  
**Issue:** The primary feature injects rules into every `flow get next-action` response. Q15 mentions in-process caching, but there is no QA entry covering cache invalidation, test isolation, or whether templates changing during upgrade should be reflected without process restart.  
**Suggestion:** Add a QA entry defining loader caching behavior, cache reset for tests, and whether runtime reload is intentionally unsupported.

### 14. 14. Missing QA For Rule Block Formatting
**QA:** Q3  
**Issue:** Q3 says the heading text is “finalized in spec”, which leaves a user-visible output format unresolved. Since this is injected into `instructions.content`, formatting affects long-session salience.  
**Suggestion:** Specify the exact heading, separators, and whether rule bodies are quoted, bulleted, or raw markdown.

### 15. 15. Missing Coverage For The “Append 6 Rules” Source Mapping
**QA:** Q12  
**Issue:** Q12 lists six rules, but the request only says append six rules. The QA does not clearly map each rule to the issue’s rows or prove these are the exact six requested.  
**Suggestion:** Add a table with issue row/source, CLAUDE.md heading, and final body summary, similar to Q14’s skill-rules inventory.
