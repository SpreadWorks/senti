# Test Design

### Test Design

- **TC-1: Article schema exposes violation-aware shape**
  - Type: unit
  - Input: Inspect `GUARDRAIL_ARTICLE_EVAL_SCHEMA`.
  - Expected: Entry allows `guardrail_id`, `result`, optional `reason`, optional `violations[]`; violation entries allow only `target`, `where`, `why_violates`; extra properties are rejected.

- **TC-2: Requirement schema exposes reason-only shape**
  - Type: unit
  - Input: Inspect `IMPL_REQUIREMENT_EVAL_SCHEMA`.
  - Expected: Entry allows only `guardrail_id`, `result`, `reason`; extra properties are rejected.

- **TC-3: Article schema keeps outer required fields optional**
  - Type: unit
  - Input: Validate schema metadata for article entries.
  - Expected: JSON Schema itself does not require `guardrail_id` or `result`; parser enforces missing-id/result behavior separately.

- **TC-4: Requirement schema keeps parser-compatible shape**
  - Type: unit
  - Input: Validate schema metadata for requirement entries.
  - Expected: Schema matches unchanged implementation requirement contract and rejects unknown entry keys.

- **TC-5: Article parser accepts valid PASS**
  - Type: unit
  - Input: Raw JSON with known `guardrail_id`, `result: "PASS"`, non-empty `reason`.
  - Expected: Parsed entry is returned without `violations`.

- **TC-6: Article parser accepts valid SKIP**
  - Type: unit
  - Input: Raw JSON with known `guardrail_id`, `result: "SKIP"`, non-empty `reason`.
  - Expected: Parsed entry is returned without `violations`.

- **TC-7: Article parser accepts valid FAIL with violations**
  - Type: unit
  - Input: Raw JSON with known `guardrail_id`, `result: "FAIL"`, and one valid violation.
  - Expected: Parsed entry retains `violations[]` and has derived `reason`.

- **TC-8: Article FAIL reason is derived from violations**
  - Type: unit
  - Input: FAIL entry with model-supplied `reason` and two violations.
  - Expected: Supplied reason is replaced with `"<target> — <why_violates> (at <where>); ..."`.

- **TC-9: Article parser rejects FAIL without violations**
  - Type: unit
  - Input: FAIL entry omitting `violations`.
  - Expected: Throws `EvaluationSchemaError`.

- **TC-10: Article parser rejects FAIL with empty violations**
  - Type: unit
  - Input: FAIL entry with `violations: []`.
  - Expected: Throws `EvaluationSchemaError`.

- **TC-11: Article parser rejects empty violation target**
  - Type: unit
  - Input: FAIL entry with violation where `target` is empty or whitespace.
  - Expected: Throws `EvaluationSchemaError`.

- **TC-12: Article parser rejects empty violation where**
  - Type: unit
  - Input: FAIL entry with violation where `where` is empty or whitespace.
  - Expected: Throws `EvaluationSchemaError`.

- **TC-13: Article parser rejects empty violation why**
  - Type: unit
  - Input: FAIL entry with violation where `why_violates` is empty or whitespace.
  - Expected: Throws `EvaluationSchemaError`.

- **TC-14: Article parser rejects duplicate violation triples**
  - Type: unit
  - Input: FAIL entry containing duplicate `(guardrail_id, target, where)` triples.
  - Expected: Throws `EvaluationSchemaError`.

- **TC-15: Article parser rejects PASS with violations**
  - Type: unit
  - Input: PASS entry containing a `violations` field.
  - Expected: Throws `EvaluationSchemaError`.

- **TC-16: Article parser rejects SKIP with violations**
  - Type: unit
  - Input: SKIP entry containing a `violations` field.
  - Expected: Throws `EvaluationSchemaError`.

- **TC-17: Article parser rejects PASS/SKIP without non-empty reason**
  - Type: unit
  - Input: PASS or SKIP entry with missing, empty, or whitespace `reason`.
  - Expected: Throws `EvaluationSchemaError`.

- **TC-18: Requirement parser accepts valid entry**
  - Type: unit
  - Input: Raw JSON with known `guardrail_id`, `result`, and non-empty `reason`.
  - Expected: Parsed requirement entry is returned unchanged.

