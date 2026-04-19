# Tests for spec 194-update-creating-presets-di

spec ローカルの静的検証テスト。`npm test` には含めず、本 spec の実装検証専用。

## 配置

| ファイル | 目的 |
|---|---|
| `guide-contract.test.js` | `.sdd-forge/templates/{ja,en}/docs/creating_presets.md` が spec 191 の factory DI 契約に整合することを検証 |

## 検証内容

| Req | 検証 |
|---|---|
| R1 | `register(container)` factory パターンが例示される。`export default class ... extends DataSource` の旧形式例が残っていない |
| R2 | `container.get("base.*")` の記述がある |
| R3 | `container.getPreset(...).dataSources` の記述がある |
| R4 | `sdd-forge/api` / `sdd-forge/presets/*` の旧 import が残っていない |
| R6 | ja 版 / en 版の見出しの数とレベル順序が一致 |
| R7 | `src/lib/container.js` で `container.register(...)` される全キーがガイドに列挙されている |
| R8 | `peerDependencies` が記述されている |

## 実行

```bash
node --test specs/194-update-creating-presets-di/tests/guide-contract.test.js
```

spec 完了時点で全テストが PASS すること。初期状態 (旧ガイド) では FAIL する設計。
