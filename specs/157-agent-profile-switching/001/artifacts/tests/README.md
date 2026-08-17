# Tests for spec 157: agent-profile-switching

## What was tested and why

spec 157 の要件（`agent.profiles` / `agent.useProfile` / `SDD_FORGE_PROFILE` プロファイル切り替え）を
実装前に明文化したテストです。実装フェーズ完了後にすべてパスすることを確認してください。

## Test location

| テスト | 配置 | 理由 |
|---|---|---|
| プロファイル解決ロジック | `tests/unit/lib/agent-profiles.test.js` | `resolveAgent` は公開 API。将来の変更で壊れたら常にバグ |

## How to run

```bash
# 新規テストのみ実行
node --test tests/unit/lib/agent-profiles.test.js

# 全ユニットテスト
npm test
```

## Expected results after implementation

- `BUILTIN_PROVIDERS` が `src/lib/agent.js` からエクスポートされる
- `resolveAgent` が `agent.profiles` / `agent.useProfile` を参照してプロバイダーを解決する
- `SDD_FORGE_PROFILE` 環境変数が `agent.useProfile` より優先される
- 存在しないプロファイル名でエラーを throw する
- プレフィックスマッチ（`docs` → `docs.review` にマッチ）が動作する
- ビルトインプロバイダーが config の `providers` 未設定時に使用される
- ユーザー定義プロバイダーがビルトインより優先される

## Currently failing (pre-implementation)

`BUILTIN_PROVIDERS` が未実装のため import エラーで全テスト失敗。実装後に全 pass 予定。
