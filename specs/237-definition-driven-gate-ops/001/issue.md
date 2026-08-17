Two remaining tasks identified as partial in the retro for spec 236 (flow-definition).

1. R4a: Move gate PASS side effects from registry hook to a single definition-driven location
   - Consolidate completeTask / promoteNextPending / mergeOverviewSpecs from the gate post hook in registry.js into a single execution point that references the sideEffects attribute in the definition
   - Current state: the sideEffects attribute is defined, but the execution side still resides in the registry hook

2. R8c: Derive PHASE_TO_STEP in gate-step.js from the definition
   - PHASE_TO_STEP_ENTRIES remains a hardcoded array
   - Proposal to add a gatePhase attribute to gate nodes and auto-derive it from the definition

<details>
<summary>ja</summary>

[ENHANCE] spec 236 retro残件: gate副作用のdefinition駆動化とPHASE_TO_STEP派生

spec 236 (flow-definition) の retro で partial 判定された2件の残作業。

1. R4a: gate PASS 副作用を registry hook から definition 駆動の単一箇所に移動
   - registry.js の gate post hook 内の completeTask / promoteNextPending / mergeOverviewSpecs を、definition の sideEffects 属性を参照する単一実行箇所に集約する
   - 現状: sideEffects 属性は定義済みだが、実行側が registry hook に残っている

2. R8c: gate-step.js の PHASE_TO_STEP を definition から派生させる
   - PHASE_TO_STEP_ENTRIES がハードコード配列のまま
   - gate ノードに gatePhase 属性を追加し、definition から自動導出する案

</details>