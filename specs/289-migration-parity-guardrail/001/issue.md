Conclusion:
It is fine to include this in the base preset.

Reason:
The Migration Parity Guardrail is not specific to the workflow plugin; it is a general process rule that applies broadly to changes that move, split, extract, replace, or externalize existing behavior. base/guardrail.json already contains cross-cutting guardrails such as single-responsibility, impact-on-existing-features, and req-diff-verifiability, which are similar in nature.

Note:
Because everything under src/ is distributed as an npm package, the guardrail body must not include information specific to a particular project, migration effort, or board item. Keep background context in the issue/spec, and generalize the text that goes into base.

Proposed guardrail:

id: migration-parity
title: Migration Parity
phase: draft, spec
category: process

body:
When a change moves, splits, extracts, replaces, or externalizes existing behavior, the draft/spec shall define migration parity before implementation. It shall inventory the existing public behavior being moved or replaced; list affected user-facing commands, APIs, hooks, config entries, generated artifacts, and side effects; map each retained behavior to its new owner or explicitly state removal; define acceptance criteria proving retained behavior still works through the new path; and include at least one behavior-level verification for each retained public surface. Registration, discovery, help output, or mock routing alone are not sufficient evidence of migration parity. Intentional behavior removal shall state the user-visible impact and compatibility expectation.

Implementation notes:
- Add it to src/presets/base/guardrail.json.
- draft/spec is appropriate for the phase. If extended to task-impl, it would become too much like blaming spec deficiencies during implementation, so treat it first as a guardrail before specification is finalized.
- After changing src/presets/base/guardrail.json, run senti upgrade to reflect it into the distributed skills and configuration.

<details>
<summary>ja</summary>

[ENHANCE] 移行系変更のMigration Parity Guardrailを追加する

結論:
base preset に入れてよい。

理由:
Migration Parity Guardrail は workflow plugin 固有ではなく、既存 behavior を移動・分離・抽出・置換・外部化する変更全般に効く共通プロセスルールである。base/guardrail.json には single-responsibility、impact-on-existing-features、req-diff-verifiability のような横断的 guardrail が既にあり、性質が近い。

注意:
src/ 配下は npm package として配布されるため、guardrail 本文には特定プロジェクト・特定移行案件・board item などの固有情報を含めない。背景説明は issue/spec 側に留め、base に入れる本文は汎用化する。

提案する guardrail:

id: migration-parity
title: Migration Parity
phase: draft, spec
category: process

body:
When a change moves, splits, extracts, replaces, or externalizes existing behavior, the draft/spec shall define migration parity before implementation. It shall inventory the existing public behavior being moved or replaced; list affected user-facing commands, APIs, hooks, config entries, generated artifacts, and side effects; map each retained behavior to its new owner or explicitly state removal; define acceptance criteria proving retained behavior still works through the new path; and include at least one behavior-level verification for each retained public surface. Registration, discovery, help output, or mock routing alone are not sufficient evidence of migration parity. Intentional behavior removal shall state the user-visible impact and compatibility expectation.

実装メモ:
- 追加先は src/presets/base/guardrail.json。
- phase は draft/spec が妥当。task-impl まで広げると実装中に spec 不備を責める性質が強くなりすぎるため、まずは仕様化前の guardrail として扱う。
- src/presets/base/guardrail.json を変更した後は senti upgrade を実行して配布先のスキル・設定へ反映する。

</details>