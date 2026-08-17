# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 1. Cache Preset Resolution Per Call
**Failure mode:** refactor
**File:** src/lib/presets.js
**Issue:** **File:** `src/lib/presets.js`
**Issue:** `resolveChain()` calls `allPresets(projectRoot)` repeatedly, including inside the parent traversal loop. `allPresets()` can load the plugin registry, so parent chains may trigger repeated registry work.
**Suggestion:** Compute once at the start of `resolveChain()` and reuse a `Map` by key for leaf and parent lookup.
**Suggestion:** **File:** `src/lib/presets.js`
**Issue:** `resolveChain()` calls `allPresets(projectRoot)` repeatedly, including inside the parent traversal loop. `allPresets()` can load the plugin registry, so parent chains may trigger repeated registry work.
**Suggestion:** Compute once at the start of `resolveChain()` and reuse a `Map` by key for leaf and parent lookup.
**Rationale:** Loop review proposal.

### 2. 2. Add Explicit Bounds To Recursive Default Merge
**Failure mode:** refactor
**File:** src/lib/config.js
**Issue:** **File:** `src/lib/config.js`
**Issue:** `mergeMissing()` recursively merges plugin defaults without an explicit depth bound. This violates the `bounded-resource-usage` guardrail for recursive processing.
**Suggestion:** Add a max merge depth, for example `mergeMissing(target, defaults, depth = 0)` with a constant such as `MAX_PLUGIN_DEFAULT_DEPTH`, and fail clearly when exceeded.
**Suggestion:** **File:** `src/lib/config.js`
**Issue:** `mergeMissing()` recursively merges plugin defaults without an explicit depth bound. This violates the `bounded-resource-usage` guardrail for recursive processing.
**Suggestion:** Add a max merge depth, for example `mergeMissing(target, defaults, depth = 0)` with a constant such as `MAX_PLUGIN_DEFAULT_DEPTH`, and fail clearly when exceeded.
**Rationale:** Loop review proposal.

### 3. 3. Bound Plugin Config Bulk Loading
**Failure mode:** refactor
**File:** src/lib/config.js
**Issue:** **File:** `src/lib/config.js`
**Issue:** `loadEnabledPluginConfig()` reads schema/default files for every enabled package with no explicit count or file-size bounds. A config with many packages or large contribution files can cause unbounded bulk loading.
**Suggestion:** Introduce limits such as `MAX_PLUGIN_PACKAGES`, `MAX_PLUGIN_CONFIG_FILE_BYTES`, and validate before reading/parsing contribution files.
**Suggestion:** **File:** `src/lib/config.js`
**Issue:** `loadEnabledPluginConfig()` reads schema/default files for every enabled package with no explicit count or file-size bounds. A config with many packages or large contribution files can cause unbounded bulk loading.
**Suggestion:** Introduce limits such as `MAX_PLUGIN_PACKAGES`, `MAX_PLUGIN_CONFIG_FILE_BYTES`, and validate before reading/parsing contribution files.
**Rationale:** Loop review proposal.

### 4. 4. Avoid Repeated Linear Preset Lookups
**Failure mode:** refactor
**File:** src/lib/presets.js
**Issue:** **File:** `src/lib/presets.js`
**Issue:** Preset lookups use repeated `.find()` calls over arrays. With plugin presets added, this pattern becomes noisier and less efficient.
**Suggestion:** Build a `Map` once in `allPresets()` or per resolver call, then use `presetByKey.get(key)` for project overlay, leaf, parent, and safe fallback lookups.
**Suggestion:** **File:** `src/lib/presets.js`
**Issue:** Preset lookups use repeated `.find()` calls over arrays. With plugin presets added, this pattern becomes noisier and less efficient.
**Suggestion:** Build a `Map` once in `allPresets()` or per resolver call, then use `presetByKey.get(key)` for project overlay, leaf, parent, and safe fallback lookups.
**Rationale:** Loop review proposal.

### 5. 5. Extract DataSource Class Normalization
**Failure mode:** refactor
**File:** src/docs/lib/data-source-loader.js
**Issue:** **File:** `src/docs/lib/data-source-loader.js`
**Issue:** The inline `Function.prototype.toString` class detection makes `loadDataSources()` harder to read and bakes a brittle distinction into the loop.
**Suggestion:** Extract a helper such as `resolveDataSourceClass(Source, container, filePath)` that handles class-vs-factory normalization and validation in one place.
**Suggestion:** **File:** `src/docs/lib/data-source-loader.js`
**Issue:** The inline `Function.prototype.toString` class detection makes `loadDataSources()` harder to read and bakes a brittle distinction into the loop.
**Suggestion:** Extract a helper such as `resolveDataSourceClass(Source, container, filePath)` that handles class-vs-factory normalization and validation in one place.
**Rationale:** Loop review proposal.

### 6. 1. Cache Preset Resolution Per Call
**Failure mode:** refactor
**File:** src/lib/presets.js
**Issue:** **File:** `src/lib/presets.js`
**Issue:** `resolveChain()` calls `allPresets(projectRoot)` repeatedly, including inside the parent traversal loop. `allPresets()` can load the plugin registry, so parent chains may trigger repeated registry work.
**Suggestion:** Compute once at the start of `resolveChain()` and reuse a `Map` by key for leaf and parent lookup.
**Suggestion:** **File:** `src/lib/presets.js`
**Issue:** `resolveChain()` calls `allPresets(projectRoot)` repeatedly, including inside the parent traversal loop. `allPresets()` can load the plugin registry, so parent chains may trigger repeated registry work.
**Suggestion:** Compute once at the start of `resolveChain()` and reuse a `Map` by key for leaf and parent lookup.
**Rationale:** Loop review proposal.

### 7. 2. Add Explicit Bounds To Recursive Default Merge
**Failure mode:** refactor
**File:** src/lib/config.js
**Issue:** **File:** `src/lib/config.js`
**Issue:** `mergeMissing()` recursively merges plugin defaults without an explicit depth bound. This violates the `bounded-resource-usage` guardrail for recursive processing.
**Suggestion:** Add a max merge depth, for example `mergeMissing(target, defaults, depth = 0)` with a constant such as `MAX_PLUGIN_DEFAULT_DEPTH`, and fail clearly when exceeded.
**Suggestion:** **File:** `src/lib/config.js`
**Issue:** `mergeMissing()` recursively merges plugin defaults without an explicit depth bound. This violates the `bounded-resource-usage` guardrail for recursive processing.
**Suggestion:** Add a max merge depth, for example `mergeMissing(target, defaults, depth = 0)` with a constant such as `MAX_PLUGIN_DEFAULT_DEPTH`, and fail clearly when exceeded.
**Rationale:** Loop review proposal.

### 8. 3. Bound Plugin Config Bulk Loading
**Failure mode:** refactor
**File:** src/lib/config.js
**Issue:** **File:** `src/lib/config.js`
**Issue:** `loadEnabledPluginConfig()` reads schema/default files for every enabled package with no explicit count or file-size bounds. A config with many packages or large contribution files can cause unbounded bulk loading.
**Suggestion:** Introduce limits such as `MAX_PLUGIN_PACKAGES`, `MAX_PLUGIN_CONFIG_FILE_BYTES`, and validate before reading/parsing contribution files.
**Suggestion:** **File:** `src/lib/config.js`
**Issue:** `loadEnabledPluginConfig()` reads schema/default files for every enabled package with no explicit count or file-size bounds. A config with many packages or large contribution files can cause unbounded bulk loading.
**Suggestion:** Introduce limits such as `MAX_PLUGIN_PACKAGES`, `MAX_PLUGIN_CONFIG_FILE_BYTES`, and validate before reading/parsing contribution files.
**Rationale:** Loop review proposal.

### 9. 4. Avoid Repeated Linear Preset Lookups
**Failure mode:** refactor
**File:** src/lib/presets.js
**Issue:** **File:** `src/lib/presets.js`
**Issue:** Preset lookups use repeated `.find()` calls over arrays. With plugin presets added, this pattern becomes noisier and less efficient.
**Suggestion:** Build a `Map` once in `allPresets()` or per resolver call, then use `presetByKey.get(key)` for project overlay, leaf, parent, and safe fallback lookups.
**Suggestion:** **File:** `src/lib/presets.js`
**Issue:** Preset lookups use repeated `.find()` calls over arrays. With plugin presets added, this pattern becomes noisier and less efficient.
**Suggestion:** Build a `Map` once in `allPresets()` or per resolver call, then use `presetByKey.get(key)` for project overlay, leaf, parent, and safe fallback lookups.
**Rationale:** Loop review proposal.

### 10. 5. Extract DataSource Class Normalization
**Failure mode:** refactor
**File:** src/docs/lib/data-source-loader.js
**Issue:** **File:** `src/docs/lib/data-source-loader.js`
**Issue:** The inline `Function.prototype.toString` class detection makes `loadDataSources()` harder to read and bakes a brittle distinction into the loop.
**Suggestion:** Extract a helper such as `resolveDataSourceClass(Source, container, filePath)` that handles class-vs-factory normalization and validation in one place.
**Suggestion:** **File:** `src/docs/lib/data-source-loader.js`
**Issue:** The inline `Function.prototype.toString` class detection makes `loadDataSources()` harder to read and bakes a brittle distinction into the loop.
**Suggestion:** Extract a helper such as `resolveDataSourceClass(Source, container, filePath)` that handles class-vs-factory normalization and validation in one place.
**Rationale:** Loop review proposal.

### 11. 5. Extract DataSource Class Normalization
**Failure mode:** refactor
**File:** src/docs/lib/data-source-loader.js
**Issue:** **File:** `src/docs/lib/data-source-loader.js`
**Issue:** The inline `Function.prototype.toString` class detection makes `loadDataSources()` harder to read and bakes a brittle distinction into the loop.
**Suggestion:** Extract a helper such as `resolveDataSourceClass(Source, container, filePath)` that handles class-vs-factory normalization and validation in one place.
**Suggestion:** **File:** `src/docs/lib/data-source-loader.js`
**Issue:** The inline `Function.prototype.toString` class detection makes `loadDataSources()` harder to read and bakes a brittle distinction into the loop.
**Suggestion:** Extract a helper such as `resolveDataSourceClass(Source, container, filePath)` that handles class-vs-factory normalization and validation in one place.
**Rationale:** Loop review proposal.

### 12. 1. Cache Preset Resolution Per Call
**Failure mode:** refactor
**File:** src/lib/presets.js
**Issue:** **File:** `src/lib/presets.js`
**Issue:** `resolveChain()` calls `allPresets(projectRoot)` repeatedly, including inside the parent traversal loop. `allPresets()` can load the plugin registry, so parent chains may trigger repeated registry work.
**Suggestion:** Compute once at the start of `resolveChain()` and reuse a `Map` by key for leaf and parent lookup.
**Suggestion:** **File:** `src/lib/presets.js`
**Issue:** `resolveChain()` calls `allPresets(projectRoot)` repeatedly, including inside the parent traversal loop. `allPresets()` can load the plugin registry, so parent chains may trigger repeated registry work.
**Suggestion:** Compute once at the start of `resolveChain()` and reuse a `Map` by key for leaf and parent lookup.
**Rationale:** Loop review proposal.

### 13. 2. Add Explicit Bounds To Recursive Default Merge
**Failure mode:** refactor
**File:** src/lib/config.js
**Issue:** **File:** `src/lib/config.js`
**Issue:** `mergeMissing()` recursively merges plugin defaults without an explicit depth bound. This violates the `bounded-resource-usage` guardrail for recursive processing.
**Suggestion:** Add a max merge depth, for example `mergeMissing(target, defaults, depth = 0)` with a constant such as `MAX_PLUGIN_DEFAULT_DEPTH`, and fail clearly when exceeded.
**Suggestion:** **File:** `src/lib/config.js`
**Issue:** `mergeMissing()` recursively merges plugin defaults without an explicit depth bound. This violates the `bounded-resource-usage` guardrail for recursive processing.
**Suggestion:** Add a max merge depth, for example `mergeMissing(target, defaults, depth = 0)` with a constant such as `MAX_PLUGIN_DEFAULT_DEPTH`, and fail clearly when exceeded.
**Rationale:** Loop review proposal.

### 14. 3. Bound Plugin Config Bulk Loading
**Failure mode:** refactor
**File:** src/lib/config.js
**Issue:** **File:** `src/lib/config.js`
**Issue:** `loadEnabledPluginConfig()` reads schema/default files for every enabled package with no explicit count or file-size bounds. A config with many packages or large contribution files can cause unbounded bulk loading.
**Suggestion:** Introduce limits such as `MAX_PLUGIN_PACKAGES`, `MAX_PLUGIN_CONFIG_FILE_BYTES`, and validate before reading/parsing contribution files.
**Suggestion:** **File:** `src/lib/config.js`
**Issue:** `loadEnabledPluginConfig()` reads schema/default files for every enabled package with no explicit count or file-size bounds. A config with many packages or large contribution files can cause unbounded bulk loading.
**Suggestion:** Introduce limits such as `MAX_PLUGIN_PACKAGES`, `MAX_PLUGIN_CONFIG_FILE_BYTES`, and validate before reading/parsing contribution files.
**Rationale:** Loop review proposal.

### 15. 4. Avoid Repeated Linear Preset Lookups
**Failure mode:** refactor
**File:** src/lib/presets.js
**Issue:** **File:** `src/lib/presets.js`
**Issue:** Preset lookups use repeated `.find()` calls over arrays. With plugin presets added, this pattern becomes noisier and less efficient.
**Suggestion:** Build a `Map` once in `allPresets()` or per resolver call, then use `presetByKey.get(key)` for project overlay, leaf, parent, and safe fallback lookups.
**Suggestion:** **File:** `src/lib/presets.js`
**Issue:** Preset lookups use repeated `.find()` calls over arrays. With plugin presets added, this pattern becomes noisier and less efficient.
**Suggestion:** Build a `Map` once in `allPresets()` or per resolver call, then use `presetByKey.get(key)` for project overlay, leaf, parent, and safe fallback lookups.
**Rationale:** Loop review proposal.

### 16. 5. Extract DataSource Class Normalization
**Failure mode:** refactor
**File:** src/docs/lib/data-source-loader.js
**Issue:** **File:** `src/docs/lib/data-source-loader.js`
**Issue:** The inline `Function.prototype.toString` class detection makes `loadDataSources()` harder to read and bakes a brittle distinction into the loop.
**Suggestion:** Extract a helper such as `resolveDataSourceClass(Source, container, filePath)` that handles class-vs-factory normalization and validation in one place.
**Suggestion:** **File:** `src/docs/lib/data-source-loader.js`
**Issue:** The inline `Function.prototype.toString` class detection makes `loadDataSources()` harder to read and bakes a brittle distinction into the loop.
**Suggestion:** Extract a helper such as `resolveDataSourceClass(Source, container, filePath)` that handles class-vs-factory normalization and validation in one place.
**Rationale:** Loop review proposal.

### 17. 2. Add Explicit Bounds To Recursive Default Merge
**Failure mode:** refactor
**File:** src/lib/config.js
**Issue:** **File:** `src/lib/config.js`
**Issue:** `mergeMissing()` recursively merges plugin defaults without an explicit depth bound. This violates the `bounded-resource-usage` guardrail for recursive processing.
**Suggestion:** Add a max merge depth, for example `mergeMissing(target, defaults, depth = 0)` with a constant such as `MAX_PLUGIN_DEFAULT_DEPTH`, and fail clearly when exceeded.
**Suggestion:** **File:** `src/lib/config.js`
**Issue:** `mergeMissing()` recursively merges plugin defaults without an explicit depth bound. This violates the `bounded-resource-usage` guardrail for recursive processing.
**Suggestion:** Add a max merge depth, for example `mergeMissing(target, defaults, depth = 0)` with a constant such as `MAX_PLUGIN_DEFAULT_DEPTH`, and fail clearly when exceeded.
**Rationale:** Loop review proposal.

### 18. 3. Bound Plugin Config Bulk Loading
**Failure mode:** refactor
**File:** src/lib/config.js
**Issue:** **File:** `src/lib/config.js`
**Issue:** `loadEnabledPluginConfig()` reads schema/default files for every enabled package with no explicit count or file-size bounds. A config with many packages or large contribution files can cause unbounded bulk loading.
**Suggestion:** Introduce limits such as `MAX_PLUGIN_PACKAGES`, `MAX_PLUGIN_CONFIG_FILE_BYTES`, and validate before reading/parsing contribution files.
**Suggestion:** **File:** `src/lib/config.js`
**Issue:** `loadEnabledPluginConfig()` reads schema/default files for every enabled package with no explicit count or file-size bounds. A config with many packages or large contribution files can cause unbounded bulk loading.
**Suggestion:** Introduce limits such as `MAX_PLUGIN_PACKAGES`, `MAX_PLUGIN_CONFIG_FILE_BYTES`, and validate before reading/parsing contribution files.
**Rationale:** Loop review proposal.

### 19. 1. Cache Preset Resolution Per Call
**Failure mode:** refactor
**File:** src/lib/presets.js
**Issue:** **File:** `src/lib/presets.js`
**Issue:** `resolveChain()` calls `allPresets(projectRoot)` repeatedly, including inside the parent traversal loop. `allPresets()` can load the plugin registry, so parent chains may trigger repeated registry work.
**Suggestion:** Compute once at the start of `resolveChain()` and reuse a `Map` by key for leaf and parent lookup.
**Suggestion:** **File:** `src/lib/presets.js`
**Issue:** `resolveChain()` calls `allPresets(projectRoot)` repeatedly, including inside the parent traversal loop. `allPresets()` can load the plugin registry, so parent chains may trigger repeated registry work.
**Suggestion:** Compute once at the start of `resolveChain()` and reuse a `Map` by key for leaf and parent lookup.
**Rationale:** Loop review proposal.

### 20. 4. Avoid Repeated Linear Preset Lookups
**Failure mode:** refactor
**File:** src/lib/presets.js
**Issue:** **File:** `src/lib/presets.js`
**Issue:** Preset lookups use repeated `.find()` calls over arrays. With plugin presets added, this pattern becomes noisier and less efficient.
**Suggestion:** Build a `Map` once in `allPresets()` or per resolver call, then use `presetByKey.get(key)` for project overlay, leaf, parent, and safe fallback lookups.
**Suggestion:** **File:** `src/lib/presets.js`
**Issue:** Preset lookups use repeated `.find()` calls over arrays. With plugin presets added, this pattern becomes noisier and less efficient.
**Suggestion:** Build a `Map` once in `allPresets()` or per resolver call, then use `presetByKey.get(key)` for project overlay, leaf, parent, and safe fallback lookups.
**Rationale:** Loop review proposal.

### 21. 1. Cache Preset Resolution Per Call
**Failure mode:** refactor
**File:** src/lib/presets.js
**Issue:** **File:** `src/lib/presets.js`
**Issue:** `resolveChain()` calls `allPresets(projectRoot)` repeatedly, including inside the parent traversal loop. `allPresets()` can load the plugin registry, so parent chains may trigger repeated registry work.
**Suggestion:** Compute once at the start of `resolveChain()` and reuse a `Map` by key for leaf and parent lookup.
**Suggestion:** **File:** `src/lib/presets.js`
**Issue:** `resolveChain()` calls `allPresets(projectRoot)` repeatedly, including inside the parent traversal loop. `allPresets()` can load the plugin registry, so parent chains may trigger repeated registry work.
**Suggestion:** Compute once at the start of `resolveChain()` and reuse a `Map` by key for leaf and parent lookup.
**Rationale:** Loop review proposal.

### 22. 2. Add Explicit Bounds To Recursive Default Merge
**Failure mode:** refactor
**File:** src/lib/config.js
**Issue:** **File:** `src/lib/config.js`
**Issue:** `mergeMissing()` recursively merges plugin defaults without an explicit depth bound. This violates the `bounded-resource-usage` guardrail for recursive processing.
**Suggestion:** Add a max merge depth, for example `mergeMissing(target, defaults, depth = 0)` with a constant such as `MAX_PLUGIN_DEFAULT_DEPTH`, and fail clearly when exceeded.
**Suggestion:** **File:** `src/lib/config.js`
**Issue:** `mergeMissing()` recursively merges plugin defaults without an explicit depth bound. This violates the `bounded-resource-usage` guardrail for recursive processing.
**Suggestion:** Add a max merge depth, for example `mergeMissing(target, defaults, depth = 0)` with a constant such as `MAX_PLUGIN_DEFAULT_DEPTH`, and fail clearly when exceeded.
**Rationale:** Loop review proposal.

### 23. 3. Bound Plugin Config Bulk Loading
**Failure mode:** refactor
**File:** src/lib/config.js
**Issue:** **File:** `src/lib/config.js`
**Issue:** `loadEnabledPluginConfig()` reads schema/default files for every enabled package with no explicit count or file-size bounds. A config with many packages or large contribution files can cause unbounded bulk loading.
**Suggestion:** Introduce limits such as `MAX_PLUGIN_PACKAGES`, `MAX_PLUGIN_CONFIG_FILE_BYTES`, and validate before reading/parsing contribution files.
**Suggestion:** **File:** `src/lib/config.js`
**Issue:** `loadEnabledPluginConfig()` reads schema/default files for every enabled package with no explicit count or file-size bounds. A config with many packages or large contribution files can cause unbounded bulk loading.
**Suggestion:** Introduce limits such as `MAX_PLUGIN_PACKAGES`, `MAX_PLUGIN_CONFIG_FILE_BYTES`, and validate before reading/parsing contribution files.
**Rationale:** Loop review proposal.

### 24. 4. Avoid Repeated Linear Preset Lookups
**Failure mode:** refactor
**File:** src/lib/presets.js
**Issue:** **File:** `src/lib/presets.js`
**Issue:** Preset lookups use repeated `.find()` calls over arrays. With plugin presets added, this pattern becomes noisier and less efficient.
**Suggestion:** Build a `Map` once in `allPresets()` or per resolver call, then use `presetByKey.get(key)` for project overlay, leaf, parent, and safe fallback lookups.
**Suggestion:** **File:** `src/lib/presets.js`
**Issue:** Preset lookups use repeated `.find()` calls over arrays. With plugin presets added, this pattern becomes noisier and less efficient.
**Suggestion:** Build a `Map` once in `allPresets()` or per resolver call, then use `presetByKey.get(key)` for project overlay, leaf, parent, and safe fallback lookups.
**Rationale:** Loop review proposal.

### 25. 5. Extract DataSource Class Normalization
**Failure mode:** refactor
**File:** src/docs/lib/data-source-loader.js
**Issue:** **File:** `src/docs/lib/data-source-loader.js`
**Issue:** The inline `Function.prototype.toString` class detection makes `loadDataSources()` harder to read and bakes a brittle distinction into the loop.
**Suggestion:** Extract a helper such as `resolveDataSourceClass(Source, container, filePath)` that handles class-vs-factory normalization and validation in one place.
**Suggestion:** **File:** `src/docs/lib/data-source-loader.js`
**Issue:** The inline `Function.prototype.toString` class detection makes `loadDataSources()` harder to read and bakes a brittle distinction into the loop.
**Suggestion:** Extract a helper such as `resolveDataSourceClass(Source, container, filePath)` that handles class-vs-factory normalization and validation in one place.
**Rationale:** Loop review proposal.

