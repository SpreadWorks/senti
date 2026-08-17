## Background

The `phaseToSkill()` function in `src/flow/lib/resolve-context-envelope.js:30-38` remains as a dead reference returning already-removed skill names.

```js
function phaseToSkill(phase) {
  switch (phase) {
    case "plan": return "flow-plan";          // removed skill
    case "impl": return "flow-impl";          // removed skill
    case "finalize": return "flow-finalize";  // removed skill
    case "sync": return "flow-sync";
    default: return "flow-finalize";           // removed skill
  }
}
```

`sdd-forge.flow-plan` / `sdd-forge.flow-impl` / `sdd-forge.flow-finalize` have already been removed and consolidated into `sdd-forge.flow` (refactored around specs 198-199).

## Problem

The return value of this function is included in the `recommendedSkill` field of the envelope returned by `flow get resolve-context` / `flow run resume`. Any consumer (or AI dispatcher) receiving this string cannot invoke the skill because it no longer exists.

Discovered during spec 226 draft phase when reviewing the skill configuration.

## Proposed Fix

1. Update the phase→skill mapping to match the current skill configuration. Candidates:
   - plan → `sdd-forge.flow`
   - impl → `sdd-forge.flow`
   - finalize → `sdd-forge.flow`
   - sync → `sdd-forge.flow-sync`
   - default → `sdd-forge.flow`
2. Alternatively, reconsider whether the `recommendedSkill` field itself is still necessary (since consolidation into a single skill may have made per-phase recommendations meaningless).

Either way, the decision should be informed by confirming the current skill architecture policy (consolidation into a single dispatcher `sdd-forge.flow`).

## Related

- This issue was extracted as out-of-scope from spec 226 (forest wiring)
- Verify the background of `flow-plan`/`flow-impl`/`flow-finalize` removal in the spec 198/199 refactor
- Recommended: grep-level audit for any other references to removed skill names

<details>
<summary>ja</summary>

[BUG] phaseToSkill が撤去済み skill 名 (flow-plan/flow-impl/flow-finalize) を返す dead reference の解消

## 背景

`src/flow/lib/resolve-context-envelope.js:30-38` の `phaseToSkill()` 関数が、既に撤去済みの skill 名を返す dead reference として残っている。

```js
function phaseToSkill(phase) {
  switch (phase) {
    case "plan": return "flow-plan";          // 撤去済み skill
    case "impl": return "flow-impl";          // 撤去済み skill
    case "finalize": return "flow-finalize";  // 撤去済み skill
    case "sync": return "flow-sync";
    default: return "flow-finalize";           // 撤去済み skill
  }
}
```

`sdd-forge.flow-plan` / `sdd-forge.flow-impl` / `sdd-forge.flow-finalize` は既に撤去され、`sdd-forge.flow` に統合されている（spec 198-199 前後でのリファクタ）。

## 問題

この関数の戻り値は `flow get resolve-context` / `flow run resume` の envelope の `recommendedSkill` フィールドに含まれる。consumer（または AI dispatcher）はこの文字列を受け取っても、該当 skill が存在しないため invoke できない。

発見契機: spec 226 の draft 段階で skill 構成を再確認した際に判明。

## 修正案

1. phase→skill マッピングを現行 skill 構成に合わせる。候補:
   - plan → `sdd-forge.flow`
   - impl → `sdd-forge.flow`
   - finalize → `sdd-forge.flow`
   - sync → `sdd-forge.flow-sync`
   - default → `sdd-forge.flow`
2. もしくは `recommendedSkill` フィールド自体の必要性を再検討（単一 skill に統合されたため phase 別の推奨が無意味になった可能性）

いずれの案でも、選択の根拠として現行 skill 構成の方針（単一 dispatcher `sdd-forge.flow` に集約）を確認する必要がある。

## 関連

- 本 issue は spec 226（forest 配線）の scope 外として切り出し
- spec 198/199 のリファクタで `flow-plan`/`flow-impl`/`flow-finalize` が撤去された経緯の確認
- 撤去済み skill 名への参照が他に無いか grep レベルで調査推奨

</details>