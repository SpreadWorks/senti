   **Draft scope boundary (creation-time guidance — moved from gate evaluation):** Draft is RFP/requirements level only. Mentioning file paths or function names as context is permitted. Do not describe internal algorithms, data structures, control flow, or API design. Code references within the `evidence`, `why`, `considered`, and `answer` fields of QA entries are permitted as justification and do not constitute implementation details. This rule used to be enforced as a gate guardrail (`draft-scope-boundary`) but is now creation-time guidance — follow it while authoring `draft.json`.

   **Note on subsequent task decomposition:** 後続の spec 段階で要件を **concern 単位** にタスク分解する。draft は要件レベルの議論に留め、スコープは Issue or request の境界に従う。タスク分解の粒度制約は後続の `task-single-responsibility` guardrail (phase=[spec, task-spec]) で評価される。

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
     "scopeVerification": {
       "in": ["item 1", "item 2"],
       "out": ["item 1"]
     },
     "impactOnExisting": ["affected feature 1", "affected feature 2"],
     "qa": [
       {
         "question": "the question asked",
         "answer": "the answer given",
         "evidence": "code reference, grep result, or doc citation that supports the answer",
         "why": "rationale for this decision",
         "considered": "alternative approaches that were evaluated and rejected"
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
   Before generating each question, the AI MUST:
   1. **Research**: read relevant source code, docs, or prior specs to gather facts.
   2. **Self-verify**: check whether the question's premise is correct based on gathered facts.
   3. **Generate**: only then formulate the question, citing the evidence found.
   Do NOT ask questions based on assumptions. If investigation reveals the answer, state it directly instead of asking.

   **Communication rules:**
   - Questions MUST be written in the language specified by `config.lang`. Do not mix languages within a single question.
   - When using a technical term for the first time, add a 1-2 line definition or explanation.
   - Each question MUST be self-contained — understandable without reading prior conversation turns.

   **autoApprove mode — self-Q&A draft:**
   When `autoApprove: true`, the AI conducts the draft phase autonomously:
   - Do NOT ask the user questions. Instead, answer them yourself.
   - Use Issue content (if linked), `docs/` chapters, guardrail articles, and source code as input.
   - Fill the `analysis` object first, then work through the requirements checklist:
     1. Goal & Scope — Is the goal clear? Is scope bounded?
     2. Impact on existing — What existing features/code/tests are affected?
     3. Constraints — Non-functional requirements, guardrails, project rules?
     4. Edge cases — Boundary conditions, error cases?
     5. Test strategy — What to test and how?
     6. Alternatives considered — What other approaches were evaluated? Why was this one chosen?
     7. Future extensibility — How does this change affect future modifications or extensions?
     8. Consumer contracts — Are there rules that consumers of the introduced interfaces or data structures must follow?
   - **Deep-read trigger:** If the linked Issue body is under 200 characters, read the relevant source code files directly (via Read tool or `sdd-forge flow get context <path> --raw`) to build sufficient understanding before answering the checklist questions.
   - **MUST: draft.json は `flow prepare` 実行時に skeleton が自動生成される。** 生成済みのファイルのフィールドを埋める形で記入する（ファイルを上書き作成しない）。以下の必須フィールドを含む（gate-draft で検証される）:
     - `devType` — enum: `feature` / `bugfix` / `refactor` / `docs` / `chore` / `test` / `other`
     - `goal` — 非空文字列
     - `analysis` — `problem`, `proposedApproach`, `validation` が全て非空
     - `qa` — 配列（Q&A エントリ。判断を伴う Q&A では `evidence` が非空であること）
     - `approval` — `{ approved: true, confirmedAt: "...", notes: "..." }`
   - Write the completed draft.json and proceed to spec.
   - Mark draft as approved: `approval.approved = true`, `approval.notes = "autoApprove"`

   **Communication rules for the draft phase (when NOT autoApprove):**
   - **ALL turns MUST end with a question.** The AI must never end a turn without asking the user something.
   - Add progress display `(n/N)` at the start of each question. Get `n` from `sdd-forge flow get qa-count`. `N` is the AI's estimate of remaining questions.
   - After each question: `sdd-forge flow set metric draft question`
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
   - Fill draft.json fields progressively during the Q&A. Record each Q&A exchange as an entry in the `qa` array with `evidence`, `why`, and `considered` fields where applicable.
   - AI presents choices/proposals → user selects with short answers.
   - Ask ONE question at a time (do not batch questions, do not self-answer).
   - If a question leads to digression:
     1. Try to resolve in ONE exchange.
     2. If unresolved, record in `openQuestions` and move on.
     3. Open Questions are resolved during spec filling or implementation.
   - When requirements are sufficiently defined, proceed to the next step (review-draft handles approval).
   - Transfer Q&A and decisions to spec (step 7).
   - Keep `draft.json` in `specs/` (do not delete).
   - **On complete**: `sdd-forge flow set step draft done`
