# Draft Review Results

7 issue(s) detected.

### 1. 関連ファイルの実装とテスト名を確認して、QA の根拠が実コードとずれていないかを見ます。今回はレビューのみで、コード変更はしません。指定された worktree の `.tmp` 直下には `src/` が見えていないため、まず実際の配置を確認します。worktree 境界は越えずに、現在のディレクトリ配下だけを見ます。### 1. Unsupported Scope Exclusion For Docs
**QA:** Q11  
**Issue:** The answer relies on `scope.out`, which is not included in the provided request or evidence. It also dismisses `docs/configuration.md` and `src/AGENTS.md` too broadly even though adding profile properties/config schema may affect user-facing configuration guidance.  
**Suggestion:** Reframe as a real spec question: “Should generated/user-facing config docs be regenerated or explicitly excluded?” Cite only available project rules or draft scope if present, and distinguish generated `docs/` from source/config schema changes.

### 2. 2. Weak Justification For `jsonSchemaMode` Default
**QA:** Q4  
**Issue:** The answer states `jsonSchemaMode` missing defaults to `inline` because it is the “most-common-case,” but that is a design assertion without evidence. It also does not clarify whether this default is for backward behavior preservation, user profile ergonomics, or alpha-policy simplification.  
**Suggestion:** Make the rationale explicit: defaulting to `inline` preserves the current non-codex behavior when a schema flag exists, while builtin codex profiles must set `file`. Alternatively, ask whether `jsonSchemaMode` should be required when `jsonSchemaFlag` is present.

### 3. 3. Builtin Profile Coverage Is Too Concrete And Brittle
**QA:** Q3  
**Issue:** The answer enumerates specific builtin profile keys (`claude/opus`, `claude/sonnet`, `codex/gpt-5.4`, `codex/gpt-5.3`) but does not state whether these are exhaustive in the current codebase. If additional builtin profiles exist, the spec could miss them.  
**Suggestion:** Change the QA to require updating every profile returned by each provider’s `builtinProfiles()`, then list current keys as evidence from the codebase snapshot.

### 4. 4. Config Override Semantics Need Stronger Product Decision
**QA:** Q8  
**Issue:** The answer asserts full replacement is acceptable because this is alpha, but the issue is about migrating provider methods to profile properties. Existing user-defined provider overrides may silently lose JSON schema support if they override a builtin profile without the new properties. That behavioral impact is not framed as a decision/risk.  
**Suggestion:** Add a concrete compatibility question: “Do existing user overrides of builtin profile keys need migration support or warning?” If the answer remains no, explicitly tie it to the alpha policy and document the user-visible consequence.

### 5. 5. Test File Targeting Is Under-Evidenced
**QA:** Q9  
**Issue:** The proposed tests are good conceptually, but the evidence only says those test files exist. It does not justify why `types.test.js` is the right place for config validation, nor whether existing config schema tests live elsewhere.  
**Suggestion:** Make the test strategy location-agnostic or cite actual existing test responsibilities. For example: “Add config schema validation tests in the existing config/schema test file; if that is `types.test.js`, cover valid `inline/file` and invalid values.”

### 6. 6. Redundant Scope Entries Around Templates And Docs
**QA:** Q10, Q11  
**Issue:** Both entries mainly decide what is out of scope. They overlap on generated/project artifacts and do not add much spec-driving value compared with implementation behavior and test coverage questions.  
**Suggestion:** Merge them into one “Generated artifacts and upgrade impact” QA covering templates, presets, generated docs, and whether `sdd-forge upgrade` or `sdd-forge build` is required.

### 7. 7. Missing Coverage For Removal Acceptance Criteria
**QA:** NEW  
**Issue:** The request explicitly asks to remove the `agent.js` `provider.constructor.key` hardcoded branch, but no QA defines a clear acceptance criterion for complete removal beyond tests that would fail if behavior remains.  
**Suggestion:** Add a QA entry requiring no production references to `provider.constructor.key` for schema behavior and no `jsonSchemaFlag()` provider method calls after the migration, verified by repository search.
