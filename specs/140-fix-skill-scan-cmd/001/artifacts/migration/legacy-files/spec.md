# Feature Specification: 140-fix-skill-scan-cmd

**Feature Branch**: `feature/140-fix-skill-scan-cmd`
**Created**: 2026-04-04
**Status**: Draft
**Input**: GitHub Issue #86

## Goal

flow-plan スキルテンプレートの draft フェーズ手順から、存在しない `sdd-forge flow run scan` コマンドを削除する。

## Scope

- `src/templates/skills/sdd-forge.flow-plan/SKILL.md` — draft フェーズの手順 2 を削除

## Out of Scope

- `sdd-forge docs scan` コマンド自体の変更
- `flow run` のサブコマンド追加
- 他のスキルテンプレート

## Clarifications (Q&A)

- Q: 手順番号がずれるが問題ないか？
  - A: 問題ない。手順 2 を削除し、後続の番号を繰り上げる。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-04
- Notes: autoApprove mode

## Requirements

1. When `src/templates/skills/sdd-forge.flow-plan/SKILL.md` の draft フェーズ "Before starting draft discussion" セクションから、`sdd-forge flow run scan` の手順を削除し、後続の番号を繰り上げる。

## Acceptance Criteria

- SKILL.md に `flow run scan` への参照が含まれないこと
- ソーステンプレート `src/templates/skills/sdd-forge.flow-plan/SKILL.md` が変更されていること

## Test Strategy

テンプレート（.md ファイル）の 1 行削除のみでコード変更がないため、自動テストは不要。

## Open Questions

None.
