## Background

Currently, the "shape" of the flow is scattered across three locations:

- `src/flow/registry.js` — help / args / pre / post hooks per command
- Procedural next-action derivation logic in `src/flow/lib/get-next-action.js`
- Hardcoded step order via `STEP_MAP` in `src/flow/lib/run-finalize.js`

As a result:

- Despite being a single linear flow, there is no single place to understand "what runs in what order"
- Changes require manually keeping three locations in sync
- Step and command granularity are not aligned, making cross-cutting features like timestamp recording difficult to implement cleanly

### Three-way split of `step in_progress` transition responsibility

`flow get next-action` is a function that "returns instructions for the currently in_progress step," not a function that "returns the next step to proceed to." As a result, the responsibility for advancing a step from pending → in_progress is split across three locations:

1. **The AI itself (the `On start: set step ... in_progress` line in prompts)** — `prompts/plan/{draft,spec,test,approval}.md`, `prompts/impl/implement.md`
2. **CLI command hooks (`pre`/`post` in `registry.js`)** — `flow run gate`, `flow run review`
3. **CLI safety net (`promoteFirstPending` / `promoteNextPending` in `get-next-action.js`)** — a stopgap that catches `NO_IN_PROGRESS_STEP` in the gaps left by 1 and 2, and promotes the first pending step

### Three-layer scatter of retry limits (absorbing former #6e12)

Design retry limits are scattered across code constants, config, and prompt literals:

**Code constants:**
- `src/flow/lib/run-gate.js` — `DEFAULT_GATE_RETRY_MAX = 5`
- `src/flow/commands/review.js` — `MAX_REVIEW_RETRIES = 3`

**Config:**
- `config.flow.retry.max` — a single coarse knob applying the same value to all actions

**Prompt literals (current values):**

| File | Value |
|---------|-----|
| `prompts/plan/gate-draft.md` | 10 attempts |
| `prompts/plan/gate.md` | 20 attempts |
| `prompts/impl/gate-impl.md` | `config.flow.retry.max` (default 3) |
| `prompts/impl/implement.md` | 3 rounds (approach), 5 attempts (test fix) |
| `prompts/impl/review.md` | 3 rounds |
| `prompts/task/impl.md` | 5 attempts (test fix) |
| `prompts/task/review.md` | 3 rounds |
| `prompts/plan/draft.md` | 1 round (Q&A) |

Prompt and code constant values are already inconsistent (gate-impl: prompt says default 3, code says 5).

### Absence of step timestamps (absorbing former #9cd7)

There is no record of when each step in flow.json started or finished. Currently only `state.finalizedAt` and `metrics.<phase>.durationMs` (cumulative agent call time) exist. This can be resolved by having the engine automatically record `startedAt` / `finishedAt` on leaf entry/exit when driven by the definition.

### Impact of spec 235 removing test management (as of 2026-04-27)

Spec 235 has already removed:
- `run-tests.js`, `set-test-summary.js`, `summarize-test-log.js`
- Registry commands `run.tests`, `set.test-summary`
- `write-tests`, `run-tests` (task) and `integration-write-tests`, `integration-run-tests` (flow) from context-rules.json
- Five test-verification functions in run-gate.js (~320 lines)
- `TASK_STEPS_PLAN` reduced to `["impl", "review", "gate-impl"]`

However, `FLOW_STEPS` in `src/lib/flow-helpers.js` still contains `integration-write-tests` and `integration-run-tests`, which is inconsistent with context-rules.json. This will be resolved when the definition is introduced.

`integration-run-all-tests` and `integration-evaluate` remain in context-rules.json and are recorded as skipped in flow.json. In the definition, these will be modeled as skippable nodes.

## Proposal

Introduce a declarative flow definition (blueprint) as primary data, and replace existing procedural logic with definition-driven derivation. Simultaneously, consolidate retry limits into a `maxAttempts` field in the definition, and automate step timestamp recording via engine enter/exit.

## Design Principles

- **The definition expresses the flow itself, not just execution control** — nodes like `implement` where the engine does nothing are also retained
- **Failures complete via fallback** (within designed range, not improvised by AI)
- **Pause only when user consent is unavoidable**
- **Skills hold no decision logic** — skills degrade to pure pass-through that only ask the engine "what's next" and return results back to the engine. Step transitions, fallbacks, and retry limit decisions are all determined by the engine referencing the definition

