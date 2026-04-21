# Feature Specification: 209-improve-draft-template

**Feature Branch**: `feature/209-improve-draft-template`
**Created**: 2026-04-21
**Status**: Draft
**Input**: GitHub Issue #206

## Goal
draft.md に skeleton テンプレートと構造的検証を導入し、gate-draft で繰り返される reject（Impact on Existing Features 記述の場所不明、開発種別/目的フィールドの書式不明）を削減する。

## Background
issue-log 横断調査 (spec 162〜多数) で、draft 段階の同種の指摘が繰り返し発生している: (1) 既存機能への影響有無を明示する専用記述が不足、(2) 開発種別・目的フィールドの書式不明。draft.md は現在 skeleton ファイルを生成せず、AI がプロンプト指示だけで作成するため shape が spec ごとにバラつく。専用セクションを skeleton に埋め込み、gate で構造検証することで reject を構造的に防ぐ。

## Scope
- src/flow/lib/run-prepare-spec.js に draft.md skeleton 生成を追加（spec.md / qa.md と並列）
- draft.md skeleton に 開発種別 / 目的 / Scope Verification / Impact on Existing Features / Q&A / Open Questions / User Approval セクションを含める
- src/flow/lib/run-gate.js の checkDraftText に section 存在検証（## Scope Verification と ## Impact on Existing Features）と開発種別の enum 値検証を追加
- 開発種別の enum を feature / bugfix / refactor / docs / chore / test / other に固定
- src/flow/prompts/plan/draft.md を新 skeleton 前提に更新（enum 値と section 必須化を明記）
- dead code 削除: src/flow/lib/run-prepare-spec.js 内の DEFAULT_SPEC_TEMPLATE / createSpecTemplate / spec.md 向け loadLocalTemplate 分岐
- checkDraftText の unit test を tests/unit/flow/ 配下に追加

## Out of Scope
- spec.md の template / gate の変更（renderSpecMarkdown で既に mandatory sections を出力済み）
- 既存 spec 配下にある過去の draft.md の書き換え・移行（alpha 期間のため backward compat 不要）
- src/presets/base/guardrail.json の impact-on-existing-features 定義変更
- .sdd-forge/templates/<lang>/specs/ 配下での draft.md local override サポート追加
- codex CLI の stdin hang 問題の修正（gate-draft の issue-log に記録済み。別 spec で対処）

## Constraints
- 外部依存追加禁止（Node.js 組み込みのみ）
- backward compat 不要（alpha 期間）。既存 spec の draft.md は触らない
- enum 値は英語小文字で固定（ラベルは日本語 **開発種別** / 英語 **Development Type** 両方受け入れるが値は英語）

## Design Principles
- draft skeleton は inline 定数 + build 関数で実装（既存の buildQaTemplate パターンに合わせる）
- gate の機械検証は section header の存在と enum 値の正規表現マッチのみ。AI guardrail には依存しない
- skeleton は最低限のプレースホルダのみ置き、AI の記入余地を広く取る

## Overview
### Modules
- src/flow/lib/run-prepare-spec.js: buildDraftTemplate() 関数を新設し、writeSpecFiles 内で draft.md を生成する。dead code (DEFAULT_SPEC_TEMPLATE / createSpecTemplate) を削除
- src/flow/lib/run-gate.js: checkDraftText に section 存在検証と enum 値検証を追加
- src/flow/prompts/plan/draft.md: 新 skeleton 前提の指示に更新
- tests/unit/flow/check-draft-text.test.js: 新規テストファイル

### Data Flow
- sdd-forge flow prepare → run-prepare-spec.js が spec.md / qa.md / draft.md を worktree に生成
- AI が draft.md の placeholder を埋める（プロンプト指示は src/flow/prompts/plan/draft.md）
- sdd-forge flow run gate --phase draft → checkDraftText が構造検証（section header + 承認 + 開発種別 enum + 目的）、pass なら AI guardrail 評価

### Decisions
- section 構造は A案（Scope Verification と Impact on Existing Features を独立した ## セクションに分離）。gate は両方の存在を検証
- 開発種別は enum 厳格化（案Y）。違反時は FAIL with `invalid development type "<value>" (expected one of: <enum>)`
- enum = feature / bugfix / refactor / docs / chore / test / other（案Q + other エスケープハッチ）
- skeleton 配置は inline 定数（local override 対応は別 spec で検討）

## Clarifications (Q&A)
- Q: issue #206 の 3 統合対象をそのまま引き受けてよいか
  - A: issue #1（spec.md mandatory sections）は renderSpecMarkdown で既に解消済みと判明。issue #2 (Impact) と issue #3 (field format) を draft.md 側で解決する
- Q: Scope Verification と Impact on Existing Features のセクション構造
  - A: A案（独立した 2 セクション）。gate 機械チェックは両方の header 存在を検証
