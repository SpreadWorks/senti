## Background

The flow system has `definition.js` and `registry.js`.

`definition.js` is the flow blueprint. It is where the available steps, their order, phase, action, maxAttempts, and sideEffects are defined.

`registry.js` is the CLI command registry. It defines which module a subcommand such as `sdd-forge flow run gate` dispatches to, what arguments it accepts, what appears in help, and how pre/post/onError hook connection points are held.

Currently this boundary has broken down, and flow decisions have leaked into lifecycle hooks in `registry.js`. For example, decisions such as which steps to mark done/skipped based on review results, which later steps to skip when finalize fails, and how to resolve a runtime log step from a phase are hardcoded on the registry side.

## Decisions

### 1. Keep registry.js

Removing `registry.js` is not the goal.

`registry.js` remains as the CLI command registry. It should contain CLI execution layer information.

- subcommand list
- `command: () => import(...)`
- `args`
- `help`
- `requiresFlow`
- `requiresConfig`
- `pre/post/onError` connection points called by the dispatcher

However, hooks must not directly decide step ids or phase structure. Any required decision should be queried through definition-side APIs.

Example:

```js
post(ctx, result) {
  return applyLifecycle(ctx, result);
}
```

### 2. Centralize flow decisions on the definition side

`definition.js` should be the place that knows how the flow should proceed.

`registry.js` should be the place that knows how to accept CLI commands and which command module to call.

Decisions derivable from the flow structure should be centralized on the definition side.

- step list and order
- phase-to-step mapping
- action-to-step mapping
- maxAttempts
- contextKinds
- sideEffects
- structural relationships among review/gate/finalize
- basic step status transitions based on success, failure, or verdict
- resolving subsequent steps that should be skipped
- resolving runtime log steps

### 3. Store lifecycle declaratively on FlowNode

Basic lifecycle behavior should be stored declaratively on `FlowNode`.

However, not everything should be forced into configuration. Complex processing should escape into normal JavaScript functions.

Candidate basic primitives:

1. `SetStepStatus` — step status transition
2. `KeepInProgress` — keep the current step in progress on failure, etc., without completing it
3. `IncrementMetric` — metric recording
4. `AppendIssueLog` — append to issue-log
5. `ExecuteSideEffects` — execute side effects such as completeTask and promoteNextTask
6. `SkipSteps` — skip subsequent steps
7. `RunLifecycleHook` — escape hatch for processing that cannot be expressed with basic primitives

Lifecycle contents should be represented by dedicated classes, not object literals. Because TypeScript is not used, each lifecycle action should be a class that enforces its invariants.

Example:

```js
new FlowNode({
  id: "impl-gate",
  action: "run-gate",
  maxAttempts: 5,
  sideEffects: ["completeTask", "promoteNextTask", "mergeOverview"],
  lifecycle: {
    post: {
      pass: [
        new SetStepStatus({ step: "self", status: "done" }),
        new ExecuteSideEffects(),
      ],
      fail: [
        new KeepInProgress({ step: "self" }),
        new AppendIssueLog({ source: "gate-result" }),
      ],
    },
    onError: [
      new AppendIssueLog({ source: "gate-error" }),
    ],
  },
})
```

### 4. Use an escape hatch for complex processing

Processing such as `finalize-commit` and `finalize-merge`, which includes git operations, metadata commits, switching main repo authority, reports, and issue comments, should not be forcibly pushed into declarative lifecycle definitions.

In those cases, call a dedicated module function through an action such as `RunLifecycleHook`.

Example:

```js
new RunLifecycleHook({
  module: "finalize",
  handler: "recordMergeOutcome",
})
```

Boundary:

- definition side: how to change step statuses, which side effect types to execute
- script side: decision details, artifact contents, issue-log body generation, git/filesystem operations, external state operations

### 5. Do not raw-export FLOW_DEFINITION / TASK_DEFINITION

Do not raw-export `FLOW_DEFINITION` / `TASK_DEFINITION` from the start.

External code should not touch definition data directly, and should query it through APIs instead.

Expected API examples:

- `flowDefinition.getNode(id)`
- `flowDefinition.getMaxAttempts(id, context)`
- `flowDefinition.getSideEffects(id)`
- `flowDefinition.resolveRuntimeStep(ctx, result)`
- `flowDefinition.resolveLifecycle(ctx, result)`
- `taskDefinition.getNode(id)`

The goal is for callers to not need to know the internal structure of the definition data.

### 6. Separate steps tree utilities from definition.js

