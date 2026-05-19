# Feature Specification: 260-post-retry-recovery

**Feature Branch**: `feature/260-post-retry-recovery`
**Created**: 2026-05-18
**Status**: Draft
**Input**: GitHub Issue #331

## Goal
retry exhausted 後でも、前回 FAIL 後に実装差分または evidence artifact が変わった場合に限り、明示 recovery 操作で 1 回だけ再評価へ戻せるようにする。recovery 操作は issue-log と spec-local artifact に監査情報を残し、next-action / status で停止理由と recovery 可否を表示する。

## Background
Issue #331 reports that gate / review findings can be fixed after retry budget is exhausted, but the flow still cannot re-evaluate because exhaustion and repeated unchanged failure are represented as the same stop. Existing gate code already tracks retry counts and rejects unchanged gate re-runs with HEAD/worktree state. Existing review code tracks review retry counts and exposes a reviewStop view. Existing `flow set retry reset` can clear retry counters, but it does not require a reason, does not record changed evidence, and resets the counter to zero, which can grant more than one additional evaluation. This spec changes retry reset into an audited recovery grant for exhausted states while keeping unchanged failures stopped.

## Scope
- must: recoverable target phase の retry exhausted 後に、変更済み状態だけを明示 recovery で 1 回再評価できる導線
- must: recovery 操作の reason、kind、phase、changed evidence、permitted re-evaluation count、timestamp の監査記録
- must: next-action / status に retry exhausted、recovery 可否、recovery command、対象 kind / phase を表示すること
- must: 同じ失敗または未変更状態が続く場合に、従来通り停止して retry budget を延命しないこと
- must: tracked だが recoverable ではない gate draft/spec exhaustion は recoveryPossible:false と理由を表示すること
- should: CLI help、flow prompt、skill template の recovery guidance 更新

## Out of Scope
- maxAttempts の単純な増加
- 無制限または自動の再評価
- review / gate の判定内容そのものの改善
- finalize / final-regression 専用 recovery の変更
- Done 済み dc7f や cdb2 review convergence 本体への追記

## Constraints
- 外部依存を追加しない。Node.js 組み込みモジュールだけを使用する。
- alpha 版方針に従い、旧 reset command 挙動を保持する互換 layer は追加しない。
- 既存 CLI の意味変更を含むため、backward-compatible-cli-interface の migration plan として help / prompt / spec / error message に新しい監査入力、recovery 条件、旧形式が拒否された場合の新形式 command を明記する。
- User-facing input validation: `flow set retry reset <kind> <phase> --reason <text> --yes` は entry point で検証する。kind は `gate` または `review`、gate phase は `task-impl` または `integration`、review phase は `draft` / `draft-questions` / `draft-coverage` / `review-draft-questions` / `review-draft-coverage` / `spec` / `test` / `impl`、reason は trim 後 20 文字以上、--yes は必須。
- Exit code contract: 有効な recovery または non-exhausted reset は ok:true で exit 0。invalid input、reason 不足、--yes 不足、未変更状態、対象 phase 不一致、監査 artifact 書き込み失敗は Envelope.fail で ok:false を返し non-zero exit とする。
- bounded-resource-usage: recovery eligibility の evidence scan は対象 spec directory と現在 flow state に限定し、artifact fingerprint 対象ファイル数と文字列長に上限を設ける。上限超過時は recovery 不可として Envelope.fail を返す。
- Recoverable target phases: gate は `task-impl` / `integration` のみ。review は canonical phase `draft-questions` / `draft-coverage` / `spec` / `test` / `impl`。入力 alias `review-draft-questions` と `review-draft-coverage` は canonical phase に正規化して記録・表示する。
- Unsupported tracked gate phases: gate `draft` / `spec` は retry exhausted 表示対象だが audited recovery grant の対象外。next-action / status は recoveryPossible:false と reason `unsupported-plan-gate-phase` を返し、set-retry は gate draft/spec を invalid phase として拒否する。
- Evidence source mapping: gate task-impl は実装 diff fingerprint、gate integration は実装 diff fingerprint と test-execute-result / test-result-review artifact fingerprint、review draft-questions / draft-coverage は draft.json fingerprint、review spec は spec.json fingerprint、review test は spec-local tests directory fingerprint、review impl は実装 diff fingerprint を使う。
- Evidence fingerprint は recovery artifact、issue-log、runtime logs を除外する。changedEvidence summary は sourceKind、baselineHash、currentHash、changedPaths、truncated を持ち、changedPaths は最大 50 件、各 path は最大 300 文字に制限する。
- Recovery artifact target: `specs/<spec>/retry-recovery.json`。shape は `{ "version": 1, "entries": [...] }` とし、entry は id、kind、phase、canonicalPhase、reason、changedEvidence、permittedReevaluationCount、attemptsBefore、maxAttempts、counterAfter、recoveryCommand、createdAt を持つ。
- OOP 方針に従い、recovery entry、changed evidence、retry allowance は専用 class で invariant を強制し、単なる object literal の組み合わせにしない。
- src/ 配下にこの spec 固有の Issue 番号や文言を固定値として入れない。表示文は汎用的な retry recovery 表現にする。

