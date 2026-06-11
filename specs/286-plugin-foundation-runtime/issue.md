# Scope

The plugin foundation in senti. This covers the runtime / contribution / lifecycle hook / command / config / source management mechanisms needed so workflow plugins and preset plugins can be separated from the core implementation and still operate independently.

# Problem

To fully migrate workflows and presets to external plugin repositories, the current plugin foundation is not enough. Hooks are not connected to the plugin manifest / installed plugins, and command / help / config / agent / install packaging / package source management still depend on the core implementation or on individual plugin names.

# Cause

The plugin runtime does not yet have a boundary for executing plugin code without exposing core internal APIs directly, a boundary for inserting plugin hooks into the flow command lifecycle, or a config schema that separates enabled packages from candidate discovery sources.

# Improvement Direction

As 1/3, prepare the plugin foundation first. This does not include migrating the workflow or preset implementations themselves; instead, it creates the shared runtime contract that both migrations depend on. Do not compress the detailed decisions from 9f78; implement the policies below.

# Decisions

Do not create a new event bus. Insert the plugin hook runner into the pre / post points of the existing flow command registry.

Remove workflow-specific flow instructions from skill text, and execute them as deterministic plugin hooks on the CLI side. AI skills do not know workflow-specific processing.

# Hook discovery

Do not write flow hook contributions in the plugin manifest. Automatically discover the following files under installed and enabled plugin roots.

```text
<pluginRoot>/hooks/*.js
```

One file is one hook. If there is no hooks/ directory, do nothing.

# Hook file format

Plugin hook files do not import the core package. To avoid resolution differences between npm link / global install / package exports / copied plugin roots, use a factory format where the core runtime passes the api, using the same idea as preset DataSource.

```js
function helper() {
  // file-local helper is allowed
}

export default function register(api) {
  const { FlowCommandHook, FLOW_COMMANDS, FLOW_COMMAND_HOOKS } = api;

  return class WorkflowIssueStartHook extends FlowCommandHook {
    static command = FLOW_COMMANDS.PREPARE;
    static hook = FLOW_COMMAND_HOOKS.POST;
    static priority = 1001;

    async run(context) {
      // plugin logic
    }
  };
}
```

- The default export must be `function register(api)`.
- `register(api)` returns exactly one named class.
- The returned class extends `api.FlowCommandHook`.
- Anonymous register / anonymous class / multiple hook exports are validation errors.
- Named exports are ignored for hook registration.
- Relative imports to internal plugin modules are allowed.
- Imports to senti core internal paths are prohibited by policy. Core APIs are passed via `api` or `context`.

# Hook metadata

The hook class has the following static metadata.

```js
static command = FLOW_COMMANDS.PREPARE;
static hook = FLOW_COMMAND_HOOKS.POST;
static priority = 1001;
```

- `command` is only a top-level command name from the flow registry.
- `FLOW_COMMANDS` exposes all top-level commands. Do not create an individual allow list.
- `hook` is only `pre` / `post`. Do not expose `onError` / `finally` initially.
- `prepare.pre` plugin hooks are unsupported. Validation hard fails.
- Unknown command / unknown hook validation hard fails.
- `priority` is optional. The default is `1001`. Only integers are allowed.

# Priority

Treat the baseline priority of existing registry hooks as `1000`.

```text
priority < 1000   before existing hooks
priority >= 1000  after existing hooks
default = 1001
```

`priority = 1000` can also be used by plugins. Strict execution order for equal values is not guaranteed. The basic behavior is to run after existing hooks.

Plugin hook failures are non-blocking regardless of priority. Even with priority < 1000, they do not stop the main flow.

# Special handling for Prepare

Because the flow hook plan is snapshotted when flow prepare succeeds, prepare.pre does not exist. prepare.post runs in the following order.

```text
prepare command body
→ existing prepare.post
→ plugin hook discovery / validation
→ snapshot to flow.json plugins.flowCommandHooks
→ execute prepare.post plugin hooks from the snapshot
```

# Hook snapshot

When flow prepare succeeds, perform hook discovery / validation and snapshot the hook plan to flow.json.

```json
{
  "plugins": {
    "flowCommandHooks": [
      {
        "apiVersion": 1,
        "pluginId": "workflow",
        "module": "hooks/issue-start.js",
        "className": "WorkflowIssueStartHook",
        "command": "prepare",
        "hook": "post",
        "priority": 1001
      }
    ]
  }
}
```

