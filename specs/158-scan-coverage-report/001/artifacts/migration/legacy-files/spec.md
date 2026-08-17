# Feature Specification: 158-scan-coverage-report

**Feature Branch**: `feature/158-scan-coverage-report`
**Created**: 2026-04-08
**Status**: Draft
**Input**: Issue #113

## Goal

`sdd-forge check scan` コマンドを追加し、scan 設定がプロジェクトのファイルをどの割合でカバーしているかを2段階で可視化する。プリセット選定の妥当性と DataSource の網羅性を客観的に診断できるようにする。

## Scope

- `sdd-forge check scan` コマンドの実装
- `sdd-forge check`（引数なし）グループディスパッチャの骨格作成
- `src/lib/formatter.js` 共通フォーマッタモジュールの抽出
- `src/flow/commands/report.js` を共通フォーマッタに移行するリファクタ
- `src/sdd-forge.js` への `check` ルーティング追加
- help テキスト（i18n locale）の更新

## Out of Scope

- `sdd-forge check freshness`（別 spec: ボード 1ce3）
- `sdd-forge check config`（別 spec: ボード 60d8）
- `sdd-forge docs scan` の既存動作への変更
- ファイル数以外の単位（行数等）によるカバレッジ計測

## Clarifications (Q&A)

- Q: カバレッジの定義は？
  - A: 2段階で表示する。Level 1 は include カバレッジ（src 全ファイル vs scan.include マッチ数）、Level 2 は DataSource カバレッジ（include マッチ数 vs DataSource 解析済みファイル数）。

- Q: 「全ファイル」の除外ルールは？
  - A: 既存の `scan.exclude` + デフォルト除外リスト（`node_modules`, `.git`, `dist`, `*.lock` 等）を適用する。

- Q: 出力フォーマットは？
  - A: `--format text|json|md`（デフォルト text）。未カバーファイルはデフォルト10件まで表示し、超過時は `--list` フラグを使うよう案内する。

## Alternatives Considered

- `sdd-forge docs scan --coverage` フラグ案: scan 実行時にメモリ上のデータを活用できる利点があるが、analysis.json が存在する場合は再 scan 不要で診断できるべきという観点から別コマンドを採用。
- `sdd-forge docs check` 案: config 検証等は docs 専用ではないため、`sdd-forge check` をトップレベルに配置する方が自然。

## Why This Approach

`sdd-forge check scan` を独立コマンドとして実装することで、scan を実行せずに既存の analysis.json から診断を行える。`sdd-forge check` グループはプロジェクト診断コマンドの共通エントリポイントとして機能し、将来の `freshness`・`config` チェックと自然に統合できる。formatter の共通化は既存コードの重複を解消し、今後の `check` コマンド群が一貫したレイアウトを持てるようにする。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-08
- Notes: Q&A を経て要件確定。formatter 共通化を優先実装とする方針。

## Requirements

優先順に記載する。

1. `src/lib/formatter.js` に `pushSection(lines, title, divider)` および `formatSection(title, items)` 等の共通ヘルパーを実装し、`src/flow/commands/report.js` がこれを利用するよう移行する。
2. `src/sdd-forge.js` に `check` サブコマンドのルーティングを追加する。
3. `src/check.js` を作成し、`check` グループのディスパッチャとして機能させる。引数なしの場合は利用可能なサブコマンドの一覧を表示する。
4. `src/check/commands/scan.js` を実装する。
   - 4-1. `--format text|json|md` オプションを受け付ける（デフォルト: text）。
   - 4-2. `--list` フラグを受け付け、未カバーファイルの全件一覧を表示する。
   - 4-3. `--format` なしの text 出力は `src/lib/formatter.js` の共通ヘルパーを使い、flow report と同一レイアウトで表示する。
5. `sdd-forge check scan` は以下の2段階カバレッジを計算・表示する。
   - 5-1. **include カバレッジ**: `scan.exclude` + デフォルト除外適用後の src 全ファイル数を分母とし、`scan.include` パターンにマッチしたファイル数を分子とする。
   - 5-2. **DataSource カバレッジ**: `scan.include` マッチ数を分母とし、いずれかの DataSource で解析されたファイル数を分子とする。
6. 未カバーファイルはデフォルトで最大10件表示する。10件を超える場合は超過件数を示し `--list` の使用を案内する。
7. `sdd-forge check scan` はエラー時に非ゼロの終了コードで終了する。analysis.json が存在しない場合はエラーメッセージを表示して終了する。

## Acceptance Criteria

- `sdd-forge check scan` を実行すると、include カバレッジと DataSource カバレッジが数値とパーセンテージで表示される。
- `sdd-forge check scan --list` を実行すると、未カバーファイルの全件一覧が表示される。
- `sdd-forge check scan --format json` を実行すると、カバレッジデータが JSON 形式で出力される。
- `sdd-forge check scan --format md` を実行すると、Markdown 形式で出力される。
- 未カバーファイルが11件以上の場合、デフォルト出力では10件のみ表示され、残り件数と `--list` の案内が表示される。
- analysis.json が存在しない状態で実行すると、エラーメッセージが表示され終了コード 1 で終了する。
- `sdd-forge check`（引数なし）を実行するとサブコマンド一覧が表示される。
- `sdd-forge docs scan` の動作が変更されていないこと。
- `src/flow/commands/report.js` が `src/lib/formatter.js` を利用しており、既存の text 出力が変化していないこと。

## Test Strategy

- **`tests/`（formal tests）**: `src/lib/formatter.js` の `pushSection` 等のユニットテスト（出力文字列の検証）。
- **`specs/158-scan-coverage-report/tests/`（spec verification tests）**: `sdd-forge check scan` の CLI 動作テスト。フィクスチャとして小規模な analysis.json とプロジェクトファイルセットを用意し、include カバレッジ・DataSource カバレッジの計算結果を検証する。

## Open Questions

なし。`scanner.js` の `collectFiles` が `.git`、`node_modules`、`vendor` をハードコードで除外しており、全ファイル収集もこの関数を include パターンなしで呼ぶことで同じ除外が自動的に適用される。
