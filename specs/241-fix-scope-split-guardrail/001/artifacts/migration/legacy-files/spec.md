# Feature Specification: 241-fix-scope-split-guardrail

**Feature Branch**: `feature/241-fix-scope-split-guardrail`
**Created**: 2026-04-28
**Status**: Draft
**Input**: GitHub Issue #285

## Goal
single-responsibility guardrail が AI にスコープ分割を誘発する問題を修正し、ユーザーが定義した Issue/request のスコープ境界を尊重させる

## Background
draft フェーズで AI が single-responsibility guardrail を過剰適用し、ユーザーが1つの Issue として定義したスコープを複数 spec に分割する提案を行った（#284 で発生）。guardrail body には "Each spec shall address one concern" とあるが、ユーザーの Issue/request がスコープ境界を定義する旨の記述がなく、AI が独自に concern の粒度を判断してしまう。

## Scope
- single-responsibility guardrail body の修正（ユーザースコープ尊重の明記）
- draft.md prompt の concern 単位記述の明確化（spec 分割とタスク分解の区別）

## Out of Scope
- task-single-responsibility guardrail（タスク粒度は別 concern）
- gate ロジックの変更（guardrail テキスト評価の仕組み自体は正常）
- greenfield preset の single-responsibility-functions guardrail（コード品質の別 guardrail）

## Constraints
- guardrail body の修正のみで対処する。gate コードの変更は行わない
- 既存の guardrail ID (single-responsibility) を維持する

## Design Principles
- guardrail は AI の振る舞いをテキストで制御する。テキスト修正が最小かつ直接的な介入手段
- スコープの判断権はユーザーにある。AI は分割を提案してはならない

## Overview
### Modules
- `src/presets/base/guardrail.json` — guardrail 定義の単一ソース。gate フェーズで AI に渡される
- `src/flow/prompts/plan/draft.md` — draft フェーズの AI 指示テンプレート

### Data Flow
- guardrail.json → flow get guardrail → AI context → gate 評価
- draft.md → flow get next-action (step=draft) → instructions.content

### Decisions
- guardrail body にユーザースコープ尊重条項を追加。gate ロジック変更は不要（gate は body を AI に渡す汎用処理）
- draft.md の concern 記述を「タスク分解の前提」に限定。spec 分割を示唆しない表現に修正

## Clarifications (Q&A)
- Q: gate ロジックの変更は必要か
  - A: 不要。gate は guardrail body を AI に渡して評価するため、body 修正だけで評価基準が変わる

## Alternatives Considered
- gate コードに single-responsibility 固有のスコープ分割抑止ロジックを追加 → gate は汎用エンジンであり特定 guardrail のハードコードは設計原則に反する
- single-responsibility guardrail を draft phase から削除 → draft 段階での spec スコープ意識は有用。表現の問題であり存在の問題ではない

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-04-28
- Notes: autoApprove

## Requirements
- **R1** (must): single-responsibility guardrail の body に、ユーザーが定義した Issue/request のスコープを1つの spec として扱う原則を追記する。AI がスコープ分割を自発的に提案することを禁止する文言を含む。
- **R2** (must): draft.md 1行目の concern 単位記述を、spec 自体の分割ではなく後続タスク分解の前提であることが明確に読み取れる表現に修正する。

## Acceptance Criteria
- guardrail.json の single-responsibility body に、ユーザーの Issue/request スコープを尊重する旨と AI による分割提案禁止が記載されている
- guardrail.json の single-responsibility の id, title, meta.phase, meta.category は変更されていない
- draft.md 1行目が spec 分割ではなくタスク分解の前提を示す表現に修正されている
- npm test が通る

## Implementation Targets
- `src/presets/base/guardrail.json`
- `src/flow/prompts/plan/draft.md`

## Open Questions
(none)
