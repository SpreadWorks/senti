# Changelog

## Unreleased

### Breaking Changes

#### `flow run auto-check` input is now phase-aware; `--input` removed (spec 220)

`sdd-forge flow run auto-check` no longer accepts `--input <text>`. The input is now derived statically from flow state based on progress phase:

- `approval` step done → AI is skipped, verdict is unconditionally `{eligible: true, skipped: true, reason: "spec approved"}`.
- `gate-draft` step done and `draft.md` present → input is `issue + request + draft body`.
- Otherwise → input is `issue + request`.

Preparing-mode invocations (no active flow) now **require** `--run-id`. The previous heuristic of auto-selecting the sole preparing flow was removed because abandoned preparing records accumulate over time and would silently target the wrong flow once a second preparing appears. Affected commands: `flow run auto-check`, `flow set auto on|off`. The error code for missing `--run-id` is `MISSING_RUN_ID` (replaces the previous `MULTIPLE_PREPARING_FLOWS` surfacing in this scenario).

**Migration:**

- Replace `flow run auto-check --input "<text>"` with `flow set init [--issue N] [--request "..."]` → `flow run auto-check --run-id <runId>` (runId returned from `set init`).
- If a script relied on auto-selection with exactly one preparing flow, add `--run-id <id>` explicitly.
- `set auto on/off` against preparing flows: same — add `--run-id`.

The `set auto on` spec-approved skip path and the input-resolution logic are now shared between `run-auto-check.js` and `set-auto.js` via `src/flow/lib/resolve-auto-check-input.js`.

#### Agent provider `jsonOutputFlag` removed; builtin profiles embed JSON flag literally

The implicit JSON flag injection mechanism has been removed. `config.agent.providers.<key>.jsonOutputFlag` is no longer recognized and its auto-injection behavior is gone.

**What changed:**

- `ClaudeProvider` builtin profiles (`claude/opus`, `claude/sonnet`) now include `--output-format json` directly in `args`.
- `CodexProvider` builtin profiles (`codex/gpt-5.4`, `codex/gpt-5.3`) now include `--json` directly in `args`. This fixes `agent output parse failed (CodexProvider): Unexpected token 'P'...` warnings and restores usage metrics recording for codex-backed agent calls.
- `Provider.jsonFlag()` / subclass overrides and the `injectJsonFlag` helper in `Agent._buildInvocation` have been removed.

**Migration:** If your `.sdd-forge/config.json` had a custom profile relying on `jsonOutputFlag`, add the corresponding CLI flag directly to that profile's `args` array instead. If you referenced the builtin profiles only, no change is needed — the flag is now already in the args.

#### Agent command ID renamed to phase-based hierarchy

Agent profile command IDs have been systematically renamed along phase-based axes.
If you have custom `agent.profiles` entries with old command IDs, update the keys manually.

| Before | After |
|---|---|
| `context.search` | `flow.context.search` |
| `spec.gate` | `flow.spec.gate` |
| `flow.review.spec` | `flow.spec.review` |
| `flow.review.draft` | `flow.impl.review.draft` |
| `flow.review.final` | `flow.impl.review.final` |
| `flow.review.test` | `flow.test.review` |
| `flow.retro` | `flow.finalize.retro` |

**Migration:** Open `.sdd-forge/config.json` and replace old keys in `agent.profiles.<name>` with the new names shown above. If you used `flow.review` as a prefix for bulk assignment, either set each new ID individually or use the `flow` prefix for all flow commands.

#### Agent configuration redesign — `agent.commands` and `agent.providers.*.profiles` removed

The following fields are no longer recognized and will be silently ignored:

- `agent.commands` — per-command agent override map
- `agent.providers.<key>.profiles` — provider-level argument switching

**Migration:** Replace `agent.commands` with the new `agent.profiles` format.

**Before:**
```jsonc
{
  "agent": {
    "default": "claude",
    "providers": {
      "claude": {
        "command": "claude",
        "args": ["-p", "{{PROMPT}}"],
        "profiles": {
          "fast": ["-p", "{{PROMPT}}", "--model", "haiku"]
        }
      }
    },
    "commands": {
      "docs": { "agent": "claude", "profile": "fast" },
      "spec": { "agent": "claude", "profile": "default" }
    }
  }
}
```

**After:**
```jsonc
{
  "agent": {
    "default": "claude/sonnet",
    "providers": {
      "claude/haiku": { "command": "claude", "args": ["-p", "{{PROMPT}}", "--model", "haiku"] }
    },
    "profiles": {
      "fast": {
        "docs": "claude/haiku",
        "spec": "claude/sonnet"
      }
    },
    "useProfile": "fast"
  }
}
```

### New Features

#### `agent.profiles` — named profile routing

Profiles map command ID prefixes to provider keys. The active profile is selected by `agent.useProfile`.

```jsonc
"profiles": {
  "default": {
    "docs": "claude/sonnet",
    "spec": "claude/opus"
  }
}
```

Prefix matching is used: a profile entry `"docs"` matches command IDs `docs`, `docs.review`, `docs.forge`, etc. When multiple entries match, the longest prefix wins.

#### `agent.useProfile` — active profile selector

```jsonc
"useProfile": "default"
```

#### `SDD_FORGE_PROFILE` environment variable

Override `agent.useProfile` at runtime without modifying config:

```bash
SDD_FORGE_PROFILE=fast sdd-forge docs build
```

The environment variable takes precedence over `agent.useProfile`.

#### Built-in providers

The following providers are available without configuration:

| Key | Command |
|---|---|
| `claude/sonnet` | `claude -p {{PROMPT}} --model sonnet` |
| `claude/opus` | `claude -p {{PROMPT}} --model opus` |
| `codex/gpt-5.4` | `codex exec -m gpt-5.4 --full-auto -C .tmp {{PROMPT}}` |
| `codex/gpt-5.3` | `codex exec -m gpt-5.3-codex --full-auto -C .tmp {{PROMPT}}` |

User-defined providers in `agent.providers` override built-ins with the same key.
