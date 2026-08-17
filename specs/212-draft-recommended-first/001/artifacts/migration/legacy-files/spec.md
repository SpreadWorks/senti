# Feature Specification: 212-draft-recommended-first

**Feature Branch**: `feature/212-draft-recommended-first`
**Created**: 2026-04-22
**Status**: Draft
**Input**: GitHub Issue #217

## Goal
AI が draft フェーズで提示する選択肢の「推奨案」を常に [1] に配置するルールを、共通スタイルガイド partial に明記する。

## Background
Issue #217: 現状は AI 生成 choice の並び順が不定で、ユーザーが推奨案を即座に判別しづらい。既存 partial § 3 に推奨案の明示義務はあるが位置規定がない。既存の良い例は結果的に [1] に推奨が置かれているが暗黙ルールに留まっている。

## Scope
- src/templates/partials/ai-question-style.md § 3「選択肢提示」に推奨案の配置位置ルールを追記する
- 追記内容: (a) 推奨案がある場合は [1] に配置、(b) 同率トップは 1 件を [1] に配置し残りは本文側で補足、(c) 推奨案が無い場合は配置ルール不発動
- SKILL.md への反映は既存の partial include 経由で自動で行う（直接編集しない）

## Out of Scope
- CLI 固定プロンプト (src/flow/lib/get-prompt.js) の並び順保証ロジック追加
- draft フェーズ以外 (impl / review / finalize 等) の選択肢スタイル変更
- 他 skill ファイル (flow-auto / flow-status / flow-sync 等) の個別調整
- SKILL.md の直接編集

## Constraints
- 外部依存追加禁止。テンプレート partial 1 ファイルへの追記のみ
- alpha 版ポリシーに従い、後方互換の記述は追加しない
- 変更は src/templates/partials/ai-question-style.md 1 箇所に閉じる

## Design Principles
- ルール追記は既存の箇条書き構造 (§ 3 選択肢提示) を踏襲し、同節内に 1 項目追加する
- ルール本文は条件付き (「推奨案がある場合」) で記述し、既存ルール「推奨案があれば明示」と整合させる
- 実装コードは 1–3 行差分程度の最小粒度

## Overview
### Modules
- src/templates/partials/ai-question-style.md — § 3 に推奨案の [1] 配置ルールを追記
- src/templates/skills/sdd-forge.flow/SKILL.md — partial include により自動反映 (直接編集なし)

### Data Flow
- partial 更新 → sdd-forge upgrade → プロジェクトの .claude/skills/sdd-forge.flow/SKILL.md に反映

### Decisions
- 対象は AI 生成 choice のみ。CLI 固定プロンプトは issue #217 本文と整合させて対象外とする
- 推奨案が無い場合は配置ルールを発動させない。過剰制約を避けるため

## Clarifications (Q&A)
- Q: SKILL.md も直接編集するか？
  - A: しない。partial include で自動反映される。直接編集すると重複管理になる。
- Q: 既存の「良い例」記述も差し替えるか？
  - A: しない。既に [1] 配置済みで新ルールと整合している。

## Alternatives Considered
- 案 A: partial に bullet 追記 — 採用。変更範囲最小、SKILL.md は partial include 経由で自動反映される。
- 案 B: CLI の get-prompt.js も含めて全プロンプトで recommended=true を [1] に強制する validator を追加 — 不採用。issue の scope 外。CLI プロンプトの recommended: true は現状すべて [1] にあり、追加 validator は過剰。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-04-22
- Notes: issue #217, partial 1 ファイル追記スコープで実装進行。

## Requirements
- R1: When the AI presents a choice block in any SDD flow phase and a recommended option exists, the style guide partial (ai-question-style.md) shall require the recommended option to be placed at choice id [1].
- R2: When multiple options are tied as top recommendations, the style guide shall require one of them to be placed at [1]; the remaining tied candidates may be noted in the prose surrounding the choice block.
- R3: When no recommendation exists for a choice block, the style guide shall not mandate any specific placement order (the [1] rule applies only conditionally on the presence of a recommendation).

## Acceptance Criteria
- AC1 (R1): src/templates/partials/ai-question-style.md § 3 に推奨案を [1] に配置することを要求する bullet が含まれる。
- AC2 (R2): 同節は同率トップの扱いを明記し、1 件を [1] に置くことを求める。
- AC3 (R3): ルールは推奨案がある場合にのみ発動する条件付き表現で記述される。
- AC4: tests/unit/templates/ai-question-style.test.js (新規) が partial 内の R1 / R2 / R3 マーカーの存在を検証する。

## Implementation Targets
-

## Open Questions
- [ ]
