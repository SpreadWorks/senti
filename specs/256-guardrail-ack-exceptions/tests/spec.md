# Test Design

### Test Design

- **TC-1: AcknowledgedRationaleEntry renders prompt lines**
  - Type: unit
  - Input: `new AcknowledgedRationaleEntry("G1", "$.constraints[0]", "some text")`
  - Expected: `toPromptLines()` returns `- source: $.constraints[0]` and `  text: some text`

- **TC-2: Truncated entry appends marker**
  - Type: unit
  - Input: Entry with `truncated = true`
  - Expected: Rendered text ends with `[truncated]`

- **TC-3: Set stores entries per guardrail**
  - Type: unit
  - Input: Add multiple entries for `G1` and `G2`
  - Expected: Entries are grouped by guardrail ID and rendered only under matching headings

- **TC-4: Null spec returns warning**
  - Type: unit
  - Input: `buildAcknowledgedRationaleSection({ spec: null, guardrails })`
  - Expected: `{ markdown: "", warning: "parent spec context unavailable" }`

- **TC-5: Empty spec produces empty markdown without warning**
  - Type: unit
  - Input: Valid spec with no matching scanned fields
  - Expected: `{ markdown: "", warning: "" }` or equivalent no-warning value

- **TC-6: Extracts from constraints**
  - Type: unit
  - Input: `constraints: ["Exception for guardrail.alpha with enough rationale text"]`
  - Expected: Entry source path is `$.constraints[0]`

- **TC-7: Extracts clarification Q/A as one pair**
  - Type: unit
  - Input: `clarifications[0].q` and `.a` contain a matching guardrail ID and enough rationale
  - Expected: One entry at `$.clarifications[0]` with text `Q: ... A: ...`

- **TC-8: Extracts alternative option/reason as one pair**
  - Type: unit
  - Input: `alternatives_considered[0].option` and `.reason`
  - Expected: One entry at `$.alternatives_considered[0]` with text `Option: ... Reason: ...`

- **TC-9: Does not scan excluded fields**
  - Type: unit
  - Input: Matching guardrail IDs only in `design_principles`, approval notes, issue-log text, generated markdown, and raw diff text
  - Expected: No acknowledged rationale entries are produced

- **TC-10: Matching is case-sensitive**
  - Type: unit
  - Input: Guardrail ID `guardrail.alpha`; spec text contains `Guardrail.Alpha`
  - Expected: No match

- **TC-11: Token-boundary delimiters match**
  - Type: unit
  - Input: Guardrail ID surrounded by backticks, quotes, colon, spaces, and newlines
  - Expected: Each occurrence qualifies as a valid match

- **TC-12: ASCII letter boundary blocks match**
  - Type: unit
  - Input: `xguardrail.alpha` or `guardrail.alphax`
  - Expected: No match

- **TC-13: Digit boundary blocks match**
  - Type: unit
  - Input: `1guardrail.alpha` or `guardrail.alpha1`
  - Expected: No match

- **TC-14: Hyphen boundary blocks match**
  - Type: unit
  - Input: `prefix-guardrail.alpha` or `guardrail.alpha-suffix`
  - Expected: No match

- **TC-15: Qualification removes guardrail ID before counting**
  - Type: unit
  - Input: Entry text containing `guardrail.alpha` plus fewer than 20 non-whitespace chars after removing the ID
  - Expected: Entry is rejected

- **TC-16: Repeated IDs do not help qualification**
  - Type: unit
  - Input: Text with repeated `guardrail.alpha guardrail.alpha` and little other rationale
  - Expected: Entry is rejected

- **TC-17: ID-only entry is rejected**
  - Type: unit
  - Input: Constraint text exactly `guardrail.alpha`
  - Expected: No entry

- **TC-18: Pair labels do not count toward qualification**
  - Type: unit
  - Input: Clarification or alternative where only labels plus guardrail ID reach 20 characters
  - Expected: Entry is rejected

- **TC-19: Pair content qualifies after removing labels and ID**
  - Type: unit
  - Input: Q/A or option/reason pair with enough meaningful non-whitespace text after ID removal
  - Expected: Entry is accepted

