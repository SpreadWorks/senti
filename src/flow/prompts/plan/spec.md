   - **Before writing spec**:
     - Read draft.json (if exists) and linked GitHub issue content. If draft was completed, treat it as the primary input — do NOT re-read context already gathered in the draft phase.
     - **Context gathering (supplement-first):** Only read additional context when draft + issue are insufficient.
       - If specific target files are unclear: `sdd-forge flow get context --search "<request text or issue title>" --raw`.
       - If project structure is still unclear: `sdd-forge flow get context <path> --raw` for specific files; `sdd-forge flow get context --raw` only as a last resort.
     - If guardrail articles for spec have NOT been loaded in this session: `sdd-forge flow get guardrail spec`. If output is non-empty, follow these principles. Skip if already present in context.
   - **Synthesize draft into spec, do not copy or fabricate:** Organize and abstract draft content rather than copying it directly. Do not invent content not present in the draft. Exception: if a draft policy contradicts the source code (verified in the verification step below), treat the spec correction as a `[CORRECTION]`, not a fabrication.
   - **Acknowledged guardrail exceptions:** If the spec intentionally chooses a design that may violate a guardrail article, record the guardrail id directly in `constraints[]`, `clarifications[].q` / `.a`, or `alternatives_considered[].option` / `.reason`. Do not use `design_principles`, approval notes, overview entries, task text, or other fields as an exception-acknowledgment surface. The draft gate remains strict: draft-time guardrail violations must be fixed directly or escalated; exception acknowledgments are a spec.json convention for later spec/implementation review context.
   - **Source verification step (when draft is the primary input):** When `draft.json` includes implementation policy references (file paths, function names, data structures) in `analysis.proposedApproach` or `qa[].answer`, cross-reference them against the actual source code. Read minimal source files only for that verification — do not re-read context already gathered in the draft phase.
     - **Recording convention for `[VERIFY]` and `[CORRECTION]` entries (shared):** Write a concise summary in `spec.json.overview.decisions[].text` (≤ 500 chars). Put detailed source references in `evidence` (≤ 1000 chars). Split into multiple decision entries when content overflows. Each entry keeps prefix-based identification.
     - If a draft policy matches the source: record a `[VERIFY]` entry summarising "checked draft policy / referenced file / result=match".
     - If a draft policy contradicts the source: prompt the user via Choice Format to confirm the correction (see "User confirmation" below). After approval, record a `[CORRECTION]` entry summarising "draft policy / referenced file / adopted correction".
   - **User confirmation when changing draft policy:** If you replace a draft implementation policy with a different approach, reject a draft requirement, or add a new requirement not present in the draft, present the change to the user via Choice Format `[1] approve / [2] revise / ...` before writing it to `spec.json`. Triggers do NOT include: simple wording changes, typo fixes, rationale additions, or specification of points the draft left vague without changing the core. Do not write any autoApprove branch logic in this prompt; under autoApprove the dispatcher auto-selects `[1]` per existing skill convention.
   - **Re-render after spec.json edits:** After updating `spec.json`, run `sdd-forge spec render --spec specs/<spec-id>` so `spec.md` reflects the new content. Do this before marking the spec step done and before the gate evaluates anything.
   - Fill spec.json fields: `goal`, `scope`, `constraints`, `requirements`, `acceptance_criteria`, `alternatives_considered` (if applicable).
   - **Requirement testability** (spec 249): each `requirements[]` entry may carry an optional `testable` boolean. Default behavior is testable (omit the field, or set `testable: true`). Set `testable: false` only when the requirement is inherently not verifiable through automated tests — for example, prompt rewrites, documentation updates, or configuration-only changes. Consumers (test step gate, retro static evaluation, review-test untested warning, AI prompt builders) treat `requirement.testable !== false` as testable. `testable: false` requirements are excluded from header coverage validation, retro test-result aggregation, and untested warnings; they appear in AI prompt requirement lists annotated with ` (testing not required)`.
     - Example:
       ```json
       { "id": "R5", "desc": "rewrite the test phase prompt to teach header convention", "priority": "must", "testable": false }
       ```
   - Generate `keywords`: an array of 5–15 English keywords derived from the spec content (goal, scope, requirements). These keywords are used by contextSearch for codebase relevance matching. Choose specific, concrete terms (function names, module names, domain concepts) over generic words.
   - If draft phase was done, transfer draft.json content to spec.json using the following field mapping:
     - `draft.json.analysis.problem` → `spec.json.background` (synthesize, do not copy verbatim)
     - `draft.json.qa[].evidence` → `spec.json.overview.decisions[].evidence` (for Q&A entries that resulted in design decisions)
     - `draft.json.qa[]` entries with `category: "constraints"` or `category: "implementation-targets"` → `spec.json.alternatives_considered[]` only when the answer explicitly records a rejected option.
     - `draft.json.qa[].why` → incorporate into `spec.json.overview.decisions[].text` as rationale
     - `draft.json.scopeVerification` → `spec.json.scope` (`{in, out}`)
     - `draft.json.impactOnExisting` → spec.md Impact on Existing Features section
     - `draft.json.openQuestions` → `spec.json.open_questions`

   ## Task Decomposition Rules

   `spec.json.tasks[]` must be populated. Each task shall address a single concern within the spec.

   - A task's `title` shall be expressible as one verb phrase (e.g. "Add auto-promote to sync"). Do not connect unrelated actions with "and" (e.g. "Add auto-promote and refactor tests").
   - Unrelated sub-changes shall be split into separate tasks. Tasks whose implementation_notes span unrelated modules without a shared concern shall be split.
   - If a task's acceptance contains multiple independent criteria that are not part of the same concern, each shall be split into its own task.

   Each task shall include:
   - `id` (required): identifier like `T-1`, `T-2`.
   - `title` (required): short verb-phrase name.
   - `goal` (required): 1–2 sentences stating what this task accomplishes.
   - `acceptance` (optional): bullet-style verifiable criteria.
   - `implementation_notes` (optional): design considerations, edge cases, files touched.
   - `test_strategy` (optional): what to test at what granularity (unit / integration).
   - `parent` (optional): parent task id for forest structure (null for root tasks).
   - `origin` (required): `"plan"` for plan-phase tasks.
   - `added_round` (required): 0 for initial tasks.
   - `status` (required): `"pending"` initially.

   Empty `tasks[]` or undefined `tasks` causes the spec gate to FAIL. The `task-single-responsibility` guardrail evaluates each task's concern singularity in phase `spec` and `task-spec`.

   - **On complete**: `sdd-forge flow set step spec done`
