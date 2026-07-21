## Problem

The raw core Agent passed to standalone plugin commands reuses the active FlowManager in the current working directory as the implicit authority for prompt-cache, logger, and metrics. As a result, agent calls from `senti workflow refine` and `publish` are incorrectly attributed to phases of an unrelated active SDD flow, modifying flow state, cache, and logs.

## Evidence

- After the clean checkpoint for Issue #443, standalone workflow agent calls alone added 6 `phase: impl-review`, `kind: agent` entries and 102 lines to `flow.json.metrics`.
- Comparing execution logs with timestamps shows the 6 entries were from 5 refine calls and 1 publish call, so this is not refine-specific.
- Comparing the recovery archive with the live active-flow agent-cache showed entries added at the same 6 timestamps.
- `src/lib/container.js` injects the FlowManager for cwd=root into Logger/Agent and places the raw Agent on the plugin bridge.
- The standalone context in `src/lib/plugin-registry.js` passes the raw Agent instead of the generic `createPluginAgentApi()`.
- `Agent.call()` resolves the ambient flow cache and saves metrics for the current context in `finally`. Logger also re-resolves the ambient context.

## Fix Approach

- Introduce a generic flow-attribution policy for Agent calls: default `ambient`, standalone plugins `none`.
- `none` must not perform flow-scoped cache reads/writes, cache-hit metrics, or success/failure metrics, and must pass an explicit null flow context to Logger.
- `createPluginAgentApi()` should delegate resolve/call while preventing plugins from overriding the core-bound attribution via plugin options.
- Standalone plugin commands should use the wrapper + attribution none. Existing attribution for explicit flow hooks/core flow commands should be preserved.
- Do not add plugin names or workflow special cases to `FlowManager` / `FlowStore`.

## Acceptance Criteria

- Before and after standalone plugin agent invocations for success, failure, and equivalent same-call/cache paths, all `specs/*/flow.json` files are byte-identical.
- Foreign flows are not modified from these locations: active managed worktree, main repo with a single active flow, multiple active flows, and no flow.
- Active-flow agent-cache bytes/entry count are not changed.
- Standalone plugin agent logs have `spec` / `sentiPhase` / `taskId` set to null and contain no foreign flow identity.
- Plugins cannot override attribution to ambient.
- Existing provider/profile/commandId resolution behavior is preserved.
- Explicit flow hooks and core flow agent calls continue to maintain the existing 1 call = 1 metric/cache attribution behavior.
- Focused tests use a fake provider and verify the above matrix without calling real AI.

## Scope

- `src/lib/agent.js`
- `src/lib/plugin-registry.js`
- `src/lib/log.js` only as needed to respect explicit null logger context
- Focused tests for the plugin agent boundary

Out of scope: workflow plugin source, FlowManager/FlowStore, Issue #443 review/transition, and Issue #444 test runner.

## Scheduling

There is no product-file overlap with #443 or #444. Make this the next issue after #444 is complete, as a tooling prerequisite to make future board refine/publish operations safe.

<details>
<summary>ja</summary>

standalone plugin agentが無関係なactive flowへ証跡を誤帰属する

## 問題

standalone plugin command に渡される raw core Agent が、current working directory の active FlowManager を prompt-cache、logger、metrics の暗黙 authority として再利用する。そのため `senti workflow refine` や `publish` の agent call が、無関係な active SDD flow の phase に誤帰属し、flow state・cache・log を変更する。

## 証拠

- Issue #443 の clean checkpoint 後、workflow standalone agent call だけで `flow.json.metrics` に `phase: impl-review`, `kind: agent` が6件・102行追加された。
- 実行ログと時刻を照合すると6件は refine 5回と publish 1回であり、refine 固有ではない。
- recovery archive と現物の active-flow agent-cache を比較すると同じ6時刻の entry が増えていた。
- `src/lib/container.js` は cwd=root の FlowManager を Logger/Agent に注入し、raw Agent を plugin bridge に置く。
- `src/lib/plugin-registry.js` の standalone context は generic `createPluginAgentApi()` ではなく raw Agent を渡す。
- `Agent.call()` は ambient flow cache を解決し、finally で current context の metrics を保存する。Logger も ambient context を再解決する。

## 修正方針

- Agent call に generic な flow-attribution policy（既定 `ambient`、standalone plugin は `none`）を導入する。
- `none` は flow-scoped cache read/write、cache-hit metric、success/failure metric を行わず、Logger に explicit null flow context を渡す。
- `createPluginAgentApi()` は resolve/call を delegate しつつ、core が束縛した attribution を plugin option で上書き不能にする。
- standalone plugin command は wrapper + attribution none を使う。explicit flow hook/core flow command の existing attribution は維持する。
- `FlowManager` / `FlowStore` に plugin 名や workflow special-case を追加しない。

## Acceptance Criteria

- standalone plugin agent invocation の success、failure、同一 call/cache 相当経路の前後で全 `specs/*/flow.json` が byte-identical である。
- active managed worktree、main repoでsingle active flow、multiple active flow、flowなしの各位置で foreign flow を変更しない。
- active-flow agent-cache の bytes/entry countを変更しない。
- standalone plugin agent log の `spec` / `sentiPhase` / `taskId` は null で、foreign flow identity を含まない。
- plugin が attribution を ambient に上書きできない。
- provider/profile/commandId resolution の既存挙動を維持する。
- explicit flow hook と core flow agent call は従来どおり1 call=1 metric/cache attributionを維持する。
- focused tests は fake provider を使い、実AIを呼ばず上記 matrix を検証する。

## スコープ

- `src/lib/agent.js`
- `src/lib/plugin-registry.js`
- `src/lib/log.js`（explicit null logger context の尊重に必要な範囲）
- plugin agent boundary の focused tests

workflow plugin source、FlowManager/FlowStore、Issue #443 review/transition、Issue #444 test runner は対象外。

## Scheduling

#443・#444 と product file overlap はない。今後の board refine/publish を安全にする tooling prerequisite として、#444 完了後の次 issue にする。

</details>