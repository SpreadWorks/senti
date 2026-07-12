## Summary
Unify the project regression changed-files evidence into canonical snapshots so the same representation is used during saving and integration gate revalidation. Resolve `F-001` in a unit that can be independently implemented, reviewed, reverted, and verified.

## Why
Currently, the save path and gate revalidation path generate different changed-files representations and compare the entire JSON. As a result, even substantially identical diffs can be misclassified because of representation differences.

- Audit finding: `F-001`
- Category: Release blocker / evidence correctness
- Relationship to existing issue: Follow-up bug to GitHub Issue `#322`. This is not a re-registration; the fix should target an unmet or derived bug reproducible in the current source.

## Scope
Target paths:
- `src/flow/lib/run-test-execute.js`
- `src/flow/lib/test-regression.js`
- `src/flow/lib/test-artifacts.js`
- `src/lib/git-helpers.js`
- New `src/flow/lib/regression-file-snapshot.js`

## Deliverables
- Introduce a `RegressionFileSnapshotList` factory shared by both the save process and the revalidation process.
- Compare changed-files based on canonical snapshots.
- Update the artifact schema, and treat old-format artifacts as `rerun required` without compatibility absorption.
- Add the failure reproduction first and confirm it fails before the fix.

## Acceptance Criteria
- Saving and revalidation use the same `RegressionFileSnapshotList` factory.
- Automated tests verify the following cases:
  - `PASS` when unchanged
  - Detects a `1 byte` change
  - Detects `add` / `delete` / `rename`
  - Ordering differences do not cause a mismatch
  - Handles deleted files correctly
- After the artifact schema update, old-format artifacts are not treated as successful and instead require rerun.
- A `required: true` integration gate passes with an artifact immediately after saving.

## Evidence
- Use the relevant finding and referenced source in `.tmp/refactoring/report.md` as the basis.
- Prove the fix with automated tests or a reproduction command.

## Out of Scope
- Opportunistic fixes for findings not explicitly listed in this issue
- Running `npm publish`, `npm dist-tag`, or an official release

## Completion Contract
- Prove all listed acceptance criteria with automated tests or reproduction commands.
- Confirm there are no regressions in existing normal paths.
- Do not make tests pass by directly rewriting flow state or artifacts from tests.
- Perform any docs synchronization required by source updates.

## Coordination
- Dependencies: None. Merge this first.
- Parallel safety: Can run in parallel with `D-02` and `D-03`. Serialize with `D-04` and `D-10` because they overlap around flow artifacts.
- Recommended Wave: `Wave 1`

<details>
<summary>ja</summary>

project regression 証跡を canonical snapshot に統一する

## Summary
project regression の changed-files 証跡を canonical snapshot に統一し、保存時と integration gate 再検証時で同一の表現を使うようにする。`F-001` を、独立して実装・review・revert・検証できる単位で解消する。

## Why
現状は保存側と gate 再検証側が異なる changed-files 表現を生成し、JSON 全体を比較している。そのため、実質的に同じ差分でも表現差によって誤判定が起きる。

- 監査 finding: `F-001`
- カテゴリ: Release blocker / 証跡の正しさ
- 既存Issueとの関係: GitHub Issue `#322` の後続不具合。再登録ではなく、現行 source で再現する未充足または派生不具合を修正対象とする。

## Scope
対象パス:
- `src/flow/lib/run-test-execute.js`
- `src/flow/lib/test-regression.js`
- `src/flow/lib/test-artifacts.js`
- `src/lib/git-helpers.js`
- 新規 `src/flow/lib/regression-file-snapshot.js`

## Deliverables
- 保存処理と再検証処理の両方で共通利用する `RegressionFileSnapshotList` factory を導入する。
- changed-files の比較は canonical snapshot を前提に行う。
- artifact schema を更新し、旧形式 artifact は互換吸収せず `rerun required` 扱いにする。
- failure reproduction を先に追加し、修正前に失敗することを確認する。

## Acceptance Criteria
- 保存と再検証が同じ `RegressionFileSnapshotList` factory を使用している。
- 次のケースを自動テストで検証する。
  - unchanged では `PASS`
  - `1 byte` 変更を検出できる
  - `add` / `delete` / `rename` を検出できる
  - 順序差では不一致にならない
  - 削除ファイルを正しく扱える
- artifact schema 更新後、旧形式 artifact は成功扱いにならず、再実行要求になる。
- `required: true` の integration gate が保存直後の artifact で通る。

## Evidence
- `.tmp/refactoring/report.md` の該当 finding と参照 source を根拠にする。
- 修正の証明は、自動テストまたは再現 command で行う。

## Out of Scope
- このIssueに明記していない finding の便乗修正
- `npm publish`、`npm dist-tag`、正式 release の実行

## Completion Contract
- 記載した受け入れ条件をすべて自動テストまたは再現 command で証明する。
- 既存正常系の回帰がないことを確認する。
- flow 状態や artifact をテストから直接書き換えて成功させない。
- source 更新により必要になった docs 同期を行う。

## Coordination
- 依存関係: なし。最初に merge する。
- 並列安全性: `D-02`、`D-03` とは並列可。`D-04`、`D-10` とは flow artifact 周辺が重なるため直列化する。
- 推奨 Wave: `Wave 1`

</details>