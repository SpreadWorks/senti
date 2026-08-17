# Feature Specification: 250-review-attempt-modes

**Feature Branch**: `feature/250-review-attempt-modes`
**Created**: 2026-05-01
**Status**: Draft
**Input**: GitHub Issue #307

## Goal
Allow flow node retry limits to resolve from either scalar or mode-specific maxAttempts values while keeping public retry contracts numeric and reducing draft review retries in auto mode.

## Background
Review nodes currently use a fixed maxAttempts value. That gives draft review in auto mode the same retry budget as manual mode, even though auto retry is a self-correction loop by the same agent. The change introduces a mode-aware retry value shape while preserving existing scalar limits for nodes that do not opt in.

## Scope
- must: FlowNode.maxAttempts accepts scalar positive integers and mode-specific { auto, manual } positive-integer values.
- must: Scalar maxAttempts values are used directly for any node, including review nodes configured with a number.
- must: Mode-specific maxAttempts values require both auto and manual positive-integer keys and resolve by flow.autoApprove.
- must: Public next-action and retry consumers receive a resolved numeric maxAttempts value for the current mode.
- must: Initial mode-specific settings: review-draft { auto: 1, manual: 5 }, review-spec { auto: 3, manual: 3 }, review-test { auto: 3, manual: 3 }.
- must: Propagation of autoApprove into maxAttempts consumers that build next-action envelopes or enforce retry limits.
- must: review-draft behavior when the maxAttempts limit is reached: no additional approval/confirmation options are presented.
- should: Unit coverage for scalar and mode-specific maxAttempts resolution and invalid values.
- must: Next-action contract tests cover resolved numeric maxAttempts for scalar, auto, manual, missing autoApprove, and task-scope payloads.
- must: The sdd-forge.flow skill template is updated if dispatcher instructions must mention resolved maxAttempts, and sdd-forge upgrade is run after template changes.
- must: review-draft prompt wording remains aligned with the PASS-only approval boundary and resolved maxAttempts terminology.
- must: Flow implementation review and task review nodes remain scalar and expose numeric maxAttempts through their next-action payloads.
- must: No-active-flow and completed-flow next-action envelopes have an explicit maxAttempts contract: maxAttempts is omitted when step is null.
- must: Dispatcher skill template consumes resolved maxAttempts from the next-action envelope when enforcing retry limits, and sdd-forge upgrade is run.
- must: Plan, implementation, and task review prompt wording aligns with resolved numeric maxAttempts terminology.
- must: Review command retry resolution passes loaded flow.autoApprove into the shared maxAttempts resolver for draft/spec/test phases.
- must: Gate retry resolution includes flow/task scope or current task context so duplicate gate-impl ids remain unambiguous.
- must: Mode-specific maxAttempts accepts only a plain object with exactly own auto and manual positive-integer properties.

## Out of Scope
- Changing gate retry limits; gate nodes stay scalar.
- Changing implementation code review retry limits; implementation review stays scalar.
- Applying the no-additional-confirmation exhaustion rule to review-spec or review-test.
- Adding external dependencies.
- Changing subprocess wrapper retry behavior in src/flow/lib/run-review.js; runCmdWithRetry remains a mechanical retry for subprocess failures and is separate from review verdict maxAttempts.

## Constraints
- Use only Node.js built-in modules.
- Represent maxAttempts as a value with constructor-enforced invariants instead of ad hoc object checks spread across consumers.
- Reject invalid maxAttempts definitions at flow definition construction: 0, negative numbers, floats, NaN, non-number values, and mode-specific objects missing auto or manual.
- Keep next-action payload and retry consumers on a numeric maxAttempts contract.
- Do not change user-facing CLI command names or option semantics.
- If src/templates/skills/sdd-forge.flow/SKILL.md or related templates change, run sdd-forge upgrade before completing implementation.
- Do not conflate subprocess retry failures with review verdict retry limits; mechanical subprocess retry remains unchanged.
- For step:null next-action envelopes, omit maxAttempts rather than returning a stale or null retry value.
- Mode-specific maxAttempts objects must be plain objects with no extra keys and no inherited auto/manual values.
- Review command APIs must pass flow.autoApprove or loaded flow state into the shared maxAttempts resolver instead of reading node.maxAttempts directly.
- Gate retry resolution must preserve task-scope semantics even when flow and task definitions share a step id.

