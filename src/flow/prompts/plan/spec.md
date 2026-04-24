   - **On start**: `sdd-forge flow set step spec in_progress`
   - **Before writing spec**:
     - Read draft (if exists) and linked GitHub issue content. If draft was completed, treat it as the primary input — do NOT re-read context already gathered in the draft phase.
     - **Context gathering (supplement-first):** Only read additional context when draft + issue are insufficient.
       - If specific target files are unclear: `sdd-forge flow get context --search "<request text or issue title>" --raw`.
       - If project structure is still unclear: `sdd-forge flow get context <path> --raw` for specific files; `sdd-forge flow get context --raw` only as a last resort.
     - If guardrail articles for spec have NOT been loaded in this session: `sdd-forge flow get guardrail spec`. If output is non-empty, follow these principles. Skip if already present in context.
   - Fill Goal, Scope, Out of Scope, Requirements, Acceptance Criteria, Alternatives Considered (if applicable).
   - If draft phase was done, reflect draft Q&A and decisions in spec.md.

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
