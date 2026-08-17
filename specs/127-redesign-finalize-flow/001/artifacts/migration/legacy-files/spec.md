# Feature Specification: 127-redesign-finalize-flow

**Feature Branch**: `feature/127-redesign-finalize-flow`
**Created**: 2026-04-02
**Status**: Draft
**Input**: GitHub Issue #68

## Goal

finalize パイプラインを再設計し、worktree モードでのパス解決バグを根本的に解消する。ステップ順序の変更、子コマンドの関数呼び出し化、パス情報の ctx 経由一元管理により、信頼性の高い finalize フローを実現する。

## Scope

- finalize.js のステップ順序変更とオーケストレーション書き換え
- 子コマンド（merge.js, retro.js, report.js）の呼び出し方式を別プロセスから関数呼び出しに変更
- cleanup.js のロジックを finalize.js に統合
- ctx に worktreePath / mainRepoPath を追加し、各ステップに渡す
- report.js を registry.js に登録（単体実行可能化）
- merge.js の runIfDirect 削除
- finalize スキル（SKILL.md）のステップ説明更新

## Out of Scope

- sync.js の関数呼び出し化（docs build は別プロセス実行を維持）
- retro.js の内部ロジック変更（呼び出し方式のみ変更）
- report.js の出力フォーマット変更
- 通常ブランチモード・spec-only モードの動作変更（パス解決は worktree 固有の問題だが、関数呼び出し化は全モードに影響する）

## Clarifications (Q&A)

- Q: retro と report は finalize のステップとして独立させるか？
  - A: commit の post 処理として実行。ユーザーに見えるステップは commit / merge / sync / cleanup の4つ。

- Q: SKILL.md の更新はこの spec に含めるか？
  - A: 含める。finalize の動作仕様を記述したものなので、コード変更と一緒に更新する。

- Q: --steps オプションの指定方法は？
  - A: ユーザーから見える4ステップ（commit / merge / sync / cleanup）を対象とする。retro / report は commit に内包されるため個別選択不可。

- Q: docs build が merge 後でないと正しく動かない理由は？
  - A: worktree には feature branch のスナップショットしかなく、`sdd-forge build` は merge 後の統合コードに対して実行する必要がある。そのため sync は merge の後に実行する。

- Q: report.json に sync 結果を含めるか？
  - A: 含めない。sync 結果は画面表示のみ。これにより report を merge 前に生成でき、merge が1回で済む。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-02
- Notes: Gate PASS 後に承認

## Requirements

Priority order:

1. **R1: ステップ順序変更** — When: `sdd-forge flow run finalize` が実行された場合、パイプラインのステップ順序を commit(+retro+report) → merge → sync → cleanup で実行する。retro と report は commit ステップの post 処理として実行する。
2. **R2: 関数呼び出し化** — When: finalize.js が merge / retro / report ステップを実行する場合、runSync による別プロセス起動ではなく import した関数を直接呼び出す。finalize.js が各関数に ctx を渡し、子コマンドは自力で root を解決しない。
3. **R3: ctx にパス情報追加** — When: finalize.js の execute(ctx) が開始された場合、resolveWorktreePaths を1回だけ呼び、ctx.worktreePath と ctx.mainRepoPath を各ステップ関数に渡す。
4. **R4: cleanup 統合** — When: finalize の cleanup ステップを実行する場合、finalize.js 内のロジック（worktree 削除、branch 削除、active-flow 除去）で処理する。cleanup.js は削除する。
5. **R5: merge.js の runIfDirect 削除** — When: finalize.js が merge を実行する場合、merge.js の main(ctx) を直接呼び出す。merge.js から runIfDirect と CLI 引数解析を削除し、main(ctx) のみを export する。
6. **R6: report.js の registry 登録** — When: `sdd-forge flow run report` が実行された場合、report.js の execute(ctx) が呼び出される。registry.js に flow.run.report として登録する。
7. **R7: SKILL.md 更新** — When: R1（ステップ順序変更）の実装が完了した後。finalize スキル（SKILL.md）のステップ一覧を新しい4ステップ（1=commit, 2=merge, 3=sync, 4=cleanup）に書き換える。commit ステップの説明に retro と report が post 処理として含まれることを記載する。旧6ステップ（commit/merge/retro/sync/cleanup/report）の記述を削除する。
8. **R8: 画面表示** — When: finalize の cleanup ステップが完了した後。finalize.js は report.json の内容と sync の変更ファイル一覧をまとめた JSON を標準出力に出力する。sync が失敗またはスキップされた場合はその旨を status フィールドに含める。sync 結果は report.json には含めない。

## Acceptance Criteria

- AC1: worktree モードで finalize --mode all を実行した場合、merge が1回だけ実行される（現状の2回ではない）
- AC2: worktree モードで finalize 実行後、retro.json と report.json が main repo の spec ディレクトリに存在する
- AC3: 通常ブランチモードで finalize --mode all が正常に完了する
- AC4: spec-only モード（featureBranch === baseBranch）で finalize が正常に完了する（merge/cleanup スキップ）
- AC5: `sdd-forge flow run report` で report.js が単体実行可能である
- AC6: finalize 完了時の画面表示に report 内容と sync の変更ファイル一覧が含まれる
- AC7: cleanup.js が削除され、finalize.js にロジックが統合されている
- AC8: merge.js から runIfDirect が削除され、main(ctx) を export している

## CLI 後方互換性

- cleanup.js と merge.js は registry.js に登録されていない内部コマンドである。`sdd-forge flow cleanup` や `sdd-forge flow merge` という公開 CLI は存在しない。
- したがって cleanup.js の削除、merge.js の runIfDirect 削除は公開 CLI インターフェースに影響しない。
- `sdd-forge flow run finalize` の --steps オプションのステップ番号は変更されるが、alpha 版ポリシーにより後方互換は不要。

## Open Questions

- [x] merge.js を registry.js に登録して単体実行可能にするか → 今回のスコープ外。必要になった時点で別途対応する