- **TC-20: Whitespace normalization happens before rendering**
  - Type: unit
  - Input: Text with newlines, tabs, indentation, and repeated spaces
  - Expected: Rendered text collapses internal whitespace to single spaces

- **TC-21: Entry truncates after qualification**
  - Type: unit
  - Input: Long qualifying entry over 600 characters
  - Expected: Entry is accepted, rendered at max 600 characters plus `[truncated]`

- **TC-22: Max three entries per guardrail**
  - Type: unit
  - Input: Four qualifying entries for one guardrail
  - Expected: Only first three deterministic entries render

- **TC-23: Section cap stops at entry boundary**
  - Type: unit
  - Input: Enough qualifying entries to exceed 4000 characters
  - Expected: Markdown length does not exceed 4000 characters and no partial entry is rendered

- **TC-24: Rendering order is deterministic**
  - Type: unit
  - Input: Multiple guardrails and matches across constraints, clarifications, and alternatives
  - Expected: Output order is filtered guardrail order, then field order, then ascending array index

- **TC-25: Default heading is rendered once**
  - Type: unit
  - Input: Matching rationale with default heading
  - Expected: Markdown starts with `## Matched Spec Acknowledgment Rationale` and does not duplicate heading

- **TC-26: Custom heading is supported**
  - Type: unit
  - Input: `heading: "Custom Heading"`
  - Expected: Markdown starts with `## Custom Heading`

- **TC-27: PromptBuilder raw markdown preserves helper-owned heading**
  - Type: unit
  - Input: Add acknowledged rationale through `PromptBuilder.addRaw(markdown)`
  - Expected: Heading and section body render exactly as supplied, without stripping or nesting

- **TC-28: Guardrail article prompt inserts rationale in exact order**
  - Type: unit
  - Input: `buildGuardrailArticleEvalPrompt(..., options.acknowledgedRationale.markdown)`
  - Expected: Section order is Guardrail Articles, Matched Spec Acknowledgment Rationale, then Content

- **TC-29: Full run-gate prompt section order**
  - Type: unit
  - Input: Prompt with previously passed IDs, diff scope constraint, guardrail articles, rationale, and content
  - Expected: Exact order is previously passed guardrails, diff scope constraint, Guardrail Articles, Matched Spec Acknowledgment Rationale, Content

- **TC-30: Empty acknowledged rationale preserves existing prompt output**
  - Type: unit
  - Input: Same prompt inputs with `options = {}` and with `{ acknowledgedRationale: { markdown: "" } }`
  - Expected: Outputs are byte-for-byte identical

- **TC-31: buildGuardrailPrompt forwards options**
  - Type: unit
  - Input: `buildGuardrailPrompt(..., { acknowledgedRationale })`
  - Expected: Result includes the rationale section; empty options preserve existing output

- **TC-32: checkGuardrail accepts options separately from previously passed IDs**
  - Type: unit
  - Input: `checkGuardrail(root, text, phase, role, previouslyPassedIds, options)`
  - Expected: Previously passed IDs still render correctly and rationale options are forwarded

- **TC-33: runGateFlow forwards guardrail prompt options**
  - Type: integration
  - Input: `runGateFlow` with acknowledged rationale and previously passed IDs
  - Expected: `checkGuardrail` receives both, with IDs and options kept distinct

- **TC-34: executeSpec builds rationale from parent spec**
  - Type: integration
  - Input: Spec execution with loaded parent `spec.json` containing matching scanned-field rationale
  - Expected: Guardrail article evaluation receives acknowledged rationale markdown

- **TC-35: Diff gate loads parent spec and previous passes**
  - Type: integration
  - Input: `executeDiffBasedGate` for `task-impl` or `integration`, active `state.spec`, issue-log with previously passed IDs
  - Expected: Parent spec rationale is built, previous IDs are intersected with current filtered guardrail IDs, and both are passed to `checkGuardrail`

- **TC-36: Diff gate treats missing parent spec as unavailable context**
  - Type: integration
  - Input: `task-impl` or `integration` gate with missing parent spec
  - Expected: No hard failure; rationale is empty with warning `parent spec context unavailable`

