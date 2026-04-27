# Feature Specification: 234-test-guardrail-reorg

**Feature Branch**: `feature/234-test-guardrail-reorg`
**Created**: 2026-04-27
**Status**: Draft
**Input**: GitHub Issue #274

## Goal
テスト関連 guardrail を再編し、spec テスト責務と project テスト責務を明確に分離する。

## Background
2c8f の設計レビューにより flow からプロジェクトテスト管理機構を分離する方針が確定。現在の base/guardrail.json のテスト関連 guardrail は 7 件あるが、重複・曖昧さ・無効化状態（impl-test-preservation の phase 空配列）が混在し、spec テスト責務と project テスト責務が未分離。先行して guardrail 定義を整理する。

## Scope
- [must] 4 件の obsolete guardrail エントリ削除
- [must] no-disabling-existing-tests の body 拡張
- [must] impl-test-conflict-escalation → pre-existing-test-failure-escalation リネーム＋書き換え
- [must] spec-test-coverage, project-test-integrity の 2 件新設

## Out of Scope
- checkTestChanges() 関数の削除（spec B）
- run-gate.js 内コメント更新
- guardrail スキーマへの priority フィールド追加

## Constraints
- 有効な phase: draft, spec, task-spec, task-impl, integration, test, lint, review
- 有効な category: requirements, code-quality, testing, security, process
- alpha 版ポリシーにより後方互換不要

## Design Principles
- spec テスト責務（specs/<specid>/tests/）と project テスト責務（プロジェクト全体）を明確に分離
- 削除される guardrail の責務は新規・強化後の guardrail で必ずカバー

## Overview
### Modules
- `src/presets/base/guardrail.json` — 全プリセットの基底 guardrail 定義

### Data Flow
guardrail.json → hydrate() → filterByPhase() → gate 評価

### Decisions
1. Issue の phase: impl → task-impl（VALID_GUARDRAIL_PHASES に impl なし）
2. critical/must → body テキストで表現（meta.priority フィールドなし）
3. checkTestChanges() → scope 外（Issue が spec B に分離）

## Clarifications (Q&A)
- Q: Issue の phase: impl は何に対応するか
  - A: task-impl。VALID_GUARDRAIL_PHASES に impl は存在しない
- Q: critical/must はどう表現するか
  - A: body テキストに MUST を含める。meta.priority フィールドは存在しない

## Alternatives Considered
- guardrail スキーマに meta.priority を追加 → gate 側対応でスコープ拡大。body で十分
- VALID_GUARDRAIL_PHASES に impl 追加 → task-impl と重複。不要
- 旧 ID エイリアス維持 → alpha 版ポリシーで不要

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-04-27 (autoApprove)
- Notes: autoApprove

## Requirements
- **R1** [must]: base/guardrail.json から impl-test-preservation, changes-require-test-coverage, test-covers-spec-requirements, impl-flag-obsolete-tests を削除
- **R2** [must]: no-disabling-existing-tests の body 拡張（テスト対象機能削除時の正当な削除明記 + MUST レベル記述）
- **R3** [must]: impl-test-conflict-escalation → pre-existing-test-failure-escalation リネーム＋body 書き換え（phase [task-impl] 維持）
- **R4** [must]: spec-test-coverage 新設（phase: [spec, task-impl, test], category: testing）
- **R5** [must]: project-test-integrity 新設（phase: [task-impl], category: testing）
- **R6** [must]: spec-includes-test-strategy は変更しない
- **R7** [must]: 変更後の全エントリが VALID_GUARDRAIL_PHASES/CATEGORIES 制約を満たす

## Acceptance Criteria
- base/guardrail.json から 4 件の削除対象エントリが除去されている
- no-disabling-existing-tests の body が R2 仕様通り
- impl-test-conflict-escalation が pre-existing-test-failure-escalation にリネーム＋R3 仕様通り
- spec-test-coverage が R4 仕様通り
- project-test-integrity が R5 仕様通り
- spec-includes-test-strategy が未変更
- npm test の guardrail-category-integrity テストが PASS

## Impact on Existing Features
- base preset を使う全プロジェクトの gate 評価で、テスト関連 guardrail の ID と文言が変わる
- gate 評価の phase フィルタリング結果が変わる（新 guardrail は task-impl, test, spec の各 phase に配置）
- 既存の guardrail-category-integrity テストは汎用的構造チェックのため、特定 ID への依存なし

## Implementation Targets
- `src/presets/base/guardrail.json`

## Open Questions
(none)
