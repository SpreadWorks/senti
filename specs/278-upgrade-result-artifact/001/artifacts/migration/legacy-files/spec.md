# Feature Specification: 278-upgrade-result-artifact

**Feature Branch**: `feature/278-upgrade-result-artifact`
**Created**: 2026-06-05
**Status**: Draft
**Input**: GitHub Issue #362

## Goal
sdd-forge upgrade の実行結果を spec 配下の専用 artifact として保存し、upgrade 必須変更がある flow で integration gate / finalize / report がその証跡を参照できるようにする。

## Background
スキルやプリセットのソースを変更した場合、プロジェクトルール上 `sdd-forge upgrade` の実行が必要になる。現状の upgrade は結果を stdout に出すだけで、flow の spec ディレクトリに機械可読な証跡を残さない。一方、integration gate は test-execute-result.json などの標準 artifact を検証してから進む設計である。upgrade 実行結果を同じ flow artifact 体系に載せることで、gate 再試行時の手動説明や会話履歴依存を減らす。

## Scope
- must: upgrade-result.json の schema と validator
- must: active flow 中に sdd-forge upgrade 実行結果を spec 配下へ保存する仕組み
- must: upgrade 必須変更がある場合の integration gate 検証
- must: finalize/report の durable artifact 対象への追加
- should: flow skill / prompt への upgrade artifact 手順反映と sdd-forge upgrade による派生スキル更新

## Out of Scope
- test-execute-result.json v2 の runtime test contract 変更
- sdd-forge upgrade の公開 CLI オプション削除や意味変更
- npm publish や dist-tag 操作
- workflow board の運用ルール変更
- upgrade 失敗時の issue-log 自動記録

## Constraints
- 外部依存は追加しない。Node.js 組み込みモジュールのみで実装する。
- sdd-forge upgrade の既存公開 CLI 形式 `sdd-forge upgrade [--dry-run]` は維持する。新しい必須ユーザー引数は追加しない。
- sdd-forge upgrade の user-facing input は entry point の parseUpgradeArgs で検証する。許可する引数は `--dry-run` boolean flag、`--help` boolean flag、`-h` alias のみで、値付き option、positional argument、未知の option は受け付けない。
- src/ 以下にプロジェクト固有情報を含めない。upgrade 必須判定は汎用パスと既存設定に基づく。
- upgrade artifact は test-execute-result.json へ混ぜず、専用の upgrade-result.json と raw log に分離する。
- upgrade command の既存失敗条件は非ゼロ exit code のまま維持する。artifact 書き込み失敗は active flow 中の upgrade 失敗として非ゼロにする。

## Design Principles
- 既存の test artifact contract と upgrade artifact contract を分離する。
- gate が必要とする判断は machine-readable field から行い、stdout や会話履歴に依存しない。
- artifact path と raw log path は spec ディレクトリ配下に閉じる。

## Overview
### Modules
- `src/upgrade.js`: upgrade 実行結果を構造化し、active flow 中だけ spec artifact と raw log を保存する。
- `src/flow/lib/test-artifacts.js`: upgrade artifact のファイル名、durable pathspec、validator、gate 用判定 helper を持つ。
- `src/flow/lib/run-gate.js`: integration gate 前に upgrade 必須変更を検出し、必要時に upgrade-result.json を検証する。
- `src/flow/lib/run-finalize.js` / report 周辺: upgrade artifact を durable artifact と report 入力に含める。

### Data Flow
- active flow 中に `sdd-forge upgrade` を実行すると、stdout と同等の raw log を `specs/<spec>/tests/.raw/upgrade.log` に保存し、summary を `specs/<spec>/upgrade-result.json` に保存する。
- integration gate は baseBranch との差分から UPGRADE_REQUIRED_SOURCE_PATTERNS に一致する repo-relative file path を抽出する。対象変更がある場合、upgrade-result.json を読み、schema、rawLogPath、result、checkedPaths、summary を検証する。
- finalize/report は upgrade-result.json と raw log を durable artifact として保持し、report で upgrade status を表示できる。

