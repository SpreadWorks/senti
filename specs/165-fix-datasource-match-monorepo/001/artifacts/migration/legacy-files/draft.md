# Draft: 165-fix-datasource-match-monorepo

**Development Type:** Bug fix
**Goal:** Ensure all preset `match(relPath)` decisions work for nested monorepo paths while preserving current root-level behavior.

## Context
- Issue #128 reports false negatives when files are under nested paths such as `aaa/bbb/src/Controller/UserController.php`.
- User decision: all presets are in-scope, no omissions.
- User decision: avoid mechanical broad replacement and prioritize consistent matching quality across presets.

## Q&A
- Q: 仕様書の作成方法は？
  - A: Q&A を先に実施してから仕様化する。`(reason: guardrail / recommendation)`
- Q: 作業環境は？
  - A: Git worktree（base: `main`）を使う。`(reason: flow choice / isolation)`
- Q: 修正スコープは？
  - A: Issue範囲に限定せず、全プリセットを対象にする。`(reason: user decision)`
- Q: 一括置換でよいか？
  - A: 一括置換は採用せず、誤検知と見落としの抑制を優先する。`(reason: user decision + risk control)`
- Q: `match()` 引数は変更するか？
  - A: 変更しない。`match(relPath)` を維持する。`(reason: existing interface compatibility)`
- Q: 個別対応はどこに残すか？
  - A: プリセット固有の判定条件は維持しつつ、共通ルールと矛盾しない形で定義する。`(reason: existing code pattern)`

## Prioritized Requirements
1. P1 When `relPath` contains an allowed directory segment for a DataSource (including nested prefixes), `match()` shall return true if that DataSource's file-type conditions are met.
2. P1 When `relPath` includes a look-alike segment name without an exact directory-segment boundary match (for example `src/ControllerX/` when target is `src/Controller/`), `match()` shall return false.
3. P1 When files are in the current root-level layout, `match()` shall keep existing true/false outcomes.
4. P2 When a preset defines extension constraints, `match()` shall enforce the same extension constraints after this change.
5. P2 When a preset has additional route/component naming constraints, `match()` shall preserve those constraints.
6. P3 The change set shall cover all presets that define `match(relPath)` and document any preset that requires no change.

## Impact on Existing Features
- Existing root-level projects remain supported with unchanged matching outcomes.
- Affected area is internal scan inclusion/exclusion only; CLI command interface is unchanged.

## Test Strategy (requirements-level)
- Verify representative positive/negative `relPath` examples for nested and root-level layouts.
- Verify boundary false-positive cases (segment look-alikes).
- Verify no regression for existing preset-specific conditions.

## Alternatives Considered
- Per-file ad-hoc fixes without shared rule alignment: rejected due to consistency risk across many presets.

## Future Extensibility
- New presets should follow the same matching rule set and declare only preset-specific conditions.

## Open Questions
- なし

## Approval
- [x] User approved this draft
- Approved at: 2026-04-10
- Notes: all presets mandatory; no omissions; stable quality with shared matching rule set.
