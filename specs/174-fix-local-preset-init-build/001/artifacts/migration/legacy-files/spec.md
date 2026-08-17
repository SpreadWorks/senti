# Feature Specification: 174-fix-local-preset-init-build

**Feature Branch**: `feature/174-fix-local-preset-init-build`
**Created**: 2026-04-14
**Status**: Draft
**Input**: Issue #145

## Goal

`.sdd-forge/presets/<name>/` に配置したプロジェクトローカルプリセットを、`sdd-forge docs init` / `docs build` / `setup` コマンドでも正しく解決できるようにする。

現状では `docs scan` はプロジェクトローカルプリセットを正しく解決できるが、`docs init`（`docs build` が内部で呼ぶ init 処理を含む）および `setup` はプロジェクトルートを参照せずにプリセットを解決しようとするため、`Preset not found` エラーで失敗する。

## Why This Approach

プリセット解決関数はすでにプロジェクトルートをオプション引数として受け取る設計になっており、`docs scan` と DataSource ファクトリーはこれを正しく利用している。バグの原因は設計の欠陥ではなく、`docs init` / `setup` の呼び出し側がプロジェクトルートを渡していないという引数の欠落である。

したがって修正方針は、`docs init` / `setup` の各呼び出し箇所にプロジェクトルートを伝播させることで、新たな抽象化や設計変更は不要。既存の設計を意図どおりに完成させる修正である。

## Scope

- `src/docs/lib/template-merger.js` — テンプレートレイヤー構築・テンプレート解決・章順序解決の各関数にプロジェクトルートを受け取る引数を追加し、内部のプリセット解決呼び出しに伝播する
- `src/docs/commands/init.js` — 上記関数の呼び出し側にプロジェクトルートを渡す
- `src/setup.js` — 設定サマリー表示および設定ファイル書き込みの各呼び出し箇所にプロジェクトルートを渡す

## Out of Scope

- プロジェクトローカルプリセットのセットアップウィザードでの一覧表示
- `docs scan` / DataSource 解決（既に正しく動作）
- プロジェクトローカルプリセットの親チェーン解決（現在の設計ではローカルプリセットはリーフのみ）

## Requirements

**P1（必須 — バグ修正の核心）:**

1. When プロジェクトローカルプリセットを `type` に指定して `sdd-forge docs init` を実行したとき、`Preset not found` エラーが発生せず、`docs/` 配下に各チャプターファイルが生成されること
2. When プロジェクトローカルプリセットを `type` に指定して `sdd-forge docs build` を実行したとき、パイプライン全体がエラーなく完了し、`docs/` 配下にドキュメントが出力されること

**P2（整合性 — 一貫性確保）:**

3. When プロジェクトローカルプリセットを `type` に含む状態で `sdd-forge setup` を実行したとき、設定確認画面および設定ファイルの書き込みが `Preset not found` エラーなく完了すること

**P3（回帰防止）:**

4. If プロジェクトローカルプリセットを使用していない既存プロジェクトで `docs init` / `docs build` / `setup` を実行したとき、今回の変更前と全く同じ結果が得られること（デグレなし）

## Acceptance Criteria

- [ ] `.sdd-forge/presets/foo/` にプリセットを配置し `config.json` の `type` に `"foo"` を設定した状態で `sdd-forge docs init` を実行すると、エラーなく `docs/` 配下にファイルが生成される
- [ ] 同構成で `sdd-forge docs build` を実行すると、全パイプラインがエラーなく完了する
- [ ] 同構成で `sdd-forge setup` を実行すると、設定確認・書き込みがエラーなく完了する
- [ ] プロジェクトローカルプリセットを使わない既存プロジェクトで `docs init` / `docs build` / `setup` の動作が変わらない
- [ ] `npm test` がすべてパスする

## Test Strategy

- **種別:** ユニットテスト（`npm test` スイートに追加）
- **配置:** `src/docs/lib/__tests__/template-merger.test.js`（既存テストファイルに追加）
- **検証内容:**
  - When プロジェクトローカルプリセットが存在する状態でプロジェクトルートを渡したとき、テンプレートレイヤーにそのプリセットのテンプレートディレクトリが含まれること
  - When プロジェクトローカルプリセットが存在する状態でプロジェクトルートを渡したとき、章順序解決がそのプリセットの章定義を返すこと
  - If プロジェクトルートを渡さない場合、組み込みプリセットのみを使う従来の動作と同じ結果になること（回帰テスト）

## Clarifications (Q&A)

- Q: `setup` コマンドの設定サマリー表示処理もスコープに含めるか？
  - A: 含める。`docs scan` / DataSource ファクトリーなど他のコードパスはプロジェクトルートを一貫して利用している。`setup` だけを除外すると将来の混乱を招くため、一貫性を優先する。

- Q: テストはどこに置くか？
  - A: 正式な `npm test` スイート（`src/docs/lib/__tests__/`）に追加する。今回の修正は公開インターフェースの契約変更であり、将来の変更でも継続的に検証すべきため。

## Alternatives Considered

- **`docs init` / `setup` の呼び出し元でプロジェクトルートを取得して直接プリセット解決する案**: 既存のテンプレートマージ API を迂回することになり、将来的な保守コストが増大するため不採用。プロジェクトルートを API に伝播させる方が設計の一貫性が高い。

## Impact on Existing Features

- **既存プロジェクトへの影響なし**: プロジェクトルートはオプション引数として追加するため、既存の呼び出し元は変更不要であり動作も変わらない
- **`docs scan` / DataSource 解決**: 変更なし（既に正しく動作）
- **CLIインターフェース**: 変更なし（コマンド・オプションの追加・削除なし）

## Open Questions

- なし

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-14
- Notes: 承認済み。テスト作成フェーズへ進む。