## Design Principles
- Resolve mode-specific behavior at the flow definition boundary so downstream code does not branch on raw value shape.
- Preserve existing scalar behavior for every node that does not opt into mode-specific values.
- Limit the no-additional-confirmation exhaustion behavior to review-draft, as confirmed in planning.
- Keep gate retry budgets unchanged by leaving gate nodes scalar.

## Overview
### Modules
- src/flow/definition.js owns FlowNode construction, maxAttempts invariants, and mode-aware resolution.
- src/flow/lib/get-next-action.js builds the next-action envelope and must pass flow.autoApprove into maxAttempts resolution.
- src/flow/commands/review.js consumes resolved retry limits for plan review phases.
- src/flow/lib/run-gate.js continues to consume numeric retry limits while accepting the same resolution path for scalar gate nodes.
- specs/250-review-attempt-modes/tests/ contains regression tests for value validation and resolution behavior.
- src/flow/lib/run-review.js wraps review subprocess execution; its mechanical subprocess retry remains distinct from review verdict maxAttempts.
- src/templates/skills/sdd-forge.flow/SKILL.md documents dispatcher behavior and must stay aligned if resolved maxAttempts changes how retry limits are described.
- tests/unit/flow/get-next-action.test.js validates the public next-action envelope contract, including numeric maxAttempts.

### Data Flow
- Flow definition stores either a scalar maxAttempts value or a mode-specific value object.
- When a flow state is available, flow.autoApprove determines whether a mode-specific value resolves to auto or manual.
- If flow.autoApprove is false or missing, mode-specific maxAttempts resolves to manual.
- Next-action envelopes, review retry loops, and gate retry logic receive the resolved numeric maxAttempts.
- review-draft exhaustion leaves the step incomplete and stops without approval or confirmation choices; approval choices are only reachable after PASS.
- Task-scope next-action envelopes use the same maxAttempts resolution contract as flow-scope envelopes.
- Subprocess retry in run-review handles process errors only; review verdict FAIL remains governed by node maxAttempts.
- When next-action has no current step, the envelope does not include maxAttempts.
- Review command phase helpers resolve retry limits with the loaded flow.autoApprove value before running review loops.
- Gate retry resolution identifies whether it is resolving a flow or task gate before selecting a node definition.

### Decisions
- Use positive integers for scalar and auto/manual maxAttempts values, and fail invalid definitions during FlowNode construction.
  - Evidence: src/flow/definition.js currently constructs FlowNode instances and stores maxAttempts; project rules require meaningful value invariants to be represented by classes and constructor invariants.
  - Considered: Allowing partial objects or non-positive values was rejected because retry behavior would be ambiguous or non-terminating.
- Expose resolved numeric maxAttempts to consumers rather than raw mode-specific objects.
  - Evidence: deriveNextAction currently returns maxAttempts to next-action envelope builders, and review/gate code consumes retry counts as numbers.
  - Considered: Exposing the raw object was rejected because it would force every consumer and schema to support both representations.
- Set mode-specific values only for plan review nodes: review-draft { auto: 1, manual: 5 }, review-spec { auto: 3, manual: 3 }, review-test { auto: 3, manual: 3 }.
  - Evidence: Planning decision recorded in flow notes for Issue #307; implementation review is a separate review node in src/flow/definition.js.
  - Considered: Applying mode-specific values to implementation review was offered and not selected.
- Keep gate nodes scalar and unchanged.
  - Evidence: src/flow/definition.js currently defines gate-draft maxAttempts 10, gate maxAttempts 20, and gate-impl maxAttempts 5.
  - Considered: Making gate nodes mode-specific was rejected as outside the Issue #307 concern.
