# Feature Specification: 050-restructure-cli-command-hierarchy

**Feature Branch**: `feature/050-restructure-cli-command-hierarchy`
**Created**: 2026-03-14
**Status**: Draft
**Input**: User request

## Goal
CLI コマンド体系を `docs` / `spec` / `flow` の3名前空間に再構築し、sdd-forge をドキュメントジェネレーターではなく SDD ツールチェーンとして位置づける。合わせてファイル配置を整理する。

## Scope
1. `sdd-forge.js` のルーティングを変更（フラット → 名前空間ベース）
2. `setup.js`, `upgrade.js` を `src/docs/commands/` から `src/` 直下に移動
3. `src/specs/` を `src/spec/` にリネーム
4. `docs.js` ディスパッチャーから `setup`, `upgrade` を除去
5. `spec.js` ディスパッチャーに引数なし時のサブコマンド一覧表示を追加
6. `help.js` の出力を名前空間ごとのグループ表示に変更
7. locale ファイルの help メッセージを新体系に合わせて更新
8. テストの import パス更新

## Out of Scope
- コマンドの実装ロジック変更（ルーティングとファイル配置のみ）
- 新コマンドの追加（`flow close`, `flow commit` 等は別 spec）
- 後方互換のエイリアス

## Clarifications (Q&A)
- Q: `sdd-forge docs` 引数なしの挙動は？
  - A: サブコマンド一覧を表示する
- Q: `sdd-forge spec` 引数なしの挙動は？
  - A: サブコマンド一覧を表示する（flow と同様）
- Q: `build` のショートカットは残すか？
  - A: 残さない。`docs build` に統一する（ドキュメントジェネレーター的印象を避ける）

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-03-14
- Notes: draft での議論を経て承認

## Requirements
1. ユーザーが `sdd-forge docs <sub>` を実行した場合、`docs.js` ディスパッチャーが `<sub>` に対応するコマンドを実行する（`build`, `scan`, `enrich`, `init`, `data`, `text`, `readme`, `forge`, `review`, `translate`, `changelog`, `agents`, `snapshot`）
2. ユーザーが `sdd-forge spec <sub>` を実行した場合、`spec.js` ディスパッチャーが `<sub>` に対応するコマンドを実行する（`init`, `gate`, `guardrail`）
3. ユーザーが `sdd-forge setup` を実行した場合、`src/setup.js`（`src/docs/commands/` から移動）が実行される
4. ユーザーが `sdd-forge upgrade` を実行した場合、`src/upgrade.js`（`src/docs/commands/` から移動）が実行される
5. ユーザーが `sdd-forge docs` を引数なしで実行した場合、docs のサブコマンド一覧が表示される
6. ユーザーが `sdd-forge spec` を引数なしで実行した場合、spec のサブコマンド一覧が表示される
7. ユーザーが `sdd-forge help` を実行した場合、コマンドが名前空間（Project / Docs / Spec / Flow）ごとにグループ表示される
8. ユーザーが旧コマンド（`sdd-forge build`, `sdd-forge gate` 等）を実行した場合、unknown command エラーが表示される
9. `src/specs/` を `src/spec/` にリネームした場合、`spec.js` ディスパッチャーおよびテストファイルの import パスが `src/spec/commands/` を参照する
10. locale ファイルの help メッセージは新コマンド体系（`docs build`, `spec gate` 等）を反映する

## Acceptance Criteria
- `sdd-forge docs build` でドキュメント生成パイプラインが実行される
- `sdd-forge spec init` で spec が作成される
- `sdd-forge spec gate --spec ...` でゲートチェックが実行される
- `sdd-forge setup` / `sdd-forge upgrade` が独立コマンドとして動作する
- `sdd-forge docs` / `sdd-forge spec` が引数なしでサブコマンド一覧を表示する
- `sdd-forge help` が名前空間ごとにグループ表示する
- 旧コマンド（`sdd-forge build`, `sdd-forge gate` 等）が unknown command エラーになる
- `npm test` が全て通る

## Open Questions
- [ ]
