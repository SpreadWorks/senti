# Draft: 211-finalize-report-show-cmd

**開発種別:** feature
**目的:** finalize 完了時の Report 表示を AI 転記依存から CLI コマンド実行に切り替え、表示脱落を構造的に防止する。

## Requirements (優先度順)

1. **R1 [高]**: finalize の実行ログ（Report）を、finalize 完了後にユーザがコマンドで再表示できる。
   - When: finalize が完了した直後、ユーザが最新 finalize の Report を参照したいとき
   - Shall: 新 CLI サブコマンド `sdd-forge flow report show` は直近の finalize の Report テキストを stdout に出力する

2. **R2 [高]**: Report 表示が AI の転記に依存しない。
   - When: AI が finalize の結果をユーザに示すとき
   - Shall: finalize の AI プロンプトは、Report を転記するのではなく `sdd-forge flow report show` を実行してその stdout を提示するよう指示する

3. **R3 [中]**: Report データの二重管理を避ける。
   - When: Report を表示するとき
   - Shall: `show` コマンドは既に永続化されている finalize の生成物を源泉として読み、同等の構造化データを二重に書き出さない

4. **R4 [中]**: 最新 finalize された spec を `show` が一意に特定できる。
   - When: 複数 spec が履歴として残っている状況で `show` が呼ばれたとき
   - Shall: `show` は直近の finalize が対象とした spec の Report を選択する

5. **R5 [低]**: Report 源泉が存在しない場合に安全に失敗する。
   - When: 未 finalize / 源泉不在 / 破損時に `show` が呼ばれたとき
   - Shall: `show` は非 0 exit + stderr に原因を示すメッセージを出力する（stdout を汚さない）

## Scope Verification
- In scope:
  - finalize 完了後に最新 Report を表示する CLI サブコマンドの追加
  - finalize パイプラインに「直近 finalize 対象」を記録する仕組みの追加
  - finalize の AI プロンプトを転記指示から show 実行指示に変更
  - 上記に対するテスト
- Out of scope:
  - Report フォーマット自体の変更
  - Retro 失敗時の AI 呼び出し再試行
  - 既存 `flow report` コマンド（report.json 生成系）の再設計
  - 履歴一覧・過去 Report の参照機能（最新のみ）

## Impact on Existing Features
- 影響ありの既存機能:
  - `sdd-forge flow run finalize`: cleanup 前後に「直近 finalize 対象」を記録する処理を追加（既存 step の意味は変更しない）
  - finalize の AI プロンプト指示文（CLI API 変更なし、AI 動作指示のみ変更）
- 影響なし:
  - `report.json` のスキーマ・生成タイミング
  - finalize の step 構成・merge/cleanup 挙動
  - 他の flow サブコマンド

## Q&A
- Q: Issue #212 の案 B（`report.text` を独立ファイルに書き出す）で進めるか？
  - A: 案 D（既存 `report.json` を源泉に再利用）を採用。
  - 根拠（既存コード調査）: `src/flow/commands/report.js` の `saveReport` は finalize の post-commit hook で `specs/<id>/report.json` を生成しており、merge 経由で main に既に永続化されている。別ファイル書き出しは冗長で source of truth が分散する。
- Q: 最新 finalize された spec を `show` がどう特定するか？
  - A: finalize 実行時にポインタを書き出し、`show` がそれを参照する方式。
  - 根拠（ガードレール）: "Prioritize Requirements" / "Impact on Existing Features" の観点で、既存 `report.json` を書き換えず追加の最小情報のみで実現する方式が影響範囲が最小。
- Q: ポインタまたは `report.json` が不在の場合の挙動は？
  - A: 非 0 exit + stderr メッセージ。
  - 根拠（既存パターン）: 他の `flow get/run` コマンドが不在ケースで非 0 exit + stderr にエラーを出す規約と揃える。

## Open Questions
- なし

## User Approval
- [x] User approved this draft
- Confirmed at: 2026-04-22
- Notes: Auto mode。案 D（既存 report.json 再利用 + 最新ポインタ）を採用。
