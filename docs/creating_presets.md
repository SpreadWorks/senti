# Preset Creation Guide

This document is the procedure guide for creating a new sennel preset as either **built-in (`src/presets/<key>/`)** or **project-local (`.sennel/presets/<key>/`)**. It covers specifications, procedures, pitfalls, and validation commands so that an AI agent can assemble a preset end-to-end by reading this document alone.

The intended reader is a developer or AI who already understands the sennel internal architecture (`src/CLAUDE.md` / `src/AGENTS.md`) and needs to build a preset for a new framework or project structure.

---

## 1. What is a Preset?

A preset bundles framework-specific "scan settings + DataSources + templates" into a package. It forms a **single-inheritance chain** via the `parent` field in `preset.json`, and child presets override the parent's settings, DataSources, and templates.

Inheritance chain examples:

```
base → webapp → php-webapp → symfony
base → webapp → js-webapp → nextjs
base → cli → node-cli
base → api → graphql
```

When you list multiple presets in the `type` array of `.sennel/config.json`, each preset's inheritance chain is resolved **independently**, and chapters, DataSources, and templates are merged (no parent relationship between presets is required).

```json
{ "type": ["spread-commerce", "graphql", "monorepo"] }
```

---

## 2. Decision Flow

Before starting the implementation, decide where and what kind of preset to create.

### 2.1 Built-in or Project-Local?

| Condition | Location |
|---|---|
| Generic framework/library support (reusable) | `src/presets/<key>/` (built-in) |
| Specific to one project's directory structure / customization | `.sennel/presets/<key>/` (project-local) |

**Project-local presets are leaf-only.** The `parent` chain always points to built-in presets (inheritance among project-local presets is not supported).

### 2.2 Extend an Existing Preset or Create a New One?

1. Check `src/presets/` for a suitable parent candidate (`webapp`, `php-webapp`, `js-webapp`, `symfony`, `laravel`, `cakephp2`, `nextjs`, `hono`, `node-cli`, `database`, `api/graphql`, etc.).
2. Specify the closest preset as `parent`. If nothing fits, start from an upper-level preset such as `base` / `webapp` / `cli`.
3. If the parent has a DataSource or template with the same name, the child overrides it (last-wins).

---

## 3. Directory Layout

```
<preset-root>/<key>/
├── preset.json              Required: metadata, chapters, scan patterns
├── guardrail.json           Optional: spec / impl guardrail rules
├── data/                    DataSource modules (scan + resolve in one)
│   └── <category>.js        1 file = 1 category (default export is the Source class)
├── templates/
│   ├── ja/                  Chapter templates per language
│   │   ├── overview.md
│   │   ├── controller_routes.md
│   │   └── ...
│   └── en/
└── tests/                   Required for built-in presets
    ├── unit/                Unit tests (scan parser I/O)
    ├── e2e/                 Full-scan pipeline tests
    └── acceptance/          Fixture-based acceptance tests
        └── test.js
```

For project-local presets (`.sennel/presets/<key>/`), `tests/` is not required.

**Note**: Previously there was a `scan/` directory that held scan parsers separately, but this layout has been abolished. Scan logic now lives inside the `Scannable` DataSource (`match` / `parse`) in `data/<category>.js`.

---

## 4. preset.json Schema

```json
{
  "parent": "symfony",
  "label": "Spread Commerce (EC-CUBE 4.x + Next.js)",
  "aliases": ["eccube"],
  "chapters": [
    { "chapter": "overview.md", "desc": "Overview" },
    { "chapter": "controller_routes.md", "desc": "Controllers and routing" }
  ],
  "scan": {
    "include": ["src/backend/app/Customize/**/*.php"],
    "exclude": ["src/backend/app/Plugin/*/vendor/**"]
  }
}
```

| Field | Required | Description |
|---|---|---|
| `parent` | Optional | Parent preset key. Omit for a standalone preset |
| `label` | Recommended | Display name |
| `aliases` | Optional | Alternative names that can appear in `type` of `config.json` |
| `chapters` | Optional | Chapter order and descriptions. Accepts either a string array `["overview.md", ...]` or an array of `{chapter, desc}` objects. Inherits `chapters` from the parent when omitted |
| `scan.include` | Optional | Scan target globs (POSIX separator) |
| `scan.exclude` | Optional | Exclusion globs |

