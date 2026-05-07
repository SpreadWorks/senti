   - If guardrail articles for the test phase have NOT been loaded in this session: `sdd-forge flow get guardrail test`. If output is non-empty, follow these principles when writing tests. Skip if already present in context.
   - If code changes exist, implementation verification test is required in principle.
   - AI decides the appropriate test type based on the project's test infrastructure (no separate test-type selection).
   - AI shares briefly which test framework will be used and what will be verified (not a separate approval gate).
   - **MUST: Decide test placement based on these criteria:**
     - **`tests/` (formal tests, run by `npm test`):** Public API / function interface contract tests, CLI command behavior specs, preset integrity checks — tests where breakage indicates a bug regardless of which spec introduced them.
     - **`specs/<spec>/tests/` (spec verification tests, NOT run by `npm test`):** Tests that only verify this spec's requirements are met, bug fix reproduction tests, temporary setup/integration verification. These are kept as history, not maintained long-term.
     - **Decision rule:** Ask "If a future change breaks this test, is that always a bug?" — YES → `tests/`, NO → `specs/<spec>/tests/`.
   - Write test code under `specs/<spec>/tests/`. Tests should fail initially (before implementation).
   - **Do NOT run tests here.** Test execution is centralized in the impl-phase `test-execute` step. The plan-phase test step writes test code only; verification of expected initial failures happens during impl-phase test-execute.
   - **MUST: If a test reveals a production code bug that is outside the current spec's scope**, record it in issue-log (`sdd-forge flow set issue-log --step test --reason "..."`) before adjusting the test to match current behavior. Do not silently fix or skip the test.
   - **MUST: Write a spec coverage header at the top of every spec verification test file.** This header replaces the legacy file-based mapping artifact (spec 249).
     - JS / TS / MJS files: `// spec: R1 R2 ...`
     - Markdown / YAML / shell files (future dcb2 runners): `# spec: R1 R2 ...`
     - Read the testable requirement IDs from `spec.json` (NOT `spec.md`, which does not render the `testable` flag). For each `requirements[]` entry where `testable !== false`, you must declare it in at least one test file's header.
     - Example (JS):
       ```javascript
       // spec: R1 R2 R4
       import { test } from "node:test";
       test("R1: parser accepts valid header", () => {});
       test("R2: ...", () => {});
       test("R4: ...", () => {});
       ```
     - **`R-N:` test name prefix is required.** Each requirement R-N declared in the header must have at least one `it(...)` or `test(...)` call whose name starts with `R-N:` in the same file.
     - Do **not** include `testable: false` requirements in the header.
   - **Validation contract** (enforced by `flow set step test done`): the command will fail with `Envelope.fail` (code: `TEST_HEADER_VALIDATION_FAILED`) if any of the following violations are found in `specs/<spec>/tests/*.{test,spec}.{js,ts,mjs}`:
     - missing header / unknown R-ID / malformed header / duplicate IDs / multiple headers in one file / `testable: false` ID in header / `# spec:` in `.js` / `.mjs` / `.ts` / header declares R-N without an `R-N:` test name in the same file / `R-N:` test name without a corresponding header declaration / a testable requirement uncovered by all headers.
     - Read `errors[].messages` and `data` from the Envelope to fix the violations and re-run.
   - **If no test environment**:
     - This escape path is only valid when **every** requirement has `testable: false` (e.g., docs-only or prompt-only specs). Otherwise spec-local tests with headers are required by the test-step gate.
     - When valid, AI performs spec-implementation alignment check after coding by comparing spec Requirements against actual code changes.
   - **If test environment needs to be set up**:
     - Treat as a separate spec (out of scope for current feature spec).
   - **On complete**:
     - `sdd-forge flow set step test done`
   - **After test step is done**:
     - Run `sdd-forge flow get prompt plan.complete` and present the choices.
     - **autoApprove transition:** If `autoApprove: true`, treat [1] as selected and continue the dispatcher loop into the implementation phase (no skill switch required).
     - **Note:** For test-only specs (no production code changes), the impl phase is automatically skipped in autoApprove mode by the dispatcher.
