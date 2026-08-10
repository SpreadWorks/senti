   <!-- include("/flow/prompts/partials/worker-artifact-handoff.md") -->
   - If guardrail articles for the test phase have NOT been loaded in this session: `sennel flow get guardrail test`. If output is non-empty, follow these principles when writing tests. Skip if already present in context.
   - If code changes exist, implementation verification test is required in principle.
   - AI decides the appropriate test framework based on the project's test infrastructure (no separate test-type selection).
   - AI shares briefly which test framework will be used and what will be verified (not a separate approval gate).
   - This plan step produces only the handoff `spec-tests` payload tree (published to the configured spec test directory and not run by `npm test`). These tests verify this spec's requirements, bug reproduction, or temporary setup/integration behavior and are kept as history.
   - Formal project tests belong to the implementation path and remain in the execution checkout. Do not include them in the handoff or write them to the canonical main checkout from this step.
   - Write spec verification test code only under the exact handoff `spec-tests` payload path. Never create or modify `.raw`; it is reserved for command-owned execution evidence. Tests should fail initially (before implementation).
   - Every generated test module must load successfully before implementation. Do not use a static import for a production module or named export that does not exist yet. For a future export on an existing module, import the module namespace and assert the export inside the `R-N:` test. For a future module, use a caught dynamic import and turn only the expected missing module into an `R-N:` assertion failure; rethrow unrelated resolution, syntax, and runtime errors.
   - Tests must verify only implementation surfaces fixed by `spec.json` or an existing public API. Do not invent a module path, export, function, constant, method, or artifact shape merely to make a requirement concrete. If the spec intentionally leaves placement or naming open, verify the observable behavior through a declared stable surface.
   - When `context.planGateRepair.phase` is `test`, this is a governed scenario-validity repair. Treat every frozen blocking observation and `scenario-validity-result.json` input as mandatory evidence, replace the invalid premise in the complete spec-test payload, and preserve unaffected requirement coverage. Do not seal an unchanged test tree.
   - When `context.testReviewRepair` is present, this is a governed semantic `test-review` repair. Treat its frozen blocking findings, source review evidence, and source test revision as mandatory inputs. Replace each blocking test-design premise in the complete `spec-tests` payload, preserve unaffected requirement coverage, and do not seal an unchanged tree. `test-review.json` and `test-coverage.json` remain command-owned and must not be written by this worker.
   - **Do NOT run tests here.** The plan-phase `test` step writes test code only. `plan/scenario-validity` verifies expected pre-implementation failures, `plan/test-review` performs static anti-pattern review, post-implementation spec-local verification stays in `impl/test-execute`, and full project regression stays in `impl/final-regression`.
   - **MUST: If a test reveals a production code bug that is outside the current spec's scope**, do not silently fix or skip the test. Include the finding in the worker report so the parent can surface it without the worker mutating canonical Flow state.
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
   - **Validation contract** (enforced by parent handoff reconciliation before publication and completion): the handoff is rejected with `FLOW_ARTIFACT_HANDOFF_INVALID` if any of the following violations are found in the declared test payload tree:
     - missing header / unknown R-ID / malformed header / duplicate IDs / multiple headers in one file / `testable: false` ID in header / `# spec:` in `.js` / `.mjs` / `.ts` / header declares R-N without an `R-N:` test name in the same file / `R-N:` test name without a corresponding header declaration / a testable requirement uncovered by all headers.
     - a static relative import resolves to no pre-implementation module in the execution checkout or the declared spec-test payload.
     - Read the returned validation message, fix the payload, and dispatch the guarded action again.
   - **If no test environment**:
     - This escape path is only valid when **every** requirement has `testable: false` (e.g., docs-only or prompt-only specs). Otherwise spec-local tests with headers are required by the test-step gate.
     - When valid, AI performs spec-implementation alignment check after coding by comparing spec Requirements against actual code changes.
   - **If test environment needs to be set up**:
     - Treat as a separate spec (out of scope for current feature spec).
   - **On complete**:
     - Run the exact handoff `sealCommand` once after every test payload is complete.
   - **After test step is done**:
     - Continue to `plan/scenario-validity`. Do not run `plan/test-review` or implementation until scenario-validity has passed.
