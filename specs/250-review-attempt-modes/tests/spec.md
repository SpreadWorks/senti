# Test Design

### Test Design

- **TC-1: Accept scalar positive integer maxAttempts**
  - Type: unit
  - Input: Construct `FlowNode` with `maxAttempts: 1`, `3`, and a large positive integer.
  - Expected: Construction succeeds.

- **TC-2: Reject scalar zero**
  - Type: unit
  - Input: Construct `FlowNode` with `maxAttempts: 0`.
  - Expected: Construction throws validation error.

- **TC-3: Reject scalar negative integer**
  - Type: unit
  - Input: Construct `FlowNode` with `maxAttempts: -1`.
  - Expected: Construction throws validation error.

- **TC-4: Reject scalar float**
  - Type: unit
  - Input: Construct `FlowNode` with `maxAttempts: 1.5`.
  - Expected: Construction throws validation error.

- **TC-5: Reject scalar NaN**
  - Type: unit
  - Input: Construct `FlowNode` with `maxAttempts: NaN`.
  - Expected: Construction throws validation error.

- **TC-6: Reject non-number scalar values**
  - Type: unit
  - Input: Construct `FlowNode` with `maxAttempts: "3"`, `true`, `null`, `undefined`, array, or function.
  - Expected: Construction throws validation error.

- **TC-7: Accept valid mode-specific maxAttempts object**
  - Type: unit
  - Input: Construct `FlowNode` with `maxAttempts: { auto: 1, manual: 5 }`.
  - Expected: Construction succeeds.

- **TC-8: Reject partial mode-specific object**
  - Type: unit
  - Input: Construct `FlowNode` with `{ auto: 1 }` or `{ manual: 5 }`.
  - Expected: Construction throws validation error.

- **TC-9: Reject non-integer mode values**
  - Type: unit
  - Input: Construct `FlowNode` with `{ auto: 1.5, manual: 5 }` or `{ auto: 1, manual: 2.5 }`.
  - Expected: Construction throws validation error.

- **TC-10: Reject invalid mode value boundaries**
  - Type: unit
  - Input: Construct `FlowNode` with `{ auto: 0, manual: 5 }`, `{ auto: 1, manual: 0 }`, or negative values.
  - Expected: Construction throws validation error.

- **TC-11: Reject non-number mode values**
  - Type: unit
  - Input: Construct `FlowNode` with `{ auto: "1", manual: 5 }`, `{ auto: 1, manual: NaN }`, or boolean/null values.
  - Expected: Construction throws validation error.

- **TC-12: Reject mode object with extra keys**
  - Type: unit
  - Input: Construct `FlowNode` with `{ auto: 1, manual: 5, extra: 9 }`.
  - Expected: Construction throws validation error.

- **TC-13: Reject non-plain mode object**
  - Type: unit
  - Input: Construct `FlowNode` with class instance, array, Date, or object with inherited `auto`/`manual`.
  - Expected: Construction throws validation error.

- **TC-14: Resolve scalar maxAttempts in auto mode**
  - Type: unit
  - Input: Node has `maxAttempts: 3`; flow has `autoApprove: true`.
  - Expected: Resolved maxAttempts is `3`.

- **TC-15: Resolve scalar maxAttempts in manual mode**
  - Type: unit
  - Input: Node has `maxAttempts: 3`; flow has `autoApprove: false` or no `autoApprove`.
  - Expected: Resolved maxAttempts is `3`.

- **TC-16: Resolve mode-specific maxAttempts in auto mode**
  - Type: unit
  - Input: Node has `maxAttempts: { auto: 1, manual: 5 }`; flow has `autoApprove: true`.
  - Expected: Resolved maxAttempts is `1`.

- **TC-17: Resolve mode-specific maxAttempts in manual mode**
  - Type: unit
  - Input: Node has `maxAttempts: { auto: 1, manual: 5 }`; flow has `autoApprove: false`.
  - Expected: Resolved maxAttempts is `5`.

- **TC-18: Resolve mode-specific maxAttempts when autoApprove is absent**
  - Type: unit
  - Input: Node has `maxAttempts: { auto: 1, manual: 5 }`; flow has no `autoApprove`.
  - Expected: Resolved maxAttempts is `5`.

- **TC-19: Plan review node retry configuration**
  - Type: unit
  - Input: Load plan review flow node definitions.
  - Expected: `review-draft` is `{ auto: 1, manual: 5 }`, `review-spec` is `{ auto: 3, manual: 3 }`, and `review-test` is `{ auto: 3, manual: 3 }`.

- **TC-20: Existing scalar retry limits are preserved**
  - Type: unit
  - Input: Load gate nodes, implementation review node, and task review node definitions.
  - Expected: Existing scalar `maxAttempts` values remain unchanged.