### 26. 1. Cache Preset Resolution Per Call
**Failure mode:** refactor
**File:** src/lib/presets.js
**Issue:** **File:** `src/lib/presets.js`
**Issue:** `resolveChain()` calls `allPresets(projectRoot)` repeatedly, including inside the parent traversal loop. `allPresets()` can load the plugin registry, so parent chains may trigger repeated registry work.
**Suggestion:** Compute once at the start of `resolveChain()` and reuse a `Map` by key for leaf and parent lookup.
**Suggestion:** **File:** `src/lib/presets.js`
**Issue:** `resolveChain()` calls `allPresets(projectRoot)` repeatedly, including inside the parent traversal loop. `allPresets()` can load the plugin registry, so parent chains may trigger repeated registry work.
**Suggestion:** Compute once at the start of `resolveChain()` and reuse a `Map` by key for leaf and parent lookup.
**Rationale:** Loop review proposal.

### 27. 2. Add Explicit Bounds To Recursive Default Merge
**Failure mode:** refactor
**File:** src/lib/config.js
**Issue:** **File:** `src/lib/config.js`
**Issue:** `mergeMissing()` recursively merges plugin defaults without an explicit depth bound. This violates the `bounded-resource-usage` guardrail for recursive processing.
**Suggestion:** Add a max merge depth, for example `mergeMissing(target, defaults, depth = 0)` with a constant such as `MAX_PLUGIN_DEFAULT_DEPTH`, and fail clearly when exceeded.
**Suggestion:** **File:** `src/lib/config.js`
**Issue:** `mergeMissing()` recursively merges plugin defaults without an explicit depth bound. This violates the `bounded-resource-usage` guardrail for recursive processing.
**Suggestion:** Add a max merge depth, for example `mergeMissing(target, defaults, depth = 0)` with a constant such as `MAX_PLUGIN_DEFAULT_DEPTH`, and fail clearly when exceeded.
**Rationale:** Loop review proposal.

### 28. 3. Bound Plugin Config Bulk Loading
**Failure mode:** refactor
**File:** src/lib/config.js
**Issue:** **File:** `src/lib/config.js`
**Issue:** `loadEnabledPluginConfig()` reads schema/default files for every enabled package with no explicit count or file-size bounds. A config with many packages or large contribution files can cause unbounded bulk loading.
**Suggestion:** Introduce limits such as `MAX_PLUGIN_PACKAGES`, `MAX_PLUGIN_CONFIG_FILE_BYTES`, and validate before reading/parsing contribution files.
**Suggestion:** **File:** `src/lib/config.js`
**Issue:** `loadEnabledPluginConfig()` reads schema/default files for every enabled package with no explicit count or file-size bounds. A config with many packages or large contribution files can cause unbounded bulk loading.
**Suggestion:** Introduce limits such as `MAX_PLUGIN_PACKAGES`, `MAX_PLUGIN_CONFIG_FILE_BYTES`, and validate before reading/parsing contribution files.
**Rationale:** Loop review proposal.

### 29. 4. Avoid Repeated Linear Preset Lookups
**Failure mode:** refactor
**File:** src/lib/presets.js
**Issue:** **File:** `src/lib/presets.js`
**Issue:** Preset lookups use repeated `.find()` calls over arrays. With plugin presets added, this pattern becomes noisier and less efficient.
**Suggestion:** Build a `Map` once in `allPresets()` or per resolver call, then use `presetByKey.get(key)` for project overlay, leaf, parent, and safe fallback lookups.
**Suggestion:** **File:** `src/lib/presets.js`
**Issue:** Preset lookups use repeated `.find()` calls over arrays. With plugin presets added, this pattern becomes noisier and less efficient.
**Suggestion:** Build a `Map` once in `allPresets()` or per resolver call, then use `presetByKey.get(key)` for project overlay, leaf, parent, and safe fallback lookups.
**Rationale:** Loop review proposal.

### 30. 5. Extract DataSource Class Normalization
**Failure mode:** refactor
**File:** src/docs/lib/data-source-loader.js
**Issue:** **File:** `src/docs/lib/data-source-loader.js`
**Issue:** The inline `Function.prototype.toString` class detection makes `loadDataSources()` harder to read and bakes a brittle distinction into the loop.
**Suggestion:** Extract a helper such as `resolveDataSourceClass(Source, container, filePath)` that handles class-vs-factory normalization and validation in one place.
**Suggestion:** **File:** `src/docs/lib/data-source-loader.js`
**Issue:** The inline `Function.prototype.toString` class detection makes `loadDataSources()` harder to read and bakes a brittle distinction into the loop.
**Suggestion:** Extract a helper such as `resolveDataSourceClass(Source, container, filePath)` that handles class-vs-factory normalization and validation in one place.
**Rationale:** Loop review proposal.

### 31. 1. Cache Preset Resolution Per Call
**Failure mode:** refactor
**File:** src/lib/presets.js
**Issue:** **File:** `src/lib/presets.js`
**Issue:** `resolveChain()` calls `allPresets(projectRoot)` repeatedly, including inside the parent traversal loop. `allPresets()` can load the plugin registry, so parent chains may trigger repeated registry work.
**Suggestion:** Compute once at the start of `resolveChain()` and reuse a `Map` by key for leaf and parent lookup.
**Suggestion:** **File:** `src/lib/presets.js`
**Issue:** `resolveChain()` calls `allPresets(projectRoot)` repeatedly, including inside the parent traversal loop. `allPresets()` can load the plugin registry, so parent chains may trigger repeated registry work.
**Suggestion:** Compute once at the start of `resolveChain()` and reuse a `Map` by key for leaf and parent lookup.
**Rationale:** Loop review proposal.

### 32. 2. Add Explicit Bounds To Recursive Default Merge
**Failure mode:** refactor
**File:** src/lib/config.js
**Issue:** **File:** `src/lib/config.js`
**Issue:** `mergeMissing()` recursively merges plugin defaults without an explicit depth bound. This violates the `bounded-resource-usage` guardrail for recursive processing.
**Suggestion:** Add a max merge depth, for example `mergeMissing(target, defaults, depth = 0)` with a constant such as `MAX_PLUGIN_DEFAULT_DEPTH`, and fail clearly when exceeded.
**Suggestion:** **File:** `src/lib/config.js`
**Issue:** `mergeMissing()` recursively merges plugin defaults without an explicit depth bound. This violates the `bounded-resource-usage` guardrail for recursive processing.
**Suggestion:** Add a max merge depth, for example `mergeMissing(target, defaults, depth = 0)` with a constant such as `MAX_PLUGIN_DEFAULT_DEPTH`, and fail clearly when exceeded.
**Rationale:** Loop review proposal.

### 33. 3. Bound Plugin Config Bulk Loading
**Failure mode:** refactor
**File:** src/lib/config.js
**Issue:** **File:** `src/lib/config.js`
**Issue:** `loadEnabledPluginConfig()` reads schema/default files for every enabled package with no explicit count or file-size bounds. A config with many packages or large contribution files can cause unbounded bulk loading.
**Suggestion:** Introduce limits such as `MAX_PLUGIN_PACKAGES`, `MAX_PLUGIN_CONFIG_FILE_BYTES`, and validate before reading/parsing contribution files.
**Suggestion:** **File:** `src/lib/config.js`
**Issue:** `loadEnabledPluginConfig()` reads schema/default files for every enabled package with no explicit count or file-size bounds. A config with many packages or large contribution files can cause unbounded bulk loading.
**Suggestion:** Introduce limits such as `MAX_PLUGIN_PACKAGES`, `MAX_PLUGIN_CONFIG_FILE_BYTES`, and validate before reading/parsing contribution files.
**Rationale:** Loop review proposal.

### 34. 4. Avoid Repeated Linear Preset Lookups
**Failure mode:** refactor
**File:** src/lib/presets.js
**Issue:** **File:** `src/lib/presets.js`
**Issue:** Preset lookups use repeated `.find()` calls over arrays. With plugin presets added, this pattern becomes noisier and less efficient.
**Suggestion:** Build a `Map` once in `allPresets()` or per resolver call, then use `presetByKey.get(key)` for project overlay, leaf, parent, and safe fallback lookups.
**Suggestion:** **File:** `src/lib/presets.js`
**Issue:** Preset lookups use repeated `.find()` calls over arrays. With plugin presets added, this pattern becomes noisier and less efficient.
**Suggestion:** Build a `Map` once in `allPresets()` or per resolver call, then use `presetByKey.get(key)` for project overlay, leaf, parent, and safe fallback lookups.
**Rationale:** Loop review proposal.

### 35. 5. Extract DataSource Class Normalization
**Failure mode:** refactor
**File:** src/docs/lib/data-source-loader.js
**Issue:** **File:** `src/docs/lib/data-source-loader.js`
**Issue:** The inline `Function.prototype.toString` class detection makes `loadDataSources()` harder to read and bakes a brittle distinction into the loop.
**Suggestion:** Extract a helper such as `resolveDataSourceClass(Source, container, filePath)` that handles class-vs-factory normalization and validation in one place.
**Suggestion:** **File:** `src/docs/lib/data-source-loader.js`
**Issue:** The inline `Function.prototype.toString` class detection makes `loadDataSources()` harder to read and bakes a brittle distinction into the loop.
**Suggestion:** Extract a helper such as `resolveDataSourceClass(Source, container, filePath)` that handles class-vs-factory normalization and validation in one place.
**Rationale:** Loop review proposal.

### 36. 1. Cache Preset Resolution Per Call
**Failure mode:** refactor
**File:** src/lib/presets.js
**Issue:** **File:** `src/lib/presets.js`
**Issue:** `resolveChain()` calls `allPresets(projectRoot)` repeatedly, including inside the parent traversal loop. `allPresets()` can load the plugin registry, so parent chains may trigger repeated registry work.
**Suggestion:** Compute once at the start of `resolveChain()` and reuse a `Map` by key for leaf and parent lookup.
**Suggestion:** **File:** `src/lib/presets.js`
**Issue:** `resolveChain()` calls `allPresets(projectRoot)` repeatedly, including inside the parent traversal loop. `allPresets()` can load the plugin registry, so parent chains may trigger repeated registry work.
**Suggestion:** Compute once at the start of `resolveChain()` and reuse a `Map` by key for leaf and parent lookup.
**Rationale:** Loop review proposal.

### 37. 2. Add Explicit Bounds To Recursive Default Merge
**Failure mode:** refactor
**File:** src/lib/config.js
**Issue:** **File:** `src/lib/config.js`
**Issue:** `mergeMissing()` recursively merges plugin defaults without an explicit depth bound. This violates the `bounded-resource-usage` guardrail for recursive processing.
**Suggestion:** Add a max merge depth, for example `mergeMissing(target, defaults, depth = 0)` with a constant such as `MAX_PLUGIN_DEFAULT_DEPTH`, and fail clearly when exceeded.
**Suggestion:** **File:** `src/lib/config.js`
**Issue:** `mergeMissing()` recursively merges plugin defaults without an explicit depth bound. This violates the `bounded-resource-usage` guardrail for recursive processing.
**Suggestion:** Add a max merge depth, for example `mergeMissing(target, defaults, depth = 0)` with a constant such as `MAX_PLUGIN_DEFAULT_DEPTH`, and fail clearly when exceeded.
**Rationale:** Loop review proposal.

### 38. 3. Bound Plugin Config Bulk Loading
**Failure mode:** refactor
**File:** src/lib/config.js
**Issue:** **File:** `src/lib/config.js`
**Issue:** `loadEnabledPluginConfig()` reads schema/default files for every enabled package with no explicit count or file-size bounds. A config with many packages or large contribution files can cause unbounded bulk loading.
**Suggestion:** Introduce limits such as `MAX_PLUGIN_PACKAGES`, `MAX_PLUGIN_CONFIG_FILE_BYTES`, and validate before reading/parsing contribution files.
**Suggestion:** **File:** `src/lib/config.js`
**Issue:** `loadEnabledPluginConfig()` reads schema/default files for every enabled package with no explicit count or file-size bounds. A config with many packages or large contribution files can cause unbounded bulk loading.
**Suggestion:** Introduce limits such as `MAX_PLUGIN_PACKAGES`, `MAX_PLUGIN_CONFIG_FILE_BYTES`, and validate before reading/parsing contribution files.
**Rationale:** Loop review proposal.

### 39. 4. Avoid Repeated Linear Preset Lookups
**Failure mode:** refactor
**File:** src/lib/presets.js
**Issue:** **File:** `src/lib/presets.js`
**Issue:** Preset lookups use repeated `.find()` calls over arrays. With plugin presets added, this pattern becomes noisier and less efficient.
**Suggestion:** Build a `Map` once in `allPresets()` or per resolver call, then use `presetByKey.get(key)` for project overlay, leaf, parent, and safe fallback lookups.
**Suggestion:** **File:** `src/lib/presets.js`
**Issue:** Preset lookups use repeated `.find()` calls over arrays. With plugin presets added, this pattern becomes noisier and less efficient.
**Suggestion:** Build a `Map` once in `allPresets()` or per resolver call, then use `presetByKey.get(key)` for project overlay, leaf, parent, and safe fallback lookups.
**Rationale:** Loop review proposal.

### 40. 5. Extract DataSource Class Normalization
**Failure mode:** refactor
**File:** src/docs/lib/data-source-loader.js
**Issue:** **File:** `src/docs/lib/data-source-loader.js`
**Issue:** The inline `Function.prototype.toString` class detection makes `loadDataSources()` harder to read and bakes a brittle distinction into the loop.
**Suggestion:** Extract a helper such as `resolveDataSourceClass(Source, container, filePath)` that handles class-vs-factory normalization and validation in one place.
**Suggestion:** **File:** `src/docs/lib/data-source-loader.js`
**Issue:** The inline `Function.prototype.toString` class detection makes `loadDataSources()` harder to read and bakes a brittle distinction into the loop.
**Suggestion:** Extract a helper such as `resolveDataSourceClass(Source, container, filePath)` that handles class-vs-factory normalization and validation in one place.
**Rationale:** Loop review proposal.

### 41. 1. Cache Preset Resolution Per Call
**Failure mode:** refactor
**File:** src/lib/presets.js
**Issue:** **File:** `src/lib/presets.js`
**Issue:** `resolveChain()` calls `allPresets(projectRoot)` repeatedly, including inside the parent traversal loop. `allPresets()` can load the plugin registry, so parent chains may trigger repeated registry work.
**Suggestion:** Compute once at the start of `resolveChain()` and reuse a `Map` by key for leaf and parent lookup.
**Suggestion:** **File:** `src/lib/presets.js`
**Issue:** `resolveChain()` calls `allPresets(projectRoot)` repeatedly, including inside the parent traversal loop. `allPresets()` can load the plugin registry, so parent chains may trigger repeated registry work.
**Suggestion:** Compute once at the start of `resolveChain()` and reuse a `Map` by key for leaf and parent lookup.
**Rationale:** Loop review proposal.

### 42. 2. Add Explicit Bounds To Recursive Default Merge
**Failure mode:** refactor
**File:** src/lib/config.js
**Issue:** **File:** `src/lib/config.js`
**Issue:** `mergeMissing()` recursively merges plugin defaults without an explicit depth bound. This violates the `bounded-resource-usage` guardrail for recursive processing.
**Suggestion:** Add a max merge depth, for example `mergeMissing(target, defaults, depth = 0)` with a constant such as `MAX_PLUGIN_DEFAULT_DEPTH`, and fail clearly when exceeded.
**Suggestion:** **File:** `src/lib/config.js`
**Issue:** `mergeMissing()` recursively merges plugin defaults without an explicit depth bound. This violates the `bounded-resource-usage` guardrail for recursive processing.
**Suggestion:** Add a max merge depth, for example `mergeMissing(target, defaults, depth = 0)` with a constant such as `MAX_PLUGIN_DEFAULT_DEPTH`, and fail clearly when exceeded.
**Rationale:** Loop review proposal.

### 43. 3. Bound Plugin Config Bulk Loading
**Failure mode:** refactor
**File:** src/lib/config.js
**Issue:** **File:** `src/lib/config.js`
**Issue:** `loadEnabledPluginConfig()` reads schema/default files for every enabled package with no explicit count or file-size bounds. A config with many packages or large contribution files can cause unbounded bulk loading.
**Suggestion:** Introduce limits such as `MAX_PLUGIN_PACKAGES`, `MAX_PLUGIN_CONFIG_FILE_BYTES`, and validate before reading/parsing contribution files.
**Suggestion:** **File:** `src/lib/config.js`
**Issue:** `loadEnabledPluginConfig()` reads schema/default files for every enabled package with no explicit count or file-size bounds. A config with many packages or large contribution files can cause unbounded bulk loading.
**Suggestion:** Introduce limits such as `MAX_PLUGIN_PACKAGES`, `MAX_PLUGIN_CONFIG_FILE_BYTES`, and validate before reading/parsing contribution files.
**Rationale:** Loop review proposal.

### 44. 4. Avoid Repeated Linear Preset Lookups
**Failure mode:** refactor
**File:** src/lib/presets.js
**Issue:** **File:** `src/lib/presets.js`
**Issue:** Preset lookups use repeated `.find()` calls over arrays. With plugin presets added, this pattern becomes noisier and less efficient.
**Suggestion:** Build a `Map` once in `allPresets()` or per resolver call, then use `presetByKey.get(key)` for project overlay, leaf, parent, and safe fallback lookups.
**Suggestion:** **File:** `src/lib/presets.js`
**Issue:** Preset lookups use repeated `.find()` calls over arrays. With plugin presets added, this pattern becomes noisier and less efficient.
**Suggestion:** Build a `Map` once in `allPresets()` or per resolver call, then use `presetByKey.get(key)` for project overlay, leaf, parent, and safe fallback lookups.
**Rationale:** Loop review proposal.

### 45. 5. Extract DataSource Class Normalization
**Failure mode:** refactor
**File:** src/docs/lib/data-source-loader.js
**Issue:** **File:** `src/docs/lib/data-source-loader.js`
**Issue:** The inline `Function.prototype.toString` class detection makes `loadDataSources()` harder to read and bakes a brittle distinction into the loop.
**Suggestion:** Extract a helper such as `resolveDataSourceClass(Source, container, filePath)` that handles class-vs-factory normalization and validation in one place.
**Suggestion:** **File:** `src/docs/lib/data-source-loader.js`
**Issue:** The inline `Function.prototype.toString` class detection makes `loadDataSources()` harder to read and bakes a brittle distinction into the loop.
**Suggestion:** Extract a helper such as `resolveDataSourceClass(Source, container, filePath)` that handles class-vs-factory normalization and validation in one place.
**Rationale:** Loop review proposal.

### 46. 1. Cache Preset Resolution Per Call
**Failure mode:** refactor
**File:** src/lib/presets.js
**Issue:** **File:** `src/lib/presets.js`
**Issue:** `resolveChain()` calls `allPresets(projectRoot)` repeatedly, including inside the parent traversal loop. `allPresets()` can load the plugin registry, so parent chains may trigger repeated registry work.
**Suggestion:** Compute once at the start of `resolveChain()` and reuse a `Map` by key for leaf and parent lookup.
**Suggestion:** **File:** `src/lib/presets.js`
**Issue:** `resolveChain()` calls `allPresets(projectRoot)` repeatedly, including inside the parent traversal loop. `allPresets()` can load the plugin registry, so parent chains may trigger repeated registry work.
**Suggestion:** Compute once at the start of `resolveChain()` and reuse a `Map` by key for leaf and parent lookup.
**Rationale:** Loop review proposal.

### 47. 2. Add Explicit Bounds To Recursive Default Merge
**Failure mode:** refactor
**File:** src/lib/config.js
**Issue:** **File:** `src/lib/config.js`
**Issue:** `mergeMissing()` recursively merges plugin defaults without an explicit depth bound. This violates the `bounded-resource-usage` guardrail for recursive processing.
**Suggestion:** Add a max merge depth, for example `mergeMissing(target, defaults, depth = 0)` with a constant such as `MAX_PLUGIN_DEFAULT_DEPTH`, and fail clearly when exceeded.
**Suggestion:** **File:** `src/lib/config.js`
**Issue:** `mergeMissing()` recursively merges plugin defaults without an explicit depth bound. This violates the `bounded-resource-usage` guardrail for recursive processing.
**Suggestion:** Add a max merge depth, for example `mergeMissing(target, defaults, depth = 0)` with a constant such as `MAX_PLUGIN_DEFAULT_DEPTH`, and fail clearly when exceeded.
**Rationale:** Loop review proposal.

### 48. 3. Bound Plugin Config Bulk Loading
**Failure mode:** refactor
**File:** src/lib/config.js
**Issue:** **File:** `src/lib/config.js`
**Issue:** `loadEnabledPluginConfig()` reads schema/default files for every enabled package with no explicit count or file-size bounds. A config with many packages or large contribution files can cause unbounded bulk loading.
**Suggestion:** Introduce limits such as `MAX_PLUGIN_PACKAGES`, `MAX_PLUGIN_CONFIG_FILE_BYTES`, and validate before reading/parsing contribution files.
**Suggestion:** **File:** `src/lib/config.js`
**Issue:** `loadEnabledPluginConfig()` reads schema/default files for every enabled package with no explicit count or file-size bounds. A config with many packages or large contribution files can cause unbounded bulk loading.
**Suggestion:** Introduce limits such as `MAX_PLUGIN_PACKAGES`, `MAX_PLUGIN_CONFIG_FILE_BYTES`, and validate before reading/parsing contribution files.
**Rationale:** Loop review proposal.

### 49. 4. Avoid Repeated Linear Preset Lookups
**Failure mode:** refactor
**File:** src/lib/presets.js
**Issue:** **File:** `src/lib/presets.js`
**Issue:** Preset lookups use repeated `.find()` calls over arrays. With plugin presets added, this pattern becomes noisier and less efficient.
**Suggestion:** Build a `Map` once in `allPresets()` or per resolver call, then use `presetByKey.get(key)` for project overlay, leaf, parent, and safe fallback lookups.
**Suggestion:** **File:** `src/lib/presets.js`
**Issue:** Preset lookups use repeated `.find()` calls over arrays. With plugin presets added, this pattern becomes noisier and less efficient.
**Suggestion:** Build a `Map` once in `allPresets()` or per resolver call, then use `presetByKey.get(key)` for project overlay, leaf, parent, and safe fallback lookups.
**Rationale:** Loop review proposal.

### 50. 5. Extract DataSource Class Normalization
**Failure mode:** refactor
**File:** src/docs/lib/data-source-loader.js
**Issue:** **File:** `src/docs/lib/data-source-loader.js`
**Issue:** The inline `Function.prototype.toString` class detection makes `loadDataSources()` harder to read and bakes a brittle distinction into the loop.
**Suggestion:** Extract a helper such as `resolveDataSourceClass(Source, container, filePath)` that handles class-vs-factory normalization and validation in one place.
**Suggestion:** **File:** `src/docs/lib/data-source-loader.js`
**Issue:** The inline `Function.prototype.toString` class detection makes `loadDataSources()` harder to read and bakes a brittle distinction into the loop.
**Suggestion:** Extract a helper such as `resolveDataSourceClass(Source, container, filePath)` that handles class-vs-factory normalization and validation in one place.
**Rationale:** Loop review proposal.

