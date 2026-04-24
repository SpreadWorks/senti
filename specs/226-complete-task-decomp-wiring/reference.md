# Reference: 226-complete-task-decomp-wiring

本ファイルは draft 段階の議論で確認した事実、検討した設計、具体的な実装詳細のメモである。draft.md 本体は要件レベルに集約しているため、spec phase 以降の実装判断の根拠として本ファイルを参照する。

## 1. 背景の事実確認

### 1.1 Issue #256 の指摘

spec 215-flow-task-decomposition は「cac6 計画の未配線を埋める」メタ spec としてマージされたが、以下が未実装:

- **A**: plan フェーズで AI に tasks[] を書かせる指示が `src/flow/prompts/plan/spec.md` / `draft.md` / `SKILL.md` のどこにもない
- **B**: `state.currentTaskId` を非 null に書く production caller が存在しない（`FlowManager.addTask` は存在するが呼び出し元なし）
- **C**: `completeTask()` も同様に production caller なし
- **D**: `task.spec` が指す `specs/NNN-xxx/tasks/<id>.md` path に markdown を書き込む実装が存在しない
- **E**: タスクライフサイクル CLI が registry.js に存在しない
- テスト側: `specs/215-flow-task-decomposition/tests/scenario-reopen-flow.test.js` が task 状態遷移を `flow.json` 直接編集で代用し、production path を avoid している

結果、全 300+ spec で `flow.json.tasks[]` が空のまま運用されている。

### 1.2 タスク分解関連 spec の系譜

| Spec | Issue | 追加内容 | 未配線で残った部分 |
|---|---|---|---|
| 196 (cac6/T2) | #183 | flow.json schema に tasks[] / currentTaskId / Task.parent 追加。FlowManager.addTask/completeTask プリミティブ追加 | parent の運用経路、addTask/completeTask の production caller |
| 199 | #189 | `flow run draft-task` の production 配線（addition-origin、spec 215 で撤去） | - |
| 208 (cac6/T11) | #204 | 旧資産の一度きり migration script | - |
| 215 | #222 | spec.json.tasks[] を SSOT に昇格、reopen-draft CLI、approval post-hook で sync、addition-origin 撤去 | Issue #256 の欠陥 A-E |
| 226 | #256 | 215 が残した本体配線を完成 | `3f91` に分離した部分（救済＋dogfood） |

### 1.3 パターン: schema 先行 / 運用未配線

spec 196 (parent フィールド) と spec 215 (tasks[] / reopen-draft) で同じ失敗パターンが繰り返されている:

- 新しい data model field を schema に定義する
- 書き込む primitive API を追加する
- しかし production caller を配線しない
- 結果、field や API は存在するが運用では使われない

本 spec 226 は同じパターンを避けるため、以下を厳守する:
- 新規 field / API を追加するときは必ず production caller を同一 spec 内で配線する
- integration test で「spec 承認 → タスク実行 → タスク完了」の end-to-end が production path で動くことを verify する（ただし本 spec の scope では unit + 最小 integration。完全な E2E は `3f91`）

## 2. 事前調査の結果

### 2.1 現行の task-scope step

`src/lib/flow-helpers.js:60-62`:

```js
export const TASK_STEPS_PLAN = [
  "gate", "approval", "write-tests", "impl", "run-tests", "review", "update-overview",
];
```

`src/flow/schemas/context-rules.json` の task scope に対応する step:
- approval → await-approval
- gate → run-gate
- write-tests → write-tests
- impl → run-impl
- run-tests → run-tests
- review → run-review
- update-overview → update-overview

### 2.2 現行の sync-spec-tasks の動作

`src/flow/lib/sync-spec-tasks.js`:

- spec.json.tasks[] と flow.json.tasks[] を比較し、新規 id のみを flow.json に append
- `parent` は常に `null` 固定で生成（spec.json 側に parent フィールドがないため）
- `currentTaskId` は一切触らない（低レベル `_store.mutate()` で push するのみ）
- 結果、sync 後も `currentTaskId` は null のまま、task-scope に遷移できない

### 2.3 現行の get-next-action の動作

`src/flow/lib/get-next-action.js`:

- `resolveTarget(state)` が `findCurrentTask(state)` と `findInProgress(state.steps)` を順に試し、flat な tasks[] をスキャンするのみ
- 親子関係（forest）の理解なし
- tasks[] が空のとき、flow-scope の step を返す flat fallback 経路が残っている（`get-next-action.js:59-61`）

### 2.4 spec.schema.json の tasks[*] 定義

```json
{
  "type": "object",
  "required": ["id", "title", "description", "origin", "added_round", "status"],
  "additionalProperties": false,
  "properties": {
    "id": {"type": "string", "minLength": 1, "maxLength": 100},
    "title": {"type": "string", "minLength": 1, "maxLength": 200},
    "description": {"type": "string", "maxLength": 2000},
    "origin": {"type": "string", "enum": ["plan"]},
    "added_round": {"type": "integer", "minimum": 0},
    "status": {"type": "string", "enum": ["pending", "in_progress", "done", "skipped"]}
  }
}
```

- parent フィールドは定義されていない
- top-level `required` に `tasks` は含まれない（tasks は optional）
- top-level `additionalProperties: false`

### 2.5 既存 spec.json / flow.json の統計

- spec.json を持つ spec: 326 件、全件 `tasks: undefined`（キー自体なし）
- flow.json を持つ spec: 261 件（finalized 済みは cleanup 済み）、全件 `tasks: []`（空配列）
- 本プロジェクト内で他 worker の並行 worktree: 存在しない

### 2.6 guardrail 構造

`src/presets/base/guardrail.json`:
- 既存 26 件のうち、phase に `task-impl` を含むものが 7 件存在（task-level guardrail 運用の前例あり）
- `single-responsibility` guardrail は phase=["draft", "spec"]、category="process"
- task-level の Single Responsibility guardrail は未定義

`src/flow/lib/run-gate.js` は phase `task-spec` / `task-impl` を認識済み（`level=task` の gate 機構あり）。新 guardrail を追加するだけで評価される構造。

### 2.7 update-overview の動作（spec 207）

`src/flow/lib/run-update-overview.js` / `src/flow/prompts/task/update-overview.md`:

- task 実装後、AI が additions の JSON を emit（modules / data_flow / decisions の 3 カテゴリ）
- CLI が `applyOverviewAdditions` で spec.json.overview に append-only merge（各 entry に `added_by_task: <taskId>` 自動タグ）
- spec.md を `renderSpecMarkdown` で再生成

目的は task 貢献を parent spec.json.overview に反映すること。独立 step として運用されてきたが、本 spec では impl step 内に内包する方針（Q20 参照）。

### 2.8 skill 構成の現状

- メイン: `sdd-forge.flow`（単一 dispatcher）
- 補助: `flow-auto` / `flow-resume` / `flow-status` / `flow-sync` / `exp.workflow`
- 撤去済み: `flow-plan` / `flow-impl` / `flow-finalize`
- dead reference: `src/flow/lib/resolve-context-envelope.js:30-38` の `phaseToSkill()` が撤去済み skill 名を返す → 別 Issue `fd80` で追跡

### 2.9 upgrade コマンドの範囲

`src/upgrade.js` は skills と AGENTS.md の SDD セクションのみ更新する。`src/presets/base/guardrail.json` や `src/flow/prompts/plan/*.md` は触らない（runtime で preset chain / src/ から直接読まれる）。

本 spec は SKILL.md を変更しないため、consumer 側は `sdd-forge upgrade` 不要。`npm update sdd-forge` で全変更が反映される。

### 2.10 agent test の範囲

`tests/agent/` 配下は `report.test.js` 1 ファイルのみ。plan 系 prompt を呼ぶ agent test は存在しない。本 spec の prompt 変更で既存 agent test が壊れることはない。

## 3. 議論で採用した設計

### 3.1 spec.json.tasks[*] の新スキーマ（Q19）

description を削除し、以下のフィールドに分解:

```json
{
  "id": "T-1",                                   // string, 1-100 文字
  "title": "forest traversal 実装",             // string, 1-200 文字
  "goal": "tasks[] が forest のとき、...",      // required, 1000 文字
  "acceptance": [                               // optional, 配列、各 500 文字
    "子 task が in_progress なら parent は待機",
    "全 child done で parent が自動 done",
    "unit test が 3 パスをカバー"
  ],
  "implementation_notes": "resolveTarget を ...",  // optional, 5000 文字
  "test_strategy": "unit: 3 階層 forest...",       // optional, 2000 文字
  "parent": null,                                  // optional, string|null
  "origin": "plan",
  "added_round": 0,
  "status": "pending"
}
```

