# Feature Specification: 058-commandify-flow-impl-merge

**Feature Branch**: `feature/058-commandify-flow-impl-merge`
**Created**: 2026-03-15
**Status**: Draft
**Input**: User request

## Goal

flow-impl / flow-merge スキルで AI が手動で組み立てている操作を CLI コマンド化し、実行の確実性を上げる。
合わせて flow-merge スキルの Step 0 を簡素化する。

## Scope

### 新規コマンド

1. **`sdd-forge flow status --check impl`**
   - flow.json を読み、`gate` と `test` ステップが `done` であることを検証
   - PASS なら exit 0 + メッセージ、FAIL なら exit 1 + 未完了ステップを表示
   - `--dry-run`: PASS/FAIL を表示するのみ（exit code は常に 0）

2. **`sdd-forge flow merge`**
   - flow.json から `worktree`, `featureBranch`, `baseBranch` を読み取り、戦略を自動判定
   - **Worktree**: `git -C <mainRepoPath> merge --squash <featureBranch>` + commit
   - **Branch**: `git checkout <baseBranch>` → `git merge --squash <featureBranch>` → commit
   - **Spec-only** (`featureBranch == baseBranch`): スキップ（メッセージのみ）
   - `--dry-run`: 実行予定の git コマンドを表示するのみ
   - merge step の status を `done` に更新

3. **`sdd-forge flow cleanup`**
   - flow.json から戦略を判定し、ブランチ・worktree を削除
   - **Worktree**: `git -C <mainRepoPath> worktree remove <worktreePath>` + `git -C <mainRepoPath> branch -D <featureBranch>`
   - **Branch**: `git branch -D <featureBranch>`
   - **Spec-only**: スキップ（メッセージのみ）
   - `--dry-run`: 実行予定のコマンドを表示するのみ
   - branch-cleanup step の status を `done` に更新

### flow.js ルーティング追加

- `merge` → `flow/commands/merge.js`
- `cleanup` → `flow/commands/cleanup.js`
- `status --check` は既存の `status.js` に追加

### flow-merge スキル (SKILL.md) の改修

Step 0 を以下に変更：

```
1. すべて実行
2. 個別に選択する
```

- 1 → docs-update → commit → merge → cleanup を順番に実行
- 2 → 各ステップを yes/no で確認

### 実装ファイル

| ファイル | 変更内容 |
|---|---|
| `src/flow.js` | `merge`, `cleanup` をルーティング追加 |
| `src/flow/commands/status.js` | `--check impl` オプション追加 |
| `src/flow/commands/merge.js` | 新規作成 |
| `src/flow/commands/cleanup.js` | 新規作成 |
| `.claude/skills/sdd-forge.flow-impl/SKILL.md` | Prerequisites に `flow status --check impl` を使用 |
| `.claude/skills/sdd-forge.flow-merge/SKILL.md` | Step 0 を 2択に変更、merge/cleanup コマンドを使用 |

## Out of Scope

- `sdd-forge flow test-env`（flow-plan のテスト環境検出コマンド化）は別 spec
- docs-update / docs-review は既存コマンド（`sdd-forge forge`, `sdd-forge review`）を使用
- commit は標準 git コマンドを使用（コマンド化不要）

## Clarifications (Q&A)

- Q: merge/cleanup コマンドで --dry-run 以外のオプションは必要か？
  - A: 不要。flow.json から全て判定する。
- Q: flow-merge スキルの「すべて実行」で docs-update が失敗した場合の動作は？
  - A: スキル側で判断する（コマンドの責務外）。各コマンドは独立して動作する。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-03-15
- Notes: All 3 commands + skill modifications approved

## Requirements

1. `sdd-forge flow status --check impl` が gate/test の done チェックを行い、PASS/FAIL を返す
2. `sdd-forge flow merge` が flow.json の戦略に基づき正しく merge を実行する
3. `sdd-forge flow cleanup` が flow.json の戦略に基づき正しく cleanup を実行する
4. 3コマンドすべてが `--dry-run` に対応する
5. `sdd-forge flow merge` / `sdd-forge flow cleanup` を実行した場合、flow.js が対応するコマンドファイルにルーティングする
6. flow-merge スキルの Step 0 が 2択（すべて実行 / 個別選択）に改修される
7. flow-impl スキルの Prerequisites が `flow status --check impl` を使用する

## Acceptance Criteria

- [ ] `sdd-forge flow status --check impl` で gate/test が done なら PASS (exit 0)
- [ ] `sdd-forge flow status --check impl` で gate/test が未完了なら FAIL (exit 1)
- [ ] `sdd-forge flow merge --dry-run` が実行予定コマンドを表示する
- [ ] `sdd-forge flow merge` が worktree/branch/spec-only を正しく判定・実行する
- [ ] `sdd-forge flow cleanup --dry-run` が削除予定を表示する
- [ ] `sdd-forge flow cleanup` が worktree/branch/spec-only を正しく判定・実行する
- [ ] flow-merge SKILL.md の Step 0 が 2択になっている
- [ ] flow-impl SKILL.md の Prerequisites が `--check impl` を使用している
- [ ] 既存テストが壊れない

## Open Questions

（なし）
