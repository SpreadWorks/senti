# Feature Specification: 180-schema-driven-config-validation

**Feature Branch**: `feature/180-schema-driven-config-validation`
**Created**: 2026-04-17
**Status**: Draft
**Input**: GitHub Issue #153

## Goal

config のバリデーション定義が 3 箇所（JSDoc 型定義、手書きバリデーション関数 280 行、config.example.json）に分散している問題を解消する。JSON Schema サブセット形式のスキーマ定義を Single Source of Truth とし、汎用バリデータでバリデーションを行う構成に転換する。

## Scope

1. `src/lib/config.js` にスキーマ定義（JS オブジェクト、private 定数）と `validate()` 関数を追加する
2. `src/lib/schema-validate.js` に汎用スキーマバリデータを新設する
3. `src/lib/types.js` から `validateConfig()` を削除し、JSDoc 型定義と定数のみ残す
4. `src/templates/config.example.json` を削除する
5. 呼び出し元の import パスと関数名を更新する
6. 影響を受ける既存テストを修正する

## Out of Scope

- `resolveOutputConfig()` の移動・整理（別タスク board 2268）
- config フィールド構造の変更（defaultLanguage の廃止等）
- warn レベルの導入
- JSON Schema フル準拠（サブセットのみ実装）

## Clarifications (Q&A)

- Q: スキーマ形式は？
  - A: JSON Schema サブセット。サポート語彙: `type`, `required`, `properties`, `additionalProperties`, `enum`, `oneOf`, `items`, `minimum`, `minLength`, `minItems`, `deprecated`

- Q: severity 設計は？
  - A: 全て error（throw）で統一。alpha 版ポリシーに従い warn は設けない。未知フィールド、非推奨フィールドも error

- Q: config.example.json はどうする？
  - A: 削除する。コードから未参照であり、setup は wizard から config を直接生成している

- Q: types.js の分割方針は？
  - A: `validateConfig()` を `config.js` に `validate()` として移動。`resolveOutputConfig()` は本 spec スコープ外（types.js に残す）

- Q: スキーマ定義の形式は？
  - A: JS オブジェクト（`config.js` 内の private 定数）。JSON ファイルではない。コメント記述可、独自拡張（deprecated）が自然

- Q: cross-field validation はどうする？
  - A: スキーマバリデーション後にポストチェックとして実装。対象は 2 箇所: (a) defaultLanguage ∈ languages、(b) profiles の provider 参照が providers に存在するか

- Q: command-context.js の catch { config = {} } は silent error swallowing ではないか？
  - A: いいえ。config が未作成またはバリデーション失敗は正常なケース（setup 前、help 表示時、type 未設定時等）。このパスは docs コマンドの共通入口であり、config 不在でも動作するために意図的にフォールバックしている。後続処理はオプショナルチェーンで安全に扱う。本 spec は import パスの更新のみであり、このフォールバックパターンは変更対象外

- Q: 162-agent-commands-entries.test.js のテストブロック削除は test disabling ではないか？
  - A: config.example.json 自体が削除されるため、そのファイルに依存するテストは削除が妥当。R6 で明示的に承認済み

## Alternatives Considered

- **独自軽量記法**: 学習コストが高く、JSON Schema の基本語彙で現在のパターンをカバーできるため不採用
- **JSON ファイル（config.schema.json）**: コメント不可、deprecated 等の独自拡張でエディタ lint が警告する可能性があるため不採用
- **warn/error 分離（severity 設計案 A）**: alpha 版ポリシー「後方互換コードは書かない」と矛盾するため不採用
- **config 構造変更（defaultLanguage 廃止）**: 本 spec のスコープを超えるため不採用

## Why This Approach

現在の手書きバリデーション（280 行の単一関数）は、フィールド追加のたびに条件分岐を手動で追加する必要がある。スキーマ駆動にすることで:
- フィールド追加はスキーマにプロパティを追加するだけで完了する
- `additionalProperties: false` により未知フィールドを自動検出できる
- AI がスキーマを読めば config の全体像を把握でき、実装ミスが減る
- 汎用バリデータは config 以外のスキーマにも再利用可能

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-04-17
- Notes: autoApprove mode

## Impact on Existing Features