### Decisions
- [VERIFY] upgrade は stdout summary のみを出し、spec artifact を書かない。
- [VERIFY] integration gate の現行 trust input は test/regression artifact に限定されている。
- [VERIFY] durable artifact pathspec に upgrade-result.json は含まれていない。
- upgrade 証跡は test-execute-result.json に混ぜず、専用 upgrade-result.json と raw log に分離する。
- upgrade 失敗は upgrade-result.json result=failed で gate が block できればよく、issue-log 自動記録は範囲外にする。
- upgrade 必須変更の検出は固定の UPGRADE_REQUIRED_SOURCE_PATTERNS で行う: `src/upgrade.js`, `src/skills/**`, `src/presets/**`, `src/lib/skills.js`, `src/lib/include.js`, `src/lib/skill-rules.js`, `src/docs/lib/directive-parser.js`, `src/lib/preset-deploy.js`, `src/lib/presets.js`, `src/lib/agent-defaults.js`, `src/lib/config.js`。
- `checkedPaths` は artifact 作成時点の baseBranch...HEAD 差分のうち UPGRADE_REQUIRED_SOURCE_PATTERNS に一致した repo-relative file paths の sorted unique array とする。source roots や glob pattern の一覧ではない。

## Clarifications (Q&A)
- Q: upgrade artifact は test-execute-result.json に含めるか。
  - A: 含めない。test-execute-result.json は runtime test/regression の contract として維持し、upgrade-result.json を専用 artifact とする。
- Q: upgrade 失敗時に issue-log を自動記録するか。
  - A: しない。今回の必須範囲は upgrade-result.json と raw log による追跡、および gate block までである。
- Q: 公開 CLI の引数は変更するか。
  - A: 変更しない。`sdd-forge upgrade [--dry-run]` の既存 interface を維持し、active flow の有無から artifact 書き込みを制御する。

## Alternatives Considered
- test-execute-result.json に upgrade 証跡を追加する — test-execute-result.json は runtime test/regression の証跡であり、upgrade の maintenance 証跡を混ぜると既存 consumer の意味が曖昧になるため採用しない。
- issue-log だけで upgrade 失敗を追跡する — Issue #362 は手動 issue-log 依存を減らすことを求めている。gate が読める標準 artifact にならないため採用しない。
- sdd-forge upgrade に必須の新規ユーザー引数を追加する — 既存 CLI interface を変える必要がなく、active flow context から spec artifact path を解決できるため採用しない。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-06-05T00:22:44.383Z
- Notes: User approved gate-passed spec via choice 1.

