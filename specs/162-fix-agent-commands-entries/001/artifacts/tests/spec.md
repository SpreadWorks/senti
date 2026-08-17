# Test Design

### Test Design

---

#### R1 — `AgentConfig` 型定義の修正

- **TC-1: AgentConfig に `profiles` プロパティが存在する**
  - Type: unit
  - Input: `AgentConfig` typedef を JSDoc パーサー・型チェッカー等で検査
  - Expected: `profiles` プロパティが `Object<string, Object<string, string>>` 型として定義されている

- **TC-2: AgentConfig に `commands` プロパティが存在しない**
  - Type: unit
  - Input: `AgentConfig` typedef を検査
  - Expected: `commands` プロパティが typedef に含まれない

---

#### R2 — `validateConfig` への `agent.profiles` バリデーション追加

**Happy Path**

- **TC-3: `agent.profiles` が省略された config は valid**
  - Type: unit
  - Input: `{ agent: { default: "claude" } }` — `profiles` キーなし
  - Expected: バリデーションエラーなし

- **TC-4: 正常な `profiles` オブジェクトは valid**
  - Type: unit
  - Input: `{ agent: { profiles: { default: { "docs.enrich": "claude" } }, providers: {} } }`（`claude` は BUILTIN_PROVIDERS に存在）
  - Expected: バリデーションエラーなし

- **TC-5: カスタム providers を参照する profiles は valid**
  - Type: unit
  - Input: `{ agent: { providers: { myProvider: {...} }, profiles: { default: { "docs.text": "myProvider" } } } }`
  - Expected: バリデーションエラーなし（providers と BUILTIN_PROVIDERS のマージから参照を解決できる）

- **TC-6: BUILTIN_PROVIDERS の全プロバイダーを profiles 値として使用できる**
  - Type: unit
  - Input: BUILTIN_PROVIDERS の各キーを profiles の値に設定した config
  - Expected: 各プロバイダーでバリデーションエラーなし

**Edge Cases / Boundary Conditions**

- **TC-7: `profiles` に空オブジェクト `{}` を渡す**
  - Type: unit
  - Input: `{ agent: { profiles: {} } }`
  - Expected: バリデーションエラーなし（空は許容）

- **TC-8: プロファイルの value が空オブジェクト `{}`**
  - Type: unit
  - Input: `{ agent: { profiles: { default: {} } } }`
  - Expected: バリデーションエラーなし（エントリなしは許容）

- **TC-9: `agent.providers` が未定義で BUILTIN_PROVIDERS のみでマージする**
  - Type: unit
  - Input: `{ agent: { profiles: { default: { "docs.init": "claude" } } } }` — `providers` キーなし
  - Expected: BUILTIN_PROVIDERS に `claude` が存在すればエラーなし

- **TC-10: profiles のキー（commandId）に特殊文字・ドット区切りが含まれる**
  - Type: unit
  - Input: `{ agent: { profiles: { default: { "flow.review.test": "claude" } } } }`
  - Expected: バリデーションエラーなし（キー形式は制約なし）

**Error Paths**

- **TC-11: `profiles` が配列の場合はエラー**
  - Type: unit
  - Input: `{ agent: { profiles: [] } }`
  - Expected: "profiles must be an object" 相当のバリデーションエラー

- **TC-12: `profiles` がプリミティブ（文字列）の場合はエラー**
  - Type: unit
  - Input: `{ agent: { profiles: "default" } }`
  - Expected: バリデーションエラー

- **TC-13: プロファイル値（個々のプロファイル）が配列の場合はエラー**
  - Type: unit
  - Input: `{ agent: { profiles: { default: ["claude"] } } }`
  - Expected: "each profile value must be an object" 相当のエラー

- **TC-14: プロファイルエントリの値が文字列でない（数値）場合はエラー**
  - Type: unit
  - Input: `{ agent: { profiles: { default: { "docs.text": 42 } } } }`
  - Expected: "profile entry value must be a string" 相当のエラー

- **TC-15: プロファイルエントリの値が文字列でない（null）場合はエラー**
  - Type: unit
  - Input: `{ agent: { profiles: { default: { "docs.text": null } } } }`
  - Expected: バリデーションエラー

- **TC-16: 参照先プロバイダーが BUILTIN_PROVIDERS にも `raw.agent.providers` にも存在しない**
  - Type: unit
  - Input: `{ agent: { profiles: { default: { "docs.enrich": "unknownProvider" } } } }`
  - Expected: "provider 'unknownProvider' not found" 相当の参照整合性エラー

- **TC-17: `raw.agent.providers` を上書きしても BUILTIN_PROVIDERS を隠さない**
  - Type: unit
  - Input: `{ agent: { providers: { custom: {...} }, profiles: { default: { "docs.text": "claude" } } } }`
  - Expected: BUILTIN_PROVIDERS と providers のマージで `claude` を解決できるためエラーなし

- **TC-18: 複数プロファイルのうち1つだけ参照エラーがある場合**
  - Type: unit
  - Input: `{ agent: { profiles: { default: { "docs.text": "claude" }, staging: { "docs.text": "ghost" } } } }`（ghost は未定義）
  - Expected: `staging` プロファイルに対するエラーのみ報告される