### 4.1 How `chapters` Works

- Chapter names declared in `chapters` must have a matching file in the preset's own `templates/<lang>/` or an ancestor's (otherwise the gate FAILs).
- When multiple presets are listed in `type` of `config.json`, chapter order is **unioned starting from the first preset**. **Place the most specific (leaf) preset first.**

### 4.2 `scan` Patterns

- Separator is always `/` (even on Windows).
- `**` matches any depth, `*` matches any single path segment character.
- The parent's `scan` is merged (additive). To exclude something from the parent, use `exclude`.

### 4.3 guardrail.json (optional)

A file declaring preset-specific design principles and prohibitions. AI uses it for checks in the SDD flow's `plan.gate` / `impl.review`. Independent of the docs generation pipeline.

```json
{
  "guardrails": [
    {
      "id": "use-parameterized-queries",
      "title": "Use Parameterized Queries",
      "body": "DQL and QueryBuilder shall use parameter bindings. String concatenation in queries is prohibited.",
      "meta": { "phase": ["spec", "impl"] }
    }
  ]
}
```

| Field | Required | Description |
|---|---|---|
| `id` | ✅ | Unique identifier (kebab-case) |
| `title` | ✅ | Short heading |
| `body` | ✅ | Concrete rule text (English recommended; the SDD flow translates to other languages) |
| `meta.phase` | ✅ | The phases the rule applies to. Array of `"spec"` (spec gate) / `"impl"` (impl review) |

**Guidelines for writing rules:**

