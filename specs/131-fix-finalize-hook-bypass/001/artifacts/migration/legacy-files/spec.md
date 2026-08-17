# Feature Specification: 131-fix-finalize-hook-bypass

**Feature Branch**: `feature/131-fix-finalize-hook-bypass`
**Created**: 2026-04-03
**Status**: Draft
**Input**: GitHub Issue #74

## Goal

finalize パイプラインの各ステップ（commit+retro+report, merge, sync, cleanup）を registry 経由で実行するように書き換え、onError フックで失敗時に issue-log を自動記録する。

## Scope

- finalize.js のベタ書きステップを registry エントリ参照に変更
- registry に commit（post: retro + report）、merge、sync、cleanup のエントリを定義
- 全ステップに onError フックを定義し、失敗時に issue-log に記録
- finalize.js から registry の定義を参照してフック付きで実行する関数を実装

## Out of Scope

- flow.js ディスパッチャの変更（CLI 経由の実行パスは変更しない）
- registry のフック機構自体の変更
- merge.js / report.js の lib/ 移動（finalize 専用の内部モジュールとして現状維持）

## Clarifications (Q&A)

- Q: retro と report はどこで実行されるか?
  - A: registry の commit エントリの post フックとして実行する。#68 の設計通り。

- Q: finalize は registry 定義をどう使うか?
  - A: finalize.js が registry からエントリを取得し、pre → command.run() → post / onError の順で実行する。flow.js の runEntry は CLI 用（parseArgs + output を含む）なので直接使わない。フック実行のみを行う内部関数を finalize 内に持つ。

- Q: onError で何を記録するか?
  - A: ステップ名とエラーメッセージを issue-log.json に記録する。saveIssueLog / loadIssueLog を使用。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-03
- Notes: Gate PASS 後に承認

## Requirements

Priority order:

1. **R1: registry にサブステップ定義を追加** — When: registry.js が定義される場合、finalize のサブステップ（commit, merge, sync, cleanup）をエントリとして持つ。commit の post フックに retro と report の実行を含む。全エントリに onError フックを定義し、失敗時に issue-log に記録する。
2. **R2: finalize のベタ書き廃止** — When: finalize.js が各ステップを実行する場合、registry のエントリ定義を参照し、pre → command.run() → post の順で実行する。失敗時は onError を呼ぶ。retro, merge, sync, cleanup のベタ書き実装を削除する。
3. **R3: onError による issue-log 自動記録** — When: finalize の任意のステップが失敗した場合、onError フックが saveIssueLog を呼び、ステップ名・エラーメッセージ・タイムスタンプを issue-log.json に記録する。

## Acceptance Criteria

- AC1: registry.js に finalize サブステップ（commit, merge, sync, cleanup）のエントリが定義されている
- AC2: commit エントリの post フックに retro と report が含まれている
- AC3: 全サブステップエントリに onError フックが定義されている
- AC4: finalize.js 内に retro/merge/sync/cleanup のベタ書き実装がない
- AC5: テストフローで retro をあえて失敗させた場合、issue-log.json にエラーが記録される
- AC6: 既存テスト全通過（1406 tests, 0 failures）

## CLI 後方互換性

- finalize の CLI 入出力フォーマットは変わらない
- alpha 版ポリシーにより内部 API の後方互換は不要

## Open Questions

- [x] flow.js の runEntry を再利用するか → しない。runEntry は CLI 用（parseArgs + output を含む）。finalize 内にフック実行のみの関数を持つ
