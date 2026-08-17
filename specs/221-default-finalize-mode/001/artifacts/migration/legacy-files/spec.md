# Feature Specification: 221-default-finalize-mode

**Feature Branch**: `feature/221-default-finalize-mode`
**Created**: 2026-04-23
**Status**: Draft
**Input**: GitHub Issue #241

## Goal
- `sdd-forge flow run finalize` の `--mode` オプションに既定値 `all` を設定し、引数なし実行時の UX を改善する。

## Background
- 現状、`flow run finalize` は `--mode` 引数なしで起動すると non-zero exit + エラー出力で停止する。
- 一方で配布用 skill テンプレートの構文表記は `[--mode all|select]` と optional 形式であり、既定値が存在するかのように読める。
- 実装フェーズの通常完了パスは `--mode all` 固定であり、`--mode select` は特定ステップの再実行という補助用途のみ。
- したがって「最初の finalize 呼び出しで `--mode all` を忘れてエラー、再実行して通す」という無意味な摩擦が Issue #241 で報告された。

## Scope
- `flow run finalize` 実行時の `--mode` 引数省略への対応を「エラー停止」から「`all` を既定値として適用」へ変更する。
- 既定値適用の挙動を検証する自動テストを追加する。
- CLI ヘルプ出力および SDD フロー実装フェーズ内の finalize 実行例を、既定値挙動と整合する表記に更新する。

## Out of Scope
- `--mode select` における `--steps` 必須性の変更。
- `--mode` 無効値（`all`/`select` 以外）に対するエラー終了挙動の変更。
- 配布用 skill 構文テンプレート（既に optional 表記 `[--mode all|select]` で整合済み）。
- finalize 以外のコマンド（`flow run tests`, `flow run impl-confirm`, `flow set test-summary` 等）が持つ `--mode` オプションの仕様。

## Constraints
- プロジェクトの alpha 版ポリシーに従い、`--mode all` の明示指定を deprecate してはならない（冗長表記として許容を維持する）。
- 既存の `--mode all` / `--mode select --steps ...` 呼び出しは完全に後方互換（挙動不変）でなければならない。
- `flow run finalize --mode <invalid>` および `flow run finalize --mode select`（`--steps` 欠落）のエラー挙動は維持する（exit code non-zero かつ stderr に理由を出力）。
- Node.js 組み込みモジュールのみ使用（外部依存追加禁止）。

## Design Principles
- 既定値の注入箇所はバリデーション直前の 1 点に閉じ込め、以降のロジック分岐（`mode === "all"` / `mode === "select"`）は変更しない。
- CLI ヘルプ文言は registry に定義された literal を更新し、実装コードは help 再生成を行わない。

## Overview
### Modules
- `src/flow/lib/run-finalize.js` — `ctx.mode` の既定値適用ロジックを追加。
- `src/flow/registry.js` — finalize コマンドの help 文字列中の `--mode <all|select>` 説明行を更新。
- `src/flow/prompts/impl/finalize.md` — 通常完了パスの finalize 実行例から冗長な `--mode all` を削除（`--mode select --steps ...` 側は維持）。
- `tests/unit/flow/` — `--mode` 既定値挙動を検証するユニットテストを追加。

### Data Flow
- ユーザーが `sdd-forge flow run finalize` を引数なしで実行 → registry の args parser が `ctx.mode` を `undefined` で渡す → `RunFinalizeCommand.execute` が `ctx.mode` 未指定を検出し `"all"` を適用 → 既存の `mode === "all"` ブランチに合流。
- `--mode select --steps ...` / `--mode <invalid>` の経路は変更なし。

### Decisions
- 既定値注入方式: `const mode = ctx.mode || "all";` 相当。`||` による falsy チェックで、`undefined` / 空文字のいずれも `all` に合流させる。
- バリデーション: 既定値適用後のバリデーションは「`mode` が `all` / `select` のいずれでもないならエラー」のまま維持。既定適用により `undefined` は `all` に変換され、バリデーション到達時は必ず有効値になる。
- CLI ヘルプ: `Mode (required)` → `Mode (default: all)` に更新。

## Clarifications (Q&A)
- Q: 既存の `--mode all` 明示指定を deprecate するか？
  - A: しない。alpha 版ポリシー（追加のみ、削除は行わない）に従い、冗長表記として許容し続ける。
- Q: エラーメッセージ文字列を変更するか？
  - A: 変更しない。`--mode must be 'all' or 'select'` / `--steps required when mode is 'select'` は現状維持。

## Alternatives Considered
- 代替案 A: `--mode` を必須のまま維持し、skill テンプレートの構文表記を `<--mode all|select>` に統一する。
  - 棄却理由: UX 問題（通常パスで毎回手入力を強要）を解決できない。Issue #241 の根本動機は UX 改善。
- 代替案 B: 新規オプション（例: `--full`）で `--mode all` を置き換える。
  - 棄却理由: 既存呼び出しに互換性コストが発生する。現行の `--mode all|select` セマンティクスは十分に明快で、既定値追加だけで UX 問題は解消する。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-04-23
