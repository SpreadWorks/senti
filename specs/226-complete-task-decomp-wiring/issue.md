## Background

spec 215-flow-task-decomposition was created as a meta-spec to "fill in the missing wiring of the cac6 plan (who calls addTask)", and was merged on 2026-04-23. However, as of now, zero out of 300+ specs have a populated `flow.json.tasks[]`. Investigation revealed that spec 215 has left almost all of the entry/exit wiring essential for production use unimplemented.

## Critical Defects

### A. No instructions for AI to write tasks[] in the plan phase
- `src/flow/prompts/plan/spec.md` — Only instructs Goal / Scope / Requirements; zero instructions to include `tasks[]`
- `src/flow/prompts/plan/draft.md` — Task decomposition is not included in the 7 requirement categories
- `src/templates/skills/sdd-forge.flow/SKILL.md` — Only describes additions via reopen-draft; no instructions for initial decomposition
- Result: `spec.json.tasks[]` is always written empty

### B. currentTaskId is never set in production
- The only place that writes `state.currentTaskId` to a non-null value is `src/lib/flow-store.js:396` (inside `addTask`)
- `addTask()` has no production caller (only re-exported at `flow-manager.js:78`)
- `syncSpecTasksToFlow` intentionally pushes via low-level `mutate()` and does not touch `currentTaskId` (`sync-spec-tasks.js:61`)
- Result: even after sync, `resolveTarget` falls back to flow-scope; task-scope steps are unreachable

### C. completeTask() also has no production caller
- There is no way to advance to the next task (`src/lib/flow-store.js:400`)

### D. The markdown referenced by task.spec is never generated
- During sync, `task.spec = "specs/NNN-xxx/tasks/<id>.md"` is set (`sync-spec-tasks.js:78`)
- There is no implementation that writes to that path anywhere
- `get-next-action` returns this broken path (`get-next-action.js:71`)

### E. No task lifecycle CLI exists
- `registry.js` has no equivalent of `run complete-task` / `start-task` / `set current-task`

## Test Deficiencies

### 1. Acceptance tests avoid the production path
`specs/215-flow-task-decomposition/tests/scenario-reopen-flow.test.js:83-85`

```javascript
// 3. impl phase: mark T-1 as done
const flow1m = loadFlow(tmp);
flow1m.tasks[0].status = "done";   // ← direct flow.json edit
writeFlow(tmp, flow1m);
```

"Marking T-1 as done in the impl phase" is achieved by directly editing JSON rather than production code. The test conceals the fact that there is no pathway to transition `task.status`.

### 2. Unit tests verify correct behavior but nothing calls the code
- `tests/unit/lib/flow-manager-tasks.test.js:57` — Confirms that `addTask()` correctly sets `currentTaskId` ✓
- However, `addTask()` has zero production callers

### 3. Missing integration tests
No spec tests the following:
- Whether AI-generated `spec.json` includes `tasks[]` (no agent test for plan.spec prompt)
- Whether `get-next-action` returns task-scope actions after approval
- Whether the markdown referenced by `task.spec` actually exists
- Whether sync fires via the CLI path of `flow set step approval done` (only direct function calls are tested)

### 4. Blind spots in the 1:1 REQ-to-test structure
Tests only cover full pass of REQ-1 through REQ-12, missing the orthogonal verification of "does this actually work when the spec is complete?" A classic failure of the "requirement omitted from spec" type.

## Wiring Diagram (Current State)

```
plan/spec.md           ─┐ ← does not instruct writing tasks[]
plan/approval.md       ─┤
SKILL.md               ─┘
         │
         ▼
spec.json.tasks[] = []     ← always empty
         │
         ▼ (flow set step approval done)
syncSpecTasksToFlow()       ← no-op because array is empty
         │
         ▼
flow.json.tasks[] = []
currentTaskId = null       ← nobody writes this
         │
         ▼
get-next-action → flow-scope fixed
         │
         ▼
impl/implement.md (flat implementation) ← all specs land here
```

## Missing Wiring

1. **Plan entry**: Add `tasks[]` decomposition instructions to `plan/spec.md` and the same guidance to `SKILL.md`
2. **Task activation**: At the end of `syncSpecTasksToFlow`, if there are pending tasks, promote the first one to `currentTaskId`
3. **Task completion**: When the `update-overview` step is done, call `completeTask(currentTaskId)` and promote the next pending task
4. **Task spec md**: Either generate `specs/NNN-xxx/tasks/<id>.md` during `syncSpecTasksToFlow`, or change `task.spec` to an anchor in `spec.md`
5. **CLI**: equivalent of `flow run complete-task` (for manual recovery)
6. **Integration tests**: agent/CLI tests to verify the above end-to-end

## Conclusion

spec 215 implemented schema + diff sync + monotonic check + reopen-draft + render, but the "initial entry point" and "task-to-task transitions" essential for production use of task decomposition remain missing, and the wiring deficiency from Issue #222 has not been resolved. Task decomposition is currently impossible to initiate in principle. It can be concluded that this was merged without ever being verified against a real execution.

<details>
<summary>ja</summary>

