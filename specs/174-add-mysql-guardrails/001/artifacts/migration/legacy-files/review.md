# Code Review Results

### [ ] 1. Remove Empty QA Template Stub
**File:** `specs/174-add-mysql-guardrails/qa.md`  
**Issue:** The file contains placeholder entries (`Q:` / `A:`) with no content, which is effectively dead documentation and adds maintenance noise.  
**Suggestion:** Either delete `qa.md` if unused, or replace placeholders with actual resolved clarifications already captured in `spec.md` to keep a single source of truth.

**Verdict:** REJECTED
**Reason:** `qa.md` is currently low-value, but deleting/changing it may break workflow expectations for spec artifacts; this is documentation cleanup with uncertain behavioral impact.

### [ ] 2. Deduplicate Repeated Gate Failure Records
**File:** `specs/174-add-mysql-guardrails/issue-log.json`  
**Issue:** Multiple `gate-draft` and `gate-impl` entries repeat near-identical content, making the log verbose and harder to audit.  
**Suggestion:** Normalize repeated failures into one entry per step with `attempts`, `latest_reason`, and optional `history` summary to reduce duplication and improve traceability.

**Verdict:** REJECTED
**Reason:** This changes the log shape from append-only event records to a normalized schema, which can break existing tooling/audit assumptions and historical trace fidelity.

### [x] 3. Extract Repeated NOTICE Read Logic in Tests
**File:** `specs/174-add-mysql-guardrails/tests/mysql-guardrails.test.js`  
**Issue:** The same `existsSync ? readFileSync : ""` pattern is repeated for mysql/webapp NOTICE checks, creating duplicated test code.  
**Suggestion:** Add a small helper (e.g., `readTextIfExists(filePath)`) and reuse it across NOTICE assertions to simplify the test and keep behavior consistent.

**Verdict:** APPROVED
**Reason:** A small `readTextIfExists()` helper removes clear duplication in test code and can preserve behavior exactly if it keeps the same fallback (`""`) semantics.

### [x] 4. Use Table-Driven Assertions for Guardrail Presence Checks
**File:** `specs/174-add-mysql-guardrails/tests/mysql-guardrails.test.js`  
**Issue:** Webapp guardrail ID checks are written as three separate near-identical tests, which is repetitive and harder to extend.  
**Suggestion:** Iterate over `WEBAPP_NEW_GUARDRAIL_IDS` and generate assertions in a loop (or a single assertion comparing sets) to eliminate duplication and make additions trivial.

**Verdict:** APPROVED
**Reason:** Converting repetitive presence checks to table-driven assertions improves maintainability and extensibility in tests without affecting product behavior.

### [ ] 5. Improve Ambiguous Variable Naming in Tests
**File:** `specs/174-add-mysql-guardrails/tests/mysql-guardrails.test.js`  
**Issue:** Names like `raw` are generic and reduce readability in a long test file with multiple JSON payloads.  
**Suggestion:** Rename to intent-revealing names such as `mysqlGuardrailDoc` / `webappGuardrailDoc` for clearer test intent and consistency with domain terminology.

**Verdict:** REJECTED
**Reason:** This is primarily cosmetic renaming; it does not materially improve correctness or behavior and should be deprioritized under a conservative bar.
