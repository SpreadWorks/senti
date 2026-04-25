# Feature Specification: 229-test-runner-file-filter

**Feature Branch**: `feature/229-test-runner-file-filter`
**Created**: 2026-04-25
**Status**: Draft
**Input**: GitHub Issue #264

## Goal
テストランナー (`tests/run.js`) に `--file`、`--pattern`、positional 引数によるテストファイル直接指定機能を追加する。既存のラベル集計・カテゴリ分類パイプラインを維持する。

## Background
現在のテストランナーはディレクトリベースのフィルタリング (`--preset`, `--scope`, `--agent`, `--all`) のみ対応しており、個別テストファイルを指定する手段がない。単一テストを実行するには `node --test <file>` に切り替える必要があるが、その場合ラベル集計やカテゴリ分類が適用されない。spec 220 開発中に実際に不便が発生した。

## Scope
- `--file <path>` フラグの追加（複数回指定可、ファイルを直接テスト対象に追加）
- `--pattern <glob>` フラグの追加（glob に一致するファイルをテスト対象に追加）
- 末尾 positional 引数によるファイル/ディレクトリ指定
- ファイル指定モードとディレクトリ検索モードの相互排他バリデーション

## Out of Scope
- 既存ディレクトリベース検索ロジックのリファクタリング
- テストラベル集計・カテゴリ分類ロジックの変更
- `--watch`、`--parallel` 等の別機能追加

## Constraints
- Node.js 組み込みモジュールのみ使用（外部依存禁止）
- 既存フラグのみ使用時の動作に変更を加えない

## Design Principles
- ファイル指定は「ファイル発見方法」の追加に留め、発見後の実行パイプライン（カテゴリ分類 → グループ別実行 → ラベル集計）は既存と同一とする
- 既存の `--agent` 排他パターンに倣い、モード間の混在を禁止する

## Overview
### Modules
- `tests/run.js` — 引数パースとファイル収集のエントリポイント
- `tests/helpers/test-runner-search-dirs.js` — フラグバリデーションロジック

### Data Flow
1. 引数パース: `--file`, `--pattern`, positional 引数を抽出
2. バリデーション: ファイル指定モードとディレクトリ検索モードの排他チェック
3. ファイル収集: `--file` は直接追加、`--pattern` は glob 展開、positional はファイル/ディレクトリ判定後に収集
4. 実行: 収集されたファイルを既存の `groupTestFilesByCategory` → `runNodeTests` パイプラインに渡す

### Decisions
- D1: `--file` で指定されたファイルは `.test.js` フィルタを適用しない（ユーザーの明示的指定を優先）。`--pattern` の glob 結果と positional のディレクトリ展開には `.test.js` フィルタを適用する。
- D2: ファイル指定系フラグ同士（`--file` + `--pattern` + positional）は併用可で、結果を union する。

## Clarifications (Q&A)
- Q: glob 展開にはどの仕組みを使うか？
  - A: Node.js 組み込みの `fs.globSync`（Node 22+）を使用。プロジェクトは既に `import.meta.dirname` 等の Node 22 機能を使用しており互換性問題なし。
- Q: `--file` の存在しないパスはエラーにするか？
  - A: はい。存在しないファイルパスはエラーメッセージを表示して exit(1) する。

## Alternatives Considered
- positional 引数のみ（`--file`/`--pattern` なし）: 短いが、フラグ値との区別が曖昧になる場面がある。明示的なフラグを提供する方が堅牢。
- 既存の `--scope`/`--preset` と `--file`/`--pattern` の併用許可: 組み合わせの意味が不明瞭になるため、排他を選択。

## User Confirmation
- [x] User approved this spec (autoApprove)
- Confirmed at: 2026-04-25
- Notes: Issue #264 + draft に基づき auto モードで承認

## Requirements

優先度順:

- R1 (P1): `--file <path>` を指定した場合、そのファイルをテスト対象に追加する。複数回指定した場合、すべてのファイルを union で実行する。指定ファイルが存在しない場合はエラーメッセージを表示して exit(1) する。
- R2 (P1): `--pattern <glob>` を指定した場合、glob に一致するファイルをテスト対象とする。一致ファイルが 0 件の場合はエラーメッセージを表示して exit(1) する。
- R3 (P1): フラグ以外の末尾引数をファイルまたはディレクトリとして解釈する。ファイルの場合はそのまま追加、ディレクトリの場合は再帰的に `.test.js` ファイルを収集する。
- R4 (P1): `--file`/`--pattern`/positional（ファイル指定モード）と `--preset`/`--scope`/`--agent`/`--all`（ディレクトリ検索モード）を同時に指定した場合、エラーメッセージを表示して exit(1) する。
- R5 (P2): ファイル指定モードで収集されたファイルは、既存と同じカテゴリ分類・ラベル集計パイプラインを通して実行する。

## Acceptance Criteria
- AC1: `node tests/run.js --file tests/unit/foo.test.js` で指定ファイルのみが実行される
- AC2: `node tests/run.js --file a.test.js --file b.test.js` で両ファイルが実行される
- AC3: `node tests/run.js --pattern 'tests/unit/flow/*.test.js'` でパターンに一致するファイルが実行される
- AC4: `node tests/run.js tests/unit/flow/` でディレクトリ内の `.test.js` が再帰的に実行される
- AC5: `node tests/run.js --file x.test.js --preset base` でエラーが出力される
- AC6: `node tests/run.js --file nonexistent.test.js` でエラーが出力される
- AC7: `node tests/run.js --pattern 'no-match-*'` でエラーが出力される
- AC8: ファイル指定モードでもラベル集計が表示される
- AC9: フラグなし・既存フラグのみの場合、動作に変更がない

## Implementation Targets
- `tests/run.js`
- `tests/helpers/test-runner-search-dirs.js`

## Test Strategy
バリデーションロジックとファイル収集ロジックを unit テストで検証する。既存テストがフラグバリデーションとディレクトリ検索を unit テストしているパターンに合わせる。

## Open Questions
- なし