[BUG] タスク分解機能の配線欠落とテスト不備（spec 215 の不完全実装）

## 背景

spec 215-flow-task-decomposition は「cac6 計画の未配線（誰がタスクを addTask するか）を埋める」メタ spec として作られ、2026-04-23 にマージ済み。しかし現時点で flow.json.tasks[] が populated された spec は全 300+ 件中ゼロ件。調査の結果、spec 215 は実運用に必須の入口・出口の配線をほぼ実装していないことが判明した。

## Critical 欠陥

### A. plan フェーズで AI に tasks[] を書かせる指示が存在しない
- src/flow/prompts/plan/spec.md — Goal / Scope / Requirements のみ指示、tasks[] の記載指示ゼロ
- src/flow/prompts/plan/draft.md — 7 つの requirement カテゴリにタスク分解が含まれない
- src/templates/skills/sdd-forge.flow/SKILL.md — reopen-draft 経由の追加しか記述されず、初回分解の指示なし
- 結果: spec.json.tasks[] は常に空のまま書かれる

### B. currentTaskId が production で set されない
- state.currentTaskId を非 null に書くのは src/lib/flow-store.js:396 (addTask 内) のみ
- addTask() には production caller が存在しない (flow-manager.js:78 の再 export のみ)
- syncSpecTasksToFlow は意図的に low-level mutate() で push し currentTaskId を触らない (sync-spec-tasks.js:61)
- 結果: sync しても resolveTarget は flow-scope fallback、task-scope step に到達不能

### C. completeTask() も production caller なし
- 次タスクへ進める手段が存在しない (src/lib/flow-store.js:400)

### D. task.spec で参照する markdown が生成されない
- sync 時に task.spec = "specs/NNN-xxx/tasks/<id>.md" を設定 (sync-spec-tasks.js:78)
- その path に書き込む実装がどこにも存在しない
- get-next-action がこの壊れた path を返す (get-next-action.js:71)

### E. タスクライフサイクル CLI が存在しない
- registry.js に run complete-task / start-task / set current-task 相当なし

## テスト側の不備

### 1. acceptance テストが production path を避けている
specs/215-flow-task-decomposition/tests/scenario-reopen-flow.test.js:83-85

```javascript
// 3. impl フェーズ: T-1 を done にする
const flow1m = loadFlow(tmp);
flow1m.tasks[0].status = "done";   // ← flow.json 直接書き換え
writeFlow(tmp, flow1m);
```

「impl フェーズで T-1 done 化」を production code ではなく JSON 直接編集で実現。task.status を遷移させる経路が無いという事実をテストが隠蔽している。

### 2. ユニットテストが正しい動作を確認しているが誰も呼んでいない
- tests/unit/lib/flow-manager-tasks.test.js:57 — addTask() が currentTaskId を正しく設定することを確認 OK
- しかし addTask() の production caller はゼロ

### 3. 結合テストが欠落
以下をテストする spec なし:
- AI 生成 spec.json に tasks[] が含まれるか (plan.spec prompt の agent test なし)
- 承認後に get-next-action が task-scope の action を返すか
- task.spec で参照される markdown が実在するか
- flow set step approval done の CLI 経路で sync が発火するか (sync 関数直呼びのみ)

### 4. REQ と 1:1 のテスト構造の盲点
REQ-1〜REQ-12 全通過のテストのみで、「spec 完成時に実際に機能するか」というオーソゴナルな観点の確認が抜けている。典型的な「spec に書き漏れた要件」型の失敗。

## 配線図（現状）

```
plan/spec.md           ─┐ ← tasks[] を書けとは言わない
plan/approval.md       ─┤
SKILL.md               ─┘
         │
         ▼
spec.json.tasks[] = []     ← 常に空
         │
         ▼ (flow set step approval done)
syncSpecTasksToFlow()       ← 空配列なので no-op
         │
         ▼
flow.json.tasks[] = []
currentTaskId = null       ← 誰も書かない
         │
         ▼
get-next-action → flow-scope 固定
         │
         ▼
impl/implement.md（フラット実装）に着地 ← 全 spec がこの経路
```

## 不足している配線

1. plan 入口: plan/spec.md に tasks[] 分解指示を追加、SKILL.md に同じ指針
2. task 起動: syncSpecTasksToFlow 末尾で pending task があれば currentTaskId に先頭を promote
3. task 終了: update-overview step done 時に completeTask(currentTaskId) を呼び次の pending を promote
4. task 仕様 md: syncSpecTasksToFlow 時に specs/NNN-xxx/tasks/<id>.md を生成するか、task.spec を spec.md のアンカーに変更
5. CLI: flow run complete-task 相当（手動復旧用）
6. 結合テスト: 上記を end-to-end で検証する agent/CLI テスト

## 結論

spec 215 は schema + 差分同期 + monotonic check + reopen-draft + render を実装したが、タスク分解の実運用に必須な「最初の入口」と「タスク間遷移」は引き続き欠落しており、Issue #222 の配線不足は解消されていない。現時点で原理的にタスク分解が開始できない状態。実機確認が一度もされずマージされたと判断できる。

</details>