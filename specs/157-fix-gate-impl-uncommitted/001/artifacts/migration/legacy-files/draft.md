# Draft: fix-gate-impl-uncommitted

**開発種別:** バグ修正
**目的:** `gate impl` が `git diff baseBranch...HEAD` でコミット済み差分のみを検出している設計を修正し、未コミットの変更（staged + working tree）も検出対象に含めることで、フロー内の正常な実行順序（impl → review → finalize でコミット）でも gate が正しく動作するようにする。

## 背景

`gate impl` は仕様書の要件と実装の整合性を検証するゲート。
現状の実装（`src/flow/lib/run-gate.js:executeImpl()`）は `git diff baseBranch...HEAD` のみを使用しているため、コミット前の変更を検出できない。

sdd-forge の標準フローでは:
- `impl` ステップ: コードを変更するが **コミットしない**
- `review` ステップ: 追加変更の可能性あり
- `finalize` ステップ: `git add -A && git commit` で一括コミット

そのため `gate impl`（impl と review の間）を実行した時点では diff が空になり、常に FAIL する。

## Q&A

**Q1. 修正方針はどちらか（Option 1: コミット前に gate を移動 vs Option 2: gate の diff 検出を改善）？**

A: **Option 2** を採用する。

理由:
- Option 1（コミット後に gate を実行）は、review ステップでさらに変更が加わった場合に中間コミットが発生し、フロー全体の設計（1 spec = 1 commit）と矛盾する。
- Option 2 は gate の実装のみを変更し、フロー全体のステップ順序・設計を保持できる。
- 「コミット前の変更も含めて検証する」という動作は、gate の意図（要件と実装の整合性確認）に自然に合致する。

**Q2. uncommitted 変更の取得方法は？**

A: `git diff baseBranch...HEAD`（コミット済み）と `git diff HEAD`（staged + unstaged の未コミット分）を**連結**する。

- `git diff baseBranch...HEAD`: ベースブランチからの HEAD までのコミット済み差分
- `git diff HEAD`: HEAD からの未コミット差分（staged + working tree）
- 両者を結合することで「ベースから現在の作業状態まで」の完全な差分を得られる

変更が存在するかの判定は、結合後の diff が空でないことで行う。

**Q3. テスト結果の検証（issue 後半の "no way to verify test results"）はこの spec のスコープか？**

A: **スコープ外**とする。

理由:
- テスト結果の検証は diff ベースの検出修正とは独立した機能追加（構造的な変更が必要）。
- 「Single Responsibility」ガードレールに従い、この spec は diff 検出の修正のみにフォーカスする。
- テスト結果の検証は別 issue/spec として対処する。

**Q4. `git diff HEAD` は worktree モードで正しく動作するか？**

A: はい。`executeImpl()` の `runCmd` は既に `{ cwd: root }` を渡しており、worktree ディレクトリ内で git コマンドが実行される。追加する `git diff HEAD` も同じ `cwd: root` で実行するため、worktree 対応は自動的に維持される。

**Q5. 既存テストへの影響は？**

A: `run-gate.js` の `executeImpl()` に対する既存のユニットテストが存在する場合は更新が必要。
ただし、`tests/` ディレクトリを確認した結果、gate impl の専用テストは少なく、主に統合レベルでの確認となる。
この spec では `specs/157-fix-gate-impl-uncommitted/tests/` に動作検証用テストを配置する。

**Q6. diff が空の判定は変更されるか？**

A: yes。現在の判定:
```js
if (!diff.trim()) { return gateFail(..., ["no changes found against base branch"]); }
```
修正後は、コミット済み diff + 未コミット diff の結合が空の場合に FAIL とする。エラーメッセージも更新する。

## 影響範囲

- `src/flow/lib/run-gate.js`: `executeImpl()` メソッド（diff 取得ロジック）
- 既存の gate-impl 関連スキル記述への影響は軽微（動作が修正されるだけで手順は変わらない）

## Open Questions

なし

- [x] User approved this draft (autoApprove)
