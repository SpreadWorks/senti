<!-- {{data("base.docs.langSwitcher", {labels: "relative"})}} -->
[日本語](ja/cli_commands.md) | **English**
<!-- {{/data}} -->

# CLI Command Reference

## Description

<!-- {{text({prompt: "Write a 1-2 sentence overview of this chapter. Include the total number of commands and subcommand structure."})}} -->

The published help layout lists 21 command entries across Project, Docs, Flow, Metrics, and Info sections. Command execution is hierarchical: entrypoints such as `docs`, `flow`, `metrics`, `spec`, and `check` validate a subcommand key, then dispatch to registered handlers through the shared container/dispatcher path.
<!-- {{/text}} -->

## Content

### Command List

<!-- {{text({prompt: "List all commands in table format. Include command name, description, and key options. Extract comprehensively from command definitions and routing in the source code.", mode: "deep"})}} -->

| Command | Description | Key options |
| --- | --- | --- |
| `sdd-forge help` | Prints localized command catalog with sectioned layout and version. | `-h`, `--help` (via general CLI handling) |
| `sdd-forge check <command>` | Routes to `checkCommands` registry and runs a check subcommand. | `-h`, `--help` |
| `sdd-forge docs <command>` | Routes docs subcommands (`build`, `scan`, `enrich`, `init`, `data`, `text`, `readme`, `forge`, `review`, `translate`, `changelog`, `agents`, `snapshot`). | `-h`, `--help` |
| `sdd-forge docs build` | Runs docs pipeline (`scan → enrich → init → data → text → readme → agents` and optional `translate`). | `--verbose`, `--dry-run`, `--force`, `--regenerate`, `-h`, `--help` |
| `sdd-forge docs changelog [outFile]` | Builds changelog from `specs/*` metadata and writes `docs/change_log.md` by default. | `--dry-run`, `-h`, `--help` |
| `sdd-forge docs forge` | AI-assisted docs update loop with per-file targeting, retries, and review integration. | `--prompt`, `--prompt-file`, `--spec`, `--max-runs`, `--review-cmd`, `--mode`, `--dry-run`, `--verbose` |
| `sdd-forge docs text` | Fills `{{text}}` directives using analysis + agent calls, with batching/filtering behavior. | Supports parsed CLI options and `-h/--help` through parser/command help flow |
| `sdd-forge flow <command>` | Flow command gateway with `prepare`, `resume`, `get <key>`, `set <key>`, `run <action>`. | `-h`, `--help` |
| `sdd-forge flow get <key>` | Read flow-derived data (shown modules include `check`, `guardrail`, `issue`, `next-action`, `prompt`, `qa-count`, `resolve-context`). | Key-specific arguments (for example target/phase/format/number/kind) |
| `sdd-forge flow set <key>` | Mutate flow state (shown modules include `auto`, `gate-retry`, `init`, `issue`, `metric`, `note`, `request`, `step`, `test-summary`). | Key-specific flags such as `--yes`, `--json`, `--baseline`, `--mode` |
| `sdd-forge flow run <action>` | Execute flow actions (shown modules include `gate`, `lint`, `merge`, `prepare-spec`, `reopen-draft`, `report`, `review`, `sync`, `tests`; plus report-show command class). | Action-specific flags such as `--phase`, `--dry-run`, `--skip-confirm`, `--baseline` |
| `sdd-forge metrics <command>` | Routes to `metricsCommands` (help layout explicitly shows `metrics token`). | `-h`, `--help` |
| `sdd-forge spec <command>` | Routes to `specCommands` registry (implemented command shown: `render`). | `-h`, `--help` |
| `sdd-forge spec render` | Validates `spec.json` against schema and renders deterministic `spec.md`. | `--spec`, `--out`, `-h`, `--help` |
<!-- {{/text}} -->

### Global Options

<!-- {{text({prompt: "Describe global options shared by all commands in table format. Extract from argument parsing logic in the source code.", mode: "deep"})}} -->

| Option | Scope | Behavior |
| --- | --- | --- |
| `-h`, `--help` | Shared across top-level command entrypoints and parser-backed subcommands | Shows usage/help text; many entrypoints exit success for explicit help and non-zero for missing required subcommand. |
| `--` | `parseArgs`-based commands | Recognized as separator token by parser loop (ignored during option parsing). |
| Unknown option handling | `parseArgs`-based commands and explicit validators | Parser throws `Unknown option: ...`; some commands (for example `docs build`) print command-scoped unknown-option errors and exit non-zero. |
| Global non-help flags | Not defined as universal | No cross-command flag set (such as global `--verbose`) is shared by all commands; flags are command-specific.
<!-- {{/text}} -->

### Command Details

<!-- {{text({prompt: "Describe each command's usage, options, and examples in detail. Create a #### subsection for each command. Extract from argument definitions and help messages in the source code.", mode: "deep"})}} -->

