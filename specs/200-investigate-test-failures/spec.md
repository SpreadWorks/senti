# Feature Specification: 200-investigate-test-failures

**Feature Branch**: `feature/200-investigate-test-failures`
**Created**: 2026-04-20
**Status**: Draft
**Input**: issue #191

## Goal

- main ブランチで既発生の 4 件のテスト失敗を解消する。`node tests/run.js` が `# fail 0` となる状態を回復する。

## Scope

- acceptance 系テストヘルパー (`tests/acceptance/lib/pipeline.js`) を、現在の commands モジュール API (Command クラス化済) に追随させる
- 失効した dispatcher テスト (`tests/e2e/dispatchers.test.js` の `rejects 'spec' with no args as unknown command`) を、製品の現状挙動を検証するテストに置換する
- 修正後に全テスト pass を確認する

## Out of Scope

- プロダクトコード (`src/`) の挙動変更
- acceptance-report.json のスキーマ変更
- 他の既存テストの改善
- pipeline 実行ロジックそのものの改修

## Clarifications (Q&A)

- Q: 本 issue の目的は「調査のみ」か「調査＋修正」か
  - A: `[2] 調査＋修正`（本 spec 内で修正まで完結）
- Q: acceptance 系 3 件の根本原因は何か
  - A: `pipeline.js` が commands モジュールから `main` 関数を import しているが、commands は過去のリファクタで Command クラス化されており `main` は未 export。helper 呼び出し時に TypeError。
- Q: dispatcher 系 1 件の根本原因は何か
  - A: `spec` dispatcher は現在有効で `render` サブコマンドを持つ。テストの「unknown command として拒否される」という前提が製品現状と乖離している。

## Alternatives Considered

1. commands 側に `main` を再エクスポートしてヘルパーを温存: 却下。Command クラス化の方針に反する。
2. `spec` dispatcher を再削除してテストを温存: 却下。`sdd-forge spec render` が実運用中で影響範囲が広がる。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-20
- Notes: autoApprove mode / gate PASS 後承認

## Impact on Existing Features

既存のプロダクト機能への影響なし。本 spec の変更対象はテストインフラ (`tests/acceptance/lib/pipeline.js`, `tests/e2e/dispatchers.test.js`) のみであり、`src/` 配下のプロダクトコード挙動は変更しない。CLI コマンドの意味やオプションにも変更はない。

## Requirements

優先度順に記載 (P1 = 最優先)。

- **R1 [P1]**: When acceptance 系 3 テスト (`runPipeline returns step timing`, `report JSON is written to .sdd-forge/output/acceptance-report.json`, `acceptance report: JSON output`) を `node tests/run.js` で実行した When、Then 全てが pass する shall。If `tests/acceptance/lib/pipeline.js` が commands モジュールの現行 API (Command クラス `default export`) と乖離している If、Then ヘルパーを現行 API に追随させる shall。
- **R2 [P1]**: When `sdd-forge spec`（無引数）を実行した When、Then exit code は非ゼロかつサブコマンド usage が stdout に出力される挙動が検証されている shall。If 既存テスト `rejects 'spec' with no args as unknown command` のシナリオ前提が製品現状と乖離している If、Then 当該テストを削除し、上記現行挙動を検証するテストを `tests/e2e/dispatchers.test.js` に追加する shall。
- **R3 [P2]**: When 修正後に `node tests/run.js` を実行した When、Then 集計行が `# fail 0` を出力する shall。If 修正により既存 pass テストを退行させた If、Then 退行を解消してから完了とする shall。
- **R4 [P1]**: When 本 spec の修正を行う When、Then 変更対象は `tests/` 配下のみに限定される shall。If `src/` 配下のファイル変更が必要と判断された If、Then スコープ再確認のため作業を停止する shall。

## Acceptance Criteria

- AC1: `node tests/run.js` 実行時、該当 4 テストがいずれも pass する（置換後の新テストを含む）。
- AC2: `node tests/run.js` の集計が `# fail 0` である。
- AC3: git diff で `src/` 配下のファイル変更が 0 件である。
- AC4: 修正後の `tests/acceptance/lib/pipeline.js` は、commands の Command クラス (`DocsScanCommand` 等) の `default export` を使って各パイプラインステップを実行する。

## Open Questions

（なし）
