# Feature Specification: 116-refactor-flow-ctx-pattern-and-state-mgmt

**Feature Branch**: `feature/116-refactor-flow-ctx-pattern-and-state-mgmt`
**Created**: 2026-04-01
**Status**: Draft
**Input**: GitHub Issue #56

## Goal

flow サブシステムのリソース解決とステート管理を統一する。`flow.js` で ctx を解決し全コマンドに渡す ctx パターンを導入し、registry.js を宣言的なコマンド定義に拡張する。

### Why this approach

Issue #43 の調査で、`run/review.js` だけが子プロセスで `SDD_WORK_ROOT` を上書きしていたためにworktree バグが発生した。redolog で5回同じパターンが記録されている。根本原因は各コマンドが個別にリソースを取得する設計にある。docs 側は `resolveCommandContext → main(ctx)` パターンで統一されており、flow 側もこれに合わせることで同種のバグを構造的に防ぐ。

## Scope

- `src/flow/flow.js` — ctx 解決とディスパッチ集約
- `src/flow/registry.js` — helpKey / before / execute / after の宣言的定義に拡張
- `src/flow/get.js`, `src/flow/set.js`, `src/flow/run.js` — 2層目ディスパッチャー廃止（flow.js に集約）
- `src/flow/run/*.js` — `runIfDirect` 削除、`execute(ctx)` シグネチャに変更
- `src/flow/get/*.js` — 同上
- `src/flow/set/*.js` — 同上
- `src/flow/run/review.js` — 子プロセス起動を廃止し `commands/review.js` を直接 import
- `src/flow/run/prepare-spec.js` — `flow prepare` としてトップレベルに分離、config フォールバック廃止
- `src/lib/flow-state.js` — worktree 内で branch 名から spec ID を導出する ctx 解決ロジック
- `src/templates/skills/` — `flow run prepare-spec` → `flow prepare` の更新
- `tests/unit/flow/` — ctx 解決と registry ディスパッチのテスト

## Out of Scope

- docs サブシステムの変更
- flow.json のスキーマ変更
- skill の指示内容全体の見直し（CLI 変更箇所のみ更新）
- 新しい flow コマンドの追加

## Clarifications (Q&A)

- Q: ctx の構造は？
  - A: `{ root, mainRoot, config, flowState, specId, inWorktree }`。prepare のみ flowState なしで実行。
- Q: runIfDirect を廃止して直接実行できなくなるが良いか？
  - A: ctx パターンでは直接実行は不要。テストは `execute(ctx)` に mock ctx を渡す形で行う。
- Q: before/after の適用範囲は？
  - A: registry に設定されていれば実行、なければスキップ。run/get/set どのコマンドにも設定可能。用途はステート更新に限定しない汎用フック。
- Q: CLI インターフェースの変更は？
  - A: `flow run prepare-spec` → `flow prepare` のみ変更。alpha 版ポリシーで旧パス非保持。skill テンプレートも同時更新。
- Q: flow state の更新責務は？
  - A: ハイブリッド方式。コマンドが結果を確定できるもの（gate PASS/FAIL, review 完了等）は before/after で自動更新。AI の判断が必要なもの（draft Q&A, approval 等）は AI が `flow set` で記録。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-01
- Notes: Q&A で方針合意済み。gate PASS 後に承認。

## Requirements

優先順位: R1 > R2 > R3 > R4 > R5 > R6 > R7 > R8 > R9

