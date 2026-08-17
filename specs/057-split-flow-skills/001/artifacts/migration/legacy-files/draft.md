# Draft: Split Flow Skills

## 決定事項

### スキル名の変更

| 旧名 | 新名 | 責務 |
|---|---|---|
| flow-start | flow-plan | 要件整理 → spec → gate → test（テストを書くところまで） |
| （新規） | flow-impl | 実装 → レビュー → finalize（コードレビュー・品質確認・修正イテレーション） |
| flow-close | flow-merge | docs 更新 → review → commit → merge → cleanup → archive |

### FLOW_STEPS（全ステップ1配列）

```
approach, branch, spec, draft, fill-spec, approval, gate, test,
implement, review, finalize,
docs-update, docs-review, commit, merge, branch-cleanup, archive
```

### 各スキルの担当範囲

- **flow-plan**: `approach` 〜 `test`（8ステップ）
- **flow-impl**: `implement` 〜 `finalize`（3ステップ）
- **flow-merge**: `docs-update` 〜 `archive`（6ステップ）

### flow-status スキル

- そのまま維持（変更なし）

### flow-impl の finalize 動作

- finalize 承認後に `/sdd-forge.flow-merge` を起動する（現行の flow-start → flow-close と同じパターン）

## 対応するファイル変更

### スキルファイル

1. `.claude/skills/sdd-forge.flow-start/` → `.claude/skills/sdd-forge.flow-plan/` にリネーム
   - SKILL.md: name, description を更新
   - ステップ 9〜11（implement, review, finalize）を削除
   - Available step IDs を `approach` 〜 `test` に更新
2. `.claude/skills/sdd-forge.flow-close/` → `.claude/skills/sdd-forge.flow-merge/` にリネーム
   - SKILL.md: name, description を更新
   - merge フェーズのステップ追跡を追加（`docs-update`, `docs-review`, `commit`, `merge`, `branch-cleanup`, `archive`）
3. `.claude/skills/sdd-forge.flow-impl/` を新規作成
   - ステップ: `implement`, `review`, `finalize`
   - 実装 → diff 提示 → レビュー → 修正イテレーション → テスト実行 → ユーザー承認
   - finalize 承認後に `/sdd-forge.flow-merge` を起動

### ソースコード

4. `src/lib/flow-state.js`: `FLOW_STEPS` を17ステップに更新
5. `src/flow/commands/status.js`: 新ステップ ID のバリデーション（`FLOW_STEPS` を参照しているので自動対応）

## 確認

- [x] User approved this draft (2026-03-15)