- Notes: draft.md の承認を踏襲し、gate-PASS 後にユーザーが最終承認。Issue #241 提案の推奨案（all 既定化）を採用。

## Requirements
- **R1 [P1]** — When ユーザーが `sdd-forge flow run finalize` を `--mode` 引数なしで起動したとき、本コマンドは `--mode all` を指定したときと同じ最終化パイプライン（commit, merge, sync, cleanup の順）を実行し、成功時に exit code 0 を返すこと。
- **R2 [P1]** — When `ctx.mode` が未指定（`undefined` または空文字）で `flow run finalize` が呼ばれたとき、`RunFinalizeCommand.execute` は内部的に `mode = "all"` を適用してから既存の実行フローに進むこと。
- **R3 [P1]** — If `--mode` の値が `all` / `select` 以外である、または `--mode select` が `--steps` なしで指定された場合、本コマンドは non-zero の exit code で終了し、従来と同じエラーメッセージ（`--mode must be 'all' or 'select'` / `--steps required when mode is 'select'`）を stderr に出力すること。
- **R4 [P1]** — When 上記 R1〜R3 の条件で本コマンドが実行されたとき、その結果を検証する自動テストが `tests/unit/flow/` 以下に存在し、`npm test` 実行時に CI パスとして通過すること。
- **R5 [P2]** — When ユーザーが `sdd-forge flow run finalize --help` を実行したとき、出力される `--mode` 説明行に既定値が `all` であることが明記されていること（文字列 `default: all` を含む）。
- **R6 [P2]** — When SDD フローの実装フェーズ finalize プロンプトがユーザーに提示されたとき、通常完了パス（全ステップ実行）の実行例には冗長な `--mode all` 引数が含まれないこと（`--mode select --steps ...` の例示は現状維持）。

## Acceptance Criteria
- **AC1** (R1/R2): ユニットテストで `RunFinalizeCommand` のインスタンスを生成し、`ctx = { mode: undefined, flowState: ..., root: ... }` で `execute` を呼び出したとき、`--mode` 未指定でも throw せず、`activeSteps` が全ステップ集合 `{1,2,3,4}` を含む。
- **AC2** (R3): ユニットテストで `ctx.mode = "foo"` を与えて `execute` を呼んだとき `Error: --mode must be 'all' or 'select'` が throw される。`ctx.mode = "select"` かつ `ctx.steps = ""` のとき `Error: --steps required when mode is 'select'` が throw される。
- **AC3** (R4): `npm test` が AC1/AC2 を含め PASS し、既存テストにリグレッションが出ない。
- **AC4** (R5): `src/flow/registry.js` の finalize コマンドの help 文字列を grep して `default: all` が含まれることを確認できる。
- **AC5** (R6): `src/flow/prompts/impl/finalize.md` の通常完了パスの finalize 実行例から `--mode all` 引数記述が削除されている（`--mode select` の例示は残る）。

## Implementation Targets
- `src/flow/lib/run-finalize.js` — `RunFinalizeCommand.execute` 内で `ctx.mode` 未指定時に `"all"` を適用。
- `src/flow/registry.js` — finalize コマンドの help 文字列の `--mode` 説明行を更新。
- `src/flow/prompts/impl/finalize.md` — 通常完了パスの finalize 実行例から `--mode all` を削除。
- `tests/unit/flow/run-finalize-default-mode.test.js` — 新規ユニットテスト（AC1/AC2 をカバー）。

## Test Strategy
- **ユニットテスト（新規）:**
  - `tests/unit/flow/run-finalize-default-mode.test.js` で `RunFinalizeCommand.execute` を直接呼び、以下を検証する:
    - `ctx.mode = undefined` → throw せず、`activeSteps` は全ステップを含む（`dryRun: true` で副作用を回避）。
    - `ctx.mode = ""` → 上記と同じ挙動。
    - `ctx.mode = "foo"` → `Error` が throw され、メッセージが `--mode must be 'all' or 'select'`。
    - `ctx.mode = "select"`, `ctx.steps = ""` → `Error` が throw され、メッセージが `--steps required when mode is 'select'`。
- **既存テストのリグレッション回帰:** `npm test` が現状 PASS 状態（baseline: unit 2144 / integration 261 PASS）のまま維持されること。
- **ヘルプ文字列のスモークテスト:** 既存の help-related テストがあればその枠組みに乗せる。なければ文字列検査のみで十分（AC4 は静的 grep で代替可）。

## CLI Migration Plan
- 互換性分類: 純粋な追加変更（additive）。
- 既存呼び出し互換性: `--mode all` / `--mode select --steps ...` / 無効値 / `--steps` 欠落時の `--mode select` は挙動不変。
- 廃止予定: なし。`--mode all` 明示指定は冗長化するが deprecate しない。
- ユーザー告知: リリースノート / CHANGELOG に `flow run finalize` の `--mode` が optional (default: `all`) になった旨を記載する。

## Open Questions
- [ ] なし
