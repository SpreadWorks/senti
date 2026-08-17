# Draft: commandify-flow-impl-merge

## 決定事項

### 新規コマンド

1. **`sdd-forge flow status --check impl`** — impl フェーズの前提条件チェック（gate done, test done）
2. **`sdd-forge flow merge`** — flow.json に基づく git merge 実行（worktree/branch/spec-only を自動判定）
3. **`sdd-forge flow cleanup`** — flow.json に基づくブランチ・worktree 削除

- すべて `--dry-run` 対応

### flow-merge スキル Step 0 の改修

現在の5択を廃止し、2択に変更：

```
1. すべて実行
2. 個別に選択する
```

- 1 → docs-update → commit → merge → cleanup を順番に実行
- 2 → 各ステップを yes/no で確認

### 設計方針

- 各コマンドは単機能（1コマンド = 1操作）
- flow.json から戦略を読み取り、条件分岐はコマンド内部で処理
- スキルは質問とコマンド呼び出しに徹する

## Open Questions

（なし）

---

- [x] User approved this draft
- Date: 2026-03-15
