# Tests for spec 174-fix-local-preset-init-build

## What was tested

プロジェクトローカルプリセット（`.sdd-forge/presets/<name>/`）を `docs init` / `docs build` / `setup` で正しく解決できることを検証する。

## Where tests are located

**正式テストスイート**（`npm test:unit` で実行）:

- `tests/unit/docs/lib/template-merger.test.js`
  - `buildLayers — projectRoot` describe ブロック（4件）
  - `resolveChaptersOrder — projectRoot` describe ブロック（2件）
  - `resolveTemplates — projectRoot` describe ブロック（2件）

## How to run

```bash
node tests/run.js --scope unit --filter template-merger
```

または全ユニットテスト:

```bash
npm run test:unit
```

## Expected results

- `buildLayers` に `projectRoot` を渡したとき、ローカルプリセットのテンプレートディレクトリがレイヤーに含まれる（2件）
- `resolveChaptersOrder` に `projectRoot` を渡したとき、ローカルプリセットの章定義が返る（1件）
- `resolveTemplates` に `opts.projectRoot` を渡したとき、`Preset not found` エラーなく解決される（1件）
- `projectRoot` を渡さない場合（回帰）、従来と同じ結果になる（計4件）

実装前（テスト作成時点）は新規テスト4件が FAIL し、回帰テスト4件が PASS することを確認済み。
