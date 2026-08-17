# Code Review Results

### [ ] 1. Centralize Guardrail Rendering
**File:** `src/flow/get/guardrail.js`  
**Issue:** The command now has two output paths that both depend on the same normalized guardrail shape (`title`, trimmed `body`, metadata). The JSON branch rebuilds the object inline while the Markdown branch formats directly from raw guardrails, which invites drift if another format or field is added later.  
**Suggestion:** Extract a shared normalizer such as `serializeGuardrail(guardrail)` or `buildGuardrailViewModel(guardrails)` and have both `toMarkdown()` and the JSON output consume that normalized structure.

**Verdict:** REJECTED
**Reason:** The file is 63 lines total with only two output paths. The JSON branch maps `{id, title, body.trim(), meta}` while the Markdown branch uses only `{title, body.trim()}` — they deliberately select different fields for different consumers. Introducing a shared "view model" abstraction for this tiny file adds indirection without meaningful drift protection. The two paths are trivially visible on one screen. This is premature abstraction.

### [x] 2. Replace Ad Hoc Flag Parsing With a Command-Local Parser
**File:** `src/flow/get/guardrail.js`  
**Issue:** `formatIdx`, `skipIdx`, and the `find()` predicate implement manual CLI parsing that is brittle and inconsistent with the rest of the command layer. It is easy to mis-handle cases like `--format` without a value, repeated flags, or future options.  
**Suggestion:** Introduce a small parser such as `parseGuardrailArgs(args)` that returns `{ phase, format }`, validates supported formats, and isolates option handling from business logic. If the project already has a shared CLI parsing helper for subcommands, reuse that instead.

**Verdict:** APPROVED
**Reason:** The current `formatIdx`/`skipIdx`/`find()` logic (lines 29–32) has a real edge-case bug: if `--format` is the last arg, `args[formatIdx + 1]` reads `undefined` silently, and the `phase` finder's skip logic is fragile. Extracting a small `parseGuardrailArgs(args)` function improves testability and makes it safe to add future options (e.g. `--scope`). The project already uses `parseArgs` from `cli.js` for other commands — ideally reuse that, but even a local helper is an improvement.

### [x] 3. Remove Spec-Specific Comment Noise From Finalize
**File:** `src/flow/run/finalize.js`  
**Issue:** Comments like `// Save to specs/NNN/report.json (R5)` and `// R7: report errors do not block pipeline` encode old requirement IDs rather than explaining behavior. After the related spec artifacts were deleted in this same change, those markers no longer carry useful meaning and read like dead documentation.  
**Suggestion:** Replace requirement-number comments with intent-revealing comments such as “Persist report beside the spec” and “Report generation failure is non-blocking”, or remove them entirely where the code is already clear.

**Verdict:** APPROVED
**Reason:** The comments `// R5`, `// R7` reference requirements from `specs/124-fix-finalize-report-save/spec.md`, which was deleted in this same diff. These are now dead cross-references that will confuse future readers. Replacing with intent-revealing comments (or removing where obvious) is a genuine readability improvement with zero behavioral risk.

### [ ] 4. Extract Non-Blocking Report Persistence Into a Helper
**File:** `src/flow/run/finalize.js`  
**Issue:** The report branch still mixes report construction, persistence, error capture, and result shaping in one block. Even after removing the extra git/copy logic, the step remains harder to scan than neighboring finalize stages because error-tolerant save behavior is embedded inline.  
**Suggestion:** Extract a helper such as `saveReportSafely(root, specPath, report)` that returns `{ saveError } | null`. That keeps `execute()` focused on pipeline orchestration and makes the “non-blocking save” pattern reusable and consistent with other finalize substeps.

**Verdict:** REJECTED
**Reason:** The report block (lines 218–272) is a straightforward try/catch around `generateReport()` + `saveReport()` with a non-blocking catch. Extracting `saveReportSafely()` would move ~5 lines into a separate function for a pattern used exactly once. The "non-blocking save" is just a try/catch that assigns `saveError` — creating a helper for this adds a function boundary and return-type contract for negligible clarity gain. The surrounding finalize steps (commit, merge, sync, cleanup) all follow the same inline try/catch pattern; singling out report would make it inconsistent with its neighbors.
