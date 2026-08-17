## Background

As a result of splitting spec 226 into two parts, 226 (the main part) is scoped to only forest wiring scaffolding + basic wiring:

- Addition of guardrail (task-single-responsibility)
- Enhancement of plan prompts (spec.md / draft.md)
- Enhancement of spec.schema.json (tasks[] required, description removed, goal/acceptance/implementation_notes/test_strategy/parent added)
- Auto-generation of tasks/<id>.md in spec render
- sync-spec-tasks parent propagation + auto-promote
- completeTask post-hook for update-overview done (including parent-child propagation)
- Manual recovery CLI (sdd-forge flow run complete-task / start-task)
- Production caller provision for sdd-forge flow run update-overview --json <additions> CLI

This issue summarizes the work to be done **after** spec 226 is merged.

## Scope (to be started after spec 226 is merged)

### A. Recovery and full migration of existing assets

1. **Migration of existing flow.json** — Synthesize 261 specs/*/flow.json files into a non-empty tasks[] state. Follow the spec 208 pattern (place a one-time script at specs/<new-spec>/migrate.js, dry-run, idempotent).
2. **Strictify FlowStore.load** — Change to throw when tasks[] is empty.
3. **Complete removal of get-next-action's flat fallback path** — Remove the flow-scope fallback when tasks[] is empty, and assume tasks[] is always non-empty.
4. **Deletion of spec 215 scenario-reopen-flow.test.js** — Due to it not going through the production path and being non-functional.

### B. Full integration of parts implemented only as scaffolding in spec 226

5. **Auto-integrate overview merge into impl execution path via run-impl.js post-hook** — While 226 provides the `sdd-forge flow run update-overview` CLI, the automatic wiring for the impl step (a path where the overview is merged without the AI explicitly calling the CLI) will be wired in 3f91.
6. **Direct call to forest traversal within get-next-action.resolveTarget** — While 226 controls forest order via promoteNextPending, integration into the path that references forest within resolveTarget is deferred to 3f91.
7. **Expansion of 226's placeholder tests (it.todo in tests/unit/226-task-decomp-wiring/*.test.js) into real tests** — 226 placed it.todo as spec scaffolding. Expansion into real tests and forest dogfood will be done in 3f91.

### C. New E2E integration test

8. **Addition of new E2E integration test** — Placed under tests/e2e/. From tasks[] 2 items → approval → sync → currentTaskId set → task-scope next-action → each task completed → next promote → all completed → transition to finalize step — **zero direct flow.json edits, all via CLI, PASS**.

### D. Forest dogfood

9. **Forest dogfood validation** — Decompose own spec into forest structure (parent task = concern boundary, child task = work unit). First serious use of the forest path created in 226 (promoteNextPending / completeTask parent-child propagation / update-overview CLI) on the consumer side.

## Dependencies

- spec 226 (forest wiring scaffolding) must be merged
- spec 226's CLI (sdd-forge flow run complete-task / start-task / update-overview, etc.) must be operational
- New guardrail / prompts from sdd-forge upgrade must be reflected in the consumer project

## Related

- Among the points raised in Issue #256, basic wiring and scaffolding are resolved in spec 226. This issue handles **full integration, remaining issues, and dogfood validation**.
- The Acceptance Criteria of spec 226 do not directly require the E2E test implementation of this issue (out of scope). The dogfood / E2E / full wiring requirements of spec 226 are completed in the form covered by this issue.

<details>
<summary>ja</summary>

[ENHANCE] spec 226 完了後の consumer 作業: 既存 flow migration + 215 test 削除 + forest dogfood E2E test

## 背景

spec 226 を 2 分割した結果、226（本体）は forest 配線の scaffolding + 基本配線のみに絞る:

- guardrail (task-single-responsibility) の追加
- plan prompts (spec.md / draft.md) の強化
- spec.schema.json の強化（tasks[] 必須化、description 削除、goal/acceptance/implementation_notes/test_strategy/parent 新設）
- spec render で tasks/<id>.md 自動生成
- sync-spec-tasks の parent 転写 + auto-promote
- update-overview done の completeTask post-hook（親子 propagation 含む）
- 手動復旧 CLI (sdd-forge flow run complete-task / start-task)
- sdd-forge flow run update-overview --json <additions> CLI の production caller 提供

この本 Issue は spec 226 マージ**後に**行う作業をまとめる。

## Scope（spec 226 マージ後に着手）

### A. 既存資産の救済と完全移行

1. **既存 flow.json の migration** — 261 件の specs/*/flow.json を tasks[] 非空状態へ合成。spec 208 パターン（一度きり script を specs/<new-spec>/migrate.js に配置、dry-run、idempotent）。
2. **FlowStore.load の strict 化** — tasks[] 空で throw するよう変更。
3. **get-next-action の flat fallback 経路の完全廃止** — tasks[] 空時の flow-scope fallback を削除、tasks[] 非空を前提にする。
4. **spec 215 scenario-reopen-flow.test.js の削除** — production path を通さず機能不全のため。

### B. spec 226 で scaffolding のみ実装した部分の完全統合

5. **run-impl.js post-hook で overview merge を impl 実行パスに自動統合** — 226 では `sdd-forge flow run update-overview` CLI を提供しているが、impl step の自動 wire（AI が明示的に CLI を呼ばなくても overview が merge される経路）は 3f91 で配線する。
6. **get-next-action.resolveTarget 内での forest traversal の直接呼び出し** — 226 では promoteNextPending 経由で forest 順を制御しているが、resolveTarget 内で forest を参照する経路への統合は 3f91。
7. **226 の placeholder tests (tests/unit/226-task-decomp-wiring/*.test.js の it.todo) の実テストへの展開** — 226 では spec scaffolding として it.todo を配置。実テストへの展開と forest dogfood は 3f91 で行う。

### C. 新規 E2E integration test

8. **新 E2E integration test の追加** — tests/e2e/ 配下に配置。tasks[] 2 件 → approval → sync → currentTaskId 設定 → task-scope next-action → 各 task 完了 → 次 promote → 全完了 → finalize step への遷移まで **flow.json 直接編集ゼロ、CLI 経由一本で PASS**。

### D. forest dogfood

9. **forest dogfood 検証** — 自 spec を forest 構造で分解（親 task = concern 境界、子 task = 作業単位）。226 で作った forest 経路（promoteNextPending / completeTask 親子 propagation / update-overview CLI）を consumer 側で初めて本格利用する。

## 依存関係

- spec 226（forest 配線の scaffolding）が merge されていること
- spec 226 の CLI（sdd-forge flow run complete-task / start-task / update-overview 等）が動作可能であること
- sdd-forge upgrade により新 guardrail / prompt が consumer project に反映されていること

## 関連

- Issue #256 の指摘事項のうち、基本配線と scaffolding は spec 226 で解消。本 Issue は**完全統合・残存課題・dogfood 検証**を担う。
- spec 226 の Acceptance Criteria では本 Issue の E2E test 実装を直接要求しない（scope 外）。spec 226 の dogfood / E2E / 完全 wire 要件は本 Issue でカバーされる形で完結する。

</details>