- Apply the no-additional-confirmation exhaustion rule only to review-draft.
  - Evidence: src/flow/prompts/plan/review-draft.md places approval under the PASS path; user confirmed review-draft only in planning.
  - Considered: Applying the rule to review-spec and review-test was offered and not selected.
- Keep run-review subprocess retry separate from node maxAttempts.
  - Evidence: src/flow/lib/run-review.js runCmdWithRetry retries subprocess failures before parsePhaseReviewOutput interprets review verdict output.
  - Considered: Reusing node maxAttempts for subprocess failures was rejected because it would mix transport/process reliability with review verdict retry semantics.
- Include task-scope review in the scalar preservation contract.
  - Evidence: src/flow/definition.js defines a task-level review node in TASK_DEFINITION with maxAttempts 5.
  - Considered: Only naming the flow implementation review node was rejected because task next-action envelopes share the same public contract.
- Omit maxAttempts from no-step next-action envelopes.
  - Evidence: flow get next-action returns step:null when no active flow or no in-progress step exists; no retry limit applies in that terminal state.
  - Considered: Returning maxAttempts:null was rejected because existing consumers only need maxAttempts when an executable step exists.
- Make dispatcher template updates mandatory when retry-limit wording is touched.
  - Evidence: src/templates/skills/sdd-forge.flow/SKILL.md is the generated dispatcher source and project rules require sdd-forge upgrade after template changes.
  - Considered: Leaving the template conditional was rejected because dispatcher behavior must not rely on raw definition knowledge.
- Resolve review command maxAttempts with flow.autoApprove at the command boundary.
  - Evidence: src/flow/commands/review.js getReviewMaxAttempts currently reads node.maxAttempts directly and therefore must receive mode context after this change.
  - Considered: Keeping direct node.maxAttempts reads was rejected because it would bypass mode-specific resolution.
- Resolve gate retry maxAttempts with explicit scope awareness.
  - Evidence: src/flow/lib/run-gate.js resolves gate step ids across FLOW_DEFINITION and TASK_DEFINITION, and gate-impl exists in both definitions.
  - Considered: Relying on first-match lookup was rejected because future scalar values may diverge between flow and task definitions.
- Define mode-specific maxAttempts as an exact plain-object shape.
  - Evidence: Constructor-enforced invariants need an unambiguous accepted shape for object values.
  - Considered: Allowing extra keys, arrays, null, boxed numbers, or inherited properties was rejected because those shapes weaken the invariant.

## Clarifications (Q&A)
- Q: Which phases get the no-additional-confirmation exhaustion rule?
  - A: Only review-draft. review-spec and review-test keep their existing stop behavior without adding this requirement.
- Q: What values should plan review nodes use?
  - A: review-draft { auto: 1, manual: 5 }, review-spec { auto: 3, manual: 3 }, and review-test { auto: 3, manual: 3 }.
- Q: What should consumers see?
  - A: Consumers see a resolved numeric maxAttempts value, not the raw object.
- Q: What is the mode source?
  - A: flow.autoApprove. true means auto; false or missing means manual.
- Q: Does node maxAttempts replace run-review subprocess retry?
  - A: No. Subprocess retry remains mechanical process retry; node maxAttempts governs review verdict retry loops.
- Q: Does the scalar preservation rule include task review?
  - A: Yes. Task review remains scalar and task-scope next-action payloads must expose numeric maxAttempts.
- Q: What happens if the skill template needs retry-limit wording changes?
  - A: Update src/templates/skills/sdd-forge.flow/SKILL.md and run sdd-forge upgrade.
- Q: What does maxAttempts look like when next-action has no step?
  - A: It is omitted; no retry limit applies without an executable step.
- Q: Must the dispatcher template change?
  - A: Yes, when retry-limit wording is touched it must consume resolved numeric maxAttempts from next-action, and sdd-forge upgrade must be run.
- Q: How precise is the mode-specific object shape?
  - A: Only a plain object with exactly own auto and manual positive-integer properties is valid.
