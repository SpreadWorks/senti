   **Draft scope boundary (creation-time guidance):** Draft is RFP/requirements level only. Mentioning file paths or function names as context is permitted. Do not describe internal algorithms, data structures, control flow, or API design. Code references within the `evidence`, `why`, and `answer` fields of QA entries are permitted as justification and do not constitute implementation details.

   **Note on subsequent task decomposition:** The spec step decomposes requirements by concern. Keep draft discussion at the requirement level and keep scope within the Issue or request boundary. Task decomposition granularity is evaluated later by the `task-single-responsibility` guardrail (phase=[spec, task-spec]).

   **Draft artifact format: draft.json**
   The draft artifact is a JSON file (`draft.json`), not markdown. The AI writes structured JSON directly.

   **draft.json schema:**
   ```json
   {
     "devType": "feature | bugfix | refactor | docs | chore | test | other",
     "goal": "1-2 sentence description of what this change achieves",
     "analysis": {
       "problem": "the actual problem being solved (not just what was requested)",
       "proposedApproach": "the proposed solution approach",
       "validation": "whether the approach addresses the root problem"
     },
     "decisionMap": {
       "knownFacts": ["facts discovered from issue, docs, project rules, or source code"],
       "decisionPoints": ["design decisions the spec must cover"],
       "resolvedByProjectRules": ["decisions already determined by project rules or existing code patterns"],
       "requiresUserJudgment": ["decision points that require a user answer and should map to qa[]"],
       "deferredToSpec": ["details that do not require user judgment and can be finalized during spec writing"]
     },
     "scopeVerification": {
       "in": ["item 1", "item 2"],
       "out": ["item 1"]
     },
     "impactOnExisting": ["affected feature 1", "affected feature 2"],
     "qa": [
       {
         "id": "q1",
         "status": "pending | approved | answered | dropped",
         "category": "goal-confirmation | impact-scope | acceptance-criteria | constraint-non-goal | risk-migration-policy | user-visible-behavior | dependency-integration-boundary | implementation-policy | follow-up-coverage",
         "question": "the question asked",
         "answer": "the answer given",
         "evidence": "code reference, grep result, or doc citation that supports the answer",
         "why": "rationale for this decision",
         "droppedReason": "why this question was intentionally dropped"
       }
     ],
     "openQuestions": [],
     "approval": {
       "approved": false,
       "confirmedAt": "",
       "notes": ""
     }
   }
   ```

   **Premise validation (analysis field — MANDATORY before Q&A):**
   Before starting the Q&A, the AI MUST fill the `analysis` object:
   1. Read the request/issue and identify what problem is actually being solved.
   2. State the proposed solution approach.
   3. Evaluate whether the approach addresses the root problem — not just the surface request.
   If the AI cannot fill `analysis` without more context, it MUST investigate (read code, search docs) before proceeding.

   **Research → self-verification → question generation (MANDATORY):**
   Before generating questions, the AI MUST first fill `decisionMap` from the request/issue, docs, project rules, and relevant source code. Use it to avoid discovering design topics later through review loops.
   The map should cover the domain-specific decisions needed for this change, including user-visible behavior, scope boundaries, data/artifact contracts, integration points, failure policy, migration policy, validation/gate behavior, and test strategy when relevant.
   Then, before generating each question, the AI MUST:
   1. **Research**: read relevant source code, docs, or prior specs to gather facts.
   2. **Self-verify**: check whether the question's premise is correct based on gathered facts.
   3. **Generate**: only then formulate the question, citing the evidence found.
   Do NOT ask questions based on assumptions. If investigation resolves the decision without user judgment, do not create that question and do not fill an answer yourself.
   The initial question list should be derived from `decisionMap.requiresUserJudgment`, not from a category quota.

   **Communication rules:**
   - Questions MUST be written in the language specified by `config.lang`. Do not mix languages within a single question.
   - When using a technical term for the first time, add a 1-2 line definition or explanation.
   - Each question MUST be self-contained — understandable without reading prior conversation turns.

   **autoApprove mode — autonomous question-list draft:**
   When `autoApprove: true`, the AI conducts the draft phase autonomously:
   - Do NOT ask the user questions in the draft step.
   - Do NOT answer draft questions yourself. Create the question list with `status: "pending"` and leave `answer`, `evidence`, `why`, and `droppedReason` as empty strings.
   - Use Issue content (if linked), `docs/` chapters, guardrail articles, and source code as input.
   - Fill the `analysis` object first, then create pending questions for requirement areas that need user judgment:
     1. Goal & Scope — Is the goal clear? Is scope bounded?
     2. Impact on existing — What existing features/code/tests are affected?
     3. Constraints — Non-functional requirements, guardrails, project rules?
     4. Edge cases — Boundary conditions, error cases?
     5. Test strategy — What to test and how?
     6. Alternatives considered — What other approaches were evaluated? Why was this one chosen?
     7. Future extensibility — How does this change affect future modifications or extensions?
     8. Consumer contracts — Are there rules that consumers of the introduced interfaces or data structures must follow?
   - **Deep-read trigger:** If the linked Issue body is under 200 characters, read the relevant source code files directly (via Read tool or `sdd-forge flow get context <path> --raw`) to build sufficient understanding before creating the checklist questions.
   - **MUST: draft.json is created as a skeleton by `flow prepare`.** Fill the existing fields; do not recreate the file from scratch. Required fields checked by gate-draft:
     - `devType` — enum: `feature` / `bugfix` / `refactor` / `docs` / `chore` / `test` / `other`
     - `goal` — non-empty string
     - `analysis` — `problem`, `proposedApproach`, and `validation` are all non-empty
     - `decisionMap` — arrays for `knownFacts`, `decisionPoints`, `resolvedByProjectRules`, `requiresUserJudgment`, and `deferredToSpec`
     - `qa` — entries with `id`, `status`, `category`, `question`, `answer`, `evidence`, `why`, and `droppedReason`
     - `approval` — `{ approved: false, confirmedAt: "", notes: "" }`
   - Write the draft.json question list and proceed to `review-draft-questions`.

   **Communication rules for the draft phase (when NOT autoApprove):**
   - Start by creating the full draft question list in `draft.json.qa[]` with `status: "pending"` and stable ids (`q1`, `q2`, ...). The `(n/N)` denominator is the number of pending plus approved questions in this list.
   - Do not ask or answer the draft questions in this step. The draft step only creates the initial question list.
   - **MUST: Every question to the user — including confirmations after applying user-requested changes — MUST use the Choice Format. No free-form questions. No exceptions.**
   - **Requirements category checklist** (AI uses internally to check coverage):
     1. Goal & Scope — Is the goal clear? Is scope bounded?
     2. Impact on existing — What existing features/code/tests are affected?
     3. Constraints — Non-functional requirements, guardrails, project rules?
     4. Edge cases — Boundary conditions, error cases?
     5. Test strategy — What to test and how?
     6. Alternatives considered — What other approaches were evaluated? Why was this one chosen?
     7. Future extensibility — How does this change affect future modifications or extensions?
     8. Consumer contracts — Are there rules that consumers of the introduced interfaces or data structures must follow?
   - **Before starting draft discussion**:
     1. **If a GitHub Issue number is linked** (saved in flow.json via `--issue`):
        Fetch the issue content with `sdd-forge flow get issue <number>` and display the title and body before the first question.
        Use the issue content as context for the draft discussion.
     2. **Context gathering (supplement-first):** Build understanding in tiers — stop as soon as sufficient. Do NOT re-read material already in context.
        - If target files/modules are not yet in context: `sdd-forge flow get context --search "<request text or issue title>" --raw` using the request or issue title as the query.
        - If project structure is still unclear after search: `sdd-forge flow get context --raw` for a broad overview.
     3. If guardrail articles have NOT been loaded in this session: `sdd-forge flow get guardrail draft`. If output is non-empty, consider these principles as constraints. Skip if already present in context.
   - Fill draft.json fields for the initial question list:
     - `pending` / `approved`: `answer`, `evidence`, `why`, and `droppedReason` are empty strings.
     - `answered` / `dropped`: do not create these statuses while generating the initial question list. They are produced only after the one-shot question sanity check, when existing questions are actually answered or intentionally dropped.
   - When the initial question list is complete, proceed to `review-draft-questions`.
   - Keep `draft.json` in `specs/` (do not delete).
   - **On complete**: `sdd-forge flow set step draft done`
