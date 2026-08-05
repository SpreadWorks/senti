   <!-- include("/flow/prompts/partials/worker-artifact-handoff.md") -->
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
   - **Deep-read trigger:** If the linked Issue body is under 200 characters, read the relevant source code files directly from the execution checkout to build sufficient understanding before creating the checklist questions.
   - Create the declared `draft.json` payload with these required fields checked by draft-gate:
     - `devType` — enum: `feature` / `bugfix` / `refactor` / `docs` / `chore` / `test` / `other`
     - `goal` — non-empty string
     - `analysis` — `problem`, `proposedApproach`, and `validation` are all non-empty
     - `decisionMap` — arrays for `knownFacts`, `decisionPoints`, `resolvedByProjectRules`, `requiresUserJudgment`, and `deferredToSpec`
     - `qa` — entries conforming to the Draft QA Rules schema
     - `approval` — `{ approved: false, confirmedAt: "", notes: "" }`
   - Write the question list to the declared `draft.json` payload. The parent dispatcher proceeds to `draft-questions-review` after validation and publication.

   **Communication rules for the draft phase (when NOT autoApprove):**
   - Start by creating the full draft question list in `draft.json.qa[]` with `status: "pending"` and stable ids (`q1`, `q2`, ...). The `(n/N)` denominator is the number of pending plus approved questions in this list.
   - Do not ask or answer the draft questions in this step. The draft step only creates the initial question list.
   - **MUST: Every question to the user — including confirmations after applying user-requested changes — MUST use the Choice Format. No free-form questions. No exceptions.**
   - Use the shared category list from Draft QA Rules to check coverage.
   - **Before starting draft discussion**:
     1. Use the handoff `contextSnapshot.inputAuthority` entry as the authoritative Issue or request input. If an Issue is selected, display its number and body before the first question.
     2. **Context gathering (supplement-first):** Start from the immutable project overview and guardrail entries. If target files/modules are still unclear, inspect relevant source files directly in the execution checkout.
     3. Do not run nested Flow context, Issue, or guardrail commands; the parent materializes and binds those values before worker startup.
   - Fill draft.json fields for the initial question list:
     - `pending` / `approved`: follow the Draft QA Rules empty-field requirement.
     - `answered` / `dropped`: do not create these statuses while generating the initial question list. They are produced only after the one-shot question sanity check, when existing questions are actually answered or intentionally dropped.
   - When the initial question list is complete, proceed to `draft-questions-review`.
   - Write `draft.json` only to its exact handoff `payloadPath`, then run the exact handoff `sealCommand` once.