- Q: How does gate retry avoid duplicate gate-impl ids?
  - A: Resolution must include flow/task scope or current task context before selecting the definition node.

## Alternatives Considered
- Apply mode-specific maxAttempts only inside review command logic: Rejected because next-action and gate retry logic also consume maxAttempts and should share one resolution boundary.
- Expose raw { auto, manual } values in next-action envelopes: Rejected because it would change the consumer contract and force every downstream consumer to branch on value shape.
- Change gate nodes to mode-specific values: Rejected because gate retry budgets are outside the issue scope and must remain unchanged.
- Apply no-additional-confirmation exhaustion behavior to review-spec and review-test: Rejected because the user confirmed that only review-draft needs that behavior.
- Allow partial or non-positive mode-specific values: Rejected because retry limits must be bounded positive integers.
- Use node maxAttempts to control subprocess retries in run-review: Rejected because process failures and review verdict retries are separate concerns with different failure semantics.
- Ignore task-scope review payloads: Rejected because task next-action uses the same envelope contract and must not expose raw mode-specific objects.
- Return maxAttempts:null for no-step next-action envelopes: Rejected because maxAttempts only has meaning when an executable step exists, and omitting it avoids a nullable contract for active steps.
- Keep prompt wording tied to raw definition maxAttempts: Rejected because the public contract changes to resolved numeric maxAttempts.
- Use first matching gate step id across definitions: Rejected because flow and task definitions share gate-impl and may diverge later.
- Accept object-like maxAttempts values with inherited keys or extra keys: Rejected because constructor invariants require a precise owned-key shape.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-05-01T03:35:14Z
- Notes: Draft approved manually; review-draft was advanced by explicit user instruction after maxAttempts exhaustion.

## Requirements
- R1 (must): FlowNode.maxAttempts must accept either a positive integer or a mode-specific object with positive integer auto and manual properties.
- R2 (must): FlowNode construction must reject invalid maxAttempts values: 0, negative numbers, floats, NaN, non-number values, partial mode objects, and non-integer auto/manual values.
- R3 (must): Scalar maxAttempts values must resolve to the same number in both auto and manual modes for any node.
- R4 (must): Mode-specific maxAttempts values must resolve to auto when flow.autoApprove is true and manual when flow.autoApprove is false or absent.
- R5 (must): Next-action envelopes and retry consumers must receive a resolved numeric maxAttempts value, never a raw mode-specific object.
- R6 (must): Plan review nodes must be configured as review-draft { auto: 1, manual: 5 }, review-spec { auto: 3, manual: 3 }, and review-test { auto: 3, manual: 3 }.
- R7 (must): Gate nodes and implementation review must keep their existing scalar retry limits.
- R8 (must): When review-draft reaches its maxAttempts limit, the flow must stop with review-draft incomplete and must not present approval or confirmation choices; approval choices are only available after review-draft PASS.
- R9 (should): Regression tests should cover scalar compatibility, mode-specific validation, auto/manual resolution, configured review node values, resolved next-action payloads, retry consumers, and review-draft exhaustion behavior.
- R10 (must): Task-scope next-action payloads must expose resolved numeric maxAttempts and task review must keep its existing scalar retry limit.
- R11 (must): run-review subprocess retry behavior must remain classified as mechanical process retry and must not consume node maxAttempts or retry review verdict FAIL as a subprocess failure.
- R12 (must): If dispatcher skill template text changes to describe retry limits, the template must describe resolved numeric maxAttempts from next-action and sdd-forge upgrade must be run.
- R13 (must): When flow get next-action has step:null because there is no active flow or all steps are complete, the response must omit maxAttempts.
- R14 (must): The dispatcher skill template must read retry limits from the resolved numeric maxAttempts in the next-action envelope when enforcing retry limits, and sdd-forge upgrade must be run after template edits.
- R15 (must): Review prompt files for plan review, implementation review, and task review must describe retry limits as resolved numeric maxAttempts rather than raw definition values.
- R16 (must): Review command maxAttempts resolution for draft/spec/test phases must use loaded flow.autoApprove or an equivalent explicit mode input.
- R17 (must): Gate retry maxAttempts resolution must include flow/task scope or current task context before selecting a node definition.
- R18 (must): Mode-specific maxAttempts object values must be plain objects with exactly own auto and manual keys, no extra keys, and positive-integer values.

