To avoid `env SDD_FORGE_WORK_DIR=...` syntax and shell redirects that are incompatible with Codex approval prefixes, make the agent working directory and execution log output configurable as CLI arguments in `flow run` commands.

## Background

- When using `env SDD_FORGE_WORK_DIR=/path sdd-forge flow run ...`, the command starts with `env` rather than `sdd-forge`, which tends to trigger approval prompts every time.
- Shell redirects like `> .tmp/... 2>&1` are also incompatible with prefix-based approval evaluation.
- The current `SDD_FORGE_WORK_DIR` is used not as the target worktree for the flow, but as an override for the AI agent's temporary working directory, schema temp files, dumps, and the base directory for logs.
- The actual command strings are not generated solely by `sdd-forge`; the outer agent reads the flow prompt, skill, AGENTS, and config to compose the `env` prefix and redirects. Therefore, not only the CLI implementation but also the instruction side that agents reference must be updated.

## Proposed Changes

- Deprecate `SDD_FORGE_WORK_DIR` as the mechanism for overriding the agent working directory; add `--agent-work-dir <path>` instead.
- Treat `--agent-work-dir` as the base directory for agent/tmp/log for this CLI invocation only, taking precedence over the existing default of `config.agent.workDir > .tmp`.
- Add `--log-file <path>` to allow saving human-readable operation logs without shell redirects.
- Even when `--log-file` is omitted, automatically save the default execution log.
- Default save path: `<agentWorkDir>/logs/<flowId>/<action>-<phase>-<timestamp>.log`.
- `flowId` is derived from the spec directory name of the active flow's spec path. Example: `specs/258-draft-review-repair-flow/spec.md` → `258-draft-review-repair-flow`.
- For commands without an active flow: save to `<agentWorkDir>/logs/no-flow/<command>-<timestamp>.log`.
- The final JSON envelope continues to go to stdout; the log file receives progress, warnings, stderr-equivalent output, and AI call logs.
- Preserve stderr output as needed, simultaneously saving to the log file like an internal `tee`.
- Whether an explicit relative path passed to `--log-file` is resolved relative to the execution root or `agentWorkDir` should be settled in the spec.

## Instruction-Side Updates

- Update the "Temporary output path rule" in `src/templates/partials/core-principle.md` to reflect the new spec.
- Update `src/templates/skills/sdd-forge.flow/SKILL.md` — flow execution rules, command examples, and redirect policy — to assume `--agent-work-dir` / `--log-file`.
- Propagate template changes to the generated skills `.agents/skills/sdd-forge.flow/SKILL.md` and `.claude/skills/sdd-forge.flow/SKILL.md` via `sdd-forge upgrade`.
- Review `AGENTS.md`, `src/AGENTS.md`, `docs/cli_commands.md`, `docs/configuration.md`, and any other locations that still describe `SDD_FORGE_WORK_DIR` or shell redirect patterns, and sync them to the new spec.
- Explicitly replace command examples in instruction text so that the outer agent uses `sdd-forge flow run ... --agent-work-dir ... --log-file ...` instead of composing `env SDD_FORGE_WORK_DIR=...` or `> file 2>&1`.

## Expected Benefits

- Approval rules become easier to register as stable prefixes like `["sdd-forge", "flow", "run", "gate"]`.
- Runtime approval prompts for `gate`/`review` and similar commands are reduced in Codex sessions.
- Long-running command output can be reviewed without shell redirects.
- Per-flow logs are consolidated under `<agentWorkDir>/logs/<flowId>/`, making it easier to trace the history of `gate`/`review`/`test`/`finalize`.
- The new CLI options and the operational instructions read by agents stay in sync, making it harder to regress to the old `env`/redirect approach after implementation.

<details>
<summary>ja</summary>

承認プリフィックスに合わせて flow の agent 作業ディレクトリと実行ログを引数化する

Codex の承認プリフィックスと相性が悪い env SDD_FORGE_WORK_DIR=... 形式と shell リダイレクトを避けるため、flow run 系コマンドで agent 作業ディレクトリと実行ログ出力を CLI 引数として扱えるようにする。

背景:
- env SDD_FORGE_WORK_DIR=/path sdd-forge flow run ... の形だと、コマンド先頭が sdd-forge ではなく env になるため承認が毎回必要になりやすい。
- > .tmp/... 2>&1 の shell リダイレクトも prefix 評価と相性が悪い。
- 現行の SDD_FORGE_WORK_DIR は flow の対象 worktree ではなく、AI agent の一時作業ディレクトリ、schema 一時ファイル、dump、ログ基準ディレクトリの上書きとして使われている。
- 実際のコマンド文字列は sdd-forge が単独で生成しているのではなく、外側の agent が flow prompt、skill、AGENTS、config を読んで env 指定やリダイレクトを付けている。そのため CLI 実装だけでなく、agent が参照する指示側も更新する必要がある。

対応案:
- SDD_FORGE_WORK_DIR による agent 作業ディレクトリ上書きを廃止し、--agent-work-dir <path> を追加する。
- --agent-work-dir はこの CLI 実行だけの agent/tmp/log 基準ディレクトリとして扱い、既存の config.agent.workDir > .tmp の既定値より優先する。
- --log-file <path> を追加し、shell リダイレクトなしで人間向けの動作ログを保存できるようにする。
- --log-file が省略された場合も、既定の実行ログを自動保存する。
- 既定の保存先は <agentWorkDir>/logs/<flowId>/<action>-<phase>-<timestamp>.log とする。
- flowId は active flow の spec パスから spec ディレクトリ名を取得する。例: specs/258-draft-review-repair-flow/spec.md -> 258-draft-review-repair-flow。
- active flow がないコマンドでは <agentWorkDir>/logs/no-flow/<command>-<timestamp>.log に保存する。
- 最終 JSON envelope は従来どおり stdout に出し、log file には進捗、警告、stderr 相当、AI 呼び出しなどの動作ログを保存する。
- 必要に応じて stderr への表示も維持し、内部 tee のようにログファイルへ同時保存する。
- --log-file の明示パスは相対パスなら実行時の root または agentWorkDir 基準のどちらにするかを spec で確定する。

指示側の更新:
- src/templates/partials/core-principle.md の Temporary output path rule を新仕様に更新する。
- src/templates/skills/sdd-forge.flow/SKILL.md の flow 実行ルール、コマンド例、リダイレクト方針を --agent-work-dir / --log-file 前提に更新する。
- 生成済み skill である .agents/skills/sdd-forge.flow/SKILL.md と .claude/skills/sdd-forge.flow/SKILL.md はテンプレート変更後に sdd-forge upgrade で反映する。
- AGENTS.md / src/AGENTS.md / docs/cli_commands.md / docs/configuration.md など、SDD_FORGE_WORK_DIR または shell リダイレクト前提の説明が残る箇所を確認し、新仕様へ同期する。
- 外側の agent が env SDD_FORGE_WORK_DIR=... や > file 2>&1 を組み立てず、sdd-forge flow run ... --agent-work-dir ... --log-file ... を使うように、指示文のコマンド例を明示的に置き換える。

期待効果:
- 承認ルールを ["sdd-forge", "flow", "run", "gate"] のような安定した prefix で登録しやすくなる。
- Codex セッションで gate/review などの実行時承認要求が減る。
- 長時間コマンドの出力確認を shell リダイレクトなしで行える。
- flow 単位のログが <agentWorkDir>/logs/<flowId>/ にまとまり、gate/review/test/finalize の履歴を追いやすくなる。
- CLI の新オプションと agent が読む運用指示が一致し、実装後も旧 env/リダイレクト形式へ戻りにくくなる。

</details>