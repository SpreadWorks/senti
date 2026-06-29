# Feature Specification: 314-explicit-flow-start-only

**Feature Branch**: `feature/314-explicit-flow-start-only`
**Created**: 2026-06-29
**Status**: Draft
**Input**: GitHub Issue #408

## Goal
Spec-Driven Development flow の自動起動条件を廃止し、ユーザーが flow 開始を明示した場合だけ flow を開始する。

## Background
現行の generated AGENTS guidance と senti.flow skill guidance は、通常の機能追加・修正依頼でも flow/direct edit の選択確認を促す。Issue #408 は、この自動確認が相談、調査、小規模修正の初動を重くしているため、flow を明示開始時だけ使う補助的な手段へ戻すことを求めている。

## Scope
- 通常の feature / fix / code change / investigation / consultation 依頼で flow/direct edit の二択確認を必須化する AGENTS template 文言を削除または置換する。
- senti.flow skill の entry guidance と metadata から、非明示 feature/fix request を route choice に送る自動起動条件を削除する。
- flow 手動開始、active flow continuation、prelude、dispatcher loop の保持条件を文言とテストで明示する。
- 旧自動起動規則の不在と保持サーフェスの継続を unit test または spec-local test で検証する。
- src/skills/ または src/presets/ の変更を upgrade で生成済み skill/template へ反映する。
- AGENTS template 変更後に、既存の setup/docs-agent regeneration path で generated AGENTS.md と存在する場合の CLAUDE.md の agents.senti directive block を更新または検証する。

## Out of Scope
- Spec-Driven Development flow 本体を削除しない。
- ユーザーが flow 開始を明示した場合の手動開始手段を削除しない。
- active flow の resume / continue / finalize の lifecycle を変更しない。
- docs/ の自動生成領域を手編集しない。

## Constraints
- src/ 以下の文言は特定プロジェクト、Codex、Claude など特定クライアントの起動記法を一般条件として前提にしない。
- AGENTS template と skill metadata は、ユーザーの明示的な flow 開始 instruction を起動条件として表現する。
- 既存の active flow がある場合の dispatcher continuation と target-aware guard は保持する。
- src/skills/ または src/presets/ を変更した場合は senti upgrade を実行し、upgrade artifact を残す。

## Design Principles
- Flow は常時自動起動される default path ではなく、ユーザーが明示的に選ぶ補助的な method として扱う。
- 通常依頼では直接対応を阻害しない。flow が有用な場合でも、開始ではなく提案に留める。
- 削除する public behavior と保持する public behavior を migration parity として分離し、保持対象は behavior-level test で確認する。

## Overview
### Modules
- src/presets/base/templates/en/AGENTS.senti.md と ja/AGENTS.senti.md は、生成される AGENTS.md の Spec-Driven Development 起動ルールを提供する。
- src/skills/senti.flow/SKILL.md は、flow skill の metadata、entry branching、prelude、dispatcher loop の手順を提供する。
- tests/unit/flow/skill-prelude-auto.test.js などの unit tests は、skill entry guidance と prelude contract の文言配置を検査する。

### Data Flow
- senti upgrade は src/skills/ と src/presets/ の source template 変更を .agents/skills/ と generated project configuration へ反映する。
- generated AGENTS.md / CLAUDE.md の agents.senti directive block は、setup または docs agents generation path が AGENTS template から再生成する。
- 明示開始時は senti.flow skill が status check、set init、auto-check、prepare、dispatcher loop の順に進む。通常依頼はこの入口に入らない。

### Decisions
- [VERIFY] 自動二択確認は AGENTS template に存在するため、source template 側で削除する。
- [VERIFY] 非明示 feature/fix request の A.0 Route choice は senti.flow skill に存在するため、entry guidance 側で削除する。
- [VERIFY] 手動開始と active continuation は保持対象であり、prelude と dispatcher loop の既存手順が所有する。
- Migration parity mapping: AGENTS auto choice and A.0 route choice are removed; explicit start, active continuation, and dispatcher loop remain in senti.flow.
- Migration inventory removed: AGENTS mandatory flow/direct edit choice; senti.flow non-explicit feature/fix A.0 Route choice. Owner: none; intentional removal.
- Migration inventory retained: explicit start, set init, auto-check, prepare, dispatcher loop, active continuation, target mismatch guard, manual CLI fallback.
- Migration side effects: source templates require senti upgrade for skill/preset artifacts and setup/docs-agent regeneration for AGENTS.md / CLAUDE.md directive blocks.
- Why this approach: root problem is the mandatory startup prompt, so removing that trigger while retaining manual flow start satisfies the Issue without reducing flow capability.

