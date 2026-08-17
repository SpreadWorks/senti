# Spec 188 Tests

本 spec が要求するアーキテクチャ統一（flow / docs / check / metrics の 3 パターン → 1 パターン）の達成を検証するテスト群。

## テスト配置

### 恒久テスト（`tests/unit/lib/`）
将来の変更で壊れたら常にバグとなる、共通実行機構そのもののユニットテスト。

| ファイル | 検証対象 | 関連要件 |
|---|---|---|
| `tests/unit/lib/command.test.js` | `Command` 基底クラスの契約（`run(container, input) → execute(ctx)`、`outputMode` 宣言） | R1, R5 |
| `tests/unit/lib/dispatcher.test.js` | 共通ディスパッチャ（引数解析、ライフサイクルフック順序、出力モード振分、終了コード、エラー可視化） | R4, R5, R6, R8a, R8b |
| `tests/unit/lib/command-registry.test.js` | 単一統合 registry のツリー構造、各 subtree の存在、`outputMode` 全エントリ宣言、キー重複なし | R3 |

### spec 固有テスト（`specs/188-unify-command-architecture/tests/`）
本 spec の移行達成を示す静的検査。移行完了判定用。

| ファイル | 検証対象 | 関連要件 / AC |
|---|---|---|
| `static-checks.test.js` | `commands/` 配下に `repoRoot()` / `loadConfig()` 直呼びが残存しないこと、旧 `main()` export が残存しないこと、ディスパッチャ 4 ファイルが `process.argv =` を使わないこと、`src/lib/command-registry.js` が subtree を export していること | AC1, AC2, AC3 |

## 実行方法

```bash
# 全テスト実行（本 spec 関連含む）
npm test

# 本 spec の静的検査のみ
node --test specs/188-unify-command-architecture/tests/

# 共通実行機構の unit test のみ
node --test tests/unit/lib/command.test.js tests/unit/lib/dispatcher.test.js tests/unit/lib/command-registry.test.js
```

## 期待結果

### 実装前（現時点）
- `tests/unit/lib/command.test.js` → FAIL (`src/lib/command.js` 未作成)
- `tests/unit/lib/dispatcher.test.js` → FAIL (`src/lib/dispatcher.js` 未作成)
- `tests/unit/lib/command-registry.test.js` → FAIL (`src/lib/command-registry.js` 未作成)
- `specs/188-.../tests/static-checks.test.js` → FAIL（旧 `main()` export・`repoRoot()` 直呼びが残存）

### 実装完了後
全テストが PASS する。

## 追加の受入検証 (AC7)

AC7 は CLI 外部互換性の acceptance 検証を要求している。本 spec では以下で代替的に検証する:

1. 移行前のブランチ (`main`) で主要コマンドを実行し stdout / stderr / 終了コードを記録。
2. 移行後のブランチ (`feature/188-unify-command-architecture`) で同じコマンドを実行。
3. 2 つの結果を突合し差分が存在しないことを確認。

実運用手順は実装フェーズで `specs/188-.../tests/acceptance-snapshot.sh` 等として追加する。