- **TC-19: Both parsers reject unknown ids**
  - Type: unit
  - Input: Article and requirement responses containing ids not present in `knownIds`.
  - Expected: Each parser throws `EvaluationSchemaError`.

- **TC-20: Both parsers reject duplicate ids**
  - Type: unit
  - Input: Article and requirement responses containing repeated `guardrail_id`.
  - Expected: Each parser throws `EvaluationSchemaError`.

- **TC-21: Both parsers reject missing ids**
  - Type: unit
  - Input: Article and requirement entries missing `guardrail_id`.
  - Expected: Each parser throws `EvaluationSchemaError`.

- **TC-22: Both parsers preserve fenced JSON extraction**
  - Type: unit
  - Input: Responses with surrounding prose and fenced ```json blocks.
  - Expected: Both parsers extract and parse the JSON candidate successfully.

- **TC-23: Article parser rejects unknown entry keys**
  - Type: unit
  - Input: Article entry containing an extra top-level key.
  - Expected: Throws `EvaluationSchemaError`.

- **TC-24: Requirement parser rejects unknown entry keys**
  - Type: unit
  - Input: Requirement entry containing `violations` or another extra key.
  - Expected: Throws `EvaluationSchemaError`.

- **TC-25: Article parser rejects unknown violation keys**
  - Type: unit
  - Input: Article FAIL violation containing an extra key.
  - Expected: Throws `EvaluationSchemaError`.

- **TC-26: EvaluationSchemaError has stable code**
  - Type: unit
  - Input: Construct or trigger `EvaluationSchemaError`.
  - Expected: Error has `name === "EvaluationSchemaError"` and `code === "EVALUATION_SCHEMA_ERROR"`.

- **TC-27: Article-check parse failure returns Envelope.fail**
  - Type: integration
  - Input: Mock runGateFlow article AI response with invalid article evaluation.
  - Expected: Returns `Envelope.fail`; first error has code `EVALUATION_SCHEMA_ERROR` and parser message.

- **TC-28: Bulk requirement parse failure returns Envelope.fail**
  - Type: integration
  - Input: Mock `executeDiffBasedGate` non-`perReqDiffs` requirement response with invalid schema.
  - Expected: Returns `Envelope.fail` with `EVALUATION_SCHEMA_ERROR`.

- **TC-29: Per-requirement parse failure returns Envelope.fail**
  - Type: integration
  - Input: Mock `executeDiffBasedGate` `perReqDiffs` loop response with invalid schema.
  - Expected: Returns `Envelope.fail` with `EVALUATION_SCHEMA_ERROR`.

- **TC-30: checkGuardrail article parse failure returns Envelope.fail**
  - Type: integration
  - Input: Mock article-check response from `checkGuardrail` with invalid violations.
  - Expected: Returns `Envelope.fail` with `EVALUATION_SCHEMA_ERROR`.

- **TC-31: Tracked phase parse failure increments retry and logs issue**
  - Type: integration
  - Input: Parse failure in `draft`, `spec`, `task-impl`, or `integration`.
  - Expected: `gateRetry` increments once and issue-log entry is appended once.

- **TC-32: task-spec parse failure does not increment retry**
  - Type: integration
  - Input: Parse failure during `task-spec`.
  - Expected: Returns `Envelope.fail` without retry increment or issue-log append.

- **TC-33: Dispatcher post-hooks do not double-count parser failures**
  - Type: integration
  - Input: Parse failure caught inside `run-gate.js`.
  - Expected: Dispatcher post-hooks are skipped for `ok:false`; no duplicate retry or issue-log entry.

- **TC-34: Guardrail article prompt uses renamed builder**
  - Type: unit
  - Input: Call `buildGuardrailArticleEvalPrompt`.
  - Expected: Export exists; obsolete `buildGuardrailPromptFromFiltered` is not referenced.

- **TC-35: Guardrail article prompt separates rules, schema, and fallback**
  - Type: unit
  - Input: Build article prompt.
  - Expected: Rules appear in `systemPrompt`; JSON Schema is in `jsonSchema`; fallback is in `fmtFallback`, not textual user sections.

- **TC-36: Guardrail article prompt user section order**
  - Type: unit
  - Input: Build prompt with previous pass history, diff scope, articles, and content.
  - Expected: `userPrompt` sections appear in order: previously-passed, diff-scope, articles, content.

- **TC-37: Guardrail article prompt rules describe violation enumeration**
  - Type: unit
  - Input: Inspect rendered system rules.
  - Expected: Rules instruct one violation per instance/edit location, one or more document-level gap entries, and diff-scope-only newly introduced violations.

- **TC-38: Requirement prompt uses requirement schema and parser**
  - Type: unit
  - Input: Build implementation requirement check prompt and parse its mocked response.
  - Expected: Uses `IMPL_REQUIREMENT_EVAL_SCHEMA` and `parseImplRequirementEvaluation`; reason-only contract is unchanged.

- **TC-39: Format fallbacks match their paths**
  - Type: unit
  - Input: Inspect article and requirement fallback payloads.
  - Expected: Article fallback shows FAIL with `violations[]` and PASS/SKIP with `reason`; requirement fallback keeps single `reason`.

- **TC-40: reasonsFromEvaluations emits one row per article violation**
  - Type: unit
  - Input: FAIL article evaluation with two violations and title metadata.
  - Expected: Produces two FAIL rows, each with detail `"<title> — <target> — <why_violates> (at <where>)"` and structured `where`.

- **TC-41: reasonsFromEvaluations preserves existing PASS/SKIP and requirement behavior**
  - Type: unit
  - Input: PASS/SKIP article entries and requirement entries.
  - Expected: Emits one row per entry using `reason`.

- **TC-42: Parsed artifacts retain metadata and violations**
  - Type: integration
  - Input: Gate run with article FAIL and requirement entries.
  - Expected: `data.artifacts.evaluations` includes `title` and `category`; article FAIL retains `violations[]`; requirement category is `requirements`.

- **TC-43: Artifact reasons and issues shape remain compatible**
  - Type: integration
  - Input: Gate failure with article violations.
  - Expected: `data.artifacts.reasons` reflects per-violation rows; `data.artifacts.issues` shape is unchanged.

- **TC-44: Plan gate prompt displays all failure reason rows**
  - Type: acceptance
  - Input: Render `src/flow/prompts/plan/gate.md` with multiple `data.artifacts.reasons`.
  - Expected: Every row is displayed after FAIL.

- **TC-45: Plan gate prompt includes spec.json scan instruction**
  - Type: acceptance
  - Input: Render plan gate prompt after FAIL.
  - Expected: Literal instruction lists required `spec.json` fields, excluded metadata/control fields, render command, and re-run gate instruction.

- **TC-46: task-spec prompt targets task id from artifact path**
  - Type: acceptance
  - Input: Render gate prompt for artifact `specs/<spec>/tasks/<id>.md`.
  - Expected: Prompt says to edit `spec.json.tasks[]` entry whose `id` matches basename `<id>` and then run `sdd-forge spec render`.

- **TC-47: Draft gate prompt displays all failure reason rows**
  - Type: acceptance
  - Input: Render `src/flow/prompts/plan/gate-draft.md` with multiple `data.artifacts.reasons`.
  - Expected: Every row is displayed after FAIL.

- **TC-48: Draft gate prompt includes draft.json scan instruction**
  - Type: acceptance
  - Input: Render draft gate prompt after FAIL.
  - Expected: Literal instruction lists required `draft.json` fields, excluded fields, and says to fix all instances in the iteration.

- **TC-49: applyFlipOverride removes violations**
  - Type: unit
  - Input: Flip a FAIL article entry with `violations[]` to PASS.
  - Expected: Result keeps `guardrail_id` and flip-marker reason, changes to PASS, and has no `violations` field.

- **TC-50: Public exports are updated**
  - Type: unit
  - Input: Import from `src/flow/lib/run-gate.js`.
  - Expected: New named exports exist; obsolete `parseEvaluationResponse` and `GUARDRAIL_EVAL_SCHEMA` are absent or unused.