Utilities that operate only on the `steps` array in `flow.json`, such as `flattenSteps`, `findStepById`, `findFirstPendingLeaf`, and `findInProgressLeaf`, should be separated from `definition.js`.

Candidate: `src/flow/lib/step-tree.js`

These are not definition data itself. They are utilities for reading, searching, and advancing flow state. In practice, they are used from many places other than definition, such as `flow-store.js`, `flow-manager.js`, `get-next-action.js`, `get-status.js`, and `registry.js`.

Separation:

- `step-tree.js`: functions that operate only on the steps array, such as `flattenSteps`, `findStepById`, `findFirstPendingLeaf`, and `findInProgressLeaf`
- definition-side APIs: functions that require knowledge of definition order or flow/task scope, such as `findLatestInProgressLeaf` and `findActiveNode`

## Issues

### 1. registry.js knows too much about flow decisions

`registry.js` should be the CLI entry point, but it currently handles step ids and phase structure directly inside hooks.

Examples:

- marking `spec-review`, `spec-triage`, and `spec-repair` done when spec review is PASS/ADVISORY
- marking `test-review` done when test review is PASS/ADVISORY
- marking `finalize-sync` and `finalize-cleanup` skipped when finalize-merge fails
- resolving runtime log step ids from review phases using a registry-specific map

These are not CLI command definitions. They are flow transition, completion, and recovery rules. Therefore, they should move toward definition-side responsibility.

### 2. Definition data in definition.js is not sufficiently encapsulated

`FLOW_DEFINITION` and `TASK_DEFINITION` are exported as raw data, and many callers directly handle their internal structure with code such as `resolveNodeFor(FLOW_DEFINITION, id)`.

With this shape, changes to the definition data structure ripple across a wide area. Callers should not touch definition data directly, and should query it through query APIs.

### 3. Definition-dependent logic is scattered across multiple places

The same kinds of decisions are scattered across multiple files.

- phase resolution exists in multiple places
- gate/review step resolution exists in multiple places
- maxAttempts retrieval is spread across commands
- sideEffects retrieval is implemented separately in multiple places
- next-step promotion and completion decisions exist in multiple places

These are pieces of knowledge derivable from the definition, so they should be centralized in definition-side query APIs.

### 4. definition.js itself has mixed responsibilities

`definition.js` currently mixes the following:

- flow definition data
- query functions for definition data
- generic tree utilities for operating on the `steps` array in `flow.json`

tree utilities should be separated into another module, and `definition.js` should focus on the flow definition and decisions derivable from that definition.

## Non-goals

### Removing registry.js is not the goal

The goal is not to remove `registry.js`. `registry.js` is necessary as the CLI command registry.

The problem is not the existence of `registry.js`; it is that `registry.js` contains flow decisions.

### Turning definition.js into a huge DSL is not the goal

Even when lifecycle behavior is moved toward declarative definitions, the vocabulary should not grow too much. Processing that cannot be expressed with basic primitives should escape through an escape hatch.

### Do not keep backward-compatible exports for phased migration

Following the alpha policy, implement the correct shape from the start. Do not keep raw exports of `FLOW_DEFINITION` / `TASK_DEFINITION` for compatibility purposes.

## Expected State

- When changing steps or phases, the main place to inspect is the definition side
- `registry.js` stays thin as the CLI entry point
- command implementations do not directly know the internal structure of `FLOW_DEFINITION` / `TASK_DEFINITION`
- review/gate/finalize completion, skip, and sideEffect rules are derivable from one place
- the same step id maps or phase maps are not reimplemented in multiple places
- flow state tree utilities are separated from definition, and users import them from modules that match their responsibilities

## Notes

If declarative lifecycle is designed incorrectly, it will become a hard-to-read custom DSL. Keep the boundary between primitives and the escape hatch clear.

Existing hooks include not only simple status transitions but also artifact validation, issue-log generation, switching to main repo authority, finalize metadata commits, and more. Do not force these into definition. Preserve the boundary between flow decisions and execution side effects.

## Integrated From