1. **R1** (P1): `sdd-forge flow <group> <cmd>` が実行された場合、`flow.js` が ctx（root, mainRoot, config, flowState, specId, inWorktree）を解決し、registry に基づいて対応するコマンドの `execute(ctx)` に渡すこと。`prepare` 以外のコマンドで flowState が存在しない場合は `EXIT_ERROR` で停止すること
2. **R2** (P1): `registry.js` にコマンドが追加・変更された場合、各コマンドは `helpKey`, `before`（省略可）, `execute`, `after`（省略可）で宣言的に定義されていること。ヘルプ文は `helpKey` による i18n キー参照とし、registry にリテラル文字列を含めないこと
3. **R3** (P1): `sdd-forge flow prepare` が実行された場合、flowState なしで実行できること。`config.json` が存在しない場合は `EXIT_ERROR` で停止すること
4. **R4** (P1): `flow.js` がコマンドをディスパッチする場合、全 `run/*.js`, `get/*.js`, `set/*.js` は `export async function execute(ctx)` シグネチャで呼び出されること。`runIfDirect` は全ファイルから削除すること
5. **R5** (P1): `sdd-forge flow run review` が実行された場合、`run/review.js` は `commands/review.js` を `runSync` による子プロセスではなく、直接 import して `execute(ctx)` で呼び出すこと
6. **R6** (P2): ctx 解決時に worktree 内で実行された場合、branch 名から spec ID を導出し、`.active-flow` を経由せず `specs/NNN/flow.json` を直接読むこと
7. **R7** (P2): registry に `before`/`after` フックが定義されたコマンドが実行された場合、`flow.js` が `before(ctx)` → `execute(ctx)` → `after(ctx, result)` の順に実行し、flowState を自動更新すること（例: gate 実行前に `step.gate = in_progress`、PASS 後に `step.gate = done`）
8. **R8** (P2): `sdd-forge flow get/set/run <cmd>` が実行された場合、`flow.js` が registry を参照して3層目コマンドを直接ディスパッチすること。`get.js`, `set.js`, `run.js` の2層目ディスパッチャーファイルは削除すること
9. **R9** (P3): `sdd-forge upgrade` が実行された場合、skill テンプレートに `flow run prepare-spec` が含まれず `flow prepare` に更新されていること

## Acceptance Criteria

1. `sdd-forge flow prepare "title" --base development --worktree` が動作し、flow.json が作成される
2. `sdd-forge flow run gate` が ctx 経由で flowState を受け取り、before/after で step が自動更新される
3. `sdd-forge flow run review` が子プロセスなしで動作し、worktree モードでも flow.json を検出する
4. `sdd-forge flow get status` が ctx 経由で動作する
5. `sdd-forge flow set step gate done` が ctx 経由で動作する
6. `src/flow/run/*.js`, `get/*.js`, `set/*.js` に `runIfDirect` が存在しない
7. `src/flow/get.js`, `set.js`, `run.js` の2層目ディスパッチャーファイルが削除されている
8. `registry.js` にヘルプ文のリテラル文字列（`desc: { en: ..., ja: ... }`）が含まれない
9. worktree 内で `loadFlowState` が `.active-flow` を経由せず flow.json を直接読む
10. config.json が存在しない状態で `sdd-forge flow prepare` を実行するとエラーで停止する
11. 既存テストが全て PASS する
12. skill テンプレートに `flow run prepare-spec` が含まれない

## Impact on Existing Features

- `flow get status`, `flow get check`, `flow get prompt` 等: 内部的に ctx 経由に変わるが、CLI インターフェースと出力は変更なし
- `flow set step`, `flow set note` 等: 同上
- `flow run gate`, `flow run finalize`, `flow run lint`, `flow run retro` 等: 同上。before/after で step が自動更新される点が追加動作
- `flow run review`: 子プロセスから直接 import に変わるが、CLI インターフェースと出力は変更なし。worktree モードで動作するようになる
- `flow run prepare-spec`: `flow prepare` に移動。旧コマンドは削除

## Migration

### CLI 変更: `flow run prepare-spec` → `flow prepare`

- `flow run prepare-spec` は削除される（`run.js` ディスパッチャー自体が廃止されるため）
- `sdd-forge flow run prepare-spec` を実行した場合、`flow.js` が unknown command エラーで `EXIT_ERROR` を返す
- skill テンプレート（`src/templates/skills/`）は本 spec で `flow prepare` に更新する
- `sdd-forge upgrade` でプロジェクトの skill ファイルに反映される

## Open Questions

（なし）