## Design Principles
- retry reset を retry budget 延命ではなく、監査付き recovery grant として扱う。
- 同じ失敗を繰り返している状態と、修正済みで再評価したい状態を evidence 変化で区別する。
- 既存の gate / review retry counter と reviewStop 表示を拡張し、別系統の状態管理を増やさない。
- ユーザーが実行すべき次の操作を next-action / status に出し、停止状態の原因を CLI 出力だけに閉じ込めない。

## Overview
### Modules
- src/flow/lib/set-retry.js — retry reset command を監査付き recovery grant として拡張する。
- src/flow/lib/run-gate.js — gate retry count、no-progress state、retry exhausted envelope と recovery eligibility の接続点。
- src/flow/lib/run-review.js / review-failure.js — review retry exhausted と reviewStop 表示の接続点。
- src/flow/commands/review.js — review verdict FAIL 時の phase-specific recovery baseline 永続化の接続点。
- src/flow/lib/test-artifacts.js / draft-review-routes.js — test artifact と draft review phase alias の evidence source 補助。
- src/flow/lib/get-next-action.js / get-status.js — retry exhausted 後の recovery 可否と recovery command を表示する出力面。
- src/flow/registry.js と flow prompts/templates — set retry help、dispatcher guidance、recovery command 例を更新する。

### Data Flow
- gate/review FAIL → retry metrics + recovery baseline fingerprint → retry exhausted stop view → recovery eligibility check → retry-recovery.json + issue-log → one-attempt allowance metric → re-evaluation
- current flow state + last same canonical kind/phase baseline → phase-specific evidence fingerprint → next-action/status recoveryPossible + recoveryCommand

### Decisions
- [VERIFY] set-retry.js is the central reset entry and already validates action/kind/phase.
- [VERIFY] gate already stores enough state to reject unchanged re-runs.
- [VERIFY] review exhausted state is surfaced through reviewStop views.
- [CORRECTION] Review recovery needs a persisted baseline before exhaustion.
- [VERIFY] next-action and status are the right display surfaces.
- Use existing reset command as the recovery entry rather than adding a separate command.
- Grant exactly one re-evaluation after exhaustion by setting current retry count to max-1 for the target kind/phase.
- Record migration guidance in spec and user-facing help because the existing reset command meaning changes.
- Limit audited gate recovery to task-impl and integration; plan gates display unsupported recovery state.
- Use retry-recovery.json as the single spec-local recovery artifact.

## Clarifications (Q&A)
- Q: Why not increase maxAttempts?
  - A: Increasing maxAttempts extends all retry loops. This spec grants exactly one audited re-evaluation only after changed diff/evidence proves the stopped state is no longer the same failure.
- Q: How is one re-evaluation enforced?
  - A: The recovery grant must make the post-command retry count equal maxAttempts - 1 for the target kind/phase. The next FAIL reaches maxAttempts again; PASS clears the count through existing PASS reset behavior.
- Q: What is the migration plan for existing reset command users?
  - A: The old unaudited form is not kept as a compatibility path. Help, prompts, spec, and error messages must show `--reason` and explain that exhausted recovery requires changed diff/evidence. Invalid old-form calls fail with a message containing the new command shape.
- Q: What constitutes success and failure for the modified command?
  - A: Success is a valid reset or eligible exhausted recovery with audit records written. Failure is invalid input, missing --yes, missing/short reason, unchanged exhausted state, unsupported phase, or artifact write failure; these return ok:false and non-zero exit.
- Q: Which phases can use audited recovery?
  - A: gate task-impl/integration and review draft-questions/draft-coverage/spec/test/impl. gate draft/spec are tracked for exhaustion but not recoverable by this command; status surfaces recoveryPossible:false.
- Q: Where is the recovery audit artifact written?
  - A: `specs/<spec>/retry-recovery.json` with version 1 and append-only entries. issue-log references the same recovery command and reason for human audit.

## Alternatives Considered
- Increase maxAttempts for gate/review phases — Rejected because it prolongs unchanged failure loops and does not record why an extra evaluation is allowed.
- Keep reset-to-zero behavior and add only issue-log text — Rejected because reset-to-zero can grant more than one re-evaluation, contradicting Issue #331's one re-evaluation constraint.
- Add a new `flow run recover` command — Rejected because existing `flow set retry reset` is already the reset/recovery entry for gate and review counters.
- Require users to provide changed evidence manually — Rejected because the flow can compute diff/evidence fingerprints from local artifacts, and manual evidence text alone would not distinguish unchanged re-runs.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-05-18T14:52:49.499Z
- Notes: autoApprove: spec gate passed and approval choice [1] was selected automatically

