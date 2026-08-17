# Test Design

### Test Design
- **TC-1: Shared helper returns normal IDs in order**
  - Type: unit
  - Input: `spec.json.requirements = [{id:"REQ-1"},{id:"REQ-2"}]`
  - Expected: Usable ID list is `["REQ-1","REQ-2"]` in first-seen order.

- **TC-2: Shared helper trims IDs**
  - Type: unit
  - Input: `requirements = [{id:"  REQ-1  "},{id:"\tREQ-2\n"}]`
  - Expected: Usable ID list is `["REQ-1","REQ-2"]`.

- **TC-3: Shared helper omits whitespace-only IDs**
  - Type: unit
  - Input: `requirements = [{id:"   "},{id:"\n\t"}]`
  - Expected: Usable ID list is empty.

- **TC-4: Shared helper de-duplicates duplicates**
  - Type: unit
  - Input: `requirements = [{id:"REQ-1"},{id:" REQ-1 "},{id:"REQ-2"},{id:"REQ-1"}]`
  - Expected: Usable ID list is `["REQ-1","REQ-2"]` (first-seen preserved).

- **TC-5: Shared helper handles missing/empty requirements**
  - Type: unit
  - Input: `spec.json` with `requirements` missing, then `requirements: []`
  - Expected: Usable ID list is empty for both.

- **TC-6: Shared helper tolerates malformed entries without new validation**
  - Type: unit
  - Input: `requirements` includes objects without `id`, non-string `id`, null entries, mixed with one valid string ID
  - Expected: No schema-validation error introduced; invalid entries ignored; valid trimmed IDs returned.

- **TC-7: task-impl source selection prefers spec.json when file-map is absent**
  - Type: integration
  - Input: Artifacts pass prechecks; no `file-map.json`; `spec.json` has usable IDs; `spec.md` has different markers
  - Expected: Gate enumerates requirement IDs from `spec.json` only.

- **TC-8: task-impl source selection prefers spec.json when file-map is present**
  - Type: integration
  - Input: Artifacts pass prechecks; valid `file-map.json` present; `spec.json` has usable IDs; `spec.md` has different markers
  - Expected: Gate enumerates requirement IDs from `spec.json`; `file-map.json` used only for per-requirement diff splitting.

- **TC-9: integration phase keeps existing artifact prechecks before source selection**
  - Type: integration
  - Input: Missing required gate artifact (precheck failure)
  - Expected: Existing precheck failure behavior remains; no requirement source-selection logic runs.

- **TC-10: integration phase uses shared source-selection rule after prechecks pass**
  - Type: integration
  - Input: Prechecks pass; `spec.json` has usable IDs
  - Expected: Integration uses same shared selection as task-impl and selects `spec.json`.

- **TC-11: fallback to spec.md when spec.json cannot be loaded**
  - Type: integration
  - Input: `spec.json` unreadable/missing; `spec.md` contains markers
  - Expected: Gate falls back to marker IDs from `spec.md`.

- **TC-12: fallback to spec.md when requirements is missing/empty**
  - Type: integration
  - Input: `spec.json` loads but `requirements` missing or empty; `spec.md` has markers
  - Expected: Gate falls back to `spec.md` marker IDs.

- **TC-13: fallback to spec.md when no trimmed usable IDs exist**
  - Type: integration
  - Input: `spec.json.requirements` entries exist but all IDs are empty/whitespace/invalid
  - Expected: Gate falls back to `spec.md` marker IDs.

- **TC-14: malformed or unreadable file-map does not trigger requirement-source fallback**
  - Type: integration
  - Input: `spec.json` has usable IDs; `file-map.json` malformed/unreadable
  - Expected: Requirement ID enumeration still comes from `spec.json`; file-map failure behavior stays unchanged from baseline.

- **TC-15: e2e accepts explicit spec.json-priority response ID (file-map absent)**
  - Type: acceptance
  - Input: task-impl scenario with `spec.json` usable IDs, no `file-map.json`; stub response ID explicitly matches `spec.json` ID
  - Expected: Gate accepts response.

- **TC-16: e2e rejects stale spec.md marker response (file-map absent)**
  - Type: acceptance
  - Input: same as TC-15, but stub response ID is stale marker from `spec.md`
  - Expected: Gate rejects response.

- **TC-17: e2e accept/reject pair with file-map present**
  - Type: acceptance
  - Input: task-impl scenario with `spec.json` usable IDs and `file-map.json` present; one run with matching `spec.json` ID, one run with stale `spec.md` ID
  - Expected: Matching `spec.json` ID accepted; stale `spec.md` ID rejected.

- **TC-18: source-selection tests use explicit per-case stub IDs and keep shared default response unchanged**
  - Type: unit
  - Input: Test fixtures for spec.json-priority and spec.md-fallback with explicit IDs; inspect shared `defaultPassResponse`
  - Expected: Each case uses explicit stub IDs; shared default `REQ-SPEC` remains unchanged.

- **TC-19: spec-local test placement and traceability headers**
  - Type: acceptance
  - Input: Test files added under `specs/252-spec-json-reqids-gate/tests/`
  - Expected: Each file includes `// spec: R<N>` header(s) and collectively covers helper + source-selection requirements.

- **TC-20: file-map scoping remains limited to diff splitting**
  - Type: integration
  - Input: Scenario matrix toggling file-map present/absent with same usable `spec.json` IDs
  - Expected: Requirement ID source decision is identical across matrix; only diff splitting behavior varies.

Test type balance: Unit `8`, Integration `9`, Acceptance `3` (heavy on unit/integration for logic correctness, with targeted e2e proofs for regression-critical behavior).