## Requirements
- R1 [must]: active flow 中の `sdd-forge upgrade` は `specs/<spec>/upgrade-result.json` version 1 を保存する。artifact は command、dryRun、exitCode、result、summary、checkedPaths、rawLogPath を含み、result は success-no-change、success-updated、failed のいずれかである。checkedPaths は artifact 作成時点の baseBranch...HEAD 差分で UPGRADE_REQUIRED_SOURCE_PATTERNS に一致した repo-relative file paths の sorted unique array である。
- R2 [must]: upgrade-result.json の rawLogPath は spec ディレクトリ配下の raw log を指す。raw log は upgrade の user-facing output と失敗 message を含み、artifact validator は rawLogPath が spec ディレクトリ外を指す場合に失敗する。
- R3 [must]: integration gate は baseBranch...HEAD 差分に UPGRADE_REQUIRED_SOURCE_PATTERNS (`src/upgrade.js`, `src/skills/**`, `src/presets/**`, `src/lib/skills.js`, `src/lib/include.js`, `src/lib/skill-rules.js`, `src/docs/lib/directive-parser.js`, `src/lib/preset-deploy.js`, `src/lib/presets.js`, `src/lib/agent-defaults.js`, `src/lib/config.js`) のいずれかに一致する file path が含まれる場合、upgrade-result.json を必須 trust input として検証する。
- R4 [must]: integration gate は upgrade-result.json が missing、schema invalid、raw log missing、result=failed、または checkedPaths が現在の baseBranch...HEAD 差分から再計算した UPGRADE_REQUIRED_SOURCE_PATTERNS matched paths と完全一致しない場合に FAIL する。upgrade 必須変更がない場合は upgrade-result.json を要求しない。
- R5 [must]: finalize/report は upgrade-result.json と raw log を durable artifact として保持し、report の machine-readable data から upgrade result と summary を参照できる。
- R6 [should]: flow skill / prompt は、src/skills または src/presets 等を変更した場合に `sdd-forge upgrade` を実行し、upgrade artifact が gate 入力になることを明記する。
- R7 [must]: spec behavior coverage は `specs/278-upgrade-result-artifact/tests/` 配下に追加する。各 test file は対象 requirement を示す `// spec: R<N> ...` header で始め、upgrade artifact writer/validator、gate の upgrade evidence 判定、finalize/report の durable artifact 参照を coverage する。
- R8 [must]: `sdd-forge upgrade` の entry point は user-facing arguments を parseUpgradeArgs で検証する。許可される入力は `--dry-run` boolean flag、`--help` boolean flag、`-h` alias のみで、type は presence-based boolean、format/range は値なし・範囲なしである。値付き option、positional argument、未知の option は既存 parseArgs の validation error として拒否する。

## Acceptance Criteria
- active flow 中に `sdd-forge upgrade --dry-run` または `sdd-forge upgrade` を実行すると、spec ディレクトリ配下に upgrade-result.json と raw log が作成される。
- upgrade-result.json は version=1、command、dryRun、exitCode、result、summary、checkedPaths、rawLogPath を持つ。
- checkedPaths は source root や glob pattern ではなく、baseBranch...HEAD 差分中で UPGRADE_REQUIRED_SOURCE_PATTERNS に一致した repo-relative file paths の sorted unique array である。
- upgrade 必須変更がある状態で upgrade-result.json が存在しない場合、integration gate は upgrade artifact missing を示して FAIL する。
- upgrade 必須変更がある状態で upgrade-result.json result=failed の場合、integration gate は FAIL する。
- upgrade 必須変更がある状態で checkedPaths が現在の matched path set と一致しない場合、integration gate は stale upgrade artifact を示して FAIL する。
- upgrade 必須変更がない状態では、integration gate は upgrade-result.json の有無だけでは FAIL しない。
- finalize/report の durable artifact 対象に upgrade-result.json と raw log が含まれる。
- `sdd-forge upgrade --dry-run`、`sdd-forge upgrade --help`、`sdd-forge upgrade -h` は許可され、値付き option、positional argument、未知の option は entry point validation で拒否される。
- `specs/278-upgrade-result-artifact/tests/` 配下の spec tests は各 file 先頭に `// spec: R<N> ...` header を持つ。
- 既存の test-execute-result.json v2 schema と test-result-review schema は変更されない。

## Implementation Targets
- src/upgrade.js
- src/flow/lib/test-artifacts.js
- src/flow/lib/run-gate.js
- src/flow/lib/run-finalize.js
- src/flow/lib/run-report.js
- src/skills/sdd-forge.flow/SKILL.md

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Add upgrade artifact contract
  - Define upgrade-result.json version 1, write it during active-flow upgrade execution, and validate raw log paths inside the spec directory.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Gate upgrade evidence
  - Make integration gate require and validate upgrade-result.json only when the diff includes upgrade-required source paths.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Persist upgrade reporting
  - Include upgrade-result.json and its raw log in durable finalize artifacts and expose upgrade status in report data.
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Document flow usage
  - Update flow skill/prompt guidance so agents run sdd-forge upgrade after skill or preset source changes and understand that upgrade-result.json is a gate artifact.
  - see `tasks/T-4.md` for full spec
