# Feature Specification: 138-symfony-guardrails

**Feature Branch**: `feature/138-symfony-guardrails`
**Created**: 2026-04-04
**Status**: Draft
**Issue**: #83

## Goal

Symfony プリセットにフレームワーク固有の guardrail を34件追加し、coding-rule プリセットに汎用コード品質ルールを2件追加する。guardrail システムで review フェーズを有効化し、NOTICE ファイルで出典の謝辞を記載する。

## Design Rationale

3つの外部ソース（awesome-copilot, symfony-ux-skills, EasyAdminBundle AGENTS.md）から guardrail の本質を抽出し、sdd-forge の guardrail フォーマットに合わせて独自の文章で再記述する。元コンテンツのコピーはしない。

既存の Symfony guardrail（4件: parameterized-queries, service, voter, dto）と親チェーン（webapp: 8件）との重複を排除し、Symfony 固有でない汎用ルールは適切なプリセット（coding-rule）に配置する。

UX 系 guardrail は body に条件前置（「〜を使用するプロジェクトの場合:」）を付け、未使用プロジェクトでの誤誘導を回避する。

## Scope

1. `src/presets/symfony/templates/{ja,en}/guardrail.json` に34件の guardrail を追加
2. `src/presets/coding-rule/templates/{ja,en}/guardrail.json` に2件の guardrail を追加
3. `src/flow/lib/phases.js` の `VALID_PHASES` に `"review"` を追加
4. `src/presets/symfony/NOTICE` を作成

## Out of Scope

- 除外した EasyAdmin 固有ルール（Yoda 条件式、例外メッセージ書式、コメント規約）の追加
- 除外した CSS 汎用ルール（ネストルール禁止、論理プロパティ）の web-design プリセットへの追加
- guardrail エンジンの条件フィルタ機能（meta.when フィールド等）の追加
- 他プリセット（Laravel, CakePHP2, Next.js 等）へのフレームワーク固有 guardrail 追加

## Clarifications (Q&A)

- Q: 既存の Symfony guardrail（4件）との重複はどう扱うか？
  - A: 重複する2件（#1 service, #4 voter）は除外。残りは既存と補完関係にあるため追加する。

- Q: Symfony 固有でない汎用ルール（厳密比較、早期リターン等）はどこに置くか？
  - A: coding-rule プリセットに配置する。このスコープに含める。

- Q: UX 系 guardrail（Stimulus/Turbo/LiveComponent 等）は使っていないプロジェクトで誤誘導しないか？
  - A: body に「〜を使用するプロジェクトの場合:」を条件前置して回避する。全10件を Symfony プリセットに入れる。

- Q: review フェーズの guardrail はシステムで処理できるか？
  - A: phases.js の VALID_PHASES に review を追加すれば動作する。filterByPhase は文字列マッチのため追加コード変更不要。

- Q: 元コンテンツのライセンスは？
  - A: 3ソースすべて MIT。コピーはせず独自の文章で再記述し、NOTICE に inspired by として出典を記載する。

## Impact on Existing Features

- **既存 Symfony guardrail 4件**: 変更なし。新規34件は既存 id と重複しない。
- **既存 coding-rule guardrail 3件**: 変更なし。新規2件は既存 id と重複しない。
- **phases.js**: `VALID_PHASES` に `"review"` を追加するのみ。既存フェーズ名の削除・変更なし。`sdd-forge flow get guardrail review` が新たに使用可能になる。
- **既存テスト**: guardrail.json のフォーマットは既存と同一。プリセット整合性テストは影響なし（guardrail は scan/data と無関係）。

## Priority

全件実装が前提。実装順序:
1. **P1**: `src/flow/lib/phases.js` に `"review"` 追加
2. **P2**: Symfony guardrail 34件（ja + en）
3. **P3**: coding-rule guardrail 2件（ja + en）
4. **P4**: `src/presets/symfony/NOTICE`

## Requirements

### R1: phases.js に review フェーズを追加する

`src/flow/lib/phases.js` の `VALID_PHASES` 配列に `"review"` を追加する。既存フェーズの順序・名前は変更しない。

### R2: Symfony プリセットに spec フェーズ guardrail 7件を追加する

以下の id で guardrail を `src/presets/symfony/templates/{ja,en}/guardrail.json` に追加する。既存4件は維持する。