**Integration**

- **TC-19: `validateConfig` 全体フローで `agent.profiles` を含む config が正常処理される**
  - Type: integration
  - Input: 完全な有効 config（`lang`, `type`, `docs`, `agent.profiles` を含む）
  - Expected: `validateConfig` がエラーなしで完了し、設定オブジェクトを返す

- **TC-20: `BUILTIN_PROVIDERS` インポートが `agent.js` から正しく行われる**
  - Type: integration
  - Input: `types.js` を `import` し `validateConfig` を呼び出す
  - Expected: モジュール読み込みエラーなし、`BUILTIN_PROVIDERS` が正常参照される

---

#### R3 — `config.example.json` の profiles 形式への書き直し

- **TC-21: `agent.commands` キーが削除されている**
  - Type: unit
  - Input: `config.example.json` をパースして検査
  - Expected: `config.agent.commands` が存在しない

- **TC-22: `agent.profiles.default` が存在する**
  - Type: unit
  - Input: `config.example.json` をパース
  - Expected: `config.agent.profiles.default` がオブジェクトとして存在する

- **TC-23: 既存 commandId が全て `profiles.default` に含まれる**
  - Type: unit
  - Input: `config.example.json` をパース
  - Expected: `docs.enrich`, `docs.text`, `docs.forge`, `docs.readme`, `docs.agents`, `spec.gate`, `flow.review.draft`, `flow.review.final`, `docs.translate` が `profiles.default` に含まれる

- **TC-24: 新規追加の commandId が `profiles.default` に含まれる**
  - Type: unit
  - Input: `config.example.json` をパース
  - Expected: `docs.init`, `flow.review.test`, `flow.review.spec`, `flow.retro`, `context.search` が `profiles.default` に含まれる

- **TC-25: `agent.providers` 内の `profiles` フィールド（旧フォーマット）が削除されている**
  - Type: unit
  - Input: `config.example.json` をパースし `agent.providers` 以下を検査
  - Expected: 各プロバイダーオブジェクトに `profiles` キーが存在しない

- **TC-26: `config.example.json` が `validateConfig` を通過する**
  - Type: integration
  - Input: `config.example.json` をそのまま `validateConfig` に渡す
  - Expected: バリデーションエラーなし（example が常に valid であること）

- **TC-27: `profiles.default` の各値が `validateConfig` の参照整合性チェックを通過する**
  - Type: integration
  - Input: `config.example.json` をそのまま `validateConfig` に渡す
  - Expected: 全 commandId の参照先プロバイダーが BUILTIN_PROVIDERS または `providers` に存在する

---

#### R4 — コード修正

**R4-a: `src/docs/commands/init.js`**

- **TC-28: `resolveCommandContext` が `commandId: "docs.init"` 付きで呼ばれる**
  - Type: unit
  - Input: `init.js` のエントリポイントを呼び出す（`cli` をモック）
  - Expected: `resolveCommandContext` に渡される第2引数が `{ commandId: "docs.init" }` である

- **TC-29: `docs init` コマンド実行時に `agent.profiles.default["docs.init"]` のプロバイダーが使用される**
  - Type: integration
  - Input: `agent.profiles.default` に `"docs.init": "claude"` を持つ config で `docs init` を実行
  - Expected: `claude` プロバイダーが選択される

- **TC-30: `commandId` 未指定の旧シグネチャが削除されている（リグレッション防止）**
  - Type: unit
  - Input: `init.js` のソースを静的検査（`resolveCommandContext(cli)` の1引数呼び出しが存在しないこと）
  - Expected: 旧シグネチャの呼び出しが0件

**R4-b: `src/flow/lib/run-retro.js`**

- **TC-31: エラーメッセージに `agent.profiles` への言及が含まれる**
  - Type: unit
  - Input: `run-retro.js` の該当エラーパスをトリガーする（プロバイダー未設定状態）
  - Expected: エラーメッセージに `agent.profiles` が含まれ、`agent.commands` が含まれない

- **TC-32: エラーメッセージに `agent.commands.flow.retro` が含まれない**
  - Type: unit
  - Input: `run-retro.js` の line 188 付近のエラー文字列を検査
  - Expected: `agent.commands` 文字列が存在しない

- **TC-33: `flow retro` コマンドが正常設定（`profiles` あり）では実行される**
  - Type: integration
  - Input: `agent.profiles.default["flow.retro"]` を設定した config で `flow retro` を呼び出す
  - Expected: エラーメッセージなしで retro フローが進行する

- **TC-34: `flow retro` コマンドが `profiles` 未設定の場合に適切なエラーを返す**
  - Type: integration
  - Input: `agent.profiles` を持たない config で `flow retro` を呼び出す
  - Expected: `agent.profiles` への設定方法を示すエラーメッセージが返る

---

#### テスト分類サマリー

| Type | 件数 |
|------|------|
| unit | 28 |
| integration | 6 |
| acceptance | 0 |
| **合計** | **34** |

> **注**: R1・R2・R4 は内部ロジックが中心のため unit テストが主体。R3 の example.json は `validateConfig` との疎通で integration テストを補完。acceptance テストは今回スコープ外（CLI E2E は既存テストスイートに委ねる）。
