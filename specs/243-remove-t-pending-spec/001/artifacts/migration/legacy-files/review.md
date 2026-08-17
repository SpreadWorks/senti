# Code Review Results

### [x] 変更差分に含まれる4ファイルだけを対象に、周辺実装も見て重複・命名・不要コード・設計整合性・単純化の観点で確認します。作業ディレクトリ直下ではなく、worktree 配下の別ディレクトリにソースがあります。配置を確認してから対象ファイルを読みます。変更の妥当性は見えています。残っている候補は、同じ変更意図をより直接に表すテストの単純化があるかどうかです。テスト側の単純化は確認できました。追加で、変更ファイル内に残る重複や設計不整合がないかだけ見ています。### 1. Rename the flow-state validator and remove repeated path formatting
**File:** `src/lib/flow-store.js`  
**Issue:** `assertTaskSchema()` no longer describes what the function actually validates. It now checks the overall `flow.json` shape (`tasks`, `currentTaskId`, top-level `metrics`/`notes`, and legacy per-task fields), so the current name is misleading. Inside the same function, `sourcePath || "<unknown>"` is repeated across multiple error branches, which makes future message changes easy to drift.  
**Suggestion:** Rename the function to something like `assertFlowStateSchema()` or `assertFlowStateShape()`, and hoist `const displayPath = sourcePath ?? "<unknown>";` at the top. If you want to go one step further, add a tiny local helper for building repeated `"Path: ..."` error suffixes so schema errors stay uniform.

**Verdict:** APPROVED
**Reason:** `assertTaskSchema` is a private (non-exported) function in `flow-store.js`, so renaming carries no API risk. Its scope has clearly outgrown "task schema" — it validates `tasks`, `currentTaskId`, top-level `metrics`/`notes`, and per-task legacy fields — so a more accurate name (`assertFlowStateSchema`) improves readability. The `sourcePath || "<unknown>"` literal is repeated 6 times; hoisting it once is a low-risk, behavior-preserving cleanup that aligns with the project's DRY guidance ("実装時に既存コードと同じパターンが2箇所以上で繰り返される場合、共通ヘルパーに抽出").

### [x] 2. Make the empty-tasks test direct and reuse the existing fixture helper
**File:** `tests/unit/227-post-226-forest-integration/t-a2-strict-load.test.js`  
**Issue:** The new `"accepts empty tasks array"` test creates a non-empty flow, loads it, mutates `state.tasks` to `[]`, saves it, and reloads it. That adds setup noise unrelated to the behavior under test, and it duplicates task fixture structure already centralized in the test helpers.  
**Suggestion:** Initialize the target state directly with `setupFlow(tmp, { tasks: [], currentTaskId: null })` and load once, or use `makeFlowState({ tasks: [], currentTaskId: null })` if you want the fixture to be explicit. For the non-empty case, reuse `makeDefaultTask()` instead of another inline task literal. This makes the tests shorter, clearer, and more consistent with the shared fixture pattern.

**Verdict:** APPROVED
**Reason:** The shared helper (`tests/helpers/flow-setup.js`) already exposes `makeFlowState`, `makeDefaultTask`, and `setupFlow` with overrides — exactly the abstractions the proposal recommends. The current test's "create non-empty → load → mutate → save → reload" sequence is indirect and inlines a task literal that duplicates `DEFAULT_TASK`. Using `setupFlow(tmp, { tasks: [], currentTaskId: null })` and a single `fm.load()` better expresses the new "accepts empty tasks" behavior, and `makeDefaultTask()` removes the inline duplicate in the non-empty case. This is consistent with the project's "モジュールのカプセル化" / DRY guidance and does not change what is being asserted.