- Write as "what is prohibited / what must be done," not as "what is ideal" (makes AI violation detection easier)
- Separate framework axis (e.g., symfony's DTO usage) from principle axis (e.g., SOLID in the principle preset). Do not duplicate the same rule across presets
- Parent guardrails are inherited (merged), so do not repeat a parent's rule in the child
- Do not write mechanical rules that a linter could enforce (indent, naming conventions). Reserve guardrails for rules that require AI judgment

### 4.4 overrides.json (project root, optional)

**Placed at `.sennel/overrides.json`, not inside a preset** — a single dictionary file for the whole project. Use it to manually fix the description text returned by DataSource entries (it takes precedence over enrich's AI-generated summaries).

```json
{
  "tables": {
    "contents": "Content table (per video episode)",
    "contracts": "Rights holder contract data"
  },
  "controllers": {
    "UserController": "User authentication and profile management"
  }
}
```

- Level 1 = **section name** (typically the DataSource category name)
- Level 2 = **entry key** (class name, table name, etc.; the value of the field referenced by the DataSource's `keyField`, default `className`)
- Value = **string** (description; not an object)

The `DataSource` base class `mergeDesc(items, section, keyField)` merges these into each item's `summary`. `desc(section, key)` returns individual descriptions (or `"—"` when undefined).

Not required when creating a preset — it's a file for gradually replacing AI-generated descriptions with human-authored text during project operation.

---

## 5. DataSource Implementation

### 5.1 Two Kinds of DataSource

**(A) Scannable DataSource (scan and data combined)**

`match()` picks up files, and `parse()` returns parse results. The scan pipeline writes the returned entries to `analysis[category].entries` and automatically fills common fields (`file` / `hash` / `lines` / `mtime`). Resolve methods (`list()`, etc.) read `analysis` and produce output.

```javascript
import { DataSource, Scannable, AnalysisEntry } from "sennel/api";

export class ControllerEntry extends AnalysisEntry {
  className = null;
  route = null;
  action = null;
  static summary = {};
}

export default class MyControllersSource extends Scannable(DataSource) {
  static Entry = ControllerEntry;

  match(relPath) {
    return relPath.startsWith("src/Controller/") && relPath.endsWith(".php");
  }

  parse(absPath) {
    const entry = new ControllerEntry();
    // Parse and fill fields
    return entry;
  }

  list(analysis, labels) {
    const items = analysis.controllers?.entries ?? [];
    if (items.length === 0) return null;
    const rows = this.toRows(items, (c) => [c.className, c.file, c.action ?? "—"]);
    return this.toMarkdownTable(rows, labels);
  }
}
```

**(B) Data-only DataSource (reads analysis written by another scan)**

Does not have `match()` / `parse()`; implements only resolve methods. **The analysis key it reads must be written by a scan DataSource somewhere in the chain** (do not create one if no such scan exists).

```javascript
import { DataSource } from "sennel/api";

export default class SchemaSource extends DataSource {
  tables(analysis, labels) {
    const tables = analysis.schemas?.tables ?? [];
    if (tables.length === 0) return null;
    const rows = tables.map((t) => [t.name, t.columns.length]);
    return this.toMarkdownTable(rows, labels);
  }
}
```

### 5.2 `match(relPath)` Contract

- `relPath` is the path relative to the scan root (`SDD_SOURCE_ROOT`).
- Separator is always `/` (POSIX). It is not converted to `\` on Windows.
- No leading `./` (e.g. `src/Controller/UserController.php`).
- Returns boolean.

### 5.3 `parse(absPath)` Contract

- Argument is an absolute path. Read via `fs.readFileSync(absPath, "utf8")`.
- Returns `new this.constructor.Entry()` or `null`.
- Initialize `Entry` fields with `null` (for `isEmptyEntry` detection).

### 5.4 Resolve Method Return Value

Returns a **Markdown string or `null`**. Always return `null` when there is no data (do not render broken empty tables).

Helpers provided by the base class:

| Method | Purpose |
|---|---|
| `toRows(items, mapper)` | Convert an item array to a row array |
| `toMarkdownTable(rows, labels)` | Generate a Markdown table string from rows and label arrays (pipe characters are auto-escaped; `null`/`undefined` becomes `—`) |
| `mergeDesc(items, section, keyField)` | Read descriptions from the given section of `.sennel/overrides.json` and merge them into each item's `summary`, returning a new array |
| `desc(section, key)` | Look up an individual description from `.sennel/overrides.json` (returns `"—"` when undefined) |

### 5.5 Resolve Method Invocation Rules

A template's `{{data("<preset>.<category>.<method>", {labels: "A|B|C"})}}` calls `dataSources.get(category).method(analysis, labels)`.

- The pipe-separated `labels` string is split into an array `["A", "B", "C"]` before the resolve method is called, so the method receives an **array** (which can be passed directly to `toMarkdownTable`).
- Category name = file name of `data/<category>.js` (without `.js`).

---

## 6. Import Rules (MUST follow)

sennel exposes its official public API via `package.json` `exports`:

```json
{
  "exports": {
    ".": "./src/sennel.js",
    "./api": "./src/api.js",
    "./presets/*": "./src/presets/*"
  }
}
```

Imports from DataSource files are limited to the following:

```javascript
// Base classes
import { DataSource, Scannable, AnalysisEntry } from "sennel/api";

// Preset internal classes (for inheritance)
import SymfonyControllersSource from "sennel/presets/symfony/data/controllers";
import { ControllerEntry } from "sennel/presets/webapp/data/controllers";
import WebappDataSource from "sennel/presets/webapp/data/webapp-data-source";
```

**Critical rules:**

1. **Do not add the `.js` extension.** `sennel/presets/*` is a wildcard subpath export; adding `.js` produces a double-extension `.js.js` and `ENOENT`. `sennel/api` is a static mapping and also requires no extension.
2. **Do not reference `sennel/src/...` directly** (not part of `exports`).
3. **Do not reference `sennel/presets/<key>/templates/...`** (non-public).
4. If a required class is not included in `api.js`, consider adding it to sennel's `src/api.js` (via PR / issue).

---

## 7. Template Design

### 7.1 Directive List

```markdown
<!-- {%extends%} -->                 Inherit the parent template (same file name)
<!-- {%extends: layout%} -->         Inherit by a different name
<!-- {%block "name"%} -->...<!-- {%/block%} --> Block definition / override

<!-- {{data("<preset>.<category>.<method>", {labels: "A|B|C", ignoreError: true})}} -->
<!-- {{/data}} -->

<!-- {{text({prompt: "write description", mode: "deep"})}} -->

Start new preset templates with `{{text}}` blocks to establish structure quickly, then replace only the sections backed by reliable scan output with `{{data}}`.
This top-down flow is mandatory: Templates first, then DataSources, then scan parsers.
A preset is selected through the `type` array in `.sennel/config.json`, and each listed preset resolves its own inheritance chain independently.
When parent and child define the same DataSource or template name, the child wins.
Always verify file collection with `sennel docs scan --dry-run`, then validate full generation with `sennel docs build`.
<!-- {{/text}} -->
```

- `{{data}}` and `{{/data}}` **remain in the file after resolution** and act as markers for the next build. The resolution result is inserted between them.
- An empty template file acts as a "deletion marker" that removes the parent's block.

### 7.2 When to Use `{{data}}` vs `{{text}}`

| Condition | Directive |
|---|---|
| Mechanically extractable by regex / parser | `{{data(...)}}` (accurate tables from scan data) |
| Too framework-specific to structure | `{{text(...)}}` (AI-generated) |

### 7.3 Parent Uses `{{text}}`, Child Overrides with `{{data}}`

Upper-level presets like `webapp` use `{{text}}` + `{%block%}`; child presets override the block with `{{data}}`. This yields:

- Parent alone (no scan data) still works via AI generation
- Child preset emits accurate tables from scan data
- New presets only need to add an override template

```markdown
<!-- webapp/templates/en/auth_and_session.md -->
<!-- {{text({prompt: "Describe the authentication configuration."})}} -->

Authentication documentation is defined in `auth_and_session.md`, where parent presets can provide a generic `{{text}}` description as a fallback.
Child presets should override that block with `{{data}}` when authentication settings are scanable, so output is table-driven and reproducible.
The documented example is `{{data("symfony.config.auth", {labels: "Item|Value"})}}`, which renders scanned authentication items as key-value rows.
This pattern preserves usability for parent-only setups while enabling precise framework-specific output in descendants.
<!-- {{/text}} -->
```

```markdown
<!-- symfony/templates/en/auth_and_session.md -->
<!-- {{data("symfony.config.auth", {labels: "Item|Value"})}} -->
<!-- {{/data}} -->
```

### 7.4 Template Resolution Priority (high → low)

1. Project-local `.sennel/templates/<lang>/docs/`
2. Project-local preset `.sennel/presets/<key>/templates/<lang>/`
3. Leaf preset `src/presets/<leaf>/templates/<lang>/`
4. Parent presets (up to root)

---

## 8. MUST: scan / data Pairing Rule

If a data DataSource reads `analysis.X`, there must be a scan DataSource somewhere in the chain that writes `X`.

```
✅ Correct:
  scan DataSource "modules" → writes analysis.modules
  data DataSource modules.list() → reads analysis.modules

❌ Violation:
  data DataSource schema.tables() → reads analysis.schemas
  → no scan DataSource writes analysis.schemas
```

If you cannot implement scan, do not create a data DataSource either — switch the relevant template to `{{text}}`.

---

## 9. enrich Constraints

The enrich phase only attaches `summary` / `chapter` / `role` to entries that scan has collected. **It does not create new analysis categories or invent data that scan failed to find.** Use `{{text}}` in templates for data that cannot be scanned.

---

## 10. Implementation Procedure (Top-down)

### 10.1 Creation Order (MUST)

Build in the order **Templates → DataSources → scan parsers**. Working backwards from the consumer avoids writing unnecessary parsers and prevents missing data.

### 10.2 Step-by-Step

1. **Create preset.json** — define at minimum `parent` / `scan.include` / `chapters`
2. **Add `<key>` to `type` in config.json** — without this the preset is not loaded (put the leaf first)
3. **Validate scan patterns with `sennel docs scan --dry-run`** — confirm files are collected correctly
4. **Place templates** — start with only `{{text}}` to establish the skeleton
5. **Implement DataSources one at a time** — after each, run `sennel docs scan` and check `<category>.entries.length` in `.sennel/output/analysis.json`
6. **Swap the relevant template blocks from `{{text}}` to `{{data}}`**
7. **Run `sennel docs build`** and verify the entire pipeline
8. **Add guardrail.json** (polish once build passes). During project operation, create `.sennel/overrides.json` if you need to pin descriptions
9. **For built-in presets, set up `tests/`** and run `npm test` to verify integrity

### 10.3 Minimal Working Set

The following is enough to make scan succeed (project-local example):

```
.sennel/
├── config.json                    # Add "type": ["mypreset", ...]
└── presets/mypreset/
    ├── preset.json                # {"parent": "webapp", "scan": {"include": ["src/**/*.js"]}}
    └── data/
        └── simple.js
```

```javascript
// data/simple.js
import { AnalysisEntry } from "sennel/api";
import WebappDataSource from "sennel/presets/webapp/data/webapp-data-source";

export class SimpleEntry extends AnalysisEntry {
  name = null;
  static summary = {};
}

export default class SimpleSource extends WebappDataSource {
  static Entry = SimpleEntry;
  match(relPath) { return relPath.endsWith(".js"); }
  parse(absPath) {
    const entry = new SimpleEntry();
    entry.name = absPath.split("/").pop();
    return entry;
  }
  list(analysis, labels) {
    const items = analysis.simple?.entries ?? [];
    if (items.length === 0) return null;
    const rows = items.map((e) => [e.name, e.file]);
    return this.toMarkdownTable(rows, labels);
  }
}
```

---

## 11. Validation Commands

```bash
# Print a per-category entry-count summary to stdout (does not rewrite analysis.json)
# Output is a flat JSON object: { categoryName: integerCount, ... }.
# Categories whose scan DataSource is registered but matched 0 files are reported as 0.
sennel docs scan --dry-run

# Print the full analysis JSON to stdout (does not rewrite analysis.json)
sennel docs scan --stdout

# Full run (updates .sennel/output/analysis.json)
sennel docs scan

# Run the full pipeline
sennel docs build

# Integrity tests for built-in presets
npm test
npm test -- --preset <key>            # per-preset
node tests/acceptance/run.js <key>    # per-preset acceptance
```

---

## 12. Pitfall Checklist

### 12.1 `*/` Inside a JSDoc Comment Closes the Comment

Writing a file path that contains `*/` inside a doc comment cuts the comment short.

```javascript
/**
 * Parses src/app/Plugin/*/PluginManager.php.   ← "*/" closes the comment → SyntaxError
 */
```

**Fix**: Replace wildcards in paths with placeholders such as `{name}`.
Use `node --input-type=module --check <file>` to validate (plain `node --check` is ambiguous between ESM/CJS and reports false positives).

### 12.2 Import Extensions

Do not append `.js` when importing from `sennel/api` or `sennel/presets/*`.

### 12.3 Loader Behavior

`src/docs/lib/data-source-loader.js` dynamically imports every `.js` file under `data/`. It registers a DataSource in the sources Map **only when the default export is a class / function**. If you want to keep a side-effect-only helper module under `data/`, omit the default export and the loader will skip it (usually unnecessary since `sennel/api` exists).

### 12.4 Strictness of `chapters`

Chapters declared in `chapters` require a template in the preset itself or an ancestor. For chapters you do not override, placing a thin template with `{%extends%}` is the safest option.

### 12.5 `[init] ERROR:` Is an Informational Message

`sennel docs init`'s `[init] ERROR: N files already exist under docs/` is an **informational** notice (about `--force`), not a failure. Judge by exit code.

### 12.6 Bash Test Scripts

`set -uo pipefail` + `echo "$big" | grep -q` tends to fail with SIGPIPE (exit 141). Use bash string matching: `[[ "$x" == *"pat"* ]]`.

### 12.7 Common Errors

| Error | Cause |
|---|---|
| `[datasource] failed to load DataSource X: Unexpected identifier ...` | A `*/` inside a JSDoc closed the comment, or an import path includes `.js` |
| `<category>.entries.length === 0` | `match()` is always false, or `scan.include` has no matching pattern |
| `Preset not found: <key>` | Not listed in `type` of `config.json` |
| `[data] UNRESOLVED {{data}} in foo.md: <cat>.<sub>.<method>` | The DataSource does not exist or the resolve method is not defined |
| `ENOENT` with double-extension `.js.js` | An import path includes `.js` (e.g. `sennel/presets/.../foo.js`) |

---

## 13. Additional Requirements for Built-in Presets

### 13.1 Tests (MUST)

- `tests/unit/` — Scan parser I/O tests (minimal fixtures via `createTmpDir()`)
- `tests/e2e/` — Verify `preset.json` scan configuration and run a full scan
- `tests/acceptance/test.js` — Acceptance tests using preset-local fixtures. Shared helpers live in `tests/acceptance/lib/`
- Each preset must be runnable on its own via `npm test -- --preset <name>`

### 13.2 Integrity Tests

`tests/unit/presets/preset-scan-integrity.test.js` automatically verifies the following. **Run `npm test` and ensure it passes after every addition or change.**

1. Every preset with scan patterns has a scan DataSource in its chain
2. Every `{{data}}` directive in templates references a method that exists on the DataSource
3. For every data DataSource that reads `analysis.X`, some scan DataSource in the chain writes `X`

### 13.3 No Project-Specific Values

Do not write project-specific values (project name, host, port, container name, etc.) into `src/presets/`. Keep only generic parsing logic. Externalize project-specific values in `.sennel/config.json`.

---

## 14. Additional Requirements for Project-Local Presets

- Leaf-only. `parent` must point to a built-in key.
- `preset.json` may be omitted (inherits defaults from the built-in chain).
- Files under `.sennel/templates/<lang>/docs/` have the highest priority (stronger than preset templates).
- Pitfall: a project-local preset does not need its own `package.json`. When sennel dynamically imports a DataSource, its own package resolution context is used, so bare specifiers (`sennel/api`, etc.) resolve correctly.

---

## 15. AI Execution Checklist

When asked to create a preset, perform the following in order:

1. [ ] Inspect the target project's directory structure and framework with `ls` / `fd`
2. [ ] Choose the closest parent among existing presets (read `src/presets/`)
3. [ ] Create `<preset-root>/<key>/preset.json` (minimum: `parent`, `scan.include`, `chapters`)
4. [ ] Add `<key>` to the head of the `type` array in `.sennel/config.json`
5. [ ] Confirm file collection with `sennel docs scan --dry-run`
6. [ ] Place skeleton templates under `templates/<lang>/` (start with `{{text}}` only)
7. [ ] Implement DataSources one by one (import only from `sennel/api` / `sennel/presets/*`, without extensions)
8. [ ] After each DataSource, run `sennel docs scan` and check `<category>.entries.length` in `.sennel/output/analysis.json`
9. [ ] Judge `match()` on a `relPath` that uses `/` separators and has no leading `./`
10. [ ] Return the result of `toMarkdownTable(rows, labels)` (a Markdown string) or `null` from resolve methods. Return `null` when there is no data
11. [ ] If you read `analysis.X`, verify that a scan DataSource in the chain writes `X`
12. [ ] Gradually replace `{{text}}` with `{{data}}` in templates
13. [ ] Confirm the whole pipeline passes with `sennel docs build`
14. [ ] For built-in presets, set up `tests/` and ensure `npm test` passes
15. [ ] (Optional) Add `guardrail.json`. If you need to pin descriptions, create `.sennel/overrides.json` at the project root

---

## 16. Reference Files

sennel core:

| File | Content |
|---|---|
| `src/api.js` | Publicly exported base classes (`DataSource`, `Scannable`, `AnalysisEntry`) |
| `src/lib/presets.js` | Preset discovery and chain resolution |
| `src/docs/lib/data-source.js` | `DataSource` base class |
| `src/docs/lib/scan-source.js` | `Scannable` mixin (`match`, `parse`) |
| `src/docs/lib/analysis-entry.js` | `AnalysisEntry` base class |
| `src/docs/lib/data-source-loader.js` | DataSource dynamic loading |
| `src/docs/lib/template-merger.js` | Template inheritance and block merging |
| `src/presets/webapp/data/webapp-data-source.js` | `WebappDataSource = Scannable(DataSource)` |
| `src/presets/symfony/data/*.js` | Reference implementation for a PHP framework |
| `src/presets/cakephp2/data/*.js` | Alternative PHP implementation (PHP parser utilities) |
| `src/presets/nextjs/data/*.js` | Reference for frontend DataSources |

Project rules:

- `src/CLAUDE.md` / `src/AGENTS.md` — sennel internal architecture and MUST rules
- Project root `CLAUDE.md` — restrictions on writing to `src/`
