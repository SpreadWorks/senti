---
name: sdd-forge.flow-impl
description: Run the SDD implementation workflow. Use for coding, review iteration, and finalization after planning is complete.
---

# SDD Flow Impl

Run this workflow after the planning phase (flow-plan) is complete. This skill covers implementation, review iteration, and finalization.

## Core Principle

<!-- include("@templates/partials/core-principle.md") -->

## Flow Progress Tracking

<!-- include("@templates/partials/flow-tracking.md") -->

Available step IDs (this skill): `implement`, `gate-impl`, `review`, `finalize`
Available status values: `pending`, `in_progress`, `done`, `skipped`

## Context Recording (Compaction Resilience)

<!-- include("@templates/partials/context-recording.md") -->

## Metric Recording (Read Tool)

**MUST: When reading files directly with the Read tool (not via `sdd-forge flow get context`), record the metric:**
- After reading `docs/` files: `sdd-forge flow set metric impl docsRead`
- After reading `src/` files: `sdd-forge flow set metric impl srcRead`

Note: `sdd-forge flow get context` automatically records these metrics via hooks — manual recording is only needed for direct Read tool usage.

## Choice Format

<!-- include("@templates/partials/choice-format.md") -->

## Prerequisites

Before starting, run `sdd-forge flow get check impl` to verify prerequisites.
- If PASS, proceed to step 1.
- If FAIL, inform the user which steps are incomplete and stop.

## Required Sequence