- **TC-21: Next-action envelope exposes resolved scalar for auto plan review**
  - Type: integration
  - Input: Active flow with `autoApprove: true`; current step is `review-draft`.
  - Expected: Next-action response contains numeric `maxAttempts: 1`, not `{ auto, manual }`.

- **TC-22: Next-action envelope exposes resolved scalar for manual plan review**
  - Type: integration
  - Input: Active flow with `autoApprove: false`; current step is `review-draft`.
  - Expected: Next-action response contains numeric `maxAttempts: 5`, not `{ auto, manual }`.

- **TC-23: Task-scope next-action payload exposes resolved scalar**
  - Type: integration
  - Input: Active task flow with task review step using existing scalar retry limit.
  - Expected: Task next-action response contains numeric `maxAttempts` matching the existing scalar limit.

- **TC-24: Next-action omits maxAttempts when step is null**
  - Type: integration
  - Input: `flow get next-action` when there is no active flow.
  - Expected: Response has `step: null` and omits `maxAttempts`.

- **TC-25: Next-action omits maxAttempts when all steps are complete**
  - Type: integration
  - Input: `flow get next-action` after final step is complete.
  - Expected: Response has `step: null` and omits `maxAttempts`.

- **TC-26: Retry consumers receive only resolved numeric maxAttempts**
  - Type: integration
  - Input: Execute retry-count enforcement for a node configured with `{ auto, manual }`.
  - Expected: Consumer receives a number only and never branches on raw object shape.

- **TC-27: Review-draft exhaustion stops flow in auto mode**
  - Type: acceptance
  - Input: `autoApprove: true`; `review-draft` fails once.
  - Expected: Flow stops with `review-draft` incomplete after `1` attempt.

- **TC-28: Review-draft exhaustion hides approval choices**
  - Type: acceptance
  - Input: `review-draft` reaches max attempts without PASS.
  - Expected: No approval or confirmation choices are presented.

- **TC-29: Approval choices appear only after review-draft PASS**
  - Type: acceptance
  - Input: `review-draft` returns PASS before max attempts.
  - Expected: Approval or confirmation choices become available.

- **TC-30: Review command resolves draft/spec/test maxAttempts from loaded flow mode**
  - Type: integration
  - Input: Run review command for draft/spec/test phases with `autoApprove: true` and `false`.
  - Expected: Draft uses `1` in auto and `5` in manual; spec/test use `3` in both modes.

- **TC-31: Gate retry resolution uses correct flow or task scope**
  - Type: integration
  - Input: Invoke gate retry logic from flow scope, task scope, and current task context.
  - Expected: Correct node definition is selected before resolving scalar maxAttempts.

- **TC-32: Run-review subprocess mechanical retry does not consume node attempts**
  - Type: integration
  - Input: `run-review` subprocess has transient mechanical failure before producing a verdict.
  - Expected: Mechanical retry occurs without incrementing node review attempt count.

- **TC-33: Review verdict FAIL is not treated as subprocess failure**
  - Type: integration
  - Input: `run-review` subprocess completes successfully with review verdict `FAIL`.
  - Expected: Node review attempt is consumed normally; subprocess failure retry logic is not triggered.

- **TC-34: Dispatcher template reads retry limit from next-action maxAttempts**
  - Type: acceptance
  - Input: Render or inspect dispatcher skill template after retry-limit wording changes.
  - Expected: Template instructs enforcement using resolved numeric `maxAttempts` from next-action envelope.

- **TC-35: Dispatcher template does not describe raw definition values**
  - Type: acceptance
  - Input: Inspect dispatcher skill template text.
  - Expected: Template does not instruct reading raw node definitions or `{ auto, manual }` retry objects.

- **TC-36: Upgrade is run after dispatcher template edits**
  - Type: acceptance
  - Input: Modify dispatcher skill template retry-limit text.
  - Expected: `sdd-forge upgrade` is executed and generated skill/config files are updated as needed.

- **TC-37: Review prompts describe resolved numeric maxAttempts**
  - Type: acceptance
  - Input: Inspect plan review, implementation review, and task review prompt files.
  - Expected: Prompt text describes retry limits as resolved numeric `maxAttempts`, not raw definition values.

- **TC-38: Scalar compatibility regression**
  - Type: integration
  - Input: Existing flows using scalar retry limits only.
  - Expected: Behavior, payload shape, and retry exhaustion remain unchanged.

- **TC-39: Mode-specific validation regression coverage**
  - Type: unit
  - Input: Table-driven invalid cases for object shape, key ownership, extra keys, non-plain objects, floats, zero, negative, NaN, and non-numbers.
  - Expected: Every invalid case is rejected at construction.

- **TC-40: End-to-end auto/manual review retry behavior**
  - Type: acceptance
  - Input: Run the same plan review flow once with `autoApprove: true` and once with `autoApprove: false`.
  - Expected: Auto mode limits `review-draft` to `1`; manual mode limits it to `5`; downstream consumers see numeric retry limits throughout.
