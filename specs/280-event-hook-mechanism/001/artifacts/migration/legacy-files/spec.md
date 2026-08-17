# Feature Specification: 280-event-hook-mechanism

**Feature Branch**: `feature/280-event-hook-mechanism`
**Created**: 2026-06-05
**Status**: Draft
**Input**: GitHub Issue #366

## Goal
flow prepare --worktree の worktree 作成直後に、.sdd-forge/config.json の flow.hooks.PostWorktree で定義された shell command を非中断で実行できるようにし、sdd-forge hook list で利用可能な hook と現在設定を確認できるようにする。

## Background
flow prepare --worktree currently creates an isolated worktree and then writes spec/draft state, but it has no project-configurable extension point immediately after worktree creation. Users who need submodule initialization or dependency installation in the new worktree must run those steps manually or wrap sdd-forge externally. Issue #366 defines a single concern: add a flow hook mechanism with PostWorktree support and a management command that exposes the available hook definitions and current configuration.

## Scope
- flow.hooks 設定を config schema に追加する。
- onHook(hookName, context) で hook 設定参照、{{KEY}} 置換、shell command 実行、10分 timeout、非中断警告、結果 envelope 返却を行う。
- flow prepare --worktree の git worktree add 成功直後に PostWorktree を呼び出す。
- sdd-forge hook list を追加し、標準は表形式、オプションで JSON 出力に対応する。
- config validation、hook execution、PostWorktree 呼び出し、CLI routing/help を spec-local tests と必要な shared regression で固定する。

## Out of Scope
- PostWorktree 以外の hook 実行点は追加しない。
- npm install や git submodule update などのプロジェクト固有 command を src/ に固定しない。
- 外部 npm package は追加しない。
- npm publish、dist-tag、release 作業は行わない。

## Constraints
- src/ 以下に特定プロジェクト固有の hook command 値を書かない。hook command は config から読む。
- 外部依存を追加せず、Node.js 組み込み module と既存 command/dispatcher/config/process pattern を使う。
- hook failure は caller flow を中断しない。失敗時は console.warn で警告し、返却 envelope で ok:false を観測可能にする。
- context に存在しない {{KEY}} placeholder は元の文字列を残し、警告で設定ミスを見せる。
- hook command は shell 構文を含められる文字列として実行する。
- sdd-forge hook list は既存 top-level command の意味を変えない新規 namespace とする。
- sdd-forge hook list の exit code contract: valid invocation は表示対象 hook が未設定でも exit 0、unknown option や invalid value は non-zero とする。
- sdd-forge hook list の user-facing argument: --json は boolean flag で、指定時は JSON を stdout に出力する。その他の引数や option は invalid として non-zero にする。

## Design Principles
- 設定値は利用者が所有し、実装は hook 定義と実行境界だけを提供する。
- prepare flow の既存成功条件を hook 設定で狭めない。
- 管理 CLI は人間が読む標準表示と automation 用 JSON を分離する。

## Overview
### Modules
- src/lib/hooks.js: flow hook 定義、placeholder 置換、shell command 実行、hook list 用 metadata を集約する新規 shared utility。
- src/flow/lib/run-prepare-spec.js: git worktree add 成功直後に PostWorktree を呼び出す prepare integration point。
- src/hook.js and src/hook/commands/list.js: sdd-forge hook list namespace と list command を提供する。
- src/lib/config.js: CONFIG_SCHEMA.flow.hooks を string map として許可する。

### Data Flow
- .sdd-forge/config.json -> loadConfig -> onHook(PostWorktree, { CWD }) -> placeholder replacement -> shell execution with cwd=context.CWD -> warning/result envelope.
- sdd-forge hook list -> hook definitions + config.flow.hooks -> table stdout or --json structured stdout.

### Decisions
- [VERIFY] run-prepare-spec.js centralizes worktree creation; PostWorktree belongs immediately after git worktree add.
- [VERIFY] config schema must be extended because root config validation disallows unknown properties.
- [VERIFY] new hook CLI should follow existing namespace dispatcher and command registry patterns.
- Shell string execution is required for hook command values.
- Missing placeholders remain visible and produce warning output.
- hook list defaults to table output and supports JSON via option.