top-level の `tasks` は引き続き optional（既存 326 spec.json は tasks undefined なので影響なし）。タスク必須化は spec gate 側の判定ロジックで行う。

### 3.2 自動生成される tasks/<id>.md の想定レイアウト

```markdown
# T-1: forest traversal 実装

## Goal
tasks[] が forest のとき、子から親へ順次 traverse して currentTaskId を自動遷移させる

## Acceptance Criteria
- 子 task が in_progress なら parent は pending 維持
- 全 child が done になると parent が自動的に done
- unit test が 3 パス（root/parent/leaf）をカバー

## Implementation Notes
get-next-action.js の resolveTarget を pre-order traversal に書き換え。
helpers.js に traverseForest() を新設。promoteFirstPending は leaf を優先。

## Test Strategy
unit: 3 階層 forest fixture で 3 パス。
integration: 新 CLI 2 件 forest で end-to-end 1 サイクル。

---
Status: pending | Parent: (root) | Added Round: 0
```

### 3.3 task-scope step の再設計（Q20）

```js
// 新 TASK_STEPS_PLAN
["write-tests", "impl", "run-tests", "review", "gate-impl"]
```

各 step の内部動作:

| Step | AI が行うこと | CLI が行うこと |
|---|---|---|
| write-tests | test_strategy に従って test 作成（RED 確認） | flow get context で implementation_targets block |
| impl | implementation_notes に従って実装 + spec.json.overview 追記 | applyOverviewAdditions 呼び出し |
| run-tests | （AI は関与せず）| test 自動実行、pass 確認 |
| review | 質的評価 + simplify/DRY 等 auto-correct | - |
| gate-impl | （AI は gate の evaluator を invoke）| task 単位の guardrail 評価、PASS で post-hook |

gate-impl PASS post-hook の動作:
1. `completeTask(currentTaskId)` を呼ぶ
2. 親子 propagation: parent の全 child が done なら parent も done
3. 次 pending task を auto-promote（forest 順、leaf 優先）
4. 全 task done なら currentTaskId = null → flow-scope の finalize へ

### 3.4 forest 構造の運用設計（Q11）

- spec.schema.json の tasks[*] に `parent: string | null` を追加
- `sync-spec-tasks.js` の buildFlowTask で `parent: null` 固定を撤廃、spec.json 側の parent を転写
- `get-next-action.js` の resolveTarget を forest traversal に変更
  - 次の実行タスクは「最も深い pending leaf から」
  - 兄弟は配列順
- `completeTask` 側で親子 propagation
  - 子 task を done にしたとき、親 task の全子が done なら親も done に遷移
  - 再帰的に遡る

### 3.5 task-single-responsibility guardrail（Q9）

```json
{
  "id": "task-single-responsibility",
  "title": "Task Single Responsibility",
  "body": "Each task within a spec shall address one concern. A task whose title or description connects unrelated actions (e.g. 'Add X and refactor Y' where X and Y have no shared concern) shall be split. Tasks whose implementation targets span unrelated modules without a shared concern shall be split.",
  "meta": {
    "phase": ["spec", "task-spec"],
    "category": "process"
  }
}
```

### 3.6 plan prompts への追加内容（Q6, Q19）

**`src/flow/prompts/plan/spec.md`** に追加するセクション（イメージ）:

```
## Task Decomposition Rules

Each task in spec.json.tasks[] shall address a single concern within the spec.

- title shall be expressible as one verb phrase (e.g. "Add auto-promote to sync"). 
  Do not connect unrelated actions with "and".
- Unrelated sub-changes shall be split into separate tasks.
- implementation_notes (if declared) shall share a common concern.
- If description contains multiple independent acceptance criteria,
  each shall be split into its own task.

Each task shall include:
- goal: 1 sentence stating the task's purpose
- acceptance: verifiable criteria (bullet list)
- implementation_notes: design considerations, files touched
- test_strategy: what to test at what granularity

These rules are enforced by the `task-single-responsibility` guardrail
in phase=[spec, task-spec].
```