### 51. 1. Cache Preset Resolution Per Call
**Failure mode:** refactor
**File:** src/lib/presets.js
**Issue:** **File:** `src/lib/presets.js`
**Issue:** `resolveChain()` calls `allPresets(projectRoot)` repeatedly, including inside the parent traversal loop. `allPresets()` can load the plugin registry, so parent chains may trigger repeated registry work.
**Suggestion:** Compute once at the start of `resolveChain()` and reuse a `Map` by key for leaf and parent lookup.
**Suggestion:** **File:** `src/lib/presets.js`
**Issue:** `resolveChain()` calls `allPresets(projectRoot)` repeatedly, including inside the parent traversal loop. `allPresets()` can load the plugin registry, so parent chains may trigger repeated registry work.
**Suggestion:** Compute once at the start of `resolveChain()` and reuse a `Map` by key for leaf and parent lookup.
**Rationale:** Loop review proposal.

### 52. 2. Add Explicit Bounds To Recursive Default Merge
**Failure mode:** refactor
**File:** src/lib/config.js
**Issue:** **File:** `src/lib/config.js`
**Issue:** `mergeMissing()` recursively merges plugin defaults without an explicit depth bound. This violates the `bounded-resource-usage` guardrail for recursive processing.
**Suggestion:** Add a max merge depth, for example `mergeMissing(target, defaults, depth = 0)` with a constant such as `MAX_PLUGIN_DEFAULT_DEPTH`, and fail clearly when exceeded.
**Suggestion:** **File:** `src/lib/config.js`
**Issue:** `mergeMissing()` recursively merges plugin defaults without an explicit depth bound. This violates the `bounded-resource-usage` guardrail for recursive processing.
**Suggestion:** Add a max merge depth, for example `mergeMissing(target, defaults, depth = 0)` with a constant such as `MAX_PLUGIN_DEFAULT_DEPTH`, and fail clearly when exceeded.
**Rationale:** Loop review proposal.

### 53. 3. Bound Plugin Config Bulk Loading
**Failure mode:** refactor
**File:** src/lib/config.js
**Issue:** **File:** `src/lib/config.js`
**Issue:** `loadEnabledPluginConfig()` reads schema/default files for every enabled package with no explicit count or file-size bounds. A config with many packages or large contribution files can cause unbounded bulk loading.
**Suggestion:** Introduce limits such as `MAX_PLUGIN_PACKAGES`, `MAX_PLUGIN_CONFIG_FILE_BYTES`, and validate before reading/parsing contribution files.
**Suggestion:** **File:** `src/lib/config.js`
**Issue:** `loadEnabledPluginConfig()` reads schema/default files for every enabled package with no explicit count or file-size bounds. A config with many packages or large contribution files can cause unbounded bulk loading.
**Suggestion:** Introduce limits such as `MAX_PLUGIN_PACKAGES`, `MAX_PLUGIN_CONFIG_FILE_BYTES`, and validate before reading/parsing contribution files.
**Rationale:** Loop review proposal.

### 54. 4. Avoid Repeated Linear Preset Lookups
**Failure mode:** refactor
**File:** src/lib/presets.js
**Issue:** **File:** `src/lib/presets.js`
**Issue:** Preset lookups use repeated `.find()` calls over arrays. With plugin presets added, this pattern becomes noisier and less efficient.
**Suggestion:** Build a `Map` once in `allPresets()` or per resolver call, then use `presetByKey.get(key)` for project overlay, leaf, parent, and safe fallback lookups.
**Suggestion:** **File:** `src/lib/presets.js`
**Issue:** Preset lookups use repeated `.find()` calls over arrays. With plugin presets added, this pattern becomes noisier and less efficient.
**Suggestion:** Build a `Map` once in `allPresets()` or per resolver call, then use `presetByKey.get(key)` for project overlay, leaf, parent, and safe fallback lookups.
**Rationale:** Loop review proposal.

### 55. 5. Extract DataSource Class Normalization
**Failure mode:** refactor
**File:** src/docs/lib/data-source-loader.js
**Issue:** **File:** `src/docs/lib/data-source-loader.js`
**Issue:** The inline `Function.prototype.toString` class detection makes `loadDataSources()` harder to read and bakes a brittle distinction into the loop.
**Suggestion:** Extract a helper such as `resolveDataSourceClass(Source, container, filePath)` that handles class-vs-factory normalization and validation in one place.
**Suggestion:** **File:** `src/docs/lib/data-source-loader.js`
**Issue:** The inline `Function.prototype.toString` class detection makes `loadDataSources()` harder to read and bakes a brittle distinction into the loop.
**Suggestion:** Extract a helper such as `resolveDataSourceClass(Source, container, filePath)` that handles class-vs-factory normalization and validation in one place.
**Rationale:** Loop review proposal.

### 56. 1. Cache Preset Resolution Per Call
**Failure mode:** refactor
**File:** src/lib/presets.js
**Issue:** **File:** `src/lib/presets.js`
**Issue:** `resolveChain()` calls `allPresets(projectRoot)` repeatedly, including inside the parent traversal loop. `allPresets()` can load the plugin registry, so parent chains may trigger repeated registry work.
**Suggestion:** Compute once at the start of `resolveChain()` and reuse a `Map` by key for leaf and parent lookup.
**Suggestion:** **File:** `src/lib/presets.js`
**Issue:** `resolveChain()` calls `allPresets(projectRoot)` repeatedly, including inside the parent traversal loop. `allPresets()` can load the plugin registry, so parent chains may trigger repeated registry work.
**Suggestion:** Compute once at the start of `resolveChain()` and reuse a `Map` by key for leaf and parent lookup.
**Rationale:** Loop review proposal.

### 57. 2. Add Explicit Bounds To Recursive Default Merge
**Failure mode:** refactor
**File:** src/lib/config.js
**Issue:** **File:** `src/lib/config.js`
**Issue:** `mergeMissing()` recursively merges plugin defaults without an explicit depth bound. This violates the `bounded-resource-usage` guardrail for recursive processing.
**Suggestion:** Add a max merge depth, for example `mergeMissing(target, defaults, depth = 0)` with a constant such as `MAX_PLUGIN_DEFAULT_DEPTH`, and fail clearly when exceeded.
**Suggestion:** **File:** `src/lib/config.js`
**Issue:** `mergeMissing()` recursively merges plugin defaults without an explicit depth bound. This violates the `bounded-resource-usage` guardrail for recursive processing.
**Suggestion:** Add a max merge depth, for example `mergeMissing(target, defaults, depth = 0)` with a constant such as `MAX_PLUGIN_DEFAULT_DEPTH`, and fail clearly when exceeded.
**Rationale:** Loop review proposal.

### 58. 3. Bound Plugin Config Bulk Loading
**Failure mode:** refactor
**File:** src/lib/config.js
**Issue:** **File:** `src/lib/config.js`
**Issue:** `loadEnabledPluginConfig()` reads schema/default files for every enabled package with no explicit count or file-size bounds. A config with many packages or large contribution files can cause unbounded bulk loading.
**Suggestion:** Introduce limits such as `MAX_PLUGIN_PACKAGES`, `MAX_PLUGIN_CONFIG_FILE_BYTES`, and validate before reading/parsing contribution files.
**Suggestion:** **File:** `src/lib/config.js`
**Issue:** `loadEnabledPluginConfig()` reads schema/default files for every enabled package with no explicit count or file-size bounds. A config with many packages or large contribution files can cause unbounded bulk loading.
**Suggestion:** Introduce limits such as `MAX_PLUGIN_PACKAGES`, `MAX_PLUGIN_CONFIG_FILE_BYTES`, and validate before reading/parsing contribution files.
**Rationale:** Loop review proposal.

### 59. 4. Avoid Repeated Linear Preset Lookups
**Failure mode:** refactor
**File:** src/lib/presets.js
**Issue:** **File:** `src/lib/presets.js`
**Issue:** Preset lookups use repeated `.find()` calls over arrays. With plugin presets added, this pattern becomes noisier and less efficient.
**Suggestion:** Build a `Map` once in `allPresets()` or per resolver call, then use `presetByKey.get(key)` for project overlay, leaf, parent, and safe fallback lookups.
**Suggestion:** **File:** `src/lib/presets.js`
**Issue:** Preset lookups use repeated `.find()` calls over arrays. With plugin presets added, this pattern becomes noisier and less efficient.
**Suggestion:** Build a `Map` once in `allPresets()` or per resolver call, then use `presetByKey.get(key)` for project overlay, leaf, parent, and safe fallback lookups.
**Rationale:** Loop review proposal.

### 60. 5. Extract DataSource Class Normalization
**Failure mode:** refactor
**File:** src/docs/lib/data-source-loader.js
**Issue:** **File:** `src/docs/lib/data-source-loader.js`
**Issue:** The inline `Function.prototype.toString` class detection makes `loadDataSources()` harder to read and bakes a brittle distinction into the loop.
**Suggestion:** Extract a helper such as `resolveDataSourceClass(Source, container, filePath)` that handles class-vs-factory normalization and validation in one place.
**Suggestion:** **File:** `src/docs/lib/data-source-loader.js`
**Issue:** The inline `Function.prototype.toString` class detection makes `loadDataSources()` harder to read and bakes a brittle distinction into the loop.
**Suggestion:** Extract a helper such as `resolveDataSourceClass(Source, container, filePath)` that handles class-vs-factory normalization and validation in one place.
**Rationale:** Loop review proposal.

### 61. 1. Cache Preset Resolution Per Call
**Failure mode:** refactor
**File:** src/lib/presets.js
**Issue:** **File:** `src/lib/presets.js`
**Issue:** `resolveChain()` calls `allPresets(projectRoot)` repeatedly, including inside the parent traversal loop. `allPresets()` can load the plugin registry, so parent chains may trigger repeated registry work.
**Suggestion:** Compute once at the start of `resolveChain()` and reuse a `Map` by key for leaf and parent lookup.
**Suggestion:** **File:** `src/lib/presets.js`
**Issue:** `resolveChain()` calls `allPresets(projectRoot)` repeatedly, including inside the parent traversal loop. `allPresets()` can load the plugin registry, so parent chains may trigger repeated registry work.
**Suggestion:** Compute once at the start of `resolveChain()` and reuse a `Map` by key for leaf and parent lookup.
**Rationale:** Loop review proposal.

### 62. 2. Add Explicit Bounds To Recursive Default Merge
**Failure mode:** refactor
**File:** src/lib/config.js
**Issue:** **File:** `src/lib/config.js`
**Issue:** `mergeMissing()` recursively merges plugin defaults without an explicit depth bound. This violates the `bounded-resource-usage` guardrail for recursive processing.
**Suggestion:** Add a max merge depth, for example `mergeMissing(target, defaults, depth = 0)` with a constant such as `MAX_PLUGIN_DEFAULT_DEPTH`, and fail clearly when exceeded.
**Suggestion:** **File:** `src/lib/config.js`
**Issue:** `mergeMissing()` recursively merges plugin defaults without an explicit depth bound. This violates the `bounded-resource-usage` guardrail for recursive processing.
**Suggestion:** Add a max merge depth, for example `mergeMissing(target, defaults, depth = 0)` with a constant such as `MAX_PLUGIN_DEFAULT_DEPTH`, and fail clearly when exceeded.
**Rationale:** Loop review proposal.

### 63. 3. Bound Plugin Config Bulk Loading
**Failure mode:** refactor
**File:** src/lib/config.js
**Issue:** **File:** `src/lib/config.js`
**Issue:** `loadEnabledPluginConfig()` reads schema/default files for every enabled package with no explicit count or file-size bounds. A config with many packages or large contribution files can cause unbounded bulk loading.
**Suggestion:** Introduce limits such as `MAX_PLUGIN_PACKAGES`, `MAX_PLUGIN_CONFIG_FILE_BYTES`, and validate before reading/parsing contribution files.
**Suggestion:** **File:** `src/lib/config.js`
**Issue:** `loadEnabledPluginConfig()` reads schema/default files for every enabled package with no explicit count or file-size bounds. A config with many packages or large contribution files can cause unbounded bulk loading.
**Suggestion:** Introduce limits such as `MAX_PLUGIN_PACKAGES`, `MAX_PLUGIN_CONFIG_FILE_BYTES`, and validate before reading/parsing contribution files.
**Rationale:** Loop review proposal.

### 64. 4. Avoid Repeated Linear Preset Lookups
**Failure mode:** refactor
**File:** src/lib/presets.js
**Issue:** **File:** `src/lib/presets.js`
**Issue:** Preset lookups use repeated `.find()` calls over arrays. With plugin presets added, this pattern becomes noisier and less efficient.
**Suggestion:** Build a `Map` once in `allPresets()` or per resolver call, then use `presetByKey.get(key)` for project overlay, leaf, parent, and safe fallback lookups.
**Suggestion:** **File:** `src/lib/presets.js`
**Issue:** Preset lookups use repeated `.find()` calls over arrays. With plugin presets added, this pattern becomes noisier and less efficient.
**Suggestion:** Build a `Map` once in `allPresets()` or per resolver call, then use `presetByKey.get(key)` for project overlay, leaf, parent, and safe fallback lookups.
**Rationale:** Loop review proposal.

### 65. 5. Extract DataSource Class Normalization
**Failure mode:** refactor
**File:** src/docs/lib/data-source-loader.js
**Issue:** **File:** `src/docs/lib/data-source-loader.js`
**Issue:** The inline `Function.prototype.toString` class detection makes `loadDataSources()` harder to read and bakes a brittle distinction into the loop.
**Suggestion:** Extract a helper such as `resolveDataSourceClass(Source, container, filePath)` that handles class-vs-factory normalization and validation in one place.
**Suggestion:** **File:** `src/docs/lib/data-source-loader.js`
**Issue:** The inline `Function.prototype.toString` class detection makes `loadDataSources()` harder to read and bakes a brittle distinction into the loop.
**Suggestion:** Extract a helper such as `resolveDataSourceClass(Source, container, filePath)` that handles class-vs-factory normalization and validation in one place.
**Rationale:** Loop review proposal.

### 66. 1. Cache Preset Resolution Per Call
**Failure mode:** refactor
**File:** src/lib/presets.js
**Issue:** **File:** `src/lib/presets.js`
**Issue:** `resolveChain()` calls `allPresets(projectRoot)` repeatedly, including inside the parent traversal loop. `allPresets()` can load the plugin registry, so parent chains may trigger repeated registry work.
**Suggestion:** Compute once at the start of `resolveChain()` and reuse a `Map` by key for leaf and parent lookup.
**Suggestion:** **File:** `src/lib/presets.js`
**Issue:** `resolveChain()` calls `allPresets(projectRoot)` repeatedly, including inside the parent traversal loop. `allPresets()` can load the plugin registry, so parent chains may trigger repeated registry work.
**Suggestion:** Compute once at the start of `resolveChain()` and reuse a `Map` by key for leaf and parent lookup.
**Rationale:** Loop review proposal.

### 67. 2. Add Explicit Bounds To Recursive Default Merge
**Failure mode:** refactor
**File:** src/lib/config.js
**Issue:** **File:** `src/lib/config.js`
**Issue:** `mergeMissing()` recursively merges plugin defaults without an explicit depth bound. This violates the `bounded-resource-usage` guardrail for recursive processing.
**Suggestion:** Add a max merge depth, for example `mergeMissing(target, defaults, depth = 0)` with a constant such as `MAX_PLUGIN_DEFAULT_DEPTH`, and fail clearly when exceeded.
**Suggestion:** **File:** `src/lib/config.js`
**Issue:** `mergeMissing()` recursively merges plugin defaults without an explicit depth bound. This violates the `bounded-resource-usage` guardrail for recursive processing.
**Suggestion:** Add a max merge depth, for example `mergeMissing(target, defaults, depth = 0)` with a constant such as `MAX_PLUGIN_DEFAULT_DEPTH`, and fail clearly when exceeded.
**Rationale:** Loop review proposal.

### 68. 3. Bound Plugin Config Bulk Loading
**Failure mode:** refactor
**File:** src/lib/config.js
**Issue:** **File:** `src/lib/config.js`
**Issue:** `loadEnabledPluginConfig()` reads schema/default files for every enabled package with no explicit count or file-size bounds. A config with many packages or large contribution files can cause unbounded bulk loading.
**Suggestion:** Introduce limits such as `MAX_PLUGIN_PACKAGES`, `MAX_PLUGIN_CONFIG_FILE_BYTES`, and validate before reading/parsing contribution files.
**Suggestion:** **File:** `src/lib/config.js`
**Issue:** `loadEnabledPluginConfig()` reads schema/default files for every enabled package with no explicit count or file-size bounds. A config with many packages or large contribution files can cause unbounded bulk loading.
**Suggestion:** Introduce limits such as `MAX_PLUGIN_PACKAGES`, `MAX_PLUGIN_CONFIG_FILE_BYTES`, and validate before reading/parsing contribution files.
**Rationale:** Loop review proposal.

### 69. 4. Avoid Repeated Linear Preset Lookups
**Failure mode:** refactor
**File:** src/lib/presets.js
**Issue:** **File:** `src/lib/presets.js`
**Issue:** Preset lookups use repeated `.find()` calls over arrays. With plugin presets added, this pattern becomes noisier and less efficient.
**Suggestion:** Build a `Map` once in `allPresets()` or per resolver call, then use `presetByKey.get(key)` for project overlay, leaf, parent, and safe fallback lookups.
**Suggestion:** **File:** `src/lib/presets.js`
**Issue:** Preset lookups use repeated `.find()` calls over arrays. With plugin presets added, this pattern becomes noisier and less efficient.
**Suggestion:** Build a `Map` once in `allPresets()` or per resolver call, then use `presetByKey.get(key)` for project overlay, leaf, parent, and safe fallback lookups.
**Rationale:** Loop review proposal.

### 70. 5. Extract DataSource Class Normalization
**Failure mode:** refactor
**File:** src/docs/lib/data-source-loader.js
**Issue:** **File:** `src/docs/lib/data-source-loader.js`
**Issue:** The inline `Function.prototype.toString` class detection makes `loadDataSources()` harder to read and bakes a brittle distinction into the loop.
**Suggestion:** Extract a helper such as `resolveDataSourceClass(Source, container, filePath)` that handles class-vs-factory normalization and validation in one place.
**Suggestion:** **File:** `src/docs/lib/data-source-loader.js`
**Issue:** The inline `Function.prototype.toString` class detection makes `loadDataSources()` harder to read and bakes a brittle distinction into the loop.
**Suggestion:** Extract a helper such as `resolveDataSourceClass(Source, container, filePath)` that handles class-vs-factory normalization and validation in one place.
**Rationale:** Loop review proposal.

### 71. 1. Cache Preset Resolution Per Call
**Failure mode:** refactor
**File:** src/lib/presets.js
**Issue:** **File:** `src/lib/presets.js`
**Issue:** `resolveChain()` calls `allPresets(projectRoot)` repeatedly, including inside the parent traversal loop. `allPresets()` can load the plugin registry, so parent chains may trigger repeated registry work.
**Suggestion:** Compute once at the start of `resolveChain()` and reuse a `Map` by key for leaf and parent lookup.
**Suggestion:** **File:** `src/lib/presets.js`
**Issue:** `resolveChain()` calls `allPresets(projectRoot)` repeatedly, including inside the parent traversal loop. `allPresets()` can load the plugin registry, so parent chains may trigger repeated registry work.
**Suggestion:** Compute once at the start of `resolveChain()` and reuse a `Map` by key for leaf and parent lookup.
**Rationale:** Loop review proposal.

### 72. 2. Add Explicit Bounds To Recursive Default Merge
**Failure mode:** refactor
**File:** src/lib/config.js
**Issue:** **File:** `src/lib/config.js`
**Issue:** `mergeMissing()` recursively merges plugin defaults without an explicit depth bound. This violates the `bounded-resource-usage` guardrail for recursive processing.
**Suggestion:** Add a max merge depth, for example `mergeMissing(target, defaults, depth = 0)` with a constant such as `MAX_PLUGIN_DEFAULT_DEPTH`, and fail clearly when exceeded.
**Suggestion:** **File:** `src/lib/config.js`
**Issue:** `mergeMissing()` recursively merges plugin defaults without an explicit depth bound. This violates the `bounded-resource-usage` guardrail for recursive processing.
**Suggestion:** Add a max merge depth, for example `mergeMissing(target, defaults, depth = 0)` with a constant such as `MAX_PLUGIN_DEFAULT_DEPTH`, and fail clearly when exceeded.
**Rationale:** Loop review proposal.

### 73. 3. Bound Plugin Config Bulk Loading
**Failure mode:** refactor
**File:** src/lib/config.js
**Issue:** **File:** `src/lib/config.js`
**Issue:** `loadEnabledPluginConfig()` reads schema/default files for every enabled package with no explicit count or file-size bounds. A config with many packages or large contribution files can cause unbounded bulk loading.
**Suggestion:** Introduce limits such as `MAX_PLUGIN_PACKAGES`, `MAX_PLUGIN_CONFIG_FILE_BYTES`, and validate before reading/parsing contribution files.
**Suggestion:** **File:** `src/lib/config.js`
**Issue:** `loadEnabledPluginConfig()` reads schema/default files for every enabled package with no explicit count or file-size bounds. A config with many packages or large contribution files can cause unbounded bulk loading.
**Suggestion:** Introduce limits such as `MAX_PLUGIN_PACKAGES`, `MAX_PLUGIN_CONFIG_FILE_BYTES`, and validate before reading/parsing contribution files.
**Rationale:** Loop review proposal.

### 74. 4. Avoid Repeated Linear Preset Lookups
**Failure mode:** refactor
**File:** src/lib/presets.js
**Issue:** **File:** `src/lib/presets.js`
**Issue:** Preset lookups use repeated `.find()` calls over arrays. With plugin presets added, this pattern becomes noisier and less efficient.
**Suggestion:** Build a `Map` once in `allPresets()` or per resolver call, then use `presetByKey.get(key)` for project overlay, leaf, parent, and safe fallback lookups.
**Suggestion:** **File:** `src/lib/presets.js`
**Issue:** Preset lookups use repeated `.find()` calls over arrays. With plugin presets added, this pattern becomes noisier and less efficient.
**Suggestion:** Build a `Map` once in `allPresets()` or per resolver call, then use `presetByKey.get(key)` for project overlay, leaf, parent, and safe fallback lookups.
**Rationale:** Loop review proposal.

### 75. 5. Extract DataSource Class Normalization
**Failure mode:** refactor
**File:** src/docs/lib/data-source-loader.js
**Issue:** **File:** `src/docs/lib/data-source-loader.js`
**Issue:** The inline `Function.prototype.toString` class detection makes `loadDataSources()` harder to read and bakes a brittle distinction into the loop.
**Suggestion:** Extract a helper such as `resolveDataSourceClass(Source, container, filePath)` that handles class-vs-factory normalization and validation in one place.
**Suggestion:** **File:** `src/docs/lib/data-source-loader.js`
**Issue:** The inline `Function.prototype.toString` class detection makes `loadDataSources()` harder to read and bakes a brittle distinction into the loop.
**Suggestion:** Extract a helper such as `resolveDataSourceClass(Source, container, filePath)` that handles class-vs-factory normalization and validation in one place.
**Rationale:** Loop review proposal.

