# Feature Specification: 155-add-nextjs-guardrails

**Feature Branch**: `feature/155-add-nextjs-guardrails`
**Created**: 2026-04-08
**Status**: Draft
**Input**: GitHub Issue #108 (dd5e)

## Goal

nextjs プリセットに Next.js 固有の guardrail を9件追加し、AI が nextjs プロジェクトの実装時に従うべきルールを強化する。既存の重複チェック済みリストから抽出した新規ルールのみを追加する。

## Scope

- `src/presets/nextjs/guardrail.json` への9件追加
- `src/presets/nextjs/NOTICE` ファイルの新規作成

## Out of Scope

- 既存の3件（no-server-code-in-client-bundle, audit-next-public-env-vars, verify-against-official-docs）の変更
- 親プリセット（webapp / js-webapp / base）への変更
- guardrail ローダーや表示ロジックの変更
- 新規テストの追加（`npm test` で既存テストが通ることを確認するのみ）

## Clarifications (Q&A)

- Q: `await-async-request-apis` は Next.js 15 以降に固有のルール。body の記述方針は？
  - A: body の文章内で自然に「In Next.js 15 and later, ...」と説明する。タグ形式（`[Next.js 15+]`）は使わない。
- Q: テスト方針は？
  - A: `npm test` を実行して既存テストが通ることを確認するのみ。guardrail.json への追加はデータ変更のみであり、新規テストは不要。

## Alternatives Considered

- webapp / js-webapp への一部配置: 今回の調査では、抽出された候補すべてが Next.js 固有の API・規約に依存するため、nextjs プリセットのみへの配置が適切。framework-agnostic なルールは既存の webapp / js-webapp ですでにカバーされている。

## Why This Approach

Issue #108 で重複分析と出典調査が完了しており、9件すべてが新規かつ適切なスコープと確認済み。guardrail.json への追加とNOTICEファイル作成のみで実現でき、ロジック変更が不要なため低リスク。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-08
- Notes: guardrail.json への9件追加と NOTICE 新規作成のみ。新規テスト不要。

## Requirements

1. `src/presets/nextjs/guardrail.json` の `guardrails` 配列に以下の9件を追加すること（既存3件は変更しない）:

   | Priority | id | phase |
   |----------|----|-------|
   | 1 | server-components-by-default | spec, impl |
   | 2 | route-handler-vs-server-action | spec |
   | 3 | use-nextjs-optimized-components | impl, review |
   | 4 | await-async-request-apis | impl |
   | 5 | suspense-boundary-for-search-params | impl |
   | 6 | parallel-route-default-required | impl |
   | 7 | error-boundary-client-component | impl |
   | 8 | no-dynamic-ssr-false-in-server-components | review |
   | 9 | no-route-page-coexistence | review |

2. 各 guardrail エントリは以下のフィールドを持つこと:
   - `id`: ハイフン区切りの識別子
   - `title`: 英語のタイトル文字列
   - `body`: 英語の説明文（AIへの指示として機能する）
   - `meta.phase`: 適用フェーズの配列

3. `src/presets/nextjs/NOTICE` ファイルを新規作成すること。`src/presets/web-design/NOTICE` の形式に準拠し、以下を含めること:
   - 影響を受けた9件の記事名一覧
   - 出典（github/awesome-copilot MIT、PatrickJS/awesome-cursorrules CC0 1.0）

4. `npm test` を実行し、既存テストがすべて PASS することを確認すること。

   Note: `sdd-forge upgrade` は `src/presets/` 変更ルールに従い実行済み（2026-04-08）。ただし `.claude/` は `.gitignore` 対象のため diff に証跡は残らない。guardrail.json はスキルテンプレートではないため upgrade による成果物変更はない。

## Acceptance Criteria

- `guardrail.json` に9件が追加され、既存3件が変更されていないこと
- 追加された各エントリが `id`, `title`, `body`, `meta.phase` を持つこと
- `await-async-request-apis` の body に "In Next.js 15 and later" と記載されていること
- `NOTICE` ファイルが `src/presets/nextjs/` に存在し、9件の記事名と出典が記載されていること
- `npm test` がすべて PASS すること

## Test Strategy

guardrail.json への純粋なデータ追加であるため、新規テストは作成しない。`npm test` を実行して以下を確認する:
- プリセット整合性テスト（`tests/unit/presets/preset-scan-integrity.test.js`）が PASS すること
- nextjs プリセット固有テスト（`src/presets/nextjs/tests/`）が PASS すること

## Implementation Notes

- `sdd-forge upgrade` 実行済み（2026-04-08）。スキル9件が更新された。`.claude/` は `.gitignore` 対象のため diff には現れない。
- `npm test` 実行済み（2026-04-08）。101 suites PASS、`not ok` なし。

## Open Questions

なし