**`src/flow/prompts/plan/draft.md`** に追加する抽象的予告（イメージ）:

```
Note: 後続の spec 段階で要件をタスクに分解する。
要件整理時は、各要件群が単一の concern に収まるよう意識せよ
（タスク分解粒度の制約は spec 段階の task-single-responsibility guardrail で評価される）。
```

### 3.7 新 CLI の想定インターフェース（Q5）

- `sdd-forge flow run complete-task [--task-id <id>]` — 現 task または指定 task を done、次 pending promote
- `sdd-forge flow run start-task --task-id <id>` — 指定 task を in_progress に promote（手動復旧用）

envelope shape は既存 flow run コマンドに揃える（`{ok, type, key, data, errors}`）。

### 3.8 タスクライフサイクル全体像

```
[plan phase]
  AI が spec.json.tasks[] に goal/acceptance/implementation_notes/test_strategy/parent を記入
       ↓
  sdd-forge spec render → specs/NNN-xxx/tasks/<id>.md 自動生成
       ↓
[approval phase (flow-scope)]
  user が spec 全体を approve
       ↓
  sync-spec-tasks → flow.json.tasks[] 差分反映 + auto-promote (forest leaf 優先)
       ↓
[task-scope loop (5 step × task 数)]
  ┌────────────────────────────────────────┐
  │                                        │
  ↓                                        │
  Step 1: write-tests                      │
  ↓                                        │
  Step 2: impl (含 spec.json.overview 追記) │
  ↓                                        │
  Step 3: run-tests                        │
  ↓                                        │
  Step 4: review                           │
  ↓                                        │
  Step 5: gate-impl                        │
  ↓                                        │
  gate-impl PASS post-hook:                │
    - completeTask(current)                │
    - 親子 propagation                     │
    - 次 pending task auto-promote         │
  └────────────────────────────────────────┘
  ↓ (全 task done)
[flow-scope finalize step]
```

## 4. 226 の Critical 欠陥 A-E への対応（Issue #256）

| 欠陥 | 226 での対応 |
|---|---|
| A: plan フェーズで tasks[] 書かせる指示なし | plan/spec.md prompt に Task Decomposition Rules 追加、各タスク必須フィールド指示 |
| B: currentTaskId が production で set されない | sync-spec-tasks 末尾で auto-promote（pending 先頭、forest leaf 優先） |
| C: completeTask() の production caller なし | gate-impl PASS post-hook で completeTask + 次 promote |
| D: task.spec の markdown が生成されない | spec render で tasks/<id>.md を自動生成（spec.json SSOT） |
| E: タスクライフサイクル CLI なし | `flow run complete-task` / `start-task` を registry に追加 |
| テスト: acceptance test が production path を avoid | `3f91` で削除（個別関数 unit test は既存で網羅） |

## 5. 後続 Issue（226 スコープ外）

### 5.1 board draft `3f91` — 226 完了後の consumer 作業

- 既存 flow.json 261 件の migration script（spec 208 パターン踏襲）
- FlowStore.load の strict 化（tasks[] 空で throw）
- get-next-action.js の flat fallback 経路の完全廃止
- spec 215 の scenario-reopen-flow.test.js 削除
- 新 E2E integration test（tests/e2e/ 配下、CLI 経由で end-to-end）
- 自 spec を forest 構造で分解した dogfood 検証

### 5.2 board draft `212f` — gate-impl REQ-SPEC 甘判定強化

- spec 215 で「diff + head test pass」で通過した判定の構造問題
- spec の Acceptance Criteria / Test Strategy に test 識別子を mapping
- gate-impl が該当 test の exit code と新規 test の存在を直接確認
- 「spec で約束した test が実在しない」「PASS evidence が無い」を FAIL reason に追加

### 5.3 board draft `fd80` — phaseToSkill dead reference 解消

- `src/flow/lib/resolve-context-envelope.js:30-38` の修正
- 撤去済み skill 名（flow-plan/flow-impl/flow-finalize）を `sdd-forge.flow` に集約
- または `recommendedSkill` フィールド自体の必要性を再検討