- Q: 開発種別フィールドの検証レベル
  - A: 案Y（enum 厳格化）。checkDraftText で値検証を追加
- Q: enum 値のセット
  - A: feature / bugfix / refactor / docs / chore / test / other（Conventional Commits に近いが build/perf を省き other をエスケープハッチとして置く）
- Q: dead code 削除を本 spec に含めるか
  - A: 含める（R4 として包含）。DEFAULT_SPEC_TEMPLATE / createSpecTemplate / spec 用 loadLocalTemplate 分岐

## Alternatives Considered
- B案（Scope Verification と Impact on Existing Features を 1 セクションに統合） — 記入負担は軽いが書き漏らしの検出が機械的にできず、gate-draft の reject 削減という目的に反するため却下
- 案X（開発種別を自由記述＋例示） — 運用しながら語彙が育つメリットはあるが、値のバラつきで集計・分類が難しくなるため却下
- 案P / 案R の enum セット — 案P は test 追加をカバーできない。案R は build/perf が sdd-forge の用途で過剰。案Q + other が最適
- skeleton を外部テンプレートファイル化 — 現状 inline 定数で十分。local override 需要が出たら別 spec で検討

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-04-21
- Notes: Auto mode + interactive Q&A 5 rounds. Approved after spec gate pass.

## Requirements
- REQ-1 [must]: `sdd-forge flow prepare` は worktree 作成時に spec.md / qa.md に加えて draft.md skeleton ファイルを生成しなければならない。skeleton には次のセクションを含む: タイトル行、`**開発種別:**` フィールド、`**目的:**` フィールド、`## Scope Verification`（In scope / Out of scope の bullet slot）、`## Impact on Existing Features`（影響ありの既存機能 / 影響なし の bullet slot）、`## Q&A`、`## Open Questions`、`## User Approval`（未チェックの `- [ ] User approved this draft` + Confirmed at + Notes）
- REQ-2 [must]: `checkDraftText(text)` は `## Scope Verification` と `## Impact on Existing Features` の両方の `##` レベル section header が存在することを検証しなければならない。どちらかでも欠けている場合は `missing section: ## Scope Verification` / `missing section: ## Impact on Existing Features` を issues に追加する
- REQ-3 [must]: `checkDraftText(text)` は `**開発種別:**` または `**Development Type:**` の値が enum `feature|bugfix|refactor|docs|chore|test|other` のいずれかに合致することを検証しなければならない。違反時は `invalid development type "<value>" (expected one of: feature, bugfix, refactor, docs, chore, test, other)` を issues に追加する。値の抽出は `**(開発種別|Development Type):**\s*([a-z]+)` のキャプチャで行い、大文字小文字は区別する（小文字以外は FAIL）
- REQ-4 [should]: `src/flow/prompts/plan/draft.md` は新 skeleton を前提とする指示に更新しなければならない。最低でも以下を含む: skeleton が自動生成されること、開発種別の enum 値、Scope Verification / Impact on Existing Features の記述義務
- REQ-5 [should]: `src/flow/lib/run-prepare-spec.js` から dead code を削除しなければならない: `DEFAULT_SPEC_TEMPLATE` 定数、`createSpecTemplate()` 関数、`loadLocalTemplate()` の spec.md 分岐。qa.md 用の `loadLocalTemplate` 呼び出しは残す
- REQ-6 [should]: `tests/unit/flow/` 配下に `check-draft-text.test.js` を新設し、以下のケースを検証する unit test を実装しなければならない: (a) 最小限の valid draft は pass、(b) Scope Verification 欠落で FAIL、(c) Impact on Existing Features 欠落で FAIL、(d) 開発種別が enum 外で FAIL、(e) 開発種別が enum 内（7 値すべて）で pass、(f) Q&A 欠落 / 承認未チェック / 目的欠落の既存検証が壊れていない regression チェック

## Acceptance Criteria
- sdd-forge flow prepare --title <t> --worktree 実行後、作成された spec directory に draft.md が存在し、skeleton の全セクションを含む
- 生成された skeleton のみの draft.md を sdd-forge flow run gate --phase draft --skip-guardrail で検証すると、未チェックの承認チェックボックスと未記入の開発種別で FAIL する
- 開発種別に feature / bugfix / refactor / docs / chore / test / other のいずれかを記入し、承認チェックボックスを [x] に、Q&A と目的を埋めた draft.md は sdd-forge flow run gate --phase draft --skip-guardrail で pass する
- node --test tests/unit/flow/check-draft-text.test.js が全ケース pass する
- npm test が既存テストを含め全件 pass する
- run-prepare-spec.js から DEFAULT_SPEC_TEMPLATE / createSpecTemplate / spec 向け分岐が消えている（grep で確認）

## Implementation Targets
-

## Open Questions
- [ ]
