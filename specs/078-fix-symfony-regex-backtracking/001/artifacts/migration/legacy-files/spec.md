# Feature Specification: 078-fix-symfony-regex-backtracking

**Feature Branch**: `feature/078-fix-symfony-regex-backtracking`
**Created**: 2026-03-20
**Status**: Draft
**Input**: GitHub Issue #1 — catastrophic backtracking in symfony scan regex

## Goal

Fix catastrophic backtracking in `methodBlockRegex` used by the Symfony controller and route scanners, which causes infinite hang when scanning files with many PHP attributes.

## Scope

- Replace nested-quantifier regex with a two-step approach in:
  - `src/presets/symfony/scan/controllers.js` (L46)
  - `src/presets/symfony/scan/routes.js` (L172)
- Extract shared helper to avoid code duplication

## Out of Scope

- Changing scan output format or behavior (pure refactor of matching logic)
- Other presets' regex patterns

## Clarifications (Q&A)

- Q: What causes the backtracking?
  - A: `((?:\s*#\[...\]\s*)*)*` — nested quantifiers. When `public function` is not found after many `#[...]` attributes, the engine tries exponentially many ways to partition the attribute sequence.
- Q: Why not just fix the character class?
  - A: The Issue suggested `[^\[\]{}]*` but the real problem is the nested `*` quantifiers, not the character class. Splitting into two steps eliminates the structural issue.

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-03-20
- Notes: Approved two-step approach

## Requirements

1. Replace `methodBlockRegex` in `controllers.js` with two-step matching: find `public function` first, then walk backwards for `#[...]` attributes
2. Replace `methodBlockRegex` in `routes.js` with the same two-step approach
3. Extract shared helper function to avoid duplicating the attribute collection logic
4. Existing scan behavior must be preserved (same output for valid PHP files)
5. No hang on pathological input (20+ attributes without matching function)

## Acceptance Criteria

- Pathological input (20+ `#[Route(...)]` without `public function`) completes in <100ms
- Existing Symfony scan tests pass unchanged
- Scan output for valid controller files is identical before and after

## Open Questions

(none)
