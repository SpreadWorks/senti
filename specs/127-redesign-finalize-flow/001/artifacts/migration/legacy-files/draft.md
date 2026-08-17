# Draft: finalize 再設計

## Goal

finalize パイプラインの信頼性向上。worktree モードでのパス解決バグの根本解消。

## 決定事項

### 1. ステップ順序の変更

現状: commit → merge → retro → sync → cleanup → report
新規: commit(+retro+report) → merge → sync → cleanup

- retro と report は commit の post 処理として実行（ユーザーには4ステップに見える）
- worktree 内で commit + retro + report を完結させてから merge（1回だけ）
- report.json に sync 結果は含めない。画面表示時に sync 結果を合わせて表示する

### 2. 子コマンドの関数呼び出し化

- merge.js, cleanup.js, retro.js を runSync 別プロセス起動から import による関数呼び出しに変更
- ctx に worktreePath / mainRepoPath を含めて渡し、子コマンドが自力で root 解決しない
- sync.js のみ docs build 別プロセス実行を据え置き

### 3. ファイル構成の変更

- cleanup.js: finalize.js に統合（finalize 専用、単体実行の需要なし）
- merge.js: 残す。runIfDirect 削除、finalize から main(ctx) 直接呼び出し
- retro.js: 残す（registry 登録済み）。finalize から execute(ctx) 直接呼び出し
- report.js: 残す。registry.js に flow.run.report として登録し単体実行可能にする

### 4. SKILL.md の更新

- finalize スキル（SKILL.md）のステップ説明をコード変更に合わせて更新
- この spec に含める

### 5. --steps オプション

- ユーザーから見えるステップは4つ: commit / merge / sync / cleanup
- retro と report は commit に内包（--steps で個別選択不可）

### 6. 通常ブランチ / spec-only モード

- パス解決の問題は worktree 固有。通常モードでは構造的に発生しない
- ただし関数呼び出し化は全モードに影響するため、全モードでテスト必要

## テスト戦略

- spec 検証テスト: ステップ順序・パス解決・関数呼び出しの結合テスト
- git リポジトリのフィクスチャを使用
- retro の AI 呼び出しはテスト対象外、オーケストレーション（順序・パス渡し・結果集約）を検証

## 既存機能への影響

- `sdd-forge flow run finalize` の --steps 番号の意味が変わる（alpha 版のため後方互換不要）
- merge.js の runIfDirect 削除（単体の `node merge.js` 実行が不可になる → registry 経由で代替可能）
- cleanup.js の削除（finalize に統合）
- finalize スキル（SKILL.md）の記述変更

- [x] User approved this draft