## Clarifications (Q&A)
- Q: Should hook commands be shell strings or argument arrays?
  - A: Shell strings. The user selected shell string execution in draft-refine q1 because Issue #366 includes shell syntax.
- Q: How should missing placeholders be handled?
  - A: Leave the original {{KEY}} token in the command string and warn. The user selected this in draft-refine q2.
- Q: What output format should hook list use?
  - A: Table output by default, with --json for structured output. The user selected this in draft-refine q3.

## Alternatives Considered
- Argument-array hook commands only — Rejected because Issue #366 requires shell command execution and gives an example containing &&.
- Replace missing placeholders with an empty string — Rejected because it hides configuration mistakes and can silently transform the command.
- JSON-only hook list output — Rejected because hook list is primarily a management command for human inspection; JSON remains available through --json.
- Make hook failure abort flow prepare — Rejected because Issue #366 requires hook failures not to interrupt the caller flow.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-06-05T06:08:06.281Z
- Notes: User approved spec via option 1.

## Requirements
- R1 [must]: Add flow.hooks to .sdd-forge/config.json schema as an object whose additional property values are strings.
- R2 [must]: Implement onHook(hookName, context) so an undefined hook returns a successful no-op envelope, a defined hook replaces all {{KEY}} tokens with context values, leaves missing keys unchanged with a warning, executes the replaced command as a shell command with a 600000 ms timeout and cwd set to context.CWD when provided, returns { ok, output, stderr, status }, and never throws hook execution failure to the caller.
- R3 [must]: Call PostWorktree immediately after git worktree add succeeds in flow prepare --worktree, passing { CWD: worktreePath }, executing the hook command with cwd set to worktreePath, and continue prepare even when the hook result is ok:false.
- R4 [must]: Add sdd-forge hook list with table output by default and --json output on request, listing PostWorktree name, description, available placeholders, and current configured command value.
- R5 [must]: Cover config validation, onHook no-op/success/failure/missing-placeholder behavior, PostWorktree prepare integration, and hook list table/JSON/invalid-argument behavior with tests.

## Acceptance Criteria
- Given config.flow.hooks.PostWorktree is unset, onHook("PostWorktree", { CWD }) returns ok:true without executing a command.
- Given config.flow.hooks.PostWorktree is `printf {{CWD}}`, onHook replaces {{CWD}} with the provided path and returns stdout in output.
- Given config.flow.hooks.PostWorktree contains an unavailable {{MISSING}} token, onHook leaves `{{MISSING}}` in the command string and emits a warning.
- Given onHook("PostWorktree", { CWD }) executes a configured shell command, the child process working directory is CWD.
- Given a configured hook command exits non-zero, onHook returns ok:false with stderr/status and prepare continues after warning.
- After git worktree add succeeds in flow prepare --worktree, PostWorktree is invoked before spec/draft files are written.
- `sdd-forge hook list` exits 0 and prints PostWorktree with description, placeholders, and current config value.
- `sdd-forge hook list --json` exits 0 and prints structured JSON containing the same PostWorktree data.
- `sdd-forge hook list --unknown` exits non-zero.

## Implementation Targets
- src/lib/config.js
- src/lib/hooks.js
- src/flow/lib/run-prepare-spec.js
- src/sdd-forge.js
- src/hook.js
- src/hook/commands/list.js
- src/lib/command-registry.js
- specs/280-event-hook-mechanism/tests/
- tests/unit/lib/config.test.js
- tests/e2e/dispatchers.test.js

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Add hook configuration
  - Allow flow.hooks string values in config validation and expose shared hook definitions for PostWorktree.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Implement hook execution
  - Implement onHook so configured hook commands are rendered, executed as shell strings, and reported without interrupting callers.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Wire PostWorktree
  - Invoke PostWorktree immediately after worktree creation in prepare flow while preserving existing prepare success behavior.
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Add hook list CLI
  - Add sdd-forge hook list so users can inspect available hooks and current configuration.
  - see `tasks/T-4.md` for full spec
