# Draft: CI/CD Preset

## Requirements Summary

1. New preset `ci` with `base` as parent
2. Scan target: `.github/workflows/*.yml` only (GitHub Actions, others future)
3. Data structure: `pipelines` category (platform-agnostic naming)
4. Chapter: `ci_cd.md` (single chapter)
5. DataSource methods: `list`, `jobs`, `env`
6. YAML parser: regex + indent-based simple parser (no external deps)
7. Template: `{{text}}` for Description only, `{{data}}` for structured data

## Key Decisions

- CI/CD preset is a cross-cutting concern, independent from webapp/cli/library
- GitHub Actions "workflow" maps to generic "pipeline" concept
- Platform-specific terms are abstracted: `runs-on` → `runner`, `uses` → `dependencies`
- Batch processing logic belongs in framework presets, not CI preset
- `platform` field in scan output for future multi-platform support

## Data Structure

```json
{
  "pipelines": {
    "pipelines": [
      {
        "file": ".github/workflows/deploy.yml",
        "name": "Deploy",
        "platform": "github-actions",
        "triggers": ["push (main)", "workflow_dispatch"],
        "jobs": [
          {
            "id": "build",
            "runner": "ubuntu-latest",
            "steps": 5,
            "dependencies": ["actions/checkout@v4", "actions/setup-node@v4"]
          }
        ],
        "envVars": ["NODE_ENV"],
        "secrets": ["AWS_ACCESS_KEY_ID"]
      }
    ],
    "summary": {
      "total": 1,
      "totalJobs": 1
    }
  }
}
```

## YAML Parser Scope

Supported:
- `name:` — workflow name
- `on:` — triggers (push, pull_request, schedule, workflow_dispatch, etc.)
- `jobs:` — job IDs, `runs-on`, `steps` array
- `${{ secrets.XXX }}` / `${{ env.XXX }}` — reference extraction
- `uses:` — external action dependencies

Out of scope:
- YAML anchors & aliases (`&` / `*`)
- Full matrix expansion
- Recursive reusable workflow resolution

## Template Structure

```markdown
# CI/CD

## Description
<!-- {{text: ...}} -->
<!-- {{/text}} -->

## Pipelines
<!-- {{data: pipelines.list("Name|File|Triggers|Jobs")}} -->
<!-- {{/data}} -->

## Job Details
<!-- {{data: pipelines.jobs("Pipeline|Job|Runner|Steps|Dependencies")}} -->
<!-- {{/data}} -->

## Secrets & Environment Variables
<!-- {{data: pipelines.env("Pipeline|Secrets|Env Vars")}} -->
<!-- {{/data}} -->
```

- [x] User approved this draft (2026-03-20)
