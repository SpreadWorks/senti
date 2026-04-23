# Feature Specification: 221-fix-gate-impl-untracked-diff

**Feature Branch**: `feature/221-fix-gate-impl-untracked-diff`
**Created**: 2026-04-23
**Status**: Draft
**Input**: GitHub Issue #238

## Goal
- gate-impl / gate-integration の diff ベース評価が untracked な新規ファイルを見落とす不具合を修正し、test-first フローで作成された新規テストファイルが gate に必ず反映されるようにする。

## Background
- `src/flow/lib/run-gate.js` の `executeDiffBasedGate`（task-impl, integration から呼ばれる）は、評価用 diff を `git diff baseBranch...HEAD`（committed）と `git diff HEAD`（uncommitted tracked）の合成で構築している。
- 上記 2 種類の `git diff` は untracked ファイルを出力しないため、新規追加された test ファイル / src ファイルが diff に現れない。
- 結果として gate-impl は「test 追加が見当たらない」「実装変更しか見えない」状態となり、test-first フローを正しく評価できず FAIL を返す。
- auto モードではこの FAIL が retry budget を浪費し、AI 側からは原因が見えない（issue #238 の影響節）。

## Scope
- `src/flow/lib/run-gate.js` の diff 収集ロジックに untracked ファイル取り込みを追加
- 取り込み処理を純粋関数として切り出し
- 新規 unit test の追加

## Out of Scope
- `task-spec` フェーズ（diff を使わない）
- preflight 警告 / `git add -N` の自動実行（draft Q2 で却下）
- `.gitignore` ルール変更（git 標準の `--exclude-standard` に従う）
- gate 以外のコマンドにおける diff 収集

## Constraints
- Node.js 組み込みモジュールのみ使用（外部依存禁止）
- alpha 版ポリシー: 後方互換コードを書かない
- git の index / 作業ツリーに永続的な変更を加えない（read-only）
- 出力 diff は標準 unified diff 形式を維持し、後段の `parseDiffHunks` / `checkTestChanges` を変更しない
- 既存の baseline+head 差分構築の挙動は維持する（合成のみ追加）

## Design Principles
- 「シンプルなインターフェースに十分な実装を隠す」深いモジュール: untracked 取り込みを `executeDiffBasedGate` から分離した純粋関数として表現
- 対称性: untracked テスト/src を区別せず一様に取り込む
- 副作用ゼロ: 読み取りのみで完結

## Overview
### Modules
- `src/flow/lib/run-gate.js`
  - `executeDiffBasedGate` 内の diff 収集箇所（現行 line 1433-1435）を新規ヘルパー呼び出しに置き換え
  - 新ヘルパー: untracked ファイルを列挙し、各ファイルを `/dev/null` 比較の diff 文字列として合成して返す純粋関数
- `tests/unit/flow/lib/` 配下に新規テストファイル

### Data Flow
1. `executeDiffBasedGate(ctx, root, level, phase, skipGuardrail)` 開始
2. committed diff = `git diff baseBranch...HEAD`
3. uncommitted diff = `git diff HEAD`
4. **NEW**: untracked diff = ヘルパー関数呼び出し（`git ls-files --others --exclude-standard` で列挙 → 各ファイルを `/dev/null` 比較で diff 化）
5. 合成 diff = committed + uncommitted + untracked
6. 既存ロジック（`!diff.trim()` チェック、`parseAuthorizedTestModificationsFromJson`、`checkTestChanges`、AI guardrail 評価）にそのまま渡す

### Decisions
- 列挙コマンド: `git ls-files --others --exclude-standard -z` で NUL 区切り（パス内 newline 安全）
- 各ファイルの diff 化: `git diff --no-index --no-color -- /dev/null <path>` 相当（git の diff サブコマンドは新規ファイルに対して `--no-index` モードで `+` 行のみの hunk を生成し、これは `parseDiffHunks` が `multi-line + only hunks → PASS` ルールで正しく処理する）
- バイナリファイル: git のデフォルト挙動に従い、バイナリ判定された場合は `Binary files ... differ` 行が含まれる（`parseDiffHunks` は無視するため安全）
- 並び順: ls-files の出力順（git のソート順）

