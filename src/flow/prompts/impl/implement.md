   - Read the spec to understand requirements.
   - **Test-only spec detection (autoApprove mode):** If the spec's Goal, Scope, and Requirements indicate that only tests are being added (no production code changes), and `autoApprove: true`:
     1. Set `sdd-forge flow set step implement skipped`.
     2. **Do NOT skip `test-execute`, `test-result-review`, or the flow-level `gate-impl`.** They run regardless because the spec's tests still need execution, artifact review, and regression gate validation.
     3. The dispatcher promotes `test-execute` next.
     4. Display: "auto: test-only spec detected — implement skipped; test-execute will run"
     - If unsure whether the spec is test-only, proceed with normal implementation (err on the side of caution).
   - **Context gathering (supplement-first):** Build understanding in tiers — stop as soon as sufficient. Do NOT re-read material already in context.
     1. The spec (just read above) and test files from the plan phase are the primary inputs. Proceed if they are sufficient.
     2. If target files are not yet in context: `sdd-forge flow get context --search "<spec goal>" --raw` using the spec's Goal section as the query.
     3. If project structure is still unclear after step 2: `sdd-forge flow get context --raw` for a broad overview; then `sdd-forge flow get context <path> --raw` for specific files.
     4. If guardrail articles have NOT been loaded in this session: `sdd-forge flow get guardrail integration` for flow-level implementation work, or `sdd-forge flow get guardrail task-impl` for per-task work. The alias `impl` resolves to `task-impl` for compatibility. If output is non-empty, follow these principles. Skip if already present in context.
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
     - If [2]: incorporate feedback, revise the plan, re-present. **Retry limit:** bounded by the definition's maxAttempts.
     - **If `autoApprove: true`**: present the approach briefly, then auto-select [1] and proceed. Display: "auto: approach confirmed → proceeding to implementation"
   - Code only after confirming gate PASS, test phase completion, and approach approval.
   - Aim to make tests pass.
   - **Update requirements as you go**: `sdd-forge flow set req <index> done` for each completed requirement.
   - **Do NOT run tests in this step.** Test execution is centralized in the `test-execute` step that runs after `implement` completes. Implement code so it is self-consistent; the dispatcher will invoke `test-execute` next.
   - **Prepare/docs scan hard stop:** if preparation or later execution reports that `.sdd-forge/output/analysis.json` cannot be created, read, or validated, stop through the normal flow error path. Do not mask it with manual `flow set step`.
   - **v2 test artifact contract:** `test-execute` produces `test-execute-result.json` version `"2"` and raw output. Started project regression failures still create a normal artifact and advance to `test-result-review`; prerequisite failures before the command starts are hard stops and must be fixed before rerunning.
   - **Placeholder artifact permission:** do not write hand-made placeholder test artifacts to satisfy the flow. If real execution is unavailable, use the `placeholder-permission.json` contract documented in the flow skill; without explicit user permission, flow-level `gate-impl` rejects placeholder artifacts with `ARTIFACT_PLACEHOLDER`.
   - **MUST: If implementation reveals a pre-existing bug outside the current spec's scope**, record it in issue-log (`sdd-forge flow set issue-log --step implement --reason "..."`) before adjusting the spec or applying a workaround.
   - **On complete**:
     - Run guardrail lint check: `sdd-forge flow run lint`. If violations are found, fix them before proceeding. If lint passes with no guardrail articles defined, this is normal — proceed.
     - `sdd-forge flow set step implement done`
