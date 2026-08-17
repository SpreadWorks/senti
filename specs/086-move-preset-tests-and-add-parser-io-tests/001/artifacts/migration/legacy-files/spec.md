# Feature Specification: 086-move-preset-tests-and-add-parser-io-tests

**Feature Branch**: `feature/086-move-preset-tests-and-add-parser-io-tests`
**Created**: 2026-03-22
**Status**: Draft
**Input**: GitHub Issue #11

## Goal

プリセット固有テストをプリセットディレクトリ内に移動し、全プリセットの scan パーサーに対する I/O テストを整備する。新規プリセット（drizzle, workers, nextjs, hono, graphql）には不足している scan パーサーを作成する。

## Scope

1. **テストファイル再配置**: laravel/symfony のプリセット固有テストを `tests/` から `src/presets/*/tests/{unit,e2e}/` に移動
2. **npm test スクリプト更新**: `src/presets` を検索対象に追加、`--preset <name>` オプションによるプリセット毎テスト実行
3. **既存パーサー I/O テスト追加**: laravel, symfony, cakephp2 の scan パーサーに入出力テストを作成
4. **新規プリセット scan パーサー作成**: drizzle, workers, nextjs, hono, graphql の DataSource が要求するデータを供給する scan パーサーを実装し、I/O テストを作成
5. **src/AGENTS.md 更新**: プリセット作成手順ルール（テンプレ → DataSource → scan）、プリセットテストルールを追記

## Out of Scope

- 横断テスト（preset-scan-integrity, preset-datasources, 079-preset-chapter-hierarchy, ci-pipelines, en-templates）の移動
- テストフレームワークの変更（Node.js 組み込み test runner を継続使用）
- 既存テンプレート・DataSource の変更（scan パーサーの追加・置換のみ）

## Clarifications (Q&A)

- Q: テスト再配置の対象範囲は？
  - A: laravel/symfony のプリセット固有テスト（8ファイル）のみ。横断テストは tests/ に残す。
- Q: 移動先のディレクトリ構造は？
  - A: unit/e2e のサブディレクトリを維持（src/presets/<name>/tests/unit/, tests/e2e/）。
- Q: `--preset` 指定時の実行範囲は？
  - A: tests/unit + tests/e2e + src/presets/<name>/tests/ の全テスト。
- Q: プリセット名の検証方法は？
  - A: ファイルシステムから動的に取得。ハードコード配列は使わない。
- Q: 新規プリセットの scan がない場合は？
  - A: テンプレ → DataSource → scan の順で不足分を作成する。親プリセットの汎用実装より固有実装が望ましい場合は置き換える。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-03-22
- Notes: npm publish 除外要件を追加後に承認

## Requirements

### P1-a: テスト再配置（最優先 — 後続作業の前提）

R1. laravel のプリセット固有テスト（4ファイル）を `src/presets/laravel/tests/{unit,e2e}/` に移動する
R2. symfony のプリセット固有テスト（4ファイル）を `src/presets/symfony/tests/{unit,e2e}/` に移動する
R3. 移動後のテストファイル内の相対 import パスを更新する
R4. 移動元のファイルを削除する

### P1-b: npm test スクリプト（再配置後すぐに必要）

R5. `test`, `test:unit`, `test:e2e` スクリプトの検索パスに `src/presets` を追加する
R6. `npm test -- --preset <name>` で指定プリセットのテスト（tests/unit + tests/e2e + src/presets/<name>/tests/）を実行できるようにする
R7. `--preset` のプリセット名は `src/presets/` のディレクトリ一覧から動的に検証する
R8. 存在しないプリセット名が指定された場合はエラーメッセージを出力して非ゼロ終了コードで終了する

### P1-c: 既存パーサー I/O テスト

R9. laravel の各 scan パーサー（routes, config, controllers, models, migrations）に I/O テストを作成する
R10. symfony の各 scan パーサー（routes, entities, config, controllers, migrations, php-attributes）に I/O テストを作成する
R11. cakephp2 の各 scan パーサー（10個）に I/O テストを作成する

### P2: 新規プリセット scan パーサー

R12. drizzle の DataSource（schema.js）が要求するデータを供給する scan パーサーを作成する
R13. workers の DataSource（bindings.js）が要求するデータを供給する scan パーサーを作成する
R14. nextjs の DataSource（components.js, routes.js）が要求するデータを供給する scan パーサーを作成する
R15. hono の DataSource（middleware.js）が要求するデータを供給する scan パーサーを作成する
R16. graphql の DataSource（schema.js）が要求するデータを供給する scan パーサーを作成する
R17. 親プリセットの汎用実装より固有実装が望ましい場合は置き換える
R18. 各新規 scan パーサーに I/O テストを作成する

### P1-d: npm publish 除外

R19. `.npmignore` または package.json の `files` 設定で `src/presets/*/tests/` を npm パッケージから除外する
R20. `npm pack --dry-run` でテストファイルが含まれないことを確認する

### P2: src/AGENTS.md 更新

R21. プリセット作成手順ルール（テンプレート → DataSource → scan のトップダウン設計）を追記する
R22. プリセットテストルール（tests/ 必須、I/O テスト必須、`npm test -- --preset <name>` で実行）を追記する

## Acceptance Criteria

- AC1: `npm test` で全テスト（tests/ + src/presets/*/tests/）が実行され、全て PASS する
- AC2: `npm test -- --preset laravel` で laravel 関連テスト（横断 + 固有）が実行される
- AC3: `npm test -- --preset nonexistent` がエラーメッセージを出して終了する
- AC4: 移動元（tests/unit/presets/laravel/, tests/unit/presets/symfony/, tests/e2e/presets/laravel/, tests/e2e/presets/symfony/）にファイルが残っていない
- AC5: 全プリセット（laravel, symfony, cakephp2, drizzle, workers, nextjs, hono, graphql）の scan パーサーに I/O テストが存在する
- AC6: `npm pack --dry-run` の出力に `src/presets/*/tests/` のファイルが含まれない
- AC7: src/AGENTS.md にプリセット作成手順とテストルールが記載されている

## Open Questions

（なし）