### 76. 1. Cache Preset Resolution Per Call
**Failure mode:** refactor
**File:** src/lib/presets.js
**Issue:** **File:** `src/lib/presets.js`
**Issue:** `resolveChain()` calls `allPresets(projectRoot)` repeatedly, including inside the parent traversal loop. `allPresets()` can load the plugin registry, so parent chains may trigger repeated registry work.
**Suggestion:** Compute once at the start of `resolveChain()` and reuse a `Map` by key for leaf and parent lookup.
**Suggestion:** **File:** `src/lib/presets.js`
**Issue:** `resolveChain()` calls `allPresets(projectRoot)` repeatedly, including inside the parent traversal loop. `allPresets()` can load the plugin registry, so parent chains may trigger repeated registry work.
**Suggestion:** Compute once at the start of `resolveChain()` and reuse a `Map` by key for leaf and parent lookup.
**Rationale:** Loop review proposal.

### 77. 2. Add Explicit Bounds To Recursive Default Merge
**Failure mode:** refactor
**File:** src/lib/config.js
**Issue:** **File:** `src/lib/config.js`
**Issue:** `mergeMissing()` recursively merges plugin defaults without an explicit depth bound. This violates the `bounded-resource-usage` guardrail for recursive processing.
**Suggestion:** Add a max merge depth, for example `mergeMissing(target, defaults, depth = 0)` with a constant such as `MAX_PLUGIN_DEFAULT_DEPTH`, and fail clearly when exceeded.
**Suggestion:** **File:** `src/lib/config.js`
**Issue:** `mergeMissing()` recursively merges plugin defaults without an explicit depth bound. This violates the `bounded-resource-usage` guardrail for recursive processing.
**Suggestion:** Add a max merge depth, for example `mergeMissing(target, defaults, depth = 0)` with a constant such as `MAX_PLUGIN_DEFAULT_DEPTH`, and fail clearly when exceeded.
**Rationale:** Loop review proposal.

### 78. 3. Bound Plugin Config Bulk Loading
**Failure mode:** refactor
**File:** src/lib/config.js
**Issue:** **File:** `src/lib/config.js`
**Issue:** `loadEnabledPluginConfig()` reads schema/default files for every enabled package with no explicit count or file-size bounds. A config with many packages or large contribution files can cause unbounded bulk loading.
**Suggestion:** Introduce limits such as `MAX_PLUGIN_PACKAGES`, `MAX_PLUGIN_CONFIG_FILE_BYTES`, and validate before reading/parsing contribution files.
**Suggestion:** **File:** `src/lib/config.js`
**Issue:** `loadEnabledPluginConfig()` reads schema/default files for every enabled package with no explicit count or file-size bounds. A config with many packages or large contribution files can cause unbounded bulk loading.
**Suggestion:** Introduce limits such as `MAX_PLUGIN_PACKAGES`, `MAX_PLUGIN_CONFIG_FILE_BYTES`, and validate before reading/parsing contribution files.
**Rationale:** Loop review proposal.

### 79. 4. Avoid Repeated Linear Preset Lookups
**Failure mode:** refactor
**File:** src/lib/presets.js
**Issue:** **File:** `src/lib/presets.js`
**Issue:** Preset lookups use repeated `.find()` calls over arrays. With plugin presets added, this pattern becomes noisier and less efficient.
**Suggestion:** Build a `Map` once in `allPresets()` or per resolver call, then use `presetByKey.get(key)` for project overlay, leaf, parent, and safe fallback lookups.
**Suggestion:** **File:** `src/lib/presets.js`
**Issue:** Preset lookups use repeated `.find()` calls over arrays. With plugin presets added, this pattern becomes noisier and less efficient.
**Suggestion:** Build a `Map` once in `allPresets()` or per resolver call, then use `presetByKey.get(key)` for project overlay, leaf, parent, and safe fallback lookups.
**Rationale:** Loop review proposal.

### 80. 5. Extract DataSource Class Normalization
**Failure mode:** refactor
**File:** src/docs/lib/data-source-loader.js
**Issue:** **File:** `src/docs/lib/data-source-loader.js`
**Issue:** The inline `Function.prototype.toString` class detection makes `loadDataSources()` harder to read and bakes a brittle distinction into the loop.
**Suggestion:** Extract a helper such as `resolveDataSourceClass(Source, container, filePath)` that handles class-vs-factory normalization and validation in one place.
**Suggestion:** **File:** `src/docs/lib/data-source-loader.js`
**Issue:** The inline `Function.prototype.toString` class detection makes `loadDataSources()` harder to read and bakes a brittle distinction into the loop.
**Suggestion:** Extract a helper such as `resolveDataSourceClass(Source, container, filePath)` that handles class-vs-factory normalization and validation in one place.
**Rationale:** Loop review proposal.

### 81. 1. Cache Preset Resolution Per Call
**Failure mode:** refactor
**File:** src/lib/presets.js
**Issue:** **File:** `src/lib/presets.js`
**Issue:** `resolveChain()` calls `allPresets(projectRoot)` repeatedly, including inside the parent traversal loop. `allPresets()` can load the plugin registry, so parent chains may trigger repeated registry work.
**Suggestion:** Compute once at the start of `resolveChain()` and reuse a `Map` by key for leaf and parent lookup.
**Suggestion:** **File:** `src/lib/presets.js`
**Issue:** `resolveChain()` calls `allPresets(projectRoot)` repeatedly, including inside the parent traversal loop. `allPresets()` can load the plugin registry, so parent chains may trigger repeated registry work.
**Suggestion:** Compute once at the start of `resolveChain()` and reuse a `Map` by key for leaf and parent lookup.
**Rationale:** Loop review proposal.

### 82. 2. Add Explicit Bounds To Recursive Default Merge
**Failure mode:** refactor
**File:** src/lib/config.js
**Issue:** **File:** `src/lib/config.js`
**Issue:** `mergeMissing()` recursively merges plugin defaults without an explicit depth bound. This violates the `bounded-resource-usage` guardrail for recursive processing.
**Suggestion:** Add a max merge depth, for example `mergeMissing(target, defaults, depth = 0)` with a constant such as `MAX_PLUGIN_DEFAULT_DEPTH`, and fail clearly when exceeded.
**Suggestion:** **File:** `src/lib/config.js`
**Issue:** `mergeMissing()` recursively merges plugin defaults without an explicit depth bound. This violates the `bounded-resource-usage` guardrail for recursive processing.
**Suggestion:** Add a max merge depth, for example `mergeMissing(target, defaults, depth = 0)` with a constant such as `MAX_PLUGIN_DEFAULT_DEPTH`, and fail clearly when exceeded.
**Rationale:** Loop review proposal.

### 83. 3. Bound Plugin Config Bulk Loading
**Failure mode:** refactor
**File:** src/lib/config.js
**Issue:** **File:** `src/lib/config.js`
**Issue:** `loadEnabledPluginConfig()` reads schema/default files for every enabled package with no explicit count or file-size bounds. A config with many packages or large contribution files can cause unbounded bulk loading.
**Suggestion:** Introduce limits such as `MAX_PLUGIN_PACKAGES`, `MAX_PLUGIN_CONFIG_FILE_BYTES`, and validate before reading/parsing contribution files.
**Suggestion:** **File:** `src/lib/config.js`
**Issue:** `loadEnabledPluginConfig()` reads schema/default files for every enabled package with no explicit count or file-size bounds. A config with many packages or large contribution files can cause unbounded bulk loading.
**Suggestion:** Introduce limits such as `MAX_PLUGIN_PACKAGES`, `MAX_PLUGIN_CONFIG_FILE_BYTES`, and validate before reading/parsing contribution files.
**Rationale:** Loop review proposal.

### 84. 4. Avoid Repeated Linear Preset Lookups
**Failure mode:** refactor
**File:** src/lib/presets.js
**Issue:** **File:** `src/lib/presets.js`
**Issue:** Preset lookups use repeated `.find()` calls over arrays. With plugin presets added, this pattern becomes noisier and less efficient.
**Suggestion:** Build a `Map` once in `allPresets()` or per resolver call, then use `presetByKey.get(key)` for project overlay, leaf, parent, and safe fallback lookups.
**Suggestion:** **File:** `src/lib/presets.js`
**Issue:** Preset lookups use repeated `.find()` calls over arrays. With plugin presets added, this pattern becomes noisier and less efficient.
**Suggestion:** Build a `Map` once in `allPresets()` or per resolver call, then use `presetByKey.get(key)` for project overlay, leaf, parent, and safe fallback lookups.
**Rationale:** Loop review proposal.

### 85. 5. Extract DataSource Class Normalization
**Failure mode:** refactor
**File:** src/docs/lib/data-source-loader.js
**Issue:** **File:** `src/docs/lib/data-source-loader.js`
**Issue:** The inline `Function.prototype.toString` class detection makes `loadDataSources()` harder to read and bakes a brittle distinction into the loop.
**Suggestion:** Extract a helper such as `resolveDataSourceClass(Source, container, filePath)` that handles class-vs-factory normalization and validation in one place.
**Suggestion:** **File:** `src/docs/lib/data-source-loader.js`
**Issue:** The inline `Function.prototype.toString` class detection makes `loadDataSources()` harder to read and bakes a brittle distinction into the loop.
**Suggestion:** Extract a helper such as `resolveDataSourceClass(Source, container, filePath)` that handles class-vs-factory normalization and validation in one place.
**Rationale:** Loop review proposal.

### 86. 1. Cache Preset Resolution Per Call
**Failure mode:** refactor
**File:** src/lib/presets.js
**Issue:** **File:** `src/lib/presets.js`
**Issue:** `resolveChain()` calls `allPresets(projectRoot)` repeatedly, including inside the parent traversal loop. `allPresets()` can load the plugin registry, so parent chains may trigger repeated registry work.
**Suggestion:** Compute once at the start of `resolveChain()` and reuse a `Map` by key for leaf and parent lookup.
**Suggestion:** **File:** `src/lib/presets.js`
**Issue:** `resolveChain()` calls `allPresets(projectRoot)` repeatedly, including inside the parent traversal loop. `allPresets()` can load the plugin registry, so parent chains may trigger repeated registry work.
**Suggestion:** Compute once at the start of `resolveChain()` and reuse a `Map` by key for leaf and parent lookup.
**Rationale:** Loop review proposal.

### 87. 2. Add Explicit Bounds To Recursive Default Merge
**Failure mode:** refactor
**File:** src/lib/config.js
**Issue:** **File:** `src/lib/config.js`
**Issue:** `mergeMissing()` recursively merges plugin defaults without an explicit depth bound. This violates the `bounded-resource-usage` guardrail for recursive processing.
**Suggestion:** Add a max merge depth, for example `mergeMissing(target, defaults, depth = 0)` with a constant such as `MAX_PLUGIN_DEFAULT_DEPTH`, and fail clearly when exceeded.
**Suggestion:** **File:** `src/lib/config.js`
**Issue:** `mergeMissing()` recursively merges plugin defaults without an explicit depth bound. This violates the `bounded-resource-usage` guardrail for recursive processing.
**Suggestion:** Add a max merge depth, for example `mergeMissing(target, defaults, depth = 0)` with a constant such as `MAX_PLUGIN_DEFAULT_DEPTH`, and fail clearly when exceeded.
**Rationale:** Loop review proposal.

### 88. 3. Bound Plugin Config Bulk Loading
**Failure mode:** refactor
**File:** src/lib/config.js
**Issue:** **File:** `src/lib/config.js`
**Issue:** `loadEnabledPluginConfig()` reads schema/default files for every enabled package with no explicit count or file-size bounds. A config with many packages or large contribution files can cause unbounded bulk loading.
**Suggestion:** Introduce limits such as `MAX_PLUGIN_PACKAGES`, `MAX_PLUGIN_CONFIG_FILE_BYTES`, and validate before reading/parsing contribution files.
**Suggestion:** **File:** `src/lib/config.js`
**Issue:** `loadEnabledPluginConfig()` reads schema/default files for every enabled package with no explicit count or file-size bounds. A config with many packages or large contribution files can cause unbounded bulk loading.
**Suggestion:** Introduce limits such as `MAX_PLUGIN_PACKAGES`, `MAX_PLUGIN_CONFIG_FILE_BYTES`, and validate before reading/parsing contribution files.
**Rationale:** Loop review proposal.

### 89. 4. Avoid Repeated Linear Preset Lookups
**Failure mode:** refactor
**File:** src/lib/presets.js
**Issue:** **File:** `src/lib/presets.js`
**Issue:** Preset lookups use repeated `.find()` calls over arrays. With plugin presets added, this pattern becomes noisier and less efficient.
**Suggestion:** Build a `Map` once in `allPresets()` or per resolver call, then use `presetByKey.get(key)` for project overlay, leaf, parent, and safe fallback lookups.
**Suggestion:** **File:** `src/lib/presets.js`
**Issue:** Preset lookups use repeated `.find()` calls over arrays. With plugin presets added, this pattern becomes noisier and less efficient.
**Suggestion:** Build a `Map` once in `allPresets()` or per resolver call, then use `presetByKey.get(key)` for project overlay, leaf, parent, and safe fallback lookups.
**Rationale:** Loop review proposal.

### 90. 5. Extract DataSource Class Normalization
**Failure mode:** refactor
**File:** src/docs/lib/data-source-loader.js
**Issue:** **File:** `src/docs/lib/data-source-loader.js`
**Issue:** The inline `Function.prototype.toString` class detection makes `loadDataSources()` harder to read and bakes a brittle distinction into the loop.
**Suggestion:** Extract a helper such as `resolveDataSourceClass(Source, container, filePath)` that handles class-vs-factory normalization and validation in one place.
**Suggestion:** **File:** `src/docs/lib/data-source-loader.js`
**Issue:** The inline `Function.prototype.toString` class detection makes `loadDataSources()` harder to read and bakes a brittle distinction into the loop.
**Suggestion:** Extract a helper such as `resolveDataSourceClass(Source, container, filePath)` that handles class-vs-factory normalization and validation in one place.
**Rationale:** Loop review proposal.

### 91. 1. Cache Preset Resolution Per Call
**Failure mode:** refactor
**File:** src/lib/presets.js
**Issue:** **File:** `src/lib/presets.js`
**Issue:** `resolveChain()` calls `allPresets(projectRoot)` repeatedly, including inside the parent traversal loop. `allPresets()` can load the plugin registry, so parent chains may trigger repeated registry work.
**Suggestion:** Compute once at the start of `resolveChain()` and reuse a `Map` by key for leaf and parent lookup.
**Suggestion:** **File:** `src/lib/presets.js`
**Issue:** `resolveChain()` calls `allPresets(projectRoot)` repeatedly, including inside the parent traversal loop. `allPresets()` can load the plugin registry, so parent chains may trigger repeated registry work.
**Suggestion:** Compute once at the start of `resolveChain()` and reuse a `Map` by key for leaf and parent lookup.
**Rationale:** Loop review proposal.

### 92. 2. Add Explicit Bounds To Recursive Default Merge
**Failure mode:** refactor
**File:** src/lib/config.js
**Issue:** **File:** `src/lib/config.js`
**Issue:** `mergeMissing()` recursively merges plugin defaults without an explicit depth bound. This violates the `bounded-resource-usage` guardrail for recursive processing.
**Suggestion:** Add a max merge depth, for example `mergeMissing(target, defaults, depth = 0)` with a constant such as `MAX_PLUGIN_DEFAULT_DEPTH`, and fail clearly when exceeded.
**Suggestion:** **File:** `src/lib/config.js`
**Issue:** `mergeMissing()` recursively merges plugin defaults without an explicit depth bound. This violates the `bounded-resource-usage` guardrail for recursive processing.
**Suggestion:** Add a max merge depth, for example `mergeMissing(target, defaults, depth = 0)` with a constant such as `MAX_PLUGIN_DEFAULT_DEPTH`, and fail clearly when exceeded.
**Rationale:** Loop review proposal.

### 93. 3. Bound Plugin Config Bulk Loading
**Failure mode:** refactor
**File:** src/lib/config.js
**Issue:** **File:** `src/lib/config.js`
**Issue:** `loadEnabledPluginConfig()` reads schema/default files for every enabled package with no explicit count or file-size bounds. A config with many packages or large contribution files can cause unbounded bulk loading.
**Suggestion:** Introduce limits such as `MAX_PLUGIN_PACKAGES`, `MAX_PLUGIN_CONFIG_FILE_BYTES`, and validate before reading/parsing contribution files.
**Suggestion:** **File:** `src/lib/config.js`
**Issue:** `loadEnabledPluginConfig()` reads schema/default files for every enabled package with no explicit count or file-size bounds. A config with many packages or large contribution files can cause unbounded bulk loading.
**Suggestion:** Introduce limits such as `MAX_PLUGIN_PACKAGES`, `MAX_PLUGIN_CONFIG_FILE_BYTES`, and validate before reading/parsing contribution files.
**Rationale:** Loop review proposal.

### 94. 4. Avoid Repeated Linear Preset Lookups
**Failure mode:** refactor
**File:** src/lib/presets.js
**Issue:** **File:** `src/lib/presets.js`
**Issue:** Preset lookups use repeated `.find()` calls over arrays. With plugin presets added, this pattern becomes noisier and less efficient.
**Suggestion:** Build a `Map` once in `allPresets()` or per resolver call, then use `presetByKey.get(key)` for project overlay, leaf, parent, and safe fallback lookups.
**Suggestion:** **File:** `src/lib/presets.js`
**Issue:** Preset lookups use repeated `.find()` calls over arrays. With plugin presets added, this pattern becomes noisier and less efficient.
**Suggestion:** Build a `Map` once in `allPresets()` or per resolver call, then use `presetByKey.get(key)` for project overlay, leaf, parent, and safe fallback lookups.
**Rationale:** Loop review proposal.

### 95. 5. Extract DataSource Class Normalization
**Failure mode:** refactor
**File:** src/docs/lib/data-source-loader.js
**Issue:** **File:** `src/docs/lib/data-source-loader.js`
**Issue:** The inline `Function.prototype.toString` class detection makes `loadDataSources()` harder to read and bakes a brittle distinction into the loop.
**Suggestion:** Extract a helper such as `resolveDataSourceClass(Source, container, filePath)` that handles class-vs-factory normalization and validation in one place.
**Suggestion:** **File:** `src/docs/lib/data-source-loader.js`
**Issue:** The inline `Function.prototype.toString` class detection makes `loadDataSources()` harder to read and bakes a brittle distinction into the loop.
**Suggestion:** Extract a helper such as `resolveDataSourceClass(Source, container, filePath)` that handles class-vs-factory normalization and validation in one place.
**Rationale:** Loop review proposal.

### 96. 1. Cache Preset Resolution Per Call
**Failure mode:** refactor
**File:** src/lib/presets.js
**Issue:** **File:** `src/lib/presets.js`
**Issue:** `resolveChain()` calls `allPresets(projectRoot)` repeatedly, including inside the parent traversal loop. `allPresets()` can load the plugin registry, so parent chains may trigger repeated registry work.
**Suggestion:** Compute once at the start of `resolveChain()` and reuse a `Map` by key for leaf and parent lookup.
**Suggestion:** **File:** `src/lib/presets.js`
**Issue:** `resolveChain()` calls `allPresets(projectRoot)` repeatedly, including inside the parent traversal loop. `allPresets()` can load the plugin registry, so parent chains may trigger repeated registry work.
**Suggestion:** Compute once at the start of `resolveChain()` and reuse a `Map` by key for leaf and parent lookup.
**Rationale:** Loop review proposal.

### 97. 2. Add Explicit Bounds To Recursive Default Merge
**Failure mode:** refactor
**File:** src/lib/config.js
**Issue:** **File:** `src/lib/config.js`
**Issue:** `mergeMissing()` recursively merges plugin defaults without an explicit depth bound. This violates the `bounded-resource-usage` guardrail for recursive processing.
**Suggestion:** Add a max merge depth, for example `mergeMissing(target, defaults, depth = 0)` with a constant such as `MAX_PLUGIN_DEFAULT_DEPTH`, and fail clearly when exceeded.
**Suggestion:** **File:** `src/lib/config.js`
**Issue:** `mergeMissing()` recursively merges plugin defaults without an explicit depth bound. This violates the `bounded-resource-usage` guardrail for recursive processing.
**Suggestion:** Add a max merge depth, for example `mergeMissing(target, defaults, depth = 0)` with a constant such as `MAX_PLUGIN_DEFAULT_DEPTH`, and fail clearly when exceeded.
**Rationale:** Loop review proposal.

### 98. 3. Bound Plugin Config Bulk Loading
**Failure mode:** refactor
**File:** src/lib/config.js
**Issue:** **File:** `src/lib/config.js`
**Issue:** `loadEnabledPluginConfig()` reads schema/default files for every enabled package with no explicit count or file-size bounds. A config with many packages or large contribution files can cause unbounded bulk loading.
**Suggestion:** Introduce limits such as `MAX_PLUGIN_PACKAGES`, `MAX_PLUGIN_CONFIG_FILE_BYTES`, and validate before reading/parsing contribution files.
**Suggestion:** **File:** `src/lib/config.js`
**Issue:** `loadEnabledPluginConfig()` reads schema/default files for every enabled package with no explicit count or file-size bounds. A config with many packages or large contribution files can cause unbounded bulk loading.
**Suggestion:** Introduce limits such as `MAX_PLUGIN_PACKAGES`, `MAX_PLUGIN_CONFIG_FILE_BYTES`, and validate before reading/parsing contribution files.
**Rationale:** Loop review proposal.

### 99. 4. Avoid Repeated Linear Preset Lookups
**Failure mode:** refactor
**File:** src/lib/presets.js
**Issue:** **File:** `src/lib/presets.js`
**Issue:** Preset lookups use repeated `.find()` calls over arrays. With plugin presets added, this pattern becomes noisier and less efficient.
**Suggestion:** Build a `Map` once in `allPresets()` or per resolver call, then use `presetByKey.get(key)` for project overlay, leaf, parent, and safe fallback lookups.
**Suggestion:** **File:** `src/lib/presets.js`
**Issue:** Preset lookups use repeated `.find()` calls over arrays. With plugin presets added, this pattern becomes noisier and less efficient.
**Suggestion:** Build a `Map` once in `allPresets()` or per resolver call, then use `presetByKey.get(key)` for project overlay, leaf, parent, and safe fallback lookups.
**Rationale:** Loop review proposal.

### 100. 5. Extract DataSource Class Normalization
**Failure mode:** refactor
**File:** src/docs/lib/data-source-loader.js
**Issue:** **File:** `src/docs/lib/data-source-loader.js`
**Issue:** The inline `Function.prototype.toString` class detection makes `loadDataSources()` harder to read and bakes a brittle distinction into the loop.
**Suggestion:** Extract a helper such as `resolveDataSourceClass(Source, container, filePath)` that handles class-vs-factory normalization and validation in one place.
**Suggestion:** **File:** `src/docs/lib/data-source-loader.js`
**Issue:** The inline `Function.prototype.toString` class detection makes `loadDataSources()` harder to read and bakes a brittle distinction into the loop.
**Suggestion:** Extract a helper such as `resolveDataSourceClass(Source, container, filePath)` that handles class-vs-factory normalization and validation in one place.
**Rationale:** Loop review proposal.

