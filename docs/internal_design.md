<!-- {{data("base.docs.langSwitcher", {labels: "relative"})}} -->
[日本語](ja/internal_design.md) | **English**
<!-- {{/data}} -->

# Internal Design

## Description

<!-- {{text({prompt: "Write a 1-2 sentence overview of this chapter. Include the project structure, module dependency direction, and key processing flows."})}} -->

This project is organized around three main areas: `src/docs` for documentation analysis and generation, `src/flow` for Spec-Driven Development workflow control, and `src/lib` for shared runtime infrastructure such as config, git, guardrails, providers, and flow state. Dependencies generally flow from command entry modules to controller/lib/model helpers, then to filesystem/git/agent integrations, with key pipelines centered on `docs scan → enrich → data/readme/translate` and flow orchestration through prepare, next-action, status, and auto-check paths.
<!-- {{/text}} -->

## Content

### Project Structure

<!-- {{text({prompt: "Describe the project's directory structure as a tree-format code block. Include role comments for key directories and files. Generate from the actual source code structure.", mode: "deep"})}} -->

```text
src/
├─ check/commands/scan.js            # CLI command that reports analysis coverage and uncovered files
├─ docs/
│  ├─ commands/                      # Docs pipeline commands (scan, enrich, init, data, readme, agents, translate)
│  │  ├─ scan.js                     # Builds and writes .sdd-forge/analysis.json from source files
│  │  ├─ enrich.js                   # Adds AI-generated summary/detail/chapter metadata in batches
│  │  ├─ data.js                     # Resolves {{data}} directives and updates chapter files
│  │  ├─ init.js                     # Initializes docs chapters from preset/template resolution
│  │  ├─ readme.js                   # Renders README from templates + directives + optional text fill
│  │  ├─ agents.js                   # Generates/refines AGENTS.md with analysis/docs context
│  │  └─ translate.js                # Translates docs/README to target languages
│  ├─ data/                          # DataSource providers used by directive resolution
│  │  ├─ agents.js
│  │  ├─ docs.js
│  │  ├─ lang.js
│  │  └─ text.js
│  └─ lib/                           # Shared docs utilities: scanner, parser, prompts, template merge, minify
├─ flow/lib/                         # Flow command logic and workflow helpers (prepare, status, next-action, auto-check)
└─ lib/                              # Cross-cutting infrastructure (constants, flow manager/store, git helpers, guardrails)
```
<!-- {{/text}} -->

### Module Composition

<!-- {{text({prompt: "List the major modules in table format. Include module name, file path, and responsibility. Extract from import/require relationships and exports in each file.", mode: "deep"})}} -->

| Module | File path | Responsibility |
| --- | --- | --- |
| Scan coverage command | `src/check/commands/scan.js` | Compares included files with analysis entries and reports uncovered files by extension in text/JSON/Markdown formats. |
| Docs scan pipeline | `src/docs/commands/scan.js` | Collects source files, runs DataSources, preserves stable entry IDs/hashes, and writes `analysis.json`. |
| Docs enrichment pipeline | `src/docs/commands/enrich.js` | Batches analysis entries, calls agent for chapter/summary/detail metadata, repairs JSON, and merges results. |
| Directive population | `src/docs/commands/data.js` + `src/docs/lib/directive-parser.js` | Resolves `{{data}}` blocks, replaces directive regions, and updates docs files with filtered analysis context. |
| Template resolution and merge | `src/docs/lib/template-merger.js` | Resolves preset/project template layers, handles inheritance/additive merge, and optional translation fallback. |
| Language and minify layer | `src/docs/lib/lang-*.js` + `src/docs/lib/minify.js` + `src/docs/lib/lang-factory.js` | Provides per-language parsing/minification/essential extraction behind a common dispatch API. |
| Flow orchestration core | `src/lib/flow-manager.js` + `src/lib/flow-helpers.js` + `src/lib/active-flow-registry.js` + `src/lib/preparing-flow-store.js` | Manages active/preparing flow state, task/step lifecycle, discovery, and persistence across main/worktree contexts. |
| Flow decision/next-action | `src/flow/lib/run-auto-check.js` + `src/flow/lib/get-next-action.js` + `src/flow/lib/get-step-instructions.js` | Computes auto-mode eligibility and maps in-progress steps to rule-driven next actions and prompt instructions. |
| Shared policy/runtime helpers | `src/lib/guardrail.js` + `src/lib/lint.js` + `src/lib/git-helpers.js` + `src/lib/provider.js` + `src/lib/json-parse.js` | Enforces guardrails/lint checks, wraps git/GitHub CLI, parses provider output, and repairs near-JSON agent responses. |
<!-- {{/text}} -->

### Module Dependencies

