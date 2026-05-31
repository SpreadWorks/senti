   <!-- include("/flow/prompts/partials/draft-qa-rules.md") -->

   **Note on subsequent task decomposition:** The spec step decomposes requirements by concern. Keep draft discussion at the requirement level and keep scope within the Issue or request boundary. Task decomposition granularity is evaluated later by the `task-single-responsibility` guardrail (phase=[spec, task-spec]).

   **Draft artifact format: draft.json**
   The draft artifact is a JSON file (`draft.json`), not markdown. The AI writes structured JSON directly.

   **Communication rules:**
   - Questions MUST be written in the language specified by `config.lang`. Do not mix languages within a single question.
   - When using a technical term for the first time, add a 1-2 line definition or explanation.
   - Each question MUST be self-contained — understandable without reading prior conversation turns.

   **autoApprove mode — autonomous question-list draft:**
   When `autoApprove: true`, the AI conducts the draft phase autonomously:
   - Do NOT ask the user questions in the draft step.
   - Do NOT answer draft questions yourself. Create the question list with `status: "pending"` and follow the Draft QA Rules empty-field requirement.
   - Use Issue content (if linked), `docs/` chapters, guardrail articles, and source code as input.
   - Follow Draft QA Rules premise validation before creating pending questions for requirement areas that need user judgment. Use the shared category list from Draft QA Rules.
   - **Deep-read trigger:** If the linked Issue body is under 200 characters, read the relevant source code files directly (via Read tool or `sdd-forge flow get context <path> --raw`) to build sufficient understanding before creating the checklist questions.
   - **MUST: draft.json is created as a skeleton by `flow prepare`.** Fill the existing fields; do not recreate the file from scratch. Required fields checked by draft-gate:
     - `devType` — enum: `feature` / `bugfix` / `refactor` / `docs` / `chore` / `test` / `other`
     - `goal` — non-empty string
     - `analysis` — `problem`, `proposedApproach`, and `validation` are all non-empty
     - `decisionMap` — arrays for `knownFacts`, `decisionPoints`, `resolvedByProjectRules`, `requiresUserJudgment`, and `deferredToSpec`
     - `qa` — entries conforming to the Draft QA Rules schema
     - `approval` — `{ approved: false, confirmedAt: "", notes: "" }`
   - Write the draft.json question list and proceed to `draft-questions-review`.

   **Communication rules for the draft phase (when NOT autoApprove):**
   - Start by creating the full draft question list in `draft.json.qa[]` with `status: "pending"` and stable ids (`q1`, `q2`, ...). The `(n/N)` denominator is the number of pending plus approved questions in this list.
   - Do not ask or answer the draft questions in this step. The draft step only creates the initial question list.
   - **MUST: Every question to the user — including confirmations after applying user-requested changes — MUST use the Choice Format. No free-form questions. No exceptions.**
   - Use the shared category list from Draft QA Rules to check coverage.
   - **Before starting draft discussion**:
     1. **If a GitHub Issue number is linked** (saved in flow.json via `--issue`):
        Fetch the issue content with `sdd-forge flow get issue <number>` and display the title and body before the first question.
        Use the issue content as context for the draft discussion.
     2. **Context gathering (supplement-first):** Build understanding in tiers — stop as soon as sufficient. Do NOT re-read material already in context.
        - If target files/modules are not yet in context: `sdd-forge flow get context --search "<request text or issue title>" --raw` using the request or issue title as the query.
        - If project structure is still unclear after search: `sdd-forge flow get context --raw` for a broad overview.
     3. If guardrail articles have NOT been loaded in this session: `sdd-forge flow get guardrail draft`. If output is non-empty, consider these principles as constraints. Skip if already present in context.
   - Fill draft.json fields for the initial question list:
     - `pending` / `approved`: follow the Draft QA Rules empty-field requirement.
     - `answered` / `dropped`: do not create these statuses while generating the initial question list. They are produced only after the one-shot question sanity check, when existing questions are actually answered or intentionally dropped.
   - When the initial question list is complete, proceed to `draft-questions-review`.
   - Keep `draft.json` in `specs/` (do not delete).
   - **On complete**: `sdd-forge flow set step draft done`