### 101. 1. Cache Preset Resolution Per Call
**Failure mode:** refactor
**File:** src/lib/presets.js
**Issue:** **File:** `src/lib/presets.js`
**Issue:** `resolveChain()` calls `allPresets(projectRoot)` repeatedly, including inside the parent traversal loop. `allPresets()` can load the plugin registry, so parent chains may trigger repeated registry work.
**Suggestion:** Compute once at the start of `resolveChain()` and reuse a `Map` by key for leaf and parent lookup.
**Suggestion:** **File:** `src/lib/presets.js`
**Issue:** `resolveChain()` calls `allPresets(projectRoot)` repeatedly, including inside the parent traversal loop. `allPresets()` can load the plugin registry, so parent chains may trigger repeated registry work.
**Suggestion:** Compute once at the start of `resolveChain()` and reuse a `Map` by key for leaf and parent lookup.
**Rationale:** Loop review proposal.

### 102. 2. Add Explicit Bounds To Recursive Default Merge
**Failure mode:** refactor
**File:** src/lib/config.js
**Issue:** **File:** `src/lib/config.js`
**Issue:** `mergeMissing()` recursively merges plugin defaults without an explicit depth bound. This violates the `bounded-resource-usage` guardrail for recursive processing.
**Suggestion:** Add a max merge depth, for example `mergeMissing(target, defaults, depth = 0)` with a constant such as `MAX_PLUGIN_DEFAULT_DEPTH`, and fail clearly when exceeded.
**Suggestion:** **File:** `src/lib/config.js`
**Issue:** `mergeMissing()` recursively merges plugin defaults without an explicit depth bound. This violates the `bounded-resource-usage` guardrail for recursive processing.
**Suggestion:** Add a max merge depth, for example `mergeMissing(target, defaults, depth = 0)` with a constant such as `MAX_PLUGIN_DEFAULT_DEPTH`, and fail clearly when exceeded.
**Rationale:** Loop review proposal.

### 103. 3. Bound Plugin Config Bulk Loading
**Failure mode:** refactor
**File:** src/lib/config.js
**Issue:** **File:** `src/lib/config.js`
**Issue:** `loadEnabledPluginConfig()` reads schema/default files for every enabled package with no explicit count or file-size bounds. A config with many packages or large contribution files can cause unbounded bulk loading.
**Suggestion:** Introduce limits such as `MAX_PLUGIN_PACKAGES`, `MAX_PLUGIN_CONFIG_FILE_BYTES`, and validate before reading/parsing contribution files.
**Suggestion:** **File:** `src/lib/config.js`
**Issue:** `loadEnabledPluginConfig()` reads schema/default files for every enabled package with no explicit count or file-size bounds. A config with many packages or large contribution files can cause unbounded bulk loading.
**Suggestion:** Introduce limits such as `MAX_PLUGIN_PACKAGES`, `MAX_PLUGIN_CONFIG_FILE_BYTES`, and validate before reading/parsing contribution files.
**Rationale:** Loop review proposal.

### 104. 4. Avoid Repeated Linear Preset Lookups
**Failure mode:** refactor
**File:** src/lib/presets.js
**Issue:** **File:** `src/lib/presets.js`
**Issue:** Preset lookups use repeated `.find()` calls over arrays. With plugin presets added, this pattern becomes noisier and less efficient.
**Suggestion:** Build a `Map` once in `allPresets()` or per resolver call, then use `presetByKey.get(key)` for project overlay, leaf, parent, and safe fallback lookups.
**Suggestion:** **File:** `src/lib/presets.js`
**Issue:** Preset lookups use repeated `.find()` calls over arrays. With plugin presets added, this pattern becomes noisier and less efficient.
**Suggestion:** Build a `Map` once in `allPresets()` or per resolver call, then use `presetByKey.get(key)` for project overlay, leaf, parent, and safe fallback lookups.
**Rationale:** Loop review proposal.

### 105. 5. Extract DataSource Class Normalization
**Failure mode:** refactor
**File:** src/docs/lib/data-source-loader.js
**Issue:** **File:** `src/docs/lib/data-source-loader.js`
**Issue:** The inline `Function.prototype.toString` class detection makes `loadDataSources()` harder to read and bakes a brittle distinction into the loop.
**Suggestion:** Extract a helper such as `resolveDataSourceClass(Source, container, filePath)` that handles class-vs-factory normalization and validation in one place.
**Suggestion:** **File:** `src/docs/lib/data-source-loader.js`
**Issue:** The inline `Function.prototype.toString` class detection makes `loadDataSources()` harder to read and bakes a brittle distinction into the loop.
**Suggestion:** Extract a helper such as `resolveDataSourceClass(Source, container, filePath)` that handles class-vs-factory normalization and validation in one place.
**Rationale:** Loop review proposal.

### 106. 1. Cache Preset Resolution Per Call
**Failure mode:** refactor
**File:** src/lib/presets.js
**Issue:** **File:** `src/lib/presets.js`
**Issue:** `resolveChain()` calls `allPresets(projectRoot)` repeatedly, including inside the parent traversal loop. `allPresets()` can load the plugin registry, so parent chains may trigger repeated registry work.
**Suggestion:** Compute once at the start of `resolveChain()` and reuse a `Map` by key for leaf and parent lookup.
**Suggestion:** **File:** `src/lib/presets.js`
**Issue:** `resolveChain()` calls `allPresets(projectRoot)` repeatedly, including inside the parent traversal loop. `allPresets()` can load the plugin registry, so parent chains may trigger repeated registry work.
**Suggestion:** Compute once at the start of `resolveChain()` and reuse a `Map` by key for leaf and parent lookup.
**Rationale:** Loop review proposal.

### 107. 2. Add Explicit Bounds To Recursive Default Merge
**Failure mode:** refactor
**File:** src/lib/config.js
**Issue:** **File:** `src/lib/config.js`
**Issue:** `mergeMissing()` recursively merges plugin defaults without an explicit depth bound. This violates the `bounded-resource-usage` guardrail for recursive processing.
**Suggestion:** Add a max merge depth, for example `mergeMissing(target, defaults, depth = 0)` with a constant such as `MAX_PLUGIN_DEFAULT_DEPTH`, and fail clearly when exceeded.
**Suggestion:** **File:** `src/lib/config.js`
**Issue:** `mergeMissing()` recursively merges plugin defaults without an explicit depth bound. This violates the `bounded-resource-usage` guardrail for recursive processing.
**Suggestion:** Add a max merge depth, for example `mergeMissing(target, defaults, depth = 0)` with a constant such as `MAX_PLUGIN_DEFAULT_DEPTH`, and fail clearly when exceeded.
**Rationale:** Loop review proposal.

### 108. 3. Bound Plugin Config Bulk Loading
**Failure mode:** refactor
**File:** src/lib/config.js
**Issue:** **File:** `src/lib/config.js`
**Issue:** `loadEnabledPluginConfig()` reads schema/default files for every enabled package with no explicit count or file-size bounds. A config with many packages or large contribution files can cause unbounded bulk loading.
**Suggestion:** Introduce limits such as `MAX_PLUGIN_PACKAGES`, `MAX_PLUGIN_CONFIG_FILE_BYTES`, and validate before reading/parsing contribution files.
**Suggestion:** **File:** `src/lib/config.js`
**Issue:** `loadEnabledPluginConfig()` reads schema/default files for every enabled package with no explicit count or file-size bounds. A config with many packages or large contribution files can cause unbounded bulk loading.
**Suggestion:** Introduce limits such as `MAX_PLUGIN_PACKAGES`, `MAX_PLUGIN_CONFIG_FILE_BYTES`, and validate before reading/parsing contribution files.
**Rationale:** Loop review proposal.

### 109. 4. Avoid Repeated Linear Preset Lookups
**Failure mode:** refactor
**File:** src/lib/presets.js
**Issue:** **File:** `src/lib/presets.js`
**Issue:** Preset lookups use repeated `.find()` calls over arrays. With plugin presets added, this pattern becomes noisier and less efficient.
**Suggestion:** Build a `Map` once in `allPresets()` or per resolver call, then use `presetByKey.get(key)` for project overlay, leaf, parent, and safe fallback lookups.
**Suggestion:** **File:** `src/lib/presets.js`
**Issue:** Preset lookups use repeated `.find()` calls over arrays. With plugin presets added, this pattern becomes noisier and less efficient.
**Suggestion:** Build a `Map` once in `allPresets()` or per resolver call, then use `presetByKey.get(key)` for project overlay, leaf, parent, and safe fallback lookups.
**Rationale:** Loop review proposal.

### 110. 5. Extract DataSource Class Normalization
**Failure mode:** refactor
**File:** src/docs/lib/data-source-loader.js
**Issue:** **File:** `src/docs/lib/data-source-loader.js`
**Issue:** The inline `Function.prototype.toString` class detection makes `loadDataSources()` harder to read and bakes a brittle distinction into the loop.
**Suggestion:** Extract a helper such as `resolveDataSourceClass(Source, container, filePath)` that handles class-vs-factory normalization and validation in one place.
**Suggestion:** **File:** `src/docs/lib/data-source-loader.js`
**Issue:** The inline `Function.prototype.toString` class detection makes `loadDataSources()` harder to read and bakes a brittle distinction into the loop.
**Suggestion:** Extract a helper such as `resolveDataSourceClass(Source, container, filePath)` that handles class-vs-factory normalization and validation in one place.
**Rationale:** Loop review proposal.

### 111. 1. Cache Preset Resolution Per Call
**Failure mode:** refactor
**File:** src/lib/presets.js
**Issue:** **File:** `src/lib/presets.js`
**Issue:** `resolveChain()` calls `allPresets(projectRoot)` repeatedly, including inside the parent traversal loop. `allPresets()` can load the plugin registry, so parent chains may trigger repeated registry work.
**Suggestion:** Compute once at the start of `resolveChain()` and reuse a `Map` by key for leaf and parent lookup.
**Suggestion:** **File:** `src/lib/presets.js`
**Issue:** `resolveChain()` calls `allPresets(projectRoot)` repeatedly, including inside the parent traversal loop. `allPresets()` can load the plugin registry, so parent chains may trigger repeated registry work.
**Suggestion:** Compute once at the start of `resolveChain()` and reuse a `Map` by key for leaf and parent lookup.
**Rationale:** Loop review proposal.

### 112. 2. Add Explicit Bounds To Recursive Default Merge
**Failure mode:** refactor
**File:** src/lib/config.js
**Issue:** **File:** `src/lib/config.js`
**Issue:** `mergeMissing()` recursively merges plugin defaults without an explicit depth bound. This violates the `bounded-resource-usage` guardrail for recursive processing.
**Suggestion:** Add a max merge depth, for example `mergeMissing(target, defaults, depth = 0)` with a constant such as `MAX_PLUGIN_DEFAULT_DEPTH`, and fail clearly when exceeded.
**Suggestion:** **File:** `src/lib/config.js`
**Issue:** `mergeMissing()` recursively merges plugin defaults without an explicit depth bound. This violates the `bounded-resource-usage` guardrail for recursive processing.
**Suggestion:** Add a max merge depth, for example `mergeMissing(target, defaults, depth = 0)` with a constant such as `MAX_PLUGIN_DEFAULT_DEPTH`, and fail clearly when exceeded.
**Rationale:** Loop review proposal.

### 113. 3. Bound Plugin Config Bulk Loading
**Failure mode:** refactor
**File:** src/lib/config.js
**Issue:** **File:** `src/lib/config.js`
**Issue:** `loadEnabledPluginConfig()` reads schema/default files for every enabled package with no explicit count or file-size bounds. A config with many packages or large contribution files can cause unbounded bulk loading.
**Suggestion:** Introduce limits such as `MAX_PLUGIN_PACKAGES`, `MAX_PLUGIN_CONFIG_FILE_BYTES`, and validate before reading/parsing contribution files.
**Suggestion:** **File:** `src/lib/config.js`
**Issue:** `loadEnabledPluginConfig()` reads schema/default files for every enabled package with no explicit count or file-size bounds. A config with many packages or large contribution files can cause unbounded bulk loading.
**Suggestion:** Introduce limits such as `MAX_PLUGIN_PACKAGES`, `MAX_PLUGIN_CONFIG_FILE_BYTES`, and validate before reading/parsing contribution files.
**Rationale:** Loop review proposal.

### 114. 4. Avoid Repeated Linear Preset Lookups
**Failure mode:** refactor
**File:** src/lib/presets.js
**Issue:** **File:** `src/lib/presets.js`
**Issue:** Preset lookups use repeated `.find()` calls over arrays. With plugin presets added, this pattern becomes noisier and less efficient.
**Suggestion:** Build a `Map` once in `allPresets()` or per resolver call, then use `presetByKey.get(key)` for project overlay, leaf, parent, and safe fallback lookups.
**Suggestion:** **File:** `src/lib/presets.js`
**Issue:** Preset lookups use repeated `.find()` calls over arrays. With plugin presets added, this pattern becomes noisier and less efficient.
**Suggestion:** Build a `Map` once in `allPresets()` or per resolver call, then use `presetByKey.get(key)` for project overlay, leaf, parent, and safe fallback lookups.
**Rationale:** Loop review proposal.

### 115. 5. Extract DataSource Class Normalization
**Failure mode:** refactor
**File:** src/docs/lib/data-source-loader.js
**Issue:** **File:** `src/docs/lib/data-source-loader.js`
**Issue:** The inline `Function.prototype.toString` class detection makes `loadDataSources()` harder to read and bakes a brittle distinction into the loop.
**Suggestion:** Extract a helper such as `resolveDataSourceClass(Source, container, filePath)` that handles class-vs-factory normalization and validation in one place.
**Suggestion:** **File:** `src/docs/lib/data-source-loader.js`
**Issue:** The inline `Function.prototype.toString` class detection makes `loadDataSources()` harder to read and bakes a brittle distinction into the loop.
**Suggestion:** Extract a helper such as `resolveDataSourceClass(Source, container, filePath)` that handles class-vs-factory normalization and validation in one place.
**Rationale:** Loop review proposal.

### 116. 1. Reuse plugin skill directory resolution
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`
**Issue:** `pluginSkillSourceDirs(root)` loads the plugin registry twice, once before deploying plugin skills and again before cleanup. This duplicates registry IO and can make the two operations see different state if registry contents change mid-upgrade.
**Suggestion:** Resolve once after plugin enablement, e.g. `const pluginSkillsDirs = pluginSkillSourceDirs(root);`, then reuse it for both `deploySkillsFromDir` and `cleanupObsoleteSkills`.
**Suggestion:** **File:** `src/upgrade.js`
**Issue:** `pluginSkillSourceDirs(root)` loads the plugin registry twice, once before deploying plugin skills and again before cleanup. This duplicates registry IO and can make the two operations see different state if registry contents change mid-upgrade.
**Suggestion:** Resolve once after plugin enablement, e.g. `const pluginSkillsDirs = pluginSkillSourceDirs(root);`, then reuse it for both `deploySkillsFromDir` and `cleanupObsoleteSkills`.
**Rationale:** Loop review proposal.

### 117. 2. Preserve dry-run visibility for plugin migration
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`
**Issue:** Official preset/workflow plugin enablement is skipped entirely under `dryRun`, so dry-run output cannot report that upgrade would enable those plugins. This makes migration behavior less transparent.
**Suggestion:** Compute whether each official plugin is needed regardless of `dryRun`, set a dry-run summary/log message for pending plugin changes, and only guard the filesystem-writing `ensureOfficialPackage(...)` calls with `!dryRun`.
**Suggestion:** **File:** `src/upgrade.js`
**Issue:** Official preset/workflow plugin enablement is skipped entirely under `dryRun`, so dry-run output cannot report that upgrade would enable those plugins. This makes migration behavior less transparent.
**Suggestion:** Compute whether each official plugin is needed regardless of `dryRun`, set a dry-run summary/log message for pending plugin changes, and only guard the filesystem-writing `ensureOfficialPackage(...)` calls with `!dryRun`.
**Rationale:** Loop review proposal.

### 118. 3. Clarify plugin change summary semantics
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`
**Issue:** `summary.plugins.changed` is a boolean while other summary sections track counts. The name also conflates “would change” and “did change,” especially once dry-run behavior is represented.
**Suggestion:** Rename or structure it more explicitly, such as `summary.plugins.enabled = 0` or `summary.plugins.changedCount`, and increment only when a plugin is newly enabled or would be enabled in dry-run.
**Suggestion:** **File:** `src/upgrade.js`
**Issue:** `summary.plugins.changed` is a boolean while other summary sections track counts. The name also conflates “would change” and “did change,” especially once dry-run behavior is represented.
**Suggestion:** Rename or structure it more explicitly, such as `summary.plugins.enabled = 0` or `summary.plugins.changedCount`, and increment only when a plugin is newly enabled or would be enabled in dry-run.
**Rationale:** Loop review proposal.

### 119. 4. Avoid duplicate unavailable-command message construction
**Failure mode:** refactor
**File:** src/senti.js
**Issue:** **File:** `src/senti.js`
**Issue:** The unknown-command branch builds two similar “command unavailable” messages, one for normal unresolved commands and one for plugin resolution failures.
**Suggestion:** Extract the common message prefix or use a small helper like `printUnavailableCommand(subCmd, reason)` so future wording changes stay consistent.
**Suggestion:** **File:** `src/senti.js`
**Issue:** The unknown-command branch builds two similar “command unavailable” messages, one for normal unresolved commands and one for plugin resolution failures.
**Suggestion:** Extract the common message prefix or use a small helper like `printUnavailableCommand(subCmd, reason)` so future wording changes stay consistent.
**Rationale:** Loop review proposal.

### 120. 1. Reuse plugin skill directory resolution
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`
**Issue:** `pluginSkillSourceDirs(root)` loads the plugin registry twice, once before deploying plugin skills and again before cleanup. This duplicates registry IO and can make the two operations see different state if registry contents change mid-upgrade.
**Suggestion:** Resolve once after plugin enablement, e.g. `const pluginSkillsDirs = pluginSkillSourceDirs(root);`, then reuse it for both `deploySkillsFromDir` and `cleanupObsoleteSkills`.
**Suggestion:** **File:** `src/upgrade.js`
**Issue:** `pluginSkillSourceDirs(root)` loads the plugin registry twice, once before deploying plugin skills and again before cleanup. This duplicates registry IO and can make the two operations see different state if registry contents change mid-upgrade.
**Suggestion:** Resolve once after plugin enablement, e.g. `const pluginSkillsDirs = pluginSkillSourceDirs(root);`, then reuse it for both `deploySkillsFromDir` and `cleanupObsoleteSkills`.
**Rationale:** Loop review proposal.

### 121. 2. Preserve dry-run visibility for plugin migration
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`
**Issue:** Official preset/workflow plugin enablement is skipped entirely under `dryRun`, so dry-run output cannot report that upgrade would enable those plugins. This makes migration behavior less transparent.
**Suggestion:** Compute whether each official plugin is needed regardless of `dryRun`, set a dry-run summary/log message for pending plugin changes, and only guard the filesystem-writing `ensureOfficialPackage(...)` calls with `!dryRun`.
**Suggestion:** **File:** `src/upgrade.js`
**Issue:** Official preset/workflow plugin enablement is skipped entirely under `dryRun`, so dry-run output cannot report that upgrade would enable those plugins. This makes migration behavior less transparent.
**Suggestion:** Compute whether each official plugin is needed regardless of `dryRun`, set a dry-run summary/log message for pending plugin changes, and only guard the filesystem-writing `ensureOfficialPackage(...)` calls with `!dryRun`.
**Rationale:** Loop review proposal.

### 122. 3. Clarify plugin change summary semantics
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`
**Issue:** `summary.plugins.changed` is a boolean while other summary sections track counts. The name also conflates “would change” and “did change,” especially once dry-run behavior is represented.
**Suggestion:** Rename or structure it more explicitly, such as `summary.plugins.enabled = 0` or `summary.plugins.changedCount`, and increment only when a plugin is newly enabled or would be enabled in dry-run.
**Suggestion:** **File:** `src/upgrade.js`
**Issue:** `summary.plugins.changed` is a boolean while other summary sections track counts. The name also conflates “would change” and “did change,” especially once dry-run behavior is represented.
**Suggestion:** Rename or structure it more explicitly, such as `summary.plugins.enabled = 0` or `summary.plugins.changedCount`, and increment only when a plugin is newly enabled or would be enabled in dry-run.
**Rationale:** Loop review proposal.

### 123. 4. Avoid duplicate unavailable-command message construction
**Failure mode:** refactor
**File:** src/senti.js
**Issue:** **File:** `src/senti.js`
**Issue:** The unknown-command branch builds two similar “command unavailable” messages, one for normal unresolved commands and one for plugin resolution failures.
**Suggestion:** Extract the common message prefix or use a small helper like `printUnavailableCommand(subCmd, reason)` so future wording changes stay consistent.
**Suggestion:** **File:** `src/senti.js`
**Issue:** The unknown-command branch builds two similar “command unavailable” messages, one for normal unresolved commands and one for plugin resolution failures.
**Suggestion:** Extract the common message prefix or use a small helper like `printUnavailableCommand(subCmd, reason)` so future wording changes stay consistent.
**Rationale:** Loop review proposal.

### 124. 1. Reuse plugin skill directory resolution
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`
**Issue:** `pluginSkillSourceDirs(root)` loads the plugin registry twice, once before deploying plugin skills and again before cleanup. This duplicates registry IO and can make the two operations see different state if registry contents change mid-upgrade.
**Suggestion:** Resolve once after plugin enablement, e.g. `const pluginSkillsDirs = pluginSkillSourceDirs(root);`, then reuse it for both `deploySkillsFromDir` and `cleanupObsoleteSkills`.
**Suggestion:** **File:** `src/upgrade.js`
**Issue:** `pluginSkillSourceDirs(root)` loads the plugin registry twice, once before deploying plugin skills and again before cleanup. This duplicates registry IO and can make the two operations see different state if registry contents change mid-upgrade.
**Suggestion:** Resolve once after plugin enablement, e.g. `const pluginSkillsDirs = pluginSkillSourceDirs(root);`, then reuse it for both `deploySkillsFromDir` and `cleanupObsoleteSkills`.
**Rationale:** Loop review proposal.

### 125. 2. Preserve dry-run visibility for plugin migration
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`
**Issue:** Official preset/workflow plugin enablement is skipped entirely under `dryRun`, so dry-run output cannot report that upgrade would enable those plugins. This makes migration behavior less transparent.
**Suggestion:** Compute whether each official plugin is needed regardless of `dryRun`, set a dry-run summary/log message for pending plugin changes, and only guard the filesystem-writing `ensureOfficialPackage(...)` calls with `!dryRun`.
**Suggestion:** **File:** `src/upgrade.js`
**Issue:** Official preset/workflow plugin enablement is skipped entirely under `dryRun`, so dry-run output cannot report that upgrade would enable those plugins. This makes migration behavior less transparent.
**Suggestion:** Compute whether each official plugin is needed regardless of `dryRun`, set a dry-run summary/log message for pending plugin changes, and only guard the filesystem-writing `ensureOfficialPackage(...)` calls with `!dryRun`.
**Rationale:** Loop review proposal.