## Requirements
- R1 [must]: `flow set retry reset <gate|review> <phase> --reason <text> --yes` must validate action, kind, phase, reason length, and --yes at the command entry point before mutating metrics or artifacts.
- R2 [must]: Recoverable targets must be limited to gate task-impl/integration and review draft-questions/draft-coverage/spec/test/impl; gate draft/spec exhaustion must be displayed with recoveryPossible:false and must remain invalid for set-retry.
- R3 [must]: Review verdict FAIL and review stop handling must persist a phase-specific recovery baseline fingerprint before or when reviewRetry/reviewStop reaches exhaustion.
- R4 [must]: When a recoverable target has exhausted its resolved maxAttempts, retry reset must compute recovery eligibility from the target's phase-specific evidence source mapping and the last same canonical kind/phase baseline.
- R5 [must]: When exhausted and no mapped evidence source changed since the last same canonical kind/phase baseline, retry reset must return Envelope.fail without appending reset metrics, recovery artifacts, or retry allowance metrics.
- R6 [must]: When exhausted recovery is eligible, retry reset must append `specs/<spec>/retry-recovery.json` entry and an issue-log entry containing reason, kind, phase, canonicalPhase, changedEvidence, permittedReevaluationCount, attemptsBefore, maxAttempts, counterAfter, recoveryCommand, and createdAt.
- R7 [must]: When exhausted recovery is granted, the current retry count for the target canonical kind/phase must become maxAttempts - 1 so exactly one subsequent FAIL re-exhausts the phase; a subsequent PASS must still reset the counter to zero through existing PASS behavior.
- R8 [must]: `flow get next-action` and `flow get status` must show retry exhausted state with kind, phase, canonicalPhase, attempts, max, recoveryPossible, recoveryReason, changedEvidence summary, and recoveryCommand when the active step is stopped by gate or review retry exhaustion.
- R9 [must]: When the same failure continues after the one permitted re-evaluation, existing retry exhausted or repeated-failure stop behavior must remain in effect and must not automatically grant another recovery.
- R10 [should]: CLI help, flow prompt guidance, and generated skill template text should describe the audited recovery command, required --reason, one re-evaluation limit, and unchanged-state rejection.
- R11 [must]: Spec-local tests must cover exhausted eligible recovery, exhausted unchanged rejection, one-attempt allowance, audit artifact/issue-log creation, and next-action/status recovery display.

## Acceptance Criteria
- Given gate or review retry count is below maxAttempts, reset validates --reason and --yes, records an audited reset entry, and preserves existing non-exhausted reset behavior with exit 0.
- Given gate draft/spec retry is exhausted, next-action/status reports recoveryPossible:false with reason unsupported-plan-gate-phase and set-retry rejects gate draft/spec.
- Given review verdict FAIL reaches exhaustion, the flow persists a canonical phase baseline fingerprint for later recovery comparison.
- Given retry count is exhausted and mapped evidence changed since the last same canonical kind/phase baseline, reset exits 0, writes retry-recovery.json, writes an issue-log entry, and leaves current retry count at maxAttempts - 1.
- Given retry count is exhausted and mapped evidence is unchanged, reset exits non-zero with a machine-readable error and does not mutate retry metrics or recovery artifacts.
- After an eligible recovery grant, one subsequent FAIL for the same kind/phase returns the flow to exhausted state without granting another automatic retry.
- `flow get next-action` and `flow get status` include recoveryPossible and recoveryCommand when exhausted recovery is possible, and include a reason when recovery is not possible.
- `retry-recovery.json` validates as version 1 with entries containing id, kind, phase, canonicalPhase, reason, changedEvidence, permittedReevaluationCount, attemptsBefore, maxAttempts, counterAfter, recoveryCommand, and createdAt.
- New spec-local tests under specs/260-post-retry-recovery/tests/ include `// spec: R<N>` headers for every testable requirement.
- If src/templates or src/presets content changes, `sdd-forge upgrade` is run and generated skill/config diffs are included.

## Implementation Targets
- src/flow/lib/set-retry.js
- src/flow/lib/run-gate.js
- src/flow/lib/run-review.js
- src/flow/lib/review-failure.js
- src/flow/commands/review.js
- src/flow/lib/draft-review-routes.js
- src/flow/lib/test-artifacts.js
- src/flow/lib/get-next-action.js
- src/flow/lib/get-status.js
- src/flow/registry.js
- src/flow/prompts/impl/review.md
- src/flow/prompts/impl/gate-impl.md
- src/flow/prompts/plan/review-test.md
- src/templates/skills/sdd-forge.flow/SKILL.md

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Add audited retry recovery grant
  - Extend retry reset into an audited recovery grant that validates --reason, computes changed evidence, writes recovery audit records, and grants exactly one re-evaluation for exhausted phases.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Surface retry recovery state
  - Expose retry exhausted and recovery possible/impossible state through next-action and status so the user can see the stop reason and recovery command.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Update recovery guidance
  - Update CLI help, flow prompts, and generated skill template guidance so recovery instructions match the audited command and one-attempt policy.
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Add spec recovery tests
  - Add spec-local tests that prove the recovery behavior satisfies every testable requirement and protects unchanged exhausted states.
  - see `tasks/T-4.md` for full spec
