   - **On start**: `sdd-forge flow set step implement in_progress`
   - Read the spec to understand requirements.
   - **Test-only spec detection (autoApprove mode):** If the spec's Goal, Scope, and Requirements indicate that only tests are being added (no production code changes), and `autoApprove: true`:
     1. Set `sdd-forge flow set step implement skipped`
     2. Set `sdd-forge flow set step gate-impl skipped`
     3. Skip to step 3 (review).
     4. Display: "auto: test-only spec detected — impl phase skipped"
     - If unsure whether the spec is test-only, proceed with normal implementation (err on the side of caution).
   - **Context gathering (supplement-first):** Build understanding in tiers — stop as soon as sufficient. Do NOT re-read material already in context.
     1. The spec (just read above) and test files from the plan phase are the primary inputs. Proceed if they are sufficient.
     2. If target files are not yet in context: `sdd-forge flow get context --search "<spec goal>" --raw` using the spec's Goal section as the query.
     3. If project structure is still unclear after step 2: `sdd-forge flow get context --raw` for a broad overview; then `sdd-forge flow get context <path> --raw` for specific files.
     4. If guardrail articles have NOT been loaded in this session: `sdd-forge flow get guardrail impl`. If output is non-empty, follow these principles. Skip if already present in context.
   - **Before writing any code**, present an implementation approach and obtain approval:
     - For each spec requirement, describe:
       - **方針 (Approach):** how you plan to implement it
       - **既存コード (Existing code):** which existing modules/functions/patterns you will reuse (or "none")
       - **設計判断 (Design decision):** any meaningful architectural choice being made (function signature, pattern selection, data structure)
     - Omit routine additions that follow an existing pattern with no design decision.
     - Example format:
       ```
       実装方針:

       Req 1: <requirement text>
         方針: <how to implement>
         既存コード: <what existing code is reused>
         設計判断: <architectural choice, or "なし">

       Req 2: <requirement text>
         方針: <how to implement>
         既存コード: <what existing code is reused>
         設計判断: <architectural choice, or "なし">
       ```
     - Present with:
       ```
       ──────────────────────────────────────────────────────────
         実装方針を確認してください。
       ──────────────────────────────────────────────────────────

         [1] この方針で進める
         [2] 変更したい（→ 何を変えるか教えてください）

       ```
     - If [2]: incorporate feedback, revise the plan, re-present. **Retry limit: 3 rounds.**
     - **If `autoApprove: true`**: present the approach briefly, then auto-select [1] and proceed. Display: "auto: approach confirmed → proceeding to implementation"
   - Code only after confirming gate PASS, test phase completion, and approach approval.
   - Aim to make tests pass.
   - **Update requirements as you go**: `sdd-forge flow set req <index> done` for each completed requirement.
   - Run `npm test` to verify existing tests pass. Run spec tests with `node --test specs/<spec>/tests/*.test.js` to verify spec requirements are met.
   - **MUST: If test failures are caused by pre-existing bugs (not the current spec's changes)**, record them in issue-log (`sdd-forge flow set issue-log --step implement --reason "..."`) before applying a workaround or adjusting the test.
   - **Retry limit for test fixes: 5 attempts.** If tests do not pass after 5 fix-and-rerun cycles, STOP and return control to the user.
   - **On complete**:
     - Run guardrail lint check: `sdd-forge flow run lint`. If violations are found, fix them before proceeding. If lint passes with no guardrail articles defined, this is normal — proceed.
     - `sdd-forge flow set step implement done`