## Terminology

- **node**: Structural unit (section) composing the flow. Generic term
- **branch**: A node with children but no action (ordered container)
- **leaf**: A node with an action (equivalent to the old "step". "step" is retired from new code)
- **attempt**: Re-entry into a leaf (one trial). `attemptCount` increments on each re-entry
- **action**: The primary path of a leaf
- **fallbacks**: Alternative plans when action fails (array). Each element has an id

## Node Attributes

### Static (Definition side)
- `id` — node identifier (hierarchical path, e.g., `finalize.commit`)
- `label` — display name
- `action` — leaf's primary path `{ id, kind, ... }`
- `fallbacks` — array of alternative plans on failure. Each element `{ id, kind, ... }`
- `children` — branch's child node array
- `requiresApproval` — completion requires approval (rejection treats current attempt as failed and falls back)
- `retryable` — whether in-attempt retries are allowed
- `skippable` — whether conditional skipping is allowed
- `maxAttempts` — re-entry limit. Design values written directly in definition (not delegated to config)
- `onExceedAttempts` — behavior on limit reached (default: pause)

### Dynamic (FlowState side, stored per leaf only)
- `status` — pending / active / done / failed / skipped
- `startedAt`, `finishedAt` — auto-recorded by engine on enter/exit (former #9cd7)
- `attemptCount` — re-entry count
- `usedActionId` — last successful action id (from `action` or `fallbacks[N]`)
- `approvedAt` — approval timestamp (`requiresApproval` only)
- `outputRef` — reference to artifact (spec file path, PR URL, commit SHA, etc.)

Future additions (introduce when needed): `pausedAt`, `resumeCount`, `agentDurationMs`, `taskId`, `skipReason`

### Branch dynamic state
Not stored as a rule (derived from children).

## Node Hierarchy

- Two types: leaf and branch. No mixing allowed
- Parent status / timestamps are derived from children (FlowState stores leaves only)
- Naming uses hierarchical paths (`finalize.commit`)

## Node Order

Expressed via array order. No link attributes like `parentNode` / `prev` / `next`.

## Action Types (2 types)

- **command** — engine executes CLI, success determined by exit code
- **wait** — engine waits for external signal (effectively only `implement`)

## Recovery Design

- Keep the primary path to a single route
- Each leaf has an `action` + `fallbacks` chain, tried in order until success
- **Declarative form (Definition)**: `action` and `fallbacks` are separated (readability priority)
- **Execution form (Engine)**: Normalized to `[action, ...fallbacks]` (processed in single pass)
- When alternatives are exhausted, uniformly pause

## Retry Consolidation (former #6e12)

### Policy
- Write design values directly as `maxAttempts` on each leaf in the definition
- Remove `config.flow.retry.max`. Design values are design decisions, not user settings
- Remove hardcoded numbers from prompts. Prompts describe intent only
- Replace code constants (`DEFAULT_GATE_RETRY_MAX`, `MAX_REVIEW_RETRIES`) with definition references

### Normalization of current values → definition

| leaf | Current (prompt / code) | definition `maxAttempts` |
|------|----------------------|------------------------|
| gate-draft | prompt: 10 | determined in spec |
| gate (spec) | prompt: 20 | determined in spec |
| gate-impl | prompt: default 3 / code: 5 | determined in spec |
| review | prompt: 3 / code: 3 | determined in spec |
| implement (approach) | prompt: 3 | determined in spec |
| draft (Q&A) | prompt: 1 | determined in spec |

Inconsistencies between prompt and code constants will be resolved as design decisions during spec creation.

### Out of scope (continue handling as code constants)
- **Infrastructure retries**: `MAX_RETRY = 5` in `src/lib/agent.js` (backoff on API communication failure) is outside the definition scope

## CLI Mapping

- Basic operation: engine executes children continuously within a branch unit (single `run finalize` call)
- Direct re-execution at leaf level is permitted for recovery (hybrid)
- Maintain minimization of AI call count (original motivation for finalize bundling)

## Definition Placement

- Single file `src/flow/definition.js` / single export `FLOW_DEFINITION`
- No alternate flow concept at this time. Extend when needed (YAGNI)

## Layer Structure (3-layer separation)

```
┌──────────────────────────────────────┐
│ Definition (flow definition)          │
└──────────────────┬───────────────────┘
                   │
┌──────────────────▼───────────────────┐
│ Orchestrator equivalent               │
│ (absorbed into existing layers)       │
└──────────────────┬───────────────────┘
                   │
┌──────────────────▼───────────────────┐
│ FlowState (dynamic state)             │
│ flow.json (nested structure)          │
└──────────────────────────────────────┘
```

No new independent Orchestrator module:

| Current file | Change |
|---|---|
| `src/flow.js` (routing) | No change |
| `src/lib/dispatcher.js` | No change |
| `src/flow/registry.js` | Remove per-command pre/post hooks; replace with generic enter/exit hooks referencing definition |
| `src/flow/lib/get-next-action.js` | Becomes a thin adapter calling `definition.deriveNextAction()` |
| `src/templates/skills/sdd-forge.flow/SKILL.md` safety-net fallback | Removed. Skill simply executes the return value of `flow get next-action` |
| `On start: set step ... in_progress` lines in `src/flow/prompts/{plan,impl}/*.md` | Removed. Step transitions managed by engine via definition enter/exit |
| retry literals in `src/flow/prompts/**/*.md` | Removed. Prompts describe intent only |
| `DEFAULT_GATE_RETRY_MAX` in `src/flow/lib/run-gate.js` | Removed. Reference definition |
| `MAX_REVIEW_RETRIES` in `src/flow/commands/review.js` | Removed. Reference definition |
| `config.flow.retry.max` | Removed |

## New Files

**`src/flow/definition.js` (single file only)**

- `FLOW_DEFINITION` constant
- Traversal helper pure functions:
  - `findActiveNode(state)`
  - `deriveNextAction(state)` — deterministically returns the first pending leaf with a rule (eliminates dependency on in_progress state)
  - `resolveNodeFor(commandName)`
  - `evaluateSkip(state, nodeId)`
  - `normalizeAttempts(node)` — normalization to `[action, ...fallbacks]`

## FLOW_STEPS Cleanup

With the introduction of the definition, clean up `FLOW_STEPS` and related constants in `src/lib/flow-helpers.js`:
- Remove `integration-write-tests`, `integration-run-tests` (already removed from context-rules.json, currently inconsistent)
- Either derive `FLOW_STEPS` itself from the definition, or replace with leaf id enumeration from definition

## flow.json Structure

Stored in nested structure. Priority on flexibility for attribute additions.

## Minimal Form (starting point)

```js
FLOW_DEFINITION = [
  { id: "draft-task", children: [
    { id: "draft-task.draft",
      action: { id: "generate-draft", kind: "command", ... },
      requiresApproval: true,
      maxAttempts: /* determined in spec */,
      fallbacks: [
        { id: "regenerate-with-feedback", kind: "command", ... },
      ]
    },
    { id: "draft-task.gate-draft",
      action: { id: "run-gate-draft", kind: "command", ... },
      maxAttempts: /* determined in spec */ },
  ]},
  { id: "prepare-spec", children: [
    { id: "prepare-spec.branch",       action: { id: "create-branch", kind: "command", ... } },
    { id: "prepare-spec.prepare-spec", action: { id: "prepare",       kind: "command", ... } },
    { id: "prepare-spec.spec",
      action: { id: "generate-spec", kind: "command", ... },
      requiresApproval: true },
    { id: "prepare-spec.gate",
      action: { id: "run-gate", kind: "command", ... },
      maxAttempts: /* determined in spec */ },
  ]},
  { id: "approval",
    action: { id: "await-approval", kind: "wait" },
    requiresApproval: true },
  { id: "implement",
    action: { id: "await-impl", kind: "wait" },
    maxAttempts: /* determined in spec */ },
  { id: "gate-impl",
    action: { id: "run-gate-impl", kind: "command", ... },
    maxAttempts: /* determined in spec */ },
  { id: "integration", children: [
    { id: "integration.run-all-tests",
      action: { id: "run-all-tests", kind: "command", ... },
      skippable: true },
    { id: "integration.evaluate",
      action: { id: "evaluate", kind: "command", ... },
      skippable: true },
  ]},
  { id: "review",
    action: { id: "run-review", kind: "command", ... },
    maxAttempts: /* determined in spec */ },
  { id: "finalize", children: [
    { id: "finalize.finalize",  action: { id: "finalize-start", kind: "command", ... } },
    { id: "finalize.commit",    action: { id: "git-commit",     kind: "command", ... } },
    { id: "finalize.push",
      action: { id: "git-push", kind: "command", ... },
      fallbacks: [
        { id: "pull-rebase-push", kind: "command", ... },
      ]
    },
    { id: "finalize.merge",     action: { id: "merge-pr",  kind: "command", ... } },
    { id: "finalize.cleanup",   action: { id: "cleanup",   kind: "command", ... } },
    { id: "finalize.docs-sync", action: { id: "docs-sync", kind: "command", ... },
      skippable: true },
  ]},
]
```

## Engine Execution Logic (pseudocode)

```
// leaf entry
startedAt = now()
attemptCount += 1
if attemptCount > maxAttempts: pause (ExceedAttempts)

// try action + fallbacks in order
for each a in [action, ...fallbacks]:
  run a
  if command exit != 0: continue
  if requiresApproval:
    wait approval
    if rejected: continue
  node done; usedActionId = a.id
  finishedAt = now()
  break
exhausted → pause
```

## flow.json Migration

- Old flat `steps[]` array → convert to nested structure
- Map old step IDs (e.g., `commit`) to hierarchical IDs (e.g., `finalize.commit`)
- Preserve status / existing metadata
- Remove stale step IDs (`integration-write-tests`, `integration-run-tests`) during migration

## User Experience

- **Unchanged**: skill invocation method, CLI command structure
- **Changed**: flow changes require editing only one location (definition), timestamps are auto-recorded, retry limits are visible in the definition, flow.json uses nested structure

## Incremental Migration

1. Add declaration only (unused, parallel operation)
2. Implement flow.json migration and convert existing data
3. Switch next-action derivation to definition-driven (eliminate dependency on in_progress state)
4. Bundle step transitions into definition enter/exit, remove registry pre/post hooks
5. Remove skill safety-net fallback and prompt `On start` lines (degrade skill to pass-through)
6. Consolidate retry limits to definition `maxAttempts`, remove code constants / config / prompt literals
7. `startedAt` / `finishedAt` auto-recorded by engine enter/exit (former #9cd7 resolved as side effect)
8. Clean up `FLOW_STEPS` remnants (remove `integration-write-tests`, `integration-run-tests`)
9. Migrate remaining procedural conditions into definition

## Acceptance Criteria

- Step transition responsibility is consolidated in a single location — the definition engine (three-way split among registry hooks / prompt text / CLI fallback is resolved)
- Skill is a pure pass-through that executes the return value of `flow get next-action` without holding its own decision logic
- Retry limits are centrally managed by `maxAttempts` in the definition; code constants (`DEFAULT_GATE_RETRY_MAX`, `MAX_REVIEW_RETRIES`), config (`flow.retry.max`), and prompt literals have been removed
- Each leaf's `startedAt` / `finishedAt` is automatically recorded by the engine
- Stale entries in `FLOW_STEPS` (`integration-write-tests`, `integration-run-tests`) have been resolved
- The "shape" of the flow can be understood by reading a single file (`src/flow/definition.js`)

## Absorbed Issues

- **#9cd7** — Per-step start/end timestamp recording. Naturally resolved by engine enter/exit
- **#6e12** — Retry limit consolidation into definition. Resolved by `maxAttempts` attribute and related removals

## Related

- #171 (6fa6) — durationMs (cumulative agent runtime)
- #156 (e99e) — createdAt introduction
- spec 235 — test management removal (the most recent change that altered this issue's preconditions)

<details>
<summary>ja</summary>

[ENHANCE] フロー設計図 (blueprint) を一次データとして導入し registry + next-action の二重管理を解消する

## 背景

現状、フローの「形」は以下の 3 箇所に分散している:

- `src/flow/registry.js` — command ごとの help / args / pre / post フック
- `src/flow/lib/get-next-action.js` の procedural な next-action 派生ロジック
- `src/flow/lib/run-finalize.js` の `STEP_MAP` によるハードコード順序

このため:

- 1 本道のフローであるにもかかわらず「何がどの順で実行されるか」を 1 箇所で把握できない
- 変更時に 3 箇所の整合を人力で保つ必要がある
- step と command の粒度が対になっておらず、時刻記録のような横断機能を素直に実装できない

### step in_progress 遷移責任の 3 者分散

`flow get next-action` は「現在 in_progress の step に対応する指示を返す」関数であり、「次に進むべき step を返す」関数ではない。このため step を pending → in_progress に進める責任が以下 3 箇所に分散している:

1. **AI 自身（prompt の `On start: set step ... in_progress` 行）** — `prompts/plan/{draft,spec,test,approval}.md`, `prompts/impl/implement.md`
2. **CLI コマンドの hook（`registry.js` の pre/post）** — `flow run gate`, `flow run review`
3. **CLI の安全ネット（`get-next-action.js` の `promoteFirstPending` / `promoteNextPending`）** — 上記 1, 2 の隙間で `NO_IN_PROGRESS_STEP` を捕まえ最初の pending を昇格する応急処置

### retry 上限値の 3 レイヤー分散（旧 #6e12 吸収）

設計リトライの上限値がコード定数・config・プロンプト literal の 3 レイヤーに分散している:

**コード定数:**
- `src/flow/lib/run-gate.js` — `DEFAULT_GATE_RETRY_MAX = 5`
- `src/flow/commands/review.js` — `MAX_REVIEW_RETRIES = 3`

**config:**
- `config.flow.retry.max` — 単一ノブ。全 action に同じ値を適用する雑な括り

**プロンプト内 literal（現状の値）:**

| ファイル | 値 |
|---------|-----|
| `prompts/plan/gate-draft.md` | 10 attempts |
| `prompts/plan/gate.md` | 20 attempts |
| `prompts/impl/gate-impl.md` | `config.flow.retry.max` (default 3) |
| `prompts/impl/implement.md` | 3 rounds (approach), 5 attempts (test fix) |
| `prompts/impl/review.md` | 3 rounds |
| `prompts/task/impl.md` | 5 attempts (test fix) |
| `prompts/task/review.md` | 3 rounds |
| `prompts/plan/draft.md` | 1 round (Q&A) |

prompt とコード定数の値が既に不一致（gate-impl: prompt は default 3、コードは 5）。

### step 時刻の不在（旧 #9cd7 吸収）

flow.json の各 step がいつ開始し、いつ終了したかの絶対時刻が記録されていない。現状は `state.finalizedAt` と `metrics.<phase>.durationMs`（agent 呼び出し累積時間）のみ。definition 駆動で leaf 入場/退出に engine が `startedAt` / `finishedAt` を自動記録することで解決する。

### spec 235 によるテスト管理撤去の影響（2026-04-27 時点）

spec 235 により以下が削除済み:
- `run-tests.js`, `set-test-summary.js`, `summarize-test-log.js`
- registry の `run.tests`, `set.test-summary` コマンド
- context-rules.json の `write-tests`, `run-tests`（task）、`integration-write-tests`, `integration-run-tests`（flow）
- run-gate.js のテスト検証 5 関数（~320 行）
- TASK_STEPS_PLAN は `["impl", "review", "gate-impl"]` に縮小

ただし `FLOW_STEPS`（`src/lib/flow-helpers.js`）にはまだ `integration-write-tests`, `integration-run-tests` が残存し、context-rules.json と不整合。definition 導入時に解消する。

`integration-run-all-tests` と `integration-evaluate` は context-rules.json に残存し、flow.json では skipped として記録されている。definition では skippable ノードとしてモデル化する。

## 提案

フローの設計図（definition）を宣言的な一次データとして新設し、既存の procedural ロジックを definition 駆動の派生に置き換える。同時に retry 上限値を definition の `maxAttempts` に集約し、step 時刻記録を engine の enter/exit で自動化する。

## 設計原則

- **definition は動作制御だけでなくフローそのものを表現する** — implement のような engine が何もしない node も保持
- **失敗したら fallback で完走する**（AI の即興に任せず、設計済みの範囲内で）
- **pause はユーザー同意が不可避な時だけ**
- **skill は判断ロジックを持たない** — skill は engine に「次は何か」を聞き、結果を engine に返すだけのパススルーに縮退する。step 遷移、フォールバック、retry 上限判定はすべて engine が definition を参照して決定
... (truncated)