### 126. 3. Clarify plugin change summary semantics
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`
**Issue:** `summary.plugins.changed` is a boolean while other summary sections track counts. The name also conflates “would change” and “did change,” especially once dry-run behavior is represented.
**Suggestion:** Rename or structure it more explicitly, such as `summary.plugins.enabled = 0` or `summary.plugins.changedCount`, and increment only when a plugin is newly enabled or would be enabled in dry-run.
**Suggestion:** **File:** `src/upgrade.js`
**Issue:** `summary.plugins.changed` is a boolean while other summary sections track counts. The name also conflates “would change” and “did change,” especially once dry-run behavior is represented.
**Suggestion:** Rename or structure it more explicitly, such as `summary.plugins.enabled = 0` or `summary.plugins.changedCount`, and increment only when a plugin is newly enabled or would be enabled in dry-run.
**Rationale:** Loop review proposal.

### 127. 4. Avoid duplicate unavailable-command message construction
**Failure mode:** refactor
**File:** src/senti.js
**Issue:** **File:** `src/senti.js`
**Issue:** The unknown-command branch builds two similar “command unavailable” messages, one for normal unresolved commands and one for plugin resolution failures.
**Suggestion:** Extract the common message prefix or use a small helper like `printUnavailableCommand(subCmd, reason)` so future wording changes stay consistent.
**Suggestion:** **File:** `src/senti.js`
**Issue:** The unknown-command branch builds two similar “command unavailable” messages, one for normal unresolved commands and one for plugin resolution failures.
**Suggestion:** Extract the common message prefix or use a small helper like `printUnavailableCommand(subCmd, reason)` so future wording changes stay consistent.
**Rationale:** Loop review proposal.

### 128. 1. Reuse plugin skill directory resolution
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`
**Issue:** `pluginSkillSourceDirs(root)` loads the plugin registry twice, once before deploying plugin skills and again before cleanup. This duplicates registry IO and can make the two operations see different state if registry contents change mid-upgrade.
**Suggestion:** Resolve once after plugin enablement, e.g. `const pluginSkillsDirs = pluginSkillSourceDirs(root);`, then reuse it for both `deploySkillsFromDir` and `cleanupObsoleteSkills`.
**Suggestion:** **File:** `src/upgrade.js`
**Issue:** `pluginSkillSourceDirs(root)` loads the plugin registry twice, once before deploying plugin skills and again before cleanup. This duplicates registry IO and can make the two operations see different state if registry contents change mid-upgrade.
**Suggestion:** Resolve once after plugin enablement, e.g. `const pluginSkillsDirs = pluginSkillSourceDirs(root);`, then reuse it for both `deploySkillsFromDir` and `cleanupObsoleteSkills`.
**Rationale:** Loop review proposal.

### 129. 2. Preserve dry-run visibility for plugin migration
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`
**Issue:** Official preset/workflow plugin enablement is skipped entirely under `dryRun`, so dry-run output cannot report that upgrade would enable those plugins. This makes migration behavior less transparent.
**Suggestion:** Compute whether each official plugin is needed regardless of `dryRun`, set a dry-run summary/log message for pending plugin changes, and only guard the filesystem-writing `ensureOfficialPackage(...)` calls with `!dryRun`.
**Suggestion:** **File:** `src/upgrade.js`
**Issue:** Official preset/workflow plugin enablement is skipped entirely under `dryRun`, so dry-run output cannot report that upgrade would enable those plugins. This makes migration behavior less transparent.
**Suggestion:** Compute whether each official plugin is needed regardless of `dryRun`, set a dry-run summary/log message for pending plugin changes, and only guard the filesystem-writing `ensureOfficialPackage(...)` calls with `!dryRun`.
**Rationale:** Loop review proposal.

### 130. 3. Clarify plugin change summary semantics
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`
**Issue:** `summary.plugins.changed` is a boolean while other summary sections track counts. The name also conflates “would change” and “did change,” especially once dry-run behavior is represented.
**Suggestion:** Rename or structure it more explicitly, such as `summary.plugins.enabled = 0` or `summary.plugins.changedCount`, and increment only when a plugin is newly enabled or would be enabled in dry-run.
**Suggestion:** **File:** `src/upgrade.js`
**Issue:** `summary.plugins.changed` is a boolean while other summary sections track counts. The name also conflates “would change” and “did change,” especially once dry-run behavior is represented.
**Suggestion:** Rename or structure it more explicitly, such as `summary.plugins.enabled = 0` or `summary.plugins.changedCount`, and increment only when a plugin is newly enabled or would be enabled in dry-run.
**Rationale:** Loop review proposal.

### 131. 4. Avoid duplicate unavailable-command message construction
**Failure mode:** refactor
**File:** src/senti.js
**Issue:** **File:** `src/senti.js`
**Issue:** The unknown-command branch builds two similar “command unavailable” messages, one for normal unresolved commands and one for plugin resolution failures.
**Suggestion:** Extract the common message prefix or use a small helper like `printUnavailableCommand(subCmd, reason)` so future wording changes stay consistent.
**Suggestion:** **File:** `src/senti.js`
**Issue:** The unknown-command branch builds two similar “command unavailable” messages, one for normal unresolved commands and one for plugin resolution failures.
**Suggestion:** Extract the common message prefix or use a small helper like `printUnavailableCommand(subCmd, reason)` so future wording changes stay consistent.
**Rationale:** Loop review proposal.

### 132. 1. Reuse plugin skill directory resolution
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`
**Issue:** `pluginSkillSourceDirs(root)` loads the plugin registry twice, once before deploying plugin skills and again before cleanup. This duplicates registry IO and can make the two operations see different state if registry contents change mid-upgrade.
**Suggestion:** Resolve once after plugin enablement, e.g. `const pluginSkillsDirs = pluginSkillSourceDirs(root);`, then reuse it for both `deploySkillsFromDir` and `cleanupObsoleteSkills`.
**Suggestion:** **File:** `src/upgrade.js`
**Issue:** `pluginSkillSourceDirs(root)` loads the plugin registry twice, once before deploying plugin skills and again before cleanup. This duplicates registry IO and can make the two operations see different state if registry contents change mid-upgrade.
**Suggestion:** Resolve once after plugin enablement, e.g. `const pluginSkillsDirs = pluginSkillSourceDirs(root);`, then reuse it for both `deploySkillsFromDir` and `cleanupObsoleteSkills`.
**Rationale:** Loop review proposal.

### 133. 2. Preserve dry-run visibility for plugin migration
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`
**Issue:** Official preset/workflow plugin enablement is skipped entirely under `dryRun`, so dry-run output cannot report that upgrade would enable those plugins. This makes migration behavior less transparent.
**Suggestion:** Compute whether each official plugin is needed regardless of `dryRun`, set a dry-run summary/log message for pending plugin changes, and only guard the filesystem-writing `ensureOfficialPackage(...)` calls with `!dryRun`.
**Suggestion:** **File:** `src/upgrade.js`
**Issue:** Official preset/workflow plugin enablement is skipped entirely under `dryRun`, so dry-run output cannot report that upgrade would enable those plugins. This makes migration behavior less transparent.
**Suggestion:** Compute whether each official plugin is needed regardless of `dryRun`, set a dry-run summary/log message for pending plugin changes, and only guard the filesystem-writing `ensureOfficialPackage(...)` calls with `!dryRun`.
**Rationale:** Loop review proposal.

### 134. 3. Clarify plugin change summary semantics
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`
**Issue:** `summary.plugins.changed` is a boolean while other summary sections track counts. The name also conflates “would change” and “did change,” especially once dry-run behavior is represented.
**Suggestion:** Rename or structure it more explicitly, such as `summary.plugins.enabled = 0` or `summary.plugins.changedCount`, and increment only when a plugin is newly enabled or would be enabled in dry-run.
**Suggestion:** **File:** `src/upgrade.js`
**Issue:** `summary.plugins.changed` is a boolean while other summary sections track counts. The name also conflates “would change” and “did change,” especially once dry-run behavior is represented.
**Suggestion:** Rename or structure it more explicitly, such as `summary.plugins.enabled = 0` or `summary.plugins.changedCount`, and increment only when a plugin is newly enabled or would be enabled in dry-run.
**Rationale:** Loop review proposal.

### 135. 4. Avoid duplicate unavailable-command message construction
**Failure mode:** refactor
**File:** src/senti.js
**Issue:** **File:** `src/senti.js`
**Issue:** The unknown-command branch builds two similar “command unavailable” messages, one for normal unresolved commands and one for plugin resolution failures.
**Suggestion:** Extract the common message prefix or use a small helper like `printUnavailableCommand(subCmd, reason)` so future wording changes stay consistent.
**Suggestion:** **File:** `src/senti.js`
**Issue:** The unknown-command branch builds two similar “command unavailable” messages, one for normal unresolved commands and one for plugin resolution failures.
**Suggestion:** Extract the common message prefix or use a small helper like `printUnavailableCommand(subCmd, reason)` so future wording changes stay consistent.
**Rationale:** Loop review proposal.

### 136. 1. Reuse plugin skill directory resolution
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`
**Issue:** `pluginSkillSourceDirs(root)` loads the plugin registry twice, once before deploying plugin skills and again before cleanup. This duplicates registry IO and can make the two operations see different state if registry contents change mid-upgrade.
**Suggestion:** Resolve once after plugin enablement, e.g. `const pluginSkillsDirs = pluginSkillSourceDirs(root);`, then reuse it for both `deploySkillsFromDir` and `cleanupObsoleteSkills`.
**Suggestion:** **File:** `src/upgrade.js`
**Issue:** `pluginSkillSourceDirs(root)` loads the plugin registry twice, once before deploying plugin skills and again before cleanup. This duplicates registry IO and can make the two operations see different state if registry contents change mid-upgrade.
**Suggestion:** Resolve once after plugin enablement, e.g. `const pluginSkillsDirs = pluginSkillSourceDirs(root);`, then reuse it for both `deploySkillsFromDir` and `cleanupObsoleteSkills`.
**Rationale:** Loop review proposal.

### 137. 2. Preserve dry-run visibility for plugin migration
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`
**Issue:** Official preset/workflow plugin enablement is skipped entirely under `dryRun`, so dry-run output cannot report that upgrade would enable those plugins. This makes migration behavior less transparent.
**Suggestion:** Compute whether each official plugin is needed regardless of `dryRun`, set a dry-run summary/log message for pending plugin changes, and only guard the filesystem-writing `ensureOfficialPackage(...)` calls with `!dryRun`.
**Suggestion:** **File:** `src/upgrade.js`
**Issue:** Official preset/workflow plugin enablement is skipped entirely under `dryRun`, so dry-run output cannot report that upgrade would enable those plugins. This makes migration behavior less transparent.
**Suggestion:** Compute whether each official plugin is needed regardless of `dryRun`, set a dry-run summary/log message for pending plugin changes, and only guard the filesystem-writing `ensureOfficialPackage(...)` calls with `!dryRun`.
**Rationale:** Loop review proposal.

### 138. 3. Clarify plugin change summary semantics
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`
**Issue:** `summary.plugins.changed` is a boolean while other summary sections track counts. The name also conflates “would change” and “did change,” especially once dry-run behavior is represented.
**Suggestion:** Rename or structure it more explicitly, such as `summary.plugins.enabled = 0` or `summary.plugins.changedCount`, and increment only when a plugin is newly enabled or would be enabled in dry-run.
**Suggestion:** **File:** `src/upgrade.js`
**Issue:** `summary.plugins.changed` is a boolean while other summary sections track counts. The name also conflates “would change” and “did change,” especially once dry-run behavior is represented.
**Suggestion:** Rename or structure it more explicitly, such as `summary.plugins.enabled = 0` or `summary.plugins.changedCount`, and increment only when a plugin is newly enabled or would be enabled in dry-run.
**Rationale:** Loop review proposal.

### 139. 4. Avoid duplicate unavailable-command message construction
**Failure mode:** refactor
**File:** src/senti.js
**Issue:** **File:** `src/senti.js`
**Issue:** The unknown-command branch builds two similar “command unavailable” messages, one for normal unresolved commands and one for plugin resolution failures.
**Suggestion:** Extract the common message prefix or use a small helper like `printUnavailableCommand(subCmd, reason)` so future wording changes stay consistent.
**Suggestion:** **File:** `src/senti.js`
**Issue:** The unknown-command branch builds two similar “command unavailable” messages, one for normal unresolved commands and one for plugin resolution failures.
**Suggestion:** Extract the common message prefix or use a small helper like `printUnavailableCommand(subCmd, reason)` so future wording changes stay consistent.
**Rationale:** Loop review proposal.

### 140. 1. Reuse plugin skill directory resolution
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`
**Issue:** `pluginSkillSourceDirs(root)` loads the plugin registry twice, once before deploying plugin skills and again before cleanup. This duplicates registry IO and can make the two operations see different state if registry contents change mid-upgrade.
**Suggestion:** Resolve once after plugin enablement, e.g. `const pluginSkillsDirs = pluginSkillSourceDirs(root);`, then reuse it for both `deploySkillsFromDir` and `cleanupObsoleteSkills`.
**Suggestion:** **File:** `src/upgrade.js`
**Issue:** `pluginSkillSourceDirs(root)` loads the plugin registry twice, once before deploying plugin skills and again before cleanup. This duplicates registry IO and can make the two operations see different state if registry contents change mid-upgrade.
**Suggestion:** Resolve once after plugin enablement, e.g. `const pluginSkillsDirs = pluginSkillSourceDirs(root);`, then reuse it for both `deploySkillsFromDir` and `cleanupObsoleteSkills`.
**Rationale:** Loop review proposal.

### 141. 2. Preserve dry-run visibility for plugin migration
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`
**Issue:** Official preset/workflow plugin enablement is skipped entirely under `dryRun`, so dry-run output cannot report that upgrade would enable those plugins. This makes migration behavior less transparent.
**Suggestion:** Compute whether each official plugin is needed regardless of `dryRun`, set a dry-run summary/log message for pending plugin changes, and only guard the filesystem-writing `ensureOfficialPackage(...)` calls with `!dryRun`.
**Suggestion:** **File:** `src/upgrade.js`
**Issue:** Official preset/workflow plugin enablement is skipped entirely under `dryRun`, so dry-run output cannot report that upgrade would enable those plugins. This makes migration behavior less transparent.
**Suggestion:** Compute whether each official plugin is needed regardless of `dryRun`, set a dry-run summary/log message for pending plugin changes, and only guard the filesystem-writing `ensureOfficialPackage(...)` calls with `!dryRun`.
**Rationale:** Loop review proposal.

### 142. 3. Clarify plugin change summary semantics
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`
**Issue:** `summary.plugins.changed` is a boolean while other summary sections track counts. The name also conflates “would change” and “did change,” especially once dry-run behavior is represented.
**Suggestion:** Rename or structure it more explicitly, such as `summary.plugins.enabled = 0` or `summary.plugins.changedCount`, and increment only when a plugin is newly enabled or would be enabled in dry-run.
**Suggestion:** **File:** `src/upgrade.js`
**Issue:** `summary.plugins.changed` is a boolean while other summary sections track counts. The name also conflates “would change” and “did change,” especially once dry-run behavior is represented.
**Suggestion:** Rename or structure it more explicitly, such as `summary.plugins.enabled = 0` or `summary.plugins.changedCount`, and increment only when a plugin is newly enabled or would be enabled in dry-run.
**Rationale:** Loop review proposal.

### 143. 4. Avoid duplicate unavailable-command message construction
**Failure mode:** refactor
**File:** src/senti.js
**Issue:** **File:** `src/senti.js`
**Issue:** The unknown-command branch builds two similar “command unavailable” messages, one for normal unresolved commands and one for plugin resolution failures.
**Suggestion:** Extract the common message prefix or use a small helper like `printUnavailableCommand(subCmd, reason)` so future wording changes stay consistent.
**Suggestion:** **File:** `src/senti.js`
**Issue:** The unknown-command branch builds two similar “command unavailable” messages, one for normal unresolved commands and one for plugin resolution failures.
**Suggestion:** Extract the common message prefix or use a small helper like `printUnavailableCommand(subCmd, reason)` so future wording changes stay consistent.
**Rationale:** Loop review proposal.

### 144. 1. Reuse plugin skill directory resolution
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`
**Issue:** `pluginSkillSourceDirs(root)` loads the plugin registry twice, once before deploying plugin skills and again before cleanup. This duplicates registry IO and can make the two operations see different state if registry contents change mid-upgrade.
**Suggestion:** Resolve once after plugin enablement, e.g. `const pluginSkillsDirs = pluginSkillSourceDirs(root);`, then reuse it for both `deploySkillsFromDir` and `cleanupObsoleteSkills`.
**Suggestion:** **File:** `src/upgrade.js`
**Issue:** `pluginSkillSourceDirs(root)` loads the plugin registry twice, once before deploying plugin skills and again before cleanup. This duplicates registry IO and can make the two operations see different state if registry contents change mid-upgrade.
**Suggestion:** Resolve once after plugin enablement, e.g. `const pluginSkillsDirs = pluginSkillSourceDirs(root);`, then reuse it for both `deploySkillsFromDir` and `cleanupObsoleteSkills`.
**Rationale:** Loop review proposal.

### 145. 2. Preserve dry-run visibility for plugin migration
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`
**Issue:** Official preset/workflow plugin enablement is skipped entirely under `dryRun`, so dry-run output cannot report that upgrade would enable those plugins. This makes migration behavior less transparent.
**Suggestion:** Compute whether each official plugin is needed regardless of `dryRun`, set a dry-run summary/log message for pending plugin changes, and only guard the filesystem-writing `ensureOfficialPackage(...)` calls with `!dryRun`.
**Suggestion:** **File:** `src/upgrade.js`
**Issue:** Official preset/workflow plugin enablement is skipped entirely under `dryRun`, so dry-run output cannot report that upgrade would enable those plugins. This makes migration behavior less transparent.
**Suggestion:** Compute whether each official plugin is needed regardless of `dryRun`, set a dry-run summary/log message for pending plugin changes, and only guard the filesystem-writing `ensureOfficialPackage(...)` calls with `!dryRun`.
**Rationale:** Loop review proposal.

### 146. 3. Clarify plugin change summary semantics
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`
**Issue:** `summary.plugins.changed` is a boolean while other summary sections track counts. The name also conflates “would change” and “did change,” especially once dry-run behavior is represented.
**Suggestion:** Rename or structure it more explicitly, such as `summary.plugins.enabled = 0` or `summary.plugins.changedCount`, and increment only when a plugin is newly enabled or would be enabled in dry-run.
**Suggestion:** **File:** `src/upgrade.js`
**Issue:** `summary.plugins.changed` is a boolean while other summary sections track counts. The name also conflates “would change” and “did change,” especially once dry-run behavior is represented.
**Suggestion:** Rename or structure it more explicitly, such as `summary.plugins.enabled = 0` or `summary.plugins.changedCount`, and increment only when a plugin is newly enabled or would be enabled in dry-run.
**Rationale:** Loop review proposal.

### 147. 4. Avoid duplicate unavailable-command message construction
**Failure mode:** refactor
**File:** src/senti.js
**Issue:** **File:** `src/senti.js`
**Issue:** The unknown-command branch builds two similar “command unavailable” messages, one for normal unresolved commands and one for plugin resolution failures.
**Suggestion:** Extract the common message prefix or use a small helper like `printUnavailableCommand(subCmd, reason)` so future wording changes stay consistent.
**Suggestion:** **File:** `src/senti.js`
**Issue:** The unknown-command branch builds two similar “command unavailable” messages, one for normal unresolved commands and one for plugin resolution failures.
**Suggestion:** Extract the common message prefix or use a small helper like `printUnavailableCommand(subCmd, reason)` so future wording changes stay consistent.
**Rationale:** Loop review proposal.

### 148. 1. Reuse plugin skill directory resolution
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`
**Issue:** `pluginSkillSourceDirs(root)` loads the plugin registry twice, once before deploying plugin skills and again before cleanup. This duplicates registry IO and can make the two operations see different state if registry contents change mid-upgrade.
**Suggestion:** Resolve once after plugin enablement, e.g. `const pluginSkillsDirs = pluginSkillSourceDirs(root);`, then reuse it for both `deploySkillsFromDir` and `cleanupObsoleteSkills`.
**Suggestion:** **File:** `src/upgrade.js`
**Issue:** `pluginSkillSourceDirs(root)` loads the plugin registry twice, once before deploying plugin skills and again before cleanup. This duplicates registry IO and can make the two operations see different state if registry contents change mid-upgrade.
**Suggestion:** Resolve once after plugin enablement, e.g. `const pluginSkillsDirs = pluginSkillSourceDirs(root);`, then reuse it for both `deploySkillsFromDir` and `cleanupObsoleteSkills`.
**Rationale:** Loop review proposal.

### 149. 2. Preserve dry-run visibility for plugin migration
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`
**Issue:** Official preset/workflow plugin enablement is skipped entirely under `dryRun`, so dry-run output cannot report that upgrade would enable those plugins. This makes migration behavior less transparent.
**Suggestion:** Compute whether each official plugin is needed regardless of `dryRun`, set a dry-run summary/log message for pending plugin changes, and only guard the filesystem-writing `ensureOfficialPackage(...)` calls with `!dryRun`.
**Suggestion:** **File:** `src/upgrade.js`
**Issue:** Official preset/workflow plugin enablement is skipped entirely under `dryRun`, so dry-run output cannot report that upgrade would enable those plugins. This makes migration behavior less transparent.
**Suggestion:** Compute whether each official plugin is needed regardless of `dryRun`, set a dry-run summary/log message for pending plugin changes, and only guard the filesystem-writing `ensureOfficialPackage(...)` calls with `!dryRun`.
**Rationale:** Loop review proposal.

### 150. 3. Clarify plugin change summary semantics
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`
**Issue:** `summary.plugins.changed` is a boolean while other summary sections track counts. The name also conflates “would change” and “did change,” especially once dry-run behavior is represented.
**Suggestion:** Rename or structure it more explicitly, such as `summary.plugins.enabled = 0` or `summary.plugins.changedCount`, and increment only when a plugin is newly enabled or would be enabled in dry-run.
**Suggestion:** **File:** `src/upgrade.js`
**Issue:** `summary.plugins.changed` is a boolean while other summary sections track counts. The name also conflates “would change” and “did change,” especially once dry-run behavior is represented.
**Suggestion:** Rename or structure it more explicitly, such as `summary.plugins.enabled = 0` or `summary.plugins.changedCount`, and increment only when a plugin is newly enabled or would be enabled in dry-run.
**Rationale:** Loop review proposal.

### 151. 4. Avoid duplicate unavailable-command message construction
**Failure mode:** refactor
**File:** src/senti.js
**Issue:** **File:** `src/senti.js`
**Issue:** The unknown-command branch builds two similar “command unavailable” messages, one for normal unresolved commands and one for plugin resolution failures.
**Suggestion:** Extract the common message prefix or use a small helper like `printUnavailableCommand(subCmd, reason)` so future wording changes stay consistent.
**Suggestion:** **File:** `src/senti.js`
**Issue:** The unknown-command branch builds two similar “command unavailable” messages, one for normal unresolved commands and one for plugin resolution failures.
**Suggestion:** Extract the common message prefix or use a small helper like `printUnavailableCommand(subCmd, reason)` so future wording changes stay consistent.
**Rationale:** Loop review proposal.

### 152. 1. Reuse plugin skill directory resolution
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`
**Issue:** `pluginSkillSourceDirs(root)` loads the plugin registry twice, once before deploying plugin skills and again before cleanup. This duplicates registry IO and can make the two operations see different state if registry contents change mid-upgrade.
**Suggestion:** Resolve once after plugin enablement, e.g. `const pluginSkillsDirs = pluginSkillSourceDirs(root);`, then reuse it for both `deploySkillsFromDir` and `cleanupObsoleteSkills`.
**Suggestion:** **File:** `src/upgrade.js`
**Issue:** `pluginSkillSourceDirs(root)` loads the plugin registry twice, once before deploying plugin skills and again before cleanup. This duplicates registry IO and can make the two operations see different state if registry contents change mid-upgrade.
**Suggestion:** Resolve once after plugin enablement, e.g. `const pluginSkillsDirs = pluginSkillSourceDirs(root);`, then reuse it for both `deploySkillsFromDir` and `cleanupObsoleteSkills`.
**Rationale:** Loop review proposal.