## Clarifications (Q&A)
- Q: 既存の committed/uncommitted diff と untracked diff の合成順は？
  - A: committed → uncommitted → untracked の順。既存の前 2 者の出力順を変えず、末尾に追加する。

- Q: untracked が 1 件もない場合の挙動は？
  - A: ヘルパーは空文字列を返す。合成結果は変化せず、既存の `!diff.trim()` チェックも変わらない。

- Q: `git diff --no-index` は exit code 1 を返す（差分あり）が、これを失敗扱いにしないか？
  - A: しない。新規ファイル比較では差分あり = exit 1 が正常応答であり、ヘルパー内で stdout のみを採用する。

## Alternatives Considered
- **A. preflight 警告のみ**: gate 開始時に untracked の test glob を検出して警告し `git add -N` を促す → 却下（draft Q2）。AI auto モードで警告が無視されるリスクが高く、issue の主目的「retry 浪費の防止」に対する確実性が低い。
- **B. `git add -N` を自動適用**: gate 内で intent-to-add を実行し index を変更 → 却下。共有 git 状態を変更する副作用があり、project memory `feedback_no_shared_repo_git_ops.md` の原則に反する。後始末コードも増える。
- **C. テストファイルのみ untracked 取り込み**: glob でフィルタ → 却下（draft Q4）。フィルタ条件のメンテが必要、untracked な src 新規ファイルも同じ症状を引き起こすため対称性が崩れる。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-04-23
- Notes: autoApprove で承認 (gate-spec PASS 済み)

## Requirements
- **REQ-1 (P1)**: When `executeDiffBasedGate` が phase `task-impl` または `integration` で呼ばれ、worktree に untracked ファイル（`.gitignore` 除外を除く）が存在する場合、shall 当該ファイルの全行が新規追加 (`+` のみ) として `diff` 文字列に含まれる。
- **REQ-2 (P1)**: When 上記合成 diff が `parseDiffHunks` / `checkTestChanges` に渡される場合、shall 標準 unified diff 形式の解析が正しく完了し、テスト改変検知ルール（`multi-line + only hunks → PASS`）に従って判定される。
- **REQ-3 (P2)**: When untracked ファイルが 0 件の場合、shall 合成 diff の内容は従来（committed + uncommitted）と完全一致する。
- **REQ-4 (P2)**: When 本機能が実行される間、shall git index / 作業ツリー / コミット履歴に永続的な変更が加わらない（`git status --porcelain` 出力が処理前後で同一）。
- **REQ-5 (P2)**: When untracked 取り込みヘルパーが単独で呼ばれる場合、shall 純粋関数として `(root)` を入力に diff 文字列を返し、ヘルパー内部から外部状態に書き込まない。

## Acceptance Criteria
- AC-1: 新規 unit test が追加され、以下シナリオを検証する
  - (a) untracked テストファイル 1 件を作成 → ヘルパーがその内容を `+` 行として含む diff を返す
  - (b) untracked src ファイル 1 件を作成 → 同様に diff に含まれる
  - (c) untracked が 0 件 → ヘルパーが空文字列を返す
  - (d) untracked と tracked-modified が混在 → 上位呼び出しによる合成結果に両方含まれる
- AC-2: 既存テスト全件が PASS する（`npm test` の baseline 2144 unit + 261 integration を維持）。
- AC-3: ヘルパー実行前後で `git status --porcelain` の出力が一致する（unit test で検証）。
- AC-4: gate-impl を新規 untracked テストファイル + tracked src 変更の状態で実行した場合、テスト改変検知が FAIL を出さない（実機検証を spec の test ステップで実施）。

## Implementation Targets
- `src/flow/lib/run-gate.js`
- `tests/unit/flow/lib/run-gate-untracked-diff.test.js`（新規）

## Open Questions
- [ ] なし
