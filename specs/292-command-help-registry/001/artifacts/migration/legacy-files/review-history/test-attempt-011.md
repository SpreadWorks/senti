# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/292-command-help-registry/test-coverage.json`

## Blocking Findings

### 1. Top-level registry test can pass with an adapter over the legacy static layout
**Target:** specs/292-command-help-registry/tests/core-help-registry.test.js R2
**Issue:** The R2 test only asserts that `help.commands` is not an array and that a registry-only fixture can be rendered. It does not prove the current static `src/help.js` layout is no longer the source of truth; an implementation could wrap or rename the static LAYOUT and still satisfy these assertions.
**Required change:** Add a spec-local assertion that mutates or supplies command metadata with changed section/summary/order for an existing command and verifies top-level help reflects that metadata, or otherwise asserts the rendered top-level model is derived from the registry entries rather than any static help layout.
**Why blocking:** R2's central acceptance requirement is migration away from the static help layout as source of truth. The current test leaves a static-layout-backed implementation able to pass without exercising the required production behavior.

### 2. Locale-specific top-level rendering is not covered
**Target:** specs/292-command-help-registry/tests/core-help-registry.test.js R7 and specs/292-command-help-registry/tests/help-metadata-model.test.js R5
**Issue:** The tests cover localized command help for `docs build`, but R7 requires locale-specific rendering across retained public help surfaces and R5 requires renderer locale resolution from metadata. There is no assertion that top-level help resolves localized summaries/help text through command metadata with fallback behavior.
**Required change:** Add a spec-local test that renders top-level help with a non-English locale and verifies localized metadata is used, plus fallback behavior when the locale is missing.
**Why blocking:** A renderer could implement locale fallback only for command-detail help while leaving top-level help hard-coded or English-only, and all current tests would still pass despite violating R5/R7.

### 3. Import-time side-effect test uses a command function that is never imported
**Target:** specs/292-command-help-registry/tests/help-metadata-model.test.js R8
**Issue:** The R8 test sets a flag inside `command: () => ...` and verifies rendering does not call it. That only checks run behavior is not invoked; it does not show help rendering reads metadata without importing command implementation modules or triggering import-time side effects.
**Required change:** Use a temporary command module or registry entry with observable import-time side effects and metadata available separately, then assert help rendering reads metadata without causing that side effect.
**Why blocking:** R8 specifically requires focused tests around import-time side-effect policy. The current test would pass even if the renderer eagerly imports command modules, as long as it does not call the exported command function.

### 4. Plugin metadata import side effects are not guarded
**Target:** specs/292-command-help-registry/tests/plugin-help-rendering.test.js R4/R12
**Issue:** The plugin help tests verify plugin `main` is not executed, but the plugin command module contains no import-time side effect. A help renderer that imports plugin command files while rendering metadata would still pass because only runtime behavior writes `plugin-main-called`.
**Required change:** Add an observable top-level side effect to the plugin command module or a separate fixture command, then assert plugin top-level, command, and subcommand help do not trigger it.
**Why blocking:** R4/R12 require plugin help to be metadata-backed and R8 covers side-effect-safe metadata reads. Without this, plugin help could still execute import-time plugin code during help rendering and pass the spec-local tests.


## Advisory Findings

### 1. R1 metadata shape is only sampled on one command
**Target:** specs/292-command-help-registry/tests/help-metadata-model.test.js R1
**Improvement:** Iterate over the full core help model and assert each public leaf/namespace exposes the required renderer-ready fields, while keeping the existing `docs build` focused assertions for subcommand structure.
**Why non-blocking:** Other tests cover presence and rendering for many commands, so this is a coverage depth improvement rather than an immediate static blocker.