### 153. 2. Preserve dry-run visibility for plugin migration
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`
**Issue:** Official preset/workflow plugin enablement is skipped entirely under `dryRun`, so dry-run output cannot report that upgrade would enable those plugins. This makes migration behavior less transparent.
**Suggestion:** Compute whether each official plugin is needed regardless of `dryRun`, set a dry-run summary/log message for pending plugin changes, and only guard the filesystem-writing `ensureOfficialPackage(...)` calls with `!dryRun`.
**Suggestion:** **File:** `src/upgrade.js`
**Issue:** Official preset/workflow plugin enablement is skipped entirely under `dryRun`, so dry-run output cannot report that upgrade would enable those plugins. This makes migration behavior less transparent.
**Suggestion:** Compute whether each official plugin is needed regardless of `dryRun`, set a dry-run summary/log message for pending plugin changes, and only guard the filesystem-writing `ensureOfficialPackage(...)` calls with `!dryRun`.
**Rationale:** Loop review proposal.

### 154. 3. Clarify plugin change summary semantics
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`
**Issue:** `summary.plugins.changed` is a boolean while other summary sections track counts. The name also conflates “would change” and “did change,” especially once dry-run behavior is represented.
**Suggestion:** Rename or structure it more explicitly, such as `summary.plugins.enabled = 0` or `summary.plugins.changedCount`, and increment only when a plugin is newly enabled or would be enabled in dry-run.
**Suggestion:** **File:** `src/upgrade.js`
**Issue:** `summary.plugins.changed` is a boolean while other summary sections track counts. The name also conflates “would change” and “did change,” especially once dry-run behavior is represented.
**Suggestion:** Rename or structure it more explicitly, such as `summary.plugins.enabled = 0` or `summary.plugins.changedCount`, and increment only when a plugin is newly enabled or would be enabled in dry-run.
**Rationale:** Loop review proposal.

### 155. 4. Avoid duplicate unavailable-command message construction
**Failure mode:** refactor
**File:** src/senti.js
**Issue:** **File:** `src/senti.js`
**Issue:** The unknown-command branch builds two similar “command unavailable” messages, one for normal unresolved commands and one for plugin resolution failures.
**Suggestion:** Extract the common message prefix or use a small helper like `printUnavailableCommand(subCmd, reason)` so future wording changes stay consistent.
**Suggestion:** **File:** `src/senti.js`
**Issue:** The unknown-command branch builds two similar “command unavailable” messages, one for normal unresolved commands and one for plugin resolution failures.
**Suggestion:** Extract the common message prefix or use a small helper like `printUnavailableCommand(subCmd, reason)` so future wording changes stay consistent.
**Rationale:** Loop review proposal.

### 156. 1. Reuse plugin skill directory resolution
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`
**Issue:** `pluginSkillSourceDirs(root)` loads the plugin registry twice, once before deploying plugin skills and again before cleanup. This duplicates registry IO and can make the two operations see different state if registry contents change mid-upgrade.
**Suggestion:** Resolve once after plugin enablement, e.g. `const pluginSkillsDirs = pluginSkillSourceDirs(root);`, then reuse it for both `deploySkillsFromDir` and `cleanupObsoleteSkills`.
**Suggestion:** **File:** `src/upgrade.js`
**Issue:** `pluginSkillSourceDirs(root)` loads the plugin registry twice, once before deploying plugin skills and again before cleanup. This duplicates registry IO and can make the two operations see different state if registry contents change mid-upgrade.
**Suggestion:** Resolve once after plugin enablement, e.g. `const pluginSkillsDirs = pluginSkillSourceDirs(root);`, then reuse it for both `deploySkillsFromDir` and `cleanupObsoleteSkills`.
**Rationale:** Loop review proposal.

### 157. 2. Preserve dry-run visibility for plugin migration
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`
**Issue:** Official preset/workflow plugin enablement is skipped entirely under `dryRun`, so dry-run output cannot report that upgrade would enable those plugins. This makes migration behavior less transparent.
**Suggestion:** Compute whether each official plugin is needed regardless of `dryRun`, set a dry-run summary/log message for pending plugin changes, and only guard the filesystem-writing `ensureOfficialPackage(...)` calls with `!dryRun`.
**Suggestion:** **File:** `src/upgrade.js`
**Issue:** Official preset/workflow plugin enablement is skipped entirely under `dryRun`, so dry-run output cannot report that upgrade would enable those plugins. This makes migration behavior less transparent.
**Suggestion:** Compute whether each official plugin is needed regardless of `dryRun`, set a dry-run summary/log message for pending plugin changes, and only guard the filesystem-writing `ensureOfficialPackage(...)` calls with `!dryRun`.
**Rationale:** Loop review proposal.

### 158. 3. Clarify plugin change summary semantics
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`
**Issue:** `summary.plugins.changed` is a boolean while other summary sections track counts. The name also conflates “would change” and “did change,” especially once dry-run behavior is represented.
**Suggestion:** Rename or structure it more explicitly, such as `summary.plugins.enabled = 0` or `summary.plugins.changedCount`, and increment only when a plugin is newly enabled or would be enabled in dry-run.
**Suggestion:** **File:** `src/upgrade.js`
**Issue:** `summary.plugins.changed` is a boolean while other summary sections track counts. The name also conflates “would change” and “did change,” especially once dry-run behavior is represented.
**Suggestion:** Rename or structure it more explicitly, such as `summary.plugins.enabled = 0` or `summary.plugins.changedCount`, and increment only when a plugin is newly enabled or would be enabled in dry-run.
**Rationale:** Loop review proposal.

### 159. 4. Avoid duplicate unavailable-command message construction
**Failure mode:** refactor
**File:** src/senti.js
**Issue:** **File:** `src/senti.js`
**Issue:** The unknown-command branch builds two similar “command unavailable” messages, one for normal unresolved commands and one for plugin resolution failures.
**Suggestion:** Extract the common message prefix or use a small helper like `printUnavailableCommand(subCmd, reason)` so future wording changes stay consistent.
**Suggestion:** **File:** `src/senti.js`
**Issue:** The unknown-command branch builds two similar “command unavailable” messages, one for normal unresolved commands and one for plugin resolution failures.
**Suggestion:** Extract the common message prefix or use a small helper like `printUnavailableCommand(subCmd, reason)` so future wording changes stay consistent.
**Rationale:** Loop review proposal.

### 160. 1. Reuse plugin skill directory resolution
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`
**Issue:** `pluginSkillSourceDirs(root)` loads the plugin registry twice, once before deploying plugin skills and again before cleanup. This duplicates registry IO and can make the two operations see different state if registry contents change mid-upgrade.
**Suggestion:** Resolve once after plugin enablement, e.g. `const pluginSkillsDirs = pluginSkillSourceDirs(root);`, then reuse it for both `deploySkillsFromDir` and `cleanupObsoleteSkills`.
**Suggestion:** **File:** `src/upgrade.js`
**Issue:** `pluginSkillSourceDirs(root)` loads the plugin registry twice, once before deploying plugin skills and again before cleanup. This duplicates registry IO and can make the two operations see different state if registry contents change mid-upgrade.
**Suggestion:** Resolve once after plugin enablement, e.g. `const pluginSkillsDirs = pluginSkillSourceDirs(root);`, then reuse it for both `deploySkillsFromDir` and `cleanupObsoleteSkills`.
**Rationale:** Loop review proposal.

### 161. 2. Preserve dry-run visibility for plugin migration
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`
**Issue:** Official preset/workflow plugin enablement is skipped entirely under `dryRun`, so dry-run output cannot report that upgrade would enable those plugins. This makes migration behavior less transparent.
**Suggestion:** Compute whether each official plugin is needed regardless of `dryRun`, set a dry-run summary/log message for pending plugin changes, and only guard the filesystem-writing `ensureOfficialPackage(...)` calls with `!dryRun`.
**Suggestion:** **File:** `src/upgrade.js`
**Issue:** Official preset/workflow plugin enablement is skipped entirely under `dryRun`, so dry-run output cannot report that upgrade would enable those plugins. This makes migration behavior less transparent.
**Suggestion:** Compute whether each official plugin is needed regardless of `dryRun`, set a dry-run summary/log message for pending plugin changes, and only guard the filesystem-writing `ensureOfficialPackage(...)` calls with `!dryRun`.
**Rationale:** Loop review proposal.

### 162. 3. Clarify plugin change summary semantics
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`
**Issue:** `summary.plugins.changed` is a boolean while other summary sections track counts. The name also conflates “would change” and “did change,” especially once dry-run behavior is represented.
**Suggestion:** Rename or structure it more explicitly, such as `summary.plugins.enabled = 0` or `summary.plugins.changedCount`, and increment only when a plugin is newly enabled or would be enabled in dry-run.
**Suggestion:** **File:** `src/upgrade.js`
**Issue:** `summary.plugins.changed` is a boolean while other summary sections track counts. The name also conflates “would change” and “did change,” especially once dry-run behavior is represented.
**Suggestion:** Rename or structure it more explicitly, such as `summary.plugins.enabled = 0` or `summary.plugins.changedCount`, and increment only when a plugin is newly enabled or would be enabled in dry-run.
**Rationale:** Loop review proposal.

### 163. 4. Avoid duplicate unavailable-command message construction
**Failure mode:** refactor
**File:** src/senti.js
**Issue:** **File:** `src/senti.js`
**Issue:** The unknown-command branch builds two similar “command unavailable” messages, one for normal unresolved commands and one for plugin resolution failures.
**Suggestion:** Extract the common message prefix or use a small helper like `printUnavailableCommand(subCmd, reason)` so future wording changes stay consistent.
**Suggestion:** **File:** `src/senti.js`
**Issue:** The unknown-command branch builds two similar “command unavailable” messages, one for normal unresolved commands and one for plugin resolution failures.
**Suggestion:** Extract the common message prefix or use a small helper like `printUnavailableCommand(subCmd, reason)` so future wording changes stay consistent.
**Rationale:** Loop review proposal.

### 164. 1. Reuse plugin skill directory resolution
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`
**Issue:** `pluginSkillSourceDirs(root)` loads the plugin registry twice, once before deploying plugin skills and again before cleanup. This duplicates registry IO and can make the two operations see different state if registry contents change mid-upgrade.
**Suggestion:** Resolve once after plugin enablement, e.g. `const pluginSkillsDirs = pluginSkillSourceDirs(root);`, then reuse it for both `deploySkillsFromDir` and `cleanupObsoleteSkills`.
**Suggestion:** **File:** `src/upgrade.js`
**Issue:** `pluginSkillSourceDirs(root)` loads the plugin registry twice, once before deploying plugin skills and again before cleanup. This duplicates registry IO and can make the two operations see different state if registry contents change mid-upgrade.
**Suggestion:** Resolve once after plugin enablement, e.g. `const pluginSkillsDirs = pluginSkillSourceDirs(root);`, then reuse it for both `deploySkillsFromDir` and `cleanupObsoleteSkills`.
**Rationale:** Loop review proposal.

### 165. 2. Preserve dry-run visibility for plugin migration
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`
**Issue:** Official preset/workflow plugin enablement is skipped entirely under `dryRun`, so dry-run output cannot report that upgrade would enable those plugins. This makes migration behavior less transparent.
**Suggestion:** Compute whether each official plugin is needed regardless of `dryRun`, set a dry-run summary/log message for pending plugin changes, and only guard the filesystem-writing `ensureOfficialPackage(...)` calls with `!dryRun`.
**Suggestion:** **File:** `src/upgrade.js`
**Issue:** Official preset/workflow plugin enablement is skipped entirely under `dryRun`, so dry-run output cannot report that upgrade would enable those plugins. This makes migration behavior less transparent.
**Suggestion:** Compute whether each official plugin is needed regardless of `dryRun`, set a dry-run summary/log message for pending plugin changes, and only guard the filesystem-writing `ensureOfficialPackage(...)` calls with `!dryRun`.
**Rationale:** Loop review proposal.

### 166. 3. Clarify plugin change summary semantics
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`
**Issue:** `summary.plugins.changed` is a boolean while other summary sections track counts. The name also conflates “would change” and “did change,” especially once dry-run behavior is represented.
**Suggestion:** Rename or structure it more explicitly, such as `summary.plugins.enabled = 0` or `summary.plugins.changedCount`, and increment only when a plugin is newly enabled or would be enabled in dry-run.
**Suggestion:** **File:** `src/upgrade.js`
**Issue:** `summary.plugins.changed` is a boolean while other summary sections track counts. The name also conflates “would change” and “did change,” especially once dry-run behavior is represented.
**Suggestion:** Rename or structure it more explicitly, such as `summary.plugins.enabled = 0` or `summary.plugins.changedCount`, and increment only when a plugin is newly enabled or would be enabled in dry-run.
**Rationale:** Loop review proposal.

### 167. 4. Avoid duplicate unavailable-command message construction
**Failure mode:** refactor
**File:** src/senti.js
**Issue:** **File:** `src/senti.js`
**Issue:** The unknown-command branch builds two similar “command unavailable” messages, one for normal unresolved commands and one for plugin resolution failures.
**Suggestion:** Extract the common message prefix or use a small helper like `printUnavailableCommand(subCmd, reason)` so future wording changes stay consistent.
**Suggestion:** **File:** `src/senti.js`
**Issue:** The unknown-command branch builds two similar “command unavailable” messages, one for normal unresolved commands and one for plugin resolution failures.
**Suggestion:** Extract the common message prefix or use a small helper like `printUnavailableCommand(subCmd, reason)` so future wording changes stay consistent.
**Rationale:** Loop review proposal.

### 168. 1. Reuse plugin skill directory resolution
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`
**Issue:** `pluginSkillSourceDirs(root)` loads the plugin registry twice, once before deploying plugin skills and again before cleanup. This duplicates registry IO and can make the two operations see different state if registry contents change mid-upgrade.
**Suggestion:** Resolve once after plugin enablement, e.g. `const pluginSkillsDirs = pluginSkillSourceDirs(root);`, then reuse it for both `deploySkillsFromDir` and `cleanupObsoleteSkills`.
**Suggestion:** **File:** `src/upgrade.js`
**Issue:** `pluginSkillSourceDirs(root)` loads the plugin registry twice, once before deploying plugin skills and again before cleanup. This duplicates registry IO and can make the two operations see different state if registry contents change mid-upgrade.
**Suggestion:** Resolve once after plugin enablement, e.g. `const pluginSkillsDirs = pluginSkillSourceDirs(root);`, then reuse it for both `deploySkillsFromDir` and `cleanupObsoleteSkills`.
**Rationale:** Loop review proposal.

### 169. 2. Preserve dry-run visibility for plugin migration
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`
**Issue:** Official preset/workflow plugin enablement is skipped entirely under `dryRun`, so dry-run output cannot report that upgrade would enable those plugins. This makes migration behavior less transparent.
**Suggestion:** Compute whether each official plugin is needed regardless of `dryRun`, set a dry-run summary/log message for pending plugin changes, and only guard the filesystem-writing `ensureOfficialPackage(...)` calls with `!dryRun`.
**Suggestion:** **File:** `src/upgrade.js`
**Issue:** Official preset/workflow plugin enablement is skipped entirely under `dryRun`, so dry-run output cannot report that upgrade would enable those plugins. This makes migration behavior less transparent.
**Suggestion:** Compute whether each official plugin is needed regardless of `dryRun`, set a dry-run summary/log message for pending plugin changes, and only guard the filesystem-writing `ensureOfficialPackage(...)` calls with `!dryRun`.
**Rationale:** Loop review proposal.

### 170. 3. Clarify plugin change summary semantics
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`
**Issue:** `summary.plugins.changed` is a boolean while other summary sections track counts. The name also conflates “would change” and “did change,” especially once dry-run behavior is represented.
**Suggestion:** Rename or structure it more explicitly, such as `summary.plugins.enabled = 0` or `summary.plugins.changedCount`, and increment only when a plugin is newly enabled or would be enabled in dry-run.
**Suggestion:** **File:** `src/upgrade.js`
**Issue:** `summary.plugins.changed` is a boolean while other summary sections track counts. The name also conflates “would change” and “did change,” especially once dry-run behavior is represented.
**Suggestion:** Rename or structure it more explicitly, such as `summary.plugins.enabled = 0` or `summary.plugins.changedCount`, and increment only when a plugin is newly enabled or would be enabled in dry-run.
**Rationale:** Loop review proposal.

### 171. 4. Avoid duplicate unavailable-command message construction
**Failure mode:** refactor
**File:** src/senti.js
**Issue:** **File:** `src/senti.js`
**Issue:** The unknown-command branch builds two similar “command unavailable” messages, one for normal unresolved commands and one for plugin resolution failures.
**Suggestion:** Extract the common message prefix or use a small helper like `printUnavailableCommand(subCmd, reason)` so future wording changes stay consistent.
**Suggestion:** **File:** `src/senti.js`
**Issue:** The unknown-command branch builds two similar “command unavailable” messages, one for normal unresolved commands and one for plugin resolution failures.
**Suggestion:** Extract the common message prefix or use a small helper like `printUnavailableCommand(subCmd, reason)` so future wording changes stay consistent.
**Rationale:** Loop review proposal.

### 172. 1. Reuse plugin skill directory resolution
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`
**Issue:** `pluginSkillSourceDirs(root)` loads the plugin registry twice, once before deploying plugin skills and again before cleanup. This duplicates registry IO and can make the two operations see different state if registry contents change mid-upgrade.
**Suggestion:** Resolve once after plugin enablement, e.g. `const pluginSkillsDirs = pluginSkillSourceDirs(root);`, then reuse it for both `deploySkillsFromDir` and `cleanupObsoleteSkills`.
**Suggestion:** **File:** `src/upgrade.js`
**Issue:** `pluginSkillSourceDirs(root)` loads the plugin registry twice, once before deploying plugin skills and again before cleanup. This duplicates registry IO and can make the two operations see different state if registry contents change mid-upgrade.
**Suggestion:** Resolve once after plugin enablement, e.g. `const pluginSkillsDirs = pluginSkillSourceDirs(root);`, then reuse it for both `deploySkillsFromDir` and `cleanupObsoleteSkills`.
**Rationale:** Loop review proposal.

### 173. 2. Preserve dry-run visibility for plugin migration
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`
**Issue:** Official preset/workflow plugin enablement is skipped entirely under `dryRun`, so dry-run output cannot report that upgrade would enable those plugins. This makes migration behavior less transparent.
**Suggestion:** Compute whether each official plugin is needed regardless of `dryRun`, set a dry-run summary/log message for pending plugin changes, and only guard the filesystem-writing `ensureOfficialPackage(...)` calls with `!dryRun`.
**Suggestion:** **File:** `src/upgrade.js`
**Issue:** Official preset/workflow plugin enablement is skipped entirely under `dryRun`, so dry-run output cannot report that upgrade would enable those plugins. This makes migration behavior less transparent.
**Suggestion:** Compute whether each official plugin is needed regardless of `dryRun`, set a dry-run summary/log message for pending plugin changes, and only guard the filesystem-writing `ensureOfficialPackage(...)` calls with `!dryRun`.
**Rationale:** Loop review proposal.

### 174. 3. Clarify plugin change summary semantics
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`
**Issue:** `summary.plugins.changed` is a boolean while other summary sections track counts. The name also conflates “would change” and “did change,” especially once dry-run behavior is represented.
**Suggestion:** Rename or structure it more explicitly, such as `summary.plugins.enabled = 0` or `summary.plugins.changedCount`, and increment only when a plugin is newly enabled or would be enabled in dry-run.
**Suggestion:** **File:** `src/upgrade.js`
**Issue:** `summary.plugins.changed` is a boolean while other summary sections track counts. The name also conflates “would change” and “did change,” especially once dry-run behavior is represented.
**Suggestion:** Rename or structure it more explicitly, such as `summary.plugins.enabled = 0` or `summary.plugins.changedCount`, and increment only when a plugin is newly enabled or would be enabled in dry-run.
**Rationale:** Loop review proposal.

### 175. 4. Avoid duplicate unavailable-command message construction
**Failure mode:** refactor
**File:** src/senti.js
**Issue:** **File:** `src/senti.js`
**Issue:** The unknown-command branch builds two similar “command unavailable” messages, one for normal unresolved commands and one for plugin resolution failures.
**Suggestion:** Extract the common message prefix or use a small helper like `printUnavailableCommand(subCmd, reason)` so future wording changes stay consistent.
**Suggestion:** **File:** `src/senti.js`
**Issue:** The unknown-command branch builds two similar “command unavailable” messages, one for normal unresolved commands and one for plugin resolution failures.
**Suggestion:** Extract the common message prefix or use a small helper like `printUnavailableCommand(subCmd, reason)` so future wording changes stay consistent.
**Rationale:** Loop review proposal.

### 176. 1. Reuse plugin skill directory resolution
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`
**Issue:** `pluginSkillSourceDirs(root)` loads the plugin registry twice, once before deploying plugin skills and again before cleanup. This duplicates registry IO and can make the two operations see different state if registry contents change mid-upgrade.
**Suggestion:** Resolve once after plugin enablement, e.g. `const pluginSkillsDirs = pluginSkillSourceDirs(root);`, then reuse it for both `deploySkillsFromDir` and `cleanupObsoleteSkills`.
**Suggestion:** **File:** `src/upgrade.js`
**Issue:** `pluginSkillSourceDirs(root)` loads the plugin registry twice, once before deploying plugin skills and again before cleanup. This duplicates registry IO and can make the two operations see different state if registry contents change mid-upgrade.
**Suggestion:** Resolve once after plugin enablement, e.g. `const pluginSkillsDirs = pluginSkillSourceDirs(root);`, then reuse it for both `deploySkillsFromDir` and `cleanupObsoleteSkills`.
**Rationale:** Loop review proposal.

### 177. 2. Preserve dry-run visibility for plugin migration
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`
**Issue:** Official preset/workflow plugin enablement is skipped entirely under `dryRun`, so dry-run output cannot report that upgrade would enable those plugins. This makes migration behavior less transparent.
**Suggestion:** Compute whether each official plugin is needed regardless of `dryRun`, set a dry-run summary/log message for pending plugin changes, and only guard the filesystem-writing `ensureOfficialPackage(...)` calls with `!dryRun`.
**Suggestion:** **File:** `src/upgrade.js`
**Issue:** Official preset/workflow plugin enablement is skipped entirely under `dryRun`, so dry-run output cannot report that upgrade would enable those plugins. This makes migration behavior less transparent.
**Suggestion:** Compute whether each official plugin is needed regardless of `dryRun`, set a dry-run summary/log message for pending plugin changes, and only guard the filesystem-writing `ensureOfficialPackage(...)` calls with `!dryRun`.
**Rationale:** Loop review proposal.

### 178. 3. Clarify plugin change summary semantics
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`
**Issue:** `summary.plugins.changed` is a boolean while other summary sections track counts. The name also conflates “would change” and “did change,” especially once dry-run behavior is represented.
**Suggestion:** Rename or structure it more explicitly, such as `summary.plugins.enabled = 0` or `summary.plugins.changedCount`, and increment only when a plugin is newly enabled or would be enabled in dry-run.
**Suggestion:** **File:** `src/upgrade.js`
**Issue:** `summary.plugins.changed` is a boolean while other summary sections track counts. The name also conflates “would change” and “did change,” especially once dry-run behavior is represented.
**Suggestion:** Rename or structure it more explicitly, such as `summary.plugins.enabled = 0` or `summary.plugins.changedCount`, and increment only when a plugin is newly enabled or would be enabled in dry-run.
**Rationale:** Loop review proposal.

