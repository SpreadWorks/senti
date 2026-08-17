# Feature Specification: 102-refactor-text-command-to-separate-responsibiliti

**Feature Branch**: `feature/102-refactor-text-command-to-separate-responsibiliti`
**Created**: 2026-03-30
**Status**: Draft
**Input**: GitHub Issue #29

## Goal

`text` コマンドから `build` の責務（ファイル選定・充填判定・差分判定）を分離し、`text` を「渡されたファイルの `{{text}}` を充填するだけ」のコマンドにする。

**Why**: 現在 `text.js` の `resolveTargetFiles()` が build 文脈（`--force`, `--regenerate`）を知らないため、再生成すべきファイルをスキップするバグの温床になっている。責務を分離することで、build 側がファイル選定を制御でき、text は純粋な充填処理に集中できる。

## Scope

1. `text.js` から `resolveTargetFiles()` を削除し、ファイル選定ロジックを `build` パイプライン（`docs.js`）側に移動する
2. `text` CLI に `--files` オプションを追加し、処理対象ファイルを外部から指定できるようにする
3. `textFillFromAnalysis()` API にファイルリストパラメータを追加する
4. `docs.js` の build パイプラインで、text 呼び出し前にファイル選定・stripFillContent を行う

## Out of Scope

- 差分判定（git diff ベースの増分更新）— Issue #29 で言及されているが、別 spec で扱う
- `--regenerate` オプションの廃止 — 本 spec でファイル選定を build 側に移した後、別途検討
- `init` の conflict 処理メッセージの改善（ERROR → WARN）— 既に修正済みの別課題

## Clarifications (Q&A)

- Q: `textFillFromAnalysis` は forge.js 等から呼ばれているが、そちらも対応が必要か？
  - A: はい。`textFillFromAnalysis` のシグネチャを変更し、呼び出し元も更新する。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-03-30
- Notes: Issue #29 の方針通り、text の責務分離を承認

## Requirements

実装順序: 1 → 3 → 2 → 4 → 5（依存関係順）

1. **`resolveTargetFiles()` を `text.js` から削除する** [P0: 本 spec の核心]
   - `stripFillContent()` はファイル内容操作のユーティリティとして `text.js` に残す（export は維持）
   - ファイル選定ロジック（どのファイルを処理対象にするか）は呼び出し元の責務にする

2. **`text` CLI に `--files` オプションを追加する** [P1: 外部インターフェース]
   - `--files file1.md,file2.md` 形式でカンマ区切りのファイルリストを受け取る
   - `--files` 指定時はそのファイルのみを処理する
   - `--files` 未指定時は全章ファイルを取得して処理する（現行の CLI 引数なし動作と同一）
   - `--files` 未指定時の動作: `main()` 内で `getChapterFiles()` を呼んで全章ファイルを取得し、stripFillContent を適用してから処理する。これは現行の `resolveTargetFiles()` が行っていた処理と同一であり、CLI ユーザーから見た動作に変更はない
   - `--files` 指定時: 渡されたファイルをそのまま処理する（strip は呼び出し元の責務）

3. **`textFillFromAnalysis()` API を変更する** [P0: 内部インターフェース]
   - `opts.files` パラメータ（`string[]`）を追加: 処理対象ファイル名の配列
   - `opts.files` 指定時はそのファイルのみ処理する（`resolveTargetFiles` を呼ばない）
   - `opts.files` 未指定時は全章ファイルを処理する（fallback）
   - `resolveTargetFiles` の呼び出しを削除し、stripFillContent は呼び出し元が行う

4. **`docs.js` build パイプラインのファイル選定ロジック** [P0: build 側への責務移動]
   - When: `sdd-forge docs build` が text ステップを実行するとき
   - Shall: text ステップの前に `getChapterFiles()` で全章ファイル一覧を取得する
   - Shall: 取得した全ファイルに対して `stripFillContent()` を適用し、既存の `{{text}}` 生成内容をクリアする
   - Shall: strip 済みのファイル名一覧を `textMain()` に `files` プロパティとして渡す
   - `stripFillContent` は `text.js` からインポートする
   - 根拠: 現行コードの `resolveTargetFiles()` は `--force` / `--regenerate` / 通常実行いずれでも常に全ファイルを strip しており、この動作をそのまま build 側に移動する

5. **`text.js` の全呼び出し元への影響と対応** [P0: 互換性確認]
   - `docs.js` (build パイプライン, line 93): `textMain(ctx)` で呼び出し。ctx に `files` プロパティを追加して渡す。strip は docs.js 側で実行
   - `forge.js` (line 246): `textFillFromAnalysis(root, analysisData, "docs.text", undefined)` — opts 未指定のため fallback（全章ファイル取得・strip なし）が適用される。シグネチャ変更は opts への追加のみで後方互換。変更不要
   - `readme.js` (line 21): `processTemplate` をインポート。`processTemplate` のシグネチャは変更しないため影響なし
   - 上記3箇所が `text.js` からインポートする全呼び出し元（grep で確認済み）

## Acceptance Criteria

1. `sdd-forge docs text --files overview.md,cli_commands.md` で指定ファイルのみ処理される
2. `sdd-forge docs text`（`--files` なし）で全章ファイルが処理される（現行動作維持）
3. `sdd-forge docs build` が正常に動作する（build 側でファイル選定後に text を呼ぶ）
4. `sdd-forge docs build --force` / `--regenerate` が正常に動作する
5. `text.js` に `resolveTargetFiles()` が存在しない
6. 既存テストが pass する

## Open Questions

None. `forge.js` (line 246) が `textFillFromAnalysis(root, analysisData, "docs.text", undefined)` で呼び出しており、opts 未指定のため fallback 動作（全章処理）が適用される。本 spec の変更で opts.files 未指定時の fallback が維持されるため、forge.js 側の変更は不要。