## Clarifications (Q&A)
- Q: What counts as explicit start?
  - A: A user instruction that names or clearly requests starting the Spec-Driven Development flow. Client-specific examples may appear as examples, but the general rule must be environment-independent.
- Q: Can the AI suggest flow for large changes?
  - A: Yes. The AI may suggest flow when useful, but must not start flow or show a mandatory startup choice unless the user explicitly chooses to start it.

## Alternatives Considered
- Keep the two-way choice for large feature/fix requests. — Rejected because Issue #408 requires that even useful flow cases remain suggestions, not automatic startup or mandatory confirmation.
- Remove Spec-Driven Development flow entirely. — Rejected because Issue #408 lists removing the flow itself and manual start ability as non-goals.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-06-29T07:11:36.831Z
- Notes: Auto-approved after user enabled auto mode and spec-gate passed.

## Requirements
- R1 [must]: AGENTS templates must not require a flow/direct edit choice for ordinary feature, fix, code change, investigation, or consultation requests.
- R2 [must]: senti.flow skill metadata and entry guidance must start a new flow only when the user explicitly instructs Spec-Driven Development flow start, or when continuing an active flow.
- R3 [must]: Migration parity must retain explicit flow start, prelude, auto-check, prepare, dispatcher loop, and active flow continuation behavior after removing automatic startup confirmation.
- R4 [must]: Tests must verify that old automatic startup confirmation wording is absent and retained explicit-start / active-continuation routes remain documented.
- R5 [must]: Generated skill and preset artifacts must be refreshed after source template changes using senti upgrade.
- R6 [must]: Generated AGENTS.md and existing CLAUDE.md agent guidance must be refreshed or verified through the setup/docs-agent regeneration path so old automatic startup wording is not retained in readable generated files.

## Acceptance Criteria
- R1: src/presets/base/templates/en/AGENTS.senti.md and ja/AGENTS.senti.md no longer state that every feature/fix/code change request must present a two-way flow/direct edit confirmation.
- R1: AGENTS template text states that Spec-Driven Development flow starts only when the user explicitly instructs it, and ordinary requests may be handled directly.
- R2: src/skills/senti.flow/SKILL.md no longer contains an A.0 Route choice path for non-explicit feature/fix requests.
- R2: The skill description and entry bullets are environment-independent and do not present client-specific notation as the general startup condition.
- R3: Existing explicit start path to B. Prelude, active flow continuation path to C. Dispatcher loop, and active-flow mismatch guard remain documented.
- R3: Behavior-level tests or spec-local tests verify explicit-start and active-continuation guidance, not only command registration or help text.
- R4: Tests fail if the old mandatory AskUserQuestion / direct edit vs flow confirmation wording returns to AGENTS templates or senti.flow entry guidance.
- R4: Each spec-local test file under specs/314-explicit-flow-start-only/tests/ begins with a `// spec: R<N> ...` header that maps the test to covered requirements.
- R5: senti upgrade succeeds and records evidence after src/skills/ or src/presets/ changes.
- R6: Generated AGENTS.md no longer contains the old automatic flow/direct edit confirmation wording after the agent-file refresh path runs.
- R6: Generated CLAUDE.md is checked when present; if absent, the evidence records that no CLAUDE.md file exists to refresh.

## Implementation Targets
- src/presets/base/templates/en/AGENTS.senti.md
- src/presets/base/templates/ja/AGENTS.senti.md
- src/skills/senti.flow/SKILL.md
- tests/unit/flow/skill-prelude-auto.test.js
- tests/e2e/docs/commands/agents.test.js
- tests/e2e/051-skill-namespace.test.js
- AGENTS.md
- CLAUDE.md
- specs/314-explicit-flow-start-only/tests/

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Revise AGENTS templates
  - Remove the mandatory flow/direct edit startup choice from English and Japanese AGENTS templates while preserving manual flow guidance.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Revise flow entry guidance
  - Update senti.flow metadata and entry branching so non-explicit ordinary requests do not enter route choice, while explicit start and active continuation remain documented.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Cover startup policy
  - Add regression coverage and refresh generated artifacts for the new explicit-start-only startup policy.
  - see `tasks/T-3.md` for full spec
