# Spec Review Results

## Proposals

### 1. Specの抜け漏れ確認なので、まず実コード側の flow/registry/prompt/test/config 参照を横断して、Scope に入っている変更の波及先を洗います。コード変更はしません。この worktree の `.tmp` 直下に通常の `src/` が見えていないようです。まず配置を確認して、実体が別階層にあるのか、生成前の一時ディレクトリなのかを切り分けます。Git の top-level は `.tmp` の親ディレクトリでした。以後は active worktree の範囲内で、読み取りだけを root から行います。主要な旧テスト実行点は prompts だけでなく、`flow run tests` という CLI コマンド自体にも残っていそうです。そこを中心に、registry と i18n/help/docs まで依存関係を追います。### 1. Finalize Prerequisite Check
**File:** `src/flow/lib/get-check.js`  
**Issue:** `flow get check finalize` uses branch-level prerequisites only, so adding `retro` before `finalize-commit` may still allow finalize readiness without checking `test-execute`, `test-result-review`, `gate-impl`, or `retro`.  
**Suggestion:** Add a requirement to update `derivePrereqs` / `get-check` so nested same-branch predecessor steps are included, and add regression tests.

### 2. 2. Resolve Context Progress
**File:** `src/flow/lib/resolve-context-envelope.js`  
**Issue:** The spec mentions flattening nested steps for `get-status`, but `resolve-context` also computes `currentStep` and progress from top-level `state.steps`. New nested impl children will be misreported to the flow skill.  
**Suggestion:** Add `resolve-context-envelope.js` to Scope and require flattened step handling there too.

### 3. 3. Legacy Test Command Config
**File:** `src/lib/config.js`  
**Issue:** `commands.test.task/parent` remains in the config schema, which conflicts with the design principle that test runner selection is delegated to the AI agent rather than configured declaratively.  
**Suggestion:** Explicitly remove or deprecate `commands.test`, and update `tests/unit/lib/config-schema-commands-test.test.js` plus docs references.

### 4. 4. Gate Side Effects Scope
**File:** `src/flow/definition.js`  
**Issue:** Flow-level `gate-impl` currently carries task side effects (`completeTask`, `promoteNextTask`, `mergeOverview`). With integration gate moving before `retro`, a PASS could promote tasks or run task-specific effects in the flow-level path.  
**Suggestion:** Specify that side effects belong only to `TASK_DEFINITION` gate-impl, while flow-level integration gate-impl has no task side effects.

### 5. 5. Stale Prompt Consumer List
**File:** `src/flow/prompts/plan/spec.md`  
**Issue:** The prompt still describes `testable` consumers as “test step gate, retro static evaluation...” which is stale after moving execution to `test-execute` and making retro read-only.  
**Suggestion:** Add this prompt to Scope and update the consumer list to `test-review`, `test-execute`, `test-result-review`, `gate-impl`, and read-only `retro`.

### 6. 6. Duration Review Has No Data Source
**File:** `src/flow/schemas/test-execute-result.schema.json`  
**Issue:** R3 requires `test-result-review` to verify “duration consistency,” but R2’s `test-execute-result.json` schema does not include duration fields.  
**Suggestion:** Add `duration_ms` or equivalent timing fields to the result schema, or remove duration consistency from the required reviewer checks.

### 7. 7. Verdict Case Contradiction
**File:** `src/flow/lib/run-review.js`  
**Issue:** R48 says all verdict values are lowercase, but existing review/test-review parsing and R8/R9 use uppercase `PASS` / `FAIL`.  
**Suggestion:** Clarify whether lowercase applies only to new persisted artifacts, or require updating review command output/parsers and related tests to lowercase.

### 8. 8. “Once Per Spec” Contradicts Re-Run Reset
**File:** `src/flow/lib/run-review.js`  
**Issue:** The constraints say tests run once per spec, but R16 resets `test-execute` after review fixes, and FAIL loops can re-enter implementation.  
**Suggestion:** Reword the constraint to “once per `test-execute` invocation / cycle, no cache,” not once for the entire spec lifecycle.

### 9. 9. Retro Step Completion Conflict
**File:** `src/flow/prompts/impl/retro.md`  
**Issue:** R25 says the retro prompt includes step completion handling, while R46 says registry post-hooks should mark new steps done and prompts should not require manual `flow set step done`.  
**Suggestion:** Align the spec: retro prompt should only run `sdd-forge flow run retro`; registry post-hook owns step completion.