### 179. 4. Avoid duplicate unavailable-command message construction
**Failure mode:** refactor
**File:** src/senti.js
**Issue:** **File:** `src/senti.js`
**Issue:** The unknown-command branch builds two similar “command unavailable” messages, one for normal unresolved commands and one for plugin resolution failures.
**Suggestion:** Extract the common message prefix or use a small helper like `printUnavailableCommand(subCmd, reason)` so future wording changes stay consistent.
**Suggestion:** **File:** `src/senti.js`
**Issue:** The unknown-command branch builds two similar “command unavailable” messages, one for normal unresolved commands and one for plugin resolution failures.
**Suggestion:** Extract the common message prefix or use a small helper like `printUnavailableCommand(subCmd, reason)` so future wording changes stay consistent.
**Rationale:** Loop review proposal.

### 180. 1. Reuse plugin skill directory resolution
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`
**Issue:** `pluginSkillSourceDirs(root)` loads the plugin registry twice, once before deploying plugin skills and again before cleanup. This duplicates registry IO and can make the two operations see different state if registry contents change mid-upgrade.
**Suggestion:** Resolve once after plugin enablement, e.g. `const pluginSkillsDirs = pluginSkillSourceDirs(root);`, then reuse it for both `deploySkillsFromDir` and `cleanupObsoleteSkills`.
**Suggestion:** **File:** `src/upgrade.js`
**Issue:** `pluginSkillSourceDirs(root)` loads the plugin registry twice, once before deploying plugin skills and again before cleanup. This duplicates registry IO and can make the two operations see different state if registry contents change mid-upgrade.
**Suggestion:** Resolve once after plugin enablement, e.g. `const pluginSkillsDirs = pluginSkillSourceDirs(root);`, then reuse it for both `deploySkillsFromDir` and `cleanupObsoleteSkills`.
**Rationale:** Loop review proposal.

### 181. 2. Preserve dry-run visibility for plugin migration
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`
**Issue:** Official preset/workflow plugin enablement is skipped entirely under `dryRun`, so dry-run output cannot report that upgrade would enable those plugins. This makes migration behavior less transparent.
**Suggestion:** Compute whether each official plugin is needed regardless of `dryRun`, set a dry-run summary/log message for pending plugin changes, and only guard the filesystem-writing `ensureOfficialPackage(...)` calls with `!dryRun`.
**Suggestion:** **File:** `src/upgrade.js`
**Issue:** Official preset/workflow plugin enablement is skipped entirely under `dryRun`, so dry-run output cannot report that upgrade would enable those plugins. This makes migration behavior less transparent.
**Suggestion:** Compute whether each official plugin is needed regardless of `dryRun`, set a dry-run summary/log message for pending plugin changes, and only guard the filesystem-writing `ensureOfficialPackage(...)` calls with `!dryRun`.
**Rationale:** Loop review proposal.

### 182. 3. Clarify plugin change summary semantics
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`
**Issue:** `summary.plugins.changed` is a boolean while other summary sections track counts. The name also conflates “would change” and “did change,” especially once dry-run behavior is represented.
**Suggestion:** Rename or structure it more explicitly, such as `summary.plugins.enabled = 0` or `summary.plugins.changedCount`, and increment only when a plugin is newly enabled or would be enabled in dry-run.
**Suggestion:** **File:** `src/upgrade.js`
**Issue:** `summary.plugins.changed` is a boolean while other summary sections track counts. The name also conflates “would change” and “did change,” especially once dry-run behavior is represented.
**Suggestion:** Rename or structure it more explicitly, such as `summary.plugins.enabled = 0` or `summary.plugins.changedCount`, and increment only when a plugin is newly enabled or would be enabled in dry-run.
**Rationale:** Loop review proposal.

### 183. 4. Avoid duplicate unavailable-command message construction
**Failure mode:** refactor
**File:** src/senti.js
**Issue:** **File:** `src/senti.js`
**Issue:** The unknown-command branch builds two similar “command unavailable” messages, one for normal unresolved commands and one for plugin resolution failures.
**Suggestion:** Extract the common message prefix or use a small helper like `printUnavailableCommand(subCmd, reason)` so future wording changes stay consistent.
**Suggestion:** **File:** `src/senti.js`
**Issue:** The unknown-command branch builds two similar “command unavailable” messages, one for normal unresolved commands and one for plugin resolution failures.
**Suggestion:** Extract the common message prefix or use a small helper like `printUnavailableCommand(subCmd, reason)` so future wording changes stay consistent.
**Rationale:** Loop review proposal.

### 184. 1. Reuse plugin skill directory resolution
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`
**Issue:** `pluginSkillSourceDirs(root)` loads the plugin registry twice, once before deploying plugin skills and again before cleanup. This duplicates registry IO and can make the two operations see different state if registry contents change mid-upgrade.
**Suggestion:** Resolve once after plugin enablement, e.g. `const pluginSkillsDirs = pluginSkillSourceDirs(root);`, then reuse it for both `deploySkillsFromDir` and `cleanupObsoleteSkills`.
**Suggestion:** **File:** `src/upgrade.js`
**Issue:** `pluginSkillSourceDirs(root)` loads the plugin registry twice, once before deploying plugin skills and again before cleanup. This duplicates registry IO and can make the two operations see different state if registry contents change mid-upgrade.
**Suggestion:** Resolve once after plugin enablement, e.g. `const pluginSkillsDirs = pluginSkillSourceDirs(root);`, then reuse it for both `deploySkillsFromDir` and `cleanupObsoleteSkills`.
**Rationale:** Loop review proposal.

### 185. 2. Preserve dry-run visibility for plugin migration
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`
**Issue:** Official preset/workflow plugin enablement is skipped entirely under `dryRun`, so dry-run output cannot report that upgrade would enable those plugins. This makes migration behavior less transparent.
**Suggestion:** Compute whether each official plugin is needed regardless of `dryRun`, set a dry-run summary/log message for pending plugin changes, and only guard the filesystem-writing `ensureOfficialPackage(...)` calls with `!dryRun`.
**Suggestion:** **File:** `src/upgrade.js`
**Issue:** Official preset/workflow plugin enablement is skipped entirely under `dryRun`, so dry-run output cannot report that upgrade would enable those plugins. This makes migration behavior less transparent.
**Suggestion:** Compute whether each official plugin is needed regardless of `dryRun`, set a dry-run summary/log message for pending plugin changes, and only guard the filesystem-writing `ensureOfficialPackage(...)` calls with `!dryRun`.
**Rationale:** Loop review proposal.

### 186. 3. Clarify plugin change summary semantics
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`
**Issue:** `summary.plugins.changed` is a boolean while other summary sections track counts. The name also conflates “would change” and “did change,” especially once dry-run behavior is represented.
**Suggestion:** Rename or structure it more explicitly, such as `summary.plugins.enabled = 0` or `summary.plugins.changedCount`, and increment only when a plugin is newly enabled or would be enabled in dry-run.
**Suggestion:** **File:** `src/upgrade.js`
**Issue:** `summary.plugins.changed` is a boolean while other summary sections track counts. The name also conflates “would change” and “did change,” especially once dry-run behavior is represented.
**Suggestion:** Rename or structure it more explicitly, such as `summary.plugins.enabled = 0` or `summary.plugins.changedCount`, and increment only when a plugin is newly enabled or would be enabled in dry-run.
**Rationale:** Loop review proposal.

### 187. 4. Avoid duplicate unavailable-command message construction
**Failure mode:** refactor
**File:** src/senti.js
**Issue:** **File:** `src/senti.js`
**Issue:** The unknown-command branch builds two similar “command unavailable” messages, one for normal unresolved commands and one for plugin resolution failures.
**Suggestion:** Extract the common message prefix or use a small helper like `printUnavailableCommand(subCmd, reason)` so future wording changes stay consistent.
**Suggestion:** **File:** `src/senti.js`
**Issue:** The unknown-command branch builds two similar “command unavailable” messages, one for normal unresolved commands and one for plugin resolution failures.
**Suggestion:** Extract the common message prefix or use a small helper like `printUnavailableCommand(subCmd, reason)` so future wording changes stay consistent.
**Rationale:** Loop review proposal.

### 188. 1. Reuse plugin skill directory resolution
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`
**Issue:** `pluginSkillSourceDirs(root)` loads the plugin registry twice, once before deploying plugin skills and again before cleanup. This duplicates registry IO and can make the two operations see different state if registry contents change mid-upgrade.
**Suggestion:** Resolve once after plugin enablement, e.g. `const pluginSkillsDirs = pluginSkillSourceDirs(root);`, then reuse it for both `deploySkillsFromDir` and `cleanupObsoleteSkills`.
**Suggestion:** **File:** `src/upgrade.js`
**Issue:** `pluginSkillSourceDirs(root)` loads the plugin registry twice, once before deploying plugin skills and again before cleanup. This duplicates registry IO and can make the two operations see different state if registry contents change mid-upgrade.
**Suggestion:** Resolve once after plugin enablement, e.g. `const pluginSkillsDirs = pluginSkillSourceDirs(root);`, then reuse it for both `deploySkillsFromDir` and `cleanupObsoleteSkills`.
**Rationale:** Loop review proposal.

### 189. 2. Preserve dry-run visibility for plugin migration
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`
**Issue:** Official preset/workflow plugin enablement is skipped entirely under `dryRun`, so dry-run output cannot report that upgrade would enable those plugins. This makes migration behavior less transparent.
**Suggestion:** Compute whether each official plugin is needed regardless of `dryRun`, set a dry-run summary/log message for pending plugin changes, and only guard the filesystem-writing `ensureOfficialPackage(...)` calls with `!dryRun`.
**Suggestion:** **File:** `src/upgrade.js`
**Issue:** Official preset/workflow plugin enablement is skipped entirely under `dryRun`, so dry-run output cannot report that upgrade would enable those plugins. This makes migration behavior less transparent.
**Suggestion:** Compute whether each official plugin is needed regardless of `dryRun`, set a dry-run summary/log message for pending plugin changes, and only guard the filesystem-writing `ensureOfficialPackage(...)` calls with `!dryRun`.
**Rationale:** Loop review proposal.

### 190. 3. Clarify plugin change summary semantics
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`
**Issue:** `summary.plugins.changed` is a boolean while other summary sections track counts. The name also conflates “would change” and “did change,” especially once dry-run behavior is represented.
**Suggestion:** Rename or structure it more explicitly, such as `summary.plugins.enabled = 0` or `summary.plugins.changedCount`, and increment only when a plugin is newly enabled or would be enabled in dry-run.
**Suggestion:** **File:** `src/upgrade.js`
**Issue:** `summary.plugins.changed` is a boolean while other summary sections track counts. The name also conflates “would change” and “did change,” especially once dry-run behavior is represented.
**Suggestion:** Rename or structure it more explicitly, such as `summary.plugins.enabled = 0` or `summary.plugins.changedCount`, and increment only when a plugin is newly enabled or would be enabled in dry-run.
**Rationale:** Loop review proposal.

### 191. 4. Avoid duplicate unavailable-command message construction
**Failure mode:** refactor
**File:** src/senti.js
**Issue:** **File:** `src/senti.js`
**Issue:** The unknown-command branch builds two similar “command unavailable” messages, one for normal unresolved commands and one for plugin resolution failures.
**Suggestion:** Extract the common message prefix or use a small helper like `printUnavailableCommand(subCmd, reason)` so future wording changes stay consistent.
**Suggestion:** **File:** `src/senti.js`
**Issue:** The unknown-command branch builds two similar “command unavailable” messages, one for normal unresolved commands and one for plugin resolution failures.
**Suggestion:** Extract the common message prefix or use a small helper like `printUnavailableCommand(subCmd, reason)` so future wording changes stay consistent.
**Rationale:** Loop review proposal.

### 192. 1. Reuse plugin skill directory resolution
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`
**Issue:** `pluginSkillSourceDirs(root)` loads the plugin registry twice, once before deploying plugin skills and again before cleanup. This duplicates registry IO and can make the two operations see different state if registry contents change mid-upgrade.
**Suggestion:** Resolve once after plugin enablement, e.g. `const pluginSkillsDirs = pluginSkillSourceDirs(root);`, then reuse it for both `deploySkillsFromDir` and `cleanupObsoleteSkills`.
**Suggestion:** **File:** `src/upgrade.js`
**Issue:** `pluginSkillSourceDirs(root)` loads the plugin registry twice, once before deploying plugin skills and again before cleanup. This duplicates registry IO and can make the two operations see different state if registry contents change mid-upgrade.
**Suggestion:** Resolve once after plugin enablement, e.g. `const pluginSkillsDirs = pluginSkillSourceDirs(root);`, then reuse it for both `deploySkillsFromDir` and `cleanupObsoleteSkills`.
**Rationale:** Loop review proposal.

### 193. 2. Preserve dry-run visibility for plugin migration
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`
**Issue:** Official preset/workflow plugin enablement is skipped entirely under `dryRun`, so dry-run output cannot report that upgrade would enable those plugins. This makes migration behavior less transparent.
**Suggestion:** Compute whether each official plugin is needed regardless of `dryRun`, set a dry-run summary/log message for pending plugin changes, and only guard the filesystem-writing `ensureOfficialPackage(...)` calls with `!dryRun`.
**Suggestion:** **File:** `src/upgrade.js`
**Issue:** Official preset/workflow plugin enablement is skipped entirely under `dryRun`, so dry-run output cannot report that upgrade would enable those plugins. This makes migration behavior less transparent.
**Suggestion:** Compute whether each official plugin is needed regardless of `dryRun`, set a dry-run summary/log message for pending plugin changes, and only guard the filesystem-writing `ensureOfficialPackage(...)` calls with `!dryRun`.
**Rationale:** Loop review proposal.

### 194. 3. Clarify plugin change summary semantics
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`
**Issue:** `summary.plugins.changed` is a boolean while other summary sections track counts. The name also conflates “would change” and “did change,” especially once dry-run behavior is represented.
**Suggestion:** Rename or structure it more explicitly, such as `summary.plugins.enabled = 0` or `summary.plugins.changedCount`, and increment only when a plugin is newly enabled or would be enabled in dry-run.
**Suggestion:** **File:** `src/upgrade.js`
**Issue:** `summary.plugins.changed` is a boolean while other summary sections track counts. The name also conflates “would change” and “did change,” especially once dry-run behavior is represented.
**Suggestion:** Rename or structure it more explicitly, such as `summary.plugins.enabled = 0` or `summary.plugins.changedCount`, and increment only when a plugin is newly enabled or would be enabled in dry-run.
**Rationale:** Loop review proposal.

### 195. 4. Avoid duplicate unavailable-command message construction
**Failure mode:** refactor
**File:** src/senti.js
**Issue:** **File:** `src/senti.js`
**Issue:** The unknown-command branch builds two similar “command unavailable” messages, one for normal unresolved commands and one for plugin resolution failures.
**Suggestion:** Extract the common message prefix or use a small helper like `printUnavailableCommand(subCmd, reason)` so future wording changes stay consistent.
**Suggestion:** **File:** `src/senti.js`
**Issue:** The unknown-command branch builds two similar “command unavailable” messages, one for normal unresolved commands and one for plugin resolution failures.
**Suggestion:** Extract the common message prefix or use a small helper like `printUnavailableCommand(subCmd, reason)` so future wording changes stay consistent.
**Rationale:** Loop review proposal.

### 196. 4. Avoid duplicate unavailable-command message construction
**Failure mode:** refactor
**File:** src/senti.js
**Issue:** **File:** `src/senti.js`
**Issue:** The unknown-command branch builds two similar “command unavailable” messages, one for normal unresolved commands and one for plugin resolution failures.
**Suggestion:** Extract the common message prefix or use a small helper like `printUnavailableCommand(subCmd, reason)` so future wording changes stay consistent.
**Suggestion:** **File:** `src/senti.js`
**Issue:** The unknown-command branch builds two similar “command unavailable” messages, one for normal unresolved commands and one for plugin resolution failures.
**Suggestion:** Extract the common message prefix or use a small helper like `printUnavailableCommand(subCmd, reason)` so future wording changes stay consistent.
**Rationale:** Loop review proposal.

### 197. 1. Reuse plugin skill directory resolution
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`
**Issue:** `pluginSkillSourceDirs(root)` loads the plugin registry twice, once before deploying plugin skills and again before cleanup. This duplicates registry IO and can make the two operations see different state if registry contents change mid-upgrade.
**Suggestion:** Resolve once after plugin enablement, e.g. `const pluginSkillsDirs = pluginSkillSourceDirs(root);`, then reuse it for both `deploySkillsFromDir` and `cleanupObsoleteSkills`.
**Suggestion:** **File:** `src/upgrade.js`
**Issue:** `pluginSkillSourceDirs(root)` loads the plugin registry twice, once before deploying plugin skills and again before cleanup. This duplicates registry IO and can make the two operations see different state if registry contents change mid-upgrade.
**Suggestion:** Resolve once after plugin enablement, e.g. `const pluginSkillsDirs = pluginSkillSourceDirs(root);`, then reuse it for both `deploySkillsFromDir` and `cleanupObsoleteSkills`.
**Rationale:** Loop review proposal.

### 198. 2. Preserve dry-run visibility for plugin migration
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`
**Issue:** Official preset/workflow plugin enablement is skipped entirely under `dryRun`, so dry-run output cannot report that upgrade would enable those plugins. This makes migration behavior less transparent.
**Suggestion:** Compute whether each official plugin is needed regardless of `dryRun`, set a dry-run summary/log message for pending plugin changes, and only guard the filesystem-writing `ensureOfficialPackage(...)` calls with `!dryRun`.
**Suggestion:** **File:** `src/upgrade.js`
**Issue:** Official preset/workflow plugin enablement is skipped entirely under `dryRun`, so dry-run output cannot report that upgrade would enable those plugins. This makes migration behavior less transparent.
**Suggestion:** Compute whether each official plugin is needed regardless of `dryRun`, set a dry-run summary/log message for pending plugin changes, and only guard the filesystem-writing `ensureOfficialPackage(...)` calls with `!dryRun`.
**Rationale:** Loop review proposal.

### 199. 3. Clarify plugin change summary semantics
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`
**Issue:** `summary.plugins.changed` is a boolean while other summary sections track counts. The name also conflates “would change” and “did change,” especially once dry-run behavior is represented.
**Suggestion:** Rename or structure it more explicitly, such as `summary.plugins.enabled = 0` or `summary.plugins.changedCount`, and increment only when a plugin is newly enabled or would be enabled in dry-run.
**Suggestion:** **File:** `src/upgrade.js`
**Issue:** `summary.plugins.changed` is a boolean while other summary sections track counts. The name also conflates “would change” and “did change,” especially once dry-run behavior is represented.
**Suggestion:** Rename or structure it more explicitly, such as `summary.plugins.enabled = 0` or `summary.plugins.changedCount`, and increment only when a plugin is newly enabled or would be enabled in dry-run.
**Rationale:** Loop review proposal.

### 200. 4. Avoid duplicate unavailable-command message construction
**Failure mode:** refactor
**File:** src/senti.js
**Issue:** **File:** `src/senti.js`
**Issue:** The unknown-command branch builds two similar “command unavailable” messages, one for normal unresolved commands and one for plugin resolution failures.
**Suggestion:** Extract the common message prefix or use a small helper like `printUnavailableCommand(subCmd, reason)` so future wording changes stay consistent.
**Suggestion:** **File:** `src/senti.js`
**Issue:** The unknown-command branch builds two similar “command unavailable” messages, one for normal unresolved commands and one for plugin resolution failures.
**Suggestion:** Extract the common message prefix or use a small helper like `printUnavailableCommand(subCmd, reason)` so future wording changes stay consistent.
**Rationale:** Loop review proposal.

### 201. 1. Reuse plugin skill directory resolution
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`
**Issue:** `pluginSkillSourceDirs(root)` loads the plugin registry twice, once before deploying plugin skills and again before cleanup. This duplicates registry IO and can make the two operations see different state if registry contents change mid-upgrade.
**Suggestion:** Resolve once after plugin enablement, e.g. `const pluginSkillsDirs = pluginSkillSourceDirs(root);`, then reuse it for both `deploySkillsFromDir` and `cleanupObsoleteSkills`.
**Suggestion:** **File:** `src/upgrade.js`
**Issue:** `pluginSkillSourceDirs(root)` loads the plugin registry twice, once before deploying plugin skills and again before cleanup. This duplicates registry IO and can make the two operations see different state if registry contents change mid-upgrade.
**Suggestion:** Resolve once after plugin enablement, e.g. `const pluginSkillsDirs = pluginSkillSourceDirs(root);`, then reuse it for both `deploySkillsFromDir` and `cleanupObsoleteSkills`.
**Rationale:** Loop review proposal.

### 202. 2. Preserve dry-run visibility for plugin migration
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`
**Issue:** Official preset/workflow plugin enablement is skipped entirely under `dryRun`, so dry-run output cannot report that upgrade would enable those plugins. This makes migration behavior less transparent.
**Suggestion:** Compute whether each official plugin is needed regardless of `dryRun`, set a dry-run summary/log message for pending plugin changes, and only guard the filesystem-writing `ensureOfficialPackage(...)` calls with `!dryRun`.
**Suggestion:** **File:** `src/upgrade.js`
**Issue:** Official preset/workflow plugin enablement is skipped entirely under `dryRun`, so dry-run output cannot report that upgrade would enable those plugins. This makes migration behavior less transparent.
**Suggestion:** Compute whether each official plugin is needed regardless of `dryRun`, set a dry-run summary/log message for pending plugin changes, and only guard the filesystem-writing `ensureOfficialPackage(...)` calls with `!dryRun`.
**Rationale:** Loop review proposal.

### 203. 3. Clarify plugin change summary semantics
**Failure mode:** refactor
**File:** src/upgrade.js
**Issue:** **File:** `src/upgrade.js`
**Issue:** `summary.plugins.changed` is a boolean while other summary sections track counts. The name also conflates “would change” and “did change,” especially once dry-run behavior is represented.
**Suggestion:** Rename or structure it more explicitly, such as `summary.plugins.enabled = 0` or `summary.plugins.changedCount`, and increment only when a plugin is newly enabled or would be enabled in dry-run.
**Suggestion:** **File:** `src/upgrade.js`
**Issue:** `summary.plugins.changed` is a boolean while other summary sections track counts. The name also conflates “would change” and “did change,” especially once dry-run behavior is represented.
**Suggestion:** Rename or structure it more explicitly, such as `summary.plugins.enabled = 0` or `summary.plugins.changedCount`, and increment only when a plugin is newly enabled or would be enabled in dry-run.
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