- Do not store absolute paths in the snapshot.
- Store `pluginId + module relative path + className + command + hook + priority`.
- Subsequent active flows execute based on `flow.json.plugins.flowCommandHooks`.
- Do not perform new discovery on every pre/post.
- Module import happens when the hook is executed.
- For existing flows without a snapshot, do not execute plugin hooks. Do not use live discovery fallback.
- If a plugin in the snapshot becomes disabled / removed / unresolved in the middle of a flow, hard fail.
- To continue, enable / restore the plugin again or remove it from the snapshot via an explicit migration / sync. The runner does not rewrite the snapshot on its own.

# Hook execution context

Do not pass the raw ctx from the existing registry to plugin hooks. raw ctx is an internal core structure, and exposing it as a public API would tightly couple the workflow plugin to core internals. The runner converts it to a stable public context and passes that instead.

```js
async run(context) {}
```

Expected initial context.

```js
{
  apiVersion: 1,
  plugin: { id, root },
  command: { name, hook },
  project: { root },
  config: {
    project,
    plugin
  },
  flow: {
    specId,
    specPath,
    issueNumber,
    lifecycle,
    active
  },
  result,
  artifacts: {
    readJson(name),
    writeJson(name, data),
    writeText(name, text)
  },
  envelope: {
    ok(data),
    fail(code, message, data)
  }
}
```

Do not pass internal objects such as `flowManager`. Pass only required values and stable helpers.

# Plugin config

Plugin-specific config lives under `plugin.config.<pluginId>` in `.senti/config.json`.

```json
{
  "plugin": {
    "sources": [],
    "packages": [],
    "config": {
      "workflow": {
        "languages": { "source": "ja", "publish": "en" },
        "flowIntegration": "enable"
      }
    }
  }
}
```

Pass the following to the context.

```js
config: {
  project: fullProjectConfig,
  plugin: fullProjectConfig.plugin?.config?.[pluginId] ?? {}
}
```

The core hook runner does not interpret the meaning of plugin config. Workflow-specific `flowIntegration` checks are the responsibility of the workflow plugin.

# Artifacts

Include an artifacts helper in the public context so plugin hooks can save artifacts. The core only namespaces the destination. The schema of the contents is the plugin's responsibility, and the core does not interpret it.

```text
specs/<specId>/plugin-artifacts/<pluginId>/<filename>
```

Example.

```text
specs/123-example/plugin-artifacts/workflow/candidates.json
```

# Hook return / failure policy

Hook return values are Envelope-compatible.

- If a hook throws, the runner normalizes it to the equivalent of Envelope.fail.
- Hook run failure / ok:false / warnings do not stop the main flow.
- Add them to the command envelope warnings using a common schema.
- Writing to the flow issue-log is the responsibility of the core runner. Plugins do not write directly to the issue-log.
- Content a plugin wants to leave in the issue-log is returned in `issueLogEntries` in the envelope data. The contents are up to the plugin.
- Even if writing to the issue-log fails, the main flow does not stop.
- discovery / import / register execution / class validation / static metadata validation failures are hard failures.

The warning schema includes at least the following.

```json
{
  "code": "PLUGIN_HOOK_FAILED",
  "message": "plugin hook failed: workflow WorkflowIssueStartHook",
  "pluginId": "workflow",
  "hook": {
    "command": "prepare",
    "name": "post",
    "class": "WorkflowIssueStartHook"
  },
  "detail": {}
}
```

# Plugin install packaging

`plugin.json.files` is being deprecated. Do not make plugin authors enumerate copy targets.

The installer does not copy the entire repo; it copies only known directories / known files by convention on the core side.

Initial known paths.

```text
plugin.json
commands/
skills/
presets/
hooks/
config.schema.json
config.defaults.json
```

Skip known paths that do not exist. Maintain safety checks for `.git` / node_modules / symlink / unsafe package.json / path traversal and similar cases.

# Handling existing hooks

The first implementation does not include converting existing registry hooks into classes. The plugin hook runner is inserted before/after existing hooks.

Existing hooks should also be moved toward the FlowCommandHook structure in the future, but because they have critical responsibilities such as flow state updates, finalize processing, and report generation, that is a separate task. Separate board: d1e1.

# Additional decisions for the plugin foundation

## Implementation of deprecating plugin.json.files

