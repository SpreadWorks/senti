# Feature Specification: 056-generate-mode-multilang

**Feature Branch**: `feature/056-generate-mode-multilang`
**Created**: 2026-03-15
**Status**: Draft
**Input**: User request

## Goal
- `mode: generate` で多言語ドキュメントを正しく生成できるようにし、translate モードとの品質を比較する

## Scope
- `src/docs/commands/data.js` — `outputLang` をコンテキストから取得して利用する
- `src/docs.js` — generate モードパイプラインの動作確認・必要な修正
- 品質比較 — generate と translate の両方で生成し、diff + review + AI 見解で比較

## Out of Scope
- 言語レベルの並列化（言語ループは逐次のまま）
- forge コマンドの generate モード対応
- CLI の `--lang` フラグ追加

## Clarifications (Q&A)
- Q: 並列化の粒度は？
  - A: text ステップ内の既存並列化のみ。言語ループは逐次
- Q: 品質比較の方法は？
  - A: diff（translate版 vs generate版）+ `sdd-forge review` + AI による見解コメント

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-03-15
- Notes: 実装へ進む

## Requirements
1. `data.js` の `main()` が呼ばれたとき、`ctx.outputLang` を取得し、`createResolver()` の引数に含める。リゾルバーは渡された言語コードを `lang.links()` のリンク先パス生成に使用する
2. `sdd-forge build` を `mode: generate` の設定で実行したとき、各非デフォルト言語に対して `init → data → text → readme` が順次実行され、`docs/<lang>/` に章ファイルと README.md が生成される
3. 要件2で生成された `docs/<lang>/` に対して `sdd-forge review` を実行したとき、exit code 0（PASS）で終了する。FAIL の場合はドキュメント生成の問題として対処する（コード修正またはレポートに記録）
4. 要件2と要件3が完了した状態で、`sdd-forge build` を `mode: translate` に切り替えて再実行したとき、生成された `docs/ja/` と generate 版の `docs/ja/` の diff 行数サマリー・各モードの review 出力・翻訳品質に関する AI 所見（各3行以内）を `specs/056-generate-mode-multilang/quality-report.md` に記録する

## Acceptance Criteria
1. `mode: generate` で `sdd-forge build` を実行し、`docs/ja/` にドキュメントが生成される
2. 既存テストが通る（`npm test` 全 PASS）
3. `specs/056-generate-mode-multilang/quality-report.md` に品質比較レポートが存在する

## Open Questions
- (なし)
