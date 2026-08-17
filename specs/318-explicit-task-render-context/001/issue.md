## Summary
Resolve audit findings F-007 and F-023 in units that can be independently implemented, reviewed, reverted, and verified. Explicitly validate the task identity and context passed to spec render, and guarantee path confinement and consistency of the target spec.

- Category: High / security / render correctness
- Findings: F-007, F-023
- Dependency: none
- Merge order: merge before D-18 lifecycle E2E
- Recommended Wave: Wave 2

## Problem
The render boundary receives raw task IDs and implicit active-flow context, and cannot prevent the following inconsistencies.

- Validity of task identity / parent / output path is not guaranteed before write
- Traversal, absolute paths, separator injection, duplicates, and unknown parents cannot be rejected
- Active flow metadata from a different spec than the specified spec can be mixed into render

## Scope
- `src/flow/schemas/spec.schema.json`
- `src/spec/commands/render.js`
- `src/flow/lib/render-spec-view.js`
- `src/flow/lib/sync-spec-tasks.js`

## Acceptance Criteria
- `TaskId` validates the character set and length defined by the schema, and rejects separator, traversal, and absolute-path-equivalent input.
- `TaskCollection` validates task ID uniqueness and parent existence, and rejects duplicates and unknown parents.
- `TaskOutputPath` validates path confinement after parent resolution, and rejects resolution outside the target directory before the first write.
- `SpecRenderContext` reads only metadata colocated with the specified spec, so context from active flow A cannot be mixed into spec B.
- All `render` / `view` / `sync` paths require validated value objects instead of raw values.
- The rejection paths above leave no side effects.

## Reproduction And Verification
- Add failure reproductions before implementation, and confirm they fail before the fix.
- Prove the listed acceptance criteria with automated tests or reproduction commands.
- Confirm there are no regressions in existing successful paths.
- Do not make tests pass by directly rewriting flow state or artifacts from the tests.

## Evidence
- Make the audit report entries F-007 / F-023 and referenced source traceable from the issue.

## Out Of Scope
- Opportunistic fixes for findings not listed in this issue
- Running `npm publish`, `npm dist-tag`, or an official release

## Parallelism
- This may proceed in parallel with other domains.
- Serialize with CI / Node support work that touches `src/spec/commands/render.js`.

## Completion Contract
- Completion requires proving all acceptance criteria listed above.
- If source is updated, perform the necessary docs sync.

<details>
<summary>ja</summary>

spec render の task identity と context を明示的に検証する

## Summary
監査 finding F-007 と F-023 を、独立して実装・review・revert・検証できる単位で解消する。spec render に渡される task identity と context を明示的に検証し、path confinement と対象 spec の一貫性を保証する。

- Category: High / security・render correctness
- Findings: F-007, F-023
- Dependency: なし
- Merge order: D-18 の lifecycle E2E より先に merge する
- Recommended Wave: Wave 2

## Problem
render 境界が raw task ID と暗黙の active-flow context を受け取っており、次の不整合を防げていない。

- task identity / parent / output path の妥当性が write 前に保証されない
- traversal、absolute path、separator 混入、重複、不明 parent を拒否できない
- 指定 spec とは別の active flow metadata が render に混入しうる

## Scope
- `src/flow/schemas/spec.schema.json`
- `src/spec/commands/render.js`
- `src/flow/lib/render-spec-view.js`
- `src/flow/lib/sync-spec-tasks.js`

## Acceptance Criteria
- `TaskId` が schema で定義した文字種と長さを検証し、separator、traversal、absolute path 相当の入力を拒否する。
- `TaskCollection` が task ID の一意性と parent の存在を検証し、重複と不明 parent を拒否する。
- `TaskOutputPath` が parent 解決後の path confinement を検証し、対象ディレクトリ外への解決を最初の write 前に拒否する。
- `SpecRenderContext` が指定 spec と同居する metadata のみを読む実装になっており、active flow A の context が spec B に混入しない。
- `render` / `view` / `sync` の全経路が raw 値ではなく validated value object を要求する。
- 上記の拒否系では副作用を残さない。

## Reproduction And Verification
- 実装前に failure reproduction を追加し、修正前に失敗することを確認する。
- 記載した受け入れ条件を自動テストまたは再現コマンドで証明する。
- 既存正常系に対する回帰がないことを確認する。
- flow の状態や artifact をテストから直接書き換えて成功させない。

## Evidence
- 監査 report の F-007 / F-023 と参照 source を issue から追跡できるようにする。

## Out Of Scope
- この issue に記載していない finding の便乗修正
- `npm publish`、`npm dist-tag`、正式 release の実行

## Parallelism
- 他ドメインとは並列で進めてよい。
- `src/spec/commands/render.js` を触る CI / Node 対応とは直列化する。

## Completion Contract
- 記載した全受け入れ条件を証明して完了とする。
- source が更新された場合、必要な docs 同期を行う。

</details>