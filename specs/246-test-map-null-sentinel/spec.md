# Feature Specification: 246-test-map-null-sentinel

**Feature Branch**: `feature/246-test-map-null-sentinel`
**Created**: 2026-04-29
**Status**: Draft
**Input**: GitHub Issue #295

## Goal
-

## Background
-

## Scope
- [must] `src/flow/lib/run-retro.js` — L279 および L302-313: testMap イテレーションで null をスキップ（TypeError 防止）
- `src/flow/lib/req-map.js` — `loadTestMap` 自体は変更しない（null は返却のまま維持）、イテレーション側の呼び出し元で null をスキップする

## Out of Scope
- AI retro の変更（`src/flow/lib/run-retro.js` の `parseRetroResponse`）: `parseRetroResponse` は AI retro 専用であり `na_count` は存在しない（フィールドなし = 0 と同義）。スキーマ統一を望む場合は `parseRetroResponse` に `na_count: 0` を静的出力として追加することを検討事項として記録する

## Constraints
-

## Design Principles
-

## Overview
### Modules
-

### Data Flow
-

### Decisions
-

## Clarifications (Q&A)
- Q:
  - A:

## Alternatives Considered
-

## User Confirmation
- [ ] User approved this spec
- Confirmed at:
- Notes:

## Requirements
-

## Acceptance Criteria
-

## Implementation Targets
-

## Open Questions
- [ ]
