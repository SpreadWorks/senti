# Feature Specification: 315-spawn-enoent-diagnostics

**Feature Branch**: `feature/315-spawn-enoent-diagnostics`
**Created**: 2026-07-02
**Status**: Draft
**Input**: GitHub Issue #409

## Goal
agent CLI command が ENOENT で解決できない場合に、利用者が `senti` 起動環境の PATH と agent provider 設定を切り分けられる診断情報を返す。

## Background
Issue #409 was created after `senti workflow refine 30fc` failed with `spawn codex ENOENT` inside a workflow agent call. The root cause was that the `senti` process PATH did not include the directory containing `codex`. Current Agent code already clones `process.env`, so the functional gap is not PATH loss inside Agent; it is that the child process error is returned without command, PATH, provider, profile, commandId, or remediation guidance.

## Scope
- `src/lib/agent.js` の ENOENT 専用診断を追加する。
- `process.env.PATH` を含む既存 environment 継承と `CLAUDECODE` 削除の現行挙動を維持する。
- provider profile の `command` 値は相対 command でも絶対パスでもそのまま `spawn()` に渡す。
- `src/lib/agent.js` 周辺の unit test で ENOENT 診断と既存挙動の migration parity を検証する。

## Out of Scope
- pnpm / npm / nvm など package manager 固有の PATH 補完。
- 環境固有の絶対パスの埋め込み。
- claude / codex provider の CLI args、model default、JSON parse contract の変更。
- workflow plugin の command surface や board/refine service behavior の変更。

## Constraints
- 外部依存は追加しない。Node.js built-in module だけを使う。
- `src/` 配下にユーザー環境固有の path を含めない。
- 診断 message に prompt、system prompt、agent response body を含めない。
- PATH 補完は行わず、`senti` を起動する環境の PATH に対象 CLI を追加する案内に留める。
- 非 ENOENT の既存 error formatting は provider/profile/exit/stderr/stdoutPreview を保持する。

## Design Principles
- agent command resolution は Node.js の `spawn()` と起動時 environment に委ね、senti 側で package manager 固有探索をしない。
- ENOENT だけを実行環境診断として拡張し、他の failure path は既存の close handler contract を保つ。
- エラー文面は切り分けに必要な設定・環境情報に限定する。

## Overview
### Modules
- `src/lib/agent.js`: Agent service が profile resolution、invocation build、spawn execution、retry、logging、metrics を所有する。
- `src/lib/provider.js`: ProviderRegistry が profile.command と provider family を解決し、Agent は解決済み profile.command を spawn に渡す。
- `tests/unit/lib/agent-service.test.js` と `agent-with-logger.test.js`: Agent resolution、spawn invocation、failure logging の unit coverage を持つ。

### Data Flow
- caller は `agent.call(prompt, { commandId })` を呼び、Agent は commandId と profile 設定から provider/profile を解決する。
- `_buildInvocation` は args と env を作り、`_callOnce` が `spawn(profile.command, finalArgs, { cwd, env })` を実行する。
- ENOENT は child `error` event で発生し、今回の変更で command/PATH/provider/profile/commandId を含む診断 error に変換される。

### Decisions
- [VERIFY] checked env handling in `src/lib/agent.js`; result=match: `_buildInvocation` clones `process.env` and removes only `CLAUDECODE`.
- [VERIFY] checked spawn command handling in `src/lib/agent.js`; result=match: `_callOnce` passes `profile.command` directly to spawn.
- [VERIFY] checked provider resolution in `src/lib/provider.js`; result=match: raw profile entry keeps `command` and user profiles can override built-ins.
- [VERIFY] checked test placement; result=match: Agent service and logger integration tests already exercise success, resolution failure, and non-zero exit behavior.
- Migration inventory: affected API is `Agent.call`; affected command surface is any command using Agent including workflow refine; affected side effects are logger end events and flow metrics. No config, hook, or artifact format changes.
- Migration mapping: `Agent.call` and spawn behavior stay owned by `src/lib/agent.js`; workflow plugin keeps forwarding core Agent errors; logger and metrics stay owned by `runWithLogging`.
- Spec repair: ENOENT diagnostic errors must preserve `error.code === "ENOENT"` so workflow failure envelopes keep their existing code contract.

