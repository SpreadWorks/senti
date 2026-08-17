# Feature Specification: 100-remove-external-cmd-deps

**Feature Branch**: `feature/100-remove-external-cmd-deps`
**Created**: 2026-03-29
**Status**: Draft
**Input**: GitHub Issue #26

## Goal

flow skill テンプレートから git/gh の直接呼び出しを排除し、すべての外部コマンド操作を `sdd-forge flow get/set/run` コマンドに集約する。skill は設問の提示と結果の解釈に専念し、git/gh 操作は CLI 内部に閉じる。

**Why**: 現在の skill テンプレートは git status, git add, git commit, gh issue view 等を直接呼んでおり、分岐判断と外部コマンド実行が skill 側に漏れている。CLI に集約することで skill の責務を明確化し、エラーハンドリングの一貫性を確保する。

## Scope

### 1. `flow get resolve-context` の拡張（`src/flow/get/resolve-context.js`）
現在の返却値に以下を追加:
- `dirty` (boolean) — 未コミット変更の有無
- `dirtyFiles` (string[]) — 変更ファイル一覧
- `currentBranch` (string) — 現在のブランチ名
- `aheadCount` (number) — base ブランチからの ahead コミット数
- `lastCommit` (string) — 最終コミットの oneline
- `ghAvailable` (boolean) — gh コマンドの利用可否

これにより finalize の step 2（Check current state）と flow-status の git 情報取得がこのコマンド 1 つで完結する。

### 2. `flow run prepare-spec` の拡張（`src/flow/run/prepare-spec.js`）
内部で dirty check を実行し、dirty の場合は `{ok: false, code: "DIRTY_WORKTREE", data: {files: [...]}}` を返す。skill 側の `git status --short` 呼び出しが不要になる。

### 3. `flow get issue` の新規追加（`src/flow/get/issue.js`）
`sdd-forge flow get issue <number>` で GitHub Issue の内容を JSON envelope で返す。内部で `gh issue view` を呼ぶ。skill 側の `gh issue view` 直接呼び出しが不要になる。

### 4. `flow run finalize` の新規追加（`src/flow/run/finalize.js`）
設問で集めた選択結果をすべて引数で受け取り、一括実行する:
```
sdd-forge flow run finalize --mode all --merge-strategy merge
sdd-forge flow run finalize --mode select --steps 3,4,5 --merge-strategy squash
```
内部で以下を順に実行:
- step 3: `git add` + `git commit`（commit メッセージは flow state の request から生成）
- step 4: merge（既存 `flow/commands/merge.js` のロジックを呼ぶ）
- step 5: cleanup（既存 `flow/commands/cleanup.js` のロジックを呼ぶ）
- step 6: docs sync（`sdd-forge build` + `git add` + `git commit`）
JSON で各ステップの結果を返す。

### 5. `flow run sync` の新規追加（`src/flow/run/sync.js`）
`sdd-forge flow run sync` で docs 同期を一括実行:
- `git checkout <baseBranch>`（必要な場合）
- `sdd-forge build`
- `sdd-forge review`（FAIL なら error）
- `git add docs/ AGENTS.md CLAUDE.md`
- `git commit -m "docs: sync documentation"`

### 6. `flow run merge` / `flow run cleanup` の削除
finalize に統合されるため削除。registry.js からも除去。

### 7. skill テンプレート書き換え（全5テンプレート）
- **flow-plan**: `git status --short` → `flow run prepare-spec` の error で判定。`gh issue view` → `flow get issue`。`git rebase` 推奨は注意事項として残す。
- **flow-impl**: `git rebase` 推奨は注意事項として残す。
- **flow-finalize**: git/gh の直接呼び出しをすべて除去。`flow get resolve-context` でコンテキスト取得、`flow get prompt` で設問、`flow run finalize` で一括実行。
- **flow-status**: `git rev-parse`, `git status`, `git log` → `flow get resolve-context` のデータを使う。
- **flow-sync**: `git checkout`, `git add`, `git commit` → `flow run sync` に置換。