Decision finalized. Do not make plugin authors enumerate copy targets. Currently PluginManifest.validate() requires files, and install only copies manifest.files, so change this to an installer convention that copies only known directories / known files.

## Plugin config namespace implementation

Decision finalized. Plugin-specific config lives under plugin.config.<pluginId> in .senti/config.json. Currently plugin schema/defaults are merged into top-level config, and workflow remains in the core schema as top-level workflow, so change plugin config schema/defaults to apply under plugin.config.<pluginId>.

## Plugin agent resolution API

workflow.publish remains in the core agent default profiles. In the full workflow migration, remove workflow-specific command ids from core defaults.

Do not write agent settings during plugin install / upgrade. For AI calls on the plugin side, resolve overrides from `plugin.config.<pluginId>.agent.<name>` via the public API, and fall back to the normal core agent default when unset.

## Plugin-aware help

help.js statically displays workflow. To remove workflow from the core, enabled plugin command contributions need to be reflected in help output. Do not leave workflow in the static LAYOUT; display it from the plugin command label/description/help metadata.

## Plugin agent configuration policy

Do not add plugin-specific agent command ids such as workflow.publish to core top-level agent.profiles. Do not write agent settings during plugin install / upgrade either. If users want to override a plugin-specific agent provider, they write it under plugin config.

```json
{
  "plugin": {
    "config": {
      "workflow": {
        "agent": {
          "publish": "codex/gpt-5.5"
        }
      }
    }
  }
}
```

When unset, use the normal core agent default. The workflow plugin requests an agent with a plugin-local name such as `publish`, and the core resolves `plugin.config.<pluginId>.agent.<name>` as an override. The workflow-specific entry in core agent-defaults.js is a removal target.

## Plugin command help metadata policy

To display plugin commands in top-level help, add static metadata to plugin.json contributions.commands[]. Do not import command modules just for help display.

Expected example.

```json
{
  "contributions": {
    "commands": [
      {
        "name": "workflow",
        "path": "commands/workflow.js",
        "section": "Workflow",
        "desc": "Manage GitHub Projects board drafts and publish issues"
      }
    ]
  }
}
```

help.js does not keep workflow in the static LAYOUT; it integrates command metadata from the enabled plugin registry and displays it.

## Plugin command runtime API policy

Normal commands in the workflow plugin also use the same factory format as hooks and do not import the core package / internal paths. Do not use the current style of just passing core ctx to `export async function main(argv, ctx)`.

Expected example.

```js
export default function register(api) {
  return {
    async main(argv, context) {
      // plugin command logic
    }
  };
}
```

The plugin command loader calls `register(api)` and executes `main(argv, context)` on the returned command object. Core-side functions such as Envelope, config, agent, and project root are provided via api / context.

## AI call configuration policy for the workflow plugin

All places where the workflow plugin executes AI must be configurable. Do not remove AI refinement solely because hook execution should be deterministic.

As a core rule, add to src/AGENTS.md that every call site executing AI must have a config key that can change the provider/profile from config. In the workflow plugin, allow overrides under `plugin.config.workflow.agent.<name>` to be resolved for each AI-calling process such as publish / issue-log-import classify / compose. When unset, fall back to the normal agent default.

## Plugin config defaults policy

Do not automatically write plugin config defaults to `.senti/config.json`. Merge them at runtime during config load so defaults are visible in the return value of loadConfig(). Users explicitly write only the values they want to change under `plugin.config.<pluginId>`.

Do not add workflow plugin values such as `flowIntegration: disable` to the config file during install / upgrade.

## Return values and output for plugin commands / hooks

Plugin commands and plugin hooks must both always return Envelope-compatible objects. stdout / stderr final output, exit code, reflection into flow warnings, and saving to issue-log / artifacts are the responsibility of the core dispatcher / hook runner. Plugins are assumed not to output directly.

## Import-time side effects

Plugin hook / command modules must not have import-time side effects. Because enabled plugins are treated as executable code, the initial implementation does not add mechanical side-effect checks; this is enforced by convention and review. Plugin install / update does not execute scripts, but runtime-imported plugin code is the responsibility of trusted plugins.

## Existing active flows

Existing active flows without hook snapshots continue silently without hooks. Do not use live discovery fallback, warnings, migration, or re-prepare requirements.

## Plugin command help

