# Feature Specification: 144-optimize-test-only-spec-flow

**Feature Branch**: `feature/144-optimize-test-only-spec-flow`
**Created**: 2026-04-04
**Status**: Draft
**Input**: GitHub Issue #90
**開発種別:** Enhancement

## Goal

テスト追加のみの spec（プロダクトコード変更なし）を auto mode で処理する際、impl フェーズが冗長な空ステップになる問題を解消する。flow-impl SKILL.md に「テストのみ spec の場合 impl をスキップ」指示を追加する。

## Scope

- `src/templates/skills/sdd-forge.flow-impl/SKILL.md` に test-only spec 検出と impl スキップの指示を追加
- `src/templates/skills/sdd-forge.flow-plan/SKILL.md` の test phase 完了後の遷移に注記を追加

## Out of Scope

- フローエンジンのコード変更（flow-state.js, registry.js 等）
- spec に「テストのみ」フラグを追加するコード変更
- test-only spec の自動検出ロジックのコード実装

## Clarifications (Q&A)

- Q: テストのみ spec の判断基準は？
  - A: AI が spec の Goal/Scope/Requirements を読み、プロダクトコードの変更が含まれないと判断した場合。判断が曖昧な場合は通常の impl フローを実行する（安全側に倒す）。

- Q: impl をスキップする場合の step 記録は？
  - A: `sdd-forge flow set step implement skipped` を記録する。gate-impl もスキップする。

## User Confirmation
- [x] User approved this spec (autoApprove)
- Confirmed at: 2026-04-04
- Notes: auto mode

## Requirements

1. `src/templates/skills/sdd-forge.flow-impl/SKILL.md` の step 1 冒頭に、autoApprove モードでの test-only spec 検出指示を追加する。spec の Goal/Scope/Requirements にプロダクトコード変更が含まれない場合、implement と gate-impl を skipped に設定して review 以降に進む。
2. `src/templates/skills/sdd-forge.flow-plan/SKILL.md` の test phase 完了後の遷移説明に、「test-only spec の場合 impl フェーズは自動スキップされる」旨の注記を追加する。

## Acceptance Criteria

1. flow-impl SKILL.md に test-only spec 検出と impl スキップの指示が含まれること
2. flow-plan SKILL.md に test-only spec の注記が含まれること
3. `sdd-forge upgrade` 実行後にプロジェクトのスキルファイルに反映されること
4. 既存テストが全て PASS すること

## Test Strategy

SKILL.md のテキスト変更のみのため、コードテストは不要。`sdd-forge upgrade` の正常実行と `npm test` の PASS で検証する。テストなしの理由: AI への指示テキスト変更であり、テスト可能なコード変更がない。

## Existing Feature Impact

- **auto mode での test-only spec 処理**: impl フェーズがスキップされ、トークンと時間が節約される
- **通常（non-auto）モード**: 影響なし（ユーザーが選択する）
- **プロダクトコード変更を含む spec**: 影響なし（通常の impl フローを実行）

## Open Questions
- (none)