- old 0844: Integrate lifecycle hooks from registry.js into definition.js (#287)
- old c166: Refactor definition.js: responsibility separation and encapsulation

<details>
<summary>ja</summary>

[ENHANCE] flow definition/registry 責務整理: フロー判断を definition 側へ集約

## 背景

flow には `definition.js` と `registry.js` がある。

`definition.js` はフローの設計図であり、どんな step があり、順序・phase・action・maxAttempts・sideEffects がどう定義されるかを持つ場所である。

`registry.js` は CLI コマンドの受付表であり、`sdd-forge flow run gate` などの subcommand をどの module に dispatch するか、どんな引数を受けるか、help に何を出すか、実行前後の hook 接続点をどう持つかを定義する場所である。

現状はこの境界が崩れており、`registry.js` の lifecycle hook にフロー判断が入り込んでいる。たとえば review 結果に応じてどの step を done/skipped にするか、finalize 失敗時にどの後続 step を skip するか、phase から runtime log step をどう解決するか、といった判断が registry 側に直書きされている。

## 決定事項

### 1. registry.js は残す

`registry.js` を消すことは目的ではない。

`registry.js` は CLI command registry として残す。ここには CLI 実行レイヤーの情報を置く。

- subcommand の一覧
- `command: () => import(...)`
- `args`
- `help`
- `requiresFlow`
- `requiresConfig`
- dispatcher が呼ぶ `pre/post/onError` の接続点

ただし、hook の中では step id や phase 構造を直接判断しない。必要な判断は definition 側 API に問い合わせる。

例:

```js
post(ctx, result) {
  return applyLifecycle(ctx, result);
}
```

### 2. フロー判断は definition 側へ集約する

`definition.js` は「フロー上どう進むべきか」を知る場所にする。

`registry.js` は「CLI コマンドをどう受け付け、どの command module を呼ぶか」を知る場所にする。

フローの構造から導ける判断は definition 側に集約する。

- step 一覧と順序
- phase と step の対応
- action と step の対応
- maxAttempts
- contextKinds
- sideEffects
- review/gate/finalize の構造的関係
- 成功・失敗・verdict に応じた基本的な step status 遷移
- skip すべき後続 step の解決
- runtime log step の解決

### 3. lifecycle は FlowNode に宣言的に持たせる

基本的な lifecycle は `FlowNode` に宣言的に持たせる。

ただし、すべてを設定で表現しようとしない。複雑な処理は普通の JavaScript 関数に逃がす。

候補となる基本プリミティブ:

1. `SetStepStatus` — step 状態遷移
2. `KeepInProgress` — fail 時などに現在 step を完了させず、そのまま作業中に保つ
3. `IncrementMetric` — metric 記録
4. `AppendIssueLog` — issue-log 追記
5. `ExecuteSideEffects` — completeTask, promoteNextTask などの side effect 実行
6. `SkipSteps` — 後続 step の skip
7. `RunLifecycleHook` — 基本プリミティブで表現しきれない処理への escape hatch

lifecycle の中身はオブジェクトリテラルではなく、専用クラスで表現する。TypeScript を使わない方針のため、各 lifecycle action は class として invariant を持つ。

例:

```js
new FlowNode({
  id: "impl-gate",
  action: "run-gate",
  maxAttempts: 5,
  sideEffects: ["completeTask", "promoteNextTask", "mergeOverview"],
  lifecycle: {
    post: {
      pass: [
        new SetStepStatus({ step: "self", status: "done" }),
        new ExecuteSideEffects(),
      ],
      fail: [
        new KeepInProgress({ step: "self" }),
        new AppendIssueLog({ source: "gate-result" }),
      ],
    },
    onError: [
      new AppendIssueLog({ source: "gate-error" }),
    ],
  },
})
```

### 4. 複雑な処理は escape hatch に逃がす

`finalize-commit` や `finalize-merge` のように、git 操作、metadata commit、main repo authority 切り替え、report/issue comment などを含む処理は、無理に宣言的 lifecycle へ押し込まない。

その場合は `RunLifecycleHook` のような action で専用 module function を呼ぶ。

例:

```js
new RunLifecycleHook({
  module: "finalize",
  handler: "recordMergeOutcome",
})
```

境界線:

- definition 側: どの step 状態をどう変えるか、どの side effect 種別を実行するか
- script 側: 判定の詳細、artifact の中身、issue-log 本文生成、git/filesystem 操作、外部状態操作

### 5. FLOW_DEFINITION / TASK_DEFINITION の生 export はしない

`FLOW_DEFINITION` / `TASK_DEFINITION` は最初から外部に生 export しない。

外部コードは定義データを直接触らず、API 経由で問い合わせる。

想定 API 例:

- `flowDefinition.getNode(id)`
- `flowDefinition.getMaxAttempts(id, context)`
- `flowDefinition.getSideEffects(id)`
- `flowDefinition.resolveRuntimeStep(ctx, result)`
- `flowDefinition.resolveLifecycle(ctx, result)`
- `taskDefinition.getNode(id)`

目的は、呼び出し元が定義データの内部構造を知らなくてもよい状態にすることである。

### 6. steps tree utility は definition.js から分離する

`flattenSteps`, `findStepById`, `findFirstPendingLeaf`, `findInProgressLeaf` など、flow.json の `steps` 配列だけで動く utility は `definition.js` から分離する。

候補: `src/flow/lib/step-tree.js`

これらは定義データそのものではなく、flow state を読む・探す・進めるための utility である。実際に `flow-store.js`, `flow-manager.js`, `get-next-action.js`, `get-status.js`, `registry.js` など definition 以外の多くの場所から使われている。

分け方:

- `step-tree.js`: `flattenSteps`, `findStepById`, `findFirstPendingLeaf`, `findInProgressLeaf` など、steps 配列だけで動くもの
- definition 側 API: `findLatestInProgressLeaf`, `findActiveNode` など、definition の順序や flow/task scope の知識が必要なもの

## 課題

### 1. registry.js がフロー判断を知りすぎている

`registry.js` は CLI の入口であるべきだが、現在は hook 内で step id や phase 構造を直接扱っている。

例:

- spec review が PASS/ADVISORY の場合に `spec-review`, `spec-triage`, `spec-repair` を done にする
- test review が PASS/ADVISORY の場合に `test-review` を done にする
- finalize-merge 失敗時に `finalize-sync`, `finalize-cleanup` を skipped にする
- review phase から runtime log step id を registry 独自の map で解決する

これらは CLI コマンド定義ではなく、フロー上の遷移・完了・回復ルールである。したがって definition 側の責務に寄せる。

### 2. definition.js の定義データが十分にカプセル化されていない

`FLOW_DEFINITION` と `TASK_DEFINITION` が生データとして export され、多くの呼び出し元が `resolveNodeFor(FLOW_DEFINITION, id)` のように内部構造を直接扱っている。

この形だと、定義データの構造変更が広範囲に波及する。呼び出し元は定義データを直接触るのではなく、query API を通して問い合わせる。

### 3. 定義に依存するロジックが複数箇所に分散している

同じ種類の判断が複数ファイルに散っている。

- フェーズ解決が複数箇所にある
- gate/review の step 解決が複数箇所にある
- maxAttempts 取得が各 command に分散している
- sideEffects 取得が複数箇所で別々に実装されている
- 次 step 昇格や完了判定が複数箇所にある

これらは definition から導ける知識なので、definition 側の問い合わせ API に集約する。

### 4. definition.js 自体も責務が混ざっている

`definition.js` には現在、以下が混在している。

- フロー定義データ
- 定義データに対するクエリ関数
- flow.json の `steps` 配列を操作する汎用 tree utility

tree utility は別モジュールへ分離し、`definition.js` は「フロー定義と、その定義から導ける判断」に集中させる。

## 非目標

### registry.js を消すことは目的ではない

目的は registry.js をなくすことではない。registry.js は CLI command registry として必要である。

問題は registry.js の存在ではなく、registry.js がフロー判断を持っていることである。

### definition.js を巨大な DSL にすることは目的ではない

lifecycle を宣言的に寄せる場合でも、語彙を増やしすぎない。基本プリミティブで表現できない処理は escape hatch に逃がす。

### 段階移行用の後方互換 export は置かない

alpha 版方針に従い、最初から正しい形へ実装する。`FLOW_DEFINITION` / `TASK_DEFINITION` の生 export を互換目的で残さない。

## 期待する状態

- step や phase を変更するとき、主に definition 側を見れば判断できる
- registry.js は CLI 入口として薄く保たれる
- command 実装が `FLOW_DEFINITION` / `TASK_DEFINITION` の内部構造を直接知らない
- review/gate/finalize の完了・skip・sideEffect のルールが一箇所から導ける
- 同じ step id map や phase map を複数箇所で再実装しない
- flow state の tree utility は definition と分離され、利用者が責務に合った module から import する

## 注意点

宣言的 lifecycle の設計を誤ると、読みづらい独自 DSL になる。プリミティブの範囲と escape hatch の境界を守ること。

既存の hook には、単純な状態遷移だけでなく、artifact validation、issue-log 生成、main repo authority への切り替え、finalize metadata commit なども含まれる。これらを無理に definition に押し込まず、フロー判断と実行副作用の境界を保つ。

## 統合元

- 旧 0844: Integrate lifecycle hooks from registry.js into definition.js (#287)
- 旧 c166: definition.jsのリファクタリング: 責務分離とカプセル化

</details>