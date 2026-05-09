# Test Design

### Test Design

- **TC-1: loader keeps explicit empty phase**
  - Type: unit
  - Input: guardrail entry with `phase: []`
  - Expected: loaded guardrail keeps `phase: []`; it is not replaced with `DEFAULT_PHASE`.

- **TC-2: loader applies default phase when phase is undefined**
  - Type: unit
  - Input: guardrail entry with `phase: undefined`
  - Expected: loaded guardrail has `phase: ['spec']`.

- **TC-3: loader applies default phase when phase is omitted**
  - Type: unit
  - Input: guardrail entry without `phase`
  - Expected: loaded guardrail has `phase: ['spec']`.

- **TC-4: filterByPhase excludes disabled guardrail for every phase**
  - Type: unit
  - Input: guardrail with `phase: []`, filtered by `draft`, `spec`, and another valid phase
  - Expected: guardrail is not included for any phase.

- **TC-5: filterByPhase includes defaulted spec guardrail**
  - Type: unit
  - Input: guardrail without `phase`, filtered by `spec`
  - Expected: guardrail is included because loader defaulted phase to `['spec']`.

- **TC-6: preset draft-scope-boundary is disabled**
  - Type: integration
  - Input: load preset guardrails
  - Expected: `draft-scope-boundary` exists and has `phase: []`.

- **TC-7: preset spec-synthesize-not-copy is disabled**
  - Type: integration
  - Input: load preset guardrails
  - Expected: `spec-synthesize-not-copy` exists and has `phase: []`.

- **TC-8: draft gate does not evaluate draft-scope-boundary**
  - Type: integration
  - Input: run draft phase gate with preset guardrails
  - Expected: `draft-scope-boundary` is not present in evaluated guardrails and produces no result.

- **TC-9: spec gate does not evaluate spec-synthesize-not-copy**
  - Type: integration
  - Input: run spec phase gate with preset guardrails
  - Expected: `spec-synthesize-not-copy` is not present in evaluated guardrails and produces no result.

- **TC-10: validateLintGuardrails skips disabled guardrails**
  - Type: unit
  - Input: lint validation with guardrail having `phase: []`
  - Expected: disabled guardrail is skipped and no warning/error is emitted for it.

- **TC-11: lint command skips disabled guardrails without warning**
  - Type: integration
  - Input: run lint on project where preset contains disabled guardrails
  - Expected: disabled guardrails are not evaluated and no warnings mention skipped disabled guardrails.

- **TC-12: flow get guardrail markdown excludes disabled guardrails**
  - Type: integration
  - Input: `sdd-forge flow get guardrail draft` and `sdd-forge flow get guardrail spec`
  - Expected: markdown output does not include `draft-scope-boundary` or `spec-synthesize-not-copy`.

- **TC-13: flow get guardrail JSON excludes disabled guardrails**
  - Type: integration
  - Input: `sdd-forge flow get guardrail draft --json` and `spec --json`
  - Expected: JSON array/object does not contain guardrails with `phase: []`.

- **TC-14: spec creation prompt includes synthesize rule**
  - Type: unit
  - Input: render/read spec creation-time prompt fixture
  - Expected: prompt includes rules for organization/abstraction, direct-copy prohibition, no fabrication from missing draft content, and correction allowed for source-code contradictions.

- **TC-15: spec creation prompt includes minimal verification exception**
  - Type: unit
  - Input: render/read spec creation-time prompt fixture
  - Expected: prompt says draft evaluation remains primary input, but minimal source reading is allowed only when verification is needed.

- **TC-16: spec creation prompt defines VERIFY and CORRECTION decision prefixes**
  - Type: unit
  - Input: render/read spec creation-time prompt fixture
  - Expected: prompt instructs recording verification and correction in `spec.json overview.decisions[].text` with `[VERIFY]` / `[CORRECTION]` prefixes.

- **TC-17: spec creation prompt documents decision length handling**
  - Type: unit
  - Input: render/read spec creation-time prompt fixture
  - Expected: prompt states `text` must remain a short summary within maxLength 500, details go in `evidence` within maxLength 1000, and long details should be split across multiple decisions.

- **TC-18: spec creation prompt includes Choice Format confirmation**
  - Type: unit
  - Input: render/read spec creation-time prompt fixture
  - Expected: prompt instructs AI to ask user confirmation using Choice Format when correcting draft policy, and says autoApprove uses existing auto-select `[1]` convention.

- **TC-19: spec creation prompt requires spec render after spec.json update**
  - Type: unit
  - Input: render/read spec creation-time prompt fixture
  - Expected: prompt explicitly requires running `sdd-forge spec render` after updating `spec.json`.

- **TC-20: draft creation prompt includes draft-scope-boundary creation-time rule**
  - Type: unit
  - Input: render/read draft creation-time prompt fixture
  - Expected: prompt says draft must stay at requirements level and clearly defines the allowed code reference scope.

- **TC-21: fixture test covers required prompt wording set**
  - Type: integration
  - Input: run prompt fixture tests for spec and draft creation-time prompts
  - Expected: tests assert presence of R4, R5, R6, R12, `[VERIFY]`, and `[CORRECTION]` wording.

- **TC-22: spec gate prompt instructs JSON-first fail recovery**
  - Type: unit
  - Input: read `src/flow/prompts/plan/gate.md`
  - Expected: FAIL flow says edit `spec.json`, run `sdd-forge spec render`, then rerun gate.

- **TC-23: spec gate prompt does not instruct direct spec.md edits**
  - Type: unit
  - Input: read `src/flow/prompts/plan/gate.md`
  - Expected: prompt does not tell users to directly edit `spec.md` as the primary correction source.

- **TC-24: disabled guardrails remain invisible end-to-end**
  - Type: acceptance
  - Input: run normal flow using default preset through draft/spec guardrail retrieval, lint, and gate prompt generation
  - Expected: disabled guardrails are not shown, linted, warned, or evaluated, while their creation-time prompt content still appears where required.