<!-- {{text({prompt: "Generate a mermaid graph showing inter-module dependencies. Analyze import/require statements in the source code and show the layer structure and dependency direction. Output only the mermaid code block.", mode: "deep"})}} -->

```mermaid
graph TD
  CLI[CLI Commands<br/>(scan/check/readme/translate/flow)] --> DOCS_CMD[src/docs/commands/*]
  CLI --> CHECK_CMD[src/check/commands/scan.js]
  CLI --> FLOW_CMD[src/flow/lib/* commands]

  DOCS_CMD --> DOCS_LIB[src/docs/lib/*]
  DOCS_CMD --> DOCS_DATA[src/docs/data/*]
  DOCS_CMD --> CORE_LIB[src/lib/*]

  CHECK_CMD --> DOCS_SCANNER[src/docs/lib/scanner.js]
  CHECK_CMD --> CORE_LIB

  FLOW_CMD --> FLOW_BASE[src/flow/lib/base-command.js]
  FLOW_CMD --> FLOW_HELP[src/lib/flow-helpers.js]
  FLOW_CMD --> FLOW_STORE[src/lib/flow-manager.js]
  FLOW_CMD --> CORE_LIB

  FLOW_STORE --> ACTIVE_REG[src/lib/active-flow-registry.js]
  FLOW_STORE --> PREP_STORE[src/lib/preparing-flow-store.js]
  FLOW_STORE --> GIT_HELP[src/lib/git-helpers.js]

  DOCS_LIB --> LANG_LAYER[src/docs/lib/lang-factory.js + lang/*]
  DOCS_LIB --> PARSER[src/docs/lib/directive-parser.js]
  DOCS_LIB --> TEMPLATE[src/docs/lib/template-merger.js]

  CORE_LIB --> FS[(Filesystem)]
  CORE_LIB --> GIT[(Git/GitHub CLI)]
  DOCS_CMD --> AGENT[(Agent Provider)]
  FLOW_CMD --> AGENT
```
<!-- {{/text}} -->

### Key Processing Flows

<!-- {{text({prompt: "Describe the inter-module data and control flow when running a representative command in numbered steps. Include the flow from entry point to final output.", mode: "deep"})}} -->

1. The command entry parses CLI flags and resolves runtime context (`root`, `srcRoot`, config, type) through docs context/container wiring.
2. Include/exclude scan rules are derived from config or preset chains, then source files are collected by `collectFiles` with glob matching and metadata (`hash`, `lines`, `mtime`).
3. Existing `.sdd-forge/analysis.json` is loaded when available to build indexes for stable entry IDs and hash-based reuse.
4. DataSource implementations are loaded from preset chain `data/` directories, and each source parses matched files into category entries.
5. For unchanged files, previous entries are reused; for changed files or changed DataSource hashes, entries are rebuilt and marked for re-parse.
6. Category summaries are produced via analysis-entry helpers, and metadata keys (such as timestamps) are updated in the aggregate analysis object.
7. The final analysis payload is written to `.sdd-forge/analysis.json` (or printed in stdout mode), with deterministic ordering and localized logging.
8. Downstream commands (`enrich`, `data`, `readme`, `translate`) consume this artifact to generate chapter content, fill directives, and produce final docs outputs.
<!-- {{/text}} -->

### Extension Points

<!-- {{text({prompt: "Describe the locations that need changes and extension patterns when adding new commands or features. Derive from plugin points and dispatch registration patterns in the source code.", mode: "deep"})}} -->

Adding a new CLI capability follows the existing command pattern: implement a command class (typically extending `Command` or `FlowCommand`), parse args, and route through shared context/container utilities.
For docs features, extend `src/docs/commands/*` and reuse `src/docs/lib/*` primitives (directive parsing, template merge, scanner/minify, resolver factory) instead of embedding custom parsing in commands.
To expose new template data, add a DataSource module in `src/docs/data/*` that returns a class extending `DataSource`, then resolve it through the existing resolver/data-loading flow.
To support new source languages or extraction behavior, add a handler in `src/docs/lib/lang/*` and register its extension mapping in `src/docs/lib/lang-factory.js`.
For workflow behavior changes, update flow command modules in `src/flow/lib/*`, plus schema/prompt routing used by `get-next-action` and `get-step-instructions`.
If new policy checks are needed, add or merge guardrails via preset/project `guardrail.json` and rely on `src/lib/guardrail.js` + `src/lib/lint.js` for phase/scope evaluation.
Cross-cutting constants, statuses, and envelope semantics should be extended in shared files (`src/lib/constants.js`, `src/lib/flow-envelope.js`) to keep command behavior consistent.
<!-- {{/text}} -->

---

<!-- {{data("base.docs.nav")}} -->
[← Configuration and Customization](configuration.md) | [Preset Creation Guide →](creating_presets.md)
<!-- {{/data}} -->
