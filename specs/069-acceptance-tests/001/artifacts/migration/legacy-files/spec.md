# Feature Specification: 069-acceptance-tests

**Feature Branch**: `feature/069-acceptance-tests`
**Created**: 2026-03-17
**Status**: Draft
**Input**: `.tmp/acceptance-test-requirements.md` に定義された acceptance テスト要件

## Goal
全プリセット（laravel, symfony, cakephp2, node-cli, library, php, node + webapp, cli, base のシンボリックリンク）に対して、sdd-forge パイプライン全体（scan → enrich → init → data → text → readme）を実行し、生成されたドキュメントの品質・構成・内容を検証する acceptance テストを構築する。

## Scope
- `tests/acceptance/` ディレクトリにテスト基盤を構築
- 7つの fixture プロジェクトを作成（laravel, symfony, cakephp2, node-cli, library, php, node）
- 3つのシンボリックリンク fixture を作成（webapp→php, cli→node-cli, base→node）
- `tests/acceptance/run.js` ランナーの実装
- npm script `test:acceptance` の追加
- 各プリセットに対する構造検証（assert ベース）
- 各プリセットに対する AI 品質検証

## Out of Scope
- 既存の unit/e2e テストの変更
- sdd-forge 本体のコード変更（テストで発見されたバグの修正は別 spec で対応）
- CI/CD パイプラインへの組み込み

## Clarifications (Q&A)
- Q: fixture のコードは実行可能である必要があるか？
  - A: 不要。構文的に正しく、フレームワーク規約に沿った現実的な構造であること。
- Q: AI 品質検証で使うエージェントはどれか？
  - A: 各 fixture の `.sdd-forge/config.json` に設定された defaultAgent を使用する。テスト実行時にエージェントが利用可能であることが前提。
- Q: enrich ステップはエージェントなしでも動くか？
  - A: エージェントが未設定の場合 enrich はスキップされる。acceptance テストではエージェントを設定する前提で進める。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-03-17
- Notes: 要件定義済みのため仕様書を直接作成。ユーザー承認済み。

## Requirements

### テスト基盤
1. When `node tests/acceptance/run.js` を引数なしで実行する Then 全 10 プリセット（laravel, symfony, cakephp2, node-cli, library, php, node, webapp, cli, base）のテストが `node --test` で実行される。
2. When `node tests/acceptance/run.js symfony` のようにプリセット名を引数で指定する Then そのプリセットのテストファイルのみが実行される。
3. When `npm run test:acceptance` を実行する Then `node tests/acceptance/run.js` が実行される（npm script として登録されている）。

### Fixture プロジェクト
4. When scan コマンドが fixture に対して実行される Then sdd-forge のプリセット固有スキャナが少なくとも 1 カテゴリのデータを抽出できること。これを保証するため、7 つの fixture を `tests/acceptance/fixtures/<preset>/` に配置する: laravel（タグ付き掲示板）, symfony（同）, cakephp2（同）, node-cli（MDパーサーCLI）, library（MDパーサーライブラリ）, php（素PHP）, node（素Node.js）。
5. When fixture の `.sdd-forge/config.json` を `validateConfig()`（`src/lib/types.js`）で検証する Then エラーなく通過する。現行スキーマの必須フィールド: `type`（文字列）, `lang`（文字列）, `output`（オブジェクト: `output.languages` は非空配列、`output.default` は `output.languages` に含まれる文字列）。エージェント設定として `defaultAgent`（文字列）と `providers`（オブジェクト: 各エントリに `command`, `args`）も含む。
6. When sdd-forge の言語別パーサ（`parsePHPFile`, `parseJSFile`）が fixture ソースファイルを読み込む Then クラス名・メソッド名を正しく抽出できる。PHP ファイルは `<?php` で始まり、JS ファイルは正しい ES module 構文を使用する。フレームワーク固有のディレクトリ規約（Laravel: `app/Http/Controllers/`, CakePHP 2: `app/Controller/`, Symfony: `src/Controller/` 等）に従う。

### 派生 fixture（3つ）
7. When webapp, cli, base プリセットのテストが実行される Then テストランナーは対応する実体 fixture（それぞれ php, node-cli, node）を一時ディレクトリにコピーし、`.sdd-forge/config.json` の `type` フィールドを派生プリセット名（`webapp`, `cli/node-cli` → `cli`, `base`）に上書きしてパイプラインを実行する。パイプラインの結果は実体 fixture と同じ構造検証・AI 品質検証に合格すること。

### テストフロー
8. When テストが実行される Then 各 fixture に対して scan → enrich → init → data → text → readme の順で各コマンドの `main()` 関数を呼び出す。`main()` には `resolveCommandContext()` 互換の ctx オブジェクト（root, srcRoot, config, type, lang, outputLang, docsDir, agent, t）を渡す。
9. When いずれかのパイプラインステップで例外が発生する Then テストは失敗し、エラーメッセージを出力する。

### 構造検証
10. When `init` 完了後 Then docs/ に 1 つ以上の `.md` 章ファイルが存在する。期待するファイル名は `preset.json` の `chapters` 配列で定義された名前（例: `overview.md`, `cli_commands.md`）と一致する。`getChapterFiles(docsDir)` が 1 つ以上のファイルを返すこと。
11. When `data` 完了後 Then 全章ファイル内に `{{data:` または `{{/data}}` がコメント外に露出していない（`checkOutputIntegrity()` の `exposedDirectives === 0`）。
12. When `text` 完了後 Then 全章ファイル内の `<!-- {{text ...}} -->` と `<!-- {{/text}} -->` の間に少なくとも 1 行の非空行が存在する（unfilled text directive が 0）。

### AI 品質検証
13. When パイプライン全体が完了した後 Then テスト内で AI エージェントを呼び出し、生成された docs 全体と fixture ソースコードを渡す。AI は JSON `{ "pass": true/false, "issues": ["..."] }` を返す。
14. When AI が `pass: false` を返す Then テストは失敗し、`issues` 配列の各要素をテスト失敗メッセージとして出力する。
15. When AI エージェントに品質検証を依頼する Then プロンプトに以下の観点を含める: (a) fixture ソースコードに存在する依存ライブラリ・DB テーブル/リレーション・ルート/コントローラー/モデルがドキュメントに記載されていること、(b) 章間で同一内容の重複記述がないこと、(c) 壊れた文・意味不明な記述・未完成の文がないこと。AI はこの観点に基づいて `pass`/`fail` を判定する。

## Acceptance Criteria
- `npm run test:acceptance` で全 10 プリセットのテストが実行される
- 各プリセットで scan → enrich → init → data → text → readme が正常完了する
- 構造検証（章ファイル存在、ディレクティブ解決、空セクションなし）が全プリセットで PASS する
- AI 品質検証が全プリセットで `pass: true` を返す（`pass: false` の場合は `issues` をテスト失敗メッセージとして出力）
- `npm run test:acceptance -- <preset>` で単一プリセット指定が動作する
- シンボリックリンク fixture（webapp, cli, base）は実体 fixture を共有し config.json の type のみ異なる

## Open Questions
（なし）