## Acceptance Criteria
- A scalar node such as gate-draft still resolves to its existing numeric retry limit in both auto and manual modes.
- review-draft resolves to maxAttempts 1 when flow.autoApprove is true and 5 when flow.autoApprove is false or missing.
- review-spec and review-test resolve to maxAttempts 3 in both auto and manual modes via mode-specific objects.
- deriveNextAction returns a numeric maxAttempts for scalar and mode-specific definitions.
- The next-action envelope passes flow.autoApprove into maxAttempts resolution and exposes only the resolved number.
- Review retry logic uses the resolved numeric value for draft/spec/test phases.
- Gate retry logic remains numeric and keeps existing gate budgets unchanged.
- Invalid maxAttempts definitions fail during FlowNode construction before runtime flow execution.
- review-draft maxAttempts exhaustion does not produce approval or confirmation choices and does not mark review-draft done.
- Task-scope next-action payloads expose numeric maxAttempts and task review remains scalar.
- runCmdWithRetry remains a bounded subprocess retry and does not change review verdict maxAttempts semantics.
- get-next-action contract tests assert numeric maxAttempts for flow and task scopes.
- If the sdd-forge.flow template changes, sdd-forge upgrade is run and generated skill files are updated.
- No-active-flow and completed-flow next-action responses omit maxAttempts when step is null.
- Dispatcher skill template text uses resolved numeric maxAttempts from the next-action envelope and sdd-forge upgrade has been run when the template changes.
- review-draft, review-spec, review-test, implementation review, and task review prompts use resolved numeric maxAttempts terminology.
- Review command draft/spec/test retry helpers receive flow.autoApprove or loaded flow state and resolve mode-specific values through the shared resolver.
- Gate retry helper tests cover flow-scope gate-impl and task-scope gate-impl separately.
- Mode-specific maxAttempts rejects arrays, null, boxed numbers, inherited auto/manual values, extra keys, and missing keys.

## Implementation Targets
- src/flow/definition.js
- src/flow/lib/get-next-action.js
- src/flow/commands/review.js
- src/flow/lib/run-gate.js
- src/flow/prompts/plan/review-draft.md
- specs/250-review-attempt-modes/tests/
- src/flow/lib/run-review.js
- src/templates/skills/sdd-forge.flow/SKILL.md
- tests/unit/flow/get-next-action.test.js
- tests/unit/flow/
- src/flow/prompts/plan/review-spec.md
- src/flow/prompts/plan/review-test.md
- src/flow/prompts/impl/review.md
- src/flow/prompts/task/review.md

## Tasks
- T-1: Model maxAttempts values
  - Goal: Introduce a flow-definition value model that accepts scalar positive integers and mode-specific positive-integer values while enforcing invalid definitions at construction time.
  - Acceptance: Scalar positive integers are accepted.; { auto, manual } objects with positive integers are accepted.; 0, negative, float, NaN, non-number, missing auto, and missing manual values are rejected.
  - Test strategy: Unit tests instantiate valid and invalid flow nodes or exported resolver helpers and assert acceptance/rejection.
- T-2: Resolve maxAttempts by mode
  - Goal: Return resolved numeric maxAttempts values from the definition boundary using flow.autoApprove as the mode input.
  - Acceptance: Scalar values resolve identically for auto and manual modes.; Mode-specific values resolve to auto when autoApprove is true.; Mode-specific values resolve to manual when autoApprove is false or absent.; deriveNextAction returns a number for maxAttempts.
  - Test strategy: Unit tests cover deriveNextAction with scalar and mode-specific nodes in auto, manual, and missing-mode cases.
