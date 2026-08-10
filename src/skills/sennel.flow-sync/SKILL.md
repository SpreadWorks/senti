---
name: sennel.flow-sync
description: Sync documentation with code. Use for docs generation, review, and commit.
---

# Spec-Driven Development Flow Sync

Sync documentation with the current codebase. Can be invoked from the finalize stage or run standalone.

## Behavior

- **When invoked from finalize**: Updates documentation and records progress in the spec's flow.json.
- **When run standalone**: Updates documentation only. No flow.json updates.

## Required Sequence

1. Run documentation sync.
   - Display: "Syncing documentation..."
   - Run `sennel flow run sync`.
   - Display the JSON result to the user.

2. Handle errors.
   - If the result contains an error, display the error message and stop.
   - If the result indicates review failure, inform the user and stop.

## Hard Stops

- Do not proceed if `sennel flow run sync` reports an error.
- **NEVER chain or background `sennel` commands.** Each `sennel` command must be run as a separate, foreground Bash invocation. Do not use `&&`, `||`, `;`, pipes, or `run_in_background`.

## Commands

```bash
sennel flow run sync
```
