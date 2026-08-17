# Feature Specification: 094-persist-acceptance-reports

**Feature Branch**: `feature/094-persist-acceptance-reports`
**Created**: 2026-03-28
**Status**: Draft
**Input**: GitHub Issue #24

## Goal
Acceptance テストのレポートをプロジェクトルートの `.sdd-forge/output/` に永続化し、プリセット名をファイル名に含めることで、テスト結果を後から参照可能にする。

## Scope
- `tests/acceptance/lib/test-template.js` の `writeReport()` 呼び出し後に、プロジェクトルートへのコピー処理を追加
- ファイル名を `acceptance-report-{preset}.json` 形式にする

## Out of Scope
- 全プリセットのサマリーレポート生成
- レポートの履歴管理（git に委ねる）
- テスト環境のセットアップ変更
- レポートフォーマットの変更

## Clarifications (Q&A)
- Q: 永続化先はどこか？
  - A: プロジェクトルートの `.sdd-forge/output/`
- Q: 一時ディレクトリの既存レポートはどうするか？
  - A: 従来通り書き出す（テスト整合性維持）。プロジェクトルートへの書き出しは追加処理。
- Q: 再実行時の挙動は？
  - A: 既存ファイルを上書きする。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-03-28
- Notes: ドラフト Q&A 完了後に承認

## Requirements

優先順位順（高→低）:

1. **P1**: テスト実行時に、プロジェクトルートの `.sdd-forge/output/acceptance-report-{preset}.json` にレポートを書き出す
2. **P1**: ファイル名の `{preset}` にはプリセット名（`base`, `cakephp2` 等）が入る
3. **P1**: `.sdd-forge/output/` ディレクトリが存在しない場合は作成する
4. **P2**: テスト実行時に、一時ディレクトリ内に `acceptance-report.json` を従来通り書き出す（既存動作の維持）
5. **P2**: 同名ファイルが存在する場合は上書きする

## Acceptance Criteria
1. `npm run test:acceptance -- cakephp2` を実行すると、プロジェクトルートの `.sdd-forge/output/acceptance-report-cakephp2.json` が生成される
2. 生成されたファイルの内容が一時ディレクトリ内のレポートと同一である
3. 複数プリセットを実行すると、各プリセットに対応するファイルがそれぞれ生成される
4. 既存ファイルがある場合、再実行で上書きされる
5. 一時ディレクトリ内の `acceptance-report.json` も従来通り生成される

## Open Questions
- (なし)
