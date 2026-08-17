# Spec Review Results

## Verdict: FAIL

## Blocking Findings

### 1. Bulk candidate planning lacks a non-mutating integration point
**Target:** R1/R2, Overview Data Flow, src/lib/plugin-registry.js:837
**Issue:** The spec requires displaying installed-plugin update candidates before confirmation and before any package state changes, but the verified existing helper named in the spec context, syncInstalledPlugins(root, { update: true }), resolves and immediately calls installFromSource before returning previousCommit/updated metadata. findPluginCandidates is also not a replacement because it lists installable source candidates rather than installed package update candidates.
**Required change:** Specify a non-mutating installed-plugin update planning path in src/lib/plugin-registry.js, or explicitly require splitting the existing bulk update into plan and apply phases, with plugin.js displaying the plan before applying it only after accepted confirmation.
**Why blocking:** Without this correction, the natural implementation target mutates plugin config/files before the prompt, violating the no-update-before-confirmation requirement and making AC1/AC2 impossible to test correctly.

### 2. Scope conflicts with existing disabled-package behavior
**Target:** R1/R2/R5/AC8, src/lib/plugin-registry.js:841
**Issue:** The spec repeatedly says bulk update checks or updates all installed plugins, while existing update-all behavior uses syncInstalledPlugins, which filters to packages where enabled !== false. R5 also says retained bulk behavior must migrate to update without args, so it is unclear whether disabled installed packages must remain excluded or now become update candidates.
**Required change:** State whether disabled installed plugin packages are excluded from bulk update candidates to preserve existing update-all behavior, or explicitly call out the intentional behavior change to include disabled packages.
**Why blocking:** Implementation and tests cannot determine whether a disabled installed package should be left untouched or updated, and choosing the wrong behavior either breaks retained behavior or fails the new all-installed wording.

### 3. JSON-mode confirmation stream is unspecified
**Target:** R2/AC2/AC8, src/plugin.js outputPluginOperationWithUpgrade
**Issue:** Existing plugin operations support --json by writing machine-parseable JSON to stdout. The spec requires a bulk confirmation prompt and also preserves JSON output fields, but it does not say where the prompt is written or how --json output remains parseable.
**Required change:** Specify the confirmation prompt/output channel for --json bulk updates, for example prompt and refusal/status text on stderr while stdout remains the final JSON object.
**Why blocking:** If the prompt is printed to stdout, --json output becomes invalid; if it is suppressed or embedded differently, tests and consumers cannot know the intended contract.


## Non-blocking Improvements

No non-blocking improvements.