| id | phase |
|----|-------|
| no-bundle-for-app-code | spec |
| env-vars-for-infra-only | spec |
| use-messenger-for-async | spec |
| ux-package-selection-criteria | spec |
| live-component-performance-design | spec |
| stable-public-interfaces | spec |
| use-enums-for-fixed-values | spec |

### R3: Symfony プリセットに impl フェーズ guardrail 19件を追加する

| id | phase |
|----|-------|
| constructor-injection-only | impl |
| forms-as-php-classes | impl |
| avoid-raw-filter | impl |
| snake-case-templates | impl |
| key-based-translations | impl |
| doctrine-attribute-mapping | impl |
| schema-changes-via-migrations | impl |
| use-asset-mapper | impl |
| single-firewall-preferred | impl |
| stimulus-controller-name-match | impl |
| stimulus-no-dom-assumption-on-connect | impl |
| turbo-frame-id-match | impl |
| turbo-cache-js-reinit | impl |
| turbo-stream-redirect-loss | impl |
| twig-component-prop-leak | impl |
| live-prop-required-for-state | impl |
| live-prop-no-complex-objects | impl |
| ux-icons-lock-before-deploy | impl |
| ux-map-height-required | impl |

UX 系（stimulus-*, turbo-*, twig-component-*, live-*, ux-*）の body には「〜を使用するプロジェクトの場合:」を前置する。

### R4: Symfony プリセットに impl+review 兼用 guardrail 3件を追加する

| id | phase |
|----|-------|
| no-container-get | impl, review |
| no-direct-form-building-in-controller | impl, review |
| trans-filter-required | impl, review |

### R5: Symfony プリセットに review 専用 guardrail 5件を追加する

| id | phase |
|----|-------|
| detect-raw-filter-usage | review |
| detect-stimulus-name-mismatch | review |
| detect-turbo-frame-id-mismatch | review |
| detect-live-prop-state-dependency | review |
| verify-ux-icons-lock | review |

review 専用 guardrail の body は「レビュー時:」で始め、検出対象と確認内容を記述する。
UX 系の body には「〜を使用するプロジェクトのレビュー時:」を前置する。

### R6: coding-rule プリセットに guardrail 2件を追加する

`src/presets/coding-rule/templates/{ja,en}/guardrail.json` に以下を追加する。既存3件は維持する。

| id | phase |
|----|-------|
| strict-comparison-only | impl |
| no-else-after-return | impl |

### R7: NOTICE ファイルを作成する

`src/presets/symfony/NOTICE` を作成し、`src/presets/web-design/NOTICE` と同じ形式で出典3件を記載する。

### R8: ja/en 両言語で guardrail を記述する

R2-R6 の guardrail はすべて ja/ と en/ の両ディレクトリに作成する。title と body は各言語で適切に記述する。

## Acceptance Criteria

- [ ] `sdd-forge flow get guardrail review` がエラーなく動作すること
- [ ] `sdd-forge flow get guardrail spec` で新規 Symfony spec guardrail が含まれること（Symfony プリセット設定のプロジェクトで確認）
- [ ] `sdd-forge flow get guardrail impl` で新規 Symfony impl guardrail が含まれること
- [ ] `sdd-forge flow get guardrail review` で新規 Symfony review guardrail が含まれること
- [ ] coding-rule プリセットの guardrail に strict-comparison-only と no-else-after-return が含まれること
- [ ] 既存の Symfony guardrail 4件が維持されていること
- [ ] 既存の coding-rule guardrail 3件が維持されていること
- [ ] guardrail.json が有効な JSON であること
- [ ] `npm test` が通ること（プリセット整合性テスト含む）
- [ ] NOTICE ファイルが src/presets/symfony/ に存在すること

## Test Strategy

- **テスト対象**: guardrail.json のフォーマット、phases.js の VALID_PHASES、guardrail ローダーの review フェーズ対応
- **テスト手法**: 既存のプリセット整合性テスト（`npm test`）で guardrail.json の構文チェック + spec 固有テストで review フェーズのフィルタ動作を検証
- **テスト配置**: phases.js の変更は `tests/` に配置（公開 API）。guardrail 内容の検証は `specs/138-symfony-guardrails/tests/` に配置（spec 固有）

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-04-04
- Notes: Gate all PASS. Spec review skipped due to subprocess error (logged in issue-log).

## Open Questions
- (none)