1. Implement changes.
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
   - Run tests to verify: use the test command from `package.json` scripts or the project's test runner.
   - **MUST: If test failures are caused by pre-existing bugs (not the current spec's changes)**, record them in issue-log (`sdd-forge flow set issue-log --step implement --reason "..."`) before applying a workaround or adjusting the test.
   - **Retry limit for test fixes: 5 attempts.** If tests do not pass after 5 fix-and-rerun cycles, STOP and return control to the user.
   - **On complete**:
     - Run guardrail lint check: `sdd-forge flow run lint`. If violations are found, fix them before proceeding. If lint passes with no guardrail articles defined, this is normal — proceed.
     - `sdd-forge flow set step implement done`

2. Run gate impl (after implementation, BEFORE review).
   - `sdd-forge flow run gate --phase task-impl` (step status is automatically managed by hooks: pre sets gate-impl to in_progress, post sets done on PASS)
   - Checks spec requirements against `git diff baseBranch...HEAD` + guardrail compliance via AI.
   - If FAIL (`data.result === "fail"`): show ALL failures from `data.artifacts.reasons`. Fix using only the failure reasons and `git diff baseBranch...HEAD` — do NOT re-read the full spec, context, or guardrail. Re-run gate.
   - **Retry limit: 5 attempts.** If gate does not PASS after 5 fix-and-rerun cycles, STOP and return control to the user.
   - Do not proceed until PASS (`data.result === "pass"`).

3. Review implementation.
   - Step status is automatically managed by `sdd-forge flow run review` hooks (pre sets in_progress, post sets done).
   - Present review policy:
     ```
     ──────────────────────────────────────────────────────────
       コードレビューの方針を選択してください。
     ──────────────────────────────────────────────────────────

       [1] コードレビューを行い改善を自動で行う
       [2] コードレビューのみ
       [3] しない

     ```
     - 3 → `sdd-forge flow set step review skipped` → Step 3

   **Option 1 (auto-fix):**
   - Run `sdd-forge flow run review` to perform AI-powered code review.
   - **If proposals exist** (APPROVED items in review.md):
     1. Display review summary:
        ```
        コードレビューの結果、N 件の修正案が見つかりました。
        うち N 件を適用すべきと判断しました。

        適用する修正案:
          #2: <title>
              問題: <なぜこれが問題なのか>
              修正: <どう修正するか>

        対応不要と判断:
          #1: <title>
              理由: <対応不要な理由>
        ```
     2. Apply approved fixes automatically.
     3. Re-run tests to confirm no regressions.
   - **If no proposals** (NO_PROPOSALS):
     - Display: "レビューの結果、修正の必要はありませんでした。"
   - **Retry limit for review: 3 rounds.** If review keeps producing new proposals after 3 review-fix-review cycles, STOP and return control to the user.
   - Proceed to Step 3.

   **Option 2 (review-only):**
   - Run `sdd-forge flow run review` to get all proposals.
   - Present each proposal **one at a time** with `(n/N)` progress display.
   - For each proposal, show concisely:
     - Problem
     - Proposed fix
     - Whether it is needed for this spec
   - End each proposal with a question:
     ```
     ──────────────────────────────────────────────────────────
       (n/N) この指摘に対する対応を選択してください。
     ──────────────────────────────────────────────────────────

       [1] 適用する
       [2] 適用しない
       [3] 修正方針を変える

     ```
   - **Do NOT apply fixes yet** — collect all user responses first.
   - After all proposals are reviewed, apply only the approved ones in bulk.
   - Re-run tests to confirm no regressions.
   - Proceed to Step 3.

3b. Re-run gate impl (after review, BEFORE finalize).
   - Run `sdd-forge flow run gate --phase task-impl` to re-validate that review's auto-corrections have not broken spec requirements or guardrail compliance.
   - If FAIL (`data.result === "fail"`): show ALL failures from `data.artifacts.reasons`. Fix using only the failure reasons and `git diff baseBranch...HEAD` — do NOT re-read the full spec, context, or guardrail. Re-run gate.
   - **Retry limit: 5 attempts.** If gate does not PASS after 5 fix-and-rerun cycles, STOP and return control to the user.
   - If review was skipped (step 3 chose option 3), skip this step as well.

4. Final confirmation before finalize.
   - Present:
     ```
     ──────────────────────────────────────────────────────────
       実装とレビューが完了しました。次の操作を選択してください。
     ──────────────────────────────────────────────────────────

       [1] 承認する
       [2] 実装内容の概要を確認する
       [3] 実装内容を詳細に確認する
       [4] その他

     ```
   - **Option 1 (approve):** Immediately invoke `/sdd-forge.flow-finalize` using the Skill tool.
   - **autoApprove transition:** If `autoApprove: true`, treat [1] as selected and invoke `/sdd-forge.flow-finalize` using the Skill tool.
   - **Option 2 (overview):** Run `sdd-forge flow run impl-confirm --mode overview`. Display:
     - Changed files list
     - Summary of major changes
     - Whether any changes are outside spec scope
     - Test/verification results
     Then return to this choice prompt.
   - **Option 3 (detail):** Run `sdd-forge flow run impl-confirm --mode detail`. Present requirement-by-requirement:
     - Which spec requirement it addresses
     - Changed files
     - Implementation summary
     - Whether any changes are outside spec scope
     Then return to this choice prompt.
   - **Option 4 (other):** Ask what the user wants to do.
   - Step status for finalize is automatically managed by `sdd-forge flow run impl-confirm` / `sdd-forge flow run finalize` hooks.

## Worktree Mode

<!-- include("@templates/partials/worktree-mode.md") -->
- Before merge, consider running `git rebase <baseBranch>` in the worktree to incorporate upstream changes and avoid post-merge test failures.

## Hard Stops

- Do not implement before gate PASS and test phase completion.
- Do not write any code before the approach plan is approved by the user.
- Do not finalize without asking the user.
- Do not proceed to next step without user confirmation.

**autoApprove exception:** When `autoApprove: true`, the rules "do not finalize without asking the user" and "do not proceed to next step without user confirmation" do NOT apply. All other hard stops remain in effect.

## Issue Log Recording

<!-- include("@templates/partials/issue-log-recording.md") -->

## Commands

```bash
sdd-forge flow get guardrail <draft|spec|impl|lint>
sdd-forge flow get status
sdd-forge flow get check impl
sdd-forge flow set step <id> <val>
sdd-forge flow set req <index> <val>
sdd-forge flow set note "<text>"
sdd-forge flow set issue-log --step <id> --reason "<text>" [--trigger "<text>"] [--resolution "<text>"] [--guardrail-candidate "<text>"]
sdd-forge flow set metric <phase> <counter>
sdd-forge flow run review
sdd-forge flow run impl-confirm --mode <overview|detail>
sdd-forge snapshot check
```