## Clarifications (Q&A)
- Q: Should PATH be included in the diagnostic even if it contains user-specific directories?
  - A: Yes. Issue #409 explicitly requires PATH in the diagnosable error. The message must not include prompts or secrets beyond the process PATH value already used for resolution.
- Q: Should workflow refine get a plugin-specific fix?
  - A: No unless implementation proves commandId is lost. The workflow plugin already passes `workflow.refine`; the core Agent error should carry that commandId.

## Alternatives Considered
- Search pnpm global, npm global, nvm, or common bin directories when command lookup fails. — Rejected because Issue #409 explicitly forbids package-manager-specific PATH completion and the project rule forbids environment-specific paths in `src/`.
- Wrap only workflow refine errors in the workflow plugin. — Rejected because the same spawn failure can occur for docs, flow, hooks, and plugins; core Agent owns the shared spawn boundary.
- Hide PATH from the message. — Rejected because the user cannot distinguish a missing CLI from a wrong provider command without seeing the PATH used by the `senti` process.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-07-02T10:28:43.686Z
- Notes: autoApprove accepted after spec-gate PASS for Issue #409

## Requirements
- R1 [must]: When child process spawn emits ENOENT, Agent shall throw an error preserving `error.code === "ENOENT"` and containing the attempted command, the PATH used for spawn resolution, provider, profile, commandId, and an actionable suggestion to add the CLI to the PATH of the environment that starts `senti`.
- R2 [must]: Agent shall preserve the existing spawn environment behavior: clone `process.env`, keep `PATH: process.env.PATH` when present, and continue removing only `CLAUDECODE` from the invocation env.
- R3 [must]: Agent shall pass the configured provider profile `command` value to `spawn()` without package-manager-specific path completion or environment-specific absolute path insertion.
- R4 [must]: Migration parity shall be maintained for retained behavior: successful agent calls still return trimmed output, non-ENOENT failures keep existing provider/profile/exit/stderr/stdoutPreview diagnostics, logger end events still record failure, and flow metrics keep provider/profile dimensions.
- R5 [must]: Unit coverage shall verify ENOENT diagnostics and retained Agent behavior without requiring live claude, codex, pnpm, npm, or nvm installations.

## Acceptance Criteria
- AC1: A unit test using a missing command receives an error with `code === "ENOENT"` and a message containing `command=<value>`, `PATH=`, `provider=<value>`, `profile=<value>`, `commandId=<value>`, and guidance to add the CLI to the PATH used to start `senti`.
- AC2: A unit test proves `_buildInvocation` preserves `process.env.PATH` in the env passed to spawn and still omits `CLAUDECODE`.
- AC3: A unit test using an absolute command path observes that the configured `command` value is retained as the invocation command and no package-manager-specific fallback path is added.
- AC4: Behavior-level parity is verified for every retained surface listed in R4: successful `Agent.call()` returns trimmed output, non-ENOENT failure message still includes provider/profile/exit or stderr context, logger end event records non-zero failure, and flow metric accumulation still receives provider/profile dimensions.
- AC5: The implementation diff contains no hardcoded user-specific paths and no pnpm/npm/nvm-specific PATH completion logic.

## Implementation Targets
- src/lib/agent.js
- tests/unit/lib/agent-service.test.js
- tests/unit/lib/agent-with-logger.test.js

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Add ENOENT diagnostics
  - Extend the Agent spawn error path so unresolved provider commands produce contextual diagnostics while retained Agent behavior remains unchanged.
  - see `tasks/T-1.md` for full spec