- **TC-37: Diff gate treats invalid JSON parent spec as unavailable context**
  - Type: integration
  - Input: Parent spec file exists but contains invalid JSON
  - Expected: No hard failure; empty rationale plus warning metadata

- **TC-38: Diff gate treats schema-invalid parent spec as unavailable context**
  - Type: integration
  - Input: Parent spec JSON parses but fails schema validation
  - Expected: No hard failure; empty rationale plus warning metadata

- **TC-39: Spec gate keeps strict validation**
  - Type: integration
  - Input: Spec gate with invalid spec context
  - Expected: Existing strict validation behavior remains; invalid spec is not silently converted to empty rationale

- **TC-40: Review draft system prompt renders rationale after perspectives**
  - Type: unit
  - Input: `buildDraftSystemPrompt(guardrails, { acknowledgedRationale })`
  - Expected: Rationale appears immediately after `## Additional Guardrail Review Perspectives`

- **TC-41: Review paths load active parent spec**
  - Type: integration
  - Input: `runLoopReview` and single-call review with active parent spec containing rationale
  - Expected: Both review paths pass acknowledged rationale to `buildDraftSystemPrompt`

- **TC-42: Review tolerates missing or invalid parent spec**
  - Type: integration
  - Input: Review with missing, invalid JSON, or schema-invalid parent spec
  - Expected: Review continues with empty rationale and warning metadata

- **TC-43: Target preset guardrail bodies contain common clause**
  - Type: unit
  - Input: Load `src/presets/cli/guardrail.json`, `base`, and `node-cli`
  - Expected: Four target guardrail IDs contain the common acknowledged-exception clause and example sentence

- **TC-44: Override preserves clause**
  - Type: unit
  - Input: Preset-chain or project override replaces a target guardrail body without the common clause
  - Expected: Loaded guardrail body includes the common clause

- **TC-45: Clause preservation is idempotent**
  - Type: unit
  - Input: Load target guardrail body that already contains the common clause
  - Expected: Clause is not appended a second time

- **TC-46: get-guardrail markdown includes ID next to title**
  - Type: unit
  - Input: Markdown output for a guardrail article
  - Expected: Heading format is `## Guardrail: <title> (<id>)`

- **TC-47: get-guardrail JSON output is preserved**
  - Type: unit
  - Input: JSON output mode for same guardrail
  - Expected: JSON shape and values remain unchanged

- **TC-48: Valid guardrail phases are accepted**
  - Type: unit
  - Input: Lookup phases `draft`, `spec`, `task-spec`, `task-impl`, `integration`, `test`, `lint`, `review`
  - Expected: Each phase succeeds

- **TC-49: impl alias maps to task-impl**
  - Type: acceptance
  - Input: `sdd-forge flow get guardrail impl`
  - Expected: Exit code `0` and output identical to `task-impl`

- **TC-50: Unknown guardrail phase fails clearly**
  - Type: acceptance
  - Input: `sdd-forge flow get guardrail unknown-phase`
  - Expected: Non-zero exit and error lists valid phases

- **TC-51: Broad fixture coverage for real specs**
  - Type: integration
  - Input: Existing fixtures `specs/228-fix-baseline-exit-code/spec.json`, `specs/235-remove-flow-test-management/spec.json`, `specs/229-test-runner-file-filter/spec.json`
  - Expected: Extractor runs deterministically, finds only valid scanned-field matches, and never scans excluded fields

- **TC-52: Synthetic collision fixture coverage**
  - Type: unit
  - Input: Synthetic spec containing boundary collisions, repeated IDs, id-only entries, pair entries, and long entries
  - Expected: Matching, qualification, truncation, caps, and ordering all follow requirements

- **TC-53: Generated skill upgrade output matches template**
  - Type: acceptance
  - Input: After changing `src/templates/skills/sdd-forge.flow/SKILL.md`, run `sdd-forge upgrade`
  - Expected: Generated `.agents/skills/sdd-forge.flow/SKILL.md` and `.claude/skills/sdd-forge.flow/SKILL.md` diffs match the template change only