#### `sdd-forge help`
Usage: `sdd-forge help`. Prints localized, sectioned command help with package version.
Examples: `sdd-forge help`.

#### `sdd-forge check <command>`
Usage: `sdd-forge check <command>`; without a subcommand it prints available keys from `checkCommands`.
Examples: `sdd-forge check --help`, `sdd-forge check <registered-subcommand>`.

#### `sdd-forge docs <command>`
Usage: `sdd-forge docs <command>`; routes to docs command registry and dispatches remaining args.
Examples: `sdd-forge docs --help`, `sdd-forge docs build`, `sdd-forge docs changelog --dry-run`.

#### `sdd-forge docs build`
Usage: `sdd-forge docs build [--verbose] [--dry-run] [--force] [--regenerate]`.
Options: `--verbose`, `--dry-run`, `--force`, `--regenerate`, `-h/--help`; unknown flags are rejected.
Examples: `sdd-forge docs build --dry-run --verbose`, `sdd-forge docs build --force`.

#### `sdd-forge docs changelog`
Usage: `sdd-forge docs changelog [outFile] [--dry-run]`.
Behavior: scans `specs/`, parses `spec.json`/`flow.json`, and writes `docs/change_log.md` if no output path is provided.
Examples: `sdd-forge docs changelog`, `sdd-forge docs changelog docs/change_log.md --dry-run`.

#### `sdd-forge docs forge`
Usage: `sdd-forge docs forge --prompt <text>|--prompt-file <path> [--spec <path>] [--max-runs N] [--review-cmd <cmd>] [--mode local|assist|agent] [--dry-run] [--verbose]`.
Behavior: optional analysis placeholder fill, target-file selection, iterative generation/review loops, and optional agent mode.
Examples: `sdd-forge docs forge --prompt "Refresh CLI docs" --mode local`, `sdd-forge docs forge --prompt-file prompts/forge.txt --spec specs/001-x/spec.json --max-runs 2`.

#### `sdd-forge spec <command>` and `sdd-forge spec render`
Usage: `sdd-forge spec <command>` and `sdd-forge spec render [--spec <dir>] [--out <path>]`.
`spec render` validates `spec.json` using schema, resolves active-flow spec dir by default, then writes rendered markdown.
Examples: `sdd-forge spec --help`, `sdd-forge spec render`, `sdd-forge spec render --spec specs/001-foo --out specs/001-foo/spec.md`.

#### `sdd-forge flow <command>`
Usage: `sdd-forge flow prepare|resume|get <key>|set <key>|run <action>`.
Behavior: `prepare` and `resume` are convenience routes mapped into run-style envelopes; grouped commands validate key/action before dispatch.
Examples: `sdd-forge flow --help`, `sdd-forge flow get check dirty`, `sdd-forge flow set issue 123`, `sdd-forge flow run review --phase spec --skip-confirm`.

#### `sdd-forge metrics <command>`
Usage: `sdd-forge metrics <command>`; help layout includes `metrics token`.
Examples: `sdd-forge metrics --help`, `sdd-forge metrics token`.
<!-- {{/text}} -->

### Exit Codes and Output

<!-- {{text({prompt: "Define exit codes and describe stdout/stderr conventions in table format. Extract from process.exit() calls and output patterns in the source code.", mode: "deep"})}} -->

| Situation | Exit behavior | Stdout convention | Stderr convention |
| --- | --- | --- | --- |
| Explicit help (`-h/--help`) on command groups | Exits `0` on explicit help paths in group entrypoints. | Usage/help text is printed (some groups use `console.log`). | Some group help paths print usage to stderr (`check`, `docs`, `metrics`). |
| Missing required subcommand/key | Exits non-zero (`EXIT_ERROR` or `1` depending on entrypoint). | Usually none. | Prints usage guidance and/or unknown-command messages. |
| Unknown command/option | Exits `EXIT_ERROR` in command entrypoints and option validators. | Usually none. | Prints command-scoped error text (for example unknown subcommand/unknown option). |
| Successful command execution | Exits `0` by normal completion (no explicit error exit). | Command result text/artifacts are printed to stdout (`generated`, `rendered`, report text, dry-run outputs). | Progress/warnings may be printed to stderr in some flows (for example retries, warnings). |
| Runtime failure during dispatch/command execution | Exits non-zero (`EXIT_ERROR` or `1` in explicit handlers such as `flow report show`). | Partial output may exist for commands that stream progress. | Error summary is printed with command prefix/context and failure details. |
<!-- {{/text}} -->

---

<!-- {{data("base.docs.nav")}} -->
[← Project Structure](project_structure.md) | [Configuration and Customization →](configuration.md)
<!-- {{/data}} -->