## Out of Scope

- flow-resume テンプレートの変更（git/gh 依存なし）
- `git rebase` の CLI 統合（worktree の注意事項として skill に残す）
- flow run merge / cleanup の内部ロジック変更（finalize に移動するだけ）

## Migration

alpha 版ポリシーにより後方互換エイリアスは設けない。`flow run merge` / `flow run cleanup` はルーティングから削除される。実行時は `sdd-forge flow run: unknown action 'merge'` エラーが表示され、`sdd-forge flow run --help` で利用可能なアクション一覧（finalize を含む）が案内される。

移行手順:
1. `npm update sdd-forge` でパッケージを更新
2. `sdd-forge upgrade` で skill テンプレートを更新
3. `flow run merge` / `flow run cleanup` を直接呼んでいるスクリプトがあれば `flow run finalize` に書き換え

## Clarifications (Q&A)

- Q: resolve-context に副作用はあるか？
  - A: ない。get は読み取り専用。git status 等の読み取りコマンドのみ。
- Q: flow run finalize の commit メッセージはどう決めるか？
  - A: flow state の request と spec タイトルから自動生成。AI の介入なし。
- Q: flow run merge / cleanup の内部ロジックは消えるか？
  - A: 消えない。finalize.js が内部で同じロジックを呼ぶ。ファイルとして merge.js / cleanup.js は残し、registry と run.js のルーティングから外す。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-03-29
- Notes: ドラフト Q&A 完了後に承認

## Requirements

優先順位順（P1: 必須, P2: 重要, P3: あると良い）:

1. **P1**: `flow get resolve-context` に dirty, dirtyFiles, currentBranch, aheadCount, lastCommit, ghAvailable を追加する
2. **P1**: `flow run prepare-spec` が dirty の場合に `{ok: false, code: "DIRTY_WORKTREE"}` を返すようにする
3. **P1**: `flow get issue <number>` を新規実装する。`gh issue view` を内部で呼び JSON envelope で title, body, labels, state を返す
4. **P1**: `flow run finalize --mode all|select --steps N,N --merge-strategy merge|squash|pr` を新規実装する。commit → merge → cleanup → sync を一括実行し、各ステップの結果を JSON で返す
5. **P1**: `flow run sync` を新規実装する。checkout + build + review + add + commit を一括実行する
6. **P2**: `flow run merge` / `flow run cleanup` を registry.js と run.js のルーティングから削除する
7. **P2**: flow-plan skill テンプレートから git/gh 直接呼び出しを除去し、`flow run prepare-spec` の error 判定と `flow get issue` に置換する
8. **P2**: flow-finalize skill テンプレートから git/gh 直接呼び出しを除去し、`flow get resolve-context` + `flow run finalize` に置換する
9. **P2**: flow-status skill テンプレートから git 直接呼び出しを除去し、`flow get resolve-context` のデータに置換する
10. **P2**: flow-sync skill テンプレートから git 直接呼び出しを除去し、`flow run sync` に置換する
11. **P2**: flow-impl skill テンプレートから不要な git 参照を除去する
12. **P3**: skill テンプレートに `sdd-forge` 以外のコマンド依存がないことを確認するテストを追加する

## Acceptance Criteria

1. `flow get resolve-context` の JSON に dirty, currentBranch, aheadCount, ghAvailable が含まれる
2. `flow run prepare-spec` が dirty worktree で `ok: false` を返す
3. `flow get issue 1` が JSON で title と body を返す（gh が利用可能な場合）
4. `flow run finalize --mode all --merge-strategy merge` が commit → merge → cleanup を一括実行する
5. `flow run sync` が build + commit を一括実行する
6. `flow run merge` / `flow run cleanup` が unknown action エラーを返す（削除済み）
7. 全 skill テンプレートで `git ` / `gh ` の直接実行指示がない（`git rebase` の注意事項と Hard Stops の言及は除く）

## Open Questions

- (なし)
