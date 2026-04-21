   - **On start**: `sdd-forge flow set step draft in_progress`

   **autoApprove mode — self-Q&A draft:**
   When `autoApprove: true`, the AI conducts the draft phase autonomously:
   - Do NOT ask the user questions. Instead, answer them yourself.
   - Use Issue content (if linked), `docs/` chapters, guardrail articles, and source code as input.
   - Work through the requirements checklist systematically:
     1. Goal & Scope — Is the goal clear? Is scope bounded?
     2. Impact on existing — What existing features/code/tests are affected?
     3. Constraints — Non-functional requirements, guardrails, project rules?
     4. Edge cases — Boundary conditions, error cases?
     5. Test strategy — What to test and how?
     6. Alternatives considered — What other approaches were evaluated? Why was this one chosen?
     7. Future extensibility — How does this change affect future modifications or extensions?
   - **Deep-read trigger:** If the linked Issue body is under 200 characters, read the relevant source code files directly (via Read tool or `sdd-forge flow get context <path> --raw`) to build sufficient understanding before answering the checklist questions.
   - **MUST: draft.md に以下の必須フィールドを含めること（gate-draft で検証される）:**
     - `**開発種別:** ...` — ラベル+コロンの太字形式。見出し形式（`## 開発種別`）では検出されない。英語の場合は `**Development Type:** ...`
     - `**目的:** ...` — ラベル+コロンの太字形式。見出し形式（`## 目的`）では検出されない。英語の場合は `**Goal:** ...`
     - `## Q&A` — `##` レベルの見出し。`###` やインラインテキストでは検出されない。
     - `- [x] User approved this draft` — チェック済みチェックボックスの正確な構文。
   - Write the completed draft to `draft.md` and proceed to spec.
   - Mark draft as approved: `- [x] User approved this draft (autoApprove)`

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
   - **Before starting draft discussion**:
     1. **If a GitHub Issue number is linked** (saved in flow.json via `--issue`):
        Fetch the issue content with `sdd-forge flow get issue <number>` and display the title and body before the first question.
        Use the issue content as context for the draft discussion.
     2. **Context gathering (supplement-first):** Build understanding in tiers — stop as soon as sufficient. Do NOT re-read material already in context.
        - If target files/modules are not yet in context: `sdd-forge flow get context --search "<request text or issue title>" --raw` using the request or issue title as the query.
        - If project structure is still unclear after search: `sdd-forge flow get context --raw` for a broad overview.
     3. If guardrail articles have NOT been loaded in this session: `sdd-forge flow get guardrail draft`. If output is non-empty, consider these principles as constraints. Skip if already present in context.
   - Create `specs/NNN-xxx/draft.md` in the spec directory created in step 4. Record the Q1 exchange (AI summary + user's `[1]` confirmation) as the first Q&A entry.
   - AI presents choices/proposals → user selects with short answers.
   - Ask ONE question at a time (do not batch questions, do not self-answer).
   - If a question leads to digression:
     1. Try to resolve in ONE exchange.
     2. If unresolved, record in Open Questions and move on.
     3. Open Questions are resolved during spec filling or implementation.
   - **MUST: draft.md に以下の必須フィールドを含めること（gate-draft で検証される）:**
     - `**開発種別:** ...` or `**Development Type:** ...` — ラベル+コロン太字形式
     - `**目的:** ...` or `**Goal:** ...` — ラベル+コロン太字形式
     - `## Q&A` — `##` レベルの見出し
     - `- [x] User approved this draft` — チェック済みチェックボックス
   - When requirements are sufficiently defined, ask the user for approval.
   - Update draft.md with `- [x] User approved this draft` and confirmation date.
   - Transfer Q&A and decisions to spec (step 7).
   - Keep `draft.md` in `specs/` (do not delete).
   - **On complete**: `sdd-forge flow set step draft done`