- `config.js` の `loadConfig()` は内部で `validate()` を呼ぶよう変更される。呼び出し元に変更は不要
- `setup.js` は `validateConfig` の import を `config.js` の `validate` に変更する
- 既知フィールドに対するバリデーション結果は変わらない
- 未知フィールドを含む config は新たにバリデーション失敗になる（alpha 版ポリシーにより許容）
- `config.example.json` の削除により、このファイルに依存する E2E テスト 1 件が影響を受ける

## Requirements

1. **[P1] スキーマ定義の作成**: スキーマ駆動バリデーションを実装する際に、`src/lib/config.js` に config の全フィールド構造を JSON Schema サブセット形式の JS オブジェクトとして定義すること。スキーマは export しない（private 定数）
2. **[P1] 汎用スキーマバリデータの新設**: スキーマ駆動バリデーションを実装する際に、`src/lib/schema-validate.js` を新設し、スキーマ定義を受け取って対象オブジェクトを検証する汎用関数を実装すること。サポートする語彙: `type`, `required`, `properties`, `additionalProperties`, `enum`, `oneOf`, `items`, `minimum`, `minLength`, `minItems`, `deprecated`。スキーマのネスト深度は config の実際の深度（最大 5 階層）に制約され、再帰走査はスキーマ構造に従って有限回で終了する
3. **[P1] validate() 関数の実装**: `config.js` の `loadConfig()` が config オブジェクトをロードした際に、`validate(raw)` を呼び出すこと。`validate()` は内部でスキーマバリデータを呼び、その後ポストチェック 2 箇所（defaultLanguage ∈ languages、provider 参照の有効性）を実行する。検証失敗が 1 件以上ある場合、errors 配列を結合して throw する
4. **[P1] validateConfig() の削除と移行**: スキーマ駆動バリデーションへの移行に伴い、`src/lib/types.js` から `validateConfig()` と関連定数（`VALID_TONES`）を削除すること。`VALID_TONES` はスキーマの `enum` に吸収される。`setup.js` で `validateConfig` を import している箇所を `config.js` の `validate` に更新する
5. **[P2] config.example.json の削除**: スキーマが SSOT になった際に、コードから未参照の `src/templates/config.example.json` を削除すること
6. **[P2] 既存テストの修正**: `config.example.json` が削除された場合、このファイルに依存するテスト（`tests/e2e/162-agent-commands-entries.test.js`）から `config.example.json` への参照を削除し、テストが依存しない形に書き換えること。テストが検証していたファイル自体が削除される場合、そのテストブロックの削除は「テスト無効化」ではなく「不要テストの適切な除去」として許容される

## Acceptance Criteria

- [ ] `validate(validConfig)` が error なく完了すること（既存の有効な config が引き続き通ること）
- [ ] `validate({...validConfig, unknownField: 1})` が「未知フィールド」エラーを throw すること
- [ ] `validate({...validConfig, name: "old"})` が deprecated フィールドに対して error を throw すること（`name` は deprecated）
- [ ] `validate()` のエラーメッセージにフィールドパスと理由が含まれること
- [ ] `defaultLanguage` が `languages` に含まれない config で error が throw されること
- [ ] `profiles` で未定義の provider を参照した config で error が throw されること
- [ ] `src/lib/types.js` に `validateConfig` 関数が存在しないこと
- [ ] `src/templates/config.example.json` が存在しないこと
- [ ] `npm test` が全て pass すること
- [ ] `schema-validate.js` が任意のスキーマ定義とオブジェクトの組み合わせで動作すること（config 固有のロジックを含まないこと）

## Test Strategy

- **ユニットテスト（`tests/`）**: `schema-validate.js` の汎用バリデータは公開 API の契約テスト。各語彙（type, required, enum, oneOf, items, minimum, minLength, minItems, additionalProperties, deprecated）の検証を個別にテストする
- **ユニットテスト（`tests/`）**: `config.js` の `validate()` は公開 API の契約テスト。有効な config、各種無効な config（型違い、必須欠落、未知フィールド、deprecated フィールド、cross-field 不整合）をテストする
- **spec 検証テスト（`specs/180-*/tests/`）**: acceptance criteria の検証

## Open Questions
- (none)
