# Draft: git/gh コマンド実行の整理・共通化

開発種別: リファクタリング

目的:
`execFileSync` の直接呼び出しが7ファイル・28箇所以上に散在している状態を解消し、コマンド実行を共通ヘルパーに統合する。同時に git/gh の状態取得・判断関数の重複も解消する。

## Scope
1. コマンド実行ヘルパーの統一（`src/lib/process.js`）
2. git/gh 状態取得関数の集約（`src/lib/git-state.js` → `src/lib/git-helpers.js`）
3. 全呼び出し元の移行

## Q&A

### Q1: コマンド実行ヘルパーの API 設計
- `runCmd(cmd, args, opts?)` — 同期実行。戻り値 `{ ok, status, stdout, stderr }`
- `runCmdAsync(cmd, args, opts?)` — 非同期実行。戻り値 `Promise<{ ok, status, stdout, stderr }>`
- `runCmdStreaming(cmd, args, opts?)` — spawn + streaming。戻り値 `ChildProcess`
- エラーハンドリング: runCmd/runCmdAsync は常に return（throw しない）。ENOENT も `{ ok: false }`
- → Issue #80 の提案通り採用

### Q2: git-state.js のリネーム
- `git-state.js` → `git-helpers.js` にリネーム
- read-only コメントと commentOnIssue の矛盾を解消
- isGhAvailable を複合チェック（gh存在 + 認証 + config.commands.gh）に拡張
- → 採用

### Q3: 共通化の判断基準
- 2箇所以上から呼ばれる、または呼ばれる可能性がある git/gh コマンド → git-helpers.js に関数化して集約する
- 1箇所からのみ呼ばれ、そのフローに固有のコマンド（git merge --squash, git add/commit, git diff baseBranch...HEAD）→ 各ファイルから runCmd を直接呼ぶ
- → 採用

### Q4: 既存の process.js の runSync との関係
- 現在 `src/lib/process.js` に `runSync` が存在（spawnSync ベース、1箇所のみ使用）
- これを `runCmd` に置き換え、runSync は削除
- → 採用

### Q5: merge.js の stdio: inherit
- inherit オプションは作らない。runCmd で結果を受け取り、呼び出し側で console.log する
- → 採用

## Impact on Existing Features
- 全 git/gh コマンド実行の内部実装が変わるため、全フローコマンドに影響
- 外部 API（CLI コマンドの入出力）は変わらない
- 既存テストでカバーされている

## Constraints
- 外部依存なし（Node.js 組み込みモジュールのみ）
- alpha 版ポリシー: 後方互換は不要

## Test Strategy
- process.js の runCmd / runCmdAsync / runCmdStreaming のユニットテスト
- git-helpers.js の各関数のユニットテスト
- 既存の flow テスト・acceptance テストが通ることを確認

- [x] User approved this draft (autoApprove)