Plugin command contributions have help metadata equivalent to core commands. Resolve top-level help, command help, subcommand help, locale-specific wording, and experimental display from static metadata. Do not import command modules for help display. Align plugin command metadata with the same information structure as the core command registry, and send core / plugin commands through the same help rendering pipeline. Do not create a thin plugin-specific help path.

## Handling plugin throws

If a plugin command / hook throws, the core dispatcher / hook runner catches it and normalizes it to the equivalent of Envelope.fail. For commands, produce a failure envelope and non-zero exit. For hooks, convert it to warning / issue-log / follow-up as a business-processing error. Throws during hook run do not stop the main flow.

## Responsibility boundary for the plugin agent API

Only the workflow plugin knows workflow-specific agent keys. The core does not interpret workflow-specific purpose names such as `workflow.publish` or `publish`.

The implementation logic that executes AI uses the existing core agent execution mechanism. Meanwhile, the workflow plugin is responsible for deciding when, why, and with what prompt to execute AI.

The core passes only a workflow-independent, generic agent execution API to the plugin. The plugin reads `plugin.config.workflow.agent.<name>` itself, and if an override exists, passes it as the provider/profile to the generic agent API. If there is no override, it does not specify provider/profile and executes with the core generic default agent.

Conceptual example.

```js
await api.agent.run({
  provider: pluginConfig.agent?.publish,
  prompt,
  input
});
```

This API does not accept workflow-specific purpose names. Execution decisions and interpretation of workflow-specific config keys stay inside the plugin.

# Final policy for preset/plugin source settings

Separate candidate discovery sources from enabled plugin packages.

```json
{
  "plugin": {
    "sources": [
      {
        "id": "official-presets",
        "type": "git",
        "remote": "git@github.com:SpreadWorks/senti-presets.git"
      },
      {
        "id": "project-local",
        "type": "local",
        "path": ".senti/local-plugins"
      }
    ],
    "packages": [
      {
        "id": "senti-presets",
        "source": "official-presets",
        "commit": "abc123"
      },
      {
        "id": "project-presets",
        "source": "project-local"
      }
    ]
  }
}
```

## Source list and package list

- `plugin.sources[]` is the candidate discovery source list. It is used for provider reverse lookup in setup / find / install / upgrade.
- `plugin.packages[]` is the enabled package list. It records the plugins actually enabled in this project and their reproducibility information.
- `packages[].source` references `plugin.sources[].id`.
- Do not use names such as `plugin.repos` / `packages[].repo`; use `sources` / `source` so git / local / future npm can be represented.

## Source type

- `type: "git"` has `remote`. Treat `remote` as a git remote spec, and allow HTTPS, SSH URLs, and the `git@github.com:org/repo.git` format.
- `type: "local"` has `path`. `path` is allowed only relative to the project root; absolute paths, `..`, symlinks, and references outside the root are prohibited.
- If npm is supported in the future, add `type: "npm"` and `package`. In the initial implementation, support only `git` and `local`; if `npm` is unsupported, a validation error is acceptable.

## Reproducibility and storage location

- For git sources, guarantee reproducibility by recording the resolved commit SHA in `packages[].commit`.
- Local sources are treated as source of truth committed to the project, so `commit` is unnecessary.
- `source.path` such as `.senti/local-plugins` is the committed source of truth.
- `.senti/plugins/` is an installed artifact / cache.
- Authentication is left to normal git / ssh / gh settings. senti does not manage tokens or credentials.
- If the remote contains a token, mask it in logs.

## Passing a temporary source during setup

- A source passed via CLI, such as `senti setup --plugin-source <remote-or-path>`, is saved to `plugin.sources[]` in `.senti/config.json` only if a preset / plugin from that source is selected.
- `plugin.packages[]` references the saved source id via `source`.
- Use fixed ids for official sources. If users want to specify one, they can use `--plugin-source-id <id>`.
- If no id is specified, auto-generate `source-xxxxxxx` from a hash of the remote / path.
- Source ids are restricted to path-safe single segments.

## Relationship with preset provider completion

- `base` remains as a core builtin.
- Preset provider completion for anything other than `base` performs reverse lookup across all of `plugin.sources[]`.
- If the provider is found, install / enable it and record the source id and reproducibility information in `plugin.packages[]`.
- If the provider is not found, return an error.
- Resolve not only the selected type but the entire parent chain, and install / enable non-base parent providers as needed.

## Policy for
... (truncated)