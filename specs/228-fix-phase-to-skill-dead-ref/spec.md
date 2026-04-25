# Feature Specification: 228-fix-phase-to-skill-dead-ref

**Feature Branch**: `feature/228-fix-phase-to-skill-dead-ref`
**Created**: 2026-04-25
**Status**: Draft
**Input**: GitHub Issue #259

## Goal

`phaseToSkill()` が返す撤去済み skill 名を現行 skill 構成に合わせ、`recommendedSkill` フィールドが正しい skill 名を返すようにする。

## Background

spec 198-199 のリファクタで `sdd-forge.flow-plan` / `sdd-forge.flow-impl` / `sdd-forge.flow-finalize` が `sdd-forge.flow` に統合された。しかし `resolve-context-envelope.js` 内の `phaseToSkill()` 関数のマッピングは更新されず、撤去済み skill 名を返し続けている。

## Scope

- `src/flow/lib/resolve-context-envelope.js` の `phaseToSkill()` 関数

## Out of Scope

- `recommendedSkill` フィールド自体の削除
- flow-resume skill テンプレート側のマッピング整理

## Constraints

- 既存の `recommendedSkill` フィールドを envelope に維持する（テストが存在を前提としている）

## Design Principles

- 現行 skill 構成に合わせた単純なマッピング修正。設計変更なし。

## Overview

### Modules

- `src/flow/lib/resolve-context-envelope.js` — `phaseToSkill()` 関数のマッピング値を修正

### Data Flow

変更なし。`buildResolvedFlowContext()` → `phaseToSkill(phase)` → `recommendedSkill` フィールドの流れは維持。

### Decisions

- マッピング修正のみ。フィールド削除は行わない。
- `task-impl` phase の明示的な case を追加する。

## Clarifications (Q&A)

- Q: なぜフィールド削除ではなくマッピング修正か？
  - A: 既存テスト (resume-command.test.js) がフィールドの存在を前提としており、envelope インターフェースの安定性を優先する。

## Alternatives Considered

- `recommendedSkill` フィールドの削除: 現在実質的に未使用だが、テスト互換性とインターフェース安定性の観点から見送り。

## Why This Approach

単一関数のマッピング値修正で完結する最小変更。テスト互換性を維持しつつ、dead reference を解消できる。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-25
- Notes: draft Q&A でマッピング修正方針に合意済み

## Requirements

1. (P1) `flow get resolve-context` または `flow run resume` を実行したとき、返される `recommendedSkill` は現行の skill 名でなければならない。
2. (P2) フローがいずれかの phase にあるとき、その phase に対する skill マッピングが明示的に定義されていなければならない。
3. (P3) `flow get resolve-context` または `flow run resume` を実行したとき、`recommendedSkill` フィールドが envelope に含まれていなければならない。

## Acceptance Criteria

- `phaseToSkill("plan")` が `"sdd-forge.flow"` を返す
- `phaseToSkill("impl")` が `"sdd-forge.flow"` を返す
- `phaseToSkill("task-impl")` が `"sdd-forge.flow"` を返す
- `phaseToSkill("finalize")` が `"sdd-forge.flow"` を返す
- `phaseToSkill("sync")` が `"sdd-forge.flow-sync"` を返す
- default case が `"sdd-forge.flow"` を返す
- 既存テスト (`resume-command.test.js`) が引き続き PASS する

## Test Strategy

- unit テスト: `phaseToSkill()` の各 phase 入力に対する戻り値を検証
- 既存テスト: `resume-command.test.js` の回帰確認

## Implementation Targets

- `src/flow/lib/resolve-context-envelope.js`

## Open Questions

- なし
