# Feature Specification: 159-fix-check-scan-report

**Feature Branch**: `feature/159-fix-check-scan-report`
**Created**: 2026-04-08
**Status**: Draft
**Input**: User request

## Goal

`sdd-forge check scan` の出力をアクション可能な情報に絞り込む。現状は「scan.include 外の全ファイルリスト」という意味のない情報が大量に出力されており、ユーザーが取るべきアクションが見えにくい。出力を「DataSource に解析されなかったファイルの情報」に集中させ、ユーザーが「どの拡張子の DataSource を追加すればよいか」を即座に判断できるようにする。

## Scope

- `src/check/commands/scan.js` の出力ロジック改修
- text / json / md の全フォーマットに対応

## Out of Scope

- `scan.include` パターン自体の変更提案機能
- DataSource の自動生成・追加機能
- 他コマンドの変更

## Clarifications (Q&A)

- Q: 「DataSourceがないもの」として表示したいのは？
  - A: 拡張子ごとにグルーピングしたサマリー表示（例: `.php  12 files`）。ファイルリストより上に表示する。
- Q: Include Coverage の件数・パーセンテージは残すか？
  - A: 削除する。uncoveredリストを削除するとアクション不可能な数値になるため。
- Q: カバレッジ率はどこに表示するか？
  - A: 出力の先頭に表示する（DataSource Coverage のみ）。

## Alternatives Considered

- **Level 1 uncovered リストのフィルタリング（.claude, .tmp を除外）**: 問題の根本はリスト自体が不要であること。部分除外では根本解決にならないため却下。
- **Include Coverage の数値のみ残す**: 対応する uncoveredリストがない数値はアクション不可能と判断し削除。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-08
- Notes: 承認済み

## Requirements

1. Include Coverage セクション（件数・パーセンテージ・uncoveredリスト）をすべて削除する。
2. DataSource Coverage の件数・パーセンテージを出力の先頭に表示する。
3. DataSource に解析されなかったファイル（scan.include にマッチしたが analysis.json に entry がないファイル）を拡張子ごとにグルーピングし、件数降順でサマリー表示する。件数が同じ場合は拡張子のアルファベット順とする。
4. DataSource 解析漏れファイルのリストを拡張子サマリーの下に表示する（`--list` で全件、デフォルトで上位 10 件）。
5. `walkAllFiles` および `allFiles` / `uncoveredByInclude` の計算を削除する（Include Coverage 廃止に伴い不要）。
6. text / json / md の全フォーマットで上記レイアウト変更を反映する。
7. json フォーマットの `includeCoverage` キーを削除し、`dataSourceCoverage` のみを返す。

## Acceptance Criteria

- `sdd-forge check scan` を実行したとき、出力の先頭行に DataSource のカバレッジ率（例: `DataSource: 40 / 45 files (89%)`）が表示される。
- `Include Coverage` セクションが出力に含まれない。
- 解析漏れファイルが存在する場合、拡張子サマリー（例: `.php  12 files`）がファイルリストより上に表示される。
- 解析漏れファイルが存在しない場合、サマリーとリストは表示されない。
- `--list` フラグ指定時に全ての解析漏れファイルが表示される。
- `--format json` 時、レスポンスに `includeCoverage` キーが含まれない。

## Test Strategy

- `specs/159-fix-check-scan-report/tests/` に spec 検証テストを配置する（`npm test` には含まない）。
- テスト内容:
  - `computeCoverage` の戻り値に `includeCoverage` が含まれないこと
  - `groupByExtension` ヘルパーが件数降順・同数時アルファベット順でソートすること
  - `formatText` の出力先頭に DataSource カバレッジ率が含まれること
  - `formatText` の出力に `Include` 文字列が含まれないこと
  - 解析漏れ 0 件のとき拡張子サマリーセクションが出力されないこと

## Open Questions

- なし
