# Feature Specification: 130-flow-logic-cli-separation

**Feature Branch**: `feature/130-flow-logic-cli-separation`
**Created**: 2026-04-02
**Status**: Draft
**Input**: GitHub Issue #73

## Goal

全 flow コマンド（run/get/set）を3層構造（FlowCommand 基底クラス → ロジック層 → ディスパッチャ）にリファクタし、ロジック層を副作用なしの純粋関数として関数呼び出しできるようにする。

## Scope

- FlowCommand 基底クラスの新設（src/flow/lib/base-command.js）
- 全 27 flow コマンドのロジックを src/flow/lib/ に移動し FlowCommand を継承
- src/flow/run/, get/, set/ の個別ラッパーファイルを削除
- registry.js に args, help, command 定義を集約
- flow.js のディスパッチャに共通ラッパーを実装（parseArgs → run → ok/fail → output）
- finalize.js からの呼び出しを lib/ 直接 import に変更

## Out of Scope

- flow-envelope（ok/fail）の廃止（CLI 出力フォーマットとして維持）
- flow.js のディスパッチャ自体の分割
- src/flow/commands/merge.js, report.js の移動（finalize 専用の内部モジュール）

## Clarifications (Q&A)

- Q: ロジック層の戻り値は?
  - A: 素のオブジェクトを return。ok/fail envelope は使わない。エラーは普通の Error を throw。

- Q: エラーに code プロパティは必要か?
  - A: 不要。分岐に使われているコードが実質ない。DIRTY_WORKTREE 等の条件分岐は AI に任せずコマンド内で解決する。

- Q: help 表示はどこで行うか?
  - A: ディスパッチャが registry の help 定義を見て表示する。ロジック層は help を知らない。

- Q: run/get/set の個別ラッパーは必要か?
  - A: 不要。ディスパッチャが registry の宣言に基づいて共通処理する。

- Q: ctx の構造は?
  - A: ctx をそのまま渡す。ただし args は含まない。ディスパッチャが parseArgs 結果を ctx にマージする。

- Q: 基底クラスの適用範囲は?
  - A: 全 27 コマンドに適用。一貫性重視。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-02
- Notes: Gate PASS 後に承認

## Requirements

Priority order:

1. **R1: FlowCommand 基底クラス** — When: flow コマンドのロジック関数が実行される場合、FlowCommand 基底クラスの run(ctx) が共通バリデーション（requiresFlow チェック等）を実行した後、サブクラスの execute(ctx) を呼び出す。execute(ctx) は素のオブジェクトを return するか Error を throw する。
2. **R2: ロジック層の分離** — When: 各 flow コマンドの execute(ctx) が実行される場合、output(), process.exitCode, parseArgs, ok(), fail() を使用しない。対象は全 27 コマンド（run 9 + get 7 + set 11）。
3. **R3: registry への宣言集約** — When: registry.js にコマンドが定義される場合、args（parseArgs オプション定義）、help テキスト、command（lib/ の import）、pre/post フックを宣言的に持つ。
4. **R4: ディスパッチャの共通ラッパー** — When: flow.js が flow コマンドを実行する場合、registry の args 定義で parseArgs し、help なら help テキストを表示し、コマンドの run(ctx) を呼び、成功時は ok() envelope を output し、失敗時は catch して fail() envelope を output する。
5. **R5: 個別ラッパーの削除** — When: R2〜R4 が完了した場合、src/flow/run/, src/flow/get/, src/flow/set/ のファイルを削除する。ロジックは src/flow/lib/ に移動済み。
6. **R6: finalize からの直接呼び出し** — When: finalize.js が retro, merge 等を呼び出す場合、src/flow/lib/ のコマンドクラスを直接 import して run(ctx) を呼ぶ。ディスパッチャを経由せず、output/parseArgs/envelope が介在しない。
7. **R7: DIRTY_WORKTREE のコマンド内解決** — When: prepare-spec が dirty worktree を検出した場合、AI に分岐を委ねず、コマンド内でエラーメッセージに対処方法を含めて Error を throw する。

## Acceptance Criteria

- AC1: src/flow/lib/base-command.js に FlowCommand 基底クラスが存在し、run(ctx) と execute(ctx) を持つ
- AC2: src/flow/lib/ に 27 個のコマンドファイルが存在し、全て FlowCommand を継承している
- AC3: src/flow/lib/ のファイルが output, fail, ok, parseArgs を import していない
- AC4: src/flow/run/, src/flow/get/, src/flow/set/ が削除されている
- AC5: registry.js の各エントリに args, help, command が定義されている
- AC6: `sdd-forge flow run gate --help` でヘルプが表示される（ディスパッチャ経由）
- AC7: `sdd-forge flow run gate --spec <path>` で従来通り JSON envelope が返る
- AC8: finalize.js が lib/ のコマンドを直接 import して副作用なしに呼び出せる
- AC9: 既存テスト全通過（1406 tests, 0 failures）

## CLI 後方互換性

- CLI の入出力フォーマットは変わらない（ディスパッチャが envelope を出力）
- alpha 版ポリシーにより内部 API の後方互換は不要

## Open Questions

- [x] merge.js, report.js（src/flow/commands/）は lib/ に移動するか → Out of Scope。finalize 専用の内部モジュールとして現状維持