- T-3: Configure plan review attempts
  - Goal: Apply mode-specific maxAttempts values to plan review nodes while leaving implementation review and gate nodes scalar.
  - Acceptance: review-draft is configured as { auto: 1, manual: 5 }.; review-spec is configured as { auto: 3, manual: 3 }.; review-test is configured as { auto: 3, manual: 3 }.; implementation review remains scalar 3.; gate-draft, gate, and gate-impl keep existing scalar limits.
  - Test strategy: Unit tests assert resolved values for each review and gate node in auto and manual modes.
- T-4: Propagate autoApprove mode
  - Goal: Pass flow.autoApprove into next-action, review retry, and gate retry maxAttempts resolution so each consumer uses the same numeric contract.
  - Acceptance: get-next-action passes flow.autoApprove into deriveNextAction.; review command retry limits use resolved numeric values for draft/spec/test phases.; gate retry resolution continues to return existing numeric values for scalar gate nodes.; No consumer receives a raw { auto, manual } object.
  - Test strategy: Unit tests or integration-style command tests verify next-action JSON and retry helpers for auto/manual flow states.
- T-5: Constrain draft review exhaustion
  - Goal: Ensure review-draft maxAttempts exhaustion stops without presenting approval or confirmation choices and leaves review-draft incomplete.
  - Acceptance: The review-draft exhaustion path does not present approval or confirmation choices.; review-draft remains incomplete when maxAttempts is exhausted.; The approval choice is reachable only after review-draft PASS.
  - Test strategy: Add a focused test that simulates review-draft exhaustion and asserts the next visible state has no approval/confirmation choice and no done transition.
- T-6: Update contract coverage
  - Goal: Extend next-action and retry regression tests so flow and task scopes expose numeric maxAttempts and subprocess retry remains separate from review verdict retry limits.
  - Acceptance: get-next-action tests assert numeric maxAttempts for scalar flow nodes.; get-next-action tests assert numeric maxAttempts for mode-specific review nodes in auto and manual modes.; get-next-action tests assert task review exposes numeric scalar maxAttempts.; run-review tests classify subprocess retry separately from review verdict FAIL handling.
  - Test strategy: Run focused unit tests for get-next-action and run-review helpers, then run npm test.
- T-7: Sync dispatcher template
  - Goal: Keep sdd-forge.flow dispatcher documentation aligned with resolved maxAttempts semantics when retry-limit wording changes are required.
  - Acceptance: Template text refers to resolved maxAttempts from next-action when retry limits are described.; sdd-forge upgrade is run if src/templates/skills/sdd-forge.flow/SKILL.md changes.; Generated skill files reflect the template update.
  - Test strategy: If template changes, run sdd-forge upgrade and inspect generated skill diffs.
- T-8: Define terminal envelope contract
  - Goal: Specify and test maxAttempts behavior when next-action has no executable step.
  - Acceptance: No-active-flow next-action response omits maxAttempts when step is null.; Completed-flow next-action response omits maxAttempts when step is null.; Active-step next-action responses include numeric maxAttempts.
  - Test strategy: Extend tests/unit/flow/get-next-action.test.js for no active flow, completed flow, and active scalar/mode-specific steps.
- T-9: Align retry wording
  - Goal: Update dispatcher and review prompt wording so retry limits are described as resolved numeric maxAttempts from the next-action contract.
  - Acceptance: sdd-forge.flow template consumes resolved maxAttempts from next-action.; Plan review prompts use resolved maxAttempts terminology.; Implementation and task review prompts use resolved maxAttempts terminology.; sdd-forge upgrade is run after template changes.
  - Test strategy: Run sdd-forge upgrade when templates change and inspect generated diffs; prompt wording is validated by spec review and source inspection.
- T-10: Preserve scoped gate retries
  - Goal: Make gate retry maxAttempts resolution explicitly preserve flow and task scope before selecting a definition node.
  - Acceptance: Flow-scope gate-impl resolves from the flow definition.; Task-scope gate-impl resolves from the task definition.; Scalar gate values remain unchanged.
  - Test strategy: Add focused unit tests for flow and task gate-impl retry max resolution.

## Open Questions
- None
